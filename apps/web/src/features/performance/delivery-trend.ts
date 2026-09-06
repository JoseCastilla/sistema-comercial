/**
 * SPEC-047 BR-009: entregas registradas por día dentro del mes elegido, de
 * cualquier mes de venta. Es una lectura de actividad operativa, aparte de la
 * cohorte por fecha de ingreso que rige los indicadores: una venta ingresada
 * el 31/08 y entregada el 02/09 cuenta en la cohorte de agosto y aquí, en el
 * día 2 de setiembre. `deliveredAt` es la fecha en que la plataforma registró
 * la entrega (acción de estado o consulta a Máximo), y así se declara.
 */
export interface DeliveryTrendDay {
  key: string;
  day: number;
  label: string;
  delivered: number;
  cumulative: number;
  /** Entregas del día cuya venta se ingresó antes del mes elegido. */
  fromEarlierMonths: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface DeliveryTrend {
  days: DeliveryTrendDay[];
  total: number;
  fromEarlierMonths: number;
  elapsedDays: number;
  productiveDays: number;
  averagePerElapsedDay: number;
  bestDay: DeliveryTrendDay | null;
}

export interface DeliveryTrendOrder {
  deliveryStatus: string;
  deliveredAt: Date | null;
  registeredAt: Date;
}

const limaDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dailyLabelFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "short",
  day: "numeric",
});

const dayLength = 24 * 60 * 60 * 1000;

export function buildDeliveryTrend(
  orders: readonly DeliveryTrendOrder[],
  start: Date,
  end: Date,
  now: Date,
): DeliveryTrend {
  const todayKey = limaDateKeyFormatter.format(now);
  const counts = new Map<string, { delivered: number; earlier: number }>();

  for (const order of orders) {
    if (order.deliveryStatus !== "DELIVERED" || !order.deliveredAt) continue;
    const instant = order.deliveredAt.getTime();
    if (instant < start.getTime() || instant >= end.getTime()) continue;
    const key = limaDateKeyFormatter.format(order.deliveredAt);
    const entry = counts.get(key) ?? { delivered: 0, earlier: 0 };
    entry.delivered += 1;
    if (order.registeredAt.getTime() < start.getTime()) entry.earlier += 1;
    counts.set(key, entry);
  }

  let cumulative = 0;
  const days: DeliveryTrendDay[] = [];
  for (
    let instant = start.getTime();
    instant < end.getTime();
    instant += dayLength
  ) {
    const date = new Date(instant);
    const key = limaDateKeyFormatter.format(date);
    const entry = counts.get(key) ?? { delivered: 0, earlier: 0 };
    cumulative += entry.delivered;
    days.push({
      key,
      day: Number(key.slice(-2)),
      label: dailyLabelFormatter.format(date).replace(".", ""),
      delivered: entry.delivered,
      cumulative,
      fromEarlierMonths: entry.earlier,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    });
  }

  const elapsed = days.filter((day) => !day.isFuture);
  const productive = elapsed.filter((day) => day.delivered > 0);
  const bestDay =
    [...productive].sort(
      (left, right) => right.delivered - left.delivered || left.day - right.day,
    )[0] ?? null;

  return {
    days,
    total: cumulative,
    fromEarlierMonths: days.reduce(
      (total, day) => total + day.fromEarlierMonths,
      0,
    ),
    elapsedDays: elapsed.length,
    productiveDays: productive.length,
    averagePerElapsedDay: elapsed.length > 0 ? cumulative / elapsed.length : 0,
    bestDay,
  };
}
