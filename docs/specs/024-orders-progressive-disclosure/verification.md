# Verificación — SPEC-024

## Automatizada

- TypeScript de la aplicación web: aprobado.
- Lint de la aplicación web y del sistema visual centralizado: aprobado.
- Dominio compartido: 123 pruebas aprobadas, incluidas las reglas de nombre compacto.
- Servidor local: `/orders` responde correctamente después de recompilar.

## Verificación local requerida

1. La tabla muestra orden, cliente, DNI, teléfono, operador, SLA y estado junto
   a una tarjeta lateral persistente. Administración y supervisión ven además
   la columna Asesor; el asesor no ve su propio nombre repetido.
2. Administración y supervisión ven nombres compactos como `Christian R.`.
3. Una operación de alta sin cedente muestra `Alta nueva` en Operador.
4. Orden, DNI y teléfono se copian correctamente.
5. Seleccionar una fila actualiza inmediatamente la tarjeta de la derecha.
6. La fila seleccionada permanece identificable mediante una señal visual sutil.
7. El formulario de la tarjeta respeta los permisos y transiciones existentes.
8. Operadores como `CLARO`, `BITEL` y `ENTEL` se presentan como `Claro`, `Bitel` y `Entel`.
9. Las altas sin cedente se presentan como `Alta nueva`.
10. La tabla conserva filtros, búsqueda, paginación y sincronización en vivo.
11. La experiencia móvil permite desplegar el detalle completo y actualizar.
12. “Actualizar seguimiento” aparece antes de los bloques informativos y no
    requiere recorrer todo el detalle de la venta.
13. “Venta y entrega DITO” permanece cerrada por defecto; ambas secciones se
    operan con teclado o puntero y conservan toda la información.
14. Para administración, supervisión y backoffice, “Detalle de la operación”
    aparece abierto inicialmente y puede cerrarse manualmente.
15. Para el asesor, el detalle aparece cerrado inicialmente y no repite su
    nombre ni la asignación, pero conserva Abierto, Enviado y solicitud de
    cancelación; nunca ofrece cierre o cancelación directa.
16. El formulario conserva una composición compacta de dos selectores y una
    observación, sin tarjetas de acción que aumenten su altura.
17. La observación vigente no se repite: se consulta y actualiza desde el mismo
    campo de seguimiento.
18. Una orden finalizada no muestra al asesor “Actualizar seguimiento” ni un
    mensaje de permiso; abre directamente su detalle operativo.
19. Si existe una observación en una orden no editable, aparece una sola vez
    dentro del detalle operativo.

## Evidencia local

- Selección validada con órdenes distintas: la tarjeta cambió al código correcto.
- Vista administrativa validada con datos reales del mes.
- Consola del navegador: sin errores ni advertencias.
- La tabla utiliza una sola superficie de desplazamiento y mantiene fijo el
  encabezado.
- Las 49 pruebas de reglas comerciales confirman que el asesor puede operar su
  pedido, no puede cerrarlo ni cancelarlo directamente y sí puede solicitar la
  cancelación.
- En sesión administrativa, el detalle operativo aparece abierto inicialmente
  y el formulario de seguimiento conserva todos los controles autorizados.
