"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { formatCount } from "@repo/ui/format";

import { closeOrdersAction } from "../server/close-orders-action";

import type { CloseOrdersActionState } from "../server/close-orders-action.types";

const initialState: CloseOrdersActionState = {
  type: "idle",
  message: "",
  closed: 0,
  failures: [],
};

const plural = (count: number) =>
  count === 1 ? "1 pedido" : `${formatCount(count)} pedidos`;

/**
 * SPEC-079: cerrar varios pedidos entregados cuando el operador ya activó la
 * línea. Cerrar es definitivo (SPEC-012), así que el botón pide confirmar
 * con la cifra a la vista antes de enviar.
 */
export function BulkCloseBar({
  checkedIds,
  closableCount,
  orderCodes,
  onCheckAll,
  onClear,
}: {
  checkedIds: string[];
  /** Cuántos de la página se pueden cerrar. */
  closableCount: number;
  orderCodes: Record<string, string>;
  onCheckAll: () => void;
  onClear: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    closeOrdersAction,
    initialState,
  );
  const [confirming, setConfirming] = useState(false);
  const handled = useRef<CloseOrdersActionState | null>(null);
  const count = checkedIds.length;

  useEffect(() => {
    if (state.type === "idle" || handled.current === state) return;
    handled.current = state;
    setConfirming(false);
    if (state.closed > 0) onClear();
  }, [state, onClear]);

  function close() {
    const data = new FormData();
    for (const id of checkedIds) data.append("orderId", id);
    startTransition(() => formAction(data));
  }

  return (
    <section
      aria-label="Cerrar varios"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm"
    >
      <span className="text-ui-muted">
        {count === 0
          ? "Marca los que el operador ya activó"
          : count === 1
            ? "1 pedido marcado"
            : `${formatCount(count)} pedidos marcados`}
      </span>

      {count < closableCount ? (
        <button
          className="text-sm font-semibold text-ui-accent hover:underline"
          disabled={pending}
          onClick={onCheckAll}
          type="button"
        >
          Marcar los {formatCount(closableCount)} de esta página
        </button>
      ) : null}

      {count > 0 && !confirming ? (
        <button
          className="text-sm text-ui-muted hover:underline"
          disabled={pending}
          onClick={onClear}
          type="button"
        >
          Desmarcar
        </button>
      ) : null}

      <span className="ml-auto flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-ui-text">
              ¿Cerrar {plural(count)}? No se puede deshacer.
            </span>
            <button
              className="rounded-lg bg-ui-accent px-3 py-2 text-sm font-semibold text-ui-on-accent disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              onClick={close}
              type="button"
            >
              {pending ? "Cerrando…" : `Sí, cerrar ${plural(count)}`}
            </button>
            <button
              className="rounded-lg px-3 py-2 text-sm text-ui-muted hover:bg-ui-subtle"
              disabled={pending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Volver
            </button>
          </>
        ) : (
          <button
            className="rounded-lg border border-ui-border-strong px-3 py-2 text-sm font-semibold text-ui-text hover:border-ui-accent hover:bg-ui-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            disabled={count === 0 || pending}
            onClick={() => setConfirming(true)}
            type="button"
          >
            Cerrar: ya activaron{count > 0 ? ` (${formatCount(count)})` : ""}
          </button>
        )}
      </span>

      {state.type !== "idle" && !pending ? (
        <div
          aria-live="polite"
          className={[
            "basis-full text-sm",
            state.type === "error" ? "text-ui-danger" : "text-ui-success",
          ].join(" ")}
        >
          {state.message}
          {state.failures.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs text-ui-muted">
              {state.failures.map((failure) => (
                <li key={failure.orderId}>
                  {orderCodes[failure.orderId] ?? "Pedido"}: {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
