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
import { buildNegotiationOutcome, reconcileKernelMetricsForReport } from "../sessionReport/adapter";
import { derivePhases, TOTAL_PHASES, anchorAtLabel, deriveAnchorBracket } from "../sessionReport/derivations";
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
  // Grounded candidate-action signals — a real closed deal carries them,
  // and the report's stage ladder (derivePhases) now reads stages 2/3/4
  // from these rather than from the recruiter's offer count (REPORT-6).
  vossTacticsUsed: ["mirror", "calibrated-question"],
  infoAsked: ["clawback-period"], // expert lever intent (S19-B6: generic intents don't qualify)
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
    // Every stage reached from grounded signals, NOT recruiter offer count.
    expect(phases[0].reached).toBe(true); // candidateAsk present
    expect(phases[1].reached).toBe(true); // tactics/info → justified
    expect(phases[2].reached).toBe(true); // tactics → handled pushback
    expect(phases[3].reached).toBe(true); // infoAsked expert lever intent → levers
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

  // S14-REPORT-B5: consecutive identical offer values must be deduplicated so
  // a session where the kernel logged [55.3, 55.3, 55.3] (cash frozen) renders
  // a single ₹55.3 pill rather than a misleading three-arrow progression.
  it("S14-REPORT-B5: deduplicates consecutive identical offer values in the trajectory", () => {
    const outcome = buildNegotiationOutcome(
      opaqueReport,
      kernel({ offerTrajectoryLpa: [55.3, 55.3, 55.3], finalOfferLpa: 55.3, candidateAskLpa: 48 }),
    );
    expect(outcome!.offers.map((o) => o.total)).toEqual([55.3]);
  });

  it("S14-REPORT-B5: does NOT collapse non-consecutive identical values", () => {
    // [40, 45, 40] — valid oscillation: deduplicate only consecutive runs.
    const outcome = buildNegotiationOutcome(
      opaqueReport,
      kernel({ offerTrajectoryLpa: [40, 45, 40], finalOfferLpa: 40, candidateAskLpa: 50 }),
    );
    expect(outcome!.offers.map((o) => o.total)).toEqual([40, 45, 40]);
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

  /* Live-staging audit (2026-07-13, report 81d0ea0a — Flipkart EM, KERNEL
   * derivation path). The candidate anchored fixed-only: "I see myself landing
   * at 65 fixed" (recruiter quoted it back: "On closing at ₹65L fixed…"). The
   * saved report — a pre-fix artifact — read "NO COUNTER NAMED", "Never
   * anchored", "0 of 5 stages", and "never named a number" across four surfaces
   * beside its own "Numbers stated 100%" and "3 levers explored". Root cause:
   * the persisted `candidateAskLpa` was null because the OLD engine snapshotted
   * the opaque state's raw total-scoped `candidateTarget` (null for a fixed-only
   * ask) instead of the fold. The metrics layer (computeNegotiationMetrics →
   * effectiveTargetCtcLpaLocal) and the per-turn snapshot (7a0fb9e, server-emits
   * effectiveTargetCtcLpa as candidateTargetAtTurn) now both fold the fixed
   * anchor. This locks the ADAPTER→DERIVATIONS seam the metrics-layer tests
   * don't reach: given a folded non-null candidateAskLpa on a KERNEL row, every
   * report surface must agree the candidate named a counter — no surface may
   * read "no counter / never anchored" beside the stated ask. */
  it("fixed-only anchor on a KERNEL row: no surface contradicts the stated counter", () => {
    // candidateAskLpa 65 = the fold of a "65 fixed" ask (effectiveTargetCtcLpaLocal);
    // anchorTurn 1 = credited because the snapshot now reads the same fold.
    const km = kernel({
      outcome: "accepted",
      anchorTurn: 1,
      candidateAskLpa: 65,
      initialOfferLpa: 32.7,
      finalOfferLpa: 51,
      offerTrajectoryLpa: [32.7, 45, 51],
      leverDiversity: 3,
    });
    // A transcript whose fixed-only ask phrasing the regex would MISS — proving
    // the coherence comes from kernel adoption, not the transcript heuristic.
    const report = {
      perQuestion: [
        { question: "What's your current CTC?", answerText: "I'd rather talk about the role fitment first." },
        { question: "Where do you see yourself landing?", answerText: "I see myself landing at 65 fixed. That's the number that makes this an easy yes for me." },
        { question: "That's above the cash band.", answerText: "Understood — let's look at the equity side then." },
      ],
    } as unknown as SessionReport;

    const outcome = buildNegotiationOutcome(report, km);
    expect(outcome!.candidateAsk).toBe(65);
    // Stage 1 "You named a counter number" must light up.
    expect(derivePhases(outcome!)[0].reached).toBe(true);
    expect(derivePhases(outcome!)[0].note).toBe("Asked for ₹65 LPA");
    // N1 "Anchored at" tile must not read the false "Never anchored".
    expect(anchorAtLabel(km.anchorTurn, outcome!.candidateAsk)).not.toBe("Never anchored");
    // Counter-ladder must not render the "NO COUNTER NAMED" none-verdict.
    const bracket = deriveAnchorBracket(outcome!);
    expect(bracket?.type).not.toBe("none");
  });
});

