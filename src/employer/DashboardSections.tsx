"use client";

/* Presentational sections for the employer dashboard (app/(employer)/employer/
   page.tsx). Styled after the candidate dashboard (src/DashboardHomeSections.tsx):
   flat bordered 12px cards on the line token, neutral pills, indigo reserved for
   actions. Built on the shared primitives (ui/table, ui/avatar, NativeSelect,
   SearchInput, EmptyState, _atoms Badge/Pill/ScoreChip) rather than local
   copies. Everything is driven by props; data wiring stays in the page. */

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { BriefcaseIcon, UsersIcon, CalendarDaysIcon, CircleCheckIcon, LightbulbIcon, ClockIcon, TrendingUpIcon, SearchXIcon, ArrowRightIcon, PlusIcon, SparklesIcon, UserIcon } from "lucide-react";
import { hoursOrDaysAgo } from "@/hiringMatchFormat";
import AnimatedNumber from "@/AnimatedNumber";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { SearchInput } from "@/components/SearchInput";
import { Badge, Pill, ScoreChip, STAGE_LABEL, STAGE_TONE } from "./_atoms";
import { PrimaryLink, OutlineLink } from "./_consoleParts";
import type { RequirementSummary } from "./mockData";
import {
  RANGE_LABEL, trendDelta, interviewSlot, jobHealth, pipelineStage,
  type DashboardRange, type DashboardTrend, type DashboardJobPipeline, type DashboardUpcomingInterview,
  type DashboardActivityItem, type DashboardInsight, type InsightTone, type RecommendedCard, type EmployerDashboardData, type NextAction,
} from "./dashboardData";

const RANGE_OPTIONS: readonly DashboardRange[] = [7, 30, 90];

const CARD = "min-w-0 rounded-xl border border-hx-line bg-white p-[18px]";
const H2 = "m-0 flex items-center gap-2.5 text-[16px] font-bold text-hx-coal";
const LIST = "m-0 list-none p-0";
const EMPTY = "border border-hx-line p-4";
const TH = "h-10 whitespace-nowrap bg-hx-soft px-3 text-[12px] font-semibold text-hx-ink-soft";
const TD = "px-3 py-3 text-[13px] text-hx-coal";

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

