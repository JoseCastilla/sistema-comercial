import { fireEvent, render, screen, within } from "@testing-library/react";
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
vi.mock("@/features/orders/server/set-sale-origin-action", () => ({
  setSaleOriginAction: vi.fn(),
}));
vi.mock("@/features/orders/server/close-orders-action", () => ({
  closeOrdersAction: vi.fn(),
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
    saleOrigin: "BASE",
    canSetSaleOrigin: true,
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
    priorPending: {
      toMove: 6,
      awaiting: 2,
      failed: 30,
      escalated: 1,
      from: "2025-09-01",
      to: "2026-08-31",
    },
    advisorSummary: [
      { id: "u-1", name: "Silvia S.", teamName: "HUANCAYO", toDeliver: 4, failed: 3, overdue: 2, awaiting: 1 },
      { id: "u-2", name: "Steven L.", teamName: "HUANCAYO", toDeliver: 1, failed: 0, overdue: 0, awaiting: 0 },
    ],
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
    // SPEC-084: cada cifra de meses anteriores abre exactamente lo que cuenta.
    const anterior = within(resumen).getByRole("link", { name: "6 por entregar →" });
    expect(anterior).toHaveAttribute("href", expect.stringContaining("period=RANGE"));
    expect(anterior).toHaveAttribute("href", expect.stringContaining("to=2026-08-31"));
    expect(anterior).toHaveAttribute("href", expect.stringContaining("status=TO_MOVE"));
    expect(
      within(resumen).getByRole("link", { name: "2 por activar →" }),
    ).toHaveAttribute("href", expect.stringContaining("status=AWAITING_ACTIVATION"));
    // SPEC-085: las vistas usan el período; lo fallido y lo escalado de antes
    // sigue a un toque.
    expect(
      within(resumen).getByRole("link", { name: "30 entregas fallidas →" }),
    ).toHaveAttribute("href", expect.stringContaining("status=LOGISTICS"));
    expect(
      within(resumen).getByRole("link", { name: "1 escalada →" }),
    ).toHaveAttribute("href", expect.stringContaining("status=ESCALATIONS"));
    // SPEC-074: ningún aviso repite una pestaña.
    expect(within(resumen).queryByText(/fuera de plazo/)).toBeNull();
    expect(within(resumen).queryByText(/por gestionar/)).toBeNull();

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

  it("en «Falta activar», quien puede cerrar marca varios y ve la barra para cerrarlos", () => {
    render(
      <OrderInbox
        data={datos({
          filter: "AWAITING_ACTIVATION",
          items: [
            pedido({ canClose: true, sentSubstatus: "DELIVERED" }),
            pedido({
              id: "o-2",
              orderCode: "1966000000A",
              canClose: false,
              sentSubstatus: "DELIVERED",
            }),
          ],
        })}
      />,
    );

    const barra = screen.getByRole("region", { name: "Cerrar varios" });
    expect(barra).toHaveTextContent("Marca los que el operador ya activó");
    const casilla = screen.getByRole("checkbox", {
      name: "Marcar 1966211921A para cerrar",
    });
    // Venta propia o sin permiso: no se puede marcar.
    expect(
      screen.getByRole("checkbox", { name: "Marcar 1966000000A para cerrar" }),
    ).toBeDisabled();

    fireEvent.click(casilla);
    expect(barra).toHaveTextContent("1 pedido marcado");
  });

  it("el asesor ve una sola lista agrupada por lo que toca, sin pestañas", () => {
    render(
      <OrderInbox
        data={datos({
          role: "AGENT",
          showAdvisorColumn: false,
          items: [
            pedido({ id: "p-1", orderCode: "A1" }),
            pedido({
              id: "p-2",
              orderCode: "A2",
              agrDelivery: null,
              sentSubstatus: "SCHEDULED",
            }),
            pedido({
              id: "p-3",
              orderCode: "A3",
              status: "CLOSED",
              sentSubstatus: null,
              agrDelivery: null,
            }),
          ],
        })}
      />,
    );

    expect(
      screen.queryByRole("navigation", { name: "Estado de los pedidos" }),
    ).toBeNull();
    expect(
      screen.getAllByText("Entrega fallida: llama al cliente")[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText("Por entregar")[0]).toBeInTheDocument();
    // El motivo de Máximo, tal cual, en la fila de la entrega fallida.
    expect(
      screen.getAllByText("Máximo: CLIENTE AUSENTE")[0],
    ).toBeInTheDocument();
    // Lo cerrado va plegado.
    expect(screen.queryByText("A3 · Claro · Base")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]!);
    expect(screen.getAllByText("A3 · Claro · Base")[0]).toBeInTheDocument();
  });

  it("supervisión ve una fila por asesor y cada cifra abre su lista", () => {
    render(<OrderInbox data={datos()} />);

    const tabla = screen.getByRole("region", { name: "Por asesor" });
    const fila = within(tabla).getByRole("link", { name: "Silvia S." }).closest("tr")!;
    expect(within(fila).getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      expect.stringMatching(/status=LOGISTICS.*advisor=u-1|advisor=u-1.*status=LOGISTICS/),
    );
    expect(within(fila).getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      expect.stringContaining("plazo=vencido"),
    );
    // Lo que está en cero no es enlace.
    const otra = within(tabla).getByRole("link", { name: "Steven L." }).closest("tr")!;
    expect(within(otra).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("el asesor no ve la tabla por asesor", () => {
    render(<OrderInbox data={datos({ role: "AGENT", advisorSummary: null })} />);
    expect(screen.queryByRole("region", { name: "Por asesor" })).toBeNull();
  });

  it("una venta con cancelación por revisar no se puede marcar para cerrar", () => {
    render(
      <OrderInbox
        data={datos({
          filter: "AWAITING_ACTIVATION",
          items: [
            pedido({
              id: "o-2",
              orderCode: "1966000000A",
              canClose: true,
              sentSubstatus: "DELIVERED",
            }),
            pedido({
              canClose: true,
              sentSubstatus: "DELIVERED",
              pendingCancellationRequest: {
                id: "c-1",
                reason: "Ya no desea",
                requestedByName: "Asesor Uno",
                requestedAtLabel: "25/09/2026, 10:00",
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Marcar 1966211921A para cerrar" }),
    ).toBeDisabled();
  });

  it("el plazo no viaja a las vistas donde no aplica", () => {
    render(<OrderInbox data={datos({ filter: "TO_MOVE", dueFilter: "vencido" })} />);
    const vistas = screen.getByRole("navigation", { name: "Estado de los pedidos" });
    expect(
      within(vistas).getByRole("link", { name: /Falta activar/ }).getAttribute("href"),
    ).not.toContain("plazo=");
    expect(
      within(vistas).getByRole("link", { name: /Todos/ }).getAttribute("href"),
    ).toContain("plazo=vencido");
  });

  it("el asesor sale de «antes de este mes» a su lista completa, no a una vista", () => {
    render(<OrderInbox data={datos({ role: "AGENT", advisorSummary: null })} />);
    const enlace = screen.getByRole("link", { name: "6 por entregar →" });
    expect(enlace.getAttribute("href")).not.toContain("status=TO_MOVE");
  });

  it("fuera de «Falta activar» no hay casillas", () => {
    render(<OrderInbox data={datos()} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("region", { name: "Cerrar varios" })).toBeNull();
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
      screen.getByText("1966211921A · Claro · Base · Asesor Uno"),
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
