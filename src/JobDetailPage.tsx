"use client";

/* Full-page detail view for a single employer match, opened from a row in
   the Jobs table (DashboardJobs.tsx) or the dashboard's Employer Interest
   card. Mirrors the employer console's /employer/requirements/[id] page:
   title with a status pill and an icon meta line, the description beside
   the skills, and a narrow rail of key/value facts. The breadcrumb (not a
   back link) is the way up. */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ClockIcon, GlobeIcon, IndianRupeeIcon, LockIcon, MapPinIcon, SendIcon, TrendingUpIcon } from "lucide-react";
import { KeyValueList, KeyValueRow, MetaLine, Panel, PanelButton, SkillChip, type MetaPart } from "@/employer/_panelParts";
import { useAuth } from "./AuthContext";
import { authHeaders } from "./supabase";
import { useDashboardBreadcrumb } from "./DashboardLayout";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import { JobDetailRouteSkeleton } from "./routeSkeletons";
import { CompanyAvatar } from "./CompanyAvatar";
import type { JobMatch } from "./DashboardJobs";
import EmployerActionsMenu, { EmployerResponseBadge } from "./EmployerActionsMenu";
import { normalizeResponse, readStoredResponse, type EmployerResponse } from "./employerActions";
import { useToast } from "./Toast";
import CandidateRequestsCard from "./CandidateRequestsCard";
import { MatchFactorsCard, EmployerVisibilityCard } from "./MatchFactorsCard";
import InterviewInviteCard from "./InterviewInviteCard";
import { isInterviewInvite } from "./interviewInvite";

/* One flat divided shell (same as the dashboard and employer screens): the
   role on the left, the company and actions in a divided right rail. */
const SHELL = "grid overflow-hidden rounded-2xl border border-hx-line bg-white min-[900px]:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]";
const COL = "min-w-0 divide-y divide-hx-line";
const SEC = "min-w-0 px-5 py-5 min-[640px]:px-7 min-[640px]:py-6";
const H2 = "m-0 mb-1.5 text-[13px] font-semibold text-hx-coal";
const H2_FLUSH = "m-0 text-[15px] font-semibold text-hx-coal";
const BODY = "m-0 max-w-[75ch] whitespace-pre-line text-[13.5px] leading-relaxed [overflow-wrap:anywhere]";
const BODY_TIGHT = "m-0 mt-2.5 text-[14px] leading-[22px] text-hx-coal";
const EMPTY = "m-0 text-[13px] italic text-hx-ink-soft";
/* ~8 lines at 14px / 22px; the mask fades the cut so it reads as "more below". */
const CLAMP = "max-h-[150px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]";
const ACTION_STACK = "mt-3 flex flex-col gap-2";

const COLLAPSE_THRESHOLD = 600;

