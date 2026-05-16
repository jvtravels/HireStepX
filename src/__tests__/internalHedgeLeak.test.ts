/* F2 / Audit Pass 2 (PDF#25, 2026-05-16) — internal-hedge leak.
 *
 * Recruiter-internal thought ("let me check as per the band ... but
 * broadly aligned") leaking into the candidate-facing line. Canonical
 * never emits these patterns outside the legitimate sentiment-prefix
 * path; the validator rejects any restyle that introduces them.
 *
 * Also asserts the canonical-prose competing-leverage-ack line has been
 * cleaned up (no longer narrates "let me make sure we're broadly
 * aligned"). */
import { describe, it, expect } from "vitest";
import {
  validateRestyle,
  HEDGE_FILLER_RE,
} from "../../server-handlers/_response-pipeline";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };
const mkState = (overrides: Partial<NegotiationState> = {}): NegotiationState => {
  const s = initState({ sessionId: "s-hedge", role: "swe", company: "acme", band: BAND });
  return Object.assign(s, overrides);
};

describe("F2 — HEDGE_FILLER_RE pattern", () => {
  it("matches all four documented patterns", () => {
    expect(HEDGE_FILLER_RE.test("Let me check with my manager")).toBe(true);
    expect(HEDGE_FILLER_RE.test("we're broadly aligned here")).toBe(true);
    expect(HEDGE_FILLER_RE.test("Just to confirm — what's the number?")).toBe(true);
    expect(HEDGE_FILLER_RE.test("Hmm, let me think")).toBe(true);
  });

  it("does NOT match plain English", () => {
    expect(HEDGE_FILLER_RE.test("What's the current CTC?")).toBe(false);
    expect(HEDGE_FILLER_RE.test("Let's stay on the fitment side.")).toBe(false);
    expect(HEDGE_FILLER_RE.test("Take your time and revert.")).toBe(false);
  });
});

describe("F2 — validateRestyle rejects internal hedge leaks", () => {
  it("rejects 'let me check as per the band' restyle", () => {
    const canonical = "What's your current CTC?";
    const restyle =
      "Let me check as per the band for this grade — what's your current CTC?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateCurrentCtc: 18 }));
    expect(r.valid).toBe(false);
    if (!r.valid) {
      /* Could be internal-hedge-leak or idiom-stacking depending on
       * which gate fires first. Either is a correct rejection. */
      expect(["internal-hedge-leak", "idiom-stacking"]).toContain(r.reason);
    }
  });

  it("rejects 'broadly aligned' padding when canonical doesn't have it", () => {
    const canonical = "What's your current CTC at present?";
    const restyle = "We're broadly aligned — what's the current CTC?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateCurrentCtc: 18 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("internal-hedge-leak");
  });

  it("allows 'broadly aligned' when canonical carries it (sentiment prefix)", () => {
    /* The excited-sentiment prefix from renderSentimentPrefix legitimately
     * emits "Glad we're broadly aligned —"; the gate skips when the
     * canonical itself contains the hedge phrase. */
    const canonical = "Glad we're broadly aligned — what's the current CTC?";
    const restyle = "Glad we're broadly aligned. What's the current CTC?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateCurrentCtc: 18 }));
    expect(r.valid).toBe(true);
  });

  it("rejects 'just to confirm' padding", () => {
    const canonical = "What fitment were you anchoring on?";
    const restyle = "Just to confirm — what fitment were you anchoring on?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateTarget: 30 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("internal-hedge-leak");
  });
});

describe("F2 — canonical-prose cleanup", () => {
  it("competing-leverage-ack reactive-followup no longer narrates 'let me make sure we're broadly aligned'", () => {
    const action: NextAction = {
      kind: "reactive-followup",
      topic: "competing-leverage-ack",
    } as NextAction;
    const text = renderCanonicalProse(action, mkState({ candidateTarget: 30 }));
    /* The old line said "Let me make sure we're broadly aligned on what
     * matters most ... before I revert internally". The cleaned line
     * speaks to the candidate directly. */
    expect(text).not.toMatch(/let me make sure we['’]?re broadly aligned/i);
  });
});
