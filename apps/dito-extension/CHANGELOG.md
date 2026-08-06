# Changelog

## 2.2.0

- Exige que el asesor despliegue manualmente el detalle del pedido antes de extraer.
- Bloquea el envío cuando faltan campos esenciales o solo existen valores `N/A`.
- Informa al asesor qué campos debe revisar en DITO.

## 2.1.2 — 2026-08-05

- Captura `HORARIO DE ENTREGA` para pedidos regulares.
- Envía el rango original sin inventar una fecha o timestamps.

## 2.1.1 — 2026-08-05

- Corrige altas nuevas sin operador cedente ni tipo de línea visible.
- Genera `ALTA NUEVA POST <plan>` sin segmentos `N/A`.
- Conserva los valores originales de transacción, línea y cedente para auditoría.

## 2.1.0 — 2026-08-05

- Extrae ciclo de facturación y último día de pago.
- Separa teléfono de la operación y teléfono de contacto para entrega.
- Añade dirección, referencia y coordenadas de entrega.
- Envía el código de venta como dato estructurado.
- Mantiene estos detalles fuera de las columnas de Excel.

## 2.0.0 — 2026-08-05

- Añade correo corporativo e identificador estable de instalación.
- Migra instalaciones que ya tenían nombre de asesor.
- Restringe el acceso a DITO y al webhook de automatización.
- Elimina el content script global sin uso.
- Valida la respuesta HTTP del webhook.
- Bloquea envíos simultáneos y dobles clics accidentales.

## 1.1

- Versión inicial recibida para extracción y envío de ventas.
