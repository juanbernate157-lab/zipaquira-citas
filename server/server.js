const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dns = require('node:dns');

// Enforce IPv4 resolution first on cloud containers (prevents Render IPv6 SMTP timeout)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const { startScheduler } = require('./schedulerService');

const servicesRouter = require('./routes/services');
const appointmentsRouter = require('./routes/appointments');
const settingsRouter = require('./routes/settings');
const emailsRouter = require('./routes/emails');
const schedulesRouter = require('./routes/schedules');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure all API responses are never cached by browser so changes in admin panel show up instantly
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// API Routes
app.use('/api/services', servicesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/schedules', schedulesRouter);

// Network IP & Global Internet URL helper for mobile scanning
function getGlobalPublicUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  try {
    const tunnelFile = path.join(__dirname, '..', 'data', 'tunnel-url.txt');
    if (fs.existsSync(tunnelFile)) {
      const u = fs.readFileSync(tunnelFile, 'utf8').trim();
      if (u && u.startsWith('http')) return u;
    }
  } catch (e) {}
  return 'https://part-sen-mathematical-eagle.trycloudflare.com';
}

app.get('/api/network-ip', (req, res) => {
  const nets = os.networkInterfaces();
  let lanIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Pick Wi-Fi or Ethernet IPv4
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        lanIp = net.address;
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wireless')) {
          break;
        }
      }
    }
  }
  const publicUrl = getGlobalPublicUrl();
  res.json({
    ip: lanIp,
    port: PORT,
    globalUrl: `${publicUrl}/citas`,
    mobileUrl: `${publicUrl}/citas`,
    localUrl: `http://localhost:${PORT}/citas`,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', business: 'RUFO Precise Detailing', time: new Date().toISOString() });
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
      <h2 style="color: #3b82f6;">RUFO Precise Detailing - Servidor Activo</h2>
      <p>Servidor listo en el puerto ${PORT}. Accede a <a href="/citas" style="color: #60a5fa;">localhost:${PORT}/citas</a></p>
    </div>
  `);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🏎️ RUFO PRECISE DETAILING - SERVIDOR ACTIVO`);
  console.log(`🌐 Acceso Principal: http://localhost:${PORT}/citas`);
  console.log(`🔐 Acceso Admin:     http://localhost:${PORT}/#admin`);
  console.log(`📡 API Endpoints:    http://localhost:${PORT}/api`);
  console.log(`====================================================`);

  // Start background scheduler for 30-min reminders
  let lanIp = 'localhost';
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || process.env.BASE_URL || `http://${lanIp}:${PORT}`;
  startScheduler(baseUrl);
});

module.exports = { app, server };
