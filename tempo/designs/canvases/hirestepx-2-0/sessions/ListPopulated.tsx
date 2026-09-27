import SessionHistoryDesign from "@/SessionHistoryDesign";
import { RICH_SESSIONS } from "./fixtures";

/* allowDelete=true also turns on drafts (allowDrafts mirrors allowDelete
   inside SessionHistoryDesign) — this one storyboard demonstrates every
   card variant (draft, each score band, deltas, signature strip,
   badges) plus the drafts + delete capability at once. */
export default function ListPopulated() {
  return (
    <SessionHistoryDesign
      initialSessions={RICH_SESSIONS}
      theme="hirestepx"
      allowDelete
      allowReport
    />
  );
}
