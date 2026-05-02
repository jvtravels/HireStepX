import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizePersona,
  PERSONA_NORM,
  REACTIONS,
  SILENCE_NUDGES,
  isIDontKnowAnswer,
  assessAnswerQuality,
  pickPersonality,
  pickRandom,
  randomDelay,
} from "../_interview-engine-helpers";

describe("normalizePersona", () => {
  it("normalizes the canonical lowercase forms to title-case display names", () => {
    expect(normalizePersona("hiring manager")).toBe("Hiring Manager");
    expect(normalizePersona("technical lead")).toBe("Technical Lead");
    expect(normalizePersona("hr partner")).toBe("HR Partner");
  });

  it("matches case-insensitively on the lookup", () => {
    expect(normalizePersona("HIRING MANAGER")).toBe("Hiring Manager");
    expect(normalizePersona("Hiring Manager")).toBe("Hiring Manager");
    expect(normalizePersona("TECHNICAL LEAD")).toBe("Technical Lead");
  });

  it("returns the original string verbatim for unknown personas", () => {
    // Critical: panel logic depends on round-tripping unknown personas
    // unchanged, otherwise custom interviewer titles get clobbered.
    expect(normalizePersona("Founding Engineer")).toBe("Founding Engineer");
    expect(normalizePersona("CTO")).toBe("CTO");
  });

  it("PERSONA_NORM stays in sync with the three documented panel personas", () => {
    expect(Object.keys(PERSONA_NORM).sort()).toEqual([
      "hiring manager",
      "hr partner",
      "technical lead",
    ]);
  });
});

describe("isIDontKnowAnswer", () => {
  it("returns false for empty / very short input (under 5 chars)", () => {
    expect(isIDontKnowAnswer("")).toBe(false);
    expect(isIDontKnowAnswer("idk")).toBe(false);
    expect(isIDontKnowAnswer("no")).toBe(false);
  });

  it("matches canonical surrender openers (anchored at the start)", () => {
    expect(isIDontKnowAnswer("I don't know how to answer that")).toBe(true);
    expect(isIDontKnowAnswer("I dont know honestly")).toBe(true);
    expect(isIDontKnowAnswer("I'm not sure about that one")).toBe(true);
    expect(isIDontKnowAnswer("I have no idea, sorry")).toBe(true);
    expect(isIDontKnowAnswer("I can't think of an example")).toBe(true);
    expect(isIDontKnowAnswer("Nothing comes to mind right now")).toBe(true);
    expect(isIDontKnowAnswer("I haven't done that before")).toBe(true);
    expect(isIDontKnowAnswer("No experience with that")).toBe(true);
    expect(isIDontKnowAnswer("I don't have an example for that")).toBe(true);
  });

  it("matches surrender command tokens like 'pass' and 'I'll skip'", () => {
    // The bare command 'pass ' (5 chars including trailing space, trims
    // down to 'pass' which matches the ^pass$ pattern). Note: 'skip'
    // alone is 4 chars and is rejected by the <5-char early-return —
    // we deliberately don't flag ambiguous 4-char inputs.
    expect(isIDontKnowAnswer("pass ")).toBe(true);
    expect(isIDontKnowAnswer("skip")).toBe(false);
    expect(isIDontKnowAnswer("I'll skip this one")).toBe(true);
  });

  it("matches a short answer that contains 'don't know' even mid-sentence", () => {
    // The fallback heuristic: <30 chars + a known surrender phrase
    expect(isIDontKnowAnswer("hmm I don't know really")).toBe(true);
    expect(isIDontKnowAnswer("um not sure to be honest")).toBe(true);
  });

  it("does NOT use the substring fallback for long answers (>= 30 chars)", () => {
    // The substring fallback ("don't know|not sure|...") is gated on
    // length < 30. A long answer that hedges mid-sentence shouldn't be
    // flagged unless it ALSO opens with a surrender phrase.
    const long =
      "We had real momentum — I would not say I'm uncertain, the team executed well and we shipped on schedule with measurable wins for the quarter.";
    expect(isIDontKnowAnswer(long)).toBe(false);
  });

  it("does NOT flag normal substantive answers", () => {
    expect(
      isIDontKnowAnswer(
        "I led a team of four engineers to redesign our checkout flow.",
      ),
    ).toBe(false);
    expect(
      isIDontKnowAnswer("My biggest weakness is over-engineering early on."),
    ).toBe(false);
  });

  it("is case-insensitive on the leading 'I'", () => {
    expect(isIDontKnowAnswer("i don't know")).toBe(true);
    expect(isIDontKnowAnswer("I DON'T KNOW")).toBe(true);
  });

  it("trims whitespace before matching the leading anchor", () => {
    expect(isIDontKnowAnswer("   I don't know how to answer")).toBe(true);
  });
});

