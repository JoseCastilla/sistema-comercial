# SPEC-045 — Verificación

## Fase 1 (06/09/2026)

1. **Pruebas** — 182 en verde en `apps/web` (2 nuevas, `campanas-etapas`) y
   318 en `@repo/validation` (2 nuevas, `recovery-internal-due-filter`):
   «vencido» es filtro y no vencimiento; abre los tres vencimientos y nada
   más; los nombres de etapa no se repiten y cada uno abre su destino. Tipos
   y lint limpios.
2. **Recorrido local con sesión de administrador** (José la abrió tras la
   entrega):
   - PL-02: `/api/order-escalations/notifications` → `recoveryOverdue: 1`;
     `/recovery/sales?vence=vencido` → «Cualquier vencimiento: 1 caso · 1
     caso(s) cumplen el filtro»; el selector ofrece «Cualquier vencimiento»
     antes de los tres vencimientos (AC-001).
   - PL-03: Preparar «Falta consultar 0 · Verificados por entregar 0 · Con
     pedido en curso 0 · Disponibles para asignar 0 · En gestión 38 ·
     Recuperados 0»; Revisar y Repartir con los mismos nombres; cada contador
     enlaza a `triage?view=…`, `distribute?view=…` o `follow-up` (AC-002).
   - PL-05: «Un equipo no tiene supervisor: administración cubre su cuota y su
     recupero mientras no lo tenga. Asignar supervisor» →
     `/admin/teams?sinSupervisor=1`; la fila de EXTERNOS enlaza «Sin
     supervisor · lo cubre administración» → `/admin/teams?equipo=<id>`
     (AC-003). Se retiró un enlace «Repartir su cuota» que duplicaba «Asignar
     cuotas» en la misma cabecera.
   - PL-06: «Pedidos que requieren acción 9» → `/orders?status=LOGISTICS` →
     **9 órdenes** (AC-004).
3. **Lectura de producción con sesión de administrador** (solo lectura, tras
   el despliegue de `c146d67`):
   - PL-02: alerta «⏰ 70 recupero(s) vencido(s)» → `/recovery/sales?vence=
     vencido` → «Cualquier vencimiento: 70 casos · 70 caso(s) cumplen el
     filtro»; `recoveryOverdue: 70` (AC-001).
   - PL-03: Preparar «Falta consultar 396 · Verificados por entregar 270 · Con
     pedido en curso 34 · Disponibles para asignar 186 · Recuperados 2»;
     Revisar «Verificados por entregar 270 · Falta consultar 396 · Con pedido
     en curso 34 · Disponibles para asignar 186»; Repartir «Disponibles para
     asignar 186 · Asignados sin gestión 305 · En gestión 1 284 · En revisión
     700» (= 396 + 270 + 34). Los 270 y 186 del plan ya no se confunden
     (AC-002). **Hallazgo corregido en el mismo recorrido**: «En gestión» daba
     1 589 en Preparar y 1 284 en Repartir porque Preparar sumaba los 305
     asignados sin gestión; Preparar adopta la definición de Repartir y
     muestra «Asignados sin gestión» aparte.
   - PL-05: «2 equipos no tienen supervisor: administración cubre su cuota y
     su recupero mientras no lo tenga. Asignar supervisor» →
     `/admin/teams?sinSupervisor=1`; las filas de MAGISTERIAL 01 y EXTERNOS
     enlazan a su tarjeta (AC-003).
   - PL-06: «Pedidos que requieren acción 347» → `/orders?status=LOGISTICS`
     → «50 en esta página de **347** encontradas» (AC-004).
