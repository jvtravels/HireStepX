/* HireStepX — Salary Negotiation design panels (DESIGN ONLY, canvas-local).
 *
 * Renders the negotiation-specific surfaces the production InterviewResult
 * doesn't have today. Lives ONLY in this canvas — InterviewResult.tsx is
 * untouched. Lets us pitch the full negotiation report vision visually
 * without shipping any production code.
 *
 * Architecture (top → bottom):
 *
 *   ┌─ TL;DR HERO ─────────────────────────────────────────────┐
 *   │  Single-glance summary: 4 big stats + 2-sentence verdict │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ┌─ SECTION: DIAGNOSIS · "What happened" ──────────────────┐
 *   │  01. Package decomposition (with per-row delta column)  │
 *   │  02. Phase ladder                                        │
 *   │  03. Concession analysis  ·  04. Anchor bracket health  │
 *   │  05. Verbal habits        ·  06. Silence map            │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ┌─ SECTION: ACTION · "What to do next" ───────────────────┐
 *   │  07. What you didn't ask  ·  08. Pre-call checklist      │
 *   │  09. Counter-offer letter draft (full width)             │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ┌─ SECTION: COHORT & MATH · "What it's worth" ────────────┐
 *   │  10. Cohort placement (with Indian-context signals)      │
 *   │  11. NPV math                                            │
 *   │  12. Counterparty research                               │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ┌─ SECTION: SKILL ARC · "Your trajectory" ────────────────┐
 *   │  13. Cross-session archetype (with session-arc strip)    │
 *   │  14. Personalised drill plan                             │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Improvements over v1:
 *   • Progressive sectioning — colored section bands break the
 *     14-panel scroll into 4 digestible chapters
 *   • TL;DR hero — single-glance summary so users who don't scroll
 *     still get the headline
 *   • Per-row ₹ delta column on package table
 *   • Indian-context cohort panel (women, college tier, joint-family)
 *   • Source attribution + freshness chips on data callouts
 *   • Clickable-styled timestamps with play affordance
 *   • Inline tooltips for negotiation-literacy gaps (BATNA, ESOP, etc.)
 *   • Session-arc strip on cross-session archetype panel
 */

import React from "react";

/* ─── Tokens ───────────────────────────────────────────────────── */

const COAL = "#0E0C08";
const INK_SOFT = "#6E6759";
const INK_FAINT = "#A39C8B";
const LINE = "#EBE5D2";
const LINE_STRONG = "#D6CDB5";
const CREAM = "#FAF7F0";
const CREAM_SOFT = "#F4EFE3";
const ERROR = "#B91C1C";
const ERROR_SOFT = "#FEE2E2";
const SUCCESS = "#15803D";
const SUCCESS_SOFT = "#DCFCE7";
const COPPER = "#B45309";
const COPPER_SOFT = "#FED7AA";
const INDIGO = "#312E81";
const INDIGO_SOFT = "#E5E2F2";
const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE9FE";
const TEAL = "#0F766E";
const TEAL_SOFT = "#CCFBF1";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Satoshi', system-ui, sans-serif";

/* ─── Types ────────────────────────────────────────────────────── */

interface PackageRow {
  lever: string;
  /* Glossary tooltip — first-time negotiators don't know what ESOP refresh
     or acceleration clause means. Inline expander above first use. */
  tooltip?: string;
  offer: string;
  counter: string;
  landing: string;
  marketRange: string;
  /* Per-row ₹ value impact over typical horizon (4 yrs). Lets users
     prioritize: which lever moved the most money? */
  delta: string;
  status: "won" | "missed" | "neutral";
}

interface Phase {
  num: number;
  name: string;
  reached: boolean;
  note?: string;
}

interface PushbackOutcome {
  pushback: string;
  outcome: "held" | "conceded" | "deflected";
  detail: string;
}

interface VerbalHabit {
  phrase: string;
  count: number;
  cost: string;
  timestamp?: string;
}

interface SilenceMoment {
  at: string;
  duration: string;
  context: string;
  healthy: boolean;
}

interface IndianContextSignal {
  label: string;
  body: string;
  applies: boolean;
  /* Cohort delta vs peers without this signal */
  cohortDelta?: string;
}

interface SessionPoint {
  label: string;
  score: number;
  highlight?: string;
}

interface TLDRStat {
  label: string;
  value: string;
  hint?: string;
  tone: "good" | "bad" | "warn" | "neutral";
}

export interface SalaryDesignPreset {
  /* TL;DR hero */
  tldrVerdict: string;
  tldrStats: TLDRStat[];
  /* Hero numbers (kept for legacy use in cohort panel) */
  walkAwayDelta: string;
  cohortPercentile: number;
  cohortLabel: string;
  cohortFreshness: string;
  /* Indian-context cohort signals */
  indianContext: IndianContextSignal[];
  /* Session-arc strip (for cross-session panel) */
  sessionArc: SessionPoint[];
  sessionArcMetric: string;
  /* Package decomposition rows */
  packageRows: PackageRow[];
  packageTotalDelta: string;
  /* Phase ladder */
  phases: Phase[];
  /* Concessions */
  pushbacks: PushbackOutcome[];
  concessionRate: string;
  /* Anchor bracket */
  anchorBracket: { type: "single" | "range" | "range_with_justification" | "none"; quote: string; verdict: string };
  /* Verbal habits */
  habits: VerbalHabit[];
  /* Silence map */
  silences: SilenceMoment[];
  /* What you didn't ask */
  unaskedLevers: { question: string; whyItMatters: string }[];
  /* Pre-call checklist */
  checklist: { item: string; ready: boolean }[];
  /* Counter-offer letter */
  counterOfferLetter: string;
  counterOfferLetterCommentary: string[];
  /* NPV math */
  npvMath: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[];
  /* Counterparty research */
  counterpartyCard: { fact: string; tone: "good" | "bad" | "neutral" }[];
  counterpartySource: string;
  /* Cross-session archetype */
  archetypeTitle: string;
  archetypeBody: string;
  archetypeFix: string;
  /* Drill plan */
  drills: { title: string; goal: string; effort: string }[];
  /* Disclosure leaks */
  disclosureLeaks: { at: string; leak: string; cost: string }[];
}

/* ─── Inline primitives ────────────────────────────────────────── */

function FreshnessChip({ source, n, asOf }: { source: string; n?: number; asOf: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        background: CREAM,
        border: `1px solid ${LINE}`,
        borderRadius: 999,
        fontSize: 10,
        fontFamily: MONO,
        color: INK_SOFT,
        letterSpacing: 0.3,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: SUCCESS }} />
      <span style={{ fontWeight: 600 }}>{source}</span>
      {typeof n === "number" && <span>· n={n}</span>}
      <span>· {asOf}</span>
    </div>
  );
}

