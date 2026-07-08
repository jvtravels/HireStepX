/* Adversarial wall for the conjunction-independent unmet-demand gate
 * (_utterance-intent.ts + classifyAcceptance). This is the CheckList-
 * style behavioral battery that keeps the demand-then-close FALSE-CLOSE
 * class CLOSED: it machine-generates the cross-product of
 *   {demand phrasing} × {conjunction} × {close idiom}
 * and asserts every combination is NOT accepted, regardless of the
 * joiner. The old eight bridge-vetoes only spanned `and|then|&`; a
 * comma / "plus" / "with" / no-joiner defeated all of them at once and
 * FALSE-CLOSED a conditional counter at the un-bumped offer — the worst
 * failure mode. If any future edit reopens a joiner, this wall goes red.
 *
 * The safe-default contract under test: an unmet demand can only BLOCK
 * a close, never create one. Missing a genuine accept costs one turn;
 * fabricating a close on a demand is unrecoverable — so these assert the
 * safe direction exhaustively, and a companion block asserts genuine
 * unconditional accepts still fire (no over-blocking). */
import { describe, it, expect } from "vitest";
import {
  classifyAcceptance,
  detectExplicitAcceptance,
} from "../../server-handlers/_acceptance-classifier";
import { analyzeDemand, carriesUnmetDemand } from "../../server-handlers/_utterance-intent";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" as const };
const accepted = (t: string) => classifyAcceptance(t, ctx).accepted;

/* Demand clauses that, at a ₹40L standing offer, are unmet raises. */
const DEMANDS = [
  "bump the base by 5 lakh",
  "add 5 lakh to the base",
  "match my current base",
  "give me 45",
  "throw in relocation",
  "make it a Principal role",
  "push the base up by a couple percent",
  "get the fixed to 55",
  "I want 2 lakh more",
  "a lakh more",
  "beat their number",
  "include equity",
];

/* Close / commit idioms the candidate welds the demand to. */
const CLOSERS = [
  "I'll sign today",
  "I'm in",
  "deal",
  "count me in",
  "let's close it",
  "you've got a deal",
  "I'll take it",
];

/* Every conjunction that must NOT let the demand slip past — the old
 * vetoes only handled the first three. */
const JOINERS = [", ", " and ", " then ", " & ", " plus ", " with ", "; ", " — ", ". "];

describe("intent gate — generated demand × joiner × closer battery must never FALSE-CLOSE", () => {
  for (const d of DEMANDS) {
    for (const j of JOINERS) {
      for (const c of CLOSERS) {
        const utter = `${d}${j}${c}.`;
        it(`no-close: "${utter}"`, () => expect(accepted(utter)).toBe(false));
      }
    }
  }
});

/* Reversed order — closer first, demand second — must also block. */
describe("intent gate — reversed (closer then demand) must never FALSE-CLOSE", () => {
  for (const d of DEMANDS.slice(0, 6)) {
    for (const c of CLOSERS.slice(0, 4)) {
      const utter = `${c}, but ${d}.`;
      it(`no-close: "${utter}"`, () => expect(accepted(utter)).toBe(false));
    }
  }
});

/* Genuine unconditional accepts — the demand detector must NOT
 * over-block. A number at or below the offer is a concession, not a
 * demand; a numberless commit carries no demand. */
const GENUINE = [
  "Alright, let's do this.",
  "You've got a deal.",
  "Send the paperwork, I'm in.",
  "Okay, I'll take it.",
  "That works for me, let's proceed.",
  "Fine, I accept.",
  "Deal. Send the letter.",
  "Okay, 40 works, I'll take it.",
  "I'll take 40.",
  "Yes, send me the offer letter.",
  "Give me the paperwork and I'm in.",
  "Happy at 38, let's close.",
  "I'll do 40 lpa.",
];
describe("intent gate — genuine unconditional accepts still fire (no over-block)", () => {
  for (const t of GENUINE) {
    it(`accepts: "${t}"`, () => expect(accepted(t)).toBe(true));
  }
});

/* Hostile-probe round (2026-07-09) — demand-then-close phrasings the
 * demand×joiner×closer battery does NOT span: question-form demands,
 * non-imperative sweetener asks, and million/crore currency units. Each
 * must block; each was a live leak before the sweetener-demand /
 * demand-question cores and unit normalization landed. */
describe("intent gate — novel demand-then-close phrasings must block", () => {
  const HOSTILE = [
    // question-form absolute demand > offer
    "could you do 46? deal",
    "any chance of 45? I'll take it",
    "can you get me to 45? I'm in",
    // non-imperative sweetener demand
    "it'd be great to see relocation added, deal",
    "would be perfect with a joining bonus, I'll sign",
    "fine on base but I need equity, deal",
    "I accept, just add a 5 lakh signing bonus",
    // million / crore currency units normalized to lakhs
    "push it to 4.5M, I'll take it",
    "make it 0.5 crore, deal",
  ];
  for (const t of HOSTILE) {
    it(`no-close: "${t}"`, () => expect(accepted(t)).toBe(false));
  }
});

