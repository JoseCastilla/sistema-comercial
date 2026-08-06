export function StatusBadge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "success" | "danger" | "warning" | "info" }) {
  return <span className="ui-status-badge" data-tone={tone}>{children}</span>;
}
