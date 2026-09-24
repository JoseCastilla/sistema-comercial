# SPEC-052 — CRM de WhatsApp: visión, arquitectura común y hoja de ruta

**Estado:** `BORRADOR` — en pausa desde el 24/09/2026: el CRM y WhatsApp se replantearán desde cero, según el negocio, cuando José los aborde; esta spec queda como referencia

**Versión:** 0.2
**Fecha:** 2026-09-12

> Spec rectora del programa. No entrega pantallas propias: fija lo que
> comparten SPEC-053 a SPEC-061 para que ninguna lo redacte por su cuenta
> (misma regla de fuente única de `docs/specs/README.md`).

## 1. Origen

José pidió el 12/09/2026 construir un CRM a medida con lo aprendido del
negocio. Lo que necesita:

1. Hacer campañas Click to WhatsApp desde Meta.
2. Conectar WhatsApp a la plataforma con las integraciones oficiales de Meta.
3. Un agente conversacional que se entrene desde la plataforma.
4. Enviar eventos de conversión (lead, compra, etc.) desde el CRM.
5. Un creador de flujos para la operación.
6. Administrar y crear plantillas.
7. Herramientas de difusión.
8. Una bandeja para conversar con el lead al estilo de WhatsApp.

## 2. Cómo funciona hoy (revisado contra el código el 12/09/2026)

- **GoHighLevel (GHL) es el CRM de captación.** Las conversaciones de WhatsApp
  de los leads de anuncios viven allí. El sistema solo *recibe* de GHL, por
  n8n, en `POST /api/v1/webhooks/ghl`
  (`apps/api/src/modules/webhooks/ghl-webhook.service.ts`). No hay escritura
  hacia GHL (invariante del README).
- **La atribución del anuncio se pierde.** El snapshot de GHL trae
  `ctwa_clid`, `ad_id` y `ad_name`, y la proyección los usa para marcar
  `leadOrigin = CAMPAIGN`. No los guarda en columnas: quedan enterrados en
  `WebhookEvent.payload`. Por eso hoy no se puede saber cuánto costó una venta
  por anuncio.
- **No existe envío de WhatsApp, ni Graph API, ni Pixel, ni Conversions API.**
  «WhatsApp» solo existe como canal manual de un intento de Campañas
  (`RecoveryAttemptChannel.WHATSAPP`).
- **No hay una identidad común de cliente.** `Contact` (proyección de GHL),
  `RecoveryCase` con sus teléfonos, `DitoOrder` y `DniPersonSnapshot` están
  desconectados: se relacionan solo por DNI o teléfono en texto. La web nunca
  lee `Contact`.
- **No hay infraestructura de mensajería.** `apps/worker` es un reloj que
  llama a mantenimiento cada 5 minutos. No hay colas, Redis ni almacenamiento
  de archivos. El tiempo real existe: SSE con `LISTEN/NOTIFY` de Postgres en
  pedidos (`app/api/orders/stream`).
- **No hay ninguna integración con modelos de IA.**
- **SPEC-035 (voz propia)** ya fijó la frontera con WhatsApp en su BR-024.
  Voz y WhatsApp no comparten tablas de transporte, pero ambos alimentan una
  proyección común de actividad por contacto. Este programa la respeta.

## 3. Visión y qué cambia

**Visión de producto (v0.2):** una plataforma comercial para empresas del
sector que centraliza WhatsApp, automatiza la atención y el seguimiento con
agentes de IA, organiza el trabajo de los asesores y relaciona cada
oportunidad con sus pedidos para medir resultados reales.

La ventaja frente a juntar herramientas sueltas (GHL y similares) es que el
sistema **ya registra los pedidos**. Eso cierra el recorrido completo:

> Anuncio → WhatsApp → calificación → asesor → cita o propuesta → pedido →
> venta efectiva

GoHighLevel es referencia de funcionalidades, no un modelo a copiar.

El sistema pasa de *recibir* leads de GHL a **ser el lugar donde se conversa
con ellos**. La conversación, el anuncio que la originó, el pedido que produjo
y el costo quedan en una sola base. Con eso el anuncio se paga por venta real,
y no por mensajes.

Lo que ya existe se **conecta, no se duplica**:

- La tipificación de Campañas.
- La agenda (SPEC-048).
- El reparto por equipo (SPEC-030).
- Los pedidos DITO.
- La logística AGR.
- La consulta DNI.

