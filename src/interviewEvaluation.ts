/* ─── Interview Evaluation Helpers ─── */
/* Pure functions for computing fallback scores and processing LLM evaluation results.
   Extracted from useInterviewEngine handleEnd(). */

export interface TranscriptEntry {
  speaker: "ai" | "user";
  text: string;
  time: string;
}

export interface FallbackResult {
  score: number;
  skillScores: Record<string, number>;
  hasAnyAnswers: boolean;
}

export interface EvalParams {
  transcript: TranscriptEntry[];
  currentStep: number;
  scriptLength: number;
  difficulty: string;
  elapsed: number;
  interviewType?: string;
}

/** Compute heuristic fallback scores when LLM evaluation is unavailable */
export function computeFallbackScores(params: EvalParams): FallbackResult {
  const { transcript, currentStep, scriptLength, difficulty, elapsed, interviewType } = params;
  const completionRatio = currentStep / Math.max(1, scriptLength);
  // Salary-neg: early close (acceptance) is a GOOD outcome, not a penalty
  // Use a higher base and don't penalize for fewer turns
  const baseScore = interviewType === "salary-negotiation"
    ? 70 + Math.round(Math.min(1, completionRatio * 1.5) * 15) // reaches max at ~67% completion
    : 65 + Math.round(completionRatio * 20);
  const difficultyBonus = difficulty === "intense" ? 5 : difficulty === "warmup" ? -3 : 0;
  const timeBonus = elapsed > 300 ? 5 : elapsed > 120 ? 3 : 0;
  const questionBonus = Math.min(5, Math.floor(transcript.filter(t => t.speaker === "user").length * 1.5));
  const fallbackScore = Math.min(98, Math.max(60, baseScore + difficultyBonus + timeBonus + questionBonus));

  const hasAnyAnswers = transcript.some(
    t => t.speaker === "user" && t.text.length > 10 && !/^\[.*\]$/.test(t.text.trim()),
  );
  const score = hasAnyAnswers ? fallbackScore : Math.min(30, fallbackScore);

  const userAnswers = transcript.filter(t => t.speaker === "user");
  const avgAnswerLen = userAnswers.length > 0
    ? userAnswers.reduce((s, t) => s + t.text.length, 0) / userAnswers.length : 0;
  const fillerCount = userAnswers.reduce((s, t) =>
    s + (t.text.match(/\b(um|uh|like|basically|actually|you know)\b/gi) || []).length, 0);

  const clamp = (v: number) => Math.max(40, Math.min(95, v));

  if (interviewType === "salary-negotiation") {
    // Negotiation-specific skill dimensions
    const facts = extractNegotiationFacts(transcript);
    // Detect numbers: include Crore amounts (1 Cr = 100 LPA)
    const mentionedNumbers = userAnswers.some(t => /₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakh|lakhs|cr|crore)/i.test(t.text));
    const topicCount = facts.topicsRaised.length;

    // Quality-aware anchoring: market data reference is stronger than just naming a number
    const usedMarketData = userAnswers.some(t => /(?:market.*data|glassdoor|levels\.fyi|ambition\s*box|benchmark|market.*rate|industry.*standard|percentile)/i.test(t.text));
    const anchoringBonus = (mentionedNumbers ? 5 : -8) + (facts.candidateCounter ? 5 : -5) + (usedMarketData ? 8 : 0);

    // Package thinking: reward depth over breadth
    // Depth = exploring a topic with specifics, not just mentioning it
    const topicDepthSignals = userAnswers.filter(t =>
      /(?:how much|what's the|can we discuss|break.*down|structure|what does.*look like|tell me about the)/i.test(t.text),
    ).length;
    const packageBonus = Math.min(15, topicCount * 3) + Math.min(8, topicDepthSignals * 4) - (topicCount === 0 ? 10 : 0);

    // Concession: distinguish trading vs caving. Trading = conditional language
    const usedTradeLanguage = userAnswers.some(t =>
      /(?:if you.*then|in exchange|only if|provided|on condition|i can accept.*if|i.?d be open to.*if|how about.*instead)/i.test(t.text),
    );
    const concessionBonus = (facts.acceptedImmediately ? -15 : 3)
      + (facts.rejectedOutright ? -3 : 0)
      + (usedTradeLanguage ? 10 : 0);

    // Closing: asking for time is good, confirming full package is better
    const confirmedPackage = userAnswers.some(t =>
      /(?:just to confirm|so the total|let me summarize|offer letter|in writing|full package|all.*included)/i.test(t.text),
    );

    const skillScores: Record<string, number> = {
      anchoring: clamp(fallbackScore + anchoringBonus),
      packageThinking: clamp(fallbackScore + packageBonus),
      leverageUse: clamp(fallbackScore + (facts.hasCompetingOffers ? 10 : 0) + (facts.mentionedBATNA ? 8 : 0) + (facts.deflectedNumbers ? 3 : 0) + (usedMarketData ? 5 : -3)),
      concessionStrategy: clamp(fallbackScore + concessionBonus),
      closingTechnique: clamp(fallbackScore + (facts.askedForTime ? 5 : 0) + (confirmedPackage ? 8 : 0) + (completionRatio > 0.8 ? 5 : -5)),
      composure: clamp(fallbackScore + (fillerCount < 2 ? 5 : -8) + (facts.expressedSurprise ? 3 : 0) + (facts.usedTacticalSilence ? 5 : 0)),
      professionalTone: clamp(fallbackScore + (fillerCount < 3 ? 5 : -5) + (avgAnswerLen > 30 ? 3 : -5)),
    };
    return { score, skillScores, hasAnyAnswers };
  }

  const hasMetrics = userAnswers.some(t =>
    /\d+%|\d+x|\$[\d,]+|\d+ (users|customers|months|days|hours|team|people)/.test(t.text));
  const usesI = userAnswers.some(t => /\bI\b/.test(t.text));

  const structureScore = Math.min(100, fallbackScore + (avgAnswerLen > 200 ? 5 : -5) + (hasMetrics ? 8 : -3));
  const commScore = Math.min(100, fallbackScore + (fillerCount < 3 ? 5 : -5) + (avgAnswerLen > 100 ? 3 : -5));

  const skillScores: Record<string, number> = {
    communication: clamp(commScore),
    structure: clamp(structureScore),
    technicalDepth: clamp(fallbackScore + (avgAnswerLen > 300 ? 5 : -5)),
    leadership: clamp(fallbackScore + (usesI ? 3 : -5)),
    problemSolving: clamp(fallbackScore),
    confidence: clamp(fallbackScore + (fillerCount < 2 ? 5 : -8)),
    specificity: clamp(fallbackScore + (hasMetrics ? 10 : -10)),
  };

  return { score, skillScores, hasAnyAnswers };
}

