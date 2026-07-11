/* PRI-77 (2026-07-10, round-9 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — two false-closes (the
 * unrecoverable class: the bot finalizes a deal the candidate is refusing):
 *
 *   A. "I'll take it at forty-five, not forty." — a close idiom welded to an
 *      "at <price>, NOT <price>" COUNTER. The candidate accepts AT a figure they
 *      name and explicitly rejects the on-table offer — a price-counter, not an
 *      unconditional close. New COUNTER_NOT_NUMBER_PATTERN keys on the "not
 *      <bare cardinal>" tell (digit or spelled), which a genuine "I accept at
 *      40" never carries.
 *   B. "Accept it, you say? Hard pass." — a QUOTATIVE ATTRIBUTION welded to the
 *      accept idiom. The bare verb + object + comma slipped PRI-76's
 *      "?"-terminator fix; the tell is the reported-speech tag (you/they + say/
 *      said) echoing the recruiter's instruction, never the candidate's commit.
 *      New arm in RHETORICAL_ACCEPT_VETO_PATTERNS.
 *
 * Each fix is scoped so a genuine accept is untouched: "I accept at 40" negates
 * no number, and a real close never attributes the accept to "you say". */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "I'll take it at forty-five, not forty.",
  "I'll take it at 45, not 40.",
  "Deal at fifty, not forty.",
  "Accept it, you say? Hard pass.",
  "Sign this, they said — I won't.",
  "Take it, so you say. Not a chance.",
];

const GENUINE_ACCEPT: string[] = [
  "Yes, I accept the offer.",
  "Okay, I'll take it.",
  "Great, count me in — I accept at 40.",
  "Deal. Send the paperwork.",
  "Fine, I'll sign today.",
  "You've got a deal.",
];

describe("PRI-77 — hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-77 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
