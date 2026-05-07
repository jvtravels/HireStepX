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
});
