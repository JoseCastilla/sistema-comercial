# SPEC-053 — Conexión de WhatsApp, ficha única del contacto y consentimiento

**Estado:** `BORRADOR` — primera pieza del programa SPEC-052; cuatro decisiones con recomendación pendientes de José (12/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-12

## 1. Problema

El sistema no puede enviar ni recibir un mensaje de WhatsApp. Las
conversaciones viven en GHL. Además, un mismo cliente aparece desconectado en
cuatro lugares:

- el contacto de GHL;
- el caso de Campañas;
- el pedido DITO;
- la ficha DNI.

Sin una conexión propia y una ficha única no hay bandeja, atribución ni
conversión posibles (SPEC-052 §2).

## 2. Objetivo

Que un administrador conecte un número de WhatsApp Business a la
organización. Desde ahí, cada mensaje entrante y saliente queda guardado como
evidencia, unido a una sola ficha de persona y con su consentimiento
registrado.

## 3. Alcance

1. Pantalla de integración de WhatsApp (solo `ADMIN`).
2. Recepción de webhooks de Meta: mensajes, estados, calidad y límites del
   número, y preferencias del usuario.
3. Envío de texto, media, plantillas y mensajes interactivos (botones, lista)
   por la bandeja de salida.
4. Ficha única de persona con identidades por canal.
5. Registro de consentimiento y de bajas.
6. Descarga y guardado de archivos adjuntos.

La bandeja visual es SPEC-054; aquí se entrega el motor y una prueba mínima.

## 4. Reglas de negocio

### Conexión

- **BR-001:** una organización puede conectar uno o más números. Cada número
  guarda:
  - su `waba_id` y su `phone_number_id`;
  - el nombre visible;
  - el estado (`PENDIENTE`, `CONECTADO`, `RESTRINGIDO`, `DESCONECTADO`);
  - la calificación de calidad;
  - el límite de envío vigente.

  El token se guarda cifrado (AES-GCM) y nunca vuelve al navegador.
- **BR-002:** fase 1, conexión manual: el administrador pega los
  identificadores y el token de usuario de sistema, y el sistema verifica que
  responden antes de guardar. Fase 3: Embedded Signup v4 (SPEC-052 D-02).
- **BR-003:** la pantalla muestra en lenguaje directo lo que Meta informa:
  - «Calidad: buena / en observación / baja».
  - «Puedes iniciar conversaciones con hasta 2.000 personas por día».
  - «Meta restringió este número el 14/09: no puedes enviar plantillas hasta
    …».

  Una alerta de `account_alerts` o de `phone_number_quality_update` se
  notifica a los administradores.

### Recepción

- **BR-004:** todo webhook se valida con `X-Hub-Signature-256` antes de
  guardarse. Una firma inválida se rechaza con 401 y no se guarda el cuerpo.
- **BR-005:** cada evento se guarda una sola vez, con su identificador de Meta
  como clave de idempotencia (`wamid` en mensajes; `wamid` + estado en
  estados). Si llega repetido, se ignora sin error.
- **BR-006:** los estados de un mensaje solo avanzan (`enviado → entregado →
  leído`). `fallido` guarda el código y el texto de error de Meta. Un estado
  que llega atrasado no retrocede el mensaje.
- **BR-007:** el mensaje entrante guarda el cuerpo tal como llegó (JSON
  original) y una versión normalizada para mostrar. El original no se edita
  (SPEC-052 BR-002).
- **BR-008:** si el primer mensaje trae `referral` (anuncio CTWA), se guarda en
  la conversación como **origen inmutable** (`source_id`, `ctwa_clid`,
  `headline`, `body`, `source_url`, tipo de medio). Se usa en SPEC-056 y
  SPEC-057.

### Ventanas de conversación

- **BR-009:** la conversación con cada persona lleva dos plazos, calculados
  con la hora del último mensaje entrante que informa Meta:
  - **«puede escribirle libremente hasta»:** 24 h desde el último mensaje de
    la persona;
  - **«gratis hasta»:** 72 h si la conversación empezó en un anuncio y el
    negocio respondió dentro de las primeras 24 h.
- **BR-010:** con la ventana de 24 h cerrada, la salida solo admite
  plantillas aprobadas. El motor rechaza cualquier otro mensaje antes de
  llamar a Meta, con el motivo «ya no puedes escribirle libremente: usa una
  plantilla».

### Envío

- **BR-011:** todo envío entra primero a la bandeja de salida con un
  `clientRequestId` único. Un doble clic o un reintento no duplica el mensaje.
- **BR-012:** el trabajador envía en orden por conversación y respeta los
  límites de Meta:
  - los errores de límite o temporales se reintentan con espera creciente,
    hasta 5 veces;
  - el error `131049` (tope de marketing por usuario) no se reintenta antes
    de 24 h;
  - un error definitivo (número inválido, persona que bloqueó) marca el
    mensaje como fallido y avisa a quien lo envió.
- **BR-013:** cada mensaje saliente guarda quién lo originó: un asesor
  (usuario), el agente de IA (versión), un flujo (versión y ejecución) o una
  difusión. Nunca queda anónimo.

### Ficha única de persona

- **BR-014:** la persona se identifica por canal con el **BSUID** de WhatsApp
  (`user_id`) y, además, con el teléfono normalizado cuando Meta lo envía.
  - Si llega un BSUID nuevo con un teléfono que ya existe en la organización,
    se une a esa persona.
  - Si llega sin teléfono, se crea una persona nueva y la unión queda
    pendiente.
- **BR-015:** la ficha se vincula, sin copiar datos, con:
  - los **pedidos DITO** por DNI del titular, o por teléfono de contacto o de
    servicio;
  - los **casos de Campañas** por DNI, o por teléfono en `RecoveryCasePhone`;
  - la **ficha DNI** por número de documento.

  Un vínculo por teléfono sin DNI se marca «probable» hasta que un asesor lo
  confirme o se obtenga el DNI.
- **BR-016:** unir dos fichas duplicadas es una acción explícita de
  supervisor o administrador. Se registra con autor y motivo, es reversible y
  no borra ningún mensaje.
- **BR-017:** la proyección de GHL sigue escribiendo en `Contact` mientras
  conviva (SPEC-052 D-09). Un contacto de GHL y uno de WhatsApp con el mismo
  teléfono son la misma persona.

### Consentimiento y bajas

- **BR-018:** el consentimiento se registra por categoría (`servicio`,
  `marketing`) con fecha, canal (`escribió primero`, `formulario`, `llamada
  grabada`, `botón de plantilla`), texto aceptado y quién lo registró. Es un
  registro que solo añade filas: revocar crea una fila nueva, no borra la
  anterior.
- **BR-019:** escribir primero por WhatsApp da consentimiento de *servicio*
  para esa conversación, pero **no** de *marketing*. El de marketing requiere
  una aceptación explícita.
- **BR-020:** cuentan como **baja** de marketing:
  - el webhook `user_preferences` con baja;
  - la palabra «BAJA», «STOP», «NO MOLESTAR» o «no me escriban», como mensaje
    completo;
  - la tipificación `NO_CONTACTAR` en Campañas.

  La baja se confirma a la persona con un mensaje automático de servicio y
  aplica a todos los números de la organización.

### Archivos

- **BR-021:** la media entrante se descarga al recibirla y se guarda en el
  almacenamiento de objetos, con tipo, tamaño y huella SHA-256. La bandeja la
  sirve con URL firmada de corta duración. Tope por archivo: el de Meta
  (100 MB para documentos).
- **BR-022:** los archivos se retienen mientras exista la conversación. Su
  borrado sigue la política de datos personales de la organización (fuera de
  alcance aquí; ver §7).

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Ampliar `Contact` o crear un modelo nuevo de persona? | **Ampliar `Contact`** y añadir `ContactChannelIdentity` (canal, BSUID, teléfono) y `ContactConsent` | Ya aísla por organización, tiene teléfonos y la web no lo usa: cero pantallas rotas. Un modelo nuevo dejaría dos «clientes» |
| ¿Dónde vive el trabajador de envío? | **En `apps/worker`**, con un bucle continuo junto al reloj de mantenimiento | El worker ya existe y se despliega. Enviar desde la web ata la entrega a una petición del navegador |
| ¿Qué pasa con los mensajes enviados desde el celular del número? | **Fuera de alcance mientras no haya coexistencia**: el número nuevo solo se usa desde el sistema | La coexistencia exige Embedded Signup (Tech Provider). Mezclar celular y sistema sin sincronía deja huecos en la evidencia |
| ¿Quién ve la pantalla de integración? | **Solo `ADMIN`** | Maneja tokens y costo; un error apaga la operación |

## 6. Criterios de aceptación

- **AC-001:** un administrador conecta un número con identificadores y token
  válidos y la pantalla muestra nombre visible, calidad y límite de envío.
  Con un token inválido no guarda nada y dice por qué.
- **AC-002:** un mensaje de texto enviado desde un teléfono de prueba al
  número conectado queda guardado una sola vez aunque Meta lo reenvíe, con
  su JSON original y la persona creada o unida.
- **AC-003:** un webhook con firma inválida responde 401 y no deja rastro en
  la base.
- **AC-004:** una respuesta enviada desde la prueba mínima llega al teléfono.
  Su estado avanza a entregado y leído, y un doble envío con el mismo
  `clientRequestId` produce un solo mensaje.
- **AC-005:** 25 horas después del último mensaje de la persona, el motor
  rechaza un texto libre con el motivo en lenguaje directo y acepta una
  plantilla aprobada.
- **AC-006:** un mensaje que llega desde un anuncio de prueba guarda su
  `referral` completo, y la conversación muestra «gratis hasta» con 72 h.
- **AC-007:** una foto y un audio entrantes quedan en el almacenamiento con
  huella y se ven desde una URL firmada que caduca.
- **AC-008:** escribir «BAJA» registra la baja de marketing, envía la
  confirmación y deja la persona excluida en la regla pura de consentimiento.
  El registro anterior sigue visible.
- **AC-009:** un teléfono que ya tiene pedido DITO con DNI muestra el vínculo
  confirmado. Uno que solo coincide por teléfono lo muestra «probable».
- **AC-010:** ningún usuario de otra organización puede leer el número, los
  mensajes ni la ficha (prueba de aislamiento).

## 7. Fuera de alcance

- Bandeja de asesores (SPEC-054).
- Creación de plantillas (SPEC-055). Aquí solo se envían las que ya estén
  aprobadas en Meta.
- Embedded Signup y coexistencia (fase 3, cuando exista Tech Provider).
- Política de retención y borrado de datos personales por solicitud del
  titular. Se escribe antes de verificar SPEC-054 porque la Ley 29733 la
  exige.
- Llamadas de WhatsApp.
