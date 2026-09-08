# Cómo montar La Corte en el NAS

Igual que Wekan: en Container Manager pegas un YAML y se descarga solo.
No hace falta Git ni un `.bat`.

Cuando arranque, en un PC de la oficina:

`http://IP-DEL-NAS:3000`

(La IP del NAS es la misma con la que abrís Wekan, p. ej. `192.168.0.105`.)

Las cuentas de acceso **no están escritas aquí**. Las da quien administra el estudio.

---

## Una vez (antes de pegar)

1. En **File Station**, crea la carpeta:

   `docker` → `lacorte` → `data`

   La ruta queda: `/volume1/docker/lacorte/data`

2. Que la imagen de GitHub sea **pública** (si no, el NAS no la baja).
   Con la cuenta que publicó el repo:

   https://github.com/users/AlvaroFersan/packages/container/package/lacorte-fichaje/settings

   Abajo, **Change visibility** → **Public**. Solo se hace una vez.

El archivo para copiar está en el repo: **[NAS.yml](../NAS.yml)**  
https://github.com/AlvaroFersan/lacorte-fichaje/blob/main/NAS.yml

---

## Pegar el YAML (Synology Container Manager)

1. Abre **Container Manager**.
2. Izquierda: **Proyecto** → **Crear**.
3. Nombre: `lacorte`.
4. Ruta del proyecto: `/volume1/docker/projects/lacorte`
   (o la que uses; da igual, los datos van a `docker/lacorte/data`).
5. Origen: **Configuraciones de YAML** (el mismo sitio donde está el de Wekan).
6. Borra lo que haya y **pega esto entero**:

```yaml
services:
  fichaje:
    image: ghcr.io/alvaroferan/lacorte-fichaje:latest
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

7. **Siguiente** / **Crear** / **Iniciar**.
8. Tiene que aparecer el contenedor `La-Corte` en marcha (verde).
9. En el navegador: `http://192.168.0.105:3000`
   (cambia la IP si la del NAS es otra).

`user: 1026:100` es el mismo usuario que en Wekan, para que pueda escribir en `data/`.

Si el puerto 3000 está ocupado, en el YAML cambia solo el número de la izquierda:

`3001:3000` → entonces abres `http://IP-DEL-NAS:3001`.

---

## Actualizar

Cuando en GitHub (pestaña **Actions**) el flujo «Imagen NAS» esté en verde:

Container Manager → proyecto `lacorte` → **Crear** de nuevo / **Actualizar**.
Baja `ghcr.io/alvaroferan/lacorte-fichaje:latest`.

No borres la carpeta `docker/lacorte/data`: ahí están las horas.

---

## Si algo no va

| Qué ves | Qué mirar |
|---|---|
| No baja la imagen / unauthorized | La imagen sigue privada. Change visibility → Public. |
| Contenedor se para | Logs. Casi siempre: no existe `/volume1/docker/lacorte/data` o no puede escribir (usuario 1026). |
| El navegador no carga | Puerto 3000 ocupado o cortafuegos. Prueba `http://IP:3000/api/salud`. |
| Aviso «no segura» | Normal: es `http`. En la oficina se ignora. No impide fichar. |

---

## Licencia

Se puede descargar y usar en el NAS del estudio. No se puede modificar, vender
ni redistribuir. Texto: `LICENSE` en el repo.
