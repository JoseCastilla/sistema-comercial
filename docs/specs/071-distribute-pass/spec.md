# SPEC-071 — Repartir la base, control por control

**Estado:** `ENTREGADA` — mejoras de presentación, con la autorización de José del 25/09/2026

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Tercera pasada del supervisor. José autorizó el 25/09/2026 ejecutar sin
preguntar las mejoras de presentación («Si encuentras oportunidades de
mejora en la experiencia visual o forma en que se muestra la información,
ejecutas»). Esta pasada no cambia ninguna regla de reparto: los tres modos
(SPEC-030 BR-028 a BR-030b, BR-050b) y la vista previa (PL-04) son los
mismos.

Lo que se vio en producción con la sesión de la supervisora: 6883 px de
alto; cuatro tarjetas de cifras con sus explicaciones; las tres formas de
repartir lado a lado, con la tabla del reparto parejo desbordada (358 px en
217); una tabla de ocho columnas que no cabía (771 px en 680); «caso(s)» y
fechas «25/9/26, 10:00».

## 2. Reglas de presentación

- **BR-001 — Una línea de cifras** en lugar de cuatro tarjetas: disponibles
  para asignar, asignados sin gestión, en gestión y en revisión; cada una
  abre su lista y explica su población al pasar el puntero.
- **BR-002 — Las dos poblaciones como pestañas** con su cifra: «Por
  repartir» y «Asignados sin gestión».
- **BR-003 — Filtros justos.** A la vista la búsqueda, el equipo y el
  departamento; plan y antigüedad en «Más filtros» (la barra compartida
  pliega también plan y antigüedad cuando usa `moreFilters`).
- **BR-004 — Marcar arriba**: «N de M marcados», «Marcar los primeros N»,
  «Marcar todos» o «Quitar las marcas» y Shift + clic para un rango.
- **BR-005 — Una forma de repartir a la vez, a todo el ancho**: «Parejo en
  el equipo» (primero), «A un asesor» o «A la cola del equipo». El botón
  dice cuántos: «Repartir 12 casos». En el parejo, cada asesor en una línea
  con lo que tiene, lo que recibiría y con cuánto quedaría.
- **BR-006 — Cada caso, una fila compacta** que se marca con un clic:
  nombre, avisos («Ya puede portar», «Falta consultar portabilidad») y una
  línea con departamento, plan, equipo o responsable y cuándo apareció en la
  base. El DNI no hace falta para repartir; está en la ficha.
- **BR-007 — Plurales y fechas** como en el resto: «66 casos», «24/09
  10:00».

## 3. Criterios de aceptación

- **AC-001** — Nada se corta ni se desplaza de lado, en la computadora ni
  en el celular.
- **AC-002** — Repartir, asignar y enviar a la cola hacen lo mismo que antes.
