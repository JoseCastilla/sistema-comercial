"use client";

import { useActionState, useEffect, useRef } from "react";

import { assignAgentAliasAction } from "../server/assign-agent-alias-action";

import type { AssignAgentAliasActionState } from "../server/user-action.types";

interface AgentAliasItem {
  id: string;
  alias: string;
  normalizedAlias: string;
}

const initialState: AssignAgentAliasActionState = {
  type: "idle",
  message: "",
};

export function AssignAgentAliasForm({
  userId,
  userName,
  aliases,
}: {
  userId: string;
  userName: string;
  aliases: AgentAliasItem[];
}) {
  const [state, formAction, pending] = useActionState(
    assignAgentAliasAction,
    initialState,
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.type === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Alias DITO
          </p>

          <p className="mt-1 text-sm text-neutral-700">
            Vincula los nombres recibidos desde DITO con {userName}.
          </p>
        </div>

        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm">
          {aliases.length} {aliases.length === 1 ? "alias" : "aliases"}
        </span>
      </div>

      {aliases.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {aliases.map((alias) => (
            <span
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
              key={alias.id}
              title={`Normalizado: ${alias.normalizedAlias}`}
            >
              {alias.alias}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          Este asesor todavía no tiene aliases configurados.
        </p>
      )}

      <form
        action={formAction}
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        ref={formRef}
      >
        <input name="userId" type="hidden" value={userId} />

        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`alias-${userId}`}>
            Nuevo alias DITO para {userName}
          </label>

          <input
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            disabled={pending}
            id={`alias-${userId}`}
            maxLength={150}
            name="alias"
            placeholder="Ejemplo: JIMENA C."
            required
            type="text"
          />

          {state.fieldErrors?.alias ? (
            <p className="mt-1 text-xs text-red-600">
              {state.fieldErrors.alias}
            </p>
          ) : null}
        </div>

        <button
          className="self-start rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Vinculando..." : "Agregar alias"}
        </button>
      </form>

      <p
        aria-live="polite"
        className={[
          "mt-3 text-xs leading-5",
          state.type === "error"
            ? "text-red-600"
            : state.type === "success"
              ? "text-emerald-700"
              : "text-neutral-500",
        ].join(" ")}
      >
        {state.message ||
          "Al agregarlo, las órdenes históricas sin asignar que coincidan con el alias serán vinculadas."}
      </p>
    </div>
  );
}
