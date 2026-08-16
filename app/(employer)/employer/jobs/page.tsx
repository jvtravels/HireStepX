"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { RequirementSummary, RequirementStatus } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, Pill, PrimaryCta, StatusChip, EmployerIcon } from "@/employer/_atoms";

function experienceLabel(req: RequirementSummary): string {
  const { experienceMin, experienceMax } = req;
  if (experienceMin == null && experienceMax == null) return "Any";
  if (experienceMin != null && experienceMax != null) return `${experienceMin}–${experienceMax} yrs`;
  if (experienceMin != null) return `${experienceMin}+ yrs`;
  return `Up to ${experienceMax} yrs`;
}

function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>—</span>;
  const daysLeft = daysUntil(dueDate);
  const tone = daysLeft < 0 ? "error" : daysLeft <= 7 ? "warning" : "neutral";
  const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`;
  return <Pill tone={tone}>{label}</Pill>;
}

type StatusFilter = "all" | RequirementStatus;
type DueFilter = "all" | "overdue" | "week" | "none";

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "generating", label: "Generating" },
  { value: "ready", label: "Shortlist ready" },
  { value: "partial", label: "Partial match" },
  { value: "zero", label: "No matches yet" },
  { value: "failed", label: "Generation failed" },
  { value: "closed", label: "Closed" },
];

const dueFilterOptions: Array<{ value: DueFilter; label: string }> = [
  { value: "all", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due within 7 days" },
  { value: "none", label: "No due date" },
];

const selectStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: `1px solid ${t.line}`,
  background: t.white,
  fontFamily: f.sans,
  fontSize: 13,
  color: t.coal,
};

const th: CSSProperties = {
  textAlign: "left",
  fontFamily: f.sans,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: t.inkFaint,
  padding: "0 16px 12px",
};

const td: CSSProperties = {
  padding: "16px",
  borderTop: `1px solid ${t.line}`,
  fontFamily: f.sans,
  fontSize: 13.5,
  color: t.coal,
  verticalAlign: "middle",
};

/* /employer/jobs — the requirements console. Owns the full list that used
   to live on the root dashboard; the dashboard now only links here. */
export default function EmployerJobsPage() {
  const { requirements, requirementsLoading } = useEmployerData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requirements.filter((req) => {
      if (q && !req.title.toLowerCase().includes(q) && !req.location.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      if (dueFilter !== "all") {
        if (dueFilter === "none" && req.dueDate) return false;
        if (dueFilter === "overdue" && (!req.dueDate || daysUntil(req.dueDate) >= 0)) return false;
        if (dueFilter === "week" && (!req.dueDate || daysUntil(req.dueDate) < 0 || daysUntil(req.dueDate) > 7)) return false;
      }
      return true;
    });
  }, [requirements, search, statusFilter, dueFilter]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all" || dueFilter !== "all";

  return (
    <div style={{ width: "100%" }}>
      {requirementsLoading ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
            <h1 style={{ fontFamily: f.serif, fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: 0 }}>
              Jobs
            </h1>
            <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
              <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
            </Link>
          </div>
          <Card style={{ textAlign: "center", padding: 48 }}>
            <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
          </Card>
        </>
      ) : requirements.length === 0 ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
            <h1 style={{ fontFamily: f.serif, fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: 0 }}>
              Jobs
            </h1>
            <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
              <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
            </Link>
          </div>
          <Card style={{ textAlign: "center", padding: 48 }}>
            <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
              You haven't posted a requirement yet.
            </p>
          </Card>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <h1 style={{ fontFamily: f.serif, fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: 0, marginRight: 4 }}>
              Jobs
            </h1>
            <Pill tone="neutral">{filtersActive ? `${filtered.length} of ${requirements.length}` : requirements.length}</Pill>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by role or location…"
              style={{ ...selectStyle, flex: "1 1 200px", minWidth: 160 }}
              aria-label="Search jobs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={selectStyle}
              aria-label="Filter by status"
            >
              {statusFilterOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              style={selectStyle}
              aria-label="Filter by due date"
            >
              {dueFilterOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {filtersActive && (
              <button
                type="button"
                onClick={() => { setSearch(""); setStatusFilter("all"); setDueFilter("all"); }}
                style={{ ...selectStyle, background: "transparent", border: "none", color: t.indigo, fontWeight: 600, cursor: "pointer" }}
              >
                Clear filters
              </button>
            )}
            <Link href="/employer/requirements/new" style={{ textDecoration: "none", marginLeft: "auto" }}>
              <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
            </Link>
          </div>

          {filtered.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 48 }}>
              <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
                No jobs match your search or filters.
              </p>
            </Card>
          ) : (
            <Card pad={0} style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, paddingTop: 20 }}>Role</th>
                      <th style={{ ...th, paddingTop: 20 }}>Location</th>
                      <th style={{ ...th, paddingTop: 20 }}>Experience</th>
                      <th style={{ ...th, paddingTop: 20 }}>Status</th>
                      <th style={{ ...th, paddingTop: 20 }}>Matches</th>
                      <th style={{ ...th, paddingTop: 20 }}>Due date</th>
                      <th style={{ ...th, paddingTop: 20 }}>Posted</th>
                      <th style={{ ...th, paddingTop: 20, textAlign: "right", paddingRight: 20 }}>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((req) => (
                      <tr key={req.id}>
                        <td style={td}>
                          <Link
                            href={`/employer/requirements/${req.id}`}
                            style={{ fontWeight: 600, color: t.coal, textDecoration: "none" }}
                            onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                            onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                          >
                            {req.title}
                          </Link>
                        </td>
                        <td style={{ ...td, color: t.inkSoft }}>{req.location}</td>
                        <td style={{ ...td, color: t.inkSoft }}>{experienceLabel(req)}</td>
                        <td style={td}>
                          <StatusChip status={req.status} />
                        </td>
                        <td style={{ ...td, color: t.inkSoft }}>{req.candidateCount}</td>
                        <td style={td}>
                          <DueDateBadge dueDate={req.dueDate} />
                        </td>
                        <td style={{ ...td, color: t.inkFaint, fontSize: 12.5 }}>{req.createdAt}</td>
                        <td style={{ ...td, textAlign: "right", paddingRight: 20 }}>
                          <Link
                            href={`/employer/requirements/${req.id}`}
                            style={{ display: "inline-flex", color: t.indigo, textDecoration: "none" }}
                            aria-label={`View ${req.title}`}
                          >
                            <EmployerIcon.Arrow />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
