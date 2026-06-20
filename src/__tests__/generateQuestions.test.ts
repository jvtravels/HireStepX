import { describe, it, expect } from "vitest";
import {
  extractQuestionsArray,
  validateQuestionShape,
  normalizePanelPersonas,
  isSalaryNegotiationLengthOk,
  computeStepCount,
  buildStaticFallback,
  flagOffRoleQuestions,
  VALID_PERSONAS,
  type RawQuestion,
} from "../../server-handlers/_generate-questions-helpers";

/**
 * generate-questions is the LLM contract for the interview UI. A shape
 * change in the response — wrong wrapper key, missing aiText, mis-cased
 * persona — silently ships a blank-bubble interview to the candidate.
 * These helpers handle that contract so we can lock the behaviour with
 * tests rather than waiting for a regression in production.
 */

describe("extractQuestionsArray", () => {
  it("returns a bare array unchanged", () => {
    const arr = [{ type: "intro", aiText: "hi" }];
    expect(extractQuestionsArray(arr)).toBe(arr);
  });

  it("unwraps the canonical {questions: [...]} shape", () => {
    const arr = [{ type: "question", aiText: "Q1" }];
    expect(extractQuestionsArray({ questions: arr })).toBe(arr);
  });

  it("unwraps {steps: [...]} (Groq sometimes returns this)", () => {
    const arr = [{ type: "intro", aiText: "hi" }];
    expect(extractQuestionsArray({ steps: arr })).toBe(arr);
  });

  it("unwraps {interview_steps: [...]} (Gemini fallback shape)", () => {
    const arr = [{ type: "closing", aiText: "bye" }];
    expect(extractQuestionsArray({ interview_steps: arr })).toBe(arr);
  });

  it("falls back to first array-valued property when no canonical key matches", () => {
    const arr = [{ type: "question", aiText: "x" }];
    expect(extractQuestionsArray({ irrelevantField: "no", randomKey: arr })).toBe(arr);
  });

  it("returns null for null/string/number inputs", () => {
    expect(extractQuestionsArray(null)).toBeNull();
    expect(extractQuestionsArray("string")).toBeNull();
    expect(extractQuestionsArray(42)).toBeNull();
  });

  it("returns null when no array is found anywhere", () => {
    expect(extractQuestionsArray({ foo: "bar", n: 1 })).toBeNull();
  });
});

describe("validateQuestionShape", () => {
  it("rejects empty arrays — empty interviews are a hard failure", () => {
    expect(validateQuestionShape([])).toBe(false);
  });

  it("rejects steps missing aiText (would render as blank avatar bubble)", () => {
    expect(validateQuestionShape([{ type: "question" }])).toBe(false);
    expect(validateQuestionShape([{ type: "question", aiText: "" }])).toBe(false);
  });

  it("rejects steps missing type", () => {
    expect(validateQuestionShape([{ aiText: "hello" }])).toBe(false);
  });

  it("rejects steps where aiText is not a string", () => {
    expect(validateQuestionShape([{ type: "intro", aiText: 42 }])).toBe(false);
    expect(validateQuestionShape([{ type: "intro", aiText: null }])).toBe(false);
  });

  it("accepts a minimal valid sequence", () => {
    expect(
      validateQuestionShape([
        { type: "intro", aiText: "Welcome" },
        { type: "question", aiText: "Q1" },
        { type: "closing", aiText: "Thanks" },
      ]),
    ).toBe(true);
  });

  it("rejects when ANY single step is malformed", () => {
    expect(
      validateQuestionShape([
        { type: "intro", aiText: "Welcome" },
        { type: "question" }, // missing aiText
        { type: "closing", aiText: "Thanks" },
      ]),
    ).toBe(false);
  });
});

