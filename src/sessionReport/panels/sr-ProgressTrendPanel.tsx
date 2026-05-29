/* Session Report — cross-session skill progress trend panel.
 *
 * Renders a grid of small "trend tiles", one per negotiation skill,
 * showing latest score, delta-arrow vs. prior-session baseline, and a
 * tiny inline SVG sparkline of the score sequence over recent sessions.
 *
 * Purpose: every report today is standalone. This panel is the seam
 * for "am I improving on ESOPs / Anchoring / etc.?" — the first thing
 * users ask once they've taken more than one session.
 *
 * Pure presentation. Takes precomputed `trends` and renders. The trend
 * math itself lives in `../progressTracking/index.ts` so it's easy to
 * unit-test in isolation. Visual language mirrors the other sr-* panels
 * (SrSectionShell wrapper, token-only colors, no chart libraries). */

"use client";

import { t, f, radius } from "../tokens";
import { SrSectionShell } from "./_primitives";
import type { SkillTrend } from "../progressTracking";

/* ─── Sparkline ─────────────────────────────────────────────────────
 * Tiny inline SVG polyline. No library. Domain locked to [0,100] so
 * tiles for skills with high vs. low scores read on the same vertical
 * axis — comparing slopes across the grid is the whole point.
 *
 * Single point renders a centred dot (a polyline needs ≥2 points).
 * Empty sparkline renders nothing (caller handles empty state). */
function Sparkline({
  values,
  color,
  width = 72,
  height = 22,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const yFor = (v: number) =>
    pad + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  if (values.length === 1) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <circle cx={width / 2} cy={yFor(values[0])} r={2.5} fill={color} />
      </svg>
    );
  }

  const step = innerW / (values.length - 1);
  const points = values
    .map((v, i) => `${pad + i * step},${yFor(v)}`)
    .join(" ");

  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Arrow glyph + color ───────────────────────────────────────────
 * Maps trend → token color so a palette shift touches one file.
 * Up = success (green), down = error (red), flat = inkSoft (warm gray). */
function trendColor(trend: SkillTrend["trend"]): string {
  switch (trend) {
    case "up": return t.success;
    case "down": return t.error;
    case "flat": return t.inkSoft;
  }
}

function ArrowGlyph({ trend }: { trend: SkillTrend["trend"] }) {
  const color = trendColor(trend);
  if (trend === "up") {
    return (
      <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
        <polyline points="2,8 6,3 10,8" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
        <polyline points="2,4 6,9 10,4" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      <line x1={2} y1={6} x2={10} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/* ─── Trend tile ────────────────────────────────────────────────────
 * Skill name + latest score, delta-arrow row, sparkline. Matches the
 * creamSoft/line/radius.bar tile vocabulary used by sr-CoreMetricsSection
 * so the two sections sit visually adjacent without jarring. */
function TrendTile({ trend }: { trend: SkillTrend }) {
  const color = trendColor(trend.trend);
  const deltaSign = trend.deltaVsLast > 0 ? "+" : "";
  const deltaText =
    trend.sparkline.length <= 1
      ? "first session"
      : `${deltaSign}${trend.deltaVsLast.toFixed(0)} pts vs last`;
  return (
    <div
      style={{
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        borderRadius: radius.bar,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: f.sans,
          fontSize: 12,
          color: t.inkSoft,
          letterSpacing: "0.02em",
        }}
      >
        {trend.skill}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: f.serif,
            fontSize: 28,
            color: t.coal,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {trend.latestScore.toFixed(0)}
        </span>
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 10,
            color: t.inkSoft,
            letterSpacing: "0.04em",
          }}
        >
          / 100
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowGlyph trend={trend.trend} />
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            color,
            letterSpacing: "0.03em",
          }}
        >
          {deltaText}
        </span>
      </div>
      <Sparkline values={trend.sparkline} color={color} />
    </div>
  );
}

/* ─── Panel ─────────────────────────────────────────────────────────
 * Empty state when no history yet — the user hasn't completed a second
 * session, so there's nothing to trend on. Friendly copy not a hidden
 * panel: showing the empty state teaches that the feature exists and
 * sets the expectation for session #2. */
export function ProgressTrendPanel({ trends }: { trends: SkillTrend[] }) {
  const hasAnyHistory = trends.some((tr) => tr.sparkline.length > 0);
  return (
    <SrSectionShell
      anchorId="ir-section-progress-trend"
      headingId="ir-progress-trend-heading"
      num="03"
      label="Across sessions"
      title="Skill Progress"
      subtitle="How your negotiation skills are trending vs. prior sessions."
    >
      {hasAnyHistory && trends.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {trends.map((tr) => (
            <TrendTile key={tr.skill} trend={tr} />
          ))}
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: "18px 20px",
            background: t.creamSoft,
            border: `1px dashed ${t.lineStrong}`,
            borderRadius: radius.bar,
            fontFamily: f.sans,
            fontSize: 13,
            color: t.inkSoft,
          }}
        >
          Your first session — track progress from session 2 onward.
        </div>
      )}
    </SrSectionShell>
  );
}

export default ProgressTrendPanel;
