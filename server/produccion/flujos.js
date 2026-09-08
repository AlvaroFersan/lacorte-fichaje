'use strict';

const express = require('express');
const db = require('../db');
const { exigirSesion } = require('../lib/permisos');
const { sembrarFlujos, leerFlujos } = require('./plantilla');

const router = express.Router();
router.use(exigirSesion);

router.get('/', (req, res) => {
  const base = db.get();
  sembrarFlujos(base);
  res.json({ flujos: leerFlujos(base) });
});

module.exports = router;
