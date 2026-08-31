# SPEC-035 — Plataforma propia de voz sobre troncal SIP

**Estado:** `DISCOVERY`
**Versión:** 0.1
**Fecha:** 2026-08-30

## Visión

El Sistema Comercial evolucionará hacia una superficie omnicanal donde un
asesor pueda atender voz y WhatsApp sin perder el contexto del cliente. Este
incremento se concentra únicamente en voz, pero deja una frontera de dominio
que permita proyectar ambos canales en una misma línea de tiempo en el futuro.

La intención de “construir nuestro propio Twilio” se interpreta como construir
una **capa de telefonía controlada por el producto**: una API estable, eventos,
enrutamiento, permisos, auditoría y grabaciones propios sobre una o más
troncales SIP. No significa replicar desde el primer día la red global, compra
de números, facturación pública ni todos los productos de Twilio.

## Problema

Hoy una llamada solo puede registrarse manualmente como intento de contacto.
El sistema no origina ni recibe llamadas, no conoce su duración o causa de
terminación, no puede asociar una grabación y no tiene evidencia técnica para
distinguir una llamada contestada de un intento fallido.

Acoplar directamente el navegador a las credenciales del proveedor SIP
resolvería una demostración, pero impediría aplicar aislamiento multiempresa,
límites, trazabilidad y portabilidad entre proveedores.

## Objetivo de esta etapa: outbound

Construir un **contact center outbound** dentro del Sistema Comercial. Un asesor
autenticado realizará llamadas salientes desde el navegador, usando
auriculares, a teléfonos de clientes dentro de su cartera. El sistema debe:

1. validar quién puede llamar y a qué número;
2. conectar primero al asesor y después marcar al cliente;
3. mostrar el estado de la llamada en tiempo real;
4. conservar el historial técnico completo;
5. vincular la llamada al cliente y al objeto de trabajo que la originó;
6. grabar las llamadas de acuerdo con una política aprobada;
7. conservar la grabación original como evidencia contractual verificable;
8. permitir reproducir y descargar el audio con autorización y auditoría;
9. pedir al asesor un resultado comercial al terminar.

La recepción de llamadas, IVR y colas no son objetivo de esta etapa. Podrán
añadirse después sin condicionar la arquitectura outbound.

## Tipos de llamada outbound

- **CONTACT:** prospección, seguimiento o recupero. Produce historial y una
  disposición comercial.
- **CONTRACT:** llamada en la que el audio se conservará como evidencia de una
  aceptación o contratación. Además de la disposición, exige una grabación
  completa, íntegra y disponible.

La clasificación se fija antes de marcar y no se cambia retrospectivamente
para convertir una grabación incompleta en contrato.

## Actores

- **AGENT:** llama únicamente desde registros dentro de su alcance y consulta
  sus propias llamadas.
- **SUPERVISOR:** conserva su capacidad de venta; además consulta llamadas de
  equipos supervisados y, en fases posteriores, escucha llamadas activas bajo
  una autorización explícita.
- **ADMIN:** configura troncales, números, políticas, límites y retención; no
  obtiene acceso implícito a secretos en texto claro.
- **BACKOFFICE:** consulta evidencia operativa según su alcance, sin capacidad
  de originar por defecto.
- **Sistema de voz:** ejecuta comandos idempotentes y convierte eventos SIP/ARI
  en hechos durables del dominio.

## Alcance funcional por fases

### Fase V0 — Laboratorio SIP

- Certificar registro, llamadas entrantes y salientes con la troncal real.
- Confirmar señalización, NAT, codecs, DTMF, caller ID y límite de canales.
- Medir calidad y causas de terminación sin usar aún datos productivos.

### Fase V1 — Llamada saliente integrada

- Softphone WebRTC embebido en el Sistema Comercial.
- Click-to-call desde un caso de recupero y, luego, desde contacto/pedido.
- Flujo asesor-primero, cliente-después.
- Estados en tiempo real, mute, finalizar y temporizador.
- Registro automático del intento y disposición comercial posterior.
- Grabación, reproducción y descarga controlada del audio original.
- Flujo contractual con verificación de integridad y estado de evidencia.
- Panel administrativo mínimo de salud, canales activos y fallas.

### Fase V2 — Entrada y distribución

- Números entrantes (DID), horarios, locuciones y colas por equipo.
- Timbrado a uno o varios asesores disponibles.
- Rechazo, no contestada, devolución de llamada y voicemail opcional.
- Transferencia ciega y atendida.

### Fase V3 — Operación avanzada

