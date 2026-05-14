/* Fresher-flow features (2026-05-14) — pins four converging behaviors
 * surfaced in the "fresher applying for UI/UX at IT-services" scenario:
 *
 *   1. PPO / intern-to-fulltime detection in candidate-profile. Phrases
 *      like "I was your intern" / "PPO" / "convert my internship" set
 *      cp.internshipConversion = true.
 *   2. IT-services entry → band.probationOffer set (~90% of confirmed
 *      CTC for 6 months). Probation gate is tier+level scoped so a
 *      product-tech entry or an IT-services senior doesn't get it.
 *   3. Internship role detection. The band-resolver scales the band to
 *      ~40% of entry CTC and flags isInternshipStipend so downstream
 *      framing reframes as monthly stipend, not LPA.
 *   4. deterministicFallbackText for open-with-offer and close-acceptance
 *      surfaces the new context — probation split on offer, bond clause
 *      on acceptance, PPO voice on conversion. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";
import { resolveServerBand } from "../../server-handlers/_band-resolver";
import { deterministicFallbackText, hrRegisterForCompany } from "../../server-handlers/_negotiate-turn-helpers";
import { initState } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationState, AiMove } from "../../server-handlers/_negotiation-kernel";

/* ─── 1. PPO detection ─────────────────────────────────────────────── */

describe("fresher-flow — candidate-profile PPO detection", () => {
  it("detects 'PPO' as internshipConversion", () => {
    const r = extractCandidateProfile("I got a PPO from your campus team last month.");
    expect(r.internshipConversion).toBe(true);
    expect(r.hasAny).toBe(true);
  });

  it("detects 'pre-placement offer'", () => {
    const r = extractCandidateProfile("This is for my pre-placement offer conversion.");
    expect(r.internshipConversion).toBe(true);
  });

  it("detects 'I interned with you' phrasing", () => {
    const r = extractCandidateProfile("I interned with you last summer in the design team.");
    expect(r.internshipConversion).toBe(true);
  });

  it("does NOT false-positive on plain 'internship' mention without conversion intent", () => {
    const r = extractCandidateProfile("I did an internship somewhere else two years ago.");
    expect(r.internshipConversion).toBe(false);
  });

  it("mergeCandidateProfile keeps internshipConversion monotone-up", () => {
    const prior = extractCandidateProfile("I interned with you.");
    expect(prior.internshipConversion).toBe(true);
    const next = extractCandidateProfile("Anyway, about the offer numbers.");
    expect(next.internshipConversion).toBe(false);
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.internshipConversion).toBe(true);
    expect(merged.hasAny).toBe(true);
  });
});

/* ─── 2. IT-services probation gate ────────────────────────────────── */

describe("fresher-flow — IT-services entry probation gate", () => {
  it("TCS software-engineer entry → probationOffer ≈ 90% of initial, probationMonths = 6", () => {
    const band = resolveServerBand("software-engineer", "TCS", "entry", 0);
    expect(band.probationOffer).toBeDefined();
    expect(band.probationMonths).toBe(6);
    expect(band.probationOffer!).toBeGreaterThan(0);
    expect(band.probationOffer!).toBeLessThan(band.initialOffer);
    /* ~90% give-or-take rounding */
    const ratio = band.probationOffer! / band.initialOffer;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(0.95);
  });

  it("Infosys entry triggers probation; senior does NOT", () => {
    const entry = resolveServerBand("software-engineer", "Infosys", "entry", 0);
    const senior = resolveServerBand("software-engineer", "Infosys", "senior", 6);
    expect(entry.probationOffer).toBeDefined();
    expect(senior.probationOffer).toBeUndefined();
  });

  it("Product-tech entry (Flipkart) does NOT trigger probation gate", () => {
    const band = resolveServerBand("software-engineer", "Flipkart", "entry", 0);
    expect(band.probationOffer).toBeUndefined();
    expect(band.probationMonths).toBeUndefined();
  });
});

/* ─── 3. Internship role detection + stipend band scaling ──────────── */

