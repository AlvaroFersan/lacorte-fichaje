/* fichaje.js
   Solo control horario: cronómetro, calendario, informes, gestión de horas.
   No conoce TAREAS ni carpetas. Si necesita una escena, pregunta al puente. */
let ENTRADAS = [], SOLICITUDES = [], LOG = [];
let nextId = 1, nextSol = 1;

function persistEntradas(){
  try {
    localStorage.setItem('lc_horas_v1', JSON.stringify({
      next: nextId,
      entradas: ENTRADAS.map(e=>({
        id:e.id, userId:e.userId, proyId:e.proyId, cat:e.cat, desc:e.desc,
        ini:e.ini, fin:e.fin, tareaId:e.tareaId||null, enServidor:!!e.enServidor
      }))
    }));
  } catch(_){ /* cuota o modo privado */ }
}
function recuperaEntradas(){
  try {
    const d = JSON.parse(localStorage.getItem('lc_horas_v1')||'null');
    if(!d || !Array.isArray(d.entradas)) return;
    ENTRADAS = d.entradas.map(e=>({...e, ini:+e.ini, fin:+e.fin, userId:+e.userId, proyId:+e.proyId}));
    if(d.next) nextId = Math.max(nextId, +d.next);
  } catch(_){ /* JSON viejo */ }
}
recuperaEntradas();

function apiJson(ruta, opts){
  return fetch(ruta, Object.assign({
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'}
  }, opts||{})).then(r=>{ if(!r.ok) throw new Error('api'); return r.json(); });
}
function filaServidor(f){
  return {id:f.id, userId:f.usuario_id, proyId:f.proyecto_id, cat:f.categoria,
    desc:f.descripcion, ini:f.inicio, fin:f.fin, tareaId:f.escena_id||null, enServidor:true};
}
async function guardarEntradaServidor(e){
  if(!e) return;
  const cuerpo = JSON.stringify({
    proyecto_id:e.proyId, categoria:e.cat, descripcion:e.desc,
    inicio:e.ini, fin:e.fin, escena_id:e.tareaId||null
  });
  try {
    if(e.enServidor){
      await apiJson('/api/entradas/'+e.id, {method:'PUT', body:cuerpo});
    } else {
      const data = await apiJson('/api/entradas', {method:'POST', body:cuerpo});
      if(data.entrada){ e.id = data.entrada.id; e.enServidor = true; nextId = Math.max(nextId, e.id+1); }
    }
  } catch(_){ /* sin sesión de servidor: queda en local */ }
  persistEntradas();
}
async function borrarEntradaServidor(e){
  if(!e || !e.enServidor) return;
  try { await apiJson('/api/entradas/'+e.id, {method:'DELETE'}); } catch(_){}
}
async function cargarHorasServidor(){
  try {
    const data = await apiJson('/api/entradas?desde=0');
    const filas = (data.entradas||[]).map(filaServidor);
    const ids = new Set(ENTRADAS.filter(e=>e.enServidor).map(e=>e.id));
    filas.forEach(f=>{ if(!ids.has(f.id) && !ENTRADAS.some(e=>!e.enServidor && e.userId===f.userId && e.ini===f.ini && e.fin===f.fin)) ENTRADAS.push(f); });
    if(ENTRADAS.length) nextId = Math.max(nextId, ...ENTRADAS.map(e=>e.id))+1;
    persistEntradas();
  } catch(_){}
}
async function subirHorasPendientes(){
  for(const e of ENTRADAS.filter(x=>!x.enServidor)) await guardarEntradaServidor(e);
}

/* ================= CRONÓMETRO ================= */
$('#tPlay').addEventListener('click', ()=>{
  if(timer){
    if((Date.now()-timer.ini)/1000 > 30){
      const rec = {id:nextId++, userId:ME.id, proyId:timer.proyId, cat:timer.cat,
        desc:timer.desc || 'Sin descripción', ini:timer.ini, fin:Date.now()};
      ENTRADAS.push(rec); guardarEntradaServidor(rec);
    }
    timer = null; $('#tDesc').value='';
  } else {
    timer = {ini:Date.now(), proyId:+$('#tProy').value, cat:$('#tCat').value, desc:$('#tDesc').value.trim()};
  }
  paintTimer(); render();
});
['#tDesc','#tProy','#tCat'].forEach(s=>$(s).addEventListener('input', ()=>{
  if(!timer) return;
  timer.desc = $('#tDesc').value.trim(); timer.proyId = +$('#tProy').value; timer.cat = $('#tCat').value;
}));
function paintTimer(){
  const on = !!timer, b = $('#tPlay');
  b.classList.toggle('on', on);
  b.innerHTML = on
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  b.title = on ? 'Parar' : 'Iniciar';
  $('#tClock').textContent = on ? hhmmss((Date.now()-timer.ini)/1000) : '00:00:00';
}
setInterval(()=>{ if(timer) $('#tClock').textContent = hhmmss((Date.now()-timer.ini)/1000); }, 250);

/* ================= ALTA MANUAL ================= */
$('#manualForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const ini = new Date($('#mFecha').value+'T'+$('#mIni').value),
        fin = new Date($('#mFecha').value+'T'+$('#mFin').value);
  if(!(fin>ini)){ $('#mFin').setCustomValidity('La hora de fin debe ser posterior'); $('#mFin').reportValidity();
    setTimeout(()=>$('#mFin').setCustomValidity(''),50); return; }
  const rec = {id:nextId++, userId:ME.id, proyId:+$('#mProy').value, cat:$('#mCat').value,
    desc:$('#mDesc').value.trim() || 'Sin descripción', ini:+ini, fin:+fin};
  ENTRADAS.push(rec); guardarEntradaServidor(rec);
  $('#mDesc').value=''; render();
});

/* ================= CALENDARIO ================= */
const SNAP = 15;                                  /* minutos de imantación */
const MIN_DUR = 15;                               /* duración mínima de un bloque */
const clampMin = m => Math.max(0, Math.min(24*60, m));
const snapMin  = m => Math.round(m/SNAP)*SNAP;
const yToMin   = y => clampMin(snapMin(y/HOUR*60));
const minToHM  = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const rangoTxt = (a,b) => `${minToHM(a)} – ${minToHM(b)} · ${hhmm((b-a)*60)}`;
let calSel = null, calClip = null, calPasteTarget = null;

$$('#calMode button').forEach(b=>b.addEventListener('click', ()=>{
  calMode = b.dataset.m;
  $$('#calMode button').forEach(x=>x.setAttribute('aria-pressed', x===b));
  if(calMode==='day') calAnchor = startOfDay(calAnchor);
  renderCalendario();
}));
$('#zIn').addEventListener('click',  ()=>{ HOUR = Math.min(HOUR+14, 108); renderCalendario(); });
$('#zOut').addEventListener('click', ()=>{ HOUR = Math.max(HOUR-14, 24);  renderCalendario(); });
$('#calPrev').addEventListener('click', ()=>{ calAnchor = new Date(calAnchor.getTime()-(calMode==='week'?7:1)*DAY); renderCalendario(); });
$('#calNext').addEventListener('click', ()=>{ calAnchor = new Date(calAnchor.getTime()+(calMode==='week'?7:1)*DAY); renderCalendario(); });
$('#calToday').addEventListener('click', ()=>{ calAnchor = calMode==='week'?lunesDe(hoy()):hoy(); renderCalendario(); scrollCalendario(); });