## 4. Decisiones de base, resueltas con recomendación

| # | Decisión | Recomendación | Por qué |
|---|---|---|---|
| D-01 | Cómo conectarse a WhatsApp | **Integración directa con la Cloud API de Meta**: app propia de Meta, cuenta de WhatsApp Business (WABA) de Distribuidor Online y token de usuario de sistema. Sin intermediario (360dialog, Twilio, GHL). | Es gratis más allá de la tarifa de Meta y da acceso a todo: plantillas, CTWA, conversiones y flows. Además, es la base del producto vendible. Para uso propio no hace falta ser Tech Provider. |
| D-02 | Tech Provider y Embedded Signup | **Iniciar ya el trámite de Tech Provider** (verificación de empresa y App Review) en paralelo, y construir Embedded Signup v4 cuando se venda a otro proveedor (SPEC-053 fase 5). | El trámite toma semanas y no bloquea la operación propia. Sin él no hay coexistencia ni conexión de números de terceros. |
| D-03 | Qué número usar primero | **Un número nuevo, dedicado a una campaña CTWA piloto.** El número que hoy atiende GHL se migra cuando la bandeja pase el piloto (SPEC-054 AC). | Un número solo puede estar en una integración de Cloud API. Migrar el de GHL el primer día apaga la operación actual si algo falla. **Por verificar:** cómo tiene GHL registrado ese número (partner propio de GHL o WABA de José). |
| D-04 | Identidad del contacto | **Una sola ficha de persona por organización**, que amplía el `Contact` existente. Se identifica por canal con el **BSUID de WhatsApp** (`user_id`) y, además, por el teléfono cuando llega. Se vincula por DNI con pedidos DITO, casos de Campañas y la ficha DNI. | Desde abril de 2026 Meta envía el BSUID y **el teléfono puede no venir**, así que el teléfono no puede ser la clave. `Contact` ya aísla por organización y la web no lo usa, así que ampliarlo no rompe pantallas. **Por verificar en el plan:** que `documentNumberNormalized` admita nulo. |
| D-05 | Envío y reintentos | **Bandeja de salida en Postgres** (tabla outbox) que un proceso continuo del worker consume con `FOR UPDATE SKIP LOCKED`, con idempotencia por `clientRequestId`. Sin Redis. | Mismo patrón de idempotencia que Campañas. Postgres ya está y el volumen de un call center no justifica otra pieza. El reloj de 5 minutos no sirve para chatear, pero el mismo servicio puede correr un bucle corto. |
| D-06 | Recepción de Meta | **Webhook en `apps/api`**. Valida la firma `X-Hub-Signature-256`, guarda en `WebhookEvent` (nueva fuente `META_WHATSAPP`), responde 200 y procesa después. | Reutiliza el registro idempotente y el reintento que ya existen para GHL y DITO. Meta reintenta 7 días, pero no conviene depender de eso. |
| D-07 | Tiempo real en la bandeja | **SSE con `LISTEN/NOTIFY`**, igual que pedidos. | El patrón está probado en producción y no agrega infraestructura. |
| D-08 | Archivos (fotos, audios, documentos) | **Almacenamiento de objetos compatible con S3** (MinIO en EasyPanel), con URL firmada. Es la misma necesidad que la grabación de SPEC-035. | Las URL de media de Meta caducan: si no se descargan, la conversación pierde sus adjuntos. |
| D-09 | Relación con GHL | **GHL se conserva hasta que SPEC-053 a SPEC-056 y SPEC-061 estén `VERIFICADA`**; después se retira la captación de GHL en una spec propia. La invariante «no escribir hacia GHL» se mantiene mientras conviva. | Dos bandejas para el mismo lead generan respuestas dobles. El corte debe ser un evento planificado, no un efecto lateral. |
| D-10 | Proveedor de IA | **Claude (API de Anthropic), llamado desde `apps/api`** con herramientas propias. Detalle en SPEC-058. | La política de WhatsApp permite IA *accesoria* a la venta del propio negocio y prohíbe que los datos entrenen modelos de terceros. La API comercial de Anthropic no entrena con los datos por defecto. **Por verificar:** que así lo diga el contrato vigente al activar. |

### Decisiones añadidas en v0.2 (revisión de la propuesta de producto)

