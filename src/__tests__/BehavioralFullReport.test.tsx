/* Render tests for BehavioralFullReport.
   One happy-path render + one test per edge state. The component is
   pure presentation — we feed it a minimal BehavioralFullReportData
   object and assert visible copy / structure, not implementation. */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BehavioralFullReport from "../sessionReport/BehavioralFullReport";
import type { BehavioralFullReportData } from "../sessionReport/types";

function makeData(overrides: Partial<BehavioralFullReportData> = {}): BehavioralFullReportData {
  const base: BehavioralFullReportData = {
    score: 72,
    scoreDelta: 8,
    verdict: "Owns failures, names competencies, narrates conflicts one-sided.",
    percentile: 62,
    track: "Indian Product",
    persona: {
      voice: "Hiring Manager",
      tier: "Razorpay-tier fintech",
      role: "Senior PM",
      lpaBand: "₹38 LPA",
    },
    sessionMeta: { number: 4, dateISO: "2026-06-02", durationMin: 28, substantiveAnswers: 6 },
    oneHabit: {
      headline: "Name the counterparty's view first.",
      rationale: "Bar-Raiser expects that frame inside the first 15 seconds.",
      prebiasDimension: "conflict counterparty-POV",
    },
    starBreakdown: [
      { questionId: "Q1", topic: "Failure", s: true, t: true, a: true, r: false },
      { questionId: "Q2", topic: "Conflict 1", s: true, t: false, a: true, r: false },
      { questionId: "Q3", topic: "Influence", s: true, t: true, a: true, r: true },
      { questionId: "Q4", topic: "NPS recovery", s: true, t: true, a: true, r: false },
    ],
    failure: {
      ownership: true,
      ownershipNote: "Named the call as yours.",
      concreteMiss: false,
      concreteMissNote: "Stayed at 'an edge case'.",
      learning: true,
      learningNote: "Drew a forward principle.",
      coachQuote: "Try: I underestimated the rollback path.",
      statusLabel: "Owns, not specific",
      statusTone: "gap",
    },
    conflict: {
      asked: 2,
      oneSided: 2,
      balanced: 0,
      coachLine: "Name what they wanted before what you did.",
      jumpToQuestionIds: ["Q2", "Q5"],
      statusLabel: "One-sided 2/2",
      statusTone: "gap",
    },
    delivery: {
      rehearsedHits: 0,
      hedgedHits: 2,
      ramblingHits: 1,
      segments: [
        { questionId: "Q1", tone: "crisp" },
        { questionId: "Q2", tone: "hedged" },
        { questionId: "Q3", tone: "crisp" },
        { questionId: "Q4", tone: "ramble" },
      ],
      coachLine: "Crisp early, loose late.",
      statusLabel: "Stamina gap",
      statusTone: "gap",
    },
    radar: {
      axes: ["Ownership", "Customer obsession", "Stakeholder mgmt", "Data fluency"],
      you: [8, 7, 5, 6],
      prev: [7, 6, 5, 5],
      track: "Indian Product",
      summary: "Top demonstrated: Ownership, Customer obsession.",
      ups: ["Ownership", "Customer obsession"],
      downs: ["Conflict navigation"],
      statusLabel: "Strong signals",
      statusTone: "ok",
    },
    evidence: {
      metricClaims: 3,
      evidenced: 1,
      floating: 2,
      unevidencedQuotes: ["We moved the needle on activation."],
      fixTechnique: "Anchor before percent.",
      statusLabel: "2 floating claims",
      statusTone: "gap",
    },
    aiAccountability: { depthProbes: 3, vagueAccepted: 1, ownershipProbes: 2, deflected: 0 },
    transcript: [
      { questionId: "Q1", topic: "Failure", pills: [{ label: "✓ ownership", tone: "ok" }] },
    ],
    ctaPrimaryLabel: "Start next session",
    ctaSubcopy: "Next session biased toward conflict counterparty-POV.",
    isFirstSession: false,
  };
  return { ...base, ...overrides };
}

