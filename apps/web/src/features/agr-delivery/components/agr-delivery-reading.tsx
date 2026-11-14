import { CopyValue } from "@/features/recovery/components/copy-value";

import { agrDeliveryReadingKeys } from "../delivery-reading";

import type { AgrDeliveryReading, AgrDeliveryStep } from "../delivery-reading";

/**
 * SPEC-089: «Entrega según Máximo». La misma pieza en la ficha del pedido
 * (asesor, supervisor y administrador) y en la de Recupero de ventas: estado,
 * motivo final, cuántas visitas registra Máximo, qué se anotó en cada una y
 * cómo terminó; la secuencia completa, plegada.
 */
export function AgrDeliveryReadingBlock({
  reading,
  source = "Máximo",
  tone,
  footer,
  extraFields = [],
}: {
  reading: AgrDeliveryReading;
  /** «Máximo» o, si ya no se consulta, «Último dato de Máximo». */
  source?: string;
  tone: "warning" | "neutral";
  /** «Consultado 11/11/2026, 09:26». */
  footer: string;
  /**
   * Lo demás que manda Máximo con valor (SPEC-075): se muestra sin perderlo,
   * debajo, en letra chica. Lo que este bloque ya dice se descarta aquí.
   */
  extraFields?: ReadonlyArray<{ key: string; label: string; value: string }>;
}) {
  const extras = extraFields.filter(
    (field) => !agrDeliveryReadingKeys.has(field.key),
  );
  const hasSteps = reading.visits.length > 0 || reading.closure !== null;

  return (
    <section
      aria-label="Entrega según Máximo"
      className="ui-order-notice ui-agr-reading"
      data-tone={tone}
    >
      <h4 className="ui-order-notice__headline">
        <span className="ui-order-notice__source">{source}</span>
        {" · "}
        {reading.stateLabel}
      </h4>

      {reading.lastMovementLabel || reading.pedido ? (
        <p className="ui-agr-reading__meta">
          {reading.lastMovementLabel ? (
            <span>Último movimiento {reading.lastMovementLabel}</span>
          ) : null}
          {/* Sin separador: en 258 px «Pedido» baja de línea y un «·» quedaba colgando. */}
          {reading.pedido ? (
            <span>
              Pedido <CopyValue label="pedido de Máximo" value={reading.pedido} />
            </span>
          ) : null}
        </p>
      ) : null}

      {reading.reason ? (
        <p className="ui-agr-reading__reason">{reading.reason}</p>
      ) : null}

      {reading.visitsSummary ? (
        <p
          className="ui-agr-reading__summary"
          data-mismatch={reading.visitsMismatch ? "true" : undefined}
        >
          {reading.visitsSummary}
        </p>
      ) : null}

      {hasSteps ? (
        <ol aria-label="Visitas" className="ui-agr-reading__steps">
          {reading.visits.map((visit, index) => (
            <StepItem
              key={visit.seq}
              step={visit}
              title={`Visita ${index + 1}`}
            />
          ))}
          {reading.closure ? (
            <li className="ui-agr-reading__step">
              <p className="ui-agr-reading__step-title">
                <strong>{reading.closure.stateLabel}</strong>
                {reading.closure.dateLabel
                  ? ` · ${reading.closure.dateLabel}`
                  : ""}
              </p>
              {/* El motivo del cierre ya va arriba si es el mismo. */}
              {reading.closure.reason &&
              reading.closure.reason !== reading.reason ? (
                <p className="ui-agr-reading__step-reason">
                  {reading.closure.reason}
                </p>
              ) : null}
              {reading.closure.comments.map((comment) => (
                <p className="ui-agr-reading__comment" key={comment}>
                  «{comment}»
                </p>
              ))}
              {reading.closure.meta ? (
                <p className="ui-agr-reading__step-meta">
                  {reading.closure.meta}
                </p>
              ) : null}
            </li>
          ) : null}
        </ol>
      ) : null}

      {extras.length > 0 ? (
        <dl className="ui-agr-reading__extra">
          {extras.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {reading.movements.length > 0 ? (
        <details className="ui-agr-reading__all">
          <summary>Ver todos los movimientos ({reading.movements.length})</summary>
          <ol aria-label="Todos los movimientos">
            {reading.movements.map((step) => (
              <li key={step.seq}>
                <span className="font-semibold text-ui-text">
                  {step.stateLabel}
                </span>
                {step.dateLabel ? (
                  <span className="text-ui-muted"> · {step.dateLabel}</span>
                ) : null}
                {step.reason ? (
                  <span className="block text-ui-text">{step.reason}</span>
                ) : null}
                {step.comment ? (
                  <span className="ui-agr-reading__comment block">
                    «{step.comment}»
                  </span>
                ) : null}
                {step.meta ? (
                  <span className="block text-ui-muted">{step.meta}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <p className="ui-agr-reading__footer">{footer}</p>
    </section>
  );
}

function StepItem({ step, title }: { step: AgrDeliveryStep; title: string }) {
  return (
    <li className="ui-agr-reading__step">
      <p className="ui-agr-reading__step-title">
        <strong>{title}</strong>
        {step.dateLabel ? ` · ${step.dateLabel}` : ""}
      </p>
      {step.reason ? (
        <p className="ui-agr-reading__step-reason">{step.reason}</p>
      ) : null}
      {step.comment ? (
        <p className="ui-agr-reading__comment">«{step.comment}»</p>
      ) : null}
      {step.meta ? (
        <p className="ui-agr-reading__step-meta">{step.meta}</p>
      ) : null}
    </li>
  );
}
