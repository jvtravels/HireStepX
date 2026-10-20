/* Session Report: cross-session skill progress. One compact row per skill
 * with score, a small neutral sparkline and a plain-language change chip.
 * Trend math lives in `../progressTracking/index.ts`. */

"use client";

import { SrSectionShell } from "./_primitives";
import type { SkillTrend } from "../progressTracking";

type Shown = "up" | "down" | "flat" | "new";

function Sparkline({ values, dotClass, width = 64, height = 22 }: { values: number[]; dotClass: string; width?: number; height?: number }) {
  if (values.length === 0) return null;
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const yFor = (v: number) => pad + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const xs = values.map((_, i) => (values.length > 1 ? pad + i * step : width / 2));
  const last = values.length - 1;
  return (
    <svg className="ir-trend-spark" width={width} height={height} aria-hidden="true">
      {values.length > 1 && (
        <polyline
          points={values.map((v, i) => `${xs[i]},${yFor(v)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle className={dotClass} cx={xs[last]} cy={yFor(values[last])} r={2.5} fill="currentColor" />
    </svg>
  );
}

function rowState(trend: SkillTrend): { shown: Shown; label: string } {
  if (trend.sparkline.length <= 1) return { shown: "new", label: "New" };
  const d = Math.round(trend.deltaVsLast);
  if (Math.abs(trend.deltaVsLast) < 3) return { shown: "flat", label: "No change" };
  return d > 0 ? { shown: "up", label: `+${d}` } : { shown: "down", label: `−${Math.abs(d)}` };
}

function TrendRow({ trend }: { trend: SkillTrend }) {
  const { shown, label } = rowState(trend);
  const cls = shown === "up" ? "ir-trend-delta-up" : shown === "down" ? "ir-trend-delta-down" : "ir-trend-delta-flat";
  return (
    <li className="ir-trend-row">
      <span className="ir-trend-name">{trend.skill}</span>
      <span className="text-muted-foreground inline-flex">
        <Sparkline values={trend.sparkline} dotClass={cls} />
      </span>
      <span className="ir-trend-score">{trend.latestScore.toFixed(0)}</span>
      <span
        className={`ir-trend-delta ${cls}`}
        title={shown === "new" ? "First session for this skill" : `Change since your last session: ${label}`}
      >
        {label}
      </span>
    </li>
  );
}

export function ProgressTrendPanel({ trends }: { trends: SkillTrend[] }) {
  const hasAnyHistory = trends.some((tr) => tr.sparkline.length > 0);
  return (
    <SrSectionShell
      anchorId="ir-section-progress-trend"
      headingId="ir-progress-trend-heading"
      label="Skill progress"
      title="Progress over time"
      subtitle="Score out of 100 for each skill, and the change since your last session."
    >
      {hasAnyHistory && trends.length > 0 ? (
        <ul className="ir-trend-grid m-0 list-none p-0">
          {trends.map((tr) => (
            <TrendRow key={tr.skill} trend={tr} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          This is your first session. Progress shows up from session 2.
        </p>
      )}
    </SrSectionShell>
  );
}

export default ProgressTrendPanel;
