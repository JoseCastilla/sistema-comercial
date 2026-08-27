# SPEC-030 — Verificación

**Estado:** `DRAFT`
**Fecha de análisis:** 2026-08-26

> **Alcance de esta evidencia.** Esta spec todavía no tiene código. Lo
> registrado abajo es el **análisis de la fuente real** que sustenta las reglas,
> no evidencia de implementación. La sección 4 queda abierta hasta que exista el
> primer incremento desplegable.

## 1. Fuente analizada

`C:\Users\NeuroHack\Desktop\Base\Base Diaria\Base_Consolidada_2026-08-26.xlsx`

| Propiedad | Valor |
|---|---|
| Hoja | `Base Consolidada` |
| Columnas | 42 (`A`–`AP`), encabezado en la fila 1 |
| Filas de datos | 7 407 |
| Origen | ~68 archivos por punto de venta, consolidados por `merge.py` |

### Ventana de tres días confirmada

`Fecha de Registro de Pedido` cubre exactamente tres días:

| Fecha | Filas |
|---|---|
| 2026-08-23 | 664 |
| 2026-08-24 | 3 440 |
| 2026-08-25 | 3 303 |

Esta base de tres días es la **carga inicial**. En operación, la base diaria
trae solo los pedidos del día anterior (BR-009); el volumen recurrente esperado
es de ~3 000 a 3 500 filas por día, no 7 400.

## 2. Embudo de elegibilidad

Aplicando la configuración inicial de BR-011:

| Paso | Filas |
|---|---|
| Base consolidada | 7 407 |
| `Modalidad Origen` = `POST` | 6 047 |
| + plan Máximo S/39.9 · 49.9 · 59.9 · 79.9 | 4 789 |
| + `Equipo Móvil` = `Simcard` | 4 786 |
| + con `Nro Servicio Móvil` presente | **4 786** |

Este es el volumen diario que hoy se trabaja en Excel y que sustenta las
decisiones de rendimiento del plan.

## 3. Distribuciones que fundamentan las reglas

### `Estado Pedido WC` — sustenta BR-027

| Valor | Filas |
|---|---|
| APROBADO | 6 604 |
| PENDIENTE | 441 |
| RECHAZADO | 316 |
| CAIDA | 46 |

Ninguno de estos valores indica si el pedido está enviado o cancelado. Confirma
que el triage depende de una consulta externa manual, no de la base.

### `Plan Móvil` — sustenta BR-011

18 valores distintos. Los cuatro elegibles concentran 5 720 filas; el resto son
planes `Control` (1 487), `Movistar Total` y un `Máximo S/114.9` fuera de rango.

### `Modalidad Origen` frente a tipo de plan — sustenta BR-012

| Combinación | Filas |
|---|---|
| POST · Abierto | 4 796 |
| POST · Control | 1 088 |
| PREP · Abierto | **934** |
| PREP · Control | 399 |

Las 934 filas `PREP` con plan `Abierto` demuestran que los dos criterios son
independientes y que filtrar por uno no implica el otro.

### `Equipo Móvil` — sustenta el carácter administrable de BR-010

| Valor | Filas |
|---|---|
| Simcard | 7 404 |
| XIAOMI REDMI NOTE 15 | 1 |
| IPHONE AIR | 1 |
| IPHONE 17 PRO MAX | 1 |

La presencia de equipos reales confirma que el filtro cambiará cuando el canal
habilite la venta de equipos, prevista para septiembre de 2026.

### Catálogo de cedentes y columnas sin valor — sustentan BR-015 y BR-016

- `Operador Cedente Móvil`: CLARO 3 161, ENTEL 2 256, BITEL 1 988 y 2 filas
  con `27`, que es **Guinea Mobile S.A.C.** — cedente válido del catálogo, no
  un dato degradado.
- `Estado Linea`: vacía en las 7 407 filas.
- `Operación Comercial Móvil`: `PORTABILIDAD` en el 100%.
- `Tipo Documento Cliente`: `DNI` en el 100%.
- `Validacion`: `True` en el 100%.

### Agrupación por cliente — sustenta BR-006 y BR-007

Las 4 786 filas elegibles corresponden a **4 492 clientes distintos** por DNI
normalizado:

| Servicios por cliente | Clientes |
|---|---|
| 1 | 4 248 |
| 2 | 208 |
| 3 | 30 |
| 4 | 4 |
| 5 | 2 |

Un cliente puede traer dos o tres pedidos — hasta cinco servicios en esta base
— y además teléfonos de contacto alternos que `merge.py` conserva como filas
separadas. El sistema los une en un caso por cliente, con sus servicios y sus
teléfonos.

## 3b. Reporte de portabilidad analizado

