import { useState, useEffect, useRef, memo, Fragment } from "react";
import { captureClientEvent } from "./posthogClient";
import dynamic from "next/dynamic";
import { c, font } from "./tokens";
import { tokens as T } from "./auth/_tokens";
import { scoreLabel, scoreLabelColor } from "./dashboardTypes";
import type { DashboardSession } from "./dashboardTypes";
import { FREE_SESSION_LIMIT, STARTER_WEEKLY_LIMIT, PRO_MONTHLY_LIMIT, SINGLE_SESSION_PRICE } from "./dashboardData";
import { SectionErrorBoundary } from "./ErrorBoundary";

// Cream/indigo/copper results report — ported from the `interview-result`
// Tempo canvas. Lazy-loaded to keep the dashboard hero bundle slim.
const SessionReport = dynamic(() => import("./sessionReport/SessionReport").then((m) => ({ default: m.SessionReport })), {
  ssr: false,
});

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: () => void) => void };
  }
}

/* ─── Skeleton Loading ─── */
export function DashboardSkeleton() {
  return (
    <div style={{ padding: "32px 0" }}>
      <div className="skeleton skeleton-heading" style={{ width: "40%" }} />
      <div className="skeleton skeleton-text" style={{ width: "65%", marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text-sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 28, width: "40%", marginBottom: 8 }} />
            <div className="skeleton skeleton-text-sm" style={{ width: "60%" }} />
          </div>
        ))}
      </div>
      <div className="skeleton-card" style={{ marginBottom: 16 }}>
        <div className="skeleton skeleton-text" style={{ width: "30%" }} />
        <div className="skeleton" style={{ height: 120, width: "100%" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[1, 2].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text" style={{ width: "45%" }} />
            <div className="skeleton skeleton-text" style={{ width: "80%" }} />
            <div className="skeleton skeleton-text" style={{ width: "60%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataLoadingSkeleton() {
  const [showSlowMsg, setShowSlowMsg] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSlowMsg(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ padding: "32px 0" }}>
      {showSlowMsg && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>Still loading... check your connection if this persists.</p>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div className="skeleton skeleton-heading" style={{ width: 280 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 200 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 36 }} />
          <div className="skeleton" style={{ width: 80, height: 36 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text-sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 28, width: "35%", marginBottom: 8 }} />
            <div className="skeleton skeleton-text-sm" style={{ width: "55%" }} />
          </div>
        ))}
      </div>
      <div className="skeleton-card" style={{ marginBottom: 24, padding: "24px 32px" }}>
        <div className="skeleton skeleton-text" style={{ width: "50%" }} />
        <div className="skeleton skeleton-text" style={{ width: "70%", marginBottom: 16 }} />
        <div className="skeleton" style={{ width: 140, height: 40 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(0, 320px)", gap: 20 }} className="dash-skeleton-grid">
        <div className="skeleton-card" style={{ minHeight: 200 }}>
          <div className="skeleton skeleton-text" style={{ width: "30%" }} />
          <div className="skeleton" style={{ height: 140, width: "100%", marginTop: 12 }} />
        </div>
        <div className="skeleton-card" style={{ minHeight: 200 }}>
          <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          <div className="skeleton skeleton-text" style={{ width: "90%", marginTop: 12 }} />
          <div className="skeleton skeleton-text" style={{ width: "75%" }} />
          <div className="skeleton skeleton-text" style={{ width: "85%" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Upgrade Modal ─── */
const PLANS_ALL = [
  { id: "free",    tier: "free",    name: "Free",        price: "\u20B90",   unit: "forever",   sub: "Try before you pay a rupee",         cta: "Start free",       features: [`${FREE_SESSION_LIMIT} mock sessions`, "Behavioural rounds + basic STAR score", "Email report", "Saved report for 7 days", "No credit card required"],                                                                                               featured: false, hidden: false },
  { id: "single",  tier: "free",    name: "Per session", price: "\u20B99",   unit: "/ session", sub: "One mock, zero commitment",           cta: "Buy one session",  features: ["1 mock session", "Voice in & out, all round types", "Full STAR score + report", "Credit never expires"],                                                                                                                                       featured: false, hidden: false },
  { id: "weekly",  tier: "starter", name: "Sprint Pack", price: "\u20B939",  compareAt: "\u20B945", unit: "/ 5 sessions", sub: "Prep for your next interview",     cta: "Get Sprint Pack",  features: [`${STARTER_WEEKLY_LIMIT} sessions \u00B7 30-day validity`, "Voice in & out, all round types", "Company-specific rounds", "Skill-decay tracking", "90-day report history"],                                                                                                featured: true,  hidden: false },
  /* Monthly plan \u2014 hidden until re-enabled. Keep all data intact so re-enabling is a one-line change. */
  { id: "monthly", tier: "pro",     name: "Monthly",     price: "\u20B9149", unit: "/ 30 days", sub: "Most loved during placement season", cta: "Go monthly",       features: [`${PRO_MONTHLY_LIMIT} sessions \u00B7 30 days`, "Everything in Weekly", "Interview calendar + countdown", "Performance analytics & trends", "Export PDF, CSV, JSON", "Priority coach feedback"],                                                    featured: false, hidden: true  },
];
const PLANS_MONTHLY = PLANS_ALL.filter(p => !p.hidden);

// Rank used to determine if a plan card is "below" the user's current subscription.
// Cards at a lower rank show a non-interactive indicator instead of a checkout button
// so a Pro user never sees "Start free →" or "Go weekly →" while managing their plan.
const TIER_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, team: 3 };


export const UpgradeModal = memo(function UpgradeModal({ onClose, sessionsUsed: _sessionsUsed, user, currentTier, starterExhausted, onPaymentSuccess, onCreditPurchase }: { onClose: () => void; sessionsUsed: number; user?: { id?: string; email?: string; name?: string } | null; currentTier: string; starterExhausted?: boolean; onPaymentSuccess: (tier: string, start: string, end: string) => void; onCreditPurchase?: (newBalance: number) => void }) {
  // Cream palette shadow — matches the marketing /pricing page and settings repaint.
  // Intentionally shadows the dark `c`/`font` imports for the entire UpgradeModal scope.
  const c = {
    obsidian: T.cream, graphite: T.creamRaised, carbon: T.creamSoft,
    ivory: T.coal, chalk: "#3F3A33", stone: "#6B655C",
    gilt: T.copper, giltDark: T.copperDark, giltLight: T.copper100,
    sage: T.success, ember: T.error,
    slate: T.indigo,
    border: T.line, borderHover: T.lineStrong,
  };
  const font = {
    display: "'Instrument Serif', Georgia, 'Times New Roman', serif",
    ui: "'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', monospace",
  };
  const PLANS = PLANS_MONTHLY;
  // Exclude the "single" plan from the regular card loop — the null slot below
  // renders it as the interactive slider card. Keeping it in would produce a
  // duplicate "Per session" card alongside the slider.
  const plansForGrid = PLANS.filter(p => p.id !== "single");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  /* Razorpay payment.failed — separate from network/API errors so we can
     show a dedicated reassurance card (no redirect, inline retry). */
  const [paymentFailed, setPaymentFailed] = useState<{ reason: string; plan: string } | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discount_percent?: number; discount_amount?: number; final_amount?: number; code?: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  /* Quantity for single-session top-up: 1–10, backend enforces the cap. */
  const [singleQty, setSingleQty] = useState(1);

  /* Sprint Pack has no weekly reset — removed. */
  /* Live session-count social proof — fetched once on modal open from the
   * cached /api/platform-stats endpoint (Redis 1 h TTL). Falls back to null
   * so the display string shows the safe hardcoded "500+" instead. */
  const [liveSessionCount, setLiveSessionCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/platform-stats")
      .then(r => r.ok ? r.json() : null)
      .then((d: { sessionCount: number | null } | null) => {
        if (typeof d?.sessionCount === "number") setLiveSessionCount(d.sessionCount);
      })
      .catch(() => { /* leave null — UI uses fallback */ });
  }, []);
  // Store Razorpay response + plan in state so useEffect handles verification
  // (fetch inside Razorpay's handler callback doesn't work reliably)
  const [pendingVerification, setPendingVerification] = useState<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
  } | null>(null);
  const authHeadersRef = useRef<Record<string, string>>({});

  const [verifyRetries, setVerifyRetries] = useState(0);
  // Single-session purchases add credits without changing tier, so they get a
  // lightweight inline confirmation instead of the tier-change success path.
  const [creditSuccess, setCreditSuccess] = useState<number | null>(null);

  // Verify payment in React lifecycle, not in Razorpay callback
  useEffect(() => {
    if (!pendingVerification) return;
    let cancelled = false;
    setLoading("verifying");
    setError("");

    const attemptVerify = (attempt: number) => {
      fetch("/api/verify-payment", {
        method: "POST",
        headers: authHeadersRef.current,
        body: JSON.stringify(pendingVerification),
      })
        .then(r => r.json())
        .then(verifyData => {
          if (cancelled) return;
          if (verifyData.success) {
            if (verifyData.plan === "single" || pendingVerification.plan === "single") {
              // Credit added — keep the modal open with a confirmation; the user
              // can immediately start their interview (tier is unchanged).
              // Bug fix: show the number of sessions PURCHASED (quantity),
              // not the new total balance (credits). If you had 2 and bought 10,
              // the message should read "10 sessions added", not "12 sessions added".
              const purchased = typeof verifyData.quantity === "number" ? verifyData.quantity : null;
              captureClientEvent("payment_success", { plan: "single", quantity: purchased ?? 1 });
              // GA4 ecommerce — revenue visibility independent of PostHog
              if (typeof window !== "undefined" && (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag) {
                (window as unknown as { gtag: (...a: unknown[]) => void }).gtag("event", "purchase", { currency: "INR", transaction_id: pendingVerification?.razorpay_payment_id ?? "", value: 9 * (purchased ?? 1), items: [{ item_id: "single_session", item_name: "Single Interview Session", price: 9, quantity: purchased ?? 1 }] });
              }
              setCreditSuccess(purchased);
              setLoading(null);
              // Update sidebar balance immediately from the server's reported new
              // total — avoids the async re-fetch race where the user closes the
              // modal before the DB read lands and atSessionLimit stays true.
              if (typeof verifyData.credits === "number") {
                onCreditPurchase?.(verifyData.credits);
              }
              return;
            }
            captureClientEvent("payment_success", { plan: pendingVerification?.plan, tier: verifyData?.subscriptionTier });
            captureClientEvent("plan_upgraded", {
              tier: verifyData?.subscriptionTier,
              plan: pendingVerification?.plan,
            });
            // GA4 ecommerce — revenue visibility independent of PostHog
            if (typeof window !== "undefined" && (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag) {
              const planId = pendingVerification?.plan ?? "";
              const planValue = planId === "monthly" ? 149 : 39;
              (window as unknown as { gtag: (...a: unknown[]) => void }).gtag("event", "purchase", { currency: "INR", transaction_id: pendingVerification?.razorpay_payment_id ?? "", value: planValue, items: [{ item_id: planId, item_name: planId === "monthly" ? "Monthly Plan" : "Sprint Pack", price: planValue, quantity: 1 }] });
            }
            onPaymentSuccess(verifyData.subscriptionTier, verifyData.subscriptionStart, verifyData.subscriptionEnd);
          } else {
            setError(verifyData.error || "Payment verification failed. Please try again or contact hello@hirestepx.com");
            setLoading(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          // Auto-retry once after 2 seconds with user feedback
          if (attempt < 1) {
            setError("Verification taking longer than expected — retrying...");
            setTimeout(() => { if (!cancelled) attemptVerify(attempt + 1); }, 2000);
          } else {
            setError("Payment verification failed. Your payment was received — try refreshing, or contact hello@hirestepx.com for help.");
            setVerifyRetries(attempt + 1);
            setLoading(null);
          }
        });
    };

    attemptVerify(0);

    return () => { cancelled = true; };
  }, [pendingVerification, onPaymentSuccess]);

  const retryVerification = () => {
    if (pendingVerification) {
      setPendingVerification({ ...pendingVerification });
    }
  };

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    setError("");
    try {
      const hdrs = await import("./supabase").then(m => m.authHeaders());
      authHeadersRef.current = hdrs;
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: hdrs,
        // Pass the previewed promo code; the server re-validates it against the
        // ACTUAL plan and applies the discount authoritatively (an invalid code
        // is silently ignored and the user is charged full price).
        body: JSON.stringify({ plan: planId, userId: user?.id, email: user?.email, promoCode: promoResult?.valid ? promoResult.code : undefined, ...(planId === "single" ? { quantity: singleQty } : {}) }),
      });
      if (!res.ok) {
        let errMsg = "Could not start checkout. Please try again.";
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch {
          // Server returned non-JSON (e.g. Vercel crash page)
          console.error("create-order returned", res.status, "with non-JSON body");
          errMsg = res.status === 503
            ? "Payments are not configured yet. Please contact hello@hirestepx.com"
            : "Payment server error. Please try again or contact hello@hirestepx.com";
        }
        setError(errMsg);
        setLoading(null);
        return;
      }
      const data = await res.json();
      if (!data.orderId) {
        setError(data.error || "Could not start checkout. Please try again.");
        setLoading(null);
        return;
      }
      if (!window.Razorpay) {
        // Dynamically load Razorpay checkout script with retry
        const loadRzpScript = () => new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          const timer = setTimeout(() => { s.remove(); reject(new Error("timeout")); }, 10_000);
          s.onload = () => { clearTimeout(timer); resolve(); };
          s.onerror = () => { clearTimeout(timer); s.remove(); reject(); };
          document.head.appendChild(s);
        });
        try {
          await loadRzpScript();
        } catch {
          // Retry once after 1s
          try {
            await new Promise(r => setTimeout(r, 1000));
            await loadRzpScript();
          } catch {
            setError("Payment system failed to load. Check your connection and try again, or contact hello@hirestepx.com");
            setLoading(null);
            return;
          }
        }
      }

      if (!window.Razorpay) {
        setError("Payment system not available. Please refresh and try again.");
        setLoading(null);
        return;
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "HireStepX",
        description: data.description,
        order_id: data.orderId,
        prefill: { email: user?.email || "", name: user?.name || "" },
        theme: { color: c.gilt },
        handler: function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
          setPendingVerification({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan: planId,
          });
        },
        modal: {
          // ondismiss fires only after the modal painted at least once,
          // so set modalOpened here too in case the user dismisses
          // before any payment.failed event.
          ondismiss: function () { modalOpened.fired = true; setLoading(null); },
        },
      });
      // Track whether the modal actually painted so the safety timeout
      // below can distinguish "Razorpay never opened" (clear spinner)
      // from "user is mid-typing UPI" (leave spinner alone, so they
      // can't double-fire createOrder by clicking again).
      const modalOpened = { fired: false };
      (rzp as unknown as { on(event: string, cb: (r: unknown) => void): void }).on("payment.failed", function (response: unknown) {
        modalOpened.fired = true;
        const errDetail = (response as { error?: { code?: string; description?: string; reason?: string } })?.error;
        const reason = errDetail?.description || errDetail?.reason || "Unknown error";
        const code = errDetail?.code || "";
        const humanReason = code === "BAD_REQUEST_ERROR" ? reason
          : code === "GATEWAY_ERROR" ? "Payment gateway error — try a different payment method."
          : code === "SERVER_ERROR" ? "Temporary server error — your money was not charged."
          : reason;
        // Razorpay closes its sheet on payment.failed; our modal is still
        // mounted. Show an inline reassurance card rather than redirecting
        // the user out of the product to a dead-end /payment-failed page.
        captureClientEvent("payment_failed", { plan: planId, code, reason: humanReason });
        setPaymentFailed({ reason: humanReason, plan: planId });
        setLoading(null);
      });
      captureClientEvent("checkout_opened", { plan: planId });
      rzp.open();
      // Safety net: clear spinner ONLY if Razorpay never opened. Without
      // the guard, a modal that appears at 7.9s would re-enable the Pay
      // button while the user types UPI — letting them double-fire
      // createOrder and double-charge themselves.
      setTimeout(() => {
        if (!modalOpened.fired) {
          setLoading(prev => prev === planId ? null : prev);
        }
      }, 8000);
    } catch (err) {
      console.error("Checkout error:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("timeout") || msg.includes("Timeout")) {
        setError("Payment system timed out. Please check your connection and try again.");
      } else if (msg.includes("CSP") || msg.includes("Content Security Policy") || msg.includes("unsafe-eval")) {
        setError("Payment blocked by browser security settings. Try disabling browser extensions or use a different browser.");
      } else {
        setError("Something went wrong. Please try again or contact hello@hirestepx.com");
      }
      setLoading(null);
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", handleKeyDown);
    // Focus the modal container on mount (a11y: dialog focus pattern).
    // Avoids triggering :focus-visible on the close button which shows an
    // orange outline ring immediately when the modal opens via mouse click.
    modalRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- dialog backdrop dismissal
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,17,10,0.40)" }} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stops click propagation to backdrop */}
      <div ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="upgrade-modal-inner" style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 20, padding: "36px 28px 28px", maxWidth: 1120, width: "96%", maxHeight: "92vh", overflowY: "auto", position: "relative", boxShadow: "0 24px 64px rgba(20,17,10,0.18)", outline: "none" }}>
        <button onClick={onClose} aria-label="Close dialog" style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 4 }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 id="upgrade-modal-title" style={{ fontFamily: font.display, fontSize: 28, fontWeight: 400, color: c.ivory, marginBottom: 6, letterSpacing: "-0.02em" }}>More reps. More offers.</h2>
          <p style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, lineHeight: 1.5 }}>
            {currentTier === "pro" || currentTier === "team"
              ? "Add sessions — your Pro plan stays active."
              : currentTier === "starter"
              ? "Sprint Pack sessions expire with the pack. Grab another to keep going."
              : "No subscription — pay for one session or a five-session pack."}
          </p>
        </div>

        {/* ── Sprint Pack exhausted banner — only shown when sessions are used up */}
        {currentTier === "starter" && starterExhausted && (
          <div style={{ display: "flex", alignItems: "center", gap: 12,
            background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.18)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={T.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600,
                color: T.copper, margin: 0, lineHeight: 1.3 }}>
                You&apos;ve used all sessions in your Sprint Pack
              </p>
              <p style={{ fontFamily: font.ui, fontSize: 11, color: "#6B655C",
                margin: "2px 0 0", lineHeight: 1.4 }}>
                Get another Sprint Pack (₹39 · 5 sessions) or buy individual sessions below.
              </p>
            </div>
          </div>
        )}

        {/* Payment.failed inline card — keeps users in context with reassurance + retry */}
        {paymentFailed && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: "20px 20px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "#FEF3C7", border: "1px solid #FCD34D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: "#92400E", margin: "0 0 2px" }}>Payment didn&apos;t go through</p>
                <p style={{ fontFamily: font.ui, fontSize: 12, color: "#78350F", margin: "0 0 8px", lineHeight: 1.5 }}>{paymentFailed.reason}</p>
                <p style={{ fontFamily: font.ui, fontSize: 11, color: "#92400E", margin: "0 0 12px", fontWeight: 500 }}>
                  ✓ No money was debited from your account.
                </p>
                <button
                  onClick={() => { setPaymentFailed(null); handleCheckout(paymentFailed.plan); }}
                  style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: "#fff", background: "#D97706", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#FBEAE7", border: `1px solid #F2C9C2`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, textAlign: "center" }}>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.ember, display: "block", marginBottom: 8 }}>{error}</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {verifyRetries > 0 && (
                <button onClick={retryVerification} style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.graphite, background: c.ember, border: "none", borderRadius: 10, padding: "5px 14px", cursor: "pointer" }}>Retry Verification</button>
              )}
              <button onClick={() => { setError(""); setVerifyRetries(0); }} style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.gilt, background: "none", border: `1px solid ${c.borderHover}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", minHeight: 36 }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Promo Code — collapsed by default */}
        {!showPromo && !promoResult?.valid && (
          <div style={{ textAlign: "left", marginBottom: 12 }}>
            <button onClick={() => setShowPromo(true)} style={{ fontFamily: font.ui, fontSize: 12, color: c.gilt, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Have a promo code?
            </button>
          </div>
        )}
        {(showPromo || promoResult?.valid) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input type="text" value={promoCode} onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); setPromoResult(null); }}
              placeholder="Promo code" aria-label="Promo code"
              /* eslint-disable-next-line jsx-a11y/no-autofocus -- input is revealed on demand; focusing it on appear is the expected affordance. */
              autoFocus
              style={{ fontFamily: font.mono, fontSize: 12, color: c.ivory, background: "transparent", border: "none", borderBottom: `1px solid ${promoResult?.valid ? c.sage : c.borderHover}`, borderRadius: 0, padding: "6px 2px", flex: 1, outline: "none", letterSpacing: "0.04em" }}
            />
            <button disabled={promoLoading || !promoCode.trim()} onClick={async () => {
              setPromoLoading(true); setPromoError("");
              try {
                const hdrs = await import("./supabase").then(m => m.authHeaders());
                // Validate against the primary subscription plan (featured, or first non-free).
                // The actual discount is recalculated server-side at checkout — this is
                // just a preview so the user sees the savings before choosing a plan.
                const previewPlan = plansForGrid.find(p => p.featured)?.id
                  || plansForGrid.find(p => p.id !== "free")?.id
                  || "weekly";
                const res = await fetch("/api/validate-promo", { method: "POST", headers: hdrs, body: JSON.stringify({ code: promoCode.trim(), plan: previewPlan }) });
                const data = await res.json();
                if (data.valid) { setPromoResult(data); } else { setPromoError(data.error || "Invalid code"); setPromoResult(null); }
              } catch { setPromoError("Could not validate code"); }
              finally { setPromoLoading(false); }
            }} style={{
              fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.gilt, background: c.giltLight,
              border: `1px solid ${c.borderHover}`, borderRadius: 8, padding: "8px 14px", cursor: promoLoading ? "wait" : "pointer", opacity: !promoCode.trim() ? 0.5 : 1,
            }}>
              {promoLoading ? "..." : "Apply"}
            </button>
          </div>
        )}
        {promoError && <p style={{ fontFamily: font.ui, fontSize: 11, color: c.ember, marginBottom: 12, marginTop: -4 }}>{promoError}</p>}
        {promoResult?.valid && (
          <div style={{ background: "#E8F2EA", border: `1px solid #BFD9C3`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, marginTop: -4, display: "flex", alignItems: "center", gap: 8 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.sage, fontWeight: 500 }}>
              {promoResult.discount_percent ? `${promoResult.discount_percent}% off` : `₹${Math.round((promoResult.discount_amount || 0) / 100)} off`} applied!
            </span>
          </div>
        )}

        <div className="upgrade-plans-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${plansForGrid.length + 1}, 1fr)`, gap: 16, alignItems: "stretch" }}>
          {([plansForGrid[0], null, ...plansForGrid.slice(1)] as Array<typeof PLANS[0] | null>).map((plan, _idx) => {
            // null slot = Per Session card (rendered in position 2)
            if (plan === null) {
              return (
                <Fragment key="per-session">
                  {/* Slider thumb styles — scoped to .upgrade-session-slider */}
                  <style>{`
                    .upgrade-session-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; border-radius: 2px; outline: none; cursor: pointer; }
                    .upgrade-session-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #B45309; border: 2.5px solid #1A1712; box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer; }
                    .upgrade-session-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #B45309; border: 2.5px solid #1A1712; cursor: pointer; }
                    .upgrade-session-slider:focus-visible::-webkit-slider-thumb { outline: 2px solid #B45309; outline-offset: 2px; }
                  `}</style>
                  <div style={{
                    position: "relative", padding: 22, borderRadius: 20,
                    background: c.graphite,
                    border: `1px solid ${c.border}`,
                    boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
                    display: "flex", flexDirection: "column", gap: 16,
                  }}>
                    {creditSuccess !== null ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "32px 0" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E8F2EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <p style={{ margin: 0, fontFamily: font.display, fontSize: 22, fontWeight: 400, color: c.ivory, textAlign: "center" }}>
                          {creditSuccess === 1 ? "1 session" : `${creditSuccess} sessions`} added
                        </p>
                        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: c.stone, textAlign: "center" }}>
                          Close this to start your interview.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: c.gilt }}>Per Session</p>
                          <p style={{ margin: "10px 0 0", fontFamily: font.display, fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em", color: c.ivory, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                            &#x20B9;{SINGLE_SESSION_PRICE}
                            <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: c.stone }}>/ session</span>
                          </p>
                          <p style={{ margin: "8px 0 0", fontFamily: font.ui, fontSize: 13, color: c.stone }}>No subscription &#xB7; credits never expire</p>
                        </div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                          {["Voice in & out, all round types", "Full STAR score + coached answer", "Use anytime, no expiry"].map((f) => (
                            <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: font.ui, fontSize: 13, lineHeight: 1.5, color: c.chalk }}>
                              <span aria-hidden style={{ color: c.gilt, marginTop: 2, flexShrink: 0 }}>&#8594;</span>{f}
                            </li>
                          ))}
                        </ul>
                        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.stone }}>How many?</span>
                            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.gilt, fontWeight: 600 }}>&#x20B9;{SINGLE_SESSION_PRICE * singleQty} total</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => setSingleQty(q => Math.max(1, q - 1))} disabled={singleQty <= 1 || !!loading} aria-label="Remove one session"
                              style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${singleQty <= 1 ? c.border : c.borderHover}`, background: c.carbon, color: singleQty <= 1 ? c.stone : c.ivory, cursor: singleQty <= 1 || !!loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 300, opacity: singleQty <= 1 ? 0.3 : 1, transition: "opacity 0.15s, border-color 0.15s" }}>&#8722;</button>
                            <input type="range" min={1} max={10} step={1} value={singleQty} onChange={e => setSingleQty(Number(e.target.value))} disabled={!!loading} aria-label="Number of sessions" aria-valuenow={singleQty} aria-valuemin={1} aria-valuemax={10} className="upgrade-session-slider"
                              style={{ flex: 1, background: `linear-gradient(to right, #B45309 0%, #B45309 ${((singleQty - 1) / 9) * 100}%, ${c.border} ${((singleQty - 1) / 9) * 100}%, ${c.border} 100%)` }} />
                            <button onClick={() => setSingleQty(q => Math.min(10, q + 1))} disabled={singleQty >= 10 || !!loading} aria-label="Add one session"
                              style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${singleQty >= 10 ? c.border : c.gilt}`, background: singleQty >= 10 ? c.carbon : `rgba(180,83,9,0.10)`, color: singleQty >= 10 ? c.stone : c.gilt, cursor: singleQty >= 10 || !!loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 300, opacity: singleQty >= 10 ? 0.3 : 1, transition: "opacity 0.15s, border-color 0.15s, background 0.15s" }}>&#43;</button>
                          </div>
                          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, color: c.stone, textAlign: "center" }}>
                            {singleQty === 1 ? "1 session" : `${singleQty} sessions`}
                            {singleQty >= 10 && <span style={{ color: c.gilt }}> &#xB7; max per order</span>}
                          </p>
                        </div>
                        <button onClick={() => handleCheckout("single")} disabled={!!loading}
                          style={{ width: "100%", padding: "12px 18px", borderRadius: 10, border: "none", background: c.slate, color: "#FFFFFF", fontFamily: font.ui, fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading && loading !== "single" ? 0.5 : 1, boxShadow: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)", transition: "transform 0.18s ease, box-shadow 0.18s ease", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                          {loading === "single" ? "Opening Razorpay..." : loading === "verifying" ? "Verifying..."
                            : <>{singleQty === 1 ? "Buy 1 session" : `Buy ${singleQty} sessions`} &#xB7; &#x20B9;{SINGLE_SESSION_PRICE * singleQty} <span style={{ fontSize: 16 }}>&#8594;</span></>}
                        </button>
                      </>
                    )}
                  </div>
                </Fragment>
              );
            }
            const isCurrent = plan.tier === currentTier;
            // True when this card represents a lower tier than the user already has.
            // e.g. Free cards are "lower" for a Pro user.
            // Sprint Pack (weekly) is ALWAYS repurchasable — it's a consumable top-up,
            // not a subscription step, so we bypass isCurrent and isLowerTier for it.
            const isRepurchasable = plan.id === "weekly";
            const isLowerTier = !isRepurchasable && (TIER_RANK[plan.tier] ?? 0) < (TIER_RANK[currentTier] ?? 0);
            const featured = plan.featured;
            const ribbonText = featured ? "Best value" : null;
            return (
              <div key={plan.id} style={{
                position: "relative", padding: 22, borderRadius: 20,
                background: featured ? T.indigoDeep : c.graphite,
                color: featured ? c.obsidian : c.ivory,
                border: `1px solid ${featured ? T.indigoDeep : isCurrent ? c.borderHover : c.border}`,
                boxShadow: featured ? "0 1px 0 rgba(30,27,75,.04), 0 12px 32px -16px rgba(30,27,75,.40)" : "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
                display: "flex", flexDirection: "column", gap: 16,
              }}>
                {ribbonText && (
                  <span style={{
                    position: "absolute", top: -12, left: 24,
                    fontFamily: font.ui, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                    color: c.ivory, background: c.giltLight,
                    padding: "4px 10px", borderRadius: 999, border: `1px solid ${c.borderHover}`,
                  }}>{ribbonText}</span>
                )}
                <div>
                  <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: featured ? c.giltLight : c.gilt }}>{plan.name}</p>
                  {"compareAt" in plan && plan.compareAt && (
                    <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 13, color: featured ? "rgba(250,247,240,0.45)" : c.stone, textDecoration: "line-through" }}>
                      {plan.compareAt}
                    </p>
                  )}
                  <p style={{ margin: "compareAt" in plan && plan.compareAt ? "2px 0 0" : "10px 0 0", fontFamily: font.display, fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em", color: featured ? c.obsidian : c.ivory, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    {plan.price}
                    <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: featured ? "rgba(250,247,240,0.7)" : c.stone }}>
                      {plan.unit}
                    </span>
                  </p>
                  <p style={{ margin: "8px 0 0", fontFamily: font.ui, fontSize: 13, color: featured ? "rgba(250,247,240,0.72)" : c.stone }}>{plan.sub}</p>
                </div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: font.ui, fontSize: 13, lineHeight: 1.5, color: featured ? "rgba(250,247,240,0.86)" : c.chalk }}>
                      <span aria-hidden style={{ color: featured ? c.giltLight : c.gilt, marginTop: 2 }}>→</span>{f}
                    </li>
                  ))}
                </ul>

                {isCurrent && !isRepurchasable ? (
                  <div style={{ marginTop: "auto", width: "100%", padding: "12px 18px", borderRadius: 10, border: `1px solid ${featured ? "rgba(244,229,216,0.3)" : c.borderHover}`, background: "transparent", fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: featured ? c.giltLight : c.stone, textAlign: "center" }}>You&rsquo;re on this plan</div>
                ) : isLowerTier ? (
                  /* User is already on a higher tier — suppress the downgrade CTA */
                  <div style={{ marginTop: "auto", width: "100%", padding: "12px 18px", borderRadius: 10, border: `1px solid ${c.border}`, background: "transparent", fontFamily: font.ui, fontSize: 13, fontWeight: 400, color: c.stone, textAlign: "center", opacity: 0.55 }}>Not available on your plan</div>
                ) : plan.id === "free" ? (
                  <div style={{ marginTop: "auto", width: "100%", padding: "12px 18px", borderRadius: 10, border: `1px solid ${c.borderHover}`, background: "transparent", fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: c.stone, textAlign: "center" }}>
                    {currentTier === "free" ? "Your current plan" : plan.cta}
                  </div>
                ) : (
                  <button onClick={() => handleCheckout(plan.id)} disabled={!!loading}
                    style={{ marginTop: "auto", width: "100%", padding: "12px 18px", borderRadius: 10, border: "none",
                      background: featured ? c.obsidian : c.slate,
                      color: featured ? c.ivory : "#FFFFFF",
                      fontFamily: font.ui, fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer",
                      opacity: loading && loading !== plan.id ? 0.5 : 1,
                      boxShadow: featured ? "0 1px 0 rgba(244,229,216,.08), 0 8px 24px rgba(244,229,216,0.18)" : "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
                      transition: "transform 0.18s ease, box-shadow 0.18s ease",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                    onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {loading === "verifying" ? "Verifying..." : loading === plan.id ? "Opening Razorpay..." : <>{isRepurchasable && isCurrent ? "Get another Sprint Pack" : plan.cta} <span style={{ fontSize: 16 }}>→</span></>}
                  </button>
                )}
                {/* Auto-renewal disclosure — RBI / Indian payment best practice.
                    Free plan has no billing; single-session has no subscription. */}
                {/* Sprint Pack doesn't auto-renew — suppress the renewal disclosure for it */}
                {!(isCurrent && !isRepurchasable) && !isLowerTier && plan.id !== "free" && !isRepurchasable && (
                  <p style={{ margin: 0, fontFamily: font.ui, fontSize: 10, color: featured ? "rgba(250,247,240,0.45)" : c.stone, textAlign: "center", lineHeight: 1.5 }}>
                    Renews at {plan.price} {plan.unit.replace(/^\/\s*/, "every ")} · Cancel anytime from Settings
                  </p>
                )}
              </div>
            );
          })}

        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 20, padding: "14px 0", borderTop: `1px solid ${c.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex" }}>
              {[c.gilt, c.sage, c.ember].map((col, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: col, border: `2px solid ${c.carbon}`, marginLeft: i > 0 ? -6 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill={c.graphite} stroke="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: font.ui, fontSize: 11, color: c.chalk }}>
              {liveSessionCount !== null ? `${liveSessionCount}+` : "500+"} interviews practiced
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: c.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={c.gilt} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ))}
            <span style={{ fontFamily: font.ui, fontSize: 11, color: c.chalk, marginLeft: 2 }}>4.8 avg rating</span>
          </div>
        </div>

        <p style={{ fontFamily: font.ui, fontSize: 11, color: c.stone, textAlign: "center", marginTop: 8, opacity: 0.7 }}>
          Secure checkout powered by Razorpay · UPI, Cards, Netbanking · Cancel anytime from Settings ·{" "}
          <a href="/refund" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Refund policy</a>
        </p>
      </div>
    </div>
  );
});

