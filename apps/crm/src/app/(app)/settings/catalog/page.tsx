import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";

import { retirePlan, savePlan } from "../actions";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const access = await requireManager();
  const plans = await database.planCatalogItem.findMany({ where: { organizationId: access.organizationId }, orderBy: [{ validUntil: "asc" }, { name: "asc" }] });
  const now = Date.now();
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Catálogo de planes" description="De aquí leen precios el asistente virtual y las propuestas. Ningún precio vive en documentos." />
      <SectionPanel title="Nuevo plan">
        <ActionForm action={savePlan} submitLabel="Guardar plan">
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Nombre</span><input className="ui-control" name="name" required /></label>
            <label className="ui-field ui-form-row__fixed"><span className="ui-field__label">Tipo</span>
              <select className="ui-control ui-control--select" name="kind"><option value="PORTABILIDAD">Portabilidad</option><option value="LINEA_NUEVA">Línea nueva</option><option value="MIGRACION">Migración</option></select>
            </label>
            <label className="ui-field ui-form-row__fixed"><span className="ui-field__label">Cargo fijo (S/)</span><input className="ui-control" min={0} name="fixedCharge" required step="0.01" type="number" /></label>
          </div>
          <label className="ui-field"><span className="ui-field__label">Requisitos</span><textarea className="ui-control" name="requirements" rows={2} /></label>
          <label className="ui-field"><span className="ui-field__label">Promoción vigente</span><textarea className="ui-control" name="promotion" rows={2} /></label>
          <label className="ui-field"><span className="ui-field__label">Vigente hasta (opcional)</span><input className="ui-control" name="validUntil" type="date" /></label>
        </ActionForm>
      </SectionPanel>
      <SectionPanel title={`Planes (${plans.length})`}>
        {plans.length === 0 ? <EmptyState title="Sin planes" description="Carga tus planes vigentes para que el asistente y las propuestas usen precios reales." /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Plan</th><th>Tipo</th><th>Cargo fijo</th><th>Vigencia</th><th>Requisitos</th><th>Promoción</th><th></th></tr></thead>
              <tbody>
                {plans.map((plan) => {
                  const active = !plan.validUntil || plan.validUntil.getTime() > now;
                  return (
                    <tr key={plan.id}>
                      <td className="font-medium">{plan.name}</td>
                      <td>{plan.kind}</td>
                      <td>S/ {plan.fixedCharge.toFixed(2)}</td>
                      <td><StatusBadge tone={active ? "success" : "neutral"}>{active ? "Vigente" : "Retirado"}</StatusBadge></td>
                      <td className="ui-cell-clamp">{plan.requirements ?? "—"}</td>
                      <td className="ui-cell-clamp">{plan.promotion ?? "—"}</td>
                      <td>{active ? <ActionForm action={retirePlan} className="" confirm="¿Retirar este plan? Dejará de ofrecerse." submitLabel="Retirar" variant="quiet"><input name="id" type="hidden" value={plan.id} /></ActionForm> : null}</td>
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
