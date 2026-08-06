import type { ElementType, ReactNode } from "react";

export function Surface({ as: Component = "section", children, raised = false, padded = false, className = "" }: { as?: ElementType; children: ReactNode; raised?: boolean; padded?: boolean; className?: string }) {
  const classes = ["ui-surface", raised ? "ui-surface--raised" : "", padded ? "ui-surface--padded" : "", className].filter(Boolean).join(" ");
  return <Component className={classes}>{children}</Component>;
}
