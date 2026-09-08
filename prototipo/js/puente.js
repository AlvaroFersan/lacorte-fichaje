/* puente.js
   UNICO sitio donde Fichaje y Producción se hablan.
   Fichaje no lee TAREAS. Producción no lee ENTRADAS.
   Los dos llaman a LC.puente. */
window.LC = window.LC || {};

LC.puente = {
  usuarios: function(){
    return (LC.nucleo && LC.nucleo.usuarios) ? LC.nucleo.usuarios() : [];
  },
  usuario: function(id){
    return (LC.nucleo && LC.nucleo.usuario) ? LC.nucleo.usuario(id) : null;
  },
  proyectos: function(){
    return (LC.nucleo && LC.nucleo.proyectos) ? LC.nucleo.proyectos() : [];
  },
  proyecto: function(id){
    return (LC.nucleo && LC.nucleo.proyecto) ? LC.nucleo.proyecto(id) : null;
  },
  categorias: function(){
    return (LC.nucleo && LC.nucleo.categorias) ? LC.nucleo.categorias() : [];
  },
  estados: function(){
    return (LC.nucleo && LC.nucleo.estados) ? LC.nucleo.estados() : {};
  },
  ajustes: function(){
    return (LC.nucleo && LC.nucleo.ajustes) ? LC.nucleo.ajustes() : {};
  },
  solicitudes: function(){
    return (LC.nucleo && LC.nucleo.solicitudes) ? LC.nucleo.solicitudes() : [];
  },
  actividad: function(){
    return (LC.nucleo && LC.nucleo.actividad) ? LC.nucleo.actividad() : [];
  },
  altaUsuario: function(nom, user, rol){
    return (LC.nucleo && LC.nucleo.altaUsuario) ? LC.nucleo.altaUsuario(nom, user, rol) : {error:'Núcleo no está listo.'};
  },
  resetUsuario: function(id, motivo){
    return (LC.nucleo && LC.nucleo.resetUsuario) ? LC.nucleo.resetUsuario(id, motivo) : null;
  },
  cambiarRol: function(id){
    return (LC.nucleo && LC.nucleo.cambiarRol) ? LC.nucleo.cambiarRol(id) : null;
  },
  cambiarActivo: function(id){
    return (LC.nucleo && LC.nucleo.cambiarActivo) ? LC.nucleo.cambiarActivo(id) : null;
  },
  quitarMfa: function(id){
    return (LC.nucleo && LC.nucleo.quitarMfa) ? LC.nucleo.quitarMfa(id) : null;
  },
  resolverSolicitud: function(id){
    return (LC.nucleo && LC.nucleo.resolverSolicitud) ? LC.nucleo.resolverSolicitud(id) : null;
  },
  descartarSolicitud: function(id){
    return (LC.nucleo && LC.nucleo.descartarSolicitud) ? LC.nucleo.descartarSolicitud(id) : null;
  },
  setMfaObligatorio: function(v){
    return (LC.nucleo && LC.nucleo.setMfaObligatorio) ? LC.nucleo.setMfaObligatorio(v) : false;
  },
  actualizarProyecto: function(id, patch){
    return (LC.nucleo && LC.nucleo.actualizarProyecto) ? LC.nucleo.actualizarProyecto(id, patch) : null;
  },
  entradasProyecto: function(proyId){
    return (LC.fichaje && LC.fichaje.entradasProyecto) ? LC.fichaje.entradasProyecto(proyId) : [];
  },
  entradasUsuario: function(userId, desde){
    return (LC.fichaje && LC.fichaje.entradasUsuario) ? LC.fichaje.entradasUsuario(userId, desde) : [];
  },
  entradasDesde: function(desde){
    return (LC.fichaje && LC.fichaje.entradasDesde) ? LC.fichaje.entradasDesde(desde) : [];
  },
  escenasDe: function(proyId){
    return (LC.produccion && LC.produccion.escenasDe) ? LC.produccion.escenasDe(proyId) : [];
  },
  horasDeEscena: function(tareaId){
    return (LC.fichaje && LC.fichaje.horasDeEscena) ? LC.fichaje.horasDeEscena(tareaId) : 0;
  },
  registrosDeEscena: function(tareaId){
    return (LC.fichaje && LC.fichaje.registrosDeEscena) ? LC.fichaje.registrosDeEscena(tareaId) : [];
  },
  desenlazarEscena: function(tareaId){
    if(LC.fichaje && LC.fichaje.desenlazarEscena) LC.fichaje.desenlazarEscena(tareaId);
  }
};
