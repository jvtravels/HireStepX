"use client";

import { useEffect, useState } from "react";
import { LockIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { InlineNotice } from "@/employer/_requirementAtoms";
import type { UnlockedCandidate } from "@/employer/_requirementCalls";
import type { EmployerAccess } from "@/employer/_useEmployerAccess";
import { creditToApply, formatPaise, singleUnlockPrice, unlockRateNote } from "../../../../../../server-handlers/_unlock-pricing";
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

  const { fetchCredit } = useEmployerData();
  const [balancePaise, setBalancePaise] = useState(0);
  const open = target != null;
  useEffect(() => {
    if (!open) return;
    let live = true;
    void fetchCredit().then((c) => { if (live) setBalancePaise(c?.balancePaise ?? 0); });
    return () => { live = false; };
  }, [open, fetchCredit]);

  const amountPaise = target?.mode === "batch" ? target.amountPaise : singleUnlockPrice().amountPaise;
  const creditPaise = creditToApply(amountPaise, balancePaise);
  const cashPaise = amountPaise - creditPaise;
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
              ? `One payment reveals the name and email of the ${target.count} locked candidate${target.count === 1 ? "" : "s"} ranked ${target.start} to ${target.end} and lets you message them and move them through interviews.${target.remaining > 0 ? ` ${target.remaining} more stay locked further down.` : ""}`
              : "One payment reveals this candidate's name and email, and lets you message them and move them to interview."}
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: "grid", gap: 10, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
          <p className="mx-fade m-0 rounded-[10px] bg-hx-row px-3 py-2 text-[13px] leading-normal text-hx-coal">
            <strong className="tabular-nums">{rate.perCandidate} per candidate.</strong>{" "}
            {rate.savings ?? rate.batchHint}
          </p>
          <p style={{ margin: 0, fontSize: textSize.sm, lineHeight: 1.5 }}>
            {priceText} is the amount charged; GST applies as set out in the{" "}
            <a href="/terms#employers" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>employer terms</a>.
            Unlocks are not refunded in cash once contact details are delivered. If a candidate declines, withdraws, blocks you, or doesn&apos;t answer an interview invite within 14 days, the price comes back automatically as credit toward your next unlock. See the{" "}
            <a href="/refund#employers" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>refund policy</a>.
          </p>
          {creditPaise > 0 && (
            <p className="m-0 rounded-[10px] bg-hx-row px-3 py-2 text-[13px] leading-normal text-hx-coal">
              <strong className="tabular-nums">{formatPaise(creditPaise)} account credit applied.</strong>{" "}
              {cashPaise === 0 ? "Nothing to pay." : `${formatPaise(cashPaise)} left to pay.`}
            </p>
          )}
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
        </div>
        <DialogFooter>
          <OutlineCta onClick={close} disabled={busy}>
            Cancel
          </OutlineCta>
          <PrimaryCta onClick={confirm} loading={busy} icon={<LockIcon size={14} aria-hidden="true" />}>
            {cashPaise === 0 ? (busy ? "Unlocking…" : "Use credit and unlock") : busy ? "Waiting for payment…" : `Pay ${formatPaise(cashPaise)} and unlock`}
          </PrimaryCta>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
