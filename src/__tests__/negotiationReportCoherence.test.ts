/* Report-coherence regression tests for the salary-negotiation report.
 *
 * I-10 — the candidate ask must be ONE integer value across every surface.
 * I-13 — the Per-Question Review must show every recorded exchange, not a
 *        single aggregate item, reconstructed from the real transcript.
 *
 * (I-8 is a presentation-only change in PhaseLadderPanel — the underlying
 *  derivePhases reached/not-reached data is deliberately left as-is, so it is
 *  covered by the existing derivePhases tests, not asserted here.) */
import { describe, it, expect } from "vitest";
import {
  buildNegotiationOutcome,
  sessionReportToInterviewResult,
} from "../sessionReport/adapter";
import { derivePhases } from "../sessionReport/derivations";
import type { SessionReport } from "../dashboardData";
import type { DashboardSession } from "../dashboardTypes";

type KernelMetrics = NonNullable<DashboardSession["negotiationMetrics"]>;

const kernel = (over: Partial<KernelMetrics>): KernelMetrics => ({
  outcome: "accepted",
  anchorTurn: 1,
  leverDiversity: 2,
  lpaGained: 2,
  lpaPerTurn: 0.7,
  bandTraversal: 0.5,
  overBandViolation: false,
  totalTurns: 6,
  score: 68,
  initialOfferLpa: 40,
  finalOfferLpa: 46,
  candidateAskLpa: 48,
  offerTrajectoryLpa: [40, 44, 46],
  ...over,
});

const opaqueReport = {
  perQuestion: [
    { question: "Let's talk numbers.", answerText: "That works, let's proceed." },
  ],
} as unknown as SessionReport;

describe("I-10 — candidate ask is a single rounded value everywhere", () => {
  it("rounds a fractional kernel ask to a whole LPA at derivation", () => {
    const outcome = buildNegotiationOutcome(
      opaqueReport,
      kernel({ candidateAskLpa: 48.4 }),
    );
    expect(outcome!.candidateAsk).toBe(48);
    // The stage-note surface reads the same rounded value — no bare float.
    expect(derivePhases(outcome!)[0].note).toBe("Asked for ₹48 LPA");
  });

  it("rounds a fractional ask in the transcript-heuristic (legacy) path", () => {
    const legacy = {
      outcome: "stalemate",
      anchorTurn: 2,
      leverDiversity: 1,
      lpaGained: 0,
      lpaPerTurn: 0,
      bandTraversal: 0,
      overBandViolation: false,
      totalTurns: 4,
      score: 40,
    } as unknown as KernelMetrics;
    const report = {
      perQuestion: [
        { question: "I can offer ₹40 LPA.", answerText: "I'm targeting 48.5 LPA." },
      ],
    } as unknown as SessionReport;
    const outcome = buildNegotiationOutcome(report, legacy);
    expect(Number.isInteger(outcome!.candidateAsk!)).toBe(true);
    expect(outcome!.candidateAsk).toBe(49);
  });

  it("is an integer that every surface (phase note, ask value) shares", () => {
    const outcome = buildNegotiationOutcome(
      opaqueReport,
      kernel({ candidateAskLpa: 47.6 }),
    );
    const ask = outcome!.candidateAsk!;
    expect(Number.isInteger(ask)).toBe(true);
    // derivations phase note and the outcome.candidateAsk are one value.
    expect(derivePhases(outcome!)[0].note).toBe(`Asked for ₹${ask} LPA`);
  });
});

