import { describe, it, expect } from "vitest";
import {
  extractDecisionDeadline,
  mergeDecisionDeadline,
} from "../../server-handlers/_decision-deadline";

describe("extractDecisionDeadline — deadline days", () => {
  it("parses 'in 3 days'", () => {
    expect(extractDecisionDeadline("I need to respond in 3 days").deadlineDays).toBe(3);
  });

  it("parses 'within 48 hours' as 2 days", () => {
    expect(extractDecisionDeadline("respond within 48 hours").deadlineDays).toBe(2);
  });

  it("parses '24 hours' as 1 day", () => {
    expect(extractDecisionDeadline("decision in 24 hours").deadlineDays).toBe(1);
  });

  it("parses 'by EOD' as 0", () => {
    expect(extractDecisionDeadline("need answer by EOD").deadlineDays).toBe(0);
  });

  it("parses 'by Friday'", () => {
    expect(extractDecisionDeadline("respond by Friday").deadlineDays).toBe(4);
  });

  it("parses '1 week'", () => {
    expect(extractDecisionDeadline("within 1 week").deadlineDays).toBe(7);
  });

  it("rejects out-of-range deadline", () => {
    expect(extractDecisionDeadline("respond in 90 days").deadlineDays).toBe(null);
  });
});

describe("extractDecisionDeadline — explicit flag", () => {
  it("fires on 'deadline'", () => {
    expect(extractDecisionDeadline("the deadline is approaching").deadlineExplicit).toBe(true);
  });

  it("fires on 'offer expires'", () => {
    expect(extractDecisionDeadline("the offer expires tomorrow").deadlineExplicit).toBe(true);
  });

  it("fires when day count present", () => {
    expect(extractDecisionDeadline("in 3 days").deadlineExplicit).toBe(true);
  });

  it("false when unrelated", () => {
    expect(extractDecisionDeadline("hello").deadlineExplicit).toBe(false);
  });
});

describe("extractDecisionDeadline — conditional accept", () => {
  it("fires on 'if you match X, I'll sign'", () => {
    const r = extractDecisionDeadline("if you match 30 LPA, I'll sign today");
    expect(r.conditionalAcceptance).toBe(true);
    expect(r.conditionalEvidence).toContain("sign");
  });

  it("fires on 'provided you cover buyout, I'm in'", () => {
    expect(extractDecisionDeadline("provided you cover the buyout, I'm in").conditionalAcceptance).toBe(true);
  });

  it("does NOT fire on unconditional accept", () => {
    expect(extractDecisionDeadline("I'll sign today").conditionalAcceptance).toBe(false);
  });

  it("does NOT fire on conditional without commitment", () => {
    expect(extractDecisionDeadline("if you match 30 LPA, can we discuss?").conditionalAcceptance).toBe(false);
  });

  /* Soft-commit idioms (live-staging 2026-06-19, Razorpay PM #94). These
   * are the most common Indian-candidate phrasings for "yes, on that
   * condition" and were previously invisible — the bot kept arguing the
   * stale opening anchor instead of engaging the concrete number. */
  it("fires on 'if you can do X, that works for me'", () => {
    const r = extractDecisionDeadline("if you can do 36 with a 3 lakh joining bonus, that works for me");
    expect(r.conditionalAcceptance).toBe(true);
    expect(r.conditionalEvidence).toContain("works");
  });

  it("fires on 'when you confirm X, that's acceptable'", () => {
    expect(extractDecisionDeadline("when you confirm the band, that's acceptable").conditionalAcceptance).toBe(true);
  });

  it("fires on 'if you stretch to X, I can make that work'", () => {
    expect(extractDecisionDeadline("if you stretch to 38, I can make that work").conditionalAcceptance).toBe(true);
  });

  it("fires on 'as long as you do X, I'd take that'", () => {
    expect(extractDecisionDeadline("as long as you cover relocation, I'd take that").conditionalAcceptance).toBe(true);
  });

  it("does NOT fire on bare 'that works for me' with no condition", () => {
    expect(extractDecisionDeadline("38 works for me").conditionalAcceptance).toBe(false);
  });
});

