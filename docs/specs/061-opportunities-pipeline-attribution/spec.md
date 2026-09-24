# SPEC-061 — Oportunidades, embudo y atribución de pedidos

**Estado:** `BORRADOR` — nace de la revisión de la propuesta de producto del 12/09/2026; siete decisiones con recomendación pendientes de José (12/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-12

> Corrige un error de modelo de SPEC-054 (primera versión): la etapa
> comercial vivía en la conversación. Contacto, conversación, oportunidad y
> pedido son cuatro cosas distintas.

## 1. Problema

Una persona puede tener varias conversaciones, varias intenciones de compra y
varios pedidos:

- porta una línea hoy;
- vuelve en tres meses por la de su hija después de ver un anuncio;
- escribe entretanto para preguntar por su chip.

Si todo se modela como «un lead con un chat», el sistema no puede:

- distinguir la recompra de la venta nueva;
- atribuir el segundo pedido al anuncio que lo trajo sin borrar el origen
  del primero;
- saber que la conversación sobre la entrega no es una oportunidad de venta.

**Lo que ya existe** (revisado en el esquema el 12/09/2026):

- `CommercialRequest` es una oportunidad. Tiene `leadOrigin`, `status`,
  asesor, equipo, líneas (`CommercialService`) y cargo fijo reportado.
- `DitoOrderLinkHistory` ya registra vínculos entre pedidos y oportunidades.
- Hoy solo la escribe la proyección de GHL y la web nunca la lee.
- No hay catálogo de planes: el cargo fijo solo vive en cada `DitoOrder`.
- Las citas de agenda (`RecoveryCaseCommitment`) exigen un caso de Campañas.

## 2. Objetivo

Que cada intención de compra sea una **oportunidad** con:

- origen propio;
- etapa comercial;
- responsable y siguiente acción;
- propuesta;
- pedidos vinculados.

La supervisión la trabaja en un **tablero por etapas**. Así se mide qué origen
produce ventas efectivas, separando cliente nuevo de cliente existente.

## 3. Conceptos (glosario de este programa)

| Concepto | Qué es | Dónde vive |
|---|---|---|
| **Contacto** | La persona. Guarda su **origen inicial**, inmutable | `Contact` (SPEC-053) |
| **Conversación** | El hilo de mensajes con un contacto por un número. Atraviesa varias oportunidades | `Conversation` (SPEC-053) |
| **Toque** | Cada evidencia de origen con fecha: anuncio, difusión, referido o gestión de asesor. Nunca se sobreescribe | `ContactTouch` (nuevo) |
| **Oportunidad** | Una intención de compra con origen, etapa, responsable, propuesta y resultado | `CommercialRequest` (ampliado) |
| **Pedido** | La venta ingresada en DITO, con su **estado operativo** propio | `DitoOrder` |

## 4. Reglas de negocio

### Abrir y deduplicar

- **BR-001:** **una sola oportunidad abierta por contacto.** Es el mismo
  criterio que SPEC-030 SA-004 para los casos. Un nuevo toque (otro anuncio,
  una respuesta a difusión) sobre un contacto con oportunidad abierta:
  - se registra como toque y como evento de la oportunidad;
  - **no** cambia su origen ni abre otra.
- **BR-002:** una oportunidad se abre:
  - automáticamente, cuando escribe un contacto sin oportunidad abierta;
  - a mano, por el asesor;
  - al responder a una difusión;
  - desde un flujo.

  **Excepción:** si el contacto tiene un pedido en curso (ingresado, sin
  entregar ni cancelar, de los últimos 30 días), su mensaje no abre
  oportunidad. La conversación se marca «consulta sobre su pedido». El asesor
  o el agente abren una oportunidad si detectan una compra nueva.
- **BR-003:** una oportunidad sin actividad del cliente ni del asesor por
  **30 días** se cierra como `PERDIDA` con motivo «sin actividad». Si vuelve a
  escribir, se abre una nueva con el nuevo toque como origen.

### Origen y relación

- **BR-004:** **origen de la oportunidad**, valores cerrados, fijados al abrir
  según la evidencia disponible:

  | Origen | Evidencia |
  |---|---|
  | `ANUNCIO` | `referral` con identificador de anuncio (SPEC-053 BR-008) |
  | `DIFUSION` | Respuesta a una difusión (SPEC-059 BR-012) |
  | `REFERIDO` | Contacto referente registrado |
  | `GESTION_ASESOR` | Abierta por un asesor desde su gestión, incluido un caso de Campañas |
  | `ORGANICO` | Escribió sin anuncio ni difusión, y es su primer toque |
  | `DESCONOCIDO` | Sin evidencia. **Nunca se adivina** |

- **BR-005:** el **origen inicial del contacto** es el de su primera
  oportunidad y no cambia nunca. Los orígenes de las oportunidades siguientes
  se guardan en cada una.
- **BR-006:** **relación con el cliente**, calculada con los pedidos
  **anteriores a la apertura**:
  - `EXISTENTE` si el contacto, por DNI o teléfono confirmado, tuvo un pedido
    **entregado** con la organización antes de abrirse la oportunidad;
  - `NUEVO` en otro caso.

  Si el DNI se conoce después, la relación se completa con la misma fecha de
  corte. Un pedido posterior nunca la cambia.

### Etapas comerciales

- **BR-007:** etapas **cerradas** en esta versión (no configurables):

  | Etapa | Entra cuando | Quién |
  |---|---|---|
  | `NUEVO` | Se abre | Sistema |
  | `EN_CONTACTO` | El negocio respondió y el cliente contestó | Sistema |
  | `CALIFICADO` | Tiene los datos mínimos: DNI, operador actual, línea(s) y distrito | Asesor o agente, con datos guardados |
  | `PROPUESTA` | Hay plan(es) ofrecido(s) registrado(s) **o** cita agendada | Asesor o agente |
  | `EN_CIERRE` | El cliente aceptó y se está ingresando en DITO | Asesor |
  | `GANADA` | **Al menos un pedido DITO vinculado quedó ingresado** | Sistema (derivada) |
  | `PERDIDA` | Motivo de lista cerrada (SPEC-054 BR-017) | Asesor, supervisor o sistema (BR-003) |

- **BR-008:** **nadie mueve a mano una oportunidad a `GANADA`**: la mueve el
  vínculo con un pedido ingresado (SPEC-052 BR-007). Se puede volver atrás
  entre etapas manuales, con motivo, y queda registrado.
- **BR-009:** **el estado operativo del pedido no es una etapa.** La
  oportunidad `GANADA` muestra aparte el estado de cada pedido (ingresado,
  entregado, activado, cancelado) según el glosario de SPEC-014. Los
  indicadores distinguen tres montos:
  - **pedido:** cargo fijo ingresado;
  - **confirmado:** cargo fijo entregado;
  - **vendido efectivo:** cargo fijo activado.
- **BR-010:** si todos los pedidos de una oportunidad `GANADA` se cancelan,
  la oportunidad **sigue `GANADA`** con la marca «pedido caído». No se
  reabre: la recuperación la toma la puerta interna de Recupero de ventas
  (SPEC-030 fase 5), que ya existe. Los indicadores descuentan cancelaciones
  en «confirmado» y «vendido efectivo».

### Pedidos y atribución

- **BR-011:** el sistema **no crea pedidos en DITO**: no escribe en sistemas
  externos. Lo que hace es **vincular**:
  - **Automático:** un pedido cuyo DNI de titular coincide con el del
    contacto, registrado mientras la oportunidad estaba abierta o en los 7
    días siguientes a `EN_CIERRE`, se vincula solo, si hay **una única**
    oportunidad candidata.
  - **Sugerido:** con varias candidatas, o solo por teléfono, el vínculo
    queda como sugerencia para que el asesor o el back office lo confirme.
  - Todo vínculo, desvínculo o cambio queda en `DitoOrderLinkHistory` con
    autor y motivo.
- **BR-012:** un pedido se vincula a **una sola** oportunidad. Una oportunidad
  puede tener varios pedidos (varias líneas). Un pedido sin oportunidad cuenta
  en los reportes como origen `DESCONOCIDO`.
- **BR-013:** **regla de atribución** (documentada y única): el pedido se
  atribuye al **origen de su oportunidad**. Los toques ocurridos con la
  oportunidad abierta se muestran («también vio el anuncio X el 14/09»), pero
  no cambian la atribución.
  - La atribución multitoque queda fuera de alcance.
  - La que usa Meta para sus propias métricas es otra, y la gobierna SPEC-057.

### Tablero, siguiente acción y propuesta

- **BR-014:** **tablero por etapas.**
  - **Columnas:** las etapas.
  - **Tarjeta:** contacto, responsable, siguiente acción con fecha (en rojo
    si venció), origen, relación nuevo/existente, días en la etapa y cargo
    fijo propuesto.
  - **Filtros en la URL** (SPEC-039): equipo, responsable, origen, relación y
    fechas.
  - **Alcance por rol:** el de SPEC-054 BR-001.
  - En móvil, lista agrupada por etapa.
- **BR-015:** arrastrar a `GANADA` no está permitido y lo explica. Arrastrar a
  `PERDIDA` pide el motivo, y retroceder pide el motivo.
- **BR-016:** **siguiente acción obligatoria.** Toda oportunidad abierta
  posterior a `NUEVO` tiene una siguiente acción con fecha: cita, llamar,
  esperar respuesta o completar datos. Sin ella aparece «sin siguiente acción»
  para el supervisor.
  - Las citas usan la agenda de SPEC-048.
  - La cita se generaliza para pertenecer a un caso de Campañas **o** a una
    oportunidad, con las mismas reglas de reprogramación e idempotencia.
- **BR-017:** **propuesta.** Registra los planes ofrecidos desde el
  **catálogo vigente**, la cantidad de líneas y el cargo fijo total esperado.
- **BR-018:** **catálogo de planes y promociones.** Es un dato estructurado,
  no un documento. Cada plan tiene nombre, tipo, cargo fijo, requisitos,
  promoción y vigencia (desde / hasta), y lo administra `ADMIN`. De ahí leen:
  - el agente de IA, para precios (SPEC-058);
  - la propuesta;
  - el valor de conversión cuando el pedido no trae cargo fijo (SPEC-057).

### Relación con Campañas y auditoría

- **BR-019:** los casos de Campañas **no se migran** a oportunidades. Cuando
  un asesor de Campañas obtiene interés por WhatsApp, se abre una oportunidad
  `GESTION_ASESOR` vinculada al caso, y el caso sigue su propio ciclo. Unir
  ambos motores es una decisión posterior, con datos.
- **BR-020:** crear, cambiar de etapa o de responsable, vincular un pedido,
  registrar una propuesta o cerrar deja un evento que solo añade filas, con
  autor y motivo (mismo patrón que `RecoveryCaseEvent`).

### Indicadores

- **BR-021:** por **origen × relación**, período (SPEC-005), equipo y asesor:
  - oportunidades, calificadas, con propuesta, ganadas y perdidas por motivo;
  - pedidos ingresados, entregados, activados y cancelados;
  - cargo fijo pedido, confirmado y vendido efectivo;
  - tiempo medio por etapa;
  - con el gasto de SPEC-056, costo por oportunidad, por ganada y por
    vendido efectivo.

  Cada cifra abre su lista (SPEC-039).

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Modelo nuevo u `CommercialRequest`? | **Ampliar `CommercialRequest`** | Ya tiene origen, líneas, asesor, equipo y vínculo con pedidos; la proyección de GHL sigue escribiendo mientras conviva |
| ¿Etapas configurables por empresa? | **Fijas en esta versión**; configurables en la etapa de comercialización | Primero lo útil propio; las métricas y la conversión a Meta dependen de etapas con significado estable |
| ¿Cuándo es `GANADA`? | **Pedido vinculado ingresado** | Es el hecho comercial del asesor; entrega y activación son estado operativo (BR-009) |
| ¿Pedido cancelado reabre la oportunidad? | **No: queda «pedido caído» y lo toma Recupero de ventas** | Evita dos motores recuperando lo mismo; el indicador descuenta la cancelación |
| Regla de atribución | **Origen de la oportunidad; toques visibles sin reatribuir** | Simple, auditable y estable; multitoque cuando haya volumen |
| ¿Cliente existente? | **Pedido entregado previo con la organización** | «Existente en Movistar» no lo sabemos con certeza; con nosotros sí |
| Vencimiento por inactividad | **30 días** | Cubre evaluación y portabilidad; evita embudos inflados de oportunidades muertas |

## 6. Criterios de aceptación

- **AC-001:** un contacto ficticio con oportunidad abierta que llega por un
  segundo anuncio registra el toque y conserva el origen de la oportunidad.
  Queda una sola oportunidad abierta.
- **AC-002:** un contacto con pedido ingresado hace 5 días que escribe «¿cuándo
  llega mi chip?» no abre oportunidad y la conversación queda como consulta
  sobre su pedido.
- **AC-003:** un contacto con un pedido entregado en abril abre una
  oportunidad en septiembre y queda `EXISTENTE`. Otro sin pedidos queda
  `NUEVO`.
- **AC-004:** un pedido DITO ficticio con el DNI del contacto y una sola
  candidata se vincula solo y la oportunidad pasa a `GANADA`. Con dos
  candidatas queda como sugerencia.
- **AC-005:** en el tablero no se puede arrastrar a `GANADA`, y arrastrar a
  `PERDIDA` exige motivo.
- **AC-006:** cancelar el único pedido deja la oportunidad `GANADA` con «pedido
  caído», crea el caso en Recupero de ventas y resta en «confirmado».
- **AC-007:** el origen inicial del contacto no cambia al abrirse una segunda
  oportunidad por difusión.
- **AC-008:** una oportunidad sin siguiente acción aparece en la vista del
  supervisor.
- **AC-009:** una cita creada desde la oportunidad aparece en la agenda del
  asesor con las mismas acciones que una de Campañas.
- **AC-010:** la cifra «ganadas · anuncio · existente» abre exactamente esas
  oportunidades.
- **AC-011:** un plan con vigencia vencida no aparece en la propuesta ni lo
  ofrece el agente.

## 7. Fuera de alcance

- Crear pedidos en DITO desde la plataforma.
- Atribución multitoque y modelos ponderados.
- Etapas y motivos configurables por empresa.
- Unificar casos de Campañas y oportunidades en un solo motor.
- Pronóstico de ventas.
