"use client";

/* /employer/jobs — the requirements console. Same card shell, toolbar,
   shadcn Table + SortableHead, FilterPill, and TablePaginationFooter as the
   candidate-side Jobs table (src/DashboardJobs.tsx) so both sides of the
   marketplace read as one product. Filtering, sorting, and pagination all
   run client-side over the requirements already loaded by EmployerDataContext.

   The row actions menu (Edit / Archive-Reopen / History) and the search
   suggestions dropdown (recent searches + suggested filters) match the
   "Opportunity List" Figma reference — see employer-requirement-detail.ts
   (archive/reopen) and employer-requirement-activity.ts (history) for the
   backing endpoints. Recent searches persist per-browser via localStorage
   only; there is no server-side record of search terms. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon, SearchIcon, SearchXIcon, ChevronDownIcon, BriefcaseIcon,
  MoreVerticalIcon, PencilIcon, ArchiveIcon, ArchiveRestoreIcon, HistoryIcon, ClockIcon, XIcon,
  EyeIcon, InfoIcon, LoaderCircleIcon, CircleCheckIcon, CircleAlertIcon, CircleXIcon, CircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import LoadingScreen from "@/_LoadingScreen";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import { RequirementSummary, RequirementStatus } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";

const RECENT_SEARCHES_KEY = "hirestepx-employer-jobs-recent-searches";
const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(list: string[]): void {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // best-effort — private browsing / blocked storage just means no persistence
  }
}

function experienceLabel(req: RequirementSummary): string | null {
  const { experienceMin, experienceMax } = req;
  if (experienceMin == null && experienceMax == null) return null;
  if (experienceMin != null && experienceMax != null) return `${experienceMin}–${experienceMax} yrs`;
  if (experienceMin != null) return `${experienceMin}+ yrs`;
  return `Up to ${experienceMax} yrs`;
}

function budgetLabel(req: RequirementSummary): string | null {
  const { budgetMin, budgetMax } = req;
  if (budgetMin == null && budgetMax == null) return null;
  if (budgetMin != null && budgetMax != null) return `₹${budgetMin}–${budgetMax} LPA`;
  if (budgetMin != null) return `₹${budgetMin}+ LPA`;
  return `Up to ₹${budgetMax} LPA`;
}

function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

function locationText(req: RequirementSummary): string {
  return req.locations.length > 0 ? req.locations.join(", ") : req.location;
}

const STATUS_LABEL: Record<RequirementStatus, string> = {
  generating: "Generating",
  ready: "Shortlist ready",
  partial: "Partial match",
  zero: "No matches yet",
  failed: "Generation failed",
  closed: "Closed",
};

const ACTIVITY_LABEL: Record<RequirementActivity["action"], string> = {
  created: "Job posted",
  updated: "Details updated",
  archived: "Archived",
  reopened: "Reopened",
};

const DUE_OPTIONS = ["Overdue", "Due within 7 days", "No due date"];

type SortColumn = "title" | "location" | "experience" | "status" | "dueDate" | "matches" | "topMatches" | "posted";
const DEFAULT_SORT: Sort<SortColumn> = { column: "posted", direction: "desc" };

const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Job title",
  location: "Location",
  experience: "Experience",
  status: "Status",
  dueDate: "Due date",
  matches: "AI Screening",
  topMatches: "Top Matches",
  posted: "Posted",
};

function compareRows(a: RequirementSummary, b: RequirementSummary, sort: Sort<SortColumn>): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  const due = (r: RequirementSummary) => (r.dueDate ? new Date(`${r.dueDate}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY);
  switch (sort.column) {
    case "title":
      return dir * a.title.localeCompare(b.title);
    case "location":
      return dir * locationText(a).localeCompare(locationText(b));
    case "experience":
      return dir * ((a.experienceMin ?? a.experienceMax ?? -1) - (b.experienceMin ?? b.experienceMax ?? -1));
    case "status":
      return dir * STATUS_LABEL[a.status].localeCompare(STATUS_LABEL[b.status]);
    case "dueDate":
      return dir * (due(a) - due(b));
    case "matches":
      return dir * (a.aiScreening.evaluated - b.aiScreening.evaluated);
    case "topMatches":
      return dir * (a.aiScreening.topMatches - b.aiScreening.topMatches);
    case "posted":
      return dir * a.createdAt.localeCompare(b.createdAt);
  }
}

function matchesDueFilter(req: RequirementSummary, filter: string): boolean {
  if (!filter) return true;
  if (filter === "No due date") return !req.dueDate;
  if (!req.dueDate) return false;
  const left = daysUntil(req.dueDate);
  if (filter === "Overdue") return left < 0;
  return left >= 0 && left <= 7;
}

function FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const display = value ? `${label}: ${value}` : label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 44, gap: 8, background: t.white, color: value ? t.coal : t.inkFaint, fontFamily: f.sans, fontSize: 13, fontWeight: 500, flexShrink: 0, transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = t.white; }}
        >
          {display}
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o} value={o}>
              {o}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type BadgeTone = "neutral" | "success" | "brand" | "info" | "warning" | "error";
const BADGE_TONE: Record<BadgeTone, { color: string; background: string }> = {
  neutral: { color: t.inkSoft, background: t.creamSoft },
  success: { color: t.successInk, background: t.success100 },
  brand: { color: t.indigoDeep, background: t.indigo100 },
  info: { color: t.info, background: t.info100 },
  warning: { color: t.warningInk, background: t.warning100 },
  error: { color: t.errorInk, background: t.error100 },
};

const STATUS_TONE: Record<RequirementStatus, BadgeTone> = {
  generating: "brand",
  ready: "success",
  partial: "warning",
  zero: "neutral",
  failed: "error",
  closed: "neutral",
};

const STATUS_ICON: Record<RequirementStatus, typeof CircleIcon> = {
  generating: LoaderCircleIcon,
  ready: CircleCheckIcon,
  partial: CircleAlertIcon,
  zero: CircleIcon,
  failed: CircleXIcon,
  closed: ArchiveIcon,
};

function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const { color, background } = BADGE_TONE[tone];
  return (
    <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color, background, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/** Outline badge + icon, matching the canvas design's Stage-column treatment.
    Kept on the real per-posting status (not a fabricated hiring-pipeline
    stage — there's no interview/hire tracking in the data model yet). */
