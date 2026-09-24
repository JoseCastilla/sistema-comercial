import { describe, expect, it } from "vitest";

import {
  categoryText,
  messagingLimitText,
  metaPhoneStatusToNumberStatus,
  metaTemplateStatusToLocal,
  numberStatusText,
  qualityText,
  rejectionReasonText,
  templateQualityText,
  templateStatusText,
} from "./status-text";

describe("calidad del número", () => {
  it("dice buena, en observación o baja", () => {
    expect(qualityText("GREEN").label).toBe("Buena");
    expect(qualityText("YELLOW")).toMatchObject({ label: "En observación", tone: "warning" });
    expect(qualityText("RED")).toMatchObject({ label: "Baja", tone: "danger" });
  });

  it("sin datos mientras Meta no la calcula", () => {
    expect(qualityText(null).label).toBe("Sin datos aún");
    expect(qualityText("UNKNOWN").label).toBe("Sin datos aún");
    expect(qualityText("NA").label).toBe("Sin datos aún");
  });
});

describe("límite de envío", () => {
  it("lo dice en personas por día, no en jerga", () => {
    expect(messagingLimitText("TIER_1K")).toBe("Puedes iniciar conversaciones con hasta 1.000 personas por día.");
    expect(messagingLimitText("TIER_250")).toBe("Puedes iniciar conversaciones con hasta 250 personas por día.");
    expect(messagingLimitText("TIER_UNLIMITED")).toBe("Puedes iniciar conversaciones sin límite de personas por día.");
  });

  it("explica cuando Meta todavía no lo fijó", () => {
    expect(messagingLimitText(null)).toContain("aún no fijó");
    expect(messagingLimitText("TIER_RARO")).toContain("TIER_RARO");
  });
});

describe("estado del número", () => {
  it("traduce el estado guardado", () => {
    expect(numberStatusText("CONNECTED")).toMatchObject({ label: "Conectado", tone: "success" });
    expect(numberStatusText("RESTRICTED")).toMatchObject({ tone: "danger" });
    expect(numberStatusText("PENDING").label).toBe("Falta terminar en Meta");
  });

  it("traduce el estado que devuelve Meta", () => {
    expect(metaPhoneStatusToNumberStatus("CONNECTED")).toBe("CONNECTED");
    expect(metaPhoneStatusToNumberStatus("FLAGGED")).toBe("RESTRICTED");
    expect(metaPhoneStatusToNumberStatus("RESTRICTED")).toBe("RESTRICTED");
    expect(metaPhoneStatusToNumberStatus("MIGRATED")).toBe("PENDING");
    expect(metaPhoneStatusToNumberStatus(null)).toBe("PENDING");
  });
});

describe("estado de las plantillas", () => {
  it("en revisión, aprobada y rechazada con motivo", () => {
    expect(templateStatusText({ status: "PENDING" }).label).toBe("En revisión");
    expect(templateStatusText({ status: "APPROVED" })).toMatchObject({ label: "Aprobada", tone: "success" });
    expect(templateStatusText({ status: "REJECTED", rejectedReason: "INCORRECT_CATEGORY" }).label).toBe(
      "Rechazada: la categoría no corresponde al contenido",
    );
    expect(templateStatusText({ status: "REJECTED" }).label).toBe("Rechazada");
  });

  it("pausada dice hasta cuándo, en hora de Lima", () => {
    const status = templateStatusText({ status: "PAUSED", pausedUntil: new Date("2026-09-12T20:40:00Z"), timeZone: "America/Lima" });
    expect(status.label).toContain("Pausada hasta");
    expect(status.label).toContain("15:40");
  });

  it("retirada y desactivada", () => {
    expect(templateStatusText({ status: "RETIRED" }).label).toBe("Ya no existe en Meta");
    expect(templateStatusText({ status: "DISABLED" })).toMatchObject({ tone: "danger" });
  });

  it("traduce el estado que manda Meta", () => {
    expect(metaTemplateStatusToLocal("APPROVED")).toBe("APPROVED");
    expect(metaTemplateStatusToLocal("IN_APPEAL")).toBe("PENDING");
    expect(metaTemplateStatusToLocal(undefined)).toBe("PENDING");
    expect(metaTemplateStatusToLocal("PAUSED")).toBe("PAUSED");
  });

  it("traduce los motivos de rechazo", () => {
    expect(rejectionReasonText("ABUSIVE_CONTENT")).toBe("el contenido incumple las políticas de WhatsApp");
    expect(rejectionReasonText("NONE")).toBeNull();
    expect(rejectionReasonText(null)).toBeNull();
    expect(rejectionReasonText("OTRO_MOTIVO")).toBe("otro motivo");
  });

  it("calidad de la plantilla y categoría con su consecuencia", () => {
    expect(templateQualityText("GREEN").label).toBe("Buena");
    expect(templateQualityText("RED")).toMatchObject({ tone: "danger" });
    expect(templateQualityText(null).label).toBe("Sin datos aún");
    expect(categoryText("UTILITY").detail).toContain("Gratis si la ventana de 24 horas está abierta");
    expect(categoryText("MARKETING").label).toBe("Marketing");
  });
});
