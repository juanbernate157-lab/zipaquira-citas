const { getSettings } = require('./db');

// Format clean, emoji-safe text for WhatsApp notification
function formatWhatsAppBookingMessage(appointment, settings, baseUrl) {
  const priceFormatted = `${settings?.currency_symbol || '$'} ${Number(appointment.service_price).toLocaleString()} ${settings?.currency_code || 'COP'}`;
  const address = `${settings?.address || 'Calle 5 # 10-25'}, ${settings?.city || 'Zipaquira'}`;

  return [
    `*NUEVA CITA AGENDADA EN RUFO PRECISE DETAILING*`,
    ``,
    `* Codigo de Cita: ${appointment.code}`,
    `* Cliente: ${appointment.client_name}`,
    `* Telefono Cliente: ${appointment.client_phone}`,
    `* Servicio: ${appointment.service_name}`,
    `* Fecha: ${appointment.appointment_date}`,
    `* Hora: ${appointment.appointment_time} (${appointment.service_duration} min)`,
    `* Valor a Cobrar: ${priceFormatted}`,
    `* Lugar: ${address}`,
    appointment.client_notes ? `* Notas: "${appointment.client_notes}"` : null,
    ``,
    `👉 Ver en el Sistema: ${baseUrl}/cita/${appointment.code}`
  ].filter(Boolean).join('\n');
}

// Send automated WhatsApp message via CallMeBot API directly to administrator's phone (100% cloud delivery)
async function sendAdminWhatsAppNotification(appointment, baseUrl) {
  const settings = getSettings();
  const apiKey = (settings.callmebot_api_key || process.env.CALLMEBOT_API_KEY || '').trim();
  const rawPhone = (settings.callmebot_phone || settings.whatsapp || settings.phone || '+573006042818').trim();
  const digits = rawPhone.replace(/[^0-9]/g, '');

  if (!apiKey) {
    console.log('ℹ️ [WhatsApp Auto] CallMeBot API Key no configurada aún. Configúrala en Ajustes para envíos 100% automáticos sin intervención del cliente.');
    return { success: false, reason: 'no_api_key' };
  }

  // CallMeBot format: +[country_code][number] (e.g. +573006042818)
  const phone = `+${digits}`;
  const message = formatWhatsAppBookingMessage(appointment, settings, baseUrl);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;

  console.log(`\n======================================================`);
  console.log(`📲 [WHATSAPP OUTBOX] Enviando WhatsApp Automático al Administrador`);
  console.log(`Para: ${phone}`);
  console.log(`Cita: ${appointment.code} - ${appointment.client_name}`);
  console.log(`======================================================\n`);

  try {
    const res = await fetch(url);
    const respText = await res.text();
    if (res.ok && (respText.includes('success') || respText.includes('Message queued') || respText.includes('200') || !respText.includes('ERROR'))) {
      console.log('✅ [WhatsApp Auto] Mensaje entregado con éxito a CallMeBot:', respText.slice(0, 80));
      return { success: true, response: respText };
    } else {
      console.warn('⚠️ [WhatsApp Auto] Respuesta de CallMeBot:', respText);
      return { success: false, response: respText };
    }
  } catch (err) {
    console.error('❌ [WhatsApp Auto] Error conectando con CallMeBot:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  formatWhatsAppBookingMessage,
  sendAdminWhatsAppNotification,
};
