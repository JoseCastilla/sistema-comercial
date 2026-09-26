# SPEC-074 — Pedidos como hoja de trabajo: cada control, una sola vez

**Estado:** `ENTREGADA` (fase 1) — José: «sigue con la hoja de trabajo de SPEC-074» (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

José pidió mejorar la experiencia de Pedidos y diseñar el recorrido del
usuario. Propuso además una vista tipo Excel. Luego pidió: «Evalúa si
estamos redundando, cada botón debe estar diseñado para aumentar la
productividad, con nombres intuitivos».

Se inventariaron los controles de `/orders` en producción (sesión de
supervisora, solo lectura, 25/09/2026). Las definiciones de las vistas
están en `get-order-inbox.ts`, en `getStatusFilter`.

## 2. Redundancias encontradas

| # | Qué se repite | Dónde | Cuántas veces |
|---|---|---|---|
| R1 | Ir a «fuera de plazo» | aviso «16 fuera de plazo», pestaña «Incidencias» (que los incluye) y selector «Plazo» | 3 caminos |
| R2 | Ir a entregas fallidas | aviso «175 entregas fallidas» y pestaña «Entregas fallidas por gestionar» | 2 caminos |
| R3 | Ir a por recuperar | aviso «130 por recuperar», pestaña «Por recuperar» y el módulo Recupero de ventas | 3 caminos |
| R4 | Vistas que se contienen | «Activos» contiene a «Por activar» y a casi todo «Incidencias»; «Entregados» y «Finalizados» comparten los cerrados; «Por recuperar» y «Entregas fallidas» comparten los cancelados | un pedido aparece hasta en 4 vistas |
| R5 | Copiar orden, DNI y teléfono | en la fila y en el panel | 2 veces cada uno |
| R6 | El código de la fila hace dos cosas | «Seleccionar y copiar orden»: elegir la fila copia al portapapeles sin que se pida | — |
| R7 | Cambiar el avance | dos selectores («Estado» y «¿En qué va la entrega?»); el segundo solo sirve con «Enviado» | 2 controles, unas 6 acciones |
| R8 | Frescura de los datos | «Actualización automática» y «Actualizado: 21:07» | 2 indicadores |
| R9 | Nombres de asesor | la lista dice «Christian R.» y el selector «CHRISTIAN HUGO RUIZ COTERA · HUANCAYO - EL TAMBO» | 2 formas |

Medido en producción:

- de los 35 «Activos», 11 ya estaban entregados;
- «Incidencias» (16) era el mismo conjunto que «Fuera de plazo» (16);
- de las entregas fallidas, unas 80 de cada 100 ya estaban canceladas.

Parte de la repetición es de SPEC-073: los avisos de «por atender»
duplican las pestañas. Se corrige aquí.

## 3. Principio

Cada control existe una sola vez y su nombre dice qué pasa al usarlo. Una
cifra vive en la pestaña que la abre, no en un aviso aparte. Un botón que
cambia algo nombra el resultado («Entregado»), no la mecánica («Guardar
estado»).

## 4. Propuesta (presentación, salvo lo marcado)

### 4.1 Vistas: cada pedido en una sola, con su cifra

| Hoy (9) | Propuesta (6) | Qué contiene |
|---|---|---|
| Activos · Incidencias | **Por mover** | Abiertos y enviados sin entregar ni cancelar, vencidos primero (el plazo ya ordena) |
| Entregas fallidas por gestionar | **Máximo pide acción** | Los que tienen una acción de Máximo; salen de «Por mover» |
| Por activar | **Falta activar** | Entregados sin cerrar |
| Escaladas | **Escaladas** | Sin cambio |
| Entregados · Finalizados | **Cerrados** | Cerrados y cancelados |
| Todos | **Todos** | Sin cambio |
| Por recuperar | — | Sale de Pedidos: esos pedidos ya abren su caso solos (SPEC-030 BR-061) y se trabajan en Recupero de ventas. La pestaña «Cerrados» lleva allí. **Decisión de José** |

- Los avisos de «por atender» desaparecen: la cifra va en cada pestaña
  (R1 a R3).
- El selector «Plazo» queda como filtro dentro de «Por mover».
- Al entrar, el asesor cae en «Por mover». La supervisión cae en «Por
  mover» de su equipo, no en «Todos» (hoy entra a 403 pedidos, 368 ya
  terminados).

### 4.2 La fila: leer como Excel, actuar en la fila

- Columnas: Plazo · Cliente (y orden) · DNI · Teléfono · En qué va (con la
  acción de Máximo como etiqueta, SPEC-029 BR-027) · Siguiente paso.
- Copiar solo en el desplegado de la fila; elegir la fila ya no copia
  nada (R5, R6).
- Asesor con el mismo nombre corto en la fila y en el filtro (R9).

### 4.3 El siguiente paso: un botón por resultado

«Estado» y «¿En qué va la entrega?» pasan a un solo grupo, **«¿En qué va?»**,
con los pasos que tienen sentido desde el estado actual:

| Si está en… | Botones |
|---|---|
| Abierto | Enviado · Pedir cancelación |
| Enviado, sin reporte | Asignado · Agendado · Entregado · No entregado |
| Asignado | Agendado · Entregado · No entregado |
| Agendado | Entregado · No entregado · Rechazado |
| No entregado | Agendado · Entregado · Rechazado · Pedir cancelación |
| Entregado sin cerrar | (asesor: nada que hacer) · supervisión: **Cerrar: ya activó** |

- Un toque guarda. La nota es opcional, salvo en «Pedir cancelación», que
  sigue exigiendo el motivo y la aprobación (SPEC-013).
- «Guardar y siguiente» pasa al pedido de abajo.
- Nombres: «Pedir cancelación», no «Cancelado». Para el asesor ya se
  llama «Solicitar cancelación»; se usa el verbo corto.
- La escalación y el envío a recupero se quedan donde están, como
  acciones secundarias en «Más».

### 4.4 Cabecera

- «Actualizado 21:07 · en vivo» en un solo indicador (R8).

## 5. Decisión de negocio (José)

- **D1 — Confirmar lo que dice Máximo.** Cuando Máximo reporta «entregado»
  o «no entregado», la fila ofrece «Confirmar: Entregado». Sigue siendo
  una persona quien cambia el estado (SPEC-029 BR-014), pero con un toque.
- **D2 — Quitar «Por recuperar» de Pedidos** (§4.1).

## 6. Criterios de aceptación (borrador)

- **AC-001**: ningún destino se alcanza por dos controles distintos en la
  misma pantalla.
- **AC-002**: un pedido aparece en una sola vista, salvo en «Todos».
- **AC-003**: pasar un pedido de «Agendado» a «Entregado» cuesta un toque.
- **AC-004**: ningún botón se llama «Guardar», «Seleccionar» o «Enviar»
  sin decir qué guarda o envía.

## 7. Fase 1: lo entregado (25/09/2026)

- **Vistas:** siete, cada una con su cifra.
  - «Por mover», nueva, que reemplaza a Activos e Incidencias.
  - «Entregas fallidas».
  - «Falta activar».
  - «Escaladas».
  - «Por recuperar».
  - «Cerrados», nueva, que reemplaza a Entregados y Finalizados.
  - «Todos».

  Detalles:
  - Todos los roles entran a «Por mover».
  - Los enlaces antiguos (`ACTIVE`, `INCIDENTS`, `DELIVERED`, `FINAL`)
    siguen abriendo; la vista antigua aparece como una pestaña más.
  - «Por mover» y «Cerrados» dejan fuera lo que Máximo reporta con
    problema, que vive en «Entregas fallidas».
  - «Escaladas» es una marca, no una etapa: un pedido escalado también
    sigue en su vista.
- **Avisos:** los de «por atender» (SPEC-073) desaparecen porque repetían
  las pestañas. Queda solo el enlace a lo pendiente de meses anteriores.
- **«¿En qué va?»:**
  - Un botón por resultado, según la tabla de §4.3
    (`order-next-step.tsx`).
  - Un toque guarda con la nota de siempre, que se puede editar antes.
  - En escritorio pasa al pedido de abajo.
  - El formulario completo queda plegado en «Otro cambio», para volver a
    Abierto y para cancelar o pedir cancelación.
- **Fila:**
  - Elegir la fila ya no copia la orden al portapapeles.
  - Orden, DNI y teléfono se copian en el panel.
  - ↑ y ↓ recorren la hoja; Enter o espacio eligen.
- **Cabecera:** un solo indicador, «Actualizado 21:53 · en vivo».
- **Filtro de asesor:** el mismo nombre corto que la lista.

### Ajustes a la propuesta

- **«Entregas fallidas»**, no «Máximo pide acción». Desde SPEC-075 no
  interpretamos a Máximo, así que el nombre dice lo que hay, no una acción
  nuestra.
- **D1 (confirmar lo que dice Máximo)** se aplaza. Traducir un estado de
  Máximo a un paso nuestro es interpretarlo, y José pidió no hacerlo por
  ahora (SPEC-075).
- **D2 (quitar «Por recuperar»)** sigue pendiente de José. La pestaña se
  mantiene.
- **Los botones de paso van solo en el panel, no también en la fila.** Si
  estuvieran en los dos lugares, repetirían el mismo control, que es lo que
  esta spec quita. Con el panel al lado y el paso automático al siguiente,
  mover un pedido cuesta un toque.
