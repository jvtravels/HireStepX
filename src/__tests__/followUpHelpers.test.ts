import { describe, it, expect } from "vitest";
import {
  detectCandidateIntent,
  extractCandidateSalaryNumber,
  truncateConversationHistory,
  detectSalaryPhase,
  pickServerCounter,
  pickNextMove,
  extractMirrorTokens,
  isBreakdownAsk,
  normalizeForDuplicate,
  isDuplicateOfRecent,
  composeDuplicateReplyRescue,
  sanitizeBehaviouralRegister,
} from "../../server-handlers/_follow-up-helpers";

/**
 * follow-up.ts is 697 lines and was entirely uncovered. The two highest-
 * risk pieces are intent detection (wrong banner → LLM gets wrong
 * instructions → catastrophic prompt misbehaviour) and salary-number
 * extraction (wrong number mirrored back to candidate → trust collapse).
 *
 * Both are regex-driven and have many edge cases — this test file pins
 * the behaviour so a regex tweak can't silently break the salary-
 * negotiation interview without turning CI red.
 */

describe("detectCandidateIntent", () => {
  it("empty input → all flags false", () => {
    const r = detectCandidateIntent("");
    expect(r).toEqual({
      accepted: false, conditionalAccept: false, rejected: false,
      walkAway: false, deflected: false, needsTime: false, mentionedCompeting: false,
    });
  });

  describe("acceptance", () => {
    it("clear 'I accept' wins", () => {
      expect(detectCandidateIntent("I accept the offer").accepted).toBe(true);
    });

    it("short affirmative ('yes', 'okay', 'sure') counts as acceptance", () => {
      expect(detectCandidateIntent("yes").accepted).toBe(true);
      expect(detectCandidateIntent("okay sounds good").accepted).toBe(true);
      expect(detectCandidateIntent("sure").accepted).toBe(true);
      expect(detectCandidateIntent("deal").accepted).toBe(true);
    });

    it("long answer that happens to start with 'yes' is NOT a short affirmative", () => {
      const r = detectCandidateIntent("yes but I have several concerns about the equity component and the learning budget and also the base salary figure");
      expect(r.accepted).toBe(false);
    });

    it("hedge after accept → conditional acceptance (still accepted=true)", () => {
      const r = detectCandidateIntent("I accept the offer but I'd like to discuss equity");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });

    it("hedge AFTER accept that contains a rejection → rejection wins (accepted=false)", () => {
      const r = detectCandidateIntent("I accept the offer but it's too low to take seriously");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });

    it("'that works for me' is acceptance", () => {
      expect(detectCandidateIntent("that works for me").accepted).toBe(true);
    });
  });

  describe("rejection", () => {
    it("'too low' is a rejection", () => {
      const r = detectCandidateIntent("that's too low for my experience level");
      expect(r.rejected).toBe(true);
      expect(r.accepted).toBe(false);
    });

    it("'not acceptable' is a rejection", () => {
      expect(detectCandidateIntent("this offer is not acceptable").rejected).toBe(true);
    });

    it("'can't accept' is a rejection", () => {
      expect(detectCandidateIntent("I can't accept at this number").rejected).toBe(true);
    });

    it("acceptance beats raw rejection keyword absence", () => {
      const r = detectCandidateIntent("I accept, this sounds fair");
      expect(r.accepted).toBe(true);
      expect(r.rejected).toBe(false);
    });

    /* The user-reported bug — "No, I would like to stick with 26 lakhs
       per annum" was being classified as not-rejected, which let the
       AI glide into closing language. Lock this regression in. */
    it("'stick with N lakhs' is a rejection (Bug B fix)", () => {
      const r = detectCandidateIntent("No, I would like to stick with 26 lakhs per annum");
      expect(r.rejected).toBe(true);
      expect(r.accepted).toBe(false);
    });

    it("'holding at N LPA' is a rejection", () => {
      expect(detectCandidateIntent("I'm holding firm at 30 LPA").rejected).toBe(true);
    });

    it("'won't go below N' is a rejection", () => {
      expect(detectCandidateIntent("I won't go below 28 lakhs").rejected).toBe(true);
    });

    it("'staying at N LPA' is a rejection", () => {
      expect(detectCandidateIntent("I'd be staying at 32 LPA — that's my floor").rejected).toBe(true);
    });

    it("benign 'stick with the team' is NOT a rejection (no number near lock verb)", () => {
      const r = detectCandidateIntent("I'd love to stick with the team I have today");
      expect(r.rejected).toBe(false);
    });
  });

  describe("walkAway", () => {
    it("'walk away' flags walkAway", () => {
      const r = detectCandidateIntent("I need to walk away from this");
      expect(r.walkAway).toBe(true);
    });

    it("'I decline' flags walkAway", () => {
      expect(detectCandidateIntent("I decline the offer at this point").walkAway).toBe(true);
    });

    it("walkAway phrase with explicit acceptance present does NOT flag walkAway", () => {
      // Defensive: "not interested" is also a walkAway phrase, but if they
      // also said "I accept" we treat as accepted.
      const r = detectCandidateIntent("I accept the offer, I'm not interested in negotiating further");
      expect(r.accepted).toBe(true);
      expect(r.walkAway).toBe(false);
    });

    it("S77-B3: 'not interested in the variable component' must NOT set walkAway (component preference)", () => {
      const r = detectCandidateIntent("I'm not interested in the variable component, I prefer all-fixed");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
    it("S77-B3: 'not interested in equity' must NOT set walkAway", () => {
      const r = detectCandidateIntent("I'm not interested in equity, just raise the base");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
    it("S77-B3: 'not interested in this role' IS a walk-away (job noun)", () => {
      expect(detectCandidateIntent("I'm not interested in this role anymore.").walkAway).toBe(true);
    });
    it("S78-B1: 'Let's move on to the equity discussion' must NOT set walkAway (topic redirect)", () => {
      expect(detectCandidateIntent("Let's move on to the equity discussion.").walkAway).toBe(false);
    });
    it("S78-B1: 'Can we move on to sign-on bonus?' must NOT set walkAway (topic redirect)", () => {
      expect(detectCandidateIntent("Can we move on to sign-on bonus?").walkAway).toBe(false);
    });
    it("S78-B1: 'I'll move on if you can't improve' IS a walk-away (first-person departure)", () => {
      expect(detectCandidateIntent("I'll move on if you can't improve the offer.").walkAway).toBe(true);
    });
    it("S78-B1: 'I'd rather move on from this' IS a walk-away (first-person departure)", () => {
      expect(detectCandidateIntent("I'd rather move on from this.").walkAway).toBe(true);
    });
  });

  describe("deflection", () => {
    it("'what's your offer' flags deflected", () => {
      expect(detectCandidateIntent("what's your offer first?").deflected).toBe(true);
    });

    it("'you tell me' flags deflected", () => {
      expect(detectCandidateIntent("you tell me what you can do").deflected).toBe(true);
    });

    it("'prefer not to share' flags deflected", () => {
      expect(detectCandidateIntent("I'd prefer not to share a specific number").deflected).toBe(true);
    });
  });

  describe("needsTime", () => {
    it("'need time' flags needsTime", () => {
      expect(detectCandidateIntent("I need time to think this over").needsTime).toBe(true);
    });

    it("'talk to my family' flags needsTime", () => {
      expect(detectCandidateIntent("I'd like to talk to my family first").needsTime).toBe(true);
    });

    it("needsTime is SUPPRESSED when a concrete number is present (that's a counter)", () => {
      // "consider 30 LPA" contains "consider" (a think-word) AND a number
      // — semantically this is a counter, not a time-to-think request.
      const r = detectCandidateIntent("could you consider 30 LPA instead?");
      expect(r.needsTime).toBe(false);
    });
  });

  describe("competingOffers", () => {
    it("'other offer' flags mentionedCompeting", () => {
      // Uses "other offer" as a standalone phrase (not "another" which is
      // a separate word and does not trigger the regex — documented here
      // so a future maintainer doesn't "fix" the regex to match "another"
      // too aggressively).
      expect(detectCandidateIntent("I have an other offer on the table").mentionedCompeting).toBe(true);
      expect(detectCandidateIntent("I got an offer from Google").mentionedCompeting).toBe(true);
    });

    it("'counter-offer' flags mentionedCompeting", () => {
      expect(detectCandidateIntent("I got a counter-offer from my current employer").mentionedCompeting).toBe(true);
    });
  });
});

describe("extractCandidateSalaryNumber", () => {
  it("empty input → null", () => {
    expect(extractCandidateSalaryNumber("")).toBe(null);
    expect(extractCandidateSalaryNumber("   ")).toBe(null);
  });

  it("plain answer with no number → null", () => {
    expect(extractCandidateSalaryNumber("I need to think about it")).toBe(null);
  });

  it("single LPA number → returns it", () => {
    expect(extractCandidateSalaryNumber("I'm expecting 30 LPA")).toBe("30");
    expect(extractCandidateSalaryNumber("looking for 45 lakh")).toBe("45");
    expect(extractCandidateSalaryNumber("targeting 22.5 LPA")).toBe("22.5");
  });

  it("[fixture: Flipkart in-hand-vs-target] competing offer is NOT pulled as candidate target", () => {
    /* Flipkart UX session bug: candidate said "I have an offer of 68
       LPA in hand, my target is 70 LPA" and the AI echoed ₹68 as their
       number — anchoring the counter below the candidate's actual ask.
       Now: in-hand-offer numbers are filtered out; the latest target-
       prefixed number wins. */
    expect(
      extractCandidateSalaryNumber("I have an offer of 68 LPA in hand from another company. My target is 70 LPA."),
    ).toBe("70");
  });

  it("multiple target-prefixed numbers → latest wins (downward revision)", () => {
    /* "I want 30, actually let me say I'd like 25" used to return 30
       because the previous targetRe match was first-only. */
    expect(
      extractCandidateSalaryNumber("I want 30 LPA. Actually, let me say I'd like 25 LPA — that works for me."),
    ).toBe("25");
  });

  it("rupee symbol + LPA works", () => {
    expect(extractCandidateSalaryNumber("I want ₹35 LPA")).toBe("35");
  });

  it("target-phrase number wins over plain number list", () => {
    // Two numbers: 20 (CTC) and 35 (target with "expecting"). Should pick 35.
    expect(extractCandidateSalaryNumber("currently 20 LPA, expecting 35 LPA")).toBe("35");
  });

  it("when first number is CTC and multiple numbers exist, use the last", () => {
    // "currently at X" and Y — pick Y as the ask
    expect(extractCandidateSalaryNumber("I'm currently at 25 LPA and want 40 LPA")).toBe("40");
  });

  it("when only one LPA number exists, return it even if a CTC phrase is nearby", () => {
    expect(extractCandidateSalaryNumber("currently drawing 25 LPA")).toBe("25");
  });

  it("bare-number fallback with ask-intent word, within salary-plausible range", () => {
    // No LPA suffix, but "need 30" in context → 30
    expect(extractCandidateSalaryNumber("I need 30")).toBe("30");
    expect(extractCandidateSalaryNumber("looking for around 45")).toBe("45");
  });

  it("bare-number OUTSIDE salary-plausible range (3..200) is ignored", () => {
    // "need 500" — too high to be LPA salary, return null
    expect(extractCandidateSalaryNumber("I need 500 for my car payment")).toBe(null);
    // "need 2" — too low, return null
    expect(extractCandidateSalaryNumber("I need 2 days to decide")).toBe(null);
  });

  it("ignores unrelated numbers not near salary-asking context", () => {
    expect(extractCandidateSalaryNumber("I have 5 years of experience")).toBe(null);
  });

  it("handles multiple LPA numbers and picks the target-tagged one", () => {
    // Three numbers — pick the one with the target phrase
    const r = extractCandidateSalaryNumber("I'm at 20 LPA, friends earn 25 LPA, I'm asking for 35 LPA");
    expect(r).toBe("35");
  });
});

describe("truncateConversationHistory", () => {
  it("empty input → empty string", () => {
    expect(truncateConversationHistory("", 100)).toBe("");
  });

  it("under budget → returns unchanged", () => {
    const short = "A short history";
    expect(truncateConversationHistory(short, 100)).toBe(short);
  });

  it("over budget → truncates with a visible marker", () => {
    const long = "x".repeat(1000);
    const out = truncateConversationHistory(long, 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.startsWith("…[earlier turns truncated]")).toBe(true);
  });

  it("preserves the tail (most recent turns) not the head", () => {
    const history = "OLD TURN\n" + "middle ".repeat(100) + "MOST_RECENT_TURN";
    const out = truncateConversationHistory(history, 200);
    expect(out).toContain("MOST_RECENT_TURN");
    expect(out).not.toContain("OLD TURN");
  });
});

describe("detectSalaryPhase", () => {
  it("explicit phase override wins", () => {
    expect(
      detectSalaryPhase({ negotiationPhase: "benefits-discussion", questionIndex: 0 }),
    ).toBe("benefits-discussion");
  });

  it("acceptance jumps to closing regardless of index", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        totalQuestions: 6,
        facts: { acceptedImmediately: true },
      }),
    ).toBe("closing");
  });

  it("walk-away language triggers closing-pressure (retention)", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 2,
        answer: "I'm not interested at this number, I'll have to pass.",
      }),
    ).toBe("closing-pressure");
  });

  /* ─── Premature-close guard regression tests ─── */

  it("[fixture: TCS-style premature close] late turns without counter → probe, not closing", () => {
    /* Bug source: TCS UI/UX Designer session — recruiter wrapped up
       at idx=5/6 even though the candidate never made a counter.
       Engine now routes to probe-expectations until a number lands. */
    expect(
      detectSalaryPhase({
        questionIndex: 5,
        totalQuestions: 6,
        facts: { candidateCounter: null, hasCompetingOffers: false },
      }),
    ).toBe("probe-expectations");
  });

  it("late turns WITH counter stay in counter-offer (the earlier counter-offer rule wins)", () => {
    /* Once a counter is on the table (idx≥2), the AI keeps countering
       until the candidate accepts. Closing only fires on acceptance —
       deliberate, to prevent the "wrap up without resolution" failure. */
    expect(
      detectSalaryPhase({
        questionIndex: 5,
        totalQuestions: 6,
        facts: { candidateCounter: "₹25 LPA" },
      }),
    ).toBe("counter-offer");
  });

  it("70% progress without counter → probe-expectations", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 5,
        totalQuestions: 7, // 5/7 ≈ 0.71
        facts: { candidateCounter: null },
      }),
    ).toBe("probe-expectations");
  });

  it("idx>=2 with counter → counter-offer phase", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 2,
        totalQuestions: 6,
        facts: { candidateCounter: "₹30 LPA" },
      }),
    ).toBe("counter-offer");
  });

  it("competing offers without counter early → probe-expectations", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        totalQuestions: 6,
        facts: { hasCompetingOffers: true, candidateCounter: null },
      }),
    ).toBe("probe-expectations");
  });

  it("idx=0 default → offer-reaction", () => {
    expect(detectSalaryPhase({ questionIndex: 0, totalQuestions: 6 })).toBe("offer-reaction");
  });

  it("end-of-session without counter does NOT close (don't fabricate a deal)", () => {
    /* Critical regression — idx=total used to flow into the index
       fallback's plain `return "closing"`. Now the
       progressRatio≥0.7 && !hasCounter branch wins first. */
    const result = detectSalaryPhase({
      questionIndex: 6,
      totalQuestions: 6,
      facts: { candidateCounter: null },
    });
    expect(result).not.toBe("closing");
    expect(result).not.toBe("closing-pressure");
  });
});

