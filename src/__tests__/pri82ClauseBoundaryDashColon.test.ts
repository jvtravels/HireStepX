/* PRI-82 (2026-07-10) — surfaced by the ADVERSARIAL DIFFERENTIAL AUDIT as an
 * OVERREACH (a genuine accept silently dropped — the same missed-close class as
 * the live I-5 bug, where an unambiguous accept took two turns to register).
 *
 * ROOT CAUSE: every clause-anchored accept/close pattern inlined its own leading
 * boundary as the char class `[,.!?]`. That recognizes a period/comma/!/? as a
 * clause separator but NOT an em-dash, en-dash, spaced hyphen, or colon — all of
 * which speech-to-text routinely emits between clauses. So "This is worth
 * signing, deal!" (comma) closed but "This is great — deal!" (em-dash) fell
 * through to no-match: the closer after the dash clause was never seen.
 *
 * FIX: a single shared CLAUSE_START boundary constant (single source of truth)
 * that adds the dash family + colon, composed into all six clause-anchored
 * patterns via `.source`. This battery pins the newly-covered dash/colon
 * closers AND the controls that must NOT regress (walk-away "no deal", the
 * "deal-breaker" negative lookahead, intra-word hyphens). */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

/* Closers that follow a dash/colon clause — previously dropped, must now close. */
const DASH_COLON_ACCEPTS: string[] = [
  "This is great — deal!",
  "Love it — deal!",
  "This is worth signing — deal!",
  "Honestly this is fair — I accept the offer.",
  "Perfect - I'll take it.",
  "Alright, you've talked me into it — deal.",
  "My answer: deal.",
  "Fine — confirmed.",
  "Sounds right — agreed.",
  "Okay — would like to accept.",
];

/* Controls — the new dash/colon boundary must NOT open a false-close. The
 * walk-away/negation vetoes and the deal-breaker lookahead still own these. */
const DASH_COLON_REFUSALS: string[] = [
  "This isn't worth it — no deal.",
  "That's a deal-breaker for me.",
  "Not a chance — I'm walking.",
  "The deal's off — find someone else.",
  "I can't accept — the base is too low.",
  "Send me a revised offer — then we'll talk.",
];

describe("PRI-82 — dash/colon clause boundary lets a real closer through", () => {
  for (const t of DASH_COLON_ACCEPTS)
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
});

describe("PRI-82 — dash/colon boundary opens no false-close", () => {
  for (const t of DASH_COLON_REFUSALS)
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
});
