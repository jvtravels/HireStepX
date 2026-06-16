/* Pure helpers for /api/usage-this-month — the time-window math and
   the cap lookup. Kept here so the handler is just fetch glue and the
   month boundary / cap mapping is unit-testable. */

export const PLAN_CAPS = {
  free: { mock: 3, resumeParses: 5 },
  starter: { mock: 40, resumeParses: 5 },
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
