# Cómo montar La Corte en el NAS

Como Wekan: pegas un YAML y el NAS **baja la imagen**. No construye nada.
No elijas «desde Git». Si lo haces, DSM busca un Dockerfile y sale
**Failed to patch Dockerfile**.

## Paso 1. Carpeta de datos

File Station → crea `/volume1/docker/lacorte/data`.

## Paso 2. Pegar el YAML

1. Container Manager → Proyecto → Crear.
2. Nombre: `lacorte`.
3. Ruta: p. ej. `/volume1/docker/projects/lacorte`.
4. **Configuraciones de YAML** (no Git, no Dockerfile).
5. Pega el bloque de abajo, entero.
6. Crear / Iniciar.
7. Abre `http://IP-DEL-NAS:3001`.

## YAML para copiar (este, no otro)

```yaml
services:
  fichaje:
    image: ghcr.io/alvarofersan/lacorte-fichaje:latest
    container_name: La-Corte
    hostname: lacorte
    security_opt:
      - no-new-privileges:true
    user: 0:0
    ports:
      - 3001:3000
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

La imagen es `ghcr.io/alvarofersan/lacorte-fichaje:latest` (con **s**).

Si da `EACCES` al escribir en `/data`, el YAML tiene que llevar `user: 0:0`.

## Puerto ocupado

Cambia solo la izquierda: `3002:3000` → `http://IP-DEL-NAS:3002`.

## Primera entrada

Si `data` estaba vacía, es una base nueva: entra y cambia la clave en Mi cuenta.
Si copiaste tu `fichaje.db`, usas la clave de siempre.
