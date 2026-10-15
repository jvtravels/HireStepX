"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2Icon,
  CodeXmlIcon,
  FileCheckIcon,
  MicIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Badge, StageCell } from "@/employer/_atoms";
import type { Requirement } from "@/employer/EmployerDataContext";
import {
  KeyValueList,
  KeyValueRow,
  Panel,
  PanelLink,
} from "@/employer/_panelParts";
import type { JobInsight } from "@/employer/_jobDetailHelpers";
import { dueLabel, STAGE_HINT, timeAgoLabel } from "./requirementFormat";

const INSIGHT_ICON: Record<string, LucideIcon> = {
  strong: CheckCircle2Icon,
  "all-must": FileCheckIcon,
  "top-gap": SlidersHorizontalIcon,
  interview: MicIcon,
  portfolio: CodeXmlIcon,
  immediate: ZapIcon,
};

function InsightRow({ insight, active, onSelect }: { insight: JobInsight; active: boolean; onSelect: () => void }) {
  const Icon = INSIGHT_ICON[insight.id] ?? UsersIcon;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`${insight.text} ${active ? "Showing these candidates. Select to show everyone." : "Show these candidates."}`}
        className={cn(
          "flex w-full cursor-pointer items-start gap-2.5 rounded-lg border-0 px-2 py-1.5 text-left text-[13px] leading-snug text-hx-coal transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11",
          active ? "bg-hx-indigo-100" : "bg-transparent hover:bg-hx-row",
        )}
      >
        <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-hx-indigo-100 text-hx-indigo">
          <Icon size={13} />
        </span>
        <span className="pt-0.5">{insight.text}</span>
      </button>
    </li>
  );
}

function Rows({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode | null | undefined }>;
}) {
  return (
    <>
      {rows
        .filter((row) => row.value != null && row.value !== "")
        .map((row) => (
          <KeyValueRow key={row.label} label={row.label}>
            {row.value}
          </KeyValueRow>
        ))}
    </>
  );
}

/** The right-hand column of the job screen: posting facts, the posting's
    talent preferences and plain-language insights.
    Every row is drawn from fields the API returns; empty ones are skipped. */
export default function JobSideRail({
  requirement,
  insights,
  activeInsightId,
  onSelectInsight,
  readOnly,
  suspended,
  onStageChange,
}: {
  requirement: Requirement;
  insights: JobInsight[];
  activeInsightId: string | null;
  onSelectInsight: (id: string | null) => void;
  readOnly: boolean;
  suspended: boolean;
  onStageChange: Parameters<typeof StageCell>[0]["onChange"];
}) {
  const r = requirement;
  const editHref = `/employer/requirements/${r.id}/edit`;
  const canEdit = !readOnly && !suspended;
  const due = r.dueDate ? dueLabel(r.dueDate) : null;
  const posted = timeAgoLabel(r.createdAt);
  const matched = timeAgoLabel(r.lastMatchedAt);

  const preferences = [
    { label: "Industry", value: r.preferredIndustry },
    { label: "Domain", value: r.preferredDomain },
    {
      label: "Availability",
      value: r.availability && r.availability !== "Any" ? r.availability : null,
    },
    {
      label: "Notice period",
      value:
        r.noticePeriodPref && r.noticePeriodPref !== "Any"
          ? r.noticePeriodPref
          : null,
    },
    {
      label: "Portfolio / GitHub",
      value: r.portfolioRequired ? (
        <Badge tone="success">Preferred</Badge>
      ) : null,
    },
  ];
  const hasPreferences = preferences.some((p) => p.value);

  return (
    <aside
      aria-label="Job summary"
      className="grid min-w-0 content-start gap-4 sm:max-[1439px]:grid-cols-2"
    >
      <Panel id="details-heading" title="Job details">
        <KeyValueList>
          <Rows
            rows={[
              { label: "Posted", value: posted },
              { label: "Last matched", value: matched },
              {
                label: "Openings",
                value: r.openPositions != null ? String(r.openPositions) : null,
              },
              {
                label: "Due",
                value: due ? (
                  <span className={cn(due.overdue && "text-hx-error-ink")}>
                    {due.text}
                  </span>
                ) : null,
              },
            ]}
          />
          <KeyValueRow label="Hiring stage">
            <span
              title={
                suspended
                  ? "Stage changes are turned off while your account is suspended."
                  : STAGE_HINT[r.stage]
              }
              className="inline-flex"
            >
              <StageCell
                stage={r.stage}
                hasEvaluatedCandidates={r.candidates.length > 0}
                onChange={onStageChange}
                frozen={readOnly || suspended}
              />
            </span>
          </KeyValueRow>
        </KeyValueList>
      </Panel>

      {hasPreferences && (
        <Panel
          id="preferences-heading"
          title="Talent preferences"
          action={
            canEdit ? <PanelLink href={editHref}>Edit</PanelLink> : undefined
          }
        >
          <KeyValueList>
            <Rows rows={preferences} />
          </KeyValueList>
        </Panel>
      )}

      {insights.length > 0 && (
        <Panel id="insights-heading" title="Key insights">
          <ul className="m-0 -mx-2 flex list-none flex-col gap-1 p-0">
            {insights.map((insight) => (
              <InsightRow
                key={insight.id}
                insight={insight}
                active={insight.id === activeInsightId}
                onSelect={() => onSelectInsight(insight.id === activeInsightId ? null : insight.id)}
              />
            ))}
          </ul>
        </Panel>
      )}
    </aside>
  );
}
