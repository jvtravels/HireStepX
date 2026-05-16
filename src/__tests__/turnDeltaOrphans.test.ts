/* Audit Pass 3 / Fix 2 (2026-05-16) — TurnDelta orphan guard.
 * ────────────────────────────────────────────────────────────────────
 * Background: TurnDelta fields are produced by computeTurnDelta in
 * _negotiation-kernel.ts and consumed by downstream pipeline modules
 * (response-pipeline, reactive followups, etc.). Audit Pass 3 found two
 * orphan fields — `disclosedJoiningDate` and `retentionCounterDisclosed`
 * — that were being written but never read, silently bloating the per-
 * turn surface area and inviting "this signal exists" misreads.
 *
 * This test snapshots the current set of TurnDelta keys. It does NOT
 * verify every key has a reader (that would require AST analysis), but
 * it does prevent the two known orphans from being reintroduced AND
 * makes any future TurnDelta surface change visible in PR diffs so a
 * reviewer must consciously confirm the new field has a consumer.
 *
 * If you legitimately add a new field, update the snapshot AND grep
 * `delta\.<field>` / `turnDelta\.<field>` to confirm a reader exists.
 */
import { describe, it, expect } from "vitest";
import { EMPTY_TURN_DELTA } from "../../server-handlers/_negotiation-kernel";

describe("TurnDelta surface — no orphan fields", () => {
  it("must not reintroduce the two removed orphans", () => {
    const keys = Object.keys(EMPTY_TURN_DELTA);
    expect(keys).not.toContain("disclosedJoiningDate");
    expect(keys).not.toContain("retentionCounterDisclosed");
  });

  it("matches the expected key snapshot (update intentionally on any change)", () => {
    const keys = Object.keys(EMPTY_TURN_DELTA).sort();
    expect(keys).toEqual(
      [
        "askedQuestion",
        "candidateAskedQuestion",
        "candidateSentiment",
        "disclosedCompetingOffer",
        "disclosedCurrentCtc",
        "disclosedExpectedCtc",
        "disclosedFixedVariableSplit",
        "disclosedNoticePeriod",
        "disclosedValueProof",
        "freshGradDisclosed",
        "noticeBuyoutConfirmed",
        "refusedItem",
        "urgencySignal",
      ].sort(),
    );
  });
});
