# SPEC-042 — Ciclo de vida del vendedor: baja, reingreso y promoción

Estado: **desplegada y verificada en lectura** (05/09/2026). Pedido por José el
02/09/2026: «poder promover a un vendedor como supervisor, dar de baja a un
vendedor y hacer un reingreso». Las cuatro decisiones de §5 se tomaron con
la opción recomendada, como supuestos explícitos: José pidió avanzar en vez
de elegir entre opciones; cualquiera de ellas se puede revertir con un
cambio acotado.

## 1. Problema

Hoy una persona entra al sistema y nunca sale. `UserStatus.DISABLED` existe en
el esquema desde SPEC-001, pero **nada lo escribe**: no hay acción de baja.
Un vendedor que dejó la empresa sigue `ACTIVE`: puede iniciar sesión, aparece
en todos los selectores de asesor (reasignar ventas, repartir casos, filtrar
Pedidos, fijar cuotas), conserva sus casos de recupero abiertos con su
cadencia corriendo, y la venta que llegue por su correo se le sigue
asignando. La única salida real que tiene hoy el administrador es cambiarle
la contraseña para que no entre, que no resuelve nada de lo anterior.

La promoción existe a medias: `assignTeamMemberAction` acepta el modo
`SELLING_SUPERVISOR` (SPEC-019) y, de paso, sube el rol de la organización a
`SUPERVISOR`. Está escondida dentro de «asignar integrante» en Equipos, no
dice que está promoviendo, y no cubre al supervisor que deja de vender.

El reingreso no existe. Si un vendedor vuelve, la alternativa hoy es crear
otra cuenta con otro correo, lo que **rompe la continuidad**: sus ventas,
comisiones, intentos y auditoría quedan en el usuario viejo, y el nuevo nace
sin historia. Esto choca con el invariante de evidencia inmutable y con la
liquidación por persona.

## 2. Alcance

Tres acciones administrativas sobre una persona con rol comercial (`AGENT` o
`SUPERVISOR`), desde Personas:

- **Baja**: la persona deja de operar, sin borrar nada.
- **Reingreso**: la misma persona vuelve a operar, con su historia intacta.
- **Promoción**: un asesor pasa a supervisor —siguiendo vendiendo o no— de
  forma explícita y con nombre propio.

Fuera de alcance: eliminar cuentas (nunca); baja de `ADMIN` y `BACKOFFICE`
(no tienen cartera; la regla del último administrador ya existe, BR-015 de
SPEC-001); degradar un supervisor a asesor (se anota como extensión
natural, ver §6); vacaciones o ausencias temporales (una ausencia no es una
baja: la venta sigue siendo suya).

## 3. Decisiones propuestas

Marcadas con **[D]** las que eran de José y se resolvieron con la opción
recomendada (ver §5); el resto se deriva de reglas ya vigentes.

### Baja

- **BR-001 · La baja no borra: apaga.** `User.status` pasa a `DISABLED`;
  todas sus membresías comerciales activas se cierran (`isActive=false`,
  `isPrimary=false`, `validUntil=ahora`); sus sesiones abiertas se revocan;
  el rol de la organización se conserva tal cual (es historia y es lo que
  el reingreso recupera). Ventas, intentos, eventos y auditoría siguen
  apuntando a la misma persona: nada se reescribe (SPEC-001 BR-022, BR-023).
- **BR-002 · Quien está de baja no aparece donde se elige a alguien.** Los
  selectores de asesor (reasignar venta, asignar caso, repartir base,
  filtrar Pedidos y Recupero, cuotas) ya exigen `user.status = ACTIVE` y
  membresía activa: la baja los saca de todos sin tocar cada pantalla. Sus
  ventas históricas siguen visibles con su nombre; el filtro de Personas
  «Deshabilitados» los encuentra.
- **BR-003 · Sus ventas nuevas van al pool.** La resolución automática del
  asesor por correo (SPEC-001 BR-008, `canResolveAutomaticDitoAssignment`)
  exige usuario activo y membresía primaria activa: una venta que llegue
  por el correo de alguien de baja entra como huérfana y la supervisión la
  reclama. Es el comportamiento ya vigente; la baja lo activa.
