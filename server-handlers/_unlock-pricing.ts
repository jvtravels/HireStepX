/* Pure pricing for the employer contact-unlock paywall. Tiered by the
   candidate's match_score against the requirement, reusing the same >= 60
   "strong match" threshold as classifyRequirementStatus in
   _requirement-match-helpers.ts — one convention for what counts as strong,
   not a second invented cutoff. */

export const UNLOCK_PRICE_STANDARD = 99_900; // ₹999, in paise
export const UNLOCK_PRICE_STRONG = 199_900; // ₹1,999, in paise
export const UNLOCK_STRONG_MATCH_THRESHOLD = 60;

export interface UnlockPrice {
  amountPaise: number;
  label: string;
}

export function unlockPriceForMatch(matchScore: number): UnlockPrice {
  if (matchScore >= UNLOCK_STRONG_MATCH_THRESHOLD) {
    return { amountPaise: UNLOCK_PRICE_STRONG, label: "Unlock contact — strong match" };
  }
  return { amountPaise: UNLOCK_PRICE_STANDARD, label: "Unlock contact" };
}
