# SPEC-043 — Personas y Equipos operativos

Estado: **fases 1 a 3 desplegadas; PE-07 («Mi equipo») construido** (05/09/2026). Une dos planes revisados
con José el mismo día: «Plan actualizado de Personas y Equipos» (PE-01 a
PE-07) y «Plan de mejora UX de Personas y Equipos» (UX-01 a UX-08). Se apoya
en SPEC-001 (equipos), SPEC-017 (directorios), SPEC-019 (supervisor que
vende) y SPEC-042 (baja, reingreso, promoción); no reconstruye nada de lo que
esas specs ya entregaron.

## 1. Origen

Personas y Equipos nacieron como directorios administrativos (SPEC-017) y
SPEC-042 les sumó acciones de ciclo de vida. Al revisarlos juntos aparecen
tres tipos de problema:

- **Densidad y claridad**: la fila de Personas creció con botones apilados,
  el nombre largo se truncaba, y la creación ocupaba un bloque antes del
  listado.
- **Coherencia de comportamiento**: promover a otro equipo trasladaba la
  venta por convención (SPEC-019) sin ofrecer la alternativa de conservar el
  equipo de venta; la spec hablaba de «equipo(s)» y la acción acepta uno;
  deshabilitar un equipo solo decía cuántas membresías cerraba.
- **Indicadores y navegación**: ninguna cifra abre lo que cuenta, los filtros
  se aplican con botón, «Asesores asignados» en Equipos cuenta supervisores
  vendedores mientras las tarjetas cuentan integrantes con función asesor,
  y Personas y Equipos no se enlazan.

## 2. Verificación de los hallazgos (05/09/2026, lectura del código)

| Ítem | Hallazgo | Contraste |
|---|---|---|
| PE-01 | Promoción traslada la venta sin explicarlo | A medias: el panel avisaba el traslado, pero no ofrecía conservar el equipo de venta ni mostraba el equipo actual; la spec decía «equipo(s)». |
| PE-02 | Reingreso sin verificación de punta a punta | Real: exige una contraseña; lo ejecuta José con una cuenta de prueba. |
| PE-03 / UX-06 | Filtros con botón, indicadores sin enlace, sin filtro de capacidad de venta; Equipos sin filtros | Real. «ADMIN y BACKOFFICE no cuentan como incompletos» ya se cumplía. |
| PE-04 / UX-07 | Personas y Equipos desconectados | Real: ni el equipo ni el integrante son enlaces. |
| PE-05 | Renombrar, retirar supervisión, reactivar | Real: solo crear, deshabilitar y asignar. |
| PE-06 | Deshabilitar equipo solo dice «N membresías» | Real. |
| PE-07 | Supervisor no crea asesores (SPEC-001 BR-011) | Real, y exige una superficie propia: `/admin/users` es de administrador. |
| UX-01 | Botones apilados y nombre truncado | Real: `white-space: nowrap` con puntos suspensivos, y la fila crecía con las acciones. |
| UX-05 | Indicadores de Equipos mezclan rol y capacidad de venta | Real: `activeAgentIds` cuenta `salesEnabled` (incluye supervisores vendedores) y las tarjetas cuentan `memberRole = AGENT`. |

## 3. Reglas

### Fase 1 — Claridad y densidad (UX-01, UX-02, UX-03, PE-01)

- **BR-001 · La fila compara; el panel administra.** Cada fila de Personas
  muestra nombre completo (hasta dos líneas, sin puntos suspensivos), correo,
  rol, equipo y estado, y **una sola acción**: «Administrar». Ningún
  formulario ni botón de acción vive en la fila; la altura de la fila no
  depende de cuántas acciones existan.
- **BR-002 · Una persona a la vez, en la URL.** «Administrar» abre un panel
  lateral con `persona=<id>` conservando búsqueda y filtros; el enlace se
  puede compartir y el botón Atrás lo cierra. En pantallas angostas el panel
  ocupa el ancho y va antes de la lista. Abrirlo no ejecuta nada.
- **BR-003 · El panel dice quién es antes de qué hacer.** Cabecera fija con
  nombre, correo, rol y estado; secciones «Identidad» (desde cuándo, correo
  verificado), «Relaciones comerciales» (equipo comercial y equipos
  supervisados, por separado; «No requiere equipo» para administración y
  back office), «Ciclo de vida» (las acciones de SPEC-042 que el estado
  permite, con «Dar de baja» en tono de cuidado y aparte), «Seguridad»
  (cambiar contraseña) e «Historial».
- **BR-004 · Cerrar devuelve el foco a la fila.** El cierre lleva
  `#persona-<id>`; la fila de origen recibe el foco y se marca como actual
  mientras el panel está abierto.
- **BR-005 · Crear vive junto al título.** «Nueva persona» y «Nuevo equipo»
  son un enlace en la cabecera (`nueva=1` / `nuevo=1`) que abre el
  formulario en el mismo panel lateral; desaparece el bloque plegable previo
  al listado. Los indicadores y los filtros no cambian de sitio en esta fase.
