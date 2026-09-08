'use strict';

const express = require('express');
const db = require('../db');
const { exigirSesion } = require('../lib/permisos');

const router = express.Router();
router.use(exigirSesion);

function publico(m) {
  return {
    id: m.id,
    de: m.de,
    para: m.para,
    texto: m.texto,
    adj_nom: m.adj_nom || null,
    adj_tipo: m.adj_tipo || null,
    adj_tam: m.adj_tam || null,
    ts: m.ts,
    leido: !!m.leido
  };
}

router.get('/', (req, res) => {
  const yo = req.usuario.id;
  const despues = Number(req.query.despues) || 0;
  const filas = db.get().prepare(`
    SELECT * FROM chat_mensajes
    WHERE (de = ? OR para = ?) AND id > ?
    ORDER BY id
    LIMIT 200
  `).all(yo, yo, despues);
  res.json({ mensajes: filas.map(publico) });
});

router.post('/', (req, res) => {
  const para = Number(req.body.para);
  const texto = String(req.body.texto || '').trim().slice(0, 2000);
  const adjNom = req.body.adj_nom ? String(req.body.adj_nom).slice(0, 180) : null;
  if (!para || para === req.usuario.id) {
    return res.status(400).json({ error: 'Elige a alguien del estudio.' });
  }
  const dest = db.get().prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(para);
  if (!dest) return res.status(404).json({ error: 'Esa cuenta no existe.' });
  if (!texto && !adjNom) return res.status(400).json({ error: 'Escribe un mensaje.' });
  const r = db.get().prepare(`
    INSERT INTO chat_mensajes (de, para, texto, adj_nom, adj_tipo, adj_tam, ts, leido)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    req.usuario.id,
    para,
    texto,
    adjNom,
    req.body.adj_tipo ? String(req.body.adj_tipo).slice(0, 80) : null,
    Number(req.body.adj_tam) || null,
    Date.now()
  );
  const m = db.get().prepare('SELECT * FROM chat_mensajes WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ mensaje: publico(m) });
});

router.post('/leer', (req, res) => {
  const de = Number(req.body.de);
  if (!de) return res.status(400).json({ error: 'Falta el interlocutor.' });
  db.get().prepare(
    'UPDATE chat_mensajes SET leido = 1 WHERE para = ? AND de = ? AND leido = 0'
  ).run(req.usuario.id, de);
  res.json({ ok: true });
});

module.exports = router;
