/* HireStepX — Focus-aware demo wrappers
 *
 * Each export wraps the EXISTING InterviewResult component
 * (../interview-result/InterviewResult) with focus-specific CHROME on top:
 *   • a focus banner (icon + name + per-focus tagline)
 *   • a focus-specific headline metric (anchor delta, complexity stated,
 *     framework usage, etc.) — what the focus actually grades on
 *   • an accent color that tints the banner so each focus is visually
 *     distinct at a glance
 *
 * The report below is unchanged — same hero, same skill bars, same
 * per-question card. Personalization happens at the chrome layer +
 * the data inside the report's slots (see _focus-data.ts).
 */

import CanvasProviders from "../../../CanvasProviders";
import InterviewResult, { type InterviewResultData } from "../interview-result/InterviewResult";
import { VariantADiagnosticFirst } from "../behavioral-interview-result/VariantADiagnosticFirst";
import {
  BEHAVIORAL_STRONG,
  TECHNICAL_PARTIAL,
  CASE_STUDY_STRONG,
  SALARY_NEG_WEAK,
  SYSTEM_DESIGN_PARTIAL,
  STRATEGIC_STRONG,
  CAMPUS_PLACEMENT_PARTIAL,
  PANEL_STRONG,
  GOVERNMENT_PARTIAL,
} from "./_focus-data";
import { SalaryDesignPanels, WEAK_PRESET, type SalaryDesignPreset } from "./_salary-design-panels";
import { SalaryNegStrongProd } from "./_salary-neg-strong-prod";
/* Production HR component — no hooks / no "use client", safe to canvas-import. */
import HrFullReport from "../../../../src/sessionReport/HrFullReport";
import type {
  HrReportData as ProdHrReportData,
  Skill as ProdSkill,
  Question as ProdQuestion,
} from "../../../../src/sessionReport/types";

interface FocusChrome {
  icon: string;
  label: string;
  /* Plain-English description of what this round measures — written
     for the user, not the engineer. Avoid internal axis names (BATNA,
     anchor delta, concession discipline) without explanation. */
  tagline: string;
  /* Headline metric the focus actually grades on — replaces the
     generic "score" framing as the first thing the user reads.
     `caption` adds a one-line plain-English explanation under the value
     so the number is self-explanatory in 5 seconds. */
  headlineMetric: { label: string; value: string; caption?: string };
  /* Accent color tints the banner border + the focus pill. Each focus
     gets a visually distinct accent so reports don't all look the same. */
  accent: string;
  accentSoft: string;
}

