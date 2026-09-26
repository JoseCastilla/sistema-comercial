# SPEC-084 — Revisión de la lógica de Pedidos

**Estado:** `VERIFICADA` — José: «analiza la lógica de trabajo, corrige en caso sea necesario» (26/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Método

Se contrastó cada cifra de Pedidos con la lista que abre, sobre los 1417
pedidos de septiembre en producción (sesión de administrador, solo
lectura). Se clasificó cada pedido en las vistas para ver si caía en una,
en ninguna o en varias. En paralelo, un agente revisó el código.

## 2. Hallazgos y correcciones

| # | Qué pasaba | Evidencia | Corrección |
|---|---|---|---|
| H1 | 24 pedidos no aparecían en ninguna vista | 23 cerrados con problema en Máximo (Cerrados los excluía por Máximo; Entregas fallidas, por estar cerrados) y 1 enviado con entrega rechazada, cuyo estado de entrega era «cancelado» | «Cerrados» incluye a todo cerrado; solo el cancelado con problema en Máximo va a Entregas fallidas. «Por entregar» ya no excluye la entrega cancelada mientras el pedido siga enviado |
| H2 | En «Escaladas», el resumen decía «Ventas 2785» | Esa vista no usa período, y el resumen contaba toda la historia | El resumen siempre cuenta el período elegido |
| H3 | «51 pendientes de meses anteriores» abría 65 | Contaba abiertos y enviados (incluso entregados) y abría el histórico entero, que también tiene este mes | Dos cifras, «N por entregar →» y «M por activar →», cada una con la regla de su vista, en un rango que termina el día antes de este mes |
| H4 | «Cerrar: ya activó» cerraba con un solo toque | Cerrar no se deshace, y en bloque sí se pedía confirmar | Pide un segundo toque («Sí, cerrar: no se puede deshacer» o «Volver»), igual que en bloque |

### Revisión del código (segunda tanda)

| # | Qué pasaba | Corrección |
|---|---|---|
| H5 | «Guarda y pasa al siguiente» no avanzaba. `revalidatePath` trae los datos nuevos en la misma respuesta, y el paso se vuelve a montar (o sale de la vista) antes de avisar | El siguiente se fija al tocar el paso y se aplica cuando llegan los datos. Si el guardado falla, se anula |
| H6 | El plazo («Fuera de plazo») viajaba a todas las vistas. En Falta activar, Cerrados o Escaladas dejaba la lista vacía sin decir por qué | Solo viaja a «Por entregar» y «Todos», y el selector de plazo solo aparece ahí |
| H7 | Al cambiar de vista, la selección y las casillas seguían, y el panel decía «Esta venta salió de la bandeja» con un motivo falso | Al cambiar de vista, período, filtro o página, todo empieza de nuevo |
| H8 | El asesor, que no tiene pestañas, quedaba atrapado en una vista al usar «antes de este mes» | Para el asesor ese enlace abre su lista completa |
| H9 | El cierre en bloque cerraba pedidos con una cancelación por revisar | No se pueden marcar, y el servidor rechaza cerrar cualquier pedido con cancelación pendiente, uno por uno o en bloque |
| H10 | «Fuera de plazo» por asesor contaba con una regla distinta a la de la lista que abre | Usa `getDueFilterWhere("vencido")`, la misma regla |
| H11 | «Antes de…» fijaba el 01/01/2026 en el enlace, pero la cifra no tenía límite. Además arrastraba la búsqueda y el plazo | Misma ventana de un año en la cifra y en el enlace, sin búsqueda ni plazo |
| H12 | La supervisión que entra al día (SPEC-082) no veía lo pendiente del resto del mes | «Antes de hoy / de esta semana / de este mes» se calcula desde el inicio del período elegido |
| H13 | Un asesor en dos equipos aparecía dos veces en la tabla y en el filtro | Aparece una sola vez |
| H14 | Si fallaba guardar el origen, el selector quedaba marcado y no dejaba reintentar | Vuelve al origen guardado |
| H15 | El formulario del celular y el de rango perdían el regreso a Rendimiento | Se conserva |
| H16 | Una nota escrita sin tocar un paso se perdía. En Falta activar, la única forma de guardarla era cerrar | Aparece «Guardar nota» cuando la nota cambia, sin mover el pedido |
| H17 | Tras H1, la entrega rechazada aparecía en «Por entregar» con el plazo «Finalizado» | Dice «Entrega rechazada» |

### Revisados y sin cambio

- **Cerrados antiguos en dos vistas:** en producción hay 0 de 41 pedidos en
  «Falta activar» que estén cerrados. La regla es la misma que usa
  Rendimiento (SPEC-044) y se conserva.
- **La hoja del asesor y las pestañas clasifican distinto.**
  - Un «No entregado» sin problema en Máximo es «Entrega fallida» para el
    asesor y «Por entregar» para la supervisión.
  - Un cancelado con problema en Máximo va en «Canceladas» para el asesor y
    en «Entregas fallidas» para la supervisión.
  - Esto depende de la decisión pendiente de José sobre si «Entregas
    fallidas» debe excluir a los cancelados.

## 3. Criterios de aceptación

- **AC-001**: la suma de «Por entregar», «Falta activar», «Cerrados» y las
  entregas fallidas del mes es igual a «Todos».
- **AC-002**: cada cifra de meses anteriores abre una lista con esa misma
  cantidad.
- **AC-003**: en «Escaladas», «Ventas» es la cifra del período.
- **AC-004**: al tocar un paso, el panel pasa al pedido de abajo.
