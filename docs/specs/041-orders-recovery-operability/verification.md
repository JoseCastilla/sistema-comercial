# SPEC-041 — Verificación

## Fase 2 — REC-03, PED-01, PED-02 (05/09/2026)

1. **Pruebas puras** — 303 en verde en `@repo/validation`, 8 nuevas:
   - Acción: acepta grupo e acción exacta y rechaza lo demás; un grupo abre
     exactamente las acciones que su indicador cuenta; «Reagendar» abre solo
     reagendar; cada acción pertenece a un único grupo y el selector las
     ofrece todas.
   - Plazo: cuatro tramos; vencido es antes de ahora, pronto son los
     próximos 30 minutos, los otros dos no tienen fecha.
   - Recupero: vista desconocida cae en abiertos; abiertos y resueltos no
     comparten estado; un filtro solo acepta valores de su lista.
2. **Pruebas web** — 114 en verde en `apps/web`, 10 nuevas o ampliadas:
   - Pedidos: «an» no navega y avisa; «ana» navega a los 300 ms exactos;
     Enter con «19» navega al instante; el selector de asesor ofrece a todos
     con su equipo y, con un equipo, solo a los suyos; al cambiar de equipo
     el asesor se conserva solo si pertenece; «Sin asignar» oculta el
     selector; plazo aplica al elegir; acción solo existe en logística; las
     fichas se quitan una a una y «Limpiar filtros» retira todas.
   - Recupero: barra con vista, equipo, responsable, prioridad, motivo,
     estado y vencimiento; los indicadores conservan `q` y `advisor`;
     resueltos sin vencimiento ni asignación, con resultado por fila y
     vuelta a abiertos; páginas que conservan prioridad y vencimiento.
   Tipos y lint limpios.
3. **Recorrido por fetch en local, sesión de administrador** (base de
   desarrollo: 177 ventas entre julio y septiembre, 9 entregas fallidas, 1
   caso de recupero):
   - **Pedidos, paridad indicador ↔ lista**: «Contactar y validar = 4» →
     `?accion=contactar` lista 4; «Por volver a ingresar = 5» → 5; «Visita
     por coordinar = 0» y `?accion=RESCHEDULE` → 0 con el vacío propio de
     logística; «Fuera de plazo = 37» → `status=ACTIVE&plazo=vencido` lista
     37; `plazo=sin_horario` lista 5.
   - **Asesor**: `advisor=<Alexandra Huaranca>` baja las ventas de 177 a 24 y
     fuera de plazo de 37 a 6; el selector ofrece a los asesores con su
     equipo («… · AYACUCHO - MAGISTERIAL»); la ficha «Asesor: …» aparece y se
     quita.
   - **Búsqueda**: `q=1942469714A` → 1 venta; `q=leon` → 5; la ficha «Busca
     «leon»» aparece. `accion=contactar` fuera de la vista logística se
     ignora (177).
   - **Recupero**: barra con Vista, Equipo, Asesor actual, Prioridad,
     Motivo, Estado y Vencimiento; `q=diego&prioridad=CRITICA` encuentra el
     caso crítico y muestra dos fichas; `q=zzzz&estado=WAITING` → vacío
     propio con invitación a limpiar; `view=resueltos` → «Resueltos: 0
     casos», sin selector de vencimiento.

4. **Producción tras el despliegue, solo lectura** (commit 94da5f1, minutos
   después; sesión de administrador, sin ejecutar ninguna acción):
   - **Pedidos**: la barra muestra Equipo, Asesor y Plazo (y Acción solo en
     logística); 256 ventas del mes; «Fuera de plazo = 12» → `status=ACTIVE&
     plazo=vencido` lista **12**.
   - **Logística, paridad indicador ↔ lista** sobre 337 entregas fallidas:
     «Visita por coordinar = 17» → `accion=coordinar` **17**; «Contactar y
     validar = 132» → **132**; «Por volver a ingresar = 188» → **188**. La
     suma (337) coincide con «Casos por revisar».
   - **Recupero** (68 abiertos, 61 primer contacto + 3 seguimiento + 0
     agenda): barra con Vista, Equipo, Asesor actual, Prioridad, Motivo,
     Estado y Vencimiento; `?prioridad=MEDIA` lista 25 filas, todas «Media»,
     con la ficha «Prioridad: Media», «25 caso(s) cumplen el filtro» y los
     indicadores intactos en 68/61/3 (acotan por alcance, no por prioridad;
     sus enlaces conservan `prioridad=MEDIA`). `?view=resueltos` →
     «Resueltos: 0 casos» sin selector de vencimiento: todavía no hay casos
     resueltos en el carril interno.

   Nota de método: la página se sirve con filas en streaming (React las
   emite en fragmentos que el cliente recoloca), así que el HTML crudo no
   sirve para contar filas; el conteo de Recupero se hizo sobre el DOM ya
   hidratado.

