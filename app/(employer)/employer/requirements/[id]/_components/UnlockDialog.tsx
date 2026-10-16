"use client";

import { LockIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { IdentityHiddenBadge, InlineNotice } from "@/employer/_requirementAtoms";
import type { UnlockedCandidate } from "@/employer/_requirementCalls";
import type { EmployerAccess } from "@/employer/_useEmployerAccess";
import { formatPaise, singleUnlockPrice, unlockRateNote } from "../../../../../../server-handlers/_unlock-pricing";
import { useUnlockCheckout, type UnlockTarget } from "./useUnlockCheckout";

/** The single page-level unlock confirmation, for both one candidate and a
    batch. Replaces one Dialog per table row. */
export default function UnlockDialog({
  target,
  access,
  onClose,
  onUnlocked,
}: {
  target: UnlockTarget | null;
  access: EmployerAccess;
  onClose: () => void;
  onUnlocked: (candidates: UnlockedCandidate[]) => void;
}) {
  const { start, busy, paying, error, clearError } = useUnlockCheckout({
    tier: access.tier,
    limit: access.limits?.unlocksPerDay ?? null,
    onUnlocked,
  });

  const amountPaise = target?.mode === "batch" ? target.amountPaise : singleUnlockPrice().amountPaise;
  const priceText = formatPaise(amountPaise);
  const rate = unlockRateNote(target?.mode === "batch" ? target.count : 1, amountPaise);
  const title =
    target?.mode === "batch"
      ? `Unlock ${target.count} candidate${target.count === 1 ? "" : "s"} for ${priceText}?`
      : `Unlock this candidate for ${priceText}?`;

  const confirm = async () => {
    if (!target) return;
    const done = await start(target);
    if (done) onClose();
  };

  const close = () => {
    if (busy) return;
    clearError();
    onClose();
  };

  return (
    <Dialog open={target != null} modal={!paying} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent aria-describedby="unlock-dialog-desc">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="unlock-dialog-desc">
            {target?.mode === "batch"
              ? `One payment reveals the name and email of the ${target.count} locked candidate${target.count === 1 ? "" : "s"} ranked ${target.start}–${target.end} and lets you message them and move them through interviews.${target.remaining > 0 ? ` ${target.remaining} more stay locked further down.` : ""}`
              : "One payment reveals this candidate's name and email, and lets you message them and move them to interview."}
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: "grid", gap: 10, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
          <div><IdentityHiddenBadge compact /></div>
          <p className="mx-fade m-0 rounded-[10px] bg-hx-row px-3 py-2 text-[13px] leading-normal text-hx-coal">
            <strong className="tabular-nums">{rate.perCandidate} per candidate.</strong>{" "}
            {rate.savings ?? rate.batchHint}
          </p>
          <p style={{ margin: 0, fontSize: textSize.sm, lineHeight: 1.5 }}>
            {priceText} is the amount charged; GST applies as set out in the{" "}
            <a href="/terms#employers" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>employer terms</a>.
            Unlocks are non-refundable once contact details are delivered, except where a candidate becomes unavailable or the law requires. See the{" "}
            <a href="/refund#employers" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>refund policy</a>.
          </p>
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
        </div>
        <DialogFooter>
          <OutlineCta onClick={close} disabled={busy}>
            Cancel
          </OutlineCta>
          <PrimaryCta onClick={confirm} loading={busy} icon={<LockIcon size={14} aria-hidden="true" />}>
            {busy ? "Waiting for payment…" : `Pay ${priceText} and unlock`}
          </PrimaryCta>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
