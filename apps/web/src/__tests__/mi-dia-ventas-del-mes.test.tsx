import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MyDaySalesPanel } from "@/features/my-day/components/my-day-sales";

import type { MyDaySale, MyDaySales } from "@/features/my-day/server/get-my-day";

/**
 * SPEC-063 fase 4 (BR-020): cada grupo dice cuántas ventas y cuánto vale, y
 * cada venta que todavía no paga dice qué falta para cobrarla.
 */
const venta = (id: string, overrides: Partial<MyDaySale> = {}): MyDaySale => ({
  id,
  holderName: `CLIENTE ${id}`,
  orderCode: `ORD-${id}`,
  saleDayLabel: "10/09",
  amountCents: 2_500,
  potential: false,
  reasonText: null,
  href: `/orders?q=ORD-${id}`,
  ...overrides,
});

const sales: MyDaySales = {
  total: 4,
  summary: [
    { bucket: "pagan", count: 1, amountCents: 2_500 },
    { bucket: "por_activar", count: 1, amountCents: 1_250 },
    { bucket: "caidas", count: 1, amountCents: 2_500 },
    { bucket: "sin_comision", count: 1, amountCents: 0 },
  ],
  byBucket: {
    pagan: [venta("1")],
    por_activar: [venta("2", { amountCents: 1_250, potential: true })],
    caidas: [venta("3", { potential: true })],
    sin_comision: [
      venta("4", { amountCents: 0, reasonText: "Alta nueva: no paga comisión" }),
    ],
  },
};

describe("Mi día · tus ventas del mes", () => {
  it("resume cada grupo con su cantidad y su monto", () => {
    render(<MyDaySalesPanel monthLabel="setiembre de 2026" sales={sales} />);

    expect(screen.getByText(/Tus 4 ventas de setiembre de 2026/)).toBeInTheDocument();
    expect(screen.getAllByText("Ya pagan")[0]?.parentElement).toHaveTextContent(
      /Ya pagan · 1 · S\/\s?25/,
    );
    expect(
      screen.getAllByText("Caídas: recupéralas")[0]?.parentElement,
    ).toHaveTextContent(/Caídas: recupéralas · 1 · S\/\s?25/);
  });

  it("cada venta dice lo que vale y qué falta para cobrarla", () => {
    render(<MyDaySalesPanel monthLabel="setiembre de 2026" sales={sales} />);

    expect(screen.getByText(/12\.50 al activarse/)).toBeInTheDocument();
    expect(screen.getByText(/25\.00 si la recuperas/)).toBeInTheDocument();
    expect(screen.getByText("Alta nueva: no paga comisión")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver pedido de CLIENTE 3" }),
    ).toHaveAttribute("href", "/orders?q=ORD-3");
  });

  it("sin ventas en el mes no muestra el panel", () => {
    const { container } = render(
      <MyDaySalesPanel
        monthLabel="setiembre de 2026"
        sales={{ total: 0, summary: [], byBucket: {} }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
