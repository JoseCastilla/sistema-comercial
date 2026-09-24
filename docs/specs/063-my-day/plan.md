# SPEC-063 — Plan de implementación

## 1. Arquitectura

**Reunir, no recalcular.** «Mi día» lee cinco fuentes y pasa cada una por la
regla pura de su módulo (BR-002):

| Fuente | Consulta | Regla |
|---|---|---|
| Citas | `recoveryCaseCommitment` PENDING hasta el fin del día de Lima, de casos abiertos asignados al usuario, **de cualquier origen** | `placeMyDayCommitment` |
| Recupero de ventas | casos `INTERNAL_ORDER_STATE`/`MANUAL` asignados al usuario, sin cita pendiente | `classifyInternalRecoveryDue`, `describeInternalRecoveryStage`, `placeMyDaySalesRecovery` |
| Campaña | casos `NATIONAL_BASE` asignados al usuario, sin cita pendiente | `selectRecoveryAgendaItem`, `classifyRecoveryWorkItem`, `compareRecoveryWorkNow` (solo la vista «Ahora») |
| Pedidos | ventas del usuario (60 días, abiertas) en «Entregas fallidas por gestionar» o «Incidencias» | mismas condiciones que `getStatusFilter`; `getAgrAction` (ahora exportada) para la acción logística |
| Progreso | ventas del mes del usuario (cohorte por ingreso) | `calculatePerformanceMetrics`, `resolveRelevantAcceleratorWindow`, `getDefaultQuotaTarget`, `getPerformanceCommissionPolicy` |

**La única regla nueva es de ubicación**, en `@repo/validation/my-day.ts`:
tramo de urgencia, «ahora» o «más tarde hoy», orden (`compareMyDayItems`) y
el plazo en palabras (`describeMyDayDue`). Se prueba sola con fechas fijas
en Lima.

**Cita manda.** Las consultas de recupero y campaña excluyen los casos con
cita pendiente (`commitments: { none: { status: "PENDING" } }`); la cita los
trae una sola vez (BR-001, AC-002).

**Sin CSS nuevo en `patterns.css`** (BR-017): utilidades de Tailwind sobre
los tokens `--ui-*`, `<details>` nativo para lo plegable.

## 2. Archivos

- `packages/validation/src/my-day.ts` + `test/my-day.test.mjs`.
- `apps/web/src/features/my-day/server/get-my-day.ts`.
- `apps/web/src/features/my-day/components/`: `my-day-list.tsx`,
  `my-day-progress.tsx`, `my-day-refresh.tsx`.
- `apps/web/src/app/my-day/`: `page.tsx`, `layout.tsx`, `loading.tsx`,
  `error.tsx`.
- Entrada: `app/page.tsx` decide por rol; `app/login/page.tsx` y
  `login-form.tsx` vuelven a `/`.
- Menú: `commercial-app-shell.tsx` añade la sección `my-day` y el ítem «Mi
  día» primero para AGENT (lateral y móvil).
- `get-order-inbox.ts`: `getAgrAction` pasa a exportarse (sin cambios).

## 3. Fases

- **Fase 0 — Regla de ubicación.** `my-day.ts` con pruebas.
- **Fase 1 — Lectura.** Pantalla, progreso con explicación, entrada del
  asesor, menú. Cada fila lleva a donde se resuelve (D-03).
- **Fase 2 — Actuar sin salir.** Tipificar recupero y campaña desde la fila
  con el editor que ya existe (`CampaignAttemptEditor` y su borrador), y
  «Guardar y siguiente» a lo largo de toda la lista.
- **Fase 3 — Avisos.** BR-013 (citas del recupero de ventas en Mi agenda y
  en el aviso) y BR-014 (el asesor recibe el aviso de sus recuperos
  vencidos).
- **Fase 4 — Mis ventas del mes.** Cada venta con su estado, su monto y por
  qué no paga todavía (`evaluatePerformanceOrderPayment`).
- **Fase 5 — Supervisor vendedor y piezas shadcn/ui** (D-02, D-05).

## 4. Riesgos

- **Coincidencia con Rendimiento (AC-005).** Se usa la misma población
  (cohorte por ingreso del mes, `agentUserId`) y las mismas funciones; la
  verificación compara las dos pantallas para el mismo asesor.
- **Pedidos de más de 60 días** con incidencia no aparecen en «Mi día»,
  aunque sí en Pedidos con período histórico. Es deliberado: la lista es de
  trabajo, no de archivo.
