import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";

import { deleteBookingRule, saveBookingRule } from "../actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function BookingPage() {
  const access = await requireManager();
  const rules = await database.bookingRule.findMany({ where: { organizationId: access.organizationId }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Cupos de citas" description="Franjas en las que el asistente y los asesores pueden agendar llamadas, y cuántas caben por franja." />
      <SectionPanel title="Nueva franja">
        <ActionForm action={saveBookingRule} submitLabel="Crear franja">
          <fieldset className="ui-field">
            <span className="ui-field__label">Días</span>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <label key={day} className="flex items-center gap-1 text-sm"><input defaultChecked={day >= 1 && day <= 5} name="weekday" type="checkbox" value={day} />{WEEKDAYS[day]}</label>
              ))}
            </div>
          </fieldset>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Desde</span><input className="ui-control" defaultValue="09:00" name="startTime" type="time" /></label>
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Hasta</span><input className="ui-control" defaultValue="19:00" name="endTime" type="time" /></label>
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Minutos por cita</span><input className="ui-control" defaultValue={30} min={10} name="slotMinutes" type="number" /></label>
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Cupo por franja</span><input className="ui-control" defaultValue={3} min={1} name="capacity" type="number" /></label>
          </div>
        </ActionForm>
      </SectionPanel>
      <SectionPanel title={`Franjas (${rules.length})`}>
        {rules.length === 0 ? <EmptyState title="Sin franjas" description="Sin franjas nadie puede agendar: el asistente derivará al asesor en vez de proponer horarios." /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Día</th><th>Horario</th><th>Minutos por cita</th><th>Cupo</th><th></th></tr></thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{WEEKDAYS[rule.weekday]}</td>
                    <td>{rule.startTime} – {rule.endTime}</td>
                    <td>{rule.slotMinutes}</td>
                    <td>{rule.capacity}</td>
                    <td><ActionForm action={deleteBookingRule} className="" submitLabel="Eliminar" variant="quiet"><input name="id" type="hidden" value={rule.id} /></ActionForm></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </>
  );
}
