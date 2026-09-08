/* nucleo.js
   Lo común: gente, proyectos, sesión, utilidades, login.
   Ni Fichaje ni Producción viven aquí. */
window.LC = window.LC || {};

/* ================= CRIPTOGRAFÍA (SHA-1, SHA-256, HMAC, TOTP) =================
   Todo en JavaScript puro, sin librerías ni crypto.subtle, para que funcione
   igual abriendo el archivo en local que servido por http desde el NAS.      */
const U8 = n => new Uint8Array(n);
const txt2b = s => { const o=[]; for(const c of unescape(encodeURIComponent(s))) o.push(c.charCodeAt(0)); return U8.call(null,0), Uint8Array.from(o); };
const hex = b => [...b].map(x=>x.toString(16).padStart(2,'0')).join('');
const hex2b = h => Uint8Array.from(h.match(/../g).map(x=>parseInt(x,16)));

/* ---- SHA-256 ---- */
const K256 = [
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256(msg){
  const rr=(x,n)=>(x>>>n)|(x<<(32-n));
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const ml=msg.length, bits=ml*8;
  const total=((ml+9+63)>>6)<<6, m=U8(total);
  m.set(msg); m[ml]=0x80;
  new DataView(m.buffer).setUint32(total-4, bits>>>0);
  new DataView(m.buffer).setUint32(total-8, Math.floor(bits/4294967296));
  const w=new Uint32Array(64), dv=new DataView(m.buffer);
  for(let i=0;i<total;i+=64){
    for(let t=0;t<16;t++) w[t]=dv.getUint32(i+t*4);
    for(let t=16;t<64;t++){
      const s0=rr(w[t-15],7)^rr(w[t-15],18)^(w[t-15]>>>3);
      const s1=rr(w[t-2],17)^rr(w[t-2],19)^(w[t-2]>>>10);
      w[t]=(w[t-16]+s0+w[t-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,hh]=h;
    for(let t=0;t<64;t++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25), ch=(e&f)^(~e&g);
      const t1=(hh+S1+ch+K256[t]+w[t])>>>0;
      const S0=rr(a,2)^rr(a,13)^rr(a,22), mj=(a&b)^(a&c)^(b&c);
      const t2=(S0+mj)>>>0;
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h=[(h[0]+a)>>>0,(h[1]+b)>>>0,(h[2]+c)>>>0,(h[3]+d)>>>0,
       (h[4]+e)>>>0,(h[5]+f)>>>0,(h[6]+g)>>>0,(h[7]+hh)>>>0];
  }
  const out=U8(32), o=new DataView(out.buffer);
  h.forEach((v,i)=>o.setUint32(i*4,v));
  return out;
}
/* ---- SHA-1 (solo lo pide el estándar TOTP) ---- */
function sha1(msg){
  const rl=(x,n)=>(x<<n)|(x>>>(32-n));
  let h=[0x67452301,0xEFCDAB89,0x98BADCFE,0x10325476,0xC3D2E1F0];
  const ml=msg.length, bits=ml*8, total=((ml+9+63)>>6)<<6, m=U8(total);
  m.set(msg); m[ml]=0x80;
  const dv=new DataView(m.buffer);
  dv.setUint32(total-4, bits>>>0);
  dv.setUint32(total-8, Math.floor(bits/4294967296));
  const w=new Uint32Array(80);
  for(let i=0;i<total;i+=64){
    for(let t=0;t<16;t++) w[t]=dv.getUint32(i+t*4);
    for(let t=16;t<80;t++) w[t]=rl(w[t-3]^w[t-8]^w[t-14]^w[t-16],1);
    let [a,b,c,d,e]=h;
    for(let t=0;t<80;t++){
      let f,k;
      if(t<20){ f=(b&c)|(~b&d); k=0x5A827999; }
      else if(t<40){ f=b^c^d; k=0x6ED9EBA1; }
      else if(t<60){ f=(b&c)|(b&d)|(c&d); k=0x8F1BBCDC; }
      else { f=b^c^d; k=0xCA62C1D6; }
      const tmp=(rl(a,5)+f+e+k+w[t])>>>0;
      e=d; d=c; c=rl(b,30)>>>0; b=a; a=tmp;
    }
    h=[(h[0]+a)>>>0,(h[1]+b)>>>0,(h[2]+c)>>>0,(h[3]+d)>>>0,(h[4]+e)>>>0];
  }
  const out=U8(20), o=new DataView(out.buffer);
  h.forEach((v,i)=>o.setUint32(i*4,v));
  return out;
}
function hmac(hash, blockLen, key, msg){
  let k = key.length > blockLen ? hash(key) : key;
  const ki=U8(blockLen), ko=U8(blockLen);
  ki.set(k); ko.set(k);
  for(let i=0;i<blockLen;i++){ ki[i]^=0x36; ko[i]^=0x5c; }
  const inner=hash(Uint8Array.from([...ki, ...msg]));
  return hash(Uint8Array.from([...ko, ...inner]));
}
const hmacSha1 = (k,m) => hmac(sha1, 64, k, m);

/* ---- Contraseñas: sal aleatoria + SHA-256 iterado -----------------------
   Es el equivalente demostrable en navegador de lo que en el servidor real
   hará bcrypt. Lo que se guarda es el hash; la contraseña no se guarda nunca. */
const ITER = 15000;
const azar = n => { const b=U8(n); (globalThis.crypto||require('crypto').webcrypto).getRandomValues(b); return b; };
function hashPass(pass, saltHex, iter=ITER){
  let acc = Uint8Array.from([...hex2b(saltHex), ...txt2b(pass)]);
  for(let i=0;i<iter;i++) acc = sha256(acc);
  return hex(acc);
}
const nuevaSal = () => hex(azar(16));
const verificaPass = (pass, u) => !!u.hash && hashPass(pass, u.salt, u.iter) === u.hash;

/* ---- Base32 y TOTP (RFC 6238), compatible con Google Authenticator ---- */
const B32A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(bytes){
  let bits=0, val=0, out='';
  for(const b of bytes){ val=(val<<8)|b; bits+=8;
    while(bits>=5){ out+=B32A[(val>>>(bits-5))&31]; bits-=5; } }
  if(bits>0) out += B32A[(val<<(5-bits))&31];
  return out;
}
function b32dec(s){
  s = s.replace(/=+$/,'').replace(/\s/g,'').toUpperCase();
  let bits=0, val=0; const out=[];
  for(const c of s){ const i=B32A.indexOf(c); if(i<0) continue;
    val=(val<<5)|i; bits+=5;
    if(bits>=8){ out.push((val>>>(bits-8))&255); bits-=8; } }
  return Uint8Array.from(out);
}
const nuevoSecreto = () => b32enc(azar(20));            /* 160 bits, lo estándar */
function totp(secretB32, tiempo=Date.now(), paso=30, digitos=6){
  const contador = Math.floor(tiempo/1000/paso);
  const buf = U8(8), dv = new DataView(buf.buffer);
  dv.setUint32(0, Math.floor(contador/4294967296));
  dv.setUint32(4, contador>>>0);
  const h = hmacSha1(b32dec(secretB32), buf);
  const off = h[19] & 0x0f;
  const cod = ((h[off]&0x7f)<<24 | h[off+1]<<16 | h[off+2]<<8 | h[off+3]) % (10**digitos);
  return String(cod).padStart(digitos,'0');
}
/* se aceptan el código anterior y el siguiente: los relojes nunca van finos */
const totpOk = (secreto, codigo, ventana=1) => {
  const c = String(codigo).replace(/\s/g,'');
  for(let d=-ventana; d<=ventana; d++)
    if(totp(secreto, Date.now()+d*30000) === c) return true;
  return false;
};
const segundosRestantes = () => 30 - Math.floor(Date.now()/1000)%30;

/* ================= CÓDIGO QR (versiones 1-10, corrección M) =================
   Escrito a mano para no depender de ninguna librería externa: la app tiene que
   funcionar en un NAS sin salida a internet.                                  */
const QR_ALIGN = [[],[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
/* por versión: [nº total de codewords, codewords de corrección por bloque, bloques grupo1, datos grupo1, bloques grupo2, datos grupo2] */
const QR_M = {
  1:[26,10,1,16,0,0],   2:[44,16,1,28,0,0],   3:[70,26,1,44,0,0],   4:[100,18,2,32,0,0],
  5:[134,24,2,43,0,0],  6:[172,16,4,27,0,0],  7:[196,18,4,31,0,0],  8:[242,22,2,38,2,39],
  9:[292,22,3,36,2,37], 10:[346,26,4,43,1,44]};

/* --- aritmética en GF(256) para Reed-Solomon --- */
const GF_E = new Uint8Array(512), GF_L = new Uint8Array(256);
(function(){ let x=1;
  for(let i=0;i<255;i++){ GF_E[i]=x; GF_L[x]=i; x=(x<<1)^((x&0x80)?0x11d:0); }
  for(let i=255;i<512;i++) GF_E[i]=GF_E[i-255];
})();
const gfMul = (a,b) => (a===0||b===0) ? 0 : GF_E[GF_L[a]+GF_L[b]];
function rsGen(grado){
  let g=[1];
  for(let i=0;i<grado;i++){
    const n=new Array(g.length+1).fill(0);
    for(let j=0;j<g.length;j++){ n[j]^=g[j]; n[j+1]^=gfMul(g[j], GF_E[i]); }
    g=n;
  }
  return g;
}
function rsEC(datos, ecLen){
  const g=rsGen(ecLen), res=new Array(ecLen).fill(0);
  for(const d of datos){
    const factor = d ^ res[0];
    res.shift(); res.push(0);
    if(factor) for(let i=0;i<ecLen;i++) res[i]^=gfMul(g[i+1], factor);
  }
  return res;
}
/* --- matriz --- */
function qrMatrix(texto, mascaraFijada){
  const bytes=[]; for(const ch of unescape(encodeURIComponent(texto))) bytes.push(ch.charCodeAt(0));
  let ver=0;
  for(let v=1;v<=10;v++){
    const [tot,ec,b1,d1,b2,d2]=QR_M[v];
    const datosCw = b1*d1 + b2*d2;
    const cabecera = 4 + (v<10?8:16);
    if(datosCw*8 >= cabecera + bytes.length*8){ ver=v; break; }
  }
  if(!ver) throw new Error('texto demasiado largo para un QR de versión 10');
  const [totalCw, ecLen, b1, d1, b2, d2] = QR_M[ver];
  const datosCw = b1*d1 + b2*d2, size = 17 + 4*ver;

  /* bits: modo byte (0100) + longitud + datos + relleno */
  const bits=[];
  const push=(v,n)=>{ for(let i=n-1;i>=0;i--) bits.push((v>>>i)&1); };
  push(0b0100, 4);
  push(bytes.length, ver<10?8:16);
  bytes.forEach(b=>push(b,8));
  for(let i=0;i<4 && bits.length<datosCw*8;i++) bits.push(0);
  while(bits.length%8) bits.push(0);
  const cw=[]; for(let i=0;i<bits.length;i+=8) cw.push(parseInt(bits.slice(i,i+8).join(''),2));
  const relleno=[0xEC,0x11]; let r=0;
  while(cw.length<datosCw) cw.push(relleno[r++%2]);

  /* bloques + intercalado */
  const bloques=[], ecs=[]; let p=0;
  for(let i=0;i<b1;i++){ const d=cw.slice(p,p+d1); p+=d1; bloques.push(d); ecs.push(rsEC(d,ecLen)); }
  for(let i=0;i<b2;i++){ const d=cw.slice(p,p+d2); p+=d2; bloques.push(d); ecs.push(rsEC(d,ecLen)); }
  const final=[];
  for(let i=0;i<Math.max(d1,d2);i++) bloques.forEach(b=>{ if(i<b.length) final.push(b[i]); });
  for(let i=0;i<ecLen;i++) ecs.forEach(e=>final.push(e[i]));

  /* patrones fijos */
  const mod = Array.from({length:size},()=>new Array(size).fill(false));
  const fun = Array.from({length:size},()=>new Array(size).fill(false));
  const setF=(x,y,v)=>{ if(x<0||y<0||x>=size||y>=size) return; mod[y][x]=v; fun[y][x]=true; };
  const finder=(cx,cy)=>{
    for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){
      const d=Math.max(Math.abs(dx),Math.abs(dy));
      setF(cx+dx, cy+dy, d!==2 && d!==4);
    }
  };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  for(let i=8;i<size-8;i++){ setF(i,6,i%2===0); setF(6,i,i%2===0); }
  const al=QR_ALIGN[ver];
  for(const ax of al) for(const ay of al){
    if((ax===6&&ay===6)||(ax===6&&ay===size-7)||(ax===size-7&&ay===6)) continue;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++)
      setF(ax+dx, ay+dy, Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }
  /* reservas de formato y versión */
  /* la fila y la columna 6 son sincronismo: el formato las salta */
  for(let i=0;i<9;i++){ if(i!==6){ setF(8,i,false); setF(i,8,false); } }
  for(let i=0;i<8;i++){ setF(size-1-i,8,false); setF(8,size-1-i,false); }
  setF(8, size-8, true);
  if(ver>=7){
    let rem=ver; for(let i=0;i<12;i++) rem=(rem<<1)^((rem>>>11)*0x1F25);
    const vb=(ver<<12)|rem;
    for(let i=0;i<18;i++){ const bit=((vb>>>i)&1)===1, a=size-11+i%3, b=Math.floor(i/3);
      setF(a,b,bit); setF(b,a,bit); }
  }
  /* datos en zigzag */
  let idx=0;
  for(let right=size-1; right>=1; right-=2){
    if(right===6) right=5;
    for(let vert=0; vert<size; vert++){
      for(let j=0;j<2;j++){
        const x=right-j, arriba=((right+1)&2)===0, y=arriba?size-1-vert:vert;
        if(!fun[y][x] && idx<final.length*8){
          mod[y][x] = ((final[idx>>>3] >>> (7-(idx&7))) & 1) === 1;
          idx++;
        }
      }
    }
  }
  /* máscaras */
  const MASCARAS=[(x,y)=>(x+y)%2, (x,y)=>y%2, (x,y)=>x%3, (x,y)=>(x+y)%3,
    (x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2, (x,y)=>(x*y)%2+(x*y)%3,
    (x,y)=>((x*y)%2+(x*y)%3)%2, (x,y)=>((x+y)%2+(x*y)%3)%2];
  const aplica=(m,f)=>{ for(let y=0;y<size;y++) for(let x=0;x<size;x++)
    if(!fun[y][x] && f(x,y)===0) m[y][x]=!m[y][x]; };
  const formato=(m,mask)=>{
    let data=(0b00<<3)|mask, rem=data;                    /* 00 = nivel M */
    for(let i=0;i<10;i++) rem=(rem<<1)^((rem>>>9)*0x537);
    const bits=(((data<<10)|rem)^0x5412);
    const g=i=>((bits>>>i)&1)===1;
    for(let i=0;i<6;i++) m[i][8]=g(i);
    m[7][8]=g(6); m[8][8]=g(7); m[8][7]=g(8);
    for(let i=9;i<15;i++) m[8][14-i]=g(i);
    for(let i=0;i<8;i++) m[8][size-1-i]=g(i);
    for(let i=8;i<15;i++) m[size-15+i][8]=g(i);
    m[size-8][8]=true;
  };
  const penaliza=m=>{
    let p=0;
    for(let y=0;y<size;y++){
      let run=1;
      for(let x=1;x<size;x++){
        if(m[y][x]===m[y][x-1]) run++;
        else { if(run>=5) p+=3+(run-5); run=1; }
      }
      if(run>=5) p+=3+(run-5);
    }
    for(let x=0;x<size;x++){
      let run=1;
      for(let y=1;y<size;y++){
        if(m[y][x]===m[y-1][x]) run++;
        else { if(run>=5) p+=3+(run-5); run=1; }
      }
      if(run>=5) p+=3+(run-5);
    }
    for(let y=0;y<size-1;y++) for(let x=0;x<size-1;x++)
      if(m[y][x]===m[y][x+1] && m[y][x]===m[y+1][x] && m[y][x]===m[y+1][x+1]) p+=3;
    const A=[1,0,1,1,1,0,1,0,0,0,0], B=[0,0,0,0,1,0,1,1,1,0,1];
    const cmp=(arr,pat)=>pat.every((v,i)=>arr[i]===!!v);
    for(let y=0;y<size;y++) for(let x=0;x<=size-11;x++){
      const fila=m[y].slice(x,x+11);
      if(cmp(fila,A)||cmp(fila,B)) p+=40;
    }
    for(let x=0;x<size;x++) for(let y=0;y<=size-11;y++){
      const col=[]; for(let k=0;k<11;k++) col.push(m[y+k][x]);
      if(cmp(col,A)||cmp(col,B)) p+=40;
    }
    let oscuros=0;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(m[y][x]) oscuros++;
    p += Math.floor(Math.abs(oscuros*100/(size*size)-50)/5)*10;
    return p;
  };
  let mejor=null, mejorP=Infinity, mejorK=-1;
  for(let k=0;k<8;k++){
    if(mascaraFijada!=null && k!==mascaraFijada) continue;
    const m=mod.map(f=>f.slice());
    aplica(m, MASCARAS[k]); formato(m, k);
    const p=penaliza(m);
    if(p<mejorP){ mejorP=p; mejor=m; mejorK=k; }
  }
  mejor.mascara = mejorK;
  return mejor;
}
/* --- pintado como SVG, con el margen de 4 módulos que exige la norma --- */
function qrSVG(texto, px=178){
  const m=qrMatrix(texto), n=m.length, q=4, t=n+q*2;
  let d='';
  for(let y=0;y<n;y++) for(let x=0;x<n;x++)
    if(m[y][x]) d += `M${x+q},${y+q}h1v1h-1z`;
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="Código QR de configuración">
    <rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ================= DATOS DE EJEMPLO (en memoria) ================= */
const CATS = [
  {id:'gestion', nom:'Gestión',               color:'var(--s1)'},
  {id:'asis',    nom:'Asistencia de montaje', color:'var(--s2)'},
  {id:'montaje', nom:'Montaje',               color:'var(--s3)'}
];
const catById = id => CATS.find(c=>c.id===id) || CATS[0];

let USERS = [
  {id:1, user:'alvaro', nom:'Álvaro Fernández', rol:'admin', ini:'AF', alta:'2025-01-13', activo:true,
   salt:'a4286a36443bc8dd5153c92022e76c09', hash:'7e1dbfec8bf85cb9d84870c097fa0192c6c580dcca8280fa69c8d8cb4d91f77a', iter:12000,
   mfa:{secreto:null, activo:false, recup:[]}, reset:null},
  {id:2, user:'jesus', nom:'Jesús', rol:'admin', ini:'JS', alta:'2026-09-08', activo:true,
   salt:'a4286a36443bc8dd5153c92022e76c09', hash:'7e1dbfec8bf85cb9d84870c097fa0192c6c580dcca8280fa69c8d8cb4d91f77a', iter:12000,
   mfa:{secreto:null, activo:false, recup:[]}, reset:null}
];
let nextUserId = 3;
const userById = id => USERS.find(u=>u.id===id);

/* tarifa interna por función, en €/hora — sirve para valorar el coste del proyecto */
const TARIFA = {gestion:45, asis:28, montaje:42};

/* formato, minutos de programa entregados, versiones enviadas al cliente,
   horas presupuestadas y fecha de entrega: lo que hace evaluable un proyecto audiovisual */
const PROYECTOS = [
  {id:1, nom:'Interno', cliente:'La Corte', formato:'Interno', estado:'curso',
   presu:0, inicio:'', entrega:'', minPrograma:0, versiones:0, equipo:[1,2], dueno:1, flujoId:1, pines:[]}
];
const ESTADOS = {curso:'En curso', entregado:'Entregado', pausa:'En pausa'};
const proyById = id => PROYECTOS.find(p=>p.id===id) || PROYECTOS[0];
const duenoDe = p => p.dueno || 1;
const esMio = p => ME && duenoDe(p)===ME.id;
const estaEnEquipo = p => ME && (p.equipo||[]).includes(ME.id);
const proyectosMios = () => PROYECTOS.filter(esMio);
const proyectosCompartidos = () => PROYECTOS.filter(p => !esMio(p) && estaEnEquipo(p));
const SLOTS = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)','var(--s7)','var(--s8)'];
const PALETA_PROY = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#6b3fa0','#2ec4d6','#c47a3a','#8B1E1E','#8a8a85'];
const colorProyecto = id => {
  const p = PROYECTOS.find(x=>x.id===id);
  if(p && p.color) return p.color;
  return SLOTS[Math.max(0, PROYECTOS.findIndex(x=>x.id===id)) % SLOTS.length];
};

const DAY = 86400000;
const startOfDay = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
const HOY = startOfDay(new Date());
const lunesDe = d => { const x = startOfDay(d); return new Date(x.getTime() - ((x.getDay()+6)%7)*DAY); };

/* ================= UTILIDADES ================= */
const hhmm = s => Math.floor(s/3600)+':'+String(Math.floor(s%3600/60)).padStart(2,'0');
const hhmmss = s => [Math.floor(s/3600),Math.floor(s%3600/60),Math.floor(s%60)].map(n=>String(n).padStart(2,'0')).join(':');
const dur = e => (e.fin-e.ini)/1000;
const capi = s => s.replace(/^./, c=>c.toUpperCase());
const fFecha = ts => capi(new Date(ts).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}));
const fCorta = ts => new Date(ts).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
const fHora  = ts => new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
const fSel   = ts => new Date(ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'});
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sumar = l => l.reduce((a,e)=>a+dur(e),0);
const logea = (accion, quien) => LOG.unshift({ts:Date.now(), quien: quien || (ME?ME.nom:'Sistema'), accion});

let ME = null, vista = 'fichaje', timer = null, rango = 14;
let calMode = 'week', calAnchor = lunesDe(new Date()), HOUR = 52;

const TITULOS = {
  fichaje:['Fichaje',''],
  calendario:['Calendario',''],
  informes:['Informes',''],
  proyectos:['Proyectos',''],
  gestion:['Gestión',''],
  equipo:['Equipo',''],
  usuarios:['Usuarios',''],
  tabla:['Tabla',''],
  tablero:['Tablero',''],
  mistareas:['Mis tareas',''],
  flujos:['Estados',''],
  ayuda:['Ayuda','']
};

/* ================= AUTENTICACIÓN ================= */
const APP_NOMBRE = 'La Corte Fichaje';
let AJUSTES = {mfaObligatorio:false};     /* el admin puede exigirlo a todo el equipo */

let pendiente = null;      /* usuario que ya pasó la contraseña y espera el segundo factor */
let vistaAuth = 'login';
const PANELES = {login:'#loginForm', mfa:'#mfaForm', enroll:'#enrollForm',
                 recup:'#recupPane', forgot:'#forgotForm', reset:'#resetForm'};
function irAuth(v){
  vistaAuth = v;
  Object.entries(PANELES).forEach(([k,sel])=>$(sel).classList.toggle('hide', k!==v));
  $$('#login .msg').forEach(m=>m.classList.add('hide'));
  clearInterval(demoT); demoT = null;
  if(v==='mfa' || v==='enroll') arrancaDemo(v);
  const foco = {login:'#u', mfa:'#mfaCode', enroll:'#enCode', reset:'#rsUser'}[v];
  if(foco) setTimeout(()=>$(foco).focus(), 40);
}
const errAuth = (sel, m) => { const e=$(sel); e.textContent=m; e.classList.remove('hide'); };

/* ---- ayuda solo del prototipo: enseña el código válido ahora mismo ---- */
let demoT = null;
function arrancaDemo(v){
  const cajaSel = v==='mfa' ? '#mfaDemo' : '#enDemo';
  const secreto = () => v==='mfa' ? (pendiente && pendiente.mfa.secreto) : enrollSecreto;
  const pinta = () => {
    const s = secreto(); if(!s) return;
    $(cajaSel).innerHTML = `<strong>Solo en el prototipo:</strong> como no tienes la app instalada,
      aquí tienes el código válido ahora mismo — <b>${totp(s)}</b>
      <span class="cd">(cambia en ${segundosRestantes()} s)</span>.
      En la app real este recuadro no existe: el código solo está en tu móvil.`;
  };
  pinta(); demoT = setInterval(pinta, 1000);
}

/* ---- entrada de credenciales ---- */
function intentaLogin(u, pass){
  if(!u || !u.activo){ errAuth('#loginErr','Usuario o contraseña incorrectos.'); return; }
  if(!verificaPass(pass, u)){ errAuth('#loginErr','Usuario o contraseña incorrectos.'); return; }
  pendiente = u;
  if(u.mfa.activo) return irAuth('mfa');
  if(AJUSTES.mfaObligatorio || u.rol==='admin' && AJUSTES.mfaObligatorio) return empiezaEnroll();
  entra(u);
}
$('#loginForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const nom = $('#u').value.trim().toLowerCase(), pass = $('#p').value.trim();
  intentaLogin(USERS.find(x=>x.user===nom), pass);
});
$$('[data-quick]').forEach(b=>b.addEventListener('click', ()=>{
  const u = USERS.find(x=>x.user===b.dataset.quick);
  if(!u) return;
  $('#u').value = u.user;
  $('#p').value = '';
  $('#p').focus();
}));

/* ---- segundo factor ---- */
$('#mfaForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const cod = $('#mfaCode').value.trim().replace(/[\s-]/g,'');
  if(totpOk(pendiente.mfa.secreto, cod)){ entra(pendiente); return; }
  const i = pendiente.mfa.recup.findIndex(r=>!r.usado && r.hash===hashPass(normCod(cod), r.salt, 3000));
  if(i>=0){
    const quien = pendiente;                 /* entra() vacía «pendiente» */
    quien.mfa.recup[i].usado = true;
    logea('Acceso con código de recuperación', quien.nom);
    entra(quien);
    const restantes = quien.mfa.recup.filter(r=>!r.usado).length;
    setTimeout(()=>toast(restantes
      ? `Has gastado un código de recuperación. Te quedan ${restantes}.`
      : 'Era tu último código de recuperación. Vuelve a configurar el doble factor.'), 600);
    return;
  }
  errAuth('#mfaErr','Ese código no es válido. Comprueba que el reloj del móvil está en hora.');
  $('#mfaCode').select();
});
$('#mfaCancel').addEventListener('click', ()=>{ pendiente=null; $('#p').value=''; irAuth('login'); });
$('#usarRecup').addEventListener('click', ()=>{
  $('#mfaCode').placeholder = 'XXXX-XXXX'; $('#mfaCode').classList.remove('code6');
  $('#mfaWho').textContent = 'Escribe uno de los códigos de recuperación que guardaste al activar el doble factor.';
  $('#mfaCode').focus();
});

/* ---- alta del segundo factor ---- */
let enrollSecreto = null, enrollUser = null, enrollDesdeApp = false;
const volverAlaApp = () => {
  enrollDesdeApp = false;
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  clearInterval(demoT); demoT = null;
  render();
};
function empiezaEnroll(u){
  enrollUser = u || pendiente;
  enrollSecreto = nuevoSecreto();
  const etiqueta = encodeURIComponent(APP_NOMBRE)+':'+encodeURIComponent(enrollUser.user);
  const uri = `otpauth://totp/${etiqueta}?secret=${enrollSecreto}`
    + `&issuer=${encodeURIComponent(APP_NOMBRE)}&algorithm=SHA1&digits=6&period=30`;
  $('#enQR').innerHTML = qrSVG(uri, 186);
  $('#enSecret').textContent = enrollSecreto.replace(/(.{4})/g,'$1 ').trim();
  $('#enCode').value = '';
  irAuth('enroll');
}
$('#enrollForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const cod = $('#enCode').value.trim().replace(/[\s-]/g,'');
  if(!totpOk(enrollSecreto, cod)){
    errAuth('#enErr','Ese código no coincide. Espera a que la app genere el siguiente y prueba otra vez.');
    $('#enCode').select(); return;
  }
  enrollUser.mfa.secreto = enrollSecreto;
  enrollUser.mfa.activo = true;
  const codigos = Array.from({length:8}, ()=>nuevoCodigoRecup());
  enrollUser.mfa.recup = codigos.map(c=>{ const s=nuevaSal();
    return {salt:s, hash:hashPass(normCod(c),s,3000), usado:false}; });
  logea('Doble factor activado', enrollUser.nom);
  $('#recupList').innerHTML = codigos.map(c=>`<span>${c}</span>`).join('');
  irAuth('recup');
});
$('#enCancel').addEventListener('click', ()=>{
  if(AJUSTES.mfaObligatorio && !enrollDesdeApp){
    errAuth('#enErr','El estudio exige doble factor para entrar. Tienes que configurarlo.');
    return;
  }
  if(enrollDesdeApp) volverAlaApp();
  else if(pendiente) entra(pendiente);
});
$('#recupOk').addEventListener('click', ()=>{
  if(enrollDesdeApp){ volverAlaApp(); toast('Doble factor activado'); }
  else if(pendiente) entra(pendiente);
  else irAuth('login');
});
const normCod = c => String(c).replace(/[\s-]/g,'').toUpperCase();
const nuevoCodigoRecup = () => {
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const t = n => Array.from(azar(n)).map(b=>A[b%32]).join('');
  return t(4)+'-'+t(4);
};

/* ---- he olvidado la contraseña ---- */
$('#goForgot').addEventListener('click', ()=>{
  $('#fUser').innerHTML = USERS.filter(u=>u.activo)
    .map(u=>`<option value="${u.id}">${esc(u.nom)} (${esc(u.user)})</option>`).join('');
  irAuth('forgot');
});
$('#backLogin').addEventListener('click', ()=>irAuth('login'));
$('#backLogin2').addEventListener('click', ()=>irAuth('login'));
$('#goReset').addEventListener('click', ()=>irAuth('reset'));
$('#forgotForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const u = userById(+$('#fUser').value);
  SOLICITUDES.unshift({id:nextSol++, userId:u.id, ts:Date.now(), msg:$('#fMsg').value.trim(), estado:'pendiente'});
  logea(`Solicitud de restablecimiento enviada por «${u.user}»`, u.nom);
  $('#fMsg').value='';
  irAuth('login');
  $('#loginOk').innerHTML = `<strong>Aviso enviado.</strong> El administrador te dará un código de
    restablecimiento. Cuando lo tengas, pulsa «He olvidado mi contraseña» y luego «Ya tengo un código».`;
  $('#loginOk').classList.remove('hide');
  if(ME && ME.rol==='admin') render();
});
$('#resetForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const u = USERS.find(x=>x.user===$('#rsUser').value.trim().toLowerCase());
  const cod = $('#rsCode').value.trim().toUpperCase();
  const p1 = $('#rsP1').value.trim(), p2 = $('#rsP2').value.trim();
  if(!u || !u.reset || u.reset.cod !== cod)
    return errAuth('#rsErr','El usuario o el código no son correctos.');
  if(Date.now() > u.reset.exp)
    return errAuth('#rsErr','Ese código ha caducado. Pide otro al administrador.');
  if(p1.length < 4)  return errAuth('#rsErr','La contraseña debe tener al menos 4 caracteres.');
  if(p1 !== p2)      return errAuth('#rsErr','Las dos contraseñas no coinciden.');
  u.salt = nuevaSal(); u.hash = hashPass(p1, u.salt); u.iter = ITER; u.reset = null;
  logea(`Contraseña restablecida por la propia persona`, u.nom);
  irAuth('login');
  $('#u').value = u.user; $('#p').value = '';
  $('#loginOk').innerHTML = '<strong>Contraseña cambiada.</strong> Ya puedes entrar con ella.';
  $('#loginOk').classList.remove('hide');
  if(ME && ME.rol==='admin') render();
});

