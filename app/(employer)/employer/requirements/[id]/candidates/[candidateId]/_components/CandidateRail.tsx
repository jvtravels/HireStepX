import { CheckCircle2Icon, TrendingUpIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL, CandidateStatusChip } from "@/employer/_atoms";
import { MeterBar, Panel } from "@/employer/_panelParts";
import { NEGATIVE_STATUSES, PIPELINE_STEPS } from "./helpers";
import { IconList } from "./parts";

function PipelineRows({ status }: { status: CandidateStatus }) {
  const negative = NEGATIVE_STATUSES.includes(status);
  const current = negative ? -1 : PIPELINE_STEPS.indexOf(status);
  return (
    <>
      <ol aria-label="Hiring pipeline" className="m-0 flex list-none flex-col gap-1 p-0">
        {PIPELINE_STEPS.map((step, i) => {
          const reached = !negative && i <= current;
          const isCurrent = i === current;
          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg px-3 py-2 text-[13px]",
                isCurrent ? "bg-hx-success-100 font-semibold text-hx-success-ink" : reached ? "text-hx-coal" : "text-hx-ink-soft",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span>{CANDIDATE_STATUS_LABEL[step]}</span>
                <span className="text-[12px] font-normal">{isCurrent ? "Current" : reached ? "Done" : ""}</span>
              </span>
              <span aria-hidden="true">
                <MeterBar thin tone={isCurrent ? "success" : "indigo"} value={reached ? 100 : 0} label={`${CANDIDATE_STATUS_LABEL[step]} stage`} />
              </span>
              <span className="sr-only">{isCurrent ? "Current stage" : reached ? "Completed" : "Not reached"}</span>
            </li>
          );
        })}
      </ol>
      {negative && <div className="mt-3"><CandidateStatusChip status={status} /></div>}
    </>
  );
}

export function CandidateRail({ candidate, insights }: { candidate: Candidate; insights: string[] }) {
  const all = candidate.unlocked ? (candidate.resume?.keyAchievements ?? []).filter((a) => a.trim()) : [];
  const highlights = [...all.filter((a) => /\d/.test(a)), ...all.filter((a) => !/\d/.test(a))].slice(0, 4);
  return (
    <aside aria-label="Candidate summary" className="grid min-w-0 content-start gap-4 sm:max-[1439px]:block sm:max-[1439px]:columns-2 sm:max-[1439px]:gap-4 min-[1440px]:sticky min-[1440px]:top-0">
      <div className="break-inside-avoid sm:max-[1439px]:mb-4"><Panel id="pipeline-heading" title="Hiring pipeline">
        <PipelineRows status={candidate.candidateStatus} />
      </Panel></div>

      {insights.length > 0 && (
        <div className="break-inside-avoid sm:max-[1439px]:mb-4"><Panel id="insights-heading" title="Key insights">
          <ul className="m-0 -mx-2 flex list-none flex-col gap-1 p-0">
            {insights.map((text) => (
              <li key={text} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13px] leading-snug text-hx-coal">
                <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-hx-indigo-100 text-hx-indigo">
                  <CheckCircle2Icon size={13} />
                </span>
                <span className="pt-0.5">{text}</span>
              </li>
            ))}
          </ul>
        </Panel></div>
      )}

      {highlights.length > 0 && (
        <div className="break-inside-avoid sm:max-[1439px]:mb-4"><Panel id="highlights-heading" title="Career highlights">
          <IconList label="Career highlights" items={highlights} icon={TrendingUpIcon} iconClassName="size-4 text-hx-success" />
        </Panel></div>
      )}
    </aside>
  );
}
