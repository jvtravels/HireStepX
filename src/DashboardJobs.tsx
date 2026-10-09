"use client";

/* Dedicated Jobs tab — the full-detail counterpart to the dashboard's
   HiringActivityCard teaser. Companies pick candidates off the talent
   roster; there's no apply flow, so this page is a read-only, complete
   view of every match: full role detail, employer branding, and status,
   rather than the top-3 summary shown on the dashboard. Fetches
   /api/candidate-hiring-activity?full=1 to get the uncapped list plus
   the extra fields (notice period, responsibilities, perks, employment
   type, why-matched reasoning, etc.) the dashboard card doesn't render.

   Search, the column filters, sorting, and pagination below all operate
   client-side over that one fetched list — every filter option and every
   cell value is read straight off real match data, nothing here is
   fabricated to fill out the table.

   Table/toolbar/pagination all reuse the same shadcn primitives as
   SessionsV2.tsx (Table, Input, Select, DropdownMenu-based FilterPill,
   Button) rather than hand-rolled table/select/button markup. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlusIcon,
  SearchXIcon,
  AlertCircleIcon,
  BriefcaseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobsRouteSkeleton } from "@/routeSkeletons";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { FiltersPanel, type FilterSection, type FilterSelection } from "@/components/FiltersPanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { useAuth } from "./AuthContext";
import { authHeaders } from "./supabase";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import { dur, ease } from "./_motion";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL, type SalaryType } from "./hiringMatchFormat";
import { CompanyAvatar } from "./CompanyAvatar";
import { useMaxWidth } from "./hooks/useMaxWidth";

export interface JobMatch {
  id: string;
  roleTitle: string;
  companyName: string;
  companyLogoPath: string | null;
  companyWebsite: string | null;
  location: string;
  workMode: string | null;
  salaryType: SalaryType | null;
  budgetMin: number | null;
  budgetMax: number | null;
  experienceMin: number | null;
  experienceMax: number | null;
  skills: string[];
  noticePeriodPref: string | null;
  openPositions: number | null;
  description: string | null;
  responsibilities: string | null;
  niceToHave: string | null;
  perksAndBenefits: string[];
  preferredIndustry: string | null;
  dueDate: string | null;
  status: string | null;
  employmentType: string | null;
  matchScore: number;
  matchReason: string;
  unlocked: boolean;
  matchedAt: string;
  unlockedAt: string | null;
}

interface HiringActivity {
  shortlistedCount?: number;
  unlockedCount?: number;
  recent?: JobMatch[];
}

type SortColumn = "company" | "title" | "location" | "experience" | "jobType" | "salary" | "interest" | "date";
const DEFAULT_SORT: Sort<SortColumn> = { column: "date", direction: "desc" };
const RECENT_SEARCHES_KEY = "hirestepx-candidate-jobs-recent-searches";

const COLUMN_LABEL: Record<SortColumn, string> = {
  company: "Company",
  title: "Job title",
  location: "Location",
  experience: "Experience",
  jobType: "Job type",
  salary: "Salary",
  interest: "Employer interest",
  date: "Date",
};

function jobTypeLabel(m: JobMatch): string {
  return (m.employmentType ? EMPLOYMENT_TYPE_LABEL[m.employmentType] || m.employmentType : "") || "";
}

function compareRows(a: JobMatch, b: JobMatch, sort: Sort<SortColumn>): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  switch (sort.column) {
    case "company":
      return dir * a.companyName.localeCompare(b.companyName);
    case "title":
      return dir * a.roleTitle.localeCompare(b.roleTitle);
    case "location":
      return dir * (a.location || "").localeCompare(b.location || "");
    case "experience":
      return dir * ((a.experienceMin ?? a.experienceMax ?? -1) - (b.experienceMin ?? b.experienceMax ?? -1));
    case "jobType":
      return dir * jobTypeLabel(a).localeCompare(jobTypeLabel(b));
    case "salary":
      return dir * ((a.budgetMax ?? a.budgetMin ?? 0) - (b.budgetMax ?? b.budgetMin ?? 0));
    case "interest":
      // "Employer interest" is what the two badges in that column show
      // (Contacted vs Interested), not the invisible matchScore — sorting by
      // matchScore silently reordered rows by a number nobody on screen sees.
      return dir * ((a.unlocked ? 1 : 0) - (b.unlocked ? 1 : 0));
    case "date":
      return dir * (new Date(a.matchedAt).getTime() - new Date(b.matchedAt).getTime());
  }
}

function experienceBucket(m: JobMatch): string | null {
  const min = m.experienceMin ?? m.experienceMax;
  if (min == null) return null;
  if (min < 2) return "0-2 years";
  if (min < 5) return "2-5 years";
  if (min < 8) return "5-8 years";
  return "8+ years";
}

// One pill treatment for every status/category badge in this table, so
// "employer interest", "job type", and "role closed" read as the same
// visual language instead of five hand-tuned one-offs (mono vs sans,
// five different font sizes, a green success color used for a neutral
// job-type label). Color is reserved for genuine state (Matched,
// Contacted, New); job type is a category, not a state, so it stays
// neutral per the design system's "accent for state, not decoration" rule.
type BadgeTone = "neutral" | "success" | "brand" | "info";
const BADGE_TONE: Record<BadgeTone, { color: string; background: string }> = {
  neutral: { color: t.inkSoft, background: t.creamSoft },
  success: { color: t.successInk, background: t.success100 },
  brand: { color: t.indigoDeep, background: t.indigo100 },
  info: { color: t.info, background: t.info100 },
};

function Badge({ tone, title, children }: { tone: BadgeTone; title?: string; children: React.ReactNode }) {
  const { color, background } = BADGE_TONE[tone];
  return (
    <span
      title={title}
      style={{
        fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color, background,
        padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* Narrow layout (<1024px): one stacked card per match instead of the 8-column
   table, which can't fit without crushing every column. */
