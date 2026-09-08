'use strict';

/**
 * TOTP (RFC 6238), el mismo sistema que Google Authenticator / Authy / 1Password.
 * Lo escribimos aquí con la librería de criptografía de Node: no hace falta
 * internet ni paquetes extra. El servidor es quien valida el código; el
 * navegador solo lo envía.
 */

const crypto = require('crypto');

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesABase32(buf) {
  let bits = 0;
  let valor = 0;
  let out = '';
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALFABETO[(valor << (5 - bits)) & 31];
  return out;
}

function base32ABytes(texto) {
  const s = String(texto).replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const out = [];
  for (const c of s) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) continue;
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secretoB32, tiempo = Date.now(), paso = 30, digitos = 6) {
  const contador = Math.floor(tiempo / 1000 / paso);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(contador / 4294967296), 0);
  buf.writeUInt32BE(contador >>> 0, 4);
  const h = crypto.createHmac('sha1', base32ABytes(secretoB32)).update(buf).digest();
  const off = h[19] & 0x0f;
  const cod = ((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % (10 ** digitos);
  return String(cod).padStart(digitos, '0');
}

/** Acepta el código actual y el de ±30 s: los relojes del móvil nunca van finos. */
function totpOk(secretoB32, codigo, ventana = 1) {
  const c = String(codigo || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c) || !secretoB32) return false;
  for (let d = -ventana; d <= ventana; d++) {
    if (totp(secretoB32, Date.now() + d * 30000) === c) return true;
  }
  return false;
}

function nuevoSecreto() {
  return bytesABase32(crypto.randomBytes(20));
}

function uriOtpauth(emisor, cuenta, secretoB32) {
  const label = encodeURIComponent(`${emisor}:${cuenta}`);
  const q = new URLSearchParams({
    secret: secretoB32,
    issuer: emisor,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

module.exports = { totp, totpOk, nuevoSecreto, uriOtpauth, bytesABase32, base32ABytes };
