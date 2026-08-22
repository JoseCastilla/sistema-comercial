# SPEC-020 — Normalización y resolución de conflictos DITO

## Objetivo

Permitir que un administrador importe archivos DITO sin falsos conflictos por pérdida de ceros iniciales y resuelva diferencias reales antes de confirmar el lote.

## Reglas

- Un DNI se representa siempre con 8 dígitos. Si Excel entrega entre 1 y 7 dígitos, se completa con ceros a la izquierda.
- Un DNI con más de 8 dígitos es inválido y no se importa.
- Los valores válidos distintos nunca se sobrescriben automáticamente.
- Diferencias de coordenadas de hasta `0.000001` grados se consideran variaciones de precisión, no conflictos.
- Para cada conflicto resoluble, el administrador elige conservar el sistema o usar el archivo DITO.
- Al cambiar el tipo de operación también se actualiza su resumen normalizado para evitar datos contradictorios.
- La opción segura por defecto es conservar el sistema.
- La decisión, el usuario y la fecha quedan registrados en los datos del lote.
- Conflictos de identidad, asignación o código de venta conservan sus flujos especializados.

## Criterios de aceptación

- `9386875` con tipo DNI se interpreta como `09386875`.
- La orden `1941795020A` deja de presentar un conflicto de DNI.
- La pantalla de importación muestra ambos valores de cada conflicto resoluble.
- No se puede confirmar el lote mientras queden conflictos.
- Al resolver el último conflicto, el lote queda listo si no existen otros bloqueos.
