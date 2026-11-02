"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpIcon, MessageCircleQuestionIcon, ScaleIcon, SearchXIcon, TrendingUpIcon, UserIcon, UserXIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { matchBandLabel } from "../../../../../../server-handlers/_requirement-match-helpers";
import type { Candidate } from "@/employer/mockData";
import { CandidateStatusChip } from "@/employer/_atoms";
import { InsightList, InsightRow, SkillChip } from "@/employer/_panelParts";
import { candidateSkillFit, interviewScore, scoreTone } from "@/employer/_jobDetailHelpers";
import { agoFromDays, candidateDisplayName, initials } from "./requirementFormat";
import { metricLeaders, sameAcross, summarizeComparison, type CompareMetric } from "./compareInsights";
import { displaySkillName } from "../candidates/[candidateId]/_components/helpers";

const DIFFERENCE_ICON: Record<string, ReactNode> = {
  lead: <TrendingUpIcon size={16} />,
  no: <UserXIcon size={16} />,
  shared: <SearchXIcon size={16} />,
  split: <ScaleIcon size={16} />,
};

/* One grid per row: a label line over equal candidate columns on a phone, a label column beside them from md up. */
const COLS: Record<number, string> = {
  2: "grid-cols-2 md:grid-cols-[11rem_repeat(2,minmax(0,1fr))]",
  3: "grid-cols-3 md:grid-cols-[11rem_repeat(3,minmax(0,1fr))]",
};
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo";
const SCORE_TEXT = { success: "text-hx-success-ink", warning: "text-hx-warning-ink", error: "text-hx-error-ink" } as const;
const BAND_TEXT = { Strong: "text-hx-success-ink", Fair: "text-hx-warning-ink", Low: "text-hx-ink-soft" } as const;

interface Ctx {
  required: string[];
  /** Highest session count in the group, so the sessions bar reads relative to the others. */
  maxSessions: number;
  leaders: Map<CompareMetric, Set<string>>;
}

interface CompareRow {
  id: string;
  label: string;
  group: "Fit" | "Evidence" | "Pipeline";
  /** What "the same" means for this row, so the matching-rows toggle can hide it. */
  same: (c: Candidate, required: string[]) => string;
  render: (c: Candidate, ctx: Ctx) => ReactNode;
}

