import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, meta }: { eyebrow: string; title: string; description?: string; meta?: ReactNode }) {
  return (
    <header className="ui-page-header">
      <div>
        <p className="ui-page-header__eyebrow">{eyebrow}</p>
        <h1 className="ui-page-header__title">{title}</h1>
        {description ? <p className="ui-page-header__description">{description}</p> : null}
      </div>
      {meta ? <div className="ui-page-header__meta">{meta}</div> : null}
    </header>
  );
}
