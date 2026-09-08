'use strict';

const express = require('express');
const db = require('../db');
const { exigirSesion, puedeVerProyecto } = require('../lib/permisos');
const { aplicarPlantillaEstudio, crearProyectoPersonal } = require('../produccion/plantilla');

const router = express.Router();
router.use(exigirSesion);

function colorGuardado(c) {
  const s = String(c == null ? '' : c).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  return '';
}

function conEquipo(p) {
  const equipo = db.get().prepare('SELECT usuario_id FROM proyecto_equipo WHERE proyecto_id = ?').all(p.id)
    .map(r => r.usuario_id);
  return { ...p, equipo };
}

function cargaProyecto(id) {
  return db.get().prepare('SELECT * FROM proyectos WHERE id = ?').get(Number(id));
}

function niegaSiNoVe(req, res, p) {
  if (!p) {
    res.status(404).json({ error: 'No existe ese proyecto.' });
    return true;
  }
  if (!puedeVerProyecto(req.usuario, p)) {
    res.status(404).json({ error: 'No existe ese proyecto.' });
    return true;
  }
  return false;
}

router.get('/', (req, res) => {
  const filas = db.get().prepare('SELECT * FROM proyectos ORDER BY personal DESC, id').all();
  res.json({ proyectos: filas.filter(p => puedeVerProyecto(req.usuario, p)).map(conEquipo) });
});

router.get('/:id', (req, res) => {
  const p = cargaProyecto(req.params.id);
  if (niegaSiNoVe(req, res, p)) return;
  const carpetas = db.get().prepare('SELECT * FROM carpetas WHERE proyecto_id = ? ORDER BY id').all(p.id);
  res.json({ proyecto: conEquipo(p), carpetas });
});

router.post('/', (req, res) => {
  const base = db.get();
  if (req.body.personal) {
    const id = crearProyectoPersonal(base, req.usuario.id);
    return res.status(201).json({
      proyecto: conEquipo(base.prepare('SELECT * FROM proyectos WHERE id = ?').get(id)),
      carpetas: []
    });
  }
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre del proyecto.' });
  const equipo = Array.isArray(req.body.equipo) ? req.body.equipo : [];
  const id = base.transaction(() => {
    const r = base.prepare(`
      INSERT INTO proyectos (nombre, cliente, formato, estado, horas_presupuestadas, fecha_entrega, minutos_programa, versiones, color, flujo_id, dueno, personal, pizarra)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')
    `).run(
      nombre,
      String(req.body.cliente || '').trim(),
      String(req.body.formato || 'Interno'),
      ['curso', 'entregado', 'pausa'].includes(req.body.estado) ? req.body.estado : 'curso',
      Number(req.body.horas_presupuestadas) || 0,
      req.body.fecha_entrega || null,
      Number(req.body.minutos_programa) || 0,
      Number(req.body.versiones) || 0,
      colorGuardado(req.body.color),
      Number(req.body.flujo_id) || 2,
      req.usuario.id
    );
    const ins = base.prepare('INSERT OR IGNORE INTO proyecto_equipo (proyecto_id, usuario_id) VALUES (?, ?)');
    ins.run(r.lastInsertRowid, req.usuario.id);
    for (const uid of equipo) ins.run(r.lastInsertRowid, Number(uid));
    aplicarPlantillaEstudio(base, r.lastInsertRowid);
    return r.lastInsertRowid;
  })();
  const carpetas = base.prepare('SELECT * FROM carpetas WHERE proyecto_id = ? ORDER BY id').all(id);
  res.status(201).json({
    proyecto: conEquipo(base.prepare('SELECT * FROM proyectos WHERE id = ?').get(id)),
    carpetas
  });
});

