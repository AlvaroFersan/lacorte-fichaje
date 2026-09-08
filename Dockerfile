# Imagen fija (no "latest"): el NAS tiene que poder reconstruir esto
# dentro de un año y obtener el mismo resultado.
# Compilamos better-sqlite3 en un paso y el contenedor final no lleva
# compiladores ni secretos.

FROM node:22.19.0-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22.19.0-bookworm-slim
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node web ./web
COPY --chown=node:node prototipo ./prototipo

RUN mkdir -p /data \
  && chown node:node /data

USER node
ENV NODE_ENV=production
ENV RUTA_DB=/data/fichaje.db
ENV PUERTO=3000

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server/index.js"]
