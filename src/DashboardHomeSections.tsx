"use client";

/* Presentational sections for the candidate dashboard home (DashboardHome.tsx).
   Same system as the employer dashboard: one white container (drawn by the page)
   holding hairline-separated sections, so nothing is a card inside a card. Each
   section pads itself with PANEL and the parent draws the dividers between them.
   Presentational only, driven entirely by props. */

import { useEffect, useState } from "react";
import { ArrowRightIcon, ClockIcon, TargetIcon } from "lucide-react";
import type { PracticeCoverage, EvidenceCapability } from "./dashboardData";
import { hoursOrDaysAgo } from "./hiringMatchFormat";
import { useHiringActivity } from "./useHiringActivity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AnimatedNumber from "./AnimatedNumber";

/* Sections sit in the page's container; the parent draws the hairlines between them. */
export const PANEL = "min-w-0 px-5 py-5 min-[640px]:px-7 min-[640px]:py-6";
export const PANEL_H2 = "m-0 text-[15px] font-semibold text-hx-coal";

/* ─── shared bits ─── */

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}
      className="h-1.5 overflow-hidden rounded-full bg-hx-line"
    >
      <div className="mx-grow h-full rounded-full bg-hx-coal" style={{ width: `${pct}%` }} />
    </div>
  );
}

const TAG_TONE = {
  neutral: "bg-hx-soft text-hx-neutral-ink",
  error: "bg-hx-error-100 text-hx-error-ink",
  success: "bg-hx-success-100 text-hx-success-ink",
  indigo: "bg-hx-indigo-100 text-hx-indigo-deep",
} as const;

export function Tag({ label, tone = "neutral", title }: { label: string; tone?: keyof typeof TAG_TONE; title?: string }) {
  return (
    <Badge title={title} className={cn("h-auto px-2.5 py-1 text-xs font-semibold", TAG_TONE[tone])}>{label}</Badge>
  );
}

/* ─── Header ─── */

/* Time-of-day greeting, resolved after mount so the server render and the
   first client paint agree. */
function useGreeting(hasData: boolean) {
  const fallback = hasData ? "Welcome Back" : "Welcome";
  const [greeting, setGreeting] = useState(fallback);
  useEffect(() => {
    if (!hasData) { setGreeting("Welcome"); return; }
    const h = new Date().getHours();
    setGreeting(h < 5 ? "Working late" : h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening");
  }, [hasData]);
  return greeting;
}

export function DashboardHeader({
  displayName, hasData, targetRole, seniorityLevel, readinessGap,
}: {
  displayName: string;
  hasData: boolean;
  targetRole: string;
  seniorityLevel: string | null;
  readinessGap: number;
}) {
  const roleLabel = targetRole || "your target role";
  const greeting = useGreeting(hasData);
  // Role titles often already carry the level ("Senior Product Designer") —
  // prefixing again rendered "Senior Senior Product Designer".
  const seniorityPrefix = seniorityLevel && !roleLabel.toLowerCase().startsWith(seniorityLevel.toLowerCase())
    ? `${seniorityLevel} ` : "";
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-5 min-[640px]:px-7">
      <div className="min-w-0">
        <h1 className="m-0 text-[20px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{greeting}, {displayName}</h1>
        <p className="m-0 mt-1 text-[14px] text-hx-ink-soft">
          {readinessGap > 0
            ? `You're ${readinessGap} points away from your ${seniorityPrefix}${roleLabel} readiness target.`
            : `You've hit your ${seniorityPrefix}${roleLabel} readiness target. Keep practicing to stay sharp.`}
        </p>
      </div>
      {targetRole && (
        <Badge className="h-auto gap-1.5 bg-hx-soft px-2.5 py-1 text-xs font-semibold text-hx-neutral-ink">
          <TargetIcon size={12} aria-hidden="true" />
          {targetRole}
        </Badge>
      )}
    </header>
  );
}

/* ─── Your Next Move / Your First Step ─── */

const NEXT_MOVE_DESCRIPTION =
  "Practice real interview questions and get AI feedback on your response. This helps you improve your readiness and build stronger evidence for employers.";

