# SPEC-046 — Plan

- **Web**: `app/api/internal/maintenance/route.ts` (secreto en tiempo
  constante; corre los cuatro trabajos por organización activa y devuelve el
  resultado o el error de cada uno). `server/auth/auth.ts`: `rateLimit`
  explícito.
- **API**: `webhook-events.repository.ts` (`markFailed` con `lastError`,
  `findRetryable`); `ghl-webhook.service.ts` (`retryFailed`, tope de 5
  intentos, lotes de 50); `maintenance.controller.ts` en `WebhooksModule`
  (`POST internal/maintenance/webhooks-retry`).
- **Worker**: `worker.service.ts` con pasada cada N minutos, sin solape, que
  llama a web y api y registra un resumen legible; `apps/worker/Dockerfile`
  sin puertos ni migraciones.
- **Base de datos**: migración `20260906090000_drop_mobile_debt_leftovers`.
- **Copias**: `infra/backup/{Dockerfile,backup.sh,entrypoint.sh}` y
  `scripts/restaurar-copia.sh`.
- **Configuración**: `.env.example`; `turbo.json` `globalEnv` saneado; nota
  de corrección en la revisión del 05/09 (el límite de intentos existía por
  defecto).
- **Despliegue**: dos servicios nuevos en EasyPanel (worker, backup) y un
  secreto nuevo en web y api; ver spec §4.

## Verificación

Compilación, lint y pruebas de api, worker y web; migración aplicada en
local con comprobación de tablas y tipos; copia real con `RUN_ONCE=1` contra
el Postgres local y ensayo de restauración en una base aparte con conteo de
filas; rutas de mantenimiento probadas con y sin secreto en local.
