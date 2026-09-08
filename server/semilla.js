'use strict';

/**
 * Primera arrancada: Álvaro y Jesús (admin) + un proyecto interno vacío.
 * Sin horas ni tareas de mentira. La clave demo se cambia en el estudio.
 */

const db = require('./db');
const { hashear, logea } = require('./auth');
const { aplicarPlantillaEstudio, sembrarFlujos, asegurarPersonales } = require('./produccion/plantilla');

const CLAVE_DEMO = '1234';

const USUARIOS = [
  { usuario: 'alvaro', nombre: 'Álvaro Fernández', iniciales: 'AF', rol: 'admin', alta: '2025-01-13' },
  { usuario: 'jesus', nombre: 'Jesús', iniciales: 'JS', rol: 'admin', alta: '2026-09-08' }
];

const COLUMNAS = [
  { clave: 'titulo', nombre: 'Escena', tipo: 'titulo', visible: 1, ancho: 300, propia: 0, orden: 0 },
  { clave: 'estado', nombre: 'Estado', tipo: 'estado', visible: 1, ancho: 132, propia: 0, orden: 1 },
  { clave: 'asignado', nombre: 'Asignado', tipo: 'persona', visible: 1, ancho: 190, propia: 0, orden: 2 },
  { clave: 'prioridad', nombre: 'Prioridad', tipo: 'prio', visible: 1, ancho: 122, propia: 0, orden: 3 },
  { clave: 'fin', nombre: 'Entrega', tipo: 'fecha', visible: 1, ancho: 150, propia: 0, orden: 4 },
  { clave: 'horas', nombre: 'Horas', tipo: 'horas', visible: 1, ancho: 95, propia: 0, orden: 5 },
  { clave: 'bloque', nombre: 'Carpeta', tipo: 'bloque', visible: 0, ancho: 200, propia: 0, orden: 6 },
  { clave: 'proyecto', nombre: 'Proyecto', tipo: 'proyecto', visible: 0, ancho: 185, propia: 0, orden: 7 },
  { clave: 'coments', nombre: 'Comentarios', tipo: 'coments', visible: 0, ancho: 125, propia: 0, orden: 8 },
  { clave: 'c_material', nombre: 'Material', tipo: 'etiqueta', visible: 1, ancho: 160, propia: 1, orden: 9,
    opciones: JSON.stringify([{ v: 'Sin material', c: '#e34948' }, { v: 'Ingestado', c: '#eda100' }, { v: 'Sincronizado', c: '#1baf7a' }]) },
  { clave: 'c_dur', nombre: 'Duración (min)', tipo: 'numero', visible: 1, ancho: 125, propia: 1, orden: 10 },
  { clave: 'c_visto', nombre: 'Visto dirección', tipo: 'casilla', visible: 0, ancho: 140, propia: 1, orden: 11 }
];

async function sembrarSiVacia() {
  const base = db.get();
  const n = base.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  if (n > 0) return { sembrado: false };

  const hashAlvaro = await hashear(process.env.CLAVE_ALVARO || CLAVE_DEMO);
  const hashJesus = await hashear(CLAVE_DEMO);
  const insU = base.prepare(
    'INSERT INTO usuarios (usuario, nombre, iniciales, rol, activo, alta, hash) VALUES (?, ?, ?, ?, 1, ?, ?)'
  );
  for (const u of USUARIOS) {
    insU.run(u.usuario, u.nombre, u.iniciales, u.rol, u.alta, u.usuario === 'alvaro' ? hashAlvaro : hashJesus);
  }

  const proy = base.prepare(`
    INSERT INTO proyectos (nombre, cliente, formato, estado, horas_presupuestadas, fecha_entrega, minutos_programa, versiones, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('Interno', 'La Corte', 'Interno', 'curso', 0, null, 0, 0, 0);
  const proyId = proy.lastInsertRowid;
  const insE = base.prepare('INSERT INTO proyecto_equipo (proyecto_id, usuario_id) VALUES (?, ?)');
  insE.run(proyId, 1);
  insE.run(proyId, 2);

  aplicarPlantillaEstudio(base, proyId);
  base.prepare('UPDATE proyectos SET dueno = 1, personal = 0 WHERE id = ?').run(proyId);
  sembrarFlujos(base);
  asegurarPersonales(base);

  const insCol = base.prepare(
    'INSERT INTO columnas (clave, nombre, tipo, opciones, visible, ancho, propia, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const c of COLUMNAS) {
    insCol.run(c.clave, c.nombre, c.tipo, c.opciones || null, c.visible, c.ancho, c.propia, c.orden);
  }

  base.prepare("INSERT INTO ajustes (clave, valor) VALUES ('mfa_obligatorio', '0')").run();
  base.prepare("INSERT INTO ajustes (clave, valor) VALUES ('tarifas', ?)").run(JSON.stringify({
    gestion: 45, asis: 28, montaje: 42
  }));

  logea('Sistema', 'Base lista: administradores y proyecto Interno. Cambia las claves al entrar.');
  return { sembrado: true };
}

module.exports = { sembrarSiVacia, CLAVE_DEMO };
