# SPEC-058 — Agente conversacional entrenable

**Estado:** `BORRADOR` — en pausa desde el 24/09/2026: el CRM y WhatsApp se replantearán desde cero, según el negocio, cuando José los aborde; esta spec queda como referencia

**Versión:** 0.2
**Fecha:** 2026-09-12

## 1. Problema

Un lead de anuncio que escribe a las 11 de la noche espera hasta el día
siguiente. Para entonces:

- ya habló con otro distribuidor;
- la ventana gratuita de 72 h se perdió, porque exige responder dentro de las
  primeras 24 h.

En horario, los asesores gastan los primeros minutos de cada chat en las
mismas preguntas: qué plan quiere, de qué operador viene, si tiene DNI a la
mano y si hay cobertura de entrega en su distrito.

## 2. Objetivo

Un asistente virtual del distribuidor que:

- responde al instante;
- informa con la información aprobada por la empresa;
- reúne los datos para evaluar;
- agenda o pasa a un asesor en el momento justo.

La supervisión lo **entrena desde la plataforma**, sin programar: instrucciones,
conocimiento, ejemplos y pruebas. Cada cambio se prueba antes de publicarse.

## 3. Qué es y qué no es (política de WhatsApp, vigente desde 15/01/2026)

- **Es** un asistente de atención y venta de los servicios del propio
  distribuidor. La IA es accesoria al negocio, lo que la política permite.
- **No es** un asistente de conversación general. Se niega a temas ajenos
  (tareas escolares, política, recetas) y vuelve al servicio.
- **Siempre se identifica** como asistente virtual y ofrece hablar con una
  persona (SPEC-052 BR-005).
- **Los datos de las conversaciones no entrenan modelos de terceros.** El
  proveedor (SPEC-052 D-10) se contrata bajo condiciones sin entrenamiento.
  «Entrenar» aquí significa configurar instrucciones, conocimiento y ejemplos
  propios, no reentrenar un modelo.

## 4. Alcance

1. Configuración del agente: identidad, objetivo, tono, límites y horario.
2. Base de conocimiento editable y versionada.
3. Ejemplos de conversación modelo, tomados de conversaciones reales.
4. Herramientas que el agente puede usar, con permisos por herramienta.
5. Reglas de cuándo actúa y cuándo pasa a humano.
6. Simulador y conjunto de pruebas que se corre antes de publicar.
7. Versionado, publicación y vuelta atrás.
8. Supervisión: cada respuesta visible, marcable y corregible.
9. Tope de gasto y métricas.

## 5. Reglas de negocio

### Configuración y entrenamiento

- **BR-001:** entrenan el agente `ADMIN` y `SUPERVISOR`. Cada organización
  puede tener varios agentes; cada número o anuncio usa uno (SPEC-056 BR-008).
- **BR-002:** la **configuración** tiene:
  - nombre visible («Sofía, asistente virtual de Distribuidor Online»);
  - objetivo en una frase;
  - tono;
  - lo que debe hacer;
  - lo que nunca debe hacer;
  - datos a reunir, en orden;
  - horario en que actúa.

  Se escribe en formularios con ayuda, no en un solo texto libre.
- **BR-003:** la **base de conocimiento** se organiza en artículos cortos con
  título, contenido y **vigencia** (desde / hasta). Temas:
  - requisitos de portabilidad;
  - cómo funciona la entrega (la cobertura por distrito la da la herramienta);
  - preguntas frecuentes;
  - objeciones y respuestas.

  Un artículo vencido deja de usarse solo. El agente responde **solo** con lo
  que está en la base. Si no está, dice que un asesor lo confirma y deriva.
- **BR-004:** **precios, promociones, cobertura y horarios no viven en
  documentos**, sino en datos del sistema que el agente consulta con
  herramientas en cada conversación:
  - el catálogo de planes vigente (SPEC-061 BR-018);
  - las zonas de entrega;
  - la disponibilidad de citas (BR-022).

  El agente **no puede prometer** un precio, descuento, regalo o plazo que no
  devuelva una herramienta, y la prueba de publicación lo verifica (BR-016).
  El editor de artículos advierte si un texto contiene montos («S/»,
  «soles») para que el precio no quede escrito en un documento que se
  desactualiza. *(En v0.1 los precios vivían en artículos; se corrigió el
  12/09/2026.)*
- **BR-005:** los **ejemplos** son conversaciones modelo. Un supervisor puede
  marcar un tramo de una conversación real de la bandeja como «buen ejemplo»
  o «mal ejemplo, así no», con una nota. Los datos personales del tramo se
  reemplazan por marcadores antes de guardarse como ejemplo.
- **BR-006:** cada cambio de configuración, conocimiento, ejemplos o
  herramientas crea un **borrador**. La versión publicada no cambia hasta
  publicar.

### Herramientas del agente

