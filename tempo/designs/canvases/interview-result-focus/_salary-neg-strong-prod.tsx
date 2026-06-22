/* HireStepX — Production salary-negotiation session report canvas harness
 *
 * Mirrors the production /session/[id] page for a salary-negotiation session:
 *   1. HeroSection   — score gauge (84), readiness, AI verdict, strengths
 *   2. NegotiationFullReport — 4-part negotiation-specific panels
 *
 * Follows the same pattern as HRWeakDemo (renders production components
 * directly, not through SessionReportView which has "use client"). Injects
 * SESSION_REPORT_STYLES manually since CanvasProviders doesn't provide them.
 *
 * Scenario: PhonePe Senior EM · opened ₹38L → countered ₹52L → landed ₹48L
 * Score 84 · strong (top quartile for Senior EM at Indian fintechs). */

import React from "react";
import { SESSION_REPORT_STYLES } from "../../../../src/sessionReport/styles";
import { NegotiationFullReport } from "../../../../src/sessionReport/NegotiationFullReport";
import { HeroSection } from "../../../../src/sessionReport/panels/sr-HeroSection";
import { t, f } from "../../../../src/sessionReport/tokens";
import type { InterviewResultData, Skill, DeliveryMetric, Question } from "../../../../src/sessionReport/types";
import type { NegotiationOutcome } from "../../../../src/sessionReport/derivations";

/* ─── Negotiation outcome ────────────────────────────────────── */

