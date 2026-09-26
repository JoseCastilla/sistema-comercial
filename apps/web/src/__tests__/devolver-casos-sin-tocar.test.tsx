import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReleaseStaleCasesForm } from "@/features/recovery/components/release-stale-cases-form";

/**
 * SPEC-070 BR-010: devolver a los casos libres del equipo lo que un asesor
 * lleva siete días sin tocar pide confirmar, diciendo cuántos y de quién.
 */
const { releaseAction } = vi.hoisted(() => ({ releaseAction: vi.fn() }));

vi.mock("@/features/recovery/server/release-stale-cases-action", () => ({
  releaseStaleCasesAction: releaseAction,
}));

beforeEach(() => {
  releaseAction.mockReset();
  releaseAction.mockImplementation(
    async (_previous: unknown, formData: FormData) => ({
      type: "success" as const,
      message: `57 casos volvieron a los casos libres del equipo (${String(formData.get("advisorId"))}).`,
    }),
  );
});

describe("Devolver casos sin tocar", () => {
  it("no hace nada sin confirmar, y la confirmación dice cuántos y de quién", () => {
    render(
      <ReleaseStaleCasesForm advisorId="u-1" advisorName="Silvia" count={57} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Devolver 57 casos a los casos libres",
      }),
    );

    expect(releaseAction).not.toHaveBeenCalled();
    expect(
      screen.getByText(/¿Devolver 57 casos de Silvia que llevan 7 días o más sin gestión\?/),
    ).toBeInTheDocument();
  });

  it("cancelar vuelve atrás sin enviar", () => {
    render(
      <ReleaseStaleCasesForm advisorId="u-1" advisorName="Silvia" count={1} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Devolver 1 caso a los casos libres" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(releaseAction).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Devolver 1 caso a los casos libres" }),
    ).toBeInTheDocument();
  });

  it("al confirmar envía el asesor y dice cuántos volvieron", async () => {
    render(
      <ReleaseStaleCasesForm advisorId="u-1" advisorName="Silvia" count={57} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Devolver 57 casos a los casos libres",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sí, devolver" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "57 casos volvieron a los casos libres del equipo (u-1).",
      ),
    );
    expect(releaseAction).toHaveBeenCalledTimes(1);
  });
});
