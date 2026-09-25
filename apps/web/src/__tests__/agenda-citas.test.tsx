import { webcrypto } from "node:crypto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgendaCommitmentList } from "@/features/recovery/components/agenda-commitment-list";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";

import type { AgendaEntry } from "@/features/recovery/server/get-agenda";

/**
 * SPEC-066 grupo 3: la cita es la fila de «Mi día». Se atiende con el editor
 * de botones; reprogramar, cancelar e historial son acciones secundarias.
 */
const { inlineAction } = vi.hoisted(() => ({ inlineAction: vi.fn() }));

vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: inlineAction,
}));
vi.mock("@/features/recovery/server/reschedule-commitment-action", () => ({
  rescheduleCommitmentAction: vi.fn(),
}));
vi.mock("@/features/recovery/server/cancel-commitment-action", () => ({
  cancelCommitmentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
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

function cita(overrides: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    key: "cita-c1",
    commitmentId: "c1",
    caseId: "caso-1",
    caseHref: "/recovery/campaigns/caso-1",
    source: "campana",
    holderName: "CLIENTA DE PRUEBA",
    phone: "911000111",
    phoneOptions: ["911000111"],
    serviceNumbers: [],
    at: new Date("2026-09-25T20:30:00.000Z"),
    dayIso: "2026-09-25",
    timeLabel: "15:30",
    state: "pendiente",
    stateLabel: "Pendiente",
    due: { label: "en 40 min", tone: "warning" },
    isPending: true,
    reason: "Llamar después del trabajo",
    lastResult: "INTERESADO",
    lastResultLabel: "Interesado",
    lastObservation: null,
    lastAttemptAtLabel: "24/09 18:10",
    saleLabel: null,
    clash: false,
    history: [
      {
        id: "c0",
        atLabel: "24/09 19:00",
        stateLabel: "Reprogramada",
        reason: "Pidió otra hora",
        createdByName: "Asesora de prueba",
      },
    ],
    ...overrides,
  };
}

function renderCitas(entries: AgendaEntry[], showDate = false) {
  return render(
    <CampaignDraftProvider>
      <AgendaCommitmentList entries={entries} showDate={showDate} />
    </CampaignDraftProvider>,
  );
}

describe("Mi agenda · la cita como la fila de «Mi día»", () => {
  it("muestra hora, plazo, cliente con teléfono y lo acordado", () => {
    renderCitas([cita()]);

    expect(screen.getByText("15:30")).toBeInTheDocument();
    expect(screen.getByText("en 40 min")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "911000111" }),
    ).toHaveAttribute("href", "tel:911000111");
    expect(
      screen.getByText("Acordado: «Llamar después del trabajo»"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Última gestión: Interesado · 24/09 18:10"),
    ).toBeInTheDocument();
  });

  it("se atiende con el editor de botones y queda como atendida", async () => {
    renderCitas([cita()]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar gestión: CLIENTA DE PRUEBA",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "No contesta" }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar gestión/ }));

    await waitFor(() =>
      expect(screen.getByText("Atendida: No contesta")).toBeInTheDocument(),
    );
    expect(screen.getByText("Próxima acción: 26/09 09:00")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reprogramar" }),
    ).not.toBeInTheDocument();
  });

  it("reprogramar, cancelar e historial se abren de a uno", () => {
    renderCitas([cita()]);

    fireEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    expect(
      screen.getByLabelText("Nueva fecha y hora acordadas"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar cita" }));
    expect(
      screen.queryByLabelText("Nueva fecha y hora acordadas"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Por qué se cancela")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    expect(screen.getByText("24/09 19:00")).toBeInTheDocument();
    expect(screen.getByText("Pidió otra hora")).toBeInTheDocument();
  });

  it("la vencida dice su fecha y la cerrada no se gestiona", () => {
    renderCitas(
      [
        cita({
          due: { label: "vencida desde el 22/09", tone: "danger" },
          dayIso: "2026-09-22",
          timeLabel: "10:00",
          state: "vencida",
          stateLabel: "Vencida",
        }),
        cita({
          key: "cita-c2",
          commitmentId: "c2",
          caseId: "caso-2",
          holderName: "OTRO CLIENTE",
          due: null,
          isPending: false,
          state: "atendida",
          stateLabel: "Atendida",
          reason: null,
        }),
      ],
      true,
    );

    expect(screen.getByText("22/09 10:00")).toBeInTheDocument();
    expect(screen.getByText("vencida desde el 22/09")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar gestión: OTRO CLIENTE" }),
    ).not.toBeInTheDocument();
  });

  it("una venta caída dice de qué venta viene", () => {
    renderCitas([
      cita({ source: "venta_caida", saleLabel: "venta del 18/09" }),
    ]);

    expect(screen.getByText("Venta caída · venta del 18/09")).toBeInTheDocument();
  });
});
