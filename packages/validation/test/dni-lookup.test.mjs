import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateAgeFromPeruvianDate,
  normalizeDniLookupInput,
  parseDniLookupApiResponse,
  resolveDniCreditIndicator,
} from "../dist/dni-lookup.js";

const result = {
  nuDni: "01234567",
  digitoVerificacion: 4,
  preNombres: "ANA MARIA",
  apePaterno: "PEREZ",
  apeMaterno: "DIAZ",
  sexo: "FEMENINO",
  feNacimiento: "30/08/2000",
  estatura: "165 cm",
  desDireccion: "AV. DEMO 123",
  ubicacion: {
    ubigeo_reniec: "140101",
    ubigeo_inei: "150101",
    ubigeo_sunat: "150101",
    codigo_postal: "15001",
  },
};

describe("normalizeDniLookupInput", () => {
  it("accepts eight digits and the legacy verification suffix", () => {
    assert.equal(normalizeDniLookupInput("01234567"), "01234567");
    assert.equal(normalizeDniLookupInput(" 01234567 - 4 "), "01234567");
  });

  it("rejects incomplete or non-numeric documents", () => {
    assert.equal(normalizeDniLookupInput("1234567"), null);
    assert.equal(normalizeDniLookupInput("1234A678"), null);
  });
});

describe("parseDniLookupApiResponse", () => {
  it("maps the complete response used by the commercial UI", () => {
    const parsed = parseDniLookupApiResponse(
      { message: "found data", result, credits: 9 },
      "01234567",
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.credits, "9");
    assert.equal(parsed.person.verificationDigit, "4");
    assert.equal(parsed.person.heightCm, 165);
    assert.equal(parsed.person.ineiUbigeo, "150101");
    assert.equal(parsed.person.addressDescription, "AV. DEMO 123");
  });

  it("does not accept a response for a different identity", () => {
    assert.deepEqual(
      parseDniLookupApiResponse(
        { message: "found data", result: { ...result, nuDni: "76543210" } },
        "01234567",
      ),
      { ok: false, reason: "INVALID_RESPONSE" },
    );
  });

  it("distinguishes not found from a malformed success", () => {
    assert.deepEqual(
      parseDniLookupApiResponse({ message: "not found" }, "01234567"),
      { ok: false, reason: "NOT_FOUND" },
    );
    assert.deepEqual(
      parseDniLookupApiResponse({ message: "found data" }, "01234567"),
      { ok: false, reason: "INVALID_RESPONSE" },
    );
  });
});

describe("calculateAgeFromPeruvianDate", () => {
  it("calculates the age without depending on the server timezone", () => {
    assert.equal(
      calculateAgeFromPeruvianDate(
        "30/08/2000",
        new Date("2026-08-29T12:00:00.000Z"),
      ),
      25,
    );
    assert.equal(
      calculateAgeFromPeruvianDate(
        "30/08/2000",
        new Date("2026-08-30T12:00:00.000Z"),
      ),
      26,
    );
  });

  it("rejects impossible dates", () => {
    assert.equal(calculateAgeFromPeruvianDate("31/02/2000"), null);
  });
});

describe("resolveDniCreditIndicator", () => {
  it("alerts in red below 100 credits", () => {
    assert.deepEqual(resolveDniCreditIndicator("99"), {
      balance: 99,
      tone: "danger",
      label: "Recarga necesaria",
    });
  });

  it("uses warning from 100 to 199 and green from 200", () => {
    assert.equal(resolveDniCreditIndicator(100).tone, "warning");
    assert.equal(resolveDniCreditIndicator(199).tone, "warning");
    assert.equal(resolveDniCreditIndicator(200).tone, "success");
  });

  it("does not invent a balance when the provider omitted it", () => {
    assert.deepEqual(resolveDniCreditIndicator(null), {
      balance: null,
      tone: "neutral",
      label: "Saldo no disponible",
    });
  });
});
