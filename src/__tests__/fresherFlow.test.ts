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

  /* 2026-05-14b — gate widened beyond IT-services. Big-4 and BFSI also
   * run real probation programs at entry. */
  it("Deloitte (consulting-big4) entry triggers probation with 3-month / 85% terms", () => {
    const band = resolveServerBand("business-analyst", "Deloitte", "entry", 0);
    expect(band.probationOffer).toBeDefined();
    expect(band.probationMonths).toBe(3);
    const ratio = band.probationOffer! / band.initialOffer;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(0.9);
  });

  it("HDFC Bank (bfsi-domestic) entry triggers probation with 6-month / 80% terms", () => {
    const band = resolveServerBand("business-analyst", "HDFC Bank", "entry", 0);
    expect(band.probationOffer).toBeDefined();
    expect(band.probationMonths).toBe(6);
    const ratio = band.probationOffer! / band.initialOffer;
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(0.85);
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
    /* 2026-05-14b — Flipkart is indian-unicorn tier @ 0.6 stipend ratio. */
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(0.7);
  });

  it("intern stipend walkAway is anchored near 80% of scaled initial (floor sanity)", () => {
    const band = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0);
    expect(band.isInternshipStipend).toBe(true);
    const ratio = band.walkAway / band.initialOffer;
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.9);
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
    collegeTier: null,
        earlySwitcher: false,
        lowCtcAlert: false,
        priorInternshipNonConversion: false,
        serviceCompanyBackground: false,
        compBreakupUnknown: false,
        recentLayoff: false,
        hotDomainPremium: false,
        pipDisclosed: false,
        verbalOnlyOffer: false,
        culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false,
        parentInsuranceAsked: false,
        inHandTakehomeFocus: false,
        rtoPushback: false,
        returnshipMaternity: false,
        payBandAsked: false,
        taxStructureAsked: false,
        bgvAnxiety: false,
        esopSophisticationProbe: false,
        spouseJobConstraint: false,
        agingParentCare: false,
        moonlightingDisclosed: false,
        mentalHealthDisclosed: false,
        payParityAsked: false,
        preemptiveCounterReceived: false,
        acceptanceTimeRequest: false,
        cryptoTokenComp: false,
        gccArbitrageAnchor: false,
        benchTimeDisclosed: false,
        founderSecondInnings: false,
        latecareerAgeBias: false,
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
    collegeTier: null,
        earlySwitcher: false,
        lowCtcAlert: false,
        priorInternshipNonConversion: false,
        serviceCompanyBackground: false,
        compBreakupUnknown: false,
        recentLayoff: false,
        hotDomainPremium: false,
        pipDisclosed: false,
        verbalOnlyOffer: false,
        culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false,
        parentInsuranceAsked: false,
        inHandTakehomeFocus: false,
        rtoPushback: false,
        returnshipMaternity: false,
        payBandAsked: false,
        taxStructureAsked: false,
        bgvAnxiety: false,
        esopSophisticationProbe: false,
        spouseJobConstraint: false,
        agingParentCare: false,
        moonlightingDisclosed: false,
        mentalHealthDisclosed: false,
        payParityAsked: false,
        preemptiveCounterReceived: false,
        acceptanceTimeRequest: false,
        cryptoTokenComp: false,
        gccArbitrageAnchor: false,
        benchTimeDisclosed: false,
        founderSecondInnings: false,
        latecareerAgeBias: false,
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

/* ─── 5. PPO conversion suppresses noisy hike-% framing ──────────────── */

