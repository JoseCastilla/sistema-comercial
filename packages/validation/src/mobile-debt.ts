export const mobileDebtOperators = ["CLARO", "ENTEL", "BITEL"] as const;

export type MobileDebtOperator = (typeof mobileDebtOperators)[number];

export interface MobileDebtResult {
  operator: MobileDebtOperator;
  phone: string;
  customerName: string | null;
  debtAmount: number;
  dueDateRaw: string | null;
  queriedAtRaw: string | null;
}

export type MobileDebtParseResult =
  | { ok: true; result: MobileDebtResult }
  | { ok: false; reason: "REJECTED" | "INVALID_RESPONSE" };

const operatorSettings: Record<
  MobileDebtOperator,
  { carrierCode: string; label: string; maxlength: number; type: string }
> = {
  CLARO: {
    carrierCode: "RCFM",
    label: "Ingrese número a pagar",
    maxlength: 16,
    type: "string",
  },
  ENTEL: {
    carrierCode: "RENUM",
    label: "Celular a pagar",
    maxlength: 9,
    type: "number_mandatory",
  },
  BITEL: {
    carrierCode: "RBNUM",
    label: "Celular a pagar",
    maxlength: 9,
    type: "number_mandatory",
  },
};

export function normalizeMobileDebtPhone(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const phone = String(value).trim();
  return /^9\d{8}$/.test(phone) ? phone : null;
}

export function parseMobileDebtOperator(
  value: unknown,
): MobileDebtOperator | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return (
    mobileDebtOperators.find((operator) => operator === normalized) ?? null
  );
}

export function buildMobileDebtRequest(
  operator: MobileDebtOperator,
  phone: string,
): { carrierCode: string; reqData: string } {
  const settings = operatorSettings[operator];
  return {
    carrierCode: settings.carrierCode,
    reqData: JSON.stringify({
      inputs: [
        {
          field: "carrierCode",
          type: "string",
          value: settings.carrierCode,
          isExtended: false,
        },
        {
          field: "messageType",
          type: "number",
          value: 10,
          isExtended: false,
        },
        {
          label: settings.label,
          maxlength: settings.maxlength,
          value: phone,
          field: "destinationPhone",
          type: settings.type,
          isExtended: false,
        },
      ],
    }),
  };
}

/**
 * Reduce las respuestas variables de Red Digital a los cuatro datos que usa
 * la operacion. No conserva nombres, documentos ni identificadores internos.
 */
export function parseMobileDebtResponse(
  value: unknown,
  operator: MobileDebtOperator,
  requestedPhone: string,
): MobileDebtParseResult {
  if (!isRecord(value)) return { ok: false, reason: "INVALID_RESPONSE" };
  if (value.status !== true || readNumber(value.rcode) !== 0) {
    return { ok: false, reason: "REJECTED" };
  }

  const response = isRecord(value.rmi_resp) ? value.rmi_resp : null;
  const attributes =
    response && isRecord(response.extendedAttributes)
      ? response.extendedAttributes
      : null;
  if (!response || !attributes) {
    return { ok: false, reason: "INVALID_RESPONSE" };
  }

  const settings = operatorSettings[operator];
  const phone = normalizeMobileDebtPhone(response.destinationPhone);
  if (
    response.carrierCode !== settings.carrierCode ||
    phone !== requestedPhone
  ) {
    return { ok: false, reason: "INVALID_RESPONSE" };
  }

  const debtAmount =
    operator === "CLARO"
      ? firstMoney(
          attributes["monto-web"],
          attributes.monto,
          attributes.importeSaldoDeuda,
        )
      : firstMoney(
          attributes["mnt-deuda"],
          attributes.newDestinationBalance_str,
        );
  if (debtAmount === null) {
    return { ok: false, reason: "INVALID_RESPONSE" };
  }

  const dueDateRaw =
    operator === "CLARO"
      ? firstString(
          attributes["fecha-deuda-web"],
          attributes["fecha-deuda"],
          attributes["fecha-deuda-ussd"],
        )
      : firstString(attributes.fecha_vence_str, attributes.fecha_vence);
  const customerName =
    operator === "CLARO"
      ? firstCustomerName(
          attributes["nombre-deudor-web"],
          attributes["nombre-deudor"],
          attributes["nombre-deudor-ussd"],
        )
      : operator === "ENTEL"
        ? firstCustomerName(
            attributes.nombre_deudor,
            attributes.nombre_deudor_12,
          )
        : null;
  return {
    ok: true,
    result: {
      operator,
      phone,
      customerName,
      debtAmount,
      dueDateRaw,
      queriedAtRaw: firstString(attributes.date_str),
    },
  };
}

export function parsePeruvianMoney(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundMoney(value) : null;
  }
  if (typeof value !== "string") return null;

  let normalized = value.trim().replace(/[^\d,.-]/g, "");
  if (!normalized) return null;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalSeparator =
    lastComma > lastDot ? "," : lastDot >= 0 ? "." : null;
  if (decimalSeparator) {
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.replaceAll(thousandsSeparator, "");
    normalized = normalized.replace(decimalSeparator, ".");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function firstMoney(...values: unknown[]): number | null {
  for (const value of values) {
    const amount = parsePeruvianMoney(value);
    if (amount !== null) return amount;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function firstCustomerName(...values: unknown[]): string | null {
  return firstString(...values)?.slice(0, 200) ?? null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
