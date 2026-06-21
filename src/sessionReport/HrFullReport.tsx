/* HireStepX — Full HR Round Report (production)
 *
 * Production equivalent of the canvas `_hr-design-panels.tsx`.
 * Mirrors the 4-section layout from the canvas design:
 *
 *   01 Diagnose   — dimension gate + wins + probe review
 *   02 Act        — notice logistics + comp anchor + BGV gaps + counter-offer
 *   03 Practice   — motivation rewrite
 *   04 Next step  — drill CTA
 *
 * Data sources:
 *   • `skills`       — 8 HR rubric dimensions scored by the evaluator
 *                      (evaluate-session overrides skillAxes for hr-round)
 *   • `wins`         — wins from report.wins (always present)
 *   • `questions`    — probe-by-probe review from report.perQuestion
 *   • `hrReport`     — motivation rewrite + logistics extracted from transcript
 *
 * All panels render with honest empty states — nothing is fabricated.
 * If a topic wasn't covered in the mock, that panel shows a coaching note
 * explaining what to cover in the real round. */

import type { HrReportData, Question, Skill } from "./types";
import { t, f } from "./tokens";
import { ReportCardShell, SectionBand } from "./panels/_primitives";

/* ─── Design tokens ─────────────────────────────────────────────────── */

const COAL = t.coal;
const INK_SOFT = t.inkSoft;
const LINE = t.line;
const LINE_STRONG = "#D6CDB5";
const CREAM = t.cream;
const CREAM_SOFT = "#F4EFE3";
const ERROR = "#B91C1C";
const ERROR_SOFT = "#FEE2E2";
const SUCCESS = "#15803D";
const SUCCESS_SOFT = "#DCFCE7";
const COPPER = "#B45309";
const COPPER_SOFT = "#FED7AA";
const INDIGO = "#312E81";
const INDIGO_SOFT = "#E5E2F2";
const MONO = f.mono;
const SANS = f.sans;
const SERIF = f.serif;

/* ─── Shared primitives ─────────────────────────────────────────────── */

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        padding: 24,
        boxShadow: "0 1px 0 rgba(14,12,8,0.02), 0 4px 14px rgba(14,12,8,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

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
      <div style={{ fontFamily: SERIF, fontSize: 22, color: COAL, lineHeight: 1.2, marginBottom: sub ? 6 : 0 }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, lineHeight: 1.55, maxWidth: 720 }}>
          {sub}
        </div>
      )}
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
  const c = palette[tone] ?? palette.default;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: CREAM_SOFT,
        border: `1px dashed ${LINE_STRONG}`,
        borderRadius: 10,
        padding: "14px 18px",
        fontFamily: SANS,
        fontSize: 13,
        color: INK_SOFT,
        lineHeight: 1.55,
      }}
    >
      {message}
    </div>
  );
}

/* ─── 01 · 7-Dimension Gate ─────────────────────────────────────────── */

