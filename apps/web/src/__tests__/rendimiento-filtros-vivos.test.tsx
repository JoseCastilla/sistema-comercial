import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DirectoryFilters } from "@/features/admin/components/directory-filters";
import {
  advisorHref,
  matrixHref,
  performanceHref,
  teamHref,
} from "@/features/performance/performance-links";
import {
  filterBreakdownBySearch,
  normalizeSearchTerm,
  parseMatrixRange,
  resolveMatrixRange,
  selectMatrixDays,
} from "@/features/performance/performance-management";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockClear();
});

const alcance = {
  month: "2026-09",
  view: "TEAM" as const,
  canSwitchView: false,
  teamFilter: "t-1",
  agentFilter: "u-ana",
  from: "2026-09-01",
  to: "2026-09-30",
  sort: "CUOTA" as const,
  management: null,
  search: "",
  matrixRangeRequested: null,
};

/**
 * SPEC-044 REN-06/REN-07: filtros vivos en el tablero, el nombre del asesor
 * siempre filtra, la búsqueda acota sin tocar los indicadores y la matriz
 * cambia de ventana sin cambiar la cohorte.
 */
describe("Barra de filtros del tablero", () => {
  it("el mes aplica al cambiar y conserva orden, gestión y el resto de filtros", () => {
    render(
      <DirectoryFilters
        basePath="/performance"
        fields={[
          {
            key: "month",
            label: "Mes de la venta",
            value: "2026-09",
            max: "2026-09",
          },
        ]}
        preserve={{ orden: "CUOTA", gestion: "SIN_PRODUCCION" }}
        resultLabel="20 asesores"
        search={{ value: "", label: "Buscar asesor", placeholder: "" }}
        selects={[
          {
            key: "team",
            label: "Equipo",
            value: "t-1",
            emptyLabel: "Toda la organización",
            options: [{ value: "t-1", label: "Lima" }],
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mes de la venta"), {
      target: { value: "2026-08" },
    });
    expect(replace).toHaveBeenLastCalledWith(
      "/performance?orden=CUOTA&gestion=SIN_PRODUCCION&month=2026-08&team=t-1",
      { scroll: false },
    );

    // El mes no es un filtro que se quite: «Limpiar filtros» lo conserva.
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/performance?orden=CUOTA&gestion=SIN_PRODUCCION&month=2026-09",
      { scroll: false },
    );
  });

  it("sin búsqueda declarada no hay caja de búsqueda ni `q` en la URL", () => {
    render(
      <DirectoryFilters
        basePath="/performance"
        fields={[{ key: "month", label: "Mes", value: "2026-09" }]}
        resultLabel="Solo tus ventas"
        selects={[]}
      />,
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
    fireEvent.change(screen.getByLabelText("Mes"), {
      target: { value: "2026-07" },
    });
    expect(replace).toHaveBeenLastCalledWith("/performance?month=2026-07", {
      scroll: false,
    });
  });
});

describe("Búsqueda por nombre", () => {
  it("acota sin tildes ni mayúsculas y exige dos caracteres", () => {
    const rows = [{ name: "Jimena Cuya" }, { name: "Ángel Pérez" }];
    expect(filterBreakdownBySearch(rows, "angel").map((r) => r.name)).toEqual([
      "Ángel Pérez",
    ]);
    expect(filterBreakdownBySearch(rows, "CUY")).toHaveLength(1);
    expect(filterBreakdownBySearch(rows, "j")).toHaveLength(2);
    expect(normalizeSearchTerm("  a ")).toBe("");
    expect(normalizeSearchTerm(" Ana ")).toBe("Ana");
  });
});

describe("Enlaces del tablero (fase 3)", () => {
  it("el nombre del asesor siempre filtra por él; «Ver todo el equipo» quita asesor y búsqueda", () => {
    expect(advisorHref(alcance, "u-ana")).toBe(
      "/performance?month=2026-09&team=t-1&agent=u-ana&orden=CUOTA",
    );
    expect(teamHref({ ...alcance, search: "ana" })).toBe(
      "/performance?month=2026-09&team=t-1&orden=CUOTA",
    );
  });

  it("la búsqueda y la ventana de la matriz viajan en la URL", () => {
    expect(performanceHref({ ...alcance, search: "cuya" })).toContain("q=cuya");
    expect(matrixHref(alcance, "MES")).toBe(
      "/performance?month=2026-09&team=t-1&agent=u-ana&orden=CUOTA&matriz=MES",
    );
  });
});

describe("Ventana de la matriz", () => {
  it("por defecto 7 días en el mes en curso y mes completo en uno cerrado; la URL manda", () => {
    expect(resolveMatrixRange(null, true)).toBe("7D");
    expect(resolveMatrixRange(null, false)).toBe("MES");
    expect(resolveMatrixRange("MES", true)).toBe("MES");
    expect(parseMatrixRange("x")).toBeNull();
    expect(parseMatrixRange("7D")).toBe("7D");
  });

  it("«últimos 7 días» son los últimos siete transcurridos, sin días futuros", () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      isFuture: index >= 10,
    }));
    expect(selectMatrixDays(days, "7D")).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(selectMatrixDays(days, "MES")).toHaveLength(30);
    expect(selectMatrixDays(days.slice(0, 4), "7D")).toEqual([0, 1, 2, 3]);
  });
});
