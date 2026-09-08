/* asistente.js
   Un buscador que entiende preguntas escritas a mano y responde con la
   respuesta y el botón que te deja allí. Se abre con Ctrl+K.

   No hay modelo de lenguaje: el NAS no tiene salida a internet y la CSP solo
   deja cargar scripts del propio servidor. Lo que hay es un índice —la guía de
   uso, escrita a mano, más tus datos reales— y un emparejador por palabras que
   tolera acentos, plurales y sinónimos. Es instantáneo y siempre da la misma
   respuesta a la misma pregunta, que en una herramienta de oficina vale más
   que una que improvisa.

   Este módulo solo LEE. No cambia horas ni tareas: navega. */
window.LC = window.LC || {};

/* ---------- normalización: «¿Cómo fichó?» y «como ficho» son lo mismo ---------- */
const asNorm = s => String(s == null ? '' : s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();

/* Palabras que no aportan nada al emparejar; se descartan de la consulta. */
const AS_VACIAS = new Set(('de del la el los las un una unos unas y o a en con por para que se me mi mis tu tus su sus lo al es son como donde cuando cual cuales quien hago hacer puedo como se hace esta estan hay')
  .split(' '));

/* Lo que la gente escribe para pedir algo, no para nombrarlo. Fuera también. */
('llevame lleva llevar abre abrir abre ver muestra muestrame ensename ir vamos voy '
 + 'quiero necesito busca buscar encuentra dime sirve pon poner').split(' ')
  .forEach(w => AS_VACIAS.add(w));

/* Sinónimos del estudio: lo que teclea la gente -> lo que dice la app. */
const AS_SINONIMOS = {
  fichar:'fichaje hora', fiche:'fichaje', fichado:'fichaje',
  hora:'horas fichaje', jornada:'horas dia fichaje', parte:'informe horas',
  reloj:'cronometro', crono:'cronometro', temporizador:'cronometro',
  tarea:'tarea trabajo', tareas:'tarea', escena:'tarea', escenas:'tarea',
  plano:'tarea', secuencia:'tarea', chapuza:'tarea',
  carpeta:'carpeta bloque', directorio:'carpeta', folder:'carpeta',
  cliente:'proyecto cliente', peli:'proyecto', pelicula:'proyecto',
  contrasena:'contrasena clave acceso', clave:'contrasena', password:'contrasena',
  '2fa':'doble factor verificacion dos pasos', mfa:'doble factor verificacion dos pasos',
  otp:'doble factor codigo', totp:'doble factor codigo',
  csv:'exportar informe', pdf:'exportar informe', excel:'exportar csv',
  presupuesto:'presupuesto horas desviacion',
  color:'color tema estados', modo:'tema', oscuro:'tema oscuro', claro:'tema claro',
  gente:'personas equipo usuarios', usuario:'personas equipo cuenta',
  entrega:'entrega fecha', deadline:'entrega fecha', vencida:'entrega vencida',
  copia:'copia seguridad datos nas', backup:'copia seguridad datos nas',
  borrar:'borrar eliminar quitar', eliminar:'borrar', quitar:'borrar',
  creo:'crear', creas:'crear', crea:'crear', hago:'crear hacer', hacer:'crear',
  anado:'anadir crear', pongo:'poner anadir', cambio:'cambiar', cambiar:'cambiar',
  exporto:'exportar', activo:'activar', asigno:'asignar', muevo:'mover',
  apunto:'anotar apuntar', anoto:'anotar', meto:'anotar anadir'
};

/* Raíz basta: «olvidada» y «olvidado» son la misma palabra para buscar, y
   «horas» y «hora» también. No es un lematizador, y no le hace falta. */
const asRaiz = w => w.length > 4 ? w.replace(/(ciones|cion|es|as|os|a|o|s)$/, '') : w;
const asRaices = txt => asNorm(txt).split(' ').filter(Boolean).map(asRaiz);

/* Cada palabra de la pregunta es un grupo: ella y sus sinónimos. Vale con que
   acierte uno del grupo; así los sinónimos ayudan y nunca estorban. */
function asGrupos(txt){
  const vistos = new Set();
  const grupos = [];
  asNorm(txt).split(' ').filter(Boolean).forEach(t => {
    if (t.length < 2 || AS_VACIAS.has(t) || vistos.has(t)) return;
    vistos.add(t);
    const g = [asRaiz(t)];
    if (AS_SINONIMOS[t]) asRaices(AS_SINONIMOS[t]).forEach(r => { if (!g.includes(r)) g.push(r); });
    grupos.push(g);
  });
  return grupos;
}

/* ---------- la guía: cómo funciona la app, escrita para el estudio ---------- */
/* t = titular · k = por dónde se busca · r = la respuesta · ir = a dónde lleva */
const AS_GUIA = [
  {t:'Fichar con el cronómetro', k:'cronometro play empezar arrancar contar tiempo trabajando ahora',
   r:'En Hoy, escribe en qué estás trabajando, elige proyecto y tipo, y dale al play. Al pararlo el registro se guarda solo.',
   ir:{mod:'fichaje', vista:'fichaje'}},
  {t:'Anotar horas de un día pasado', k:'ayer anterior olvide olvido manual mano atrasado retroactivo añadir horas',
   r:'En Hoy, abajo del todo, despliega «Añadir a mano»: pones fecha, de qué hora a qué hora, proyecto y tipo.',
   ir:{mod:'fichaje', vista:'fichaje'}},
  {t:'Anotar arrastrando en el calendario', k:'calendario arrastrar pintar hueco bloque crear rango semana',
   r:'En Calendario, arrastra de arriba abajo sobre el hueco de la hora. Al soltar se abre la ficha para poner proyecto, tipo y descripción.',
   ir:{mod:'fichaje', vista:'calendario'}},
  {t:'Mover o alargar un bloque del calendario', k:'mover alargar estirar cambiar hora bloque arrastrar borde redimensionar',
   r:'Arrastra el bloque para cambiarlo de hora o de día. Arrastra su borde de arriba o de abajo para alargarlo. Se imanta cada 15 minutos.',
   ir:{mod:'fichaje', vista:'calendario'}},
  {t:'Copiar y pegar un fichaje', k:'copiar pegar duplicar repetir mismo ctrl c v boton derecho clonar',
   r:'Selecciona un bloque y usa Ctrl+C / Ctrl+V, o el botón derecho. Al pegar conserva proyecto, tipo, descripción y duración; solo cambia el día y la hora.',
   ir:{mod:'fichaje', vista:'calendario'}},
  {t:'Corregir o borrar un registro', k:'corregir editar cambiar borrar equivocado error deshacer registro entrada',
   r:'Pulsa la descripción en la lista de Hoy, o el bloque en el Calendario. Para borrar, el icono de papelera de la fila; sale un aviso con «Deshacer».',
   ir:{mod:'fichaje', vista:'fichaje'}},
  {t:'Qué son gestión, asistencia de montaje y montaje', k:'tipo trabajo categoria funcion gestion asistencia montaje colores significa',
   r:'Son los tres tipos de trabajo del estudio y cada uno tiene su color fijo: gestión en azul, asistencia de montaje en naranja, montaje en verde. Es lo que divide las barras, donuts e informes de tiempo.',
   ir:{mod:'fichaje', vista:'informes'}},
  {t:'Ver mis horas de la semana', k:'cuantas horas llevo semana total resumen hoy mias reparto',
   r:'La franja de arriba en Hoy: total del día, total de la semana comparado con la anterior, y el reparto por tipo de trabajo.',
   ir:{mod:'fichaje', vista:'fichaje'}},
  {t:'El aviso «!» de un bloque', k:'solape solapa aviso exclamacion rojo choca pisa dos veces',
   r:'Significa que ese registro se pisa con otro tuyo a la misma hora. No lo bloquea, pero conviene arreglarlo antes de cerrar el parte.',
   ir:{mod:'fichaje', vista:'calendario'}},
  {t:'Exportar las horas a CSV o PDF', k:'exportar csv pdf descargar informe parte enviar gestoria excel',
   r:'En Informes, elige el rango y los filtros y usa «Exportar CSV» o «Exportar PDF». Sale lo que estás viendo.',
   ir:{mod:'fichaje', vista:'informes'}},
  {t:'Cambiar el rango del informe', k:'rango periodo 7 14 30 dias filtro fecha persona proyecto',
   r:'Los botones 7 / 14 / 30 días arriba de Informes. Es tu informe personal; al lado solo filtras por proyecto.',
   ir:{mod:'fichaje', vista:'informes'}},

  {t:'Crear una tarea', k:'crear nueva tarea tarea añadir alta plano trabajo produccion',
   r:'En Tareas, la barra de abajo: deja el tipo en «Tarea», escribe el nombre y pulsa Añadir. También con el botón derecho sobre una carpeta, «Nueva tarea aquí».',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Crear una carpeta', k:'crear carpeta nueva organizar clasificar bloque estructura',
   r:'En Tareas, cambia el tipo de la barra de abajo a «Carpeta» y escribe el nombre. Puedes arrastrar tareas dentro y anidar carpetas.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Crear un proyecto', k:'crear proyecto nuevo alta pelicula documental cliente',
   r:'En Producción, el «+» junto a Proyectos en la barra lateral. Nace con su estructura de carpetas y con sus estados.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Vista Árbol y vista Agrupada', k:'arbol agrupada vista tabla cambiar jerarquia agrupar por',
   r:'Árbol enseña las carpetas con sus tareas dentro. Agrupada las junta por estado, persona o proyecto, ignorando las carpetas. Se cambia arriba a la derecha.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Añadir o quitar columnas', k:'columnas campos añadir quitar personalizar tabla ancho ordenar',
   r:'El botón «Columnas» arriba a la derecha de Tareas. Desde ahí se activan, se desactivan y se crean nuevas. Se pueden arrastrar para reordenar y estirar por el borde.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Mover tareas de estado', k:'estado mover tablero arrastrar pendiente curso revision hecha kanban',
   r:'En Tareas, cambia a vista Tablero y arrastra la tarjeta a la columna que toque. También puedes cambiarlo desde la columna Estado de la tabla o desde la ficha de la tarea.',
   ir:{mod:'produccion', vista:'tablero'}},
  {t:'Asignar una tarea a alguien', k:'asignar asignado responsable persona quien encargado repartir',
   r:'En la columna «Asignado» de la tabla, o en la ficha de la tarea. Lo que te asignes a ti aparece en Mis tareas.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Mis tareas', k:'mis tareas mias asignadas pendientes lo mio que tengo que hacer',
   r:'Todo lo que tienes asignado, de todos los proyectos, ordenado por entrega. Las vencidas salen en rojo.',
   ir:{mod:'produccion', vista:'mistareas'}},
  {t:'Cambiar los estados y sus colores', k:'estados flujo personalizar color crear estado renombrar workflow',
   r:'En Estados. Cada proyecto puede tener su propio flujo: se crean, se renombran, se les pone color y se ordenan.',
   ir:{mod:'produccion', vista:'flujos'}},
  {t:'Adjuntar un archivo a una tarea', k:'adjuntar archivo adjunto subir documento imagen pdf guion referencia',
   r:'Abre la tarea y arrastra el archivo a su ficha. Se guarda en el NAS con el proyecto y se puede ver sin descargarlo.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Invitar a alguien a un proyecto', k:'invitar compartir dar acceso equipo colaborador añadir persona proyecto',
   r:'El botón «Invitar» al final de la barra lateral en Producción. Eliges a quién y a qué proyecto.',
   ir:{mod:'produccion', vista:'tabla'}},
  {t:'Compartido conmigo', k:'compartido conmigo invitado ajeno otros proyectos me han invitado',
   r:'En la barra lateral de Producción, debajo de tus proyectos: los que no son tuyos pero en los que estás.',
   ir:{mod:'produccion', vista:'tabla'}},

  {t:'Cambiar mi contraseña', k:'cambiar contrasena clave nueva mi cuenta perfil segura',
   r:'Pulsa tu nombre abajo a la izquierda para abrir «Mi cuenta» y luego «Cambiar». Necesitas la actual.',
   accion:'cuenta'},
  {t:'Activar el doble factor', k:'doble factor dos pasos 2fa mfa autenticacion qr google authenticator activar seguridad',
   r:'En «Mi cuenta», fila de verificación en dos pasos, «Activar». Escaneas el QR con tu app y guardas los códigos de recuperación que salen.',
   accion:'cuenta'},
  {t:'He perdido el móvil del doble factor', k:'perdido movil telefono recuperacion codigos entrar sin movil roto',
   r:'Usa uno de los códigos de recuperación que guardaste al activarlo: en la pantalla del código, «Usar código de recuperación». Cada uno vale una vez. Si no te queda ninguno, un administrador te quita el doble factor.',
   accion:null},
  {t:'He olvidado la contraseña', k:'olvide olvidado contrasena no puedo entrar acceso bloqueado recuperar',
   r:'En la pantalla de acceso, «He olvidado mi contraseña»: avisa al administrador. Él te da un código LC-XXXX-XXXX y con él eliges tú una nueva. Nadie, ni el administrador, puede leer la tuya.',
   accion:null},
  {t:'Dar de alta a alguien', k:'alta nuevo usuario crear cuenta persona equipo admin registrar contratar',
   r:'En Equipo, pestaña Cuentas, «Dar de alta». Se crea sin contraseña: sale un código para que esa persona elija la suya.',
   ir:{mod:'fichaje', vista:'equipo'}, tab:'cuentas', admin:true},
  {t:'Restablecer la contraseña de alguien', k:'restablecer resetear contrasena otro usuario codigo admin ayudar',
   r:'En Equipo, pestaña Cuentas, «Restablecer contraseña» en su fila. Sale un código que caduca en 24 horas; dáselo en mano.',
   ir:{mod:'fichaje', vista:'equipo'}, tab:'cuentas', admin:true},
  {t:'Presupuesto y desviación de un proyecto', k:'presupuesto horas presupuestadas desviacion pasado consumido control gasto',
   r:'En Proyectos, pulsa la fila del proyecto. Abajo pones las horas previstas y la fecha de entrega, y arriba ves el consumo y cuánto te has desviado en tiempo.',
   ir:{mod:'fichaje', vista:'proyectos'}, gestion:true},
  {t:'Gestión de horas del equipo', k:'gestion horas equipo usuario dentro fuera proyecto consumo tiempo',
   r:'En Gestión ves horas por usuario, dentro y fuera de cada proyecto, y el reparto circular de en qué se ha consumido el tiempo.',
   ir:{mod:'fichaje', vista:'gestion'}, gestion:true},
  {t:'Cambiar entre tema claro y oscuro', k:'tema claro oscuro modo noche color fondo blanco negro cambiar aspecto',
   r:'En «Mi cuenta», fila «Tema»: Sistema, Claro u Oscuro. «Sistema» sigue al de tu ordenador. La elección se queda guardada en este navegador.',
   accion:'cuenta'},
  {t:'Ensanchar la barra lateral', k:'barra lateral ancho ensanchar estrechar arrastrar menu lateral',
   r:'Arrastra su borde derecho. El ancho se recuerda para la próxima vez.',
   accion:null},
  {t:'Dónde se guardan los datos', k:'guardan datos nas copia seguridad servidor base perder donde estan backup',
   r:'Todo vive en el NAS de la oficina, en su propia base de datos. La app no sale a internet: si el NAS está encendido, funciona. Las copias de seguridad las programa el administrador en el NAS.',
   accion:null},
  {t:'Cómo se abre este asistente', k:'asistente buscador ayuda ctrl k atajo buscar preguntar duda',
   r:'Con Ctrl+K desde cualquier parte, o con la lupa de la barra de arriba. Escribe la pregunta como se te ocurra: entiende acentos, plurales y las palabras que usamos aquí.',
   accion:null}
];

/* ---------- índice de datos: se reconstruye en cada búsqueda ---------- */
function asIndiceDatos(){
  const fila = [];
  const admin = ME && ME.rol === 'admin';
  const gestion = typeof puedeVerGestion==='function' && puedeVerGestion();

  const VISTAS = [
    ['fichaje','fichaje','Hoy','cronometro registros del dia'],
    ['fichaje','calendario','Calendario','semana bloques horas arrastrar'],
    ['fichaje','informes','Informes','graficas exportar csv pdf reparto'],
    ['fichaje','proyectos',gestion?'Cartera':'Mis proyectos','proyectos cartera presupuesto horas entrega'],
    ['fichaje','gestion','Gestión','gestion horas equipo usuario dentro fuera proyecto tiempo'],
    ['fichaje','equipo','Equipo','personas cuentas actividad horas'],
    ['produccion','tabla','Tareas','tabla tablero kanban arbol carpetas columnas arrastrar'],
    ['produccion','mistareas','Mis tareas','asignadas pendientes mias'],
    ['produccion','flujos','Estados','flujo colores personalizar']
  ];
  VISTAS.forEach(([mod, v, nom, k]) => {
    if (v === 'gestion' && !gestion) return;
    if (v === 'equipo' && !admin) return;
    fila.push({tipo:'vista', t:nom, sub:mod === 'fichaje' ? 'Fichaje' : 'Producción',
      k:k, hacer:'Abrir', ir:{mod, vista:v}});
  });

  PROYECTOS.forEach(p => fila.push({
    tipo:'proyecto', t:p.nom,
    sub:[p.cliente, p.formato, (LC.nucleo.estados()||{})[p.estado]].filter(Boolean).join(' · '),
    k:[p.cliente, p.formato, p.estado].join(' '),
    hacer:'Ver ficha', ir:{mod:'fichaje', vista:'proyectos'}, proy:p.id
  }));

  if (typeof BLOQUES !== 'undefined') BLOQUES.forEach(b => fila.push({
    tipo:'carpeta', t:b.nom, sub:proyById(b.proyId).nom,
    k:'carpeta ' + proyById(b.proyId).nom,
    hacer:'Abrir', ir:{mod:'produccion', vista:'tabla'}, proy:b.proyId
  }));

  if (typeof TAREAS !== 'undefined') TAREAS.forEach(t => fila.push({
    tipo:'tarea', t:t.titulo,
    sub:[proyById(t.proyId).nom, typeof nomEstadoTarea==='function'?nomEstadoTarea(t):nomEstado(t.estado, t.proyId)].join(' · '),
    k:[proyById(t.proyId).nom, typeof nomEstadoTarea==='function'?nomEstadoTarea(t):nomEstado(t.estado, t.proyId), t.desc,
       (userById(uidAsig(t)) || {}).nom].filter(Boolean).join(' '),
    hacer:'Abrir ficha', tarea:t.id
  }));

  USERS.forEach(u => fila.push({
    tipo:'persona', t:u.nom, sub:u.user + ' · ' + (u.rol === 'admin' ? 'Administrador' : 'Usuario'),
    k:u.user + ' ' + u.rol, hacer:admin ? 'Ver en Equipo' : null,
    ir:admin ? {mod:'fichaje', vista:'equipo'} : null, tab:'horas'
  }));

  /* Solo lo tuyo, y solo lo reciente: el índice no puede crecer sin freno. */
  ENTRADAS.filter(e => e.userId === ME.id).sort((a, b) => b.ini - a.ini).slice(0, 250)
    .forEach(e => fila.push({
      tipo:'registro', t:e.desc || '(sin descripción)',
      sub:[fCorta(e.ini), proyById(e.proyId).nom, catById(e.cat).nom, hhmm(dur(e)) + ' h'].join(' · '),
      k:[proyById(e.proyId).nom, catById(e.cat).nom].join(' '),
      hacer:'Ver en el calendario', registro:e.ini
    }));

  return fila.filter(f => (!f.admin || admin) && (!f.gestion || gestion));
}

/* ---------- emparejar ---------- */
function asPuntua(grupos, campos){
  /* campos: [[raíces del campo, peso], …]. Palabra entera puntúa doble que prefijo. */
  let total = 0, aciertos = 0, mejorSuelto = 0;
  for (const grupo of grupos) {
    let mejor = 0;
    for (const [raices, peso] of campos) {
      if (!raices || !raices.length) continue;
      grupo.forEach((r, i) => {
        /* La palabra que se ha escrito pesa el doble que sus sinónimos: si no,
           «contraseña» acabaría sacando todo lo que hable de «acceso». */
        const via = i === 0 ? 1 : 0.5;
        if (raices.includes(r)) mejor = Math.max(mejor, peso * 2 * via);
        else if (r.length > 2 && raices.some(x => x.startsWith(r))) mejor = Math.max(mejor, peso * via);
      });
    }
    if (mejor) { aciertos++; total += mejor; mejorSuelto = Math.max(mejorSuelto, mejor); }
  }
  /* Media pregunta acertada no es un resultado: se exige la mayoría. La
     excepción es dar de lleno en el titular, que ya identifica la respuesta. */
  if (!aciertos) return 0;
  if (aciertos / grupos.length < 0.6 && mejorSuelto < 12) return 0;
  return total + aciertos * 2;
}

function asBuscar(consulta){
  const grupos = asGrupos(consulta);
  if (!grupos.length) return [];
  const frase = asNorm(consulta);
  const admin = ME && ME.rol === 'admin';
  const gestion = typeof puedeVerGestion==='function' && puedeVerGestion();
  const out = [];

  AS_GUIA.forEach(g => {
    if (g.admin && !admin) return;
    if (g.gestion && !gestion) return;
    const nt = asNorm(g.t);
    let p = asPuntua(grupos, [[asRaices(g.t), 6], [asRaices(g.k), 3], [asRaices(g.r), 1]]);
    if (!p) return;
    if (nt.includes(frase)) p += 14;          /* la pregunta casi literal manda */
    out.push({...g, tipo:'guia', punto:p});
  });

  asIndiceDatos().forEach(d => {
    const nt = asNorm(d.t);
    let p = asPuntua(grupos, [[asRaices(d.t), 6], [asRaices(d.sub), 2], [asRaices(d.k), 2]]);
    if (!p) return;
    if (nt === frase) p += 20;
    else if (nt.startsWith(frase)) p += 8;
    if (d.tipo === 'vista') p += 3;           /* «llévame a X» es lo más frecuente */
    out.push({...d, punto:p});
  });

  /* Registros repetidos: el mismo trabajo anotado varios días no debe llenar
     la lista. Se queda el más reciente de cada descripción. */
  const vistos = new Set();
  return out.sort((a, b) => b.punto - a.punto).filter(r => {
    if (r.tipo !== 'registro') return true;
    const c = r.tipo + '|' + r.t;
    if (vistos.has(c)) return false;
    vistos.add(c);
    return true;
  }).slice(0, 24);
}

/* ---------- ir a donde diga el resultado ---------- */
function asNavega(r){
  if (r.tarea != null) {
    if (modulo !== 'produccion') irModulo('produccion');
    const t = tareaById(r.tarea);
    if (t) { eligeProyecto(t.proyId); go('tabla'); abreTarea(r.tarea); }
    return;
  }
  if (r.registro != null) {
    if (modulo !== 'fichaje') irModulo('fichaje');
    calMode = 'day';
    calAnchor = startOfDay(r.registro);
    $$('#calMode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === 'day'));
    go('calendario');
    return;
  }
  if (r.accion === 'cuenta') { modalMiCuenta(); return; }
  if (!r.ir) return;
  if (modulo !== r.ir.mod) irModulo(r.ir.mod);
  if (r.tab) eqTab = r.tab;
  if (r.proy != null) {
    if (r.ir.mod === 'produccion') eligeProyecto(r.proy);
    else gSel = r.proy;
  }
  go(r.ir.vista);
}

/* ---------- la ventana ---------- */
let asAbierto = false, asSel = 0, asRes = [], asDetalle = null;

const AS_ICONOS = {
  guia:'<path d="M12 17h.01M12 14c0-2 2.2-2.3 2.2-4.2A2.2 2.2 0 0012 7.6a2.3 2.3 0 00-2.3 2"/><circle cx="12" cy="12" r="9"/>',
  vista:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18"/>',
  proyecto:'<path d="M3 7h6l2 2h10v10H3z"/>',
  carpeta:'<path d="M3 6h6l2 2h10v10H3z"/>',
  tarea:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l2.5 2.5L16 9"/>',
  persona:'<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>',
  registro:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const AS_SECCION = {guia:'Cómo se hace', vista:'Ir a', proyecto:'Proyectos',
  carpeta:'Carpetas', tarea:'Tareas', persona:'Personas', registro:'Mis registros'};
const asIcono = tipo => `<svg class="as-ico" width="15" height="15" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7">${AS_ICONOS[tipo] || AS_ICONOS.vista}</svg>`;

const AS_EJEMPLOS = [
  '¿Cómo anoto las horas de ayer?',
  'Copiar y pegar un fichaje',
  '¿Dónde cambio el tema?',
  'Exportar el parte a PDF',
  'He olvidado la contraseña'
];

function asCerrar(){
  asAbierto = false; asDetalle = null;
  $('#asistenteHost').innerHTML = '';
}

function asAbrir(consultaInicial){
  if (asAbierto) return;
  asAbierto = true; asSel = 0; asDetalle = null;
  $('#asistenteHost').innerHTML = `
    <div class="as-fondo" id="asFondo">
      <div class="as-caja" role="dialog" aria-modal="true" aria-label="Asistente">
        <div class="as-barra">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="asInput" autocomplete="off" spellcheck="false"
                 placeholder="Pregunta o busca: horas de ayer, crow list, Marta…"
                 aria-label="Pregunta o busca">
          <kbd class="as-kbd">Esc</kbd>
        </div>
        <div class="as-cuerpo" id="asCuerpo"></div>
        <div class="as-pie">
          <span><kbd class="as-kbd">↑</kbd><kbd class="as-kbd">↓</kbd> moverse</span>
          <span><kbd class="as-kbd">↵</kbd> abrir</span>
          <span class="as-pie-nota">Busca dentro de esta app. No sale a internet.</span>
        </div>
      </div>
    </div>`;
  const inp = $('#asInput');
  inp.value = consultaInicial || '';
  inp.addEventListener('input', asPinta);
  $('#asFondo').addEventListener('mousedown', ev => { if (ev.target.id === 'asFondo') asCerrar(); });
  asPinta();
  inp.focus();
}

function asPinta(){
  const cuerpo = $('#asCuerpo');
  if (!cuerpo) return;
  const q = $('#asInput').value.trim();

  if (asDetalle) { asPintaDetalle(cuerpo); return; }

  if (!q) {
    cuerpo.innerHTML = `<div class="as-grupo">Prueba con</div>` +
      AS_EJEMPLOS.map((e, i) => `<button type="button" class="as-fila as-ejemplo" data-ej="${i}">
        ${asIcono('guia')}<span class="as-tx"><span class="as-t">${esc(e)}</span></span></button>`).join('');
    cuerpo.querySelectorAll('[data-ej]').forEach(b => b.addEventListener('click', () => {
      $('#asInput').value = AS_EJEMPLOS[+b.dataset.ej];
      asSel = 0; asPinta(); $('#asInput').focus();
    }));
    asRes = [];
    return;
  }

  asRes = asBuscar(q);
  if (!asRes.length) {
    cuerpo.innerHTML = `<p class="as-vacio">Nada con «${esc(q)}».<br>
      Prueba con otra palabra: proyecto, tarea, carpeta, horas, contraseña, tema.</p>`;
    return;
  }
  if (asSel >= asRes.length) asSel = asRes.length - 1;

  /* Agrupado de verdad: cada sección sale una sola vez, y las secciones se
     ordenan por su mejor resultado. Sin esto el mismo epígrafe se repite. */
  const orden = [];
  const porTipo = new Map();
  asRes.forEach(r => {
    if (!porTipo.has(r.tipo)) { porTipo.set(r.tipo, []); orden.push(r.tipo); }
    porTipo.get(r.tipo).push(r);
  });
  asRes = orden.flatMap(t => porTipo.get(t));
  if (asSel >= asRes.length) asSel = asRes.length - 1;

  let html = '', seccion = null;
  asRes.forEach((r, i) => {
    if (r.tipo !== seccion) { seccion = r.tipo; html += `<div class="as-grupo">${AS_SECCION[seccion]}</div>`; }
    const sub = r.tipo === 'guia' ? r.r : r.sub;
    html += `<button type="button" class="as-fila${i === asSel ? ' on' : ''}" data-i="${i}">
      ${asIcono(r.tipo)}
      <span class="as-tx"><span class="as-t">${esc(r.t)}</span>${
        sub ? `<span class="as-s">${esc(sub)}</span>` : ''}</span>
      ${r.tipo === 'guia' ? '<span class="as-hacer">Leer</span>'
        : (r.hacer ? `<span class="as-hacer">${esc(r.hacer)}</span>` : '')}
    </button>`;
  });
  cuerpo.innerHTML = html;
  cuerpo.querySelectorAll('[data-i]').forEach(b => {
    b.addEventListener('click', () => asActiva(+b.dataset.i));
    b.addEventListener('mousemove', () => {
      if (asSel === +b.dataset.i) return;
      asSel = +b.dataset.i;
      cuerpo.querySelectorAll('[data-i]').forEach(x => x.classList.toggle('on', x === b));
    });
  });
  asVisible();
}

function asPintaDetalle(cuerpo){
  const g = asDetalle;
  cuerpo.innerHTML = `<div class="as-detalle">
    <button type="button" class="as-volver" id="asVolver">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 5l-7 7 7 7"/></svg>Volver</button>
    <h3>${esc(g.t)}</h3>
    <p>${esc(g.r)}</p>
    ${(g.ir || g.accion === 'cuenta') ? `<button type="button" class="btn btn-primary" id="asIr">Llévame</button>` : ''}
  </div>`;
  $('#asVolver').addEventListener('click', () => { asDetalle = null; asPinta(); $('#asInput').focus(); });
  const ir = $('#asIr');
  if (ir) ir.addEventListener('click', () => { const d = asDetalle; asCerrar(); asNavega(d); });
}

function asActiva(i){
  const r = asRes[i];
  if (!r) return;
  asSel = i;
  if (r.tipo === 'guia') { asDetalle = r; asPinta(); return; }
  asCerrar();
  asNavega(r);
}

function asVisible(){
  const el = $('#asCuerpo .as-fila.on');
  if (el) el.scrollIntoView({block:'nearest'});
}

/* ---------- teclado ---------- */
addEventListener('keydown', ev => {
  const k = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && k === 'k') {
    ev.preventDefault();
    asAbierto ? asCerrar() : (ME && asAbrir());
    return;
  }
  if (!asAbierto) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    if (asDetalle) { asDetalle = null; asPinta(); $('#asInput').focus(); }
    else asCerrar();
    return;
  }
  if (asDetalle) return;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    if (!asRes.length) return;
    ev.preventDefault();
    asSel = (asSel + (ev.key === 'ArrowDown' ? 1 : -1) + asRes.length) % asRes.length;
    $$('#asCuerpo .as-fila').forEach((x, i) => x.classList.toggle('on', i === asSel));
    asVisible();
    return;
  }
  if (ev.key === 'Enter' && asRes.length) { ev.preventDefault(); asActiva(asSel); }
});

const asBtn = $('#asistenteBtn');
if (asBtn) asBtn.addEventListener('click', () => asAbrir());

LC.asistente = {abrir:asAbrir, cerrar:asCerrar, buscar:asBuscar};
