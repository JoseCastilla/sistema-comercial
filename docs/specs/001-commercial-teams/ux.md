# SPEC-001 — Dirección de experiencia de usuario

**Estado:** `APPROVED_FOR_INCREMENTAL_IMPLEMENTATION`

## 1. Objetivo

Construir una herramienta de trabajo comercial rápida, legible y confiable. La
interfaz debe reducir decisiones repetitivas, revelar excepciones y conservar
el contexto operativo. No debe parecer una colección de tarjetas genéricas ni
una plantilla de panel administrativo.

## 2. Stack visual elegido

- **Next.js 16 + React 19 + TypeScript:** base existente para rutas, componentes
  de servidor, acciones y renderizado progresivo.
- **Tailwind CSS 4 + variables CSS semánticas:** composición y tokens propios;
  no se adoptará el tema visual predeterminado de ninguna librería.
- **Radix Primitives:** comportamiento accesible para diálogos, menús, pestañas,
  selectores, tooltips y confirmaciones, conservando control total del estilo.
- **TanStack Table:** solo para bandejas que requieran columnas configurables,
  ordenamiento, filtros o virtualización. Las vistas pequeñas usarán HTML nativo.
- **Motion:** únicamente para transiciones funcionales breves —aparición de
  paneles, confirmación y cambio de estado— respetando `prefers-reduced-motion`.
- **SVG propio para iconografía de producto:** los iconos de acciones comunes
  podrán provenir de una colección consistente, pero navegación, estados clave
  y marca no dependerán del repertorio visual típico de una plantilla.

No se usará shadcn/ui como sistema visual. Sus componentes pueden servir como
referencia técnica, pero copiar su apariencia produciría una interfaz demasiado
reconocible y poco diferenciada.

## 3. Lenguaje visual

- Densidad operativa media: suficiente información sin convertir cada dato en
  una tarjeta independiente.
- Jerarquía por tipografía, alineación y espacio antes que por bordes y sombras.
- Superficies blancas o neutras; color reservado para estado, riesgo y acción.
- Bordes discretos, radios moderados y sombras solo cuando expresen elevación.
- Filas y paneles de detalle para operaciones; tarjetas solo para resúmenes.
- Etiquetas humanas: “Equipo principal”, “Necesita revisión”, “Sin asignar”.
- Fechas, teléfonos y códigos con formatos consistentes y fáciles de copiar.
- Navegación estable en escritorio y móvil; la ubicación actual siempre visible.

## 4. Principios de interacción

1. La acción principal de cada pantalla debe ser inequívoca.
2. Las operaciones destructivas muestran impacto antes de confirmarse.
3. Éxito, error y progreso aparecen junto al control que originó la acción.
4. Los formularios conservan los datos cuando ocurre un error recuperable.
5. No se ocultan reglas importantes dentro de tooltips.
6. Las bandejas permiten escanear, filtrar y abrir detalle sin perder posición.
7. Los estados vacíos explican qué falta y ofrecen el siguiente paso permitido.
8. La interfaz funciona con teclado, foco visible y objetivos táctiles adecuados.

## 5. Arquitectura de información de SPEC-001

- **Personas:** usuarios, rol, estado, equipo principal y vínculos DITO.
- **Equipos:** supervisores, asesores, capacidad y estado del equipo.
- **Pedidos:** bandeja personal/de equipo, detalle y datos originales DITO.
- **Sin asignar:** cola excepcional con información proporcional al rol.
- **Solicitudes:** pendientes de revisión, decisión e historial.

“Personas” y “Equipos” deben ser destinos separados en la navegación de
administración. La reasignación y el historial viven dentro del contexto del
pedido, no en pantallas administrativas desconectadas.

## 6. Componentes de producto

- `PageHeader`, `SectionHeader`, `CommandBar` y breadcrumbs.
- `DataTable`, `FilterBar`, búsqueda, filtros guardados y paginación.
- `StatusBadge` con texto e icono; el color nunca es la única señal.
- `EmptyState`, `ErrorState`, skeleton y estado sin permisos.
- `Drawer` de detalle para inspección rápida y página completa para trabajo.
- `ConfirmDialog` que explica consecuencias y cantidad de registros afectados.
- `Toast` solo para confirmación secundaria; los errores permanecen visibles.
- campos, selectores y comboboxes con ayuda, error y teclado consistentes.

