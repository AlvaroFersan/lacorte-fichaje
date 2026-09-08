/* produccion.js
   Solo el gestor de trabajo: carpetas, escenas, estados, invitaciones.
   No conoce ENTRADAS. Las horas de una escena las pide al puente. */
/* ================= PRODUCCIÓN (estructura tipo Wrike) ================= */
/* Perfiles de estado = workflows de Wrike. Cada proyecto tiene el suyo.
   Los estados se agrupan en Activo / Completado / Diferido / Cancelado. */
const GRUPOS_EST = [
  {id:'activo', nom:'Activo'},
  {id:'completado', nom:'Completado'},
  {id:'diferido', nom:'Diferido'},
  {id:'cancelado', nom:'Cancelado'}
];
const COLORES_EST = ['#8a8a85','#8B1E1E','#e34948','#6b3fa0','#5BA3D9','#eda100','#0f8f78','#8aa0b3','#8B5A2B','#3d2a6e','#22c55e','#2ec4d6','#c47a3a','#2a78d6','#e87ba4'];
const FLUJOS_VER = 4;
let nextFlujo = 3, nextEstId = 50;
let FLUJOS = [
  {id:1, nom:'Estudio (por defecto)', desc:'Oficina y encargos cortos.',
    fijo:true, estados:[
      {id:'pendiente', nom:'Pendiente', grupo:'activo', color:'#8a8a85'},
      {id:'curso', nom:'En curso', grupo:'activo', color:'#2a78d6'},
      {id:'revision', nom:'En revisión', grupo:'activo', color:'#eda100'},
      {id:'hecha', nom:'Hecha', grupo:'completado', color:'#22c55e'},
      {id:'pausa', nom:'En pausa', grupo:'diferido', color:'#eda100'},
      {id:'cancelada', nom:'Cancelada', grupo:'cancelado', color:'#e34948'}
    ]},
  {id:2, nom:'EDICIÓN · Escenas', desc:'El de rodaje y montaje. Plantilla al crear un proyecto.',
    fijo:false, estados:[
      {id:'e_pendiente', nom:'Pendiente', grupo:'activo', color:'#8a8a85'},
      {id:'e_filmada', nom:'Filmada', grupo:'activo', color:'#8B1E1E'},
      {id:'e_incompleta', nom:'Incompleta', grupo:'activo', color:'#e34948'},
      {id:'e_retake', nom:'Retake', grupo:'activo', color:'#6b3fa0'},
      {id:'e_listaeditar', nom:'Lista para editar', grupo:'activo', color:'#5BA3D9'},
      {id:'e_material', nom:'Material Nuevo', grupo:'activo', color:'#eda100'},
      {id:'e_editando', nom:'Editando', grupo:'activo', color:'#0f8f78'},
      {id:'e_revisar', nom:'Lista para revisar', grupo:'activo', color:'#8aa0b3'},
      {id:'e_notaslead', nom:'Notas Lead', grupo:'activo', color:'#8B5A2B'},
      {id:'e_filmando', nom:'Filmando', grupo:'activo', color:'#3d2a6e'},
      {id:'e_editada', nom:'Editada', grupo:'completado', color:'#22c55e'},
      {id:'e_asistido', nom:'Asistido', grupo:'activo', color:'#2ec4d6'},
      {id:'e_omitida', nom:'Omitida', grupo:'cancelado', color:'#c47a3a'}
    ]}
];
const flujoById = id => FLUJOS.find(f=>f.id===id) || FLUJOS[0];
const flujoDe = proyId => flujoById((proyById(proyId)||{}).flujoId || 1);
const estadosDe = proyId => flujoDe(proyId).estados;
function estadoInfo(estId, proyId){
  const lista = proyId ? estadosDe(proyId) : FLUJOS.flatMap(f=>f.estados);
  return lista.find(e=>e.id===estId) || FLUJOS.flatMap(f=>f.estados).find(e=>e.id===estId)
    || {id:estId, nom:estId, grupo:'activo', color:'#8a8a85'};
}
const nomEstado = (estId, proyId) => estadoInfo(estId, proyId).nom;
const colorEstado = (estId, proyId) => estadoInfo(estId, proyId).color;
const grupoEstado = (estId, proyId) => estadoInfo(estId, proyId).grupo;
const esHecha = t => grupoEstado(t.estado, t.proyId)==='completado';
const primerActivo = proyId => estadosDe(proyId).find(e=>e.grupo==='activo') || estadosDe(proyId)[0];
function estadosVisibles(){
  if(prodProy) return estadosDe(prodProy);
  const m = new Map();
  TAREAS.forEach(t=>{ const e = estadoInfo(t.estado, t.proyId); if(!m.has(e.id)) m.set(e.id, e); });
  flujoById(1).estados.forEach(e=>{ if(!m.has(e.id)) m.set(e.id, e); });
  return [...m.values()];
}
function guardaFlujos(){
  try{
    localStorage.setItem('lc_flujos', JSON.stringify({
      ver: FLUJOS_VER, flujos: FLUJOS, nextFlujo, nextEstId,
      asig: Object.fromEntries(PROYECTOS.map(p=>[p.id, p.flujoId||1]))
    }));
  }catch(e){}
}
(function cargaFlujos(){
  try{
    const d = JSON.parse(localStorage.getItem('lc_flujos')||'null');
    if(!d || d.ver !== FLUJOS_VER || !d.flujos) return;
    FLUJOS = d.flujos; nextFlujo = d.nextFlujo||nextFlujo; nextEstId = d.nextEstId||nextEstId;
    if(d.asig) Object.entries(d.asig).forEach(([pid,fid])=>{
      const p = PROYECTOS.find(x=>x.id===+pid); if(p) p.flujoId = fid;
    });
  }catch(e){}
})();

const PRIO = {alta:'Alta', media:'Media', baja:'Baja'};
const ICO_MENU = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`;
const ICO_CARPETA = `<svg class="ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h6l2 2h10v10H3z"/></svg>`;
const ICO_ESCENA  = `<svg class="ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16"/></svg>`;

let BLOQUES = [], TAREAS = [], NOTIFS = [], ACTI = [];
let nextBloque = 1, nextTarea = 1, nextNotif = 1;
const uidAsig = t => (t.asignado==null || t.asignado==='') ? null : +t.asignado;
const esAsignadaA = (t, uid) => uidAsig(t) === +uid;
function persistTareas(){
  try {
    localStorage.setItem('lc_tareas_v2', JSON.stringify({
      next: nextTarea,
      tareas: TAREAS.map(t=>({
        id:t.id, proyId:t.proyId, bloqueId:t.bloqueId, titulo:t.titulo, desc:t.desc||'',
        asignado:uidAsig(t), estado:t.estado, prioridad:t.prioridad, fin:t.fin||'',
        creador:t.creador, creado:t.creado,
        subtareas:t.subtareas||[], comentarios:t.comentarios||[], campos:t.campos||{}
      }))
    }));
  } catch(_){ /* cuota o modo privado */ }
}
function recuperaTareas(){
  try {
    const d = JSON.parse(localStorage.getItem('lc_tareas_v2')||'null');
    if(!d || !Array.isArray(d.tareas)) return;
    const porId = new Map(TAREAS.map(t=>[t.id, t]));
    d.tareas.forEach(s=>{
      const asig = (s.asignado==null || s.asignado==='') ? null : +s.asignado;
      const t = porId.get(s.id);
      if(t){
        t.titulo = s.titulo; t.desc = s.desc; t.asignado = asig; t.estado = s.estado;
        t.prioridad = s.prioridad; t.fin = s.fin; t.bloqueId = s.bloqueId; t.proyId = s.proyId;
        t.subtareas = s.subtareas || []; t.comentarios = s.comentarios || [];
        t.campos = s.campos || t.campos;
      } else {
        TAREAS.push({...s, asignado:asig, adjuntos:[]});
      }
    });
    if(d.next) nextTarea = Math.max(nextTarea, +d.next);
  } catch(_){ /* JSON viejo o corrupto */ }
}
function actua(proyId, texto, extra){
  extra = extra || {};
  if(!proyId) return;
  ACTI.unshift({proyId, userId: extra.userId || (ME && ME.id), texto, ts: extra.ts || Date.now()});
  if(ACTI.length>200) ACTI.length = 200;
}
function cuandoActi(ts){
  const d = new Date(ts);
  return d.toDateString()===new Date().toDateString() ? fHora(ts) : fCorta(ts);
}
function pinesDe(p){ return p.pines || (p.pines = []); }
let nextPin = 1, detAbierto = false, detVista = 'lista', detPinNom = '';
function cierraDetalles(){
  detAbierto = false; detVista = 'lista';
  const pop = $('#detPop'), chip = $('#detChip');
  if(pop) pop.classList.add('hide');
  if(chip) chip.classList.remove('on');
}
function itemsProyecto(proyId){
  const carpetas = BLOQUES.filter(b=>b.proyId===proyId);
  const archivos = [];
  TAREAS.filter(t=>t.proyId===proyId).forEach(t=>{
    (t.adjuntos||[]).forEach(a=>archivos.push({t, a}));
  });
  return {carpetas, archivos};
}
function pinMeta(a){
  if(a.kind==='carpeta') return (bloqueById(a.bloqueId)||{}).nom || 'carpeta';
  if(a.kind==='adjunto') return 'archivo';
  if(a.kind==='archivo') return (a.tipo||'').split('/')[1] || 'archivo';
  return '';
}
function abrePin(a){
  if(a.kind==='carpeta'){ cierraDetalles(); eligeCarpeta(a.bloqueId); return; }
  if(a.kind==='archivo'){ abreVisor(a); return; }
  if(a.kind==='adjunto'){
    const t = tareaById(a.tareaId);
    const adj = t && (t.adjuntos||[]).find(x=>x.id===a.adjId);
    if(adj) abreVisor(adj);
  }
}
function addPin(p, pin){
  const nom = (detPinNom || pin.nom || '').trim();
  if(!nom){ toast('Escribe qué pineas'); return; }
  pinesDe(p).push({id:nextPin++, nom, ts:Date.now(), ...pin});
  actua(p.id, `pineó «${nom}»`);
  detPinNom = ''; detVista = 'lista';
  pintaDetalles(p);
}
function pintaDetalles(p){
  const pop = $('#detPop'); if(!pop) return;
  const pines = pinesDe(p);
  if(detVista==='elige'){
    const {carpetas, archivos} = itemsProyecto(p.id);
    pop.innerHTML = `<div class="lbl">Del proyecto</div>
      <div class="det-elige">
        ${carpetas.map(c=>`<button type="button" class="elemitem" data-carp="${c.id}">${ICO_CARPETA}<b>${esc(c.nom)}</b></button>`).join('')}
        ${archivos.map(({t,a})=>`<button type="button" class="elemitem" data-tid="${t.id}" data-adj="${a.id}">${ICO_ESCENA}<b>${esc(a.nom)}</b></button>`).join('')}
        ${!carpetas.length && !archivos.length?'<p class="hint2" style="margin:8px 0 0">Nada que pinear.</p>':''}
      </div>
      <button type="button" class="linkish" id="detVolver" style="margin-top:10px">Volver</button>`;
    pop.classList.remove('hide');
    $('#detChip').classList.add('on');
    $$('#detPop [data-carp]').forEach(b=>b.addEventListener('click', ()=>{
      const c = bloqueById(+b.dataset.carp);
      addPin(p, {kind:'carpeta', bloqueId:c.id, nom:c.nom});
    }));
    $$('#detPop [data-adj]').forEach(b=>b.addEventListener('click', ()=>{
      const t = tareaById(+b.dataset.tid);
      const a = t && (t.adjuntos||[]).find(x=>x.id===+b.dataset.adj);
      if(a) addPin(p, {kind:'adjunto', tareaId:t.id, adjId:a.id, nom:a.nom});
    }));
    $('#detVolver').addEventListener('click', ()=>{ detVista='lista'; pintaDetalles(p); });
    return;
  }
  pop.innerHTML = `<div class="lbl">Proyecto</div>
    <div class="det-meta">
      <div><span class="k">Cliente</span>${esc(p.cliente||'—')}</div>
      <div><span class="k">Formato</span>${esc(p.formato||'—')}</div>
      <div><span class="k">Inicio</span>
        <input type="date" class="field" id="detIni" value="${p.inicio||''}"></div>
      <div><span class="k">Fin</span>
        <input type="date" class="field" id="detFin" value="${p.entrega||''}"></div>
    </div>
    <div class="lbl" style="margin:16px 0 8px">Pineados</div>
    <div class="adj-lista">${pines.map(a=>`<div class="adj-row">
      <input class="adj-nom" data-ren="${a.id}" value="${esc(a.nom)}">
      <button type="button" class="linkish" data-ver="${a.id}">Ver</button>
      <span class="meta">${esc(pinMeta(a))}</span>
      <button type="button" class="icon-btn" data-quita="${a.id}">✕</button>
    </div>`).join('')}</div>
    <div class="det-pin">
      <input type="text" id="detPinNom" placeholder="Qué pineas" value="${esc(detPinNom)}">
      <input type="file" id="detPinFile" class="hide" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,application/pdf,image/*">
      <button type="button" class="btn btn-sm" id="detPinFileBtn">Archivo</button>
      <button type="button" class="btn btn-sm" id="detPinProy">Del proyecto</button>
      <button type="button" class="btn btn-sm btn-primary" id="detPinAdd">Pinear</button>
    </div>`;
  pop.classList.remove('hide');
  $('#detChip').classList.add('on');
  const guardaNom = ()=>{ const el=$('#detPinNom'); if(el) detPinNom = el.value; };
  $('#detIni').addEventListener('change', e=>{ p.inicio = e.target.value; actua(p.id, 'cambió el inicio'); });
  $('#detFin').addEventListener('change', e=>{ p.entrega = e.target.value; actua(p.id, 'cambió el fin'); });
  ligaSobrenombre('#detPop [data-ren]', pines);
  $$('#detPop [data-ver]').forEach(b=>b.addEventListener('click', ()=>{
    const a = pines.find(x=>x.id===+b.dataset.ver); if(a) abrePin(a);
  }));
  $$('#detPop [data-quita]').forEach(b=>b.addEventListener('click', ()=>{
    p.pines = pines.filter(x=>x.id!==+b.dataset.quita);
    pintaDetalles(p);
  }));
  $('#detPinNom').addEventListener('input', guardaNom);
  $('#detPinNom').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); guardaNom(); addPin(p, {kind:'nota'}); } });
  $('#detPinAdd').addEventListener('click', ()=>{ guardaNom(); addPin(p, {kind:'nota'}); });
  const file = $('#detPinFile');
  $('#detPinFileBtn').addEventListener('click', ()=>{ guardaNom(); file.click(); });
  file.addEventListener('change', async ()=>{
    const f = file.files && file.files[0]; file.value='';
    if(!f) return;
    try{
      const data = await leeArchivo(f);
      guardaNom();
      addPin(p, {kind:'archivo', nom:detPinNom||f.name, tipo:f.type||'application/octet-stream', tam:f.size, data});
    }catch(err){ toast(err.message || 'No se ha podido pinear'); }
  });
  $('#detPinProy').addEventListener('click', ()=>{ guardaNom(); detVista='elige'; pintaDetalles(p); });
}
function pintaCabecera(){
  const tit = $('#pageTitle'), wrap = $('#actiWrap'), pop = $('#actiPop'), sub = $('#pageSub');
  const det = $('#detWrap');
  if(!tit) return;
  if(sub){ sub.textContent=''; sub.classList.add('hide'); }
  const enProd = modulo==='produccion' && (vista==='tabla' || vista==='tablero');
  const p = enProd && prodProy ? proyById(prodProy) : null;
  if(!p){
    if(enProd) tit.textContent = TITULOS[vista][0];
    if(wrap) wrap.classList.add('hide');
    if(det) det.classList.add('hide');
    cierraDetalles();
    return;
  }
  tit.textContent = p.nom;
  if(det) det.classList.remove('hide');
  const a = ACTI.find(x=>x.proyId===p.id);
  if(!a || !wrap || !pop){ if(wrap) wrap.classList.add('hide'); }
  else {
    const u = userById(a.userId)||{};
    pop.innerHTML = `<div class="lbl">Última actualización</div>
      <div class="quien">${esc(u.nom||'')}</div>
      <div class="que">${esc(a.texto)}</div>
      <div class="cuando">${fCorta(a.ts)} · ${fHora(a.ts)}</div>`;
    wrap.classList.remove('hide');
  }
  if(detAbierto) pintaDetalles(p);
}
$('#detChip').addEventListener('click', ev=>{
  ev.stopPropagation();
  const p = prodProy && proyById(prodProy);
  if(!p) return;
  if(detAbierto){ cierraDetalles(); return; }
  detAbierto = true;
  pintaDetalles(p);
});
document.addEventListener('pointerdown', ev=>{
  if(!detAbierto) return;
  if(ev.target.closest('#detWrap') || ev.target.closest('#visor')) return;
  cierraDetalles();
});
let prodProy = null;        /* proyecto seleccionado; null = todos */
let prodCarpeta = null;     /* carpeta del explorador; null = todo el proyecto */
let exploraAbiertos = new Set(); /* proyectos desplegados en la barra izquierda */
let exploraCarpetasAbiertas = new Set(); /* subcarpetas abiertas (p. ej. DOCUMENTOS) */

