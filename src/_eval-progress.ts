/* Report-grading progress stages. Shared by server-handlers (writer) and the
   report loading screen (reader), so it stays dependency-free and edge-safe.
   Stages are only ever set at points evaluate-session really reaches; the
   single LLM call has no finer-grained progress to report. */

export const EVAL_STAGES = ["preparing", "generating", "retrying", "finalising"] as const;
export type EvalStage = (typeof EVAL_STAGES)[number];

export function parseEvalStage(raw: unknown): EvalStage | null {
  return typeof raw === "string" && (EVAL_STAGES as readonly string[]).includes(raw) ? (raw as EvalStage) : null;
}

/** Later stages win, so a slow or out-of-order poll response can't move the indicator backwards. */
export function mergeEvalStage(prev: EvalStage | null, next: EvalStage | null): EvalStage | null {
  if (!next) return prev;
  if (!prev) return next;
  return EVAL_STAGES.indexOf(next) >= EVAL_STAGES.indexOf(prev) ? next : prev;
}

export const EVAL_STEP_LABELS = ["Reading your transcript", "Scoring and writing coaching", "Finishing up"] as const;

/** Which of EVAL_STEP_LABELS is active; a retry stays on the scoring step. */
export function evalStageStep(stage: EvalStage): 0 | 1 | 2 {
  if (stage === "preparing") return 0;
  if (stage === "finalising") return 2;
  return 1;
}

export function evalStageMessage(stage: EvalStage): string {
  switch (stage) {
    case "preparing": return "Reading your transcript…";
    case "generating": return "Scoring your answers and drafting coach notes…";
    case "retrying": return "Taking a little longer than usual. Trying again…";
    case "finalising": return "Putting your report together…";
  }
}
