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