/* Plantilla del estudio al crear un proyecto. El código de proyecto (OEV2, etc.)
   no se mete en el nombre: eso es el proyecto, no la carpeta. */
const FORMATOS = [
  'Película','Serie','Documental','Cortometraje',
  'Spot','Videoclip','Corporativo','Tráiler','Interno'
];
const PLANTILLA_ESTUDIO = [
  {nom:'00_ASISTENCIA'},
  {nom:'01_DOCUMENTOS', hijos:['01_Documentos','02_Guion','03_Planes de Trabajo','04_Crew List']},
  {nom:'02_ESCENAS'},
  {nom:'03_ENTREGAS'},
  {nom:'04_SALIDAS'}
];
function aplicarPlantillaEstudio(proyId, carpetaFn){
  PLANTILLA_ESTUDIO.forEach(nodo=>{
    const c = carpetaFn(proyId, nodo.nom);
    (nodo.hijos||[]).forEach(nom=>carpetaFn(proyId, nom, c.id));
  });
}
function hijosDe(proyId, padre){
  return BLOQUES.filter(b=>b.proyId===proyId && b.padre===padre);
}
function abreCarpetasPlantilla(proyId){
  BLOQUES.filter(b=>b.proyId===proyId && hijosDe(proyId, b.id).length)
    .forEach(b=>exploraCarpetasAbiertas.add(b.id));
}
let misQuien = null;        /* inbox de Mis tareas; null = el que está dentro */
let prodQuien = '';         /* filtro por persona */
let prodEstado = '';        /* filtro por estado; '' = todos */
let prodVencidas = false;   /* filtro rápido: solo vencidas */
let prodBusca = '';         /* texto de búsqueda por título */
let tareaAbierta = null;
let seleccion = new Set();  /* ids de escenas seleccionadas en la Tabla, para acciones en lote */
let carpetaEditando = null; /* id de carpeta en edición de nombre justo tras crearla */

const tareaById  = id => TAREAS.find(t=>t.id===id);
const bloqueById = id => BLOQUES.find(b=>b.id===id);
const noLeidas   = () => NOTIFS.filter(n=>n.userId===ME.id && !n.leida);

(function semillaProduccion(){
  const carpeta = (proyId, nom, padre=null) => {
    const c = {id:nextBloque++, proyId, nom, padre}; BLOQUES.push(c); return c;
  };
  aplicarPlantillaEstudio(1, carpeta);
  recuperaTareas();
})();

/* ---- avisos ---- */
function avisa(userId, texto, tareaId){
  if(!userId) return;
  NOTIFS.unshift({id:nextNotif++, userId:+userId, texto, tareaId:tareaId||null, ts:Date.now(), leida:false});
  pintaAvisos();
  if(window.LC && LC.guarda && LC.guarda.guardarPronto) LC.guarda.guardarPronto();
}
function pintaAvisos(){
  const n = ME ? noLeidas().length : 0;
  $$('[data-bell-dot]').forEach(d=>{
    d.textContent = n; d.classList.toggle('hide', !n);
  });
  const mis = ME ? TAREAS.filter(t=>esAsignadaA(t, ME.id) && !esHecha(t)).length : 0;
  const b = $('#navMis');
  if(b){ b.textContent = mis; b.classList.toggle('hide', !mis); }
}
function abrirAvisos(ev){
  if(ev) ev.stopPropagation();
  const host = $('#popHost');
  if($('#notifPop')){ host.innerHTML=''; return; }
  const mias = NOTIFS.filter(n=>ME && n.userId===ME.id).slice(0,20);
  host.innerHTML = `<div class="notifpop" id="notifPop">
    <header><span class="lbl">Avisos</span>
      ${mias.some(n=>!n.leida)?'<button class="linkish" id="marcarTodo">Marcar todo como leído</button>':''}</header>
    ${mias.length ? mias.map(n=>`<div class="notif${n.leida?' leida':''}" data-notif="${n.id}">
        <span class="pt"></span>
        <div><div class="tx">${esc(n.texto)}</div><div class="tm">${fCorta(n.ts)} · ${fHora(n.ts)}</div></div>
      </div>`).join('')
      : '<p class="empty">No tienes avisos.</p>'}</div>`;
  const cerrar = () => host.innerHTML='';
  const mt = $('#marcarTodo');
  if(mt) mt.addEventListener('click', e=>{ e.stopPropagation();
    NOTIFS.forEach(n=>{ if(n.userId===ME.id) n.leida=true; }); cerrar(); pintaAvisos(); });
  $$('#notifPop [data-notif]').forEach(el=>el.addEventListener('click', ()=>{
    const n = NOTIFS.find(x=>x.id===+el.dataset.notif);
    n.leida = true; cerrar(); pintaAvisos();
    if(n.tareaId){ irModulo('produccion'); go('tabla'); abreTarea(n.tareaId); }
  }));
  const pop = $('#notifPop'), btn = ev && ev.currentTarget;
  if(pop && btn){
    const r = btn.getBoundingClientRect();
    pop.style.top = Math.min(r.bottom+8, innerHeight-24)+'px';
    pop.style.right = 'auto';
    pop.style.left = Math.max(10, Math.min(r.right-330, innerWidth-340))+'px';
  }
}
$('#bell').addEventListener('click', abrirAvisos);
const bellNav = $('#bellNav');
if(bellNav) bellNav.addEventListener('click', abrirAvisos);
function renderAyuda(){
  const box = $('#ayudaBox');
  if(box) box.innerHTML = '';
}
$('#ayudaBtn').addEventListener('click', ()=>{
  if(modulo!=='produccion') irModulo('produccion');
  go('ayuda');
});

