/* Render tests for HrFullReport — the dedicated HR-round results surface.
   The component is pure presentation: feed it the shape evaluate-session
   emits for an hr-round session and assert the visible copy / structure
   a real candidate sees at the end of an HR round. This is the
   deterministic proof of the render contract; the full authed route is
   guarded separately in tests/e2e/hr-round-authed.spec.ts.

   Mirrors BehavioralFullReport.test.tsx — one happy path + one test per
   edge state (missing logistics, empty dimensions, one-sided motivation,
   un-probed counter-offer, admitted BGV gaps). */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HrFullReport from "../sessionReport/HrFullReport";
import type { HrReportData, Question, Skill } from "../sessionReport/types";

const SKILLS: Skill[] = [
  { name: "Logistics clarity", score: 85 },
  { name: "Comp transparency", score: 70 },
  { name: "Switch-rationale honesty", score: 75 },
  { name: "Compliance readiness", score: 90 },
  { name: "Commitment signal", score: 80 },
  { name: "Benefits/policy literacy", score: 55 },
  { name: "Self-awareness", score: 65 },
  { name: "Motivation specificity", score: 90 },
];

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    index: 0,
    text: "Why Infosys specifically, and not a competitor?",
    score: 90,
    band: "strong",
    answer: [{ text: "I've followed the Topaz rollout and want to bring my design-system experience." }],
    star: { situation: true, task: true, action: true, result: true, learning: false },
    metrics: { wordCount: 42, responseSec: 30, firstPersonRatioPct: 60, quantificationCount: 1 },
    whyScored: "Named a concrete initiative rather than generic praise.",
    likelyFollowUp: "What specifically about Topaz maps to your experience?",
    ...overrides,
  };
}

const HR_REPORT: HrReportData = {
  motivationBefore:
    "I want to join Infosys because it's a reputable company with a good culture and growth.",
  motivationAfter:
    "I want to join Infosys to work on its AI-first delivery push — I've followed the Topaz rollout and want to bring my design-system experience to enterprise-scale programs.",
  noticeDays: 60,
  noticeFlexibility: "buyout-possible",
  compExpected: null,
  counterOfferRisk: "low",
  bgvGaps: [],
  companyNorms: {
    sector: "services-tier1",
    sectorLabel: "Tier-1 IT services",
    noticeNorm: "60–90 days",
    buyoutNote: "Buyouts are possible for critical roles — ask.",
    bgvDocs: ["3 months' payslips", "Form 16", "relieving letters", "PAN + Aadhaar", "UAN / PF passbook"],
    bgvFirms: ["AuthBridge", "First Advantage", "OnGrid"],
    compNote: "Bands are structured by level — negotiate the level, not just the number.",
    dualEmploymentNote: "Your UAN reveals concurrent PF — disclose any overlap up front.",
  },
};

function renderReport(props: Partial<React.ComponentProps<typeof HrFullReport>> = {}) {
  return render(
    <HrFullReport
      overallScore={78}
      skills={SKILLS}
      wins={[
        "Company-specific motivation grounded in real initiatives.",
        "Proactive notice handling with a buyout option.",
      ]}
      questions={[makeQuestion()]}
      hrReport={HR_REPORT}
      // `role` is HrFullReport's own prop (the job title), not the ARIA role attr.
      // eslint-disable-next-line jsx-a11y/aria-role
      role="Senior Product Designer"
      company="Infosys"
      {...props}
    />,
  );
}

