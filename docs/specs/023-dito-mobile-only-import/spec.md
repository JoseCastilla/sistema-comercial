# SPEC-023 — Importación DITO limitada a ventas móviles

## Problema

La descarga de DITO contiene productos móviles y fijos. El importador móvil interpretaba una venta Movistar Hogar como una venta móvil incompleta, por lo que podía aparecer como inválida y bloquear la confirmación del lote.

El lote local `ventas 0308.xlsx` evidenció dos filas de Movistar Hogar registradas por Erika Lavado. Ambas carecen de operación y número de servicio móvil, pero contienen datos en la sección fija del archivo.

## Resultado esperado

- El módulo DITO importa exclusivamente ventas móviles.
- Una fila con datos de producto fijo y sin servicio ni operación móvil se clasifica como `EXCLUDED` con el motivo `NON_MOBILE_PRODUCT`.
- La exclusión no bloquea la confirmación de las ventas móviles válidas.
- Una venta convergente que sí contiene datos móviles conserva su venta móvil importable, aunque también tenga datos fijos.
- Las vistas previas creadas con una versión anterior del parser deben regenerarse antes de confirmarse.

## Fuera de alcance

- Crear un módulo comercial para Movistar Hogar.
- Importar o medir productos fijos en la bandeja y métricas móviles.
- Eliminar pedidos ya confirmados en producción.