/** Load previous session scores from localStorage for delta-aware feedback */
export function loadPreviousScores(): { overall: number; skills: Record<string, number> } | null {
  try {
    const raw = localStorage.getItem("hirestepx_sessions");
    if (!raw) return null;
    const sessions = JSON.parse(raw);
    if (!Array.isArray(sessions) || sessions.length === 0) return null;
    const prev = sessions[0];
    if (!prev.score || !prev.skill_scores) return null;
    const skills: Record<string, number> = {};
    for (const [k, v] of Object.entries(prev.skill_scores)) {
      skills[k] = typeof v === "number" ? v
        : typeof v === "object" && v !== null && "score" in (v as Record<string, unknown>)
          ? (v as { score: number }).score : 0;
    }
    return { overall: prev.score, skills };
  } catch {
    return null;
  }
}

export interface IdealAnswer {
  question: string;
  ideal: string;
  candidateSummary: string;
  rating?: string;
  starBreakdown?: Record<string, string>;
  workedWell?: string;
  toImprove?: string;
}

export interface ProcessedEvaluation {
  score: number;
  feedback: string;
  skillScores: Record<string, number>;
  idealAnswers: IdealAnswer[];
  starAnalysis?: { overall: number; breakdown: Record<string, number>; tip: string };
  strengths?: string[];
  improvements?: string[];
  nextSteps?: string[];
}

/** Extract numeric score from LLM skill score field (handles both {score: N} objects and raw numbers) */
function extractScore(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "score" in (v as Record<string, unknown>)) {
    return (v as { score: number }).score;
  }
  return 0;
}

