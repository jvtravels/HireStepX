"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LockIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { PrimaryCta } from "@/employer/_atoms";
import { TAB_LABEL, jobInsights, tabCounts, visibleTabs, type CandidateTab } from "@/employer/_jobDetailHelpers";
import StatusTabs from "@/components/StatusTabs";
import InterviewInviteDialog, { statusErrorCopy, type InviteResult, type InviteValues } from "@/employer/InterviewInviteDialog";
import { useToast } from "@/Toast";
import { EmptyNote, ErrorRetry, InlineNotice, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import type { UnlockedCandidate } from "@/employer/_requirementCalls";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { type Sort } from "@/components/SortableHead";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPaise } from "../../../../../server-handlers/_unlock-pricing";
import CandidatesFilters from "./_components/CandidatesFilters";
import CandidatesTable from "./_components/CandidatesTable";
import EvidenceDialog from "./_components/EvidenceDialog";
import MessagesDialog from "./_components/MessagesDialog";
import JobOverview, { hasRoleDetails } from "./_components/JobOverview";
import JobHeader from "./_components/JobHeader";
import JobSideRail from "./_components/JobSideRail";
import KeyRequirements, { hasKeyRequirements } from "./_components/KeyRequirements";
import { useJobActions } from "./_components/useJobActions";
import { FailedState, GeneratingState, ZeroMatchState } from "./_components/StatusStates";
import UnlockDialog from "./_components/UnlockDialog";
import {
  CONTACT_FILTER_OPTIONS,
  DEFAULT_SORT,
  compareCandidates,
  filterCandidates,
  type ContactFilter,
  type SortColumn,
} from "./_components/candidateTableModel";
import { candidateDisplayName, closedSummary } from "./_components/requirementFormat";
import type { UnlockTarget } from "./_components/useUnlockCheckout";

