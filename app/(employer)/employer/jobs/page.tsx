"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { RequirementSummary } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, Pill, PrimaryCta, StatusChip, EmployerIcon } from "@/employer/_atoms";

function experienceLabel(req: RequirementSummary): string {
  const { experienceMin, experienceMax } = req;
  if (experienceMin == null && experienceMax == null) return "Any";
  if (experienceMin != null && experienceMax != null) return `${experienceMin}–${experienceMax} yrs`;
  if (experienceMin != null) return `${experienceMin}+ yrs`;
  return `Up to ${experienceMax} yrs`;
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>—</span>;
  const daysLeft = Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
  const tone = daysLeft < 0 ? "error" : daysLeft <= 7 ? "warning" : "neutral";
  const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`;
  return <Pill tone={tone}>{label}</Pill>;
}

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

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontFamily: f.serif, fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: 0 }}>
              Jobs
            </h1>
            {!requirementsLoading && (
              <Pill tone="neutral">{requirements.length}</Pill>
            )}
          </div>
        </section>
        <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
          <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
        </Link>
      </div>

      {requirementsLoading ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
        </Card>
      ) : requirements.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
            You haven't posted a requirement yet.
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
                {requirements.map((req) => (
                  <tr key={req.id}>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{req.title}</span>
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
    </div>
  );
}
