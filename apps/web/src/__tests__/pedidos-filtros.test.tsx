import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderScopeFilters } from "@/features/orders/components/order-scope-filters";

import type {
  OrderScopeFilterOverrides,
  OrderScopeFilterValues,
} from "@/features/orders/components/order-scope-filters";

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

const valoresBase: OrderScopeFilterValues = {
  search: "",
  team: "ALL",
  advisor: "ALL",
  action: null,
  due: null,
};

const asesores = [
  { id: "u-ana", name: "Ana", teamId: "t-lima", teamName: "Lima Centro" },
  { id: "u-luis", name: "Luis", teamId: "t-huancayo", teamName: "Huancayo" },
];

// Un constructor transparente: lo que reciba es lo que se comprueba.
const href = (overrides: OrderScopeFilterOverrides) =>
  `/orders?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [key, String(value)]),
    ),
  ).toString()}`;

function renderFiltros(
  values: Partial<typeof valoresBase> = {},
  extra: Partial<Parameters<typeof OrderScopeFilters>[0]> = {},
) {
  render(
    <OrderScopeFilters
      advisorOptions={asesores}
      buildHref={href}
      showActionFilter={false}
      showTeamFilter
      teamAllLabel="Todos los equipos"
      teamOptions={[
        { id: "t-lima", name: "Lima Centro" },
        { id: "t-huancayo", name: "Huancayo" },
      ]}
      values={{ ...valoresBase, ...values }}
      {...extra}
    />,
  );
}

/**
 * SPEC-041: la búsqueda de Pedidos aplica sola tras 300 ms, Enter la aplica
 * al instante, y el selector de asesor solo ofrece a los del alcance.
 */
describe("Filtros de alcance de Pedidos", () => {
  it("busca solo cuando el término acota, y espera 300 ms", () => {
    renderFiltros();
    const input = screen.getByRole("searchbox", { name: "Buscar pedidos" });

    fireEvent.change(input, { target: { value: "an" } });
    act(() => vi.advanceTimersByTime(400));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/Sigue escribiendo/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "ana" } });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledWith("/orders?search=ana", {
      scroll: false,
    });
  });

  it("Enter aplica al instante, aunque el término sea corto", () => {
    renderFiltros();
    const input = screen.getByRole("searchbox", { name: "Buscar pedidos" });

    fireEvent.change(input, { target: { value: "19" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(replace).toHaveBeenCalledWith("/orders?search=19", {
      scroll: false,
    });
  });

  it("el selector de asesor ofrece a todos con su equipo; con un equipo, solo a los suyos", () => {
    renderFiltros();
    const asesor = screen.getByRole("combobox", { name: "Asesor" });

    expect(
      Array.from(asesor.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["Todos", "Ana · Lima Centro", "Luis · Huancayo"]);

    fireEvent.change(asesor, { target: { value: "u-luis" } });
    expect(replace).toHaveBeenCalledWith("/orders?advisor=u-luis&search=", {
      scroll: false,
    });
  });

  it("al cambiar de equipo, el asesor elegido solo se conserva si pertenece al nuevo", () => {
    renderFiltros({ team: "t-huancayo", advisor: "u-luis" });

    const asesor = screen.getByRole("combobox", { name: "Asesor" });
    expect(
      Array.from(asesor.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["Todos", "Luis"]);

    fireEvent.change(screen.getByRole("combobox", { name: "Equipo" }), {
      target: { value: "t-lima" },
    });
    expect(replace).toHaveBeenCalledWith(
      "/orders?team=t-lima&advisor=ALL&search=",
      { scroll: false },
    );
  });

  it("sin asignar no tiene asesor que ofrecer", () => {
    renderFiltros({ team: "UNASSIGNED" });

    expect(screen.queryByRole("combobox", { name: "Asesor" })).toBeNull();
  });

  it("plazo aplica al elegir, y acción solo existe en la vista logística", () => {
    renderFiltros({}, { showActionFilter: true });

    expect(
      screen.getByRole("combobox", { name: "Acción" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Plazo" }), {
      target: { value: "vencido" },
    });
    expect(replace).toHaveBeenCalledWith("/orders?due=vencido&search=", {
      scroll: false,
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Acción" }), {
      target: { value: "RESCHEDULE" },
    });
    expect(replace).toHaveBeenLastCalledWith(
      "/orders?action=RESCHEDULE&search=",
      { scroll: false },
    );
  });

  it("los filtros activos se ven y se quitan uno a uno, o todos", () => {
    renderFiltros({ search: "ana", advisor: "u-ana", due: "vencido" });

    expect(screen.getByText("Busca «ana»")).toBeInTheDocument();
    expect(screen.getByText("Asesor: Ana")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Quitar Plazo: Fuera de plazo"));
    expect(replace).toHaveBeenLastCalledWith("/orders?due=null&search=ana", {
      scroll: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/orders?search=&team=ALL&advisor=ALL&due=null&action=null",
      { scroll: false },
    );
  });
});
