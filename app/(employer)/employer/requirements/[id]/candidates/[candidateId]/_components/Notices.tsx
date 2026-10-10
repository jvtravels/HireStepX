import { Lock, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { UnlockLink } from "./parts";
import type { ActionNotice } from "./useCandidateDetail";

/* Every notice carries an icon and explicit text, so colour is never the only signal. */

const WARNING = "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 *:data-[slot=alert-description]:text-amber-900/90 dark:*:data-[slot=alert-description]:text-amber-200/90";

export function SuspendedBanner() {
  return (
    <Alert className={WARNING}>
      <TriangleAlert />
      <AlertTitle>Your account is suspended</AlertTitle>
      <AlertDescription>
        This candidate view is read-only. You can review evidence but can't invite, reject or message candidates until support restores access.
      </AlertDescription>
    </Alert>
  );
}

export function ActionNoticeAlert({ notice, shortlistHref }: { notice: ActionNotice; shortlistHref: string }) {
  if (notice.kind === "unlock_required") {
    return (
      <Alert role="alert" className={cn(WARNING, "items-center sm:pr-52 has-data-[slot=alert-action]:pr-2.5")}>
        <TriangleAlert />
        <AlertTitle>Unlock required</AlertTitle>
        <AlertDescription>{notice.message}</AlertDescription>
        <div className="col-start-2 mt-2">
          <UnlockLink href={shortlistHref} size="sm">Unlock from the shortlist</UnlockLink>
        </div>
      </Alert>
    );
  }
  if (notice.kind === "declined") {
    return (
      <Alert role="alert" variant="destructive">
        <TriangleAlert />
        <AlertTitle>Candidate declined contact</AlertTitle>
        <AlertDescription>{notice.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert role="alert" className={WARNING}>
      <TriangleAlert />
      <AlertTitle>Action not allowed</AlertTitle>
      <AlertDescription>{notice.message}</AlertDescription>
    </Alert>
  );
}

/** Contact row shown in the header while the candidate is still masked. */
export function LockedContact({ shortlistHref }: { shortlistHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock aria-hidden="true" className="size-4 shrink-0" />
        Name, phone, email and links unlock together.
      </p>
      <UnlockLink href={shortlistHref} size="sm">Unlock from the shortlist</UnlockLink>
    </div>
  );
}

export function LockedQuotes({ shortlistHref }: { shortlistHref: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Lock aria-hidden="true" className="size-4" />
        Verbatim quotes are locked
      </p>
      <p>What this candidate actually said in practice sessions is shown once you unlock them.</p>
      <UnlockLink href={shortlistHref} size="sm">Unlock to read quotes</UnlockLink>
    </div>
  );
}
