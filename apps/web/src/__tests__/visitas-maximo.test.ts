import { describe, expect, it } from "vitest";

import {
  clipAgrText,
  compareAgrVisits,
  describeAgrVisits,
  formatAgrDate,
  formatAgrDistance,
  readAgrDeliveryReading,
} from "@/features/agr-delivery/delivery-reading";
import { parseAgrOrderHistory } from "@/features/agr-delivery/order-history";

/**
 * SPEC-089: la foto de Máximo leída por visitas. Datos ficticios con la forma
 * de `/api/order-history`; nadie ha visto todavía valores reales de usuario,
 * distancia, tiempo ni comentario, así que se prueban vacíos, largos y raros.
 */
const evento = (
  seq: number,
  estado: string,
  fecha: string | null,
  extra: Partial<{
    motivo: string;
    submotivo: string;
    usuario: string;
    tiempoHrs: string;
    distancia: string;
    comentario: string;
  }> = {},
) => ({
  seq,
  estado,
  fecha,
  motivo: "",
  submotivo: "",
  usuario: "",
  tiempoHrs: "",
  distancia: "",
  comentario: "",
  ...extra,
});

/** Lo que guarda la sincronización: el registro de `parseAgrOrderHistory`. */
const foto = (events: ReturnType<typeof evento>[]) => {
  const rawPayload = parseAgrOrderHistory({
    ok: true,
    found: true,
    order: {
      pedido: "200000001",
      orderId: "1900000001",
      estadoActual: "AGENDADO",
      ultimaActualizacion: "nov 11, 2026 12:21 a.m.",
    },
    events,
  });
  return readAgrDeliveryReading({
    estadoPedido: String(rawPayload?.estado_pedido ?? ""),
    motivoRechazo: (rawPayload?.motivo_rechazo as string | null) ?? null,
    submotivoRechazo: (rawPayload?.submotivo_rechazo as string | null) ?? null,
    rawPayload,
  });
};

const ausente = (submotivo: string) => ({
  motivo: "CLIENTE AUSENTE",
  submotivo,
});

