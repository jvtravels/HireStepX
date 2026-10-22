import { Fragment } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import type { CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { NEGATIVE_STATUSES, PIPELINE_STEPS } from "./helpers";

export function PipelineStepper({ status, className }: { status: CandidateStatus; className?: string }) {
  const negative = NEGATIVE_STATUSES.includes(status);
  const current = negative ? -1 : PIPELINE_STEPS.indexOf(status);
  return (
    <ol aria-label="Hiring pipeline" className={cn("m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 min-[640px]:flex min-[640px]:flex-wrap min-[640px]:items-center min-[640px]:gap-x-1.5 min-[640px]:gap-y-1", className)}>
      {PIPELINE_STEPS.map((step, i) => {
        const reached = !negative && i <= current;
        const isCurrent = i === current;
        const done = reached && !isCurrent;
        return (
          <Fragment key={step}>
            {i > 0 && <li aria-hidden="true" className={cn("hidden h-px w-4 shrink-0 min-[640px]:block", i <= current ? "bg-hx-indigo" : "bg-hx-line")} />}
            <li aria-current={isCurrent ? "step" : undefined} className="inline-flex items-center gap-1.5 text-[12px]">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isCurrent ? "border-hx-success-ink bg-hx-success-ink" : done ? "border-hx-indigo bg-hx-indigo" : "border-hx-line bg-white",
                )}
              >
                {(isCurrent || done) && <CheckIcon size={10} strokeWidth={3} className="text-white" />}
              </span>
              <span className={cn(isCurrent ? "font-semibold text-hx-success-ink" : reached ? "text-hx-coal" : "text-hx-ink-soft")}>
                {CANDIDATE_STATUS_LABEL[step]}
              </span>
              <span className="sr-only">{isCurrent ? "Current stage" : done ? "Completed" : "Not reached"}</span>
            </li>
          </Fragment>
        );
      })}
      {negative && (
        <>
          <li aria-hidden="true" className="hidden h-px w-4 shrink-0 bg-hx-line min-[640px]:block" />
          <li aria-current="step" className="inline-flex items-center gap-1.5 text-[12px]">
            <span
              aria-hidden="true"
              className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", status === "no_response" ? "bg-hx-ink-soft" : "bg-hx-error-ink")}
            >
              <XIcon size={10} strokeWidth={3} className="text-white" />
            </span>
            <span className={cn("font-semibold", status === "no_response" ? "text-hx-neutral-ink" : "text-hx-error-ink")}>{CANDIDATE_STATUS_LABEL[status]}</span>
            <span className="sr-only">Current stage</span>
          </li>
        </>
      )}
    </ol>
  );
}
