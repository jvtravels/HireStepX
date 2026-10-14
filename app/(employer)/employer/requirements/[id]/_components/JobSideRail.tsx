"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2Icon, ClockIcon, CodeXmlIcon, FileCheckIcon, SearchIcon, SlidersHorizontalIcon, UsersIcon, ZapIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Badge, StageCell } from "@/employer/_atoms";
import type { Requirement } from "@/employer/EmployerDataContext";
import { KeyValueList, KeyValueRow, MeterBar, Panel, PanelButton, PanelLink } from "@/employer/_panelParts";
import { EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import {
  jobInsights,
  matchingSummary,
  pipelineRows,
  type CandidateTab,
  type JobInsight,
} from "@/employer/_jobDetailHelpers";
import { budgetLabel, dueLabel, experienceLabel, STAGE_HINT, timeAgoLabel } from "./requirementFormat";

const INSIGHT_ICON: Record<string, LucideIcon> = {
  strong: CheckCircle2Icon,
  "all-must": FileCheckIcon,
  "top-gap": SlidersHorizontalIcon,
  portfolio: CodeXmlIcon,
  immediate: ZapIcon,
};

const MATCH_STATE: Record<ReturnType<typeof matchingSummary>["state"], { label: string; tone: "success" | "info" | "warning" }> = {
  complete: { label: "Complete", tone: "success" },
  running: { label: "Running", tone: "info" },
  stopped: { label: "Stopped", tone: "warning" },
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-[26px] leading-none font-semibold text-hx-coal tabular-nums">{value}</div>
      <div className="mt-1.5 text-[13px] text-hx-ink-soft">{label}</div>
    </div>
  );
}

function InsightRow({ insight }: { insight: JobInsight }) {
  const Icon = INSIGHT_ICON[insight.id] ?? UsersIcon;
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-snug text-hx-coal">
      <span aria-hidden="true" className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-hx-indigo-100 text-hx-indigo">
        <Icon size={13} />
      </span>
      <span className="pt-0.5">{insight.text}</span>
    </li>
  );
}

function DetailRows({ requirement }: { requirement: Requirement }) {
  const r = requirement;
  const due = r.dueDate ? dueLabel(r.dueDate) : null;
  const rows: Array<{ label: string; value: ReactNode }> = [];
  const add = (label: string, value: ReactNode | null | undefined) => {
    if (value != null && value !== "") rows.push({ label, value });
  };
  add("Experience", experienceLabel(r.experienceMin, r.experienceMax)?.replace(" experience", ""));
  add("Budget", budgetLabel(r));
  add("Employment", r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] : null);
  add("Duration", r.durationWeeks ? `${r.durationWeeks} weeks` : null);
  add("Hours", r.hoursPerWeek ? `${r.hoursPerWeek} hrs/week` : null);
  add("Openings", r.openPositions != null ? String(r.openPositions) : null);
  add("Notice", r.noticePeriodPref && r.noticePeriodPref !== "Any" ? r.noticePeriodPref : null);
  if (due) add("Due", <span className={cn(due.overdue && "text-hx-error-ink")}>{due.text}</span>);
  return (
    <>
      {rows.map((row) => (
        <KeyValueRow key={row.label} label={row.label}>
          {row.value}
        </KeyValueRow>
      ))}
    </>
  );
}

export default function JobSideRail({
  requirement,
  counts,
  onSelectTab,
  readOnly,
  suspended,
  onStageChange,
}: {
  requirement: Requirement;
  counts: Record<CandidateTab, number>;
  onSelectTab: (tab: CandidateTab) => void;
  readOnly: boolean;
  suspended: boolean;
  onStageChange: Parameters<typeof StageCell>[0]["onChange"];
}) {
  const [moreDetails, setMoreDetails] = useState(false);
  const match = matchingSummary(requirement);
  const insights = jobInsights(requirement);
  const editHref = `/employer/requirements/${requirement.id}/edit`;
  const canEdit = !readOnly && !suspended;
  const state = MATCH_STATE[match.state];
  const pool = Math.max(requirement.totalMatched ?? 0, match.evaluated);
  const rows = pipelineRows(counts).filter((row) => row.tab !== "hired" || row.count > 0);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel id="matching-heading" title="Candidate matching" action={<Badge tone={state.tone}>{state.label}</Badge>}>
        <div className="flex gap-8">
          <Stat value={match.evaluated} label="Evaluated" />
          <Stat value={match.recommended} label="Recommended" />
        </div>
        <div className="mt-4">
          <MeterBar value={match.coverage} label={`${match.evaluated} of ${pool} matched candidates evaluated`} />
          <p className="mt-2 mb-0 text-[12px] text-hx-ink-soft">
            {match.evaluated} of {pool} matched {pool === 1 ? "candidate" : "candidates"} shown
          </p>
        </div>
        {canEdit && (
          <Link
            href={editHref}
            className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-hx-line bg-white px-3 text-[13px] font-semibold text-hx-coal no-underline transition-colors duration-150 hover:bg-hx-row focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11"
          >
            <SearchIcon size={14} aria-hidden="true" />
            Expand search for more candidates
          </Link>
        )}
      </Panel>

      <Panel id="pipeline-heading" title="Hiring pipeline" action={<PanelLink href="/employer">View analytics →</PanelLink>}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((row) => (
            <li key={row.tab}>
              <button
                type="button"
                onClick={() => onSelectTab(row.tab)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-lg border-0 px-3 py-2 text-left text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11",
                  row.highlight ? "bg-hx-success-100 font-semibold text-hx-success-ink" : "bg-transparent text-hx-coal hover:bg-hx-row",
                )}
              >
                <span>{row.label}</span>
                <span className="tabular-nums">{row.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="preferences-heading" title="Talent preferences" action={canEdit ? <PanelLink href={editHref}>Edit</PanelLink> : undefined}>
        <KeyValueList>
          <KeyValueRow label="Industry">{requirement.preferredIndustry || "Any"}</KeyValueRow>
          <KeyValueRow label="Domain">{requirement.preferredDomain || "Any"}</KeyValueRow>
          <KeyValueRow label="Availability">{requirement.availability || "Any"}</KeyValueRow>
          <KeyValueRow label="Portfolio / GitHub">
            {requirement.portfolioRequired ? <Badge tone="success">Preferred</Badge> : "Optional"}
          </KeyValueRow>
        </KeyValueList>
      </Panel>

      {insights.length > 0 && (
        <Panel id="insights-heading" title="Key insights" icon={<ClockIcon size={14} />}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {insights.map((insight) => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </ul>
        </Panel>
      )}

      <Panel id="details-heading" title="Job details" action={<PanelButton onClick={() => setMoreDetails((v) => !v)} expanded={moreDetails}>{moreDetails ? "View less" : "View more"}</PanelButton>}>
        <KeyValueList>
          <KeyValueRow label="Posted">{timeAgoLabel(requirement.createdAt)}</KeyValueRow>
          {requirement.lastMatchedAt && <KeyValueRow label="Updated">{timeAgoLabel(requirement.lastMatchedAt)}</KeyValueRow>}
          <KeyValueRow label="Stage">
            <span title={suspended ? "Stage changes are turned off while your account is suspended." : STAGE_HINT[requirement.stage]} className="inline-flex">
              <StageCell stage={requirement.stage} hasEvaluatedCandidates={requirement.candidates.length > 0} onChange={onStageChange} frozen={readOnly || suspended} />
            </span>
          </KeyValueRow>
          {moreDetails && <DetailRows requirement={requirement} />}
        </KeyValueList>
      </Panel>
    </div>
  );
}
