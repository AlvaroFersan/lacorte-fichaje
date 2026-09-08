/* arranque.js
   Enciende la cascara: pinta la vista activa y cambia de pestana.
   No guarda datos de horas ni de escenas. */
function render(){
  if(!ME) return;
  const pend = LC.puente.solicitudes().filter(s=>s.estado==="pendiente").length;
  const bg = $("#navBadge");
  bg.textContent = pend; bg.classList.toggle("hide", !pend || ME.rol!=="admin");
  if(typeof pintaAvisos==="function") pintaAvisos();
  ({fichaje:renderFichaje, calendario:renderCalendario, informes:renderInformes,
    proyectos:renderProyectos,
    gestion:()=>LC.administracion.renderGestion(),
    equipo:()=>LC.administracion.renderEquipo(),
    usuarios:()=>LC.administracion.renderUsuarios(),
    tablero:renderTablero, tabla:renderTabla,
    mistareas:renderMisTareas, flujos:renderFlujos, ayuda:renderAyuda})[vista]();
  if(typeof pintaBulk==="function") pintaBulk();
  if(modulo==="produccion" && typeof pintaExplora==="function") pintaExplora();
  if(typeof pintaCabecera==="function") pintaCabecera();
  if(typeof persistTareas==="function") persistTareas();
  if(typeof persistEntradas==="function") persistEntradas();
  if(window.LC && LC.guarda && LC.guarda.guardarPronto) LC.guarda.guardarPronto();
}

let modulo = "fichaje";
const VISTAS_MOD = {fichaje:["fichaje","calendario","informes","proyectos","gestion","equipo","usuarios"],
                    produccion:["tabla","tablero","mistareas","flujos","ayuda"]};
function irModulo(m){
  modulo = m;
  $("#app").classList.toggle("mod-prod", m==="produccion");
  $$(".modswitch button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.mod===m));
  $$(".mod-fichaje").forEach(el=>el.classList.toggle("hide", m!=="fichaje"));
  $$(".mod-produccion").forEach(el=>el.classList.toggle("hide", m!=="produccion"));
  $$(".admin-only").forEach(el=>{ if(ME.rol!=="admin") el.classList.add("hide"); });
  if(LC.produccion && LC.produccion.alSalir) LC.produccion.alSalir();
  if(!VISTAS_MOD[m].includes(vista)) go(m==="fichaje" ? "fichaje" : "tabla");
  else render();
}
$$(".modswitch button").forEach(b=>b.addEventListener("click", ()=>irModulo(b.dataset.mod)));

(function armaAside(){
  const MIN = 210, MAX = 460, KEY = "lc_aside_w";
  const app = $("#app"), h = $("#asideResize");
  if(!app || !h) return;
  const aplica = w => {
    const n = Math.max(MIN, Math.min(MAX, Math.round(w)));
    app.style.setProperty("--aside-w", n+"px");
    return n;
  };
  try { aplica(Number(localStorage.getItem(KEY)) || 260); } catch(_){ aplica(260); }
  let drag = null;
  h.addEventListener("pointerdown", ev=>{
    if(ev.button!==0) return;
    ev.preventDefault();
    const cur = parseFloat(getComputedStyle(app).getPropertyValue("--aside-w")) || 260;
    drag = {x0:ev.clientX, w0:cur};
    h.classList.add("activo");
    h.setPointerCapture(ev.pointerId);
  });
  h.addEventListener("pointermove", ev=>{
    if(!drag) return;
    aplica(drag.w0 + (ev.clientX - drag.x0));
  });
  const suelta = ()=>{
    if(!drag) return;
    drag = null;
    h.classList.remove("activo");
    const cur = parseFloat(getComputedStyle(app).getPropertyValue("--aside-w")) || 260;
    try { localStorage.setItem(KEY, String(Math.round(cur))); } catch(_){}
  };
  h.addEventListener("pointerup", suelta);
  h.addEventListener("pointercancel", suelta);
})();

addEventListener("resize", ()=>{ clearTimeout(window._rz); window._rz = setTimeout(render, 150); });
if(typeof paintTimer==="function") paintTimer();
