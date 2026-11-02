const express = require('express');
const router = express.Router();
const { db, getSettings } = require('../db');
const { sendEmail } = require('../emailService');

// GET email logs
router.get('/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM email_logs 
      ORDER BY id DESC 
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST send test email
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body;
    const settings = getSettings();
    const targetEmail = to || settings.admin_notification_email || settings.contact_email;

    if (!targetEmail) {
      return res.status(400).json({ error: 'Debes especificar un correo de destino' });
    }

    const testHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #7c3aed;">🔔 Correo de Prueba Exitoso</h2>
        <p>Este es un correo de prueba desde el sistema de agendamiento de <strong>${settings.business_name}</strong>.</p>
        <p>Tu configuración de notificaciones está funcionando correctamente.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b;">Enviado el ${new Date().toLocaleString()}</p>
      </div>
    `;

    const result = await sendEmail({
      to: targetEmail,
      subject: `🧪 Prueba de Notificación - ${settings.business_name}`,
      html: testHtml,
      type: 'test',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Fallo en la conexión SMTP con Google' });
    }

    let methodMsg = 'Modo Simulado';
    if (result.mode === 'google_script') methodMsg = 'Google Apps Script (Gmail HTTPS)';
    else if (result.mode === 'brevo') methodMsg = 'Brevo API (HTTPS)';
    else if (result.mode === 'resend') methodMsg = 'Resend API (HTTPS)';
    else if (result.mode === 'smtp') methodMsg = 'SMTP Clásico';

    res.json({
      success: true,
      message: `¡Correo de prueba enviado a ${targetEmail} vía ${methodMsg}!`,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