/* ---- barra de filtros compartida ---- */
function nFiltros(){ return (prodQuien?1:0)+(prodEstado?1:0)+(prodVencidas?1:0); }
function barraProd(destino, conNueva, conTabla){
  const GRUPOS = {bloque:'Bloque', estado:'Estado', persona:'Asignado',
                  proyecto:'Proyecto', ninguno:'Sin agrupar'};
  const n = nFiltros();
  destino.innerHTML = `
    <div class="buscaesc">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="fb_${destino.id}" placeholder="Buscar…" value="${esc(prodBusca)}">
    </div>
    <div class="filt-tools">
      <button type="button" class="btn filtro-btn" id="btnFiltros" aria-pressed="${n>0}">
        Filtros${n?`<span class="fdot">${n}</span>`:''}</button>
      ${conTabla?`<div class="seg" id="segVista">
          <button data-v="arbol" aria-pressed="${vistaTabla==='arbol'}">Árbol</button>
          <button data-v="agrupada" aria-pressed="${vistaTabla==='agrupada'}">Agrupada</button>
        </div>
        <select id="fg_${destino.id}" title="Agrupar por" class="${vistaTabla==='arbol'?'hide':''}">${Object.entries(GRUPOS).map(([k,v])=>
        `<option value="${k}"${k===tablaGrupo?' selected':''}>${v}</option>`).join('')}</select>
        <button class="btn" id="btnCols">Columnas</button>`:''}
      ${conNueva && !conTabla?'<button class="btn btn-primary" id="nuevaEsc" style="padding:8px 12px">Añadir</button>':''}
    </div>`;
  let tBusca;
  $(`#fb_${destino.id}`).addEventListener('input', e=>{
    clearTimeout(tBusca);
    const v = e.target.value;
    tBusca = setTimeout(()=>{ prodBusca = v.trim().toLowerCase(); render();
      const el = $(`#fb_${destino.id}`); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 140);
  });
  $('#btnFiltros').addEventListener('click', ev=>{ ev.stopPropagation(); popFiltros(ev); });
  const g = $(`#fg_${destino.id}`);
  if(g) g.addEventListener('change', e=>{ tablaGrupo = e.target.value; plegados.clear(); render(); });
  $$('#segVista button').forEach(b=>b.addEventListener('click', ()=>{
    vistaTabla = b.dataset.v; plegados.clear(); seleccion.clear(); render();
  }));
  const bc = $('#btnCols');
  if(bc) bc.addEventListener('click', ev=>{ ev.stopPropagation(); popColumnas(ev); });
  const nb = $('#nuevaEsc');
  if(nb) nb.addEventListener('click', ev=>{ ev.stopPropagation(); popTiposElem(ev); });
}
function popFiltros(ev){
  const host = $('#popHost');
  if($('#filtroPop')){ host.innerHTML=''; return; }
  host.innerHTML = `<div class="filtropop" id="filtroPop">
    <div class="frow"><div class="lbl">Persona</div>
      <select id="fqPop"><option value="">Todo el equipo</option>
        ${USERS.map(u=>`<option value="${u.id}"${String(u.id)===prodQuien?' selected':''}>${esc(u.nom)}</option>`).join('')}</select></div>
    <div class="frow"><div class="lbl">Estado</div>
      <select id="fePop"><option value="">Cualquier estado</option>
        ${estadosVisibles().map(e=>`<option value="${e.id}"${e.id===prodEstado?' selected':''}>${esc(e.nom)}</option>`).join('')}</select></div>
    <div class="frow">
      <button type="button" class="btn btn-toggle" id="fvPop" aria-pressed="${prodVencidas}">Solo vencidas</button></div>
    ${nFiltros()?`<div class="frow"><button type="button" class="linkish" id="fqClear">Quitar filtros</button></div>`:''}
  </div>`;
  const pop = $('#filtroPop'), r = pop.getBoundingClientRect(), br = ev.currentTarget.getBoundingClientRect();
  pop.style.left = Math.max(10, Math.min(br.left, innerWidth-r.width-12))+'px';
  pop.style.top  = Math.min(br.bottom+6, innerHeight-r.height-12)+'px';
  const aplica = ()=>{
    $('#popHost').innerHTML = '';
    render();
    const b = $('#btnFiltros');
    if(b) popFiltros({currentTarget:b});
  };
  $('#fqPop').addEventListener('change', e=>{ prodQuien = e.target.value; aplica(); });
  $('#fePop').addEventListener('change', e=>{ prodEstado = e.target.value; aplica(); });
  $('#fvPop').addEventListener('click', ()=>{ prodVencidas = !prodVencidas; aplica(); });
  const qc = $('#fqClear');
  if(qc) qc.addEventListener('click', ()=>{ prodQuien=''; prodEstado=''; prodVencidas=false; $('#popHost').innerHTML=''; render(); });
}
function enRama(bloqueId, raizId){
  if(bloqueId===raizId) return true;
  let c = bloqueById(bloqueId);
  while(c && c.padre!=null){
    if(c.padre===raizId) return true;
    c = bloqueById(c.padre);
  }
  return false;
}
const puedoVer = p => p && (esMio(p) || estaEnEquipo(p));
const tareasVisibles = () => TAREAS.filter(t=>
  puedoVer(proyById(t.proyId)) &&
  (!prodProy || t.proyId===prodProy) &&
  (!prodCarpeta || enRama(t.bloqueId, prodCarpeta)) &&
  (!prodQuien || esAsignadaA(t, prodQuien)) &&
  (!prodEstado || t.estado===prodEstado) &&
  (!prodVencidas || (t.fin && new Date(t.fin+'T23:59') < Date.now() && !esHecha(t))) &&
  (!prodBusca || t.titulo.toLowerCase().includes(prodBusca)));

function nuevaEscena(bloqueIdForzado, opts){
  opts = opts || {};
  const blForzado = bloqueIdForzado!=null ? bloqueById(bloqueIdForzado) : null;
  const proy = blForzado ? blForzado.proyId : (prodProy || (proyectosMios()[0]||PROYECTOS[0]||{}).id);
  if(!proy){ toast('Elige un proyecto'); return; }
  let bl = blForzado;
  if(!bl) bl = BLOQUES.find(b=>b.proyId===proy && b.nom==='02_ESCENAS')
    || BLOQUES.find(b=>b.proyId===proy);
  if(!bl){ bl = {id:nextBloque++, proyId:proy, nom:'Sin clasificar', padre:null}; BLOQUES.push(bl); }
  const t = {id:nextTarea++, proyId:proy, bloqueId:bl.id, titulo:opts.titulo || 'Tarea nueva', desc:'',
    asignado:ME.id, estado:primerActivo(proy).id, prioridad:'media',
    fin:new Date(HOY.getTime()+3*DAY).toISOString().slice(0,10),
    creador:ME.id, creado:Date.now(), subtareas:[], comentarios:[], adjuntos:[]};
  t.campos = {c_rodaje: t.fin || ''};
  TAREAS.push(t);
  actua(proy, `creó «${t.titulo}»`);
  render();
  if(opts.abrir !== false) abreTarea(t.id, true);
}

/* ---- duplicar y borrar escenas (también se usa desde el menú de la fila) ---- */
function duplicaEscena(id){
  const t = tareaById(id); if(!t) return;
  const copia = {...t, id:nextTarea++, titulo:t.titulo+' (copia)',
    subtareas: t.subtareas.map(s=>({...s})), comentarios:[],
    adjuntos:(t.adjuntos||[]).map(a=>({...a})), campos:{...(t.campos||{})},
    creador:ME.id, creado:Date.now()};
  TAREAS.push(copia);
  actua(t.proyId, `duplicó «${t.titulo}»`);
  render();
  toast(`«${t.titulo}» duplicada`);
}
function borraEscena(id){
  const t = tareaById(id); if(!t) return;
  const copia = {...t};
  TAREAS = TAREAS.filter(x=>x.id!==id);
  LC.puente.desenlazarEscena(id);
  seleccion.delete(id);
  if(tareaAbierta===id) cierraTarea();
  actua(t.proyId, `eliminó «${t.titulo}»`);
  render();
  toast('Tarea borrada', 'Deshacer', ()=>{ TAREAS.push(copia); render(); });
}

/* ---- carpetas: crear, renombrar, borrar, comprobar parentesco ----
   Una «carpeta» es un BLOQUE más: puede contener subcarpetas y, a la vez,
   escenas colgadas directamente de ella (igual que en el Wrike real). */
function nuevaCarpeta(padreId, nomForzado){
  const proy = padreId!=null ? (bloqueById(padreId)||{}).proyId : prodProy;
  if(!proy){ toast('Elige un proyecto'); return; }
  const c = {id:nextBloque++, proyId:proy, nom:nomForzado || 'Carpeta nueva', padre:padreId==null?null:padreId};
  BLOQUES.push(c);
  if(padreId!=null) plegados.delete('c'+padreId);
  carpetaEditando = nomForzado ? null : c.id;
  actua(proy, `carpeta «${c.nom}»`);
  render();
}

let tipoElem = 'tarea';
const TIPOS_ELEM = {
  tarea:{nom:'Tarea',
    ico:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l2.5 2.5L16 9"/></svg>'},
  carpeta:{nom:'Carpeta',
    ico:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h6l2 2h10v10H3z"/></svg>'},
  proyecto:{nom:'Proyecto',
    ico:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="18" height="13" rx="1"/><path d="M8 7V5h8v2"/></svg>'}
};
function pintaBtnTipo(){
  const t = TIPOS_ELEM[tipoElem];
  const b = $('#btnTipoElem'); if(!b || !t) return;
  b.innerHTML = t.ico+' '+t.nom;
}
function creaElemento(tipo, nom){
  const n = (nom||'').trim();
  if(tipo==='proyecto'){
    if(n){
      const id = Math.max(0, ...PROYECTOS.map(p=>p.id)) + 1;
      PROYECTOS.push({id, nom:n, cliente:'—', formato:'Serie', estado:'curso',
        presu:0, inicio:'', entrega:'', minPrograma:0, versiones:0, equipo:[ME.id], dueno:ME.id, flujoId:2, pines:[]});
      estructuraEstudio(id); abreCarpetasPlantilla(id); initSelects(); eligeProyecto(id); pintaExplora();
      toast(`«${n}» creado`);
    } else nuevoProyecto();
    return;
  }
  if(tipo==='carpeta'){
    nuevaCarpeta(prodCarpeta, n || null);
    return;
  }
  nuevaEscena(prodCarpeta, {titulo: n || 'Tarea nueva', abrir: !n});
}
function popTiposElem(ev){
  const host = $('#popHost');
  if($('#elemPop')){ host.innerHTML=''; return; }
  host.innerHTML = `<div class="elempop" id="elemPop">
    ${Object.entries(TIPOS_ELEM).map(([k,t])=>`<button type="button" class="elemitem" data-tipo="${k}">
      ${t.ico}<b>${t.nom}</b></button>`).join('')}
  </div>`;
  const pop = $('#elemPop'), r = pop.getBoundingClientRect();
  const x = ev.clientX || 40, y = ev.clientY || 40;
  pop.style.left = Math.max(10, Math.min(x, innerWidth-r.width-12))+'px';
  pop.style.top  = Math.max(10, Math.min(y+8, innerHeight-r.height-12))+'px';
  $$('#elemPop [data-tipo]').forEach(b=>b.addEventListener('click', ()=>{
    tipoElem = b.dataset.tipo; pintaBtnTipo(); host.innerHTML='';
    if(vista!=='tabla'){ creaElemento(tipoElem, ''); return; }
    if(tipoElem==='proyecto' && !$('#elemNom').value.trim()) nuevoProyecto();
    else if($('#elemNom')) $('#elemNom').focus();
  }));
}
function renombraCarpeta(id, nom){
  const c = bloqueById(id); if(!c) return;
  c.nom = nom.trim() || c.nom;
  if(carpetaEditando===id) carpetaEditando = null;
  render();
}
function destinoTrasBorrarCarpeta(c){
  if(c.padre != null) return bloqueById(c.padre);
  let alt = BLOQUES.find(b=>b.proyId===c.proyId && b.padre===null && b.id!==c.id);
  if(!alt){ alt = {id:nextBloque++, proyId:c.proyId, nom:'Sin clasificar', padre:null}; BLOQUES.push(alt); }
  return alt;
}
function borraCarpeta(id){
  const c = bloqueById(id); if(!c) return;
  const hijos = BLOQUES.filter(b=>b.padre===id);
  const tareasAqui = TAREAS.filter(t=>t.bloqueId===id);
  const destino = destinoTrasBorrarCarpeta(c);
  const antesHijos = hijos.map(h=>({h, padre:h.padre}));
  const antesTareas = tareasAqui.map(t=>({t, bloqueId:t.bloqueId}));
  hijos.forEach(h=>h.padre = c.padre);
  tareasAqui.forEach(t=>t.bloqueId = destino.id);
  BLOQUES = BLOQUES.filter(b=>b.id!==id);
  plegados.delete('c'+id);
  render();
  toast(`Carpeta «${c.nom}» eliminada`, 'Deshacer', ()=>{
    BLOQUES.push(c);
    antesHijos.forEach(({h,padre})=>h.padre=padre);
    antesTareas.forEach(({t,bloqueId})=>t.bloqueId=bloqueId);
    render();
  });
}
/* ¿«nodoId» cuelga, directa o indirectamente, de «posibleAntepasadoId»?
   Sirve para no poder arrastrar una carpeta dentro de su propia subcarpeta. */
function esDescendienteDe(nodoId, posibleAntepasadoId){
  let cur = bloqueById(nodoId);
  while(cur && cur.padre != null){
    if(cur.padre === posibleAntepasadoId) return true;
    cur = bloqueById(cur.padre);
  }
  return false;
}

const ICO = {
  ojo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  mas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  carp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h6l2 2h10v10H3z"/></svg>',
  copia: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/></svg>',
  lapi: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  yo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5"/></svg>',
  bas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13"/></svg>',
  est: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  prio: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 4v16M6 4h10l-2 4 2 4H6"/></svg>',
  share: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="6" cy="12" r="2.2"/><circle cx="17" cy="6" r="2.2"/><circle cx="17" cy="18" r="2.2"/><path d="M8 11l7-4M8 13l7 4"/></svg>'
};
const FLE = '<svg class="fle" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg>';

/* ---- menú contextual (clic derecho o ⋯), como en Wrike ---- */
function menuFila(ev, tipo, id){
  ev.preventDefault();
  ev.stopPropagation();
  $$('.ctx').forEach(el=>el.classList.remove('ctx'));
  const fila = ev.target.closest('tr, .exitem, .tk');
  if(fila) fila.classList.add('ctx');
  const host = $('#popHost');
  let items;
  if(tipo==='tarea'){
    const t = tareaById(id); if(!t) return;
    items = [
      {nom:'Ver ficha', ico:ICO.ojo, on: ()=>abreTarea(id)},
      {nom:'Nueva tarea aquí', ico:ICO.mas, on: ()=>nuevaEscena(t.bloqueId)},
      {sep:true},
      {nom:'Asignarme a mí', ico:ICO.yo, on: ()=>{
        if(!esAsignadaA(t, ME.id)){ t.asignado=ME.id; actua(t.proyId, `se asignó «${t.titulo}»`); toast('Te la has asignado · está en Mis tareas'); render(); } }},
      {nom:'Cambiar estado', ico:ICO.est, sub: estadosDe(t.proyId).map(e=>({
        nom:e.nom, on:()=>{ if(t.estado!==e.id){ t.estado=e.id; actua(t.proyId, `«${t.titulo}» → ${e.nom}`); avisa(t.asignado, `${ME.nom} ha pasado «${t.titulo}» a ${e.nom}`, t.id); render(); } }
      }))},
      {nom:'Cambiar prioridad', ico:ICO.prio, sub: Object.entries(PRIO).map(([k,v])=>({
        nom:v, on:()=>{ t.prioridad=k; render(); }
      }))},
      {sep:true},
      {nom:'Duplicar', ico:ICO.copia, on: ()=>duplicaEscena(id)},
      {sep:true},
      {nom:'Eliminar', ico:ICO.bas, danger:true, on: ()=>borraEscena(id)}
    ];
  } else if(tipo==='carpeta'){
    items = [
      {nom:'Nueva tarea aquí', ico:ICO.mas, on: ()=>nuevaEscena(id)},
      {nom:'Nueva subcarpeta', ico:ICO.carp, on: ()=>nuevaCarpeta(id)},
      {nom:'Cambiar nombre', ico:ICO.lapi, on: ()=>{ carpetaEditando = id; render(); }},
      {sep:true},
      {nom:'Eliminar', ico:ICO.bas, danger:true, on: ()=>borraCarpeta(id)}
    ];
  } else if(tipo==='vacio'){
    items = [
      {nom:'Nueva tarea', ico:ICO.mas, on: ()=>nuevaEscena()},
      {nom:'Nueva carpeta', ico:ICO.carp, on: ()=>nuevaCarpeta(null)},
      {nom:'Nuevo proyecto', ico:ICO.mas, on: ()=>nuevoProyecto()}
    ];
  } else {
    items = [
      {nom:'Abrir proyecto', ico:ICO.ojo, on: ()=>eligeProyecto(id)},
      ...(esMio(proyById(id)) ? [
        {nom:'Nueva carpeta', ico:ICO.carp, on: ()=>{ eligeProyecto(id); nuevaCarpeta(null); }},
        {nom:'Nueva tarea', ico:ICO.mas, on: ()=>{ eligeProyecto(id); nuevaEscena(); }},
        {sep:true},
        {nom:'Invitar', ico:ICO.share, on: ()=>abreInvitar(id)},
        {nom:'Cambiar nombre', ico:ICO.lapi, on: ()=>renombraProyecto(id)},
        {nom:'Color', paleta:true, on: c=>{ const p=proyById(id); if(p){ p.color=c; render(); } }},
        {nom:'Flujo', ico:ICO.est, sub: FLUJOS.map(f=>({
          nom:f.nom, on:()=>asignaFlujo(id, f.id)
        }))}
      ] : [
        {nom:'Color', paleta:true, on: c=>{ const p=proyById(id); if(p){ p.color=c; render(); } }},
        {sep:true},
        {nom:'Salir del proyecto', ico:ICO.bas, danger:true, on: ()=>saleDelProyecto(id)}
      ])
    ];
  }
  host.innerHTML = `<div class="menupop" id="filaPop">${items.map((it,i)=>it.sep
    ? '<div class="msep"></div>'
    : it.paleta
      ? `<div class="mpaleta" data-i="${i}">${PALETA_PROY.map(c=>`<button type="button" data-i="${i}" data-c="${c}" class="${colorProyecto(id)===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`
      : `<button class="mitem${it.danger?' danger':''}" data-i="${i}">${it.ico||''}<span>${esc(it.nom)}</span>${it.sub?FLE+'<div class="msub">'+
        it.sub.map((s,j)=>`<button class="mitem" data-i="${i}" data-j="${j}">${esc(s.nom)}</button>`).join('')
      +'</div>':''}</button>`).join('')}</div>`;
  const pop = $('#filaPop'), r = pop.getBoundingClientRect();
  let x = ev.clientX, y = ev.clientY;
  if(x + r.width > innerWidth - 12) x = innerWidth - r.width - 12;
  if(y + r.height > innerHeight - 12) y = innerHeight - r.height - 12;
  pop.style.left = Math.max(8, x)+'px';
  pop.style.top  = Math.max(8, y)+'px';
  $$('#filaPop [data-i]').forEach(b=>b.addEventListener('click', e=>{
    e.stopPropagation();
    const it = items[+b.dataset.i];
    if(!it || it.sep) return;
    if(it.paleta){
      if(b.dataset.c){ host.innerHTML=''; it.on(b.dataset.c); }
      return;
    }
    if(it.sub){
      if(b.dataset.j==null){ b.classList.add('on'); return; }
      host.innerHTML=''; it.sub[+b.dataset.j].on(); return;
    }
    host.innerHTML=''; it.on();
  }));
}

function estructuraEstudio(proyId){
  const carpeta = (pid, nom, padre=null) => {
    const c = {id:nextBloque++, proyId:pid, nom, padre}; BLOQUES.push(c); return c;
  };
  aplicarPlantillaEstudio(proyId, carpeta);
}
function eligeProyecto(id){
  prodProy = id;
  prodCarpeta = null;
  exploraAbiertos.add(id);
  abreCarpetasPlantilla(id);
  if(modulo!=='produccion') irModulo('produccion');
  if(vista!=='tabla' && vista!=='tablero') go('tabla');
  else render();
}
function eligeCarpeta(id){
  const c = bloqueById(id); if(!c) return;
  prodProy = c.proyId;
  prodCarpeta = id;
  exploraAbiertos.add(c.proyId);
  plegados.delete('c'+id);
  if(vista!=='tabla') go('tabla');
  else render();
}
function nuevoProyecto(){
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal">
    <div class="lbl" style="margin-bottom:12px">Nuevo proyecto</div>
    <label class="lbl" for="npNom">Nombre</label>
    <div class="row"><input class="field" id="npNom" placeholder="Nombre" autofocus></div>
    <label class="lbl" for="npCli">Cliente</label>
    <div class="row"><input class="field" id="npCli" placeholder="Cliente"></div>
    <label class="lbl" for="npFor">Formato</label>
    <div class="row"><select class="field" id="npFor">
      ${FORMATOS.map(f=>`<option${f==='Serie'?' selected':''}>${esc(f)}</option>`).join('')}</select></div>
    <label class="lbl" for="npFlujo">Estados</label>
    <div class="row"><select class="field" id="npFlujo">
      ${FLUJOS.map(f=>`<option value="${f.id}"${f.id===2?' selected':''}>${esc(f.nom)}</option>`).join('')}</select></div>
    <div class="acts">
      <button class="btn" type="button" id="npNo">Cancelar</button>
      <button class="btn btn-primary" type="button" id="npOk">Crear</button>
    </div>
  </div></div>`;
  const cierra = () => { $('#modalHost').innerHTML=''; };
  $('#npNo').addEventListener('click', cierra);
  $('#npNom').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#npOk').click(); });
  $('#npOk').addEventListener('click', ()=>{
    const nom = $('#npNom').value.trim();
    if(!nom){ $('#npNom').focus(); return; }
    const id = Math.max(0, ...PROYECTOS.map(p=>p.id)) + 1;
    PROYECTOS.push({
      id, nom, cliente: $('#npCli').value.trim() || '—', formato: $('#npFor').value,
      estado:'curso', presu:0, inicio:'', entrega:'', minPrograma:0, versiones:0, equipo:[ME.id],
      dueno:ME.id, flujoId: +($('#npFlujo')&&$('#npFlujo').value) || 2, pines:[]
    });
    estructuraEstudio(id);
    abreCarpetasPlantilla(id);
    cierra();
    initSelects();
    eligeProyecto(id);
    pintaExplora();
    toast(`«${nom}» creado`);
  });
}
function renombraProyecto(id){
  const p = proyById(id); if(!p) return;
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal">
    <div class="lbl" style="margin-bottom:12px">Renombrar</div>
    <h2>${esc(p.nom)}</h2>
    <input class="field" id="rpNom" value="${esc(p.nom)}">
    <div class="acts">
      <button class="btn" type="button" id="rpNo">Cancelar</button>
      <button class="btn btn-primary" type="button" id="rpOk">Guardar</button>
    </div>
  </div></div>`;
  $('#rpNom').focus(); $('#rpNom').select();
  $('#rpNo').addEventListener('click', ()=>{ $('#modalHost').innerHTML=''; });
  $('#rpOk').addEventListener('click', ()=>{
    p.nom = $('#rpNom').value.trim() || p.nom;
    $('#modalHost').innerHTML='';
    render();
  });
}
let exploraCompAbierto = true;
function pintaNodoProy(p, {ajeno}={}){
  const flecha = plegado => `<svg class="car2${plegado?' plegado':''}" width="11" height="11" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.6"><path d="M9 5l7 7-7 7"/></svg>`;
  const abierto = exploraAbiertos.has(p.id);
  const n = TAREAS.filter(t=>t.proyId===p.id && !esHecha(t)).length;
  const actual = prodProy===p.id && !prodCarpeta;
  const due = userById(duenoDe(p));
  let html = `<button type="button" class="exitem" data-tipo="proy" data-id="${p.id}" aria-current="${actual}">
    ${flecha(!abierto)}<i class="dotcat" style="background:${colorProyecto(p.id)}"></i>
    <span class="nom">${esc(p.nom)}${ajeno&&due?`<span class="exdue">te invitó ${esc(due.nom.split(' ')[0])}</span>`:''}</span>
    ${n?`<span class="cnt2">${n}</span>`:''}</button>`;
  if(abierto){
    const rama = (c, nivel)=>{
      const kids = hijosDe(p.id, c.id);
      const abiertaC = exploraCarpetasAbiertas.has(c.id);
      const sel = prodCarpeta===c.id;
      const nest = nivel>=3 ? ' nest nest3' : nivel>=2 ? ' nest nest2' : ' nest';
      html += `<button type="button" class="exitem${nest}" data-tipo="carpeta" data-id="${c.id}" aria-current="${sel}">
        ${kids.length ? flecha(!abiertaC) : ICO_CARPETA}${kids.length ? ICO_CARPETA : ''}
        <span class="nom">${esc(c.nom)}</span>
        <span class="cnt2">${cuentaRama(c, TAREAS)||''}</span></button>`;
      if(abiertaC) kids.forEach(h=>rama(h, nivel+1));
    };
    hijosDe(p.id, null).forEach(c=>rama(c, 1));
  }
  return html;
}
function pintaExplora(){
  const caja = $('#explora');
  const cajaComp = $('#exploraComp');
  if(!caja) return;
  const mios = proyectosMios();
  const ajenos = proyectosCompartidos();
  caja.innerHTML = mios.map(p=>{
    try{ return pintaNodoProy(p); }catch(err){ return ''; }
  }).join('') || '<p class="exvacio">Aún no hay proyectos tuyos. Pulsa +</p>';
  if(cajaComp){
    cajaComp.hidden = !exploraCompAbierto;
    cajaComp.innerHTML = exploraCompAbierto
      ? (ajenos.map(p=>{ try{ return pintaNodoProy(p, {ajeno:true}); }catch(err){ return ''; } }).join('')
        || '<p class="exvacio">Nadie te ha invitado todavía.</p>')
      : '';
  }
  const cnt = $('#compCnt');
  if(cnt) cnt.textContent = ajenos.length || '';
}

$('#btnNuevoProy').addEventListener('click', ev=>{ ev.stopPropagation(); nuevoProyecto(); });
function onExploraClick(ev){
  if(ev.target.closest('[data-toggle="comp"]')){
    exploraCompAbierto = !exploraCompAbierto;
    pintaExplora();
    return;
  }
  const btn = ev.target.closest('.exitem'); if(!btn) return;
  const id = +btn.dataset.id, tipo = btn.dataset.tipo;
  if(ev.target.closest('.car2') && tipo==='proy'){
    if(exploraAbiertos.has(id)) exploraAbiertos.delete(id);
    else { exploraAbiertos.add(id); abreCarpetasPlantilla(id); }
    pintaExplora();
    return;
  }
  if(ev.target.closest('.car2') && tipo==='carpeta'){
    exploraCarpetasAbiertas.has(id) ? exploraCarpetasAbiertas.delete(id) : exploraCarpetasAbiertas.add(id);
    pintaExplora();
    return;
  }
  if(tipo==='proy') eligeProyecto(id);
  else eligeCarpeta(id);
}
function onExploraMenu(ev){
  ev.preventDefault();
  const btn = ev.target.closest('.exitem');
  if(!btn){ menuFila(ev, 'vacio', 0); return; }
  menuFila(ev, btn.dataset.tipo, +btn.dataset.id);
}
['#explora','#exploraComp','#btnComp'].forEach(sel=>{
  const el = $(sel); if(!el) return;
  el.addEventListener('click', onExploraClick);
});
['#explora','#exploraComp'].forEach(sel=>{
  const el = $(sel); if(!el) return;
  el.addEventListener('contextmenu', onExploraMenu);
});
function saleDelProyecto(id){
  const p = proyById(id); if(!p || esMio(p)) return;
  p.equipo = (p.equipo||[]).filter(u=>u!==ME.id);
  if(prodProy===id){ prodProy = null; prodCarpeta = null; }
  render();
  toast(`Has salido de «${p.nom}»`);
}
function abreInvitar(proyId){
  const mios = proyectosMios();
  if(!mios.length){ toast('Crea un proyecto'); return; }
  const pref = proyId || prodProy;
  const inicial = mios.some(p=>p.id===pref) ? pref : mios[0].id;
  const pintaLista = pid => {
    const p = proyById(pid);
    const due = duenoDe(p);
    return USERS.filter(u=>u.activo).map(u=>{
      const on = (p.equipo||[]).includes(u.id);
      if(u.id===due) return `<div class="inv-row">
        <span class="avatar">${esc(u.ini)}</span>
        <span class="quien"><span class="qn">${esc(u.nom)}</span><span class="qs">@${esc(u.user)}</span></span>
        <span class="inv-tag">Dueño</span></div>`;
      return `<label class="inv-row">
        <input type="checkbox" value="${u.id}"${on?' checked':''}>
        <span class="avatar">${esc(u.ini)}</span>
        <span class="quien"><span class="qn">${esc(u.nom)}</span><span class="qs">@${esc(u.user)}</span></span>
      </label>`;
    }).join('');
  };
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal" style="max-width:440px">
    <div class="lbl" style="margin-bottom:12px">Invitar</div>
    <label class="lbl" for="invProy">Proyecto</label>
    <div class="row"><select class="field" id="invProy">${
      mios.map(p=>`<option value="${p.id}"${p.id===inicial?' selected':''}>${esc(p.nom)}</option>`).join('')
    }</select></div>
    <div class="inv-list" id="invList">${pintaLista(inicial)}</div>
    <div class="acts">
      <button class="btn" type="button" id="invNo">Cancelar</button>
      <button class="btn btn-primary" type="button" id="invOk">Guardar</button>
    </div>
  </div></div>`;
  const cierra = () => { $('#modalHost').innerHTML=''; };
  $('#invNo').addEventListener('click', cierra);
  $('#invProy').addEventListener('change', ()=>{ $('#invList').innerHTML = pintaLista(+$('#invProy').value); });
  $('#invOk').addEventListener('click', ()=>{
    const p = proyById(+$('#invProy').value); if(!p || !esMio(p)) return;
    const antes = new Set(p.equipo||[]);
    const ids = [duenoDe(p), ...$$('#invList input[type=checkbox]:checked').map(cb=>+cb.value)];
    p.equipo = [...new Set(ids)];
    p.equipo.filter(id=>!antes.has(id)).forEach(id=>{
      avisa(id, `${ME.nom} te ha invitado a «${p.nom}»`);
    });
    const nuevos = p.equipo.filter(id=>!antes.has(id)).length;
    if(nuevos) actua(p.id, `invitó a ${nuevos} persona${nuevos>1?'s':''}`);
    cierra();
    render();
    toast(nuevos ? `Invitación enviada a ${nuevos} persona${nuevos>1?'s':''}` : 'Equipo actualizado');
  });
}
$('#btnInvitar').addEventListener('click', ev=>{ ev.stopPropagation(); abreInvitar(prodProy); });

function ctxDesdeFila(ev){
  const tr = ev.target.closest('tr');
  if(!tr) return null;
  if(tr.dataset.fila) return ['tarea', +tr.dataset.fila];
  if(tr.dataset.tipo==='carpeta') return ['carpeta', +tr.dataset.id];
  if(tr.dataset.tipo==='proy') return ['proy', +tr.dataset.id];
  return null;
}
$('#wtabla').addEventListener('contextmenu', ev=>{
  ev.preventDefault();
  const hit = ctxDesdeFila(ev);
  if(hit){ menuFila(ev, hit[0], hit[1]); return; }
  if(prodProy){
    menuFila(ev, 'carpeta', (prodCarpeta || (BLOQUES.find(b=>b.proyId===prodProy)||{}).id || 0));
  }
});
$('#board').addEventListener('contextmenu', ev=>{
  const card = ev.target.closest('[data-tk]');
  if(!card) return;
  ev.preventDefault();
  menuFila(ev, 'tarea', +card.dataset.tk);
});

/* ---- tarjeta del tablero ---- */
function htmlTarjeta(t){
  const u = userById(t.asignado), p = proyById(t.proyId);
  const dias = t.fin ? Math.ceil((new Date(t.fin+'T23:59')-Date.now())/DAY) : null;
  const tarde = dias!==null && dias<0 && !esHecha(t);
  const subs = t.subtareas.length ? `${t.subtareas.filter(x=>x.hecha).length}/${t.subtareas.length}` : '';
  return `<div class="tk" data-tk="${t.id}" style="--pc:${colorProyecto(t.proyId)}">
    <div class="tt">${esc(t.titulo)}</div>
    <div class="tm">
      <span class="prio ${t.prioridad}" title="Prioridad ${PRIO[t.prioridad]}"></span>
      ${u?htmlAv(u, esc(u.nom)):''}
      ${t.fin?`<span class="fecha${tarde?' tarde':''}">${tarde?'venció ':''}${new Date(t.fin).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span>`:''}
      ${subs?`<span title="Subtareas">☑ ${subs}</span>`:''}
      ${t.comentarios.length?`<span title="Comentarios">💬 ${t.comentarios.length}</span>`:''}
      ${!prodProy?`<span style="color:${colorProyecto(t.proyId)}">${esc(p.nom.length>16?p.nom.slice(0,15)+'…':p.nom)}</span>`:''}
    </div></div>`;
}
function renderTablero(){
  barraProd($('#barraProd'), true);
  const ts = tareasVisibles();
  const b = $('#board');
  const ests = prodProy ? estadosDe(prodProy) : estadosVisibles();
  b.style.gridTemplateColumns = `repeat(${Math.max(1,ests.length)}, minmax(212px,1fr))`;
  b.innerHTML = ests.map(e=>{
    const col = ts.filter(t=>t.estado===e.id);
    return `<div class="col" data-col="${e.id}"><h3>
      <span class="estchip" style="--ec:${e.color}">${esc(e.nom)}</span> <b>${col.length}</b>
      <button class="colest" data-editest="${e.id}" title="Editar estado">✎</button></h3>
      <div class="drop">${col.map(htmlTarjeta).join('')}</div></div>`;
  }).join('');
  $$('#board [data-editest]').forEach(btn=>btn.addEventListener('click', ev=>{
    ev.stopPropagation();
    const flujo = prodProy ? flujoDe(prodProy) : flujoById(1);
    editaEstado(flujo, btn.dataset.editest);
  }));
}

/* ---- arrastrar tarjetas entre columnas ---- */
let arr = null;
$('#board').addEventListener('pointerdown', ev=>{
  const card = ev.target.closest('[data-tk]'); if(!card || ev.button!==0) return;
  arr = {id:+card.dataset.tk, el:card, x0:ev.clientX, y0:ev.clientY, movido:false, col:null};
  card.setPointerCapture(ev.pointerId);
});
$('#board').addEventListener('pointermove', ev=>{
  if(!arr) return;
  if(!arr.movido && Math.hypot(ev.clientX-arr.x0, ev.clientY-arr.y0) < 6) return;
  if(!arr.movido){ arr.movido = true; arr.el.classList.add('arrastrando'); }
  const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
  const col = bajo && bajo.closest('.col');
  $$('#board .col').forEach(c=>c.classList.toggle('over', c===col));
  arr.col = col;
});
$('#board').addEventListener('pointerup', ()=>{
  if(!arr) return;
  const a = arr; arr = null;
  $$('#board .col').forEach(c=>c.classList.remove('over'));
  a.el.classList.remove('arrastrando');
  /* clic simple: abrir la ficha. Se resuelve aquí porque el re-render
     sustituye la tarjeta y el evento «click» ya no llegaría a ella. */
  if(!a.movido){ abreTarea(a.id); return; }
  if(a.col){
    const t = tareaById(a.id), nuevo = a.col.dataset.col;
    if(t.estado !== nuevo){
      t.estado = nuevo;
      actua(t.proyId, `«${t.titulo}» → ${nomEstado(nuevo, t.proyId)}`);
      avisa(t.asignado, `${ME.nom} ha pasado «${t.titulo}» a ${nomEstado(nuevo, t.proyId)}`, t.id);
      toast(`«${t.titulo}» → ${nomEstado(nuevo, t.proyId)}`);
    }
  }
  render();
});

/* ================= TABLA DE ESCENAS (columnas configurables) ================= */
/* Cada columna declara su tipo; el tipo decide cómo se pinta y cómo se edita.
   Las columnas propias del estudio se añaden desde el botón «Columnas». */
let COLS = [
  {k:'titulo', ancho:300,    nom:'Nombre',        tipo:'titulo',   visible:true,  fija:true},
  {k:'estado', ancho:150,    nom:'Estado',        tipo:'estado',   visible:true},
  {k:'c_rodaje', ancho:150,  nom:'DIA DE RODAJE', tipo:'fecha',    visible:true,  propia:true},
  {k:'asignado', ancho:190,  nom:'Asignado',      tipo:'persona',  visible:true},
  {k:'prioridad', ancho:122, nom:'Prioridad',     tipo:'prio',     visible:false},
  {k:'fin', ancho:150,       nom:'Entrega',       tipo:'fecha',    visible:false},
  {k:'progreso', ancho:122,  nom:'Subtareas',     tipo:'progreso', visible:false,  ro:true},
  {k:'horas', ancho:95,     nom:'Horas',         tipo:'horas',    visible:false,  ro:true},
  {k:'bloque', ancho:200,    nom:'Carpeta',       tipo:'bloque',   visible:false},
  {k:'proyecto', ancho:185,  nom:'Proyecto',      tipo:'proyecto', visible:false, ro:true},
  {k:'coments', ancho:125,   nom:'Comentarios',   tipo:'coments',  visible:false, ro:true},
  {k:'c_material', ancho:160, nom:'Material',     tipo:'etiqueta', visible:false, propia:true,
   opciones:[{v:'Sin material', c:'var(--s8)'}, {v:'Ingestado', c:'var(--s4)'},
             {v:'Sincronizado', c:'var(--s3)'}]},
  {k:'c_dur', ancho:125,      nom:'Duración (min)', tipo:'numero', visible:false, propia:true},
  {k:'c_visto', ancho:140,    nom:'Visto dirección', tipo:'casilla', visible:false, propia:true}
];
let tablaOrden = {k:null, dir:1}, tablaGrupo = 'bloque', plegados = new Set();

/* algunos valores de ejemplo en las columnas propias */
(function semillaCampos(){
  const mat = ['Sincronizado','Ingestado','Sin material'];
  TAREAS.forEach((t,i)=>{
    t.campos = t.campos || {};
    t.campos.c_material = mat[i % 3];
    t.campos.c_dur = [3,5,8,12,2,6,4][i % 7];
    t.campos.c_visto = esHecha(t);
    t.campos.c_rodaje = t.fin || '';
  });
})();

const colVisibles = () => COLS.filter(c=>c.visible);
function valorCol(t, c){
  switch(c.k){
    case 'titulo':   return t.titulo;
    case 'estado':   return estadosDe(t.proyId).findIndex(e=>e.id===t.estado);
    case 'asignado': return t.asignado ? userById(t.asignado).nom : 'zzz';
    case 'prioridad':return ['alta','media','baja'].indexOf(t.prioridad);
    case 'fin':      return t.fin || '9999';
    case 'progreso': return t.subtareas.length ? t.subtareas.filter(x=>x.hecha).length/t.subtareas.length : -1;
    case 'horas':    return LC.puente.horasDeEscena(t.id);
    case 'bloque':   return bloqueById(t.bloqueId).nom;
    case 'proyecto': return proyById(t.proyId).nom;
    case 'coments':  return t.comentarios.length;
    default:         return (t.campos && t.campos[c.k]) ?? '';
  }
}
function claveGrupo(t){
  if(tablaGrupo === 'bloque')   return {k:'b'+t.bloqueId, nom:`${proyById(t.proyId).nom} · ${bloqueById(t.bloqueId).nom}`};
  if(tablaGrupo === 'estado')   return {k:'e'+t.estado,   nom:nomEstado(t.estado, t.proyId)};
  if(tablaGrupo === 'persona')  return {k:'u'+t.asignado, nom:t.asignado?userById(t.asignado).nom:'Sin asignar'};
  if(tablaGrupo === 'proyecto') return {k:'p'+t.proyId,   nom:proyById(t.proyId).nom};
  return {k:'todo', nom:'Todas'};
}

/* iniciales de la persona, como en Wrike: recuadro de color + abreviatura */
const TONO_AV = [
  {bg:'#c8e64a', fg:'#1a1a12'},
  {bg:'#2a78d6', fg:'#fff'},
  {bg:'#eb6834', fg:'#fff'},
  {bg:'#1baf7a', fg:'#fff'},
  {bg:'#e87ba4', fg:'#fff'},
  {bg:'#4a3aa7', fg:'#fff'},
  {bg:'#eda100', fg:'#1a1a12'},
  {bg:'#2ec4d6', fg:'#0e0e0e'}
];
function inicialPersona(u){
  if(!u) return '';
  if(u.ini) return u.ini;
  return (u.nom||'').split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?';
}
function tonoPersona(id){ return TONO_AV[Math.max(0, (id||0)-1) % TONO_AV.length]; }
function htmlAv(u, titulo){
  if(!u) return '';
  const t = tonoPersona(u.id);
  return `<span class="asig-av" style="background:${t.bg};color:${t.fg}"${titulo?` title="${titulo}"`:''}>${esc(inicialPersona(u))}</span>`;
}

/* ---- celdas ---- */
function celda(t, c){
  const id = t.id, at = `data-id="${id}" data-k="${c.k}"`;
  switch(c.tipo){
    case 'titulo':
      return `<div class="tname" data-abrir="${id}">
        <svg class="exp" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>
        <span class="tx">${esc(t.titulo)}</span></div>`;
    case 'estado': {
      const c2 = colorEstado(t.estado, t.proyId);
      return `<select class="cellctl chipsel" ${at}
        style="color:${c2};background:color-mix(in srgb, ${c2} 13%, transparent);border-color:color-mix(in srgb, ${c2} 26%, transparent)">${
        estadosDe(t.proyId).map(e=>`<option value="${e.id}"${e.id===t.estado?' selected':''}>${esc(e.nom)}</option>`).join('')}</select>`;
    }
    case 'persona': {
      const u = t.asignado ? userById(t.asignado) : null;
      return `<div class="asig">
        <div class="asig-face">${u?`${htmlAv(u)}<span class="asig-nom">${esc(u.nom)}</span>`
          :`<span class="asig-nom vacio">Sin asignar</span>`}</div>
        <select class="cellctl asig-sel${u?'':' vacio'}" ${at} title="${u?esc(u.nom):'Sin asignar'}">
          <option value="">Sin asignar</option>${
          USERS.filter(x=>x.activo).map(x=>`<option value="${x.id}"${x.id===t.asignado?' selected':''}>${esc(x.nom)}</option>`).join('')}
        </select></div>`;
    }
    case 'prio':
      return `<select class="cellctl" ${at}>${Object.entries(PRIO).map(([k,v])=>
        `<option value="${k}"${k===t.prioridad?' selected':''}>${v}</option>`).join('')}</select>`;
    case 'bloque':
      return `<select class="cellctl" ${at}>${BLOQUES.filter(b=>b.proyId===t.proyId).map(b=>
        `<option value="${b.id}"${b.id===t.bloqueId?' selected':''}>${esc(b.nom)}</option>`).join('')}</select>`;
    case 'fecha': {
      const v = (c.propia ? ((t.campos||{})[c.k]) : t[c.k]) || '';
      const tarde = v && new Date(v+'T23:59') < Date.now() && !esHecha(t);
      return `<input type="date" class="cellctl${tarde?' vencida':''}" ${at} value="${v}">`;
    }
    case 'progreso': {
      if(!t.subtareas.length) return '<div class="cellro" style="color:var(--muted)">—</div>';
      const h = t.subtareas.filter(x=>x.hecha).length, n = t.subtareas.length;
      return `<div class="miniprog"><span class="bar"><i style="width:${h/n*100}%"></i></span>
        <span style="color:var(--muted);font-size:11.5px">${h}/${n}</span></div>`;
    }
    case 'horas': {
      const sg = LC.puente.horasDeEscena(t.id);
      return `<div class="cellro" style="font-variant-numeric:tabular-nums">${sg?hhmm(sg)+' h':'<span style="color:var(--muted)">—</span>'}</div>`;
    }
    case 'proyecto':
      return `<div class="cellro"><span class="pill"><i class="dotcat" style="background:${colorProyecto(t.proyId)}"></i>${esc(proyById(t.proyId).nom)}</span></div>`;
    case 'coments':
      return `<div class="cellro" style="color:var(--muted)">${t.comentarios.length || '—'}</div>`;
    case 'etiqueta': {
      const v = (t.campos||{})[c.k] || '';
      const op = (c.opciones||[]).find(o=>o.v===v);
      return `<select class="cellctl${v?'':' vacio'}" ${at} style="${op?`color:${op.c};font-weight:600`:''}">
        <option value="">—</option>${(c.opciones||[]).map(o=>
        `<option value="${esc(o.v)}"${o.v===v?' selected':''}>${esc(o.v)}</option>`).join('')}</select>`;
    }
    case 'numero':
      return `<input type="number" class="cellctl" ${at} value="${(t.campos||{})[c.k] ?? ''}" style="width:90px">`;
    case 'casilla':
      return `<div style="padding:5px 8px"><input type="checkbox" ${at} ${(t.campos||{})[c.k]?'checked':''}
        style="width:15px;height:15px;accent-color:var(--ink)"></div>`;
    default:
      return `<input class="cellctl" ${at} value="${esc((t.campos||{})[c.k] ?? '')}">`;
  }
}

/* ---- vista de árbol: carpetas anidadas, como el Wrike del estudio ---- */
let vistaTabla = 'arbol';       /* 'arbol' | 'agrupada' */

const tareasDe = (bid, lista) => lista.filter(t=>t.bloqueId===bid);
/* nº de escenas que cuelgan de una carpeta, contando las subcarpetas */
function cuentaRama(c, lista){
  let n = tareasDe(c.id, lista).length;
  hijosDe(c.proyId, c.id).forEach(h=>n += cuentaRama(h, lista));
  return n;
}
function filasArbol(lista){
  const filas = [];
  const anda = (p, padre, n) => {
    hijosDe(p.id, padre).forEach(c=>{
      filas.push({t:'carpeta', o:c, n, cuenta:cuentaRama(c, lista)});
      if(plegados.has('c'+c.id)) return;
      anda(p, c.id, n+1);
      tareasDe(c.id, lista).forEach(t=>filas.push({t:'tarea', o:t, n:n+1}));
    });
  };
  if(prodCarpeta){
    const raiz = bloqueById(prodCarpeta);
    const p = raiz && proyById(raiz.proyId);
    if(raiz && p){
      filas.push({t:'carpeta', o:raiz, n:0, cuenta:cuentaRama(raiz, lista)});
      if(!plegados.has('c'+raiz.id)){
        anda(p, raiz.id, 1);
        tareasDe(raiz.id, lista).forEach(t=>filas.push({t:'tarea', o:t, n:1}));
      }
    }
    return filas;
  }
  const proys = prodProy ? PROYECTOS.filter(p=>p.id===prodProy) : PROYECTOS.filter(puedoVer);
  proys.forEach(p=>{
    const nivel0 = prodProy ? 0 : 1;
    if(!prodProy){
      filas.push({t:'proy', o:p, n:0, hijos:BLOQUES.filter(b=>b.proyId===p.id).length});
      if(plegados.has('p'+p.id)) return;
    }
    anda(p, null, nivel0);
  });
  return filas;
}
function pintaArbol(lista, cols){
  const filas = filasArbol(lista);
  const sangria = n => `padding-left:${6 + n*17}px`;
  const flecha = plegado => `<svg class="car2${plegado?' plegado':''}" width="11" height="11" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.6"><path d="M9 5l7 7-7 7"/></svg>`;
  let num = 0;
  return filas.map(f=>{
    if(f.t !== 'proy') num++;
    if(f.t === 'tarea'){
      const t = f.o;
      return `<tr data-fila="${t.id}" class="${seleccion.has(t.id)?'sel':''}">
        <td class="numcol"><div class="selstack"><span class="rownum">${num}</span>
          <input type="checkbox" class="selcb" data-selcb="${t.id}"${seleccion.has(t.id)?' checked':''}></div></td>` +
        cols.map((c,i)=>
        i===0
        ? `<td><div class="tname" data-abrir="${t.id}" style="${sangria(f.n)}">
             ${ICO_ESCENA}<span class="tx">${esc(t.titulo)}</span>${
               (t.adjuntos||[]).length?`<svg class="clip" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" title="Adjuntos"><path d="M21 12.5V7a5 5 0 00-10 0v11a3 3 0 006 0V8"/></svg>`:''
             }</div></td>`
        : `<td>${celda(t,c)}</td>`).join('') +
        `<td><button class="filaMenuBtn" data-menu="tarea:${t.id}" title="Más acciones">${ICO_MENU}</button></td>
        <td class="fillcol"></td></tr>`;
    }
    const plegado = plegados.has((f.t==='proy'?'p':'c')+f.o.id);
    const clave = (f.t==='proy'?'p':'c')+f.o.id;
    const editando = f.t==='carpeta' && carpetaEditando===f.o.id;
    const nom = f.t==='proy'
      ? `<span class="pill" style="gap:7px"><i class="dotcat" style="background:${colorProyecto(f.o.id)}"></i><b>${esc(f.o.nom)}</b></span>`
      : editando
        ? `${ICO_CARPETA}<input class="cedit" data-renombra="${f.o.id}" value="${esc(f.o.nom)}">`
        : `${ICO_CARPETA}<span class="cnom">${esc(f.o.nom)}</span>`;
    const cuenta = f.t==='proy' ? '' : (f.cuenta ? `<span class="cnt2">${f.cuenta}</span>` : '');
    const menuBtn = f.t==='carpeta'
      ? `<button class="filaMenuBtn" data-menu="carpeta:${f.o.id}" title="Más acciones">${ICO_MENU}</button>` : '';
    const proyDe = f.t==='proy' ? f.o.id : f.o.proyId;
    return `<tr class="crow${f.t==='proy'?' proyrow':''}" data-pleg="${clave}"
      data-tipo="${f.t}" data-id="${f.o.id}" data-proy="${proyDe}">
      <td class="numcol">${f.t==='proy'?'':num}</td>
      <td><div class="fname" style="${sangria(f.n)}">${flecha(plegado)}${nom}${cuenta}</div></td>
      ${cols.slice(1).map(()=>'<td></td>').join('')}<td>${menuBtn}</td><td class="fillcol"></td></tr>`;
  }).join('');
}

function renderTabla(){
  barraProd($('#barraProd2'), true, true);
  let ts = tareasVisibles();
  if(tablaOrden.k){
    const c = COLS.find(x=>x.k===tablaOrden.k);
    ts = [...ts].sort((a,b)=>{
      const va = valorCol(a,c), vb = valorCol(b,c);
      return (va > vb ? 1 : va < vb ? -1 : 0) * tablaOrden.dir;
    });
  }
  const cols = colVisibles();
  const arbolOn = vistaTabla === 'arbol';
  const cab = `<th class="numcol"><input type="checkbox" class="selcb" id="selAll" title="Seleccionar todas"></th>` +
    cols.map(c=>`<th data-col="${c.k}">${esc(c.nom)}${
      tablaOrden.k===c.k ? `<span class="ord">${tablaOrden.dir>0?'▲':'▼'}</span>` : ''
      }<span class="colhandle" data-resize="${c.k}"></span></th>`).join('') +
    '<th class="addcol" id="thAdd">+</th><th class="fillcol"></th>';

  /* agrupar conservando el orden de aparición */
  const grupos = [];
  ts.forEach(t=>{
    const g = claveGrupo(t);
    let e = grupos.find(x=>x.k===g.k);
    if(!e){ e = {k:g.k, nom:g.nom, items:[]}; grupos.push(e); }
    e.items.push(t);
  });

  const filas = arbolOn ? pintaArbol(ts, cols) : grupos.map(g=>{
    const plegado = plegados.has(g.k);
    const hechas = g.items.filter(t=>esHecha(t)).length;
    const cab2 = tablaGrupo==='ninguno' ? '' :
      `<tr class="grow${plegado?' plegado':''}" data-grupo="${esc(g.k)}">
        <td colspan="${cols.length+3}"><span class="glab"><span class="car">▼</span> ${esc(g.nom)}
          <span class="cnt">${g.items.length} tareas · ${hechas} hechas</span></span></td></tr>`;
    const cuerpo = plegado ? '' : g.items.map(t=>
      `<tr data-fila="${t.id}" class="${seleccion.has(t.id)?'sel':''}">
        <td class="numcol"><input type="checkbox" class="selcb visible-siempre" data-selcb="${t.id}"${seleccion.has(t.id)?' checked':''}></td>
        ${cols.map(c=>`<td>${celda(t,c)}</td>`).join('')}
        <td><button class="filaMenuBtn" data-menu="tarea:${t.id}" title="Más acciones">${ICO_MENU}</button></td>
        <td class="fillcol"></td></tr>`).join('');
    return cab2 + cuerpo;
  }).join('');

  const anchoTotal = cols.reduce((a,c)=>a+(c.ancho||140), 0) + 52 + 40;
  const cg = `<colgroup><col style="width:52px">${
    cols.map(c=>`<col style="width:${c.ancho||140}px">`).join('')}<col style="width:40px"><col></colgroup>`;
  $('#wtabla').style.width = '100%';
  $('#wtabla').style.minWidth = anchoTotal+'px';
  const hayCuerpo = arbolOn ? filasArbol(ts).length : ts.length;
  $('#wtabla').innerHTML = cg + `<thead><tr>${cab}</tr></thead><tbody>${
    hayCuerpo ? filas : `<tr><td colspan="${cols.length+3}"><p class="empty">Nada que mostrar. Escribe un nombre abajo y pulsa Añadir.</p></td></tr>`}</tbody>`;
  $('#tablaPie').textContent = `${ts.length} tareas · ${cols.length} columnas${seleccion.size?` · ${seleccion.size} seleccionada${seleccion.size>1?'s':''}`:''}`;

  /* ---- interacción: ordenar, plegar, abrir ---- */
  $$('#wtabla th[data-col]').forEach(th=>th.addEventListener('click', ev=>{
    if(ev.target.closest('[data-resize]') || colDrag) return;
    const k = th.dataset.col;
    tablaOrden = tablaOrden.k===k ? {k, dir:-tablaOrden.dir} : {k, dir:1};
    render();
  }));
  $$('#wtabla .grow').forEach(tr=>tr.addEventListener('click', ()=>{
    const k = tr.dataset.grupo;
    plegados.has(k) ? plegados.delete(k) : plegados.add(k);
    render();
  }));
  $$('#wtabla [data-abrir]').forEach(el=>el.addEventListener('click', ()=>abreTarea(+el.dataset.abrir)));
  $$('#wtabla [data-pleg]').forEach(tr=>tr.addEventListener('click', ev=>{
    if(ev.target.closest('[data-k]') || ev.target.closest('[data-renombra]') || ev.target.closest('.filaMenuBtn')) return;
    const k = tr.dataset.pleg;
    plegados.has(k) ? plegados.delete(k) : plegados.add(k);
    render();
  }));
  const add = $('#thAdd');
  if(add) add.addEventListener('click', ev=>{ ev.stopPropagation(); popColumnas(ev); });
  $$('#wtabla [data-k]').forEach(el=>el.addEventListener('change', ()=>{
    const t = tareaById(+el.dataset.id), k = el.dataset.k, c = COLS.find(x=>x.k===k);
    if(!t) return;
    if(c.propia){
      t.campos = t.campos || {};
      t.campos[k] = c.tipo==='casilla' ? el.checked : (c.tipo==='numero' ? (el.value===''?null:+el.value) : el.value);
    } else if(k==='asignado'){
      const v = el.value ? +el.value : null;
      if(v !== t.asignado){
        t.asignado = v;
        actua(t.proyId, v ? `asignó «${t.titulo}» a ${(userById(v)||{}).nom}` : `desasignó «${t.titulo}»`);
        if(v){ avisa(v, `${ME.nom} te ha asignado «${t.titulo}» (${proyById(t.proyId).nom})`, t.id);
               if(v!==ME.id) toast(`Avisado a ${userById(v).nom.split(' ')[0]}`); }
      }
    } else if(k==='estado'){
      if(el.value !== t.estado){
        t.estado = el.value;
        actua(t.proyId, `«${t.titulo}» → ${nomEstado(t.estado, t.proyId)}`);
        avisa(t.asignado, `${ME.nom} ha pasado «${t.titulo}» a ${nomEstado(t.estado, t.proyId)}`, t.id);
      }
    } else if(k==='bloque'){ t.bloqueId = +el.value;
    } else { t[k] = el.value; }
    render();
  }));

  /* ---- selección múltiple ---- */
  $$('#wtabla [data-selcb]').forEach(cb=>cb.addEventListener('change', ()=>{
    const id = +cb.dataset.selcb;
    cb.checked ? seleccion.add(id) : seleccion.delete(id);
    render();
  }));
  const selAll = $('#selAll');
  if(selAll){
    const visibles = ts.map(t=>t.id);
    selAll.checked = visibles.length>0 && visibles.every(id=>seleccion.has(id));
    selAll.indeterminate = !selAll.checked && visibles.some(id=>seleccion.has(id));
    selAll.addEventListener('change', ()=>{
      visibles.forEach(id=> selAll.checked ? seleccion.add(id) : seleccion.delete(id));
      render();
    });
  }

  /* ---- menú de acciones por fila ---- */
  $$('#wtabla [data-menu]').forEach(b=>b.addEventListener('click', ev=>{
    const [tipo, id] = b.dataset.menu.split(':');
    b.classList.add('on');
    menuFila(ev, tipo, +id);
  }));

  /* ---- renombrar carpeta en línea ---- */
  const ce = $('#wtabla [data-renombra]');
  if(ce){
    ce.focus(); ce.select();
    const commit = () => renombraCarpeta(+ce.dataset.renombra, ce.value);
    ce.addEventListener('keydown', ev=>{
      if(ev.key==='Enter'){ ev.preventDefault(); commit(); }
      else if(ev.key==='Escape'){ ev.preventDefault(); carpetaEditando=null; render(); }
    });
    ce.addEventListener('blur', commit);
    ce.addEventListener('click', ev=>ev.stopPropagation());
    ce.addEventListener('pointerdown', ev=>ev.stopPropagation());
  }
  $$('#wtabla .fname .cnom').forEach(sp=>sp.addEventListener('dblclick', ev=>{
    ev.stopPropagation();
    const tr = sp.closest('[data-pleg]');
    if(tr && tr.dataset.tipo==='carpeta'){ carpetaEditando = +tr.dataset.id; render(); }
  }));
}

/* ---- arrastrar en el árbol: mover una escena o una carpeta a otro sitio ----
   Solo activo en la vista Árbol. Se reconoce como arrastre real (y no como
   un simple clic) cuando el puntero se mueve más de unos pocos píxeles;
   por debajo de ese umbral, el clic de siempre (abrir escena / plegar
   carpeta) sigue funcionando exactamente igual que antes. */
let dragArbol = null;
$('#wtabla').addEventListener('pointerdown', ev=>{
  if(vistaTabla!=='arbol' || ev.button!==0) return;
  if(ev.target.closest('[data-renombra]') || ev.target.closest('.selcb') || ev.target.closest('.filaMenuBtn')) return;
  const nameEl = ev.target.closest('.tname[data-abrir], .fname');
  if(!nameEl) return;
  let tipo, id, proyId, texto;
  if(nameEl.classList.contains('tname')){
    const t = tareaById(+nameEl.dataset.abrir); if(!t) return;
    tipo = 'tarea'; id = t.id; proyId = t.proyId; texto = t.titulo;
  } else {
    const tr = nameEl.closest('[data-pleg]');
    if(!tr || tr.dataset.tipo !== 'carpeta') return;  /* la fila de proyecto no se arrastra */
    const c = bloqueById(+tr.dataset.id); if(!c) return;
    tipo = 'carpeta'; id = c.id; proyId = c.proyId; texto = c.nom;
  }
  dragArbol = {tipo, id, proyId, texto, x0:ev.clientX, y0:ev.clientY, movido:false,
    tr: nameEl.closest('tr')};
});
document.addEventListener('pointermove', ev=>{
  if(!dragArbol) return;
  if(!dragArbol.movido && Math.hypot(ev.clientX-dragArbol.x0, ev.clientY-dragArbol.y0) < 6) return;
  if(!dragArbol.movido){
    dragArbol.movido = true;
    document.body.classList.add('sin-seleccion');
    dragArbol.tr.classList.add('arrastrando');
    dragArbol.fantasma = document.createElement('div');
    dragArbol.fantasma.className = 'arrastrando-fantasma';
    dragArbol.fantasma.textContent = (dragArbol.tipo==='carpeta' ? '📁 ' : '') + dragArbol.texto;
    document.body.appendChild(dragArbol.fantasma);
  }
  dragArbol.fantasma.style.left = (ev.clientX+14)+'px';
  dragArbol.fantasma.style.top  = (ev.clientY+10)+'px';
  $$('#wtabla tr.dragover').forEach(tr=>tr.classList.remove('dragover'));
  const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
  const trBajo = bajo && bajo.closest('tr[data-pleg]');
  if(trBajo && trBajo!==dragArbol.tr){
    const destProy = +trBajo.dataset.proy;
    const invalido = destProy !== dragArbol.proyId ||
      (dragArbol.tipo==='carpeta' && trBajo.dataset.tipo==='carpeta' &&
        (+trBajo.dataset.id===dragArbol.id || esDescendienteDe(+trBajo.dataset.id, dragArbol.id)));
    if(!invalido) trBajo.classList.add('dragover');
  }
});
document.addEventListener('pointerup', ev=>{
  if(!dragArbol) return;
  const d = dragArbol; dragArbol = null;
  if(d.fantasma) d.fantasma.remove();
  if(d.tr) d.tr.classList.remove('arrastrando');
  $$('#wtabla tr.dragover').forEach(tr=>tr.classList.remove('dragover'));
  if(!d.movido) return;  /* fue un clic normal: lo gestionan los listeners de siempre */
  const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
  const trBajo = bajo && bajo.closest('tr[data-pleg]');
  if(!trBajo || trBajo===d.tr) return;
  const destProy = +trBajo.dataset.proy;
  if(destProy !== d.proyId){ toast('Solo puedes mover dentro del mismo proyecto'); return; }
  const destTipo = trBajo.dataset.tipo, destId = +trBajo.dataset.id;
  if(d.tipo==='tarea'){
    const t = tareaById(d.id);
    let destino = destTipo==='proy' ? null : destId;
    if(destino==null){
      let raiz = BLOQUES.find(b=>b.proyId===d.proyId && b.padre===null);
      if(!raiz){ raiz = {id:nextBloque++, proyId:d.proyId, nom:'Sin clasificar', padre:null}; BLOQUES.push(raiz); }
      destino = raiz.id;
    }
    if(destino !== t.bloqueId){
      t.bloqueId = destino; render();
      toast(`«${t.titulo}» movida a «${bloqueById(destino).nom}»`);
    }
  } else {
    if(destTipo==='carpeta' && (destId===d.id || esDescendienteDe(destId, d.id))) return;
    const c = bloqueById(d.id);
    const nuevoPadre = destTipo==='proy' ? null : destId;
    if(nuevoPadre !== c.padre){
      c.padre = nuevoPadre; render();
      toast(`Carpeta «${c.nom}» movida`);
    }
  }
});

/* al soltar el puntero, se reactiva siempre la selección de texto normal */
document.addEventListener('pointerup', ()=>document.body.classList.remove('sin-seleccion'));

/* ---- redimensionar columnas arrastrando el borde derecho de la cabecera ---- */
let colResize = null;
function anchoTabla(){
  const cols = colVisibles();
  const total = cols.reduce((a,c)=>a+(c.ancho||140), 0) + 52 + 40;
  const t = $('#wtabla'); if(!t) return;
  t.style.width = '100%';
  t.style.minWidth = total+'px';
}
$('#wtabla').addEventListener('pointerdown', ev=>{
  const h = ev.target.closest('[data-resize]'); if(!h) return;
  ev.preventDefault(); ev.stopPropagation();
  const c = COLS.find(x=>x.k===h.dataset.resize); if(!c) return;
  colResize = {k:c.k, startX:ev.clientX, startW:c.ancho||140};
  document.body.classList.add('sin-seleccion');
  h.classList.add('activo');
  if(h.setPointerCapture) h.setPointerCapture(ev.pointerId);
});
document.addEventListener('pointermove', ev=>{
  if(!colResize) return;
  const c = COLS.find(x=>x.k===colResize.k); if(!c) return;
  c.ancho = Math.max(64, colResize.startW + (ev.clientX - colResize.startX));
  const idx = colVisibles().findIndex(x=>x.k===colResize.k);
  const colEl = document.querySelectorAll('#wtabla colgroup col')[idx+1];
  if(colEl) colEl.style.width = c.ancho+'px';
  anchoTabla();
});
document.addEventListener('pointerup', ()=>{
  if(!colResize) return;
  colResize = null;
  $$('#wtabla .colhandle.activo').forEach(h=>h.classList.remove('activo'));
});

/* ---- reordenar columnas arrastrando la cabecera ---- */
let colDrag = null;
$('#wtabla').addEventListener('pointerdown', ev=>{
  if(ev.target.closest('[data-resize]')) return;
  const th = ev.target.closest('th[data-col]'); if(!th) return;
  const c = COLS.find(x=>x.k===th.dataset.col);
  if(!c || c.fija) return;  /* la columna «Escena» siempre va primero */
  colDrag = {k:c.k, x0:ev.clientX, y0:ev.clientY, movido:false, th};
});
document.addEventListener('pointermove', ev=>{
  if(!colDrag) return;
  if(!colDrag.movido && Math.hypot(ev.clientX-colDrag.x0, ev.clientY-colDrag.y0) < 6) return;
  if(!colDrag.movido){ colDrag.movido = true; colDrag.th.classList.add('arrastrandocol');
    document.body.classList.add('sin-seleccion'); }
  $$('#wtabla th.col-antes,#wtabla th.col-despues').forEach(el=>el.classList.remove('col-antes','col-despues'));
  const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
  const thBajo = bajo && bajo.closest('th[data-col]');
  if(thBajo && thBajo!==colDrag.th){
    const destC = COLS.find(x=>x.k===thBajo.dataset.col);
    const r = thBajo.getBoundingClientRect();
    let antes = ev.clientX < r.left + r.width/2;
    if(destC && destC.fija) antes = false;  /* nunca delante de «Escena» */
    thBajo.classList.add(antes ? 'col-antes' : 'col-despues');
  }
});
document.addEventListener('pointerup', ()=>{
  if(!colDrag) return;
  const d = colDrag; colDrag = null;
  d.th.classList.remove('arrastrandocol');
  const marcado = $('#wtabla th.col-antes') || $('#wtabla th.col-despues');
  const antes = !!$('#wtabla th.col-antes');
  $$('#wtabla th.col-antes,#wtabla th.col-despues').forEach(el=>el.classList.remove('col-antes','col-despues'));
  if(!d.movido || !marcado) return;
  const destK = marcado.dataset.col;
  if(destK===d.k) return;
  const origen = COLS.find(x=>x.k===d.k);
  COLS = COLS.filter(x=>x.k!==d.k);
  let idx = COLS.findIndex(x=>x.k===destK);
  if(!antes) idx += 1;
  COLS.splice(idx, 0, origen);
  render();
});

/* ---- barra de acciones en lote, sobre las escenas seleccionadas en la Tabla ---- */
function pintaBulk(){
  const host = $('#bulkHost');
  [...seleccion].forEach(id=>{ if(!tareaById(id)) seleccion.delete(id); });
  if(vista!=='tabla' || !seleccion.size){ host.innerHTML=''; return; }
  const tareasSel = [...seleccion].map(tareaById);
  const proyUnico = tareasSel.every(t=>t.proyId===tareasSel[0].proyId) ? tareasSel[0].proyId : null;
  const carpetasDisp = proyUnico ? BLOQUES.filter(b=>b.proyId===proyUnico) : [];
  host.innerHTML = `<div class="bulkbar">
    <span><b>${seleccion.size}</b> seleccionada${seleccion.size>1?'s':''}</span>
    <select id="bkAsig"><option value="">Asignar</option>
      ${USERS.filter(u=>u.activo).map(u=>`<option value="${u.id}">${esc(u.nom)}</option>`).join('')}
      <option value="__ninguno">Sin asignar</option></select>
    <select id="bkEstado"><option value="">Estado</option>
      ${estadosVisibles().map(e=>`<option value="${e.id}">${esc(e.nom)}</option>`).join('')}</select>
    <select id="bkCarpeta"${proyUnico?'':' disabled'}>
      <option value="">Carpeta</option>${carpetasDisp.map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select>
    <button class="btn" id="bkCancelar">Cancelar</button>
    <button class="btn btn-danger" id="bkBorrar">Eliminar</button>
  </div>`;
  $('#bkAsig').addEventListener('change', e=>{
    const v = e.target.value; if(!v) return;
    const nuevo = v==='__ninguno' ? null : +v;
    seleccion.forEach(id=>{ const t=tareaById(id); if(!t) return; t.asignado = nuevo;
      if(nuevo) avisa(nuevo, `${ME.nom} te ha asignado «${t.titulo}» (${proyById(t.proyId).nom})`, t.id); });
    toast('Asignado');
    render();
  });
  $('#bkEstado').addEventListener('change', e=>{
    const v = e.target.value; if(!v) return;
    seleccion.forEach(id=>{ const t=tareaById(id); if(!t || t.estado===v) return;
      t.estado = v; avisa(t.asignado, `${ME.nom} ha pasado «${t.titulo}» a ${nomEstado(v, t.proyId)}`, t.id); });
    toast('Estado actualizado');
    render();
  });
  const bc = $('#bkCarpeta');
  if(proyUnico) bc.addEventListener('change', e=>{
    const v = e.target.value; if(!v) return;
    seleccion.forEach(id=>{ const t=tareaById(id); if(t) t.bloqueId = +v; });
    toast('Movidas');
    render();
  });
  $('#bkCancelar').addEventListener('click', ()=>{ seleccion.clear(); render(); });
  $('#bkBorrar').addEventListener('click', ()=>{
    const n = seleccion.size;
    const copias = [...seleccion].map(id=>({...tareaById(id)}));
    TAREAS = TAREAS.filter(t=>!seleccion.has(t.id));
    seleccion.forEach(id=>LC.puente.desenlazarEscena(id));
    seleccion.clear(); render();
    toast(`${n} eliminada${n>1?'s':''}`, 'Deshacer', ()=>{ copias.forEach(c=>TAREAS.push(c)); render(); });
  });
}

/* ---- selector de columnas ---- */
function popColumnas(ev){
  const host = $('#popHost');
  if($('#colPop')){ host.innerHTML=''; return; }
  host.innerHTML = `<div class="colpop" id="colPop">
    <div class="lbl" style="margin-bottom:10px">Columnas</div>
    ${COLS.map(c=>`<label class="colitem">
      <input type="checkbox" data-col="${c.k}"${c.visible?' checked':''}${c.fija?' disabled':''}>
      <span>${esc(c.nom)}</span>
      ${c.propia?`<button class="icon-btn" data-borrar="${c.k}" title="Eliminar">✕</button>`:''}
    </label>`).join('')}
    <form class="colnew" id="colNewForm">
      <input id="cnNom" placeholder="Nueva columna" required>
      <select id="cnTipo">
        <option value="texto">Texto</option>
        <option value="etiqueta">Lista</option>
        <option value="numero">Número</option>
        <option value="casilla">Casilla</option>
        <option value="fecha">Fecha</option>
      </select>
      <input id="cnOps" placeholder="Opciones, separadas por comas" class="hide">
      <button class="btn btn-primary btn-sm" type="submit" style="padding:8px">Añadir</button>
    </form></div>`;
  const pop = $('#colPop'), r = pop.getBoundingClientRect();
  pop.style.left = Math.max(10, Math.min(ev.clientX-40, innerWidth-r.width-12))+'px';
  pop.style.top  = Math.min(ev.clientY+14, innerHeight-r.height-12)+'px';
  $$('#colPop [data-col]').forEach(cb=>cb.addEventListener('change', ()=>{
    COLS.find(c=>c.k===cb.dataset.col).visible = cb.checked; render();
  }));
  $$('#colPop [data-borrar]').forEach(b=>b.addEventListener('click', ev2=>{
    ev2.preventDefault(); ev2.stopPropagation();
    const k = b.dataset.borrar;
    COLS = COLS.filter(c=>c.k!==k);
    host.innerHTML=''; render(); toast('Columna eliminada');
  }));
  $('#cnTipo').addEventListener('change', e=>$('#cnOps').classList.toggle('hide', e.target.value!=='etiqueta'));
  $('#colNewForm').addEventListener('submit', ev2=>{
    ev2.preventDefault();
    const nom = $('#cnNom').value.trim(); if(!nom) return;
    const tipo = $('#cnTipo').value;
    const col = {k:'c_'+Date.now().toString(36), nom, tipo, visible:true, propia:true,
      ancho: tipo==='casilla'?130 : tipo==='numero'?125 : tipo==='fecha'?150 : 165};
    if(tipo==='etiqueta'){
      const paleta = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s7)'];
      col.opciones = $('#cnOps').value.split(',').map(x=>x.trim()).filter(Boolean)
        .map((v,i)=>({v, c:paleta[i%paleta.length]}));
      if(!col.opciones.length) col.opciones = [{v:'Sí', c:'var(--s3)'}, {v:'No', c:'var(--s8)'}];
    }
    COLS.push(col); host.innerHTML=''; render();
    toast(`Columna «${nom}» añadida`);
  });
  $('#cnNom').focus();
}

function asignaFlujo(proyId, flujoId){
  const p = proyById(proyId); if(!p) return;
  const flujo = flujoById(flujoId);
  p.flujoId = flujo.id;
  const mapGrupo = {};
  flujo.estados.forEach(e=>{ if(!mapGrupo[e.grupo]) mapGrupo[e.grupo]=e.id; });
  TAREAS.filter(t=>t.proyId===proyId).forEach(t=>{
    if(flujo.estados.some(e=>e.id===t.estado)) return;
    const g = grupoEstado(t.estado, null);
    t.estado = mapGrupo[g] || primerActivo(proyId).id;
  });
  guardaFlujos();
  toast(flujo.nom);
  render();
}
function popFlujos(ev){
  const host = $('#popHost');
  const p = prodProy ? proyById(prodProy) : null;
  host.innerHTML = `<div class="menupop" id="flujoPop" style="width:260px">
    <div class="lbl" style="padding:6px 10px 8px">${p?'Flujo':'Flujos'}</div>
    ${p?FLUJOS.map(f=>`<button class="mitem" data-fid="${f.id}">${f.id===p.flujoId?'<b>':''}${esc(f.nom)}${f.id===p.flujoId?'</b> · actual':''}</button>`).join(''):''}
    <div class="msep"></div>
    <button class="mitem" id="fwEditar">Editar perfiles…</button>
    <button class="mitem" id="fwNuevo">Crear perfil nuevo</button>
  </div>`;
  const pop = $('#flujoPop'), r = pop.getBoundingClientRect();
  pop.style.left = Math.max(10, Math.min(ev.clientX, innerWidth-r.width-12))+'px';
  pop.style.top = Math.min(ev.clientY+8, innerHeight-r.height-12)+'px';
  $$('#flujoPop [data-fid]').forEach(b=>b.addEventListener('click', ()=>{
    host.innerHTML=''; asignaFlujo(p.id, +b.dataset.fid);
  }));
  $('#fwEditar').addEventListener('click', ()=>{ host.innerHTML=''; go('flujos'); });
  $('#fwNuevo').addEventListener('click', ()=>{ host.innerHTML=''; nuevoFlujo(); });
}
function nuevoFlujo(){
  const f = {id:nextFlujo++, nom:'Perfil nuevo', desc:'', fijo:false, estados:[
    {id:'e'+nextEstId++, nom:'Nueva', grupo:'activo', color:'#8a8a85'},
    {id:'e'+nextEstId++, nom:'Completada', grupo:'completado', color:'#1baf7a'}
  ]};
  FLUJOS.push(f); guardaFlujos();
  go('flujos');
  setTimeout(()=>abreEditorFlujo(f.id), 0);
}
function renderFlujos(){
  const caja = $('#flujosBox');
  caja.innerHTML = `<div class="fw-top">
    <div></div>
    <button class="btn btn-primary" id="fwCrear">Nuevo perfil</button>
  </div>
  <div class="fw-grid">${FLUJOS.map(f=>{
    const n = PROYECTOS.filter(p=> (p.flujoId||1)===f.id).length;
    return `<button type="button" class="fw-card" data-fw="${f.id}">
      <h3>${esc(f.nom)}</h3>
      <p class="cap" style="margin:0">${n} proyecto${n===1?'':'s'}</p>
      <div class="chips">${f.estados.map(e=>`<span class="estchip" style="--ec:${e.color}">${esc(e.nom)}</span>`).join('')}</div>
    </button>`;
  }).join('')}</div>`;
  $('#fwCrear').addEventListener('click', nuevoFlujo);
  $$('#flujosBox [data-fw]').forEach(b=>b.addEventListener('click', ()=>abreEditorFlujo(+b.dataset.fw)));
}
function abreEditorFlujo(id){
  const f = flujoById(id); if(!f) return;
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal" style="max-width:980px">
    <div class="lbl" style="margin-bottom:12px">Editar perfil</div>
    <input class="field" id="fwNom" value="${esc(f.nom)}" style="margin-bottom:8px">
    <input class="field" id="fwDesc" value="${esc(f.desc||'')}" placeholder="Descripción">
    <div class="fw-ed" id="fwEd"></div>
    <div class="acts">
      ${f.fijo?'':'<button class="btn btn-danger" type="button" id="fwBorrar">Eliminar perfil</button>'}
      <button class="btn" type="button" id="fwCerrar">Cerrar</button>
    </div>
  </div></div>`;
  const pintaCols = () => {
    $('#fwEd').innerHTML = GRUPOS_EST.map(g=>{
      const lista = f.estados.filter(e=>e.grupo===g.id);
      return `<div class="fw-col" data-g="${g.id}">
        <h3>${g.nom}</h3>
        ${lista.map(e=>`<button type="button" class="fw-st" data-eid="${e.id}">
          <i class="dot" style="background:${e.color}"></i><span>${esc(e.nom)}</span></button>`).join('')}
        <button type="button" class="fw-add" data-add="${g.id}">+ Añadir estado</button>
      </div>`;
    }).join('');
    $$('#fwEd [data-eid]').forEach(b=>b.addEventListener('click', ()=>editaEstado(f, b.dataset.eid, pintaCols)));
    $$('#fwEd [data-add]').forEach(b=>b.addEventListener('click', ()=>{
      f.estados.push({id:'e'+nextEstId++, nom:'Estado nuevo', grupo:b.dataset.add, color:COLORES_EST[f.estados.length%COLORES_EST.length]});
      guardaFlujos(); pintaCols();
    }));
  };
  pintaCols();
  $('#fwNom').addEventListener('change', ()=>{ f.nom=$('#fwNom').value.trim()||f.nom; guardaFlujos(); });
  $('#fwDesc').addEventListener('change', ()=>{ f.desc=$('#fwDesc').value.trim(); guardaFlujos(); });
  $('#fwCerrar').addEventListener('click', ()=>{ $('#modalHost').innerHTML=''; render(); });
  const del = $('#fwBorrar');
  if(del) del.addEventListener('click', ()=>{
    if(PROYECTOS.some(p=>(p.flujoId||1)===f.id)){
      toast('Reasigna antes los proyectos que usan este perfil'); return;
    }
    FLUJOS = FLUJOS.filter(x=>x.id!==f.id); guardaFlujos();
    $('#modalHost').innerHTML=''; render();
  });
}
function editaEstado(flujo, estId, alCerrar){
  const e = flujo.estados.find(x=>x.id===estId); if(!e) return;
  const esPrimeroGrupo = flujo.estados.filter(x=>x.grupo===e.grupo)[0]===e
    && (e.grupo==='activo' || e.grupo==='completado');
  $('#modalHost').insertAdjacentHTML('beforeend', `<div class="overlay" id="estOverlay"><div class="modal">
    <div class="lbl" style="margin-bottom:12px">Estado</div>
    <input class="field" id="esNom" value="${esc(e.nom)}">
    <div class="lbl" style="margin:12px 0 6px">Color</div>
    <div class="paleta">${COLORES_EST.map(c=>`<button type="button" data-c="${c}" class="${c===e.color?'on':''}" style="background:${c}"></button>`).join('')}</div>
    <div class="acts">
      ${esPrimeroGrupo?'':'<button class="btn btn-danger" type="button" id="esDel">Eliminar</button>'}
      <button class="btn btn-primary" type="button" id="esOk">Guardar</button>
    </div>
  </div></div>`);
  $$('#estOverlay [data-c]').forEach(b=>b.addEventListener('click', ()=>{
    $$('#estOverlay [data-c]').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); e.color = b.dataset.c;
  }));
  $('#esOk').addEventListener('click', ()=>{
    e.nom = $('#esNom').value.trim() || e.nom;
    guardaFlujos();
    $('#estOverlay').remove();
    if(alCerrar) alCerrar(); else render();
  });
  const d = $('#esDel');
  if(d) d.addEventListener('click', ()=>{
    const usadas = TAREAS.filter(t=>t.estado===e.id).length;
    if(usadas){ toast('Hay tareas en este estado'); return; }
    flujo.estados = flujo.estados.filter(x=>x.id!==e.id);
    guardaFlujos(); $('#estOverlay').remove();
    if(alCerrar) alCerrar(); else render();
  });
}

/* ---- mis tareas: lo asignado a esa persona, de todos los proyectos ---- */
function renderMisTareas(){
  const quien = (ME.rol==='admin' && misQuien!=null) ? +misQuien : ME.id;
  const uQuien = userById(quien);
  const mias = TAREAS.filter(t=>esAsignadaA(t, quien))
    .sort((a,b)=>(esHecha(a))-(esHecha(b)) || (a.fin||'9').localeCompare(b.fin||'9'));
  const barra = $('#barraMis');
  if(ME.rol==='admin'){
    barra.classList.remove('hide');
    barra.innerHTML = `<div class="misquien">${USERS.filter(u=>u.activo).map(u=>{
      const n = TAREAS.filter(t=>esAsignadaA(t, u.id) && !esHecha(t)).length;
      return `<button type="button" data-quien="${u.id}" aria-pressed="${u.id===quien}">
        ${htmlAv(u)}<span>${esc(u.nom.split(' ')[0])}</span>${n?`<b>${n}</b>`:''}</button>`;
    }).join('')}</div>`;
    $$('#barraMis [data-quien]').forEach(b=>b.addEventListener('click', ()=>{
      misQuien = +b.dataset.quien; render();
    }));
  } else {
    barra.innerHTML = '';
    barra.classList.add('hide');
  }
  const vacio = quien===ME.id
    ? 'Nada asignado a ti.'
    : `Nada asignado a ${esc((uQuien||{}).nom||'esta persona')}.`;
  $('#tablaMis').innerHTML = mias.length ? `<table><thead><tr>
    <th>Tarea</th><th>Proyecto</th><th>Estado</th><th>Prioridad</th><th class="num">Entrega</th>
    </tr></thead><tbody>${mias.map(t=>{
      const dias = t.fin ? Math.ceil((new Date(t.fin+'T23:59')-Date.now())/DAY) : null;
      const tarde = dias!==null && dias<0 && !esHecha(t);
      const ce = colorEstado(t.estado, t.proyId);
      return `<tr class="trow" data-tk="${t.id}">
        <td><span class="tt" style="font-weight:600">${esc(t.titulo)}</span></td>
        <td><span class="pill"><i class="dotcat" style="background:${colorProyecto(t.proyId)}"></i>${esc(proyById(t.proyId).nom)}</span></td>
        <td><span class="estchip" style="--ec:${ce}">${esc(nomEstado(t.estado, t.proyId))}</span></td>
        <td><span class="pill"><span class="prio ${t.prioridad}"></span>${PRIO[t.prioridad]}</span></td>
        <td class="num" style="color:${tarde?'var(--stop)':'var(--muted)'};${tarde?'font-weight:600':''}">
          ${t.fin?new Date(t.fin).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})
            +(tarde?' · vencida':(dias===0?' · hoy':'')):'—'}</td></tr>`; }).join('')}</tbody></table>`
    : `<p class="empty">${vacio}</p>`;
  $$('#tablaMis [data-tk]').forEach(el=>el.addEventListener('click', ()=>abreTarea(+el.dataset.tk)));
}

/* ---- adjuntos: se guardan en la propia tarea (prototipo en memoria) ---- */
let nextAdj = 1, visorUrl = null;
const MAX_ADJ = 8*1024*1024;
function adjuntosDe(t){ return t.adjuntos || (t.adjuntos = []); }
function tamHumano(n){
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(0)+' KB';
  return (n/1024/1024).toFixed(1)+' MB';
}
function dataABlob(dataUrl){
  if(typeof dataUrl!=='string' || !dataUrl) throw new Error('sin datos');
  const i = dataUrl.indexOf(',');
  if(i<0) throw new Error('archivo inválido');
  const meta = dataUrl.slice(0, i), b64 = dataUrl.slice(i+1).replace(/\s/g,'');
  const mime = (meta.match(/data:([^;,]+)/)||[, 'application/octet-stream'])[1];
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for(let k=0;k<bin.length;k++) arr[k] = bin.charCodeAt(k);
  return new Blob([arr], {type:mime});
}
function ligaSobrenombre(sel, lista){
  $$(sel).forEach(inp=>{
    inp.addEventListener('click', e=>e.stopPropagation());
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); } });
    inp.addEventListener('change', ()=>{
      const it = lista.find(x=>x.id===+inp.dataset.ren);
      if(!it) return;
      it.archivo = it.archivo || it.nom;
      it.nom = inp.value.trim() || it.archivo;
      inp.value = it.nom;
    });
  });
}
function pintaAdjuntos(t){
  const list = adjuntosDe(t);
  if(!list.length) return '';
  return list.map(a=>`<div class="adj-row">
    <input class="adj-nom" data-ren="${a.id}" value="${esc(a.nom)}">
    <button type="button" class="linkish" data-ver="${a.id}">Ver</button>
    <span class="meta">${esc((a.tipo||'').split('/')[1]||'archivo')}</span>
    <button type="button" class="icon-btn" data-quita="${a.id}" title="Quitar">✕</button>
  </div>`).join('');
}
function leeArchivo(file){
  return new Promise((ok, mal)=>{
    if(file.size > MAX_ADJ){ mal(new Error('Pesa más de 8 MB.')); return; }
    const r = new FileReader();
    r.onload = ()=>ok(r.result);
    r.onerror = ()=>mal(new Error('No se ha podido leer.'));
    r.readAsDataURL(file);
  });
}
function cierraVisor(){
  if(visorUrl){ URL.revokeObjectURL(visorUrl); visorUrl = null; }
  const h = $('#visorHost'); if(h) h.innerHTML='';
}
function abreVisor(a){
  cierraVisor();
  if(!a || !a.data){ toast('No hay archivo'); return; }
  const nom = a.nom || 'archivo';
  const tipo = a.tipo || '';
  const ext = nom.toLowerCase();
  const img = tipo.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(ext);
  const pdf = tipo==='application/pdf' || /\.pdf$/.test(ext);
  const txt = tipo.startsWith('text/') || /\.(txt|csv|md)$/.test(ext);
  const dataUrl = (typeof a.data==='string' && a.data.startsWith('data:')) ? a.data : '';
  try{
    visorUrl = URL.createObjectURL(dataABlob(a.data));
  }catch(e){ visorUrl = null; }
  const src = img ? (dataUrl || visorUrl) : (visorUrl || dataUrl);
  if(!src){ toast('No se puede abrir'); return; }
  let cuerpo;
  if(img) cuerpo = `<img src="${src}" alt="${esc(nom)}">`;
  else if(pdf) cuerpo = `<iframe src="${src}" title="${esc(nom)}"></iframe>`;
  else if(txt){
    let texto = '';
    try{ texto = new TextDecoder().decode(Uint8Array.from(atob((dataUrl.split(',')[1]||'').replace(/\s/g,'')), c=>c.charCodeAt(0))); }
    catch(e){ texto = ''; }
    cuerpo = texto ? `<pre>${esc(texto)}</pre>` : `<p class="hint2"><a href="${src}" download="${esc(nom)}">Descargar</a></p>`;
  } else cuerpo = `<p class="hint2"><a href="${src}" download="${esc(nom)}">Descargar</a></p>`;
  $('#visorHost').innerHTML = `<div class="visor" id="visor">
    <header>
      <b>${esc(nom)}</b>
      <a class="btn btn-sm" href="${src}" download="${esc(nom)}" style="color:inherit">Descargar</a>
      <button type="button" class="btn btn-sm btn-primary" id="visorCerrar">Cerrar</button>
    </header>
    <div class="cuerpo">${cuerpo}</div>
  </div>`;
  $('#visorCerrar').addEventListener('click', cierraVisor);
}

/* ---- ficha de la tarea ---- */
function cierraTarea(){ tareaAbierta=null; const d=$('#drawerHost'); if(d) d.innerHTML=''; }
function abreTarea(id, focoTitulo){
  const t = tareaById(id); if(!t) return;
  tareaAbierta = id;
  const horas = LC.puente.registrosDeEscena(id);
  const totalH = sumar(horas);
  const porQuien = {};
  horas.forEach(e=>porQuien[e.userId] = (porQuien[e.userId]||0)+dur(e));
  $('#drawerHost').innerHTML = `<div class="drawer" id="drawer">
    <header>
      <div style="flex:1;min-width:0">
        <div class="lbl" style="margin-bottom:7px">
          <i class="dotcat" style="background:${colorProyecto(t.proyId)};margin-right:6px"></i>
          ${esc(proyById(t.proyId).nom)} · ${esc(bloqueById(t.bloqueId).nom)}</div>
        <input class="dtitle" id="dTitulo" value="${esc(t.titulo)}">
      </div>
      <button class="icon-btn" id="dCerrar" title="Cerrar" style="color:var(--muted)">✕</button>
    </header>
    <div class="body">
      <div class="dfield"><span class="k">Estado</span>
        <select id="dEstado">${estadosDe(t.proyId).map(e=>
          `<option value="${e.id}"${e.id===t.estado?' selected':''}>${esc(e.nom)}</option>`).join('')}</select></div>
      <div class="dfield"><span class="k">Asignado</span>
        <select id="dAsig"><option value="">Sin asignar</option>${USERS.filter(u=>u.activo).map(u=>
          `<option value="${u.id}"${u.id===t.asignado?' selected':''}>${esc(u.nom)}</option>`).join('')}</select></div>
      <div class="dfield"><span class="k">Prioridad</span>
        <select id="dPrio">${Object.entries(PRIO).map(([k,v])=>
          `<option value="${k}"${k===t.prioridad?' selected':''}>${v}</option>`).join('')}</select></div>
      <div class="dfield"><span class="k">Entrega</span>
        <input type="date" id="dFin" value="${t.fin||''}"></div>
      <div class="dfield"><span class="k">Proyecto</span>
        <select id="dProy">${PROYECTOS.map(p=>
          `<option value="${p.id}"${p.id===t.proyId?' selected':''}>${esc(p.nom)}</option>`).join('')}</select></div>
      <div class="dfield"><span class="k">Carpeta</span>
        <select id="dBloque">${BLOQUES.filter(b=>b.proyId===t.proyId).map(b=>
          `<option value="${b.id}"${b.id===t.bloqueId?' selected':''}>${esc(b.nom)}</option>`).join('')}</select></div>

      <div class="dsec"><h4>Notas</h4>
        <textarea class="field" id="dDesc" rows="3" placeholder="Notas"
          style="resize:vertical">${esc(t.desc||'')}</textarea></div>

      <div class="dsec"><h4>Archivos</h4>
        <div class="adj-lista" id="dAdj">${pintaAdjuntos(t)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <input type="file" id="dAdjFile" class="hide" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,application/pdf,image/*">
          <button class="btn btn-sm" type="button" id="dAdjBtn">Adjuntar</button>
        </div></div>

      <div class="dsec"><h4>Subtareas</h4>
        <div id="dSubs">${t.subtareas.map((sx,i)=>`<label class="sub${sx.hecha?' hecha':''}">
          <input type="checkbox" data-sub="${i}"${sx.hecha?' checked':''}><span>${esc(sx.txt)}</span></label>`).join('')}</div>
        <form id="dSubForm" style="display:flex;gap:6px;margin-top:8px">
          <input class="field" id="dSubTxt" placeholder="Añadir subtarea" style="flex:1;padding:6px 9px;font-size:12.5px">
          <button class="btn btn-sm" type="submit">Añadir</button></form></div>

      <div class="dsec"><h4>Horas</h4>
        ${totalH ? `<div style="font-size:19px;font-weight:500;letter-spacing:-.02em">${hhmm(totalH)} h</div>
          <div class="hint2">${Object.entries(porQuien).map(([uid,s])=>
            `${esc(userById(+uid).nom.split(' ')[0])} ${hhmm(s)}`).join(' · ')}</div>`
          : '<p class="hint2" style="margin:0">Sin horas.</p>'}</div>

      <div class="dsec"><h4>Comentarios</h4>
        <div id="dComs">${t.comentarios.length ? t.comentarios.map(c=>`<div class="coment">
          <div class="cw"><span class="av" style="width:20px;height:20px;font-size:8.5px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;font-weight:700">${esc(userById(c.userId).ini)}</span>
            <b>${esc(userById(c.userId).nom.split(' ')[0])}</b><time>${fCorta(c.ts)} ${fHora(c.ts)}</time></div>
          <div>${esc(c.txt)}</div></div>`).join('') : '<p class="hint2" style="margin:0">Sin comentarios.</p>'}</div>
        <form id="dComForm" style="display:flex;gap:6px;margin-top:10px">
          <input class="field" id="dComTxt" placeholder="Comentario" style="flex:1;padding:6px 9px;font-size:12.5px">
          <button class="btn btn-sm" type="submit">Enviar</button></form></div>

      <p class="hint2" style="margin-top:18px">Creada por ${esc(userById(t.creador).nom.split(' ')[0])} el ${fCorta(t.creado)}</p>
    </div>
    <div class="foot">
      <button class="btn btn-sm btn-danger" id="dBorrar">Borrar tarea</button>
      <button class="btn btn-sm btn-primary" id="dOk" style="margin-left:auto;padding:7px 14px">Hecho</button>
    </div></div>`;

  const guarda = (campo, valor, aviso) => {
    const antes = t[campo];
    t[campo] = valor;
    if(aviso && antes!==valor) aviso(antes, valor);
    render();
  };
  $('#dCerrar').addEventListener('click', cierraTarea);
  $('#dOk').addEventListener('click', cierraTarea);
  $('#dTitulo').addEventListener('change', e=>guarda('titulo', e.target.value.trim() || 'Sin título'));
  $('#dDesc').addEventListener('change', e=>guarda('desc', e.target.value.trim()));
  $('#dPrio').addEventListener('change', e=>guarda('prioridad', e.target.value));
  $('#dBloque').addEventListener('change', e=>guarda('bloqueId', +e.target.value));
  $('#dProy').addEventListener('change', e=>{
    const nuevoProy = +e.target.value;
    if(nuevoProy === t.proyId) return;
    let destino = BLOQUES.find(b=>b.proyId===nuevoProy && b.padre===null);
    if(!destino){ destino = {id:nextBloque++, proyId:nuevoProy, nom:'Sin clasificar', padre:null}; BLOQUES.push(destino); }
    t.proyId = nuevoProy;
    t.bloqueId = destino.id;
    render();
    toast(`Movida a «${proyById(nuevoProy).nom}»`);
    abreTarea(id);  /* refresca la ficha para que «Bloque» muestre las carpetas del nuevo proyecto */
  });
  $('#dEstado').addEventListener('change', e=>{
    const v = e.target.value;
    guarda('estado', v, ()=>{
      actua(t.proyId, `«${t.titulo}» → ${nomEstado(v, t.proyId)}`);
      avisa(t.asignado, `${ME.nom} ha pasado «${t.titulo}» a ${nomEstado(v, t.proyId)}`, t.id);
    });
  });
  $('#dFin').addEventListener('change', e=>{
    const v = e.target.value;
    guarda('fin', v, ()=>avisa(t.asignado,
      `${ME.nom} ha cambiado la entrega de «${t.titulo}» al ${new Date(v).toLocaleDateString('es-ES')}`, t.id));
  });
  $('#dAsig').addEventListener('change', e=>{
    const v = e.target.value ? +e.target.value : null;
    guarda('asignado', v, ()=>{
      if(!v) return;
      actua(t.proyId, `asignó «${t.titulo}» a ${(userById(v)||{}).nom}`);
      avisa(v, `${ME.nom} te ha asignado «${t.titulo}» (${proyById(t.proyId).nom})`, t.id);
      toast(v===ME.id ? 'Asignada' : `Avisado a ${userById(v).nom.split(' ')[0]}`);
    });
  });
  $$('#dSubs [data-sub]').forEach(c=>c.addEventListener('change', ()=>{
    t.subtareas[+c.dataset.sub].hecha = c.checked; render(); abreTarea(id);
  }));
  $('#dSubForm').addEventListener('submit', ev=>{
    ev.preventDefault();
    const v = $('#dSubTxt').value.trim(); if(!v) return;
    t.subtareas.push({txt:v, hecha:false}); render(); abreTarea(id);
    $('#dSubTxt').focus();
  });
  $('#dComForm').addEventListener('submit', ev=>{
    ev.preventDefault();
    const v = $('#dComTxt').value.trim(); if(!v) return;
    t.comentarios.push({userId:ME.id, ts:Date.now(), txt:v});
    actua(t.proyId, `comentó en «${t.titulo}»`);
    avisa(t.asignado, `${ME.nom} ha comentado en «${t.titulo}»`, t.id);
    render(); abreTarea(id);
    $('#dComTxt').focus();
  });
  $('#dBorrar').addEventListener('click', ()=>borraEscena(id));
  const file = $('#dAdjFile'), btnAdj = $('#dAdjBtn');
  if(btnAdj && file){
    btnAdj.addEventListener('click', ()=>file.click());
    file.addEventListener('change', async ()=>{
      const f = file.files && file.files[0]; file.value='';
      if(!f) return;
      try{
        const data = await leeArchivo(f);
        adjuntosDe(t).push({id:nextAdj++, nom:f.name, archivo:f.name, tipo:f.type||'application/octet-stream', tam:f.size, data});
        actua(t.proyId, `adjuntó ${f.name} en «${t.titulo}»`);
        toast(`«${f.name}» adjuntado`);
        render(); abreTarea(id);
      }catch(err){ toast(err.message || 'No se ha podido adjuntar'); }
    });
  }
  ligaSobrenombre('#dAdj [data-ren]', adjuntosDe(t));
  $$('#dAdj [data-ver]').forEach(b=>b.addEventListener('click', ()=>{
    const a = adjuntosDe(t).find(x=>x.id===+b.dataset.ver); if(a) abreVisor(a);
  }));
  $$('#dAdj [data-quita]').forEach(b=>b.addEventListener('click', ()=>{
    t.adjuntos = adjuntosDe(t).filter(x=>x.id!==+b.dataset.quita);
    render(); abreTarea(id);
  }));
  if(focoTitulo){ $('#dTitulo').focus(); $('#dTitulo').select(); }
}

(function arrancaElemBar(){
  const nom = $('#elemNom'), tipo = $('#btnTipoElem'), ok = $('#btnCreaElem');
  if(!nom || !tipo || !ok) return;
  pintaBtnTipo();
  tipo.addEventListener('click', ev=>{ ev.stopPropagation(); popTiposElem(ev); });
  const lanza = ()=>{ creaElemento(tipoElem, nom.value); nom.value=''; };
  ok.addEventListener('click', lanza);
  nom.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); lanza(); } });
})();

LC.produccion = {
  escenasDe(proyId){
    return TAREAS.filter(t=>t.proyId===proyId).map(t=>({id:t.id, titulo:t.titulo}));
  },
  alSalir(){ if(typeof cierraTarea==="function") cierraTarea(); }
};
