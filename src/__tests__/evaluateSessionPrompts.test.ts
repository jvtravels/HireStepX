import { describe, it, expect } from "vitest";
import {
  GROUNDING_DIRECTIVE,
  FAIRNESS_DIRECTIVE,
  LENGTH_TARGETS_DIRECTIVE,
  SELF_CHECK_DIRECTIVE,
  VOICE_DICTION_DIRECTIVE,
  TYPE_RUBRIC_WEIGHTS,
  SUPPORTED_INTERVIEW_TYPES,
  getRubricWeight,
} from "../../server-handlers/_evaluate-session-prompts";

/* These directives are part of the static prompt prefix that Groq's
 * automatic prompt cache keys on. A regression here defeats the cache
 * (every call billed at full price) AND silently changes scoring
 * behavior. Lock the contract. */

describe("static prompt directives", () => {
  it("all four directives are non-empty strings", () => {
    expect(GROUNDING_DIRECTIVE.length).toBeGreaterThan(50);
    expect(FAIRNESS_DIRECTIVE.length).toBeGreaterThan(50);
    expect(LENGTH_TARGETS_DIRECTIVE.length).toBeGreaterThan(50);
    expect(SELF_CHECK_DIRECTIVE.length).toBeGreaterThan(50);
  });

  it("grounding directive demands a transcript quote", () => {
    expect(GROUNDING_DIRECTIVE).toMatch(/quote/i);
    expect(GROUNDING_DIRECTIVE).toMatch(/transcript/i);
  });

  it("fairness directive explicitly bans accent / college / gender penalties", () => {
    expect(FAIRNESS_DIRECTIVE).toMatch(/accent/i);
    expect(FAIRNESS_DIRECTIVE).toMatch(/college/i);
    expect(FAIRNESS_DIRECTIVE).toMatch(/gender/i);
  });

  it("length-targets covers all major formats", () => {
    expect(LENGTH_TARGETS_DIRECTIVE).toMatch(/behavioral/i);
    expect(LENGTH_TARGETS_DIRECTIVE).toMatch(/technical|system-design/i);
    expect(LENGTH_TARGETS_DIRECTIVE).toMatch(/case-study|case study/i);
    expect(LENGTH_TARGETS_DIRECTIVE).toMatch(/salary-negotiation|salary negotiation/i);
  });

  it("self-check directive forbids fabrication", () => {
    expect(SELF_CHECK_DIRECTIVE).toMatch(/fabricate|fabrication|never/i);
  });
});

/* VOICE_DICTION_DIRECTIVE is shared by evaluate.ts (quick eval) and
 * mirrors the inline block in evaluate-session.ts. It exists because the
 * quick evaluator had NO register guard, so "Delve deeper", "leverage",
 * etc. leaked verbatim into the candidate-facing coaching copy (observed
 * live on staging). These assertions lock the worst offenders. */
describe("VOICE_DICTION_DIRECTIVE", () => {
  it("is a non-trivial directive", () => {
    expect(VOICE_DICTION_DIRECTIVE.length).toBeGreaterThan(120);
    expect(VOICE_DICTION_DIRECTIVE).toMatch(/banned/i);
  });

  it("explicitly bans 'delve' — the LLM tell observed in live coaching copy", () => {
    expect(VOICE_DICTION_DIRECTIVE).toMatch(/delve/i);
  });

  it("bans the other canonical LLM-isms", () => {
    expect(VOICE_DICTION_DIRECTIVE).toMatch(/leverage/i);
    expect(VOICE_DICTION_DIRECTIVE).toMatch(/utilize/i);
    expect(VOICE_DICTION_DIRECTIVE).toMatch(/robust|seamless|world-class/i);
  });

  it("applies to the candidate-facing prose fields", () => {
    expect(VOICE_DICTION_DIRECTIVE).toMatch(/feedback|improvements|strengths/i);
  });
});

/* TYPE_RUBRIC_WEIGHTS coverage — a missing entry silently falls through
 * to no-weighting, which means the LLM scores a salary-negotiation answer
 * the same way it scores a behavioral one. This test catches that drift. */

describe("TYPE_RUBRIC_WEIGHTS coverage", () => {
  /* Every interview type the app exposes must have a rubric weight. If a
   * new type is added to question-taxonomy without a weight here, this
   * test will fail (assuming the test is updated to include the new
   * type). For now we lock the current 10. */
  const REQUIRED_TYPES = [
    "behavioral",
    "case-study",
    "technical",
    "strategic",
    "management",
    "hr-round",
    "campus-placement",
    "salary-negotiation",
    "panel",
    "government-psu",
  ];

  it("has a rubric weight for every required interview type", () => {
    for (const t of REQUIRED_TYPES) {
      expect(TYPE_RUBRIC_WEIGHTS[t]).toBeTruthy();
      expect(TYPE_RUBRIC_WEIGHTS[t].length).toBeGreaterThan(40);
    }
  });

  it("SUPPORTED_INTERVIEW_TYPES matches the rubric weight keys", () => {
    expect([...SUPPORTED_INTERVIEW_TYPES].sort()).toEqual([...REQUIRED_TYPES].sort());
  });

  it("each weight begins with 'Weight HEAVILY' for consistent prompting", () => {
    for (const [type, weight] of Object.entries(TYPE_RUBRIC_WEIGHTS)) {
      expect(weight, `${type} weight should lead with 'Weight HEAVILY'`).toMatch(/^Weight HEAVILY/);
    }
  });

  it("salary-negotiation rubric mentions style + equity literacy", () => {
    // These were specific complaints the user fixed; lock them in.
    const w = TYPE_RUBRIC_WEIGHTS["salary-negotiation"];
    expect(w).toMatch(/style/i);
    expect(w).toMatch(/equity|ESOP/i);
  });
});

describe("getRubricWeight", () => {
  it("returns the matching weight for known types", () => {
    expect(getRubricWeight("behavioral")).toBe(TYPE_RUBRIC_WEIGHTS["behavioral"]);
  });

  it("returns empty string for unknown type", () => {
    expect(getRubricWeight("unknown-format")).toBe("");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(getRubricWeight(null)).toBe("");
    expect(getRubricWeight(undefined)).toBe("");
    expect(getRubricWeight("")).toBe("");
  });
});
