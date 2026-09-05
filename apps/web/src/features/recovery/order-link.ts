/**
 * Enlace desde recupero hacia la venta de origen — SPEC-030 BR-095 (NAV-01).
 *
 * La bandeja de ventas abre por defecto el mes en curso. Una venta caída hace
 * dos meses no aparecía al seguir el enlace: el asesor llegaba a una lista
 * vacía y tenía que adivinar el período. Si conocemos el día en que se registró
 * la venta, pedimos exactamente ese día; si no, dejamos el comportamiento
 * anterior.
 */
export function buildOrderHref(
  orderCode: string,
  /** Día de Lima en que se registró la venta, `YYYY-MM-DD`; `null` si no se sabe. */
  registeredDay: string | null,
): string {
  const parameters = new URLSearchParams({ status: "ALL", q: orderCode });

  if (registeredDay) {
    parameters.set("period", "RANGE");
    parameters.set("from", registeredDay);
    parameters.set("to", registeredDay);
  }

  return `/orders?${parameters.toString()}`;
}