/* en móvil la rejilla semanal no cabe: se abre en vista de día */
if(matchMedia('(max-width:760px)').matches){
  calMode = 'day';
  $$('#calMode button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.m==='day'));
}
function diasVisibles(){
  if(calMode==='day') return [startOfDay(calAnchor)];
  const l = lunesDe(calAnchor);
  return Array.from({length:7}, (_,i)=>sumaDias(l, i));
}
function carriles(items){
  const orden = [...items].sort((a,b)=>a.ini-b.ini || b.fin-a.fin);
  const finCarril = [];
  orden.forEach(e=>{
    let c = finCarril.findIndex(f=>f<=e.ini);
    if(c===-1){ c = finCarril.length; finCarril.push(0); }
    finCarril[c] = e.fin; e._lane = c;
  });
  orden.forEach(e=>{
    e._lanes = Math.max(1, ...orden.filter(o=>o.ini<e.fin && o.fin>e.ini).map(o=>o._lane+1));
  });
  return orden;
}
const seSolapa = e => ENTRADAS.some(o=>o.userId===e.userId && o.id!==e.id && o.ini<e.fin && o.fin>e.ini);
function htmlBloque(e){
  const ini = new Date(e.ini), mins = ini.getHours()*60+ini.getMinutes();
  const top = mins/60*HOUR, alto = Math.max((e.fin-e.ini)/3600000*HOUR, 15);
  const w = 100/e._lanes, left = w*e._lane, c = catById(e.cat);
  const clase = alto<30 ? ' short' : (alto<60 ? ' compact' : '');
  const rango = `${fHora(e.ini)}–${fHora(e.fin)} · ${hhmm(dur(e))}`;
  return `<div class="blk${clase}${calSel===e.id?' sel':''}" data-blk="${e.id}" tabindex="0"
    aria-label="${esc(e.desc)}, ${esc(proyById(e.proyId).nom)}, ${fHora(e.ini)} a ${fHora(e.fin)}"
    style="--c:${c.color};top:${top+3}px;height:${Math.max(alto-7, 13)}px;left:calc(${left}% + 8px);width:calc(${w}% - 16px);
    background:color-mix(in srgb, ${c.color} 9%, var(--paper))">
    <div class="rt"></div>
    ${seSolapa(e)?'<div class="solape" title="Se solapa con otro registro tuyo">!</div>':''}
    <div class="b1">${esc(proyById(e.proyId).nom)}</div>
    <div class="b2">${esc(e.desc)}</div>
    <div class="b3">${rango}</div>
    <div class="rb"></div></div>`;
}
function renderCalendario(){
  const dias = diasVisibles(), l = dias[0], f = dias[dias.length-1];
  $('#calLabel').textContent = calMode==='day'
    ? capi(l.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}))
    : (+lunesDe(hoy())===+l ? 'Esta semana' : `${fSel(l)} – ${fSel(f)}`);

  const mias = ENTRADAS.filter(e=>e.userId===ME.id);
  const semana = mias.filter(e=>e.ini>=+l && e.ini<+sumaDias(f,1));
  let g = `<div class="chcorner"><span class="lbl">Total</span>
             <span class="tot">${semana.length?hhmm(sumar(semana)):'0:00'}</span></div>`;
  dias.forEach(d=>{
    const tot = sumar(mias.filter(e=>e.ini>=+d && e.ini<+sumaDias(d,1)));
    const wk = d.getDay()===0||d.getDay()===6;
    g += `<div class="chday${+d===+hoy()?' today':''}${wk?' wknd':''}">
      <div class="d1">${capi(d.toLocaleDateString('es-ES',{weekday:'short'}).replace('.',''))}, ${d.getDate()} ${d.toLocaleDateString('es-ES',{month:'short'}).replace('.','')}</div>
      <div class="d2">${tot?hhmm(tot):'0:00'}</div></div>`;
  });
  let gut = '<div class="gutter">';
  for(let h=0;h<24;h++)
    gut += `<div class="hr" style="height:${HOUR}px">${h?`<span>${String(h).padStart(2,'0')}:00</span>`:''}</div>`;
  g += gut+'</div>';

  dias.forEach(d=>{
    const wk = d.getDay()===0||d.getDay()===6;
    let col = `<div class="daycol${wk?' wknd':''}" data-day="${+d}" style="height:${HOUR*24}px">`;
    for(let h=1;h<24;h++) col += `<div class="hline" style="top:${h*HOUR}px"></div>`;
    if(HOUR>=52) for(let h=0;h<24;h++) col += `<div class="hline half" style="top:${h*HOUR+HOUR/2}px"></div>`;
    if(+d===+hoy()){
      const n = new Date();
      col += `<div class="nowline" style="top:${(n.getHours()+n.getMinutes()/60)*HOUR}px"></div>`;
    }
    carriles(mias.filter(e=>e.ini>=+d && e.ini<+sumaDias(d,1))).forEach(e=>{ col += htmlBloque(e); });
    g += col+'</div>';
  });
  const grid = $('#calGrid');
  grid.style.gridTemplateColumns = `56px repeat(${dias.length}, minmax(0,1fr))`;
  grid.innerHTML = g;
  $('#calVacio').classList.toggle('hide', semana.length>0);
  grid.querySelectorAll('[data-blk]').forEach(el=>el.addEventListener('keydown', ev=>{
    marcaSeleccion(+el.dataset.blk);
    if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault();
      const r = el.getBoundingClientRect();
      abrirEditor(ENTRADAS.find(x=>x.id===+el.dataset.blk), false, {clientX:r.right, clientY:r.top});
    }
  }));
}
function scrollCalendario(){
  const mias = ENTRADAS.filter(e=>e.userId===ME.id);
  const dias = diasVisibles(), a = +dias[0], b = +dias[dias.length-1]+DAY;
  const enRango = mias.filter(e=>e.ini>=a && e.ini<b);
  const primera = enRango.length
    ? Math.min(...enRango.map(e=>new Date(e.ini).getHours())) : 8;
  $('#calWrap').scrollTop = Math.max(0, (primera-1)*HOUR);
}

