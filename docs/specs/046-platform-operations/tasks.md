# SPEC-046 — Tareas

## Repositorio (06/09/2026)

- [x] BR-001 · Ruta `POST /api/internal/maintenance` en web con los cuatro
      trabajos por organización.
- [x] BR-001 · Worker real: pasada periódica sin solape, resumen en el
      registro, Dockerfile.
- [x] BR-002 · `rateLimit` explícito en Better Auth.
- [x] BR-003 · `lastError` al fallar; `retryFailed` y ruta interna en la API.
- [x] BR-004 · Imagen de copia de seguridad, script de copia con verificación
      y retención, script de ensayo de restauración.
- [x] BR-005 · Migración que retira las tablas y tipos `mobile_debt`.
- [x] BR-006 · `.env.example` y `turbo.json` saneado.
- [x] Verificación local: rutas 401/200, copia de 2,2 MB verificada, ensayo
      de restauración 1 / 177 / 1 992 = origen, migración aplicada.

## Operación (José, en EasyPanel)

- [ ] Servicio **worker** con `WEB_INTERNAL_URL`, `API_INTERNAL_URL`,
      `MAINTENANCE_INTERNAL_SECRET`.
- [ ] `MAINTENANCE_INTERNAL_SECRET` en web y api.
- [ ] Servicio **backup** con `DATABASE_URL` y volumen en `/backups`; primera
      copia con `RUN_ONCE=1` guardada fuera del servidor.
- [ ] Ensayo mensual de restauración con `scripts/restaurar-copia.sh`.
- [ ] Validar las diez restricciones `NOT VALID` de agosto tras revisar el
      histórico (migración `VALIDATE CONSTRAINT`, spec aparte).

## Fase posterior

- [ ] MFA para ADMIN y BACKOFFICE (plugin `twoFactor` con enrolamiento).
- [ ] Copias fuera del servidor (bucket o segundo servidor).
- [ ] `proxy.ts` cubriendo todas las rutas autenticadas.
