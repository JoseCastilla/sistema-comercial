import Link from "next/link";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";

import { AssignSalesRecoveryForm } from "./assign-sales-recovery-form";

import type { SalesRecoveryInboxData } from "../server/get-sales-recovery-inbox";

const reasonLabels: Record<string, string> = {
  NO_ENTREGADO: "No recibió",
  INCIDENCIA_LOGISTICA: "Incidencia logística",
  PROMESA_COMERCIAL_INCORRECTA: "Promesa incorrecta",
  DEUDA: "Deuda",
  ANTIGUEDAD_PORTA: "Antigüedad de porta",
  OTRO: "Otro",
};

const statusLabels: Record<string, string> = {
  OPEN: "Sin responsable",
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En gestión",
  SCHEDULED: "Agendado",
  WAITING: "Esperando confirmación",
};

const priorityLabels: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Media",
  CONDICIONADA: "Condicionada",
};

function orderHref(orderCode: string): string {
  const parameters = new URLSearchParams({ status: "ALL", q: orderCode });
  return `/orders?${parameters.toString()}`;
}

export function SalesRecoveryInbox({ data }: { data: SalesRecoveryInboxData }) {
  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Ventas propias caídas o no entregadas que todavía pueden salvarse. El primer contacto vence a las dos horas de que la venta se cayó."
        eyebrow={data.scopeLabel}
        meta={<span>Actualizado: {data.generatedAt}</span>}
        title="Recupero de ventas"
      />

      <MetricGroup label="Resumen del recupero de ventas">
        <Metric
          emphasis="hero"
          hint="De nuestras propias ventas"
          label="Casos abiertos"
          value={data.totals.open}
        />
        <Metric
          hint="Pasaron las 2 horas sin gestión"
          label="Primer contacto vencido"
          tone={data.totals.overdue > 0 ? "warning" : "neutral"}
          value={data.totals.overdue}
        />
        <Metric
          hint="El supervisor debe asignarlas a otro asesor"
          label="Críticas sin asignar"
          tone={data.totals.criticalUnassigned > 0 ? "danger" : "neutral"}
          value={data.totals.criticalUnassigned}
        />
        <Metric
          hint="Con orden nueva vinculada"
          label="Recuperadas este mes"
          tone="success"
          value={data.totals.recoveredThisMonth}
        />
      </MetricGroup>

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Cola de trabajo</p>
            <h2>Casos por prioridad</h2>
            <p>
              Crítica nunca vuelve a quien originó la venta; el resto se queda
              con su asesor el primer día.
            </p>
          </div>
        </header>
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--figures">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Venta</th>
                <th>Motivo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map((item) => (
                <tr
                  data-no-sales={item.nextActionOverdue ? "true" : undefined}
                  key={item.id}
                >
                  <td>
                    <Link href={`/recovery/sales/${item.id}`}>
                      <strong>{item.holderName}</strong>
                    </Link>
                    <small>DNI {item.documentNumber}</small>
                  </td>
                  <td>
                    {item.orderCode ? (
                      <Link href={orderHref(item.orderCode)}>
                        {item.orderCode}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <small>Se cayó el {item.noveltyAtLabel}</small>
                  </td>
                  <td>
                    {item.entryReason
                      ? (reasonLabels[item.entryReason] ?? item.entryReason)
                      : "—"}
                    {item.entryObservation ? (
                      <small title={item.entryObservation}>
                        {item.entryObservation.length > 60
                          ? `${item.entryObservation.slice(0, 60)}…`
                          : item.entryObservation}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {item.priority
                      ? (priorityLabels[item.priority] ?? item.priority)
                      : "—"}
                  </td>
                  <td>{statusLabels[item.status] ?? item.status}</td>
                  <td>
                    {item.assignedToName ?? <strong>Sin responsable</strong>}
                    {item.originalAgentName ? (
                      <small>
                        Venta de {item.originalAgentName}
                        {item.originalTeamName
                          ? ` · ${item.originalTeamName}`
                          : ""}
                      </small>
                    ) : null}
                    {data.canAssign ? (
                      <AssignSalesRecoveryForm
                        advisors={data.advisorOptions}
                        blockedAdvisorId={
                          item.isCritical ? item.originalAgentUserId : null
                        }
                        caseId={item.id}
                        hasAssignee={item.assignedToName !== null}
                      />
                    ) : null}
                  </td>
                  <td>
                    {item.nextActionAtLabel ?? "—"}
                    {item.nextActionOverdue ? <small>Vencida</small> : null}
                  </td>
                </tr>
              ))}
              {data.cases.length === 0 ? (
                <tr>
                  <td className="reconciliation-empty" colSpan={7}>
                    No hay ventas en recuperación. Las nuevas caídas aparecerán
                    aquí solas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
