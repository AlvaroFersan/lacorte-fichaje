# La Corte · Fichaje y Producción

**Documento de memoria del proyecto.** Súbelo como conocimiento de un proyecto de Claude
(o pégalo en sus instrucciones) para no tener que volver a contar el contexto.
Última actualización: 8 de septiembre de 2026.

---

## 1. Instrucciones para el asistente

> Copia este bloque en las *instrucciones personalizadas* del proyecto.

Trabajas conmigo (Álvaro) en una aplicación interna de control horario y gestión de
producción para **La Corte Editores**, un estudio de edición y postproducción audiovisual.
La app se aloja en el NAS de la oficina y la usa el equipo del estudio.

- Responde **en español**, con tono directo y sin adornos.
- No soy programador de formación: dame el código listo para usar, pero **explica siempre
  qué hace y por qué**, en lenguaje llano. Nada de dar por supuesto.
- **No subas nada a ningún servidor ni publiques nada sin mi permiso explícito.** Los
  entregables me los pasas como archivo.
- Cuando entregues código, **pruébalo antes** y dime qué has verificado. Si no has podido
  probarlo, dilo claramente.
- Sé honesto con los problemas: si algo está mal planteado o es inseguro, dímelo aunque no
  lo haya preguntado.
- Prioriza que la app funcione **sin internet**: el NAS puede no tener salida. Nada de
  dependencias externas, CDNs ni tipografías remotas.

---

## 2. Qué es el proyecto

Una aplicación web interna, servida desde el NAS de la oficina, con **dos módulos**:

1. **Fichaje** — control horario tipo Clockify. Cada persona registra sus horas por
   proyecto y por tipo de trabajo, con cronómetro o a mano, y hay informes y gráficos.
2. **Producción** — gestor de trabajo tipo Wrike. Proyectos organizados en carpetas
   anidadas, con escenas asignables, estados, columnas configurables y avisos.

Los dos módulos están **aislados en el código** (carpetas y archivos distintos).
Solo se hablan por un **puente**: un registro de horas puede enlazarse a una escena,
y esas horas se suman en la ficha de esa escena. Fichaje no lee carpetas ni estados;
Producción no lee el cronómetro ni el calendario.

### Usuarios y roles

| Rol | Quién | Qué ve |
|---|---|---|
| Administrador | Álvaro y quien él designe | Todo, incluidas Gestión, Equipo y Usuarios |
| Usuario | Resto del estudio | Solo sus propias horas y el módulo de Producción |

### Tipos de trabajo (categorías fijas)

Son la columna vertebral de los informes. Cada registro de horas pertenece a una:

- **Gestión** — reuniones, presupuestos, coordinación, facturación. Color azul.
- **Asistencia de montaje** — ingesta, sincronización, bins, preparación de proyectos. Naranja.
- **Montaje** — el montaje propiamente dicho. Verde.

---

## 3. Decisiones ya tomadas

No hace falta volver a discutirlas salvo que yo lo pida.

| Tema | Decisión |
|---|---|
| Despliegue | **Docker en el NAS**, contenedor con Node + SQLite |
| Base de datos | SQLite en un volumen del NAS (un solo archivo, fácil de respaldar) |
| Acceso | Usuario y contraseña propios de la app (no LDAP ni cuentas del NAS) |
| Contraseñas | **Cifradas siempre.** Ni el admin puede leerlas: solo restablecerlas |
| Restablecer | El admin genera un código; **la contraseña la elige la persona** |
| Doble factor | **TOTP estándar** (Google Authenticator, Authy, 1Password) con QR |
| Tipografías | **Sin Google Fonts.** Inter si está instalada, si no la del sistema |
| Dependencias | **Ninguna externa.** Todo escrito a mano para funcionar sin internet |
| Estética | Identidad de La Corte (blanco y negro) sobre usabilidad tipo Clockify/Wrike |
| Idioma | Toda la interfaz en español |
| Reloj | **El del equipo.** España, México y Colombia: hoy, la semana y las horas salen del sistema donde abres la app. No hay huso fijo ni fechas en UTC |

### Por qué sin dependencias externas

El prototipo cargaba las tipografías desde Google Fonts y tardaba **12.715 ms** en abrir
sin conexión. Quitada esa dependencia: **92 ms**. En un NAS sin salida a internet eso es la
diferencia entre una app usable y una inservible. Por eso el generador de códigos QR y toda
la criptografía están escritos a mano en el propio archivo.

---

## 4. Estado actual

