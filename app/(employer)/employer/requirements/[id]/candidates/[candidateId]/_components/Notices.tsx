import { InlineNotice, LinkCta } from "@/employer/_requirementAtoms";
import type { ActionNotice } from "./useCandidateDetail";

export function ActionNoticeAlert({ notice, shortlistHref }: { notice: ActionNotice; shortlistHref: string }) {
  if (notice.kind === "unlock_required") {
    return (
      <InlineNotice
        tone="warning"
        title="Unlock required"
        action={<LinkCta href={shortlistHref} size="sm" variant="outline">Unlock from the shortlist</LinkCta>}
      >
        {notice.message}
      </InlineNotice>
    );
  }
  if (notice.kind === "declined") {
    return <InlineNotice tone="error" title="Candidate declined contact">{notice.message}</InlineNotice>;
  }
  return <InlineNotice tone="warning" title="Action not allowed">{notice.message}</InlineNotice>;
}