describe("normalizePanelPersonas", () => {
  it("preserves a valid persona regardless of casing", () => {
    const qs: RawQuestion[] = [{ type: "question", aiText: "x", persona: "hiring manager" }];
    normalizePanelPersonas(qs);
    expect(qs[0].persona).toBe("Hiring Manager");
  });

  it("forces intro and closing to Hiring Manager", () => {
    const qs: RawQuestion[] = [
      { type: "intro", aiText: "hi", persona: "HR Partner" },
      { type: "closing", aiText: "bye" },
    ];
    normalizePanelPersonas(qs);
    expect(qs[0].persona).toBe("HR Partner"); // valid persona preserved
    expect(qs[1].persona).toBe("Hiring Manager"); // missing → forced to HM
  });

  it("round-robins across the three personas for question steps", () => {
    const qs: RawQuestion[] = [
      { type: "question", aiText: "q1" },
      { type: "question", aiText: "q2" },
      { type: "question", aiText: "q3" },
    ];
    normalizePanelPersonas(qs);
    expect(qs.map((q) => q.persona)).toEqual([
      "Hiring Manager",
      "Technical Lead",
      "HR Partner",
    ]);
  });

  it("replaces a hallucinated persona with round-robin assignment", () => {
    const qs: RawQuestion[] = [{ type: "question", aiText: "q", persona: "CEO" }];
    normalizePanelPersonas(qs);
    expect(VALID_PERSONAS).toContain(qs[0].persona as "Hiring Manager");
  });

  it("skips rotation index when a question already has a valid persona", () => {
    const qs: RawQuestion[] = [
      { type: "question", aiText: "q1", persona: "HR Partner" },
      { type: "question", aiText: "q2" }, // gets first rotation slot
    ];
    normalizePanelPersonas(qs);
    expect(qs[0].persona).toBe("HR Partner");
    expect(qs[1].persona).toBe("Hiring Manager"); // rotIdx=0
  });
});

describe("isSalaryNegotiationLengthOk", () => {
  /* Salary-neg arc reduced from 5+ questions to a 3-step anchor (intro +
     initial offer + closing). The NegotiationKernel owns every in-between
     turn at runtime, so the script length floor drops from 4 to 3. */
  it("requires at least 3 turns (intro+offer+closing) for salary negotiation", () => {
    expect(isSalaryNegotiationLengthOk(true, 2)).toBe(false);
    expect(isSalaryNegotiationLengthOk(true, 3)).toBe(true);
    expect(isSalaryNegotiationLengthOk(true, 7)).toBe(true);
  });

  it("does not gate non-salary interviews on length", () => {
    expect(isSalaryNegotiationLengthOk(false, 1)).toBe(true);
    expect(isSalaryNegotiationLengthOk(false, 0)).toBe(true);
  });
});

describe("computeStepCount", () => {
  it("regular session = 5 questions + intro/closing = 7", () => {
    expect(computeStepCount({ mini: false, isSalaryType: false })).toBe(7);
  });

  it("mini behavioral = 3 questions + intro/closing = 5", () => {
    expect(computeStepCount({ mini: true, isSalaryType: false })).toBe(5);
  });

  it("salary-negotiation is fixed at 3 steps regardless of mini flag — kernel owns the middle", () => {
    expect(computeStepCount({ mini: true, isSalaryType: true })).toBe(3);
    expect(computeStepCount({ mini: false, isSalaryType: true })).toBe(3);
  });
});

/* buildStaticFallback is what users get when both LLM providers fail. The
 * shape contract is the same as the LLM path (validateQuestionShape passes)
 * and the count is at least intro + main questions + closing. */
