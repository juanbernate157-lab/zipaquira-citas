const express = require('express');
const router = express.Router();
const { db, getSettings } = require('../db');
const { backupToCloud } = require('../cloudSync');

// Helper to format time_slot (HH:MM) to readable label
function formatSlotLabel(timeStr) {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
}

// GET overview (slots, blocked slots, working days)
router.get('/overview', (req, res) => {
  try {
    const slots = db.prepare('SELECT * FROM schedule_slots ORDER BY time_slot ASC').all();
    const blocked = db.prepare('SELECT * FROM blocked_slots ORDER BY block_date ASC, time_slot ASC').all();
    const settings = getSettings();

    let workingDays = [1, 2, 3, 4, 5, 6];
    try {
      if (settings.working_days) {
        workingDays = JSON.parse(settings.working_days).map(Number);
      }
    } catch {
      workingDays = [1, 2, 3, 4, 5, 6];
    }

    res.json({
      workingDays,
      slots,
      blocked,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all master schedule slots
router.get('/slots', (req, res) => {
  try {
    const slots = db.prepare('SELECT * FROM schedule_slots ORDER BY time_slot ASC').all();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new master schedule slot
router.post('/slots', (req, res) => {
  try {
    let { time_slot, label, period, period_label } = req.body;
    if (!time_slot) {
      return res.status(400).json({ error: 'La hora del turno es obligatoria (formato HH:MM)' });
    }

    // Format time_slot
    const parts = time_slot.split(':');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Formato de hora inválido. Usa formato 24 horas (ej: 08:00, 14:00)' });
    }
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return res.status(400).json({ error: 'Valores de hora o minutos inválidos' });
    }

    const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const formattedLabel = label?.trim() || formatSlotLabel(formattedTime);
    const isMorning = h < 12;
    const finalPeriod = period || (isMorning ? 'morning' : 'afternoon');
    const finalPeriodLabel = period_label || (isMorning ? 'Mañana' : 'Tarde');

    // Check duplicate
    const existing = db.prepare('SELECT id FROM schedule_slots WHERE time_slot = ?').get(formattedTime);
    if (existing) {
      return res.status(400).json({ error: `El horario ${formattedTime} ya existe en la lista de turnos.` });
    }

    const stmt = db.prepare(`
      INSERT INTO schedule_slots (time_slot, label, period, period_label, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const result = stmt.run(formattedTime, formattedLabel, finalPeriod, finalPeriodLabel);

    const newSlot = db.prepare('SELECT * FROM schedule_slots WHERE id = ?').get(result.lastInsertRowid);
    backupToCloud().catch(() => {});
    res.status(201).json(newSlot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT toggle active/inactive status of a master slot
router.put('/slots/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const slot = db.prepare('SELECT * FROM schedule_slots WHERE id = ?').get(id);
    if (!slot) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }

    const newStatus = slot.is_active ? 0 : 1;
    db.prepare('UPDATE schedule_slots SET is_active = ? WHERE id = ?').run(newStatus, id);

    const updated = db.prepare('SELECT * FROM schedule_slots WHERE id = ?').get(id);
    backupToCloud().catch(() => {});
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a master slot
router.delete('/slots/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM schedule_slots WHERE id = ?').run(id);
    backupToCloud().catch(() => {});
    res.json({ success: true, message: 'Horario eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate / synchronize slots from opening and closing hours
router.post('/generate-from-hours', (req, res) => {
  try {
    const settings = getSettings();
    const openTime = req.body.opening_time || settings.opening_time || '08:00';
    const closeTime = req.body.closing_time || settings.closing_time || '18:00';
    const interval = Number(req.body.interval || settings.slot_interval_minutes) || 60;

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const startMin = openH * 60 + openM;
    const endMin = closeH * 60 + closeM;

    if (startMin >= endMin) {
      return res.status(400).json({ error: 'La hora de cierre debe ser posterior a la de apertura' });
    }

    const inserted = [];
    for (let m = startMin; m < endMin; m += interval) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const label = formatSlotLabel(timeStr);
      const isMorning = h < 12;
      const period = isMorning ? 'morning' : 'afternoon';
      const periodLabel = isMorning ? 'Mañana' : 'Tarde';

      const existing = db.prepare('SELECT id FROM schedule_slots WHERE time_slot = ?').get(timeStr);
      if (!existing) {
        db.prepare('INSERT INTO schedule_slots (time_slot, label, period, period_label, is_active) VALUES (?, ?, ?, ?, 1)')
          .run(timeStr, label, period, periodLabel);
      } else {
        db.prepare('UPDATE schedule_slots SET is_active = 1 WHERE id = ?').run(existing.id);
      }
      inserted.push(timeStr);
    }

    const slots = db.prepare('SELECT * FROM schedule_slots ORDER BY time_slot ASC').all();
    backupToCloud().catch(() => {});
    res.json({ success: true, message: `Se sincronizaron ${inserted.length} turnos entre ${openTime} y ${closeTime}`, slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET blocked / cancelled slots
router.get('/blocked', (req, res) => {
  try {
    const blocked = db.prepare('SELECT * FROM blocked_slots ORDER BY block_date ASC, time_slot ASC').all();
    res.json(blocked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST block / cancel a schedule slot for a specific date
router.post('/blocked', (req, res) => {
  try {
    let { block_date, time_slot, reason } = req.body;
    if (!block_date) {
      return res.status(400).json({ error: 'La fecha es obligatoria (YYYY-MM-DD)' });
    }

    const finalSlot = (time_slot && time_slot !== 'ALL' && time_slot !== 'all') ? time_slot.trim() : null;
    const finalReason = reason?.trim() || 'Cancelado / Inhabilitado por el administrador';

    // Check if already blocked
    let existing;
    if (finalSlot) {
      existing = db.prepare('SELECT id FROM blocked_slots WHERE block_date = ? AND time_slot = ?').get(block_date, finalSlot);
    } else {
      existing = db.prepare('SELECT id FROM blocked_slots WHERE block_date = ? AND time_slot IS NULL').get(block_date);
    }

    if (existing) {
      return res.status(400).json({ error: 'Este horario o día ya se encuentra bloqueado para esa fecha.' });
    }

    const stmt = db.prepare(`
      INSERT INTO blocked_slots (block_date, time_slot, reason)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(block_date, finalSlot, finalReason);

    const newBlocked = db.prepare('SELECT * FROM blocked_slots WHERE id = ?').get(result.lastInsertRowid);
    backupToCloud().catch(() => {});
    res.status(201).json(newBlocked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE unblock / restore a cancelled slot
router.delete('/blocked/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM blocked_slots WHERE id = ?').run(id);
    backupToCloud().catch(() => {});
    res.json({ success: true, message: 'Horario desbloqueado y rehabilitado para reservas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update working days
router.put('/working-days', (req, res) => {
  try {
    const { working_days } = req.body;
    if (!Array.isArray(working_days)) {
      return res.status(400).json({ error: 'Los días laborables deben ser un arreglo de números' });
    }

    const jsonStr = JSON.stringify(working_days);
    db.prepare('UPDATE settings SET working_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(jsonStr);
    backupToCloud().catch(() => {});

    res.json({ success: true, working_days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
