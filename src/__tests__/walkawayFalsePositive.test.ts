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
});
