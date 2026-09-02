import Link from "next/link";
import type { ReactNode } from "react";

import { formatCount } from "./format";

export function MetricGroup({
  children,
  label,
}: {
  children: ReactNode;
  /** Nombre accesible de la fila, cuando la pantalla tiene mas de un grupo. */
  label?: string;
}) {
  return (
    <section aria-label={label} className="ui-metric-grid">
      {children}
    </section>
  );
}

/**
 * Tarjeta de cifra.
 *
 * Un stat tile es el formato correcto para **un valor numérico actual que el
 * lector necesita conocer ahora**. No es el lugar para un estado, una fecha ni
 * para las partes de un total que ya está en pantalla: eso convierte la fila
 * de tarjetas en ruido con el mismo peso visual que el dato accionable.
 *
 * - `emphasis="hero"`: la cifra que encabeza la pantalla. Una por vista. La
 *   jerarquía se expresa con tamaño, nunca con color: cuando cada tarjeta se
 *   pinta de un color distinto para «destacarla», ninguna destaca.
 * - `tone`: reservado para el estado del dato (bien / atención / problema),
 *   no para la importancia. Los cuatro valores son los mismos en todo el
 *   sistema.
 * - `hideWhenZero`: para lo que solo importa cuando exige acción. Un cero
 *   ocupando una tarjeta entera es la ausencia de dato, no un dato.
 * - `href`: convierte la tarjeta en el acceso al detalle.
 * - Los `number` se formatean acá, de modo que ninguna pantalla pueda volver a
 *   imprimir la misma variable con dos formatos distintos.
 */
export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  emphasis = "default",
  hideWhenZero = false,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "danger" | "warning" | "success";
  emphasis?: "default" | "hero";
  hideWhenZero?: boolean;
  href?: string;
}) {
  if (hideWhenZero && typeof value === "number" && value === 0) return null;

  const content = (
    <>
      <p className="ui-metric__label">{label}</p>
      <p className="ui-metric__value">
        {typeof value === "number" ? formatCount(value) : value}
      </p>
      {hint ? <p className="ui-metric__hint">{hint}</p> : null}
    </>
  );

  return href ? (
    <Link
      className="ui-metric"
      data-emphasis={emphasis}
      data-interactive="true"
      data-tone={tone}
      href={href}
    >
      {content}
    </Link>
  ) : (
    <article className="ui-metric" data-emphasis={emphasis} data-tone={tone}>
      {content}
    </article>
  );
}
