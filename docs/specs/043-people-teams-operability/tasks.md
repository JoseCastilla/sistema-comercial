# SPEC-043 — Tareas

## Fase 1 · Claridad y densidad (05/09/2026)

- [x] UX-01 · Fila compacta: nombre completo en dos líneas, una sola acción
      «Administrar», sin botones ni formularios en la fila.
- [x] UX-02 · `PersonAdminPanel`: panel lateral por URL (`persona=`) con
      identidad, relaciones comerciales, ciclo de vida, seguridad e
      historial; `ReturnFocus` devuelve el foco a la fila al cerrar.
- [x] UX-03 · «Nueva persona» y «Nuevo equipo» junto al título, formulario
      en panel; desaparecen los bloques plegables previos al listado.
- [x] PE-01 · Promoción: equipo actual visible, un equipo por promoción, y
      elección explícita entre trasladar la venta o conservar el equipo de
      venta (`salesMode`), con la spec de SPEC-042 corregida.
- [x] Estilos en el sistema visual compartido (`admin.css`): espacio de
      trabajo lista + panel, panel adhesivo, fila actual, nombre sin recorte.
- [x] Pruebas web: panel (4) y ciclo de vida ampliado (7).
- [x] Recorrido local con sesión de administrador (filas de 67 px sin
      botones, panel por URL, creación en panel en Personas y Equipos).
- [ ] Lectura de solo lectura en producción tras el despliegue.
- [ ] PE-02 · Reingreso real con una cuenta de prueba (lo ejecuta José); yo
      verifico en lectura identidad, historial, membresía y resolución de
      ventas por correo.

## Fase 2 · Indicadores comprensibles

- [ ] UX-04 · Indicadores que abren su filtro (Personas sin equipo; Equipos
      sin supervisor); «Asignar equipo» / «Asignar supervisor» desde el
      afectado.
- [ ] UX-05 · Equipos: «Personas habilitadas para vender», desglose por rol
      y capacidad, «Supervisores» con definición.
- [ ] PE-06 · Vista previa de deshabilitar equipo con personas, supervisiones
      y trabajo abierto; sin baja personal.

## Fase 3 · Navegación y continuidad

- [ ] UX-06 · Filtros en vivo en Personas y Equipos (mecánica compartida).
- [ ] UX-07 · Enlaces Personas ↔ Equipos con contexto.
- [ ] UX-08 · Formularios con estructura común y protección de borradores.
- [ ] PE-05 · Renombrar, retirar supervisión, reactivar vacío, historial de
      auditoría.
- [ ] PE-07 · «Mi equipo» del supervisor (pendiente de confirmación).
