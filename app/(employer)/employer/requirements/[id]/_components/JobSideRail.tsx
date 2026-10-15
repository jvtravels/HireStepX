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

function InsightPill({ insight, active, onSelect }: { insight: JobInsight; active: boolean; onSelect: () => void }) {
  const Icon = INSIGHT_ICON[insight.id] ?? UsersIcon;
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`${insight.text} ${active ? "Showing these candidates. Select to show everyone." : "Show these candidates."}`}
        className={cn(
          "inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2.5 text-left text-[13px] leading-snug text-hx-coal transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11",
          active ? "border-hx-indigo bg-hx-indigo-100" : "border-hx-line bg-white hover:bg-hx-row",
        )}
      >
        <Icon size={14} aria-hidden="true" className="shrink-0 text-hx-indigo" />
        <span>{insight.text}</span>
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

const dueText = (r: Requirement) => {
  const due = r.dueDate ? dueLabel(r.dueDate) : null;
  return due ? <span className={cn(due.overdue && "text-hx-error-ink")}>{due.text}</span> : null;
};

/** The right-hand column of the job screen: posting facts and the posting's
    talent preferences as two small cards. Every row is drawn from fields the
    API returns; empty ones are skipped. */
export default function JobSideRail({
  requirement,
  readOnly,
  suspended,
  onStageChange,
}: {
  requirement: Requirement;
  readOnly: boolean;
  suspended: boolean;
  onStageChange: Parameters<typeof StageCell>[0]["onChange"];
}) {
  const r = requirement;
  const canEdit = !readOnly && !suspended;
  const preferences = [
    { label: "Industry", value: r.preferredIndustry },
    { label: "Domain", value: r.preferredDomain },
    { label: "Availability", value: r.availability && r.availability !== "Any" ? r.availability : null },
    { label: "Notice period", value: r.noticePeriodPref && r.noticePeriodPref !== "Any" ? r.noticePeriodPref : null },
    { label: "Portfolio / GitHub", value: r.portfolioRequired ? <Badge tone="success">Preferred</Badge> : null },
  ];
  const hasPreferences = preferences.some((p) => p.value);

  return (
    <aside aria-label="Job summary" className="grid min-w-0 content-start gap-4 sm:max-[1439px]:grid-cols-2">
      <Panel id="details-heading" title="Job details">
        <KeyValueList>
          <Rows
            rows={[
              { label: "Posted", value: timeAgoLabel(r.createdAt) },
              { label: "Last matched", value: timeAgoLabel(r.lastMatchedAt) },
              { label: "Openings", value: r.openPositions != null ? String(r.openPositions) : null },
              { label: "Due", value: dueText(r) },
            ]}
          />
          <KeyValueRow label="Hiring stage">
            <span title={suspended ? "Stage changes are turned off while your account is suspended." : STAGE_HINT[r.stage]} className="inline-flex">
              <StageCell stage={r.stage} hasEvaluatedCandidates={r.candidates.length > 0} onChange={onStageChange} frozen={readOnly || suspended} />
            </span>
          </KeyValueRow>
        </KeyValueList>
      </Panel>

      <Panel
        id="preferences-heading"
        title="Talent preferences"
        action={canEdit ? <PanelLink href={`/employer/requirements/${r.id}/edit`}>Edit</PanelLink> : undefined}
      >
        {hasPreferences ? (
          <KeyValueList>
            <Rows rows={preferences} />
          </KeyValueList>
        ) : (
          <p className="m-0 text-[13px] text-hx-ink-soft">No preferences set for this role yet.</p>
        )}
      </Panel>
    </aside>
  );
}

/** Plain-language insights as a one-line strip between the header and the
    candidates table. Each one doubles as a filter on that table. */
export function JobInsights({
  insights,
  activeInsightId,
  onSelectInsight,
}: {
  insights: JobInsight[];
  activeInsightId: string | null;
  onSelectInsight: (id: string | null) => void;
}) {
  if (insights.length === 0) return null;
  return (
    <section aria-labelledby="insights-heading" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="insights-heading" className="m-0 text-[15px] font-semibold text-hx-coal">
        Key insights
      </h2>
      <ul className="m-0 flex min-w-0 list-none flex-wrap gap-2 p-0">
        {insights.map((insight) => (
          <InsightPill
            key={insight.id}
            insight={insight}
            active={insight.id === activeInsightId}
            onSelect={() => onSelectInsight(insight.id === activeInsightId ? null : insight.id)}
          />
        ))}
      </ul>
    </section>
  );
}