/* ---- entrada efectiva a la app ---- */
function entra(u){
  ME = u; pendiente = null;
  clearInterval(demoT); demoT = null;
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  $('#meName').textContent = ME.nom;
  $('#meRole').textContent = ME.rol==='admin' ? 'Administrador' : 'Usuario';
  $('#meAvatar').textContent = ME.ini;
  $$('.admin-only').forEach(el=>el.classList.toggle('hide', ME.rol!=='admin'));
  logea('Inicio de sesión', ME.nom);
  initSelects(); irModulo('fichaje'); go('fichaje'); armaCalendario();
  if(window.LC && LC.guarda && LC.guarda.listo){
    LC.guarda.listo.then(()=>{ if(ME && typeof render==='function') render(); });
  }
  const clave = ($('#p').value||'').trim();
  if(!clave) return;
  fetch('/api/acceso/entrar', {
    method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({usuario:u.user, clave})
  }).then(r=>r.ok?r.json():null).then(()=>{
    if(typeof cargarHorasServidor==='function') return cargarHorasServidor();
  }).then(()=>{
    if(typeof subirHorasPendientes==='function') return subirHorasPendientes();
  }).then(()=>{ if(typeof render==='function') render(); }).catch(()=>{});
}
function salirAlLogin(){
  fetch('/api/acceso/salir', {method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'}, body:'{}'}).catch(()=>{});
  ME=null; timer=null; pendiente=null;
  $('#app').classList.add('hide'); $('#login').classList.remove('hide');
  $('#u').value=''; $('#p').value=''; irAuth('login'); paintTimer();
}
function pideSalir(){
  if(!ME) return;
  $('#modalHost').innerHTML = `<div class="overlay" id="salirOv"><div class="modal">
    <div class="lbl" style="margin-bottom:12px">Salir</div>
    <h2>¿Volver al acceso?</h2>
    <p class="cap">${timer?'Hay un cronómetro en marcha: se va a parar. ':''}Se cierra la sesión.</p>
    <div class="acts">
      <button class="btn" type="button" id="salirNo">Quedarme</button>
      <button class="btn btn-primary" type="button" id="salirSi">Salir</button>
    </div>
  </div></div>`;
  const cierra = () => { $('#modalHost').innerHTML=''; };
  $('#salirNo').addEventListener('click', cierra);
  $('#salirOv').addEventListener('click', ev=>{ if(ev.target.id==='salirOv') cierra(); });
  $('#salirSi').addEventListener('click', ()=>{ cierra(); salirAlLogin(); });
}
$('#logout').addEventListener('click', pideSalir);
$('#logoHome').addEventListener('click', pideSalir);

/* ================= MI CUENTA ================= */
const cerrarModal = () => $('#modalHost').innerHTML='';
$('#miCuenta').addEventListener('click', modalMiCuenta);
function modalMiCuenta(){
  const m = ME.mfa.activo;
  const quedan = ME.mfa.recup.filter(r=>!r.usado).length;
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal">
    <div class="lbl" style="margin-bottom:12px">Mi cuenta</div>
    <h2>${esc(ME.nom)}</h2><p class="cap">${esc(ME.user)} · ${ME.rol==='admin'?'Administrador':'Usuario'}</p>
    <div class="policy">
      <div><div class="pt">Contraseña</div><div class="pd">Guardada cifrada. Nadie puede consultarla.</div></div>
      <button class="btn btn-sm" id="mcPass">Cambiar</button></div>
    <div class="policy">
      <div><div class="pt">Verificación en dos pasos</div>
        <div class="pd">${m ? `Activa · te quedan ${quedan} códigos de recuperación`
                            : 'Desactivada. Muy recomendable activarla.'}</div></div>
      <button class="btn btn-sm${m?'':' btn-primary'}" id="mcMfa">${m?'Desactivar':'Activar'}</button></div>
    <div class="acts"><button class="btn btn-primary" id="mcOk" style="padding:9px 16px">Cerrar</button></div>
  </div></div>`;
  $('#mcOk').addEventListener('click', cerrarModal);
  $('#mcPass').addEventListener('click', modalCambiarPass);
  $('#mcMfa').addEventListener('click', ()=>{
    if(m){
      ME.mfa = {secreto:null, activo:false, recup:[]};
      logea('Doble factor desactivado');
      cerrarModal(); render(); toast('Doble factor desactivado');
    } else {
      cerrarModal();
      $('#app').classList.add('hide'); $('#login').classList.remove('hide');
      pendiente = null; enrollDesdeApp = true; empiezaEnroll(ME);
    }
  });
}
function modalCambiarPass(){
  $('#modalHost').innerHTML = `<div class="overlay"><div class="modal">
    <div class="lbl" style="margin-bottom:12px">Seguridad</div>
    <h2>Cambiar mi contraseña</h2>
    <p class="cap">Escribe la actual y la nueva. Se guarda cifrada.</p>
    <div class="msg msg-err hide" id="cpErr"></div>
    <div class="row"><label class="lbl" for="cp0">Contraseña actual</label>
      <input class="field" id="cp0" type="password" autocomplete="current-password"></div>
    <div class="row"><label class="lbl" for="cp1">Nueva contraseña</label>
      <input class="field" id="cp1" type="password" autocomplete="new-password"></div>
    <div class="row"><label class="lbl" for="cp2">Repítela</label>
      <input class="field" id="cp2" type="password" autocomplete="new-password"></div>
    <div class="acts"><button class="btn" id="cpCancel">Cancelar</button>
      <button class="btn btn-primary" id="cpOk" style="padding:9px 16px">Guardar</button></div>
  </div></div>`;
  $('#cpCancel').addEventListener('click', cerrarModal);
  $('#cpOk').addEventListener('click', ()=>{
    const a0=$('#cp0').value.trim(), a=$('#cp1').value.trim(), b=$('#cp2').value.trim();
    const err = m => { $('#cpErr').textContent=m; $('#cpErr').classList.remove('hide'); };
    if(!verificaPass(a0, ME)) return err('La contraseña actual no es correcta.');
    if(a.length < 4)          return err('La nueva debe tener al menos 4 caracteres.');
    if(a !== b)               return err('Las dos contraseñas nuevas no coinciden.');
    ME.salt = nuevaSal(); ME.hash = hashPass(a, ME.salt); ME.iter = ITER;
    logea('Cambio de contraseña propia');
    cerrarModal(); render(); toast('Contraseña actualizada');
  });
  $('#cp0').focus();
}

/* ================= NAVEGACIÓN ================= */
$$('.nav').forEach(b=>b.addEventListener('click', ()=>go(b.dataset.view)));
function go(v){
  vista = v;
  $$('.nav').forEach(b=>b.setAttribute('aria-current', b.dataset.view===v?'page':'false'));
  Object.keys(TITULOS).forEach(x=>$('#v-'+x).classList.toggle('hide', x!==v));
  $('#pageTitle').textContent = TITULOS[v][0];
  $('#pageSub').textContent = TITULOS[v][1];
  $('#pageSub').classList.toggle('hide', !TITULOS[v][1]);
  if($('#ayudaBtn')) $('#ayudaBtn').setAttribute('aria-current', v==='ayuda'?'true':'false');
  render();
  if(v==='calendario') scrollCalendario();
}
function initSelects(){
  const optP = PROYECTOS.map(p=>`<option value="${p.id}">${esc(p.nom)}</option>`).join('');
  const optC = CATS.map(c=>`<option value="${c.id}">${esc(c.nom)}</option>`).join('');
  $('#tProy').innerHTML = optP; $('#mProy').innerHTML = optP;
  $('#tCat').innerHTML = optC;  $('#mCat').innerHTML = optC;
  $('#fProyecto').innerHTML = '<option value="">Todos los proyectos</option>'+optP;
  $('#fPersona').innerHTML = '<option value="">Todo el equipo</option>'+
    USERS.map(u=>`<option value="${u.id}"${u.id===ME.id?' selected':''}>${esc(u.nom)}</option>`).join('');
  $('#mFecha').valueAsDate = new Date();
}


/* ---------- AVISO EMERGENTE CON DESHACER ---------- */
let toastT = null;
function toast(texto, accion, fn){
  clearTimeout(toastT);
  const h = $('#toastHost');
  h.innerHTML = `<div id="toast"><span>${esc(texto)}</span>${accion?`<button id="toastBtn">${esc(accion)}</button>`:''}</div>`;
  if(accion) $('#toastBtn').addEventListener('click', ()=>{ fn(); h.innerHTML=''; });
  toastT = setTimeout(()=>h.innerHTML='', accion?6000:2600);
}

/* ---------- API interna para otros módulos ---------- */
const RESET_LOCAL_MS = 24*3600*1000;
function codigoResetLocal(){
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const t = n => Array.from(azar(n)).map(b=>A[b%32]).join('');
  return 'LC-'+t(4)+'-'+t(4);
}
function resetAdminUsuario(id, motivo){
  const u = userById(+id);
  if(!u) return null;
  const cod = codigoResetLocal();
  u.reset = {cod, exp: Date.now()+RESET_LOCAL_MS};
  logea(`Código de restablecimiento generado para «${u.user}»${motivo?' ('+motivo+')':''}`);
  return {usuario:u, codigo:cod};
}
function altaAdminUsuario(nom, user, rol){
  nom = String(nom||'').trim();
  user = String(user||'').trim().toLowerCase();
  if(!nom || !user) return {error:'Falta nombre o usuario.'};
  if(USERS.some(u=>u.user===user)) return {error:'Ese usuario ya existe.'};
  const ini = nom.split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || user.slice(0,2).toUpperCase();
  const u = {id:nextUserId++, user, nom, rol:rol==='admin'?'admin':'usuario', ini,
    alta:new Date().toISOString().slice(0,10), activo:true,
    salt:nuevaSal(), hash:'', iter:ITER, mfa:{secreto:null, activo:false, recup:[]}, reset:null};
  USERS.push(u);
  logea(`Alta de usuario «${user}» (${nom})`);
  return resetAdminUsuario(u.id, 'alta nueva');
}

window.LC = window.LC || {};
LC.nucleo = {
  usuarios: () => USERS.map(u=>u),
  usuario: id => userById(+id),
  proyectos: () => PROYECTOS.map(p=>p),
  proyecto: id => proyById(+id),
  categorias: () => CATS.map(c=>({...c})),
  estados: () => ({...ESTADOS}),
  tarifa: () => ({...TARIFA}),
  ajustes: () => AJUSTES,
  solicitudes: () => SOLICITUDES.map(s=>s),
  actividad: () => LOG.map(l=>l),
  logea,
  altaUsuario: altaAdminUsuario,
  resetUsuario: resetAdminUsuario,
  cambiarRol(id){
    const u = userById(+id); if(!u || u.id===ME.id) return null;
    u.rol = u.rol==='admin' ? 'usuario' : 'admin';
    logea(`Rol de «${u.user}» cambiado a ${u.rol}`);
    return u;
  },
  cambiarActivo(id){
    const u = userById(+id); if(!u || u.id===ME.id) return null;
    u.activo = !u.activo;
    logea(`Cuenta «${u.user}» ${u.activo?'activada':'desactivada'}`);
    return u;
  },
  quitarMfa(id){
    const u = userById(+id); if(!u) return null;
    u.mfa = {secreto:null, activo:false, recup:[]};
    logea(`Doble factor de «${u.user}» retirado (móvil perdido o cambiado)`);
    return u;
  },
  resolverSolicitud(id){
    const s = SOLICITUDES.find(x=>x.id===+id);
    if(!s) return null;
    s.estado='resuelta';
    return resetAdminUsuario(s.userId, 'a petición suya');
  },
  descartarSolicitud(id){
    const s = SOLICITUDES.find(x=>x.id===+id);
    if(!s) return null;
    s.estado='descartada';
    logea(`Aviso de «${userById(s.userId).user}» descartado`);
    return s;
  },
  setMfaObligatorio(v){
    AJUSTES.mfaObligatorio = !!v;
    logea(`Doble factor ${AJUSTES.mfaObligatorio?'exigido a todo el equipo':'ya no es obligatorio'}`);
    return AJUSTES.mfaObligatorio;
  },
  actualizarProyecto(id, patch){
    const p = proyById(+id);
    if(!p) return null;
    Object.assign(p, patch||{});
    return p;
  }
};
