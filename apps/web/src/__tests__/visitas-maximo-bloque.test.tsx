import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgrDeliveryReadingBlock } from "@/features/agr-delivery/components/agr-delivery-reading";
import { readAgrDeliveryReading } from "@/features/agr-delivery/delivery-reading";
import { parseAgrOrderHistory } from "@/features/agr-delivery/order-history";

/**
 * SPEC-089: «Entrega según Máximo» en la ficha. Datos ficticios con la forma
 * de `/api/order-history`.
 */
const evento = (
  seq: number,
  estado: string,
  fecha: string,
  extra: Record<string, string> = {},
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

function lecturaConVisitas() {
  const rawPayload = parseAgrOrderHistory({
    ok: true,
    found: true,
    order: { pedido: "200000001", orderId: "1900000001" },
    events: [
      evento(1, "ASIGNADO", "nov 10, 2026 8:00 a.m."),
      evento(2, "NO ENTREGADO", "nov 10, 2026 3:58 p.m.", {
        motivo: "CLIENTE AUSENTE",
        submotivo: "CLIENTE NO CONTESTA LLAMADAS",
        usuario: "MOTORIZADO-PRUEBA",
        distancia: "1.2",
        comentario: "nadie abrió",
      }),
      evento(3, "AGENDADO", "nov 10, 2026 7:05 p.m."),
      evento(4, "NO ENTREGADO", "nov 10, 2026 9:10 p.m.", {
        motivo: "CLIENTE AUSENTE",
        submotivo: "PUNTO DE ENCUENTRO",
        usuario: "MOTORIZADO-PRUEBA",
      }),
      evento(5, "RECHAZADO", "nov 11, 2026 12:21 a.m.", {
        motivo: "CLIENTE AUSENTE EXCEDE 3 VISITAS",
        usuario: "SUPERVISOR-PRUEBA",
        comentario: "se cierra por visitas",
      }),
    ],
  });
  return readAgrDeliveryReading({
    estadoPedido: "RECHAZADO",
    motivoRechazo: "CLIENTE AUSENTE EXCEDE 3 VISITAS",
    submotivoRechazo: null,
    rawPayload,
  });
}

/** El texto del bloque, línea por línea, como lo lee quien lo mira. */
function lineas(element: HTMLElement): string[] {
  return Array.from(
    element.querySelectorAll("h4, p, li > span, summary, dt, dd"),
  )
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean);
}

