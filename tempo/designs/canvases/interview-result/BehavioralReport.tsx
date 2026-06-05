/* BehavioralReport — research-driven full-layout body for the
 * behavioural focus result. Opted into via `data.behavioral.fullLayout`.
 * Replaces the standard InterviewResult body when set.
 *
 * Render order, top → bottom (matches the canvas brief):
 *   1. Persona ribbon (b.persona)
 *   2. Hero (gauge + verbal verdict + at-a-glance + biggest gap)
 *   3. One habit to fix card (b.oneHabit)
 *   4. STAR completeness matrix (b.starMatrix)
 *   5. 3-col diagnostic cards: Failure / Conflict / Delivery timeline
 *   6. Competency radar (b.competencyRadar)
 *   7. Top behavioural moments timeline (b.topMoments)
 *   8. Compare block (b.answerCompare)
 *   9. Coaching row (b.strongestStory + b.riskyPhrases + b.followupReadiness
 *      + b.nextPracticeFocus)
 *  10. AI accountability strip (b.aiAccountability)
 *  11. Footer trophy CTA (b.footerStrip)
 */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import {
  BehavioralSignal,
  BehavioralStat,
  BehavioralLegend,
  BehavioralRadar,
} from "./InterviewResult";
import type { InterviewResultData, BehavioralMeta } from "./InterviewResult";

interface Props {
  data: InterviewResultData;
}

const TONE_FG: Record<NonNullable<BehavioralMeta["atAGlance"]>[number]["tone"] & string, string> = {
  good: t.success,
  neutral: t.coal,
  needsWork: t.copper,
};

const BAND_FG: Record<"strong" | "needsWork" | "neutral", string> = {
  strong: t.success,
  needsWork: t.copper,
  neutral: t.indigoGray,
};

const BAND_BG: Record<"strong" | "needsWork" | "neutral", string> = {
  strong: t.success100,
  needsWork: t.copper100,
  neutral: t.creamSoft,
};

const READINESS_FG: Record<"good" | "needsWork" | "weak", string> = {
  good: t.success,
  needsWork: t.copper,
  weak: t.error,
};

export default function BehavioralReport({ data }: Props) {
  const b = data.behavioral;
  if (!b) return null;
  const score = data.overallScore;
  const hasDiagnostic = b.failure || (b.conflict && b.conflict.asked > 0) || (b.delivery && b.delivery.length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {b.persona && <PersonaRibbon persona={b.persona} />}
      <BehavioralHero data={data} b={b} />
      {b.oneHabit && <OneHabitCard habit={b.oneHabit} score={score} />}
      {b.starMatrix && b.starMatrix.length > 0 && <StarMatrixSection rows={b.starMatrix} />}
      {hasDiagnostic && <DiagnosticCards b={b} />}
      {b.competencyRadar && b.competencyRadar.axes.length >= 3 && (
        <CompetencyRadarSection radar={b.competencyRadar} />
      )}
      {b.topMoments && b.topMoments.length > 0 && <TopMomentsTimeline moments={b.topMoments} />}
      <CompareBlock b={b} />
      <CoachingRow b={b} />
      {b.aiAccountability && <AIAccountabilityStrip a={b.aiAccountability} />}
      {b.footerStrip && <FooterTrophy strip={b.footerStrip} />}
    </div>
  );
}

/* ─── 0. PERSONA RIBBON ───────────────────────────────────────────── */

function PersonaRibbon({ persona }: { persona: NonNullable<BehavioralMeta["persona"]> }) {
  /* Quiet cream band, not indigoDeep. OneHabit is the only dark band on
     the page so the visual hierarchy reads as: warm context → score →
     dark "do this next" → diagnostics → warm exit. */
  return (
    <div
      style={{
        background: t.creamSoft,
        color: t.coal,
        borderRadius: 12,
        padding: "12px 18px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 14,
        fontSize: 13,
        fontFamily: f.sans,
        border: `1px solid ${t.line}`,
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 700, color: t.indigo }}>
        PERSONA
      </span>
      <span>
        You interviewed with a <strong>{persona.voice}</strong> at a{" "}
        <strong>{persona.companyTier}</strong>.
      </span>
      <span style={{ color: t.indigoGray, fontSize: 12 }}>{persona.rubricNote}</span>
    </div>
  );
}