function PlayableTime({ at }: { at: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        background: INDIGO_SOFT,
        color: INDIGO,
        borderRadius: 5,
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${INDIGO_SOFT}`,
      }}
      title="Jump to this moment in the recording"
    >
      <span style={{ fontSize: 9 }}>▶</span>
      {at}
    </span>
  );
}

function GlossaryTooltip({ term, def }: { term: string; def: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        cursor: "help",
        borderBottom: `1px dotted ${INK_FAINT}`,
      }}
      title={def}
    >
      {term}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: INK_FAINT,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: CREAM_SOFT,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 2,
          alignSelf: "center",
        }}
      >
        ?
      </span>
    </span>
  );
}

function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: INDIGO, fontFamily: MONO }}>
        {index}
      </span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COAL, letterSpacing: -0.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: INK_SOFT, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function Panel({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: padded ? 24 : 0,
        marginBottom: 24,
        boxShadow: "0 1px 2px rgba(14,12,8,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "bad" | "neutral" | "warn" }) {
  const map: Record<string, { bg: string; fg: string }> = {
    good: { bg: SUCCESS_SOFT, fg: SUCCESS },
    bad: { bg: ERROR_SOFT, fg: ERROR },
    warn: { bg: COPPER_SOFT, fg: COPPER },
    neutral: { bg: CREAM_SOFT, fg: COAL },
  };
  const style = map[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        background: style.bg,
        color: style.fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        borderRadius: 6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

/* ─── Section band — visually breaks the 14-panel scroll ─────── */

interface BandConfig {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  bg: string;
}

function SectionBand({ config }: { config: BandConfig }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 28px",
        background: config.bg,
        borderTop: `2px solid ${config.accent}`,
        borderBottom: `1px solid ${LINE}`,
        marginBottom: 24,
        marginLeft: -32,
        marginRight: -32,
        marginTop: 8,
      }}
    >
      <div
        style={{
          padding: "6px 12px",
          background: config.accent,
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.5,
          borderRadius: 4,
          textTransform: "uppercase",
          fontFamily: MONO,
        }}
      >
        {config.label}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COAL, letterSpacing: -0.2 }}>{config.title}</div>
        <div style={{ fontSize: 13, color: INK_SOFT, marginTop: 1 }}>{config.subtitle}</div>
      </div>
    </div>
  );
}

/* ─── 0. TL;DR hero — single glance summary ───────────────────── */

function TLDRHero({ verdict, stats }: { verdict: string; stats: TLDRStat[] }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${COAL} 0%, ${INDIGO} 100%)`,
        color: "#FFFFFF",
        borderRadius: 14,
        padding: "28px 32px",
        marginBottom: 28,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.6)",
          marginBottom: 12,
          fontFamily: MONO,
        }}
      >
        TL;DR · 30-SECOND READ
      </div>
      <div
        style={{
          fontSize: 18,
          lineHeight: 1.45,
          fontWeight: 500,
          marginBottom: 24,
          maxWidth: 820,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {verdict}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: 18,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {stats.map((s, i) => {
          const toneColor: Record<string, string> = {
            good: "#86EFAC",
            bad: "#FCA5A5",
            warn: "#FDBA74",
            neutral: "#FFFFFF",
          };
          return (
            <div key={i}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 6,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  fontFamily: MONO,
                  color: toneColor[s.tone],
                  letterSpacing: -0.5,
                  lineHeight: 1.1,
                }}
              >
                {s.value}
              </div>
              {s.hint && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{s.hint}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 1. Package decomposition table (with delta column) ───────── */

function PackageTable({ rows, totalDelta }: { rows: PackageRow[]; totalDelta: string }) {
  return (
    <Panel padded={false}>
      <div style={{ padding: "20px 24px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <SectionHeader
            index="01"
            title="Every part of the offer — what you negotiated, what you didn't"
            subtitle="A salary offer has 9+ moving parts (base, ESOPs, signing, etc.). The ₹ delta column shows what each one is worth over 4 years."
          />
          <FreshnessChip source="Levels.fyi · Indian fintechs" n={120} asOf="last 90d" />
        </div>
      </div>
      <div style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: 13 }}>
          <thead>
            <tr style={{ background: CREAM_SOFT }}>
              <th style={th}>Lever</th>
              <th style={{ ...th, textAlign: "right" }}>Their offer</th>
              <th style={{ ...th, textAlign: "right" }}>Your counter</th>
              <th style={{ ...th, textAlign: "right" }}>Likely landing</th>
              <th style={{ ...th, textAlign: "right" }}>Market p25–p75</th>
              <th style={{ ...th, textAlign: "right" }}>4-yr ₹ delta</th>
              <th style={{ ...th, textAlign: "center", width: 80 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={{ ...td, fontWeight: 500 }}>
                  {r.tooltip ? <GlossaryTooltip term={r.lever} def={r.tooltip} /> : r.lever}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: MONO, color: INK_SOFT }}>{r.offer}</td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: MONO,
                    fontWeight: 600,
                    color: r.status === "won" ? SUCCESS : r.status === "missed" ? ERROR : COAL,
                  }}
                >
                  {r.counter}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: MONO, color: COAL }}>{r.landing}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: MONO, color: INK_FAINT, fontSize: 12 }}>
                  {r.marketRange}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: r.delta.startsWith("+") ? SUCCESS : r.delta.startsWith("−") || r.delta.startsWith("-") ? ERROR : INK_FAINT,
                  }}
                >
                  {r.delta}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  {r.status === "won" && <Pill tone="good">Pulled</Pill>}
                  {r.status === "missed" && <Pill tone="bad">Missed</Pill>}
                  {r.status === "neutral" && <Pill tone="neutral">N/A</Pill>}
                </td>
              </tr>
            ))}
            <tr style={{ background: COAL, color: "#FFFFFF" }}>
              <td style={{ ...td, fontWeight: 700, color: "#FFFFFF" }}>Total package delta over 4 years</td>
              <td colSpan={4} />
              <td
                style={{
                  ...td,
                  textAlign: "right",
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 16,
                  color: totalDelta.startsWith("+") ? "#86EFAC" : "#FCA5A5",
                }}
              >
                {totalDelta}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
const th: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: INK_SOFT,
  textAlign: "left",
};
const td: React.CSSProperties = { padding: "12px 16px", fontSize: 13, color: COAL };

/* ─── 2. Phase ladder ──────────────────────────────────────────── */

function PhaseLadder({ phases }: { phases: Phase[] }) {
  const reached = phases.filter((p) => p.reached).length;
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="02"
          title="How far you got in the negotiation"
          subtitle="A strong negotiation moves through 6 stages — from reacting to the offer all the way to closing. We mark which stages you reached."
        />
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: MONO, color: reached >= 5 ? SUCCESS : reached >= 3 ? COPPER : ERROR, lineHeight: 1 }}>
            {reached}<span style={{ color: INK_FAINT, fontWeight: 500 }}> / 6</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: INK_SOFT, textTransform: "uppercase", marginTop: 4 }}>
            Phases reached
          </div>
        </div>
      </div>

      {/* Horizontal phase rail */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, marginTop: 8 }}>
        {phases.map((p) => (
          <div
            key={p.num}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: p.reached ? SUCCESS : LINE,
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {phases.map((p) => (
          <div
            key={p.num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 16px",
              background: p.reached ? SUCCESS_SOFT : CREAM_SOFT,
              border: `1px solid ${p.reached ? SUCCESS : LINE}`,
              borderRadius: 10,
              opacity: p.reached ? 1 : 0.55,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: p.reached ? SUCCESS : "#FFFFFF",
                color: p.reached ? "#FFFFFF" : INK_FAINT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: MONO,
                border: p.reached ? "none" : `1px solid ${LINE_STRONG}`,
              }}
            >
              {p.reached ? "✓" : p.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COAL }}>{p.name}</div>
              {p.note && <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>{p.note}</div>}
            </div>
            <Pill tone={p.reached ? "good" : "neutral"}>{p.reached ? "Reached" : "Not reached"}</Pill>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 11, color: INK_FAINT, fontStyle: "italic" }}>
        6-phase model from Black Swan Group + Levels.fyi negotiation outcome data (n=420 senior-band offers).
      </div>
    </Panel>
  );
}

