import { describe, it, expect } from "vitest";
import { detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";

/* PRI-63b regression guard (2026-06-25, pre-launch audit CRIT-2).
 *
 * Sibling of PRI-63. The strict acceptance gate must VETO a positive close
 * idiom that carries a TRAILING, unmet sweetener requirement:
 *   "Yes, send the offer letter — just make sure the joining bonus is in there."
 *   "Sure, send it across, but I'll need that joining bonus included."
 * The close idiom ("send the offer letter") matches STRICT_ACCEPTANCE_PATTERNS,
 * so the strict gate read these as a bare accept and the kernel's escalation-
 * boost force-closed flat — silently DROPPING the candidate's joining-bonus
 * condition. That is a soft FALSE-CLOSE (the worst failure mode).
 *
 * Two invariants pinned:
 *   1. Post-positive sweetener REQUIREMENTS are vetoed (no flat false-close).
 *   2. Genuine bare accepts — and accepts that merely THANK for / mention an
 *      already-granted term without demanding one — still pass. */

describe("PRI-63b — post-positive sweetener requirement is vetoed", () => {
  const vetoed = [
    "Yes, send the offer letter — just make sure the joining bonus is in there.",
    "Sure, send it across, but I'll need that joining bonus included.",
    "Okay, send the offer, but I want the relocation in there too.",
    "Let's do it, just ensure the ESOP grant is in the letter.",
    "Yes I'm in, I'll need the signing bonus included.",
  ];
  for (const c of vetoed) {
    it(`vetoes: ${c}`, () => {
      expect(detectExplicitAcceptance(c).accepted).toBe(false);
    });
  }
});

describe("PRI-63b — genuine accepts are NOT over-vetoed", () => {
  const accepted = [
    "Yes, I accept the offer.",
    "Yes, send the offer letter.",
    "Send me the offer letter.",
    // mentions a sweetener but states NO outstanding requirement → genuine accept
    "Yes, I accept the offer with the joining bonus.",
    "Yes, I accept — the joining bonus works for me.",
  ];
  for (const c of accepted) {
    it(`accepts: ${c}`, () => {
      expect(detectExplicitAcceptance(c).accepted).toBe(true);
    });
  }
});