describe("I-13 — Per-Question Review shows every recorded exchange", () => {
  const baseSession = (over: Partial<DashboardSession>): DashboardSession =>
    ({
      id: "s1",
      type: "salary-negotiation",
      focus: "salary-negotiation",
      role: "Senior Product Designer",
      company: "Acme",
      difficulty: "standard",
      duration: "12 min",
      transcript: [],
      questionScores: [],
      feedback: "",
      ...over,
    } as unknown as DashboardSession);

  // Evaluator collapses a negotiation into ONE aggregate perQuestion item.
  const aggregateReport = {
    perQuestion: [
      {
        idx: 0,
        question: "Full negotiation",
        answerText: "aggregate answer",
        score: 68,
        verdict: "partial",
        starPresence: { S: false, T: false, A: false, R: false },
      },
    ],
    redFlags: [],
    skills: [{ name: "Anchoring", score: 60 }],
    overallScore: 68,
    band: "leanHire",
    wins: [],
    fixes: [],
    blindSpots: [],
    storyReuseFindings: [],
    crossSessionInsights: [],
    thoughtBubble: [],
    scoreConfidence: 0.8,
    coreMetrics: { fillerPerMin: 0, silenceRatio: 0, paceWpm: 150, energy: 70 },
    advancedDelivery: { medianLatencyMs: 0, selfCorrectionRate: 0 },
  } as unknown as SessionReport;

  it("reconstructs one item per candidate turn from the transcript (6 exchanges)", () => {
    const transcript = [
      { speaker: "ai", text: "We can offer ₹40 LPA." },
      { speaker: "user", text: "I was targeting ₹48 LPA." },
      { speaker: "ai", text: "That's a stretch." },
      { speaker: "user", text: "My market data supports it." },
      { speaker: "ai", text: "We can do ₹44 LPA." },
      { speaker: "user", text: "Closer — can we get to 46?" },
      { speaker: "ai", text: "₹46 LPA is our ceiling." },
      { speaker: "user", text: "Let's add a signing bonus then." },
      { speaker: "ai", text: "We can do a ₹3L bonus." },
      { speaker: "user", text: "That works." },
      { speaker: "ai", text: "Great, welcome aboard." },
      { speaker: "user", text: "Thank you, I accept." },
    ];
    const result = sessionReportToInterviewResult({
      report: aggregateReport,
      session: baseSession({ transcript, negotiationMetrics: kernel({}) }),
    });
    // 6 candidate turns → 6 Per-Question items (not the single aggregate).
    expect(result.questions).toHaveLength(6);
    // Each item pairs the preceding recruiter line as the question text.
    expect(result.questions[0].text).toBe("We can offer ₹40 LPA.");
    expect(result.questions[0].index).toBe(1);
    // Answer carries the real candidate reply.
    expect(result.questions[0].answer.map((s) => s.text).join("")).toContain(
      "targeting ₹48 LPA",
    );
    expect(result.questions[5].answer.map((s) => s.text).join("")).toContain(
      "I accept",
    );
  });

  it("skips interjection/nudge sentinels and never over-claims turn count", () => {
    const transcript = [
      { speaker: "ai", text: "[tracking]" },
      { speaker: "ai", text: "We can offer ₹40 LPA." },
      { speaker: "user", text: "I want ₹48 LPA." },
      { speaker: "user", text: "[skipped]" },
      { speaker: "ai", text: "We can do ₹44 LPA." },
      { speaker: "user", text: "Deal." },
    ];
    const result = sessionReportToInterviewResult({
      report: aggregateReport,
      session: baseSession({ transcript, negotiationMetrics: kernel({}) }),
    });
    // Two real candidate turns (the [skipped] sentinel is dropped).
    expect(result.questions).toHaveLength(2);
    expect(result.questions[1].text).toBe("We can do ₹44 LPA.");
  });

  it("falls back to the aggregate when no transcript is stored (legacy row)", () => {
    const result = sessionReportToInterviewResult({
      report: aggregateReport,
      session: baseSession({ transcript: [], negotiationMetrics: kernel({}) }),
    });
    // No exchanges to recover → keep the single aggregate item, don't invent.
    expect(result.questions).toHaveLength(1);
  });

  /* PRI-96 (2026-07-12, live staging — session 734493c9): the degraded heuristic
   * path stored an aggregate perQuestion score of 0, and the reconstructed
   * per-turn items HARDCODED band "partial", so every row rendered "Partial ·
   * 0/100" — a middling label beside a zero score. The band must never contradict
   * the number it sits next to: derive it from the carried score. */
  const twoTurns = [
    { speaker: "ai", text: "We can offer ₹40 LPA." },
    { speaker: "user", text: "I'm targeting ₹48 LPA." },
    { speaker: "ai", text: "That's a stretch." },
    { speaker: "user", text: "My market data supports it." },
  ];
  const reportWithScore = (score: number) =>
    ({ ...aggregateReport, perQuestion: [{ ...(aggregateReport.perQuestion as unknown[])[0] as object, score }] }) as unknown as SessionReport;

  it("derives a zero-score reconstructed row's band from the score (weak, not partial)", () => {
    const result = sessionReportToInterviewResult({
      report: reportWithScore(0),
      session: baseSession({ transcript: twoTurns, negotiationMetrics: kernel({}) }),
    });
    expect(result.questions).toHaveLength(2);
    // The exact live bug: 0/100 must NOT read as "Partial".
    for (const q of result.questions) {
      expect(q.score).toBe(0);
      expect(q.band).toBe("weak");
    }
  });

  it("band tracks the score band across the reconstructed rows", () => {
    // partial range (40–69) → "partial"; strong range (≥70) → "strong".
    const mid = sessionReportToInterviewResult({
      report: reportWithScore(68),
      session: baseSession({ transcript: twoTurns, negotiationMetrics: kernel({}) }),
    });
    for (const q of mid.questions) expect(q.band).toBe("partial");
    const high = sessionReportToInterviewResult({
      report: reportWithScore(82),
      session: baseSession({ transcript: twoTurns, negotiationMetrics: kernel({}) }),
    });
    for (const q of high.questions) expect(q.band).toBe("strong");
  });
});

