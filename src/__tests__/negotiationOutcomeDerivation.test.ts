/* Telemetry-canary guard (2026-06-27).
 *
 * `negotiationOutcomeDerivation` is the pure mirror of the branch inside
 * `buildNegotiationOutcome`: it reports whether a report row resolves its
 * deal outcome from the kernel's authoritative persisted trajectory
 * ("kernel") or falls back to the transcript regex ("heuristic"). The
 * report layer emits the heuristic rate to PostHog (`neg_report_derivation`)
 * as the production early-warning for the DATA-1 bug class — a closed
 * negotiation rendering "0 of 5 stages / didn't close" because kernel
 * metrics never persisted. These tests pin the branch so the canary can't
 * silently invert (reporting "kernel" when the heuristic actually ran). */
import { describe, it, expect } from "vitest";
import { negotiationOutcomeDerivation } from "../sessionReport/adapter";

const kernelFull = {
  outcome: "accepted" as const,
  anchorTurn: 1,
  leverDiversity: 3,
  lpaGained: 2.2,
  lpaPerTurn: 0.7,
  bandTraversal: 0.6,
  overBandViolation: false,
  totalTurns: 7,
  score: 72,
  initialOfferLpa: 23,
  finalOfferLpa: 25.2,
  candidateAskLpa: 30,
  offerTrajectoryLpa: [23, 24.8, 25.2],
};

describe("negotiationOutcomeDerivation", () => {
  it("returns 'heuristic' when no kernel metrics persisted (legacy row)", () => {
    expect(negotiationOutcomeDerivation(undefined)).toBe("heuristic");
  });

  it("returns 'kernel' when the authoritative trajectory + initial offer are present", () => {
    expect(negotiationOutcomeDerivation(kernelFull)).toBe("kernel");
  });

  it("returns 'heuristic' when the trajectory is missing (adoptKernelOutcome rejects)", () => {
    const noTrajectory = { ...kernelFull, offerTrajectoryLpa: undefined };
    expect(negotiationOutcomeDerivation(noTrajectory)).toBe("heuristic");
  });

  it("returns 'heuristic' when initialOfferLpa is absent (legacy partial row)", () => {
    const noInitial = { ...kernelFull, initialOfferLpa: undefined };
    expect(negotiationOutcomeDerivation(noInitial)).toBe("heuristic");
  });

  it("treats a walked-away kernel row as 'kernel' (outcome value is irrelevant to the path)", () => {
    expect(negotiationOutcomeDerivation({ ...kernelFull, outcome: "walked-away" })).toBe("kernel");
  });
});
