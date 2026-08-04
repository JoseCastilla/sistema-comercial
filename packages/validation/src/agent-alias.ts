export function normalizeAgentAlias(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalized || null;
}
