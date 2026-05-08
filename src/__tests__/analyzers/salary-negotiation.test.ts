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