/** Process a successful LLM evaluation response into structured result */
export function processLLMEvaluation(
  evaluation: Record<string, unknown>,
  fallbackScore: number,
): ProcessedEvaluation {
  const score = Math.min(100, Math.max(0, (evaluation.overallScore as number) || fallbackScore));
  const feedback = (evaluation.feedback as string) || "";
  const skillScores = evaluation.skillScores && typeof evaluation.skillScores === "object"
    ? Object.fromEntries(Object.entries(evaluation.skillScores as Record<string, unknown>).map(([k, v]) => [k, extractScore(v)]))
    : {};
  const idealAnswers = Array.isArray(evaluation.idealAnswers) ? evaluation.idealAnswers as IdealAnswer[] : [];

  const result: ProcessedEvaluation = { score, feedback, skillScores, idealAnswers };

  if (evaluation.starAnalysis && typeof evaluation.starAnalysis === "object") {
    result.starAnalysis = evaluation.starAnalysis as ProcessedEvaluation["starAnalysis"];
  }
  if (Array.isArray(evaluation.strengths)) result.strengths = evaluation.strengths as string[];
  if (Array.isArray(evaluation.improvements)) result.improvements = evaluation.improvements as string[];
  if (Array.isArray(evaluation.nextSteps)) result.nextSteps = evaluation.nextSteps as string[];

  return result;
}

/* ─── Salary Negotiation Fact Extraction ─── */
/* Scans transcript to extract structured key facts for salary negotiation context.
   These facts anchor the LLM so it references real numbers instead of hallucinating. */

export interface NegotiationFacts {
  /** Whether the candidate accepted the offer outright */
  acceptedImmediately: boolean;
  /** Whether the candidate rejected the offer outright */
  rejectedOutright: boolean;
  /** CTC/salary number the candidate mentioned (e.g., "25 LPA"). This
   *  is the canonical "candidate's ask" — total CTC if differentiated,
   *  otherwise the highest salary figure. */
  candidateCounter: string | null;
  /** Candidate's stated TOTAL/CTC ask, when phrased explicitly as
   *  "total" / "CTC" / "package". Null if not differentiated. */
  candidateAskTotal: string | null;
  /** Candidate's stated BASE-only ask. Null if not differentiated.
   *  Useful for catching anchor drift — the AI must not echo the base
   *  number when the candidate's *total* is what's being negotiated. */
  candidateAskBase: string | null;
  /** Current CTC the candidate disclosed */
  candidateCurrentCTC: string | null;
  /** Whether the candidate mentioned competing offers */
  hasCompetingOffers: boolean;
  /** Amount of a competing offer / in-hand offer the candidate disclosed
   *  (e.g., "₹68 LPA"). DISTINCT from candidateCounter — that's the
   *  candidate's TARGET / ASK; this is their BATNA. The AI was conflating
   *  "I have ₹68 in hand" with "I'm asking for ₹70" and offering the
   *  lower number; surfacing them separately fixes the echo. */
  competingOfferAmount: string | null;
  /** Specific benefits/topics the candidate asked about */
  topicsRaised: string[];
  /** Whether the candidate deflected/refused to share numbers */
  deflectedNumbers: boolean;
  /** Whether the candidate asked for time to think */
  askedForTime: boolean;
  /** Whether the candidate used tactical silence (very short responses at key moments) */
  usedTacticalSilence: boolean;
  /** Whether the candidate mentioned BATNA / walk-away alternative */
  mentionedBATNA: boolean;
  /** Whether the candidate expressed surprise/flinch at the offer */
  expressedSurprise: boolean;
}

