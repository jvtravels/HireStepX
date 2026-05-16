/* F1 / Audit Pass 2 (PDF#25, 2026-05-16) — multi-topic-per-utterance gate.
 *
 * Session #25 T2 packed two discovery topics into a single bot utterance
 * ("expected fitment AND total CTC"). Canonical prose is curated to one
 * topic per turn; the LLM restyle must not collapse two probes into one.
 *
 * The gate counts distinct topic-keyword matches in the restyle. When >1,
 * it rejects with reason multi-topic-utterance UNLESS the canonical
 * itself already references >1 topic (e.g. close-recap-formal recap spans
 * fixed + variable + notice). */
import { describe, it, expect } from "vitest";
import {
  validateRestyle,
  TOPIC_KEYWORD_MAP,
} from "../../server-handlers/_response-pipeline";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };
const mkState = (overrides: Partial<NegotiationState> = {}): NegotiationState => {
  const s = initState({ sessionId: "s-multi-topic", role: "swe", company: "acme", band: BAND });
  return Object.assign(s, overrides);
};

describe("F1 — TOPIC_KEYWORD_MAP shape", () => {
  it("has the six discovery topics", () => {
    expect(Object.keys(TOPIC_KEYWORD_MAP).sort()).toEqual(
      ["competing", "currentCtc", "fixedVariable", "notice", "targetCtc", "valueProof"].sort(),
    );
  });
});

describe("F1 — multi-topic-per-utterance gate", () => {
  it("rejects a 2-topic restyle when canonical is 1-topic", () => {
    const canonical = "What fitment were you anchoring on for this role?";
    const stacked =
      "What's the expected fitment you're targeting, and what's the total CTC at present?";
    const r = validateRestyle(canonical, stacked, mkState({ candidateTarget: 30, candidateCurrentCtc: 18 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("multi-topic-utterance");
  });

  it("accepts a 1-topic restyle for a 1-topic canonical", () => {
    const canonical = "What's your current CTC?";
    const restyle = "What's the current CTC at present?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateCurrentCtc: 18 }));
    expect(r.valid).toBe(true);
  });

  it("accepts a 0-topic restyle (pure courtesy reply)", () => {
    const canonical = "Take your time on this — and revert when ready.";
    const restyle = "No rush. Revert whenever you're ready.";
    const r = validateRestyle(canonical, restyle, mkState());
    expect(r.valid).toBe(true);
  });

  it("does NOT apply the gate when canonical itself spans 2+ topics", () => {
    /* Multi-topic canonical (close-recap-formal style) should not be
     * blocked by the multi-topic gate — the LLM is mirroring the
     * structured recap, not stacking. */
    const canonical =
      "Recap — Fixed ₹18L, variable target ₹3L, notice 8 weeks, BGV starts on offer letter signature.";
    const restyle =
      "To recap — Fixed ₹18L, variable ₹3L, notice 8 weeks, BGV starts on offer-letter signature.";
    const r = validateRestyle(canonical, restyle, mkState());
    if (!r.valid) {
      expect(r.reason).not.toBe("multi-topic-utterance");
    }
  });
});
