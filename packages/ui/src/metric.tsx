import type { ReactNode } from "react";

export function MetricGroup({ children }: { children: ReactNode }) {
  return <section className="ui-metric-grid">{children}</section>;
}

export function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "danger" }) {
  return <article className="ui-metric" data-tone={tone}><p className="ui-metric__label">{label}</p><p className="ui-metric__value">{value}</p></article>;
}
