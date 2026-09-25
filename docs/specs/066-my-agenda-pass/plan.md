# SPEC-066 — Plan de implementación

## 1. Datos

`getAgenda` deja de pasar los casos por `selectRecoveryAgendaItem` y lee
directamente las citas (`recoveryCaseCommitment`) de los casos abiertos del
asesor, de cualquier origen: las pendientes de cualquier fecha (para las
vencidas) y las del período en cualquier estado. Cada cita trae lo que la
tarjeta necesita: teléfonos para el editor, última gestión, lo acordado, el
plazo (`describeCampaignWorkDue`) y la historia de citas del caso. Se retira
`get-agenda-commitment.ts`: la historia viaja con cada cita.

## 2. Períodos

`@repo/validation/recovery-agenda-period.ts`: vistas `proximas` (14 días) y
`mes`; cualquier otro valor abre `proximas`. Se retiran
`recoveryAgendaGridHours` y `recoveryAgendaWorkdayHours`.

## 3. Pantalla

- `AgendaCommitmentList` (cliente): tarjeta de la cita con el editor en la
  tarjeta y «Reprogramar», «Cancelar cita» e «Historial» (reutiliza
  `RescheduleCommitmentForm` y `CancelCommitmentForm`).
- `AgendaDateJump`: la fecha navega al cambiar.
- `QueueFilters` con búsqueda y estado.
- Vencidas arriba; días con citas en «Próximas»; rejilla con cifras en
  «Mes» (en el celular, solo el número).

## 4. Pruebas

- `recovery-agenda-period.test.mjs`: vistas y período de catorce días.
- `agenda-citas.test.tsx`: hora, plazo, teléfono y lo acordado; atender con
  el editor; reprogramar, cancelar e historial de a uno; vencida con fecha;
  venta caída con su venta.
