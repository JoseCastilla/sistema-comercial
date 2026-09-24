# SPEC-054 — Bandeja de conversaciones

**Estado:** `BORRADOR` — segunda pieza del programa SPEC-052; v0.2 tras revisar la propuesta de producto: la etapa pasa a la oportunidad (SPEC-061) y se fijan tres estados de quién responde (12/09/2026)

**Versión:** 0.2
**Fecha:** 2026-09-12

## 1. Problema

Con SPEC-053 el sistema recibe y envía mensajes, pero el equipo no tiene
dónde atenderlos. Hoy conversa en GHL. Esa bandeja no conoce:

- los pedidos DITO;
- los casos de Campañas;
- la agenda;
- la consulta DNI.

El asesor salta entre pantallas y la supervisión no ve cuánto tarda cada uno
en responder un lead que costó dinero.

## 2. Objetivo

Una bandeja con la forma de WhatsApp: lista de chats a la izquierda, chat en
el centro y ficha del cliente a la derecha. Desde ahí el asesor:

- conversa;
- ve lo que el sistema ya sabe del cliente;
- tipifica y agenda sin salir.

La supervisión reparte y mide la primera respuesta.

## 3. Alcance

1. Lista de conversaciones con vistas y filtros.
2. Chat: burbujas, estados, adjuntos, respuestas rápidas, plantillas y notas
   internas.
3. Ficha lateral: datos, vínculos con DITO, Campañas y DNI, etiquetas y la
   oportunidad abierta (SPEC-061).
4. Asignación y quién responde (asistente o asesor): automática por equipo,
   tomar control, transferir y devolver.
5. Tipificación y agenda desde la conversación.
6. Tiempo real y aviso de mensaje nuevo.
7. Métricas de atención para supervisión.

## 4. Reglas de negocio

### Quién ve qué (misma matriz de SPEC-001 §10)

- **BR-001:** `AGENT` ve las conversaciones asignadas a él y, si su equipo usa
  cola, las sin tomar de su equipo. `SUPERVISOR` ve las de sus equipos.
  `ADMIN` y `BACKOFFICE` ven las de la organización.
  - `BACKOFFICE` lee, pero **no responde**. **Supuesto:** a confirmar por
    José.
- **BR-002:** una nota interna solo la ve el equipo: nunca sale a WhatsApp y
  se distingue visualmente del mensaje enviado.

### Asignación

- **BR-003:** una conversación nueva que no tiene dueño entra a la **cola del
  equipo** que corresponde, según este orden:
  1. el equipo del asesor del caso de Campañas o del pedido vinculado, si
     existe;
  2. el equipo configurado para el número o para el anuncio de origen
     (SPEC-056);
  3. la cola general de la organización.
- **BR-004:** dentro del equipo, cada equipo elige uno de dos modos (los de
  SPEC-030):
  - **reparto equitativo** entre los asesores *conectados*, con un máximo de
    una conversación activa de diferencia;
  - **toma desde la cola**, atómica: dos asesores no pueden tomar la misma.
- **BR-005:** un asesor está **conectado** si marcó «Disponible» y tuvo
  actividad en los últimos 10 minutos. Si nadie del equipo está conectado, la
  conversación espera en la cola y, si hay agente de IA en horario, la
  atiende (SPEC-058).
- **BR-006:** transferir a otro asesor o equipo exige motivo y deja rastro.
  - El supervisor transfiere dentro de sus equipos; el administrador, en toda
    la organización.
  - El asesor puede **devolver** a la cola con motivo.
- **BR-007:** una conversación asignada sin respuesta del asesor en **15
  minutos** dentro del horario se marca «sin atender» para el supervisor. A
  los **30 minutos** vuelve a la cola, igual que el retorno por inactividad de
  Campañas. **Supuesto:** los tiempos son configurables por organización y
  estos son el valor inicial.

### Quién responde (v0.2)

- **BR-008:** en cada conversación hay **un único responsable de responder**,
  en uno de tres estados visibles en la lista y en el chat:

  | Estado | Quién escribe | Qué ve el asesor |
  |---|---|---|
  | `IA_ACTIVA` | El asistente virtual (SPEC-058), dentro de sus permisos | El chat en vivo y el botón «Tomar control» |
  | `REQUIERE_ASESOR` | Nadie. El asistente pidió ayuda o no hay asistente | Aviso al equipo y al asignado; la conversación sube en «Sin atender» |
  | `CONTROL_HUMANO` | Un asesor. Ni el asistente ni los flujos conversacionales envían | El cuadro de texto habilitado |