La interfaz vive en `prototipo/`. Node la sirve en `/` y guarda en SQLite
(`data/fichaje.db`). En el NAS: Docker, volumen `/volume1/docker/lacorte/data`,
puerto **3001**. YAML para pegar: `NAS.yml`. Guía: `docs/NAS.md`.

Las cuentas las da el administrador del estudio. No se publican aquí.
Tema claro / oscuro / sistema en **Mi cuenta**. Chat entre personas del
estudio, con aviso abajo a la derecha al llegar un mensaje.

### 4.1 Acceso y seguridad — hecho

- En el **servidor**: contraseñas con **bcrypt**. El hash no se puede leer.
  El prototipo en `file://` aún tiene un hash SHA de respaldo si el NAS no
  responde; el login real va siempre contra `/api/acceso`.
- En el panel de admin se ve el hash, no la contraseña.
- **Restablecimiento**: la persona avisa desde la pantalla de acceso → al admin le sale un
  contador → genera un código `LC-XXXX-XXXX` válido 24 h → se lo da en mano → la persona
  elige su contraseña. El admin nunca la conoce.
- **Doble factor TOTP** (RFC 6238): secreto de 160 bits, QR generado en local, verificación
  con ventana de ±30 s. **Ocho códigos de recuperación** de un solo uso, también cifrados.
- El admin puede **retirar el 2FA** a quien pierda el móvil, y exigirlo a todo el equipo.
- **Registro de actividad**: altas, restablecimientos, cambios de rol, accesos.
- Pantalla *Mi cuenta*: cambiar contraseña y activar o desactivar el 2FA.

> Verificado contra los vectores oficiales de SHA-1, SHA-256, HMAC y los cuatro del
> RFC 6238. El QR se comprobó decodificándolo con un lector real.

### 4.2 Módulo Fichaje — hecho

- **Fichaje**: cronómetro en vivo, alta manual de horas pasadas, indicadores (hoy, semana,
  media de 7 días, proyecto principal), registros recientes editables, deshacer al borrar.
- **Calendario**: rejilla semanal o diaria de 24 h con zoom y navegación.
  **Arrastrar sobre un hueco crea un registro**; arrastrar un bloque lo mueve; arrastrar sus
  bordes lo alarga. Imantación a 15 minutos. Al soltar se abre el editor (descripción,
  proyecto, **escena**, tipo de trabajo, fecha y horas). Marca los **solapes** en rojo y
  pinta la línea de la hora actual. En pantallas estrechas abre en vista Día.
- **Informes**: filtros de 7/14/30 días, persona y proyecto. Barras apiladas por día,
  **donut de reparto por proyecto**, barras por proyecto, reparto por tipo, tabla y CSV.
- **Proyectos**: horas acumuladas por proyecto con su reparto por tipo.
- **Gestión** (admin): cartera con horas reales frente a presupuestadas, coste interno,
  días hasta la entrega y aviso de proyectos en riesgo. Ficha por proyecto con horas por
  persona, donut de funciones, ritmo de las últimas 8 semanas y métricas de post:
  desviación, coste por minuto entregado, horas de montaje por minuto, peso de la
  asistencia, versiones enviadas. Exporta informe en CSV.
- **Equipo** (admin): horas por persona en los últimos 14 días.
- **Usuarios** (admin): política de acceso, avisos de contraseña, cuentas, roles, altas y
  registro de actividad.

### 4.3 Módulo Producción — hecho

Tres vistas sobre los mismos datos, con las mismas columnas:

- **Árbol** (por defecto): carpetas anidadas por proyecto con numeración de filas, plegado
  a cualquier nivel y contadores. Al crear un proyecto nace la estructura del estudio,
  sin el código del proyecto en el nombre: `00_ASISTENCIA`, `01_DOCUMENTOS` (con
  Documentos, Guion, Planes de Trabajo y Crew List), `02_ESCENAS`, `03_ENTREGAS` y
  `04_SALIDAS`.
- **Tareas**: raíz del trabajo de Producción, con conmutador entre tabla y tablero.
- **Tabla**: agrupar por bloque, estado, responsable o proyecto; ordenar por columna.
- **Tablero**: kanban por proyecto con arrastre entre estados.
- **Mis tareas**: lo asignado a cada uno, de los proyectos que puede ver.

**Quién ve qué.** Un proyecto sin compartir lo ve solo su dueño, ni siquiera
un administrador. Al invitar, al dueño le sigue saliendo en **Proyectos**; a
quien invita, solo en **Compartido conmigo**. A cada cuenta se le crea
**Personal**: ficha básica y una pizarra de hojas apiladas en escalera, ordenadas
por día (hoy primero). Se pueden crear hojas nuevas; si invitas a alguien a
Personal, también ve la pizarra. Sin la plantilla de carpetas del estudio.

