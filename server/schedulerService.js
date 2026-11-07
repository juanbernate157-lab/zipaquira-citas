const { db } = require('./db');
const { sendClient30MinuteReminder } = require('./emailService');

let schedulerInterval = null;

function checkUpcomingAppointments(baseUrl) {
  try {
    const now = new Date();
    // Query confirmed appointments for today that haven't received reminder
    const todayStr = now.toISOString().slice(0, 10);

    const appointments = db.prepare(`
      SELECT * FROM appointments 
      WHERE appointment_date = ? 
        AND status = 'confirmed' 
        AND reminder_sent = 0
    `).all(todayStr);

    for (const app of appointments) {
      // Parse appointment datetime
      const [year, month, day] = app.appointment_date.split('-').map(Number);
      const [hour, minute] = app.appointment_time.split(':').map(Number);
      
      const appDateTime = new Date(year, month - 1, day, hour, minute);
      const diffMs = appDateTime - now;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      // If appointment is within 30-35 minutes from now (or within 30 minutes and not passed yet)
      if (diffMinutes <= 35 && diffMinutes >= 0) {
        console.log(`⏰ [CRON RECORDATORIO] Cita ${app.code} para ${app.client_name} es en ${diffMinutes} minutos. Enviando recordatorio...`);
        
        // Mark as sent first to prevent race condition
        db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(app.id);

        sendClient30MinuteReminder(app, baseUrl)
          .then(() => {
            console.log(`✅ [CRON RECORDATORIO] Recordatorio enviado para cita ${app.code}`);
          })
          .catch((err) => {
            console.error(`❌ [CRON RECORDATORIO] Error enviando recordatorio para ${app.code}:`, err);
          });
      }
    }
  } catch (error) {
    console.error('Error in appointment reminder scheduler:', error);
  }
}

function startScheduler(baseUrl) {
  if (schedulerInterval) clearInterval(schedulerInterval);
  console.log('⏰ Sistema de recordatorios automáticos (30 min antes) iniciado.');
  
  // Check immediately
  checkUpcomingAppointments(baseUrl);
  
  // Check every 60 seconds
  schedulerInterval = setInterval(() => {
    checkUpcomingAppointments(baseUrl);
    // Keep-Alive ping to prevent Render free tier spin-down
    fetch('https://zipaquira-citas.onrender.com/api/health').catch(() => {});
  }, 60 * 1000);
}

module.exports = {
  startScheduler,
  checkUpcomingAppointments,
};