describe("pickServerCounter", () => {
  const band = { initialOffer: 20, maxStretch: 30, walkAway: 18 };

  it("counter-offer phase: splits floor and aspiration", () => {
    expect(
      pickServerCounter({
        phase: "counter-offer",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBe(24); // 20 + (28-20)*0.5
  });

  it("closing-pressure pushes 70% toward aspiration", () => {
    expect(
      pickServerCounter({
        phase: "closing-pressure",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBe(25.6); // 20 + (28-20)*0.7
  });

  it("caps aspiration at maxStretch when candidate target exceeds band", () => {
    expect(
      pickServerCounter({
        phase: "counter-offer",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 50, // way above maxStretch 30
      }),
    ).toBe(25); // 20 + (30-20)*0.5
  });

  it("returns null for probe-expectations (no offer this turn)", () => {
    expect(
      pickServerCounter({
        phase: "probe-expectations",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBeNull();
  });

  it("returns null for benefits-discussion", () => {
    expect(
      pickServerCounter({
        phase: "benefits-discussion",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBeNull();
  });

  it("returns null when aspiration ≤ floor (no room to move)", () => {
    expect(
      pickServerCounter({
        phase: "counter-offer",
        ...band,
        highestOfferMade: 28,
        candidateTarget: 25, // candidate asks BELOW current offer
      }),
    ).toBeNull();
  });

  it("never goes backwards from highestOfferMade (monotonic)", () => {
    const next = pickServerCounter({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 25,
      candidateTarget: 30,
    });
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThanOrEqual(25);
  });

  it("never exceeds maxStretch even at closing-pressure", () => {
    const next = pickServerCounter({
      phase: "closing-pressure",
      initialOffer: 25,
      maxStretch: 30,
      walkAway: 22,
      highestOfferMade: 28,
      candidateTarget: 100,
    });
    expect(next!).toBeLessThanOrEqual(30);
  });

  it("offer-reaction returns the initial offer", () => {
    expect(
      pickServerCounter({
        phase: "offer-reaction",
        ...band,
        candidateTarget: 28,
      }),
    ).toBe(20);
  });
});

describe("extractMirrorTokens", () => {
  it("returns [] for short answers", () => {
    expect(extractMirrorTokens("Yes")).toEqual([]);
    expect(extractMirrorTokens("ok thanks")).toEqual([]);
  });

  it("scrubs first-name-shaped tokens (single mention, always capitalized)", () => {
    const tokens = extractMirrorTokens(
      "I worked with Sarah on the migration project at our last team and we shipped it in two weeks together."
    );
    expect(tokens.map(t => t.toLowerCase())).not.toContain("sarah");
  });

  it("preserves tokens with internal capitals (PhonePe, OpenAI)", () => {
    const tokens = extractMirrorTokens(
      "I shipped a feature for PhonePe last quarter and it lifted activation across the team in two weeks."
    );
    expect(tokens.map(t => t.toLowerCase())).toContain("phonepe");
  });

  it("preserves company-suffix tokens (-ai, -labs, -tech)", () => {
    const tokens = extractMirrorTokens(
      "I built integrations for Spendly at our last team and partnered closely with Mindlabs on the rollout."
    );
    // "Mindlabs" should survive because of the -labs suffix even though it's
    // single-mention, capitalized, not in any allowlist.
    expect(tokens.map(t => t.toLowerCase())).toContain("mindlabs");
  });

  it("preserves casing in 'the X' phrases (the Migration Project)", () => {
    const tokens = extractMirrorTokens(
      "I led the Migration Project across our last team and shipped it before the holiday rush in just two weeks."
    );
    const hasTitleCasePhrase = tokens.some(t => /^the Migration/i.test(t) && t.includes("Migration"));
    expect(hasTitleCasePhrase).toBe(true);
  });

  it("keeps allowlist tech terms (Stripe) on a single mention", () => {
    const tokens = extractMirrorTokens(
      "We integrated Stripe at our last team and shipped the checkout in just two weeks across regions."
    );
    expect(tokens.map(t => t.toLowerCase())).toContain("stripe");
  });
});

describe("isBreakdownAsk", () => {
  // These are the EXACT candidate messages from Hirestepx Bugs (3).pdf
  // that the LLM deflected on instead of setting wantsBreakdown=true.
  // Every one of these MUST trigger the server-side rescue.
  it("[fixture: Bugs 3 T2] catches 'Can you just give me a breakdown on this 27 lakhs?'", () => {
    expect(isBreakdownAsk("Be with this offer. Can you just give me a breakdown on this 27 lakhs?")).toBe(true);
  });
  it("[fixture: Bugs 3 T3] catches 'All the parts, a complete breakdown of the CTC'", () => {
    expect(isBreakdownAsk("Doctor Pepper. All the parts, a complete breakdown of the CTC.")).toBe(true);
  });
  it("[fixture: Bugs 3 T4] catches 'let me know the base salary?'", () => {
    expect(isBreakdownAsk("Two Gae, you let me know the base salary?")).toBe(true);
  });
  it("[fixture: Bugs 3 T5] catches 'I want to know more about base salary.'", () => {
    expect(isBreakdownAsk("I want to know more about base salary.")).toBe(true);
  });

  it("catches single-component asks for variable/joining/PF too", () => {
    expect(isBreakdownAsk("What's the variable component?")).toBe(true);
    expect(isBreakdownAsk("How much is the joining bonus?")).toBe(true);
    expect(isBreakdownAsk("Tell me about the provident fund.")).toBe(true);
  });

  it("returns false for unrelated answers", () => {
    expect(isBreakdownAsk("Sounds good, I'll take it.")).toBe(false);
    expect(isBreakdownAsk("I'll think about it and get back to you.")).toBe(false);
    expect(isBreakdownAsk("")).toBe(false);
  });
});

describe("normalizeForDuplicate", () => {
  it("lowercases, collapses whitespace, strips terminal punctuation", () => {
    expect(normalizeForDuplicate("Hello, World!")).toBe("hello world");
    expect(normalizeForDuplicate("Hello,   world.")).toBe("hello world");
    expect(normalizeForDuplicate("HELLO — WORLD")).toBe("hello world");
  });
  it("treats nbsp like normal whitespace", () => {
    expect(normalizeForDuplicate("a\u00a0b\u00a0c")).toBe("a b c");
  });
  it("handles empty / null-ish", () => {
    expect(normalizeForDuplicate("")).toBe("");
    expect(normalizeForDuplicate("   ")).toBe("");
  });
});

describe("isDuplicateOfRecent", () => {
  const longA = "I hear you on wanting more — let me be upfront, the band for this role caps where I've already offered, and stretching further would require a different headcount slot than the one I have approval for today.";
  const longB = "Totally fair to push back. Here's where I can move: I can stretch joining bonus and notice flexibility, but the recurring base is at the top of the band I'm authorized to commit to in this round.";
  it("returns false when prev is empty / undefined", () => {
    expect(isDuplicateOfRecent(longA, [])).toBe(false);
    expect(isDuplicateOfRecent(longA, undefined)).toBe(false);
    expect(isDuplicateOfRecent(longA, null)).toBe(false);
  });
  it("returns false for short replies even if they match", () => {
    expect(isDuplicateOfRecent("Got it, thanks.", ["Got it, thanks."])).toBe(false);
  });
  it("returns true for verbatim long match", () => {
    expect(isDuplicateOfRecent(longA, [longB, longA])).toBe(true);
  });
  it("returns true for case / whitespace / punctuation differences only", () => {
    const variant = "  I HEAR you on wanting more — let me be upfront, the band  for this role caps where I've already offered, and stretching further would require a different headcount slot than the one I have approval for today!  ";
    expect(isDuplicateOfRecent(variant, [longA])).toBe(true);
  });
  it("returns false when content actually differs", () => {
    expect(isDuplicateOfRecent(longA, [longB])).toBe(false);
  });
});

describe("composeDuplicateReplyRescue", () => {
  it("forward counter when there is headroom between offer and ceiling", () => {
    // offer 24, stretch 30 → next = 24 + 0.6*6 = 27.6
    const out = composeDuplicateReplyRescue({ highestOfferMade: 24, maxStretch: 30 });
    expect(out).toContain("circles");
    expect(out).toContain("₹27.6 LPA");
    expect(out).toContain("lever");
  });
  it("clamps the forward counter at maxStretch", () => {
    // offer 29.5, stretch 30 → next would be 29.5 + 0.6*0.5 = 29.8 ≤ 30
    const out = composeDuplicateReplyRescue({ highestOfferMade: 29.5, maxStretch: 30 });
    expect(out).toMatch(/₹\d+(?:\.\d+)?\s+LPA/);
    const m = out.match(/₹(\d+(?:\.\d+)?)\s+LPA/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(30);
  });
  it("calls the question when offer is already at/above ceiling", () => {
    const out = composeDuplicateReplyRescue({ highestOfferMade: 30, maxStretch: 30 });
    expect(out).not.toMatch(/₹\d/);
    expect(out).toMatch(/top of the band|pause|move you to yes/i);
  });
  it("falls back to lever-pointing prose when offer or ceiling missing", () => {
    const noOffer = composeDuplicateReplyRescue({ highestOfferMade: null, maxStretch: 30 });
    expect(noOffer).not.toMatch(/₹\d/);
    expect(noOffer).toMatch(/lever/i);
    const noStretch = composeDuplicateReplyRescue({ highestOfferMade: 24, maxStretch: null });
    expect(noStretch).not.toMatch(/₹\d/);
    expect(noStretch).toMatch(/lever/i);
  });
  it("rejects non-finite / non-positive inputs gracefully", () => {
    const out = composeDuplicateReplyRescue({ highestOfferMade: NaN, maxStretch: -5 });
    expect(out).not.toMatch(/₹/);
    expect(out).toMatch(/lever/i);
  });
});

describe("pickNextMove", () => {
  const band = { initialOffer: 20, maxStretch: 30, walkAway: 18 };

  it("acceptance → close-acceptance, recap last offer", () => {
    const m = pickNextMove({
      phase: "closing",
      ...band,
      highestOfferMade: 25,
      candidateTarget: 28,
      isAccepted: true,
    });
    expect(m.lever).toBe("close-acceptance");
    expect(m.newTotalLpa).toBe(25);
    expect(m.deltaLpa).toBe(0);
  });

  it("offer-reaction → open-with-offer at initialOffer", () => {
    const m = pickNextMove({ phase: "offer-reaction", ...band });
    expect(m.lever).toBe("open-with-offer");
    expect(m.newTotalLpa).toBe(20);
  });

  it("probe-expectations → probe lever, no money move", () => {
    const m = pickNextMove({ phase: "probe-expectations", ...band });
    expect(m.lever).toBe("probe");
    expect(m.newTotalLpa).toBeNull();
  });

  it("benefits-discussion → benefits-summary, no money move", () => {
    const m = pickNextMove({ phase: "benefits-discussion", ...band });
    expect(m.lever).toBe("benefits-summary");
    expect(m.newTotalLpa).toBeNull();
  });

  it("counter-offer with cash headroom → counter-base", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 20,
      candidateTarget: 28,
    });
    expect(m.lever).toBe("counter-base");
    expect(m.newTotalLpa).toBe(24);
    expect(m.deltaLpa).toBe(4);
  });

  it("counter-offer at ceiling → rotates to joining-bonus", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 30, // already at maxStretch
      candidateTarget: 35,
    });
    expect(m.lever).toBe("joining-bonus");
    expect(m.newTotalLpa).toBeNull();
  });

  it("joining-bonus tried → rotates to notice-buyout when no equity", () => {
    const m = pickNextMove({
      phase: "closing-pressure",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: false,
      leversTried: ["joining-bonus"],
    });
    expect(m.lever).toBe("notice-buyout");
  });

  it("joining-bonus tried + hasEquity → rotates to equity-grant", () => {
    const m = pickNextMove({
      phase: "closing-pressure",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: true,
      leversTried: ["joining-bonus"],
    });
    expect(m.lever).toBe("equity-grant");
  });

  it("equity-grant NOT picked when hasEquity=false even if rotation reaches it", () => {
    const m = pickNextMove({
      phase: "closing-pressure",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: false,
      leversTried: ["joining-bonus", "notice-buyout"],
    });
    expect(m.lever).toBe("hold-firm");
    expect(m.newTotalLpa).toBe(30);
  });

  it("all levers exhausted → hold-firm with current floor", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: true,
      leversTried: ["joining-bonus", "equity-grant", "notice-buyout"],
    });
    expect(m.lever).toBe("hold-firm");
    expect(m.rationale).toMatch(/ceiling/i);
  });

  it("acceptance dominates phase — wins even if phase says counter-offer", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 24,
      candidateTarget: 30,
      isAccepted: true,
    });
    expect(m.lever).toBe("close-acceptance");
  });

  it("rationale references the chosen number for the LLM prompt", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 20,
      candidateTarget: 28,
    });
    expect(m.rationale).toMatch(/₹24/);
  });
});