const OUTCOME: NegotiationOutcome = {
  offers: [
    {
      turn: 1,
      total: 38,
      question:
        "Our offer is ₹38 LPA fixed plus 12% variable. We think that's competitive for your level. What's your reaction?",
    },
    {
      turn: 2,
      total: 45,
      question:
        "We can accommodate up to ₹45L base — that is our ceiling for this level. Where do we go from here?",
    },
    {
      turn: 3,
      total: 48,
      question:
        "We can do ₹48L base + ₹4L signing + 40K ESOPs on a 4-year vest with year-2 refresh + 3 WFH days/week. Does that close it for you?",
    },
  ],
  finalTotal: 48,
  outcome: "accepted",
  candidateAsk: 52,
  gapClosurePct: 71,
  pushbacks: [
    {
      pushback: "We think ₹38L is competitive for your level.",
      outcome: "held",
      detail:
        "Held silence 3.4s. Re-anchored at ₹52L with market data + a competing Razorpay conversation — gave the recruiter a concrete counter-justification to work against.",
    },
    {
      pushback: "We can't go above ₹45L base — that's our ceiling.",
      outcome: "deflected",
      detail:
        "Pivoted to lever exploration instead of conceding base. Opened ESOPs, signing bonus, WFH days, and notice buy-out as alternative surfaces.",
    },
    {
      pushback: "What's your current CTC?",
      outcome: "deflected",
      detail:
        "Reframed cleanly: 'I'm anchoring against my BATNA at ₹52L, not my current package.' No CTC disclosed.",
    },
  ],
  anchorBracket: {
    type: "range_with_justification",
    quote:
      "I was thinking ₹52L base + 15% variable — based on the cohort I'm seeing for Senior EM at fintechs this quarter, and where I am in conversations with Razorpay.",
    verdict:
      "Range with justification is the strongest anchor type. The number is specific (₹52L), the bracket is defended with market data + a competing offer, and the BATNA is implicit but real. Recruiters can't pull this anchor down without producing a counter-justification.",
  },
  verbalHabits: [
    {
      phrase: "Based on",
      count: 4,
      cost: "Productive — anchors every claim in evidence",
      timestamps: ["01:32", "02:08", "04:14", "06:22"],
    },
    {
      phrase: "Help me make this work",
      count: 2,
      cost: "Productive — collaborative framing, signals intent without conceding",
      timestamps: ["03:45", "08:12"],
    },
    {
      phrase: "I'd be open to",
      count: 1,
      cost: "Mild concession signal — used once but caught and immediately reframed",
      timestamps: ["05:08"],
    },
  ],
  disclosureLeaks: [],
  silenceMoments: [
    {
      at: "01:38",
      duration: "4.2s",
      context: "After counter-anchor landed — let the number settle before justifying. Healthy.",
      healthy: true,
    },
    {
      at: "03:22",
      duration: "3.4s",
      context: "After 'we can't go above ₹45L' — held the pause instead of conceding. Healthy.",
      healthy: true,
    },
    {
      at: "06:08",
      duration: "2.8s",
      context: "After ESOP grant counter — gave the recruiter room to respond. Healthy.",
      healthy: true,
    },
  ],
  unaskedLevers: [
    {
      question: "Acceleration clause if the company gets acquired?",
      whyItMatters:
        "Prevents ESOP forfeiture in M&A. Not standard at PhonePe yet. Costs them nothing to grant — worth asking once before signing.",
    },
    {
      question: "Joining bonus to offset unvested ESOPs at your current employer?",
      whyItMatters:
        "You're leaving unvested ESOPs on the table — joining bonus is the standard offset at this level. Typical range ₹2–5L for Senior EM external hires.",
    },
    {
      question: "Hardware + home-office stipend?",
      whyItMatters:
        "Standard at this band (₹1.5–3L one-time). Cheap for the company, real value to you over a 4-year tenure.",
    },
  ],
  counterpartyFacts: [
    {
      fact: "PhonePe pays Senior EMs ₹46–58L base. Stock options vest on a 4-year schedule with a 1-year cliff.",
      tone: "neutral",
    },
    {
      fact: "You landed at ₹48L base — top end of the external-hire range for this level this cycle.",
      tone: "good",
    },
    {
      fact: "You secured 3 WFH days/week — one more than their default offer for this level.",
      tone: "good",
    },
    {
      fact: "Year-2 ESOP refresh was confirmed on the call. Get it in the formal offer letter before signing.",
      tone: "neutral",
    },
    {
      fact: "M&A acceleration clause isn't on paper yet. Ask before signing — it costs them nothing.",
      tone: "neutral",
    },
  ],
  counterpartySource: "Glassdoor + Levels.fyi + 18 user reports (last 90 days)",
  archetype: {
    title: "The Lever-Pull Closer",
    body:
      "Across your 3 salary negotiation sessions, anchoring score has climbed from 25 → 65 → 90 — the most-improved axis in your prep. You now anchor with a defended range, hold silence post-counter, and pivot to lever exploration when base is capped. The remaining gap is closing discipline: you reach phase 5 but stall before the final recap + lock.",
    fix: "Run 2 closing-rep drills — practising the 'recap + lock + close' move that converts an open negotiation into a signed offer. The plan below sequences this.",
    arc: [
      { label: "S1", score: 25, highlight: "accepted first offer" },
      { label: "S2", score: 65 },
      { label: "S3", score: 90, highlight: "this session" },
    ],
    arcMetric: "Anchoring discipline",
  },
  drills: [
    {
      slug: "closing-rep",
      title: "Closing rep — recap + lock",
      goal: "Practice the 3-line close: recap agreed terms, name the 1–2 items still open, set a deadline. Aim for under 90 seconds.",
      effort: "20 min × 2",
    },
    {
      slug: "acceleration-ask",
      title: "Acceleration clause ask",
      goal: "Rehearse the 1-line ask for M&A acceleration. Frame it as 'standard at peer companies' to give the recruiter cover.",
      effort: "10 min × 1",
    },
    {
      slug: "joining-probe",
      title: "Joining-bonus probe",
      goal: "Add the joining-bonus question to your phase-5 lever sweep. Practice the 'unvested ESOP offset' framing 3 times.",
      effort: "10 min × 1",
    },
  ],
};

/* ─── Questions ──────────────────────────────────────────────── */

