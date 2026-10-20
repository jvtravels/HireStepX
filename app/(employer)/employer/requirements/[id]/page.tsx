"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LockIcon, SearchIcon, XIcon } from "lucide-react";
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
import { formatPaise, unlockRateNote } from "../../../../../server-handlers/_unlock-pricing";
import { candidatesToCsv, csvFileName, downloadCsv, exportableCandidates } from "./_components/candidateCsv";
import CandidatesTable from "./_components/CandidatesTable";
import EvidenceDialog from "./_components/EvidenceDialog";
import MessagesDialog from "./_components/MessagesDialog";
import JobOverview, { hasRoleDetails } from "./_components/JobOverview";
import JobHeader from "./_components/JobHeader";
import JobSideRail, { JobInsights } from "./_components/JobSideRail";
import KeyRequirements, { hasKeyRequirements } from "./_components/KeyRequirements";
import { useJobActions } from "./_components/useJobActions";
import { FailedState, GeneratingState, ZeroMatchState } from "./_components/StatusStates";
import UnlockDialog from "./_components/UnlockDialog";
import SelectionBar from "./_components/SelectionBar";
import ShortcutsDialog from "./_components/ShortcutsDialog";
import ViewMenu from "./_components/ViewMenu";
import { useStageActions } from "./_components/useStageActions";
import { useShortlistShortcuts } from "./_components/useShortlistShortcuts";
import { useShortcutsEnabled } from "@/employer/keyboardShortcutsPref";
import { useShortlistSelection } from "./_components/useShortlistSelection";
import BulkRejectDialog from "./_components/BulkRejectDialog";
import { MAX_SELECTION, compareHref, planBulkMove, type BulkTarget } from "./_components/shortlistSelection";
import { parseShortlistView, writeShortlistView } from "./_components/shortlistUrlState";
import {
  CONTACT_FILTER_OPTIONS,
  compareCandidates,
  filterCandidates,
  type ContactFilter,
  type SortColumn,
} from "./_components/candidateTableModel";
import { candidateDisplayName, closedSummary, reversibilityNote } from "./_components/requirementFormat";
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
  const toolbarObserver = useRef<ResizeObserver | null>(null);
  // The column header row sticks just below the toolbar, so the table CSS needs the toolbar's live height.
  const trackToolbarHeight = useCallback((el: HTMLDivElement | null) => {
    toolbarObserver.current?.disconnect();
    toolbarObserver.current = null;
    const section = el?.parentElement;
    if (!el || !section) return;
    const sync = () => section.style.setProperty("--cand-sticky-top", `${el.offsetHeight}px`);
    sync();
    toolbarObserver.current = new ResizeObserver(sync);
    toolbarObserver.current.observe(el);
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  // The view (tab, search, filters, sort) is read from the URL once and written back as it changes.
  const [initialView] = useState(() => parseShortlistView(searchParams));
  const [search, setSearch] = useState(initialView.search);
  const [contactFilter, setContactFilter] = useState<ContactFilter>(initialView.contact);
  const [locationFilter, setLocationFilter] = useState<string>(initialView.location);
  const [tabChoice, setTabChoice] = useState<CandidateTab | null>(initialView.tab);
  const [insightId, setInsightId] = useState<string | null>(initialView.insight);
  const [sort, setSort] = useState<Sort<SortColumn>>(initialView.sort);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingBulk, setPendingBulk] = useState<BulkTarget | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [unlockTarget, setUnlockTarget] = useState<UnlockTarget | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [messagesId, setMessagesId] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const { toast, triggerToastAction } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setLoadingMore(false);
    const r = await fetchRequirementDetail(params.id, {
      onFirstPage: (partial) => {
        setRequirement(partial);
        setLoading(false);
        setLoadingMore(true);
      },
    });
    setRequirement(r);
    setLoadFailed(r == null);
    setLoading(false);
    setLoadingMore(false);
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

  const unlockedCount = useMemo(() => exportableCandidates(candidates).length, [candidates]);
  const exportUnlocked = () => {
    if (!requirement || unlockedCount === 0) return;
    downloadCsv(csvFileName(requirement.title), candidatesToCsv(candidates, requirement.skills));
    toast(`Exported ${unlockedCount} unlocked candidate${unlockedCount === 1 ? "" : "s"}`, "success");
  };

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

  const { applyStage, bulkMove } = useStageActions({ candidates, patchCandidates, update: updateCandidateStatusResult, toast });

  const handleStageChange = (c: Candidate, status: CandidateStatus) => {
    if (!c.unlocked && needsUnlockFor(status)) setUnlockTarget({ mode: "single", matchId: c.id });
    else if (status === "interview_invited") setInviteId(c.id);
    else if (status === "interviewing" || status === "shortlisted") void applyStage(c, status);
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

  const submitInvite = async ({ message, scheduledAt }: InviteValues): Promise<InviteResult> => {
    if (!inviteCandidate) return { ok: false };
    // candidateMessage is always explicit (even empty) so the server never reads a private note as a message to the candidate.
    const res = await updateCandidateStatusResult(inviteCandidate.id, { candidateStatus: "interview_invited", candidateMessage: message ?? "", interviewScheduledAt: scheduledAt });
    if (!res.ok) return { ok: false, message: statusErrorCopy(res.error) };
    patchCandidates((c) => (c.id === inviteCandidate.id ? { ...c, candidateStatus: "interview_invited", interviewScheduledAt: scheduledAt ?? c.interviewScheduledAt } : c));
    toast("Interview invite sent", "success");
    return { ok: true };
  };

  useEffect(() => {
    const next = writeShortlistView(new URLSearchParams(window.location.search), { tab: tabChoice, search, contact: contactFilter, location: locationFilter, sort, insight: insightId });
    const query = next.toString();
    if (query === window.location.search.replace(/^\?/, "")) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [tabChoice, search, contactFilter, locationFilter, sort, insightId]);

  const openCandidate = useCallback((id: string) => router.push(`/employer/requirements/${params.id}/candidates/${id}`), [router, params.id]);
  const sel = useShortlistSelection({ filtered: filteredSorted, pageRows, onOpen: openCandidate });
  const { selected } = sel;

  const bulkEligible = useMemo<Record<BulkTarget, number>>(
    () => ({
      rejected: planBulkMove(candidates, selected, "rejected").changes.length,
      shortlisted: planBulkMove(candidates, selected, "shortlisted").changes.length,
    }),
    [candidates, selected],
  );

  // The confirm names exactly who the move will touch, from the same plan the move runs.
  const bulkPlan = pendingBulk ? planBulkMove(candidates, selected, pendingBulk) : null;
  const bulkIds = new Set((bulkPlan?.changes ?? []).map((ch) => ch.id));
  const bulkNames = candidates.filter((c) => bulkIds.has(c.id)).map(candidateDisplayName);

  const runBulk = async (target: BulkTarget) => {
    setBulkBusy(true);
    const moved = await bulkMove(selected, target);
    setBulkBusy(false);
    setPendingBulk(null);
    if (moved.length > 0) sel.deselect(moved);
  };

  // Rejecting many at once asks first; moving back to To review is the safe direction.
  const requestBulk = (target: BulkTarget) => {
    if (target === "rejected") setPendingBulk(target);
    else void runBulk(target);
  };

  const listVisible = requirement?.status === "ready" || requirement?.status === "partial" || requirement?.status === "closed";
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const undoLast = useCallback(() => void triggerToastAction(), [triggerToastAction]);
  const shortcutsOn = useShortcutsEnabled();
  useShortlistShortcuts(
    { onNext: sel.next, onPrev: sel.prev, onToggleSelect: sel.toggleActive, onOpen: sel.openActive, onHelp: showShortcuts, onEscape: sel.clear, onUndo: undoLast },
    listVisible && shortcutsOn,
  );

  /* An insight spans every stage, so a tab that hides its candidates would show an empty table. */
  const selectInsight = (id: string | null) => {
    setInsightId(id);
    if (id) setTabChoice(null);
  };

  const clearFilters = () => {
    setSearch("");
    setContactFilter("all");
    setLocationFilter("all");
    setInsightId(null);
  };

  if (loading && !requirement) return <PageSkeleton label="Loading job" variant="job" flat />;

  if (!requirement) {
    return (
      <ErrorRetry
        flat
        title="Couldn't open this job"
        message={
          loadFailed
            ? "It may have been deleted, or we couldn't reach HireStepX. Try again, or go back to your jobs."
            : "Something went wrong loading this page."
        }
        onRetry={load}
        retrying={loading}
      >
        <Link
          href="/employer/jobs"
          className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
          style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.indigo, outlineColor: t.indigo }}
        >
          Back to jobs
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
  const nextBatchTarget: Extract<UnlockTarget, { mode: "batch" }> | null = nextLockedBatch && nextLockedBatch.count > 1
    ? { mode: "batch", requirementId: requirement.id, count: nextLockedBatch.count, amountPaise: nextLockedBatch.amountPaise, start: nextLockedBatch.start, end: nextLockedBatch.end, remaining: Math.max(0, nextLockedBatch.lockedRemaining - nextLockedBatch.count) }
    : null;

  const batchNote = nextLockedBatch ? unlockRateNote(nextLockedBatch.count, nextLockedBatch.amountPaise) : null;
  const requiredSkills = Array.from(new Set([...requirement.skills, ...requirement.customSkillSets]));
  const tabs = visibleTabs(counts, tab).map((key) => ({ key, label: TAB_LABEL[key], count: counts[key] }));

  return (
    <div className="flex min-w-0 flex-[1_0_auto] flex-col">
      {suspended && (
        <div className="px-7 pt-4">
          <SuspendedBanner />
        </div>
      )}

      <div className="grid min-w-0 min-[1440px]:grid-cols-[minmax(0,1fr)_320px]">
      <JobHeader
        requirement={requirement}
        suspended={suspended}
        message={message}
        reopening={reopenSaving}
        onReopen={reopen}
        onReload={load}
        expandedContent={hasRoleDetails(requirement) ? <JobOverview requirement={requirement} /> : null}
        requirementsSlot={hasKeyRequirements(requirement) ? <KeyRequirements requirement={requirement} /> : null}
        insightsSlot={insights.length > 0 ? <JobInsights insights={insights} activeInsightId={activeInsight?.id ?? null} onSelectInsight={selectInsight} /> : null}
      />
      <JobSideRail requirement={requirement} readOnly={readOnly} suspended={suspended} onStageChange={changeStage} />
      </div>

      <div className="flex min-w-0 flex-col border-t border-hx-line">
          <section aria-labelledby="candidates-heading" className="flex min-w-0 flex-col">
            <h2 id="candidates-heading" className="sr-only">
              Candidates
            </h2>
            <div ref={trackToolbarHeight} className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-white px-7 py-3 min-[1280px]:flex-nowrap md:sticky md:top-0 md:z-20">
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
            <div className="flex min-w-0 flex-[1_1_auto] flex-wrap items-center justify-end gap-2.5 min-[1100px]:flex-nowrap">
              {hasList && !readOnly && nextLockedBatch && (
                <span
                  className="shrink-0"
                  title={suspended
                    ? "Unlocking is turned off while your account is suspended."
                    : `Ranked ${nextLockedBatch.start} to ${nextLockedBatch.end}, at ${batchNote?.perCandidate} each.${batchNote?.savings ? ` ${batchNote.savings}` : ""}${nextLockedBatch.lockedRemaining > nextLockedBatch.count ? ` ${nextLockedBatch.lockedRemaining - nextLockedBatch.count} more stay locked further down; unlock those from their rows.` : ""} Names and contact details stay hidden until you pay.`}
                >
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
                    Unlock {nextLockedBatch.count} · {formatPaise(nextLockedBatch.amountPaise)}
                  </PrimaryCta>
                </span>
              )}
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
                  <ViewMenu
                    contact={contactFilter}
                    onContactChange={setContactFilter}
                    location={locationFilter}
                    onLocationChange={setLocationFilter}
                    locationOptions={locationOptions}
                    sort={sort}
                    onSortChange={setSort}
                    activeCount={activeFilterCount}
                    unlockedCount={unlockedCount}
                    onExport={exportUnlocked}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    onShowShortcuts={showShortcuts}
                  />
                </>
              )}
            </div>
            </div>

            {hasList && hasActiveFilters && (
              <ul aria-label="Applied filters" className="m-0 mx-7 mb-4 flex list-none flex-wrap items-center gap-2 p-0">
                {appliedChips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={chip.remove}
                      aria-label={`Remove filter: ${chip.label}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hx-line bg-white py-1 pr-2 pl-3 text-[13px] text-hx-coal transition-colors duration-150 hover:bg-hx-row focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none pointer-coarse:min-h-11"
                    >
                      {chip.label}
                      <XIcon size={13} aria-hidden="true" className="text-hx-ink-soft" />
                    </button>
                  </li>
                ))}
                <li>
                  <Button type="button" variant="link" onClick={clearFilters} className="h-auto text-[14px] font-semibold pointer-coarse:min-h-11">
                    Clear all
                  </Button>
                </li>
              </ul>
            )}
  
            <div aria-live="polite" role="status" className="sr-only">{sel.announcement}</div>
            <div aria-live="polite" className={refreshNote ? "mx-7 mb-3" : undefined}>
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
                  <div className="mx-7 mb-4">
                    <InlineNotice tone="info" live={false}>{closedSummary(requirement)}</InlineNotice>
                  </div>
                )}
  
                {candidates.length === 0 ? (
                  <EmptyNote flat title="No candidates yet">
                    Nobody is on this shortlist right now. New matches appear here as candidates practise, and this page refreshes when you come back to it.
                  </EmptyNote>
                ) : filteredSorted.length === 0 ? (
                  hasActiveFilters ? (
                    <EmptyNote
                      flat
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
                      flat
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
                  {!loadingMore && (requirement.total ?? candidates.length) > candidates.length && (
                    <div className="mx-7 mb-3">
                      <InlineNotice tone="info" live={false}>
                        Showing {candidates.length} of {requirement.total} candidates. Narrow the shortlist with search and filters, or close out candidates you have already decided on.
                      </InlineNotice>
                    </div>
                  )}
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
                    selectedIds={selected}
                    onSelectedChange={sel.toggle}
                    pageState={sel.pageState}
                    onTogglePage={sel.togglePage}
                    selectionFull={selected.size >= MAX_SELECTION}
                    activeId={sel.activeId}
                  />
                  <SelectionBar
                    count={selected.size}
                    offPage={sel.offPage}
                    canChangeStage={!readOnly && !suspended}
                    eligible={bulkEligible}
                    busy={bulkBusy}
                    onCompare={() => router.push(compareHref(requirement.id, [...selected]))}
                    onBulk={requestBulk}
                    onClear={sel.clear}
                  />
                  </>
                )}
  
                <UnlockDialog target={unlockTarget} access={access} onClose={() => setUnlockTarget(null)} onUnlocked={handleUnlocked} nextBatch={nextBatchTarget} onChooseBatch={setUnlockTarget} />
                <EvidenceDialog
                  matchId={evidenceCandidate?.id ?? null}
                  displayName={evidenceCandidate ? candidateDisplayName(evidenceCandidate) : "Candidate"}
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
                        {pendingStage ? reversibilityNote(pendingStage.status) : ""} To add a private note first, use Move with a note in the Stage menu.
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
                <BulkRejectDialog
                  open={pendingBulk != null}
                  names={bulkNames}
                  skipped={bulkPlan?.skipped ?? 0}
                  busy={bulkBusy}
                  onConfirm={() => pendingBulk && void runBulk(pendingBulk)}
                  onCancel={() => setPendingBulk(null)}
                />
                <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
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
    </div>
  );
}