describe("Visitas de Máximo", () => {
  it("2 NO ENTREGADO con «EXCEDE 3 VISITAS»: dice las dos cifras", () => {
    const lectura = foto([
      evento(1, "ASIGNADO", "nov 10, 2026 8:00 a.m."),
      evento(2, "AGENDADO", "nov 10, 2026 8:05 a.m."),
      evento(3, "NO ENTREGADO", "nov 10, 2026 3:58 p.m.", {
        ...ausente("CLIENTE NO CONTESTA LLAMADAS"),
        usuario: "MOTORIZADO-PRUEBA",
        distancia: "1.2",
        tiempoHrs: "00:15",
        comentario: "  toqué   la puerta, nadie abrió ",
      }),
      evento(4, "ASIGNADO", "nov 10, 2026 7:00 p.m."),
      evento(5, "AGENDADO", "nov 10, 2026 7:05 p.m."),
      evento(6, "NO ENTREGADO", "nov 10, 2026 9:10 p.m.", {
        ...ausente("PUNTO DE ENCUENTRO"),
        usuario: "MOTORIZADO-PRUEBA",
      }),
      evento(7, "RECHAZADO", "nov 11, 2026 12:21 a.m.", {
        motivo: "CLIENTE AUSENTE EXCEDE 3 VISITAS",
        usuario: "SUPERVISOR-PRUEBA",
        comentario: "se cierra por visitas",
      }),
    ]);

    expect(lectura).toMatchObject({
      stateLabel: "Rechazado",
      lastMovementLabel: "11/11/2026, 00:21",
      reason: "CLIENTE AUSENTE EXCEDE 3 VISITAS",
      pedido: "200000001",
      hasHistory: true,
      visitsSummary: "Máximo dice 3 visitas; registra 2",
    });
    expect(lectura.visits).toEqual([
      {
        seq: 3,
        stateLabel: "No entregado",
        dateLabel: "10/11/2026, 15:58",
        reason: "CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS",
        comment: "toqué la puerta, nadie abrió",
        meta: "Registró MOTORIZADO-PRUEBA · distancia 1 m · tiempo 00:15",
      },
      {
        seq: 6,
        stateLabel: "No entregado",
        dateLabel: "10/11/2026, 21:10",
        reason: "CLIENTE AUSENTE · PUNTO DE ENCUENTRO",
        comment: null,
        meta: "Registró MOTORIZADO-PRUEBA",
      },
    ]);
    expect(lectura.closure).toEqual({
      stateLabel: "Rechazado",
      dateLabel: "11/11/2026, 00:21",
      reason: "CLIENTE AUSENTE EXCEDE 3 VISITAS",
      comments: ["se cierra por visitas"],
      meta: "Registró SUPERVISOR-PRUEBA",
    });
    // Los pasos intermedios no son visitas, pero están en la secuencia.
    expect(lectura.movements.map((step) => step.stateLabel)).toEqual([
      "Asignado",
      "Agendado",
      "No entregado",
      "Asignado",
      "Agendado",
      "No entregado",
      "Rechazado",
    ]);
  });

  it("3 NO ENTREGADO con el mismo motivo: no hay diferencia que decir", () => {
    const visita = (seq: number) =>
      evento(seq, "NO ENTREGADO", `nov 0${seq}, 2026 10:00 a.m.`, {
        ...ausente("CLIENTE NO CONTESTA LLAMADAS"),
      });
    const lectura = foto([
      visita(1),
      visita(2),
      visita(3),
      evento(4, "RECHAZADO", "nov 04, 2026 10:00 a.m.", {
        motivo: "CLIENTE AUSENTE EXCEDE 3 VISITAS",
      }),
    ]);
    expect(lectura.visitsSummary).toBe("3 visitas fallidas");
    expect(lectura.visits).toHaveLength(3);
    expect(
      compareAgrVisits(
        [1, 2, 3].map(() => ({ estado: "NO ENTREGADO" })),
        "CLIENTE AUSENTE EXCEDE 3 VISITAS",
      ),
    ).toEqual({ registered: 3, claimed: 3, mismatch: false });
  });

  it("1 NO ENTREGADO y rechazo «NO RECUPERABLE»: una visita, sin comparar", () => {
    const lectura = foto([
      evento(1, "ASIGNADO", "oct 22, 2026 2:47 p.m."),
      evento(2, "NO ENTREGADO", "oct 22, 2026 3:58 p.m.", {
        ...ausente("PUNTO DE ENCUENTRO"),
      }),
      evento(3, "RECHAZADO", "oct 22, 2026 11:12 p.m.", {
        motivo: "CLIENTE NO DESEA NO RECUPERABLE",
        submotivo: "NO DESEA SALIR DE ZONA PELIGROSA",
      }),
    ]);
    expect(lectura.reason).toBe(
      "CLIENTE NO DESEA NO RECUPERABLE · NO DESEA SALIR DE ZONA PELIGROSA",
    );
    expect(lectura.visitsSummary).toBe("1 visita fallida");
    // El motivo de la visita no queda tapado por el final.
    expect(lectura.visits[0]?.reason).toBe(
      "CLIENTE AUSENTE · PUNTO DE ENCUENTRO",
    );
    expect(
      compareAgrVisits(
        [{ estado: "NO ENTREGADO" }],
        "CLIENTE NO DESEA NO RECUPERABLE",
      ),
    ).toEqual({ registered: 1, claimed: null, mismatch: false });
  });

  it("PRECANCELADO → CANCELADO es un solo cierre, con lo que anotó cada uno", () => {
    const lectura = foto([
      evento(1, "NO ENTREGADO", "nov 05, 2026 11:00 a.m.", {
        ...ausente("PIDE REAGENDAR"),
      }),
      evento(2, "PRECANCELADO", "nov 05, 2026 6:00 p.m.", {
        motivo: "CLIENTE NO IDENTIFICADO",
        submotivo: "HUELLA NO CORRESPONDE",
        usuario: "MOTORIZADO-PRUEBA",
        comentario: "huella no coincide",
      }),
      evento(3, "CANCELADO", "nov 06, 2026 9:00 a.m.", {
        usuario: "BACKOFFICE-PRUEBA",
        comentario: "se confirma cancelación",
      }),
    ]);
    expect(lectura.stateLabel).toBe("Cancelado");
    expect(lectura.closure).toEqual({
      stateLabel: "Precancelado → Cancelado",
      dateLabel: "06/11/2026, 09:00",
      reason: "CLIENTE NO IDENTIFICADO · HUELLA NO CORRESPONDE",
      comments: ["huella no coincide", "se confirma cancelación"],
      meta: "Registró MOTORIZADO-PRUEBA, BACKOFFICE-PRUEBA",
    });
    expect(lectura.visitsSummary).toBe("1 visita fallida");
  });

  it("sin historial: cabecera, motivo y pedido; sin «0 visitas»", () => {
    const lectura = readAgrDeliveryReading({
      estadoPedido: "NO ENTREGADO",
      motivoRechazo: "CLIENTE AUSENTE",
      submotivoRechazo: "CLIENTE NO CONTESTA LLAMADAS",
      rawPayload: {
        estado_pedido: "NO ENTREGADO",
        motivo_rechazo: "CLIENTE AUSENTE",
        submotivo_rechazo: "CLIENTE NO CONTESTA LLAMADAS",
        pedido: 261036282,
        intentos_no_entregado: 0,
        ultima_actualizacion: "sep 25, 2026 4:27 p.m.",
      },
    });
    expect(lectura).toEqual({
      stateLabel: "No entregado",
      lastMovementLabel: "25/09/2026, 16:27",
      reason: "CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS",
      pedido: "261036282",
      hasHistory: false,
      visitsSummary: null,
      visitsMismatch: false,
      visits: [],
      closure: null,
      movements: [],
    });
    // Respuesta con eventos vacíos: igual que sin historial.
    expect(
      readAgrDeliveryReading({
        estadoPedido: "AGENDADO",
        motivoRechazo: null,
        submotivoRechazo: null,
        rawPayload: { estado_pedido: "AGENDADO", historial: [] },
      }),
    ).toMatchObject({ hasHistory: false, visitsSummary: null, visits: [] });
    // Sin foto cruda, las columnas del pedido.
    expect(
      readAgrDeliveryReading({
        estadoPedido: "RECHAZADO",
        motivoRechazo: "CLIENTE NO DESEA",
        submotivoRechazo: null,
        rawPayload: null,
      }),
    ).toMatchObject({ stateLabel: "Rechazado", reason: "CLIENTE NO DESEA" });
  });

  it("evento sin fecha o con fecha ilegible: no se inventa la hora", () => {
    const lectura = foto([
      evento(1, "NO ENTREGADO", null, { ...ausente("PUNTO DE ENCUENTRO") }),
      evento(2, "NO ENTREGADO", "ayer en la tarde", {
        ...ausente("PIDE REAGENDAR"),
      }),
      evento(3, "AGENDADO", "nov 12, 2026"),
    ]);
    expect(lectura.visits.map((visit) => visit.dateLabel)).toEqual([
      null,
      "ayer en la tarde",
    ]);
    // Sin hora, solo el día.
    expect(lectura.lastMovementLabel).toBe("12/11/2026");
    expect(lectura.closure).toBeNull();
    expect(lectura.visitsSummary).toBe("2 visitas fallidas");
  });

  it("comentario vacío o solo espacios se omite; el largo se recorta en palabra", () => {
    const largo = `${"el cliente dijo que ".repeat(20)}fin`;
    const lectura = foto([
      evento(1, "NO ENTREGADO", "nov 10, 2026 3:58 p.m.", {
        ...ausente("PUNTO DE ENCUENTRO"),
        comentario: "   ",
        usuario: "",
        distancia: "",
        tiempoHrs: "",
      }),
      evento(2, "NO ENTREGADO", "nov 10, 2026 5:00 p.m.", {
        ...ausente("PUNTO DE ENCUENTRO"),
        comentario: largo,
        distancia: "0",
      }),
    ]);
    expect(lectura.visits[0]).toMatchObject({ comment: null, meta: null });
    const recortado = lectura.visits[1]?.comment ?? "";
    expect(recortado.endsWith("…")).toBe(true);
    expect(recortado.length).toBeLessThanOrEqual(201);
    expect(recortado).not.toMatch(/\s…$/);
    // Un «0» es de quien cierra desde la mesa, no una medida: no se muestra.
    expect(lectura.visits[1]?.meta).toBeNull();
    // En «todos los movimientos» cabe más del comentario.
    expect(
      (lectura.movements[1]?.comment ?? "").length,
    ).toBeGreaterThan(recortado.length);
  });

  it("la frase y las fechas, por separado", () => {
    expect(describeAgrVisits([], "CLIENTE AUSENTE EXCEDE 3 VISITAS")).toBe(
      "Máximo dice 3 visitas; registra 0",
    );
    expect(describeAgrVisits([{ estado: "AGENDADO" }], null)).toBeNull();
    expect(formatAgrDate("nov 11, 2026 12:21 a.m.")).toBe("11/11/2026, 00:21");
    expect(formatAgrDate("")).toBeNull();
    expect(clipAgrText("  a   b  ", 10)).toBe("a b");
  });
});


describe("Distancia de Máximo", () => {
  it("va en metros, redondeada; sobre 1 000, en kilómetros", () => {
    expect(formatAgrDistance("46.49")).toBe("46 m");
    expect(formatAgrDistance("457.49")).toBe("457 m");
    expect(formatAgrDistance("0.4")).toBe("1 m");
    expect(formatAgrDistance("1250")).toBe("1.3 km");
    expect(formatAgrDistance("34,56")).toBe("35 m");
  });

  it("omite el cero y lo vacío, y no toca lo que no es un número", () => {
    expect(formatAgrDistance("0")).toBeNull();
    expect(formatAgrDistance("0.00")).toBeNull();
    expect(formatAgrDistance("")).toBeNull();
    expect(formatAgrDistance(null)).toBeNull();
    expect(formatAgrDistance("cerca del paradero")).toBe("cerca del paradero");
  });
});
