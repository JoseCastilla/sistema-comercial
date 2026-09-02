#!/usr/bin/env bash
#
# Entrega un cambio: verifica, commitea en una rama, la integra en main y
# publica. Toda la secuencia en un comando.
#
# El mensaje del commit se lee de la entrada estándar, para poder escribirlo
# en varias líneas sin pelearse con las comillas:
#
#   ./scripts/entregar.sh feat/mi-cambio <<'MSG'
#   feat(area): el título en una línea
#
#   El porqué del cambio.
#   MSG
#
# Opciones:
#   --sin-verificar   salta pruebas, lint y tipos (solo para docs)
#   --solo-rama       publica la rama y no toca main
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

VERIFICAR=1
SOLO_RAMA=0
RAMA=""

for arg in "$@"; do
  case "$arg" in
    --sin-verificar) VERIFICAR=0 ;;
    --solo-rama) SOLO_RAMA=1 ;;
    -*) echo "Opción desconocida: $arg" >&2; exit 2 ;;
    *) RAMA="$arg" ;;
  esac
done

if [ -z "$RAMA" ]; then
  echo "Falta el nombre de la rama. Ejemplo:" >&2
  echo "  ./scripts/entregar.sh feat/mi-cambio <<'MSG'" >&2
  exit 2
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "No hay nada que entregar: el árbol está limpio." >&2
  exit 1
fi

MENSAJE="$(cat)"

if [ -z "${MENSAJE// }" ]; then
  echo "El commit necesita un mensaje. Pásalo por la entrada estándar." >&2
  exit 2
fi

verificar() {
  echo "→ $1"
  # Turbo cachea: repetir la verificación tras el merge cuesta segundos.
  pnpm test
  pnpm lint
  pnpm check-types
}

if [ "$VERIFICAR" -eq 1 ]; then
  verificar "Verificando el cambio (pruebas, lint, tipos)"
else
  echo "→ Verificación saltada por --sin-verificar"
fi

echo "→ Rama $RAMA"
git checkout -b "$RAMA" 2>/dev/null || git checkout "$RAMA"
git add -A
printf '%s\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n' "$MENSAJE" |
  git commit -q -F -
git push -q -u origin "$RAMA"

if [ "$SOLO_RAMA" -eq 1 ]; then
  echo "✓ Rama publicada. main sin tocar."
  git log --oneline -1
  exit 0
fi

echo "→ Integrando en main"
git checkout -q main
git pull -q --ff-only
TITULO="$(printf '%s' "$MENSAJE" | head -1)"
printf 'Merge: %s\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n' "$TITULO" |
  git merge --no-ff "$RAMA" -F - >/dev/null

if [ "$VERIFICAR" -eq 1 ]; then
  # Lo que se publica es main integrado, no la rama: es lo que hay que probar.
  verificar "Verificando main ya integrado"
fi

git push -q origin main

REMOTO="$(git remote get-url origin | sed -e 's/\.git$//' -e 's#^git@github\.com:#https://github.com/#')"
echo "✓ Entregado en main"
echo "  $REMOTO/commit/$(git rev-parse --short HEAD)"
echo
echo "  El servidor de producción no se actualiza solo: falta ese paso."
