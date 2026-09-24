import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { formatDateTime } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import type { LogEntry } from "@/server/workflows/engine";
import { RUN_STATUS_LABELS, STEP_LABELS } from "@/server/workflows/describe";
import { getWorkflow, runsForWorkflow } from "@/server/workflows/service";
import type { StepType } from "@/server/workflows/schema";

export const dynamic = "force-dynamic";

const TONE = { RUNNING: "info", WAITING: "warning", DONE: "success", STOPPED: "neutral", FAILED: "danger" } as const;

const BRANCH_LABELS: Record<string, string> = {
  onReply: "respondió",
  onTimeout: "no respondió a tiempo",
  onTrue: "se cumple",
  onFalse: "no se cumple",
  onFail: "no se pudo enviar",
};

function readLog(value: unknown): LogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        at: String(record.at ?? ""),
        stepId: String(record.stepId ?? ""),
        type: String(record.type ?? ""),
        result: String(record.result ?? ""),
        ...(typeof record.branch === "string" ? { branch: record.branch } : {}),
      },
    ];
  });
}

export default async function WorkflowRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireManager();
  const { id } = await params;
  const workflow = await getWorkflow(access.organizationId, id).catch(() => null);
  if (!workflow) notFound();
  const runs = await runsForWorkflow(access.organizationId, workflow.id);

  return (
    <>
      <PageHeader
        description="Cada ejecución con los pasos que recorrió y por qué terminó. No se edita: es la evidencia de lo que hizo el flujo."
        eyebrow={workflow.name}
        meta={
          <div className="flex flex-wrap gap-2">
            <Link className="ui-button ui-button--quiet" href={`/workflows/${workflow.id}`}>Editar el flujo</Link>
            <Link className="ui-button ui-button--quiet" href="/workflows">Volver</Link>
          </div>
        }
        title="Ejecuciones"
      />
      <SectionPanel description="Las últimas 50, de la más reciente a la más antigua." title={`Ejecuciones (${runs.length})`}>
        {runs.length === 0 ? (
          <EmptyState description="Cuando el flujo esté activo y pase lo que lo dispara, cada ejecución aparecerá aquí paso a paso." title="Todavía no se ejecutó" />
        ) : (
          <div className="grid gap-3">
            {runs.map((run) => {
              const log = readLog(run.log);
              return (
                <article className="ui-surface ui-surface--padded" key={run.id}>
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={TONE[run.status]}>{RUN_STATUS_LABELS[run.status] ?? run.status}</StatusBadge>
                        <span className="text-sm">
                          {run.contact?.displayName ?? run.contact?.phone ?? "Sin contacto vinculado"}
                        </span>
                        {run.conversationId ? (
                          <Link className="text-sm underline" href={`/inbox/${run.conversationId}`}>Ver la conversación</Link>
                        ) : null}
                      </div>
                      <p className="text-xs text-ui-muted">
                        Versión {run.workflowVersion} · empezó {formatDateTime(run.startedAt, access.timezone)}
                        {run.endedAt ? ` · terminó ${formatDateTime(run.endedAt, access.timezone)}` : ""}
                        {run.status === "WAITING" && run.resumeAt ? ` · sigue el ${formatDateTime(run.resumeAt, access.timezone)}` : ""}
                      </p>
                    </div>
                    <p className="text-sm">{run.endReason ?? (run.status === "WAITING" ? "Esperando" : "En curso")}</p>
                  </header>
                  {log.length === 0 ? (
                    <p className="mt-2 text-sm text-ui-muted">Todavía no dio ningún paso.</p>
                  ) : (
                    <ol className="mt-2 grid gap-1">
                      {log.map((entry, index) => (
                        <li className="text-sm" key={`${entry.stepId}-${index}`}>
                          <span className="text-xs text-ui-muted">{formatDateTime(entry.at, access.timezone)}</span>{" "}
                          <span className="font-medium">{STEP_LABELS[entry.type as StepType] ?? entry.type}</span>: {entry.result}
                          {entry.branch ? <span className="text-ui-muted"> · rama «{BRANCH_LABELS[entry.branch] ?? entry.branch}»</span> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SectionPanel>
    </>
  );
}