export function NextMoveCard({ isFirstTimer, ctaLabel, onStart, sessionMinutes, sessionQuestionCount, chips, headline }: {
  isFirstTimer: boolean;
  ctaLabel: string;
  onStart: () => void;
  /** Real minutes + question count for the session this CTA launches
   *  (data/session-length.ts via nextMove.ts) — not a guessed placeholder. */
  sessionMinutes: number;
  sessionQuestionCount: number;
  /** Streak / smart-schedule context chips from nextMove.ts — optional,
   *  omitted entirely (not even an empty row) when there's nothing to show. */
  chips?: { kind: "streak" | "schedule"; label: string }[];
  /** nextMove.ts's own headline (streak-aware, gap-aware, first-time-aware) —
   *  preferred over the generic "Practice X" title derived from the skill
   *  key alone, which ignored streak/gap context nextMove.ts already computed. */
  headline?: string;
}) {
  const title = headline || "Start a new practice session";

  return (
    <section aria-labelledby="dh-next-heading" className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 bg-hx-soft px-5 py-5 min-[640px]:px-7 min-[640px]:py-6">
      <div className="min-w-0 flex-[1_1_360px]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-hx-ink-soft">
            <TargetIcon size={14} aria-hidden="true" className="text-hx-indigo" />
            {isFirstTimer ? "Your First Step" : "Your Next Move"}
          </span>
          {chips?.map((c) => (
            <Tag key={c.label} label={c.label} tone={c.kind === "streak" ? "indigo" : "neutral"} />
          ))}
        </div>
        <h2 id="dh-next-heading" className="m-0 text-[18px] font-semibold leading-snug text-hx-coal [overflow-wrap:anywhere]">{title}</h2>
        <p className="m-0 mt-1 max-w-[62ch] text-[14px] leading-relaxed text-hx-ink-soft">{NEXT_MOVE_DESCRIPTION}</p>
      </div>
      <div className="flex flex-col items-start gap-2 min-[640px]:items-end">
        <Button type="button" size="lg" onClick={onStart}>
          {ctaLabel}
          <ArrowRightIcon size={16} aria-hidden="true" />
        </Button>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-hx-ink-soft">
          <ClockIcon size={13} aria-hidden="true" />
          About {sessionMinutes} min, {sessionQuestionCount} questions
        </span>
      </div>
    </section>
  );
}

/* ─── Stat strip: four divided columns, no tiles ─── */

const STAT_CELL = "flex min-w-0 flex-col gap-1.5 border-hx-line px-5 py-4 min-[640px]:px-7 min-[640px]:py-5";
const STAT_LABEL = "text-[13px] text-hx-ink-soft";
const STAT_VALUE = "text-[28px] font-semibold leading-[1.15] tabular-nums text-hx-coal";
const STAT_ROW = "h-auto w-full justify-between gap-2 rounded-none px-0 py-1.5 text-left text-[13px] font-semibold text-hx-coal hover:bg-transparent";

