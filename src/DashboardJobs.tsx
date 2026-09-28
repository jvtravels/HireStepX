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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EyeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authHeaders } from "./supabase";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import JobDetailModal from "./JobDetailModal";

export interface JobMatch {
  roleTitle: string;
  companyName: string;
  companyLogoPath: string | null;
  companyWebsite: string | null;
  location: string;
  workMode: string | null;
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

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25];

type SortKey = "recent" | "match" | "salary";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "match", label: "Highest match" },
  { value: "salary", label: "Highest salary" },
];

function experienceBucket(m: JobMatch): string | null {
  const min = m.experienceMin ?? m.experienceMax;
  if (min == null) return null;
  if (min < 2) return "0-2 years";
  if (min < 5) return "2-5 years";
  if (min < 8) return "5-8 years";
  return "8+ years";
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
          style={{ borderRadius: 8, height: 36, gap: 8, background: t.white, color: value ? t.coal : t.inkFaint, fontFamily: f.sans, fontSize: 13, fontWeight: 500, flexShrink: 0 }}
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

export default function DashboardJobs() {
  const router = useRouter();
  const [data, setData] = useState<HiringActivity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<JobMatch | null>(null);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/candidate-hiring-activity?full=1", { headers });
        const json = await res.json().catch(() => null);
        if (!cancelled) {
          if (res.ok && json) setData(json as HiringActivity);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const matches = useMemo(() => data?.recent || [], [data]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = matches.filter((m) => {
      if (q && !(`${m.roleTitle} ${m.companyName} ${m.location}`.toLowerCase().includes(q))) return false;
      if (locationFilter && m.location !== locationFilter) return false;
      if (jobTypeFilter && (m.employmentType ? EMPLOYMENT_TYPE_LABEL[m.employmentType] || m.employmentType : null) !== jobTypeFilter) return false;
      if (experienceFilter && experienceBucket(m) !== experienceFilter) return false;
      if (industryFilter && m.preferredIndustry !== industryFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore;
      if (sortBy === "salary") return (b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0);
      return new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime();
    });
    return list;
  }, [matches, search, locationFilter, jobTypeFilter, experienceFilter, industryFilter, sortBy]);

  useEffect(() => { setPage(1); }, [search, locationFilter, jobTypeFilter, experienceFilter, industryFilter, sortBy, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const heading = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Jobs</h1>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkFaint, margin: "2px 0 0" }}>
          Employers on our talent roster match to your profile and reach out directly — there's nothing to apply to here.
        </p>
      </div>
      <Button
        onClick={() => router.push("/interview")}
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
        Start session
      </Button>
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      {heading}
      {body}
    </div>
  );

  if (!loaded) {
    return shell(null);
  }

  const shortlisted = data?.shortlistedCount ?? 0;

  const body = shell(
    shortlisted === 0 ? (
      <div style={{ padding: 20 }}>
        <div style={{ padding: 20, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
            No matches yet — we'll surface this the moment a role fits your profile.
          </p>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
              <SearchIcon
                size={14}
                color={t.inkFaint}
                aria-hidden="true"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job title, company, or location"
                style={{ paddingLeft: 32, height: 36, borderRadius: 8, background: t.white }}
              />
            </div>
            <FilterPill label="Location" value={locationFilter} options={locationOptions} onChange={setLocationFilter} />
            <FilterPill label="Job type" value={jobTypeFilter} options={jobTypeOptions} onChange={setJobTypeFilter} />
            <FilterPill label="Experience" value={experienceFilter} options={experienceOptions} onChange={setExperienceFilter} />
            <FilterPill label="Industry" value={industryFilter} options={industryOptions} onChange={setIndustryFilter} />
            <div style={{ marginLeft: "auto" }}>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger size="sm" style={{ borderRadius: 8, fontFamily: f.sans, fontSize: 12.5, color: t.coal }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>Sort: {o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table aria-label="Job matches">
            <TableHeader>
              <TableRow style={{ background: t.rowTint }}>
                {["Company", "Job title", "Location", "Experience", "Job type", "Salary", "Employer interest", "Date", ""].map((h) => (
                  <TableHead
                    key={h || "actions"}
                    style={{
                      fontFamily: f.sans, fontSize: 11, letterSpacing: 0.4,
                      textTransform: "uppercase", color: t.inkFaint, padding: "10px 14px",
                    }}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} style={{ padding: "24px 14px", textAlign: "center", fontFamily: f.sans, fontSize: 13, color: t.inkFaint, whiteSpace: "normal" }}>
                    No opportunities match these filters.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r, i) => {
                const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
                const closed = r.status === "closed" || r.status === "failed";
                const comp = formatComp(r.budgetMin, r.budgetMax);
                const exp = formatExperience(r.experienceMin, r.experienceMax);
                const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
                const isNew = !r.unlocked && Math.floor((Date.now() - new Date(r.matchedAt).getTime()) / 86_400_000) <= 2;
                return (
                  <TableRow key={i} style={{ background: r.unlocked ? t.indigo100 : "transparent" }}>
                    <TableCell style={{ padding: "12px 14px", fontSize: 13, color: t.inkSoft, verticalAlign: "top" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {r.companyLogoPath ? (
                          <img
                            src={r.companyLogoPath}
                            alt={`${r.companyName} logo`}
                            width={30}
                            height={30}
                            style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0, border: `1px solid ${t.line}` }}
                          />
                        ) : (
                          <div style={{
                            width: 30, height: 30, borderRadius: 6, background: t.cream, border: `1px solid ${t.line}`,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            fontFamily: f.serif, fontSize: 13, color: t.inkSoft,
                          }}>
                            {r.companyName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: t.coal, whiteSpace: "nowrap" }}>{r.companyName}</div>
                          {r.preferredIndustry && (
                            <div style={{ fontSize: 11, color: t.inkFaint }}>{r.preferredIndustry}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", maxWidth: 260, verticalAlign: "top", whiteSpace: "normal" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: t.coal }}>{r.roleTitle}</div>
                      {r.description && (
                        <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {r.description}
                        </div>
                      )}
                      {r.skills.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {r.skills.slice(0, 3).map((s, si) => (
                            <span key={si} style={{ fontSize: 10.5, color: t.coal, background: t.cream, border: `1px solid ${t.line}`, padding: "2px 7px", borderRadius: 999 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", fontSize: 13, color: t.inkSoft, verticalAlign: "top" }}>
                      {r.location || "Not specified"}{mode ? <div style={{ fontSize: 11, color: t.inkFaint }}>{mode}</div> : null}
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", fontSize: 13, color: t.inkSoft, verticalAlign: "top" }}>
                      {exp || "Not specified"}
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      {jobType ? (
                        <span style={{
                          fontFamily: f.sans, fontSize: 11, fontWeight: 600,
                          color: jobType === "Contract" ? t.warningInk : t.successInk,
                          background: jobType === "Contract" ? t.warning100 : t.success100,
                          padding: "3px 9px", borderRadius: 999,
                        }}>
                          {jobType}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: t.inkFaint }}>—</span>
                      )}
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", fontSize: 13, color: t.coal, verticalAlign: "top" }}>
                      {comp || "Not disclosed"}
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", verticalAlign: "top", maxWidth: 220, whiteSpace: "normal" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                        {r.unlocked ? (
                          <span style={{
                            fontFamily: f.mono, fontSize: 10.5, letterSpacing: 0.4, color: t.indigoDeep,
                            background: t.cream, padding: "3px 9px", borderRadius: 999,
                          }}>
                            CONTACTED
                          </span>
                        ) : (
                          <span style={{
                            fontFamily: f.mono, fontSize: 10.5, letterSpacing: 0.4, color: t.successInk,
                            background: t.success100, padding: "3px 9px", borderRadius: 999,
                          }}>
                            {r.matchScore}% INTERESTED
                          </span>
                        )}
                        {closed && !r.unlocked && (
                          <span style={{
                            fontFamily: f.mono, fontSize: 10, letterSpacing: 0.4, color: t.inkFaint,
                            background: t.cream, padding: "2px 8px", borderRadius: 999,
                          }}>
                            ROLE CLOSED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: t.inkFaint, lineHeight: 1.4 }}>{r.matchReason}</div>
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", fontSize: 12, color: t.inkFaint, verticalAlign: "top" }}>
                      {daysAgo(r.matchedAt)}
                      {isNew && (
                        <span style={{
                          display: "block", marginTop: 4, fontFamily: f.mono, fontSize: 9.5, letterSpacing: 0.4,
                          color: t.info, background: t.info100, padding: "2px 7px", borderRadius: 999, width: "fit-content",
                        }}>
                          NEW
                        </span>
                      )}
                    </TableCell>
                    <TableCell style={{ padding: "12px 14px", verticalAlign: "top" }}>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`View details for ${r.roleTitle} at ${r.companyName}`}
                        onClick={() => setSelected(r)}
                      >
                        <EyeIcon aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div style={{ padding: "12px 18px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>
                Showing {filtered.length === 0 ? 0 : (pageSafe - 1) * rowsPerPage + 1}–{Math.min(pageSafe * rowsPerPage, filtered.length)} of {filtered.length} opportunities
              </span>
              <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
                <SelectTrigger size="sm" style={{ borderRadius: 6, fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Button variant="outline" size="icon-sm" aria-label="First page" disabled={pageSafe <= 1} onClick={() => setPage(1)}>
                <ChevronsLeftIcon aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, padding: "0 8px" }}>
                Page {pageSafe} of {totalPages}
              </span>
              <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRightIcon aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Last page" disabled={pageSafe >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRightIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )
  );

  return (
    <>
      {body}
      {selected && <JobDetailModal job={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
