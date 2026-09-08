'use strict';

const express = require('express');
const auth = require('../auth');
const db = require('../db');
const { publico, exigirAdmin } = require('../lib/permisos');

const router = express.Router();

router.get('/', exigirAdmin, (req, res) => {
  const filas = db.get().prepare('SELECT * FROM usuarios ORDER BY id').all();
  const pendientes = db.get().prepare(
    "SELECT COUNT(*) AS n FROM solicitudes_password WHERE estado = 'pendiente'"
  ).get().n;
  res.json({
    usuarios: filas.map(publico),
    solicitudes_pendientes: pendientes,
    mfa_obligatorio: (db.get().prepare("SELECT valor FROM ajustes WHERE clave = 'mfa_obligatorio'").get() || {}).valor === '1'
  });
});

router.post('/', exigirAdmin, async (req, res) => {
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const nombre = String(req.body.nombre || '').trim();
  const rol = req.body.rol === 'admin' ? 'admin' : 'usuario';
  if (!/^[a-z0-9._-]{2,32}$/.test(usuario)) {
    return res.status(400).json({ error: 'El usuario solo puede tener letras, números, punto, guion o _.' });
  }
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre.' });
  if (auth.usuarioPorLogin(usuario)) return res.status(409).json({ error: 'Ese usuario ya existe.' });

  const partes = nombre.split(/\s+/);
  const iniciales = ((partes[0] || 'X')[0] + (partes[1] || partes[0] || 'X')[0]).toUpperCase();
  const alta = new Date().toISOString().slice(0, 10);
  const hash = await auth.hashear(require('crypto').randomBytes(16).toString('hex'));
  const r = db.get().prepare(
    'INSERT INTO usuarios (usuario, nombre, iniciales, rol, activo, alta, hash) VALUES (?, ?, ?, ?, 1, ?, ?)'
  ).run(usuario, nombre, iniciales, rol, alta, hash);

  const codigo = auth.codigoReset();
  const resetHash = await auth.hashear(codigo);
  db.get().prepare('UPDATE usuarios SET reset_hash = ?, reset_caduca = ? WHERE id = ?')
    .run(resetHash, Date.now() + auth.RESET_MS, r.lastInsertRowid);

  auth.logea(req.usuario.nombre, `Alta de usuario «${usuario}» (${nombre})`);
  res.status(201).json({
    usuario: publico(auth.usuarioPorId(r.lastInsertRowid)),
    codigo,
    aviso: 'Dale este código en mano. La persona elige su contraseña en la pantalla de acceso. Tú no la verás.'
  });
});

router.post('/:id/reset', exigirAdmin, async (req, res) => {
  const u = auth.usuarioPorId(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'No existe esa cuenta.' });
  const codigo = auth.codigoReset();
  const resetHash = await auth.hashear(codigo);
  db.get().prepare('UPDATE usuarios SET reset_hash = ?, reset_caduca = ? WHERE id = ?')
    .run(resetHash, Date.now() + auth.RESET_MS, u.id);
  db.get().prepare("UPDATE solicitudes_password SET estado = 'atendida' WHERE usuario_id = ? AND estado = 'pendiente'")
    .run(u.id);
  auth.logea(req.usuario.nombre, `Generó código de restablecimiento para «${u.usuario}»`);
  res.json({ codigo, caduca_horas: 24 });
});

router.post('/:id/quitar-mfa', exigirAdmin, (req, res) => {
  const u = auth.usuarioPorId(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'No existe esa cuenta.' });
  db.get().prepare('UPDATE usuarios SET mfa_secreto = NULL, mfa_activo = 0 WHERE id = ?').run(u.id);
  db.get().prepare('DELETE FROM codigos_recuperacion WHERE usuario_id = ?').run(u.id);
  auth.logea(req.usuario.nombre, `Retiró el doble factor de «${u.usuario}»`);
  res.json({ ok: true });
});

router.post('/:id/rol', exigirAdmin, (req, res) => {
  const u = auth.usuarioPorId(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'No existe esa cuenta.' });
  if (u.id === req.usuario.id) return res.status(400).json({ error: 'No puedes cambiarte el rol a ti mismo.' });
  const rol = req.body.rol === 'admin' ? 'admin' : 'usuario';
  db.get().prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(rol, u.id);
  auth.logea(req.usuario.nombre, `Cambió el rol de «${u.usuario}» a ${rol}`);
  res.json({ ok: true });
});

router.post('/:id/activo', exigirAdmin, (req, res) => {
  const u = auth.usuarioPorId(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'No existe esa cuenta.' });
  if (u.id === req.usuario.id) return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
  const activo = req.body.activo ? 1 : 0;
  db.get().prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo, u.id);
  if (!activo) db.get().prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(u.id);
  auth.logea(req.usuario.nombre, `${activo ? 'Activó' : 'Desactivó'} la cuenta «${u.usuario}»`);
  res.json({ ok: true });
});

router.post('/politica-mfa', exigirAdmin, (req, res) => {
  const valor = req.body.obligatorio ? '1' : '0';
  db.get().prepare("INSERT INTO ajustes (clave, valor) VALUES ('mfa_obligatorio', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor")
    .run(valor);
  auth.logea(req.usuario.nombre, valor === '1' ? 'Exigió el doble factor a todo el equipo' : 'Dejó el doble factor como opcional');
  res.json({ ok: true, mfa_obligatorio: valor === '1' });
});

router.get('/solicitudes', exigirAdmin, (req, res) => {
  const filas = db.get().prepare(`
    SELECT s.id, s.fecha, s.mensaje, s.estado, u.usuario, u.nombre
    FROM solicitudes_password s
    JOIN usuarios u ON u.id = s.usuario_id
    ORDER BY s.fecha DESC
    LIMIT 50
  `).all();
  res.json({ solicitudes: filas });
});

router.get('/actividad', exigirAdmin, (req, res) => {
  const filas = db.get().prepare(
    'SELECT id, fecha, quien, accion FROM registro_actividad ORDER BY fecha DESC LIMIT 80'
  ).all();
  res.json({ actividad: filas });
});

module.exports = router;
