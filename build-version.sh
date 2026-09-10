#!/usr/bin/env bash
# ============================================================
# BAREMO - sellado de version
#
# Problema que resuelve: el numero de version estaba escrito a mano en
# 10 archivos distintos (66 lugares). Alcanzaba con olvidarse de uno para
# que la app quedara mostrando una version y el service worker cacheando
# otra. Ahora VERSION es la unica fuente de verdad.
#
# Uso:
#     bash build-version.sh 5.9.25
#     bash build-version.sh          # reaplica la que ya esta en VERSION
#
# Solo toca numeros de version. No modifica datos ni logica.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

ANTERIOR="$(tr -d ' \n\r' < VERSION)"
NUEVA="${1:-$ANTERIOR}"

if ! [[ "$NUEVA" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version invalida: '$NUEVA' (se espera algo como 5.9.25)" >&2
  exit 1
fi

echo "Version anterior : $ANTERIOR"
echo "Version nueva    : $NUEVA"

if [ "$ANTERIOR" != "$NUEVA" ]; then
  for f in index.html landing.html manifest.json service-worker.js app.js main.js brand.js styles.css landing.css version.json; do
    [ -f "$f" ] || continue
    sed -i.bak "s/${ANTERIOR//./\\.}/$NUEVA/g" "$f" && rm -f "$f.bak"
  done
  printf '%s\n' "$NUEVA" > VERSION
fi

echo
echo "Verificacion:"
if grep -rIl --exclude-dir=vendor --exclude-dir=.git "${ANTERIOR//./\\.}" . >/dev/null 2>&1 && [ "$ANTERIOR" != "$NUEVA" ]; then
  echo "  AVISO: quedaron referencias a $ANTERIOR en:"
  grep -rIl --exclude-dir=vendor --exclude-dir=.git "${ANTERIOR//./\\.}" . | sed 's/^/    /'
else
  echo "  OK, no quedan referencias a la version anterior."
fi

for f in *.js; do node --check "$f" >/dev/null && echo "  sintaxis OK: $f"; done
for f in *.json; do python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$f" && echo "  json OK: $f"; done

echo
echo "Listo: todo el proyecto quedo en la version $NUEVA"
