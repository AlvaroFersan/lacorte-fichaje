'use strict';

const express = require('express');
const db = require('../db');
const { exigirSesion, exigirAdmin } = require('../lib/permisos');

const router = express.Router();
router.use(exigirSesion);

function conEquipo(p) {
  const equipo = db.get().prepare('SELECT usuario_id FROM proyecto_equipo WHERE proyecto_id = ?').all(p.id)
    .map(r => r.usuario_id);
  return { ...p, equipo };
}

router.get('/', (req, res) => {
  const filas = db.get().prepare('SELECT * FROM proyectos ORDER BY id').all();
  res.json({ proyectos: filas.map(conEquipo) });
});

router.get('/:id', (req, res) => {
  const p = db.get().prepare('SELECT * FROM proyectos WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe ese proyecto.' });
  const carpetas = db.get().prepare('SELECT * FROM carpetas WHERE proyecto_id = ? ORDER BY id').all(p.id);
  res.json({ proyecto: conEquipo(p), carpetas });
});

router.post('/', exigirAdmin, (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre del proyecto.' });
  const r = db.get().prepare(`
    INSERT INTO proyectos (nombre, cliente, formato, estado, horas_presupuestadas, fecha_entrega, minutos_programa, versiones, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nombre,
    String(req.body.cliente || '').trim(),
    String(req.body.formato || 'Interno'),
    ['curso', 'entregado', 'pausa'].includes(req.body.estado) ? req.body.estado : 'curso',
    Number(req.body.horas_presupuestadas) || 0,
    req.body.fecha_entrega || null,
    Number(req.body.minutos_programa) || 0,
    Number(req.body.versiones) || 0,
    Number(req.body.color) || 0
  );
  const equipo = Array.isArray(req.body.equipo) ? req.body.equipo : [];
  const ins = db.get().prepare('INSERT OR IGNORE INTO proyecto_equipo (proyecto_id, usuario_id) VALUES (?, ?)');
  for (const uid of equipo) ins.run(r.lastInsertRowid, Number(uid));
  res.status(201).json({ proyecto: conEquipo(db.get().prepare('SELECT * FROM proyectos WHERE id = ?').get(r.lastInsertRowid)) });
});

router.get('/:id/carpetas', (req, res) => {
  const filas = db.get().prepare('SELECT * FROM carpetas WHERE proyecto_id = ? ORDER BY id').all(Number(req.params.id));
  res.json({ carpetas: filas });
});

module.exports = router;
