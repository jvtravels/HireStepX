/* Bug 1 (PDF#25, 2026-05-16) — idiom-stacking cap + declarative+question
 * grammar rule + tautology-current-band rule + discovery-probe opener
 * rotation. Asserts the validator rejects the three failure modes from
 * Session #25 (Senior Product Designer @ Flipkart, salary-negotiation
 * focus) and that the deterministic opener rotation has no two
 * consecutive identical openers across a 4-turn probe sequence.
 */
import { describe, it, expect } from "vitest";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import {
  countPreferredIdioms,
  IDIOM_PER_UTTERANCE_CAP,
  pickDiscoveryProbeOpener,
  DISCOVERY_PROBE_OPENERS,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };
const mkState = (): NegotiationState => {
  /* F7 (Audit Pass 2, 2026-05-16) — some tests below restyle a canonical
   * that opens with "Noted on the expected fitment …". The F7 invariant
   * requires state.candidateTarget != null for any ack-form that names
   * "expected side / expected fitment" to ship. Seed the state so the
   * unrelated grammar / tautology / idiom-stacking assertions are not
   * preempted by ack-without-disclosure. */
  const s = initState({ sessionId: "s-idiom-stack", role: "swe", company: "acme", band: BAND });
  s.candidateTarget = 30;
  s.candidateCurrentCtc = 18;
  return s;
};

describe("IDIOM_PER_UTTERANCE_CAP — countPreferredIdioms", () => {
  it("counts each preferred idiom occurrence (not just unique types)", () => {
    const sample =
      "On the expected fitment — let me check as per the band for this grade, but broadly aligned, what's the total CTC at present?";
    /* fitment (1) + as per the band for this grade (1) + broadly aligned (1) = 3 */
    expect(countPreferredIdioms(sample)).toBeGreaterThanOrEqual(3);
  });

  it("returns 0 for plain English with no idioms", () => {
    expect(countPreferredIdioms("What's your current CTC?")).toBe(0);
  });

  it("cap is set to 1 per spec", () => {
    expect(IDIOM_PER_UTTERANCE_CAP).toBe(1);
  });
});

describe("validateRestyle — idiom-stacking rejection (Bug 1)", () => {
  it("rejects Session #25 sample with 3 idioms stacked", () => {
    /* Original Session #25 sample had fitment + broadly ≈ 2 idioms — too
     * close to the cap to assert rejection unambiguously. Use a simpler
     * canonical (1 idiom) so the stacked restyle definitively exceeds. */
    const simpleCanonical =
      "Got it on the current side — what's the fitment you were looking at?";
    const stacked =
      "Right, on the expected fitment — Let me check as per the band for this grade, but broadly aligned, what's the total CTC at present?";
    const r = validateRestyle(simpleCanonical, stacked, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("idiom-stacking");
  });

  it("allows restyle whose idiom count matches canonical's (e.g. close-recap)", () => {
    const canonical =
      "Let me recap the fitment before I revert internally — Fixed ₹18L, variable target ₹3L, notice 8 weeks, BGV starts on offer letter signature, offer letter in 5 business days. Sounds good?";
    const restyle =
      "Let me recap the fitment before I revert — Fixed ₹18L, variable target ₹3L, notice 8 weeks, BGV starts on offer letter signature, offer letter in 5 business days. Sounds good?";
    /* Both have fitment + revert = 2 idioms. Cap floor of 1 is raised
     * to 2 because canonical needed 2. Restyle should pass. */
    const r = validateRestyle(canonical, restyle, mkState());
    expect(r.valid).toBe(true);
  });

  it("rejects a restyle that adds an idiom beyond canonical's count", () => {
    const canonical = "What's your current CTC?";
    const restyle = "On the fitment, broadly aligned, what's the total CTC?";
    const r = validateRestyle(canonical, restyle, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("idiom-stacking");
  });
});

describe("validateRestyle — declarative-plus-question grammar (Bug 1)", () => {
  it("rejects 'Fair enough on X, let's look at Y at present?' (single clause, declarative lead + ?)", () => {
    const canonical = "Got it on the current side — what's the total CTC at present?";
    const bad = "Fair enough on your current compensation, let's look at the total CTC at present?";
    const r = validateRestyle(canonical, bad, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("declarative-plus-question-mark");
  });

  it("allows 'Noted on X. What's Y?' (two sentences — declarative period, interrogative question)", () => {
    const canonical = "Noted on the expected fitment — what's your current CTC?";
    const ok = "Noted on the expected side. What's the current CTC?";
    const r = validateRestyle(canonical, ok, mkState());
    expect(r.valid).toBe(true);
  });
});

describe("validateRestyle — tautology rejection (Bug 1)", () => {
  it("rejects 'total CTC as per your current band' tautology", () => {
    const canonical = "Got it on the current side — what's the total CTC at present?";
    const bad = "Right, on the current side — what's the total CTC as per your current band?";
    const r = validateRestyle(canonical, bad, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("tautology-current-band");
  });
});

describe("DISCOVERY_PROBE_OPENERS rotation (Bug 1c)", () => {
  it("pickDiscoveryProbeOpener is deterministic and cycles through DISCOVERY_PROBE_OPENERS", () => {
    /* The rotation must cycle through every entry at least once and
     * never return the same opener on two consecutive turns. */
    const seen = new Set<string>();
    let prev: string | null = null;
    for (let i = 0; i < 8; i++) {
      const opener = pickDiscoveryProbeOpener(i);
      seen.add(opener);
      if (prev !== null) {
        expect(opener, `turn ${i} matched turn ${i - 1} (${prev})`).not.toBe(prev);
      }
      prev = opener;
    }
    /* Across 8 turns we must have hit every opener variant in the set. */
    expect(seen.size).toBe(DISCOVERY_PROBE_OPENERS.length);
  });

  it("no two consecutive openers identical over a 4-probe sequence", () => {
    const seq = [0, 1, 2, 3].map(pickDiscoveryProbeOpener);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i], `consecutive at turn ${i}`).not.toBe(seq[i - 1]);
    }
  });
});

describe("smoke — 4-probe sequence respects all rules (Bug 1, salaryNegE2eSmoke companion)", () => {
  it("4 simulated probes produce no >cap idiom counts, no declarative+? mismatches, no two consecutive identical openers", () => {
    /* Simulate four candidate restyles a well-behaved LLM might emit
     * after the prompt-side fix lands. We assert each passes
     * validateRestyle AND that openers differ turn-to-turn. */
    /* Turn-0 style canonical without an ack-vocab lead — exercises the
     * pure question-shape side of the validator without the ack-prefix
     * preservation rule firing on every variant. */
    const canonical = "What's the total CTC at present?";
    const fourTurns = [
      "So, what's the current CTC right now?",
      "Quick one — what's your current CTC?",
      "What's the current package today?",
      "Walking through current side: what's the CTC at present?",
    ];
    for (const r of fourTurns) {
      const v = validateRestyle(canonical, r, mkState());
      expect(v.valid, `restyle "${r}" reason=${v.reason}`).toBe(true);
    }
    /* No two consecutive openers identical (compare leading words up
     * to first comma/dash/space-run). */
    const leads = fourTurns.map((s) => s.split(/[,—-]/)[0].trim());
    for (let i = 1; i < leads.length; i++) {
      expect(leads[i]).not.toBe(leads[i - 1]);
    }
  });
});
