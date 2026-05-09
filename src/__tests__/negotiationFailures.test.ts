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
