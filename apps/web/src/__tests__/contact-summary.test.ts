import { describe, expect, it } from "vitest";

import {
  buildMapsUrl,
  buildOsmEmbedUrl,
  composeAddress,
  readCoordinates,
} from "@/features/recovery/contact-summary";

/**
 * La dirección y las coordenadas se leen del JSON que deja la base nacional,
 * y ahora las consumen dos pantallas —la ficha y la cola—. Estas reglas fijan
 * que ambas armen lo mismo y que un dato ausente no se convierta en un mapa
 * apuntando al golfo de Guinea.
 */
describe("composeAddress", () => {
  it("arma vía, complejo, manzana y lote en el orden en que se dictan", () => {
    expect(
      composeAddress({
        streetType: "AV",
        streetName: "HUANCAVELICA",
        streetNumber: "1380",
        housingType: "UR",
        housingName: "CERCADO",
        block: "C",
        lot: "12",
      }),
    ).toBe("AV HUANCAVELICA 1380 · UR CERCADO · Mz. C · Lote 12");
  });

  it("omite las partes que faltan sin dejar separadores huérfanos", () => {
    expect(composeAddress({ streetName: "LOS PINOS", streetNumber: "4" })).toBe(
      "LOS PINOS 4",
    );
  });

  it("devuelve null cuando no hay nada que componer", () => {
    expect(composeAddress({})).toBeNull();
  });
});

describe("readCoordinates", () => {
  it("lee latitud y longitud numéricas", () => {
    expect(
      readCoordinates({ latitude: "-12.05822397", longitude: "-75.22198095" }),
    ).toEqual({ latitude: -12.05822397, longitude: -75.22198095 });
  });

  it("descarta el 0,0 con que la base marca la ausencia de ubicación", () => {
    expect(readCoordinates({ latitude: "0", longitude: "0" })).toBeNull();
  });

  it("descarta valores no numéricos", () => {
    expect(readCoordinates({ latitude: "X:-75.2", longitude: "" })).toBeNull();
    expect(readCoordinates({})).toBeNull();
  });
});

describe("mapas", () => {
  const coordinates = { latitude: -12.05822397, longitude: -75.22198095 };

  it("el enlace externo apunta a Google Maps con las coordenadas", () => {
    expect(buildMapsUrl(coordinates)).toBe(
      "https://maps.google.com/?q=-12.05822397,-75.22198095",
    );
    expect(buildMapsUrl(null)).toBeNull();
  });

  it("el embebido de OpenStreetMap encuadra y marca el punto, sin clave", () => {
    const url = buildOsmEmbedUrl(coordinates);
    expect(url).not.toBeNull();
    const parsed = new URL(url as string);
    expect(parsed.origin).toBe("https://www.openstreetmap.org");
    expect(parsed.pathname).toBe("/export/embed.html");
    expect(parsed.searchParams.get("marker")).toBe("-12.058224,-75.221981");
    expect(parsed.searchParams.get("layer")).toBe("mapnik");
    expect(parsed.searchParams.get("bbox")).toBe(
      "-75.225981,-12.062224,-75.217981,-12.054224",
    );
    expect(parsed.searchParams.has("key")).toBe(false);
  });

  it("sin coordenadas no hay mapa embebido", () => {
    expect(buildOsmEmbedUrl(null)).toBeNull();
  });
});
