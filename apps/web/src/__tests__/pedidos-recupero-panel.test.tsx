import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SendOrderToRecoveryPanel } from "@/features/orders/components/send-order-to-recovery-panel";

import type { OrderInboxItem } from "@/features/orders/order-inbox.types";

vi.mock("@/features/recovery/server/send-order-to-recovery-action", () => ({
  sendOrderToRecoveryAction: async () => ({ type: "idle", message: "" }),
}));

const caso = (
  extra: Partial<NonNullable<OrderInboxItem["recoveryCase"]>>,
): NonNullable<OrderInboxItem["recoveryCase"]> => ({
  id: "caso-9",
  status: "IN_PROGRESS",
  priority: "ALTA",
  entryReason: "NO_ENTREGADO",
  assignedToName: "Luis",
  isOpen: true,
  resolvedAtLabel: null,
  ...extra,
});

const pedido = (extra: Partial<OrderInboxItem>): OrderInboxItem =>
  ({
    id: "orden-1",
    canSendToRecovery: false,
    recoveryCase: null,
    ...extra,
  }) as OrderInboxItem;

/**
 * SPEC-041 NAV-02: el pedido dice si tiene un caso de recupero, abierto o
 * resuelto, y lo abre sin volver a buscarlo.
 */
describe("Panel de recupero en el pedido", () => {
  it("un caso abierto se muestra con su responsable y se abre desde aquí", () => {
    render(
      <SendOrderToRecoveryPanel order={pedido({ recoveryCase: caso({}) })} />,
    );

    expect(screen.getByText("En recuperación")).toBeInTheDocument();
    expect(
      screen.getByText(/En gestión · Prioridad Alta · Luis/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir el caso →" }),
    ).toHaveAttribute("href", "/recovery/sales/caso-9");
    expect(screen.queryByText(/Enviar a recupero/)).toBeNull();
  });

  it("un caso resuelto se declara cerrado, con fecha, y permite enviar otra vez", () => {
    render(
      <SendOrderToRecoveryPanel
        order={pedido({
          canSendToRecovery: true,
          recoveryCase: caso({
            status: "LOST",
            isOpen: false,
            resolvedAtLabel: "03/09 18:00",
          }),
        })}
      />,
    );

    expect(screen.getByText("Recupero cerrado")).toBeInTheDocument();
    expect(
      screen.getByText(/Perdida · Prioridad Alta · 03\/09 18:00/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir el caso →" }),
    ).toHaveAttribute("href", "/recovery/sales/caso-9");
    expect(screen.getByText("Enviar a recupero otra vez")).toBeInTheDocument();
  });

  it("sin caso y sin permiso no muestra nada", () => {
    const { container } = render(
      <SendOrderToRecoveryPanel order={pedido({})} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
