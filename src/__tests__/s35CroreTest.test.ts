import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";

describe("S35 crore parsing", () => {
  it("1.2 crores as currentCtc", () => {
    const ctx = { phase: "discovery" as const, currentCtc: null, candidateTarget: null, competingOffer: null, aiAskedCtc: true, aiAskedTarget: false };
    const r = classifyNumberRoles("my current CTC is 1.2 crores", ctx);
    expect(r.currentCtc).toBeCloseTo(120, 0);
    expect(r.target).toBeNull();
  });

  it("1.5 crores as target", () => {
    const ctx = { phase: "probe-expectations" as const, currentCtc: 120, candidateTarget: null, competingOffer: null, aiAskedCtc: false, aiAskedTarget: true };
    const r = classifyNumberRoles("I'm looking for 1.5 crores", ctx);
    expect(r.target).toBeCloseTo(150, 0);
  });

  it("1.2 cr as currentCtc", () => {
    const ctx = { phase: "discovery" as const, currentCtc: null, candidateTarget: null, competingOffer: null, aiAskedCtc: true, aiAskedTarget: false };
    const r = classifyNumberRoles("my CTC is 1.2 cr", ctx);
    expect(r.currentCtc).toBeCloseTo(120, 0);
  });

  it("₹1.5 crore as target", () => {
    const ctx = { phase: "probe-expectations" as const, currentCtc: 120, candidateTarget: null, competingOffer: null, aiAskedCtc: false, aiAskedTarget: true };
    const r = classifyNumberRoles("I want 1.5 crore", ctx);
    expect(r.target).toBeCloseTo(150, 0);
  });
});
