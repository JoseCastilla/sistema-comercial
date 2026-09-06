# SPEC-037 — Verificación

## Higiene documental (06/09/2026)

- Inventario previo: `docs/revisiones/2026-09-05-integridad-plataforma.md`
  §3.2 (hallazgos 11 a 17) y el informe de coherencia de specs que lo
  alimentó.
- Después de la pasada: las 46 `spec.md` llevan `**Estado:**` con uno de los
  siete valores del vocabulario en su tercera línea (comprobado con
  `grep -c` sobre `docs/specs/*/spec.md`); ningún `verification.md` conserva
  un campo de estado propio; SPEC-037 y SPEC-039 tienen los cuatro
  artefactos.
- Las correcciones de reglas se hicieron anotando junto a la regla original
  («sustituida por…», «corregida el 06/09/2026…») para no borrar historia.
- Entrega como cambio solo de documentación, sin código.

## Código y base de datos (06/09/2026)

**Retirado** (búsqueda de referencias en `apps/*` y `packages/*` sin
resultados fuera de su definición):

- `packages/validation/src/domain-schemas.ts` completo: ocho esquemas zod
  (`organizationRoleSchema`, `carrierSchema`, …) nunca importados.
- `parseGhlIncomingSnapshot`, `safeParseGhlIncomingSnapshot`,
  `parseGhlWebhookEnvelope`, `parseDitoLegacyOrderEnvelope`,
  `safeParseDitoLegacyOrderEnvelope`, `parseDitoIncomingOrderEnvelope`: la
  API usa solo las variantes `safeParse…` de los sobres completos.
- `calculateAcceleratorOne` (compatibilidad de la primera ventana): las tres
  pruebas que lo usaban pasan por `calculateAccelerators(...)[0]`.
- Doce tipos `…Input` inferidos de esquemas sin ningún consumidor.
- Columna `dito_orders.match_status` (`legacyMatchStatus`, `@ignore` desde el
  09/08/2026) y tipo `DitoMatchStatus`, copia de `DitoCommercialLinkStatus`
  (migración `20260906120000_contract_legacy_match_status`).

**Conservado a propósito** (AC-004), con el motivo anotado en el código:

- `resolveCommercialContextAccess`, `canReassignDitoOrder`,
  `canResolveAutomaticDitoAssignment` (51 pruebas): reglas de las tareas de
  reasignación y solicitudes de SPEC-001, todavía abiertas.
- `isNoStatusIncident`: regla de SPEC-014 (10 minutos sin subestado); la
  bandeja aplica el mismo umbral por su cuenta.
- `isRecoveryConsultationExpired`: regla de SPEC-030 BR-084;
  `expire-unverified-cases` usa su constante.
- Tipos `DitoOrderAssignment*` de `commercial-team-rules`: cinco consumidores.
- Enums de Prisma nunca escritos distintos de `DitoMatchStatus`: sus specs los
  nombran como puertas reservadas (BR-003).

**Unificado**: `apps/web/src/server/forms/read-form.ts` (`readText`,
`readPassword`, `isUuid`, `readUuid` con versiones 1 a 8),
`apps/web/src/server/search-params.ts` (`firstValue`, `firstValueOrEmpty`),
`features/dito-imports/server/read-api-error.ts`,
`features/performance/server/order-metric-input.ts` y tres formateadores de
fecha en `@repo/ui/format` (`formatLimaDateTime`,
`formatLimaDateTimeWithYear`, `formatLimaMonth`) que sustituyen a doce
`Intl.DateTimeFormat` idénticos. Los formateadores con opciones propias (13)
siguen donde estaban.

**Restricciones**: migración `20260906121000_validate_august_checks` valida
las siete `CHECK` creadas `NOT VALID` en agosto dentro de un bloque `DO` que
avisa y sigue si alguna encuentra filas que la violan. En local, tras
aplicarla, `select conname from pg_constraint where not convalidated`
devuelve **cero filas** (antes: `commercial_team_members_primary_requires_
sales_check`).

**Pruebas**: `@repo/validation` 318 en verde (las de
`calculateAcceleratorOne` adaptadas); API 89 en verde con el paquete
recortado; web 196 en verde (3 nuevas, `formularios-lectura`: recorte,
contraseña sin recortar, UUID v7 aceptado, `firstValue`). Tipos y lint
limpios en web, API y worker.

**Recorrido local**: las diez páginas que consumen los helpers unificados (recupero, seguimiento, campañas, rendimiento, cuotas, conciliación de agosto, usuarios, equipos, pedidos e importaciones DITO) responden 200 sin errores con sesión de administrador; las fechas en hora de Lima se siguen mostrando (setiembre de 2026, agosto de 2026).

**Producción (06/09/2026, commit e8e2152)**: la API se reinició tres
minutos después de la entrega y `/api/v1/health/ready` volvió a responder 200
con la base arriba (las migraciones corren en el arranque; si alguna fallara
el contenedor no llega a «listo»). Con la sesión de administrador, en solo
lectura, responden 200 sin errores las mismas diez páginas del recorrido
local más Logística, «Mi equipo», el panel de una persona en Personas y la
ficha de un caso de recupero; las fechas en hora de Lima siguen iguales
(`09/26 12:44` en Pedidos, «setiembre de 2026» en Rendimiento). Los chunks
del cliente no cambiaron de nombre porque el cambio fue solo de servidor, así
que la fecha exacta del redespliegue de la web se infiere del de la API, no
de la propia web.

**Pendiente**: dependencias declaradas y no importadas en los `package.json`
(sin herramienta en el repositorio; se hará con `depcheck` en una pasada
aparte) y unificar las cuatro barras de filtro (SPEC-039).
