import { RejectDialog } from "./CandidateDialogs";
import { ActionNoticeAlert } from "./Notices";
import InterviewInviteDialog from "@/employer/InterviewInviteDialog";
import type { ActionNotice } from "./useCandidateDetail";
import type { CandidateStatus } from "@/employer/mockData";
import { useToast } from "@/Toast";

type ChangeStatus = (c: { status: CandidateStatus; note?: string; scheduledAt?: string }) => Promise<boolean>;

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
}: {
  dialog: "invite" | "reject" | null;
  onClose: () => void;
  displayName: string;
  requirementTitle: string;
  notice: ActionNotice | null;
  shortlistHref: string;
  changeStatus: ChangeStatus;
}) {
  const { toast } = useToast();
  const common = { displayName, requirementTitle, notice, shortlistHref };
  return (
    <>
      <InterviewInviteDialog
        displayName={displayName}
        requirementTitle={requirementTitle}
        notice={notice ? <ActionNoticeAlert notice={notice} shortlistHref={shortlistHref} /> : null}
        open={dialog === "invite"}
        onOpenChange={(o) => !o && onClose()}
        onSubmit={async ({ note, scheduledAt }) => {
          const ok = await changeStatus({ status: "interview_invited", note, scheduledAt });
          if (ok) toast("Interview invite sent", "success");
          return { ok };
        }}
      />
      <RejectDialog
        {...common}
        open={dialog === "reject"}
        onOpenChange={(o) => !o && onClose()}
        onSubmit={async ({ note }) => {
          const ok = await changeStatus({ status: "rejected", note });
          if (ok) toast("Candidate marked as rejected", "success");
          return ok;
        }}
      />
    </>
  );
}
