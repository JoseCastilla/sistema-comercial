/**
 * SPEC-048 BR-001 — la hora que escribe el asesor es hora de Lima, siempre.
 *
 * Un campo `datetime-local` emite `AAAA-MM-DDTHH:mm` sin zona, y
 * `new Date(texto)` interpreta esa cadena en la zona **del proceso**: en un
 * contenedor que corre en UTC, una cita acordada a las 10:00 de Lima quedaba
 * guardada a las 05:00 de Lima. En el equipo de desarrollo, con zona de
 * Lima, el mismo código funcionaba, por eso no se vio.
 *
 * La operación es de Lima (-05:00 todo el año, sin horario de verano), así
 * que la zona se fija aquí y el resultado no depende de dónde corra el
 * servidor ni del navegador. Si el texto ya trae zona («Z» o «±HH:mm») se
 * respeta: es un instante sin ambigüedad.
 */
const limaOffsetHours = 5;

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const zonedDateTimePattern = /(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseLimaDateTimeLocal(raw: string): Date | null {
  const text = raw.trim();

  if (zonedDateTimePattern.test(text)) {
    const zoned = new Date(text);
    return Number.isNaN(zoned.getTime()) ? null : zoned;
  }

  const match = localDateTimePattern.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  const instant = Date.UTC(
    year,
    month - 1,
    day,
    hour + limaOffsetHours,
    minute,
    second,
  );

  // Un 31/02 o un 25:00 «desbordan» al reconstruir la fecha: se rechazan en
  // vez de aceptar un día distinto del que el asesor escribió.
  const lima = new Date(instant - limaOffsetHours * 60 * 60 * 1000);
  if (
    lima.getUTCFullYear() !== year ||
    lima.getUTCMonth() !== month - 1 ||
    lima.getUTCDate() !== day ||
    lima.getUTCHours() !== hour ||
    lima.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return new Date(instant);
}