describe("buildStaticFallback", () => {
  it("returns a shape-valid set with intro + closing", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "behavioral",
      difficulty: "standard",
      roleFamily: "pm",
      count: 5,
    });
    expect(qs.length).toBeGreaterThanOrEqual(7);
    expect(qs[0].type).toBe("intro");
    expect(qs[qs.length - 1].type).toBe("closing");
    expect(validateQuestionShape(qs as unknown[])).toBe(true);
  });

  it("falls through to behavioral when role+focus has no entries", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "case-study",
      difficulty: "standard",
      // Intentionally bogus role family to force tier-3 fallback.
      roleFamily: "nonexistent-role" as unknown as string,
      count: 5,
    });
    expect(qs.length).toBeGreaterThanOrEqual(7);
    expect(validateQuestionShape(qs as unknown[])).toBe(true);
  });

  it("never returns blank aiText", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "general",
      difficulty: "standard",
      roleFamily: "general",
      count: 5,
    });
    for (const q of qs) {
      expect(q.aiText.length).toBeGreaterThan(0);
    }
  });

  /* Regression (live QA, 2026-06): a Senior Product Designer's behavioural
     session arrived with focus:"general" (not "behavioral"). Keying the
     behavioural branch on focus alone let it fall through to the cross-role
     QUESTION_BANK tier-3, which served a `swe`-tagged "owned an outage / what
     did the post-mortem change?" — wrong discipline. The branch now also
     matches on TYPE, and the curated bank is role-steered. */
  it("serves curated behavioural questions for a behavioural TYPE even when focus is 'general'", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "general",
      difficulty: "standard",
      roleFamily: "designer-senior",
      experienceLevel: "senior",
      count: 5,
    });
    const body = qs.filter((q) => q.type === "warmup" || q.type === "main");
    expect(body.length).toBeGreaterThan(0);
    // Curated BEHAVIORAL_50 path stamps "Competency:"; the QUESTION_BANK
    // tier path stamps a styleNote — so this proves we took the curated path.
    expect(body.every((q) => (q.scoreNote || "").startsWith("Competency:"))).toBe(true);
    // The specific SWE question a designer must never receive here.
    expect(body.some((q) => /owned an outage|post-mortem/i.test(q.aiText))).toBe(false);
  });

  /* Regression: HR-round sessions arrive with type "hr-round" but the
     curated bank's FocusArea is "hr". Before the dedicated HR branch the
     fallback never bridged them, so an HR session degraded to behavioural
     STAR prompts — the wrong prep. These lock in real HR questions. */
  it("returns HR questions for an hr-round type (not behavioural STAR)", () => {
    const qs = buildStaticFallback({
      type: "hr-round",
      focus: "general",
      difficulty: "standard",
      roleFamily: "general",
      count: 5,
    });
    expect(qs.length).toBeGreaterThanOrEqual(7);
    expect(qs[0].type).toBe("intro");
    expect(qs[qs.length - 1].type).toBe("closing");
    expect(validateQuestionShape(qs as unknown[])).toBe(true);
    const body = qs.filter((q) => q.type === "warmup" || q.type === "main");
    // HR body items are tagged with their HR dimension; behavioural ones
    // would carry a "Competency:" note instead.
    expect(body.every((q) => (q.scoreNote || "").startsWith("HR dimension:"))).toBe(true);
    // And not a single one is a STAR "Tell me about a time" behavioural probe.
    expect(body.some((q) => /tell me about a time/i.test(q.aiText))).toBe(false);

    // Regression: the intro IS the "tell me about yourself" opener, so the
    // body must not re-ask for the candidate's background. (Before the
    // opener-exclusion fix, the highest-frequency "walk me through your
    // background" question front-loaded into the body, asking it twice.)
    const asksBackground = (t: string) =>
      /walk me through your background|tell me (a little |a bit )?about yourself/i.test(t);
    expect(asksBackground(qs[0].aiText)).toBe(true); // intro opens with it
    expect(body.some((q) => asksBackground(q.aiText))).toBe(false); // body never repeats it
  });

  it("also serves HR questions when focus is 'hr' regardless of type", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "hr",
      difficulty: "standard",
      roleFamily: "swe",
      count: 4,
    });
    const body = qs.filter((q) => q.type === "warmup" || q.type === "main");
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((q) => (q.scoreNote || "").startsWith("HR dimension:"))).toBe(true);
  });
});


describe("flagOffRoleQuestions", () => {
  it("returns empty when roleFamily is undefined", () => {
    const qs: RawQuestion[] = [{ type: "question", aiText: "Walk me through sharding strategy." }];
    expect(flagOffRoleQuestions(qs, undefined)).toEqual([]);
  });

  it("flags a SQL JOIN / sharding question for a designer", () => {
    const qs: RawQuestion[] = [
      { type: "intro", aiText: "Hi" },
      { type: "question", aiText: "Tell me about a recent product you designed." },
      { type: "question", aiText: "How would you optimize a SQL JOIN on a 50M-row table?" },
      { type: "closing", aiText: "Bye" },
    ];
    expect(flagOffRoleQuestions(qs, "design")).toEqual([2]);
  });

  it("flags a Figma-autolayout question for an engineer", () => {
    const qs: RawQuestion[] = [
      { type: "question", aiText: "Walk me through your Figma autolayout system." },
      { type: "question", aiText: "How would you scale this service?" },
    ];
    expect(flagOffRoleQuestions(qs, "swe")).toEqual([0]);
  });

  it("flags a leetcode question for a sales role", () => {
    const qs: RawQuestion[] = [{ type: "question", aiText: "How would you solve this leetcode problem?" }];
    expect(flagOffRoleQuestions(qs, "sales")).toEqual([0]);
  });

  it("does NOT flag soft-overlap terms (metrics, users, team)", () => {
    const qs: RawQuestion[] = [
      { type: "question", aiText: "What metrics did you track for the team?" },
      { type: "question", aiText: "How did you align with users?" },
    ];
    expect(flagOffRoleQuestions(qs, "design")).toEqual([]);
    expect(flagOffRoleQuestions(qs, "swe")).toEqual([]);
  });

  it("ignores intro and closing steps", () => {
    const qs: RawQuestion[] = [
      { type: "intro", aiText: "Welcome — share your kafka partition strategy." },
      { type: "closing", aiText: "Thanks for the sharding chat." },
    ];
    expect(flagOffRoleQuestions(qs, "design")).toEqual([]);
  });
});