/* ─── Pro Feature Gate ─── */
const featureHighlights: Record<string, { icon: string; items: string[] }> = {
  "Performance Analytics": { icon: "chart", items: ["Readiness score tracking", "Skill radar & velocity charts", "Score trends over time", "AI-generated insights", "Date range comparisons"] },
  "The Readiness Index": { icon: "chart", items: ["Target-specific 0-100 readiness score", "Five weighted pillars with evidence", "Skill-decay refresh queue", "Blind spots & likely follow-ups", "RI trajectory and projection"] },
  "Interview Calendar": { icon: "calendar", items: ["Month grid view", "Interview countdown timers", "Google Calendar sync", ".ics file export", "Prep reminders before interviews"] },
};

/* Per-feature gate copy. Most features are Pro-only, so the default (below)
   pitches Pro. The Interview Calendar is unlocked by ANY paid plan (a ₹39
   Sprint Pack works, not just Pro), so it gets honest copy — telling a free
   user to "Upgrade to Pro" there over-sells when the cheaper pack suffices.
   Note the Pro-only footnote is a Pro price, NOT "₹9/session": per-session
   credits and packs do NOT unlock Analytics / Readiness. */
type GateCopy = { body: string; cta: string; footnote: string };
const gateCopy: Record<string, GateCopy> = {
  "Interview Calendar": {
    body: "The Interview Calendar is included with every paid plan — month view, countdown timers, Google Calendar sync, and prep reminders.",
    cta: "See plans",
    footnote: "On any paid plan · Sprint Pack from ₹39",
  },
};

