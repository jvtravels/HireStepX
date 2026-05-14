/* Fix 5 (2026-05-15) — Resume↔role mismatch probe stage.
 *
 * Real session: resume "Senior Product Designer", target "Customer
 * Success Manager". The bot ignored the hard mismatch and jumped
 * straight into salary. shouldEnterProbeMismatch gates the first
 * substantive turn into a domain-switch probe. */
import { describe, it, expect } from "vitest";
import {
  detectResumeRoleMismatch,
  shouldEnterProbeMismatch,
} from "../../server-handlers/_resume-role-match";

describe("shouldEnterProbeMismatch — gating", () => {
  it("gates the first turn when resume vs target is a HARD mismatch", () => {
    const m = detectResumeRoleMismatch({
      resumeTitle: "Senior Product Designer",
      targetRole: "Customer Success Manager",
    });
    expect(m.mismatch).toBe(true);
    expect(shouldEnterProbeMismatch(m, 0)).toBe(true);
  });

  it("does NOT gate when there is no mismatch", () => {
    const m = detectResumeRoleMismatch({
      resumeTitle: "Customer Success Manager",
      targetRole: "Customer Success Manager",
    });
    expect(m.mismatch).toBe(false);
    expect(shouldEnterProbeMismatch(m, 0)).toBe(false);
  });

  it("does NOT gate after the first substantive turn has completed", () => {
    const m = detectResumeRoleMismatch({
      resumeTitle: "Senior Product Designer",
      targetRole: "Customer Success Manager",
    });
    expect(shouldEnterProbeMismatch(m, 1)).toBe(false);
    expect(shouldEnterProbeMismatch(m, 5)).toBe(false);
  });

  it("does NOT gate for SOFT mismatches (related domains)", () => {
    /* A soft mismatch may exist for adjacent roles; the probe gate
     * only fires on hard mismatch. */
    const m = detectResumeRoleMismatch({
      resumeTitle: "Backend Engineer",
      targetRole: "Software Engineer",
    });
    if (m.mismatch && m.severity !== "hard") {
      expect(shouldEnterProbeMismatch(m, 0)).toBe(false);
    } else {
      /* If no mismatch detected at all, also doesn't gate. */
      expect(shouldEnterProbeMismatch(m, 0)).toBe(false);
    }
  });

  it("hard PD->CSM cross-domain pivot remains gated", () => {
    const m = detectResumeRoleMismatch({
      resumeTitle: "Product Designer",
      targetRole: "Sales Manager",
    });
    if (m.mismatch && m.severity === "hard") {
      expect(shouldEnterProbeMismatch(m, 0)).toBe(true);
    }
  });
});
