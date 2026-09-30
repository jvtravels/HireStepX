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
import { motion } from "motion/react";
import {
  PlusIcon, SearchIcon, SearchXIcon, ChevronDownIcon, ChevronRightIcon, BriefcaseIcon,
  MoreVerticalIcon, PencilIcon, ArchiveIcon, ArchiveRestoreIcon, HistoryIcon, ClockIcon, XIcon,
  EyeIcon, InfoIcon, LoaderCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import LoadingScreen from "@/_LoadingScreen";
import { useToast } from "@/Toast";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import { RequirementSummary, RequirementStatus, RequirementStage, ArchiveDisposition } from "@/employer/mockData";
import { Badge, type BadgeTone, StageCell, STAGE_LABEL } from "@/employer/_atoms";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import { formatNumber } from "@/utils";

const RECENT_SEARCHES_KEY = "hirestepx-employer-jobs-recent-searches";
const MAX_RECENT_SEARCHES = 5;
const MotionTableRow = motion.create(TableRow);

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

/** budgetMin/budgetMax's unit depends on salaryType — whole INR lakhs for
    per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
    asBoundedBudget in server-handlers/_employer-requirements-helpers.ts. */
function budgetLabel(req: RequirementSummary): string | null {
  const { budgetMin, budgetMax, salaryType } = req;
  if (budgetMin == null && budgetMax == null) return null;
  if (salaryType === "per-annum" || salaryType == null) {
    if (budgetMin != null && budgetMax != null) return `₹${budgetMin}–${budgetMax} LPA`;
    if (budgetMin != null) return `₹${budgetMin}+ LPA`;
    return `Up to ₹${budgetMax} LPA`;
  }
  const suffix = salaryType === "per-month" ? "/month" : " fixed";
  const fmt = (n: number) => `₹${formatNumber(n)}`;
  if (budgetMin != null && budgetMax != null) return `${fmt(budgetMin)}–${formatNumber(budgetMax)}${suffix}`;
  if (budgetMin != null) return `${fmt(budgetMin)}+${suffix}`;
  return `Up to ${fmt(budgetMax as number)}${suffix}`;
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
  stage_changed: "Stage updated",
};

const DUE_OPTIONS = ["Overdue", "Due within 7 days", "No due date"];
const ARCHIVE_REASONS = ["Position filled", "Budget cut", "Role on hold", "Other"];

interface NumberRange {
  min: string;
  max: string;
}

const EMPTY_RANGE: NumberRange = { min: "", max: "" };

/* A requirement's experience/salary is itself a range (experienceMin..Max) —
   this overlaps that range against the filter's range rather than requiring
   a single value to fall inside it, so a role spanning 2-5 yrs still matches
   a "3-10" filter. */
function rangesOverlap(reqMin: number | null, reqMax: number | null, filter: NumberRange): boolean {
  if (!filter.min.trim() && !filter.max.trim()) return true;
  if (reqMin == null && reqMax == null) return false;
  const filterMin = filter.min.trim() ? Number(filter.min) : -Infinity;
  const filterMax = filter.max.trim() ? Number(filter.max) : Infinity;
  const lo = reqMin ?? reqMax ?? -Infinity;
  const hi = reqMax ?? reqMin ?? Infinity;
  return lo <= filterMax && hi >= filterMin;
}

type SortColumn = "title" | "location" | "experience" | "stage" | "dueDate" | "matches" | "topMatches" | "created";
// Newest-posted-first — matches the order employer-requirements.ts already
// returns (created_at.desc), so the initial render isn't silently reordered
// by a due-date sort that's meaningless until a row actually has a due date.
const DEFAULT_SORT: Sort<SortColumn> = { column: "created", direction: "desc" };

const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Opportunity",
  location: "Location",
  experience: "Experience",
  stage: "Stage",
  dueDate: "Due Date",
  matches: "AI Screening",
  topMatches: "Top Matches",
  created: "Date posted",
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
    case "stage":
      return dir * STAGE_LABEL[a.stage].localeCompare(STAGE_LABEL[b.stage]);
    case "dueDate":
      return dir * (due(a) - due(b));
    case "matches":
      return dir * (a.aiScreening.evaluated - b.aiScreening.evaluated);
    case "topMatches":
      return dir * (a.aiScreening.topMatches - b.aiScreening.topMatches);
    case "created":
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

function RangeFilterPopover({
  label,
  unit,
  range,
  onChange,
}: {
  label: string;
  unit: string;
  range: NumberRange;
  onChange: (range: NumberRange) => void;
}) {
  const [draft, setDraft] = useState<NumberRange>(range);
  const active = range.min.trim() !== "" || range.max.trim() !== "";
  const display = active ? `${label}: ${range.min || "0"}–${range.max || "∞"} ${unit}` : label;
  return (
    <Popover onOpenChange={(open) => { if (open) setDraft(range); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 44, gap: 8, background: t.white, color: active ? t.coal : t.inkFaint, fontFamily: f.sans, fontSize: 13, fontWeight: 500, flexShrink: 0, transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = t.white; }}
        >
          {display}
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" style={{ width: 220 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Label htmlFor={`${label}-min`} className="text-xs">Min</Label>
              <Input
                id={`${label}-min`}
                type="number"
                value={draft.min}
                onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
                placeholder="0"
                style={{ height: 36 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Label htmlFor={`${label}-max`} className="text-xs">Max</Label>
              <Input
                id={`${label}-max`}
                type="number"
                value={draft.max}
                onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
                placeholder="Any"
                style={{ height: 36 }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {active && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft(EMPTY_RANGE); onChange(EMPTY_RANGE); }}>
                Clear
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => onChange(draft)}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HeadInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-flex", alignItems: "center", color: t.inkFaint, background: "transparent", border: "none", cursor: "pointer", padding: 8, margin: -6 }}
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
  if (!dueDate) return <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>—</span>;
  const left = daysUntil(dueDate);
  const tone: BadgeTone = left < 0 ? "error" : left <= 7 ? "warning" : "neutral";
  const label = left < 0 ? `${Math.abs(left)}d overdue` : left === 0 ? "Due today" : `${left}d left`;
  return (
    <div>
      <div style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{dueDate}</div>
      <div style={{ marginTop: 4, width: "fit-content" }}>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
}

/** "Strong Match" cell — overlapping avatar-initial chips for the candidates
    scoring at/above STRONG_MATCH_THRESHOLD. Hovering the chip stack shows a
    dark "Strong Matches" card (matches the canvas reference) listing each
    real candidate's name, years of experience, and skills — no fabricated
    data; candidates beyond the ones we have full profiles for are summed
    into a trailing "+N more" line using the real count. The group's average
    score is shown under Top Matches instead, since strongAvgScore is the
    average across that same top-matches group. */
function StrongMatchCell({ aiScreening }: { aiScreening: RequirementSummary["aiScreening"] }) {
  if (aiScreening.evaluated === 0) return <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>—</span>;
  if (aiScreening.strongMatches.length === 0) {
    return <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>None yet</span>;
  }
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${aiScreening.topMatches} strong match${aiScreening.topMatches === 1 ? "" : "es"} — view candidates`}
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", padding: 10, margin: -10, cursor: "pointer" }}
        >
          {aiScreening.strongMatches.map((candidate, i) => (
            <span
              key={candidate.id}
              style={{
                width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.sans, fontSize: 10, fontWeight: 600, color: t.indigoDeep, background: t.indigo100, border: `2px solid ${t.white}`,
                marginLeft: i === 0 ? 0 : -8,
              }}
            >
              {candidate.initials}
            </span>
          ))}
          {aiScreening.strongMatchExtra > 0 && (
            <span
              style={{
                width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.sans, fontSize: 10, fontWeight: 600, color: t.inkSoft, background: t.creamSoft, border: `2px solid ${t.white}`,
                marginLeft: -8,
              }}
            >
              +{aiScreening.strongMatchExtra}
            </span>
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        style={{ width: 288, maxWidth: "calc(100vw - 32px)", borderRadius: 12, border: `1px solid ${t.creamLine}`, background: t.coal, padding: 14, boxShadow: `0 12px 32px ${t.coalShadow}` }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: t.white, opacity: 0.6 }}>
            Strong Matches
          </span>
          <span
            style={{
              width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: f.sans, fontSize: 11, fontWeight: 600, color: t.coal, background: t.white,
            }}
          >
            {aiScreening.topMatches}
          </span>
        </div>
        <div style={{ marginTop: 10, borderTop: `1px solid ${t.creamLine}`, display: "flex", flexDirection: "column" }}>
          {aiScreening.strongMatches.filter((candidate) => candidate.name).map((candidate, i, arr) => (
            <div
              key={candidate.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${t.creamLine}` : "none",
              }}
            >
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {candidate.name}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.white, opacity: 0.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[candidate.yearsExperience != null ? `${candidate.yearsExperience} yrs` : null, ...candidate.skills.slice(0, 2)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <ChevronRightIcon size={14} color={t.white} style={{ opacity: 0.25, flexShrink: 0 }} aria-hidden="true" />
            </div>
          ))}
          {aiScreening.strongMatchExtra > 0 && (
            <div style={{ padding: "10px 0 0", fontFamily: f.sans, fontSize: textSize.xs, color: t.white, opacity: 0.55 }}>
              +{aiScreening.strongMatchExtra} more {aiScreening.strongMatchExtra === 1 ? "match" : "matches"}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, background: t.rowTint, fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal }}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, padding: 6, margin: -6, borderRadius: "50%", border: "none", background: "transparent", color: t.inkFaint, cursor: "pointer" }}
      >
        <XIcon size={11} aria-hidden="true" />
      </button>
    </span>
  );
}

