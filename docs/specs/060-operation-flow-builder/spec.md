# SPEC-060 — Creador de flujos de la operación

**Estado:** `BORRADOR` — octava pieza del programa SPEC-052; v0.2: primero automatizaciones predefinidas sobre el mismo motor, el lienzo después (12/09/2026)

**Versión:** 0.2
**Fecha:** 2026-09-12

## 1. Problema

Muchas tareas de la operación son siempre iguales y hoy dependen de que alguien
se acuerde:

- avisar la fecha de entrega del chip;
- pedir confirmar la dirección cuando AGR reporta `NO ENTREGADO`;
- recordar la cita del día;
- retomar al lead que dejó de responder;
- mandar los requisitos cuando alguien pregunta por portabilidad;
- mandar al equipo correcto a quien viene de un anuncio.

Cada supervisor lo resuelve a mano y de forma distinta. Automatizarlo con
código obliga a esperar una entrega por cada cambio.

## 2. Objetivo

Que supervisores y administradores armen flujos visuales de **disparador →
pasos → resultado** sobre eventos reales del sistema (conversaciones, pedidos
DITO, logística AGR, agenda). Cada flujo se prueba antes de activarse y cada
ejecución queda registrada paso a paso.

## 3. Alcance

1. Lienzo visual de pasos conectados, con validación en vivo.
2. Catálogo cerrado de disparadores, condiciones y acciones.
3. Simulador con datos de prueba.
4. Versionado, activación, pausa y vuelta atrás.
5. Motor de ejecución en el worker con esperas y reintentos.
6. Registro de cada ejecución y métricas por flujo.
7. Plantillas de flujo listas para la operación.

## 4. Reglas de negocio

### Catálogo

- **BR-001:** los **disparadores** son una lista cerrada de eventos que el
  sistema ya produce:

  | Grupo | Disparador |
  |---|---|
  | Conversación | Mensaje entrante (con filtros: palabra clave, primer mensaje, desde anuncio X, fuera de horario) · Conversación sin respuesta del cliente por N horas · Sin respuesta del asesor por N minutos · Pasó a «requiere asesor» · Conversación cerrada |
  | Oportunidad (SPEC-061) | Abierta (por origen) · Cambio de etapa · Sin siguiente acción · Pedido caído · Por vencer por inactividad |
  | Pedido DITO | Pedido ingresado · Cambio de estado · Pedido cancelado · Entregado sin activar tras N días |
  | Logística AGR (estados de Máximo) | `AGENDADO` · `NO ENTREGADO` (reintentable) · `RECHAZADO` o `CANCELADO` (terminales) · Entregado — con filtros por motivo y submotivo |
  | Agenda | Cita en N horas · Cita vencida sin gestión |
  | Contacto | Etiqueta agregada · Consentimiento de marketing otorgado |
  | Tiempo | Todos los días a una hora (Lima), sobre un segmento (SPEC-059) |

- **BR-002:** las **acciones** también son una lista cerrada:
  - enviar mensaje libre (solo con ventana abierta);
  - enviar plantilla (SPEC-055);
  - enviar botones o lista y **esperar la respuesta**, con tiempo máximo y
    rama «no respondió»;
  - preguntar y guardar la respuesta en un dato de la ficha;
  - condición (si / si no) sobre datos de ficha, conversación, pedido o
    respuesta;
  - esperar un tiempo o hasta una hora de Lima;
  - asignar a equipo o asesor, con reparto de SPEC-054;
  - pasar al agente de IA (SPEC-058);
  - pasar a asesor con nota;
  - etiquetar o quitar etiqueta;
  - cambiar etapa manual;
  - crear cita en agenda;
  - crear o reabrir caso en Campañas;
  - notificar a un supervisor dentro del sistema;
  - terminar.
- **BR-003:** no hay acciones de código libre, llamadas a direcciones
  externas ni fórmulas arbitrarias. Una necesidad nueva se agrega al catálogo
  con su spec, para mantener el control y la auditoría. **Supuesto:** una
  acción «llamar a un webhook externo» entra solo si José la pide para un caso
  concreto.

### Construir y validar

