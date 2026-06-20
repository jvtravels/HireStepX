/* eslint-disable @typescript-eslint/no-explicit-any -- test file: partial mock objects require any casts */
import { describe, it, expect } from "vitest";
import { scriptsByType, defaultScript, getMiniScript, getScript, scriptHasQuestion } from "../interviewScripts";
import type { InterviewStep } from "../interviewScripts";

const step = (type: InterviewStep["type"], aiText = "x".repeat(20)): InterviewStep => ({
  type, aiText, thinkingDuration: 100, speakingDuration: 100, waitForUser: true,
});

describe("interviewScripts", () => {
  describe("scriptsByType", () => {
    it("has all 4 interview types", () => {
      expect(Object.keys(scriptsByType)).toEqual(
        expect.arrayContaining(["behavioral", "strategic", "technical", "case-study"])
      );
    });

    it.each(Object.keys(scriptsByType))("%s script starts with intro and ends with closing", (type) => {
      const script = scriptsByType[type];
      expect(script.length).toBeGreaterThanOrEqual(3);
      expect(script[0].type).toBe("intro");
      expect(script[script.length - 1].type).toBe("closing");
    });

    it.each(Object.keys(scriptsByType))("%s script has all required fields on every step", (type) => {
      for (const step of scriptsByType[type]) {
        expect(step.aiText).toBeTruthy();
        expect(step.aiText.length).toBeGreaterThan(10);
        expect(step.thinkingDuration).toBeGreaterThan(0);
        expect(step.speakingDuration).toBeGreaterThan(0);
        expect(typeof step.waitForUser).toBe("boolean");
      }
    });

    it.each(Object.keys(scriptsByType))("%s closing step is a sign-off (no dead-end question)", (type) => {
      const script = scriptsByType[type];
      const closing = script.find(s => s.type === "closing");
      // Closings now sign off and auto-advance to the report — no waitForUser
      // dead-end. The handleEnd effect on phase=done finalizes the session.
      expect(closing?.waitForUser).toBe(false);
    });

    it.each(Object.keys(scriptsByType))("%s has 3–5 questions", (type) => {
      const questions = scriptsByType[type].filter(s => s.type === "question");
      expect(questions.length).toBeGreaterThanOrEqual(3);
      // Salary-negotiation has 5 questions for a longer conversation arc
      expect(questions.length).toBeLessThanOrEqual(5);
    });
  });

  describe("defaultScript", () => {
    it("is the behavioral script", () => {
      expect(defaultScript).toBe(scriptsByType.behavioral);
    });
  });

  describe("getMiniScript", () => {
    it("generates 5 steps (intro + 3 questions + closing)", () => {
      const script = getMiniScript(null);
      expect(script.length).toBe(5);
      expect(script[0].type).toBe("intro");
      expect(script[1].type).toBe("question");
      expect(script[2].type).toBe("question");
      expect(script[3].type).toBe("question");
      expect(script[4].type).toBe("closing");
    });

    it("personalizes intro with user name", () => {
      const script = getMiniScript({ name: "Alice", targetRole: "SRE" } as any);
      expect(script[0].aiText).toContain("Alice");
      expect(script[0].aiText).toContain("SRE");
    });

    it("uses generic text when no user", () => {
      const script = getMiniScript(null);
      expect(script[0].aiText).toContain("the role");
      expect(script[0].aiText).not.toContain("undefined");
    });

    it("includes resume context when user has resume", () => {
      const user = {
        name: "Bob",
        targetRole: "CTO",
        resumeFileName: "resume.pdf",
        // Use the discriminated-union fallback variant; intro line only
        // reads experience from fallback resumes (AI variant carries
        // headline/topSkills instead).
        resumeData: { _type: "fallback", experience: [{ title: "VP Engineering", company: "Acme" }] },
      } as any;
      const script = getMiniScript(user);
      // Intro always mentions resume context
      expect(script[0].aiText).toContain("VP Engineering");
      expect(script[0].aiText).toContain("Acme");
      // At least one question should reference the resume title (randomized pool)
      const questionTexts = script.filter(s => s.type === "question").map(s => s.aiText);
      const hasResumeRef = questionTexts.some(t => t.includes("VP Engineering"));
      expect(hasResumeRef).toBe(true);
    });

    it("all steps wait for user except the closing sign-off", () => {
      const script = getMiniScript(null);
      for (const step of script) {
        if (step.type === "closing") {
          expect(step.waitForUser).toBe(false);
        } else {
          expect(step.waitForUser).toBe(true);
        }
      }
    });
  });

  describe("getScript", () => {
    it("returns personalized behavioral script by default", () => {
      const script = getScript(null, null, null);
      // intro + 5 randomized questions + reverse-interview closing turn + closing = 8
      expect(script.length).toBe(8);
      expect(script[0].type).toBe("intro");
      expect(script[0].aiText).toContain("behavioral");
    });

    it("inserts a reverse-interview closing turn before the final closing for behavioural-class scripts", () => {
      const script = getScript(null, null, null);
      const penultimate = script[script.length - 2];
      expect(penultimate.type).toBe("question");
      expect(penultimate.aiText.toLowerCase()).toMatch(/any questions for me|questions for me\??/);
      expect(penultimate.waitForUser).toBe(true);
    });

    it("does NOT insert a reverse-interview turn for salary-negotiation scripts", () => {
      const script = getScript("salary-negotiation", null, null);
      const reverseStep = script.find((s) => s.type === "question" && /any questions for me/i.test(s.aiText));
      expect(reverseStep).toBeUndefined();
    });

    it("returns correct type when specified", () => {
      const script = getScript("technical", null, null);
      expect(script[0].aiText).toContain("technical");
    });

    it("personalizes with user name and company", () => {
      const user = { name: "Charlie Brown", targetRole: "CTO", targetCompany: "Google", industry: "tech" } as any;
      const script = getScript("strategic", "standard", user);
      expect(script[0].aiText).toContain("Charlie");
      expect(script[0].aiText).toContain("CTO");
      expect(script[0].aiText).toContain("Google");
    });

    it("adjusts durations for warmup difficulty", () => {
      const warmup = getScript("behavioral", "warmup", null);
      const standard = getScript("behavioral", "standard", null);
      // Warmup should have longer speaking durations (1.4x)
      expect(warmup[0].speakingDuration).toBeGreaterThan(standard[0].speakingDuration);
      // Warmup should have longer thinking durations (1.5x)
      expect(warmup[0].thinkingDuration).toBeGreaterThan(standard[0].thinkingDuration);
    });

    it("adjusts durations for intense difficulty", () => {
      const intense = getScript("behavioral", "intense", null);
      const standard = getScript("behavioral", "standard", null);
      // Intense should have shorter durations
      expect(intense[0].speakingDuration).toBeLessThan(standard[0].speakingDuration);
      expect(intense[0].thinkingDuration).toBeLessThan(standard[0].thinkingDuration);
    });

    it("closing is a sign-off (no learning-style canned prefix anymore)", () => {
      const user = { learningStyle: "encouraging" } as any;
      const script = getScript("behavioral", null, user);
      const closing = script[script.length - 1];
      // Closings now sign off and reference report generation; the per-style
      // "Really great work" / "direct feedback" prefixes were removed when
      // we killed the canned per-focus closing feedback.
      expect(closing.aiText).toMatch(/report/i);
    });

    it("adds resume context when user has resume", () => {
      const user = { resumeFileName: "cv.pdf" } as any;
      const script = getScript("behavioral", null, user);
      expect(script[0].aiText).toContain("resume");
    });

    it("closing step is a sign-off — auto-advances, doesn't wait", () => {
      const script = getScript("technical", "intense", null);
      const closing = script[script.length - 1];
      expect(closing.waitForUser).toBe(false);
    });
  });

  describe("scriptHasQuestion — the 0-of-0 invariant", () => {
    it("is true for a normal [intro, question, closing] script", () => {
      expect(scriptHasQuestion([step("intro"), step("question"), step("closing")])).toBe(true);
    });

    it("is true when only a follow-up is present (dynamic turns count)", () => {
      expect(scriptHasQuestion([step("intro"), step("follow-up")])).toBe(true);
    });

    it("is FALSE for the degenerate intro+closing-only script (the bug)", () => {
      expect(scriptHasQuestion([step("intro"), step("closing")])).toBe(false);
    });

    it("is FALSE for an intro-only collapse (questions.slice(1) emptied it)", () => {
      expect(scriptHasQuestion([step("intro")])).toBe(false);
    });

    it("is false for an empty array and for null/undefined", () => {
      expect(scriptHasQuestion([])).toBe(false);
      expect(scriptHasQuestion(null)).toBe(false);
      expect(scriptHasQuestion(undefined)).toBe(false);
    });

    it("every getScript output satisfies the invariant", () => {
      for (const type of ["behavioral", "technical", "case-study", "strategic", "hr-round", "salary-negotiation"]) {
        expect(scriptHasQuestion(getScript(type, "standard", null))).toBe(true);
      }
    });
  });
});
