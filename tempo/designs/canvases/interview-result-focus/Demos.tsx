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
  SALARY_NEG_STRONG,
  SYSTEM_DESIGN_PARTIAL,
  STRATEGIC_STRONG,
  CAMPUS_PLACEMENT_PARTIAL,
  HR_WEAK,
  PANEL_STRONG,
  GOVERNMENT_PARTIAL,
} from "./_focus-data";
import { SalaryDesignPanels, WEAK_PRESET, STRONG_PRESET, type SalaryDesignPreset } from "./_salary-design-panels";
import { HrDesignPanels, HR_WEAK_PRESET, type HrDesignPreset } from "./_hr-design-panels";

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
  hrPanels,
}: {
  data: InterviewResultData;
  chrome: FocusChrome;
  /* Optional design-only panels rendered below the standard report.
     Salary Neg and HR Round each opt into their own panel stack — the
     base report stays untouched. */
  salaryPanels?: SalaryDesignPreset;
  hrPanels?: HrDesignPreset;
}) {
  // The behavioural full layout has a self-contained hero (gauge + verbal
  // verdict + at-a-glance + biggest gap) and its own next-steps countdown
  // downstream, so the FocusBanner would just duplicate those signals and
  // compete with the hero for the eyebrow slot. Skip it for fullLayout;
  // all 10 other focuses keep the banner.
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
      {/* HR opts out of the generic InterviewResult shell — its panels
          replace the report end-to-end, so the dual-vocabulary problem
          (generic skill bars + HR dim gate scoring the same person twice)
          can't happen. All other focuses keep the generic shell. */}
      {hrPanels ? (
        <HrDesignPanels preset={hrPanels} />
      ) : (
        <>
          <InterviewResult data={data} />
          {salaryPanels && <SalaryDesignPanels preset={salaryPanels} />}
        </>
      )}
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

const SALARY_NEG_STRONG_CHROME: FocusChrome = {
  ...SALARY_NEG,
  /* Plain-English headline: countered 37% above their first offer, and the
     base + ESOPs translate to ~₹62L extra income over a 4-year tenure. */
  headlineMetric: {
    label: "How well you negotiated",
    value: "+37%",
    caption: "above their first offer · ~₹62L extra over 4 years",
  },
  accent: "#15803D",
  accentSoft: "#DCFCE7",
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
export function SalaryNegStrongDemo() { return <FocusReport data={SALARY_NEG_STRONG} chrome={SALARY_NEG_STRONG_CHROME} salaryPanels={STRONG_PRESET} />; }
export function SystemDesignPartialDemo() { return <FocusReport data={SYSTEM_DESIGN_PARTIAL} chrome={SYSTEM_DESIGN} />; }
export function StrategicStrongDemo() { return <FocusReport data={STRATEGIC_STRONG} chrome={STRATEGIC} />; }
export function CampusPlacementPartialDemo() { return <FocusReport data={CAMPUS_PLACEMENT_PARTIAL} chrome={CAMPUS_PLACEMENT} />; }
export function HRWeakDemo() { return <FocusReport data={HR_WEAK} chrome={HR_ROUND} hrPanels={HR_WEAK_PRESET} />; }
export function PanelStrongDemo() { return <FocusReport data={PANEL_STRONG} chrome={PANEL} />; }
export function GovernmentPartialDemo() { return <FocusReport data={GOVERNMENT_PARTIAL} chrome={GOVERNMENT} />; }
