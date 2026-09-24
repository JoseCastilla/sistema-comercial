# Auditoría integral de la plataforma — 24/09/2026

Estado de `main`: `0d30275`. Árbol de trabajo con 33 cambios sin publicar
(retiro de «Checa tus líneas», `apps/crm/`, specs 051–062, SQL de operación).

Alcance: construcción (código, datos, infraestructura, documentación),
funcionamiento (pruebas, tipos, lint, recorrido en local y en producción con
sesión de administrador, solo lectura) y experiencia de uso (visual, navegación,
lenguaje, accesibilidad). Continúa la revisión del 05/09
(`2026-09-05-integridad-plataforma.md`): cada hallazgo de entonces tiene su
estado actual en §3. Cada afirmación se contrastó con archivo y línea o con la
pantalla en producción.

## 1. Veredicto

El producto funciona y está bien construido en lo que más importa: aislamiento
por organización en todas las consultas nuevas, las 40 acciones de servidor
comprueban rol, fechas en `timestamptz` y cálculo en hora de Lima sin una sola
fuga, idempotencia en las cuatro puertas, evidencia de solo añadir. Pruebas en
verde: web 218, validation 372, tipos y lint limpios.

Lo que falla ya no es el diseño, es el **último metro**: servicios escritos que
no están desplegados (worker, copias), acciones que escriben sin verificar el
estado que leyeron, un script de entrega que publica todo lo que haya en disco, y
una interfaz que acumuló siete barras de filtro, tres tipos de botón y jerga en
las pantallas del asesor. Desde el 05/09 se entregaron 14 incrementos de
Campañas y Rendimiento; la consolidación siguió por detrás, y los archivos grandes
crecieron (`performance-dashboard.tsx` pasó de 1 785 a 2 422 líneas).

## 2. Lo que se ve hoy en producción (24/09, 11:20)

- **316 recuperos vencidos** en el aviso flotante de toda pantalla, 318 casos
  de recupero abiertos y 409 pedidos por recuperar. Un aviso que siempre marca
  cientos deja de leerse.
- **Campañas:** 1 879 casos asignados, 0 trabajados hoy, 65 citas vencidas. Si
  la base es táctica está bien, pero entonces 1 879 casos asignados sin toque
  son cartera muerta que debería volver al pool o cerrarse.
- **«Checa tus líneas»** sigue en el menú: SPEC-051 está `ENTREGADA` pero el
  retiro solo existe en el árbol local.
- Dos equipos sin supervisor (AYACUCHO - EXTERNOS con cuota 0/0).

## 3. Estado de la revisión del 05/09

| # | Tema | Hoy |
|---|---|---|
| 1 | Copias de seguridad | **Parcial.** Código en `infra/backup/` y `scripts/restaurar-copia.sh` (con guarda contra la base real); **servicio no creado en EasyPanel** (SPEC-046 `tasks.md:21-24`); copias en el mismo servidor; un fallo solo escribe en el log. |
| 2 | Proceso de fondo | **Parcial.** `apps/worker` llama cada 5 min a web y api con secreto y exclusión mutua (`worker.service.ts:58-83`); **no desplegado**. Las páginas siguen ejecutando mantenimiento al abrirse (`orders/page.tsx:63-67`, `recovery/campaigns/page.tsx:109`, `admin/recovery-base/page.tsx:117`, `distribute:79`, `follow-up:137`, `triage:78`). |
| 3 | Webhooks fallidos | **Corregido solo para GHL** (`webhook-events.repository.ts:195-209`); depende del worker. DITO sigue sin reintento (ver A2). |
| 4 | Tablas `mobile_debt_*` | Corregido. |
| 5 | Restricciones `NOT VALID` | **Parcial.** Quedan `dito_orders_delivery_window_order_check` y `dito_import_batches_nonnegative_counts_check`; la migración de validación solo emite `WARNING` si falla. |
| 6 | Login | **Parcial.** Límite explícito (`auth.ts:58-78`); sin MFA. |
| 7 | Script que borra órdenes | **Abierto.** `test-orphan-claim-concurrency.mjs` usa el primer asesor real y borra en la base de `DATABASE_URL` sin guarda. |
| 8 | `.env.example` / turbo | Corregido. |
| 9 | Webhook n8n sin token | **Abierto** (`popup.js:140-145`). |
| 10 | Menores | **Parcial.** api y worker como root y una sola etapa; `proxy.ts:16` solo cubre `/orders`; `prod_para_local.sql` ya ignorado. |
| 11–17 | Documentación | Vocabulario de estado cerrado en la línea 3 de las 62 specs; semana comercial resuelta; 037 y 039 con plan. Quedan estados sueltos en `tasks.md`/`verification.md` y specs `VERIFICADA` cuya verificación dice que falta algo (019, 032, 038, 040, 042). |
| 18 | Barras de filtro | **Abierto.** 4 barras en vivo (1 332 líneas) + 3 formularios con «Aplicar»/«Ir». |
| 19 | Idioma de la URL | **Abierto y peor:** la ficha de Campañas mezcla `view, fecha, q, age, tipo, estado, cita` en una misma URL. |
| 20 | Helpers duplicados | Parcial: quedan 24 `Intl.DateTimeFormat` locales. |
| 21 | Regex UUID | Corregido. |
| 22 | Exportaciones muertas | Parcial. |
| 23 | Archivos «dios» | **Peor:** `performance-dashboard.tsx` 2 422, `get-order-inbox.ts` 1 680, `order-inbox.tsx` 1 663, `get-performance-dashboard.ts` 1 390. |
| 24 | Pruebas de acciones | **Peor de lo informado:** 47 acciones, ninguna ejecutada en una prueba (las 9 que aparecen están con `vi.mock`). |
| 25 | SSE sin filtro por rol | **Abierto** (`api/orders/stream/route.ts:205-232`). |
| 26 | Consultas sin techo | Parcial: tablero de recupero 6 `findMany` sin `take`; `get-performance-dashboard.ts:802-878` pasó a 5 lecturas de pedidos sin techo. |
| 27 | Accesibilidad | Abierto (ver §6). |
| 28 | `/team` sin layout | **Abierto.** |

