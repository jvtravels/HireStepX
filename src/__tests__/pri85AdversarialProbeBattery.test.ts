/* PRI-85 (2026-07-10) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–84)
 * surfaced two IMPOSSIBILITY-IDIOM false-close LEAKS, both fixed inside
 * RHETORICAL_ACCEPT_VETO_PATTERNS — the home of the negation-by-impossibility
 * class — no new gate, single source of truth:
 *
 *   LEAK 1 — "There's no world where I accept this." The impossibility NOUN
 *     was hard-coded to "no way"; "no world / no universe / no chance / …" are
 *     the same idiom (an accept declared impossible) and slipped the veto →
 *     FALSE-CLOSE on a flat refusal. Widened the noun to the full stock set.
 *
 *   LEAK 2 — "I'll believe this offer when I accept it — which is never." The
 *     accept core fires, then a clause-terminal "— which is never" declares it
 *     impossible ("I'll believe it when I accept it, which is never" sarcasm).
 *     Added an impossibility-TAG arm keyed on a commit verb followed by a
 *     terminal "which is never" (a following word exempts the genuine "which is
 *     never a light call").
 *
 * Pins both polarities so neither fix can drift into re-opening a genuine
 * accept. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK 1 — impossibility-noun widening beyond "no way"
  "There's no world where I accept this.",
  "No universe where I sign that.",
  "There's no chance I take this number.",
  "No planet where I accept 30L.",
  // LEAK 2 — accept core + clause-terminal "which is never" impossibility tag
  "I'll believe this offer when I accept it — which is never.",
  "You'll get my yes when I sign this, which is never.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  // controls — genuine closes carry no impossibility head/tag
  "I accept the offer.",
  "Okay, I accept — let's do it.",
  "Sounds good, I accept.",
  "You've got a deal.",
  // "which is never" that governs a following noun keeps the accept
  "I accept, which is never a light call for me.",
];

describe("PRI-85 — impossibility-idiom leaks stay vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-85 — genuine accepts still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
