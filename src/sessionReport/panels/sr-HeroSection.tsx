/* Extracted from SessionReportView.tsx 2026-05-29 split. Trimmed
 * 2026-05-29: ScoreGauge / Sparkline / ReadinessHeadline /
 * CalibrationBanner / ScoreConfidenceChip moved to ./sr-HeroMetrics
 * so this file stays focused on the hero composition + VERDICT_META +
 * MetricBand (still consumed by sr-CoreMetricsSection).
 * Pure presentation. */

import { t, f, radius } from "../tokens";
import { formatRoleWithLevel } from "../roleLabel";
import type { DeliveryMetric, InterviewResultData, Verdict } from "../types";
import { ReportCardShell } from "./_primitives";
import {
  CalibrationBanner,
  ReadinessHeadline,
  ScoreConfidenceChip,
  ScoreGauge,
  Sparkline,
} from "./sr-HeroMetrics";

export const VERDICT_META: Record<Verdict, { label: string; bg: string; color: string }> = {
  strongHire:   { label: "Strong Hire",     bg: t.successTint,     color: t.success },
  hire:         { label: "Hire",            bg: t.successWash,     color: t.success },
  leanHire:     { label: "Lean Hire",       bg: t.copperWashLean,  color: t.copper },
  noHire:       { label: "No Hire",         bg: t.errorTint,       color: t.error },
  strongNoHire: { label: "Strong No Hire",  bg: t.errorMid,        color: t.error },
};

/* MetricBand stays exported — sr-CoreMetricsSection consumes it to
 * label each delivery tile. */
export function MetricBand({ band }: { band: DeliveryMetric["band"] }) {
  const meta =
    band === "good"
      ? { label: "Good", color: t.success, bg: t.successTint }
      : band === "ok"
        ? { label: "On Target", color: t.copper, bg: t.copperAccent }
        : { label: "Needs Work", color: t.error, bg: t.errorTint };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: radius.pill,
        background: meta.bg,
        color: meta.color,
        fontFamily: f.sans,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {meta.label}
    </span>
  );
}

export function HeroSection({ data }: { data: InterviewResultData }) {
  const verdict = VERDICT_META[data.verdict];
  return (
    <ReportCardShell
      id="ir-section-hero"
      ariaLabelledBy="ir-hero-heading"
      padding={28}
    >
      <h1 id="ir-hero-heading" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        Interview Report — {data.role} at {data.company}, scored {data.overallScore} out of 100
      </h1>
      {data.readiness && (
        <ReadinessHeadline
          readiness={data.readiness}
          daysUntil={data.daysUntilInterview}
          role={data.role}
          level={data.level}
          company={data.company}
        />
      )}

      {/* Top row: company / role / level / difficulty pills */}
      <div className="ir-pill-bar" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <span className="ir-pill">
          <span style={{ fontSize: 13 }}>🟢</span>
          {data.company}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Company</span>
        </span>
        <span className="ir-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="2" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          {data.role}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Role</span>
        </span>
        {data.level && (
          <span className="ir-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
            {data.level}
            <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Level</span>
          </span>
        )}
        <span className="ir-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          {data.difficulty}
          <span style={{ color: t.inkSoft, fontSize: 11, marginLeft: 4 }}>Difficulty</span>
        </span>
      </div>

      <div className="ir-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2fr", gap: 32, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Overall Score
          </div>
          <div style={{ display: "inline-block" }}>
            <ScoreGauge score={data.overallScore} color={verdict.color} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 14px",
                borderRadius: radius.pill,
                background: verdict.bg,
                color: verdict.color,
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {verdict.label}
            </span>
            {data.scoreConfidence && data.scoreConfidence !== "high" && (
              <ScoreConfidenceChip level={data.scoreConfidence} note={data.scoreConfidenceNote} />
            )}
            {data.recentScores && data.recentScores.length >= 2 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                <Sparkline points={data.recentScores} />
                {data.scoreDelta !== 0 && (
                  <span style={{ color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                    {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)}
                  </span>
                )}
              </span>
            ) : data.scoreDelta !== 0 ? (
              <span style={{ fontFamily: f.sans, fontSize: 13, color: data.scoreDelta > 0 ? t.success : t.error, fontWeight: 600 }}>
                {data.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(data.scoreDelta)} pts
                <span style={{ color: t.inkSoft, fontWeight: 400, marginLeft: 4 }}>vs last</span>
              </span>
            ) : null}
          </div>
          {typeof data.percentile === "number" && (
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5, margin: "12px 0 0" }}>
              <span style={{ color: t.coal, fontWeight: 600, fontFamily: f.serif, fontSize: 16 }}>Top {100 - data.percentile}%</span>{" "}
              of {formatRoleWithLevel(data.level, data.role.split(" ").slice(0, 2).join(" "))} candidates targeting {data.company}.
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "18px 22px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                AI Interview Verdict
              </span>
            </div>
            <p style={{ fontFamily: f.serif, fontSize: 18, color: t.coal, lineHeight: 1.45, margin: 0 }}>
              {data.aiVerdict}
            </p>
            {data.calibration && (
              <div style={{ marginTop: 12 }}>
                <CalibrationBanner calibration={data.calibration} />
                {data.calibration.note && (
                  <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.45, margin: "6px 0 0" }}>
                    {/* Notes may or may not already end in a period (the
                        "Generic calibration … scoring." default does). Collapse
                        any trailing period/space to exactly one so we never
                        render "scoring..". */}
                    {data.calibration.note.replace(/[.\s]+$/, "")}.
                  </p>
                )}
              </div>
            )}
            {data.fairnessSignals && data.fairnessSignals.notes.length > 0 && (
              <div
                style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: t.successWash, border: `1px solid ${t.successAccent}` }}
                role="note"
                aria-label="India-context fairness applied during scoring"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.mono, fontSize: 10.5, color: t.success, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  India-context fairness applied
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  {data.fairnessSignals.notes.map((n) => (
                    <li key={n} style={{ display: "flex", gap: 8, fontFamily: f.sans, fontSize: 12.5, color: t.coal, lineHeight: 1.4 }}>
                      <span aria-hidden="true" style={{ color: t.success, flexShrink: 0 }}>✓</span>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="ir-strengths-improvements" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.success, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                Top Strengths
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.strengths.map((s) => (
                  <li key={s} style={{ display: "flex", gap: 8, fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                Top Improvements
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.improvements.map((s) => (
                  <li key={s} style={{ display: "flex", gap: 8, fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                      <line x1="12" y1="8" x2="12" y2="13" />
                      <line x1="12" y1="16" x2="12" y2="16.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ReportCardShell>
  );
}
