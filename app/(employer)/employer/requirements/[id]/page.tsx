"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LockIcon, RefreshCwIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { PrimaryCta } from "@/employer/_atoms";
import InterviewInviteDialog, { statusErrorCopy, type InviteResult, type InviteValues } from "@/employer/InterviewInviteDialog";
import { useToast } from "@/Toast";
import { EmptyNote, ErrorRetry, InlineNotice, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import type { UnlockedCandidate } from "@/employer/_requirementCalls";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { type Sort } from "@/components/SortableHead";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UNLOCK_BUNDLE_SIZE, batchUnlockPrice } from "../../../../../server-handlers/_unlock-pricing";
import BulkActions from "./_components/BulkActions";
import CandidatesFilters from "./_components/CandidatesFilters";
import CandidatesTable from "./_components/CandidatesTable";
import EvidenceDialog from "./_components/EvidenceDialog";
import MessagesDialog from "./_components/MessagesDialog";
import RequirementHeader from "./_components/RequirementHeader";
import { FailedState, GeneratingState, ZeroMatchState } from "./_components/StatusStates";
import UnlockDialog from "./_components/UnlockDialog";
import {
  CONTACT_FILTER_OPTIONS,
  DEFAULT_SORT,
  compareCandidates,
  filterCandidates,
  type ContactFilter,
  type PipelineFilter,
  type SortColumn,
} from "./_components/candidateTableModel";
import { candidateDisplayName } from "./_components/requirementFormat";
import type { UnlockTarget } from "./_components/useUnlockCheckout";

const CANDIDATES_RECENT_SEARCHES_KEY = "hirestepx-employer-candidates-recent-searches";