export const ProGate = memo(function ProGate({ feature, onUpgrade }: { feature: string; onUpgrade: () => void }) {
  const highlights = featureHighlights[feature];
  const copy: GateCopy = gateCopy[feature] ?? {
    body: `Upgrade to access ${feature.toLowerCase()}. Unlock full analytics, calendar tools, and unlimited sessions with the Pro plan.`,
    cta: "Upgrade to Pro",
    footnote: "Pro from ₹149 / 30 days",
  };
  return (
    <div style={{ position: "relative", minHeight: "calc(100dvh - 160px)", overflow: "hidden" }}>
      {/* Blurred preview background */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0.15, filter: "blur(6px)", pointerEvents: "none", padding: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 12, background: c.graphite, border: `1px solid ${c.border}` }} />
          ))}
        </div>
        <div style={{ height: 200, borderRadius: 14, background: c.graphite, border: `1px solid ${c.border}`, marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 12, background: c.graphite, border: `1px solid ${c.border}` }} />
          ))}
        </div>
      </div>

      {/* Lock overlay — flex-centered within the full-viewport-height container */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 160px)", textAlign: "center", padding: 40, zIndex: 1 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(180,83,9,0.06)", border: `1.5px solid rgba(180,83,9,0.15)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: c.ivory, marginBottom: 8 }}>{feature}</h3>
        <p style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.6, maxWidth: 360, marginBottom: highlights ? 16 : 24 }}>
          {copy.body}
        </p>

        {highlights && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24, maxWidth: 280 }}>
            {highlights.items.map(item => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontFamily: font.ui, fontSize: 13, color: c.chalk }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onUpgrade} style={{ padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${c.gilt}, ${c.giltDark})`, color: c.obsidian, fontFamily: font.ui, fontSize: 14, fontWeight: 600, transition: "opacity 0.2s" }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          {copy.cta}
        </button>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: c.stone, marginTop: 10 }}>{copy.footnote}</span>
      </div>
    </div>
  );
});

