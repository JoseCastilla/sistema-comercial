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

## Fase 2

- **`features/performance/admin-pending.ts`** (puro): bloques, definiciones,
  responsables y destinos; `get-admin-pending-summary.ts` obtiene los doce
  conteos con las mismas condiciones que las pantallas que abren; el tablero
  lo incluye solo para ADMIN sin filtros (`adminPending`).
- **`AdminPendingSummary`** en el tablero, después de los pendientes del mes.
- **`features/recovery/distribution-preview.ts`** (puro):
  `previewEquitableLoad` y `previewDirectLoad` sobre `distributeCasesEquitably`;
  Repartir suma dos `groupBy` (sin primer contacto, vencidos) por asesor y el
  formulario muestra la vista previa en los tres modos (selectores ahora con
  etiqueta accesible).
- **Pruebas**: `campanas-reparto-carga.test.ts` (5).

## Fases siguientes

- Fase 3: `agr-delivery` con hora de fuente y ventana siguiente; columnas
  fijas en el resumen por equipo; enlaces de actividad en el tablero de
  campañas.
- Fase 4: métricas de DNI por alcance y origen; historial paginado de cargas
  DITO; textos y accesibilidad de consultas externas y reparto.
- Fase 0 (spec propia): worker, copias de seguridad, login.
