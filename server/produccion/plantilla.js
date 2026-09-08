'use strict';

/* Estructura que nace con cada proyecto. El código (OEV2, etc.) es el
   nombre del proyecto, no se mete en las carpetas. */
const PLANTILLA_ESTUDIO = [
  { nom: '00_ASISTENCIA' },
  { nom: '01_DOCUMENTOS', hijos: ['01_Documentos', '02_Guion', '03_Planes de Trabajo', '04_Crew List'] },
  { nom: '02_ESCENAS' },
  { nom: '03_ENTREGAS' },
  { nom: '04_SALIDAS' }
];

function aplicarPlantillaEstudio(base, proyId) {
  const ins = base.prepare('INSERT INTO carpetas (proyecto_id, nombre, padre_id) VALUES (?, ?, ?)');
  for (const nodo of PLANTILLA_ESTUDIO) {
    const padre = ins.run(proyId, nodo.nom, null).lastInsertRowid;
    for (const nom of nodo.hijos || []) ins.run(proyId, nom, padre);
  }
}

function crearProyectoPersonal(base, userId) {
  const hay = base.prepare('SELECT id FROM proyectos WHERE personal = 1 AND dueno = ?').get(userId);
  if (hay) return hay.id;
  const r = base.prepare(`
    INSERT INTO proyectos (nombre, cliente, formato, estado, horas_presupuestadas, fecha_entrega, minutos_programa, versiones, color, flujo_id, dueno, personal, pizarra)
    VALUES ('Personal', '—', 'Interno', 'curso', 0, NULL, 0, 0, '', 1, ?, 1, '')
  `).run(userId);
  base.prepare('INSERT OR IGNORE INTO proyecto_equipo (proyecto_id, usuario_id) VALUES (?, ?)').run(r.lastInsertRowid, userId);
  return r.lastInsertRowid;
}

function asegurarPersonales(base) {
  const users = base.prepare('SELECT id FROM usuarios').all();
  for (const u of users) crearProyectoPersonal(base, u.id);
}

const FLUJOS_ESTUDIO = [
  {id:1, nom:'Estudio (por defecto)', desc:'Oficina y encargos cortos.', fijo:1, estados:[
    {id:'pendiente', nom:'Pendiente', grupo:'activo', color:'#8a8a85'},
    {id:'curso', nom:'En curso', grupo:'activo', color:'#2a78d6'},
    {id:'revision', nom:'En revisión', grupo:'activo', color:'#eda100'},
    {id:'hecha', nom:'Hecha', grupo:'completado', color:'#22c55e'},
    {id:'pausa', nom:'En pausa', grupo:'diferido', color:'#eda100'},
    {id:'cancelada', nom:'Cancelada', grupo:'cancelado', color:'#e34948'}
  ]},
  {id:2, nom:'EDICIÓN · Escenas', desc:'El de rodaje y montaje. Plantilla al crear un proyecto.', fijo:0, estados:[
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

function sembrarFlujos(base) {
  const n = base.prepare('SELECT COUNT(*) AS n FROM flujos').get().n;
  if (n) return;
  const insF = base.prepare('INSERT INTO flujos (id, nom, desc, fijo) VALUES (?, ?, ?, ?)');
  const insE = base.prepare('INSERT INTO flujo_estados (id, flujo_id, nom, grupo, color, orden) VALUES (?, ?, ?, ?, ?, ?)');
  for (const f of FLUJOS_ESTUDIO) {
    insF.run(f.id, f.nom, f.desc, f.fijo);
    f.estados.forEach((e, i) => insE.run(e.id, f.id, e.nom, e.grupo, e.color, i));
  }
}

function leerFlujos(base) {
  const flujos = base.prepare('SELECT * FROM flujos ORDER BY id').all();
  const estados = base.prepare('SELECT * FROM flujo_estados ORDER BY flujo_id, orden').all();
  return flujos.map(f => ({
    id: f.id,
    nom: f.nom,
    desc: f.desc,
    fijo: !!f.fijo,
    estados: estados.filter(e => e.flujo_id === f.id).map(e => ({
      id: e.id, nom: e.nom, grupo: e.grupo, color: e.color
    }))
  }));
}

module.exports = { PLANTILLA_ESTUDIO, aplicarPlantillaEstudio, sembrarFlujos, leerFlujos, crearProyectoPersonal, asegurarPersonales };
