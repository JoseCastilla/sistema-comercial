# SPEC-067 — Plan de implementación

## 1. Reglas compartidas

- `@repo/validation/sales-recovery-work.ts`: `describeSalesRecoveryWork`
  reúne lo que «Mi día» calculaba en `get-my-day.ts` (plazo, tono, frase;
  frío sin ruido). «Mi día» y la ficha la usan.
- `features/recovery/server/sales-recovery-fall.ts`:
  `describeSalesRecoveryFall` (antes `fallReason` en `get-my-day.ts`).
- Campañas ya tenía `describeCampaignWorkDue` y `campaignWorkActions`
  (SPEC-065); `get-campaign-case.ts` cambia `work` a `{action, note, due,
  view}` y suma `lastResult` y `lastObservation`.

## 2. La tarjeta de arriba

`CaseWorkCard` (cliente): plazo, meta, frase, «Llamar al …», notas y el
editor de botones abierto una vez al entrar (con su propio
`CampaignDraftProvider`). Al guardar, `router.refresh()`: la acción en línea
no revalida rutas (BR-090 de SPEC-030).

## 3. Las fichas

- Campañas: encabezado «Campaña · equipo», tarjeta, «Datos del cliente»
  plegado, llamada acordada, historial y «Cerrar el caso». Se retiran los
  recuadros «Qué toca», «Resolución obligatoria», «Interesado con pedido»,
  «Identidad» y «Registrar intento».
- Venta caída: «Venta caída», tarjeta, «Cómo se calcula el plazo» y «Datos
  de la venta» plegados, historial como lista y «Cerrar el caso».
- `from=mi-dia` en los enlaces de «Mi día».
- `ResolveCaseForm` sin preselección.
- Se retiran `RegisterAttemptForm` y `registerRecoveryAttemptAction`.

## 4. Pruebas

- `sales-recovery-work.test.mjs`: rojo y «Llamar ya»; ámbar y la hora;
  venta antigua sin ruido; en verificación, nada.
- `ficha-caso.test.tsx`: tarjeta, editor abierto con teléfono, guardar y
  refrescar, cerrar no reabre, sin permiso sin editor; cierre sin
  preselección.
