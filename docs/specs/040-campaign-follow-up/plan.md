# SPEC-040 — Plan

## 1. Arquitectura

Una página de servidor, `/recovery/follow-up`, que reutiliza tres piezas ya
construidas en lugar de inventar nada:

- **La barra de filtros en vivo** de la fase 2 (`QueueFilters`, SPEC-030
  BR-092), extendida con **selectores adicionales genéricos** (`extras`) para
  no acoplarla a esta pantalla: última tipificación, próxima acción, primer
  contacto, gestión de hoy y estado se declaran como listas de opciones.
- **La condición de búsqueda unificada** (`buildRecoverySearchWhere`,
  BR-088) y **el estrechamiento de alcance** (`teamScope`, BR-091/COR-04).
- **Las definiciones del tablero** (BR-053/BR-055): la lista y el tablero
  cargan la misma población —cartera asignada dentro del alcance— y aplican
  las mismas funciones. Que un indicador abra otra cosa que la que cuenta es
  el fallo que esta spec existe para impedir (BR-001).

### Filtrado en memoria, a propósito

«Última tipificación» es el resultado del intento **más reciente**; «próxima
acción» es un tramo sobre la hora de Lima; «sin primer contacto» combina dos
columnas. Ninguna se expresa limpiamente como `where` de Prisma sin
desnormalizar el caso (una columna `last_attempt_result` con su migración) o
sin subconsultas frágiles. El tablero ya resuelve la misma pregunta cargando
la cartera asignada en memoria —cientos de casos, no miles: BR-084 vence a
los siete días— y filtrando con funciones puras. Seguimiento hace lo mismo:
consulta acotada por alcance, búsqueda, equipo y asesor en la base; última
tipificación, próxima acción, contacto, gestión de hoy y estado en memoria,
con una **función pura probada** en `@repo/validation`
(`selectFollowUpCases`). Si la cartera creciera a miles, el paso siguiente
es la desnormalización, no una subconsulta.

## 2. Modelo de datos

Sin cambios de esquema. Se leen `recovery_cases` (estado, asesor, equipo,
`firstContactAt`, `nextActionAt`, `lastSightingAt`) y su intento más
reciente (`attempts`, `orderBy createdAt desc, take 1`) más los intentos del
día para el conteo (BR-032).

## 3. Seguridad y privacidad

- Roles: `ADMIN`, `BACKOFFICE`, `SUPERVISOR` — los del tablero. `AGENT` es
  redirigido; su cartera es la bandeja de campañas.
- Alcance: `scopeWhere` acota por organización, fuente y —para supervisor—
  sus equipos activos. `team` y `advisor` de la URL **solo estrechan**; un
  asesor ajeno no devuelve filas porque la base ya está acotada por equipo.
- Datos sensibles: la lista muestra lo que ya muestran triage y
  distribución (nombre, DNI copiable, teléfono); nada de columnas `A`–`M`.

## 4. Idempotencia y concurrencia

La pantalla es de lectura. Ninguna acción se ejecuta desde ella.

## 5. Rendimiento

Población acotada: cartera asignada de una organización, decenas a pocos
cientos (producción hoy: 193 en gestión + 211 en espera). Dos consultas
principales (casos con su último intento; intentos del día) y una de
equipos/asesores para las opciones. Paginación en memoria a 100 filas.

## 6. Fases

1. Regla pura `recovery-follow-up.ts` con pruebas: tramos de próxima acción
   y selector de casos.
2. `QueueFilters` con `extras` genéricos y prueba.
3. Página `/recovery/follow-up` con tabla y contexto de vuelta a la ficha.
4. Tablero: indicadores y nombres de asesor enlazan a la lista filtrada.
5. Accesos: botón «Seguimiento» junto a «Tablero del día» en triage y en
   Preparar campaña; ruta asociada a la sección Campañas en el shell.

## 7. Pruebas

- Puras: tramos excluyentes y cobertura total; medianoche de Lima; última
  tipificación solo sobre el intento más reciente; «sin gestión»; sin primer
  contacto excluye `WAITING`; gestión de hoy por día de Lima; estado.
- Componente: los `extras` navegan como los demás filtros y aparecen como
  fichas quitables.
- Recorrido con sesión de administrador: el indicador «Sin primer contacto»
  abre N filas iguales a su cifra; el nombre de un asesor abre su cartera.

## 8. Migración y despliegue

Sin migración. Publicar en `main` despliega (EasyPanel).
