'use strict';

/**
 * Cambia el hash bcrypt de una cuenta. La clave entra por el entorno
 * (CLAVE_ALVARO), nunca por el código ni por un archivo que se suba.
 *
 *   CLAVE_ALVARO=… node scripts/poner-clave.js alvaro
 */

const fs = require('fs');
const path = require('path');

function cargarEnv(archivo) {
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

cargarEnv(path.join(__dirname, '..', '.env'));
if (!process.env.RUTA_DB) {
  process.env.RUTA_DB = path.join(__dirname, '..', 'data', 'fichaje.db');
}

const db = require('../server/db');
const auth = require('../server/auth');

async function main() {
  const usuario = String(process.argv[2] || 'alvaro').trim().toLowerCase();
  const clave = process.env.CLAVE_ALVARO;
  if (!clave) {
    console.error('Falta CLAVE_ALVARO en el entorno. No se escribe en el código.');
    process.exit(1);
  }
  const u = db.get().prepare('SELECT id, usuario FROM usuarios WHERE usuario = ?').get(usuario);
  if (!u) {
    console.error('No existe la cuenta «' + usuario + '».');
    process.exit(1);
  }
  const hash = await auth.hashear(clave);
  db.get().prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(hash, u.id);
  try {
    db.get().prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(u.id);
  } catch (_) { /* tabla aún no existe en bases muy viejas */ }
  console.log('Clave actualizada para «' + u.usuario + '». Entra de nuevo.');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