| # | Decisión | Recomendación | Por qué |
|---|---|---|---|
| D-11 | ¿Dónde vive la intención de compra? | **En una oportunidad separada de la conversación**, ampliando `CommercialRequest` (SPEC-061) | Una persona conversa varias veces, tiene varias compras y recompra; sin separarlo no se mide recompra ni atribución por compra |
| D-12 | ¿Ventas de campaña vs ventas de base? | **Dos dimensiones**: relación con el cliente (nuevo/existente) × origen de la oportunidad (anuncio, difusión, orgánico, referido, gestión de asesor, desconocido). El origen inicial del contacto no se sobreescribe | Un cliente existente puede recomprar por un anuncio: es recompra *y* es de campaña a la vez |
| D-13 | ¿Etapas configurables por empresa? | **No en esta versión**: etapas cerradas; configurables en la etapa 4 | Las métricas y los eventos a Meta necesitan etapas de significado estable; primero lo útil propio |
| D-14 | ¿Varios proveedores de IA? | **Un adaptador mínimo, un proveedor validado**; cambiar de modelo es versión nueva con pruebas | El comportamiento no se conserva al cambiar de modelo |
| D-15 | ¿Flujos visuales desde el inicio? | **No**: automatizaciones predefinidas con parámetros en la etapa 2; lienzo en la etapa 3 (SPEC-060 v0.2) | Resuelve la operación antes y prueba el motor con casos reales |
| D-16 | ¿Multiempresa? | **El aislamiento ya es base** (invariante vigente). Planes, cuotas, consumo, alta autónoma, etapas configurables y el rol de **administrador de la plataforma** (soporte con acceso controlado y registrado) van en la etapa 4 | Hoy cada usuario tiene una sola organización (`requireCommercialAccess` toma la membresía más antigua); abrir acceso entre empresas sin necesidad es riesgo sin retorno |

## 5. Reglas comunes a todo el programa

- **BR-001 · Aislamiento.** Todo número, conversación, plantilla, flujo,
  agente y evento pertenece a una organización. Toda consulta filtra primero
  por `organizationId` (invariante del sistema).
- **BR-002 · Evidencia inmutable.** Estas cosas se guardan tal como llegaron y
  no se editan:
  - un mensaje recibido o enviado;
  - el objeto `referral` del anuncio;
  - la prueba de consentimiento (opt-in);
  - un evento de conversión enviado;
  - una respuesta del agente de IA.

  Las correcciones van aparte, con autor, motivo y momento.
- **BR-003 · Consentimiento antes de escribir.** El sistema solo inicia una
  conversación (plantilla fuera de la ventana de 24 h) con quien tiene
  consentimiento vigente para esa categoría, o con quien escribió primero. La
  prueba guarda fecha, canal y texto aceptado.
  - La **base nacional de Campañas no tiene consentimiento de WhatsApp** y no
    se le envían plantillas de marketing.
  - Hacerlo arriesga que Meta limite o bloquee el número, que es el activo del
    que depende todo el programa.
- **BR-004 · Bajas.** Una persona que pide no recibir mensajes queda excluida
  de difusiones y flujos de marketing. Cuenta como pedido de baja:
  - el webhook `user_preferences`;
  - una palabra de baja («BAJA», «STOP», «no me escriban»);
  - la tipificación `NO_CONTACTAR`.

  La baja aplica a todos los números de la organización.
- **BR-005 · Un humano siempre disponible.** Toda automatización (agente,
  flujo, respuesta automática) ofrece pasar a una persona y se detiene cuando
  un asesor toma la conversación. Lo exige la política de WhatsApp.
- **BR-006 · Horario y fechas en Lima.** Se guarda en UTC y se lee en
  `America/Lima` (SPEC-005). Las ventanas de 24 h y 72 h se calculan desde el
  momento que informa Meta, no desde el reloj del navegador.
- **BR-007 · La etapa comercial no se escribe a mano cuando hay un dato que la
  prueba.** `GANADA` se deriva de un pedido DITO vinculado ingresado, y el
  estado del pedido (entregado, activado, cancelado) nunca es una etapa
  comercial (SPEC-061 BR-007 a BR-009). Así la conversión que se envía a Meta
  no depende de un clic (mismo criterio antifraude que SPEC-026).
- **BR-011 · Cuatro conceptos distintos.** Contacto, conversación, oportunidad
  y pedido son entidades separadas (SPEC-061 §3). Ninguna spec del programa
  guarda etapa, origen de compra o resultado en la conversación.
