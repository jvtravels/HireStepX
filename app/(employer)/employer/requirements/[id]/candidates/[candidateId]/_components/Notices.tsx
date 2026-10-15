import { LockIcon } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
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

/** Contact row shown in the header while the candidate is still masked. */
export function LockedContact({ shortlistHref }: { shortlistHref: string }) {
  return (
    <Item variant="muted" size="sm">
      <ItemMedia variant="icon"><LockIcon aria-hidden="true" /></ItemMedia>
      <ItemContent>
        <ItemDescription className="line-clamp-none text-[13px] text-hx-ink-soft">Name, phone, email and links unlock together.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <LinkCta href={shortlistHref} size="sm" variant="outline">Unlock from the shortlist</LinkCta>
      </ItemActions>
    </Item>
  );
}

export function LockedQuotes({ shortlistHref }: { shortlistHref: string }) {
  return (
    <Item variant="muted">
      <ItemMedia variant="icon"><LockIcon aria-hidden="true" /></ItemMedia>
      <ItemContent>
        <ItemTitle>Verbatim quotes are locked</ItemTitle>
        <ItemDescription className="line-clamp-none text-[13px]">What this candidate said in practice sessions is shown once you unlock them.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <LinkCta href={shortlistHref} size="sm" variant="outline">Unlock to read quotes</LinkCta>
      </ItemActions>
    </Item>
  );
}
