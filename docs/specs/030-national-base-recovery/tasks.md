# SPEC-030 — Tareas

## Definición

- [x] Analizar la base real del 26/08/2026 y medir el volumen trabajable.
- [x] Identificar la clave de identidad y las reglas de deduplicación vigentes.
- [x] Definir los filtros de elegibilidad y su carácter administrable.
- [x] Definir el cruce de portabilidad como importación de reporte.
- [x] Definir el triage manual con marcado en lote.
- [x] Definir cadencia, tipificación, pausa y agenda.
- [x] Definir el tratamiento de datos sensibles.
- [x] Decidir la unificación con SPEC-026 y absorber la agenda de reingreso.
- [x] Confirmar SA-002 y SA-003 con la muestra del reporte de portabilidad.
- [x] Definir el caso por cliente con servicios y teléfonos agrupados.
- [x] Incorporar Guinea Mobile (27) al catálogo de cedentes.
- [x] Condicionar los datos sensibles a `Validacion = false`.
- [x] Confirmar SA-001: cadencia de carga inicial de tres días más diaria del
      día anterior; la base no refresca casos y las reapariciones son pedidos
      nuevos (BR-009 y BR-009b).

## Fase 1 — Ingesta y triage

- [x] Esquema `recovery.prisma` con las nueve tablas y sus enumeraciones.
- [x] Migración aditiva `add_national_base_recovery`.
- [x] Normalización compartida de DNI y teléfonos en `@repo/validation`.
- [x] Parser de la base consolidada (columnas `I`, `J` y `N`–`AP`), en
      streaming por filas.
- [x] Evaluación de filtros contra la configuración vigente, con catálogo de
      cedentes administrable.
- [x] Agrupación de servicios y teléfonos por cliente, resolviendo BR-006 y
      BR-007.
- [x] Avistamientos por lote: anotar reapariciones en el caso abierto y crear
      el caso sucesor enlazado cuando el previo está resuelto.
- [x] Previsualización del lote con contadores por motivo de exclusión.
- [x] Confirmación idempotente por bloques con contadores parciales.
- [x] Administración de filtros de elegibilidad en `/admin/recovery-base`.
- [x] Bandeja de triage con selección múltiple y marcado en lote.
- [ ] Inclusión manual de casos excluidos por filtro, con motivo.

## Fase 2 — Portabilidad

- [x] Exportación de números de casos abiertos, incluidos los `WAITING`.
- [x] Importación del reporte CSV de siete columnas, validando el encabezado.
- [x] Importación del cruce rápido con mapeo de columna, solo descartes.
- [x] Cruce sobre todos los casos abiertos, no solo los del lote del día.
- [x] Descarte `YA_ACTIVO` por servicio, cerrando el caso al agotar servicios.
- [x] Espera automática para programadas hacia Movistar con fecha visible.
- [x] Revalidación al día siguiente de programadas sin fecha visible.
- [x] Habilitación automática a `fecha_de_la_ventana` más treinta días.
- [x] Marcado de líneas de planta.
- [ ] Reversión de descarte para `ADMIN`, con motivo.

## Fase 3 — Motor de contactos

- [x] Entrega de bloques a equipos desde el triage, con alcance por rol y
      selección masiva (Shift y por cantidad) — BR-022b, AC-043 a AC-045.
- [ ] Cola por equipo con alcance por rol.
- [ ] Toma atómica mediante actualización condicional.
- [ ] Asignación en lote: directa a asesor, equitativa en equipo, manual entre
      equipos y envío a cola (BR-028).
- [ ] Selector de asesores elegibles con exclusión de ausentes registrada
      (BR-028b).
- [ ] Algoritmo de reparto equitativo como función pura en `@repo/validation`
      (BR-028c).
- [ ] Redistribución en lote de casos sin gestión de un asesor (BR-030b).
- [ ] Bloqueo de auto-asignación directa para supervisor vendedor (BR-050b).
- [ ] Registro de intentos inmutables con canal, tipificación y teléfono.
- [ ] Contador de intentos del día y señal de cobertura insuficiente.
- [ ] Pausa de uno o dos días con reaparición automática.
- [ ] Agenda con fecha y hora exactas.
- [ ] Captura manual de antigüedad para líneas sin fecha de ventana.
- [ ] Prioridad al inicio de la cola al vencer la habilitación.
- [ ] Revelación auditada de datos sensibles: solo `Validacion = false` y tras
      un intento `INTERESADO`.
- [ ] Reasignación supervisada con historial.

## Fase 4 — Cierre y medición

- [ ] Resolución `RECOVERED` con sugerencia de orden DITO y confirmación humana.
- [ ] Resolución `LOST` con motivo estructurado y criterios habilitantes por
      motivo (BR-057).
- [ ] Resolución obligatoria al séptimo día con escalamiento al supervisor
      (BR-058).
- [ ] Pérdida automática `YA_MIGRO_OTRA_AGENCIA` cuando un caso con gestión
      porta a Movistar (BR-059).
- [ ] Tablero de avance, cobertura y efectividad por asesor.
- [ ] Conversión por cohorte contra el rango objetivo del 3 % al 6 %
      (BR-056b), con descartes fuera del denominador.
- [ ] Separación de descartes por portabilidad respecto de las pérdidas.

## Fase 5 — Puerta interna

- [ ] Entrada automática desde `CANCELLED` y `SENT + NOT_DELIVERED`.
- [ ] Cadencia propia de SPEC-026 sobre el mismo motor.
- [ ] Prioridad y motivos comerciales definidos en SPEC-026.

## Verificación

- [ ] Pruebas de dominio con la base real como fixture.
- [ ] Prueba de concurrencia sobre la toma de casos.
- [ ] Verificación con roles `AGENT`, `SUPERVISOR`, `SUPERVISOR` vendedor,
      `BACKOFFICE` y `ADMIN`.
- [ ] Verificación de que sensibles y columnas `A`–`M` no salen en listas ni
      exportaciones.
- [ ] Aprobar antes de desplegar.
