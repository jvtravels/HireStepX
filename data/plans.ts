/** Single source of truth for plan prices (paise). Pure constants: safe for edge, node and client. */
export const PLAN_AMOUNT_PAISE = {
  single: 900, // ₹9 per session
  weekly: 3900, // Sprint Pack ₹39 · 5 sessions · 30-day validity
  "yearly-starter": 203900, // legacy annual SKU, no longer sold; kept for proration of existing subscribers
} as const;

export type PlanId = keyof typeof PLAN_AMOUNT_PAISE;

/** Plans that can be purchased today. */
export const SOLD_PLAN_AMOUNT: Record<string, number> = {
  single: PLAN_AMOUNT_PAISE.single,
  weekly: PLAN_AMOUNT_PAISE.weekly,
};

export function formatRupees(paise: number): string {
  return `₹${paise / 100}`;
}