const QUESTIONS: Question[] = [
  {
    index: 1,
    text: "Our offer is ₹38 LPA fixed plus 12% variable. We think that's competitive for your level. What's your reaction?",
    score: 86,
    band: "strong",
    answer: [{ text: "Thank you for the offer. Based on my market research and where I am in conversations elsewhere, I was thinking ₹52L base + 15% variable — based on the cohort I'm seeing for Senior EM at fintechs this quarter, and where I am in conversations with Razorpay. Help me understand how PhonePe thinks about that, and what levers we have if base is fixed." }],
    star: { situation: false, task: false, action: false, result: false, learning: false },
    metrics: { wordCount: 295, responseSec: 165, firstPersonRatioPct: 52, quantificationCount: 6 },
    focusMetrics: [
      { label: "Anchor delta", value: "+37%", tone: "good" },
      { label: "Concessions", value: "0 / 3 pushes", tone: "good" },
      { label: "Silence held", value: "4.2s", tone: "good" },
      { label: "Disclosure leaks", value: "0", tone: "good" },
    ],
    whyScored:
      "Textbook anchor: countered immediately with ₹52L + 15% variable, citing market data. Named a competing Razorpay offer. Opened the package conversation with 5 levers in two minutes. No CTC disclosed.",
    likelyFollowUp: "If we landed at ₹48L base, what would close the gap on the rest?",
  },
  {
    index: 2,
    text: "We can't go above ₹45L base. That's our ceiling for this level. Where do we go from here?",
    score: 82,
    band: "strong",
    answer: [{ text: "I appreciate the directness. If base is fixed at ₹45L, let's open up the other levers — what's the ESOP grant range for this level, what's the typical signing for an external hire, and is the variable a cap or a target with upside potential?" }],
    star: { situation: false, task: false, action: false, result: false, learning: false },
    metrics: { wordCount: 245, responseSec: 188, firstPersonRatioPct: 48, quantificationCount: 4 },
    focusMetrics: [
      { label: "Levers opened", value: "4", tone: "good" },
      { label: "Concessions", value: "0 / 1 push", tone: "good" },
      { label: "Silence held", value: "3.4s", tone: "good" },
      { label: "Phases reached", value: "5 / 5", tone: "good" },
    ],
    whyScored:
      "Held composure when budget got capped. Pivoted to lever exploration instead of conceding. Stayed collaborative — advanced into the benefits + closing phase in one move.",
    likelyFollowUp: "ESOP grant for this level is 40,000 units over 4 years. How do you think about that?",
  },
  {
    index: 3,
    text: "ESOP grant for this level is 40,000 units over 4 years with a 1-year cliff. Does that work for you?",
    score: 84,
    band: "strong",
    answer: [{ text: "40K units over 4 years works as a starting point. Two follow-on questions before I can commit: what's the refresh policy at year 2, and is there an acceleration clause in the event of an acquisition? Both are standard at peer fintechs and I want to understand the full picture." }],
    star: { situation: false, task: false, action: false, result: false, learning: false },
    metrics: { wordCount: 185, responseSec: 142, firstPersonRatioPct: 55, quantificationCount: 2 },
    focusMetrics: [
      { label: "Levers opened", value: "2", tone: "good" },
      { label: "Concessions", value: "0 / 1 push", tone: "good" },
      { label: "Silence held", value: "2.8s", tone: "good" },
      { label: "Closing signal", value: "Yes", tone: "good" },
    ],
    whyScored:
      "Accepted the ESOP grant while threading two remaining open points. Stayed collaborative and gave the recruiter a clear path to close.",
    likelyFollowUp:
      "Year-2 refresh is typically 10K units. M&A acceleration isn't standard at our level — we can follow up with HR to confirm.",
  },
];

/* ─── Full InterviewResultData (drives HeroSection) ─────────── */

