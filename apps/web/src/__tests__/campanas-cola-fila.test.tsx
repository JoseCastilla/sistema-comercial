import { webcrypto } from "node:crypto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";
import {
  CampaignQueueRow,
  type CampaignQueueRowData,
} from "@/features/recovery/components/campaign-queue-row";

/**
 * SPEC-065 grupo 2: la fila de la cola es la de «Mi día». Cliente y teléfono
 * a la vista, qué hacer en una frase, intentos en neutro, la resolución
 * obligatoria con su consecuencia y el DNI solo en «Ver datos».
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
        nextActionAtLabel: "25/09 10:00",
        mustResolve: false,
        workView: "ahora" as const,
      },
    }),
  );
});

function fila(overrides: Partial<CampaignQueueRowData> = {}): CampaignQueueRowData {
  return {
    id: "caso-a",
    lastResult: "RECHAZA",
    lastObservation: "No le interesa por ahora",
    lastAttemptAtLabel: "08/09 12:40",
    holderName: "CLIENTA DE PRUEBA",
    documentNumber: "40000001",
    fatherName: null,
    motherName: null,
    birthPlace: null,
    phones: ["911000111"],
    invalidPhones: [],
    services: [
      {
        serviceNumber: "922000222",
        planRaw: "Plan S/39.9",
        carrierRaw: "CLARO",
        isPlantLine: false,
      },
    ],
    phone: "911000111",
    location: "LIMA",
    address: null,
    reference: null,
    deliveryInstructions: null,
    mapsUrl: null,
    origin: { operator: "CLARO", detail: "portó hace 42 días" },
    status: "IN_PROGRESS",
    planSummary: "Máximo S/39.9",
    serviceCount: 1,
    attemptsToday: 0,
    resolutionDue: true,
    interestedWithOrder: false,
    recentAttempts: [],
    work: {
      action: "Ya puede portar: llámalo",
      note: null,
      due: { label: "desde el 12/09", tone: "neutral" },
    },
    ...overrides,
  };
}

function renderFilas(filas: CampaignQueueRowData[]) {
  return render(
    <CampaignDraftProvider>
      <ol data-case-list>
        {filas.map((row, index) => (
          <li key={row.id}>
            <CampaignQueueRow
              minimumDailyAttempts={3}
              nextId={filas[index + 1]?.id ?? null}
              nextName={filas[index + 1]?.holderName ?? null}
              row={row}
            />
          </li>
        ))}
      </ol>
    </CampaignDraftProvider>,
  );
}

describe("Cola de campaña · la fila de «Mi día»", () => {
  it("muestra cliente, teléfono, qué hacer y el plazo sin reproche", () => {
    renderFilas([fila()]);

    expect(screen.getByText("CLIENTA DE PRUEBA")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "911000111" }),
    ).toHaveAttribute("href", "tel:911000111");
    expect(screen.getByText("Ya puede portar: llámalo")).toBeInTheDocument();
    expect(screen.getByText("desde el 12/09")).toBeInTheDocument();
    expect(
      screen.getByText("Lleva 7 días contigo: ciérralo o agenda una fecha"),
    ).toBeInTheDocument();
    // Sin la etiqueta repetida ni el viejo «Resolver hoy».
    expect(screen.queryByText("Ya puede portar")).not.toBeInTheDocument();
    expect(screen.queryByText("Resolver hoy")).not.toBeInTheDocument();
  });

  it("la última gestión, operador y los intentos van en una línea menor", () => {
    renderFilas([fila()]);

    expect(
      screen.getByText(
        "Última gestión: No interesado · 08/09 12:40 · «No le interesa por ahora»",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("CLARO · Máximo S/39.9 · portó hace 42 días · 0 de 3 hoy"),
    ).toBeInTheDocument();
  });

  it("el DNI se ve solo al abrir «Ver datos»", () => {
    renderFilas([fila()]);

    expect(screen.queryByText("40000001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver datos" }));
    expect(screen.getByText("40000001")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ocultar datos" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("«Guardar y siguiente» abre la gestión del siguiente caso", async () => {
    renderFilas([
      fila(),
      fila({ id: "caso-b", holderName: "OTRO CLIENTE", phone: "933000333" }),
    ]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registrar gestión: CLIENTA DE PRUEBA",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "No contesta" }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar y siguiente/ }));

    await waitFor(() =>
      expect(
        screen.getByText("Gestionado: No contesta"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Próxima acción: 25/09 10:00")).toBeInTheDocument();
    // El editor abierto ahora es el del siguiente: su botón ya no está.
    expect(
      screen.queryByRole("button", { name: "Registrar gestión: OTRO CLIENTE" }),
    ).not.toBeInTheDocument();
  });

  it("las flechas llevan el foco a la acción de la fila de abajo", () => {
    renderFilas([
      fila(),
      fila({ id: "caso-b", holderName: "OTRO CLIENTE", phone: "933000333" }),
    ]);

    const primera = screen.getByRole("button", {
      name: "Registrar gestión: CLIENTA DE PRUEBA",
    });
    primera.focus();
    fireEvent.keyDown(primera, { key: "ArrowDown" });

    expect(
      screen.getByRole("button", { name: "Registrar gestión: OTRO CLIENTE" }),
    ).toHaveFocus();
  });
});
