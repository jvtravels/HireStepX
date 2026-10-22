import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

/* Family C / B82 (2026-07-17) — PARTIAL accept of a comp COMPONENT.
 * "I accept the base but not the variable component" accepts one slice while
 * rejecting a named component — the package isn't closed. The pre-existing
 * PARTIAL_ACCEPT_VETO money-noun list omitted the component nouns (variable,
 * equity, bonus, joining, stock, esop/rsu), so these false-closed. Verified
 * against ground truth before fixing; guards confirm genuine full accepts that
 * merely mention a component still close. */

const wo = { offerLpa: 40, offerOnTable: true, phase: "counter" } as const;
const acc = (t: string) => classifyAcceptance(t, wo).accepted;

describe("B82 — partial accept rejecting a comp component is NOT a full close", () => {
  it.each([
    "I accept the base but not the variable component.",
    "I'll take the base, but not the equity.",
    "I accept the offer but not the joining bonus.",
    "Yes, but not the stock component.",
    "Deal, except not the bonus.",
  ])("VETOES partial accept: %s", (t) => {
    expect(acc(t)).toBe(false);
  });
});

describe("B82 — guards: full accepts that merely mention a component still close", () => {
  it.each([
    "I accept the offer.",
    "Yes, I accept. The base and variable both work.",
    "Deal, the variable is generous.",
    "I accept — the equity vests fast, great.",
    "I'll take it, the joining bonus is a nice touch.",
  ])("ACCEPTS full close: %s", (t) => {
    expect(acc(t)).toBe(true);
  });
});