Además:

- **Columnas configurables.** Ocho estándar (estado, responsable, prioridad, entrega,
  horas, bloque, proyecto, comentarios) más las que crees tú: texto, **etiqueta
  de lista con colores**, número, casilla sí/no y fecha. Se muestran, ocultan y borran desde
  el botón *Columnas* o el `+` de la cabecera.
- **Edición en la propia celda**: estado (como chip de color), responsable, prioridad y
  fechas se cambian sin abrir nada.
- **Ficha de escena** en panel lateral: notas, archivos, comentarios,
  **horas imputadas** con desglose por persona, y borrado con deshacer.
- **Avisos**: al asignarte algo, cambiarte una fecha, mover tu escena de estado o comentar
  en ella. Campana con contador; al pulsar un aviso te lleva a la escena.
- **Chat** del estudio (servidor): hilos entre dos personas, contador en el
  botón, aviso emergente abajo a la derecha si el hilo no está abierto.

---

## 5. Lo que falta

Ordenado por importancia para un estudio real.

### Bloqueantes para usarlo de verdad

1. **Cierre de periodo.** Hoy cualquiera puede editar sus horas de hace seis meses. El admin
   debe poder cerrar el mes y que a partir de ahí solo él pueda tocar nada.
   *El registro de jornada en España obliga a conservar los registros cuatro años; conviene
   confirmarlo con vuestra asesoría antes de definir el comportamiento exacto.*
2. **Aprobación de partes de horas.** Cada uno cierra su semana y el responsable la valida
   antes de que entre en la facturación del proyecto.
3. **Copias de seguridad en el programador del NAS.** El script está
   (`scripts/copia-nas.sh`); falta programarlo en DSM.

### Mejoras del módulo Producción

4. Crear carpetas desde la interfaz y **arrastrar escenas** de una carpeta a otra.
5. Adjuntos y dependencias entre escenas.
6. Vista de **cronograma / Gantt** y filtros guardados.
7. Formularios de solicitud, como los de Wrike.

### Mejoras del módulo Fichaje

8. Bloquear o avisar activamente de solapes al guardar, no solo marcarlos.
9. **Tarifas por persona y por proyecto** (ahora son globales por función).
10. **Fases del proyecto**: armado, corte largo, fine cut, picture lock, entrega.
11. Turnos que **cruzan la medianoche** (hoy hay que partirlos en dos).
12. **Vacaciones y ausencias.**
13. Repasar la experiencia en móvil más allá del calendario.
14. Adjuntos de chat en el servidor (hoy viaja el nombre, no el archivo).

---

## 6. Arquitectura

```
Navegador del equipo
        │  http://nas.oficina.local:3001
        ▼
┌───────────────────────────────┐
│  Contenedor Docker en el NAS  │
│  ┌─────────────────────────┐  │
│  │ Node (Express)          │  │  API REST + sirve el frontend
│  │  · sesiones con cookie  │  │
│  │  · bcrypt               │  │
│  │  · TOTP en servidor     │  │
│  └───────────┬─────────────┘  │
│              ▼                │
│  ┌─────────────────────────┐  │
│  │ SQLite  /data/fichaje.db│  │  volumen del NAS
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

### Estructura de carpetas

```
lacorte-fichaje/
├── NAS.yml                   # pegar en Container Manager (imagen ghcr)
├── docker-compose.yml        # si el NAS construye desde Git
├── Dockerfile
├── .env.example              # solo el PC; el NAS genera session.secret
├── README.md
├── data/                     # volumen persistente (NO va al repositorio)
│   ├── fichaje.db
│   └── session.secret
├── prototipo/                # interfaz que sirve Node en /
│   ├── lacorte-fichaje-prototipo.html
│   └── js/                   # nucleo, fichaje, produccion, puente, tema
├── server/
│   ├── index.js
│   ├── db.js
│   ├── auth.js
│   ├── nucleo/               # acceso, proyectos, chat
│   ├── fichaje/              # entradas, informes
│   ├── produccion/           # escenas, flujos, plantilla
│   ├── administracion/       # usuarios
│   └── lib/                  # fechas, permisos, totp
├── web/                      # pantalla auxiliar en /servidor
└── scripts/
    ├── copia.sh              # respaldo en el PC
    ├── copia-nas.sh          # respaldo del volumen del NAS
    └── poner-clave.js        # hash bcrypt; la clave entra por el entorno