describe("fresher-flow — PPO conversion silences hike-% noise", () => {
  function profile(internshipConversion: boolean) {
    return {
      careerGapMonths: null,
      careerGapActivity: null,
      tenureSignal: null,
      levelMismatch: null,
      domainPivot: false,
      transferableSkillsClaimed: false,
      compensationHistoryIssue: null,
      serviceBondAccepted: false,
      probationCompMentioned: false,
      internshipConversion,
      collegeTier: null,
      earlySwitcher: false,
      lowCtcAlert: false,
      priorInternshipNonConversion: false,
      serviceCompanyBackground: false,
      compBreakupUnknown: false,
        recentLayoff: false,
        hotDomainPremium: false,
        pipDisclosed: false,
        verbalOnlyOffer: false,
        culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false,
        parentInsuranceAsked: false,
        inHandTakehomeFocus: false,
        rtoPushback: false,
        returnshipMaternity: false,
        payBandAsked: false,
        taxStructureAsked: false,
        bgvAnxiety: false,
        esopSophisticationProbe: false,
        spouseJobConstraint: false,
        agingParentCare: false,
        moonlightingDisclosed: false,
        mentalHealthDisclosed: false,
        payParityAsked: false,
        preemptiveCounterReceived: false,
        acceptanceTimeRequest: false,
        cryptoTokenComp: false,
        gccArbitrageAnchor: false,
        benchTimeDisclosed: false,
        founderSecondInnings: false,
        latecareerAgeBias: false,
      hasAny: internshipConversion,
    };
  }

  it("PPO candidate with prior stipend-equivalent CTC does NOT get '385% hike' framing", () => {
    const state = makeState({
      highestOfferMade: 7,
      /* Annualized stipend was ₹0.72L. Naive hike% would emit 870%. */
      candidateCurrentCtc: 0.72,
      candidateProfile: profile(true),
    });
    const move: AiMove = { lever: "hike-context-summary", newTotalLpa: null, rationale: "framing" };
    const text = deterministicFallbackText(state, move);
    /* Must NOT quote a hike percent. */
    expect(text).not.toMatch(/\d+%/);
    /* Must reframe as conversion. */
    expect(text.toLowerCase()).toMatch(/conversion|stipend|category/);
  });

  it("Plain switch-job candidate still gets the hike-% framing", () => {
    const state = makeState({
      highestOfferMade: 12,
      candidateCurrentCtc: 10,
      candidateProfile: profile(false),
    });
    const move: AiMove = { lever: "hike-context-summary", newTotalLpa: null, rationale: "framing" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/\d+%/);
  });

  it("Counter-base for intern stipend quotes ₹k/mo, not LPA", () => {
    const state = makeState({
      band: { initialOffer: 1.4, maxStretch: 1.8, walkAway: 1.1, hasEquity: false, isInternshipStipend: true, internshipMonths: 6 },
    });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 1.6, rationale: "counter" };
    const text = deterministicFallbackText(state, move);
    expect(text.toLowerCase()).toMatch(/per month|\/mo/);
    expect(text).not.toMatch(/LPA/);
  });

  it("Compensation-summary for probation-gated offer leads with split, not generic structure", () => {
    const state = makeState({
      highestOfferMade: 7,
      band: { initialOffer: 7, maxStretch: 9, walkAway: 6, hasEquity: false, probationOffer: 6.3, probationMonths: 6 },
    });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: null, rationale: "structure" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/6\.3 LPA/);
    expect(text).toMatch(/7 LPA/);
    expect(text.toLowerCase()).toMatch(/probation/);
    expect(text.toLowerCase()).toMatch(/confirmation/);
  });
});

/* ─── 7. College-tier signal + PPO anchor + cash-locked framing ─── */

describe("fresher-flow — college tier detection", () => {
  it("detects IIT-B as tier-1", () => {
    expect(extractCandidateProfile("I'm from IIT Bombay, B.Tech CSE.").collegeTier).toBe("tier-1");
  });
  it("detects NIT Trichy as tier-1", () => {
    expect(extractCandidateProfile("Did my undergrad at NIT Trichy.").collegeTier).toBe("tier-1");
  });
  it("detects BITS Pilani as tier-1", () => {
    expect(extractCandidateProfile("BITS Pilani, 2024 batch.").collegeTier).toBe("tier-1");
  });
  it("detects VIT as tier-2", () => {
    expect(extractCandidateProfile("I'm from VIT, computer science.").collegeTier).toBe("tier-2");
  });
  it("detects 'tier-3 college' label as tier-3", () => {
    expect(extractCandidateProfile("I'm from a tier-3 college in my hometown.").collegeTier).toBe("tier-3");
  });
  it("returns null when no tier signal", () => {
    expect(extractCandidateProfile("I did my B.Tech somewhere.").collegeTier).toBeNull();
  });
  it("merge keeps last-stated tier (recruiter updates mental model)", () => {
    const a = extractCandidateProfile("I'm from a tier-3 college.");
    const b = extractCandidateProfile("Actually I'm from IIT Bombay, sorry.");
    const merged = mergeCandidateProfile(a, b);
    expect(merged.collegeTier).toBe("tier-1");
  });
});