- **BR-007:** el agente solo actúa mediante herramientas declaradas. Cada
  herramienta se activa o desactiva por agente:

  | Herramienta | Qué hace | Límite |
  |---|---|---|
  | Guardar dato del lead | Nombre, DNI, operador actual, distrito, líneas, plan de interés | En el contacto y la oportunidad abierta |
  | Consultar planes vigentes | Planes, cargo fijo, requisitos y promoción del catálogo | Solo lectura; solo vigentes |
  | Consultar cobertura de entrega | Si el distrito está en zona de reparto | Lee tabla de zonas |
  | Consultar horarios disponibles | Franjas con cupo del equipo (BR-022) | Solo lectura |
  | Avanzar oportunidad | A `CALIFICADO` con datos mínimos, o a `PROPUESTA` con plan del catálogo o cita | Nunca `EN_CIERRE` ni `GANADA` |
  | Agendar llamada | Crea la cita de la oportunidad en la agenda (SPEC-048, SPEC-061 BR-016) | Solo en una franja con cupo |
  | Pasar a asesor | Deriva a la cola del equipo con un resumen | Siempre disponible |
  | Etiquetar | Agrega etiquetas de una lista permitida | No borra etiquetas |
  | Registrar baja | Registra la baja de marketing (SPEC-053 BR-020) | — |

- **BR-008:** el agente **nunca**:
  - ingresa pedidos en DITO;
  - consulta el DNI en el servicio pagado;
  - cambia el asesor asignado;
  - pide datos de tarjeta o claves;
  - envía plantillas de marketing;
  - borra información.

  La consulta DNI queda en manos del asesor por su costo y su auditoría
  (SPEC-031).

### Cuándo actúa y cuándo deriva

- **BR-009:** el agente actúa en una conversación solo si todo esto se cumple:
  1. el número o anuncio tiene un agente publicado;
  2. la conversación está en su horario **o** no hay asesor conectado en el
     equipo (SPEC-054 BR-005);
  3. la conversación está en `IA_ACTIVA` (SPEC-054 BR-008).
- **BR-010:** deriva a un asesor, pasando la conversación a
  `REQUIERE_ASESOR` con un resumen de lo conversado y los datos reunidos,
  cuando:
  - la persona pide hablar con alguien;
  - reúne los datos mínimos y está calificada;
  - lleva **3 turnos seguidos sin avanzar**;
  - la persona expresa molestia o reclamo;
  - la pregunta no está en la base de conocimiento;
  - la persona manda un audio, una imagen o un documento que el agente no
    puede interpretar con seguridad.
- **BR-011:** fuera del horario de asesores, al derivar dice cuándo lo
  atenderán («mañana desde las 9:00») y agenda si la persona acepta. Nunca
  deja una derivación sin decir qué sigue.
- **BR-012:** con la ventana de 24 h cerrada el agente no escribe. Solo
  responde a mensajes entrantes.

### Evidencia y supervisión

- **BR-013:** cada respuesta del agente guarda, de forma inmutable:
  - la versión publicada del agente y el modelo usado;
  - los artículos consultados;
  - las herramientas llamadas con sus datos;
  - los tokens y el costo.

  En la bandeja, cada mensaje del agente lleva la marca «asistente virtual» y
  un botón «¿por qué respondió esto?» que muestra artículos y herramientas.
- **BR-014:** un supervisor puede marcar una respuesta como incorrecta con el
  motivo («inventó un precio», «no derivó», «tono»). La marca alimenta la
  lista de pruebas de BR-016 y la métrica de errores.
- **BR-015:** un asesor puede tomar control en cualquier momento. Las
  respuestas del agente que aún no salieron se cancelan (SPEC-054 BR-008b), y
  el agente solo vuelve con una devolución explícita o por la regla visible
  del equipo (SPEC-054 BR-008c).

### Probar y publicar

- **BR-016:** el **conjunto de pruebas** es una lista de conversaciones de
  entrada con lo que se espera. Ejemplos:
  - «debe derivar»;
  - «no debe mencionar precio»;
  - «debe guardar el DNI»;
  - «debe negarse».

  Se construye con casos escritos por el supervisor y con las respuestas
  marcadas como incorrectas.
- **BR-017:** **publicar exige correr el conjunto de pruebas** sobre el
  borrador y ver el resultado.
  - Publicar con alguna prueba crítica fallida exige la confirmación de un
    `ADMIN` con motivo. **Supuesto:** las pruebas de «no inventar precio» y
    «derivar cuando lo piden» son críticas por defecto.
- **BR-018:** el **simulador** deja conversar con el borrador como si fuera un
  cliente, sin enviar nada a WhatsApp ni tocar fichas reales: las
  herramientas operan sobre datos de prueba.
- **BR-019:** publicar guarda la versión anterior. **Volver atrás** a
  cualquier versión publicada es un clic con motivo, y las conversaciones en
  curso siguen con la versión nueva desde su siguiente mensaje.

### Costo

