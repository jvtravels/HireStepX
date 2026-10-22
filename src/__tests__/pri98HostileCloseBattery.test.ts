import { describe, it, expect } from "vitest";
import {
  classifyAcceptance,
  detectExplicitAcceptance,
} from "../../server-handlers/_acceptance-classifier";

/* PRI-98 (2026-07-12, round-19 offline hostile close battery).
 *
 * A fresh adversarial probe surfaced one more FALSE-CLOSE class: an accept verb
 * whose OBJECT is an ACCOUNTABILITY noun — "I accept full responsibility, but the
 * number stays." Taking ownership of blame/fault is a deflection of the offer,
 * never a close. The article-qualified non-offer object arm (WRONG_OBJECT_ACCEPT)
 * required a determiner and lacked the accountability noun family, so an
 * adjective-qualified bare object ("full responsibility") slipped both gates and
 * false-closed. Fixed structurally at the single source of truth
 * (ACCEPT_ACCOUNTABILITY_PATTERN in _acceptance-classifier), shared by the medium
 * gate (classifyAcceptance) and the strict gate (detectExplicitAcceptance) via
 * FALSE_CLOSE_VETO_PATTERNS so both move in lockstep. */

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" } as const;
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;
const strict = (t: string) => detectExplicitAcceptance(t).accepted;
const neither = (t: string) => acc(t) === false && strict(t) === false;

describe("PRI-98 — accountability-noun accept veto (both gates)", () => {
  it("the exact leak that surfaced: accept full responsibility → not a close", () => {
    expect(neither("I accept full responsibility, but the number stays.")).toBe(
      true,
    );
  });

  it.each([
    "I accept full responsibility, but the number stays.",
    "I accept responsibility for how this went, not this offer.",
    "I'll accept the blame here.",
    "I accept personal blame for the miscommunication.",
    "I accept fault on my end, but the base is still low.",
    "I accept complete responsibility for the delay.",
    "I accept liability for that mistake.",
    "I accept accountability, but I'm still not signing at forty.",
    "I accept sole responsibility, though the number needs to move.",
    "I accept no responsibility for their lowball.",
    "I'm accepting responsibility, not the package.",
    "I accept my share of the blame.",
  ])("REJECTS (accountability object, not the offer): %s", (t) => {
    expect(neither(t)).toBe(true);
  });
});

describe("PRI-98 — guards: genuine closes still accept", () => {
  it.each([
    "Yes, I accept the offer.",
    "Great, I'll take it. Send the paperwork.",
    "Deal. Let's move forward.",
    "Perfect, that works for me. I accept.",
    // near-miss lexical neighbours that must NOT be swept by the veto
    "I accept the offer — the responsibility is mine to deliver.",
  ])("ACCEPTS: %s", (t) => {
    expect(acc(t)).toBe(true);
  });
});

/* Round-20 (2026-07-12, offline hostile sweep) — two new FALSE-CLOSE classes.
 *
 * (A) Zero-complementizer propositional clause. English drops the "that":
 *     "I accept this is a good company", "I accept things are tight" are
 *     concession-AGREEMENTS, not a close on the offer. ACCEPT_PROPOSITION only
 *     matched an explicit "that" or a fixed noun (reality/fact/…); a bare
 *     pronoun subject + finite verb slipped through. Fixed by extending
 *     ACCEPT_PROPOSITION_PATTERN (single source), so both gates move in lockstep.
 * (B) Attributed / reported accept. A belief/speech verb fronting "I'll accept"
 *     ("My wife thinks I'll accept, she's wrong.") makes the accept a reported
 *     proposition, contingent and usually contradicted — never a same-turn
 *     commit. Fixed via REPORTED_ACCEPT_PATTERN in FALSE_CLOSE_VETO_PATTERNS. */

describe("Round-20 (A) — zero-complementizer propositional clause veto", () => {
  it.each([
    "I accept this is a good company to work for.",
    "I accept things are tight on your end.",
    "I accept you are right about the market.",
    "I accept it is what it is.",
    "I accept we are far apart on base.",
    "I accept there is a budget ceiling, but the number's still low.",
  ])("REJECTS (agreeing a proposition, not the offer): %s", (t) => {
    expect(neither(t)).toBe(true);
  });
});

describe("Round-20 (B) — attributed / reported accept veto", () => {
  it.each([
    "My wife thinks I'll accept, she's wrong.",
    "They assume I'll accept but I won't.",
    "You expect I'll accept this? No.",
    "He figured I'd accept without a fight.",
    "HR presumes I'll sign — I'm not there yet.",
  ])("REJECTS (accept attributed to another's belief): %s", (t) => {
    expect(neither(t)).toBe(true);
  });
});

describe("Round-20 — guards: genuine closes untouched by both new vetoes", () => {
  it.each([
    "Yes, I accept the offer.",
    "I accept it.",
    "I accept this offer.",
    "I accept your offer.",
    "I'll accept the package.",
    "I accept the role.",
    "Okay, forty works for me. I'm in.",
    "I would like to accept this offer.",
    "I'm accepting the offer today.",
  ])("ACCEPTS: %s", (t) => {
    expect(acc(t)).toBe(true);
  });
});

