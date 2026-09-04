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

# La verificación de nueve paquetes escupe decenas de miles de caracteres.
# Volcarlos sería gastar en ruido justo lo que este script viene a ahorrar:
# en verde basta una línea, y solo si algo falla importa el detalle.
verificar() {
  local etapa="$1"
  local registro
  registro="$(mktemp)"

  # Turbo cachea: repetir la verificación tras el merge cuesta segundos.
  if pnpm test >"$registro" 2>&1 &&
    pnpm lint >>"$registro" 2>&1 &&
    pnpm check-types >>"$registro" 2>&1; then
    echo "✓ $etapa"
    rm -f "$registro"
    return 0
  fi

  echo "✗ $etapa" >&2
  tail -n 40 "$registro" >&2
  echo "  registro completo en $registro" >&2
  return 1
}

# El mensaje viaja por archivo. `git merge -F -` no lee la entrada estándar
# —lo aprendimos con una entrega a medio camino—, y usar el mismo camino en
# el commit y en el merge evita volver a tropezar.
REDACCION="$(mktemp)"
trap 'rm -f "$REDACCION"' EXIT

if [ "$VERIFICAR" -eq 1 ]; then
  verificar "Verificado el cambio (pruebas, lint, tipos)"
else
  echo "→ Verificación saltada por --sin-verificar"
fi

echo "→ Rama $RAMA"
git checkout -b "$RAMA" 2>/dev/null || git checkout "$RAMA"
# `git add` avisa de cada final de línea convertido: ruido, no información.
git add -A 2>/dev/null
{
  printf '%s\n\n' "$MENSAJE"
  printf 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\n'
} >"$REDACCION"
git commit -q -F "$REDACCION"

# Un push puede fallar informando "reference already exists" cuando en
# realidad llegó: pasó una vez y cortó la entrega a mitad. Si el remoto ya
# apunta a este commit, el trabajo está hecho y se sigue.
if ! git push -q -u origin "$RAMA" 2>/dev/null; then
  if [ "$(git ls-remote --heads origin "$RAMA" | cut -f1)" = "$(git rev-parse HEAD)" ]; then
    echo "  (el remoto ya tenía este commit)"
    git branch --set-upstream-to="origin/$RAMA" "$RAMA" >/dev/null 2>&1 || true
  else
    echo "✗ No se pudo publicar la rama $RAMA" >&2
    git push -u origin "$RAMA" >&2
    exit 1
  fi
fi

if [ "$SOLO_RAMA" -eq 1 ]; then
  echo "✓ Rama publicada. main sin tocar."
  git log --oneline -1
  exit 0
fi

echo "→ Integrando en main"
git checkout -q main
git pull -q --ff-only
{
  printf 'Merge: %s\n\n' "$(printf '%s' "$MENSAJE" | head -1)"
  printf 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\n'
} >"$REDACCION"
git merge --no-ff "$RAMA" -F "$REDACCION" >/dev/null

if [ "$VERIFICAR" -eq 1 ]; then
  # Lo que se publica es main integrado, no la rama: es lo que hay que probar.
  verificar "Verificado main ya integrado"
fi

git push -q origin main

REMOTO="$(git remote get-url origin | sed -e 's/\.git$//' -e 's#^git@github\.com:#https://github.com/#')"
echo "✓ Entregado en main"
echo "  $REMOTO/commit/$(git rev-parse --short HEAD)"
echo
echo "  EasyPanel despliega api y web desde main: esto ya va a producción."
