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
import {
  CampaignDraftProvider,
  useCampaignDraft,
} from "@/features/recovery/components/campaign-draft-context";
import { CampaignInboxFilters } from "@/features/recovery/components/campaign-inbox-filters";

/**
 * El servidor se sustituye por un doble que anota lo que recibe. Lo que se
 * ejercita aquí es el contrato del cliente: qué envía, cuándo, y qué hace con
 * la respuesta. Las reglas comerciales viven en el servidor y no se tocan.
 */
const { inlineAction, replace } = vi.hoisted(() => ({
  inlineAction: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/features/recovery/server/register-recovery-attempt-action", () => ({
  registerCampaignAttemptInlineAction: inlineAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
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
    },
  };
}

beforeEach(() => {
  inlineAction.mockReset();
  replace.mockReset();
  inlineAction.mockImplementation(
    async (_previous: unknown, formData: FormData) => successFor(formData),
  );
});

function renderEditor(
  overrides: Partial<Parameters<typeof CampaignAttemptEditor>[0]> = {},
) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const onUnmanageable = vi.fn();

  render(
    <CampaignDraftProvider>
      <CampaignAttemptEditor
        caseId="caso-1"
        defaultPhone="999111222"
        holderName="CLIENTE"
        lastObservation={null}
        lastResult={null}
        onCancel={onCancel}
        onSaved={onSaved}
        onUnmanageable={onUnmanageable}
        phoneOptions={["999111222"]}
        {...overrides}
      />
    </CampaignDraftProvider>,
  );

  return {
    onSaved,
    onCancel,
    form: () =>
      screen.getByRole("button", { name: /Guardar gestión/ }).closest("form")!,
    resultado: resultadoElegido,
    // SPEC-049 BR-009: nada viene preseleccionado; elegir es un acto.
    elegir: elegirResultado,
    observacion: () =>
      screen.getByPlaceholderText(
        "Qué dijo el cliente hoy",
      ) as HTMLInputElement,
    telefonoOculto: () =>
      document.querySelector('input[name="phoneUsed"]') as HTMLInputElement,
    claveOculta: () =>
      document.querySelector(
        'input[name="clientRequestId"]',
      ) as HTMLInputElement,
  };
}

async function enviar(form: HTMLFormElement) {
  await act(async () => {
    fireEvent.submit(form);
  });
}

function claveEnviada(llamada: number): string {
  const formData = inlineAction.mock.calls[llamada]![1] as FormData;

  return String(formData.get("clientRequestId"));
}

/**
 * Fase 6 de SPEC-063: los cuatro resultados frecuentes son botones («No
 * contesta»…) y el resto va en «Otro resultado». El valor viaja en un campo
 * oculto `result`.
 */
const botonesRapidos: Record<string, string> = {
  SIN_RESPUESTA: "No contesta",
  INTERESADO: "Interesado",
  RECHAZA: "No interesado",
  AGENDA: "Agenda una próxima llamada",
};

function elegirResultado(value: string) {
  const rapido = botonesRapidos[value];
  if (rapido) {
    fireEvent.click(screen.getByRole("button", { name: rapido }));
    return;
  }
  fireEvent.change(screen.getByLabelText("Otro resultado"), {
    target: { value },
  });
}

function resultadoElegido(): HTMLInputElement {
  return document.querySelector('input[name="result"]') as HTMLInputElement;
}

describe("Gestión en fila · elegir no es guardar", () => {
  it("cambiar el resultado no envía nada", () => {
    renderEditor();

    elegirResultado("INTERESADO");

    expect(inlineAction).not.toHaveBeenCalled();
  });

  it("la observación nueva empieza vacía aunque haya una anterior", () => {
    const { observacion } = renderEditor({
      lastObservation: "Dijo que lo llamemos el lunes",
      lastResult: "SIN_RESPUESTA",
    });

    expect(observacion().value).toBe("");
    expect(screen.getByText(/lo llamemos el lunes/)).toBeInTheDocument();
  });

  it("agendar exige una fecha y hora futuras antes de enviar", async () => {
    const { form } = renderEditor();

    elegirResultado("AGENDA");
    await enviar(form());

    expect(inlineAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/fecha y hora/);

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const valor = manana.toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText("Fecha y hora acordadas"), {
      target: { value: valor },
    });
    await enviar(form());

    await waitFor(() => expect(inlineAction).toHaveBeenCalledTimes(1));
  });
});

