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

export const PAY_AS_YOU_GO_SENTENCE =
  "Pay as you go: there is no subscription, nothing renews automatically and we never store your card for recurring billing.";

/** Matches the in-product wording in BillingHistorySection.tsx. */
export const CREDIT_BACK_SENTENCE =
  `If a candidate you paid for declines, withdraws, blocks you or doesn't reply within ${CREDIT_NO_RESPONSE_DAYS} days of your interview invite, that candidate's share is added back as account credit and applied automatically to your next unlock. It is credit, not a cash refund.`;

export const GST_STATEMENT =
  "GST is added or included according to HireStepX's GST registration status at the time of purchase. Until we are registered we do not charge GST and receipts are not GST tax invoices; once registered, the price and tax shown at checkout will say so.";