export function extractNegotiationFacts(transcript: TranscriptEntry[]): NegotiationFacts {
  const userAnswers = transcript.filter(t => t.speaker === "user").map(t => t.text);
  const allText = userAnswers.join(" ");

  /* Detect unconditional acceptance.
     Two-tier conditional detection (refined 2026-Q2):
       1. Hard conditionals — "if", "unless", "provided", "contingent",
          "only if" — always block acceptance (real negotiation lever).
       2. Soft conditionals — "but", "however" — only block when
          followed by NEGOTIATION verbs (more, higher, increase, raise,
          reduce, change). When followed by INFO-SEEKING verbs (want
          to know, can you tell, what about, could you explain) the
          user is accepting + asking, not negotiating.
     Also dropped the < 15 word limit — "I would like to accept this
     offer. But I would like to know more about benefits" is 16 words
     and was failing the cap. Acceptance length isn't a signal. */
  const acceptedImmediately = userAnswers.some(a => {
    const hasAcceptPattern = /(?:i (?:would like to |want to |'?d like to )?accept(?:\s+(?:this|the|your))?\s*(?:offer)?|sounds good|that works|it.?s a deal|i.?m happy|fine with me|yes.*accept|i agree|let.?s go ahead|happy to accept|would like to accept)/i.test(a);
    /* Two-stage conditional check (refined 2026-Q2):
       1. PRESENCE — any conditional keyword appears in the answer.
       2. EXCEPTION — if the conditional is followed by a polite
          info-seeking pattern ("if you could share / let me know /
          tell me / it's possible to know"), it's NOT a negotiation
          conditional. The user is asking for information, not
          imposing terms.
       Conditionals NOT followed by an info-seeking pattern are
       treated as negotiation levers and block acceptance. */
    const hasAnyConditional = /\b(?:if|unless|provided|on condition|contingent|only\s+if)\b/i.test(a);
    const hasInfoSeekingConditional = /\b(?:if|unless|provided)\s+(?:you|it.?s|i)\s*(?:could|can|may|might|would|don.?t mind)?\s*(?:share|tell|let me know|elaborate|explain|clarify|confirm|provide|walk me through|give me|outline|show)\b/i.test(a);
    const hasHardConditional = hasAnyConditional && !hasInfoSeekingConditional;
    const hasNegotiatingBut = /\b(?:but|however)\s+(?:i\s+)?(?:want|need|would like|would appreciate|expect|require|will need)?\s*(?:more|higher|better|increase|raise|reduce|lower|stretch|change|modify|different|bump|up|further|additional)/i.test(a);
    const hasNegation = /\b(no|not|don.?t|can.?t|won.?t|never)\s+(?:accept|interested|want|going|happy|comfortable|sure)\b/i.test(a);
    return hasAcceptPattern && !hasHardConditional && !hasNegotiatingBut && !hasNegation;
  });

  const rejectedOutright = userAnswers.some(a =>
    /(?:way too low|not interested|can'?t accept|absolutely not|that'?s insulting|no way|i reject|no deal|not acceptable)\b/i.test(a) &&
    !/\b(i accept|sounds good|it.?s a deal)\b/i.test(a),
  );

  // Extract salary numbers: distinguish "current CTC" from "expected/counter" numbers
  // Strategy: first extract current CTC with context patterns, then treat remaining numbers as counter
  const ctcPatterns = /(?:current(?:ly)?|earning|getting|drawing|my ctc|i.?m at|making|take home)\s*(?:is\s*)?₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|l\b)/gi;
  const ctcNumbers = new Set<string>();
  let ctcExec: RegExpExecArray | null;
  while ((ctcExec = ctcPatterns.exec(allText)) !== null) {
    ctcNumbers.add(ctcExec[1]);
  }
  const candidateCurrentCTC = ctcNumbers.size > 0 ? `₹${[...ctcNumbers][ctcNumbers.size - 1]} LPA` : null;

  // Extract ALL salary numbers in INR context, then pick the highest non-CTC number as the counter
  // Require ₹ prefix OR INR-specific suffix (lpa/lakh/cr/crore) — reject $ amounts to avoid USD/INR confusion
  const salaryRe = /(?:₹\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|l\b|cr|crore)?|(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|cr|crore))/gi;
  const allSalaryMatches: string[] = [];
  let salaryMatch: RegExpExecArray | null;
  while ((salaryMatch = salaryRe.exec(allText)) !== null) {
    const rawNum = salaryMatch[1] || salaryMatch[2];
    if (!rawNum) continue;
    // Reject benefit-coded amounts: "₹1 lakh as health insurance" /
    // "₹2 lakhs in joining bonus" / "₹0.5 LPA learning budget" — these
    // are component values the candidate is *itemizing*, not their
    // salary ask. Including them would inflate or deflate the
    // candidateCounter wrongly.
    const ctxStart = Math.max(0, salaryMatch.index - 20);
    const ctxEnd = Math.min(allText.length, salaryMatch.index + salaryMatch[0].length + 40);
    const ctx = allText.slice(ctxStart, ctxEnd);
    if (/\b(?:health|insurance|medical|joining\s+bonus|sign[- ]?on|learning\s+budget|relocation|wfh\s+allowance|conference|tools?\s+stipend|training)\b/i.test(ctx)) continue;
    const isCrore = /cr|crore/i.test(salaryMatch[0]);
    const normalizedNum = isCrore ? String(parseFloat(rawNum) * 100) : rawNum;
    allSalaryMatches.push(normalizedNum);
  }
  // Also capture bare numbers in target/ask context (e.g., "I need 30" without LPA suffix)
  if (allSalaryMatches.length === 0) {
    const bareTargetRe = /(?:expecting|want|need|asking|target|hoping|looking for|around|about|at least|minimum)\s+(?:₹?\s*)?(\d+(?:\.\d+)?)\b/gi;
    let bareMatch: RegExpExecArray | null;
    while ((bareMatch = bareTargetRe.exec(allText)) !== null) {
      const num = parseFloat(bareMatch[1]);
      if (num >= 3 && num <= 200) allSalaryMatches.push(bareMatch[1]);
    }
  }
  // Extract competing-offer / in-hand-offer amount FIRST so we can
  // exclude it from the candidate's target. The AI was conflating "I
  // have ₹68 in hand" with "I'm asking for ₹70" and then anchoring its
  // counter on ₹68 instead of the candidate's actual target. Surface
  // them separately and strip the competing figure from candidateCounter.
  const competingRePre = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|cr|crore)/gi;
  const competingStrings = new Set<string>();
  let cPreMatch: RegExpExecArray | null;
  while ((cPreMatch = competingRePre.exec(allText)) !== null) {
    competingStrings.add(cPreMatch[1]);
  }

  // Filter out numbers that matched as current CTC, then take the MAX as counter
  // Also prefer numbers that appear in target/ask context over generic mentions
  const targetContextRe = /(?:expecting|want|need|asking|target|hoping|looking for|would like|i'd like)\s*(?:₹?\s*)?(\d+(?:\.\d+)?)/gi;
  const targetNums = new Set<string>();
  let tMatch: RegExpExecArray | null;
  while ((tMatch = targetContextRe.exec(allText)) !== null) targetNums.add(tMatch[1]);
  const counterNumbers = allSalaryMatches.filter(n => !ctcNumbers.has(n) && !competingStrings.has(n));
  // Use the LATEST stated target — chronological order is preserved by
  // regex.exec on the joined transcript. Picking the max would lock in
  // the candidate's first ask even after they revise downward
  // ("I want 20" → "I'd settle for 18"); the engine then anchors all
  // subsequent counters to the stale 20, which mis-scores the session.
  const targetCounters = counterNumbers.filter(n => targetNums.has(n));
  const candidateCounter = targetCounters.length > 0
    ? `₹${targetCounters[targetCounters.length - 1]} LPA`
    : counterNumbers.length > 0
    ? `₹${counterNumbers[counterNumbers.length - 1]} LPA`
    : (allSalaryMatches.length > 0 ? `₹${allSalaryMatches[allSalaryMatches.length - 1]} LPA` : null);

  // Differentiate base vs total. "11 lakhs as base salary" / "12 LPA
  // total CTC" — the AI used to collapse total → base ("you mentioned
  // ₹11 LPA" when the candidate said "12 total, 11 base"). Pick out
  // the explicitly-labelled values.
  const totalRe = /(\d+(?:\.\d+)?)\s*(lpa|lakhs?|cr|crore)\s*(?:total|ctc|package|all up|all in|in total|per annum)\b/gi;
  const baseRe = /(\d+(?:\.\d+)?)\s*(lpa|lakhs?|cr|crore)?\s*(?:as\s+(?:my|the)?\s*)?base(?:\s+(?:salary|pay))?\b/gi;
  const totalMatches: number[] = [];
  let totalM: RegExpExecArray | null;
  while ((totalM = totalRe.exec(allText)) !== null) {
    const isCr = /^(cr|crore)$/i.test(totalM[2] || "");
    const v = parseFloat(totalM[1]) * (isCr ? 100 : 1);
    if (Number.isFinite(v) && v >= 3 && v <= 500) totalMatches.push(v);
  }
  const baseMatches: number[] = [];
  let baseM: RegExpExecArray | null;
  while ((baseM = baseRe.exec(allText)) !== null) {
    const isCr = /^(cr|crore)$/i.test(baseM[2] || "");
    const v = parseFloat(baseM[1]) * (isCr ? 100 : 1);
    if (Number.isFinite(v) && v >= 3 && v <= 500) baseMatches.push(v);
  }
  // Latest-stated wins (see candidateCounter rationale above).
  const candidateAskTotal = totalMatches.length > 0 ? `₹${totalMatches[totalMatches.length - 1]} LPA` : null;
  const candidateAskBase = baseMatches.length > 0 ? `₹${baseMatches[baseMatches.length - 1]} LPA` : null;

  const hasCompetingOffers = /(?:other offer|competing|another company|counter.?offer|multiple offers|also talking|got an offer|in[-\s]?hand|already have)/i.test(allText);

  // Extract the AMOUNT of a competing/in-hand offer separately from
  // candidateCounter. Pattern matches "(I have|already have|received|
  // offer of) ₹X LPA in hand" / "competing offer at X LPA" / "X LPA from
  // <company>". Without this, the candidate stating "I have an offer of
  // 68 in hand" pollutes candidateCounter with ₹68 and the AI counters
  // BELOW the candidate's actual target of ₹70.
  const competingRe = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?|cr|crore)/gi;
  const competingNums: number[] = [];
  let cMatch: RegExpExecArray | null;
  while ((cMatch = competingRe.exec(allText)) !== null) {
    const isCr = /^(cr|crore)$/i.test(cMatch[2] || "");
    const v = parseFloat(cMatch[1]) * (isCr ? 100 : 1);
    if (Number.isFinite(v) && v >= 3 && v <= 500) competingNums.push(v);
  }
  const competingOfferAmount = competingNums.length > 0
    ? `₹${competingNums[competingNums.length - 1]} LPA`
    : null;

  // Detect specific topics the candidate raised
  const topicsRaised: string[] = [];
  if (/(?:health|medical|insurance)/i.test(allText)) topicsRaised.push("health insurance");
  if (/(?:esop|equity|stock|rsu|vest)/i.test(allText)) topicsRaised.push("equity/ESOPs");
  if (/(?:remote|wfh|work from home|hybrid|flexible|flexibility)/i.test(allText)) topicsRaised.push("remote/flexibility");
  if (/(?:learning|training|budget|upskill|course)/i.test(allText)) topicsRaised.push("learning budget");
  if (/(?:notice|joining|start date|notice period)/i.test(allText)) topicsRaised.push("notice period/joining");
  if (/(?:relocation|relocat|moving|shift)/i.test(allText)) topicsRaised.push("relocation");
  if (/(?:bonus|joining bonus|sign.?on)/i.test(allText)) topicsRaised.push("joining bonus");
  if (/(?:growth|promotion|career|path)/i.test(allText)) topicsRaised.push("career growth");
  if (/(?:market.*data|market.*rate|benchmark|glassdoor|levels\.fyi|ambition\s*box)/i.test(allText)) topicsRaised.push("market data/benchmarks");
  if (/(?:variable|bonus.*structure|performance.*bonus)/i.test(allText)) topicsRaised.push("variable pay structure");
  if (/(?:title|designation|level)/i.test(allText)) topicsRaised.push("title/level");

  const deflectedNumbers = userAnswers.some(a =>
    /(?:don'?t want to|prefer not|rather not|you first|your offer|what.*you.*offer|tell me.*offer|you tell me)/i.test(a) &&
    allSalaryMatches.length === 0,
  );

  // Detect if candidate asked for time to think (a valid negotiation tactic)
  const askedForTime = userAnswers.some(a =>
    /(?:need time|think about|sleep on|let me think|consider|talk to|get back to you|not ready)/i.test(a),
  );

  // Tactical silence: very short responses (< 10 words) after the first exchange suggest strategic pausing
  // Require at least 2 short responses to distinguish tactical silence from a single laconic answer
  const shortResponseCount = userAnswers.slice(1).filter(a =>
    a.trim().split(/\s+/).length < 10 && !/^(yes|no|okay|sure|fine)\b/i.test(a.trim()),
  ).length;
  const usedTacticalSilence = userAnswers.length > 2 && shortResponseCount >= 2;

  // BATNA: candidate explicitly mentions walk-away alternative or backup plan
  const mentionedBATNA = /(?:walk away|backup|alternative|plan b|best alternative|other option|if we can.?t agree|fall back)/i.test(allText);

  // Flinch/surprise: expressing surprise at the offer level as a tactic
  const expressedSurprise = /(?:lower than.*expect|surprised|was hoping for more|bit of a shock|wasn.?t expecting|quite a gap|far from|disappointing)/i.test(allText);

  return {
    acceptedImmediately,
    rejectedOutright,
    candidateCounter,
    candidateAskTotal,
    candidateAskBase,
    candidateCurrentCTC,
    hasCompetingOffers,
    competingOfferAmount,
    topicsRaised,
    deflectedNumbers,
    askedForTime,
    usedTacticalSilence,
    mentionedBATNA,
    expressedSurprise,
  };
}