## 4. Hallazgos nuevos — construcción y funcionamiento

### Urgente

**U1. `scripts/entregar.sh:92` publica todo lo que haya en disco.** Hace
`git add -A`. Hoy eso subiría a `main` —que despliega— `apps/crm/`, doce specs en
borrador y `comprobar-`/`contraste-filtro-rapido-2026-09-07.sql` con ~5 400
teléfonos reales cada uno. Además no corre `build`, `--sin-verificar` se salta
todo, no hay CI y nadie comprueba la salud tras publicar. **Arreglo:** abortar si
hay archivos sin trackear fuera de la lista del cambio (o recibir rutas
explícitas), añadir `pnpm build` y esperar `/api/health` tras el push. Mover las
listas de números a una carpeta ignorada.

### Alto

**A1. El recorrido AGR puede dejar de consultar los pedidos nuevos**
(`agr-delivery-sync.ts:262-276`, `orderBy registeredAt asc`, `take 250`). Un
pedido que AGR no devuelve no guarda nada y sigue siendo candidato; cuando se
acumulen 250 así, cada corrida consulta siempre los mismos y termina en
`COMPLETED`. Pendiente desde el 23/08. **Arreglo:** registrar la fecha de última
consulta aunque no haya resultado y ordenar por ella.

**A2. Ventas DITO rechazadas por la API se pierden.** En n8n la rama de error del
nodo «Enviar orden DITO a Sistema Comercial» termina en un nodo vacío; el
reintento de SPEC-046 solo cubre GHL. La venta queda en la hoja y no en el
sistema: sin seguimiento ni comisión.

**A3. `apps/crm` puede vaciar la base del sistema.** `db:reset` es
`prisma migrate reset --force` sobre `DATABASE_URL` (`apps/crm/package.json:16`,
`prisma.config.ts:7`), el mismo nombre que usa el sistema; `dotenv` no pisa una
variable ya exportada. **Arreglo:** `CRM_DATABASE_URL` y guarda por nombre de base.

**A4. La base nacional puede abrir dos casos del mismo cliente**
(`recovery-base-confirmation.service.ts:65-78, 224-231`): paso a `CONFIRMING`
sin condición de estado y `findFirst` + `create` sin índice único. Un doble clic
o un reintento hace que dos asesores llamen al mismo cliente. **Arreglo:**
contar duplicados en producción; índice único parcial
`(organization_id, document_number) WHERE source='NATIONAL_BASE' AND status abierto`.

**A5. El script de corrección de horas se puede ejecutar dos veces**
(`docs/operacion/consultas/corregir-horas-agendadas-2026-09-08.sql:121`): suma 5
horas a todos los intentos AGENDA anteriores al corte, sin guarda de segunda
ejecución y sin evento para parte de las filas. **Arreglo:** abortar si ya existe
`NEXT_ACTION_CORRECTED` y moverlo a un histórico.

