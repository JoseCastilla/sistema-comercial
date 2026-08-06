# SPEC-006 — Verificación

**Estado:** `IMPLEMENTED_PENDING_PRODUCTION`

## Evidencia inicial

- DITO usa `.detalle_sub` con imagen `flecha_down.svg` cuando el detalle está colapsado.
- La extensión devolvía `N/A` desde `getDetailByTitle` y no evaluaba completitud.
- n8n consideraba `operationRaw` válido por ser texto no vacío.
- el API solo marcaba `NEEDS_REVIEW` ante un fingerprint distinto.
- las órdenes `1943577383A` y `1943619551A` muestran operación y ubicación inválidas.

## Evidencia de implementación

- Extensión `2.2.0`: bloquea envío, limpia la captura y enumera campos faltantes.
- API: acepta el contrato legado, detecta placeholders y clasifica la orden como `PARTIAL`/`NEEDS_REVIEW`.
- Migración local aplicada: reclasifica registros históricos inválidos y crea auditoría manual.
- `/orders`: formulario ADMIN comprobado visualmente sin guardar datos de prueba.
- Validación: 69 pruebas de validación y 9 pruebas del webhook aprobadas.
- Tipos y lint aprobados para API y web.
- Imágenes Docker de API y web construidas correctamente con el entorno de EasyPanel.

## Pendiente de producción

- Instalar la extensión `2.2.0` y validar una captura sobre DITO real.
- Desplegar API/web y aplicar la migración automática de EasyPanel.
- Corregir las órdenes de Francis y Ever con los datos reales consultados por código.
- Añadir pruebas específicas de autorización de la acción ADMIN.
