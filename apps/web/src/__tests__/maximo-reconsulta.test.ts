import { describe, expect, it } from "vitest";

import {
  needsAgrConsultation,
  pickAgrConsultations,
} from "@/features/agr-delivery/consultation";

import type { AgrConsultationCandidate } from "@/features/agr-delivery/consultation";

/**
 * SPEC-087: Máximo se vuelve a consultar solo para lo que todavía puede
 * cambiar. Lo entregado, lo cancelado con motivo y lo que Máximo ya terminó
 * no ocupan lugar en la corrida.
 */
const ahora = new Date("2026-10-24T13:00:00.000Z");
const hace = (dias: number) =>
  new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);

const venta = (
  extra: Partial<AgrConsultationCandidate> = {},
): AgrConsultationCandidate => ({
  status: "SENT",
  deliveryStatus: "PENDING",
  statusUpdatedAt: hace(1),
  registeredAt: hace(1),
  snapshot: null,
  missing: null,
  ...extra,
});

const maximo = (
  estadoPedido: string,
  motivoRechazo: string | null = null,
  fetchedAt = hace(1),
) => ({ estadoPedido, motivoRechazo, submotivoRechazo: null, fetchedAt });

describe("Qué se vuelve a consultar en Máximo", () => {
  it("entregada en DITO o en Máximo: nunca más", () => {
    expect(needsAgrConsultation(venta({ status: "CLOSED" }), ahora)).toBe(false);
    expect(
      needsAgrConsultation(venta({ deliveryStatus: "DELIVERED" }), ahora),
    ).toBe(false);
    expect(
      needsAgrConsultation(venta({ snapshot: maximo("ENTREGADO") }), ahora),
    ).toBe(false);
  });

  it("rechazada o cancelada en Máximo: nunca más, aunque DITO siga en enviada", () => {
    for (const estado of ["RECHAZADO", "CANCELADO"]) {
      expect(
        needsAgrConsultation(
          venta({ snapshot: maximo(estado, "CLIENTE NO DESEA NO RECUPERABLE") }),
          ahora,
        ),
      ).toBe(false);
    }
  });

  it("cancelada en DITO: para con el motivo o a los 3 días, no con una respuesta vacía", () => {
    const cancelada = { status: "CANCELLED" };
    expect(
      needsAgrConsultation(
        venta({ ...cancelada, snapshot: maximo("NO ENTREGADO", "CLIENTE AUSENTE") }),
        ahora,
      ),
    ).toBe(false);
    // Máximo no la tiene aún: puede ser que no la haya importado.
    expect(
      needsAgrConsultation(
        venta({ ...cancelada, missing: { lastCheckedAt: hace(1) } }),
        ahora,
      ),
    ).toBe(true);
    expect(
      needsAgrConsultation(
        venta({
          ...cancelada,
          statusUpdatedAt: hace(4),
          missing: { lastCheckedAt: hace(1) },
        }),
        ahora,
      ),
    ).toBe(false);
    expect(
      needsAgrConsultation(
        venta({ ...cancelada, snapshot: maximo("AGENDADO"), statusUpdatedAt: hace(4) }),
        ahora,
      ),
    ).toBe(false);
    // Recién cancelada y sin motivo todavía: se espera a que Máximo lo diga.
    expect(
      needsAgrConsultation(
        venta({ ...cancelada, snapshot: maximo("AGENDADO"), statusUpdatedAt: hace(1) }),
        ahora,
      ),
    ).toBe(true);
    // Nunca consultada: una vez, para saber el motivo.
    expect(needsAgrConsultation(venta(cancelada), ahora)).toBe(true);
  });

  it("abierta: se consulta, porque el asesor pudo olvidar marcarla enviada", () => {
    const abierta = { status: "OPEN" };
    expect(needsAgrConsultation(venta(abierta), ahora)).toBe(true);
    // Máximo la tiene: se sigue hasta que termine, como cualquier enviada.
    expect(
      needsAgrConsultation(
        venta({ ...abierta, registeredAt: hace(10), snapshot: maximo("AGENDADO") }),
        ahora,
      ),
    ).toBe(true);
    // Máximo nunca la tuvo y lleva más de 3 días: quedó sin enviar.
    expect(
      needsAgrConsultation(
        venta({ ...abierta, registeredAt: hace(4), missing: { lastCheckedAt: hace(1) } }),
        ahora,
      ),
    ).toBe(false);
  });

  it("enviada en curso o ausente en Máximo: se sigue consultando", () => {
    expect(
      needsAgrConsultation(venta({ snapshot: maximo("AGENDADO") }), ahora),
    ).toBe(true);
    expect(
      needsAgrConsultation(venta({ missing: { lastCheckedAt: hace(1) } }), ahora),
    ).toBe(true);
  });

  it("primero lo nunca consultado y después lo que lleva más tiempo sin consultarse", () => {
    const vieja = venta({ registeredAt: hace(30), snapshot: maximo("AGENDADO", null, hace(0.1)) });
    const atrasada = venta({ registeredAt: hace(2), snapshot: maximo("AGENDADO", null, hace(2)) });
    const nueva = venta({ registeredAt: hace(0.5) });
    const elegidas = pickAgrConsultations([vieja, atrasada, nueva], ahora, 2);
    expect(elegidas).toEqual([nueva, atrasada]);
  });
});
