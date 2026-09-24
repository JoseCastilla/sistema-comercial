import { webcrypto } from "node:crypto";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyDayList } from "@/features/my-day/components/my-day-list";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";

import type { MyDayEntry } from "@/features/my-day/my-day-types";

/**
 * SPEC-063 fase 2: registrar la gestión desde «Mi día» con el editor de
 * Campañas, y «Guardar y siguiente» a lo largo de la lista.
 */
const { inlineAction } = vi.hoisted(() => ({ inlineAction: vi.fn() }));

vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: inlineAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

// jsdom no desplaza: la fila siguiente se enfoca igual.
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  inlineAction.mockReset();
  inlineAction.mockImplementation(async (_previous: unknown, formData: FormData) => ({
    type: "success" as const,
    message: "Gestión guardada.",
    detail: "",
    attempt: {
      result: String(formData.get("result")),
      observation: null,
      phoneUsed: null,
      status: "IN_PROGRESS",
      attemptsToday: 1,
      nextActionAtLabel: "25/09, 10:00",
      mustResolve: false,
      workView: "espera" as const,
    },
  }));
});

function entry(overrides: Partial<MyDayEntry> & Pick<MyDayEntry, "key" | "title">): MyDayEntry {
  return {
    kind: "venta_caida",
    tier: "venta_en_riesgo",
    bucket: "ahora",
    dueAt: null,
    saleAt: null,
    dueLabel: "venció hace 10 min",
    overdue: true,
    rank: 0,
    action: "Primer contacto vencido",
    detail: null,
    href: `/recovery/sales/${overrides.key}`,
    actionLabel: "Abrir caso",
    manage: {
      caseId: overrides.key,
      phoneOptions: ["999111222"],
      defaultPhone: "999111222",
      serviceNumbers: [],
      lastResult: null,
      lastObservation: null,
    },
    ...overrides,
  };
}

function renderList(entries: MyDayEntry[]) {
  render(
    <CampaignDraftProvider>
      <MyDayList campaignTotal={0} entries={entries} />
    </CampaignDraftProvider>,
  );
}

describe("Mi día · gestión en fila", () => {
  it("un pedido no se gestiona aquí: lleva a Pedidos", () => {
    renderList([
      entry({
        key: "p1",
        title: "CLIENTE PEDIDO",
        kind: "pedido",
        tier: "pedido",
        href: "/orders?q=1",
        actionLabel: "Ver pedido",
        manage: null,
      }),
    ]);

    expect(
      screen.queryByRole("button", { name: /Registrar gestión/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver pedido: CLIENTE PEDIDO" }),
    ).toHaveAttribute("href", "/orders?q=1");
  });

  it("guarda desde la fila y «Guardar y siguiente» abre el próximo caso, saltando el pedido", async () => {
    renderList([
      entry({ key: "c1", title: "PRIMER CLIENTE" }),
      entry({
        key: "p1",
        title: "CLIENTE PEDIDO",
        kind: "pedido",
        tier: "pedido",
        manage: null,
      }),
      entry({ key: "c2", title: "SEGUNDO CLIENTE", tier: "seguimiento_vencido" }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar gestión: PRIMER CLIENTE" }),
    );
    fireEvent.change(screen.getByLabelText("Resultado"), {
      target: { value: "SIN_RESPUESTA" },
    });

    const siguiente = screen.getByRole("button", { name: "Guardar y siguiente" });
    await act(async () => {
      fireEvent.click(siguiente);
    });

    await waitFor(() => expect(inlineAction).toHaveBeenCalledTimes(1));
    // La fila guardada lo dice, y el editor ya está en el segundo cliente.
    await waitFor(() =>
      expect(screen.getByText(/Gestionado:/)).toBeInTheDocument(),
    );
    expect(screen.getByText("Próxima acción: 25/09, 10:00")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Registrar gestión: SEGUNDO CLIENTE" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Resultado")).toHaveValue("");
    // Sin el aviso de «gestión sin guardar»: lo guardado no es un borrador.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
