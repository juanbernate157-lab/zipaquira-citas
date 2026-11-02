const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const os = require('os');
const { db, getSettings } = require('../db');
const {
  sendClientBookingConfirmation,
  sendAdminNewBookingNotification,
  sendRescheduleNotification,
  sendCancellationNotification,
  sendClient30MinuteReminder,
  createICSContent,
  createGoogleCalendarUrl,
} = require('../emailService');
const {
  formatWhatsAppBookingMessage,
  sendAdminWhatsAppNotification,
} = require('../whatsappService');

// Helper to generate readable short code: CIT-XXXXX
function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CIT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to get local network IP
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Helper to determine base URL (never send localhost in emails so phones can open it)
function getBaseUrl(req) {
  // If running in Render or cloud host:
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }

  const host = req.headers['x-forwarded-host'] || req.get('host') || '';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';

  // If request arrived with a real domain (e.g. zipaquira-citas.onrender.com or cloudflare)
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${protocol}://${host}`;
  }

  // Active Global Cloudflare URL that works on any phone worldwide
  try {
    const tunnelFile = path.join(__dirname, '..', '..', 'data', 'tunnel-url.txt');
    if (fs.existsSync(tunnelFile)) {
      const u = fs.readFileSync(tunnelFile, 'utf8').trim();
      if (u && u.startsWith('http')) return u;
    }
  } catch (e) {}
  return 'https://part-sen-mathematical-eagle.trycloudflare.com';
}

// Función para obtener los turnos maestros configurados por el administrador
function getMasterSlots() {
  try {
    const rows = db.prepare('SELECT * FROM schedule_slots WHERE is_active = 1 ORDER BY time_slot ASC').all();
    if (rows && rows.length > 0) {
      return rows.map(r => ({
        time: r.time_slot,
        label: r.label,
        period: r.period,
        periodLabel: r.period_label,
      }));
    }
  } catch (err) {
    console.error('Error cargando turnos maestros de la BD:', err);
  }
  return [
    { time: '08:00', label: '08:00 AM', period: 'morning', periodLabel: 'Mañana' },
    { time: '09:00', label: '09:00 AM', period: 'morning', periodLabel: 'Mañana' },
    { time: '14:00', label: '02:00 PM', period: 'afternoon', periodLabel: 'Tarde' },
    { time: '15:00', label: '03:00 PM', period: 'afternoon', periodLabel: 'Tarde' },
  ];
}

