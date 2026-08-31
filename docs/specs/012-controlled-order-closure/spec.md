# SPEC-012 — Cierre controlado de órdenes

**Estado:** `VERIFIED`
**Versión:** 1.0
**Fecha:** 2026-08-09

## Problema

La visibilidad completa permite actualmente que un asesor cierre su propia
orden. El mismo formulario también permite abandonar estados terminales. Esto
afecta la confiabilidad de las métricas y permite modificar el resultado de una
venta sin intervención independiente.

## Objetivo

Conservar la gestión operativa del asesor, reservar el cierre manual a personal
autorizado y registrar de forma inequívoca quién cerró cada orden y cuándo.

## Reglas de negocio

- **BR-001:** `ADMIN` y `BACKOFFICE` pueden cerrar órdenes con visibilidad
  `FULL`.
- **BR-002:** `SUPERVISOR` puede cerrar únicamente órdenes de sus equipos
  supervisados, que resuelven a visibilidad `FULL`.
- **BR-003:** `AGENT` nunca puede cerrar una orden, aunque sea el responsable y
  manipule directamente la solicitud.
- **BR-004:** `CLOSED` y `CANCELLED` son estados terminales en el formulario
  operativo; no pueden volver a `OPEN` ni `SENT`.
- **BR-005:** entrar en `CLOSED` registra `closedByUserId` y `closedAt` en la
  misma transacción que el historial de estado.
- **BR-006:** editar una orden ya cerrada no reemplaza autor ni fecha de cierre.
- **BR-007:** `CANCELLED` exige un motivo descriptivo de al menos 10 caracteres.
- **BR-008:** la interfaz no agrega un botón: filtra la opción `CLOSED` y muestra
  la auditoría dentro de la tarjeta.
- **BR-009:** los cierres históricos se recuperan desde el último evento de
  historial confiable; si no existe, permanecen sin atribución.

## Fuera de alcance

- Evidencia externa de entrega o activación.
- Solicitud y aprobación de cancelaciones por dos usuarios.
- Reapertura administrativa de órdenes terminales.

## Criterios de aceptación

- **AC-001:** un asesor no ve `CLOSED` y una solicitud manipulada es rechazada.
- **AC-002:** supervisor, backoffice y administrador solo cierran con acceso
  completo.
- **AC-003:** un cierre persiste responsable, fecha e historial atómicamente.
- **AC-004:** una orden cerrada o cancelada queda en modo de solo lectura.
- **AC-005:** cancelar sin motivo suficiente produce un error en observación.
- **AC-006:** la tarjeta muestra quién cerró y cuándo sin añadir acciones.
- **AC-007:** migración, pruebas, tipos, lint y builds locales son satisfactorios.