describe("HrFullReport", () => {
  it("happy path: renders hero, all 4 sections, dimension gate, logistics, motivation rewrite, drill CTA", () => {
    renderReport();

    // Hero reconcile bridge — overall score + band.
    expect(screen.getByText("78")).toBeInTheDocument();
    // 0 dims below 60 given SKILLS (min is 55 → 1 failing). Band = Lean Hire.
    expect(screen.getByText(/Lean Hire/)).toBeInTheDocument();

    // Section 01 — Diagnose.
    expect(screen.getByText("Where you stand right now")).toBeInTheDocument();
    expect(screen.getByText("How HR scored you")).toBeInTheDocument();
    expect(screen.getByText(/8-DIMENSION GATE/)).toBeInTheDocument();
    expect(screen.getByText("Logistics clarity")).toBeInTheDocument();
    // Weakest dimension flagged (Benefits/policy literacy @ 55).
    expect(screen.getByText("Weakest")).toBeInTheDocument();

    // Wins panel.
    expect(screen.getByText("What HR will remember positively")).toBeInTheDocument();

    // Probe review.
    expect(screen.getByText("How each probe landed")).toBeInTheDocument();
    expect(screen.getByText(/Why Infosys specifically/)).toBeInTheDocument();

    // Section 02 — Act.
    expect(screen.getByText("The 3 things HR is waiting on")).toBeInTheDocument();
    expect(screen.getByText("What you said about notice and salary")).toBeInTheDocument();
    expect(screen.getByText("60d")).toBeInTheDocument();
    expect(screen.getByText("Can buy out")).toBeInTheDocument();
    // Sector norm strip grounded in the company norms (renders in both the
    // notice and BGV panels).
    expect(screen.getAllByText(/Tier-1 IT services · sector norm/).length).toBeGreaterThan(0);
    // BGV clean state + counter-offer clean state.
    expect(screen.getByText("Background verification gaps")).toBeInTheDocument();
    expect(screen.getByText(/Counter-offer commitment: clear/)).toBeInTheDocument();

    // Section 03 — Motivation rewrite (both cards).
    expect(screen.getByText("Your 'why this company' — rewritten")).toBeInTheDocument();
    expect(screen.getByText("What you said")).toBeInTheDocument();
    expect(screen.getByText("What HR wants to hear")).toBeInTheDocument();

    // Section 04 — Drill CTA.
    expect(screen.getByText(/Re-drill the/)).toBeInTheDocument();
    expect(screen.getByText("Start drill plan →")).toBeInTheDocument();
  });

  it("edge: no hrReport → logistics section shows an honest empty state, no crash", () => {
    renderReport({ hrReport: undefined });
    expect(screen.getByText("The 3 things HR is waiting on")).toBeInTheDocument();
    expect(screen.getByText(/Logistics data \(notice period, comp, BGV\)/)).toBeInTheDocument();
    // Motivation section is fully suppressed when there's no hrReport.
    expect(screen.queryByText("Your 'why this company' — rewritten")).not.toBeInTheDocument();
  });

  it("edge: empty skills → dimension gate + drill CTA suppressed, hero shows role/company", () => {
    renderReport({ skills: [] });
    expect(screen.getByText(/Dimension scores not available/)).toBeInTheDocument();
    // With no dims, the hero falls back to the role/company line.
    expect(screen.getByText(/HR Round for Senior Product Designer at Infosys/)).toBeInTheDocument();
    // Section 04 drill plan is gated on skills.length > 0.
    expect(screen.queryByText("Start drill plan →")).not.toBeInTheDocument();
  });

  it("edge: motivationAfter only → single full-width card, no 'what you said' column", () => {
    renderReport({
      hrReport: { ...HR_REPORT, motivationBefore: "" },
    });
    expect(screen.getByText("What HR wants to hear")).toBeInTheDocument();
    expect(screen.queryByText("What you said")).not.toBeInTheDocument();
  });

  it("edge: counterOfferRisk 'not-assessed' → un-probed framing, prep-ahead script", () => {
    renderReport({
      hrReport: { ...HR_REPORT, counterOfferRisk: "not-assessed" },
    });
    expect(screen.getByText(/Counter-offer commitment: not probed this round/)).toBeInTheDocument();
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
  });

  it("edge: admitted BGV gaps → gaps listed with count, no clean empty state", () => {
    renderReport({
      hrReport: {
        ...HR_REPORT,
        bgvGaps: ["Missing Form 16 for FY23", "No relieving letter from second employer"],
      },
    });
    expect(screen.getByText("Document gaps you admitted")).toBeInTheDocument();
    expect(screen.getByText("2 gaps")).toBeInTheDocument();
    expect(screen.getByText("Missing Form 16 for FY23")).toBeInTheDocument();
    expect(screen.queryByText(/No BGV gaps were mentioned/)).not.toBeInTheDocument();
  });
});
