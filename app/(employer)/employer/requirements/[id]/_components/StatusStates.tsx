"use client";

import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyNote, LinkCta } from "@/employer/_requirementAtoms";

export function GeneratingState({ stalled, onRetry }: { stalled: boolean; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-hx-line bg-white p-10 text-center">
      <div role="status" aria-live="polite" className="grid justify-items-center gap-2.5">
        {!stalled && <Spinner aria-hidden="true" />}
        <h2 className="m-0 text-[20px] font-semibold text-hx-coal">{stalled ? "Matching is taking longer than usual" : "Matching candidates…"}</h2>
        <p className="m-0 max-w-[460px] text-[15px] text-hx-ink-soft">
          {stalled
            ? "Your job is saved and matching is still running. You haven't been charged. Check again, or come back in a few minutes."
            : "We're scoring active candidates against this requirement. This usually takes under a minute, and this page updates by itself."}
        </p>
        {stalled && (
          <Button type="button" variant="outline" onClick={onRetry} className="mt-1 gap-1.5 pointer-coarse:h-11">
            <RefreshCwIcon size={14} aria-hidden="true" /> Check again
          </Button>
        )}
      </div>
    </div>
  );
}

export function ZeroMatchState({ canEdit, requirementId }: { canEdit: boolean; requirementId: string }) {
  return (
    <EmptyNote
      title="No matches yet"
      action={
        canEdit ? (
          <LinkCta variant="outline" href={`/employer/requirements/${requirementId}/edit`}>
            Edit this requirement
          </LinkCta>
        ) : undefined
      }
    >
      No candidates currently practicing on HireStepX match this requirement closely enough to shortlist. Try widening the location or
      notice period, or check back as more candidates practice this week. We re-run matching every night.
    </EmptyNote>
  );
}

export function FailedState({ requirementId, canEdit }: { requirementId: string; canEdit: boolean }) {
  return (
    <EmptyNote
      title="Matching failed"
      action={
        canEdit ? (
          /* Links to THIS requirement's edit form, not a blank one: saving it,
             even unchanged, re-runs matching. A new form would create a duplicate. */
          <LinkCta href={`/employer/requirements/${requirementId}/edit`} icon={<RefreshCwIcon size={14} aria-hidden="true" />}>
            Retry matching
          </LinkCta>
        ) : undefined
      }
    >
      Something went wrong generating this shortlist. You haven&apos;t been charged.{" "}
      {canEdit ? "Saving this posting again will retry the match." : "Editing is turned off while your account is suspended."}
    </EmptyNote>
  );
}