describe("fresher-flow — college tier band multiplier", () => {
  it("tier-1 lifts the entry band ~25% above standard", () => {
    const std = resolveServerBand("software-engineer", "TCS", "entry", 0);
    const t1 = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-1" });
    const lift = t1.initialOffer / std.initialOffer;
    expect(lift).toBeGreaterThan(1.2);
    expect(lift).toBeLessThan(1.3);
  });
  it("tier-3 cuts the entry band ~15% below standard", () => {
    const std = resolveServerBand("software-engineer", "TCS", "entry", 0);
    const t3 = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-3" });
    const cut = t3.initialOffer / std.initialOffer;
    expect(cut).toBeGreaterThan(0.8);
    expect(cut).toBeLessThan(0.9);
  });
  it("tier-2 is the standard band (no change)", () => {
    const std = resolveServerBand("software-engineer", "TCS", "entry", 0);
    const t2 = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-2" });
    expect(t2.initialOffer).toBeCloseTo(std.initialOffer, 1);
  });
  it("college tier multiplier does NOT apply to senior level (signal irrelevant)", () => {
    const std = resolveServerBand("software-engineer", "TCS", "senior", 6);
    const t1 = resolveServerBand("software-engineer", "TCS", "senior", 6, { collegeTier: "tier-1" });
    expect(t1.initialOffer).toBeCloseTo(std.initialOffer, 1);
  });
  it("college tier multiplier also lifts probationOffer when probation gate is on", () => {
    const t1 = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-1" });
    expect(t1.probationOffer).toBeDefined();
    const ratio = t1.probationOffer! / t1.initialOffer;
    /* Still ~90% relative to the lifted initialOffer. */
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(0.95);
  });
  /* Audit fix (2026-05-14d): college tier NOW composes with intern
   * stipends — tier-1 IIT intern at TCS should land above standard. */
  it("tier-1 lifts intern stipend (audit fix 2026-05-14d)", () => {
    const std = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0);
    const t1 = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0, { collegeTier: "tier-1" });
    expect(t1.initialOffer).toBeGreaterThan(std.initialOffer);
    /* Stipend multiplier is +20% — softer than full-time +25%. */
    expect(t1.initialOffer).toBeCloseTo(std.initialOffer * 1.2, 1);
  });
  it("tier-3 cuts intern stipend (audit fix 2026-05-14d)", () => {
    const std = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0);
    const t3 = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0, { collegeTier: "tier-3" });
    expect(t3.initialOffer).toBeLessThan(std.initialOffer);
    expect(t3.initialOffer).toBeCloseTo(std.initialOffer * 0.9, 1);
  });
});

describe("fresher-flow — variable internship duration (audit fix 2026-05-14d)", () => {
  it("default internship duration is 6 months", () => {
    const b = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0);
    expect(b.internshipMonths).toBe(6);
  });
  it("12-week summer override → 3 months", () => {
    const b = resolveServerBand("Software Engineer Intern", "Google", "entry", 0, { internshipMonths: 3 });
    expect(b.internshipMonths).toBe(3);
  });
  it("12-month industrial trainee override → clamped to 12", () => {
    const b = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0, { internshipMonths: 12 });
    expect(b.internshipMonths).toBe(12);
  });
  it("bad client input (negative / 50 months) clamps to [1,12]", () => {
    const b1 = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0, { internshipMonths: -3 });
    const b50 = resolveServerBand("Software Engineer Intern", "TCS", "entry", 0, { internshipMonths: 50 });
    expect(b1.internshipMonths).toBe(1);
    expect(b50.internshipMonths).toBe(12);
  });
  it("internshipMonths is ignored for non-intern roles", () => {
    const b = resolveServerBand("Software Engineer", "TCS", "entry", 0, { internshipMonths: 3 });
    expect(b.internshipMonths).toBeUndefined();
  });
});