**Limitación declarada**: la base de desarrollo no tiene casos resueltos ni
entregas fallidas por reagendar, así que esas listas se vieron vacías; la
paginación de resueltos no se ejerció. El panel del navegador siguió en modo
lectura, sin clics: la pausa de 300 ms y Enter se verificaron con la prueba
automatizada, no a mano.

## Fase 3 — NAV-02, REC-04, REC-05 (05/09/2026)

1. **Pruebas puras** — 309 en verde en `@repo/validation`, 6 nuevas sobre la
   etapa de la cadencia: sin contacto manda el plazo de dos horas y se dice
   la hora límite; la próxima acción se reconoce como toque D1/D3/D7 desde la
   toma, vencido incluido; una agenda futura suspende y una pasada vence; un
   rechazo es pausa, no toque; en espera de confirmación nada vence; siete
   días cumplidos sin acción futura es «Cadencia agotada» (un D7 exacto
   pasado sigue siendo un toque vencido, a propósito).
2. **Pruebas web** — 121 en verde en `apps/web`, 7 nuevas: el panel del
   pedido muestra el caso abierto con responsable y enlace, el resuelto con
   fecha, enlace y «Enviar a recupero otra vez», y nada sin caso ni permiso;
   en la bandeja, reasignar solo se abre al pulsarlo, la fila enseña
   teléfono, última gestión y «Toque D3» con su explicación, «Registrar
   gestión» abre el editor con los teléfonos del caso, y quien no puede
   gestionar no ve el botón. Tipos y lint limpios.
3. **Recorrido por fetch en local, sesión de administrador** (1 caso de
   recupero, asignado, con un intento registrado):
   - Bandeja: ocho columnas (se suma «Última gestión»); la fila trae DNI y
     teléfono copiables (`72179861 ⧉`, `946944307 ⧉`), los botones
     «Reasignar» y «Registrar gestión» y ningún formulario abierto; la
     próxima acción dice «31/8, 00:56 · Seguimiento vencido»; la última
     gestión «Vendido: aceptó de nuevo · 30/8, 19:29».
   - Ficha: el indicador pasa de «Próxima acción» a «Seguimiento vencido ·
     31/8, 00:56 · La próxima acción quedó atrás»; nuevo panel «Plazo del
     recupero» con la cadencia del carril interno y la aclaración de que es
     independiente del plazo de entrega.
   - Pedido `1942469714A`: el panel dice «En recuperación» y enlaza a
     `/recovery/sales/a77c4588-…`, el caso correcto.

4. **Producción tras el despliegue, solo lectura** (commit 5d1baf1, minutos
   después; sesión de administrador, sin ejecutar ninguna acción, sobre el
   DOM hidratado):
   - Bandeja: 69 casos abiertos (61 primer contacto + 3 seguimiento + 0
     agenda), ocho columnas, **cero** formularios de reasignación abiertos y
     69 botones «Reasignar» y 69 «Registrar gestión»; cada fila con DNI y
     teléfono copiables. Etapas presentes: «Primer contacto vencido»,
     «Primer contacto» y «Seguimiento vencido».
   - Ficha de un caso sin contacto (venta 1956917271A): «Primer contacto ·
     5/9, 14:24 · Hay que llamar antes de las 14:24: son dos horas desde que
     la venta se cayó» y el panel «Plazo del recupero».
   - Ficha de un caso con contacto (venta 1954471228A): «Toque D1 · 2/9,
     19:26 · El toque del día 1 de la cadencia quedó atrás»; en la fila el
     mismo caso se rotula «Seguimiento vencido» (el vencimiento de BR-095
     manda en la fila; la ficha nombra la etapa).
   - Pedido 1954471228A, abierto en su día (`period=RANGE&from=2026-08-30`):
     el panel dice «En recuperación» y enlaza a `/recovery/sales/c544f891-…`,
     el mismo caso que la bandeja.

**Limitación declarada**: sin casos resueltos en local, «Recupero cerrado»
solo se vio en la prueba automatizada; el editor en fila se abrió y se
comprobó su contenido, pero no se guardó ninguna gestión real (sería una
escritura). La cola «Por recuperar» con su aclaración no apareció porque el
rango consultado no tenía candidatos.

