import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SaleOriginPicker } from "@/features/orders/components/sale-origin-picker";

/** SPEC-083: de dónde salió la venta, en un toque. */
const guardar = vi.fn(async (_previous: unknown, data: FormData) => {
  void data;
  return { type: "success" as const, message: "Origen guardado." };
});

vi.mock("@/features/orders/server/set-sale-origin-action", () => ({
  setSaleOriginAction: (previous: unknown, data: FormData) =>
    guardar(previous, data),
}));

const ID = "11111111-1111-4111-8111-111111111111";

describe("Origen de la venta", () => {
  it("un toque guarda el origen y queda marcado", async () => {
    render(
      <SaleOriginPicker
        order={{ id: ID, saleOrigin: null, canSetSaleOrigin: true }}
      />,
    );

    const campana = screen.getByRole("button", { name: "Campaña" });
    expect(campana).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(campana);

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const enviado = guardar.mock.calls[0]?.[1] as FormData;
    expect(enviado.get("orderId")).toBe(ID);
    expect(enviado.get("origin")).toBe("CAMPAIGN");
    expect(campana).toHaveAttribute("aria-pressed", "true");
  });

  it("tocar el origen que ya tiene no guarda de nuevo", () => {
    guardar.mockClear();
    render(
      <SaleOriginPicker
        order={{ id: ID, saleOrigin: "BASE", canSetSaleOrigin: true }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Base" }));
    expect(guardar).not.toHaveBeenCalled();
  });

  it("sin permiso solo se lee", () => {
    render(
      <SaleOriginPicker
        order={{ id: ID, saleOrigin: "OTHER", canSetSaleOrigin: false }}
      />,
    );
    expect(screen.getByText("Origen: Otro")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
