/* Client-side feature flag for the canonical negotiation kernel path.
 * ─────────────────────────────────────────────────────────────────────
 * Controls whether useInterviewEngine routes salary-negotiation turns
 * through /api/negotiate-turn (Ship 2 endpoint) instead of /api/follow-up.
 *
 * Server-side gating lives on the endpoint itself (env
 * NEGOTIATION_KERNEL_ENABLED) — that's the source of truth. This
 * client flag exists so the engine doesn't waste a round-trip when the
 * env is off, and so we can dogfood via a localStorage override before
 * flipping the env publicly.
 *
 * Order of precedence:
 *   1. localStorage "negotiation_kernel" = "1" / "0"  (manual override)
 *   2. NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED = "1"   (deploy-level)
 *   3. off
 */

declare const process: { env?: Record<string, string | undefined> };

const LS_KEY = "negotiation_kernel";

export function isNegotiationKernelEnabled(): boolean {
  /* localStorage override — useful for dev / dogfooding. */
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      const v = window.localStorage.getItem(LS_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {
      /* localStorage can throw in private-browse mode; fall through */
    }
  }

  /* Deploy-level flag. */
  const env = (typeof process !== "undefined" && process.env) || {};
  return env.NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED === "1";
}

/** Set the localStorage override for the current browser. Pass null to
 *  clear and fall back to the env flag. Exposed for a future dev UI. */
export function setNegotiationKernelOverride(value: "1" | "0" | null): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, value);
  } catch {
    /* expected in private-browse */
  }
}
