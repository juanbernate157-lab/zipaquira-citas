const nodemailer = require('nodemailer');
const dns = require('node:dns');
const { db, getSettings } = require('./db');

// Enforce IPv4 resolution first on cloud containers (prevents Render IPv6 SMTP timeout)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Helper to format Date to UTC iCalendar string (YYYYMMDDTHHMMSSZ)
function formatToICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Generate RFC 5545 compliant iCalendar (.ics) content with 30-min reminder alarm
function createICSContent(appointment, settings) {
  const [year, month, day] = appointment.appointment_date.split('-').map(Number);
  const [hour, minute] = appointment.appointment_time.split(':').map(Number);
  const duration = Number(appointment.service_duration) || 30;

  // Colombia is UTC-5
  const startDate = new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const startICS = formatToICSDate(startDate);
  const endICS = formatToICSDate(endDate);
  const nowICS = formatToICSDate(new Date());

  const businessName = settings?.business_name || 'RUFO Precise Detailing';
  const address = `${settings?.address || 'Calle 5 # 10-25'}, ${settings?.city || 'Zipaquirá, Colombia'}`;
  const summary = `Cita: ${appointment.service_name} - ${businessName}`;
  const description = `Servicio: ${appointment.service_name}\\nCliente: ${appointment.client_name}\\nTeléfono: ${appointment.client_phone}\\nCódigo de Cita: ${appointment.code}\\nValor: $${Number(appointment.service_price).toLocaleString()} COP\\nLugar: ${address}\\n\\n* Recordatorio programado 30 minutos antes.`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RUFO Precise Detailing//Agendamiento Citas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:cita-${appointment.code}@rufodetailing.com`,
    `DTSTAMP:${nowICS}`,
    `DTSTART:${startICS}`,
    `DTEND:${endICS}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${address}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Recordatorio: Tu cita para ${appointment.service_name} en RUFO Precise Detailing inicia en 30 minutos`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// Helper to generate Google Calendar Web URL with 30-min reminder
function createGoogleCalendarUrl(appointment, settings) {
  const [year, month, day] = appointment.appointment_date.split('-').map(Number);
  const [hour, minute] = appointment.appointment_time.split(':').map(Number);
  const duration = Number(appointment.service_duration) || 30;

  // Colombia UTC-5
  const startDate = new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const dates = `${formatToICSDate(startDate)}/${formatToICSDate(endDate)}`;
  const businessName = settings?.business_name || 'Zipaquirá Enterprise';
  const address = `${settings?.address || 'Calle 5 # 10-25'}, ${settings?.city || 'Zipaquirá, Colombia'}`;
  const title = `Cita: ${appointment.service_name} - ${businessName}`;
  const details = `Cita para ${appointment.service_name}\nCliente: ${appointment.client_name}\nTeléfono: ${appointment.client_phone}\nCódigo: ${appointment.code}\nValor: $${Number(appointment.service_price).toLocaleString()} COP\nLugar: ${address}\n\n* Recordatorio 30 min antes.`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(address)}`;
}

// Helper to log emails into the database
function logEmail({ to, subject, type, code, html, status, details }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO email_logs (to_email, subject, email_type, appointment_code, content_html, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(to, subject, type, code || null, html, status || 'sent', details || null);
  } catch (err) {
    console.error('Error logging email to DB:', err);
  }
}

// Create Nodemailer transporter based on current settings
function getTransporter() {
  const settings = getSettings();
  if (settings.smtp_enabled && (settings.smtp_host || settings.smtp_user)) {
    const rawPass = settings.smtp_pass ? String(settings.smtp_pass).replace(/\s+/g, '') : '';
    const rawUser = settings.smtp_user ? String(settings.smtp_user).trim() : '';
    const host = settings.smtp_host ? String(settings.smtp_host).trim().toLowerCase() : '';
    const isGmail = host.includes('gmail') || rawUser.includes('@gmail.com');

    if (isGmail) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: rawUser,
          pass: rawPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
    }

    return nodemailer.createTransport({
      host: settings.smtp_host ? settings.smtp_host.trim() : 'smtp.gmail.com',
      port: Number(settings.smtp_port) || 587,
      secure: Number(settings.smtp_port) === 465,
      auth: {
        user: rawUser,
        pass: rawPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return null;
}

// Send an email (via Resend HTTPS, SMTP, or simulated mode) with iCalendar attachment
async function sendEmail({ to, subject, html, type, appointmentCode, icalContent }) {
  const settings = getSettings();
  const resendApiKey = (settings.resend_api_key || process.env.RESEND_API_KEY || '').trim();

  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL OUTBOX] Tipo: ${type.toUpperCase()}`);
  console.log(`Para: ${to}`);
  console.log(`Asunto: ${subject}`);
  console.log(`Método: ${resendApiKey ? 'Resend API (HTTPS Puerto 443 - 100% Render)' : (settings.smtp_enabled ? 'SMTP' : 'Modo Simulación')}`);
  console.log(`======================================================\n`);

  // 1. MÉTODO 1: Resend API por HTTPS (Puerto 443 - Garantizado en Render Free)
  if (resendApiKey) {
    try {
      // Si no es un dominio personalizado verificado, Resend requiere onboarding@resend.dev para entrega inmediata garantizada
      let fromEmail = 'RUFO Precise Detailing <onboarding@resend.dev>';
      if (settings.smtp_from && !settings.smtp_from.includes('@gmail.com') && !settings.smtp_from.includes('@hotmail.com') && !settings.smtp_from.includes('@yahoo.com') && !settings.smtp_from.includes('@outlook.com') && settings.smtp_from.includes('@')) {
        fromEmail = settings.smtp_from;
      }

      const replyTo = settings.contact_email || settings.admin_notification_email || 'ru88foramirez@hotmail.com';
      const recipients = Array.isArray(to) ? to : String(to).split(/[,;]/).map(s => s.trim()).filter(Boolean);

      const payload = {
        from: fromEmail,
        to: recipients,
        reply_to: replyTo,
        subject: subject,
        html: html,
      };

      if (icalContent) {
        payload.attachments = [
          {
            filename: 'cita-rufo.ics',
            content: Buffer.from(icalContent).toString('base64'),
          }
        ];
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error en Resend API');
      }

      console.log('✅ Correo enviado vía Resend API exitosamente:', data.id);
      logEmail({
        to,
        subject,
        type,
        code: appointmentCode,
        html,
        status: 'delivered',
        details: `ResendId: ${data.id}`,
      });
      return { success: true, mode: 'resend', messageId: data.id };
    } catch (err) {
      console.error('❌ Error enviando correo vía Resend API:', err.message);
      logEmail({
        to,
        subject,
        type,
        code: appointmentCode,
        html,
        status: 'failed',
        details: `Resend Error: ${err.message}`,
      });
      return { success: false, error: err.message };
    }
  }

  // 2. MÉTODO 2: SMTP Clásico (Requiere puertos 465 o 587 abiertos)
  const transporter = getTransporter();

  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL OUTBOX] Tipo: ${type.toUpperCase()}`);
  console.log(`Para: ${to}`);
  console.log(`Asunto: ${subject}`);
  console.log(`SMTP Activo: ${transporter ? 'SÍ (Enviando a Internet)' : 'NO (Modo Simulación)'}`);
  console.log(`======================================================\n`);

  if (transporter) {
    try {
      const from = settings.smtp_from || `${settings.business_name || 'RUFO Precise Detailing'} <juanbernate157@gmail.com>`;
      
      const mailOptions = {
        from,
        to,
        subject,
        html,
      };

      // Attach .ics calendar invite if provided
      if (icalContent) {
        mailOptions.icalEvent = {
          filename: 'invitacion-cita.ics',
          method: 'REQUEST',
          content: icalContent,
        };
        mailOptions.attachments = [
          {
            filename: 'cita-rufo.ics',
            content: icalContent,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Correo enviado vía SMTP exitosamente:', info.messageId);
      logEmail({
        to,
        subject,
        type,
        code: appointmentCode,
        html,
        status: 'delivered',
        details: `MessageId: ${info.messageId}`,
      });
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error('❌ Error enviando correo vía SMTP:', err.message);
      logEmail({
        to,
        subject,
        type,
        code: appointmentCode,
        html,
        status: 'failed',
        details: err.message,
      });
      return { success: false, error: err.message };
    }
  } else {
    // Simulated Mode: recorded in DB email_logs for instant live preview in Admin Panel
    logEmail({
      to,
      subject,
      type,
      code: appointmentCode,
      html,
      status: 'simulated',
      details: 'Modo simulación (Configura SMTP en Ajustes para envíos reales por Internet)',
    });
    return { success: true, mode: 'simulated' };
  }
}

// Email Templates
function getBaseTemplate(content, settings) {
  const primaryColor = settings?.primary_color || '#2563eb';
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${settings?.business_name || 'RUFO Precise Detailing'}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050711; margin: 0; padding: 20px 0; color: #1e293b; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
      .header { background: linear-gradient(135deg, #070a14 0%, #1e3a8a 50%, #06b6d4 100%); padding: 36px 24px; text-align: center; color: #ffffff; }
      .header h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
      .header p { margin: 8px 0 0; font-size: 13px; color: #93c5fd; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      .body { padding: 32px 28px; }
      .card { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 20px 0; }
      .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #cbd5e1; font-size: 14px; }
      .detail-row:last-child { border-bottom: none; }
      .detail-label { color: #64748b; font-weight: 600; }
      .detail-value { color: #0f172a; font-weight: 800; text-align: right; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
      .badge-confirmed { background: #dcfce7; color: #15803d; }
      .actions { margin: 28px 0 10px; text-align: center; }
      .btn { display: inline-block; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; margin: 6px; }
      .btn-calendar { background: #2563eb; color: #ffffff !important; box-shadow: 0 4px 15px rgba(37,99,235,0.4); }
      .btn-reschedule { background: #475569; color: #ffffff !important; }
      .btn-cancel { background: #fee2e2; color: #dc2626 !important; border: 1px solid #fca5a5; }
      .footer { background: #070a14; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; }
      .footer a { color: #38bdf8; text-decoration: none; font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${settings?.business_name || 'RUFO Precise Detailing'}</h1>
        <p>${settings?.tagline || 'Each Precise Detail Counts'}</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0; color: #ffffff; font-weight: 700;">${settings?.business_name || 'RUFO Precise Detailing'} • ${settings?.city || 'Zipaquirá, Colombia'}</p>
        <p style="margin: 0;">${settings?.address || 'Calle 5 # 10-25'}</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// 1. Email to Client on Booking Confirmation (with Calendar invite & 30m reminder)
async function sendClientBookingConfirmation(appointment, baseUrl) {
  const settings = getSettings();
  const manageUrl = `${baseUrl}/cita/${appointment.code}`;
  const priceFormatted = `${settings.currency_symbol || '$'} ${Number(appointment.service_price).toLocaleString()} ${settings.currency_code || 'COP'}`;
  
  const icalContent = createICSContent(appointment, settings);
  const googleCalendarUrl = createGoogleCalendarUrl(appointment, settings);

  const content = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 22px;">¡Hola, ${appointment.client_name}! 🎉</h2>
    <p style="color: #475569; font-size: 15px; line-height: 1.5;">
      Tu cita en <strong>${settings.business_name}</strong> ha sido <strong>confirmada exitosamente</strong>.
    </p>

    <!-- Ficha de la Cita -->
    <div class="card">
      <div class="detail-row">
        <span class="detail-label">Código de Cita:</span>
        <span class="detail-value" style="font-family: monospace; letter-spacing: 1px; color: #2563eb; font-size: 16px;">${appointment.code}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Servicio:</span>
        <span class="detail-value">${appointment.service_name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Fecha Programada:</span>
        <span class="detail-value" style="color: #2563eb;">${appointment.appointment_date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Hora:</span>
        <span class="detail-value" style="color: #2563eb;">${appointment.appointment_time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duración:</span>
        <span class="detail-value">${appointment.service_duration} minutos</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Valor del Servicio:</span>
        <span class="detail-value" style="color: #16a34a; font-size: 17px;">${priceFormatted}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Lugar:</span>
        <span class="detail-value">${settings.address}, ${settings.city}</span>
      </div>
    </div>

    <!-- CALENDAR BUTTON -->
    <div style="background-color: #eff6ff; border: 2px solid #bfdbfe; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0;">
      <h3 style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 16px;">📅 Recordatorio en tu Calendario</h3>
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #3b82f6;">
        Incluye una alarma automática <strong>30 minutos antes</strong> de tu cita.
      </p>
      <a href="${googleCalendarUrl}" target="_blank" class="btn btn-calendar" style="font-size: 15px; padding: 14px 28px;">
        📅 Guardar en Google Calendar
      </a>
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b;">
        * También adjuntamos el archivo <strong>.ICS</strong> a este correo para iPhone, Android y Outlook.
      </p>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; margin: 18px 0; font-size: 13px; color: #166534;">
      ⏰ <strong>Recordatorio por correo:</strong> Te enviaremos otro recordatorio automático por correo 30 minutos antes de comenzar tu cita.
    </div>

    <h3 style="margin-top: 25px; margin-bottom: 8px; font-size: 15px; color: #0f172a; text-align: center;">¿Deseas gestionar tu cita?</h3>
    <div class="actions">
      <a href="${manageUrl}?action=reschedule" class="btn btn-reschedule">🗓️ Aplazar / Reagendar</a>
      <a href="${manageUrl}?action=cancel" class="btn btn-cancel">❌ Cancelar Cita</a>
    </div>

    <p style="text-align: center; margin-top: 15px;">
      <a href="${manageUrl}" style="color: #2563eb; font-size: 13px; font-weight: 700;">Ver ticket completo y código QR en línea &rarr;</a>
    </p>
  `;

  const html = getBaseTemplate(content, settings);
  const subject = `✅ Cita Confirmada: ${appointment.service_name} - ${appointment.appointment_date} ${appointment.appointment_time}`;

  return await sendEmail({
    to: appointment.client_email,
    subject,
    html,
    type: 'confirmation',
    appointmentCode: appointment.code,
    icalContent,
  });
}

