import { describe, it, expect } from "vitest";
import {
  classifyBehavioralQuestion,
  frameworkFor,
  frameworkDirective,
} from "../_question-category";

/* Pure-classifier tests. Pinned here because the follow-up directive AND
   the evaluator both branch on the category — drift between the two
   surfaces would have the live coach say "PPF" while the report says
   "STAR" for the same question. */

describe("classifyBehavioralQuestion", () => {
  it("self-intro shapes — 'tell me about yourself' / 'walk me through your background'", () => {
    expect(classifyBehavioralQuestion("Tell me about yourself")).toBe("self-intro");
    expect(classifyBehavioralQuestion("Walk me through your background")).toBe("self-intro");
    expect(classifyBehavioralQuestion("Introduce yourself briefly")).toBe("self-intro");
    expect(classifyBehavioralQuestion("Walk us through your resume")).toBe("self-intro");
  });

  it("motivation shapes — 'why this company / role / are you leaving'", () => {
    expect(classifyBehavioralQuestion("Why this company?")).toBe("motivation");
    expect(classifyBehavioralQuestion("Why do you want this role?")).toBe("motivation");
    expect(classifyBehavioralQuestion("Why are you leaving your current job?")).toBe("motivation");
    expect(classifyBehavioralQuestion("What draws you to our company?")).toBe("motivation");
  });

  it("failure shapes — explicit failure cues, not generic 'tell me about a time'", () => {
    expect(classifyBehavioralQuestion("Tell me about a time you failed")).toBe("failure");
    expect(classifyBehavioralQuestion("Describe a project that didn't go well")).toBe("failure");
    expect(classifyBehavioralQuestion("A mistake you regret")).toBe("failure");
    expect(classifyBehavioralQuestion("When you missed a deadline")).toBe("failure");
  });

  it("conflict shapes — disagreement / push back / difficult conversation", () => {
    expect(classifyBehavioralQuestion("Tell me about a conflict with a coworker")).toBe("conflict");
    expect(classifyBehavioralQuestion("A time you disagreed with your manager")).toBe("conflict");
    expect(classifyBehavioralQuestion("When you had to push back on a stakeholder")).toBe("conflict");
    expect(classifyBehavioralQuestion("A difficult conversation you handled")).toBe("conflict");
  });

  it("generic fallback — story prompts that aren't categorized specifically", () => {
    // Pure STAR territory — should fall through to generic.
    expect(classifyBehavioralQuestion("Tell me about a challenging technical decision")).toBe("generic");
    expect(classifyBehavioralQuestion("Describe a project you shipped")).toBe("generic");
  });

  it("priority: self-intro/motivation win over story prompts", () => {
    // Edge case: "Tell me about yourself and why you want this role"
    // — first regex match wins; self-intro takes precedence.
    expect(classifyBehavioralQuestion("Tell me about yourself and why this role")).toBe("self-intro");
  });

  it("empty / whitespace input → generic", () => {
    expect(classifyBehavioralQuestion("")).toBe("generic");
    expect(classifyBehavioralQuestion("   ")).toBe("generic");
  });

  it("leadership shapes — managing / mentoring teams", () => {
    expect(classifyBehavioralQuestion("Tell me about a time you led a team")).toBe("leadership");
    expect(classifyBehavioralQuestion("How have you mentored junior engineers?")).toBe("leadership");
  });
});

describe("frameworkFor", () => {
  it("maps each category to the correct framework name", () => {
    expect(frameworkFor("self-intro")).toBe("PPF");
    expect(frameworkFor("motivation")).toBe("HEF");
    expect(frameworkFor("failure")).toBe("SOAR");
    expect(frameworkFor("conflict")).toBe("SBI");
    expect(frameworkFor("leadership")).toBe("STAR");
    expect(frameworkFor("ambiguity")).toBe("STAR");
    expect(frameworkFor("achievement")).toBe("STAR");
    expect(frameworkFor("generic")).toBe("STAR");
  });
});

describe("frameworkDirective", () => {
  it("returns empty string for STAR categories (no override needed)", () => {
    expect(frameworkDirective("generic")).toBe("");
    expect(frameworkDirective("leadership")).toBe("");
    expect(frameworkDirective("achievement")).toBe("");
    expect(frameworkDirective("ambiguity")).toBe("");
  });

  it("returns a non-empty directive for non-STAR categories", () => {
    expect(frameworkDirective("self-intro").length).toBeGreaterThan(20);
    expect(frameworkDirective("motivation").length).toBeGreaterThan(20);
    expect(frameworkDirective("failure").length).toBeGreaterThan(20);
    expect(frameworkDirective("conflict").length).toBeGreaterThan(20);
  });

  it("self-intro directive forbids STAR decomposition", () => {
    const d = frameworkDirective("self-intro");
    expect(d).toMatch(/PPF|Present.*Past.*Future/);
    expect(d).toMatch(/NOT STAR/i);
  });

  it("failure directive asks about learning, not more action detail", () => {
    const d = frameworkDirective("failure");
    expect(d).toMatch(/SOAR|learn|learning/i);
  });

  it("conflict directive asks about self-reflection, not other-party blame", () => {
    const d = frameworkDirective("conflict");
    expect(d).toMatch(/SBI|Behavior|Behaviour/i);
  });
});
