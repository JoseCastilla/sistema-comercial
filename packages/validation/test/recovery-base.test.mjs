import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultRecoveryEligibilityConfig,
  evaluateRecoveryEligibility,
  groupRecoveryRecordsByClient,
  normalizeRecoveryDocumentNumber,
  normalizeRecoveryPhoneNumber,
  normalizeRecoveryServiceNumber,
} from "../dist/recovery-base.js";

describe("normalizeRecoveryDocumentNumber", () => {
  it("pads short DNIs to eight digits like the consolidation script", () => {
    assert.equal(normalizeRecoveryDocumentNumber(5245525), "05245525");
    assert.equal(normalizeRecoveryDocumentNumber("05245525"), "05245525");
  });

  it("strips pandas float artifacts", () => {
    assert.equal(normalizeRecoveryDocumentNumber("5245525.0"), "05245525");
  });

  it("rejects empty and non numeric values", () => {
    assert.equal(normalizeRecoveryDocumentNumber(""), null);
    assert.equal(normalizeRecoveryDocumentNumber("SIN DATO"), null);
    assert.equal(normalizeRecoveryDocumentNumber(null), null);
  });
});

describe("normalizeRecoveryPhoneNumber", () => {
  it("keeps nine digit mobiles as they are", () => {
    assert.equal(normalizeRecoveryPhoneNumber("958097735"), "958097735");
  });

  it("removes the 51 country prefix", () => {
    assert.equal(normalizeRecoveryPhoneNumber("51958097735"), "958097735");
    assert.equal(normalizeRecoveryPhoneNumber("+51 958 097 735"), "958097735");
  });

  it("rejects empty values", () => {
    assert.equal(normalizeRecoveryPhoneNumber(""), null);
    assert.equal(normalizeRecoveryPhoneNumber(undefined), null);
  });
});

