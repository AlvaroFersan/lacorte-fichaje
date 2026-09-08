# Cómo montar La Corte en el NAS

Esto es la app de fichaje y producción del estudio. Vive en el NAS de la oficina.
No hace falta un `.bat` ni copiar carpetas a mano: el NAS **clona este repositorio
de GitHub** y arranca con el archivo `docker-compose.yml`.

Cuando termine, en cualquier ordenador de la red de la oficina se abre:

`http://IP-DEL-NAS:3000`

Las cuentas de acceso **no están escritas aquí**. Las da quien administra el estudio.

---

## Qué hace falta

1. Un NAS con **Docker** (en Synology se llama **Container Manager**;
   en QNAP, **Container Station**).
2. Este repositorio, que es público:

   https://github.com/AlvaroFersan/lacorte-fichaje

3. Que la **imagen** también sea pública (si no, el NAS no puede bajarla).
   Entra con la cuenta de GitHub que publicó el repo:

   https://github.com/users/AlvaroFersan/packages/container/package/lacorte-fichaje/settings

   Abajo del todo, **Change visibility** → **Public**.
   (Esto solo se hace una vez. Después no se puede volver a privado.)

4. El puerto **3000** libre en el NAS. Si está ocupado, más abajo se cambia.

No hace falta un archivo `.env`. El contenedor crea solo el secreto de sesión
en la carpeta `data/` y lo reutiliza al reiniciar. Ahí también se guarda la
base de datos (`fichaje.db`): las horas no se pierden si recreas el contenedor.

---

## Synology (Container Manager)

### 1. Instalar Container Manager

Panel de control → **Centro de paquetes** → busca **Container Manager** → Instalar.
Si ya está, sigue.

### 2. Crear el proyecto desde GitHub

1. Abre **Container Manager**.
2. En el menú izquierdo, **Proyecto**.
3. **Crear**.
4. Nombre del proyecto: `lacorte` (o el que quieras).
5. Ruta: una carpeta del NAS, por ejemplo `docker/lacorte`.
   Container Manager la puede crear. Debe poder escribirse: ahí nacerá `data/`.
6. Origen del archivo de composición: **Git** (a veces dice «Repositorio Git»).
7. URL:

   `https://github.com/AlvaroFersan/lacorte-fichaje.git`

8. Rama: `main`.
9. El archivo que tiene que detectar es **`docker-compose.yml`**, en la raíz
   del repo (no `docker-compose.build.yml`; ese es solo para un PC de desarrollo).
10. Si pide usuario y contraseña de GitHub: este repo es **público**, se puede
    dejar vacío. Si el NAS lo exige, un usuario de GitHub vale, sin token especial.
11. Crea / construye / inicia.

Lo que ocurre por dentro: el NAS lee el YAML, baja la imagen
`ghcr.io/alvaroferan/lacorte-fichaje:latest` desde GitHub y levanta el contenedor.
No tiene que ir a Docker Hub.

### 3. Si pide un registro de imágenes (ghcr.io)

Algunos NAS, la primera vez, no bajan `ghcr.io` hasta que añades el registro:

1. Container Manager → **Registro** (o Image / Registro).
2. Añadir: servidor `ghcr.io`.
3. Si la imagen ya es pública, no hace falta usuario. Si falla con «unauthorized»
   o «denied», la imagen sigue privada: vuelve al paso de **Change visibility**.

### 4. Comprobar que está en marcha

En **Proyecto** o **Contenedor** debe aparecer `lacorte-fichaje` en verde / Running.
Si está en rojo, abre los registros (logs) y mira el mensaje.

En un navegador de la oficina:

1. Averigua la IP del NAS: **Panel de control** → **Red** (o Centro de información).
   Suele ser algo como `192.168.1.50`.
2. Abre: `http://ESA-IP:3000`
3. Debe salir la pantalla de entrar de La Corte.
4. Prueba también: `http://ESA-IP:3000/api/salud`
   Tiene que responder `ok: true`.

### 5. Puerto 3000 ocupado

En las variables del proyecto (o en un `.env` junto al compose, en la carpeta
del proyecto del NAS) pon:

`PUERTO=3001`

Vuelve a crear / iniciar. Entonces la web es `http://IP-DEL-NAS:3001`.

Si el **cortafuegos** del NAS está activo, abre el puerto 3000 (o el que uses)
solo para la red de la oficina, no a internet.

---

## QNAP (Container Station)

1. Abre **Container Station**.
2. Crear aplicación / Compose.
3. Origen Git: `https://github.com/AlvaroFersan/lacorte-fichaje.git`
4. Compose: `docker-compose.yml`, rama `main`.
5. Inicia. El resto es igual: `http://IP-DEL-NAS:3000`.

---

## Actualizar la app (cuando haya código nuevo)

1. En GitHub, el flujo **Imagen NAS** (pestaña Actions) tiene que terminar **en verde**.
   Eso publica la imagen nueva.
2. En el NAS: Proyecto `lacorte` → **Actualizar** / recrear / volver a iniciar.
   El compose tiene `pull_policy: always`: baja la imagen `latest` otra vez.

No uses «eliminar volúmenes» ni borres la carpeta `data/`: ahí están las horas.

---

## Si algo no va

| Qué ves | Qué mirar |
|---|---|
| El proyecto no clona el Git | URL mal copiada. Tiene que acabar en `.git`. Repo: https://github.com/AlvaroFersan/lacorte-fichaje |
| «unauthorized» / no baja la imagen | La imagen de GitHub sigue privada. Change visibility → Public (enlace arriba). |
| Contenedor se para al instante | Logs del contenedor. Casi siempre: carpeta `data/` sin permiso de escritura. |
| El navegador no carga | IP incorrecta, puerto 3000 ocupado, o cortafuegos del NAS. |
| Aviso de «conexión no segura» | Normal: es `http`, no `https`. En la red de la oficina se puede ignorar. No impide fichar. |
| Página en blanco / error 502 | El contenedor aún no ha arrancado. Espera 20 segundos y recarga. |

Registros por SSH (si lo usáis), dentro de la carpeta del proyecto:

```sh
docker compose ps
docker compose logs -f --tail=80
```

---

## Licencia

Se puede descargar y usar en el NAS del estudio. No se puede modificar, vender
ni redistribuir. Texto: archivo `LICENSE` en la raíz del repo.
