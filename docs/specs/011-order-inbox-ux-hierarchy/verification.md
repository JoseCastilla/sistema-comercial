# SPEC-011 — Verificación

**Estado:** `VERIFIED`
**Fecha:** 2026-08-08

## Evidencia automatizada

- `pnpm check-types`: 7 tareas aprobadas.
- `pnpm lint`: 7 tareas aprobadas sin advertencias.

## Evidencia funcional

- A 1440 px, períodos frecuentes, métricas, estados, equipo y búsqueda conservan
  una jerarquía clara; el bloque avanzado funciona como panel superpuesto.
- A 390 px, el rango permanece cerrado inicialmente, los cuatro períodos caben
  completos y las métricas ocupan menos altura.
- Estado y Equipo navegan al seleccionar sin botones Aplicar.
- La búsqueda móvil conserva el campo ancho y usa un icono con etiqueta
  accesible `Buscar pedidos`.
- Seleccionar Equipo y luego Estado conservó ambos valores en la URL.
- Una URL RANGE abrió automáticamente el panel y mostró Desde/Hasta.

## Despliegue

Autorizado por el usuario el 2026-08-08 mediante push a `main` y despliegue
automático en EasyPanel.