/* ─── 1b. ONE HABIT TO FIX ────────────────────────────────────────── */

function OneHabitCard({
  habit,
  score,
}: {
  habit: NonNullable<BehavioralMeta["oneHabit"]>;
  score: number;
}) {
  const lowBand = score < 40;
  const eyebrow = lowBand ? "ONE THING TO TRY NEXT" : "ONE HABIT TO FIX";
  const ctaCopy = lowBand ? "Try this one habit next session →" : "Practice this pattern →";
  return (
    <div
      style={{
        background: t.indigoDeep,
        color: "white",
        borderRadius: 14,
        padding: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 320px" }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: t.copper100, fontWeight: 700 }}>
          {eyebrow}
        </div>
        <div style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 500, marginTop: 6, lineHeight: 1.25 }}>
          {habit.headline}
        </div>
        <div style={{ fontSize: 13, opacity: 0.82, marginTop: 8, lineHeight: 1.55 }}>
          {habit.rationale}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 10 }}>
          Next session auto-prebias →{" "}
          <strong style={{ color: t.copper100 }}>{habit.prebiasDimension}</strong>
        </div>
      </div>
      <button
        type="button"
        style={{
          background: "white",
          color: t.indigoDeep,
          border: 0,
          borderRadius: 10,
          padding: "12px 18px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: f.sans,
        }}
      >
        {ctaCopy}
      </button>
    </div>
  );
}

/* ─── 2. STAR MATRIX ──────────────────────────────────────────────── */

function StarMatrixSection({ rows }: { rows: NonNullable<BehavioralMeta["starMatrix"]> }) {
  if (rows.length < 3) {
    return (
      <div
        style={{
          background: "white",
          border: `1px dashed ${t.creamSoft}`,
          borderRadius: 12,
          padding: "14px 18px",
          fontSize: 13,
          color: t.indigoGray,
          lineHeight: 1.5,
        }}
      >
        Only {rows.length} behavioural turn{rows.length === 1 ? "" : "s"} this session; too few to
        chart STAR completeness. Ask 3+ stem questions next session to unlock the matrix.
      </div>
    );
  }
  return (
    <section
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 22,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: 0.6 }}>
          STAR COMPLETENESS · {rows.length} answers
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `120px repeat(${rows.length}, minmax(40px, 1fr)) minmax(180px, 240px)`,
            gap: 6,
            minWidth: 120 + rows.length * 46 + 180,
          }}
        >
          <div />
          {rows.map((row) => (
            <div
              key={`h-${row.q}`}
              style={{ textAlign: "center", fontSize: 11, color: t.indigoGray, fontWeight: 600 }}
            >
              Q{row.q}
            </div>
          ))}
          <div />
          {(["S", "T", "A", "R"] as const).map((k) => {
            const labelMap = { S: "Situation", T: "Task", A: "Action", R: "Result" };
            const missing = rows.filter((r) => !r[k]).length;
            const total = rows.length;
            const coach =
              missing === 0
                ? "Solid across every turn."
                : missing >= total / 2
                ? `Missed in ${missing}/${total}; load-bearing gap.`
                : `Missed in ${missing}/${total}.`;
            return (
              <React.Fragment key={k}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontFamily: f.sans,
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.coal,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: t.indigo100,
                      color: t.indigo,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      marginRight: 8,
                    }}
                  >
                    {k}
                  </span>
                  {labelMap[k]}
                </div>
                {rows.map((row, colIdx) => {
                  const ok = row[k];
                  // Left-to-right stagger across the matrix. The whole
                  // sweep lands in ~200ms total; per-cell fade is 160ms,
                  // delays shift by col so the eye reads time-of-session
                  // from left to right.
                  const delay = Math.round((colIdx / Math.max(1, rows.length - 1)) * 160);
                  return (
                    <div
                      key={`${k}-${row.q}`}
                      className="ir-star-cell"
                      style={{
                        height: 40,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: ok ? t.success100 : t.copper100,
                        color: ok ? t.success : t.copper,
                        fontSize: 18,
                        fontWeight: 700,
                        border: `1px solid ${ok ? "rgba(21,128,61,0.18)" : "rgba(180,83,9,0.22)"}`,
                        animationDelay: `${delay}ms`,
                      }}
                      aria-label={`Q${row.q} ${labelMap[k]} ${ok ? "present" : "missing"}`}
                    >
                      {ok ? "✓" : "✗"}
                    </div>
                  );
                })}
                <div
                  style={{
                    fontSize: 12,
                    color: t.indigoGray,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 8,
                  }}
                >
                  {coach}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── 3. DIAGNOSTIC CARDS (Failure / Conflict / Delivery) ─────────── */

const DELIVERY_SHAPE_COLOR: Record<"crisp" | "hedged" | "rambling", string> = {
  crisp: t.success,
  hedged: "#CA8A04",
  rambling: t.copper,
};

function DiagnosticCards({ b }: { b: BehavioralMeta }) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {b.failure && <FailureCard f={b.failure} />}
      {b.conflict && b.conflict.asked > 0 && <ConflictCard c={b.conflict} />}
      {b.delivery && b.delivery.length > 0 && <DeliveryTimelineCard delivery={b.delivery} />}
    </section>
  );
}

