#!/bin/sh
# Con RUN_ONCE=1 hace una copia y sale (prueba o ensayo). Si no, duerme hasta
# la próxima BACKUP_HOUR:00 de Lima, hace la copia y vuelve a esperar. Un
# fallo en una copia se registra y no mata el servicio: la siguiente noche
# se intenta de nuevo.
set -u

if [ "${RUN_ONCE:-0}" = "1" ]; then
  exec /usr/local/bin/backup.sh
fi

HOUR="${BACKUP_HOUR:-03}"

while true; do
  NOW="$(TZ=America/Lima date +%s)"
  TARGET="$(TZ=America/Lima date -d "$(TZ=America/Lima date +%Y-%m-%d) $HOUR:00:00" +%s 2>/dev/null || true)"

  if [ -z "$TARGET" ]; then
    # BusyBox sin -d: cae a esperar 24 h desde ahora.
    TARGET=$((NOW + 86400))
  fi

  if [ "$TARGET" -le "$NOW" ]; then
    TARGET=$((TARGET + 86400))
  fi

  WAIT=$((TARGET - NOW))
  echo "[$(date -u +%FT%TZ)] próxima copia en $WAIT s (a las $HOUR:00 de Lima)"
  sleep "$WAIT"

  if ! /usr/local/bin/backup.sh; then
    echo "[$(date -u +%FT%TZ)] la copia falló; se reintenta mañana" >&2
  fi
done