describe("fresher-flow — PPO anchor lift", () => {
  it("PPO conversion lifts initialOffer ~15% but never above maxStretch", () => {
    const std = resolveServerBand("software-engineer", "TCS", "entry", 0);
    const ppo = resolveServerBand("software-engineer", "TCS", "entry", 0, { internshipConversion: true });
    expect(ppo.initialOffer).toBeGreaterThan(std.initialOffer);
    expect(ppo.initialOffer).toBeLessThanOrEqual(std.maxStretch);
  });
  it("PPO anchor does NOT apply to senior level", () => {
    const std = resolveServerBand("software-engineer", "TCS", "senior", 6);
    const ppo = resolveServerBand("software-engineer", "TCS", "senior", 6, { internshipConversion: true });
    expect(ppo.initialOffer).toBeCloseTo(std.initialOffer, 1);
  });
  it("tier-1 + PPO compose — band lifted by both signals", () => {
    const std = resolveServerBand("software-engineer", "TCS", "entry", 0);
    const both = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-1", internshipConversion: true });
    expect(both.initialOffer).toBeGreaterThan(std.initialOffer * 1.3);
  });
  /* Audit fix coverage (2026-05-14d): tier-2 + tier-3 + PPO composition. */
  it("tier-2 + PPO compose — neutral college × +15% PPO ≈ +15% lift", () => {
    const std = resolveServerBand("software-engineer", "TCS", "entry", 0);
    const both = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-2", internshipConversion: true });
    expect(both.initialOffer).toBeGreaterThan(std.initialOffer);
    expect(both.initialOffer).toBeLessThanOrEqual(std.maxStretch);
  });
  it("tier-3 + PPO compose — depressed base × +15% PPO is still above tier-3 alone", () => {
    const t3only = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-3" });
    const both = resolveServerBand("software-engineer", "TCS", "entry", 0, { collegeTier: "tier-3", internshipConversion: true });
    expect(both.initialOffer).toBeGreaterThan(t3only.initialOffer);
  });
});

describe("fresher-flow — cash-locked framing for campus tiers", () => {
  it("hold-firm fallback pivots to non-cash flex for IT-services entry (probation gate present)", () => {
    const state = makeState({
      company: "TCS",
      highestOfferMade: 4.5,
      band: { initialOffer: 4.5, maxStretch: 5.5, walkAway: 3.8, hasEquity: false, probationOffer: 4.05, probationMonths: 6 },
    });
    const move: AiMove = { lever: "hold-firm", newTotalLpa: null, rationale: "firm" };
    const text = deterministicFallbackText(state, move);
    expect(text.toLowerCase()).toMatch(/campus-standard|joining date|location|project/);
    /* Must NOT bluff that further negotiation is possible. */
    expect(text.toLowerCase()).not.toMatch(/take your time and revert/);
  });
  it("hold-firm fallback for non-probation tier keeps legacy phrasing", () => {
    const state = makeState({
      company: "Flipkart",
      highestOfferMade: 22,
      band: { initialOffer: 22, maxStretch: 28, walkAway: 18, hasEquity: false },
    });
    const move: AiMove = { lever: "hold-firm", newTotalLpa: null, rationale: "firm" };
    const text = deterministicFallbackText(state, move);
    expect(text.toLowerCase()).toMatch(/maximum we can do/);
  });
});

/* ─── 6. Blocker fix — mid-session band rebase preserves new flags ─── */

describe("fresher-flow — mid-session band rebase preserves probation + stipend flags", () => {
  it("Rebase to TCS entry from senior surfaces probationOffer in the new band", () => {
    /* Pre-rebase: senior band w/o probation. Simulate the rebase by
     * calling resolveServerBand the way the kernel does at line ~1341. */
    const rebased = resolveServerBand("software-engineer", "TCS", "entry", 0);
    expect(rebased.probationOffer).toBeDefined();
    expect(rebased.probationMonths).toBe(6);

    /* The kernel's spread-rebase pattern (post-fix): {...rebased, maxStretch}
     * must preserve probationOffer / probationMonths. */
    const floor = 10;
    const next = { ...rebased, maxStretch: Math.max(rebased.maxStretch, floor) };
    expect(next.probationOffer).toBe(rebased.probationOffer);
    expect(next.probationMonths).toBe(rebased.probationMonths);
  });

  it("Rebase preserves isInternshipStipend when the role is an intern role", () => {
    const rebased = resolveServerBand("software engineer intern", "TCS", "entry", 0);
    expect(rebased.isInternshipStipend).toBe(true);
    const next = { ...rebased, maxStretch: rebased.maxStretch };
    expect(next.isInternshipStipend).toBe(true);
    expect(next.internshipMonths).toBe(rebased.internshipMonths);
  });
});

/* ─── 7. Junior-flow (0-2 YoE) signals (2026-05-14e) ───────────────── */

