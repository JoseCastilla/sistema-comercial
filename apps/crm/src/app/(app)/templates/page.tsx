import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";
import { categoryText, templateQualityText, templateStatusText } from "@/server/meta/status-text";
import { templateBodyText } from "@/server/templates/render";

import { createTemplate, retire, syncWithMeta } from "./actions";
import { TemplateFields } from "./template-fields";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const access = await requireManager();
  const [numbers, templates] = await Promise.all([
    database.whatsappNumber.findMany({
      where: { organizationId: access.organizationId, status: { not: "DISCONNECTED" } },
      select: { id: true, verifiedName: true, displayPhoneNumber: true, phoneNumberId: true },
      orderBy: { createdAt: "asc" },
    }),
    database.messageTemplate.findMany({
      where: { organizationId: access.organizationId },
      include: { whatsappNumber: { select: { displayPhoneNumber: true, verifiedName: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  if (numbers.length === 0) {
    return (
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="CRM"
          title="Plantillas"
          description="Los mensajes aprobados por Meta con los que puedes escribir después de 24 horas."
        />
        <EmptyState
          title="Primero conecta un número"
          description="Las plantillas viven en la cuenta de WhatsApp del número. Sin número conectado no hay nada que crear ni que sincronizar."
        />
        <p>
          <Link href="/settings/whatsapp">Ir a conectar el número</Link>
        </p>
      </div>
    );
  }

  const numberOptions = numbers.map((number) => ({
    id: number.id,
    label: number.verifiedName ?? number.displayPhoneNumber ?? number.phoneNumberId,
  }));

  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="CRM"
        title="Plantillas"
        description="Pasadas 24 horas desde el último mensaje del cliente, WhatsApp solo deja escribirle con una plantilla aprobada."
        meta={
          <ActionForm action={syncWithMeta} className="contents" submitLabel="Sincronizar con Meta" pendingLabel="Preguntando a Meta…" variant="secondary" />
        }
      />

      <SectionPanel
        title={`Biblioteca (${templates.length})`}
        description="Refleja lo que hay en tu cuenta de WhatsApp. Lo que se cree en WhatsApp Manager aparece aquí al sincronizar."
      >
        {templates.length === 0 ? (
          <EmptyState
            title="Todavía no hay plantillas"
            description="Sincroniza con Meta para traer las que ya existan, o crea la primera abajo."
          />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Plantilla</th>
                  <th>Para qué sirve</th>
                  <th>Estado</th>
                  <th>Calidad</th>
                  <th>Última revisión</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const status = templateStatusText({
                    status: template.status,
                    rejectedReason: template.rejectedReason,
                    pausedUntil: template.pausedUntil,
                    timeZone: access.timezone,
                  });
                  const category = categoryText(template.category);
                  const quality = templateQualityText(template.qualityScore);
                  return (
                    <tr key={template.id}>
                      <td>
                        <div className="font-medium">{template.name}</div>
                        <div className="ui-cell-clamp text-xs text-ui-muted">{templateBodyText(template.components)}</div>
                        <div className="text-xs text-ui-muted">
                          {template.language} · {template.whatsappNumber.verifiedName ?? template.whatsappNumber.displayPhoneNumber ?? "número"}
                        </div>
                      </td>
                      <td>
                        <div>{category.label}</div>
                        <div className="text-xs text-ui-muted">{category.detail}</div>
                      </td>
                      <td>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        {status.detail ? <div className="text-xs text-ui-muted">{status.detail}</div> : null}
                      </td>
                      <td>
                        <StatusBadge tone={quality.tone}>{quality.label}</StatusBadge>
                      </td>
                      <td className="text-xs text-ui-muted">{formatDateTime(template.lastSyncedAt, access.timezone)}</td>
                      <td>
                        {template.status === "RETIRED" ? (
                          <span className="text-xs text-ui-muted">Ya retirada</span>
                        ) : (
                          <ActionForm
                            action={retire}
                            className="contents"
                            confirm="Se va a borrar en Meta y dejará de poder enviarse. Los mensajes ya enviados con ella se conservan. ¿Sigues?"
                            submitLabel="Retirar"
                            variant="quiet"
                          >
                            <input name="templateId" type="hidden" value={template.id} />
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

      <SectionPanel
        title="Nueva plantilla"
        description="Meta la revisa antes de dejarte enviarla. Suele responder en minutos, a veces tarda hasta 24 horas."
      >
        <ActionForm action={createTemplate} submitLabel="Enviar a revisión de Meta" pendingLabel="Enviándola a Meta…">
          <TemplateFields numbers={numberOptions} />
        </ActionForm>
      </SectionPanel>
    </div>
  );
}
