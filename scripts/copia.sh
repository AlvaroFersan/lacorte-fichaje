#!/bin/sh
# Copia diaria del archivo SQLite. En el NAS, ponla en el programador de tareas
# (Synology: "Programador de tareas" → script definido por el usuario).
# Conserva 14 días. El archivo vive en data/ porque es un volumen del contenedor.

set -eu
DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ORIGEN="${RUTA_DB:-$DIR/data/fichaje.db}"
DEST="$DIR/data/copias"
mkdir -p "$DEST"

if [ ! -f "$ORIGEN" ]; then
  echo "No encuentro la base en $ORIGEN"
  exit 1
fi

# sqlite3 .backup es más seguro que copiar el archivo a pelo si alguien está fichando
STAMP=$(date +%Y-%m-%d)
DESTINO="$DEST/fichaje-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$ORIGEN" ".backup '$DESTINO'"
else
  cp "$ORIGEN" "$DESTINO"
  [ -f "$ORIGEN-wal" ] && cp "$ORIGEN-wal" "$DESTINO-wal"
fi

# borra copias de hace más de 14 días
find "$DEST" -name 'fichaje-*.db' -mtime +14 -delete
echo "Copia hecha: $DESTINO"
