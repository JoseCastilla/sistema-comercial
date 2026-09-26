import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkCloseBar } from "@/features/orders/components/bulk-close-bar";

/**
 * SPEC-079: cerrar varios pedidos entregados. Cerrar es definitivo, así que
 * se confirma con la cifra a la vista; si uno falla, los demás se cierran.
 */
const hoisted = vi.hoisted(() => ({
  aplicar: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/access", () => ({
  requireCommercialAccess: async () => ({
    session: { user: { id: "u-admin" } },
    membership: { role: "BACKOFFICE", organization: { id: "org-1" } },
  }),
}));
vi.mock("@/server/database", () => ({
  database: {
    $transaction: (callback: (transaction: unknown) => unknown) =>
      callback({}),
  },
}));
vi.mock("@/features/orders/server/order-status-change", async () => {
  class OrderStatusUpdateError extends Error {}
  return {
    OrderStatusUpdateError,
    applyOrderStatusChange: (
      _transaction: unknown,
      _context: unknown,
      input: { orderId: string },
    ) => hoisted.aplicar(input, OrderStatusUpdateError),
  };
});

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_C = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  hoisted.aplicar.mockReset();
});

describe("Cerrar varios pedidos", () => {
  it("si uno falla, los demás se cierran y se dice cuál y por qué", async () => {
    const { closeOrdersAction } = await import(
      "@/features/orders/server/close-orders-action"
    );
    hoisted.aplicar.mockImplementation(
      (input: { orderId: string }, ErrorClass: new (message: string) => Error) => {
        if (input.orderId === ID_B) {
          throw new ErrorClass("La orden está finalizada.");
        }
        return { changed: true, orderCode: input.orderId };
      },
    );

    const data = new FormData();
    for (const id of [ID_A, ID_B, ID_C, ID_A]) data.append("orderId", id);
    const result = await closeOrdersAction(
      { type: "idle", message: "", closed: 0, failures: [] },
      data,
    );

    expect(hoisted.aplicar).toHaveBeenCalledTimes(3);
    expect(hoisted.aplicar.mock.calls[0]?.[0]).toEqual({
      orderId: ID_A,
      status: "CLOSED",
      sentSubstatus: null,
    });
    expect(result).toMatchObject({
      type: "success",
      message: "Se cerraron 2 pedidos. 1 no se cerró.",
      closed: 2,
      failures: [{ orderId: ID_B, reason: "La orden está finalizada." }],
    });
  });

  it("sin pedidos marcados no hace nada", async () => {
    const { closeOrdersAction } = await import(
      "@/features/orders/server/close-orders-action"
    );
    const result = await closeOrdersAction(
      { type: "idle", message: "", closed: 0, failures: [] },
      new FormData(),
    );

    expect(result.type).toBe("error");
    expect(hoisted.aplicar).not.toHaveBeenCalled();
  });

  it("la barra pide confirmar con la cifra antes de cerrar", async () => {
    hoisted.aplicar.mockImplementation((input: { orderId: string }) => ({
      changed: true,
      orderCode: input.orderId,
    }));
    const limpiar = vi.fn();
    render(
      <BulkCloseBar
        checkedIds={[ID_A, ID_C]}
        closableCount={5}
        onCheckAll={vi.fn()}
        onClear={limpiar}
        orderCodes={{}}
      />,
    );

    expect(screen.getByText("2 pedidos marcados")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar: ya activaron (2)" }),
    );
    expect(
      screen.getByText("¿Cerrar 2 pedidos? No se puede deshacer."),
    ).toBeInTheDocument();
    expect(hoisted.aplicar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar 2 pedidos" }));

    await waitFor(() => expect(limpiar).toHaveBeenCalled());
    expect(hoisted.aplicar).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Se cerraron 2 pedidos.")).toBeInTheDocument();
  });
});