export function StatCardsRow({
  hasData, readinessScore, readinessDelta, resumeScore, improvementsCount,
  practiceCoverage, totalSessions, onViewResume, onViewJobs, loading = false,
}: {
  loading?: boolean;
  hasData: boolean;
  readinessScore: number;
  readinessDelta: number | null;
  resumeScore: number | null;
  improvementsCount: number;
  practiceCoverage: PracticeCoverage;
  totalSessions: number;
  onViewResume: () => void;
  onViewJobs: () => void;
}) {
  const hiring = useHiringActivity();
  const unlockedCount = hiring?.unlockedCount ?? 0;
  const latestMatch = hiring?.recent?.[0] ?? null;
  /* Two columns below 1000px (a 2x2 grid), four in one row above it. */
  const borders = ["border-r border-b min-[1000px]:border-b-0", "border-b min-[1000px]:border-r min-[1000px]:border-b-0", "border-r", ""];

  return (
    <section aria-label="Interview readiness summary" className="mx-stagger min-w-0">
      <ul className="m-0 grid list-none grid-cols-2 p-0 min-[1000px]:grid-cols-4">
        <li className={`${STAT_CELL} ${borders[0]}`}>
          <div className={STAT_LABEL}>Interview readiness</div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={STAT_VALUE}>{loading ? "–" : <AnimatedNumber value={hasData ? readinessScore : 0} />}</span>
            <span className="text-[12px] text-hx-ink-soft">/ 100</span>
            {!loading && readinessDelta != null && readinessDelta !== 0 && (
              <Tag
                tone={readinessDelta > 0 ? "success" : "error"}
                label={`${readinessDelta > 0 ? "+" : ""}${readinessDelta}`}
                title={`Change since your last session: ${readinessDelta > 0 ? "up" : "down"} ${Math.abs(readinessDelta)} points. A drop usually means your latest session covered a tougher question type or role than before.`}
              />
            )}
          </div>
          <ProgressBar value={!loading && hasData ? readinessScore : 0} />
        </li>

        <li className={`${STAT_CELL} ${borders[1]}`}>
          <div className={STAT_LABEL}>Resume strength</div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={STAT_VALUE}>{loading ? "–" : <AnimatedNumber value={resumeScore ?? 0} />}</span>
            <span className="text-[12px] text-hx-ink-soft">/ 100</span>
            {!loading && improvementsCount > 0 && <Tag label={`${improvementsCount} to improve`} />}
          </div>
          <ProgressBar value={loading ? 0 : resumeScore ?? 0} />
          <Button type="button" variant="link" size="sm" onClick={onViewResume} className="self-start text-[13px] text-hx-indigo">
            View details
            <ArrowRightIcon size={14} aria-hidden="true" />
          </Button>
        </li>

        <li className={`${STAT_CELL} ${borders[2]}`}>
          <div className={STAT_LABEL}>Practice coverage</div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={STAT_VALUE}>
              {loading ? "–" : <AnimatedNumber value={practiceCoverage.practicedCount} suffix={`/${practiceCoverage.totalAreas}`} />}
            </span>
            <span className="text-[12px] text-hx-ink-soft">areas</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: practiceCoverage.totalAreas }, (_, i) => {
              const filled = !loading && i < practiceCoverage.practicedCount;
              return <div key={i} className={cn("h-1.5 flex-1 rounded-full", filled ? "mx-pop bg-hx-coal" : "bg-hx-line")} />;
            })}
          </div>
          {!loading && practiceCoverage.biggestGapLabel && (
            <div><Tag tone="error" label={`Biggest gap: ${practiceCoverage.biggestGapLabel}`} /></div>
          )}
          {/* practicedCount tracks the 5 scored competency areas, not session
              count — a long history of pre-skill-tracking sessions can leave
              this at 0 even with plenty of total sessions. Spell that out so
              it doesn't read as a contradiction/bug. */}
          {!loading && practiceCoverage.practicedCount === 0 && totalSessions > 0 && (
            <div className="text-[12px] text-hx-ink-soft">
              Your {totalSessions} session{totalSessions === 1 ? "" : "s"} predate skill-area scoring. Practice once more to start tracking coverage.
            </div>
          )}
        </li>

        <li className={`${STAT_CELL} ${borders[3]}`}>
          <div className={STAT_LABEL}>Needs attention</div>
          <div className="flex flex-col divide-y divide-hx-line">
            <div className="pb-1.5">
              <Button type="button" variant="ghost" onClick={onViewJobs} className={STAT_ROW}>
                <span>{unlockedCount} {unlockedCount === 1 ? "employer" : "employers"} interested</span>
                {unlockedCount > 0 && <ArrowRightIcon size={14} aria-hidden="true" className="text-hx-ink-soft" />}
              </Button>
              {latestMatch && (
                <div className="text-[12px] text-hx-ink-soft">{latestMatch.companyName} · {hoursOrDaysAgo(latestMatch.matchedAt)}</div>
              )}
            </div>
            <Button type="button" variant="ghost" onClick={onViewResume} className={`${STAT_ROW} pt-2.5`}>
              <span>Resume improvements{improvementsCount > 0 ? ` (${improvementsCount})` : ""}</span>
              <ArrowRightIcon size={14} aria-hidden="true" className="text-hx-ink-soft" />
            </Button>
          </div>
        </li>
      </ul>
    </section>
  );
}

/* ─── Practice Activity (full-data only) ─── */

