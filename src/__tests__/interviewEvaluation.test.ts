import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  computeFallbackScores,
  processLLMEvaluation,
  loadPreviousScores,
  extractNegotiationFacts,
  type TranscriptEntry,
} from "../interviewEvaluation";

function makeTranscript(userTexts: string[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const text of userTexts) {
    entries.push({ speaker: "ai", text: "Question?", time: "00:00" });
    entries.push({ speaker: "user", text, time: "00:01" });
  }
  return entries;
}

describe("computeFallbackScores", () => {
  it("returns a score in [60, 98] for answered interviews", () => {
    const transcript = makeTranscript([
      "I led a project that reduced latency by 30% across our infrastructure.",
    ]);
    const result = computeFallbackScores({
      transcript,
      currentStep: 3,
      scriptLength: 5,
      difficulty: "standard",
      elapsed: 200,
    });
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThanOrEqual(98);
    expect(result.hasAnyAnswers).toBe(true);
  });

  it("caps score at 30 when there are no real answers", () => {
    const transcript: TranscriptEntry[] = [
      { speaker: "ai", text: "Tell me about yourself", time: "00:00" },
      { speaker: "user", text: "[skipped]", time: "00:01" },
    ];
    const result = computeFallbackScores({
      transcript,
      currentStep: 1,
      scriptLength: 5,
      difficulty: "standard",
      elapsed: 60,
    });
    expect(result.hasAnyAnswers).toBe(false);
    expect(result.score).toBeLessThanOrEqual(30);
  });

  /* OA-B41 — a no-answer transcript caps the overall at 30, but the skill
     dimensions used to build off the ≥60 fallbackScore and floor at 40, so
     every dimension rendered ABOVE the overall it aggregates into. The
     dimensions must not outrun a no-answer overall. */
  it("keeps skill dimensions from outrunning a no-answer overall (B41)", () => {
    const transcript: TranscriptEntry[] = [
      { speaker: "ai", text: "Tell me about yourself", time: "00:00" },
      { speaker: "user", text: "[skipped]", time: "00:01" },
      { speaker: "ai", text: "Walk me through a project", time: "00:02" },
      { speaker: "user", text: "[no response]", time: "00:03" },
    ];
    const result = computeFallbackScores({
      transcript, currentStep: 2, scriptLength: 5, difficulty: "standard", elapsed: 120,
    });
    expect(result.hasAnyAnswers).toBe(false);
    expect(result.score).toBeLessThanOrEqual(30);
    const dims = Object.values(result.skillScores);
    // No dimension may sit far above the overall it aggregates into. Allow a
    // small band for demeanour skills but forbid the old 40-floor contradiction.
    const maxDim = Math.max(...dims);
    expect(maxDim).toBeLessThanOrEqual(result.score + 10);
    // And the honest-low floor now lets an empty transcript read below 40.
    expect(Math.min(...dims)).toBeLessThan(40);
  });

  it("preserves the ≥40 dimension floor when the candidate DID answer (B41 back-compat)", () => {
    const transcript = makeTranscript(["I led a migration that cut costs 20% for the team."]);
    const result = computeFallbackScores({
      transcript, currentStep: 3, scriptLength: 5, difficulty: "standard", elapsed: 200,
    });
    expect(result.hasAnyAnswers).toBe(true);
    for (const v of Object.values(result.skillScores)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(95);
    }
  });

  it("gives difficulty bonus for intense", () => {
    const transcript = makeTranscript(["I built a system handling 1M users daily."]);
    const base = computeFallbackScores({
      transcript, currentStep: 3, scriptLength: 5, difficulty: "standard", elapsed: 200,
    });
    const intense = computeFallbackScores({
      transcript, currentStep: 3, scriptLength: 5, difficulty: "intense", elapsed: 200,
    });
    expect(intense.score).toBeGreaterThanOrEqual(base.score);
  });

  it("gives time bonus for longer interviews", () => {
    const transcript = makeTranscript(["I designed the architecture for our microservices."]);
    const short = computeFallbackScores({
      transcript, currentStep: 3, scriptLength: 5, difficulty: "standard", elapsed: 60,
    });
    const long = computeFallbackScores({
      transcript, currentStep: 3, scriptLength: 5, difficulty: "standard", elapsed: 400,
    });
    expect(long.score).toBeGreaterThanOrEqual(short.score);
  });

  it("returns seven skill categories", () => {
    const transcript = makeTranscript(["I improved our CI pipeline."]);
    const result = computeFallbackScores({
      transcript, currentStep: 2, scriptLength: 5, difficulty: "standard", elapsed: 150,
    });
    expect(Object.keys(result.skillScores)).toEqual(
      expect.arrayContaining([
        "communication", "structure", "technicalDepth", "leadership",
        "problemSolving", "confidence", "specificity",
      ]),
    );
    for (const v of Object.values(result.skillScores)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(95);
    }
  });

  it("boosts specificity when metrics are present", () => {
    const withMetrics = makeTranscript(["I reduced load time by 40% for 10000 users."]);
    const without = makeTranscript(["I reduced load time significantly for many users in our app."]);
    const r1 = computeFallbackScores({
      transcript: withMetrics, currentStep: 3, scriptLength: 5, difficulty: "standard", elapsed: 200,
    });
    const r2 = computeFallbackScores({
      transcript: without, currentStep: 3, scriptLength: 5, difficulty: "standard", elapsed: 200,
    });
    expect(r1.skillScores.specificity).toBeGreaterThan(r2.skillScores.specificity);
  });

  it("handles empty transcript", () => {
    const result = computeFallbackScores({
      transcript: [], currentStep: 0, scriptLength: 5, difficulty: "standard", elapsed: 0,
    });
    expect(result.hasAnyAnswers).toBe(false);
    expect(result.score).toBeLessThanOrEqual(30);
  });
});

