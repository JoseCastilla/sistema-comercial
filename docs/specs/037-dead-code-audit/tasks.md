# Tasks — SPEC-037

Pendiente de programar. El inventario se completa durante la auditoría; lo de
abajo es el punto de partida, no la lista final.

## Barrido

- [x] Rutas que solo redirigen, contrastadas con quién las enlaza
      (`tools/external-preview`, 31/08/2026).
- [x] Componentes y funciones exportadas sin importadores (06/09/2026):
      retirados `domain-schemas.ts` completo (8 esquemas), seis `parse*` de
      GHL y DITO sin consumidor, `calculateAcceleratorOne` y doce tipos
      `…Input`; conservadas con motivo cinco reglas (ver verificación).
- [x] Columnas y tablas sin lectura ni escritura, cruzadas con sus specs
      (06/09/2026): `mobile_debt_*` (SPEC-046 BR-005) y
      `dito_orders.match_status` con su tipo `DitoMatchStatus`.
- [x] Valores de enumeración nunca escritos, separando los reservados
      (BR-003): `DitoMatchStatus` retirado por duplicado; el resto se
      conserva porque sus specs los nombran.
- [ ] Dependencias declaradas y no importadas.
- [x] Specs que describen comportamiento que ya no existe (higiene
      documental del 06/09/2026).
- [x] Helpers duplicados unificados (06/09/2026): `readText` (8),
      `readPassword` (2), UUID (3, con la regex que rechazaba v6–v8),
      `firstValue` (6), `readApiError` (2), `toMetricInput` (2) y doce
      `Intl.DateTimeFormat` idénticos en `@repo/ui/format`.
- [x] Restricciones `NOT VALID` de agosto validadas por migración tolerante
      (06/09/2026).

## Hallazgos ya confirmados

- [x] Retirada `apps/web/src/app/tools/external-preview/` el 31/08/2026:
      solo redirigia a `/tools/lines` y ninguna referencia la enlazaba.
- [x] Verificado el 06/09/2026: del prototipo `prospecting` no queda código
      fuente; solo aparecía en un `dist` generado y no versionado de
      `packages/database`, que se regenera al compilar.

## Higiene documental (06/09/2026, punto 6 del método)

- [x] Vocabulario cerrado de estados y un solo campo (`docs/specs/README.md`);
      estado en la tercera línea de las 46 `spec.md`; `verification.md` ya no
      lleva estado.
- [x] Estados falsos corregidos (015, 016, 018, 019, 030, 032, 033, 036, 038,
      041) y nueve specs que no lo tenían (020–027, 031); 017 y 027 marcadas
      como sustituidas; 026 como spec de dominio.
- [x] Tres redacciones muertas sobre el importe del supervisor anotadas o
      corregidas (014 BR-011, 034 BR-006/AC-005, 038 BR-016).
- [x] Semana comercial: SPEC-022 corregida a la definición de SPEC-005, que es
      la del código.
- [x] Reglas pisadas anotadas en su sitio: 010 BR-003, 011 BR-005, 016 BR-002,
      027 «por recuperar», 005 BR-013, 030 AC-021, 038 BR-009, 039 BR-005 y
      `.ui-data`; matriz de permisos de 001 §10 completada.
- [x] SPEC-039 con plan, tareas y verificación; SPEC-037 con plan y
      verificación.
- [ ] Partir SPEC-030 por fases (1 102 líneas, 95 reglas): pendiente, por
      volumen.
- [ ] Reducir los glosarios repetidos a citas (períodos → 005; embudo → 014;
      recupero → 026; interacción → 039): pendiente.

## Cierre

- [x] Listar lo conservado a propósito con su motivo (AC-004): en
      `verification.md`.
- [x] Tipos, lint y pruebas en verde tras cada retiro.
