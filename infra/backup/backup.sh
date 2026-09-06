#!/bin/sh
# Una copia de seguridad: pg_dump en formato personalizado (restaurable con
# pg_restore, tabla por tabla si hace falta), comprimida, con el nombre del
# momento en hora de Lima. Al final borra las copias más antiguas que la
# retención. Falla ruidosamente si falta DATABASE_URL o si el dump no sale.
set -eu

: "${DATABASE_URL:?DATABASE_URL es obligatoria}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

STAMP="$(TZ=America/Lima date +%Y%m%d-%H%M)"
TARGET="$BACKUP_DIR/sistema-comercial-$STAMP.dump"
TEMP="$TARGET.parcial"

echo "[$(date -u +%FT%TZ)] copia → $TARGET"

# --no-owner y --no-privileges: el restore no depende del usuario original.
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="$TEMP"

mv "$TEMP" "$TARGET"

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "[$(date -u +%FT%TZ)] copia lista ($SIZE)"

# La copia recién hecha se verifica leyendo su índice: si pg_restore no puede
# listarla, el archivo no sirve y hay que enterarse hoy, no el día del restore.
pg_restore --list "$TARGET" >/dev/null
echo "[$(date -u +%FT%TZ)] índice verificado"

# Retención: se borran solo archivos de copia, nunca otra cosa del volumen.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'sistema-comercial-*.dump' \
  -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/borrada por retención: /'

echo "[$(date -u +%FT%TZ)] copias en el volumen:"
ls -1 "$BACKUP_DIR"/sistema-comercial-*.dump 2>/dev/null | tail -n 5
