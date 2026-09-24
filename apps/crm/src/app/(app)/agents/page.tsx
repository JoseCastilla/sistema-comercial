import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { penAmount } from "@/server/ai/budget";
import { listAgents } from "@/server/ai/service";

import { createAgentAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral"; hint: string }> = {
  PUBLISHED: { label: "Responde", tone: "success", hint: "Contesta según su horario." },
  PAUSED: { label: "Pausado", tone: "warning", hint: "No contesta: todo va a la cola." },
  DRAFT: { label: "Sin publicar", tone: "neutral", hint: "Todavía no contesta a nadie." },
};

const BUDGET_NOTE: Record<string, string> = {
  AVISO: "Pasó el 80 % del tope del mes.",
  AGOTADO: "Llegó al tope del mes: dejó de responder.",
};

export default async function AgentsPage() {
  const access = await requireManager();
  const agents = await listAgents(access.organizationId, access.timezone);

  return (
    <>
      <PageHeader
        description="El asistente virtual contesta al instante con lo que la empresa aprobó, reúne los datos y pasa a un asesor cuando toca. Se entrena aquí y cada cambio se prueba antes de publicarse."
        eyebrow="Automatización"
        title="Agentes de IA"
      />

      <SectionPanel description="Cada número de WhatsApp usa uno. Publicar es lo único que cambia lo que responde." title={`Tus agentes (${agents.length})`}>
        {agents.length === 0 ? (
          <EmptyState
            description="Crea el primero abajo: nace sin publicar, así que no contesta a nadie hasta que lo pruebes y lo publiques."
            title="Todavía no tienes agentes"
          />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Estado</th>
                  <th>Modelo</th>
                  <th>Versión que responde</th>
                  <th>Gasto del mes</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const status = STATUS[agent.status] ?? STATUS.DRAFT!;
                  return (
                    <tr key={agent.id}>
                      <td>
                        <Link className="font-medium" href={`/agents/${agent.id}?tab=configuracion`}>
                          {agent.name}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        <div className="text-xs text-ui-muted">{status.hint}</div>
                      </td>
                      <td className="text-xs">{agent.modelId}</td>
                      <td>{agent.publishedVersionNumber ? `Versión ${agent.publishedVersionNumber}` : "Ninguna"}</td>
                      <td>
                        {penAmount(agent.monthCostPen)}
                        {BUDGET_NOTE[agent.budgetState] ? <div className="text-xs text-ui-muted">{BUDGET_NOTE[agent.budgetState]}</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel description="Ponle el nombre con el que lo reconoces dentro del equipo; el nombre con el que se presenta al cliente se configura después." title="Nuevo agente">
        <ActionForm action={createAgentAction} submitLabel="Crear agente">
          <label className="ui-field">
            <span className="ui-field__label">Nombre</span>
            <input className="ui-control" maxLength={120} name="name" placeholder="Asistente de portabilidad" required />
          </label>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
