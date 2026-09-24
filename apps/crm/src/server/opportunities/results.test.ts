import { describe, expect, it } from "vitest";

import { buildResults, groupOf, type ResultOpportunity } from "./results";

const opportunity = (extra: Partial<ResultOpportunity>): ResultOpportunity => ({
  origin: "AD",
  relation: "NEW",
  stage: "NUEVO",
  stagesVisited: [],
  orders: [],
  ...extra,
});

describe("resultados campaña vs base (BR-021)", () => {
  it("agrupa anuncio y difusión como campaña; asesor, referido y orgánico como base", () => {
    expect(groupOf("AD")).toBe("CAMPAIGN");
    expect(groupOf("BROADCAST")).toBe("CAMPAIGN");
    expect(groupOf("ADVISOR")).toBe("BASE");
    expect(groupOf("REFERRAL")).toBe("BASE");
    expect(groupOf("ORGANIC")).toBe("BASE");
    expect(groupOf("UNKNOWN")).toBe("UNKNOWN");
  });

  it("cuenta oportunidades, calificadas (aunque hayan retrocedido), ganadas y perdidas por origen × relación", () => {
    const { rows, groups } = buildResults({
      opportunities: [
        opportunity({ stage: "CALIFICADO" }),
        opportunity({ stage: "EN_CONTACTO", stagesVisited: ["EN_CONTACTO", "PROPUESTA", "EN_CONTACTO"] }),
        opportunity({ stage: "GANADA", orders: [{ status: "INGRESADO", fixedCharge: 69.9 }] }),
        opportunity({ stage: "PERDIDA", relation: "EXISTING" }),
        opportunity({ origin: "ORGANIC", stage: "NUEVO" }),
      ],
      unlinkedOrders: [],
    });
    const adNew = rows.find((row) => row.origin === "AD" && row.relation === "NEW");
    expect(adNew).toMatchObject({ opportunities: 3, qualified: 3, won: 1, lost: 0, ordersEntered: 1, amountOrdered: 69.9 });
    expect(rows.find((row) => row.origin === "AD" && row.relation === "EXISTING")).toMatchObject({ opportunities: 1, lost: 1 });
    expect(groups.CAMPAIGN.opportunities).toBe(4);
    expect(groups.BASE.opportunities).toBe(1);
    expect(groups.UNKNOWN.opportunities).toBe(0);
  });

  it("los montos distinguen pedido, confirmado y vendido efectivo; cancelados restan de confirmado", () => {
    const { total } = buildResults({
      opportunities: [
        opportunity({
          stage: "GANADA",
          orders: [
            { status: "INGRESADO", fixedCharge: 50 },
            { status: "ENTREGADO", fixedCharge: 60 },
            { status: "ACTIVADO", fixedCharge: 70 },
            { status: "CANCELADO", fixedCharge: 80 },
          ],
        }),
      ],
      unlinkedOrders: [],
    });
    expect(total).toMatchObject({
      ordersEntered: 4,
      ordersDelivered: 2,
      ordersActivated: 1,
      ordersCancelled: 1,
      amountOrdered: 260,
      amountConfirmed: 130,
      amountSold: 70,
    });
  });

  it("los pedidos sin oportunidad cuentan como desconocido (BR-012)", () => {
    const { rows, groups } = buildResults({ opportunities: [], unlinkedOrders: [{ status: "ACTIVADO", fixedCharge: 99 }] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ origin: "UNKNOWN", relation: null, opportunities: 0, ordersEntered: 1, amountSold: 99 });
    expect(groups.UNKNOWN.amountSold).toBe(99);
  });
});
