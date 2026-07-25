import { describe, it, expect } from "vitest";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";

describe("isWalkAway — false positive candidates", () => {
  it("'not interested in the variable component' — candidate prefers fixed, NOT a walk", () => {
    expect(isWalkAway("I'm not interested in the variable component")).toBe(false);
  });
  it("'done negotiating about the variable, let's focus on fixed' — topic shift, NOT a walk", () => {
    expect(isWalkAway("I'm done negotiating about the variable, let's focus on fixed")).toBe(false);
  });
  it("\"the offer won't work for me right now\" — asks for more, NOT a walk", () => {
    expect(isWalkAway("The offer won't work for me right now")).toBe(false);
  });
  it("\"won't work for me, can you do better?\" — counter-ask NOT a walk", () => {
    expect(isWalkAway("That won't work for me, can you do better?")).toBe(false);
  });
  it("'not interested in the current structure' — wants restructure, NOT a walk", () => {
    expect(isWalkAway("I'm not interested in the current structure, I prefer all-fixed")).toBe(false);
  });
  it("'not interested in equity' — prefers all-cash, NOT a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in equity, I prefer all cash")).toBe(false);
  });
  it("'not interested in the bonus component' — component preference, NOT a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in the bonus component, just raise the base")).toBe(false);
  });
});

describe("isWalkAway — true walk-aways that must NOT be suppressed (S76-B2 regression)", () => {
  it("'won't work for me, I'm going to explore other opportunities right now' — IS a walk", () => {
    expect(isWalkAway("The offer won't work for me, I'm going to explore other opportunities right now")).toBe(true);
  });
  it("bare 'that won't work' with no qualifier — IS a walk", () => {
    expect(isWalkAway("That won't work.")).toBe(true);
  });
  it("'won't work for me at all' — IS a walk", () => {
    expect(isWalkAway("This offer won't work for me at all.")).toBe(true);
  });
});

describe("isWalkAway — withdraw my counter/demand = concession, NOT walk-away (S79-B3)", () => {
  it("'withdraw my 40L counter' — retracting a demand, NOT a walk (S79-B3)", () => {
    expect(isWalkAway("I would like to withdraw my counter.")).toBe(false);
  });
  it("'withdraw my demand for joining bonus' — concession, NOT a walk (S79-B3)", () => {
    expect(isWalkAway("I want to withdraw my demand for a joining bonus.")).toBe(false);
  });
  it("'I withdraw from the negotiation' — IS a walk-away (S79-B3 regression)", () => {
    expect(isWalkAway("I withdraw from the negotiation.")).toBe(true);
  });
  it("'I am withdrawing my application' — IS a walk-away (S79-B3 regression)", () => {
    expect(isWalkAway("I am withdrawing my application.")).toBe(true);
  });
});

describe("isWalkAway — 'pull out' idiom/possessive-object false positives (S79-B2)", () => {
  it("'pull out all the stops' idiom — NOT a walk-away (S79-B2)", () => {
    expect(isWalkAway("I'll pull out all the stops for this offer.")).toBe(false);
  });
  it("'pull out my competing offer letter' — retrieval, NOT a walk (S79-B2)", () => {
    expect(isWalkAway("Let me pull out my competing offer letter.")).toBe(false);
  });
  it("'pull out of the negotiation' — IS a walk-away (S79-B2 regression)", () => {
    expect(isWalkAway("I'll pull out of the negotiation.")).toBe(true);
  });
  it("bare 'I'm going to pull out' — IS a walk-away (S79-B2 regression)", () => {
    expect(isWalkAway("I'm going to pull out.")).toBe(true);
  });
});

describe("isWalkAway — 'done here for now' temporal qualifier (S79-B1)", () => {
  it("'I'm done here for now, let me review' — asking for time, NOT a walk", () => {
    expect(isWalkAway("I'm done here for now, let me review and get back to you.")).toBe(false);
  });
  it("'I'm done here for now, I'll think it over' — NOT a walk", () => {
    expect(isWalkAway("Alright, I'm done here for now, I'll think it over.")).toBe(false);
  });
  it("bare 'I'm done here' IS a walk-away (S79-B1 regression)", () => {
    expect(isWalkAway("I'm done here.")).toBe(true);
  });
  it("'I'm done here — take my name off the list' IS a walk-away", () => {
    expect(isWalkAway("I'm done here — take my name off the list.")).toBe(true);
  });
});

