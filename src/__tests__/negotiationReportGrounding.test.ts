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
  capAnchorSkillsIfNoCounter,
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

  it("never touches a walk-away for leverage/anchoring/closing — but caps Concession Strategy (S3-B4)", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 82, "hire",
      outcome({ outcome: "walked_away", gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // Declining a lowball is not a fold — leverage, anchoring, and closing may
    // legitimately be high on a walk-away (you DID anchor and use leverage).
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(byName(r.skills, "Anchoring")).toBe(95);
    expect(byName(r.skills, "Package Thinking")).toBe(95);
    // Overall and band are preserved — walk-away is not a weak outcome.
    expect(r.overallScore).toBe(82);
    expect(r.band).toBe("hire");
    // S3-B4: "Concession Strategy" at 95 on a walk-away is misleading — no
    // give-and-take occurred to evaluate. Capped at a neutral band (≤60).
    expect(byName(r.skills, "Concession Strategy")).toBeLessThanOrEqual(60);
  });

  it("S3-B4: Concession Strategy cap on walk-away is monotonic (never raises a low score)", () => {
    const lowConcession = inflatedSkills().map((s) =>
      s.name === "Concession Strategy" ? { ...s, score: 40 } : s,
    );
    const r = groundNegotiationReport(
      lowConcession, 65, "leanHire",
      outcome({ outcome: "walked_away", gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // A scorer that already gave a low concession score must not be raised.
    expect(byName(r.skills, "Concession Strategy")).toBe(40);
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

  /* S20-B5 (2026-07-22): a no_agreement session where the candidate never
   * named a number (candidateAsk === null) was rendering "71/100 Hire" while
   * the kernel execution score was 5/100 and ₹0 was gained. The closing-skill
   * cap (45) brought down Closing Technique but left the headline overallScore
   * at 71. Cap the overall score at NOT_CLOSED_CEILING + 10 (= 55) so the
   * verdict can't read "Hire" when no number was ever on the table. */
  it("S20-B5: caps overall score to ≤55 when no_agreement and candidate named no number", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 71, "hire",
      outcome({ outcome: "no_agreement", candidateAsk: null, gapClosurePct: null }),
      FLIPKART_BANDS,
    );
    expect(r.overallScore).toBeLessThanOrEqual(55);
    expect(r.band).not.toBe("hire");
    expect(r.band).not.toBe("strongHire");
    // Closing Technique also capped (the existing no_agreement cap).
    expect(byName(r.skills, "Closing Technique")).toBeLessThanOrEqual(45);
  });

  it("S20-B5: does NOT apply headline cap when candidateAsk is present (named a number but didn't close)", () => {
    // candidateAsk !== null → they anchored; only the closing-skills cap applies.
    const r = groundNegotiationReport(
      inflatedSkills(), 62, "leanHire",
      outcome({ outcome: "no_agreement", candidateAsk: 55, gapClosurePct: null }),
      FLIPKART_BANDS,
    );
    // Headline score preserved — the existing closing-skill-only path is correct here.
    expect(r.overallScore).toBe(62);
    expect(r.band).toBe("leanHire");
    expect(byName(r.skills, "Closing Technique")).toBeLessThanOrEqual(45);
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

/* REPORT-4b — anchor/counter/specificity bars vs the kernel's counter-named
 * truth (candidateAsk === null). This was the last counter-aware report surface
 * not pinned to candidateAsk: a session that never named a number rendered
 * "Anchoring 70 / Specificity 70" beside the same report's "0 of 5 skills",
 * "Numbers stated 0%", and the "No counter named" headline. An anchor score IS
 * the strength of the number you named — none named ⇒ provable failure.
 *
 * It is a SEPARATE, UNGATED pass (not folded into groundNegotiationReport) so it
 * reaches heuristic/legacy rows that skip grounding — the live session 686b5699
 * that first exposed the contradiction was exactly such a row. It keys only on
 * candidateAsk (reliable on every row) and composes with any gap cap via
 * Math.min at the call site. */
describe("capAnchorSkillsIfNoCounter — REPORT-4b anchor grounding on no-counter", () => {
  const noCounter = (over: Partial<NonNullable<Outcome>> = {}) =>
    outcome({ candidateAsk: null, ...over });

  it("caps anchor/counter/specificity bars when the kernel recorded no counter", () => {
    const skills = [
      ...inflatedSkills(),
      { name: "Specificity", score: 92 },
      { name: "Counter-Offer Handling", score: 90 },
    ];
    const r = capAnchorSkillsIfNoCounter(skills, noCounter());
    expect(byName(r, "Anchoring")).toBeLessThanOrEqual(35);
    expect(byName(r, "Specificity")).toBeLessThanOrEqual(35);
    expect(byName(r, "Counter-Offer Handling")).toBeLessThanOrEqual(35);
  });

  it("caps the DETERMINISTIC-scorer anchor/counter axes on a no-counter session", () => {
    const detSkills = NEG_AXES.map((name) => ({ name, score: 95 }));
    const r = capAnchorSkillsIfNoCounter(detSkills, noCounter());
    expect(byName(r, "Anchor strength")).toBeLessThanOrEqual(35);
    expect(byName(r, "Counter-offer judgement")).toBeLessThanOrEqual(35);
  });

  it("does NOT touch demeanour / discovery / package / leverage axes on no-counter", () => {
    const r = capAnchorSkillsIfNoCounter(inflatedSkills(), noCounter());
    // A candidate can research the package and stay composed without a counter.
    expect(byName(r, "Composure")).toBe(90);
    expect(byName(r, "Professional Tone")).toBe(88);
    expect(byName(r, "Leverage Use")).toBe(95);
    expect(byName(r, "Package Thinking")).toBe(95);
  });

  it("fires regardless of outcome — walk-away, stalemate, or accepted", () => {
    for (const o of ["walked_away", "no_agreement", "accepted"] as const) {
      const r = capAnchorSkillsIfNoCounter(inflatedSkills(), noCounter({ outcome: o }));
      expect(byName(r, "Anchoring")).toBeLessThanOrEqual(35);
    }
  });

  it("composes with the accepted fold cap via Math.min (takes the lower)", () => {
    // groundNegotiationReport caps outcome axes to 45 on a fold; the ungated
    // anchor pass then lowers the anchor axis further to ≤35.
    const grounded = groundNegotiationReport(
      inflatedSkills(), 79, "hire",
      noCounter({ outcome: "accepted", gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    const r = capAnchorSkillsIfNoCounter(grounded.skills, noCounter({ outcome: "accepted", gapClosurePct: 0 }));
    expect(byName(r, "Anchoring")).toBeLessThanOrEqual(35);
    // A non-anchor outcome axis stays at the fold ceiling (45), not 35.
    expect(byName(r, "Leverage Use")).toBeLessThanOrEqual(45);
    expect(byName(r, "Leverage Use")).toBeGreaterThan(35);
  });

  it("leaves anchor bars intact once a counter WAS named (candidateAsk set)", () => {
    const skills = inflatedSkills();
    const r = capAnchorSkillsIfNoCounter(skills, outcome({ candidateAsk: 62 }));
    expect(r).toBe(skills); // untouched reference
    expect(byName(r, "Anchoring")).toBe(95);
  });

  it("is a no-op for a non-negotiation (undefined outcome)", () => {
    const skills = inflatedSkills();
    expect(capAnchorSkillsIfNoCounter(skills, undefined)).toBe(skills);
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

  /* S6-B5 — "Numbers stated" undercount regression.
   * buildNegotiationMetrics was scanning report.perQuestion (always 1 LLM-
   * collapsed item for negotiations) instead of the raw transcript user turns.
   * Denominator = 1 so ANY miss gave 0 → floored to 25. Fix: pass session.transcript
   * and scan user turns directly. Also extends anchorRe to match ₹N without unit. */
  it("S6-B5: Numbers stated reflects per-turn transcript count, not collapsed perQuestion", () => {
    // 4 user turns out of 5 contain an explicit number mention → 80%
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "What are your salary expectations?" },
          { speaker: "user", text: "I'm looking for ₹200 LPA minimum." },
          { speaker: "ai",   text: "That's above our band. Our ceiling is ₹55 LPA." },
          { speaker: "user", text: "I understand, but my ask is ₹200 LPA." },
          { speaker: "ai",   text: "Can we discuss further?" },
          { speaker: "user", text: "I need at least 200 LPA — that's firm." },
          { speaker: "ai",   text: "Let me check with the team." },
          { speaker: "user", text: "Sure, but my position remains 200 lakhs." },
          { speaker: "ai",   text: "Unfortunately we cannot go that high." },
          { speaker: "user", text: "Then I'll have to decline. Thank you." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const numStated = out.metrics.find((m) => m.label === "Numbers stated");
    expect(numStated).toBeDefined();
    // 4 of 5 user turns mention a number → 80%, not stuck at 25%.
    expect(numStated!.value).toBeGreaterThan(25);
    expect(numStated!.value).toBeGreaterThanOrEqual(75);
  });

  it("S6-B5: ₹N without unit suffix (e.g. '₹200') is counted by the expanded anchorRe", () => {
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "What salary are you expecting?" },
          { speaker: "user", text: "I want ₹200 — that's my target." },
          { speaker: "ai",   text: "That is quite high." },
          { speaker: "user", text: "I understand, but ₹200 is what I need." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const numStated = out.metrics.find((m) => m.label === "Numbers stated");
    expect(numStated).toBeDefined();
    // Both user turns have ₹200 (no unit) — should match with expanded regex.
    // 2/2 turns = 100%, definitely above the stuck-at-25 floor.
    expect(numStated!.value).toBeGreaterThanOrEqual(75);
  });

  it("S6-B5: falls back to perQuestion when transcript is empty (legacy rows)", () => {
    const ctx = {
      report: negReport({
        perQuestion: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { idx: 0, question: "What is your ask?", answerText: "I want ₹65 LPA.", score: 80, verdict: "strong", explanation: "", starPresence: { S: true, T: true, A: true, R: true, L: false } } as any,
        ],
      }),
      session: negSession({ transcript: [] }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const numStated = out.metrics.find((m) => m.label === "Numbers stated");
    expect(numStated).toBeDefined();
    // Fallback: 1 of 1 perQuestion has a number → 100%, not 0%.
    expect(numStated!.value).toBeGreaterThanOrEqual(25);
  });
});

/* S13-B11 (2026-07-20) — frantic-mood pause tics ("Uh, " / "Umm, ") were
 * leaking into Per-Question Review headings because buildNegotiationPerQuestion
 * used the raw pendingRecruiter text verbatim. The strip happens in the adapter
 * so the heading is clean regardless of which prose-realism layer fired. */
describe("buildNegotiationPerQuestion — S13-B11 pause-tic heading strip", () => {
  it("S13-B11: strips leading 'Uh,' from per-question heading", () => {
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "Uh, what salary are you expecting?" },
          { speaker: "user", text: "I'm looking for 65 LPA." },
          { speaker: "ai",   text: "Umm, can you walk me through your current CTC?" },
          { speaker: "user", text: "My current CTC is 42 LPA." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const headings = out.questions.map((q) => q.text);
    // "Uh, what salary…" → "what salary…" (tic stripped, NOT sentence-cased by adapter)
    expect(headings[0]).not.toMatch(/^Uh,/i);
    expect(headings[0]).not.toMatch(/^Umm?,/i);
    // Content is preserved after stripping
    expect(headings[0]).toMatch(/salary/i);
  });

  it("S13-B11: strips stacked tics ('Uh, Umm, ') from heading", () => {
    // Need ≥2 user turns so buildNegotiationPerQuestion returns items, not null.
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "Uh, Umm, that seems high." },
          { speaker: "user", text: "I understand, but that's my ask." },
          { speaker: "ai",   text: "Umm, can we come down a bit?" },
          { speaker: "user", text: "No, 65 LPA is my final number." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    expect(out.questions[0]?.text).not.toMatch(/^(?:Uh|Umm?),/i);
    expect(out.questions[0]?.text).toMatch(/high/i);
    expect(out.questions[1]?.text).not.toMatch(/^(?:Uh|Umm?),/i);
  });

  it("S13-B11: leaves heading intact when no tic present", () => {
    // Need ≥2 user turns so buildNegotiationPerQuestion returns items, not null.
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "What are your expectations?" },
          { speaker: "user", text: "I want 65 LPA." },
          { speaker: "ai",   text: "Can you walk me through your current CTC?" },
          { speaker: "user", text: "My current CTC is 42 LPA." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    expect(out.questions[0]?.text).toBe("What are your expectations?");
    expect(out.questions[1]?.text).toBe("Can you walk me through your current CTC?");
  });
});

/* S21-B4 (2026-07-22) — "Disclosure leaks" penalised intentional strategic CTC
 * disclosures. Root cause: buildNegotiationMetrics scanned all candidate text
 * globally with a CTC-leak regex. Fix: per-turn scan — a match is a leak ONLY if
 * the preceding AI turn did NOT ask for the candidate's CTC. */
describe("buildNegotiationMetrics — S21-B4 disclosure leak elicitation gate", () => {
  it("S21-B4: recruiter-elicited CTC answer is NOT counted as a leak", () => {
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "What's your current CTC?" },
          { speaker: "user", text: "My current CTC is 32 LPA." },
          { speaker: "ai",   text: "And what's your target?" },
          { speaker: "user", text: "I'm looking for 48 LPA." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const leaks = out.metrics.find((m) => m.label === "Disclosure leaks");
    expect(leaks).toBeDefined();
    expect(leaks!.value).toBe(0); // recruiter asked → not a leak
  });

  it("S21-B4: volunteered CTC without recruiter asking IS counted as a leak", () => {
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "Tell me about your background." },
          { speaker: "user", text: "I'm currently earning 32 LPA and looking for a move." },
          { speaker: "ai",   text: "Interesting. What are your expectations?" },
          { speaker: "user", text: "I want 48 LPA." },
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const leaks = out.metrics.find((m) => m.label === "Disclosure leaks");
    expect(leaks).toBeDefined();
    expect(leaks!.value).toBeGreaterThan(0);
  });

  it("S21-B4: multiple turns — only the unprompted disclosures count", () => {
    const ctx = {
      report: negReport(),
      session: negSession({
        transcript: [
          { speaker: "ai",   text: "What's your current salary?" }, // asks
          { speaker: "user", text: "My current CTC is 32 LPA." },   // elicited → NOT a leak
          { speaker: "ai",   text: "Got it. Tell me about a key project." },
          { speaker: "user", text: "I make 32 LPA and want to grow." }, // volunteered → leak
          { speaker: "ai",   text: "What's your current package?" },   // asks again
          { speaker: "user", text: "I earn 32 LPA as mentioned." },    // elicited → NOT a leak
        ],
      }),
    } as AdapterContext;
    const out = sessionReportToInterviewResult(ctx);
    const leaks = out.metrics.find((m) => m.label === "Disclosure leaks");
    expect(leaks).toBeDefined();
    expect(leaks!.value).toBe(1); // only the middle unprompted turn
  });
});
