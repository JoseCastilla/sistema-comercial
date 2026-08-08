# SPEC-010 — Alcance y filtro de órdenes por equipo

**Estado:** `APPROVED`
**Versión:** 1.0
**Fecha:** 2026-08-08

## Problema

La bandeja limita a los agentes por `agentUserId`, pero Supervisor, Admin y
Backoffice comparten actualmente el alcance completo de la organización. Esto
incumple la regla que restringe al Supervisor a sus equipos y hace difícil
trabajar la bandeja por equipo.

## Solución

Aplicar primero el alcance autorizado en servidor y, sobre ese conjunto, añadir
un filtro opcional `team` en `/orders`. El Supervisor tendrá como vista inicial
sus equipos activos más el pool limitado de órdenes huérfanas. Admin y
Backoffice conservarán el alcance completo. Agente seguirá viendo solo sus
órdenes y no tendrá selector.

## Reglas

- **BR-001:** toda consulta se limita primero por organización.
- **BR-002:** Admin y Backoffice pueden consultar toda la organización y
  seleccionar cualquier equipo activo.
- **BR-003:** Supervisor solo ve órdenes asignadas a equipos que supervisa
  activamente y el pool de órdenes con agente y equipo nulos.
- **BR-004:** Supervisor sin equipos activos no ve órdenes ni el pool huérfano.
- **BR-005:** Agente solo ve órdenes cuyo `agentUserId` coincide con su usuario.
- **BR-006:** `team=UNASSIGNED` representa exclusivamente órdenes con
  `agentUserId` y `assignedTeamId` nulos.
- **BR-007:** un UUID de equipo solo se aplica si pertenece al catálogo visible
  del usuario; cualquier valor manipulado vuelve al alcance predeterminado.
- **BR-008:** el filtro de equipo se conserva al cambiar período, estado,
  búsqueda, rango o página.
- **BR-009:** datos personales del pool huérfano se enmascaran para Supervisor y
  esas órdenes no permiten actualización de estado antes de reclamarlas.
- **BR-010:** una acción de actualización vuelve a comprobar en servidor la
  visibilidad de la orden; la interfaz no concede autorización.

## Criterios de aceptación

- **AC-001:** Supervisor no recibe órdenes de equipos ajenos.
- **AC-002:** Supervisor ve sus equipos más el pool limitado por defecto.
- **AC-003:** Admin y Backoffice pueden filtrar por equipo o sin asignar.
- **AC-004:** Agente no ve selector ni amplía su alcance mediante la URL.
- **AC-005:** filtros y navegación preservan el equipo seleccionado.
- **AC-006:** un Supervisor no puede actualizar una orden ajena ni una huérfana.
- **AC-007:** pruebas, tipos y lint terminan correctamente.
