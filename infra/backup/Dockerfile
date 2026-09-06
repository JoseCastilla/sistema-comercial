# SPEC-046 BR-004: copia de seguridad diaria de PostgreSQL.
#
# Servicio aparte en EasyPanel con un volumen montado en /backups. Cada día a
# la hora indicada (BACKUP_HOUR, hora de Lima, 03 por defecto) hace un
# `pg_dump` en formato personalizado, lo comprime y borra las copias más
# antiguas que BACKUP_RETENTION_DAYS (14 por defecto). Con RUN_ONCE=1 hace una
# copia y termina: sirve para probar y para el ensayo de restauración.
FROM postgres:17-alpine

RUN apk add --no-cache tzdata

ENV TZ=America/Lima
ENV BACKUP_DIR=/backups
ENV BACKUP_HOUR=03
ENV BACKUP_RETENTION_DAYS=14

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh \
  && mkdir -p /backups

VOLUME ["/backups"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