describe("Gestión en fila · canal y teléfono (SPEC-063 fase 6)", () => {
  it("el canal se elige con un botón y viaja en el formulario", () => {
    renderEditor();
    const canal = () =>
      document.querySelector('input[name="channel"]') as HTMLInputElement;

    expect(canal().value).toBe("LLAMADA");
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    expect(canal().value).toBe("WHATSAPP");
    fireEvent.change(screen.getByLabelText("Otro canal"), {
      target: { value: "SMS" },
    });
    expect(canal().value).toBe("SMS");
  });

  it("un solo número se muestra como texto, sin lista", () => {
    renderEditor({ phoneOptions: ["999111222"] });

    expect(screen.queryByLabelText("Teléfono utilizado")).not.toBeInTheDocument();
    expect(screen.getByText("999111222")).toBeInTheDocument();
  });
});

describe("Gestión en fila · el teléfono utilizado", () => {
  it("un teléfono único se preselecciona", () => {
    const { telefonoOculto } = renderEditor({ phoneOptions: ["999111222"] });

    expect(telefonoOculto().value).toBe("999111222");
  });

  it("con varios, se preselecciona el principal y se puede cambiar", () => {
    const { telefonoOculto } = renderEditor({
      defaultPhone: "222333444",
      phoneOptions: ["111222333", "222333444"],
    });

    expect(telefonoOculto().value).toBe("222333444");

    fireEvent.change(screen.getByLabelText("Teléfono utilizado"), {
      target: { value: "111222333" },
    });

    expect(telefonoOculto().value).toBe("111222333");
  });

  it("otro número exige escribirlo antes de guardar", async () => {
    const { form, elegir } = renderEditor();
    elegir("SIN_RESPUESTA");

    // Con un solo número no hay lista: se muestra y se puede cambiar.
    fireEvent.click(screen.getByRole("button", { name: "Usar otro número" }));
    await enviar(form());

    expect(inlineAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/número que usaste/);
  });
});

describe("Gestión en fila · guardar", () => {
  it("un reintento del mismo envío lleva la misma clave; otro intento, otra", async () => {
    inlineAction
      .mockImplementationOnce(async () => ({
        type: "error" as const,
        message: "Se perdió la conexión.",
      }))
      .mockImplementation(async (_previous: unknown, formData: FormData) =>
        successFor(formData),
      );

    const { form, observacion, elegir } = renderEditor();
    elegir("SIN_RESPUESTA");

    fireEvent.change(observacion(), {
      target: { value: "No contesta, buzón" },
    });
    await enviar(form());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/conexión/),
    );

    // El error conserva lo escrito y el formulario sigue ahí para reintentar.
    expect(observacion().value).toBe("No contesta, buzón");

    await enviar(form());
    await waitFor(() => expect(inlineAction).toHaveBeenCalledTimes(2));
    expect(claveEnviada(1)).toBe(claveEnviada(0));

    // Guardado: confirmación visible y la opción de registrar otro intento.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Gestión guardada/),
    );
    expect(screen.getByText(/cambiará de posición/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar otro intento/ }),
    );
    // Otro intento arranca en blanco: hay que volver a elegir qué pasó.
    elegir("SIN_RESPUESTA");
    await enviar(form());
    await waitFor(() => expect(inlineAction).toHaveBeenCalledTimes(3));
    expect(claveEnviada(2)).not.toBe(claveEnviada(1));
  });

  it("la fila recibe los datos confirmados por el servidor, no los escritos", async () => {
    const { form, onSaved, observacion, elegir } = renderEditor();
    elegir("SIN_RESPUESTA");

    fireEvent.change(observacion(), { target: { value: "  con espacios  " } });
    await enviar(form());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [confirmado] = onSaved.mock.calls[0]!;
    expect(confirmado.result).toBe("SIN_RESPUESTA");
    expect(confirmado.attemptsToday).toBe(1);
    expect(confirmado.nextActionAtLabel).toBe("05/09, 15:00");
  });

  it("cancelar descarta solo el borrador", () => {
    const { onCancel } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(inlineAction).not.toHaveBeenCalled();
  });
});

/**
 * Dos filas y un solo borrador: la primera está en edición con cambios, la
 * segunda intenta abrirse.
 */
