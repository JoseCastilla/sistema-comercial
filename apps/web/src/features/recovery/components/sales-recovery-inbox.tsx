import Link from "next/link";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { internalRecoveryDueOptions } from "@repo/validation";

import { buildOrderHref } from "../order-link";
import { AssignSalesRecoveryForm } from "./assign-sales-recovery-form";

import type { SalesRecoveryInboxData } from "../server/get-sales-recovery-inbox";
import type { InternalRecoveryDue } from "@repo/validation";

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

const dueLabels = Object.fromEntries(
  internalRecoveryDueOptions.map((option) => [option.value, option.label]),
) as Record<InternalRecoveryDue, string>;

const dueHints = Object.fromEntries(
  internalRecoveryDueOptions.map((option) => [option.value, option.hint]),
) as Record<InternalRecoveryDue, string>;

function inboxHref(
  due: InternalRecoveryDue | null,
  page: number | null = null,
): string {
  const parameters = new URLSearchParams();

  if (due) parameters.set("vence", due);
  if (page && page > 1) parameters.set("page", String(page));

  const query = parameters.toString();

  return query ? `/recovery/sales?${query}` : "/recovery/sales";
}

export function SalesRecoveryInbox({ data }: { data: SalesRecoveryInboxData }) {
  const { totals, dueFilter, pagination } = data;

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
          href={dueFilter ? inboxHref(null) : undefined}
          label="Casos abiertos"
          value={totals.open}
        />
        <Metric
          hint={dueHints.primer_contacto}
          href={inboxHref("primer_contacto")}
          label={dueLabels.primer_contacto}
          tone={totals.firstContactOverdue > 0 ? "warning" : "neutral"}
          value={totals.firstContactOverdue}
        />
        <Metric
          hint={dueHints.seguimiento}
          href={inboxHref("seguimiento")}
          label={dueLabels.seguimiento}
          tone={totals.followUpOverdue > 0 ? "warning" : "neutral"}
          value={totals.followUpOverdue}
        />
        <Metric
          hint={dueHints.agenda}
          href={inboxHref("agenda")}
          label={dueLabels.agenda}
          tone={totals.agendaOverdue > 0 ? "warning" : "neutral"}
          value={totals.agendaOverdue}
        />
        <Metric
          hint="El supervisor debe asignarlas a otro asesor"
          label="Críticas sin asignar"
          tone={totals.criticalUnassigned > 0 ? "danger" : "neutral"}
          value={totals.criticalUnassigned}
        />
        <Metric
          hint="Con orden nueva vinculada"
          label="Recuperadas este mes"
          tone="success"
          value={totals.recoveredThisMonth}
        />
      </MetricGroup>

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Cola de trabajo</p>
            <h2>
              {dueFilter
                ? `${dueLabels[dueFilter]}: ${pagination.total} ${pagination.total === 1 ? "caso" : "casos"}`
                : "Casos por prioridad"}
            </h2>
            <p>
              {dueFilter ? (
                <>
                  Solo los casos con este vencimiento, en el orden de la cola.{" "}
                  <Link href={inboxHref(null)}>Ver todos los casos</Link>
                </>
              ) : (
                "Crítica nunca vuelve a quien originó la venta; el resto se queda con su asesor el primer día. Lo vencido va primero dentro de cada prioridad."
              )}
            </p>
          </div>
        </header>
        <div className="ui-table-wrap">
          <table className="ui-table">
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
                <tr data-no-sales={item.due ? "true" : undefined} key={item.id}>
                  <td>
                    <Link href={`/recovery/sales/${item.id}`}>
                      <strong>{item.holderName}</strong>
                    </Link>
                    <small>DNI {item.documentNumber}</small>
                  </td>
                  <td>
                    {item.orderCode ? (
                      <Link
                        href={buildOrderHref(
                          item.orderCode,
                          item.orderRegisteredDay,
                        )}
                      >
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
                    {item.nextActionAtLabel ??
                      (item.due === "primer_contacto" ? "Llamar ya" : "—")}
                    {item.due ? <small>{dueLabels[item.due]}</small> : null}
                  </td>
                </tr>
              ))}
              {data.cases.length === 0 ? (
                <tr>
                  <td className="reconciliation-empty" colSpan={7}>
                    {dueFilter
                      ? "Ningún caso tiene este vencimiento ahora."
                      : "No hay ventas en recuperación. Las nuevas caídas aparecerán aquí solas."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {pagination.totalPages > 1 ? (
        <nav aria-label="Páginas de casos" className="ui-pagination">
          {pagination.page > 1 ? (
            <Link
              className="ui-pagination__link"
              href={inboxHref(dueFilter, pagination.page - 1)}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}

          <span className="ui-pagination__status">
            Página {pagination.page} de {pagination.totalPages} ·{" "}
            {pagination.total} casos
          </span>

          {pagination.page < pagination.totalPages ? (
            <Link
              className="ui-pagination__link"
              href={inboxHref(dueFilter, pagination.page + 1)}
            >
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
