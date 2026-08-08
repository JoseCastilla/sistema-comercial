# SPEC-011 — Jerarquía de acciones en la bandeja

**Estado:** `VERIFIED`
**Versión:** 1.0
**Fecha:** 2026-08-08

## Problema

La bandeja presenta períodos frecuentes, histórico, rango personalizado, estado,
equipo y búsqueda con peso visual similar. En móvil el rango permanece siempre
abierto y aparecen tres botones consecutivos, retrasando el acceso a métricas y
órdenes.

## Solución

Mantener visibles las decisiones frecuentes y aplicar divulgación progresiva a
las opciones avanzadas. Histórico y rango compartirán un control desplegable;
estado y equipo se aplicarán al seleccionar. Buscar será la única acción
explícita del bloque de filtros.

## Reglas

- **BR-001:** Hoy, Ayer, Semana y Mes actual permanecen visibles.
- **BR-002:** Histórico y rango personalizado se agrupan bajo un solo control.
- **BR-003:** si Histórico o Rango está activo, el bloque avanzado inicia abierto
  y comunica el contexto actual.
- **BR-004:** Estado y Equipo navegan inmediatamente al cambiar su selección.
- **BR-005:** Buscar conserva una acción explícita y accesible por texto en
  escritorio e icono etiquetado en móvil.
- **BR-006:** los controles conservan período, rango, equipo, estado y búsqueda
  según las reglas existentes.
- **BR-007:** las métricas se compactan en móvil sin ocultar valores.
- **BR-008:** los estilos pertenecen al sistema visual compartido.

## Criterios de aceptación

- **AC-001:** la vista inicial no muestra los campos Desde/Hasta.
- **AC-002:** Histórico y rango se descubren desde “Histórico y rango”.
- **AC-003:** en móvil solo Buscar aparece como botón dentro de filtros.
- **AC-004:** el placeholder de búsqueda conserva espacio útil en 390 px.
- **AC-005:** la bandeja llega antes a las órdenes y mantiene todos sus filtros.
- **AC-006:** tipos y lint terminan correctamente.
