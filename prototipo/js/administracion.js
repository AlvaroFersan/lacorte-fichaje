/* administracion.js
   Pantallas de administración: gestión, equipo y usuarios.
   No lee directamente Producción ni Fichaje; pide datos por LC.puente. */
window.LC = window.LC || {};

let gEstado = '', gCliente = '', gSel = null;
let gestProy = '', gestRango = 30;
let gestUser = null;
let GEST_DOCS = [], nextGestDoc = 1;
let eqTab = 'cuentas'; /* pestaña activa dentro de Equipo */

const adminUsuarios = () => LC.puente.usuarios();
const adminUsuario = id => LC.puente.usuario(id);
const adminProyectos = () => LC.puente.proyectos().filter(p=>!p.personal);
const adminProyecto = id => LC.puente.proyecto(id);
const adminCats = () => LC.puente.categorias();
const adminEstados = () => LC.puente.estados();
const segs = e => (e.fin-e.ini)/1000;
const sumaSeg = l => l.reduce((a,e)=>a+segs(e),0);
const diasAdmin = f => diasHasta(f);
const puedeAdminGestion = () => typeof puedeVerGestion==='function' && puedeVerGestion();

function persistGestDocs(){
  try { localStorage.setItem('lc_gestion_docs_v1', JSON.stringify({next:nextGestDoc, docs:GEST_DOCS})); } catch(_){}
}
function recuperaGestDocs(){
  try {
    const d = JSON.parse(localStorage.getItem('lc_gestion_docs_v1')||'null');
    if(!d || !Array.isArray(d.docs)) return;
    GEST_DOCS = d.docs; if(d.next) nextGestDoc = Math.max(nextGestDoc, +d.next);
  } catch(_){}
}
recuperaGestDocs();
function leeDocGestion(file){
  return new Promise((ok, ko)=>{
    if(!file) return ok(null);
    if(file.size > 8*1024*1024) return ko(new Error('max'));
    const r = new FileReader();
    r.onload = () => ok({nom:file.name, tipo:file.type||'application/octet-stream', tam:file.size, data:r.result});
    r.onerror = () => ko(r.error || new Error('archivo'));
    r.readAsDataURL(file);
  });
}

