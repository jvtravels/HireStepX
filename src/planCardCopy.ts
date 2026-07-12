/* Pure copy logic for the sidebar Plan Status card (DashboardLayout).
 *
 * Kept out of the component so the wording rules are unit-testable in
 * isolation — the card renders in many plan/usage permutations that are
 * awkward to exercise through the full layout. Mirrors nextMove.ts.
 */

/**
 * Footnote under the Starter (Sprint Pack) usage block.
 *
 * The pack is a one-off set of sessions that expire and do NOT weekly-reset.
 * The old footnote hardcoded "5 sessions · valid till <date>",
 * which (a) restated the plan name/date already shown in the card header and
 * usage row, and (b) printed the pack SIZE, not what's left — so a spent pack
 * still advertised "5 sessions" directly above a buy CTA.
 *
 * While sessions remain, the footnote carries the one thing nothing else on
 * the card conveys — the pack's one-off, non-resetting nature. Once the pack
 * is spent it returns "" (no footnote): exhaustion is already stated loudly by
 * the red "N of N" usage row, the full progress bar, the "0 extra sessions"
 * chip, and the buy CTA, so a "Sprint Pack used up" line only adds redundancy.
 * Callers must skip rendering the element when this is empty.
 */
export function starterPackFootnote(starterRemaining: number): string {
  return starterRemaining <= 0 ? "" : "One-off pack · doesn’t reset";
}

/** Inputs that decide the primary plan-card CTA label. */
export type PlanCtaState = {
  starterExhausted: boolean;
  freeExhausted: boolean;
  creditBalance: number;
};

/**
 * Label for the plan card's primary button. Only states that actually render a
 * button reach this: active Pro shows "Manage Subscription", exhausted Pro is
 * handled separately, and an active Starter with sessions left shows no button.
 * So this covers exhausted-Starter and Free (active or exhausted).
 *
 * A spent Sprint Pack is a pack customer, not a Pro lead — its CTA mirrors the
 * exhausted-Pro "buy sessions" path (the upgrade modal offers another pack or
 * individual sessions) rather than pushing a recurring upgrade. Pushing
 * "Upgrade to Pro" there both misreads intent and misdescribes the modal.
 */
export function planCtaLabel(s: PlanCtaState): string {
  if (s.starterExhausted) return "Buy more sessions";
  if (s.freeExhausted) return s.creditBalance > 0 ? "Buy more sessions" : "Unlock sessions now";
  return "Upgrade to Pro";
}

/** Tooltip/aria description matched to the CTA — buy vs. the Pro pitch. */
export function planCtaTitle(label: string): string {
  return label === "Upgrade to Pro"
    ? "See what's included in Pro — unlimited sessions, STAR coaching, skill tracking"
    : "Buy more interview sessions";
}