function StatusBadge({ status }: { status: RequirementStatus }) {
  const { color } = BADGE_TONE[STATUS_TONE[status]];
  const StatusIcon = STATUS_ICON[status];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600,
        color, border: `1px solid ${t.line}`, padding: "3px 9px 3px 7px", borderRadius: 999, whiteSpace: "nowrap",
      }}
    >
      <StatusIcon size={12} className={status === "generating" ? "animate-spin" : undefined} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function HeadInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-flex", alignItems: "center", color: t.inkFaint, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
        >
          <InfoIcon size={12} aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function DueCell({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>—</span>;
  const left = daysUntil(dueDate);
  const tone: BadgeTone = left < 0 ? "error" : left <= 7 ? "warning" : "neutral";
  const label = left < 0 ? `${Math.abs(left)}d overdue` : left === 0 ? "Due today" : `${left}d left`;
  return (
    <div>
      <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{dueDate}</div>
      <div style={{ marginTop: 4, width: "fit-content" }}>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
}

/** "Strong Match" cell — overlapping avatar-initial chips for the candidates
    scoring at/above STRONG_MATCH_THRESHOLD. The group's average score is
    shown under Top Matches instead (see the canvas reference), since
    strongAvgScore is the average across that same top-matches group. */
function StrongMatchCell({ aiScreening }: { aiScreening: RequirementSummary["aiScreening"] }) {
  if (aiScreening.evaluated === 0) return <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>—</span>;
  if (aiScreening.strongMatchInitials.length === 0) {
    return <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>None yet</span>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {aiScreening.strongMatchInitials.map((initials, i) => (
        <span
          key={i}
          style={{
            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600, color: t.indigoDeep, background: t.indigo100, border: `2px solid ${t.white}`,
            marginLeft: i === 0 ? 0 : -8,
          }}
        >
          {initials}
        </span>
      ))}
      {aiScreening.strongMatchExtra > 0 && (
        <span
          style={{
            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600, color: t.inkSoft, background: t.creamSoft, border: `2px solid ${t.white}`,
            marginLeft: -8,
          }}
        >
          +{aiScreening.strongMatchExtra}
        </span>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, background: t.rowTint, fontFamily: f.sans, fontSize: 12.5, fontWeight: 500, color: t.coal }}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: "none", background: "transparent", color: t.inkFaint, cursor: "pointer" }}
      >
        <XIcon size={11} aria-hidden="true" />
      </button>
    </span>
  );
}

