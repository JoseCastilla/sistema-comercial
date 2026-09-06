# SPEC-046 — Verificación

## Repositorio (06/09/2026, local)

1. **Compilación y pruebas** — API: `nest build` en verde, 89 pruebas en 15
   suites (la prueba de `ghl-webhook.service` ahora espera `markFailed` con
   el motivo). Worker: build, lint (`--max-warnings 0`) y su prueba en verde.
   Web: tipos y lint limpios; 182 pruebas.
2. **Rutas de mantenimiento** (AC-001, AC-002):
   - Web `POST /api/internal/maintenance`: sin secreto → **401**; con secreto
     → 200 con `organizations[distribuidor-online].jobs` =
     `agr-delivery-sync ok`, `expire-unverified-cases ok (0)`,
     `release-waiting-base-cases ok (0)`, `return-stale-base-cases ok (0)`,
     en 0,6 s.
   - API `POST /api/v1/internal/maintenance/webhooks-retry` (API compilada y
     arrancada en local): sin secreto → **401**; con secreto → 200 con
     `{candidates: 0, processed: 0, failed: 0}` (la base local no tiene
     eventos fallidos).
3. **Migración** (AC-005): `prisma migrate deploy` aplicó
   `20260906090000_drop_mobile_debt_leftovers`; después, 0 tablas
   `mobile_debt%` y 0 tipos `MobileDebt%` en el Postgres local.
4. **Copia y ensayo de restauración** (AC-004), con Docker contra el
   Postgres local:
   - Imagen `infra/backup` construida; `RUN_ONCE=1` produjo
     `sistema-comercial-20260906-0808.dump` (2,2 MB) en el volumen, con
     «índice verificado» por `pg_restore --list`.
   - Restauración en la base de ensayo `sistema_comercial_ensayo` y conteo:
     `organizations 1 = 1`, `dito_orders 177 = 177`, `recovery_cases 1 992 =
     1 992` frente al origen. La base de ensayo se eliminó al terminar.
5. **Configuración** (AC-006): `.env.example` cubre las 14 variables que el
   código lee más las 6 nuevas de mantenimiento y copia; `turbo.json` ya no
   declara `AUTH_BOOTSTRAP_TOKEN`.

## Producción

Pendiente de que José cree los servicios **worker** y **backup** en EasyPanel
y ponga `MAINTENANCE_INTERNAL_SECRET` en web y api (spec §4). Hasta entonces
la web y la API despliegan con las rutas nuevas cerradas (responden 503 sin
el secreto configurado) y las páginas siguen ejecutando los trabajos al
abrirse, como antes. La migración de limpieza corre sola en el arranque de
la API.
