/**
 * Post-acceptance onboarding guardrails.
 *
 * When the negotiation kernel reaches terminal-accepted state, the recruiter
 * has 24-72h to convert verbal acceptance into a clean joining. This module
 * generates the structured next-steps message the recruiter should send,
 * covering:
 *   1. Document checklist (UAN, payslips, IT return, Form 16, education
 *      originals, relieving-letter chain)
 *   2. BGV alignment ask
 *   3. Counter-offer-from-current-employer heads-up
 *   4. Joining-date lock ask
 *
 * Pure: takes the state and returns a string. The negotiation kernel wires
 * this in at terminal-accepted; the LLM is instructed to deliver it as the
 * close turn rather than improvise its own onboarding language. */

import type { NegotiationState } from "./_negotiation-kernel";

const DOC_CHECKLIST: ReadonlyArray<string> = [
  "PF UAN number",
  "Last 3 months' payslips",
  "Most recent Income Tax Return acknowledgment",
  "Form 16 (current FY and previous FY)",
  "Education originals (X / XII / graduation marksheets + degree)",
  "Relieving-letter chain (all prior employers)",
];

export interface PostAcceptanceOptions {
  /** When true, the BGV section is included. Default true. */
  includeBgv?: boolean;
  /** When true, the counter-offer heads-up section is included. Default true. */
  includeCounterOfferHeadsUp?: boolean;
}

/** Build the structured next-steps message a recruiter sends immediately
 *  after verbal acceptance. Pure. */
export function buildPostAcceptanceMessage(
  state: NegotiationState,
  options: PostAcceptanceOptions = {},
): string {
  const includeBgv = options.includeBgv !== false;
  const includeCounterOffer = options.includeCounterOfferHeadsUp !== false;
  const sections: string[] = [];

  /* 1. Confirmation + recap of close terms (pure framing — kernel state
   * provides highestOffer + lastJoiningBonusOffered which the LLM uses to
   * recap; we surface the checklist scaffolding). */
  sections.push(
    `Congratulations and welcome to ${state.company}. Locking the close at ₹${state.highestOfferMade}L total comp` +
      (state.lastJoiningBonusOffered != null
        ? ` + ₹${state.lastJoiningBonusOffered}L joining bonus.`
        : "."),
  );

  /* 2. Document checklist. */
  sections.push("Documents we'll need before your offer letter goes out:");
  for (let i = 0; i < DOC_CHECKLIST.length; i++) {
    sections.push(`  ${i + 1}. ${DOC_CHECKLIST[i]}`);
  }

  /* 3. BGV alignment. */
  if (includeBgv) {
    sections.push(
      "BGV: our partner will reach out within 48 hours. Please respond promptly — gaps in the relieving-letter chain are the #1 onboarding blocker, so flag any issue today rather than at week 4.",
    );
  }

  /* 4. Counter-offer heads-up. */
  if (includeCounterOffer) {
    sections.push(
      "Heads-up: it's common for your current employer to deploy a retention counter within 2-3 weeks of resignation. We'd rather you decide today than chase a counter; if one lands, please loop us in before responding.",
    );
  }

  /* 5. Joining-date lock. */
  const noticeDays = state.noticeJoining?.noticePeriodDays;
  if (noticeDays != null) {
    sections.push(
      `Joining-date lock: with your ${noticeDays}-day notice, we'd like to target a tentative date this week and put it in writing on the offer letter.`,
    );
  } else {
    sections.push(
      "Joining-date lock: please share your tentative joining date so we can put it in writing on the offer letter.",
    );
  }

  return sections.join("\n");
}