// GET available slots for a given date and service duration
router.get('/available-slots', (req, res) => {
  try {
    const { date, duration = 60 } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'La fecha es obligatoria (YYYY-MM-DD)' });
    }

    const settings = getSettings();
    const serviceDuration = Number(duration) || 60;

    // 1. Check working days
    let workingDays = [1, 2, 3, 4, 5, 6];
    try {
      if (settings.working_days) {
        workingDays = JSON.parse(settings.working_days).map(Number);
      }
    } catch {
      workingDays = [1, 2, 3, 4, 5, 6];
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    const dayOfWeek = selectedDate.getDay(); // 0 is Sunday, 1 is Monday...

    if (!workingDays.includes(dayOfWeek)) {
      return res.json({
        available: false,
        message: 'RUFO Precise Detailing no atiende citas este día de la semana.',
        slots: []
      });
    }

    // 2. Check if the administrator cancelled the whole day
    const wholeDayBlock = db.prepare('SELECT reason FROM blocked_slots WHERE block_date = ? AND time_slot IS NULL').get(date);
    if (wholeDayBlock) {
      return res.json({
        available: false,
        message: `Atención cerrada para esta fecha por el administrador: ${wholeDayBlock.reason}`,
        slots: []
      });
    }

    // 3. Get master active slots configured by admin
    const masterSlots = getMasterSlots();

    // 4. Get specific blocked / cancelled slots for this date
    const blockedRows = db.prepare('SELECT time_slot, reason FROM blocked_slots WHERE block_date = ? AND time_slot IS NOT NULL').all(date);
    const blockedMap = new Map(blockedRows.map(b => [b.time_slot, b.reason]));

    // 5. Get existing bookings for this date that are not cancelled
    const existing = db.prepare(`
      SELECT appointment_time, service_duration 
      FROM appointments 
      WHERE appointment_date = ? AND status != 'cancelled'
    `).all(date);

    const slots = [];
    const now = new Date();
    const isToday = now.toISOString().slice(0, 10) === date;
    const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

    for (const slotDef of masterSlots) {
      const timeStr = slotDef.time;
      const [h, min] = timeStr.split(':').map(Number);
      const m = h * 60 + min;

      // Check if blocked by admin
      const isBlocked = blockedMap.has(timeStr);
      const blockReason = blockedMap.get(timeStr) || '';

      // Check if slot has already passed today (15 min buffer)
      const isPast = isToday && m <= (currentMinutesNow + 15);

      // Check overlap with existing appointments
      const slotEndMinutes = m + serviceDuration;
      let isBooked = false;

      for (const ex of existing) {
        const [exH, exM] = ex.appointment_time.split(':').map(Number);
        const exStart = exH * 60 + exM;
        const exEnd = exStart + (Number(ex.service_duration) || 60);

        // Check if [m, slotEndMinutes] overlaps with [exStart, exEnd]
        if (Math.max(m, exStart) < Math.min(slotEndMinutes, exEnd)) {
          isBooked = true;
          break;
        }
      }

      slots.push({
        time: timeStr,
        label: slotDef.label,
        period: slotDef.period,
        periodLabel: slotDef.periodLabel,
        available: !isPast && !isBooked && !isBlocked,
        isPast,
        isBooked,
        isBlocked,
        blockReason,
      });
    }

    res.json({
      available: true,
      date,
      slots,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all appointments (Admin search & filter)
router.get('/', (req, res) => {
  try {
    const { status, date, search, limit = 100 } = req.query;

    let query = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (date) {
      query += ' AND appointment_date = ?';
      params.push(date);
    }

    if (search) {
      query += ` AND (
        client_name LIKE ? OR 
        client_email LIKE ? OR 
        client_phone LIKE ? OR 
        code LIKE ? OR 
        service_name LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(Number(limit) || 200);

    const appointments = db.prepare(query).all(...params);

    // Calculate quick stats
    const todayStr = new Date().toISOString().slice(0, 10);
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM appointments').get().count,
      today: db.prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status != 'cancelled'").get(todayStr).count,
      confirmed: db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'confirmed'").get().count,
      cancelled: db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'").get().count,
      completed: db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'").get().count,
    };

    res.json({ appointments, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET appointment by booking code (Client view)
router.get('/code/:code', (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const app = db.prepare('SELECT * FROM appointments WHERE code = ?').get(code);
    if (!app) {
      return res.status(404).json({ error: 'Cita no encontrada con ese código' });
    }
    const settings = getSettings();
    res.json({
      appointment: app,
      business: {
        name: settings.business_name,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        city: settings.city,
        currency_symbol: settings.currency_symbol,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST book new appointment (Client workflow)
router.post('/', async (req, res) => {
  try {
    const {
      service_id,
      appointment_date,
      appointment_time,
      client_name,
      client_email,
      client_phone,
      client_notes
    } = req.body;

    if (!service_id || !appointment_date || !appointment_time || !client_name || !client_email || !client_phone) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser diligenciados' });
    }

    // Lookup service
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
    if (!service) {
      return res.status(400).json({ error: 'El servicio seleccionado no existe o no está disponible' });
    }

    // 1. Verificar si el administrador bloqueó/canceló la fecha completa
    const wholeDayBlock = db.prepare('SELECT reason FROM blocked_slots WHERE block_date = ? AND time_slot IS NULL').get(appointment_date);
    if (wholeDayBlock) {
      return res.status(400).json({
        error: `Atención cerrada para esta fecha por el administrador: ${wholeDayBlock.reason}`
      });
    }

    // 2. Verificar si el turno específico fue cancelado por el administrador
    const slotBlock = db.prepare('SELECT reason FROM blocked_slots WHERE block_date = ? AND time_slot = ?').get(appointment_date, appointment_time);
    if (slotBlock) {
      return res.status(400).json({
        error: `Este horario fue cancelado por el administrador para esta fecha: ${slotBlock.reason}`
      });
    }

    // 3. Validar que el horario esté activo en los turnos configurados en el sistema
    const activeSlot = db.prepare('SELECT id FROM schedule_slots WHERE time_slot = ? AND is_active = 1').get(appointment_time);
    if (!activeSlot) {
      return res.status(400).json({
        error: 'Horario no permitido o inactivo en el sistema. Consulta los turnos disponibles actualizados.'
      });
    }

    // Check slot availability and time conflicts
    const serviceDuration = Number(service.duration_minutes) || 60;
    const [h, min] = appointment_time.split(':').map(Number);
    const startM = h * 60 + min;
    const endM = startM + serviceDuration;

    const existingAppointments = db.prepare(`
      SELECT appointment_time, service_duration 
      FROM appointments 
      WHERE appointment_date = ? AND status != 'cancelled'
    `).all(appointment_date);

    const hasConflict = existingAppointments.some(ex => {
      const [exH, exM] = ex.appointment_time.split(':').map(Number);
      const exStart = exH * 60 + exM;
      const exEnd = exStart + (Number(ex.service_duration) || 60);
      return Math.max(startM, exStart) < Math.min(endM, exEnd);
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'Este horario acaba de ser ocupado o se cruza con otra cita. Por favor selecciona otro turno.' });
    }

    // Generate unique code
    let code = generateBookingCode();
    while (db.prepare('SELECT id FROM appointments WHERE code = ?').get(code)) {
      code = generateBookingCode();
    }

    // Insert into database with current timestamp (Audit trail: a qué hora agendó)
    const stmt = db.prepare(`
      INSERT INTO appointments (
        code, client_name, client_email, client_phone, client_notes,
        service_id, service_name, service_price, service_duration,
        appointment_date, appointment_time, status, reminder_sent,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 'confirmed', 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    const result = stmt.run(
      code,
      client_name.trim(),
      client_email.trim().toLowerCase(),
      client_phone.trim(),
      (client_notes || '').trim(),
      service.id,
      service.name,
      service.price,
      service.duration_minutes,
      appointment_date,
      appointment_time
    );

    const newAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
    const baseUrl = getBaseUrl(req);
    const settings = getSettings();
    const googleCalendarUrl = createGoogleCalendarUrl(newAppointment, settings);

    // Build direct WhatsApp notification URL for the administrator (clean text without corrupted characters)
    const adminPhone = (settings.callmebot_phone || settings.whatsapp || settings.phone || '573006042818').replace(/[^0-9]/g, '');
    const waText = formatWhatsAppBookingMessage(newAppointment, settings, baseUrl);
    const adminWhatsappUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(waText)}`;

    // Send notifications in background (Automated WhatsApp direct to Admin + Emails)
    Promise.allSettled([
      sendAdminWhatsAppNotification(newAppointment, baseUrl),
      sendAdminNewBookingNotification(newAppointment, baseUrl),
      sendClientBookingConfirmation(newAppointment, baseUrl),
    ]).catch(err => console.error('Error enviando notificaciones de nueva cita:', err));

    res.status(201).json({
      success: true,
      message: 'Cita agendada con éxito',
      appointment: newAppointment,
      manage_url: `${baseUrl}/cita/${newAppointment.code}`,
      google_calendar_url: googleCalendarUrl,
      admin_whatsapp_url: adminWhatsappUrl,
      ics_url: `${baseUrl}/api/appointments/${newAppointment.code}/ics`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT reschedule appointment (Client or Admin)
router.put('/:code/reschedule', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { new_date, new_time, notes } = req.body;

    if (!new_date || !new_time) {
      return res.status(400).json({ error: 'Debes seleccionar una nueva fecha y hora' });
    }

    const app = db.prepare('SELECT * FROM appointments WHERE code = ?').get(code);
    if (!app) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (app.status === 'cancelled') {
      return res.status(400).json({ error: 'Esta cita fue cancelada previamente. Debes agendar una nueva cita.' });
    }

    // 1. Verificar si el administrador bloqueó/canceló la fecha completa
    const wholeDayBlock = db.prepare('SELECT reason FROM blocked_slots WHERE block_date = ? AND time_slot IS NULL').get(new_date);
    if (wholeDayBlock) {
      return res.status(400).json({
        error: `Atención cerrada para esa fecha por el administrador: ${wholeDayBlock.reason}`
      });
    }

    // 2. Verificar si el nuevo turno fue cancelado por el administrador
    const slotBlock = db.prepare('SELECT reason FROM blocked_slots WHERE block_date = ? AND time_slot = ?').get(new_date, new_time);
    if (slotBlock) {
      return res.status(400).json({
        error: `El horario ${new_time} fue cancelado por el administrador para esa fecha: ${slotBlock.reason}`
      });
    }

    // 3. Validar que el nuevo horario esté activo en el sistema
    const activeSlot = db.prepare('SELECT id FROM schedule_slots WHERE time_slot = ? AND is_active = 1').get(new_time);
    if (!activeSlot) {
      return res.status(400).json({
        error: 'Horario no permitido o inactivo en el sistema.'
      });
    }

    // Check if new slot conflicts or overlaps with another active appointment
    const serviceDuration = Number(app.service_duration) || 60;
    const [h, min] = new_time.split(':').map(Number);
    const startM = h * 60 + min;
    const endM = startM + serviceDuration;

    const otherAppointments = db.prepare(`
      SELECT appointment_time, service_duration 
      FROM appointments 
      WHERE appointment_date = ? AND id != ? AND status != 'cancelled'
    `).all(new_date, app.id);

    const hasConflict = otherAppointments.some(ex => {
      const [exH, exM] = ex.appointment_time.split(':').map(Number);
      const exStart = exH * 60 + exM;
      const exEnd = exStart + (Number(ex.service_duration) || 60);
      return Math.max(startM, exStart) < Math.min(endM, exEnd);
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'El horario seleccionado ya no está disponible o se cruza con otra cita. Por favor elige otro.' });
    }

    const oldDate = app.appointment_date;
    const oldTime = app.appointment_time;

    // Update appointment
    db.prepare(`
      UPDATE appointments 
      SET appointment_date = ?, appointment_time = ?, status = 'rescheduled', reminder_sent = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new_date, new_time, app.id);

    const updatedApp = db.prepare('SELECT * FROM appointments WHERE id = ?').get(app.id);
    const baseUrl = getBaseUrl(req);

    // Send notification emails
    sendRescheduleNotification(updatedApp, oldDate, oldTime, baseUrl).catch(err => {
      console.error('Error enviando notificación de reprogramación:', err);
    });

    res.json({
      success: true,
      message: 'Cita aplazada / reprogramada exitosamente',
      appointment: updatedApp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT cancel appointment (Client or Admin)
router.put('/:code/cancel', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { reason = 'Cancelada por el cliente' } = req.body;

    const app = db.prepare('SELECT * FROM appointments WHERE code = ?').get(code);
    if (!app) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (app.status === 'cancelled') {
      return res.status(400).json({ error: 'Esta cita ya se encontraba cancelada' });
    }

    db.prepare(`
      UPDATE appointments 
      SET status = 'cancelled', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(reason, app.id);

    const updatedApp = db.prepare('SELECT * FROM appointments WHERE id = ?').get(app.id);
    const baseUrl = getBaseUrl(req);

    // Send cancellation notifications
    sendCancellationNotification(updatedApp, reason, baseUrl).catch(err => {
      console.error('Error enviando notificación de cancelación:', err);
    });

    res.json({
      success: true,
      message: 'Cita cancelada con éxito',
      appointment: updatedApp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update status (Admin action: confirm, complete, etc.)
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'rescheduled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    const app = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Cita no encontrada' });

    db.prepare('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, app.id);
    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(app.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST manually send 30-min reminder (Admin trigger / test)
router.post('/:id/send-reminder', async (req, res) => {
  try {
    const app = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Cita no encontrada' });

    const baseUrl = getBaseUrl(req);
    await sendClient30MinuteReminder(app, baseUrl);
    db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(app.id);

    res.json({ success: true, message: `Recordatorio enviado a ${app.client_email}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET download .ics calendar file
router.get('/:code/ics', (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const app = db.prepare('SELECT * FROM appointments WHERE code = ?').get(code);
    if (!app) return res.status(404).send('Cita no encontrada');
    const settings = getSettings();
    const ics = createICSContent(app, settings);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cita-${app.code}.ics"`);
    res.send(ics);
  } catch (error) {
    res.status(500).send('Error generando archivo de calendario: ' + error.message);
  }
});

// GET google calendar redirect
router.get('/:code/calendar', (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const app = db.prepare('SELECT * FROM appointments WHERE code = ?').get(code);
    if (!app) return res.status(404).send('Cita no encontrada');
    const settings = getSettings();
    const url = createGoogleCalendarUrl(app, settings);
    res.redirect(url);
  } catch (error) {
    res.status(500).send('Error redirigiendo a Google Calendar');
  }
});

module.exports = router;