describe("extractDecisionDeadline — hasAny + empty", () => {
  it("false on empty", () => {
    expect(extractDecisionDeadline("").hasAny).toBe(false);
  });

  it("true when any field set", () => {
    expect(extractDecisionDeadline("by Friday").hasAny).toBe(true);
  });
});

describe("mergeDecisionDeadline", () => {
  it("shorter deadline wins", () => {
    const prior = extractDecisionDeadline("respond in 5 days");
    const next = extractDecisionDeadline("respond in 2 days");
    expect(mergeDecisionDeadline(prior, next).deadlineDays).toBe(2);
  });

  it("null preserves prior deadline", () => {
    const prior = extractDecisionDeadline("respond in 5 days");
    const next = extractDecisionDeadline("hello");
    expect(mergeDecisionDeadline(prior, next).deadlineDays).toBe(5);
  });

  it("explicit flag monotone-up", () => {
    const prior = extractDecisionDeadline("the deadline is approaching");
    const next = extractDecisionDeadline("hello");
    expect(mergeDecisionDeadline(prior, next).deadlineExplicit).toBe(true);
  });

  it("conditional is last-stated-wins (can withdraw)", () => {
    const prior = extractDecisionDeadline("if you match 30 LPA, I'll sign");
    const next = extractDecisionDeadline("hello");
    expect(mergeDecisionDeadline(prior, next).conditionalAcceptance).toBe(false);
  });

  it("handles null prior", () => {
    expect(mergeDecisionDeadline(null, extractDecisionDeadline("by Friday")).deadlineDays).toBe(4);
  });
});

/* PRI-64 (2026-06-26, offline adversarial sweep). Conditional acceptance must
 * fire on two clause-less forms the original "if/when … commit" matcher missed:
 *   (a) imperative-grant — "Add a joining bonus and I'll sign" (no "if")
 *   (b) Hinglish "toh <commit>" — "joining bonus mile toh done"
 * Both route to the planner's conditional-close gate, which grants the
 * sweetener and closes. Missing them left the bot exploring levers forever.
 * The refusal/ultimatum guard is load-bearing: "Add a joining bonus or no deal"
 * must stay OUT — a FALSE-CLOSE (bot signs on a threat) is the worst outcome,
 * and COMMITMENT_IDIOM's `deal\b` would otherwise match "no deal". */
describe("extractDecisionDeadline — PRI-64 clause-less conditional accepts", () => {
  const accepts = [
    "Add a joining bonus and I'll sign.",
    "throw in relocation and I'm in",
    "Include the ESOP refresh and we have a deal.",
    "give me a signing bonus and count me in",
    "joining bonus mile toh done",
    "thoda bonus de do toh pakka",
    "agar joining bonus mil jaye to theek hai",
  ];
  for (const s of accepts) {
    it(`detects conditional accept: "${s}"`, () => {
      expect(extractDecisionDeadline(s).conditionalAcceptance).toBe(true);
    });
  }

  const nonAccepts = [
    "Add a joining bonus or no deal.",
    "Either you add a joining bonus or it's no deal.",
    "Unless you add a joining bonus, no deal.",
    "Add a joining bonus, otherwise I'm not signing.",
    "joining bonus nahi mile toh no deal",
    "Can you add a joining bonus?",
    "What's the joining bonus policy?",
    "Add me to the team and we're good.", // grant verb, no sweetener noun
    "If you can't add a joining bonus I'll walk.",
  ];
  for (const s of nonAccepts) {
    it(`does NOT false-detect: "${s}"`, () => {
      expect(extractDecisionDeadline(s).conditionalAcceptance).toBe(false);
    });
  }

  it("still detects the classic if-clause form", () => {
    expect(extractDecisionDeadline("if you match 30 LPA, I'll sign").conditionalAcceptance).toBe(true);
  });
});