## 7. Criterios de calidad UX

- Las tareas frecuentes se completan sin navegar más de dos niveles.
- Una asignación muestra persona, equipo actual, equipo destino y consecuencia.
- Ninguna acción destructiva depende únicamente del color o de un icono.
- Escritorio: usable desde 1280 px; móvil: usable desde 360 px sin tabla cortada.
- Navegación completa por teclado y foco visible.
- Contraste conforme a WCAG 2.2 AA para texto y controles esenciales.
- Estados de carga, vacío, error, sin permiso, éxito y conflicto definidos.
- Prueba de usabilidad con administrador, supervisor y asesor antes de `VERIFIED`.

## 8. Secuencia de diseño

1. Auditar `/orders`, `/admin/users` y `/admin/teams` con datos representativos.
2. Crear tokens y componentes base dentro de `packages/ui`.
3. Rediseñar el shell y separar navegación de Personas y Equipos.
4. Rediseñar la bandeja de pedidos y su panel de detalle.
5. Diseñar pool, reasignación, historial y solicitudes sobre los mismos patrones.
6. Validar escritorio, móvil, teclado y los roles definidos en SPEC-001.

## 9. Decisiones pendientes de producto

- nombre visual definitivo y elementos de marca;
- densidad preferida para la bandeja: cómoda o compacta;
- métricas operativas que merecen aparecer en Inicio.

Los campos prioritarios de la bandeja quedaron resueltos en SPEC-024: la
identidad del asesor se muestra a roles de conducción, mientras que el asesor
ve el plazo de acción en ese mismo espacio.

## 10. Auditoría inicial de interfaz

**Fecha:** 2026-08-05.

### `/orders`

- La suma de tarjetas separadas aumentaba la altura y el ruido visual.
- El total visible podía mostrar una orden mientras el filtro activo mostraba cero
  sin explicar la diferencia.
- Se sustituyeron las métricas aisladas por un grupo compacto y el estado vacío
  ahora diferencia ausencia total de ausencia dentro del filtro.
- En móvil se usa un selector; forzar seis pestañas horizontales introducía un
  desplazamiento poco usable.

### `/admin/users`

- “Equipo y usuarios” mezclaba personas, permisos, contraseñas y equipos.
- El formulario de alta ocupa la primera pantalla móvil y relega el inventario.
- La administración de alias requiere una jerarquía secundaria dentro del detalle
  de la persona, no otra tarjeta visual equivalente.

### `/admin/teams`

- El acceso dependía de un enlace dentro de Personas y no de la navegación global.
- El estado vacío y el formulario compiten por atención cuando aún no hay equipos.
- La asignación de miembros debe evolucionar a un flujo guiado con identidad,
  equipo actual y consecuencia antes de confirmar.

### Shell y navegación

- Las iniciales usadas como iconos no ofrecían reconocimiento suficiente.
- “Equipo” representaba dos objetos diferentes: personas y equipos comerciales.
- Se crearon destinos persistentes `Personas` y `Equipos`, con iconografía SVG
  propia, estados activos y permisos aplicados por ruta.

## 11. Patrón transversal de producto

La plataforma adopta una estructura consistente para todos sus módulos:

1. **Resumen:** pocas métricas que expliquen situación, riesgo y progreso.
2. **Exploración:** filas o tablas densas para comparar información estructurada.
3. **Acción contextual:** formularios y decisiones aparecen junto al registro que
   las origina, sin llenar la vista inicial de botones.
4. **Detalle bajo demanda:** panel lateral para información completa, historial y
   acciones menos frecuentes.

Este patrón se aplicará de forma incremental a Pedidos, Personas, Equipos,
Importaciones, Rendimiento y Prospección. Cada migración debe preservar reglas,
permisos y flujos estables; la coherencia visual no autoriza una reescritura
simultánea de módulos operativos.