describe("isWalkAway — i'm-out-of-X false positives (S78-B2)", () => {
  it("'I'm out of ideas for a compromise' — still negotiating, NOT a walk", () => {
    expect(isWalkAway("I'm out of ideas for a compromise.")).toBe(false);
  });
  it("'I'm out of counter-proposals' — still trying, NOT a walk", () => {
    expect(isWalkAway("I'm out of counter-proposals at this point.")).toBe(false);
  });
  it("bare 'I'm out' — IS a walk-away (S78-B2 regression)", () => {
    expect(isWalkAway("I'm out.")).toBe(true);
  });
  it("'I'm out — this won't work' — IS a walk-away (S78-B2 regression)", () => {
    expect(isWalkAway("I'm out — this won't work.")).toBe(true);
  });
});

describe("isWalkAway — i'll-pass hand-off to recipient = NOT walk-away (S80-B1)", () => {
  it("'I'll pass your proposal to my partner' — sharing offer, NOT declining (S80-B1)", () => {
    expect(isWalkAway("I'll pass your proposal to my partner.")).toBe(false);
  });
  it("'I'll pass this offer to my wife for discussion' — sharing, NOT walk (S80-B1)", () => {
    expect(isWalkAway("I'll pass this offer to my wife for a quick discussion.")).toBe(false);
  });
  it("'I'll pass along your offer to my family' — hand-off, NOT walk (S80-B1)", () => {
    expect(isWalkAway("I'll pass along your offer to my family.")).toBe(false);
  });
  it("bare 'I'll pass' IS a walk-away (S80-B1 regression)", () => {
    expect(isWalkAway("I'll pass.")).toBe(true);
  });
  it("'I'll pass on this offer' IS a walk-away (S80-B1 regression)", () => {
    expect(isWalkAway("I'll pass on this offer.")).toBe(true);
  });
});

describe("isWalkAway — have-to-pass hand-off to recipient = NOT walk-away (S80-B2)", () => {
  it("'I have to pass along some constraints to you' — sharing info, NOT walk (S80-B2)", () => {
    expect(isWalkAway("I have to pass along some constraints to you.")).toBe(false);
  });
  it("'I have to pass this information to my manager' — hand-off, NOT walk (S80-B2)", () => {
    expect(isWalkAway("I have to pass this information to my manager.")).toBe(false);
  });
  it("'I have to pass on this' IS a walk-away (S80-B2 regression)", () => {
    expect(isWalkAway("I have to pass on this.")).toBe(true);
  });
  it("'I have to pass, it's not enough' IS a walk-away (S80-B2 regression)", () => {
    expect(isWalkAway("I have to pass, it's not enough.")).toBe(true);
  });
});

describe("isWalkAway — no-chance hardball anchor = NOT walk-away (S80-B3)", () => {
  it("'No chance I'm settling for less than 45L' — anchor, NOT walk (S80-B3)", () => {
    expect(isWalkAway("No chance I'm settling for less than 45L.")).toBe(false);
  });
  it("'No chance I'm going below 40L base' — floor statement, NOT walk (S80-B3)", () => {
    expect(isWalkAway("No chance I'm going below 40L base.")).toBe(false);
  });
  it("'No chance I'll accept less than what I asked' — anchor, NOT walk (S80-B3)", () => {
    expect(isWalkAway("No chance I'll accept less than what I asked.")).toBe(false);
  });
  it("'No chance I'd drop below 42L' — floor statement, NOT walk (S80-B3)", () => {
    expect(isWalkAway("No chance I'd drop below 42L.")).toBe(false);
  });
  it("'Not a chance I'm settling for less than 50L' — anchor, NOT walk (S80-B3)", () => {
    expect(isWalkAway("Not a chance I'm settling for less than 50L.")).toBe(false);
  });
  it("'Not a chance I'm going below 38L' — floor, NOT walk (S80-B3)", () => {
    expect(isWalkAway("Not a chance I'm going below 38L.")).toBe(false);
  });
  it("'No chance we can reach a deal' IS a walk-away (S80-B3 regression)", () => {
    expect(isWalkAway("No chance we can reach a deal.")).toBe(true);
  });
  it("'Not a chance I'm accepting this offer' IS a walk-away (S80-B3 regression)", () => {
    expect(isWalkAway("Not a chance I'm accepting this offer.")).toBe(true);
  });
});

