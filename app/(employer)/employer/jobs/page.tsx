"use client";

/* /employer/jobs — the requirements console. Same card shell, toolbar,
   shadcn Table + SortableHead, FilterPill, and TablePaginationFooter as the
   candidate-side Jobs table (src/DashboardJobs.tsx) so both sides of the
   marketplace read as one product. Filtering, sorting, and pagination all
   run client-side over the requirements already loaded by EmployerDataContext. */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon, SearchXIcon, ChevronDownIcon, BriefcaseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import LoadingScreen from "@/_LoadingScreen";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { RequirementSummary, RequirementStatus } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";

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

const DUE_OPTIONS = ["Overdue", "Due within 7 days", "No due date"];

type SortColumn = "title" | "location" | "experience" | "status" | "dueDate" | "matches" | "posted";
const DEFAULT_SORT: Sort<SortColumn> = { column: "posted", direction: "desc" };

const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Job title",
  location: "Location",
  experience: "Experience",
  status: "Status",
  dueDate: "Due date",
  matches: "Matches",
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
      return dir * (a.candidateCount - b.candidateCount);
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

function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const { color, background } = BADGE_TONE[tone];
  return (
    <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color, background, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {children}
    </span>
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

export default function EmployerJobsPage() {
  const router = useRouter();
  const { requirements, requirementsLoading } = useEmployerData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
            background: t.coal, color: t.white, fontFamily: f.sans, fontSize: 14, fontWeight: 600,
          }}
        >
          <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
          Create your first listing
        </Button>
      </div>,
    );
  }

  return shell(
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <label htmlFor="employer-jobs-search" className="sr-only">Search jobs</label>
          <SearchIcon size={14} color={t.inkFaint} aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <Input
            id="employer-jobs-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job title, location, or skill"
            style={{ paddingLeft: 32, height: 44, borderRadius: 8, background: t.white }}
          />
        </div>
        <FilterPill label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
        <FilterPill label="Location" value={locationFilter} options={locationOptions} onChange={setLocationFilter} />
        <FilterPill label="Job type" value={jobTypeFilter} options={jobTypeOptions} onChange={setJobTypeFilter} />
        <FilterPill label="Due date" value={dueFilter} options={DUE_OPTIONS} onChange={setDueFilter} />
      </div>

      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <Table aria-label="Posted jobs" className="table-fixed">
          <TableHeader>
            <TableRow style={{ background: t.rowTint, height: 40, position: "sticky", top: 0, zIndex: 1 }}>
              <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width="26%" minWidth={240} sort={sort} onSortChange={setSort}>Job title</SortableHead>
              <SortableHead column="location" columnLabel={COLUMN_LABEL.location} defaultDirection="asc" width="14%" minWidth={130} sort={sort} onSortChange={setSort}>Location</SortableHead>
              <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width="10%" minWidth={100} sort={sort} onSortChange={setSort}>Experience</SortableHead>
              <SortableHead column="status" columnLabel={COLUMN_LABEL.status} defaultDirection="asc" width="13%" minWidth={130} sort={sort} onSortChange={setSort}>Status</SortableHead>
              <SortableHead column="dueDate" columnLabel={COLUMN_LABEL.dueDate} defaultDirection="asc" width="13%" minWidth={120} sort={sort} onSortChange={setSort}>Due date</SortableHead>
              <SortableHead column="matches" columnLabel={COLUMN_LABEL.matches} width="10%" minWidth={90} sort={sort} onSortChange={setSort}>Matches</SortableHead>
              <SortableHead column="posted" columnLabel={COLUMN_LABEL.posted} width="14%" minWidth={110} sort={sort} onSortChange={setSort}>Posted</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} style={{ padding: "40px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <SearchXIcon size={22} color={t.inkFaint} aria-hidden="true" />
                    <p style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal, margin: 0 }}>No jobs match these filters</p>
                    <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, margin: 0 }}>Try adjusting or clearing your filters.</p>
                    <Button variant="outline" onClick={clearFilters} style={{ marginTop: 4, borderRadius: 8, height: 44, fontFamily: f.sans, fontSize: 12.5, fontWeight: 500 }}>
                      Clear filters
                    </Button>
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
                    {(budget || jobType) && (
                      <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 2 }}>
                        {[jobType, budget].filter(Boolean).join(" · ")}
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
                    <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{locationText(r) || "Not specified"}</div>
                    {mode && <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 1 }}>{mode}</div>}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", fontSize: textSize.md, fontWeight: 500, color: t.coal, verticalAlign: "top", whiteSpace: "normal" }}>
                    {exp || "Any"}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <DueCell dueDate={r.dueDate} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{r.candidateCount}</div>
                    {r.openPositions != null && (
                      <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 1 }}>
                        {r.openPositions} {r.openPositions === 1 ? "opening" : "openings"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", fontSize: textSize.sm, color: t.inkFaint, verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.createdAt}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