/* ─── 3. Concession analysis ──────────────────────────────────── */

function ConcessionAnalysis({ pushbacks, rate }: { pushbacks: PushbackOutcome[]; rate: string }) {
  return (
    <Panel>
      <SectionHeader
        index="03"
        title="When they pushed back, did you fold?"
        subtitle={`How you handled each pushback: ${rate}`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pushbacks.map((p, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              padding: "12px 16px",
              background: CREAM_SOFT,
              borderLeft: `3px solid ${
                p.outcome === "held" ? SUCCESS : p.outcome === "deflected" ? COPPER : ERROR
              }`,
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COAL, marginBottom: 4 }}>"{p.pushback}"</div>
              <div style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>{p.detail}</div>
            </div>
            <div style={{ alignSelf: "flex-start" }}>
              <Pill tone={p.outcome === "held" ? "good" : p.outcome === "deflected" ? "warn" : "bad"}>
                {p.outcome}
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 4. Anchor bracket health ──────────────────────────────── */

function AnchorBracketHealth({ bracket }: { bracket: SalaryDesignPreset["anchorBracket"] }) {
  const map = {
    single: { label: "Single number", tone: "warn" as const, ladder: 1 },
    range: { label: "Range only", tone: "warn" as const, ladder: 2 },
    range_with_justification: { label: "Range + justification", tone: "good" as const, ladder: 3 },
    none: { label: "No counter", tone: "bad" as const, ladder: 0 },
  };
  const m = map[bracket.type];
  return (
    <Panel>
      <SectionHeader
        index="04"
        title="The way you named your number"
        subtitle="There are 4 ways to counter an offer — from weakest (no number) to strongest (a range you can defend with reasons)."
      />
      <div style={{ marginBottom: 14 }}>
        <Pill tone={m.tone}>{m.label}</Pill>
      </div>
      <div
        style={{
          padding: 14,
          background: CREAM_SOFT,
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 13,
          color: COAL,
          fontStyle: "italic",
          borderLeft: `3px solid ${LINE_STRONG}`,
        }}
      >
        "{bracket.quote}"
      </div>
      <div style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.55 }}>{bracket.verdict}</div>
      <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background:
                i <= m.ladder ? (m.tone === "good" ? SUCCESS : m.tone === "warn" ? COPPER : ERROR) : LINE,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: 10,
          color: INK_FAINT,
          letterSpacing: 0.4,
        }}
      >
        <span>NONE</span>
        <span>SINGLE</span>
        <span>RANGE</span>
        <span>RANGE + JUSTIFY</span>
      </div>
    </Panel>
  );
}

/* ─── 5. Verbal habits + disclosure leaks ─────────────────────── */

