# Imagen fija (no "latest"): el NAS tiene que poder reconstruir esto
# dentro de un año y obtener el mismo resultado.
FROM node:22.19.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y --purge \
  && rm -rf /var/lib/apt/lists/* /root/.npm

COPY server ./server
COPY web ./web
COPY prototipo ./prototipo

RUN mkdir -p /data \
  && chown -R node:node /app /data

USER node
ENV NODE_ENV=production
ENV RUTA_DB=/data/fichaje.db
ENV PUERTO=3000

EXPOSE 3000
CMD ["node", "server/index.js"]