### Medio

- **M1. El reparto sobrescribe sin mirar el estado**
  (`distribute-recovery-cases-action.ts:305, 376, 510`): `updateMany` solo por
  `id`. Si el asesor agenda mientras el supervisor reparte, el caso vuelve a
  `ASSIGNED` con otro asesor y se lleva la cita. Repetir en el `where` el estado y
  el responsable leídos y comparar `count`, como ya hace
  `take-recovery-pool-block-action.ts:146`.
- **M2. Tipificar y resolver a la vez deja estados imposibles**
  (`register-recovery-attempt-action.ts:465`, `resolve-recovery-case-action.ts:168`,
  `cancel-`/`reschedule-commitment-action.ts`): `update` por `id` sin exigir caso
  abierto; queda `IN_PROGRESS` con `resolvedAt`.
- **M3. El tablero de Campañas ignora las rectificaciones**
  (`board/page.tsx:210-217, 275`); Seguimiento y agenda sí usan el resultado
  efectivo. Incumple SPEC-049 BR-017.
- **M4. Volver de la ficha pierde vista y antigüedad**
  (`[caseId]/page.tsx:37-66`): el asesor en «En espera» vuelve a «Ahora».
- **M5. Eventos GHL atascados en `PROCESSING`** si la API se reinicia a mitad
  (`webhook-events.repository.ts:159-161, 224`); el reenvío de n8n recibe
  `IGNORED_DUPLICATE`. Reclamar los que lleven más de 10 min.
- **M6. Sin observabilidad:** ni Sentry ni alertas; el worker y las copias
  mueren en silencio. Un latido (Healthchecks/Uptime Kuma) por pasada y por copia.
- **M7. El worker cuenta como «ok» una sincronización AGR que falló**
  (`agr-delivery-sync.ts:217-227`, `.catch(() => null)`); tragar solo P2002.
- **M8. Consulta DNI sin cupo por asesor** (`lookup-dni-action.ts:23`): gasta
  créditos y expone datos de RENIEC sin freno.
- **M9. Índices faltantes:** `dito_orders (organization_id,
  holder_document_number, registered_at DESC)` para las fichas de caso;
  `recovery_cases (organization_id, resolved_at)` parcial y
  `(organization_id, created_at)` para el tablero.
- **M10. Evidencia protegida solo por convención:** intentos, eventos,
  historiales y AGR cuelgan con `Cascade` del padre; un `DELETE` manual en DbGate
  borra la evidencia. `Restrict` + trigger que exija
  `SET LOCAL app.evidence_correction='on'`.
- **M11. Sin retención:** `webhook_events.payload`, `recovery_base_records.raw_data`
  (incluidas filas excluidas), sesiones vencidas. Crecen sin límite.
- **M12. Adjuntos del CRM** (`apps/crm/.../api/media/[...path]/route.ts:11-21`):
  tipo de contenido tomado de `?type=`, sin `nosniff` ni organización; un HTML
  enviado por WhatsApp se ejecuta con la sesión del asesor.

### Bajo

Clave duplicada (P2002) sin capturar en la ficha
(`register-recovery-attempt-action.ts:519`); cierres automáticos que no cancelan
la cita pendiente (`open-internal-recovery-case.ts:237`,
`expire-unverified-cases.ts:41`); notificaciones que convierten una base caída en
401 con `count: 0` (`order-escalations/notifications/route.ts:376`); `/setup`
del CRM reclamable por quien llegue primero; enums y columnas `@ignore` sin
retirar; búsquedas `contains` sobre 13 columnas sin `pg_trgm`; ~340 teléfonos
reales ya versionados en `buscar-lista-de-numeros.sql`.

## 5. Documentación

- 324 tareas sin marcar; 21 validaciones que nunca se cerraron (la mayoría
  esperan **una cuenta de asesor de prueba o una sesión de supervisor**: 042,
  043, 044, 048, 049, 019, 029…). Crear esas cuentas ficticias cierra de golpe la
  mitad.
- **SPEC-062 `ENTREGADA` es un estado imposible:** `apps/crm/` no está en git, y
  sus decisiones contradicen las recomendaciones de 052–061 (base propia frente a
  ampliar `Contact`, tareas en Next frente al worker, disco local frente a S3,
  rol `OWNER`). El programa CRM acumula **59 decisiones pendientes**.