function VerbalHabits({
  habits,
  leaks,
}: {
  habits: VerbalHabit[];
  leaks: { at: string; leak: string; cost: string }[];
}) {
  return (
    <Panel>
      <SectionHeader
        index="05"
        title="Words you said that hurt your offer"
        subtitle="Phrases like 'I think', 'kind of', or 'sounds fair' make recruiters lower their offer. Click the timestamp to listen back."
      />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: INK_SOFT, marginBottom: 8 }}>
          TOP COSTLY PHRASES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {habits.map((h, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                background: CREAM_SOFT,
                borderRadius: 6,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: ERROR, minWidth: 32 }}>
                ×{h.count}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: COAL, fontFamily: MONO }}>"{h.phrase}"</div>
                <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 2 }}>{h.cost}</div>
              </div>
              {h.timestamp && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", maxWidth: 180 }}>
                  {h.timestamp.split("·").map((t, j) => (
                    <PlayableTime key={j} at={t.trim()} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {leaks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: ERROR, marginBottom: 8 }}>
            DISCLOSURE LEAKS · {leaks.length}
          </div>
          {leaks.map((l, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: ERROR_SOFT,
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: ERROR,
                  fontFamily: MONO,
                  marginBottom: 2,
                }}
              >
                <PlayableTime at={l.at} />
                <span>· {l.leak}</span>
              </div>
              <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 2 }}>{l.cost}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ─── 6. Silence map ──────────────────────────────────────────── */

function SilenceMap({ silences }: { silences: SilenceMoment[] }) {
  return (
    <Panel>
      <SectionHeader
        index="06"
        title="When you went quiet — and whether it helped"
        subtitle="Silence after you name a number is your friend. Silence when you should be pushing back is your enemy."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {silences.map((s, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 12,
              alignItems: "center",
              padding: "10px 14px",
              background: s.healthy ? SUCCESS_SOFT : ERROR_SOFT,
              borderRadius: 6,
            }}
          >
            <PlayableTime at={s.at} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COAL }}>{s.duration} silence</div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>{s.context}</div>
            </div>
            <Pill tone={s.healthy ? "good" : "bad"}>{s.healthy ? "Served you" : "Filled too fast"}</Pill>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 7. What you didn't ask ──────────────────────────────────── */

function UnaskedLevers({ levers }: { levers: { question: string; whyItMatters: string }[] }) {
  return (
    <Panel>
      <SectionHeader
        index="07"
        title="Questions you should have asked but didn't"
        subtitle="Each of these is a question that, if you'd asked, would likely have unlocked more money. We explain what each one is worth."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {levers.map((l, i) => (
          <div
            key={i}
            style={{
              paddingLeft: 14,
              borderLeft: `3px solid ${COPPER}`,
              padding: "8px 0 8px 14px",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: COAL, fontFamily: MONO, marginBottom: 4 }}>
              {l.question}
            </div>
            <div style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>{l.whyItMatters}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 8. Pre-call checklist ──────────────────────────────────── */

function PreCallChecklist({ items }: { items: { item: string; ready: boolean }[] }) {
  const ready = items.filter((i) => i.ready).length;
  return (
    <Panel>
      <SectionHeader
        index="08"
        title="Things to prepare before your real call"
        subtitle={`${ready} of ${items.length} ready. Tick off the rest before you negotiate for real.`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              background: it.ready ? SUCCESS_SOFT : CREAM_SOFT,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: it.ready ? SUCCESS : "#FFFFFF",
                border: `1px solid ${it.ready ? SUCCESS : LINE_STRONG}`,
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {it.ready ? "✓" : ""}
            </div>
            <div style={{ fontSize: 13, color: it.ready ? COAL : INK_SOFT }}>{it.item}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button style={smallBtn}>Send to phone</button>
        <button style={smallBtn}>Add to calendar</button>
      </div>
    </Panel>
  );
}
const smallBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  color: COAL,
  border: `1px solid ${LINE_STRONG}`,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: SANS,
};

/* ─── 9. Counter-offer letter ─────────────────────────────────── */

function CounterOfferLetter({
  letter,
  commentary,
}: {
  letter: string;
  commentary: string[];
}) {
  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Pill tone="good">MOST ACTIONABLE</Pill>
      </div>
      <SectionHeader
        index="09"
        title="Your counter-offer email — ready to send"
        subtitle="We wrote this from your call. Read through, edit a line or two, and send it to the recruiter."
      />
      <div
        style={{
          padding: 22,
          background: CREAM,
          border: `1px solid ${LINE_STRONG}`,
          borderRadius: 10,
          fontFamily: SANS,
          fontSize: 14,
          color: COAL,
          lineHeight: 1.65,
          whiteSpace: "pre-line",
          marginBottom: 16,
        }}
      >
        {letter}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: INK_SOFT, marginBottom: 8 }}>
          WHY THIS DRAFT
        </div>
        {commentary.map((c, i) => (
          <div key={i} style={{ fontSize: 13, color: COAL, marginBottom: 6, paddingLeft: 16, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color: INDIGO }}>·</span>
            {c}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button style={primaryBtn}>Copy as email</button>
        <button style={secondaryBtn}>Edit in your voice</button>
        <button style={secondaryBtn}>Show 2 alternatives</button>
        <button style={secondaryBtn}>Translate to Hindi</button>
      </div>
    </Panel>
  );
}
const primaryBtn: React.CSSProperties = {
  padding: "10px 18px",
  background: INDIGO,
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: SANS,
};
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "transparent",
  color: COAL,
  border: `1px solid ${LINE_STRONG}`,
};

/* ─── 10. Cohort placement (with Indian-context signals) ──────── */

function CohortPlacement({
  percentile,
  label,
  walkAwayDelta,
  freshness,
  indianContext,
}: {
  percentile: number;
  label: string;
  walkAwayDelta: string;
  freshness: string;
  indianContext: IndianContextSignal[];
}) {
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="10"
          title="Where your offer sits vs others like you"
          subtitle={label}
        />
        <FreshnessChip source="Levels.fyi · Senior EM band" n={12} asOf={freshness} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            fontFamily: MONO,
            color: percentile < 30 ? ERROR : percentile > 70 ? SUCCESS : COPPER,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          p{percentile}
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: percentile < 30 ? ERROR : percentile > 70 ? SUCCESS : COPPER,
            lineHeight: 1.2,
          }}
        >
          {percentile < 30
            ? `Bottom ${percentile}% of candidates`
            : percentile > 70
            ? `Top ${100 - percentile}% of candidates`
            : `Middle ${percentile}% of candidates`}
        </div>
      </div>
      <div style={{ fontSize: 13, color: INK_SOFT, marginBottom: 18 }}>
        We compared your offer to {12} candidates with the same role + level who got offers in the last 90 days.
      </div>
      <div
        style={{
          height: 12,
          background: LINE,
          borderRadius: 6,
          position: "relative",
          marginBottom: 8,
        }}
      >
        <div
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "25%", background: ERROR_SOFT, borderRadius: "6px 0 0 6px" }}
        />
        <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "50%", background: COPPER_SOFT }} />
        <div
          style={{ position: "absolute", left: "75%", top: 0, bottom: 0, right: 0, background: SUCCESS_SOFT, borderRadius: "0 6px 6px 0" }}
        />
        <div
          style={{
            position: "absolute",
            left: `${percentile}%`,
            top: -4,
            bottom: -4,
            width: 4,
            background: COAL,
            borderRadius: 2,
            transform: "translateX(-2px)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: INK_FAINT,
          fontFamily: MONO,
          letterSpacing: 0.4,
        }}
      >
        <span>p25 ₹44L</span>
        <span>p50 ₹49L</span>
        <span>p75 ₹54L</span>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          background: CREAM_SOFT,
          borderRadius: 8,
          fontSize: 13,
          color: COAL,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: INK_SOFT, marginBottom: 4 }}>
          WALK-AWAY DELTA
        </div>
        <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: COAL }}>{walkAwayDelta}</div>
      </div>

      {/* Indian-context cohort signals */}
      <div style={{ marginTop: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: INDIGO,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🇮🇳 INDIAN-CONTEXT SIGNALS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {indianContext.map((s, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: s.applies ? INDIGO_SOFT : CREAM_SOFT,
                border: `1px solid ${s.applies ? INDIGO : LINE}`,
                borderRadius: 8,
                opacity: s.applies ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: COAL }}>{s.label}</div>
                {s.cohortDelta && (
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: s.applies ? INDIGO : INK_FAINT }}>
                    {s.cohortDelta}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: INK_SOFT, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ─── 11. NPV math ────────────────────────────────────────────── */

function NPVMath({ rows }: { rows: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[] }) {
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="11"
          title="What this offer is really worth, after tax"
          subtitle="The headline ₹ number minus tax and inflation — the actual rupees that hit your bank account."
        />
        <FreshnessChip source="Indian tax slab · CY2026" asOf="updated Jan" />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: 13 }}>
        <tbody>
          {rows.map((r, i) => {
            const tone = r.tone === "bad" ? ERROR : r.tone === "good" ? SUCCESS : COAL;
            const isLast = i === rows.length - 1;
            return (
              <tr
                key={i}
                style={{
                  borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
                  background: isLast ? CREAM_SOFT : "transparent",
                }}
              >
                <td style={{ padding: "12px 8px", color: isLast ? COAL : INK_SOFT, fontWeight: isLast ? 700 : 400 }}>
                  {r.label}
                </td>
                <td
                  style={{
                    padding: "12px 8px",
                    textAlign: "right",
                    fontFamily: MONO,
                    fontWeight: isLast ? 800 : 600,
                    fontSize: isLast ? 16 : 13,
                    color: tone,
                  }}
                >
                  {r.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

/* ─── 12. Counterparty research ───────────────────────────────── */

function CounterpartyCard({
  facts,
  source,
}: {
  facts: { fact: string; tone: "good" | "bad" | "neutral" }[];
  source: string;
}) {
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="12"
          title="How this company usually negotiates"
          subtitle="What we've learned about PhonePe specifically — where they're flexible, where they're not."
        />
        <FreshnessChip source={source} asOf="last 30d" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {facts.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 14px",
              background: CREAM_SOFT,
              borderLeft: `3px solid ${f.tone === "good" ? SUCCESS : f.tone === "bad" ? ERROR : COPPER}`,
              borderRadius: 6,
              fontSize: 13,
              color: COAL,
              lineHeight: 1.55,
            }}
          >
            {f.fact}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 13. Cross-session archetype (with session-arc strip) ────── */

function ArchetypeCard({
  title,
  body,
  fix,
  arc,
  arcMetric,
}: {
  title: string;
  body: string;
  fix: string;
  arc: SessionPoint[];
  arcMetric: string;
}) {
  const max = Math.max(...arc.map((a) => a.score));
  return (
    <Panel>
      <SectionHeader
        index="13"
        title="The pattern we see across all your sessions"
        subtitle="What you keep getting right, and the one habit that keeps holding you back."
      />
      <div style={{ marginBottom: 14 }}>
        <Pill tone="warn">REPEATED PATTERN</Pill>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COAL, marginBottom: 10, letterSpacing: -0.2 }}>{title}</div>
      <div style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.6, marginBottom: 18 }}>{body}</div>

      {/* Session arc strip */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: INK_SOFT, marginBottom: 10 }}
        >
          {arcMetric.toUpperCase()} ACROSS SESSIONS
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${arc.length}, 1fr)`,
            gap: 10,
            alignItems: "end",
            height: 110,
          }}
        >
          {arc.map((p, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: MONO,
                  fontWeight: 700,
                  color: p.score < 35 ? ERROR : p.score > 70 ? SUCCESS : COPPER,
                }}
              >
                {p.score}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${(p.score / max) * 70 + 8}px`,
                  background:
                    p.score < 35 ? ERROR_SOFT : p.score > 70 ? SUCCESS_SOFT : COPPER_SOFT,
                  border: `1px solid ${p.score < 35 ? ERROR : p.score > 70 ? SUCCESS : COPPER}`,
                  borderRadius: "6px 6px 2px 2px",
                  position: "relative",
                }}
              />
              <div style={{ fontSize: 10, color: INK_SOFT, fontFamily: MONO, marginTop: 2 }}>{p.label}</div>
              {p.highlight && (
                <div
                  style={{
                    fontSize: 9,
                    color: INK_FAINT,
                    fontStyle: "italic",
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {p.highlight}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 14, background: SUCCESS_SOFT, borderRadius: 8, fontSize: 13, color: COAL }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: SUCCESS, marginBottom: 4 }}>
          THE FIX
        </div>
        {fix}
      </div>
    </Panel>
  );
}