describe("assessAnswerQuality", () => {
  it("returns 'short' for empty / very short inputs", () => {
    expect(assessAnswerQuality("")).toBe("short");
    expect(assessAnswerQuality("yes")).toBe("short");
    expect(assessAnswerQuality("Sure thing.")).toBe("short");
  });

  it("returns 'short' for stub placeholder answers from the recorder", () => {
    // Important: when STT failed the engine writes "[Answer recorded …]"
    // as a placeholder; we must never treat that as a strong answer.
    expect(
      assessAnswerQuality("[Answer recorded — transcription unavailable]"),
    ).toBe("short");
  });

  it("returns 'short' for answers under 25 words even if substantive", () => {
    // Word-count gate dominates length-in-chars
    const twentyWords = "I led the project end to end and shipped on time meeting all of our quarterly goals fully done.";
    // ^ 20 words
    expect(assessAnswerQuality(twentyWords)).toBe("short");
  });

  it("returns 'strong' when 3+ quality signals AND >= 50 words", () => {
    // metrics ✓ structure ✓ first-person ✓ specific ✓ — all four signals
    const answer =
      "At my last role I led a migration that took six months. First, I audited every service. Then I wrote the runbook. Finally we cut over with zero downtime. The result was a 40% drop in latency and we saved ₹50,000 per month on infra. For example, the search service alone went from 800ms to 200ms p99.";
    expect(assessAnswerQuality(answer)).toBe("strong");
  });

  it("returns 'decent' with 1-2 signals and >= 35 words", () => {
    // Has first-person but no metrics / structure / specifics. ~36 words.
    const answer =
      "I worked on a migration project that took several months to complete and I was responsible for coordinating across multiple teams to get it across the finish line for the broader engineering organization here at our company today.";
    const result = assessAnswerQuality(answer);
    expect(result).toBe("decent");
  });

  it("returns 'weak' when there are no quality signals despite enough words", () => {
    // 30+ words, no metrics, no structure cues, no 'I', no specific markers.
    const answer =
      "the project was completed and the team finished things and stuff happened and then more stuff happened and we kept going and going and on and on and forever it seemed honestly truly really.";
    expect(assessAnswerQuality(answer)).toBe("weak");
  });

  it("rewards numeric metrics as a quality signal", () => {
    // 50+ words but only ONE signal (metrics + first-person → 2 signals)
    // -> decent, not strong (needs 3+ signals for strong).
    const answer =
      "I shipped a feature and saw a 25% improvement in the conversion rate over six months. I led the rollout. I worked with marketing and design. I worked with eng. I worked with PM. I worked with QA. I worked carefully and thoughtfully and patiently and steadily.";
    expect(assessAnswerQuality(answer)).toBe("decent");
  });

  it("recognizes Indian rupee metrics (₹) as a quantitative signal", () => {
    // Metrics ✓ first-person ✓ structure ✓ specific ✓ — all four, 50+ words
    const answer =
      "At my last role I owned the cost-optimization initiative. First I audited cloud spend, then I negotiated with vendors, finally I migrated workloads. We saved ₹12,00,000 per quarter as a result. For example we shut down idle dev clusters every Friday night and brought them back on Monday morning automatically.";
    expect(assessAnswerQuality(answer)).toBe("strong");
  });
});

