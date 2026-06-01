/* HireStepX — HR Round design panels (DESIGN ONLY, canvas-local).
 *
 * Renders the HR-round-specific surfaces the production InterviewResult
 * doesn't have today. Lives ONLY in this canvas — InterviewResult.tsx is
 * untouched. Mirrors the pattern from _salary-design-panels.tsx so the
 * HR Round storyboard reads as its own product rather than a behavioral
 * variant.
 *
 * Architecture (top → bottom), all .nfr-panel style cards:
 *
 *   01. 7-Dimension Gate ........... how HR scored you across the 7 axes
 *   02. BGV Readiness .............. doc checklist for background verification
 *   03. Comp Floor / Target / Walk .. anchor bracket in ₹ for the real round
 *   04. Notice-period Buyout Math .. days × per-diem with signing-bonus offset
 *   05. Counter-offer Hold-Firm .... the line to deliver if current emp counters
 *
 * Tokens are inlined (no shared module) to match the salary panels file.
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
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Satoshi', system-ui, sans-serif";
const SERIF = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";

/* ─── Types ────────────────────────────────────────────────────── */

export interface DimensionRow {
  /** One of the 7 HR-analyzer dimensions. */
  name: string;
  /** Candidate's score on this dimension, 0–5. */
  score: number;
  /** Role-cohort average for the same dimension, 0–5. */
  roleAvg: number;
  /** Round-over-round delta. Positive = improved. */
  delta: number;
  /** Mark the single weakest dimension to draw the eye. */
  weakest?: boolean;
}

export interface BgvDocRow {
  label: string;
  /** "have" → ready · "missing" → blocker · "partial" → some periods missing */
  status: "have" | "missing" | "partial";
  note?: string;
}

export interface CompBracket {
  floor: string;   // e.g. "₹32L"
  target: string;  // e.g. "₹38L"
  walk: string;    // e.g. "₹28L"
  floorWhy: string;
  targetWhy: string;
  walkWhy: string;
}

export interface NoticeBuyout {
  noticeDays: number;        // 60
  baseLakhs: number;         // 28
  perDiemRupees: number;     // computed → shown for transparency
  buyoutLakhs: number;       // computed
  signingOffsetLakhs: number;// what the new co will absorb
  netOutOfPocketLakhs: number;
}

export interface CounterOfferScript {
  triggerLine: string;
  responseLine: string;
  whyItWorks: string;
}

export interface MotivationRewrite {
  before: string;
  after: string;
  whyBetter: string[];
}

export interface StabilityStint {
  company: string;
  duration: string;
  oneLineFrame: string;
}

export interface EsopBullet {
  term: string;       // e.g. "Cliff"
  definition: string; // e.g. "1-year minimum before any stock vests"
  whyHrCares: string; // e.g. "HR asks this to test if you'll bolt at month 11"
}

export interface SessionArcRow {
  /** Dimension being tracked across sessions. */
  dimension: string;
  /** One score per past session, oldest → newest, 0–5. */
  scores: number[];
  /** Plain-English read: "plateau", "climbing", "regressed", "spiky". */
  pattern: "plateau" | "climbing" | "regressed" | "spiky" | "new";
  /** Short coaching line tied to the pattern. */
  read: string;
}

export interface CrossSessionArc {
  sessionsAnalyzed: number;
  /** 3–4 dimensions to surface. Don't show all 7 — overwhelming. */
  rows: SessionArcRow[];
  /** The single takeaway: which dim is the plateau-breaker for next session. */
  plateauBreaker: string;
}

export interface FutureState {
  /** Projected overall score after fixing the listed dims. */
  projectedScore: number;
  outOf: number;
  /** Net delta from current — the promise of the drill plan. */
  delta: number;
  /** Verdict the projected score would unlock. */
  projectedVerdict: string;
  /** Which dims this assumes you fix (matches drill cards). */
  assumes: string[];
}

export interface WinRow {
  headline: string;
  body: string;
  evidence: string; // short quote from transcript / answer
}

export interface HrProbe {
  index: number;
  hrAsked: string;
  /** What the candidate actually said. May include {{vague:…}} / {{strong:…}}
      tagged spans — see renderTaggedAnswer below. */
  youSaid: string;
  whatHrHeard: string;
  whatWouldHaveLanded: string;
  /** Dimensions this probe tested (chips above the card). */
  dimensions: string[];
  /** Top flag triggered by this probe. */
  flag: { tone: "bad" | "warn"; label: string };
}

export interface DrillCta {
  daysUntilRound: number;
  weakest: { label: string; dimension: string }[]; // 3 items
}

export interface ReconcileBridge {
  overallScore: number;       // 42
  outOf: number;              // 100
  failingDims: number;        // 3
  totalDims: number;          // 7
  verdict: string;            // "No Hire"
  oneLine: string;            // explainer tying the two numbers
}

export interface HrDesignPreset {
  reconcile: ReconcileBridge;
  dimensions: DimensionRow[];
  bgv: BgvDocRow[];
  comp: CompBracket;
  notice: NoticeBuyout;
  counterOffer: CounterOfferScript;
  motivationRewrite: MotivationRewrite;
  stabilityArc: StabilityStint[];
  esop: EsopBullet[];
  probes: HrProbe[];
  wins: WinRow[];
  arc: CrossSessionArc;
  future: FutureState;
  drill: DrillCta;
}