describe("isWalkAway — not-interested in job/offer noun = walk-away (S77-B1 regression)", () => {
  it("'not interested in this role anymore' — IS a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in this role anymore.")).toBe(true);
  });
  it("'not interested in the offer' — IS a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in the offer at all.")).toBe(true);
  });
  it("'not interested in any deal below 40L' — IS a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in any deal below 40L.")).toBe(true);
  });
  it("'not interested in the position' — IS a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in the position anymore.")).toBe(true);
  });
  it("'not interested in continuing this negotiation' — IS a walk (S77-B1)", () => {
    expect(isWalkAway("I'm not interested in continuing this negotiation.")).toBe(true);
  });
});

describe("isWalkAway — S85 batch (2026-07-26)", () => {
  // B1: `is not going to work` false negative + `I am moving on` departure frame miss
  it("S85-B1: 'This is not going to work, I am moving on' IS a walk", () => {
    expect(isWalkAway("This is not going to work, I am moving on.")).toBe(true);
  });
  it("S85-B1: 'is not going to work' without contraction IS a walk", () => {
    expect(isWalkAway("The current number is not going to work for me.")).toBe(true);
  });
  it("S85-B1: 'I am moving on to other opportunities' IS a walk", () => {
    expect(isWalkAway("I am moving on to other opportunities.")).toBe(true);
  });
  it("S85-B1 regression: 'I'll move on' still fires", () => {
    expect(isWalkAway("I'll move on if this doesn't improve.")).toBe(true);
  });

  // B2: `withdraw my complaint/concern` — non-exit withdrawal
  it("S85-B2: 'I withdraw my complaint about the timeline' — NOT a walk", () => {
    expect(isWalkAway("I withdraw my complaint about the timeline.")).toBe(false);
  });
  it("S85-B2: 'I withdraw my concern about the equity structure' — NOT a walk", () => {
    expect(isWalkAway("I withdraw my concern about the equity structure.")).toBe(false);
  });
  it("S85-B2 regression: 'I withdraw from this process' IS a walk", () => {
    expect(isWalkAway("I withdraw from this process.")).toBe(true);
  });
  it("S85-B2 regression: 'I withdraw my application' IS a walk", () => {
    expect(isWalkAway("I withdraw my application.")).toBe(true);
  });

  // B3: `I decline to share/answer` — info-privacy refusal, NOT walk-away
  it("S85-B3: 'I decline to share my current CTC' — NOT a walk", () => {
    expect(isWalkAway("I decline to share my current CTC.")).toBe(false);
  });
  it("S85-B3: 'I decline to answer that' — NOT a walk", () => {
    expect(isWalkAway("I decline to answer that question.")).toBe(false);
  });
  it("S85-B3: 'I decline to reveal my current salary' — NOT a walk", () => {
    expect(isWalkAway("I decline to reveal my current salary.")).toBe(false);
  });
  it("S85-B3 regression: 'I decline the offer' IS a walk", () => {
    expect(isWalkAway("I decline the offer.")).toBe(true);
  });
  it("S85-B3 regression: 'I respectfully decline' IS a walk", () => {
    expect(isWalkAway("I respectfully decline.")).toBe(true);
  });

  // B4: `no deal on the table` — frustration expression, not exit
  it("S85-B4: 'there is no deal on the table that works for me' — NOT a walk", () => {
    expect(isWalkAway("There is no deal on the table that works for me.")).toBe(false);
  });
  it("S85-B4 regression: 'no deal, I will look elsewhere' IS a walk", () => {
    expect(isWalkAway("No deal, I will look elsewhere.")).toBe(true);
  });
  it("S85-B4 regression: 'no deal-breakers on my end' is NOT a walk", () => {
    expect(isWalkAway("I have no deal-breakers on my end.")).toBe(false);
  });
});
