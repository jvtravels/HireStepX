/* PRI-86 (2026-07-10) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–85)
 * surfaced two false-close LEAKS, each fixed at the arm that already owned its
 * class — no new gate, single source of truth via FALSE_CLOSE_VETO_PATTERNS:
 *
 *   LEAK 1 — "Great pitch, love the team, but I accept nothing at this number."
 *     The accept verb fired but the OBJECT is a negative-polarity item
 *     ("nothing") — a flat refusal, the polar opposite of a close. The
 *     wrong-object arms key on a determiner or an "excuses" object; a bare
 *     "nothing/none/zilch" object carries neither. New ACCEPT_NOTHING_PATTERN.
 *
 *   LEAK 2 — "Before I accept, the number has to move." A FRONTED TEMPORAL
 *     PRECONDITION ("before/until I accept, …") makes the accept a not-yet-
 *     reached event — a condition for a future close, not a close now.
 *     CONDITIONAL_DEFERRAL keys on a subordinator + a SETTLEMENT verb, but here
 *     the deferred verb IS the accept. New BEFORE_ACCEPT_PATTERN owns the
 *     fronted-temporal frame — and is anchored to clause-initial position so a
 *     TRAILING "…before I sign" adverbial on an already-consummated accept ("I'd
 *     like to accept this offer — please share benefits before I sign") is NOT
 *     vetoed (pinned in interviewEvaluation.test.ts as a genuine acceptance).
 *
 * Pins both polarities so neither fix can drift into re-opening a genuine
 * accept (note "That's acceptable — I accept." must still close: the adjective
 * "acceptable" is not the accept verb). */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK 1 — negative-polarity object
  "Great pitch, love the team, but I accept nothing at this number.",
  "I'll accept none of this.",
  "I accept nada at that figure.",
  // LEAK 2 — FRONTED temporal precondition governing the accept verb
  "Before I accept, the number has to move.",
  "Until I accept, nothing is final.",
  "Prior to accepting, I need the base revised.",
  // LEAK 3 — conditional "revise the offer / match my counter, THEN I'll sign"
  // (offline hostile battery, 2026-07-17). The settle verb ("sign"/"accept") is
  // real, but a demand to REVISE THE OFFER UPWARD ("a better offer") or MATCH MY
  // COUNTER precedes it — an unmet demand, not a close. Vetoed at the demand-
  // intent source (_utterance-intent.ts: revise-offer-up core + beat-match's new
  // "counter/ask/demand" objects), not with a new accept-side gate.
  "Send me a better offer and I'll sign.",
  "Get me a higher offer and I'll accept.",
  "Come back with a revised number and I'm in.",
  "Match my counter and I'll sign today.",
  "Match my ask and we have a deal.",
  // Negation counterparts of the 2026-07-17 recall additions must NOT close.
  "I'm not ready to join at this number.",
  "I'm not happy to move forward with this offer.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "Okay, I accept — let's do it.",
  "You've got a deal.",
  // "acceptable" adjective must NOT block the trailing genuine accept
  "That's acceptable — I accept.",
  // TRAILING "before I sign" adverbial on a consummated accept still closes —
  // the fronted-only anchor keeps this genuine long acceptance intact.
  "I'd like to accept this offer formally — please share the benefits package before I sign.",
  // Hortative / readiness SIGN frame (offline hostile-recall sweep 2026-07-17).
  // The bank owned first-person-singular "I'll sign" but missed the plural
  // hortative and the readiness idiom — "let's sign the paperwork" is about as
  // unambiguous a close as exists.
  "Let's sign the paperwork.",
  "Let's sign.",
  "Ready to sign.",
  "I'm ready to sign.",
  // Recall sweep 2026-07-17 — e-sign idiom, positive-affect move-forward, and
  // readiness-to-join, each negation-safe at its single source.
  "Where do I e-sign?",
  "I'm happy to move forward with this offer.",
  "I'm ready to join.",
  "I'm ready to join the team.",
];

describe("PRI-86 — negative-object & temporal-precondition leaks stay vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-86 — genuine accepts still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
