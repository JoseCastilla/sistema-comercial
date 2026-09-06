# SPEC-045 — Verificación

## Fase 1 (06/09/2026)

1. **Pruebas** — 182 en verde en `apps/web` (2 nuevas, `campanas-etapas`) y
   318 en `@repo/validation` (2 nuevas, `recovery-internal-due-filter`):
   «vencido» es filtro y no vencimiento; abre los tres vencimientos y nada
   más; los nombres de etapa no se repiten y cada uno abre su destino. Tipos
   y lint limpios.
2. **Recorrido local con sesión de administrador** (José la abrió tras la
   entrega):
   - PL-02: `/api/order-escalations/notifications` → `recoveryOverdue: 1`;
     `/recovery/sales?vence=vencido` → «Cualquier vencimiento: 1 caso · 1
     caso(s) cumplen el filtro»; el selector ofrece «Cualquier vencimiento»
     antes de los tres vencimientos (AC-001).
   - PL-03: Preparar «Falta consultar 0 · Verificados por entregar 0 · Con
     pedido en curso 0 · Disponibles para asignar 0 · En gestión 38 ·
     Recuperados 0»; Revisar y Repartir con los mismos nombres; cada contador
     enlaza a `triage?view=…`, `distribute?view=…` o `follow-up` (AC-002).
   - PL-05: «Un equipo no tiene supervisor: administración cubre su cuota y su
     recupero mientras no lo tenga. Asignar supervisor» →
     `/admin/teams?sinSupervisor=1`; la fila de EXTERNOS enlaza «Sin
     supervisor · lo cubre administración» → `/admin/teams?equipo=<id>`
     (AC-003). Se retiró un enlace «Repartir su cuota» que duplicaba «Asignar
     cuotas» en la misma cabecera.
   - PL-06: «Pedidos que requieren acción 9» → `/orders?status=LOGISTICS` →
     **9 órdenes** (AC-004).
3. **Lectura de producción con sesión de administrador** (solo lectura, tras
   el despliegue de `c146d67`):
   - PL-02: alerta «⏰ 70 recupero(s) vencido(s)» → `/recovery/sales?vence=
     vencido` → «Cualquier vencimiento: 70 casos · 70 caso(s) cumplen el
     filtro»; `recoveryOverdue: 70` (AC-001).
   - PL-03: Preparar «Falta consultar 396 · Verificados por entregar 270 · Con
     pedido en curso 34 · Disponibles para asignar 186 · Recuperados 2»;
     Revisar «Verificados por entregar 270 · Falta consultar 396 · Con pedido
     en curso 34 · Disponibles para asignar 186»; Repartir «Disponibles para
     asignar 186 · Asignados sin gestión 305 · En gestión 1 284 · En revisión
     700» (= 396 + 270 + 34). Los 270 y 186 del plan ya no se confunden
     (AC-002). **Hallazgo corregido en el mismo recorrido**: «En gestión» daba
     1 589 en Preparar y 1 284 en Repartir porque Preparar sumaba los 305
     asignados sin gestión; Preparar adopta la definición de Repartir y
     muestra «Asignados sin gestión» aparte.
   - PL-05: «2 equipos no tienen supervisor: administración cubre su cuota y
     su recupero mientras no lo tenga. Asignar supervisor» →
     `/admin/teams?sinSupervisor=1`; las filas de MAGISTERIAL 01 y EXTERNOS
     enlazan a su tarjeta (AC-003).
   - PL-06: «Pedidos que requieren acción 347» → `/orders?status=LOGISTICS`
     → «50 en esta página de **347** encontradas» (AC-004).

## Fase 2 (06/09/2026)

1. **Pruebas** — 187 en verde en `apps/web` (5 nuevas,
   `campanas-reparto-carga`): el reparto equitativo da el residuo a quien
   menos abiertos tiene y suma lo seleccionado; sin participantes no hay
   reparto; la directa carga todo a una persona; cada pendiente del resumen
   tiene definición, responsable y destino propio; sin integración logística
   el bloque no aparece y ningún bloque tiene total. Tipos y lint limpios.
2. **Recorrido local con sesión de administrador**:
   - Tablero: panel «Pendientes por resolver o cubrir» entre «Pendientes de
     intervención» y el desglose, con Recupero de ventas (casos vencidos 1 →
     `vence=vencido`; críticas sin responsable 1 → `prioridad=CRITICA&estado=
     OPEN`), Campañas (asignados sin gestión 36 → `distribute?view=unworked`;
     próxima acción vencida 38 → `follow-up?next=vencida`), Personas y
     equipos (equipos sin supervisor 1 → `admin/teams?sinSupervisor=1`) y
     Logística (9 → `orders?status=LOGISTICS`). Los ceros no enlazan. Con
     `team=<id>` el panel no aparece (AC-006).
   - {local}
