'use strict';

/**
 * Contraseñas, sesiones, TOTP y códigos de restablecimiento.
 * La contraseña nunca se guarda: solo un hash bcrypt. Ni el admin puede leerla.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const totp = require('./lib/totp');

const COSTE_BCRYPT = 12;
const SESION_MS = 14 * 24 * 60 * 60 * 1000; /* 14 días: el equipo deja el navegador abierto */
const TICKET_MFA_MS = 5 * 60 * 1000;
const RESET_MS = 24 * 60 * 60 * 1000;
const COOKIE = 'lc_sesion';

function secretoSesion() {
  const s = process.env.SESSION_SECRET;
  if (!s || s === 'cambia-esta-frase-por-una-aleatoria-larga') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta SESSION_SECRET en el .env. Sin eso las cookies no son seguras.');
    }
    return 'solo-desarrollo-no-usar-en-el-nas';
  }
  return s;
}

function firmar(valor) {
  const mac = crypto.createHmac('sha256', secretoSesion()).update(valor).digest('hex');
  return `${valor}.${mac}`;
}

function leerFirmado(cookie) {
  if (!cookie || !cookie.includes('.')) return null;
  const i = cookie.lastIndexOf('.');
  const valor = cookie.slice(0, i);
  const mac = cookie.slice(i + 1);
  const esperado = crypto.createHmac('sha256', secretoSesion()).update(valor).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return valor;
}

async function hashear(clave) {
  return bcrypt.hash(String(clave), COSTE_BCRYPT);
}

async function claveOk(clave, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(clave), hash);
}

function usuarioPorLogin(login) {
  return db.get().prepare('SELECT * FROM usuarios WHERE usuario = ?').get(String(login).trim().toLowerCase());
}

function usuarioPorId(id) {
  return db.get().prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
}

function logea(quien, accion) {
  db.get().prepare(
    'INSERT INTO registro_actividad (fecha, quien, accion) VALUES (?, ?, ?)'
  ).run(Date.now(), quien, accion);
}

function serializarCookie(nombre, valor, opts) {
  let s = `${nombre}=${encodeURIComponent(valor)}`;
  if (opts.maxAge) s += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
  s += `; Path=${opts.path || '/'}`;
  if (opts.httpOnly) s += '; HttpOnly';
  if (opts.sameSite) s += `; SameSite=${opts.sameSite}`;
  if (opts.secure) s += '; Secure';
  return s;
}

function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === '1',
    path: '/',
    maxAge: SESION_MS
  };
}

function ponerCookie(res, sesionId) {
  res.setHeader('Set-Cookie', serializarCookie(COOKIE, firmar(sesionId), opcionesCookie()));
}

function quitarCookie(res) {
  res.setHeader('Set-Cookie', serializarCookie(COOKIE, '', { path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 0 }));
}

function crearSesion(usuarioId) {
  const id = crypto.randomBytes(32).toString('hex');
  const ahora = Date.now();
  db.get().prepare(
    'INSERT INTO sesiones (id, usuario_id, creada, ultimo_uso, caduca) VALUES (?, ?, ?, ?, ?)'
  ).run(id, usuarioId, ahora, ahora, ahora + SESION_MS);
  return id;
}

function sesionViva(sesionId) {
  const fila = db.get().prepare('SELECT * FROM sesiones WHERE id = ?').get(sesionId);
  if (!fila || fila.caduca < Date.now()) {
    if (fila) db.get().prepare('DELETE FROM sesiones WHERE id = ?').run(sesionId);
    return null;
  }
  db.get().prepare('UPDATE sesiones SET ultimo_uso = ? WHERE id = ?').run(Date.now(), sesionId);
  return fila;
}

function borrarSesion(sesionId) {
  db.get().prepare('DELETE FROM sesiones WHERE id = ?').run(sesionId);
}

function crearTicketMfa(usuarioId) {
  const ticket = crypto.randomBytes(24).toString('hex');
  const caduca = Date.now() + TICKET_MFA_MS;
  db.get().prepare('INSERT INTO mfa_pendiente (ticket, usuario_id, caduca) VALUES (?, ?, ?)').run(ticket, usuarioId, caduca);
  return ticket;
}

function gastarTicketMfa(ticket) {
  const fila = db.get().prepare('SELECT * FROM mfa_pendiente WHERE ticket = ?').get(ticket);
  if (!fila) return null;
  db.get().prepare('DELETE FROM mfa_pendiente WHERE ticket = ?').run(ticket);
  if (fila.caduca < Date.now()) return null;
  return fila;
}

function codigoReset() {
  const pieza = () => crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  return `LC-${pieza()}-${pieza()}`;
}

function codigoRecuperacion() {
  return crypto.randomBytes(5).toString('hex').slice(0, 10).toUpperCase();
}

function middlewareSesion(req, res, next) {
  req.usuario = null;
  req.sesionId = null;
  const crudo = leerCookie(req, COOKIE);
  const id = leerFirmado(crudo);
  if (!id) return next();
  const ses = sesionViva(id);
  if (!ses) return next();
  const u = usuarioPorId(ses.usuario_id);
  if (!u || !u.activo) {
    borrarSesion(id);
    return next();
  }
  req.usuario = u;
  req.sesionId = id;
  next();
}

function leerCookie(req, nombre) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const parte of raw.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    if (k === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

/** Evita que alguien pruebe contraseñas a lo loco desde otra web. */
function origenPermitido(req) {
  const origen = req.headers.origin;
  if (!origen) return true;
  const host = req.headers.host;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

function exigirMismoOrigen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!origenPermitido(req)) {
    return res.status(403).json({ error: 'Petición rechazada (origen no válido).' });
  }
  next();
}

module.exports = {
  COOKIE,
  hashear,
  claveOk,
  usuarioPorLogin,
  usuarioPorId,
  logea,
  opcionesCookie,
  ponerCookie,
  quitarCookie,
  crearSesion,
  borrarSesion,
  crearTicketMfa,
  gastarTicketMfa,
  codigoReset,
  codigoRecuperacion,
  middlewareSesion,
  exigirMismoOrigen,
  totp,
  RESET_MS
};
