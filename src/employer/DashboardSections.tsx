"use client";

/* Presentational sections for the employer dashboard (app/(employer)/employer/
   page.tsx). Styled after the candidate dashboard (src/DashboardHomeSections.tsx):
   flat bordered 12px cards on the line token, neutral pills, indigo reserved for
   actions. Colors come from the hx-* theme tokens in index.css. Everything is
   driven by props; data wiring stays in the page. */

import Link from "next/link";
import { useMemo, useState } from "react";
import { BriefcaseIcon, UsersIcon, CalendarDaysIcon, CircleCheckIcon, LightbulbIcon, ClockIcon, EllipsisIcon, ArrowRightIcon, SearchIcon, PlusIcon, ChevronDownIcon } from "lucide-react";
import { hoursOrDaysAgo } from "@/hiringMatchFormat";
import AnimatedNumber from "@/AnimatedNumber";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { RequirementSummary } from "./mockData";
import {
  RANGE_LABEL, trendDelta, jobStatusLabel, interviewSlot,
  type DashboardRange, type DashboardTrend, type DashboardJobPipeline, type DashboardUpcomingInterview,
  type DashboardActivityItem, type DashboardInsight, type RecommendedCard, type EmployerDashboardData,
} from "./dashboardData";

const RANGE_OPTIONS: readonly DashboardRange[] = [7, 30, 90];

const CARD = "min-w-0 rounded-xl border border-hx-line bg-white p-4";
const H2 = "m-0 flex items-center gap-2.5 text-[16px] font-bold text-hx-coal";
const LIST = "m-0 list-none p-0";
const TH = "whitespace-nowrap bg-hx-soft px-3 py-2.5 text-left text-[12px] font-semibold text-hx-ink-soft";
const TD = "whitespace-nowrap border-t border-hx-line p-3 text-[13px] text-hx-coal";

const PILL_TONE = {
  neutral: "bg-hx-soft text-hx-ink-soft",
  success: "bg-hx-success-100 text-hx-success",
  indigo: "bg-hx-indigo-100 text-hx-indigo",
};