function Metric({ value, unit, pct, lead, label }: { value: ReactNode; unit?: string; pct: number; lead: boolean; label: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] leading-7 font-semibold tabular-nums text-hx-coal">{value}</span>
        {unit && <span className="text-[13px] text-hx-ink-soft">{unit}</span>}
      </div>
      <Progress
        value={Math.max(0, Math.min(100, pct))}
        aria-hidden="true"
        aria-label={label}
        className={cn("mt-2 h-1.5 bg-hx-line [&_[data-slot=progress-indicator]]:bg-hx-neutral-ink/35", lead && "[&_[data-slot=progress-indicator]]:bg-hx-success")}
      />
      {lead && (
        <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-hx-success-ink">
          <ArrowUpIcon size={12} aria-hidden="true" /> Leads
        </div>
      )}
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <div className="mt-1.5 text-[12px] leading-[1.5] text-hx-ink-soft [overflow-wrap:anywhere]">{children}</div>;
const Faint = ({ children }: { children: ReactNode }) => <span className="text-[14px] text-hx-ink-soft">{children}</span>;

const ROWS: CompareRow[] = [
  {
    id: "role",
    label: "Target role",
    group: "Fit",
    same: (c) => `${c.targetRole}|${c.city}`,
    render: (c) => {
      const text = [c.targetRole, c.city].filter((v) => v && v !== "Not specified").join(" · ");
      return text ? <span className="text-[14px] leading-5 text-hx-coal [overflow-wrap:anywhere]">{text}</span> : <Faint>Not specified</Faint>;
    },
  },
  {
    id: "match",
    label: "Match score",
    group: "Fit",
    same: (c) => String(Math.round(c.matchScore)),
    render: (c, ctx) => {
      const score = Math.round(c.matchScore);
      const band = matchBandLabel(score);
      const b = c.matchBreakdown;
      return (
        <>
          <Metric value={score} unit="/100" pct={score} lead={ctx.leaders.get("match")?.has(c.id) ?? false} label={`Match score ${score} out of 100`} />
          <div className={cn("mt-2 text-[12px] font-semibold", BAND_TEXT[band])}>{band} match</div>
          {b && (
            <Muted>
              Resume overlap: role {b.roleMatch}% · skill wording {b.skillMatch}% · location {b.locationMatch}%
            </Muted>
          )}
        </>
      );
    },
  },
  {
    id: "skills",
    label: "Required skills",
    group: "Fit",
    same: (c, required) => candidateSkillFit(c, required).matched.slice().sort().join(","),
    render: (c, ctx) => {
      const { matched, gaps } = candidateSkillFit(c, ctx.required);
      const total = matched.length + gaps.length;
      return (
        <>
          <Metric
            value={matched.length}
            unit={`of ${total}`}
            pct={total ? (matched.length / total) * 100 : 0}
            lead={ctx.leaders.get("skills")?.has(c.id) ?? false}
            label={`${matched.length} of ${total} required skills`}
          />
          {gaps.length > 0 && (
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0" aria-label="Missing skills">
              {gaps.map((g) => (
                <li key={g}>
                  <SkillChip tone="missing">{displaySkillName(g)}</SkillChip>
                </li>
              ))}
            </ul>
          )}
        </>
      );
    },
  },
  {
    // The same figure and rule as the shortlist's evidence column: a never-practised candidate has no score, not a default 50.
    id: "interview",
    label: "Interview score",
    group: "Evidence",
    same: (c) => String(interviewScore(c)),
    render: (c, ctx) => {
      const score = interviewScore(c);
      if (score == null) return <Faint>No graded interviews</Faint>;
      return (
        <>
          <div className="flex items-baseline gap-1">
            <span className={cn("text-[22px] leading-7 font-semibold tabular-nums", SCORE_TEXT[scoreTone(score)])}>{score}</span>
            <span className="text-[13px] text-hx-ink-soft">/100</span>
          </div>
          <Progress
            value={score}
            aria-hidden="true"
            className={cn("mt-2 h-1.5 bg-hx-line [&_[data-slot=progress-indicator]]:bg-hx-neutral-ink/35", ctx.leaders.get("interview")?.has(c.id) && "[&_[data-slot=progress-indicator]]:bg-hx-success")}
          />
          {ctx.leaders.get("interview")?.has(c.id) && (
            <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-hx-success-ink">
              <ArrowUpIcon size={12} aria-hidden="true" /> Leads
            </div>
          )}
        </>
      );
    },
  },
  {
    id: "sessions",
    label: "Practice sessions",
    group: "Evidence",
    same: (c) => String(c.sessionsCompleted),
    render: (c, ctx) => (
      <>
        <Metric
          value={c.sessionsCompleted}
          pct={ctx.maxSessions ? (c.sessionsCompleted / ctx.maxSessions) * 100 : 0}
          lead={ctx.leaders.get("sessions")?.has(c.id) ?? false}
          label={`${c.sessionsCompleted} practice sessions`}
        />
        <Muted>Last active {c.lastActiveDaysAgo < 0 ? "unknown" : agoFromDays(c.lastActiveDaysAgo)}</Muted>
      </>
    ),
  },
  {
    id: "status",
    label: "Pipeline status",
    group: "Pipeline",
    same: (c) => String(c.candidateStatus ?? ""),
    render: (c) => (
      <>
        {c.candidateStatus ? <CandidateStatusChip status={c.candidateStatus} /> : <Faint>Not set</Faint>}
        {c.interviewScheduledAt && <Muted>Interview {new Date(c.interviewScheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Muted>}
        {c.candidateStatusNote && <Muted>Private note: {c.candidateStatusNote}</Muted>}
      </>
    ),
  },
  {
    id: "listed",
    label: "Skills",
    group: "Pipeline",
    same: (c) => c.skills.slice().sort().join(","),
    render: (c) =>
      c.skills.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {c.skills.map((s) => (
            <li key={s}>
              <SkillChip>{displaySkillName(s)}</SkillChip>
            </li>
          ))}
        </ul>
      ) : (
        <Faint>None listed</Faint>
      ),
  },
];

function Identity({ candidate, requirementId, wins }: { candidate: Candidate; requirementId: string; wins: number }) {
  const name = candidateDisplayName(candidate);
  return (
    <div className="flex min-w-0 flex-col gap-2 px-3 py-3 md:px-5 md:py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="hidden md:block">
          <Avatar size="lg">
            <AvatarFallback className="bg-hx-indigo-100 text-[14px] font-semibold text-hx-indigo">
              {candidate.unlocked ? initials(candidate.name) : <UserIcon size={16} aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0">
          <Link
            href={`/employer/requirements/${requirementId}/candidates/${candidate.id}`}
            className={cn("block rounded text-[14px] leading-5 font-semibold text-hx-coal no-underline [overflow-wrap:anywhere] hover:underline md:text-[16px] md:leading-6", FOCUS)}
          >
            {name}
          </Link>
          <div className="hidden text-[13px] leading-5 text-hx-ink-soft md:block">{candidate.targetRole && candidate.targetRole !== "Not specified" ? candidate.targetRole : "Role not specified"}</div>
        </div>
      </div>
      {wins > 0 ? (
        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-hx-success-100 px-2 py-0.5 text-[12px] font-semibold text-hx-success-ink">
          <ArrowUpIcon size={12} aria-hidden="true" /> Leads {wins} of 4
        </div>
      ) : (
        <div className="text-[12px] text-hx-ink-soft">No clear lead</div>
      )}
    </div>
  );
}

export function CompareBoard({ requirementId, requirementTitle, required, chosen }: { requirementId: string; requirementTitle: string; required: string[]; chosen: Candidate[] }) {
  const [matchingHidden, setMatchingHidden] = useState(true);
  const [showAsk, setShowAsk] = useState(false);

  const summary = summarizeComparison(chosen, required);
  const leaders = new Map<CompareMetric, Set<string>>((["match", "skills", "interview", "sessions"] as CompareMetric[]).map((m) => [m, metricLeaders(chosen, required, m)]));
  const ctx: Ctx = { required, leaders, maxSessions: Math.max(0, ...chosen.map((c) => c.sessionsCompleted)) };

  const rows = ROWS.filter((r) => r.id !== "skills" || required.length > 0);
  const matching = rows.filter((r) => sameAcross(chosen, (c) => r.same(c, required)));
  const visible = matchingHidden ? rows.filter((r) => !matching.includes(r)) : rows;
  const groups = (["Fit", "Evidence", "Pipeline"] as const).map((g) => ({ g, rows: visible.filter((r) => r.group === g) })).filter((x) => x.rows.length > 0);

  const cols = COLS[chosen.length] ?? COLS[3];
  const names = chosen.map(candidateDisplayName);
  const namesLabel = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const locked = chosen.some((c) => !c.unlocked);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header>
        <h1 className="m-0 text-[22px] leading-8 font-semibold text-hx-coal [overflow-wrap:anywhere]">Compare candidates</h1>
        <p className="m-0 mt-1 max-w-[640px] text-[14px] leading-5 text-hx-ink-soft">
          {requirementTitle}
          {locked ? ". Names and contact details of locked candidates stay hidden until you unlock them from the shortlist." : ". Side by side on match, interview evidence and pipeline status."}
        </p>
      </header>

      <section aria-label="How they differ" className="rounded-2xl border border-hx-line bg-white px-4 py-4 md:px-6 md:py-5">
        {summary.differences.length > 0 ? (
          <InsightList>
            {summary.differences.map((n) => (
              <InsightRow key={n.id} tone={n.tone} icon={DIFFERENCE_ICON[n.id.split("-")[0]] ?? <ScaleIcon size={16} />} title={n.title} body={n.body} className="py-3 first:pt-0 last:pb-0" />
            ))}
          </InsightList>
        ) : (
          <p className="m-0 text-[14px] text-hx-ink-soft">These candidates are close on every measure we compare. Use the interview to separate them.</p>
        )}
        {summary.questions.length > 0 && (
          <div className="mt-4 border-t border-hx-line pt-3">
            <button
              type="button"
              onClick={() => setShowAsk((v) => !v)}
              aria-expanded={showAsk}
              className={cn("inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent p-0 text-[14px] font-semibold text-hx-indigo pointer-coarse:min-h-11", FOCUS)}
            >
              <MessageCircleQuestionIcon size={16} aria-hidden="true" />
              Worth asking in the interview ({summary.questions.length})
            </button>
            {showAsk && (
              <InsightList className="mt-3">
                {summary.questions.map((n) => (
                  <InsightRow key={n.id} tone={n.tone} icon={<MessageCircleQuestionIcon size={16} />} title={n.title} body={n.body} className="py-3 first:pt-0 last:pb-0" />
                ))}
              </InsightList>
            )}
          </div>
        )}
        <p className="m-0 mt-3 text-[12px] leading-[1.5] text-hx-ink-soft">
          Worked out from the figures below. HireStepX shows where candidates differ and does not pick a hire for you. Interview scores reflect practice, not job performance.
        </p>
      </section>

      <section aria-label={`Comparison of ${namesLabel}`} className="rounded-2xl border border-hx-line bg-white">
        <div role="table" aria-label={`Side-by-side comparison of ${namesLabel} for ${requirementTitle}`} className="min-w-0">
          <div role="rowgroup" className="sticky top-0 z-10 rounded-t-2xl border-b border-hx-line bg-hx-row">
            <div role="row" className={cn("grid", cols)}>
              <div role="columnheader" className="col-span-full flex items-center justify-between gap-3 px-3 pt-3 md:col-span-1 md:items-end md:px-5 md:pt-0 md:pb-4">
                <span className="text-[12px] font-semibold tracking-wide text-hx-ink-soft uppercase">{chosen.length} candidates</span>
              </div>
              {chosen.map((c) => (
                <div key={c.id} role="columnheader" className="min-w-0 border-hx-line max-md:border-l max-md:first:border-l-0 md:border-l">
                  <Identity candidate={c} requirementId={requirementId} wins={summary.leads.get(c.id) ?? 0} />
                </div>
              ))}
            </div>
          </div>

          <div role="rowgroup">
            {groups.length === 0 && <p className="m-0 px-5 py-8 text-center text-[14px] text-hx-ink-soft">Every row matches across these candidates.</p>}
            {groups.map(({ g, rows: groupRows }) => (
              <div key={g}>
                <div role="row" className="border-b border-hx-line bg-hx-row px-3 py-2 md:px-5">
                  <span role="columnheader" className="text-[12px] font-semibold tracking-wide text-hx-ink-soft uppercase">{g}</span>
                </div>
                {groupRows.map((row) => (
                  <div key={row.id} role="row" className={cn("grid border-b border-hx-line last:border-b-0", cols)}>
                    <div role="rowheader" className="col-span-full px-3 pt-3 text-[13px] font-semibold text-hx-ink-soft md:col-span-1 md:px-5 md:py-4">
                      {row.label}
                    </div>
                    {chosen.map((c) => (
                      <div key={c.id} role="cell" className="min-w-0 border-hx-line px-3 pt-2 pb-4 max-md:border-l max-md:first:border-l-0 md:border-l md:px-5 md:py-4">
                        {row.render(c, ctx)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {matching.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-hx-line bg-hx-row px-3 py-3 md:px-5">
            <span className="text-[13px] text-hx-ink-soft">
              {matchingHidden ? `${matching.length} ${matching.length === 1 ? "row is" : "rows are"} the same for everyone and hidden.` : "Showing every row, including the ones that match."}
            </span>
            <button
              type="button"
              onClick={() => setMatchingHidden((v) => !v)}
              className={cn("inline-flex min-h-8 cursor-pointer items-center rounded border-0 bg-transparent p-0 text-[13px] font-semibold text-hx-indigo pointer-coarse:min-h-11", FOCUS)}
            >
              {matchingHidden ? "Show all rows" : "Hide matching rows"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