- **BR-008b:** **tomar control** es explícito, con el botón, o implícito, al
  escribir el primer mensaje. En el mismo instante:
  - se **cancelan los envíos automáticos pendientes** de esa conversación
    (asistente, flujo, difusión) que aún no salieron de la bandeja de salida;
  - las ejecuciones de flujos conversacionales terminan con «lo tomó un
    asesor».

  Un mensaje ya entregado a Meta no se puede cancelar, y el chat lo muestra
  tal cual.
- **BR-008c:** **devolver al asistente** solo ocurre de dos formas:
  - con el botón «Devolver al asistente»;
  - por la regla del equipo, visible en sus ajustes: «cuando se cierra la
    conversación, el próximo mensaje del cliente lo atiende el asistente si
    está en su horario».

  El retorno por inactividad (BR-007) devuelve la conversación a la cola en
  `REQUIERE_ASESOR`, nunca al asistente. Cada cambio de estado queda en el
  historial con autor y motivo.

### Chat

- **BR-009:** el chat muestra:
  - burbujas de entrada y de salida;
  - la hora en Lima;
  - los estados de envío (reloj, un check, dos checks, dos checks de color
    para leído, y fallido con el motivo en lenguaje directo);
  - quién escribió cada mensaje saliente: asesor, asistente virtual, flujo o
    difusión.
- **BR-010:** con la ventana de 24 h abierta, el asesor escribe libre y
  adjunta foto, documento o audio. Con la ventana cerrada, el cuadro de texto
  se reemplaza por «Ya no puedes escribirle libremente. Envía una plantilla
  para retomar» y el selector de plantillas aprobadas (SPEC-055).
- **BR-011:** un contador visible dice cuánto falta para que la ventana se
  cierre si quedan menos de 2 horas. Si la conversación es gratuita por
  anuncio, dice hasta cuándo.
- **BR-012:** las **respuestas rápidas** son textos guardados por la
  organización, con atajo `/` y variables del contacto (`{nombre}`). Las
  administra el supervisor o el administrador.
- **BR-013:** los adjuntos entrantes se ven dentro del chat: imagen en
  miniatura, audio con reproductor y documento con nombre y tamaño. Se
  sirven con URL firmada (SPEC-053 BR-021).
- **BR-014:** un mensaje enviado no se edita ni se borra desde el sistema.
  WhatsApp no garantiza retirarlo y la evidencia es inmutable.

### Ficha y oportunidad

- **BR-015:** la ficha lateral muestra:
  - nombre, teléfono, DNI (con botón a la consulta DNI, que tiene costo y
    queda auditada);
  - etiquetas;
  - la **oportunidad abierta** con etapa, siguiente acción, propuesta y
    origen, además del historial de oportunidades anteriores (SPEC-061);
  - el origen inicial del contacto y la relación nuevo/existente;
  - pedidos DITO vinculados con su estado y entrega;
  - caso de Campañas con su próxima acción;
  - citas de agenda;
  - consentimiento vigente por categoría.
- **BR-016:** la **etapa comercial no vive en la conversación**, sino en la
  oportunidad (SPEC-061 BR-007). Desde el chat, el asesor la avanza y
  registra la propuesta. El estado de los pedidos se muestra aparte y nunca
  como etapa (SPEC-061 BR-009). *(En v0.1 la etapa estaba en la conversación
  e incluía estados del pedido; se corrigió el 12/09/2026.)*
- **BR-017:** cerrar una oportunidad como `PERDIDA` exige motivo de una lista
  cerrada:
  - «no le interesa»;
  - «no cumple requisitos»;
  - «ya es cliente»;
  - «no responde»;
  - «precio»;
  - «datos inválidos»;
  - «otro» con texto.

  Si la persona vuelve a escribir, la conversación conserva su historial y la
  apertura de una nueva oportunidad sigue SPEC-061 BR-002.
- **BR-018:** si la conversación tiene caso de Campañas vinculado, tipificar
  desde el chat registra un `RecoveryCaseAttempt` con canal `WHATSAPP`. Usa
  las mismas consecuencias de SPEC-049 y la misma idempotencia; no hay una
  segunda tipificación paralela.
- **BR-019:** agendar desde el chat crea la cita en la agenda del asesor
  (SPEC-048). Si el cliente pidió «llámenme mañana», el recordatorio aparece
  en la agenda y en la conversación.

