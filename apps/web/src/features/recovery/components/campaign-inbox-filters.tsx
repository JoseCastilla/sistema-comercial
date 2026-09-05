"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { parseRecoverySearchTerm } from "@repo/validation";

const debounceMs = 300;

/**
 * Filtros de la bandeja del asesor, en vivo.
 *
 * Antes había que pulsar «Filtrar» para ver el resultado. Con el cliente al
 * teléfono, ese botón es un paso de más: el asesor teclea el DNI que le
 * dictan y quiere ver la fila, no confirmar una intención.
 *
 * La lista se recarga cambiando la URL, no pidiendo datos por separado. Sale
 * gratis lo que de otro modo habría que construir: el término queda en el
 * enlace —recargable y compartible—, el botón Atrás vuelve a la búsqueda
 * anterior, y una respuesta vieja no puede pisar a una nueva porque el
 * enrutador descarta la navegación que quedó atrás. El campo es de este
 * componente y no se vuelve a montar, así que conserva el foco y el cursor
 * mientras la lista se repinta debajo.
 */
export function CampaignInboxFilters({
  search,
  department,
  plan,
  departments,
  resultLabel,
}: {
  search: string;
  department: string;
  plan: string;
  departments: string[];
  resultLabel: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(search);
  const [planTerm, setPlanTerm] = useState(plan);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef({ search, plan });

  useEffect(() => () => clearTimer(timer), []);

  /**
   * El servidor manda cuando el cambio no vino de aquí — el botón Atrás, un
   * enlace con filtros, la vuelta desde una ficha—. Si viniera de aquí,
   * reescribir el campo movería el cursor mientras el asesor teclea.
   */
  useEffect(() => {
    if (search !== sent.current.search) {
      sent.current.search = search;
      setTerm(search);
    }

    if (plan !== sent.current.plan) {
      sent.current.plan = plan;
      setPlanTerm(plan);
    }
  }, [search, plan]);

  function navigate(next: {
    search?: string;
    department?: string;
    plan?: string;
  }) {
    clearTimer(timer);

    const query = new URLSearchParams();
    const nextSearch = next.search ?? term;
    const nextDepartment = next.department ?? department;
    const nextPlan = next.plan ?? planTerm;

    if (nextSearch) query.set("q", nextSearch);
    if (nextDepartment) query.set("department", nextDepartment);
    if (nextPlan) query.set("plan", nextPlan);

    // Sin `page`: cambiar el filtro empieza por el principio, porque la
    // página tres del filtro anterior no significa nada en el nuevo. Sin
    // `visto`: la marca del caso recién consultado ya cumplió su papel.
    sent.current = { search: nextSearch, plan: nextPlan };

    const suffix = query.toString();

    startTransition(() => {
      router.replace(
        `/recovery/campaigns${suffix ? `?${suffix}` : ""}`,
        // Volver arriba mientras teclea le movería la lista bajo la vista.
        { scroll: false },
      );
    });
  }

  function scheduleNavigate(next: { search?: string; plan?: string }) {
    clearTimer(timer);
    timer.current = setTimeout(() => navigate(next), debounceMs);
  }

  /**
   * Un término a medias —«930» de un DNI, una inicial— no acota nada: la
   * consulta lo descarta y devuelve la bandeja entera. Navegar por él haría
   * parpadear la lista completa entre dígito y dígito, así que se espera a
   * que el término pueda encontrar algo.
   */
  const searchable = term.length === 0 || parseRecoverySearchTerm(term) !== null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="ui-label-eyebrow">Buscar cliente</span>
        <div className="flex items-center gap-1">
          <input
            aria-busy={pending}
            className="block w-56 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
            maxLength={80}
            name="q"
            onChange={(event) => {
              const value = event.target.value;
              setTerm(value);

              if (value.length === 0 || parseRecoverySearchTerm(value)) {
                scheduleNavigate({ search: value });
              } else {
                clearTimer(timer);
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;

              // Sin formulario que enviar, Enter significa «ya, no esperes».
              event.preventDefault();
              navigate({ search: term });
            }}
            placeholder="Nombre, DNI o teléfono"
            type="search"
            value={term}
          />
          {term.length > 0 ? (
            <button
              className="ui-button ui-button--quiet px-2 py-2"
              onClick={() => {
                setTerm("");
                navigate({ search: "" });
              }}
              title="Limpiar la búsqueda"
              type="button"
            >
              ✕
            </button>
          ) : null}
        </div>
      </label>

      <label className="block">
        <span className="ui-label-eyebrow">Departamento</span>
        <select
          className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
          onChange={(event) => navigate({ department: event.target.value })}
          value={department}
        >
          <option value="">Todos</option>
          {departments.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="ui-label-eyebrow">Plan contiene</span>
        <input
          className="block w-32 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
          maxLength={100}
          onChange={(event) => {
            setPlanTerm(event.target.value);
            scheduleNavigate({ plan: event.target.value });
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;

            event.preventDefault();
            navigate({ plan: planTerm });
          }}
          placeholder="49.9"
          value={planTerm}
        />
      </label>

      <span aria-live="polite" className="pb-2 text-xs text-ui-muted">
        {pending
          ? "Buscando…"
          : !searchable
            ? "Sigue escribiendo: hacen falta 4 dígitos o una palabra del nombre."
            : resultLabel}
      </span>
    </div>
  );
}

function clearTimer(timer: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timer.current) clearTimeout(timer.current);
  timer.current = null;
}
