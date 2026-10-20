"use client";

/* Presentational sections for the employer dashboard (app/(employer)/employer/
   page.tsx). One white container (drawn by the page) holding hairline-separated
   sections, so nothing is a card inside a card; neutral pills, indigo reserved for
   actions. Built on the shared primitives (ui/table, ui/avatar, Select,
   the command palette pieces, EmptyState, _atoms Badge/Pill/ScoreChip) rather than local
   copies. Everything is driven by props; data wiring stays in the page. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { LightbulbIcon, ClockIcon, TrendingUpIcon, ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, SearchXIcon, ArrowRightIcon, SparklesIcon, UserIcon } from "lucide-react";
import { hoursOrDaysAgo } from "@/hiringMatchFormat";
import AnimatedNumber from "@/AnimatedNumber";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InfoTip, InsightList, InsightRow } from "./_panelParts";
import { Badge, Pill, ScoreChip, STAGE_LABEL, STAGE_TONE, STRONG_MATCH_THRESHOLD } from "./_atoms";
import { PrimaryLink, OutlineLink } from "./_consoleParts";
import type { RequirementSummary } from "./mockData";
import {
  RANGE_LABEL, buildFunnel, interviewSlot, jobHealth, pipelineStage, sortJobs, jobsNeedingAttentionFirst,
  type DashboardRange, type DashboardJobPipeline, type FunnelStep, type JobSortKey, type SortDir, type DashboardUpcomingInterview,
  type DashboardActivityItem, type DashboardInsight, type RecommendedCard, type EmployerDashboardData, type NextAction,
} from "./dashboardData";

const RANGE_OPTIONS: readonly DashboardRange[] = [7, 30, 90];

/* Sections sit in the page's container; the parent draws the hairlines between them. */
const CARD = "min-w-0 px-7 py-6";
const H2 = "m-0 text-[15px] font-semibold text-hx-coal";
const LIST = "m-0 list-none p-0";
const EMPTY = "py-6";
/* Tables bleed to the container edge so rows read as lines, not a box in a box. */
const BLEED = "-mx-7 [&_td:first-child]:pl-7 [&_th:first-child]:pl-7 [&_td:last-child]:pr-7 [&_th:last-child]:pr-7";
const TH = "h-10 whitespace-nowrap bg-hx-soft px-3 text-[12px] font-semibold text-hx-ink-soft";
const TD = "px-3 py-3 text-[13px] text-hx-coal";

const segmentDelay = (i: number): CSSProperties => ({ "--i": i } as CSSProperties);

function PersonAvatar({ name, initials }: { name: string; initials: string }) {
  const masked = name.startsWith("Candidate #");
  return (
    <Avatar size="lg" aria-hidden="true" className="size-10">
      <AvatarFallback className="bg-hx-indigo-100 text-[13px] font-bold text-hx-indigo">
        {masked ? <UserIcon size={18} /> : initials}
      </AvatarFallback>
    </Avatar>
  );
}

function CardHeader({ id, title, description, action }: { id: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`mb-4 flex flex-wrap justify-between gap-x-3 gap-y-1 ${description ? "items-start" : "items-center"}`}>
      <div className="min-w-0">
        <h2 id={id} className={H2}>{title}</h2>
        {description && <p className="m-0 mt-0.5 text-[13px] text-hx-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm py-1 text-[13px] font-semibold text-hx-indigo no-underline focus-visible:outline-2 focus-visible:outline-offset-2">
      {children}
      <ArrowRightIcon size={14} aria-hidden="true" />
    </Link>
  );
}

/* ─── Header: greeting, search, range ─── */

