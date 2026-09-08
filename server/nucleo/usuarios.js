'use strict';

const express = require('express');
const db = require('../db');
const { exigirSesion } = require('../lib/permisos');

const router = express.Router();

function equipoActivo() {
  return db.get().prepare(
    'SELECT id, usuario, nombre, iniciales, rol, activo FROM usuarios WHERE activo = 1 ORDER BY nombre'
  ).all();
}

router.get('/', exigirSesion, (req, res) => {
  res.json({ equipo: equipoActivo() });
});

router.get('/equipo', exigirSesion, (req, res) => {
  res.json({ equipo: equipoActivo() });
});

module.exports = router;