function rupees(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { fetchRequirementDetail, updateCandidateStatusResult } = useEmployerData();
  const access = useEmployerAccess();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // Backs both the 2-way Compare flow and bulk actions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
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
  // flaky connection never replaces good data with an error screen.
  const refreshSilently = useCallback(async (): Promise<boolean> => {
    const r = await fetchRequirementDetail(params.id);
    if (r) setRequirement(r);
    return r != null;
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEmployerBreadcrumb(requirement ? [{ label: requirement.title, path: `/employer/requirements/${params.id}` }] : null);

  // A freshly created requirement usually matches synchronously, so this poll
  // only covers the rare stale fetch.
  useEffect(() => {
    if (requirement?.status !== "generating") return;
    const timer = setTimeout(refreshSilently, 2500);
    return () => clearTimeout(timer);
  }, [requirement, refreshSilently]);

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

  const candidates = useMemo(() => requirement?.candidates ?? [], [requirement]);

  const locationOptions = useMemo(() => {
    const cities = new Set(candidates.map((c) => c.city).filter((c) => c && c !== "Not specified"));
    return Array.from(cities).sort();
  }, [candidates]);

  const activeFilterCount = (contactFilter !== "all" ? 1 : 0) + (locationFilter !== "all" ? 1 : 0);
  const hasActiveFilters = search.trim() !== "" || contactFilter !== "all" || locationFilter !== "all" || pipelineFilter !== "all";

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    const firstContact = CONTACT_FILTER_OPTIONS.find((o) => o.value !== "all" && o.value !== contactFilter);
    if (firstContact) suggestions.push({ label: `Contact: ${firstContact.label}`, apply: () => setContactFilter(firstContact.value) });
    const firstLocation = locationOptions.find((loc) => loc !== locationFilter);
    if (firstLocation) suggestions.push({ label: `Location: ${firstLocation}`, apply: () => setLocationFilter(firstLocation) });
    return suggestions.slice(0, 4);
  }, [contactFilter, locationOptions, locationFilter]);

  const filteredSorted = useMemo(
    () => filterCandidates(candidates, { search, contact: contactFilter, location: locationFilter, pipeline: pipelineFilter }).sort((a, b) => compareCandidates(a, b, sort)),
    [candidates, search, contactFilter, locationFilter, pipelineFilter, sort],
  );

  useEffect(() => {
    setPage(1);
  }, [search, contactFilter, locationFilter, pipelineFilter, sort, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filteredSorted.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const patchRequirement = useCallback((patch: Partial<Requirement>) => {
    setRequirement((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const patchCandidates = useCallback((apply: (c: Candidate) => Candidate) => {
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
  const handleInvite = (c: Candidate) => {
    if (!c.unlocked) setUnlockTarget({ mode: "single", matchId: c.id });
    else setInviteId(c.id);
  };

  const submitInvite = async ({ note, scheduledAt }: InviteValues): Promise<InviteResult> => {
    if (!inviteCandidate) return { ok: false };
    const res = await updateCandidateStatusResult(inviteCandidate.id, { candidateStatus: "interview_invited", note, interviewScheduledAt: scheduledAt });
    if (!res.ok) return { ok: false, message: statusErrorCopy(res.error) };
    patchCandidates((c) => (c.id === inviteCandidate.id ? { ...c, candidateStatus: "interview_invited", interviewScheduledAt: scheduledAt ?? c.interviewScheduledAt } : c));
    toast("Interview invite sent", "success");
    return { ok: true };
  };

  const handleRejected = (matchIds: string[]) => {
    const done = new Set(matchIds);
    patchCandidates((c) => (done.has(c.id) ? { ...c, candidateStatus: "rejected" } : c));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => !done.has(id))));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id));
  const evidenceCandidate = candidates.find((c) => c.id === evidenceId) ?? null;
  const messagesCandidate = candidates.find((c) => c.id === messagesId) ?? null;

  // Candidates arrive ranked by match_score descending (the server's fixed
  // order), so batch membership by position is stable under local filtering.
  let nextLockedBatch: { start: number; end: number; count: number } | null = null;
  for (let start = 0; start < candidates.length; start += UNLOCK_BUNDLE_SIZE) {
    const block = candidates.slice(start, start + UNLOCK_BUNDLE_SIZE);
    const locked = block.filter((c) => !c.unlocked).length;
    if (locked > 0) {
      nextLockedBatch = { start: start + 1, end: start + block.length, count: locked };
      break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 0 auto", paddingBottom: 24, minWidth: 0 }}>
      {suspended && (
        <div style={{ marginBottom: 16 }}>
          <SuspendedBanner />
        </div>
      )}

      <RequirementHeader
        requirement={requirement}
        suspended={suspended}
        pipelineFilter={pipelineFilter}
        onPipelineFilterChange={setPipelineFilter}
        onPatch={patchRequirement}
        onReload={load}
      />

      <section aria-labelledby="candidates-heading" style={{ marginTop: 24, flex: "1 0 auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <h2 id="candidates-heading" style={{ fontFamily: f.sans, fontSize: textSize.xl, fontWeight: 600, color: t.coal, margin: 0, flexShrink: 0 }}>
            Candidates
          </h2>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, justifyContent: "flex-end", minWidth: 0 }}>
            {hasList && (
              <>
                <SearchWithSuggestions
                  id="candidates-search"
                  label="Search candidates"
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by role, skill, or notice period…"
                  storageKey={CANDIDATES_RECENT_SEARCHES_KEY}
                  suggestedFilters={suggestedFilters}
                  style={{ flex: "1 1 200px", minWidth: 140, maxWidth: 280 }}
                  inputStyle={{ background: t.white }}
                />
                <CandidatesFilters
                  contactFilter={contactFilter}
                  onContactFilterChange={setContactFilter}
                  locationFilter={locationFilter}
                  onLocationFilterChange={setLocationFilter}
                  locationOptions={locationOptions}
                  activeCount={activeFilterCount}
                />
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setSearch("");
                      setContactFilter("all");
                      setLocationFilter("all");
                      setPipelineFilter("all");
                    }}
                    className="pointer-coarse:min-h-11"
                    style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, height: "auto", flexShrink: 0 }}
                  >
                    Clear filters
                  </Button>
                )}
                {!readOnly && nextLockedBatch && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <PrimaryCta
                          size="sm"
                          icon={<LockIcon size={13} aria-hidden="true" />}
                          disabled={suspended}
                          ariaLabel={`Unlock top ${nextLockedBatch.start} to ${nextLockedBatch.end} for ${rupees(batchUnlockPrice(nextLockedBatch.count).amountPaise)}`}
                          onClick={() =>
                            setUnlockTarget({
                              mode: "batch",
                              requirementId: requirement.id,
                              count: nextLockedBatch.count,
                              start: nextLockedBatch.start,
                              end: nextLockedBatch.end,
                            })
                          }
                        >
                          Unlock {nextLockedBatch.start}–{nextLockedBatch.end} · {rupees(batchUnlockPrice(nextLockedBatch.count).amountPaise)}
                        </PrimaryCta>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64">
                      {suspended
                        ? "Unlocking is turned off while your account is suspended."
                        : `Unlock the ${nextLockedBatch.count} locked candidates ranked ${nextLockedBatch.start}–${nextLockedBatch.end} for a flat rate instead of one at a time. Names and contact details stay hidden until you pay.`}
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
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
                  className="pointer-coarse:size-11"
                  style={{ borderRadius: 8, flexShrink: 0 }}
                >
                  <RefreshCwIcon size={13} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-64">Refresh candidates</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div aria-live="polite" style={{ marginBottom: refreshNote ? 12 : 0 }}>
          {refreshNote && <InlineNotice tone={refreshNote.tone} live={false}>{refreshNote.text}</InlineNotice>}
        </div>

        {requirement.status === "generating" && <GeneratingState />}
        {requirement.status === "failed" && <FailedState requirementId={requirement.id} canEdit={!suspended} />}
        {requirement.status === "zero" && <ZeroMatchState requirementId={requirement.id} canEdit={!suspended} />}

        {hasList && (
          <>
            {readOnly && (
              <div style={{ marginBottom: 16 }}>
                <InlineNotice tone="info" live={false}>This requirement is closed. Candidate details are read-only.</InlineNotice>
              </div>
            )}

            {!readOnly && (
              <BulkActions
                requirementId={requirement.id}
                requirementTitle={requirement.title}
                selected={selectedCandidates}
                suspended={suspended}
                onClearSelection={() => setSelectedIds(new Set())}
                onRejected={handleRejected}
              />
            )}

            {candidates.length === 0 ? (
              <EmptyNote title="No candidates yet">
                Nobody is on this shortlist right now. New matches appear here as candidates practise, and this page refreshes when you come back to it.
              </EmptyNote>
            ) : filteredSorted.length === 0 ? (
              <EmptyNote
                title="No candidates match"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="pointer-coarse:h-11"
                    onClick={() => {
                      setSearch("");
                      setContactFilter("all");
                      setLocationFilter("all");
                      setPipelineFilter("all");
                    }}
                  >
                    Clear search and filters
                  </Button>
                }
              >
                Nothing on this shortlist fits your search or filters. Try fewer filters, or clear them to see everyone.
              </EmptyNote>
            ) : (
              <CandidatesTable
                rows={pageRows}
                requirementId={requirement.id}
                readOnly={readOnly}
                suspended={suspended}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                sort={sort}
                onSortChange={setSort}
                onUnlock={(c) => setUnlockTarget({ mode: "single", matchId: c.id })}
                onViewEvidence={(c) => setEvidenceId(c.id)}
                onMessage={(c) => setMessagesId(c.id)}
                onInvite={handleInvite}
                totalCount={candidates.length}
                filteredCount={filteredSorted.length}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={setRowsPerPage}
                page={pageSafe}
                totalPages={totalPages}
                onPageChange={setPage}
              />
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
            <MessagesDialog
              matchId={messagesCandidate?.id ?? null}
              displayName={messagesCandidate ? candidateDisplayName(messagesCandidate) : "Candidate"}
              unlocked={messagesCandidate?.unlocked ?? false}
              suspended={suspended}
              onClose={() => setMessagesId(null)}
            />
          </>
        )}
      </section>
    </div>
  );
}