/* ─── Shared primitives ───────────────────────────────────────── */

function Eyebrow({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: COPPER,
          marginBottom: 6,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 24,
          color: COAL,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, marginTop: 6, maxWidth: 720 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        padding: 24,
        boxShadow: "0 1px 0 rgba(14,12,8,0.02), 0 4px 14px rgba(14,12,8,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "bad" | "warn" | "indigo";
}) {
  const palette: Record<string, { bg: string; fg: string; bd: string }> = {
    default: { bg: CREAM_SOFT, fg: COAL, bd: LINE },
    good: { bg: SUCCESS_SOFT, fg: SUCCESS, bd: SUCCESS_SOFT },
    bad: { bg: ERROR_SOFT, fg: ERROR, bd: ERROR_SOFT },
    warn: { bg: COPPER_SOFT, fg: COPPER, bd: COPPER_SOFT },
    indigo: { bg: INDIGO_SOFT, fg: INDIGO, bd: INDIGO_SOFT },
  };
  const c = palette[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

/* ─── 01 · 7-Dimension Gate ───────────────────────────────────── */

function DimensionGate({ rows }: { rows: DimensionRow[] }) {
  return (
    <Panel>
      <Eyebrow
        kicker="THE 7-DIMENSION GATE"
        title="How HR scored you"
        sub="HR uses 7 axes, not one. You need to clear ≥3/5 on every axis — one zero anywhere often kills the offer."
      />
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const pct = (r.score / 5) * 100;
          const avgPct = (r.roleAvg / 5) * 100;
          const deltaTone: "good" | "bad" | "default" =
            r.delta > 0 ? "good" : r.delta < 0 ? "bad" : "default";
          const deltaGlyph = r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "—";
          return (
            <div
              key={r.name}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto auto",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: SANS, fontSize: 14, color: COAL, fontWeight: 500 }}>
                  {r.name}
                </span>
                {r.weakest && <Pill tone="bad">Weakest</Pill>}
              </div>
              <div style={{ position: "relative", height: 8, background: CREAM_SOFT, borderRadius: 999 }}>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${INDIGO}, #4F46E5)`,
                  }}
                />
                {/* role-avg marker */}
                <div
                  title={`Role avg ${r.roleAvg}/5`}
                  style={{
                    position: "absolute",
                    top: -3,
                    left: `${avgPct}%`,
                    width: 2,
                    height: 14,
                    background: COAL,
                    opacity: 0.55,
                  }}
                />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: COAL, minWidth: 36, textAlign: "right" }}>
                {r.score}/5
              </span>
              <Pill tone={deltaTone}>
                {deltaGlyph} {r.delta > 0 ? `+${r.delta}` : r.delta === 0 ? "0" : r.delta}
              </Pill>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px dashed ${LINE_STRONG}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: SANS,
          fontSize: 12,
          color: INK_SOFT,
        }}
      >
        <span style={{ display: "inline-block", width: 2, height: 12, background: COAL, opacity: 0.55 }} />
        Role-avg marker · indigo bar = your score · pill = round-over-round delta
      </div>
    </Panel>
  );
}

/* ─── 02 · BGV Readiness ──────────────────────────────────────── */

