# SPEC-009 — Ventas de ayer y por rango de fechas

**Estado:** `VERIFIED`
**Versión:** 1.1
**Fecha:** 2026-08-11

## Problema

La bandeja permite consultar hoy, la semana, el mes y el histórico operativo,
pero no ofrece un acceso directo a las ventas de ayer ni una consulta acotada
entre dos fechas. Esto obliga a revisar un conjunto mayor de órdenes y dificulta
los cierres y validaciones puntuales.

## Solución

Añadir el período `YESTERDAY` y un período `RANGE` identificado en la URL por
`from` y `to`. Las fechas se interpretan en `America/Lima`; el día final es
inclusivo para la persona y se convierte en un intervalo técnico semiabierto.
El histórico conserva su finalidad actual para pendientes anteriores.

## Reglas

- **BR-001:** Ayer comprende desde las 00:00 del día anterior hasta las 00:00
  del día actual en Lima.
- **BR-002:** la URL del rango usa
  `?period=RANGE&from=YYYY-MM-DD&to=YYYY-MM-DD`.
- **BR-003:** `from` y `to` deben ser fechas reales y `from` no puede ser
  posterior a `to`.
- **BR-004:** el rango visible incluye ambos días; la consulta usa
  `[from 00:00, to + 1 día 00:00)` en Lima.
- **BR-005:** un rango ausente o inválido vuelve a `MONTH` sin ejecutar una
  consulta parcial.
- **BR-006:** los filtros, la búsqueda, la paginación y la recarga preservan
  `from` y `to` mientras el período sea `RANGE`.
- **BR-007:** cambiar a un período predefinido elimina las fechas del rango de
  la URL.
- **BR-008:** Histórico continúa mostrando su vista operativa independiente y
  no se reemplaza por Rango.
- **BR-009:** la consulta mantiene los permisos y el aislamiento por
  organización existentes.
- **BR-010:** Desde y Hasta no permiten seleccionar una fecha posterior al día
  actual de `America/Lima`; una URL manipulada con fechas futuras es inválida.
- **BR-011:** después de aplicar un rango, el panel avanzado se cierra y conserva
  el período elegido como contexto visible en su resumen.

## Criterios de aceptación

- **AC-001:** la bandeja ofrece un botón Ayer junto a los períodos existentes.
- **AC-002:** Ayer funciona en cruces de mes y de año.
- **AC-003:** se puede elegir Desde/Hasta y la URL refleja el rango elegido.
- **AC-004:** una orden del último día se incluye durante todo ese día en Lima.
- **AC-005:** al filtrar, buscar, paginar o recargar se conserva el rango.
- **AC-006:** una URL RANGE inválida muestra Mes actual.
- **AC-007:** pruebas de dominio, tipos y lint finalizan correctamente.
- **AC-008:** el calendario limita ambas fechas al día actual de Lima.
- **AC-009:** Ver rango muestra los resultados y cierra el formulario.
