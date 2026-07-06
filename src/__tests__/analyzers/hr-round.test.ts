import { describe, it, expect } from "vitest";
import { hrRoundAnalyzer } from "../../../server-handlers/analyzers/hr-round";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../../server-handlers/analyzers/_types";

/* First direct unit coverage for the 1,298-line hr-round analyzer.
   The analyzer is pure (transcript in → flags/gaps out), so it is fully
   testable without the app, auth, or providers. These lock in current
   correct behaviour and pin the two detection defects surfaced in the
   July-2026 focus audit:
     • verbose counter-offer dodge escaped the 220-char length gate
     • a crisp, factual short gap answer was false-flagged as unexplained */

function session(transcript: TranscriptTurn[]): SessionRowForAnalysis {
  return {
    id: "sess_hr",
    user_id: "user_hr",
    type: "hr-round",
    focus: "HR round",
    difficulty: "mid",
    score: 70,
    questions: 6,
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

describe("hrRoundAnalyzer — baseline behaviour", () => {
  it("flags empty_transcript on an empty session", async () => {
    const out = await hrRoundAnalyzer.analyze({ session: session([]) });
    expect(out.flags).toContain("empty_transcript");
  });

  it("flags user_badmouthing_employer on toxic language about a past employer", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("Why are you looking to leave your current company?"),
        user("Honestly my current manager is toxic and the place is a nightmare."),
      ]),
    });
    expect(out.flags).toContain("user_badmouthing_employer");
  });

  it("flags vague_notice_period when the candidate hedges on notice", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("What is your notice period and earliest last working day?"),
        user("Not sure honestly, I haven't checked, depends on a few things."),
      ]),
    });
    expect(out.flags).toContain("vague_notice_period");
  });
});

describe("hrRoundAnalyzer — counter-offer dodge (verbose escape bug)", () => {
  it("flags a SHORT counter-offer dodge", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("If your current employer counters, what will you do?"),
        user("I'll see, it depends, too early to say."),
      ]),
    });
    expect(out.flags).toContain("counter_offer_dodge");
  });

  it("flags a VERBOSE counter-offer dodge (>220 chars) — audit repro", async () => {
    const verboseDodge =
      "That's a really good question and I appreciate you asking it directly. " +
      "Honestly it depends on a lot of factors that I can't fully predict right now, " +
      "and it's a bit too early for me to say anything definitive one way or the other. " +
      "Let me think about it properly when the time actually comes and I have all the details.";
    expect(verboseDodge.length).toBeGreaterThan(220);
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("If your current employer counters your offer, what will you do?"),
        user(verboseDodge),
      ]),
    });
    expect(out.flags).toContain("counter_offer_dodge");
  });

  it("does NOT flag a firm, verbose commitment as a dodge", async () => {
    const firmCommit =
      "I've genuinely made up my mind on this move — once I sign, I'm committed and " +
      "I won't entertain a counter-offer from my current employer. I've already had that " +
      "conversation with myself and this is the right next step for my career, full stop.";
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("If your current employer counters your offer, what will you do?"),
        user(firmCommit),
      ]),
    });
    expect(out.flags).not.toContain("counter_offer_dodge");
  });
});

describe("hrRoundAnalyzer — positive HR signals (strength-credit balance)", () => {
  /* The audit flagged a lopsided signal library: 50+ negative flags but
     only 2 positive ones, so a strong candidate's report read as a list
     of nits with no credit. These pin the four added positive signals,
     each the mirror of an existing negative detector. They render as
     strengths (coachingNotes), never as rubric gaps. */

  it("credits notice_period_precise on exact days + buyout/handover depth", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("Tell me about yourself and your current role."),
        user("Senior engineer at Infosys, 6 years, led the payments migration."),
        ai("What is your notice period and earliest last working day?"),
        user("It's 90 days, but buyout is possible — roughly one month gross. I'd plan a full KT handover and my earliest LWD would be mid-August with manager sign-off."),
        ai("Great. Why are you looking to move?"),
        user("Want to move into a product-first team where I own the roadmap."),
      ]),
    });
    expect(out.flags).toContain("notice_period_precise");
    expect(out.flags).not.toContain("notice_period_shallow");
    expect(out.flags).not.toContain("vague_notice_period");
  });

  it("credits bgv_docs_volunteered when the candidate names docs by name", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("We run a standard background verification — any concerns?"),
        user("None at all. I have Form 16 for the last 2 years, active UAN, last 3 payslips, and relieving letters from each employer ready to share."),
      ]),
    });
    expect(out.flags).toContain("bgv_docs_volunteered");
    expect(out.flags).not.toContain("bgv_literacy_low");
  });

  it("credits specific_why_us when the answer names a concrete product/leader/domain", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("Why do you want to join our company specifically?"),
        user("Your UPI-lending launch last quarter and the engineering blog on your ledger rewrite — that domain is exactly where I want to go deep."),
      ]),
    });
    expect(out.flags).toContain("specific_why_us");
    expect(out.flags).not.toContain("generic_why_company");
  });

  it("credits reverse_questions_substantive on a strong closing question set", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("That's all from me — do you have any questions for me?"),
        user("Yes — what does success look like in the first 90 days, how is the team structured, and what's the manager's style?"),
      ]),
    });
    expect(out.flags).toContain("reverse_questions_substantive");
    expect(out.flags).not.toContain("reverse_interview_low_quality");
  });

  it("does NOT credit a positive when the candidate actually did poorly", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("What is your notice period?"),
        user("Not sure, haven't checked, depends."),
        ai("Any questions for me?"),
        user("No, nothing really, all good."),
      ]),
    });
    expect(out.flags).not.toContain("notice_period_precise");
    expect(out.flags).not.toContain("reverse_questions_substantive");
  });
});

