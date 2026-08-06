# Extensión de Ventas DITO

Extensión Manifest V3 que extrae órdenes desde
`https://ventas.movistar.com.pe/` y las envía al webhook productivo de n8n.

## Instalación local

1. Abrir `chrome://extensions`.
2. Activar el modo desarrollador.
3. Seleccionar **Cargar extensión sin empaquetar**.
4. Elegir esta carpeta.

## Identidad

La primera configuración solicita nombre y correo `@distribuidoronline.com` y
genera un `installation_id` UUID. Los tres valores se guardan en
`chrome.storage.local` y acompañan cada venta.

Las instalaciones anteriores que solo tenían `asesor` conservan ese nombre y
solicitan el correo al actualizarse a 2.0.0.

El bloqueo de campos evita cambios accidentales desde la interfaz, pero no es
autenticación criptográfica. El backend detecta instalaciones observadas con
correos diferentes y evita la asignación automática.

## Publicación

Actualizar `version` en `manifest.json` y registrar el cambio en `CHANGELOG.md`.
El backend compatible debe desplegarse antes de distribuir una nueva versión.
