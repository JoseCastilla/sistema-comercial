# SPEC-024 — Bandeja operativa con tarjeta de gestión persistente

## Problema

La tabla anterior ocultaba datos útiles, pero el reemplazo mediante formularios
desplegados dentro de cada fila interrumpía el recorrido y la tipificación. El
asesor necesita comparar ventas y gestionar una seleccionada sin perder su
posición en la lista.

## Principio de experiencia

La información se organiza en dos zonas estables:

1. **Explorar:** tabla compacta con los datos necesarios para identificar y comparar pedidos.
2. **Gestionar:** tarjeta lateral persistente que cambia con la fila seleccionada y contiene contexto, detalle y tipificación.

El diseño usa espacio equilibrado, señales sutiles y reserva el color para estados e incidencias.

## Requisitos

- Mostrar en escritorio: orden, cliente, DNI, teléfono, operador, estado y una
  columna contextual por rol.
- Para `AGENT`, la columna contextual muestra el plazo/SLA y no repite su nombre.
- Para `ADMIN`, `SUPERVISOR` y `BACKOFFICE`, muestra el asesor como primer nombre
  más inicial del primer apellido usando su identidad corporativa vinculada.
- Mostrar SLA como columna independiente para todos los roles; la presencia del
  asesor nunca debe reemplazar la visibilidad del plazo operativo.
- Una operación `NEW_LINE` sin operador cedente se presenta como “Alta nueva”.
- Mantener DNI, teléfono y orden copiables sin añadir botones visibles por cada dato.
- Mantener el formulario de estado y sus permisos actuales.
- Seleccionar una venta desde cualquier fila y actualizar inmediatamente la
  tarjeta lateral sin recargar.
- Mantener la tarjeta visible mientras la tabla se desplaza.
- Priorizar identidad, alertas, observación vigente y actualización de
  seguimiento antes que los datos de consulta.
- Agrupar el detalle operativo y los datos DITO en secciones desplegables para
  reducir el desplazamiento sin ocultar ni eliminar información.
- Mantener el detalle operativo abierto inicialmente para administración,
  supervisión y backoffice, que comparan contexto y responsables.
- Mantenerlo cerrado inicialmente para el asesor y omitir de su tarjeta su
  propio nombre y la asignación interna, sin retirar sus acciones de seguimiento.
- El asesor conserva la actualización de estados no terminales y la solicitud
  de cancelación, pero no puede cerrar ni cancelar directamente una orden.
- Mantener el formulario compacto de estado, subestado y observación para no
  desplazar el contexto de la venta fuera de la pantalla.
- Consolidar la observación vigente y su edición en un solo control.
- En una orden finalizada, ocultar al asesor el formulario inactivo y abrir el
  detalle operativo como información histórica principal.
- Conservar la última observación dentro del detalle cuando el formulario ya no
  sea editable, evitando tanto la pérdida como la duplicación de información.
- Presentar operador y valores de tabla con capitalización y tipografía uniformes.
- Conservar una experiencia equivalente en móvil.
- Mantener filtros, paginación, actualización en vivo y permisos existentes.

## Fuera de alcance

- Cambiar reglas de estado, cierre o cancelación.
- Modificar consultas o el modelo de datos.
- Desplegar a producción antes de la validación local del usuario.
