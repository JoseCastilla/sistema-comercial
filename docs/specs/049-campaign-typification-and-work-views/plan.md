# SPEC-049 — Plan de implementación

## 1. Arquitectura

**Una tabla de consecuencias, cuatro lectores.** La regla «cada resultado
define estado, próxima acción, elemento de agenda y vista destino»
(BR-001) vive como datos en `@repo/validation`
(`recovery-attempt-consequences.ts`) y la leen la acción de registro (para
aplicar), la bandeja y la ficha (para decir «qué pasará si guardas»), y la
agenda de SPEC-048 (para clasificar). Hoy esas consecuencias están
repartidas en `if` dentro de `register-recovery-attempt-action.ts`; la
tabla las hace visibles, probables y consultables antes de guardar.

**Las vistas se derivan, no se guardan.** Trabajar ahora, Por completar y
En espera salen del selector de SPEC-048 (`selectRecoveryAgendaItem`)
ampliado con dos señales que hoy no tiene: «devuelto de verificación»
(evento `CASE_REOPENED` posterior al último `YA_ACTIVO`) y «sin teléfonos
válidos» (todos los teléfonos con `invalid_marked_at`). Un caso está en una
sola vista por construcción; el tablero de supervisión no cambia.

**Lo que se corrige se añade, no se edita.** La rectificación (BR-017) es
un registro que apunta al intento original, como la cita de SPEC-048. Una
función pura `effectiveAttempts(attempts, corrections)` devuelve la lista
que leen la cadencia, las puertas y los contadores; el historial muestra el
original tachado y la corrección debajo.

## 2. Modelo de datos

Tres migraciones aditivas, una por fase que las necesita:

1. **`add_attempt_reason_and_results`** (fase 1): enum `RecoveryAttemptReason`
   {`NO_CONTESTA`, `APAGADO`, `OCUPADO`, `HUELLA`, `OTRO`}; columna
   `recovery_case_attempts.reason` nula; columnas `follow_up_at` (fecha
   que dio el asesor para seguimiento o impedimento) y `needs_supervisor`
   (impedimento con apoyo); valores nuevos del enum de resultado
   `NO_CONTACTAR`, `TIENE_PEDIDO`, `IMPEDIMENTO`; columna
   `recovery_case_services.portability_reported_at` (fecha **informada
   por el cliente**, distinta de `portability_window_at` del reporte).
2. **`consolidate_case_portability_eligible`** (fase 1): el cruce y BR-003
   escriben `recovery_cases.portability_eligible_at` con el mínimo de las
   líneas activas (SPEC-048 BR-006, pendiente allí).
3. **`add_recovery_case_attempt_corrections`** (fase 4): tabla con
   `attempt_id`, `effective_result`, `effective_reason`, `observation`,
   `correction_reason`, `actor_user_id`, `created_at`; única por intento
   (una rectificación por intento; una segunda corrige la primera con un
   nuevo registro encadenado por `supersedes_id`); evento
   `ATTEMPT_CORRECTED`.

Sin cambios destructivos. `CANCELADO` se conserva en el enum.

## 3. Seguridad

- Permisos: los de `recovery-case-access.ts` (SPEC-048 fase 3) para
  registrar y rectificar; la ventana de rectificación (BR-018) se
  comprueba en el servidor con la hora de Lima.
- «Pide apoyo» del impedimento solo señala al supervisor del equipo del
  caso; no reasigna ni cambia responsable.
- Historial del asesor: solo sus casos resueltos (`resolved_by` o
  `assigned_user_id` en el momento de resolver) de los últimos 30 días;
  nada de otros asesores.

## 4. Idempotencia y concurrencia

- Registro de intentos: la clave `client_request_id` (BR-090) cubre
  «Guardar y siguiente»; el siguiente caso se abre con clave nueva.
- Rectificación: única por intento; una segunda concurrente falla por la
  clave única y devuelve «ya fue rectificado».
- Teléfono errado: `updateMany … where invalid_marked_at is null`; marcar
  dos veces no duplica nada.

## 5. Rendimiento

La bandeja ya carga la cartera del asesor con último intento; se añaden
teléfonos con su marca, el último evento de reapertura y las correcciones
(pocas). Las vistas se calculan en memoria sobre decenas o pocos cientos
de casos, como SPEC-040 decidió. La consulta de calidad (BR-019) corre
sobre intentos del período elegido en Seguimiento, acotada por equipo.

