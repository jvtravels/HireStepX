import { describe, it, expect } from "vitest";
import { salaryNegotiationAnalyzer } from "../../../server-handlers/analyzers/salary-negotiation";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../../server-handlers/analyzers/_types";

function session(transcript: TranscriptTurn[]): SessionRowForAnalysis {
  return {
    id: "sess_test",
    user_id: "user_test",
    type: "salary-negotiation",
    focus: "Salary Negotiation",
    difficulty: "mid",
    score: 70,
    questions: 5,
    duration: 1800,
    transcript,
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: new Date().toISOString(),
  };
}
const ai = (text: string): TranscriptTurn => ({ speaker: "ai", text, time: "" });
const user = (text: string): TranscriptTurn => ({ speaker: "user", text, time: "" });

describe("salaryNegotiationAnalyzer", () => {
  it("flags implausible_salary_claim when AI quotes 1000 LPA", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("For your role we can offer 1000 LPA total compensation."),
        user("That seems high. My target is 35 LPA."),
      ]),
    });
    expect(out.flags).toContain("implausible_salary_claim");
    expect(out.hallucinations[0]?.type).toBe("implausible_salary_claim");
  });

  it("does not flag plausible AI numbers (e.g. 28-35 LPA)", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("For a senior SDE we typically offer 28 to 35 LPA total compensation."),
        user("Based on my research my target is 38 LPA. I have another offer at 36 LPA elsewhere. Equity vesting matters too."),
        ai("Can you stretch on the joining bonus? What's your notice period?"),
      ]),
    });
    expect(out.flags).not.toContain("implausible_salary_claim");
  });

  it("flags user_never_anchored and no_batna_articulated when user only reacts", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("What are your salary expectations?"),
        user("I'm flexible, what does the role pay typically these days?"),
        ai("We can offer 24 LPA base."),
        user("Hmm okay, can you do better than that please?"),
        ai("We could go to 26 LPA."),
        user("Alright that sounds workable I guess."),
      ]),
    });
    expect(out.flags).toContain("user_never_anchored");
    expect(out.flags).toContain("no_batna_articulated");
  });

  it("flags ai_accepted_without_pushback when AI accepts first user ask", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("What are you targeting?"),
        user("My expectation is 40 LPA based on my research."),
        ai("Sounds good, that works for us. Deal."),
        user("Great."),
      ]),
    });
    expect(out.flags).toContain("ai_accepted_without_pushback");
  });

  it("flags missing equity / joining-bonus / notice-period topics in a substantive session", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("Tell me about your expectations."),
        user("I'm targeting around 30 LPA based on my research and have an alternative offer at 28 LPA elsewhere."),
        ai("That's reasonable. Can you stretch your timeline?"),
        user("Yes, I can be flexible on start date if the base meets my target."),
        ai("Got it, let me come back with numbers."),
      ]),
    });
    expect(out.flags).toContain("equity_never_discussed");
    expect(out.flags).toContain("joining_bonus_never_discussed");
    expect(out.flags).toContain("notice_period_never_discussed");
  });

  it("returns empty_transcript flag for empty session", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([]),
    });
    expect(out.flags).toEqual(["empty_transcript"]);
  });

  it("parses crore correctly: 1.5 crore = 150 LPA, plausible", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("For executive roles we can go up to 1.5 crore total compensation including equity."),
        user("My target is 1.2 crore based on my research and I have a competing offer at 1 crore."),
        ai("Equity vesting is 4 years quarterly. Joining bonus and notice period are negotiable."),
      ]),
    });
    expect(out.flags).not.toContain("implausible_salary_claim");
  });

  /* Tolerance-by-bandSource calibration. The analyzer now uses tighter
   * tolerance (1.20x) for verified company-overrides with sourceCount ≥ 2,
   * looser (1.30x) for single-source overrides and tier-default bands.
   * Without this differentiation, an LLM offer ~28% above an approximate
   * tier-default band was getting flagged — false positive because the
   * band itself was an approximation. */
  it("verified company-override flags 30%+ overshoot as above_role_band", async () => {
    // Razorpay senior SE has totalMax ~65 LPA. Tighter tolerance (1.20x)
    // → ceiling ~78 LPA. An 85 LPA quote is 1.31x → above_role_band fires.
    const ses = session([
      ai("For your senior role we can offer 85 LPA total compensation."),
      user("My target is 70 LPA. I have a competing offer at 65 LPA."),
    ]) as SessionRowForAnalysis & { target_role?: string; target_company?: string };
    ses.target_role = "Senior Software Engineer";
    ses.target_company = "Razorpay";
    const out = await salaryNegotiationAnalyzer.analyze({ session: ses });
    expect(out.flags).toContain("above_role_band");
  });

  it("tier-default band tolerates up to ~30% above maxStretch (no false positive)", async () => {
    // Unknown company → falls through to tier-default. With 1.30x tolerance,
    // an offer modestly above maxStretch should NOT trigger above_role_band.
    const ses = session([
      ai("For your senior role we can offer 25 LPA total compensation."),
      user("My target is 22 LPA. I have a competing offer at 20 LPA."),
    ]) as SessionRowForAnalysis & { target_role?: string; target_company?: string };
    ses.target_role = "Senior Software Engineer";
    // Don't set target_company so we land on tier-default
    const out = await salaryNegotiationAnalyzer.analyze({ session: ses });
    // ₹25 LPA is well within tier-default tolerance for senior SE
    expect(out.flags).not.toContain("above_role_band");
  });
});

