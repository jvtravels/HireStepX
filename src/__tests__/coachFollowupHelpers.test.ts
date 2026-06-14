import { describe, it, expect } from "vitest";
import {
  classifyFollowupIntent,
  validateFollowupRequest,
  checkChallengeEvidence,
  buildGroundingContext,
  type FollowupQuestionContext,
  type ValidatedFollowup,
} from "../../server-handlers/_coach-followup-helpers";

const baseContext: FollowupQuestionContext = {
  overallScore: 64,
  verdict: "Lean Hire",
  strengths: ["Clear ownership"],
  improvements: ["Quantify outcomes"],
  weakestSkill: { name: "Structure", tip: "Lead with the situation" },
  perQuestion: [
    {
      question: "Tell me about a time you led under pressure.",
      score: 60,
      candidateAnswer:
        "At my last company we were behind on a launch. I led the on-call rotation and shipped the fix, which cut error rates by 40% in two weeks.",
    },
    {
      question: "Describe a conflict with a teammate.",
      score: 55,
      candidateAnswer: "We disagreed about the approach and eventually we found a middle ground.",
    },
  ],
};

describe("classifyFollowupIntent", () => {
  it("classifies a dispute as challenge", () => {
    expect(classifyFollowupIntent("I disagree, I did give a metric")).toBe("challenge");
    expect(classifyFollowupIntent("That's unfair, I actually quantified it")).toBe("challenge");
  });

  it("classifies a how-to as improve", () => {
    expect(classifyFollowupIntent("How should I have answered Q2?")).toBe("improve");
    expect(classifyFollowupIntent("Give me an example of a stronger answer")).toBe("improve");
  });

  it("classifies a why as clarify", () => {
    expect(classifyFollowupIntent("Why did I score low on structure?")).toBe("clarify");
    expect(classifyFollowupIntent("Can you explain the verdict?")).toBe("clarify");
  });

  it("classifies unrelated text as offtopic", () => {
    expect(classifyFollowupIntent("What's the weather in Mumbai?")).toBe("offtopic");
    expect(classifyFollowupIntent("")).toBe("offtopic");
  });

  it("lets dispute dominate over an embedded why", () => {
    expect(classifyFollowupIntent("Why is this unfair, I did mention numbers")).toBe("challenge");
  });
});

describe("validateFollowupRequest", () => {
  it("accepts a well-formed request and attaches intent", () => {
    const r = validateFollowupRequest({ sessionId: "s1", question: "Why did I score low?" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sessionId).toBe("s1");
      expect(r.value.intent).toBe("clarify");
    }
  });

  it("trims whitespace", () => {
    const r = validateFollowupRequest({ sessionId: "  s1  ", question: "  Why?  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sessionId).toBe("s1");
  });

  it("rejects non-object, missing fields, and overlong questions", () => {
    expect(validateFollowupRequest(null).ok).toBe(false);
    expect(validateFollowupRequest("nope").ok).toBe(false);
    expect(validateFollowupRequest({ question: "hi" }).ok).toBe(false);
    expect(validateFollowupRequest({ sessionId: "s1" }).ok).toBe(false);
    expect(validateFollowupRequest({ sessionId: "s1", question: "" }).ok).toBe(false);
    expect(
      validateFollowupRequest({ sessionId: "s1", question: "x".repeat(601) }).ok,
    ).toBe(false);
  });
});

describe("checkChallengeEvidence", () => {
  it("supports a quantification challenge when an answer has metrics", () => {
    const ev = checkChallengeEvidence("I disagree, I did give numbers", baseContext);
    expect(ev).not.toBeNull();
    expect(ev?.claim).toBe("quantified");
    expect(ev?.supported).toBe(true);
    expect(ev?.quotes.some((q) => q.includes("40%"))).toBe(true);
  });

  it("does not support a quantification claim when no answer has metrics", () => {
    const noMetrics: FollowupQuestionContext = {
      ...baseContext,
      perQuestion: [
        { question: "Q", candidateAnswer: "We worked together and it went fine in the end." },
      ],
    };
    const ev = checkChallengeEvidence("I did quantify the impact", noMetrics);
    expect(ev?.supported).toBe(false);
    expect(ev?.quotes.length).toBeGreaterThan(0); // surfaces what WAS said
  });

  it("returns null when the dispute isn't a settle-able quantify/structure claim", () => {
    expect(checkChallengeEvidence("That's just unfair overall", baseContext)).toBeNull();
  });

  it("returns null when there are no usable answers", () => {
    const empty: FollowupQuestionContext = { ...baseContext, perQuestion: [] };
    expect(checkChallengeEvidence("I did give a metric", empty)).toBeNull();
  });

  it("ignores skipped answers", () => {
    const skipped: FollowupQuestionContext = {
      ...baseContext,
      perQuestion: [{ question: "Q", candidateAnswer: "[SKIPPED by candidate]" }],
    };
    expect(checkChallengeEvidence("I gave numbers", skipped)).toBeNull();
  });
});

describe("buildGroundingContext", () => {
  const validated = (question: string, intent: ValidatedFollowup["intent"]): ValidatedFollowup => ({
    sessionId: "s1",
    question,
    intent,
  });

  it("includes the core report facts", () => {
    const ctx = buildGroundingContext(baseContext, validated("Why?", "clarify"));
    expect(ctx).toContain("Overall score: 64/100");
    expect(ctx).toContain("Verdict: Lean Hire");
    expect(ctx).toContain("Weakest skill: Structure");
    expect(ctx).toContain("Candidate said:");
  });

  it("appends a challenge adjudication block for a supported dispute", () => {
    const ctx = buildGroundingContext(
      baseContext,
      validated("I disagree, I did give numbers", "challenge"),
    );
    expect(ctx).toContain("CHALLENGE ADJUDICATION");
    expect(ctx).toContain("SUPPORTS");
    expect(ctx).toContain("Concede the point");
  });

  it("frames an unsupported dispute honestly without conceding", () => {
    const noMetrics: FollowupQuestionContext = {
      ...baseContext,
      perQuestion: [{ question: "Q", candidateAnswer: "We sorted it out together eventually." }],
    };
    const ctx = buildGroundingContext(
      noMetrics,
      validated("I did quantify it", "challenge"),
    );
    expect(ctx).toContain("does NOT clearly support");
  });

  it("is deterministic for the same input", () => {
    const a = buildGroundingContext(baseContext, validated("Why?", "clarify"));
    const b = buildGroundingContext(baseContext, validated("Why?", "clarify"));
    expect(a).toBe(b);
  });
});
