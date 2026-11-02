const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'agendamiento.sqlite');

// Ensure data folder exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      business_name TEXT NOT NULL DEFAULT 'RUFO Precise Detailing',
      hero_title TEXT NOT NULL DEFAULT 'Reserva tu cita',
      hero_subtitle TEXT NOT NULL DEFAULT 'Cuidado automotriz de alta gama, detailing profesional y lavado premium.',
      tagline TEXT NOT NULL DEFAULT 'Each Precise Detail Counts',
      logo_url TEXT DEFAULT '/rufo-logo.png',
      banner_url TEXT DEFAULT '',
      primary_color TEXT DEFAULT '#2563eb',
      accent_color TEXT DEFAULT '#3b82f6',
      currency_symbol TEXT DEFAULT '$',
      currency_code TEXT DEFAULT 'COP',
      phone TEXT DEFAULT '+57 312 345 6789',
      whatsapp TEXT DEFAULT '+573123456789',
      contact_email TEXT DEFAULT 'contacto@rufodetailing.com',
      admin_notification_email TEXT DEFAULT 'admin@rufodetailing.com',
      address TEXT DEFAULT 'Calle 5 # 10-25, Centro Histórico',
      city TEXT DEFAULT 'Zipaquirá, Colombia',
      instagram TEXT DEFAULT '@glowandstyle',
      facebook TEXT DEFAULT 'glowandstylestudio',
      opening_time TEXT DEFAULT '08:00',
      closing_time TEXT DEFAULT '19:00',
      slot_interval_minutes INTEGER DEFAULT 30,
      working_days TEXT DEFAULT '["1","2","3","4","5","6"]',
      admin_password TEXT DEFAULT 'admin123',
      smtp_host TEXT DEFAULT '',
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT DEFAULT '',
      smtp_pass TEXT DEFAULT '',
      smtp_from TEXT DEFAULT 'Glow & Style Citas <no-reply@glowandstyle.com>',
      smtp_secure INTEGER DEFAULT 0,
      smtp_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      image_url TEXT,
      badge TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_notes TEXT,
      service_id INTEGER,
      service_name TEXT NOT NULL,
      service_price REAL NOT NULL,
      service_duration INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      cancellation_reason TEXT,
      reminder_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      email_type TEXT NOT NULL,
      appointment_code TEXT,
      content_html TEXT,
      status TEXT DEFAULT 'sent',
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_slot TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'morning',
      period_label TEXT NOT NULL DEFAULT 'Mañana',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_date TEXT NOT NULL,
      time_slot TEXT DEFAULT NULL,
      reason TEXT DEFAULT 'Cancelado por el administrador',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec(`ALTER TABLE settings ADD COLUMN business_hours_text TEXT DEFAULT '8:00 AM - 9:00 AM • 2:00 PM - 3:00 PM';`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE settings ADD COLUMN resend_api_key TEXT DEFAULT '';`);
  } catch (e) {
    // Column already exists
  }

  // Ensure all image and logo URLs are complete absolute HTTPS URLs
  try {
    db.exec(`
      UPDATE services 
      SET image_url = 'https://zipaquira-citas.onrender.com/rufo-logo.png' 
      WHERE image_url LIKE '/%' OR image_url = '' OR image_url IS NULL;

      UPDATE settings 
      SET logo_url = 'https://zipaquira-citas.onrender.com/rufo-logo.png',
          admin_notification_email = 'ru88foramirez@hotmail.com, juanbernate157@gmail.com',
          contact_email = 'ru88foramirez@hotmail.com'
      WHERE id = 1;
    `);
  } catch (e) {
    // ignore
  }

  // Seed default schedule slots if empty
  const slotCount = db.prepare('SELECT COUNT(*) as count FROM schedule_slots').get();
  if (!slotCount || slotCount.count === 0) {
    const defaultSlots = [
      { time_slot: '08:00', label: '08:00 AM', period: 'morning', period_label: 'Mañana', is_active: 1 },
      { time_slot: '09:00', label: '09:00 AM', period: 'morning', period_label: 'Mañana', is_active: 1 },
      { time_slot: '14:00', label: '02:00 PM', period: 'afternoon', period_label: 'Tarde', is_active: 1 },
      { time_slot: '15:00', label: '03:00 PM', period: 'afternoon', period_label: 'Tarde', is_active: 1 },
    ];
    const insertSlot = db.prepare(`
      INSERT INTO schedule_slots (time_slot, label, period, period_label, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const s of defaultSlots) {
      insertSlot.run(s.time_slot, s.label, s.period, s.period_label, s.is_active);
    }
  }

  // Seed default settings row if empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (!countRow || countRow.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, business_name, hero_title, hero_subtitle, tagline, logo_url, primary_color, accent_color, admin_notification_email, address, city)
      VALUES (1, 'RUFO Precise Detailing', 'Reserva tu cita', 'Cuidado automotriz de alta gama, detailing profesional y lavado premium.', 'Each Precise Detail Counts', '/rufo-logo.png', '#2563eb', '#3b82f6', 'juanbernate157@gmail.com', 'Calle 5 # 10-25', 'Zipaquirá, Colombia')
    `).run();
  } else {
    // Update existing row to user requested branding
    db.prepare(`
      UPDATE settings 
      SET business_name = 'RUFO Precise Detailing',
          hero_title = 'Reserva tu cita',
          hero_subtitle = 'Cuidado automotriz de alta gama, detailing profesional y lavado premium.',
          tagline = 'Each Precise Detail Counts',
          logo_url = '/rufo-logo.png',
          primary_color = '#2563eb',
          accent_color = '#3b82f6',
          city = 'Zipaquirá, Colombia'
      WHERE id = 1
    `).run();
  }

  // Seed initial services if empty
  const sRow = db.prepare('SELECT COUNT(*) as count FROM services').get();
  if (!sRow || sRow.count === 0) {
    const seedServices = [
      {
        name: 'Corte de Cabello Clásico & Styling',
        category: 'Barbería & Peluquería',
        description: 'Corte personalizado con tijera y máquina, lavado con shampoo premium, peinado y fijación con productos de alta gama.',
        price: 35000,
        duration: 45,
        badge: 'Más Popular',
        image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80'
      },
      {
        name: 'Perfilado y Ritual de Barba con Toalla Caliente',
        category: 'Barbería & Peluquería',
        description: 'Afeitado tradicional con navaja, toalla caliente al vapor, aceites esenciales hidratantes y bálsamo revitalizante.',
        price: 25000,
        duration: 30,
        badge: 'Recomendado',
        image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&auto=format&fit=crop&q=80'
      },
      {
        name: 'Combo Fresha: Corte + Barba + Mascarilla Black',
        category: 'Barbería & Peluquería',
        description: 'Experiencia completa que incluye corte de diseño, perfilado de barba al vapor, exfoliación facial y mascarilla de carbón activado.',
        price: 55000,
        duration: 60,
        badge: 'Top Ventas',
        image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop&q=80'
      },
      {
        name: 'Limpieza Facial Profunda con Hidratación Ultrasónica',
        category: 'Estética & Spa',
        description: 'Desincrustación de impurezas, peeling ultrasónico, vapor de ozono, alta frecuencia bactericida y velo de colágeno.',
        price: 75000,
        duration: 60,
        badge: 'Relajante',
        image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80'
      },
      {
        name: 'Manicure Ruso & Esmaltado Semipermanente',
        category: 'Uñas & Manos',
        description: 'Técnica de cutícula limpia rusa combinada con esmaltado semipermanente de máxima duración (hasta 21 días) y diseño minimalista.',
        price: 45000,
        duration: 50,
        badge: 'Tendencia',
        image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop&q=80'
      },
      {
        name: 'Masaje Descontracturante & Terapéutico',
        category: 'Estética & Spa',
        description: 'Masaje de espalda, cuello y hombros enfocado en liberar tensiones musculares acumuladas, con aceites aromáticos y piedras calientes.',
        price: 65000,
        duration: 45,
        badge: 'Bienestar',
        image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80'
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO services (name, category, description, price, duration_minutes, badge, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of seedServices) {
      insertStmt.run(s.name, s.category, s.description, s.price, s.duration, s.badge, s.image);
    }
  }
}

initDb();

module.exports = {
  db,
  getSettings: () => db.prepare('SELECT * FROM settings WHERE id = 1').get(),
  updateSettings: (fields) => {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), 1];
    db.prepare(`UPDATE settings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  }
};
