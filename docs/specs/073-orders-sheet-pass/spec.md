# SPEC-073 — Hoja de pedidos, control por control

**Estado:** `ENTREGADA` — mejoras de presentación, con la autorización de José del 25/09/2026

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

José: «¿Cuándo pasaremos a optimizar la hoja de pedidos?». Se le propuso y
aprobó («sí, avanza con tu recomendación»):

- en monitor ancho, mantener la hoja de una línea por pedido;
- en pantalla angosta, pasar a dos líneas en vez de cortar;
- juntar arriba cifras y avisos en una sola línea de «por atender»;
- en el panel, poner primero lo que hay que hacer con la venta.

Solo presentación: ninguna regla de estados, plazos, permisos ni filtros
cambia.

Lo que se midió con la sesión de la supervisora (panel de 1070 px):

- la hoja necesita 822 px y la lista tiene 374, así que se desliza de lado
  y solo se ven Orden, Cliente, DNI y parte del teléfono;
- las filas crecen a 70 px porque el estado se parte en la columna angosta;
- el primer pedido aparece a 1055 px de la parte de arriba, debajo de:
  - un subtítulo;
  - cuatro tarjetas;
  - un aviso de 175 entregas fallidas;
  - un bloque verde de 130 pedidos por recuperar con un párrafo de tres
    líneas;
  - un aviso de 6 pendientes de meses anteriores;
- en el panel, el diagnóstico del operador («Contactar al cliente y
  reagendar…») queda debajo de la ficha comercial.

## 2. Reglas de presentación

- **BR-001 — Una línea de cifras y otra de «por atender»**: arriba van
  «Ventas · Mes actual 403 · Entregados 258 · No entregados 9». Debajo,
  «Por atender», con enlaces de color que solo aparecen cuando hay algo:
  - escaladas esperando al supervisor;
  - fuera de plazo;
  - sin avance hace más de 10 min;
  - entregas fallidas por gestionar;
  - pedidos por recuperar este mes;
  - pendientes de meses anteriores.

  Cada enlace abre su filtro, y el que está abierto se marca.
- **BR-002 — En Entregas fallidas**, la línea de cifras es por acción:
  - por revisar;
  - visita por coordinar;
  - contactar y validar;
  - por volver a ingresar.

  Cada cifra filtra, y se marca la elegida.
- **BR-003 — En Por recuperar**, el párrafo de tres líneas pasa a una
  frase: «N pedidos no entregados o cancelados que aún pueden volverse
  venta. Los casos con responsable y seguimiento están en Recupero de
  ventas».
- **BR-004 — Panel: primero qué venta es y qué hacer**, en este orden:
  1. nombre, DNI y número;
  2. el diagnóstico del operador;
  3. asignación, cancelación y escalación;
  4. «Actualizar seguimiento»;
  5. la ficha comercial (operación, entrega, horario, ubicación);
  6. «Datos de la venta».
- **BR-005 — La hoja se adapta al ancho de la lista, no al de la
  pantalla**:
  - Si caben las columnas (45,2 rem, o 49,8 rem con Asesor), se mantiene
    una línea por pedido.
  - Si no caben, cada pedido va en dos renglones: primero el cliente, con
    «orden · operador · asesor» debajo, y su plazo; después el estado con
    la acción.
  - No hay desplazamiento lateral.
  - DNI, teléfono y orden se copian desde el panel.
- **BR-006 — Nombre y subtítulo**: el título es «Pedidos», como en el menú,
  sin subtítulo. «N pedidos en esta página de M encontrados». Los filtros
  no llevan pista fija («Escribe para buscar…»): solo hablan cuando hay
  algo que decir.

## 3. Criterios de aceptación

- **AC-001**: en el panel de 1070 px, la lista no se desliza de lado y
  muestra cliente, plazo, estado y acción de cada pedido.
- **AC-002**: en un monitor ancho, la hoja conserva sus columnas.
- **AC-003**: el primer pedido sube al menos 300 px desde los 1055 px
  actuales. (Se había escrito «a menos de la mitad»; con el período y los
  filtros arriba no se alcanza sin tocar su forma, que queda fuera de esta
  pasada.)
- **AC-004**: los enlaces de «por atender» abren el mismo filtro que los
  avisos anteriores.
- **AC-005**: en el panel, la acción del operador y el formulario aparecen
  antes de la ficha comercial.
