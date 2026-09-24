import { describe, expect, it } from "vitest";

import { addDays, isDateIso, localDateIso, minutesOf, startOfWeekIso, weekdayOf } from "./dates";
import { countBooked, findSlot, generateSlots, slotLabel, type SlotRule } from "./slots";

// 2026-09-12 es sábado; 2026-09-14 es lunes. Lima = UTC-5 todo el año.
const LIMA = "America/Lima";
const saturdayNoon = new Date("2026-09-12T17:00:00Z"); // sáb 12 sep, 12:00 Lima

const monday: SlotRule = { weekday: 1, startTime: "09:00", endTime: "10:00", slotMinutes: 30, capacity: 2 };

describe("fechas locales", () => {
  it("la fecha local cambia a medianoche de Lima, no de UTC", () => {
    expect(localDateIso(new Date("2026-09-15T04:30:00Z"), LIMA)).toBe("2026-09-14");
    expect(localDateIso(new Date("2026-09-15T05:00:00Z"), LIMA)).toBe("2026-09-15");
  });

  it("suma días y calcula lunes de la semana", () => {
    expect(addDays("2026-09-30", 2)).toBe("2026-10-02");
    expect(addDays("2026-09-14", -1)).toBe("2026-09-13");
    expect(weekdayOf("2026-09-14")).toBe(1);
    expect(startOfWeekIso("2026-09-12")).toBe("2026-09-07");
    expect(startOfWeekIso("2026-09-13")).toBe("2026-09-07");
    expect(startOfWeekIso("2026-09-14")).toBe("2026-09-14");
  });

  it("valida fechas y horas", () => {
    expect(isDateIso("2026-02-30")).toBe(false);
    expect(isDateIso("2026-09-14")).toBe(true);
    expect(minutesOf("09:30")).toBe(570);
    expect(Number.isNaN(minutesOf("9h30"))).toBe(true);
  });
});

