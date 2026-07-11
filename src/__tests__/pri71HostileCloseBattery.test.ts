/* PRI-71 (2026-07-08, round-3 offline hostile close battery) — a fresh
 * adversarial probe against classifyAcceptance surfaced five more defects, each
 * fixed structurally at the single source of truth (_acceptance-classifier),
 * shared between the medium gate (classifyAcceptance) and the strict gate
 * (detectExplicitAcceptance) so both move in lockstep:
 *
 *   A. NONCOMP demand-then-close — a role/title/level upgrade welded to a close
 *      idiom: "Make it a Principal role and it's a deal." GRANT_THEN_CLOSE owns
 *      cash sweeteners and CONDITIONAL_RAISE owns a numeric raise; a non-comp
 *      designation demand was neither, so it FALSE-CLOSED at the un-upgraded
 *      offer. New NONCOMP_DEMAND_THEN_CLOSE veto.
 *   B. Written/escrow deferral — "I'll accept once it's in writing." The
 *      CONDITIONAL_DEFERRAL trailing predicate lacked "in writing"/"on paper"/
 *      "in the offer/contract/letter".
 *   C. Sarcasm suffix — "Deal of the century, said no one ever." New
 *      SARCASTIC_REFUSAL token "said no one ever".
 *   D. Self-cancelling retraction — "Deal — actually no, forget it." RETRACTION
 *      only owned kidding/jk; widened to never mind / forget it / scratch that /
 *      "actually no".
 *   E. Willingness NO-CLOSE — "I'd be glad to sign." was dropped. The narrow
 *      "happy to accept" performative is generalized to WILLING_TO_COMMIT
 *      (happy/glad/delighted/pleased/thrilled/keen to accept/sign/join) in the
 *      MEDIUM gate — kept out of strict exactly like "happy to accept" (strict
 *      promotion would flip the planner from `close` to `close-recap-formal`).
 *
 * Every GUARD asserts the fixes are scoped: "make it official and I'll sign"
 * still accepts (no level noun), a genuine willingness close still fires, and
 * the conditional/hedge vetoes that run first still exclude "glad to sign if…".
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance, detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;
const strict = (t: string) => detectExplicitAcceptance(t).accepted;

describe("PRI-71 A — non-comp demand (role/title/level) welded to close", () => {
  it("'Make it a Principal role and it's a deal.' → NOT accepted", () => {
    expect(acc("Make it a Principal role and it's a deal.")).toBe(false);
  });
  it("'Make it a Staff title and I'll sign.' → NOT accepted", () => {
    expect(acc("Make it a Staff title and I'll sign.")).toBe(false);
  });
  it("'Bump me to Director level and we're done.' → NOT accepted", () => {
    // "make it" isn't the only carrier — a level noun + and continuation still fires
    expect(acc("Make it a Director level and we're done.")).toBe(false);
  });
  it("strict gate rejects it too (lockstep)", () => {
    expect(strict("Make it a Principal role and it's a deal.")).toBe(false);
  });
  it("GUARD: 'Make it official and I'll sign.' still accepts (no level noun)", () => {
    expect(acc("Make it official and I'll sign.")).toBe(true);
  });
});

describe("PRI-71 B — written/escrow deferral", () => {
  it("'I'll accept once it's in writing.' → NOT accepted", () => {
    expect(acc("I'll accept once it's in writing.")).toBe(false);
  });
  it("'Count me in once it's on paper.' → NOT accepted", () => {
    expect(acc("Count me in once it's on paper.")).toBe(false);
  });
  it("'I'll sign once it's in the offer letter.' → NOT accepted", () => {
    expect(acc("I'll sign once it's in the offer letter.")).toBe(false);
  });
  it("strict gate rejects the written deferral too (lockstep)", () => {
    expect(strict("I'll accept once it's in writing.")).toBe(false);
  });
});

describe("PRI-71 C — sarcasm suffix", () => {
  it("'Deal of the century, said no one ever.' → NOT accepted", () => {
    expect(acc("Deal of the century, said no one ever.")).toBe(false);
  });
});

describe("PRI-71 D — self-cancelling retraction", () => {
  it("'Deal — actually no, forget it.' → NOT accepted", () => {
    expect(acc("Deal — actually no, forget it.")).toBe(false);
  });
  it("'I accept... never mind, that's insulting.' → NOT accepted", () => {
    expect(acc("I accept... never mind, that's insulting.")).toBe(false);
  });
  it("'Yes, deal. Scratch that.' → NOT accepted", () => {
    expect(acc("Yes, deal. Scratch that.")).toBe(false);
  });
});

describe("PRI-71 E — willingness-to-commit no longer dropped", () => {
  it("'I'd be glad to sign.' → accepted", () => {
    expect(acc("I'd be glad to sign.")).toBe(true);
  });
  it("'Delighted to accept.' → accepted", () => {
    expect(acc("Delighted to accept.")).toBe(true);
  });
  it("'Keen to join.' → accepted", () => {
    expect(acc("Keen to join.")).toBe(true);
  });
  it("'Happy to accept.' still accepts (unchanged behaviour)", () => {
    expect(acc("Happy to accept.")).toBe(true);
  });
  it("strict gate intentionally UNCHANGED — willingness stays medium-only (like 'happy to accept'), so the planner keeps its soft `close` not a formal recap", () => {
    expect(strict("I'd be glad to sign.")).toBe(false);
    expect(strict("Happy to accept.")).toBe(false);
  });
  it("GUARD: 'I'd be glad to sign if you bump the base.' still NOT accepted", () => {
    expect(acc("I'd be glad to sign if you bump the base.")).toBe(false);
  });
});