function BgvChecklist({ rows }: { rows: BgvDocRow[] }) {
  const missing = rows.filter((r) => r.status === "missing").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  return (
    <Panel>
      <Eyebrow
        kicker="COMPLIANCE · BGV READINESS"
        title="6 documents the background check will ask for"
        sub="Indian BGV firms (AuthBridge, FirstAdvantage, OnGrid) almost always pull these. A single missing doc can stall the joining date by 2–4 weeks."
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Pill tone={missing > 0 ? "bad" : "good"}>{missing} missing</Pill>
        <Pill tone={partial > 0 ? "warn" : "good"}>{partial} partial</Pill>
        <Pill tone="good">{rows.length - missing - partial} ready</Pill>
      </div>
      <div style={{ display: "grid", gap: 0 }}>
        {rows.map((r, i) => {
          const glyph = r.status === "have" ? "✓" : r.status === "missing" ? "✗" : "─";
          const glyphColor = r.status === "have" ? SUCCESS : r.status === "missing" ? ERROR : COPPER;
          return (
            <div
              key={r.label}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr auto",
                alignItems: "center",
                gap: 14,
                padding: "12px 0",
                borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 16,
                  fontWeight: 700,
                  color: glyphColor,
                  textAlign: "center",
                }}
              >
                {glyph}
              </span>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 14, color: COAL, fontWeight: 500 }}>
                  {r.label}
                </div>
                {r.note && (
                  <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, marginTop: 2 }}>
                    {r.note}
                  </div>
                )}
              </div>
              {r.status === "missing" && <Pill tone="bad">Blocker</Pill>}
              {r.status === "partial" && <Pill tone="warn">Patchy</Pill>}
              {r.status === "have" && <Pill tone="good">Ready</Pill>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ─── 03 · Comp Floor / Target / Walk-away ────────────────────── */

function CompFloorTargetWalk({ comp }: { comp: CompBracket }) {
  const cells = [
    { label: "Floor", value: comp.floor, why: comp.floorWhy, tone: COPPER, bg: COPPER_SOFT },
    { label: "Target", value: comp.target, why: comp.targetWhy, tone: INDIGO, bg: INDIGO_SOFT },
    { label: "Walk-away", value: comp.walk, why: comp.walkWhy, tone: ERROR, bg: ERROR_SOFT },
  ];
  return (
    <Panel>
      <Eyebrow
        kicker="COMP · ANCHOR BRACKET"
        title="Your floor, target, and walk-away — in ₹"
        sub="Walk in with three numbers, not one. If HR pushes below the floor you say 'I'd need to think', and below walk-away you decline."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {cells.map((c) => (
          <div
            key={c.label}
            style={{
              background: c.bg,
              border: `1px solid ${c.tone}33`,
              borderRadius: 12,
              padding: 18,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: c.tone,
                marginBottom: 8,
              }}
            >
              {c.label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 28, color: COAL, fontWeight: 700, marginBottom: 8 }}>
              {c.value}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, lineHeight: 1.4 }}>
              {c.why}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 04 · Notice-period Buyout Math ──────────────────────────── */

function NoticeBuyoutPanel({ n }: { n: NoticeBuyout }) {
  return (
    <Panel>
      <Eyebrow
        kicker="LOGISTICS · NOTICE BUYOUT"
        title="What it'll cost to leave on day 30 instead of day 60"
        sub="Most product unicorns will absorb buyout via signing bonus — but only if you ask. The math also tells you whether to negotiate it."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {/* Math display */}
        <div
          style={{
            background: CREAM_SOFT,
            border: `1px solid ${LINE}`,
            borderRadius: 12,
            padding: 18,
            fontFamily: MONO,
          }}
        >
          <Row k="Notice contracted" v={`${n.noticeDays} days`} />
          <Row k="Current base" v={`₹${n.baseLakhs}L / yr`} />
          <Row k="Per-diem (base ÷ 365)" v={`₹${n.perDiemRupees.toLocaleString("en-IN")}/day`} />
          <Row
            k={`Buyout (${n.noticeDays}d × per-diem)`}
            v={`₹${n.buyoutLakhs.toFixed(1)}L`}
            heavy
          />
          <div style={{ height: 10 }} />
          <Row k="Signing-bonus offset" v={`−₹${n.signingOffsetLakhs.toFixed(1)}L`} tone="success" />
          <div
            style={{
              borderTop: `1px dashed ${LINE_STRONG}`,
              marginTop: 8,
              paddingTop: 10,
            }}
          >
            <Row
              k="Net out-of-pocket"
              v={`₹${n.netOutOfPocketLakhs.toFixed(1)}L`}
              heavy
              tone={n.netOutOfPocketLakhs > 0 ? "error" : "success"}
            />
          </div>
        </div>
        {/* Negotiation lever */}
        <div
          style={{
            background: "#FFFFFF",
            border: `1px solid ${LINE}`,
            borderRadius: 12,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Pill tone="indigo">Ask for this</Pill>
          <div style={{ fontFamily: SERIF, fontSize: 19, color: COAL, lineHeight: 1.3 }}>
            "Can you cover the 60-day notice buyout as a signing bonus? Razorpay won't budge on early release."
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, lineHeight: 1.5 }}>
            Frames the buyout as a logistics problem, not a comp ask. Most TA teams have a signing-bonus
            envelope precisely for this — they'd rather pay ₹4–5L once than wait 30 extra days for you to join.
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Row({
  k,
  v,
  heavy,
  tone,
}: {
  k: string;
  v: string;
  heavy?: boolean;
  tone?: "success" | "error";
}) {
  const color = tone === "success" ? SUCCESS : tone === "error" ? ERROR : COAL;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        fontSize: heavy ? 14 : 12,
      }}
    >
      <span style={{ color: INK_SOFT }}>{k}</span>
      <span style={{ color, fontWeight: heavy ? 700 : 500 }}>{v}</span>
    </div>
  );
}

/* ─── 05 · Counter-offer Hold-Firm Script ─────────────────────── */

function CounterOfferPanel({ c }: { c: CounterOfferScript }) {
  return (
    <Panel>
      <Eyebrow
        kicker="COMMITMENT · COUNTER-OFFER HOLD"
        title="The line to deliver when your current employer counters"
        sub="HR's biggest fear after extending the offer: you take their offer to your current employer for a raise. They probe for this — your script needs to be ready."
      />
      <div
        style={{
          background: CREAM_SOFT,
          border: `1px solid ${LINE}`,
          borderLeft: `4px solid ${COPPER}`,
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: COPPER,
            marginBottom: 10,
          }}
        >
          If your current manager says…
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 18,
            color: COAL,
            lineHeight: 1.45,
            marginBottom: 16,
          }}
        >
          "{c.triggerLine}"
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: INDIGO,
            marginBottom: 10,
          }}
        >
          You say —
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 22,
            color: COAL,
            lineHeight: 1.4,
          }}
        >
          "{c.responseLine}"
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          fontFamily: SANS,
          fontSize: 13,
          color: INK_SOFT,
          lineHeight: 1.5,
        }}
      >
        <Pill tone="good">Why it works</Pill>
        <span>{c.whyItWorks}</span>
      </div>
    </Panel>
  );
}

/* ─── 00 · Reconcile bridge (top of HR stack) ─────────────────── */
/* Fixes the "two scores, no bridge" complaint from the audit:
   the user sees 42/100 on the generic hero and 3/7 dims failing in
   the chrome — this strip ties them together in one sentence. */

