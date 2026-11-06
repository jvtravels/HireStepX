"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpIcon, LightbulbIcon, MessageCircleQuestionIcon, ScaleIcon, SearchXIcon, TrendingUpIcon, UserIcon, UserXIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { matchBandLabel } from "../../../../../../server-handlers/_requirement-match-helpers";
import type { Candidate } from "@/employer/mockData";
import { CandidateStatusChip } from "@/employer/_atoms";
import { InsightList, InsightRow, SkillChip } from "@/employer/_panelParts";
import { candidateSkillFit, interviewScore, scoreTone } from "@/employer/_jobDetailHelpers";
import { agoFromDays, candidateDisplayName, initials } from "./requirementFormat";
import { metricLeaders, sameAcross, summarizeComparison, type CompareMetric } from "./compareInsights";
import { READINESS_LABEL, buildVerdict, evidenceLeaders, useCompareEvidence, type EvidenceState } from "./compareEvidence";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
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
const PILL = {
  positive: "bg-hx-success-100 text-hx-success-ink",
  action: "bg-hx-indigo-100 text-hx-indigo",
  attention: "bg-hx-warning-100 text-hx-warning-ink",
  neutral: "bg-hx-row text-hx-ink-soft",
} as const;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo";
const SCORE_TEXT = { success: "text-hx-success-ink", warning: "text-hx-warning-ink", error: "text-hx-error-ink" } as const;
const BAND_TEXT = { Strong: "text-hx-success-ink", Fair: "text-hx-warning-ink", Low: "text-hx-ink-soft" } as const;

interface Ctx {
  required: string[];
  /** Highest session count in the group, so the sessions bar reads relative to the others. */
  maxSessions: number;
  leaders: Map<CompareMetric, Set<string>>;
  evidence: Map<string, EvidenceState>;
  evidenceLeads: ReturnType<typeof evidenceLeaders>;
}

