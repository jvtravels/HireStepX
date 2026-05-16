import { describe, it, expect } from "vitest";
import {
  classifyReverseQuestion,
  summarizeReverseInterview,
} from "../_reverse-interview";

/* These tests pin the conservative-by-default behaviour of the classifier:
 * unknown questions fall into "yellow", red precedence beats green when both
 * could match, and the verdict logic mirrors Indian-hiring-manager reality
 * (one red anywhere in the closing turn is a real signal). */

describe("classifyReverseQuestion — green markers", () => {
  it("classifies '90 day success' as green", () => {
    expect(
      classifyReverseQuestion("What does success look like in the first 90 days?").bucket,
    ).toBe("green");
  });

  it("classifies team-structure probe as green", () => {
    expect(
      classifyReverseQuestion("How is the team structured between product and platform?").bucket,
    ).toBe("green");
  });

  it("classifies current-challenge probe as green", () => {
    expect(
      classifyReverseQuestion("What's the biggest technical challenge the team is facing right now?").bucket,
    ).toBe("green");
  });

  it("classifies decision-making probe as green", () => {
    expect(
      classifyReverseQuestion("How are technical decisions made on this team?").bucket,
    ).toBe("green");
  });

  it("classifies variable-payout-history probe as green (Indian-context senior signal)", () => {
    expect(
      classifyReverseQuestion("What's the variable payout history at this band?").bucket,
    ).toBe("green");
  });

  it("classifies services onshore/offshore split probe as green", () => {
    expect(
      classifyReverseQuestion("Can you tell me about the onsite offshore split for this role?").bucket,
    ).toBe("green");
  });
});

describe("classifyReverseQuestion — red markers", () => {
  it("classifies salary-in-round-1 as red", () => {
    expect(
      classifyReverseQuestion("What's the CTC for this role?").bucket,
    ).toBe("red");
  });

  it("classifies aggressive WFH as red", () => {
    expect(
      classifyReverseQuestion("Can I work from home full time?").bucket,
    ).toBe("red");
  });

  it("classifies entitled promotion-timeline as red", () => {
    expect(
      classifyReverseQuestion("When can I expect a promotion?").bucket,
    ).toBe("red");
  });

  it("classifies leave-policy-pre-offer as red", () => {
    expect(
      classifyReverseQuestion("What is the leave policy here?").bucket,
    ).toBe("red");
  });

  it("classifies attendance-strictness as red", () => {
    expect(
      classifyReverseQuestion("How strict is HR about attendance?").bucket,
    ).toBe("red");
  });

  it("classifies anti-work signalling as red", () => {
    expect(
      classifyReverseQuestion("Will I have to work on weekends?").bucket,
    ).toBe("red");
  });

  it("classifies joining-bonus negotiation as red", () => {
    expect(
      classifyReverseQuestion("Can I negotiate a higher joining bonus?").bucket,
    ).toBe("red");
  });
});

describe("classifyReverseQuestion — yellow / fallback", () => {
  it("classifies generic culture question as yellow", () => {
    expect(
      classifyReverseQuestion("What's the culture like?").bucket,
    ).toBe("yellow");
  });

  it("classifies next-steps as yellow", () => {
    expect(
      classifyReverseQuestion("What are the next steps from here?").bucket,
    ).toBe("yellow");
  });

  it("returns yellow for empty input (conservative default)", () => {
    expect(classifyReverseQuestion("").bucket).toBe("yellow");
  });

  it("returns yellow for unclassified text (no detector fires)", () => {
    const out = classifyReverseQuestion("Tell me about your favourite colour.");
    expect(out.bucket).toBe("yellow");
    expect(out.reason).toBe("unclassified");
  });
});

describe("classifyReverseQuestion — red beats green precedence", () => {
  it("a salary question wrapped in a success-criteria frame still classifies as red", () => {
    // Red patterns are checked before green — protects against red flags being
    // hidden behind a structurally-strong wrapper.
    const out = classifyReverseQuestion(
      "What does success look like in the first 90 days, and what's the CTC?",
    );
    expect(out.bucket).toBe("red");
  });
});

describe("summarizeReverseInterview — verdicts", () => {
  it("returns weak with no questions when the candidate says nothing", () => {
    const s = summarizeReverseInterview("");
    expect(s.verdict).toBe("weak");
    expect(s.classifications).toHaveLength(0);
  });

  it("returns strong when at least one green is asked", () => {
    const s = summarizeReverseInterview(
      "What does success look like in the first 90 days? And what's the culture like?",
    );
    expect(s.counts.green).toBe(1);
    expect(s.counts.yellow).toBe(1);
    expect(s.verdict).toBe("strong");
  });

  it("returns red_flag when any red is present, even alongside a green", () => {
    const s = summarizeReverseInterview(
      "How is the team structured? When can I expect a promotion?",
    );
    expect(s.counts.red).toBe(1);
    expect(s.counts.green).toBe(1);
    expect(s.verdict).toBe("red_flag");
  });

  it("returns neutral when only yellow questions are asked", () => {
    const s = summarizeReverseInterview(
      "What's the culture like? What are the next steps from here?",
    );
    expect(s.verdict).toBe("neutral");
  });

  it("splits multiple questions on '?' boundary", () => {
    const s = summarizeReverseInterview(
      "How are decisions made? What's the variable payout history? What's the leave policy?",
    );
    expect(s.classifications.length).toBe(3);
    expect(s.counts.green).toBe(2);
    expect(s.counts.red).toBe(1);
    expect(s.verdict).toBe("red_flag");
  });
});
