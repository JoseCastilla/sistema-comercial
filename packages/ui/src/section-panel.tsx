import type { ReactNode } from "react";

export function SectionPanel({ title, description, children, aside }: { title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return <section className="ui-section-panel"><header className="ui-section-panel__header"><div><h2 className="ui-section-panel__title">{title}</h2>{description ? <p className="ui-section-panel__description">{description}</p> : null}</div>{aside}</header><div className="ui-section-panel__body">{children}</div></section>;
}
