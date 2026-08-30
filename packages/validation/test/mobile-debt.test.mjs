import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMobileDebtRequest,
  normalizeMobileDebtPhone,
  parseMobileDebtResponse,
  parsePeruvianMoney,
} from "../dist/mobile-debt.js";

const baseResponse = (carrierCode, phone, extendedAttributes) => ({
  status: true,
  rcode: 0,
  rmi_resp: { carrierCode, destinationPhone: phone, extendedAttributes },
});

describe("mobile debt input", () => {
  it("accepts only Peruvian mobile numbers", () => {
    assert.equal(normalizeMobileDebtPhone(" 912345678 "), "912345678");
    assert.equal(normalizeMobileDebtPhone("812345678"), null);
    assert.equal(normalizeMobileDebtPhone("91234567"), null);
  });

  it("builds the provider contract for each operator", () => {
    const claro = buildMobileDebtRequest("CLARO", "912345678");
    const entel = buildMobileDebtRequest("ENTEL", "923456789");
    assert.equal(claro.carrierCode, "RCFM");
    assert.equal(JSON.parse(claro.reqData).inputs[2].type, "string");
    assert.equal(entel.carrierCode, "RENUM");
    assert.equal(JSON.parse(entel.reqData).inputs[2].type, "number_mandatory");
  });
});

describe("parsePeruvianMoney", () => {
  it("supports formatted strings and numeric provider values", () => {
    assert.equal(parsePeruvianMoney("S/ 1.234,56"), 1234.56);
    assert.equal(parsePeruvianMoney("S/ 29,90"), 29.9);
    assert.equal(parsePeruvianMoney(34.95), 34.95);
  });
});

describe("parseMobileDebtResponse", () => {
  it("normalizes Claro without exposing debtor data", () => {
    const parsed = parseMobileDebtResponse(
      baseResponse("RCFM", "912345678", {
        "monto-web": "S/ 29,90",
        "comision-web": "S/ 1,00",
        "total-web": "S/ 30,90",
        "fecha-deuda-web": "03/09/2026",
        "nombre-deudor-web": "CLIENTE MASCARADO",
      }),
      "CLARO",
      "912345678",
    );
    assert.deepEqual(parsed, {
      ok: true,
      result: {
        operator: "CLARO",
        phone: "912345678",
        customerName: "CLIENTE MASCARADO",
        debtAmount: 29.9,
        dueDateRaw: "03/09/2026",
        queriedAtRaw: null,
      },
    });
  });

  it("normalizes Entel and Bitel field variants", () => {
    const entel = parseMobileDebtResponse(
      baseResponse("RENUM", "923456789", {
        "mnt-deuda": "S/ 261,86",
        "comm-recaudo": "S/ 1,00",
        "tot-recaudo": "S/ 262,86",
        fecha_vence_str: "2026-09-05",
        nombre_deudor: "CLIENTE DE PRUEBA",
      }),
      "ENTEL",
      "923456789",
    );
    const bitel = parseMobileDebtResponse(
      baseResponse("RBNUM", "934567891", {
        "mnt-deuda": 34.95,
        "comm-recaudo": 1,
        "tot-recaudo": "35.95",
        fecha_vence: "06/2026",
      }),
      "BITEL",
      "934567891",
    );
    assert.equal(entel.ok && entel.result.dueDateRaw, "2026-09-05");
    assert.equal(entel.ok && entel.result.customerName, "CLIENTE DE PRUEBA");
    assert.equal(bitel.ok && bitel.result.debtAmount, 34.95);
    assert.equal(bitel.ok && bitel.result.customerName, null);
  });

  it("rejects mismatched phone or carrier responses", () => {
    assert.deepEqual(
      parseMobileDebtResponse(
        baseResponse("RENUM", "945678912", { "mnt-deuda": 10 }),
        "ENTEL",
        "956789123",
      ),
      { ok: false, reason: "INVALID_RESPONSE" },
    );
  });
});