3. **Lectura de producción con sesión de administrador** (solo lectura, tras
   el despliegue de `07caeb3`):
   - Panel «Pendientes por resolver o cubrir»: Recupero (casos vencidos
     **70** → bandeja «70 caso(s) cumplen el filtro»; críticas sin responsable
     0), Campañas (falta consultar 396, verificados por entregar 270,
     disponibles 186, asignados sin gestión **302** → Repartir «302»; próxima
     acción vencida **1 502** → Seguimiento «1 502 caso(s)»), Personas y
     equipos (equipos sin supervisor 2, asesores activos sin equipo 1,
     incidencias 0), Logística (**347** → Pedidos «347 encontradas») (AC-006).
   - Repartir muestra la tabla «Participa · … · Recibiría · Quedaría» (AC-007).
   - Logística dice «Automática cuatro veces al día, a las 08:00, 12:00,
     15:00 y 18:00 (hora de Lima); cualquier otra consulta es manual»
     (SPEC-046 BR-007).

**Hallazgo operativo para José**: 1 502 casos de campaña en gestión tienen la
próxima acción vencida y 302 llevan dueño sin ningún intento; el resumen lo
pone a la vista y cada cifra abre su lista.

## Fase 3 (06/09/2026)

1. **Pruebas** — 191 en verde en `apps/web` (4 nuevas, `logistica-horario`:
   cuatro horas, clave de ventana por hora pasada, última esperada y próxima,
   margen de diez minutos y siguiente de mañana) y 318 en `@repo/validation`
   (`recovery-follow-up` ajustado a `attemptsInPeriod`). Tipos y lint
   limpios.
2. **Recorrido local con sesión de administrador**:
   - Logística: «Datos de Máximo al: 6/09/26, 8:25 · Pantalla generada:
     6/09/26, 8:49 · Próxima consulta automática: hoy a las 12:00; la dispara
     el proceso de fondo en los cinco minutos siguientes, o quien abra Pedidos
     si el proceso no está»; sin aviso de atraso porque la consulta de las
     08:00 ya corrió (AC-008).
   - Tablero de Campañas con `periodo=semana`: «Trabajados 2» →
     `/recovery/follow-up?worked=hoy&periodo=semana` → «2 caso(s) cumplen el
     filtro», indicador «Con gestión · últimos 7 días 2» y selector de
     período (AC-009).
   - Resumen por equipo con la rejilla `--teams` y cabecera/columna fijas
     (AC-010).
3. **Lectura de producción con sesión de administrador** (solo lectura, tras
   el despliegue de `7e2577d`):
   - Logística: «Datos de Máximo al: 6/09/26, 8:33 · Pantalla generada:
     6/09/26, 8:56 · Próxima consulta automática: hoy a las 12:00…», sin
     aviso de atraso (AC-008).
   - Tablero de Campañas → Seguimiento, «Trabajados» por período: hoy **1 =
     1**, ayer **483 = 483**, últimos 7 días **1 255 = 1 255**, últimos 30
     días **1 255 = 1 255**, con `worked=hoy&periodo=<clave>` (AC-009).
   - Resumen por equipo con rejilla `--teams`; HUANCAYO - EL TAMBO muestra
     «5/5 todos con ventas · 6 personas en el equipo» (la supervisora no
     vende) (AC-010).

## Fase 4 (06/09/2026)

1. **Pruebas** — 193 en verde en `apps/web` (2 nuevas, `dni-actividad`):
   separación de nuevas y guardadas; la organización solo cuando se pide.
   Tipos y lint limpios.
2. **Recorrido local con sesión de administrador**: DNI con «Tu actividad» (mes, hoy, DNI distintos; pista «0 nuevas al proveedor · 0 desde la ficha guardada») y «Toda la organización» aparte, saldo «que reportó el proveedor en la última consulta nueva, el 29 ago. 2026…; no es un saldo en tiempo real» (AC-011). Importar ventas DITO: «Ver el historial completo (6 cargas)» → «Historial de cargas · página 1 de 1», tabla sin ningún formulario de borrado (AC-012). «Checa tus líneas» con el texto sobre lo no auditado y la salida externa; a 375 px sin desbordamiento horizontal, marco de 323 × 841 con el botón «Abrir fuera del sistema» visible (AC-013).