## 6. Fases

Cada fase se entrega sola en `main` con su evidencia.

### Fase 1 — Consecuencias y tipificación (CAM-T01, CAM-T03; P0)

1. `recovery-attempt-consequences.ts`: tabla BR-001, `describeConsequence`
   («queda pausado hasta…»), campos requeridos por resultado; pruebas.
2. Migraciones 1 y 2. El cruce consolida la habilitación en el caso.
3. `registerRecoveryAttempt` aplica la tabla: `NUMERO_ERRADO` marca el
   teléfono (BR-002); `NO_CUMPLE_30D` guarda fecha informada o tarea
   (BR-003); `VENDIDO` deja próxima acción «ahora» (BR-004);
   `TIENE_PEDIDO` (BR-005); `IMPEDIMENTO` y `NO_CONTACTAR` (BR-006,
   BR-001); motivo en `SIN_RESPUESTA`.
4. Editor de fila y formulario de ficha: sin preselección, accesos
   directos, campos por resultado, consecuencia antes de guardar,
   `CANCELADO` retirado de las opciones (BR-009 a BR-011).
5. Puerta `DATOS_INVALIDOS` de BR-057 pasa a leer teléfonos marcados
   además de intentos.

### Fase 2 — Estado operativo y vistas (CAM-T02, CAM-T04; P0/P1)

6. Selector de SPEC-048 ampliado: origen «devuelto de verificación» y
   tarea «sin teléfonos válidos»; `recovery-work-views.ts` con
   `classifyWorkView(item)` y el orden de BR-013; pruebas (un caso, una
   vista; orden; contadores = población).
7. Bandeja: carril `vista=ahora|completar|espera|historial` con contadores
   por población; columnas «Qué toca» (estado operativo) y «Último
   resultado»; En espera con motivo, salida y fecha; Historial con
   resolución y orden.
8. Ficha: mismo estado operativo arriba; teléfonos tachados.

### Fase 3 — Panel y «Guardar y siguiente» (CAM-T05; P1)

9. Editor de fila: «Guardar y siguiente» que avanza solo tras
   confirmación; foco al siguiente exigible; teclado (Enter, Esc,
   flechas) con foco visible; contexto (teléfonos válidos, dirección,
   últimas tres gestiones) dentro de la fila; prueba de componente para
   el orden de avance y el borrador conservado.

### Fase 4 — Rectificación (CAM-T06; P1)

10. Migración 3, `effectiveAttempts` en `@repo/validation` (pruebas:
    no cuenta como contacto; la cadencia y las puertas leen el efectivo).
11. `correct-recovery-attempt-action.ts` con ventana por rol y evento;
    formulario en la ficha («Rectificar») junto al intento; historial con
    original tachado y corrección.
12. La cadencia, cobertura, «intentos hoy» y puertas usan
    `effectiveAttempts` en bandeja, ficha, tablero y Seguimiento.

### Fase 5 — Calidad de datos (CAM-T07; P1)

13. Consulta `docs/operacion/consultas/tipificaciones-discrepantes.sql`
    (primero, para medir cuánto hay).
14. Seguimiento: vista «Revisar tipificaciones» con la lista de BR-019 por
    equipo y período, enlazando a la ficha para rectificar.

## 7. Pruebas

- **Puras:** tabla de consecuencias completa (cada resultado tiene las
  cuatro salidas); campos requeridos; clasificación en una sola vista;
  orden de Trabajar ahora; `effectiveAttempts` (cadencia, puertas,
  intentos hoy); ventana de rectificación en hora de Lima.
- **Componente:** el editor abre sin resultado y pide los campos del
  resultado elegido; «Guardar y siguiente» no avanza sin confirmación y
  conserva el borrador ante error; el carril de vistas navega por URL.
- **Recorrido** con cuenta de asesor de prueba: los siete puntos de
  validación de la propuesta, en `verification.md`.

## 8. Migración y despliegue

Migraciones aditivas que corren con `migrate deploy`. Publicar en `main`
despliega. Lectura de producción tras la fase 1: distribución de
`reason` en `SIN_RESPUESTA` y teléfonos marcados; tras la fase 2: suma de
las vistas = cartera abierta.