function CardHeader({ id, icon, title, action }: { id: string; icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 id={id} className={H2}>
        <span aria-hidden="true" className="inline-flex text-hx-ink-soft">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm py-1 text-[13px] font-semibold text-hx-indigo no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo">
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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="m-0 mb-1 text-[28px] font-bold tracking-[-0.01em] text-hx-coal [overflow-wrap:anywhere]">
          Welcome back{companyName ? `, ${companyName}` : ""}
        </h1>
        <p className="m-0 text-[14px] text-hx-ink-soft">Here&apos;s what you need to focus on today.</p>
      </div>
      <div className="flex w-full items-center gap-2.5 min-[900px]:w-auto">
        <DashboardSearch jobs={jobs} candidates={recommended} />
        <label className="inline-flex shrink-0 items-center">
          <span className="sr-only">Date range</span>
          <NativeSelect value={range} onChange={(e) => onRangeChange(Number(e.target.value) as DashboardRange)} className="[&_select]:h-9 [&_select]:cursor-pointer">
            {RANGE_OPTIONS.map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
          </NativeSelect>
        </label>
      </div>
    </div>
  );
}

function DashboardSearch({ jobs, candidates }: { jobs: RequirementSummary[]; candidates: RecommendedCard[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [];
    const jobHits = jobs
      .filter((j) => j.title.toLowerCase().includes(term) || j.skills.some((s) => s.toLowerCase().includes(term)))
      .map((j) => ({ id: `j-${j.id}`, label: j.title, hint: "Job", href: `/employer/requirements/${j.id}` }));
    const candidateHits = candidates
      .filter((c) => c.name.toLowerCase().includes(term) || c.matchedSkills.some((s) => s.toLowerCase().includes(term)))
      .map((c) => ({ id: `c-${c.matchId}`, label: c.name, hint: c.roleTitle, href: `/employer/requirements/${c.requirementId}/candidates/${c.matchId}` }));
    return [...jobHits, ...candidateHits].slice(0, 6);
  }, [term, jobs, candidates]);

  return (
    <div className="relative min-w-0 flex-1 min-[900px]:w-[260px] min-[900px]:flex-none">
      <SearchInput id="employer-dashboard-search" label="Search jobs, candidates, or skills" value={q} onChange={setQ} onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }} placeholder="Search jobs or skills" />
      <p role="status" className="sr-only">
        {term ? (results.length === 0 ? "No results" : `${results.length} ${results.length === 1 ? "result" : "results"}`) : ""}
      </p>
      {term && (
        <div className="absolute inset-x-0 top-11 z-20 min-w-0 rounded-xl border border-hx-line bg-white p-1.5 shadow-lg">
          {results.length === 0 ? (
            <p className="m-0 px-2.5 py-2 text-[13px] text-hx-ink-soft">No jobs or skills match &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            <ul className={LIST} aria-label="Search results">
              {results.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="flex min-h-9 items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-hx-coal no-underline hover:bg-hx-soft focus-visible:bg-hx-soft">
                    <span className="truncate">{r.label}</span>
                    <span className="shrink-0 text-hx-ink-soft">{r.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Next best action ─── */

export function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section aria-labelledby="next-action-heading" className={`${CARD} flex flex-wrap items-center justify-between gap-x-6 gap-y-3`}>
      <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-hx-indigo-100 text-hx-indigo">
          <SparklesIcon size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="next-action-heading" className="m-0 text-[15px] font-bold text-hx-coal [overflow-wrap:anywhere]">{action.title}</h2>
          <p className="m-0 mt-0.5 text-[13px] leading-normal text-hx-ink-soft">{action.body}</p>
        </div>
      </div>
      <PrimaryLink href={action.href} icon={<ArrowRightIcon size={14} aria-hidden="true" />}>{action.cta}</PrimaryLink>
    </section>
  );
}

/* ─── Stat cards ─── */

function Sparkline({ series }: { series: number[] }) {
  const w = 84, h = 28;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => `${((i / (series.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="stroke-hx-indigo" />
    </svg>
  );
}

function StatCard({ icon, label, value, trend, trendNoun, range }: { icon: ReactNode; label: string; value: number | null; trend: DashboardTrend | null; trendNoun: string; range: DashboardRange }) {
  const delta = trend ? trendDelta(trend) : null;
  const deltaText = delta ? `${delta.label} ${trendNoun}, last ${range} days` : null;
  return (
    <li className={`${CARD} flex flex-col gap-2.5`}>
      <p className="sr-only">{value === null ? "Not available" : value} {label}{deltaText ? `, ${deltaText}` : ""}</p>
      <div aria-hidden="true" className="flex items-center gap-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-hx-soft text-hx-indigo">{icon}</span>
        <span className="min-w-0 text-[14px] text-hx-ink-soft">{label}</span>
      </div>
      <div aria-hidden="true" className="flex items-end justify-between gap-3">
        <span className="text-[28px] font-bold leading-[1.1] text-hx-coal">
          {value === null ? "–" : <AnimatedNumber value={value} />}
        </span>
        {trend && <Sparkline series={trend.series} />}
      </div>
      <div aria-hidden="true" className="min-h-4 text-[12px] text-hx-ink-soft">
        {delta && (
          <>
            <strong className={`font-bold ${delta.diff > 0 ? "text-hx-success-ink" : "text-hx-ink-soft"}`}>{delta.label}</strong>{" "}
            {trendNoun}, last {range} days
          </>
        )}
      </div>
    </li>
  );
}

export function DashboardStatCards({ jobs, data, recommendedTotal, range }: { jobs: RequirementSummary[]; data: EmployerDashboardData | null; recommendedTotal: number; range: DashboardRange }) {
  return (
    <section aria-label="Hiring summary">
      <ul className={`${LIST} grid grid-cols-1 gap-3.5 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-4`}>
        <StatCard icon={<BriefcaseIcon size={18} />} label="Active Jobs" value={jobs.length} trend={data?.trends.jobs ?? null} trendNoun="new" range={range} />
        <StatCard icon={<UsersIcon size={18} />} label="Recommended Candidates" value={recommendedTotal} trend={data?.trends.recommended ?? null} trendNoun="new" range={range} />
        <StatCard icon={<CalendarDaysIcon size={18} />} label="Interviews Scheduled" value={data ? data.totals.interviewsScheduled : null} trend={data?.trends.interviews ?? null} trendNoun="invited" range={range} />
        <StatCard icon={<CircleCheckIcon size={18} />} label="Hired" value={data ? data.totals.hired : null} trend={data?.trends.hired ?? null} trendNoun="hired" range={range} />
      </ul>
    </section>
  );
}

/* ─── Active jobs ─── */

function JobMeta({ job, updatedAt }: { job: RequirementSummary; updatedAt: string | null }) {
  const where = job.workMode ? job.workMode[0].toUpperCase() + job.workMode.slice(1) : job.location;
  const type = job.employmentType ? job.employmentType.replace("-", " ").replace(/^./, (c) => c.toUpperCase()) : "";
  const parts = [where, type, `Updated ${hoursOrDaysAgo(updatedAt ?? job.createdAt)}`].filter(Boolean);
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[12px] text-hx-ink-soft">
      {parts.map((part, i) => (
        <span key={part} className="whitespace-nowrap">{part}{i < parts.length - 1 && <span aria-hidden="true"> ·</span>}</span>
      ))}
    </div>
  );
}

function JobStatusBadge({ job, pipeline }: { job: RequirementSummary; pipeline: DashboardJobPipeline | undefined }) {
  if (job.status === "failed") return <Badge tone="error">Needs retry</Badge>;
  const stage = pipelineStage(job, pipeline);
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;
}

export function ActiveJobsCard({
  jobs, pipeline, canCreate, now, rowActions,
}: {
  jobs: RequirementSummary[];
  pipeline: DashboardJobPipeline[] | null;
  canCreate: boolean;
  now: number;
  rowActions: (job: RequirementSummary) => ReactNode;
}) {
  const byId = new Map((pipeline ?? []).map((p) => [p.requirementId, p]));
  const shown = jobs.slice(0, 5);
  return (
    <section aria-labelledby="active-jobs-heading" className={`${CARD} @container`}>
      <CardHeader
        id="active-jobs-heading"
        icon={<BriefcaseIcon size={18} />}
        title="Active Jobs"
        action={
          <div className="flex items-center gap-3.5">
            <TextLink href="/employer/jobs">View all jobs</TextLink>
            {canCreate && (
              <Button asChild size="sm" className="h-9 gap-1.5">
                <Link href="/employer/requirements/new"><PlusIcon size={14} aria-hidden="true" />Create Job</Link>
              </Button>
            )}
          </div>
        }
      />
      {shown.length === 0 ? (
        <EmptyState className={EMPTY} title="No active jobs" description="Post a requirement and matched candidates will show up here." />
      ) : (
        <>
          <div className="hidden rounded-lg border border-hx-line @min-[700px]:block">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Job Title</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                  <TableHead className={`${TH} text-center`}>Evaluated</TableHead>
                  <TableHead className={`${TH} text-center`}>Recommended</TableHead>
                  <TableHead className={`${TH} text-center`}>Interviewing</TableHead>
                  <TableHead className={`${TH} text-center`}>Hired</TableHead>
                  <TableHead className={`${TH} w-12`}><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((j) => {
                  const p = byId.get(j.id);
                  const health = jobHealth(j, p, now);
                  return (
                    <TableRow key={j.id}>
                      <TableCell className={`${TD} whitespace-normal`}>
                        <Link href={`/employer/requirements/${j.id}`} className="inline-block py-0.5 font-semibold text-hx-coal no-underline hover:underline">{j.title}</Link>
                        <JobMeta job={j} updatedAt={p?.lastUpdatedAt ?? null} />
                        {health && <div className="mt-1.5"><Pill tone={health.tone}>{health.label}</Pill></div>}
                      </TableCell>
                      <TableCell className={TD}><JobStatusBadge job={j} pipeline={p} /></TableCell>
                      <TableCell className={`${TD} text-center`}>{j.aiScreening.evaluated}</TableCell>
                      <TableCell className={`${TD} text-center`}>{j.aiScreening.topMatches}</TableCell>
                      <TableCell className={`${TD} text-center`}>{p ? p.interviewing : "–"}</TableCell>
                      <TableCell className={`${TD} text-center`}>{p ? p.hired : "–"}</TableCell>
                      <TableCell className={`${TD} px-1 text-right`}>{rowActions(j)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ul className={`${LIST} rounded-lg border border-hx-line @min-[700px]:hidden`}>
            {shown.map((j, i) => {
              const p = byId.get(j.id);
              const health = jobHealth(j, p, now);
              const stats: Array<[string, string | number]> = [
                ["Evaluated", j.aiScreening.evaluated],
                ["Recommended", j.aiScreening.topMatches],
                ["Interviewing", p ? p.interviewing : "–"],
                ["Hired", p ? p.hired : "–"],
              ];
              return (
                <li key={j.id} className={`p-3 ${i > 0 ? "border-t border-hx-line" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/employer/requirements/${j.id}`} className="inline-block py-0.5 text-[14px] font-semibold text-hx-coal no-underline [overflow-wrap:anywhere] hover:underline">{j.title}</Link>
                      <JobMeta job={j} updatedAt={p?.lastUpdatedAt ?? null} />
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
        </>
      )}
    </section>
  );
}

/* ─── Candidates to review ─── */

function waitingLabel(days: number | null): string | null {
  return days !== null && days >= 3 ? `Waiting ${days} days` : null;
}

const REVIEW_COLS = "@min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] @min-[960px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1.7fr)_minmax(0,0.9fr)_176px]";
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
              <span key={k} className={`h-1 w-3 rounded-full ${k < filled ? "bg-hx-success" : "bg-hx-line"}`} />
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
        icon={<UsersIcon size={18} />}
        title="Candidates to review"
        action={<TextLink href="/employer/jobs">View all</TextLink>}
      />
      {cards.length > 0 && (
        <p className="m-0 text-[13px] text-hx-ink-soft">
          {total > cards.length ? `Top ${cards.length} of ${total}` : `${total} ${total === 1 ? "candidate" : "candidates"}`} waiting for your review, best match first.
        </p>
      )}
      {cards.length === 0 ? (
        <EmptyState className={EMPTY} title="No candidates to review" description="Strong matches appear here as soon as a job finishes screening." />
      ) : (
        <>
          <div aria-hidden="true" className={`mt-5 hidden gap-x-6 border-b border-hx-line px-1 pb-2.5 text-[12px] font-medium text-hx-ink-soft @min-[960px]:grid ${REVIEW_COLS}`}>
            <span>Candidate</span>
            <span>Skills</span>
            <span>Experience</span>
            <span>Match</span>
          </div>
          <ul className={`${LIST} divide-y divide-hx-line`}>
            {cards.map((c) => {
              const waiting = waitingLabel(c.waitingDays);
              return (
                <li key={c.matchId} className={`grid grid-cols-1 gap-x-6 gap-y-5 px-1 py-5 @min-[960px]:items-start ${REVIEW_COLS}`}>
                  <div className="flex min-w-0 items-start gap-3.5">
                    <PersonAvatar name={c.name} initials={c.initials} />
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-5 text-hx-coal [overflow-wrap:anywhere]">{c.name}</div>
                      <div className="mt-1 text-[13px] leading-[1.45] text-hx-ink-soft [overflow-wrap:anywhere]">for {c.roleTitle}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {c.createdAt && <span className="text-[12px] text-hx-ink-soft">Matched {hoursOrDaysAgo(c.createdAt)}</span>}
                        {waiting && <Pill tone="warning">{waiting}</Pill>}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-4 @min-[960px]:contents">
                    <SkillsCell c={c} />
                    <ExperienceCell c={c} />
                  </div>
                  <div className="flex items-center justify-between gap-4 @min-[640px]:flex-col @min-[640px]:items-end @min-[640px]:justify-start @min-[960px]:flex-row @min-[960px]:items-center">
                    {c.matchScore !== null && (
                      <div className="flex items-center gap-2.5 @min-[640px]:flex-row-reverse">
                        <ScoreChip score={Math.round(c.matchScore)} />
                        <span className="text-[12px] text-hx-ink-soft @min-[960px]:sr-only">Match</span>
                      </div>
                    )}
                    <OutlineLink small href={`/employer/requirements/${c.requirementId}/candidates/${c.matchId}`}>
                      Review<span className="sr-only"> {c.name}</span>
                    </OutlineLink>
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
      <CardHeader id="upcoming-heading" icon={<CalendarDaysIcon size={18} />} title="Upcoming interviews" action={<TextLink href="/employer/jobs">View all</TextLink>} />
      {items.length === 0 ? (
        <EmptyState className={EMPTY} title="Nothing scheduled" description="Invite a shortlisted candidate to interview and it will show up here." />
      ) : (
        <ul className={`${LIST} flex flex-col gap-2.5`}>
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

const INSIGHT_TILE: Record<InsightTone, string> = {
  positive: "bg-hx-success-100 text-hx-success-ink",
  action: "bg-hx-indigo-100 text-hx-indigo",
  attention: "bg-hx-warning-100 text-hx-warning-ink",
  neutral: "bg-hx-soft text-hx-ink-soft",
};

const INSIGHT_ICON: Record<string, ReactNode> = {
  "best-pipeline": <TrendingUpIcon size={16} />,
  "awaiting-review": <UsersIcon size={16} />,
  "no-strong": <SearchXIcon size={16} />,
  stale: <ClockIcon size={16} />,
};

export function KeyInsightsCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section aria-labelledby="insights-heading" className={CARD}>
      <CardHeader id="insights-heading" icon={<LightbulbIcon size={18} />} title="Key insights" />
      {insights.length === 0 ? (
        <EmptyState className={EMPTY} title="No insights yet" description="Insights appear once your jobs have screened candidates." />
      ) : (
        <ul className={`${LIST} divide-y divide-hx-line`}>
          {insights.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="group flex items-start gap-3.5 rounded-md py-4 no-underline first:pt-2 last:pb-1">
                <span aria-hidden="true" className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${INSIGHT_TILE[i.tone]}`}>
                  {INSIGHT_ICON[i.id] ?? <LightbulbIcon size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-5 text-hx-coal">{i.title}</span>
                  <span className="mt-1 block text-[13px] leading-[1.55] text-hx-ink-soft">{i.body}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-hx-indigo group-hover:underline">
                    {i.cta}
                    <ArrowRightIcon size={14} aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentActivityCard({ items }: { items: DashboardActivityItem[] }) {
  return (
    <section aria-labelledby="activity-heading" className={CARD}>
      <CardHeader id="activity-heading" icon={<ClockIcon size={18} />} title="Recent activity" />
      {items.length === 0 ? (
        <EmptyState className={EMPTY} title="No activity yet" description="Moves you make on candidates, like inviting or hiring, are logged here." />
      ) : (
        <ul className={`${LIST} flex flex-col gap-1`}>
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

export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Loading your overview…</span>
      <div className="grid grid-cols-1 gap-3.5 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-4">
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-[132px] rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[160px] rounded-xl" />
          <Skeleton className="h-[160px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
