# SPEC-050 — Plan de implementación

## 1. Arquitectura

**Lo confirmado por el servidor manda en la fila.** La acción de registro
ya devuelve estado, próxima acción, intentos de hoy, vista destino y la
frase de consecuencia (SPEC-049 fase 1). La fila los aplica sin moverse; el
«Qué toca» posterior al guardado sale del mismo selector de SPEC-048 corrido
en el cliente con los datos confirmados (`selectRecoveryAgendaItem` es puro
y ya viaja al cliente en otros componentes), de modo que la fila no inventa
nada que el servidor no haya dicho.

**Un solo estado de bandeja en el cliente.** `CampaignDraftProvider` ya es
el dueño del borrador; gana un registro de «casos movidos» (`caseId →
vista destino`) que el carril lee para ajustar sus cantidades y que decide
el refresco: cuando `editingId` vuelve a nulo y hay movidos, la bandeja
llama a `router.refresh()` una vez y vacía el registro. Nunca mientras se
edita (SPEC-030 BR-090).

**La devolución es un evento, no una adivinanza.** El selector recibe una
sola fecha de devolución y su origen; quién la calcula (bandeja, ficha,
agenda) usa la misma función pura `resolveReturnedFromVerification(events,
lastAttemptAt)` sobre los eventos `CASE_REOPENED` y `PORTABILITY_CROSSED`
(`WAITING → ASSIGNED`), para que las tres superficies no discrepen.

## 2. Modelo de datos

Sin migraciones. Se leen eventos ya existentes (`type`, `previousStatus`,
`newStatus`, `observation`, `actor`, `createdAt`).

## 3. Fases

### Fase 1 — Devoluciones y primer contacto (CAM-UX-04, CAM-UX-05 parte)

1. `recovery-agenda.ts`: elemento `PRIMER_CONTACTO` (sin intentos) y
   `resolveReturnedFromVerification` (evento `CASE_REOPENED` o
   `PORTABILITY_CROSSED` `WAITING → ASSIGNED` posterior al último intento;
   devuelve `{ at, origin: "supervisor" | "cruce", reason, actorName }`).
   `recoveryWorkNowRank` ya pone el origen «devuelto» en el rango 2.
   Pruebas: cruce a `SCHEDULED` no es devolución; descarte no; `TRIAGE` no.
2. Bandeja, ficha y agenda cargan los dos tipos de evento y pasan la
   devolución al selector; muestran origen, fecha y motivo.

### Fase 2 — Acciones rápidas y acción principal (CAM-UX-01, CAM-UX-02)

3. `recoveryAttemptChoices`: tecla P «Tiene pedido» → pseudoresultado que
   el editor resuelve con la pregunta «¿confirmó que le interesa?» en
   `AttemptResultFields`; el servidor no cambia.
4. Fila: acción principal según `work.kind`: «Registrar gestión»,
   «Vincular orden» (`#resolver`), «Revisar cierre» (`#resolver`),
   «Resolver datos inválidos» (`#resolver`), «Ver motivo» (despliega la
   espera), «Gestionar cita» (panel de la agenda con `cita=`). La fila
   necesita `work.kind` y el id de la cita pendiente.

### Fase 3 — Actualizar tras guardar (CAM-UX-03)

5. Fila: al confirmar, recalcula «Qué toca» con el selector sobre lo
   confirmado y muestra la vista destino; se atenúa si sale de la vista.
6. `CampaignDraftProvider`: registro de movidos; carril como componente
   cliente que ajusta cantidades; refresco único cuando no queda gestión
   abierta. Pruebas de componente: contadores ±1; sin refresco mientras se
   edita; refresco al cerrar.

### Fase 4 — Filtros, cabecera y columnas (CAM-UX-05 resto, CAM-UX-06)

7. Filtro `tarea=` en `CampaignInboxFilters` con cantidades por elemento en
   la vista actual; «N de M en esta vista».
8. Cabecera sin las tres cifras de vistas; «Tomar casos libres» en una
   línea desplegable; columnas reordenadas y las secundarias a «Ver datos»;
   comprobación a 1280 px.

### Fase 5 — Recorridos (CAM-UX-07)

9. José recorre con cuentas de prueba la lista de `verification.md`, que
   reúne lo pendiente de SPEC-048, SPEC-049 y esta spec.

## 4. Pruebas

- Puras: primer contacto sin intentos; devolución por supervisor y por
  cruce, y las transiciones que no lo son; rango 2 en Trabajar ahora.
- Componente: tecla P y la pregunta de interés; acción principal por tipo;
  contadores del carril tras guardar; refresco solo sin gestión abierta;
  filtro por tarea con cantidades.
- Recorrido: `verification.md`.

## 5. Despliegue

Sin migraciones. Publicar en `main` despliega.
