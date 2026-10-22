"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { InfoTip } from "@/employer/_panelParts";
import type { JobMatch } from "../DashboardJobs";
import { hoursOrDaysAgo } from "../hiringMatchFormat";
import { buildJobTimeline, type TimelineStep } from "../jobTimeline";
import { H2_FLUSH, SEC } from "./styles";

const MAX_VISIBLE = 6;

function When({ step }: { step: TimelineStep }) {
  if (!step.at) return null;
  const text = step.key === "interview"
    ? new Date(step.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : hoursOrDaysAgo(step.at);
  return <span className="shrink-0 text-[12px] leading-5 text-hx-ink-soft">{text}</span>;
}

function Marker({ state }: { state: TimelineStep["state"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-[1] mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
        state === "done" && "border-hx-success-ink bg-hx-success-ink",
        state === "action" && "border-hx-indigo bg-white",
        state === "waiting" && "border-dashed border-hx-ink-soft bg-white",
      )}
    >
      {state === "done" && <CheckIcon size={10} strokeWidth={3} className="text-white" />}
      {state === "action" && <span className="size-1.5 rounded-full bg-hx-indigo" />}
    </span>
  );
}

const STATE_SR: Record<TimelineStep["state"], string> = { done: "Done", action: "Needs you", waiting: "Waiting" };

export default function JobProgress({ job, closed, invited, onOpenRequests }: {
  job: JobMatch;
  closed: boolean;
  invited: boolean;
  onOpenRequests: () => void;
}) {
  const all = buildJobTimeline(job, { closed, invited });
  const steps = all.length > MAX_VISIBLE ? all.slice(all.length - MAX_VISIBLE) : all;
  const standing = job.fitStanding;
  return (
    <section aria-labelledby="job-progress-heading" className={SEC}>
      <div className="flex items-center gap-1">
        <h2 id="job-progress-heading" className={H2_FLUSH}>Where things stand</h2>
        <InfoTip compact label="About this timeline">Everything that has happened on this role so far, in order, and what is waiting on you.</InfoTip>
      </div>
      <ol aria-label="Progress on this role" className="m-0 mt-4 grid list-none gap-0 p-0">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[7.5px] top-5 bottom-0 w-px bg-hx-line" />}
            <Marker state={step.state} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={cn("text-[14px] leading-6", step.state === "done" ? "text-hx-coal" : "font-medium text-hx-coal")}>
                  {step.label}
                  <span className="sr-only">{`, ${STATE_SR[step.state]}`}</span>
                </span>
                <When step={step} />
              </div>
              {step.detail && <p className="m-0 text-[13px] leading-5 text-hx-ink-soft">{step.detail}</p>}
              {step.key.startsWith("asked-") && (
                <button type="button" onClick={onOpenRequests} className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-hx-indigo underline-offset-4 hover:underline pointer-coarse:-my-[13px] pointer-coarse:py-[13px]">
                  Respond
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {standing && (
        <p className="m-0 mt-4 border-t border-hx-line pt-4 text-[13px] leading-5 text-hx-ink-soft">
          Your fit is higher than <span className="font-medium text-hx-coal tabular-nums">{standing.beatenPct}%</span> of the {standing.pool} candidates matched to this role.
        </p>
      )}
    </section>
  );
}
