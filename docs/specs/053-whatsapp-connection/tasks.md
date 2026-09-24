# Tasks — SPEC-053

Una casilla se marca solo con evidencia en `verification.md`.

## Definición

- [x] `spec.md` con BR-001 a BR-022, decisiones y AC-001 a AC-010 (12/09/2026).
- [x] `plan.md` con modelo, reglas puras y fases.
- [ ] José confirma o corrige las decisiones de §5.
- [ ] Verificar si `Contact.documentNumberNormalized` admite nulo.

## Fase 1 — Motor y reglas

- [ ] Esquema `messaging.prisma` y migración.
- [ ] Reglas puras con pruebas: ventanas, estados, consentimiento, unión de
      contactos, clasificación de errores.
- [ ] Módulo `meta`: cliente Graph API, firma, cifrado de token.
- [ ] Webhook de verificación y recepción con idempotencia.
- [ ] Procesador: mensajes, estados, `referral`, calidad, límites,
      `user_preferences`.

## Fase 2 — Salida y archivos

- [ ] Outbox y bucle del worker con reintentos clasificados.
- [ ] Almacenamiento de objetos en EasyPanel y cliente S3.
- [ ] Descarga de media entrante con huella.

## Fase 3 — Integración y prueba mínima

- [ ] `/admin/integrations/whatsapp`: conectar, estado, alertas.
- [ ] Vista mínima de ida y vuelta.

## Fase 4 — Ficha única

- [ ] Vínculos con DITO, Campañas y DNI (confirmado/probable).
- [ ] Unión manual de duplicados, auditada y reversible.

## Fase 5 — Embedded Signup v4

- [ ] Pendiente de Tech Provider.
