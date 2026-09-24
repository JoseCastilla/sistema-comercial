import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { penAmount, usdToPenRate } from "@/server/ai/budget";
import { agentMetrics, type AgentDetail } from "@/server/ai/service";

import { flagTurnAction } from "../actions";

/** Pestaña de métricas del mes en curso (SPEC-058 BR-021). */

const MODE_LABELS: Record<string, string> = {
  LIVE: "Con clientes",
  SIMULATOR: "Simulador",
  TEST: "Pruebas",
};

export async function MetricsTab({ agent, organizationId, timezone }: { agent: AgentDetail; organizationId: string; timezone: string }) {
  const metrics = await agentMetrics(organizationId, agent.id, timezone);
  const rate = usdToPenRate();

  return (
    <>
      <SectionPanel description="Todo lo del mes en curso, en hora de Lima." title="Cifras del mes">
        <MetricGroup label="Uso y costo del asistente">
          <Metric emphasis="hero" label="Costo total" value={penAmount(metrics.totalCostUsd * rate)} hint={`US$ ${metrics.totalCostUsd.toFixed(4)}`} />
          <Metric label="Conversaciones atendidas" value={metrics.conversationsServed} />
          <Metric label="Derivadas a un asesor" value={metrics.handoffs} />
          <Metric
            label="Costo por conversación calificada"
            value={metrics.costPerQualifiedUsd === null ? "—" : penAmount(metrics.costPerQualifiedUsd * rate)}
            hint={
              metrics.costPerQualifiedUsd === null
                ? "Todavía ninguna conversación del asistente llegó a Calificado."
                : `${metrics.qualifiedOpportunities} calificada(s) de las que atendió`
            }
          />
        </MetricGroup>
      </SectionPanel>

      <SectionPanel description="Un turno es una respuesta del asistente, con todas las herramientas que usó para darla." title="Turnos por dónde se corrieron">
        {metrics.turnsByMode.length === 0 ? (
          <EmptyState description="Cuando el asistente responda o corras las pruebas, aparecerán aquí." title="Todavía no hay turnos este mes" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Dónde</th>
                  <th>Turnos</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {metrics.turnsByMode.map((row) => (
                  <tr key={row.mode}>
                    <td>{MODE_LABELS[row.mode] ?? row.mode}</td>
                    <td>{row.turns}</td>
                    <td>{penAmount(row.costUsd * rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        description="Marcar una respuesta alimenta la lista de pruebas: lo que salió mal una vez se convierte en un caso que hay que pasar antes de publicar."
        title={`Respuestas marcadas como incorrectas (${metrics.flagged.length})`}
      >
        {metrics.flagged.length === 0 ? (
          <EmptyState description="Cuando marques una respuesta desde la bandeja o desde aquí, aparecerá en esta lista." title="Ninguna marcada este mes" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Qué respondió</th>
                  <th>Qué estuvo mal</th>
                </tr>
              </thead>
              <tbody>
                {metrics.flagged.map((turn) => (
                  <tr key={turn.id}>
                    <td className="text-xs text-ui-muted">{formatDateTime(turn.createdAt, timezone)}</td>
                    <td className="text-xs">{turn.text ?? "—"}</td>
                    <td className="text-xs">{turn.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        description="El botón «¿por qué respondió esto?» de la bandeja llamará a esta misma acción; hasta que exista, se marca pegando el identificador del turno."
        title="Marcar una respuesta como incorrecta"
      >
        <ActionForm action={flagTurnAction} submitLabel="Marcar">
          <input name="agentId" type="hidden" value={agent.id} />
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Turno</span>
              <input className="ui-control" name="turnId" placeholder="Identificador del turno" required />
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Qué estuvo mal</span>
              <input className="ui-control" maxLength={80} name="reason" placeholder="Inventó un precio" required />
            </label>
          </div>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
