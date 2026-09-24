# CRM MVP aislado (SPEC-062)

Versión local del CRM de WhatsApp descrito en `docs/specs/052` a `061`. Vive
aislada del Sistema Comercial: base de datos propia (`crm_local`), sin
importar nada de `apps/web`, `apps/api` ni `packages/database`.

## Arrancar

```bash
cp apps/crm/.env.example apps/crm/.env   # y completa los valores
pnpm --filter crm db:migrate:deploy
pnpm --filter crm dev                     # http://localhost:3200
```

La primera vez abre `/setup` para crear la empresa y al dueño. No hay datos
de ejemplo.

## Convenciones (obligatorias para todo módulo)

- **Idioma:** código en inglés, textos de interfaz y comentarios en español,
  lenguaje directo: se dice la consecuencia operativa, no el término técnico
  («Ya no puedes escribirle libremente: usa una plantilla»).
- **Aislamiento:** toda consulta y mutación filtra primero por
  `organizationId` (`requireAccess()` lo entrega). Nunca se confía en un id
  que llega del navegador sin comprobar que pertenece a la organización.
- **Roles:** `OWNER`, `SUPERVISOR`, `AGENT`, `BACKOFFICE`. Helpers en
  `src/server/auth/access.ts` (`requireAccess`, `requireManager`,
  `requireOwner`, `canRespond`, `assertRole`). El back office lee, no responde.
- **Acciones de servidor:** archivos `actions.ts` con `"use server"`, firma
  `(state: ActionState, formData: FormData) => Promise<ActionState>` y
  helpers de `src/server/forms.ts`. El formulario cliente es
  `src/components/forms/action-form.tsx`. Al terminar, `revalidatePath`.
- **Evidencia inmutable:** mensajes, `rawPayload`, `referral`, consentimientos,
  turnos del agente y ejecuciones de flujo no se editan; las correcciones van
  en tablas de eventos que solo añaden filas.
- **Eventos:** `publishEvent` / `subscribeToEvents` en
  `src/server/events/bus.ts`. Tipos cerrados; si falta uno, se agrega ahí.
- **Procesos de fondo:** `registerLoop` en `src/server/background/registry.ts`;
  cada módulo tiene su archivo de registro ya enlazado en
  `src/server/background/loops.ts` (stubs vacíos que se rellenan).
- **Mensajería (contrato común, `src/server/messaging/`):**
  - `recordInboundMessage(identity, input)` — lo llama solo el webhook de Meta.
  - `enqueueOutboundMessage({ conversationId, originKind, content, clientRequestId })`
    — bandeja, agente, flujos y difusiones. Rechaza texto libre fuera de la
    ventana de 24 h (`OutboundRejectedError`); dentro se envían plantillas.
  - `cancelPendingOutbound(conversationId)` y
    `setResponderState({ conversationId, state, reason })` en
    `conversation-state.ts` — tomar control cancela lo automático pendiente.
  - `pickAvailableAdvisor(organizationId)` y `assignConversation(...)`.
  - `windows.ts` — reglas puras de ventana (24 h, 72 h).
- **Esquema:** `prisma/schema.prisma` es el contrato. Si un módulo necesita
  un campo nuevo, lo pide en su informe en vez de migrar por su cuenta.
- **Interfaz:** componentes de `@repo/ui` (`PageHeader`, `SectionPanel`,
  `EmptyState`, `StatusBadge`, `Metric`) y clases `ui-*` de sus estilos
  (`ui-page-stack`, `ui-table`, `ui-field`, `ui-control`, `ui-button`,
  `ui-segmented`). Estados vacíos con texto útil; nada de datos ficticios.
- **Tiempo:** UTC en base; lectura en `America/Lima` con `src/lib/time.ts`.
- **Pruebas:** reglas puras en archivos `*.test.ts` con Vitest (entorno
  `node`). `pnpm --filter crm check-types`, `lint` y `test` deben pasar.
- **Adjuntos:** carpeta `storage/` (`CRM_STORAGE_DIR`), servida por
  `/api/media/<ruta>` con sesión.