`resultado_portabilidad - ejemplo.csv` — 1 392 números, CSV UTF-8 con BOM,
siete columnas: `numero`, `receptor`, `cedente`, `asignatario_original`,
`fecha_de_la_ventana`, `estado`, `numero_consultado`. Lo produce el script
local `consulta_multiple.py` a partir de `numeros.txt`.

| Clasificación | Números | Acción del sistema |
|---|---|---|
| Portado, receptor Movistar | 81 | Descarte `YA_ACTIVO` |
| Portado, receptor otro operador | 521 | Oportunidad; habilitación = ventana + 30 días |
| Programado → Movistar, con fecha | 280 | `WAITING`: chip entregado, portará sin problemas |
| Programado → Movistar, sin fecha | 13 | `WAITING` con revalidación al día siguiente |
| Programado → otro operador | 2 | Señal de competencia; agenda a ventana + 30 |
| No portado, línea de planta (sin ventana) | 254 | Antigüedad indeterminable; cadencia normal |
| No portado, con historial de ventana | 241 | Oportunidad con antigüedad conocida |

El hallazgo central: los 293 números programados hacia Movistar responden solos
la pregunta del triage manual — ese cliente ya tiene un pedido avanzando y no
debe llamarse. La fecha visible separa la portación segura (280, chip
entregado) de la que puede fallar durante el día (13, se revalida mañana como
posible oportunidad). En esta muestra, el reporte automatiza cerca del 21% del
chequeo por DNI.

Existe además un **cruce rápido**: un filtro más veloz que solo responde si un
número está o no está en Movistar, sin fecha de portación. El sistema lo acepta
como segundo tipo de importación (BR-018b), útil para limpiar en volumen; el
reporte completo sigue siendo el único que decide esperas y habilitaciones.

## 4. Evidencia automatizada

**Fase 1 ejecutada en local el 26/08/2026**, con la base real del día cargada
de extremo a extremo por los servicios definitivos (API interna firmada con
HMAC, no por scripts ad hoc).

| Comprobación | Resultado |
|---|---|
| Migración `20260826204540_add_national_base_recovery_phase1` | Aplicada; 29 migraciones al día |
| `@repo/validation test` | 145 pruebas, 16 nuevas del dominio de recupero |
| `tsc --noEmit` api y web | Sin errores |
| `eslint --max-warnings 0` validation, api y web | Sin errores |
| Previsualización de `Base_Consolidada_2026-08-26.xlsx` | 7 407 leídas · 4 786 elegibles · 2 621 excluidas · 0 inválidas, en ~7 s — cumple AC-003 |
| Confirmación del lote | **4 492 casos nuevos**, 4 786 filas aplicadas, ~104 s — cumple AC-004 |
| Integridad | 4 780 servicios · 5 208 teléfonos · 4 786 avistamientos · 4 492 eventos · 244 casos multi-servicio (hasta 5 líneas por cliente) |
| Reimportación del mismo archivo | `reused: true`, sin duplicados — cumple AC-002 |
| Guinea Mobile (`27`) | Aceptado como cedente válido; 0 filas inválidas — cumple AC-006 |

Defectos encontrados y corregidos durante el uso real:

1. **Unicidad de teléfonos por caso.** Un teléfono de contacto igual al número
   de **otro** servicio del mismo cliente violaba la restricción. Se corrigió
   en el agrupador de dominio y con deduplicación al crear el caso; la
   confirmación interrumpida se reanudó desde los registros pendientes,
   validando el diseño de reanudación por bloques.
2. **Límite de acciones de servidor.** Subir el archivo desde la interfaz
   fallaba con `Body exceeded 1 MB limit`: Next.js limita el cuerpo de una
   acción de servidor a 1 MB y la base pesa 2,2 MB. Se configuró
   `serverActions.bodySizeLimit` en `next.config.js`. Era un defecto latente
   que también habría afectado a las importaciones DITO grandes, cuyo tope
   declarado es de 10 MB.

## 4b. Fase 2 — cruce de portabilidad (local, 26/08/2026)

Migración `20260827044435_add_recovery_portability_cross` aplicada. El reporte
real `resultado_portabilidad - ejemplo.csv` (1 392 filas, 1 255 números únicos)
se cruzó contra los 4 492 casos cargados.

| Comprobación | Resultado |
|---|---|
| `@repo/validation test` | 160 pruebas; 15 nuevas del dominio de portabilidad |
| Cobertura del cruce | 997 de 1 255 números coincidieron con líneas de casos abiertos |
| Duración | ~7 s |
| Descartes `YA_ACTIVO` | 68 líneas → **61 casos cerrados** (7 clientes conservan otra línea viva) |
| Esperas automáticas | **290 casos** a `WAITING` sin intervención del supervisor |
| Revalidación sin fecha | 12 líneas marcadas para el reporte siguiente (BR-019e) |
| Habilitaciones agendadas | 45 líneas con `ventana + 30 días` |
| Líneas de planta | 150 marcadas, antigüedad indeterminable (BR-040) |
| Reaplicar el mismo reporte | `reused: true`, sin volver a cruzar |

