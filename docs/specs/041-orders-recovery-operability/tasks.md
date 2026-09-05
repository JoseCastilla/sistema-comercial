# SPEC-041 — Tareas

## Fase 2 del plan: encontrar y acotar (05/09/2026)

- [x] `order-inbox-filters.ts` en validation — grupos y acciones del filtro
      logístico, tramos del plazo y su ventana (5 pruebas).
- [x] `sales-recovery-filters.ts` en validation — vistas, estados por vista,
      prioridades y motivos con etiqueta única (3 pruebas).
- [x] REC-03 · Recupero de ventas: `QueueFilters` con vista, búsqueda
      unificada (nombre, DNI, teléfono, línea, código de venta), equipo a
      cargo (solo organización), responsable actual, prioridad, motivo,
      estado y vencimiento; indicadores sobre el alcance y enlaces que
      conservan búsqueda, equipo y responsable; vista de resueltos paginada
      en la base con resultado y fecha.
- [x] PED-01 · Pedidos: `OrderScopeFilters` reemplaza los formularios GET —
      búsqueda con pausa de 300 ms y Enter inmediato, selector de asesor
      dentro del alcance acotado por equipo, fichas de filtros activos;
      `advisor` en consulta, cifras y enlaces.
- [x] PED-02 · Pedidos: filtro por acción derivada (grupo o acción exacta,
      solo en logística, por ids), filtro por plazo con la regla de la fila,
      indicadores logísticos y «Fuera de plazo» enlazados a su lista.
- [x] Pruebas web: `pedidos-filtros.test.tsx` (7) y `bandeja-recupero`
      ampliada (9).
- [x] Verificación de solo lectura en producción tras el despliegue:
      paridad indicador ↔ lista en logística (17/132/188) y en «Fuera de
      plazo» (12); filtros en Recupero sobre 68 casos reales.

## Fase 3 del plan: gestionar sin salir (05/09/2026)

- [x] `recovery-internal-stage.ts` en validation — etapa de la cadencia con
      las reglas de SPEC-026 / BR-066 (6 pruebas).
- [x] NAV-02 · El pedido muestra su último caso, abierto o resuelto, con
      enlace a la ficha; reenviar solo sin caso abierto; la cola «Por
      recuperar» aclara que son pedidos y enlaza a Recupero de ventas.
- [x] REC-04 · `SalesRecoveryRow`: DNI y teléfono copiables, última gestión,
      «Registrar gestión» con `CampaignAttemptEditor` y `CampaignDraftProvider`
      (una sola abierta, idempotencia, fila actualizada con lo confirmado,
      paginación con `GuardedLink`); «Reasignar» bajo demanda.
- [x] REC-05 · Etapa en la fila (rótulo con explicación) y en la ficha
      (indicador + panel «Plazo del recupero»).
- [x] Pruebas web: panel del pedido (3) y bandeja ampliada (13).
- [x] Verificación de solo lectura en producción tras el despliegue: 69
      filas sin formularios abiertos, etapas visibles, fichas con «Plazo del
      recupero», pedido enlazado a su caso.
