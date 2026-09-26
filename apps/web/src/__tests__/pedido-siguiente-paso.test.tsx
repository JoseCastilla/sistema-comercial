import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  getOrderSteps,
  OrderNextStep,
} from "@/features/orders/components/order-next-step";

import type { OrderInboxItem } from "@/features/orders/order-inbox.types";

/**
 * SPEC-074 §4.3: un botón por resultado, desde donde está el pedido; un toque
 * guarda con la nota de siempre y pasa al siguiente.
 */
const guardar = vi.fn(async (_previous: unknown, data: FormData) => {
  void data;
  return { type: "success" as const, message: "Guardado" };
});

vi.mock("@/features/orders/server/update-order-status-action", () => ({
  updateOrderStatusAction: (previous: unknown, data: FormData) =>
    guardar(previous, data),
}));

const base = {
  status: "SENT",
  sentSubstatus: "SCHEDULED",
  canUpdate: true,
  canClose: false,
} as const;

const etiquetas = (extra: Partial<Pick<OrderInboxItem, "status" | "sentSubstatus" | "canUpdate" | "canClose">>) =>
  getOrderSteps({ ...base, ...extra } as Pick<
    OrderInboxItem,
    "status" | "sentSubstatus" | "canUpdate" | "canClose"
  >).map((step) => step.label);

describe("Siguiente paso del pedido", () => {
  it("ofrece solo los pasos que tienen sentido desde el estado actual", () => {
    expect(etiquetas({})).toEqual(["Entregado", "No entregado", "Rechazado"]);
    expect(etiquetas({ sentSubstatus: "ASSIGNED" })).toEqual([
      "Agendado",
      "Entregado",
      "No entregado",
    ]);
    expect(etiquetas({ status: "OPEN", sentSubstatus: null })).toEqual([
      "Enviado",
    ]);
    expect(etiquetas({ sentSubstatus: "DELIVERED" })).toEqual([]);
    expect(etiquetas({ sentSubstatus: "DELIVERED", canClose: true })).toEqual([
      "Cerrar: ya activó",
    ]);
    expect(etiquetas({ status: "CLOSED", sentSubstatus: null })).toEqual([]);
    expect(etiquetas({ canUpdate: false })).toEqual([]);
    // Con la cancelación por aprobar, el pedido no se mueve.
    expect(
      getOrderSteps({
        ...base,
        pendingCancellationRequest: {
          id: "c-1",
          reason: "Ya no desea",
          requestedByName: "Asesor",
          requestedAtLabel: "23/09/2026, 17:40",
        },
      }),
    ).toEqual([]);
  });

  it("un toque guarda el paso con la nota de siempre y pasa al siguiente", async () => {
    const siguiente = vi.fn();
    render(
      <OrderNextStep
        onSaved={siguiente}
        order={
          {
            ...base,
            id: "11111111-1111-4111-8111-111111111111",
            deliveryObservation: "Cliente pidió la tarde",
          } as OrderInboxItem
        }
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Entregado" }));

    await waitFor(() => expect(siguiente).toHaveBeenCalledTimes(1));
    const enviado = guardar.mock.calls[0]?.[1] as FormData;
    expect(enviado.get("status")).toBe("SENT");
    expect(enviado.get("sentSubstatus")).toBe("DELIVERED");
    expect(enviado.get("observation")).toBe("Cliente pidió la tarde");
  });
});
