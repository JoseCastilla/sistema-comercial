import type { MyDayBucket, MyDayTier } from "@repo/validation";

/**
 * Tipos y rótulos de «Mi día» compartidos entre el servidor y la lista del
 * navegador. Viven aparte de `get-my-day.ts` porque ese módulo es solo de
 * servidor.
 */

export type MyDayEntryKind = "cita" | "venta_caida" | "pedido" | "campana";

export const myDayKindLabels: Record<MyDayEntryKind, string> = {
  cita: "Cita acordada",
  venta_caida: "Venta caída",
  pedido: "Pedido",
  campana: "Campaña",
};

/**
 * Lo que el editor de gestión necesita para registrar un intento desde la
 * fila (SPEC-063 fase 2). Solo lo tienen los casos: un pedido se resuelve
 * en Pedidos.
 */
export interface MyDayManage {
  caseId: string;
  /** Teléfonos de contacto primero, luego las líneas; sin repetir. */
  phoneOptions: string[];
  defaultPhone: string | null;
  serviceNumbers: string[];
  lastResult: string | null;
  lastObservation: string | null;
}

export interface MyDayEntry {
  key: string;
  kind: MyDayEntryKind;
  tier: MyDayTier;
  bucket: MyDayBucket;
  dueAt: Date | null;
  /** Cuándo se hizo la venta, si el elemento viene de una (BR-018). */
  saleAt: Date | null;
  /** «venció hace 25 min», «en 40 min», «a las 15:00». */
  dueLabel: string | null;
  overdue: boolean;
  rank: number;
  /** El cliente. */
  title: string;
  /** Qué hacer, en una frase (BR-007). */
  action: string;
  detail: string | null;
  href: string;
  actionLabel: string;
  manage: MyDayManage | null;
}
