'use strict';

/**
 * Arranque del servidor. Hace tres cosas:
 *  1. Lee el .env (puerto, secreto de sesión, dónde está la base).
 *  2. Abre SQLite y, si está vacía, mete los datos de ejemplo.
 *  3. Sirve la web y la API en el mismo puerto: el navegador no necesita internet.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

cargarEnv(path.join(__dirname, '..', '.env'));

const db = require('./db');
const auth = require('./auth');
const { sembrarSiVacia } = require('./semilla');

const PUERTO = Number(process.env.PUERTO) || 3000;
const RAIZ = path.join(__dirname, '..');

function cargarEnv(archivo) {
  if (!fs.existsSync(archivo)) return;
  const texto = fs.readFileSync(archivo, 'utf8');
  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

function asegurarSecretoSesion() {
  const placeholder = 'cambia-esta-frase-por-una-aleatoria-larga';
  const actual = String(process.env.SESSION_SECRET || '').trim();
  if (actual && actual !== placeholder) return;
  const dbRuta = process.env.RUTA_DB || path.join(__dirname, '..', 'data', 'fichaje.db');
  const carpeta = path.dirname(path.resolve(dbRuta));
  const archivo = path.join(carpeta, 'session.secret');
  try {
    if (fs.existsSync(archivo)) {
      const guardado = fs.readFileSync(archivo, 'utf8').trim();
      if (guardado) {
        process.env.SESSION_SECRET = guardado;
        return;
      }
    }
  } catch { /* se genera uno nuevo */ }
  const secreto = require('crypto').randomBytes(32).toString('hex');
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(archivo, secreto, { encoding: 'utf8', mode: 0o600 });
  process.env.SESSION_SECRET = secreto;
}

async function main() {
  asegurarSecretoSesion();
  db.abrir();
  const semilla = await sembrarSiVacia();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /* Estilos siguen en el HTML. Los scripts de cada módulo se sirven
     desde /prototipo/js (nucleo, fichaje, produccion, puente). */
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", 'blob:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    xDownloadOptions: false
  }));
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: false, limit: '3mb' }));
  app.use(auth.exigirMismoOrigen);
  app.use(auth.middlewareSesion);

  /* Informe: el cliente manda el archivo y el servidor responde como adjunto.
     Es la vía más simple: un POST normal de formulario, sin blob ni iframe. */
  app.post('/exportar', (req, res) => {
    const nombre = String(req.body.nombre || 'informe.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const tipo = req.body.tipo === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf';
    let buf;
    try { buf = Buffer.from(String(req.body.cuerpo || '').replace(/\s/g, ''), 'base64'); }
    catch { return res.status(400).send('Archivo inválido.'); }
    if (!buf.length || buf.length > 2_000_000) return res.status(400).send('El archivo está vacío o es demasiado grande.');
    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  });

  app.get('/api/salud', (req, res) => {
    let usuarios = 0;
    try { usuarios = db.get().prepare('SELECT COUNT(*) AS n FROM usuarios').get().n; } catch { /* vacía */ }
    res.json({
      ok: true,
      app: 'La Corte Fichaje',
      db: db.rutaDb(),
      usuarios,
      semilla_recien: !!semilla.sembrado
    });
  });

  /* Núcleo: cuentas y cartera. Fichaje: horas. Producción: escenas.
     Las rutas cortas (/api/entradas, etc.) se quedan por compatibilidad. */
  app.use('/api/nucleo/acceso', require('./nucleo/acceso'));
  app.use('/api/nucleo/usuarios', require('./nucleo/usuarios'));
  app.use('/api/nucleo/proyectos', require('./nucleo/proyectos'));
  app.use('/api/administracion/usuarios', require('./administracion/usuarios'));
  app.use('/api/fichaje/entradas', require('./fichaje/entradas'));
  app.use('/api/fichaje/informes', require('./fichaje/informes'));
  app.use('/api/produccion/escenas', require('./produccion/escenas'));
  app.use('/api/acceso', require('./nucleo/acceso'));
  app.use('/api/usuarios', require('./administracion/usuarios'));
  app.use('/api/proyectos', require('./nucleo/proyectos'));
  app.use('/api/tareas', require('./produccion/escenas'));
  app.use('/api/entradas', require('./fichaje/entradas'));
  app.use('/api/informes', require('./fichaje/informes'));

  app.use('/prototipo/js', express.static(path.join(RAIZ, 'prototipo', 'js'), { maxAge: 0 }));
  app.use('/prototipo/img', express.static(path.join(RAIZ, 'prototipo', 'img'), { maxAge: 0 }));

  const htmlPrototipo = path.join(RAIZ, 'prototipo', 'lacorte-fichaje-prototipo.html');
  const servirPrototipo = (req, res) => res.sendFile(htmlPrototipo);

  /* La interfaz que ya tenías es la pantalla principal.
     /prototype y /prototipo apuntan al mismo archivo. */
  app.get('/', servirPrototipo);
  app.get('/prototype', servirPrototipo);
  app.get('/prototipo', servirPrototipo);
  app.get('/prototipo/', servirPrototipo);
  app.get('/prototype/', servirPrototipo);

  app.use('/servidor', express.static(path.join(RAIZ, 'web'), { maxAge: 0 }));

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Esa ruta no existe.' });
    }
    servirPrototipo(req, res);
  });

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Ha fallado el servidor. Mira el registro del NAS.' });
  });

  const server = app.listen(PUERTO, '0.0.0.0', () => {
    console.log(`La Corte Fichaje escuchando en http://localhost:${PUERTO}`);
    console.log(`Base de datos: ${db.rutaDb()}`);
    if (semilla.sembrado) {
      console.log('Primera arrancada: hay cuentas de administrador. Las claves no se publican; cámbialas al entrar.');
    }
  });

  const parar = () => {
    server.close(() => {
      db.cerrar();
      process.exit(0);
    });
  };
  process.on('SIGINT', parar);
  process.on('SIGTERM', parar);
}

main().catch(err => {
  console.error('No se ha podido arrancar:', err);
  process.exit(1);
});