### Cerrar

- **BR-020:** cerrar una conversación la saca de «Mis chats». Exige que la
  oportunidad abierta tenga siguiente acción o esté cerrada, o que la
  conversación sea una consulta sobre un pedido (SPEC-061 BR-002). Si la persona vuelve a escribir, se reabre asignada al
  mismo asesor si está conectado; si no, entra a la cola del equipo.

### Tiempo real

- **BR-021:** un mensaje nuevo aparece sin recargar en la lista y en el chat
  abierto, en menos de 3 segundos desde que Meta lo entrega al webhook. La
  pestaña muestra el contador de no leídos y, con permiso del navegador, una
  notificación.

### Métricas de atención

- **BR-022:** por asesor, equipo y período (SPEC-005), con cada cifra abriendo
  sus conversaciones:
  - primera respuesta: mediana y porcentaje dentro de 5 minutos, en horario;
  - conversaciones atendidas, calificadas, con pedido y perdidas por motivo;
  - leads de anuncio respondidos fuera de las 24 h, que **pierden la ventana
    gratuita de 72 h**.

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Bandeja nueva o dentro de Campañas? | **Sección nueva «Conversaciones»** en el menú, enlazada desde la ficha del caso | Campañas es trabajo saliente por base; conversaciones es entrante por lead. Mezclarlas complica ambas vistas |
| Modo de asignación inicial | **Reparto equitativo entre conectados** | El lead de anuncio se enfría en minutos; la cola depende de que alguien mire |
| ¿`BACKOFFICE` responde? | **No, solo lee** | Separación de funciones: el back office valida, no vende |
| Tiempo de «sin atender» y retorno | **15 y 30 minutos** en horario | Equilibra el lead que se enfría con el asesor en llamada |
| ¿Móvil? | **Sí, responsive**: lista y chat en pantallas separadas a menos de 768 px | Los supervisores revisan desde el celular; no se hace app nativa |

## 6. Criterios de aceptación

- **AC-001:** un mensaje de un teléfono de prueba aparece en la lista y en el
  chat abierto de un asesor ficticio en menos de 3 segundos, sin recargar.
- **AC-002:** con dos asesores ficticios conectados y cuatro conversaciones
  nuevas, cada uno recibe dos. Con un asesor desconectado, todas van al otro.
- **AC-003:** dos asesores que pulsan «Tomar» sobre la misma conversación a la
  vez: uno la toma y el otro ve «ya la tomó Ana».
- **AC-004:** un asesor no ve conversaciones de otro equipo, ni por URL
  directa (404).
- **AC-005:** con la ventana cerrada no hay cuadro de texto libre, y enviar
  una plantilla la reabre cuando la persona responde.
- **AC-006:** una nota interna no llega al teléfono y se ve distinta del
  mensaje.
- **AC-007:** tipificar «Agenda» desde el chat de un caso de Campañas crea el
  intento con canal WhatsApp y la cita en la agenda. En Campañas se ve igual
  que si se hubiera tipificado allí.
- **AC-008:** vincular un pedido DITO ficticio ingresado pasa la oportunidad a
  `GANADA`. El estado del pedido se ve aparte y el asesor no puede mover la
  etapa a `GANADA` a mano.
- **AC-009:** con un mensaje del asistente y un paso de flujo pendientes en la
  bandeja de salida, «Tomar control» los cancela antes de enviarse. La
  conversación queda en `CONTROL_HUMANO` y no sale ningún mensaje automático.
- **AC-013:** la conversación solo vuelve a `IA_ACTIVA` con «Devolver al
  asistente» o por la regla visible del equipo. El retorno por inactividad la
  deja en `REQUIERE_ASESOR`.
- **AC-010:** una conversación asignada sin respuesta aparece como «sin
  atender» a los 15 minutos y vuelve a la cola a los 30.
- **AC-011:** la métrica de primera respuesta de un asesor abre exactamente
  las conversaciones que suma.
- **AC-012:** a 375 px de ancho se usa sin desbordamiento horizontal.

## 7. Fuera de alcance

- Enviar desde el celular del número (coexistencia).
- Mensajes de voz grabados desde el navegador. **Supuesto:** entran si José
  los pide tras el piloto.
- Traducción automática y resumen de conversación con IA (candidatos para
  SPEC-058).
- Chat interno entre asesores.
- Migración del historial de GHL. **Supuesto:** no se migra; GHL queda de
  consulta hasta su retiro.
