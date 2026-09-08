'use strict';

const express = require('express');
const db = require('../db');
const { exigirSesion, exigirAdmin, puedeVerHorasDe } = require('../lib/permisos');
const { partesEnDesfase } = require('../lib/fechas');

const router = express.Router();
router.use(exigirSesion);

const CAT = { gestion: 'Gestión', asis: 'Asistencia de montaje', montaje: 'Montaje' };

function tarifas() {
  const fila = db.get().prepare("SELECT valor FROM ajustes WHERE clave = 'tarifas'").get();
  return fila ? JSON.parse(fila.valor) : { gestion: 45, asis: 28, montaje: 42 };
}

router.get('/resumen', (req, res) => {
  const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 14));
  const desde = Date.now() - dias * 86400000;
  const quien = req.query.usuario_id ? Number(req.query.usuario_id) : null;
  if (quien && !puedeVerHorasDe(req.usuario, quien)) {
    return res.status(403).json({ error: 'Solo puedes ver tus propias horas.' });
  }

  let sql = 'SELECT * FROM entradas WHERE inicio >= ?';
  const params = [desde];
  if (req.usuario.rol !== 'admin') {
    sql += ' AND usuario_id = ?';
    params.push(req.usuario.id);
  } else if (quien) {
    sql += ' AND usuario_id = ?';
    params.push(quien);
  }
  if (req.query.proyecto_id) {
    sql += ' AND proyecto_id = ?';
    params.push(Number(req.query.proyecto_id));
  }

  const entradas = db.get().prepare(sql).all(...params);
  const porCat = { gestion: 0, asis: 0, montaje: 0 };
  const porProy = {};
  let total = 0;
  for (const e of entradas) {
    const seg = (e.fin - e.inicio) / 1000;
    total += seg;
    porCat[e.categoria] = (porCat[e.categoria] || 0) + seg;
    porProy[e.proyecto_id] = (porProy[e.proyecto_id] || 0) + seg;
  }
  res.json({ dias, total_segundos: total, por_categoria: porCat, por_proyecto: porProy, n: entradas.length });
});

router.get('/gestion', exigirAdmin, (req, res) => {
  const t = tarifas();
  const proyectos = db.get().prepare('SELECT * FROM proyectos ORDER BY id').all();
  const out = proyectos.map(p => {
    const horas = db.get().prepare(
      'SELECT categoria, SUM(fin - inicio) AS ms FROM entradas WHERE proyecto_id = ? GROUP BY categoria'
    ).all(p.id);
    let reales = 0;
    let coste = 0;
    const porCat = { gestion: 0, asis: 0, montaje: 0 };
    for (const h of horas) {
      const horasNum = h.ms / 3600000;
      porCat[h.categoria] = horasNum;
      reales += horasNum;
      coste += horasNum * (t[h.categoria] || 0);
    }
    return {
      ...p,
      horas_reales: reales,
      coste,
      desviacion: reales - p.horas_presupuestadas,
      por_categoria: porCat
    };
  });
  res.json({ proyectos: out, tarifas: t, categorias: CAT });
});

router.get('/csv', (req, res) => {
  const quien = req.usuario.rol === 'admin' && req.query.usuario_id
    ? Number(req.query.usuario_id)
    : (req.usuario.rol === 'admin' ? null : req.usuario.id);
  let sql = `SELECT e.id, e.inicio, e.fin, e.categoria, e.descripcion,
                    u.nombre AS persona, p.nombre AS proyecto
             FROM entradas e
             JOIN usuarios u ON u.id = e.usuario_id
             JOIN proyectos p ON p.id = e.proyecto_id`;
  const params = [];
  if (quien) {
    sql += ' WHERE e.usuario_id = ?';
    params.push(quien);
  }
  sql += ' ORDER BY e.inicio';
  const desfase = req.query.desfase;
  const filas = db.get().prepare(sql).all(...params);
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = ['id,inicio,fin,persona,proyecto,tipo,descripcion'];
  for (const f of filas) {
    const a = partesEnDesfase(f.inicio, desfase);
    const b = partesEnDesfase(f.fin, desfase);
    lineas.push([
      f.id,
      a.fecha + ' ' + a.hora,
      b.fecha + ' ' + b.hora,
      esc(f.persona),
      esc(f.proyecto),
      CAT[f.categoria] || f.categoria,
      esc(f.descripcion)
    ].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="horas-la-corte.csv"');
  res.send('\uFEFF' + lineas.join('\n'));
});

module.exports = router;