describe("pickPersonality", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'tough' when the random roll is in [0, 0.3)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickPersonality()).toBe("tough");
    vi.spyOn(Math, "random").mockReturnValue(0.29);
    expect(pickPersonality()).toBe("tough");
  });

  it("returns 'friendly' when the random roll is in [0.3, 0.55)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    expect(pickPersonality()).toBe("friendly");
    vi.spyOn(Math, "random").mockReturnValue(0.54);
    expect(pickPersonality()).toBe("friendly");
  });

  it("returns 'time-pressed' when the random roll is in [0.55, 0.7)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    expect(pickPersonality()).toBe("time-pressed");
    vi.spyOn(Math, "random").mockReturnValue(0.69);
    expect(pickPersonality()).toBe("time-pressed");
  });

  it("returns 'balanced' when the random roll is in [0.7, 1)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    expect(pickPersonality()).toBe("balanced");
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickPersonality()).toBe("balanced");
  });

  it("never returns an unrecognized personality across many rolls", () => {
    const allowed = new Set(["tough", "friendly", "time-pressed", "balanced"]);
    for (let i = 0; i < 100; i++) {
      expect(allowed.has(pickPersonality())).toBe(true);
    }
  });
});

describe("pickRandom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first element when Math.random() is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRandom([1, 2, 3])).toBe(1);
  });

  it("returns the last element when Math.random() is just under 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    expect(pickRandom(["a", "b", "c"])).toBe("c");
  });

  it("indexes into the middle for mid-range rolls", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(pickRandom([10, 20, 30, 40])).toBe(30); // floor(0.5 * 4) = 2
  });

  it("only ever returns elements actually present in the array", () => {
    const pool = ["x", "y", "z"];
    for (let i = 0; i < 50; i++) {
      expect(pool).toContain(pickRandom(pool));
    }
  });
});

describe("randomDelay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the minimum when Math.random() is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(randomDelay(100, 500)).toBe(100);
  });

  it("returns just under max when Math.random() is just under 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    expect(randomDelay(100, 500)).toBe(499);
  });

  it("stays within the [min, max) interval across many rolls", () => {
    for (let i = 0; i < 200; i++) {
      const v = randomDelay(200, 800);
      expect(v).toBeGreaterThanOrEqual(200);
      expect(v).toBeLessThan(800);
    }
  });

  it("returns an integer (the engine passes this directly to setTimeout)", () => {
    for (let i = 0; i < 20; i++) {
      const v = randomDelay(50, 300);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("REACTIONS bank", () => {
  it("exposes every category the engine relies on", () => {
    // Pin the keys so a typo in the engine's REACTIONS["topicTrnasition"]
    // surfaces here as a missing-key test failure.
    const expected = [
      "strong",
      "decent",
      "weak",
      "short",
      "followUpBridge",
      "topicTransition",
      "dontKnowRedirect",
      "ramblingInterject",
      "softTracking",
      "timePressure",
      "lastQuestion",
    ].sort();
    expect(Object.keys(REACTIONS).sort()).toEqual(expected);
  });

  it("never has an empty bank (pickRandom would return undefined)", () => {
    for (const key of Object.keys(REACTIONS) as (keyof typeof REACTIONS)[]) {
      expect(REACTIONS[key].length).toBeGreaterThan(0);
    }
  });

  it("every reaction is a non-empty string", () => {
    for (const key of Object.keys(REACTIONS) as (keyof typeof REACTIONS)[]) {
      for (const phrase of REACTIONS[key]) {
        expect(typeof phrase).toBe("string");
        expect(phrase.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("SILENCE_NUDGES", () => {
  it("has at least a handful of variants so users don't hear the same nudge twice in a row", () => {
    expect(SILENCE_NUDGES.length).toBeGreaterThanOrEqual(4);
  });

  it("contains only non-empty strings", () => {
    for (const nudge of SILENCE_NUDGES) {
      expect(typeof nudge).toBe("string");
      expect(nudge.length).toBeGreaterThan(0);
    }
  });
});
