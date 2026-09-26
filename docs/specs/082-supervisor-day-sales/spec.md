# SPEC-082 — La supervisión entra a las ventas del día

**Estado:** `ENTREGADA` — José, 26/09/2026: «cuando el supervisor ingresa a la hoja de pedidos, debería poder ver las ventas del día, así puede validar uno a uno el estado de cada venta».

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Regla

- **BR-001 — Al entrar a Pedidos sin enlace propio**, el supervisor ve las
  ventas de **Hoy**, en todos sus estados (vista «Todos»).
  - Con ↑ ↓ y el panel las valida una a una (SPEC-074); «Guarda y pasa al
    siguiente» recorre el día.
  - La tabla por asesor (SPEC-081) muestra el pendiente de cada uno en el
    día.
- **BR-002 — Un enlace con período, vista o búsqueda manda.** Por ejemplo,
  el aviso de escalaciones o el que llega desde Mi día.
- **Sin cambios para los demás roles:**
  - El asesor sigue con su lista única del mes (SPEC-080).
  - Administración sigue entrando a «Por entregar» del mes.

## 2. Criterio de aceptación

- **AC-001**: una supervisora que entra a `/orders` ve «Hoy» marcado y la
  vista «Todos» con las ventas registradas hoy.
