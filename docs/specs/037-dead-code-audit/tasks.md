# Tasks — SPEC-037

Pendiente de programar. El inventario se completa durante la auditoría; lo de
abajo es el punto de partida, no la lista final.

## Barrido

- [ ] Rutas que solo redirigen, contrastadas con quién las enlaza.
- [ ] Componentes y funciones exportadas sin importadores.
- [ ] Columnas y tablas sin lectura ni escritura, cruzadas con sus specs.
- [ ] Valores de enumeración nunca escritos, separando los reservados (BR-003).
- [ ] Dependencias declaradas y no importadas.
- [ ] Specs que describen comportamiento que ya no existe.

## Hallazgos ya confirmados

- [x] Retirada `apps/web/src/app/tools/external-preview/` el 31/08/2026:
      solo redirigia a `/tools/lines` y ninguna referencia la enlazaba.
- [ ] Verificar si quedó código del prototipo `prospecting` descartado; sus
      tablas ya se eliminaron de la base local.

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

- [ ] Listar lo conservado a propósito con su motivo (AC-004).
- [ ] Tipos, lint y pruebas en verde tras cada retiro.
