/**
 * Post-acceptance onboarding guardrails.
 *
 * When the negotiation kernel reaches terminal-accepted state, the recruiter
 * has 24-72h to convert verbal acceptance into a clean joining. This module
 * generates the structured next-steps message the recruiter should send,
 * covering:
 *   1. Document checklist (Aadhaar + PAN — identity-on-file only;
 *      the BGV partner handles the rest async)
 *   2. BGV alignment ask
 *   3. Counter-offer-from-current-employer heads-up
 *   4. Joining-date lock ask
 *
 * Pure: takes the state and returns either a single joined string
 * (`buildPostAcceptanceMessage`, the back-compat shape) OR an array
 * of chunks (`buildPostAcceptanceMessageChunks`, the staging shape
 * for engine fan-out into multiple bubbles).
 */

import type { NegotiationState } from "./_negotiation-kernel";

/* PDF#45 follow-up (2026-05-25) — trimmed to identity docs only.
 * Prior list (PF UAN, payslips, ITR, Form 16, education originals,
 * relieving-letter chain) overwhelmed candidates at the verbal-accept
 * boundary and read like a BGV demand-letter. Real recruiter practice
 * at the close turn is to confirm identity-on-file (Aadhaar + PAN);
 * the BGV partner handles the rest asynchronously over the next 48h. */
const DOC_CHECKLIST: ReadonlyArray<string> = [
  "Aadhaar card",
  "PAN card",
];

export interface PostAcceptanceOptions {
  /** When true, the BGV section is included. Default true. */
  includeBgv?: boolean;
  /** When true, the counter-offer heads-up section is included. Default true. */
  includeCounterOfferHeadsUp?: boolean;
}

/* PDF#48 follow-up (2026-05-26) — chunked output.
 *
 * Prior shape: `sections.join("\n")` produced one wall-of-text where
 * the congrats headline, doc checklist, BGV blurb, counter-offer
 * warning, and joining-date ask collided in a single bubble. Real
 * recruiter cadence at the close turn is conversational —
 * congratulations lands, candidate reacts ("thank you"), recruiter
 * pivots to docs, candidate acks, etc. The wall replaced that
 * cadence with a contractual statement no candidate processes in
 * full.
 *
 * `buildPostAcceptanceMessageChunks` returns the SAME content as
 * `buildPostAcceptanceMessage`, but as an ordered array, one logical
 * beat per entry:
 *   chunks[0] = congratulations + close-lock (the headline)
 *   chunks[1] = document checklist (heading + items as one block)
 *   chunks[2] = BGV alignment (optional)
 *   chunks[3] = counter-offer heads-up (optional)
 *   chunks[4] = joining-date lock
 *
 * Consumers:
 *   - The legacy joined-string consumer (negotiate-turn.ts dispatch,
 *     postAcceptanceDispatch.test.ts) keeps reading
 *     `buildPostAcceptanceMessage` — that fn now calls chunks and
 *     joins with "\n\n" (paragraph breaks) so the readability win
 *     lands today even before the engine fans out.
 *   - The future engine fan-out (planned: new step type
 *     `terminal-acknowledgment` that accepts waitForUser:true without
 *     re-routing to the kernel) will read the chunks array verbatim
 *     and create one local script slot per chunk. Until that lands,
 *     the joined-string path remains canonical.
 *
 * The chunks contract is therefore the forward-compatible source of
 * truth; the joined string is a derived view that exists for the
 * current single-bubble consumer.
 */
export function buildPostAcceptanceMessageChunks(
  state: NegotiationState,
  options: PostAcceptanceOptions = {},
): string[] {
  const includeBgv = options.includeBgv !== false;
  const includeCounterOffer = options.includeCounterOfferHeadsUp !== false;
  const chunks: string[] = [];

  /* 1. Congratulations + recap of close terms (the headline). */
  chunks.push(
    `Congratulations and welcome to ${state.company}. Locking the close at ₹${state.highestOfferMade}L total comp` +
      (state.lastJoiningBonusOffered != null
        ? ` + ₹${state.lastJoiningBonusOffered}L joining bonus.`
        : "."),
  );

  /* 2. Document checklist as a single beat — heading + items
   *    travel together so the engine fan-out renders the docs ask
   *    as one bubble, not one bubble per line. */
  {
    const lines: string[] = ["Documents we'll need before your offer letter goes out:"];
    for (let i = 0; i < DOC_CHECKLIST.length; i++) {
      lines.push(`  ${i + 1}. ${DOC_CHECKLIST[i]}`);
    }
    chunks.push(lines.join("\n"));
  }

  /* 3. BGV alignment. */
  if (includeBgv) {
    chunks.push(
      "BGV: our partner will reach out within 48 hours to collect the rest (payslips, relieving-letter chain, etc.) — please respond promptly when they do.",
    );
  }

  /* 4. Counter-offer heads-up. */
  if (includeCounterOffer) {
    chunks.push(
      "One thing to keep in mind: it's common for your current employer to come back with a retention counter within 2-3 weeks of resignation. We'd rather you decide today than chase a counter; if one comes up, please inform us before responding.",
    );
  }

  /* 5. Joining-date lock. */
  const noticeDays = state.noticeJoining?.noticePeriodDays;
  if (noticeDays != null) {
    chunks.push(
      `Joining-date lock: with your ${noticeDays}-day notice, we'd like to target a tentative date this week and put it in writing on the offer letter.`,
    );
  } else {
    chunks.push(
      "Joining-date lock: please share your tentative joining date so we can put it in writing on the offer letter.",
    );
  }

  return chunks;
}

/** Build the structured next-steps message a recruiter sends immediately
 *  after verbal acceptance. Pure. Returns the joined string view of the
 *  chunks array; see `buildPostAcceptanceMessageChunks` for the
 *  forward-compatible structured shape and the cadence rationale.
 *
 *  Joined with paragraph breaks ("\n\n") so the current single-bubble
 *  consumer at least renders with visible section spacing instead of
 *  the prior single-newline wall. */
export function buildPostAcceptanceMessage(
  state: NegotiationState,
  options: PostAcceptanceOptions = {},
): string {
  return buildPostAcceptanceMessageChunks(state, options).join("\n\n");
}