function Pill({ label, tone = "neutral" }: { label: string; tone?: keyof typeof PILL_TONE }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[3px] text-[12px] font-semibold ${PILL_TONE[tone]}`}>
      {label}
    </span>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-hx-indigo-100 text-[12px] font-bold text-hx-indigo">
      {initials}
    </span>
  );
}

function CardHeader({ id, icon, title, action }: { id: string; icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className={H2}>
        <span aria-hidden="true" className="inline-flex text-hx-ink-soft">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-hx-indigo no-underline">
      {children}
      <ArrowRightIcon size={14} aria-hidden="true" />
    </Link>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-2 text-[13px] leading-normal text-hx-ink-soft">{children}</p>;
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
      <div className="flex flex-wrap items-center gap-2.5">
        <DashboardSearch jobs={jobs} candidates={recommended} />
        <label className="relative inline-flex items-center">
          <span className="sr-only">Date range</span>
          <CalendarDaysIcon size={15} aria-hidden="true" className="pointer-events-none absolute left-[11px] text-hx-ink-soft" />
          <select
            value={range}
            onChange={(e) => onRangeChange(Number(e.target.value) as DashboardRange)}
            className="h-[38px] cursor-pointer appearance-none rounded-lg border border-hx-line bg-white pl-8 pr-[34px] text-[13px] font-medium text-hx-coal"
          >
            {RANGE_OPTIONS.map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
          </select>
          <ChevronDownIcon size={14} aria-hidden="true" className="pointer-events-none absolute right-[11px] text-hx-ink-soft" />
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
      .filter((c) => c.name.toLowerCase().includes(term) || c.strengths.some((s) => s.toLowerCase().includes(term)))
      .map((c) => ({ id: `c-${c.matchId}`, label: c.name, hint: c.roleTitle, href: `/employer/requirements/${c.requirementId}/candidates/${c.matchId}` }));
    return [...jobHits, ...candidateHits].slice(0, 6);
  }, [term, jobs, candidates]);

  return (
    <div className="relative">
      <label className="flex h-[38px] w-[min(260px,70vw)] items-center gap-2 rounded-lg border border-hx-line bg-white px-3">
        <SearchIcon size={15} aria-hidden="true" className="shrink-0 text-hx-ink-soft" />
        <span className="sr-only">Search jobs, candidates, or skills</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
          placeholder="Search jobs or skills"
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-hx-coal outline-none"
        />
      </label>
      {term && (
        <div role="region" aria-label="Search results" className="absolute inset-x-0 top-11 z-20 min-w-0 rounded-xl border border-hx-line bg-white p-1.5 shadow-[0_8px_24px_oklch(0.148_0.004_228.8/0.08)]">
          {results.length === 0 ? (
            <p className="m-0 px-2.5 py-2 text-[13px] text-hx-ink-soft">No jobs or skills match &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            <ul className={LIST}>
              {results.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="flex justify-between gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-hx-coal no-underline hover:bg-hx-soft">
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

function StatCard({ icon, label, value, trend, trendNoun, range }: { icon: React.ReactNode; label: string; value: number | null; trend: DashboardTrend | null; trendNoun: string; range: DashboardRange }) {
  const delta = trend ? trendDelta(trend) : null;
  return (
    <div className={`${CARD} flex flex-[1_1_220px] items-center gap-3.5`}>
      <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-hx-soft text-hx-indigo">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[28px] font-bold leading-[1.1] text-hx-coal">
          {value === null ? "–" : <AnimatedNumber value={value} />}
        </div>
        <div className="mt-0.5 text-[14px] text-hx-ink-soft">{label}</div>
        {delta && (
          <div className="mt-1.5 text-[12px] text-hx-ink-soft">
            <strong className={`font-bold ${delta.diff > 0 ? "text-hx-success" : "text-hx-ink-soft"}`}>{delta.label}</strong>{" "}
            {trendNoun}, last {range} days
          </div>
        )}
      </div>
      {trend && <Sparkline series={trend.series} />}
    </div>
  );
}

export function DashboardStatCards({ jobs, data, recommendedTotal, range }: { jobs: RequirementSummary[]; data: EmployerDashboardData | null; recommendedTotal: number; range: DashboardRange }) {
  return (
    <section aria-label="Hiring summary" className="flex flex-wrap gap-3.5">
      <StatCard icon={<BriefcaseIcon size={20} />} label="Active Jobs" value={jobs.length} trend={data?.trends.jobs ?? null} trendNoun="new" range={range} />
      <StatCard icon={<UsersIcon size={20} />} label="Recommended Candidates" value={recommendedTotal} trend={data?.trends.recommended ?? null} trendNoun="new" range={range} />
      <StatCard icon={<CalendarDaysIcon size={20} />} label="Interviews Scheduled" value={data ? data.totals.interviewsScheduled : null} trend={data?.trends.interviews ?? null} trendNoun="invited" range={range} />
      <StatCard icon={<CircleCheckIcon size={20} />} label="Hired" value={data ? data.totals.hired : null} trend={data?.trends.hired ?? null} trendNoun="hired" range={range} />
    </section>
  );
}

/* ─── Active jobs table ─── */

function jobMeta(j: RequirementSummary): string {
  const where = j.workMode ? j.workMode[0].toUpperCase() + j.workMode.slice(1) : j.location;
  const type = j.employmentType ? j.employmentType.replace("-", " ").replace(/^./, (c) => c.toUpperCase()) : "";
  return [where, type].filter(Boolean).join(" · ");
}

export function ActiveJobsCard({ jobs, pipeline, canCreate }: { jobs: RequirementSummary[]; pipeline: DashboardJobPipeline[] | null; canCreate: boolean }) {
  const byId = new Map((pipeline ?? []).map((p) => [p.requirementId, p]));
  const shown = jobs.slice(0, 5);
  return (
    <section aria-labelledby="active-jobs-heading" className={CARD}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="active-jobs-heading" className={H2}>
          <BriefcaseIcon size={18} aria-hidden="true" className="text-hx-ink-soft" />
          Active Jobs
        </h2>
        <div className="flex items-center gap-3.5">
          <TextLink href="/employer/jobs">View all jobs</TextLink>
          {canCreate && (
            <Button asChild size="sm" className="h-9 gap-1.5">
              <Link href="/employer/requirements/new"><PlusIcon size={14} aria-hidden="true" />Create Job</Link>
            </Button>
          )}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyLine>No active jobs. Post a requirement and matched candidates will show up here.</EmptyLine>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hx-line">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={TH}>Job Title</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={`${TH} text-center`}>Evaluated</th>
                <th scope="col" className={`${TH} text-center`}>Recommended</th>
                <th scope="col" className={`${TH} text-center`}>Interviewing</th>
                <th scope="col" className={`${TH} text-center`}>Hired</th>
                <th scope="col" className={TH}>Last Updated</th>
                <th scope="col" className={`${TH} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => {
                const p = byId.get(j.id);
                const status = jobStatusLabel(j.status);
                return (
                  <tr key={j.id}>
                    <td className={`${TD} min-w-[190px] !whitespace-normal`}>
                      <Link href={`/employer/requirements/${j.id}`} className="font-semibold text-hx-coal no-underline">{j.title}</Link>
                      <div className="mt-0.5 text-[12px] text-hx-ink-soft">{jobMeta(j)}</div>
                    </td>
                    <td className={TD}><Pill label={status} tone={status === "Active" ? "success" : "neutral"} /></td>
                    <td className={`${TD} text-center`}>{j.aiScreening.evaluated}</td>
                    <td className={`${TD} text-center`}>{j.aiScreening.topMatches}</td>
                    <td className={`${TD} text-center`}>{p ? p.interviewing : "–"}</td>
                    <td className={`${TD} text-center`}>{p ? p.hired : "–"}</td>
                    <td className={`${TD} text-hx-ink-soft`}>{p?.lastUpdatedAt ? hoursOrDaysAgo(p.lastUpdatedAt) : hoursOrDaysAgo(j.createdAt)}</td>
                    <td className={`${TD} text-right`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="size-8" aria-label={`Actions for ${j.title}`}><EllipsisIcon size={16} aria-hidden="true" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/employer/requirements/${j.id}`}>View candidates</Link></DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/employer/requirements/${j.id}/edit`}>Edit job</Link></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ─── Recently recommended candidates ─── */

export function RecommendedCandidatesCard({ cards }: { cards: RecommendedCard[] }) {
  return (
    <section aria-labelledby="recommended-heading" className={CARD}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 id="recommended-heading" className={H2}>
          <UsersIcon size={18} aria-hidden="true" className="text-hx-ink-soft" />
          Recently recommended candidates
        </h2>
        <TextLink href="/employer/jobs">View all</TextLink>
      </div>
      {cards.length === 0 ? (
        <EmptyLine>No recommended candidates yet. Strong matches appear here as soon as a job finishes screening.</EmptyLine>
      ) : (
        <ul className={LIST}>
          {cards.map((c, i) => (
            <li key={c.matchId} className={`flex flex-wrap items-center gap-3.5 py-3 ${i > 0 ? "border-t border-hx-line" : ""}`}>
              <div className="flex min-w-0 flex-[1_1_200px] items-center gap-3">
                <Avatar initials={c.initials} />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{c.name}</div>
                  <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">{c.roleTitle}</div>
                </div>
              </div>
              <Pill label="Recommended" tone="success" />
              <ChipGroup label="Key strengths" items={c.strengths} tone="indigo" />
              <ChipGroup label="Needs validation" items={c.needsValidation} tone="neutral" />
              <span className="min-w-14 text-[12px] text-hx-ink-soft">{c.createdAt ? hoursOrDaysAgo(c.createdAt) : ""}</span>
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href={`/employer/requirements/${c.requirementId}/candidates/${c.matchId}`}>View profile<span className="sr-only">: {c.name}</span></Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChipGroup({ label, items, tone }: { label: string; items: string[]; tone: "indigo" | "neutral" }) {
  return (
    <div className="min-w-0 flex-[1_1_150px]">
      <div className="mb-1 text-[12px] font-semibold text-hx-coal">{label}</div>
      {items.length === 0 ? (
        <span className="text-[12px] text-hx-ink-soft">None flagged</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s) => <Pill key={s} label={s} tone={tone} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Right rail ─── */

export function UpcomingInterviewsCard({ items }: { items: DashboardUpcomingInterview[] }) {
  return (
    <section aria-labelledby="upcoming-heading" className={CARD}>
      <CardHeader id="upcoming-heading" icon={<CalendarDaysIcon size={18} />} title="Upcoming interviews" action={<TextLink href="/employer/jobs">View all</TextLink>} />
      {items.length === 0 ? (
        <EmptyLine>Nothing scheduled. Invite a shortlisted candidate to interview and it will show up here.</EmptyLine>
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
                <Avatar initials={i.initials} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-hx-ink-soft">{slot.time}</div>
                  <div className="text-[13px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{i.candidateName}</div>
                  <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">{i.roleTitle}</div>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href={`/employer/requirements/${i.requirementId}/candidates/${i.matchId}`}>Prepare<span className="sr-only"> for {i.candidateName}</span></Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function KeyInsightsCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section aria-labelledby="insights-heading" className={CARD}>
      <CardHeader id="insights-heading" icon={<LightbulbIcon size={18} />} title="Key insights" />
      {insights.length === 0 ? (
        <EmptyLine>Insights appear once your jobs have screened candidates.</EmptyLine>
      ) : (
        <ul className={`${LIST} flex flex-col gap-3`}>
          {insights.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="block no-underline">
                <div className="text-[13px] font-semibold text-hx-coal">{i.title}</div>
                <div className="mt-0.5 text-[12px] leading-[1.45] text-hx-ink-soft">{i.body}</div>
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
        <EmptyLine>Moves you make on candidates, like inviting or hiring, are logged here.</EmptyLine>
      ) : (
        <ul className={`${LIST} flex flex-col gap-3`}>
          {items.map((a) => (
            <li key={a.id} className="flex justify-between gap-3 text-[13px] leading-[1.45] text-hx-coal">
              {a.href ? <Link href={a.href} className="text-hx-coal no-underline [overflow-wrap:anywhere]">{a.text}</Link> : <span>{a.text}</span>}
              <span className="whitespace-nowrap text-[12px] text-hx-ink-soft">{hoursOrDaysAgo(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