describe("computeFallbackScores — salary-negotiation outcome grounding", () => {
  /* Launch blocker (staging session 91f8fdb3): a candidate who named a
     number, cited market data, flagged a competing offer, then FOLDED —
     accepting ₹48.3 against a ₹65 ask while the recruiter never moved —
     scored 95 on Leverage Use / Closing / Anchoring and 79 "Hire". Word
     signals were rewarded; the actual (zero-gap-closure) outcome ignored.
     These tests pin the fix: when the candidate accepts a weak result,
     the outcome-dependent skills are capped to what was achieved. */

  const strongWordsButFold = makeTranscript([
    "Based on Glassdoor and levels.fyi market data, comparable roles sit at 65 LPA, so my target for this role is 65 LPA.",
    "I also have a competing offer of 60 LPA in hand from another company.",
    "Okay, that works for me — I accept the offer.",
  ]);

  it("caps outcome-dependent skills when the candidate folds below their ask", () => {
    const r = computeFallbackScores({
      transcript: strongWordsButFold,
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
      negotiationTargetSalary: 65,     // asked for 65
      negotiationHighestOffer: 48.3,   // settled 26% below
      negotiationInitialOffer: 48.3,   // recruiter never moved
    });
    // >20% short → ceiling 45; the strong words must NOT rescue the score.
    expect(r.skillScores.leverageUse).toBeLessThanOrEqual(45);
    expect(r.skillScores.closingTechnique).toBeLessThanOrEqual(45);
    expect(r.skillScores.anchoring).toBeLessThanOrEqual(45);
    expect(r.skillScores.concessionStrategy).toBeLessThanOrEqual(45);
    expect(r.skillScores.packageThinking).toBeLessThanOrEqual(45);
    // Overall can't headline as "Hire" on a cave.
    expect(r.score).toBeLessThanOrEqual(60);
    // Demeanour is unaffected — a calm, polite fold is still calm and polite.
    expect(r.skillScores.composure).toBeGreaterThan(45);
    expect(r.skillScores.professionalTone).toBeGreaterThan(45);
  });

  it("does NOT cap when the candidate closes at or above their ask", () => {
    const r = computeFallbackScores({
      transcript: strongWordsButFold, // same words…
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
      negotiationTargetSalary: 65,
      negotiationHighestOffer: 66,    // …but they actually got 66 (≥ ask)
      negotiationInitialOffer: 48.3,  // recruiter moved a lot
    });
    expect(r.skillScores.leverageUse).toBeGreaterThan(60);
    expect(r.skillScores.closingTechnique).toBeGreaterThan(60);
    expect(r.score).toBeGreaterThan(70);
  });

  it("applies a mediocre ceiling for a 10–20% shortfall", () => {
    const r = computeFallbackScores({
      transcript: strongWordsButFold,
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
      negotiationTargetSalary: 65,
      negotiationHighestOffer: 55.25, // 15% below ask
      negotiationInitialOffer: 50,    // recruiter moved 5 → not a total stall
    });
    expect(r.skillScores.leverageUse).toBeLessThanOrEqual(60);
    expect(r.skillScores.leverageUse).toBeGreaterThan(45);
  });

  it("caps on a recruiter-never-moved fold even with no target known", () => {
    const r = computeFallbackScores({
      transcript: strongWordsButFold,
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
      negotiationTargetSalary: null,  // never stated a number we captured
      negotiationHighestOffer: 50,
      negotiationInitialOffer: 50,    // flat trajectory → fold
    });
    expect(r.skillScores.leverageUse).toBeLessThanOrEqual(50);
    expect(r.skillScores.closingTechnique).toBeLessThanOrEqual(50);
  });

  it("is opt-in: without outcome params, legacy behaviour is unchanged", () => {
    const withParams = computeFallbackScores({
      transcript: strongWordsButFold,
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
      negotiationTargetSalary: 65, negotiationHighestOffer: 48.3, negotiationInitialOffer: 48.3,
    });
    const withoutParams = computeFallbackScores({
      transcript: strongWordsButFold,
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
    });
    // No outcome signal → no cap → the old word-driven high score survives.
    expect(withoutParams.skillScores.leverageUse).toBeGreaterThan(75);
    expect(withoutParams.skillScores.leverageUse).toBeGreaterThan(withParams.skillScores.leverageUse);
  });

  it("does not cap a walk-away (candidate never accepted)", () => {
    const walkAway = makeTranscript([
      "Based on market data my target is 65 LPA.",
      "That offer is too far below market. I'll have to decline and pursue my other options.",
    ]);
    const r = computeFallbackScores({
      transcript: walkAway,
      currentStep: 5, scriptLength: 5, difficulty: "standard", elapsed: 300,
      interviewType: "salary-negotiation",
      negotiationTargetSalary: 65, negotiationHighestOffer: 48.3, negotiationInitialOffer: 48.3,
    });
    // Declining a lowball is not a fold — outcome caps must not fire.
    expect(r.skillScores.leverageUse).toBeGreaterThan(60);
  });
});

