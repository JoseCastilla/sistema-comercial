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
- [x] Lectura de solo lectura en producción tras el despliegue (25 filas de
      67 px sin botones, «Administrar» y «Nueva persona» por URL).
- [ ] PE-02 · Reingreso real con una cuenta de prueba (lo ejecuta José); yo
      verifico en lectura identidad, historial, membresía y resolución de
      ventas por correo.

## Fase 2 · Indicadores comprensibles (05/09/2026)

- [x] UX-04 · «Asesores sin equipo» abre `?situacion=sin-equipo` (filtro nuevo
      en la barra); «Sin supervisor» abre `?sinSupervisor=1`; el panel de una
      persona incompleta ofrece «Asignar equipo» con la acción existente; el
      equipo sin supervisor abre su formulario pidiendo un supervisor.
- [x] UX-05 · Equipos: «Personas habilitadas para vender» (asesores +
      supervisores que venden, sin repetir), «Supervisores» con definición,
      tarjeta con «N asesores · M supervisor(es) que venden».
- [x] PE-06 · Confirmación de deshabilitar con nombres de quien pierde su
      equipo, supervisiones que se cierran y ventas y casos abiertos del
      equipo; declara que no da de baja a nadie. `ConfirmSubmitButton`
      admite contenido estructurado.
- [x] `team-roster.ts` (plantilla y consecuencias) con 4 pruebas; panel con
      2 pruebas más.
- [x] Recorrido local con sesión de administrador.
- [x] Lectura de solo lectura en producción tras el despliegue: métricas
      nuevas, «Sin supervisor = 2» con enlace, confirmaciones con nombres y
      conteos reales.

## Fase 3 · Navegación y continuidad

- [ ] UX-06 · Filtros en vivo en Personas y Equipos (mecánica compartida).
- [ ] UX-07 · Enlaces Personas ↔ Equipos con contexto.
- [ ] UX-08 · Formularios con estructura común y protección de borradores.
- [ ] PE-05 · Renombrar, retirar supervisión, reactivar vacío, historial de
      auditoría.
- [ ] PE-07 · «Mi equipo» del supervisor (pendiente de confirmación).
