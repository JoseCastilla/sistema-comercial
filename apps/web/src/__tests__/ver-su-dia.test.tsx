import { webcrypto } from "node:crypto";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MyDayList } from "@/features/my-day/components/my-day-list";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";

import type { MyDayEntry } from "@/features/my-day/my-day-types";

/**
 * SPEC-069 fase 2: el supervisor ve el «Mi día» del asesor tal como él lo
 * ve, pero en solo lectura: abre los casos, no los gestiona.
 */
vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

function entry(overrides: Partial<MyDayEntry> = {}): MyDayEntry {
  return {
    key: "venta:c1",
    kind: "venta_caida",
    tier: "venta_en_riesgo",
    bucket: "ahora",
    dueAt: null,
    saleAt: null,
    dueLabel: "venció hace 1 h",
    overdue: true,
    tone: "danger",
    phone: null,
    rank: 0,
    title: "CLIENTA DE PRUEBA",
    action: "Llamar ya",
    detail: "Venta del 24/09 · pedido 1000000001A",
    href: "/recovery/sales/c1",
    actionLabel: "Abrir caso",
    manage: {
      caseId: "c1",
      phoneOptions: ["999111222"],
      defaultPhone: "999111222",
      serviceNumbers: [],
      lastResult: null,
      lastObservation: null,
    },
    ...overrides,
  };
}

function renderList(readOnly: boolean, campaignTotal = 0, entries = [entry()]) {
  render(
    <CampaignDraftProvider>
      <MyDayList
        campaignLink={
          readOnly
            ? {
                href: "/recovery/follow-up?advisor=u-1",
                label: "Ver su cartera en Seguimiento",
              }
            : undefined
        }
        campaignTotal={campaignTotal}
        entries={entries}
        readOnly={readOnly}
      />
    </CampaignDraftProvider>,
  );
}

describe("Ver su día · solo lectura", () => {
  it("dice lo mismo que el asesor ve: plazo, frase y teléfono", () => {
    renderList(true);

    expect(screen.getByText("venció hace 1 h")).toBeInTheDocument();
    expect(screen.getByText("Llamar ya")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "999111222" }),
    ).toHaveAttribute("href", "tel:999111222");
  });

  it("no ofrece registrar: abre el caso", () => {
    renderList(true);

    expect(
      screen.queryByRole("button", { name: /Registrar gestión/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir caso: CLIENTA DE PRUEBA" }),
    ).toHaveAttribute("href", "/recovery/sales/c1");
  });

  it("para el asesor, la misma fila sí se gestiona", () => {
    renderList(false);

    expect(
      screen.getByRole("button", {
        name: "Registrar gestión: CLIENTA DE PRUEBA",
      }),
    ).toBeInTheDocument();
  });

  it("la campaña lleva a su cartera en Seguimiento, no a la cola del supervisor", () => {
    renderList(true, 26, [
      entry({
        key: "campana:k1",
        kind: "campana",
        tier: "campana",
        title: "CLIENTE DE CAMPAÑA",
        action: "Volver a llamar",
        href: "/recovery/campaigns/k1",
        manage: { ...entry().manage!, caseId: "k1" },
      }),
    ]);

    expect(
      screen.getByRole("link", { name: "Ver su cartera en Seguimiento" }),
    ).toHaveAttribute("href", "/recovery/follow-up?advisor=u-1");
  });
});
