/**
 * Qué campos de Máximo se muestran y con qué nombre (SPEC-075). Módulo puro:
 * lo usa el servidor de Pedidos y se prueba sin base de datos.
 */

/**
 * SPEC-075: los campos de Máximo en el orden y con el nombre de la fuente.
 * Solo se les pone tilde y mayúscula inicial; el valor va tal como llega.
 * Lo que Máximo mande además de esto también se muestra, con su propio
 * nombre, salvo lo que el equipo descartó (BR-007).
 */
const agrDeliveryFieldLabels: ReadonlyArray<[string, string]> = [
  ["estado_pedido", "Estado del pedido"],
  ["motivo_rechazo", "Motivo de rechazo"],
  ["submotivo_rechazo", "Submotivo de rechazo"],
  ["gestion_status", "Estado de gestión"],
  ["resultado", "Resultado"],
  ["proxima_accion", "Próxima acción"],
  ["fecha_compromiso", "Fecha de compromiso"],
  ["updated_by_name", "Actualizado por"],
  ["gestion_updated_at", "Gestión actualizada"],
  ["telefono_receptor", "Teléfono del receptor"],
  ["pedido", "Pedido en Máximo"],
  ["envio", "Envío"],
];
/*
 * SPEC-075 BR-007 (José, 25/09/2026): fuera lo que no sirve para gestionar
 * (fechas de entrega y toma, vendedor, montos, región, zonal) y lo que ya
 * dice la ficha del pedido (cliente, teléfono, ubicación, tipo de entrega,
 * entidad). `order_id` es el identificador interno.
 */
const agrDeliveryHiddenKeys = new Set([
  "order_id",
  "fecha_entrega_pactada",
  "fecha_entrega_real",
  "fecha_toma_pedido",
  "vendedor",
  "nombre_vendedor",
  "monto_cobrar",
  "monto_factura",
  "region",
  "zonal",
  "entidad",
  "nombre_cliente",
  "telefono_cliente",
  "departamento",
  "provincia",
  "distrito",
  "tipo_delivery",
]);

function humanizeAgrKey(key: string): string {
  const text = key.replace(/_/g, " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : key;
}

function readAgrValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function getAgrDeliveryFields(snapshot: {
  estadoPedido: string;
  motivoRechazo: string | null;
  submotivoRechazo: string | null;
  rawPayload: unknown;
}): Array<{ key: string; label: string; value: string }> {
  const raw =
    snapshot.rawPayload &&
    typeof snapshot.rawPayload === "object" &&
    !Array.isArray(snapshot.rawPayload)
      ? (snapshot.rawPayload as Record<string, unknown>)
      : {
          estado_pedido: snapshot.estadoPedido,
          motivo_rechazo: snapshot.motivoRechazo,
          submotivo_rechazo: snapshot.submotivoRechazo,
        };
  const known = new Set(agrDeliveryFieldLabels.map(([key]) => key));
  const fields: Array<{ key: string; label: string; value: string }> = [];
  const clientPhone = readAgrValue(raw.telefono_cliente);
  for (const [key, label] of agrDeliveryFieldLabels) {
    const value = readAgrValue(raw[key]);
    // El receptor solo aporta si no es el mismo teléfono del cliente.
    if (key === "telefono_receptor" && value === clientPhone) continue;
    if (value) fields.push({ key, label, value });
  }
  for (const key of Object.keys(raw).sort()) {
    if (known.has(key) || agrDeliveryHiddenKeys.has(key)) continue;
    const value = readAgrValue(raw[key]);
    if (value) fields.push({ key, label: humanizeAgrKey(key), value });
  }
  return fields;
}
