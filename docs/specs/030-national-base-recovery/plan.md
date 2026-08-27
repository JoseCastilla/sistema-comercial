# SPEC-030 — Plan

## 1. Arquitectura

El incremento vive en la aplicación Web como feature
`apps/web/src/features/recovery`, con el dominio compartido en
`@repo/validation`. No requiere proceso programado: la ingesta la dispara un
humano y la reaparición de casos agendados se resuelve por consulta, no por
tarea de fondo.

```text
/admin/recovery-base   (ADMIN)
  ├─ subir base del día      → preview → confirmar → casos en TRIAGE
  ├─ configurar filtros de elegibilidad
  ├─ exportar números abiertos → consulta externa de portabilidad
  └─ importar reporte         → cruce → descarte YA_ACTIVO

/recovery/triage       (SUPERVISOR, BACKOFFICE, ADMIN)
  └─ marcado en lote: EN_ESPERA | LIBERADO

/recovery              (AGENT, SUPERVISOR)
  ├─ cola del equipo → toma atómica
  ├─ ficha del caso  → intentos, agenda, pausa, antigüedad
  └─ cierre          → RECOVERED (orden vinculada) | LOST (motivo)

/recovery/board        (SUPERVISOR, ADMIN)
  └─ avance · cobertura · efectividad
```

### Separación deliberada

El caso (`RecoveryCase`) es dominio propio y **no** es una columna de
`DitoOrder`. La base nacional describe ventas de agencias ajenas: colgarla de
`DitoOrder` contaminaría el estado comercial propio y rompería la atribución.
La relación con `DitoOrder` existe en un solo sentido y solo al recuperar:
`recoveredDitoOrderId`, confirmado por un humano.

Es la misma decisión de SPEC-029 con `AgrDeliveryOrderSnapshot`: la fuente
externa es satélite, nunca segunda fuente de verdad.

## 2. Modelo de datos

Esquema nuevo en `packages/database/prisma/schema/recovery.prisma`.

| Tabla | Propósito |
|---|---|
| `recovery_eligibility_configs` | Filtros administrables, versionados por vigencia |
| `recovery_base_batches` | Lote diario: archivo, `sha256`, contadores, config aplicada |
| `recovery_base_records` | Fila normalizada del lote, con el crudo íntegro como evidencia |
| `recovery_portability_batches` | Lote del reporte de portabilidad, con mapeo de columna |
| `recovery_portability_results` | Resultado por número, con `checkedAt` |
| `recovery_cases` | El caso de gestión por cliente, unificado con SPEC-026 |
| `recovery_case_services` | Líneas que el cliente quiere portar, con su instantánea de portabilidad y habilitación |
| `recovery_case_phones` | Teléfonos de contacto del caso, resolviendo BR-007 |
| `recovery_case_sightings` | Apariciones del cliente en lotes sucesivos, una por pedido registrado |
| `recovery_assignment_batches` | Operación de asignación en lote: modo, actor, equipo destino, asesores incluidos y excluidos |
| `recovery_case_attempts` | Intentos de contacto, inmutables |
| `recovery_case_events` | Bitácora de transiciones, asignaciones y revelaciones |

### Enumeraciones

```text
RecoveryCaseSource   NATIONAL_BASE | INTERNAL_ORDER_STATE | MANUAL
RecoveryCaseStatus   TRIAGE | WAITING | OPEN | ASSIGNED | IN_PROGRESS
                     | SCHEDULED | RECOVERED | LOST | DISCARDED
RecoveryChannel      CALL | WHATSAPP | SMS | OTHER
RecoveryOutcome      SIN_RESPUESTA | INTERESADO | RECHAZA | AGENDA
                     | NUMERO_ERRADO | NO_CUMPLE_30D | YA_ACTIVO
                     | DATOS_INVALIDOS | VENDIDO
RecoveryLossReason   YA_MIGRO_OTRA_AGENCIA | RECHAZO_DEFINITIVO | INUBICABLE
                     | DEUDA | DATOS_INVALIDOS | NO_PORTABLE | OTRO
RecoveryDiscardReason YA_ACTIVO | FUERA_DE_FILTRO | DUPLICADO | ADMIN
```

