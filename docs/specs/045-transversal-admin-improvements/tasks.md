# SPEC-045 — Tareas

## Fase 1 · Correcciones (06/09/2026)

- [x] PL-02 · Filtro «vencido» en validation (2 pruebas); conteo de la alerta
      con la clasificación y el alcance de la bandeja; enlace a
      `vence=vencido`; opción «Cualquier vencimiento» en la bandeja.
- [x] PL-03 · `campaign-stage-labels.ts`; Preparar, Revisar y Repartir con los
      mismos nombres y contadores enlazados; Preparar con las condiciones de
      Revisar (2 pruebas).
- [x] PL-05 · Cabecera del resumen por equipo con cobertura administrativa y
      enlaces; fila enlazada a la tarjeta del equipo.
- [x] PL-06 · «Pedidos que requieren acción» abre `/orders?status=LOGISTICS`.
- [x] Recorrido local con sesión de administrador (1 = 1, 9 = 9, nombres y
      enlaces).
- [x] Lectura de solo lectura en producción (alerta 70 = 70; verificados
      270 = 270; Logística 347 = 347); «En gestión» de Preparar alineado con
      Repartir.

## Fase 2 · Resumen administrativo y reparto con carga (06/09/2026)

- [x] PL-01 · Panel «Pendientes por resolver o cubrir» para ADMIN sin filtros,
      cuatro bloques con definición, alcance, cantidad enlazada y responsable.
- [x] PL-04 · Carga por asesor (abiertos, sin primer contacto, vencidos) y
      vista previa «recibiría / quedaría» en directa, equitativa y cola.
- [x] Recorrido local con sesión de administrador: Repartir: al elegir un asesor aparece «Hoy carga 0 abiertos (0 sin primer contacto, 0 vencidos). Recibiría 0 y quedaría con 0»; al elegir un equipo para la cola, «El equipo carga hoy 38 abiertos entre 7 asesores (36 sin primer contacto, 38 vencidos)», cifras iguales a Seguimiento (Cartera 38 · Sin primer contacto 36); la tabla equitativa muestra Participa · Abiertos · Sin 1.er contacto · Vencidos · Recibiría · Quedaría (AC-007). Paridad del resumen: críticas 1 = 1, próxima acción vencida 38 = 38, equipos sin supervisor 1 = 1.
- [x] Lectura de solo lectura en producción (70 = 70, 302 = 302, 1 502 =
      1 502, 347 = 347; tabla de carga en Repartir).

## Fase 3 · Fuente, columnas y actividad (06/09/2026)

- [x] PL-07 · Horario único en `schedule.ts`; Logística con fuente, pantalla,
      próxima consulta y aviso de atraso.
- [x] PL-08 · Cabecera y equipo fijos al desplazar; rejilla más ancha;
      «N personas en el equipo» aparte de los vendedores activos.
- [x] PL-09 · Seguimiento con `periodo=`; «Trabajados» enlaza en los cuatro
      períodos conservando equipo y asesor.
- [x] Recorrido local con sesión de administrador (Logística 8:25 / 8:49 /
      12:00; tablero 7 días «Trabajados 2» → Seguimiento 2).
- [x] Lectura de solo lectura en producción («Trabajados» 1/483/1 255/1 255 =
      Seguimiento; Logística con tres horas; «6 personas en el equipo»).

## Fase 4 · Control administrativo y consultas externas (06/09/2026)

- [x] PL-10 · DNI: actividad propia y de la organización, nuevas frente a
      guardadas, saldo con fecha del reporte. DITO: historial paginado en
      solo lectura.
- [x] PL-11 · Textos de «Checa tus líneas»; etiqueta accesible del selector
      de equipo del triage; reparto operable con teclado (fase 2).
- [x] Recorrido local con sesión de administrador: DNI con «Tu actividad» (mes, hoy, DNI distintos; pista «0 nuevas al proveedor · 0 desde la ficha guardada») y «Toda la organización» aparte, saldo «que reportó el proveedor en la última consulta nueva, el 29 ago. 2026…; no es un saldo en tiempo real» (AC-011). Importar ventas DITO: «Ver el historial completo (6 cargas)» → «Historial de cargas · página 1 de 1», tabla sin ningún formulario de borrado (AC-012). «Checa tus líneas» con el texto sobre lo no auditado y la salida externa; a 375 px sin desbordamiento horizontal, marco de 323 × 841 con el botón «Abrir fuera del sistema» visible (AC-013).
- [ ] Lectura de solo lectura en producción tras el despliegue.

## Fase 0 · Operación (spec propia, pendiente de abrir)

- [ ] Worker con cron (AGR, vencimientos, reintento de webhooks).
- [ ] Copias de seguridad programadas y ensayadas.
- [ ] Límite de intentos en login y MFA para ADMIN/BACKOFFICE.
