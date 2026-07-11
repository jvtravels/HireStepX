/* PRI-76 (2026-07-10, round-8 offline hostile accept/close probe against the
 * acceptance-classifier single source of truth) — two false-closes (the
 * unrecoverable class: the bot finalizes a deal the candidate is refusing):
 *
 *   A. "I'll accept it when hell freezes over." — the "when pigs fly"
 *      impossibility sibling. SARCASTIC_REFUSAL_PATTERN widened with
 *      (?:when|till|until) hell freezes (over).
 *   B. "Accept? Ha. Ask me again at 55." — a bare accept verb TERMINATED BY
 *      "?" is an interrogative echo of the recruiter's ask ("will you
 *      accept?"), never the candidate's own commitment. The bare-verb
 *      performative arm's trailing clause-terminator dropped "?" so an
 *      interrogative no longer false-closes. A genuine terse close ends with
 *      .!, or nothing — never "?".
 *
 * Each fix is scoped so a genuine accept is untouched: an impossibility tag
 * never rides a real close, and a committal bare verb never ends in "?". */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const SHOULD_NOT_ACCEPT: string[] = [
  "I'll accept it when hell freezes over.",
  "I'll take it till hell freezes over.",
  "Accept? Ha. Ask me again at 55.",
  "Accept? I think not.",
  "You want me to accept? No.",
];

const GENUINE_ACCEPT: string[] = [
  "Yes, I accept the offer.",
  "Okay, I'll take it.",
  "accept.",
  "yes accept it",
  "Great, count me in — I accept at 40.",
  "You've got a deal.",
];

describe("PRI-76 — hostile accept/close no longer false-closes", () => {
  for (const t of SHOULD_NOT_ACCEPT) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-76 — genuine closes still fire", () => {
  for (const t of GENUINE_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
