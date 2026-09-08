# La Corte · Fichaje y producción

Aplicación interna del estudio. Se ejecuta en el **NAS**, sin internet
una vez montada. Dos módulos **aislados**: **fichaje** (horas) y
**producción** (escenas y carpetas). Se hablan solo por el **puente**
(`prototipo/js/puente.js`): un registro de horas puede enlazarse a una
escena. El código de uno no lee el del otro.

El navegador abre la interfaz de `prototipo/`. Node + SQLite guardan
cuentas, horas, proyectos y el chat. Contraseñas con **bcrypt**,
sesiones con cookie, TOTP en el servidor.

**Licencia:** se puede descargar y usar en el NAS del estudio. No se puede
modificar, vender ni redistribuir. Texto completo en `LICENSE`.

---

## Qué necesitas en el ordenador (para probar ahora)

1. [Node.js 22](https://nodejs.org/) **o** Docker Desktop.
2. Este proyecto, tal cual, en una carpeta.

No hace falta cuenta en la nube ni dominio.

---

## Arrancar en tu PC (sin Docker)

Abre PowerShell en esta carpeta:

```powershell
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Pega esa frase en `.env` como `SESSION_SECRET`. Luego:

```powershell
npm install
npm start
```

Abre [http://localhost:3000](http://localhost:3000).
Las cuentas las da el administrador del estudio; no se publican aquí.

Un proyecto vacío: **Interno**. Cada persona tiene además **Personal**.
La base aparece en `data/fichaje.db`. Si la borras y reinicias, se
vuelve a crear limpia.

---

## Montar en el NAS

Como Wekan: Container Manager → Proyecto → Crear → **Configuraciones de YAML**.
Pega el contenido de **[NAS.yml](NAS.yml)**. No elijas «desde Git»: DSM
intentaría un Dockerfile y falla. Guía: **[docs/NAS.md](docs/NAS.md)**.

Luego: `http://IP-DEL-NAS:3001`.

Si acabas de hacer push, espera a que GitHub Actions (**Imagen NAS**)
termine en verde antes de recrear el proyecto.

---

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Memoria del proyecto | `docs/PROYECTO-LA-CORTE-FICHAJE.md` |
| Interfaz | `prototipo/` (la sirve Node en `/`) |
| Servidor y API | `server/` |
| YAML para pegar en el NAS | `NAS.yml` (el mismo que `docker-compose.yml`) |
| Base de datos | `data/fichaje.db` (no va al git) |
| Copia de seguridad | `scripts/copia.sh` (PC) y `scripts/copia-nas.sh` (NAS) |

### Rutas de la API (todas menos `/api/salud` piden sesión)

- `POST /api/acceso/entrar` — usuario + clave
- `POST /api/acceso/mfa` — segundo factor
- `POST /api/acceso/salir`
- `GET  /api/acceso/sesion`
- `GET  /api/proyectos`
- `GET  /api/tareas` — escenas
- `GET  /api/entradas` — horas (un usuario solo ve las suyas)
- `GET  /api/informes/resumen`
- `GET  /api/usuarios` — solo admin
- `GET  /api/chat` — mensajes entre personas del estudio

---

## Lo que aún no está (lo iremos haciendo)

1. Cierre de periodo y aprobación de partes.
2. Copias automáticas en el programador del NAS (el script ya está).
3. Adjuntos de chat guardados en el servidor (hoy viaja el nombre, no el archivo).

---

## Seguridad, en claro

- La contraseña **no se guarda**. Se guarda un hash bcrypt. Nadie, ni el
  admin, puede leerla: solo generar un código `LC-XXXX-XXXX` para que
  la persona elija otra.
- El secreto de sesión, en Docker, se genera solo y vive junto a la base
  (`session.secret`). No va en el YAML ni en GitHub.
- La cookie de sesión va firmada y el navegador no puede leerla (httpOnly).
- El TOTP se valida **en el servidor**, no en el JavaScript del prototipo.
- No hay Google Fonts ni CDNs: si el NAS no tiene salida, la app sigue abierta.
