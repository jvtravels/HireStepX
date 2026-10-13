import { EVAL_STEP_LABELS, evalStageStep, type EvalStage } from "../_eval-progress";

/* Three-step indicator driven by the server-reported grading stage. Rendered
   only once the server has actually reported a stage. */
export default function ReportProgress({ stage }: { stage: EvalStage }) {
  const active = evalStageStep(stage);
  return (
    <ol className="mx-auto mt-2 flex list-none flex-col gap-2 p-0 text-sm" aria-label="Report progress">
      {EVAL_STEP_LABELS.map((label, i) => {
        const state = i < active ? "done" : i === active ? "active" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "active" ? "step" : undefined}
            className={`flex items-center gap-2 ${state === "todo" ? "opacity-40" : ""} ${state === "active" ? "font-medium" : ""}`}
          >
            <span aria-hidden="true" className="inline-block w-4 text-center">
              {state === "done" ? "✓" : state === "active" ? "•" : "○"}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
