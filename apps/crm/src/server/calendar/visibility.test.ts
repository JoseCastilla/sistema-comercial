import { describe, expect, it } from "vitest";

import { canChangeAppointment, canSeeAppointment, type CalendarViewer } from "./visibility";

const agent: CalendarViewer = { userId: "agente-1", role: "AGENT" };
const supervisor: CalendarViewer = { userId: "jefa-1", role: "SUPERVISOR" };
const backoffice: CalendarViewer = { userId: "back-1", role: "BACKOFFICE" };

describe("quién ve y quién cambia una cita", () => {
  it("el asesor ve las suyas y las que no tienen responsable", () => {
    expect(canSeeAppointment(agent, { userId: "agente-1" })).toBe(true);
    expect(canSeeAppointment(agent, { userId: null })).toBe(true);
    expect(canSeeAppointment(agent, { userId: "agente-2" })).toBe(false);
  });

  it("supervisión y back office ven todas", () => {
    expect(canSeeAppointment(supervisor, { userId: "agente-2" })).toBe(true);
    expect(canSeeAppointment(backoffice, { userId: "agente-2" })).toBe(true);
  });

  it("el back office no cambia ninguna", () => {
    expect(canChangeAppointment(backoffice, { userId: null })).toBe(false);
    expect(canChangeAppointment(backoffice, { userId: "back-1" })).toBe(false);
  });

  it("el asesor cambia las suyas y las libres; la supervisión, cualquiera", () => {
    expect(canChangeAppointment(agent, { userId: "agente-1" })).toBe(true);
    expect(canChangeAppointment(agent, { userId: null })).toBe(true);
    expect(canChangeAppointment(agent, { userId: "agente-2" })).toBe(false);
    expect(canChangeAppointment(supervisor, { userId: "agente-2" })).toBe(true);
  });
});
