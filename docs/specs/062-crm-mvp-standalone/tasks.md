# Tasks — SPEC-062

Una casilla se marca solo con evidencia en `verification.md`.

## Base

- [x] Configuración de `apps/crm` (Next 16, Prisma 7, Better Auth, Tailwind,
      Vitest) y base `crm_local` con migración inicial (12/09/2026).
- [x] Auth, acceso por rol, cascarón, `/setup`, login, usuarios, ajustes.
- [x] Núcleo de mensajería (`store.ts`, `windows.ts`, `conversation-state.ts`)
      y contrato de plantillas (`templates/send.ts`, `render.ts`) con pruebas.
- [x] Registro de bucles y emisor de eventos.

## Ola 1

- [x] Meta: cliente Graph, webhook firmado e idempotente, bucle de envío,
      conexión manual y Embedded Signup, plantillas.
- [x] Bandeja: lista, chat, ficha, quién responde, SSE.
- [x] Embudo, pedidos y resultados.
- [x] Calendario y cupos.
- [x] Flujos: catálogo, motor, editor, ejecuciones.

## Ola 2

- [x] Agente de IA: configuración, conocimiento, herramientas, pruebas,
      simulador, publicación, respuesta en vivo.
- [x] Difusiones: segmentos, exclusiones, envío escalonado, resultados.

## Cierre

- [x] Tipos, lint y pruebas de `apps/crm` en verde (AC-016).
- [x] Recorrido en navegador y webhook con firma (AC-001 a AC-015 según
      alcance verificable sin credenciales).
- [x] Base reiniciada para el setup real de José.

## Pendiente (requiere credenciales o decisión de José)

- [ ] Setup real (`/setup`) con la empresa y el dueño.
- [ ] `META_APP_ID/SECRET/CONFIG_ID` y conexión del número; prueba de envío,
      adjuntos, plantillas y Embedded Signup.
- [ ] `ANTHROPIC_API_KEY`: simulador, pruebas y turno en vivo del agente.
- [ ] Botones en la bandeja para «marcar respuesta incorrecta» y «guardar
      como ejemplo» (las acciones ya existen en el módulo de agentes).
- [ ] Columnas sugeridas por los módulos: `BroadcastRecipient.scheduledFor`,
      `Message.pricingCategory/billable`, versiones de plantilla,
      `AiTurn.organizationId`, `AiAgent.budgetWarnedAt`, tabla de zonas de
      reparto.