- **BR-004 · Sus ventas abiertas no cambian de dueño. [D]** Las ventas con
  `agentUserId` de la persona conservan asesor y equipo: son su venta, pesan
  en su liquidación y la supervisión del equipo ya las ve y las gestiona
  (BR-019 de SPEC-001). La baja no reasigna ventas; si hace falta, la
  reasignación manual existente sigue disponible, con su motivo
  (`AGENT_ABSENCE` o `TEAM_TRANSFER`) y su historial.
- **BR-005 · Su cartera de recupero se entrega o vuelve a la cola. [D]** Los
  casos abiertos del carril interno asignados a la persona pasan a **sin
  responsable** (`OPEN`, `assignedUserId=null`) conservando el equipo, para
  que la bandeja del supervisor los muestre como «Sin responsable» y los
  reasigne; **o**, si el administrador lo indica en el mismo formulario, se
  asignan a un asesor destino del mismo equipo (misma regla que reasignar:
  una Crítica nunca vuelve al originador, BR-065). Los casos de Campañas
  asignados vuelven al pool de su equipo con el mismo mecanismo de BR-077
  (`OPEN`, sin responsable, evento `ASSIGNED_TO_TEAM`). El reloj del primer
  contacto (dos horas) no se reinicia por una baja: el caso ya estaba
  vencido o no, y quien lo tome hereda ese estado.
- **BR-006 · Antes de confirmar, se dice qué pasará.** El formulario de baja
  muestra las consecuencias con números: cuántas ventas abiertas conserva a
  su nombre, cuántos casos de recupero interno y de Campañas se liberan (o
  se entregan a quién), y qué equipos quedan sin supervisor si la persona
  era supervisora (aviso, no bloqueo: SPEC-017 BR-009). Pide un motivo
  corto obligatorio (renuncia, cese, fin de campaña, otro). Nada se ejecuta
  sin esa confirmación.
- **BR-007 · Límites.** Nadie se da de baja a sí mismo. Solo `ADMIN` da de
  baja (SPEC-001 BR-014: los cambios de rol y estado son del administrador;
  el supervisor solo crea asesores). El último administrador activo no se
  puede deshabilitar (BR-015, ya vigente).

### Reingreso

- **BR-008 · El reingreso es la misma persona.** Reingresar reactiva la
  cuenta existente (`status=ACTIVE`) en vez de crear otra: mismo `userId`,
  misma historia de ventas, comisiones y gestiones. El correo sigue siendo
  la identidad operativa (SPEC-017 BR-001); si la persona vuelve con otro
  correo corporativo, el administrador lo cambia en la misma acción y el
  anterior deja de resolver ventas.
- **BR-009 · Vuelve con equipo y contraseña nuevos.** El reingreso exige
  elegir el equipo primario (y si sigue o no con capacidad de venta, según
  su rol) y fijar una contraseña nueva: la anterior se considera
  comprometida por el tiempo fuera. Es una sola transacción, como la
  creación (SPEC-001 BR-013): no queda una cuenta activa sin equipo.
- **BR-010 · El rol vuelve como estaba, salvo que se cambie.** Por defecto
  reingresa con el rol que tenía al darse de baja; el administrador puede
  elegir otro (`AGENT` o `SUPERVISOR`) en el mismo formulario. Su cartera
  anterior no se le devuelve sola: lo que se liberó al darse de baja ya
  tiene otro dueño o está en la cola.

### Promoción

- **BR-011 · Promover es una acción con nombre.** «Promover a supervisor»
  vive en Personas, sobre un asesor activo, y pide: **un equipo** que va a
  supervisar (más equipos se agregan desde Equipos) y si **sigue vendiendo**
  (SPEC-019: `salesEnabled`). Si sigue vendiendo y el equipo supervisado es
  otro que el suyo, elige explícitamente entre **trasladar su venta** al
  equipo supervisado (una sola membresía, convención SPEC-019) o
  **conservar su equipo de venta** y supervisar el otro (dos membresías:
  la de venta intacta y una de supervisión sin venta) — SPEC-043 BR-006.
  Sube `OrganizationMember.role` a `SUPERVISOR` y aplica lo elegido en una
  transacción. Sus ventas y métricas previas no se tocan (SPEC-019: retirar
  la venta no altera lo histórico).