- **BR-006 · Promover dice dónde quedan las ventas nuevas.** El panel de
  promoción muestra «Hoy: asesor en X», acepta **un equipo por promoción**
  (más equipos se agregan desde Equipos) y, si sigue vendiendo y el equipo
  supervisado es otro, obliga a elegir entre **trasladar la venta** al equipo
  supervisado (una sola membresía, convención SPEC-019) o **conservar su
  equipo de venta** y supervisar el otro (dos membresías: la de venta intacta
  y una de supervisión sin venta). Nada se traslada sin quedar expresado; las
  ventas históricas conservan su equipo. Sustituye la redacción «equipo(s)»
  de SPEC-042 BR-011.

### Fase 2 — Indicadores comprensibles (UX-04, UX-05, PE-06)

- **BR-007** Cada indicador de riesgo abre la lista que cuenta: «Asesores sin
  equipo» abre Personas filtrada; «Sin supervisor» abre Equipos filtrada. El
  contador y la lista son la misma función.
- **BR-008** Equipos distingue rol de capacidad de venta: «Personas
  habilitadas para vender» (asesores + supervisores vendedores) y, por
  equipo, asesores y supervisores vendedores por separado. «Supervisores
  disponibles» pasa a «Supervisores» con la definición visible.
- **BR-009** Deshabilitar un equipo anticipa las personas que pierden su
  equipo operativo, las supervisiones afectadas y cuánto trabajo abierto
  (ventas, casos de recupero) tiene asignado; **no** da de baja a nadie ni
  libera cartera personal, y lo dice.

### Fase 3 — Navegación y continuidad (UX-06, UX-07, UX-08, PE-05, PE-07)

- **BR-010** Filtros en vivo con la mecánica de Campañas y Pedidos (URL, 300
  ms, Enter, fichas quitables), con «Capacidad de venta» y «Sin equipo
  operativo» en Personas y búsqueda, estado, supervisión y supervisor en
  Equipos.
- **BR-011** Personas ↔ Equipos enlazados en ambos sentidos conservando
  contexto.
- **BR-012** Los formularios comparten la estructura Persona → Cambio →
  Consecuencias → Confirmación; ningún borrador se pierde en silencio.
- **BR-013** Renombrar equipos (SPEC-001 FR-001) con unicidad entre activos;
  retirar una supervisión avisa si el equipo queda sin supervisor (SPEC-017
  BR-009); reactivar un equipo lo devuelve vacío, sin restaurar membresías.
- **BR-014 · «Mi equipo» del supervisor.** José eligió la opción A: una
  página `/team` para `SUPERVISOR` con sus equipos activos y sus integrantes
  en lectura, y una sola acción, «Nuevo asesor» (SPEC-001 BR-011 a BR-013):
  rol `AGENT` fijo, equipo elegido solo entre los que supervisa, cuenta +
  membresía de organización + membresía comercial primaria con venta en un
  alta atómica (`provisionUser`; si una etapa falla, no queda cuenta a
  medias), auditoría `MEMBER_ASSIGNED` con `createdBySupervisor`. El
  administrador que entra a `/team` va a Equipos; asesor y back office, a
  acceso denegado. La autorización vive en el servidor
  (`canCreateAgentForTeam`). «Mi equipo» aparece en la navegación solo para
  supervisores.
- **BR-015 · Retirar una supervisión toca solo esa relación.** Si la persona
  vende en el equipo, su membresía sigue activa como asesora (sus ventas
  nuevas se le siguen asignando); si no, se cierra con fecha. El rol de la
  organización no cambia. Si era la única supervisión, se avisa que el equipo
  queda sin supervisor; no se bloquea (SPEC-017 BR-009).
- **BR-016 · Reactivar devuelve el equipo vacío.** Las membresías cerradas al
  deshabilitarlo no se restauran; se rearma a mano. No se reactiva si otro
  equipo activo se llama igual.
- **BR-017 · Renombrar conserva la identidad.** Cambia nombre y código; el id,
  las ventas, los casos y el historial no se tocan; el nombre sigue único
  entre activos.

## 4. Criterios de aceptación de la fase 1

- **AC-001:** en Personas, una fila con nombre de cuatro palabras se lee
  completa; ninguna fila tiene botones de acción; todas tienen «Administrar».
- **AC-002:** `?q=ana&persona=<id>` abre el panel con esa persona y la lista
  sigue filtrada por «ana»; «Cerrar» vuelve a `?q=ana#persona-<id>` y la fila
  queda enfocada.
- **AC-003:** el panel muestra nombre, correo, rol, estado, «Desde», correo
  verificado, equipo comercial y equipos supervisados por separado; para
  ADMIN dice «No requiere equipo» y no ofrece ciclo de vida.
- **AC-004:** «Nueva persona» vive en la cabecera y abre el formulario en el
  panel; el bloque plegable anterior desaparece. Igual «Nuevo equipo».
- **AC-005:** promover a otro equipo sin cambiar la venta ofrece las dos
  opciones; con «conserva» la membresía de venta sigue activa y la de
  supervisión nace sin venta; con «traslada» ocurre lo de SPEC-019.
- **AC-006:** tipos, lint y pruebas en verde.

## 5. Fuera de alcance

Baja de ADMIN o BACKOFFICE; degradación; ausencias temporales; fusión de
cuentas; cambios retroactivos en ventas y comisiones; modificar personas
reales para probar (se usan cuentas de prueba ficticias).