/* R-1 residual (2026-07-13, live staging — report 03bbe2b9, Flipkart EM). N1's
 * "Anchored at" tile renders anchorAtLabel from the RAW kernel metrics, but a
 * legacy fixed-only row persisted candidateAskLpa null while the report's
 * authoritative ask (negotiationOutcome.candidateAsk) recovered ₹65 from the
 * transcript — so N1 read "Never anchored" beside the body's "you'd countered at
 * ₹65". reconcileKernelMetricsForReport fills the ask N1 sees from that single
 * source when — and ONLY when — the kernel didn't persist one. */
describe("N1 anchor tile reconciles to the report's single-source ask", () => {
  const legacyNoAsk = {
    outcome: "accepted", anchorTurn: null, leverDiversity: 3, lpaGained: 20.5,
    lpaPerTurn: 2.9, bandTraversal: 1, overBandViolation: false, totalTurns: 7,
    score: 47,
    // legacy fixed-only row: the fold was never persisted
  } as unknown as KernelMetrics;

  it("fills candidateAskLpa from the derived ask when the kernel row lacks one", () => {
    const outcome = { candidateAsk: 65 } as NonNullable<ReturnType<typeof buildNegotiationOutcome>>;
    const reconciled = reconcileKernelMetricsForReport(legacyNoAsk, outcome);
    expect(reconciled!.candidateAskLpa).toBe(65);
    // With the ask present, N1's tile reads "Anchored (turn not tracked)" — never
    // the false "Never anchored" that stood beside the body's stated ₹65.
    expect(anchorAtLabel(reconciled!.anchorTurn, reconciled!.candidateAskLpa)).toBe(
      "Anchored (turn not tracked)",
    );
  });

  it("never overrides a kernel-persisted ask (fresh rows untouched)", () => {
    const fresh = { ...legacyNoAsk, candidateAskLpa: 58 } as KernelMetrics;
    const outcome = { candidateAsk: 65 } as NonNullable<ReturnType<typeof buildNegotiationOutcome>>;
    const reconciled = reconcileKernelMetricsForReport(fresh, outcome);
    expect(reconciled!.candidateAskLpa).toBe(58); // kernel's own value wins
  });

  it("leaves the row unchanged when neither source has an ask (honest 'Never anchored')", () => {
    const outcome = { candidateAsk: null } as NonNullable<ReturnType<typeof buildNegotiationOutcome>>;
    const reconciled = reconcileKernelMetricsForReport(legacyNoAsk, outcome);
    expect(reconciled!.candidateAskLpa).toBeUndefined();
    expect(anchorAtLabel(reconciled!.anchorTurn, reconciled!.candidateAskLpa)).toBe("Never anchored");
  });
});

/* S8-B23 (2026-07-22) — abandoned session (discovery only, exchange 3, no offer made)
 * generated report with fabricated walk-away verdict "You walked away from a ₹50.4 LPA
 * offer". Root cause: the heuristic transcript scan matched a stopping phrase and
 * classified "walked_away"; the kernel's authoritative "stalemate" outcome was not
 * overriding the heuristic's walk-away classification.
 * Fix: any kernel outcome that is NOT "accepted" / "walked-away" (i.e. "stalemate" /
 * "in-progress") forces "no_agreement" even when the transcript heuristic fired. */
describe("buildNegotiationOutcome — S8-B23 stalemate kernel overrides heuristic walk-away", () => {
  const stalemateMetics = {
    outcome: "stalemate" as const,
    anchorTurn: null, leverDiversity: 0, lpaGained: 0, lpaPerTurn: 0,
    bandTraversal: 0, overBandViolation: false, totalTurns: 3, score: 12,
    // No trajectory — abandonment in discovery, no offer was made.
  } as unknown as NonNullable<DashboardSession["negotiationMetrics"]>;

  it("S8-B23: stalemate kernel → no_agreement even when transcript has walk-away phrase", () => {
    // The candidate's stopping phrase ("I'll stop here") matches the walk-away heuristic.
    const report = {
      perQuestion: [
        { question: "What are you looking for?", answerText: "I'll stop here." },
        { question: "Any questions?", answerText: "No thanks, I decline to continue." },
      ],
    } as unknown as import("../dashboardData").SessionReport;
    const outcome = buildNegotiationOutcome(report, stalemateMetics);
    expect(outcome).not.toBeUndefined();
    // Must be no_agreement — NOT walked_away (heuristic misclassification).
    expect(outcome!.outcome).toBe("no_agreement");
    // No offers were made — verdict should reflect discovery-only termination.
    expect(outcome!.offers).toHaveLength(0);
  });

  it("S8-B23: in-progress kernel also forces no_agreement", () => {
    const inProgressMetrics = { ...stalemateMetics, outcome: "in-progress" as const };
    const report = {
      perQuestion: [
        { question: "Tell me about yourself.", answerText: "I'm walking away, not worth it." },
      ],
    } as unknown as import("../dashboardData").SessionReport;
    const outcome = buildNegotiationOutcome(report, inProgressMetrics);
    expect(outcome!.outcome).toBe("no_agreement");
  });

  it("S8-B23: walked-away kernel still produces walked_away (legitimate walk-away preserved)", () => {
    const walkedMetrics = { ...stalemateMetics, outcome: "walked-away" as const };
    const report = {
      perQuestion: [
        { question: "₹48 LPA is our offer.", answerText: "I'll pass — too low for me." },
      ],
    } as unknown as import("../dashboardData").SessionReport;
    const outcome = buildNegotiationOutcome(report, walkedMetrics);
    expect(outcome!.outcome).toBe("walked_away");
  });
});
