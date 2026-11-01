const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET all services
router.get('/', (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    let query = 'SELECT * FROM services';
    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY category ASC, id DESC';
    const services = db.prepare(query).all();
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
    res.json(service);
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

    const defaultImg = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80';
    const stmt = db.prepare(`
      INSERT INTO services (name, category, description, price, duration_minutes, image_url, badge, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      name.trim(),
      (category || 'General').trim(),
      (description || '').trim(),
      Number(price) || 0,
      Number(duration_minutes) || 30,
      image_url || defaultImg,
      badge || ''
    );

    const newService = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newService);
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

    db.prepare(`
      UPDATE services 
      SET name = ?, category = ?, description = ?, price = ?, duration_minutes = ?, image_url = ?, badge = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      category !== undefined ? category.trim() : existing.category,
      description !== undefined ? description.trim() : existing.description,
      price !== undefined ? Number(price) : existing.price,
      duration_minutes !== undefined ? Number(duration_minutes) : existing.duration_minutes,
      image_url !== undefined ? image_url : existing.image_url,
      badge !== undefined ? badge : existing.badge,
      is_active !== undefined ? Number(is_active) : existing.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    res.json(updated);
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
    res.json({ message: 'Servicio eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
