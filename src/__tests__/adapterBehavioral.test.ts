/* Tests for toBehavioralFullReportData adapter.
   Locks in the edge-state behavior the BehavioralFullReport component
   relies on:
     - happy path with full meta produces all cards
     - no failure Q → failure card is null
     - no conflict Q → conflict card is null
     - < 3 substantive answers → starBreakdown collapses to []
     - first-ever session → scoreDelta null + radar.prev null
     - low score (<40) → soft CTA copy

   Fixtures are minimal — only the fields the adapter actually reads.
   We construct `SessionReport` + `DashboardSession` partials and cast
   at the function boundary because the adapter only touches a small
   surface area of each (overallScore / band / verdict / calibration /
   perQuestion / company / role / date / duration). */

import { describe, it, expect } from "vitest";
import {
  toBehavioralFullReportData,
  type BehavioralFullReportContext,
} from "../sessionReport/adapter";
import type { SessionReport } from "../dashboardData";
import type { DashboardSession } from "../dashboardTypes";
import type { AnalyzerMeta } from "../../server-handlers/analyzers/_types";

type BehavioralMeta = NonNullable<AnalyzerMeta["behavioral"]>;

function makeReport(overrides: Partial<SessionReport> = {}): SessionReport {
  const base: SessionReport = {
    version: "mvp-6",
    overallScore: 72,
    scoreConfidence: 0.8,
    band: "hire",
    verdict: "Owns failures, names competencies, narrates conflicts one-sided.",
    wins: [],
    fixes: [],
    redFlags: [],
    coreMetrics: { fillerPerMin: 2, silenceRatio: 0.1, paceWpm: 160, energy: 70 },
    advancedDelivery: {
      hedgingPerMin: 1,
      lexicalDiversity: 0.7,
      firstPersonRatio: 0.5,
      medianLatencyMs: 1500,
      selfCorrectionRate: 0.5,
    },
    skills: [],
    perQuestion: [
      { idx: 0, question: "Tell me about a failure", answerText: "x", score: 60, verdict: "partial", explanation: "", starPresence: { S: true, T: true, A: true, R: false } },
      { idx: 1, question: "A time you disagreed with engineering", answerText: "x", score: 60, verdict: "partial", explanation: "", starPresence: { S: true, T: false, A: true, R: false } },
      { idx: 2, question: "How do you align two PMs", answerText: "x", score: 70, verdict: "strong", explanation: "", starPresence: { S: true, T: true, A: true, R: true } },
      { idx: 3, question: "Low NPS recovery", answerText: "x", score: 75, verdict: "strong", explanation: "", starPresence: { S: true, T: true, A: true, R: false } },
    ] as unknown as SessionReport["perQuestion"],
    thoughtBubble: [],
    calibration: {
      companyLabel: "Indian Product",
      note: "",
      bands: { strongHire: 85, hire: 70, leanHire: 55, noHire: 40 },
    },
    crossSessionInsights: [],
    priorSessionCount: 3,
    storyReuseFindings: [],
    blindSpots: [],
    readiness: null,
    reverseInterview: null,
    model: "test",
  };
  return { ...base, ...overrides };
}

function makeSession(overrides: Partial<DashboardSession> = {}): DashboardSession {
  return {
    id: "s1",
    date: "2026-06-02",
    dateLabel: "Today",
    type: "behavioral",
    role: "Senior PM",
    score: 72,
    change: 5,
    duration: "28 min",
    difficulty: "standard",
    company: "Razorpay",
    focus: "general",
    topStrength: "Ownership",
    topWeakness: "Conflict",
    feedback: "",
    transcript: [],
    questionScores: [],
    ...overrides,
  };
}

function makeMeta(overrides: Partial<BehavioralMeta> = {}): BehavioralMeta {
  const base: BehavioralMeta = {
    starBreakdown: [
      { turn_idx: 1, present: ["S", "T", "A"], missing: ["R"], text_preview: "I owned the call", quantified: false, competencies: ["Ownership"] },
      { turn_idx: 3, present: ["S", "A"], missing: ["T", "R"], text_preview: "We worked together", quantified: false, competencies: [] },
      { turn_idx: 5, present: ["S", "T", "A", "R"], missing: [], text_preview: "Reduced churn 18%", quantified: true, competencies: ["Customer obsession"] },
      { turn_idx: 7, present: ["S", "T", "A"], missing: ["R"], text_preview: "Aligned both teams", quantified: false, competencies: ["Stakeholder mgmt"] },
    ],
    competencyCounts: {
      Ownership: 3,
      "Customer obsession": 2,
      "Stakeholder mgmt": 2,
      "Data fluency": 1,
    },
    topCompetencies: ["Ownership", "Customer obsession", "Stakeholder mgmt"],
    probing: {
      aiProbedDepth: 3,
      aiProbedOwnership: 2,
      aiAcceptedVague: 1,
      learningReflections: 2,
      failureQuestionAsked: true,
      failureResponse: "owns",
      failureResponseHadConcreteMiss: false,
    },
    evidence: {
      metricAnswersCount: 3,
      metricAnswersUnevidenced: 2,
      aiAcceptedUnevidencedMetric: 1,
    },
    delivery: {
      rehearsedOpenerHits: 0,
      lowConvictionHits: 1,
      ramblingHits: 0,
    },
    conflict: {
      conflictQuestionsAsked: 2,
      oneSidedConflictHits: 2,
    },
  };
  return { ...base, ...overrides };
}