function CollapsibleText({ text, soft }: { text: string; soft?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > COLLAPSE_THRESHOLD;
  const collapsed = long && !expanded;
  return (
    <>
      <p id={id} className={`${BODY} ${soft ? "text-hx-ink-soft" : "text-hx-coal"} ${collapsed ? CLAMP : ""}`}>{text}</p>
      {long && (
        <div className="mt-1.5">
          <PanelButton expanded={expanded} controls={id} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "View less" : "View more"}
          </PanelButton>
        </div>
      )}
    </>
  );
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${className}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* Who the employer is stays hidden until they've contacted the candidate
   (unlocked) — otherwise candidates could go around the platform. The server
   already redacts these fields for matched-only rows; the locked branch just
   explains why. */
function CompanyCard({ job, onMessage, actions, response }: {
  job: JobMatch;
  onMessage: () => void;
  actions: React.ReactNode;
  response: EmployerResponse | null;
}) {
  const websiteHost = job.companyWebsite ? job.companyWebsite.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null;
  const websiteHref = job.companyWebsite && /^https?:\/\//i.test(job.companyWebsite) ? job.companyWebsite : job.companyWebsite ? `https://${job.companyWebsite}` : null;
  return (
    <aside aria-label="Company profile" className={`${SEC} flex flex-col gap-3.5`}>
      <div className="flex min-w-0 items-center gap-3">
        <CompanyAvatar job={job} size={44} />
        <div className="min-w-0">
          <div className="break-words text-[15px] font-semibold text-hx-coal">{job.companyName}</div>
          {job.preferredIndustry && <div className="mt-0.5 text-[12px] text-hx-ink-soft">{job.preferredIndustry}</div>}
        </div>
        <div className="ml-auto shrink-0">{actions}</div>
      </div>
      {response && <div><EmployerResponseBadge response={response} /></div>}
      {job.unlocked ? (
        <>
          {websiteHref && websiteHost && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1.5 break-all text-[13px] text-hx-indigo underline-offset-4 hover:underline"
            >
              <GlobeIcon size={14} aria-hidden="true" className="shrink-0" />
              {websiteHost}
            </a>
          )}
          <p className="m-0 text-[12px] leading-[18px] text-hx-ink-soft">
            This employer has viewed your profile and can reach you directly.
          </p>
          <Button variant="outline" size="sm" onClick={onMessage} className="flex items-center gap-1.5">
            <SendIcon size={13} aria-hidden="true" /> Message employer
          </Button>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <LockIcon size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-hx-ink-soft" />
          <p className="m-0 text-[12px] leading-[18px] text-hx-ink-soft">
            Company details are shared once this employer shows interest. You can't apply to this role; they'll reach out if you're a fit.
          </p>
        </div>
      )}
    </aside>
  );
}