function DimensionGate({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return (
      <Panel>
        <Eyebrow kicker="THE DIMENSION GATE" title="How HR scored you" />
        <EmptyState message="Dimension scores not available for this session. Re-run the session to get the full breakdown." />
      </Panel>
    );
  }
  // Score ≥ 60 is passing (3/5 equivalent on 0-100), < 60 is failing.
  const sorted = [...skills].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  return (
    <Panel>
      <Eyebrow
        kicker={`THE ${skills.length}-DIMENSION GATE`}
        title="How HR scored you"
        sub="HR uses multiple axes, not one. You need to clear ≥60/100 on every axis — one zero anywhere often kills the offer."
      />
      <div style={{ display: "grid", gap: 12 }}>
        {skills.map((skill) => {
          const pct = Math.max(0, Math.min(100, skill.score));
          const passing = pct >= 60;
          const isWeakest = skill.name === weakest?.name;
          return (
            <div
              key={skill.name}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr auto auto",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: SANS, fontSize: 13, color: COAL, fontWeight: 500 }}>
                  {skill.name}
                </span>
                {isWeakest && <Pill tone="bad">Weakest</Pill>}
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
                    background: passing
                      ? `linear-gradient(90deg, ${INDIGO}, #4F46E5)`
                      : `linear-gradient(90deg, ${ERROR}, #EF4444)`,
                  }}
                />
                {/* 60/100 floor marker */}
                <div
                  title="3/5 floor (HR pass mark)"
                  style={{
                    position: "absolute",
                    top: -3,
                    left: "60%",
                    width: 2,
                    height: 14,
                    background: COAL,
                    opacity: 0.4,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  color: passing ? INDIGO : ERROR,
                  minWidth: 36,
                  textAlign: "right",
                  fontWeight: 600,
                }}
              >
                {pct}/100
              </span>
              <Pill tone={passing ? "good" : "bad"}>{passing ? "Pass" : "Flag"}</Pill>
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
        <span style={{ display: "inline-block", width: 2, height: 12, background: COAL, opacity: 0.4 }} />
        Dashed line at 60 = pass floor · red bar = below floor
      </div>
    </Panel>
  );
}

/* ─── Wins panel ────────────────────────────────────────────────────── */

function WinsPanel({ wins }: { wins: string[] }) {
  if (wins.length === 0) return null;
  return (
    <Panel>
      <Eyebrow
        kicker="KEEP DOING"
        title="What HR will remember positively"
        sub="A No-Hire isn't a 0. These landed — the fixes are on top of, not instead of, the wins."
      />
      <div style={{ display: "grid", gap: 0 }}>
        {wins.map((win, i) => (
          <div
            key={i}
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
            <div style={{ fontFamily: SANS, fontSize: 14, color: COAL, lineHeight: 1.55 }}>{win}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── Probe-by-probe review ─────────────────────────────────────────── */

function ProbeReviewPanel({ questions }: { questions: Question[] }) {
  if (questions.length === 0) return null;
  return (
    <Panel>
      <Eyebrow
        kicker="TURN-BY-TURN · HR SHAPE"
        title="How each probe landed"
        sub="What HR asked · what you said · the likely follow-up. Each probe is tagged with its verdict."
      />
      <div style={{ display: "grid", gap: 16 }}>
        {questions.slice(0, 8).map((q, i) => {
          const bandColor =
            q.band === "strong" || q.band === "complete" ? SUCCESS :
            q.band === "partial" ? COPPER : ERROR;
          const bandTone = (q.band === "strong" || q.band === "complete" ? "good" : q.band === "partial" ? "warn" : "bad") as "good" | "warn" | "bad";
          return (
            <div
              key={q.index}
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: 12,
                padding: 18,
                background: CREAM,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: SERIF, fontSize: 22, color: COAL, lineHeight: 1 }}>
                  ·0{i + 1}
                </span>
                <Pill tone={bandTone}>{q.band}</Pill>
                <span style={{ fontFamily: MONO, fontSize: 11, color: bandColor, fontWeight: 700 }}>
                  {q.score}/100
                </span>
              </div>
              <ProbeRow
                kicker="HR asked"
                body={<span style={{ color: COAL }}>{q.text}</span>}
                accent={INK_SOFT}
              />
              {q.answer && q.answer.length > 0 && (
                <ProbeRow
                  kicker="You said"
                  body={
                    <span style={{ fontStyle: "italic" }}>
                      "{q.answer.map((s) => s.text).join("")}"
                    </span>
                  }
                  accent={bandColor}
                />
              )}
              {q.whyScored && (
                <ProbeRow
                  kicker="Coaching note"
                  body={<span>{q.whyScored}</span>}
                  accent={COPPER}
                />
              )}
              {q.likelyFollowUp && (
                <ProbeRow
                  kicker="Next probe likely"
                  body={
                    <span style={{ fontFamily: SERIF, fontSize: 15, color: COAL, lineHeight: 1.45 }}>
                      "{q.likelyFollowUp}"
                    </span>
                  }
                  accent={INDIGO}
                  last
                />
              )}
            </div>
          );
        })}
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
        gridTemplateColumns: "140px 1fr",
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
      <div style={{ fontFamily: SANS, fontSize: 13, color: COAL, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

/* ─── Notice logistics ──────────────────────────────────────────────── */

function NoticePanel({ hrReport }: { hrReport: HrReportData }) {
  const { noticeDays, noticeFlexibility, compExpected } = hrReport;
  const hasData = noticeDays !== null || compExpected;
  if (!hasData) {
    return (
      <Panel>
        <Eyebrow kicker="LOGISTICS · NOTICE & COMP" title="What you said about notice and salary" />
        <EmptyState message="Notice period and comp expectation weren't discussed clearly in this session. In your real round, anchor your notice days first, then give a CTC range with a brief rationale." />
      </Panel>
    );
  }
  const flexLabel =
    noticeFlexibility === "buyout-possible" ? "Can buy out" :
    noticeFlexibility === "strict" ? "Must serve full period" : "Not clarified";
  const flexTone = noticeFlexibility === "buyout-possible" ? "good" : noticeFlexibility === "strict" ? "warn" : "default";
  return (
    <Panel>
      <Eyebrow
        kicker="LOGISTICS · NOTICE & COMP"
        title="What you said about notice and salary"
        sub="HR needs both these committed before they write up the offer. Vague answers here stall the process."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {noticeDays !== null && (
          <div
            style={{
              background: CREAM_SOFT,
              border: `1px solid ${LINE}`,
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
                color: COPPER,
                marginBottom: 8,
              }}
            >
              Notice period
            </div>
            <div style={{ fontFamily: MONO, fontSize: 28, color: COAL, fontWeight: 700, marginBottom: 8 }}>
              {noticeDays}d
            </div>
            <Pill tone={flexTone as "default" | "good" | "bad" | "warn" | "indigo"}>{flexLabel}</Pill>
            {noticeFlexibility === "buyout-possible" && (
              <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, marginTop: 10, lineHeight: 1.5 }}>
                Good — you flagged flexibility. In the real round, ask if they can absorb it as a signing bonus.
              </div>
            )}
            {noticeFlexibility === "strict" && (
              <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, marginTop: 10, lineHeight: 1.5 }}>
                If the company needs you sooner, be ready to ask whether they'll cover a buyout via signing bonus.
              </div>
            )}
          </div>
        )}
        {compExpected && (
          <div
            style={{
              background: INDIGO_SOFT,
              border: `1px solid ${INDIGO}33`,
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
                color: INDIGO,
                marginBottom: 8,
              }}
            >
              Comp expectation
            </div>
            <div style={{ fontFamily: MONO, fontSize: 24, color: COAL, fontWeight: 700, marginBottom: 8 }}>
              {compExpected}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>
              Anchor: give a range, not a single number. Include a 1-line rationale ("market data + current base + switching premium").
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ─── BGV gaps panel ────────────────────────────────────────────────── */

function BgvPanel({ bgvGaps }: { bgvGaps: string[] }) {
  if (bgvGaps.length === 0) {
    return (
      <Panel>
        <Eyebrow kicker="COMPLIANCE · BGV READINESS" title="Background verification gaps" />
        <EmptyState message="No BGV gaps were mentioned in this session. In the real round, proactively confirm you have: last-3-employer payslips, Form-16, relieving letters, PAN/Aadhaar/UAN passbook, and education marksheets." />
      </Panel>
    );
  }
  return (
    <Panel>
      <Eyebrow
        kicker="COMPLIANCE · BGV READINESS"
        title="Document gaps you admitted"
        sub="Indian BGV firms (AuthBridge, FirstAdvantage, OnGrid) almost always pull these. A single missing doc can stall the joining date by 2–4 weeks."
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Pill tone="bad">{bgvGaps.length} gap{bgvGaps.length > 1 ? "s" : ""}</Pill>
        <Pill tone="warn">Action before real round</Pill>
      </div>
      <div style={{ display: "grid", gap: 0 }}>
        {bgvGaps.map((gap, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr",
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
                color: ERROR,
                textAlign: "center",
              }}
            >
              ✗
            </span>
            <div style={{ fontFamily: SANS, fontSize: 14, color: COAL }}>{gap}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── Counter-offer risk panel ──────────────────────────────────────── */

function CounterOfferPanel({ risk }: { risk: HrReportData["counterOfferRisk"] }) {
  const copy: Record<typeof risk, { tone: "good" | "warn" | "bad"; headline: string; body: string; script: string }> = {
    low: {
      tone: "good",
      headline: "Counter-offer commitment: clear",
      body: "You came across as decided and non-negotiable with your current employer. HR read this as a low drop-out risk — that's exactly what they need before issuing the offer.",
      script: '"I\'ve already made my decision, and I\'ve given you my word. If my current employer comes back with a counter, that changes nothing for me — I\'m moving for the role and the growth, not for the number."',
    },
    med: {
      tone: "warn",
      headline: "Counter-offer commitment: unclear",
      body: "You were somewhat non-committal on whether you'd take a counter-offer from your current employer. HR's biggest fear is extending an offer and having the candidate use it as a counter-offer lever. Sharpen this.",
      script: '"I\'ve made my decision. Even if my current employer matches the comp, I\'d still join — what I\'m moving for is the scope of this role and where it takes my career, and that\'s not something a counter can give me."',
    },
    high: {
      tone: "bad",
      headline: "Counter-offer commitment: high risk",
      body: "Your answers on the commitment / other-offers probes were vague or implied you might take a counter from your current employer. This is the single biggest HR red flag in India — it signals you might not join even if they issue the offer.",
      script: '"I\'ve already made my decision to move, and a counter-offer from my current employer wouldn\'t change it — the reason I\'m leaving isn\'t the salary, it\'s the growth and the work, which a raise doesn\'t fix. I\'m not using this process as leverage."',
    },
    "not-assessed": {
      tone: "warn",
      headline: "Counter-offer commitment: not probed this round",
      body: "The interviewer didn't ask how you'd respond to a counter-offer in this conversation, so we can't read your commitment from it. Don't mistake that for a pass — in a real Indian HR round this is almost always asked, and it's the single biggest reason offers fall through. Have the line below ready.",
      script: '"I\'ve made my decision to move. Even if my current employer matches the comp, I\'d still join — what I\'m moving for is the scope of this role and where it takes my career, and that\'s not something a counter can give me."',
    },
  };
  const c = copy[risk];
  const pillLabel =
    risk === "low" ? "Clean" : risk === "med" ? "Needs sharpening" : risk === "high" ? "Red flag" : "Not assessed";
  return (
    <Panel>
      <Eyebrow
        kicker="COMMITMENT · COUNTER-OFFER HOLD"
        title={c.headline}
        sub="HR's biggest fear: you take their offer to your current employer for a raise. They probe for this — your script needs to be ready."
      />
      <div style={{ marginBottom: 16 }}>
        <Pill tone={c.tone}>{pillLabel}</Pill>
        <p style={{ fontFamily: SANS, fontSize: 13, color: INK_SOFT, lineHeight: 1.55, margin: "10px 0 0" }}>
          {c.body}
        </p>
      </div>
      <div
        style={{
          background: CREAM_SOFT,
          border: `1px solid ${LINE}`,
          borderLeft: `4px solid ${COPPER}`,
          borderRadius: 12,
          padding: 22,
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
          {risk === "not-assessed" ? 'Prep this — HR will ask "what if they counter?"' : 'If HR asks "what happens if they counter?"'}
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            color: COAL,
            lineHeight: 1.45,
          }}
        >
          {c.script}
        </div>
      </div>
    </Panel>
  );
}

/* ─── Motivation rewrite ────────────────────────────────────────────── */

function MotivationRewritePanel({ hrReport }: { hrReport: HrReportData }) {
  const { motivationBefore, motivationAfter } = hrReport;
  if (!motivationBefore && !motivationAfter) return null;
  // Either side can be blank — motivationAfter is dropped server-side when the
  // LLM's rewrite was itself generic filler (see normalizeHrReport). Adapt the
  // grid so a single populated card spans the full width instead of leaving a
  // broken empty column in a hardcoded 2-up layout.
  const twoUp = Boolean(motivationBefore) && Boolean(motivationAfter);
  return (
    <Panel>
      <Eyebrow
        kicker="MOTIVATION · BEFORE → AFTER"
        title="Your 'why this company' — rewritten"
        sub="Generic answers ('great culture, great opportunity') signal you'll churn. This is the version that lands."
      />
      <div style={{ display: "grid", gridTemplateColumns: twoUp ? "1fr 1fr" : "1fr", gap: 14 }}>
        {motivationBefore && (
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
              What you said
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 16,
                color: COAL,
                lineHeight: 1.5,
              }}
            >
              "{motivationBefore}"
            </div>
          </div>
        )}
        {motivationAfter && (
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
              What HR wants to hear
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 16,
                color: COAL,
                lineHeight: 1.5,
              }}
            >
              "{motivationAfter}"
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 14,
          padding: "12px 14px",
          background: COPPER_SOFT,
          border: `1px solid ${COPPER}33`,
          borderRadius: 10,
          fontFamily: SANS,
          fontSize: 13,
          color: INK_SOFT,
          lineHeight: 1.5,
        }}
      >
        The rewrite names a specific product/leader/domain decision the company made — that's what distinguishes
        you from every other candidate who said "great culture, great people."
      </div>
    </Panel>
  );
}

/* ─── Drill CTA ─────────────────────────────────────────────────────── */

function DrillCtaPanel({
  skills,
  daysUntilInterview,
  onDrillSkill,
}: {
  skills: Skill[];
  daysUntilInterview?: number;
  onDrillSkill?: (name: string) => void;
}) {
  const weakest = [...skills].sort((a, b) => a.score - b.score).slice(0, 3);
  return (
    <Panel style={{ background: `linear-gradient(135deg, #0E0C08 0%, ${INDIGO} 100%)` }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "#B8B5D4",
              marginBottom: 6,
            }}
          >
            DRILL PLAN{daysUntilInterview ? ` · ${daysUntilInterview} DAYS LEFT` : ""}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: "#FFFFFF", lineHeight: 1.2, marginBottom: 6 }}>
            Re-drill the {weakest.length > 0 ? weakest.length : "weakest"} dimensions before your real round
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: "#B8B5D4" }}>
            One 12-minute focused session per dimension — scored on the same rubric so you can see the delta.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDrillSkill && weakest[0] && onDrillSkill(weakest[0].name)}
          style={{
            background: "#FFFFFF",
            color: INDIGO,
            padding: "12px 22px",
            borderRadius: 10,
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: onDrillSkill ? "pointer" : "default",
            whiteSpace: "nowrap",
          }}
        >
          Start drill plan →
        </button>
      </div>
      {weakest.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${weakest.length}, 1fr)`,
            gap: 10,
          }}
        >
          {weakest.map((s, i) => (
            <div
              key={s.name}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
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
                  color: "#FCA5A5",
                  marginBottom: 6,
                }}
              >
                Drill {i + 1}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: "#FFFFFF", lineHeight: 1.4 }}>
                {s.name}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                {s.score}/100
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ─── Composed export ────────────────────────────────────────────────── */

interface HrFullReportProps {
  overallScore: number;
  /** HR rubric dimension scores (8 axes). */
  skills: Skill[];
  wins: string[];
  questions: Question[];
  hrReport?: HrReportData;
  daysUntilInterview?: number;
  role: string;
  company: string;
  onDrillSkill?: (name: string) => void;
}

export default function HrFullReport({
  overallScore,
  skills,
  wins,
  questions,
  hrReport,
  daysUntilInterview,
  role,
  company,
  onDrillSkill,
}: HrFullReportProps) {
  const failingDims = skills.filter((s) => s.score < 60).length;
  const totalDims = skills.length;

  return (
    <ReportCardShell ariaLabelledBy="ir-section-hr">
      {/* Reconcile bridge — ties the hero score to the dim-gate count */}
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
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8B5D4", marginBottom: 4 }}>
            Overall
          </div>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700 }}>
            {overallScore}
            <span style={{ fontSize: 14, color: "#B8B5D4", marginLeft: 2 }}>/100</span>
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.18)" }} />
        {totalDims > 0 && (
          <>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8B5D4", marginBottom: 4 }}>
                Failing dims
              </div>
              <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: failingDims > 0 ? "#FCA5A5" : "#BBF7D0" }}>
                {failingDims}
                <span style={{ fontSize: 14, color: "#B8B5D4", marginLeft: 2 }}>/{totalDims}</span>
              </div>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: "#E5E2F2" }}>
              {failingDims === 0
                ? "All dimensions cleared — strong HR signal across the board."
                : `${failingDims} dimension${failingDims > 1 ? "s" : ""} below the 60/100 floor. Fix any one of them and you cross the line.`}
            </div>
          </>
        )}
        {totalDims === 0 && (
          <div style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: "#E5E2F2", gridColumn: "3 / -1" }}>
            HR Round for {role} at {company}
          </div>
        )}
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: failingDims === 0 ? SUCCESS : failingDims <= 2 ? COPPER : ERROR,
            color: "#FFFFFF",
            padding: "8px 12px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {failingDims === 0 ? "Hire Signal" : failingDims <= 2 ? "Lean Hire" : "No Hire"}
        </div>
      </div>

      {/* SECTION 01 — DIAGNOSE */}
      <SectionBand
        label="01 · Diagnose"
        title="Where you stand right now"
        subtitle="Your scores across every axis HR actually grades on."
        accent={ERROR}
        bg={ERROR_SOFT}
      />
      <DimensionGate skills={skills} />
      <WinsPanel wins={wins} />
      <ProbeReviewPanel questions={questions} />

      {/* SECTION 02 — ACT BEFORE THE OFFER */}
      <SectionBand
        label="02 · Act before the offer"
        title="The 3 things HR is waiting on"
        subtitle="Notice period commitment, comp anchor, and BGV doc trail."
        accent={COPPER}
        bg={COPPER_SOFT}
      />
      {hrReport ? (
        <>
          <NoticePanel hrReport={hrReport} />
          <BgvPanel bgvGaps={hrReport.bgvGaps} />
          <CounterOfferPanel risk={hrReport.counterOfferRisk} />
        </>
      ) : (
        <Panel>
          <EmptyState message="Logistics data (notice period, comp, BGV) wasn't extracted from this session — this can happen for short sessions or when the mock didn't cover these topics. Re-run a full HR mock to get the detailed breakdown." />
        </Panel>
      )}

      {/* SECTION 03 — PRACTICE */}
      {hrReport && (hrReport.motivationBefore || hrReport.motivationAfter) && (
        <>
          <SectionBand
            label="03 · Practice"
            title="Scripts to land cold in the real round"
            subtitle="The version of your answer that HR wants to hear."
            accent={INDIGO}
            bg={INDIGO_SOFT}
          />
          <MotivationRewritePanel hrReport={hrReport} />
        </>
      )}

      {/* SECTION 04 — NEXT STEP */}
      {skills.length > 0 && (
        <>
          <SectionBand
            label="04 · Next step"
            title="Where the drill plan takes you"
            subtitle="One focused 12-minute session per weakest dimension."
            accent={SUCCESS}
            bg={SUCCESS_SOFT}
          />
          <DrillCtaPanel
            skills={skills}
            daysUntilInterview={daysUntilInterview}
            onDrillSkill={onDrillSkill}
          />
        </>
      )}
    </ReportCardShell>
  );
}
