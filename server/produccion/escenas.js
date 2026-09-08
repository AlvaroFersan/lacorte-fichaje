'use strict';
/* produccion: escenas, columnas y avisos. No calcula horas; eso es fichaje. */

const express = require('express');
const db = require('../db');
const { exigirSesion, puedeVerProyecto, idsProyectosVisibles } = require('../lib/permisos');

const router = express.Router();
router.use(exigirSesion);

function escenaCompleta(e) {
  const comentarios = db.get().prepare(
    'SELECT c.id, c.usuario_id, c.fecha, c.texto, u.nombre FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id WHERE c.escena_id = ? ORDER BY c.fecha'
  ).all(e.id);
  const valores = db.get().prepare(
    'SELECT columna_id, valor FROM valores_columna WHERE escena_id = ?'
  ).all(e.id);
  const campos = {};
  for (const v of valores) campos[v.columna_id] = v.valor;
  return { ...e, comentarios, campos };
}

function idsSql(ids) {
  return ids.map(() => '?').join(',');
}

router.get('/', (req, res) => {
  const ids = idsProyectosVisibles(req.usuario);
  if (!ids.length) return res.json({ escenas: [] });
  const filas = db.get().prepare(
    `SELECT * FROM escenas WHERE proyecto_id IN (${idsSql(ids)}) ORDER BY id`
  ).all(...ids);
  res.json({ escenas: filas.map(escenaCompleta) });
});

router.get('/columnas', (req, res) => {
  const filas = db.get().prepare('SELECT * FROM columnas ORDER BY orden, id').all();
  res.json({
    columnas: filas.map(c => ({
      ...c,
      opciones: c.opciones ? JSON.parse(c.opciones) : null
    }))
  });
});

router.get('/avisos', (req, res) => {
  const filas = db.get().prepare(
    'SELECT * FROM avisos WHERE usuario_id = ? ORDER BY fecha DESC LIMIT 40'
  ).all(req.usuario.id);
  res.json({ avisos: filas });
});

router.post('/avisos/leer', (req, res) => {
  db.get().prepare('UPDATE avisos SET leido = 1 WHERE usuario_id = ?').run(req.usuario.id);
  res.json({ ok: true });
});

function cuerpoEscena(req, previa) {
  const base = db.get();
  const proyectoId = Number(req.body.proyecto_id || (previa && previa.proyecto_id));
  const proy = proyectoId ? base.prepare('SELECT * FROM proyectos WHERE id = ?').get(proyectoId) : null;
  if (!proy) {
    return { error: 'Ese proyecto no existe.' };
  }
  if (proy.personal) {
    return { error: 'Personal no lleva tareas. Usa la pizarra.' };
  }
  const titulo = String(req.body.titulo != null ? req.body.titulo : (previa && previa.titulo) || '').trim();
  if (!titulo) return { error: 'Falta el título.' };
  let carpetaId = req.body.carpeta_id != null ? Number(req.body.carpeta_id) : (previa && previa.carpeta_id) || null;
  if (carpetaId) {
    const c = base.prepare('SELECT id FROM carpetas WHERE id = ? AND proyecto_id = ?').get(carpetaId, proyectoId);
    if (!c) carpetaId = null;
  }
  let flujoId = req.body.flujo_id != null && req.body.flujo_id !== '' ? Number(req.body.flujo_id) : (previa ? previa.flujo_id : null);
  if (flujoId) {
    if (!base.prepare('SELECT id FROM flujos WHERE id = ?').get(flujoId)) flujoId = null;
  } else flujoId = null;
  const estado = String(req.body.estado || (previa && previa.estado) || 'pendiente').slice(0, 40);
  const prio = ['alta', 'media', 'baja'].includes(req.body.prioridad) ? req.body.prioridad : (previa && previa.prioridad) || 'media';
  let asignado = req.body.asignado_a != null && req.body.asignado_a !== '' ? Number(req.body.asignado_a) : (previa ? previa.asignado_a : null);
  if (asignado && !base.prepare('SELECT id FROM usuarios WHERE id = ?').get(asignado)) asignado = null;
  return {
    proyecto_id: proyectoId,
    carpeta_id: carpetaId,
    titulo: titulo.slice(0, 200),
    notas: String(req.body.notas != null ? req.body.notas : (previa && previa.notas) || '').slice(0, 4000),
    asignado_a: asignado,
    estado,
    prioridad: prio,
    fecha_entrega: req.body.fecha_entrega !== undefined ? (req.body.fecha_entrega || null) : (previa && previa.fecha_entrega) || null,
    flujo_id: flujoId
  };
}

router.post('/', (req, res) => {
  const datos = cuerpoEscena(req, null);
  if (datos.error) return res.status(400).json({ error: datos.error });
  if (!puedeVerProyecto(req.usuario, datos.proyecto_id)) {
    return res.status(404).json({ error: 'No existe ese proyecto.' });
  }
  const r = db.get().prepare(`
    INSERT INTO escenas (proyecto_id, carpeta_id, titulo, notas, asignado_a, estado, prioridad, fecha_entrega, creador, creada, flujo_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    datos.proyecto_id, datos.carpeta_id, datos.titulo, datos.notas, datos.asignado_a,
    datos.estado, datos.prioridad, datos.fecha_entrega, req.usuario.id, Date.now(), datos.flujo_id
  );
  const e = db.get().prepare('SELECT * FROM escenas WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ escena: escenaCompleta(e) });
});

router.put('/:id', (req, res) => {
  const previa = db.get().prepare('SELECT * FROM escenas WHERE id = ?').get(Number(req.params.id));
  if (!previa) return res.status(404).json({ error: 'No existe esa escena.' });
  if (!puedeVerProyecto(req.usuario, previa.proyecto_id)) {
    return res.status(404).json({ error: 'No existe esa escena.' });
  }
  const datos = cuerpoEscena(req, previa);
  if (datos.error) return res.status(400).json({ error: datos.error });
  if (!puedeVerProyecto(req.usuario, datos.proyecto_id)) {
    return res.status(404).json({ error: 'No existe ese proyecto.' });
  }
  db.get().prepare(`
    UPDATE escenas SET proyecto_id=?, carpeta_id=?, titulo=?, notas=?, asignado_a=?, estado=?, prioridad=?, fecha_entrega=?, flujo_id=?
    WHERE id=?
  `).run(
    datos.proyecto_id, datos.carpeta_id, datos.titulo, datos.notas, datos.asignado_a,
    datos.estado, datos.prioridad, datos.fecha_entrega, datos.flujo_id, previa.id
  );
  res.json({ escena: escenaCompleta(db.get().prepare('SELECT * FROM escenas WHERE id = ?').get(previa.id)) });
});

router.delete('/:id', (req, res) => {
  const e = db.get().prepare('SELECT * FROM escenas WHERE id = ?').get(Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'No existe esa escena.' });
  if (!puedeVerProyecto(req.usuario, e.proyecto_id)) {
    return res.status(404).json({ error: 'No existe esa escena.' });
  }
  db.get().prepare('DELETE FROM escenas WHERE id = ?').run(e.id);
  res.json({ ok: true });
});

router.get('/:id', (req, res) => {
  const e = db.get().prepare('SELECT * FROM escenas WHERE id = ?').get(Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'No existe esa escena.' });
  if (!puedeVerProyecto(req.usuario, e.proyecto_id)) {
    return res.status(404).json({ error: 'No existe esa escena.' });
  }
  res.json({ escena: escenaCompleta(e) });
});

module.exports = router;
