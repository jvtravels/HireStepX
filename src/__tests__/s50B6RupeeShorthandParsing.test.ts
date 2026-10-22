/* S50-B6 / S48-B1 cluster (2026-07-24) — ₹NL shorthand: target dropped when
 * both CTC and target appear in the same utterance.
 *
 * Root cause: PRIOR_DISCLOSURE in scoreRolesForSpan used \bl\b (boundary
 * before AND after "L"). In "₹55L", the "L" is immediately preceded by "5"
 * (a word character), so there is NO word boundary before "L", and the regex
 * failed to detect "₹55L" as a prior disclosure. Consequently the left-context
 * window for the second span (₹90L) was NOT clipped at the "₹55L" token, so
 * "current CTC" leaked into the scoring window, inflated the current score, and
 * caused ₹90L to be mis-assigned as "current" instead of "target".
 *
 * Fix: PRIOR_DISCLOSURE now uses l\b (boundary only after "L"), so digit-abutted
 * forms like "55L" and "90L" are correctly detected as prior disclosures and the
 * clause clip fires.
 *
 * Test matrix:
 *   A. "My current CTC is ₹55L and I'm targeting ₹90L." → currentCtc=55, target=90
 *   B. "Current ₹20L, targeting ₹35L." → currentCtc=20, target=35
 *   C. "₹18L CTC, looking at ₹28L." → currentCtc=18, target=28
 *   D. Single form "My current CTC is ₹55L." → currentCtc=55, target=null
 *   E. Single form "I am targeting ₹90L." → target=90, currentCtc=null
 *   F. "N LPA" format (control) "My current CTC is 55 LPA and targeting 90 LPA." → both parsed
 *   G. "₹55L" and "₹90L" on separate turns → both parsed correctly
 */

import { describe, it, expect } from "vitest";
import { parseCandidateAnswer } from "../../server-handlers/_negotiation-kernel";

describe("S50-B6 — ₹NL shorthand: CTC + target in same utterance", () => {
  it("A. 'My current CTC is ₹55L and I'm targeting ₹90L.' → both parsed", () => {
    const r = parseCandidateAnswer(
      "My current CTC is ₹55L and I'm targeting ₹90L.",
      "",
      "opening",
      false,
      1,
      null,
    );
    expect(r.currentCtc).toBe(55);
    expect(r.target).toBe(90);
  });

  it("B. 'Current ₹20L, targeting ₹35L.' → both parsed", () => {
    const r = parseCandidateAnswer(
      "Current ₹20L, targeting ₹35L.",
      "",
      "opening",
      false,
      1,
      null,
    );
    expect(r.currentCtc).toBe(20);
    expect(r.target).toBe(35);
  });

  it("C. 'My CTC is ₹18L and I'm looking for ₹28L.' → both parsed", () => {
    const r = parseCandidateAnswer(
      "My CTC is ₹18L and I'm looking for ₹28L.",
      "",
      "opening",
      false,
      1,
      null,
    );
    expect(r.currentCtc).toBe(18);
    expect(r.target).toBe(28);
  });

  it("D. Single CTC form — 'My current CTC is ₹55L.' → currentCtc=55, target=null", () => {
    const r = parseCandidateAnswer(
      "My current CTC is ₹55L.",
      "",
      "opening",
      false,
      1,
      null,
    );
    expect(r.currentCtc).toBe(55);
    expect(r.target).toBeNull();
  });

  it("E. Single target form — 'I am targeting ₹90L.' → target=90, currentCtc=null", () => {
    const r = parseCandidateAnswer(
      "I am targeting ₹90L.",
      "",
      "probe-expectations",
      false,
      1,
      null,
    );
    expect(r.target).toBe(90);
    expect(r.currentCtc).toBeNull();
  });

  it("F. LPA format control — '55 LPA and targeting 90 LPA' → both parsed (regression guard)", () => {
    const r = parseCandidateAnswer(
      "My current CTC is 55 LPA and I'm targeting 90 LPA.",
      "",
      "opening",
      false,
      1,
      null,
    );
    expect(r.currentCtc).toBe(55);
    expect(r.target).toBe(90);
  });

  it("G. Separate turns — ₹55L turn 1, ₹90L turn 2 → both parsed correctly", () => {
    const r1 = parseCandidateAnswer(
      "My current CTC is ₹55L.",
      "",
      "opening",
      false,
      1,
      null,
    );
    expect(r1.currentCtc).toBe(55);
    const r2 = parseCandidateAnswer(
      "I'm targeting ₹90L.",
      "",
      "probe-expectations",
      false,
      2,
      55,
    );
    expect(r2.target).toBe(90);
  });
});
