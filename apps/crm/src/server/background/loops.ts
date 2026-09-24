import "server-only";

/**
 * Lista única de bucles y suscriptores de fondo. Importar este archivo los
 * registra todos; `instrumentation.ts` los arranca una vez por proceso.
 */
import { registerAiSubscriber } from "../ai/subscriber";
import { registerBroadcastLoop } from "../broadcasts/loop";
import { registerOutboundLoop } from "../meta/outbound-loop";
import { registerUnattendedLoop } from "../messaging/unattended-loop";
import { registerOpportunitySubscriber } from "../opportunities/subscriber";
import { registerWorkflowLoop } from "../workflows/loop";

registerUnattendedLoop();
registerOutboundLoop();
registerOpportunitySubscriber();
registerWorkflowLoop();
registerBroadcastLoop();
registerAiSubscriber();
