# SPEC-040 — Seguimiento de la campaña: del indicador al cliente

Estado: en construcción (05/09/2026). Fase 3 del plan de usabilidad de
Campañas, revisado el 05/09/2026.

## 1. Origen

El Tablero del día (SPEC-030 BR-052 a BR-056b) responde tres preguntas —
cuánto se avanzó, con qué cobertura, con qué efectividad— y las responde con
cifras. Una supervisora lee «Sin primer contacto: 27» y no puede hacer nada
con ese número: no hay ninguna pantalla que le enseñe **cuáles** son esos 27
clientes ni quién los tiene. Para actuar tiene que ir a Distribución, elegir
al asesor, y adivinar.

El plan de usabilidad lo llamó «supervisión accionable»: **cada indicador
permite consultar los clientes que explican su cifra**. Eso exige una lista
que no existe hoy — la cartera asignada, filtrable por asesor, por última
tipificación y por próxima acción — y que los indicadores del tablero
abran esa lista ya filtrada.

## 2. Alcance

Una pantalla nueva, `/recovery/follow-up` («Seguimiento»), para los mismos
roles que el tablero: `ADMIN`, `BACKOFFICE` y `SUPERVISOR` dentro de sus
equipos. Lista la **cartera asignada** — casos de base nacional con asesor,
en `ASSIGNED`, `IN_PROGRESS`, `SCHEDULED` o `WAITING` — con la barra de
filtros en vivo de la fase 2 y cuatro filtros propios. Los indicadores del
tablero que describen casos abiertos enlazan a ella con el filtro puesto.

Fuera de alcance: acciones sobre los casos desde la lista (reasignar,
tipificar, resolver), que siguen en Distribución y en la ficha; métricas
nuevas; el carril interno de recupero de ventas (BR-075: fuentes separadas).

## 3. Reglas

- **BR-001:** la lista muestra exactamente la misma población que el
  indicador que la abre. «Sin primer contacto» en el tablero y «Sin primer
  contacto» en Seguimiento son **la misma función** sobre los mismos datos
  (`firstContactAt` nulo y estado distinto de `WAITING`, como BR-053): un
  indicador que abre otra cosa que la que cuenta es peor que uno que no abre
  nada.
- **BR-002:** **última tipificación** es el resultado del intento **más
  reciente** del caso, no cualquier intento histórico. Un caso que hoy dice
  «No contesta» y ayer dijo «Interesado» es hoy un «No contesta». «Sin
  gestión» es un valor propio: nunca tuvo intentos.
- **BR-003:** **próxima acción** se filtra en cuatro tramos **excluyentes**
  sobre la hora de Lima: **Vencida** (anterior a ahora), **Hoy** (de ahora al
  fin del día), **Futura** (mañana en adelante) y **Sin fecha**. Nada cae en
  dos tramos ni fuera de todos. Esto resuelve la «precisión pendiente» del
  plan: no hay solapamientos que indicar.
- **BR-004:** el alcance es el del tablero. Un supervisor ve solo los casos
  de sus equipos; un `?team=`, `?advisor=` o cualquier parámetro de la URL
  **solo estrecha** (SPEC-030 BR-091/COR-04). Un asesor ajeno no devuelve
  filas.
- **BR-005:** el asesor de la lista es el **dueño actual** del caso, igual
  que en el tablero (BR-055): quien lo tiene hoy, no quien lo originó ni el
  destino de una asignación.
- **BR-006:** «con gestión hoy» / «sin gestión hoy» miden intentos del día
  calendario de Lima, como el tablero (BR-053, BR-032). Es lo que hace que
  «Trabajados hoy» del tablero abra su lista exacta.
- **BR-007:** la lista no suma fuentes (BR-075): solo `NATIONAL_BASE`.
- **BR-008:** los indicadores del tablero que describen **casos resueltos**
  —recuperados, perdidos, descartes— no enlazan a Seguimiento, porque esa
  lista es de casos abiertos. Enlazan los que describen cartera viva:
  Asignados, Trabajados hoy, Sin primer contacto, Agenda vencida, y por
  asesor: su nombre y su «Sin contacto».
- **BR-009:** cada fila lleva al cliente: abrir la ficha conserva el contexto
  de la lista para volver al mismo sitio (SPEC-030 BR-089).

## 4. Criterios de aceptación

1. Desde «Sin primer contacto: N» en el tablero se abre Seguimiento con
   exactamente N filas, y cada una carece de primer contacto.
2. Desde el nombre de un asesor en el tablero se abre su cartera; su celda
   «Sin contacto» abre solo los suyos sin contacto.
3. Elegir «Última tipificación: No contesta» deja solo casos cuyo intento más
   reciente fue «No contesta»; uno con «No contesta» ayer e «Interesado» hoy
   no aparece.
4. Los cuatro tramos de próxima acción, sumados, dan el total de la cartera
   filtrada; ninguno se solapa.
5. Buscar por nombre, DNI o teléfono funciona igual que en las demás colas.
6. Un supervisor con `?advisor=` de otro equipo en la URL ve cero filas, no
   filas ajenas.
7. Abrir un cliente y volver conserva filtros, página y la fila consultada.
8. Cambiar cualquier filtro vuelve a la primera página; los activos se ven y
   se quitan uno a uno.

## 5. Fuera de alcance de esta versión

- Filtro por fecha de última gestión distinta de «hoy» (el plan lo listó
  como adicional; la columna muestra la fecha).
- Acciones masivas desde la lista.
- Exportar la lista.
