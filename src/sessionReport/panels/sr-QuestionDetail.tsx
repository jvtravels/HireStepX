/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Per-question detail panel: tabs (answer / restructured / exemplar),
 * STAR + metrics strip, coaching column. Includes its co-located atoms
 * (StarChip, HighlightLegend, AnswerBody).
 * Pure presentation. */

import { useState } from "react";
import { t, f, radius, space, size } from "../tokens";
import type { AnswerSpan, Question } from "../types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

function StarChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={active ? "ir-star-chip ir-star-chip-on" : "ir-star-chip"}
      title={active ? `${label} found in your answer` : `${label} not found in your answer`}
    >
      {active ? "\u2713 " : ""}{label}
    </span>
  );
}

function HighlightLegend() {
  const items: { cls: string; label: string }[] = [
    { cls: "ir-highlight-filler", label: "Filler words" },
    { cls: "ir-highlight-hedge", label: "Hedging" },
    { cls: "ir-highlight-quant", label: "Numbers and impact" },
    { cls: "ir-highlight-first", label: "\u201CI\u201D statements" },
  ];
  return (
    <div className="ir-legend">
      {items.map((i) => (
        <span key={i.label} className="ir-legend-item">
          <span className={`${i.cls} ir-legend-swatch`} aria-hidden="true" />
          {i.label}
        </span>
      ))}
    </div>
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
        fontSize: size.md,
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

const LABEL: React.CSSProperties = { fontFamily: f.sans, fontSize: size.sm, fontWeight: 600, color: t.inkSoft };

export function QuestionDetail({ q, onTryQuestionAgain }: { q: Question; onTryQuestionAgain?: (questionIdx: number) => void }) {
  const [tab, setTab] = useState<"answer" | "restructured" | "exemplar">("answer");
  const isStrong = q.band === "strong" || q.band === "complete";
  const coachHeading = isStrong ? "Why it landed" : "Why it scored low";
  const metricTiles = q.focusMetrics
    ? q.focusMetrics.map((m) => ({
        label: m.label,
        value: m.value,
        tone: m.tone === "good" ? t.success : m.tone === "watch" ? t.warning : m.tone === "miss" ? t.error : t.coal,
      }))
    : [
        { label: "Words", value: `${q.metrics.wordCount}`, tone: t.coal },
        { label: "Length", value: `${q.metrics.responseSec.toFixed(0)}s`, tone: t.coal },
        { label: "First-person", value: `${q.metrics.firstPersonRatioPct}%`, tone: t.coal },
        { label: "Quantified", value: `${q.metrics.quantificationCount}`, tone: q.metrics.quantificationCount === 0 ? t.warning : t.coal },
      ];
  return (
    <div style={{ padding: "0 18px 18px" }}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList variant="line" aria-label={`Question ${q.index} answer views`} className="mb-4">
          <TabsTrigger value="answer">Your answer</TabsTrigger>
          <TabsTrigger value="restructured" disabled={!q.restructured}>Restructured (STAR)</TabsTrigger>
          <TabsTrigger value="exemplar" disabled={!q.topPerformerAnswer}>Model answer</TabsTrigger>
        </TabsList>

        <div className="ir-pq-detail-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div>
              <TabsContent value="answer">
                <AnswerBody spans={q.answer} />
                <HighlightLegend />
              </TabsContent>
              {q.restructured && (
                <TabsContent value="restructured">
                  <AnswerBody spans={q.restructured} bg={t.white} border={t.line} />
                  <p style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft, lineHeight: 1.55, margin: "10px 0 0" }}>
                    Same content as your answer, reorganized into clean STAR. Save this as your reference version.
                  </p>
                </TabsContent>
              )}
              {q.topPerformerAnswer && (
                <TabsContent value="exemplar">
                  <AnswerBody spans={q.topPerformerAnswer} bg={t.white} border={t.line} />
                  <p style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft, lineHeight: 1.55, margin: "10px 0 0" }}>
                    What a strong candidate would say. Use it as a shape to copy, not a script.
                  </p>
                  {q.whatMakesItStrong && q.whatMakesItStrong.length > 0 && (
                    <>
                      <div style={{ ...LABEL, marginTop: 14 }}>What makes it strong</div>
                      <ul className="ir-strong-list" style={{ marginTop: 6 }}>
                        {q.whatMakesItStrong.map((bullet) => (
                          <li key={bullet} className="ir-strong-list-item">
                            <span className="ir-strong-list-marker" aria-hidden="true" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </TabsContent>
              )}
            </div>

            <div className="ir-pq-metrics-strip" style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${t.line}`, paddingTop: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ ...LABEL, marginRight: 4 }}>STAR structure</span>
                <StarChip active={q.star.situation} label="Situation" />
                <StarChip active={q.star.task} label="Task" />
                <StarChip active={q.star.action} label="Action" />
                <StarChip active={q.star.result} label="Result" />
                <StarChip active={q.star.learning} label="Learning" />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px" }}>
                {metricTiles.map((m) => (
                  <div key={m.label} style={{ display: "flex", flexDirection: "column", minWidth: 64 }}>
                    <span style={{ ...LABEL, fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontFamily: f.sans, fontSize: size.lg, fontWeight: 600, color: m.tone, marginTop: 1 }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 0,
            }}
          >
            <div style={{ fontFamily: f.sans, fontSize: size.base, fontWeight: 600, color: t.coal }}>{coachHeading}</div>
            {q.whyScored && (
              <p style={{ fontFamily: f.sans, fontSize: size.md, color: t.coal, lineHeight: 1.55, margin: 0 }}>{q.whyScored}</p>
            )}
            {q.redFlags && q.redFlags.length > 0 && (
              <ul className="ir-redflag-list" aria-label="Red flags">
                {q.redFlags.map((rf) => (
                  <li key={rf.title} className="ir-redflag-item">
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
            {!isStrong && q.idealAnswerSnippet && (
              <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: radius.bar, padding: `${space.sm}px ${space.md}px`, display: "flex", flexDirection: "column", gap: space.xs }}>
                <span style={LABEL}>Try this instead</span>
                <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.coal, lineHeight: 1.55, margin: 0 }}>
                  &ldquo;{q.idealAnswerSnippet.text}&rdquo;
                </p>
                <p style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft, lineHeight: 1.5, margin: 0 }}>
                  {q.idealAnswerSnippet.whyBetter}
                </p>
              </div>
            )}
            {onTryQuestionAgain && (
              <Button type="button" variant={isStrong ? "outline" : "default"} size="sm" className="self-start" onClick={() => onTryQuestionAgain(q.index)}>
                Try this question again
              </Button>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