describe("processLLMEvaluation", () => {
  it("extracts score and clamps to [0, 100]", () => {
    const r = processLLMEvaluation({ overallScore: 150, feedback: "Great" }, 70);
    expect(r.score).toBe(100);

    const r2 = processLLMEvaluation({ overallScore: -10, feedback: "Poor" }, 70);
    expect(r2.score).toBe(0);
  });

  it("falls back to fallbackScore when overallScore missing", () => {
    const r = processLLMEvaluation({ feedback: "Decent" }, 72);
    expect(r.score).toBe(72);
  });

  it("extracts feedback string", () => {
    const r = processLLMEvaluation({ overallScore: 80, feedback: "Well done" }, 70);
    expect(r.feedback).toBe("Well done");
  });

  it("defaults feedback to empty string", () => {
    const r = processLLMEvaluation({ overallScore: 80 }, 70);
    expect(r.feedback).toBe("");
  });

  it("extracts skillScores from raw numbers", () => {
    const r = processLLMEvaluation({
      overallScore: 80,
      skillScores: { communication: 85, structure: 70 },
    }, 70);
    expect(r.skillScores).toEqual({ communication: 85, structure: 70 });
  });

  it("extracts skillScores from {score: N} objects", () => {
    const r = processLLMEvaluation({
      overallScore: 80,
      skillScores: { communication: { score: 85, detail: "good" }, structure: 70 },
    }, 70);
    expect(r.skillScores).toEqual({ communication: 85, structure: 70 });
  });

  it("returns empty skillScores when missing", () => {
    const r = processLLMEvaluation({ overallScore: 80 }, 70);
    expect(r.skillScores).toEqual({});
  });

  it("extracts idealAnswers array", () => {
    const ideal = [{ question: "Q1", ideal: "A1", candidateSummary: "C1" }];
    const r = processLLMEvaluation({ overallScore: 80, idealAnswers: ideal }, 70);
    expect(r.idealAnswers).toEqual(ideal);
  });

  it("returns empty idealAnswers when not an array", () => {
    const r = processLLMEvaluation({ overallScore: 80, idealAnswers: "nope" }, 70);
    expect(r.idealAnswers).toEqual([]);
  });

  it("passes through optional fields when present", () => {
    const r = processLLMEvaluation({
      overallScore: 85,
      starAnalysis: { overall: 4, breakdown: { situation: 4 }, tip: "Be specific" },
      strengths: ["Clear communication"],
      improvements: ["Add metrics"],
      nextSteps: ["Practice STAR"],
    }, 70);
    expect(r.starAnalysis).toBeDefined();
    expect(r.strengths).toEqual(["Clear communication"]);
    expect(r.improvements).toEqual(["Add metrics"]);
    expect(r.nextSteps).toEqual(["Practice STAR"]);
  });

  it("omits optional fields when absent", () => {
    const r = processLLMEvaluation({ overallScore: 80 }, 70);
    expect(r.starAnalysis).toBeUndefined();
    expect(r.strengths).toBeUndefined();
    expect(r.improvements).toBeUndefined();
    expect(r.nextSteps).toBeUndefined();
  });
});

