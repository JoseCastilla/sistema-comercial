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
