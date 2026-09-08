'use strict';

/**
 * Abre (o crea) el archivo SQLite y deja las tablas listas.
 * SQLite es un solo archivo: se copia entero y ya tienes la copia de seguridad.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db;

function rutaDb() {
  return process.env.RUTA_DB || path.join(__dirname, '..', 'data', 'fichaje.db');
}

function abrir() {
  if (db) return db;
  const archivo = rutaDb();
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  db = new Database(archivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrar(db);
  return db;
}

function migrar(base) {
  base.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nombre        TEXT NOT NULL,
      iniciales     TEXT NOT NULL,
      rol           TEXT NOT NULL CHECK (rol IN ('admin','usuario')),
      activo        INTEGER NOT NULL DEFAULT 1,
      alta          TEXT NOT NULL,
      hash          TEXT NOT NULL,
      mfa_secreto   TEXT,
      mfa_activo    INTEGER NOT NULL DEFAULT 0,
      reset_hash    TEXT,
      reset_caduca  INTEGER
    );

    CREATE TABLE IF NOT EXISTS codigos_recuperacion (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      hash        TEXT NOT NULL,
      usado       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      id           TEXT PRIMARY KEY,
      usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      creada       INTEGER NOT NULL,
      ultimo_uso   INTEGER NOT NULL,
      caduca       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mfa_pendiente (
      ticket      TEXT PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      caduca      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proyectos (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre               TEXT NOT NULL,
      cliente              TEXT NOT NULL DEFAULT '',
      formato              TEXT NOT NULL DEFAULT 'Interno',
      estado               TEXT NOT NULL DEFAULT 'curso'
                           CHECK (estado IN ('curso','entregado','pausa')),
      horas_presupuestadas REAL NOT NULL DEFAULT 0,
      fecha_entrega        TEXT,
      minutos_programa     REAL NOT NULL DEFAULT 0,
      versiones            INTEGER NOT NULL DEFAULT 0,
      color                INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS proyecto_equipo (
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      PRIMARY KEY (proyecto_id, usuario_id)
    );

    CREATE TABLE IF NOT EXISTS carpetas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id  INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      nombre       TEXT NOT NULL,
      padre_id     INTEGER REFERENCES carpetas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS escenas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id    INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      carpeta_id     INTEGER REFERENCES carpetas(id) ON DELETE SET NULL,
      titulo         TEXT NOT NULL,
      notas          TEXT NOT NULL DEFAULT '',
      asignado_a     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      estado         TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','curso','revision','hecha')),
      prioridad      TEXT NOT NULL DEFAULT 'media'
                     CHECK (prioridad IN ('alta','media','baja')),
      fecha_entrega  TEXT,
      creador        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      creada         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subtareas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      escena_id  INTEGER NOT NULL REFERENCES escenas(id) ON DELETE CASCADE,
      texto      TEXT NOT NULL,
      hecha      INTEGER NOT NULL DEFAULT 0,
      orden      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comentarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      escena_id   INTEGER NOT NULL REFERENCES escenas(id) ON DELETE CASCADE,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha       INTEGER NOT NULL,
      texto       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS columnas (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      clave     TEXT NOT NULL UNIQUE,
      nombre    TEXT NOT NULL,
      tipo      TEXT NOT NULL,
      opciones  TEXT,
      visible   INTEGER NOT NULL DEFAULT 1,
      ancho     INTEGER NOT NULL DEFAULT 140,
      propia    INTEGER NOT NULL DEFAULT 0,
      orden     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS valores_columna (
      escena_id   INTEGER NOT NULL REFERENCES escenas(id) ON DELETE CASCADE,
      columna_id  INTEGER NOT NULL REFERENCES columnas(id) ON DELETE CASCADE,
      valor       TEXT,
      PRIMARY KEY (escena_id, columna_id)
    );

    CREATE TABLE IF NOT EXISTS entradas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      proyecto_id  INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      escena_id    INTEGER REFERENCES escenas(id) ON DELETE SET NULL,
      categoria    TEXT NOT NULL CHECK (categoria IN ('gestion','asis','montaje')),
      descripcion  TEXT NOT NULL DEFAULT '',
      inicio       INTEGER NOT NULL,
      fin          INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS avisos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      texto       TEXT NOT NULL,
      escena_id   INTEGER REFERENCES escenas(id) ON DELETE CASCADE,
      fecha       INTEGER NOT NULL,
      leido       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS solicitudes_password (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha       INTEGER NOT NULL,
      mensaje     TEXT NOT NULL DEFAULT '',
      estado      TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','atendida','cancelada'))
    );

    CREATE TABLE IF NOT EXISTS registro_actividad (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha   INTEGER NOT NULL,
      quien   TEXT NOT NULL,
      accion  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ajustes (
      clave  TEXT PRIMARY KEY,
      valor  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entradas_usuario ON entradas(usuario_id, inicio);
    CREATE INDEX IF NOT EXISTS idx_entradas_proyecto ON entradas(proyecto_id, inicio);
    CREATE INDEX IF NOT EXISTS idx_entradas_escena ON entradas(escena_id);
    CREATE INDEX IF NOT EXISTS idx_escenas_proyecto ON escenas(proyecto_id, carpeta_id);
    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_avisos_usuario ON avisos(usuario_id, leido);
  `);
  try {
    base.prepare("UPDATE columnas SET nombre = 'Asignado' WHERE clave = 'asignado' AND nombre = 'Responsable'").run();
  } catch { /* tabla aún vacía */ }
}

function get() {
  return abrir();
}

function cerrar() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { abrir, get, cerrar, rutaDb };