/* ─── 14. Drill plan ──────────────────────────────────────────── */

function DrillPlan({ drills }: { drills: { title: string; goal: string; effort: string }[] }) {
  return (
    <Panel>
      <SectionHeader
        index="14"
        title="Three drills for the next 5 days"
        subtitle="Each drill targets one specific habit you can fix this week. Tap to start."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {drills.map((d, i) => (
          <div
            key={i}
            style={{
              padding: 18,
              background: CREAM_SOFT,
              borderRadius: 10,
              border: `1px solid ${LINE}`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  color: INDIGO,
                  fontFamily: MONO,
                }}
              >
                DRILL {i + 1}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: INK_FAINT,
                  fontFamily: MONO,
                  letterSpacing: 0.4,
                }}
              >
                {d.effort}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COAL, lineHeight: 1.3 }}>{d.title}</div>
            <div style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.5, flex: 1 }}>{d.goal}</div>
            <button
              style={{
                ...smallBtn,
                background: INDIGO,
                color: "#FFFFFF",
                border: "none",
                marginTop: 4,
                width: "100%",
              }}
            >
              Start drill →
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── Section configs ─────────────────────────────────────────── */

const BAND_DIAGNOSIS: BandConfig = {
  id: "diagnosis",
  label: "Part 1 of 4",
  title: "What happened in this call",
  subtitle: "Every moment that mattered — what you said, what you missed, what it cost.",
  accent: PURPLE,
  accentSoft: PURPLE_SOFT,
  bg: PURPLE_SOFT,
};
const BAND_ACTION: BandConfig = {
  id: "action",
  label: "Part 2 of 4",
  title: "What to do before your real round",
  subtitle: "A draft email you can send, a checklist for the next call, and the questions to ask.",
  accent: COPPER,
  accentSoft: COPPER_SOFT,
  bg: COPPER_SOFT,
};
const BAND_COHORT: BandConfig = {
  id: "cohort",
  label: "Part 3 of 4",
  title: "What it's worth in rupees",
  subtitle: "Where your offer sits vs others — and what accepting really costs after tax.",
  accent: TEAL,
  accentSoft: TEAL_SOFT,
  bg: TEAL_SOFT,
};
const BAND_ARC: BandConfig = {
  id: "arc",
  label: "Part 4 of 4",
  title: "Your pattern across sessions",
  subtitle: "What you keep doing right (and wrong), and the drills to break the pattern.",
  accent: INDIGO,
  accentSoft: INDIGO_SOFT,
  bg: INDIGO_SOFT,
};

/* ─── Top-level renderer ──────────────────────────────────────── */

