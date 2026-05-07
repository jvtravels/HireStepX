/* HireStepX — Dashboard / Resume tab (design-only, light mode, v2)
   Self-contained visual design of the Resume tab in the cream / indigo /
   copper editorial palette. No contexts, no networking — hardcoded sample
   data drives every section.

   v2 changes (over v1):
     • Target-role pill in the header — the role drives every downstream
       score, so it gets first-class affordance instead of being buried.
     • Readiness Index — a 3-tile at-a-glance strip directly under the
       hero. Users get the answer in one scan; the deep-dive sections
       become reference, not the primary read.
     • "Your next move" CTA — converts the weakest coverage band into a
       single primary action ("Start a 5-min mock"). Closes the loop
       between diagnosis and practice.
     • Hero file-metadata bar — file name, size, last-analysed and
       Replace/Delete affordances get a proper bar, not a footnote.
     • Coverage panel — compact 2-column matrix instead of 4-column rows.
     • Visual bands — cream-soft → white → copper-tint section bands
       break the uniform white-card stripe and group sections by intent
       (Diagnose, Practise, Improve).

   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import type { ReactNode, CSSProperties } from "react";

/* Cream-mode tokens — mirrors tempo/designs/canvases/design-system/_tokens.ts */
const t = {
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
  white: "#FFFFFF",
  coal: "#0E0C08",
  inkSoft: "#6E6759",
  inkFaint: "#A39C8B",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper: "#B45309",
  copper100: "#F4E5D8",
  copperSoft: "rgba(180, 83, 9, 0.12)",
  /* Light copper used as accent on dark indigo surfaces (CTA only).
     Mirrors the design-system's copper family without inventing
     a new hue. */
  copperLight: "#E8D5AE",
  /* Standard tinted-border alpha for status surfaces. Use these
     instead of ad-hoc rgba(success, .18 / .22 / .25) one-offs. */
  successBorder: "rgba(21,128,61,0.22)",
  warningBorder: "rgba(161,98,7,0.22)",
  errorBorder: "rgba(185,28,28,0.22)",
  success: "#15803D",
  success100: "#DCFCE7",
  warning: "#A16207",
  warning100: "#FEF3C7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
};
const f = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};
const cardShadow =
  "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)";

/* ── Feature flag ─────────────────────────────────────────────────────
   Phase-1 features are kept in the file but gated behind this flag, so
   flipping it to `true` ships them all in one go. Currently hidden:
     • "Complete your profile" tile (Section 2.5)
     • "Your next move" CTA (Section 3)
     • "Tailor to a job description" card (Section 3.5)
     • "What you'd like to practise" self-input panel (Section 4.5) */
const PHASE_1 = false;

/* ── Sample data ─────────────────────────────────────────────────────── */

const TARGET_ROLE = "Senior Product Designer";
const FILE = { name: "rahul_design_v3.pdf", sizeKb: 248, lastAnalysed: "2 days ago" };

/* Structured experience timeline — drives the LLM's ability to ask
   company- and project-specific behavioural questions instead of generic
   "tell me about a time you led a team" filler. Each entry must be
   editable so the user can correct AI-extracted scope / team size. */
interface Experience {
  company: string;
  title: string;
  start: string;
  end: string; // "Present" allowed
  scope: string;
  teamSize: number | null;
  partners: string[]; // Eng, PM, Data, Marketing, Leadership…
  topProjects: string[];
}
const EXPERIENCES: Experience[] = [
  {
    company: "Acme SaaS",
    title: "Design Lead",
    start: "Mar 2023",
    end: "Present",
    scope: "Owns design across onboarding, pricing, and dashboard surfaces. Reports to Head of Product.",
    teamSize: 3,
    partners: ["Engineering", "Product", "Marketing"],
    topProjects: ["Dashboard rebrand & system overhaul", "Trial-to-paid pricing experiment"],
  },
  {
    company: "Razorpay",
    title: "Senior Product Designer",
    start: "Jul 2021",
    end: "Feb 2023",
    scope: "Led credit & lending flows for the merchant dashboard. Cross-functional with risk + compliance.",
    teamSize: 2,
    partners: ["Engineering", "Risk", "Compliance"],
    topProjects: ["Credit onboarding (₹120 Cr/month)", "Merchant KYC redesign"],
  },
  {
    company: "FinTech Co",
    title: "Product Designer",
    start: "Aug 2018",
    end: "Jun 2021",
    scope: "IC designer on consumer wallet. Solo design for the first 18 months, then mentored 2 juniors.",
    teamSize: null,
    partners: ["Engineering", "Marketing"],
    topProjects: ["Wallet onboarding", "Refer-a-friend redesign"],
  },
];

