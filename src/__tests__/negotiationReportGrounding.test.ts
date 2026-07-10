/* Report-layer coherence guarantee (PRI-66 belt-and-suspenders).
 *
 * Three code paths can score a negotiation — the LLM evaluator, the server
 * deterministic fallback, and the client heuristic — and only the last one
 * grounds its own scores in the outcome. `groundNegotiationReport` is the
 * single convergence point where the kernel's authoritative gap-closure and
 * the finished skill scores are both in hand, so it enforces the invariant
 * that NO path may render "accepted, ~0% of the gap closed" beside a 95
 * Leverage bar. These tests lock the reconciliation: it only ever lowers,
 * only on an accepted-but-weak close, and moves skills + overall + band down
 * in lockstep while leaving demeanour, strong closes, and walk-aways alone. */
import { describe, it, expect } from "vitest";
import {
  groundNegotiationReport,
  sessionReportToInterviewResult,
  type AdapterContext,
} from "../sessionReport/adapter";
import type { InterviewResultData } from "../sessionReport/types";
import type { SessionReport } from "../dashboardData";
import type { DashboardSession } from "../dashboardTypes";
import { NEG_AXES } from "../../server-handlers/_deterministic-neg-report";

type Outcome = InterviewResultData["negotiationOutcome"];

/** Minimal authoritative outcome — only the fields the grounding reads. */
const outcome = (over: Partial<NonNullable<Outcome>>): Outcome => ({
  offers: [],
  finalTotal: null,
  outcome: "accepted",
  candidateAsk: 65,
  gapClosurePct: 0,
  leverDiversity: 0,
  ...over,
}) as Outcome;

/** A candidate who used all the right words → the scorer handed out 95s
 *  across the board. The grounding must decide by outcome, not by these. */
const inflatedSkills = () => [
  { name: "Anchoring", score: 95 },
  { name: "Leverage Use", score: 95 },
  { name: "Closing Technique", score: 95 },
  { name: "Concession Strategy", score: 95 },
  { name: "Package Thinking", score: 95 },
  { name: "Composure", score: 90 },
  { name: "Professional Tone", score: 88 },
];

const byName = (skills: Array<{ name: string; score: number }>, name: string) =>
  skills.find((s) => s.name === name)!.score;

const FLIPKART_BANDS = { strongHire: 90, hire: 75, leanHire: 60, noHire: 42 };

