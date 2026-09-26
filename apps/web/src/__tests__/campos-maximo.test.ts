import { describe, expect, it } from "vitest";

import { getAgrDeliveryFields } from "@/features/orders/agr-delivery-fields";

/**
 * SPEC-075: lo que manda Máximo, tal cual, sin lo que el equipo descartó ni
 * lo que ya dice la ficha del pedido (BR-007).
 */
const registro = {
  order_id: "abc-123",
  estado_pedido: "NO ENTREGADO",
  motivo_rechazo: "CLIENTE AUSENTE",
  submotivo_rechazo: "CLIENTE NO CONTESTA LLAMADAS",
  gestion_status: "Sin gestión",
  fecha_entrega_pactada: "25-09-26",
  fecha_entrega_real: "25-09-26",
  fecha_toma_pedido: "25-09-26",
  tipo_delivery: "EXPRESS",
  envio: "8461500",
  pedido: "261036282",
  vendedor: "FLEETLIMC",
  nombre_vendedor: "FLEET DELIVERY B2C LIMA",
  departamento: "LORETO",
  provincia: "MAYNAS",
  distrito: "SAN JUAN BAUTISTA",
  entidad: "DISTRIBUIDOR ONLINE",
  monto_cobrar: 0,
  monto_factura: 0,
  nombre_cliente: "CLIENTE DE PRUEBA",
  region: "SUR",
  zonal: "HUANCAYO",
  telefono_cliente: "900000001",
  telefono_receptor: "900000001",
  resultado: null,
  campo_nuevo: "VALOR NUEVO",
};

const campos = (raw: Record<string, unknown>) =>
  getAgrDeliveryFields({
    estadoPedido: "NO ENTREGADO",
    motivoRechazo: null,
    submotivoRechazo: null,
    rawPayload: raw,
  });

describe("Campos de Máximo", () => {
  it("muestra solo lo útil, con el valor tal como llega y en el orden de la fuente", () => {
    expect(campos(registro).map((field) => `${field.label}: ${field.value}`)).toEqual([
      "Estado del pedido: NO ENTREGADO",
      "Motivo: CLIENTE AUSENTE",
      "Submotivo: CLIENTE NO CONTESTA LLAMADAS",
      "Gestión: Sin gestión",
      "Pedido: 261036282",
      "Envío: 8461500",
      "Campo nuevo: VALOR NUEVO",
    ]);
  });

  it("el teléfono del receptor aparece solo si es otro número", () => {
    const labels = campos({ ...registro, telefono_receptor: "911111111" }).map(
      (field) => field.label,
    );
    expect(labels).toContain("Teléfono del receptor");
  });
});
