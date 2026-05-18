import { describe, it, expect } from "vitest";
import {
  detectVagueness,
  detectCrispness,
  detectSelfAwareness,
  detectDefensiveness,
  detectBehaviouralAnswerSignals,
  isFailureQuestion,
  vaguenessMatch,
} from "../../server-handlers/_behavioural-answer-signals";

describe("vaguenessMatch — Phase 6.4 quote-the-actual-phrase", () => {
  it("returns the matched hedge lowercased", () => {
    expect(vaguenessMatch("Many users were dropping off.")).toBe("many");
    expect(vaguenessMatch("Some disagreement, no resolution yet.")).toBe("some");
    expect(vaguenessMatch("Several teams chimed in.")).toBe("several");
  });

  it("returns null when answer has a numeric token", () => {
    expect(vaguenessMatch("Many users — about 1200 — saw it.")).toBeNull();
  });

  it("returns null when no scale word", () => {
    expect(vaguenessMatch("I led the migration over six weeks.")).toBeNull();
  });

  it("returns null on empty / null", () => {
    expect(vaguenessMatch(null)).toBeNull();
    expect(vaguenessMatch("")).toBeNull();
  });
});

describe("detectVagueness", () => {
  it("fires on scale words with no digits anywhere", () => {
    expect(
      detectVagueness("We had many users adopting it and several teams pulled it in."),
    ).toBe(true);
  });

  it("does NOT fire when the answer contains a numeric token", () => {
    // Same scale words, but 1,200 disqualifies it.
    expect(
      detectVagueness("We had many users — about 1,200 — adopting the feature."),
    ).toBe(false);
  });

  it("does NOT fire when there are no scale words", () => {
    expect(detectVagueness("I led the migration over six weeks.")).toBe(false);
  });

  it("returns false on empty / null / undefined", () => {
    expect(detectVagueness("")).toBe(false);
    expect(detectVagueness(null)).toBe(false);
    expect(detectVagueness(undefined)).toBe(false);
  });

  it("is case-insensitive on the scale words", () => {
    expect(detectVagueness("Many things happened")).toBe(true);
    expect(detectVagueness("MANY things happened")).toBe(true);
  });
});

describe("detectCrispness", () => {
  it("classifies short answers as thin (< 40 words)", () => {
    const thin = "I led the migration. It worked.";
    expect(detectCrispness(thin)).toBe("thin");
  });

  it("classifies medium answers as ok (40-300 words)", () => {
    const ok = Array.from({ length: 120 }, () => "word").join(" ");
    expect(detectCrispness(ok)).toBe("ok");
  });

  it("classifies long answers as rambling (> 300 words)", () => {
    const rambling = Array.from({ length: 350 }, () => "word").join(" ");
    expect(detectCrispness(rambling)).toBe("rambling");
  });

  it("treats empty / null / undefined as thin", () => {
    expect(detectCrispness("")).toBe("thin");
    expect(detectCrispness(null)).toBe("thin");
    expect(detectCrispness(undefined)).toBe("thin");
    expect(detectCrispness("   ")).toBe("thin");
  });

  it("classifies exactly 40 words as ok (boundary)", () => {
    const exactly40 = Array.from({ length: 40 }, () => "word").join(" ");
    expect(detectCrispness(exactly40)).toBe("ok");
  });
});

describe("detectSelfAwareness", () => {
  it("fires on 'in hindsight'", () => {
    expect(detectSelfAwareness("In hindsight, I rushed the rollout.")).toBe(true);
  });

  it("fires on 'I should have'", () => {
    expect(detectSelfAwareness("I should have looped in legal sooner.")).toBe(true);
  });

  it("fires on 'looking back'", () => {
    expect(detectSelfAwareness("Looking back, that call was wrong.")).toBe(true);
  });

  it("fires on 'I underestimated'", () => {
    expect(detectSelfAwareness("I underestimated how much testing it needed.")).toBe(true);
  });

  it("does NOT fire on a clean post-mortem-free answer", () => {
    expect(
      detectSelfAwareness("I led the migration. We hit the deadline."),
    ).toBe(false);
  });

  it("returns false on empty / null / undefined", () => {
    expect(detectSelfAwareness("")).toBe(false);
    expect(detectSelfAwareness(null)).toBe(false);
    expect(detectSelfAwareness(undefined)).toBe(false);
  });
});

describe("detectDefensiveness", () => {
  it("fires on a failure question with deflection phrasing", () => {
    expect(
      detectDefensiveness(
        "Tell me about a fail you've had.",
        "Honestly, it wasn't my call — the team didn't want to follow the plan.",
      ),
    ).toBe(true);
  });

  it("does NOT fire on a non-failure question, even with deflection phrases", () => {
    expect(
      detectDefensiveness(
        "Tell me about a successful project.",
        "But the team did a lot of the work.",
      ),
    ).toBe(false);
  });

  it("does NOT fire on a failure question without deflection", () => {
    expect(
      detectDefensiveness(
        "Tell me about a mistake you made.",
        "I shipped without enough testing — that was on me.",
      ),
    ).toBe(false);
  });

  it("fires on 'mistake' question + 'out of my control'", () => {
    expect(
      detectDefensiveness(
        "What's a mistake you regret?",
        "Look, it was out of my control by then.",
      ),
    ).toBe(true);
  });

  it("returns false on empty / null inputs", () => {
    expect(detectDefensiveness(null, "wasn't my call")).toBe(false);
    expect(detectDefensiveness("tell me about a failure", null)).toBe(false);
    expect(detectDefensiveness("", "")).toBe(false);
  });
});

describe("isFailureQuestion", () => {
  it("matches fail / mistake / regret / setback / wrong / missed (whole-word)", () => {
    expect(isFailureQuestion("a fail you've had")).toBe(true);
    expect(isFailureQuestion("a mistake you made")).toBe(true);
    expect(isFailureQuestion("something you regret")).toBe(true);
    expect(isFailureQuestion("a setback you faced")).toBe(true);
    expect(isFailureQuestion("a time you got it wrong")).toBe(true);
    expect(isFailureQuestion("a deadline you missed")).toBe(true);
  });

  it("does not match unrelated prompts", () => {
    expect(isFailureQuestion("tell me about a success")).toBe(false);
    expect(isFailureQuestion(null)).toBe(false);
  });
});

describe("detectBehaviouralAnswerSignals — bundle", () => {
  it("returns all four signals", () => {
    const sig = detectBehaviouralAnswerSignals({
      questionText: "Tell me about a mistake.",
      answer: "In hindsight, I should have done it differently — but the team didn't follow through.",
    });
    expect(sig.selfAwarenessShown).toBe(true);
    expect(sig.defensiveness).toBe(true);
    expect(sig.crispness).toBe("thin");
    // 'differently' contains no scale word so vagueness off.
    expect(typeof sig.vagueness).toBe("boolean");
  });

  it("handles missing inputs cleanly", () => {
    const sig = detectBehaviouralAnswerSignals({});
    expect(sig.vagueness).toBe(false);
    expect(sig.crispness).toBe("thin");
    expect(sig.selfAwarenessShown).toBe(false);
    expect(sig.defensiveness).toBe(false);
  });
});
