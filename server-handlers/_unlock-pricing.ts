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

const PER_CANDIDATE_BATCH_PAISE = Math.round(UNLOCK_BATCH_PRICE_PAISE / UNLOCK_BUNDLE_SIZE);

/** `count` is how many still-locked candidates a batch order will actually
    unlock. A full bucket of UNLOCK_BUNDLE_SIZE charges the flat batch price;
    a smaller remainder (some of the bucket already individually unlocked, or
    a final partial bucket) charges proportionally instead of the full flat
    price for fewer candidates. */
export function batchUnlockPrice(count: number = UNLOCK_BUNDLE_SIZE): UnlockPrice {
  const clamped = Math.max(1, Math.min(count, UNLOCK_BUNDLE_SIZE));
  const amountPaise = clamped === UNLOCK_BUNDLE_SIZE ? UNLOCK_BATCH_PRICE_PAISE : PER_CANDIDATE_BATCH_PAISE * clamped;
  const label = clamped === UNLOCK_BUNDLE_SIZE
    ? `Unlock batch of ${UNLOCK_BUNDLE_SIZE}`
    : `Unlock ${clamped} candidate${clamped === 1 ? "" : "s"}`;
  return { amountPaise, label };
}

/** Which fixed batch a candidate falls into, given their 0-based rank
    position in the requirement's match_score-descending order — the same
    order employer-requirement-detail.ts returns candidates in. Batch
    membership is positional, not per-candidate, so re-sorting the table
    client-side never changes which batch a row belongs to. */
export function batchIndexForRank(rankIndex: number): number {
  return Math.floor(rankIndex / UNLOCK_BUNDLE_SIZE);
}

/** Rupees with paise only when present, so a prorated ₹29.90 is never shown as ₹30. */
export function formatPaise(paise: number): string {
  return paise % 100 === 0 ? `₹${paise / 100}` : `₹${(paise / 100).toFixed(2)}`;
}

export interface UnlockRateNote { perCandidate: string; savings: string | null; batchHint: string | null }

/** Per-candidate rate and saving shown in the unlock dialog. A batch charges
    ₹29.90 a head against ₹59 singly, which the flat total alone doesn't reveal. */
export function unlockRateNote(count: number, amountPaise: number): UnlockRateNote {
  if (count <= 1) {
    return { perCandidate: formatPaise(amountPaise), savings: null, batchHint: `Unlocking ${UNLOCK_BUNDLE_SIZE} at once costs ${formatPaise(PER_CANDIDATE_BATCH_PAISE)} each.` };
  }
  const saved = UNLOCK_SINGLE_PRICE_PAISE * count - amountPaise;
  return {
    perCandidate: formatPaise(Math.round(amountPaise / count)),
    savings: saved > 0 ? `You save ${formatPaise(saved)} against unlocking one at a time.` : null,
    batchHint: null,
  };
}
