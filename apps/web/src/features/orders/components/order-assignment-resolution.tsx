"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { resolveOrderAssignmentAction } from "../server/resolve-order-assignment-action";

import type { OrderInboxItem } from "../order-inbox.types";
import type { ResolveOrderAssignmentActionState } from "../server/resolve-order-assignment-action.types";

const initialState: ResolveOrderAssignmentActionState = {
  type: "idle",
  message: "",
};

export function OrderAssignmentResolution({
  order,
}: {
  order: OrderInboxItem;
}) {
  const [state, action, pending] = useActionState(
    resolveOrderAssignmentAction,
    initialState,
  );

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h4 className="text-sm font-semibold text-amber-950">
        Asesor pendiente de asociación
      </h4>

      <p className="mt-2 text-sm leading-6 text-amber-900">
        La extensión informó {order.submitterEmail}, pero la venta llegó antes
        de que el asesor tuviera un equipo principal activo.
      </p>

      <form action={action} className="mt-4 space-y-3">
        <input name="orderId" type="hidden" value={order.id} />
        <input name="expectedUpdatedAt" type="hidden" value={order.updatedAt} />

        <InlineFeedback
          message={state.message}
          tone={
            state.type === "success"
              ? "success"
              : state.type === "idle"
                ? "neutral"
                : "danger"
          }
        />

        <Button disabled={pending} type="submit" variant="secondary">
          {pending
            ? "Comprobando identidad..."
            : "Asociar por correo corporativo"}
        </Button>
      </form>
    </div>
  );
}