- **BR-012 · Un solo responsable de responder.** Cada conversación está en
  `IA_ACTIVA`, `REQUIERE_ASESOR` o `CONTROL_HUMANO`. Tomar control cancela los
  envíos automáticos pendientes, y la devolución al asistente es explícita
  (SPEC-054 BR-008 a BR-008c).
- **BR-013 · Lo que cambia se consulta, no se escribe en documentos.**
  Precios, promociones, cobertura y cupos de cita salen de datos del sistema
  (SPEC-061 BR-018, SPEC-058 BR-004).
- **BR-014 · Toda acción sensible deja rastro.** Reasignar, tomar control,
  cambiar etapa, vincular o desvincular un pedido, publicar un agente o
  activar un flujo registran autor, momento y motivo.
- **BR-008 · Cada cifra abre lo que cuenta** (SPEC-039). Los tableros de
  campañas, difusiones, flujos y agente enlazan a las conversaciones que suman.
- **BR-009 · Lenguaje directo.** La interfaz dice la consecuencia operativa,
  no el término de Meta. Por ejemplo:
  - «Ya no puedes escribirle libremente: usa una plantilla», no «ventana de
    servicio cerrada».
  - «Este envío costará aprox. S/ 48», no «tarifa marketing PMP».
- **BR-010 · El núcleo es de canal neutro.** La conversación, la etapa, la
  asignación, la etiqueta y el evento de conversión no nombran a WhatsApp.
  WhatsApp es un adaptador, igual que DITO es un adaptador de ventas.
  - Así podrán entrar después Instagram, Messenger o la voz de SPEC-035.
  - No se abstraen canales que hoy no existen: solo se evita acoplar el
    núcleo al primero.

## 6. Mapa del programa y etapas de entrega (v0.2)

### Módulos del producto y dónde vive cada uno

| Módulo | Qué resuelve | Spec |
|---|---|---|
| Empresas y usuarios | Aislamiento, roles y permisos sobre datos y acciones | Vigente (SPEC-001 §10); administrador de plataforma en etapa 4 |
| WhatsApp | Números, envío y recepción, estado de la conexión | SPEC-053 |
| Contactos y oportunidades | Persona, historial, intenciones de compra, origen | SPEC-053 (contacto) y SPEC-061 (oportunidad) |
| Bandeja de conversaciones | Asesores e IA, asignación, notas, transferencias, quién responde | SPEC-054 |
| Embudo por etapas | Tablero de oportunidades por etapa, responsable y siguiente acción | SPEC-061 |
| Plantillas | Crear, aprobar, costo, recategorización | SPEC-055 |
| Agentes de IA | Conocimiento, comportamiento, acciones permitidas, pruebas | SPEC-058 |
| Flujos de trabajo | Automatizaciones predefinidas y luego lienzo | SPEC-060 |
| Calendario | Citas, reprogramación, asistencia y cupos por franja | SPEC-048 (agenda) + SPEC-061 BR-016 + SPEC-058 BR-022 |
| Pedidos y atribución | Vínculo pedido ↔ oportunidad, regla de atribución, tres montos | SPEC-061 |
| Anuncios | Gasto, embudo por anuncio, crear/pausar | SPEC-056 |
| Conversiones a Meta | Eventos de la oportunidad y del pedido | SPEC-057 |
| Difusión | Segmentos con consentimiento, exclusiones, freno | SPEC-059 |
| Supervisión | Tiempos de atención, pendientes, conversión por origen | SPEC-054 BR-022, SPEC-061 BR-021, SPEC-058 BR-021 |

### Etapas de entrega

| Etapa | Alcance | Qué demuestra |
|---|---|---|
| **1 · Operación comercial conectada** | SPEC-053, SPEC-054, SPEC-055, SPEC-061 y SPEC-056 fase A (gasto y costo por pedido) | Un asesor gestiona y cierra una venta dentro de la plataforma, y se sabe cuánto costó por anuncio |
| **2 · Automatización e IA** | SPEC-058 (agente con un objetivo concreto, catálogo, cupos de cita), SPEC-060 fases 1-4 (seis automatizaciones predefinidas) y SPEC-057 | La automatización reduce trabajo y mejora la atención sin perder control |
| **3 · Seguimiento y medición** | SPEC-059 (difusión), SPEC-060 fase 5 (lienzo), SPEC-056 fase B (crear y pausar anuncios) y recuperación de oportunidades perdidas | Se mide qué acciones producen ventas y se actúa sobre ellas |
| **4 · Comercialización a terceros** | Tech Provider y Embedded Signup (SPEC-053 fase 5), alta autónoma, planes, cuotas y consumo, etapas configurables, administrador de plataforma | Otras empresas operan con independencia |

