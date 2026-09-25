"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { attemptResultLabels } from "../attempt-result-labels";
import { buildOrderHref } from "../order-link";
import { AssignSalesRecoveryForm } from "./assign-sales-recovery-form";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "./campaign-attempt-editor";
import { useCampaignDraft } from "./campaign-draft-context";
import { PhoneNumber } from "./phone-number";

import type { SalesRecoveryCaseItem } from "../server/get-sales-recovery-inbox";

/**
 * Una venta caída en la bandeja — SPEC-041 y SPEC-068. La tarjeta de «Mi
 * día»: el plazo con la misma regla, el cliente con su teléfono, qué hacer y
 * por qué se cayó; debajo, la última gestión y quién la tiene. «Registrar
 * gestión» abre el editor en la tarjeta (BR-090) y «Reasignar» su formulario,
 * solo al pedirlo. Antes era una fila de ocho columnas que no cabía: la
 * gestión y la próxima acción quedaban cortadas a la derecha.
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
  const assignId = useId();
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
  const lastLine = lastResult
    ? [
        `Última gestión: ${attemptResultLabels[lastResult] ?? lastResult}`,
        confirmed ? null : item.lastAttemptAtLabel,
        lastObservation ? `«${lastObservation}»` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Sin gestión";
  const ownerLine = [
    item.assignedToName
      ? `Responsable: ${item.assignedToName}`
      : "Sin responsable",
    // BR-012: el vendedor solo si no es quien la tiene.
    item.originalAgentName && !item.sellerIsAssignee
      ? `venta de ${item.originalAgentName}${item.originalTeamName ? ` · ${item.originalTeamName}` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const canReassign = canAssign && !resolvedView;

  return (
    <article
      aria-current={editing || undefined}
      className={`rounded-lg border bg-ui-surface ${
        editing ? "border-ui-accent" : "border-ui-border"
      } ${confirmed && !editing ? "opacity-70" : ""}`}
      id={`venta-${item.id}`}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
            {confirmed ? (
              <Badge tone="success">
                Gestionado:{" "}
                {attemptResultLabels[confirmed.result] ?? confirmed.result}
              </Badge>
            ) : item.hot && item.work?.due ? (
              <Badge tone={item.work.due.tone}>{item.work.due.label}</Badge>
            ) : null}
            {item.isCritical ? <Badge tone="danger">Crítica</Badge> : null}
            <span>
              Venta del {item.saleDayLabel}
              {item.orderCode ? (
                <>
                  {" · pedido "}
                  <Link
                    className="text-ui-accent underline-offset-2 hover:underline"
                    href={buildOrderHref(item.orderCode, item.orderRegisteredDay)}
                  >
                    {item.orderCode}
                  </Link>
                </>
              ) : null}
            </span>
          </p>
          <h3 className="mt-1 flex flex-wrap items-baseline gap-x-3 text-base font-semibold text-ui-text">
            <Link
              className="min-w-0 truncate underline-offset-2 hover:underline"
              href={`/recovery/sales/${item.id}`}
            >
              {item.holderName}
            </Link>
            {item.contactPhone ? <PhoneNumber phone={item.contactPhone} /> : null}
          </h3>
          <p className="mt-0.5 text-sm text-ui-text">
            {resolvedView
              ? [item.resolutionLabel, item.resolvedAtLabel ? `el ${item.resolvedAtLabel}` : null]
                  .filter(Boolean)
                  .join(" · ")
              : confirmed
                ? confirmed.nextActionAtLabel
                  ? `Próxima acción: ${confirmed.nextActionAtLabel}`
                  : "Gestión registrada"
                : (item.work?.action ?? "Sin acción pendiente")}
          </p>
          {item.fallReason && !confirmed ? (
            <p className="mt-0.5 text-xs text-ui-muted">{item.fallReason}</p>
          ) : null}
          {unmanageableReason ? (
            <p className="mt-0.5 text-xs text-ui-danger">{unmanageableReason}</p>
          ) : null}
          <p className="mt-1 text-xs text-ui-muted">
            <span className="line-clamp-2">{lastLine}</span>
            <span className="block">{ownerLine}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {canReassign ? (
            <Button
              aria-controls={assignId}
              aria-expanded={reassigning}
              onClick={() => setReassigning((current) => !current)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {item.assignedToName ? "Reasignar" : "Asignar"}
            </Button>
          ) : null}
          <Button asChild size="inline" variant="link">
            <Link href={`/recovery/sales/${item.id}`}>Abrir caso</Link>
          </Button>
          {item.canManage && !resolvedView && !editing && !unmanageableReason ? (
            <Button
              aria-controls={editorId}
              aria-expanded={false}
              aria-label={`Registrar gestión: ${item.holderName}`}
              onClick={() => draft.startEditing(item.id)}
              type="button"
            >
              {confirmed ? "Otra gestión" : "Registrar gestión"}
            </Button>
          ) : null}
        </div>
      </div>

      {canReassign && reassigning ? (
        <div className="border-t border-ui-border bg-ui-subtle p-4" id={assignId}>
          <AssignSalesRecoveryForm
            advisors={advisors}
            blockedAdvisorId={item.isCritical ? item.originalAgentUserId : null}
            caseId={item.id}
            hasAssignee={item.assignedToName !== null}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="border-t border-ui-border bg-ui-subtle p-4" id={editorId}>
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
        </div>
      ) : null}
    </article>
  );
}