interface SkillEntry {
  name: string;
  depth: "primary" | "secondary" | "exposure"; // primary = core, used now
  yearsUsed?: number;
  recent?: boolean; // touched in the last 12 months
}
const SKILLS: SkillEntry[] = [
  { name: "Figma", depth: "primary", yearsUsed: 6, recent: true },
  { name: "Design Systems", depth: "primary", yearsUsed: 4, recent: true },
  { name: "User Research", depth: "primary", yearsUsed: 5, recent: true },
  { name: "Prototyping", depth: "secondary", yearsUsed: 5, recent: true },
  { name: "Information Architecture", depth: "secondary", yearsUsed: 4, recent: true },
  { name: "A/B Testing", depth: "secondary", yearsUsed: 3, recent: true },
  { name: "Accessibility (WCAG)", depth: "exposure", yearsUsed: 2, recent: false },
  { name: "Cross-functional leadership", depth: "primary", yearsUsed: 3, recent: true },
];

/* Profile-completeness checklist — surfaces what's missing so the user
   knows where data quality drops off. Each item links to the section
   that fixes it. Tracking-wise, this is the meta-feature that nudges
   users toward giving the LLM the data it needs. */
interface ProfileGap {
  field: string;
  weight: "high" | "med" | "low";
  hint: string;
}
const PROFILE_GAPS: ProfileGap[] = [
  { field: "Add a target job description", weight: "high", hint: "Lifts coverage match from generic to JD-specific." },
  { field: "Add 1 failure / project-that-didn't-ship story", weight: "high", hint: "Behavioural rounds always ask. We have zero." },
  { field: "Confirm team sizes for FinTech Co", weight: "med", hint: "AI couldn't infer headcount from the resume text." },
  { field: "Add education / certifications", weight: "low", hint: "Useful for fundamentals questions." },
];

const PROFILE = {
  headline: "Senior Product Designer",
  summary:
    "Senior product designer with 6+ years shipping consumer fintech and B2B SaaS at scale. Strong systems thinker — comfortable owning end-to-end flows from research through hand-off, and known for translating ambiguous business asks into measurable design bets.",
  yearsExperience: 6,
  seniorityLevel: "Senior",
  industries: ["Fintech", "B2B SaaS"],
  topSkills: SKILLS.map(s => s.name),
  keyAchievements: [
    "Led the rebrand + design-system overhaul that lifted dashboard NPS from 28 → 51 in two quarters.",
    "Shipped a credit-onboarding flow that improved completion 38% and now processes ₹120 Cr / month.",
    "Mentored 4 mid-level designers — two were promoted to senior within the year.",
  ],
  interviewStrengths: [
    "Quantified outcomes — NPS, completion %, revenue impact all on resume",
    "Cross-functional ownership signals (research → engineering → launch)",
    "Mentorship + leadership track record for staff-level loops",
  ],
  interviewGaps: [
    "Limited B2C marketplace exposure — practise scale + trust questions",
    "No explicit ML / data-product work — vulnerable on AI-feature design rounds",
    "Resume light on failure stories — prep one strong 'project that didn't ship' STAR",
  ],
  careerTrajectory:
    "IC designer at FinTech Co (2018) → Senior Designer at Razorpay (2021) → Design Lead at current SaaS (2023). Trajectory and scope point to a Staff Designer move in the next 12-18 months.",
  resumeScore: 78,
  improvements: [
    "Quantify the design-system overhaul with adoption / consistency metrics, not just NPS.",
    "Add a one-line summary at top of the resume — the AI inferred it, but recruiters skim.",
    "The 2018-2021 gap in promotions reads ambiguously — add a one-liner on scope growth.",
  ],
};

