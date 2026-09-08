# SPEC-048 — Verificación

Sin evidencia todavía: la spec está en `BORRADOR`. Este archivo fija qué se
va a comprobar y cómo, para que cada casilla de `tasks.md` tenga su prueba.

## Fase 0 — Hora de Lima

| Comprobación | Cómo | Resultado |
|---|---|---|
| Distribución de horas de las citas en producción | `docs/operacion/consultas/horas-agendadas-lima.sql`, ejecutada por José el 08/09/2026 | **Confirmado.** 45 citas: 32 entre las 02:00 y las 07:00 de Lima (04:00 concentra 16). Las 13 restantes también corridas: hora acordada = hora de registro − 5 h minuto a minuto (18:35 → 13:35, 17:38 → 12:37, 11:44 → 06:43). 30 vigentes (`SCHEDULED` con último intento `AGENDA`). |
| Corrección de datos en producción | `corregir-horas-agendadas-2026-09-08.sql` con corte 16:42:00Z, ejecutado por José en DbGate el 08/09/2026 | **Aplicada a la segunda.** La primera ejecución llegó al `COMMIT` sin corregir nada: la migración no había corrido, el `INSERT` de eventos falló y Postgres anuló la transacción sin que DbGate lo hiciera evidente; se añadió una guarda al inicio del script. Segunda ejecución: 30 casos corregidos, 30 eventos `NEXT_ACTION_CORRECTED`, citas vigentes desde 03/09 15:30 hasta 09/10 09:00. Después: ninguna cita vigente antes de las 08:00 (antes: 21); una a las 22:00 ya vencida (registrada 04/09 para 04/09, hora escrita 22:00). Dos citas nuevas registradas con el código corregido (16:50Z y 16:51Z) muestran horas de jornada (15:52 y 15:54). |
| `parseLimaDateTimeLocal("2026-09-09T10:00")` da `15:00Z` en `TZ=UTC` y en `TZ=America/Lima` | prueba pura en `@repo/validation` más proceso hijo con `TZ=UTC`, `America/Lima` y `Europe/Madrid` | **En verde** (08/09/2026): 8 pruebas nuevas, 326 en total; tipos y lint limpios. Entregado en `main` 787d26b. |
| Agendar 10:00 desde la bandeja en un servidor `TZ=UTC` muestra «10:00» en fila, ficha y agenda (AC-001) | recorrido local con `TZ=UTC` en el proceso de la web | pendiente |
| El caso tiene `portability_eligible_at` igual al mínimo de sus líneas activas tras el cruce | consulta local sobre un lote cruzado | pendiente |

## Lista de validación de la propuesta

Con una cuenta de asesor de prueba ficticia; nunca con una persona real.

1. Agendar para mañana y verificar que no exige gestión hoy (AC-001):
   pendiente.
2. Comprobar que la cita aparece a la hora correcta en Lima en Semana, Día
   y Lista (AC-002): pendiente.
3. Reprogramar y comprobar trazabilidad (`RESCHEDULED` → `PENDING`, motivo,
   actor, momento) y ausencia de duplicados con la misma clave (AC-003):
   pendiente.
4. Registrar una llamada sin respuesta sobre una cita pendiente y verificar
   la cita `DONE` y la siguiente tarea «Volver a intentar» sin hora
   (AC-004): pendiente.
5. Verificar que una habilitación se presenta como «Ya puede portar» con
   fecha y sin hora, nunca como llamada acordada (AC-005): pendiente.
6. Resolver un caso con cita pendiente (`CANCELLED`, motivo «caso
   resuelto») y reasignar otro (la cita sigue `PENDING` y cambia de agenda)
   (AC-006): pendiente.
7. Aplicar un filtro de tipo o recencia y comprobar que los vencidos siguen
   visibles; en la bandeja, «Compromisos por atender» ignora los filtros
   (AC-007): pendiente. AG-R12 completo solo cuando la bandeja tenga filtros
   de recientes.

## Concurrencia y permisos

| Comprobación | Cómo | Resultado |
|---|---|---|
| Cancelar una cita ya atendida devuelve «esta cita ya cambió» y conserva el borrador (AC-009) | dos pestañas con la misma cita | pendiente |
| Dos reprogramaciones concurrentes dejan una sola `PENDING` | índice parcial; prueba con dos envíos en paralelo | pendiente |
| Un asesor no ve ni actúa sobre casos ajenos; `?q=` solo busca en los suyos | sesión de asesor con una cita de otro asesor en la base | pendiente |
| Dos citas a las 10:00 y 10:10 se advierten «a la misma hora» sin rechazo (AC-008) | recorrido | pendiente |

## Producción

| Comprobación | Cómo | Resultado |
|---|---|---|
| Citas creadas por el relleno BR-007 = casos `SCHEDULED` con último intento `AGENDA` y misma próxima acción (AC-010) | consulta tras `migrate deploy` | pendiente |
| Contadores de Mes = suma de Día por cada día de la semana visible | lectura con sesión de asesor | pendiente |
| Aviso flotante del asesor aparece 15 minutos antes y desaparece al registrar el resultado | recorrido | pendiente |
