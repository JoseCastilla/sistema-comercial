"use client";

import { startTransition, useActionState, useEffect, useState } from "react";

import { setSaleOriginAction } from "../server/set-sale-origin-action";

import type { OrderInboxItem } from "../order-inbox.types";
import type { SaleOriginActionState } from "../server/set-sale-origin-action.types";

export const saleOriginLabels = {
  BASE: "Base",
  CAMPAIGN: "Campaña",
  OTHER: "Otro",
} as const;

const initialState: SaleOriginActionState = { type: "idle", message: "" };

/**
 * SPEC-083: de dónde salió la venta, en un toque. Antes se escribía en la
 * nota («BASE», «CAMPAÑA»); ahora es un dato del pedido que se puede contar.
 */
export function SaleOriginPicker({
  order,
}: {
  order: Pick<OrderInboxItem, "id" | "saleOrigin" | "canSetSaleOrigin">;
}) {
  const [state, formAction, pending] = useActionState(
    setSaleOriginAction,
    initialState,
  );
  // Se muestra lo elegido mientras el servidor confirma.
  const [chosen, setChosen] = useState(order.saleOrigin);

  // Si no se guardó, vuelve a lo que había, para poder intentarlo de nuevo.
  useEffect(() => {
    if (state.type === "error") setChosen(order.saleOrigin);
  }, [state, order.saleOrigin]);

  if (!order.canSetSaleOrigin) {
    return order.saleOrigin ? (
      <p className="text-sm text-ui-muted">
        Origen: {saleOriginLabels[order.saleOrigin]}
      </p>
    ) : null;
  }

  function choose(origin: keyof typeof saleOriginLabels) {
    if (origin === chosen) return;
    const data = new FormData();
    data.set("orderId", order.id);
    data.set("origin", origin);
    setChosen(origin);
    startTransition(() => formAction(data));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ui-muted" id={`origen-${order.id}`}>
        Origen
      </span>
      <div
        aria-labelledby={`origen-${order.id}`}
        className="ui-segmented"
        role="group"
      >
        {(Object.keys(saleOriginLabels) as Array<keyof typeof saleOriginLabels>).map(
          (origin) => (
            <button
              aria-pressed={chosen === origin}
              className="ui-segmented__item"
              disabled={pending}
              key={origin}
              onClick={() => choose(origin)}
              type="button"
            >
              {saleOriginLabels[origin]}
            </button>
          ),
        )}
      </div>
      {state.type === "error" ? (
        <span aria-live="polite" className="text-xs text-ui-danger">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
