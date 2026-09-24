import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import { BROADCAST_STATUS_TEXT } from "@/server/broadcasts/rules";
import { connectedNumbers, listBroadcasts, usableTemplates } from "@/server/broadcasts/service";

import { cancel, pause, resume } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Promoción",
  UTILITY: "Aviso",
  AUTHENTICATION: "Código de acceso",
};

export default async function BroadcastsPage() {
  const access = await requireManager();
  const [broadcasts, numbers, templates] = await Promise.all([
    listBroadcasts(access.organizationId),
    connectedNumbers(access.organizationId),
    usableTemplates(access.organizationId),
  ]);

  const canStart = numbers.length > 0 && templates.length > 0;

  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Escríbele la misma plantilla a muchas personas a la vez. Solo entran contactos que ya hablaron contigo y aceptaron que les escribas."
        eyebrow="CRM"
        meta={canStart ? <Link className="ui-button ui-button--primary" href="/broadcasts/new">Nueva difusión</Link> : null}
        title="Difusiones"
      />

      {numbers.length === 0 ? (
        <SectionPanel title="Falta conectar el WhatsApp">
          <p>Sin un número conectado no se puede enviar nada. Conéctalo y vuelve.</p>
          <p><Link className="ui-button ui-button--primary" href="/settings/whatsapp">Conectar WhatsApp</Link></p>
        </SectionPanel>
      ) : templates.length === 0 ? (
        <SectionPanel title="Falta una plantilla aprobada">
          <p>
            Una difusión siempre usa una plantilla que Meta ya aprobó: fuera de la ventana de 24 horas no se puede
            mandar texto libre. Crea una y espera la aprobación.
          </p>
          <p><Link className="ui-button ui-button--primary" href="/templates">Ir a plantillas</Link></p>
        </SectionPanel>
      ) : null}

      <SectionPanel
        description="Cada fila dice en qué va y a cuántas personas llegó."
        title={`Difusiones (${broadcasts.length})`}
      >
        {broadcasts.length === 0 ? (
          <EmptyState
            description={canStart
              ? "Crea la primera: eliges a quiénes, con qué plantilla y a qué hora sale."
              : "Cuando tengas el número conectado y una plantilla aprobada podrás crear la primera."}
            title="Todavía no enviaste ninguna"
          />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Difusión</th>
                  <th>En qué va</th>
                  <th>Le toca a</th>
                  <th>Salieron</th>
                  <th>Les llegó</th>
                  <th>Respondieron</th>
                  <th>Cuándo</th>
                  <th>Qué hacer</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((broadcast) => {
                  const state = BROADCAST_STATUS_TEXT[broadcast.status] ?? { label: broadcast.status, tone: "neutral" as const, detail: "" };
                  const isOwner = access.role === "OWNER";
                  const frozenByBrake = broadcast.status === "PAUSED" && Boolean(broadcast.pauseReason);
                  return (
                    <tr key={broadcast.id}>
                      <td>
                        <Link className="font-medium" href={`/broadcasts/${broadcast.id}`}>{broadcast.name}</Link>
                        <div className="text-xs text-ui-muted">
                          {CATEGORY_LABEL[broadcast.category] ?? broadcast.category} · {broadcast.templateName}
                        </div>
                      </td>
                      <td>
                        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                        <div className="text-xs text-ui-muted">{broadcast.pauseReason ?? state.detail}</div>
                      </td>
                      <td>{broadcast.recipients}{broadcast.excluded ? <div className="text-xs text-ui-muted">{broadcast.excluded} quedaron fuera</div> : null}</td>
                      <td>{broadcast.sent}{broadcast.failed ? <div className="text-xs text-ui-muted">{broadcast.failed} no llegaron</div> : null}</td>
                      <td>{broadcast.delivered}</td>
                      <td>{broadcast.replied}</td>
                      <td className="text-xs text-ui-muted">{formatDateTime(broadcast.scheduledAt ?? broadcast.updatedAt, access.timezone)}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          {broadcast.status === "DRAFT" ? (
                            <Link className="ui-button ui-button--secondary" href={`/broadcasts/new?id=${broadcast.id}&paso=1`}>Seguir armándola</Link>
                          ) : null}
                          {broadcast.status === "SCHEDULED" || broadcast.status === "SENDING" ? (
                            <ActionForm action={pause} className="flex items-center gap-2" submitLabel="Pausar" variant="secondary">
                              <input name="id" type="hidden" value={broadcast.id} />
                              <input className="ui-control" name="reason" placeholder="Por qué la pausas" />
                            </ActionForm>
                          ) : null}
                          {broadcast.status === "PAUSED" && (isOwner || !frozenByBrake) ? (
                            <ActionForm action={resume} className="flex items-center gap-2" submitLabel="Reanudar" variant="secondary">
                              <input name="id" type="hidden" value={broadcast.id} />
                              <input className="ui-control" name="reason" placeholder="Por qué la reanudas" required={frozenByBrake} />
                            </ActionForm>
                          ) : null}
                          {broadcast.status === "PAUSED" && frozenByBrake && !isOwner ? (
                            <span className="text-xs text-ui-muted">Se frenó sola: la reanuda el dueño.</span>
                          ) : null}
                          {broadcast.status !== "DONE" && broadcast.status !== "CANCELLED" ? (
                            <ActionForm
                              action={cancel}
                              className="flex items-center"
                              confirm="Se detiene y no se retoma. ¿Cancelar la difusión?"
                              submitLabel="Cancelar"
                              variant="danger"
                            >
                              <input name="id" type="hidden" value={broadcast.id} />
                            </ActionForm>
                          ) : null}
                          <Link className="ui-button ui-button--quiet" href={`/broadcasts/${broadcast.id}`}>Ver resultados</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
