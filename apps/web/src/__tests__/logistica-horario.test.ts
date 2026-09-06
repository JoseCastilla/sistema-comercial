import { describe, expect, it } from "vitest";

import {
  agrSyncSlotHours,
  describeAgrSchedule,
  resolveAgrScheduleKey,
} from "@/features/agr-delivery/schedule";

const lima = (iso: string) => new Date(`${iso}-05:00`);

/**
 * SPEC-046 BR-007 y SPEC-045 PL-07: cuatro consultas automáticas al día y
 * una pantalla que distingue la hora de la fuente de la hora de lectura.
 */
describe("Horario de consultas a Máximo", () => {
  it("son cuatro: 08, 12, 15 y 18 de Lima", () => {
    expect([...agrSyncSlotHours]).toEqual([8, 12, 15, 18]);
  });

  it("la clave de la ventana es la última hora que ya pasó, una por día y hora", () => {
    expect(resolveAgrScheduleKey(lima("2026-09-06T07:59:00"))).toBeNull();
    expect(resolveAgrScheduleKey(lima("2026-09-06T08:03:00"))).toBe(
      "2026-09-06-0800",
    );
    expect(resolveAgrScheduleKey(lima("2026-09-06T14:59:00"))).toBe(
      "2026-09-06-1200",
    );
    expect(resolveAgrScheduleKey(lima("2026-09-06T23:30:00"))).toBe(
      "2026-09-06-1800",
    );
  });

  it("dice la última esperada, la siguiente y si la fuente quedó atrás", () => {
    const view = describeAgrSchedule(
      lima("2026-09-06T13:00:00"),
      lima("2026-09-06T08:02:00"),
    );
    expect(view.lastExpectedAt?.toISOString()).toBe(
      lima("2026-09-06T12:00:00").toISOString(),
    );
    expect(view.nextAt.toISOString()).toBe(
      lima("2026-09-06T15:00:00").toISOString(),
    );
    expect(view.delayed).toBe(true);
  });

  it("dentro del margen de diez minutos no se considera atrasada; de noche la siguiente es mañana a las 08", () => {
    expect(
      describeAgrSchedule(
        lima("2026-09-06T12:04:00"),
        lima("2026-09-06T08:02:00"),
      ).delayed,
    ).toBe(false);
    const night = describeAgrSchedule(
      lima("2026-09-06T19:00:00"),
      lima("2026-09-06T18:03:00"),
    );
    expect(night.delayed).toBe(false);
    expect(night.nextAt.toISOString()).toBe(
      lima("2026-09-07T08:00:00").toISOString(),
    );
    expect(
      describeAgrSchedule(lima("2026-09-06T06:00:00"), null).lastExpectedAt,
    ).toBeNull();
  });
});
