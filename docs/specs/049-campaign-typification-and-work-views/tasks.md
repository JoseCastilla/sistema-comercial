# SPEC-049 — Tareas

Una casilla se marca solo con evidencia en `verification.md`.

## Definición

- [x] `spec.md` con la revisión de la propuesta contra el código (§2),
      reglas BR-001 a BR-019, decisiones resueltas con recomendación (§5)
      y criterios AC-001 a AC-011 (08/09/2026).
- [x] `plan.md`: tabla de consecuencias como datos, vistas derivadas del
      selector de SPEC-048, rectificación de solo añadir, cinco fases.
- [x] José confirmó las cinco recomendaciones de §5, una a una (08/09/2026).

## Fase 1 — Consecuencias y tipificación (CAM-T01, CAM-T03)

- [x] `recovery-attempt-consequences.ts`: opciones ofrecidas con tecla,
      motivos, campos requeridos por resultado,
      `resolveRecoveryAttemptConsequence` (estado, próxima acción, efectos
      laterales, vista destino, frase) y `previewRecoveryAttemptConsequence`
      para leerla antes de guardar; 9 pruebas (357 en el paquete).
- [x] Migración `add_attempt_reason_and_results`: motivo del intento,
      `follow_up_at`, `needs_supervisor`, línea afectada, resultados
      `NO_CONTACTAR`, `TIENE_PEDIDO`, `IMPEDIMENTO`, fecha de portación
      informada por línea; y en la misma migración el relleno de la
      habilitación del caso (SPEC-048 BR-006) en vez de una segunda.
- [x] El cruce consolida la habilitación del caso tras cada línea
      (`consolidateCaseEligibility` en la API).
- [x] `registerRecoveryAttempt` reescrito sobre la tabla: teléfono errado
      marcado y conteo de válidos (BR-002), antigüedad con fecha informada
      o tarea y habilitación consolidada (BR-003, cierra SPEC-030 BR-038),
      vendido y no contactar a Por completar (BR-004, BR-001),
      `TIENE_PEDIDO` con revalidación (BR-005), impedimento con fecha y
      apoyo (BR-006), motivo en «No contesta».
- [x] Editor de fila y formulario de ficha sin preselección, teclas N/I/R/A
      y botones rápidos, campos por resultado (`AttemptResultFields`
      compartido), consecuencia antes de guardar, `CANCELADO` fuera de las
      opciones; tras «Pide que no lo llamen» aparece «Cerrar ahora como
      rechazo definitivo» y tras «Aceptó» «Vincular la orden» (ancla
      `#resolver` en la ficha). 6 pruebas de componente nuevas (214 en la
      web). Corregido de paso: al registrar otro intento, la gestión
      anterior volvía a mostrarse como guardada al tocar un campo.
- [x] Puerta `DATOS_INVALIDOS` exige todos los teléfonos marcados;
      `RECHAZO_DEFINITIVO` se habilita con «Pide que no lo llamen»; la ficha
      muestra los teléfonos errados tachados.
- [ ] Recorrido local con cuenta de asesor de prueba (exige aplicar las
      migraciones en local) y lectura de producción.

## Fase 2 — Estado operativo y vistas (CAM-T02, CAM-T04)

- [x] Selector de SPEC-048 ampliado: elementos «Cerrar como rechazo
      definitivo» y «Resolver: datos inválidos»; orígenes «devuelto de
      verificación» (evento `CASE_REOPENED` posterior al último intento),
      «falta la fecha de portación», «seguimiento del impedimento» y
      «seguimiento acordado». `recovery-work-views.ts`: vistas, un caso en
      una sola vista, rango y orden de Trabajar ahora (BR-013), por qué y
      cómo termina cada espera (BR-015); 5 pruebas (362 en el paquete).
- [x] Bandeja con `vista=ahora|completar|espera|historial` en un carril con
      contadores por población (no por página ni por recencia), columna
      «Qué toca» separada de «Último resultado», filtro de recencia `age=`
      aplicado en memoria (BR-014), orden BR-013 en Trabajar ahora,
      paginación en memoria; el carril y los filtros conservan la vista.
- [x] En espera muestra por qué y cuándo vuelve; Historial lista los
      resueltos de 30 días con resolución, motivo, quién, cuándo y orden,
      solo lectura.
- [x] Ficha con «Qué toca» arriba (mismo selector), teléfonos errados
      tachados (fase 1). Suite de la web en verde (214) tras precisar la
      prueba de filtros por el selector nuevo de recencia.
- [ ] Recorrido local con cuenta de asesor de prueba (AC-004, AC-005,
      AC-007, AC-011) y lectura de producción: suma de vistas = cartera
      abierta.

## Fase 3 — Panel y «Guardar y siguiente» (CAM-T05)

- [ ] «Guardar y siguiente» que avanza solo tras confirmación; foco al
      siguiente exigible; teclado con foco visible; contexto en la fila.
- [ ] Prueba de componente: no avanza sin confirmación, borrador
      conservado, doble envío sin duplicado.

## Fase 4 — Rectificación (CAM-T06)

- [ ] Migración `add_recovery_case_attempt_corrections` y evento
      `ATTEMPT_CORRECTED`.
- [ ] `effectiveAttempts` en `@repo/validation` con pruebas; cadencia,
      cobertura, «intentos hoy» y puertas lo usan.
- [ ] `correct-recovery-attempt-action.ts` con ventana por rol; formulario
      y historial en la ficha.

## Fase 5 — Calidad de datos (CAM-T07)

- [ ] Consulta `tipificaciones-discrepantes.sql` y su lectura de
      producción.
- [ ] Seguimiento: vista «Revisar tipificaciones» por equipo y período.

## Verificación

- [ ] Pruebas puras y de componente en verde; tipos y lint limpios.
- [ ] Recorrido con cuenta de asesor de prueba (ficticia): los siete
      puntos de validación de la propuesta.
- [ ] Lectura de producción tras las fases 1 y 2.
