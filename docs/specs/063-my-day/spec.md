# SPEC-063 — Mi día: la bandeja de trabajo del asesor

**Estado:** `EN_CURSO` — fases 0 y 1 en `main`; fases 2 a 5 pendientes; decisiones de §5 adoptadas como recomendación (24/09/2026)

**Versión:** 1.0
**Fecha:** 2026-09-24

## 1. Origen

El 24/09/2026 José fijó el objetivo de esta etapa: *el Sistema Comercial debe
ser el lugar donde el asesor quiera convivir, y debe hacerlo productivo.* La
revisión de oportunidades del mismo día
(`docs/revisiones/2026-09-24-oportunidades-asesor.md` §2.1) propuso «Mi día»
como primer paso, y José eligió empezar por ahí.

Decisiones de José que condicionan esta spec (§7 de esa revisión):

- el asesor **ve el monto** de su comisión **y entiende cómo se calcula**;
- la conversación de WhatsApp entra al sistema al final de la hoja de ruta;
- las llamadas esperan al softphone WebRTC sobre la troncal SIP (SPEC-035).

## 2. Problema, revisado contra el código

Para responder «¿qué hago ahora?» el asesor tiene que visitar cuatro
pantallas, cada una con su propio orden y su propio lenguaje:

| Qué le toca | Dónde vive hoy | Regla que lo decide |
|---|---|---|
| Citas acordadas con el cliente | `/recovery/agenda` y panel de `/recovery/campaigns` | `selectRecoveryAgendaItem`, `describeRecoveryCommitmentState` (`recovery-agenda.ts`) |
| Ventas caídas a su cargo | `/recovery/sales` | `classifyInternalRecoveryDue`, `describeInternalRecoveryStage`, `compareInternalRecoveryCases` |
| Su cola de campaña | `/recovery/campaigns` | `classifyRecoveryWorkItem`, `compareRecoveryWorkNow` (`recovery-work-views.ts`) |
| Incidencias de sus pedidos | `/orders` (9 pestañas) | `getStatusFilter`, `getSlaState` (dentro de `get-order-inbox.ts`) |
| Cuánto va ganando | `/performance` (tablero del supervisor en vista propia) | `calculatePerformanceMetrics`, `evaluatePerformanceOrderPayment` (`performance-metrics.ts`) |

Además entra a `/orders` al iniciar sesión (`app/page.tsx:8`).

Huecos que esta spec cierra porque «Mi día» los necesita:

1. **Las citas del recupero de ventas no aparecen en ninguna agenda ni
   aviso.** El intento crea la cita para cualquier origen
   (`register-recovery-attempt-action.ts:480`), pero `getAgenda`, el aviso y
   el panel de Campañas filtran `NATIONAL_BASE`.
2. **El asesor no recibe el aviso de sus recuperos vencidos**
   (`api/order-escalations/notifications/route.ts:30-32` lo limita a ADMIN y
   SUPERVISOR).
3. **La consulta de la cola de Campañas vive dentro de la página**
   (`app/recovery/campaigns/page.tsx:141-225`) y no se puede reutilizar.
4. **El alcance de recupero por rol está copiado en tres sitios**
   (`recovery-case-access.ts:111`, `get-sales-recovery-inbox.ts:177`,
   `count-overdue-internal-cases.ts:24`).
5. **El plazo de un pedido (`getSlaState`) no es una regla pura**: vive en
   `get-order-inbox.ts:337`.

## 3. Alcance

Una pantalla, `/my-day`, para quien vende: el asesor y el supervisor
vendedor (SPEC-019), cada uno sobre **su propio trabajo**. Sin permisos
nuevos: cada fuente conserva el alcance que ya tiene para ese usuario.

Fuera de esta spec y con spec propia más adelante: buscador `Ctrl + K`, ficha
única del cliente, notificaciones del navegador, conversación de WhatsApp y
llamadas.

## 4. Reglas

### Qué reúne (MD-F01)

- **BR-001 — Una sola lista de trabajo.** «Mi día» reúne, para el usuario
  autenticado: sus citas pendientes (de campaña **y** de recupero de ventas),
  sus casos de recupero de ventas abiertos, sus pedidos con algo que le
  corresponde hacer y su cola de campaña. Cada elemento aparece **una sola
  vez**: si un caso tiene cita, aparece como cita (la cita manda, como en
  SPEC-048 BR-004).
- **BR-002 — Ninguna regla nueva de vencimiento.** Cuándo algo vence, espera
  o está al día lo decide la regla que ya lo decide en su módulo (tabla de
  §2). «Mi día» solo ordena y presenta. Si una regla cambia en su módulo,
  cambia aquí sin tocar «Mi día». El resultado de un intento es siempre el
  efectivo (rectificado si lo hay, SPEC-049 BR-017).