/* ─── Confetti burst for first visit ─── */
function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#d4b37f", "#7a9e7e", "#e8a87c", "#f5f2ed", "#c97b4b"];
    const pieces: { x: number; y: number; vx: number; vy: number; r: number; color: string; rot: number; rv: number; shape: number }[] = [];
    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.35,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 14 - 4,
        r: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        rv: (Math.random() - 0.5) * 0.3,
        shape: Math.floor(Math.random() * 3),
      });
    }
    let frame = 0;
    const maxFrames = 120;
    const animate = () => {
      if (frame >= maxFrames) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const opacity = 1 - frame / maxFrames;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.vx *= 0.99;
        p.rot += p.rv;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) { ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r); }
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); }
        ctx.restore();
      }
      frame++;
      requestAnimationFrame(animate);
    };
    animate();
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none" }} />;
}

/* ─── Welcome Dashboard (no sessions) ─── */
export const EmptyState = memo(function EmptyState({ onStartWarmup, onStartCustom, userName, targetRole, isMobile }: { onStartWarmup: () => void; onStartCustom: () => void; userName: string; targetRole: string; isMobile?: boolean }) {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = userName ? userName.split(" ")[0] : "there";
  const [showConfetti, setShowConfetti] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShowConfetti(false), 3000); return () => clearTimeout(t); }, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {showConfetti && <ConfettiBurst />}
      <style>{`
        @keyframes warmupPulse { 0%, 100% { box-shadow: 0 8px 32px rgba(180,83,9,0.15); } 50% { box-shadow: 0 8px 40px rgba(180,83,9,0.4); } }
        @media (prefers-reduced-motion: reduce) { .warmup-pulse-btn { animation: none !important; box-shadow: 0 8px 32px rgba(180,83,9,0.15) !important; } }
      `}</style>
      <h1 style={{ fontFamily: font.ui, fontSize: isMobile ? 20 : 26, fontWeight: 600, color: c.ivory, marginBottom: 6 }}>
        {timeGreeting}, {firstName}
      </h1>
      <p style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, marginBottom: 32 }}>
        {targetRole ? `Let's get you ready for your ${targetRole} interview.` : "Let's get you interview-ready."}
      </p>

      <div style={{ background: `linear-gradient(135deg, rgba(180,83,9,0.12) 0%, ${c.graphite} 100%)`, borderRadius: 16, border: `1px solid rgba(180,83,9,0.15)`, padding: isMobile ? "32px 24px" : "48px 40px", textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.15)", marginBottom: 24 }}>
          <span style={{ fontFamily: font.mono, fontSize: 10, fontWeight: 600, color: c.gilt, letterSpacing: "0.08em" }}>SESSION 1 OF 3</span>
          <span style={{ fontFamily: font.ui, fontSize: 10, color: c.stone }}>Guided Warmup</span>
        </div>
        <h2 style={{ fontFamily: font.display, fontSize: isMobile ? 22 : 28, fontWeight: 400, color: c.ivory, marginBottom: 10, letterSpacing: "-0.02em" }}>
          {targetRole ? `Your ${targetRole} warmup is ready` : "Your warmup session is ready"}
        </h2>
        <p style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.6, marginBottom: 28, maxWidth: 440, margin: "0 auto 28px" }}>
          3 friendly behavioral questions, ~5 minutes. We'll use your resume to personalize every question and set your baseline score.
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button className="shimmer-btn warmup-pulse-btn" onClick={onStartWarmup}
            style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 500, padding: "14px 36px", borderRadius: 8, border: "none", background: c.gilt, color: c.obsidian, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, animation: "warmupPulse 2s ease-in-out infinite" }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; e.currentTarget.style.animation = "none"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.animation = "warmupPulse 2s ease-in-out infinite"; }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21" /></svg>
            Start Warmup
          </button>
          <button onClick={onStartCustom}
            style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 500, color: c.stone, background: "none", border: "none", cursor: "pointer", padding: "6px 12px", textDecoration: "underline", textUnderlineOffset: 3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = c.ivory; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = c.stone; }}
          >
            or choose your own session
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { step: "1", title: "Warmup", desc: "3 friendly behavioral questions to set your baseline. Personalized from your resume.", icon: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="1.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>, active: true },
          { step: "2", title: "Focus", desc: "Targeted practice on your weakest skill from the warmup.", icon: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, active: false },
          { step: "3", title: "Challenge", desc: "Full interview simulation tailored to your target role.", icon: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.ember} strokeWidth="1.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, active: false },
        ].map((item) => (
          <div key={item.step} style={{ background: c.graphite, borderRadius: 12, border: `1px solid ${item.active ? "rgba(180,83,9,0.3)" : c.border}`, padding: "24px 20px", opacity: item.active ? 1 : 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {item.icon}
              <span style={{ fontFamily: font.mono, fontSize: 10, fontWeight: 600, color: item.active ? c.gilt : c.stone, letterSpacing: "0.08em" }}>SESSION {item.step}</span>
            </div>
            <h3 style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: c.ivory, marginBottom: 6 }}>{item.title}</h3>
            <p style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, lineHeight: 1.5 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="quick-stats-bar" style={{ display: "flex", justifyContent: "center", gap: isMobile ? 24 : 48, padding: "20px 0", borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
        {[
          { value: "~5 min", label: "Warmup length" },
          { value: "3", label: "Questions" },
          { value: "AI", label: "Resume-personalized" },
          { value: "Free", label: "No card needed" },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: "center" }}>
            <span style={{ fontFamily: font.mono, fontSize: 16, fontWeight: 600, color: c.gilt, display: "block", marginBottom: 2 }}>{item.value}</span>
            <span style={{ fontFamily: font.ui, fontSize: 10, color: c.stone }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─── Session Detail View ─── */
export const SessionDetailView = memo(function SessionDetailView({ session, onBack }: { session: DashboardSession; onBack: () => void }) {
  // MVP: render the new results-report view when the flag is on and the
  // session has enough transcript to evaluate. Fall back to the legacy
  // layout otherwise (keeps the rollout safe + reversible).
  const transcriptLen = (session.transcript || []).filter((t) => t.text && t.text.trim().length > 0).length;
  if (transcriptLen >= 2) {
    // Wrap so a crash during evaluation (bad LLM payload, shape drift, etc.)
    // doesn't replace the whole dashboard with a blank screen — user gets a
    // retry button and stays in the dashboard shell.
    return (
      <SectionErrorBoundary label="results report">
        <SessionReport session={session} onBack={onBack} />
      </SectionErrorBoundary>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font.ui, fontSize: 13, color: c.stone, background: "none", border: "none", cursor: "pointer", padding: "0 0 20px" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = c.ivory; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = c.stone; }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </button>

      <div style={{ background: c.graphite, borderRadius: 14, border: `1px solid ${c.border}`, padding: "28px 32px", marginBottom: 20 }}>
        <div className="session-detail-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gilt, background: "rgba(180,83,9,0.08)", padding: "4px 10px", borderRadius: 4 }}>{session.type}</span>
              <span style={{ fontFamily: font.ui, fontSize: 13, color: c.stone }}>{session.dateLabel} · {session.duration}</span>
            </div>
            <h2 style={{ fontFamily: font.ui, fontSize: 22, fontWeight: 600, color: c.ivory, marginBottom: 4 }}>{session.role}</h2>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 72, height: 72, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
                <circle cx="36" cy="36" r="33" fill="none" stroke="rgba(14,12,8,0.06)" strokeWidth="3" />
                <circle cx="36" cy="36" r="33" fill="none" stroke={scoreLabelColor(session.score)} strokeWidth="3"
                  strokeDasharray={`${(session.score / 100) * 2 * Math.PI * 33} ${2 * Math.PI * 33}`}
                  strokeLinecap="round" className="score-ring" />
              </svg>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontFamily: font.mono, fontSize: 28, fontWeight: 700, color: c.ivory, lineHeight: 1 }}>{session.score}</span>
                <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, color: scoreLabelColor(session.score), marginTop: 2 }}>{scoreLabel(session.score)}</span>
              </div>
            </div>
            <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600, color: session.change > 0 ? c.sage : c.ember, display: "block", marginTop: 4 }}>
              {session.change > 0 ? "+" : ""}{session.change} vs previous
            </span>
          </div>
        </div>

        <div className="session-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(21,128,61,0.04)", border: `1px solid rgba(21,128,61,0.12)` }}>
            <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, color: c.sage, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Top Strength</span>
            <span style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 500, color: c.ivory }}>{session.topStrength}</span>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(185,28,28,0.04)", border: `1px solid rgba(185,28,28,0.12)` }}>
            <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, color: c.ember, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>To Improve</span>
            <span style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 500, color: c.ivory }}>{session.topWeakness}</span>
          </div>
        </div>
      </div>

      <div style={{ background: c.graphite, borderRadius: 14, border: `1px solid ${c.border}`, padding: "28px 32px", marginBottom: 20 }}>
        <h3 style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory, marginBottom: 20 }}>Question Scores</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {session.questionScores.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 10, background: c.obsidian, border: `1px solid ${c.border}` }}>
              <div style={{ width: 40, height: 40, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(14,12,8,0.06)" strokeWidth="2" />
                  <circle cx="20" cy="20" r="17" fill="none" stroke={scoreLabelColor(q.score)} strokeWidth="2"
                    strokeDasharray={`${(q.score / 100) * 2 * Math.PI * 17} ${2 * Math.PI * 17}`}
                    strokeLinecap="round" className="score-ring" />
                </svg>
                <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 600, color: c.ivory }}>{q.score}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory, display: "block", marginBottom: 2 }}>{q.question}</span>
                <span style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>{q.notes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: c.graphite, borderRadius: 14, border: `1px solid ${c.border}`, padding: "28px 32px", marginBottom: 20 }}>
        <h3 style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory, marginBottom: 20 }}>Full Transcript</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {session.transcript.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 12, flexDirection: msg.speaker === "user" ? "row-reverse" : "row" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: msg.speaker === "ai" ? "rgba(180,83,9,0.1)" : "rgba(21,128,61,0.1)", border: `1px solid ${msg.speaker === "ai" ? "rgba(180,83,9,0.2)" : "rgba(21,128,61,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {msg.speaker === "ai" ? (
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2M5.6 5.6l1.4 1.4m9.9 9.9l1.4 1.4M5.6 18.4l1.4-1.4m9.9-9.9l1.4-1.4"/></svg>
                ) : (
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
              </div>
              <div style={{ maxWidth: "75%", minWidth: 0 }}>
                <div style={{ padding: "12px 16px", borderRadius: 12, fontFamily: font.ui, fontSize: 13, color: c.chalk, lineHeight: 1.6, background: msg.speaker === "ai" ? c.obsidian : "rgba(21,128,61,0.04)", border: `1px solid ${msg.speaker === "ai" ? c.border : "rgba(21,128,61,0.1)"}`, borderTopLeftRadius: msg.speaker === "ai" ? 4 : 12, borderTopRightRadius: msg.speaker === "user" ? 4 : 12 }}>
                  {msg.text}
                </div>
                {msg.scoreNote && (
                  <span style={{ fontFamily: font.mono, fontSize: 10, color: c.stone, display: "block", marginTop: 4, textAlign: msg.speaker === "ai" ? "left" : "right", paddingLeft: msg.speaker === "ai" ? 16 : 0, paddingRight: msg.speaker === "user" ? 16 : 0 }}>
                    {msg.scoreNote}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: c.graphite, borderRadius: 14, border: `1px solid ${c.border}`, padding: "28px 32px" }}>
        <h3 style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory, marginBottom: 12 }}>AI Coach Summary</h3>
        <p style={{ fontFamily: font.ui, fontSize: 14, color: c.chalk, lineHeight: 1.7, margin: 0 }}>{session.feedback}</p>
      </div>
    </div>
  );
});