- **BR-004:** crean y editan flujos `ADMIN` y `SUPERVISOR`. Activarlos:
  - un flujo que envía **marketing** solo lo activa `ADMIN`;
  - uno de utilidad o interno lo activa también el supervisor, sobre sus
    equipos.
- **BR-005:** el lienzo valida en vivo y **no deja activar** un flujo con
  cualquiera de estos errores:
  - pasos sin conectar;
  - una espera de respuesta sin rama «no respondió»;
  - un mensaje libre en un punto donde la ventana puede estar cerrada;
  - una plantilla no aprobada;
  - un bucle sin espera;
  - un envío de marketing sin comprobar consentimiento, que el motor aplica
    siempre (BR-012).
- **BR-006:** cada paso muestra en lenguaje directo lo que hará. Ejemplo:
  «Si no responde en 2 horas, envía la plantilla "Confirma tu dirección"
  (utilidad, gratis con ventana abierta; S/ 0,13 si no)».

### Probar y publicar

- **BR-007:** el **simulador** recorre el flujo con un contacto y un pedido de
  prueba:
  - avanza las esperas al instante;
  - deja elegir respuestas;
  - muestra la ruta tomada.

  No envía nada ni toca fichas reales.
- **BR-008:** activar publica una **versión inmutable**:
  - las ejecuciones en curso terminan con la versión con la que empezaron;
  - las nuevas usan la activa;
  - volver atrás activa una versión anterior con motivo.
- **BR-009:** pausar un flujo detiene las ejecuciones nuevas. Las en curso se
  pueden dejar terminar o cancelar en bloque, con motivo.

### Ejecutar

- **BR-010:** **una conversación tiene como máximo una ejecución de flujo
  conversacional activa a la vez.**
  - Si dos flujos se disparan para la misma conversación, gana el de mayor
    prioridad (orden configurable) y el otro queda registrado como «no se
    ejecutó: la conversación ya estaba en el flujo X».
  - Los flujos internos (asignar, etiquetar, notificar) no tienen este
    límite.
- **BR-011:** cuando un asesor escribe en la conversación, las ejecuciones
  conversacionales se detienen (SPEC-054 BR-008) con el motivo «lo tomó un
  asesor».
- **BR-012:** el motor aplica en **cada envío** las reglas del programa:
  - consentimiento y bajas (SPEC-053 BR-018 a BR-020);
  - ventana de 24 h;
  - franja horaria de envío (SPEC-059 BR-006);
  - frecuencia de marketing (SPEC-059 BR-003).

  Si una regla bloquea el envío, el paso toma la rama «no se pudo enviar» o
  termina con el motivo; nunca se salta la regla.
- **BR-013:** una ejecución tiene tope de **50 pasos** y de **30 días** de
  vida. Al superarlos termina con el motivo, para que ningún error de diseño
  deje mensajes saliendo sin fin.
- **BR-014:** un disparador que se repite para el mismo objeto y el mismo
  evento, por ejemplo el mismo cambio de estado reprocesado, no crea una
  segunda ejecución (idempotencia por flujo + objeto + evento).
- **BR-015:** cada ejecución registra de forma inmutable:
  - la versión;
  - el disparador con sus datos;
  - cada paso con hora, entrada, resultado y rama tomada;
  - los mensajes enviados;
  - el motivo de fin.

  Desde la conversación se ve «este mensaje lo envió el flujo X, paso Y».

### Medir

- **BR-016:** por flujo y versión, cada cifra con su lista:
  - ejecuciones iniciadas, terminadas, detenidas por asesor y fallidas;
  - conversión por rama;
  - mensajes y costo;
  - pedidos entregados atribuidos, en los 7 días siguientes a la ejecución.

### Flujos iniciales (listos para activar tras revisión)

