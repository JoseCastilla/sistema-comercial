# SPEC-043 — Verificación

## Fase 1 · Claridad y densidad (05/09/2026)

1. **Pruebas web** — 132 en verde en `apps/web`, 11 sobre esta fase:
   - Panel (`personas-panel.test.tsx`, 4): nombra a la persona completa con
     correo, rol y estado y cierra hacia `?q=ana#persona-u-1`; separa
     «Equipo comercial» de «Supervisa»; agrupa Seguridad y Ciclo de vida y
     muestra el historial; para ADMIN dice «No requiere equipo» y no ofrece
     ciclo de vida.
   - Ciclo de vida (`personas-ciclo-de-vida.test.tsx`, 7): acciones por
     estado y rol; nadie se da de baja a sí mismo; la baja anticipa con
     números y exige motivo; promover muestra «Hoy: asesor en Lima Centro»,
     propone ese equipo y sin cambio de equipo no ofrece radios; supervisar
     otro equipo obliga a elegir entre «Supervisa y vende en Huancayo»
     (`MOVE`, marcado por defecto) y «Sigue vendiendo en Lima Centro y
     supervisa Huancayo» (`KEEP`); el reingreso pide equipo y contraseña;
     sin acciones posibles lo dice.
   Tipos y lint limpios.
2. **Recorrido local con sesión de administrador** (`/admin/users?q=an`, 8
   filas):
   - Ninguna fila tiene botones (0) ni bloque plegable de creación (0); todas
     enlazan a «Administrar» conservando `q=an`; la fila de un nombre de
     cuatro palabras mide 85 px y las demás 67 px (antes crecían con cada
     acción). «Nueva persona» vive en la cabecera → `?q=an&nueva=1`.
   - `?q=an&persona=<Angieska>`: el espacio de trabajo abre en dos columnas,
     la fila queda marcada como actual y su enlace pasa a «Cerrar»; el panel
     (416 px) titula «Angieska De Los Rios», correo, «Supervisor» y «Activo»;
     secciones Identidad (Desde 09/08/2026, correo verificado), Relaciones
     comerciales (Equipo comercial AYACUCHO - MAGISTERIAL · Supervisa
     AYACUCHO - MAGISTERIAL), Ciclo de vida («Dar de baja» en tono de
     cuidado), Seguridad («Cambiar contraseña») e Historial (la promoción
     del día, con actor y resumen). «Cerrar» → `?q=an#persona-<id>`.
   - `?q=an&nueva=1`: el panel «Nueva persona» con nombre, correo, rol y
     contraseña; el enlace de cabecera pasa a «Cerrar» → `?q=an`.
   - `/admin/teams?nuevo=1`: «Nuevo equipo» en la cabecera abre el panel con
     nombre y código; sin bloque plegable; «Cerrar» → `/admin/teams`.
   - Ninguna escritura: abrir paneles no ejecuta nada.

**Limitación declarada**: la promoción con «conserva su equipo de venta»
(`KEEP`) está cubierta por la prueba del formulario y por la lectura de la
acción; no se ejecutó en local porque exigiría promover a una persona con
nombre real (regla: solo cuentas de prueba). El foco de vuelta a la fila
(`ReturnFocus`) se comprueba a mano con teclado.

3. **Producción, solo lectura** (commit f7b4ca8, sesión de administrador):
   `/admin/users?q=a` → 25 filas, ninguna con botones, alturas 85/67 px,
   «Administrar» → `?q=a&persona=<id>`, «Nueva persona» → `?q=a&nueva=1`,
   sin bloque plegable.

## Fase 2 · Indicadores comprensibles (05/09/2026)

1. **Pruebas** — 138 en verde en `apps/web`, 6 nuevas: la plantilla separa
   asesores, supervisores y supervisores que venden y cuenta vendedores sin
   repetir; un equipo activo sin supervisor necesita supervisión y uno
   deshabilitado no; la confirmación de deshabilitar nombra a quien pierde
   equipo, cuenta supervisiones y trabajo abierto, y sin nada lo dice; el
   panel de un asesor sin equipo ofrece «Asignar equipo principal» y con
   equipo no. Tipos y lint limpios.
