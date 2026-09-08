'use strict';
/* produccion: escenas, columnas y avisos. No calcula horas; eso es fichaje. */

const express = require('express');
const db = require('../db');
const { exigirSesion } = require('../lib/permisos');

const router = express.Router();
router.use(exigirSesion);

function escenaCompleta(e) {
  const subtareas = db.get().prepare('SELECT id, texto, hecha, orden FROM subtareas WHERE escena_id = ? ORDER BY orden, id').all(e.id);
  const comentarios = db.get().prepare(
    'SELECT c.id, c.usuario_id, c.fecha, c.texto, u.nombre FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id WHERE c.escena_id = ? ORDER BY c.fecha'
  ).all(e.id);
  const valores = db.get().prepare(
    'SELECT columna_id, valor FROM valores_columna WHERE escena_id = ?'
  ).all(e.id);
  const campos = {};
  for (const v of valores) campos[v.columna_id] = v.valor;
  return { ...e, subtareas, comentarios, campos };
}

router.get('/', (req, res) => {
  const filas = db.get().prepare('SELECT * FROM escenas ORDER BY id').all();
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

router.get('/:id', (req, res) => {
  const e = db.get().prepare('SELECT * FROM escenas WHERE id = ?').get(Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'No existe esa escena.' });
  res.json({ escena: escenaCompleta(e) });
});

module.exports = router;
