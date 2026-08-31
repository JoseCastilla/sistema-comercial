import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAdvisorCompactName,
  formatAdvisorDisplayName,
} from "../dist/index.js";

test("uses the corporate email to identify the first surname", () => {
  assert.equal(
    formatAdvisorCompactName(
      "ALEXANDRA NORA HUARANCA GUTIERREZ",
      "alexandra.huaranca@distribuidoronline.com",
    ),
    "Alexandra H.",
  );
  assert.equal(
    formatAdvisorCompactName(
      "CHRISTIAN HUGO RUIZ COTERA",
      "christian.ruiz@distribuidoronline.com",
    ),
    "Christian R.",
  );
});

test("supports compound surnames and preserves the expected initial", () => {
  assert.equal(
    formatAdvisorCompactName(
      "Angieska De Los Rios",
      "angieska.delosrios@distribuidoronline.com",
    ),
    "Angieska D.",
  );
});

test("presenta nombre y apellido con inicial mayuscula", () => {
  assert.equal(
    formatAdvisorDisplayName(
      "SARAI VALERIA FLORES CAMAC",
      "sarai.flores@distribuidoronline.com",
    ),
    "Sarai Flores",
  );
  assert.equal(
    formatAdvisorDisplayName(
      "xiomara carla ricra leon",
      "xiomara.ricra@distribuidoronline.com",
    ),
    "Xiomara Ricra",
  );
});

test("reconstruye apellidos compuestos desde el correo", () => {
  assert.equal(
    formatAdvisorDisplayName(
      "AGNIESKA ALIZON DE LOS RIOS HUAMAN",
      "agnieska.delosrios@distribuidoronline.com",
    ),
    "Agnieska De Los Rios",
  );
});

test("toma el segundo nombre cuando el correo usa el segundo", () => {
  assert.equal(
    formatAdvisorDisplayName(
      "MILAGROS ERIKA CCALLOCUNTO HINOSTROZA",
      "erika.ccallocunto@distribuidoronline.com",
    ),
    "Erika Ccallocunto",
  );
});

test("sin correo aprovechable usa los dos primeros tokens", () => {
  assert.equal(formatAdvisorDisplayName("Jimena Cuya", ""), "Jimena Cuya");
  assert.equal(formatAdvisorDisplayName("", "a.b@c.com"), "");
});
