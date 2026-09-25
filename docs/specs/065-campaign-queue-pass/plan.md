# SPEC-065 — Plan de implementación

## 1. Una sola regla para las dos pantallas

Las frases y el plazo de campaña vivían en `get-my-day.ts` (Mi día) y la
cola usaba otras (`recoveryAgendaKindLabels`, `recoveryAgendaOriginLabels`,
`nextActionAt` crudo). Se mueven a `@repo/validation/campaign-work.ts`:

| Pieza | Qué hace |
|---|---|
| `campaignWorkActions` | La frase de qué hacer por tipo de elemento |
| `campaignWorkNotes` | El origen, solo cuando le dice algo al asesor |
| `describeCampaignWorkDue(item, now)` | Plazo y tono (BR-002) |
| `campaignResolutionNote` | La frase de la resolución obligatoria (BR-006) |
| `formatCampaignMoment(at)` | «08/09 12:40» (BR-009) |

«Mi día» y la cola las usan; ninguna pantalla recalcula.

## 2. La fila

`CampaignQueueRow` pasa de `<tr>` a `<article>` con la estructura de la fila
de «Mi día». El número a la vista (`PhoneNumber`) se extrae a
`features/recovery/components/phone-number.tsx` y lo usan las dos. Se
conservan el editor en la fila, «Guardar y siguiente», las flechas (ahora
sobre `[data-case-row]`), «Ver datos» y la marca del caso recién visto. Se
retira la regla CSS `.ui-table--campaign` (columnas fijas de la tabla).

## 3. La página

- Historial: `count` siempre; las filas solo en su vista (BR-001).
- Sin `MetricGroup` ni descripción; la sección de trabajo sin título.
- `CampaignInboxFilters`: búsqueda y departamento; «Más filtros» con plan y
  antigüedad.
- `TakePoolBlockForm` al final, con la cifra de casos libres en la línea y
  los campos en «Elegir cuáles».

## 4. El aviso

`EscalationNotification` se monta dentro de `<main>` como una línea alineada
a la derecha, sin `fixed` ni sombra.

## 5. Pruebas

- `packages/validation/test/campaign-work.test.mjs`: plazo y tono por tipo.
- `apps/web/src/__tests__/campanas-cola-fila.test.tsx`: la fila muestra
  teléfono, frase, «0 de 3 hoy», la nota de resolución y el DNI solo en «Ver
  datos».
- Las pruebas existentes de filtros, gestión en fila y «Guardar y siguiente»
  siguen en verde.
