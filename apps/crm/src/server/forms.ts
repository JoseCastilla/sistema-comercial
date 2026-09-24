import "server-only";

/** Lectura uniforme de FormData en acciones de servidor. */
export function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function optionalText(formData: FormData, name: string): string | null {
  const value = text(formData, name);
  return value ? value : null;
}

export function integer(formData: FormData, name: string, fallback: number): number {
  const value = Number.parseInt(text(formData, name), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function decimal(formData: FormData, name: string): number | null {
  const value = Number.parseFloat(text(formData, name).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function list(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((value) => String(value).trim()).filter(Boolean);
}

export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

export interface ActionState {
  ok?: boolean;
  error?: string | null;
  message?: string | null;
}

export function failure(error: unknown, fallback = "No se pudo completar la acción."): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}