function ReconcileStrip({ r }: { r: ReconcileBridge }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${COAL} 0%, ${INDIGO} 100%)`,
        borderRadius: 14,
        padding: "22px 26px",
        color: "#FFFFFF",
        display: "grid",
        gridTemplateColumns: "auto 1px auto 1fr auto",
        gap: 22,
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#B8B5D4",
            marginBottom: 4,
          }}
        >
          Overall
        </div>
        <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>
          {r.overallScore}
          <span style={{ fontSize: 14, color: "#B8B5D4", marginLeft: 2 }}>/{r.outOf}</span>
        </div>
      </div>
      <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.18)" }} />
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#B8B5D4",
            marginBottom: 4,
          }}
        >
          Failing dims
        </div>
        <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: "#FCA5A5" }}>
          {r.failingDims}
          <span style={{ fontSize: 14, color: "#B8B5D4", marginLeft: 2 }}>/{r.totalDims}</span>
        </div>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: "#E5E2F2" }}>
        {r.oneLine}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: ERROR,
          color: "#FFFFFF",
          padding: "8px 12px",
          borderRadius: 999,
          whiteSpace: "nowrap",
        }}
      >
        {r.verdict}
      </div>
    </div>
  );
}

/* ─── 06 · Motivation rewrite — before vs after ───────────────── */

function MotivationRewritePanel({ m }: { m: MotivationRewrite }) {
  return (
    <Panel>
      <Eyebrow
        kicker="MOTIVATION · BEFORE → AFTER"
        title="Your 'why this company' — rewritten"
        sub="Motivation scored lowest (1/5). Generic answers ('great culture, great opportunity') signal you'll churn. This is the line that lands."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div
          style={{
            background: ERROR_SOFT,
            border: `1px solid ${ERROR}33`,
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: ERROR,
              marginBottom: 10,
            }}
          >
            Before · what you said
          </div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 17, color: COAL, lineHeight: 1.45 }}>
            "{m.before}"
          </div>
        </div>
        <div
          style={{
            background: SUCCESS_SOFT,
            border: `1px solid ${SUCCESS}33`,
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: SUCCESS,
              marginBottom: 10,
            }}
          >
            After · what HR wants to hear
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 17, color: COAL, lineHeight: 1.45 }}>
            "{m.after}"
          </div>
        </div>
      </div>
      <ul style={{ margin: "16px 0 0", paddingLeft: 18 }}>
        {m.whyBetter.map((b) => (
          <li key={b} style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, lineHeight: 1.55, marginBottom: 4 }}>
            {b}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ─── 07 · Stability narrative arc ────────────────────────────── */

function StabilityArcPanel({ stints }: { stints: StabilityStint[] }) {
  return (
    <Panel>
      <Eyebrow
        kicker="STABILITY · JOB-HOPPING ARC"
        title="Your 3-stint frame — one line per move"
        sub="HR sees the dates on your resume. If your shortest stint is under 18 months, they'll probe — your job is to make each move sound like progression, not flight."
      />
      <div style={{ display: "grid", gap: 0 }}>
        {stints.map((s, i) => (
          <div
            key={s.company}
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr",
              gap: 14,
              padding: "14px 0",
              borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: INDIGO_SOFT,
                color: INDIGO,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SERIF,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {i + 1}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: SANS, fontSize: 15, color: COAL, fontWeight: 600 }}>
                  {s.company}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT }}>{s.duration}</span>
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 15, color: COAL, lineHeight: 1.45, fontStyle: "italic" }}>
                "{s.oneLineFrame}"
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 08 · ESOP literacy ──────────────────────────────────────── */

function EsopLiteracyPanel({ bullets }: { bullets: EsopBullet[] }) {
  return (
    <Panel>
      <Eyebrow
        kicker="BENEFITS · ESOP LITERACY"
        title="Three terms HR expects you to know"
        sub="Benefits scored 2/5 — you used 'stock' and 'options' interchangeably. HR reads this as 'won't push back on a bad grant'. Land these three and you signal you know what you're being offered."
      />
      <div style={{ display: "grid", gap: 14 }}>
        {bullets.map((b) => (
          <div
            key={b.term}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 16,
              padding: "12px 14px",
              background: CREAM_SOFT,
              borderRadius: 10,
              border: `1px solid ${LINE}`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: INDIGO,
                  marginBottom: 4,
                }}
              >
                Term
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 18, color: COAL }}>{b.term}</div>
            </div>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: COAL, lineHeight: 1.5, marginBottom: 6 }}>
                {b.definition}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>
                <Pill tone="warn">HR probe</Pill> <span style={{ marginLeft: 6 }}>{b.whyHrCares}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 09 · Drill CTA (bottom of HR stack) ─────────────────────── */

function DrillCtaPanel({ d }: { d: DrillCta }) {
  return (
    <Panel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: COPPER,
              marginBottom: 6,
            }}
          >
            DRILL PLAN · {d.daysUntilRound} DAYS LEFT
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: COAL, lineHeight: 1.2, marginBottom: 4 }}>
            Re-drill the {d.weakest.length} weakest dimensions before then
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT }}>
            One 12-minute focused drill per dimension. We score on the same rubric so you can see the delta.
          </div>
        </div>
        <a
          href="#"
          style={{
            background: INDIGO,
            color: "#FFFFFF",
            padding: "12px 22px",
            borderRadius: 10,
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Start drill plan →
        </a>
      </div>
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: `repeat(${d.weakest.length}, 1fr)`,
          gap: 10,
        }}
      >
        {d.weakest.map((w, i) => (
          <div
            key={w.label}
            style={{
              background: CREAM_SOFT,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: ERROR,
                marginBottom: 6,
              }}
            >
              Drill {i + 1} · {w.dimension}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: COAL, lineHeight: 1.4 }}>
              {w.label}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 10 · Probe-by-probe review (HR shape) ──────────────────── */
/* Replaces the generic q-card from InterviewResult when hrPanels is
   set. Same content shape, but each probe is tagged with the HR
   dimensions it tested — closes the audit gap "probe cards don't
   say which dimension they tested". */

function renderTagged(text: string) {
  /* Inline {{vague:…}} (copper-tinted) and {{strong:…}} (green-tinted)
     spans inside an otherwise plain string. Keeps probe authoring legible
     while still giving us highlight spans on the rendered card. */
  const parts: React.ReactNode[] = [];
  const re = /\{\{(vague|strong):([^}]+)\}\}/g;
  let i = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push(<span key={k++}>{text.slice(i, m.index)}</span>);
    const tone = m[1] === "vague";
    parts.push(
      <span
        key={k++}
        style={{
          background: tone ? COPPER_SOFT : SUCCESS_SOFT,
          color: tone ? COPPER : SUCCESS,
          padding: "1px 5px",
          borderRadius: 4,
          fontWeight: 500,
        }}
      >
        {m[2]}
      </span>,
    );
    i = m.index + m[0].length;
  }
  if (i < text.length) parts.push(<span key={k++}>{text.slice(i)}</span>);
  return parts;
}

function ProbeReviewPanel({ probes }: { probes: HrProbe[] }) {
  return (
    <Panel>
      <Eyebrow
        kicker="TURN-BY-TURN · HR SHAPE"
        title="How each probe landed"
        sub="HR ASKED → YOU SAID → WHAT HR HEARD → WHAT WOULD HAVE LANDED. Each probe is tagged with the dimensions it tested, so you can see which dimension a miss came from."
      />
      <div style={{ display: "grid", gap: 18 }}>
        {probes.map((p) => (
          <div
            key={p.index}
            style={{
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              padding: 18,
              background: CREAM,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: 24,
                  color: COAL,
                  lineHeight: 1,
                  marginRight: 4,
                }}
              >
                ·0{p.index}
              </span>
              {p.dimensions.map((d) => (
                <Pill key={d} tone="indigo">{d}</Pill>
              ))}
              <Pill tone={p.flag.tone}>{p.flag.label}</Pill>
            </div>

            <ProbeRow kicker="HR asked" body={<span style={{ color: COAL }}>{p.hrAsked}</span>} accent={INK_SOFT} />
            <ProbeRow kicker="You said" body={<span style={{ fontStyle: "italic" }}>"{renderTagged(p.youSaid)}"</span>} accent={ERROR} />
            <ProbeRow kicker="What HR heard" body={<span>{p.whatHrHeard}</span>} accent={COPPER} />
            <ProbeRow
              kicker="What would have landed"
              body={<span style={{ fontFamily: SERIF, fontSize: 16, color: COAL, lineHeight: 1.5 }}>"{renderTagged(p.whatWouldHaveLanded)}"</span>}
              accent={SUCCESS}
              last
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ProbeRow({
  kicker,
  body,
  accent,
  last,
}: {
  kicker: string;
  body: React.ReactNode;
  accent: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: 14,
        padding: "10px 0",
        borderBottom: last ? "none" : `1px dashed ${LINE_STRONG}`,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: accent,
          paddingTop: 3,
        }}
      >
        {kicker}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 14, color: COAL, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

/* ─── Section band — colored chapter divider ─────────────────── */
/* Mirrors the salary-panels file: 12 panels are too many to scroll
   flat. Bands turn the report into 4 readable chapters. */

function SectionBand({
  num,
  label,
  title,
  accent,
}: {
  num: string;
  label: string;
  title: string;
  accent: string;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: -8,
        display: "flex",
        alignItems: "baseline",
        gap: 16,
        paddingBottom: 8,
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <span style={{ fontFamily: SERIF, fontSize: 30, color: accent, lineHeight: 1 }}>{num}</span>
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: accent,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 22, color: COAL, lineHeight: 1.15 }}>
          {title}
        </div>
      </div>
    </div>
  );
}

/* ─── 11 · Future-state simulator ─────────────────────────────── */

function FutureStatePanel({ f }: { f: FutureState }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, #0E0C08 0%, ${SUCCESS} 140%)`,
        borderRadius: 14,
        padding: 26,
        color: "#FFFFFF",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#B6E7C8",
            marginBottom: 6,
          }}
        >
          If you fix the {f.assumes.length} weakest dims
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 28, color: "#FFFFFF", lineHeight: 1.15, marginBottom: 10 }}>
          You land at <span style={{ color: "#BBF7D0" }}>{f.projectedScore}/{f.outOf}</span> — {f.projectedVerdict}.
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: "#D1FAE5", lineHeight: 1.5 }}>
          Same scenario, same panel, same probes — assuming you land the fixes for{" "}
          {f.assumes.join(" · ")}. The other 4 dims stay at their current score.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "#FCA5A5", marginBottom: 4 }}>
            NOW
          </div>
          <div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 700, color: "#FCA5A5" }}>
            {f.projectedScore - f.delta}
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 22, color: "#FFFFFF", opacity: 0.7 }}>→</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "#BBF7D0", marginBottom: 4 }}>
            AFTER DRILL
          </div>
          <div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 700, color: "#BBF7D0" }}>
            {f.projectedScore}
          </div>
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: "#FFFFFF",
            background: "rgba(34, 197, 94, 0.25)",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(187, 247, 208, 0.4)",
          }}
        >
          +{f.delta}
        </div>
      </div>
    </div>
  );
}