describe("detectSalaryPhase (state-first regressions)", () => {
  it("candidateCounter on turn 1 → counter-offer (no more idx>=2 gate)", () => {
    // Architectural fix: phase follows candidate signal, not turn index.
    // Previously this returned offer-reaction because idx<2 blocked the
    // counter-offer branch, marching the AI through probe even though
    // the candidate had already given a number.
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        totalQuestions: 6,
        facts: { candidateCounter: "₹25 LPA" },
      }),
    ).toBe("counter-offer");
  });

  it("no facts at all on turn 0 → offer-reaction (cold-start ramp)", () => {
    expect(detectSalaryPhase({ questionIndex: 0 })).toBe("offer-reaction");
  });

  it("no facts on a late turn → probe-expectations (never fabricates counter)", () => {
    // Regression: index-based fallback used to fabricate counter-offer
    // / closing-pressure at high idx with no state. Now we only ramp
    // as deep as probe — the candidate's answer to that probe creates
    // the state that drives the next phase.
    expect(detectSalaryPhase({ questionIndex: 10 })).toBe("probe-expectations");
  });

  it("topicsRaised >= 2 → benefits-discussion regardless of turn", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        facts: { topicsRaised: ["esops", "joining-bonus"] },
      }),
    ).toBe("benefits-discussion");
  });
});