- El **piloto** con un número nuevo y una campaña pequeña cierra la etapa 1.
- La captura del origen (`referral`, toques) va en la etapa 1 aunque la
  medición completa sea de la etapa 3: **la evidencia que no se guarda al
  entrar no se puede reconstruir después**.
- La conversión a Meta (SPEC-057) sube a la etapa 2 porque es barata y mejora
  la entrega de anuncios mientras se construye lo demás. Optimizar por compra
  espera a tener volumen (SPEC-057 §5).
- *La numeración de specs ya no sigue el orden de entrega: SPEC-061 se agregó
  en la revisión y pertenece a la etapa 1.*

### Qué no se adoptó de la propuesta, y por qué

- **Crear pedidos desde la ficha.** Los pedidos se ingresan en DITO y el
  sistema no escribe en sistemas externos. La ficha **vincula**: automático
  por DNI o sugerido (SPEC-061 BR-011).
- **Asignación por especialidad.** No existe hoy dato de especialidad por
  asesor. Se asigna por disponibilidad, horario y reparto equitativo; la
  especialidad entra si José define cuáles hay.
- **Etapas adaptables por empresa desde ya.** Van en la etapa 4 (D-13).

## 7. Prerrequisitos fuera del código (José)

1. Portafolio de negocio de Meta **verificado** a nombre de la empresa.
   Sube el límite de envío de 250 a 2.000 destinatarios por día y es
   requisito para Tech Provider.
2. Un número nuevo que no esté registrado en WhatsApp (ni en la app).
3. Nombre visible propio del distribuidor. Meta lo revisa contra la marca, así
   que no puede presentarse como «Movistar».
4. Método de pago en la WABA. Desde el 01/04/2026 Meta factura en soles.
5. Cuenta publicitaria y página de Facebook vinculadas al número.
6. Aviso de privacidad actualizado (Ley 29733) que mencione WhatsApp y el uso
   de un asistente virtual.
7. Cuenta de la API de Anthropic con límite de gasto mensual.

## 8. Riesgos declarados

- **Sin copias fuera del servidor.** La revisión del 05/09/2026 encontró que
  la copia diaria vive en el mismo servidor. Las conversaciones con clientes
  pasan a ser un activo que no se puede reconstruir desde DITO, así que la
  copia fuera del servidor es **condición para verificar SPEC-054**.
- **Calidad del número.** Una difusión mal segmentada puede bajar la calidad y
  limitar todo el portafolio. SPEC-059 lo mitiga con topes propios.
- **Recategorización de plantillas.** Meta pasa sola de «utility» a
  «marketing», y el costo sube alrededor de 3,5 veces. SPEC-055 lo muestra
  apenas ocurre.
- **Cambios de Meta.** Embedded Signup v2 se retira en octubre de 2026 y los
  identificadores cambian (BSUID). El adaptador fija la versión de la Graph API
  en una sola constante y se revisa cada trimestre.
- **Costo de la IA.** Un agente que responde todo sin tope puede costar más
  que el asesor. SPEC-058 fija un tope mensual y la métrica de costo por
  conversación calificada.

## 9. Fuera de alcance del programa

- Instagram Direct, Messenger, correo y SMS. El núcleo los admite (BR-010),
  pero no se construyen.
- Llamadas de voz por WhatsApp.
- Catálogo y carrito de WhatsApp: el producto se vende por asesor e
  ingreso en DITO.
- Pagos dentro de WhatsApp.
- Vender el CRM a terceros. D-02 prepara el camino, pero la multiempresa
  comercial (planes, cobro, alta de clientes) es otro programa.

## 10. Fuentes consultadas (12/09/2026)

Documentación oficial de Meta: Cloud API, Embedded Signup, coexistencia,
pricing (por mensaje desde 01/07/2025), límites de mensajería, plantillas,
CTWA en Marketing API, Conversions API for Business Messaging, Flows,
política de opt-in y Business Solution Terms (IA, vigentes desde
15/01/2026). Lo marcado «por verificar» no se encontró confirmado en la
fuente oficial.
