# SPEC-003 — Verificación

**Estado:** `IN_PROGRESS`

## Evidencia automatizada

- HTML real inspeccionado para los siete grupos de datos.
- Extensión `2.1.2` con payload estructurado exclusivo para API.
- Workflow n8n ejecutado con el escenario Noel Marcos Arzapalo Poma.
- Resultado: `PORT_POSTPAID`, servicio `941586779`, contacto `941586778`, ciclo
  9, pago 22, código `FE-1128647263` y coordenadas esperadas.
- Segundo escenario ejecutado: alta nueva Express normalizada como `NEW_LINE`,
  carrier `UNKNOWN`, cargo 39.9, ciclo 5, pago 18 y código `FE-1128648238`.
- Extensión 2.1.1 genera `ALTA NUEVA POST 39.9` sin segmentos `N/A` y conserva
  los valores originales de transacción, tipo de línea y cedente en metadatos.
- Tercer escenario: portabilidad Entel postpago Regular 24 horas conserva el
  rango DITO `3pm-7pm` como `delivery.time_range`, sin inventar fecha.
- Migración `20260805203000_add_dito_delivery_details` aplicada localmente.
- PostgreSQL actualizado con 9 migraciones.
- 64 pruebas de validación y 47 pruebas de API aprobadas.
- 6 pruebas directas del repositorio DITO aprobadas para asociación por correo,
  equipo primario, conflicto de instalación y persistencia de datos logísticos.
- Prisma, contratos, tipos y sintaxis de extensión aprobados.
- `/orders` proyecta y muestra código de venta, ciclo, pago, contacto, horario,
  dirección, referencia y coordenadas en una sección condicional “Datos DITO”.
- La búsqueda de la bandeja incluye código de venta, contacto, dirección y referencia.
- Lint, generación de tipos Next.js y TypeScript de la bandeja: aprobados.

## Pendiente operativo

- cargar la extensión sobre DITO y comparar el payload real;
- importar el workflow actualizado en n8n (pospuesto por decisión operativa);
- confirmar simultáneamente la fila de Sheets y la orden persistida.