function FailureCard({ f }: { f: NonNullable<BehavioralMeta["failure"]> }) {
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: 18,
        borderTop: `3px solid ${f.specific ? t.success : t.copper}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: t.indigoGray,
          letterSpacing: 1.2,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        FAILURE STORY · Q{f.questionIndex}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <BehavioralSignal ok={f.ownership} label="Ownership" />
        <BehavioralSignal ok={f.specific} label="Specific" />
        <BehavioralSignal ok={f.learning} label="Learning" />
      </div>
      <div style={{ fontSize: 12, color: t.coal, lineHeight: 1.55 }}>{f.coachQuote}</div>
    </div>
  );
}

function ConflictCard({ c }: { c: NonNullable<BehavioralMeta["conflict"]> }) {
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: 18,
        borderTop: `3px solid ${c.balanced > 0 ? t.success : t.copper}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: t.indigoGray,
          letterSpacing: 1.2,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        CONFLICT NARRATION
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <BehavioralStat n={c.asked} label="Asked" />
        <BehavioralStat n={c.oneSided} label="One-sided" bad={c.oneSided > 0} />
        <BehavioralStat n={c.balanced} label="Balanced" bad={c.balanced === 0} good={c.balanced > 0} />
      </div>
      <div style={{ fontSize: 12, color: t.coal, lineHeight: 1.55 }}>
        {c.coachLine ?? (
          <>
            Name what <em>they</em> wanted before what you did. Bar-raiser expects the
            counterparty frame inside the first 15 seconds.
          </>
        )}
      </div>
      {c.jumpQuestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {c.jumpQuestions.map((q) => (
            <a
              key={q}
              href={`#ir-question-${q}`}
              style={{
                background: t.indigo100,
                color: t.indigo,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                textDecoration: "none",
              }}
            >
              Jump → Q{q}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryTimelineCard({
  delivery,
}: {
  delivery: NonNullable<BehavioralMeta["delivery"]>;
}) {
  const hasRambling = delivery.some((d) => d.shape === "rambling");
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: 18,
        borderTop: `3px solid ${hasRambling ? t.copper : t.success}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: t.indigoGray,
          letterSpacing: 1.2,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        DELIVERY TIMELINE
      </div>
      <div
        style={{
          display: "flex",
          height: 36,
          borderRadius: 6,
          overflow: "hidden",
          border: `1px solid ${t.creamSoft}`,
          marginBottom: 10,
        }}
      >
        {delivery.map((s, i) => (
          <div
            key={i}
            style={{
              flex: s.seconds,
              background: DELIVERY_SHAPE_COLOR[s.shape],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
            }}
            aria-label={`Q${s.q} ${s.shape}, ${s.seconds} seconds`}
          >
            Q{s.q}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: t.indigoGray }}>
        <BehavioralLegend c={t.success} label="crisp" />
        <BehavioralLegend c="#CA8A04" label="hedged" />
        <BehavioralLegend c={t.copper} label="rambling" />
      </div>
    </div>
  );
}

/* ─── 4. COMPETENCY RADAR ─────────────────────────────────────────── */

function CompetencyRadarSection({
  radar,
}: {
  radar: NonNullable<BehavioralMeta["competencyRadar"]>;
}) {
  return (
    <section
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h3
          style={{
            fontFamily: f.sans,
            fontSize: 14,
            fontWeight: 700,
            color: t.coal,
            margin: 0,
            letterSpacing: 0.6,
          }}
        >
          COMPETENCY RADAR
        </h3>
        <span
          style={{
            fontSize: 11,
            color: t.indigo,
            background: t.indigo100,
            padding: "3px 10px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {radar.track}
        </span>
      </div>
      <BehavioralRadar radar={radar} />
      {(radar.anchor || radar.gap) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: t.indigoGray, lineHeight: 1.55 }}>
          {radar.anchor && (
            <div>
              <strong style={{ color: t.success }}>Anchor:</strong> {radar.anchor}
            </div>
          )}
          {radar.gap && (
            <div>
              <strong style={{ color: t.copper }}>Gap:</strong> {radar.gap}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── 7. AI ACCOUNTABILITY ────────────────────────────────────────── */

function AIAccountabilityStrip({
  a,
}: {
  a: NonNullable<BehavioralMeta["aiAccountability"]>;
}) {
  return (
    <div
      style={{
        background: t.creamSoft,
        borderRadius: 10,
        padding: "12px 18px",
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        fontSize: 12,
        color: t.coal,
        alignItems: "center",
        fontFamily: f.sans,
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: 1.2, color: t.indigoGray, fontWeight: 700 }}>
        AI ACCOUNTABILITY
      </span>
      <span>
        Depth probes <strong>{a.depthProbes}</strong> · vague accepted <strong>{a.vagueAccepted}</strong>
      </span>
      <span>
        Ownership probes <strong>{a.ownershipProbes}</strong> · deflected <strong>{a.deflected}</strong>
      </span>
      {typeof a.counterpartyProbes === "number" && (
        <span>
          Counterparty probes <strong>{a.counterpartyProbes}</strong> · skipped{" "}
          <strong>{a.counterpartySkipped ?? 0}</strong>
        </span>
      )}
    </div>
  );
}

/* ─── 1. HERO ─────────────────────────────────────────────────────── */

/** One-shot count-up on mount. Ease-out-quart matches the rest of the
 *  report's motion language. Snaps to target if the user prefers reduced
 *  motion OR if `animate` is false. Used to disable the theatrical
 *  reveal on low-band scores (peak-end rule: dragging out a bad number
 *  makes the end of a stressful session feel worse). */
function useCountUp(target: number, animate: boolean, durationMs = 900): number {
  const [value, setValue] = React.useState(() => {
    if (typeof window === "undefined" || !animate) return target;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return reduce ? target : 0;
  });
  React.useEffect(() => {
    if (typeof window === "undefined" || !animate) {
      setValue(target);
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 4); // ease-out-quart
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, animate]);
  return value;
}

function BehavioralHero({ data, b }: { data: InterviewResultData; b: BehavioralMeta }) {
  const score = data.overallScore;
  const bandAccent = score < 40 ? t.copper : score > 85 ? t.success : t.indigo;
  // Skip the theatrical count-up under the low band; bad scores shouldn't
  // be drawn out (peak-end rule). The ring stroke arrives static; the
  // stack-rise still plays so the page doesn't feel inert.
  const displayedScore = useCountUp(score, score >= 50, 900);
  return (
    <section
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: "28px 32px",
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {/* Session meta strip */}
      {b.sessionMeta && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 12,
            color: t.indigoGray,
            fontFamily: f.sans,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>
            Interview completed on <strong style={{ color: t.coal }}>{b.sessionMeta.completedDate}</strong>
            {"  ·  "}
            {b.sessionMeta.questionCount} questions
            {"  ·  "}
            {b.sessionMeta.durationMin} min mock
          </span>
          <a
            href="#ir-section-coach-notes"
            style={{
              color: t.indigo,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              borderBottom: `1px solid transparent`,
              paddingBottom: 1,
            }}
            className="ir-bh-rubric-link"
          >
            How scoring works →
          </a>
        </div>
      )}

      {/* Score (headline) + verbal verdict + biggest gap.
          Asymmetric 3-track grid: gauge is hard-sized so it can dominate
          without competing fluidly with the verdict; verdict column is
          the widest fluid track; biggest-gap is bare typography divided
          by a vertical rule (no nested card). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(280px, 1.6fr) minmax(220px, 1fr)",
          columnGap: 40,
          rowGap: 28,
          alignItems: "center",
        }}
        className="ir-bh-hero-grid"
      >
        {/* Gauge — the headline. Ring 220 / r=86 → inner clear diameter
            ~172px. 64px serif + mono /100 + caption fit cleanly. */}
        <div
          style={{
            position: "relative",
            width: 220,
            height: 220,
            margin: "0 auto",
          }}
        >
          <ScoreRing score={displayedScore} color={bandAccent} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontFamily: f.serif,
                fontSize: 64,
                color: t.coal,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                // Optical centering: serif numerals sit slightly above the
                // geometric center in their em-box; pull up so the visual
                // mass lands on the ring's true centerline.
                transform: "translateY(-2px)",
                // The count-up makes the digit visually pulse as widths
                // change; tabular-nums keeps each glyph in a fixed cell.
                fontVariantNumeric: "tabular-nums",
              }}
              aria-label={`Score ${score} out of 100`}
            >
              {displayedScore}
            </div>
            <div style={{ fontFamily: f.mono, fontSize: 13, color: t.indigoGray, marginTop: 4 }}>/100</div>
          </div>
        </div>

        {/* Verbal verdict — secondary line, demoted from competing-headline. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} className="ir-bh-rise-stack">
          <span
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: t.indigo100,
              color: t.indigo,
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {scoreLabel(score)}
          </span>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 22,
              lineHeight: 1.3,
              color: t.coal,
              margin: 0,
              letterSpacing: "-0.005em",
              maxWidth: "32ch",
            }}
          >
            {b.verbalVerdict ?? "Strong potential. Sharpen your storytelling."}
          </h1>
          {data.percentile !== undefined && (
            <div
              style={{
                marginTop: 4,
                background: t.success100,
                color: t.success,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                alignSelf: "flex-start",
              }}
            >
              You performed better than {data.percentile}% of candidates in behavioural interviews.
            </div>
          )}
        </div>

        {/* Biggest gap — bare typography in the column. Copper eyebrow
            chip + spacing do the grouping; column gap separates it from
            the verdict. No side-stripe (absolute ban). */}
        {b.biggestGap && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            className="ir-bh-rise-stack"
          >
            <span
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: t.copper100,
                color: t.copper,
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: 1.4,
                fontWeight: 700,
              }}
            >
              BIGGEST GAP TO FIX
            </span>
            <div
              style={{
                fontFamily: f.serif,
                fontSize: 18,
                lineHeight: 1.3,
                color: t.coal,
                letterSpacing: "-0.005em",
              }}
            >
              {b.biggestGap.title}
            </div>
            <div style={{ fontSize: 13, color: t.indigoGray, lineHeight: 1.55, maxWidth: "54ch" }}>
              {b.biggestGap.body}
            </div>
            <button
              type="button"
              className="ir-bh-gap-cta"
              style={{
                marginTop: 4,
                alignSelf: "flex-start",
                background: "transparent",
                color: t.indigo,
                border: 0,
                padding: "2px 0",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: f.sans,
                textAlign: "left",
                borderBottom: `1px solid transparent`,
              }}
            >
              {b.biggestGap.ctaLabel} →
            </button>
          </div>
        )}
      </div>

      {/* At-a-glance grid */}
      {b.atAGlance && b.atAGlance.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.4,
              color: t.indigoGray,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            AT A GLANCE
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            {b.atAGlance.map((s) => (
              <div
                key={s.label}
                style={{
                  background: t.creamSoft,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div style={{ fontSize: 11, color: t.indigoGray, fontFamily: f.sans }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: f.serif, fontSize: 22, color: t.coal }}>{s.value}</span>
                  {s.suffix && (
                    <span style={{ fontFamily: f.mono, fontSize: 12, color: t.indigoGray }}>{s.suffix}</span>
                  )}
                  {s.tone && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        color: TONE_FG[s.tone],
                        fontWeight: 600,
                      }}
                    >
                      {s.tone === "good" ? "Strong" : s.tone === "needsWork" ? "Needs work" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 86;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.creamSoft} strokeWidth={12} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeDasharray={`${dash} ${c}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

function scoreLabel(s: number): string {
  if (s >= 85) return "Strong baseline";
  if (s >= 70) return "Promising baseline";
  if (s >= 50) return "Mid baseline";
  return "Early baseline";
}

/* ─── 2. TOP MOMENTS TIMELINE ─────────────────────────────────────── */

function TopMomentsTimeline({ moments }: { moments: NonNullable<BehavioralMeta["topMoments"]> }) {
  return (
    <section
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <h2 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: 0.6 }}>
          TOP BEHAVIOURAL MOMENTS
        </h2>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: t.indigoGray }}>
          <LegendDot c={t.success} label="Strong" />
          <LegendDot c={t.copper} label="Needs improvement" />
          <LegendDot c={t.indigoGray} label="Neutral" />
        </div>
      </div>
      {/* Timeline track */}
      <div style={{ position: "relative", paddingTop: 32, overflowX: "auto" }}>
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 24,
            right: 24,
            height: 2,
            background: t.creamSoft,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${moments.length}, minmax(140px, 1fr))`,
            gap: 16,
          }}
        >
          {moments.map((m, i) => (
            <div key={i} style={{ position: "relative", textAlign: "center" }}>
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.indigoGray, marginBottom: 6 }}>
                {m.time}
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "white",
                  border: `2px solid ${BAND_FG[m.band]}`,
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: f.serif,
                  fontSize: 14,
                  fontWeight: 700,
                  color: BAND_FG[m.band],
                  position: "relative",
                }}
              >
                {i + 1}
                {m.isHighlight && (
                  <span
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: t.success,
                      color: "white",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Highlight moment"
                  >
                    ★
                  </span>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: t.coal, lineHeight: 1.35 }}>
                {m.title}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: t.indigoGray, lineHeight: 1.4 }}>
                {m.body}
              </div>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: BAND_BG[m.band],
                  color: BAND_FG[m.band],
                  textTransform: "uppercase",
                }}
              >
                {m.band === "needsWork" ? "Needs improvement" : m.band}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LegendDot({ c, label }: { c: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
      {label}
    </span>
  );
}

/* ─── 3. COMPARE BLOCK ────────────────────────────────────────────── */

function CompareBlock({ b }: { b: BehavioralMeta }) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 20,
      }}
      className="ir-bh-compare-grid"
    >
      {b.answerCompare && <AnswerCompareCard a={b.answerCompare} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {b.answerCompare && <StarBreakdownCard a={b.answerCompare} />}
      </div>
    </section>
  );
}

function AnswerCompareCard({ a }: { a: NonNullable<BehavioralMeta["answerCompare"]> }) {
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: t.indigo, fontSize: 16 }}>⚖</span>
        <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal, margin: 0 }}>
          Your answer vs stronger answer
        </h3>
      </div>
      <div
        style={{
          background: t.creamSoft,
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 12,
          color: t.coal,
          marginBottom: 12,
        }}
      >
        Q{a.questionIndex}: {a.questionText}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.copper }}>Your answer (excerpt)</span>
            <span style={{ fontFamily: f.mono, fontSize: 12, color: t.copper }}>{a.yourScore}/100</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: t.coal, margin: 0, fontStyle: "italic" }}>
            "{a.yourAnswer}"
          </p>
        </div>
        <div style={{ background: t.success100, border: "1px solid rgba(21,128,61,0.18)", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.success }}>Stronger answer (using STAR)</span>
            <span style={{ fontFamily: f.mono, fontSize: 12, color: t.success }}>{a.strongerScore}/100</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, lineHeight: 1.6, color: t.coal }}>
            {(["S", "T", "A", "R"] as const).map((k) => (
              <li key={k} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 16,
                    fontFamily: f.mono,
                    fontWeight: 700,
                    color: t.success,
                  }}
                >
                  {k}
                </span>
                <span>{a.stronger[k]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          background: t.indigo100,
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          color: t.indigoDeep,
        }}
      >
        <strong>Impact:</strong> {a.impactLine}
      </div>
      <button
        type="button"
        aria-label={`Practice question ${a.questionIndex}: ${a.questionText}`}
        style={{
          marginTop: 12,
          background: "transparent",
          border: `1px solid ${t.indigo}`,
          color: t.indigo,
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: f.sans,
        }}
      >
        Practice this answer →
      </button>
    </div>
  );
}

function StarBreakdownCard({ a }: { a: NonNullable<BehavioralMeta["answerCompare"]> }) {
  const totalLetters = 4;
  const complete = (["S", "T", "A", "R"] as const).filter((k) => a.starScores[k] >= 7).length;
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal, margin: "0 0 14px", letterSpacing: 0.6 }}>
        STAR BREAKDOWN <span style={{ color: t.indigoGray, fontWeight: 500 }}>(your answer)</span>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {(["S", "T", "A", "R"] as const).map((k) => {
          const score = a.starScores[k];
          const labels = { S: "Situation", T: "Task", A: "Action", R: "Result" };
          const tone = score >= 7 ? t.success : score >= 5 ? t.copper : t.error;
          return (
            <div
              key={k}
              style={{
                background: t.cream,
                border: `1px solid ${t.creamSoft}`,
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: t.indigo100,
                      color: t.indigo,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{labels[k]}</span>
                </span>
                <span style={{ fontFamily: f.mono, fontSize: 13, color: tone, fontWeight: 600 }}>{score}/10</span>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 14,
          background: t.cream,
          borderRadius: 10,
          padding: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Donut value={complete} total={totalLetters} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>STAR Completion</div>
          <div style={{ fontSize: 12, color: t.indigoGray, marginTop: 2 }}>
            Your story is {complete >= 3 ? "almost complete" : "incomplete"}. Add measurable results and key learning.
          </div>
        </div>
        <div style={{ fontSize: 11, color: t.indigoGray, display: "flex", flexDirection: "column", gap: 4 }}>
          <LegendDot c={t.success} label="Complete" />
          <LegendDot c={t.copper} label="Partial" />
          <LegendDot c={t.error} label="Missing" />
        </div>
      </div>
    </div>
  );
}

function Donut({ value, total }: { value: number; total: number }) {
  const size = 64;
  const r = 24;
  const c = 2 * Math.PI * r;
  const ratio = value / total;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.creamSoft} strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={t.indigo}
          strokeWidth={6}
          strokeDasharray={`${c * ratio} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: f.serif,
          fontSize: 14,
          color: t.coal,
        }}
      >
        {value}/{total}
      </div>
    </div>
  );
}

