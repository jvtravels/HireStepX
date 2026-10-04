"use client";

/* /employer/jobs — the requirements console. Same card shell, toolbar,
   shadcn Table + SortableHead, and TablePaginationFooter as the
   candidate-side Jobs table (src/DashboardJobs.tsx) so both sides of the
   marketplace read as one product. Filtering, sorting, and pagination all
   run client-side over the requirements already loaded by EmployerDataContext.

   The row actions menu (Edit / Archive-Reopen / History) and the search
   suggestions dropdown (recent searches + suggested filters) match the
   "Opportunity List" Figma reference — see employer-requirement-detail.ts
   (archive/reopen) and employer-requirement-activity.ts (history) for the
   backing endpoints. Recent searches persist per-browser via localStorage
   only; there is no server-side record of search terms. */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  PlusIcon, SearchXIcon, ChevronRightIcon, BriefcaseIcon, SlidersHorizontalIcon,
  MoreVerticalIcon, PencilIcon, ArchiveIcon, ArchiveRestoreIcon, HistoryIcon, XIcon,
  EyeIcon, InfoIcon, LoaderCircleIcon, AlertTriangleIcon, RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import LoadingScreen from "@/_LoadingScreen";
import { useToast } from "@/Toast";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import { RequirementSummary, RequirementStage, ArchiveDisposition } from "@/employer/mockData";
import { Badge, type BadgeTone, StageCell, STAGE_LABEL, STAGE_OPTIONS } from "@/employer/_atoms";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import { formatNumber } from "@/utils";

const RECENT_SEARCHES_KEY = "hirestepx-employer-jobs-recent-searches";
const MotionTableRow = motion.create(TableRow);

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
  const lo = reqMin ?? -Infinity;
  const hi = reqMax ?? Infinity;
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

/* Single "Filters" trigger replacing the old row of six separate pills —
   everything (Stage/Job type/Due date as multi-select checkboxes,
   Location/Department as single-select, Experience as a range slider,
   Salary as min/max inputs) lives in one popover with a staged Apply, so
   nothing re-filters the table until the employer commits. Local to this
   page since no other screen shares this exact filter set. */