- **BR-017:** se entregan como plantillas de flujo, apagadas:
  1. **Aviso de entrega agendada:** AGR `AGENDADO` → plantilla «tu chip
     llega el …» con la fecha y el turno de entrega.
  2. **Entrega no concretada:** AGR `NO ENTREGADO` → plantilla «no pudimos
     entregarte» con botones «Reprogramar» y «Hablar con asesor» → según la
     respuesta, crear cita o pasar a asesor. Si no responde en 4 horas,
     notificar al supervisor. **El estado manda sobre el motivo:**
     `RECHAZADO` y `CANCELADO` son terminales y no ofrecen reprogramar;
     notifican al asesor para reingresar como venta nueva o darla por
     perdida.
  3. **Recordatorio de cita:** cita en 2 horas → plantilla de recordatorio al
     cliente.
  4. **Lead sin respuesta:** conversación de anuncio sin respuesta del cliente
     por 20 horas → mensaje libre de retoma (aún dentro de la ventana). A las
     48 h, plantilla de marketing solo si tiene consentimiento.
  5. **Portabilidad:** mensaje con «portabilidad» o «portar» → requisitos
     desde la base de conocimiento → pregunta de operador actual → guarda el
     dato → pasa a asesor.
  6. **Entregado sin activar:** pedido entregado sin activar a los 3 días →
     notifica al asesor del pedido con acceso a la conversación.

  Los textos se revisan con José antes de enviar las plantillas a Meta.

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Catálogo cerrado o acciones libres (código, webhooks)? | **Cerrado** (BR-003) | Cada acción respeta consentimiento, permisos y auditoría; lo libre rompe las invariantes |
| ¿Lienzo desde el inicio? | **No. Primero automatizaciones predefinidas**: los seis flujos de BR-017 como interruptores con parámetros (horas, plantilla, equipo), sobre el mismo motor, versionado y registro. El lienzo llega en una fase posterior | Resuelve la operación en semanas y no en meses; el motor y la evidencia se prueban con casos reales antes de abrir el diseño libre |
| ¿Lienzo libre o lista vertical de pasos (cuando llegue)? | **Lienzo con nodos y ramas**, con alineación automática | Las esperas con «respondió / no respondió» son ramas; en lista se vuelven ilegibles |
| Tope por ejecución | **50 pasos, 30 días** | Cubre seguimientos largos de portabilidad sin permitir bucles eternos |
| ¿Quién activa? | **Marketing: ADMIN; utilidad e internos: también SUPERVISOR** | Mismo criterio que difusiones |
| ¿n8n en vez de construir? | **Construir dentro del sistema**; n8n queda solo para la extensión DITO existente | n8n no conoce consentimiento, ventana, permisos por equipo ni la evidencia inmutable; habría que reimplementar todo por fuera |

## 6. Criterios de aceptación

- **AC-001:** no se puede activar un flujo con un paso sin conectar, ni con
  una espera sin rama «no respondió»; el lienzo marca el paso.
- **AC-002:** el simulador del flujo «Entrega no concretada» recorre las tres
  ramas sin enviar mensajes reales, y con un pedido `RECHAZADO` no ofrece
  reprogramar.
- **AC-003:** un evento AGR ficticio `AGENDADO` envía la plantilla a la
  persona vinculada al pedido. Reprocesar el mismo evento no la envía otra
  vez.
- **AC-004:** con una ejecución esperando respuesta, un asesor escribe y la
  ejecución termina con «lo tomó un asesor». No sale ningún mensaje más.
- **AC-005:** un paso de marketing sobre una persona sin consentimiento toma
  la rama «no se pudo enviar» con el motivo.
- **AC-006:** activar la versión 2 mientras hay ejecuciones de la 1 en espera
  deja que esas terminen con la 1.
- **AC-007:** un flujo con un bucle mal diseñado termina al paso 50 con el
  motivo.
- **AC-008:** la conversación muestra qué flujo y qué paso envió cada mensaje.
- **AC-009:** un supervisor no puede activar un flujo que envía marketing.
- **AC-010:** la cifra «detenidas por asesor» abre exactamente esas
  ejecuciones.

## 7. Fuera de alcance

- WhatsApp Flows (formularios dentro de WhatsApp). **Supuesto:** candidato
  para la ficha del lead tras el piloto; se enlazarían como acción.
- Flujos entre organizaciones o compartidos como producto.
- Llamadas salientes automáticas (dependen de SPEC-035).
- Acciones sobre sistemas externos (DITO, GHL, AGR): el sistema no escribe en
  ellos.
