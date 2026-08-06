import type { ReactNode } from "react";

export function StatePanel({ title, description, tone = "neutral", action, busy = false }: { title: string; description: string; tone?: "neutral" | "danger" | "warning"; action?: ReactNode; busy?: boolean }) {
  return <section aria-busy={busy || undefined} className="ui-state-panel" data-tone={tone} role={tone === "danger" ? "alert" : "status"}><div className="ui-state-panel__indicator" /><div><h1 className="ui-state-panel__title">{title}</h1><p className="ui-state-panel__description">{description}</p>{action ? <div className="ui-state-panel__action">{action}</div> : null}</div></section>;
}

export function LoadingState({ label = "Cargando información" }: { label?: string }) {
  return <StatePanel busy description="Esto tomará solo un momento." title={label} />;
}

export function ConflictState({ description }: { description: string }) {
  return <StatePanel description={description} title="La información cambió" tone="warning" />;
}

export function PermissionState({ description }: { description: string }) {
  return <StatePanel description={description} title="No tienes acceso a esta sección" tone="danger" />;
}
