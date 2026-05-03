import { describe, it, expect } from "vitest";
import {
  isRepeatRequest,
  computeAdaptiveDifficulty,
  buildConversationHistory,
  pickNegotiationCoachingHint,
  extractRecentFollowUps,
} from "../_advance-helpers";

/* ─── isRepeatRequest ──────────────────────────────────────────────── */
describe("isRepeatRequest", () => {
  it("matches common 'can you repeat that' phrasings", () => {
    expect(isRepeatRequest("Can you repeat that?")).toBe(true);
    expect(isRepeatRequest("Could you repeat the question please")).toBe(true);
    /* Note: "Please say THAT" matches but "Please say that AGAIN" doesn't —
       the primary regex allows ONE trailing word, not stacked. The alternate
       regex catches "say (that) again" instead. */
    expect(isRepeatRequest("Please say that")).toBe(true);
    expect(isRepeatRequest("say that again")).toBe(true);
    expect(isRepeatRequest("Sorry, repeat that?")).toBe(true);
    /* The single word "repeat" alone is intentionally NOT matched —
       too ambiguous, could be the candidate starting an answer like
       "Repeat business is the key signal we used…". The regex
       requires either a polite preamble ("can you", "could you",
       "please") OR a follow-on word ("that", "again"). */
    expect(isRepeatRequest("repeat that")).toBe(true);
  });

  it("matches alternate phrasings", () => {
    expect(isRepeatRequest("One more time")).toBe(true);
    expect(isRepeatRequest("come again")).toBe(true);
    expect(isRepeatRequest("I didn't catch that")).toBe(true);
    expect(isRepeatRequest("I didn't hear you")).toBe(true);
    expect(isRepeatRequest("Say again")).toBe(true);
  });

  it("does not match real answers that mention 'repeat'", () => {
    expect(isRepeatRequest("I had to repeat the same migration five times across regions")).toBe(false);
    expect(isRepeatRequest("My team would repeat this exercise quarterly")).toBe(false);
  });

  it("ignores empty / whitespace-only input", () => {
    expect(isRepeatRequest("")).toBe(false);
    expect(isRepeatRequest("   ")).toBe(false);
  });

  it("rejects strings over the 60-char threshold even if they look like repeats", () => {
    /* A long string is almost certainly a real answer, even if it starts with
       "can you repeat" — protects against false positives on rambling. */
    expect(isRepeatRequest("Can you repeat that question because I'm not sure I understand the context")).toBe(false);
  });
});

/* ─── computeAdaptiveDifficulty ────────────────────────────────────── */
describe("computeAdaptiveDifficulty", () => {
  it("returns hold when fewer than 2 scores are available", () => {
    expect(computeAdaptiveDifficulty([])).toBe("hold");
    expect(computeAdaptiveDifficulty([5])).toBe("hold");
  });

  it("returns escalate when last 3 scores average ≥ 4", () => {
    expect(computeAdaptiveDifficulty([4, 4, 4])).toBe("escalate");
    expect(computeAdaptiveDifficulty([5, 5, 5])).toBe("escalate");
    expect(computeAdaptiveDifficulty([3, 4, 5])).toBe("escalate");
  });

  it("returns ease when last 3 scores average ≤ 2", () => {
    expect(computeAdaptiveDifficulty([1, 1, 1])).toBe("ease");
    expect(computeAdaptiveDifficulty([2, 2, 2])).toBe("ease");
    expect(computeAdaptiveDifficulty([1, 2, 2])).toBe("ease");
  });

  it("returns hold for middling averages", () => {
    expect(computeAdaptiveDifficulty([3, 3, 3])).toBe("hold");
    expect(computeAdaptiveDifficulty([2, 3, 4])).toBe("hold");
  });

  it("only considers the last 3 scores even when more are passed", () => {
    /* Old session: [1,1,1] → would say ease. But last 3 are [5,5,5] → escalate. */
    expect(computeAdaptiveDifficulty([1, 1, 1, 5, 5, 5])).toBe("escalate");
  });
});

