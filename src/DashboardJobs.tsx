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
   fabricated to fill out the table. */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
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

function experienceBucket(m: JobMatch): string | null {
  const min = m.experienceMin ?? m.experienceMax;
  if (min == null) return null;
  if (min < 2) return "0-2 years";
  if (min < 5) return "2-5 years";
  if (min < 8) return "5-8 years";
  return "8+ years";
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PageArrowIcon({ dir, double }: { dir: "left" | "right"; double?: boolean }) {
  const points = dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={points} />
      {double && <polyline points={dir === "left" ? "21 18 15 12 21 6" : "3 18 9 12 3 6"} />}
    </svg>
  );
}

const selectStyle: CSSProperties = {
  fontFamily: f.sans, fontSize: 12.5, color: t.coal, background: t.white,
  border: `1px solid ${t.line}`, borderRadius: 8, padding: "8px 10px",
  appearance: "none", cursor: "pointer",
};

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...selectStyle, paddingRight: 26 }}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: t.inkFaint, pointerEvents: "none" }}>
        <ChevronDownIcon />
      </span>
    </div>
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
    <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "0 0 6px" }}>Jobs</h1>
        <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
          Employers on our talent roster match to your profile and reach out directly — there's nothing to apply to here.
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/interview")}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8,
          border: "none", background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        New Session
      </button>
    </div>
  );

  if (!loaded) {
    return <div style={{ maxWidth: 1080 }}>{heading}</div>;
  }

  const shortlisted = data?.shortlistedCount ?? 0;

  return (
    <div style={{ maxWidth: 1080 }}>
      {heading}

      {shortlisted === 0 ? (
        <div style={{ padding: 20, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
            No matches yet — we'll surface this the moment a role fits your profile.
          </p>
        </div>
      ) : (
        <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${t.line}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.inkFaint }}>
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job title, company, or location"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", borderRadius: 8,
                  border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 13, color: t.coal,
                }}
              />
            </div>
            <FilterSelect value={locationFilter} onChange={setLocationFilter} options={locationOptions} placeholder="Location" />
            <FilterSelect value={jobTypeFilter} onChange={setJobTypeFilter} options={jobTypeOptions} placeholder="Job type" />
            <FilterSelect value={experienceFilter} onChange={setExperienceFilter} options={experienceOptions} placeholder="Experience" />
            <FilterSelect value={industryFilter} onChange={setIndustryFilter} options={industryOptions} placeholder="Industry" />
            <div style={{ marginLeft: "auto" }}>
              <div style={{ position: "relative" }}>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{ ...selectStyle, paddingRight: 26 }} aria-label="Sort">
                  <option value="recent">Sort: Most recent</option>
                  <option value="match">Sort: Highest match</option>
                  <option value="salary">Sort: Highest salary</option>
                </select>
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: t.inkFaint, pointerEvents: "none" }}>
                  <ChevronDownIcon />
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: "12px 18px", background: t.indigo100, borderBottom: `1px solid ${t.line}` }}>
            <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.indigoDeep, margin: 0, lineHeight: 1.5 }}>
              Employers are interested in you! These opportunities are based on your profile, skills, and experience.
            </p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: f.sans }}>
              <thead>
                <tr>
                  {["Company", "Job title", "Location", "Experience", "Job type", "Salary", "Employer interest", "Date", ""].map((h) => (
                    <th
                      key={h || "actions"}
                      style={{
                        textAlign: "left", padding: "10px 14px", fontSize: 11, letterSpacing: 0.4,
                        textTransform: "uppercase", color: t.inkFaint, background: t.rowTint,
                        borderBottom: `1px solid ${t.line}`, whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: "24px 14px", textAlign: "center", fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>
                      No opportunities match these filters.
                    </td>
                  </tr>
                )}
                {pageRows.map((r, i) => {
                  const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
                  const closed = r.status === "closed" || r.status === "failed";
                  const comp = formatComp(r.budgetMin, r.budgetMax);
                  const exp = formatExperience(r.experienceMin, r.experienceMax);
                  const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
                  const isNew = !r.unlocked && Math.floor((Date.now() - new Date(r.matchedAt).getTime()) / 86_400_000) <= 2;
                  return (
                    <tr
                      key={i}
                      style={{
                        background: r.unlocked ? t.indigo100 : "transparent",
                        borderBottom: i < pageRows.length - 1 ? `1px solid ${t.line}` : "none",
                      }}
                    >
                      <td style={{ padding: "12px 14px", fontSize: 13, color: t.inkSoft, verticalAlign: "top" }}>
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
                      </td>
                      <td style={{ padding: "12px 14px", maxWidth: 260, verticalAlign: "top" }}>
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
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: t.inkSoft, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {r.location || "Not specified"}{mode ? <div style={{ fontSize: 11, color: t.inkFaint }}>{mode}</div> : null}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: t.inkSoft, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {exp || "Not specified"}
                      </td>
                      <td style={{ padding: "12px 14px", verticalAlign: "top", whiteSpace: "nowrap" }}>
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
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: t.coal, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {comp || "Not disclosed"}
                      </td>
                      <td style={{ padding: "12px 14px", verticalAlign: "top", maxWidth: 220 }}>
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
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: t.inkFaint, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {daysAgo(r.matchedAt)}
                        {isNew && (
                          <span style={{
                            display: "block", marginTop: 4, fontFamily: f.mono, fontSize: 9.5, letterSpacing: 0.4,
                            color: t.info, background: t.info100, padding: "2px 7px", borderRadius: 999, width: "fit-content",
                          }}>
                            NEW
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                        <button
                          type="button"
                          onClick={() => setSelected(r)}
                          aria-label={`View details for ${r.roleTitle} at ${r.companyName}`}
                          style={{
                            width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.line}`,
                            background: t.white, color: t.inkSoft, display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <EyeIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "12px 18px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>
                Showing {filtered.length === 0 ? 0 : (pageSafe - 1) * rowsPerPage + 1}–{Math.min(pageSafe * rowsPerPage, filtered.length)} of {filtered.length} opportunities
              </span>
              <div style={{ position: "relative" }}>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  style={{ ...selectStyle, paddingRight: 24, fontSize: 12 }}
                  aria-label="Rows per page"
                >
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" onClick={() => setPage(1)} disabled={pageSafe <= 1} aria-label="First page" style={pagerBtnStyle(pageSafe <= 1)}>
                <PageArrowIcon dir="left" double />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1} aria-label="Previous page" style={pagerBtnStyle(pageSafe <= 1)}>
                <PageArrowIcon dir="left" />
              </button>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, padding: "0 8px" }}>
                Page {pageSafe} of {totalPages}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages} aria-label="Next page" style={pagerBtnStyle(pageSafe >= totalPages)}>
                <PageArrowIcon dir="right" />
              </button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={pageSafe >= totalPages} aria-label="Last page" style={pagerBtnStyle(pageSafe >= totalPages)}>
                <PageArrowIcon dir="right" double />
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && <JobDetailModal job={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function pagerBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7, border: `1px solid ${t.line}`,
    background: t.white, color: disabled ? t.inkFaintWeak : t.inkSoft,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}