export function SalaryDesignPanels({ preset }: { preset: SalaryDesignPreset }) {
  return (
    <div
      style={{
        background: CREAM,
        padding: "32px 32px 48px",
        fontFamily: SANS,
        borderTop: `1px solid ${LINE_STRONG}`,
        borderBottom: `1px solid ${LINE_STRONG}`,
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <Pill tone="warn">PROPOSED · NEGOTIATION-SPECIFIC PANELS</Pill>
        <div style={{ fontSize: 24, fontWeight: 700, color: COAL, marginTop: 10, letterSpacing: -0.4 }}>
          The full negotiation report
        </div>
        <div style={{ fontSize: 13, color: INK_SOFT, marginTop: 4, maxWidth: 720 }}>
          Surfaces below sit alongside the standard report — they don't replace it. Each panel turns one negotiation
          skill into a measurable signal you can act on.
        </div>
      </div>

      <TLDRHero verdict={preset.tldrVerdict} stats={preset.tldrStats} />

      <SectionBand config={BAND_DIAGNOSIS} />
      <PackageTable rows={preset.packageRows} totalDelta={preset.packageTotalDelta} />
      <PhaseLadder phases={preset.phases} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <ConcessionAnalysis pushbacks={preset.pushbacks} rate={preset.concessionRate} />
        <AnchorBracketHealth bracket={preset.anchorBracket} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <VerbalHabits habits={preset.habits} leaks={preset.disclosureLeaks} />
        <SilenceMap silences={preset.silences} />
      </div>

      <SectionBand config={BAND_ACTION} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <UnaskedLevers levers={preset.unaskedLevers} />
        <PreCallChecklist items={preset.checklist} />
      </div>
      <CounterOfferLetter letter={preset.counterOfferLetter} commentary={preset.counterOfferLetterCommentary} />

      <SectionBand config={BAND_COHORT} />
      <CohortPlacement
        percentile={preset.cohortPercentile}
        label={preset.cohortLabel}
        walkAwayDelta={preset.walkAwayDelta}
        freshness={preset.cohortFreshness}
        indianContext={preset.indianContext}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <NPVMath rows={preset.npvMath} />
        <CounterpartyCard facts={preset.counterpartyCard} source={preset.counterpartySource} />
      </div>

      <SectionBand config={BAND_ARC} />
      <ArchetypeCard
        title={preset.archetypeTitle}
        body={preset.archetypeBody}
        fix={preset.archetypeFix}
        arc={preset.sessionArc}
        arcMetric={preset.sessionArcMetric}
      />
      <DrillPlan drills={preset.drills} />
    </div>
  );
}

/* ─── Presets ──────────────────────────────────────────────────── */

const ESOP_TIP = "ESOP refresh = additional grant of stock options at year 2/3 to keep total comp competitive vs market.";
const ACCEL_TIP = "Acceleration clause = ESOPs vest immediately if the company gets acquired, preventing forfeiture.";
const VARIABLE_TIP = "Variable target with cap = max payout is the target %. With upside = can exceed target on overperformance.";
const NOTICE_TIP = "Notice period = days you must serve at current employer before joining. Lower is better for you.";

export const WEAK_PRESET: SalaryDesignPreset = {
  tldrVerdict:
    "You accepted ₹38L on the first offer. Comparable Senior EMs at fintechs land ₹46–55L this quarter — you walked away ~₹14L below the band, ~₹56L over a 4-year tenure. Zero counter, zero levers explored, one CTC disclosure that capped their anchor.",
  tldrStats: [
    { label: "What it cost you", value: "−₹57L", hint: "extra rupees you'd have earned over 4 years, after tax", tone: "bad" },
    { label: "How you ranked", value: "Bottom 18%", hint: "vs others who got the same offer", tone: "bad" },
    { label: "How far you got", value: "1 of 6 stages", hint: "stalled at the very first reaction", tone: "bad" },
    { label: "How much you pushed back", value: "0%", hint: "you didn't name a counter-number", tone: "bad" },
  ],
  walkAwayDelta: "−₹14L · −₹56L lifetime · −₹39L net of tax",
  cohortPercentile: 18,
  cohortLabel: "Senior EM at Indian fintechs · last 90 days · 12 offers landed",
  cohortFreshness: "as of last week",
  indianContext: [
    {
      label: "First-job-in-family premium",
      body: "Candidates without prior negotiation playbooks at home accept first offers 2.4× more often. Family + community pressure to 'take the job' is a measurable headwind.",
      applies: true,
      cohortDelta: "+34% accept rate",
    },
    {
      label: "Under-anchoring (women in tech)",
      body: "Women in Indian tech under-anchor 15–22% on initial counters. If applies to you, factor an additional +18% on your anchor before next round.",
      applies: false,
      cohortDelta: "−18%",
    },
    {
      label: "Tier-2/3 college acceptance speed",
      body: "Candidates from tier-2/3 colleges close negotiations 1.6× faster, typically leaving 8–12% on the table. Slower closes signal more leverage, not less interest.",
      applies: true,
      cohortDelta: "−11% landing",
    },
    {
      label: "Joint-family obligations",
      body: "If supporting siblings/parents, walk-away point shifts down — but counter-anchor shouldn't. Decouple the two before negotiating.",
      applies: true,
    },
  ],
  sessionArc: [
    { label: "S1", score: 25, highlight: "first session" },
    { label: "S2", score: 30 },
    { label: "S3", score: 35, highlight: "this session" },
  ],
  sessionArcMetric: "Anchoring discipline",
  packageRows: [
    { lever: "Base", offer: "₹38L", counter: "—", landing: "₹38L", marketRange: "₹44L–₹54L", delta: "−₹56L", status: "missed" },
    { lever: "Variable target %", tooltip: VARIABLE_TIP, offer: "12%", counter: "—", landing: "12%", marketRange: "15%–22%", delta: "−₹14L", status: "missed" },
    { lever: "ESOP grant", offer: "Default", counter: "—", landing: "Default", marketRange: "30K–50K units", delta: "−₹24L", status: "missed" },
    { lever: "ESOP refresh", tooltip: ESOP_TIP, offer: "—", counter: "—", landing: "—", marketRange: "Year 2 + 3", delta: "−₹10L", status: "missed" },
    { lever: "Signing bonus", offer: "—", counter: "—", landing: "₹0", marketRange: "₹3L–₹8L", delta: "−₹5L", status: "missed" },
    { lever: "Notice period", tooltip: NOTICE_TIP, offer: "60 days", counter: "—", landing: "60 days", marketRange: "30–60 days", delta: "−₹2L", status: "missed" },
    { lever: "WFH days", offer: "2 / wk", counter: "—", landing: "2 / wk", marketRange: "2–5 / wk", delta: "—", status: "missed" },
    { lever: "Joining bonus", offer: "—", counter: "—", landing: "₹0", marketRange: "₹2L–₹5L", delta: "−₹3L", status: "missed" },
    { lever: "Hardware budget", offer: "Default", counter: "—", landing: "Default", marketRange: "₹1.5L–₹3L", delta: "−₹2L", status: "missed" },
  ],
  packageTotalDelta: "−₹116L over 4 years",
  phases: [
    { num: 1, name: "Offer reaction", reached: true, note: "Said 'sounds fair' — pre-acceptance signal" },
    { num: 2, name: "Counter-anchor", reached: false, note: "No counter named" },
    { num: 3, name: "Justification", reached: false },
    { num: 4, name: "Pushback handling", reached: false },
    { num: 5, name: "Lever exploration", reached: false },
    { num: 6, name: "Closing", reached: false },
  ],
  pushbacks: [
    {
      pushback: "We think that's competitive for your level.",
      outcome: "conceded",
      detail: "Accepted within 8 seconds. No re-anchor, no question, no silence held.",
    },
  ],
  concessionRate: "1 / 1 pushes — folded immediately on the only test",
  anchorBracket: {
    type: "none",
    quote: "That sounds fair, let me think about it.",
    verdict:
      "No counter-anchor was named. Without a number, the recruiter's first offer becomes the ceiling. Even a vague range ('I was thinking mid-40s') would have shifted the negotiation surface.",
  },
  habits: [
    { phrase: "sounds fair", count: 1, cost: "Reads as pre-acceptance to recruiters", timestamp: "01:22" },
    { phrase: "let me think about it", count: 1, cost: "Closes the negotiation door before it opens", timestamp: "01:25" },
    { phrase: "honestly", count: 2, cost: "Hedge — telegraphs uncertainty", timestamp: "00:48 · 02:12" },
    { phrase: "I think", count: 3, cost: "Softener — undermines the claim that follows", timestamp: "00:54 · 01:15 · 02:08" },
    { phrase: "kind of", count: 1, cost: "Range-softener — invites the recruiter to pull lower", timestamp: "01:18" },
  ],
  silences: [
    { at: "01:22", duration: "0.8s", context: "After the offer was named — filled too fast with 'sounds fair'", healthy: false },
    { at: "02:34", duration: "1.1s", context: "After 'we think it's competitive' — filled too fast with 'okay'", healthy: false },
  ],
  unaskedLevers: [
    { question: "What's the variable target vs cap?", whyItMatters: "Some PhonePe variable plans cap at target; the strong ones have 1.5–2x upside. Worth ₹3–8L in good years." },
    { question: "Is the ESOP grant front-loaded or evenly vested?", whyItMatters: "Front-loaded vest (40/30/20/10) is worth ~15% more in NPV terms vs even vest. Always ask." },
    { question: "What's the refresh policy at year 2?", whyItMatters: "ESOP refresh is the single biggest retention lever. Verbal guidance from recruiter is worth ~₹6–10L over the vest." },
    { question: "Acceleration clause if the company gets acquired?", whyItMatters: "Prevents ESOP forfeiture in M&A. Default is none — must be negotiated explicitly." },
    { question: "How are L5 perf increments calculated?", whyItMatters: "Increment formulas vary 8–18% per level. Knowing this changes whether you accept now or wait for promo." },
    { question: "Signing bonus for an external Senior EM hire?", whyItMatters: "Signing isn't always offered — but it's offered when asked. Worth ₹3–8L at this level." },
  ],
  checklist: [
    { item: "BATNA in writing (competing offer letter, even draft)", ready: false },
    { item: "Walk-away point decided + written down", ready: false },
    { item: "Anchor + bracket prepared (range, not single number)", ready: false },
    { item: "3 levers ranked by personal priority", ready: false },
    { item: "Opening line rehearsed (anchor first, justification second)", ready: false },
    { item: "Disclosure deflection phrase rehearsed", ready: false },
    { item: "Silence drill — practised holding 4+ seconds without filling", ready: false },
  ],
  counterOfferLetter: `Hi <Recruiter>,

Thanks again for the offer at ₹38L base + 12% variable. I've taken some time to think it through against where I am in conversations elsewhere and against the market for Senior EM hires at fintechs this quarter.

Based on the cohort (₹46–54L base for comparable external hires this cycle), I was anchoring closer to ₹52L base + 15% variable, with an ESOP grant in the 40K range and a signing component to bridge the timing of my current vest.

I want to make this work — PhonePe is the team I want to join. A few questions that would help me close the gap:

  · What's the variable target vs cap? Is the 12% a target with upside or a cap?
  · For the ESOP grant — what's the standard for an external Senior EM hire, and what's the refresh policy at year 2?
  · Is signing a lever you have at this level for someone leaving an unvested ESOP balance behind?
  · What flexibility is there on WFH days?

Happy to jump on a call to walk through these. Looking forward to closing this together.

Best,
<Your name>`,
  counterOfferLetterCommentary: [
    "Counter-anchored with a specific number (₹52L) and a defended bracket — not single-point",
    "Implicit BATNA reference ('conversations elsewhere') without committing to a specific competing offer",
    "Decomposed the package into 4 levers — opens 4 negotiation surfaces, not 1",
    "Stayed collaborative — 'I want to make this work' invites them to defend, not dismiss",
    "Closes with a question, not a demand — keeps the door open for them to respond",
  ],
  npvMath: [
    { label: "What you missed in base salary over 4 years", value: "−₹56L", tone: "bad" },
    { label: "After 30% income tax", value: "−₹39L take-home", tone: "bad" },
    { label: "After 6% inflation (today's rupees)", value: "−₹33L", tone: "bad" },
    { label: "Plus ESOPs you didn't ask for", value: "−₹24L", tone: "bad" },
    { label: "Total: what accepting cost you", value: "−₹57L", tone: "bad" },
  ],
  counterpartyCard: [
    { fact: "PhonePe pays Senior EMs ₹46–58L base. They prefer giving stock options over signing bonuses.", tone: "neutral" },
    { fact: "Push harder than usual — after their recent merger, recruiters have less room to lose top candidates.", tone: "good" },
    { fact: "PhonePe's first counter is usually +9% above their original offer. There's typically another 6–12% you can still get.", tone: "good" },
    { fact: "Work-from-home is negotiable. They've gone from 2 → 4 days/week WFH for senior hires recently.", tone: "good" },
    { fact: "Their variable pay caps at the target — no upside. Push for higher base instead of higher variable.", tone: "bad" },
  ],
  counterpartySource: "Glassdoor + Levels.fyi + 18 user reports",
  archetypeTitle: "The Pre-Acceptor",
  archetypeBody:
    "Across your 3 negotiation sessions, the pattern is consistent: anchoring score averages 28/100, and you concede on the first soft pushback every time. The skill axis isn't 'pushback resilience' — it's the silence drill. You fill 0.8–1.4s gaps when the productive move is to hold 4+ seconds. This is the single highest-leverage habit to fix.",
  archetypeFix:
    "Spend the next 5 days on silence drills — record yourself responding to recruiter pushbacks and aim to hold 4+ seconds before responding. Three drills below are sequenced specifically for this archetype.",
  drills: [
    { title: "Silence-hold drill", goal: "After the recruiter says 'we think that's competitive,' hold silence for 4+ seconds before responding. Practice with a metronome.", effort: "10 min × 5 days" },
    { title: "Counter-anchor scripting", goal: "Write a 2-line counter-anchor for 5 different starting offers. Read aloud. Aim for specific number + bracket + justification in under 25 seconds.", effort: "30 min × 1" },
    { title: "Disclosure deflection", goal: "Practice 3 deflection lines for 'what's your current CTC?' Each frames the answer around BATNA, not history. Rehearse until automatic.", effort: "20 min × 2" },
  ],
  disclosureLeaks: [
    {
      at: "00:42",
      leak: "Mentioned current CTC (₹34L) when asked",
      cost: "Capped recruiter's anchor at ₹38L (+12%). Without disclosure, they'd have opened ~₹44L.",
    },
  ],
};

export const STRONG_PRESET: SalaryDesignPreset = {
  tldrVerdict:
    "You countered at ₹52L (+37% over their ₹38L), held silence 4.2s after the counter landed, conceded zero ground across 3 pushbacks, and surfaced 5 levers. Likely landing zone: ₹48–52L base + 40K ESOPs over 4 years = ~₹62L lifetime expected value. Top quartile for Senior EM at fintechs this cycle.",
  tldrStats: [
    { label: "What you won", value: "+₹62L", hint: "extra rupees over 4 years, after tax + stock options", tone: "good" },
    { label: "How you ranked", value: "Top 12%", hint: "vs others who got the same offer", tone: "good" },
    { label: "How far you got", value: "5 of 6 stages", hint: "one short of the close — keep going next time", tone: "warn" },
    { label: "How much you pushed back", value: "+37%", hint: "above their first offer — strong anchor", tone: "good" },
  ],
  walkAwayDelta: "+₹14L · +₹62L lifetime · +₹43L net of tax",
  cohortPercentile: 88,
  cohortLabel: "Senior EM at Indian fintechs · last 90 days · 12 offers landed · top quartile",
  cohortFreshness: "as of last week",
  indianContext: [
    {
      label: "First-job-in-family premium",
      body: "If this is your first family member negotiating tech offers, family pressure to accept can shift your walk-away. You did not show this signal in this session.",
      applies: false,
      cohortDelta: "+34% accept rate",
    },
    {
      label: "Under-anchoring (women in tech)",
      body: "Women in Indian tech under-anchor 15–22%. You countered at +37%, well above the at-risk band — strong signal.",
      applies: false,
      cohortDelta: "−18%",
    },
    {
      label: "Tier-1 college signal",
      body: "Tier-1 college candidates close 0.7× faster but anchor 12–18% higher. You're holding the right anchor for the cohort.",
      applies: true,
      cohortDelta: "+14% landing",
    },
    {
      label: "Senior IC vs people-mgmt premium",
      body: "Senior EM at Indian fintechs commands a 9–14% premium over Senior IC at the same band — your anchor reflects this; you're claiming the right premium.",
      applies: true,
      cohortDelta: "+11%",
    },
  ],
  sessionArc: [
    { label: "S1", score: 25, highlight: "accepted first offer" },
    { label: "S2", score: 65 },
    { label: "S3", score: 90, highlight: "this session" },
  ],
  sessionArcMetric: "Anchoring discipline",
  packageRows: [
    { lever: "Base", offer: "₹38L", counter: "₹52L", landing: "₹48L", marketRange: "₹44L–₹54L", delta: "+₹40L", status: "won" },
    { lever: "Variable target %", tooltip: VARIABLE_TIP, offer: "12%", counter: "15%", landing: "15%", marketRange: "15%–22%", delta: "+₹6L", status: "won" },
    { lever: "ESOP grant", offer: "30K", counter: "45K", landing: "40K units", marketRange: "30K–50K", delta: "+₹12L", status: "won" },
    { lever: "ESOP refresh", tooltip: ESOP_TIP, offer: "—", counter: "Year 2 + 3", landing: "Year 2 confirmed", marketRange: "Year 2 + 3", delta: "+₹6L", status: "won" },
    { lever: "Signing bonus", offer: "—", counter: "₹6L", landing: "₹4L", marketRange: "₹3L–₹8L", delta: "+₹4L", status: "won" },
    { lever: "Notice period", tooltip: NOTICE_TIP, offer: "60 days", counter: "30 days", landing: "45 days", marketRange: "30–60 days", delta: "+₹1L", status: "won" },
    { lever: "WFH days", offer: "2 / wk", counter: "4 / wk", landing: "3 / wk", marketRange: "2–5 / wk", delta: "Soft win", status: "won" },
    { lever: "Joining bonus", offer: "—", counter: "—", landing: "—", marketRange: "₹2L–₹5L", delta: "−₹3L", status: "missed" },
    { lever: "Hardware budget", offer: "Default", counter: "—", landing: "Default", marketRange: "₹1.5L–₹3L", delta: "−₹2L", status: "missed" },
  ],
  packageTotalDelta: "+₹64L over 4 years",
  phases: [
    { num: 1, name: "Offer reaction", reached: true, note: "Acknowledged + thanked + bought time" },
    { num: 2, name: "Counter-anchor", reached: true, note: "₹52L base + 15% variable, named in 25s" },
    { num: 3, name: "Justification", reached: true, note: "Cited market data + competing Razorpay conversation" },
    { num: 4, name: "Pushback handling", reached: true, note: "Held silence 4.2s after 'we can't go above ₹45L'" },
    { num: 5, name: "Lever exploration", reached: true, note: "5 levers opened: ESOPs, signing, notice, scope, WFH" },
    { num: 6, name: "Closing", reached: false, note: "Stalled before final close — decision rep needed" },
  ],
  pushbacks: [
    { pushback: "We think that's competitive for your level.", outcome: "held", detail: "Held silence 3.4s. Re-anchored at ₹52L with market-band justification." },
    { pushback: "We can't go above ₹45L base — that's our ceiling.", outcome: "deflected", detail: "Pivoted to lever exploration instead of conceding base. Opened 4 alternative surfaces." },
    { pushback: "What's your current CTC?", outcome: "deflected", detail: "Reframed as 'I'm anchored against my BATNA at ₹52L, not my current package.'" },
  ],
  concessionRate: "0 / 3 pushes — held all three; deflected the disclosure attempt",
  anchorBracket: {
    type: "range_with_justification",
    quote: "I was thinking ₹52L base + 15% variable — based on the cohort I'm seeing for Senior EM at fintechs this quarter, and where I am in conversations with Razorpay.",
    verdict:
      "Range with justification is the strongest anchor type. The number is specific (₹52L), the bracket is defended (cohort + competing offer), and the BATNA is implicit but real. Recruiters can't pull this anchor down without producing a counter-justification.",
  },
  habits: [
    { phrase: "Based on", count: 4, cost: "Productive — anchors every claim in evidence", timestamp: "01:32 · 02:08 · 04:14 · 06:22" },
    { phrase: "Help me make this work", count: 2, cost: "Productive — collaborative framing", timestamp: "03:45 · 08:12" },
    { phrase: "I'd be open to", count: 1, cost: "Concedes range — used once but caught and reframed", timestamp: "05:08" },
  ],
  silences: [
    { at: "01:38", duration: "4.2s", context: "After counter-anchor landed — let the number settle before justifying", healthy: true },
    { at: "03:22", duration: "3.4s", context: "After 'we can't go above ₹45L' pushback — held instead of conceding", healthy: true },
    { at: "06:08", duration: "2.8s", context: "After ESOP grant counter — gave recruiter time to respond", healthy: true },
  ],
  unaskedLevers: [
    { question: "Acceleration clause if the company gets acquired?", whyItMatters: "Prevents ESOP forfeiture in M&A. Default is none. Worth asking once — costs nothing." },
    { question: "Joining bonus to bridge unvested ESOPs at current employer?", whyItMatters: "You mentioned leaving unvested ESOPs — joining bonus is the standard offset. Range ₹2–5L." },
    { question: "Hardware + home-office stipend?", whyItMatters: "Standard at this level (₹1.5–3L). Cheap for the company, real value to you." },
  ],
  checklist: [
    { item: "BATNA in writing (competing offer letter, even draft)", ready: true },
    { item: "Walk-away point decided + written down", ready: true },
    { item: "Anchor + bracket prepared (range, not single number)", ready: true },
    { item: "3 levers ranked by personal priority", ready: true },
    { item: "Opening line rehearsed (anchor first, justification second)", ready: true },
    { item: "Disclosure deflection phrase rehearsed", ready: true },
    { item: "Silence drill — practised holding 4+ seconds without filling", ready: true },
  ],
  counterOfferLetter: `Hi <Recruiter>,

Thank you for the productive call yesterday. To capture where I think we landed and what's still open:

Base: ₹48L (up from ₹38L) · Variable: 15% target (up from 12%) · ESOPs: 40K units, 4-yr vest, 1-yr cliff · Signing: ₹4L · Notice: 45 days · WFH: 3 days/week.

This works for me, with one open thread: I'd like to confirm in writing the year-2 ESOP refresh you mentioned, and a one-line acceleration clause in the case of M&A — both standard at peer companies and important for me given the unvested balance I'm leaving behind at my current employer.

If you can send the formal offer with those two items added, I'm ready to sign Friday.

Best,
<Your name>`,
  counterOfferLetterCommentary: [
    "Recaps the agreed terms — locks them in writing before paperwork",
    "Asks for two specific items (refresh + acceleration) — both cost the company nothing but matter to you",
    "Names a closing date ('sign Friday') — gives the recruiter urgency and removes ambiguity",
    "Positions one ask as 'standard at peer companies' — the recruiter has cover for granting it",
    "Tone is closing, not negotiating — signals the conversation is wrapping",
  ],
  npvMath: [
    { label: "Extra base salary you won, over 4 years", value: "+₹56L", tone: "good" },
    { label: "After 30% income tax", value: "+₹39L take-home", tone: "good" },
    { label: "After 6% inflation (today's rupees)", value: "+₹33L", tone: "good" },
    { label: "Plus stock options at typical outcome", value: "+₹24L", tone: "good" },
    { label: "If the company's stock 4× in 4 years", value: "+₹95L", tone: "good" },
    { label: "Total: extra rupees you negotiated", value: "+₹57L", tone: "good" },
  ],
  counterpartyCard: [
    { fact: "PhonePe pays Senior EMs ₹46–58L base. They give stock options on a 4-year schedule with a 1-year wait.", tone: "neutral" },
    { fact: "You landed at ₹48L base — top end of the range for external hires this cycle.", tone: "good" },
    { fact: "You got 3 days WFH — one more than their default. The recruiter gave on a soft lever.", tone: "good" },
    { fact: "Year-2 ESOP refresh was confirmed by the recruiter on the call. Get it in writing before signing.", tone: "neutral" },
    { fact: "M&A acceleration clause isn't on paper yet. Ask for it before signing — it costs them nothing.", tone: "neutral" },
  ],
  counterpartySource: "Glassdoor + Levels.fyi + 18 user reports",
  archetypeTitle: "The Lever-Pull Closer",
  archetypeBody:
    "Across your 3 negotiation sessions, anchoring score has climbed from 25 → 65 → 90 — the most-improved skill axis in your prep. You now anchor with a defended range, hold silence post-counter, and pivot to lever exploration when base is capped. The remaining gap is closing discipline: in 2 of 3 sessions, you reach phase 5 (lever exploration) but stall before phase 6 (closing). This session continued that pattern.",
  archetypeFix:
    "Run 2 closing-rep drills — practising the 'recap + lock + close' move that converts an open negotiation into a signed offer. The drill plan below sequences this specifically.",
  drills: [
    { title: "Closing rep — recap + lock", goal: "Practice the 3-line close: recap agreed terms, name the 1–2 items still open, set a deadline. Aim for under 90 seconds.", effort: "20 min × 2" },
    { title: "Acceleration clause ask", goal: "Rehearse the 1-line ask for M&A acceleration. Frame as 'standard at peer companies' to give the recruiter cover. 3 versions.", effort: "10 min × 1" },
    { title: "Joining-bonus probe", goal: "Add the joining-bonus question to your phase-5 lever sweep. Practice the 'unvested ESOP offset' framing 3 times.", effort: "10 min × 1" },
  ],
  disclosureLeaks: [],
};
