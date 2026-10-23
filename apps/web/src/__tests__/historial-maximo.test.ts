import { describe, expect, it } from "vitest";

import { parseAgrOrderHistory } from "@/features/agr-delivery/order-history";
import { getAgrDeliveryFields } from "@/features/orders/agr-delivery-fields";

/**
 * Máximo responde por `/api/order-history` (SPEC-029 §13): un resumen del
 * pedido y su historial de eventos. Datos ficticios con la forma real.
 */
const evento = (
  seq: number,
  estado: string,
  fecha: string,
  motivo = "",
  submotivo = "",
) => ({
  seq,
  estado,
  fecha,
  motivo,
  submotivo,
  usuario: "USUARIO-PRUEBA",
  tiempoHrs: "00:00",
  distancia: "0",
  comentario: "",
});

const respuesta = (
  order: Record<string, unknown>,
  events: ReturnType<typeof evento>[],
) => ({
  ok: true,
  found: true,
  order: {
    pedido: "200000001",
    orderId: "1900000001",
    entity: "DISTRIBUIDOR ONLINE",
    almacen: "PE00XX00",
    opcionEnvio: "EXPRESS",
    tipoDelivery: "EXPRESS",
    fechaToma: "oct 22, 2026 2:47 p.m.",
    fechaEntregaPactada: "oct 22, 2026",
    estadoActual: "AGENDADO",
    motivoFinal: "",
    submotivoFinal: "",
    ultimaActualizacion: "oct 22, 2026 2:50 p.m.",
    intentosNoEntregado: 0,
    totalEventos: events.length,
    ...order,
  },
  events,
  freshness: { source_file: "HISTORIAL.csv", row_count: 1 },
});

describe("Historial de Máximo", () => {
  it("manda el último evento aunque el resumen se haya quedado atrás", () => {
    const registro = parseAgrOrderHistory(
      respuesta({ estadoActual: "AGENDADO" }, [
        evento(1, "ASIGNADO", "oct 22, 2026 8:00 a.m."),
        evento(2, "AGENDADO", "oct 22, 2026 8:55 a.m."),
        evento(3, "PREPARADO", "oct 22, 2026 10:00 a.m."),
        evento(4, "DESPACHADO", "oct 22, 2026 10:00 a.m."),
        evento(5, "ENTREGADO", "oct 22, 2026 10:21 a.m."),
      ]),
    );
    expect(registro).toMatchObject({
      order_id: "1900000001",
      estado_pedido: "ENTREGADO",
      motivo_rechazo: null,
      fecha_entrega_real: "oct 22, 2026 10:21 a.m.",
      ultima_actualizacion: "oct 22, 2026 10:21 a.m.",
      intentos_no_entregado: 0,
      ultimo_intento_fallido: null,
    });
  });

  it("ordena los eventos por secuencia y toma el motivo del estado final", () => {
    const registro = parseAgrOrderHistory(
      respuesta(
        {
          estadoActual: "NO ENTREGADO",
          motivoFinal: "CLIENTE AUSENTE",
          submotivoFinal: "PUNTO DE ENCUENTRO",
          intentosNoEntregado: 1,
        },
        [
          evento(4, "ASIGNADO", "oct 22, 2026 10:21 p.m."),
          evento(
            5,
            "RECHAZADO",
            "oct 22, 2026 11:12 p.m.",
            "CLIENTE NO DESEA NO RECUPERABLE",
            "NO DESEA SALIR DE ZONA PELIGROSA",
          ),
          evento(1, "ASIGNADO", "oct 22, 2026 2:47 p.m."),
          evento(2, "AGENDADO", "oct 22, 2026 2:50 p.m."),
          evento(
            3,
            "NO ENTREGADO",
            "oct 22, 2026 3:58 p.m.",
            "CLIENTE AUSENTE",
            "PUNTO DE ENCUENTRO",
          ),
        ],
      ),
    );
    expect(registro).toMatchObject({
      estado_pedido: "RECHAZADO",
      motivo_rechazo: "CLIENTE NO DESEA NO RECUPERABLE",
      submotivo_rechazo: "NO DESEA SALIR DE ZONA PELIGROSA",
      recorrido: "ASIGNADO › AGENDADO › NO ENTREGADO › ASIGNADO › RECHAZADO",
      intentos_no_entregado: 1,
      ultimo_intento_fallido: null,
    });
  });

  it("reagendado tras una falla: sin motivo actual y con el intento anterior aparte", () => {
    const registro = parseAgrOrderHistory(
      respuesta({ estadoActual: "AGENDADO", intentosNoEntregado: 1 }, [
        evento(1, "ASIGNADO", "oct 22, 2026 4:13 p.m."),
        evento(2, "AGENDADO", "oct 22, 2026 4:16 p.m."),
        evento(
          3,
          "NO ENTREGADO",
          "oct 22, 2026 4:27 p.m.",
          "CLIENTE AUSENTE",
          "EN TURNO NO CONTESTA LLAMADAS",
        ),
        evento(4, "ASIGNADO", "oct 22, 2026 7:53 p.m."),
        evento(5, "AGENDADO", "oct 23, 2026 2:06 a.m."),
      ]),
    );
    expect(registro).toMatchObject({
      estado_pedido: "AGENDADO",
      motivo_rechazo: null,
      submotivo_rechazo: null,
      ultimo_intento_fallido:
        "NO ENTREGADO · CLIENTE AUSENTE · EN TURNO NO CONTESTA LLAMADAS · oct 22, 2026 4:27 p.m.",
      intentos_no_entregado: 1,
    });
  });

  it("un pedido que la fuente no conoce es null; una respuesta rota, error", () => {
    expect(
      parseAgrOrderHistory({ ok: true, found: false, events: [] }),
    ).toBeNull();
    expect(() => parseAgrOrderHistory({ ok: false })).toThrow();
    expect(() => parseAgrOrderHistory({ ok: true, found: true })).toThrow();
    expect(() => parseAgrOrderHistory("texto")).toThrow();
  });

  it("la ficha muestra estado, falla anterior y recorrido, sin códigos internos", () => {
    const registro = parseAgrOrderHistory(
      respuesta({}, [
        evento(1, "ASIGNADO", "oct 22, 2026 4:13 p.m."),
        evento(
          2,
          "NO ENTREGADO",
          "oct 22, 2026 4:27 p.m.",
          "CLIENTE AUSENTE",
          "CLIENTE NO CONTESTA LLAMADAS",
        ),
        evento(3, "AGENDADO", "oct 23, 2026 2:06 a.m."),
      ]),
    );
    const etiquetas = getAgrDeliveryFields({
      estadoPedido: "AGENDADO",
      motivoRechazo: null,
      submotivoRechazo: null,
      rawPayload: registro,
    }).map((field) => `${field.label}: ${field.value}`);
    expect(etiquetas).toEqual([
      "Estado del pedido: AGENDADO",
      "Último intento fallido: NO ENTREGADO · CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS · oct 22, 2026 4:27 p.m.",
      "Intentos sin entregar: 1",
      "Recorrido: ASIGNADO › NO ENTREGADO › AGENDADO",
      "Última actualización: oct 23, 2026 2:06 a.m.",
      "Pedido: 200000001",
    ]);
  });
});
