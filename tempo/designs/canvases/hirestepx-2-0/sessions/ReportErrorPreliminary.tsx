import { ErrorShell } from "@/sessionReport/SessionReport";
import { PRELIMINARY_FIXTURE } from "./fixtures";

export default function ReportErrorPreliminary() {
  return (
    <ErrorShell
      message="Our AI scoring service is temporarily unavailable."
      onRetry={() => {}}
      onBack={() => {}}
      backLabel="Back to Sessions"
      preliminary={PRELIMINARY_FIXTURE}
    />
  );
}
