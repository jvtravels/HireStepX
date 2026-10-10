"use client";

import { LockIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { IdentityHiddenBadge, InlineNotice } from "@/employer/_requirementAtoms";
import type { UnlockedCandidate } from "@/employer/_requirementCalls";
import type { EmployerAccess } from "@/employer/_useEmployerAccess";
import { batchUnlockPrice, singleUnlockPrice } from "../../../../../../server-handlers/_unlock-pricing";
import { useUnlockCheckout, type UnlockTarget } from "./useUnlockCheckout";

function rupees(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

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

  const price = target?.mode === "batch" ? batchUnlockPrice(target.count) : singleUnlockPrice();
  const priceText = rupees(price.amountPaise);
  const title =
    target?.mode === "batch"
      ? `Unlock candidates ${target.start}–${target.end} for ${priceText}?`
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
              ? `One payment reveals the name and email of ${target.count} candidate${target.count === 1 ? "" : "s"} and lets you message them and move them through interviews.`
              : "One payment reveals this candidate's name and email, and lets you message them and move them to interview."}
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: "grid", gap: 10, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <IdentityHiddenBadge compact />
            <span>until payment is confirmed.</span>
          </div>
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