describe("fresher-flow — internship role → stipend band", () => {
  it("'UI/UX Designer Intern' at Flipkart flags isInternshipStipend and produces a stipend-sized band", () => {
    /* Compare against the SAME aliased base (salaries.ts collapses intern
     * → software-engineer, so the pre-scale band lookup matches SWE entry,
     * not UX-designer entry). The scaling ratio against SWE entry should
     * land near 0.4, confirming the intern multiplier fired. */
    const seBand = resolveServerBand("Software Engineer", "Flipkart", "entry", 0);
    const internBand = resolveServerBand("UI/UX Designer Intern", "Flipkart", "entry", 0);
    expect(internBand.isInternshipStipend).toBe(true);
    expect(internBand.internshipMonths).toBe(6);
    const ratio = internBand.initialOffer / seBand.initialOffer;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.5);
  });

  it("does NOT false-positive on 'internal-tools-engineer'", () => {
    const band = resolveServerBand("internal-tools-engineer", "Flipkart", "entry", 0);
    expect(band.isInternshipStipend).toBeFalsy();
  });

  it("internship at IT-services tier → stipend flag wins, probationOffer is cleared", () => {
    const band = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0);
    expect(band.isInternshipStipend).toBe(true);
    expect(band.probationOffer).toBeUndefined();
  });
});

/* ─── 4. Fallback text surfaces new context ────────────────────────── */

/* Minimal-state helper using initState. */
function makeState(over: Partial<NegotiationState>): NegotiationState {
  const base = initState({
    sessionId: "test",
    role: "Software Engineer",
    company: "TCS",
    band: { initialOffer: 7, maxStretch: 9, walkAway: 6, hasEquity: false },
  });
  return { ...base, ...over } as NegotiationState;
}

describe("fresher-flow — deterministicFallbackText surfaces new context", () => {
  it("open-with-offer with probationOffer emits both numbers and 'probation'", () => {
    const state = makeState({
      band: { initialOffer: 7, maxStretch: 9, walkAway: 6, hasEquity: false, probationOffer: 6.3, probationMonths: 6 },
    });
    const move: AiMove = { lever: "open-with-offer", newTotalLpa: 7, rationale: "init" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/7 LPA/);
    expect(text).toMatch(/6\.3 LPA/);
    expect(text.toLowerCase()).toMatch(/probation/);
  });

  it("open-with-offer with isInternshipStipend reframes as monthly stipend (₹k/mo, mentions PPO)", () => {
    const state = makeState({
      role: "UI/UX Designer Intern",
      company: "Flipkart",
      band: { initialOffer: 4.8, maxStretch: 6, walkAway: 4, hasEquity: false, isInternshipStipend: true, internshipMonths: 6 },
    });
    const move: AiMove = { lever: "open-with-offer", newTotalLpa: 4.8, rationale: "init" };
    const text = deterministicFallbackText(state, move);
    expect(text.toLowerCase()).toMatch(/stipend/);
    expect(text.toLowerCase()).toMatch(/per month|\/mo/);
    expect(text.toLowerCase()).toMatch(/ppo|pre-placement/);
    /* Should NOT quote LPA directly when it's a stipend. */
    expect(text).not.toMatch(/LPA/);
  });

  it("close-acceptance with serviceBondAccepted echoes the bond clause", () => {
    const state = makeState({
      highestOfferMade: 7,
      candidateProfile: {
        careerGapMonths: null,
        careerGapActivity: null,
        tenureSignal: null,
        levelMismatch: null,
        domainPivot: false,
        transferableSkillsClaimed: false,
        compensationHistoryIssue: null,
        serviceBondAccepted: true,
        probationCompMentioned: false,
        internshipConversion: false,
        hasAny: true,
      },
    });
    const move: AiMove = { lever: "close-acceptance", newTotalLpa: 7, rationale: "accept" };
    const text = deterministicFallbackText(state, move);
    expect(text.toLowerCase()).toMatch(/bond/);
    /* Doc-collection ask must still survive. */
    expect(text.toLowerCase()).toMatch(/aadhaar/);
  });

  it("close-acceptance with internshipConversion frames as PPO conversion", () => {
    const state = makeState({
      highestOfferMade: 7,
      candidateProfile: {
        careerGapMonths: null,
        careerGapActivity: null,
        tenureSignal: null,
        levelMismatch: null,
        domainPivot: false,
        transferableSkillsClaimed: false,
        compensationHistoryIssue: null,
        serviceBondAccepted: false,
        probationCompMentioned: false,
        internshipConversion: true,
        hasAny: true,
      },
    });
    const move: AiMove = { lever: "close-acceptance", newTotalLpa: 7, rationale: "accept" };
    const text = deterministicFallbackText(state, move);
    expect(text.toLowerCase()).toMatch(/ppo|back full-time|full-time/);
  });
});

/* Smoke: HR register for an IT-services company is formal-traditional —
 * fresher-flow framing rides on that voice. */
describe("fresher-flow — HR register sanity", () => {
  it("TCS resolves to formal-traditional register", () => {
    expect(hrRegisterForCompany("TCS")).toBe("formal-traditional");
  });
});
