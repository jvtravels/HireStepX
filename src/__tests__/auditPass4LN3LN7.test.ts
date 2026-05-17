/* LN3-LN7 / Audit Pass 4 (PDF#27, 2026-05-17) — polish bundle.
 *
 * Five validator additions:
 *   LN3 — mixed-dash-style (em-dash for prose, en-dash for numeric range)
 *   LN4 — sentence-too-long (>30 words/sentence, >25 avg)
 *   LN5 — inconsistent-component-phrasing
 *   LN6 — pronoun-drift (I + we without company-position cue)
 *   LN7 — strip curly quotes (silent normalization, NOT a rejection)
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  validateRestyle,
  stripCurlyQuotes,
} from "../../server-handlers/_response-pipeline";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return initState({ sessionId: "ln3-7", role: "swe", company: "acme", band: BAND });
}

const ACTION: NextAction = {
  kind: "counter-offer",
  counterTotalLpa: 26,
} as NextAction;

describe("LN3 — mixed-dash-style", () => {
  const CANONICAL = "We can revise the fitment to 26 LPA total \u2014 how does that look?";

  it("rejects en-dash in prose context when em-dash also present", () => {
    const bad = "We can revise the fitment \u2014 to 26 LPA total \u2013 mostly fixed.";
    const r = validateRestyle(CANONICAL, bad, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("mixed-dash-style");
  });

  it("allows en-dash in numeric range (20–25 LPA)", () => {
    /* canonical also carries the range numbers so subset check passes */
    const canonical = "We can revise the fitment to 20\u201325 LPA total \u2014 mostly fixed.";
    const ok = "We can revise the fitment to 20\u201325 LPA total \u2014 how does that land?";
    const r = validateRestyle(canonical, ok, mkState(), ACTION);
    expect(r.valid).toBe(true);
  });
});

describe("LN4 — sentence-too-long", () => {
  const CANONICAL = "We can revise the fitment to 26 LPA total.";

  it("rejects when a single sentence exceeds 30 words", () => {
    const long =
      "We can revise the fitment to 26 LPA total considering all the factors that we have discussed including market conditions and your seniority and the current band caps that our finance team has put in place for this quarter.";
    const r = validateRestyle(CANONICAL, long, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("sentence-too-long");
  });

  it("rejects when average across sentences exceeds 25 words", () => {
    const longish =
      "We can revise the fitment to 26 LPA total considering the various factors that we have discussed at length including market conditions and seniority. " +
      "This is one of many possible structures that we are willing to explore given the alignment we are seeing between your profile and the role expectations on our side.";
    const r = validateRestyle(CANONICAL, longish, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("sentence-too-long");
  });

  it("allows short crisp sentences", () => {
    const ok = "We can revise the fitment to 26 LPA total. How does that look?";
    const r = validateRestyle(CANONICAL, ok, mkState(), ACTION);
    expect(r.valid).toBe(true);
  });
});

describe("LN5 — inconsistent-component-phrasing", () => {
  const CANONICAL = "We can revise the fitment to 26 LPA total.";

  it("rejects 'fixed and variable elements'", () => {
    const bad = "We can revise the fixed and variable elements to 26 LPA total.";
    const r = validateRestyle(CANONICAL, bad, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("inconsistent-component-phrasing");
  });

  it("rejects 'fixed and variable parts'", () => {
    const bad = "We can adjust the fixed and variable parts to land at 26 LPA total.";
    const r = validateRestyle(CANONICAL, bad, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("inconsistent-component-phrasing");
  });

  it("rejects 'compensation elements'", () => {
    const bad = "We can tune the compensation elements to 26 LPA total.";
    const r = validateRestyle(CANONICAL, bad, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("inconsistent-component-phrasing");
  });
});

describe("LN6 — pronoun-drift", () => {
  const CANONICAL = "I can revise the fitment to 26 LPA total.";

  it("rejects when 'I' and personal 'we' coexist (no company cue)", () => {
    const bad = "I think we should look at 26 LPA total, and we are quite excited.";
    const r = validateRestyle(CANONICAL, bad, mkState(), ACTION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("pronoun-drift");
  });

  it("allows 'I' with company-position 'we offer' / 'our band'", () => {
    const ok = "I can confirm we offer 26 LPA total within our band.";
    const r = validateRestyle(CANONICAL, ok, mkState(), ACTION);
    expect(r.valid).toBe(true);
  });

  it("allows single-pronoun utterances", () => {
    const ok = "I can revise the fitment to 26 LPA total.";
    const r = validateRestyle(CANONICAL, ok, mkState(), ACTION);
    expect(r.valid).toBe(true);
  });
});

describe("LN7 — stripCurlyQuotes (silent normalization)", () => {
  it("converts curly single quotes to straight", () => {
    expect(stripCurlyQuotes("we\u2019re excited")).toBe("we're excited");
  });

  it("converts curly double quotes to straight", () => {
    expect(stripCurlyQuotes("\u201Cthank you\u201D")).toBe('"thank you"');
  });

  it("leaves straight quotes untouched", () => {
    expect(stripCurlyQuotes("it's fine")).toBe("it's fine");
  });
});