2. **Recorrido local con sesión de administrador**:
   - `/admin/teams`: métricas «Equipos activos 4», «Personas habilitadas para
     vender 13 · Asesores y supervisores que venden, en equipos activos»,
     «Supervisores 3 · Con al menos un equipo activo a cargo», «Sin
     supervisor 1 → /admin/teams?sinSupervisor=1». La tarjeta de AYACUCHO -
     MAGISTERIAL dice «6 asesores · 1 supervisor(es) que venden»; la de
     AYACUCHO - EXTERNOS («Sin supervisor») abre su formulario con la función
     «Supervisor» preseleccionada y el resumen «Asignar supervisor».
   - Confirmación de deshabilitar, leída del diálogo sin abrirlo: para
     Huancayo «3 persona(s) pierden su equipo operativo…: FRANCESCO…, SARAI…,
     Steven Lizarraga», «1 supervisión(es) se cierran: Erika Lavado», «7
     venta(s) abiertas y 1 caso(s) de recupero… conservan el equipo
     registrado»; para MAGISTERIAL 02 «No hay ventas abiertas ni casos». La
     primera línea siempre dice que no da de baja a nadie.
   - `/admin/teams?sinSupervisor=1`: «Mostrando solo los 1 equipo(s) activos
     sin supervisor · Ver todos los equipos», con AYACUCHO - EXTERNOS como
     única tarjeta: el indicador y la lista cuentan lo mismo.
   - `/admin/users?situacion=sin-equipo`: el selector «Situación» queda en
     «Asesores sin equipo operativo», «0 resultados», «Limpiar» visible; la
     métrica «Asesores sin equipo» se oculta en cero (la definición ahora
     exige cuenta activa, así que Christian, de baja, ya no cuenta).
   - Ninguna escritura: los diálogos no se confirmaron.

**Limitación declarada**: en local no hay asesor activo sin equipo, así que
«Asignar equipo» desde el panel se vio solo en la prueba automatizada.

3. **Producción, solo lectura** (commit 8228d10, sesión de administrador,
   sin confirmar ningún diálogo): `/admin/teams` muestra «Equipos activos 4»,
   «Personas habilitadas para vender 20», «Supervisores 2» y **«Sin
   supervisor 2 → ?sinSupervisor=1»**. Las tarjetas cuentan por separado
   («3 asesores · 1 supervisor(es) que venden» en MAGISTERIAL 02). Las
   confirmaciones de deshabilitar, leídas del diálogo, traen los datos
   reales: MAGISTERIAL 01 «8 persona(s) pierden su equipo operativo… 53
   venta(s) abiertas y 933 caso(s) de recupero»; HUANCAYO - EL TAMBO «1
   supervisión(es) se cierran: Erika Lavado · 27 venta(s) y 274 caso(s)».

**Hallazgo operativo para José**: en producción hay **dos equipos activos sin
supervisor** —AYACUCHO - EXTERNOS (2 asesores, 1 venta abierta) y **AYACUCHO -
MAGISTERIAL 01 (8 asesores, 53 ventas abiertas, 933 casos de recupero)**—;
nadie los ve ni gestiona desde supervisión. El indicador ahora lo enseña y
abre la lista con el formulario pidiendo un supervisor.

## Fase 3 · Navegación y continuidad (05/09/2026)

1. **Pruebas** — 141 en verde en `apps/web`, 3 nuevas sobre la barra
   compartida (`directorio-filtros.test.tsx`): espera 300 ms y dos
   caracteres, conserva el panel abierto y los demás filtros en la URL; Enter
   aplica al instante y los selectores al cambiar; las fichas se quitan una a
   una y «Limpiar filtros» deja solo el panel. El panel comprueba además que
   cada equipo supervisado enlaza a su tarjeta. Tipos y lint limpios; la
   migración `add_team_audit_actions` se aplicó en local.
