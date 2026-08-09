# SPEC-013 — Verificación

**Estado:** `LOCAL_VERIFIED`
**Fecha:** 2026-08-09

## Evidencia obtenida

- Migración `20260809170000_add_dito_order_cancellation_requests` aplicada y
  verificada únicamente en PostgreSQL local.
- Índice parcial único para una sola solicitud `PENDING` por orden.
- 100 pruebas de validación aprobadas, incluida la separación entre solicitud y
  cancelación directa, estados terminales y contrato de revisión.
- La acción de estado crea una solicitud y toca `updatedAt` sin modificar el
  estado cuando el actor es `AGENT`.
- Aprobación, cancelación, historial y revisor comparten transacción; el rechazo
  conserva el estado y también genera señal en tiempo real.
- Revisión independiente: el solicitante no puede revisar su propia solicitud.
- TypeScript y ESLint aprobados en Validación, Base de Datos, API y Web.
- Build Nest y builds Docker de API/Web aprobados en Linux.
- Prueba visual temporal local: solicitud priorizada, distintivo visible, panel
  compacto de revisión y motivo obligatorio al rechazar. El registro temporal
  fue eliminado al terminar.
- Auditoría final local: 0 solicitudes pendientes temporales y 0 inconsistencias.

## Pendiente de salida

- Crear commit, hacer push y comprobar migración, salud y experiencia en
  producción.
