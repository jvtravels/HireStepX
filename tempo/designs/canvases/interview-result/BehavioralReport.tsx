/* BehavioralReport — research-driven full-layout body for the
 * behavioural focus result. Opted into via `data.behavioral.fullLayout`.
 * Replaces the standard InterviewResult body when set.
 *
 * Four regions, top → bottom:
 *   1. Hero (gauge + verbal verdict + at-a-glance + biggest gap)
 *   2. Top Behavioural Moments timeline
 *   3. Compare block (your answer vs stronger + STAR donut + bars + radar)
 *   4. Coaching row (risky phrases + follow-up readiness + strongest story
 *      + next practice focus + footer trophy strip)
 */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <BehavioralHero data={data} b={b} />
      {b.topMoments && b.topMoments.length > 0 && <TopMomentsTimeline moments={b.topMoments} />}
      <CompareBlock b={b} />
      <CoachingRow b={b} />
      {b.footerStrip && <FooterTrophy strip={b.footerStrip} />}
    </div>
  );
}

/* ─── 1. HERO ─────────────────────────────────────────────────────── */

function BehavioralHero({ data, b }: { data: InterviewResultData; b: BehavioralMeta }) {
  const score = data.overallScore;
  const bandAccent = score < 40 ? t.copper : score > 85 ? t.success : t.indigo;
  return (
    <section
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 28,
        borderTop: `4px solid ${bandAccent}`,
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 24,
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
          <span style={{ display: "inline-flex", gap: 10 }}>
            <button
              type="button"
              style={{
                background: "transparent",
                border: `1px solid ${t.line}`,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                color: t.coal,
                cursor: "pointer",
                fontFamily: f.sans,
              }}
            >
              ↓ Download Report
            </button>
            <button
              type="button"
              style={{
                background: t.indigoDeep,
                color: "white",
                border: 0,
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: f.sans,
              }}
            >
              ↻ Practice Again
            </button>
          </span>
        </div>
      )}

      {/* Score + verbal verdict + biggest gap (3 columns on desktop) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 280px) minmax(280px, 1.4fr) minmax(240px, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
        className="ir-bh-hero-grid"
      >
        {/* Gauge */}
        <div style={{ position: "relative", paddingTop: 8 }}>
          <ScoreRing score={score} color={bandAccent} />
          <div
            style={{
              position: "absolute",
              top: 36,
              left: 0,
              right: 0,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontFamily: f.serif, fontSize: 56, color: t.coal, lineHeight: 1 }}>{score}</div>
            <div style={{ fontFamily: f.mono, fontSize: 14, color: t.indigoGray, marginTop: 4 }}>/100</div>
            <div style={{ fontSize: 11, color: t.indigoGray, marginTop: 6, letterSpacing: 1.1 }}>
              OVERALL SCORE
            </div>
          </div>
        </div>

        {/* Verbal verdict */}
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: t.indigo100,
              color: t.indigo,
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            ★ {scoreLabel(score)}
          </span>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 26,
              lineHeight: 1.25,
              color: t.coal,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {b.verbalVerdict ?? "Strong potential. Sharpen your storytelling."}
          </h1>
          {data.percentile !== undefined && (
            <div
              style={{
                marginTop: 12,
                background: t.success100,
                color: t.success,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                display: "inline-block",
              }}
            >
              ★ You performed better than {data.percentile}% of candidates in behavioural interviews.
            </div>
          )}
        </div>

        {/* Biggest Gap card */}
        {b.biggestGap && (
          <div
            style={{
              background: t.cream,
              border: `1px solid ${t.creamSoft}`,
              borderTop: `3px solid ${t.copper}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 10,
                letterSpacing: 1.4,
                color: t.copper,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: t.copper100,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                }}
              >
                ◎
              </span>
              THE BIGGEST GAP TO FIX
            </div>
            <div style={{ fontFamily: f.serif, fontSize: 18, color: t.coal, marginBottom: 6 }}>
              {b.biggestGap.title}
            </div>
            <div style={{ fontSize: 13, color: t.indigoGray, lineHeight: 1.55, marginBottom: 12 }}>
              {b.biggestGap.body}
            </div>
            <button
              type="button"
              style={{
                background: t.indigo,
                color: "white",
                border: 0,
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: f.sans,
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
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.creamSoft} strokeWidth={10} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
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
      {b.scoreBreakdown && b.scoreBreakdown.length > 0 && (
        <div style={{ gridColumn: "1 / -1" }}>
          <ScoreBarsCard bars={b.scoreBreakdown} />
        </div>
      )}
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

function ScoreBarsCard({ bars }: { bars: NonNullable<BehavioralMeta["scoreBreakdown"]> }) {
  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
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
        BEHAVIOURAL SCORE BREAKDOWN
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 200px) 1fr 50px", rowGap: 12, columnGap: 12, alignItems: "center" }}>
        {bars.map((b) => {
          const fg = b.score >= 80 ? t.success : b.score >= 65 ? t.indigo : t.copper;
          return (
            <React.Fragment key={b.label}>
              <span style={{ fontSize: 13, color: t.coal }}>{b.label}</span>
              <div
                style={{
                  height: 8,
                  background: t.creamSoft,
                  borderRadius: 999,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${b.score}%`,
                    height: "100%",
                    background: fg,
                    borderRadius: 999,
                  }}
                />
              </div>
              <span style={{ fontFamily: f.mono, fontSize: 13, color: fg, fontWeight: 600, textAlign: "right" }}>
                {b.score}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 4. COACHING ROW ────────────────────────────────────────────── */

function CoachingRow({ b }: { b: BehavioralMeta }) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 16,
      }}
    >
      {b.riskyPhrases && b.riskyPhrases.length > 0 && <RiskyPhrasesCard rows={b.riskyPhrases} />}
      {b.followupReadiness && b.followupReadiness.length > 0 && <FollowupReadinessCard rows={b.followupReadiness} />}
      {b.strongestStory && <StrongestStoryCard s={b.strongestStory} />}
      {b.nextPracticeFocus && b.nextPracticeFocus.length > 0 && (
        <NextPracticeFocusCard items={b.nextPracticeFocus} />
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
        background: t.cream,
        border: `1px solid ${t.creamSoft}`,
        borderLeft: `4px solid ${t.indigo}`,
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
      <button
        type="button"
        style={{
          marginTop: 12,
          background: "white",
          border: `1px solid ${t.line}`,
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: t.coal,
          cursor: "pointer",
        }}
      >
        ☐ Save to Notebook
      </button>
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
            <button
              type="button"
              style={{
                background: "white",
                border: `1px solid ${t.indigo}`,
                color: t.indigo,
                borderRadius: 8,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Practice
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FooterTrophy({ strip }: { strip: NonNullable<BehavioralMeta["footerStrip"]> }) {
  return (
    <section
      style={{
        background: `linear-gradient(180deg, ${t.indigoDeep} 0%, ${t.indigo} 100%)`,
        color: "white",
        borderRadius: 16,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 38 }} aria-hidden="true">🏆</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontFamily: f.serif, fontSize: 20, fontWeight: 500 }}>{strip.headline}</div>
        <div style={{ fontSize: 13, opacity: 0.82, marginTop: 4 }}>{strip.body}</div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.78 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, fontWeight: 700, color: "#FED7AA" }}>RECOMMENDED NEXT STEP</div>
        <div style={{ fontSize: 14, color: "white", marginTop: 2 }}>{strip.recommendedMock}</div>
      </div>
      <button
        type="button"
        style={{
          background: "#F59E0B",
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
        {strip.ctaLabel} →
      </button>
    </section>
  );
}
