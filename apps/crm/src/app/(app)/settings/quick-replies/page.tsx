import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";

import { deleteQuickReply, saveQuickReply } from "../actions";

export const dynamic = "force-dynamic";

export default async function QuickRepliesPage() {
  const access = await requireManager();
  const replies = await database.quickReply.findMany({ where: { organizationId: access.organizationId }, orderBy: { shortcut: "asc" } });
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Respuestas rápidas" description="En la bandeja se escriben con «/atajo». Admiten {nombre} del contacto y {asesor}." />
      <SectionPanel title="Nueva respuesta rápida">
        <ActionForm action={saveQuickReply} submitLabel="Guardar">
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__fixed"><span className="ui-field__label">Atajo</span><input className="ui-control" name="shortcut" placeholder="saludo" required /></label>
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Texto</span><textarea className="ui-control" name="body" required rows={2} /></label>
          </div>
        </ActionForm>
      </SectionPanel>
      <SectionPanel title={`Respuestas (${replies.length})`}>
        {replies.length === 0 ? <EmptyState title="Sin respuestas rápidas" description="Crea las frases que tu equipo repite: saludo, requisitos, cierre." /> : (
          <ul className="divide-y divide-ui-border">
            {replies.map((reply) => (
              <li key={reply.id} className="flex items-start justify-between gap-4 py-3">
                <div><p className="font-mono text-sm">/{reply.shortcut}</p><p className="text-sm text-ui-muted">{reply.body}</p></div>
                <ActionForm action={deleteQuickReply} className="" submitLabel="Eliminar" variant="quiet"><input name="id" type="hidden" value={reply.id} /></ActionForm>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </>
  );
}
