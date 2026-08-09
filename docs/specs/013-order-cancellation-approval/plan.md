# SPEC-013 — Plan

## 1. Persistencia

Crear un historial independiente de solicitudes con solicitante, motivo, estado,
revisor, comentario y fechas. Un índice parcial garantiza una sola solicitud
pendiente por orden.

## 2. Dominio

Separar cancelación directa, solicitud de asesor y revisión autorizada. Mantener
las reglas en `@repo/validation` para que servidor e interfaz compartan contrato.

## 3. Escritura transaccional

La actualización de estado desviará `CANCELLED` de un asesor hacia la creación
de una solicitud. La revisión reclamará la solicitud de forma optimista y, al
aprobar, actualizará orden e historial en la misma transacción.

## 4. Interfaz

Reutilizar el selector actual. Mostrar la solicitud como bloque informativo y,
solo a revisores autorizados, un selector Aprobar/Rechazar con una acción de
confirmación.

## 5. Verificación y salida

Aplicar la migración local, ejecutar la matriz completa, validar Web/API en
Docker y desplegar ambos servicios mediante push únicamente después de todas las
comprobaciones.
