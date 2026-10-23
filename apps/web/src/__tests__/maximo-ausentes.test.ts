import { describe, expect, it } from "vitest";

import { isSentOrderMissingFromMaximo } from "@/features/agr-delivery/missing-orders";
import { readAgrSourceImportedAt } from "@/features/agr-delivery/order-history";

/**
 * SPEC-086: una venta enviada que Máximo no tiene es alerta solo si Máximo ya
 * importó datos al menos dos horas posteriores al envío.
 */
const enviada = new Date("2026-10-22T15:00:00.000Z");
const horas = (h: number) => new Date(enviada.getTime() + h * 60 * 60 * 1000);

describe("Enviadas que no están en Máximo", () => {
  it("es alerta si Máximo importó datos dos horas o más después del envío", () => {
    expect(
      isSentOrderMissingFromMaximo({
        status: "SENT",
        sentAt: enviada,
        sourceImportedAt: horas(2),
      }),
    ).toBe(true);
  });

  it("no es alerta si los datos de Máximo son de antes o de poco después", () => {
    for (const sourceImportedAt of [horas(-5), horas(1.9), null]) {
      expect(
        isSentOrderMissingFromMaximo({
          status: "SENT",
          sentAt: enviada,
          sourceImportedAt,
        }),
      ).toBe(false);
    }
  });

  it("solo las enviadas: abiertas, cerradas y canceladas no son alerta", () => {
    for (const status of ["OPEN", "CLOSED", "CANCELLED"]) {
      expect(
        isSentOrderMissingFromMaximo({
          status,
          sentAt: enviada,
          sourceImportedAt: horas(48),
        }),
      ).toBe(false);
    }
  });

  it("la hora de importación sale de `freshness`, que no viene si no la encuentra", () => {
    expect(
      readAgrSourceImportedAt({
        ok: true,
        found: true,
        freshness: { imported_at: "2026-10-23T11:37:20.678Z" },
      })?.toISOString(),
    ).toBe("2026-10-23T11:37:20.678Z");
    expect(readAgrSourceImportedAt({ ok: true, found: false, events: [] })).toBeNull();
    expect(readAgrSourceImportedAt({ freshness: { imported_at: "ayer" } })).toBeNull();
  });
});