- **BR-012 · Solo el administrador promueve** (SPEC-001 BR-014), y solo a
  quien está activo y tiene equipo. El modo `SELLING_SUPERVISOR` de
  «asignar integrante» deja de subir el rol en silencio: asignar integrantes
  asigna; promover promueve.

### Trazabilidad

- **BR-013 · Cada cambio de ciclo de vida queda escrito con quién, cuándo y
  por qué.** Una tabla nueva de eventos de persona
  (`person_lifecycle_events`: acción `DISABLED | REENTERED | PROMOTED`,
  actor, motivo, valores anteriores y nuevos, cartera liberada) porque la
  auditoría de equipos exige un equipo y la baja es de la persona, no de
  un equipo. La ficha de la persona en el directorio muestra ese historial.
  La liberación de casos deja además el evento del caso (`ASSIGNED_TO_TEAM`
  o `ASSIGNED_TO_USER`) con la baja como causa.

## 4. Criterios de aceptación

- **AC-001:** dar de baja a un asesor con 3 ventas abiertas, 4 casos de
  recupero interno y 6 de Campañas deja las 3 ventas a su nombre en el
  equipo, los 4 casos sin responsable en la bandeja de su supervisor (o
  asignados al destino elegido) y los 6 de Campañas en el pool del equipo;
  su sesión abierta muere; ya no aparece en ningún selector; sus ventas
  históricas siguen con su nombre en Pedidos y Rendimiento.
- **AC-002:** una venta que llega por el correo de alguien de baja entra al
  pool de huérfanos, no a la persona.
- **AC-003:** el formulario de baja anticipa exactamente los números de
  AC-001 y no permite confirmar sin motivo.
- **AC-004:** el administrador no puede darse de baja a sí mismo ni dejar
  a la organización sin administrador activo.
- **AC-005:** el reingreso deja a la persona `ACTIVE`, con equipo primario,
  contraseña nueva y el mismo `userId`; su rendimiento histórico se lee sin
  cortes; no recupera casos automáticamente.
- **AC-006:** promover a un asesor que sigue vendiendo lo deja
  `SUPERVISOR`, supervisando el equipo elegido, con su membresía de venta
  intacta; la siguiente venta por su correo se le asigna (SPEC-019 AC-2).
  Promoverlo sin venta cierra su membresía de venta y sus ventas nuevas van
  al pool.
- **AC-007:** los tres eventos quedan en `person_lifecycle_events` con
  actor, motivo y valores; la ficha de la persona los muestra.
- **AC-008:** tipos, lint y pruebas en verde; las reglas puras (qué se puede
  hacer a quién, qué se libera) viven en `@repo/validation` con pruebas.

## 5. Decisiones tomadas (supuestos, 05/09/2026)

1. **Ventas abiertas en la baja (BR-004): se quedan a nombre del vendedor.**
   Pesan en su liquidación y el supervisor del equipo ya las gestiona; la
   reasignación manual con motivo sigue disponible para casos puntuales.
2. **Cartera de recupero (BR-005): liberar por defecto, entregar si se elige
   a alguien.** El formulario ofrece los asesores activos con venta del mismo
   equipo; la regla de Crítica se aplica y lo bloqueado queda sin
   responsable, y se dice.
3. **Reingreso con otro correo (BR-008): se permite.** El campo es opcional;
   vacío conserva el correo actual.
4. **Degradar a asesor: después.** Queda como extensión en §6.

Si José prefiere otra opción en cualquiera de los cuatro, el cambio es local
a la acción correspondiente y no toca datos históricos.

## 6. Extensiones previstas, fuera de este incremento

- Degradar `SUPERVISOR → AGENT` con el mismo patrón (evento `DEMOTED`).
- Ausencia temporal (vacaciones) sin baja: pausar la asignación automática
  conservando la cartera.
- Baja de `BACKOFFICE` y `ADMIN` con las mismas garantías.