const ATS = {
  score: 82,
  label: "ATS-friendly",
  found: ["Standard sections", "Contact info", "Dates", "Action verbs", "Keywords match"],
  missing: ["Quantified metrics in 2/5 bullets"],
  suggestions: [
    "Lead each bullet with a strong verb (Led, Shipped, Reduced) — already strong; tighten the 2018 bullets.",
    "Mirror 3–5 keywords from the target job description in your top skills list.",
    "Keep to 1 page if total experience < 10 years; 2 pages otherwise. Yours is well within range.",
  ],
};

type Band = "Excellent" | "Good" | "Fair" | "Low";
const BAND_COLOR: Record<Band, string> = {
  Excellent: t.success,
  Good: t.success,
  Fair: t.warning,
  Low: t.error,
};

interface CoverageRow {
  label: string;
  band: Band;
  pct: number;
}
const COVERAGE: CoverageRow[] = [
  { label: "Behavioural — leadership stories", band: "Excellent", pct: 88 },
  { label: "Portfolio walkthrough", band: "Excellent", pct: 84 },
  { label: "Design-system & systems thinking", band: "Good", pct: 71 },
  { label: "Cross-functional / influence", band: "Good", pct: 68 },
  { label: "Behavioural — failure / conflict", band: "Fair", pct: 52 },
  { label: "Data-product / AI feature design", band: "Low", pct: 28 },
];
const COVERAGE_STRONG = COVERAGE.filter(r => r.band === "Excellent" || r.band === "Good").length;
const TOP_FOCUS = [...COVERAGE].sort((a, b) => a.pct - b.pct)[0];

/* ── Reusable bits ────────────────────────────────────────────────────── */

function SectionCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: t.white,
        borderRadius: 16,
        border: `1px solid ${t.line}`,
        boxShadow: cardShadow,
        padding: "22px 24px",
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.005em" }}>
          {label}
        </h3>
      </div>
      {trailing}
    </div>
  );
}

function BandLabel({
  text,
  pre,
}: {
  text: string;
  pre?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "32px 0 14px", padding: "0 4px" }}>
      <span
        style={{
          fontFamily: f.sans,
          fontSize: 11,
          fontWeight: 700,
          color: t.copper,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {text}
      </span>
      {pre && (
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.45 }}>
          — {pre}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: t.line }} />
    </div>
  );
}

/* ── Readiness stat tile ─────────────────────────────────────────────── */

