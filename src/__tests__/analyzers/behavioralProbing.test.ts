import { describe, it, expect } from "vitest";
import {
  classifyAiProbe,
  classifyFailureResponse,
  hasLearningReflection,
  isFailureQuestion,
  isVagueAnswer,
} from "../../../server-handlers/analyzers/_behavioral-probing";

/* Behavioral probing-depth — Phase 3 unit tests.
 *
 * Pin the regex set the analyzer uses to flag "AI rolled past a
 * vague answer" / "candidate deflected on the failure question".
 * Each detector: one positive phrasing that MUST fire, one similar
 * surface that MUST NOT. */

describe("classifyAiProbe", () => {
  it("fires depth on 'walk me through' / 'how specifically'", () => {
    expect(classifyAiProbe("Walk me through how you decided.").probedDepth).toBe(true);
    expect(classifyAiProbe("How specifically did you measure that?").probedDepth).toBe(true);
    expect(classifyAiProbe("Tell me more about the rollback path.").probedDepth).toBe(true);
  });

  it("does not fire depth on yes/no follow-ups", () => {
    expect(classifyAiProbe("Did you ship it?").probedDepth).toBe(false);
    expect(classifyAiProbe("Got it, thanks.").probedDepth).toBe(false);
  });

  it("fires ownership on 'what did you specifically do'", () => {
    expect(classifyAiProbe("What did you personally do here?").probedOwnership).toBe(true);
    expect(classifyAiProbe("What was your specific role in that?").probedOwnership).toBe(true);
    expect(classifyAiProbe("Where did you come in?").probedOwnership).toBe(true);
  });

  it("does not fire ownership on team-level questions", () => {
    expect(classifyAiProbe("What did the team do?").probedOwnership).toBe(false);
    expect(classifyAiProbe("What was the outcome?").probedOwnership).toBe(false);
  });
});

describe("isVagueAnswer", () => {
  it("fires on collective framing without first-person action", () => {
    expect(
      isVagueAnswer(
        "We kind of figured it out as a team and everyone pitched in. The team handled it well and things sort of worked out.",
      ),
    ).toBe(true);
  });

  it("does not fire when a first-person action verb is present", () => {
    expect(
      isVagueAnswer(
        "We figured it out together but I led the migration and drove the architectural call.",
      ),
    ).toBe(false);
  });

  it("ignores micro-replies", () => {
    expect(isVagueAnswer("yeah we did")).toBe(false);
    expect(isVagueAnswer("")).toBe(false);
  });
});

describe("hasLearningReflection", () => {
  it("fires on first-person reflection phrasing", () => {
    expect(hasLearningReflection("I learned to validate assumptions earlier.")).toBe(true);
    expect(hasLearningReflection("In hindsight I would have spec'd it first.")).toBe(true);
    expect(hasLearningReflection("The biggest lesson for me was to push back sooner.")).toBe(true);
  });

  it("does not fire on generic boilerplate", () => {
    expect(hasLearningReflection("Lessons learned matter in any role.")).toBe(false);
    expect(hasLearningReflection("Learning is important.")).toBe(false);
  });
});

describe("classifyFailureResponse", () => {
  it("classifies ownership phrasing as owns", () => {
    expect(classifyFailureResponse("I underestimated the migration risk and shipped late.")).toBe("owns");
    expect(classifyFailureResponse("My mistake — I should have escalated sooner.")).toBe("owns");
  });

  it("classifies blame routing as deflects", () => {
    expect(classifyFailureResponse("The team didn't deliver on time and management kept changing scope.")).toBe("deflects");
    expect(classifyFailureResponse("The client wouldn't sign off so we couldn't move.")).toBe("deflects");
  });

  it("ownership wins when both signals appear", () => {
    expect(
      classifyFailureResponse(
        "I underestimated the load but the team didn't push back either.",
      ),
    ).toBe("owns");
  });

  it("returns neutral when neither pattern matches", () => {
    expect(classifyFailureResponse("It was a complex situation overall.")).toBe("neutral");
    expect(classifyFailureResponse("")).toBe("neutral");
  });
});

describe("isFailureQuestion", () => {
  it("fires on failure / mistake / setback prompts", () => {
    expect(isFailureQuestion("Tell me about a time you failed.")).toBe(true);
    expect(isFailureQuestion("What was your biggest mistake?")).toBe(true);
    expect(isFailureQuestion("Talk about a setback you've had.")).toBe(true);
    expect(isFailureQuestion("Tell me about something that didn't go well.")).toBe(true);
  });

  it("does not fire on success-framed prompts", () => {
    expect(isFailureQuestion("Tell me about a time you led a team.")).toBe(false);
    expect(isFailureQuestion("What was your biggest win?")).toBe(false);
  });
});