2. **Recorrido local con sesión de administrador** (dev server reiniciado
   para tomar el cliente Prisma):
   - `/admin/teams?q=huan&supervision=con`: barra con Estado, Supervisión y
     Supervisor, fichas «Busca «huan»» y «Supervisión: Con supervisor», «1
     equipo»; la tarjeta de Huancayo enlaza a cada integrante con
     `/admin/users?persona=<id>`, ofrece «Agregar o trasladar integrante»,
     «Renombrar» (nombre y código), «Retirar supervisión» junto a Erika
     Lavado y «Deshabilitar»; el historial muestra las asignaciones de
     agosto («Integrante asignado · Steven Lizarraga · asesor · vende aquí ·
     22/08/2026, 10:36 · Jose Castilla»). El indicador «Sin supervisor»
     enlaza a `?supervision=sin`.
   - `/admin/teams?equipo=<Huancayo>#equipo-<id>`: la tarjeta llega abierta
     y con el foco (`document.activeElement` es la tarjeta); ninguna otra
     abierta.
   - `/admin/users?venta=si&q=an`: la barra en vivo reemplaza al formulario
     GET (0 `form.ui-admin-toolbar`), con Rol, Equipo, Estado, Capacidad de
     venta y Situación; fichas «Busca «an»» y «Capacidad de venta: Vende»;
     cada fila enlaza su equipo a `/admin/teams?equipo=<id>#equipo-<id>` y
     «Administrar» conserva `q` y `venta`.
   - Panel de Angieska: el guardián de borradores envuelve el contenido
     (`data-dirty` ausente sin cambios), «Equipo comercial» y «Supervisa»
     enlazan a la tarjeta del equipo, «Cerrar» vuelve a `?q=an#persona-<id>`.
   - Ninguna escritura: renombrar, retirar supervisión, reactivar y
     deshabilitar se dejaron en su diálogo sin confirmar; las acciones están
     cubiertas por lectura de código y por las reglas de la spec.

**Limitación declarada**: no hay equipos deshabilitados en la base local, así
que «Reactivar» no se vio renderizado; su acción y su diálogo existen y el
código está revisado. El aviso de borrador (`beforeunload` / confirmación al
cerrar) se comprueba a mano escribiendo en un formulario del panel y cerrando.

3. **Producción, solo lectura** (commit f27886d, sesión de administrador,
   sin ejecutar ninguna acción): `/admin/teams?supervision=sin` muestra la
   barra en vivo (Estado, Supervisión = sin, Supervisor), la ficha
   «Supervisión: Sin supervisor» y «2 equipos»: AYACUCHO - EXTERNOS y
   AYACUCHO - MAGISTERIAL 01, cada uno con «Asignar supervisor» abierto,
   «Renombrar», sus integrantes enlazados a Personas (2 y 8) e «Historial (3)»
   e «Historial (8)» de la auditoría existente. `/admin/users?venta=no` carga
   la barra en vivo (ya sin formulario GET), la ficha «Capacidad de venta: No
   vende» y 5 personas que no venden (administración, back office,
   supervisores sin venta y un asesor sin equipo). La migración de auditoría
   corrió con el despliegue.

## PE-07 · «Mi equipo» del supervisor (05/09/2026)

1. **Pruebas** — `canCreateAgentForTeam` (2 casos: un supervisor solo en
   equipos activos que supervisa; administración en cualquier activo; asesor
   y back office en ninguno), 316 en verde en `@repo/validation`. Web: el
   alta desde «Mi equipo» no ofrece rol, limita el equipo a los supervisados,
   exige contraseña de 12 caracteres, preselecciona el único equipo y sin
   equipos no deja crear; 143 en verde. Tipos y lint limpios.
2. **Local con sesión de administrador**: `/team` redirige a
   `/admin/teams` y la navegación del administrador no muestra «Mi equipo»
   (es solo de supervisores). `createUserAction` pasó a usar `provisionUser`
   sin cambiar su comportamiento.

**Limitación declarada**: no dispongo de una sesión de supervisor, así que la
página `/team` con equipos reales y el alta de un asesor quedan para que José
las ejercite con la cuenta de un supervisor (con un asesor de prueba
ficticio). El código está revisado y cubierto por las reglas puras y la prueba
del formulario.

