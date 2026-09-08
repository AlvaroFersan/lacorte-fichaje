'use strict';
/* fichaje: registros de horas. No sabe de carpetas ni estados de escena. */

const express = require('express');
const db = require('../db');
const { exigirSesion, puedeVerHorasDe, puedeVerProyecto, idsProyectosVisibles } = require('../lib/permisos');

const router = express.Router();
router.use(exigirSesion);

const CATS = new Set(['gestion', 'asis', 'montaje']);

router.get('/', (req, res) => {
  const desde = Number(req.query.desde) || 0;
  const hasta = Number(req.query.hasta) || Date.now() + 86400000;
  const quien = req.query.usuario_id ? Number(req.query.usuario_id) : null;
  const proyecto = req.query.proyecto_id ? Number(req.query.proyecto_id) : null;

  if (quien && !puedeVerHorasDe(req.usuario, quien)) {
    return res.status(403).json({ error: 'Solo puedes ver tus propias horas.' });
  }

  const visibles = idsProyectosVisibles(req.usuario);
  if (!visibles.length) return res.json({ entradas: [] });
  if (proyecto && !visibles.includes(proyecto)) {
    return res.status(404).json({ error: 'No existe ese proyecto.' });
  }

  let sql = 'SELECT * FROM entradas WHERE inicio >= ? AND inicio <= ?';
  const params = [desde, hasta];
  if (req.usuario.rol !== 'admin') {
    sql += ' AND usuario_id = ?';
    params.push(req.usuario.id);
  } else if (quien) {
    sql += ' AND usuario_id = ?';
    params.push(quien);
  }
  sql += ` AND proyecto_id IN (${visibles.map(() => '?').join(',')})`;
  params.push(...visibles);
  if (proyecto) {
    sql += ' AND proyecto_id = ?';
    params.push(proyecto);
  }
  sql += ' ORDER BY inicio DESC';
  res.json({ entradas: db.get().prepare(sql).all(...params) });
});

router.post('/', (req, res) => {
  const proyectoId = Number(req.body.proyecto_id);
  const cat = String(req.body.categoria || '');
  const inicio = Number(req.body.inicio);
  const fin = Number(req.body.fin);
  if (!proyectoId || !CATS.has(cat) || !inicio || !fin || fin <= inicio) {
    return res.status(400).json({ error: 'Faltan datos del registro (proyecto, tipo, inicio y fin).' });
  }
  if (!puedeVerProyecto(req.usuario, proyectoId)) {
    return res.status(404).json({ error: 'Ese proyecto no existe.' });
  }

  let escenaId = req.body.escena_id ? Number(req.body.escena_id) : null;
  if (escenaId) {
    const esc = db.get().prepare('SELECT id FROM escenas WHERE id = ?').get(escenaId);
    if (!esc) escenaId = null;
  }

  const r = db.get().prepare(`
    INSERT INTO entradas (usuario_id, proyecto_id, escena_id, categoria, descripcion, inicio, fin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.usuario.id,
    proyectoId,
    escenaId,
    cat,
    String(req.body.descripcion || '').slice(0, 300),
    inicio,
    fin
  );
  const fila = db.get().prepare('SELECT * FROM entradas WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ entrada: fila });
});

router.put('/:id', (req, res) => {
  const e = db.get().prepare('SELECT * FROM entradas WHERE id = ?').get(Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'No existe ese registro.' });
  if (req.usuario.rol !== 'admin' && e.usuario_id !== req.usuario.id) {
    return res.status(403).json({ error: 'No puedes editar el registro de otra persona.' });
  }
  const proyectoId = Number(req.body.proyecto_id || e.proyecto_id);
  const cat = String(req.body.categoria || e.categoria);
  const inicio = Number(req.body.inicio || e.inicio);
  const fin = Number(req.body.fin || e.fin);
  if (!CATS.has(cat) || !inicio || !fin || fin <= inicio) {
    return res.status(400).json({ error: 'Inicio y fin no son válidos.' });
  }
  if (!puedeVerProyecto(req.usuario, proyectoId)) {
    return res.status(404).json({ error: 'Ese proyecto no existe.' });
  }
  let escenaId = req.body.escena_id != null && req.body.escena_id !== ''
    ? Number(req.body.escena_id) : e.escena_id;
  if (escenaId) {
    const esc = db.get().prepare('SELECT id FROM escenas WHERE id = ?').get(escenaId);
    if (!esc) escenaId = null;
  } else escenaId = null;
  db.get().prepare(`
    UPDATE entradas SET proyecto_id = ?, escena_id = ?, categoria = ?, descripcion = ?, inicio = ?, fin = ?
    WHERE id = ?
  `).run(proyectoId, escenaId, cat, String(req.body.descripcion || e.descripcion || '').slice(0, 300), inicio, fin, e.id);
  res.json({ entrada: db.get().prepare('SELECT * FROM entradas WHERE id = ?').get(e.id) });
});

router.delete('/:id', (req, res) => {
  const e = db.get().prepare('SELECT * FROM entradas WHERE id = ?').get(Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'No existe ese registro.' });
  if (!puedeVerHorasDe(req.usuario, e.usuario_id) || (req.usuario.rol !== 'admin' && e.usuario_id !== req.usuario.id)) {
    return res.status(403).json({ error: 'No puedes borrar el registro de otra persona.' });
  }
  if (!puedeVerProyecto(req.usuario, e.proyecto_id)) {
    return res.status(404).json({ error: 'No existe ese registro.' });
  }
  db.get().prepare('DELETE FROM entradas WHERE id = ?').run(e.id);
  res.json({ ok: true, entrada: e });
});

module.exports = router;
