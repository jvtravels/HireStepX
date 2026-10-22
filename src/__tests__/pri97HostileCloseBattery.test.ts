/* PRI-97 (2026-07-12, round-18 offline hostile close battery) — a fresh
 * adversarial probe against classifyAcceptance + detectExplicitAcceptance
 * surfaced two more FALSE-CLOSE classes, each fixed structurally at the single
 * source of truth (_acceptance-classifier), shared between the medium gate
 * (classifyAcceptance) and the strict gate (detectExplicitAcceptance) so both
 * move in lockstep:
 *
 *   A. NEGATED-BELIEF imperative — a negated belief verb governing a FIRST-
 *      PERSON embedded clause: "Don't think I'll sign that." The PRI-74 arm
 *      owns the "don't EXPECT ME to sign" object form; the belief-verb form
 *      ("don't think I'll sign", no "me" object) slipped the strict gate's
 *      disbelief frame and false-closed the medium gate on the embedded verb.
 *      New arm on RHETORICAL_ACCEPT_VETO_PATTERNS keyed on the first-person
 *      subject sitting between the belief verb and the commit verb.
 *   B. TRAILING STANDALONE-NEGATOR reversal — a close idiom flipped by a self-
 *      contained sentence-final negator: "Wow, what a deal. I'll take it. (No.)",
 *      "Deal. No.", "I'll sign. Nope." TRAILING_NOT_NEGATION owns only the
 *      dash/ellipsis "— not"; this owns the terminal bare "no/nope/not really"
 *      (optionally parenthesized). New TRAILING_NEGATOR_REVERSAL_PATTERN.
 *
 * Every GUARD asserts the fixes are scoped: genuine unconditional closes still
 * accept, the hesitation idiom "Don't think twice, I'll sign." stays ACCEPTED
 * (the "twice" breaks the negated-belief adjacency), and a trailing "No"
 * that is not a standalone negator — "I'll take it. No question." / "Deal, no
 * doubt." / "I accept. Now what?" — keeps its accept.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance, detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;
const strict = (t: string) => detectExplicitAcceptance(t).accepted;
const neither = (t: string) => acc(t) === false && strict(t) === false;

describe("PRI-97 A — negated-belief imperative refusal", () => {
  it("'Don't think I'll sign that.' → NOT accepted (both gates)", () => {
    expect(neither("Don't think I'll sign that.")).toBe(true);
  });
  it("medium gate specifically rejects 'Don't think I'll sign that.' (was the leak)", () => {
    expect(acc("Don't think I'll sign that.")).toBe(false);
  });
  it("'Don't believe I'm going to accept this.' → NOT accepted", () => {
    expect(acc("Don't believe I'm going to accept this.")).toBe(false);
  });
  it("'Don't imagine for a second I'll take it.' → NOT accepted", () => {
    expect(acc("Don't imagine for a second I'll take it.")).toBe(false);
  });
  it("'Don't assume I'll be signing anything.' → NOT accepted", () => {
    expect(acc("Don't assume I'll be signing anything.")).toBe(false);
  });
});

describe("PRI-97 B — trailing standalone-negator reversal", () => {
  it("'Wow, what a deal. I'll take it. (No.)' → NOT accepted (both gates)", () => {
    expect(neither("Wow, what a deal. I'll take it. (No.)")).toBe(true);
  });
  it("'Deal. No.' → NOT accepted", () => {
    expect(acc("Deal. No.")).toBe(false);
  });
  it("'I'll sign. Nope.' → NOT accepted", () => {
    expect(acc("I'll sign. Nope.")).toBe(false);
  });
  it("'Fine, I accept. Not really.' → NOT accepted", () => {
    expect(acc("Fine, I accept. Not really.")).toBe(false);
  });
});

describe("PRI-97 GUARDS — genuine closes and non-negator tails still accept", () => {
  it("'Yes, I accept the offer.' → accepted", () => {
    expect(acc("Yes, I accept the offer.")).toBe(true);
  });
  it("'Deal, let's do it.' → accepted", () => {
    expect(acc("Deal, let's do it.")).toBe(true);
  });
  it("GUARD: 'Don't think twice, I'll sign.' stays ACCEPTED (hesitation idiom, 'twice' breaks adjacency)", () => {
    expect(acc("Don't think twice, I'll sign.")).toBe(true);
  });
  it("GUARD: 'I'll take it. No question.' stays ACCEPTED ('question' follows 'no')", () => {
    expect(acc("I'll take it. No question.")).toBe(true);
  });
  it("GUARD: 'Deal, no doubt.' stays ACCEPTED (comma, and 'doubt' follows 'no')", () => {
    expect(acc("Deal, no doubt.")).toBe(true);
  });
  it("GUARD: 'I accept. Now what?' stays ACCEPTED ('Now' ≠ 'no')", () => {
    expect(acc("I accept. Now what?")).toBe(true);
  });
});
