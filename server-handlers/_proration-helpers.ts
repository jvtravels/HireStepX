/* Pure mid-cycle-upgrade proration math, extracted from verify-payment so the
 * money calculation is unit-testable in isolation.
 *
 * The bug this fixes: the old inline code guessed the CURRENT plan's duration
 * and price from the tier alone (starter→7d/₹49, else→30d/₹149). But tier "pro"
 * can be a 30-day monthly OR a 365-day yearly-pro, and "starter" can be weekly
 * OR yearly-starter — so every yearly upgrader got a wildly inflated credit.
 * We now derive the real duration from the subscription's actual start/end dates
 * and the price from (tier, isYearly).
 */

export const PLAN_AMOUNT_PAISE: Record<string, number> = {
  weekly: 3900, // Sprint Pack ₹39
  monthly: 14900,
  "yearly-starter": 203900,
  "yearly-pro": 143000,
};

export const PLAN_DAYS: Record<string, number> = {
  weekly: 30, // Sprint Pack 30-day validity
  monthly: 30,
  "yearly-starter": 365,
  "yearly-pro": 365,
};

/** Days of the CURRENT plan still unused, ceil'd, never negative. */
export function remainingDays(currentEndMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((currentEndMs - nowMs) / 86400000));
}

/** The current plan's measured duration in days, derived from its real dates.
 *  Returns NaN when the start date is missing or non-positive — callers fall
 *  back to a tier-based default in that case. */
export function measuredDurationDays(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !(endMs > startMs)) return NaN;
  return Math.round((endMs - startMs) / 86400000);
}

/** Price (paise) the buyer is currently paying, inferred from tier + whether the
 *  measured duration looks yearly (≥180 days). Falls back to monthly/weekly when
 *  the duration is unknown. */
export function currentPlanAmount(tier: string, measuredDays: number): number {
  const isStarter = tier === "starter";
  const isYearly = Number.isFinite(measuredDays) ? measuredDays >= 180 : false;
  if (isYearly) return isStarter ? PLAN_AMOUNT_PAISE["yearly-starter"] : PLAN_AMOUNT_PAISE["yearly-pro"];
  return isStarter ? PLAN_AMOUNT_PAISE.weekly : PLAN_AMOUNT_PAISE.monthly;
}

/** Bonus days to add to the NEW plan as credit for the unused portion of the
 *  current one. Converts remaining days into a value ratio (remaining/duration ×
 *  oldPrice/newPrice) and scales by the new plan's length. Clamped at ≥0. */
export function proratedBonusDays(args: {
  remainingDays: number;
  currentPlanDuration: number;
  currentPlanAmount: number;
  newPlanAmount: number;
  newPlanDays: number;
}): number {
  const { remainingDays, currentPlanDuration, currentPlanAmount, newPlanAmount, newPlanDays } = args;
  if (currentPlanDuration <= 0 || newPlanAmount <= 0) return 0;
  const days = Math.floor(
    (remainingDays / currentPlanDuration) * (currentPlanAmount / newPlanAmount) * newPlanDays,
  );
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** End-to-end proration: given the current subscription dates/tier and the new
 *  plan, returns the bonus days to graft onto the new plan term. */
export function computeProratedDays(args: {
  nowMs: number;
  currentStartMs: number;
  currentEndMs: number;
  currentTier: string;
  newPlan: string;
}): number {
  const { nowMs, currentStartMs, currentEndMs, currentTier, newPlan } = args;
  const newPlanAmount = PLAN_AMOUNT_PAISE[newPlan];
  const newPlanDays = PLAN_DAYS[newPlan];
  if (!newPlanAmount || !newPlanDays) return 0;
  const measured = measuredDurationDays(currentStartMs, currentEndMs);
  const isStarter = currentTier === "starter";
  const duration = Number.isFinite(measured) ? measured : (isStarter ? 30 : 30); // Sprint Pack is 30 days
  return proratedBonusDays({
    remainingDays: remainingDays(currentEndMs, nowMs),
    currentPlanDuration: duration,
    currentPlanAmount: currentPlanAmount(currentTier, measured),
    newPlanAmount,
    newPlanDays,
  });
}
