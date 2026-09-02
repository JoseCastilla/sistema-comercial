import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Metric } from "@repo/ui/metric";

/**
 * El componente carga tres decisiones que se tomaron mirando pantallas reales:
 * un cero no ocupa una tarjeta entera, la jerarquía se expresa con tamaño y no
 * con color, y las cifras se formatean acá para que ninguna pantalla pueda
 * imprimir la misma variable con dos formatos distintos.
 */
describe("Metric · hideWhenZero", () => {
  it("oculta la tarjeta en cero cuando solo importa si exige acción", () => {
    const { container } = render(
      <Metric hideWhenZero label="Fuera de plazo" tone="danger" value={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("la muestra apenas hay algo que atender", () => {
    render(
      <Metric hideWhenZero label="Fuera de plazo" tone="danger" value={37} />,
    );
    expect(screen.getByText("37")).toBeInTheDocument();
  });

  it("sin la bandera, el cero se muestra: es contexto, no alerta", () => {
    render(<Metric label="No entregados" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("no oculta un valor de texto que empiece con cero", () => {
    render(<Metric hideWhenZero label="Asesores con ventas" value="0/14" />);
    expect(screen.getByText("0/14")).toBeInTheDocument();
  });
});

describe("Metric · formato", () => {
  it("formatea los números con el módulo compartido", () => {
    render(<Metric label="Casos" value={1899} />);
    expect(screen.getByText("1899")).toBeInTheDocument();
  });

  it("deja pasar las cadenas ya compuestas sin tocarlas", () => {
    render(<Metric label="Asesores con ventas" value="0/14" />);
    expect(screen.getByText("0/14")).toBeInTheDocument();
  });
});

describe("Metric · jerarquía y navegación", () => {
  it("marca el hero con un atributo, no con un color", () => {
    const { container } = render(
      <Metric emphasis="hero" label="Ventas ingresadas" value={177} />,
    );
    const tarjeta = container.querySelector(".ui-metric");
    expect(tarjeta).toHaveAttribute("data-emphasis", "hero");
    expect(tarjeta).toHaveAttribute("data-tone", "neutral");
  });

  it("se convierte en enlace cuando abre un detalle", () => {
    render(
      <Metric
        href="/performance/reconciliation?reason=PAYABLE"
        label="Portabilidades pagables"
        value={12}
      />,
    );
    const enlace = screen.getByRole("link");
    expect(enlace).toHaveAttribute(
      "href",
      "/performance/reconciliation?reason=PAYABLE",
    );
    expect(enlace).toHaveAttribute("data-interactive", "true");
  });

  it("sin href no es interactiva", () => {
    const { container } = render(<Metric label="Entregados" value={118} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector(".ui-metric")).not.toHaveAttribute(
      "data-interactive",
    );
  });
});
