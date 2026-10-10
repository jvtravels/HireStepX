"use client";

/* /employer/jobs — the requirements console. Same card shell, toolbar,
   shadcn Table + SortableHead, and TablePaginationFooter as the
   candidate-side Jobs table (src/DashboardJobs.tsx) so both sides of the
   marketplace read as one product. Filtering, sorting, and pagination all
   run client-side over the requirements already loaded by EmployerDataContext.

   Presentational pieces live in ./_components (table, mobile card, filters,
   dialogs); this file owns state and filter logic. Recent searches persist
   per-browser via localStorage only; there is no server-side record of
   search terms. */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon, BriefcaseIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { useToast } from "@/Toast";
import { useMaxWidth } from "@/hooks/useMaxWidth";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import type { RequirementSummary, RequirementStage, ArchiveDisposition } from "@/employer/mockData";
import { STAGE_LABEL, STAGE_OPTIONS } from "@/employer/_atoms";
import { PageSkeleton, ErrorPanel, PrimaryLink } from "@/employer/_consoleParts";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import {
  RECENT_SEARCHES_KEY, DUE_OPTIONS, EMPTY_RANGE, DEFAULT_SORT, locationText, rangesOverlap, compareRows, matchesDueFilter,
  type NumberRange, type SortColumn,
} from "./_components/jobsHelpers";
import { FilterChip } from "./_components/JobCells";
import AdvancedFiltersPopover from "./_components/AdvancedFiltersPopover";
import JobsTable from "./_components/JobsTable";
import JobCard from "./_components/JobCard";
import JobRowActions from "./_components/JobRowActions";
import JobHistoryDialog from "./_components/JobHistoryDialog";
import JobArchiveDialog from "./_components/JobArchiveDialog";

const emptyNote: React.CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 380 };

