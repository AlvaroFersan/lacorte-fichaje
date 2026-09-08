# Cómo montar La Corte en el NAS

Es igual que Wekan: se pega un YAML en Container Manager y el NAS
descarga la imagen. No hay `.bat`. No hace falta clonar el repo.

La app, una vez arrancada, no necesita internet. El NAS sí lo necesita
**una vez**, para bajar la imagen.

## Paso 1. Carpeta de datos

En File Station crea:

`/volume1/docker/lacorte/data`

Ahí viven la base (`fichaje.db`) y el secreto de sesión. No la borres
al actualizar el contenedor.

Si ya tienes una base en el PC y quieres las mismas cuentas y horas,
cópiala ahí **antes** de arrancar, con el nombre `fichaje.db`.

## Paso 2. Proyecto con YAML

1. Container Manager → Proyecto → Crear.
2. Nombre: `lacorte`.
3. Ruta del proyecto: la que quieras, por ejemplo `/volume1/docker/projects/lacorte`.
4. Elige **Configuraciones de YAML**.
5. Pega entero el contenido de `NAS.yml` (está también abajo).
6. Crear / Iniciar.
7. Cuando el estado esté en verde, abre: `http://IP-DEL-NAS:3001`.

Si acabas de subir código a GitHub, espera a que el flujo **Imagen NAS**
termine en verde. Si no, el NAS bajará la imagen vieja.

## YAML para copiar

```yaml
services:
  fichaje:
    image: ghcr.io/alvarofersan/lacorte-fichaje:latest
    container_name: La-Corte
    hostname: lacorte
    init: true
    security_opt:
      - no-new-privileges:true
    user: "0:0"
    ports:
      - "3001:3000"
    volumes:
      - /volume1/docker/lacorte/data:/data:rw
    environment:
      PUERTO: "3000"
      RUTA_DB: /data/fichaje.db
      NODE_ENV: production
      COOKIE_SECURE: "0"
    mem_limit: 768m
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    restart: unless-stopped
    stop_grace_period: 15s
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 40s
```

## Primera entrada

Las cuentas las da el administrador del estudio. No se publican aquí.

Si arrancas con la carpeta `data` vacía, el servidor crea una base nueva.
Entra y cambia tu clave en **Mi cuenta**. Si copiaste tu `fichaje.db`,
sigues con la clave que ya tenías.

El secreto de las cookies se genera solo y se guarda en
`/volume1/docker/lacorte/data/session.secret`. No lo pongas en el YAML.

## Actualizar

1. Sube el código a GitHub (`main`).
2. Espera el flujo **Imagen NAS** en verde.
3. Container Manager → proyecto `lacorte` → Recrear (o Actualizar).
4. La carpeta `data` no se toca: horas y cuentas siguen ahí.

## Si ghcr.io no baja

Algunos NAS no hablan con GitHub Container Registry. Entonces:

1. Container Manager → Proyecto → Crear → **desde Git**.
2. Repo: `https://github.com/AlvaroFersan/lacorte-fichaje.git`
3. Rama: `main`. El NAS usa `docker-compose.yml` y construye con
   Node de Docker Hub. Tarda unos minutos la primera vez.

La imagen correcta, si sí baja, es:

`ghcr.io/alvarofersan/lacorte-fichaje:latest`

Tiene una **s**: `alvarofersan`.

Si da `EACCES: permission denied, open '/data/session.secret'`, el YAML
tiene que llevar `user: "0:0"`.

## Puerto ocupado

Cambia solo el número de la izquierda:

`3002:3000`

Entonces se abre con `http://IP-DEL-NAS:3002`.

## Copia de la base

En el programador de tareas del NAS puedes lanzar `scripts/copia-nas.sh`.
Conserva 14 días en `/volume1/docker/lacorte/data/copias`.

## Licencia

Se puede descargar y usar en el NAS del estudio. No se puede modificar,
vender ni redistribuir. Texto: `LICENSE`.