const CANDIDATES_RECENT_SEARCHES_KEY = "hirestepx-employer-candidates-recent-searches";
const MAX_MATCH_POLLS = 20;

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { fetchRequirementDetail, updateCandidateStatusResult } = useEmployerData();
  const access = useEmployerAccess();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pollStalled, setPollStalled] = useState(false);
  const [pollRun, setPollRun] = useState(0);
  const latestRefresh = useRef(0);
  const localChanges = useRef(0);

  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [tabChoice, setTabChoice] = useState<CandidateTab | null>(null);
  const [insightId, setInsightId] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [unlockTarget, setUnlockTarget] = useState<UnlockTarget | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [messagesId, setMessagesId] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const r = await fetchRequirementDetail(params.id);
    setRequirement(r);
    setLoadFailed(r == null);
    setLoading(false);
  }, [fetchRequirementDetail, params.id]);

  // Background revalidation keeps the rendered list when a refetch fails, so a
  // flaky connection never replaces good data with an error screen. A response
  // is dropped when a newer refresh started, and refetched once when an unlock,
  // reject or stage change landed while it was in flight, so a slow response
  // can never put a just-paid candidate back behind the lock.
  const refreshSilently = useCallback(async (): Promise<boolean> => {
    const id = ++latestRefresh.current;
    for (let attempt = 0; attempt < 2; attempt++) {
      const changesAtStart = localChanges.current;
      const r = await fetchRequirementDetail(params.id);
      if (id !== latestRefresh.current) return r != null;
      if (!r) return false;
      if (localChanges.current !== changesAtStart) continue;
      setRequirement(r);
      return true;
    }
    return true;
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEmployerBreadcrumb(requirement ? [{ label: requirement.title, path: `/employer/requirements/${params.id}` }] : null);

  // A freshly created requirement usually matches synchronously, so this poll
  // only covers the rare stale fetch. It keeps trying through failed requests
  // and gives up after about two minutes with a visible "taking longer" state.
  const generating = requirement?.status === "generating";
  useEffect(() => {
    if (!generating) return;
    setPollStalled(false);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    const tick = async () => {
      polls += 1;
      await refreshSilently();
      if (cancelled) return;
      if (polls >= MAX_MATCH_POLLS) {
        setPollStalled(true);
        return;
      }
      timer = setTimeout(tick, Math.min(2500 * 1.25 ** polls, 10_000));
    };
    timer = setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [generating, refreshSilently, pollRun]);

  // Background jobs (new signups, nightly rematch) add candidates with no push
  // to this tab, so pick up fresh matches whenever the employer comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSilently();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshSilently]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshNote(null);
    const ok = await refreshSilently();
    setRefreshing(false);
    setRefreshNote(ok ? { tone: "success", text: "Candidates refreshed." } : { tone: "error", text: "Couldn't refresh candidates. Showing the last list we loaded." });
  };

  // A success note confirms an action; it fades instead of sticking around.
  useEffect(() => {
    if (refreshNote?.tone !== "success") return;
    const timer = setTimeout(() => setRefreshNote(null), 4000);
    return () => clearTimeout(timer);
  }, [refreshNote]);

  const candidates = useMemo(() => requirement?.candidates ?? [], [requirement]);

  const locationOptions = useMemo(() => {
    const cities = new Set(candidates.map((c) => c.city).filter((c) => c && c !== "Not specified"));
    return Array.from(cities).sort();
  }, [candidates]);

  const patchRequirement = useCallback((patch: Partial<Requirement>) => {
    localChanges.current += 1;
    setRequirement((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const counts = useMemo(() => tabCounts(candidates), [candidates]);
  const tab: CandidateTab = tabChoice ?? "all";
  const { message, reopenSaving, changeStage, reopen } = useJobActions(requirement, patchRequirement, load);

  const insights = useMemo(() => (requirement ? jobInsights(requirement) : []), [requirement]);
  const activeInsight = insights.find((i) => i.id === insightId) ?? null;

  const activeFilterCount = (contactFilter !== "all" ? 1 : 0) + (locationFilter !== "all" ? 1 : 0);
  const hasActiveFilters = search.trim() !== "" || contactFilter !== "all" || locationFilter !== "all" || activeInsight != null;

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    const firstContact = CONTACT_FILTER_OPTIONS.find((o) => o.value !== "all" && o.value !== contactFilter);
    if (firstContact) suggestions.push({ label: `Contact: ${firstContact.label}`, apply: () => setContactFilter(firstContact.value) });
    const firstLocation = locationOptions.find((loc) => loc !== locationFilter);
    if (firstLocation) suggestions.push({ label: `Location: ${firstLocation}`, apply: () => setLocationFilter(firstLocation) });
    return suggestions.slice(0, 4);
  }, [contactFilter, locationOptions, locationFilter]);

  const appliedChips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (contactFilter !== "all") appliedChips.push({ key: "contact", label: CONTACT_FILTER_OPTIONS.find((o) => o.value === contactFilter)?.label ?? contactFilter, remove: () => setContactFilter("all") });
  if (locationFilter !== "all") appliedChips.push({ key: "location", label: locationFilter, remove: () => setLocationFilter("all") });
  if (activeInsight) appliedChips.push({ key: "insight", label: activeInsight.label, remove: () => setInsightId(null) });

  const filteredSorted = useMemo(
    () => filterCandidates(candidates, { search, contact: contactFilter, location: locationFilter, tab, insight: activeInsight?.filter ?? null }).sort((a, b) => compareCandidates(a, b, sort)),
    [candidates, search, contactFilter, locationFilter, tab, sort, activeInsight],
  );

  useEffect(() => {
    setPage(1);
  }, [search, contactFilter, locationFilter, tab, sort, rowsPerPage, insightId]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filteredSorted.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const patchCandidates = useCallback((apply: (c: Candidate) => Candidate) => {
    localChanges.current += 1;
    setRequirement((prev) => (prev ? { ...prev, candidates: prev.candidates.map(apply) } : prev));
  }, []);

  const handleUnlocked = (unlocked: UnlockedCandidate[]) => {
    const byId = new Map(unlocked.map((u) => [u.matchId, u]));
    patchCandidates((c) => {
      const u = byId.get(c.id);
      return u ? { ...c, unlocked: true, name: u.name, contact: { email: u.contact.email } } : c;
    });
  };

  const inviteCandidate = candidates.find((c) => c.id === inviteId) ?? null;

  // Locked candidates can't be contacted, so the menu entry routes to unlock
  // first instead of dead-ending in a 402.
  const needsUnlockFor = (status: CandidateStatus) => status === "interview_invited" || status === "interviewing" || status === "hired";

  const [pendingStage, setPendingStage] = useState<{ id: string; status: CandidateStatus } | null>(null);
  const [stageBusy, setStageBusy] = useState(false);

  const applyStage = async (c: Candidate, status: CandidateStatus) => {
    const res = await updateCandidateStatusResult(c.id, { candidateStatus: status });
    if (!res.ok) {
      toast(statusErrorCopy(res.error), "error");
      return false;
    }
    patchCandidates((x) => (x.id === c.id ? { ...x, candidateStatus: status } : x));
    toast(`${candidateDisplayName(c)} moved to ${CANDIDATE_STATUS_LABEL[status]}`, "success");
    return true;
  };

  const handleStageChange = (c: Candidate, status: CandidateStatus) => {
    if (!c.unlocked && needsUnlockFor(status)) setUnlockTarget({ mode: "single", matchId: c.id });
    else if (status === "interview_invited") setInviteId(c.id);
    else if (status === "interviewing") void applyStage(c, status);
    else setPendingStage({ id: c.id, status });
  };

  const pendingCandidate = candidates.find((c) => c.id === pendingStage?.id) ?? null;

  const confirmStage = async () => {
    if (!pendingStage || !pendingCandidate) return;
    setStageBusy(true);
    await applyStage(pendingCandidate, pendingStage.status);
    setStageBusy(false);
    setPendingStage(null);
  };

  const submitInvite = async ({ note, scheduledAt }: InviteValues): Promise<InviteResult> => {
    if (!inviteCandidate) return { ok: false };
    const res = await updateCandidateStatusResult(inviteCandidate.id, { candidateStatus: "interview_invited", note, interviewScheduledAt: scheduledAt });
    if (!res.ok) return { ok: false, message: statusErrorCopy(res.error) };
    patchCandidates((c) => (c.id === inviteCandidate.id ? { ...c, candidateStatus: "interview_invited", interviewScheduledAt: scheduledAt ?? c.interviewScheduledAt } : c));
    toast("Interview invite sent", "success");
    return { ok: true };
  };

  const clearFilters = () => {
    setSearch("");
    setContactFilter("all");
    setLocationFilter("all");
    setInsightId(null);
  };

  if (loading && !requirement) return <PageSkeleton label="Loading requirement" />;

  if (!requirement) {
    return (
      <ErrorRetry
        title="Couldn't open this requirement"
        message={
          loadFailed
            ? "It may have been deleted, or we couldn't reach HireStepX. Try again, or go back to your requirements."
            : "Something went wrong loading this page."
        }
        onRetry={load}
        retrying={loading}
      >
        <Link
          href="/employer/requirements"
          className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
          style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.indigo, outlineColor: t.indigo }}
        >
          Back to requirements
        </Link>
      </ErrorRetry>
    );
  }

  const suspended = access.suspended;
  const readOnly = requirement.status === "closed";
  const hasList = requirement.status === "ready" || requirement.status === "partial" || requirement.status === "closed";
  const evidenceCandidate = candidates.find((c) => c.id === evidenceId) ?? null;
  const messagesCandidate = candidates.find((c) => c.id === messagesId) ?? null;

  // The server ranks the full visible shortlist and prices the next batch
  // itself (employer-requirement-detail.ts); the page only displays that quote,
  // so the button can never disagree with what the order charges.
  const nextLockedBatch = requirement.nextUnlockBatch ?? null;

  const requiredSkills = Array.from(new Set([...requirement.skills, ...requirement.customSkillSets]));
  const tabs = visibleTabs(counts, tab).map((key) => ({ key, label: TAB_LABEL[key], count: counts[key] }));

  return (
    <div className="flex min-w-0 flex-[1_0_auto] flex-col pb-6">
      {suspended && (
        <div className="mb-4">
          <SuspendedBanner />
        </div>
      )}

      <div className="grid min-w-0 gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_300px] min-[1440px]:items-start">
        <div className="flex min-w-0 flex-col">
          <JobHeader
            requirement={requirement}
            suspended={suspended}
            message={message}
            reopening={reopenSaving}
            onReopen={reopen}
            onReload={load}
            expandedContent={hasRoleDetails(requirement) ? <JobOverview requirement={requirement} /> : null}
            requirementsSlot={hasKeyRequirements(requirement) ? <KeyRequirements requirement={requirement} /> : null}
          />

          <section aria-labelledby="candidates-heading" className="mt-5 flex min-w-0 flex-col">
            <h2 id="candidates-heading" className="sr-only">
              Candidates
            </h2>
            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            {hasList && (
              <StatusTabs
                tabs={tabs}
                value={tab}
                onChange={setTabChoice}
                label="Candidate groups"
                idPrefix="cand"
                panelId="cand-panel"
                className="shrink-0"
              />
            )}
            <div className="flex min-w-0 flex-[1_1_auto] flex-wrap items-center gap-2.5 min-[1100px]:flex-nowrap">
              {hasList && (
                <>
                  <div className="min-w-36 max-w-80 flex-[1_1_220px]">
                    <SearchWithSuggestions
                      id="candidates-search"
                      label="Search candidates"
                      value={search}
                      onChange={setSearch}
                      placeholder="Search candidates..."
                      storageKey={CANDIDATES_RECENT_SEARCHES_KEY}
                      suggestedFilters={suggestedFilters}
                      inputClassName="bg-white"
                    />
                  </div>
                  <CandidatesFilters
                    contactFilter={contactFilter}
                    onContactFilterChange={setContactFilter}
                    locationFilter={locationFilter}
                    onLocationFilterChange={setLocationFilter}
                    locationOptions={locationOptions}
                    activeCount={activeFilterCount}
                  />
                  {hasActiveFilters && (
                    <Button type="button" variant="link" onClick={clearFilters} className="h-auto shrink-0 text-[14px] font-semibold pointer-coarse:min-h-11">
                      Clear filters
                    </Button>
                  )}
                </>
              )}
              <div className="ml-auto flex items-center gap-2.5">
                {hasList && !readOnly && nextLockedBatch && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <PrimaryCta
                          size="sm"
                          icon={<LockIcon size={13} aria-hidden="true" />}
                          disabled={suspended}
                          ariaLabel={`Unlock ${nextLockedBatch.count} candidate${nextLockedBatch.count === 1 ? "" : "s"} for ${formatPaise(nextLockedBatch.amountPaise)}`}
                          onClick={() =>
                            setUnlockTarget({
                              mode: "batch",
                              requirementId: requirement.id,
                              count: nextLockedBatch.count,
                              amountPaise: nextLockedBatch.amountPaise,
                              start: nextLockedBatch.start,
                              end: nextLockedBatch.end,
                              remaining: Math.max(0, nextLockedBatch.lockedRemaining - nextLockedBatch.count),
                            })
                          }
                        >
                          Unlock {nextLockedBatch.count} candidate{nextLockedBatch.count === 1 ? "" : "s"} · {formatPaise(nextLockedBatch.amountPaise)}
                        </PrimaryCta>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64">
                      {suspended
                        ? "Unlocking is turned off while your account is suspended."
                        : `Unlocks the ${nextLockedBatch.count} locked candidate${nextLockedBatch.count === 1 ? "" : "s"} ranked ${nextLockedBatch.start}–${nextLockedBatch.end} at a batch rate.${
                            nextLockedBatch.lockedRemaining > nextLockedBatch.count
                              ? ` ${nextLockedBatch.lockedRemaining - nextLockedBatch.count} more stay locked further down; unlock those from their rows.`
                              : ""
                          } Names and contact details stay hidden until you pay.`}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      aria-label={refreshing ? "Refreshing candidates" : "Refresh candidates"}
                      className="shrink-0 rounded-lg pointer-coarse:size-11"
                    >
                      <RefreshCwIcon size={13} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64">Refresh candidates</TooltipContent>
                </Tooltip>
              </div>
            </div>
            </div>

            {hasList && appliedChips.length > 0 && (
              <ul aria-label="Applied filters" className="m-0 mb-4 flex list-none flex-wrap items-center gap-2 p-0">
                {appliedChips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={chip.remove}
                      aria-label={`Remove filter: ${chip.label}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hx-line bg-white py-1 pr-2 pl-3 text-[13px] text-hx-coal transition-colors duration-150 hover:bg-hx-row focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11"
                    >
                      {chip.label}
                      <XIcon size={13} aria-hidden="true" className="text-hx-ink-soft" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div aria-live="polite" className={refreshNote ? "mb-3" : undefined}>
              {refreshNote && <InlineNotice tone={refreshNote.tone} live={false}>{refreshNote.text}</InlineNotice>}
            </div>

            {requirement.status === "generating" && (
              <GeneratingState
                stalled={pollStalled}
                onRetry={() => {
                  setPollRun((n) => n + 1);
                  void refreshSilently();
                }}
              />
            )}
            {requirement.status === "failed" && <FailedState requirementId={requirement.id} canEdit={!suspended} />}
            {requirement.status === "zero" && <ZeroMatchState requirementId={requirement.id} canEdit={!suspended} />}

            {hasList && (
              <div id="cand-panel" role="tabpanel" aria-labelledby={`cand-tab-${tab}`}>
                {readOnly && (
                  <div className="mb-4">
                    <InlineNotice tone="info" live={false}>{closedSummary(requirement)}</InlineNotice>
                  </div>
                )}

                {candidates.length === 0 ? (
                  <EmptyNote title="No candidates yet">
                    Nobody is on this shortlist right now. New matches appear here as candidates practise, and this page refreshes when you come back to it.
                  </EmptyNote>
                ) : filteredSorted.length === 0 ? (
                  hasActiveFilters ? (
                    <EmptyNote
                      title="No candidates match"
                      action={
                        <Button type="button" variant="outline" className="pointer-coarse:h-11" onClick={clearFilters}>
                          Clear search and filters
                        </Button>
                      }
                    >
                      Nothing in {TAB_LABEL[tab]} fits your search or filters. Try fewer filters, or clear them to see everyone.
                    </EmptyNote>
                  ) : (
                    <EmptyNote
                      title={`No candidates in ${TAB_LABEL[tab]}`}
                      action={
                        <Button type="button" variant="outline" className="gap-1.5 pointer-coarse:h-11" onClick={() => setTabChoice("all")}>
                          <SearchIcon aria-hidden="true" /> View all candidates
                        </Button>
                      }
                    >
                      Candidates move here as you review them. Everyone matched to this job is under All candidates.
                    </EmptyNote>
                  )
                ) : (
                  <>
                  <CandidatesTable
                    rows={pageRows}
                    requirementId={requirement.id}
                    requiredSkills={requiredSkills}
                    readOnly={readOnly}
                    suspended={suspended}
                    sort={sort}
                    onSortChange={setSort}
                    onUnlock={(c) => setUnlockTarget({ mode: "single", matchId: c.id })}
                    onViewEvidence={(c) => setEvidenceId(c.id)}
                    onMessage={(c) => setMessagesId(c.id)}
                    onStageChange={handleStageChange}
                    totalCount={candidates.length}
                    filteredCount={filteredSorted.length}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={setRowsPerPage}
                    page={pageSafe}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                  </>
                )}

                <UnlockDialog target={unlockTarget} access={access} onClose={() => setUnlockTarget(null)} onUnlocked={handleUnlocked} />
                <EvidenceDialog
                  matchId={evidenceCandidate?.id ?? null}
                  displayName={evidenceCandidate ? candidateDisplayName(evidenceCandidate) : "Candidate"}
                  unlocked={evidenceCandidate?.unlocked ?? false}
                  onClose={() => setEvidenceId(null)}
                />
                <InterviewInviteDialog
                  open={inviteCandidate != null}
                  onOpenChange={(o) => !o && setInviteId(null)}
                  displayName={inviteCandidate ? candidateDisplayName(inviteCandidate) : "Candidate"}
                  requirementTitle={requirement.title}
                  onSubmit={submitInvite}
                />
                <AlertDialog open={pendingStage != null} onOpenChange={(o) => { if (!o && !stageBusy) setPendingStage(null); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {pendingStage ? `Mark ${pendingCandidate ? candidateDisplayName(pendingCandidate) : "this candidate"} as ${CANDIDATE_STATUS_LABEL[pendingStage.status]}?` : ""}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This is a final outcome for this job and can't be undone from here. To add a note first, use Move with a note in the Stage menu.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={stageBusy}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmStage(); }} disabled={stageBusy}>
                        {stageBusy ? "Saving…" : "Confirm"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <MessagesDialog
                  matchId={messagesCandidate?.id ?? null}
                  displayName={messagesCandidate ? candidateDisplayName(messagesCandidate) : "Candidate"}
                  unlocked={messagesCandidate?.unlocked ?? false}
                  suspended={suspended}
                  onClose={() => setMessagesId(null)}
                />
              </div>
            )}
          </section>
        </div>

        <JobSideRail
          requirement={requirement}
          counts={counts}
          tab={tab}
          onSelectTab={setTabChoice}
          insights={insights}
          activeInsightId={activeInsight?.id ?? null}
          onSelectInsight={setInsightId}
          readOnly={readOnly}
          suspended={suspended}
          onStageChange={changeStage}
        />
      </div>
    </div>
  );
}
