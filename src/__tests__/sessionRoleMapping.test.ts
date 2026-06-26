import { describe, it, expect } from "vitest";
import { localSessionToDashboardSession } from "../SessionDetail";
import type { LocalSession } from "../sessionDetailHelpers";
import { buildNegotiationOutcome } from "../sessionReport/adapter";
import { derivePhases } from "../sessionReport/derivations";

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

/**
 * Regression guard for the live launch-blocker (staging session 81d0ea0a,
 * 2026-06-26): a cleanly-closed negotiation rendered "0 of 5 stages / NO
 * COUNTER NAMED / didn't close" because SessionDetail's mapper dropped
 * `negotiationMetrics`, starving the adapter's adoptKernelOutcome and
 * forcing it onto the transcript-regex heuristic. The kernel had persisted
 * the truth (candidateAskLpa 65, outcome accepted, trajectory [51,51,51]).
 * This pins the full chain: LocalSession → DashboardSession → adapter →
 * derivePhases must light up the counter + close stages from kernel truth.
 */
describe("localSessionToDashboardSession negotiationMetrics threading", () => {
  const km: NonNullable<LocalSession["negotiationMetrics"]> = {
    outcome: "accepted",
    anchorTurn: null,
    leverDiversity: 3,
    lpaGained: 18.3,
    lpaPerTurn: 6.1,
    bandTraversal: 0.93,
    overBandViolation: false,
    totalTurns: 6,
    score: 63,
    initialOfferLpa: 32.7,
    finalOfferLpa: 51,
    candidateAskLpa: 65,
    offerTrajectoryLpa: [51, 51, 51],
  };

  it("carries kernel negotiationMetrics onto the DashboardSession", () => {
    const out = localSessionToDashboardSession({
      ...base,
      type: "salary-negotiation",
      negotiationMetrics: km,
    });
    expect(out.negotiationMetrics).toBeDefined();
    expect(out.negotiationMetrics?.candidateAskLpa).toBe(65);
    expect(out.negotiationMetrics?.outcome).toBe("accepted");
    expect(out.negotiationMetrics?.offerTrajectoryLpa).toEqual([51, 51, 51]);
  });

  it("derives a named counter + closed deal from the threaded metrics (not 0/5)", () => {
    const ds = localSessionToDashboardSession({
      ...base,
      type: "salary-negotiation",
      negotiationMetrics: km,
    });
    // Minimal report stub — the adapter must prefer kernel metrics over it.
    const outcome = buildNegotiationOutcome(
      { perQuestion: [] } as never,
      ds.negotiationMetrics,
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.candidateAsk).toBe(65);
    expect(outcome?.outcome).toBe("accepted");

    const phases = derivePhases(outcome!);
    const reached = phases.filter((p) => p.reached).map((p) => p.num);
    // Stage 1 (named a counter) and stage 5 (closed) must be reached.
    expect(reached).toContain(1);
    expect(reached).toContain(5);
    // And it is NOT the degenerate "0 of 5" empty state.
    expect(reached.length).toBeGreaterThan(0);
  });
});
