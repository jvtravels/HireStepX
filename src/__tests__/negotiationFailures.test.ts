import { describe, it, expect } from "vitest";
import {
  detectPrematureClose,
  detectInitialOfferBreakdownLeak,
  detectAboveMaxStretch,
  detectEquityLeakOnNonEquityBand,
  detectEsopInInitialOffer,
  detectNumberEchoMisbind,
  detectMarkdownLeak,
  detectPlaceholderLeak,
  detectPhantomCounter,
  detectRepeatedQuestion,
  detectHallucinatedEmployer,
  detectRoleTitleDrift,
  detectAllFailures,
} from "../../server-handlers/_negotiation-failures";

/**
 * Tests for the failure-detector. These pin "what broken means" so a
 * regression in follow-up.ts that re-introduces the Flipkart-screenshot
 * bugs trips the detector here. Each test is named after the user-
 * facing symptom that originally surfaced the bug.
 */

const baseCtx = {
  llmOutput: "",
  acceptedImmediately: false,
};

describe("detectPrematureClose", () => {
  it("[fixture: Flipkart] flags 'let me put together the final numbers' without acceptance", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "Let me put together the final numbers based on what we've agreed.",
    });
    expect(f?.code).toBe("premature-close");
    expect(f?.severity).toBe("blocker");
  });

  it("[fixture: Flipkart] flags 'HR will send you the offer letter' without acceptance", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "Great. I'll have HR send you the formal offer letter shortly.",
    });
    expect(f?.code).toBe("premature-close");
  });

  it("does NOT flag closing language when candidate accepted", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      acceptedImmediately: true,
      llmOutput: "Wonderful — let me put together the final numbers and HR will send the offer letter.",
    });
    expect(f).toBeNull();
  });

  it("does NOT flag normal counter-offer language", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "I can stretch to ₹35 LPA total CTC. Does that move us closer?",
    });
    expect(f).toBeNull();
  });
});

describe("detectInitialOfferBreakdownLeak", () => {
  it("[fixture: Flipkart] flags initial offer with 4+ components", () => {
    const f = detectInitialOfferBreakdownLeak({
      ...baseCtx,
      isInitialOffer: true,
      llmOutput: "We'd like to extend ₹34 LPA total CTC. This includes a base salary of ₹26 LPA, a variable component of ₹4 LPA, plus PF, gratuity, and ESOPs vesting over 4 years.",
    });
    expect(f?.code).toBe("initial-offer-breakdown-leak");
  });

  it("does NOT flag headline-only initial offer", () => {
    const f = detectInitialOfferBreakdownLeak({
      ...baseCtx,
      isInitialOffer: true,
      llmOutput: "We'd like to extend an offer at ₹34 LPA total CTC. Happy to walk you through the structure if you'd like — but first, how does the number land?",
    });
    expect(f).toBeNull();
  });

  it("does NOT flag breakdown when not the initial offer", () => {
    const f = detectInitialOfferBreakdownLeak({
      ...baseCtx,
      isInitialOffer: false,
      llmOutput: "Sure — base ₹26, variable ₹4, joining bonus ₹2, plus PF and ESOPs.",
    });
    expect(f).toBeNull();
  });
});

describe("detectAboveMaxStretch", () => {
  const band = { initialOffer: 34, maxStretch: 46, walkAway: 28, hasEquity: true };

  it("[fixture: Flipkart] flags ₹58 LPA when maxStretch is ₹46 LPA", () => {
    const f = detectAboveMaxStretch({
      ...baseCtx,
      band,
      llmOutput: "We can stretch to ₹58 LPA total CTC.",
    });
    expect(f?.code).toBe("above-max-stretch");
    expect(f?.severity).toBe("blocker");
  });

  it("does NOT flag offers within 5% tolerance", () => {
    const f = detectAboveMaxStretch({
      ...baseCtx,
      band,
      llmOutput: "We can stretch to ₹47 LPA — that's the top of the band.",
    });
    expect(f).toBeNull();
  });

  it("normalizes crore to lakh", () => {
    const f = detectAboveMaxStretch({
      ...baseCtx,
      band: { initialOffer: 30, maxStretch: 80, walkAway: 25 },
      llmOutput: "We can offer 1 crore total CTC.",
    });
    // 1 crore = 100 LPA > 80 * 1.05
    expect(f?.code).toBe("above-max-stretch");
  });
});

