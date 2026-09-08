# Cómo montar La Corte en el NAS

Es igual que el ejemplo de Wekan: se pega un YAML en Container Manager y el NAS
descarga la imagen automáticamente.

No hay `.bat`. No hay que clonar el repo. No hay que añadir registro si la imagen
está pública.

## Paso 1. Crear carpeta de datos

En File Station crea esta carpeta:

`/volume1/docker/lacorte/data`

Ahí se guardan la base de datos y las sesiones. No la borres al actualizar.

## Paso 2. Crear proyecto con YAML

1. Container Manager -> Proyecto -> Crear.
2. Nombre: `lacorte`.
3. Ruta del proyecto: la que quieras, por ejemplo `/volume1/docker/projects/lacorte`.
4. Elige **Configuraciones de YAML**.
5. Pega entero el contenido de `NAS.yml`.
6. Crear / Iniciar.
7. Cuando esté en verde, abre: `http://IP-DEL-NAS:3000`.

## YAML para copiar

```yaml
services:
  fichaje:
    image: ghcr.io/alvarofersan/lacorte-fichaje:latest
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
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
```

## Importante

La imagen correcta es:

`ghcr.io/alvarofersan/lacorte-fichaje:latest`

Tiene una **s**: `alvarofersan`.

Si da error `Head "https://ghcr.io/v2/..."`, revisa que no se haya pegado la
ruta vieja sin la `s`.

## Puerto ocupado

Si el puerto 3000 ya se usa, cambia solo el número de la izquierda:

`3001:3000`

Entonces se abre con `http://IP-DEL-NAS:3001`.

## Licencia

Se puede descargar y usar en el NAS del estudio. No se puede modificar, vender
ni redistribuir. Texto: `LICENSE`.
