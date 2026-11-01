const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { startScheduler } = require('./schedulerService');

const servicesRouter = require('./routes/services');
const appointmentsRouter = require('./routes/appointments');
const settingsRouter = require('./routes/settings');
const emailsRouter = require('./routes/emails');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/services', servicesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/emails', emailsRouter);

// Network IP helper for mobile scanning
app.get('/api/network-ip', (req, res) => {
  const nets = os.networkInterfaces();
  let lanIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }
  res.json({
    ip: lanIp,
    port: PORT,
    mobileUrl: `http://${lanIp}:${PORT}/citas`,
    localUrl: `http://localhost:${PORT}/citas`,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', business: 'Zipaquirá Enterprise', time: new Date().toISOString() });
});

// Serve frontend build if available (production mode)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// SPA fallback for all frontend routes: /, /citas, /admin, /cita/:code
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #05050a; color: #fff;">
      <h2 style="color: #3b82f6;">Zipaquirá Enterprise - Servidor Activo</h2>
      <p>Servidor listo en el puerto ${PORT}. Accede a <a href="/citas" style="color: #60a5fa;">localhost:${PORT}/citas</a></p>
    </div>
  `);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🏎️ ZIPAQUIRÁ ENTERPRISE - SERVIDOR ACTIVO`);
  console.log(`🌐 Acceso Principal: http://localhost:${PORT}/citas`);
  console.log(`🔐 Acceso Admin:     http://localhost:${PORT}/#admin`);
  console.log(`📡 API Endpoints:    http://localhost:${PORT}/api`);
  console.log(`====================================================`);

  // Start background scheduler for 30-min reminders
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  startScheduler(baseUrl);
});

module.exports = { app, server };
