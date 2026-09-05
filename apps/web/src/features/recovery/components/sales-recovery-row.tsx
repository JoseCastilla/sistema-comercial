"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";

import {
  internalRecoveryDueOptions,
  salesRecoveryOpenStatusOptions,
  salesRecoveryPriorityOptions,
  salesRecoveryReasonOptions,
  salesRecoveryResolvedStatusOptions,
} from "@repo/validation";

import {
  attemptResultLabels,
  attemptResultTones,
} from "../attempt-result-labels";
import { buildOrderHref } from "../order-link";
import { AssignSalesRecoveryForm } from "./assign-sales-recovery-form";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "./campaign-attempt-editor";
import { useCampaignDraft } from "./campaign-draft-context";
import { CopyValue } from "./copy-value";

import type { SalesRecoveryCaseItem } from "../server/get-sales-recovery-inbox";

const toLabels = (
  options: ReadonlyArray<{ value: string; label: string }>,
): Record<string, string> =>
  Object.fromEntries(options.map((option) => [option.value, option.label]));

const reasonLabels = toLabels(salesRecoveryReasonOptions);
const statusLabels = {
  ...toLabels(salesRecoveryOpenStatusOptions),
  ...toLabels(salesRecoveryResolvedStatusOptions),
};
const priorityLabels = toLabels(salesRecoveryPriorityOptions);
const dueLabels = toLabels(internalRecoveryDueOptions);

export const salesRecoveryColumnCount = 8;

/**
 * Fila de la bandeja de recupero — SPEC-041 fase 3 (REC-04, REC-05).
 *
 * Antes cada fila traía el formulario de reasignación abierto y para
 * registrar una llamada había que abrir la ficha. Ahora la fila enseña el
 * teléfono copiable, la última gestión y la etapa de la cadencia, y desde
 * aquí mismo se registra la siguiente con el editor de Campañas (BR-090):
 * una sola gestión abierta a la vez, clave de idempotencia, y la fila se
 * actualiza con lo que el servidor confirmó. Reasignar se abre solo al
 * pedirlo.
 */
export function SalesRecoveryRow({
  item,
  canAssign,
  advisors,
  resolvedView,
}: {
  item: SalesRecoveryCaseItem;
  canAssign: boolean;
  advisors: Array<{ id: string; name: string; teamName: string }>;
  resolvedView: boolean;
}) {
  const draft = useCampaignDraft();
  const editorId = useId();
  const editing = draft.editingId === item.id;
  const [reassigning, setReassigning] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedAttempt | null>(null);
  const [unmanageableReason, setUnmanageableReason] = useState<string | null>(
    null,
  );

  const handleSaved = useCallback((attempt: ConfirmedAttempt) => {
    setConfirmed(attempt);
  }, []);

  const lastResult = confirmed?.result ?? item.lastResult;
  const lastObservation = confirmed
    ? confirmed.observation
    : item.lastObservation;
  const status = confirmed?.status ?? item.status;
  const nextActionAtLabel = confirmed
    ? confirmed.nextActionAtLabel
    : item.nextActionAtLabel;
  // Tras guardar, lo vencido dejó de estarlo: la próxima acción es nueva.
  const due = confirmed ? null : item.due;
  const stageLabel = confirmed
    ? confirmed.mustResolve
      ? "Cadencia agotada"
      : confirmed.status === "SCHEDULED"
        ? "Agenda acordada"
        : confirmed.result === "RECHAZA" || confirmed.result === "CANCELADO"
          ? "En pausa"
          : "Seguimiento"
    : item.stage?.label;
  const stageDetail = confirmed ? undefined : item.stage?.detail;
  const tone = lastResult ? attemptResultTones[lastResult] : undefined;

  return (
    <>
      <tr
        aria-selected={editing || undefined}
        className={editing ? "bg-ui-accent-soft" : undefined}
        data-no-sales={due ? "true" : undefined}
        data-result-tone={tone}
        key={item.id}
      >
        <td>
          <Link href={`/recovery/sales/${item.id}`}>
            <strong>{item.holderName}</strong>
          </Link>
          <small>
            DNI <CopyValue label="DNI" value={item.documentNumber} />
          </small>
          {item.contactPhone ? (
            <small>
              <CopyValue label="Teléfono" value={item.contactPhone} />
            </small>
          ) : null}
        </td>
        <td>
          {item.orderCode ? (
            <Link
              href={buildOrderHref(item.orderCode, item.orderRegisteredDay)}
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
        <td>{statusLabels[status] ?? status}</td>
        <td>
          {item.assignedToName ?? <strong>Sin responsable</strong>}
          {item.originalAgentName ? (
            <small>
              Venta de {item.originalAgentName}
              {item.originalTeamName ? ` · ${item.originalTeamName}` : ""}
            </small>
          ) : null}
          {canAssign && !resolvedView ? (
            reassigning ? (
              <AssignSalesRecoveryForm
                advisors={advisors}
                blockedAdvisorId={
                  item.isCritical ? item.originalAgentUserId : null
                }
                caseId={item.id}
                hasAssignee={item.assignedToName !== null}
              />
            ) : (
              <button
                className="ui-row-toggle mt-1"
                onClick={() => setReassigning(true)}
                type="button"
              >
                {item.assignedToName ? "Reasignar" : "Asignar"}
              </button>
            )
          ) : null}
        </td>
        <td className="text-xs">
          <span
            className="ui-status-badge"
            data-tone={lastResult ? (tone ?? "neutral") : "neutral"}
          >
            {lastResult
              ? (attemptResultLabels[lastResult] ?? lastResult)
              : "Sin gestión"}
          </span>
          {lastObservation ? (
            <small className="ui-cell-clamp" title={lastObservation}>
              {lastObservation}
            </small>
          ) : null}
          {item.lastAttemptAtLabel && !confirmed ? (
            <small>{item.lastAttemptAtLabel}</small>
          ) : null}
          {unmanageableReason ? (
            <small className="text-ui-danger">{unmanageableReason}</small>
          ) : item.canManage && !resolvedView && !editing ? (
            <button
              aria-controls={editorId}
              aria-expanded={false}
              className="ui-row-toggle mt-1"
              onClick={() => draft.startEditing(item.id)}
              type="button"
            >
              Registrar gestión
            </button>
          ) : null}
        </td>
        <td>
          {resolvedView ? (
            <>
              {item.resolutionLabel ?? "—"}
              {item.resolvedAtLabel ? (
                <small>El {item.resolvedAtLabel}</small>
              ) : null}
            </>
          ) : (
            <>
              {nextActionAtLabel ??
                (due === "primer_contacto" ? "Llamar ya" : "—")}
              {due ? (
                <small>{dueLabels[due] ?? due}</small>
              ) : stageLabel ? (
                <small title={stageDetail}>{stageLabel}</small>
              ) : null}
            </>
          )}
        </td>
      </tr>

      {editing ? (
        <tr data-result-tone={tone}>
          <td
            className="ui-row-panel"
            colSpan={salesRecoveryColumnCount}
            id={editorId}
          >
            <p className="mb-2 text-sm font-medium text-ui-text lg:hidden">
              {item.holderName} · {item.documentNumber}
            </p>
            <CampaignAttemptEditor
              caseId={item.id}
              defaultPhone={item.contactPhone}
              holderName={item.holderName}
              lastObservation={lastObservation}
              lastResult={lastResult}
              onCancel={draft.stopEditing}
              onSaved={handleSaved}
              onUnmanageable={setUnmanageableReason}
              phoneOptions={item.phoneOptions}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}