describe("sanitizeBehaviouralRegister", () => {
  it("rewrites the live-caught 'dive deeper' leak to clean Indian-English", () => {
    const input = "Let's dive deeper into the pilot you ran - what were the actual numbers?";
    const out = sanitizeBehaviouralRegister(input);
    expect(out).toBe("Let's go deeper into the pilot you ran - what were the actual numbers?");
    expect(/dive/i.test(out)).toBe(false);
  });

  it("covers the whole 'dive' verb-metaphor family", () => {
    expect(sanitizeBehaviouralRegister("Let's dive in.")).toBe("Let's get into it.");
    expect(sanitizeBehaviouralRegister("dive into the details")).toBe("get into the details");
    expect(sanitizeBehaviouralRegister("diving into that")).toBe("getting into that");
    expect(sanitizeBehaviouralRegister("Can we dive in here?")).toBe("Can we get started here?");
  });

  it("scrubs 'delve' and 'unpack' LLM-isms", () => {
    expect(sanitizeBehaviouralRegister("Let me delve into that")).toBe("Let me go into that");
    expect(sanitizeBehaviouralRegister("delve deeper into the result")).toBe("go deeper into the result");
    expect(sanitizeBehaviouralRegister("Let's unpack that decision")).toBe("Let's break down that decision");
  });

  it("scrubs American connective register banned at the prompt", () => {
    expect(sanitizeBehaviouralRegister("Let's circle back to that")).toBe("Let's come back to that");
    expect(sanitizeBehaviouralRegister("we can touch base later")).toBe("we can check in later");
    expect(sanitizeBehaviouralRegister("did you reach out to them?")).toBe("did you get in touch with them?");
    expect(sanitizeBehaviouralRegister("you should reach out")).toBe("you should get in touch");
    expect(sanitizeBehaviouralRegister("how did you leverage that?")).toBe("how did you use that?");
  });

  it("rewrites leverage as a VERB but preserves leverage as a NOUN", () => {
    // Verb sense → "use" (preceded by subject / "to" / modal, not a determiner)
    expect(sanitizeBehaviouralRegister("you can leverage your network")).toBe("you can use your network");
    expect(sanitizeBehaviouralRegister("to leverage that relationship")).toBe("to use that relationship");
    // Noun sense → preserved (a rewrite to "use" would mangle meaning)
    expect(sanitizeBehaviouralRegister("what leverage did you have?")).toBe("what leverage did you have?");
    expect(sanitizeBehaviouralRegister("you had no leverage there")).toBe("you had no leverage there");
    expect(sanitizeBehaviouralRegister("that gave you high leverage")).toBe("that gave you high leverage");
    expect(sanitizeBehaviouralRegister("your leverage in the negotiation")).toBe("your leverage in the negotiation");
  });

  it("preserves leading-letter capitalization of the matched phrase", () => {
    expect(sanitizeBehaviouralRegister("Delve into it")).toBe("Go into it");
    expect(sanitizeBehaviouralRegister("Reach out to HR")).toBe("Get in touch with HR");
  });

  it("leaves clean prose untouched and is idempotent", () => {
    const clean = "Can you walk me through one specific instance and what you personally did?";
    expect(sanitizeBehaviouralRegister(clean)).toBe(clean);
    const once = sanitizeBehaviouralRegister("Let's dive deeper into it");
    expect(sanitizeBehaviouralRegister(once)).toBe(once);
  });

  it("handles empty / non-string input without throwing", () => {
    expect(sanitizeBehaviouralRegister("")).toBe("");
    // @ts-expect-error — runtime guard for a non-string slipping through
    expect(sanitizeBehaviouralRegister(null)).toBe(null);
  });

  it("guarantees no banned token survives across a mixed paragraph", () => {
    const input = "Great, let's dive deeper. We can circle back and you can reach out to leverage your network.";
    const out = sanitizeBehaviouralRegister(input);
    expect(/\b(dive|delve|circle back|touch base|reach out|leverage|unpack)\b/i.test(out)).toBe(false);
  });
});