interface CompareRow {
  id: string;
  label: string;
  group: "Fit" | "Evidence" | "Pipeline";
  /** Set when one candidate can clearly lead, so that cell gets the winner tint. */
  metric?: CompareMetric;
  /** Needs graded evidence; with nobody's evidence open or loading the row would only repeat "Unlock to see evidence". */
  graded?: boolean;
  /** Same tint for rows whose leader comes from the graded evidence rather than the shortlist figures. */
  leads?: (id: string, ctx: Ctx) => boolean;
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

/** One evidence cell: closed until unlock, a quiet note while loading or when there is nothing graded, otherwise the content. */
function EvidenceCell({ state, children }: { state: EvidenceState | undefined; children: (e: CandidateEvidence) => ReactNode }) {
  if (!state || state.status === "loading") return <span aria-busy="true" className="grid gap-1.5"><span className="sr-only">Loading evidence</span><Skeleton className="h-3.5 w-4/5" /><Skeleton className="h-3.5 w-3/5" /></span>;
  if (state.status === "locked") return <Faint>Unlock to see evidence</Faint>;
  if (state.status === "error") return <Faint>Couldn&apos;t load evidence</Faint>;
  return <>{children(state.evidence)}</>;
}

const NO_GRADED = <Faint>No graded interview yet</Faint>;

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
    metric: "match",
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
    metric: "skills",
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
    metric: "interview",
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
    id: "readiness",
    graded: true,
    label: "Hire readiness",
    group: "Evidence",
    same: (c) => c.id,
    leads: (id, ctx) => ctx.evidenceLeads.readiness.has(id),
    render: (c, ctx) => (
      <EvidenceCell state={ctx.evidence.get(c.id)}>
        {(e) =>
          e.readiness ? (
            <>
              <div className={cn("text-[18px] leading-6 font-semibold", e.readiness.band === "leanHire" ? "text-hx-warning-ink" : "text-hx-success-ink")}>{READINESS_LABEL[e.readiness.band]}</div>
              {ctx.evidenceLeads.readiness.has(c.id) && (
                <div className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-hx-success-ink">
                  <ArrowUpIcon size={12} aria-hidden="true" /> Leads
                </div>
              )}
              <Muted>{e.readiness.confidence === "high" ? "High" : e.readiness.confidence === "medium" ? "Medium" : "Low"} confidence, from the latest graded interview</Muted>
            </>
          ) : (
            NO_GRADED
          )
        }
      </EvidenceCell>
    ),
  },
  {
    id: "star",
    graded: true,
    label: "Answer structure (STAR)",
    group: "Evidence",
    same: (c) => c.id,
    leads: (id, ctx) => ctx.evidenceLeads.star.has(id),
    render: (c, ctx) => (
      <EvidenceCell state={ctx.evidence.get(c.id)}>
        {(e) =>
          e.starCompleteness ? (
            <>
              <Metric value={e.starCompleteness.pct} unit="%" pct={e.starCompleteness.pct} lead={ctx.evidenceLeads.star.has(c.id)} label={`${e.starCompleteness.pct}% of answers covered situation, task, action and result`} />
              <Muted>of {e.starCompleteness.questionsConsidered} answers covered situation, task, action and result</Muted>
            </>
          ) : (
            NO_GRADED
          )
        }
      </EvidenceCell>
    ),
  },
  {
    id: "strengths",
    graded: true,
    label: "Best-evidenced skills",
    group: "Evidence",
    same: (c) => c.id,
    render: (c, ctx) => (
      <EvidenceCell state={ctx.evidence.get(c.id)}>
        {(e) => {
          const top = [...e.skills].sort((a, b) => b.score - a.score).slice(0, 3);
          return top.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Best-evidenced skills">
              {top.map((s) => (
                <li key={s.name}>
                  <SkillChip tone="present">
                    {displaySkillName(s.name)} {Math.round(s.score)}
                  </SkillChip>
                </li>
              ))}
            </ul>
          ) : (
            NO_GRADED
          );
        }}
      </EvidenceCell>
    ),
  },
  {
    id: "quote",
    graded: true,
    label: "Strongest answer",
    group: "Evidence",
    same: (c) => c.id,
    render: (c, ctx) => (
      <EvidenceCell state={ctx.evidence.get(c.id)}>
        {(e) => {
          const win = e.quotes.find((q) => q.kind === "win");
          return win ? (
            <>
              <div className="text-[13px] leading-5 font-semibold text-hx-coal [overflow-wrap:anywhere]">{win.text}</div>
              <blockquote className="m-0 mt-1.5 line-clamp-4 text-[13px] leading-[1.5] text-hx-ink-soft italic [overflow-wrap:anywhere]">&ldquo;{win.quote}&rdquo;</blockquote>
            </>
          ) : (
            NO_GRADED
          );
        }}
      </EvidenceCell>
    ),
  },
  {
    id: "sessions",
    metric: "sessions",
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
  const score = Math.round(candidate.matchScore);
  const band = matchBandLabel(score);
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
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-[28px] leading-8 font-semibold tabular-nums", BAND_TEXT[band])}>{score}</span>
        <span className="text-[12px] text-hx-ink-soft">/100 · {band} match</span>
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

  const evidence = useCompareEvidence(chosen);
  const evidenceLeads = evidenceLeaders(chosen, evidence);
  const verdict = buildVerdict(chosen, required, evidence);
  const summary = summarizeComparison(chosen, required);
  const leaders = new Map<CompareMetric, Set<string>>((["match", "skills", "interview", "sessions"] as CompareMetric[]).map((m) => [m, metricLeaders(chosen, required, m)]));
  const ctx: Ctx = { required, leaders, maxSessions: Math.max(0, ...chosen.map((c) => c.sessionsCompleted)), evidence, evidenceLeads };

  const anyEvidence = chosen.some((c) => { const st = evidence.get(c.id)?.status; return st !== "locked"; });
  const rows = ROWS.filter((r) => (r.id !== "skills" || required.length > 0) && (!r.graded || anyEvidence));
  const matching = rows.filter((r) => sameAcross(chosen, (c) => r.same(c, required)));
  const visible = matchingHidden ? rows.filter((r) => !matching.includes(r)) : rows;
  const groups = (["Fit", "Evidence", "Pipeline"] as const).map((g) => ({ g, rows: visible.filter((r) => r.group === g) })).filter((x) => x.rows.length > 0);

  const mostWins = Math.max(0, ...chosen.map((c) => summary.leads.get(c.id) ?? 0));
  const topCandidates = chosen.filter((c) => (summary.leads.get(c.id) ?? 0) === mostWins);
  /** Only one overall leader gets the column highlight; a tie highlights nobody. */
  const topId = mostWins > 0 && topCandidates.length === 1 ? topCandidates[0].id : null;
  const cols = COLS[chosen.length] ?? COLS[3];
  const locked = chosen.some((c) => !c.unlocked);
  const names = chosen.map(candidateDisplayName);
  const namesLabel = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-6">
        <h1 className="m-0 text-[22px] leading-8 font-semibold text-hx-coal [overflow-wrap:anywhere]">Compare candidates</h1>
        <p className="m-0 text-[14px] leading-5 text-hx-ink-soft [overflow-wrap:anywhere]">{requirementTitle}</p>
      </header>
      {locked && <p className="m-0 -mt-2 text-[13px] text-hx-ink-soft">Names and contact details of locked candidates stay hidden until you unlock them from the shortlist.</p>}
      <section aria-label="Summary" className="flex items-start gap-3 rounded-2xl border border-hx-line bg-white px-4 py-4 md:px-6">
        <span aria-hidden="true" className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-hx-indigo-100 text-hx-indigo">
          <LightbulbIcon size={16} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[16px] leading-6 font-semibold text-hx-coal [overflow-wrap:anywhere]">{verdict.headline}</p>
          {verdict.detail && <p className="m-0 mt-1 text-[14px] leading-5 text-hx-ink-soft [overflow-wrap:anywhere]">{verdict.detail}</p>}
          {verdict.pending && <p className="m-0 mt-1 text-[12px] text-hx-ink-soft" role="status">Loading interview evidence. This summary may update.</p>}
        </div>
      </section>
      {summary.differences.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Key differences">
          {summary.differences.map((n) => (
            <li key={n.id} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold", PILL[n.tone])}>
              <span aria-hidden="true" className="shrink-0">{DIFFERENCE_ICON[n.id.split("-")[0]] ?? <ScaleIcon size={16} />}</span>
              {n.title}
            </li>
          ))}
        </ul>
      )}



      <section aria-label={`Comparison of ${namesLabel}`} className="rounded-2xl border border-hx-line bg-white">
        <div role="table" aria-label={`Side-by-side comparison of ${namesLabel} for ${requirementTitle}`} className="min-w-0">
          <div role="rowgroup" className="sticky top-0 z-10 rounded-t-2xl border-b border-hx-line bg-hx-row">
            <div role="row" className={cn("grid", cols)}>
              <div role="columnheader" className="col-span-full flex items-center justify-between gap-3 px-3 pt-3 md:col-span-1 md:items-end md:px-5 md:pt-0 md:pb-4">
                <span className="text-[12px] font-semibold tracking-wide text-hx-ink-soft uppercase">{chosen.length} candidates</span>
              </div>
              {chosen.map((c) => (
                <div key={c.id} role="columnheader" className={cn("min-w-0 border-hx-line max-md:border-l max-md:first:border-l-0 md:border-l", c.id === topId && "bg-hx-success-100/50")}>
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
                      <div
                        key={c.id}
                        role="cell"
                        className={cn("min-w-0 border-hx-line px-3 pt-2 pb-4 max-md:border-l max-md:first:border-l-0 md:border-l md:px-5 md:py-4", ((row.metric && leaders.get(row.metric)?.has(c.id)) || row.leads?.(c.id, ctx)) && "bg-hx-success-100/40")}
                      >
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

      <section aria-label="How they differ, in detail" className="rounded-2xl border border-hx-line bg-white px-4 py-4 md:px-6 md:py-5">
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
    </div>
  );
}
