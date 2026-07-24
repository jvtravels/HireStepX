/* §10 (2026-07-08) — consolidation. The conditional cash-bump parser used to be
 * seven `return offer + …` branches scattered through resolveConditionalCashTarget,
 * each keyed to a labeled live/offline defect (#33, #33b, #35, #36). Every new
 * hostile phrasing meant another branch and another soft-false-close risk when it
 * was missed. §10 folded them into ONE pure, offer- and NegotiationState-free
 * function — parseCashIncreaseIntent(text, { unitMandatory }) → CashIncreaseIntent
 * | null — so the whole battery can be exercised here in isolation, without
 * building a NegotiationState or driving the near-offer close gate.
 *
 * This file pins the parser's CONTRACT directly (the intent it returns per
 * surface form). The end-to-end close behavior each of these feeds into is still
 * covered by pri33WordMagnitudeBump.test.ts (#33/#33b/#35/#36 close-figure
 * assertions) and pri63JoiningBonusConditionalClose.test.ts — this is the unit
 * layer beneath those.
 */
import { describe, it, expect } from "vitest";
import {
  parseCashIncreaseIntent,
  type CashIncreaseIntent,
} from "../../server-handlers/_next-action-planner";

// Loose parse — no bonus co-occurring (unitMandatory: false).
const parse = (t: string): CashIncreaseIntent | null =>
  parseCashIncreaseIntent(t, { unitMandatory: false });
// Unit-mandatory parse — a bonus is also named (#36): the base delta must carry
// an explicit lakh unit to be trusted.
const parseWithBonus = (t: string): CashIncreaseIntent | null =>
  parseCashIncreaseIntent(t, { unitMandatory: true });

describe("parseCashIncreaseIntent — digit-anchored lakh deltas (#31/#34)", () => {
  it("'2L more' → delta +2", () => {
    expect(parse("I'll sign if you give me 2L more.")).toEqual({ kind: "delta", lakhs: 2 });
  });
  it("'another 3 lakh' → delta +3", () => {
    expect(parse("give me another 3 lakh and we're done")).toEqual({ kind: "delta", lakhs: 3 });
  });
  it("'bump it by 2.5L' → delta +2.5", () => {
    expect(parse("bump it by 2.5L then I'll sign")).toEqual({ kind: "delta", lakhs: 2.5 });
  });
  it("verb + bare amount 'add 2 lakh' → delta +2", () => {
    expect(parse("add 2 lakh and I'll sign")).toEqual({ kind: "delta", lakhs: 2 });
  });
});

describe("parseCashIncreaseIntent — word-magnitude lakh deltas (#33)", () => {
  it("'a couple of lakhs' → delta +2", () => {
    expect(parse("push the base up by a couple of lakhs")).toEqual({ kind: "delta", lakhs: 2 });
  });
  it("'a few lakh more' → delta +3 (bare 'more' cue carries increase intent)", () => {
    expect(parse("give me a few lakh more and I'm in")).toEqual({ kind: "delta", lakhs: 3 });
  });
  it("'several lakh more' → delta +4", () => {
    expect(parse("I want several lakh more")).toEqual({ kind: "delta", lakhs: 4 });
  });
  it("'a couple of days' carries no cash noun → null", () => {
    expect(parse("give me a couple of days to decide")).toBeNull();
  });
  /* Documented pre-existing gap (NOT introduced by the §10 consolidation): a
   * word-magnitude gated ONLY by "another" with no increase verb and no bare
   * "more/extra" cue does not resolve — the word-delta gate keys on the digit-
   * anchored `another`, which a word magnitude ("another few lakh") doesn't
   * trip. Pinned here so the behavior is explicit; a future iteration can widen
   * the gate if it shows up live. */
  it("[known gap] bare 'another few lakh' (no verb, no 'more' cue) → null", () => {
    expect(parse("another few lakh and I'm in")).toBeNull();
  });
});

describe("parseCashIncreaseIntent — article / fraction lakh deltas (#33b)", () => {
  it("'a lakh more' → delta +1", () => {
    expect(parse("just a lakh more and I'll sign")).toEqual({ kind: "delta", lakhs: 1 });
  });
  it("'half a lakh' → delta +0.5 (checked before the article branch)", () => {
    expect(parse("add half a lakh and we have a deal")).toEqual({ kind: "delta", lakhs: 0.5 });
  });
  it("'a day' / 'half an hour' never register", () => {
    expect(parse("give me a day")).toBeNull();
    expect(parse("in half an hour")).toBeNull();
  });
});