- Monitoreo y asistencia de supervisor con controles auditados.
- Campañas progresivas, nunca un marcador predictivo en el primer corte.
- Transcripción/resumen como consumidor separado de la grabación.
- Métricas de calidad, capacidad, SLA y costos.
- API externa y webhooks para consumidores distintos al Sistema Comercial.

## Reglas e invariantes

- **BR-001:** toda llamada pertenece a una organización desde su creación y
  todas sus consultas y mutaciones se aíslan primero por `organization_id`.
- **BR-002:** una llamada posee un identificador propio estable. Los IDs de
  Asterisk, de cada canal SIP y del proveedor son referencias externas y nunca
  sustituyen ese identificador.
- **BR-003:** crear una llamada requiere una clave de idempotencia por
  organización. Reintentar la misma solicitud no origina una segunda llamada.
- **BR-004:** el navegador nunca recibe credenciales de la troncal ni acceso a
  ARI. Solo recibe una identidad WebRTC individual y de vida limitada.
- **BR-005:** el asesor solo puede llamar números que el servidor haya obtenido
  de un objeto comercial dentro de su alcance. En V1 no existe un teclado libre
  por defecto.
- **BR-006:** los números se normalizan a E.164 antes de persistir o marcar. El
  valor mostrado puede conservar una máscara, pero el enrutamiento usa el valor
  normalizado.
- **BR-007:** el flujo saliente conecta primero la pierna del asesor. La troncal
  marca al cliente solo después de que el asesor acepta, para evitar llamadas
  silenciosas y consumo innecesario.
- **BR-008:** cada pierna tiene estado y causa de terminación propios. El estado
  agregado de la llamada se deriva de sus eventos, no de la interfaz.
- **BR-009:** los eventos técnicos son append-only, se ingieren de forma
  idempotente y conservan el payload original saneado para diagnóstico.
- **BR-010:** los comandos de colgar, mantener, reanudar o transferir validan en
  el servidor la organización, el actor y el estado actual.
- **BR-011:** una llamada solo cuenta como contestada cuando la pierna del
  cliente llega a `ANSWERED`; timbrar o contestar únicamente la pierna del
  asesor no cuenta como contacto exitoso.
- **BR-012:** la disposición comercial es distinta de la causa técnica. Por
  ejemplo, `ANSWERED` puede terminar en `INTERESADO`, `RECHAZA` o `AGENDA`.
- **BR-013:** V1 crea automáticamente un `RecoveryCaseAttempt` de canal
  `LLAMADA` cuando la llamada se vincula a un caso de recupero. La disposición
  confirmada por el asesor completa el resultado; no se duplica el intento.
- **BR-014:** ninguna grabación se inicia sin una política de organización
  activa. La política define aviso, retención, descarga y roles con acceso.
- **BR-015:** PostgreSQL conserva metadatos, hashes y ubicación de la grabación,
  nunca el archivo binario.
- **BR-016:** las URLs de reproducción son firmadas, breves y emitidas después
  de verificar el alcance del actor. Cada reproducción queda auditada.
- **BR-017:** los secretos SIP/ARI se administran como secretos de despliegue o
  cifrados con una clave externa; no se registran en logs ni respuestas.
- **BR-018:** existen límites por organización, usuario y destino: concurrencia,
  frecuencia, duración máxima y presupuesto operativo.
- **BR-019:** se bloquean rangos no autorizados, numeración premium y destinos
  no cubiertos por la política de la organización.
- **BR-020:** una caída del control de voz no debe corromper el historial. Al
  reconectar, el servicio reconcilia canales activos y eventos persistidos.
- **BR-021:** el sistema de voz expone salud por separado para control, ARI,
  troncal, almacenamiento y señalización WebRTC.
- **BR-022:** el dominio comercial depende del contrato de nuestra plataforma
  de voz, no de nombres de endpoints, códigos o payloads propios del proveedor.
- **BR-023:** cambiar de proveedor SIP o añadir un segundo proveedor no cambia
  el contrato de llamada consumido por el Sistema Comercial.
- **BR-024:** los eventos de voz deben poder proyectarse en una línea de tiempo
  omnicanal mediante `organization`, cliente/teléfono, actor, dirección y
  fechas. WhatsApp tendrá su propio modelo canónico y compartirá la proyección,
  no las tablas internas de telefonía.
- **BR-025:** una llamada `CONTRACT` solo puede originarse si la política de
  grabación está activa y los servicios necesarios pasan el preflight. Si la
  grabación no inicia o queda incompleta, la evidencia se marca `INVALID` y el
  sistema no permite presentarla como contrato válido.
- **BR-026:** el archivo original de una llamada contractual es inmutable. Una
  conversión para reproducción crea un derivado; nunca reemplaza el original.