describe("loadPreviousScores", () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    });
  });

  it("returns null when no data in localStorage", () => {
    expect(loadPreviousScores()).toBeNull();
  });

  it("returns null for empty array", () => {
    localStorage.setItem("hirestepx_sessions", "[]");
    expect(loadPreviousScores()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem("hirestepx_sessions", "not json");
    expect(loadPreviousScores()).toBeNull();
  });

  it("returns null when first session has no score", () => {
    localStorage.setItem("hirestepx_sessions", JSON.stringify([{ skill_scores: {} }]));
    expect(loadPreviousScores()).toBeNull();
  });

  it("returns null when first session has no skill_scores", () => {
    localStorage.setItem("hirestepx_sessions", JSON.stringify([{ score: 80 }]));
    expect(loadPreviousScores()).toBeNull();
  });

  it("extracts scores from raw numbers", () => {
    localStorage.setItem("hirestepx_sessions", JSON.stringify([
      { score: 82, skill_scores: { communication: 85, structure: 70 } },
    ]));
    const result = loadPreviousScores();
    expect(result).toEqual({ overall: 82, skills: { communication: 85, structure: 70 } });
  });

  it("extracts scores from {score: N} objects", () => {
    localStorage.setItem("hirestepx_sessions", JSON.stringify([
      { score: 75, skill_scores: { communication: { score: 80 }, leadership: 60 } },
    ]));
    const result = loadPreviousScores();
    expect(result).toEqual({ overall: 75, skills: { communication: 80, leadership: 60 } });
  });

  it("defaults non-numeric and non-object values to 0", () => {
    localStorage.setItem("hirestepx_sessions", JSON.stringify([
      { score: 70, skill_scores: { communication: "high", structure: null } },
    ]));
    const result = loadPreviousScores();
    expect(result).toEqual({ overall: 70, skills: { communication: 0, structure: 0 } });
  });
});

