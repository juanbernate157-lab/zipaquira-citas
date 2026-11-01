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
  return 'https://morning-groups-sydney-pays.trycloudflare.com';
}

// GET available slots for a given date and service duration
router.get('/available-slots', (req, res) => {
  try {
    const { date, duration = 30 } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'La fecha es obligatoria (YYYY-MM-DD)' });
    }

    const settings = getSettings();
    const serviceDuration = Number(duration) || 30;

    // Check working days
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
        message: 'El establecimiento no atiende citas este día de la semana.',
        slots: []
      });
    }

    // Get existing bookings for this date that are not cancelled
    const existing = db.prepare(`
      SELECT appointment_time, service_duration 
      FROM appointments 
      WHERE appointment_date = ? AND status != 'cancelled'
    `).all(date);

    // Parse opening and closing times
    const [openHour, openMin] = (settings.opening_time || '08:00').split(':').map(Number);
    const [closeHour, closeMin] = (settings.closing_time || '19:00').split(':').map(Number);
    const interval = Number(settings.slot_interval_minutes) || 30;

    const startMinutes = openHour * 60 + openMin;
    const endMinutes = closeHour * 60 + closeMin;

    const slots = [];
    const now = new Date();
    const isToday = now.toISOString().slice(0, 10) === date;
    const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

    for (let m = startMinutes; m + serviceDuration <= endMinutes; m += interval) {
      const h = Math.floor(m / 60).toString().padStart(2, '0');
      const min = (m % 60).toString().padStart(2, '0');
      const timeStr = `${h}:${min}`;

      // Check if slot has already passed today
      const isPast = isToday && m <= (currentMinutesNow + 15); // 15 min buffer

      // Check overlap with existing appointments
      const slotEndMinutes = m + serviceDuration;
      let isBooked = false;

      for (const ex of existing) {
        const [exH, exM] = ex.appointment_time.split(':').map(Number);
        const exStart = exH * 60 + exM;
        const exEnd = exStart + (Number(ex.service_duration) || 30);

        // Check if [m, slotEndMinutes] overlaps with [exStart, exEnd]
        if (Math.max(m, exStart) < Math.min(slotEndMinutes, exEnd)) {
          isBooked = true;
          break;
        }
      }

      slots.push({
        time: timeStr,
        available: !isPast && !isBooked,
        isPast,
        isBooked,
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

    query += ' ORDER BY appointment_date DESC, appointment_time DESC, id DESC LIMIT ?';
    params.push(Number(limit) || 100);

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

    // Check slot availability
    const conflict = db.prepare(`
      SELECT id FROM appointments 
      WHERE appointment_date = ? AND appointment_time = ? AND status != 'cancelled'
    `).get(appointment_date, appointment_time);

    if (conflict) {
      return res.status(409).json({ error: 'Este horario acaba de ser ocupado. Por favor selecciona otro horario disponible.' });
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

    // Send emails in background (confirmation to client & notification to admin)
    Promise.all([
      sendClientBookingConfirmation(newAppointment, baseUrl),
      sendAdminNewBookingNotification(newAppointment, baseUrl),
    ]).catch(err => console.error('Error enviando correos de nueva cita:', err));

    res.status(201).json({
      success: true,
      message: 'Cita agendada con éxito',
      appointment: newAppointment,
      manage_url: `${baseUrl}/cita/${newAppointment.code}`,
      google_calendar_url: googleCalendarUrl,
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

    // Check if new slot is taken by another appointment
    const conflict = db.prepare(`
      SELECT id FROM appointments 
      WHERE appointment_date = ? AND appointment_time = ? AND id != ? AND status != 'cancelled'
    `).get(new_date, new_time, app.id);

    if (conflict) {
      return res.status(409).json({ error: 'El horario seleccionado ya no está disponible. Por favor elige otro.' });
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
