# SPEC-046 — Operación de la plataforma: reloj, copias y acceso

Estado: **entregada; rutas verificadas en producción, servicios worker y
backup pendientes de crear en EasyPanel** (06/09/2026). Fase 0 del plan transversal
(SPEC-045), abierta como spec propia porque toca operación y no producto.
Nace de la revisión de integridad del 05/09/2026
(`docs/revisiones/2026-09-05-integridad-plataforma.md`, hallazgos 1 a 9).

## 1. Origen

La plataforma promete reglas con reloj —sincronizar con Máximo a las 08:15,
13:15 y 18:15; vencer casos sin verificar a los siete días; devolver al pool
los asignados sin gestión; liberar los que esperaban un pedido— y las cumplía
solo cuando alguien abría una página. Los eventos de GHL que fallaban al
proyectarse quedaban en `FAILED` sin motivo y sin reintento. No existía
ninguna copia de seguridad de la base de datos. Dos tablas de una función
revertida seguían en producción con credenciales y teléfonos. Y las
variables de entorno no tenían fuente de verdad.

## 2. Reglas

- **BR-001 · El worker es el reloj.** `apps/worker` llama cada
  `MAINTENANCE_INTERVAL_MINUTES` (5) a `POST /api/internal/maintenance` de la
  web, que corre para cada organización activa: sincronización AGR
  programada, vencimiento de casos sin verificar, liberación de casos en
  espera y retorno al pool. La ruta exige `MAINTENANCE_INTERNAL_SECRET`
  (comparación en tiempo constante) y devuelve qué corrió y qué falló por
  organización; las páginas conservan sus llamadas porque los trabajos son
  idempotentes: si el worker cae, nada se pierde, solo se retrasa.
- **BR-002 · Límite de intentos explícito.** Better Auth ya limitaba en
  producción por defecto (3 accesos cada 10 s por IP); ahora queda escrito y
  algo más estricto: 5 accesos por minuto y 3 solicitudes de restablecimiento
  cada 5 minutos, con 100 peticiones por minuto para el resto. MFA queda para
  una fase posterior: exige un flujo de enrolamiento con interfaz.
- **BR-003 · Los webhooks fallidos se reintentan y dicen por qué.**
  `markFailed` guarda `lastError`; `POST /api/v1/internal/maintenance/
  webhooks-retry` (mismo secreto) vuelve a proyectar hasta 50 eventos en
  `FAILED` con menos de 5 intentos, reclamando cada uno de forma atómica. El
  worker lo llama en cada pasada.
- **BR-004 · Copia diaria, restauración ensayada.** Servicio `infra/backup`
  (imagen `postgres:17-alpine`): `pg_dump` en formato personalizado a las
  `BACKUP_HOUR` (03:00 de Lima) sobre un volumen `/backups`, verifica el
  índice de la copia con `pg_restore --list` y aplica retención de
  `BACKUP_RETENTION_DAYS` (14). `RUN_ONCE=1` hace una copia y termina.
  `scripts/restaurar-copia.sh` restaura en una base de ensayo y cuenta filas;
  se niega a apuntar a la base real. Una copia que nunca se restauró no es
  una copia: el ensayo se registra en la verificación.
- **BR-005 · Sin tablas huérfanas.** Migración `drop_mobile_debt_leftovers`
  retira `mobile_debt_integrations`, `mobile_debt_lookup_events` y sus tres
  enums (función revertida en `fccbf13`; no es evidencia de negocio). La
  migración aplicada no se reescribe (SPEC-037 BR-002).
- **BR-006 · Fuente única de variables.** `.env.example` en la raíz lista
  todas las variables por servicio con su propósito; `turbo.json` deja de
  declarar `AUTH_BOOTSTRAP_TOKEN` (sin uso) y declara las que faltaban.

## 3. Decisiones asumidas

- El worker no toca la base de datos: llama a web y api por HTTP con el
  secreto. Así las reglas viven donde ya vivían y el worker no duplica
  código ni dependencias; el coste es que web y api deben estar arriba,
  cosa que ya exige el negocio.
- Sin `@nestjs/schedule`: un `setInterval` con protección contra solape
  basta para un solo worker. Si algún día hay dos réplicas, el reclamo
  atómico de eventos y las claves de programación de AGR ya evitan el
  doble trabajo.
- Las copias se guardan en un volumen del mismo servidor. Copiarlas fuera
  (otro servidor o un bucket) es el paso siguiente y queda como tarea, con
  la advertencia de que hoy un fallo del disco se lleva base y copias.
- `Organization.timezone` sigue sin gobernar cálculos: fuera de alcance.

## 4. Lo que José debe hacer en EasyPanel (no vive en el repositorio)

1. Crear el servicio **worker** desde `apps/worker/Dockerfile` con
   `WEB_INTERNAL_URL`, `API_INTERNAL_URL` (URLs internas de la red de
   EasyPanel), `MAINTENANCE_INTERNAL_SECRET` y `NODE_ENV=production`.
2. Añadir `MAINTENANCE_INTERNAL_SECRET` (mismo valor) a **web** y **api**.
3. Crear el servicio **backup** desde `infra/backup/Dockerfile` con
   `DATABASE_URL` y un volumen persistente en `/backups`; probarlo una vez
   con `RUN_ONCE=1` y guardar el primer `.dump` fuera del servidor.
4. Programar cada mes un ensayo de restauración con
   `scripts/restaurar-copia.sh` contra una base de ensayo.

## 5. Criterios de aceptación

- **AC-001:** `POST /api/internal/maintenance` sin secreto responde 401 y con
  el secreto devuelve por organización los cuatro trabajos con `ok`.
- **AC-002:** `POST /api/v1/internal/maintenance/webhooks-retry` con secreto
  devuelve `{candidates, processed, failed}`; un evento que falla queda con
  `lastError` no nulo.
- **AC-003:** el worker compila, pasa lint y su prueba, y registra una
  línea por pasada con el resumen o el error.
- **AC-004:** `RUN_ONCE=1` produce un `.dump` verificado; el ensayo de
  restauración en una base aparte devuelve conteos de `organizations`,
  `dito_orders` y `recovery_cases` iguales a los del origen.
- **AC-005:** tras la migración no quedan tablas ni tipos `mobile_debt`.
- **AC-006:** `.env.example` cubre todas las variables que el código lee.
