# SPEC-057 — Eventos de conversión hacia Meta

**Estado:** `BORRADOR` — en pausa desde el 24/09/2026: el CRM y WhatsApp se replantearán desde cero, según el negocio, cuando José los aborde; esta spec queda como referencia

**Versión:** 0.2
**Fecha:** 2026-09-12

## 1. Problema

Meta entrega los anuncios Click to WhatsApp a quien tiende a **escribir**, no a
quien tiende a **comprar**, porque es lo único que ve. La venta ocurre
después, en el chat y en DITO, y Meta nunca se entera. Así, el algoritmo
aprende a traer conversaciones baratas que no terminan en pedido.

## 2. Objetivo

Enviar a Meta, por la Conversions API for Business Messaging, los momentos del
embudo que el sistema puede probar: lead, lead calificado, pedido y entrega.
Así los conjuntos de anuncios pueden optimizar por ventas reales y el
Administrador de anuncios muestra conversiones.

## 3. Alcance

1. Dataset vinculado a la WABA.
2. Mapa de etapas del sistema a eventos de Meta.
3. Envío automático, idempotente y auditado.
4. Registro visible de cada evento enviado, rechazado o descartado.
5. Corrección por cancelación.

## 4. Reglas de negocio

- **BR-001:** el dataset se crea desde la pantalla de integraciones
  (`POST /<WABA_ID>/dataset`) y se guarda por número. Sin dataset no se envía
  nada, y la pantalla lo dice.
- **BR-002:** solo se envían eventos de **oportunidades con al menos un toque
  de anuncio CTWA con `ctwa_clid`** (SPEC-056 BR-002, SPEC-061). Meta solo
  los atribuye a esos anuncios.
  - El evento lleva el `ctwa_clid` **más reciente** de la oportunidad dentro
    del plazo que acepta Meta.
  - Esa elección sirve solo para Meta: la atribución interna sigue siendo el
    origen de la oportunidad (SPEC-061 BR-013).
  - Una oportunidad sin toque de anuncio no genera eventos, y el registro
    dice por qué.
- **BR-003:** **mapa de etapas → eventos** (valores recomendados, ver §5):

  | Momento en el sistema | Evento de Meta | Quién lo prueba |
  |---|---|---|
  | La oportunidad llega a `CALIFICADO` por primera vez | `LeadSubmitted` | Etapa con datos mínimos guardados |
  | La oportunidad llega a `EN_CIERRE` (aceptó la propuesta) | `QualifiedLead` | Etapa |
  | Un pedido vinculado a la oportunidad queda **ingresado** | `OrderCreated` | `DitoOrder.registeredAt` y vínculo (SPEC-061 BR-011) |
  | Pedido DITO vinculado pasa a **entregado** | `Purchase` con valor | Estado de entrega |
  | Pedido vinculado se **cancela** después de enviar `OrderCreated` o `Purchase` | `OrderCanceled` | Estado DITO |

- **BR-004:** el valor de `Purchase` es el **cargo fijo mensual** del plan
  vendido, en soles (`currency: PEN`). Si el pedido no tiene cargo fijo
  legible, se envía sin valor y queda anotado. Nunca se inventa un valor.
- **BR-005:** cada evento se envía **una sola vez por oportunidad y tipo**,
  con `event_id` determinista (oportunidad + tipo + pedido). Así un
  reintento o un recálculo no duplican la conversión.
- **BR-006:** los eventos derivados de DITO (`OrderCreated`, `Purchase`,
  `OrderCanceled`) se emiten desde la **proyección de estados de pedidos**
  que ya existe, no desde una acción del asesor (SPEC-052 BR-007). Una
  corrección de pedido que lo desvincula de la oportunidad envía
  `OrderCanceled` si ya se había enviado `Purchase`.
- **BR-007:** carga mínima de cada evento:
  - `event_name` y `event_time` (momento real del hecho, en segundos UTC);
  - `event_id`;
  - `action_source: "business_messaging"` y `messaging_channel: "whatsapp"`;
  - `user_data.whatsapp_business_account_id` y `user_data.ctwa_clid`;
  - `custom_data` con `value` y `currency` cuando corresponde.

  No se envían DNI, nombre, dirección ni teléfono: no hacen falta para
  atribuir y la política de datos del sistema los reserva.
- **BR-008:** si el hecho ocurrió fuera del plazo que Meta acepta para el
  evento, no se envía. Se registra como «fuera de plazo», con la fecha, para
  medir cuánto se pierde por entregas lentas. **Por verificar:** el plazo
  vigente en la documentación de Meta.
- **BR-009:** todo evento queda en un registro inmutable con:
  - la carga enviada;
  - la respuesta de Meta (`events_received`, `fbtrace_id`, error);
  - el estado (`ENVIADO`, `RECHAZADO`, `DESCARTADO` con motivo,
    `FUERA_DE_PLAZO`);
  - la conversación y el pedido de origen.

  Los errores temporales se reintentan desde la bandeja de salida (SPEC-053
  BR-012).
- **BR-010:** la pantalla de eventos (`ADMIN`) muestra por día y por tipo
  cuántos se enviaron, rechazaron y descartaron, cada cifra con su lista
  (SPEC-039). También deja reenviar un rechazado tras corregir la causa, con
  el mismo `event_id`.
- **BR-011:** el webhook `automatic_events`, con el que Meta detecta compras o
  leads en el chat, se guarda solo para contraste. **No se reenvía** como
  evento propio, porque duplicaría la conversión.

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Qué evento es la «compra»? | **`Purchase` al pedido entregado**; `OrderCreated` al ingresado | Ingresado incluye cancelaciones y fraude (SPEC-026); activado llega tarde para la ventana de Meta. Entregado es la señal cierta más temprana |
| ¿Optimizar el conjunto de anuncios por qué evento? | **Empezar por `LeadSubmitted`; pasar a `Purchase` cuando haya unas 50 entregas semanales atribuidas** | Meta necesita volumen para aprender; con pocas compras la optimización no sale de la fase de aprendizaje |
| ¿Valor de la compra? | **Cargo fijo mensual en soles** | Es el dato que existe en el pedido y ordena los planes por valor; la comisión no es de Meta |
| ¿Enviar datos personales con hash para mejorar coincidencias? | **No** | `ctwa_clid` basta en business messaging; no enviar DNI ni teléfono reduce riesgo (Ley 29733) |

## 6. Criterios de aceptación

- **AC-001:** con el dataset creado, un evento `LeadSubmitted` de prueba
  aparece en el Administrador de eventos de Meta asociado a la WABA.
- **AC-002:** una oportunidad orgánica calificada, sin toque de anuncio, no
  genera evento, y el registro dice «sin anuncio».
- **AC-003:** un pedido DITO ficticio vinculado que pasa a entregado envía un
  solo `Purchase` con valor en soles, aunque la proyección se reprocese dos
  veces.
- **AC-004:** cancelar ese pedido envía `OrderCanceled` con referencia al
  mismo pedido.
- **AC-005:** ningún evento enviado contiene DNI, nombre, dirección ni
  teléfono (prueba sobre la carga).
- **AC-006:** un rechazo de Meta queda visible con su motivo y se puede
  reenviar con el mismo `event_id`.
- **AC-007:** la cifra de eventos enviados del día abre exactamente la lista
  de esos eventos.

## 7. Fuera de alcance

- Pixel o Conversions API del sitio web (no hay flujo web de venta).
- Eventos de otros canales (Messenger, Instagram).
- Enviar `activado` como evento propio. **Supuesto:** se reevalúa con datos
  del piloto sobre el tiempo entre entrega y activación.
- Públicos personalizados basados en conversiones.
