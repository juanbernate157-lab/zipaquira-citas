const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'agendamiento.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  UPDATE settings 
  SET admin_notification_email = 'juanbernate157@gmail.com',
      contact_email = 'juanbernate157@gmail.com',
      business_name = 'Zipaquirá Enterprise',
      hero_title = 'Reserva tu cita',
      primary_color = '#2563eb',
      accent_color = '#06b6d4'
  WHERE id = 1;
`);

console.log('✅ Settings updated with real admin email juanbernate157@gmail.com');
const row = db.prepare('SELECT id, business_name, admin_notification_email, contact_email, smtp_enabled FROM settings WHERE id = 1').get();
console.log('Current settings:', row);
