import { describe, expect, it } from "vitest";

import { conversationScopeWhere, parseView, searchWhere, viewWhere } from "./scope";

const organizationId = "org-1";

describe("alcance de la bandeja por rol", () => {
  it("el asesor ve las suyas y las que nadie tomó", () => {
    expect(conversationScopeWhere({ organizationId, role: "AGENT", userId: "u-1" })).toEqual({
      organizationId,
      OR: [{ assignedUserId: "u-1" }, { assignedUserId: null }],
    });
  });

  it.each(["SUPERVISOR", "OWNER", "BACKOFFICE"] as const)("%s ve toda la organización", (role) => {
    expect(conversationScopeWhere({ organizationId, role, userId: "u-1" })).toEqual({ organizationId });
  });

  it("siempre filtra por organización", () => {
    for (const role of ["AGENT", "SUPERVISOR", "OWNER", "BACKOFFICE"] as const) {
      expect(conversationScopeWhere({ organizationId, role, userId: "u-9" }).organizationId).toBe(organizationId);
    }
  });
});

describe("vistas", () => {
  const threshold = new Date("2026-09-12T15:00:00Z");

  it("una vista desconocida cae en «mías»", () => {
    expect(parseView("lo-que-sea")).toBe("mias");
    expect(parseView(undefined)).toBe("mias");
    expect(parseView(["cerradas"])).toBe("cerradas");
  });

  it("«mías» y «sin tomar» dependen de la asignación", () => {
    expect(viewWhere("mias", { userId: "u-1", unattendedBefore: threshold })).toEqual({ status: "OPEN", assignedUserId: "u-1" });
    expect(viewWhere("sin_tomar", { userId: "u-1", unattendedBefore: threshold })).toEqual({ status: "OPEN", assignedUserId: null });
  });

  it("«sin atender» usa el umbral y excluye al asistente", () => {
    expect(viewWhere("sin_atender", { userId: "u-1", unattendedBefore: threshold })).toEqual({
      status: "OPEN",
      responderState: { not: "IA_ACTIVA" },
      unattendedSince: { lte: threshold },
    });
  });

  it("«cerradas» es la única que sale de las abiertas", () => {
    expect(viewWhere("cerradas", { userId: "u-1", unattendedBefore: threshold })).toEqual({ status: "CLOSED" });
    expect(viewWhere("todas", { userId: "u-1", unattendedBefore: threshold })).toEqual({ status: "OPEN" });
  });
});

describe("búsqueda", () => {
  it("vacía no filtra", () => {
    expect(searchWhere("   ")).toEqual({});
  });

  it("con texto busca por nombre; con dígitos también por teléfono", () => {
    expect(searchWhere("Ana")).toEqual({ OR: [{ contact: { displayName: { contains: "Ana", mode: "insensitive" } } }] });
    expect(searchWhere("+51 987")).toEqual({
      OR: [
        { contact: { displayName: { contains: "+51 987", mode: "insensitive" } } },
        { contact: { phone: { contains: "51987" } } },
      ],
    });
  });
});
