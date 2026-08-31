# Verificación — SPEC-038

## Automatizada — 31/08/2026

- [x] 206 pruebas de dominio en verde, con siete casos nuevos sobre las
      ventanas:
      - la segunda ventana toma el 26 y el 31 de agosto y deja fuera el 20;
      - 18 confirmadas en la segunda ventana valen S/ 130 (AC-002);
      - 32 en la primera más 18 en la segunda suman S/ 330 de acelerador y se
        agregan a la comisión base (AC-003);
      - los días 16, 20 y 24 no pertenecen a ninguna ventana pero sí pagan
        comisión base (BR-002);
      - una venta ingresada el 14 y cerrada el 22 cuenta en la primera
        ventana (AC-004);
      - portabilidad entregada sin cerrar suma a la cuota y no al acelerador,
        y un alta nueva entregada no suma a ninguno (BR-007);
      - el siguiente objetivo expone cuántas faltan y cuánto vale (AC-009).
- [x] Cuatro pruebas nuevas del formateador de nombres con los casos reales de
      la operación, incluido el apellido compuesto "DE LOS RIOS".
- [x] Dos pruebas existentes actualizadas a la forma nueva del acelerador; no
      se relajó ninguna aserción.
- [x] TypeScript y lint de `apps/web` y `packages/validation` sin errores.

## Visual — datos reales, 31/08/2026

- [x] **AC-011:** la matriz por asesor muestra "Christian Ruiz", "Sarai
      Flores", "Francesco Gala" y "Steven Lizarraga" en lugar de las grafías
      en mayúsculas o minúsculas del registro. El dato guardado no cambió.
- [x] El panel de comisión presenta **las dos ventanas**: "Acelerador 1–15" y
      "Acelerador 25–fin", cada una con sus confirmadas sobre ingresadas.
- [x] La segunda ventana aparece en cero para el período local, que no tiene
      ventas después del día 25 — comportamiento correcto, no ausencia de la
      regla.

## Cuotas — sesión SUPERVISOR real, 31/08/2026

Sesión de Erika Lavado, supervisora de Huancayo:

- [x] `/performance/quotas` abre en la ventana **25 al fin de mes**, la
      vigente el 31 de agosto (BR-015).
- [x] **BR-009 verificado en pantalla:** la cuota del equipo aparece en solo
      lectura, sin botón de guardar, mientras que las de sus cuatro asesores
      son editables. Solo ve Huancayo.
- [x] **BR-008:** sin configurar nada, cada asesor arranca en 15 —el primer
      tramo de la ventana— y el equipo en 60, con la etiqueta "por defecto".
- [x] Asignar 22 a un asesor persiste, retira su etiqueta "por defecto" y
      recalcula el reparto a "Repartido 67 de 60": **advierte el exceso sin
      bloquear**.
- [x] **BR-014:** el dashboard muestra la columna "Cuota" con el avance de
      cada asesor sobre su objetivo —0/22 y 0/15— y cuántas le faltan.
- [x] 213 pruebas de dominio en verde, incluidas las seis de resolución de
      ventana, cuota por defecto, reparto y congelamiento del período.

## Cadena de tres niveles y planificación futura — 31/08/2026

Defecto encontrado y corregido: el selector de mes usaba el parser del
dashboard, que **recorta silenciosamente cualquier mes futuro al actual**. El
efecto era que no se podía planificar septiembre y, peor, pedirlo por URL
habría editado la cuota de agosto creyendo editar la de septiembre. Las
cuotas usan ahora su propio parser con horizonte de doce meses.

- [x] `/performance/quotas?period=2026-09` abre en **setiembre de 2026** y el
      selector admite hasta 2027-08 (BR-010b).
- [x] Las cuotas son por período: septiembre arranca en los valores por
      defecto aunque agosto tenga asignaciones propias.
- [x] **BR-009 verificado en sesión SUPERVISOR:** la cuota de la organización
      y la del equipo aparecen bloqueadas para Erika, y solo puede repartir
      entre sus cuatro asesores.
- [x] **BR-009b:** cada equipo declara en su encabezado quién reparte su
      cuota — "lo reparte su supervisor" o "sin supervisor · lo reparte
      administración".
- [x] La cuota de la organización resume su reparto entre equipos con el
      mismo criterio de aviso sin bloqueo.
- [x] 215 pruebas de dominio en verde.

## Pendiente

- Validar con sesión `ADMIN` la asignación de la cuota de organización y de
  equipo, y que un período cerrado quede congelado en la interfaz.
- Decidir si el sistema tendrá un rol de dueño distinto del administrador
  (BR-009c). Hoy no es urgente porque ambos son la misma persona.
- La terminología de la interfaz decía "activaciones pagables" donde el
  cálculo cuenta confirmadas; el texto nuevo habla de confirmadas y del
  pendiente de activación, alineando ambos.
