"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

const debounceMs = 300;
/** Menos de dos caracteres devuelve el directorio entero: no es una búsqueda. */
const minimumSearchLength = 2;

export interface DirectoryFilterSelect {
  /** Nombre del parámetro en la URL. */
  key: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Barra de filtros en vivo de los directorios administrativos — SPEC-043
 * UX-06 (BR-010).
 *
 * La misma mecánica que las colas de Campañas y la bandeja de Pedidos: el
 * estado vive en la URL, los selectores aplican al cambiar, el texto espera
 * 300 ms (Enter aplica al instante), los filtros activos se ven y se quitan
 * uno a uno. No sabe de personas ni de equipos: cada directorio declara sus
 * selectores y qué otros parámetros deben conservarse (el panel abierto).
 */
export function DirectoryFilters({
  basePath,
  search,
  selects,
  preserve = {},
  resultLabel,
}: {
  basePath: string;
  search: { value: string; label: string; placeholder: string };
  selects: DirectoryFilterSelect[];
  /** Parámetros que viajan intactos con cualquier cambio (p. ej. `persona`). */
  preserve?: Record<string, string>;
  resultLabel: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(search.value);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentSearch = useRef(search.value);

  useEffect(() => () => clearTimer(timer), []);

  // El servidor manda cuando el cambio no vino de aquí (Atrás, un enlace).
  useEffect(() => {
    if (search.value !== sentSearch.current) {
      sentSearch.current = search.value;
      setTerm(search.value);
    }
  }, [search.value]);

  function navigate(overrides: Record<string, string>) {
    clearTimer(timer);

    const next = new URLSearchParams();
    const values: Record<string, string> = {
      q: term,
      ...Object.fromEntries(
        selects.map((select) => [select.key, select.value]),
      ),
      ...overrides,
    };

    for (const [key, value] of Object.entries(preserve)) {
      if (value) next.set(key, value);
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
    }

    sentSearch.current = values.q ?? "";

    const suffix = next.toString();

    startTransition(() => {
      router.replace(`${basePath}${suffix ? `?${suffix}` : ""}`, {
        scroll: false,
      });
    });
  }

  function scheduleSearch(value: string) {
    clearTimer(timer);
    timer.current = setTimeout(() => navigate({ q: value }), debounceMs);
  }

  const searchable =
    term.length === 0 || term.trim().length >= minimumSearchLength;

  const chips: Array<{ key: string; label: string }> = [
    ...(search.value ? [{ key: "q", label: `Busca «${search.value}»` }] : []),
    ...selects
      .filter((select) => select.value)
      .map((select) => ({
        key: select.key,
        label: `${select.label}: ${
          select.options.find((option) => option.value === select.value)
            ?.label ?? select.value
        }`,
      })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="ui-label-eyebrow">{search.label}</span>
          <div className="flex items-center gap-1">
            <input
              aria-busy={pending}
              className="block w-64 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              maxLength={100}
              name="q"
              onChange={(event) => {
                const value = event.target.value;
                setTerm(value);

                if (
                  value.length === 0 ||
                  value.trim().length >= minimumSearchLength
                ) {
                  scheduleSearch(value);
                } else {
                  clearTimer(timer);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                navigate({ q: term });
              }}
              placeholder={search.placeholder}
              type="search"
              value={term}
            />
            {term.length > 0 ? (
              <button
                className="ui-button ui-button--quiet px-2 py-2"
                onClick={() => {
                  setTerm("");
                  navigate({ q: "" });
                }}
                title="Limpiar la búsqueda"
                type="button"
              >
                ✕
              </button>
            ) : null}
          </div>
        </label>

        {selects.map((select) => (
          <label className="block" key={select.key}>
            <span className="ui-label-eyebrow">{select.label}</span>
            <select
              className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              onChange={(event) =>
                navigate({ [select.key]: event.target.value })
              }
              value={select.value}
            >
              <option value="">{select.emptyLabel}</option>
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <span aria-live="polite" className="pb-2 text-xs text-ui-muted">
          {pending
            ? "Buscando…"
            : !searchable
              ? "Sigue escribiendo: hacen falta dos caracteres, o Enter."
              : resultLabel}
        </span>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {chips.map((chip) => (
            <button
              className="inline-flex items-center gap-1 rounded-full border border-ui-border-strong px-2 py-0.5 text-ui-text hover:bg-ui-subtle"
              key={chip.key}
              onClick={() => {
                if (chip.key === "q") setTerm("");
                navigate({ [chip.key]: "" });
              }}
              title={`Quitar ${chip.label}`}
              type="button"
            >
              {chip.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button
            className="ui-button ui-button--quiet"
            onClick={() => {
              setTerm("");
              navigate({
                q: "",
                ...Object.fromEntries(
                  selects.map((select) => [select.key, ""]),
                ),
              });
            }}
            type="button"
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}

function clearTimer(timer: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timer.current) clearTimeout(timer.current);
  timer.current = null;
}
