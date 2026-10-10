"use client";

/* One Razorpay unlock flow for both single and batch purchases (previously two
   copy-pasted implementations). Errors are returned as strings for inline
   display next to the Confirm button, not thrown or toasted. */

import { useCallback, useState } from "react";
import { tokens as t } from "@/auth/_tokens";
import { createUnlockOrder, failureMessage, verifyUnlockPayment, type UnlockedCandidate } from "@/employer/_requirementCalls";
import type { EmployerTier } from "../../../../../../server-handlers/_employer-trust";

export type UnlockTarget =
  | { mode: "single"; matchId: string }
  | { mode: "batch"; requirementId: string; count: number; start: number; end: number };

/** Dynamically loads the Razorpay checkout script with the CSP nonce. A script
    tag without the nonce is silently blocked under strict-dynamic. */
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content");
    if (nonce) s.nonce = nonce;
    const timer = setTimeout(() => { s.remove(); reject(new Error("timeout")); }, 10_000);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error("load failed")); };
    document.head.appendChild(s);
  });
}

/** The global Window.Razorpay type (src/dashboardComponents.tsx) types `on`'s
    callback as zero-arg, but payment.failed passes a response object. Method
    syntax here keeps the assignment from `new window.Razorpay()` legal without
    a cast. */
interface RazorpayHandle {
  open(): void;
  on(event: string, cb: (response?: unknown) => void): void;
}

function paymentFailureText(response: unknown): string {
  if (response && typeof response === "object" && "error" in response) {
    const err = response.error;
    if (err && typeof err === "object") {
      if ("description" in err && typeof err.description === "string" && err.description) return err.description;
      if ("reason" in err && typeof err.reason === "string" && err.reason) return err.reason;
    }
  }
  return "Payment failed. You haven't been charged for an unlock, so you can try again.";
}

type Outcome = { kind: "paid"; candidates: UnlockedCandidate[] } | { kind: "cancelled" } | { kind: "error"; message: string };

export function useUnlockCheckout({
  tier,
  limit,
  onUnlocked,
}: {
  tier: EmployerTier | null;
  limit: number | null;
  onUnlocked: (candidates: UnlockedCandidate[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  /** True while the Razorpay window is open, so the host dialog can step out
      of the way of its focus trap. */
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /** Resolves true when the unlock completed (so the caller can close its dialog). */
  const start = useCallback(
    async (target: UnlockTarget): Promise<boolean> => {
      setBusy(true);
      setError(null);

      const order = await createUnlockOrder(
        target.mode === "single" ? { mode: "single", matchId: target.matchId } : { mode: "batch", requirementId: target.requirementId },
      );
      if (!order.ok) {
        setError(failureMessage("unlock", order, { tier, limit }));
        setBusy(false);
        return false;
      }

      try {
        await loadRazorpayScript();
      } catch {
        setError("The payment window failed to load. Check your connection and try again.");
        setBusy(false);
        return false;
      }
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        setError("The payment window isn't available. Refresh the page and try again.");
        setBusy(false);
        return false;
      }

      setPaying(true);
      const outcome = await new Promise<Outcome>((resolve) => {
        const rzp: RazorpayHandle = new Razorpay({
          key: order.data.keyId,
          amount: order.data.amount,
          currency: order.data.currency,
          name: order.data.name,
          description: order.data.description,
          order_id: order.data.orderId,
          theme: { color: t.indigo },
          method: { upi: true, card: true, netbanking: true, wallet: true },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            const verified = await verifyUnlockPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (!verified.ok || verified.data.candidates.length === 0) {
              resolve({
                kind: "error",
                message: `Your payment went through but we couldn't confirm the unlock. Don't pay again. Contact support@hirestepx.com with payment ID ${response.razorpay_payment_id}.`,
              });
              return;
            }
            resolve({ kind: "paid", candidates: verified.data.candidates });
          },
          modal: { ondismiss: () => resolve({ kind: "cancelled" }) },
        });
        // payment.failed leaves the Razorpay window open for a retry, so it
        // shows the reason but does not settle the flow.
        rzp.on("payment.failed", (response) => setError(paymentFailureText(response)));
        rzp.open();
      });
      setPaying(false);
      setBusy(false);

      if (outcome.kind === "paid") {
        setError(null);
        onUnlocked(outcome.candidates);
        return true;
      }
      if (outcome.kind === "error") setError(outcome.message);
      return false;
    },
    [tier, limit, onUnlocked],
  );

  return { start, busy, paying, error, clearError };
}