/* ─── Wins panel ──────────────────────────────────────────────── */

function WinsPanel({ wins }: { wins: WinRow[] }) {
  return (
    <Panel>
      <Eyebrow
        kicker="KEEP DOING"
        title="What HR will remember positively"
        sub="A No-Hire isn't a 0. These landed and you should keep them — the fixes below are on top of, not instead of, the wins."
      />
      <div style={{ display: "grid", gap: 0 }}>
        {wins.map((w, i) => (
          <div
            key={w.headline}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 14,
              alignItems: "start",
              padding: "14px 0",
              borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
            }}
          >
            <Pill tone="good">Win</Pill>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 17, color: COAL, lineHeight: 1.3, marginBottom: 6 }}>
                {w.headline}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, lineHeight: 1.55, marginBottom: 6 }}>
                {w.body}
              </div>
              <div
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: 13,
                  color: COAL,
                  background: SUCCESS_SOFT,
                  borderLeft: `3px solid ${SUCCESS}`,
                  padding: "6px 10px",
                  borderRadius: 4,
                }}
              >
                "{w.evidence}"
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── 12 · Cross-session trajectory ───────────────────────────── */
/* Ties the HR snapshot to HireStepX's spaced-repetition loop. Shows
   per-dimension scores across past sessions so the user can see what's
   plateauing — and which dim to break the plateau on next. */

