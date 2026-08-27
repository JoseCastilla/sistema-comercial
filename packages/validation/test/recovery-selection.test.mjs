import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeRangeSelection } from "../dist/recovery-selection.js";

const ids = ["a", "b", "c", "d", "e", "f"];

describe("computeRangeSelection", () => {
  it("toggles a single element on normal click", () => {
    const first = computeRangeSelection({
      orderedIds: ids,
      selected: new Set(),
      clickedIndex: 2,
      lastClickedIndex: null,
      shiftKey: false,
    });

    assert.deepEqual([...first.selected], ["c"]);
    assert.equal(first.lastClickedIndex, 2);

    const second = computeRangeSelection({
      orderedIds: ids,
      selected: first.selected,
      clickedIndex: 2,
      lastClickedIndex: first.lastClickedIndex,
      shiftKey: false,
    });

    assert.deepEqual([...second.selected], []);
  });

  it("selects a forward range with shift", () => {
    const anchor = computeRangeSelection({
      orderedIds: ids,
      selected: new Set(),
      clickedIndex: 1,
      lastClickedIndex: null,
      shiftKey: false,
    });

    const range = computeRangeSelection({
      orderedIds: ids,
      selected: anchor.selected,
      clickedIndex: 4,
      lastClickedIndex: anchor.lastClickedIndex,
      shiftKey: true,
    });

    assert.deepEqual([...range.selected].sort(), ["b", "c", "d", "e"]);
  });

  it("selects a backward range with shift", () => {
    const anchor = computeRangeSelection({
      orderedIds: ids,
      selected: new Set(),
      clickedIndex: 4,
      lastClickedIndex: null,
      shiftKey: false,
    });

    const range = computeRangeSelection({
      orderedIds: ids,
      selected: anchor.selected,
      clickedIndex: 1,
      lastClickedIndex: anchor.lastClickedIndex,
      shiftKey: true,
    });

    assert.deepEqual([...range.selected].sort(), ["b", "c", "d", "e"]);
  });

  it("deselects a range when the clicked element was selected", () => {
    const all = new Set(ids);
    const result = computeRangeSelection({
      orderedIds: ids,
      selected: all,
      clickedIndex: 3,
      lastClickedIndex: 0,
      shiftKey: true,
    });

    assert.deepEqual([...result.selected].sort(), ["e", "f"]);
  });

  it("treats shift without an anchor as a normal click", () => {
    const result = computeRangeSelection({
      orderedIds: ids,
      selected: new Set(),
      clickedIndex: 3,
      lastClickedIndex: null,
      shiftKey: true,
    });

    assert.deepEqual([...result.selected], ["d"]);
  });

  it("ignores clicks outside the list", () => {
    const result = computeRangeSelection({
      orderedIds: ids,
      selected: new Set(["a"]),
      clickedIndex: 99,
      lastClickedIndex: 0,
      shiftKey: true,
    });

    assert.deepEqual([...result.selected], ["a"]);
    assert.equal(result.lastClickedIndex, 0);
  });
});