/* ─── Phase 1 (SCORE_IMPROVEMENT_PLAN.md section 2) ─────────────
   Coverage for v5: tier-bucket meta, CTC take-home wire-in, and
   the CLUSTERS-based coaching catalog. */
describe("salaryNegotiationAnalyzer v5 — Phase 1 wire-ins", () => {
  it("emits salaryNegotiation meta with tierBucket + tierBucketLabel for known company", async () => {
    const ses = session([
      ai("For your senior role we can offer 60 LPA total — base 42 + variable 12 + joining 6 LPA."),
      user("My expectation is 70 LPA based on my research. I have a competing offer at 65 LPA."),
      ai("Let me see what I can stretch to. Equity vests over 4 years quarterly. Notice period is 60 days."),
    ]) as SessionRowForAnalysis & { target_role?: string; target_company?: string };
    ses.target_role = "Senior Software Engineer";
    ses.target_company = "Razorpay"; // mature unicorn
    const out = await salaryNegotiationAnalyzer.analyze({ session: ses });
    expect(out.meta?.salaryNegotiation).toBeDefined();
    expect(out.meta?.salaryNegotiation?.tierBucket).toBe("mature_unicorn");
    expect(out.meta?.salaryNegotiation?.tierBucketLabel).toBe("Indian unicorn");
  });

  it("computes monthly take-home under both regimes when AI quotes a closing offer", async () => {
    const ses = session([
      ai("For your senior role we can offer 30 LPA total compensation. Equity vests over 4 years."),
      user("My target is 35 LPA based on my research. I have a competing offer at 32 LPA."),
      ai("I can stretch to 32 LPA total compensation. Notice period 60 days, buyout possible."),
    ]) as SessionRowForAnalysis & { target_role?: string; target_company?: string };
    ses.target_role = "Senior Software Engineer";
    ses.target_company = "Razorpay";
    const out = await salaryNegotiationAnalyzer.analyze({ session: ses });
    const m = out.meta?.salaryNegotiation;
    expect(m?.closingTotalLpa).toBeCloseTo(32, 1);
    expect(typeof m?.monthlyTakeHomeNewRegimeInr).toBe("number");
    expect(typeof m?.monthlyTakeHomeOldRegimeInr).toBe("number");
    // Sanity: monthly take-home for 32 LPA new regime should land somewhere
    // in ₹1.4L–₹2.2L/mo range (3.5k–5.5k per LPA × 32 = 112k–176k, before
    // tax. Post-tax slightly lower).
    expect(m!.monthlyTakeHomeNewRegimeInr!).toBeGreaterThan(100000);
    expect(m!.monthlyTakeHomeNewRegimeInr!).toBeLessThan(250000);
    expect(m!.annualTaxNewRegimeLpa).not.toBeNull();
  });

  it("emits tier meta even when no closing offer is present", async () => {
    const ses = session([
      ai("Tell me about your salary expectations."),
      user("I'm flexible, depends on the role and level."),
    ]) as SessionRowForAnalysis & { target_company?: string };
    ses.target_company = "Razorpay";
    const out = await salaryNegotiationAnalyzer.analyze({ session: ses });
    expect(out.meta?.salaryNegotiation?.tierBucket).toBe("mature_unicorn");
    expect(out.meta?.salaryNegotiation?.closingTotalLpa).toBeNull();
    expect(out.meta?.salaryNegotiation?.monthlyTakeHomeNewRegimeInr).toBeNull();
  });

  it("omits salaryNegotiation meta entirely for unrecognised company + no offer", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("Tell me about your expectations."),
        user("Whatever you can offer is fine."),
      ]),
    });
    expect(out.meta?.salaryNegotiation).toBeUndefined();
  });

  it("renders a 'Pattern, not isolated' discovery-cluster tip when ≥2 cluster members fire", async () => {
    // Trigger equity_never_discussed + joining_bonus_never_discussed +
    // notice_period_never_discussed — all in the discovery cluster.
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("Tell me about your expectations."),
        user("I'm targeting around 30 LPA based on my research and have an alternative offer at 28 LPA elsewhere."),
        ai("That's reasonable. Can you stretch your timeline?"),
        user("Yes, I can be flexible on start date if the base meets my target."),
        ai("Got it, let me come back with numbers."),
      ]),
    });
    expect(out.coachingNotes).toMatch(/Pattern, not isolated/);
    expect(out.coachingNotes).toMatch(/discovery/i);
  });

  it("renders an anchoring-cluster tip when user_never_anchored + no_batna_articulated both fire", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("What are your salary expectations?"),
        user("I'm flexible, what does the role pay typically these days?"),
        ai("We can offer 24 LPA base."),
        user("Hmm okay, can you do better than that please?"),
        ai("We could go to 26 LPA."),
        user("Alright that sounds workable I guess."),
      ]),
    });
    expect(out.coachingNotes).toMatch(/Pattern, not isolated/);
    expect(out.coachingNotes).toMatch(/anchoring/i);
  });

  it("expanded catalog: per-flag tips for the top-frequency flags now exist", async () => {
    // Drive a session that triggers user_never_anchored + no_batna + all
    // three discovery flags so we hit at least 5 per-flag tips. Need
    // ≥2 substantive (>30 char) user turns to clear the userTurnCount
    // gate inside the analyzer.
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("What are your salary expectations for this senior role?"),
        user("I'm pretty flexible on the comp side, would love to hear what you have in mind."),
        ai("We typically offer 20 LPA for this level of experience and scope."),
        user("Okay that sounds reasonable, I think that works for me as a starting point."),
        ai("Great. We'll send the formal offer letter through HR within 48 hours."),
      ]),
    });
    expect(out.coachingNotes).toMatch(/researched target range/i);
    expect(out.coachingNotes).toMatch(/BATNA/);
    expect(out.coachingNotes).toMatch(/Equity is often the largest lever/);
    expect(out.coachingNotes).toMatch(/Joining bonus/);
    expect(out.coachingNotes).toMatch(/Notice period/);
  });

  it("bumps version to v5", () => {
    expect(salaryNegotiationAnalyzer.version).toBe("salary-negotiation-v5");
  });
});

