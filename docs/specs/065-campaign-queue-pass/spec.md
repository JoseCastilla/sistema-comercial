# SPEC-065 — Cola de campaña, control por control

**Estado:** `VERIFICADA` — catorce mejoras aprobadas por José, verificadas en producción (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Tras la pasada control por control de «Mi día» (SPEC-063 fase 6), José pidió
la misma revisión en la cola de Campañas. Se recorrió en producción con la
sesión de una asesora (solo lectura) y se propusieron catorce mejoras; José
respondió «avanza con todo en ese orden».

Lo que se vio:

- El mismo caso dice cosas distintas en «Mi día» y en la cola: para un
  cliente, «Mi día» dice «desde el 12/09 · Ya puede portar: llámalo» y la
  cola marca en rojo «Próxima acción 9/9, 12:40». La columna mostraba la
  fecha interna del último intento, no la de lo que toca, y pintaba en rojo
  las 26 filas.
- «Historial 0» fuera de su vista: el historial solo se consultaba al abrirlo
  (tenía 68).
- La tabla medía 1504 px en 948: escondía a la derecha «Ver datos», «Abrir»,
  los intentos y la próxima acción; en el celular no se veían ni el cliente
  ni su teléfono.
- Tres niveles de navegación repetían las mismas cifras (pestañas, cinco
  tarjetas y las vistas), y «Tomar casos libres» ocupaba media pantalla antes
  del trabajo.
- El aviso flotante tapaba contenido al desplazarse.

## 2. Reglas

### Grupo 1 — Errores

- **BR-001 — Cada vista cuenta lo suyo siempre.** «Historial» dice cuántos
  casos se resolvieron en 30 días aunque no sea la vista abierta.
- **BR-002 — El plazo es el de lo que toca.** La fila dice lo mismo que «Mi
  día» (`describeCampaignWorkDue`): una oportunidad vencida dice desde cuándo
  («desde el 12/09», «hace 20 h») y en neutro; una llamada acordada dice su
  hora y se pone roja solo si el asesor la dejó vencer (ámbar si vence en
  menos de dos horas); lo que espera dice cuándo vuelve.

### Grupo 2 — La fila

- **BR-003 — La misma fila que «Mi día».** Tarjeta con el plazo arriba, el
  cliente con su teléfono a la vista (un toque llama en el celular; un clic
  lo copia en la computadora), qué hacer en una frase y, a la derecha, «Ver
  datos», «Abrir caso» y «Registrar gestión». Sin desplazamiento lateral.
- **BR-004 — Qué hacer, sin jerga.** Las frases son las de «Mi día»
  (`campaignWorkActions`): «Ya puede portar: llámalo», «Volver a llamar»,
  «Llamar: seguimiento acordado». El origen solo se muestra cuando le dice
  algo al asesor (`campaignWorkNotes`). En espera, la frase es el motivo y la
  nota dice cómo termina.
- **BR-005 — Nada repetido.** Sin la etiqueta «Ya puede portar» junto al
  nombre (ya lo dice la frase).
- **BR-006 — La resolución obligatoria dice qué hacer.** En lugar de
  «Resolver hoy»: «Lleva 7 días contigo: ciérralo o agenda una fecha»
  (SPEC-030 BR-058).
- **BR-007 — Los intentos, en neutro.** «0 de 3 hoy», sin rojo en cada fila.
- **BR-008 — Lo de consulta, en «Ver datos».** El DNI pasa a la ficha
  desplegable junto a padres y nacimiento; la línea de la fila lleva la
  última gestión (resultado, fecha y observación), operador y plan, e
  intentos. El último resultado no se pinta: el color es para el plazo.
- **BR-009 — Un formato de fecha.** «08/09 12:40», como en «Mi día».

### Grupo 3 — Encabezado y estructura

- **BR-010 — Un solo nivel de cifras.** Las vistas «Trabajar ahora · Por
  completar · En espera · Historial» llevan su cifra; sin tarjetas de
  métricas. La regla de los tres intentos queda en la línea del resultado:
  «26 casos · 24 sin sus 3 intentos de hoy».
- **BR-011 — Sin subtítulos que repiten.** Sin descripción bajo el título ni
  un título «Trabajar ahora» sobre la pestaña del mismo nombre.
- **BR-012 — Tomar casos, al final y en una línea.** «381 casos libres en
  {equipo} · Tomar 10 casos»; departamento, plan y cantidad en «Elegir
  cuáles».
- **BR-013 — Filtros a la vista, los justos.** Búsqueda y departamento a la
  vista; plan y antigüedad en «Más filtros» (abierto si alguno está en uso).
  «26 casos», sin «caso(s)».

### Grupo 4 — Aviso

- **BR-014 — El aviso ocupa su lugar.** Los avisos de incidencias, ventas
  caídas y llamadas acordadas van en una línea propia al inicio del
  contenido, no flotando sobre él.

## 3. Fuera de alcance

- La ficha del caso (`/recovery/campaigns/[caseId]`) y «Mi agenda»: son la
  siguiente pasada.
- El historial conserva su tabla de solo lectura.

## 4. Criterios de aceptación

- **AC-001** — Un mismo caso muestra el mismo plazo y la misma frase en «Mi
  día» y en la cola.
- **AC-002** — «Historial» muestra su cifra real desde «Trabajar ahora».
- **AC-003** — En el celular (375 px) cada fila muestra cliente, teléfono,
  frase y «Registrar gestión» sin desplazamiento lateral.
- **AC-004** — «Guardar y siguiente», las flechas entre filas, «Ver datos» y
  la marca «Lo acabas de ver» siguen funcionando.
- **AC-005** — Ningún aviso flotante tapa contenido.
