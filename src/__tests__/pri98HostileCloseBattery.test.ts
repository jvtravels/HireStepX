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
