import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignInboxFilters } from "@/features/recovery/components/campaign-inbox-filters";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderFilters(props: Partial<Parameters<typeof CampaignInboxFilters>[0]> = {}) {
  const view = render(
    <CampaignInboxFilters
      department=""
      departments={["Lima", "Huancayo"]}
      plan=""
      resultLabel="38 caso(s) cumplen el filtro."
      search=""
      {...props}
    />,
  );

  return {
    view,
    campo: screen.getByPlaceholderText("Nombre, DNI o teléfono"),
    planCampo: screen.getByPlaceholderText("49.9"),
  };
}

function escribir(campo: HTMLElement, valor: string) {
  fireEvent.change(campo, { target: { value: valor } });
}

function esperarRebote(ms = 300) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * El asesor teclea con el cliente al teléfono. Cada criterio de aquí abajo
 * existe porque romperlo le cuesta la llamada.
 */
describe("Filtros de campaña · búsqueda en vivo", () => {
  it("busca sola tras la pausa, sin pulsar nada", () => {
    const { campo } = renderFilters();

    escribir(campo, "ramos");
    expect(replace).not.toHaveBeenCalled();

    esperarRebote();
    expect(replace).toHaveBeenCalledWith("/recovery/campaigns?q=ramos", {
      scroll: false,
    });
  });

  it("al teclear rápido, la lista final corresponde al último término", () => {
    const { campo } = renderFilters();

    escribir(campo, "ra");
    esperarRebote(120);
    escribir(campo, "ramo");
    esperarRebote(120);
    escribir(campo, "ramos");
    esperarRebote();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/recovery/campaigns?q=ramos", {
      scroll: false,
    });
  });

  it("Enter no espera la pausa", () => {
    const { campo } = renderFilters();

    escribir(campo, "ramos");
    fireEvent.keyDown(campo, { key: "Enter" });

    expect(replace).toHaveBeenCalledWith("/recovery/campaigns?q=ramos", {
      scroll: false,
    });

    // Y el temporizador pendiente no dispara una segunda navegación.
    esperarRebote();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("un término que no puede encontrar nada no se consulta", () => {
    const { campo } = renderFilters();

    // Tres dígitos de un DNI: la consulta los descarta y devolvería la
    // bandeja entera, haciéndola parpadear entre dígito y dígito.
    escribir(campo, "930");
    esperarRebote();

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/Sigue escribiendo/)).toBeInTheDocument();

    escribir(campo, "9305");
    esperarRebote();
    expect(replace).toHaveBeenCalledWith("/recovery/campaigns?q=9305", {
      scroll: false,
    });
  });

  it("limpiar conserva departamento y plan", () => {
    const { campo } = renderFilters({
      department: "Lima",
      plan: "49.9",
      search: "ramos",
    });

    fireEvent.click(screen.getByTitle("Limpiar la búsqueda"));

    expect(replace).toHaveBeenCalledWith(
      "/recovery/campaigns?department=Lima&plan=49.9",
      { scroll: false },
    );
    expect((campo as HTMLInputElement).value).toBe("");
  });

  it("cambiar el filtro vuelve a la primera página", () => {
    const { campo } = renderFilters({ department: "Lima" });

    escribir(campo, "ramos");
    esperarRebote();

    const [url] = replace.mock.calls[0]!;
    expect(url).not.toContain("page=");
    expect(url).toContain("department=Lima");
  });

  it("el campo conserva el foco mientras la lista se repinta", () => {
    const { campo } = renderFilters();

    act(() => campo.focus());
    escribir(campo, "ramos");
    esperarRebote();

    expect(document.activeElement).toBe(campo);
  });

  it("el departamento filtra al cambiarlo, sin botón", () => {
    renderFilters();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Huancayo" },
    });

    expect(replace).toHaveBeenCalledWith(
      "/recovery/campaigns?department=Huancayo",
      { scroll: false },
    );
  });

  it("el plan también rebota, no exige botón", () => {
    const { planCampo } = renderFilters();

    escribir(planCampo, "49.9");
    expect(replace).not.toHaveBeenCalled();

    esperarRebote();
    expect(replace).toHaveBeenCalledWith("/recovery/campaigns?plan=49.9", {
      scroll: false,
    });
  });
});

describe("Filtros de campaña · el servidor manda cuando el cambio no vino de aquí", () => {
  it("el botón Atrás devuelve el término al campo", () => {
    const { view, campo } = renderFilters({ search: "ramos" });

    expect((campo as HTMLInputElement).value).toBe("ramos");

    view.rerender(
      <CampaignInboxFilters
        department=""
        departments={["Lima", "Huancayo"]}
        plan=""
        resultLabel="38 caso(s) cumplen el filtro."
        search="guevara"
      />,
    );

    expect((campo as HTMLInputElement).value).toBe("guevara");
  });

  it("pero no pisa lo que el asesor está tecleando", () => {
    const { view, campo } = renderFilters();

    escribir(campo, "ramo");
    esperarRebote();

    // El servidor confirma la navegación que acabamos de pedir.
    view.rerender(
      <CampaignInboxFilters
        department=""
        departments={["Lima", "Huancayo"]}
        plan=""
        resultLabel="1 caso(s) cumplen el filtro."
        search="ramo"
      />,
    );

    escribir(campo, "ramos");
    expect((campo as HTMLInputElement).value).toBe("ramos");
  });
});