export function DashboardHeader({
  companyName, range, onRangeChange, jobs, recommended,
}: {
  companyName: string;
  range: DashboardRange;
  onRangeChange: (r: DashboardRange) => void;
  jobs: RequirementSummary[];
  recommended: RecommendedCard[];
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hx-line px-7 py-5">
      <div className="min-w-0">
        <h1 className="m-0 text-[20px] font-semibold text-hx-coal [overflow-wrap:anywhere]">
          Welcome back
        </h1>
        <p className="m-0 mt-1 text-[14px] text-hx-ink-soft">{companyName ? `${companyName} hiring pipeline` : "Your hiring pipeline"}, {RANGE_LABEL[range].toLowerCase()}.</p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2.5 min-[900px]:w-auto min-[900px]:flex-nowrap">
        <DashboardSearch jobs={jobs} candidates={recommended} />
        <Select value={String(range)} onValueChange={(v) => onRangeChange(Number(v) as DashboardRange)}>
          <SelectTrigger aria-label="Date range" className="h-9 shrink-0 border-hx-line bg-white text-[13px] text-hx-coal"><SelectValue /></SelectTrigger>
          <SelectContent align="end">
            {RANGE_OPTIONS.map((r) => <SelectItem key={r} value={String(r)}>{RANGE_LABEL[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}

/* Command palette pieces give the combobox contract for free: role=combobox
   on the input, listbox/option roles, aria-activedescendant, Arrow/Home/End
   keys and Enter to pick. Filtering is ours (shouldFilter off) so jobs and
   candidates can be grouped. The list stays mounted so aria-controls always
   resolves; the wrapper hides it until there is a query. */
function DashboardSearch({ jobs, candidates }: { jobs: RequirementSummary[]; candidates: RecommendedCard[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const { jobHits, candidateHits } = useMemo(() => {
    if (!term) return { jobHits: [], candidateHits: [] };
    return {
      jobHits: jobs
        .filter((j) => j.title.toLowerCase().includes(term) || j.skills.some((s) => s.toLowerCase().includes(term)))
        .slice(0, 4)
        .map((j) => ({ id: `j-${j.id}`, label: j.title, hint: j.skills.slice(0, 2).join(", "), href: `/employer/requirements/${j.id}` })),
      candidateHits: candidates
        .filter((c) => c.name.toLowerCase().includes(term) || c.matchedSkills.some((s) => s.toLowerCase().includes(term)))
        .slice(0, 4)
        .map((c) => ({ id: `c-${c.matchId}`, label: c.name, hint: c.roleTitle, href: `/employer/requirements/${c.requirementId}/candidates/${c.matchId}` })),
    };
  }, [term, jobs, candidates]);
  const total = jobHits.length + candidateHits.length;
  const go = (href: string) => { setQ(""); router.push(href); };

  return (
    <div className="relative min-w-[220px] flex-1 min-[900px]:w-[260px] min-[900px]:min-w-0 min-[900px]:flex-none">
      <Command
        shouldFilter={false}
        label="Search jobs and candidates"
        onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
        className="h-auto overflow-visible bg-transparent p-0"
      >
        <CommandInput value={q} onValueChange={setQ} placeholder="Search jobs and candidates" />
        <div hidden={!term} className="mx-swap absolute inset-x-0 top-11 z-20 min-w-0 rounded-xl border border-hx-line bg-white">
          <CommandList>
            {jobHits.length > 0 && (
              <CommandGroup heading="Jobs">
                {jobHits.map((r) => (
                  <CommandItem key={r.id} value={r.id} onSelect={() => go(r.href)} className="min-h-9 justify-between gap-2.5 text-[13px]">
                    <span className="truncate">{r.label}</span>
                    {r.hint && <span className="shrink-0 text-hx-ink-soft">{r.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {candidateHits.length > 0 && (
              <CommandGroup heading="Candidates">
                {candidateHits.map((r) => (
                  <CommandItem key={r.id} value={r.id} onSelect={() => go(r.href)} className="min-h-9 justify-between gap-2.5 text-[13px]">
                    <span className="truncate">{r.label}</span>
                    <span className="shrink-0 text-hx-ink-soft">{r.hint}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {term && total === 0 && (
              <p className="m-0 px-2.5 py-3 text-[13px] text-hx-ink-soft">Nothing matches &ldquo;{q.trim()}&rdquo;. Try a job title, a skill or a candidate name.</p>
            )}
          </CommandList>
        </div>
      </Command>
      <p role="status" className="sr-only">
        {term ? (total === 0 ? "No results" : `${total} ${total === 1 ? "result" : "results"}`) : ""}
      </p>
    </div>
  );
}

/* ─── Next best action ─── */

export function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section aria-labelledby="next-action-heading" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-hx-line bg-hx-soft px-7 py-4">
      <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
        <span aria-hidden="true" className="mx-pop inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-hx-indigo-100 text-hx-indigo">
          <SparklesIcon size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="next-action-heading" className="m-0 text-[15px] font-bold text-hx-coal [overflow-wrap:anywhere]">{action.title}</h2>
          <p className="m-0 mt-0.5 text-[13px] leading-normal text-hx-ink-soft">{action.body}</p>
        </div>
      </div>
      <PrimaryLink href={action.href} icon={<ArrowRightIcon size={14} aria-hidden="true" className="mx-nudge" />}>{action.cta}</PrimaryLink>
    </section>
  );
}

/* ─── Hiring funnel ─── */

const FUNNEL_CELL = "flex min-w-0 flex-col border-hx-line gap-1 px-4 py-4 min-[640px]:px-7 min-[640px]:py-5";

function FunnelStepItem({ step, range, border }: { step: FunnelStep; range: DashboardRange; border: string }) {
  const added = step.added === null ? null
    : step.added <= 0 ? null
    : step.key === "recommended" ? `${step.added} new ${step.added === 1 ? "match" : "matches"} in last ${range} days`
    : `+${step.added} in last ${range} days`;
  const short = step.added === null || step.added <= 0 ? null : `+${step.added} new`;
  return (
    <li className={`${FUNNEL_CELL} ${border}`}>
      <p className="sr-only">{step.value} {step.label}{added ? `, ${added}` : ""}</p>
      <div aria-hidden="true" className="text-[13px] text-hx-ink-soft">{step.label}</div>
      <div aria-hidden="true" className="text-[28px] font-semibold leading-[1.15] tabular-nums text-hx-coal"><AnimatedNumber value={step.value} /></div>
      <div aria-hidden="true" className="min-h-4 text-[12px] text-hx-ink-soft">
        {added && <span className={step.added ? "font-medium text-hx-success-ink" : ""}><span className="min-[640px]:hidden">{short}</span><span className="hidden min-[640px]:inline">{added}</span></span>}
      </div>
    </li>
  );
}

function OpenJobsItem({ jobs, border }: { jobs: RequirementSummary[]; border: string }) {
  const withMatches = jobs.filter((j) => j.aiScreening.topMatches > 0).length;
  const detail = jobs.length > 0 && withMatches > 0 ? `${withMatches} with strong ${withMatches === 1 ? "match" : "matches"}` : null;
  return (
    <li className={`${FUNNEL_CELL} ${border}`}>
      <p className="sr-only">{jobs.length} open {jobs.length === 1 ? "job" : "jobs"}{detail ? `, ${detail}` : ""}</p>
      <div aria-hidden="true" className="text-[13px] text-hx-ink-soft">Open jobs</div>
      <div aria-hidden="true" className="text-[28px] font-semibold leading-[1.15] tabular-nums text-hx-coal"><AnimatedNumber value={jobs.length} /></div>
      <div aria-hidden="true" className="min-h-4 text-[12px] text-hx-ink-soft">{detail}</div>
    </li>
  );
}

export function DashboardFunnel({ data, openJobs, recommendedTotal, range, busy = false }: { data: EmployerDashboardData | null; openJobs: RequirementSummary[]; recommendedTotal: number; range: DashboardRange; busy?: boolean }) {
  const steps = buildFunnel(data, recommendedTotal);
  /* Two columns below 640px (a 2x2 grid), four in one row above it. */
  const borders = ["border-r border-b min-[640px]:border-b-0", "border-b min-[640px]:border-r min-[640px]:border-b-0", "border-r", ""];
  return (
    <section aria-label="Hiring funnel" aria-busy={busy} className="mx-busy min-w-0 border-b border-hx-line">
      <ol className={`${LIST} grid grid-cols-2 min-[640px]:grid-cols-4`}>
        <OpenJobsItem jobs={openJobs} border={borders[0]} />
        {steps.map((step, i) => <FunnelStepItem key={step.key} step={step} range={range} border={borders[i + 1]} />)}
      </ol>
    </section>
  );
}

/* ─── Active jobs ─── */

function JobMeta({ job, health }: { job: RequirementSummary; health?: { tone: "warning" | "error"; label: string } | null }) {
  const where = job.workMode ? job.workMode[0].toUpperCase() + job.workMode.slice(1) : job.location;
  const type = job.employmentType ? job.employmentType.replace("-", " ").replace(/^./, (c) => c.toUpperCase()) : "";
  const parts = [where, type ].filter(Boolean);
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[12px] text-hx-ink-soft">
      {parts.map((part, i) => (
        <span key={part} className="whitespace-nowrap">{part}{(i < parts.length - 1 || health) && <span aria-hidden="true"> ·</span>}</span>
      ))}
      {health && <span className={`font-medium ${health.tone === "error" ? "text-hx-error-ink" : "text-hx-warning-ink"}`}>{health.label}</span>}
    </div>
  );
}

function JobStatusBadge({ job, pipeline }: { job: RequirementSummary; pipeline: DashboardJobPipeline | undefined }) {
  if (job.status === "failed") return <Badge tone="error">Needs retry</Badge>;
  const stage = pipelineStage(job, pipeline);
  if ((stage === "ai_matching" || stage === "ready_for_review") && job.status === "zero") return <Badge tone="neutral">No matches yet</Badge>;
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;
}

const JOBS_SHOWN = 5;

export function ActiveJobsCard({
  jobs, pipeline, now, rowActions,
}: {
  jobs: RequirementSummary[];
  pipeline: DashboardJobPipeline[] | null;
  now: number;
  rowActions: (job: RequirementSummary) => ReactNode;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: JobSortKey; dir: SortDir } | null>(null);
  const byId = new Map((pipeline ?? []).map((p) => [p.requirementId, p]));
  const ordered = sort ? sortJobs(jobs, pipeline, sort.key, sort.dir) : jobsNeedingAttentionFirst(jobs);
  const shown = ordered.slice(0, JOBS_SHOWN);
  const toggleSort = (key: JobSortKey) => setSort((cur) => (cur?.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "title" ? "asc" : "desc" }));
  const SORT_LABEL: Record<JobSortKey, string> = { title: "job title", status: "status", evaluated: "evaluated", recommended: "strong matches", interviewing: "interviewing", hired: "hired" };
  const sortHead = (key: JobSortKey, label: string, center: boolean, hint?: string) => {
    const active = sort?.key === key;
    const Icon = !active ? ChevronsUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
    return (
      <TableHead className={`${TH} ${center ? "text-center" : ""}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <div className={`flex items-center gap-1 ${center ? "justify-center" : ""}`}>
          <button type="button" onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 rounded font-semibold hover:text-hx-coal ${active ? "text-hx-coal" : ""}`}>
            {label}
            <Icon size={12} aria-hidden="true" className={active ? "" : "opacity-50"} />
          </button>
          {hint && <InfoTip label={`About ${label}`}>{hint}</InfoTip>}
        </div>
      </TableHead>
    );
  };
  return (
    <section aria-labelledby="active-jobs-heading" className={`${CARD} @container`}>
      <CardHeader
        id="active-jobs-heading"
        title="Active jobs"
        description={sort ? `Sorted by ${SORT_LABEL[sort.key]}, ${sort.dir === "asc" ? "lowest" : "highest"} first.` : "Jobs needing attention first."}
        action={
          <TextLink href="/employer/jobs">View all jobs</TextLink>
        }
      />
      {shown.length === 0 ? (
        <EmptyState className={EMPTY} title="No active jobs" description="Post a job and matched candidates will show up here." />
      ) : (
        <>
          <div className={`hidden border-y border-hx-line @min-[700px]:block ${BLEED}`}>
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {sortHead("title", "Job title", false)}
                  {sortHead("status", "Status", false)}
                  {sortHead("evaluated", "Evaluated", true)}
                  {sortHead("recommended", "Strong matches", true, `A strong match scores ${STRONG_MATCH_THRESHOLD}% or higher against this job. When a job shows 0, the candidates evaluated so far scored lower.`)}
                  {sortHead("interviewing", "Interviewing", true)}
                  {sortHead("hired", "Hired", true)}
                  <TableHead className={`${TH} w-12`}><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((j) => {
                  const p = byId.get(j.id);
                  const health = jobHealth(j, p, now);
                  return (
                    <TableRow
                      key={j.id}
                      className="cursor-pointer"
                      onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button, [role='menuitem']")) router.push(`/employer/requirements/${j.id}`); }}
                    >
                      <TableCell className={`${TD} whitespace-normal`}>
                        <Link href={`/employer/requirements/${j.id}`} className="inline-block py-0.5 font-semibold text-hx-coal no-underline hover:underline">{j.title}</Link>
                        <JobMeta job={j} health={health} />
                      </TableCell>
                      <TableCell className={TD}>
                        <JobStatusBadge job={j} pipeline={p} />
                      </TableCell>
                      <TableCell className={`${TD} text-center`}>{j.aiScreening.evaluated}</TableCell>
                      <TableCell className={`${TD} text-center`}>{j.aiScreening.topMatches}</TableCell>
                      <TableCell className={`${TD} text-center`}>{p ? p.interviewing : "n/a"}</TableCell>
                      <TableCell className={`${TD} text-center`}>{p ? p.hired : "n/a"}</TableCell>
                      <TableCell className={`${TD} px-1 text-right`}>{rowActions(j)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ul className={`${LIST} -mx-7 border-y border-hx-line @min-[700px]:hidden`}>
            {shown.map((j, i) => {
              const p = byId.get(j.id);
              const health = jobHealth(j, p, now);
              const stats: Array<[string, string | number]> = [
                ["Evaluated", j.aiScreening.evaluated],
                ["Strong matches", j.aiScreening.topMatches],
                ["Interviewing", p ? p.interviewing : "n/a"],
                ["Hired", p ? p.hired : "n/a"],
              ];
              return (
                <li key={j.id} className={`px-7 py-3 ${i > 0 ? "border-t border-hx-line" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/employer/requirements/${j.id}`} className="inline-block py-0.5 text-[14px] font-semibold text-hx-coal no-underline [overflow-wrap:anywhere] hover:underline">{j.title}</Link>
                      <JobMeta job={j} />
                    </div>
                    <div className="shrink-0">{rowActions(j)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <JobStatusBadge job={j} pipeline={p} />
                    {health && <Pill tone={health.tone}>{health.label}</Pill>}
                  </div>
                  <dl className="m-0 mt-3 flex flex-wrap justify-between gap-x-3 gap-y-2">
                    {stats.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[11px] text-hx-ink-soft">{label}</dt>
                        <dd className="m-0 text-[15px] font-semibold text-hx-coal">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
          {jobs.length > JOBS_SHOWN && (
            <p className="m-0 mt-4 text-[13px] text-hx-ink-soft">Showing {JOBS_SHOWN} of {jobs.length} jobs.</p>
          )}
        </>
      )}
    </section>
  );
}

/* ─── Candidates to review ─── */

function waitingLabel(days: number | null): string | null {
  return days !== null && days >= 3 ? `Waiting ${days} days` : null;
}

const REVIEW_COLS = "@min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] @min-[960px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_216px]";
const COL_LABEL = "text-[12px] font-medium text-hx-ink-soft @min-[960px]:sr-only";

const FIT_TEXT: Record<NonNullable<RecommendedCard["experienceFit"]>, { cls: string; word: string }> = {
  within: { cls: "text-hx-success-ink", word: "Within" },
  below: { cls: "text-hx-warning-ink", word: "Below" },
  above: { cls: "text-hx-ink-soft", word: "Above" },
};

function SkillsCell({ c }: { c: RecommendedCard }) {
  const shown = c.matchedSkills.slice(0, 3);
  const more = c.matchedSkills.length - shown.length;
  const missing = c.missingSkills.slice(0, 2);
  const moreMissing = c.missingSkills.length - missing.length;
  const segments = Math.min(c.requiredCount, 8);
  const filled = c.requiredCount > 0 ? Math.round((c.matchedSkills.length / c.requiredCount) * segments) : 0;
  return (
    <div className="min-w-0">
      <div className={COL_LABEL}>Skills</div>
      {c.requiredCount > 0 && (
        <div className="mt-1 flex items-center gap-2.5 @min-[960px]:mt-0">
          <span className="text-[13px] text-hx-ink-soft"><span className="font-semibold text-hx-coal">{c.matchedSkills.length}</span> of {c.requiredCount} required</span>
          <div className="flex gap-0.5" aria-hidden="true">
            {Array.from({ length: segments }, (_, k) => (
              <span key={k} style={k < filled ? segmentDelay(k) : undefined} className={`h-1 w-3 rounded-full ${k < filled ? "mx-seg bg-hx-success" : "bg-hx-line"}`} />
            ))}
          </div>
        </div>
      )}
      {shown.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {shown.map((sk) => <Pill key={sk} tone="success">{sk}</Pill>)}
          {more > 0 && <Pill tone="neutral">+{more}</Pill>}
        </div>
      )}
      {missing.length > 0 && (
        <p className="m-0 mt-2 text-[12px] leading-[1.5] text-hx-ink-soft">
          Missing {missing.join(", ")}{moreMissing > 0 ? ` +${moreMissing} more` : ""}
        </p>
      )}
    </div>
  );
}

function ExperienceCell({ c }: { c: RecommendedCard }) {
  const fit = c.experienceFit && c.experienceAsk ? FIT_TEXT[c.experienceFit] : null;
  return (
    <div className="min-w-0">
      <div className={COL_LABEL}>Experience</div>
      {c.yearsExperience === null ? (
        <p className="m-0 mt-1 text-[13px] text-hx-ink-soft @min-[960px]:mt-0">Not listed</p>
      ) : (
        <p className="m-0 mt-1 text-[13px] leading-[1.5] text-hx-ink-soft @min-[960px]:mt-0">
          <span className="font-semibold text-hx-coal">{c.yearsExperience} {c.yearsExperience === 1 ? "year" : "years"}</span>
          {fit && <span className={fit.cls}>{" \u00b7 "}{fit.word} {c.experienceAsk}</span>}
        </p>
      )}
    </div>
  );
}

export function RecommendedCandidatesCard({ cards, total }: { cards: RecommendedCard[]; total: number }) {
  return (
    <section aria-labelledby="recommended-heading" className={`${CARD} @container`}>
      <CardHeader
        id="recommended-heading"
        title="Candidates to review"
        description={cards.length > 0 ? `${total > cards.length ? `Top ${cards.length} of ${total}` : `${total} ${total === 1 ? "candidate" : "candidates"}`} waiting for your review, best match first.` : undefined}
        action={<TextLink href="/employer/jobs">View all</TextLink>}
      />
      {cards.length === 0 ? (
        <EmptyState className={EMPTY} title="No candidates to review" description="Strong matches appear here as soon as a job finishes screening." />
      ) : (
        <>
          <div aria-hidden="true" className={`-mx-7 mt-4 hidden gap-x-8 border-y border-hx-line bg-hx-soft px-7 py-2.5 text-[12px] font-medium text-hx-ink-soft @min-[960px]:grid ${REVIEW_COLS}`}>
            <span>Candidate</span>
            <span>Skills</span>
            <span>Experience</span>
            <span>Match</span>
          </div>
          <ul className={`${LIST} mx-stagger -mx-7 divide-y divide-hx-line`}>
            {cards.map((c) => {
              const waiting = waitingLabel(c.waitingDays);
              return (
                <li key={c.matchId} className={`grid grid-cols-1 gap-x-8 gap-y-4 px-7 py-4 @min-[960px]:items-center ${REVIEW_COLS}`}>
                  <div className="flex min-w-0 items-start gap-3.5">
                    <PersonAvatar name={c.name} initials={c.initials} />
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-5 text-hx-coal [overflow-wrap:anywhere]">{c.name}</div>
                      <div className="mt-1 text-[13px] leading-[1.45] text-hx-ink-soft [overflow-wrap:anywhere]">for {c.roleTitle}</div>
                      {c.traits.length > 0 && (
                        <div className="mt-1 text-[13px] leading-[1.45] text-hx-coal [overflow-wrap:anywhere]">{c.traits.join(" · ")}</div>
                      )}
                      {waiting && (
                        <div className="mt-2">
                          <Pill tone="warning">{waiting}</Pill>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 space-y-3 @min-[960px]:contents">
                    <SkillsCell c={c} />
                    <ExperienceCell c={c} />
                  </div>
                  <div className="flex items-center justify-between gap-4 @min-[640px]:flex-col @min-[640px]:items-end @min-[640px]:justify-start @min-[960px]:flex-row @min-[960px]:justify-between">
                    {c.matchScore !== null && (
                      <div className="flex items-center gap-2.5 @min-[640px]:flex-row-reverse">
                        <ScoreChip score={Math.round(c.matchScore)} />
                        <span className="text-[12px] text-hx-ink-soft @min-[960px]:sr-only">Match</span>
                      </div>
                    )}
                    <div className="@min-[960px]:min-w-0 @min-[960px]:flex-1 @min-[960px]:[&_a]:w-full">
                      <OutlineLink small href={`/employer/requirements/${c.requirementId}/candidates/${c.matchId}`}>
                        Review<span className="sr-only"> {c.name}</span>
                      </OutlineLink>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/* ─── Right rail ─── */

export function UpcomingInterviewsCard({ items }: { items: DashboardUpcomingInterview[] }) {
  return (
    <section aria-labelledby="upcoming-heading" className={CARD}>
      <CardHeader id="upcoming-heading" title="Upcoming interviews" action={<TextLink href="/employer/jobs">View all</TextLink>} />
      {items.length === 0 ? (
        <EmptyState className={EMPTY} title="Nothing scheduled" description="Invite a candidate to interview and it will show up here." />
      ) : (
        <ul className={`${LIST} mx-stagger flex flex-col gap-2.5`}>
          {items.map((i) => {
            const slot = interviewSlot(i.scheduledAt);
            return (
              <li key={i.matchId} className="flex items-center gap-3">
                <div className="w-11 shrink-0 rounded-lg border border-hx-line py-1 text-center">
                  <div className="text-[16px] font-bold leading-[1.1] text-hx-coal">{slot.day}</div>
                  <div className="text-[11px] text-hx-ink-soft">{slot.month}</div>
                </div>
                <PersonAvatar name={i.candidateName} initials={i.initials} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-hx-ink-soft">{slot.time}</div>
                  <div className="text-[13px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{i.candidateName}</div>
                  <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">{i.roleTitle}</div>
                </div>
                <OutlineLink small href={`/employer/requirements/${i.requirementId}/candidates/${i.matchId}`}>
                  Prepare<span className="sr-only"> for {i.candidateName}</span>
                </OutlineLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const INSIGHT_ICON: Record<string, ReactNode> = {
  "best-pipeline": <TrendingUpIcon size={16} />,
  "no-strong": <SearchXIcon size={16} />,
  stale: <ClockIcon size={16} />,
};

export function KeyInsightsCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section aria-labelledby="insights-heading" className={CARD}>
      <CardHeader id="insights-heading" title="Key insights" />
      {insights.length === 0 ? (
        <EmptyState className={EMPTY} title="No insights yet" description="Insights appear once your jobs have screened candidates." />
      ) : (
        <InsightList>
          {insights.map((i) => (
            <InsightRow
              key={i.id}
              tone={i.tone}
              icon={INSIGHT_ICON[i.id] ?? <LightbulbIcon size={16} />}
              title={i.title}
              body={i.body}
              href={i.href}
              cta={i.cta}
              className="first:pt-2 last:pb-1"
            />
          ))}
        </InsightList>
      )}
    </section>
  );
}

export function RecentActivityCard({ items }: { items: DashboardActivityItem[] }) {
  return (
    <section aria-labelledby="activity-heading" className={CARD}>
      <CardHeader id="activity-heading" title="Recent activity" />
      {items.length === 0 ? (
        <EmptyState className={EMPTY} title="No activity yet" description="Moves you make on candidates, like inviting or hiring, are logged here." />
      ) : (
        <ul className={`${LIST} mx-stagger flex flex-col gap-1`}>
          {items.map((a) => (
            <li key={a.id} className="flex justify-between gap-3 text-[13px] leading-[1.45] text-hx-coal">
              {a.href
                ? <Link href={a.href} className="inline-block min-h-6 py-0.5 text-hx-coal no-underline hover:underline [overflow-wrap:anywhere]">{a.text}</Link>
                : <span className="py-0.5">{a.text}</span>}
              <span className="whitespace-nowrap py-0.5 text-[12px] text-hx-ink-soft">{hoursOrDaysAgo(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Loading skeleton shaped like the dashboard ─── */

/* Same cards, in the same order and grid, as the loaded dashboard, so nothing
   jumps when data arrives. Blocks inside a card stand in for its heading and
   rows; they are decorative and the status line carries the announcement. */
function SkeletonRows({ count, avatar = false }: { count: number; avatar?: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          {avatar && <Skeleton className="size-10 shrink-0 rounded-full" />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SkeletonCard({ rows, avatar }: { rows: number; avatar?: boolean }) {
  return (
    <div className={CARD}>
      <Skeleton aria-hidden="true" className="mb-4 h-4 w-36" />
      <SkeletonRows count={rows} avatar={avatar} />
    </div>
  );
}

export function DashboardSkeleton({ withHeader = false, inline = false }: { withHeader?: boolean; inline?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={inline ? undefined : "overflow-hidden rounded-2xl border border-hx-line bg-white"}>
      <span className="sr-only">Loading your overview…</span>
      {withHeader && (
        <div aria-hidden="true" className="flex flex-col gap-2 border-b border-hx-line px-7 py-5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      )}
      <div aria-hidden="true" className="grid grid-cols-1 border-b border-hx-line min-[640px]:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex flex-col gap-2 px-7 py-5 ${i < 2 ? "border-b border-hx-line min-[640px]:border-b-0 min-[640px]:border-r" : ""}`}>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0 divide-y divide-hx-line min-[1100px]:border-r min-[1100px]:border-hx-line">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} avatar />
        </div>
        <div className="min-w-0 divide-y divide-hx-line border-t border-hx-line min-[1100px]:border-t-0">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={3} />
        </div>
      </div>
    </div>
  );
}
