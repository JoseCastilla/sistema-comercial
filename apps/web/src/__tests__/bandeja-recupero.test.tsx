import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SalesRecoveryInbox } from "@/features/recovery/components/sales-recovery-inbox";
import { buildOrderHref } from "@/features/recovery/order-link";

import type {
  SalesRecoveryCaseItem,
  SalesRecoveryInboxData,
} from "@/features/recovery/server/get-sales-recovery-inbox";

// La bandeja monta el formulario de asignación, que importa una acción de
// servidor; aquí no se ejecuta.
vi.mock("@/features/recovery/server/assign-sales-recovery-case-action", () => ({
  assignSalesRecoveryCaseAction: async () => ({ type: "idle", message: "" }),
}));

const caso = (
  extra: Partial<SalesRecoveryCaseItem>,
): SalesRecoveryCaseItem => ({
  id: "caso-1",
  originalAgentUserId: null,
  orderCode: "ORD-1",
  orderRegisteredDay: "2026-07-14",
  holderName: "Ana Quispe",
  documentNumber: "12345678",
  status: "ASSIGNED",
  priority: "ALTA",
  entryReason: "NO_ENTREGADO",
  entryObservation: null,
  assignedToName: "Luis",
  originalAgentName: null,
  originalTeamName: null,
  noveltyAtLabel: "14/07 10:00",
  nextActionAtLabel: null,
  due: null,
  isCritical: false,
  ...extra,
});

const datos = (
  extra: Partial<SalesRecoveryInboxData>,
): SalesRecoveryInboxData => ({
  generatedAt: "05/09 15:00",
  role: "AGENT",
  scopeLabel: "Mis casos",
  canAssign: false,
  advisorOptions: [],
  totals: {
    open: 240,
    firstContactOverdue: 12,
    followUpOverdue: 30,
    agendaOverdue: 3,
    criticalUnassigned: 0,
    recoveredThisMonth: 5,
  },
  dueFilter: null,
  pagination: { page: 1, totalPages: 1, total: 240 },
  cases: [caso({})],
  ...extra,
});

/**
 * BR-095: la bandeja de recupero separa los tres vencimientos, abre cada uno
 * como lista, y lleva a la venta de origen en el día en que se registró.
 */
describe("Bandeja de recupero de ventas", () => {
  it("cada vencimiento es un indicador propio y abre su lista", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    expect(
      screen.getByRole("link", { name: /Primer contacto vencido/ }),
    ).toHaveAttribute("href", "/recovery/sales?vence=primer_contacto");
    expect(
      screen.getByRole("link", { name: /Seguimiento vencido/ }),
    ).toHaveAttribute("href", "/recovery/sales?vence=seguimiento");
    expect(
      screen.getByRole("link", { name: /Agenda vencida/ }),
    ).toHaveAttribute("href", "/recovery/sales?vence=agenda");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("con un vencimiento elegido, el título dice cuántos son y cómo volver", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          dueFilter: "seguimiento",
          pagination: { page: 1, totalPages: 1, total: 30 },
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Seguimiento vencido: 30 casos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todos los casos" }),
    ).toHaveAttribute("href", "/recovery/sales");
  });

  it("la venta se abre en el día en que se registró, no en el mes actual", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    expect(screen.getByRole("link", { name: "ORD-1" })).toHaveAttribute(
      "href",
      "/orders?status=ALL&q=ORD-1&period=RANGE&from=2026-07-14&to=2026-07-14",
    );
  });

  it("sin fecha de registro conocida, el enlace no inventa un período", () => {
    expect(buildOrderHref("ORD-2", null)).toBe("/orders?status=ALL&q=ORD-2");
  });

  it("la fila dice qué venció, y sin próxima acción pide llamar ya", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          cases: [
            caso({ id: "a", due: "primer_contacto" }),
            caso({
              id: "b",
              due: "agenda",
              status: "SCHEDULED",
              nextActionAtLabel: "04/09 09:00",
            }),
          ],
        })}
      />,
    );

    const filas = screen.getAllByRole("row").slice(1);

    expect(within(filas[0]!).getByText("Llamar ya")).toBeInTheDocument();
    expect(
      within(filas[0]!).getByText("Primer contacto vencido"),
    ).toBeInTheDocument();
    expect(within(filas[1]!).getByText("04/09 09:00")).toBeInTheDocument();
    expect(within(filas[1]!).getByText("Agenda vencida")).toBeInTheDocument();
    expect(filas[0]).toHaveAttribute("data-no-sales", "true");
  });

  it("las páginas conservan el vencimiento elegido", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          dueFilter: "primer_contacto",
          pagination: { page: 2, totalPages: 3, total: 250 },
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/recovery/sales?vence=primer_contacto",
    );
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute(
      "href",
      "/recovery/sales?vence=primer_contacto&page=3",
    );
  });
});