describe("BehavioralFullReport", () => {
  it("happy path: renders persona, hero, STAR matrix, all 3 diagnostic cards, transcript, CTA", () => {
    render(<BehavioralFullReport data={makeData()} />);
    expect(screen.getAllByText(/Hiring Manager/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Razorpay-tier fintech/)).toBeInTheDocument();
    expect(screen.getByText("BEHAVIORAL VERDICT")).toBeInTheDocument();
    expect(screen.getByText(/Owns failures/)).toBeInTheDocument();
    expect(screen.getByText("ONE HABIT TO FIX")).toBeInTheDocument();
    expect(screen.getByText(/Name the counterparty/)).toBeInTheDocument();
    expect(screen.getByText("STAR completeness across the round")).toBeInTheDocument();
    expect(screen.getByText("Failure story")).toBeInTheDocument();
    expect(screen.getByText("Conflict narration")).toBeInTheDocument();
    expect(screen.getByText("Delivery rhythm")).toBeInTheDocument();
    expect(screen.getByText(/Competency strength/)).toBeInTheDocument();
    expect(screen.getByText("Evidence quality")).toBeInTheDocument();
    expect(screen.getByText("How hard the AI pushed you")).toBeInTheDocument();
    expect(screen.getByText("Transcript replay")).toBeInTheDocument();
    expect(screen.getByText("Start next session")).toBeInTheDocument();
    expect(screen.getByText(/▲ 8 vs last session/)).toBeInTheDocument();
  });

  it("edge: score < 40 → renders softened CTA copy", () => {
    render(
      <BehavioralFullReport
        data={makeData({
          score: 32,
          ctaPrimaryLabel: "Reset with a focused drill",
          ctaSubcopy: "This round didn't land — start small.",
        })}
      />,
    );
    expect(screen.getByText("Reset with a focused drill")).toBeInTheDocument();
    expect(screen.getByText(/didn't land/)).toBeInTheDocument();
  });

  it("edge: score > 85 → renders successfully and verdict still names a gap", () => {
    render(
      <BehavioralFullReport
        data={makeData({
          score: 92,
          verdict: "Strong owner; still narrates conflicts one-sided.",
        })}
      />,
    );
    expect(screen.getByText(/Strong owner; still narrates conflicts one-sided/)).toBeInTheDocument();
  });

  it("edge: no failure question asked → Failure card is hidden", () => {
    render(<BehavioralFullReport data={makeData({ failure: null })} />);
    expect(screen.queryByText("Failure story")).not.toBeInTheDocument();
    // Other cards still render
    expect(screen.getByText("Conflict narration")).toBeInTheDocument();
  });

  it("edge: no conflict question asked → Conflict card is hidden", () => {
    render(<BehavioralFullReport data={makeData({ conflict: null })} />);
    expect(screen.queryByText("Conflict narration")).not.toBeInTheDocument();
    expect(screen.getByText("Failure story")).toBeInTheDocument();
  });

  it("edge: < 3 substantive answers → STAR matrix collapses to a one-line note", () => {
    render(
      <BehavioralFullReport
        data={makeData({
          starBreakdown: [],
          sessionMeta: { number: 1, dateISO: "2026-06-02", durationMin: 8, substantiveAnswers: 2 },
        })}
      />,
    );
    expect(
      screen.getByText(/STAR matrix needs at least 3 substantive answers/),
    ).toBeInTheDocument();
    expect(screen.queryByText("STAR completeness across the round")).not.toBeInTheDocument();
  });

  it("edge: first-ever session → no delta chip rendered", () => {
    render(
      <BehavioralFullReport
        data={makeData({
          isFirstSession: true,
          scoreDelta: null,
          radar: { ...makeData().radar, prev: null },
        })}
      />,
    );
    expect(screen.queryByText(/vs last session/)).not.toBeInTheDocument();
    expect(screen.queryByText(/prior baseline/)).not.toBeInTheDocument();
  });
});