```

---

## 7. Modelo de datos

Entidades y campos principales. Los nombres son orientativos.

**usuarios** — `id`, `usuario`, `nombre`, `iniciales`, `rol` (admin/usuario), `activo`,
`alta`, `hash`, `sal`, `mfa_secreto`, `mfa_activo`, `reset_codigo`, `reset_caduca`

**codigos_recuperacion** — `id`, `usuario_id`, `hash`, `usado`

**proyectos** — `id`, `nombre`, `cliente`, `formato`, `estado`, `horas_presupuestadas`,
`fecha_entrega`, `minutos_programa`, `versiones`, `color`, `flujo_id`, **`dueno`**,
**`personal`**, **`pizarra`** (JSON de hojas: `id`, `fecha`, `texto`). El admin no
bypasea la visibilidad: dueño o equipo.

**carpetas** — `id`, `proyecto_id`, `nombre`, `padre_id` *(anidamiento sin límite)*

**escenas** — `id`, `proyecto_id`, `carpeta_id`, `titulo`, `notas`, `asignado_a`,
`estado` (pendiente/curso/revision/hecha), `prioridad` (alta/media/baja), `fecha_entrega`,
`creador`, `creada`

**comentarios** — `id`, `escena_id`, `usuario_id`, `fecha`, `texto`

**columnas** — `id`, `nombre`, `tipo` (texto/etiqueta/numero/casilla/fecha), `opciones`
(JSON con valor y color), `visible`, `ancho`, `propia`

**valores_columna** — `escena_id`, `columna_id`, `valor`

**entradas** *(registros de horas)* — `id`, `usuario_id`, `proyecto_id`, **`escena_id`**
(opcional: el enlace entre los dos módulos), `categoria` (gestion/asis/montaje),
`descripcion`, `inicio`, `fin`

**avisos** — `id`, `usuario_id`, `texto`, `escena_id`, `fecha`, `leido`

**chat_mensajes** — `id`, `de`, `para`, `texto`, `adj_nom`, `adj_tipo`, `adj_tam`, `ts`, `leido`.
El blob del adjunto aún no se guarda en el servidor.

**solicitudes_password** — `id`, `usuario_id`, `fecha`, `mensaje`, `estado`

**registro_actividad** — `id`, `fecha`, `quien`, `accion`

**ajustes** — `mfa_obligatorio`, `tarifas` por categoría, futuros cierres de periodo

### Tarifas internas actuales

Gestión 45 €/h · Asistencia de montaje 28 €/h · Montaje 42 €/h.
Se usan para calcular el coste de los proyectos. Pendiente: por persona y por proyecto.

---

## 8. Criterios de diseño

Identidad de **La Corte Editores** (lacorteditores.com): blanco y negro, Inter, versales
con espaciado ancho, filetes finos, sin sombras ni esquinas redondeadas. Sobre esa base, la
usabilidad de Clockify y Wrike.

- Barra lateral negra, contenido sobre blanco roto. Modo oscuro incluido.
- Microetiquetas en versales con tracking de 0,13 em.
- Bordes de 2 px de radio como máximo. Nada de gradientes.
- **Colores de datos** (los únicos que rompen el blanco y negro, porque los datos necesitan
  distinguirse): gestión `#2a78d6`, asistencia `#eb6834`, montaje `#1baf7a`. Cada proyecto
  tiene además un color fijo que se respeta en todos los gráficos.
- Estados de escena: pendiente gris, en curso azul, en revisión ámbar, hecha verde.

---

## 9. Glosario

| Término | Significado |
|---|---|
| **Escena** | Unidad de trabajo en el módulo de Producción. Equivale a una tarea de Wrike |
| **Bloque / carpeta** | Agrupación de escenas. Se anidan sin límite |
| **Registro / entrada** | Un tramo de horas fichado por una persona |
| **Asistencia de montaje** | Trabajo de preparación: ingesta, sincronización, bins, exportaciones |
| **Minutos de programa** | Duración del material entregado. Sirve para calcular horas por minuto |
| **Desviación** | Diferencia entre horas reales y presupuestadas |

---

## 10. Cómo seguir

Cuando abras el proyecto nuevo, un buen primer mensaje sería:

> Tengo el prototipo funcionando (te paso el HTML). Quiero empezar el backend: Node +
> SQLite en Docker para el NAS, con bcrypt y el TOTP validado en servidor. Empieza por el
> esquema de la base de datos y las rutas de acceso.

Adjunta al proyecto:

1. Este documento.
2. `lacorte-fichaje-prototipo.html` — el prototipo, que sirve de especificación viva.
