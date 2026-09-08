#!/bin/sh
# Copia diaria de la base en el NAS (volumen de Docker).
# Programador de tareas de Synology → script definido por el usuario.
# Conserva 14 días.

set -eu
DATA="${DATA:-/volume1/docker/lacorte/data}"
ORIGEN="${RUTA_DB:-$DATA/fichaje.db}"
DEST="$DATA/copias"
mkdir -p "$DEST"

if [ ! -f "$ORIGEN" ]; then
  echo "No encuentro la base en $ORIGEN"
  exit 1
fi

STAMP=$(date +%Y-%m-%d)
DESTINO="$DEST/fichaje-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$ORIGEN" ".backup '$DESTINO'"
else
  cp "$ORIGEN" "$DESTINO"
  [ -f "$ORIGEN-wal" ] && cp "$ORIGEN-wal" "$DESTINO-wal"
fi

find "$DEST" -name 'fichaje-*.db' -mtime +14 -delete
echo "Copia hecha: $DESTINO"
