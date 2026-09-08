'use strict';

/* Reloj del proceso: el NAS, el PC o el contenedor. No hay huso fijo
   (ni Madrid ni Bogotá). Un instante viaja en milisegundos; un día de
   calendario YYYY-MM-DD sale de getFullYear/getMonth/getDate locales.
   Si el cliente manda desfase (Date#getTimezoneOffset), se formatea
   en el reloj de esa persona — México, Colombia o España. */

function pad(n) {
  return String(n).padStart(2, '0');
}

function fechaISOLocal(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(+x)) return '';
  return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
}

function esFechaISO(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

/** desfaseMin = Date#getTimezoneOffset() del navegador. */
function partesEnDesfase(ms, desfaseMin) {
  const offset = Number.isFinite(Number(desfaseMin))
    ? Number(desfaseMin)
    : new Date(ms).getTimezoneOffset();
  const local = new Date(Number(ms) - offset * 60000);
  return {
    fecha: local.getUTCFullYear() + '-' + pad(local.getUTCMonth() + 1) + '-' + pad(local.getUTCDate()),
    hora: pad(local.getUTCHours()) + ':' + pad(local.getUTCMinutes()) + ':' + pad(local.getUTCSeconds())
  };
}

module.exports = { fechaISOLocal, esFechaISO, partesEnDesfase };