describe("extractNegotiationFacts", () => {
  it("detects immediate acceptance", () => {
    const transcript = makeTranscript(["I accept the offer."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.acceptedImmediately).toBe(true);
    expect(facts.rejectedOutright).toBe(false);
  });

  it("detects outright rejection", () => {
    const transcript = makeTranscript(["That's way too low, absolutely not."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.rejectedOutright).toBe(true);
  });

  it("extracts candidate counter number", () => {
    const transcript = makeTranscript(["I was hoping for around 35 LPA."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateCounter).toBe("₹35 LPA");
  });

  it("[fixture: Flipkart in-hand-vs-target] separates competing offer from candidateCounter", () => {
    /* Bug source: Flipkart UX session. Candidate said "I have an offer
       of 68 lakhs in hand, my target is 70 LPA". The AI conflated and
       echoed ₹68 as the candidate's number, then countered below it.
       Now: competingOfferAmount captures ₹68, candidateCounter captures
       ₹70 — distinct fields, no anchor drift. */
    const transcript = makeTranscript([
      "I have an offer of 68 lakhs in hand from another company. My target for this role is 70 LPA.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.competingOfferAmount).toBe("₹68 LPA");
    expect(facts.candidateCounter).toBe("₹70 LPA");
    expect(facts.hasCompetingOffers).toBe(true);
  });

  it("competingOfferAmount stays null when candidate only states a target", () => {
    const transcript = makeTranscript(["I'm looking for around 45 LPA."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.competingOfferAmount).toBeNull();
    expect(facts.candidateCounter).toBe("₹45 LPA");
  });

  it("differentiates candidateAskTotal from candidateAskBase when phrased explicitly", () => {
    const transcript = makeTranscript(["Was expecting 12 lakhs per annum total CTC with 11 lakhs as base salary."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateAskTotal).toBe("₹12 LPA");
    expect(facts.candidateAskBase).toBe("₹11 LPA");
  });

  it("leaves base/total null when not labelled", () => {
    const transcript = makeTranscript(["I'd like 25 LPA."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateAskBase).toBeNull();
    // candidateAskTotal stays null too unless 'total/CTC/package' is explicit
    expect(facts.candidateAskTotal).toBeNull();
  });

  it("extracts current CTC", () => {
    const transcript = makeTranscript(["I'm currently earning ₹28 LPA at my current job."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateCurrentCTC).toBe("₹28 LPA");
  });

  it("[fixture: Bombay Design Centre] 'my current package is around 8.5 LPA' is current CTC, not target", () => {
    /* Real session: candidate had stated target ₹10 LPA in turn 1, then
       in turn 2 said "It's on current package progression because my
       current package is around 8.5 LPA". The strict CTC regex missed
       this because "package is around" sat between the trigger word and
       the number, so 8.5 fell through into counterNumbers and the LLM
       echoed "₹8.5 LPA is what you're looking at" — switching the
       candidate's apparent target downward from ₹10 to ₹8.5. */
    const transcript = makeTranscript([
      "I think the current salary is low. I would like to have around 10 lakhs per CTC for this role.",
      "It's on current package progression because my current package is around 8.5 LPA.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateCurrentCTC).toBe("₹8.5 LPA");
    // Target stays at the ₹10 LPA from turn 1 — not displaced by the
    // current-package number in turn 2.
    expect(facts.candidateCounter).toBe("₹10 LPA");
  });

  it("'my current salary is 12 lakhs' (loose form) detected as CTC", () => {
    const transcript = makeTranscript(["My current salary is 12 lakhs and I'm looking for a step up."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateCurrentCTC).toBe("₹12 LPA");
  });

  it("detects competing offers", () => {
    const transcript = makeTranscript(["I have another company offering a better package."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.hasCompetingOffers).toBe(true);
  });

  it("extracts topics raised by candidate", () => {
    const transcript = makeTranscript([
      "Can you tell me about the health insurance and remote work policy?",
      "I'm also interested in the ESOP vesting schedule.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.topicsRaised).toContain("health insurance");
    expect(facts.topicsRaised).toContain("remote/flexibility");
    expect(facts.topicsRaised).toContain("equity/ESOPs");
  });

  it("detects number deflection", () => {
    const transcript = makeTranscript(["I don't want to share my current CTC. Please tell me your offer."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.deflectedNumbers).toBe(true);
    expect(facts.candidateCounter).toBeNull();
  });

  it("handles empty transcript", () => {
    const facts = extractNegotiationFacts([]);
    expect(facts.acceptedImmediately).toBe(false);
    expect(facts.candidateCounter).toBeNull();
    expect(facts.topicsRaised).toEqual([]);
  });

  /* ─── Acceptance regex refinement (2026-Q2) ───
     Pre-fix bug: any "but" in the user's reply blocked acceptance
     detection. "I would like to accept this offer. But I would like
     to know more about the benefits" was being read as conditional
     acceptance and ignored, so the AI kept negotiating after the
     candidate had clearly accepted. */
  it("detects acceptance with info-seeking 'but' (regression)", () => {
    const transcript = makeTranscript([
      "I would like to accept this offer. But I would like to know more about the benefits.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.acceptedImmediately).toBe(true);
  });

  it("detects acceptance phrased as 'happy to accept' / 'would like to accept'", () => {
    const transcript = makeTranscript(["Happy to accept this. Could you tell me when I'd start?"]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.acceptedImmediately).toBe(true);
  });

  it("still BLOCKS acceptance when 'but' is followed by a negotiation lever", () => {
    const transcript = makeTranscript(["I'd accept it, but I want a higher base — at least ₹30L."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.acceptedImmediately).toBe(false);
  });

  it("still BLOCKS acceptance with hard conditionals", () => {
    const transcript1 = makeTranscript(["I'll accept if you raise base to ₹30L."]);
    expect(extractNegotiationFacts(transcript1).acceptedImmediately).toBe(false);

    const transcript2 = makeTranscript(["I accept, provided ESOPs vest in 3 years not 4."]);
    expect(extractNegotiationFacts(transcript2).acceptedImmediately).toBe(false);
  });

  it("does not require a < 15 word cap (long acceptance with curiosity passes)", () => {
    /* Pre-fix: a strict word-count cap prevented long-but-genuine
       acceptances from registering. */
    const transcript = makeTranscript([
      "Yes, I would like to accept this offer formally — thank you for the conversation. But I'd appreciate it if you could share what the benefits package looks like before I sign.",
    ]);
    expect(extractNegotiationFacts(transcript).acceptedImmediately).toBe(true);
  });

  /* ─── Replay fixtures: real session bugs ───
     Each fixture is a multi-turn transcript reconstructed from a session
     that produced a known bug. Adding the fixture here pins the fix —
     any future regex/extractor change that re-breaks the case fails the
     suite. Keep one fixture per distinct bug class; cite the bug. */

  it("[fixture: TCS UX downward revision] tracks LATEST stated counter, not max", () => {
    /* Bug source: TCS UI/UX Designer session screenshots. Candidate
       opened at "20 LPA", was told the band was tight, revised to
       "18 lakhs base" two turns later. Old extractor reduce-maxed and
       kept anchoring all subsequent counters to 20 — every turn
       inflated the negotiation. Fix: take the last stated number. */
    const transcript = makeTranscript([
      "I'm looking at around 20 LPA total, given my experience.",
      "I understand. I'd be willing to come down to 18 lakhs as base salary.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateAskBase).toBe("₹18 LPA");
    // candidateCounter takes the latest target-context number.
    expect(facts.candidateCounter).toBe("₹18 LPA");
  });

  it("[fixture: total-then-revised-total] picks the latest total, not max", () => {
    const transcript = makeTranscript([
      "I'm expecting 25 LPA total CTC.",
      "After hearing your benefits, I can do 22 LPA total.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateAskTotal).toBe("₹22 LPA");
  });

  it("[fixture: ixigo crore-vs-lakh] normalizes crore to LPA correctly", () => {
    /* Bug source: ixigo session — "1 crore" was being stored as ₹1 LPA
       in the counter, badly understating the candidate's ask. */
    const transcript = makeTranscript(["I'm expecting around 1 crore total CTC."]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateAskTotal).toBe("₹100 LPA");
  });

  it("[fixture: benefit-coded amounts] does not pull benefit ₹ into counter", () => {
    /* "₹1 lakh as health insurance" / "₹2 lakhs in joining bonus" must
       not bind candidateCounter — they're component itemizations, not
       the candidate's ask. */
    const transcript = makeTranscript([
      "I'm asking 30 LPA, plus ₹1 lakh for health insurance and ₹2 lakhs joining bonus.",
    ]);
    const facts = extractNegotiationFacts(transcript);
    expect(facts.candidateCounter).toBe("₹30 LPA");
  });
});
