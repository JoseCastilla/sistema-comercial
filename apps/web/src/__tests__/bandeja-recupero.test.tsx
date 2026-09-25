import { webcrypto } from "node:crypto";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SalesRecoveryInbox } from "@/features/recovery/components/sales-recovery-inbox";
import { buildOrderHref } from "@/features/recovery/order-link";

import type {
  SalesRecoveryCaseItem,
  SalesRecoveryInboxData,
} from "@/features/recovery/server/get-sales-recovery-inbox";

// La bandeja monta el formulario de asignación, que importa una acción de
// servidor; aquí no se ejecuta. La barra de filtros navega con el router.
vi.mock("@/features/recovery/server/assign-sales-recovery-case-action", () => ({
  assignSalesRecoveryCaseAction: async () => ({ type: "idle", message: "" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: async () => ({
    type: "idle",
    message: "",
  }),
}));

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

const caso = (
  extra: Partial<SalesRecoveryCaseItem>,
): SalesRecoveryCaseItem => ({
  id: "caso-1",
  originalAgentUserId: "u-luis",
  orderCode: "ORD-1",
  orderRegisteredDay: "2026-09-24",
  holderName: "Ana Quispe",
  documentNumber: "12345678",
  status: "ASSIGNED",
  priority: "ALTA",
  entryReason: "NO_ENTREGADO",
  entryObservation: null,
  assignedToName: "Luis",
  originalAgentName: "Luis",
  originalTeamName: "Huancayo",
  noveltyAtLabel: "24/09 10:00",
  nextActionAtLabel: null,
  due: "primer_contacto",
  isCritical: false,
  contactPhone: "999111222",
  phoneOptions: ["999111222", "987654321"],
  stage: null,
  lastResult: null,
  lastObservation: null,
  lastAttemptAtLabel: null,
  canManage: true,
  resolvedAtLabel: null,
  resolutionLabel: null,
  hot: true,
  work: {
    action: "Llamar ya",
    due: { label: "venció hace 1 h", tone: "danger" },
  },
  fallReason: "Acordar otro punto de entrega con el cliente",
  saleDayLabel: "24/09",
  sellerIsAssignee: true,
  ...extra,
});

const antigua = (extra: Partial<SalesRecoveryCaseItem> = {}) =>
  caso({
    id: "antigua-1",
    holderName: "Pedro Rojas",
    saleDayLabel: "03/09",
    hot: false,
    work: { action: "Sin llamar", due: null },
    ...extra,
  });

const filtrosBase: SalesRecoveryInboxData["filters"] = {
  view: "abiertos",
  q: "",
  team: "",
  advisor: "",
  priority: null,
  reason: null,
  status: null,
  due: null,
};

const datos = (
  extra: Partial<SalesRecoveryInboxData>,
): SalesRecoveryInboxData => ({
  generatedAt: "25/09 16:00",
  role: "SUPERVISOR",
  scopeLabel: "Mis equipos",
  canAssign: true,
  advisorOptions: [{ id: "u-2", name: "Rosa", teamName: "Huancayo" }],
  teamOptions: null,
  advisorFilterOptions: [
    { id: "u-luis", name: "Luis · Huancayo" },
    { id: "u-2", name: "Rosa · Huancayo" },
  ],
  filters: filtrosBase,
  totals: {
    open: 2,
    hot: 1,
    cold: 1,
    hotNotCalled: 1,
    hotFollowUpOverdue: 0,
    criticalUnassigned: 0,
    recoveredThisMonth: 0,
  },
  byAdvisor: [
    {
      userId: "u-luis",
      name: "Luis",
      hotNotCalled: 1,
      hotTotal: 1,
      hotFollowUpOverdue: 0,
      coldTotal: 1,
    },
  ],
  hotCases: [caso({})],
  pagination: { page: 1, totalPages: 1, total: 1 },
  cases: [antigua()],
  ...extra,
});

/**
 * SPEC-068: primero lo caliente, con la tarjeta de «Mi día»; lo antiguo
 * plegado; quien reparte ve cuánto tiene cada asesor sin llamar.
 */
describe("Recupero de ventas · caliente primero", () => {
  it("resume lo caliente en una línea, sin las seis tarjetas", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    const resumen = screen.getByRole("region", { name: "Resumen" });
    expect(within(resumen).getByText("Calientes sin llamar")).toBeInTheDocument();
    expect(within(resumen).getByText("Seguimientos vencidos")).toBeInTheDocument();
    expect(within(resumen).getByText("Recuperadas este mes")).toBeInTheDocument();
    // Sin críticas, el resumen no habla de críticas.
    expect(within(resumen).queryByText(/crítica/i)).not.toBeInTheDocument();
  });

  it("por asesor: cuántas calientes tiene sin llamar, y un clic filtra", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    const porAsesor = screen.getByRole("region", { name: "Por asesor" });
    expect(
      within(porAsesor).getByText("1 de 1 calientes sin llamar"),
    ).toBeInTheDocument();
    expect(within(porAsesor).getByText("1 antigua")).toBeInTheDocument();
    expect(within(porAsesor).getByRole("link", { name: "Luis" })).toHaveAttribute(
      "href",
      "/recovery/sales?advisor=u-luis",
    );
  });

  it("el asesor no ve el resumen por asesor", () => {
    render(
      <SalesRecoveryInbox
        data={datos({ role: "AGENT", canAssign: false, byAdvisor: [] })}
      />,
    );

    expect(screen.queryByRole("region", { name: "Por asesor" })).toBeNull();
  });

  it("la caliente dice su plazo, qué hacer y por qué se cayó", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    const calientes = screen.getByRole("region", {
      name: /Calientes · ventas de los últimos 7 días/,
    });
    expect(within(calientes).getByText("venció hace 1 h")).toBeInTheDocument();
    expect(within(calientes).getByText("Llamar ya")).toBeInTheDocument();
    expect(
      within(calientes).getByText("Acordar otro punto de entrega con el cliente"),
    ).toBeInTheDocument();
    expect(
      within(calientes).getByRole("link", { name: "999111222" }),
    ).toHaveAttribute("href", "tel:999111222");
    // Quien vendió es quien la tiene: el nombre no se repite.
    expect(within(calientes).getByText("Responsable: Luis")).toBeInTheDocument();
  });

  it("lo antiguo va plegado y sin plazo en color", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    const plegado = screen.getByText(/Ventas antiguas por recuperar/).closest(
      "details",
    )!;
    expect(plegado).not.toHaveAttribute("open");
    expect(within(plegado).getByText("Pedro Rojas")).toBeInTheDocument();
    expect(within(plegado).getByText("Sin llamar")).toBeInTheDocument();
  });

  it("la prioridad solo se dice cuando es crítica, y el vendedor si no es quien la tiene", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          hotCases: [
            caso({
              isCritical: true,
              priority: "CRITICA",
              assignedToName: "Rosa",
              sellerIsAssignee: false,
            }),
          ],
        })}
      />,
    );

    const calientes = screen.getByRole("region", {
      name: /Calientes · ventas de los últimos 7 días/,
    });
    expect(within(calientes).getByText("Crítica")).toBeInTheDocument();
    expect(within(calientes).queryByText("Alta")).not.toBeInTheDocument();
    expect(
      screen.getByText("Responsable: Rosa · venta de Luis · Huancayo"),
    ).toBeInTheDocument();
  });

  it("vista, prioridad, motivo, estado y vencimiento van en «Más filtros»", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    const mas = screen.getByText("Más filtros").closest("details")!;
    expect(mas).not.toHaveAttribute("open");
    for (const nombre of ["Vista", "Prioridad", "Motivo", "Estado", "Vencimiento"]) {
      expect(
        within(mas).getByRole("combobox", { name: nombre, hidden: true }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("combobox", { name: "Asesor actual" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar cliente o venta" }),
    ).toBeInTheDocument();
  });

  it("«Más filtros» se abre solo si alguno está en uso", () => {
    render(
      <SalesRecoveryInbox
        data={datos({ filters: { ...filtrosBase, priority: "ALTA" } })}
      />,
    );

    expect(screen.getByText("Más filtros").closest("details")).toHaveAttribute(
      "open",
    );
  });

  it("en resueltos no hay asignación, y la tarjeta dice cómo terminó", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          filters: { ...filtrosBase, view: "resueltos" },
          hotCases: [],
          pagination: { page: 1, totalPages: 1, total: 1 },
          cases: [
            caso({
              id: "r",
              status: "RECOVERED",
              resolvedAtLabel: "04/09 09:00",
              resolutionLabel: "Recuperada con ORD-9",
              canManage: false,
              work: null,
            }),
          ],
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /Asignar/ })).toBeNull();
    expect(
      screen.getByText("Recuperada con ORD-9 · el 04/09 09:00"),
    ).toBeInTheDocument();
  });

  it("la venta se abre en el día en que se registró, no en el mes actual", () => {
    render(<SalesRecoveryInbox data={datos({})} />);

    expect(screen.getAllByRole("link", { name: "ORD-1" })[0]).toHaveAttribute(
      "href",
      "/orders?status=ALL&q=ORD-1&period=RANGE&from=2026-09-24&to=2026-09-24",
    );
  });

  it("sin fecha de registro conocida, el enlace no inventa un período", () => {
    expect(buildOrderHref("ORD-2", null)).toBe("/orders?status=ALL&q=ORD-2");
  });

  it("las páginas de lo antiguo conservan los filtros elegidos", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          filters: { ...filtrosBase, due: "primer_contacto", priority: "ALTA" },
          pagination: { page: 2, totalPages: 3, total: 250 },
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/recovery/sales?prioridad=ALTA&vence=primer_contacto",
    );
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute(
      "href",
      "/recovery/sales?prioridad=ALTA&vence=primer_contacto&page=3",
    );
  });

  it("reasignar solo se abre al pedirlo", () => {
    render(<SalesRecoveryInbox data={datos({ cases: [] , pagination: { page: 1, totalPages: 1, total: 0 } })} />);

    expect(
      screen.queryByRole("combobox", { name: "Asesor destino" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reasignar" }));
    expect(
      screen.getByRole("combobox", { name: "Asesor destino" }),
    ).toBeInTheDocument();
  });

  it("registrar gestión abre el editor en la tarjeta, con los teléfonos del caso", () => {
    render(<SalesRecoveryInbox data={datos({ cases: [], pagination: { page: 1, totalPages: 1, total: 0 } })} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar gestión: Ana Quispe" }),
    );

    expect(
      screen.getByRole("button", { name: /Guardar gestión/ }),
    ).toBeInTheDocument();
    const telefono = screen.getByRole("combobox", {
      name: "Teléfono utilizado",
    });
    expect(
      Array.from(telefono.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["999111222", "987654321", "Otro número…"]);
  });

  it("quien no puede gestionar no ve el botón", () => {
    render(
      <SalesRecoveryInbox
        data={datos({
          hotCases: [caso({ canManage: false })],
          cases: [],
          pagination: { page: 1, totalPages: 1, total: 0 },
        })}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Registrar gestión/ }),
    ).toBeNull();
  });
});