/* ─── 4. COACHING ROW ────────────────────────────────────────────── */

function CoachingRow({ b }: { b: BehavioralMeta }) {
  /* Surface vocabulary rhythm:
     1. StrongestStory: cream-soft callout band (warm, single-focus)
     2. RiskyPhrases: full-width white card (two-column scan)
     3. FollowupReadiness + NextPracticeFocus: 2-col grid below
     Breaks the previous 4-same-shape card grid. */
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {b.strongestStory && <StrongestStoryCard s={b.strongestStory} />}
      {b.riskyPhrases && b.riskyPhrases.length > 0 && <RiskyPhrasesCard rows={b.riskyPhrases} />}
      {(b.followupReadiness || b.nextPracticeFocus) && (
        <div
          className="ir-bh-coach-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {b.followupReadiness && b.followupReadiness.length > 0 && (
            <FollowupReadinessCard rows={b.followupReadiness} />
          )}
          {b.nextPracticeFocus && b.nextPracticeFocus.length > 0 && (
            <NextPracticeFocusCard items={b.nextPracticeFocus} />
          )}
        </div>
      )}
    </section>
  );
}

function RiskyPhrasesCard({ rows }: { rows: NonNullable<BehavioralMeta["riskyPhrases"]> }) {
  return (
    <div style={{ background: "white", border: `1px solid ${t.line}`, borderRadius: 16, padding: 20 }}>
      <h3
        style={{
          fontFamily: f.sans,
          fontSize: 14,
          fontWeight: 700,
          color: t.coal,
          margin: "0 0 14px",
          letterSpacing: 0.6,
        }}
      >
        RISKY PHRASES DETECTED
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.copper, letterSpacing: 0.4 }}>
          Phrases that weaken impact
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.success, letterSpacing: 0.4 }}>
          Stronger alternatives
        </span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <span
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                color: t.coal,
                fontStyle: "italic",
              }}
            >
              ✗ "{r.weak}"
            </span>
            <span
              style={{
                background: t.success100,
                border: "1px solid rgba(21,128,61,0.18)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                color: t.coal,
              }}
            >
              ✓ "{r.strong}"
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FollowupReadinessCard({ rows }: { rows: NonNullable<BehavioralMeta["followupReadiness"]> }) {
  return (
    <div style={{ background: "white", border: `1px solid ${t.line}`, borderRadius: 16, padding: 20 }}>
      <h3
        style={{
          fontFamily: f.sans,
          fontSize: 14,
          fontWeight: 700,
          color: t.coal,
          margin: "0 0 4px",
          letterSpacing: 0.6,
        }}
      >
        FOLLOW-UP READINESS
      </h3>
      <div style={{ fontSize: 11, color: t.indigoGray, marginBottom: 14 }}>
        How ready you are for common follow-ups
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <li key={r.dimension} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: t.coal }}>{r.dimension}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: READINESS_FG[r.band],
                textTransform: "capitalize",
              }}
            >
              {r.band === "needsWork" ? "Needs work" : r.band}
            </span>
            <span
              style={{
                width: 60,
                height: 6,
                background: t.creamSoft,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: r.band === "good" ? "85%" : r.band === "needsWork" ? "55%" : "25%",
                  background: READINESS_FG[r.band],
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StrongestStoryCard({ s }: { s: NonNullable<BehavioralMeta["strongestStory"]> }) {
  return (
    <div
      style={{
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            background: t.indigo,
            color: "white",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 14,
          }}
        >
          ★
        </span>
        <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: 0.6 }}>
          YOUR STRONGEST STORY
        </h3>
      </div>
      <div style={{ fontSize: 13, color: t.coal, fontWeight: 600, marginBottom: 10 }}>
        Q{s.questionIndex}: {s.questionText}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: t.indigoGray }}>
        <div>
          <strong style={{ color: t.coal }}>Strengths:</strong> {s.strengths.join(", ")}
        </div>
        <div>
          <strong style={{ color: t.coal }}>Impact potential:</strong> {s.impactPotential}
        </div>
        <div>
          <strong style={{ color: t.coal }}>What to improve:</strong> {s.whatToImprove}
        </div>
      </div>
    </div>
  );
}

