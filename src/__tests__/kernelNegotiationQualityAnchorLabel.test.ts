import { describe, it, expect } from "vitest";
import { anchorAtLabel } from "../sessionReport/derivations";

/* L-6 (live staging walk-away 599e1c9f) — the "Anchored at" tile must not read
   "Never anchored" when the candidate's ask is on record. `anchorTurn` comes from
   the per-turn TOTAL-target snapshot, which misses fixed-only anchors ("46 fixed");
   `candidateAskLpa` folds those in and is the authoritative did-they-anchor signal. */
describe("anchorAtLabel", () => {
  it("says Never anchored only when there is no ask at all", () => {
    expect(anchorAtLabel(null, null)).toBe("Never anchored");
    expect(anchorAtLabel(null, undefined)).toBe("Never anchored");
  });

  it("L-6: ask on record but turn untracked (fixed-only anchor) → not 'Never anchored'", () => {
    expect(anchorAtLabel(null, 43)).toBe("Anchored (turn not tracked)");
  });

  it("labels an early anchor with turn context", () => {
    expect(anchorAtLabel(0, 43)).toBe("Turn 0 (early)");
    expect(anchorAtLabel(1, 43)).toBe("Turn 1 (early)");
  });

  it("labels mid and late anchors", () => {
    expect(anchorAtLabel(2, 43)).toBe("Turn 2");
    expect(anchorAtLabel(3, 43)).toBe("Turn 3");
    expect(anchorAtLabel(5, 43)).toBe("Turn 5 (late)");
  });
});
