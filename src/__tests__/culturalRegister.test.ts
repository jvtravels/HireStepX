import { describe, it, expect } from "vitest";
import {
  detectCulturalRegister,
  hasAnyIndianRegister,
} from "../_cultural-register";

describe("detectCulturalRegister — hedgedDisagreement", () => {
  it("matches 'with respect, I'd push back'", () => {
    expect(
      detectCulturalRegister("With respect, I'd push back on that timeline.")
        .hedgedDisagreement,
    ).toBe(true);
  });

  it("matches 'respectfully, I disagree'", () => {
    expect(
      detectCulturalRegister("Respectfully, I disagree with the approach.")
        .hedgedDisagreement,
    ).toBe(true);
  });

  it("matches 'may I gently challenge'", () => {
    expect(
      detectCulturalRegister("May I gently challenge that assumption?")
        .hedgedDisagreement,
    ).toBe(true);
  });

  it("matches 'with due respect, I'd suggest otherwise'", () => {
    expect(
      detectCulturalRegister(
        "With due respect, I would have suggested otherwise here.",
      ).hedgedDisagreement,
    ).toBe(true);
  });

  it("does NOT match bare 'with respect' (could be agreement)", () => {
    expect(
      detectCulturalRegister("With respect to the timeline, we shipped on time.")
        .hedgedDisagreement,
    ).toBe(false);
  });

  it("does NOT match disagreement without deference marker", () => {
    expect(
      detectCulturalRegister("I disagree with that completely.")
        .hedgedDisagreement,
    ).toBe(false);
  });
});

describe("detectCulturalRegister — indirectFailureFraming", () => {
  it("matches 'there were some challenges'", () => {
    expect(
      detectCulturalRegister("There were some challenges with the rollout.")
        .indirectFailureFraming,
    ).toBe(true);
  });

  it("matches 'there were a few issues'", () => {
    expect(
      detectCulturalRegister("There were a few issues we ran into.")
        .indirectFailureFraming,
    ).toBe(true);
  });

  it("matches 'the rollout had some hiccups'", () => {
    expect(
      detectCulturalRegister("The rollout had some hiccups initially.")
        .indirectFailureFraming,
    ).toBe(true);
  });

  it("matches 'our launch ran into a few gaps'", () => {
    expect(
      detectCulturalRegister("Our launch ran into a few gaps in QA.")
        .indirectFailureFraming,
    ).toBe(true);
  });

  it("matches 'things didn't quite land'", () => {
    expect(
      detectCulturalRegister("Things didn't quite land the way we hoped.")
        .indirectFailureFraming,
    ).toBe(true);
  });

  it("does NOT match bare 'there were issues' (no hedge)", () => {
    expect(
      detectCulturalRegister("There were issues. Big ones.")
        .indirectFailureFraming,
    ).toBe(false);
  });
});

describe("detectCulturalRegister — relationalFraming", () => {
  it("matches 'kept the team aligned'", () => {
    expect(
      detectCulturalRegister("I kept the team aligned through the quarter.")
        .relationalFraming,
    ).toBe(true);
  });

  it("matches 'preserved trust with stakeholders'", () => {
    expect(
      detectCulturalRegister(
        "We preserved trust with the stakeholder throughout.",
      ).relationalFraming,
    ).toBe(true);
  });

  it("matches 'team stayed aligned'", () => {
    expect(
      detectCulturalRegister("The team stayed aligned despite the pivot.")
        .relationalFraming,
    ).toBe(true);
  });

  it("matches 'brought everyone along'", () => {
    expect(
      detectCulturalRegister("I brought everyone along on the decision.")
        .relationalFraming,
    ).toBe(true);
  });

  it("matches 'no one felt blindsided'", () => {
    expect(
      detectCulturalRegister("No one felt blindsided by the change.")
        .relationalFraming,
    ).toBe(true);
  });

  it("does NOT match generic 'team did well'", () => {
    expect(
      detectCulturalRegister("The team did well that quarter.")
        .relationalFraming,
    ).toBe(false);
  });
});

