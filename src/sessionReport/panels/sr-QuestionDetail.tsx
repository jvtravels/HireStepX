/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Per-question detail panel: tabs (answer / restructured / exemplar),
 * STAR + metrics strip, coaching column. Includes its co-located atoms
 * (StarChip, HighlightLegend, AnswerBody).
 * Pure presentation. */

import { useState } from "react";
import { t, f, radius, space } from "../tokens";
import type { AnswerSpan, HighlightKind, Question } from "../types";

function StarChip({ active, letter, label }: { active: boolean; letter: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: active ? t.successAccent : t.line,
          color: active ? t.success : t.inkFaint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: f.mono,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {letter}
      </span>
      <span style={{ fontFamily: f.sans, fontSize: 10, color: t.inkSoft }}>{label}</span>
    </div>
  );
}

function HighlightLegend() {
  const items: { kind: HighlightKind; label: string }[] = [
    { kind: "filler", label: "Filler / Hesitation" },
    { kind: "hedge", label: "Hedging" },
    { kind: "quantified", label: "Impact / Quantified" },
    { kind: "firstPerson", label: "First Person" },
  ];
  const colorFor = (k: HighlightKind) =>
    k === "filler" ? t.leanHireRing
    : k === "hedge" ? t.hedgeTint
    : k === "quantified" ? t.successAccent
    : t.indigoTint;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
      {items.map((i) => (
        <span
          key={i.kind}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: f.sans,
            fontSize: 11,
            color: t.inkSoft,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: radius.micro, background: colorFor(i.kind) }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function CornerBadge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        padding: "3px 8px",
        borderRadius: radius.pill,
        background: bg,
        color,
        fontFamily: f.mono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </span>
  );
}

function AnswerBody({
  spans,
  bg,
  border,
}: {
  spans: AnswerSpan[];
  bg?: string;
  border?: string;
}) {
  return (
    <div
      style={{
        background: bg ?? t.creamSoft,
        border: `1px solid ${border ?? t.line}`,
        borderRadius: radius.bar,
        padding: "16px 18px",
        fontFamily: f.sans,
        fontSize: 14,
        lineHeight: 1.7,
        color: t.coal,
      }}
    >
      {spans.map((span, i) => (
        <span
          key={i}
          className={
            span.highlight === "filler" ? "ir-highlight-filler"
            : span.highlight === "hedge" ? "ir-highlight-hedge"
            : span.highlight === "quantified" ? "ir-highlight-quant"
            : span.highlight === "firstPerson" ? "ir-highlight-first"
            : undefined
          }
        >
          {span.text}
        </span>
      ))}
    </div>
  );
}

export function QuestionDetail({ q }: { q: Question }) {
  const [tab, setTab] = useState<"answer" | "restructured" | "exemplar">("answer");
  const isStrong = q.band === "strong" || q.band === "complete";
  const coachHeading = isStrong ? "Why it landed" : "Why it scored low";
  const coachColor = isStrong ? t.success : t.copper;
  const coachBg = isStrong ? t.successWash : t.leanHireWash;
  const coachBorder = isStrong ? t.successAccent : t.copper100;
  const idBase = `ir-tab-${q.index}`;
  return (
    <div style={{ padding: "0 18px 18px" }}>
      <div role="tablist" aria-label={`Question ${q.index} answer views`} style={{ borderBottom: `1px solid ${t.line}`, marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          id={`${idBase}-answer-tab`}
          aria-selected={tab === "answer"}
          aria-controls={`${idBase}-answer-panel`}
          tabIndex={tab === "answer" ? 0 : -1}
          className="ir-tab-btn"
          onClick={() => setTab("answer")}
        >
          Your Answer
        </button>
        <button
          type="button"
          role="tab"
          id={`${idBase}-restructured-tab`}
          aria-selected={tab === "restructured"}
          aria-controls={`${idBase}-restructured-panel`}
          tabIndex={tab === "restructured" ? 0 : -1}
          className="ir-tab-btn"
          onClick={() => setTab("restructured")}
          disabled={!q.restructured}
          style={!q.restructured ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          Restructured (STAR)
        </button>
        <button
          type="button"
          role="tab"
          id={`${idBase}-exemplar-tab`}
          aria-selected={tab === "exemplar"}
          aria-controls={`${idBase}-exemplar-panel`}
          tabIndex={tab === "exemplar" ? 0 : -1}
          className="ir-tab-btn"
          onClick={() => setTab("exemplar")}
          disabled={!q.topPerformerAnswer}
          style={!q.topPerformerAnswer ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          Top Performer Answer
          <span
            style={{
              marginLeft: 6,
              padding: "1px 6px",
              borderRadius: radius.pill,
              background: t.copperSoft,
              color: t.copper,
              fontFamily: f.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            EXEMPLAR
          </span>
        </button>
      </div>

      <div className="ir-pq-detail-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          {tab === "answer" && (
            <div role="tabpanel" id={`${idBase}-answer-panel`} aria-labelledby={`${idBase}-answer-tab`}>
              <AnswerBody spans={q.answer} />
              <HighlightLegend />
            </div>
          )}
          {tab === "restructured" && q.restructured && (
            <div role="tabpanel" id={`${idBase}-restructured-panel`} aria-labelledby={`${idBase}-restructured-tab`}>
              <div style={{ position: "relative" }}>
                <CornerBadge bg={t.indigo100} color={t.indigo}>AI-RESTRUCTURED</CornerBadge>
                <AnswerBody spans={q.restructured} bg={t.white} border={t.line} />
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.55, margin: "10px 0 0" }}>
                Same content as your answer, reorganized into clean STAR. Save this as your reference version.
              </p>
            </div>
          )}
          {tab === "exemplar" && q.topPerformerAnswer && (
            <div role="tabpanel" id={`${idBase}-exemplar-panel`} aria-labelledby={`${idBase}-exemplar-tab`}>
              <div style={{ position: "relative" }}>
                <CornerBadge bg={t.successTint} color={t.success}>EXEMPLAR</CornerBadge>
                <AnswerBody
                  spans={q.topPerformerAnswer}
                  bg={t.successWash}
                  border={t.successAccent}
                />
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.55, margin: "10px 0 0" }}>
                What an L4-equivalent candidate at this company would say. Use it as a reference shape, not a script — the goal is to internalize the structure.
              </p>
              {q.whatMakesItStrong && q.whatMakesItStrong.length > 0 && (
                <>
                  <div style={{ fontFamily: f.mono, fontSize: 11, color: t.success, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, marginTop: 14 }}>
                    What makes it strong
                  </div>
                  <ul className="ir-strong-list">
                    {q.whatMakesItStrong.map((bullet) => (
                      <li key={bullet} className="ir-strong-list-item">
                        <span className="ir-strong-list-marker" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div
          className="ir-pq-metrics-strip"
          style={{
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: radius.bar,
            padding: "12px 16px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <StarChip active={q.star.situation} letter="S" label="Situation" />
            <StarChip active={q.star.task} letter="T" label="Task" />
            <StarChip active={q.star.action} letter="A" label="Action" />
            <StarChip active={q.star.result} letter="R" label="Result" />
            <StarChip active={q.star.learning} letter="L" label="Learning" />
          </div>
          <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: t.line }} />
          {/* Focus-aware override: if focusMetrics is present (technical,
              case-study, system-design, etc.) render those tiles; otherwise
              fall back to the generic 4. Tone strings map to design tokens. */}
          {(q.focusMetrics
            ? q.focusMetrics.map((m) => ({
                label: m.label,
                value: m.value,
                tone: m.tone === "good" ? t.success
                    : m.tone === "watch" ? t.copper
                    : m.tone === "miss"  ? t.error
                    : t.coal,
              }))
            : [
                { label: "Words", value: `${q.metrics.wordCount}`, tone: t.coal },
                { label: "Length", value: `${q.metrics.responseSec.toFixed(1)}s`, tone: t.coal },
                { label: "First-person", value: `${q.metrics.firstPersonRatioPct}%`, tone: t.coal },
                { label: "Quantified", value: `${q.metrics.quantificationCount}`, tone: q.metrics.quantificationCount === 0 ? t.error : t.coal },
              ]
          ).map((m) => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", minWidth: 64 }}>
              <span style={{ fontFamily: f.mono, fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: t.inkSoft }}>{m.label}</span>
              <span style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 600, color: m.tone, marginTop: 2 }}>{m.value}</span>
            </div>
          ))}
        </div>
        </div>

        <div
          style={{
            background: coachBg,
            border: `1px solid ${coachBorder}`,
            borderRadius: radius.bar,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontFamily: f.mono, fontSize: 11, color: coachColor, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
            {coachHeading}
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.55, margin: 0 }}>
            {q.whyScored}
          </p>
          {q.redFlags && q.redFlags.length > 0 && (
            <ul className="ir-redflag-list" aria-label="Red flags">
              {q.redFlags.map((rf) => (
                <li key={rf.title} className="ir-redflag-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span style={{ flex: 1 }}>
                    <span className="ir-redflag-item-title">{rf.title}.</span>{" "}
                    {rf.explanation}
                    {rf.quote && <span className="ir-redflag-item-quote">&ldquo;{rf.quote}&rdquo;</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!isStrong && q.likelyFollowUp && (
            <div className="ir-likely-followup">
              <span className="ir-likely-followup-eyebrow">Likely follow-up</span>
              {q.likelyFollowUp}
            </div>
          )}
          {q.idealAnswerSnippet && (
            <div
              style={{
                background: t.copperSoft,
                border: `1px solid ${t.copper100}`,
                borderRadius: radius.bar,
                padding: `${space.sm}px ${space.md}px`,
                display: "flex",
                flexDirection: "column",
                gap: space.xs,
              }}
            >
              <span
                style={{
                  fontFamily: f.mono,
                  fontSize: 10,
                  color: t.copper,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Try this instead
              </span>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: t.coal,
                  lineHeight: 1.55,
                  margin: 0,
                  paddingLeft: space.sm,
                  borderLeft: `2px solid ${t.copper100}`,
                }}
              >
                &ldquo;{q.idealAnswerSnippet.text}&rdquo;
              </p>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.inkSoft,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {q.idealAnswerSnippet.whyBetter}
              </p>
            </div>
          )}
          <button type="button" className="ir-cta-primary" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
            Try this question again
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15A9 9 0 1 1 5.64 5.64L1 10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
