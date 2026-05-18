/* PDF#29 Bugs 1 + 2 + 4 (2026-05-18) — real-phrasing parser fixtures.
 *
 * Bug 1: "₹12 LPA fixed" (single-sided absolute split, number BEFORE
 * cue) — kernel re-probes because extractNumberAfter only matches
 * cue→number. Companion extractor + complement derivation when total
 * is known.
 *
 * Bug 2: "the anchor I had in mind was around 28" / "anchoring around
 * 32 LPA" — targetCtxPat / targetRangePat missed the `anchor` cue
 * and `the` filler. Broadened to accept both.
 *
 * Bug 4 auto-resolves with 1 + 2 — it was the same probe-loop hitting
 * via a different phrasing the parsers couldn't see.
 *
 * fixture from PDF 29 manual replay session (2026-05-18) — phrasing per
 * kernel diagnostic.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import { extractComponentBreakdown } from "../../../server-handlers/_component-breakdown";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const seed = (overrides: Partial<ReturnType<typeof initState>> = {}) => ({
  ...initState({
    sessionId: "pdf29-parser",
    role: "Senior PM",
    company: "Razorpay",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#29 Bug 1 — single-sided absolute-rupee split + complement derivation", () => {
  it("'₹12 LPA fixed' with no total disclosed → base=12, variable null", () => {
    const b = extractComponentBreakdown("I'm currently drawing ₹12 LPA fixed");
    expect(b.base).toBe(12);
    expect(b.variable).toBeNull();
    expect(b.hasAny).toBe(true);
  });

  it("'₹12 LPA fixed' with total=18 → base=12, variable=6 (complement)", () => {
    const b = extractComponentBreakdown("I'm currently drawing ₹12 LPA fixed", 18);
    expect(b.base).toBe(12);
    expect(b.variable).toBe(6);
    expect(b.hasAny).toBe(true);
  });

  it("'₹8L variable' with total=20 → variable=8, base=12 (complement)", () => {
    const b = extractComponentBreakdown("₹8L variable", 20);
    expect(b.variable).toBe(8);
    expect(b.base).toBe(12);
  });

  it("complement guarded against zero/negative result", () => {
    /* fixed >= total: complement would be ≤ 0, must NOT fabricate variable=0. */
    const b = extractComponentBreakdown("₹20 LPA fixed", 18);
    expect(b.base).toBe(20);
    expect(b.variable).toBeNull();
  });

  it("end-to-end: applyCandidateAnswer folds the split with stale-state total", () => {
    const s = seed({ candidateCurrentCtc: 18 });
    const next = applyCandidateAnswer(s, "I'm currently drawing ₹12 LPA fixed");
    expect(next.candidateComponentBreakdown?.base).toBe(12);
    expect(next.candidateComponentBreakdown?.variable).toBe(6);
  });
});

describe("PDF#29 Bug 2 — broadened anchor cue", () => {
  it("'the anchor I had in mind was around 28' → candidateTarget=28", () => {
    const next = applyCandidateAnswer(seed(), "the anchor I had in mind was around 28");
    expect(next.candidateTarget).toBe(28);
  });

  it("'anchoring around 32 LPA' → candidateTarget=32", () => {
    const next = applyCandidateAnswer(seed(), "anchoring around 32 LPA");
    expect(next.candidateTarget).toBe(32);
  });

  it("'anchoring between 28-35 LPA' → candidateTarget=35 (upper bound binding preserved)", () => {
    const next = applyCandidateAnswer(seed(), "anchoring between 28-35 LPA");
    expect(next.candidateTarget).toBe(35);
  });
});
