# SPEC-089 — Las visitas de Máximo en la ficha del pedido

**Estado:** `ENTREGADA` — en `main` el 13/11/2026; vista solo en una vista previa estática con datos ficticios (día y noche, 258 px). Falta el recorrido en la aplicación con datos reales y registrar la lectura de producción

**Versión:** 0.1
**Fecha:** 2026-11-13

## 1. Origen

Auditoría del 13/11/2026 sobre las 227 entregas fallidas de noviembre en
producción (`docs/revisiones/2026-11-13-auditoria-recupero-y-seguimiento.md`):

- de 80 pedidos con motivo final «CLIENTE AUSENTE EXCEDE 3 VISITAS», 72
  tienen solo 2 eventos NO ENTREGADO;
- de 54 «CLIENTE NO DESEA NO RECUPERABLE», 49 tienen un solo intento;
- las 227 pasaron primero por NO ENTREGADO, y el motivo de esa visita (no
  contesta, punto de encuentro, pide reagendar) queda tapado por el final;
- 68 de 69 canceladas pasan por PRECANCELADO.

José: «no debemos guiarnos solo por lo que dice el motorizado». Quiere ver
cada visita con su comentario y distancia, bien organizado y usable.

Hasta ahora la ficha pintaba la foto de Máximo como una pila plana de
pares etiqueta/valor (SPEC-075): estado, motivo, submotivo, intentos,
«Recorrido» en una línea que se partía en tres renglones, «Última
actualización» como texto crudo («nov 11, 2026 12:21 a.m.»), pedido y la
hora de consulta en otro formato («11/11/2026, 09:26»). El bloque medía
~418 px de alto y empujaba «¿En qué va?» fuera de la pantalla.

### Lo que se revierte

SPEC-075 BR-007 (José, 25/09/2026) fijó qué campos de Máximo no se
muestran. El 23/10/2026, al pasar a `/api/order-history` (SPEC-029 §13),
se añadió `historial` a esa lista porque «los eventos ya se resumen en
Recorrido» (`agr-delivery-fields.ts`, `agrDeliveryHiddenKeys`; SPEC-075
tasks, «Ajuste por el historial de Máximo»). Esta spec lo revierte en
parte por decisión de José del 13/11/2026: el historial se muestra, visita
por visita. Sigue fuera de la lista plana de pares; lo lee un módulo
propio.

## 2. Reglas

- **BR-001 — Un bloque con jerarquía: «Entrega según Máximo».** Sustituye
  la pila plana en la ficha del pedido. Orden:
  1. Cabecera: estado actual en el texto de la plataforma (Rechazado,
     Cancelado, No entregado, Agendado, Entregado…) y, debajo, cuándo fue el
     último movimiento y el pedido de Máximo con el control de copiar del
     teléfono (`CopyValue`).
  2. Motivo final y submotivo en una línea.
  3. Una frase de hechos: «2 visitas fallidas».
  4. Las visitas: una por cada NO ENTREGADO («Visita 1», «Visita 2»…) con
     fecha y hora, motivo · submotivo de esa visita, comentario entre «…» y,
     en línea secundaria, quién la registró, distancia y tiempo si vienen.
     Después, el cierre (RECHAZADO, PRECANCELADO → CANCELADO, ENTREGADO) con
     su fecha, motivo (solo si no es el mismo motivo final de arriba, para
     no ocupar dos renglones con lo mismo), comentario y usuario.
     PRECANCELADO como último estado también cuenta como cierre. ASIGNADO, AGENDADO, PREPARADO y
     DESPACHADO no son visitas: no se listan ahí.
  5. «Ver todos los movimientos (N)», plegado: la secuencia completa con
     estado, fecha, motivo, comentario y usuario.
  6. Pie discreto: «Consultado <fecha>».
- **BR-002 — Hechos, no juicio.** Cuando el motivo final afirma un número
  de visitas que el historial no respalda (hoy: contiene «EXCEDE N
  VISITAS» y hay menos de N eventos NO ENTREGADO), la frase dice las dos
  cifras: «Máximo dice 3 visitas; registra 2». No dice que el motorizado
  miente ni califica. Función pura `compareAgrVisits` /
  `describeAgrVisits` en `features/agr-delivery/delivery-reading.ts`.