### Campos que sostienen las reglas

- `identityKey` único por `(organizationId, documentNumber)`, soporte de
  BR-006 e idempotencia entre lotes: el caso es el cliente, los servicios y
  teléfonos cuelgan de él.
- `requiresIdentityValidation` desde la columna `Validacion`, y
  `sensitiveRevealedAt` / `sensitiveRevealedByUserId`, soporte de BR-045 y
  BR-046.
- `portabilityEligibleAt` **por servicio**, alimentado por
  `fecha_de_la_ventana + 30 días` o por captura manual; el caso deriva su
  posición en la cola del servicio habilitado más próximo. Soporte de BR-037 a
  BR-039.
- `isPlantLine` por servicio, para BR-040 y AC-028.
- `previousCaseId` en `recovery_cases`, enlace del caso nuevo con el caso
  resuelto del mismo cliente (BR-009b). El `identityKey` único aplica solo
  sobre casos no resueltos, para permitir el caso sucesor.
- Avistamiento único por `(caseId, serviceNumber, registeredAt)`, soporte de la
  idempotencia ante lotes superpuestos.
- `assignmentBatchId` en los eventos de asignación de cada caso, para poder
  auditar y deshacer una operación de lote como unidad.
- El algoritmo de reparto equitativo (ronda con mezcla de prioridades y
  residuo al de menor carga, BR-028c) vive en `@repo/validation` como función
  pura, probada con tamaños impares, un solo asesor y selección vacía.
- `nextActionAt`, `attemptsToday`, `lastAttemptAt`, `firstContactAt`, soporte de
  la cadencia y de las métricas.
- `sourceRowRaw` en `JsonB`, evidencia inmutable de BR-005.
- `claimedAt` y `assignedUserId` con actualización condicional, soporte de la
  toma atómica de BR-028.

### Columnas sensibles

`Papa`, `Mama` y `Nacimiento` se guardan en columnas propias y **no** dentro del
`JsonB` de evidencia, para poder excluirlas en la capa de lectura sin filtrar
JSON en cada consulta. Las proyecciones de lista y exportación nunca las
seleccionan.

## 3. Seguridad y privacidad

- Todas las acciones de servidor resuelven organización y rol antes de tocar
  datos, conforme al límite vigente de aislamiento multiempresa.
- La ingesta y la configuración de filtros exigen `ADMIN`.
- El triage exige `SUPERVISOR`, `BACKOFFICE` o `ADMIN`.
- La revelación de datos sensibles exige ser el asesor asignado y que exista un
  intento `INTERESADO` previo; deja evento en `recovery_case_events`.
- La exportación de números para la consulta de portabilidad emite únicamente el
  número de servicio. No incluye nombre, documento ni dirección.
- Las columnas `A`–`M` se excluyen en la proyección de la cola y de la ficha del
  asesor, no por ocultamiento en la interfaz.

## 4. Idempotencia y concurrencia

- **Reimportar la misma base** es inocuo: `sha256` único por organización
  rechaza el lote duplicado; dentro de un lote, el upsert por `identityKey`
  actualiza la instantánea y no crea casos nuevos.
- **La cadencia de carga** es una base inicial de tres días y luego solo el
  día anterior (BR-009). Si dos lotes se superponen por error, el avistamiento
  se identifica por cliente, servicio y fecha de registro y no se duplica. El
  historial de valores se escribe solo si algo cambió, siguiendo el patrón de
  huella de SPEC-029.
- **La toma de un caso** se resuelve con `updateMany` condicional sobre
  `status = OPEN AND assignedUserId IS NULL`. Un conteo afectado de cero
  significa que otro asesor llegó primero y devuelve un mensaje explícito.
- **El cruce de portabilidad** se ejecuta en lotes dentro de una transacción por
  bloque, para no sostener una transacción larga sobre miles de casos.
