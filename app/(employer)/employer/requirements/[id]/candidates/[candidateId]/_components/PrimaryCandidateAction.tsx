import { LockIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import { formatPaise, singleUnlockPrice } from "../../../../../../../../server-handlers/_unlock-pricing";
import { HEADER_ACTION } from "./helpers";

/** The one next step for this candidate: reopen when rejected, unlock when locked, invite once unlocked. Shared by the header and the sticky bar. */
export function PrimaryCandidateAction({
  candidate,
  declined,
  suspended,
  onUnlock,
  onInvite,
  onReopen,
}: {
  candidate: Candidate;
  declined: boolean;
  suspended: boolean;
  onUnlock: () => void;
  onInvite: () => void;
  onReopen: () => void;
}) {
  if (candidate.candidateStatus === "rejected") {
    return (
      <Button type="button" variant="outline" onClick={onReopen} disabled={suspended || declined} className={cn("gap-1.5 pointer-coarse:h-11", HEADER_ACTION)}>
        <RotateCcwIcon size={14} aria-hidden="true" />
        Reopen
        <span className="sr-only"> and move back to To review</span>
      </Button>
    );
  }
  if (!candidate.unlocked) {
    return (
      <Button type="button" onClick={onUnlock} disabled={suspended} className={cn("gap-1.5 pointer-coarse:h-11", HEADER_ACTION)}>
        <LockIcon size={14} aria-hidden="true" />
        Unlock for {formatPaise(singleUnlockPrice().amountPaise)}
        <span className="sr-only"> to reveal identity and contact details and send an invite</span>
      </Button>
    );
  }
  if (!canInviteToInterview(candidate.candidateStatus)) return null;
  return (
    <Button type="button" onClick={onInvite} disabled={suspended || declined} className={cn("pointer-coarse:h-11", HEADER_ACTION)}>
      Send interview invite
    </Button>
  );
}
