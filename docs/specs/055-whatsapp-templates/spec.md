# SPEC-055 — Plantillas de WhatsApp

**Estado:** `BORRADOR` — en pausa desde el 24/09/2026: el CRM y WhatsApp se replantearán desde cero, según el negocio, cuando José los aborde; esta spec queda como referencia

**Versión:** 0.1
**Fecha:** 2026-09-12

## 1. Problema

Pasadas 24 h desde el último mensaje del cliente, WhatsApp solo deja escribirle
con una **plantilla aprobada por Meta**. Sin plantillas no se puede:

- retomar un lead que dejó de responder;
- avisar la fecha de entrega del chip;
- recordar una cita;
- hacer difusiones.

Hoy crearlas exige entrar a WhatsApp Manager. El equipo no sabe cuáles
existen, cuánto cuesta cada una ni cuándo Meta cambió su categoría y subió
el precio.

## 2. Objetivo

Crear, revisar y usar plantillas desde el sistema, con su costo y su estado
siempre visibles, sin entrar a Meta.

## 3. Alcance

1. Biblioteca de plantillas sincronizada con la WABA.
2. Editor con vista previa tal como se verá en WhatsApp.
3. Envío a revisión de Meta y seguimiento del estado.
4. Variables del sistema asignadas a cada parámetro.
5. Alertas de cambio de categoría, pausa y calidad.
6. Uso desde la bandeja (SPEC-054), el agente (SPEC-058), las difusiones
   (SPEC-059) y los flujos (SPEC-060).

## 4. Reglas de negocio

- **BR-001:** la biblioteca refleja la WABA.
  - Una plantilla creada en WhatsApp Manager aparece en el sistema en la
    siguiente sincronización: al abrir la pantalla y cada hora desde el
    worker.
  - Una borrada en Meta queda «retirada» en el sistema, con su historial de
    envíos intacto.
- **BR-002:** crean y editan plantillas `ADMIN` y `SUPERVISOR`. Las usan todos
  los que pueden enviar.
- **BR-003:** el editor admite los componentes de Meta: encabezado (texto,
  imagen, video o documento), cuerpo, pie y hasta 10 botones (respuesta
  rápida, URL, llamar, copiar código o abrir un Flow). Valida los topes de
  longitud **antes** de enviar a revisión.
- **BR-004:** las variables se escriben con nombre legible en el editor
  (`{{nombre}}`, `{{fecha_entrega}}`) y cada una exige un ejemplo, que Meta
  pide. Cada variable se asocia a un **dato del sistema** o queda como «la
  completa quien envía»:
  - nombre del contacto;
  - nombre del asesor;
  - fecha de la cita;
  - fecha y turno de entrega de AGR;
  - número de pedido.
- **BR-005:** la categoría la propone quien crea con una ayuda en lenguaje
  directo:
  - «**Marketing:** ofertas, promociones, retomar a alguien que no
    compró».
  - «**Utilidad:** avisos sobre algo que el cliente ya pidió: su entrega, su
    cita, su pedido. Sin ofertas».

  El sistema advierte si el texto de una plantilla de utilidad contiene
  palabras promocionales («oferta», «descuento», «promoción», «gratis»,
  «aprovecha»), porque Meta la reclasificará.
- **BR-006:** cada plantilla muestra su **costo aproximado por envío en
  soles**, según la categoría y la tarifa de Perú vigente. La tarifa se guarda
  por organización con su fecha de vigencia y no se escribe en el código.
  - Las de utilidad dicen «gratis si la ventana de 24 h está abierta».
  - Las conversaciones que vienen de un anuncio dicen «gratis durante las 72
    h del anuncio».
- **BR-007:** estados en lenguaje directo, desde los webhooks de Meta:
  - «En revisión».
  - «Aprobada».
  - «Rechazada: motivo».
  - «Pausada hasta las 15:40 por baja calidad».
  - «Desactivada».
  - «Meta la pasó a Marketing: ahora cuesta S/ 0,30 por envío».
- **BR-008:** un cambio de categoría (`template_category_update`) o una pausa
  (`message_template_status_update`) avisa a los administradores y a quien
  la creó. Los flujos y las difusiones programadas que la usan quedan en
  espera hasta que alguien confirme seguir con el nuevo costo.
- **BR-009:** **editar una plantilla aprobada crea una versión nueva** que
  vuelve a revisión, porque Meta la revisa de nuevo. Los envíos hechos
  conservan la versión exacta usada: texto, variables e idioma.
- **BR-010:** la calidad de cada plantilla (`message_template_quality_update`)
  se muestra con su tasa de lectura y de bloqueos cuando Meta la informa.
- **BR-011:** idioma por defecto `es` (español). **Supuesto:** una sola
  variante de idioma por plantilla mientras la operación sea en Perú.
- **BR-012:** hay una biblioteca inicial de plantillas sugeridas, escritas
  para la operación y que se envían a revisión al conectar el número:
  - retomar lead sin respuesta (marketing);
  - recordatorio de cita (utilidad);
  - «tu chip llega el …» (utilidad);
  - «no pudimos entregarte» (utilidad);
  - «confirma tu dirección» (utilidad);
  - confirmación de baja (utilidad).

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Crear desde el sistema o solo sincronizar? | **Crear y sincronizar** | Sin crear, el supervisor igual depende de Meta y de quien tenga acceso |
| ¿Quién crea? | **ADMIN y SUPERVISOR** | El supervisor conoce el mensaje que su equipo necesita; el costo es visible antes de enviar |
| ¿Biblioteca inicial? | **Sí, las seis de BR-012** | Utilidad bien categorizada desde el día uno evita reclasificaciones y abre los avisos de logística (SPEC-060) |

## 6. Criterios de aceptación

- **AC-001:** una plantilla creada en el sistema llega a Meta, cambia a
  «Aprobada» o «Rechazada» por webhook, y el motivo del rechazo se lee en
  español.
- **AC-002:** una plantilla creada en WhatsApp Manager aparece en la
  biblioteca tras sincronizar.
- **AC-003:** un cuerpo más largo que el tope de Meta no se puede enviar a
  revisión y el editor dice cuánto sobra.
- **AC-004:** una plantilla de utilidad con «oferta» en el cuerpo muestra la
  advertencia de reclasificación.
- **AC-005:** enviar desde la bandeja con la ventana cerrada completa las
  variables con los datos del contacto. Quien envía completa las demás y ve
  el costo antes de confirmar.
- **AC-006:** simulando `template_category_update`, se avisa a los
  administradores, y una difusión programada que la usa queda en espera.
- **AC-007:** editar una aprobada crea una versión en revisión y los envíos
  anteriores siguen mostrando el texto original.

## 7. Fuera de alcance

- Plantillas de autenticación (códigos de un solo uso).
- Diseño de WhatsApp Flows. Aquí solo se enlaza un Flow ya creado a un botón.
- Carruseles de productos y catálogo.
- Traducción a otros idiomas.