describe("hrRoundAnalyzer — gap explanation (crisp-answer false-positive bug)", () => {
  it("does NOT flag a crisp, factual short gap answer — audit repro", async () => {
    const crispGap = "4-month gap in 2023, cared for ill father, back at Infosys Feb 2024.";
    expect(crispGap.length).toBeLessThan(80); // short answer, hits the old <80 gate
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("I see a gap on your resume — can you walk me through it?"),
        user(crispGap),
      ]),
    });
    expect(out.flags).not.toContain("gap_unexplained");
  });

  it("STILL flags a genuinely thin / evasive gap answer", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("I see a gap on your resume — can you walk me through it?"),
        user("Personal reasons, nothing much."),
      ]),
    });
    expect(out.flags).toContain("gap_unexplained");
  });
});

describe("hrRoundAnalyzer — review-fix regressions (Jul-2026 adversarial pass)", () => {
  /* Four defects found reviewing the added detectors themselves. Each pins
     the false-positive the fix removes AND the true-positive it must keep. */

  it("gap: tightened GAP_EXPLAINED no longer treats a bare hedge as explained", async () => {
    // "maybe" used to match the greedy `may[a-z]*` month alternation, so a
    // dodge that happened to contain it slipped past the gap_unexplained gate.
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("I see a gap on your resume — can you walk me through it?"),
        user("Maybe, not really sure honestly."),
      ]),
    });
    expect(out.flags).toContain("gap_unexplained");
  });

  it("gap: a real month-named explanation is still credited (not flagged)", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("I see a gap on your resume — can you walk me through it?"),
        user("Took a sabbatical from March to July for a family emergency."),
      ]),
    });
    expect(out.flags).not.toContain("gap_unexplained");
  });

  it("counter-offer: hedge-then-commit answer is NOT flagged as a dodge", async () => {
    // Opens with a dodge phrase but resolves into firm commitment — the new
    // COUNTER_OFFER_COMMITTED guard must veto the counter_offer_dodge flag.
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("If your current employer counters your offer, what will you do?"),
        user("Honestly it depends on nothing really — I'm firm on this move and a counter won't change my decision."),
      ]),
    });
    expect(out.flags).not.toContain("counter_offer_dodge");
  });

  it("counter-offer: a genuine dodge with no commitment is STILL flagged", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("If your current employer counters your offer, what will you do?"),
        user("I'll see how it goes, too early to say, let me think about it then."),
      ]),
    });
    expect(out.flags).toContain("counter_offer_dodge");
  });

  it("notice: precise credit needs CANDIDATE-side depth, not interviewer-side", async () => {
    // HR raises buyout/handover; the candidate gives only a bare number. The
    // old allText test credited the candidate for the interviewer's words.
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("What's your notice period? Is a buyout or knowledge-transfer handover possible on your side?"),
        user("It's 90 days."),
      ]),
    });
    expect(out.flags).not.toContain("notice_period_precise");
  });

  it("notice: candidate who volunteers the depth themselves is still credited", async () => {
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("What is your notice period and earliest last working day?"),
        user("It's 90 days, but a buyout is possible and I'd run a full KT handover; my last working day would be mid-August."),
      ]),
    });
    expect(out.flags).toContain("notice_period_precise");
  });

  it("bgv: naming other docs while refusing payslips does NOT earn the volunteer credit", async () => {
    // Isolate payslip_refusal from bgv_document_evasion (already guarded): the
    // refusal turn uses a payslip-unique Hindi token so the generic BGV-evasion
    // detector doesn't co-fire, proving MY payslip_refusal guard does the work.
    const out = await hrRoundAnalyzer.analyze({
      session: session([
        ai("Can you share your recent payslip and Form 16 for verification?"),
        user("Payslip abhi nahi de sakta."),
        ai("Understood. For the background verification, which documents can you provide?"),
        user("I have Form 16, an active UAN, and relieving letters from each employer."),
      ]),
    });
    expect(out.flags).toContain("payslip_refusal");
    expect(out.flags).not.toContain("bgv_document_evasion");
    expect(out.flags).not.toContain("bgv_docs_volunteered");
  });
});
