import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";
import { formatDateTime } from "@/lib/time";

import { createUser, toggleAvailability, updateMember } from "../actions";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  ["OWNER", "Dueño del negocio"],
  ["SUPERVISOR", "Supervisor"],
  ["AGENT", "Asesor"],
  ["BACKOFFICE", "Back office"],
] as const;

export default async function UsersPage() {
  const access = await requireManager();
  const members = await database.organizationMember.findMany({
    where: { organizationId: access.organizationId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  const isOwner = access.role === "OWNER";
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Usuarios" description="Cuentas de dueño, supervisores, asesores y back office. Un asesor disponible recibe conversaciones por reparto." />
      {isOwner ? (
        <SectionPanel title="Nueva cuenta" description="Define una contraseña inicial y compártela; la persona la cambia después.">
          <ActionForm action={createUser} submitLabel="Crear cuenta">
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Nombre</span><input className="ui-control" name="name" required /></label>
              <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Correo</span><input className="ui-control" name="email" required type="email" /></label>
            </div>
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__grow"><span className="ui-field__label">Contraseña inicial</span><input className="ui-control" minLength={12} name="password" required type="password" /></label>
              <label className="ui-field ui-form-row__fixed"><span className="ui-field__label">Rol</span>
                <select className="ui-control ui-control--select" defaultValue="AGENT" name="role">
                  {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
          </ActionForm>
        </SectionPanel>
      ) : null}
      <SectionPanel title={`Cuentas (${members.length})`}>
        {members.length === 0 ? <EmptyState title="Sin cuentas" description="Crea la primera cuenta arriba." /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Disponible</th><th>Última vez</th>{isOwner ? <th>Editar</th> : null}</tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td><div className="font-medium">{member.user.name}</div><div className="text-xs text-ui-muted">{member.user.email}</div></td>
                    <td>{ROLE_OPTIONS.find(([v]) => v === member.role)?.[1]}</td>
                    <td><StatusBadge tone={member.user.status === "ACTIVE" ? "success" : "danger"}>{member.user.status === "ACTIVE" ? "Activa" : "Desactivada"}</StatusBadge></td>
                    <td>
                      <ActionForm action={toggleAvailability} className="flex items-center gap-2" submitLabel={member.available ? "Marcar no disponible" : "Marcar disponible"} variant="quiet">
                        <input name="memberId" type="hidden" value={member.id} />
                        <input name="available" type="hidden" value={member.available ? "false" : "true"} />
                        <StatusBadge tone={member.available ? "success" : "neutral"}>{member.available ? "Sí" : "No"}</StatusBadge>
                      </ActionForm>
                    </td>
                    <td className="text-xs text-ui-muted">{formatDateTime(member.lastSeenAt, access.timezone)}</td>
                    {isOwner ? (
                      <td>
                        <ActionForm action={updateMember} className="flex flex-wrap items-center gap-2" submitLabel="Guardar" variant="secondary">
                          <input name="memberId" type="hidden" value={member.id} />
                          <select className="ui-control ui-control--select" defaultValue={member.role} name="role">
                            {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <select className="ui-control ui-control--select" defaultValue={member.user.status} name="status">
                            <option value="ACTIVE">Activa</option>
                            <option value="DISABLED">Desactivada</option>
                          </select>
                        </ActionForm>
                      </td>
                    ) : null}
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
