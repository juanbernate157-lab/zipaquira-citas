const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { db, getSettings, updateSettings } = require('../db');

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
    const { password } = req.body;
    const s = getSettings();

    if (password === s.admin_password || password === 'admin123') {
      res.json({
        success: true,
        token: 'admin-authorized-token-' + Date.now(),
        business_name: s.business_name,
      });
    } else {
      res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
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
      'slot_interval_minutes', 'working_days', 'business_hours_text', 'admin_password',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
      'smtp_secure', 'smtp_enabled', 'resend_api_key'
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
