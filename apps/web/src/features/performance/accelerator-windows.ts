import type { PerformanceAcceleratorWindow } from "@repo/validation";

export type AcceleratorWindowState = "ACTIVE" | "UPCOMING" | "CLOSED";

export interface AcceleratorWindowView {
  key: "ONE" | "TWO";
  label: string;
  startDay: number;
  endDay: number;
  state: AcceleratorWindowState;
}

/**
 * SPEC-044 ASE-02: cada ventana del acelerador se presenta según el día de
 * hoy —en curso, por comenzar o cerrada—, para no mostrar un objetivo futuro
 * como un atraso. En un mes ya cerrado todas las ventanas están cerradas.
 * Los días que no caen en ninguna ventana (16 al 24 con la política vigente)
 * no son elegibles para bono (SPEC-038 BR-002).
 */
export function describeAcceleratorWindows(
  windows: readonly PerformanceAcceleratorWindow[],
  todayDay: number | null,
  lastDayOfMonth: number,
): AcceleratorWindowView[] {
  return windows.map((window) => {
    const endDay = window.windowEndDay ?? lastDayOfMonth;
    const state: AcceleratorWindowState =
      todayDay === null || todayDay > endDay
        ? "CLOSED"
        : todayDay < window.windowStartDay
          ? "UPCOMING"
          : "ACTIVE";

    return {
      key: window.key,
      label: window.label,
      startDay: window.windowStartDay,
      endDay,
      state,
    };
  });
}

/** Los días de hoy no entran en ningún bono: se dice, en vez de callarlo. */
export function isOutsideAcceleratorWindows(
  windows: readonly AcceleratorWindowView[],
  todayDay: number | null,
): boolean {
  if (todayDay === null) return false;
  return !windows.some(
    (window) => todayDay >= window.startDay && todayDay <= window.endDay,
  );
}

/**
 * ASE-03: el consejo del día sale de los pendientes reales, no de una frase
 * fija. Con cero por activar no se pide activar; con pedidos por recuperar se
 * ofrece revisarlos sin prometer que todos se recuperen.
 */
export function describePendingAdvice(input: {
  enteredToday: number;
  deliveredPendingActivation: number;
  recovery: number;
  openRecoveryCases: number;
}): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  if (input.deliveredPendingActivation > 0) {
    parts.push(
      `${plural(input.deliveredPendingActivation, "venta entregada espera", "ventas entregadas esperan")} activarse: todavía no pagan.`,
    );
  }
  if (input.recovery > 0) {
    parts.push(
      `${plural(input.recovery, "pedido del mes no se entregó o se canceló", "pedidos del mes no se entregaron o se cancelaron")}: revísalos por si alguno se puede reingresar.`,
    );
  }
  if (input.openRecoveryCases > 0) {
    parts.push(
      `${plural(input.openRecoveryCases, "caso abierto", "casos abiertos")} en Recupero de ventas con cadencia por cumplir.`,
    );
  }

  if (parts.length === 0) {
    return input.enteredToday > 0
      ? "Sin pendientes del mes: todo lo entregado ya cerró."
      : "Aún no registras ventas hoy y no tienes pendientes del mes.";
  }

  return parts.join(" ");
}
