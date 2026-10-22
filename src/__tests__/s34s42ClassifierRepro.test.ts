import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";

const CTX_E1 = { lastAiText: "Thanks for making the time. Let's get straight into it — what's your current CTC, total annual?", phase: "opening" as const };

describe("E1 dual-disclosure repros", () => {
  it("S34: per-month CTC + annual target", () => {
    const r = classifyNumberRoles("My CTC is 4.5 lakhs per month and I'm targeting 65 lakhs", CTX_E1);
    expect(r.currentCtc).toBeCloseTo(54, 0);
    expect(r.target).toBe(65);
  });

  it("S35: crore CTC + crore target", () => {
    const r = classifyNumberRoles("My CTC is 1.2 crore and I'm targeting 1.5 crore", CTX_E1);
    expect(r.currentCtc).toBe(120);
    expect(r.target).toBe(150);
  });

  it("S40: rupee CTC + target + competing offer", () => {
    const r = classifyNumberRoles("My CTC is 38 lakhs, I'm targeting 52 lakhs, and I have an offer from Meesho at 47 lakhs", CTX_E1);
    expect(r.currentCtc).toBe(38);
    expect(r.target).toBe(52);
    expect(r.competing).toBe(47);
  });

  it("S41: CTC + target with ESOP context", () => {
    const r = classifyNumberRoles("My current CTC is 35 lakhs but with the ESOPs dropping 40% my effective comp is about 29-30 lakhs. I'm targeting 52 lakhs for this move.", CTX_E1);
    expect(r.currentCtc).toBe(35);
    expect(r.target).toBe(52);
  });

  it("S42: plain disclosure", () => {
    const r = classifyNumberRoles("My CTC is 38 lakhs and I'm targeting 55 lakhs", CTX_E1);
    expect(r.currentCtc).toBe(38);
    expect(r.target).toBe(55);
  });
});

describe("S41-B8 ESOP effective-comp should NOT bind as target when below established CTC", () => {
  const CTX_E2_PROBE = { lastAiText: "What fitment were you anchoring on?", phase: "probe-expectations" as const, currentCtc: 35 };
  const CTX_E2_TARGET = { lastAiText: "What is your target CTC?", phase: "discovery" as const, currentCtc: 35 };

  it("ESOP effective-comp (30L < 35L CTC) does NOT bind as target via phase default", () => {
    const r = classifyNumberRoles(
      "The ESOPs have dropped 40% in value so my effective comp is about 29-30 lakhs",
      CTX_E2_PROBE
    );
    expect(r.target).toBeNull();
  });

  it("explicit target ABOVE currentCtc still binds correctly in probe-expectations", () => {
    const r = classifyNumberRoles("I'm targeting 52 lakhs for this move", CTX_E2_PROBE);
    expect(r.target).toBe(52);
  });

  it("explicit target BELOW currentCtc via TARGET_CUES still binds (cue wins over guard)", () => {
    // When candidate explicitly says "targeting 30L" with a target verb, cue scores max>0 first
    // so belowEstablishedCtc guard (which only applies in the no-cue fall-through) is irrelevant
    const r = classifyNumberRoles("I'm targeting 30 lakhs", CTX_E2_PROBE);
    expect(r.target).toBe(30); // explicit verb wins
  });

  it("S42-B8: initial target (55L) binds correctly", () => {
    const r = classifyNumberRoles("I'm targeting 55 lakhs for this role", CTX_E2_TARGET);
    expect(r.target).toBe(55);
  });
});