- **BR-020:** cada organización tiene un **tope de gasto mensual** del agente
  en soles.
  - Al 80 % avisa a los administradores.
  - Al 100 % el agente deja de actuar y las conversaciones van directo a la
    cola, con aviso.
- **BR-021:** las métricas del agente, por período y versión:
  - conversaciones atendidas;
  - derivadas y por qué motivo;
  - calificadas;
  - con pedido ingresado y entregado (derivado, SPEC-056);
  - respuestas marcadas incorrectas;
  - costo total, **costo por conversación calificada** y costo por pedido
    entregado.

  Cada cifra abre sus conversaciones.

### Disponibilidad para citas

- **BR-022:** cada equipo define sus **franjas de atención** y el **cupo de
  llamadas agendadas por franja** (por ejemplo, 6 cada 30 minutos de 9:00 a
  19:00, en Lima). El agente solo ofrece franjas con cupo. Un asesor puede
  agendar fuera de cupo, con aviso.
  - La **asistencia** se registra con el resultado de la cita en la agenda
    (SPEC-048): atendida, no contestó o reprogramada.
  - Las citas no atendidas por el cliente se miden por origen y por agente.

## 6. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| Modelo | **`claude-opus-5` con esfuerzo bajo** como punto de partida; se mide costo por conversación calificada en el piloto y José decide si probar uno más económico (`claude-sonnet-5`, `claude-haiku-4-5`) con el mismo conjunto de pruebas | El error caro es inventar un precio o no derivar; el conjunto de pruebas permite comparar modelos con evidencia y no por intuición |
| ¿Conocimiento completo en contexto o búsqueda semántica? | **Completo en contexto con caché** mientras la base quepa holgada (cientos de artículos cortos); búsqueda semántica solo si crece | Menos piezas (sin base vectorial), respuestas citables y caché que abarata cada turno |
| ¿Dónde corre? | **`apps/api`**, llamado desde el procesador de mensajes entrantes, con la API de Claude y herramientas propias (no un agente alojado con sandbox) | Las herramientas son operaciones del sistema con permisos y aislamiento por organización; no hace falta ejecutar código |
| Horario inicial | **Fuera de horario de asesores y cuando no hay nadie conectado** | Resuelve la pérdida nocturna sin competir con los asesores; se amplía con datos del piloto |
| ¿Varios proveedores de modelos? | **Un adaptador interno mínimo y un solo proveedor validado.** Cambiar de modelo o de proveedor se trata como versión nueva del agente: exige correr el conjunto de pruebas completo antes de publicar | Otro modelo no garantiza el mismo comportamiento; decide la evidencia de las pruebas, no la promesa de portabilidad |
| Tope mensual inicial | **A definir por José**, con aviso al 80 % | Es decisión de presupuesto; el sistema no asume un monto |

## 7. Criterios de aceptación

- **AC-001:** en el simulador, preguntar por un plan que no está en el
  catálogo vigente produce «lo confirma un asesor» y la derivación, nunca un
  precio.
- **AC-012:** cambiar el cargo fijo de un plan en el catálogo cambia la
  respuesta del agente en la siguiente conversación, sin publicar una versión
  nueva.
- **AC-013:** con la franja de las 10:00 sin cupo, el agente no la ofrece y
  propone la siguiente con cupo.
- **AC-002:** «quiero hablar con una persona» deriva en el mismo turno, con
  resumen y datos reunidos visibles para el asesor.
- **AC-003:** con un asesor que escribió en la conversación, el agente no
  responde al siguiente mensaje del cliente.
- **AC-004:** una pregunta ajena («hazme la tarea») recibe una negativa amable
  y vuelve al servicio.
- **AC-005:** publicar con una prueba crítica fallida exige confirmación de
  administrador con motivo. Sin fallos, publica y guarda la versión anterior.
- **AC-006:** volver a la versión anterior cambia la respuesta del simulador y
  queda registrado.
- **AC-007:** cada mensaje del agente en la bandeja muestra versión, artículos
  y herramientas usados.
- **AC-008:** un artículo con vigencia vencida deja de usarse sin publicar de
  nuevo.
- **AC-009:** al alcanzar el tope mensual simulado, el agente deja de actuar y
  la conversación va a la cola con aviso.
- **AC-010:** un tramo marcado como ejemplo no conserva nombre, DNI ni
  teléfono del cliente.
- **AC-011:** el agente no tiene forma de ingresar un pedido ni consultar el
  DNI pagado (prueba sobre la lista de herramientas).

## 8. Fuera de alcance

- Voz (responder o transcribir audios). **Supuesto:** candidato posterior.
- Ajuste fino (*fine-tuning*) de modelos.
- Que el agente inicie conversaciones o haga seguimiento proactivo; eso es de
  los flujos (SPEC-060) con plantillas.
- Agente para asesores (sugerencias de respuesta en la bandeja). **Supuesto:**
  candidato posterior sobre la misma base de conocimiento.