- **BR-003 — Una sola forma de fecha.** Todas las fechas del bloque van
  como el resto de la ficha, «11/11/2026, 00:21», en hora de Lima, con
  `parseAgrDateTime` de `order-history.ts`. Una fecha de Máximo sin hora
  va solo con el día. Si no se puede leer, se muestra el texto original; si
  no viene, se omite.
- **BR-004 — Textos libres a la defensiva.** `usuario`, `distancia`,
  `tiempo_hrs` y `comentario` se muestran tal cual llegan: sin convertir la
  distancia a número ni suponerle unidad, con los espacios repetidos
  colapsados y recortados en una palabra (comentario: 200 caracteres en la
  visita, 400 en «todos los movimientos»; los demás, 40). Lo vacío se
  omite. «0» no es vacío: se muestra.
- **BR-005 — Sin historial, sin huecos.** Fotos anteriores al 23/10/2026 o
  respuestas sin eventos: cabecera, motivo, pedido y consultado. Ni «0
  visitas» ni lista vacía ni plegable.
- **BR-006 — Los textos de Máximo, tal cual y sin competir.** Motivos y
  comentarios van como llegan, sin negrita; la negrita es para la cabecera,
  «Visita N», el estado del cierre y la frase de cifras.
- **BR-007 — Lo demás que manda Máximo no se pierde** (SPEC-075 BR-001):
  los campos con valor que el bloque no dice con su forma propia (gestión,
  envío, teléfono del receptor, campos nuevos) siguen debajo, en letra
  chica. Los ocultos de SPEC-075 BR-007 siguen ocultos.
- **BR-008 — Tonos y estructura.** El bloque conserva `.ui-order-notice`
  con su regla de tono: ámbar si Máximo lo marca como problema de entrega y
  el dato está vigente; gris si no (SPEC-075 BR-002). No hay tono por estado
  de Máximo en el repo; no se inventa uno. Las visitas son una lista
  ordenada (`<ol>`); el cierre se distingue por su texto, no solo por el
  color.
- **BR-009 — La misma pieza en todas las fichas.** Asesor (SPEC-080),
  supervisor y administrador usan `OrderDetails` → `AgrDeliveryPanel`; el
  bloque sale en todas. La ficha de Recupero de ventas
  (`/recovery/sales/[caseId]`) muestra el mismo componente debajo de la
  tarjeta de trabajo. La lectura del servidor se amplía solo en esa ficha
  (`rawPayload` y `fetchedAt` de la foto), con el mismo filtro por rol; las
  listas de Recupero y Mi día no cargan la foto completa.
- **BR-010 — Logística: la corrida completa.** En
  `/admin/logistics` la última corrida muestra también encontradas, con
  cambios y con error, y el mensaje de error si lo hay; con
  `errorOrders > 0` el número y el mensaje van destacados en rojo con
  borde. Solo presentación.

## 3. Fuera de alcance

La lógica de sincronización, de estados del pedido y de recupero; la lista
de pedidos (filas y chips: siguen leyendo `fields`); Mi día; `getAgrAction`;
qué datos se guardan.

## 4. Criterios de aceptación

- **AC-001:** con 2 NO ENTREGADO y rechazo «CLIENTE AUSENTE EXCEDE 3
  VISITAS», el bloque dice «Máximo dice 3 visitas; registra 2», lista
  «Visita 1», «Visita 2» y el cierre «Rechazado».
- **AC-002:** con 3 NO ENTREGADO y el mismo motivo dice «3 visitas
  fallidas».
- **AC-003:** con 1 NO ENTREGADO y «NO RECUPERABLE» dice «1 visita
  fallida» y la visita conserva su propio motivo.
- **AC-004:** PRECANCELADO → CANCELADO sale como un solo cierre con el
  motivo y lo que anotó cada uno.
- **AC-005:** sin historial, el bloque tiene cuatro líneas: cabecera,
  último movimiento y pedido, motivo, consultado.
- **AC-006:** un evento sin fecha no muestra fecha; uno con fecha ilegible
  muestra el texto original.
- **AC-007:** un comentario vacío no deja comillas vacías.
- **AC-008:** en una pantalla de ~258 px de ancho, con 1-2 visitas, el
  bloque no crece más que el actual (~418 px). **Pendiente de recorrido en
  navegador.**
- **AC-009:** Logística muestra encontradas, con cambios, con error y el
  mensaje.