function adminDatosProyecto(p){
  const cats = adminCats();
  const l = LC.puente.entradasProyecto(p.id);
  const horas = sumaSeg(l)/3600;
  const parts = cats.map(c=>l.filter(e=>e.cat===c.id).reduce((a,e)=>a+segs(e),0)/3600);
  const pct = p.presu ? horas/p.presu*100 : 0;
  return {p, l, horas, parts, pct,
    ult: l.length ? Math.max(...l.map(e=>e.ini)) : null,
    dias: diasAdmin(p.entrega),
    ratio: p.minPrograma ? horas/p.minPrograma : null};
}
function adminVisiblesGestion(){
  return adminProyectos()
    .filter(p=>(!gEstado||p.estado===gEstado) && (!gCliente||p.cliente===gCliente))
    .map(adminDatosProyecto);
}
function adminModalCodigo(u, cod){
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal">
    <h2>Código para ${esc(u.nom)}</h2>
    <p class="cap">Dáselo en mano. Con él elegirá su propia contraseña; tú no llegarás a saberla.</p>
    <div class="codebox"><div class="k">Código · caduca en 24 horas</div><div class="v">${esc(cod)}</div></div>
    <p class="cap" style="margin:0">Entra en «He olvidado mi contraseña» → «Ya tengo un código».</p>
    <div class="acts"><button class="btn btn-primary" id="mkOk" style="padding:9px 16px">Hecho</button></div>
  </div></div>`;
  $('#mkOk').addEventListener('click', ()=>{ cerrarModal(); render(); });
}
function adminMostrarReset(r){
  if(r && r.usuario && r.codigo) adminModalCodigo(r.usuario, r.codigo);
}

/* Proyectos es una vista sola. Gestión ve la cartera como consumo de tiempo;
   el resto, sus propias horas por proyecto. */
function renderVistaProyectos(){
  const gestion = puedeAdminGestion();
  if($('#pageTitle')) $('#pageTitle').textContent = gestion ? 'Cartera' : 'Mis proyectos';
  if(typeof aplicaTemaProyecto==='function'){
    const pTema = gestion && gSel ? adminProyecto(gSel) : null;
    LC.adminTemaProyecto = pTema && pTema.color ? pTema.color : null;
    aplicaTemaProyecto(LC.adminTemaProyecto);
  }
  $$('#v-proyectos .admin-gestion-only').forEach(el=>el.classList.toggle('hide', !gestion));
  $('#proySimple').classList.toggle('hide', gestion);
  $('#gDetalle').classList.toggle('hide', !gestion);
  if(gestion) renderGestion();
  else { $('#gKpis').innerHTML = ''; renderProyectos(); }
}

/* Equipo reúne lo que antes estaba partido entre «Equipo» y «Usuarios». */
function renderEquipo(){
  $$('#eqTabs button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.t===eqTab));
  if(!['cuentas','actividad'].includes(eqTab)) eqTab = 'cuentas';
  ['cuentas','actividad'].forEach(t=>$('#eq-'+t).classList.toggle('hide', t!==eqTab));
  const pend = LC.puente.solicitudes().filter(s=>s.estado==='pendiente').length;
  const bd = $('#eqBadge');
  bd.textContent = pend;
  bd.classList.toggle('hide', !pend);
  ({cuentas:renderCuentas, actividad:renderActividad})[eqTab]();
}

function renderGestion(){
  const proyectos = adminProyectos(), estados = adminEstados(), cats = adminCats();
  if(!$('#gCliente').options.length){
    $('#gCliente').innerHTML = '<option value="">Todos los clientes</option>'+
      [...new Set(proyectos.map(p=>p.cliente))].filter(c=>c!=='—')
        .map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#gCliente').addEventListener('change', ()=>{ gCliente = $('#gCliente').value; render(); });
  }
  const filas = adminVisiblesGestion();
  const activos = filas.filter(f=>f.p.estado==='curso');
  const mes0 = new Date(); mes0.setDate(1); mes0.setHours(0,0,0,0);
  const hMes = LC.puente.entradasDesde(+mes0).reduce((a,e)=>a+segs(e),0)/3600;
  const conPresu = filas.filter(f=>f.p.presu>0);
  const desv = conPresu.length ? conPresu.reduce((a,f)=>a+(f.horas-f.p.presu)/f.p.presu,0)/conPresu.length*100 : 0;
  const riesgo = activos.filter(f=>f.pct>=85).sort((a,b)=>b.pct-a.pct)[0];
  const proximo = activos.filter(f=>f.dias!==null).sort((a,b)=>a.dias-b.dias)[0];
  $('#gKpis').innerHTML = `<div class="jornada">
    <div class="j-cifra"><span class="lbl">En curso</span><b>${activos.length}</b>
      <span class="j-nota">${filas.length} en la cartera</span></div>
    <div class="j-cifra"><span class="lbl">Horas este mes</span><b class="j-sem">${hMes.toFixed(0)} h</b>
      <span class="j-nota">de todo el equipo</span></div>
    <div class="j-cifra"><span class="lbl">Desviación</span><b class="j-sem">${desv>0?'+':''}${desv.toFixed(0)}%</b>
      <span class="j-nota">sobre lo presupuestado</span></div>
    <div class="j-reparto"><span class="lbl">${riesgo?'Atención':'Próxima entrega'}</span>
      <div class="j-destaca">${riesgo ? esc(riesgo.p.nom) : (proximo?esc(proximo.p.nom):'—')}</div>
      <span class="j-nota">${
        riesgo ? `${riesgo.pct.toFixed(0)}% del presupuesto consumido`
               : (proximo ? `entrega en ${proximo.dias} días` : 'sin fechas fijadas')}</span></div>
  </div>`;

  $('#gTabla').innerHTML = `<table><thead><tr>
    <th>Proyecto</th><th>Señal</th><th>Formato</th><th>Estado</th><th>Equipo</th>
    <th style="min-width:150px">Consumo de horas</th><th class="num">Reales / prev.</th>
    <th class="num">Entrega</th></tr></thead><tbody>
    ${filas.sort((a,b)=>b.horas-a.horas).map(f=>{
      const over = f.p.presu && f.horas > f.p.presu;
      const cerca = f.p.presu && !over && f.pct>=85;
      const vencida = f.dias!==null && f.dias<0 && f.p.estado==='curso';
      const pronta = f.dias!==null && f.dias<10 && f.p.estado==='curso';
      const senal = over ? 'Horas pasadas' : (vencida ? 'Entrega vencida' : (cerca ? 'Vigilar horas' : (pronta ? 'Entrega cerca' : (f.ult ? 'En ritmo' : 'Sin horas'))));
      return `<tr class="projrow" data-proy="${f.p.id}" aria-selected="${gSel===f.p.id}">
        <td><strong>${esc(f.p.nom)}</strong><div style="font-size:12px;color:var(--muted)">${esc(f.p.cliente)}</div></td>
        <td><span class="tagx${over||vencida||cerca?' wait':' on'}">${senal}</span></td>
        <td style="color:var(--ink-2)">${esc(f.p.formato)}</td>
        <td><span class="tagx${f.p.estado==='curso'?' on':''}${cerca||over?' wait':''}">${estados[f.p.estado]}</span></td>
        <td><div class="avstack">${(f.p.equipo||[]).map(id=>{
          const u = adminUsuario(id) || {nom:'?', ini:'?'};
          return `<span class="avatar" title="${esc(u.nom)}">${esc(u.ini)}</span>`;
        }).join('')}</div></td>
        <td><div class="bar" title="${f.pct.toFixed(0)}%"><i class="${over?'over':(cerca?'':'ok')}"
             style="width:${Math.min(f.pct,100)}%"></i></div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">${f.p.presu?f.pct.toFixed(0)+'% consumido':'sin presupuesto'}</div></td>
        <td class="num"><strong>${f.horas.toFixed(0)}</strong> <span style="color:var(--muted)">/ ${f.p.presu||'—'} h</span></td>
        <td class="num" style="color:${f.dias!==null&&f.dias<10&&f.p.estado==='curso'?'var(--stop)':'var(--muted)'}">
          ${f.p.entrega ? fDia(f.p.entrega)
            + (f.p.estado==='curso'&&f.dias!==null?`<div style="font-size:11px">${f.dias>=0?f.dias+' días':'vencida'}</div>`:'') : '—'}</td>
      </tr>`; }).join('')}</tbody></table>`;
  $$('#gTabla .projrow').forEach(tr=>tr.addEventListener('click', ()=>{
    gSel = gSel===+tr.dataset.proy ? null : +tr.dataset.proy; render();
    if(gSel) $('#gDetalle').scrollIntoView({behavior:'smooth', block:'nearest'});
  }));

  const box = $('#gDetalle');
  if(!gSel){ box.innerHTML = '<p class="empty">Pulsa un proyecto para abrir su ficha.</p>'; return; }
  const f = adminDatosProyecto(adminProyecto(gSel)), p = f.p;
  const porPersona = adminUsuarios().map(u=>{
    const l = f.l.filter(e=>e.userId===u.id), parts=cats.map(()=>0);
    l.forEach(e=>{ const i=cats.findIndex(c=>c.id===e.cat); if(i>=0) parts[i] += segs(e); });
    return {label:u.nom, parts, total:parts.reduce((a,b)=>a+b,0)};
  }).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const semanas = [];
  for(let k=7;k>=0;k--){
    const l0 = +lunesDe(sumaDias(hoy(), -k*7)), l1 = +sumaDias(l0, 7);
    semanas.push({ts:l0, parts:cats.map(c=>f.l.filter(e=>e.cat===c.id&&e.ini>=l0&&e.ini<l1).reduce((a,e)=>a+segs(e),0))});
  }
  semanas.forEach(s=>s.total = s.parts.reduce((a,b)=>a+b,0));

  box.innerHTML = `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div><h2 style="font-size:13px;letter-spacing:-.01em;text-transform:none;margin-bottom:4px">${esc(p.nom)}</h2>
          <p class="cap" style="margin:0">${esc(p.cliente)} · ${esc(p.formato)} · ${estados[p.estado]}</p></div>
        <div class="chips">
          <select class="btn btn-sm" id="pEstado">${Object.entries(estados).map(([k,v])=>
            `<option value="${k}"${k===p.estado?' selected':''}>${v}</option>`).join('')}</select>
          <input class="btn btn-sm" type="number" id="pPresu" value="${p.presu}" min="0" step="10" style="width:92px" title="Horas presupuestadas">
          <input class="btn btn-sm" type="date" id="pEntrega" value="${p.entrega}" title="Fecha de entrega">
        </div>
      </div>
      <div class="grid g4" style="margin-top:16px">
        <div><span class="lbl">Horas reales</span><div class="tile-value" style="font-size:22px">${f.horas.toFixed(1)} h</div>
          <div class="tile-note">${p.presu?`${(p.presu-f.horas).toFixed(0)} h restantes de ${p.presu}`:'sin presupuesto fijado'}</div></div>
        <div><span class="lbl">Gestión</span><div class="tile-value" style="font-size:22px">${f.parts[0].toFixed(1)} h</div>
          <div class="tile-note">${f.horas?Math.round(f.parts[0]/f.horas*100):0}% del tiempo</div></div>
        <div><span class="lbl">Minutos de programa</span><div class="tile-value" style="font-size:22px">${p.minPrograma||'—'}</div>
          <div class="tile-note">${f.ratio?`${f.ratio.toFixed(1)} h de trabajo por minuto`:'sin duración fijada'}</div></div>
        <div><span class="lbl">Versiones al cliente</span><div class="tile-value" style="font-size:22px">${p.versiones}</div>
          <div class="tile-note">${f.ult?`última actividad ${fCorta(f.ult)}`:'sin actividad'}</div></div>
      </div>
    </div>
    <div class="grid g2" style="margin-bottom:12px">
      <div class="card"><h2>Quién ha trabajado en él</h2><div id="pPersonas"></div>
        <div class="legend">${cats.map(c=>`<span><i class="dotcat" style="background:${c.color}"></i>${esc(c.nom)}</span>`).join('')}</div></div>
      <div class="card"><h2>En qué se va el tiempo</h2><div id="pDonut"></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Ritmo de las últimas 8 semanas</h2>
        <div id="pSemanas"></div></div>
      <div class="card"><h2>Para evaluar el proyecto</h2>
        <div class="metric"><span class="mk">Horas presupuestadas</span><span class="mv">${p.presu||'—'} h</span></div>
        <div class="metric"><span class="mk">Horas consumidas</span><span class="mv">${f.horas.toFixed(1)} h</span></div>
        <div class="metric"><span class="mk">Desviación</span><span class="mv ${p.presu&&f.horas>p.presu?'delta up':'delta dn'}">${
          p.presu ? `${f.horas>p.presu?'+':''}${(f.horas-p.presu).toFixed(0)} h (${f.pct.toFixed(0)}%)` : '—'}</span></div>
        <div class="metric"><span class="mk">Horas de montaje por minuto</span><span class="mv">${
          p.minPrograma ? (f.parts[2]/p.minPrograma).toFixed(1)+' h' : '—'}</span></div>
        <div class="metric"><span class="mk">Peso de la asistencia</span><span class="mv">${
          f.horas ? Math.round(f.parts[1]/f.horas*100)+'%' : '—'}</span></div>
        <div class="metric"><span class="mk">Personas implicadas</span><span class="mv">${porPersona.length}</span></div>
        <div class="metric"><span class="mk">Registros anotados</span><span class="mv">${f.l.length}</span></div>
      </div>
    </div>`;

  porPersona.length ? chartBarrasH($('#pPersonas'), porPersona, {labW:132})
                    : $('#pPersonas').innerHTML = '<p class="empty">Nadie ha imputado horas todavía.</p>';
  donut($('#pDonut'), cats.map((c,i)=>({label:c.nom, valor:f.parts[i]*3600, color:c.color})), {size:170});
  chartDias($('#pSemanas'), semanas.map(s=>({ts:s.ts, parts:s.parts, total:s.total})));

  $('#pEstado').addEventListener('change', e=>{ LC.puente.actualizarProyecto(p.id, {estado:e.target.value}); render(); });
  $('#pPresu').addEventListener('change', e=>{ LC.puente.actualizarProyecto(p.id, {presu:Math.max(0, +e.target.value||0)}); render(); });
  $('#pEntrega').addEventListener('change', e=>{ LC.puente.actualizarProyecto(p.id, {entrega:e.target.value}); render(); });
}

function renderDetalleGestPersona(filas, proyId, cats){
  const box = $('#gestDetallePersona');
  const fila = filas.find(f=>f.u.id===gestUser);
  if(!fila){ box.innerHTML = '<p class="empty">Pulsa un trabajador para ver detalle y asignarle documentación.</p>'; return; }
  const docs = GEST_DOCS.filter(d=>d.userId===fila.u.id).sort((a,b)=>b.ts-a.ts);
  const pendientes = docs.filter(d=>!d.devuelto).length;
  box.innerHTML = `<div class="gest-persona">
    <div class="gest-persona-head">
      <div><h2>${esc(fila.u.nom)}</h2>
        <p class="cap" style="margin:0">${esc(fila.u.user)} · ${proyId?'detalle del proyecto':'detalle del periodo'}</p></div>
      <span class="pill"><span class="avatar" style="width:22px;height:22px;font-size:11px;background:var(--ink);color:var(--paper)">${esc(fila.u.ini)}</span>${esc(fila.u.user)}</span>
    </div>
    <div class="gest-statrow">
      <div class="gest-mini"><span class="lbl">${proyId?'Dentro del proyecto':'Total periodo'}</span><b>${hhmm(fila.dentro)} h</b></div>
      <div class="gest-mini"><span class="lbl">Gestión</span><b>${hhmm(fila.gestion)} h</b></div>
      <div class="gest-mini"><span class="lbl">Documentos pendientes</span><b>${pendientes}</b></div>
    </div>
    <div class="gest-persona-body">
      <div><h2>Reparto de sus horas</h2><div id="gestPersonaDonut"></div></div>
      <div class="gest-assign">
        <h2>Asignar documento</h2>
        <form class="gest-form" id="gestDocForm">
          <input class="field" id="gestDocTit" placeholder="Nómina septiembre, contrato, parte..." required>
          <label class="filepick">Adjuntar archivo<input id="gestDocFile" class="hide" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,image/*,application/pdf"></label>
          <button class="btn btn-primary" type="submit">Asignar</button>
        </form>
        <p class="hint2">La persona lo verá en Hoy y podrá devolverlo firmado.</p>
      </div>
    </div>
    <div style="padding:0 16px 16px">
      <h2>Documentación pendiente</h2>
      <div class="gest-docs">${docs.length ? docs.map(d=>`<div class="gest-doc${d.devuelto?' devuelto':''}">
        <div><div class="nom">${esc(d.titulo)}</div>
          <div class="meta">${d.adjunto?esc(d.adjunto.nom)+' · ':''}${d.devuelto?'Devuelto firmado':'Pendiente'} · ${fCorta(d.ts)}</div></div>
        <div class="chips">
          ${d.adjunto?`<a class="btn btn-sm" href="${d.adjunto.data}" download="${esc(d.adjunto.nom)}">Original</a>`:''}
          ${d.devuelto?`<a class="btn btn-sm btn-primary" href="${d.devuelto.data}" download="${esc(d.devuelto.nom)}">Firmado</a>`:''}
        </div>
      </div>`).join('') : '<p class="empty">Sin documentos asignados.</p>'}</div>
    </div>
  </div>`;
  donut($('#gestPersonaDonut'), cats.map((c,i)=>({label:c.nom, valor:fila.parts[i], color:c.color})), {size:170});
  $('#gestDocFile').addEventListener('change', e=>{
    e.target.parentElement.firstChild.textContent = e.target.files[0] ? e.target.files[0].name : 'Adjuntar archivo';
  });
  $('#gestDocForm').addEventListener('submit', async ev=>{
    ev.preventDefault();
    try {
      const adjunto = await leeDocGestion($('#gestDocFile').files[0]);
      GEST_DOCS.unshift({id:nextGestDoc++, userId:fila.u.id, titulo:$('#gestDocTit').value.trim(),
        adjunto, devuelto:null, ts:Date.now(), creador:ME.id});
      persistGestDocs(); render(); toast('Documento asignado');
    } catch(_){ toast('Archivo demasiado grande'); }
  });
}

function renderPendientesGestion(){
  const box = $('#misGestiones');
  if(!box || !ME) return;
  const docs = GEST_DOCS.filter(d=>d.userId===ME.id && !d.devuelto).sort((a,b)=>b.ts-a.ts);
  if(!docs.length){ box.innerHTML=''; return; }
  box.innerHTML = `<div class="gest-pend">
    <h2>Gestión pendiente</h2>
    <div class="gest-docs">${docs.map(d=>`<div class="gest-doc" data-doc="${d.id}">
      <div><div class="nom">${esc(d.titulo)}</div>
        <div class="meta">${d.adjunto?esc(d.adjunto.nom)+' · ':''}Devuelve el documento firmado cuando lo tengas.</div></div>
      <div class="chips">
        ${d.adjunto?`<a class="btn btn-sm" href="${d.adjunto.data}" download="${esc(d.adjunto.nom)}">Descargar</a>`:''}
        <label class="btn btn-sm btn-primary">Subir firmado<input type="file" class="hide" data-devuelve="${d.id}" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,image/*,application/pdf"></label>
      </div>
    </div>`).join('')}</div>
  </div>`;
  $$('[data-devuelve]').forEach(inp=>inp.addEventListener('change', async ()=>{
    const d = GEST_DOCS.find(x=>x.id===+inp.dataset.devuelve); if(!d || !inp.files[0]) return;
    try {
      d.devuelto = await leeDocGestion(inp.files[0]);
      d.devueltoTs = Date.now();
      persistGestDocs(); render(); toast('Documento devuelto firmado');
    } catch(_){ toast('Archivo demasiado grande'); }
  }));
}

function renderGestionHoras(){
  if(!puedeAdminGestion()){ go('fichaje'); return; }
  const proyectos = adminProyectos(), cats = adminCats();
  const desde = +sumaDias(hoy(), 1-gestRango);
  const proyId = gestProy ? +gestProy : null;
  const lista = LC.puente.entradasDesde(desde);
  const dentro = proyId ? lista.filter(e=>e.proyId===proyId) : lista;
  const fuera = proyId ? lista.filter(e=>e.proyId!==proyId) : [];
  const total = sumaSeg(lista), totalDentro = sumaSeg(dentro), totalFuera = sumaSeg(fuera);
  $('#gestFiltros').innerHTML = `
    <div class="seg" id="gestRango">
      ${[[14,'14 días'],[30,'30 días'],[90,'90 días']].map(([n,txt])=>
        `<button data-r="${n}" aria-pressed="${gestRango===n}">${txt}</button>`).join('')}
    </div>
    <select id="gestProy" aria-label="Proyecto">
      <option value="">Todos los proyectos</option>
      ${proyectos.map(p=>`<option value="${p.id}"${proyId===p.id?' selected':''}>${esc(p.nom)}</option>`).join('')}
    </select>`;
  $$('#gestRango button').forEach(b=>b.addEventListener('click', ()=>{
    gestRango = +b.dataset.r; render();
  }));
  $('#gestProy').addEventListener('change', e=>{ gestProy = e.target.value; render(); });

  const porCat = cats.map(c=>({
    label:c.nom,
    valor:dentro.filter(e=>e.cat===c.id).reduce((a,e)=>a+segs(e),0),
    color:c.color
  }));
  const filas = adminUsuarios().filter(u=>u.activo).map(u=>{
    const l = lista.filter(e=>e.userId===u.id);
    const ld = proyId ? l.filter(e=>e.proyId===proyId) : l;
    const lf = proyId ? l.filter(e=>e.proyId!==proyId) : [];
    const parts = cats.map(c=>ld.filter(e=>e.cat===c.id).reduce((a,e)=>a+segs(e),0));
    return {u, label:u.nom, parts, dentro:sumaSeg(ld), fuera:sumaSeg(lf),
      gestion:ld.filter(e=>e.cat==='gestion').reduce((a,e)=>a+segs(e),0),
      total:sumaSeg(l)};
  }).sort((a,b)=>b.dentro-a.dentro || b.total-a.total || a.u.nom.localeCompare(b.u.nom));
  if(!gestUser && filas[0]) gestUser = filas[0].u.id;
  $('#gestTrabajadores').innerHTML = filas.length ? `<div class="gest-workers">${filas.map(f=>{
    const pendientes = GEST_DOCS.filter(d=>d.userId===f.u.id && !d.devuelto).length;
    return `<button type="button" class="gest-worker" data-gest-user="${f.u.id}" aria-selected="${f.u.id===gestUser}">
      <span class="avatar">${esc(f.u.ini)}</span>
      <span><span class="nom">${esc(f.u.nom)}</span>
        <span class="meta">${hhmm(f.dentro)} h${pendientes?` · ${pendientes} doc. pendiente${pendientes===1?'':'s'}`:''}</span></span>
    </button>`;
  }).join('')}</div>` : '<p class="empty">Sin horas en este periodo.</p>';
  $$('#gestTrabajadores [data-gest-user]').forEach(b=>b.addEventListener('click', ()=>{
    gestUser = +b.dataset.gestUser; render();
  }));

  $('#gestKpis').innerHTML = `<div class="jornada">
    <div class="j-cifra"><span class="lbl">Total periodo</span><b class="j-hoy">${hhmm(total)} h</b>
      <span class="j-nota">${gestRango} días · todo el equipo</span></div>
    <div class="j-cifra"><span class="lbl">${proyId?'Dentro del proyecto':'En proyectos'}</span><b class="j-sem">${hhmm(totalDentro)} h</b>
      <span class="j-nota">${proyId ? esc((adminProyecto(proyId)||{}).nom||'Proyecto') : 'todos los proyectos'}</span></div>
    <div class="j-cifra"><span class="lbl">Fuera del proyecto</span><b class="j-sem">${proyId?hhmm(totalFuera)+' h':'—'}</b>
      <span class="j-nota">${proyId ? 'resto de trabajos' : 'elige uno para comparar'}</span></div>
    <div class="j-reparto"><span class="lbl">Más consumido</span>
      <div class="j-destaca">${porCat.sort((a,b)=>b.valor-a.valor)[0]?.label || '—'}</div>
      <span class="j-nota">${totalDentro ? Math.round((porCat[0]?.valor||0)/totalDentro*100)+'% del tiempo filtrado' : 'sin horas'}</span></div>
  </div>`;
  donut($('#gestDonut'), porCat, {size:180});
  const filasConHoras = filas.filter(f=>f.total>0);
  filasConHoras.length ? chartBarrasH($('#gestUsuariosChart'), filasConHoras, {labW:140})
               : $('#gestUsuariosChart').innerHTML = '<p class="empty">Sin horas en este periodo.</p>';
  legend($('#gestLegend'));
  $('#gestTabla').innerHTML = filas.length ? `<table><thead><tr>
    <th>Usuario</th><th class="num">${proyId?'Dentro':'Total'}</th><th class="num">Fuera</th>
    <th class="num">Gestión</th><th>Reparto dentro del proyecto</th></tr></thead><tbody>
    ${filas.map(f=>`<tr>
      <td><span class="pill"><span class="avatar" style="width:22px;height:22px;font-size:11px;background:var(--ink);color:var(--paper)">${esc(f.u.ini)}</span>${esc(f.u.nom)}</span></td>
      <td class="num" style="font-weight:650">${hhmm(f.dentro)} h</td>
      <td class="num" style="color:var(--muted)">${proyId?hhmm(f.fuera)+' h':'—'}</td>
      <td class="num" style="color:var(--muted)">${hhmm(f.gestion)} h</td>
      <td>${f.parts.some(Boolean) ? `<svg width="170" height="14" viewBox="0 0 170 14">${(()=>{
        const max = Math.max(f.dentro,1); let acc=0, s='';
        f.parts.forEach((v,i)=>{ if(v<=0) return;
          const w=Math.max(170*v/max-2,1), x=170*acc/max, last=f.parts.slice(i+1).every(z=>z<=0);
          s += `<path d="${last?roundRight(x,1,w,12,3):`M${x},1 h${w} v12 h${-w} Z`}" fill="${cats[i].color}"
            data-tip="<b>${esc(cats[i].nom)}</b><br>${hhmm(v)} h"/>`; acc+=v; });
        return s; })()}</svg>` : '<span style="color:var(--muted)">—</span>'}</td>
    </tr>`).join('')}</tbody></table>` : '<p class="empty">Sin registros con estos filtros.</p>';
  bindTip($('#gestTabla'));
  renderDetalleGestPersona(filas, proyId, cats);
}

function exportarGestionCSV(){
  try {
    const estados = adminEstados();
    const q = s => '"'+String(s).replace(/"/g,'""')+'"';
    const head = ['Proyecto','Cliente','Formato','Estado','Entrega','Horas previstas','Horas reales',
      'Desviación h','Gestión h','Asistencia h','Montaje h','Min. programa','Horas por minuto','Versiones'];
    const body = adminVisiblesGestion().map(f=>[f.p.nom, f.p.cliente, f.p.formato, estados[f.p.estado], f.p.entrega||'',
      f.p.presu, f.horas.toFixed(2), (f.horas-f.p.presu).toFixed(2), f.parts[0].toFixed(2), f.parts[1].toFixed(2),
      f.parts[2].toFixed(2), f.p.minPrograma, f.ratio?f.ratio.toFixed(2):'', f.p.versiones]
      .map(v=>q(String(v).replace('.',','))).join(';'));
    descargarTexto('lacorte_proyectos_'+fechaISOLocal()+'.csv',
      '\uFEFF'+[head.map(q).join(';'), ...body].join('\r\n'));
  } catch (err) {
    console.error(err);
    toast('No se ha podido crear el CSV');
  }
}

function renderCuentas(){
  const usuarios = adminUsuarios(), ajustes = LC.puente.ajustes(), solicitudes = LC.puente.solicitudes();
  const conMfa = usuarios.filter(u=>u.mfa.activo).length;
  $('#politicaBox').innerHTML = `<div class="card" style="margin-bottom:var(--e-3)">
    <h2>Política de acceso</h2>
    <div class="policy">
      <div><div class="pt">Contraseñas cifradas</div>
        <div class="pd">Se guarda un hash con sal, no la contraseña. Ni el administrador puede leerlas:
          solo generar un código para que cada persona ponga la suya.</div></div>
      <span class="tagx on">Siempre activo</span></div>
    <div class="policy">
      <div><div class="pt">Exigir verificación en dos pasos</div>
        <div class="pd">Si lo activas, quien no lo tenga configurado tendrá que hacerlo la próxima vez
          que entre. Ahora mismo lo usan ${conMfa} de ${usuarios.length} personas.</div></div>
      <button class="sw" id="swMfa" aria-pressed="${ajustes.mfaObligatorio}" aria-label="Exigir doble factor"></button></div>
  </div>`;
  $('#swMfa').addEventListener('click', ()=>{ LC.puente.setMfaObligatorio(!ajustes.mfaObligatorio); render(); });

  const pend = solicitudes.filter(s=>s.estado==='pendiente');
  $('#solicitudesBox').innerHTML = `<div class="card" style="margin-bottom:var(--e-3)">
    <h2>Contraseñas olvidadas</h2>
    ${pend.length ? `<table><thead><tr><th>Persona</th><th>Mensaje</th><th>Recibido</th>
      <th style="text-align:right">Acciones</th></tr></thead><tbody>
      ${pend.map(s=>{ const u=adminUsuario(s.userId); return `<tr>
        <td><span class="pill"><span class="tagx wait">Pendiente</span> <strong>${esc(u.nom)}</strong></span></td>
        <td style="color:var(--ink-2)">${esc(s.msg||'—')}</td>
        <td style="color:var(--muted)">${fCorta(s.ts)} ${fHora(s.ts)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm btn-primary" data-sol-res="${s.id}" style="padding:6px 11px">Generar código</button>
          <button class="icon-btn" data-sol-des="${s.id}" title="Descartar">✕</button></td></tr>`; }).join('')}
      </tbody></table>` : '<p class="empty">No hay avisos pendientes.</p>'}
  </div>`;
  $$('[data-sol-res]').forEach(b=>b.addEventListener('click', ()=>adminMostrarReset(LC.puente.resolverSolicitud(+b.dataset.solRes))));
  $$('[data-sol-des]').forEach(b=>b.addEventListener('click', ()=>{ LC.puente.descartarSolicitud(+b.dataset.solDes); render(); }));

  $('#tablaUsuarios').innerHTML = `<table><thead><tr>
    <th>Nombre</th><th>Usuario</th><th>Contraseña guardada</th><th>Dos pasos</th><th>Rol</th>
    <th>Estado</th><th style="text-align:right">Acciones</th></tr></thead><tbody>
    ${usuarios.map(u=>{
      const pendReset = u.reset && Date.now() < u.reset.exp;
      return `<tr>
      <td><span class="pill"><span class="avatar" style="width:22px;height:22px;font-size:11px;background:var(--ink);color:var(--paper)">${esc(u.ini)}</span><strong>${esc(u.nom)}</strong></span>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">alta ${fDia(u.alta)||esc(u.alta||'')}</div></td>
      <td class="mono" style="color:var(--ink-2)">${esc(u.user)}</td>
      <td><div class="hashcell">sha256·${u.iter/1000}k — ${esc(u.hash.slice(0,10))}…${esc(u.hash.slice(-6))}</div>
        ${pendReset?'<span class="tagx wait" style="margin-top:4px">Código activo</span>':''}</td>
      <td>${u.mfa.activo
          ? `<span class="tagx on">Activo</span>
             <div style="font-size:11px;color:var(--muted);margin-top:4px">${u.mfa.recup.filter(r=>!r.usado).length} códigos</div>`
          : '<span class="tagx">Sin configurar</span>'}</td>
      <td><button class="tagx${u.rol==='admin'?' on':''}" data-rol="${u.id}" title="Cambiar rol">${u.rol==='admin'?'Admin':'Usuario'}</button></td>
      <td><span class="tagx" style="${u.activo?'':'opacity:.55'}">${u.activo?'Activo':'Desactivado'}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm" data-reset="${u.id}">Restablecer contraseña</button>
        ${u.mfa.activo?`<button class="btn btn-sm" data-mfa="${u.id}">Quitar 2FA</button>`:''}
        <button class="btn btn-sm" data-toggle="${u.id}">${u.activo?'Desactivar':'Activar'}</button>
      </td></tr>`; }).join('')}</tbody></table>`;
  $$('[data-rol]').forEach(b=>b.addEventListener('click', ()=>{ LC.puente.cambiarRol(+b.dataset.rol); render(); }));
  $$('[data-toggle]').forEach(b=>b.addEventListener('click', ()=>{ LC.puente.cambiarActivo(+b.dataset.toggle); render(); }));
  $$('[data-reset]').forEach(b=>b.addEventListener('click', ()=>adminMostrarReset(LC.puente.resetUsuario(+b.dataset.reset))));
  $$('[data-mfa]').forEach(b=>b.addEventListener('click', ()=>{
    const u = LC.puente.quitarMfa(+b.dataset.mfa);
    render(); if(u) toast(`${u.nom} tendrá que volver a configurar el doble factor`);
  }));

}

function renderActividad(){
  $('#tablaLog').innerHTML = LC.puente.actividad().length ? `<table><thead><tr>
    <th class="num" style="width:130px">Fecha</th><th style="width:180px">Quién</th><th>Acción</th>
    </tr></thead><tbody>${LC.puente.actividad().slice(0,25).map(l=>`<tr>
      <td class="num" style="color:var(--muted)">${fCorta(l.ts)} ${fHora(l.ts)}</td>
      <td style="color:var(--ink-2)">${esc(l.quien)}</td>
      <td>${esc(l.accion)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Sin actividad registrada.</p>';
}

function armaAdministracion(){
  $$('#eqTabs button').forEach(b=>b.addEventListener('click', ()=>{
    eqTab = b.dataset.t;
    render();
  }));
  $$('#gEstado button').forEach(b=>b.addEventListener('click', ()=>{
    gEstado = b.dataset.e;
    $$('#gEstado button').forEach(x=>x.setAttribute('aria-pressed', x===b));
    render();
  }));
  const csv = $('#gCSV');
  if(csv) csv.addEventListener('click', exportarGestionCSV);
  const form = $('#nuevoUserForm');
  if(form) form.addEventListener('submit', ev=>{
    ev.preventDefault();
    const nom = $('#nNom').value.trim(), user = $('#nUser').value.trim().toLowerCase();
    const r = LC.puente.altaUsuario(nom, user, $('#nRol').value);
    if(r && r.error){
      $('#nUser').setCustomValidity(r.error);
      $('#nUser').reportValidity();
      setTimeout(()=>$('#nUser').setCustomValidity(''),50);
      return;
    }
    $('#nNom').value=''; $('#nUser').value='';
    adminMostrarReset(r);
  });
}

LC.administracion = { renderProyectos: renderVistaProyectos, renderGestionHoras, renderPendientesGestion, renderEquipo, armaAdministracion };
armaAdministracion();
