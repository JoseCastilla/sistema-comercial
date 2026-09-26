# SPEC-073 — Verificación

- **25/09/2026** — Web: tipos, lint y 278 pruebas, 6 de ellas nuevas en `hoja-pedidos.test.tsx`.

- **25/09/2026, producción (supervisora, solo lectura)**:
  - Título «Pedidos», sin subtítulo, sin los tres avisos anteriores.
  - Resumen «Ventas · Mes actual 403 · Entregados 258 · No entregados 9».
  - Por atender: 16 fuera de plazo, 175 entregas fallidas, 130 por
    recuperar y 6 de meses anteriores.
  - AC-001: con la lista a 374 px y a 701 px no hay desplazamiento lateral
    (ancho de contenido = ancho visible). Filas en dos renglones de 86 px:
    cliente con «orden · operador · asesor» y plazo; estado con la acción.
  - AC-002: a 1920 px, la hoja conserva cabecera y columnas (1103 en 1103).
    La primera versión repetía la acción en Estado: una utilidad le ganaba
    a la regla de ocultar. Corregido en 7194e5e.
  - AC-003: el primer pedido pasó de 1055 px a 638-701 px.
  - AC-005: en el panel, el diagnóstico del operador (posición 137) y
    «Actualizar seguimiento» (295) van antes de la ficha (659) y de «Datos
    de la venta» (870).
  - No se envió ningún formulario.