export default function EmployerJobsPage() {
  const router = useRouter();
  const { requirements, requirementsLoading, archiveRequirement, reopenRequirement, fetchRequirementActivity } = useEmployerData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [archiveTarget, setArchiveTarget] = useState<RequirementSummary | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<RequirementSummary | null>(null);
  const [historyItems, setHistoryItems] = useState<RequirementActivity[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => { setRecentSearches(loadRecentSearches()); }, []);

  const commitSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
  };

  const statusOptions = useMemo(
    () => Array.from(new Set(requirements.map((r) => STATUS_LABEL[r.status]))),
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

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    const firstStatus = statusOptions.find((o) => o !== statusFilter);
    if (firstStatus) suggestions.push({ label: `Status: ${firstStatus}`, apply: () => setStatusFilter(firstStatus) });
    const firstJobType = jobTypeOptions.find((o) => o !== jobTypeFilter);
    if (firstJobType) suggestions.push({ label: `Type: ${firstJobType}`, apply: () => setJobTypeFilter(firstJobType) });
    const firstLocation = locationOptions.find((o) => o !== locationFilter);
    if (firstLocation) suggestions.push({ label: `Location: ${firstLocation}`, apply: () => setLocationFilter(firstLocation) });
    return suggestions.slice(0, 4);
  }, [statusOptions, jobTypeOptions, locationOptions, statusFilter, jobTypeFilter, locationFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = requirements.filter((r) => {
      if (q && !`${r.title} ${locationText(r)} ${r.skills.join(" ")}`.toLowerCase().includes(q)) return false;
      if (statusFilter && STATUS_LABEL[r.status] !== statusFilter) return false;
      if (locationFilter && !(r.locations.length > 0 ? r.locations : [r.location]).includes(locationFilter)) return false;
      if (jobTypeFilter && (r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null) !== jobTypeFilter) return false;
      if (!matchesDueFilter(r, dueFilter)) return false;
      return true;
    });
    return [...list].sort((a, b) => compareRows(a, b, sort));
  }, [requirements, search, statusFilter, locationFilter, jobTypeFilter, dueFilter, sort]);

  useEffect(() => { setPage(1); }, [search, statusFilter, locationFilter, jobTypeFilter, dueFilter, sort, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setLocationFilter("");
    setJobTypeFilter("");
    setDueFilter("");
  };

  const activeChips: Array<{ label: string; remove: () => void }> = [];
  if (search.trim()) activeChips.push({ label: `Search: "${search.trim()}"`, remove: () => setSearch("") });
  if (statusFilter) activeChips.push({ label: `Status: ${statusFilter}`, remove: () => setStatusFilter("") });
  if (locationFilter) activeChips.push({ label: `Location: ${locationFilter}`, remove: () => setLocationFilter("") });
  if (jobTypeFilter) activeChips.push({ label: `Job type: ${jobTypeFilter}`, remove: () => setJobTypeFilter("") });
  if (dueFilter) activeChips.push({ label: `Due: ${dueFilter}`, remove: () => setDueFilter("") });

  const onlySearchActive = search.trim() !== "" && !statusFilter && !locationFilter && !jobTypeFilter && !dueFilter;

  const openHistory = async (r: RequirementSummary) => {
    setHistoryTarget(r);
    setHistoryItems(null);
    setHistoryLoading(true);
    const activity = await fetchRequirementActivity(r.id);
    setHistoryItems(activity ?? []);
    setHistoryLoading(false);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    const isClosed = archiveTarget.status === "closed";
    const ok = isClosed ? await reopenRequirement(archiveTarget.id) : await archiveRequirement(archiveTarget.id);
    setArchiveBusy(false);
    if (ok) setArchiveTarget(null);
  };

  const heading = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Jobs</h1>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkFaint, margin: "2px 0 0" }}>
          Every requirement you've posted, with the candidates HireStepX has matched to each.
        </p>
      </div>
      <Button
        onClick={() => router.push("/employer/requirements/new")}
        style={{
          background: t.indigo,
          color: t.white,
          borderRadius: 8,
          padding: "12px 20px",
          height: 44,
          gap: 8,
          fontSize: 15,
          fontWeight: 600,
          boxShadow: `0px 2px 4px color-mix(in srgb, ${t.indigo} 20%, transparent)`,
        }}
      >
        <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
        Post a requirement
      </Button>
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      {heading}
      {body}
    </div>
  );

  const historyDialog = (
    <Dialog open={!!historyTarget} onOpenChange={(open) => { if (!open) setHistoryTarget(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>History{historyTarget ? ` · ${historyTarget.title}` : ""}</DialogTitle>
          <DialogDescription>Every status change and edit made to this requirement.</DialogDescription>
        </DialogHeader>
        {historyLoading ? (
          <div style={{ padding: "24px 0", textAlign: "center", fontFamily: f.sans, fontSize: 13.5, color: t.inkFaint }}>Loading history…</div>
        ) : historyItems && historyItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 360, overflowY: "auto" }}>
            {historyItems.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "10px 2px", borderBottom: `1px solid ${t.line}` }}>
                <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 500, color: t.coal }}>{ACTIVITY_LABEL[a.action]}</span>
                <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, whiteSpace: "nowrap" }}>{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", fontFamily: f.sans, fontSize: 13.5, color: t.inkFaint }}>No history recorded yet.</div>
        )}
      </DialogContent>
    </Dialog>
  );

  const archiveDialog = (
    <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{archiveTarget?.status === "closed" ? "Reopen this job?" : "Archive this job?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {archiveTarget?.status === "closed"
              ? `"${archiveTarget?.title}" will go back to matching candidates and can be edited again.`
              : `"${archiveTarget?.title}" will be closed to new matches and can't be edited until you reopen it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmArchive} disabled={archiveBusy}>
            {archiveBusy ? "Working…" : archiveTarget?.status === "closed" ? "Reopen" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (requirementsLoading) {
    return shell(
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <LoadingScreen fullScreen={false} message="Loading your jobs…" />
      </div>,
    );
  }

  if (requirements.length === 0) {
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "72px 24px", flex: 1, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          border: `1.5px dashed ${t.line}`, background: t.creamSoft,
        }}>
          <BriefcaseIcon size={24} color={t.inkFaint} aria-hidden="true" />
        </div>
        <div>
          <p style={{ fontFamily: f.sans, fontSize: 18, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>No job listings yet</p>
          <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkFaint, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 380 }}>
            Post your first requirement and we'll score candidates who are actively practicing on HireStepX against it, usually in under a minute.
          </p>
        </div>
        <Button
          onClick={() => router.push("/employer/requirements/new")}
          style={{
            marginTop: 4, borderRadius: 8, height: 44, gap: 8, padding: "0 22px",
            background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 14, fontWeight: 600,
            transition: `background ${dur.instant} ${ease.snap}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.indigoDeep; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = t.indigo; }}
        >
          <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
          Create your first listing
        </Button>
      </div>,
    );
  }

  return shell(
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {historyDialog}
      {archiveDialog}
      <div style={{ padding: "16px 18px", borderBottom: activeChips.length > 0 ? "none" : `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div ref={searchWrapRef} style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <label htmlFor="employer-jobs-search" className="sr-only">Search jobs</label>
          <SearchIcon size={14} color={t.inkFaint} aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <Input
            id="employer-jobs-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
            onKeyDown={(e) => { if (e.key === "Enter") { commitSearch(search); (e.target as HTMLInputElement).blur(); } }}
            placeholder="Search by job title, location, or skill"
            style={{ paddingLeft: 32, height: 44, borderRadius: 8, background: t.white }}
          />
          {searchFocused && (recentSearches.length > 0 || suggestedFilters.length > 0) && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
                background: t.white, border: `1px solid ${t.line}`, borderRadius: 10,
                boxShadow: "0px 8px 24px rgba(20, 20, 43, 0.12)", padding: "12px 4px",
              }}
            >
              {recentSearches.length > 0 && (
                <div style={{ marginBottom: suggestedFilters.length > 0 ? 10 : 0 }}>
                  <div style={{ padding: "0 12px 6px", fontFamily: f.sans, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: t.inkFaint, textTransform: "uppercase" }}>
                    Recent searches
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setSearch(term); commitSearch(term); setSearchFocused(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: f.sans, fontSize: 13.5, color: t.coal, borderRadius: 6 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <ClockIcon size={13} color={t.inkFaint} aria-hidden="true" />
                      {term}
                    </button>
                  ))}
                </div>
              )}
              {suggestedFilters.length > 0 && (
                <div>
                  <div style={{ padding: "0 12px 6px", fontFamily: f.sans, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: t.inkFaint, textTransform: "uppercase" }}>
                    Suggested filters
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px" }}>
                    {suggestedFilters.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); s.apply(); setSearchFocused(false); }}
                        style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${t.line}`, background: t.white, fontFamily: f.sans, fontSize: 12.5, fontWeight: 500, color: t.coal, cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = t.white; }}
                      >
                        + {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <FilterPill label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
        <FilterPill label="Location" value={locationFilter} options={locationOptions} onChange={setLocationFilter} />
        <FilterPill label="Job type" value={jobTypeFilter} options={jobTypeOptions} onChange={setJobTypeFilter} />
        <FilterPill label="Due date" value={dueFilter} options={DUE_OPTIONS} onChange={setDueFilter} />
      </div>

      {activeChips.length > 0 && (
        <div style={{ padding: "0 18px 14px", borderBottom: `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.inkFaint }}>Active filters:</span>
          {activeChips.map((c) => (
            <FilterChip key={c.label} label={c.label} onRemove={c.remove} />
          ))}
          <Button
            type="button"
            variant="link"
            onClick={clearFilters}
            style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, padding: "2px 4px", height: "auto" }}
          >
            Clear all
          </Button>
        </div>
      )}

      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <TooltipProvider delayDuration={200}>
        <Table aria-label="Posted jobs" className="table-fixed">
          <TableHeader>
            <TableRow style={{ background: t.rowTint, height: 40, position: "sticky", top: 0, zIndex: 1 }}>
              <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width="18%" minWidth={200} sort={sort} onSortChange={setSort}>Job title</SortableHead>
              <SortableHead
                column="status"
                columnLabel={COLUMN_LABEL.status}
                defaultDirection="asc"
                width="10%"
                minWidth={110}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About status">Where this posting currently stands — generating candidates, matches ready, or closed to new applicants.</HeadInfo>}
              >
                Status
              </SortableHead>
              <SortableHead
                column="matches"
                columnLabel={COLUMN_LABEL.matches}
                width="13%"
                minWidth={140}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About AI Screening">How many candidates the AI has evaluated against this requirement, and the score range across them.</HeadInfo>}
              >
                AI Screening
              </SortableHead>
              <SortableHead
                column="topMatches"
                columnLabel={COLUMN_LABEL.topMatches}
                width="9%"
                minWidth={90}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About Top Matches">The curated shortlist of highest-scoring candidates, with their average evidence score.</HeadInfo>}
              >
                Top Matches
              </SortableHead>
              <TableHead style={{ width: "11%", minWidth: 120, fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Strong Match
                  <HeadInfo label="About Strong Match">The best of the shortlist — candidates scoring highest against this requirement's evaluation criteria.</HeadInfo>
                </div>
              </TableHead>
              <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width="7%" minWidth={80} sort={sort} onSortChange={setSort}>Experience</SortableHead>
              <SortableHead column="location" columnLabel={COLUMN_LABEL.location} defaultDirection="asc" width="9%" minWidth={110} sort={sort} onSortChange={setSort}>Location</SortableHead>
              <SortableHead column="dueDate" columnLabel={COLUMN_LABEL.dueDate} defaultDirection="asc" width="8%" minWidth={100} sort={sort} onSortChange={setSort}>Due date</SortableHead>
              <SortableHead column="posted" columnLabel={COLUMN_LABEL.posted} width="8%" minWidth={90} sort={sort} onSortChange={setSort}>Posted</SortableHead>
              <TableHead style={{ width: "7%", minWidth: 64, fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft, textAlign: "right", paddingRight: 20 }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} style={{ padding: "40px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <SearchXIcon size={22} color={t.inkFaint} aria-hidden="true" />
                    <p style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal, margin: 0 }}>
                      {search.trim() ? `No results for "${search.trim()}"` : "No jobs match these filters"}
                    </p>
                    <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, margin: 0 }}>
                      {search.trim() ? "Try a different search term, or clear it to see all your jobs." : "Try adjusting or clearing your filters."}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <Button variant="outline" onClick={clearFilters} style={{ borderRadius: 8, height: 40, fontFamily: f.sans, fontSize: 12.5, fontWeight: 500 }}>
                        {onlySearchActive ? "Clear search" : "Clear filters"}
                      </Button>
                      <Button
                        onClick={() => router.push("/employer/requirements/new")}
                        style={{ borderRadius: 8, height: 40, gap: 6, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, transition: `background ${dur.instant} ${ease.snap}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.indigoDeep; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = t.indigo; }}
                      >
                        <PlusIcon size={14} strokeWidth={2.5} aria-hidden="true" />
                        Create
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => {
              const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
              const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
              const exp = experienceLabel(r);
              const budget = budgetLabel(r);
              const href = `/employer/requirements/${r.id}`;
              const isClosed = r.status === "closed";
              return (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(href)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  style={{ cursor: "pointer", minHeight: 72, transition: `background ${dur.instant} ${ease.snap}` }}
                >
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <button type="button" className="sr-only" onClick={() => router.push(href)}>
                      {`View ${r.title}`}
                    </button>
                    <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{r.title}</div>
                    {(budget || jobType || r.openPositions != null) && (
                      <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 2 }}>
                        {[jobType, budget, r.openPositions != null ? `${r.openPositions} ${r.openPositions === 1 ? "opening" : "openings"}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    {r.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {r.skills.slice(0, 3).map((s) => (
                          <span key={s} style={{ fontSize: textSize.xs, color: t.inkSoft, background: t.creamSoft, padding: "2px 7px", borderRadius: 999 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.status === "generating" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <LoaderCircleIcon size={12} className="animate-spin" color={t.inkFaint} aria-hidden="true" />
                        <Badge tone="brand">Finding candidates</Badge>
                      </div>
                    ) : r.aiScreening.evaluated === 0 ? (
                      <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>—</span>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>
                          <EyeIcon size={13} color={t.inkFaint} aria-hidden="true" />
                          {r.aiScreening.evaluated} evaluated
                        </div>
                        {r.aiScreening.scoreLow != null && r.aiScreening.scoreHigh != null && (
                          <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 1 }}>
                            Score range {r.aiScreening.scoreLow}–{r.aiScreening.scoreHigh}%
                          </div>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.aiScreening.evaluated === 0 ? (
                      <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>—</span>
                    ) : r.aiScreening.topMatches > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <Badge tone="info">Top {r.aiScreening.topMatches}</Badge>
                        {r.aiScreening.strongAvgScore != null && (
                          <div style={{ fontSize: textSize.xs, color: t.successInk }}>{r.aiScreening.strongAvgScore}% avg evidence score</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>None yet</span>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StrongMatchCell aiScreening={r.aiScreening} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", fontSize: textSize.md, fontWeight: 500, color: t.coal, verticalAlign: "top", whiteSpace: "normal" }}>
                    {exp || "Any"}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{locationText(r) || "Not specified"}</div>
                    {mode && <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 1 }}>{mode}</div>}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <DueCell dueDate={r.dueDate} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", fontSize: textSize.md, fontWeight: 500, color: t.coal, verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.createdAt}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${r.title}`} style={{ height: 32, width: 32, color: t.inkFaint }}>
                          <MoreVerticalIcon size={16} aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem disabled={isClosed} onSelect={() => router.push(`/employer/requirements/${r.id}/edit`)}>
                          <PencilIcon className="size-4" aria-hidden="true" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setArchiveTarget(r)}>
                          {isClosed ? (
                            <>
                              <ArchiveRestoreIcon className="size-4" aria-hidden="true" /> Reopen
                            </>
                          ) : (
                            <>
                              <ArchiveIcon className="size-4" aria-hidden="true" /> Archive
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => openHistory(r)}>
                          <HistoryIcon className="size-4" aria-hidden="true" /> History
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
  );
}
