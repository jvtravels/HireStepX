/* Pure pricing for the employer contact-unlock paywall.
   Standing pricing model: candidates unlock in fixed batches of
   UNLOCK_BUNDLE_SIZE for a flat UNLOCK_BATCH_PRICE_PAISE — see the
   "Employers" design canvas (EmployersDashboard.tsx), which is the
   source of truth this mirrors. A single leftover candidate can also be
   unlocked on its own at UNLOCK_SINGLE_PRICE_PAISE; that price is set
   above the batch's effective per-candidate rate (₹29.90) so a full
   batch purchase stays the better deal at scale. */

export const UNLOCK_BUNDLE_SIZE = 10;
export const UNLOCK_BATCH_PRICE_PAISE = 29_900; // ₹299 per batch of UNLOCK_BUNDLE_SIZE candidates
export const UNLOCK_SINGLE_PRICE_PAISE = 5_900; // ₹59 for one candidate unlocked alone

export interface UnlockPrice {
  amountPaise: number;
  label: string;
}

export function singleUnlockPrice(): UnlockPrice {
  return { amountPaise: UNLOCK_SINGLE_PRICE_PAISE, label: "Unlock candidate" };
}

export function batchUnlockPrice(): UnlockPrice {
  return { amountPaise: UNLOCK_BATCH_PRICE_PAISE, label: `Unlock batch of ${UNLOCK_BUNDLE_SIZE}` };
}

/** Which fixed batch a candidate falls into, given their 0-based rank
    position in the requirement's match_score-descending order — the same
    order employer-requirement-detail.ts returns candidates in. Batch
    membership is positional, not per-candidate, so re-sorting the table
    client-side never changes which batch a row belongs to. */
export function batchIndexForRank(rankIndex: number): number {
  return Math.floor(rankIndex / UNLOCK_BUNDLE_SIZE);
}
