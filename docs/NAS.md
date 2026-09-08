# Cómo montar La Corte en el NAS

Synology **no sabe bajar imágenes de GitHub** (`ghcr.io`). Por eso fallaba el YAML
anterior. Wekan funciona porque usa Docker Hub. La Corte se monta de una de
estas dos formas.

Las cuentas de acceso no están escritas aquí. Las da quien administra el estudio.

Antes, en File Station, crea: `docker` → `lacorte` → `data`
(ruta: `/volume1/docker/lacorte/data`).

---

## Forma 1 (la buena): proyecto desde Git

Container Manager construye la app en el NAS. Node lo baja de Docker Hub,
como Wekan.

1. Container Manager → **Proyecto** → **Crear**.
2. Nombre: `lacorte`.
3. Origen: **repositorio Git** (no «Configuraciones de YAML»).
4. URL:

   `https://github.com/AlvaroFersan/lacorte-fichaje.git`

5. Rama: `main`.
6. Tiene que usar `docker-compose.yml`.
7. Crear / iniciar y **espera 2–5 minutos** (compila). No es instantáneo.
8. Contenedor `La-Corte` en verde → `http://IP-DEL-NAS:3000`

---

## Forma 2: si solo puedes pegar YAML

Primero hay que dejar la imagen **dentro** del NAS. Panel de control →
**Programador de tareas** → Crear → Tarea programada → **Script definido por el usuario**.

Usuario: `root`. Marca «Ejecutar como root» si sale. En el script, **una sola línea**
(cambia `PEGA_EL_TOKEN` por el `ghp_...` de GitHub, `read:packages`):

```sh
/usr/local/bin/docker login ghcr.io -u AlvaroFersan -p PEGA_EL_TOKEN && /usr/local/bin/docker pull ghcr.io/alvaroferan/lacorte-fichaje:latest && /usr/local/bin/docker tag ghcr.io/alvaroferan/lacorte-fichaje:latest lacorte-fichaje:local
```

Ejecutar ahora. Cuando termine sin error, en Container Manager → Proyecto →
Crear → **Configuraciones de YAML** y pega:

```yaml
services:
  fichaje:
    image: lacorte-fichaje:local
    container_name: La-Corte
    hostname: lacorte
    security_opt:
      - no-new-privileges:true
    user: 1026:100
    ports:
      - 3000:3000
    volumes:
      - /volume1/docker/lacorte/data:/data:rw
    environment:
      - PUERTO=3000
      - RUTA_DB=/data/fichaje.db
      - NODE_ENV=production
      - COOKIE_SECURE=0
    restart: on-failure:5
```

Ese YAML **ya no habla con GitHub**. Usa la imagen que acaba de bajar el programador.

---

## Si algo no va

| Qué ves | Qué mirar |
|---|---|
| Head ghcr.io / fichaje Error | Estás pegando el YAML viejo. Usa la forma 1 (Git) o la 2 (imagen local). |
| El registro ghcr.io no hace nada | Normal. Synology no lista GitHub. No hace falta ese registro. |
| Build tarda | Normal la primera vez. Mira los registros; tiene que acabar en Running. |
| Aviso «no segura» | Normal: es `http`. En la oficina se ignora. |

---

## Licencia

Se puede descargar y usar en el NAS del estudio. No se puede modificar, vender
ni redistribuir. Texto: `LICENSE`.
