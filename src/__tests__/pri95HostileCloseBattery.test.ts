/* PRI-95 (2026-07-12, round-16 offline hostile close battery) — a fresh
 * adversarial probe against classifyAcceptance surfaced four more FALSE-CLOSE
 * classes, each fixed structurally at the single source of truth
 * (_acceptance-classifier), shared between the medium gate (classifyAcceptance)
 * and the strict gate (detectExplicitAcceptance) so both move in lockstep:
 *
 *   A. NON-COMMITTAL QUALIFIER — a close idiom hedged by a tentativeness adverb
 *      the candidate will walk back: "Agreed, tentatively.", "I accept,
 *      hypothetically speaking.", "Consider it done, more or less.", "I accept
 *      under protest." New TENTATIVE_QUALIFIER_PATTERN (sibling of IN_PRINCIPLE).
 *   B. COMPARISON deferral — the close deferred until the candidate shops the
 *      offer: "Sure, I'll sign — after I compare with my other offer." Added
 *      compare/weigh/evaluate to the shared CONSULT_DEFERRAL_PATTERN verb list.
 *   C. VEST-event deferral — "Great, I'll join once the ESOPs vest immediately."
 *      Added vest(s|ed|ing) to CONDITIONAL_DEFERRAL_PATTERN's settle-verb list.
 *   D. COMPETITOR REDIRECT reversal — "Sign me up — for the competitor, that
 *      is." New COMPETITOR_REDIRECT_PATTERN.
 *
 * Every GUARD asserts the fixes are scoped: a genuine unconditional close still
 * accepts, and "I accept, but we both know I'm worth double." (a real accept
 * with a grievance) is intentionally left ACCEPTED — the grievance is
 * commentary, not a condition.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance, detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;
const strict = (t: string) => detectExplicitAcceptance(t).accepted;

describe("PRI-95 A — non-committal tentativeness qualifier", () => {
  it("'Agreed, tentatively.' → NOT accepted", () => {
    expect(acc("Agreed, tentatively.")).toBe(false);
  });
  it("'I accept, hypothetically speaking.' → NOT accepted", () => {
    expect(acc("I accept, hypothetically speaking.")).toBe(false);
  });
  it("'Consider it done, more or less.' → NOT accepted", () => {
    expect(acc("Consider it done, more or less.")).toBe(false);
  });
  it("'I accept under protest.' → NOT accepted", () => {
    expect(acc("I accept under protest.")).toBe(false);
  });
  it("strict gate rejects the tentative qualifier too (lockstep)", () => {
    expect(strict("I accept, hypothetically speaking.")).toBe(false);
    expect(strict("I accept under protest.")).toBe(false);
  });
});

describe("PRI-95 B — comparison deferral (shopping the offer)", () => {
  it("'Sure, I'll sign — after I compare with my other offer.' → NOT accepted", () => {
    expect(acc("Sure, I'll sign — after I compare with my other offer.")).toBe(false);
  });
  it("'Count me in once I've weighed the options.' → NOT accepted", () => {
    expect(acc("Count me in once I've weighed the options.")).toBe(false);
  });
  it("strict gate rejects the comparison deferral too (lockstep)", () => {
    expect(strict("I'll sign after I compare with my other offer.")).toBe(false);
  });
});

describe("PRI-95 C — vest-event deferral", () => {
  it("'Great, I'll join once the ESOPs vest immediately.' → NOT accepted", () => {
    expect(acc("Great, I'll join once the ESOPs vest immediately.")).toBe(false);
  });
});

describe("PRI-95 D — competitor redirect reversal", () => {
  it("'Sign me up — for the competitor, that is.' → NOT accepted", () => {
    expect(acc("Sign me up — for the competitor, that is.")).toBe(false);
  });
  it("'Count me in, for the rival that is.' → NOT accepted", () => {
    expect(acc("Count me in, for the rival that is.")).toBe(false);
  });
});

describe("PRI-95 GUARDS — genuine closes still accept", () => {
  it("'Okay, you've got a deal. Let's do it.' → accepted", () => {
    expect(acc("Okay, you've got a deal. Let's do it.")).toBe(true);
  });
  it("'Perfect, let's make it official.' → accepted", () => {
    expect(acc("Perfect, let's make it official.")).toBe(true);
  });
  it("'Yes, I'll take the offer.' → accepted", () => {
    expect(acc("Yes, I'll take the offer.")).toBe(true);
  });
  it("GUARD: 'I accept, but we both know I'm worth double.' stays ACCEPTED (grievance, not a condition)", () => {
    expect(acc("I accept, but we both know I'm worth double.")).toBe(true);
  });
});
