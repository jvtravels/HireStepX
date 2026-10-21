"use client";

/* Full-page detail view for a single employer match, opened from a row in
   the Jobs table (DashboardJobs.tsx) or the dashboard's Employer Interest
   card. Mirrors the employer console's /employer/requirements/[id] page: one
   divided shell with the role (header, fit, description) in the main column
   and a narrow rail of facts and actions. The breadcrumb (not a back link)
   is the way up. */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useAuth } from "./AuthContext";
import { authHeaders } from "./supabase";
import { useDashboardBreadcrumb } from "./DashboardLayout";
import { JobDetailRouteSkeleton } from "./routeSkeletons";
import type { JobMatch } from "./DashboardJobs";
import EmployerActionsMenu from "./EmployerActionsMenu";
import { normalizeResponse, readStoredResponse, type EmployerResponse } from "./employerActions";
import { useToast } from "./Toast";
import { useFocusRounds } from "./DashboardContext";
import CandidateRequestsCard from "./CandidateRequestsCard";
import { MatchFactorsCard } from "./MatchFactorsCard";
import InterviewInviteCard from "./InterviewInviteCard";
import { focusPracticeHref, invitePracticeHref, isInterviewInvite, stashInviteJd } from "./interviewInvite";
import JobHeader from "./jobDetail/JobHeader";
import JobBody from "./jobDetail/JobBody";
import ResponseActions from "./jobDetail/ResponseActions";
import { ClosedNotice, PrepareForRole, RoleDetails, StrengthenMatch } from "./jobDetail/JobRail";
import { SEC } from "./jobDetail/styles";

const SHELL = "grid overflow-hidden rounded-2xl border border-hx-line bg-white min-[900px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]";
const COL = "min-w-0 divide-y divide-hx-line";

const NARROW = "(max-width: 899px)";
const subscribeNarrow = (cb: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const readNarrow = () => typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches;

function StateScreen({ title, message, children }: { title: string; message: string; children: React.ReactNode }) {
  return (
    <Empty className="mx-auto mt-20 max-w-[560px] flex-none border-0">
      <EmptyHeader>
        <EmptyTitle className="text-[20px] font-semibold leading-7 text-hx-coal">{title}</EmptyTitle>
        <EmptyDescription className="text-[14px] text-hx-ink-soft">{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2.5">{children}</EmptyContent>
    </Empty>
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
      const res = await fetch(`/api/candidate-hiring-activity?full=1&match=${encodeURIComponent(id ?? "")}`, { headers });
      const json = await res.json().catch(() => null);
      if (signal.cancelled) return;
      if (res.ok && json) {
        setMatches((json.recent as JobMatch[]) ?? []);
        // The Jobs list shares this cache and hides closed, locked roles; the one
        // we asked for by id must not leak into it.
        const shared = { ...json, recent: ((json.recent as JobMatch[]) ?? []).filter((m) => m.unlocked || (m.status !== "closed" && m.status !== "failed")) };
        try { localStorage.setItem(cacheKey, JSON.stringify(shared)); } catch { /* expected: localStorage may be unavailable */ }
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch {
      if (!signal.cancelled) setFetchError(true);
    }
    if (!signal.cancelled) setFetched(true);
  }, [cacheKey, id]);

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
  const focusRounds = useFocusRounds();
  // Local answer wins over the list payload so the badge/menu stay truthful
  // between the optimistic update and the next refetch.
  const [localResponse, setLocalResponse] = useState<{ id: string; value: EmployerResponse | null } | null>(null);
  const response: EmployerResponse | null = localResponse && localResponse.id === job?.id
    ? localResponse.value
    : normalizeResponse(job?.candidateResponse) ?? (job ? readStoredResponse(job.id) : null);

  useDashboardBreadcrumb(job ? [{ label: job.roleTitle }] : null);

  const narrow = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
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

  const closed = job.status === "closed" || job.status === "failed";
  const hasFit = !!job.matchFactors && job.matchFactors.factors.length > 0;
  const invited = !closed && isInterviewInvite(job);

  const requests = (
    <CandidateRequestsCard
      matchId={job.id}
      requests={job.requests ?? []}
      unlocked={job.unlocked}
      practice={closed ? undefined : { hrefFor: (label) => focusPracticeHref(job, label), onStart: () => stashInviteJd(job) }}
      className={SEC}
      onResolved={(requestId, resolution) => {
        dropRequest(requestId);
        toast(resolution === "fulfilled" ? "Sent to the employer" : "Request declined", "success");
      }}
      onError={(msg) => toast(msg, "error")}
    />
  );
  const fit = hasFit && (
    <div className={SEC}>
      <MatchFactorsCard data={job.matchFactors!} stacked={!narrow} onAddSkills={job.unlocked && !closed ? () => router.push("/resume") : undefined} />
    </div>
  );
  const pinActions = narrow && job.unlocked && !closed && !invited;
  const actions = (
    <ResponseActions
      fill={pinActions}
      showMessage={job.unlocked && !closed && !invited}
      onMessage={() => router.push(`/messages?matchId=${job.id}`)}
      menu={
        <EmployerActionsMenu
          bare
          triggerClassName="size-9"
          matchId={job.id}
          employerLabel={job.companyName}
          response={response}
          onResponseChange={(value) => setLocalResponse({ id: job.id, value })}
          onRemoved={backToJobs}
          onToast={(msg, kind) => toast(msg, kind)}
        />
      }
    />
  );

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto text-hx-coal">
      <div className="mb-16">
        <div className={SHELL}>
          <div className={COL}>
            {invited && <InterviewInviteCard job={job} className={SEC} />}
            <JobHeader job={job} closed={closed} actions={pinActions ? null : actions} />
            {narrow && requests}
            {hasFit && narrow && fit}
            <JobBody job={job} showSkills={!hasFit} />
          </div>

          <div className={`${COL} border-t border-hx-line min-[900px]:border-l min-[900px]:border-t-0`}>
            {!narrow && requests}
            {hasFit && !narrow && fit}
            <RoleDetails job={job} />
            {closed ? (
              <ClosedNotice onBack={backToJobs} />
            ) : (
              <>
                {!invited && (
                  <PrepareForRole job={job} rounds={focusRounds} onPractise={() => { stashInviteJd(job); router.push(invitePracticeHref(job, focusRounds)); }} />
                )}
                {!job.unlocked && <StrengthenMatch onResume={() => router.push("/resume")} />}
              </>
            )}
          </div>
        </div>
        {pinActions && (
          <div className="sticky bottom-2 z-10 mt-3 rounded-2xl border border-hx-line bg-white p-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