function AdvancedFiltersPopover({
  stageOptions,
  stage,
  onStageChange,
  jobTypeOptions,
  jobType,
  onJobTypeChange,
  dueOptions,
  due,
  onDueChange,
  locationOptions,
  location,
  onLocationChange,
  departmentOptions,
  department,
  onDepartmentChange,
  experience,
  onExperienceChange,
  experienceCap,
  salary,
  onSalaryChange,
  activeCount,
}: {
  stageOptions: string[];
  stage: string[];
  onStageChange: (v: string[]) => void;
  jobTypeOptions: string[];
  jobType: string[];
  onJobTypeChange: (v: string[]) => void;
  dueOptions: string[];
  due: string[];
  onDueChange: (v: string[]) => void;
  locationOptions: string[];
  location: string;
  onLocationChange: (v: string) => void;
  departmentOptions: string[];
  department: string;
  onDepartmentChange: (v: string) => void;
  experience: NumberRange;
  onExperienceChange: (v: NumberRange) => void;
  experienceCap: number;
  salary: NumberRange;
  onSalaryChange: (v: NumberRange) => void;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [draftStage, setDraftStage] = useState(stage);
  const [draftJobType, setDraftJobType] = useState(jobType);
  const [draftDue, setDraftDue] = useState(due);
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftDepartment, setDraftDepartment] = useState(department);
  const [draftExperience, setDraftExperience] = useState<NumberRange>(experience);
  const [draftSalary, setDraftSalary] = useState<NumberRange>(salary);

  const seedDraft = () => {
    setDraftStage(stage);
    setDraftJobType(jobType);
    setDraftDue(due);
    setDraftLocation(location);
    setDraftDepartment(department);
    setDraftExperience(experience);
    setDraftSalary(salary);
  };

  const toggle = (list: string[], value: string, setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const experienceRange: [number, number] = [
    draftExperience.min.trim() ? Number(draftExperience.min) : 0,
    draftExperience.max.trim() ? Number(draftExperience.max) : experienceCap,
  ];

  const handleReset = () => {
    setDraftStage([]);
    setDraftJobType([]);
    setDraftDue([]);
    setDraftLocation("");
    setDraftDepartment("");
    setDraftExperience(EMPTY_RANGE);
    setDraftSalary(EMPTY_RANGE);
  };

  const handleApply = () => {
    onStageChange(draftStage);
    onJobTypeChange(draftJobType);
    onDueChange(draftDue);
    onLocationChange(draftLocation);
    onDepartmentChange(draftDepartment);
    onExperienceChange(draftExperience);
    onSalaryChange(draftSalary);
    setOpen(false);
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontFamily: f.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
    textTransform: "uppercase", color: t.inkFaint, marginBottom: 10,
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) seedDraft(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 36, gap: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 13, fontWeight: 500, flexShrink: 0, transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = t.white; }}
        >
          <SlidersHorizontalIcon size={14} aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18,
                borderRadius: 9, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 11, fontWeight: 600, padding: "0 5px",
              }}
            >
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="gap-0" style={{ width: 320, padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.line}` }}>
          <span style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 700, color: t.coal }}>Advanced filters</span>
        </div>
        <ScrollArea style={{ height: "min(720px, calc(100vh - 160px))", minHeight: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={sectionLabelStyle}>Stage</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stageOptions.map((o) => (
                <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.coal, cursor: "pointer" }}>
                  <Checkbox checked={draftStage.includes(o)} onCheckedChange={() => toggle(draftStage, o, setDraftStage)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <div style={sectionLabelStyle}>Job type</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobTypeOptions.map((o) => (
                <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.coal, cursor: "pointer" }}>
                  <Checkbox checked={draftJobType.includes(o)} onCheckedChange={() => toggle(draftJobType, o, setDraftJobType)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <div style={sectionLabelStyle}>Due date</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dueOptions.map((o) => (
                <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.coal, cursor: "pointer" }}>
                  <Checkbox checked={draftDue.includes(o)} onCheckedChange={() => toggle(draftDue, o, setDraftDue)} />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <div style={sectionLabelStyle}>Location</div>
            <Select value={draftLocation || "__all"} onValueChange={(v) => setDraftLocation(v === "__all" ? "" : v)}>
              <SelectTrigger
                className="w-full border-border"
                style={{ height: 36, borderRadius: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}
              >
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All locations</SelectItem>
                {locationOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {departmentOptions.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>Department</div>
              <Select value={draftDepartment || "__all"} onValueChange={(v) => setDraftDepartment(v === "__all" ? "" : v)}>
                <SelectTrigger
                  className="w-full border-border"
                  style={{ height: 36, borderRadius: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}
                >
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All departments</SelectItem>
                  {departmentOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Separator />
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={sectionLabelStyle}>Experience required</span>
              <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
                {experienceRange[0]} – {experienceRange[1]} yrs
              </span>
            </div>
            <Slider
              min={0}
              max={experienceCap}
              step={1}
              value={experienceRange}
              onValueChange={([lo, hi]) =>
                setDraftExperience({ min: lo > 0 ? String(lo) : "", max: hi < experienceCap ? String(hi) : "" })
              }
            />
          </div>
          <Separator />
          <div>
            <div style={sectionLabelStyle}>Salary (LPA)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input
                type="number"
                value={draftSalary.min}
                onChange={(e) => setDraftSalary((d) => ({ ...d, min: e.target.value }))}
                placeholder="Min"
                style={{ height: 36 }}
              />
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, flexShrink: 0 }}>to</span>
              <Input
                type="number"
                value={draftSalary.max}
                onChange={(e) => setDraftSalary((d) => ({ ...d, max: e.target.value }))}
                placeholder="Max"
                style={{ height: 36 }}
              />
            </div>
          </div>
        </div>
        </ScrollArea>
        <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderTop: `1px solid ${t.line}` }}>
          <Button type="button" variant="outline" className="flex-1" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" className="flex-1" onClick={handleApply}>
            Apply filter
          </Button>
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
  const { requirements, requirementsLoading, requirementsError, refreshRequirements, archiveRequirement, reopenRequirement, updateRequirementStage, fetchRequirementActivity } = useEmployerData();

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
  const experienceCap = 40;

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
      if (dueFilter.length > 0 && !dueFilter.some((f) => matchesDueFilter(r, f))) return false;
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
      toast(isClosed ? "Couldn't reopen this job — please try again" : "Couldn't archive this job — please try again", "error");
    }
  };

  const changeStage = async (id: string, stage: RequirementStage) => {
    const ok = await updateRequirementStage(id, stage);
    if (!ok) toast("Couldn't update the stage — please try again", "error");
  };

  const renderHeading = (filters?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px", flexShrink: 0 }}>Jobs</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
        {filters}
        <Button size="lg" className="gap-2 px-4" onClick={() => router.push("/employer/requirements/new")}>
          <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
          Post a requirement
        </Button>
      </div>
    </div>
  );

  const shell = (body: React.ReactNode, filters?: React.ReactNode) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      {renderHeading(filters)}
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

  if (requirementsError && requirements.length === 0) {
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "72px 24px", flex: 1, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: t.error100, color: t.error,
        }}>
          <AlertTriangleIcon size={24} aria-hidden="true" />
        </div>
        <div>
          <p style={{ fontFamily: f.sans, fontSize: 18, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>Couldn't load your jobs</p>
          <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 380 }}>
            Something went wrong fetching your job listings. Your data is safe — check your connection and try again.
          </p>
        </div>
        <Button size="lg" className="gap-2 px-4" onClick={() => refreshRequirements()}>
          <RefreshCwIcon size={14} aria-hidden="true" />
          Retry
        </Button>
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
          size="lg"
          className="gap-2 px-4"
          onClick={() => router.push("/employer/requirements/new")}
        >
          <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
          Create your first listing
        </Button>
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
        style={{ flex: "1 1 240px", minWidth: 200, maxWidth: "50%" }}
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
        experienceCap={experienceCap}
        salary={salaryFilter}
        onSalaryChange={setSalaryFilter}
        activeCount={activeFilterCount}
      />
    </>
  );

  return shell(
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {historyDialog}
      {archiveDialog}

      {requirementsError && requirements.length > 0 && (
        <div style={{
          padding: "10px 18px", borderBottom: `1px solid ${t.line}`, background: t.error100, color: t.error,
          display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 500,
        }}>
          <AlertTriangleIcon size={14} aria-hidden="true" />
          Couldn't refresh your jobs — showing the last loaded list.
          <Button
            type="button"
            variant="link"
            onClick={() => refreshRequirements()}
            style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "2px 4px", height: "auto", color: t.error }}
          >
            Retry
          </Button>
        </div>
      )}

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
                after={<HeadInfo label="About Top Matches">The curated shortlist of highest-scoring candidates, with their average match score.</HeadInfo>}
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
                        className="h-10"
                        onClick={() => router.push("/employer/requirements/new")}
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
                          {r.aiScreening.totalMatched > r.aiScreening.evaluated
                            ? `Top ${r.aiScreening.evaluated} (of ${r.aiScreening.totalMatched} matched)`
                            : `${r.aiScreening.evaluated} evaluated`}
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
                          <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.successInk }}>{r.aiScreening.strongAvgScore}% avg match score</div>
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
    filterControls,
  );
}
