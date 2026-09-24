import { SectionPanel } from "@repo/ui/section-panel";

import type { AgentDetail } from "@/server/ai/service";
import { providerConfigured } from "@/server/ai/providers/anthropic";

import { Simulator } from "./simulator";

/** Pestaña del simulador: conversar con el borrador sin tocar WhatsApp (SPEC-058 BR-018). */
export function SimulatorTab({ agent }: { agent: AgentDetail }) {
  if (!providerConfigured()) {
    return (
      <SectionPanel title="Simulador">
        <p className="ui-feedback" data-tone="danger">
          Falta ANTHROPIC_API_KEY en el servidor: sin ella el asistente no puede responder ni aquí ni a los clientes.
        </p>
      </SectionPanel>
    );
  }
  return (
    <SectionPanel
      description="Habla con el borrador, no con la versión publicada. Los planes y los horarios que consulta son los reales; todo lo demás es de prueba."
      title="Simulador"
    >
      <Simulator agentId={agent.id} />
    </SectionPanel>
  );
}
