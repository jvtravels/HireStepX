import SessionHistoryDesign from "@/SessionHistoryDesign";
import { RICH_SESSIONS } from "./fixtures";

/* variant="report" is the component's own in-shell shareable-card view,
   separate from the production SessionReportView (which already has a
   dedicated, much deeper canvas at interview-result-focus). */
export default function InShellReport() {
  return (
    <SessionHistoryDesign
      variant="report"
      initialSessions={RICH_SESSIONS}
      theme="hirestepx"
      allowReport
    />
  );
}