describe("detectEquityLeakOnNonEquityBand", () => {
  it("flags ESOPs when band.hasEquity is false (e.g., TCS, Infosys)", () => {
    const f = detectEquityLeakOnNonEquityBand({
      ...baseCtx,
      band: { initialOffer: 12, maxStretch: 18, walkAway: 9, hasEquity: false },
      llmOutput: "We can also discuss ESOPs vesting over 4 years.",
    });
    expect(f?.code).toBe("equity-leak-on-non-equity-band");
  });

  it("does NOT flag ESOPs when band grants equity", () => {
    const f = detectEquityLeakOnNonEquityBand({
      ...baseCtx,
      band: { initialOffer: 30, maxStretch: 50, walkAway: 25, hasEquity: true },
      llmOutput: "Plus ESOPs vesting over 4 years.",
    });
    expect(f).toBeNull();
  });
});

describe("detectEsopInInitialOffer", () => {
  it("[fixture: Flipkart] flags ESOPs in turn-1 even when band grants equity", () => {
    const f = detectEsopInInitialOffer({
      ...baseCtx,
      isInitialOffer: true,
      llmOutput: "We're offering ₹34 LPA plus ESOPs vesting over 4 years.",
    });
    expect(f?.code).toBe("esop-in-initial-offer");
  });

  it("does NOT flag ESOPs in later turns", () => {
    const f = detectEsopInInitialOffer({
      ...baseCtx,
      isInitialOffer: false,
      llmOutput: "On the equity side, ESOPs vest over 4 years with a 1-year cliff.",
    });
    expect(f).toBeNull();
  });
});

describe("detectNumberEchoMisbind", () => {
  it("[fixture: Flipkart] flags 'thinking around ₹58' when candidate said ₹70", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      candidateTargetLpa: 70,
      llmOutput: "I hear you — thinking around ₹58 LPA based on your market research.",
    });
    expect(f?.code).toBe("number-echo-misbind");
  });

  it("does NOT flag when echo matches candidate target", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      candidateTargetLpa: 70,
      llmOutput: "I heard ₹70 LPA from you — let me see what I can do.",
    });
    expect(f).toBeNull();
  });

  it("does NOT flag when echo matches a stated competing offer", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      candidateTargetLpa: 70,
      competingOfferLpa: 68,
      llmOutput: "You mentioned ₹68 LPA in hand — that's a serious data point.",
    });
    expect(f).toBeNull();
  });
});

describe("detectMarkdownLeak", () => {
  it("[fixture: Flipkart] flags italic _word_", () => {
    const f = detectMarkdownLeak({ ...baseCtx, llmOutput: "Let's have a _discussion_ about it." });
    expect(f?.code).toBe("markdown-leak");
  });

  it("flags **bold**", () => {
    expect(detectMarkdownLeak({ ...baseCtx, llmOutput: "**Important**: this is the cap." })?.code).toBe("markdown-leak");
  });

  it("does NOT flag plain text", () => {
    expect(detectMarkdownLeak({ ...baseCtx, llmOutput: "Plain text with no markdown." })).toBeNull();
  });
});

describe("detectPlaceholderLeak", () => {
  it("flags ₹X placeholder", () => {
    expect(detectPlaceholderLeak({ ...baseCtx, llmOutput: "I can offer ₹X LPA." })?.code).toBe("placeholder-leak");
  });

  it("flags [amount] placeholder", () => {
    expect(detectPlaceholderLeak({ ...baseCtx, llmOutput: "Counter at [amount] LPA." })?.code).toBe("placeholder-leak");
  });
});

describe("detectPrematureClose — round-2 variants from real Flipkart retest", () => {
  it("flags 'I'll work with HR to put together the final, formal offer letter'", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput:
        "Based on our conversation, I'll work with HR to put together the final, formal offer letter with these adjustments. We aim to get that to you within the next 24-48 hours.",
    });
    expect(f?.code).toBe("premature-close");
  });

  it("flags 'with these adjustments' commitment language alone", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "Sounds good. We'll go ahead with these adjustments and confirm shortly.",
    });
    expect(f?.code).toBe("premature-close");
  });

  it("flags 'within 24-48 hours' offer-letter timing", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "We'll get the offer letter to you in the next 24-48 hours.",
    });
    expect(f?.code).toBe("premature-close");
  });
});

