import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";

import { saveOrganization } from "./actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = [["1", "Lun"], ["2", "Mar"], ["3", "Mié"], ["4", "Jue"], ["5", "Vie"], ["6", "Sáb"], ["0", "Dom"]] as const;

export default async function OrganizationSettingsPage() {
  const access = await requireManager();
  const organization = await database.organization.findUniqueOrThrow({ where: { id: access.organizationId } });
  const hours = organization.businessHours as { days: number[]; start: string; end: string };
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Empresa" description="Nombre, horario de atención y reglas de la bandeja." />
      <SectionPanel title="Datos y horario">
        <ActionForm action={saveOrganization} submitLabel="Guardar">
          <label className="ui-field"><span className="ui-field__label">Nombre</span><input className="ui-control" defaultValue={organization.name} name="name" required /></label>
          <label className="ui-field"><span className="ui-field__label">Zona horaria</span><input className="ui-control" defaultValue={organization.timezone} name="timezone" required /></label>
          <fieldset className="ui-field">
            <span className="ui-field__label">Días de atención</span>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map(([value, label]) => (
                <label key={value} className="flex items-center gap-1 text-sm"><input defaultChecked={hours.days.includes(Number(value))} name="days" type="checkbox" value={value} />{label}</label>
              ))}
            </div>
          </fieldset>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Desde</span><input className="ui-control" defaultValue={hours.start} name="start" type="time" /></label>
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Hasta</span><input className="ui-control" defaultValue={hours.end} name="end" type="time" /></label>
          </div>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Minutos para marcar «sin atender»</span><input className="ui-control" defaultValue={organization.unattendedAfterMinutes} min={1} name="unattendedAfterMinutes" type="number" /></label>
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Minutos para devolver a la cola</span><input className="ui-control" defaultValue={organization.returnToQueueAfterMinutes} min={1} name="returnToQueueAfterMinutes" type="number" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={organization.handBackToAgentOnClose} name="handBackToAgentOnClose" type="checkbox" />Al cerrar una conversación, el próximo mensaje del cliente lo atiende el asistente virtual (si hay uno en su horario).</label>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
