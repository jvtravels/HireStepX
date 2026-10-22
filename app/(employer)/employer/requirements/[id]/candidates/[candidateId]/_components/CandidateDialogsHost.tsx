import { RejectDialog } from "./CandidateDialogs";
import { ActionNoticeAlert } from "./Notices";
import InterviewInviteDialog from "@/employer/InterviewInviteDialog";
import type { ActionNotice } from "./useCandidateDetail";
import type { CandidateStatus } from "@/employer/mockData";
import { useToast } from "@/Toast";
import { useEffect, useRef } from "react";
import { undoable } from "../../../_components/shortlistSelection";

type ChangeStatus = (c: { status: CandidateStatus; note?: string; candidateMessage?: string; scheduledAt?: string }) => Promise<boolean>;

/** Wires the two dialogs to `changeStatus` and owns the success toasts, so the
 *  dialogs stay presentational and the page stays small. */
export function CandidateDialogsHost({
  dialog,
  onClose,
  displayName,
  requirementTitle,
  notice,
  shortlistHref,
  changeStatus,
  candidateId,
  currentStatus,
}: {
  dialog: "invite" | "reject" | null;
  onClose: () => void;
  displayName: string;
  requirementTitle: string;
  notice: ActionNotice | null;
  shortlistHref: string;
  changeStatus: ChangeStatus;
  candidateId: string;
  /** The stage before any change here, which is where Undo returns to. */
  currentStatus: CandidateStatus;
}) {
  const { toast } = useToast();
  // The Undo outlives this render, so it must call the latest changeStatus or a failed undo would roll back to stale data.
  const latestChange = useRef(changeStatus);
  useEffect(() => { latestChange.current = changeStatus; });
  const common = { displayName, requirementTitle, notice, shortlistHref };
  return (
    <>
      <InterviewInviteDialog
        displayName={displayName}
        requirementTitle={requirementTitle}
        notice={notice ? <ActionNoticeAlert notice={notice} shortlistHref={shortlistHref} /> : null}
        open={dialog === "invite"}
        onOpenChange={(o) => !o && onClose()}
        onSubmit={async ({ message, scheduledAt }) => {
          const ok = await changeStatus({ status: "interview_invited", candidateMessage: message, scheduledAt });
          if (ok) toast("Interview invite sent", "success");
          return { ok };
        }}
      />
      <RejectDialog
        {...common}
        open={dialog === "reject"}
        onOpenChange={(o) => !o && onClose()}
        onSubmit={async ({ note, candidateMessage }) => {
          const ok = await changeStatus({ status: "rejected", note, candidateMessage });
          if (ok) {
            const back = undoable([{ id: candidateId, from: currentStatus, to: "rejected" }]).length > 0;
            toast("Candidate marked as rejected. They've been notified.", "success", back ? {
              action: {
                label: "Undo",
                onClick: () => void latestChange.current({ status: currentStatus }).then((restored) =>
                  toast(restored ? "Candidate restored." : "Couldn't undo that. Please try again.", restored ? "success" : "error")),
              },
            } : undefined);
          }
          return ok;
        }}
      />
    </>
  );
}
