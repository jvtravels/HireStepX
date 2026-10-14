"use client";

import Link from "next/link";
import { CheckCircle2Icon, ChevronRightIcon, CodeXmlIcon, FileCheckIcon, MicIcon, SlidersHorizontalIcon, UsersIcon, ZapIcon, type LucideIcon } from "lucide-react";
import type { Requirement } from "@/employer/EmployerDataContext";
import { jobInsights, matchingSummary, pipelineSteps, type CandidateTab } from "@/employer/_jobDetailHelpers";

const INSIGHT_ICON: Record<string, LucideIcon> = {
  strong: CheckCircle2Icon,
  "all-must": FileCheckIcon,
  "top-gap": SlidersHorizontalIcon,
  interview: MicIcon,
  portfolio: CodeXmlIcon,
  immediate: ZapIcon,
};

/** Where the hiring stands plus plain-language findings, at the bottom of the
    job card. It stays out of the way when the data has nothing to say. */
export default function JobInsightsStrip({
  requirement,
  canEdit,
  onSelectTab,
}: {
  requirement: Requirement;
  canEdit: boolean;
  onSelectTab: (tab: CandidateTab) => void;
}) {
  const insights = jobInsights(requirement);
  const steps = pipelineSteps(requirement.candidates);
  const match = matchingSummary(requirement);
  const pool = Math.max(requirement.totalMatched ?? 0, match.evaluated);
  const hiddenPool = pool - match.evaluated;
  if (steps[0].count === 0 && insights.length === 0 && hiddenPool <= 0) return null;

  return (
    <section aria-label="Pipeline and insights for this job" className="mt-5 border-t border-hx-line pt-4">
      {steps[0].count > 0 && (
        <ol aria-label="Hiring pipeline" className="m-0 mb-3 grid list-none grid-cols-3 gap-1 p-0 sm:flex sm:flex-wrap sm:items-center">
          {steps.map((step, i) => (
            <li key={step.key} className="flex items-center gap-1 max-sm:min-w-0">
              {i > 0 && <ChevronRightIcon size={14} aria-hidden="true" className="text-hx-ink-soft max-sm:hidden" />}
              <button
                type="button"
                onClick={() => onSelectTab(step.tab)}
                aria-label={`${step.count} ${step.label.toLowerCase()}. Show these candidates`}
                className="inline-flex w-full cursor-pointer items-baseline gap-1.5 rounded-md sm:w-auto border-0 bg-transparent px-2 py-1 text-[13px] text-hx-ink-soft transition-colors duration-150 ease-out hover:bg-hx-row hover:text-hx-coal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11"
              >
                <span className="text-[15px] font-semibold text-hx-coal tabular-nums">{step.count}</span>
                {step.label}
              </button>
            </li>
          ))}
        </ol>
      )}
      {insights.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
          {insights.map((insight) => {
            const Icon = INSIGHT_ICON[insight.id] ?? UsersIcon;
            return (
              <li key={insight.id} className="flex items-center gap-2 text-[13px] text-hx-coal">
                <Icon size={14} aria-hidden="true" className="shrink-0 text-hx-indigo" />
                <span>{insight.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {hiddenPool > 0 && (
        <p className="m-0 mt-2 text-[12.5px] text-hx-ink-soft first:mt-0">
          Showing the {match.evaluated} best of {pool} matched candidates, ranked by fit.
          {canEdit && (
            <>
              {" "}
              <Link
                href={`/employer/requirements/${requirement.id}/edit`}
                className="rounded-sm font-semibold text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo"
              >
                Refine criteria
              </Link>{" "}
              to change who ranks first.
            </>
          )}
        </p>
      )}
    </section>
  );
}
