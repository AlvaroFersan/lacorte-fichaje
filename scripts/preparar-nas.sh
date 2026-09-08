# Prepara .env y la carpeta data/ para Docker en el NAS.
# Uso: ./scripts/preparar-nas.sh

set -eu
DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$DIR"

mkdir -p data

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Creado .env a partir de .env.example"
fi

if grep -q 'cambia-esta-frase-por-una-aleatoria-larga' .env; then
  SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)"
  # portable: reemplaza la línea SESSION_SECRET
  tmp="$(mktemp)"
  awk -v s="$SECRET" '
    BEGIN { done=0 }
    /^SESSION_SECRET=/ { print "SESSION_SECRET=" s; done=1; next }
    { print }
    END { if (!done) print "SESSION_SECRET=" s }
  ' .env > "$tmp"
  mv "$tmp" .env
  echo "SESSION_SECRET generado."
else
  echo "SESSION_SECRET ya estaba puesto. No lo toco."
fi

chmod 777 data 2>/dev/null || true
echo "Listo. En el PC: npm start o docker compose. El NAS usa GitHub + docker-compose.yml."
echo "En el navegador: http://localhost:3000  (o IP-DEL-NAS:3000)"
