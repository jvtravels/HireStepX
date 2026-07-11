/* PRI-88 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–87) surfaced
 * a NEVER-EVENT IDIOM false-close LEAK, fixed with two arms in
 * RHETORICAL_ACCEPT_VETO_PATTERNS — the home of the impossibility-idiom class —
 * single source, shared by both gates:
 *
 *   LEAK 1 — stock impossibility EVENT idiom co-occurring with an accept verb:
 *     "It'll be a cold day in hell before I accept this.", "Pigs will fly before
 *     I accept.", "Not a snowball's chance I accept this." The PRI-85 arm owns the
 *     "no <noun>" impossibility HEAD ("no way/world/… I accept"); these carry a
 *     different idiom — a future impossible EVENT — and BEFORE_ACCEPT_PATTERN is
 *     clause-initial-anchored, so a TRAILING "before I accept" behind the idiom is
 *     not its job. The idiom appears only in refusals, so co-occurrence with an
 *     accept/take/sign verb in the same sentence (either order) is a safe veto.
 *
 *   LEAK 2 — EQUATIONAL never-idiom: "The day <implausible event> is the day I
 *     accept" ("The day you pay fairly is the day I accept") frames the accept as
 *     contingent on an event cast as never-arriving. Owned by a two-anchor "the
 *     day … is the day … accept" arm; a genuine present close mentioning a single
 *     day ("Today is the day I accept the offer") has only one "the day" and is
 *     left intact.
 *
 * Pins both polarities.
 *
 * KNOWN LIMITATION (documented, deliberately NOT fixed here): double-negation
 * litotes accepts ("I can't not accept this — I accept.", "There's no way I'm not
 * accepting … I accept.") are currently vetoed by the PRE-EXISTING PRI-85
 * no-way/negation arms — an OVERREACH, not introduced by PRI-88. Under the
 * safe-default contract an overreach costs one recoverable turn whereas a
 * false-close is unrecoverable; a naive polarity-flip fix risks re-opening the
 * far more dangerous "no way I accept" leak, so it is deferred to a dedicated
 * pass rather than bolted on next to the impossibility vetoes. Not asserted below
 * (neither polarity) so the suite reflects real current behaviour. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // impossibility EVENT idiom + accept verb (trailing "before I accept")
  "It'll be a cold day in hell before I accept this.",
  "Hell will freeze over before I accept that number.",
  "Pigs will fly before I accept this.",
  "When pigs fly I'll accept this.",
  // "snowball's chance" impossibility noun
  "Not a snowball's chance I accept this.",
  "Not a snowball's chance in hell I sign that.",
  // equational never-idiom
  "The day you pay fairly is the day I accept.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "You've got a deal.",
  "Okay, I accept — let's do it.",
  "Sounds good, I accept.",
  "Absolutely, I accept the offer.",
  // single "the day" present close — must NOT hit the equational arm
  "Today is the day I accept the offer.",
  // trailing benign "before I sign" on a consummated accept still closes
  "I'd like to accept this offer formally — please share the benefits package before I sign.",
];

describe("PRI-88 — never-event idiom accepts stay vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-88 — genuine accepts still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
