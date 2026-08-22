import assert from "node:assert/strict";
import test from "node:test";

import { formatAdvisorCompactName } from "../dist/index.js";

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