function makeCtx(overrides: Partial<BehavioralFullReportContext> = {}): BehavioralFullReportContext {
  return {
    report: makeReport(),
    session: makeSession(),
    recentScores: [64, 72],
    percentile: 62,
    sessionNumber: 4,
    flags: ["one_sided_conflict_narrative"],
    ...overrides,
  };
}

describe("toBehavioralFullReportData", () => {
  it("happy path: produces hero, STAR, failure, conflict, delivery, radar, evidence, transcript", () => {
    const data = toBehavioralFullReportData(makeCtx(), makeMeta());
    expect(data.score).toBe(72);
    expect(data.scoreDelta).toBe(8);
    expect(data.isFirstSession).toBe(false);
    expect(data.starBreakdown.length).toBe(4);
    expect(data.failure).not.toBeNull();
    expect(data.failure?.ownership).toBe(true);
    expect(data.failure?.concreteMiss).toBe(false);
    expect(data.conflict).not.toBeNull();
    expect(data.conflict?.asked).toBe(2);
    expect(data.conflict?.oneSided).toBe(2);
    expect(data.delivery.segments.length).toBe(4);
    expect(data.radar.axes.length).toBeGreaterThan(0);
    expect(data.radar.prev).not.toBeNull();
    expect(data.evidence.floating).toBe(2);
    expect(data.evidence.evidenced).toBe(1);
    expect(data.aiAccountability.depthProbes).toBe(3);
    expect(data.transcript.length).toBe(4);
    expect(data.oneHabit.headline).toMatch(/counterparty/i);
    expect(data.ctaPrimaryLabel).toBe("Start next session");
  });

  it("edge: no failure question asked → failure card is null", () => {
    const meta = makeMeta({
      probing: {
        aiProbedDepth: 0,
        aiProbedOwnership: 0,
        aiAcceptedVague: 0,
        learningReflections: 0,
        failureQuestionAsked: false,
        failureResponse: null,
        failureResponseHadConcreteMiss: null,
      },
    });
    const data = toBehavioralFullReportData(makeCtx(), meta);
    expect(data.failure).toBeNull();
  });

  it("edge: no conflict question asked → conflict card is null", () => {
    const meta = makeMeta({
      conflict: { conflictQuestionsAsked: 0, oneSidedConflictHits: 0 },
    });
    const data = toBehavioralFullReportData(makeCtx(), meta);
    expect(data.conflict).toBeNull();
  });

  it("edge: < 3 substantive answers → starBreakdown collapses to []", () => {
    const meta = makeMeta({
      starBreakdown: [
        { turn_idx: 1, present: ["S", "A"], missing: ["T", "R"], text_preview: "x", quantified: false, competencies: [] },
        { turn_idx: 3, present: ["S", "T"], missing: ["A", "R"], text_preview: "y", quantified: false, competencies: [] },
      ],
    });
    const data = toBehavioralFullReportData(makeCtx(), meta);
    expect(data.starBreakdown).toEqual([]);
    expect(data.sessionMeta.substantiveAnswers).toBe(2);
  });

  it("edge: first-ever session → scoreDelta null + radar.prev null", () => {
    const data = toBehavioralFullReportData(
      makeCtx({ recentScores: [72] }),
      makeMeta(),
    );
    expect(data.isFirstSession).toBe(true);
    expect(data.scoreDelta).toBeNull();
    expect(data.radar.prev).toBeNull();
  });

  it("edge: score < 40 → soft CTA copy", () => {
    const data = toBehavioralFullReportData(
      makeCtx({ report: makeReport({ overallScore: 32 }) }),
      makeMeta(),
    );
    expect(data.score).toBe(32);
    expect(data.ctaPrimaryLabel).toMatch(/reset/i);
    expect(data.ctaSubcopy).toMatch(/drill/i);
  });

  it("edge: score > 85 → standard CTA but verdict carries through", () => {
    const data = toBehavioralFullReportData(
      makeCtx({
        report: makeReport({
          overallScore: 90,
          verdict: "Strong owner; still narrates conflicts one-sided.",
        }),
      }),
      makeMeta(),
    );
    expect(data.score).toBe(90);
    expect(data.verdict).toMatch(/one-sided/);
    expect(data.ctaPrimaryLabel).toBe("Start next session");
    expect(data.ctaSubcopy).toMatch(/biases toward/i);
  });

  it("null behavioralMeta → renders safely with zeroes + null cards", () => {
    const data = toBehavioralFullReportData(makeCtx(), null);
    expect(data.failure).toBeNull();
    expect(data.conflict).toBeNull();
    expect(data.starBreakdown).toEqual([]);
    expect(data.evidence.metricClaims).toBe(0);
    expect(data.aiAccountability.depthProbes).toBe(0);
  });
});
