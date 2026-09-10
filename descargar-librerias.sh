#!/usr/bin/env bash
# ============================================================
# BAREMO - descarga las librerias externas a ./vendor
# Correr una sola vez desde una maquina con internet:
#     bash descargar-librerias.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor

descargar() {
  local url="$1" destino="vendor/$2"
  echo "-> $2"
  curl -fsSL "$url" -o "$destino"
  echo "   integrity sha384-$(openssl dgst -sha384 -binary "$destino" | openssl base64 -A)"
}

descargar "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"                       "chart.umd.min.js"
descargar "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"                          "jspdf.umd.min.js"
descargar "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.6.0/dist/jspdf.plugin.autotable.min.js"    "jspdf.plugin.autotable.min.js"
descargar "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"                          "xlsx.full.min.js"

echo
echo "Listo. Las 4 librerias quedaron en ./vendor y la app ya no depende del CDN."