- **BR-003 — Solo lo propio.** «Mi día» muestra lo asignado al usuario
  (casos con `assignedUserId` suyo) y sus ventas (`agentUserId` suyo). Para el
  asesor coincide exactamente con lo que ve en cada módulo; para el
  supervisor vendedor es la parte propia de lo que ve. Nunca aparece trabajo
  de otra persona. (Unificar las tres copias del alcance de recupero, hueco
  4, queda como deuda: «Mi día» no lo necesita.)
- **BR-004 — Pedidos: solo lo que le toca al asesor.** De sus pedidos entran
  los de las pestañas «Entregas fallidas por gestionar» (con la acción que
  sugiere la logística) e «Incidencias» (rechazo, sin estado, fuera de
  plazo), con la misma definición que en Pedidos. No entran los que esperan a
  otra persona: escalamientos (los resuelve supervisión) ni pedidos por
  activar.

### Cómo ordena (MD-F02)

- **BR-005 — Tramos de urgencia**, de arriba abajo:
  1. **Comprometido y vencido:** cita acordada cuya hora pasó.
  2. **Venta en riesgo:** recupero de ventas sin primer contacto dentro de
     su plazo de 2 horas, o vencido.
  3. **Comprometido pronto:** cita en las próximas 2 horas.
  4. **Pedido con incidencia:** los de BR-004.
  5. **Seguimiento vencido:** recupero de ventas con seguimiento o agenda
     vencidos.
  6. **Campaña:** casos de su vista «Ahora».

  Dentro de cada tramo, lo que vence antes va primero; sin fecha, el orden
  de su módulo. Los tramos 1 a 5 se muestran completos; la campaña muestra
  los primeros casos de su vista «Ahora» y el total, con enlace a la cola.
- **BR-006 — «Más tarde hoy».** Lo que vence hoy después de las próximas 2
  horas va en un bloque aparte, plegado, para que el asesor planifique sin
  que distraiga.
- **BR-007 — Cada fila dice qué hacer.** Cada elemento muestra el cliente,
  una frase con la acción («Llamar: acordaste a las 15:00», «Primer contacto:
  quedan 40 min») y **una acción principal** que lleva al lugar donde se
  resuelve. La frase sale de la regla de su módulo (BR-002).
- **BR-008 — Lista vacía.** Sin nada en los tramos 1 a 5 ni en la campaña,
  la pantalla lo dice en positivo y ofrece el siguiente paso útil (tomar
  casos libres del equipo, si existe la opción para el usuario).

### Progreso y comisión (MD-F03)

- **BR-009 — Franja de progreso siempre visible.** Encima de la lista:
  - hoy: ventas ingresadas y gestiones registradas;
  - el mes: **comisión estimada en soles** (base + bonos);
  - el siguiente objetivo: cuántas confirmadas faltan para el siguiente
    bono y cuánto vale (`calculateAcceleratorWindow`: `missingForNextTarget`,
    `nextTargetAmountCents`);
  - la cuota de la ventana vigente (`resolveRelevantAcceleratorWindow`).
- **BR-010 — El cálculo se explica con las cifras de la política.** Un
  desplegable «Cómo se calcula» muestra la tarifa por tipo de venta, los
  bonos por ventana y qué hace pagable una venta, **leídos de la política
  centralizada** (SPEC-033, `performance-metrics.ts`), nunca escritos en la
  pantalla. Si la política cambia, la explicación cambia sola.
- **BR-011 — Estimado hasta la liquidación.** El monto se rotula «estimado»
  mientras no exista la liquidación mensual (SPEC-014, decisión abierta).
  Las cifras coinciden con las de `/performance` para el mismo usuario y mes.

### Entrada y avisos (MD-F04)

- **BR-012 — El asesor entra a «Mi día».** Tras iniciar sesión y en `/`, el
  rol AGENT va a `/my-day`, y «Mi día» es su primer ítem del menú. Los demás
  roles no cambian su entrada (D-02).
- **BR-013 — Citas del recupero de ventas en agenda y aviso.** `getAgenda` y
  el aviso de citas incluyen las citas de casos de recupero de ventas del
  usuario (hueco 1).
- **BR-014 — El asesor ve sus propios recuperos vencidos** en el aviso,
  contados con su alcance (hueco 2).
- **BR-015 — Frescura.** La pantalla se vuelve a leer al volver a la
  pestaña y cada 60 segundos (el mismo ritmo del aviso actual), sin perder el
  bloque plegado ni la posición.