describe("Bloque «Entrega según Máximo»", () => {
  it("2 visitas y rechazo: cabecera, cifras, cada visita y el cierre", () => {
    render(
      <AgrDeliveryReadingBlock
        footer="Consultado 11/11/2026, 09:26"
        reading={lecturaConVisitas()}
        tone="warning"
      />,
    );

    const bloque = screen.getByRole("region", { name: "Entrega según Máximo" });
    expect(bloque).toHaveAttribute("data-tone", "warning");
    expect(
      within(bloque).getByRole("heading", { name: "Máximo · Rechazado" }),
    ).toBeInTheDocument();
    // El pedido se copia con el mismo control que el teléfono.
    expect(
      within(bloque).getByRole("button", { name: /200000001/ }),
    ).toHaveAttribute("title", "Copiar pedido de Máximo");

    const visitas = within(bloque).getByRole("list", { name: "Visitas" });
    const items = within(visitas).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Visita 1 · 10/11/2026, 15:58");
    expect(items[0]).toHaveTextContent("«nadie abrió»");
    expect(items[1]).toHaveTextContent("Visita 2 · 10/11/2026, 21:10");
    expect(items[2]).toHaveTextContent("Rechazado · 11/11/2026, 00:21");

    // Todos los movimientos, plegados.
    const todos = within(bloque).getByText("Ver todos los movimientos (5)");
    expect(todos.closest("details")).not.toHaveAttribute("open");

    expect(lineas(bloque)).toEqual([
      "Máximo · Rechazado",
      "Último movimiento 11/11/2026, 00:21Pedido 200000001⧉",
      "CLIENTE AUSENTE EXCEDE 3 VISITAS",
      "Máximo dice 3 visitas; registra 2",
      "Visita 1 · 10/11/2026, 15:58",
      "CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS",
      "«nadie abrió»",
      "Registró MOTORIZADO-PRUEBA · distancia 1 m",
      "Visita 2 · 10/11/2026, 21:10",
      "CLIENTE AUSENTE · PUNTO DE ENCUENTRO",
      "Registró MOTORIZADO-PRUEBA",
      "Rechazado · 11/11/2026, 00:21",
      // El motivo del cierre es el final: ya va arriba, no se repite.
      "«se cierra por visitas»",
      "Registró SUPERVISOR-PRUEBA",
      "Ver todos los movimientos (5)",
      "Asignado",
      " · 10/11/2026, 08:00",
      "No entregado",
      " · 10/11/2026, 15:58",
      "CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS",
      "«nadie abrió»",
      "Registró MOTORIZADO-PRUEBA · distancia 1 m",
      "Agendado",
      " · 10/11/2026, 19:05",
      "No entregado",
      " · 10/11/2026, 21:10",
      "CLIENTE AUSENTE · PUNTO DE ENCUENTRO",
      "Registró MOTORIZADO-PRUEBA",
      "Rechazado",
      " · 11/11/2026, 00:21",
      "CLIENTE AUSENTE EXCEDE 3 VISITAS",
      "«se cierra por visitas»",
      "Registró SUPERVISOR-PRUEBA",
      "Consultado 11/11/2026, 09:26",
    ].map((line) => line.trim()));
  });

  it("sin historial: cabecera, motivo, pedido y consultado; nada más", () => {
    render(
      <AgrDeliveryReadingBlock
        footer="Consultado 25/09/2026, 18:00"
        reading={readAgrDeliveryReading({
          estadoPedido: "NO ENTREGADO",
          motivoRechazo: "CLIENTE AUSENTE",
          submotivoRechazo: "CLIENTE NO CONTESTA LLAMADAS",
          rawPayload: {
            estado_pedido: "NO ENTREGADO",
            motivo_rechazo: "CLIENTE AUSENTE",
            submotivo_rechazo: "CLIENTE NO CONTESTA LLAMADAS",
            pedido: "261036282",
            intentos_no_entregado: 0,
            ultima_actualizacion: "sep 25, 2026 4:27 p.m.",
          },
        })}
        tone="neutral"
      />,
    );

    const bloque = screen.getByRole("region", { name: "Entrega según Máximo" });
    expect(lineas(bloque)).toEqual([
      "Máximo · No entregado",
      "Último movimiento 25/09/2026, 16:27Pedido 261036282⧉",
      "CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS",
      "Consultado 25/09/2026, 18:00",
    ]);
    expect(within(bloque).queryByRole("list")).toBeNull();
    expect(within(bloque).queryByText(/visita/i)).toBeNull();
    expect(within(bloque).queryByText(/movimientos/)).toBeNull();
  });

  it("lo demás que manda Máximo sigue a la vista, sin repetir lo del bloque", () => {
    render(
      <AgrDeliveryReadingBlock
        extraFields={[
          { key: "estado_pedido", label: "Estado del pedido", value: "X" },
          { key: "pedido", label: "Pedido", value: "261036282" },
          { key: "gestion_status", label: "Gestión", value: "Sin gestión" },
        ]}
        footer="Consultado 25/09/2026, 18:00"
        reading={readAgrDeliveryReading({
          estadoPedido: "AGENDADO",
          motivoRechazo: null,
          submotivoRechazo: null,
          rawPayload: null,
        })}
        source="Último dato de Máximo"
        tone="neutral"
      />,
    );

    const bloque = screen.getByRole("region", { name: "Entrega según Máximo" });
    expect(lineas(bloque)).toEqual([
      "Último dato de Máximo · Agendado",
      "Gestión",
      "Sin gestión",
      "Consultado 25/09/2026, 18:00",
    ]);
  });
});
