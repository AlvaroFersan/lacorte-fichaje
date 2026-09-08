# La Corte · Fichaje y producción

Aplicación interna del estudio. Se ejecuta en el **NAS**, sin internet.
Dos módulos **aislados**: **fichaje** (horas) y **producción** (escenas y carpetas).
Se hablan solo por el **puente** (`prototipo/js/puente.js`): un registro de horas
puede enlazarse a una escena. El código de uno no lee el del otro.

Esto es el cimiento: servidor Node, base SQLite y acceso de verdad
(contraseñas bcrypt, sesiones, TOTP). El prototipo visual sigue en
`prototipo/` como especificación viva.

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

Un proyecto vacío: **Interno**. Sin horas ni tareas de mentira.

La base de datos aparece en `data/fichaje.db`. Si la borras y reinicias,
se vuelve a crear esa base limpia.

---

## Montar en el NAS

Como Wekan: Container Manager -> Proyecto -> Crear -> **Configuraciones de YAML**.
Pega el contenido de **[NAS.yml](NAS.yml)**. Guía paso a paso:
**[docs/NAS.md](docs/NAS.md)**.

Luego: `http://IP-DEL-NAS:3000`.
Las cuentas las da el administrador del estudio.

---

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Memoria del proyecto | `docs/PROYECTO-LA-CORTE-FICHAJE.md` |
| Prototipo visual (aún en memoria) | `prototipo/lacorte-fichaje-prototipo.html` y `/prototipo/` |
| Servidor y API | `server/` |
| Pantalla de entrada real | `web/` |
| Base de datos | `data/fichaje.db` (no va al git) |
| Copia de seguridad | `scripts/copia.sh` |

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

---

## Lo que aún no está (lo iremos haciendo)

1. Conectar el prototipo a estas rutas (calendario, árbol, tablero).
2. Cierre de periodo y aprobación de partes.
3. Copias automáticas en el programador del NAS.
4. Alta de 2FA desde «Mi cuenta» en la web nueva.

---

## Seguridad, en claro

- La contraseña **no se guarda**. Se guarda un hash bcrypt. Nadie, ni el
  admin, puede leerla: solo generar un código `LC-XXXX-XXXX` para que
  la persona elija otra.
- La cookie de sesión va firmada y el navegador no puede leerla (httpOnly).
- El TOTP se valida **en el servidor**, no en el JavaScript del prototipo.
- No hay Google Fonts ni CDNs: si el NAS no tiene salida, la app sigue abierta.
