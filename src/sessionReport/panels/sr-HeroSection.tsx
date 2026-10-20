/* Extracted from SessionReportView.tsx 2026-05-29 split. Trimmed
 * 2026-05-29: ScoreGauge / Sparkline / ReadinessHeadline /
 * CalibrationBanner / ScoreConfidenceChip moved to ./sr-HeroMetrics
 * so this file stays focused on the hero composition + VERDICT_META +
 * MetricBand (still consumed by sr-CoreMetricsSection).
 * Pure presentation. */

import type * as React from "react";
import { t, f, radius, size } from "../tokens";
import type { DeliveryMetric, InterviewResultData, Verdict } from "../types";
import { ReportCardShell, StatusPill, type Tone } from "./_primitives";
import { atCompany } from "../roleLabel";
import type { SkillTrend } from "../progressTracking";
import {
  CalibrationBanner,
  ReadinessHeadline,
  ScoreConfidenceChip,
  ScoreGauge,
  Sparkline,
} from "./sr-HeroMetrics";

export const VERDICT_META: Record<Verdict, { label: string; tone: Tone; color: string }> = {
  strongHire:   { label: "Strong hire",     tone: "good", color: t.success },
  hire:         { label: "Hire",            tone: "good", color: t.success },
  leanHire:     { label: "Lean hire",       tone: "warn", color: t.warning },
  noHire:       { label: "No hire",         tone: "bad",  color: t.error },
  strongNoHire: { label: "Strong no hire",  tone: "bad",  color: t.error },
};

/* MetricBand stays exported — sr-CoreMetricsSection consumes it to
 * label each delivery tile. */
export function MetricBand({ band }: { band: DeliveryMetric["band"] }) {
  return band === "good" ? (
    <StatusPill tone="good">On target</StatusPill>
  ) : band === "ok" ? (
    <StatusPill tone="neutral">Close</StatusPill>
  ) : (
    <StatusPill tone="warn">Needs work</StatusPill>
  );
}

const LIST_LABEL: React.CSSProperties = { fontFamily: f.sans, fontSize: size.sm, fontWeight: 600, color: t.inkSoft, margin: "0 0 10px" };
const LIST: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 };
const LI: React.CSSProperties = { display: "flex", gap: 8, fontFamily: f.sans, fontSize: size.md, color: t.coal, lineHeight: 1.45 };

function biggestMover(trends: SkillTrend[] | undefined, direction: 1 | -1): SkillTrend | undefined {
  if (!trends) return undefined;
  const best = [...trends].sort((a, b) => direction * (b.deltaVsLast - a.deltaVsLast))[0];
  return best && direction * best.deltaVsLast >= 5 ? best : undefined;
}

export function HeroSection({ data, progressTrends }: { data: InterviewResultData; progressTrends?: SkillTrend[] }) {
  const verdict = VERDICT_META[data.verdict];
  const mover = data.scoreDelta !== 0 ? biggestMover(progressTrends, data.scoreDelta > 0 ? 1 : -1) : undefined;
  return (
    <ReportCardShell
      id="ir-section-hero"
      ariaLabelledBy="ir-hero-heading"
      padding="4px 0 28px"
    >
      <h2 id="ir-hero-heading" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        Interview Report: {data.role}{atCompany(data.company)}, scored {data.overallScore} out of 100
      </h2>
      {data.readiness && (
        <ReadinessHeadline
          readiness={data.readiness}
          daysUntil={data.daysUntilInterview}
          role={data.role}
          level={data.level}
          company={data.company}
        />
      )}

      <div className="ir-hero-grid" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <ScoreGauge score={data.overallScore} color={verdict.color} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <StatusPill tone={verdict.tone}>{verdict.label}</StatusPill>
            {data.scoreConfidence && data.scoreConfidence !== "high" && (
              <ScoreConfidenceChip level={data.scoreConfidence} note={data.scoreConfidenceNote} />
            )}
            {data.recentScores && data.recentScores.length >= 2 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: size.base, color: t.inkSoft }}>
                <Sparkline points={data.recentScores} />
                <span>Last {data.recentScores.length} sessions</span>
                {data.scoreDelta !== 0 && (
                  <span style={{ color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                    {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)} pts
                  </span>
                )}
              </span>
            ) : data.scoreDelta !== 0 ? (
              <span style={{ fontFamily: f.sans, fontSize: size.base, color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)} pts
                <span style={{ color: t.inkSoft, fontWeight: 400, marginLeft: 4 }}>vs last</span>
              </span>
            ) : null}
          </div>
          {mover && (
            <p style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft, margin: 0, textAlign: "center" }}>
              Biggest move: {mover.skill} {mover.deltaVsLast > 0 ? "up" : "down"} {Math.abs(mover.deltaVsLast)}
            </p>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <p style={LIST_LABEL}>Summary</p>
          <p style={{ fontFamily: f.sans, fontSize: size.lg, color: t.coal, lineHeight: 1.5, margin: 0 }}>
            {data.aiVerdict}
          </p>
          {data.calibration && (
            <div style={{ marginTop: 12 }}>
              {data.calibration.companyLabel.toLowerCase() !== "generic" && <CalibrationBanner calibration={data.calibration} />}
              {data.calibration.note && (
                <p style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft, lineHeight: 1.45, margin: "6px 0 0" }}>
                  {/* Notes may or may not already end in a period; collapse
                      any trailing period/space to exactly one so we never
                      render "scoring..". */}
                  {data.calibration.note.replace(/[.\s]+$/, "")}.
                </p>
              )}
            </div>
          )}
          {data.fairnessSignals && data.fairnessSignals.notes.length > 0 && (
            <div
              style={{ marginTop: 12, padding: "10px 12px", borderRadius: radius.lg, background: t.creamSoft, border: `1px solid ${t.line}` }}
              role="region"
              aria-label="India-context fairness applied during scoring"
            >
              <p style={{ ...LIST_LABEL, margin: "0 0 6px" }}>India-context fairness applied</p>
              <ul style={{ ...LIST, gap: 5 }}>
                {data.fairnessSignals.notes.map((n) => (
                  <li key={n} style={{ ...LI, fontSize: size.sm }}>
                    <span aria-hidden="true" style={{ color: t.success, flexShrink: 0 }}>✓</span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="ir-strengths-improvements" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 28 }}>
        <div>
          <p style={LIST_LABEL}>Top strengths</p>
          <ul style={LIST}>
            {data.strengths.length > 0 ? data.strengths.map((s) => (
              <li key={s} style={LI}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {s}
              </li>
            )) : (
              <li style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft }}>
                Not enough signal to surface strengths. Try a longer session.
              </li>
            )}
          </ul>
        </div>
        <div>
          <p style={LIST_LABEL}>Top improvements</p>
          <ul style={LIST}>
            {data.improvements.map((s) => (
              <li key={s} style={LI}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.warning} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ReportCardShell>
  );
}
