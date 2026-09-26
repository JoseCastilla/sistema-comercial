import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrderInbox } from "@/features/orders/components/order-inbox";

import type {
  OrderInboxData,
  OrderInboxItem,
} from "@/features/orders/order-inbox.types";

/**
 * SPEC-073: la hoja de pedidos. Arriba una línea de cifras y otra de «por
 * atender»; en el panel, lo que hay que hacer antes de la ficha de la venta.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/form", () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <form className={className}>{children}</form>
  ),
}));
vi.mock("@/features/orders/components/order-realtime-status", () => ({
  OrderRealtimeStatus: () => null,
}));
vi.mock("@/features/orders/components/order-scope-filters", () => ({
  OrderScopeFilters: () => null,
}));
vi.mock("@/features/orders/components/order-next-step", () => ({
  OrderNextStep: () => <p>Pasos del pedido</p>,
}));
vi.mock("@/features/orders/components/order-status-form", () => ({
  OrderStatusForm: () => <p>Formulario de estado</p>,
}));
vi.mock("@/features/orders/components/order-escalation-panel", () => ({
  OrderEscalationPanel: () => null,
}));
vi.mock("@/features/orders/components/send-order-to-recovery-panel", () => ({
  SendOrderToRecoveryPanel: () => null,
}));
vi.mock("@/features/orders/components/order-correction-form", () => ({
  OrderCorrectionForm: () => null,
}));
vi.mock("@/features/orders/components/order-assignment-resolution", () => ({
  OrderAssignmentResolution: () => null,
}));
vi.mock("@/features/orders/components/order-cancellation-request-panel", () => ({
  OrderCancellationRequestPanel: () => null,
}));

function pedido(extra: Partial<OrderInboxItem> = {}): OrderInboxItem {
  return {
    id: "o-1",
    orderCode: "1966211921A",
    operation: "PORTABILIDAD",
    commercialOperation: "PORT_POSTPAID",
    carrier: "CLARO",
    fixedCharge: "39.90",
    holderName: "CLIENTE DE PRUEBA",
    documentNumber: "40000001",
    serviceNumber: "900000001",
    salesCode: null,
    billingCycleDay: null,
    paymentDueDay: null,
    deliveryMethod: "EXPRESS",
    deliveryMethodLabel: "Express",
    deliveryContactPhone: "900000001",
    deliveryTimeRange: null,
    deliveryAddress: null,
    deliveryReference: null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    department: "LIMA",
    province: "LIMA",
    district: "SURCO",
    locationLabel: "LIMA · LIMA · SURCO",
    agentName: "Asesor Uno",
    submitterEmail: null,
    assignmentStatusLabel: "Asignado",
    deliveryStatus: "",
    status: "SENT",
    statusLabel: "Enviado",
    sentSubstatus: "NOT_DELIVERED",
    sentSubstatusLabel: "No entregado",
    statusAgeLabel: "4 h",
    noStatusIncident: false,
    deliveryObservation: null,
    agrDelivery: {
      opportunity: true,
      stale: false,
      estadoPedido: "NO ENTREGADO",
      fields: [
        { key: "estado_pedido", label: "Estado del pedido", value: "NO ENTREGADO" },
        { key: "motivo_rechazo", label: "Motivo de rechazo", value: "CLIENTE AUSENTE" },
        { key: "fecha_entrega_pactada", label: "Fecha de entrega pactada", value: "2026-09-26" },
        { key: "canal", label: "Canal", value: "DELIVERY" },
      ],
      fetchedAtLabel: "25/09/2026, 18:00",
    },
    registeredAtLabel: "25/09/2026, 14:27",
    approvedAtLabel: "",
    deliveryWindowLabel: "25/9 · 14:27–17:27",
    slaState: "OVERDUE",
    slaLabel: "Fuera de plazo",
    slaDetail: null,
    canUpdate: true,
    canClose: false,
    canCancelDirectly: false,
    canRequestCancellation: false,
    canReviewCancellation: false,
    canEscalate: false,
    canReviewEscalation: false,
    incidentEscalation: null,
    pendingCancellationRequest: null,
    closedByName: null,
    closedAtLabel: null,
    canCorrect: false,
    canSendToRecovery: false,
    recoveryCase: null,
    canResolveAssignment: false,
    canClaimAssignment: false,
    parseStatus: "PARSED",
    updatedAt: "2026-09-25T19:27:00.000Z",
    ...extra,
  };
}

function datos(extra: Partial<OrderInboxData> = {}): OrderInboxData {
  return {
    generatedAt: "25/09/2026, 20:51",
    role: "SUPERVISOR",
    period: "MONTH",
    periodLabel: "Mes actual",
    from: null,
    to: null,
    rangeMaxDate: "2026-09-25",
    filter: "ALL",
    search: "",
    teamFilter: "ALL",
    teamAllLabel: "Todos",
    teamOptions: [],
    advisorFilter: "ALL",
    advisorOptions: [],
    maximoFilter: null,
    dueFilter: null,
    returnTo: null,
    assignmentTeams: [],
    showTeamFilter: false,
    showAdvisorColumn: true,
    filteredTotal: 1,
    items: [pedido()],
    pagination: { page: 1, pageSize: 50, totalPages: 1 },
    pendingBeforeMonth: 6,
    tabCounts: {
      TO_MOVE: 35,
      LOGISTICS: 175,
      AWAITING_ACTIVATION: 11,
      ESCALATIONS: 1,
      DONE: 300,
      ALL: 403,
    },
    logisticsSummary: {
      total: 175,
      byState: [
        { state: "CANCELADO", count: 100 },
        { state: "RECHAZADO", count: 60 },
        { state: "NO ENTREGADO", count: 15 },
      ],
      lastFetchedAtLabel: null,
    },
    totals: {
      visible: 403,
      incidents: 0,
      escalations: 1,
      logistics: 175,
      notDelivered: 9,
      recovery: 130,
      delivered: 258,
      overdue: 16,
    },
    ...extra,
  };
}

describe("Hoja de pedidos", () => {
  it("arriba, una línea de cifras; las vistas llevan su cifra y no se repiten en avisos", () => {
    render(<OrderInbox data={datos()} />);

    const resumen = screen.getByRole("region", { name: "Resumen de pedidos" });
    // SPEC-078: el período ya lo dice su botón; aquí solo «Ventas».
    expect(within(resumen).getByText(/^Ventas/)).toHaveTextContent("Ventas 403");
    expect(
      within(resumen).getByRole("link", {
        name: "6 pendientes de meses anteriores →",
      }),
    ).toHaveAttribute("href", expect.stringContaining("period=HISTORY"));
    // SPEC-074: ningún aviso repite una pestaña.
    expect(within(resumen).queryByText(/fuera de plazo/)).toBeNull();
    expect(within(resumen).queryByText(/entregas fallidas/)).toBeNull();

    const vistas = screen.getByRole("navigation", {
      name: "Estado de los pedidos",
    });
    expect(
      within(vistas).getByRole("link", { name: "Por entregar 35" }),
    ).toHaveAttribute("href", expect.stringContaining("status=TO_MOVE"));
    expect(
      within(vistas).getByRole("link", { name: "Falta activar 11" }),
    ).toBeInTheDocument();
    expect(within(vistas).queryByRole("link", { name: /Incidencias/ })).toBeNull();
    // SPEC-074 D2: los pedidos por recuperar se trabajan en Recupero de ventas.
    expect(within(vistas).queryByRole("link", { name: /Por recuperar/ })).toBeNull();
  });

  it("un enlace antiguo a «Activos» sigue abriendo y se ve como pestaña", () => {
    render(<OrderInbox data={datos({ filter: "ACTIVE" })} />);

    const vistas = screen.getByRole("navigation", {
      name: "Estado de los pedidos",
    });
    expect(within(vistas).getByRole("link", { name: "Activos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("sin subtítulo y con el mismo nombre que el menú", () => {
    render(<OrderInbox data={datos()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Pedidos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Revisa incidencias, recupera pedidos/),
    ).toBeNull();
  });

  it("en Por recuperar, una frase dice qué son y dónde están los casos", () => {
    render(
      <OrderInbox
        data={datos({ filter: "RECOVERY", filteredTotal: 130 })}
      />,
    );

    const resumen = screen.getByRole("region", { name: "Resumen de pedidos" });
    expect(resumen).toHaveTextContent(
      "130 pedidos no entregados o cancelados que aún pueden volverse venta.",
    );
    expect(
      within(resumen).getByRole("link", { name: "Recupero de ventas" }),
    ).toHaveAttribute("href", "/recovery/sales");
    expect(within(resumen).queryByText(/por recuperar este mes/)).toBeNull();
  });

  it("en Entregas fallidas, las cifras son los estados de Máximo, tal cual", () => {
    render(
      <OrderInbox
        data={datos({ filter: "LOGISTICS", maximoFilter: "RECHAZADO" })}
      />,
    );

    const resumen = screen.getByRole("region", { name: "Resumen de pedidos" });
    expect(
      within(resumen).getByRole("link", { name: "RECHAZADO 60" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(resumen).getByRole("link", { name: "CANCELADO 100" }),
    ).toHaveAttribute("href", expect.stringContaining("maximo=CANCELADO"));
    expect(
      within(resumen).queryByRole("link", { name: /fuera de plazo/ }),
    ).toBeNull();
  });

  it("la fila trae, para cuando va en dos líneas, orden, operador y asesor", () => {
    render(<OrderInbox data={datos()} />);

    expect(
      screen.getByText("1966211921A · Claro · Asesor Uno"),
    ).toBeInTheDocument();
  });

  it("el panel muestra todo lo que manda Máximo, sin traducir, incluso campos nuevos", () => {
    render(<OrderInbox data={datos()} />);

    const maximo = screen.getByRole("region", { name: "Lo que dice Máximo" });
    expect(within(maximo).getByText("CLIENTE AUSENTE")).toBeInTheDocument();
    expect(within(maximo).getByText("2026-09-26")).toBeInTheDocument();
    expect(within(maximo).getByText("Canal")).toBeInTheDocument();
    expect(within(maximo).getByText("Consultado 25/09/2026, 18:00")).toBeInTheDocument();
    expect(screen.queryByText(/reagendar la visita/)).toBeNull();
  });

  it("en el panel, lo que dice Máximo va antes de la ficha de la venta", () => {
    const { container } = render(<OrderInbox data={datos()} />);

    const panel = container.querySelector(".ui-order-detail-card");
    expect(panel).not.toBeNull();
    const texto = panel!.textContent ?? "";
    const accion = texto.indexOf("CLIENTE AUSENTE");
    const formulario = texto.indexOf("Pasos del pedido");
    const ficha = texto.indexOf("Tipo de entrega");

    expect(accion).toBeGreaterThan(-1);
    expect(accion).toBeLessThan(formulario);
    expect(formulario).toBeLessThan(ficha);
  });
});