- SPEC-051, 036 (`SUSTITUIDA`) y 045 BR-011 declaran cambios que solo existen en
  el árbol local. SPEC-048 está `ENTREGADA` con decisiones no confirmadas.
- Restos de redacción: `034/plan.md:19-20` y `044/spec.md:161-166` (importes del
  supervisor), `044/spec.md:92` frente a `047/spec.md:65` (orden por defecto de
  Rendimiento), `053/spec.md:171` da por desplegado un worker que no lo está.

## 6. Experiencia de uso — visual, navegación, lenguaje

Base sólida: todo pasa por tokens (un solo hex literal en `.tsx`), formularios
con `<label>`, modo oscuro coherente. Los problemas son de duplicación y de
pequeños fallos que el asesor sufre todo el día.

### Defectos visibles (confirmados en producción)

1. **El menú lateral se solapa**: «Personas» encima de «Equipos» y «Checa tus
   líneas» encima de «Recupero de ventas». Cada ítem mide 48 px y su contenido
   62 px cuando la descripción ocupa dos líneas; el contenedor flexible los
   encoge (`packages/ui/src/styles/shell.css:113`). Arreglo: `flex-shrink: 0`.
2. **«Setiembre De 2026»**: `text-transform: capitalize` en
   `patterns.css:56, 114, 407` pone en mayúscula el «de». Capitalizar solo la
   primera letra en el formateador.
3. **La bandeja de pedidos se corta a 1 316 px** (portátil típico): la lista y la
   ficha lado a lado recortan nombre y código («FERNANDA NIK…», «19652118…»),
   «OPERADOR» y «ASESOR» se pegan, y 9 pestañas desbordan sin indicador
   («Finalizados» y «Todos» quedan ocultos).
4. **Aviso flotante permanente** «316 recupero(s) vencido(s)» fijo arriba a la
   derecha, tapando la cabecera; `role="status"` sobre un enlace; iconos emoji.
5. **Resumen por equipo de Rendimiento** encajado en dos tercios de ancho: 10
   columnas en 644 px con desplazamiento horizontal dentro de desplazamiento
   vertical.
6. **Consulta DNI**: el campo para consultar está al final, debajo del saldo y de
   seis tarjetas de estadísticas. La acción principal debe ir arriba.
7. **Tarjetas de indicadores con párrafos**: «768 portabilidades y 69 altas
   nuevas · 837 frente a 521… (+34.8%) · esa cohorte terminó con 650 · ver en
   Pedidos». Una cifra, una comparación; el resto al detalle.
8. **Recupero de ventas**: seis tarjetas y ocho filtros antes de la primera fila
   de la cola.
9. **El administrador entra a «Mi cola de campaña»** con el mensaje «Sin equipo
   vendedor»: una pantalla vacía como destino del menú.
10. Móvil: 10 ítems en dos filas en la barra inferior (etiquetas de 10 px) y
    título «Sistema Co…» cortado.

### Defectos de uso (código)

- **Esc borra lo escrito** en la gestión en fila de Campañas: se procesa antes
  de mirar si el foco está en la observación y descarta sin confirmar
  (`campaign-attempt-editor.tsx:271-275`).
- **`/team` sin menú ni cerrar sesión** (no hay `layout.tsx`).
- **Menú contraído sin «Cerrar sesión»** (`shell.css:390-391`), y contraído es
  el estado inicial del asesor: en PCs compartidas del call center importa.
- **El supervisor que vende no tiene entrada a su cola** (`campaign-nav.tsx`).
- **Todos entran a `/orders`**, aunque el trabajo del asesor está en Campañas.
- **Sin `not-found.tsx`**: el 404 sale en inglés y sin menú; `/access-denied`
  no tiene salida.
- **En Mi cola la columna fija es «Observación», no «Cliente»**: al desplazar
  en horizontal se pierde de quién es la fila.
- **Mi cola y Mi agenda filtran con componentes distintos** (una en vivo, otra
  con «Ir»); Cuotas y Conciliación piden «Aplicar» mientras Rendimiento filtra en
  vivo.
- **Confirmaciones**: tres mecanismos; resolver un caso como perdido y dar de
  baja a una persona no piden confirmación.

### Lenguaje

- Jerga ante el asesor: «pool», «el cruce», «Caso de base nacional», «orden
  DITO», «Ubigeo RENIEC/INEI/SUNAT», «según Máximo», «Back office».
