"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  orderActionFilterOptions,
  orderDueFilterOptions,
} from "@repo/validation";

import type {
  OrderAdvisorOption,
  OrderInboxTeamOption,
} from "../order-inbox.types";
import type { OrderActionFilter, OrderDueFilter } from "@repo/validation";

const debounceMs = 300;
/** Menos de esto trae media bandeja: no acota, parpadea. */
const minimumSearchLength = 3;

export interface OrderScopeFilterValues {
  search: string;
  team: string;
  advisor: string;
  action: OrderActionFilter | null;
  due: OrderDueFilter | null;
}

export interface OrderScopeFilterOverrides {
  search?: string;
  team?: string;
  advisor?: string;
  action?: OrderActionFilter | null;
  due?: OrderDueFilter | null;
}

/**
 * Búsqueda en vivo y selectores de alcance de la bandeja de pedidos —
 * SPEC-041 (fase 2 del plan de Pedidos y Recupero).
 *
 * Reemplaza los dos formularios GET (equipo y búsqueda con botón «Buscar»)
 * por la misma mecánica que las colas de Campañas: la lista se recarga
 * cambiando la URL, así que el enlace es compartible y el botón Atrás vuelve
 * al filtro anterior. El texto espera 300 ms y Enter aplica al instante; los
 * selectores aplican al cambiar. Todo conserva período, rango y vista, porque
 * la URL la construye quien ya sabe conservarlos (`ordersHref`). La tarjeta
 * de gestión no se desmonta: un cambio de filtro nunca pisa lo que el asesor
 * estaba escribiendo, y si la venta sale de la vista, la bandeja ya lo avisa.
 */
