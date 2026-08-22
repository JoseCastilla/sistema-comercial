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
- Una operación `NEW_LINE` sin operador cedente se presenta como “Alta nueva”.
- Mantener DNI, teléfono y orden copiables sin añadir botones visibles por cada dato.
- Mantener el formulario de estado y sus permisos actuales.
- Seleccionar una venta desde cualquier fila y actualizar inmediatamente la
  tarjeta lateral sin recargar.
- Mantener la tarjeta visible mientras la tabla se desplaza.
- Presentar operador y valores de tabla con capitalización y tipografía uniformes.
- Conservar una experiencia equivalente en móvil.
- Mantener filtros, paginación, actualización en vivo y permisos existentes.

## Fuera de alcance

- Cambiar reglas de estado, cierre o cancelación.
- Modificar consultas o el modelo de datos.
- Desplegar a producción antes de la validación local del usuario.
