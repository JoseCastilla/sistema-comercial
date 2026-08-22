# Verificación — SPEC-024

## Automatizada

- TypeScript de la aplicación web: aprobado.
- Lint de la aplicación web y del sistema visual centralizado: aprobado.
- Dominio compartido: 123 pruebas aprobadas, incluidas las reglas de nombre compacto.
- Servidor local: `/orders` responde correctamente después de recompilar.

## Verificación local requerida

1. La tabla muestra orden, cliente, DNI, teléfono, operador, asesor y estado junto a una tarjeta lateral persistente.
   Para un asesor, la columna Asesor cambia a Plazo.
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

## Evidencia local

- Selección validada con órdenes distintas: la tarjeta cambió al código correcto.
- Vista administrativa validada con datos reales del mes.
- Consola del navegador: sin errores ni advertencias.
