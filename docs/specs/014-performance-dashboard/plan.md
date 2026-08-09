# SPEC-014 — Plan de implementación

## 1. Entrega A: semántica y calidad de datos

Crear contratos compartidos para cohortes, estados del funnel y alcance por rol.
Reutilizar `CommercialOperation`, que ya diferencia `PORT_PREPAID`,
`PORT_POSTPAID` y `NEW_LINE`; no agregar un segundo campo de producto.

Agregar un concepto explícito y auditable de exclusión de pago con motivo,
actor, fecha y estado. No inferir una incidencia definitiva solo porque una
orden entregada todavía no fue cerrada.

## 2. Entrega B: dashboard operativo

Implementar un módulo `performance` en Web con consulta server-side propia. La
bandeja conserva su responsabilidad operativa y solo recibe enlaces con filtros.
La consulta comparte el resolvedor de alcance de órdenes para evitar que las
reglas de visibilidad diverjan.

El primer cálculo será directo sobre PostgreSQL con agregaciones agrupadas por
cohorte, asesor y equipo. Los índices actuales cubren organización, fecha,
asesor, equipo y estado; se medirán consultas reales antes de introducir tablas
resumen o caché.

## 3. Entrega C: interfaz por rol

Crear `/performance` y navegación desde el shell existente. La página tendrá:

1. período y alcance;
2. resumen de resultados;
3. alertas accionables;
4. funnel;
5. desglose progresivo por equipo/asesor según rol.

Los enlaces hacia `/orders` deben preservar período, rango y equipo. Cuando una
métrica no corresponda exactamente a un filtro existente, se ampliará el
contrato de filtros antes de enlazarla.

## 4. Entrega D: comisión base estimada

Crear reglas de comisión versionadas por vigencia y una liquidación mensual con
líneas por orden. El cálculo será idempotente: recalcular un borrador reemplaza
su resultado dentro de una transacción; una liquidación bloqueada es inmutable.

La reasignación de una orden antes del bloqueo actualiza el beneficiario. Al
bloquear, la línea conserva una instantánea del asesor, equipo, producto, tarifa
y evidencia que justificó el pago.

## 5. Entrega E: aceleradores

Implementar únicamente después de resolver las cinco decisiones económicas de
la especificación. Separar progreso de cohorte, monto provisional y monto
confirmado para evitar prometer pagos sobre ventas todavía no activadas.

## 6. Seguridad y antifraude

- Calcular todo en servidor y filtrar primero por organización.
- Reutilizar el cierre independiente y la aprobación de cancelaciones.
- No permitir que AGENT modifique reglas, exclusiones o liquidaciones.
- Registrar actor y antes/después en exclusiones y aprobaciones financieras.
- Evitar rankings con muestras pequeñas sin mostrar el denominador.
- Excluir datos personales de vistas agregadas salvo al abrir una orden
  autorizada.

## 7. Tiempo real y rendimiento

La señal existente de cambios de órdenes invalidará los datos del dashboard con
una actualización controlada. Se evitará refrescar consultas pesadas por cada
evento; se agruparán eventos cercanos y se mostrará la hora de actualización.

Antes de crear materializaciones se validará `EXPLAIN ANALYZE` con volumen de
producción representativo. Si la consulta mensual supera el presupuesto fijado,
se agregará una tabla de resumen diario idempotente y reconstruible.

## 8. Pruebas

- Dominio: cohortes, zonas horarias, tasas, comparación y elegibilidad.
- Acceso: matriz completa de roles, equipos y huérfanas.
- Persistencia: exclusiones y liquidaciones idempotentes/auditables.
- Integración: métricas reconciliadas con sus órdenes origen.
- UI: estados vacío, provisional, sin comparación y error.
- Regresión: validación, tipos, lint, API/Web y contenedores.

## 9. Despliegue

Entregar por incrementos independientes. Métricas operativas pueden llegar a
producción antes que comisiones. Ningún importe se publicará como confirmado sin
conciliación y aprobación administrativa.
