# SPEC-059 — Difusiones

**Estado:** `BORRADOR` — séptima pieza del programa SPEC-052; cuatro decisiones con recomendación pendientes de José (12/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-12

## 1. Problema

El equipo necesita escribir a muchas personas a la vez:

- leads que no compraron;
- clientes con pedido cancelado que pueden reintentar;
- avisos a quienes esperan entrega.

Hoy no hay forma de hacerlo desde el sistema. La tentación es usar la base
nacional de Campañas, que **no tiene consentimiento de WhatsApp**. Una
difusión así baja la calidad del número y Meta puede limitar todo el
portafolio (SPEC-052 BR-003, §8).

## 2. Objetivo

Enviar plantillas a un segmento de personas **con consentimiento**, sabiendo
antes cuánto costará y a cuántas llegará. Después se mide qué produjo: lecturas,
respuestas, pedidos y bajas.

## 3. Alcance

1. Segmentos guardados con filtros sobre la ficha y la conversación.
2. Creación de difusión: segmento, plantilla, variables y programación.
3. Previsualización con conteo, exclusiones y costo.
4. Envío escalonado dentro de los límites de Meta y de topes propios.
5. Resultados y respuestas que entran a la bandeja.

## 4. Reglas de negocio

### Quién

- **BR-001:** crean difusiones `ADMIN` y `SUPERVISOR`. Las **aprueba y lanza**
  solo `ADMIN`. **Supuesto:** un supervisor puede lanzar sin aprobación las
  difusiones de **utilidad** a su equipo; las de marketing siempre pasan por
  `ADMIN`.

### A quién

- **BR-002:** un segmento se define con filtros combinables:
  - etiquetas;
  - etapa del lead y motivo de pérdida;
  - anuncio o campaña de origen;
  - fecha del último mensaje;
  - equipo;
  - estado del pedido vinculado (sin pedido, cancelado, entregado sin
    activar);
  - distrito.

  Se guarda con nombre y se recalcula al lanzar, no al crear.
- **BR-003:** **exclusiones que nadie puede quitar**, aplicadas al lanzar:
  1. Sin consentimiento vigente para la categoría de la plantilla (SPEC-053
     BR-018, BR-019).
  2. Con baja de marketing (SPEC-053 BR-020), si la plantilla es de marketing.
  3. Tipificadas `NO_CONTACTAR` en Campañas.
  4. Que recibieron una plantilla de **marketing** de la organización en los
     últimos **7 días**, si la plantilla es de marketing.
  5. Con conversación abierta y asesor asignado en las últimas 24 h: se les
     escribe desde la bandeja, no por difusión.
  6. Cuyo último envío falló por número inválido o bloqueo.
- **BR-004:** la **base nacional de Campañas no es un segmento disponible**.
  Sus registros solo entran si la persona tiene una ficha con consentimiento
  obtenido por otra vía (por ejemplo, escribió al número).

### Qué y cuándo

- **BR-005:** una difusión usa **una plantilla aprobada** (SPEC-055). Las
  variables se completan con datos del sistema. Si a una persona le falta un
  dato obligatorio, queda excluida con el motivo «falta su nombre», nunca con
  la variable vacía.
- **BR-006:** se programa en hora de Lima, dentro de una franja permitida de
  **9:00 a 20:00** de lunes a sábado. **Supuesto:** franja configurable por
  organización; domingo excluido por defecto.
- **BR-007:** antes de lanzar, la previsualización muestra:
  - destinatarios finales;
  - excluidos por motivo, cada cifra con su lista (SPEC-039);
  - costo estimado en soles (SPEC-055 BR-006);
  - límite de envío diario vigente del portafolio y cuánto consume;
  - la plantilla renderizada con los datos de tres personas al azar.

  Si los destinatarios superan el límite diario, la difusión se reparte en
  varios días y lo dice.

### Envío

- **BR-008:** el envío pasa por la bandeja de salida (SPEC-053) a un ritmo que
  no supera el de Meta:
  - cada destinatario es un mensaje con su propio `clientRequestId`;
  - pausar detiene lo pendiente y reanudar continúa sin duplicar.
- **BR-009:** **freno automático.** La difusión se pausa sola y avisa si:
  - la calidad del número baja;
  - Meta pausa la plantilla;
  - la tasa de bloqueos o bajas de la difusión supera el **2 %** de lo
    entregado;
  - la tasa de fallos supera el **10 %**.

  Reanudarla exige un `ADMIN` con motivo.
- **BR-010:** el error de tope de marketing por usuario (`131049`) no se
  reintenta en la misma difusión y cuenta como «Meta no lo entregó por
  límite de marketing».

### Resultados

- **BR-011:** la difusión muestra enviados, entregados, leídos, respondieron,
  bajas, fallidos por motivo, costo real (el que informa Meta en `pricing`),
  conversaciones calificadas y pedidos ingresados y entregados en los **7
  días** siguientes. Cada cifra tiene su lista.
- **BR-012:** una respuesta a una difusión entra a la bandeja (SPEC-054) como
  conversación del equipo dueño de la difusión, con la marca «respondió a la
  difusión X».

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| Frecuencia máxima de marketing por persona | **1 cada 7 días** para toda la organización | Meta ya limita por usuario; un tope propio protege la calidad del número |
| Freno por bloqueos | **2 % de lo entregado** | Tasas de bloqueo altas degradan la calidad; es preferible pausar y revisar |
| ¿Supervisor lanza? | **Solo utilidad a su equipo; marketing con ADMIN** | Marketing cuesta y arriesga el número; utilidad es operación |
| ¿Usar la API de Marketing Messages de Meta? | **No en la primera versión**; evaluar tras medir lecturas | Misma plantilla y facturación; agrega activación y complejidad antes de tener línea base |

## 6. Criterios de aceptación

- **AC-001:** un segmento con personas ficticias con y sin consentimiento
  muestra solo las que tienen consentimiento, con la lista de excluidos por
  motivo.
- **AC-002:** la base nacional de Campañas no aparece como segmento ni como
  filtro.
- **AC-003:** una persona que recibió marketing hace 3 días queda excluida de
  otra difusión de marketing y no de una de utilidad.
- **AC-004:** la previsualización muestra el costo estimado y, con más
  destinatarios que el límite diario, el reparto en varios días.
- **AC-005:** pausar a mitad y reanudar no envía dos veces a nadie.
- **AC-006:** simular 3 bloqueos sobre 100 entregados pausa la difusión y
  avisa, y reanudar exige administrador con motivo.
- **AC-007:** una respuesta a la difusión aparece en la bandeja del equipo con
  la marca de la difusión.
- **AC-008:** un supervisor no puede lanzar una difusión de marketing.

## 7. Fuera de alcance

- Difusión por SMS o correo.
- Pruebas A/B de plantillas. **Supuesto:** candidato tras el piloto.
- Segmentos por datos de la base nacional sin consentimiento.
- Recurrencia automática (difusión semanal). Eso es un flujo (SPEC-060).
