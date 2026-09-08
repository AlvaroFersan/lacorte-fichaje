/* tema.js
   Claro, oscuro o el del sistema. Se carga en <head>, antes de que se pinte
   nada, para que al entrar no se vea un fogonazo del tema equivocado.
   No depende de ningún otro módulo: es el primer script de la app. */
(function(){
  'use strict';
  var CLAVE = 'lc_tema';                 /* sistema | claro | oscuro */
  var raiz = document.documentElement;

  function leer(){
    try {
      var v = localStorage.getItem(CLAVE);
      return (v === 'claro' || v === 'oscuro') ? v : 'sistema';
    } catch(_){ return 'sistema'; }     /* navegador con el almacenamiento cerrado */
  }

  /* «sistema» no pone atributo: así manda la media query y nada más. */
  function aplicar(t){
    if(t === 'sistema') raiz.removeAttribute('data-tema');
    else raiz.setAttribute('data-tema', t);
  }

  var actual = leer();
  aplicar(actual);

  window.LC = window.LC || {};
  window.LC.tema = {
    actual: function(){ return actual; },
    poner: function(t){
      actual = (t === 'claro' || t === 'oscuro') ? t : 'sistema';
      aplicar(actual);
      try { localStorage.setItem(CLAVE, actual); } catch(_){}
      return actual;
    },
    /* Lo que se está viendo de verdad ahora mismo, resuelto el «sistema». */
    efectivo: function(){
      if(actual !== 'sistema') return actual;
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    }
  };
})();