function FocusBanner({ chrome, daysUntilInterview, company, role }: {
  chrome: FocusChrome;
  daysUntilInterview?: number;
  company?: string;
  role?: string;
}) {
  return (
    <div
      style={{
        background: chrome.accentSoft,
        borderTop: `3px solid ${chrome.accent}`,
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        fontFamily: "'Satoshi', system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: chrome.accent,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {chrome.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: chrome.accent }}>
              {chrome.label}
            </span>
            {company && (
              <span style={{ fontSize: 11, color: "#6E6759" }}>·  {company} · {role}</span>
            )}
          </div>
          <div style={{ fontSize: 14, color: "#0E0C08", fontWeight: 500 }}>{chrome.tagline}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#6E6759", marginBottom: 2 }}>
            {chrome.headlineMetric.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: chrome.accent, fontFamily: "'JetBrains Mono', monospace" }}>
            {chrome.headlineMetric.value}
          </div>
          {chrome.headlineMetric.caption && (
            <div style={{ fontSize: 11, color: "#6E6759", marginTop: 3, maxWidth: 260 }}>
              {chrome.headlineMetric.caption}
            </div>
          )}
        </div>
        {typeof daysUntilInterview === "number" && (
          <div style={{ borderLeft: "1px solid #D6CDB5", paddingLeft: 24, textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#6E6759", marginBottom: 2 }}>
              Real round in
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#B45309", fontFamily: "'JetBrains Mono', monospace" }}>
              {daysUntilInterview}d
            </div>
            <div style={{ fontSize: 11, color: "#6E6759", marginTop: 3 }}>
              Practice before then
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FocusReport({
  data,
  chrome,
  salaryPanels,
}: {
  data: InterviewResultData;
  chrome: FocusChrome;
  /* Optional design-only panels appended below the standard report body.
     Salary Neg opts in; HR Round has its own production component
     (HrFullReport via HRWeakDemo) and no longer uses this. */
  salaryPanels?: SalaryDesignPreset;
}) {
  // Behavioural full layout has a self-contained hero so the FocusBanner
  // would double up. All other focuses keep the banner.
  const showFocusBanner = !data.behavioral?.fullLayout;
  return (
    <CanvasProviders>
      {showFocusBanner && (
        <FocusBanner
          chrome={chrome}
          daysUntilInterview={data.daysUntilInterview}
          company={data.company}
          role={data.role}
        />
      )}
      <InterviewResult data={data} />
      {salaryPanels && <SalaryDesignPanels preset={salaryPanels} />}
    </CanvasProviders>
  );
}

/* ─── Per-focus chrome — accent color, icon, headline metric ─── */

const BEHAVIORAL: FocusChrome = {
  icon: "🗣",
  label: "Behavioral Round",
  tagline: "Did you tell stories with specifics, ownership, and clear outcomes?",
  headlineMetric: { label: "You said 'I' vs 'we'", value: "64%", caption: "of your action sentences used 'I' — strong" },
  accent: "#312E81",
  accentSoft: "#E5E2F2",
};

const TECHNICAL: FocusChrome = {
  icon: "⚙",
  label: "Technical Round · DSA",
  tagline: "Did you walk through approaches and state the complexity, not just code the answer?",
  headlineMetric: { label: "Big-O stated", value: "0 / 2", caption: "you didn't say O(...) on either question" },
  accent: "#0F766E",
  accentSoft: "#CCFBF1",
};

const CASE_STUDY: FocusChrome = {
  icon: "📊",
  label: "Case Study · Product",
  tagline: "Did you use a framework, name a real customer, and drive to a recommendation with a metric?",
  headlineMetric: { label: "Frameworks named", value: "2 / 2", caption: "you held framework discipline both times" },
  accent: "#9333EA",
  accentSoft: "#F3E8FF",
};

const SALARY_NEG: FocusChrome = {
  icon: "💰",
  label: "Salary Negotiation",
  tagline: "Did you push back on the offer, or accept too quickly?",
  headlineMetric: {
    label: "Money you left behind",
    value: "−₹14L",
    caption: "below the typical band · ~₹56L over 4 years",
  },
  accent: "#B45309",
  accentSoft: "#FED7AA",
};


const SYSTEM_DESIGN: FocusChrome = {
  icon: "🏗",
  label: "System Design",
  tagline: "Did you ask about scale + capacity before drawing boxes? Did you call out failure modes?",
  headlineMetric: { label: "Capacity numbers", value: "Missing", caption: "you didn't state TPS, latency, or storage" },
  accent: "#1D4ED8",
  accentSoft: "#DBEAFE",
};

const STRATEGIC: FocusChrome = {
  icon: "🎯",
  label: "Strategic / Leadership",
  tagline: "Did you map stakeholders, name your vision, and own the bet you'd be making?",
  headlineMetric: { label: "Stakeholders you named", value: "4", caption: "engineering, product, sales, board — strong coverage" },
  accent: "#1E1B4B",
  accentSoft: "#E5E2F2",
};

const CAMPUS_PLACEMENT: FocusChrome = {
  icon: "🎓",
  label: "Campus Placement · Fresher",
  tagline: "Did you say 'I built X' or 'we built X'? Did you explain why you picked your tech stack?",
  headlineMetric: { label: "You said 'I' vs 'we'", value: "38%", caption: "low — most of your project sounded like teamwork, not your work" },
  accent: "#BE185D",
  accentSoft: "#FCE7F3",
};

const HR_ROUND: FocusChrome = {
  icon: "🤝",
  label: "HR Round",
  tagline: "HR grades you on 7 axes — comp, compliance, motivation, commitment, stability, logistics, benefits. One zero kills the offer.",
  headlineMetric: {
    label: "Dimensions failing (≥3/5)",
    value: "3 / 7",
    caption: "Compliance · Commitment · Motivation are below the floor — BGV docs + counter-offer script need to land before the real round",
  },
  accent: "#B91C1C",
  accentSoft: "#FEE2E2",
};

const PANEL: FocusChrome = {
  icon: "👥",
  label: "Panel Interview",
  tagline: "Did you change tone for each panelist (HR / tech lead / hiring manager) and bridge between them?",
  headlineMetric: { label: "Panelists you addressed", value: "3 / 3", caption: "you spoke to each, and shifted tone between them" },
  accent: "#374151",
  accentSoft: "#E5E7EB",
};

const GOVERNMENT: FocusChrome = {
  icon: "🏛",
  label: "Government / PSU Board",
  tagline: "Did you cite specific schemes, rulings, and policies — not just principles in the abstract?",
  headlineMetric: { label: "Specific policies cited", value: "0", caption: "your answer stayed abstract — boards expect concrete RTI / Act references" },
  accent: "#7C2D12",
  accentSoft: "#FED7AA",
};

/* ─── HR Round production demo data ─────────────────────────────────────
   Realistic Flipkart Senior PM HR round — score 42, 3 of 8 dimensions
   failing (Compliance, Commitment, Motivation). Used by HRWeakDemo to
   render the PRODUCTION HrFullReport component so the storyboard shows the
   real UI, not a canvas-local mock. */

const HR_PROD_SKILLS: ProdSkill[] = [
  { name: "Logistics clarity",        score: 55 },
  { name: "Comp transparency",        score: 48 },
  { name: "Switch-rationale honesty", score: 50 },
  { name: "Compliance readiness",     score: 30 },
  { name: "Commitment signal",        score: 35 },
  { name: "Benefits/policy literacy", score: 42 },
  { name: "Self-awareness",           score: 48 },
  { name: "Motivation specificity",   score: 28 },
];

const HR_PROD_WINS: string[] = [
  "Career trajectory was internally consistent",
  "Salary expectation was reasonable and anchored as a range",
];

const HR_PROD_REPORT: ProdHrReportData = {
  motivationBefore: "great company, great opportunity — it's a well-known brand",
  motivationAfter:
    "Flipkart's UPI-Lite expansion into tier-3 is exactly the problem space I want to be in — owning a 0-to-1 PM lane in payments, not scaling something already built.",
  noticeDays: 60,
  noticeFlexibility: "not-stated",
  compExpected: "42–48L",
  counterOfferRisk: "high",
  bgvGaps: [
    "Form-16 FY22 missing",
    "Relieving letter from prior employer not yet received",
  ],
};

const HR_PROD_QUESTIONS: ProdQuestion[] = [
  {
    index: 1,
    text: "Why are you leaving your current role?",
    score: 38,
    band: "weak",
    answer: [{ text: "Honestly, my current manager doesn't really appreciate my work…" }],
    star: { situation: false, task: false, action: false, result: false, learning: false },
    metrics: { wordCount: 145, responseSec: 168, firstPersonRatioPct: 68, quantificationCount: 0 },
    whyScored:
      "Leaned negative — 'my current manager doesn't appreciate me'; HR reads this as a future risk. Motivation was generic. No Flipkart-specific research surfaced.",
    redFlags: [
      {
        type: "blame",
        severity: "high",
        title: "Negative tone toward previous employer",
        explanation:
          "Even if true, HR reads this as a future risk. Reframe: 'I'm looking for [positive thing], which my current role can't offer.'",
        quote: "my current manager doesn't appreciate me",
      },
      {
        type: "vague",
        severity: "medium",
        title: "Generic motivation",
        explanation:
          "Every candidate says 'great company, great opportunity'. One Flipkart-specific reason beats five generic ones.",
        quote: "great company, great opportunity",
      },
    ],
    likelyFollowUp: "What specifically about Flipkart's product strategy resonates with your background?",
  },
  {
    index: 2,
    text: "What are your notice period and current CTC?",
    score: 55,
    band: "partial",
    answer: [{ text: "I have a 60-day notice period. My current CTC is around 28L fixed plus 12% variable…" }],
    star: { situation: false, task: false, action: false, result: false, learning: false },
    metrics: { wordCount: 88, responseSec: 95, firstPersonRatioPct: 60, quantificationCount: 2 },
    whyScored:
      "Disclosed current CTC without being asked — anchors the negotiation low. Notice period stated but no mention of buyout possibility.",
    likelyFollowUp: "Can you produce Form-16 and last 3 payslips for BGV?",
  },
  {
    index: 3,
    text: "Do you have other offers in hand? How committed are you to joining us if we proceed?",
    score: 32,
    band: "weak",
    answer: [{ text: "Not really — I'm most interested in Flipkart but I'm also talking to a couple of places…" }],
    star: { situation: false, task: false, action: false, result: false, learning: false },
    metrics: { wordCount: 72, responseSec: 65, firstPersonRatioPct: 55, quantificationCount: 0 },
    whyScored:
      "Ambiguous on commitment. 'Most interested' without a joining-date lock reads as non-committal and increases drop-out risk in HR scoring.",
    redFlags: [
      {
        type: "vague",
        severity: "high",
        title: "Commitment signal is weak",
        explanation:
          "HR's biggest fear in India is pre-joining drop-out. A joining-date commitment ('I can join within 10 days of offer') dramatically improves this score.",
        quote: "I'm most interested in Flipkart but I'm also talking to a couple of places",
      },
    ],
    likelyFollowUp: "If we make an offer today, when's the earliest you could join?",
  },
];

/* ─── Demo exports ───────────────────────────────────────────── */

export function BehavioralStrongDemo() {
  // Behavioural focus now uses the new diagnostic-first result screen
  // (canvases/behavioral-interview-result/VariantADiagnosticFirst). The
  // FocusReport + FocusBanner chrome is intentionally dropped — the new
  // hero owns the persona + verdict slots end-to-end.
  return (
    <CanvasProviders>
      <VariantADiagnosticFirst />
    </CanvasProviders>
  );
}
export function TechnicalPartialDemo() { return <FocusReport data={TECHNICAL_PARTIAL} chrome={TECHNICAL} />; }
export function CaseStudyStrongDemo() { return <FocusReport data={CASE_STUDY_STRONG} chrome={CASE_STUDY} />; }
export function SalaryNegWeakDemo() { return <FocusReport data={SALARY_NEG_WEAK} chrome={SALARY_NEG} salaryPanels={WEAK_PRESET} />; }
export function SalaryNegStrongDemo() { return <SalaryNegStrongProd />; }
export function SystemDesignPartialDemo() { return <FocusReport data={SYSTEM_DESIGN_PARTIAL} chrome={SYSTEM_DESIGN} />; }
export function StrategicStrongDemo() { return <FocusReport data={STRATEGIC_STRONG} chrome={STRATEGIC} />; }
export function CampusPlacementPartialDemo() { return <FocusReport data={CAMPUS_PLACEMENT_PARTIAL} chrome={CAMPUS_PLACEMENT} />; }
/* HR uses the PRODUCTION HrFullReport directly — no canvas-local mock.
   The component has no hooks and no "use client", so it's safe to import
   here. CanvasProviders supplies the styling context the canvas runner
   expects. */
export function HRWeakDemo() {
  return (
    <CanvasProviders>
      <HrFullReport
        overallScore={42}
        skills={HR_PROD_SKILLS}
        wins={HR_PROD_WINS}
        questions={HR_PROD_QUESTIONS}
        hrReport={HR_PROD_REPORT}
        daysUntilInterview={3}
        role="Senior Product Manager"
        company="Flipkart"
      />
    </CanvasProviders>
  );
}
export function PanelStrongDemo() { return <FocusReport data={PANEL_STRONG} chrome={PANEL} />; }
export function GovernmentPartialDemo() { return <FocusReport data={GOVERNMENT_PARTIAL} chrome={GOVERNMENT} />; }