function ArcSparkline({ scores, pattern }: { scores: number[]; pattern: SessionArcRow["pattern"] }) {
  /* Inline SVG sparkline, 5-step y-axis (0..5), 1 point per session. */
  const W = 140;
  const H = 32;
  const padX = 4;
  const padY = 4;
  if (scores.length === 0) return <div style={{ width: W, height: H }} />;
  const stepX = scores.length === 1 ? 0 : (W - padX * 2) / (scores.length - 1);
  const stroke =
    pattern === "climbing" ? SUCCESS
      : pattern === "regressed" ? ERROR
      : pattern === "plateau" ? COPPER
      : pattern === "spiky" ? INDIGO
      : INK_FAINT;
  const points = scores.map((s, i) => {
    const x = padX + i * stepX;
    const y = padY + (H - padY * 2) * (1 - s / 5);
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {/* baseline at 3/5 (HR floor) */}
      <line
        x1={padX}
        x2={W - padX}
        y1={padY + (H - padY * 2) * (1 - 3 / 5)}
        y2={padY + (H - padY * 2) * (1 - 3 / 5)}
        stroke={LINE_STRONG}
        strokeDasharray="2 3"
      />
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />
      ))}
      <circle cx={last[0]} cy={last[1]} r={4.5} fill="#FFFFFF" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}

