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

/** Un usuario normal solo ve sus horas. El admin ve las de todo el equipo. */
function puedeVerHorasDe(actor, usuarioId) {
  if (!actor) return false;
  if (actor.rol === 'admin') return true;
  return Number(actor.id) === Number(usuarioId);
}

module.exports = { publico, exigirSesion, exigirAdmin, puedeVerHorasDe };
