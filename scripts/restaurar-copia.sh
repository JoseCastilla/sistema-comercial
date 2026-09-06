#!/usr/bin/env sh
# Ensayo de restauración (SPEC-046 BR-004): una copia que nunca se restauró
# no es una copia. Restaura un .dump en una base VACÍA y distinta de la de
# producción, y cuenta filas de tres tablas para comprobar que hay datos.
#
#   ./scripts/restaurar-copia.sh <archivo.dump> <DATABASE_URL de la base de ensayo>
#
# Nunca apuntar a la base de producción: el script se niega si la URL
# contiene «prod» o el nombre de la base real del volcado.
set -eu

DUMP="${1:?falta el archivo .dump}"
TARGET_URL="${2:?falta la DATABASE_URL de la base de ensayo}"

case "$TARGET_URL" in
  *prod*|*sistema_comercial@*|*/sistema_comercial?*|*/sistema_comercial)
    echo "✗ Esa URL parece la base real. El ensayo va a una base aparte." >&2
    exit 2
    ;;
esac

echo "→ Restaurando $DUMP"
pg_restore \
  --dbname="$TARGET_URL" \
  --no-owner \
  --no-privileges \
  --clean --if-exists \
  --jobs=4 \
  "$DUMP"

echo "→ Filas restauradas:"
for TABLE in organizations dito_orders recovery_cases; do
  COUNT="$(psql "$TARGET_URL" --tuples-only --no-align --command "SELECT count(*) FROM \"$TABLE\";")"
  echo "  $TABLE: $COUNT"
done

echo "✓ Ensayo terminado. Anota la fecha y el resultado en la spec de operación."