export default function EmployerJobsPage() {
  const compact = useMaxWidth(640);
  const router = useRouter();
  const { toast } = useToast();
  const {
    requirements, requirementsLoading, requirementsError, refreshRequirements, archiveRequirement, reopenRequirement,
    updateRequirementStage, fetchRequirementActivity, limits, suspended,
  } = useEmployerData();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<string[]>([]);
  const [experienceFilter, setExperienceFilter] = useState<NumberRange>(EMPTY_RANGE);
  const [salaryFilter, setSalaryFilter] = useState<NumberRange>(EMPTY_RANGE);
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [archiveTarget, setArchiveTarget] = useState<RequirementSummary | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveDisposition, setArchiveDisposition] = useState<ArchiveDisposition>("keep_candidates");
  const [historyTarget, setHistoryTarget] = useState<RequirementSummary | null>(null);
  const [historyItems, setHistoryItems] = useState<RequirementActivity[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const stageOptions = useMemo(
    () => STAGE_OPTIONS.filter((s) => requirements.some((r) => r.stage === s)).map((s) => STAGE_LABEL[s]),
    [requirements],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(requirements.flatMap((r) => (r.locations.length > 0 ? r.locations : [r.location])).filter(Boolean))).sort(),
    [requirements],
  );
  const jobTypeOptions = useMemo(
    () => Array.from(new Set(requirements.map((r) => (r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null)).filter((v): v is string => !!v))).sort(),
    [requirements],
  );
  const departmentOptions = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.department).filter((v): v is string => !!v))).sort(),
    [requirements],
  );
  const hasAnyDepartment = departmentOptions.length > 0;
  const openCount = useMemo(() => requirements.filter((r) => r.status !== "closed").length, [requirements]);
  const atJobLimit = openCount >= limits.openRequirements;

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    const firstStage = stageOptions.find((o) => !stageFilter.includes(o));
    if (firstStage) suggestions.push({ label: `Stage: ${firstStage}`, apply: () => setStageFilter((prev) => [...prev, firstStage]) });
    const firstJobType = jobTypeOptions.find((o) => !jobTypeFilter.includes(o));
    if (firstJobType) suggestions.push({ label: `Type: ${firstJobType}`, apply: () => setJobTypeFilter((prev) => [...prev, firstJobType]) });
    const firstLocation = locationOptions.find((o) => o !== locationFilter);
    if (firstLocation) suggestions.push({ label: `Location: ${firstLocation}`, apply: () => setLocationFilter(firstLocation) });
    return suggestions.slice(0, 4);
  }, [stageOptions, jobTypeOptions, locationOptions, stageFilter, jobTypeFilter, locationFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = requirements.filter((r) => {
      if (q && !`${r.title} ${locationText(r)} ${r.skills.join(" ")}`.toLowerCase().includes(q)) return false;
      if (stageFilter.length > 0 && !stageFilter.includes(STAGE_LABEL[r.stage])) return false;
      if (locationFilter && !(r.locations.length > 0 ? r.locations : [r.location]).includes(locationFilter)) return false;
      if (jobTypeFilter.length > 0) {
        const jt = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
        if (!jt || !jobTypeFilter.includes(jt)) return false;
      }
      if (departmentFilter && r.department !== departmentFilter) return false;
      if (dueFilter.length > 0 && !dueFilter.some((d) => matchesDueFilter(r, d))) return false;
      if (!rangesOverlap(r.experienceMin, r.experienceMax, experienceFilter)) return false;
      if (!rangesOverlap(r.budgetMin, r.budgetMax, salaryFilter)) return false;
      return true;
    });
    return [...list].sort((a, b) => compareRows(a, b, sort));
  }, [requirements, search, stageFilter, locationFilter, jobTypeFilter, departmentFilter, dueFilter, experienceFilter, salaryFilter, sort]);

  useEffect(() => { setPage(1); }, [search, stageFilter, locationFilter, jobTypeFilter, departmentFilter, dueFilter, experienceFilter, salaryFilter, sort, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const clearFilters = () => {
    setSearch("");
    setStageFilter([]);
    setLocationFilter("");
    setJobTypeFilter([]);
    setDepartmentFilter("");
    setDueFilter([]);
    setExperienceFilter(EMPTY_RANGE);
    setSalaryFilter(EMPTY_RANGE);
  };

  const activeChips: Array<{ label: string; remove: () => void }> = [];
  if (search.trim()) activeChips.push({ label: `Search: "${search.trim()}"`, remove: () => setSearch("") });
  if (stageFilter.length > 0) activeChips.push({ label: `Stage: ${stageFilter.join(", ")}`, remove: () => setStageFilter([]) });
  if (locationFilter) activeChips.push({ label: `Location: ${locationFilter}`, remove: () => setLocationFilter("") });
  if (jobTypeFilter.length > 0) activeChips.push({ label: `Job type: ${jobTypeFilter.join(", ")}`, remove: () => setJobTypeFilter([]) });
  if (departmentFilter) activeChips.push({ label: `Department: ${departmentFilter}`, remove: () => setDepartmentFilter("") });
  if (dueFilter.length > 0) activeChips.push({ label: `Due: ${dueFilter.join(", ")}`, remove: () => setDueFilter([]) });
  if (experienceFilter.min || experienceFilter.max) {
    activeChips.push({ label: `Experience: ${experienceFilter.min || "0"}–${experienceFilter.max || "∞"} yrs`, remove: () => setExperienceFilter(EMPTY_RANGE) });
  }
  if (salaryFilter.min || salaryFilter.max) {
    activeChips.push({ label: `Salary: ${salaryFilter.min || "0"}–${salaryFilter.max || "∞"}`, remove: () => setSalaryFilter(EMPTY_RANGE) });
  }

  const onlySearchActive =
    search.trim() !== "" &&
    stageFilter.length === 0 && !locationFilter && jobTypeFilter.length === 0 && !departmentFilter && dueFilter.length === 0 &&
    !experienceFilter.min && !experienceFilter.max && !salaryFilter.min && !salaryFilter.max;

  const activeFilterCount =
    (stageFilter.length > 0 ? 1 : 0) +
    (jobTypeFilter.length > 0 ? 1 : 0) +
    (dueFilter.length > 0 ? 1 : 0) +
    (locationFilter ? 1 : 0) +
    (departmentFilter ? 1 : 0) +
    (experienceFilter.min || experienceFilter.max ? 1 : 0) +
    (salaryFilter.min || salaryFilter.max ? 1 : 0);

  const openHistory = async (r: RequirementSummary) => {
    setHistoryTarget(r);
    setHistoryItems(null);
    setHistoryLoading(true);
    const activity = await fetchRequirementActivity(r.id);
    setHistoryItems(activity ?? []);
    setHistoryLoading(false);
  };

  const openArchive = (r: RequirementSummary) => {
    setArchiveReason("");
    setArchiveDisposition("keep_candidates");
    setArchiveTarget(r);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    const isClosed = archiveTarget.status === "closed";
    const ok = isClosed
      ? await reopenRequirement(archiveTarget.id)
      : await archiveRequirement(archiveTarget.id, { archiveReason: archiveReason || undefined, archiveDisposition });
    setArchiveBusy(false);
    if (ok) {
      setArchiveTarget(null);
    } else {
      toast(isClosed ? "Couldn't reopen this job. Please try again." : "Couldn't archive this job. Please try again.", "error");
    }
  };

  const changeStage = async (id: string, stage: RequirementStage) => {
    const ok = await updateRequirementStage(id, stage);
    if (!ok) toast("Couldn't update the stage. Please try again.", "error");
  };

  const rowActions = (r: RequirementSummary) => (
    <JobRowActions requirement={r} readOnly={suspended} onArchive={openArchive} onHistory={openHistory} />
  );

  const postIcon = <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />;

  const shell = (body: React.ReactNode, filters?: React.ReactNode) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: compact ? "14px 16px" : "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Jobs</h1>
          {!requirementsLoading && requirements.length > 0 && (
            <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, margin: "2px 0 0" }}>
              {openCount} of {limits.openRequirements} open jobs used
              {atJobLimit && !suspended && (
                <>
                  {" · "}
                  <Link href="/employer/settings" className="underline" style={{ color: t.coal }}>Raise your limit</Link>
                </>
              )}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: compact ? "stretch" : "flex-end", flex: compact ? "1 1 100%" : 1, minWidth: 0 }}>
          {filters}
          {!suspended && (
            <PrimaryLink href="/employer/requirements/new" icon={postIcon} full={compact}>Post a requirement</PrimaryLink>
          )}
        </div>
      </div>
      {body}
    </div>
  );

  if (requirementsLoading) {
    return shell(
      <div style={{ padding: 20 }}>
        <PageSkeleton label="Loading your jobs" />
      </div>,
    );
  }

  if (requirementsError && requirements.length === 0) {
    return shell(
      <div style={{ padding: "48px 16px" }}>
        <ErrorPanel
          title="We couldn't load your jobs"
          message="Your data is safe. Check your connection and try again."
          onRetry={() => { void refreshRequirements(); }}
          retryLabel="Retry"
        />
      </div>,
    );
  }

  if (requirements.length === 0) {
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "72px 24px", flex: 1, textAlign: "center" }}>
        <div aria-hidden="true" style={{
          width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          border: `1.5px dashed ${t.line}`, background: t.creamSoft,
        }}>
          <BriefcaseIcon size={24} color={t.inkSoft} />
        </div>
        <div>
          <h2 style={{ fontFamily: f.sans, fontSize: 18, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>No job listings yet</h2>
          <p style={{ ...emptyNote, margin: "6px auto 0" }}>
            Post your first requirement and we&apos;ll score candidates who are actively practicing on HireStepX against it, usually in under a minute.
          </p>
        </div>
        {!suspended && <PrimaryLink href="/employer/requirements/new" icon={postIcon}>Create your first listing</PrimaryLink>}
      </div>,
    );
  }

  const filterControls = (
    <>
      <SearchWithSuggestions
        id="employer-jobs-search"
        label="Search jobs"
        value={search}
        onChange={setSearch}
        placeholder="Search by job title, location, or skill"
        storageKey={RECENT_SEARCHES_KEY}
        suggestedFilters={suggestedFilters}
        style={compact ? { flex: "1 1 160px", minWidth: 0 } : { flex: "1 1 240px", minWidth: 200, maxWidth: "50%" }}
      />
      <AdvancedFiltersPopover
        stageOptions={stageOptions}
        stage={stageFilter}
        onStageChange={setStageFilter}
        jobTypeOptions={jobTypeOptions}
        jobType={jobTypeFilter}
        onJobTypeChange={setJobTypeFilter}
        dueOptions={DUE_OPTIONS}
        due={dueFilter}
        onDueChange={setDueFilter}
        locationOptions={locationOptions}
        location={locationFilter}
        onLocationChange={setLocationFilter}
        departmentOptions={departmentOptions}
        department={departmentFilter}
        onDepartmentChange={setDepartmentFilter}
        experience={experienceFilter}
        onExperienceChange={setExperienceFilter}
        salary={salaryFilter}
        onSalaryChange={setSalaryFilter}
        activeCount={activeFilterCount}
      />
    </>
  );

  return shell(
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <JobHistoryDialog target={historyTarget} items={historyItems} loading={historyLoading} onClose={() => setHistoryTarget(null)} />
      <JobArchiveDialog
        target={archiveTarget}
        busy={archiveBusy}
        reason={archiveReason}
        onReasonChange={setArchiveReason}
        disposition={archiveDisposition}
        onDispositionChange={setArchiveDisposition}
        onConfirm={confirmArchive}
        onClose={() => setArchiveTarget(null)}
      />

      {/* Announces filter/search results without moving focus. */}
      <p role="status" className="sr-only">
        {filtered.length === 1 ? "1 job shown" : `${filtered.length} jobs shown`}
      </p>

      {requirementsError && requirements.length > 0 && (
        <div role="alert" style={{
          padding: "10px 18px", borderBottom: `1px solid ${t.line}`, background: t.error100, color: t.errorInk,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 500,
        }}>
          <AlertTriangleIcon size={14} aria-hidden="true" />
          Couldn&apos;t refresh your jobs. Showing the last loaded list.
          <Button
            type="button"
            variant="link"
            onClick={() => { void refreshRequirements(); }}
            className="pointer-coarse:h-11"
            style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "2px 4px", height: "auto", color: t.errorInk }}
          >
            Retry
          </Button>
        </div>
      )}

      {activeChips.length > 0 && (
        <div style={{ padding: "10px 18px 14px", borderBottom: `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.inkSoft }}>Active filters:</span>
          {activeChips.map((c) => (
            <FilterChip key={c.label} label={c.label} onRemove={c.remove} />
          ))}
          <Button
            type="button"
            variant="link"
            onClick={clearFilters}
            className="pointer-coarse:h-11"
            style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "2px 4px", height: "auto" }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Focusable so keyboard users can scroll the wide table (axe scrollable-region-focusable). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div role="region" aria-label="Jobs list" tabIndex={0} className="jobs-scroll" style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <TooltipProvider delayDuration={200}>
          {compact ? (
            <ul aria-label="Posted jobs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {pageRows.length === 0 && (
                <li style={{ padding: "32px 16px", textAlign: "center", fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>
                  {search.trim() ? `No results for "${search.trim()}"` : "No jobs match these filters"}
                  <div style={{ marginTop: 12 }}>
                    <Button variant="outline" className="pointer-coarse:h-11" onClick={clearFilters}>{onlySearchActive ? "Clear search" : "Clear filters"}</Button>
                  </div>
                </li>
              )}
              {pageRows.map((r) => (
                <JobCard key={r.id} r={r} readOnly={suspended} onStage={(stage) => changeStage(r.id, stage)} actions={rowActions(r)} />
              ))}
            </ul>
          ) : (
            <JobsTable
              rows={pageRows}
              hasAnyDepartment={hasAnyDepartment}
              sort={sort}
              onSortChange={setSort}
              readOnly={suspended}
              onStage={changeStage}
              onOpen={(href) => router.push(href)}
              rowActions={rowActions}
              search={search}
              onlySearchActive={onlySearchActive}
              onClear={clearFilters}
            />
          )}
        </TooltipProvider>
      </div>

      <TablePaginationFooter
        entityLabel="job"
        entityLabelPlural="jobs"
        totalCount={requirements.length}
        filteredCount={filtered.length}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={setRowsPerPage}
        page={pageSafe}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>,
    filterControls,
  );
}
