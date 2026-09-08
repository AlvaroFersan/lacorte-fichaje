'use strict';
/* nucleo: login, sesión y restablecer clave. */

const express = require('express');
const auth = require('../auth');
const db = require('../db');
const { publico, exigirSesion } = require('../lib/permisos');

const router = express.Router();

const intentos = new Map();
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 8;

function claveLenta(ip, usuario) {
  return `${ip}|${String(usuario || '').toLowerCase()}`;
}

function demasiadosIntentos(ip, usuario) {
  const k = claveLenta(ip, usuario);
  const ahora = Date.now();
  const lista = (intentos.get(k) || []).filter(t => ahora - t < VENTANA_MS);
  intentos.set(k, lista);
  return lista.length >= MAX_INTENTOS;
}

function anotarFallo(ip, usuario) {
  const k = claveLenta(ip, usuario);
  const lista = intentos.get(k) || [];
  lista.push(Date.now());
  intentos.set(k, lista);
}

function mfaObligatorio() {
  const fila = db.get().prepare("SELECT valor FROM ajustes WHERE clave = 'mfa_obligatorio'").get();
  return fila && fila.valor === '1';
}

router.post('/entrar', async (req, res) => {
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const clave = String(req.body.clave || '');
  const ip = req.ip || req.socket.remoteAddress || '';

  if (!usuario || !clave) {
    return res.status(400).json({ error: 'Escribe usuario y contraseña.' });
  }
  if (demasiadosIntentos(ip, usuario)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos o avisa al administrador.' });
  }

  const u = auth.usuarioPorLogin(usuario);
  if (!u || !u.activo || !(await auth.claveOk(clave, u.hash))) {
    anotarFallo(ip, usuario);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  if (u.mfa_activo) {
    const ticket = auth.crearTicketMfa(u.id);
    return res.json({ necesita_mfa: true, ticket });
  }

  if (mfaObligatorio()) {
    const ticket = auth.crearTicketMfa(u.id);
    const secreto = auth.totp.nuevoSecreto();
    return res.json({
      necesita_alta_mfa: true,
      ticket,
      secreto,
      uri: auth.totp.uriOtpauth('La Corte Fichaje', u.usuario, secreto)
    });
  }

  const sid = auth.crearSesion(u.id);
  auth.ponerCookie(res, sid);
  auth.logea(u.nombre, 'Acceso');
  res.json({ ok: true, usuario: publico(u) });
});

router.post('/mfa', async (req, res) => {
  const ticket = String(req.body.ticket || '');
  const codigo = String(req.body.codigo || '').replace(/[\s-]/g, '');
  const pend = auth.gastarTicketMfa(ticket);
  if (!pend) return res.status(401).json({ error: 'El código ha caducado. Vuelve a entrar.' });

  const u = auth.usuarioPorId(pend.usuario_id);
  if (!u || !u.activo) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

  if (u.mfa_activo && u.mfa_secreto && auth.totp.totpOk(u.mfa_secreto, codigo)) {
    const sid = auth.crearSesion(u.id);
    auth.ponerCookie(res, sid);
    auth.logea(u.nombre, 'Acceso con doble factor');
    return res.json({ ok: true, usuario: publico(u) });
  }

  const recup = db.get().prepare(
    'SELECT * FROM codigos_recuperacion WHERE usuario_id = ? AND usado = 0'
  ).all(u.id);
  for (const r of recup) {
    if (await auth.claveOk(codigo.toUpperCase(), r.hash)) {
      db.get().prepare('UPDATE codigos_recuperacion SET usado = 1 WHERE id = ?').run(r.id);
      const sid = auth.crearSesion(u.id);
      auth.ponerCookie(res, sid);
      const quedan = recup.length - 1;
      auth.logea(u.nombre, 'Acceso con código de recuperación');
      return res.json({
        ok: true,
        usuario: publico(u),
        aviso: quedan
          ? `Has gastado un código de recuperación. Te quedan ${quedan}.`
          : 'Era tu último código de recuperación. Vuelve a configurar el doble factor.'
      });
    }
  }

  return res.status(401).json({ error: 'Código incorrecto.' });
});

router.post('/mfa/activar', async (req, res) => {
  const ticket = String(req.body.ticket || '');
  const codigo = String(req.body.codigo || '').replace(/\s/g, '');
  const secreto = String(req.body.secreto || '');
  const pend = auth.gastarTicketMfa(ticket);
  if (!pend) return res.status(401).json({ error: 'La configuración ha caducado. Vuelve a entrar.' });
  const u = auth.usuarioPorId(pend.usuario_id);
  if (!u || !auth.totp.totpOk(secreto, codigo)) {
    return res.status(400).json({ error: 'El código no coincide. Revisa la hora del móvil.' });
  }

  const planos = [];
  const ins = db.get().prepare('INSERT INTO codigos_recuperacion (usuario_id, hash, usado) VALUES (?, ?, 0)');
  db.get().prepare('DELETE FROM codigos_recuperacion WHERE usuario_id = ?').run(u.id);
  for (let i = 0; i < 8; i++) {
    const c = auth.codigoRecuperacion();
    planos.push(c);
    ins.run(u.id, await auth.hashear(c));
  }
  db.get().prepare('UPDATE usuarios SET mfa_secreto = ?, mfa_activo = 1 WHERE id = ?').run(secreto, u.id);
  const sid = auth.crearSesion(u.id);
  auth.ponerCookie(res, sid);
  auth.logea(u.nombre, 'Activó el doble factor');
  res.json({ ok: true, usuario: publico({ ...u, mfa_activo: 1 }), recuperacion: planos });
});

router.post('/solicitar-reset', (req, res) => {
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const mensaje = String(req.body.mensaje || '').slice(0, 400);
  const u = auth.usuarioPorLogin(usuario);
  /* Siempre la misma respuesta: no decimos si el usuario existe. */
  if (u && u.activo) {
    db.get().prepare(
      'INSERT INTO solicitudes_password (usuario_id, fecha, mensaje, estado) VALUES (?, ?, ?, ?)'
    ).run(u.id, Date.now(), mensaje, 'pendiente');
    auth.logea(u.nombre, 'Pidió restablecer la contraseña');
  }
  res.json({ ok: true, mensaje: 'Si esa cuenta existe, el administrador ya tiene el aviso. Te dará un código en mano.' });
});

router.post('/restablecer', async (req, res) => {
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  const clave = String(req.body.clave || '');
  const clave2 = String(req.body.clave2 || '');

  if (clave.length < 8) return res.status(400).json({ error: 'La contraseña nueva tiene que tener al menos 8 caracteres.' });
  if (clave !== clave2) return res.status(400).json({ error: 'Las dos contraseñas no coinciden.' });

  const u = auth.usuarioPorLogin(usuario);
  if (!u || !u.reset_hash || !u.reset_caduca || u.reset_caduca < Date.now()) {
    return res.status(400).json({ error: 'El código no es válido o ha caducado. Pide uno nuevo al administrador.' });
  }
  if (!(await auth.claveOk(codigo, u.reset_hash))) {
    return res.status(400).json({ error: 'El código no es válido o ha caducado. Pide uno nuevo al administrador.' });
  }

  const hash = await auth.hashear(clave);
  db.get().prepare('UPDATE usuarios SET hash = ?, reset_hash = NULL, reset_caduca = NULL WHERE id = ?').run(hash, u.id);
  db.get().prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(u.id);
  auth.logea(u.nombre, 'Restableció su contraseña');
  res.json({ ok: true, mensaje: 'Contraseña cambiada. Ya puedes entrar.' });
});

router.post('/salir', (req, res) => {
  if (req.sesionId) auth.borrarSesion(req.sesionId);
  auth.quitarCookie(res);
  res.json({ ok: true });
});

router.get('/sesion', (req, res) => {
  if (!req.usuario) return res.json({ usuario: null });
  res.json({ usuario: publico(req.usuario) });
});

router.post('/cambiar-clave', exigirSesion, async (req, res) => {
  const actual = String(req.body.actual || '');
  const clave = String(req.body.clave || '');
  const clave2 = String(req.body.clave2 || '');
  if (!(await auth.claveOk(actual, req.usuario.hash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  }
  if (clave.length < 8) return res.status(400).json({ error: 'La contraseña nueva tiene que tener al menos 8 caracteres.' });
  if (clave !== clave2) return res.status(400).json({ error: 'Las dos contraseñas no coinciden.' });
  const hash = await auth.hashear(clave);
  db.get().prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(hash, req.usuario.id);
  auth.logea(req.usuario.nombre, 'Cambio de contraseña propia');
  res.json({ ok: true });
});

module.exports = router;