export default function EmployerJobsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { requirements, requirementsLoading, archiveRequirement, reopenRequirement, updateRequirementStage, fetchRequirementActivity } = useEmployerData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState<NumberRange>(EMPTY_RANGE);
  const [salaryFilter, setSalaryFilter] = useState<NumberRange>(EMPTY_RANGE);
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [archiveTarget, setArchiveTarget] = useState<RequirementSummary | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveDisposition, setArchiveDisposition] = useState<ArchiveDisposition>("keep_candidates");
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
  const departmentOptions = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.department).filter((v): v is string => !!v))).sort(),
    [requirements],
  );
  const hasAnyDepartment = departmentOptions.length > 0;

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
      if (departmentFilter && r.department !== departmentFilter) return false;
      if (!matchesDueFilter(r, dueFilter)) return false;
      if (!rangesOverlap(r.experienceMin, r.experienceMax, experienceFilter)) return false;
      if (!rangesOverlap(r.budgetMin, r.budgetMax, salaryFilter)) return false;
      return true;
    });
    return [...list].sort((a, b) => compareRows(a, b, sort));
  }, [requirements, search, statusFilter, locationFilter, jobTypeFilter, departmentFilter, dueFilter, experienceFilter, salaryFilter, sort]);

  useEffect(() => { setPage(1); }, [search, statusFilter, locationFilter, jobTypeFilter, departmentFilter, dueFilter, experienceFilter, salaryFilter, sort, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setLocationFilter("");
    setJobTypeFilter("");
    setDepartmentFilter("");
    setDueFilter("");
    setExperienceFilter(EMPTY_RANGE);
    setSalaryFilter(EMPTY_RANGE);
  };

  const activeChips: Array<{ label: string; remove: () => void }> = [];
  if (search.trim()) activeChips.push({ label: `Search: "${search.trim()}"`, remove: () => setSearch("") });
  if (statusFilter) activeChips.push({ label: `Status: ${statusFilter}`, remove: () => setStatusFilter("") });
  if (locationFilter) activeChips.push({ label: `Location: ${locationFilter}`, remove: () => setLocationFilter("") });
  if (jobTypeFilter) activeChips.push({ label: `Job type: ${jobTypeFilter}`, remove: () => setJobTypeFilter("") });
  if (departmentFilter) activeChips.push({ label: `Department: ${departmentFilter}`, remove: () => setDepartmentFilter("") });
  if (dueFilter) activeChips.push({ label: `Due: ${dueFilter}`, remove: () => setDueFilter("") });
  if (experienceFilter.min || experienceFilter.max) {
    activeChips.push({ label: `Experience: ${experienceFilter.min || "0"}–${experienceFilter.max || "∞"} yrs`, remove: () => setExperienceFilter(EMPTY_RANGE) });
  }
  if (salaryFilter.min || salaryFilter.max) {
    activeChips.push({ label: `Salary: ${salaryFilter.min || "0"}–${salaryFilter.max || "∞"}`, remove: () => setSalaryFilter(EMPTY_RANGE) });
  }

  const onlySearchActive =
    search.trim() !== "" &&
    !statusFilter && !locationFilter && !jobTypeFilter && !departmentFilter && !dueFilter &&
    !experienceFilter.min && !experienceFilter.max && !salaryFilter.min && !salaryFilter.max;

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
      toast(isClosed ? "Couldn't reopen this job — please try again" : "Couldn't archive this job — please try again", "error");
    }
  };

  const changeStage = async (id: string, stage: RequirementStage) => {
    const ok = await updateRequirementStage(id, stage);
    if (!ok) toast("Couldn't update the stage — please try again", "error");
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
          fontFamily: f.sans,
          fontSize: textSize.lg,
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
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>History{historyTarget ? ` · ${historyTarget.title}` : ""}</DialogTitle>
          <DialogDescription>Every status change and edit made to this requirement.</DialogDescription>
        </DialogHeader>
        {historyLoading ? (
          <div style={{ padding: "24px 0", textAlign: "center", fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>Loading history…</div>
        ) : historyItems && historyItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 360, overflowY: "auto" }}>
            {historyItems.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "10px 2px", borderBottom: `1px solid ${t.line}` }}>
                <span style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 500, color: t.coal }}>{ACTIVITY_LABEL[a.action]}</span>
                <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, whiteSpace: "nowrap" }}>{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>No history recorded yet.</div>
        )}
      </DialogContent>
    </Dialog>
  );

  const archiveIsClosed = archiveTarget?.status === "closed";

  const archiveDialog = (
    <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{archiveIsClosed ? "Reopen this job?" : "Archive this job?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {archiveIsClosed
              ? `"${archiveTarget?.title}" will go back to matching candidates and can be edited again.`
              : `"${archiveTarget?.title}" will be closed to new matches and can't be edited until you reopen it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!archiveIsClosed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
            <div>
              <Label htmlFor="archive-reason" className="mb-1.5">Reason for archiving (optional)</Label>
              <Select value={archiveReason} onValueChange={setArchiveReason}>
                <SelectTrigger id="archive-reason" className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {ARCHIVE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">What happens to the remaining candidates?</Label>
              <RadioGroup value={archiveDisposition} onValueChange={(v) => setArchiveDisposition(v as ArchiveDisposition)}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <RadioGroupItem value="keep_candidates" id="disposition-keep" style={{ marginTop: 2 }} />
                  <Label htmlFor="disposition-keep" style={{ fontWeight: 400 }}>Keep candidate data — leave every candidate's status as-is</Label>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <RadioGroupItem value="reject_remaining" id="disposition-reject" style={{ marginTop: 2 }} />
                  <div>
                    <Label htmlFor="disposition-reject" style={{ fontWeight: 400 }}>Reject all remaining candidates</Label>
                    <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: "2px 0 0" }}>
                      Marks every candidate who isn't already hired, rejected, or marked not a fit as rejected.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmArchive} disabled={archiveBusy}>
            {archiveBusy ? "Working…" : archiveIsClosed ? "Reopen" : "Archive"}
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
          <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 380 }}>
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
                maxHeight: 320, overflowY: "auto",
              }}
            >
              {recentSearches.length > 0 && (
                <div style={{ marginBottom: suggestedFilters.length > 0 ? 10 : 0 }}>
                  <div style={{ padding: "0 12px 6px", fontFamily: f.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: t.inkFaint, textTransform: "uppercase" }}>
                    Recent searches
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setSearch(term); commitSearch(term); setSearchFocused(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: f.sans, fontSize: textSize.base, color: t.coal, borderRadius: 6 }}
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
                  <div style={{ padding: "0 12px 6px", fontFamily: f.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: t.inkFaint, textTransform: "uppercase" }}>
                    Suggested filters
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px" }}>
                    {suggestedFilters.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); s.apply(); setSearchFocused(false); }}
                        style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${t.line}`, background: t.white, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 500, color: t.coal, cursor: "pointer" }}
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
        {hasAnyDepartment && (
          <FilterPill label="Department" value={departmentFilter} options={departmentOptions} onChange={setDepartmentFilter} />
        )}
        <FilterPill label="Due date" value={dueFilter} options={DUE_OPTIONS} onChange={setDueFilter} />
        <RangeFilterPopover label="Experience" unit="yrs" range={experienceFilter} onChange={setExperienceFilter} />
        <RangeFilterPopover label="Salary" unit="LPA" range={salaryFilter} onChange={setSalaryFilter} />
      </div>

      {activeChips.length > 0 && (
        <div style={{ padding: "0 18px 14px", borderBottom: `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.inkFaint }}>Active filters:</span>
          {activeChips.map((c) => (
            <FilterChip key={c.label} label={c.label} onRemove={c.remove} />
          ))}
          <Button
            type="button"
            variant="link"
            onClick={clearFilters}
            style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "2px 4px", height: "auto" }}
          >
            Clear all
          </Button>
        </div>
      )}

      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <TooltipProvider delayDuration={200}>
        <Table aria-label="Posted jobs" className="table-fixed" style={{ width: "100%", minWidth: 1411 }}>
          <TableHeader>
            <TableRow style={{ background: t.rowTint, height: 40, position: "sticky", top: 0, zIndex: 1 }}>
              {/* table-fixed computes column widths from these first-row
                  declarations — but per-cell minWidth is NOT a reliable
                  floor when a column's own width is a percentage: Chrome
                  resolves the percentage against the table's rendered width
                  and can land below minWidth, silently truncating
                  SortableHead's ellipsis'd label (confirmed in production —
                  "AI Screening"/"Top Matches"/"Location"/"Due Date" all
                  clipped at typical viewport widths despite generous
                  minWidth). Fixed pixel widths don't have that ambiguity:
                  table-fixed honors them exactly, so every label gets
                  guaranteed room regardless of viewport. Opportunity
                  absorbs Department's pixels when there's no department
                  data to show, so hidden-column space isn't stranded. */}
              <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width={hasAnyDepartment ? 220 : 320} minWidth={190} sort={sort} onSortChange={setSort}>Opportunity</SortableHead>
              {hasAnyDepartment && (
                <TableHead style={{ width: 100, fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft }}>Department</TableHead>
              )}
              <SortableHead
                column="stage"
                columnLabel={COLUMN_LABEL.stage}
                width={175}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About stage">Where this posting is in your hiring pipeline — move it forward as you review candidates and interview.</HeadInfo>}
              >
                Stage
              </SortableHead>
              <SortableHead
                column="matches"
                columnLabel={COLUMN_LABEL.matches}
                width={165}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About AI Screening">How many candidates the AI has evaluated against this requirement, and the score range across them.</HeadInfo>}
              >
                AI Screening
              </SortableHead>
              <SortableHead
                column="topMatches"
                columnLabel={COLUMN_LABEL.topMatches}
                width={160}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About Top Matches">The curated shortlist of highest-scoring candidates, with their average evidence score.</HeadInfo>}
              >
                Top Matches
              </SortableHead>
              <TableHead style={{ width: 135, fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Strong Match
                  <HeadInfo label="About Strong Match">The best of the shortlist — candidates scoring highest against this requirement's evaluation criteria. Hover a candidate to see their experience and skills.</HeadInfo>
                </div>
              </TableHead>
              <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width={140} sort={sort} onSortChange={setSort}>Experience</SortableHead>
              <SortableHead column="location" columnLabel={COLUMN_LABEL.location} defaultDirection="asc" width={130} sort={sort} onSortChange={setSort}>Location</SortableHead>
              <SortableHead column="dueDate" columnLabel={COLUMN_LABEL.dueDate} defaultDirection="asc" width={130} sort={sort} onSortChange={setSort}>Due Date</SortableHead>
              <TableHead style={{ width: 56, minWidth: 56 }} aria-hidden="true" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasAnyDepartment ? 10 : 9} style={{ padding: "40px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <SearchXIcon size={22} color={t.inkFaint} aria-hidden="true" />
                    <p style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, margin: 0 }}>
                      {search.trim() ? `No results for "${search.trim()}"` : "No jobs match these filters"}
                    </p>
                    <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: 0 }}>
                      {search.trim() ? "Try a different search term, or clear it to see all your jobs." : "Try adjusting or clearing your filters."}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <Button variant="outline" onClick={clearFilters} style={{ borderRadius: 8, height: 40, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 500 }}>
                        {onlySearchActive ? "Clear search" : "Clear filters"}
                      </Button>
                      <Button
                        onClick={() => router.push("/employer/requirements/new")}
                        style={{ borderRadius: 8, height: 40, gap: 6, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, transition: `background ${dur.instant} ${ease.snap}` }}
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
            {pageRows.map((r, rowIndex) => {
              const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
              const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
              const exp = experienceLabel(r);
              const budget = budgetLabel(r);
              const href = `/employer/requirements/${r.id}`;
              const isClosed = r.status === "closed";
              return (
                <MotionTableRow
                  key={r.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: rowIndex * 0.03 }}
                  onClick={() => router.push(href)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  style={{ cursor: "pointer", minHeight: 72, transition: `background ${dur.instant} ${ease.snap}` }}
                >
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <button type="button" className="sr-only" onClick={() => router.push(href)}>
                      {`View ${r.title}`}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{r.title}</div>
                      {isClosed && <Badge tone="neutral">Closed</Badge>}
                    </div>
                    {(budget || jobType) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, marginTop: 2 }}>
                        <span>{[budget, jobType].filter(Boolean).join(" · ")}</span>
                        {(r.durationWeeks != null || r.hoursPerWeek != null) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: "inline-flex", alignItems: "center", color: t.inkFaint, background: "none", border: "none", padding: 8, margin: -8, cursor: "pointer" }}
                              >
                                <InfoIcon size={13} aria-hidden="true" />
                                <span className="sr-only">Duration and hours details</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {[
                                r.durationWeeks != null ? `${r.durationWeeks} ${r.durationWeeks === 1 ? "week" : "weeks"}` : null,
                                r.hoursPerWeek != null ? `${r.hoursPerWeek} hrs/week` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                    {r.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {r.skills.slice(0, 3).map((s) => (
                          <span key={s} style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.inkSoft, background: t.creamSoft, padding: "2px 7px", borderRadius: 999 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {hasAnyDepartment && (
                    <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                      {r.department ? (
                        <span style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.coal }}>{r.department}</span>
                      ) : (
                        <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StageCell
                      stage={r.stage}
                      hasEvaluatedCandidates={r.aiScreening.evaluated > 0}
                      onChange={(stage) => changeStage(r.id, stage)}
                      frozen={isClosed}
                    />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.status === "generating" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <LoaderCircleIcon size={12} className="animate-spin" color={t.inkFaint} aria-hidden="true" />
                        <Badge tone="brand">Finding candidates</Badge>
                      </div>
                    ) : r.aiScreening.evaluated === 0 ? (
                      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>—</span>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>
                          <EyeIcon size={13} color={t.inkFaint} aria-hidden="true" />
                          {r.aiScreening.evaluated} evaluated
                        </div>
                        {r.aiScreening.scoreLow != null && r.aiScreening.scoreHigh != null && (
                          <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, marginTop: 1 }}>
                            Score range {r.aiScreening.scoreLow}–{r.aiScreening.scoreHigh}%
                          </div>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.aiScreening.evaluated === 0 ? (
                      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>—</span>
                    ) : r.aiScreening.topMatches > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <Badge tone="info">Top {r.aiScreening.topMatches}</Badge>
                        {r.aiScreening.strongAvgScore != null && (
                          <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.successInk }}>{r.aiScreening.strongAvgScore}% avg evidence score</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>None yet</span>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StrongMatchCell aiScreening={r.aiScreening} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {exp ? <Badge tone="info">{exp}</Badge> : <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>Any</span>}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <div style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{locationText(r) || "Not specified"}</div>
                    {mode && <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, marginTop: 1 }}>{mode}</div>}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <DueCell dueDate={r.dueDate} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 10px", verticalAlign: "top", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${r.title}`} style={{ height: 36, width: 36, color: t.inkFaint }}>
                          <MoreVerticalIcon size={16} aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem disabled={isClosed} onSelect={() => router.push(`/employer/requirements/${r.id}/edit`)}>
                          <PencilIcon className="size-4" aria-hidden="true" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openArchive(r)}>
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
                </MotionTableRow>
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
