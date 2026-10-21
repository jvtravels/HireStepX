import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { evalStageMessage, type EvalStage } from "../_eval-progress";
import ReportProgress from "./ReportProgress";
import { ReportFrame, ReportBody } from "./panels/sr-ReportFrame";

const WAITING_MESSAGES = [
  "Reading your transcript…",
  "Scoring your delivery…",
  "Looking for patterns worth practising…",
  "Drafting coach notes…",
] as const;

/* Fresh sessions only: the report is still being graded (20 to 90 seconds).
   The three-step list appears once the server reports a real stage, so it never
   claims progress the server has not made. */
export function SessionReportEvaluating({
  stage,
  onBack,
  backLabel,
}: {
  stage: EvalStage | null;
  onBack: () => void;
  backLabel: string;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % WAITING_MESSAGES.length), 2400);
    return () => window.clearInterval(id);
  }, []);
  const message = stage ? evalStageMessage(stage) : WAITING_MESSAGES[idx];

  return (
    <ReportFrame>
      <ReportBody>
        <div aria-busy="true" className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-16 text-center">
          <Spinner aria-hidden="true" className="size-7 text-hx-copper" />
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-xl font-semibold tracking-tight text-hx-coal">Coaching your report</h2>
            <p role="status" className="m-0 text-sm text-hx-ink-soft">{message}</p>
          </div>
          {stage && <ReportProgress stage={stage} />}
          <p className="m-0 text-xs text-hx-ink-soft">
            Usually 20 to 40 seconds. Can take up to 90 when our AI provider is busy.
          </p>
          <Button type="button" variant="ghost" onClick={onBack}>
            ← {backLabel}
          </Button>
        </div>
      </ReportBody>
    </ReportFrame>
  );
}
