# SPEC-018 — Verificación

**Estado:** `READY_FOR_USER_VALIDATION`
**Fecha:** 2026-08-11

## Automatización

- Tipos: 7 de 7 tareas correctas en los 9 paquetes.
- Lint: 7 de 7 tareas correctas, sin advertencias.
- Dominio compartido: 113 de 113 pruebas correctas.
- Web: compilación, TypeScript y generación de 12 páginas correctas. El empaquetado
  `standalone` se detiene únicamente al crear un enlace simbólico de Next.js por la
  restricción `EPERM` conocida de Windows; no es un error de código ni de estilos.

## Revisión visual local

- El tema se aplica antes de hidratar y no introduce un destello claro.
- Sistema, Claro y Oscuro cambian de forma inmediata; la preferencia persiste tras
  recargar y Sistema responde a la configuración del dispositivo.
- Pedidos, detalle, estados, Rendimiento, carga DITO, Personas y Equipos conservan
  jerarquía y contraste en oscuro.
- En escritorio se validó a 1440 × 900 sin desborde horizontal.
- En móvil se validó a 390 × 844, con control compacto, navegación inferior y sin
  desborde horizontal. La prueba permitió corregir el ancho intrínseco del patrón
  global de páginas.
- Los controles nativos adoptan el esquema activo mediante `color-scheme`.

## Pendiente

- Validación funcional del usuario antes de commit y despliegue.