function JobCard({ r, onOpen }: { r: JobMatch; onOpen: () => void }) {
  const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
  const closed = r.status === "closed" || r.status === "failed";
  const comp = formatComp(r.budgetMin, r.budgetMax, r.salaryType);
  const exp = formatExperience(r.experienceMin, r.experienceMax);
  const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
  const isNew = !r.unlocked && Math.floor((Date.now() - new Date(r.matchedAt).getTime()) / 86_400_000) <= 2;
  const meta = [r.location || "Location not specified", mode, exp, comp || "Salary not disclosed"].filter(Boolean);
  return (
    <li style={{ background: t.white, boxShadow: `inset 0 -1px 0 ${t.line}, inset -1px 0 0 ${t.line}` }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`View details for ${r.roleTitle}${r.unlocked ? ` at ${r.companyName}` : ""}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", cursor: "pointer", minWidth: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <CompanyAvatar job={r} size={36} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, wordBreak: "break-word" }}>{r.roleTitle}</div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, wordBreak: "break-word" }}>
              {r.companyName}{r.preferredIndustry ? ` · ${r.preferredIndustry}` : ""}
            </div>
          </div>
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, flexShrink: 0, alignSelf: "flex-start" }}>{daysAgo(r.matchedAt)}</span>
        </div>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.4, display: "flex", flexWrap: "wrap", columnGap: 6 }}>{meta.map((m, i) => <span key={i} style={{ whiteSpace: "nowrap" }}>{m}{i < meta.length - 1 && <span aria-hidden="true"> ·</span>}</span>)}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {r.unlocked ? <Badge tone="brand">Contacted</Badge> : <Badge tone="success">Matched</Badge>}
          {closed && <Badge tone="neutral">Role closed</Badge>}
          {isNew && <Badge tone="info">New</Badge>}
          {jobType && <Badge tone="neutral">{jobType}</Badge>}
        </div>
        {r.matchReason && <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, lineHeight: 1.4 }}>{r.matchReason}</div>}
        {r.skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {r.skills.slice(0, 3).map((sk, si) => (
              <span key={si} style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, background: t.creamSoft, padding: "2px 8px", borderRadius: 999 }}>{sk}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default function DashboardJobs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNarrow = useMaxWidth(1280);
  const { user: authUser } = useAuth();
  // Cache-first like DashboardContext's sessions/events: a tab switch back
  // into Jobs shows the last-known list instantly instead of a spinner,
  // then refreshes from the network in the background.
  const [data, setData] = useState<HiringActivity | null>(() => {
    if (!authUser?.id) return null;
    try {
      const cached = localStorage.getItem(`hirestepx_cache_hiring_activity_full_${authUser.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loaded, setLoaded] = useState(data !== null);
  const [fetchError, setFetchError] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<number | null>(null);
  const openJob = useCallback((m: JobMatch) => router.push(`/jobs/${encodeURIComponent(m.id)}`), [router]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterSelection>({});
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadMatches = useCallback(async (signal: { cancelled: boolean }) => {
    if (!authUser?.id) return;
    const cacheKey = `hirestepx_cache_hiring_activity_full_${authUser.id}`;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/candidate-hiring-activity?full=1", { headers });
      const json = await res.json().catch(() => null);
      if (signal.cancelled) return;
      if (res.ok && json) {
        setData(json as HiringActivity);
        try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* expected: localStorage may be unavailable */ }
        setFetchError(false);
        setFetchStatus(null);
      } else {
        setFetchError(true);
        setFetchStatus(res.status);
      }
      setLoaded(true);
    } catch {
      if (!signal.cancelled) {
        setFetchError(true);
        setFetchStatus(null);
        setLoaded(true);
      }
    }
  }, [authUser?.id]);

  useEffect(() => {
    const signal = { cancelled: false };
    loadMatches(signal);
    return () => { signal.cancelled = true; };
  }, [loadMatches]);

  const retry = useCallback(() => {
    setLoaded(false);
    setFetchError(false);
    setFetchStatus(null);
    loadMatches({ cancelled: false });
  }, [loadMatches]);

  const matches = useMemo(() => data?.recent || [], [data]);

  // Old ?open=<matchId> links now live at /jobs/<matchId>.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) router.replace(`/jobs/${encodeURIComponent(openId)}`);
  }, [searchParams, router]);

  const locationOptions = useMemo(
    () => Array.from(new Set(matches.map((m) => m.location).filter(Boolean))).sort(),
    [matches],
  );
  const jobTypeOptions = useMemo(
    () => Array.from(new Set(matches.map((m) => (m.employmentType ? EMPLOYMENT_TYPE_LABEL[m.employmentType] || m.employmentType : null)).filter((v): v is string => !!v))).sort(),
    [matches],
  );
  const experienceOptions = useMemo(
    () => Array.from(new Set(matches.map(experienceBucket).filter((v): v is string => !!v))),
    [matches],
  );
  const industryOptions = useMemo(
    () => Array.from(new Set(matches.map((m) => m.preferredIndustry).filter((v): v is string => !!v))).sort(),
    [matches],
  );

  const filterSections = useMemo<FilterSection[]>(() => [
    { key: "location", label: "Location", options: locationOptions.map((o) => ({ value: o, label: o })) },
    { key: "jobType", label: "Job type", options: jobTypeOptions.map((o) => ({ value: o, label: o })) },
    { key: "experience", label: "Experience", options: experienceOptions.map((o) => ({ value: o, label: o })) },
    { key: "industry", label: "Industry", options: industryOptions.map((o) => ({ value: o, label: o })) },
  ], [locationOptions, jobTypeOptions, experienceOptions, industryOptions]);

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    for (const section of filterSections) {
      const first = section.options.find((o) => !(filters[section.key] ?? []).includes(o.value));
      if (first) suggestions.push({ label: `${section.label}: ${first.label}`, apply: () => setFilters({ ...filters, [section.key]: [...(filters[section.key] ?? []), first.value] }) });
    }
    return suggestions.slice(0, 4);
  }, [filterSections, filters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = matches.filter((m) => {
      const company = m.unlocked ? m.companyName : "";
      if (q && !(`${m.roleTitle} ${company} ${m.location}`.toLowerCase().includes(q))) return false;
      if (filters.location?.length && !filters.location.includes(m.location)) return false;
      if (filters.jobType?.length && !filters.jobType.includes(jobTypeLabel(m))) return false;
      if (filters.experience?.length && !filters.experience.includes(experienceBucket(m) ?? "")) return false;
      if (filters.industry?.length && !filters.industry.includes(m.preferredIndustry ?? "")) return false;
      return true;
    });
    return [...list].sort((a, b) => compareRows(a, b, sort));
  }, [matches, search, filters, sort]);

  useEffect(() => { setPage(1); }, [search, filters, sort, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const clearAllFilters = () => {
    setSearch("");
    setFilters({});
  };

  const renderHeading = (withFilters: boolean) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isNarrow ? "14px 16px" : "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px", flexShrink: 0 }}>Jobs</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: isNarrow ? "stretch" : "flex-end", flex: isNarrow ? "1 1 100%" : 1, minWidth: 0 }}>
        {withFilters && (
          <>
            <SearchWithSuggestions
              id="jobs-search"
              label="Search jobs"
              value={search}
              onChange={setSearch}
              placeholder="Search by job title, location, or skill"
              storageKey={RECENT_SEARCHES_KEY}
              suggestedFilters={suggestedFilters}
              style={isNarrow ? { flex: "1 1 160px", minWidth: 0 } : { flex: "1 1 240px", minWidth: 200, maxWidth: "50%" }}
            />
            <FiltersPanel sections={filterSections} value={filters} onApply={setFilters} />
          </>
        )}
        <Button size="lg" className={isNarrow ? "gap-2 px-4 w-full" : "gap-2 px-4"} onClick={() => router.push("/session/new")}>
          <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
          Start session
        </Button>
      </div>
    </div>
  );

  const shell = (body: React.ReactNode, withFilters = false) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      {renderHeading(withFilters)}
      {body}
    </div>
  );

  if (!loaded) {
    return shell(<JobsRouteSkeleton />);
  }

  if (fetchError) {
    const message =
      fetchStatus === 401 || fetchStatus === 403
        ? "Your session has expired — please sign in again."
        : fetchStatus === 429
          ? "Too many requests — please wait a moment and try again."
          : fetchStatus && fetchStatus >= 500
            ? "Our server is having trouble right now. Please try again shortly."
            : "Something went wrong reaching the server. Check your connection and try again.";
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "64px 20px", flex: 1 }} role="alert">
        <AlertCircleIcon size={26} color={t.inkFaint} aria-hidden="true" />
        <p style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0 }}>Couldn't load your matches</p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, margin: 0, textAlign: "center", maxWidth: 320 }}>
          {message}
        </p>
        <Button variant="outline" onClick={retry} style={{ borderRadius: 8, height: 36, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}>
          Retry
        </Button>
      </div>,
    );
  }

  const shortlisted = data?.shortlistedCount ?? 0;

  const body = shell(
    shortlisted === 0 ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "56px 24px", flex: 1, textAlign: "center" }}>
        <BriefcaseIcon size={26} color={t.inkFaint} aria-hidden="true" />
        <p style={{ fontFamily: f.sans, fontSize: 14.5, fontWeight: 600, color: t.coal, margin: 0 }}>No matches yet</p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, margin: 0, lineHeight: 1.5, maxWidth: 380 }}>
          Employers browse the talent roster and reach out when a role fits — there's no set schedule for this.
          Your match score is driven by your practice history, so completing more sessions improves how you rank.
        </p>
        <Button
          onClick={() => router.push("/session/new")}
          variant="outline"
          style={{ marginTop: 4, borderRadius: 8, height: 36, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}
        >
          Start a practice session
        </Button>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {isNarrow ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {pageRows.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 16px" }}>
                  <SearchXIcon size={22} color={t.inkFaint} aria-hidden="true" />
                  <p style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0, textAlign: "center" }}>No opportunities match these filters</p>
                  <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, margin: 0, textAlign: "center" }}>Try adjusting or clearing your filters.</p>
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    style={{ marginTop: 4, borderRadius: 8, height: 44, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <ul aria-label="Job matches" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 0, background: t.white }}>
                  {pageRows.map((r) => (
                    <JobCard key={r.id} r={r} onOpen={() => openJob(r)} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
          <div className="[&>div]:h-full [&>div]:overflow-y-auto" style={{ overflow: "hidden", flex: 1, minHeight: 0 }}>
          <Table aria-label="Job matches" className="table-fixed" style={{ width: "100%", minWidth: 1120 }}>
            <TableHeader>
              <TableRow style={{ background: t.rowTint, height: 40, position: "sticky", top: 0, zIndex: 1 }}>
                <SortableHead column="company" columnLabel={COLUMN_LABEL.company} defaultDirection="asc" width="15%" minWidth={150} sort={sort} onSortChange={setSort}>Company</SortableHead>
                <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width="23%" minWidth={220} sort={sort} onSortChange={setSort}>Job title</SortableHead>
                <SortableHead column="location" columnLabel={COLUMN_LABEL.location} defaultDirection="asc" width="10%" minWidth={110} sort={sort} onSortChange={setSort}>Location</SortableHead>
                <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width="9%" minWidth={110} sort={sort} onSortChange={setSort}>Experience</SortableHead>
                <SortableHead column="jobType" columnLabel={COLUMN_LABEL.jobType} defaultDirection="asc" width="9%" minWidth={100} sort={sort} onSortChange={setSort}>Job type</SortableHead>
                <SortableHead column="salary" columnLabel={COLUMN_LABEL.salary} width="13%" minWidth={140} sort={sort} onSortChange={setSort}>Salary</SortableHead>
                <SortableHead column="interest" columnLabel={COLUMN_LABEL.interest} width="14%" minWidth={180} sort={sort} onSortChange={setSort}>Employer interest</SortableHead>
                <SortableHead column="date" columnLabel={COLUMN_LABEL.date} width="8%" minWidth={110} sort={sort} onSortChange={setSort}>Date</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} style={{ padding: "40px 14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <SearchXIcon size={22} color={t.inkFaint} aria-hidden="true" />
                      <p style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal, margin: 0 }}>No opportunities match these filters</p>
                      <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, margin: 0 }}>Try adjusting or clearing your filters.</p>
                      <Button
                        variant="outline"
                        onClick={clearAllFilters}
                        style={{ marginTop: 4, borderRadius: 8, height: 44, fontFamily: f.sans, fontSize: 12.5, fontWeight: 500 }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => {
                const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
                const closed = r.status === "closed" || r.status === "failed";
                const comp = formatComp(r.budgetMin, r.budgetMax, r.salaryType);
                const exp = formatExperience(r.experienceMin, r.experienceMax);
                const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
                const isNew = !r.unlocked && Math.floor((Date.now() - new Date(r.matchedAt).getTime()) / 86_400_000) <= 2;
                return (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    aria-label={`View details for ${r.roleTitle}${r.unlocked ? ` at ${r.companyName}` : ""}`}
                    onClick={() => openJob(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openJob(r);
                      }
                    }}
                    className=""
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    style={{ cursor: "pointer", minHeight: 72, transition: `background ${dur.instant} ${ease.snap}` }}
                  >
                    <TableCell style={{ padding: "12px 20px", fontSize: textSize.base, color: t.inkSoft, verticalAlign: "top" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                        <CompanyAvatar job={r} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal, whiteSpace: "normal", wordBreak: "break-word" }}>{r.companyName}</div>
                          {r.preferredIndustry && (
                            <div style={{ fontSize: textSize.sm, color: t.inkFaint, whiteSpace: "normal", wordBreak: "break-word" }}>{r.preferredIndustry}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", maxWidth: 260, verticalAlign: "top", whiteSpace: "normal" }}>
                      <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{r.roleTitle}</div>
                      {r.description && (
                        <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {r.description}
                        </div>
                      )}
                      {r.skills.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {r.skills.slice(0, 3).map((s, si) => (
                            <span key={si} style={{ fontSize: textSize.sm, color: t.inkSoft, background: t.creamSoft, padding: "2px 7px", borderRadius: 999 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                      <div style={{ fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{r.location || "Not specified"}</div>
                      {mode && <div style={{ fontSize: textSize.sm, color: t.inkFaint, marginTop: 1 }}>{mode}</div>}
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", fontSize: textSize.md, fontWeight: 500, color: t.coal, verticalAlign: "top", whiteSpace: "normal" }}>
                      {exp || "Not specified"}
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                      {jobType ? <Badge tone="neutral">{jobType}</Badge> : <span style={{ fontSize: textSize.sm, color: t.inkFaint }}>—</span>}
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", fontSize: textSize.md, fontWeight: 500, color: t.coal, verticalAlign: "top", whiteSpace: "normal" }}>
                      {comp || "Not disclosed"}
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", verticalAlign: "top", maxWidth: 220, whiteSpace: "normal" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                        {r.unlocked ? (
                          <Badge tone="brand" title="This employer has unlocked your profile and can reach out directly">
                            Contacted
                          </Badge>
                        ) : (
                          <Badge tone="success" title="Your profile matched this role's requirements">
                            Matched
                          </Badge>
                        )}
                        {closed && (
                          <Badge tone="neutral" title="This role is no longer accepting candidates">
                            Role closed
                          </Badge>
                        )}
                      </div>
                      <div style={{ fontSize: textSize.sm, color: t.inkFaint, lineHeight: 1.4 }}>{r.matchReason}</div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 20px", fontSize: textSize.sm, color: t.inkFaint, verticalAlign: "top", whiteSpace: "normal" }}>
                      {daysAgo(r.matchedAt)}
                      {isNew && (
                        <div style={{ marginTop: 4, width: "fit-content" }}>
                          <Badge tone="info">New</Badge>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          )}

          <TablePaginationFooter
            entityLabel="opportunity"
            entityLabelPlural="opportunities"
            totalCount={matches.length}
            filteredCount={filtered.length}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={setRowsPerPage}
            page={pageSafe}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      ),
    shortlisted > 0,
  );

  return <>{body}</>;
}
