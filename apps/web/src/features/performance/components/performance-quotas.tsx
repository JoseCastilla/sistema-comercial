import Form from "next/form";
import Link from "next/link";

import { PageHeader } from "@repo/ui/page-header";

import { QuotaTargetForm } from "./quota-target-form";

import type { PerformanceQuotasData } from "../server/get-performance-quotas";

export function PerformanceQuotas({ data }: { data: PerformanceQuotasData }) {
  return (
    <div className="ui-page-stack">
      <PageHeader
        description="La cuota se mide en portabilidades entregadas en el tramo de días. No paga por sí misma: lo que paga son la comisión fija y los bonos."
        eyebrow="Rendimiento"
        meta={<Link href="/performance">← Volver a rendimiento</Link>}
        title="Cuotas por tramo de días"
      />

      <section className="performance-controls ui-surface">
        <div>
          <p className="performance-controls__eyebrow">Mes y tramo de días</p>
          <p className="performance-controls__month">
            {data.periodLabel} · {data.windowLabel}
          </p>
        </div>
        <Form action="/performance/quotas" className="performance-filter">
          <label>
            <span>Mes</span>
            {/* Admite meses futuros: la cuota se fija antes del período. */}
            <input
              defaultValue={data.periodKey}
              max={data.planningLimit}
              name="period"
              type="month"
            />
          </label>
          <label>
            <span>Tramo de días</span>
            <select defaultValue={data.window} name="window">
              {data.windowOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Aplicar</button>
        </Form>
      </section>

      {!data.editable ? (
        <p className="rounded-lg border border-ui-warning-border bg-ui-warning-soft px-4 py-3 text-sm text-ui-warning">
          Este mes ya cerró: las cuotas no se pueden cambiar porque alterarían
          los resultados ya publicados.
        </p>
      ) : null}

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Organización</p>
            <h2>Cuota total del período</h2>
            <p>
              {data.organization.distribution.covers
                ? `Repartida entre los equipos: ${data.organization.distribution.assignedTarget} de ${data.organization.target}.`
                : `Faltan ${data.organization.distribution.remaining} por repartir entre los equipos, de los ${data.organization.target} del período.`}
            </p>
          </div>
          <div className="performance-commission__aside">
            <span className="performance-panel__note">
              Portabilidades entregadas
            </span>
            <QuotaTargetForm
              disabled={!data.editable || !data.organization.canAssign}
              isDefault={data.organization.isDefault}
              period={data.periodKey}
              scope="ORG"
              target={data.organization.target}
              window={data.window}
            />
          </div>
        </header>
      </section>

      {data.teams.map((team) => (
        <section className="performance-panel" key={team.id}>
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">
                {team.hasSupervisor
                  ? "Equipo · lo reparte su supervisor"
                  : "Equipo sin supervisor · lo reparte administración"}
              </p>
              <h2>{team.name}</h2>
              <p>
                {team.distribution.covers
                  ? `Repartido ${team.distribution.assignedTarget} de ${team.distribution.teamTarget}.`
                  : `Faltan ${team.distribution.remaining} por repartir de los ${team.distribution.teamTarget} del equipo.`}
              </p>
            </div>
            <div className="performance-commission__aside">
              <span className="performance-panel__note">Cuota del equipo</span>
              <QuotaTargetForm
                disabled={!data.editable || !data.canAssignTeams}
                isDefault={team.isDefault}
                period={data.periodKey}
                scope="TEAM"
                target={team.target}
                targetId={team.id}
                window={data.window}
              />
            </div>
          </header>

          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Cuota del tramo</th>
                </tr>
              </thead>
              <tbody>
                {team.advisors.map((advisor) => (
                  <tr key={advisor.id}>
                    <td>
                      <strong>{advisor.name}</strong>
                      <small>{advisor.teamName}</small>
                    </td>
                    <td>
                      <QuotaTargetForm
                        disabled={!data.editable || !data.canAssignAdvisors}
                        isDefault={advisor.isDefault}
                        period={data.periodKey}
                        scope="USER"
                        target={advisor.target}
                        targetId={advisor.id}
                        window={data.window}
                      />
                    </td>
                  </tr>
                ))}
                {team.advisors.length === 0 ? (
                  <tr>
                    <td className="reconciliation-empty" colSpan={2}>
                      Este equipo no tiene vendedores activos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {data.teams.length === 0 ? (
        <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted">
          No hay equipos a tu cargo.
        </p>
      ) : null}
    </div>
  );
}
