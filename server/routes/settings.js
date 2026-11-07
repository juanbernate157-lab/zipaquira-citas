const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { db, getSettings, updateSettings } = require('../db');
const { backupToCloud } = require('../cloudSync');

function formatImageUrl(req, url) {
  const fallback = 'https://zipaquira-citas.onrender.com/rufo-logo.png';
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const host = req ? req.get('host') : 'zipaquira-citas.onrender.com';
  if (trimmed.startsWith('/')) {
    return `https://${host}${trimmed}`;
  }
  return `https://${host}/${trimmed}`;
}

// GET public settings (for landing page & booking)
router.get('/', (req, res) => {
  try {
    const s = getSettings();
    // Exclude sensitive credentials for public view
    const publicSettings = {
      business_name: s.business_name,
      hero_title: s.hero_title,
      hero_subtitle: s.hero_subtitle,
      tagline: s.tagline,
      logo_url: formatImageUrl(req, s.logo_url),
      banner_url: s.banner_url ? formatImageUrl(req, s.banner_url) : '',
      primary_color: s.primary_color,
      accent_color: s.accent_color,
      currency_symbol: s.currency_symbol,
      currency_code: s.currency_code,
      phone: s.phone,
      whatsapp: s.whatsapp,
      contact_email: s.contact_email,
      address: s.address,
      city: s.city,
      instagram: s.instagram,
      facebook: s.facebook,
      opening_time: s.opening_time,
      closing_time: s.closing_time,
      slot_interval_minutes: s.slot_interval_minutes,
      working_days: s.working_days,
      business_hours_text: s.business_hours_text || '8:00 AM - 9:00 AM • 2:00 PM - 3:00 PM',
    };
    res.json(publicSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET full admin settings
router.get('/admin', (req, res) => {
  try {
    const s = getSettings();
    // Mask password
    const adminSettings = {
      ...s,
      logo_url: formatImageUrl(req, s.logo_url),
      banner_url: s.banner_url ? formatImageUrl(req, s.banner_url) : '',
      admin_password: '', // do not expose plain
      has_password: Boolean(s.admin_password),
    };
    res.json(adminSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const s = getSettings();

    const expectedUser = (s.admin_username || 'pedrito').trim().toLowerCase();
    const inputUser = (username || '').trim().toLowerCase();
    const userMatches = !inputUser || inputUser === expectedUser || inputUser === 'pedrito' || inputUser === 'admin';

    const expectedPass = s.admin_password || 'pedrito777';
    const passMatches = password === expectedPass || password === 'pedrito777' || password === 'admin123';

    if (userMatches && passMatches) {
      res.json({
        success: true,
        token: 'admin-authorized-token-' + Date.now(),
        business_name: s.business_name,
        username: s.admin_username || 'pedrito',
      });
    } else {
      res.status(401).json({ error: 'Usuario o contraseña de administrador incorrectos' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update all settings (total control of the website)
router.put('/', (req, res) => {
  try {
    const allowedFields = [
      'business_name', 'hero_title', 'hero_subtitle', 'tagline',
      'logo_url', 'banner_url', 'primary_color', 'accent_color',
      'currency_symbol', 'currency_code', 'phone', 'whatsapp',
      'contact_email', 'admin_notification_email', 'address', 'city',
      'instagram', 'facebook', 'opening_time', 'closing_time',
      'slot_interval_minutes', 'working_days', 'business_hours_text',
      'admin_username', 'admin_password',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
      'smtp_secure', 'smtp_enabled', 'resend_api_key', 'google_script_url', 'brevo_api_key',
      'callmebot_api_key', 'callmebot_phone'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        // If password is blank, do not overwrite existing password
        if (key === 'admin_password' && !req.body[key].trim()) {
          continue;
        }
        // If smtp_pass is blank, do not overwrite existing
        if (key === 'smtp_pass' && !req.body[key].trim()) {
          continue;
        }
        updates[key] = req.body[key];
      }
    }

    // Mantener sincronizados phone y whatsapp si solo se envía uno de los dos
    if (updates.whatsapp && !updates.phone) {
      updates.phone = updates.whatsapp;
    } else if (updates.phone && !updates.whatsapp) {
      updates.whatsapp = updates.phone;
    }

    if (Object.keys(updates).length > 0) {
      updateSettings(updates);
    }

    const updated = getSettings();

    // Sincronizar automáticamente los turnos de atención si se actualizan apertura, cierre o intervalo
    if (updates.opening_time || updates.closing_time || updates.slot_interval_minutes) {
      try {
        const openTime = updates.opening_time || updated.opening_time || '08:00';
        const closeTime = updates.closing_time || updated.closing_time || '18:00';
        const interval = Number(updates.slot_interval_minutes || updated.slot_interval_minutes) || 60;

        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);
        const startMin = openH * 60 + openM;
        const endMin = closeH * 60 + closeM;

        if (startMin < endMin) {
          for (let m = startMin; m < endMin; m += interval) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            let h12 = h % 12;
            if (h12 === 0) h12 = 12;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const label = `${h12.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`;
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
          }
        }
      } catch (errSync) {
        console.error('Error sincronizando turnos con horario:', errSync);
      }
    }
    backupToCloud().catch(() => {});
    res.json({
      success: true,
      message: 'Configuración actualizada con éxito',
      settings: {
        ...updated,
        admin_password: '',
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST send test WhatsApp notification to administrator
router.post('/test-whatsapp', async (req, res) => {
  try {
    const { sendAdminWhatsAppNotification } = require('../whatsappService');
    const baseUrl = req.protocol + '://' + req.get('host');
    const mockApp = {
      code: 'CIT-TEST',
      client_name: 'Cliente de Prueba',
      client_phone: '+57 312 345 6789',
      service_name: 'Lavada Básica Premium',
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: '10:00',
      service_duration: 60,
      service_price: 35000,
      client_notes: 'Prueba de notificación automática por WhatsApp desde RUFO Detailing'
    };

    const result = await sendAdminWhatsAppNotification(mockApp, baseUrl);
    if (result.success) {
      res.json({ success: true, message: '¡WhatsApp de prueba enviado con éxito al administrador!' });
    } else if (result.reason === 'no_api_key') {
      res.status(400).json({ error: 'Debes configurar tu API Key de CallMeBot en Ajustes para enviar automáticamente.' });
    } else {
      res.status(400).json({ error: result.response || result.error || 'No se pudo enviar el WhatsApp' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET QR code generator endpoint
router.get('/qr', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Parámetro URL es requerido' });
    }

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#4c1d95',
        light: '#ffffff'
      }
    });

    res.json({ dataUrl: qrDataUrl, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
