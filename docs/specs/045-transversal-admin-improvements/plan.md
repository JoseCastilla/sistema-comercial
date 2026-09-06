# SPEC-045 — Plan

## Fase 1

- **`packages/validation/recovery-internal-due.ts`**: `internalRecoveryAnyDue`
  («vencido»), `InternalRecoveryDueFilter`, `internalRecoveryDueFilterOptions`,
  `parseInternalRecoveryDueFilter`, `matchesInternalRecoveryDueFilter` (2
  pruebas node:test).
- **`features/recovery/server/count-overdue-internal-cases.ts`**:
  `getSalesRecoveryAccessWhere` (el mismo alcance por rol que la bandeja) y
  `countOverdueInternalCases` (misma clasificación). La ruta de notificaciones
  lo usa; la alerta enlaza a `vence=vencido`; la bandeja acepta el filtro y lo
  ofrece como «Cualquier vencimiento».
- **`features/recovery/campaign-stage-labels.ts`**: etiquetas, pistas y
  destinos por población; Preparar, Revisar y Repartir los consumen. Preparar
  añade tres conteos con las condiciones de Revisar.
- **Tablero**: cabecera del resumen por equipo con cobertura administrativa y
  enlaces (ADMIN); fila «Sin supervisor · lo cubre administración» enlazada a
  la tarjeta del equipo.
- **Logística**: `Metric` con `href="/orders?status=LOGISTICS"` y pista.
- **Pruebas**: `campanas-etapas.test.ts` (2).

## Fases siguientes

- Fase 2: resumen administrativo (datos nuevos: casos de campaña por etapa,
  equipos sin supervisor, asesores sin equipo, logística) y vista previa de
  carga en `distribute-recovery-form`.
- Fase 3: `agr-delivery` con hora de fuente y ventana siguiente; columnas
  fijas en el resumen por equipo; enlaces de actividad en el tablero de
  campañas.
- Fase 4: métricas de DNI por alcance y origen; historial paginado de cargas
  DITO; textos y accesibilidad de consultas externas y reparto.
- Fase 0 (spec propia): worker, copias de seguridad, login.
