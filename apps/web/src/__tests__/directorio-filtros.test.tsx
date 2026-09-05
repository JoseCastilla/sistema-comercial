import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DirectoryFilters } from "@/features/admin/components/directory-filters";

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

function renderFiltros(
  overrides: Partial<Parameters<typeof DirectoryFilters>[0]> = {},
) {
  render(
    <DirectoryFilters
      basePath="/admin/users"
      preserve={{ persona: "u-9" }}
      resultLabel="12 resultados"
      search={{
        value: "",
        label: "Buscar persona",
        placeholder: "Nombre o correo",
      }}
      selects={[
        {
          key: "role",
          label: "Rol",
          value: "",
          emptyLabel: "Todos los roles",
          options: [
            { value: "AGENT", label: "Asesores" },
            { value: "SUPERVISOR", label: "Supervisores" },
          ],
        },
        {
          key: "venta",
          label: "Capacidad de venta",
          value: "si",
          emptyLabel: "Cualquiera",
          options: [
            { value: "si", label: "Vende" },
            { value: "no", label: "No vende" },
          ],
        },
      ]}
      {...overrides}
    />,
  );
}

/**
 * SPEC-043 UX-06: la barra de los directorios vive en la URL, espera 300 ms
 * al escribir, aplica los selectores al cambiar y conserva el panel abierto.
 */
describe("Filtros de los directorios administrativos", () => {
  it("espera 300 ms y dos caracteres; conserva el panel abierto y los demás filtros", () => {
    renderFiltros();
    const input = screen.getByRole("searchbox", { name: "Buscar persona" });

    fireEvent.change(input, { target: { value: "a" } });
    act(() => vi.advanceTimersByTime(400));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/Sigue escribiendo/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "an" } });
    act(() => vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledWith(
      "/admin/users?persona=u-9&q=an&venta=si",
      { scroll: false },
    );
  });

  it("Enter aplica al instante y los selectores aplican al cambiar", () => {
    renderFiltros();

    const input = screen.getByRole("searchbox", { name: "Buscar persona" });
    fireEvent.change(input, { target: { value: "j" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/users?persona=u-9&q=j&venta=si",
      { scroll: false },
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), {
      target: { value: "AGENT" },
    });
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/users?persona=u-9&q=j&role=AGENT&venta=si",
      { scroll: false },
    );
  });

  it("los filtros activos se ven y se quitan; limpiar deja solo el panel", () => {
    renderFiltros({
      search: { value: "ana", label: "Buscar persona", placeholder: "" },
    });

    expect(screen.getByText("Busca «ana»")).toBeInTheDocument();
    expect(screen.getByText("Capacidad de venta: Vende")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Quitar Capacidad de venta: Vende"));
    expect(replace).toHaveBeenLastCalledWith("/admin/users?persona=u-9&q=ana", {
      scroll: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/users?persona=u-9", {
      scroll: false,
    });
  });
});
