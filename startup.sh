#!/bin/sh
set -eu
# Funciona tanto com o repositório na raiz do sandbox quanto em /workspace/reta-android.
cd "$(dirname "$0")"
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
