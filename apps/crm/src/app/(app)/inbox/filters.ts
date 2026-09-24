import { parseView, type InboxView } from "@/server/inbox/scope";

/** Lee los filtros de la URL (`?vista=&q=&pagina=`) sin confiar en su forma. */
export function readFilters(params: Record<string, string | string[] | undefined>): { view: InboxView; query: string; page: number } {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const page = Number.parseInt(first(params.pagina), 10);
  return {
    view: parseView(params.vista),
    query: first(params.q).slice(0, 80),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
