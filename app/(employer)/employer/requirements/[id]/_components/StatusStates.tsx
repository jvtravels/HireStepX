"use client";

import { RefreshCwIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/employer/_atoms";
import { EmptyNote, LinkCta } from "@/employer/_requirementAtoms";

export function GeneratingState() {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div role="status" aria-live="polite" style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        <Spinner aria-hidden="true" />
        <h2 style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 600, color: t.coal, margin: 0 }}>Matching candidates…</h2>
        <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkFaint, margin: 0, maxWidth: 460 }}>
          We&apos;re scoring active candidates against this requirement. This usually takes under a minute, and this page updates by itself.
        </p>
      </div>
    </Card>
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