describe("REPORT-3b — 'Numbers stated' never contradicts the kernel's anchor", () => {
  const negSession = (over: Partial<DashboardSession>): DashboardSession =>
    ({
      id: "s1",
      type: "salary-negotiation",
      focus: "salary-negotiation",
      role: "Senior Product Designer",
      company: "Acme",
      difficulty: "standard",
      duration: "12 min",
      transcript: [],
      questionScores: [],
      feedback: "",
      ...over,
    } as unknown as DashboardSession);

  /* perQuestion answers that state numbers the unit-anchored `anchorRe` misses
   * (bare counters / degraded answerText) — the exact live "Numbers stated 0%"
   * shape observed on staging beside a report crediting "Asked for ₹45 LPA". */
  const unitlessReport = {
    perQuestion: [
      "I was targeting the mid forties.",
      "Make it 45 and we have a deal.",
      "That works for me.",
      "Add a signing bonus then.",
      "Sounds good.",
      "I accept.",
    ].map((answerText, idx) => ({
      idx,
      question: "q",
      answerText,
      score: 68,
      verdict: "partial",
      starPresence: { S: false, T: false, A: false, R: false },
    })),
    redFlags: [],
    skills: [{ name: "Anchoring", score: 60 }],
    overallScore: 68,
    band: "leanHire",
    wins: [],
    fixes: [],
    blindSpots: [],
    storyReuseFindings: [],
    crossSessionInsights: [],
    thoughtBubble: [],
    scoreConfidence: 0.8,
    coreMetrics: { fillerPerMin: 0, silenceRatio: 0, paceWpm: 150, energy: 70 },
    advancedDelivery: { medianLatencyMs: 0, selfCorrectionRate: 0 },
  } as unknown as SessionReport;

  const numbersStated = (over: Partial<KernelMetrics>) => {
    const result = sessionReportToInterviewResult({
      report: unitlessReport,
      session: negSession({ negotiationMetrics: kernel(over) }),
    });
    return result.metrics.find((m) => m.label === "Numbers stated")!;
  };

  it("credits an anchored candidate even when answerText has no unit-adjacent figure", () => {
    // Kernel recorded the ask (candidateAsk = 45) → the delivery metric must not
    // read "Needs Work" beside the report's own "Asked for ₹45 LPA".
    const m = numbersStated({ candidateAskLpa: 45 });
    expect(m.band).not.toBe("needsWork");
    expect(m.value).toBeGreaterThan(0);
  });

  it("still flags a candidate who never anchored (no kernel ask, no unit figures)", () => {
    // No recorded ask and no unit-adjacent figure → the honest, coherent verdict
    // is a genuine "Needs Work"; the floor must NOT fire here.
    const m = numbersStated({ candidateAskLpa: null });
    expect(m.band).toBe("needsWork");
    expect(m.value).toBe(0);
  });

  /* REPORT-3c (2026-07-11, live staging — session 734493c9): the degraded
   * heuristic path stored an empty perQuestion, so the value ternary returned a
   * hard 0 (bypassing the anchored floor) while the band still flipped to "ok",
   * rendering "Numbers stated 0% · On Target" beside "Asked for ₹50 LPA". The
   * VALUE and BAND must never tell different stories: an anchored candidate
   * reads a non-zero value AND an on-target band even with no answerText. */
  it("value and band agree for an anchored candidate even with no answerText (denom 0)", () => {
    const empty = {
      ...unitlessReport,
      perQuestion: [],
    } as unknown as SessionReport;
    const result = sessionReportToInterviewResult({
      report: empty,
      session: negSession({ negotiationMetrics: kernel({ candidateAskLpa: 50 }) }),
    });
    const m = result.metrics.find((x) => x.label === "Numbers stated")!;
    // The exact live bug: value 0 (needsWork range) beside an "ok"/On-Target band.
    expect(m.band).not.toBe("needsWork");
    // If the band says On Target, the value must sit in that band's range too.
    expect(m.value).toBeGreaterThanOrEqual(25);
  });
});