function DosFilas() {
  const draft = useCampaignDraft();

  return (
    <div>
      <span data-testid="editando">{draft.editingId ?? "ninguno"}</span>
      <button onClick={() => draft.startEditing("A")} type="button">
        Abrir A
      </button>
      <button onClick={() => draft.startEditing("B")} type="button">
        Abrir B
      </button>
      {draft.editingId === "A" ? (
        <CampaignAttemptEditor
          caseId="A"
          defaultPhone={null}
          holderName="CLIENTE A"
          lastObservation={null}
          lastResult={null}
          onCancel={draft.stopEditing}
          onSaved={() => undefined}
          onUnmanageable={() => undefined}
          phoneOptions={["111"]}
        />
      ) : null}
    </div>
  );
}

describe("Borrador de la bandeja · una sola gestión abierta", () => {
  it("cambiar de cliente con cambios sin guardar ofrece tres salidas", async () => {
    render(
      <CampaignDraftProvider>
        <DosFilas />
      </CampaignDraftProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir A" }));
    fireEvent.change(screen.getByPlaceholderText("Qué dijo el cliente hoy"), {
      target: { value: "algo" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Abrir B" }));

    // No cambió: la fila A sigue en edición y pregunta.
    expect(screen.getByTestId("editando")).toHaveTextContent("A");
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/sin guardar/);

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("editando")).toHaveTextContent("A");

    fireEvent.click(screen.getByRole("button", { name: "Abrir B" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar y cambiar" }),
    );
    expect(screen.getByTestId("editando")).toHaveTextContent("B");
  });

  it("sin cambios, cambiar de cliente es inmediato", () => {
    render(
      <CampaignDraftProvider>
        <DosFilas />
      </CampaignDraftProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir A" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir B" }));

    expect(screen.getByTestId("editando")).toHaveTextContent("B");
  });

  it("los filtros no se llevan un borrador sin preguntar", () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <CampaignDraftProvider>
        <DosFilas />
        <CampaignInboxFilters
          department=""
          departments={["Lima"]}
          plan=""
          resultLabel="1 caso(s) cumplen el filtro."
          search=""
        />
      </CampaignDraftProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir A" }));
    fireEvent.change(screen.getByPlaceholderText("Qué dijo el cliente hoy"), {
      target: { value: "algo" },
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Departamento" }), {
      target: { value: "Lima" },
    });

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("editando")).toHaveTextContent("A");

    confirmar.mockRestore();
  });
});

/**
 * SPEC-049 BR-009/BR-010: tres preguntas, nada preseleccionado, la
 * consecuencia se lee antes de guardar.
 */
describe("Gestión en fila · tipificación (SPEC-049)", () => {
  it("sin resultado elegido no se guarda nada", async () => {
    const { form, resultado } = renderEditor();

    expect(resultado().value).toBe("");
    await enviar(form());

    expect(inlineAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Elige qué pasó/);
  });

  it("la tecla N elige «No contesta» sin abrir el desplegable", () => {
    const { form, resultado } = renderEditor();

    fireEvent.keyDown(form(), { key: "n" });

    expect(resultado().value).toBe("SIN_RESPUESTA");
    expect(screen.getByTestId("consecuencia")).toHaveTextContent(/3 del día/);
  });

  it("no interesado muestra la pausa y su consecuencia antes de guardar", () => {
    const { elegir } = renderEditor();

    elegir("RECHAZA");

    expect(
      screen.getByLabelText("Pausa antes de reintentar"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("consecuencia")).toHaveTextContent(
      /pausado hasta/,
    );
  });

  it("pedir que no lo llamen exige la observación como evidencia", async () => {
    const { form, elegir } = renderEditor();

    elegir("NO_CONTACTAR");
    await enviar(form());

    expect(inlineAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/qué dijo el cliente/);
  });

  it("interesado pregunta qué sigue; con llamada acordada pide la hora", () => {
    const { elegir } = renderEditor();

    elegir("INTERESADO");
    expect(screen.getByText("Qué sigue")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Llamada acordada"));
    expect(screen.getByLabelText("Fecha y hora acordadas")).toBeInTheDocument();
  });

  it("«Cancelado» ya no se ofrece", () => {
    renderEditor();

    const otros = screen.getByLabelText("Otro resultado") as HTMLSelectElement;
    const values = Array.from(otros.options).map((option) => option.value);
    expect(values).not.toContain("CANCELADO");
    expect(values).toContain("NO_CONTACTAR");
    // Los frecuentes son botones y no se repiten en la lista.
    expect(values).not.toContain("SIN_RESPUESTA");
    expect(
      screen.getByRole("button", { name: "No contesta" }),
    ).toBeInTheDocument();
  });
});