// 2. Email Notification to Admin on New Booking (with Calendar invite & 30m reminder)
async function sendAdminNewBookingNotification(appointment, baseUrl) {
  const settings = getSettings();
  const rawAdminEmail = settings.admin_notification_email || settings.contact_email || 'ru88foramirez@hotmail.com, juanbernate157@gmail.com';
  if (!rawAdminEmail) return;

  const adminEmails = rawAdminEmail
    .split(/[,;]/)
    .map(e => e.trim())
    .filter(Boolean);

  const priceFormatted = `${settings.currency_symbol || '$'} ${Number(appointment.service_price).toLocaleString()} ${settings.currency_code || 'COP'}`;
  const now = new Date(appointment.created_at || Date.now());
  const formattedCreationTime = now.toLocaleString('es-CO', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const icalContent = createICSContent(appointment, settings);
  const googleCalendarUrl = createGoogleCalendarUrl(appointment, settings);

  const content = `
    <div style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-weight: 800; font-size: 12px; padding: 4px 12px; border-radius: 6px; margin-bottom: 12px; text-transform: uppercase;">
      NUEVA RESERVA DE CLIENTE
    </div>
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">¡Se ha agendado una nueva cita! 📋</h2>
    <p style="color: #475569; font-size: 14px;">
      Un cliente ha agendado un servicio desde la plataforma web. Aquí tienes la auditoría completa:
    </p>

    <div class="card">
      <div style="font-weight: 800; color: #1e40af; margin-bottom: 10px; font-size: 12px; text-transform: uppercase;">
        🕒 Momento Exacto en que el Cliente Agendó (Auditoría)
      </div>
      <div class="detail-row">
        <span class="detail-label">Fecha y hora de registro:</span>
        <span class="detail-value" style="color: #1e40af;">${formattedCreationTime}</span>
      </div>

      <div style="font-weight: 800; color: #0f172a; margin: 15px 0 10px; font-size: 12px; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        👤 Datos del Cliente
      </div>
      <div class="detail-row">
        <span class="detail-label">Nombre del Cliente:</span>
        <span class="detail-value">${appointment.client_name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Teléfono / WhatsApp:</span>
        <span class="detail-value"><a href="https://wa.me/${appointment.client_phone.replace(/[^0-9]/g, '')}" target="_blank" style="color: #16a34a; text-decoration: none;">📞 ${appointment.client_phone}</a></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Correo Electrónico:</span>
        <span class="detail-value">${appointment.client_email}</span>
      </div>
      ${appointment.client_notes ? `
      <div class="detail-row">
        <span class="detail-label">Notas del Cliente:</span>
        <span class="detail-value" style="font-style: italic;">"${appointment.client_notes}"</span>
      </div>` : ''}

      <div style="font-weight: 800; color: #0f172a; margin: 15px 0 10px; font-size: 12px; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        ✂️ Servicio & Horario Programado
      </div>
      <div class="detail-row">
        <span class="detail-label">Código:</span>
        <span class="detail-value" style="font-family: monospace;">${appointment.code}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Servicio:</span>
        <span class="detail-value">${appointment.service_name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Fecha de la Cita:</span>
        <span class="detail-value" style="color: #2563eb;">${appointment.appointment_date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Hora:</span>
        <span class="detail-value" style="color: #2563eb;">${appointment.appointment_time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duración:</span>
        <span class="detail-value">${appointment.service_duration} min</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Valor a Cobrar:</span>
        <span class="detail-value" style="color: #16a34a; font-size: 16px;">${priceFormatted}</span>
      </div>
    </div>

    <!-- CALENDAR FOR ADMIN -->
    <div style="background-color: #f8fafc; border: 2px dashed #93c5fd; border-radius: 14px; padding: 16px; text-align: center; margin: 20px 0;">
      <h3 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 15px;">📅 Guarda esta cita en tu Google Calendar de Administrador</h3>
      <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
        Con alarma automática 30 minutos antes para prepararte.
      </p>
      <a href="${googleCalendarUrl}" target="_blank" class="btn btn-calendar">
        📅 Añadir a mi Google Calendar
      </a>
    </div>

    <div class="actions">
      <a href="${baseUrl}/#admin" class="btn btn-reschedule" style="background-color: #0f172a;">Ir al Panel de Administración</a>
    </div>
  `;

  const html = getBaseTemplate(content, settings);
  const subject = `🔔 Nueva Cita Agendada: ${appointment.client_name} - ${appointment.appointment_date} a las ${appointment.appointment_time}`;

  // Enviar a todos los correos administradores configurados
  let lastResult = { success: false };
  for (const targetEmail of adminEmails) {
    lastResult = await sendEmail({
      to: targetEmail,
      subject,
      html,
      type: 'admin_notification',
      appointmentCode: appointment.code,
      icalContent,
    });
  }

  return lastResult;
}

// 3. Email Reminder 30 Minutes Before Appointment
async function sendClient30MinuteReminder(appointment, baseUrl) {
  const settings = getSettings();
  const manageUrl = `${baseUrl}/cita/${appointment.code}`;
  const priceFormatted = `${settings.currency_symbol || '$'} ${Number(appointment.service_price).toLocaleString()} ${settings.currency_code || 'COP'}`;

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge" style="background-color: #fef3c7; color: #b45309; font-size: 13px; padding: 6px 16px;">
        ⏰ RECORDATORIO: TU CITA ES EN 30 MINUTOS
      </span>
    </div>
    <h2 style="margin-top: 0; color: #0f172a; font-size: 22px; text-align: center;">¡Ya casi se acerca tu hora, ${appointment.client_name}! ✨</h2>
    <p style="color: #475569; font-size: 15px; text-align: center; line-height: 1.5;">
      Te recordamos que tu cita para <strong>${appointment.service_name}</strong> en <strong>${settings.business_name}</strong> comenzará en <strong>30 minutos</strong>.
    </p>

    <div class="card" style="border-left: 5px solid #f59e0b;">
      <div class="detail-row">
        <span class="detail-label">Hora de inicio:</span>
        <span class="detail-value" style="font-size: 18px; color: #d97706;">${appointment.appointment_time} (Hoy)</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Servicio:</span>
        <span class="detail-value">${appointment.service_name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Dirección:</span>
        <span class="detail-value">${settings.address}, ${settings.city}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Valor a cancelar:</span>
        <span class="detail-value" style="color: #16a34a;">${priceFormatted}</span>
      </div>
    </div>

    <p style="font-size: 14px; color: #64748b; text-align: center;">
      Por favor procura llegar unos minutos antes para brindarte la mejor experiencia.
    </p>

    <div class="actions">
      <a href="${manageUrl}" class="btn btn-calendar">Ver Detalles de mi Cita</a>
      <a href="https://wa.me/${(settings.whatsapp || '').replace(/[^0-9]/g, '')}?text=Hola,%20voy%20en%20camino%20a%20mi%20cita%20${appointment.code}" class="btn btn-reschedule" style="background-color: #16a34a;">Avisar por WhatsApp</a>
    </div>
  `;

  const html = getBaseTemplate(content, settings);
  const subject = `⏰ Recordatorio (en 30 min): Tu cita para ${appointment.service_name} a las ${appointment.appointment_time}`;

  return await sendEmail({
    to: appointment.client_email,
    subject,
    html,
    type: 'reminder_30m',
    appointmentCode: appointment.code,
  });
}

// 4. Email on Reschedule (Aplazar)
async function sendRescheduleNotification(appointment, oldDate, oldTime, baseUrl) {
  const settings = getSettings();
  const manageUrl = `${baseUrl}/cita/${appointment.code}`;
  const icalContent = createICSContent(appointment, settings);
  const googleCalendarUrl = createGoogleCalendarUrl(appointment, settings);

  const clientContent = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Tu cita ha sido reagendada 🗓️</h2>
    <p style="color: #475569; font-size: 15px;">
      Hola, <strong>${appointment.client_name}</strong>. Hemos actualizado el horario de tu cita para <strong>${appointment.service_name}</strong>:
    </p>

    <div class="card">
      <div class="detail-row">
        <span class="detail-label">Horario anterior:</span>
        <span class="detail-value" style="text-decoration: line-through; color: #94a3b8;">${oldDate} a las ${oldTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Nuevo Horario Confirmado:</span>
        <span class="detail-value" style="color: #2563eb; font-size: 16px;">${appointment.appointment_date} a las ${appointment.appointment_time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Código de Cita:</span>
        <span class="detail-value" style="font-family: monospace;">${appointment.code}</span>
      </div>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${googleCalendarUrl}" target="_blank" class="btn btn-calendar">
        📅 Actualizar en Google Calendar
      </a>
    </div>

    <div class="actions">
      <a href="${manageUrl}" class="btn btn-reschedule">Ver Mi Cita</a>
      <a href="${manageUrl}?action=cancel" class="btn btn-cancel">Cancelar Cita</a>
    </div>
  `;

  const html = getBaseTemplate(clientContent, settings);
  const subject = `🗓️ Cita Reagendada: ${appointment.service_name} para el ${appointment.appointment_date} a las ${appointment.appointment_time}`;

  // Notify client
  await sendEmail({
    to: appointment.client_email,
    subject,
    html,
    type: 'rescheduled',
    appointmentCode: appointment.code,
    icalContent,
  });

  // Notify admin
  const adminEmail = settings.admin_notification_email || settings.contact_email;
  if (adminEmail) {
    const adminContent = `
      <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Cita Reagendada 🔄</h2>
      <p style="color: #475569; font-size: 15px;">
        El cliente <strong>${appointment.client_name}</strong> ha aplazado su cita:
      </p>
      <div class="card">
        <div class="detail-row">
          <span class="detail-label">Código:</span>
          <span class="detail-value">${appointment.code}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Horario anterior:</span>
          <span class="detail-value" style="text-decoration: line-through; color: #94a3b8;">${oldDate} - ${oldTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">NUEVO Horario:</span>
          <span class="detail-value" style="color: #2563eb; font-weight: 800;">${appointment.appointment_date} - ${appointment.appointment_time}</span>
        </div>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${googleCalendarUrl}" target="_blank" class="btn btn-calendar">
          📅 Actualizar en mi Calendar
        </a>
      </div>
    `;
    await sendEmail({
      to: adminEmail,
      subject: `🔄 Cita Reagendada: ${appointment.client_name} ahora el ${appointment.appointment_date} ${appointment.appointment_time}`,
      html: getBaseTemplate(adminContent, settings),
      type: 'admin_notification',
      appointmentCode: appointment.code,
      icalContent,
    });
  }
}

// 5. Email on Cancellation
async function sendCancellationNotification(appointment, reason, baseUrl) {
  const settings = getSettings();

  const clientContent = `
    <h2 style="margin-top: 0; color: #dc2626; font-size: 20px;">Cita Cancelada ❌</h2>
    <p style="color: #475569; font-size: 15px;">
      Hola, <strong>${appointment.client_name}</strong>. Tu cita para <strong>${appointment.service_name}</strong> programada para el <strong>${appointment.appointment_date} a las ${appointment.appointment_time}</strong> ha sido cancelada.
    </p>

    ${reason ? `<div class="card" style="border-left: 4px solid #ef4444;"><span class="detail-label">Motivo de cancelación:</span><p style="margin: 6px 0 0; color: #1e293b;">${reason}</p></div>` : ''}

    <p style="color: #64748b; font-size: 14px;">
      El cupo ha quedado libre. Si deseas volver a agendar en cualquier momento, ¡será un gusto atenderte!
    </p>

    <div class="actions">
      <a href="${baseUrl}/citas" class="btn btn-calendar">Agendar una Nueva Cita</a>
    </div>
  `;

  const html = getBaseTemplate(clientContent, settings);
  const subject = `❌ Cita Cancelada: ${appointment.service_name} (${appointment.appointment_date})`;

  // Notify client
  await sendEmail({
    to: appointment.client_email,
    subject,
    html,
    type: 'cancelled',
    appointmentCode: appointment.code,
  });

  // Notify admin
  const adminEmail = settings.admin_notification_email || settings.contact_email;
  if (adminEmail) {
    const adminContent = `
      <h2 style="margin-top: 0; color: #dc2626; font-size: 20px;">Aviso: Cita Cancelada</h2>
      <p style="color: #475569; font-size: 15px;">
        La cita del cliente <strong>${appointment.client_name}</strong> ha sido cancelada y el cupo quedó libre:
      </p>
      <div class="card">
        <div class="detail-row">
          <span class="detail-label">Código:</span>
          <span class="detail-value">${appointment.code}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Servicio:</span>
          <span class="detail-value">${appointment.service_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fecha y Hora que estaban reservadas:</span>
          <span class="detail-value">${appointment.appointment_date} a las ${appointment.appointment_time}</span>
        </div>
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Motivo:</span>
          <span class="detail-value" style="color: #dc2626;">${reason}</span>
        </div>` : ''}
      </div>
      <div class="actions">
        <a href="${baseUrl}/#admin" class="btn btn-calendar">Ver Panel Admin</a>
      </div>
    `;
    await sendEmail({
      to: adminEmail,
      subject: `❌ Cita Cancelada: ${appointment.client_name} (${appointment.appointment_date} ${appointment.appointment_time})`,
      html: getBaseTemplate(adminContent, settings),
      type: 'admin_notification',
      appointmentCode: appointment.code,
    });
  }
}

module.exports = {
  sendEmail,
  sendClientBookingConfirmation,
  sendAdminNewBookingNotification,
  sendClient30MinuteReminder,
  sendRescheduleNotification,
  sendCancellationNotification,
  createICSContent,
  createGoogleCalendarUrl,
};
