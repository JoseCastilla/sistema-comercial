"use client";

import { useActionState, useState } from "react";

import { buildDitoTdpEscalationTemplate } from "@repo/validation";

import { createOrderEscalationAction } from "../server/create-order-escalation-action";
import { reviewOrderEscalationAction } from "../server/review-order-escalation-action";

import type { OrderInboxItem } from "../order-inbox.types";
import type { OrderEscalationActionState } from "../server/order-escalation-action.types";

const initialState: OrderEscalationActionState = { type: "idle", message: "" };

const priorityLabels: Record<string, string> = {
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const templateTypeLabels: Record<string, string> = {
  LOGISTICS_NOT_MANAGED: "Operador logístico no gestiona el pedido",
  ORDER_NOT_CLOSED: "Pedido entregado que no se cierra",
  PORTABILITY_DATE_MISSING: "Fecha de portación no verificable",
  BAG_CORRECTION: "Cliente sin llamadas o megas (corregir bolsa)",
  OTHER: "Otra incidencia para TDP",
};

function Feedback({ state }: { state: OrderEscalationActionState }) {
  if (state.type === "idle") return null;
  return (
    <p
      aria-live="polite"
      className={
        state.type === "success"
          ? "text-sm font-medium text-ui-success"
          : "text-sm font-medium text-ui-danger"
      }
    >
      {state.message}
    </p>
  );
}

export function OrderEscalationPanel({ order }: { order: OrderInboxItem }) {
  const [createState, createAction, creating] = useActionState(
    createOrderEscalationAction,
    initialState,
  );
  const [reviewState, reviewAction, reviewing] = useActionState(
    reviewOrderEscalationAction,
    initialState,
  );
  const [reviewDecision, setReviewDecision] = useState(
    order.incidentEscalation?.status === "OPEN" ? "ACKNOWLEDGE" : "RESOLVE",
  );
  const escalation = order.incidentEscalation;
  const active =
    escalation?.status === "OPEN" || escalation?.status === "ACKNOWLEDGED";
  const suggestedTdpTemplate = escalation
    ? buildDitoTdpEscalationTemplate({
        type: escalation.templateType as
          | "LOGISTICS_NOT_MANAGED"
          | "ORDER_NOT_CLOSED"
          | "PORTABILITY_DATE_MISSING"
          | "BAG_CORRECTION"
          | "OTHER",
        orderCode: order.orderCode,
        deliveryMethod: order.deliveryMethodLabel,
        contactPhone: order.deliveryContactPhone,
        department: order.department,
        province: order.province,
        district: order.district,
        deliveryTimeRange: order.deliveryTimeRange,
        documentNumber: order.documentNumber,
        serviceNumber: order.serviceNumber,
        carrier: order.carrier,
        holderName: order.holderName,
        observation: escalation.description,
      })
    : "";

  return (
    <section
      aria-label="Incidencia escalada al supervisor"
      className="ui-order-notice"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-ui-text">
            Escalamiento al supervisor
          </h4>
          <p className="mt-1 text-xs text-ui-muted">
            La incidencia se gestiona sin cambiar el estado del pedido.
          </p>
        </div>
        {escalation ? (
          <span className="rounded-full border border-ui-warning-border bg-ui-surface px-2.5 py-1 text-xs font-semibold text-ui-warning">
            {escalation.status === "OPEN"
              ? "Pendiente"
              : escalation.status === "ACKNOWLEDGED"
                ? "En atención"
                : escalation.status === "RESOLVED"
                  ? "Resuelta"
                  : "Cancelada"}
          </span>
        ) : null}
      </div>

      {escalation ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-ui-muted">
            Prioridad{" "}
            {priorityLabels[escalation.priority] ?? escalation.priority}
          </p>
          <p className="text-ui-muted">
            <strong className="text-ui-text">Tipo de ticket:</strong>{" "}
            {templateTypeLabels[escalation.templateType] ??
              escalation.templateType}
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ui-soft">
              Incidencia
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ui-text">
              {escalation.description}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ui-soft">
              Solicitud al supervisor
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ui-text">
              {escalation.requestedAction}
            </p>
          </div>
          <p className="text-xs text-ui-muted">
            Enviada por {escalation.createdByName} · {escalation.createdAtLabel}
          </p>
          {escalation.acknowledgedAtLabel ? (
            <div className="rounded-lg border border-ui-border bg-ui-surface p-3">
              <p className="font-semibold text-ui-text">
                Supervisor: incidencia en atención
              </p>
              {escalation.acknowledgement ? (
                <p className="mt-1 whitespace-pre-wrap text-ui-muted">
                  {escalation.acknowledgement}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-ui-soft">
                {escalation.acknowledgedByName} ·{" "}
                {escalation.acknowledgedAtLabel}
              </p>
            </div>
          ) : null}
          {escalation.resolution ? (
            <div className="rounded-lg border border-ui-success bg-ui-success-soft p-3">
              <p className="font-semibold text-ui-success">Respuesta final</p>
              <p className="mt-1 whitespace-pre-wrap text-ui-text">
                {escalation.resolution}
              </p>
              <p className="mt-1 text-xs text-ui-muted">
                {escalation.resolvedByName} · {escalation.resolvedAtLabel}
              </p>
            </div>
          ) : null}
          {escalation.tdpTemplate ? (
            <div className="rounded-lg border border-ui-info-border bg-ui-info-soft p-3">
              <p className="font-semibold text-ui-info">Escalado a TDP</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ui-text">
                {escalation.tdpTemplate}
              </pre>
              <p className="mt-2 text-xs text-ui-muted">
                {escalation.tdpEscalatedByName} ·{" "}
                {escalation.tdpEscalatedAtLabel}
              </p>
              <button
                className="mt-2 rounded-lg border border-ui-border bg-ui-surface px-3 py-1.5 text-xs font-semibold text-ui-text"
                onClick={() =>
                  navigator.clipboard.writeText(escalation.tdpTemplate!)
                }
                type="button"
              >
                Copiar plantilla
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {order.canReviewEscalation && escalation && active ? (
        <form action={reviewAction} className="mt-4 space-y-3">
          <input name="escalationId" type="hidden" value={escalation.id} />
          <label className="block text-sm font-medium text-ui-text">
            Acción
            <select
              className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
              name="decision"
              onChange={(event) => setReviewDecision(event.target.value)}
              value={reviewDecision}
            >
              <option value="ACKNOWLEDGE">Tomar la incidencia</option>
              <option value="ESCALATE_TDP">Completar y escalar a TDP</option>
              <option value="RESOLVE">Resolver y responder</option>
            </select>
          </label>
          {reviewDecision === "ESCALATE_TDP" ? (
            <label className="block text-sm font-medium text-ui-text">
              Plantilla para escalar a TDP
              <textarea
                className="mt-1 min-h-64 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 font-mono text-xs"
                defaultValue={escalation.tdpTemplate ?? suggestedTdpTemplate}
                maxLength={4000}
                name="tdpTemplate"
              />
              <span className="mt-1 block text-xs font-normal text-ui-muted">
                Los datos de la venta ya están completados. Revisa la
                observación antes de enviarla al área responsable.
              </span>
            </label>
          ) : null}
          <label className="block text-sm font-medium text-ui-text">
            Respuesta al asesor
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
              maxLength={2000}
              name="response"
              placeholder="Indica qué se revisó o cómo debe proceder."
            />
          </label>
          <Feedback state={reviewState} />
          <button
            className="rounded-lg bg-ui-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={reviewing}
            type="submit"
          >
            {reviewing ? "Guardando…" : "Guardar atención"}
          </button>
        </form>
      ) : null}

      {order.canEscalate ? (
        <details className="mt-4 rounded-lg border border-ui-border bg-ui-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ui-text">
            {escalation ? "Escalar una nueva incidencia" : "Escalar incidencia"}
          </summary>
          <form action={createAction} className="mt-4 space-y-3">
            <input name="orderId" type="hidden" value={order.id} />
            <input name="category" type="hidden" value="OTHER" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-ui-text">
                Tipo de ticket
                <select
                  className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
                  defaultValue="LOGISTICS_NOT_MANAGED"
                  name="templateType"
                >
                  {Object.entries(templateTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-ui-text">
                Prioridad
                <select
                  className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
                  defaultValue="MEDIUM"
                  name="priority"
                >
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-ui-text">
              ¿Qué ocurrió?
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
                maxLength={2000}
                minLength={10}
                name="description"
                required
              />
            </label>
            <label className="block text-sm font-medium text-ui-text">
              ¿Qué necesitas del supervisor?
              <input
                className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
                maxLength={500}
                minLength={5}
                name="requestedAction"
                required
              />
            </label>
            <Feedback state={createState} />
            <button
              className="rounded-lg bg-ui-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={creating}
              type="submit"
            >
              {creating ? "Enviando…" : "Notificar al supervisor"}
            </button>
          </form>
        </details>
      ) : null}
    </section>
  );
}
