# SPEC-013 — Solicitud y aprobación de cancelaciones

**Estado:** `VERIFIED`
**Versión:** 1.0
**Fecha:** 2026-08-09

## Problema

Aunque SPEC-012 impide que un asesor cierre su venta, `CANCELLED` también es un
resultado terminal. Permitir que el responsable lo aplique directamente deja
una vía para retirar ventas del flujo activo y alterar resultados.

## Objetivo

Permitir que el asesor reporte una cancelación sin ejecutarla. La venta conserva
su estado hasta que un usuario independiente con autoridad la apruebe.

## Reglas de negocio

- **BR-001:** un `AGENT` con acceso completo puede solicitar la cancelación de
  su propia orden no terminal, pero no aplicarla.
- **BR-002:** solo puede existir una solicitud `PENDING` por orden.
- **BR-003:** la solicitud exige un motivo descriptivo de al menos 10 caracteres.
- **BR-004:** la orden conserva su estado mientras la solicitud esté pendiente.
- **BR-005:** `ADMIN` y `BACKOFFICE` pueden revisar solicitudes de su
  organización; `SUPERVISOR` solo las de sus equipos supervisados.
- **BR-006:** aprobar cambia la orden a `CANCELLED`, crea historial y registra al
  revisor en una sola transacción.
- **BR-007:** rechazar conserva el estado de la orden y exige una explicación de
  al menos 10 caracteres.
- **BR-008:** una orden terminal no puede recibir ni aprobar solicitudes.
- **BR-009:** crear o resolver una solicitud actualiza la señal de tiempo real de
  la orden.
- **BR-010:** la experiencia reutiliza el selector de estado y muestra una sola
  acción de revisión contextual; no agrega acciones permanentes a la bandeja.

## Criterios de aceptación

- **AC-001:** para un asesor, la opción se llama “Solicitar cancelación”.
- **AC-002:** guardar la solicitud no modifica el estado de la orden.
- **AC-003:** una segunda solicitud pendiente es rechazada.
- **AC-004:** el supervisor ajeno al equipo no puede revisarla.
- **AC-005:** aprobar aplica `CANCELLED` y deja trazabilidad completa.
- **AC-006:** rechazar conserva la orden activa y registra la decisión.
- **AC-007:** solicitante y revisores reciben el cambio mediante la sincronización
  existente.
- **AC-008:** pruebas, tipos, lint y contenedores terminan correctamente.
