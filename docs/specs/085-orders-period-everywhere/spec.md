# SPEC-085 — Toda la información de Pedidos es del período elegido

**Estado:** `ENTREGADA` — José, 26/09/2026: «que Entregas fallidas muestre la información del mes en curso. Al igual que toda la información, debe referirse al periodo actual. Si el asesor / supervisor / administrador quiere ver los datos de otro periodo, por ejemplo agosto, debe tener la opción».

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Origen

Hasta aquí, «Entregas fallidas» y «Escaladas» no usaban el período:
- Entregas fallidas mostraba todo lo reportado por Máximo desde el 10/08
  (SPEC-029): 658 pedidos, entre 42 y 51 por asesor.
- Escaladas mostraba todas las pendientes (SPEC-028).

Por eso, en esas dos vistas, la barra de período se reemplazaba por un
texto.

## 2. Reglas

- **BR-001 — Todas las vistas usan el período elegido**, el mes en curso
  por defecto:
  - Por entregar, Entregas fallidas, Falta activar, Escaladas, Cerrados y
    Todos;
  - la hoja del asesor;
  - la tabla por asesor;
  - los estados de Máximo.
- **BR-002 — La barra de período es la misma en todas las vistas**: Hoy,
  Ayer, Semana, Mes actual, Histórico y rango. Así se puede ver agosto (con
  un rango) o todo (con el histórico). La hora de la última consulta a
  Máximo pasa a la línea de cifras de Entregas fallidas.
- **BR-003 — Lo de antes no se pierde.** La línea «Antes de hoy / de esta
  semana / de este mes» suma a lo que ya tenía (por entregar, por activar)
  las entregas fallidas y las escaladas que siguen abiertas. Cada cifra
  abre su vista en el rango anterior (SPEC-084).
- **BR-004 — El aviso global de escalaciones** cuenta todas las pendientes,
  así que abre el histórico de Escaladas.
- **Sin cambio:** qué pedido es una entrega fallida (SPEC-029 BR-017). Los
  cancelados que Máximo reporta con problema siguen dentro, porque son los
  que backoffice reingresa.

## 3. Criterios de aceptación

- **AC-001**: «Entregas fallidas» del mes cuenta solo lo registrado en el
  mes, y con «Histórico» vuelve a la cifra completa.
- **AC-002**: en Escaladas y en Entregas fallidas aparece la misma barra de
  período que en las demás vistas.
