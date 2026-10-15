import { cn } from "cn";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL, CandidateStatusChip } from "@/employer/_atoms";
import { MeterBar, Panel } from "@/employer/_panelParts";
import { NEGATIVE_STATUSES, PIPELINE_STEPS } from "./helpers";

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

export function CandidateRail({ candidate }: { candidate: Candidate }) {
  return (
    <aside aria-label="Candidate summary" className="grid min-w-0 content-start gap-4 min-[1440px]:sticky min-[1440px]:top-0">
      <Panel id="pipeline-heading" title="Hiring pipeline">
        <PipelineRows status={candidate.candidateStatus} />
      </Panel>
    </aside>
  );
}