export function PracticeActivityCard({ sessionsCompleted, hoursLogged, questionsAnswered }: {
  sessionsCompleted: number; hoursLogged: number; questionsAnswered: number;
}) {
  const rows = [
    { label: "Total sessions", value: sessionsCompleted },
    { label: "Total practice time", value: `${hoursLogged}h` },
    { label: "Questions answered", value: questionsAnswered },
  ];
  return (
    <section aria-labelledby="dh-activity-heading" className={PANEL}>
      <h2 id="dh-activity-heading" className={`${PANEL_H2} mb-3`}>Practice activity</h2>
      <dl className="m-0 divide-y divide-hx-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-[13px] text-hx-ink-soft">{r.label}</dt>
            <dd className="m-0 text-[18px] font-semibold tabular-nums text-hx-coal">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ─── Evidence Capabilities (full-data only) ─── */

export function EvidenceCapabilitiesCard({ capabilities }: { capabilities: EvidenceCapability[] }) {
  const verifiedCount = capabilities.filter((c) => c.verified).length;
  return (
    <section aria-labelledby="dh-evidence-heading" className={PANEL}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="dh-evidence-heading" className={PANEL_H2}>Evidence capabilities</h2>
        <span className="text-[13px] text-hx-ink-soft">{verifiedCount} of {capabilities.length} verified</span>
      </div>
      <ul className="m-0 list-none divide-y divide-hx-line p-0">
        {capabilities.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="text-[13px] text-hx-coal">{c.label}</span>
            {c.verified ? (
              <Tag tone="success" label={c.verifiedDateLabel ? `Verified ${c.verifiedDateLabel}` : "Verified"} />
            ) : (
              <Tag label="Not yet" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Getting Started stepper (empty-state only) ─── */

export function GettingStartedCard({ hasResume, hasTargetRole, hasFirstSession, hasVisitedAnalytics }: {
  hasResume: boolean; hasTargetRole: boolean; hasFirstSession: boolean;
  /** Real localStorage flag (dashboardHelpers.ts) written on mount by the
   *  analytics page itself — not a permanently-false placeholder. */
  hasVisitedAnalytics: boolean;
}) {
  const steps = [
    { label: "Upload your resume", done: hasResume },
    { label: "Set your target role", done: hasTargetRole },
    { label: "Complete your first session", done: hasFirstSession },
    { label: "Review your analytics", done: hasVisitedAnalytics },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section aria-labelledby="dh-getting-started-heading" className={PANEL}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="dh-getting-started-heading" className={PANEL_H2}>Getting started</h2>
        <span className="text-[13px] text-hx-ink-soft">{doneCount} of {steps.length} done</span>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {steps.map((step, i) => {
          const state = step.done ? "done" : i === currentIndex ? "current" : "pending";
          return (
            <li key={step.label} aria-current={state === "current" ? "step" : undefined} className={cn("flex items-center gap-3 py-2.5", i > 0 && "border-t border-hx-line")}>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  state === "done" && "bg-hx-indigo text-white",
                  state === "current" && "border-[1.5px] border-hx-indigo bg-hx-indigo-100 text-hx-indigo",
                  state === "pending" && "border-[1.5px] border-hx-line text-hx-ink-soft",
                )}
              >
                {state === "done" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : i + 1}
              </span>
              <span className={cn("text-[14px]", state === "pending" ? "text-hx-ink-soft" : "font-semibold text-hx-coal", state === "done" && "text-hx-ink-soft line-through")}>
                {step.label}
                {state === "done" && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ─── "What you'll unlock" (empty-state only) ───
   The Figma file duplicates "Resume Strength"'s description verbatim onto
   "Evidence Capabilities", and "Employer Interest"'s description reads like
   it belongs to "Evidence Capabilities" — a copy-paste bug in the design
   file. Corrected here so each row accurately describes its own feature. */

const UNLOCK_CARDS = [
  { title: "Interview readiness", description: "A single score tracking how ready you are for your target role, updated after every session." },
  { title: "Resume strength", description: "An AI-scored breakdown of your resume with specific, actionable improvements." },
  { title: "Evidence capabilities", description: "Verified proof of the skills you've demonstrated across your practice sessions." },
  { title: "Employer interest", description: "See which open roles match your profile and which employers have unlocked it." },
];

export function UnlockTeaserGrid() {
  return (
    <section aria-labelledby="dh-unlock-heading" className={PANEL}>
      <h2 id="dh-unlock-heading" className={`${PANEL_H2} mb-3`}>What you&apos;ll unlock</h2>
      <ul className="m-0 list-none divide-y divide-hx-line p-0">
        {UNLOCK_CARDS.map((card) => (
          <li key={card.title} className="py-2.5 first:pt-0 last:pb-0">
            <div className="text-[13px] font-semibold text-hx-coal">{card.title}</div>
            <div className="mt-0.5 text-[13px] leading-normal text-hx-ink-soft">{card.description}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NoSessionsEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h3 className="m-0 text-[15px] font-semibold text-hx-coal">Your first session starts here</h3>
      <p className="m-0 max-w-[44ch] text-[13px] leading-relaxed text-hx-ink-soft">
        One short practice round gives you a score, a STAR breakdown and a coached answer. They all land here.
      </p>
      <Button type="button" size="lg" onClick={onStart} className="mt-2">
        Start your first session
      </Button>
    </div>
  );
}
