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
  /**
   * Parámetros que se vacían al cambiar este selector (SPEC-044 SUP-06): al
   * cambiar de equipo, el asesor del equipo anterior deja de tener sentido y
   * se quita de forma visible, en vez de quedar filtrando en silencio.
   */
  resets?: readonly string[];
}

/**
 * Campo de mes (SPEC-044 REN-06): aplica al cambiar como un selector, pero
 * no es un filtro que se «quite»: siempre hay un mes, así que no sale como
 * ficha ni lo borra «Limpiar filtros».
 */
export interface DirectoryFilterMonthField {
  key: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
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
  fields = [],
  selects,
  preserve = {},
  resultLabel,
}: {
  basePath: string;
  /** Sin búsqueda, la barra solo tiene selectores y campos. */
  search?: { value: string; label: string; placeholder: string };
  fields?: DirectoryFilterMonthField[];
  selects: DirectoryFilterSelect[];
  /** Parámetros que viajan intactos con cualquier cambio (p. ej. `persona`). */
  preserve?: Record<string, string>;
  resultLabel: string;
}) {
  const router = useRouter();
  const searchValue = search?.value ?? "";
  const [term, setTerm] = useState(searchValue);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentSearch = useRef(searchValue);

  useEffect(() => () => clearTimer(timer), []);

  // El servidor manda cuando el cambio no vino de aquí (Atrás, un enlace).
  useEffect(() => {
    if (searchValue !== sentSearch.current) {
      sentSearch.current = searchValue;
      setTerm(searchValue);
    }
  }, [searchValue]);

  function navigate(overrides: Record<string, string>) {
    clearTimer(timer);

    const next = new URLSearchParams();
    const values: Record<string, string> = {
      ...(search ? { q: term } : {}),
      ...Object.fromEntries(fields.map((field) => [field.key, field.value])),
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
    ...(searchValue ? [{ key: "q", label: `Busca «${searchValue}»` }] : []),
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
        {fields.map((field) => (
          <label className="block" key={field.key}>
            <span className="ui-label-eyebrow">{field.label}</span>
            <input
              className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              max={field.max}
              min={field.min}
              onChange={(event) => {
                if (!event.target.value) return;
                navigate({ [field.key]: event.target.value });
              }}
              type="month"
              value={field.value}
            />
          </label>
        ))}

        {search ? (
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
        ) : null}

        {selects.map((select) => (
          <label className="block" key={select.key}>
            <span className="ui-label-eyebrow">{select.label}</span>
            <select
              className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              onChange={(event) =>
                navigate({
                  [select.key]: event.target.value,
                  ...Object.fromEntries(
                    (select.resets ?? []).map((key) => [key, ""]),
                  ),
                })
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
                ...(search ? { q: "" } : {}),
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
