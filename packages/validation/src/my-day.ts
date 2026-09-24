import { getLimaIsoDate } from "./order-period.js";
import type { InternalRecoveryDue } from "./recovery-internal-due.js";

/**
 * «Mi día» — SPEC-063. Una sola lista de trabajo del asesor.
 *
 * Esta regla no decide cuándo algo vence: eso lo decide la regla de cada
 * módulo (agenda, recupero de ventas, pedidos, campaña) y llega aquí ya
 * resuelto (BR-002). Lo único propio de «Mi día» es **dónde** va cada cosa:
 * en qué tramo de urgencia (BR-005) y si toca ahora o más tarde hoy (BR-006).
 */

/** BR-005: tramos de urgencia, en el orden en que se muestran. */
export type MyDayTier =
  | "cita_vencida"
  | "venta_en_riesgo"
  | "cita_pronto"
  | "pedido"
  | "seguimiento_vencido"
  | "campana";

export const myDayTierOrder: readonly MyDayTier[] = [
  "cita_vencida",
  "venta_en_riesgo",
  "cita_pronto",
  "pedido",
  "seguimiento_vencido",
  "campana",
];

export const myDayTierLabels: Record<MyDayTier, string> = {
  cita_vencida: "Citas que ya pasaron",
  venta_en_riesgo: "Ventas caídas por salvar",
  cita_pronto: "Citas de las próximas 2 horas",
  pedido: "Pedidos que te necesitan",
  seguimiento_vencido: "Seguimientos vencidos",
  campana: "Campaña",
};

/** «Ahora» es lo que toca ya; «hoy», lo que vence más tarde en el día. */
export type MyDayBucket = "ahora" | "hoy";

/** BR-005: una cita cuenta como «pronto» dentro de las próximas 2 horas. */
export const myDaySoonMs = 2 * 60 * 60 * 1000;

export interface MyDayPlacement {
  tier: MyDayTier;
  bucket: MyDayBucket;
  /** Cuándo vence o venció; `null` cuando el módulo no fija hora. */
  dueAt: Date | null;
}

function isSameLimaDay(left: Date, right: Date): boolean {
  return getLimaIsoDate(left) === getLimaIsoDate(right);
}

/**
 * Una cita acordada con el cliente (SPEC-048). Pasada, es el tramo más
 * urgente: el asesor se comprometió. En las próximas 2 horas, va en «ahora»;
 * más tarde hoy, en el bloque plegado; otro día, no es de hoy.
 */
export function placeMyDayCommitment(
  scheduledAt: Date,
  now: Date,
): MyDayPlacement | null {
  const at = scheduledAt.getTime();
  const current = now.getTime();

  if (at < current) {
    return { tier: "cita_vencida", bucket: "ahora", dueAt: scheduledAt };
  }

  if (at <= current + myDaySoonMs) {
    return { tier: "cita_pronto", bucket: "ahora", dueAt: scheduledAt };
  }

  return isSameLimaDay(scheduledAt, now)
    ? { tier: "cita_pronto", bucket: "hoy", dueAt: scheduledAt }
    : null;
}

export interface MyDaySalesRecoveryInput {
  status: string;
  firstContactAt: Date | null;
  nextActionAt: Date | null;
  /** Límite del primer contacto: 2 horas desde la caída (SPEC-026). */
  firstActionAt: Date;
  /** Lo que venció según `classifyInternalRecoveryDue`. */
  due: InternalRecoveryDue | null;
}

/**
 * Una venta caída a cargo del asesor (SPEC-030 fase 5). Sin primer contacto
 * es «venta en riesgo» desde que entra, venza o no: el plazo de 2 horas es
 * justamente lo que hay que ganar. Con contacto, solo sube a «ahora» cuando
 * su seguimiento o su agenda vencieron; si vence más tarde hoy, va al bloque
 * plegado. En verificación no hay nada que hacer.
 */
export function placeMyDaySalesRecovery(
  input: MyDaySalesRecoveryInput,
  now: Date,
): MyDayPlacement | null {
  if (input.status === "WAITING") return null;

  if (input.firstContactAt === null && input.status !== "SCHEDULED") {
    return {
      tier: "venta_en_riesgo",
      bucket: "ahora",
      dueAt: input.firstActionAt,
    };
  }

  if (input.due !== null) {
    return {
      tier: "seguimiento_vencido",
      bucket: "ahora",
      dueAt: input.nextActionAt,
    };
  }

  return input.nextActionAt !== null && isSameLimaDay(input.nextActionAt, now)
    ? { tier: "seguimiento_vencido", bucket: "hoy", dueAt: input.nextActionAt }
    : null;
}

export interface MyDaySortable {
  tier: MyDayTier;
  dueAt: Date | null;
  /** Orden que ya trae el módulo de origen, para desempatar sin fecha. */
  rank: number;
}

/**
 * BR-005: por tramo; dentro del tramo, lo que vence antes; sin fecha, al final
 * del tramo y en el orden de su módulo.
 */
export function compareMyDayItems(
  left: MyDaySortable,
  right: MyDaySortable,
): number {
  const tier =
    myDayTierOrder.indexOf(left.tier) - myDayTierOrder.indexOf(right.tier);
  if (tier !== 0) return tier;

  if (left.dueAt && right.dueAt) {
    const due = left.dueAt.getTime() - right.dueAt.getTime();
    if (due !== 0) return due;
  } else if (left.dueAt) {
    return -1;
  } else if (right.dueAt) {
    return 1;
  }

  return left.rank - right.rank;
}

const limaTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «22/09»: `es-PE` escribe «22/9» aunque se pida el mes en dos dígitos. */
const limaDayFormatter = {
  format(value: Date): string {
    const [, month, day] = getLimaIsoDate(value).split("-");
    return `${day}/${month}`;
  },
};

/**
 * BR-007: el plazo en palabras del asesor. Lo vencido dice hace cuánto; lo
 * próximo, en cuánto; lo de más tarde, a qué hora.
 */
export function describeMyDayDue(dueAt: Date, now: Date): string {
  const minutes = Math.round((dueAt.getTime() - now.getTime()) / 60_000);

  if (minutes < 0) {
    const ago = -minutes;
    if (ago < 60) return `venció hace ${Math.max(ago, 1)} min`;
    if (ago < 24 * 60) return `venció hace ${Math.floor(ago / 60)} h`;
    return `vencida desde el ${limaDayFormatter.format(dueAt)}`;
  }

  if (minutes < 60) return `en ${Math.max(minutes, 1)} min`;

  return isSameLimaDay(dueAt, now)
    ? `a las ${limaTimeFormatter.format(dueAt)}`
    : `el ${limaDayFormatter.format(dueAt)} a las ${limaTimeFormatter.format(dueAt)}`;
}
