"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  parseRecoverySearchTerm,
  recoveryTeamFilterNone,
} from "@repo/validation";

const debounceMs = 300;

export interface QueueFilterValues {
  q: string;
  view?: string;
  team: string;
  department: string;
  plan: string;
  advisor?: string;
  age?: string;
  /** Selectores propios de una pantalla, declarados en `options.extras`. */
  extra?: Record<string, string>;
}

export interface QueueFilterExtra {
  /** Nombre del parámetro en la URL. */
  key: string;
  label: string;
  emptyLabel?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export interface QueueFilterOptions {
  views?: Array<{ value: string; label: string }>;
  /** Sin lista no se muestra el filtro: el supervisor ya está acotado. */
  teams?: Array<{ id: string; name: string }>;
  /** Ofrecer «Sin equipo»: solo tiene sentido para quien reparte. */
  allowNoTeam?: boolean;
  departments?: string[];
  /** Etiquetas comerciales presentes en la base dentro del alcance. */
  plans?: string[];
  advisors?: Array<{ id: string; name: string }>;
  ages?: ReadonlyArray<{ value: string; label: string }>;
  /**
   * Selectores que solo existen en una pantalla —última tipificación,
   * próxima acción— sin acoplar la barra a ninguna: cada uno declara su
   * parámetro, su rótulo y sus opciones, y la barra los trata como a los
   * demás: aplican al cambiar, viajan en la URL y se quitan uno a uno.
   */
  extras?: QueueFilterExtra[];
}

const selectClass =
  "block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text";

/**
 * Barra de filtros de las colas administrativas (triage y distribución),
 * en vivo y con el estado en la URL — fase 2 del plan de usabilidad.
 *
 * Misma mecánica que la bandeja del asesor (BR-089): la lista se recarga
 * cambiando la URL, así que el enlace es compartible, el botón Atrás vuelve
 * al filtro anterior y una respuesta vieja no puede pisar a una nueva. Los
 * selectores aplican al cambiar; el texto espera 300 ms; cualquier cambio
 * vuelve a la primera página. Los filtros activos se ven y se quitan uno a
 * uno, porque un filtro que no se ve es un filtro que se olvida puesto.
 */
export function QueueFilters({
  basePath,
  values,
  options,
  resultLabel,
  searchLabel = "Buscar cliente",
  searchPlaceholder = "Nombre, DNI o teléfono",
}: {
  basePath: string;
  values: QueueFilterValues;
  options: QueueFilterOptions;
  resultLabel: string;
  /** Qué se busca aquí; por defecto, un cliente. */
  searchLabel?: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(values.q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentSearch = useRef(values.q);

  useEffect(() => () => clearTimer(timer), []);

  // El servidor manda cuando el cambio no vino de aquí (Atrás, un enlace).
  useEffect(() => {
    if (values.q !== sentSearch.current) {
      sentSearch.current = values.q;
      setTerm(values.q);
    }
  }, [values.q]);

  function navigate(next: Partial<QueueFilterValues>) {
    clearTimer(timer);

    const merged: QueueFilterValues = {
      ...values,
      q: term,
      ...next,
      extra: { ...values.extra, ...next.extra },
    };
    const query = new URLSearchParams();

    if (merged.view) query.set("view", merged.view);
    if (merged.q) query.set("q", merged.q);
    if (merged.team) query.set("team", merged.team);
    if (merged.department) query.set("department", merged.department);
    if (merged.plan) query.set("plan", merged.plan);
    if (merged.advisor) query.set("advisor", merged.advisor);
    if (merged.age) query.set("age", merged.age);
    for (const [key, value] of Object.entries(merged.extra ?? {})) {
      if (value) query.set(key, value);
    }

    // Sin `page`: la página tres del filtro anterior no existe en el nuevo.
    sentSearch.current = merged.q;

    const suffix = query.toString();

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
    term.length === 0 || parseRecoverySearchTerm(term) !== null;

  const teamLabel = (id: string) =>
    id === recoveryTeamFilterNone
      ? "Sin equipo"
      : (options.teams?.find((team) => team.id === id)?.name ?? id);
  const advisorLabel = (id: string) =>
    options.advisors?.find((advisor) => advisor.id === id)?.name ?? id;
  const ageLabel = (value: string) =>
    options.ages?.find((age) => age.value === value)?.label ?? value;
  const extraChips = (options.extras ?? []).flatMap((extra) => {
    const value = values.extra?.[extra.key];

    if (!value) return [];

    const optionLabel =
      extra.options.find((option) => option.value === value)?.label ?? value;

    return [{ key: extra.key, label: `${extra.label}: ${optionLabel}` }];
  });

  const active: Array<{ key: keyof QueueFilterValues; label: string }> = [
    ...(values.q ? [{ key: "q" as const, label: `Busca «${values.q}»` }] : []),
    ...(values.team
      ? [{ key: "team" as const, label: `Equipo: ${teamLabel(values.team)}` }]
      : []),
    ...(values.department
      ? [
          {
            key: "department" as const,
            label: `Departamento: ${values.department}`,
          },
        ]
      : []),
    ...(values.plan
      ? [{ key: "plan" as const, label: `Plan: ${values.plan}` }]
      : []),
    ...(values.advisor
      ? [
          {
            key: "advisor" as const,
            label: `Asesor: ${advisorLabel(values.advisor)}`,
          },
        ]
      : []),
    ...(values.age
      ? [{ key: "age" as const, label: `Antigüedad: ${ageLabel(values.age)}` }]
      : []),
  ];
  const chips: Array<{ key: string; label: string; extra: boolean }> = [
    ...active.map((filter) => ({ ...filter, extra: false })),
    ...extraChips.map((filter) => ({ ...filter, extra: true })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {options.views ? (
          <label className="block">
            <span className="ui-label-eyebrow">Vista</span>
            <select
              className={selectClass}
              onChange={(event) => navigate({ view: event.target.value })}
              value={values.view ?? ""}
            >
              {options.views.map((view) => (
                <option key={view.value} value={view.value}>
                  {view.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="ui-label-eyebrow">{searchLabel}</span>
          <div className="flex items-center gap-1">
            <input
              aria-busy={pending}
              className="block w-56 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              maxLength={80}
              name="q"
              onChange={(event) => {
                const value = event.target.value;
                setTerm(value);

                // Un término a medias devolvería la lista entera y la haría
                // parpadear entre dígito y dígito: se espera a que acote.
                if (value.length === 0 || parseRecoverySearchTerm(value)) {
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
              placeholder={searchPlaceholder}
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

        {options.teams ? (
          <label className="block">
            <span className="ui-label-eyebrow">Equipo</span>
            <select
              className={selectClass}
              onChange={(event) => navigate({ team: event.target.value })}
              value={values.team}
            >
              <option value="">Todos</option>
              {options.allowNoTeam ? (
                <option value={recoveryTeamFilterNone}>Sin equipo</option>
              ) : null}
              {options.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.advisors ? (
          <label className="block">
            <span className="ui-label-eyebrow">Asesor actual</span>
            <select
              className={selectClass}
              onChange={(event) => navigate({ advisor: event.target.value })}
              value={values.advisor ?? ""}
            >
              <option value="">Todos</option>
              {options.advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {(options.extras ?? []).map((extra) => (
          <label className="block" key={extra.key}>
            <span className="ui-label-eyebrow">{extra.label}</span>
            <select
              className={selectClass}
              onChange={(event) =>
                navigate({ extra: { [extra.key]: event.target.value } })
              }
              value={values.extra?.[extra.key] ?? ""}
            >
              <option value="">{extra.emptyLabel ?? "Todos"}</option>
              {extra.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        {options.departments ? (
          <label className="block">
            <span className="ui-label-eyebrow">Departamento</span>
            <select
              className={selectClass}
              onChange={(event) => navigate({ department: event.target.value })}
              value={values.department}
            >
              <option value="">Todos</option>
              {options.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.plans ? (
          <label className="block">
            <span className="ui-label-eyebrow">Plan</span>
            <select
              className={selectClass}
              onChange={(event) => navigate({ plan: event.target.value })}
              value={values.plan}
            >
              <option value="">Todos</option>
              {options.plans.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.ages ? (
          <label className="block">
            <span className="ui-label-eyebrow">Antigüedad</span>
            <select
              className={selectClass}
              onChange={(event) => navigate({ age: event.target.value })}
              value={values.age ?? ""}
            >
              <option value="">Toda</option>
              {options.ages.map((age) => (
                <option key={age.value} value={age.value}>
                  {age.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <span aria-live="polite" className="pb-2 text-xs text-ui-muted">
          {pending
            ? "Buscando…"
            : !searchable
              ? "Sigue escribiendo: hacen falta 4 dígitos o una palabra del nombre."
              : resultLabel}
        </span>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {chips.map((filter) => (
            <button
              className="inline-flex items-center gap-1 rounded-full border border-ui-border-strong px-2 py-0.5 text-ui-text hover:bg-ui-subtle"
              key={filter.key}
              onClick={() => {
                if (filter.key === "q") setTerm("");
                navigate(
                  filter.extra
                    ? { extra: { [filter.key]: "" } }
                    : { [filter.key]: "" },
                );
              }}
              title={`Quitar ${filter.label}`}
              type="button"
            >
              {filter.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button
            className="ui-button ui-button--quiet"
            onClick={() => {
              setTerm("");
              navigate({
                q: "",
                team: "",
                department: "",
                plan: "",
                advisor: "",
                age: "",
                extra: Object.fromEntries(
                  (options.extras ?? []).map((extra) => [extra.key, ""]),
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
