import { EmptyState } from "@repo/ui/empty-state";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import type { OrganizationRole } from "@/generated/prisma/enums";
import { listVersions, type AgentDetail } from "@/server/ai/service";

import { publishAction, rollbackAction, setStatusAction } from "../actions";

/**
 * Pestaña de versiones (SPEC-058 BR-017, BR-019). Publicar corre las pruebas
 * primero; volver atrás crea una versión nueva con el contenido de la vieja.
 */

interface Summary {
  total?: number;
  passed?: number;
  criticalFailed?: number;
}

function readSummary(value: unknown): Summary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    total: typeof raw.total === "number" ? raw.total : undefined,
    passed: typeof raw.passed === "number" ? raw.passed : undefined,
    criticalFailed: typeof raw.criticalFailed === "number" ? raw.criticalFailed : undefined,
  };
}

export async function VersionsTab({
  agent,
  organizationId,
  role,
  timezone,
}: {
  agent: AgentDetail;
  organizationId: string;
  role: OrganizationRole;
  timezone: string;
}) {
  const versions = await listVersions(organizationId, agent.id);
  const isOwner = role === "OWNER";

  return (
    <>
      <SectionPanel
        description="Al publicar se corre el conjunto de pruebas y se guarda su resultado con la versión. Las conversaciones en curso siguen con la nueva desde su próximo mensaje."
        title="Publicar el borrador"
      >
        <ActionForm action={publishAction} pendingLabel="Probando y publicando…" submitLabel="Correr pruebas y publicar">
          <input name="agentId" type="hidden" value={agent.id} />
          <label className="ui-field">
            <span className="ui-field__label">Qué cambió</span>
            <input className="ui-control" name="reason" placeholder="Se agregó el artículo de requisitos y se activó agendar llamada" required />
          </label>
          {isOwner ? (
            <label className="ui-field">
              <span className="flex items-center gap-2 font-medium">
                <input name="force" type="checkbox" />
                Publicar aunque falle una prueba crítica
              </span>
              <span className="ui-field__hint">Queda registrado en el motivo de la versión y en el historial de acciones.</span>
            </label>
          ) : (
            <p className="ui-field__hint">Si falla una prueba crítica, la publicación se detiene: solo el dueño puede saltarla.</p>
          )}
        </ActionForm>
      </SectionPanel>

      <SectionPanel description="Pausado, el asistente no contesta y todo va a la cola." title="Estado">
        <ActionForm
          action={setStatusAction}
          submitLabel={agent.status === "PUBLISHED" ? "Pausar el asistente" : "Hacer que responda"}
          variant={agent.status === "PUBLISHED" ? "danger" : "secondary"}
        >
          <input name="agentId" type="hidden" value={agent.id} />
          <input name="status" type="hidden" value={agent.status === "PUBLISHED" ? "PAUSED" : "PUBLISHED"} />
        </ActionForm>
      </SectionPanel>

      <SectionPanel title={`Historial (${versions.length})`}>
        {versions.length === 0 ? (
          <EmptyState description="Publica el borrador para tener la primera." title="Todavía no hay versiones" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Publicada</th>
                  <th>Modelo</th>
                  <th>Pruebas</th>
                  <th>Motivo</th>
                  <th>Volver a esta</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => {
                  const summary = readSummary(version.testSummary);
                  const current = version.id === agent.publishedVersionId;
                  return (
                    <tr key={version.id}>
                      <td>
                        <span className="font-medium">Versión {version.versionNumber}</span>
                        {current ? (
                          <div>
                            <StatusBadge tone="success">Es la que responde</StatusBadge>
                          </div>
                        ) : null}
                      </td>
                      <td className="text-xs text-ui-muted">{formatDateTime(version.publishedAt, timezone)}</td>
                      <td className="text-xs">
                        {version.modelId}
                        <div className="text-ui-muted">esfuerzo {version.effort}</div>
                      </td>
                      <td className="text-xs">
                        {summary.total === undefined ? (
                          "—"
                        ) : (
                          <>
                            {summary.passed ?? 0} de {summary.total} pasaron
                            {summary.criticalFailed ? <div className="text-ui-danger">{summary.criticalFailed} crítica(s) fallida(s)</div> : null}
                          </>
                        )}
                      </td>
                      <td className="text-xs">{version.publishReason ?? "—"}</td>
                      <td>
                        {current ? (
                          <span className="text-xs text-ui-muted">—</span>
                        ) : (
                          <ActionForm action={rollbackAction} className="grid gap-2" submitLabel="Volver a esta" variant="secondary">
                            <input name="agentId" type="hidden" value={agent.id} />
                            <input name="versionId" type="hidden" value={version.id} />
                            <input className="ui-control" name="reason" placeholder="Por qué se vuelve" required />
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </>
  );
}