/* Acquiescence conditionals are CONCESSION accepts, not hard conditionals —
 * the broad "if" veto and the bridge-style conditional-accept veto both
 * over-blocked them before the acquiescence exception landed. */
describe("intent gate — acquiescence conditionals still accept (no over-block)", () => {
  for (const t of [
    "if that's the best you can do, I'll take it",
    "if you say so, deal",
    "if that works for you, count me in",
  ]) {
    it(`accepts: "${t}"`, () => expect(accepted(t)).toBe(true));
  }
});

/* Lockstep wall (2026-07-09) — the STRICT gate (detectExplicitAcceptance)
 * drives the closing UI + kernel escalation-boost, so a strict FALSE-ACCEPT on
 * an unmet demand is a soft FALSE-CLOSE. Its HEDGE_VETO_PATTERNS spread only the
 * old conjunction-bridge vetoes (and|then|&); a comma/plus/with/no-joiner
 * defeated them and matched a strict close idiom. A differential probe found
 * 407/756 demand-then-close utterances accepted by the strict gate while the
 * medium gate blocked them. The fix wired analyzeDemand (single source of truth)
 * into detectExplicitAcceptance. This wall asserts the two gates stay in
 * lockstep: the strict gate must NEVER accept an offer-independent demand welded
 * to a close idiom, across every joiner. If a future edit desyncs them, red. */
describe("gate lockstep — strict gate must never accept a demand-then-close", () => {
  /* Offer-independent demands (relative / sweetener / comparative / title /
   * absolute-TARGET change) — flagged by analyzeDemand even with no offer, which
   * is all the strict gate has. Bare "give me N" is excluded: it needs the offer
   * to prove it exceeds, so the strict gate deliberately cannot flag it. */
  const OFFER_INDEPENDENT = [
    "bump the base by 5 lakh",
    "add 5 lakh to the base",
    "match my current base",
    "throw in relocation",
    "make it a Principal role",
    "push the base up by a couple percent",
    "get the fixed to 55",
    "I want 2 lakh more",
    "a lakh more",
    "beat their number",
    "include equity",
    "make it 50",
  ];
  const STRICT_CLOSERS = [
    "I'll take it",
    "I'm in",
    "let's close it",
    "you've got a deal",
    "let's go ahead",
    "send the offer letter",
  ];
  for (const d of OFFER_INDEPENDENT) {
    for (const j of [", ", " and ", " then ", " plus ", " with ", "; ", ". "]) {
      for (const c of STRICT_CLOSERS) {
        const utter = `${d}${j}${c}.`;
        it(`strict blocks: "${utter}"`, () =>
          expect(detectExplicitAcceptance(utter).accepted).toBe(false));
      }
    }
  }
  /* And the strict gate must still fire on clean performatives (no over-block). */
  for (const t of [
    "I accept the offer.",
    "Please send me the offer letter.",
    "I'll take it.",
    "Yes, let's close it.",
    "Let's go ahead.",
  ]) {
    it(`strict accepts clean: "${t}"`, () =>
      expect(detectExplicitAcceptance(t).accepted).toBe(true));
  }
});

describe("analyzeDemand — structured extractor unit behavior", () => {
  it("flags an above-offer bare demand only when the offer is known and exceeded", () => {
    expect(carriesUnmetDemand("give me 45", 40)).toBe(true);
    expect(carriesUnmetDemand("give me 40", 40)).toBe(false); // at offer = concession
    expect(carriesUnmetDemand("give me 45")).toBe(false); // offer unknown → not provably a demand
  });
  it("flags an absolute raise target only when it beats the offer", () => {
    expect(carriesUnmetDemand("make it 50", 40)).toBe(true);
    expect(carriesUnmetDemand("make it 40", 40)).toBe(false);
  });
  it("always flags relative/sweetener/comparative/title asks (inherently upward)", () => {
    expect(carriesUnmetDemand("a lakh more", 40)).toBe(true);
    expect(carriesUnmetDemand("throw in a joining bonus", 40)).toBe(true);
    expect(carriesUnmetDemand("beat their number", 40)).toBe(true);
    expect(carriesUnmetDemand("make it a Staff title", 40)).toBe(true);
  });
  it("does not flag gratitude or numberless commits", () => {
    expect(carriesUnmetDemand("3% more than I expected, deal", 40)).toBe(false);
    expect(carriesUnmetDemand("send me the paperwork", 40)).toBe(false);
    expect(carriesUnmetDemand("I'll take it", 40)).toBe(false);
  });
  it("reports which cores fired for telemetry", () => {
    expect(analyzeDemand("make it 50", 40).reasons).toContain("raise-to-target");
    expect(analyzeDemand("throw in equity", 40).reasons).toContain("grant-sweetener");
  });
});
