/**
 * Lectura del resumen de contacto que la base nacional deja como JSON.
 *
 * La ficha del caso ya componía la dirección y las coordenadas a mano; la cola
 * necesita lo mismo para abrir los datos sin salir de ella. Vive acá para que
 * una dirección se arme igual en las dos pantallas.
 */
export type ContactSummary = Record<string, string | undefined>;

export function readContactSummary(value: unknown): ContactSummary {
  return (value ?? {}) as ContactSummary;
}

/** Vía, número, complejo, manzana y lote, en el orden en que se dictan. */
export function composeAddress(summary: ContactSummary): string | null {
  const parts = [
    [summary.streetType, summary.streetName, summary.streetNumber]
      .filter(Boolean)
      .join(" "),
    [summary.housingType, summary.housingName].filter(Boolean).join(" "),
    summary.block ? `Mz. ${summary.block}` : "",
    summary.lot ? `Lote ${summary.lot}` : "",
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * La base trae 0,0 cuando no hay ubicación, que apunta al golfo de Guinea: se
 * descarta junto con cualquier valor no numérico.
 */
export function readCoordinates(summary: ContactSummary): Coordinates | null {
  const latitude = Number(summary.latitude);
  const longitude = Number(summary.longitude);

  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0);

  return valid ? { latitude, longitude } : null;
}

export function buildMapsUrl(coordinates: Coordinates | null): string | null {
  return coordinates
    ? `https://maps.google.com/?q=${coordinates.latitude},${coordinates.longitude}`
    : null;
}

/**
 * Mapa embebido de OpenStreetMap: no necesita clave ni cuenta. Se usa solo en
 * la ficha completa —un caso por vez, abierto a propósito—; en la cola queda
 * el enlace, porque diez filas desplegadas cargarían diez mapas y enviarían
 * las coordenadas de diez clientes a un tercero sin que nadie lo pidiera.
 */
export function buildOsmEmbedUrl(
  coordinates: Coordinates | null,
): string | null {
  if (!coordinates) return null;

  const { latitude, longitude } = coordinates;
  const delta = 0.004;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ]
    .map((value) => value.toFixed(6))
    .join(",");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}