interface StatTileProps {
  label: string;
  value: ReactNode;
  qualifier: string;
  qualifierColor: string;
  bar?: { pct: number; color: string };
}
function StatTile({ label, value, qualifier, qualifierColor, bar }: StatTileProps) {
  return (
    <div
      style={{
        background: t.white,
        borderRadius: 14,
        border: `1px solid ${t.line}`,
        boxShadow: cardShadow,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        style={{
          fontFamily: f.sans,
          fontSize: 11,
          fontWeight: 700,
          color: t.inkSoft,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: f.serif, fontSize: 36, fontWeight: 400, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {value}
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: qualifierColor, fontWeight: 600 }}>
          {qualifier}
        </span>
      </div>
      {bar && (
        <div style={{ height: 4, background: t.creamSoft, borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
          <div style={{ height: "100%", width: `${bar.pct}%`, background: bar.color, borderRadius: 999 }} />
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function ResumeTab() {
  return (
    <div
      style={{
        background: t.cream,
        minHeight: "100dvh",
        color: t.coal,
        fontFamily: f.sans,
        padding: "40px 32px 80px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header — title + target-role pill */}
        <header
          style={{
            marginBottom: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: f.serif,
                fontSize: "clamp(2.25rem, 4vw, 3rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 400,
                color: t.coal,
                margin: 0,
              }}
            >
              Your{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
                resume
              </em>
            </h1>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: 15,
                color: t.inkSoft,
                marginTop: 10,
                lineHeight: 1.55,
                maxWidth: 540,
                textWrap: "balance",
              }}
            >
              Your resume drives every interview question, fitness score, and coaching nudge.
              Keep it current — even small edits change what we ask next.
            </p>
          </div>

          {/* Target-role pill — first-class control. The role is the lens
              every score is rendered through, so it can't be a footnote. */}
          <button
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 999,
              padding: "8px 14px",
              cursor: "pointer",
              boxShadow: cardShadow,
              fontFamily: f.sans,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: t.inkSoft, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Tailored for
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{TARGET_ROLE}</span>
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </header>

        {/* 1. Active resume hero */}
        <div
          style={{
            background: `linear-gradient(135deg, ${t.white} 0%, ${t.copper100} 160%)`,
            borderRadius: 18,
            border: `1px solid ${t.line}`,
            boxShadow: cardShadow,
            padding: "28px 28px 0",
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontFamily: f.serif,
                  fontSize: 32,
                  color: t.coal,
                  margin: "0 0 10px",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  fontWeight: 400,
                }}
              >
                {PROFILE.headline}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.copper,
                    background: t.copper100,
                    border: `1px solid ${t.copperSoft}`,
                    borderRadius: 6,
                    padding: "3px 10px",
                  }}
                >
                  {PROFILE.seniorityLevel}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                  {PROFILE.yearsExperience}+ years experience
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                  {PROFILE.industries.join(", ")}
                </span>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 10,
                    fontWeight: 600,
                    color: t.success,
                    background: t.success100,
                    border: `1px solid ${t.successBorder}`,
                    borderRadius: 6,
                    padding: "2px 8px",
                  }}
                >
                  AI Profile · v3
                </span>
              </div>
            </div>
          </div>

          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.65, margin: "0 0 14px", maxWidth: 720 }}>
            {PROFILE.summary}
          </p>

          {/* Career trajectory */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: t.success100,
              border: `1px solid ${t.successBorder}`,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.8">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 10,
                  fontWeight: 700,
                  color: t.success,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Career Trajectory
              </span>
            </div>
            <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>
              {PROFILE.careerTrajectory}
            </span>
          </div>

          {/* File metadata bar — full-bleed strip at the bottom of the
              hero. Replaces the tiny footnote with a proper utility bar. */}
          <div
            style={{
              margin: "0 -28px",
              padding: "14px 28px",
              borderTop: `1px solid ${t.line}`,
              background: t.creamSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: t.copper100,
                  border: `1px solid ${t.copperSoft}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
                  {FILE.name}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: 2 }}>
                  {FILE.sizeKb} KB · last analysed {FILE.lastAnalysed}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.coal,
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 8,
                  padding: "7px 12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.inkSoft} strokeWidth="1.8">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Re-analyse
              </button>
              <button
                type="button"
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.indigo,
                  background: t.white,
                  border: `1px solid ${t.indigo}`,
                  borderRadius: 8,
                  padding: "7px 14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Replace
              </button>
              <button
                type="button"
                aria-label="Delete resume"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="1.8">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Readiness Index — at-a-glance answer */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatTile
            label="Resume Quality"
            value={
              <>
                {PROFILE.resumeScore}
                <span style={{ fontSize: 16, fontWeight: 400, color: t.inkFaint, marginLeft: 2 }}>/100</span>
              </>
            }
            qualifier="Solid"
            qualifierColor={t.success}
            bar={{ pct: PROFILE.resumeScore, color: t.success }}
          />
          <StatTile
            label="ATS Compatibility"
            value={
              <>
                {ATS.score}
                <span style={{ fontSize: 16, fontWeight: 400, color: t.inkFaint, marginLeft: 2 }}>/100</span>
              </>
            }
            qualifier="Recruiter-ready"
            qualifierColor={t.success}
            bar={{ pct: ATS.score, color: t.success }}
          />
          <StatTile
            label="Interview Coverage"
            value={
              <>
                {COVERAGE_STRONG}
                <span style={{ fontSize: 16, fontWeight: 400, color: t.inkFaint, marginLeft: 2 }}>/{COVERAGE.length}</span>
              </>
            }
            qualifier={`${COVERAGE.length - COVERAGE_STRONG} need work`}
            qualifierColor={t.warning}
            bar={{
              pct: Math.round((COVERAGE_STRONG / COVERAGE.length) * 100),
              color: t.warning,
            }}
          />
        </div>

        {/* 2.5 "Complete your profile" — meta-feature that nudges users
           to fill the gaps the LLM needs for sharper question generation.
           Closes the loop: design surfaces what's missing AND offers fixes.
           [PHASE 1 — gated behind PHASE_1 flag] */}
        {PHASE_1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            marginBottom: 16,
            background: t.copper100,
            border: `1px solid ${t.copperSoft}`,
            borderRadius: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: t.copper,
              color: t.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: f.serif,
              fontSize: 16,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {PROFILE_GAPS.length}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, lineHeight: 1.4 }}>
              {PROFILE_GAPS.length} ways to make your interviews sharper
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2, lineHeight: 1.45 }}>
              The more we know, the more your questions feel like {TARGET_ROLE} interviews — not generic prompts.
            </div>
          </div>
          <button
            type="button"
            style={{
              fontFamily: f.sans,
              fontSize: 12,
              fontWeight: 600,
              color: t.indigo,
              background: t.white,
              border: `1px solid ${t.indigo}`,
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
            }}
          >
            Show me how →
          </button>
        </div>
        )}

        {/* 3. "Your next move" CTA — converts diagnosis into action.
           [PHASE 1 — gated behind PHASE_1 flag] */}
        {PHASE_1 && (
        <div
          style={{
            background: `linear-gradient(135deg, ${t.indigo} 0%, ${t.indigoDeep} 100%)`,
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: 16,
            color: t.white,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            boxShadow: cardShadow,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.white} strokeWidth="1.8">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              style={{
                fontFamily: f.sans,
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              Your next move
            </div>
            <div style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
              Practise: <em style={{ fontStyle: "italic", color: t.copperLight }}>{TOP_FOCUS.label}</em>
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 4, lineHeight: 1.5 }}>
              This is currently your weakest interview track ({TOP_FOCUS.pct}%). A 5-minute focused mock will move the needle fast.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              style={{
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
                color: t.indigoDeep,
                background: t.copperLight,
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Start a 5-min mock →
            </button>
            <button
              type="button"
              style={{
                fontFamily: f.sans,
                fontSize: 12,
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 8,
                padding: "7px 14px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Show a model answer
            </button>
          </div>
        </div>
        )}

        {/* ─── DIAGNOSE band ─────────────────────────────────────────── */}
        <BandLabel text="Diagnose" pre="What the AI sees on your resume" />

        {/* 3.5 Tailor to a JD — single highest-leverage data input.
           Transforms generic role-fit questions into JD-specific ones.
           [PHASE 1 — gated behind PHASE_1 flag] */}
        {PHASE_1 && (
        <SectionCard style={{ background: `linear-gradient(180deg, ${t.white} 0%, ${t.indigo100} 240%)` }}>
          <SectionHeader
            label="Tailor to a job description"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="1.8">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
            trailing={
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.indigo,
                  background: t.indigo100,
                  border: `1px solid ${t.indigo100}`,
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                Recommended
              </span>
            }
          />
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 14px", lineHeight: 1.55 }}>
            Paste the role you&apos;re actually interviewing for. We&apos;ll mirror its keywords in your mock questions and re-score your coverage against its real requirements — not a generic taxonomy.
          </p>
          <textarea
            placeholder="Paste the job description here…"
            rows={4}
            style={{
              width: "100%",
              fontFamily: f.sans,
              fontSize: 13,
              color: t.coal,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 10,
              padding: "12px 14px",
              resize: "vertical",
              outline: "none",
              lineHeight: 1.5,
              boxSizing: "border-box",
            }}
            defaultValue=""
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft }}>
              We extract must-haves, nice-to-haves, and tone — never stored beyond this session unless you save the role.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 500,
                  color: t.inkSoft,
                  background: "transparent",
                  border: `1px solid ${t.line}`,
                  borderRadius: 8,
                  padding: "7px 12px",
                  cursor: "pointer",
                }}
              >
                Paste from URL
              </button>
              <button
                type="button"
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.white,
                  background: t.indigo,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Match my resume →
              </button>
            </div>
          </div>
        </SectionCard>
        )}

        {/* 3.6 Structured experience timeline — gives the LLM company,
           team, scope per role so behavioural questions become specific
           ("at Razorpay, walk me through the credit onboarding") instead
           of generic ("tell me about a time you led a team"). */}
        <SectionCard>
          <SectionHeader
            label="Experience"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                <span style={{ fontWeight: 600, color: t.coal }}>{EXPERIENCES.length} roles</span> · {PROFILE.yearsExperience}+ years
              </span>
            }
          />
          <ol style={{ listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
            {EXPERIENCES.map((exp, i) => {
              const isCurrent = exp.end === "Present";
              const isLast = i === EXPERIENCES.length - 1;
              return (
                <li key={exp.company} style={{ display: "flex", gap: 16, position: "relative", paddingBottom: isLast ? 0 : 18 }}>
                  {/* timeline rail + dot */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: isCurrent ? t.copper : t.white,
                        border: `2px solid ${isCurrent ? t.copper : t.lineStrong}`,
                        marginTop: 5,
                      }}
                    />
                    {!isLast && (
                      <div style={{ width: 2, flex: 1, background: t.line, marginTop: 4 }} />
                    )}
                  </div>
                  {/* content */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>
                          {exp.title}
                        </span>
                        <span style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>
                          {" · "}{exp.company}
                        </span>
                      </div>
                      <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>
                        {exp.start} — {exp.end}
                      </span>
                    </div>
                    <p style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, margin: "4px 0 8px", lineHeight: 1.55 }}>
                      {exp.scope}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {exp.teamSize != null ? (
                        <span
                          style={{
                            fontFamily: f.sans,
                            fontSize: 11,
                            fontWeight: 500,
                            color: t.coal,
                            background: t.creamSoft,
                            border: `1px solid ${t.line}`,
                            borderRadius: 999,
                            padding: "2px 9px",
                          }}
                        >
                          Team of {exp.teamSize}
                        </span>
                      ) : (
                        <button
                          type="button"
                          title="AI couldn't infer team size from the resume — confirming it sharpens behavioural questions."
                          style={{
                            fontFamily: f.sans,
                            fontSize: 11,
                            fontWeight: 500,
                            color: t.indigo,
                            background: t.white,
                            border: `1px dashed ${t.indigo}`,
                            borderRadius: 999,
                            padding: "2px 9px",
                            cursor: "pointer",
                          }}
                        >
                          + Add team size
                        </button>
                      )}
                      {exp.partners.map(p => (
                        <span
                          key={p}
                          style={{
                            fontFamily: f.sans,
                            fontSize: 11,
                            color: t.inkSoft,
                            background: t.creamSoft,
                            border: `1px solid ${t.line}`,
                            borderRadius: 999,
                            padding: "2px 9px",
                          }}
                        >
                          ↔ {p}
                        </span>
                      ))}
                    </div>
                    {exp.topProjects.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {exp.topProjects.map(p => (
                          <div key={p} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.copper, marginTop: 7, flexShrink: 0 }} />
                            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, lineHeight: 1.5 }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionCard>

        {/* 4. Strengths · Focus areas (with visual differentiation) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: t.success100,
              borderRadius: 16,
              border: `1px solid ${t.successBorder}`,
              padding: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.8">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 700, color: t.coal, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Strengths
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PROFILE.interviewStrengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.success, flexShrink: 0, marginTop: 7 }} />
                  <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              background: t.warning100,
              borderRadius: 16,
              border: `1px solid ${t.warningBorder}`,
              padding: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.warning} strokeWidth="1.8">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 700, color: t.coal, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Focus areas
              </h3>
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 11,
                  color: t.inkSoft,
                  borderBottom: `1px dotted ${t.inkFaint}`,
                  marginLeft: 4,
                  cursor: "help",
                }}
              >
                Why these?
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PROFILE.interviewGaps.map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.warning, flexShrink: 0, marginTop: 7 }} />
                  <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{g}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4.5 User self-input — pairs the AI's inferred gaps with the
           user's self-perception. Self-reported worry is usually the most
           reliable gap signal; without this, the LLM only sees one half
           of what to practise. Also seeds a failure-story (always
           asked, currently zero on resume).
           [PHASE 1 — gated behind PHASE_1 flag] */}
        {PHASE_1 && (
        <SectionCard style={{ background: t.indigo100, border: `1px solid ${t.indigo100}`, boxShadow: "none" }}>
          <SectionHeader
            label="What you'd like to practise"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 11, color: t.indigo, fontWeight: 500 }}>
                Your input · always overrides AI
              </span>
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <label
                htmlFor="self-gap-input"
                style={{
                  display: "block",
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.coal,
                  marginBottom: 6,
                }}
              >
                Anything specific you want extra reps on?
              </label>
              <textarea
                id="self-gap-input"
                rows={3}
                placeholder="e.g. salary negotiation in INR, system-design rounds, dealing with disagreement…"
                style={{
                  width: "100%",
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.coal,
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                htmlFor="failure-story-input"
                style={{
                  display: "block",
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.coal,
                  marginBottom: 6,
                }}
              >
                A project that didn&apos;t ship (or failed){" "}
                <span style={{ fontWeight: 500, color: t.warning, marginLeft: 4 }}>· behavioural rounds always ask</span>
              </label>
              <textarea
                id="failure-story-input"
                rows={3}
                placeholder="Even a one-liner helps. We'll prompt for STAR detail when you practise the round."
                style={{
                  width: "100%",
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.coal,
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              type="button"
              style={{
                fontFamily: f.sans,
                fontSize: 12,
                fontWeight: 600,
                color: t.white,
                background: t.indigo,
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Save to my profile
            </button>
          </div>
        </SectionCard>
        )}

        {/* 5. ATS compliance — collapsed: score chips only, suggestions tucked */}
        <SectionCard>
          <SectionHeader
            label="ATS Compliance"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                <span style={{ fontFamily: f.mono, fontSize: 13, fontWeight: 700, color: t.success, marginRight: 4 }}>{ATS.score}</span>
                / 100 · {ATS.label}
              </span>
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div>
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 11,
                  fontWeight: 700,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Found
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {ATS.found.map(item => (
                  <span
                    key={item}
                    style={{
                      fontFamily: f.sans,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: t.success100,
                      color: t.success,
                      border: `1px solid ${t.successBorder}`,
                    }}
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 11,
                  fontWeight: 700,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Missing
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {ATS.missing.map(item => (
                  <span
                    key={item}
                    style={{
                      fontFamily: f.sans,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: t.warning100,
                      color: t.warning,
                      border: `1px solid ${t.warningBorder}`,
                    }}
                  >
                    ! {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <details style={{ marginTop: 16 }}>
            <summary
              style={{
                fontFamily: f.sans,
                fontSize: 12,
                fontWeight: 600,
                color: t.indigo,
                cursor: "pointer",
                listStyle: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Show {ATS.suggestions.length} suggestions
              <span style={{ fontSize: 10 }}>▾</span>
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {ATS.suggestions.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: t.creamSoft,
                    border: `1px solid ${t.line}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      color: t.copper,
                      background: t.copper100,
                      borderRadius: 6,
                      padding: "2px 7px",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{tip}</span>
                </div>
              ))}
            </div>
          </details>
        </SectionCard>

        {/* ─── PRACTISE band ────────────────────────────────────────── */}
        <BandLabel text="Practise" pre="Where to spend your next session" />

        {/* 6. Coverage panel — compact 2-column */}
        <SectionCard>
          <SectionHeader
            label="Interview Coverage"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <path d="M12 2v20" />
                <path d="M2 12h20" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                <span style={{ fontWeight: 600, color: t.coal }}>{COVERAGE_STRONG}</span> of {COVERAGE.length} tracks at Good+
              </span>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "10px 24px",
            }}
          >
            {COVERAGE.map(row => {
              const color = BAND_COLOR[row.band];
              return (
                <div key={row.label}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.4 }}>{row.label}</span>
                    <span
                      style={{
                        fontFamily: f.sans,
                        fontSize: 10,
                        fontWeight: 700,
                        color,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {row.band}
                    </span>
                  </div>
                  <div style={{ height: 6, background: t.creamSoft, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${row.pct}%`, background: color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ─── IMPROVE band ─────────────────────────────────────────── */}
        <BandLabel text="Improve" pre="Concrete edits to lift your score" />

        {/* 7. Resume quality + improvements */}
        <SectionCard>
          <SectionHeader
            label="How to lift your score"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                Each fix typically adds <span style={{ fontWeight: 600, color: t.success }}>3–6 pts</span>
              </span>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PROFILE.improvements.map((tip, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: t.creamSoft,
                  border: `1px solid ${t.line}`,
                }}
              >
                <span
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.copper,
                    background: t.copper100,
                    borderRadius: 6,
                    padding: "3px 8px",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55, flex: 1 }}>{tip}</span>
                <button
                  type="button"
                  title="Rewrite this with stronger verbs and metrics"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.white,
                    background: t.indigo,
                    border: "none",
                    borderRadius: 6,
                    padding: "5px 12px",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.white} strokeWidth="2.4">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Polish
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 8. What's on your resume — collapsed reference */}
        <details
          style={{
            background: t.white,
            borderRadius: 16,
            border: `1px solid ${t.line}`,
            boxShadow: cardShadow,
            padding: "18px 24px",
            marginBottom: 16,
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.005em" }}>
                What&apos;s on your resume
              </h3>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                · {PROFILE.topSkills.length} skills · {PROFILE.keyAchievements.length} achievements
              </span>
            </div>
            <span style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.indigo }}>Show ▾</span>
          </summary>

          <div style={{ marginTop: 18 }}>
            <span
              style={{
                fontFamily: f.sans,
                fontSize: 11,
                fontWeight: 700,
                color: t.inkSoft,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Top skills
            </span>
            <p style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, margin: "6px 0 10px", lineHeight: 1.5 }}>
              Depth lets us calibrate question difficulty — a primary skill earns deeper probes; exposure-only skills get fundamentals.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {SKILLS.map(skill => {
                const isPrimary = skill.depth === "primary";
                const isExposure = skill.depth === "exposure";
                return (
                  <span
                    key={skill.name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: f.sans,
                      fontSize: 12,
                      color: isPrimary ? t.copper : isExposure ? t.inkSoft : t.coal,
                      background: isPrimary ? t.copper100 : isExposure ? t.creamSoft : t.creamSoft,
                      border: `1px solid ${isPrimary ? t.copperSoft : t.line}`,
                      borderRadius: 999,
                      padding: "5px 6px 5px 12px",
                      fontWeight: isPrimary ? 600 : 500,
                      opacity: isExposure ? 0.85 : 1,
                    }}
                  >
                    {skill.name}
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: t.white,
                        background: isPrimary ? t.copper : isExposure ? t.inkFaint : t.inkSoft,
                        borderRadius: 999,
                        padding: "2px 7px",
                      }}
                      title={
                        isPrimary
                          ? "Primary skill — used now and across multiple roles"
                          : isExposure
                          ? "Exposure only — surfaced but not deeply demonstrated"
                          : "Secondary — recurring but not core"
                      }
                    >
                      {skill.depth === "primary"
                        ? `${skill.yearsUsed}y · core`
                        : skill.depth === "exposure"
                        ? "exposure"
                        : `${skill.yearsUsed}y`}
                    </span>
                  </span>
                );
              })}
            </div>

            <span
              style={{
                fontFamily: f.sans,
                fontSize: 11,
                fontWeight: 700,
                color: t.inkSoft,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Key achievements
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {PROFILE.keyAchievements.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: t.creamSoft,
                    border: `1px solid ${t.line}`,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: t.copper100,
                      border: `1px solid ${t.copperSoft}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2.4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55, margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* 9. Trust footer — quiet by design (cream, no fill) so it doesn't
           visually compete with the Complete-Profile tile up top. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderRadius: 10,
            background: "transparent",
            border: `1px solid ${t.line}`,
          }}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.inkSoft} strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
            Your resume is analysed securely and never shared. Delete anytime.
          </span>
        </div>
      </div>
    </div>
  );
}
