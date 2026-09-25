import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MyDayProgressPanel } from "@/features/my-day/components/my-day-progress";

import type {
  MyDayProgress,
  MyDaySale,
  MyDaySales,
} from "@/features/my-day/server/get-my-day";

/**
 * SPEC-063 fases 4 y 6: la franja dice hoy, comisión, cuota y bono en una
 * línea; al abrirla, «Tu comisión» con el dinero por grupo, y cada grupo se
 * abre por separado con lo que vale cada venta y qué falta para cobrarla.
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
      venta("4", {
        amountCents: 0,
        reasonText: "Alta nueva: no paga comisión",
      }),
    ],
  },
};

const progress: MyDayProgress = {
  monthLabel: "setiembre de 2026",
  enteredToday: 6,
  attemptsToday: 0,
  entered: 4,
  delivered: 2,
  payable: 1,
  deliveredPendingActivation: 1,
  baseCommissionCents: 2_500,
  bonusCents: 0,
  estimatedCommissionCents: 2_500,
  window: {
    label: "Bono días 1 al 15",
    confirmed: 1,
    delivered: 2,
    nextTarget: 30,
    missingForNextTarget: 29,
    nextTargetAmountCents: 20_000,
    closed: true,
    upcoming: {
      label: "Bono del 25 a fin de mes",
      startDay: 25,
      target: 15,
      amountCents: 10_000,
    },
  },
  quota: { target: 100, assigned: true, delivered: 55 },
  policy: {
    currency: "PEN",
    baseRateCents: {
      PORT_POSTPAID: 2_500,
      PORT_PREPAID: 1_250,
      NEW_LINE: 0,
      UNKNOWN: 0,
    },
    acceleratorWindows: [],
  },
};

describe("Mi día · progreso y comisión", () => {
  it("la franja dice hoy, comisión, cuota y el bono que viene, no el cerrado", () => {
    render(<MyDayProgressPanel progress={progress} sales={sales} />);

    const franja = screen.getByText("Ver detalle").closest("summary")!;
    expect(franja).toHaveTextContent(/Hoy 6 ventas · 0 gestiones/);
    expect(franja).toHaveTextContent(/Cuota 55 de 100/);
    expect(franja).toHaveTextContent(
      /Bono del día 25: 15 confirmadas = S\/\s?100/,
    );
    expect(franja).not.toHaveTextContent(/faltan 29/);
  });

  it("cada grupo se abre por separado con lo que vale y qué falta", () => {
    render(<MyDayProgressPanel progress={progress} sales={sales} />);

    expect(
      screen.queryByText(/25\.00 si la recuperas/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Caídas: recupéralas/ }),
    );
    expect(screen.getByText(/25\.00 si la recuperas/)).toBeInTheDocument();
    expect(screen.queryByText(/12\.50 al activarse/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Entregadas, esperan activación/ }),
    );
    expect(screen.getByText(/12\.50 al activarse/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver pedido de CLIENTE 2" }),
    ).toHaveAttribute("href", "/orders?q=ORD-2");
  });

  it("dice cuánto falta cobrar en las ventas que todavía no pagan", () => {
    render(<MyDayProgressPanel progress={progress} sales={sales} />);

    expect(
      screen.getByText(
        /por cobrar S\/\s?37\.50 en tus ventas que todavía no pagan/,
      ),
    ).toBeInTheDocument();
  });
});