function CrossSessionArcPanel({ arc }: { arc: CrossSessionArc }) {
  const patternLabel: Record<SessionArcRow["pattern"], { txt: string; tone: "good" | "bad" | "warn" | "indigo" | "default" }> = {
    climbing: { txt: "Climbing", tone: "good" },
    plateau: { txt: "Plateau", tone: "warn" },
    regressed: { txt: "Regressed", tone: "bad" },
    spiky: { txt: "Inconsistent", tone: "indigo" },
    new: { txt: "First read", tone: "default" },
  };
  return (
    <Panel>
      <Eyebrow
        kicker="SKILL ARC · LAST FEW SESSIONS"
        title={`Where you've plateaued — across your last ${arc.sessionsAnalyzed} HR rounds`}
        sub="One sparkline per dim. Dashed line = 3/5 floor (HR pass mark). One score below the line is fine — the same score below the line three sessions running is the plateau to break."
      />
      <div style={{ display: "grid", gap: 0 }}>
        {arc.rows.map((r, i) => (
          <div
            key={r.dimension}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 160px auto 1fr",
              alignItems: "center",
              gap: 16,
              padding: "14px 0",
              borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
            }}
          >
            <div style={{ fontFamily: SANS, fontSize: 14, color: COAL, fontWeight: 500 }}>{r.dimension}</div>
            <ArcSparkline scores={r.scores} pattern={r.pattern} />
            <Pill tone={patternLabel[r.pattern].tone}>{patternLabel[r.pattern].txt}</Pill>
            <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>{r.read}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: COPPER_SOFT,
          border: `1px solid ${COPPER}33`,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Pill tone="warn">Plateau-breaker</Pill>
        <span style={{ fontFamily: SERIF, fontSize: 16, color: COAL, lineHeight: 1.4 }}>
          For your next session, the single dim worth optimizing for is — <strong>{arc.plateauBreaker}</strong>.
        </span>
      </div>
    </Panel>
  );
}

/* ─── Composed export ─────────────────────────────────────────── */

export function HrDesignPanels({ preset }: { preset: HrDesignPreset }) {
  return (
    <div
      style={{
        background: CREAM,
        padding: "40px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        fontFamily: SANS,
      }}
    >
      <ReconcileStrip r={preset.reconcile} />

      <SectionBand num="01" label="Diagnose" title="Where you stand right now" accent={ERROR} />
      <DimensionGate rows={preset.dimensions} />
      <WinsPanel wins={preset.wins} />
      <CrossSessionArcPanel arc={preset.arc} />
      <ProbeReviewPanel probes={preset.probes} />

      <SectionBand num="02" label="Act before the offer" title="The 3 things HR is waiting on" accent={COPPER} />
      <BgvChecklist rows={preset.bgv} />
      <CompFloorTargetWalk comp={preset.comp} />
      <NoticeBuyoutPanel n={preset.notice} />
      <CounterOfferPanel c={preset.counterOffer} />

      <SectionBand num="03" label="Practice" title="Scripts to land cold in the real round" accent={INDIGO} />
      <MotivationRewritePanel m={preset.motivationRewrite} />
      <StabilityArcPanel stints={preset.stabilityArc} />
      <EsopLiteracyPanel bullets={preset.esop} />

      <SectionBand num="04" label="Next step" title="Where the drill plan takes you" accent={SUCCESS} />
      <FutureStatePanel f={preset.future} />
      <DrillCtaPanel d={preset.drill} />
    </div>
  );
}

/* ─── Preset for the HR_WEAK demo ─────────────────────────────── */

export const HR_WEAK_PRESET: HrDesignPreset = {
  reconcile: {
    overallScore: 42,
    outOf: 100,
    failingDims: 3,
    totalDims: 7,
    verdict: "No Hire",
    oneLine:
      "42/100 = 3 of 7 dimensions below the 3/5 floor (Compliance, Commitment, Motivation). Hero score and dim count agree — fix any one of the 3 and you cross the line.",
  },
  dimensions: [
    { name: "Logistics (notice, location)", score: 3, roleAvg: 4, delta: 0 },
    { name: "Comp (range, components)", score: 2, roleAvg: 4, delta: -1 },
    { name: "Stability (job-hopping arc)", score: 3, roleAvg: 4, delta: 0 },
    { name: "Compliance (BGV docs)", score: 1, roleAvg: 4, delta: -1, weakest: true },
    { name: "Commitment (counter-offer hold)", score: 2, roleAvg: 4, delta: -1 },
    { name: "Benefits literacy (ESOP, gratuity)", score: 2, roleAvg: 3, delta: 0 },
    { name: "Motivation (why this company)", score: 1, roleAvg: 4, delta: -2 },
  ],
  bgv: [
    { label: "Last-3-employer payslips", status: "missing", note: "Razorpay payslips from 2022 onward not downloaded" },
    { label: "UAN / PF passbook (continuous)", status: "have" },
    { label: "Form-16 (last 2 FYs)", status: "partial", note: "FY23 ✓ · FY24 pending from payroll" },
    { label: "Relieving letter from prior employer", status: "have" },
    { label: "Education marksheets (10th / 12th / degree)", status: "missing", note: "Degree provisional only — final not collected from college" },
    { label: "Permanent address proof (Aadhaar match)", status: "have" },
  ],
  comp: {
    floor: "₹32L",
    target: "₹38L",
    walk: "₹28L",
    floorWhy: "8th-percentile of the SDE-3 band at PhonePe per levels.fyi 2025; below this you're moving sideways net of ESOP refresh.",
    targetWhy: "Median of the band + 12% switching premium. Defensible with 'p50 + standard switch delta'.",
    walkWhy: "Flat to current ₹28L base. Below this and you've negotiated against yourself — better to stay and re-test in 6 months.",
  },
  notice: {
    noticeDays: 60,
    baseLakhs: 28,
    perDiemRupees: Math.round((28_00_000) / 365),
    buyoutLakhs: +((28_00_000 / 365) * 60 / 1_00_000).toFixed(1),
    signingOffsetLakhs: 4.0,
    netOutOfPocketLakhs: +(((28_00_000 / 365) * 60 / 1_00_000) - 4.0).toFixed(1),
  },
  counterOffer: {
    triggerLine: "What will it take to keep you? Tell me their number and I'll match it.",
    responseLine:
      "I appreciate that, but I've already given my word to PhonePe — and even if you matched the comp, the reason I'm moving is the 0-to-1 product lane, which you can't offer here. I'd rather leave on good terms than retract.",
    whyItWorks:
      "Closes the door on a bidding war (HR's exact fear), reframes the reason as growth not money, and protects the relationship — which protects your relieving letter.",
  },
  motivationRewrite: {
    before: "It's a great company with great opportunities, and I think it'd be a good next step for me.",
    after:
      "PhonePe's UPI-Lite expansion into tier-3 markets is the exact problem space I want to own next — your engineering blog on idempotency at festival peaks last month is the kind of debugging I'd want to be doing on day one.",
    whyBetter: [
      "Names a specific product line (UPI-Lite tier-3) — proves you researched past the careers page",
      "Cites a dated artifact (last month's blog post) — distinguishes you from candidates who say 'great culture'",
      "Anchors the motivation in the work, not the brand — HR reads 'won't churn when a recruiter calls'",
    ],
  },
  stabilityArc: [
    {
      company: "ThoughtWorks",
      duration: "2018 – 2020 · 2y",
      oneLineFrame: "Learned the playbook for shipping inside a delivery org — knew I needed product ownership next.",
    },
    {
      company: "Flipkart",
      duration: "2020 – 2022 · 1.5y",
      oneLineFrame: "Shipped 3 features on the seller-onboarding flow, then payments-org reorg moved my charter — took the Razorpay offer to stay in payments full-time.",
    },
    {
      company: "Razorpay",
      duration: "2022 – present · 3y",
      oneLineFrame: "Owned 0-to-1 on the recurring-payments product, scaled it to ₹400Cr GMV — now ready for the next 0-to-1 inside a larger surface area.",
    },
  ],
  esop: [
    {
      term: "Cliff",
      definition: "1-year minimum before any options vest — leave before then and you get zero, no matter what they granted.",
      whyHrCares: "If your story sounds like you'll bolt at month 11, they'll lower the grant.",
    },
    {
      term: "FMV (409A)",
      definition: "Fair Market Value — the per-share price the company's options are priced at this quarter. Decides the strike, decides the tax bill on exercise.",
      whyHrCares: "Asking for the current FMV signals you know to calculate paper-value vs cash. Not asking signals you'll over-weight the share count.",
    },
    {
      term: "Double-trigger acceleration",
      definition: "Unvested shares vest immediately only if both (a) the company is acquired AND (b) you're let go post-acquisition.",
      whyHrCares: "Standard in Indian unicorns — if it's missing from your grant letter, you negotiate it in. HR tests whether you know to ask.",
    },
  ],
  probes: [
    {
      index: 1,
      hrAsked: "Why are you leaving your current role?",
      youSaid:
        "Honestly, {{vague:my current manager doesn't really appreciate my work}}, and I think it's time to {{vague:explore new opportunities and a better culture}}.",
      whatHrHeard:
        "Grievance-led framing. Reads as 'this person will badmouth us in 18 months too.' No forward-looking reason given. No PhonePe-specific signal — could be any company.",
      whatWouldHaveLanded:
        "I've shipped {{strong:3 major releases as PM at Razorpay}} and learned the playbook for scaling a maturing product. The next stage I'm looking for is owning a {{strong:0-to-1 lane in payments}} — which my current company can't offer because we're past that phase. PhonePe's {{strong:UPI-Lite expansion into tier-3}} is the exact problem space I want to be in.",
      dimensions: ["Motivation", "Stability"],
      flag: { tone: "bad", label: "Blame-tone · HIGH" },
    },
    {
      index: 2,
      hrAsked: "What's your notice period, and can you start sooner?",
      youSaid:
        "It's {{vague:60 days standard}}, and {{vague:I'll see what I can do}} about an earlier release.",
      whatHrHeard:
        "Hand-wave on logistics. No buyout math, no ask, no commitment. HR can't take this back to the hiring manager as 'joining on date X' — which delays the offer paperwork.",
      whatWouldHaveLanded:
        "Contracted notice is 60 days. {{strong:Buyout works out to ~₹4.6L at my current base}} — if PhonePe can absorb that as a signing bonus, I can commit to a {{strong:joining date of 30 days from offer signature}}. Otherwise I'd join on day 61.",
      dimensions: ["Logistics", "Commitment"],
      flag: { tone: "warn", label: "Unanchored · MED" },
    },
  ],
  wins: [
    {
      headline: "Anchored salary as a range, not a single number",
      body: "Most candidates blurt one number under pressure — you gave a 32–42L range with components. HR reads that as 'has negotiated before, won't be a surprise at offer stage.'",
      evidence: "I'd be looking at the 32 to 42 range, depending on how the ESOP grant looks at FMV.",
    },
    {
      headline: "Career trajectory was internally consistent",
      body: "Every move you described connected to the next — no orphan stints, no unexplained gaps. HR's stability dim gave you a 3/5 partly because of this.",
      evidence: "I joined Razorpay specifically to stay in payments after the Flipkart reorg moved my charter.",
    },
  ],
  arc: {
    sessionsAnalyzed: 4,
    rows: [
      {
        dimension: "Motivation (why this company)",
        scores: [1, 1, 2, 1],
        pattern: "plateau",
        read: "Stuck at the floor 3 sessions running. The rewrite drill is the leverage point — bigger lift here than anywhere else.",
      },
      {
        dimension: "Compliance (BGV readiness)",
        scores: [2, 1, 1, 1],
        pattern: "regressed",
        read: "Trending down — BGV doc gaps haven't been closed between sessions. This is a logistics problem, not a practice problem.",
      },
      {
        dimension: "Comp (range, components)",
        scores: [1, 2, 3, 2],
        pattern: "spiky",
        read: "You know the comp script when warmed up; you forget it under stress. Cold-open drill needed.",
      },
      {
        dimension: "Stability (job-hopping arc)",
        scores: [2, 3, 3, 3],
        pattern: "climbing",
        read: "Crossed the 3/5 floor last session and held it — your narrative arc is landing. Keep doing this.",
      },
    ],
    plateauBreaker: "Motivation",
  },
  future: {
    projectedScore: 72,
    outOf: 100,
    delta: 30,
    projectedVerdict: "Lean Hire",
    assumes: ["Motivation", "Compliance", "Commitment"],
  },
  drill: {
    daysUntilRound: 3,
    weakest: [
      { label: "Land the 'why PhonePe' rewrite", dimension: "Motivation" },
      { label: "Close the BGV doc gaps (payslips + marksheets)", dimension: "Compliance" },
      { label: "Deliver the counter-offer hold line cold", dimension: "Commitment" },
    ],
  },
};
