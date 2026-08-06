export function InlineFeedback({ message, tone = "neutral" }: { message?: string; tone?: "neutral" | "success" | "danger" | "warning" }) {
  if (!message) return null;
  return <p aria-live="polite" className="ui-feedback" data-tone={tone}>{message}</p>;
}