/* Direct behavioral tests for applyTitleExpFloor via generateNegotiationBand.
 * Confirms title prefix overrides YOE-derived experience floor. */
import { generateNegotiationBand } from "../../../data/salary-lookup";

describe("applyTitleExpFloor (via generateNegotiationBand)", () => {
  it("'Senior X' role with mid YOE → senior band", () => {
    const band = generateNegotiationBand({
      role: "Senior Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
    });
    // Razorpay senior SE band: totalMax 65, initialOffer ~38-42
    // Mid would be: totalMax 42, initialOffer ~26
    expect(band.initialOffer).toBeGreaterThan(30);
  });

  it("'Lead X' role lifts to lead band even with mid YOE", () => {
    const band = generateNegotiationBand({
      role: "Lead Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
    });
    // Razorpay lead SE band: totalMin 60. Lead initial >> mid.
    expect(band.initialOffer).toBeGreaterThan(50);
  });

  it("'VP of Engineering' role lifts to executive even with senior YOE", () => {
    const band = generateNegotiationBand({
      role: "VP of Engineering",
      company: "some-unicorn",
      experienceLevel: "senior",
    });
    // Executive bands are very high; ensure boost happened
    expect(band.initialOffer).toBeGreaterThan(40);
  });

  it("flags ai_usism_drift when AI quotes USD figures", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("We can offer you $120,000 plus a 401(k) match and standard PTO."),
        user("That's USD — I'm in India. Can we discuss in LPA?"),
      ]),
    });
    expect(out.flags).toContain("ai_usism_drift");
    const usismGap = out.rubricGaps.find(g => g.dimension === "voice_authenticity");
    expect(usismGap, "voice_authenticity gap should fire").toBeDefined();
    expect(usismGap!.observed).toMatch(/USD|401|PTO/);
  });

  it("does NOT flag ai_usism_drift on clean Indian-vocab transcripts", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("We can offer you ₹28 LPA — that's ₹22L base plus a 10% performance bonus and EPF contribution."),
        user("Could we discuss the joining bonus and notice-period buyout?"),
        ai("Yes — joining bonus of ₹3L on day-1 if you can join in 30 days."),
      ]),
    });
    expect(out.flags).not.toContain("ai_usism_drift");
  });

  it("flags multiple US-isms across turns and de-duplicates by label", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("Sign-on package of $25,000 plus equity refresh."),
        ai("We also offer 401K match up to 6% and three weeks PTO."),
        user("I need this in INR / LPA terms."),
      ]),
    });
    expect(out.flags).toContain("ai_usism_drift");
    const gap = out.rubricGaps.find(g => g.dimension === "voice_authenticity");
    expect(gap!.observed).toMatch(/USD|401|PTO/);
  });

  it("flags ai_offer_regression when AI walks back a number without revision language", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("We can offer ₹40 LPA total compensation for this role."),
        user("That works for my expectations. What's the breakdown?"),
        ai("So the offer is ₹32 LPA — let me know when you can join."),
      ]),
    });
    expect(out.flags).toContain("ai_offer_regression");
  });

  it("does NOT flag ai_offer_regression when AI uses revision language", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("We can offer ₹40 LPA total compensation."),
        user("Great."),
        ai("Actually let me revise that — I misspoke earlier. The correct offer is ₹35 LPA."),
      ]),
    });
    expect(out.flags).not.toContain("ai_offer_regression");
  });

  it("flags ai_arithmetic_error when AI claims wrong monthly take-home", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        // ₹40 LPA stated CTC, plausible take-home ~₹140-220k/month.
        // AI claims ₹50k — way too low.
        ai("Your offer is 40 LPA, which works out to about 50k per month take-home."),
        user("That seems low. Can you double-check?"),
      ]),
    });
    expect(out.flags).toContain("ai_arithmetic_error");
  });

  it("does NOT flag ai_arithmetic_error on plausible monthly take-home", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("Your 40 LPA stated CTC works out to roughly 180k per month after tax."),
        user("Thanks for the breakdown."),
      ]),
    });
    expect(out.flags).not.toContain("ai_arithmetic_error");
  });

  it("captures word-number salary phrases ('fifteen lakhs')", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("What are your expectations?"),
        user("My target is fifteen lakhs total compensation."),
        ai("That's reasonable. We can work with that."),
      ]),
    });
    // No specific flag, but the candidate's anchor was extracted (so
    // user_never_anchored should NOT fire).
    expect(out.flags).not.toContain("user_never_anchored");
  });

  it("captures compact crore notation ('1.5cr')", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: session([
        ai("What's your range?"),
        user("Looking at 1.5cr total comp for a Director role."),
        ai("Noted."),
      ]),
    });
    expect(out.flags).not.toContain("user_never_anchored");
  });

  it("flags role_company_mismatch for Pilot @ Razorpay setup", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: {
        ...session([
          ai("Welcome — let me walk through the package."),
          user("Thanks."),
        ]),
        target_role: "Pilot",
        target_company: "Razorpay",
      },
    });
    expect(out.flags).toContain("role_company_mismatch");
    const gap = out.rubricGaps.find(g => g.dimension === "session_setup");
    expect(gap, "session_setup gap should fire").toBeDefined();
  });

  it("does NOT flag role_company_mismatch for SE @ any company", async () => {
    const out = await salaryNegotiationAnalyzer.analyze({
      session: {
        ...session([
          ai("Welcome."),
          user("Hi."),
        ]),
        target_role: "Software Engineer",
        target_company: "ISRO",
      },
    });
    expect(out.flags).not.toContain("role_company_mismatch");
  });

  it("Plain 'Software Engineer' (no senior prefix) stays at YOE floor", () => {
    const midBand = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
    });
    const seniorYoeBand = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "senior",
    });
    // Senior YOE explicitly should land in senior band, mid YOE should not
    expect(seniorYoeBand.initialOffer).toBeGreaterThan(midBand.initialOffer + 5);
  });
});
