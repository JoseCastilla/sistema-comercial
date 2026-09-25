import { webcrypto } from "node:crypto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CaseWorkCard } from "@/features/recovery/components/case-work-card";
import { ResolveCaseForm } from "@/features/recovery/components/resolve-case-form";

/**
 * SPEC-067: la ficha del caso abre con la tarjeta de «Mi día» y el editor de
 * botones; cerrar el caso no llega con nada elegido.
 */
const { inlineAction, refresh } = vi.hoisted(() => ({
  inlineAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: inlineAction,
}));
vi.mock("@/features/recovery/server/resolve-recovery-case-action", () => ({
  resolveRecoveryCaseAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  refresh.mockReset();
  inlineAction.mockReset();
  inlineAction.mockImplementation(
    async (_previous: unknown, formData: FormData) => ({
      type: "success" as const,
      message: "Gestión guardada.",
      detail: "",
      attempt: {
        result: String(formData.get("result")),
        observation: null,
        phoneUsed: null,
        status: "IN_PROGRESS",
        attemptsToday: 1,
        nextActionAtLabel: "26/09 09:00",
        mustResolve: false,
        workView: "ahora" as const,
      },
    }),
  );
});

function renderCard(canManage = true) {
  return render(
    <CaseWorkCard
      action="Llamar ya"
      canManage={canManage}
      caseId="caso-1"
      due={{ label: "venció hace 1 h", tone: "danger" }}
      holderName="CLIENTA DE PRUEBA"
      lastObservation={null}
      lastResult={null}
      meta="Venta del 24/09 · pedido 1000000001A"
      notes={[{ text: "Contactar al cliente y reagendar la visita" }]}
      phone="911000111"
      phoneOptions={["911000111"]}
      serviceNumbers={[]}
    />,
  );
}

describe("Ficha del caso · la tarjeta de «Mi día» arriba", () => {
  it("dice plazo, qué hacer, el motivo y el número al que llamar", () => {
    renderCard();

    expect(screen.getByText("venció hace 1 h")).toBeInTheDocument();
    expect(screen.getByText("Llamar ya")).toBeInTheDocument();
    expect(
      screen.getByText("Contactar al cliente y reagendar la visita"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "911000111" }),
    ).toHaveAttribute("href", "tel:911000111");
  });

  it("abre el editor de botones con el teléfono ya elegido", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "No contesta" })).toBeInTheDocument();
    expect(
      document.querySelector('input[name="phoneUsed"]') as HTMLInputElement,
    ).toHaveValue("911000111");
  });

  it("al guardar dice qué pasó y vuelve a leer la ficha", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "No contesta" }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar gestión/ }));

    await waitFor(() =>
      expect(screen.getByText("Gestionado: No contesta")).toBeInTheDocument(),
    );
    expect(screen.getByText("Próxima acción: 26/09 09:00")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("cerrar el editor no lo vuelve a abrir solo", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("button", { name: "No contesta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar gestión: CLIENTA DE PRUEBA" }),
    ).toBeInTheDocument();
  });

  it("sin permiso para gestionar no hay editor", () => {
    renderCard(false);

    expect(
      screen.queryByRole("button", { name: "No contesta" }),
    ).not.toBeInTheDocument();
  });
});

describe("Ficha del caso · cerrar sin nada elegido", () => {
  const gates = {
    YA_MIGRO_OTRA_AGENCIA: { enabled: true, missing: null },
    RECHAZO_DEFINITIVO: { enabled: true, missing: null },
  };

  it("no llega marcado ni avisa antes de elegir", () => {
    render(
      <ResolveCaseForm
        canUseOther={false}
        caseId="caso-1"
        gates={gates}
        suggestions={[]}
      />,
    );

    expect(screen.getByLabelText("Cómo termina")).toHaveValue("");
    expect(
      screen.queryByText(/todavía no tiene una venta nueva/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolver caso" })).toBeDisabled();
  });

  it("el aviso aparece solo al elegir «Recuperado»", () => {
    render(
      <ResolveCaseForm
        canUseOther={false}
        caseId="caso-1"
        gates={gates}
        suggestions={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cómo termina"), {
      target: { value: "RECOVERED" },
    });
    expect(
      screen.getByText(/todavía no tiene una venta nueva/),
    ).toBeInTheDocument();
  });

  it("«Perdido» pide elegir el motivo antes de habilitar", () => {
    render(
      <ResolveCaseForm
        canUseOther={false}
        caseId="caso-1"
        gates={gates}
        suggestions={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cómo termina"), {
      target: { value: "LOST" },
    });
    expect(screen.getByRole("button", { name: "Resolver caso" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de pérdida"), {
      target: { value: "RECHAZO_DEFINITIVO" },
    });
    expect(screen.getByRole("button", { name: "Resolver caso" })).toBeEnabled();
  });
});
