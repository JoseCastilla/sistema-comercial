import assert from "node:assert/strict";
import test from "node:test";

import { parseRecoverySearchTerm } from "../dist/recovery-search.js";

test("un término vacío no filtra nada", () => {
  assert.equal(parseRecoverySearchTerm(""), null);
  assert.equal(parseRecoverySearchTerm("   "), null);
  assert.equal(parseRecoverySearchTerm(null), null);
});

test("separa el nombre en palabras que se exigen todas", () => {
  assert.deepEqual(parseRecoverySearchTerm("Norma Ramos"), {
    words: ["norma", "ramos"],
    digits: null,
  });
});

test("una sola letra no acota: se descarta", () => {
  assert.equal(parseRecoverySearchTerm("a"), null);
  assert.deepEqual(parseRecoverySearchTerm("norma a"), {
    words: ["norma"],
    digits: null,
  });
});

test("reconoce el DNI dictado con espacios", () => {
  assert.deepEqual(parseRecoverySearchTerm("02 830 974"), {
    words: [],
    digits: "02830974",
  });
});

test("reconoce el teléfono con guiones o prefijo", () => {
  assert.deepEqual(parseRecoverySearchTerm("930-500-638"), {
    words: [],
    digits: "930500638",
  });
  assert.deepEqual(parseRecoverySearchTerm("+51 930500638"), {
    words: [],
    digits: "51930500638",
  });
});

test("tres dígitos encontrarían media base: no se buscan", () => {
  assert.equal(parseRecoverySearchTerm("930"), null);
  assert.deepEqual(parseRecoverySearchTerm("9305"), {
    words: [],
    digits: "9305",
  });
});

test("un término mixto busca por las dos vías a la vez", () => {
  assert.deepEqual(parseRecoverySearchTerm("ramos 930500638"), {
    words: ["ramos"],
    digits: "930500638",
  });
});

test("no se buscan más de cinco palabras", () => {
  const termino = parseRecoverySearchTerm("uno dos tres cuatro cinco seis");

  assert.equal(termino.words.length, 5);
  assert.deepEqual(termino.words, ["uno", "dos", "tres", "cuatro", "cinco"]);
});

test("un término larguísimo se recorta antes de consultar", () => {
  const termino = parseRecoverySearchTerm("a".repeat(500));

  assert.equal(termino.words[0].length, 80);
});
