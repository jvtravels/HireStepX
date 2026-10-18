"use client";

import Link from "next/link";
import type { RequirementSummary, RequirementStage } from "@/employer/mockData";
import { Badge, StageCell } from "@/employer/_atoms";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import { budgetLabel, experienceLabel, locationText } from "./jobsHelpers";
import { DueCell, MatchesCell } from "./JobCells";

/* Phone layout (<640px): the table can't fit, so each job renders
   as a stacked card carrying the same information as the table cells. */
export default function JobCard({ r, readOnly, onStage, actions }: { r: RequirementSummary; readOnly: boolean; onStage: (stage: RequirementStage) => void; actions: React.ReactNode }) {
  const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
  const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
  const exp = experienceLabel(r);
  const budget = budgetLabel(r);
  const isClosed = r.status === "closed";
  const label: React.CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.inkSoft, marginBottom: 4 };
  return (
    <li style={{ padding: 16, borderBottom: `1px solid ${t.line}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Link href={`/employer/requirements/${r.id}`} style={{ flex: 1, minWidth: 0, minHeight: 44, textAlign: "left", textDecoration: "none", color: "inherit" }}>
          <span style={{ display: "block", fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal, overflowWrap: "anywhere" }}>{r.title}</span>
          {(budget || jobType) && (
            <span style={{ display: "block", fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, marginTop: 2 }}>{[budget, jobType].filter(Boolean).join(" · ")}</span>
          )}
        </Link>
        <div style={{ margin: "-6px -8px -6px 0", flexShrink: 0 }}>{actions}</div>
      </div>
      {r.skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {r.skills.slice(0, 3).map((s) => (
            <span key={s} style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, background: t.creamSoft, padding: "2px 7px", borderRadius: 999 }}>{s}</span>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px 16px", marginTop: 14 }}>
        <div>
          <div style={label}>Stage</div>
          <StageCell stage={r.stage} hasEvaluatedCandidates={r.aiScreening.evaluated > 0} onChange={onStage} frozen={isClosed || readOnly} closed={isClosed} matchedOnce={r.status === "zero"} />
        </div>
        <div>
          <div style={label}>Due date</div>
          <DueCell dueDate={r.dueDate} />
        </div>
        <div style={{ minWidth: 0, gridColumn: "1 / -1" }}>
          <div style={label}>Matches</div>
          <MatchesCell r={r} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Experience</div>
          {exp ? <Badge tone="info">{exp}</Badge> : <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>Any</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Location</div>
          <div style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal, overflowWrap: "anywhere" }}>{locationText(r) || "Not specified"}</div>
          {mode && mode !== locationText(r) && <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>{mode}</div>}
        </div>
      </div>
    </li>
  );
}