### Clientes calientes y cuota del mes (decisiones de José del 24/09/2026)

- **BR-018 — Lo caliente primero; lo frío sin ruido.** Una venta de los
  últimos 7 días (hoy y los 6 días anteriores, en fecha de Lima) es un
  cliente caliente: sus ventas caídas y sus pedidos con incidencia van en
  «Ahora», y entre las ventas caídas la más reciente primero. Una venta más
  antigua es un cliente frío: sigue siendo oportunidad, pero va en un bloque
  plegado al final, «Ventas antiguas por recuperar», sin rojo ni plazos, de
  la más reciente a la más antigua. Las citas acordadas no se enfrían: el
  asesor se comprometió. La fecha de la venta es la de registro del pedido
  de origen.
- **BR-019 — La cuota es del mes.** La cuota del asesor es el objetivo del
  mes completo y se mide en portabilidades entregadas de las ventas del mes.
  Los bonos siguen por ventana (SPEC-038 BR-001 a BR-006). Hasta que Cuotas
  la guarde como mensual (SPEC-064), «Mi día» lee la cuota asignada al
  asesor en el mes: la de la primera ventana si existe, si no la de la
  segunda; sin cuota asignada, muestra solo las entregadas.

### Construcción (MD-F05)

- **BR-016 — Consultas con techo.** Cada fuente se lee con un límite
  explícito y su total aparte; ninguna trae toda la historia.
- **BR-017 — Primera pantalla del nuevo enfoque visual.** «Mi día» no añade
  CSS a `patterns.css`: usa utilidades de Tailwind sobre los tokens `--ui-*`
  y elementos nativos accesibles (`<details>`, listas, `<time>`). Las piezas
  shadcn/ui recomendadas en la revisión (§3) entran en una fase posterior:
  hoy `pnpm-lock.yaml` tiene cambios del CRM sin commitear, y añadir
  dependencias los mezclaría en la entrega.

## 5. Decisiones adoptadas como recomendación

José puede corregirlas; se construye con ellas.

| # | Decisión | Por qué |
|---|---|---|
| D-01 | Ruta `/my-day`; nombre visible «Mi día» | Las rutas del sistema están en inglés; el usuario solo ve el nombre |
| D-02 | Fase 1: menú y entrada solo para el asesor; el supervisor vendedor puede abrir `/my-day` y entra al menú en una fase posterior | El menú hoy conoce el rol, no si el supervisor vende; y la entrada del supervisor se decide aparte |
| D-03 | Fase 1 lleva a la pantalla donde se resuelve; tipificar sin salir llega en fase 2 | Entrega valor pronto sin duplicar el editor antes de tener la lista estable |
| D-04 | La comisión se muestra estimada, con su desglose y la política a la vista | Decisión de José del 24/09 (§1) |
| D-05 | shadcn/ui se adopta en una fase posterior, con el lockfile limpio | Ver BR-017 |

## 6. Criterios de aceptación

- **AC-001:** Un asesor con una cita vencida, un recupero sin primer
  contacto, una cita en 90 minutos, un pedido rechazado y casos de campaña
  los ve en ese orden, cada uno una sola vez.
- **AC-002:** Un caso con cita aparece solo como cita.
- **AC-003:** Cada fila lleva a la pantalla donde se resuelve y el asesor
  puede resolverlo ahí con los permisos de siempre.
- **AC-004:** Un elemento que el asesor no ve en su módulo no aparece en
  «Mi día»; el de otro asesor tampoco.
- **AC-005:** La comisión estimada y las confirmadas que faltan coinciden con
  `/performance` para el mismo asesor y mes.
- **AC-006:** «Cómo se calcula» muestra las tarifas y bonos de la política
  vigente; cambiar la política en el código cambia el texto.
- **AC-007:** El asesor entra a `/my-day` al iniciar sesión; «Mi día» es su
  primer ítem de menú.
- **AC-008:** Una cita de recupero de ventas aparece en Mi agenda y en el
  aviso de citas.
- **AC-009:** El asesor recibe el aviso de sus recuperos vencidos.
- **AC-010:** Sin pendientes, la pantalla lo dice y ofrece el siguiente paso.
- **AC-011:** A 1 316 × 760 y a 375 × 812, en claro y en oscuro, nada se
  corta ni se monta.

## 7. Fuera de alcance

- Buscador universal `Ctrl + K` y ficha única del cliente (specs propias).
- Notificaciones del navegador (Web Push).
- «Mis ventas del mes» con el monto de cada venta (fase 4 de esta spec, ver
  plan).
- Llamadas desde la fila y conversación de WhatsApp.
