/* Session Report: cross-session skill progress. One compact row per skill
 * with score, a small neutral sparkline and a plain-language change chip.
 * Trend math lives in `../progressTracking/index.ts`. */

"use client";

import { SrSectionShell } from "./_primitives";
import type { SkillTrend } from "../progressTracking";
import { GOOD_MIN, SCORE_BAND_LABEL, STRONG_MIN, scoreBandKey } from "../../scoreBands";

type Shown = "up" | "down" | "flat" | "new";

const SKILL_PLAIN: Record<string, { meaning: string; ifLow: string }> = {
  "Communication": { meaning: "How clearly you say things.", ifLow: "Interviewers may struggle to follow you. Use shorter sentences and cut filler words like \"basically\" and \"you know\"." },
  "Structure": { meaning: "Whether your answer has a clear start, middle and end.", ifLow: "Answers can feel like rambling. Try Situation, Task, Action, Result: one sentence each." },
  "Technical Depth": { meaning: "How well you show you know your field.", ifLow: "You may sound surface level. Name the tools you used and explain why you chose them." },
  "Leadership": { meaning: "Whether you show you took ownership, not just took part.", ifLow: "Say \"I decided\" and \"I led\" where it is true, and describe what you drove." },
  "Problem Solving": { meaning: "How you break down a problem and reach a solution.", ifLow: "Walk through your thinking out loud: the cause, the options, and why you picked one." },
  "Confidence": { meaning: "How sure and decisive you sound.", ifLow: "Hedging (\"maybe\", \"I think\") makes good answers sound weak. State your point first, then explain." },
  "Specificity": { meaning: "Using real numbers and examples instead of general claims.", ifLow: "Answers sound vague. Add one number to each story, like a percentage, a team size or a time saved." },
  "Adaptability": { meaning: "How well you handle follow-up and curveball questions.", ifLow: "Follow-ups may throw you. Pause, restate the question, then answer the new angle." },
  "Business Impact": { meaning: "Whether you link your work to results the company cares about.", ifLow: "Finish each story with the outcome: revenue, cost saved, time saved or users gained." },
  "Answer Completeness": { meaning: "Whether you answered every part of the question.", ifLow: "You may be skipping parts. Before you finish, check that you covered what was asked." },
};

function plainFor(skill: string) {
  return SKILL_PLAIN[skill] ?? SKILL_PLAIN[skill.replace(/-/g, " ")];
}

export function band(score: number): { label: string; weak: boolean } {
  const key = scoreBandKey(score);
  return { label: SCORE_BAND_LABEL[key], weak: key === "needsWork" };
}

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
      <span className="ir-trend-name">
        {trend.skill}
        {plainFor(trend.skill) && <span className="ir-trend-desc">{plainFor(trend.skill)!.meaning}</span>}
      </span>
      <span className="text-muted-foreground inline-flex">
        <Sparkline values={trend.sparkline} dotClass={cls} />
      </span>
      <span className="ir-trend-score">
        {trend.latestScore.toFixed(0)}
        <span className="ir-trend-band">{band(trend.latestScore).label}</span>
      </span>
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
  const weakest = trends.length > 0 ? trends.reduce((a, b) => (b.latestScore < a.latestScore ? b : a)) : null;
  const weakestPlain = weakest && band(weakest.latestScore).weak ? plainFor(weakest.skill) : undefined;
  return (
    <SrSectionShell
      anchorId="ir-section-progress-trend"
      headingId="ir-progress-trend-heading"
      label="Interview skills"
      title="Interview skills over time"
      subtitle="The same ten skills are scored in every interview, whatever the role, so you can see them move. The line shows your last few sessions, and the change is versus your previous one."
    >
      {hasAnyHistory && trends.length > 0 ? (
        <>
          <ul className="ir-trend-grid m-0 list-none p-0">
            {trends.map((tr) => (
              <TrendRow key={tr.skill} trend={tr} />
            ))}
          </ul>
          <p className="ir-trend-legend">{STRONG_MIN} and above is strong, {GOOD_MIN} to {STRONG_MIN - 1} is good, below {GOOD_MIN} needs work.</p>
          {weakest && weakestPlain && (
            <p className="ir-trend-weakest">
              <strong>Lowest right now: {weakest.skill} ({weakest.latestScore.toFixed(0)}).</strong> {weakestPlain.ifLow}
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          This is your first session. Progress shows up from session 2.
        </p>
      )}
    </SrSectionShell>
  );
}

export default ProgressTrendPanel;