describe("detectCulturalRegister — calendarAnchored", () => {
  it("matches 'Diwali'", () => {
    expect(
      detectCulturalRegister("We were prepping for Diwali sale week.")
        .calendarAnchored,
    ).toBe(true);
  });

  it("matches 'Big Billion Days'", () => {
    expect(
      detectCulturalRegister("This was right before Big Billion Days.")
        .calendarAnchored,
    ).toBe(true);
  });

  it("matches 'BBD' shorthand", () => {
    expect(
      detectCulturalRegister("BBD load tests caught a regression.")
        .calendarAnchored,
    ).toBe(true);
  });

  it("matches 'quarter-end'", () => {
    expect(
      detectCulturalRegister("Quarter-end crunch made the trade-off sharper.")
        .calendarAnchored,
    ).toBe(true);
  });

  it("matches 'March closing'", () => {
    expect(
      detectCulturalRegister("March closing pressure was real that year.")
        .calendarAnchored,
    ).toBe(true);
  });

  it("matches 'Navratri'", () => {
    expect(
      detectCulturalRegister("Right around Navratri the team was thin.")
        .calendarAnchored,
    ).toBe(true);
  });

  it("does NOT match unrelated date references", () => {
    expect(
      detectCulturalRegister("It was sometime in summer last year.")
        .calendarAnchored,
    ).toBe(false);
  });
});

describe("detectCulturalRegister — deferentialGratitude", () => {
  it("matches 'thank you so much for this opportunity, sir'", () => {
    expect(
      detectCulturalRegister(
        "Thank you so much for this opportunity, sir.",
      ).deferentialGratitude,
    ).toBe(true);
  });

  it("matches 'I really appreciate you taking the time'", () => {
    expect(
      detectCulturalRegister(
        "I really appreciate you taking the time today.",
      ).deferentialGratitude,
    ).toBe(true);
  });

  it("matches 'thanks so much for having me'", () => {
    expect(
      detectCulturalRegister("Thanks so much for having me on this call.")
        .deferentialGratitude,
    ).toBe(true);
  });

  it("matches 'it's a privilege to speak with you'", () => {
    expect(
      detectCulturalRegister("It's a real privilege to speak with you today.")
        .deferentialGratitude,
    ).toBe(true);
  });

  it("does NOT match bare 'I thanked the team' inside a STAR Action", () => {
    expect(
      detectCulturalRegister("I thanked the team and moved on to the next sprint.")
        .deferentialGratitude,
    ).toBe(false);
  });

  it("does NOT match 'thanks' without interviewer direction", () => {
    expect(
      detectCulturalRegister("We sent a thanks-note to QA after the launch.")
        .deferentialGratitude,
    ).toBe(false);
  });
});

describe("detectCulturalRegister — pedigreeRecital", () => {
  it("matches 'I scored 92% in 10th'", () => {
    expect(
      detectCulturalRegister("I scored 92% in 10th and 88 percent in 12th.")
        .pedigreeRecital,
    ).toBe(true);
  });

  it("matches 'CGPA 8.4'", () => {
    expect(
      detectCulturalRegister("Graduated from NIT with a CGPA of 8.4.")
        .pedigreeRecital,
    ).toBe(true);
  });

  it("matches '8.7 CGPA' suffix form", () => {
    expect(
      detectCulturalRegister("I had an 8.7 CGPA in B.Tech.").pedigreeRecital,
    ).toBe(true);
  });

  it("matches '12th boards were 88%'", () => {
    expect(
      detectCulturalRegister("My 12th board marks were 88%.").pedigreeRecital,
    ).toBe(true);
  });

  it("matches 'got 95 percent in CBSE boards'", () => {
    expect(
      detectCulturalRegister("I got 95 percent in CBSE boards.")
        .pedigreeRecital,
    ).toBe(true);
  });

  it("does NOT match vague 'I scored well in school'", () => {
    expect(
      detectCulturalRegister("I scored well in school and was always curious.")
        .pedigreeRecital,
    ).toBe(false);
  });

  it("does NOT match unrelated percentage like 'cut errors by 40%'", () => {
    expect(
      detectCulturalRegister("I cut errors by 40% in the next sprint.")
        .pedigreeRecital,
    ).toBe(false);
  });
});

describe("hasAnyIndianRegister", () => {
  it("returns true when any marker fires", () => {
    expect(
      hasAnyIndianRegister(
        detectCulturalRegister("With respect, I'd push back on the deadline."),
      ),
    ).toBe(true);
  });

  it("returns false on neutral American-register text", () => {
    expect(
      hasAnyIndianRegister(
        detectCulturalRegister(
          "I owned the miss, fixed the deploy pipeline, and shipped a postmortem.",
        ),
      ),
    ).toBe(false);
  });

  it("handles empty input safely", () => {
    expect(hasAnyIndianRegister(detectCulturalRegister(""))).toBe(false);
  });
});