export function OrderScopeFilters({
  values,
  teamAllLabel,
  teamOptions,
  showTeamFilter,
  advisorOptions,
  showActionFilter,
  buildHref,
}: {
  values: OrderScopeFilterValues;
  teamAllLabel: string;
  teamOptions: OrderInboxTeamOption[];
  showTeamFilter: boolean;
  /** Asesores del alcance; vacío para el asesor, que ya solo ve lo suyo. */
  advisorOptions: OrderAdvisorOption[];
  /** La acción derivada solo existe en «Entregas fallidas por gestionar». */
  showActionFilter: boolean;
  buildHref: (overrides: OrderScopeFilterOverrides) => string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(values.search);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentSearch = useRef(values.search);

  useEffect(() => () => clearTimer(timer), []);

  // El servidor manda cuando el cambio no vino de aquí (Atrás, un enlace).
  useEffect(() => {
    if (values.search !== sentSearch.current) {
      sentSearch.current = values.search;
      setTerm(values.search);
    }
  }, [values.search]);

  function navigate(overrides: OrderScopeFilterOverrides) {
    clearTimer(timer);

    const search = overrides.search ?? term;
    sentSearch.current = search;

    startTransition(() => {
      router.replace(buildHref({ ...overrides, search }), { scroll: false });
    });
  }

  function scheduleSearch(value: string) {
    clearTimer(timer);
    timer.current = setTimeout(() => navigate({ search: value }), debounceMs);
  }

  const searchable =
    term.length === 0 || term.trim().length >= minimumSearchLength;

  // Con un equipo elegido, el selector de asesor solo ofrece a los suyos; sin
  // asignar no tiene asesor que ofrecer.
  const scopedTeam =
    values.team !== "ALL" && values.team !== "UNASSIGNED" ? values.team : null;
  const visibleAdvisors = scopedTeam
    ? advisorOptions.filter((advisor) => advisor.teamId === scopedTeam)
    : advisorOptions;
  const showAdvisorFilter =
    advisorOptions.length > 0 && values.team !== "UNASSIGNED";

  const advisorLabel = (id: string) =>
    advisorOptions.find((advisor) => advisor.id === id)?.name ?? id;
  const dueLabel = (value: OrderDueFilter) =>
    orderDueFilterOptions.find((option) => option.value === value)?.label ??
    value;
  const actionLabel = (value: OrderActionFilter) =>
    orderActionFilterOptions.find((option) => option.value === value)?.label ??
    value;

  const chips: Array<{
    key: string;
    label: string;
    remove: OrderScopeFilterOverrides;
  }> = [
    ...(values.search
      ? [
          {
            key: "q",
            label: `Busca «${values.search}»`,
            remove: { search: "" },
          },
        ]
      : []),
    ...(values.advisor !== "ALL"
      ? [
          {
            key: "advisor",
            label: `Asesor: ${advisorLabel(values.advisor)}`,
            remove: { advisor: "ALL" },
          },
        ]
      : []),
    ...(values.due
      ? [
          {
            key: "due",
            label: `Plazo: ${dueLabel(values.due)}`,
            remove: { due: null },
          },
        ]
      : []),
    ...(values.action && showActionFilter
      ? [
          {
            key: "action",
            label: `Acción: ${actionLabel(values.action)}`,
            remove: { action: null },
          },
        ]
      : []),
  ];

  return (
    <>
      {showTeamFilter ? (
        <div className="ui-team-filter">
          <label className="ui-team-filter__field">
            <span>Equipo</span>
            <select
              className="ui-filter-select"
              onChange={(event) => {
                const team = event.target.value;
                // Al cambiar de equipo, el asesor elegido solo se conserva si
                // pertenece al nuevo.
                const keepAdvisor = advisorOptions.some(
                  (advisor) =>
                    advisor.id === values.advisor &&
                    (team === "ALL" || advisor.teamId === team),
                );
                navigate({
                  team,
                  advisor: keepAdvisor ? values.advisor : "ALL",
                });
              }}
              value={values.team}
            >
              <option value="ALL">{teamAllLabel}</option>
              <option value="UNASSIGNED">Sin asignar</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          {showAdvisorFilter ? (
            <label className="ui-team-filter__field">
              <span>Asesor</span>
              <select
                className="ui-filter-select"
                onChange={(event) => navigate({ advisor: event.target.value })}
                value={
                  visibleAdvisors.some(
                    (advisor) => advisor.id === values.advisor,
                  )
                    ? values.advisor
                    : "ALL"
                }
              >
                <option value="ALL">Todos</option>
                {visibleAdvisors.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {scopedTeam
                      ? advisor.name
                      : `${advisor.name} · ${advisor.teamName}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="ui-team-filter">
        <label className="ui-team-filter__field">
          <span>Plazo</span>
          <select
            className="ui-filter-select"
            onChange={(event) =>
              navigate({
                due: (event.target.value || null) as OrderDueFilter | null,
              })
            }
            value={values.due ?? ""}
          >
            <option value="">Todos</option>
            {orderDueFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {showActionFilter ? (
          <label className="ui-team-filter__field">
            <span>Acción</span>
            <select
              className="ui-filter-select"
              onChange={(event) =>
                navigate({
                  action: (event.target.value ||
                    null) as OrderActionFilter | null,
                })
              }
              value={values.action ?? ""}
            >
              <option value="">Todas</option>
              {orderActionFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="ui-order-search">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar pedidos</span>
          <input
            aria-busy={pending}
            className="ui-search-input"
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
              navigate({ search: term });
            }}
            placeholder="Buscar orden, cliente, teléfono o asesor"
            type="search"
            value={term}
          />
        </label>
        {term.length > 0 ? (
          <button
            aria-label="Limpiar la búsqueda"
            className="ui-filter-submit ui-order-search__submit"
            onClick={() => {
              setTerm("");
              navigate({ search: "" });
            }}
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-xs text-ui-muted md:basis-full">
        {pending
          ? "Buscando…"
          : !searchable
            ? `Sigue escribiendo: hacen falta ${minimumSearchLength} caracteres, o Enter para buscar igual.`
            : chips.length > 0
              ? null
              : "Escribe para buscar; los filtros aplican al elegirlos."}
        {chips.length > 0 && !pending && searchable ? (
          <span className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-ui-border-strong px-2 py-0.5 text-ui-text hover:bg-ui-subtle"
                key={chip.key}
                onClick={() => {
                  if (chip.key === "q") setTerm("");
                  navigate(chip.remove);
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
                  search: "",
                  team: "ALL",
                  advisor: "ALL",
                  due: null,
                  action: null,
                });
              }}
              type="button"
            >
              Limpiar filtros
            </button>
          </span>
        ) : null}
      </p>
    </>
  );
}

function clearTimer(timer: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timer.current) clearTimeout(timer.current);
  timer.current = null;
}
