/* Bug-report 14 (2026-05-14) — Senior Product Designer resume applying
 * for Social Media Manager at Schbang. AI opened at ₹32 LPA (6–8× market)
 * because:
 *
 *   1. `canonDomain("Social Media Manager")` returned null (no entry).
 *   2. `computeApplicableYoe` then hit the unclassifiable branch, where
 *      the default was `applicableYoe = totalYoe, relation = "unknown"`
 *      (full credit). With totalYoe=5, this maps to "senior" tier.
 *   3. The Schbang Social Media Manager senior-tier band was sky-high.
 *
 * Bug-13 (Operations Manager) was the SAME ROOT CAUSE; previously fixed
 * by adding operations/management keywords. That fix left the next
 * unknown role exposed — Bug-14 is the proof.
 *
 * Root-cause fix: when either side fails to classify, treat as pivot
 * (applicableYoe=0). This pins the contract so a future unrecognised
 * role can't reproduce the same catastrophic over-anchoring. We also
 * add a "social-media" domain bucket as a precision improvement (so
 * marketing↔social-media is correctly classified as adjacent, not as
 * the worst-case pivot default).
 */
import { describe, it, expect } from "vitest";
import {
  computeApplicableYoe,
  experienceLevelFromYoe,
} from "../../server-handlers/_candidate-profile";

describe("Bug-report 14 — unknown-domain target must not anchor a senior band", () => {
  it("Senior Product Designer (5y) → Social Media Manager → pivot, applicableYoe=0", () => {
    /* Now that "social-media" is in DOMAIN_KEYWORDS this case classifies
     * as a real pivot (product-design has no edge to social-media),
     * not as the fallback unknown-pivot. Either way applicableYoe=0. */
    const r = computeApplicableYoe({
      totalYoe: 5,
      primaryDomain: "Senior Product Designer",
      targetRole: "Social Media Manager",
    });
    expect(r.applicableYoe).toBe(0);
    expect(r.relation).toBe("pivot");
    expect(experienceLevelFromYoe(r.applicableYoe)).toBe("entry");
  });

  it("a never-before-seen target role still pivots (root-cause guarantee)", () => {
    /* The point of the fix: even for roles we have NO keyword for, the
     * kernel must not anchor to the candidate's senior YoE. This test
     * uses an intentionally absurd role string so a future engineer
     * cannot satisfy it by adding more keywords. */
    const r = computeApplicableYoe({
      totalYoe: 8,
      primaryDomain: "Senior Software Engineer",
      targetRole: "Quantum Snorkel Specialist",
    });
    expect(r.applicableYoe).toBe(0);
    expect(r.relation).toBe("pivot");
    expect(experienceLevelFromYoe(r.applicableYoe)).toBe("entry");
  });

  it("Content Writer (4y) → Social Media Manager → adjacent (skill transfer)", () => {
    /* Precision check: social-media being its own bucket lets us model
     * the marketing/content ↔ social-media adjacency correctly. */
    const r = computeApplicableYoe({
      totalYoe: 4,
      primaryDomain: "Content Writer",
      targetRole: "Social Media Manager",
    });
    expect(r.relation).toBe("adjacent");
    expect(r.applicableYoe).toBe(2);
  });

  it("Marketing Manager (6y) → Social Media Manager → adjacent", () => {
    const r = computeApplicableYoe({
      totalYoe: 6,
      primaryDomain: "Marketing Manager",
      targetRole: "Social Media Manager",
    });
    expect(r.relation).toBe("adjacent");
  });

  it("Social Media Manager (3y) → Social Media Manager → match", () => {
    const r = computeApplicableYoe({
      totalYoe: 3,
      primaryDomain: "Social Media Manager",
      targetRole: "Social Media Manager",
    });
    expect(r.relation).toBe("match");
    expect(r.applicableYoe).toBe(3);
  });

  it("Senior Product Designer → 'Senior Social Media Manager' label still pivots", () => {
    /* Belt-and-suspenders: even if the target text leaks a seniority
     * adjective (as it did in the bug session), classification still
     * lands on social-media and the cross-craft pivot still holds. */
    const r = computeApplicableYoe({
      totalYoe: 5,
      primaryDomain: "Senior Product Designer",
      targetRole: "Senior Social Media Manager",
    });
    expect(r.applicableYoe).toBe(0);
    expect(r.relation).toBe("pivot");
  });
});
