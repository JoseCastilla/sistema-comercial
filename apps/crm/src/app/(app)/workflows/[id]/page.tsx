import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { WORKFLOW_STATUS_LABELS } from "@/server/workflows/describe";
import { EMPTY_DEFINITION } from "@/server/workflows/presets";
import { definitionSchema } from "@/server/workflows/schema";
import { advisorsFor, getWorkflow, tagsFor, templatesFor } from "@/server/workflows/service";

import { setWorkflowStatusAction } from "../actions";
import { WorkflowEditor } from "./editor";

export const dynamic = "force-dynamic";

const TONE = { ACTIVE: "success", PAUSED: "warning", DRAFT: "neutral" } as const;

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireManager();
  const { id } = await params;
  const workflow = await getWorkflow(access.organizationId, id).catch(() => null);
  if (!workflow) notFound();

  const [templates, advisors, tags] = await Promise.all([
    templatesFor(access.organizationId),
    advisorsFor(access.organizationId),
    tagsFor(access.organizationId),
  ]);
  const parsed = definitionSchema.safeParse({ trigger: workflow.trigger, steps: workflow.steps });

  return (
    <>
      <PageHeader
        description={workflow.description ?? "Sin descripción todavía."}
        eyebrow="Flujos"
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={TONE[workflow.status]}>{WORKFLOW_STATUS_LABELS[workflow.status] ?? workflow.status}</StatusBadge>
            <Link className="ui-button ui-button--quiet" href={`/workflows/${workflow.id}/runs`}>Ver ejecuciones</Link>
            <Link className="ui-button ui-button--quiet" href="/workflows">Volver</Link>
            {workflow.status === "ACTIVE" ? (
              <ActionForm action={setWorkflowStatusAction} className="contents" submitLabel="Pausar" variant="secondary">
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
        }
        title={workflow.name}
      />
      {parsed.success ? null : (
        <p className="ui-feedback" data-tone="danger" role="alert">
          Lo guardado no se puede leer con el catálogo actual: se muestra un flujo en blanco. Ármalo de nuevo y guárdalo.
        </p>
      )}
      <WorkflowEditor
        advisors={advisors}
        definition={parsed.success ? parsed.data : EMPTY_DEFINITION}
        tags={tags}
        templates={templates}
        workflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description ?? "",
          status: workflow.status,
          version: workflow.version,
          priority: workflow.priority,
        }}
      />
    </>
  );
}