describe("parseCashIncreaseIntent — percent axis (#35), resolved before lakh", () => {
  it("'bump it 5%' → percent 5", () => {
    expect(parse("bump it 5% and I'll sign")).toEqual({ kind: "percent", pct: 5 });
  });
  it("'a couple of percent' → percent 2", () => {
    expect(parse("bump it a couple of percent")).toEqual({ kind: "percent", pct: 2 });
  });
  it("'another 3 percent' → percent 3 (NOT delta +3L)", () => {
    expect(parse("another 3 percent and we're done")).toEqual({ kind: "percent", pct: 3 });
  });
  it("'I'm 100 percent in' (acceptance idiom, no increase cue) → null", () => {
    expect(parse("I'm 100 percent in, send the letter")).toBeNull();
  });
  it("an out-of-range percent (>100) falls through, not a silent accept", () => {
    // "150 percent" fails the ≤100 cap and no lakh delta follows → null.
    expect(parse("bump it 150 percent")).toBeNull();
  });
});

describe("parseCashIncreaseIntent — absolute 'to N' (verb-gated)", () => {
  it("'bump it to 45L' → absolute 45", () => {
    expect(parse("bump it to 45L and I'll sign")).toEqual({ kind: "absolute", lakhs: 45 });
  });
  it("'to N' without an increase verb never registers ('get back to you')", () => {
    expect(parse("let me get back to 45 people")).toBeNull();
  });
});

describe("parseCashIncreaseIntent — directional-approach absolute (S50-B10)", () => {
  it("'get closer to ₹28L' → absolute 28 (S50-B10 root case)", () => {
    expect(parse("I'd genuinely like to make this work if we can get closer to ₹28L")).toEqual({
      kind: "absolute",
      lakhs: 28,
    });
  });
  it("'move towards 30L' → absolute 30", () => {
    expect(parse("I'll sign if you move towards 30L")).toEqual({ kind: "absolute", lakhs: 30 });
  });
  it("'come nearer to 27' → absolute 27 (no unit, treated as lakhs)", () => {
    expect(parse("come nearer to 27 and we have a deal")).toEqual({ kind: "absolute", lakhs: 27 });
  });
  it("'get back to you' is NOT a directional-approach (no adjacent figure)", () => {
    expect(parse("let me get back to you")).toBeNull();
  });
  it("'get closer to the market rate' is NOT a directional-approach (no digit figure)", () => {
    expect(parse("can you get closer to the market rate")).toBeNull();
  });
});

describe("parseCashIncreaseIntent — no numeric cash condition → null", () => {
  it("pure sweetener 'throw in a joining bonus' carries no base cash intent", () => {
    expect(parse("if you can throw in a joining bonus I'll sign")).toBeNull();
  });
  it("bare accept 'done' → null", () => {
    expect(parse("done, send it over")).toBeNull();
  });
  it("empty text → null", () => {
    expect(parse("")).toBeNull();
  });
});

describe("parseCashIncreaseIntent — unitMandatory guards the base axis (#36)", () => {
  it("compound 'give me 2L more and a joining bonus' → base delta +2 (unit present)", () => {
    expect(parseWithBonus("give me 2L more and a joining bonus")).toEqual({
      kind: "delta",
      lakhs: 2,
    });
  });
  it("verb+amount 'add 2 lakh and throw in a joining bonus' → base delta +2", () => {
    expect(parseWithBonus("add 2 lakh and throw in a joining bonus")).toEqual({
      kind: "delta",
      lakhs: 2,
    });
  });
  it("percent compound 'bump it 5% and a joining bonus' → percent 5 (% is its own unit)", () => {
    expect(parseWithBonus("bump it 5% and a joining bonus")).toEqual({ kind: "percent", pct: 5 });
  });
  it("GUARD: a bonus AMOUNT 'joining bonus of 2L' is NOT a base bump → null", () => {
    expect(parseWithBonus("I'll sign if you throw in a joining bonus of 2L")).toBeNull();
  });
  it("GUARD: a non-cash aside 'another 2 weeks and a joining bonus' is NOT a base bump → null", () => {
    expect(parseWithBonus("give me another 2 weeks and a joining bonus")).toBeNull();
  });
  it("a UNITLESS delta 'give me 2 more and a joining bonus' is NOT trusted as a base bump → null", () => {
    // Same phrasing WITHOUT a bonus would resolve to +2 (loose parse); with a
    // bonus co-occurring, the missing lakh unit means it must not be read as base.
    expect(parseWithBonus("give me 2 more and a joining bonus")).toBeNull();
    expect(parse("give me 2 more")).toEqual({ kind: "delta", lakhs: 2 });
  });
});
