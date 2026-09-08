import { webcrypto } from "node:crypto";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignAttemptEditor } from "@/features/recovery/components/campaign-attempt-editor";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";

/**
 * SPEC-049 BR-016: «Guardar y siguiente» avanza solo cuando el servidor
 * confirmó; un error deja el borrador y no mueve el foco; Esc cierra.
 */
const { inlineAction } = vi.hoisted(() => ({ inlineAction: vi.fn() }));

vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: inlineAction,
}));

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

function successFor(formData: FormData) {
  return {
    type: "success" as const,
    message: "Gestión guardada para CLIENTE.",
    detail: "Llevas 1 de 3 intentos exigidos hoy.",
    attempt: {
      result: String(formData.get("result")),
      observation: String(formData.get("observation") ?? "") || null,
      phoneUsed: String(formData.get("phoneUsed") ?? "") || null,
      status: "IN_PROGRESS",
      attemptsToday: 1,
      nextActionAtLabel: "05/09, 15:00",
      mustResolve: false,
      workView: "ahora" as const,
    },
  };
}

beforeEach(() => {
  inlineAction.mockReset();
  inlineAction.mockImplementation(
    async (_previous: unknown, formData: FormData) => successFor(formData),
  );
});

function renderEditor(
  overrides: Partial<Parameters<typeof CampaignAttemptEditor>[0]> = {},
) {
  const onCancel = vi.fn();

  render(
    <CampaignDraftProvider>
      <CampaignAttemptEditor
        caseId="caso-1"
        defaultPhone="999111222"
        holderName="CLIENTE"
        lastObservation={null}
        lastResult={null}
        onCancel={onCancel}
        onSaved={vi.fn()}
        onUnmanageable={vi.fn()}
        phoneOptions={["999111222"]}
        {...overrides}
      />
    </CampaignDraftProvider>,
  );

  return {
    onCancel,
    form: () =>
      screen.getByRole("button", { name: /Guardar gestión/ }).closest("form")!,
    elegir: (value: string) =>
      fireEvent.change(screen.getByLabelText("Resultado"), {
        target: { value },
      }),
    observacion: () =>
      screen.getByPlaceholderText("Qué dijo el cliente hoy") as HTMLInputElement,
  };
}

async function enviar(form: HTMLFormElement) {
  await act(async () => {
    fireEvent.submit(form);
  });
}

/** El botón envía el formulario por `requestSubmit`, como Enter. */
async function pulsarSiguiente() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Guardar y siguiente" }));
  });
}

describe("Gestión en fila · Guardar y siguiente", () => {
  it("avanza únicamente después de confirmar el guardado", async () => {
    const onNext = vi.fn();
    const { form, elegir } = renderEditor({ onNext, nextName: "SIGUIENTE" });

    elegir("SIN_RESPUESTA");
    expect(onNext).not.toHaveBeenCalled();

    await pulsarSiguiente();

    await waitFor(() => expect(inlineAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    void form;
  });

  it("ante un error no avanza y conserva el borrador", async () => {
    inlineAction.mockImplementationOnce(async () => ({
      type: "error" as const,
      message: "Se perdió la conexión.",
    }));
    const onNext = vi.fn();
    const { form, elegir, observacion } = renderEditor({ onNext });

    elegir("SIN_RESPUESTA");
    fireEvent.change(observacion(), { target: { value: "buzón de voz" } });
    await pulsarSiguiente();
    void form;

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/conexión/),
    );
    expect(onNext).not.toHaveBeenCalled();
    expect(observacion().value).toBe("buzón de voz");
  });

  it("«Guardar gestión» no avanza aunque haya siguiente", async () => {
    const onNext = vi.fn();
    const { form, elegir } = renderEditor({ onNext });

    elegir("SIN_RESPUESTA");
    // Enter: el envío ordinario, sin pedir avanzar.
    await enviar(form());

    await waitFor(() => expect(inlineAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Gestión guardada/),
    );
    expect(onNext).not.toHaveBeenCalled();
  });

  it("sin siguiente caso no ofrece el botón; Esc cierra la gestión", () => {
    const { form, onCancel } = renderEditor();

    expect(
      screen.queryByRole("button", { name: "Guardar y siguiente" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(form(), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
