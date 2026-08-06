# SPEC-005 — Ventas por período y contraste operativo

**Estado:** `APPROVED`
**Versión:** 1.1
**Fecha:** 2026-08-06
**Responsable de producto:** José Castilla

## Problema

La bandeja permite operar órdenes, pero no responde con precisión preguntas
cotidianas como “¿cuántas ventas entraron hoy, esta semana o este mes?”. Además,
la separación visual entre fondo, superficies, controles y texto secundario se
percibe demasiado tenue en producción, aunque los textos principales cumplan
el mínimo técnico de contraste.

La implementación actual obtiene hasta 200 órdenes activas y 30 finalizadas y
después filtra en el navegador. Calcular períodos sobre ese subconjunto podría
mostrar totales incompletos, por lo que el filtro temporal debe ejecutarse en la
base de datos.

## Objetivos

1. Consultar ventas de hoy, semana actual y mes actual sin cargar registros de meses anteriores.
2. Mostrar totales exactos del período y una lista paginada coherente con ellos.
3. Mantener visibles las excepciones operativas anteriores al período.
4. Aumentar el contraste percibido de toda la plataforma desde el sistema visual.
5. Conservar filtros en la URL para recargar, compartir y volver atrás sin perder contexto.

## Definiciones

- **Venta:** una `DitoOrder` única registrada exitosamente; se contabiliza una
  vez mediante `registeredAt`.
- **Zona horaria comercial:** `America/Lima`.
- **Hoy:** desde las 00:00 del día comercial hasta el inicio del día siguiente.
- **Semana actual:** desde el mayor valor entre lunes 00:00 y el primer día del mes; nunca arrastra ventas del mes anterior.
- **Mes actual:** desde el primer día del mes 00:00 hasta el primer día del mes siguiente.
- **Histórico:** acceso secundario y explícito; nunca se carga al entrar a la bandeja.
- Los intervalos son semiabiertos: inicio incluido y fin excluido.

## Reglas

- **BR-001:** el período se aplica en PostgreSQL antes de paginar o calcular totales.
- **BR-002:** el período predeterminado es `MONTH` y debe mostrarse explícitamente como “Mes actual”.
- **BR-003:** `TODAY`, `WEEK`, `MONTH` y `HISTORY` se conservan en `searchParams`; `HISTORY` requiere una selección explícita.
- **BR-004:** búsqueda, estado y período se combinan sin alterar el aislamiento por organización y rol.
- **BR-005:** los totales describen el período seleccionado, no solo la página visible.
- **BR-006:** las órdenes activas anteriores al mes no se mezclan con la bandeja; se muestra únicamente su cantidad y un acceso explícito “Pendientes anteriores”.
- **BR-007:** el servidor calcula límites horarios de Lima y consulta instantes UTC.
- **BR-008:** la lista usa paginación o cursor; no depende de límites globales ocultos.
- **BR-009:** ningún estilo nuevo se define dentro de una página si corresponde a un token o patrón reutilizable.
- **BR-010:** texto secundario normal apunta a contraste 7:1; texto esencial nunca baja de 4.5:1.
- **BR-011:** bordes de controles, foco y estados interactivos alcanzan al menos 3:1 respecto del fondo adyacente.
- **BR-012:** estado, selección o severidad nunca dependen únicamente del color.
- **BR-013:** ninguna consulta inicial de `/orders` devuelve registros cuyo `registeredAt` sea anterior al primer día del mes comercial en curso.

## Alcance funcional

- Selector compacto `Hoy · Semana · Mes actual` en `/orders` y acceso secundario a `Histórico`.
- Resumen del período: ventas, activas, entregadas, incidencias y fuera de plazo.
- Indicador separado de pendientes anteriores al período.
- Conteos exactos y lista paginada desde servidor.
- Filtros persistentes en URL y comportamiento responsive.
- Revisión global de canvas, superficies, bordes, texto secundario, campos,
  navegación, filas seleccionadas, badges y foco.

## Fuera de alcance

- Comparación contra el período anterior.
- Metas, comisiones, facturación o montos monetarios.
- Gráficos históricos y exportación.
- Selector arbitrario de fechas; podrá incorporarse después de validar los presets.

## Criterios de aceptación

- **AC-001:** “Hoy” coincide con el conteo SQL de `registeredAt` para el día de Lima.
- **AC-002:** semana y mes incluyen correctamente cambios de día, mes y año.
- **AC-003:** cambiar período actualiza URL, totales y lista de forma consistente.
- **AC-004:** recargar o compartir la URL conserva todos los filtros válidos.
- **AC-005:** una organización o agente nunca recibe conteos fuera de su alcance.
- **AC-006:** más de 200 ventas en un período mantienen un total exacto y navegación paginada.
- **AC-007:** una orden activa antigua no aparece en la lista mensual y sigue accesible únicamente mediante “Pendientes anteriores”.
- **AC-008:** escritorio y móvil muestran claramente el período activo y el alcance de los totales.
- **AC-009:** auditoría automatizada y revisión visual confirman los objetivos de contraste.
- **AC-010:** ADMIN, SUPERVISOR y AGENT completan la tarea “ver mis ventas de hoy/semana/mes” sin asistencia.
- **AC-011:** abrir `/orders` sin parámetros consulta solamente el mes comercial en curso.
