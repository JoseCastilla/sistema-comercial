# SPEC-087 — Plan

- `features/agr-delivery/consultation.ts`: regla pura `needsAgrConsultation`
  y orden `pickAgrConsultations`, con el tope de 250.
- Sincronización: la base descarta cerradas, entregadas, abiertas y lo que
  Máximo ya terminó; la regla pura decide las canceladas y el orden.
- Sin migración: usa la tabla de SPEC-086 para saber qué no está en Máximo.