/* ─── buildConversationHistory ────────────────────────────────────── */
describe("buildConversationHistory", () => {
  const baseTranscript = [
    { speaker: "ai" as const, text: "Tell me about yourself.", time: "00:01" },
    { speaker: "user" as const, text: "I'm a senior engineer with 6 years of experience.", time: "00:02" },
    { speaker: "ai" as const, text: "Hmm, okay.", time: "00:03" }, // thinking phrase — should be filtered
    { speaker: "ai" as const, text: "[Answer recorded — 2s]", time: "00:04" }, // system note — filtered
    { speaker: "ai" as const, text: "What's your biggest weakness?", time: "00:05" },
  ];

  it("appends the current Q+A to the bottom", () => {
    const out = buildConversationHistory({
      transcript: baseTranscript,
      currentQuestionText: "Walk me through a migration.",
      currentAnswerText: "We led a Razorpay integration that improved deploys by 40%.",
      isSalaryNeg: false,
    });
    expect(out).toContain("Q: Walk me through a migration.");
    expect(out).toContain("A: We led a Razorpay integration");
  });

  it("filters out short thinking-phrase fillers", () => {
    const out = buildConversationHistory({
      transcript: baseTranscript,
      currentQuestionText: "Q",
      currentAnswerText: "A",
      isSalaryNeg: false,
    });
    /* "Hmm, okay." is a thinking phrase under 40 chars — should be skipped. */
    expect(out).not.toContain("Hmm, okay.");
  });

  it("filters out bracketed system notes", () => {
    const out = buildConversationHistory({
      transcript: baseTranscript,
      currentQuestionText: "Q",
      currentAnswerText: "A",
      isSalaryNeg: false,
    });
    expect(out).not.toContain("[Answer recorded");
  });

  it("uses longer per-turn excerpts for salary-negotiation", () => {
    const longText = "Y".repeat(300);
    const t = [{ speaker: "user" as const, text: longText, time: "00:01" }];
    const regular = buildConversationHistory({ transcript: t, currentQuestionText: "q", currentAnswerText: "a", isSalaryNeg: false });
    const negotiation = buildConversationHistory({ transcript: t, currentQuestionText: "q", currentAnswerText: "a", isSalaryNeg: true });
    /* Regular caps the user turn at 120 chars; salary at 200. */
    const regAnswerLen = regular.match(/A: Y+/)?.[0].length ?? 0;
    const negAnswerLen = negotiation.match(/A: Y+/)?.[0].length ?? 0;
    expect(negAnswerLen).toBeGreaterThan(regAnswerLen);
  });

  it("caps regular interviews at the last 20 entries", () => {
    /* 30 user turns → only last 20 lines (plus current Q+A) survive in regular mode. */
    const big = Array.from({ length: 30 }, (_, i) => ({ speaker: "user" as const, text: `Answer ${i}`, time: "00:01" }));
    const out = buildConversationHistory({ transcript: big, currentQuestionText: "q", currentAnswerText: "a", isSalaryNeg: false });
    expect(out.split("\n")).toHaveLength(20);
    expect(out).not.toContain("Answer 0");
    expect(out).toContain("Answer 29");
  });

  it("keeps every turn for salary-negotiation (no truncation)", () => {
    const big = Array.from({ length: 30 }, (_, i) => ({ speaker: "user" as const, text: `Answer ${i}`, time: "00:01" }));
    const out = buildConversationHistory({ transcript: big, currentQuestionText: "q", currentAnswerText: "a", isSalaryNeg: true });
    /* 30 user turns + current Q + current A = 32 lines. */
    expect(out.split("\n")).toHaveLength(32);
    expect(out).toContain("Answer 0");
  });
});

/* ─── pickNegotiationCoachingHint ──────────────────────────────────── */
describe("pickNegotiationCoachingHint", () => {
  const blankFacts = {
    candidateCounter: null,
    deflectedNumbers: false,
    topicsRaised: [],
    hasCompetingOffers: false,
    mentionedBATNA: false,
    acceptedImmediately: false,
  };

  it("returns null when phase or facts are missing", () => {
    expect(pickNegotiationCoachingHint({ phase: undefined, facts: blankFacts, alreadyShown: new Set() })).toBeNull();
    expect(pickNegotiationCoachingHint({ phase: "counter-offer", facts: undefined, alreadyShown: new Set() })).toBeNull();
  });

  it("returns null when this phase has already been hinted", () => {
    expect(pickNegotiationCoachingHint({
      phase: "counter-offer", facts: blankFacts, alreadyShown: new Set(["counter-offer"]),
    })).toBeNull();
  });

  it("nudges to anchor a counter at counter-offer phase if no number named", () => {
    const hint = pickNegotiationCoachingHint({ phase: "counter-offer", facts: blankFacts, alreadyShown: new Set() });
    expect(hint).toMatch(/Name a specific number/);
  });

  it("does not nudge if candidate already named a number", () => {
    expect(pickNegotiationCoachingHint({
      phase: "counter-offer",
      facts: { ...blankFacts, candidateCounter: "30 LPA" },
      alreadyShown: new Set(),
    })).toBeNull();
  });

  it("nudges to ask about benefits in benefits-discussion when nothing was raised", () => {
    const hint = pickNegotiationCoachingHint({ phase: "benefits-discussion", facts: blankFacts, alreadyShown: new Set() });
    expect(hint).toMatch(/equity, joining bonus/);
  });

  it("nudges about competing offers at closing-pressure", () => {
    const hint = pickNegotiationCoachingHint({ phase: "closing-pressure", facts: blankFacts, alreadyShown: new Set() });
    expect(hint).toMatch(/competing offers/);
  });

  it("nudges if candidate accepted too quickly at probe-expectations", () => {
    const hint = pickNegotiationCoachingHint({
      phase: "probe-expectations",
      facts: { ...blankFacts, acceptedImmediately: true },
      alreadyShown: new Set(),
    });
    expect(hint).toMatch(/Accepting too quickly/);
  });
});

/* ─── extractRecentFollowUps ──────────────────────────────────────── */
describe("extractRecentFollowUps", () => {
  const script = [
    { type: "intro", aiText: "Hi, I'm Maya." },
    { type: "question", aiText: "Tell me about yourself." },
    { type: "follow-up", aiText: "What did the team say?" },
    { type: "follow-up", aiText: "Why did you push back?" },
    { type: "question", aiText: "Walk me through a migration." },
  ];

  it("returns only follow-up Q's in the look-back window", () => {
    const out = extractRecentFollowUps({ script, currentStep: 4, currentAnswerText: "" });
    expect(out).toContain("Q: What did the team say?");
    expect(out).toContain("Q: Why did you push back?");
    expect(out).not.toContain("Q: Tell me about yourself.");
    expect(out).not.toContain("Q: Hi, I'm Maya.");
  });

  it("appends the current answer when one is provided", () => {
    const out = extractRecentFollowUps({ script, currentStep: 4, currentAnswerText: "I led the team." });
    expect(out[out.length - 1]).toBe("A: I led the team.");
  });

  it("returns empty array when there are no follow-ups in window", () => {
    const out = extractRecentFollowUps({ script: [{ type: "question", aiText: "Q1" }], currentStep: 0, currentAnswerText: "" });
    expect(out).toEqual([]);
  });
});