describe("detectNumberEchoMisbind — round-2 phrasing variants", () => {
  it("[fixture: Flipkart retest] flags 'looking for a total CTC of around ₹20 LPAs' when target is ₹24", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      candidateTargetLpa: 24,
      llmOutput: "I hear you, you're looking for a total CTC of around ₹20 LPAs per annum.",
    });
    expect(f?.code).toBe("number-echo-misbind");
  });

  it("flags 'seeing ₹X LPA' when X != target", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      candidateTargetLpa: 24,
      llmOutput: "I understand you're seeing ₹18 LPA as the average for your level.",
    });
    expect(f?.code).toBe("number-echo-misbind");
  });

  it("matches LPAs (with trailing s) — LLM frequently pluralizes", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      candidateTargetLpa: 24,
      llmOutput: "Thinking around ₹15 LPAs based on your experience.",
    });
    expect(f?.code).toBe("number-echo-misbind");
  });
});

describe("detectPhantomCounter", () => {
  it("[fixture: Flipkart retest] flags 'our current offer of ₹24 LPA' when AI never moved past ₹20", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput:
        "Given your target of ₹24 LPA and our current offer of ₹24 LPA, what would it take to bridge that gap?",
      highestOfferMade: 20,
    });
    expect(f?.code).toBe("phantom-counter");
    expect(f?.severity).toBe("blocker");
  });

  it("does NOT flag when current offer matches highestOfferMade", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput: "Our current offer of ₹24 LPA stands.",
      highestOfferMade: 24,
    });
    expect(f).toBeNull();
  });

  it("falls back to band.initialOffer when highestOfferMade is null", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput: "Our current offer of ₹40 LPA total CTC.",
      highestOfferMade: null,
      band: { initialOffer: 20, maxStretch: 28, walkAway: 16 },
    });
    expect(f?.code).toBe("phantom-counter");
  });

  it("does not fire when neither highestOfferMade nor band is provided", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput: "Our current offer of ₹40 LPA.",
    });
    expect(f).toBeNull();
  });
});

describe("detectRepeatedQuestion", () => {
  it("[fixture: Flipkart retest] flags asking notice-period twice", () => {
    const f = detectRepeatedQuestion({
      ...baseCtx,
      previousAiTurns: [
        "What's your current notice period, and when would you ideally be looking to join?",
      ],
      llmOutput:
        "Okay. What's your current notice period situation, and what would be your ideal joining date?",
    });
    expect(f?.code).toBe("repeated-question");
  });

  it("does NOT flag when current turn merely acknowledges (not re-asks) the prior probe", () => {
    const f = detectRepeatedQuestion({
      ...baseCtx,
      previousAiTurns: [
        "What's your current notice period, and when would you ideally be looking to join?",
      ],
      llmOutput:
        "Thanks for clarifying your notice period — good to know you can join in 30 days. What would it take to get you on board?",
    });
    expect(f).toBeNull();
  });

  it("does not fire on the first AI turn (no prior context)", () => {
    const f = detectRepeatedQuestion({
      ...baseCtx,
      previousAiTurns: [],
      llmOutput: "What's your current notice period?",
    });
    expect(f).toBeNull();
  });
});