- **«Operador» significa dos cosas en la misma pantalla**: la empresa de
  telefonía de origen y el courier.
- Un concepto, varios nombres: asesor / agente / vendedor; pedido / orden.
- 27 plurales con paréntesis: «recupero(s) vencido(s)», «caso(s)».

### Accesibilidad

- Contraste en oscuro de 2,1–2,5:1 en 11 botones con `text-white` sobre acento o
  peligro; el token `--ui-on-accent` existe y no se usa.
- Foco apenas visible (sombra azul al 20 %).
- La bandeja de pedidos es de `div` sin semántica de tabla y solo responde al
  ratón; 25 tablas sin `<caption>`, 14 de 159 `<th>` con `scope`; definiciones
  de columnas solo en `title`.
- «Ver datos» mide 22 px; 26 usos del tamaño de 10 px pese al mínimo de 11 px de
  SPEC-039.

## 7. Oportunidades, en orden de retorno

**Esta semana (horas, riesgo inmediato)**

1. Blindar `entregar.sh` (U1) y sacar del árbol los SQL con teléfonos.
2. Crear en EasyPanel el **worker** y las **copias de seguridad**, con un
   latido externo; probar una restauración. Todo el código ya existe.
3. Las cinco correcciones visuales de una línea: `flex-shrink: 0` del menú,
   mayúscula del mes, `layout.tsx` de `/team`, Esc que respeta los campos de
   texto, «Cerrar sesión» visible con el menú contraído.
4. Guarda de segunda ejecución en el script de horas (A5) y en el script de
   concurrencia (§3 punto 7); `CRM_DATABASE_URL` (A3).

**Próximo incremento (días)**

5. **Escrituras condicionadas** en reparto, tipificación, resolución y citas
   (M1, M2, B) con `updateMany` + estado leído + `count`, y sus primeras pruebas
   de integración contra una base de prueba con cuentas ficticias (AGENT,
   SUPERVISOR, supervisor vendedor, ADMIN). Esas mismas cuentas cierran las
   validaciones pendientes de ocho specs.
6. Índice único de caso abierto por cliente en la base nacional (A4), tras
   contar duplicados; índices M9.
7. Recorrido AGR por fecha de última consulta (A1) y rama de error de DITO en n8n
   que registre y avise (A2).
8. **Pantalla de inicio por rol**: asesor a Campañas, supervisor a Rendimiento;
   «Mi cola» para el supervisor que vende; `not-found.tsx` y salida en
   `access-denied`.
9. **Avisos que se pueden leer**: el flotante pasa a la cabecera y muestra lo
   del día («12 vencieron hoy»), no el acumulado; los 1 879 casos de Campañas sin
   toque vuelven al pool según BR-077 una vez que el worker corra.

**Consolidación (una o dos semanas)**

10. **Una sola barra de filtros** (`useLiveFilters`) y un solo idioma en la URL
    (español, que es el de la interfaz); llevarla a Mi agenda, Cuotas y
    Conciliación.
11. **Glosario de interfaz** en SPEC-039 y una pasada de texto: asesor, pedido,
    «operador de origen» frente a «courier», «casos libres del equipo» por
    «pool», plurales sin paréntesis.
12. **Una sola familia de componentes**: `Button` de `@repo/ui` (arregla el
    contraste en oscuro), `ConfirmSubmitButton` para todo lo irreversible,
    `InlineFeedback` para los mensajes, `Card` para los 67 contenedores a mano.
13. **Bandeja de pedidos responsive**: ficha en panel superpuesto por debajo de
    1 440 px, pestañas con desplazamiento visible o agrupadas («Por gestionar» /
    «Cerrados»), tabla con semántica y teclado.
14. **Tarjetas de indicadores con una cifra y una comparación**; la explicación
    en un `<details>` «Cómo se calcula». Consulta DNI con el campo arriba.
15. Partir `performance-dashboard.tsx` y `get-order-inbox.ts` por
    responsabilidad, con techos (`take`) en los tableros.

**Decisiones de José**

- El programa CRM: o SPEC-062 se reconoce como experimento separado (y 052–061
  se reescriben sobre lo aprendido), o el MVP se alinea con ellas. Hoy conviven
  59 decisiones abiertas con un MVP que contradice varias.
- Qué hacer con los 1 879 casos asignados de Campañas sin actividad.
- Cupo diario de Consulta DNI por asesor.
- MFA para ADMIN y BACKOFFICE.