describe("groundNegotiationReport — report-layer coherence", () => {
  it("caps outcome skills, overall, and band on an accepted 0%-gap fold", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire", outcome({ gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // Outcome-dependent axes capped to the fold ceiling (45).
    expect(byName(r.skills, "Leverage Use")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Closing Technique")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Anchoring")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Concession Strategy")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Package Thinking")).toBeLessThanOrEqual(45);
    // Overall pulled down and the band recomputed so the pill can't say "Hire".
    expect(r.overallScore).toBeLessThanOrEqual(60);
    expect(r.band).not.toBe("hire");
    expect(r.band).not.toBe("strongHire");
    // Demeanour axes are never touched — a calm, polite fold is still calm.
    expect(byName(r.skills, "Composure")).toBe(90);
    expect(byName(r.skills, "Professional Tone")).toBe(88);
  });

  /* The prior tests all use the LLM-evaluator naming scheme ("Leverage Use",
   * "Closing Technique"…). The SERVER DETERMINISTIC fallback — the active
   * scorer whenever both LLM providers are exhausted — emits an entirely
   * different set of display names (NEG_AXES). The grounding regex silently
   * missed three of them (Trade-off awareness, Structural fluency, Walk-away
   * discipline), so an accepted-caved report rendered those bars at 95 beside
   * "0% of the gap closed". Lock every outcome-dependent NEG_AXES name to the
   * fold ceiling; import the real constant so a rename can't re-open the gap. */
  it("caps the DETERMINISTIC-scorer axis names on an accepted 0%-gap fold", () => {
    const detSkills = NEG_AXES.map((name) => ({ name, score: 95 }));
    const r = groundNegotiationReport(
      detSkills, 92, "strongHire", outcome({ gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // Every value-extraction / outcome axis in the deterministic scheme caps.
    for (const name of [
      "Anchor strength",
      "Counter-offer judgement",
      "Trade-off awareness",
      "Structural fluency",
      "Walk-away discipline",
    ]) {
      expect(byName(r.skills, name)).toBeLessThanOrEqual(45);
    }
    // "Tactical composure" is a demeanour axis — a calm fold is still calm.
    expect(byName(r.skills, "Tactical composure")).toBe(95);
    expect(r.overallScore).toBeLessThanOrEqual(60);
    expect(r.band).not.toBe("hire");
    expect(r.band).not.toBe("strongHire");
  });

  it("applies a mediocre ceiling (60) for a token-movement close", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire", outcome({ gapClosurePct: 20 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBeLessThanOrEqual(60);
    expect(byName(r.skills, "Leverage Use")).toBeGreaterThan(45);
  });

  it("applies a decent-but-not-strong ceiling (75) under half the gap", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 88, "strongHire", outcome({ gapClosurePct: 45 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBeLessThanOrEqual(75);
    expect(byName(r.skills, "Leverage Use")).toBeGreaterThan(60);
  });

  it("leaves a genuinely strong close (≥55% gap closed) untouched", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 88, "strongHire", outcome({ gapClosurePct: 80 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(r.overallScore).toBe(88);
    expect(r.band).toBe("strongHire");
  });

  it("never touches a walk-away, even with high skills", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 82, "hire",
      outcome({ outcome: "walked_away", gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // Declining a lowball is not a fold — leverage may legitimately be high.
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(r.overallScore).toBe(82);
    expect(r.band).toBe("hire");
  });

  it("does not second-guess the scorer when gap closure is unknown", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire",
      outcome({ gapClosurePct: null }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(r.overallScore).toBe(79);
    expect(r.band).toBe("hire");
  });

  it("caps Closing Technique on a no_agreement (close never reached)", () => {
    // PRI-67: a stalemate / ran-out-of-turns outcome never reached the close
    // stage (derivePhases.reachedClose false), so an 85+ Closing bar beside
    // "You reached the close — not reached" is a contradiction. Cap only Closing.
    const r = groundNegotiationReport(
      inflatedSkills(), 58, "leanHire",
      outcome({ outcome: "no_agreement", gapClosurePct: null }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Closing Technique")).toBeLessThanOrEqual(45);
    // The other outcome axes are reachable mid-negotiation — left untouched.
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(byName(r.skills, "Package Thinking")).toBe(95);
    expect(byName(r.skills, "Anchoring")).toBe(95);
    // Demeanour untouched, and the headline is NOT a Hire claim here → leave it.
    expect(byName(r.skills, "Composure")).toBe(90);
    expect(r.overallScore).toBe(58);
    expect(r.band).toBe("leanHire");
  });

  it("is a no-op for a non-negotiation (undefined outcome)", () => {
    const skills = inflatedSkills();
    const r = groundNegotiationReport(skills, 79, "hire", undefined, FLIPKART_BANDS);
    expect(r.skills).toBe(skills);
    expect(r.overallScore).toBe(79);
    expect(r.band).toBe("hire");
  });

  it("never RAISES a score or band (monotonic down-only)", () => {
    // Scorer already scored the fold low → grounding must not lift it.
    const lowSkills = [
      { name: "Leverage Use", score: 30 },
      { name: "Closing Technique", score: 35 },
    ];
    const r = groundNegotiationReport(
      lowSkills, 40, "noHire", outcome({ gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBe(30);
    expect(byName(r.skills, "Closing Technique")).toBe(35);
    expect(r.overallScore).toBeLessThanOrEqual(40);
  });

  it("falls back to default bands when calibration is absent", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire", outcome({ gapClosurePct: 0 }),
      // no calibration bands passed
    );
    // Default profile: leanHire 55, hire 70. Grounded score ≤60 → not "hire".
    expect(r.overallScore).toBeLessThanOrEqual(60);
    expect(r.band).not.toBe("hire");
  });
});

/* End-to-end proof that the gating + wiring inside the real adapter entry
 * point behaves: a negotiation session whose kernel metrics say the
 * candidate accepted a 0%-gap fold must NOT surface inflated skills, a
 * "Hire" verdict, or a headline score that outruns them — no matter that
 * the scorer (here standing in for any of the three paths) handed out 95s. */
function negReport(over: Partial<SessionReport> = {}): SessionReport {
  const base = {
    version: "mvp-6",
    overallScore: 79,
    scoreConfidence: 0.8,
    band: "hire",
    verdict: "Named a number and cited market data, then accepted the opening.",
    wins: [],
    fixes: [],
    redFlags: [],
    coreMetrics: { fillerPerMin: 2, silenceRatio: 0.1, paceWpm: 160, energy: 70 },
    advancedDelivery: {
      hedgingPerMin: 1, lexicalDiversity: 0.7, firstPersonRatio: 0.5,
      medianLatencyMs: 1500, selfCorrectionRate: 0.5,
    },
    skills: [
      { name: "Anchoring", score: 95 },
      { name: "Leverage Use", score: 95 },
      { name: "Closing Technique", score: 95 },
      { name: "Package Thinking", score: 95 },
      { name: "Composure", score: 90 },
    ],
    perQuestion: [
      { idx: 0, question: "We can offer ₹48.3 LPA.", answerText: "Okay, I accept the offer.", score: 80, verdict: "strong", explanation: "", starPresence: { S: true, T: true, A: true, R: true } },
    ],
    thoughtBubble: [],
    calibration: { companyLabel: "Flipkart", note: "", bands: { strongHire: 90, hire: 75, leanHire: 60, noHire: 42 } },
    crossSessionInsights: [],
    priorSessionCount: 2,
    storyReuseFindings: [],
    blindSpots: [],
    readiness: null,
    reverseInterview: null,
    model: "test",
  } as unknown as SessionReport;
  return { ...base, ...over };
}

function negSession(over: Partial<DashboardSession> = {}): DashboardSession {
  return {
    id: "neg1", date: "2026-07-07", dateLabel: "Today", type: "salary-negotiation",
    role: "Engineering Manager", score: 79, change: 0, duration: "9 min",
    difficulty: "standard", company: "Flipkart", focus: "salary-negotiation",
    topStrength: "Anchoring", topWeakness: "Closing", feedback: "",
    transcript: [], questionScores: [],
    negotiationMetrics: {
      outcome: "accepted", anchorTurn: 1, leverDiversity: 1, lpaGained: 0,
      lpaPerTurn: 0, bandTraversal: 0, overBandViolation: false, totalTurns: 7,
      score: 79, initialOfferLpa: 48.3, finalOfferLpa: 48.3, candidateAskLpa: 65,
      offerTrajectoryLpa: [48.3, 48.3], // recruiter never moved
    },
    ...over,
  } as unknown as DashboardSession;
}

describe("sessionReportToInterviewResult — fold is grounded end-to-end", () => {
  it("caps skills, score, and verdict for an accepted 0%-gap fold", () => {
    const ctx = { report: negReport(), session: negSession() } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);

    // Kernel says gapClosurePct 0 → outcome-dependent skills capped to 45.
    const score = (n: string) => out.skills.find((s) => s.name === n)!.score;
    expect(score("Leverage Use")).toBeLessThanOrEqual(45);
    expect(score("Closing Technique")).toBeLessThanOrEqual(45);
    expect(score("Anchoring")).toBeLessThanOrEqual(45);
    expect(score("Package Thinking")).toBeLessThanOrEqual(45);
    // Demeanour untouched.
    expect(score("Composure")).toBe(90);
    // Headline reconciled: score down, verdict no longer "Hire".
    expect(out.overallScore).toBeLessThanOrEqual(60);
    expect(out.verdict).not.toBe("hire");
    expect(out.verdict).not.toBe("strongHire");
    // The report's own outcome agrees with the cap it drove.
    expect(out.negotiationOutcome?.outcome).toBe("accepted");
    expect(out.negotiationOutcome?.gapClosurePct).toBe(0);
  });

  it("I-11: hero arrow (scoreDelta) is coherent with the grounded sparkline's last point", () => {
    /* The sparkline plots groundedRecentScores whose LAST point is forced to the
     * grounded gauge score (R-4). The arrow must be derived from that SAME
     * grounded array, not the ungrounded ctx.recentScores — otherwise a capped
     * negotiation renders a big green "↑" beside a sparkline whose last dot ticked
     * down. Prior session 50, ungrounded current 95, grounding caps the fold to
     * ≤60: the arrow must reflect (grounded - 50), a small delta, and the plotted
     * last point must equal the gauge score. */
    const ctx = {
      report: negReport(),
      session: negSession(),
      recentScores: [50, 95],
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const rs = out.recentScores!;
    // Single source: the plotted last point IS the grounded gauge score.
    expect(rs[rs.length - 1]).toBe(out.overallScore);
    // Arrow agrees with the last plotted segment (grounded current − prior).
    expect(out.scoreDelta).toBe(rs[rs.length - 1] - rs[rs.length - 2]);
    // And it did NOT read the ungrounded 95 (which would have shown ↑45).
    expect(out.scoreDelta).not.toBe(95 - 50);
    expect(out.scoreDelta! < 45).toBe(true);
  });

  it("leaves a legacy row without kernel metrics untouched (opt-out)", () => {
    // No negotiationMetrics → outcome is heuristic → grounding must not fire.
    const ctx = {
      report: negReport(),
      session: negSession({ negotiationMetrics: undefined }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    expect(out.skills.find((s) => s.name === "Leverage Use")!.score).toBe(95);
    expect(out.overallScore).toBe(79);
    expect(out.verdict).toBe("hire");
  });
});
