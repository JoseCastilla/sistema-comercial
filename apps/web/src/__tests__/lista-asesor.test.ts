import { describe, expect, it } from "vitest";

import {
  getAdvisorOrderGroup,
  getAgrReasonText,
  groupAdvisorOrders,
} from "@/features/orders/advisor-order-groups";

import type { OrderInboxItem } from "@/features/orders/order-inbox.types";

/** SPEC-080: la hoja del asesor, agrupada por lo que toca. */
type Pedido = Pick<
  OrderInboxItem,
  "status" | "sentSubstatus" | "deliveryStatus" | "agrDelivery"
> & { id: string };

const maximo = (opportunity: boolean, stale = false) => ({
  opportunity,
  stale,
  estadoPedido: opportunity ? "NO ENTREGADO" : "AGENDADO",
  fields: [
    { key: "motivo_rechazo", label: "Motivo", value: "CLIENTE AUSENTE" },
    { key: "submotivo_rechazo", label: "Submotivo", value: "NO CONTESTA" },
  ],
  fetchedAtLabel: "26/09/2026, 08:00",
});

const pedido = (id: string, extra: Partial<Pedido>): Pedido => ({
  id,
  status: "SENT",
  sentSubstatus: "SCHEDULED",
  deliveryStatus: "IN_TRANSIT",
  agrDelivery: null,
  ...extra,
});

describe("Hoja del asesor", () => {
  it("cada pedido va al grupo de lo que toca", () => {
    expect(getAdvisorOrderGroup(pedido("a", {}))).toBe("por_entregar");
    expect(
      getAdvisorOrderGroup(pedido("b", { agrDelivery: maximo(true) })),
    ).toBe("fallida");
    expect(
      getAdvisorOrderGroup(pedido("c", { sentSubstatus: "NOT_DELIVERED" })),
    ).toBe("fallida");
    expect(
      getAdvisorOrderGroup(pedido("d", { sentSubstatus: "DELIVERED" })),
    ).toBe("por_activar");
    expect(getAdvisorOrderGroup(pedido("e", { status: "CLOSED" }))).toBe(
      "cerradas",
    );
    expect(getAdvisorOrderGroup(pedido("f", { status: "CANCELLED" }))).toBe(
      "canceladas",
    );
    // Máximo sin problema no es entrega fallida.
    expect(
      getAdvisorOrderGroup(pedido("g", { agrDelivery: maximo(false) })),
    ).toBe("por_entregar");
  });

  it("agrupa en el orden de trabajo, sin grupos vacíos y sin perder el orden", () => {
    const grupos = groupAdvisorOrders([
      pedido("1", {}),
      pedido("2", { agrDelivery: maximo(true) }),
      pedido("3", {}),
      pedido("4", { status: "CLOSED" }),
    ]);
    expect(grupos.map((grupo) => [grupo.key, grupo.items.map((p) => p.id)])).toEqual([
      ["fallida", ["2"]],
      ["por_entregar", ["1", "3"]],
      ["cerradas", ["4"]],
    ]);
    expect(grupos.find((grupo) => grupo.key === "cerradas")?.collapsed).toBe(true);
  });

  it("el motivo de Máximo va tal cual", () => {
    expect(getAgrReasonText({ agrDelivery: maximo(true) })).toBe(
      "CLIENTE AUSENTE · NO CONTESTA",
    );
    expect(getAgrReasonText({ agrDelivery: null })).toBeNull();
  });
});