- **La confirmación de un lote** de ~4 500 casos se procesa por bloques con
  contadores parciales persistidos, de modo que un fallo a mitad no obligue a
  reimportar desde cero.

## 5. Rendimiento

El volumen diario es de 7 407 filas leídas, 4 786 elegibles y 4 492 casos por
cliente. Las decisiones que lo sostienen:

- el parseo del `.xlsx` ocurre en el servidor, en streaming por filas, sin
  cargar el libro completo en memoria;
- la previsualización persiste el lote y sus filas, y no vuelve a parsear el
  archivo al confirmar;
- índices por `(organizationId, status, nextActionAt)` para la cola,
  `(organizationId, assignedTeamId, status)` para el alcance por equipo, y
  `(organizationId, serviceNumber)` para el cruce de portabilidad.

## 6. Fases

Cada fase es desplegable y elimina un paso manual concreto.

1. **Ingesta y triage.** Importación, filtros administrables, creación de casos,
   marcado en lote `EN_ESPERA` / `LIBERADO`. Elimina el filtrado manual del
   supervisor.
2. **Portabilidad.** Exportación de números, importación de los dos tipos de
   reporte — completo y cruce rápido —, descarte automático de portados a
   Movistar, espera automática de portaciones programadas con fecha,
   revalidación al día siguiente de las programadas sin fecha y habilitación
   automática a ventana más treinta días. Elimina el `BUSCARV`, el ruido de
   las filas activas y una parte medible del chequeo manual por DNI: en la
   muestra, 293 de 1 392 números resultaron programados hacia Movistar.
3. **Motor de contactos.** Cola por equipo con toma atómica, intentos
   tipificados, pausas, agenda y antigüedad de portabilidad. Elimina el Excel
   del asesor.
4. **Cierre y medición.** Vínculo con la orden DITO recuperada, pérdida con
   motivo, tablero de avance, cobertura y efectividad.
5. **Puerta interna.** Conectar la entrada automática de SPEC-026 al mismo
   motor, con su propia cadencia.

## 7. Pruebas

- **Dominio compartido** (`@repo/validation`): normalización de DNI y teléfonos
  contra los casos que resuelve `merge.py`, evaluación de filtros, unión de
  teléfonos por identidad, transiciones de estado válidas e inválidas, cálculo
  de la fecha de habilitación y de la próxima acción por resultado tipificado.
- **Ingesta**: la base real del 26/08/2026 como fixture, verificando 7 407
  leídas y 4 786 elegibles, las dos filas con cedente inválido y la unión de los
  ocho números con más de una fila.
- **Concurrencia**: dos tomas simultáneas del mismo caso; solo una prospera.
- **Roles**: `AGENT`, `SUPERVISOR`, `SUPERVISOR` vendedor, `BACKOFFICE` y
  `ADMIN` sobre triage, toma, reasignación, cierre y revelación de sensibles.
- **Privacidad**: ninguna proyección de lista ni exportación incluye `Papa`,
  `Mama`, `Nacimiento` ni las columnas `A`–`M`.

## 8. Migración y despliegue

- Migración **aditiva**. No modifica ninguna tabla existente ni requiere
  corrección de datos previos.
- `DitoOrder` no cambia. La relación con el caso recuperado se declara desde
  `recovery_cases`.
- Sin variables de entorno nuevas: no hay credenciales externas en este
  incremento.
- Las fases 1 y 2 pueden desplegarse antes de que exista cualquier caso
  trabajado, porque no alteran la operación vigente de Pedidos.

## 9. Trabajo futuro registrado

- Absorber `merge.py`: subir los archivos por punto de venta y consolidar dentro
  del sistema, con las mismas reglas de deduplicación.
- Absorber la consulta de portabilidad: hoy corre como script local
  (`consulta_multiple.py`) que lee `numeros.txt` y produce el CSV importable.
  Integrarla eliminaría la exportación y la importación manuales.
- Automatizar el chequeo de pedido enviado por DNI para los casos que el
  reporte de portabilidad no resuelve, si aparece una fuente consultable,
  siguiendo el patrón de credencial cifrada de SPEC-029.
