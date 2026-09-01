import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePortabilityReportText } from "../dist/recovery-portability-report.js";

/**
 * Regresión del incidente del 01/09/2026: el reporte real de la consulta
 * trae seis columnas (sin `numero_consultado`); la versión anterior exigía
 * las siete, caía en silencio al cruce rápido y descartó como "ya activos"
 * también los números no portados — 91 casos cerrados en lugar de 76.
 */
const realHeader =
  "numero,receptor,cedente,asignatario_original,fecha_de_la_ventana,estado";

const realRows = [
  "900031121,-,-,Viettel Perú S.A.C.(24),-,Número no portado",
  "900019627,Telefónica del Perú S. A.A.(22),Viettel Perú S.A.C.(24),Viettel Perú S.A.C.(24),29/08/2026 00:00,Número portado",
  "900530785,Entel Perú S.A.,América Móvil Perú S.A.C. (Claro),Viettel Perú S.A.C.(24),30/08/2026 00:00,Número portado",
];

describe("parsePortabilityReportText", () => {
  it("reconoce como completo el archivo real de seis columnas", () => {
    const parsed = parsePortabilityReportText(
      [realHeader, ...realRows].join("\n"),
    );

    assert.equal(parsed.kind, "FULL");
    assert.equal(parsed.rows.length, 3);

    const noPortado = parsed.rows.find(
      (row) => row.serviceNumber === "900031121",
    );
    assert.equal(noPortado?.state, "NO_PORTADO");
    assert.equal(noPortado?.isMovistarReceiver, false);

    const aMovistar = parsed.rows.find(
      (row) => row.serviceNumber === "900019627",
    );
    assert.equal(aMovistar?.state, "PORTADO");
    assert.equal(aMovistar?.isMovistarReceiver, true);

    const aEntel = parsed.rows.find(
      (row) => row.serviceNumber === "900530785",
    );
    assert.equal(aEntel?.state, "PORTADO");
    assert.equal(aEntel?.isMovistarReceiver, false);
  });

  it("sigue aceptando la variante de siete columnas con numero_consultado", () => {
    const parsed = parsePortabilityReportText(
      [`${realHeader},numero_consultado`, `${realRows[1]},900019627`].join(
        "\n",
      ),
    );

    assert.equal(parsed.kind, "FULL");
    assert.equal(parsed.rows[0]?.serviceNumber, "900019627");
  });

  it("rechaza un reporte de resultados incompleto en lugar de tratarlo como cruce rápido (BR-018c)", () => {
    assert.throws(
      () =>
        parsePortabilityReportText(
          ["numero,estado", "900031121,Número no portado"].join("\n"),
        ),
      /reporte completo/,
    );
  });

  it("mantiene el cruce rápido para listas planas de números", () => {
    const parsed = parsePortabilityReportText("numero\n900031121\n900019627");

    assert.equal(parsed.kind, "QUICK");
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0]?.state, "PORTADO");
    assert.equal(parsed.rows[0]?.isMovistarReceiver, true);
  });

  it("el cruce rápido deduplica y reporta las filas ignoradas", () => {
    const parsed = parsePortabilityReportText(
      "numero\n900031121\n900031121\nSIN DATO",
    );

    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.ignoredRows, 2);
  });
});