describe("detectAllFailures", () => {
  it("[fixture: Flipkart UX session] catches multiple bugs in a single broken turn", () => {
    /* This is the synthesized worst-case from the user's screenshots:
       - Initial offer with breakdown
       - ESOPs in initial offer
       - Above-maxStretch number
       - Number echo to wrong figure
       The detector should surface ALL of these so we can prioritize. */
    const failures = detectAllFailures({
      llmOutput: "I heard ₹58 LPA from you. We can extend ₹58 LPA total CTC, including ₹45 LPA base, ₹6 LPA variable, plus ESOPs vesting over 4 years and gratuity.",
      acceptedImmediately: false,
      candidateTargetLpa: 70,
      isInitialOffer: true,
      band: { initialOffer: 34, maxStretch: 46, walkAway: 28, hasEquity: true },
    });
    const codes = failures.map(f => f.code);
    expect(codes).toContain("initial-offer-breakdown-leak");
    expect(codes).toContain("above-max-stretch");
    expect(codes).toContain("esop-in-initial-offer");
    expect(codes).toContain("number-echo-misbind");
  });

  /* ── Round-3 (flipkart-senior-pd-session-3) variants ───────────── */

  it("[round-3] number-echo: 'driving that ₹X' anchor catches misbinds", () => {
    const f = detectNumberEchoMisbind({
      ...baseCtx,
      llmOutput: "Can you share what's driving that ₹30 LPA figure, beyond the relocation?",
      candidateTargetLpa: 40,
    });
    expect(f?.code).toBe("number-echo-misbind");
  });

  it("[round-3] phantom-counter: 'best offer … is a total CTC of ₹X' (parenthetical clause)", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput: "My current best offer, considering the role and our internal bands, is a total CTC of ₹40 LPA.",
      highestOfferMade: 30,
      band: { initialOffer: 30, maxStretch: 38, walkAway: 24, hasEquity: true },
    });
    expect(f?.code).toBe("phantom-counter");
  });

  it("[round-3] phantom-counter: 'the ₹30.4 LPA package' (precision leak from internal band)", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput: "The ₹30.4 LPA package — does that feel like the right ballpark for you?",
      highestOfferMade: 30,
      candidateTargetLpa: 40,
      band: { initialOffer: 30.4, maxStretch: 38, walkAway: 24, hasEquity: true },
    });
    expect(f?.code).toBe("phantom-counter");
  });

  it("[round-3] phantom-counter: 'the ₹X package' does NOT fire when X matches a real reference", () => {
    const f = detectPhantomCounter({
      ...baseCtx,
      llmOutput: "I hear you — the ₹30 LPA package doesn't fully reflect your value. Let's discuss.",
      highestOfferMade: 30,
      candidateTargetLpa: 40,
      band: { initialOffer: 30, maxStretch: 38, walkAway: 24, hasEquity: true },
    });
    expect(f).toBeNull();
  });

  it("[round-3] premature-close: 'put together the final numbers' without 'let me' prefix", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "I'll take all this feedback and put together the final numbers for you.",
    });
    expect(f?.code).toBe("premature-close");
  });

  it("[round-3] premature-close: 'HR send you a formal offer letter' (a vs the)", () => {
    const f = detectPrematureClose({
      ...baseCtx,
      llmOutput: "We'll aim to have HR send you a formal offer letter with the revised package soon.",
    });
    expect(f?.code).toBe("premature-close");
  });

  /* ── #11 Hallucinated employer ─────────────────────────────────── */

  it("[round-3] hallucinated-employer: 'notice period at 3INSYS' when candidate never said it", () => {
    const f = detectHallucinatedEmployer({
      ...baseCtx,
      llmOutput: "What's your notice period at 3INSYS, and when can you join?",
      hiringCompany: "Flipkart",
      candidateTranscript: "I'd like to have 40 lakhs CTC because of the shift from Mumbai.",
    });
    expect(f?.code).toBe("hallucinated-employer");
  });

  it("[round-3] hallucinated-employer: does NOT fire when candidate said the company", () => {
    const f = detectHallucinatedEmployer({
      ...baseCtx,
      llmOutput: "What's your notice period at Infosys?",
      hiringCompany: "Flipkart",
      candidateTranscript: "I'm currently at Infosys and have 30 days notice.",
    });
    expect(f).toBeNull();
  });

  it("[round-3] hallucinated-employer: does NOT fire on city stoplist", () => {
    const f = detectHallucinatedEmployer({
      ...baseCtx,
      llmOutput: "What's your notice period in Bangalore — when can you join?",
      hiringCompany: "Flipkart",
      candidateTranscript: "",
    });
    expect(f).toBeNull();
  });

  /* ── #12 Role-title drift ──────────────────────────────────────── */

  it("[round-3] role-title-drift: cross-family — 'Engineering Manager' when role is 'backend-engineer'", () => {
    const f = detectRoleTitleDrift({
      ...baseCtx,
      llmOutput: "For this Engineering Manager role, the band is ₹40 LPA.",
      sessionRole: "backend-engineer",
    });
    expect(f?.code).toBe("role-title-drift");
  });

  it("[round-3] role-title-drift: cross-family — 'Senior Data Analyst' when role is 'data-scientist'", () => {
    const f = detectRoleTitleDrift({
      ...baseCtx,
      llmOutput: "Welcome to the Senior Data Analyst position at our team.",
      sessionRole: "data-scientist",
    });
    expect(f?.code).toBe("role-title-drift");
  });

  it("[round-3] role-title-drift: same-family variants are NOT flagged ('UI Designer' vs 'ux-designer')", () => {
    const f = detectRoleTitleDrift({
      ...baseCtx,
      llmOutput: "We'd like you for the UI Designer role on the team.",
      sessionRole: "ux-designer",
    });
    expect(f).toBeNull();
  });

  it("clean turn produces zero failures", () => {
    const failures = detectAllFailures({
      llmOutput: "I heard ₹70 LPA — that's at the top of our band. Let me see what I can do. I can stretch to ₹40 LPA total CTC. Does that get us closer?",
      acceptedImmediately: false,
      candidateTargetLpa: 70,
      isInitialOffer: false,
      band: { initialOffer: 34, maxStretch: 46, walkAway: 28, hasEquity: true },
    });
    expect(failures).toEqual([]);
  });
});
