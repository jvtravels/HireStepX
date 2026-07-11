/* Pure helpers for /api/usage-this-month — the time-window math and
   the cap lookup. Kept here so the handler is just fetch glue and the
   month boundary / cap mapping is unit-testable. */

export const PLAN_CAPS = {
  free: { mock: 2, resumeParses: 5 },     // 2 sessions lifetime, one-time (no monthly renewal)
  starter: { mock: 5, resumeParses: 5 },  // Sprint Pack: 5 sessions per 30-day pack (matches _shared.ts)
  pro: { mock: 40, resumeParses: 5 },
  team: { mock: Infinity, resumeParses: 5 },
} as const;

export type Tier = keyof typeof PLAN_CAPS;

export interface UsageWindow {
  periodStart: string; // ISO
  periodEnd: string;   // ISO
}

/**
 * UTC month window. Anchoring on UTC avoids the off-by-a-day drift that
 * would otherwise happen for users in IST (UTC+05:30) when the local
 * date and the UTC date disagree at the month boundary.
 */
export function monthWindow(now: Date): UsageWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

/** One day / 31 days in ms — the pack-window clamp mirrors checkSessionLimit. */
const DAY_MS = 24 * 60 * 60 * 1000;
const EIGHT_DAYS_MS = 8 * DAY_MS; // clamp slightly over the 7-day pack

/**
 * Usage window for the Starter Sprint Pack — a one-off pack of 5 sessions
 * anchored on the purchase date, NOT the calendar month. Mirrors the server
 * gate in `_shared.ts`: count sessions since `subscription_start`, clamped so a
 * stale/absent start can never look back more than 31 days (fail-closed). The
 * upper bound is the pack expiry when known (always ≥ now for an active pack),
 * else a 1-day-ahead buffer so the just-created session is still counted.
 */
export function packWindow(
  subscriptionStart: string | null | undefined,
  subscriptionEnd: string | null | undefined,
  now: Date,
): UsageWindow {
  const nowMs = now.getTime();
  const startMs = subscriptionStart ? new Date(subscriptionStart).getTime() : NaN;
  const clampedStart = Number.isFinite(startMs)
    ? Math.max(startMs, nowMs - EIGHT_DAYS_MS)
    : nowMs - EIGHT_DAYS_MS;
  const endMs = subscriptionEnd ? new Date(subscriptionEnd).getTime() : NaN;
  const upper = Number.isFinite(endMs) && endMs > nowMs ? endMs : nowMs + DAY_MS;
  return {
    periodStart: new Date(clampedStart).toISOString(),
    periodEnd: new Date(upper).toISOString(),
  };
}

/**
 * Resolve the cap for a tier. Unknown tiers fall back to `free`
 * rather than throwing — matches the rest of the backend, which
 * treats malformed tier strings as the most restrictive plan.
 */
export function capsForTier(tier: string): { mock: number; resumeParses: number } {
  const safeTier = (tier as Tier) in PLAN_CAPS ? (tier as Tier) : "free";
  return PLAN_CAPS[safeTier];
}

/** Read a count from a Supabase REST `content-range` header. */
export function countFromContentRange(header: string | null): number {
  if (!header) return 0;
  const total = header.split("/")[1];
  if (!total || total === "*") return 0;
  const n = parseInt(total, 10);
  return Number.isFinite(n) ? n : 0;
}
