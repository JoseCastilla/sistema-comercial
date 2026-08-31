import Link from "next/link";

import { PageHeader } from "@repo/ui/page-header";

import { QuotaTargetForm } from "./quota-target-form";

import type { PerformanceQuotasData } from "../server/get-performance-quotas";

export function PerformanceQuotas({ data }: { data: PerformanceQuotasData }) {
  return (
    <div className="ui-page-stack">
      <PageHeader
        description="La cuota se mide en portabilidades entregadas de la ventana. No paga por sí misma: lo que paga son la comisión base y los aceleradores."
        eyebrow="Rendimiento"
        meta={<Link href="/performance">← Volver a rendimiento</Link>}
        title="Cuotas por ventana"
      />

      <section className="performance-controls ui-surface">
        <div>
          <p className="performance-controls__eyebrow">Período y ventana</p>
          <p className="performance-controls__month">
            {data.periodLabel} · {data.windowLabel}
          </p>
        </div>
        <form className="performance-filter" method="get">
          <label>
            <span>Mes</span>
            <input
              defaultValue={data.periodKey}
              max={data.currentPeriodKey}
              name="period"
              type="month"
            />
          </label>
          <label>
            <span>Ventana</span>
            <select defaultValue={data.window} name="window">
              {data.windowOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      {!data.editable ? (
        <p className="rounded-lg border border-ui-warning-border bg-ui-warning-soft px-4 py-3 text-sm text-ui-warning">
          Este período ya terminó, así que sus cuotas quedaron congeladas.
          Cambiarlas reescribiría la historia de cumplimiento.
        </p>
      ) : null}

      {data.teams.map((team) => (
        <section className="performance-panel" key={team.id}>
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Equipo</p>
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
                  <th>Cuota de la ventana</th>
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
          No hay equipos dentro de tu alcance.
        </p>
      ) : null}
    </div>
  );
}
