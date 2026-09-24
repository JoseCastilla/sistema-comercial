# Plan — SPEC-062

## Estructura de `apps/crm`

- `prisma/schema.prisma` — contrato de datos del MVP (organización y roles,
  WhatsApp, contactos y consentimiento, conversaciones y mensajes con outbox,
  oportunidades y pedidos, calendario, agente de IA, flujos, difusiones).
- `src/server/` — `auth/` (Better Auth y acceso por rol), `messaging/`
  (persistencia de mensajes, ventanas, quién responde, reparto), `templates/`
  (render y envío), `meta/` (Graph API, webhook, envío), `inbox/`,
  `opportunities/`, `orders/`, `calendar/`, `ai/`, `workflows/`,
  `broadcasts/`, `events/bus.ts` (emisor en proceso) y `background/`
  (registro de bucles).
- `src/app/(app)/` — secciones autenticadas bajo un cascarón común; `/setup`
  y `/login` fuera del cascarón; `src/app/api/` — auth, webhooks de Meta,
  SSE, media, presencia, salud.
- `src/instrumentation.ts` — arranca los bucles al iniciar el proceso.

## Fases

1. **Base (hecha por el asistente):** configuración, esquema y migración,
   cliente de base, cifrado, auth, cascarón, `/setup`, login, usuarios,
   ajustes (empresa, catálogo, cupos, respuestas rápidas), núcleo de
   mensajería y contrato de plantillas.
2. **Ola 1 (cinco módulos en paralelo):** Meta/WhatsApp + plantillas, bandeja,
   embudo + pedidos + resultados, calendario, flujos.
3. **Ola 2:** agente de IA (usa calendario, catálogo, oportunidades) y
   difusiones (usa plantillas y outbox).
4. **Integración y verificación:** tipos, lint y pruebas de toda la app;
   recorrido en el navegador con cuenta de prueba; webhook con firma; reinicio
   de la base para que José haga el setup real.

## Acople posterior (fuera de esta spec)

`Order` → `DitoOrder`; `OrganizationMember` → equipos de SPEC-001; emisor en
proceso → `LISTEN/NOTIFY`; bucles → `apps/worker`; `storage/` → objetos S3.