Estado de la bandeja tras el cruce: 4 152 `TRIAGE`, 279 `WAITING`, 61
`DISCARDED`. Los eventos registrados son coherentes: 4 492 `CASE_CREATED`,
290 `PORTABILITY_WAITING` y 61 `CASE_DISCARDED`. Ningún caso quedó `LOST`, como
exige BR-019d: el sistema nunca declara una pérdida por sí solo en esta fase.

El dato operativo relevante: **351 casos salieron del trabajo manual** — 61
descartados y 290 en espera — sobre los 997 efectivamente consultados, es decir
un 35 % de la muestra cruzada. Con la base completa consultada, el efecto
esperado es proporcionalmente mayor.

## 4c. Revisión de lógica (27/08/2026)

Auditoría del módulo tras el primer uso operativo. Cuatro defectos encontrados
y corregidos:

1. **Enter en «Seleccionar los primeros» enviaba el formulario** con el primer
   botón — «Marcar en espera» — pudiendo marcar la selección entera por
   accidente. Ahora Enter ejecuta la selección y nunca envía.
2. **Selección fantasma tras aplicar una acción:** los casos que salían de la
   tabla seguían seleccionados y el siguiente clic actuaba sobre ellos. La
   selección se limpia con cada acción exitosa.
3. **El cruce pisaba la espera manual del supervisor:** un caso `WAITING`
   marcado a mano volvía a `TRIAGE` si el reporte devolvía «no portado». El
   rebote ahora ocurre solo cuando la espera la puso el propio cruce — el
   servicio venía `PROGRAMADO` — y una espera humana se respeta: el supervisor
   vio un pedido que el reporte no puede ver.
4. **La selección por rango con Shift no tenía pruebas.** Se extrajo a
   `computeRangeSelection` en `@repo/validation` con 6 pruebas: rango hacia
   adelante y atrás, deselección por rango, Shift sin ancla y clic fuera de la
   lista. Total del paquete: 166 pruebas en verde.

Pendiente de ejercitar con datos: reaparición sobre caso abierto y caso
sucesor (requieren la base de mañana), interfaz de triage y de cruce con
recorrido visual por rol — bloqueado en esta sesión porque la extensión de
navegador no estaba conectada y la creación de una sesión de prueba fue
descartada deliberadamente —, inclusión manual de excluidos y reversión de
descarte por `ADMIN` (no construidas).

## 5. Criterios del incremento

- La base del día se importa una sola vez y reimportarla no duplica casos.
- El cliente que ya portó desaparece de la bandeja en lugar de mostrarse
  marcado.
- Un cliente con teléfono alterno se trabaja como un caso, no como dos.
- El asesor nunca ve la agencia vendedora ni los datos de validación de
  identidad antes de registrar interés.
- Dos asesores no pueden trabajar el mismo caso.
- Un caso en espera reaparece al día siguiente salvo que ya haya portado.
- Un cliente que reaparece con un pedido nuevo no duplica su caso abierto; si
  su caso estaba resuelto, genera uno nuevo enlazado al anterior.
- Un caso agendado reaparece exactamente en la fecha acordada.
- Una línea sin los treinta días reaparece al inicio de la cola al habilitarse.
- Recuperar exige vincular una orden DITO confirmada por un humano.
- Perder exige un motivo estructurado.
- El supervisor conoce avance, cobertura y efectividad del día sin construir un
  reporte.

## 6. Riesgos

- **Volumen diario alto.** 4 786 casos por día se acumulan si la cadencia no se
  cumple. El tablero de cobertura es el control que lo hace visible; sin él, el
  sistema reproduce el problema del Excel con otra interfaz.
- **Triage manual.** El chequeo por DNI sigue siendo manual para los casos que
  el reporte de portabilidad no resuelve. La fase 1 lo acelera con marcado en
  lote y la fase 2 lo reduce con la espera automática de portaciones
  programadas, pero no lo elimina.
- **Datos personales de terceros.** La base contiene clientes de agencias
  ajenas. Las reglas BR-045 a BR-048 son obligatorias, no opcionales.
- **Dependencia de scripts locales.** La consolidación (`merge.py`) y la
  consulta de portabilidad (`consulta_multiple.py`) siguen fuera del sistema y
  sin trazabilidad. Ambas están registradas como trabajo futuro en el plan.

## 7. Decisión

Pendiente. Los tres supuestos quedaron resueltos el 26/08/2026: SA-002 y
SA-003 con la muestra del reporte de portabilidad, y SA-001 con la definición
de la cadencia de carga. La spec no avanza a `READY_FOR_VALIDATION` hasta
completar la fase 1.
