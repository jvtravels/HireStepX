/* PRI-96 (2026-07-12, round-17 offline hostile close battery) — a fresh
 * adversarial probe against classifyAcceptance + detectExplicitAcceptance
 * surfaced five more FALSE-CLOSE classes, each fixed structurally at the single
 * source of truth (_acceptance-classifier), shared between the medium gate
 * (classifyAcceptance) and the strict gate (detectExplicitAcceptance) so both
 * move in lockstep:
 *
 *   A. VAGUE-OBJECT hypothetical — a willingness idiom whose object is an
 *      indefinite "something/anything" pinned to an APPROXIMATION tail:
 *      "I'd be happy to accept something in that range." (a willingness band,
 *      not a present close). New VAGUE_RANGE_ACCEPT_PATTERN.
 *   B. RHETORICAL QUOTE-INSTRUCTION — the accept reframed as a WORD to be
 *      quoted: "You want me to just say 'I accept'? It's not that simple."
 *      New arm on RHETORICAL_ACCEPT_VETO_PATTERNS.
 *   C. STRICT-GATE sarcastic refusal — "Deal? Not a chance." false-accepted in
 *      the strict gate only (the medium gate walk-away-rejected it). Added
 *      "not a chance" / "no chance" to SARCASTIC_REFUSAL_PATTERN, which the
 *      strict gate consumes via FALSE_CLOSE_VETO_PATTERNS.
 *   D. GATEKEEPER-CLEARANCE deferral — "Happy to sign — as soon as legal clears
 *      it." Added the clearance verbs (clear/greenlight/okay) to
 *      CONDITIONAL_DEFERRAL_PATTERN's settle-verb list.
 *   E. THEORETICAL qualifier ADJACENT to the accept — "I accept, in theory." /
 *      "In theory, I accept." New THEORETICAL_ACCEPT_PATTERN, scoped to the
 *      marker sitting directly adjacent to the accept idiom (refining, not
 *      reversing, PRI-95's deliberate exclusion of "in theory").
 *
 * Every GUARD asserts the fixes are scoped: genuine unconditional closes still
 * accept, "I'll accept anything at this point." (a real, if desperate, accept
 * with no approximation tail) stays ACCEPTED, and a distant "In theory that
 * works, but I accept in practice." keeps its accept.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance, detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;
const strict = (t: string) => detectExplicitAcceptance(t).accepted;
const neither = (t: string) => acc(t) === false && strict(t) === false;

describe("PRI-96 A — vague-object hypothetical", () => {
  it("'I'd be happy to accept something in that range.' → NOT accepted (both gates)", () => {
    expect(neither("I'd be happy to accept something in that range.")).toBe(true);
  });
  it("'I could take something around there.' → NOT accepted", () => {
    expect(acc("I could take something around there.")).toBe(false);
  });
  it("'Sure, I'll accept anything of that sort.' → NOT accepted", () => {
    expect(acc("Sure, I'll accept anything of that sort.")).toBe(false);
  });
});

describe("PRI-96 B — rhetorical quote-instruction", () => {
  it("'You want me to just say \\'I accept\\'? It's not that simple.' → NOT accepted (both gates)", () => {
    expect(neither("You want me to just say 'I accept'? It's not that simple.")).toBe(true);
  });
  it("'So you want me to say I take it, just like that?' → NOT accepted", () => {
    expect(acc("So you want me to say I take it, just like that?")).toBe(false);
  });
});

describe("PRI-96 C — strict-gate sarcastic refusal", () => {
  it("'Deal? Not a chance.' → NOT accepted (both gates)", () => {
    expect(neither("Deal? Not a chance.")).toBe(true);
  });
  it("strict gate specifically rejects 'Deal? Not a chance.' (was the leak)", () => {
    expect(strict("Deal? Not a chance.")).toBe(false);
  });
  it("'I'll sign? No chance.' → strict gate rejects", () => {
    expect(strict("I'll sign? No chance.")).toBe(false);
  });
});

describe("PRI-96 D — gatekeeper-clearance deferral", () => {
  it("'Happy to sign — as soon as legal clears it.' → NOT accepted (both gates)", () => {
    expect(neither("Happy to sign — as soon as legal clears it.")).toBe(true);
  });
  it("'I'll accept once finance greenlights the number.' → NOT accepted", () => {
    expect(acc("I'll accept once finance greenlights the number.")).toBe(false);
  });
  it("'Deal, after the board okays it.' → NOT accepted", () => {
    expect(acc("Deal, after the board okays it.")).toBe(false);
  });
});

describe("PRI-96 E — theoretical qualifier adjacent to the accept", () => {
  it("'I accept, in theory.' → NOT accepted (both gates)", () => {
    expect(neither("I accept, in theory.")).toBe(true);
  });
  it("'In theory, I accept.' → NOT accepted", () => {
    expect(acc("In theory, I accept.")).toBe(false);
  });
  it("'Theoretically, I'm in.' → NOT accepted", () => {
    expect(acc("Theoretically, I'm in.")).toBe(false);
  });
});

describe("PRI-96 GUARDS — genuine closes and non-adjacent markers still accept", () => {
  it("'Yes, I accept the offer.' → accepted", () => {
    expect(acc("Yes, I accept the offer.")).toBe(true);
  });
  it("'Deal. Send the paperwork.' → accepted", () => {
    expect(acc("Deal. Send the paperwork.")).toBe(true);
  });
  it("GUARD: 'I'll accept anything at this point.' stays ACCEPTED (no approximation tail)", () => {
    expect(acc("I'll accept anything at this point.")).toBe(true);
  });
  it("GUARD: 'In theory that works, but I accept in practice.' stays ACCEPTED (marker not adjacent)", () => {
    expect(acc("In theory that works, but I accept in practice.")).toBe(true);
  });
  it("GUARD: 'I want to say I accept the offer.' stays ACCEPTED (first-person, not 'you want me to say')", () => {
    expect(acc("I want to say I accept the offer.")).toBe(true);
  });
});
