# SPEC-009 — Plan

1. Ampliar el dominio compartido con `YESTERDAY`, `RANGE` y validación estricta
   de fechas ISO interpretadas en Lima.
2. Añadir pruebas para límites diarios, cruces de calendario y rangos inválidos.
3. Incorporar `from` y `to` a la consulta de la bandeja y construir una etiqueta
   legible para el período activo.
4. Añadir Ayer y el formulario Desde/Hasta a la navegación, conservando el
   contexto en filtros, búsqueda y paginación.
5. Extender los patrones visuales compartidos sin crear estilos propios de la
   página.
6. Validar dominio, tipos, lint y comportamiento en el navegador local antes de
   considerar cualquier despliegue.
