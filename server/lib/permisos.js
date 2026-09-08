'use strict';

function publico(usuario) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    iniciales: usuario.iniciales,
    rol: usuario.rol,
    activo: !!usuario.activo,
    alta: usuario.alta,
    mfa_activo: !!usuario.mfa_activo
  };
}

function exigirSesion(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Tienes que entrar primero.' });
  }
  next();
}

function exigirAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Tienes que entrar primero.' });
  }
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Esto solo lo puede hacer un administrador.' });
  }
  next();
}

/** Un usuario normal solo ve sus horas. El admin ve las de todo el equipo
 *  en los proyectos que él mismo puede ver: un proyecto sin compartir
 *  no lo ve nadie más, ni el administrador. */
function puedeVerHorasDe(actor, usuarioId) {
  if (!actor) return false;
  if (actor.rol === 'admin') return true;
  return Number(actor.id) === Number(usuarioId);
}

function idsProyectosVisibles(actor, base) {
  if (!actor) return [];
  const dbx = base || require('../db').get();
  return dbx.prepare(`
    SELECT p.id FROM proyectos p WHERE p.dueno = ?
    UNION
    SELECT proyecto_id AS id FROM proyecto_equipo WHERE usuario_id = ?
  `).all(actor.id, actor.id).map(r => r.id);
}

function puedeVerProyecto(actor, proyecto, base) {
  if (!actor || proyecto == null) return false;
  const dbx = base || require('../db').get();
  const p = typeof proyecto === 'object'
    ? proyecto
    : dbx.prepare('SELECT * FROM proyectos WHERE id = ?').get(Number(proyecto));
  if (!p) return false;
  if (Number(p.dueno) === Number(actor.id)) return true;
  const fila = dbx.prepare(
    'SELECT 1 FROM proyecto_equipo WHERE proyecto_id = ? AND usuario_id = ?'
  ).get(p.id, actor.id);
  return !!fila;
}

module.exports = {
  publico, exigirSesion, exigirAdmin, puedeVerHorasDe,
  idsProyectosVisibles, puedeVerProyecto
};