/* Round-21 (2026-07-13, offline hostile sweep) — determiner-noun clause subject.
 *
 * The round-20 zero-complementizer arm only caught a BARE pronoun/expletive
 * subject abutting the finite verb ("I accept this is over"). A clause whose
 * subject is a full noun phrase — determiner + noun head + finite verb — slipped
 * it: "I accept this call is over. Goodbye." false-closed (both gates), yet the
 * candidate is DISENGAGING, not consenting to the offer. Fixed structurally by
 * extending ACCEPT_PROPOSITION_PATTERN's determiner arm to allow an optional
 * single noun head before the finite verb (single source; both gates move in
 * lockstep). The trailing finite verb stays the disambiguator — a genuine
 * "accept this offer" / "accept the role" has a noun head but NO following verb,
 * so it is untouched (guarded below). */
describe("Round-21 — determiner-noun clause-subject veto (both gates)", () => {
  it("the exact leak that surfaced: accept this call is over → walk-away, not a close", () => {
    expect(neither("I accept this call is over. Goodbye.")).toBe(true);
  });

  it.each([
    "I accept this call is over. Goodbye.",
    "I accept the offer is final, but I'm out.",
    "I accept that budget is tight on your side.",
    "I accept this conversation is going nowhere.",
    "I accept the market is soft right now.",
    "I accept this process was rushed.",
  ])("REJECTS (agreeing a noun-phrase proposition, not the offer): %s", (t) => {
    expect(neither(t)).toBe(true);
  });
});

describe("Round-21 — guards: determiner-noun genuine closes still accept", () => {
  it.each([
    "I accept this offer.",
    "I accept the offer as-is.",
    "I accept the role.",
    "I accept this package, let's go.",
    "I accept the offer, where do I sign?",
  ])("ACCEPTS: %s", (t) => {
    expect(acc(t)).toBe(true);
  });
});

/* Round-22 (2026-07-13, offline hostile sweep) — Hindi complementizer "ki".
 *
 * This product targets Indian candidates and supports Hindi-mix (Hinglish)
 * speech, in which the standard complementizer is "ki" (= English "that"). A
 * punctuation-stripped ASR probe surfaced two false-closes: "haan i accept ki
 * company acchi hai par number kam hai" ("yes, I accept THAT the company is
 * good, but the number is low") and "i accept ki aap sahi ho but paisa kam hai"
 * ("I accept THAT you are right, but the money is low"). Both are propositional
 * concessions — agreeing to an embedded clause, never a close on the offer — but
 * ACCEPT_PROPOSITION only knew the English "that"/zero complementizer. Fixed by
 * teaching that pattern the "ki" complementizer at its single source, so both
 * gates move in lockstep. A genuine Hinglish close ("haan theek hai, i accept
 * the offer") carries no "ki" clause and is untouched (guarded below).
 * These utterances are asserted in ASR form (lowercase, no punctuation) because
 * that is exactly how the voice STT layer delivers them in production. */
describe("Round-22 — Hindi complementizer 'ki' proposition veto (both gates)", () => {
  it("the exact leaks that surfaced (ASR form): accept ki <clause> → concession, not a close", () => {
    expect(
      neither("haan i accept ki company acchi hai par number kam hai"),
    ).toBe(true);
    expect(neither("i accept ki aap sahi ho but paisa kam hai")).toBe(true);
  });

  it.each([
    "haan i accept ki company acchi hai par number kam hai",
    "i accept ki aap sahi ho but paisa kam hai",
    "i accept ki budget tight hai but the base is still low",
    "i accept ki market slow hai right now",
    "look i accept ki you cannot move but neither can i",
  ])("REJECTS (Hinglish 'ki' proposition, not the offer): %s", (t) => {
    expect(neither(t)).toBe(true);
  });
});

describe("Round-22 — guards: genuine Hinglish closes still accept", () => {
  it.each([
    "haan theek hai i accept the offer",
    "haan ji i accept the offer",
    "ok done i accept it",
    "yes i accept the offer",
  ])("ACCEPTS: %s", (t) => {
    expect(acc(t)).toBe(true);
  });
});

/* S21-B1 (2026-07-22) — term-accept veto: "12 months pro-rata is fine with me"
 * auto-closed the session at ₹29.8L. The candidate was reacting to the clawback
 * STRUCTURE proposed for a joining bonus, not the total package — but
 * /fine\s+with\s+me/ in COMMITMENT_IDIOM_PATTERNS fired unconditionally. Fixed
 * by adding TERM_ACCEPT_FINE_WITH_ME_VETO to FALSE_CLOSE_VETO_PATTERNS, which
 * fires when a compensation-structure noun (pro-rata / clawback / vesting / cliff
 * / probation / bond clause / notice period) precedes "fine with me" in the same
 * clause — indicating a term reaction rather than an offer acceptance. */
describe("S21-B1 — term-accept veto: 'pro-rata is fine with me' ≠ offer close", () => {
  it.each([
    "12 months pro-rata is fine with me",
    "The pro-rata vesting is fine with me",
    "Clawback on the joining bonus is fine with me",
    "The clawback clause is fine with me, but I need 32 base",
    "Vesting schedule is fine with me",
    "The cliff period is fine with me",
    "One year cliff is fine with me",
    "Probation period is fine with me",
    "The bond clause is fine with me",
    "6 months notice period is fine with me",
  ])("REJECTS (term agreement, not offer close): %s", (t) => {
    expect(neither(t)).toBe(true);
  });

  it.each([
    "The offer is fine with me",
    "That number is fine with me",
    "Fine with me, let's move forward",
    "Sounds fine with me",
  ])("ACCEPTS (no comp-term antecedent): %s", (t) => {
    expect(acc(t)).toBe(true);
  });
});
