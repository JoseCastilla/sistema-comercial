import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampaignNav } from "@/features/recovery/components/campaign-nav";

/**
 * Una pestaña que lleva a «acceso denegado» es peor que ninguna: el carril
 * muestra solo lo que el rol puede abrir, y marca dónde está.
 */
describe("Carril de Campañas", () => {
  it("el administrador ve los cinco pasos y sabe en cuál está", () => {
    render(<CampaignNav current="repartir" role="ADMIN" />);

    const enlaces = screen.getAllByRole("link");

    expect(enlaces.map((enlace) => enlace.textContent)).toEqual([
      "Preparar",
      "Revisar",
      "Repartir",
      "Seguimiento",
      "Tablero del día",
    ]);
    expect(screen.getByRole("link", { name: "Repartir" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Revisar" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("el supervisor no ve Preparar: no puede cargar la base", () => {
    render(<CampaignNav current="revisar" role="SUPERVISOR" />);

    expect(screen.queryByRole("link", { name: "Preparar" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("el asesor no tiene carril: su sitio es la bandeja", () => {
    const { container } = render(
      <CampaignNav current="revisar" role="AGENT" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("cada paso lleva a su pantalla", () => {
    render(<CampaignNav current="tablero" role="ADMIN" />);

    expect(screen.getByRole("link", { name: "Seguimiento" })).toHaveAttribute(
      "href",
      "/recovery/follow-up",
    );
    expect(screen.getByRole("link", { name: "Preparar" })).toHaveAttribute(
      "href",
      "/admin/recovery-base",
    );
  });
});
