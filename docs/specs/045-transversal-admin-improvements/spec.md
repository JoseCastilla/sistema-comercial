# SPEC-045 — Mejoras transversales de la plataforma

Estado: **fase 1 entregada y verificada en producción** (06/09/2026); fases
2 a 4 pendientes. Plan «Mejoras transversales de
la plataforma comercial» v1.0 propuesto por José el 06/09/2026 (rol ADMIN,
revisión de lectura de diez módulos), contrastado con la revisión de
integridad del 05/09/2026 (`docs/revisiones/2026-09-05-integridad-plataforma.md`)
y con el código.

## 1. Origen

Tras SPEC-040 a SPEC-044 cada módulo funciona, pero entre módulos quedan
costuras: una alerta que abre más de lo que cuenta, la misma población con
tres nombres en tres etapas de Campañas, un mensaje que afirma que «nadie»
reparte una cuota cuando administración puede hacerlo, y cifras sin enlace.

## 2. Contraste del plan con el código (06/09/2026)

| Acción | Hallazgo | Contraste |
|---|---|---|
| PL-02 | La alerta cuenta vencidos y abre `/recovery/sales` sin filtro | Real, y peor: la alerta contaba «próxima acción en el pasado» (`nextActionAt < now`) sin mirar si alguien había llamado, mientras la bandeja usa `classifyInternalRecoveryDue` (SPEC-030 BR-095). Dos definiciones. |
| PL-03 | «Verificados» en TRIAGE y «Disponible» OPEN suenan a lo mismo | Real: Preparar «Por revisar» (todo TRIAGE), Revisar «Listos para repartir» (TRIAGE verificado), Repartir «Disponible» (OPEN) y «Por revisar o portando» (TRIAGE+WAITING). Además Preparar contaba WAITING completo y Revisar solo WAITING verificado. |
| PL-05 | «Nadie reparte su cuota» con equipos sin supervisor | Real: SPEC-038 BR-009 y la página de Cuotas ya dicen que administración reparte cuando no hay supervisor. |
| PL-06 | 347 pedidos que requieren acción sin enlace | Real: el conteo de Logística y el filtro «Entregas fallidas por gestionar» de Pedidos son la misma definición (`isRecoveryOpportunity` con pedido no cerrado ni entregado, sin período, SPEC-029 BR-025). |
| PL-01 | Sin resumen administrativo de pendientes | Parcial: «Pendientes de intervención» (SPEC-044) ya cubre pedidos, casos internos y meses anteriores; faltan campaña, equipos sin supervisor, asesores sin equipo y logística. |
| PL-04 | Reparto sin información de carga | Real (fase 2). |
| PL-07..PL-11 | P2 | Reales; fases 3 y 4. |

**Lo que el plan no cubre y pesa más** (revisión del 05/09): copias de
seguridad, proceso de fondo (worker) para AGR, vencimientos y webhooks
fallidos, límite de intentos en el login y MFA. Se registran como fase 0 a
tratar en una spec propia de operación; no bloquean esta.

## 3. Reglas

### Fase 1 — Correcciones (PL-02, PL-03, PL-05, PL-06)

- **BR-001 · La alerta abre lo que cuenta (PL-02).** El aviso flotante de
  recuperos vencidos cuenta con `classifyInternalRecoveryDue` sobre el mismo
  alcance por rol que la bandeja (`getSalesRecoveryAccessWhere`) y abre
  `/recovery/sales?vence=vencido`, un filtro nuevo que es la unión de los tres
  vencimientos (primer contacto, seguimiento, agenda). «Vencido» es un valor
  de filtro, no un cuarto vencimiento: cada caso sigue teniendo uno solo.
- **BR-002 · Un nombre por población en Campañas (PL-03).** En Preparar,
  Revisar y Repartir: «Falta consultar» (TRIAGE o WAITING con alguna línea sin
  consultar), «Verificados por entregar» (TRIAGE con todo consultado), «Con
  pedido en curso» (WAITING con todo consultado), «Disponibles para asignar»
  (OPEN), «Asignados sin gestión», «En gestión», «Recuperados». Los nombres
  viven en `campaign-stage-labels.ts` y cada contador abre la etapa donde esa
  población se trabaja. Preparar adopta las mismas condiciones que Revisar.
- **BR-003 · Cobertura administrativa (PL-05).** Un equipo sin supervisor no
  queda sin dueño: «administración cubre su cuota y su recupero mientras no
  lo tenga». En el tablero, ADMIN ve «Asignar supervisor» (`/admin/teams?
  sinSupervisor=1`) y «Repartir su cuota»; la fila del equipo enlaza a su
  tarjeta. El asesor activo sin equipo sigue siendo una incidencia aparte
  (`/admin/users?situacion=sin-equipo`).
- **BR-004 · Logística enlaza (PL-06).** «Pedidos que requieren acción» abre
  `/orders?status=LOGISTICS`, con la aclaración de que es el acumulado con
  oportunidad abierta desde el 10/08 y no el resultado de la última
  ejecución. Navegar no dispara ninguna sincronización.

### Fase 2 — Resumen administrativo y reparto con carga (PL-01, PL-04)

- **BR-005** Resumen de pendientes para ADMIN con definición, alcance
  temporal, cantidad, responsable y acceso; pedidos, casos internos y casos de
  campaña separados; sin totales que sumen poblaciones solapadas.
- **BR-006** Antes de confirmar un reparto se muestran abiertos, sin primer
  contacto y vencidos por participante y la carga resultante; el equitativo
  sigue identificado; no se reasigna nada por observar carga alta.

### Fase 3 — Fuente, columnas y actividad (PL-07, PL-08, PL-09)

- **BR-007** Hora de consulta de Máximo distinta de la de pantalla; siguiente
  ventana programada y cómo se dispara; una credencial activa no es garantía
  de datos recientes.
- **BR-008** Columnas esenciales del resumen por equipo visibles sin que el
  panel lateral las tape; cabeceras con contexto al desplazarse.
- **BR-009** «Trabajados» abre Hoy, Ayer, 7 y 30 días conservando equipo y
  asesor; la actividad del período separada de la cartera actual.

### Fase 4 — Control administrativo y consultas externas (PL-10, PL-11)

- **BR-010** DNI distingue actividad personal y organizacional, API y caché;
  saldo con fecha del último reporte. DITO: ocho cargas recientes más
  historial paginado sin borrar confirmadas.
- **BR-011** «Checa tus líneas» explica que no queda auditado como consulta
  DNI; acceso externo alternativo; selectores de destino con etiqueta
  accesible y reparto operable con teclado.

## 4. Criterios de aceptación de la fase 1

- **AC-001:** el número de la alerta es igual a «N caso(s) cumplen el filtro»
  en `/recovery/sales?vence=vencido` para la misma sesión y momento.
- **AC-002:** Preparar, Revisar y Repartir muestran el mismo nombre para la
  misma población y cada contador abre su etapa; «Verificados por entregar»
  en Preparar coincide con «Verificados por entregar» en Revisar.
- **AC-003:** con un equipo sin supervisor, el tablero dice que administración
  lo cubre y ofrece «Asignar supervisor» y «Repartir su cuota».
- **AC-004:** «Pedidos que requieren acción = N» abre Pedidos con N órdenes.
- **AC-005:** tipos, lint y pruebas en verde.
