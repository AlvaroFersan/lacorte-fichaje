# Subir La Corte al NAS (GitHub + YAML)

El NAS no copia un `.bat`. Entra por **GitHub**: clona este repo y lee
`docker-compose.yml`. GitHub construye la imagen (workflow
`.github/workflows/imagen-nas.yml`) y el NAS la baja de `ghcr.io`.

## 1. En GitHub (una vez)

Repo **privado**. Al hacer push a `main`, Actions publica:

`ghcr.io/alvaroferan/lacorte-fichaje:latest`

Repo: https://github.com/AlvaroFersan/lacorte-fichaje

En el repo: **Packages** debe quedar enlazado al repositorio. Si la imagen
es privada, el NAS necesita un token (PAT) con `read:packages` y `repo`.

## 2. En el NAS (Synology Container Manager)

1. Gestor de contenedores → **Proyecto** → Crear.
2. Origen: **Git** / GitHub. URL del repo (HTTPS).
3. Usuario de GitHub + token (repo privado).
4. Debe detectar `docker-compose.yml` (este archivo, en la raíz).
5. Registro de imágenes: añade `ghcr.io` con el mismo usuario y token.
6. Carpeta `data/` dentro del proyecto: tiene que poder escribirse
   (ahí van `fichaje.db` y el secreto de sesión).
7. Construir / iniciar.

Navegador: `http://IP-DEL-NAS:3000`  
Cuentas: `alvaro` / `1234` y `jesus` / `1234`. Cámbialas al entrar.

No hace falta pegar un `.env`. El contenedor crea el secreto en `data/`
y lo reutiliza al reiniciar.

Si el puerto 3000 está ocupado, en las variables del proyecto: `PUERTO=3001`.

## 3. Actualizar

Push a GitHub → espera a que Actions termine en verde → en el NAS,
actualizar / recrear el proyecto (el compose tiene `pull_policy: always`).

## Comprobar

```sh
docker compose ps
docker compose logs -f --tail=80
```

Salud: `http://IP-DEL-NAS:3000/api/salud`

## Si no entra (cookie / «no segura»)

Es normal: el NAS sirve **http**. `COOKIE_SECURE=0` lo contempla.
El aviso del navegador no impide fichar en la red de la oficina.
