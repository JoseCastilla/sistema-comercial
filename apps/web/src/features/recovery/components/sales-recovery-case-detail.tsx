import Link from "next/link";

import { PageHeader } from "@repo/ui/page-header";
import { attemptResultLabels } from "../attempt-result-labels";

import { RegisterAttemptForm } from "./register-attempt-form";
import { ResolveCaseForm } from "./resolve-case-form";

import type { SalesRecoveryCaseDetail } from "../server/get-sales-recovery-case";

const reasonLabels: Record<string, string> = {
  NO_ENTREGADO: "No recibió",
  INCIDENCIA_LOGISTICA: "Incidencia logística",
  PROMESA_COMERCIAL_INCORRECTA: "Promesa comercial incorrecta",
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
  RECOVERED: "Recuperado",
  LOST: "Perdido",
  DISCARDED: "Cerrado: ya era Movistar",
};

const priorityLabels: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Media",
  CONDICIONADA: "Condicionada",
};

const channelLabels: Record<string, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  PRESENCIAL: "Presencial",
  OTRO: "Otro",
};

const resultLabels = attemptResultLabels;

export function SalesRecoveryCaseDetail({
  data,
}: {
  data: SalesRecoveryCaseDetail;
}) {
  return (
    <div className="ui-page-stack">
      <PageHeader
        description={
          data.isResolved
            ? (data.resolutionLabel ?? "Caso resuelto")
            : "Registra cada intento; el sistema te dice cuándo volver a llamar."
        }
        eyebrow={`Recupero de ventas · ${data.priority ? (priorityLabels[data.priority] ?? data.priority) : "Sin prioridad"}`}
        meta={<Link href="/recovery/sales">← Volver a la bandeja</Link>}
        title={data.holderName}
      />

      <section aria-label="Datos del caso" className="reconciliation-summary">
        <article>
          <span>Estado</span>
          <strong>{statusLabels[data.status] ?? data.status}</strong>
          <small>
            {data.assignedToName
              ? `Responsable: ${data.assignedToName}`
              : "Sin responsable"}
          </small>
        </article>
        <article>
          <span>Venta origen</span>
          <strong>
            {data.orderCode ? (
              <Link href={`/orders?status=ALL&q=${data.orderCode}`}>
                {data.orderCode}
              </Link>
            ) : (
              "—"
            )}
          </strong>
          <small>
            {data.originalAgentName
              ? `Venta de ${data.originalAgentName}${data.originalTeamName ? ` · ${data.originalTeamName}` : ""}`
              : "Sin asesor registrado"}
          </small>
        </article>
        <article>
          <span>Contacto</span>
          <strong>{data.contactPhone ?? "—"}</strong>
          <small>DNI {data.documentNumber}</small>
        </article>
        <article
          data-tone={
            data.nextActionOverdue && !data.isResolved ? "attention" : undefined
          }
        >
          <span>Próxima acción</span>
          <strong>{data.nextActionAtLabel ?? "—"}</strong>
          <small>
            {data.isResolved
              ? "Caso cerrado"
              : data.nextActionOverdue
                ? "Vencida: gestionar ahora"
                : data.firstContactAtLabel
                  ? `Primer contacto ${data.firstContactAtLabel}`
                  : "Aún sin primer contacto"}
          </small>
        </article>
      </section>

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Motivo de entrada</p>
            <h2>
              {data.entryReason
                ? (reasonLabels[data.entryReason] ?? data.entryReason)
                : "Sin motivo"}
            </h2>
            {data.entryObservation ? (
              <p className="whitespace-pre-wrap">{data.entryObservation}</p>
            ) : null}
          </div>
        </header>
      </section>

      {data.canManage && !data.isResolved ? (
        <div className="performance-insight-grid">
          <section className="performance-panel">
            <header className="performance-panel__header">
              <div>
                <p className="performance-panel__eyebrow">Gestión</p>
                <h2>Registrar intento</h2>
              </div>
            </header>
            <RegisterAttemptForm caseId={data.id} />
          </section>
          <section className="performance-panel">
            <header className="performance-panel__header">
              <div>
                <p className="performance-panel__eyebrow">Cierre</p>
                <h2>Resolver el caso</h2>
              </div>
            </header>
            <ResolveCaseForm
              canUseOther={data.canResolveOther}
              caseId={data.id}
              gates={data.lossReasonGates}
              suggestions={data.recoveredOrderSuggestions}
            />
          </section>
        </div>
      ) : null}

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Historial</p>
            <h2>Intentos registrados</h2>
            <p>
              Los intentos no se pueden editar y queda registrado quién los
              hizo.
            </p>
          </div>
        </header>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Momento</th>
                <th>Canal</th>
                <th>Resultado</th>
                <th>Teléfono</th>
                <th>Observación</th>
                <th>Quién lo registró</th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td>{attempt.createdAtLabel}</td>
                  <td>{channelLabels[attempt.channel] ?? attempt.channel}</td>
                  <td>{resultLabels[attempt.result] ?? attempt.result}</td>
                  <td>{attempt.phoneUsed ?? "—"}</td>
                  <td>{attempt.observation ?? "—"}</td>
                  <td>{attempt.actorName}</td>
                </tr>
              ))}
              {data.attempts.length === 0 ? (
                <tr>
                  <td className="reconciliation-empty" colSpan={6}>
                    Aún no hay intentos registrados.
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