function marcaSeleccion(id){
  calSel = id;
  $$('#calGrid [data-blk]').forEach(el=>el.classList.toggle('sel', +el.dataset.blk===id));
}
function minutosDeEntrada(e){
  const d = new Date(e.ini);
  return d.getHours()*60+d.getMinutes();
}
function copiaEntrada(e){
  if(!e) return;
  marcaSeleccion(e.id);
  calClip = {
    proyId:e.proyId, cat:e.cat, desc:e.desc, tareaId:e.tareaId||null,
    dur:e.fin-e.ini, min:minutosDeEntrada(e)
  };
  toast('Copiado: '+(proyById(e.proyId)||{}).nom+' · '+hhmm(calClip.dur/1000));
}
function pegaEntrada(target){
  if(!calClip){ toast('Primero copia un bloque'); return; }
  const dia = target ? target.dia : +(diasVisibles()[0]);
  let min = target ? target.min : calClip.min;
  const durMin = Math.max(MIN_DUR, Math.round(calClip.dur/60000));
  if(min + durMin > 24*60) min = Math.max(0, 24*60-durMin);
  const rec = {
    id:nextId++, userId:ME.id, proyId:calClip.proyId, cat:calClip.cat,
    desc:calClip.desc, tareaId:calClip.tareaId, ini:dia+min*60000, fin:dia+(min+durMin)*60000
  };
  ENTRADAS.push(rec);
  calSel = rec.id;
  guardarEntradaServidor(rec);
  render();
  toast('Pegado en '+minToHM(min)+' – '+minToHM(min+durMin));
}
function targetCalendario(ev, usarInicioBloque){
  const col = ev.target.closest('.daycol');
  if(!col) return null;
  const blk = ev.target.closest('[data-blk]');
  if(usarInicioBloque && blk){
    const e = ENTRADAS.find(x=>x.id===+blk.dataset.blk);
    if(e) return {dia:+col.dataset.day, min:minutosDeEntrada(e)};
  }
  const rect = col.getBoundingClientRect();
  return {dia:+col.dataset.day, min:yToMin(ev.clientY-rect.top)};
}
function colocarPop(pop, x, y){
  $('#popHost').appendChild(pop);
  const r = pop.getBoundingClientRect();
  pop.style.left = Math.max(10, Math.min(x+10, innerWidth-r.width-12))+'px';
  pop.style.top  = Math.max(10, Math.min(y+10, innerHeight-r.height-12))+'px';
}
function abrirMenuCalendario(ev){
  const col = ev.target.closest('.daycol'), blk = ev.target.closest('[data-blk]');
  if(!col && !blk) return;
  ev.preventDefault();
  cerrarPop();
  const e = blk ? ENTRADAS.find(x=>x.id===+blk.dataset.blk) : null;
  if(e) marcaSeleccion(e.id);
  calPasteTarget = targetCalendario(ev, !!blk);
  const pop = document.createElement('div');
  pop.className = 'pop calctx';
  pop.innerHTML = `
    ${e?'<button id="calCtxCopy">Copiar bloque</button>':''}
    <button id="calCtxPaste"${calClip?'':' disabled'}>Pegar aquí</button>
    ${e?'<button id="calCtxEdit">Editar</button>':'<button id="calCtxNew">Crear registro aquí</button>'}
    <div class="sep"></div>
    <button id="calCtxClose">Cerrar</button>`;
  colocarPop(pop, ev.clientX, ev.clientY);
  if(e) $('#calCtxCopy').addEventListener('click', ()=>{ copiaEntrada(e); cerrarPop(); });
  $('#calCtxPaste').addEventListener('click', ()=>{ pegaEntrada(calPasteTarget); cerrarPop(); });
  if(e) $('#calCtxEdit').addEventListener('click', ()=>abrirEditor(e, false, ev));
  else $('#calCtxNew').addEventListener('click', ()=>{
    const t = calPasteTarget, a = t.min, b = Math.min(a+60, 24*60);
    abrirEditor({id:null, userId:ME.id, proyId:+$('#tProy').value, cat:$('#tCat').value,
      desc:'', ini:t.dia+a*60000, fin:t.dia+b*60000}, true, ev);
  });
  $('#calCtxClose').addEventListener('click', cerrarPop);
}

/* ---------- ARRASTRE: crear, mover y estirar ---------- */
let drag = null;
function limpiaDrag(cancelar){
  if(!drag) return;
  if(drag.ghost) drag.ghost.remove();
  if(cancelar && drag.el){ drag.el.style.top = drag.top0+'px'; drag.el.style.height = drag.alto0+'px'; }
  if(drag.el) drag.el.classList.remove('dragging');
  const d = drag; drag = null; return d;
}
function pintaDrag(){
  const {modo} = drag;
  if(modo==='create'){
    drag.ghost.style.top = drag.a/60*HOUR+'px';
    drag.ghost.style.height = Math.max((drag.b-drag.a)/60*HOUR, 14)+'px';
    drag.ghost.firstChild.textContent = rangoTxt(drag.a, drag.b);
  } else {
    drag.el.style.top = drag.a/60*HOUR+'px';
    drag.el.style.height = Math.max((drag.b-drag.a)/60*HOUR-2, 13)+'px';
    const b3 = drag.el.querySelector('.b3');
    if(b3) b3.textContent = hhmm((drag.b-drag.a)*60);
    drag.el.dataset.live = rangoTxt(drag.a, drag.b);
  }
}
function onDown(ev){
  if(ev.button!==0 || $('#modalHost').firstChild) return;
  const col = ev.target.closest('.daycol'); if(!col) return;
  cerrarPop();
  const rect = col.getBoundingClientRect(), y = ev.clientY-rect.top;
  const blkEl = ev.target.closest('[data-blk]');
  if(blkEl){
    const e = ENTRADAS.find(x=>x.id===+blkEl.dataset.blk); if(!e) return;
    const br = blkEl.getBoundingClientRect(), oy = ev.clientY-br.top;
    const modo = ev.target.classList.contains('rt') ? 'top'
               : ev.target.classList.contains('rb') ? 'bottom'
               : (oy<8 ? 'top' : oy>br.height-8 ? 'bottom' : 'move');
    const ini = new Date(e.ini), fin = new Date(e.fin);
    drag = {modo, e, el:blkEl, col, rect, y0:y, movido:false,
      a: ini.getHours()*60+ini.getMinutes(), b: fin.getHours()*60+fin.getMinutes(),
      top0: parseFloat(blkEl.style.top), alto0: parseFloat(blkEl.style.height)};
    drag.a0 = drag.a; drag.b0 = drag.b;
    blkEl.classList.add('dragging');
  } else {
    const m = yToMin(y);
    drag = {modo:'create', col, rect, y0:y, movido:false, a:m, b:Math.min(m+MIN_DUR, 24*60), dia:+col.dataset.day};
    const gh = document.createElement('div');
    gh.className = 'ghost'; gh.innerHTML = '<span></span>';
    col.appendChild(gh); drag.ghost = gh; pintaDrag();
  }
  col.setPointerCapture(ev.pointerId);
  ev.preventDefault();
}
function onMove(ev){
  if(!drag) return;
  const y = ev.clientY-drag.rect.top;
  if(Math.abs(y-drag.y0) > 4) drag.movido = true;
  const m = yToMin(y);
  if(drag.modo==='create'){
    const ini = yToMin(drag.y0);
    drag.a = Math.min(ini, m); drag.b = Math.max(ini, m);
    if(drag.b-drag.a < MIN_DUR) drag.b = Math.min(drag.a+MIN_DUR, 24*60);
  } else if(drag.modo==='move'){
    const delta = snapMin((y-drag.y0)/HOUR*60), largo = drag.b0-drag.a0;
    let a = clampMin(drag.a0+delta);
    if(a+largo > 24*60) a = 24*60-largo;
    drag.a = a; drag.b = a+largo;
  } else if(drag.modo==='top'){
    drag.a = Math.min(m, drag.b-MIN_DUR);
  } else {
    drag.b = Math.max(m, drag.a+MIN_DUR);
  }
  pintaDrag();
}
function onUp(ev){
  if(!drag) return;
  const d = drag, movido = d.movido;
  if(d.modo==='create'){
    limpiaDrag();
    const dia = d.dia;
    let a = d.a, b = d.b;
    if(!movido){ a = yToMin(d.y0); b = Math.min(a+60, 24*60); }        /* clic simple = 1 hora */
    abrirEditor({id:null, userId:ME.id, proyId:+$('#tProy').value, cat:$('#tCat').value,
      desc:'', ini:dia+a*60000, fin:dia+b*60000}, true, ev);
  } else {
    const e = d.e, dia = +d.col.dataset.day;
    marcaSeleccion(e.id);
    if(movido){
      e.ini = dia + d.a*60000; e.fin = dia + d.b*60000;
      limpiaDrag(); guardarEntradaServidor(e); render();
      toast(`Movido a ${minToHM(d.a)} – ${minToHM(d.b)}`);
    } else {
      limpiaDrag(); abrirEditor(e, false, ev);
    }
  }
}
document.addEventListener('keydown', ev=>{
  const editando = ev.target.closest('input,textarea,select,[contenteditable="true"]');
  if(!editando && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase()==='c'){
    const e = ENTRADAS.find(x=>x.id===calSel);
    if(e){ ev.preventDefault(); copiaEntrada(e); }
    return;
  }
  if(!editando && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase()==='v'){
    ev.preventDefault();
    pegaEntrada(calPasteTarget);
    return;
  }
  if(ev.key!=='Escape') return;
  if(drag){ limpiaDrag(true); render(); return; }
  if($('#modalHost').firstChild) $('#modalHost').innerHTML='';
  else cerrarPop();
});
let calArmado = false;
function armaCalendario(){
  if(calArmado) return;
  calArmado = true;
  const grid = $('#calGrid');
  grid.addEventListener('pointerdown', onDown);
  grid.addEventListener('pointermove', onMove);
  grid.addEventListener('pointerup', onUp);
  grid.addEventListener('pointercancel', ()=>{ limpiaDrag(true); render(); });
  grid.addEventListener('contextmenu', abrirMenuCalendario);
  grid.addEventListener('mousemove', ev=>{
    const t = targetCalendario(ev, false);
    if(t) calPasteTarget = t;
  });
}

