/* PRI-80 (2026-07-10, live staging accept-path drive, session e73040d0) — the
 * MISSED-CLOSE mirror of the false-close batteries. Driving a real negotiation,
 * a crystal-clear accept that ENUMERATED an already-offered package component
 * was silently rejected, so the bot ignored the close and fabricated a new
 * discovery question; it took a second, blunter accept to finally close.
 *
 * Root: the sweetener-demand core's passive-grant branch matched "[sweetener]
 * … on top | included" regardless of determiner, so "with THE 2L joining bonus
 * on top, I accept" read as a fresh demand and vetoed the accept. Fix: the
 * branch now carries the SAME definite/indefinite discipline the hypothetical
 * branch already documents — a sweetener referenced with a definite/possessive
 * determiner ("the/that/your … bonus") is a CONFIRMATION of the standing
 * package, not a new ask; a bare ("equity included") or indefinite ("a joining
 * bonus thrown in") sweetener still vetoes the welded false-close.
 *
 * The guards below pin BOTH directions so the fix can't drift into re-opening
 * the false-close it mirrors. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import { analyzeDemand } from "../../server-handlers/_utterance-intent";

const ctx = { offerLpa: 40.3, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const GENUINE_ACCEPT: string[] = [
  "Okay, that works for me. With the 2L joining bonus on top, I accept the offer at 40.3 fixed. Let's do it — send the paperwork.",
  "With the joining bonus included, I accept.",
  "With your ESOP grant included, I accept the offer.",
  "Yes to 40.3 fixed with that joining bonus on top — we have a deal.",
  "I'm in — with the relocation covered, deal.",
];

const STILL_VETO: string[] = [
  "Deal, with equity included.",
  "Deal, with a joining bonus thrown in.",
  "I want a joining bonus and then I'll sign.",
  "I'll sign if you add relocation.",
  "Sounds good, with an extra bonus on top.",
];

describe("PRI-80 — accept enumerating an already-offered lever closes", () => {
  for (const t of GENUINE_ACCEPT) it(`accepts: "${t.slice(0, 48)}…"`, () => expect(acc(t)).toBe(true));
});

describe("PRI-80 — bare/indefinite sweetener demand still vetoes the close", () => {
  for (const t of STILL_VETO) it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
});

describe("PRI-80 — intent core discriminates definite (confirm) vs new (demand)", () => {
  it("definite sweetener on-top is not an unmet demand", () => {
    expect(analyzeDemand("with the 2L joining bonus on top", 40.3).unmet).toBe(false);
    expect(analyzeDemand("with the joining bonus included", 40.3).unmet).toBe(false);
  });
  it("bare / indefinite sweetener grant is still an unmet demand", () => {
    expect(analyzeDemand("with equity included", 40.3).unmet).toBe(true);
    expect(analyzeDemand("with a joining bonus thrown in", 40.3).unmet).toBe(true);
  });
});
