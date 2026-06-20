/* #116 (2026-06-20, live staging) — people-manager band floor on the
 * generate-questions SEED path.
 *
 * The #115 fix applied the people-manager band floor only inside
 * `resolveServerBand` (the negotiate-turn kernel path). But
 * generate-questions.ts seeds the negotiation by calling
 * `generateNegotiationBand` DIRECTLY (data/salary-lookup), bypassing
 * resolveServerBand — so the candidate's OPENING offer and the LLM-facing
 * `bandContext` prose were built from an unlifted band. Live staging
 * (Flipkart "Engineering Manager", aggressive style) returned
 * init 19.4 / maxStretch 25.6 / walkAway 14.3 via a company-override row —
 * a junior-IC lowball for a first-line EM, with a ₹14-base component
 * breakdown in the prose.
 *
 * The fix moves the floor into a single shared helper
 * (liftPeopleManagerBand in _company-band-tiers) called by BOTH
 * resolveServerBand AND generateNegotiationBand, so the seed band and the
 * kernel band agree and the prose can never contradict the numbers. These
 * pin the generate-questions path specifically:
 *   (1) the EM seed band clears the tier manager ceil (no ₹25.6 lowball);
 *   (2) the band invariant holds (walkAway < initialOffer < maxStretch);
 *   (3) the bandContext prose quotes the LIFTED opener, never the ₹19.4
 *       junior number (numbers ↔ prose consistency);
 *   (4) IC "…Manager" titles (Product / Program / Project) are NOT lifted;
 *   (5) the seed band matches resolveServerBand at the representative
 *       managerial YoE (one source of truth — no jarring jump at init).
 */
import { describe, it, expect } from "vitest";
import { generateNegotiationBand } from "../../data/salary-lookup";
import { resolveServerBand } from "../../server-handlers/_band-resolver";
import {
  classifyCompanyTier,
  getBandForRole,
  liftPeopleManagerBand,
  MANAGER_DEFAULT_YOE,
} from "../../server-handlers/_company-band-tiers";

describe("#116 — people-manager band floor on the generate-questions seed path", () => {
  it("Flipkart Engineering Manager seed band clears the tier manager ceil (not the ₹25.6 lowball)", () => {
    const band = generateNegotiationBand({ role: "Engineering Manager", company: "Flipkart" });
    const tierMgr = getBandForRole(classifyCompanyTier("Flipkart"), "Engineering Manager", MANAGER_DEFAULT_YOE);
    expect(band.maxStretch).toBeGreaterThanOrEqual(tierMgr.ceil);
    /* The live defect: maxStretch capped at 25.6. Must now reach the
     * manager ceil — a real EM stretch, not a junior-IC cap. */
    expect(band.maxStretch).toBeGreaterThan(25.6);
    expect(band.initialOffer).toBeGreaterThan(19.4);
  });

  it("preserves the band invariant after the lift (walkAway < initialOffer < maxStretch)", () => {
    const band = generateNegotiationBand({ role: "Engineering Manager", company: "Flipkart" });
    expect(band.walkAway).toBeLessThan(band.initialOffer);
    expect(band.initialOffer).toBeLessThan(band.maxStretch);
    /* The opener stays anchor-low — never above the manager floor. */
    const tierMgr = getBandForRole(classifyCompanyTier("Flipkart"), "Engineering Manager", MANAGER_DEFAULT_YOE);
    expect(band.initialOffer).toBeLessThanOrEqual(tierMgr.ceil);
  });

  it("the bandContext prose quotes the LIFTED opener, never the ₹19.4 junior number", () => {
    const band = generateNegotiationBand({ role: "Engineering Manager", company: "Flipkart" });
    /* Numbers ↔ prose consistency: the LLM-facing guidance is built from
     * the same lifted band, so it must mention the lifted opener and must
     * not anchor the unlifted junior opener. */
    expect(band.bandContext).toContain(`₹${band.initialOffer}`);
    expect(band.bandContext).not.toContain("₹19.4 LPA CTC");
  });

  it("does NOT lift IC '…Manager' titles (Product / Program / Project Manager)", () => {
    /* These carry no people-management responsibility in the Indian market;
     * their salary-lookup band is correct and must be untouched. Assert the
     * shared helper is a strict no-op against a deliberately-low band that
     * WOULD be lifted for a genuine people-manager. */
    const low = { initialOffer: 19.4, maxStretch: 25.6, walkAway: 14.3 };
    expect(liftPeopleManagerBand(low, "Product Manager", "Flipkart")).toEqual(low);
    expect(liftPeopleManagerBand(low, "Program Manager", "Flipkart")).toEqual(low);
    expect(liftPeopleManagerBand(low, "Project Manager", "Flipkart")).toEqual(low);
    /* …while the SAME low band IS lifted for a genuine people-manager. */
    expect(liftPeopleManagerBand(low, "Engineering Manager", "Flipkart").maxStretch).toBeGreaterThan(25.6);
  });

  it("the seed band agrees with the negotiate-turn kernel band (single source of truth)", () => {
    /* generate-questions has no applicableYoe, so its seed uses the
     * representative managerial YoE; resolveServerBand with no YoE does the
     * same. Both must land on the same manager ceil — eliminating the
     * jarring jump when the kernel adopts its band at init. */
    const seed = generateNegotiationBand({ role: "Engineering Manager", company: "Flipkart" });
    const kernel = resolveServerBand("Engineering Manager", "Flipkart", undefined, null);
    expect(seed.maxStretch).toBe(kernel.maxStretch);
  });
});
