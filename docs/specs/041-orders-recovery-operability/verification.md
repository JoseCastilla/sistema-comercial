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

**Limitación declarada**: la base de desarrollo no tiene casos resueltos ni
entregas fallidas por reagendar, así que esas listas se vieron vacías; la
paginación de resueltos no se ejerció. El panel del navegador siguió en modo
lectura, sin clics: la pausa de 300 ms y Enter se verificaron con la prueba
automatizada, no a mano.
