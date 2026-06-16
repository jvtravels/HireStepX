import { describe, it, expect } from "vitest";
import { localSessionToDashboardSession } from "../SessionDetail";
import type { LocalSession } from "../sessionDetailHelpers";

/**
 * Regression guard for H1: the report's evaluator meta is built from
 * DashboardSession.role / .company. The adapter used to map role from
 * `focus` (which is "general" when the setup form passes no focus param)
 * and hard-code company to undefined — so a "Senior Product Designer at
 * Razorpay" reached the evaluator as role "general" → roleFamily "swe",
 * targetCompany null. Verified live in the /api/evaluate-session payload.
 * The persisted target_role/target_company must win.
 */
const base: LocalSession = {
  id: "s1",
  date: "2026-06-16T00:00:00.000Z",
  type: "behavioral",
  difficulty: "standard",
  focus: "general",
  duration: 104,
  score: 73,
  questions: 6,
};

describe("localSessionToDashboardSession role/company mapping", () => {
  it("uses the persisted target role over focus", () => {
    const out = localSessionToDashboardSession({
      ...base,
      targetRole: "Senior Product Designer",
    });
    expect(out.role).toBe("Senior Product Designer");
  });

  it("uses the persisted target company instead of undefined", () => {
    const out = localSessionToDashboardSession({
      ...base,
      targetCompany: "Razorpay",
    });
    expect(out.company).toBe("Razorpay");
  });

  it("falls back to focus then 'Candidate' when no target role is set", () => {
    expect(localSessionToDashboardSession(base).role).toBe("general");
    expect(
      localSessionToDashboardSession({ ...base, focus: "" }).role
    ).toBe("Candidate");
  });

  it("leaves company undefined when no target company is set", () => {
    expect(localSessionToDashboardSession(base).company).toBeUndefined();
  });
});
