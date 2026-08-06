# SPEC-008 — Sincronización en tiempo real de la bandeja

**Estado:** `IMPLEMENTED`
**Versión:** 1.0
**Fecha:** 2026-08-06

## Problema

Cuando Backoffice modifica el estado de una orden, las demás sesiones abiertas
conservan información obsoleta hasta que el usuario recarga la página. Esto
retrasa la validación operativa y permite que dos personas actúen sobre estados
distintos.

## Solución

PostgreSQL emitirá una notificación transaccional después de cada alta,
actualización o eliminación de una orden DITO. La aplicación Web escuchará ese
canal una sola vez por instancia y expondrá eventos SSE autenticados y filtrados
por organización. La bandeja refrescará sus Server Components al recibir el
evento, conservando el estado interactivo del navegador.

## Reglas

- **BR-001:** solo una sesión autenticada y activa puede abrir el canal SSE.
- **BR-002:** cada conexión recibe exclusivamente eventos de su organización.
- **BR-003:** el evento no contiene nombres, documentos, teléfonos ni otros datos
  personales; solo organización, orden, operación y momento del cambio.
- **BR-004:** PostgreSQL emite el evento después del commit; una transacción
  revertida no se publica.
- **BR-005:** Web reutiliza una conexión `LISTEN` por proceso y distribuye los
  eventos entre sus clientes, evitando una conexión de base de datos por usuario.
- **BR-006:** el cliente agrupa eventos cercanos y ejecuta como máximo un refresh
  por ráfaga.
- **BR-007:** si la pestaña está oculta, el refresh se posterga hasta volver a
  estar visible.
- **BR-008:** EventSource reconecta automáticamente; además existe un refresh
  periódico de respaldo mientras la bandeja permanece abierta.
- **BR-009:** el refresh no envía formularios ni descarta texto que el usuario
  esté escribiendo.
- **BR-010:** la concurrencia optimista existente continúa siendo la última
  defensa antes de guardar.
- **BR-011:** las inserciones de la extensión y las futuras importaciones XLSX
  utilizan el mismo canal porque la notificación nace en la base de datos.

## Criterios de aceptación

- **AC-001:** dos sesiones de la misma organización muestran el nuevo estado sin
  recarga manual.
- **AC-002:** el cambio es visible normalmente en menos de dos segundos después
  del commit.
- **AC-003:** una sesión de otra organización no recibe ni aplica el evento.
- **AC-004:** cerrar la pestaña elimina el suscriptor y los temporizadores.
- **AC-005:** una desconexión temporal muestra estado de reconexión y recupera la
  sincronización sin intervención.
- **AC-006:** sin eventos SSE, el respaldo actualiza la bandeja en un máximo de
  treinta segundos.
- **AC-007:** lint, tipos, pruebas y build Docker finalizan correctamente.
