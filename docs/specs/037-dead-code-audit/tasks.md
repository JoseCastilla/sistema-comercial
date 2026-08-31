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

## Cierre

- [ ] Listar lo conservado a propósito con su motivo (AC-004).
- [ ] Tipos, lint y pruebas en verde tras cada retiro.
