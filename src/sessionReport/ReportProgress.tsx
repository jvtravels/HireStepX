import { EVAL_STEP_LABELS, evalStageStep, type EvalStage } from "../_eval-progress";

/* Three-step indicator driven by the server-reported grading stage. Rendered
   only once the server has actually reported a stage. */
export default function ReportProgress({ stage }: { stage: EvalStage }) {
  const active = evalStageStep(stage);
  return (
    <ol
      aria-label="Report progress"
      className="mx-auto mt-2 flex w-full max-w-xs list-none flex-col divide-y divide-hx-line overflow-hidden rounded-xl border border-hx-line bg-white p-0 text-left text-sm"
    >
      {EVAL_STEP_LABELS.map((label, i) => {
        const state = i < active ? "done" : i === active ? "active" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "active" ? "step" : undefined}
            className={`flex items-center gap-3 px-4 py-3 ${state === "active" ? "font-medium text-hx-coal" : state === "done" ? "text-hx-ink-soft" : "text-hx-ink-soft/50"}`}
          >
            <span
              aria-hidden="true"
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${state === "done" ? "bg-emerald-600 text-white" : state === "active" ? "border-2 border-hx-copper" : "border border-hx-line"}`}
            >
              {state === "done" ? "✓" : state === "active" ? <span className="size-2 animate-pulse rounded-full bg-hx-copper" /> : null}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