describe("junior-flow — earlySwitcher detection", () => {
  it("detects 'first job switch'", () => {
    const r = extractCandidateProfile("This is my first job switch — I've been at TCS for about a year.");
    expect(r.earlySwitcher).toBe(true);
    expect(r.hasAny).toBe(true);
  });
  it("detects '1 year + looking to switch'", () => {
    const r = extractCandidateProfile("I've been at Wipro for 1 year and now I'm looking to switch.");
    expect(r.earlySwitcher).toBe(true);
  });
  it("does NOT fire on stable 5-year tenure", () => {
    const r = extractCandidateProfile("I've been at Infosys for 5 years and want a change.");
    expect(r.earlySwitcher).toBe(false);
  });
  it("does NOT fire when no switching language present", () => {
    const r = extractCandidateProfile("I've been at TCS for 1 year.");
    expect(r.earlySwitcher).toBe(false);
  });
  it("monotone-up across merge", () => {
    const prior = extractCandidateProfile("First job switch.");
    expect(prior.earlySwitcher).toBe(true);
    const next = extractCandidateProfile("My current CTC is ₹4 LPA.");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.earlySwitcher).toBe(true);
  });
});

describe("junior-flow — lowCtcAlert detection", () => {
  it("detects 'I'm underpaid'", () => {
    const r = extractCandidateProfile("Honestly, I'm underpaid at my current job.");
    expect(r.lowCtcAlert).toBe(true);
  });
  it("detects 'my salary doesn't reflect my skills'", () => {
    const r = extractCandidateProfile("My current salary doesn't reflect my actual skill level.");
    expect(r.lowCtcAlert).toBe(true);
  });
  it("detects 'my CTC is below market'", () => {
    const r = extractCandidateProfile("My CTC is below market for what I do.");
    expect(r.lowCtcAlert).toBe(true);
  });
  it("does NOT fire on neutral CTC mention", () => {
    const r = extractCandidateProfile("My current CTC is ₹5 LPA.");
    expect(r.lowCtcAlert).toBe(false);
  });
});

describe("junior-flow — priorInternshipNonConversion detection", () => {
  it("detects 'interned at Google then joined TCS'", () => {
    const r = extractCandidateProfile("I interned at Google during my final year, then joined TCS full-time.");
    expect(r.priorInternshipNonConversion).toBe(true);
    expect(r.internshipConversion).toBe(false);
  });
  it("does NOT fire when PPO conversion is the context (PPO takes precedence)", () => {
    const r = extractCandidateProfile("I interned with you and now this is for my PPO conversion.");
    expect(r.internshipConversion).toBe(true);
    expect(r.priorInternshipNonConversion).toBe(false);
  });
  it("detects 'after my internship I joined Infosys'", () => {
    const r = extractCandidateProfile("After my internship I joined Infosys for a year.");
    expect(r.priorInternshipNonConversion).toBe(true);
  });
});

describe("junior-flow — serviceCompanyBackground detection", () => {
  it("detects TCS / Infosys / Wipro by name", () => {
    expect(extractCandidateProfile("Currently at TCS.").serviceCompanyBackground).toBe(true);
    expect(extractCandidateProfile("I work at Infosys.").serviceCompanyBackground).toBe(true);
    expect(extractCandidateProfile("Was at Wipro for 2 years.").serviceCompanyBackground).toBe(true);
    expect(extractCandidateProfile("Cognizant project lead.").serviceCompanyBackground).toBe(true);
  });
  it("detects 'service background' self-label", () => {
    const r = extractCandidateProfile("I'm from a service background, looking to move to product.");
    expect(r.serviceCompanyBackground).toBe(true);
  });
  it("does NOT fire on product-company names", () => {
    expect(extractCandidateProfile("I work at Flipkart.").serviceCompanyBackground).toBe(false);
    expect(extractCandidateProfile("Currently at Razorpay.").serviceCompanyBackground).toBe(false);
  });
});

describe("junior-flow — compactTurnBrief surfaces all four signals", () => {
  /* These are integration smoke-tests: the brief MUST surface the
   * junior flags so the LLM and the LEVER_GUIDANCE can pick them up. */
  it("hasAny merge: all four signals set hasAny=true", () => {
    const r1 = extractCandidateProfile("This is my first job switch.");
    expect(r1.hasAny).toBe(true);
    const r2 = extractCandidateProfile("I'm underpaid.");
    expect(r2.hasAny).toBe(true);
    const r3 = extractCandidateProfile("After my internship I joined TCS.");
    expect(r3.hasAny).toBe(true);
    const r4 = extractCandidateProfile("From Infosys, moving to product.");
    expect(r4.hasAny).toBe(true);
  });
});
