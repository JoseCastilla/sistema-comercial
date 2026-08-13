# Plan

1. Agregar `sales_enabled`, retroalimentar asesores existentes y reemplazar el
   índice de asesor primario por vendedor primario.
2. Basar la elegibilidad comercial de extensión e importación en la capacidad,
   aceptando roles AGENT y SUPERVISOR.
3. Ampliar alcance y visibilidad de SUPERVISOR con venta activa para incluir sus
   órdenes propias.
4. Pasar la propiedad de la orden a las reglas terminales para impedir
   autocierre y autocancelación.
5. Incorporar una asignación administrativa atómica y señalización visual.
6. Separar la vista personal y de equipo en Rendimiento.
7. Verificar migración, dominio, API, web, lint y recorrido operativo.

## Despliegue

La migración debe ejecutarse antes de iniciar API y web nuevos. El `UPDATE`
conserva la operación actual al marcar como vendedores todos los AGENT
existentes. No requiere corrección manual en DBGate.
