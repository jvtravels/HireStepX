/* The report's negotiation outcome must come from the kernel's
 * authoritative final state — NOT a transcript regex (live-staging
 * finding, 2026-06-18).
 *
 * The bug: a Razorpay session that reached a real close at ₹25.2L
 * rendered "0 of 5 stages · didn't close · no counter named" because
 * `buildNegotiationOutcome` re-derived everything by regex-scanning the
 * transcript, and the scan silently failed (the AI/candidate phrasing
 * didn't match the patterns). The kernel ALREADY knew the offer
 * trajectory, the candidate's ask, and that the deal closed.
 *
 * The fix persists those numbers on `negotiationMetrics` and has the
 * adapter ADOPT them (mirrors adoptKernelBand for the Deal Summary).
 * These tests lock it: when kernel metrics carry a trajectory, the
 * outcome reflects kernel truth and the 5-stage ladder reads "closed",
 * regardless of what the transcript text says. Legacy rows (no
 * trajectory persisted) still fall back to the regex heuristic. */
import { describe, it, expect } from "vitest";
import { buildNegotiationOutcome } from "../sessionReport/adapter";
import { derivePhases, TOTAL_PHASES } from "../sessionReport/derivations";
import type { SessionReport } from "../dashboardData";
import type { DashboardSession } from "../dashboardTypes";

type KernelMetrics = NonNullable<DashboardSession["negotiationMetrics"]>;

/** Minimal kernel metrics with the authoritative trajectory present. */
const kernel = (over: Partial<KernelMetrics>): KernelMetrics => ({
  outcome: "accepted",
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
  ...over,
});

/* A transcript that would DEFEAT the regex heuristic — no recognizable
 * acceptance phrase, no "offer ₹X LPA" pattern, no "target ₹X" ask. This
 * is the live failure mode: the kernel closed the deal but the text scan
 * finds nothing. The report must still read "closed" via kernel adoption. */
const opaqueReport = {
  perQuestion: [
    { question: "Let's talk numbers.", answerText: "That works for me. Let's proceed." },
    { question: "We can make it happen.", answerText: "Great, I'm in." },
  ],
} as unknown as SessionReport;

describe("report adopts the kernel's authoritative negotiation outcome", () => {
  it("reads a real close from kernel metrics even when the transcript regex finds nothing", () => {
    const outcome = buildNegotiationOutcome(opaqueReport, kernel({}));
    expect(outcome).not.toBeUndefined();
    expect(outcome!.outcome).toBe("accepted");
    expect(outcome!.candidateAsk).toBe(30);
    expect(outcome!.finalTotal).toBe(25.2);
    expect(outcome!.offers.map((o) => o.total)).toEqual([23, 24.8, 25.2]);
    // gap closed: (25.2 - 23) / (30 - 23) = 31%
    expect(outcome!.gapClosurePct).toBe(31);
  });

  it("drives the 5-stage ladder to a closed deal (the live regression)", () => {
    const outcome = buildNegotiationOutcome(opaqueReport, kernel({}));
    const phases = derivePhases(outcome!);
    expect(phases).toHaveLength(TOTAL_PHASES);
    // Stage 1 (named a counter), 3 (pushback), 4 (levers), 5 (closed) all reached.
    expect(phases[0].reached).toBe(true); // candidateAsk present
    expect(phases[2].reached).toBe(true); // offers.length >= 2
    expect(phases[3].reached).toBe(true); // offers.length >= 3
    expect(phases[4].reached).toBe(true); // accepted
    expect(phases[4].note).toBe("Accepted");
    expect(phases.filter((p) => p.reached)).toHaveLength(TOTAL_PHASES);
  });

  it("maps a kernel walk-away to walked_away with no final total", () => {
    const outcome = buildNegotiationOutcome(
      opaqueReport,
      kernel({ outcome: "walked-away", offerTrajectoryLpa: [23, 24] }),
    );
    expect(outcome!.outcome).toBe("walked_away");
    expect(outcome!.finalTotal).toBeNull();
    expect(derivePhases(outcome!)[4].reached).toBe(true); // walk-away IS a close-stage exit
  });

  it("maps stalemate / in-progress to no_agreement (deal did not close)", () => {
    const stalemate = buildNegotiationOutcome(opaqueReport, kernel({ outcome: "stalemate" }));
    expect(stalemate!.outcome).toBe("no_agreement");
    expect(derivePhases(stalemate!)[4].reached).toBe(false);
  });
});

describe("legacy rows without a persisted trajectory fall back to the transcript heuristic", () => {
  it("ignores kernel adoption and scans the transcript when offerTrajectoryLpa is absent", () => {
    // Legacy metrics: no trajectory fields. The adapter must fall through
    // to the regex path, which reads acceptance from the transcript text.
    const legacy = {
      outcome: "accepted",
      anchorTurn: 1,
      leverDiversity: 2,
      lpaGained: 2,
      lpaPerTurn: 1,
      bandTraversal: 0.5,
      overBandViolation: false,
      totalTurns: 5,
      score: 60,
    } as unknown as KernelMetrics;
    const report = {
      perQuestion: [
        { question: "I can offer you ₹22 LPA total.", answerText: "I was hoping for ₹28 LPA." },
        { question: "I can stretch to ₹25 LPA.", answerText: "That works for me, I accept." },
      ],
    } as unknown as SessionReport;
    const outcome = buildNegotiationOutcome(report, legacy);
    expect(outcome!.outcome).toBe("accepted"); // from regex, not kernel
    expect(outcome!.offers.length).toBeGreaterThan(0);
  });

  /* finding #112 (2026-06-20) — the live Flipkart EM session ended without
   * a persisted trajectory, so the report fell to the transcript heuristic.
   * The candidate anchored hard ("I'm targeting 65 LPA fixed" / "I need ₹65
   * LPA fixed") yet the stage-tracker read "NO COUNTER NAMED" because the
   * ask regex carried a bare `target` that `\btarget\b` could not match
   * inside "targeting". The fix inflects the verbs; this locks it. */
  it("credits a counter stated as 'targeting 65 LPA' in the transcript fallback", () => {
    const legacy = {
      outcome: "stalemate",
      anchorTurn: 2,
      leverDiversity: 1,
      lpaGained: 0,
      lpaPerTurn: 0,
      bandTraversal: 0,
      overBandViolation: false,
      totalTurns: 7,
      score: 40,
    } as unknown as KernelMetrics;
    const report = {
      perQuestion: [
        {
          question: "What are you looking for?",
          answerText:
            "I'm currently at 48 LPA fixed. For this role at Flipkart, I'm targeting 65 LPA fixed.",
        },
        { question: "That's a stretch.", answerText: "I need ₹65 LPA fixed to move." },
      ],
    } as unknown as SessionReport;
    const outcome = buildNegotiationOutcome(report, legacy);
    expect(outcome!.candidateAsk).toBe(65);
    expect(derivePhases(outcome!)[0].reached).toBe(true); // counter IS named
    expect(derivePhases(outcome!)[0].note).toBe("Asked for ₹65 LPA");
  });
});