router.put('/:id', (req, res) => {
  const base = db.get();
  const p = cargaProyecto(req.params.id);
  if (niegaSiNoVe(req, res, p)) return;
  const esDue = Number(p.dueno) === Number(req.usuario.id);
  const flujoId = req.body.flujo_id != null ? Number(req.body.flujo_id) : p.flujo_id;
  if (flujoId && !base.prepare('SELECT id FROM flujos WHERE id = ?').get(flujoId)) {
    return res.status(400).json({ error: 'Ese flujo no existe.' });
  }
  const nombre = p.personal
    ? p.nombre
    : (esDue ? (String(req.body.nombre || p.nombre).trim() || p.nombre) : p.nombre);
  base.prepare(`
    UPDATE proyectos SET nombre=?, cliente=?, formato=?, estado=?, horas_presupuestadas=?,
      fecha_entrega=?, minutos_programa=?, versiones=?, color=?, flujo_id=?, pizarra=? WHERE id=?
  `).run(
    nombre,
    esDue ? String(req.body.cliente != null ? req.body.cliente : p.cliente) : p.cliente,
    esDue ? String(req.body.formato || p.formato) : p.formato,
    esDue && ['curso', 'entregado', 'pausa'].includes(req.body.estado) ? req.body.estado : p.estado,
    esDue && req.body.horas_presupuestadas != null ? Number(req.body.horas_presupuestadas) : p.horas_presupuestadas,
    esDue && req.body.fecha_entrega !== undefined ? (req.body.fecha_entrega || null) : p.fecha_entrega,
    esDue && req.body.minutos_programa != null ? Number(req.body.minutos_programa) : p.minutos_programa,
    esDue && req.body.versiones != null ? Number(req.body.versiones) : p.versiones,
    req.body.color !== undefined ? colorGuardado(req.body.color) : p.color,
    esDue ? (flujoId || 1) : p.flujo_id,
    req.body.pizarra !== undefined ? String(req.body.pizarra).slice(0, 200000) : p.pizarra,
    p.id
  );
  res.json({ proyecto: conEquipo(base.prepare('SELECT * FROM proyectos WHERE id = ?').get(p.id)) });
});

router.put('/:id/equipo', (req, res) => {
  const base = db.get();
  const p = cargaProyecto(req.params.id);
  if (niegaSiNoVe(req, res, p)) return;
  if (Number(p.dueno) !== Number(req.usuario.id)) {
    return res.status(403).json({ error: 'Solo el dueño puede invitar.' });
  }
  const ids = Array.isArray(req.body.equipo) ? req.body.equipo.map(Number) : [];
  const set = new Set([Number(p.dueno), ...ids.filter(n => n && n !== Number(p.dueno))]);
  base.prepare('DELETE FROM proyecto_equipo WHERE proyecto_id = ?').run(p.id);
  const ins = base.prepare('INSERT OR IGNORE INTO proyecto_equipo (proyecto_id, usuario_id) VALUES (?, ?)');
  for (const uid of set) {
    if (base.prepare('SELECT id FROM usuarios WHERE id = ?').get(uid)) ins.run(p.id, uid);
  }
  res.json({ proyecto: conEquipo(base.prepare('SELECT * FROM proyectos WHERE id = ?').get(p.id)) });
});

router.post('/:id/salir', (req, res) => {
  const p = cargaProyecto(req.params.id);
  if (niegaSiNoVe(req, res, p)) return;
  if (Number(p.dueno) === Number(req.usuario.id)) {
    return res.status(400).json({ error: 'El dueño no puede salir de su propio proyecto.' });
  }
  db.get().prepare('DELETE FROM proyecto_equipo WHERE proyecto_id = ? AND usuario_id = ?')
    .run(p.id, req.usuario.id);
  res.json({ ok: true });
});

router.post('/:id/carpetas', (req, res) => {
  const base = db.get();
  const p = cargaProyecto(req.params.id);
  if (niegaSiNoVe(req, res, p)) return;
  if (p.personal) return res.status(400).json({ error: 'Personal no lleva carpetas. Usa la pizarra.' });
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre de la carpeta.' });
  let padre = req.body.padre_id != null ? Number(req.body.padre_id) : null;
  if (padre) {
    const ok = base.prepare('SELECT id FROM carpetas WHERE id = ? AND proyecto_id = ?').get(padre, p.id);
    if (!ok) padre = null;
  }
  const r = base.prepare('INSERT INTO carpetas (proyecto_id, nombre, padre_id) VALUES (?, ?, ?)').run(p.id, nombre, padre);
  res.status(201).json({ carpeta: base.prepare('SELECT * FROM carpetas WHERE id = ?').get(r.lastInsertRowid) });
});

router.get('/:id/carpetas', (req, res) => {
  const p = cargaProyecto(req.params.id);
  if (niegaSiNoVe(req, res, p)) return;
  const filas = db.get().prepare('SELECT * FROM carpetas WHERE proyecto_id = ? ORDER BY id').all(p.id);
  res.json({ carpetas: filas });
});

module.exports = router;
