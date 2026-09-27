import SessionHistoryDesign from "@/SessionHistoryDesign";
import { RICH_SESSIONS } from "./fixtures";

/* variant="detail" is the component's own in-shell Q&A transcript view
   (not the /session/[id] production route) — a real, reachable branch of
   SessionHistoryDesign, distinct from the production report. */
export default function InShellDetail() {
  return (
    <SessionHistoryDesign
      variant="detail"
      initialSessions={RICH_SESSIONS}
      theme="hirestepx"
      allowReport
    />
  );
}
