"use client";

/* Full-page detail view for a single employer match, opened from a row in
   the Jobs table (DashboardJobs.tsx) or the dashboard's Employer Interest
   card. Mirrors the employer console's /employer/requirements/[id] page:
   a header card (icon tile, title, icon meta row) beside a details card,
   with the breadcrumb (not a back link) as the way up. */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BriefcaseIcon, Building2Icon, CalendarIcon, ClockIcon, GlobeIcon, GraduationCapIcon,
  HourglassIcon, IndianRupeeIcon, LockIcon, MapPinIcon, SendIcon, UsersIcon,
} from "lucide-react";
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
const H2 = "m-0 mb-2 text-[15px] font-semibold text-hx-coal";
const H2_FLUSH = "m-0 text-[15px] font-semibold text-hx-coal";
const BODY = "m-0 whitespace-pre-line text-[14px] leading-[22px] [overflow-wrap:anywhere]";
const BODY_TIGHT = "m-0 mt-2.5 text-[14px] leading-[22px] text-hx-coal";
const EMPTY = "m-0 text-[13px] italic text-hx-ink-soft";
/* ~8 lines at 14px / 22px; the mask fades the cut so it reads as "more below". */
const CLAMP = "max-h-[180px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]";
const TOGGLE_BUTTON_STYLE = { marginTop: 4, paddingInline: 0 } as const;
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
        <Button type="button" variant="link" size="sm" style={TOGGLE_BUTTON_STYLE} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </>
  );
}

function Detail({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-hx-ink-soft">{icon}</span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[12px] text-hx-ink-soft">{label}</span>
        <span className={`text-[14px] font-medium [overflow-wrap:anywhere] ${muted ? "italic text-hx-ink-soft" : "text-hx-coal"}`}>{value}</span>
      </div>
    </div>
  );
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${className}`}>{label}</span>;
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
  const metaItem = "inline-flex items-center gap-1.5";
  const metaIcon = "text-hx-ink-soft";

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto text-hx-coal">
      <div className="mb-16">
        <div className={SHELL}>
          <div className={COL}>
            <section aria-labelledby="job-title" className={SEC}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-[1_1_280px] items-center gap-3.5">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-hx-indigo-100 text-hx-indigo">
                    <BriefcaseIcon size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h1 id="job-title" className="m-0 text-[20px] font-semibold leading-7 text-hx-coal [overflow-wrap:anywhere]">
                      {job.roleTitle}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-medium text-hx-coal">
                      <span className={metaItem}>
                        <IndianRupeeIcon size={14} className={metaIcon} aria-hidden="true" />
                        {comp ? comp : <span className="font-normal italic text-hx-ink-soft">Compensation not disclosed</span>}
                      </span>
                      <span className={metaItem}>
                        <MapPinIcon size={14} className={metaIcon} aria-hidden="true" />
                        {job.location || "Location not specified"}{mode ? ` · ${mode}` : ""}
                      </span>
                      {exp && (
                        <span className={metaItem}>
                          <GraduationCapIcon size={14} className={metaIcon} aria-hidden="true" /> {exp} exp
                        </span>
                      )}
                      {jobType && (
                        <span className={metaItem}>
                          <ClockIcon size={14} className={metaIcon} aria-hidden="true" /> {jobType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {closed
                    ? <StatusChip label="Role closed" className="bg-hx-soft text-hx-ink-soft" />
                    : job.unlocked
                      ? <StatusChip label="Employer interested" className="bg-hx-indigo-100 text-hx-indigo-deep" />
                      : <StatusChip label="Matched" className="bg-hx-success-100 text-hx-success-ink" />}
                </div>
              </div>
              {!job.unlocked && job.matchReason && (
                <p className="m-0 mt-4 text-[14px] leading-[21px] text-hx-ink-soft">{job.matchReason}</p>
              )}
            </section>

            <div className={`${SEC} flex flex-col gap-6`}>
              {job.matchFactors && job.matchFactors.factors.length > 0 && <MatchFactorsCard data={job.matchFactors} />}
              <EmployerVisibilityCard unlocked={job.unlocked} />
            </div>

            <div className={`${SEC} flex flex-col gap-6`}>
              <section aria-label="Skills">
                <h2 className={H2}>Skills</h2>
                {job.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((s, i) => (
                      <span key={i} className="rounded-full border border-hx-line bg-white px-2.5 py-1 text-[12px] text-hx-coal">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className={EMPTY}>No specific skills listed for this role.</p>
                )}
              </section>

              {job.description && (
                <section aria-label="About the role">
                  <h2 className={H2}>About the role</h2>
                  <CollapsibleText text={job.description} />
                </section>
              )}
              {job.responsibilities && (
                <section aria-label="Responsibilities">
                  <h2 className={H2}>Responsibilities</h2>
                  <CollapsibleText text={job.responsibilities} />
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

            <section aria-label="Perks and benefits" className={SEC}>
              <h2 className={H2}>Perks &amp; benefits</h2>
              {job.perksAndBenefits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {job.perksAndBenefits.map((p, i) => (
                    <span key={i} className="rounded-full border border-hx-line px-2.5 py-1 text-[12px] text-hx-ink-soft">{p}</span>
                  ))}
                </div>
              ) : (
                <p className={EMPTY}>No perks or benefits listed.</p>
              )}
            </section>

            <div className="px-5 py-3 text-[12px] text-hx-ink-soft min-[640px]:px-7">
              {job.unlocked && job.unlockedAt
                ? `Employer showed interest ${daysAgo(job.unlockedAt)} · matched ${daysAgo(job.matchedAt)}`
                : `Matched ${daysAgo(job.matchedAt)}`}
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
            <section aria-labelledby="job-details-heading" className={SEC}>
              <h2 id="job-details-heading" className={H2_FLUSH}>Role details</h2>
              <div className="mt-4 grid grid-cols-2 gap-3.5">
                <Detail
                  icon={<UsersIcon size={14} aria-hidden="true" />}
                  label="Openings"
                  value={job.openPositions != null ? `${job.openPositions} opening${job.openPositions === 1 ? "" : "s"}` : "Not specified"}
                  muted={job.openPositions == null}
                />
                <Detail
                  icon={<HourglassIcon size={14} aria-hidden="true" />}
                  label="Notice period"
                  value={job.noticePeriodPref || "Not specified"}
                  muted={!job.noticePeriodPref}
                />
                <Detail
                  icon={<Building2Icon size={14} aria-hidden="true" />}
                  label="Industry"
                  value={job.preferredIndustry || "Any industry"}
                  muted={!job.preferredIndustry}
                />
                <Detail
                  icon={<CalendarIcon size={14} aria-hidden="true" />}
                  label="Timeline"
                  value={job.dueDate ? `Hiring by ${job.dueDate}` : "Open-ended timeline"}
                  muted={!job.dueDate}
                />
              </div>
            </section>
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