- **BR-027:** al cerrar una grabación contractual se calculan al menos SHA-256,
  bytes, formato, duración y timestamps. El manifiesto se persiste separado del
  objeto y cualquier discrepancia invalida la evidencia.
- **BR-028:** escuchar y descargar son permisos distintos. Toda descarga
  registra actor, organización, grabación, motivo, fecha, IP y resultado.
- **BR-029:** el nombre descargado es seguro y trazable mediante `callId`; no
  incorpora DNI, nombre ni teléfono completo. La descarga incluye el original
  y, cuando se solicite, un manifiesto de integridad.
- **BR-030:** no se recorta, normaliza ni elimina silencio del archivo original.
  Esas operaciones solo pueden producir copias derivadas claramente rotuladas.
- **BR-031:** la evidencia contractual registra el vínculo comercial al que
  pertenece —pedido, solicitud o caso— y no puede reasignarse silenciosamente a
  otra venta.

## Estado agregado de una llamada

```text
REQUESTED
  -> CONNECTING_AGENT
  -> DIALING_CUSTOMER
  -> RINGING
  -> IN_PROGRESS
  -> COMPLETED

CANCELED y FAILED son terminales desde cualquier estado no terminal.
```

Los timestamps (`requested_at`, `customer_ringing_at`, `answered_at`,
`ended_at`) son la fuente para métricas; el estado sirve para operación y no
reemplaza los tiempos.

## Criterios de aceptación de V1

- **AC-001:** un AGENT autenticado inicia una sola llamada desde un caso propio
  aunque el navegador repita la solicitud con la misma clave de idempotencia.
- **AC-002:** el cliente no es marcado hasta que el asesor contesta la pierna
  WebRTC.
- **AC-003:** la interfaz refleja conectando, marcando, timbrando, en curso y
  finalizada sin depender de refrescar la página.
- **AC-004:** un número o caso fuera del alcance del actor no produce tráfico
  SIP y no revela si el número existe.
- **AC-005:** al finalizar existen llamada, dos piernas, eventos y causas de
  terminación consultables dentro de la organización.
- **AC-006:** una llamada contestada crea un intento de recupero y permite
  completar su resultado comercial sin crear un segundo intento.
- **AC-007:** una falla SIP conserva una causa técnica útil y permite reintentar
  con una nueva clave sin alterar la llamada anterior.
- **AC-008:** con grabación deshabilitada no se crea audio; con grabación
  habilitada, el audio termina en almacenamiento de objetos y se reproduce solo
  mediante autorización y URL firmada.
- **AC-009:** las credenciales de troncal y ARI no aparecen en HTML, JavaScript,
  logs de aplicación ni tablas de dominio en texto claro.
- **AC-010:** una interrupción y reconexión del proceso de control no duplica
  llamadas ni eventos y reconcilia cualquier llamada todavía activa.
- **AC-011:** una llamada `CONTRACT` completada conserva el audio original, su
  hash y manifiesto; volver a calcular el hash produce el mismo valor.
- **AC-012:** un usuario autorizado puede reproducir y descargar la grabación;
  un usuario fuera del alcance no obtiene el objeto ni una URL utilizable.
- **AC-013:** cada descarga exitosa o rechazada deja un evento de auditoría.
- **AC-014:** si falla la grabación de una llamada `CONTRACT`, la interfaz la
  presenta como evidencia inválida y bloquea su asociación como contrato.

## Fuera de alcance de V1

- Llamadas entrantes, IVR, colas y compra o portabilidad automatizada de números.
- Facturación a clientes externos o marketplace de comunicaciones.
- Conferencias y transferencias.
- Marcador predictivo o llamadas automáticas sin un asesor disponible.
- Speech analytics, transcripción e IA en tiempo real.
- Sustituir el modelo de contactos existente por un modelo omnicanal genérico.
- Implementar WhatsApp dentro de este incremento.

## Decisiones pendientes de descubrimiento

1. Contactos y procedimiento de soporte/escalamiento de la troncal OV500.
2. Transporte exacto: UDP/TCP/TLS y RTP/SRTP.
3. Caller IDs autorizados y reglas de presentación de número.
4. Canales concurrentes, CPS y destinos habilitados.
5. IPs/rangos de señalización y media, NAT y requisitos de firewall.
6. Política legal aprobada para grabación, aviso, acceso y retención.
7. Volumen esperado: asesores simultáneos, llamadas/día y duración media.
8. IP pública fija desde la que operará Asterisk para habilitar whitelisting.

La matriz de capacidades y preguntas al carrier vive en
[`provider-capabilities.md`](provider-capabilities.md).
