/* One canonical statement of what an employer sees locked vs unlocked, and
   what unlocking costs. The /employers marketing page, the employer terms and
   the refund policy all render from here so they cannot drift apart.

   Source of truth for the lists is the server: employer-requirement-detail.ts
   (resume run through redactResumeDetailForLock + scrubLockedResume, name
   replaced by maskedCandidateName, contact and portfolio links withheld) and
   employer-candidate-evidence.ts (practice answers shown with only the
   candidate's name and contact details scrubbed while locked).

   Pure module: no I/O, safe to import from server and client components. */

import { UNLOCK_BUNDLE_SIZE, UNLOCK_BATCH_PRICE_PAISE, UNLOCK_SINGLE_PRICE_PAISE, batchUnlockPrice, formatPaise } from "../../server-handlers/_unlock-pricing";

/** Mirrors NO_RESPONSE_DAYS in server-handlers/_employer-credit.ts (asserted in a test). */
export const CREDIT_NO_RESPONSE_DAYS = 14;

/** Visible for free, before you pay for anything. */
export const VISIBLE_BEFORE_UNLOCK: readonly string[] = [
  "Match score and the role, skills and location fit behind it",
  "Skills, verified capabilities, readiness band and answer-structure (STAR) scores from their practice sessions",
  "Resume detail, including past employers, schools and city, with name, phone, LinkedIn and links removed",
  "Short word-for-word excerpts from practice answers, with their name and contact details removed",
  "An anonymous \"Candidate #…\" label and when they last practised",
];

/** Withheld until you unlock that candidate. */
export const HIDDEN_BEFORE_UNLOCK: readonly string[] = [
  "Name",
  "Email, phone and LinkedIn (also removed wherever they appear in the resume or answers)",
  "Portfolio links",
  "The original resume file, where the candidate uploaded one",
  "The ability to message them through HireStepX",
];

/** What a paid unlock adds. */
export const REVEALED_ON_UNLOCK: readonly string[] = [
  "Their name",
  "Email, phone and LinkedIn",
  "Portfolio links",
  "The original resume file, where they uploaded one",
  "Messaging them through HireStepX",
];

export function unlockFeeSentence(): string {
  return `Candidates are unlocked in batches of ${UNLOCK_BUNDLE_SIZE} for ${formatPaise(UNLOCK_BATCH_PRICE_PAISE)} (a smaller remainder is charged in proportion), or one at a time for ${formatPaise(UNLOCK_SINGLE_PRICE_PAISE)}.`;
}

/** The prorating rule from batchUnlockPrice(), spelled out. */
export function proratedRemainderSentence(): string {
  const each = formatPaise(batchUnlockPrice(1).amountPaise);
  return `If fewer than ${UNLOCK_BUNDLE_SIZE} candidates are left locked in a batch (some already unlocked one at a time, or a final partial batch), you pay ${each} for each one left instead of the full batch price.`;
}

/** Worked example for the marketing page, computed from the real price table so it can never drift. */
export function workedPricingExampleSentence(): string {
  const singles = 3;
  const perBatchCandidate = batchUnlockPrice(1).amountPaise;
  const tenSinglyPaise = UNLOCK_BUNDLE_SIZE * UNLOCK_SINGLE_PRICE_PAISE;
  return `Unlock ${singles} candidates one at a time: ${singles} × ${formatPaise(UNLOCK_SINGLE_PRICE_PAISE)} = ${formatPaise(singles * UNLOCK_SINGLE_PRICE_PAISE)}. Unlock a full batch of ${UNLOCK_BUNDLE_SIZE}: ${formatPaise(UNLOCK_BATCH_PRICE_PAISE)}, which is ${formatPaise(perBatchCandidate)} a candidate. Unlocking those same ${UNLOCK_BUNDLE_SIZE} one at a time would cost ${formatPaise(tenSinglyPaise)}.`;
}

export const PAY_AS_YOU_GO_SENTENCE =
  "Pay as you go: there is no subscription, nothing renews automatically and we never store your card for recurring billing.";

/** Matches the in-product wording in BillingHistorySection.tsx. */
export const CREDIT_BACK_SENTENCE =
  `If a candidate you paid for declines, withdraws, blocks you or doesn't reply within ${CREDIT_NO_RESPONSE_DAYS} days of your interview invite, that candidate's share is added back as account credit and applied automatically to your next unlock. It is credit, not a cash refund.`;

/** Single wording for what happens to unspent credit on deletion, rendered in the terms,
 *  the refund policy and the settings deletion notice so the three cannot drift. Matches
 *  behaviour: deleting an employer account does not pay credit out (no cash-out path exists). */
export const CREDIT_ON_DELETION_SENTENCE =
  "Unspent employer credit is not redeemable for cash and lapses when an account is deleted; to request a refund of unused credit, contact support before deleting.";

/* Mirrors the billing code: unlock prices are GST-inclusive totals that
   server-handlers/_unlock-tax.ts splits into taxable value and tax. Never word
   this as "GST is added on top". */
export const GST_SHORT_LINE =
  "This is the total you pay. GST is included once we are GST-registered; until then none is charged.";

export const GST_STATEMENT =
  "Prices are GST-inclusive once we are GST-registered: the price shown at checkout is the total you pay, and your tax invoice shows the GST within it. Until we are registered we do not charge GST and receipts are not GST tax invoices.";