/* ---------- EDITOR DE REGISTRO ---------- */
const cerrarPop = () => $('#popHost').innerHTML='';
function abrirEditor(e, esNuevo, ev){
  const host = $('#popHost');
  const fecha = new Date(e.ini);
  const val = ts => { const d = new Date(ts);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  const fechaVal = fechaISOLocal(fecha);
  host.innerHTML = `<div class="pop ed" id="thePop">
    <div class="lbl" style="margin-bottom:11px">${esNuevo?'Nuevo registro':'Editar registro'}</div>
    <label class="lbl" for="edDesc">En qué has trabajado</label>
    <input class="field" id="edDesc" value="${esc(e.desc)}" placeholder="Descripción de la tarea" style="margin-bottom:11px">
    <label class="lbl" for="edProy">Proyecto</label>
    <select class="field" id="edProy" style="margin-bottom:11px">
      ${PROYECTOS.filter(p=>typeof puedoVer==='function'?puedoVer(p):(typeof esMio==='function'&&(esMio(p)||estaEnEquipo(p)))).map(p=>`<option value="${p.id}"${p.id===e.proyId?' selected':''}>${esc(p.nom)}</option>`).join('')}
    </select>
    <label class="lbl" for="edTarea">Escena <span style="text-transform:none;letter-spacing:0;font-weight:400">(opcional)</span></label>
    <select class="field" id="edTarea" style="margin-bottom:11px"></select>
    <label class="lbl">Tipo de trabajo</label>
    <div class="catseg" style="margin-bottom:11px">
      ${CATS.map(c=>`<button type="button" class="catbtn" data-cat="${c.id}" style="--c:${c.color}"
        aria-pressed="${c.id===e.cat}"><i class="dotcat" style="background:${c.color}"></i>${esc(c.nom.split(' ')[0])}</button>`).join('')}
    </div>
    <label class="lbl">Fecha y horario</label>
    <input class="field" type="date" id="edFecha" value="${fechaVal}" style="margin-bottom:7px">
    <div class="frow">
      <input class="field" type="time" id="edIni" value="${val(e.ini)}">
      <input class="field" type="time" id="edFin" value="${val(e.fin)}">
      <div class="durbox" id="edDur">${hhmm(dur(e))}</div>
    </div>
    <div class="acts">
      ${esNuevo?'' : '<button class="btn btn-sm btn-danger" id="edDel">Borrar</button>'}
      <button class="btn btn-sm" id="edCancel" style="margin-left:auto">Cancelar</button>
      <button class="btn btn-sm btn-primary" id="edOk" style="padding:7px 13px">${esNuevo?'Crear':'Guardar'}</button>
    </div></div>`;

  const pop = $('#thePop'), r = pop.getBoundingClientRect();
  const px = (ev && ev.clientX) || innerWidth/2, py = (ev && ev.clientY) || innerHeight/2;
  pop.style.left = Math.max(10, Math.min(px+12, innerWidth-r.width-12))+'px';
  pop.style.top  = Math.max(10, Math.min(py-40, innerHeight-r.height-12))+'px';

  /* la lista de escenas depende del proyecto elegido */
  const pintaTareas = () => {
    const pid = +$('#edProy').value;
    const ts = LC.puente.escenasDe(pid);
    $('#edTarea').innerHTML = '<option value="">Sin escena concreta</option>' +
      ts.map(t=>`<option value="${t.id}"${t.id===e.tareaId?' selected':''}>${esc(t.titulo)}</option>`).join('');
  };
  pintaTareas();
  $('#edProy').addEventListener('change', pintaTareas);

  let cat = e.cat;
  const pintaCat = () => $$('#thePop .catbtn').forEach(b=>b.setAttribute('aria-pressed', b.dataset.cat===cat));
  $$('#thePop .catbtn').forEach(b=>b.addEventListener('click', ()=>{ cat = b.dataset.cat; pintaCat(); }));
  const recalc = () => {
    const a = new Date($('#edFecha').value+'T'+$('#edIni').value),
          b = new Date($('#edFecha').value+'T'+$('#edFin').value);
    const ok = b>a;
    $('#edDur').textContent = ok ? hhmm((b-a)/1000) : '—';
    $('#edDur').classList.toggle('bad', !ok);
    return ok ? {a,b} : null;
  };
  ['#edIni','#edFin','#edFecha'].forEach(s=>$(s).addEventListener('input', recalc));
  recalc();
  $('#edCancel').addEventListener('click', cerrarPop);
  if(!esNuevo) $('#edDel').addEventListener('click', ()=>{
    const copia = {...e};
    ENTRADAS = ENTRADAS.filter(x=>x.id!==e.id);
    borrarEntradaServidor(e); persistEntradas();
    cerrarPop(); render();
    toast('Registro borrado', 'Deshacer', ()=>{
      copia.enServidor = false; ENTRADAS.push(copia); guardarEntradaServidor(copia); render();
    });
  });
  $('#edOk').addEventListener('click', ()=>{
    const t = recalc(); if(!t){ $('#edFin').focus(); return; }
    const tareaSel = $('#edTarea').value ? +$('#edTarea').value : null;
    const datos = {userId:ME.id, proyId:+$('#edProy').value, cat, tareaId:tareaSel,
      desc:$('#edDesc').value.trim() || 'Sin descripción', ini:+t.a, fin:+t.b};
    if(esNuevo){ const rec = {id:nextId++, ...datos}; ENTRADAS.push(rec); guardarEntradaServidor(rec); }
    else { Object.assign(e, datos); guardarEntradaServidor(e); }
    cerrarPop(); render();
    toast(esNuevo ? `Añadido · ${hhmm((t.b-t.a)/1000)} h` : 'Cambios guardados');
  });
  $('#edDesc').focus(); $('#edDesc').select();
}
/* cerrar el emergente al pulsar fuera. #popHost lo comparten el editor de
   registros y la lista de avisos, así que hay que excluir ambos. */
document.addEventListener('pointerdown', ev=>{
  const dentro = ev.target.closest('#thePop') || ev.target.closest('.daycol')
              || ev.target.closest('[data-edit]') || ev.target.closest('#notifPop')
              || ev.target.closest('#bell') || ev.target.closest('#bellNav') || ev.target.closest('#colPop')
              || ev.target.closest('#btnCols') || ev.target.closest('#filaPop')
              || ev.target.closest('.filaMenuBtn') || ev.target.closest('.msub')
              || ev.target.closest('#flujoPop') || ev.target.closest('#btnFlujos')
              || ev.target.closest('#detWrap') || ev.target.closest('#actiWrap');
  if(!dentro) cerrarPop();
});


/* ================= GRÁFICOS ================= */
const tip = $('#tip');
const tipMove = ev => {
  const r = tip.getBoundingClientRect();
  let x = ev.clientX+14, y = ev.clientY-r.height-10;
  if(x+r.width > innerWidth-8) x = ev.clientX-r.width-14;
  if(y < 8) y = ev.clientY+18;
  tip.style.left=x+'px'; tip.style.top=y+'px';
};
function bindTip(root){
  root.querySelectorAll('[data-tip]').forEach(el=>{
    el.addEventListener('mouseenter', e=>{ tip.innerHTML=el.dataset.tip; tip.style.opacity=1; tipMove(e); });
    el.addEventListener('mousemove', tipMove);
    el.addEventListener('mouseleave', ()=>tip.style.opacity=0);
  });
}
const roundTop = (x,y,w,h,r)=>{ r=Math.min(r,w/2,h);
  return `M${x},${y+h} L${x},${y+r} Q${x},${y} ${x+r},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h} Z`; };
const roundRight = (x,y,w,h,r)=>{ r=Math.min(r,w,h/2);
  return `M${x},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} L${x},${y+h} Z`; };
const niceMax = v => { if(v<=0) return 3600; const s=[1,2,3,4,5,6,8,10,12], h=v/3600;
  for(const n of s) if(h<=n) return n*3600; return Math.ceil(h/2)*2*3600; };

function chartDias(cont, dias){
  const W = Math.max(cont.clientWidth||640, 320), H = 224, padL=38, padR=6, padT=12, padB=24;
  const iw = W-padL-padR, ih = H-padT-padB;
  const max = niceMax(Math.max(...dias.map(d=>d.total), 1));
  const band = iw/dias.length, bw = Math.min(26, band*0.6);
  let g = '';
  for(let i=0;i<=4;i++){
    const y = padT+ih-ih*i/4;
    g += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
          <text class="tick" x="${padL-8}" y="${y+4}" text-anchor="end">${Math.round(max*i/4/3600)}h</text>`;
  }
  dias.forEach((d,i)=>{
    const cx = padL+band*i+band/2, x = cx-bw/2;
    let acc = 0;
    CATS.forEach((c,ci)=>{
      const v = d.parts[ci]; if(v<=0) return;
      const hpx = ih*v/max, y = padT+ih-ih*acc/max-hpx;
      const top = CATS.slice(ci+1).every((_,k)=>d.parts[ci+1+k]<=0);
      const hh = Math.max(hpx-2, 1);
      g += `<path d="${top?roundTop(x,y,bw,hh,3):`M${x},${y} h${bw} v${hh} h${-bw} Z`}" fill="${c.color}"
             data-tip="<b>${esc(c.nom)}</b><br>${fCorta(d.ts)} · ${hhmm(v)} h"/>`;
      acc += v;
    });
    if(d.total>0) g += `<text class="vlabel" x="${cx}" y="${padT+ih-ih*d.total/max-7}" text-anchor="middle">${hhmm(d.total)}</text>`;
    if(i % (dias.length>16?2:1) === 0)
      g += `<text class="tick" x="${cx}" y="${H-7}" text-anchor="middle">${fCorta(d.ts)}</text>`;
  });
  g += `<line x1="${padL}" y1="${padT+ih}" x2="${W-padR}" y2="${padT+ih}" stroke="var(--line-strong)"/>`;
  cont.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`;
  bindTip(cont);
}
function chartBarrasH(cont, filas, opts={}){
  const W = Math.max(cont.clientWidth||420, 300), labW = opts.labW||136, valW = opts.valW||62, rowH = 30;
  const H = Math.max(filas.length*rowH+6, 40), iw = W-labW-valW;
  const max = Math.max(...filas.map(f=>f.total), 1);
  let g = '';
  filas.forEach((f,i)=>{
    const y = i*rowH+6, bh = 14;
    g += `<text class="blabel" x="0" y="${y+bh-2}">${esc(f.label.length>21?f.label.slice(0,20)+'…':f.label)}</text>`;
    if(f.parts){
      let acc = 0;
      f.parts.forEach((v,ci)=>{
        if(v<=0) return;
        const w = Math.max(iw*v/max-2, 1), x = labW+iw*acc/max;
        const last = f.parts.slice(ci+1).every(z=>z<=0);
        g += `<path d="${last?roundRight(x,y,w,bh,3):`M${x},${y} h${w} v${bh} h${-w} Z`}" fill="${CATS[ci].color}"
               data-tip="<b>${esc(CATS[ci].nom)}</b><br>${esc(f.label)} · ${hhmm(v)} h"/>`;
        acc += v;
      });
    } else {
      g += `<path d="${roundRight(labW,y,Math.max(iw*f.total/max,2),bh,3)}" fill="${opts.color||'var(--s1)'}"
             data-tip="<b>${esc(f.label)}</b><br>${hhmm(f.total)} h"/>`;
    }
    g += `<text class="vlabel" x="${W}" y="${y+bh-2}" text-anchor="end">${esc(f.nota||hhmm(f.total)+' h')}</text>`;
  });
  cont.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`;
  bindTip(cont);
}
const legend = c => c.innerHTML = CATS.map(x=>`<span><i class="dotcat" style="background:${x.color}"></i>${esc(x.nom)}</span>`).join('');

/* ================= SELECCIÓN ================= */
const misEntradas = () => ENTRADAS.filter(e=>e.userId===ME.id);
function filtradas(){
  const pro = $('#fProyecto').value, desde = +sumaDias(hoy(), 1-rango);
  return ENTRADAS.filter(e=>{
    if(e.userId!==ME.id) return false;
    if(pro && e.proyId!==+pro) return false;
    return e.ini >= desde;
  });
}
function porDias(lista, n){
  return Array.from({length:n}, (_,k)=>{
    const ts = +sumaDias(hoy(), -(n-1-k)), parts=[0,0,0];
    lista.filter(e=>e.ini>=ts && e.ini<+sumaDias(ts,1)).forEach(e=>parts[CATS.findIndex(c=>c.id===e.cat)] += dur(e));
    return {ts, parts, total:parts.reduce((a,b)=>a+b,0)};
  });
}
$$('#rangoSeg button').forEach(b=>b.addEventListener('click', ()=>{
  rango = +b.dataset.r; $$('#rangoSeg button').forEach(x=>x.setAttribute('aria-pressed', x===b)); render();
}));
/* render() vive en arranque.js, que se carga después: hay que llamarla desde
   dentro, no pasarla como valor, o este script se rompe al cargarse y LC.fichaje
   nunca llega a existir (y con él, todo el puente). */
$('#fProyecto').addEventListener('change', ()=>render());


function renderFichaje(){
  const mias = misEntradas();
  const deHoy = mias.filter(e=>e.ini>=+hoy());
  const lun = +lunesDe(hoy());
  const sem = mias.filter(e=>e.ini>=lun), ant = mias.filter(e=>e.ini>=+sumaDias(lun, -7) && e.ini<lun);
  const sieteD = mias.filter(e=>e.ini>=+sumaDias(hoy(), -6));
  $('#kHoy').textContent = hhmm(sumar(deHoy))+' h';
  $('#kSem').textContent = hhmm(sumar(sem))+' h';
  const dif = sumar(sem)-sumar(ant);
  $('#kSemNota').textContent = ant.length ? `${dif>=0?'+':'−'}${hhmm(Math.abs(dif))} h que la anterior` : '';

  /* Reparto de la semana por tipo de trabajo. Una barra y su leyenda dicen lo
     mismo que dos tarjetas de métrica, y además dicen en qué se ha ido el tiempo. */
  const totSem = sumar(sem);
  const partes = CATS.map(c=>({c, v: sem.filter(e=>e.cat===c.id).reduce((a,e)=>a+dur(e),0)}))
                     .filter(p=>p.v>0);
  $('#kBar').innerHTML = partes.map(p=>
    `<i style="background:${p.c.color};width:${p.v/totSem*100}%" title="${esc(p.c.nom)}"></i>`).join('');
  $('#kBar').classList.toggle('hide', !partes.length);
  $('#kLeg').innerHTML = partes.length
    ? partes.map(p=>`<span><i class="dotcat" style="background:${p.c.color}"></i>${esc(p.c.nom)} <b>${hhmm(p.v)}</b></span>`).join('')
    : '<span>Aún sin horas</span>';

  const pp = {}; sieteD.forEach(e=>pp[e.proyId] = (pp[e.proyId]||0)+dur(e));
  const top = Object.entries(pp).sort((a,b)=>b[1]-a[1])[0];
  $('#kProyNota').textContent = top
    ? `Sobre todo en ${proyById(+top[0]).nom} · ${hhmm(top[1])} h`
    : '';
  if(LC.administracion && LC.administracion.renderPendientesGestion) LC.administracion.renderPendientesGestion();

  const cont = $('#listaEntradas');
  const rec = sieteD.slice().sort((a,b)=>b.ini-a.ini);
  if(!rec.length){
    cont.innerHTML = '<p class="empty">Aún no has fichado. Dale al play, o anota las horas a mano ahí abajo.</p>';
    return;
  }
  const gr = {}; rec.forEach(e=>{ const k=startOfDay(e.ini).getTime(); (gr[k]=gr[k]||[]).push(e); });
  cont.innerHTML = Object.keys(gr).sort((a,b)=>b-a).map(k=>`
    <div class="daygroup"><span>${esc(fFecha(+k))}</span><span>${hhmm(sumar(gr[k]))} h</span></div>
    <table><tbody>${gr[k].map(e=>`<tr>
      <td style="width:38%"><button class="rowedit" data-edit="${e.id}">${esc(e.desc)}</button></td>
      <td><span class="pill"><i class="dotcat" style="background:${catById(e.cat).color}"></i>${esc(catById(e.cat).nom)}</span></td>
      <td style="color:var(--ink-2)">${esc(proyById(e.proyId).nom)}</td>
      <td class="num" style="color:var(--muted)">${fHora(e.ini)} – ${fHora(e.fin)}</td>
      <td class="num" style="font-weight:600">${hhmm(dur(e))}</td>
      <td style="width:30px"><button class="icon-btn" data-del="${e.id}" title="Borrar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button></td>
    </tr>`).join('')}</tbody></table>`).join('');
  cont.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ev=>{
    abrirEditor(ENTRADAS.find(e=>e.id===+b.dataset.edit), false, ev);
  }));
  cont.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    const copia = ENTRADAS.find(e=>e.id===+b.dataset.del);
    ENTRADAS = ENTRADAS.filter(e=>e.id!==+b.dataset.del);
    borrarEntradaServidor(copia); persistEntradas(); render();
    toast('Registro borrado', 'Deshacer', ()=>{
      copia.enServidor = false; ENTRADAS.push(copia); guardarEntradaServidor(copia); render();
    });
  }));
}

function renderInformes(){
  const lista = filtradas(), dias = porDias(lista, rango), tot = sumar(lista);
  $('#rTotal').textContent = hhmm(tot)+' h';
  const dc = dias.filter(d=>d.total>0).length || 1;
  $('#rTotalNota').textContent = `${dc} días con registro · media ${hhmm(tot/dc)} h/día`;
  CATS.forEach((c,i)=>{
    const v = lista.filter(e=>e.cat===c.id).reduce((a,e)=>a+dur(e),0);
    $('#rC'+(i+1)).textContent = hhmm(v)+' h';
    $('#rC'+(i+1)+'p').textContent = tot ? Math.round(v/tot*100)+'% del total' : '—';
  });
  chartDias($('#chartDias'), dias); legend($('#legDias'));

  const pp = {};
  lista.forEach(e=>{ pp[e.proyId] = pp[e.proyId]||[0,0,0]; pp[e.proyId][CATS.findIndex(c=>c.id===e.cat)] += dur(e); });
  const filas = Object.entries(pp).map(([id,parts])=>({label:proyById(+id).nom, parts, total:parts.reduce((a,b)=>a+b,0)}))
    .sort((a,b)=>b.total-a.total);
  filas.length ? chartBarrasH($('#chartProy'), filas)
               : $('#chartProy').innerHTML = '<p class="empty">Sin datos en este periodo.</p>';

  const fc = CATS.map(c=>{
    const v = lista.filter(e=>e.cat===c.id).reduce((a,e)=>a+dur(e),0);
    return {label:c.nom, total:v, color:c.color, nota:`${tot?Math.round(v/tot*100):0}% · ${hhmm(v)} h`};
  }).sort((a,b)=>b.total-a.total);
  const cc = $('#chartCat'), W = Math.max(cc.clientWidth||380,280), labW=150, valW=96, iw=W-labW-valW;
  const maxC = Math.max(...fc.map(f=>f.total),1);
  cc.innerHTML = `<svg width="100%" height="${fc.length*34+6}" viewBox="0 0 ${W} ${fc.length*34+6}">`+
    fc.map((f,i)=>{ const y=i*34+8;
      return `<text class="blabel" x="0" y="${y+12}">${esc(f.label)}</text>
        <path d="${roundRight(labW,y,Math.max(iw*f.total/maxC,2),16,3)}" fill="${f.color}"
          data-tip="<b>${esc(f.label)}</b><br>${esc(f.nota)}"/>
        <text class="vlabel" x="${W}" y="${y+12}" text-anchor="end">${esc(f.nota)}</text>`;
    }).join('')+'</svg>';
  bindTip(cc);

  const rows = [...lista].sort((a,b)=>b.ini-a.ini).slice(0,40);
  $('#tablaInforme').innerHTML = rows.length ? `<table><thead><tr>
    <th>Fecha</th><th>Proyecto</th><th>Tipo</th><th>Descripción</th><th class="num">Horas</th>
    </tr></thead><tbody>${rows.map(e=>`<tr>
      <td style="color:var(--muted)">${fCorta(e.ini)}</td><td>${esc(proyById(e.proyId).nom)}</td>
      <td><span class="pill"><i class="dotcat" style="background:${catById(e.cat).color}"></i>${esc(catById(e.cat).nom)}</span></td>
      <td style="color:var(--ink-2)">${esc(e.desc)}</td>
      <td class="num" style="font-weight:600">${hhmm(dur(e))}</td></tr>`).join('')}</tbody></table>
    ${lista.length>40?`<p class="hint2">40 de ${lista.length}. El CSV los lleva todos.</p>`:''}`
    : '<p class="empty">Sin registros con estos filtros.</p>';
}

function renderProyectos(){
  const rows = (typeof proyectosVisibles==='function' ? proyectosVisibles() : PROYECTOS).map(p=>{
    const l = ENTRADAS.filter(e=>e.proyId===p.id && (ME.rol==='admin'||e.userId===ME.id));
    const parts=[0,0,0]; l.forEach(e=>parts[CATS.findIndex(c=>c.id===e.cat)] += dur(e));
    return {p, parts, total:parts.reduce((a,b)=>a+b,0), n:l.length, ult:l.length?Math.max(...l.map(e=>e.ini)):null};
  }).sort((a,b)=>b.total-a.total);
  const max = Math.max(...rows.map(r=>r.total),1);
  $('#tablaProyectos').innerHTML = `<table><thead><tr>
    <th>Proyecto</th><th>Cliente</th><th>Reparto por tipo</th><th class="num">Registros</th>
    <th class="num">Última</th><th class="num">Total</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td style="font-weight:600">${esc(r.p.nom)}</td><td style="color:var(--ink-2)">${esc(r.p.cliente)}</td>
      <td style="min-width:170px"><svg width="170" height="14" viewBox="0 0 170 14">${(()=>{
        let acc=0, s='';
        r.parts.forEach((v,i)=>{ if(v<=0) return;
          const w=Math.max(170*v/max-2,1), x=170*acc/max, last=r.parts.slice(i+1).every(z=>z<=0);
          s += `<path d="${last?roundRight(x,1,w,12,3):`M${x},1 h${w} v12 h${-w} Z`}" fill="${CATS[i].color}"
                 data-tip="<b>${esc(CATS[i].nom)}</b><br>${hhmm(v)} h"/>`; acc+=v; });
        return s; })()}</svg></td>
      <td class="num" style="color:var(--muted)">${r.n}</td>
      <td class="num" style="color:var(--muted)">${r.ult?fCorta(r.ult):'—'}</td>
      <td class="num" style="font-weight:600">${hhmm(r.total)} h</td></tr>`).join('')}
    </tbody></table><div class="legend">${CATS.map(c=>`<span><i class="dotcat" style="background:${c.color}"></i>${esc(c.nom)}</span>`).join('')}</div>`;
  bindTip($('#tablaProyectos'));
}

/* ================= DONUT (reparto porcentual) ================= */
const POLAR = (cx,cy,r,a) => [cx+r*Math.cos(a-Math.PI/2), cy+r*Math.sin(a-Math.PI/2)];
function arcoAnillo(cx,cy,rExt,rInt,a0,a1){
  const grande = (a1-a0) > Math.PI ? 1 : 0;
  const [x0,y0]=POLAR(cx,cy,rExt,a0), [x1,y1]=POLAR(cx,cy,rExt,a1);
  const [x2,y2]=POLAR(cx,cy,rInt,a1), [x3,y3]=POLAR(cx,cy,rInt,a0);
  return `M${x0},${y0} A${rExt},${rExt} 0 ${grande} 1 ${x1},${y1} L${x2},${y2} A${rInt},${rInt} 0 ${grande} 0 ${x3},${y3} Z`;
}
/* filas: [{label, valor, color}] — el color se asigna fuera para que sea estable por entidad */
function donut(cont, filas, opts={}){
  const total = filas.reduce((a,f)=>a+f.valor, 0);
  const S = opts.size || 190, r = S/2, ri = r*0.60, cx = r, cy = r;
  if(!total){ cont.innerHTML = '<p class="empty">Sin horas en este periodo.</p>'; return; }
  let a = 0, paths = '';
  filas.forEach(f=>{
    if(f.valor <= 0) return;
    const ang = f.valor/total*Math.PI*2;
    /* un hueco de 2px entre porciones, como manda el buen gusto */
    const hueco = filas.filter(x=>x.valor>0).length > 1 ? 0.014 : 0;
    paths += `<path class="arc" d="${arcoAnillo(cx,cy,r,ri,a+hueco/2,a+ang-hueco/2)}" fill="${f.color}"
      data-tip="<b>${esc(f.label)}</b><br>${hhmm(f.valor)} h · ${Math.round(f.valor/total*100)}%"/>`;
    a += ang;
  });
  cont.innerHTML = `<div class="donutwrap">
    <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${paths}
      <text class="donut-center" x="${cx}" y="${cy-2}" text-anchor="middle"
        style="font-size:20px;font-weight:500;fill:var(--ink)">${hhmm(total)}</text>
      <text x="${cx}" y="${cy+15}" text-anchor="middle"
        style="font-size:11px;letter-spacing:.14em;fill:var(--muted)">HORAS</text>
    </svg>
    <div class="dlegend">${filas.filter(f=>f.valor>0).map(f=>`<div class="drow">
      <i class="dotcat" style="background:${f.color}"></i>
      <span class="dn">${esc(f.label)}</span>
      <span class="dh">${hhmm(f.valor)}</span>
      <span class="dp">${(f.valor/total*100).toFixed(1).replace('.',',')}%</span>
    </div>`).join('')}</div></div>`;
  bindTip(cont);
}
/* ================= EXPORTAR (CSV y PDF, sin librerías remotas) ================= */
function bytesBase64(bytes){
  let bin = '';
  for(let i=0;i<bytes.length;i+=0x8000){
    bin += String.fromCharCode(...bytes.subarray(i, i+0x8000));
  }
  return btoa(bin);
}
function textoBase64(texto){
  return bytesBase64(new TextEncoder().encode(texto));
}
function enviarExportacion(nombre, tipo, cuerpo){
  if(!cuerpo){ toast('El archivo ha salido vacío'); return; }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/exportar';
  form.style.display = 'none';
  const campo = (n,v)=>{
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = n;
    i.value = v;
    form.appendChild(i);
  };
  campo('nombre', nombre);
  campo('tipo', tipo || 'pdf');
  campo('cuerpo', cuerpo);
  document.body.appendChild(form);
  form.submit();
  setTimeout(()=>form.remove(), 4000);
  toast('Descargando '+nombre);
}
function descargarTexto(nombre, texto){
  enviarExportacion(nombre, 'csv', textoBase64(texto));
}
function descargarBytes(nombre, bytes, tipo){
  enviarExportacion(nombre, tipo || 'pdf', bytesBase64(bytes));
}

$('#btnCSV').addEventListener('click', ()=>{
  try {
    const lista = [...filtradas()].sort((a,b)=>a.ini-b.ini);
    const q = s => '"'+String(s).replace(/"/g,'""')+'"';
    const head = ['Fecha','Proyecto','Cliente','Tipo','Descripción','Inicio','Fin','Horas'];
    const body = lista.map(e=>[new Date(e.ini).toLocaleDateString('es-ES'),
      (proyById(e.proyId)||{}).nom||'—', (proyById(e.proyId)||{}).cliente||'—', (catById(e.cat)||{}).nom||'—', e.desc,
      fHora(e.ini), fHora(e.fin), (dur(e)/3600).toFixed(2).replace('.',',')].map(q).join(';'));
    descargarTexto('lacorte_fichaje_'+fechaISOLocal()+'.csv',
      '\uFEFF'+[head.map(q).join(';'), ...body].join('\r\n'));
  } catch (err) {
    console.error(err);
    toast('No se ha podido crear el CSV');
  }
});

function pdfTexto(s){
  const map = {
    'á':'\341','é':'\351','í':'\355','ó':'\363','ú':'\372','ñ':'\361','ü':'\374',
    'Á':'\301','É':'\311','Í':'\315','Ó':'\323','Ú':'\332','Ñ':'\321','Ü':'\334',
    '¿':'\277','¡':'\241','º':'\272','ª':'\252','·':'\267'
  };
  let out = '';
  for(const c of String(s ?? '')){
    if(c==='\\' || c==='(' || c===')') out += '\\'+c;
    else if(map[c]) out += map[c];
    else if(c.charCodeAt(0)>126) out += '?';
    else out += c;
  }
  return '('+out+')';
}
function pdfPaginas(dibujar){
  const paginas = [];
  let cmds = [];
  const flush = () => { paginas.push(cmds.join('\n')); cmds = []; };
  const txt = (x, y, s, size, bold) => {
    cmds.push(`BT /${bold?'FB':'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td ${pdfTexto(s)} Tj ET`);
  };
  const linea = (x1,y1,x2,y2) => {
    cmds.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  };
  dibujar({txt, linea, nueva: flush, W:595, H:842});
  if(cmds.length) flush();
  const objs = [null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${paginas.map((_,i)=>`${3+i} 0 R`).join(' ')}] /Count ${paginas.length} >>`
  ];
  paginas.forEach((stream, i) => {
    const pageN = 3+i, contN = 3+paginas.length+i;
    objs[pageN] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contN} 0 R /Resources << /Font << /F1 ${3+paginas.length*2} 0 R /FB ${4+paginas.length*2} 0 R >> >> >>`;
    objs[contN] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const f1 = 3+paginas.length*2, fb = f1+1;
  objs[f1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[fb] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  let cuerpo = '%PDF-1.4\n';
  const offs = [0];
  for(let i=1;i<objs.length;i++){
    offs[i] = cuerpo.length;
    const body = objs[i];
    cuerpo += body.startsWith('<< /Length') ? `${i} 0 obj\n${body}\nendobj\n` : `${i} 0 obj\n${body}\nendobj\n`;
  }
  const start = cuerpo.length;
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objs.length;i++) xref += String(offs[i]).padStart(10,'0')+' 00000 n \n';
  cuerpo += xref+`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  const buf = new Uint8Array(cuerpo.length);
  for(let i=0;i<cuerpo.length;i++) buf[i] = cuerpo.charCodeAt(i) & 0xff;
  return buf;
}

$('#btnPDF').addEventListener('click', ()=>{
  try {
  const lista = [...filtradas()].sort((a,b)=>a.ini-b.ini);
  const tot = sumar(lista);
  const pro = $('#fProyecto').value;
  const quien = ME.nom;
  const proyNom = pro ? proyById(+pro).nom : 'Todos los proyectos';
  const corte = s => s.length>42 ? s.slice(0,41)+'...' : s;
  const pdf = pdfPaginas(g=>{
    let y = 0;
    const cabecera = () => {
      g.txt(40, 808, 'La Corte  ·  Informe de horas', 13, true);
      g.txt(40, 790, `${quien}  ·  ${proyNom}  ·  últimos ${rango} días  ·  ${new Date().toLocaleDateString('es-ES')}`, 8);
      g.txt(40, 776, `Total ${hhmm(tot)} h  ·  ${lista.length} registro${lista.length===1?'':'s'}`, 8);
      g.linea(40, 768, 555, 768);
      y = 752;
      [['Fecha',40],['Proyecto',110],['Tipo',250],['Descripción',350],['Horas',520]].forEach(([t,x])=>g.txt(x,y,t,8,true));
      y = 736;
    };
    cabecera();
    if(!lista.length){
      g.txt(40, y, 'Sin registros con estos filtros.', 10);
      return;
    }
    lista.forEach(e=>{
      if(y<52){ g.nueva(); cabecera(); }
      g.txt(40, y, fCorta(e.ini), 8);
      g.txt(110, y, corte(proyById(e.proyId).nom), 8);
      g.txt(250, y, catById(e.cat).nom, 8);
      g.txt(350, y, corte(e.desc||'—'), 8);
      g.txt(520, y, hhmm(dur(e)), 8);
      y -= 14;
    });
  });
  descargarBytes('lacorte_horas_'+fechaISOLocal()+'.pdf', pdf, 'pdf');
  } catch(err){
    console.error(err);
    toast('No se ha podido crear el PDF');
  }
});

LC.fichaje = {
  entradas(){
    return ENTRADAS.map(e=>({...e}));
  },
  entradasProyecto(proyId){
    return ENTRADAS.filter(e=>e.proyId===+proyId).map(e=>({...e}));
  },
  entradasUsuario(userId, desde){
    return ENTRADAS.filter(e=>e.userId===+userId && (!desde || e.ini>=desde)).map(e=>({...e}));
  },
  entradasDesde(desde){
    return ENTRADAS.filter(e=>!desde || e.ini>=desde).map(e=>({...e}));
  },
  horasDeEscena(tareaId){
    return ENTRADAS.filter(e=>e.tareaId===tareaId).reduce((a,e)=>a+dur(e),0);
  },
  registrosDeEscena(tareaId){
    return ENTRADAS.filter(e=>e.tareaId===tareaId).map(e=>({...e}));
  },
  desenlazarEscena(tareaId){
    ENTRADAS.forEach(e=>{ if(e.tareaId===tareaId) e.tareaId = null; });
  }
};
