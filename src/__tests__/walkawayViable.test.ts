import { describe, it, expect } from "vitest";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";

describe("S41-B7: make this move financially viable", () => {
  it("isWalkAway should be false", () => {
    expect(isWalkAway("I'd need 50 LPA to make this move financially viable given that context")).toBe(false);
  });
  it("going to have to pass IS walk-away", () => {
    expect(isWalkAway("I'm going to have to pass")).toBe(true);
  });
});
