import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueueFilters } from "@/features/recovery/components/queue-filters";

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

const opciones = {
  views: [
    { value: "open", label: "Por distribuir" },
    { value: "unworked", label: "Asignados sin gestión" },
  ],
  teams: [
    { id: "t-lima", name: "Lima Centro" },
    { id: "t-huancayo", name: "Huancayo" },
  ],
  allowNoTeam: true,
  departments: ["LIMA", "JUNIN"],
  plans: ["Máximo S/39.9", "Máximo S/49.9"],
  advisors: [{ id: "u-1", name: "Jimena Cuya" }],
  ages: [
    { value: "hoy", label: "Hoy" },
    { value: "ayer", label: "Ayer" },
  ],
};

function renderFiltros(
  values: Partial<Parameters<typeof QueueFilters>[0]["values"]> = {},
) {
  render(
    <QueueFilters
      basePath="/recovery/distribute"
      options={opciones}
      resultLabel="36 caso(s) cumplen el filtro."
      values={{
        q: "",
        view: "unworked",
        team: "",
        department: "",
        plan: "",
        advisor: "",
        age: "",
        ...values,
      }}
    />,
  );
}

function ultimaUrl(): string {
  const llamada = replace.mock.calls.at(-1);
  return llamada ? String(llamada[0]) : "";
}

describe("Filtros de cola · en vivo y en la URL", () => {
  it("la búsqueda espera la pausa y conserva la vista", () => {
    renderFiltros();

    fireEvent.change(screen.getByPlaceholderText("Nombre, DNI o teléfono"), {
      target: { value: "guevara" },
    });
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));

    expect(ultimaUrl()).toBe("/recovery/distribute?view=unworked&q=guevara");
  });

  it("los selectores aplican al cambiar, sin botón", () => {
    renderFiltros();

    fireEvent.change(screen.getByRole("combobox", { name: "Departamento" }), {
      target: { value: "JUNIN" },
    });

    expect(ultimaUrl()).toBe(
      "/recovery/distribute?view=unworked&department=JUNIN",
    );
  });

  it("«Sin equipo» viaja como su propio valor", () => {
    renderFiltros();

    fireEvent.change(screen.getByRole("combobox", { name: "Equipo" }), {
      target: { value: "none" },
    });

    expect(ultimaUrl()).toBe("/recovery/distribute?view=unworked&team=none");
  });

  it("el asesor actual y la antigüedad se filtran como los demás", () => {
    renderFiltros();

    fireEvent.change(screen.getByRole("combobox", { name: "Asesor actual" }), {
      target: { value: "u-1" },
    });
    expect(ultimaUrl()).toContain("advisor=u-1");

    fireEvent.change(screen.getByRole("combobox", { name: "Antigüedad" }), {
      target: { value: "ayer" },
    });
    expect(ultimaUrl()).toContain("age=ayer");
  });

  it("cambiar de vista conserva los demás filtros y nunca arrastra la página", () => {
    renderFiltros({ team: "t-lima", plan: "Máximo S/49.9" });

    fireEvent.change(screen.getByRole("combobox", { name: "Vista" }), {
      target: { value: "open" },
    });

    const url = ultimaUrl();
    expect(url).toContain("view=open");
    expect(url).toContain("team=t-lima");
    expect(url).toContain("plan=M%C3%A1ximo+S%2F49.9");
    expect(url).not.toContain("page=");
  });
});

describe("Filtros de cola · los activos se ven y se quitan", () => {
  it("muestra cada filtro activo con su nombre legible", () => {
    renderFiltros({
      q: "ramos",
      team: "none",
      department: "LIMA",
      plan: "Máximo S/39.9",
      advisor: "u-1",
      age: "hoy",
    });

    expect(screen.getByText(/Busca «ramos»/)).toBeInTheDocument();
    expect(
      screen.getByText("Equipo: Sin equipo", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Departamento: LIMA", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Plan: Máximo S/39.9", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Asesor: Jimena Cuya", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Antigüedad: Hoy", { exact: false }),
    ).toBeInTheDocument();
  });

  it("quitar uno deja los demás", () => {
    renderFiltros({ team: "t-lima", department: "LIMA" });

    fireEvent.click(screen.getByTitle("Quitar Departamento: LIMA"));

    expect(ultimaUrl()).toBe("/recovery/distribute?view=unworked&team=t-lima");
  });

  it("«Limpiar filtros» conserva solo la vista", () => {
    renderFiltros({
      q: "ramos",
      team: "t-lima",
      plan: "Máximo S/39.9",
      age: "hoy",
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(ultimaUrl()).toBe("/recovery/distribute?view=unworked");
  });

  it("sin filtros activos no hay nada que limpiar", () => {
    renderFiltros();

    expect(
      screen.queryByRole("button", { name: "Limpiar filtros" }),
    ).toBeNull();
  });
});

describe("Filtros de cola · selectores propios de una pantalla", () => {
  const conExtras = {
    ...opciones,
    extras: [
      {
        key: "result",
        label: "Última tipificación",
        options: [
          { value: "SIN_RESPUESTA", label: "No contesta" },
          { value: "SIN_GESTION", label: "Sin gestión" },
        ],
      },
      {
        key: "next",
        label: "Próxima acción",
        emptyLabel: "Cualquiera",
        options: [{ value: "vencida", label: "Vencida" }],
      },
    ],
  };

  function renderConExtras(extra: Record<string, string> = {}) {
    render(
      <QueueFilters
        basePath="/recovery/follow-up"
        options={conExtras}
        resultLabel="12 caso(s)."
        values={{
          q: "",
          team: "",
          department: "",
          plan: "",
          advisor: "",
          age: "",
          extra,
        }}
      />,
    );
  }

  it("un extra navega por su propio parámetro", () => {
    renderConExtras();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Última tipificación" }),
      { target: { value: "SIN_RESPUESTA" } },
    );

    expect(ultimaUrl()).toBe("/recovery/follow-up?result=SIN_RESPUESTA");
  });

  it("los extras conviven con los demás y se quitan uno a uno", () => {
    renderConExtras({ result: "SIN_GESTION", next: "vencida" });

    expect(
      screen.getByText("Última tipificación: Sin gestión", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Próxima acción: Vencida", { exact: false }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Quitar Próxima acción: Vencida"));

    expect(ultimaUrl()).toBe("/recovery/follow-up?result=SIN_GESTION");
  });

  it("«Limpiar filtros» también borra los extras", () => {
    renderConExtras({ result: "SIN_GESTION" });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(ultimaUrl()).toBe("/recovery/follow-up");
  });

  it("el rótulo vacío de un extra es configurable", () => {
    renderConExtras();

    const proxima = screen.getByRole("combobox", {
      name: "Próxima acción",
    }) as HTMLSelectElement;

    expect(proxima.options[0]!.textContent).toBe("Cualquiera");
  });
});
