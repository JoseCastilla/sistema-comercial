import {
  describeMyDayDue,
  formatMyDayTime,
  placeMyDaySalesRecovery,
  type MyDayPlacement,
} from "./my-day.js";
import { classifyInternalRecoveryDue } from "./recovery-internal-due.js";
import { getInternalRecoveryFirstActionAt } from "./recovery-internal-gate.js";

/**
 * Cómo se dice una venta caída al asesor — SPEC-063 y SPEC-067. «Mi día» y la
 * ficha del caso muestran la misma venta: con esta regla dicen lo mismo.
 */
export interface SalesRecoveryWorkInput {
  status: string;
  /** Cuándo se hizo la venta: decide si es caliente o fría. */
  saleAt: Date;
  firstContactAt: Date | null;
  nextActionAt: Date | null;
  /** Cuándo se cayó (la novedad): de ahí corren las dos horas. */
  noveltyAt: Date;
}

export interface SalesRecoveryWork {
  placement: MyDayPlacement;
  /** Lo frío no se pinta ni cuenta minutos: no debe hacer ruido. */
  cold: boolean;
  due: { label: string; tone: "danger" | "warning" | "neutral" } | null;
  action: string;
}

/**
 * Qué hacer con una venta caída que toca hoy, o `null` si hoy no toca (en
 * verificación, o su seguimiento es otro día). La etiqueta dice el plazo;
 * la frase dice qué hacer, sin repetirlo.
 */
export function describeSalesRecoveryWork(
  input: SalesRecoveryWorkInput,
  now: Date,
): SalesRecoveryWork | null {
  const due = classifyInternalRecoveryDue(
    {
      status: input.status,
      firstContactAt: input.firstContactAt,
      nextActionAt: input.nextActionAt,
      noveltyAt: input.noveltyAt,
    },
    now,
  );
  const placement = placeMyDaySalesRecovery(
    {
      status: input.status,
      saleAt: input.saleAt,
      firstContactAt: input.firstContactAt,
      nextActionAt: input.nextActionAt,
      firstActionAt: getInternalRecoveryFirstActionAt(input.noveltyAt),
      due,
    },
    now,
  );
  if (!placement) return null;

  const cold = placement.bucket === "frio";
  const overdue = due !== null;
  const neverCalled = input.firstContactAt === null;

  return {
    placement,
    cold,
    due:
      !cold && placement.dueAt
        ? {
            label: describeMyDayDue(placement.dueAt, now),
            tone: overdue ? "danger" : "warning",
          }
        : null,
    action: cold
      ? neverCalled
        ? "Sin llamar"
        : "Seguimiento pendiente"
      : neverCalled
        ? overdue || !placement.dueAt
          ? "Llamar ya"
          : `Llamar antes de las ${formatMyDayTime(placement.dueAt)}`
        : "Volver a llamar",
  };
}
