"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import type { Requirement } from "@/employer/EmployerDataContext";
import { SkillChip } from "@/employer/_panelParts";
import { budgetLabel, experienceLabel, roleDetailRows } from "./requirementFormat";

interface OverviewRow {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

/* Department is in the header meta line, tiers in Key requirements, openings and notice period in the side rail. */
const SHOWN_ELSEWHERE = new Set(["Department", "Nice to have", "Other skills", "Open positions", "Notice period"]);

function overviewRows(r: Requirement): OverviewRow[] {
  const rows: OverviewRow[] = [];
  const add = (label: string, value: ReactNode | null | undefined) => {
    if (value != null && value !== "") rows.push({ label, value });
  };
  add("Experience", experienceLabel(r.experienceMin, r.experienceMax)?.replace(" experience", ""));
  add("Budget", budgetLabel(r));
  add("Duration", r.durationWeeks ? `${r.durationWeeks} weeks` : null);
  add("Hours", r.hoursPerWeek ? `${r.hoursPerWeek} hrs/week` : null);
  for (const row of roleDetailRows(r)) {
    if (SHOWN_ELSEWHERE.has(row.label)) continue;
    rows.push({
      label: row.label,
      wide: row.wide,
      value: row.tags ? (
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {row.tags.map((tag) => (
            <SkillChip key={tag} tone="neutral">
              {tag}
            </SkillChip>
          ))}
        </span>
      ) : (
        row.text
      ),
    });
  }
  return rows;
}

export function hasRoleDetails(r: Requirement): boolean {
  return overviewRows(r).length > 0;
}

/** Everything the posting form collected that the header and Key requirements
    don't already show, so nothing is listed twice. The header owns the toggle
    and the heading; this is only the body. */
export default function JobOverview({ requirement }: { requirement: Requirement }) {
  const rows = overviewRows(requirement);
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className={cn("min-w-0", row.wide && "sm:col-span-2 lg:col-span-4")}>
          <dt className="text-[12px] text-hx-ink-soft">{row.label}</dt>
          <dd className={cn("m-0 mt-0.5 text-[14px] whitespace-pre-wrap [overflow-wrap:anywhere]", row.wide ? "max-w-[75ch] leading-relaxed text-hx-ink-soft" : "font-medium text-hx-coal")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
