/* ─── Interview Micro-Feedback ─── */
/* Pure function: given an answer and interview type, returns instant micro-feedback
   and a numeric quality score for difficulty tracking. Extracted from useInterviewEngine. */

export interface MicroFeedbackResult {
  feedback: string | null;
  score: number;
}

export function computeMicroFeedback(
  answerText: string,
  interviewType: string,
  runningScores: number[],
  negotiationPhase?: string,
  recentFeedbacks?: string[],
): MicroFeedbackResult {
  const wordCount = answerText.trim().split(/\s+/).length;

  if (interviewType === "salary-negotiation") {
    return salaryNegFeedback(answerText, wordCount, negotiationPhase);
  }
  if (interviewType === "government-psu") {
    return govPsuFeedback(answerText, wordCount);
  }
  if (interviewType === "case-study") {
    return caseStudyFeedback(answerText, wordCount);
  }
  if (interviewType === "hr-round") {
    return hrRoundFeedback(answerText, wordCount);
  }
  if (interviewType === "management") {
    return managementFeedback(answerText, wordCount);
  }
  if (interviewType === "campus-placement") {
    return campusPlacementFeedback(answerText, wordCount);
  }
  return standardFeedback(answerText, wordCount, runningScores, recentFeedbacks);
}

/* ─── Salary Negotiation (phase-aware) ─── */
function salaryNegFeedback(text: string, wordCount: number, phase?: string): MicroFeedbackResult {
  const mentionsNumber = /₹|lakh|lpa|lakhs|\d+\s*l(?:pa|akh)/i.test(text);
  const mentionsBenefits = /benefit|esop|equity|bonus|flexible|remote|insurance|learning|budget/i.test(text);
  const mentionsEquityVague = /esop|equity|stock|option|vest/i.test(text) && !/₹|\d+\s*(?:lakh|lpa|%)/i.test(text);
  const mentionsCompeting = /other offer|competing|another company|counter/i.test(text);
  const mentionsResearch = /market|glassdoor|research|benchmark|industry|average|range|data/i.test(text);
  const acceptsImmediately = /(?:sounds good|i accept|that works|deal|perfect|okay sure|fine with me|yes.*accept)/i.test(text) && wordCount < 25;
  const rejectsOutright = /(?:way too low|not interested|can'?t accept|wouldn'?t consider|absolutely not|that'?s insulting|no way)/i.test(text);
  // Candidate signalling "you already asked / I already answered". Generic
  // tips like "share more detail" feel mocking on top of this — replace
  // with an empathic coaching note.
  const showsFrustration = /\b(already (?:mentioned|said|told)|as i (?:said|mentioned|told)|told you|mentioned (?:multiple times|earlier|before)|for the (?:second|third|fourth|nth) time)\b/i.test(text);

  let feedback: string | null = null;
  if (showsFrustration) {
    return {
      feedback: "You're being heard — repetition is a fair signal. If the AI keeps probing, push for a number: 'What's your counter?'",
      score: 60,
    };
  }

  // Universal checks first (override phase-specific)
  if (rejectsOutright && wordCount < 30) {
    feedback = "Tip: Stay open and professional — counter with data, don't reject outright.";
  } else if (acceptsImmediately) {
    feedback = phase === "closing"
      ? "Tip: Before accepting, confirm all terms — base, bonus, equity, start date."
      : "Tip: Don't accept too quickly — explore the full package first.";
  } else if (wordCount > 100) {
    feedback = "Tip: Keep negotiation points concise — 2-3 sentences per response works best.";
  } else if (wordCount < 15) {
    feedback = mentionsNumber
      ? "Tip: Elaborate on your reasoning — why that number? What's your basis?"
      : "Tip: Share more detail — what are your expectations and reasoning?";
  }
  // Phase-specific feedback
  else if (phase === "offer-reaction") {
    if (mentionsNumber) {
      feedback = "Tip: In the offer phase, listen first — don't counter yet. Ask about the full package.";
    } else if (mentionsBenefits) {
      feedback = "Smart — asking about the full package before reacting to numbers.";
    } else {
      feedback = "Good — stay curious. Ask about equity, bonuses, and growth before countering.";
    }
  } else if (phase === "probe-expectations") {
    if (mentionsResearch) {
      feedback = "Strong — backing your expectations with market research builds credibility.";
    } else if (mentionsNumber && !mentionsResearch) {
      feedback = "Good anchor! Strengthen with market data — 'based on Glassdoor/industry benchmarks...'";
    } else {
      feedback = "Tip: Share a specific number backed by research — vague expectations are weaker.";
    }
  } else if (phase === "counter-offer") {
    if (mentionsNumber && mentionsCompeting) {
      feedback = "Strong counter — specific number plus leverage from competing offers.";
    } else if (mentionsNumber) {
      feedback = "Good counter! Mention why — market data, competing offers, or unique value you bring.";
    } else if (mentionsCompeting) {
      feedback = "Good leverage. Now state your specific number to anchor the negotiation.";
    } else {
      feedback = "Tip: State a specific counter-offer — 'Based on X, I'd need ₹Y LPA.'";
    }
  } else if (phase === "benefits-discussion") {
    if (mentionsBenefits && mentionsNumber) {
      feedback = "Excellent — negotiating total comp with specific numbers on benefits.";
    } else if (mentionsBenefits) {
      feedback = "Good topic! Push for specifics — 'What's the equity vesting schedule?' or 'How much is the joining bonus?'";
    } else if (mentionsEquityVague) {
      feedback = "Good interest in equity! Ask for the vesting schedule and annual value in ₹.";
    } else {
      feedback = "Tip: This is the time for total comp — equity, bonus, flexibility, learning budget.";
    }
  } else if (phase === "closing-pressure") {
    if (mentionsCompeting) {
      feedback = "Using leverage well. Stay firm but professional.";
    } else {
      feedback = "Closing phase — anchor on your BATNA / market data; don't drop your number without getting something in return.";
    }
  } else if (phase === "closing") {
    if (mentionsBenefits && mentionsNumber) {
      feedback = "Strong close — confirming both comp and benefits. Get everything in writing.";
    } else {
      feedback = "Tip: Confirm all terms explicitly — base, bonus, equity, start date, notice period.";
    }
  }
  // Fallback (no phase info)
  else if (mentionsEquityVague) {
    feedback = "Good interest in equity! Ask for the vesting schedule and annual value in ₹.";
  } else if (mentionsNumber && !mentionsBenefits) {
    feedback = "Good anchor! Consider discussing beyond base — benefits, equity, flexibility.";
  } else if (mentionsBenefits && mentionsNumber) {
    feedback = "Strong negotiation — covering both compensation and package elements.";
  } else if (mentionsCompeting) {
    feedback = "Using leverage well. Be careful not to bluff — stay credible.";
  } else if (wordCount >= 30) {
    feedback = "Good response — clear and substantive.";
  }

  let score = 50;
  if (mentionsNumber) score += 15;
  if (mentionsBenefits) score += 15;
  if (mentionsResearch) score += 10;
  if (wordCount >= 30) score += 10;
  if (!acceptsImmediately && !rejectsOutright) score += 10;
  if (rejectsOutright) score -= 10;
  if (wordCount < 15) score -= 15;
  return { feedback, score: clamp(score) };
}

/* ─── Government / PSU ─── */
function govPsuFeedback(text: string, wordCount: number): MicroFeedbackResult {
  const mentionsPolicy = /policy|scheme|act|bill|amendment|article|constitution|nep|dpdp|rti|panchayat|niti aayog|budget/i.test(text);
  const mentionsEthics = /ethic|integrity|transparen|accountab|corrupt|honest|impartial|fair|justice|public interest/i.test(text);
  const isBalanced = /however|on the other hand|while|although|both|balance|trade-?off|at the same time/i.test(text);
  const mentionsGovt = /government|ministry|department|district|collector|ias|ips|upsc|commission|committee|parliament/i.test(text);

  let score = 50;
  if (wordCount >= 50) score += 10;
  if (mentionsPolicy) score += 15;
  if (mentionsEthics) score += 10;
  if (isBalanced) score += 10;
  if (mentionsGovt) score += 5;
  if (wordCount < 30) score -= 15;

  let feedback: string | null;
  if (wordCount < 30) {
    feedback = "Elaborate more — government interviews expect detailed, well-reasoned answers.";
  } else if (!mentionsPolicy && !mentionsEthics) {
    feedback = "Tip: Reference specific policies, schemes, or constitutional provisions to strengthen your answer.";
  } else if (!isBalanced) {
    feedback = "Good points! Present a balanced perspective — acknowledge trade-offs and multiple viewpoints.";
  } else if (mentionsPolicy && isBalanced) {
    feedback = "Strong answer — policy-aware and balanced. Well articulated.";
  } else {
    feedback = "Good response — clear reasoning and relevant context.";
  }
  return { feedback, score: clamp(score) };
}

/* ─── Case Study ─── */
function caseStudyFeedback(text: string, wordCount: number): MicroFeedbackResult {
  const hasFramework = /framework|hypothesis|assumption|estimate|segment|prioriti|trade-?off|constraint|root cause|funnel|cohort|a\/b test/i.test(text);
  const hasStructure = /first|second|third|step \d|approach.*would be|i would start/i.test(text);
  const hasData = /\d+%|\d+x|₹[\d,]+|\$[\d,]+|\d+ (users|customers|million|crore|lakh)/i.test(text);
  const hasRecommendation = /recommend|suggest|conclusion|therefore|my proposal|i would choose|the best option/i.test(text);

  let score = 50;
  if (wordCount >= 50) score += 10;
  if (hasFramework) score += 15;
  if (hasStructure) score += 10;
  if (hasData) score += 10;
  if (hasRecommendation) score += 5;
  if (wordCount < 30) score -= 15;

  let feedback: string | null;
  if (wordCount < 30) {
    feedback = "Case studies need structured thinking — walk through your approach step by step.";
  } else if (!hasFramework && !hasStructure) {
    feedback = "Tip: Structure your answer — state your hypothesis, break down the problem, then recommend.";
  } else if (!hasData && hasStructure) {
    feedback = "Good structure! Strengthen with data estimates or metrics to support your reasoning.";
  } else if (!hasRecommendation) {
    feedback = "Good analysis! Close with a clear recommendation and expected impact.";
  } else if (hasFramework && hasData) {
    feedback = "Excellent — structured, data-backed, with a clear recommendation.";
  } else {
    feedback = "Good analysis — logical and well-reasoned.";
  }
  return { feedback, score: clamp(score) };
}

/* ─── HR Round ─── */
function hrRoundFeedback(text: string, wordCount: number): MicroFeedbackResult {
  const showsSelfAwareness = /strength|weakness|learned|realized|improved|growth|feedback|reflect/i.test(text);
  const showsMotivation = /passion|motivat|excit|interest|driven|purpose|goal|aspir|value/i.test(text);
  const showsCulturalFit = /team|collaborat|culture|value|inclusive|diverse|together|support/i.test(text);
  const isAuthentic = /honestly|personally|I believe|I feel|for me|in my experience/i.test(text);
  const hasFirstPerson = /\bI\b/.test(text);

  let score = 50;
  if (wordCount >= 40) score += 10;
  if (showsSelfAwareness) score += 15;
  if (showsMotivation) score += 10;
  if (showsCulturalFit) score += 5;
  if (isAuthentic) score += 5;
  if (hasFirstPerson) score += 5;
  if (wordCount < 25) score -= 15;

  let feedback: string | null;
  if (wordCount < 25) {
    feedback = "HR rounds value thoughtful answers — share your genuine perspective and reasoning.";
  } else if (!showsSelfAwareness && !showsMotivation) {
    feedback = "Tip: Show self-awareness — reflect on what drives you and how you've grown.";
  } else if (!showsCulturalFit) {
    feedback = "Good answer! Connect it to teamwork or the company's values for cultural fit.";
  } else if (showsSelfAwareness && showsMotivation) {
    feedback = "Great — authentic, self-aware, and clearly motivated.";
  } else {
    feedback = "Good answer — genuine and well-articulated.";
  }
  return { feedback, score: clamp(score) };
}

/* ─── Management ─── */
function managementFeedback(text: string, wordCount: number): MicroFeedbackResult {
  const mentionsPeople = /team|report|member|hire|coach|mentor|delegate|1[:-]1|one-on-one|performance|feedback/i.test(text);
  const mentionsScale = /\d+\s*(people|engineers|reports|members|team)|scaled|grew|built.*team/i.test(text);
  const hasOutcome = /result|outcome|impact|improved|reduced|achieved|delivered|shipped/i.test(text);
  const mentionsProcess = /process|framework|standup|retro|sprint|okr|kpi|metric|cadence|ritual/i.test(text);

  let score = 50;
  if (wordCount >= 50) score += 10;
  if (mentionsPeople) score += 15;
  if (mentionsScale) score += 10;
  if (hasOutcome) score += 10;
  if (mentionsProcess) score += 5;
  if (wordCount < 30) score -= 15;

  let feedback: string | null;
  if (wordCount < 30) {
    feedback = "Management answers need depth — describe your approach and its impact on the team.";
  } else if (!mentionsPeople) {
    feedback = "Tip: Center on people — how did your approach affect your team, reports, or stakeholders?";
  } else if (!mentionsScale && !hasOutcome) {
    feedback = "Good people focus! Add team size and measurable outcomes to show impact.";
  } else if (mentionsPeople && hasOutcome) {
    feedback = "Strong — people-focused with clear outcomes. Well articulated.";
  } else {
    feedback = "Good answer — clear leadership thinking.";
  }
  return { feedback, score: clamp(score) };
}

/* ─── Campus Placement ─── */
function campusPlacementFeedback(text: string, wordCount: number): MicroFeedbackResult {
  const mentionsProject = /project|built|developed|created|designed|implemented|hackathon|internship/i.test(text);
  const hasLearning = /learned|realized|taught me|takeaway|improved|grew|mistake|challenge/i.test(text);
  const hasClarity = /because|reason|approach|decided|goal|objective/i.test(text);
  const hasFirstPerson = /\bI\b/.test(text);

  let score = 50;
  if (wordCount >= 40) score += 10;
  if (mentionsProject) score += 15;
  if (hasLearning) score += 10;
  if (hasClarity) score += 10;
  if (hasFirstPerson) score += 5;
  if (wordCount < 20) score -= 10;

  let feedback: string | null;
  if (wordCount < 20) {
    feedback = "Try to say a bit more — even briefly describing your approach helps.";
  } else if (!mentionsProject && !hasLearning) {
    feedback = "Tip: Reference a specific project or experience — concrete examples are powerful.";
  } else if (!hasLearning) {
    feedback = "Good example! Share what you learned or how the experience shaped your thinking.";
  } else if (mentionsProject && hasLearning) {
    feedback = "Great answer — specific, reflective, and shows your growth mindset.";
  } else {
    feedback = "Good answer — clear and well-communicated.";
  }
  return { feedback, score: clamp(score) };
}

/* Detects answers that are explicit non-attempts ("I don't have experience",
   "not sure about it", "haven't faced anything like that"). Generic tips like
   "Stretch this further — give us the context and the outcome" gaslight the
   candidate when they've already said they have nothing to draw on. We
   acknowledge it instead and skip the score penalty. */
function detectNonAnswer(text: string, wordCount: number): boolean {
  if (wordCount > 60) return false;
  const t = text.toLowerCase();
  const patterns: RegExp[] = [
    /\b(?:i\s+)?(?:do\s+not|don'?t|have\s+not|haven'?t)\s+(?:have|got)\s+(?:any\s+)?(?:experience|exposure|example)/,
    /\b(?:no|zero|never\s+had)\s+(?:real\s+)?experience\b/,
    /\bnot\s+(?:really\s+|100%?\s+|entirely\s+|quite\s+)?sure\b.*\b(?:about|on)\s+(?:it|this|that|the\s+(?:answer|strateg|approach))/,
    /\b(?:have\s+not|haven'?t|never)\s+faced\b/,
    /\bnever\s+(?:done|encountered|been\s+in)\b/,
    /\b(?:can'?t|cannot|could\s*not|couldn'?t)\s+(?:think|recall|remember)\s+(?:of\s+)?(?:any|a\s+specific|one)\b/,
    /\bnothing\s+comes\s+to\s+mind\b/,
    /\bnot\s+applicable\b|\bn\/?a\b/,
    /\bskip\s+this\b|\bpass\s+on\s+this\b/,
  ];
  return patterns.some((re) => re.test(t));
}

/* ─── Standard (behavioral / technical / strategic / panel) ─── */
function standardFeedback(text: string, wordCount: number, runningScores: number[], recentFeedbacks?: string[]): MicroFeedbackResult {
  if (detectNonAnswer(text, wordCount)) {
    // Empathic acknowledgement, no STAR-coaching tip. Score reflects
    // a non-answer (low) but doesn't crater the running average — the
    // candidate was honest, not lazy.
    return {
      feedback: "No experience here is fine — try a hypothetical, or pivot to the closest situation you've handled.",
      score: 35,
    };
  }
  const hasMetrics = /\d+%|\$\d|[0-9]+x|[0-9]+ (users|customers|engineers|people)/i.test(text);
  const hasStructure = /first|second|then|finally|result|outcome|impact/i.test(text);
  const hasFirstPerson = /\bI\b/i.test(text);
  const hasCounterfactual = /without|otherwise|if.*not|had.*not|wouldn't/i.test(text);

  /* Lightweight STAR-component detection. Used to tell the candidate
     WHICH part of the story they skipped, instead of a generic
     "structure with STAR" tip. Heuristics:
       Situation = setting markers (when/where/at <company>/in 20XX/we were)
       Task      = problem markers (challenge/needed to/asked to/had to/goal)
       Action    = first-person verbs (I built/I led/I designed/I shipped)
       Result    = outcome markers (resulted in/which led to/we saw/by N%/<metric>)
     A long answer that only matches Situation+Task and skips Action/Result
     is the most common failure — the inline tip should call that out. */
  const hasSituation = /\bat\s+(?:my\s+last|my\s+previous|my\s+current)?\s*(?:company|job|role|team|firm)\b|\bwhen\s+(?:i|we)\b|\bin\s+(?:20\d\d|q[1-4])\b|\bduring\s+(?:my|the)\b|\bwe\s+were\s+\b/i.test(text);
  const hasTask = /\b(?:the\s+(?:challenge|problem|goal|task|ask|brief)|needed\s+to|had\s+to|was\s+(?:asked|tasked)\s+to|the\s+target\s+was|our\s+goal\s+was|the\s+brief\s+was)\b/i.test(text);
  const hasAction = /\bi\s+(?:built|designed|shipped|led|drove|created|wrote|made|fixed|launched|coordinated|negotiated|trained|coached|presented|prototyped|tested|migrated|refactored|architected|implemented|defined|aligned|escalated|prioriti[sz]ed|de[\s-]?risked|set\s+up|put\s+together|reached\s+out)\b/i.test(text);
  const hasResult = hasMetrics || /\bresult(?:ed|ing)?\b|\bwhich\s+led\s+to\b|\bwhich\s+drove\b|\bso\s+that\b|\bwe\s+saw\b|\bafter\s+(?:that|launch)\b|\bin\s+the\s+end\b|\boutcome\b|\bimpact\b|\bby\s+\d+/i.test(text);
  const starCount = [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length;

  let score = 50;
  if (wordCount >= 50) score += 10;
  if (wordCount >= 100) score += 5;
  if (hasMetrics) score += 15;
  if (hasStructure) score += 10;
  if (hasFirstPerson) score += 5;
  if (hasCounterfactual) score += 5;
  if (wordCount < 30) score -= 15;

  const allScores = [...runningScores, clamp(score)];
  const runningAvg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 50;
  const isExcelling = runningAvg >= 80 && allScores.length >= 2;
  const isStruggling = runningAvg < 50 && allScores.length >= 2;
  // Rotate among variants so consecutive answers don't get identical coaching.
  // recentFeedbacks: the last few tips actually shown to the candidate. If
  // the round-robin would re-pick a recent tip, advance until we land on a
  // fresh one. Avoids "Stretch this further" appearing 3 questions running.
  const turn = runningScores.length;
  const recentSet = new Set((recentFeedbacks || []).filter((s): s is string => typeof s === "string"));
  const pick = <T,>(opts: readonly T[]): T => {
    if (opts.length === 0) return opts[0];
    let idx = turn % opts.length;
    for (let tries = 0; tries < opts.length; tries++) {
      const candidate = opts[idx];
      if (typeof candidate !== "string" || !recentSet.has(candidate)) return candidate;
      idx = (idx + 1) % opts.length;
    }
    return opts[turn % opts.length];
  };

  let feedback: string | null;
  if (wordCount < 30) {
    feedback = isStruggling
      ? pick([
          "Try to say more — even 2-3 sentences about the situation helps.",
          "Add a bit more — set the scene, what you did, what happened.",
        ])
      : pick([
          "Try to elaborate more — aim for 60+ seconds per answer.",
          "Stretch this further — give us the context and the outcome.",
        ]);
  } else if (!hasMetrics && !hasStructure) {
    /* STAR-component-aware: when ≥ 30 words and clearly missing one of
       Action/Result, name the missing piece instead of a generic STAR
       tip. Helps the candidate self-correct on the next answer. */
    if (wordCount >= 40 && starCount >= 2 && !hasAction) {
      feedback = pick([
        "You set the scene well — what did *you* do? Lead with 'I' verbs.",
        "Good context. Walk me through your specific actions, not the team's.",
      ]);
    } else if (wordCount >= 40 && starCount >= 2 && !hasResult) {
      feedback = pick([
        "Nice setup and action — close with the outcome. What changed?",
        "Strong action. End with the result: what shifted, by how much?",
      ]);
    } else if (wordCount >= 40 && hasAction && !hasSituation && !hasTask) {
      feedback = pick([
        "Jumped straight to the action — set the scene first (when/where/why).",
        "Strong on what you did — anchor it with the situation and the goal.",
      ]);
    } else {
      feedback = isExcelling
        ? pick([
            "Good content — push further with specific metrics and counterfactual reasoning.",
            "Strong substance — quantify the impact and contrast against the alternative.",
          ])
        : pick([
            "Good start! Try adding specific metrics and structuring with STAR.",
            "Solid answer — anchor it with numbers and a clear Situation→Action→Result.",
            "Nice content. Add 'who, how many, by how much' to make it land harder.",
          ]);
    }
  } else if (!hasMetrics) {
    feedback = isExcelling
      ? pick([
          "Nice structure! Add quantified impact — '$X revenue', '30% faster', etc.",
          "Clean structure. Drop in a metric to anchor the impact.",
        ])
      : pick([
          "Nice structure! Strengthen with specific numbers or metrics.",
          "Good flow — pin it down with a number ('reduced by 40%', '2 weeks faster').",
          "Well-organized. A single metric would lift this from good to memorable.",
        ]);
  } else if (!hasStructure) {
    feedback = pick([
      "Great data! Try structuring as Situation → Action → Result.",
      "Numbers are strong — frame them with what you did and what changed.",
    ]);
  } else if (isExcelling && !hasCounterfactual) {
    feedback = "Strong answer! Next level: add counterfactual reasoning — 'Without this, X would have happened.'";
  } else {
    feedback = isExcelling
      ? pick([
          "Excellent — specific, structured, and impactful.",
          "Top-band answer — concrete, well-paced, real outcome.",
        ])
      : pick([
          "Strong answer — specific and well-structured.",
          "Well done — clear arc and concrete details.",
        ]);
  }
  return { feedback, score: clamp(score) };
}

function clamp(score: number): number {
  return Math.min(100, Math.max(0, score));
}
