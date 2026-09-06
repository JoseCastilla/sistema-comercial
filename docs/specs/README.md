# Especificaciones — cómo se leen y cómo se mantienen

Cada incremento vive en `NNN-slug/` con cuatro artefactos: `spec.md`
(problema, reglas BR-xxx, criterios AC-xxx), `plan.md`, `tasks.md` (casillas
con estado real) y `verification.md` (evidencia). Una tarea se marca solo con
evidencia; una spec cambia de estado solo con lo que dice su verificación.

## Un solo estado, en un solo lugar

El estado vive en la **tercera línea de `spec.md`**, con esta forma:

```
**Estado:** `VERIFICADA` — nota breve (dd/mm/aaaa)
```

`verification.md` no lleva estado: describe evidencia. Hasta el 06/09/2026
existían dos campos de estado que divergían en diez specs y nueve specs sin
estado; esta regla los unifica.

## Vocabulario cerrado

| Estado | Significa | Equivalencias antiguas |
|---|---|---|
| `BORRADOR` | Escrita, sin aprobar ni construir; puede tener decisiones abiertas. | `DRAFT`, `DISCOVERY`, `PLANNED` |
| `APROBADA` | Aprobada por José, sin construcción iniciada. | `APPROVED` |
| `EN_CURSO` | Construcción iniciada, entrega incompleta. | `IN_PROGRESS` |
| `ENTREGADA` | En `main` y desplegada; verificación en producción no registrada o parcial. | `IMPLEMENTED`, `IMPLEMENTED_LOCAL`, `DEPLOYED`, `READY_FOR_VALIDATION`, `READY_FOR_USER_VALIDATION`, `IMPLEMENTED_PENDING_PRODUCTION`, `LOCAL_CONFIRMATION_VALIDATED` |
| `VERIFICADA` | Entregada y con lectura de producción (o validación de usuario) registrada en `verification.md`. | `VERIFIED` |
| `SUSTITUIDA` | Reemplazada por otra spec que se nombra en la nota; se conserva como historia. | — |
| `DOMINIO` | Spec de reglas sin entrega propia; su motor vive en otra spec. | — |

Una spec `ENTREGADA` con tareas abiertas lo dice en la nota. Una regla que
otra spec sustituye no se borra: se anota «sustituida por SPEC-NNN BR-xxx»
junto a la regla original, para que quien la lea primero no se lleve la
versión vieja.

## Dónde vive cada regla transversal

Para no redactar la misma regla en varias specs (deriva documental), la
fuente única es:

- **Permisos por rol y alcance** — SPEC-001 §10 (matriz), con el supervisor
  vendedor de SPEC-019 y los casos de recupero de SPEC-030.
- **Períodos y cohortes en Lima** — SPEC-005 (día, semana que no cruza de
  mes, mes; intervalos `[inicio, fin)`).
- **Glosario del embudo** (ingresada, entregada, activada, pagable, por
  activar, confirmada, alta nueva) — SPEC-014 § Glosario canónico, ampliado
  por SPEC-038 (confirmada) y SPEC-044 BR-002 (por activar).
- **Economía y visibilidad de importes** — SPEC-033 (tarifas centralizadas) y
  SPEC-014 BR-019 (el supervisor ve el importe individual; BACKOFFICE no ve
  montos).
- **Recupero de ventas: prioridades, cadencia, antifraude** — SPEC-026.
- **Patrones de interacción** (filtros en vivo con estado en la URL, «cada
  cifra abre lo que cuenta») — SPEC-039.

## Revisiones

Las revisiones transversales viven en `docs/revisiones/`. La del 05/09/2026
es el origen de esta guía.