describe("evaluateRecoveryEligibility", () => {
  const eligibleRow = {
    documentNumber: "73458768",
    serviceNumber: "930557541",
    registeredAt: new Date("2026-08-25T14:00:00.000Z"),
    modalityRaw: "POST",
    planRaw: "Abierto Movistar Libre Plan Movistar Maximo S/39.9",
    equipmentRaw: "Simcard",
    carrierRaw: "BITEL",
  };

  it("accepts the base row of the reference file", () => {
    const result = evaluateRecoveryEligibility(
      eligibleRow,
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "ELIGIBLE");
    assert.deepEqual(result.issueCodes, []);
  });

  it("treats Guinea Mobile code 27 as a valid carrier (BR-015)", () => {
    const result = evaluateRecoveryEligibility(
      { ...eligibleRow, carrierRaw: "27" },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "ELIGIBLE");
  });

  it("excludes prepaid rows even with an eligible plan (BR-012)", () => {
    const result = evaluateRecoveryEligibility(
      { ...eligibleRow, modalityRaw: "PREP" },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "EXCLUDED");
    assert.deepEqual(result.issueCodes, ["MODALITY_NOT_ALLOWED"]);
  });

  it("excludes plans outside the configured range", () => {
    const result = evaluateRecoveryEligibility(
      {
        ...eligibleRow,
        planRaw: "Control Movistar Libre Plan Movistar Maximo S/29.9",
      },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "EXCLUDED");
    assert.deepEqual(result.issueCodes, ["PLAN_NOT_ALLOWED"]);
  });

  it("excludes real equipment rows until the channel enables them", () => {
    const result = evaluateRecoveryEligibility(
      { ...eligibleRow, equipmentRaw: "IPHONE 17 PRO MAX PLATA" },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "EXCLUDED");
    assert.deepEqual(result.issueCodes, ["EQUIPMENT_NOT_ALLOWED"]);
  });

  it("marks rows without identity as invalid before filtering (BR-008)", () => {
    const result = evaluateRecoveryEligibility(
      { ...eligibleRow, documentNumber: null, modalityRaw: "PREP" },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "INVALID");
    assert.deepEqual(result.issueCodes, ["MISSING_DOCUMENT"]);
  });

  it("marks unknown carriers as invalid", () => {
    const result = evaluateRecoveryEligibility(
      { ...eligibleRow, carrierRaw: "99" },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(result.classification, "INVALID");
    assert.deepEqual(result.issueCodes, ["UNKNOWN_CARRIER"]);
  });
});

describe("groupRecoveryRecordsByClient", () => {
  const base = {
    holderName: "CLIENTE DEMO",
    modalityRaw: "POST",
    planRaw: "Abierto Movistar Libre Plan Movistar Maximo S/39.9",
    equipmentRaw: "Simcard",
    carrierRaw: "CLARO",
    requiresIdentityValidation: false,
  };

  it("merges services and contact phones into one client case (BR-006/BR-007)", () => {
    const registeredAt = new Date("2026-08-25T13:00:00.000Z");
    const groups = groupRecoveryRecordsByClient([
      {
        ...base,
        recordId: "r1",
        documentNumber: "05245525",
        serviceNumber: "930000001",
        contactPhone: "930000001",
        registeredAt,
      },
      {
        ...base,
        recordId: "r2",
        documentNumber: "05245525",
        serviceNumber: "930000001",
        contactPhone: "955000000",
        registeredAt,
      },
      {
        ...base,
        recordId: "r3",
        documentNumber: "05245525",
        serviceNumber: "930000002",
        contactPhone: null,
        registeredAt: new Date("2026-08-24T13:00:00.000Z"),
      },
    ]);

    assert.equal(groups.length, 1);

    const group = groups[0];

    assert.equal(group.documentNumber, "05245525");
    assert.equal(group.services.length, 2);
    assert.deepEqual(group.contactPhones, ["955000000"]);
    assert.equal(group.recordIds.length, 3);
    assert.equal(
      group.firstRegisteredAt.toISOString(),
      "2026-08-24T13:00:00.000Z",
    );
  });

  it("keeps clients separate and flags identity validation when any row asks for it", () => {
    const registeredAt = new Date("2026-08-25T13:00:00.000Z");
    const groups = groupRecoveryRecordsByClient([
      {
        ...base,
        recordId: "r1",
        documentNumber: "01111111",
        serviceNumber: "930000001",
        contactPhone: null,
        registeredAt,
      },
      {
        ...base,
        recordId: "r2",
        documentNumber: "02222222",
        serviceNumber: "930000002",
        contactPhone: null,
        registeredAt,
        requiresIdentityValidation: true,
      },
    ]);

    assert.equal(groups.length, 2);
    assert.equal(
      groups.find((group) => group.documentNumber === "02222222")
        ?.requiresIdentityValidation,
      true,
    );
    assert.equal(
      groups.find((group) => group.documentNumber === "01111111")
        ?.requiresIdentityValidation,
      false,
    );
  });

  it("does not duplicate sightings for the same service and date", () => {
    const registeredAt = new Date("2026-08-25T13:00:00.000Z");
    const groups = groupRecoveryRecordsByClient([
      {
        ...base,
        recordId: "r1",
        documentNumber: "05245525",
        serviceNumber: "930000001",
        contactPhone: "955000000",
        registeredAt,
      },
      {
        ...base,
        recordId: "r2",
        documentNumber: "05245525",
        serviceNumber: "930000001",
        contactPhone: "956000000",
        registeredAt,
      },
    ]);

    assert.equal(groups[0].services[0].sightings.length, 1);
    assert.deepEqual(groups[0].contactPhones, ["955000000", "956000000"]);
  });
});

describe("normalizeRecoveryServiceNumber", () => {
  it("acepta móviles peruanos y retira el prefijo 51 de once dígitos", () => {
    assert.equal(normalizeRecoveryServiceNumber("900019627"), "900019627");
    assert.equal(normalizeRecoveryServiceNumber("51920125533"), "920125533");
    assert.equal(normalizeRecoveryServiceNumber("987654321.0"), "987654321");
  });

  it("rechaza los malformados de la base real del 27/08", () => {
    // Nueve dígitos que empiezan en 51: basura de exportación, no una línea.
    assert.equal(normalizeRecoveryServiceNumber("519201255"), null);
    assert.equal(normalizeRecoveryServiceNumber("519351292"), null);
    // Un fijo tampoco es portable en este flujo.
    assert.equal(normalizeRecoveryServiceNumber("014567890"), null);
    assert.equal(normalizeRecoveryServiceNumber(""), null);
  });

  it("una fila con servicio malformado se reporta INVALID_SERVICE_NUMBER", () => {
    const evaluation = evaluateRecoveryEligibility(
      {
        documentNumber: "05245525",
        serviceNumber: null,
        serviceNumberMalformed: true,
        registeredAt: new Date("2026-08-27T10:00:00.000-05:00"),
        modalityRaw: "POST",
        planRaw: defaultRecoveryEligibilityConfig.planNames[0],
        equipmentRaw: "Simcard",
        carrierRaw: "CLARO",
      },
      defaultRecoveryEligibilityConfig,
    );

    assert.equal(evaluation.classification, "INVALID");
    assert.deepEqual(evaluation.issueCodes, ["INVALID_SERVICE_NUMBER"]);
  });
});
