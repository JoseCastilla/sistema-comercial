import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import { describeTrigger, WORKFLOW_STATUS_LABELS } from "@/server/workflows/describe";
import { WORKFLOW_PRESETS } from "@/server/workflows/presets";
import { triggerSchema } from "@/server/workflows/schema";
import { listWorkflows } from "@/server/workflows/service";

import { createWorkflowAction, setWorkflowStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const TONE = { ACTIVE: "success", PAUSED: "warning", DRAFT: "neutral" } as const;

function triggerText(trigger: unknown): string {
  const parsed = triggerSchema.safeParse(trigger);
  return parsed.success ? describeTrigger(parsed.data) : "Disparador incompleto: ábrelo y elige cuándo se ejecuta";
}

export default async function WorkflowsPage() {
  const access = await requireManager();
  const workflows = await listWorkflows(access.organizationId);

  return (
    <>
      <PageHeader
        description="Un flujo hace solo lo que alguien tendría que acordarse de hacer: responder al lead del anuncio, retomar al que dejó de contestar, recordar la cita. Se prueba en borrador y se activa cuando convence."
        eyebrow="Automatización"
        title="Flujos"
      />

      <SectionPanel description="Los activos se ejecutan solos. Los pausados no arrancan en casos nuevos." title={`Tus flujos (${workflows.length})`}>
        {workflows.length === 0 ? (
          <EmptyState description="Empieza con uno prearmado de abajo: se crea como borrador y lo puedes cambiar entero antes de activarlo." title="Todavía no tienes flujos" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Flujo</th>
                  <th>Cuándo se ejecuta</th>
                  <th>Estado</th>
                  <th>Ejecuciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr key={workflow.id}>
                    <td>
                      <Link className="font-medium" href={`/workflows/${workflow.id}`}>{workflow.name}</Link>
                      <div className="text-xs text-ui-muted">Versión {workflow.version} · guardado {formatDateTime(workflow.updatedAt, access.timezone)}</div>
                    </td>
                    <td>{triggerText(workflow.trigger)}</td>
                    <td><StatusBadge tone={TONE[workflow.status]}>{WORKFLOW_STATUS_LABELS[workflow.status] ?? workflow.status}</StatusBadge></td>
                    <td className="text-xs">
                      <div>{workflow.runs.started} iniciadas</div>
                      <div className="text-ui-muted">{workflow.runs.finished} terminadas · {workflow.runs.stopped} detenidas · {workflow.runs.waiting} en curso</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link className="ui-button ui-button--secondary" href={`/workflows/${workflow.id}`}>Editar</Link>
                        <Link className="ui-button ui-button--quiet" href={`/workflows/${workflow.id}/runs`}>Ejecuciones</Link>
                        {workflow.status === "ACTIVE" ? (
                          <ActionForm action={setWorkflowStatusAction} className="contents" submitLabel="Pausar" variant="quiet">
                            <input name="workflowId" type="hidden" value={workflow.id} />
                            <input name="status" type="hidden" value="PAUSED" />
                          </ActionForm>
                        ) : (
                          <ActionForm action={setWorkflowStatusAction} className="contents" submitLabel="Activar" variant="primary">
                            <input name="workflowId" type="hidden" value={workflow.id} />
                            <input name="status" type="hidden" value="ACTIVE" />
                          </ActionForm>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel description="Se crean apagados y editables: revisa los textos, elige la plantilla y actívalos cuando estén como los quieres." title="Crear desde uno prearmado">
        <div className="grid gap-3 md:grid-cols-2">
          {WORKFLOW_PRESETS.map((preset) => (
            <article className="ui-surface ui-surface--padded" key={preset.key}>
              <h3 className="font-medium">{preset.name}</h3>
              <p className="mt-1 text-sm text-ui-muted">{preset.description}</p>
              <p className="mt-1 text-xs text-ui-muted">Antes de activarlo: {preset.pending}</p>
              <ActionForm action={createWorkflowAction} className="mt-3" pendingLabel="Creando…" submitLabel="Crear este flujo" variant="secondary">
                <input name="preset" type="hidden" value={preset.key} />
                <input name="name" type="hidden" value={preset.name} />
              </ActionForm>
            </article>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel description="Empieza en blanco: eliges el disparador y armas los pasos." title="Nuevo flujo">
        <ActionForm action={createWorkflowAction} pendingLabel="Creando…" submitLabel="Crear flujo en blanco">
          <label className="ui-field">
            <span className="ui-field__label">Nombre</span>
            <input className="ui-control" maxLength={160} name="name" placeholder="Por ejemplo: avisar cuando el chip sale a reparto" required />
          </label>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