function StateScreen({ title, message, children }: { title: string; message: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto 0", textAlign: "center", padding: "0 16px", fontFamily: f.sans }}>
      <h1 style={{ fontSize: 20, lineHeight: "28px", color: t.coal, margin: "0 0 12px", fontWeight: 600 }}>{title}</h1>
      <p style={{ fontSize: 14, color: t.inkSoft, margin: "0 0 24px", lineHeight: 1.55 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export default function JobDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id?: string };
  const { user: authUser } = useAuth();
  const cacheKey = authUser?.id ? `hirestepx_cache_hiring_activity_full_${authUser.id}` : null;
  const [matches, setMatches] = useState<JobMatch[] | null>(() => {
    if (!cacheKey) return null;
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? (JSON.parse(cached).recent ?? null) : null;
    } catch { return null; }
  });
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    if (!cacheKey) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/candidate-hiring-activity?full=1", { headers });
      const json = await res.json().catch(() => null);
      if (signal.cancelled) return;
      if (res.ok && json) {
        setMatches((json.recent as JobMatch[]) ?? []);
        try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* expected: localStorage may be unavailable */ }
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch {
      if (!signal.cancelled) setFetchError(true);
    }
    if (!signal.cancelled) setFetched(true);
  }, [cacheKey]);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  const job = useMemo(() => matches?.find((m) => m.id === id) ?? null, [matches, id]);
  const dropRequest = useCallback((requestId: string) => {
    setMatches((prev) => prev && prev.map((m) => (m.id === id ? { ...m, requests: (m.requests ?? []).filter((r) => r.id !== requestId) } : m)));
  }, [id]);
  const { toast } = useToast();
  // Local answer wins over the list payload so the badge/menu stay truthful
  // between the optimistic update and the next refetch.
  const [localResponse, setLocalResponse] = useState<{ id: string; value: EmployerResponse | null } | null>(null);
  const response: EmployerResponse | null = localResponse && localResponse.id === job?.id
    ? localResponse.value
    : normalizeResponse(job?.candidateResponse) ?? (job ? readStoredResponse(job.id) : null);

  useDashboardBreadcrumb(job ? [{ label: job.roleTitle }] : null);

  const backToJobs = () => router.push("/jobs");

  if (!job) {
    if (!fetched) return <JobDetailRouteSkeleton />;
    if (fetchError && !matches) {
      return (
        <StateScreen title="Couldn't load this job" message="Something went wrong fetching the details. This is usually temporary.">
          <Button type="button" size="lg" onClick={() => { setFetched(false); setFetchError(false); load({ cancelled: false }); }}>Try again</Button>
          <Button type="button" variant="outline" onClick={backToJobs}>Back to Jobs</Button>
        </StateScreen>
      );
    }
    return (
      <StateScreen title="Job not found" message="This opportunity may have been removed or is no longer available to you.">
        <Button type="button" size="lg" onClick={backToJobs}>Back to Jobs</Button>
      </StateScreen>
    );
  }

  const comp = formatComp(job.budgetMin, job.budgetMax, job.salaryType);
  const exp = formatExperience(job.experienceMin, job.experienceMax);
  const mode = job.workMode ? WORK_MODE_LABEL[job.workMode] || job.workMode : null;
  const jobType = job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType : null;
  const closed = job.status === "closed" || job.status === "failed";
  const hasBody = !!(job.description || job.responsibilities || job.niceToHave);
  const meta: MetaPart[] = [
    { icon: MapPinIcon, text: `${job.location || "Location not specified"}${mode ? ` · ${mode}` : ""}` },
    ...(jobType ? [{ icon: ClockIcon, text: jobType }] : []),
    ...(exp ? [{ icon: TrendingUpIcon, text: `${exp} exp` }] : []),
    { icon: IndianRupeeIcon, text: comp || <span className="text-hx-ink-soft">Compensation not disclosed</span> },
  ];

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto text-hx-coal">
      <div className="mb-16">
        <div className={SHELL}>
          <div className={COL}>
            <section aria-labelledby="job-title" className={SEC}>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h1 id="job-title" className="m-0 text-[20px] font-semibold leading-tight text-hx-coal [overflow-wrap:anywhere]">
                  {job.roleTitle}
                </h1>
                {closed
                  ? <StatusChip label="Role closed" className="bg-hx-soft text-hx-neutral-ink" />
                  : job.unlocked
                    ? <StatusChip label="Employer interested" className="bg-hx-indigo-100 text-hx-indigo" />
                    : <StatusChip label="Matched" className="bg-hx-success-100 text-hx-success-ink" />}
              </div>
              <MetaLine parts={meta} className="mt-3" />
              {!job.unlocked && job.matchReason && (
                <p className="m-0 mt-3 max-w-[75ch] text-[13.5px] leading-relaxed text-hx-ink-soft">{job.matchReason}</p>
              )}

              <div className="mt-5 grid min-w-0 content-start gap-x-8 gap-y-5 border-t border-hx-line pt-5 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                  {job.description && (
                    <section aria-label="About the role">
                      <CollapsibleText text={job.description} soft />
                    </section>
                  )}
                  {job.responsibilities && (
                    <section aria-label="Responsibilities">
                      <h2 className={H2}>Responsibilities</h2>
                      <CollapsibleText text={job.responsibilities} soft />
                    </section>
                  )}
                  {job.niceToHave && (
                    <section aria-label="Nice to have">
                      <h2 className={H2}>Nice to have</h2>
                      <CollapsibleText text={job.niceToHave} soft />
                    </section>
                  )}
                  {!hasBody && <p className={EMPTY}>This employer hasn't added a role description yet.</p>}
                </div>

                <div className="flex min-w-0 flex-col gap-5 min-[1200px]:border-l min-[1200px]:border-hx-line min-[1200px]:pl-8">
                  <section aria-label="Skills">
                    <h2 className="m-0 mb-2.5 text-[13px] font-semibold text-hx-ink-soft">Skills</h2>
                    {job.skills.length > 0 ? (
                      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {job.skills.map((s, i) => <li key={i}><SkillChip tone="primary">{s}</SkillChip></li>)}
                      </ul>
                    ) : (
                      <p className={EMPTY}>No specific skills listed for this role.</p>
                    )}
                  </section>
                  <section aria-label="Perks and benefits">
                    <h2 className="m-0 mb-2.5 text-[13px] font-semibold text-hx-ink-soft">Perks &amp; benefits</h2>
                    {job.perksAndBenefits.length > 0 ? (
                      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {job.perksAndBenefits.map((p, i) => <li key={i}><SkillChip tone="neutral">{p}</SkillChip></li>)}
                      </ul>
                    ) : (
                      <p className={EMPTY}>No perks or benefits listed.</p>
                    )}
                  </section>
                </div>
              </div>
            </section>

            <div className={`${SEC} flex flex-col gap-6`}>
              {job.matchFactors && job.matchFactors.factors.length > 0 && <MatchFactorsCard data={job.matchFactors} />}
              <EmployerVisibilityCard unlocked={job.unlocked} />
            </div>
          </div>

          <div className={`${COL} border-t border-hx-line min-[900px]:border-l min-[900px]:border-t-0`}>
            <CompanyCard
              job={job}
              onMessage={() => router.push(`/messages?matchId=${job.id}`)}
              response={response}
              actions={
                <EmployerActionsMenu
                  matchId={job.id}
                  employerLabel={job.companyName}
                  response={response}
                  onResponseChange={(value) => setLocalResponse({ id: job.id, value })}
                  onRemoved={backToJobs}
                  onToast={(msg, kind) => toast(msg, kind)}
                />
              }
            />
            <CandidateRequestsCard
              matchId={job.id}
              requests={job.requests ?? []}
              unlocked={job.unlocked}
              className={SEC}
              onResolved={(requestId, resolution) => {
                dropRequest(requestId);
                toast(resolution === "fulfilled" ? "Sent to the employer" : "Request declined", "success");
              }}
              onError={(msg) => toast(msg, "error")}
            />
            <Panel id="job-details-heading" title="Role details">
              <KeyValueList>
                <KeyValueRow label="Matched">{daysAgo(job.matchedAt)}</KeyValueRow>
                {job.unlocked && job.unlockedAt && <KeyValueRow label="Employer interest">{daysAgo(job.unlockedAt)}</KeyValueRow>}
                {job.openPositions != null && <KeyValueRow label="Openings">{`${job.openPositions} opening${job.openPositions === 1 ? "" : "s"}`}</KeyValueRow>}
                {job.noticePeriodPref && <KeyValueRow label="Notice period">{job.noticePeriodPref}</KeyValueRow>}
                {job.preferredIndustry && <KeyValueRow label="Industry">{job.preferredIndustry}</KeyValueRow>}
                {job.dueDate && <KeyValueRow label="Timeline">{`Hiring by ${job.dueDate}`}</KeyValueRow>}
              </KeyValueList>
            </Panel>
            {!closed && isInterviewInvite(job) && <InterviewInviteCard job={job} className={SEC} />}
            {closed ? (
              <section aria-labelledby="job-closed-heading" className={SEC}>
                <h2 id="job-closed-heading" className={H2_FLUSH}>This role is closed</h2>
                <p className={BODY_TIGHT}>
                  The employer is no longer hiring for this role. Your profile stays visible to other employers.
                </p>
                <Button type="button" variant="outline" className="mt-3" onClick={backToJobs}>See other matches</Button>
              </section>
            ) : !job.unlocked && (
              <section aria-labelledby="job-strengthen-heading" className={SEC}>
                <h2 id="job-strengthen-heading" className={H2_FLUSH}>Strengthen your match</h2>
                <p className={BODY_TIGHT}>
                  You can't apply to this role. Employers reach out when a profile stands out, so a stronger profile helps.
                </p>
                <div className={ACTION_STACK}>
                  <Button type="button" onClick={() => router.push(`/session/new?role=${encodeURIComponent(job.roleTitle)}`)}>
                    Practise for {job.roleTitle}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/resume")}>Update your resume</Button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
