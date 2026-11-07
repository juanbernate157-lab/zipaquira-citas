const zlib = require('zlib');
const { db } = require('./db');

const KV_APP_KEY = '23zkkppt';
const KV_BASE_URL = `https://keyvalue.immanuel.co/api/KeyVal`;
const CHUNK_SIZE = 180; // Safe URL path segment length for IIS

async function setKeyVal(key, value) {
  const safeVal = encodeURIComponent(value);
  const res = await fetch(`${KV_BASE_URL}/UpdateValue/${KV_APP_KEY}/${key}/${safeVal}`, {
    method: 'POST',
  });
  return res.ok;
}

async function getKeyVal(key) {
  const res = await fetch(`${KV_BASE_URL}/GetValue/${KV_APP_KEY}/${key}`);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text) return null;
  // Response is JSON string like '"value"' or 'null'
  try {
    const parsed = JSON.parse(text);
    return parsed ? String(parsed) : null;
  } catch {
    return text.replace(/^"|"$/g, '');
  }
}

/**
 * Backup current SQLite state (services, settings, schedule_slots, blocked_slots, appointments)
 * to persistent cloud KV so Render free tier restarts never lose admin price/schedule updates.
 */
async function backupToCloud() {
  try {
    const services = db.prepare('SELECT * FROM services').all();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const schedule_slots = db.prepare('SELECT * FROM schedule_slots').all();
    const blocked_slots = db.prepare('SELECT * FROM blocked_slots').all();
    const appointments = db.prepare("SELECT * FROM appointments WHERE status != 'cancelled' ORDER BY id DESC LIMIT 60").all();

    const payloadObj = {
      v: 1,
      ts: Date.now(),
      services,
      settings,
      schedule_slots,
      blocked_slots,
      appointments,
    };

    const jsonStr = JSON.stringify(payloadObj);
    const compressed = zlib.deflateRawSync(Buffer.from(jsonStr, 'utf8')).toString('base64url');

    const chunks = [];
    for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
      chunks.push(compressed.slice(i, i + CHUNK_SIZE));
    }

    // Upload all chunks in parallel
    await Promise.all(
      chunks.map((chunk, idx) => setKeyVal(`rufo_chunk_${idx}`, chunk))
    );

    // Save metadata last (commit marker)
    const meta = Buffer.from(JSON.stringify({ chunks: chunks.length, len: compressed.length, ts: payloadObj.ts })).toString('base64url');
    await setKeyVal('rufo_meta_v1', meta);

    console.log(`☁️ [CloudSync] Estado respaldado en la nube (${chunks.length} bloques, ${compressed.length} bytes).`);
    return true;
  } catch (err) {
    console.error('⚠️ [CloudSync] Error respaldando en la nube:', err.message);
    return false;
  }
}

/**
 * Restore state from cloud KV into local SQLite on server startup
 */
async function restoreFromCloud() {
  try {
    const metaB64 = await getKeyVal('rufo_meta_v1');
    if (!metaB64) {
      console.log('ℹ️ [CloudSync] Sin respaldo previo en la nube, creando respaldo inicial...');
      await backupToCloud();
      return false;
    }

    const meta = JSON.parse(Buffer.from(metaB64, 'base64url').toString('utf8'));
    if (!meta || !meta.chunks || meta.chunks <= 0) return false;

    const chunkPromises = [];
    for (let i = 0; i < meta.chunks; i++) {
      chunkPromises.push(getKeyVal(`rufo_chunk_${i}`));
    }

    const chunks = await Promise.all(chunkPromises);
    if (chunks.some((c) => !c)) {
      console.warn('⚠️ [CloudSync] Algunos bloques del respaldo no estuvieron disponibles.');
      return false;
    }

    const fullCompressed = chunks.join('');
    const jsonStr = zlib.inflateRawSync(Buffer.from(fullCompressed, 'base64url')).toString('utf8');
    const data = JSON.parse(jsonStr);

    if (!data || !Array.isArray(data.services)) return false;

    // 1. Restore services
    db.exec('BEGIN TRANSACTION');
    try {
      db.exec('DELETE FROM services');
      const insertService = db.prepare(`
        INSERT INTO services (id, name, category, description, price, duration_minutes, image_url, badge, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.services) {
        insertService.run(
          s.id,
          s.name,
          s.category || 'General',
          s.description || '',
          Number(s.price) || 0,
          Number(s.duration_minutes) || 60,
          s.image_url || 'https://zipaquira-citas.onrender.com/rufo-logo.png',
          s.badge || '',
          s.is_active !== undefined ? Number(s.is_active) : 1,
          s.created_at || new Date().toISOString(),
          s.updated_at || new Date().toISOString()
        );
      }

      // 2. Restore settings
      if (data.settings) {
        const st = data.settings;
        const cols = Object.keys(st).filter((k) => k !== 'id');
        const setClause = cols.map((c) => `${c} = ?`).join(', ');
        const vals = cols.map((c) => st[c]);
        db.prepare(`UPDATE settings SET ${setClause} WHERE id = 1`).run(...vals);
      }

      // 3. Restore schedule_slots
      if (Array.isArray(data.schedule_slots) && data.schedule_slots.length > 0) {
        db.exec('DELETE FROM schedule_slots');
        const insertSlot = db.prepare(`
          INSERT INTO schedule_slots (id, time_slot, label, period, period_label, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const sl of data.schedule_slots) {
          insertSlot.run(sl.id, sl.time_slot, sl.label, sl.period, sl.period_label, sl.is_active, sl.created_at || new Date().toISOString());
        }
      }

      // 4. Restore blocked_slots
      if (Array.isArray(data.blocked_slots)) {
        db.exec('DELETE FROM blocked_slots');
        const insertBlocked = db.prepare(`
          INSERT INTO blocked_slots (id, block_date, time_slot, reason, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const bl of data.blocked_slots) {
          insertBlocked.run(bl.id, bl.block_date, bl.time_slot, bl.reason, bl.created_at || new Date().toISOString());
        }
      }

      // 5. Merge active appointments so no bookings are lost on cold start
      if (Array.isArray(data.appointments)) {
        const upsertApp = db.prepare(`
          INSERT OR REPLACE INTO appointments (
            id, code, client_name, client_email, client_phone, client_notes,
            service_id, service_name, service_price, service_duration,
            appointment_date, appointment_time, status, cancellation_reason,
            reminder_sent, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ap of data.appointments) {
          upsertApp.run(
            ap.id, ap.code, ap.client_name, ap.client_email, ap.client_phone, ap.client_notes || '',
            ap.service_id, ap.service_name, ap.service_price, ap.service_duration,
            ap.appointment_date, ap.appointment_time, ap.status, ap.cancellation_reason || null,
            ap.reminder_sent || 0, ap.created_at || new Date().toISOString(), ap.updated_at || new Date().toISOString()
          );
        }
      }

      db.exec('COMMIT');
      console.log(`✅ [CloudSync] Datos restaurados desde la nube (${data.services.length} servicios, precios: ${data.services.map(s => '$' + s.price).join(', ')}).`);
      return true;
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    console.error('⚠️ [CloudSync] Error restaurando desde la nube:', err.message);
    return false;
  }
}

module.exports = {
  backupToCloud,
  restoreFromCloud,
};