const HERO_DATA: InterviewResultData = {
  overallScore: 84,
  verdict: "hire",
  scoreDelta: 12,
  percentile: 88,
  recentScores: [62, 72, 84],
  readiness: { pct: 88, etaWeeks: 1 },
  daysUntilInterview: 4,
  company: "PhonePe",
  role: "Senior Engineering Manager",
  level: "Senior EM",
  difficulty: "Standard",
  aiVerdict:
    "Counter-anchored at ₹52L (+37% over their ₹38L opening), held silence 4.2s after the counter landed, conceded zero ground across 3 pushbacks, and surfaced five levers. Landed at ₹48L base — top end of PhonePe's external-hire range this cycle.",
  strengths: [
    "Counter-anchored immediately with ₹52L + market-data justification",
    "Named a competing Razorpay offer — real, verifiable leverage",
    "Decomposed the package into 5 levers when base hit ceiling",
    "Held silence after every counter; never broke first",
  ],
  improvements: [
    "Could have asked about the ESOP strike price (not just the unit count)",
    "Acceleration clause + joining bonus left on the table",
  ],
  metrics: [
    { label: "Anchor delta",       value: 37,  unit: "%",    targetLabel: "Target ≥25%", band: "good"     },
    { label: "Gap closure",        value: 71,  unit: "%",    targetLabel: "Target ≥50%", band: "good"     },
    { label: "Phases reached",     value: 5,   unit: "/ 5",  targetLabel: "Target ≥4",   band: "good"     },
    { label: "Disclosure leaks",   value: 0,   unit: "",     targetLabel: "Target 0",     band: "good"     },
    { label: "Silence held (avg)", value: 3.5, unit: "s",    targetLabel: "Target ≥3s",  band: "good"     },
    { label: "Levers explored",    value: 5,   unit: "of 8", targetLabel: "Target ≥4",   band: "good"     },
  ] as DeliveryMetric[],
  skills: [
    { name: "Anchoring",             score: 90, roleAvg: 55 },
    { name: "Package depth",         score: 85, roleAvg: 60 },
    { name: "BATNA leverage",        score: 80, roleAvg: 50 },
    { name: "Phase progression",     score: 88, roleAvg: 65 },
    { name: "Concession discipline", score: 82, roleAvg: 55 },
    { name: "Silence tolerance",     score: 78, roleAvg: 60 },
  ] as Skill[],
  weakestSkill: {
    name: "Silence tolerance",
    tip: "You held well but 2.8s on the ESOP question was shorter than your 4.2s opener. Two drills of holding silence past 5s will sharpen the instinct.",
  },
  questions: QUESTIONS,
  scoreConfidence: "high",
  priorSessionCount: 2,
  crossSessionInsights: [
    {
      kind: "improvement",
      title: "Anchoring discipline jumped 65 points across 3 sessions",
      body: "Session 1: scored 25 (accepted first offer). Session 3: scored 90 (countered with ₹52L + market data). Most-improved skill axis in any focus you've practised.",
    },
    {
      kind: "persistent",
      title: "Closing discipline still your relative weakness",
      body: "You reach phase 5 in 2 of 3 sessions but stall before the final recap + lock. Two closing-rep drills will close this gap.",
    },
  ],
  negotiationOutcome: OUTCOME,
};

/* ─── Canvas wrapper ─────────────────────────────────────────── */

export function SalaryNegStrongProd() {
  return (
    <div style={{ background: t.cream, fontFamily: f.sans, color: t.coal, paddingBottom: 48 }}>
      <style>{SESSION_REPORT_STYLES}</style>

      {/* Production hero — score gauge, readiness, AI verdict, strengths */}
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 clamp(14px, 4vw, 32px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          paddingTop: 24,
        }}
      >
        <HeroSection data={HERO_DATA} />
      </div>

      {/* Production negotiation report — 4-part deep-dive */}
      <NegotiationFullReport
        outcome={OUTCOME}
        role="Senior Engineering Manager"
        company="PhonePe"
        questions={QUESTIONS}
        daysUntilInterview={4}
        priorSessionCount={2}
        salaryMeta={{
          tierBucket: "senior-ic",
          tierBucketLabel: "Senior IC / Manager · ₹40–65L band",
          closingTotalLpa: 48,
          monthlyTakeHomeNewRegimeInr: 313000,
          monthlyTakeHomeOldRegimeInr: 298000,
          annualTaxNewRegimeLpa: 10.4,
          annualTaxOldRegimeLpa: 12.0,
          recruiterPersona: "standard-fintech",
          recruiterPersonaLabel: "Indian fintech · MNC-tier recruiter",
        }}
      />
    </div>
  );
}