describe("generación de horarios", () => {
  it("sin franjas no hay horarios", () => {
    expect(generateSlots({ rules: [], bookings: [], now: saturdayNoon, timeZone: LIMA })).toEqual([]);
  });

  it("recorta la franja en horarios y los etiqueta en Lima", () => {
    const slots = generateSlots({ rules: [monday], bookings: [], now: saturdayNoon, days: 7, timeZone: LIMA });
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual(["2026-09-14T14:00:00.000Z", "2026-09-14T14:30:00.000Z"]);
    expect(slots[0]?.endsAt.toISOString()).toBe("2026-09-14T14:30:00.000Z");
    expect(slots[0]?.label).toBe("lun 14 sep, 09:00");
    expect(slots.every((slot) => slot.capacity === 2 && slot.booked === 0 && slot.available)).toBe(true);
  });

  it("un horario que no cabe entero en la franja no se ofrece", () => {
    const rule: SlotRule = { ...monday, startTime: "09:00", endTime: "09:50" };
    const slots = generateSlots({ rules: [rule], bookings: [], now: saturdayNoon, timeZone: LIMA });
    expect(slots).toHaveLength(1);
  });

  it("cambio de día: una franja nocturna de lunes en Lima cae en martes UTC y sigue siendo del lunes", () => {
    const night: SlotRule = { weekday: 1, startTime: "22:00", endTime: "23:30", slotMinutes: 30, capacity: 1 };
    // Lunes 14 sep, 20:00 Lima = martes 15 sep, 01:00 UTC.
    const mondayEvening = new Date("2026-09-15T01:00:00Z");
    const slots = generateSlots({ rules: [night], bookings: [], now: mondayEvening, days: 1, timeZone: LIMA });
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      "2026-09-15T03:00:00.000Z",
      "2026-09-15T03:30:00.000Z",
      "2026-09-15T04:00:00.000Z",
    ]);
    expect(slots[2]?.label).toBe("lun 14 sep, 23:00");
    // Con una regla de martes no aparece nada: en Lima todavía es lunes.
    const tuesday = generateSlots({ rules: [{ ...night, weekday: 2 }], bookings: [], now: mondayEvening, days: 1, timeZone: LIMA });
    expect(tuesday).toEqual([]);
  });

  it("nunca ofrece horarios que ya empezaron", () => {
    const now = new Date("2026-09-14T14:00:00Z"); // lun 09:00 Lima en punto
    const slots = generateSlots({ rules: [monday], bookings: [], now, days: 1, timeZone: LIMA });
    expect(slots.map((slot) => slot.label)).toEqual(["lun 14 sep, 09:30"]);
  });

  it("respeta `from` cuando es posterior a ahora", () => {
    const from = new Date("2026-09-14T14:10:00Z");
    const slots = generateSlots({ rules: [monday], bookings: [], now: saturdayNoon, from, days: 1, timeZone: LIMA });
    expect(slots.map((slot) => slot.label)).toEqual(["lun 14 sep, 09:30"]);
  });

  it("capacidad llena: cuenta solo las PENDING y deja de ofrecer el horario", () => {
    const bookings = [
      { scheduledAt: new Date("2026-09-14T14:00:00Z"), status: "PENDING" },
      { scheduledAt: new Date("2026-09-14T14:10:00Z"), status: "PENDING" },
      { scheduledAt: new Date("2026-09-14T14:30:00Z"), status: "CANCELLED" },
      { scheduledAt: new Date("2026-09-14T14:30:00Z"), status: "PENDING" },
    ];
    const slots = generateSlots({ rules: [monday], bookings, now: saturdayNoon, days: 7, timeZone: LIMA });
    expect(slots[0]).toMatchObject({ booked: 2, capacity: 2, available: false });
    expect(slots[1]).toMatchObject({ booked: 1, capacity: 2, available: true });
    const open = generateSlots({ rules: [monday], bookings, now: saturdayNoon, days: 7, timeZone: LIMA, onlyAvailable: true });
    expect(open.map((slot) => slot.label)).toEqual(["lun 14 sep, 09:30"]);
    expect(countBooked(bookings, new Date("2026-09-14T14:00:00Z"), new Date("2026-09-14T14:30:00Z"))).toBe(2);
  });

  it("dos franjas que se pisan: gana el cupo mayor y no se duplica el horario", () => {
    const rules: SlotRule[] = [monday, { ...monday, capacity: 5 }, { ...monday, startTime: "09:30", endTime: "10:30", capacity: 1 }];
    const slots = generateSlots({ rules, bookings: [], now: saturdayNoon, days: 7, timeZone: LIMA });
    expect(slots.map((slot) => [slot.label, slot.capacity])).toEqual([
      ["lun 14 sep, 09:00", 5],
      ["lun 14 sep, 09:30", 5],
      ["lun 14 sep, 10:00", 1],
    ]);
  });

  it("ignora franjas mal formadas", () => {
    const rules: SlotRule[] = [
      { ...monday, startTime: "10:00", endTime: "09:00" },
      { ...monday, slotMinutes: 0 },
      { ...monday, startTime: "nueve" },
    ];
    expect(generateSlots({ rules, bookings: [], now: saturdayNoon, timeZone: LIMA })).toEqual([]);
  });
});

describe("buscar un horario concreto", () => {
  it("encuentra el horario que empieza exactamente ahí", () => {
    const slot = findSlot({ rules: [monday], bookings: [], now: saturdayNoon, at: new Date("2026-09-14T14:30:00Z"), timeZone: LIMA });
    expect(slot?.label).toBe("lun 14 sep, 09:30");
  });

  it("no encuentra horas fuera de la cuadrícula ni en el pasado", () => {
    expect(findSlot({ rules: [monday], bookings: [], now: saturdayNoon, at: new Date("2026-09-14T14:15:00Z"), timeZone: LIMA })).toBeNull();
    expect(findSlot({ rules: [monday], bookings: [], now: new Date("2026-09-14T15:00:00Z"), at: new Date("2026-09-14T14:30:00Z"), timeZone: LIMA })).toBeNull();
  });

  it("la etiqueta acompaña la zona", () => {
    expect(slotLabel(new Date("2026-09-14T14:00:00Z"), LIMA)).toBe("lun 14 sep, 09:00");
    expect(slotLabel(new Date("2026-09-14T14:00:00Z"), "UTC")).toBe("lun 14 sep, 14:00");
  });
});
