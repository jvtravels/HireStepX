import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";

describe("S36-B2 competing offer 'for' preposition", () => {
  const ctx = {
    phase: "counter-offer" as const,
    currentCtc: 40,
    candidateTarget: 55,
    competingOffer: null,
    aiAskedCtc: false,
    aiAskedTarget: false,
  };

  it("'I have an offer for 58L from Google' binds competing", () => {
    const r = classifyNumberRoles("I have an offer for 58L from Google", ctx);
    expect(r.competing).toBeCloseTo(58, 0);
    expect(r.target).toBeNull();
    expect(r.currentCtc).toBeNull();
  });

  it("'I have an offer from Google for 58 lakhs' binds competing", () => {
    const r = classifyNumberRoles("I have an offer from Google for 58 lakhs", ctx);
    expect(r.competing).toBeCloseTo(58, 0);
  });

  it("'got an offer for 60 LPA' binds competing", () => {
    const r = classifyNumberRoles("I got an offer for 60 LPA", ctx);
    expect(r.competing).toBeCloseTo(60, 0);
  });

  it("'an offer from Amazon at 55L' still binds competing (existing)", () => {
    const r = classifyNumberRoles("I have an offer from Amazon at 55L", ctx);
    expect(r.competing).toBeCloseTo(55, 0);
  });

  it("'competing offer of 52L' still binds competing (existing)", () => {
    const r = classifyNumberRoles("I have a competing offer of 52L", ctx);
    expect(r.competing).toBeCloseTo(52, 0);
  });
});
