const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { backupToCloud } = require('../cloudSync');

function parsePrice(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }
  const cleaned = String(val).trim().replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

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

// GET all services
router.get('/', (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    let query = 'SELECT * FROM services';
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY category ASC, id DESC';
    const services = db.prepare(query).all().map(s => ({
      ...s,
      image_url: formatImageUrl(req, s.image_url),
    }));
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM services WHERE is_active = 1').all();
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single service
router.get('/:id', (req, res) => {
  try {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({
      ...service,
      image_url: formatImageUrl(req, service.image_url),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create service
router.post('/', (req, res) => {
  try {
    const { name, category, description, price, duration_minutes, image_url, badge } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    const finalImg = formatImageUrl(req, image_url);
    const stmt = db.prepare(`
      INSERT INTO services (name, category, description, price, duration_minutes, image_url, badge, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      name.trim(),
      (category || 'General').trim(),
      (description || '').trim(),
      parsePrice(price),
      Number(duration_minutes) || 30,
      finalImg,
      badge || ''
    );

    const newService = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
    backupToCloud().catch(() => {});
    res.status(201).json({
      ...newService,
      image_url: formatImageUrl(req, newService.image_url),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT bulk update services (for Control Total save)
router.put('/bulk/update', (req, res) => {
  try {
    const { services } = req.body;
    if (!Array.isArray(services)) {
      return res.status(400).json({ error: 'Se requiere un arreglo de servicios' });
    }

    const updateStmt = db.prepare(`
      UPDATE services
      SET name = ?, category = ?, description = ?, price = ?, duration_minutes = ?, badge = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const item of services) {
      if (!item || !item.id) continue;
      const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(item.id);
      if (!existing) continue;

      updateStmt.run(
        item.name !== undefined ? String(item.name).trim() : existing.name,
        item.category !== undefined ? String(item.category).trim() : existing.category,
        item.description !== undefined ? String(item.description).trim() : existing.description,
        item.price !== undefined ? parsePrice(item.price) : existing.price,
        item.duration_minutes !== undefined ? (Number(item.duration_minutes) || existing.duration_minutes) : existing.duration_minutes,
        item.badge !== undefined ? item.badge : existing.badge,
        item.is_active !== undefined ? Number(item.is_active) : existing.is_active,
        item.id
      );
    }

    const allServices = db.prepare('SELECT * FROM services ORDER BY category ASC, id DESC').all().map(s => ({
      ...s,
      image_url: formatImageUrl(req, s.image_url),
    }));

    backupToCloud().catch(() => {});
    res.json({ success: true, services: allServices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update service
router.put('/:id', (req, res) => {
  try {
    const { name, category, description, price, duration_minutes, image_url, badge, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Servicio no encontrado' });

    const finalImg = image_url !== undefined ? formatImageUrl(req, image_url) : existing.image_url;

    db.prepare(`
      UPDATE services 
      SET name = ?, category = ?, description = ?, price = ?, duration_minutes = ?, image_url = ?, badge = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      category !== undefined ? category.trim() : existing.category,
      description !== undefined ? description.trim() : existing.description,
      price !== undefined ? parsePrice(price) : existing.price,
      duration_minutes !== undefined ? Number(duration_minutes) : existing.duration_minutes,
      finalImg,
      badge !== undefined ? badge : existing.badge,
      is_active !== undefined ? Number(is_active) : existing.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    backupToCloud().catch(() => {});
    res.json({
      ...updated,
      image_url: formatImageUrl(req, updated.image_url),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE service
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Servicio no encontrado' });

    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    backupToCloud().catch(() => {});
    res.json({ message: 'Servicio eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
