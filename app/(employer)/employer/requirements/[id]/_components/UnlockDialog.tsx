"use client";

import { useEffect, useState } from "react";
import { LockIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { GST_SHORT_LINE } from "@/employer/_employerOffer";
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
  nextBatch = null,
  onChooseBatch,
}: {
  target: UnlockTarget | null;
  access: EmployerAccess;
  onClose: () => void;
  onUnlocked: (candidates: UnlockedCandidate[]) => void;
  /** The page's next batch of locked candidates, offered as a cheaper per-candidate rate from the single-unlock dialog. */
  nextBatch?: Extract<UnlockTarget, { mode: "batch" }> | null;
  onChooseBatch?: (batch: Extract<UnlockTarget, { mode: "batch" }>) => void;
}) {
  const { start, busy, paying, error, clearError } = useUnlockCheckout({
    tier: access.tier,
    limit: access.limits?.unlocksPerDay ?? null,
    onUnlocked,
  });

  const { fetchCredit } = useEmployerData();
  const [balancePaise, setBalancePaise] = useState(0);
  // Until the balance arrives the price to pay is unknown, so the button stays neutral rather than flipping from "Pay" to "Use credit".
  const [creditLoaded, setCreditLoaded] = useState(false);
  const open = target != null;
  useEffect(() => {
    if (!open) return;
    let live = true;
    setCreditLoaded(false);
    void fetchCredit().then((c) => {
      if (!live) return;
      setBalancePaise(c?.balancePaise ?? 0);
      setCreditLoaded(true);
    });
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
            {GST_SHORT_LINE} See the{" "}
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
          {target?.mode === "single" && nextBatch && onChooseBatch && (
            <p className="m-0 text-[13px] leading-normal">
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline" onClick={() => onChooseBatch(nextBatch)} disabled={busy}>
                Unlock the next {nextBatch.count} as a batch for {formatPaise(nextBatch.amountPaise)}
              </button>{" "}
              for a lower rate per candidate.
            </p>
          )}
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
        </div>
        <DialogFooter>
          <OutlineCta onClick={close} disabled={busy}>
            Cancel
          </OutlineCta>
          <PrimaryCta onClick={confirm} loading={busy} disabled={!creditLoaded} icon={<LockIcon size={14} aria-hidden="true" />}>
            {!creditLoaded ? "Unlock" : cashPaise === 0 ? (busy ? "Unlocking…" : "Use credit and unlock") : busy ? "Waiting for payment…" : `Pay ${formatPaise(cashPaise)} and unlock`}
          </PrimaryCta>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
