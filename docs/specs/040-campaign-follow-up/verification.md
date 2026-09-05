# SPEC-040 — Verificación

## 1. Automatizada (05/09/2026)

- `@repo/validation`: 281 pruebas en verde, 8 nuevas en
  `recovery-follow-up.test.mjs` — cuatro tramos excluyentes de próxima
  acción; «hoy» termina a medianoche de Lima y no de UTC; los tramos cubren
  toda cartera sin repetir; «sin primer contacto» excluye la espera; última
  tipificación filtra solo por el intento más reciente; «sin gestión» es un
  valor propio; contacto, gestión de hoy y estado; combinación con AND.
- `apps/web`: 94 pruebas en verde, 4 nuevas sobre los `extras` de
  `QueueFilters` — navegan por su parámetro, conviven con los demás y se
  quitan uno a uno, «Limpiar filtros» los borra, rótulo vacío configurable.
- Tipos y lint limpios en ambos paquetes.

## 2. Paridad indicador ↔ lista — sesión de administrador, servidor de desarrollo

Cartera de desarrollo: 38 casos asignados a una asesora, 2 con gestión hoy.

| Indicador del tablero | Cifra | Lista que abre | Filas |
|---|---|---|---|
| Asignados | 38 | `/recovery/follow-up` | 38 |
| Trabajados hoy | 2 | `?worked=hoy` | 2 |
| Sin primer contacto | 36 | `?contact=sin` | 36 |
| Agenda vencida | 0 | `?next=vencida&status=SCHEDULED` | 0 |
| Asesor (nombre) | — | `?advisor=<id>` | 38 |
| Asesor · Sin contacto | 36 | `?advisor=<id>&contact=sin` | 36 |

Además: `?result=SIN_RESPUESTA` → 2 (las dos gestiones de hoy);
`?result=SIN_GESTION` → 36; los cuatro tramos de próxima acción suman 38, la
cartera entera (BR-003); `?advisor=` de un asesor sin casos → 0; la barra
muestra Buscar, Equipo, Asesor actual, Última tipificación, Próxima acción,
Primer contacto, Gestión de hoy y Estado; el botón «Seguimiento» aparece en
triage y en Preparar campaña; abrir un cliente desde la lista lleva
`?from=follow-up` y la ficha ofrece «← Volver a Seguimiento» con el ancla del
caso.

**Discrepancia encontrada y corregida antes de entregar.** La cabecera de
Seguimiento decía «Agenda vencida: 38» mientras el tablero decía 0. La
cabecera contaba cualquier próxima acción en el pasado; el tablero cuenta
solo casos **agendados** con fecha pasada (BR-053). Es exactamente el fallo
que BR-001 existe para impedir, y lo detectó esta comprobación: la cabecera
pasa a usar la misma definición y el mismo enlace, y vuelve a dar 0 ↔ 0.

## 2b. Paridad en producción — 05/09/2026

Lectura de la pestaña de producción con sesión de administrador, sin
acciones. Cartera de 1 594 casos y varios asesores: exactamente lo que la
base de desarrollo no permitía.

| Indicador del tablero | Cifra | Seguimiento |
|---|---|---|
| Asignados | 1 594 | 1 594 |
| Trabajados hoy | 240 | 240 |
| Sin primer contacto | 567 | 567 |
| Agenda vencida | 15 | 15 |
| Xiomara Ricra | 130 | 130 |
| Franco Pariona | 117 | 117 |
| Liz Pisco | 165 | 165 |

BR-001 se cumple con población real y con «Agenda vencida» distinta de cero.

## 3. Limitaciones declaradas

- El panel del navegador quedó oculto durante la sesión y no recibe entrada
  real; toda la comprobación se hizo por lectura del HTML servido. La
  mecánica en vivo de la barra está cubierta por pruebas de componente y
  verificada con teclado real en la bandeja del asesor (SPEC-030 BR-089).
- La cartera de desarrollo tiene una sola asesora y ningún caso agendado
  ni en espera, así que «Agenda vencida» y los tramos «hoy»/«futura» se
  comprobaron en cero o por prueba pura, no con población real.
- Falta el recorrido con sesión de supervisor (criterio 6): el alcance por
  equipo es el del tablero y ya está verificado allí; queda registrado en
  `tasks.md`.

## 4. Decisión

Lista para producción con las limitaciones anteriores. La señal en
producción: en el Tablero del día, «Sin primer contacto» debe ser un enlace
y abrir en Seguimiento exactamente tantas filas como su cifra.