function NextPracticeFocusCard({ items }: { items: NonNullable<BehavioralMeta["nextPracticeFocus"]> }) {
  return (
    <div style={{ background: "white", border: `1px solid ${t.line}`, borderRadius: 16, padding: 20 }}>
      <h3
        style={{
          fontFamily: f.sans,
          fontSize: 14,
          fontWeight: 700,
          color: t.coal,
          margin: "0 0 4px",
          letterSpacing: 0.6,
        }}
      >
        NEXT PRACTICE FOCUS
      </h3>
      <div style={{ fontSize: 11, color: t.indigoGray, marginBottom: 14 }}>
        Focus on these areas to improve
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: 10,
              borderRadius: 10,
              background: t.cream,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: t.indigo100,
                color: t.indigo,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{it.title}</div>
              <div style={{ fontSize: 12, color: t.indigoGray, marginTop: 2, lineHeight: 1.5 }}>{it.body}</div>
            </div>
            {/* Per-row Practice button removed; the trophy footer is the
                singular exit. Inline CTAs here just diluted the call. */}
          </li>
        ))}
      </ol>
    </div>
  );
}

function FooterTrophy({ strip }: { strip: NonNullable<BehavioralMeta["footerStrip"]> }) {
  /* Warm cream-soft exit, not indigoDeep. OneHabit is the only dark band
     on the page; the footer is the celebratory close, not a second
     authoritative directive. */
  return (
    <section
      style={{
        background: t.creamSoft,
        color: t.coal,
        borderRadius: 16,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
        border: `1px solid ${t.line}`,
      }}
    >
      <span style={{ fontSize: 38 }} aria-hidden="true">🏆</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontFamily: f.serif, fontSize: 20, fontWeight: 500, color: t.coal }}>
          {strip.headline}
        </div>
        <div style={{ fontSize: 13, color: t.indigoGray, marginTop: 4 }}>{strip.body}</div>
      </div>
      <div style={{ fontSize: 12, color: t.indigoGray }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, fontWeight: 700, color: t.copper }}>
          RECOMMENDED NEXT STEP
        </div>
        <div style={{ fontSize: 14, color: t.coal, marginTop: 2 }}>{strip.recommendedMock}</div>
      </div>
      <button
        type="button"
        style={{
          background: t.indigoDeep,
          color: "white",
          border: 0,
          borderRadius: 10,
          padding: "12px 18px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: f.sans,
        }}
      >
        {strip.ctaLabel} →
      </button>
    </section>
  );
}
