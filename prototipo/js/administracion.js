/* administracion.js
   Pantallas de administración: gestión, equipo y usuarios.
   No lee directamente Producción ni Fichaje; pide datos por LC.puente. */
window.LC = window.LC || {};

let gEstado = '', gCliente = '', gSel = null;

const adminUsuarios = () => LC.puente.usuarios();
const adminUsuario = id => LC.puente.usuario(id);
const adminProyectos = () => LC.puente.proyectos();
const adminProyecto = id => LC.puente.proyecto(id);
const adminCats = () => LC.puente.categorias();
const adminEstados = () => LC.puente.estados();
const adminTarifa = () => LC.puente.tarifa();
const segs = e => (e.fin-e.ini)/1000;
const sumaSeg = l => l.reduce((a,e)=>a+segs(e),0);
const eurAdmin = n => n.toLocaleString('es-ES',{maximumFractionDigits:0})+' €';
const diasAdmin = f => f ? Math.ceil((new Date(f+'T23:59') - Date.now())/DAY) : null;

function adminCosteLista(l){
  const tarifa = adminTarifa();
  return l.reduce((a,e)=>a+segs(e)/3600*(tarifa[e.cat]||0), 0);
}
function adminDatosProyecto(p){
  const cats = adminCats();
  const l = LC.puente.entradasProyecto(p.id);
  const horas = sumaSeg(l)/3600;
  const parts = cats.map(c=>l.filter(e=>e.cat===c.id).reduce((a,e)=>a+segs(e),0)/3600);
  const pct = p.presu ? horas/p.presu*100 : 0;
  return {p, l, horas, parts, pct, coste:adminCosteLista(l),
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
    <div class="lbl" style="margin-bottom:12px">Restablecimiento</div>
    <h2>Código para ${esc(u.nom)}</h2>
    <p class="cap">Dáselo en mano o por un canal privado. Con él elegirá <strong>su propia</strong>
      contraseña desde la pantalla de acceso; tú no llegarás a saberla.</p>
    <div class="codebox"><div class="k">Código · caduca en 24 horas</div><div class="v">${esc(cod)}</div></div>
    <p class="cap" style="margin:0">La persona entra en «He olvidado mi contraseña» → «Ya tengo un código».</p>
    <div class="acts"><button class="btn btn-primary" id="mkOk" style="padding:9px 16px">Hecho</button></div>
  </div></div>`;
  $('#mkOk').addEventListener('click', ()=>{ cerrarModal(); render(); });
}
function adminMostrarReset(r){
  if(r && r.usuario && r.codigo) adminModalCodigo(r.usuario, r.codigo);
}

function renderEquipo(){
  const desde = HOY.getTime()-13*DAY;
  const cats = adminCats();
  const filas = adminUsuarios().map(u=>{
    const l = LC.puente.entradasUsuario(u.id, desde), parts=cats.map(()=>0);
    l.forEach(e=>{ const i=cats.findIndex(c=>c.id===e.cat); if(i>=0) parts[i] += segs(e); });
    const todas = LC.puente.entradasUsuario(u.id);
    return {label:u.nom, parts, total:parts.reduce((a,b)=>a+b,0), u,
      ult:todas.reduce((m,e)=>Math.max(m,e.ini),0)};
  }).sort((a,b)=>b.total-a.total);
  chartBarrasH($('#chartEquipo'), filas, {labW:150}); legend($('#legEquipo'));
  $('#tablaEquipo').innerHTML = `<table><thead><tr>
    <th>Nombre</th><th>Usuario</th><th>Rol</th><th class="num">Última actividad</th><th class="num">Horas (14 días)</th>
    </tr></thead><tbody>${filas.map(f=>`<tr>
      <td><span class="pill"><span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--ink);color:var(--paper)">${esc(f.u.ini)}</span>${esc(f.u.nom)}</span></td>
      <td style="color:var(--ink-2)" class="mono">${esc(f.u.user)}</td>
      <td><span class="tagx${f.u.rol==='admin'?' on':''}">${f.u.rol==='admin'?'Admin':'Usuario'}</span></td>
      <td class="num" style="color:var(--muted)">${f.ult?fCorta(f.ult):'—'}</td>
      <td class="num" style="font-weight:600">${hhmm(f.total)} h</td></tr>`).join('')}</tbody></table>`;
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
  $('#gKpis').innerHTML = `
    <div class="card kpi"><span class="lbl">Proyectos en curso</span>
      <span class="v">${activos.length}</span><span class="tile-note">${filas.length} en la cartera filtrada</span></div>
    <div class="card kpi"><span class="lbl">Horas este mes</span>
      <span class="v">${hMes.toFixed(0)} h</span><span class="tile-note">de todo el equipo</span></div>
    <div class="card kpi"><span class="lbl">Desviación media</span>
      <span class="v">${desv>0?'+':''}${desv.toFixed(0)}%</span><span class="tile-note">sobre las horas presupuestadas</span></div>
    <div class="card kpi"><span class="lbl">${riesgo?'Atención':'Próxima entrega'}</span>
      <span class="v" style="font-size:15px;letter-spacing:0;line-height:1.3">${
        riesgo ? esc(riesgo.p.nom) : (proximo?esc(proximo.p.nom):'—')}</span>
      <span class="tile-note">${
        riesgo ? `${riesgo.pct.toFixed(0)}% del presupuesto consumido`
               : (proximo ? `entrega en ${proximo.dias} días` : 'sin fechas fijadas')}</span></div>`;

  $('#gTabla').innerHTML = `<table><thead><tr>
    <th>Proyecto</th><th>Formato</th><th>Estado</th><th>Equipo</th>
    <th style="min-width:150px">Consumo de horas</th><th class="num">Reales / presu.</th>
    <th class="num">Coste</th><th class="num">Entrega</th></tr></thead><tbody>
    ${filas.sort((a,b)=>b.horas-a.horas).map(f=>{
      const over = f.p.presu && f.horas > f.p.presu;
      const cerca = f.p.presu && !over && f.pct>=85;
      return `<tr class="projrow" data-proy="${f.p.id}" aria-selected="${gSel===f.p.id}">
        <td><strong>${esc(f.p.nom)}</strong><div style="font-size:11.5px;color:var(--muted)">${esc(f.p.cliente)}</div></td>
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
        <td class="num">${eurAdmin(f.coste)}</td>
        <td class="num" style="color:${f.dias!==null&&f.dias<10&&f.p.estado==='curso'?'var(--stop)':'var(--muted)'}">
          ${f.p.entrega ? new Date(f.p.entrega).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})
            + (f.p.estado==='curso'&&f.dias!==null?`<div style="font-size:11px">${f.dias>=0?f.dias+' días':'vencida'}</div>`:'') : '—'}</td>
      </tr>`; }).join('')}</tbody></table>`;
  $$('#gTabla .projrow').forEach(tr=>tr.addEventListener('click', ()=>{
    gSel = gSel===+tr.dataset.proy ? null : +tr.dataset.proy; render();
    if(gSel) $('#gDetalle').scrollIntoView({behavior:'smooth', block:'nearest'});
  }));

  const box = $('#gDetalle');
  if(!gSel){ box.innerHTML = '<p class="empty">Selecciona un proyecto de la tabla para ver su ficha completa.</p>'; return; }
  const f = adminDatosProyecto(adminProyecto(gSel)), p = f.p;
  const porPersona = adminUsuarios().map(u=>{
    const l = f.l.filter(e=>e.userId===u.id), parts=cats.map(()=>0);
    l.forEach(e=>{ const i=cats.findIndex(c=>c.id===e.cat); if(i>=0) parts[i] += segs(e); });
    return {label:u.nom, parts, total:parts.reduce((a,b)=>a+b,0)};
  }).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const semanas = [];
  for(let k=7;k>=0;k--){
    const l0 = +lunesDe(new Date(Date.now()-k*7*DAY)), l1 = l0+7*DAY;
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
        <div><span class="lbl">Coste interno</span><div class="tile-value" style="font-size:22px">${eurAdmin(f.coste)}</div>
          <div class="tile-note">a tarifa por función</div></div>
        <div><span class="lbl">Minutos de programa</span><div class="tile-value" style="font-size:22px">${p.minPrograma||'—'}</div>
          <div class="tile-note">${f.ratio?`${f.ratio.toFixed(1)} h de trabajo por minuto`:'sin duración fijada'}</div></div>
        <div><span class="lbl">Versiones al cliente</span><div class="tile-value" style="font-size:22px">${p.versiones}</div>
          <div class="tile-note">${f.ult?`última actividad ${fCorta(f.ult)}`:'sin actividad'}</div></div>
      </div>
    </div>
    <div class="grid g2" style="margin-bottom:12px">
      <div class="card"><h2>Quién ha trabajado en él</h2>
        <p class="cap">Horas por persona, divididas por función.</p><div id="pPersonas"></div>
        <div class="legend">${cats.map(c=>`<span><i class="dotcat" style="background:${c.color}"></i>${esc(c.nom)}</span>`).join('')}</div></div>
      <div class="card"><h2>En qué se va el tiempo</h2>
        <p class="cap">Reparto entre gestión, asistencia y montaje.</p><div id="pDonut"></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Ritmo de las últimas 8 semanas</h2>
        <p class="cap">Horas dedicadas cada semana. Sirve para ver si el proyecto se está acelerando.</p>
        <div id="pSemanas"></div></div>
      <div class="card"><h2>Datos para evaluar el proyecto</h2>
        <p class="cap">Lo que conviene mirar al cerrarlo y al presupuestar el siguiente.</p>
        <div class="metric"><span class="mk">Horas presupuestadas</span><span class="mv">${p.presu||'—'} h</span></div>
        <div class="metric"><span class="mk">Horas consumidas</span><span class="mv">${f.horas.toFixed(1)} h</span></div>
        <div class="metric"><span class="mk">Desviación</span><span class="mv ${p.presu&&f.horas>p.presu?'delta up':'delta dn'}">${
          p.presu ? `${f.horas>p.presu?'+':''}${(f.horas-p.presu).toFixed(0)} h (${f.pct.toFixed(0)}%)` : '—'}</span></div>
        <div class="metric"><span class="mk">Coste interno acumulado</span><span class="mv">${eurAdmin(f.coste)}</span></div>
        <div class="metric"><span class="mk">Coste por minuto entregado</span><span class="mv">${
          p.minPrograma ? eurAdmin(f.coste/p.minPrograma) : '—'}</span></div>
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

function exportarGestionCSV(){
  try {
    const estados = adminEstados();
    const q = s => '"'+String(s).replace(/"/g,'""')+'"';
    const head = ['Proyecto','Cliente','Formato','Estado','Entrega','Horas presupuestadas','Horas reales',
      'Desviación h','Gestión h','Asistencia h','Montaje h','Coste €','Min. programa','Horas por minuto','Versiones'];
    const body = adminVisiblesGestion().map(f=>[f.p.nom, f.p.cliente, f.p.formato, estados[f.p.estado], f.p.entrega||'',
      f.p.presu, f.horas.toFixed(2), (f.horas-f.p.presu).toFixed(2), f.parts[0].toFixed(2), f.parts[1].toFixed(2),
      f.parts[2].toFixed(2), f.coste.toFixed(2), f.p.minPrograma, f.ratio?f.ratio.toFixed(2):'', f.p.versiones]
      .map(v=>q(String(v).replace('.',','))).join(';'));
    descargarTexto('lacorte_proyectos_'+new Date().toISOString().slice(0,10)+'.csv',
      '\uFEFF'+[head.map(q).join(';'), ...body].join('\r\n'));
  } catch (err) {
    console.error(err);
    toast('No se ha podido crear el CSV');
  }
}

function renderUsuarios(){
  const usuarios = adminUsuarios(), ajustes = LC.puente.ajustes(), solicitudes = LC.puente.solicitudes();
  const conMfa = usuarios.filter(u=>u.mfa.activo).length;
  $('#politicaBox').innerHTML = `<div class="card" style="margin-bottom:12px">
    <h2>Política de acceso</h2>
    <p class="cap">Cómo entra el equipo a la aplicación.</p>
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
  $('#solicitudesBox').innerHTML = `<div class="card" style="margin-bottom:12px">
    <h2>Avisos de contraseña olvidada</h2>
    <p class="cap">Lo único que puedes hacer es darle un código para que se la cambie ella misma.</p>
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
      <td><span class="pill"><span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--ink);color:var(--paper)">${esc(u.ini)}</span><strong>${esc(u.nom)}</strong></span>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">alta ${new Date(u.alta).toLocaleDateString('es-ES')}</div></td>
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

  $('#tablaLog').innerHTML = LC.puente.actividad().length ? `<table><thead><tr>
    <th class="num" style="width:130px">Fecha</th><th style="width:180px">Quién</th><th>Acción</th>
    </tr></thead><tbody>${LC.puente.actividad().slice(0,25).map(l=>`<tr>
      <td class="num" style="color:var(--muted)">${fCorta(l.ts)} ${fHora(l.ts)}</td>
      <td style="color:var(--ink-2)">${esc(l.quien)}</td>
      <td>${esc(l.accion)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Sin actividad registrada.</p>';
}

function armaAdministracion(){
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

LC.administracion = { renderGestion, renderEquipo, renderUsuarios, armaAdministracion };
armaAdministracion();
