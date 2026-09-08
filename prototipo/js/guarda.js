/* guarda.js
   Copia de todo el estudio en IndexedDB: fichaje, producción, carpetas y archivos.
   localStorage no aguanta PDFs ni capturas; aquí sí. */
(function(){
  const DB_NOM = 'lacorte';
  const DB_VER = 1;
  let yaListo = false;
  let tGuardar = null;
  let avisado = false;

  function abrirDb(){
    return new Promise((res, rej)=>{
      const q = indexedDB.open(DB_NOM, DB_VER);
      q.onupgradeneeded = ()=>{
        const db = q.result;
        if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if(!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos');
      };
      q.onsuccess = ()=>res(q.result);
      q.onerror = ()=>rej(q.error);
    });
  }
  function txGet(store, key){
    return abrirDb().then(db=>new Promise((res, rej)=>{
      const r = db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    }));
  }
  function txPut(store, key, val){
    return abrirDb().then(db=>new Promise((res, rej)=>{
      const r = db.transaction(store, 'readwrite').objectStore(store).put(val, key);
      r.onsuccess = ()=>res();
      r.onerror = ()=>rej(r.error);
    }));
  }
  function txClear(store){
    return abrirDb().then(db=>new Promise((res, rej)=>{
      const r = db.transaction(store, 'readwrite').objectStore(store).clear();
      r.onsuccess = ()=>res();
      r.onerror = ()=>rej(r.error);
    }));
  }
  function dataABlob(dataUrl){
    if(typeof dataUrl!=='string' || !dataUrl.startsWith('data:')) return null;
    const i = dataUrl.indexOf(',');
    if(i<0) return null;
    const meta = dataUrl.slice(0, i), b64 = dataUrl.slice(i+1).replace(/\s/g,'');
    const mime = (meta.match(/data:([^;,]+)/)||[, 'application/octet-stream'])[1];
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for(let k=0;k<bin.length;k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], {type:mime});
  }
  function blobAData(blob){
    return new Promise((res, rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function metaArchivo(a){
    const o = {};
    Object.keys(a||{}).forEach(k=>{ if(k!=='data') o[k] = a[k]; });
    return o;
  }

  async function guardarTodo(){
    if(typeof PROYECTOS==='undefined') return;
    const archivos = {};
    const proyectos = PROYECTOS.map(p=>{
      const pines = (p.pines||[]).map(pin=>{
        if(pin.data){
          const blob = pin.data instanceof Blob ? pin.data : dataABlob(pin.data);
          if(blob) archivos['p-'+p.id+'-'+pin.id] = blob;
        }
        return metaArchivo(pin);
      });
      return Object.assign({}, p, {pines, equipo:(p.equipo||[]).slice()});
    });
    const tareas = TAREAS.map(t=>{
      const adjuntos = (t.adjuntos||[]).map(a=>{
        if(a.data){
          const blob = a.data instanceof Blob ? a.data : dataABlob(a.data);
          if(blob) archivos['t-'+t.id+'-'+a.id] = blob;
        }
        return metaArchivo(a);
      });
      return {
        id:t.id, proyId:t.proyId, bloqueId:t.bloqueId, titulo:t.titulo, desc:t.desc||'',
        asignado:t.asignado==null?null:+t.asignado, estado:t.estado, prioridad:t.prioridad,
        fin:t.fin||'', creador:t.creador, creado:t.creado,
        subtareas:t.subtareas||[], comentarios:t.comentarios||[], campos:t.campos||{},
        adjuntos
      };
    });
    const estado = {
      ts: Date.now(),
      usuarios: typeof USERS!=='undefined' ? USERS : [],
      nextUserId: typeof nextUserId!=='undefined' ? nextUserId : 1,
      proyectos,
      bloques: typeof BLOQUES!=='undefined' ? BLOQUES.map(b=>Object.assign({}, b)) : [],
      nextBloque: typeof nextBloque!=='undefined' ? nextBloque : 1,
      tareas,
      nextTarea: typeof nextTarea!=='undefined' ? nextTarea : 1,
      nextAdj: typeof nextAdj!=='undefined' ? nextAdj : 1,
      nextPin: typeof nextPin!=='undefined' ? nextPin : 1,
      entradas: typeof ENTRADAS!=='undefined' ? ENTRADAS.map(e=>Object.assign({}, e)) : [],
      nextId: typeof nextId!=='undefined' ? nextId : 1,
      flujos: typeof FLUJOS!=='undefined' ? FLUJOS : [],
      nextFlujo: typeof nextFlujo!=='undefined' ? nextFlujo : 1,
      nextEstId: typeof nextEstId!=='undefined' ? nextEstId : 1,
      cols: typeof COLS!=='undefined' ? COLS : [],
      notifs: typeof NOTIFS!=='undefined' ? NOTIFS : [],
      nextNotif: typeof nextNotif!=='undefined' ? nextNotif : 1,
      acti: typeof ACTI!=='undefined' ? ACTI : [],
      solicitudes: typeof SOLICITUDES!=='undefined' ? SOLICITUDES : [],
      nextSol: typeof nextSol!=='undefined' ? nextSol : 1,
      log: typeof LOG!=='undefined' ? LOG.slice(0, 80) : [],
      timer: typeof timer!=='undefined' && timer ? {ini:timer.ini, proyId:timer.proyId, cat:timer.cat, desc:timer.desc} : null,
      clavesArchivos: Object.keys(archivos)
    };
    await txPut('kv', 'estado', estado);
    await txClear('archivos');
    for(const k of Object.keys(archivos)) await txPut('archivos', k, archivos[k]);
  }

  async function cargarTodo(){
    const estado = await txGet('kv', 'estado');
    if(!estado) return false;
    if(estado.usuarios && estado.usuarios.length && typeof USERS!=='undefined'){
      USERS.length = 0; estado.usuarios.forEach(u=>USERS.push(u));
      if(estado.nextUserId) nextUserId = estado.nextUserId;
    }
    if(estado.proyectos && estado.proyectos.length && typeof PROYECTOS!=='undefined'){
      PROYECTOS.length = 0; estado.proyectos.forEach(p=>PROYECTOS.push(p));
    }
    if(estado.bloques && typeof BLOQUES!=='undefined'){
      BLOQUES.length = 0; estado.bloques.forEach(b=>BLOQUES.push(b));
      if(estado.nextBloque) nextBloque = estado.nextBloque;
    }
    if(estado.tareas && typeof TAREAS!=='undefined'){
      TAREAS.length = 0;
      estado.tareas.forEach(t=>TAREAS.push(Object.assign({adjuntos:[]}, t)));
      if(estado.nextTarea) nextTarea = estado.nextTarea;
    }
    if(estado.nextAdj) nextAdj = estado.nextAdj;
    if(estado.nextPin) nextPin = estado.nextPin;
    if(estado.entradas && typeof ENTRADAS!=='undefined'){
      ENTRADAS.length = 0;
      estado.entradas.forEach(e=>ENTRADAS.push(e));
      if(estado.nextId) nextId = estado.nextId;
    }
    if(estado.flujos && estado.flujos.length && typeof FLUJOS!=='undefined'){
      FLUJOS = estado.flujos;
      if(estado.nextFlujo) nextFlujo = estado.nextFlujo;
      if(estado.nextEstId) nextEstId = estado.nextEstId;
    }
    if(estado.cols && estado.cols.length && typeof COLS!=='undefined') COLS = estado.cols;
    if(estado.notifs && typeof NOTIFS!=='undefined'){
      NOTIFS.length = 0; estado.notifs.forEach(n=>NOTIFS.push(n));
      if(estado.nextNotif) nextNotif = estado.nextNotif;
    }
    if(estado.acti && typeof ACTI!=='undefined'){
      ACTI.length = 0; estado.acti.forEach(a=>ACTI.push(a));
    }
    if(estado.solicitudes && typeof SOLICITUDES!=='undefined'){
      SOLICITUDES.length = 0; estado.solicitudes.forEach(s=>SOLICITUDES.push(s));
      if(estado.nextSol) nextSol = estado.nextSol;
    }
    if(estado.log && typeof LOG!=='undefined'){
      LOG.length = 0; estado.log.forEach(l=>LOG.push(l));
    }
    if(estado.timer && typeof timer!=='undefined') timer = estado.timer;

    const claves = estado.clavesArchivos || [];
    for(const k of claves){
      const blob = await txGet('archivos', k);
      if(!blob) continue;
      const data = await blobAData(blob);
      const parts = k.split('-');
      if(parts[0]==='t'){
        const t = TAREAS.find(x=>x.id===+parts[1]);
        const a = t && (t.adjuntos||[]).find(x=>x.id===+parts[2]);
        if(a) a.data = data;
      } else if(parts[0]==='p'){
        const p = PROYECTOS.find(x=>x.id===+parts[1]);
        const pin = p && (p.pines||[]).find(x=>x.id===+parts[2]);
        if(pin) pin.data = data;
      }
    }
    return true;
  }

  function guardarPronto(){
    if(!yaListo) return;
    clearTimeout(tGuardar);
    tGuardar = setTimeout(()=>{
      guardarTodo().catch(()=>{
        if(!avisado && typeof toast==='function'){
          avisado = true;
          toast('No cabe más material aquí. Prueba archivos más pequeños.');
        }
      });
    }, 400);
  }

  const listo = cargarTodo().then(()=>{ yaListo = true; }).catch(()=>{ yaListo = true; });

  window.LC = window.LC || {};
  LC.guarda = { listo, guardarPronto, guardarTodo };
})();
