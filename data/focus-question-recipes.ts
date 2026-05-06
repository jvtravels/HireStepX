/**
 * Focus-specific question recipes.
 *
 * Each interview focus gets a recipe that tells the LLM:
 *   - Which CategoryKeys to draw from (mandatory + optional)
 *   - The arc/sequence shape (Q1 warm → QN signature)
 *   - Trap-question budget (some focuses use them; others don't)
 *   - Whether candidate-asks-back is part of the closing flow
 *
 * Recipes are translated to a prompt-fragment by formatRecipe()
 * which ships with the focus's TYPE_GUIDANCE in generate-questions.
 *
 * Why centralised vs hard-coded in generate-questions: when we add a
 * new focus type (e.g. "case-study-mini") we want one place to
 * declare its question mix. And the recipes are unit-testable.
 */

import { CATEGORIES, type CategoryKey } from "./question-taxonomy";

export interface FocusRecipe {
  /** Human label for prompt header. */
  label: string;
  /** Category keys that MUST appear in the question set, in roughly this order. */
  mandatory: CategoryKey[];
  /** Category keys that MAY be drawn from to fill remaining slots. */
  optional: CategoryKey[];
  /** Trap-question slots — 0 = none, 1 = at most one, 2 = up to two. */
  trapBudget: 0 | 1 | 2;
  /** True if the closing turn should explicitly invite candidate questions
   *  (and the AI should be ready to answer them). */
  inviteCandidateQuestions: boolean;
  /** Optional one-liner about pacing / depth that supplements TYPE_GUIDANCE. */
  pacingNote?: string;
  /** Focus-specific scoring rubric. Injected into the evaluation
   *  prompt so the LLM scores against the dimensions that actually
   *  matter for this focus — case-study scores MECE, technical
   *  scores trade-off articulation, behavioral scores STAR
   *  completeness. Each entry is a single dimension + 1-line
   *  description. The eval LLM uses these to compute per-dimension
   *  scores in addition to the overall score. */
  scoringRubric?: { dimension: string; description: string; weight: number }[];
}

/** Map of focus → recipe. Keys match `interviewType` in generate-questions.ts. */
export const RECIPES: Record<string, FocusRecipe> = {
  /* ─── Behavioral (general) ─── */
  behavioral: {
    label: "Behavioral",
    mandatory: ["opening-resume", "experience-deepdive", "ownership", "collaboration", "problem-solving"],
    optional: ["communication", "leadership", "decision-making", "pressure-resilience", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Q1 is opening (low-stakes), Q2 is the deep-dive on a real project, Q3-4 mix collaboration/problem-solving with one optional, Q5 is the signature stretch — failure, judgement, or trade-off.",
    scoringRubric: [
      { dimension: "STAR completeness", description: "Did the candidate name a Situation, the Task they owned, the Action they took, and the Result/metric? Penalise when they describe a 'team result' without their specific contribution.", weight: 0.25 },
      { dimension: "Specific evidence", description: "Did the answer include a real metric, a named decision, a stakeholder name (or proxy), or a date? Generic 'we improved performance' without numbers = weak.", weight: 0.20 },
      { dimension: "Ownership signal", description: "Does the candidate own outcomes — including failures — or distribute blame? 'I' vs. 'we' ratio and willingness to name a real mistake.", weight: 0.20 },
      { dimension: "Reflection / learning", description: "Did they articulate what they'd do differently, in concrete terms? 'Better communication' = weak; 'I'd run a 30-min pre-mortem in week 1' = strong.", weight: 0.15 },
      { dimension: "Communication clarity", description: "Was the answer structured, on-time (60-180s), and free of filler/jargon? Long meandering answers without a takeaway = weak.", weight: 0.20 },
    ],
  },

  /* ─── HR Round (Indian context) ─── */
  "hr-round": {
    label: "HR round",
    mandatory: ["opening-resume", "hr-essentials", "culture-fit", "salary-practical"],
    optional: ["pressure-resilience", "communication", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "At least TWO HR-essentials (current/expected CTC, notice period, why leaving, gap explanation, why us). At least ONE culture-fit. The trap question, if used, should target rehearsed answers (fake weakness, generic 'why us').",
    scoringRubric: [
      { dimension: "Motivation specificity", description: "Did 'why this role' / 'why this company' include something specific (a recent product launch, a leader they've followed, a domain they want to go deeper on)? Or was it generic 'great culture'?", weight: 0.25 },
      { dimension: "Self-awareness", description: "On weaknesses / failures, did they name something real — something a manager has actually given them feedback on — or rehearse a humble-brag (perfectionist, work too hard)?", weight: 0.20 },
      { dimension: "Practical clarity", description: "On CTC / notice / availability / counter-offers — clear, honest answers with rationale, not evasion. A candidate who can articulate WHY they're asking for a specific number reads as serious.", weight: 0.20 },
      { dimension: "Switch-rationale honesty", description: "On 'why are you leaving', did they articulate a concrete push (career, scope, manager, market) without bad-mouthing? Or vague 'looking for growth'?", weight: 0.15 },
      { dimension: "Cultural fit signal", description: "Do their stated non-negotiables and working preferences align plausibly with the target company's known culture?", weight: 0.20 },
    ],
  },

  /* ─── Management / Managerial / cross-functional ───
     The UI dispatches "Management" → key "management"; we keep the
     "managerial" alias for legacy callers. Both resolve to this
     recipe (shared body via reference at the bottom of this file). */
  management: {
    label: "Management",
    mandatory: ["managerial", "leadership", "decision-making", "experience-deepdive"],
    optional: ["communication", "ownership", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Focus on planning, escalation, stakeholder handling, decision rationale. At least ONE 'first 30 days' or 'business impact' question. At least ONE question on managing AI-augmented teams (how they decide where AI tooling helps vs. dilutes craft).",
    scoringRubric: [
      { dimension: "Decision framing", description: "Did the candidate frame decisions with explicit options + trade-offs + one chosen + WHY? Or did they describe the outcome only (the easy half)?", weight: 0.25 },
      { dimension: "Stakeholder navigation", description: "Concrete moments where they handled conflicting agendas — named the friction, the negotiation, and the landing. 'I aligned the team' = weak.", weight: 0.20 },
      { dimension: "Escalation discipline", description: "Did they escalate WITH a recommendation, not just a problem? Did they manage up clearly?", weight: 0.15 },
      { dimension: "Performance management", description: "Real moments of giving difficult feedback, handling underperformance, or naming a hire mistake. 'I motivate the team' = weak.", weight: 0.20 },
      { dimension: "AI-augmented team thinking", description: "Did they articulate where AI tooling helps their team vs. where it dilutes craft, with concrete examples? 2026 standard.", weight: 0.20 },
    ],
  },
  /* Legacy alias — older code may still ship "managerial". */
  managerial: {
    label: "Management",
    mandatory: ["managerial", "leadership", "decision-making", "experience-deepdive"],
    optional: ["communication", "ownership", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Focus on planning, escalation, stakeholder handling, decision rationale. At least ONE 'first 30 days' or 'business impact' question. At least ONE question on managing AI-augmented teams.",
    scoringRubric: [
      { dimension: "Decision framing", description: "Options + trade-offs + chosen + why.", weight: 0.25 },
      { dimension: "Stakeholder navigation", description: "Concrete conflict moments with resolution.", weight: 0.20 },
      { dimension: "Escalation discipline", description: "Escalates with recommendations, not problems.", weight: 0.15 },
      { dimension: "Performance management", description: "Real moments of feedback / underperformance / hiring mistakes.", weight: 0.20 },
      { dimension: "AI-augmented team thinking", description: "Articulates where AI helps vs. dilutes their team's craft.", weight: 0.20 },
    ],
  },

  /* ─── Strategic (vision + alignment + outcomes) ─── */
  strategic: {
    label: "Strategic",
    mandatory: ["decision-making", "leadership", "experience-deepdive", "communication"],
    optional: ["customer-user", "adaptability-learning", "ownership"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Q1 opening, Q2 a 3-year vision-setting moment they led, Q3 multi-stakeholder alignment under conflict, Q4 a strategic bet that failed and what changed, Q5 closing. Reward second-order thinking — push back on first-order answers.",
    scoringRubric: [
      { dimension: "Second-order thinking", description: "Did they articulate consequences-of-consequences? 'If we ship X, then Y team has to absorb Z, which means we'd need ABC' — strong. 'X will improve metric Y' alone — weak.", weight: 0.25 },
      { dimension: "Vision specificity", description: "Did they state a concrete 3-year vision with measurable milestones, not abstractions like 'be the leader in our space'?", weight: 0.20 },
      { dimension: "Trade-off honesty", description: "Did they name what they GAVE UP for the strategic bet — opportunity cost, team trust, brand risk? Or just 'we won big'?", weight: 0.20 },
      { dimension: "Alignment work", description: "Concrete steps to align dissenting stakeholders. Naming the dissenter and the conversation — strong. 'I built consensus' — weak.", weight: 0.20 },
      { dimension: "Failed-bet reflection", description: "Did the failed strategic bet story include a real cost owned, not externalised? And a behaviour change since?", weight: 0.15 },
    ],
  },

  /* ─── Technical / Technical Leadership ─── */
  technical: {
    label: "Technical Leadership",
    mandatory: ["problem-solving", "decision-making", "experience-deepdive", "leadership"],
    optional: ["communication", "ownership", "adaptability-learning"],
    trapBudget: 0,
    inviteCandidateQuestions: true,
    pacingNote: "Architecture trade-offs, debugging at scale, system rewrites, on-call and incident response. Probe AI-assisted development discipline (Cursor / Copilot / Claude Code) — 2026 candidates should articulate WHEN they trust AI output and when they verify by hand. At least ONE failure-mode + recovery question.",
    scoringRubric: [
      { dimension: "Trade-off articulation", description: "Every architectural decision should have an articulated trade-off. 'We picked X because Y' is half-credit; 'We picked X because Y, knowing it cost us Z which we accepted because W' is full.", weight: 0.30 },
      { dimension: "Failure-mode reasoning", description: "Did they think in terms of failure modes — what breaks at 10x, where the latency budget actually goes, who's on-call? Or did they describe the happy path only?", weight: 0.25 },
      { dimension: "Scale calibration", description: "Their answers should be calibrated to the system's actual scale. Don't claim Kafka where SQS works, don't claim sharding for a 10K-row table. Over-engineering = weak signal.", weight: 0.15 },
      { dimension: "AI-tooling discipline", description: "Did they articulate WHEN they trust AI output (boilerplate, syntax, refactors with tests) vs. WHEN they verify by hand (security-sensitive code, novel algorithms, system boundaries)? 2026 standard.", weight: 0.15 },
      { dimension: "Code-review judgment", description: "Concrete moments of catching real bugs in PR review, or of being overruled and what they did. Pattern-recognition from real systems = strong.", weight: 0.15 },
    ],
  },

  /* ─── Government / PSU ───
     Different evaluation lens entirely. Reward ethics, public-interest
     reasoning, structured situational judgment. Skip behavioural-tech
     framing. */
  "government-psu": {
    label: "Government / PSU",
    mandatory: ["culture-fit", "decision-making", "communication", "experience-deepdive"],
    optional: ["ownership", "pressure-resilience"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "At least ONE current-affairs / public-policy question relevant to the posting. At least ONE ethical dilemma (corruption pressure, due-process vs. speed, public-interest vs. directive). DAF-style biographical cross-questioning encouraged — probe hometown, hobbies, college specifics. Skip product/customer-user category.",
    scoringRubric: [
      { dimension: "Ethical reasoning structure", description: "On dilemmas, did they map stakeholders, name the principle in tension (efficiency vs. due process, public good vs. political directive), and reason transparently? Or jump to a 'right' answer?", weight: 0.30 },
      { dimension: "Public-service motivation", description: "Genuine articulation of WHY public service vs. private — concrete experiences, not platitudes about 'serving the nation'.", weight: 0.20 },
      { dimension: "Current-affairs depth", description: "On policy / current-affairs questions: did they show working knowledge (not headline-level), name actors and acts, and articulate a position?", weight: 0.20 },
      { dimension: "Biographical specificity", description: "On DAF-style cross-questioning (hometown, hobby, college), did the candidate provide specific, verifiable detail? Vague answers signal rehearsed prep.", weight: 0.15 },
      { dimension: "Composure under pressure", description: "Held their position when pushed without breaking; conceded when wrong without panic.", weight: 0.15 },
    ],
  },

  /* ─── Panel ─── */
  panel: {
    label: "Panel",
    mandatory: ["opening-resume", "experience-deepdive", "leadership", "decision-making"],
    optional: ["problem-solving", "collaboration", "communication", "culture-fit"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Distribute categories across the three personas: Hiring Manager → leadership/decision/strategic, Technical Lead → problem-solving/experience-deepdive, HR Partner → collaboration/culture-fit/communication.",
    scoringRubric: [
      { dimension: "Multi-audience adaptation", description: "Did the candidate ADJUST their answer for each persona — depth+jargon for Tech Lead, scope+impact for Hiring Manager, tone+collaboration for HR Partner? Or did they give the same answer style to all three?", weight: 0.25 },
      { dimension: "Cross-persona consistency", description: "Did they tell the SAME story across panellists where it overlapped? Contradicting your own claims to different panellists = strong negative signal.", weight: 0.20 },
      { dimension: "Senior-level framing", description: "Answers framed at appropriate scope — for senior roles, talk in terms of org / quarter / metric, not individual ticket / sprint / bug.", weight: 0.20 },
      { dimension: "Stakeholder thinking", description: "When discussing past work, did they reference partner teams (PM, Eng, Design, GTM, Legal) by name/role and what each owned?", weight: 0.20 },
      { dimension: "Composure under cross-fire", description: "Handled rapid-fire from multiple angles without panic; conceded gracefully when one panellist surfaced something the other had asked.", weight: 0.15 },
    ],
  },

  /* ─── Campus placement (freshers) ─── */
  "campus-placement": {
    label: "Campus placement",
    mandatory: ["opening-resume", "experience-deepdive", "problem-solving", "culture-fit"],
    optional: ["adaptability-learning", "collaboration", "communication"],
    trapBudget: 0,
    inviteCandidateQuestions: true,
    pacingNote: "Tailor experience-deepdive to college projects/internships. Skip ownership/leadership categories — not relevant for 0-2 yrs. Trap budget = 0 (don't trap freshers).",
    scoringRubric: [
      { dimension: "Project ownership", description: "On college projects/internships, did they articulate THEIR specific contribution vs. the team's, with technical depth appropriate for 0-2 YOE?", weight: 0.25 },
      { dimension: "Fundamentals fluency", description: "Comfort with CS / domain fundamentals (DBMS, OS, OOP for tech; case math for biz; etc.) — not encyclopaedic, but workable.", weight: 0.25 },
      { dimension: "Learning attitude", description: "Genuine curiosity vs. checklist learner. Ability to articulate one thing they learned recently and applied.", weight: 0.20 },
      { dimension: "Teamwork stories", description: "Real moments of collaboration / disagreement / feedback in college teams — without bad-mouthing peers or professors.", weight: 0.15 },
      { dimension: "Communication clarity", description: "Structured, on-time answers without college-style filler ('basically', 'as such', 'thank you ma'am'). Confidence appropriate to 0-2 YOE.", weight: 0.15 },
    ],
  },

  /* ─── Case study ─── */
  "case-study": {
    label: "Case study",
    mandatory: ["problem-solving", "decision-making", "communication"],
    optional: ["customer-user"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Recipe is structural — single evolving case, not category-mix. Categories listed are the EVALUATION lens, not separate questions. The case arc itself (FRAME → STRUCTURE → QUANTIFY → REVEAL → SYNTHESIZE) is defined in TYPE_GUIDANCE.",
    scoringRubric: [
      { dimension: "MECE structure", description: "Did the candidate's framework cover the problem space without overlap and without gaps? 'I'd look at customers, market, and operations' — strong if they then drill cleanly. Weak if buckets overlap or miss the obvious.", weight: 0.30 },
      { dimension: "Quantification rigour", description: "Did they show their math when asked to estimate? Back-of-envelope is fine, hand-waving is not. Bonus for sanity-checking their own number against intuition.", weight: 0.25 },
      { dimension: "Adaptability under new info", description: "When new data was revealed mid-case, did they update cleanly and explain HOW their conclusion changes? Or did they stick to their original answer?", weight: 0.20 },
      { dimension: "Recommendation quality", description: "60-second close: did they take a position, name the top 1-2 risks, and prioritise next steps? Or did they list everything as equally important?", weight: 0.15 },
      { dimension: "Communication discipline", description: "Stayed on the case, didn't drift into adjacent topics, used framework labels consistently throughout.", weight: 0.10 },
    ],
  },

  /* ─── System design ─── */
  "system-design": {
    label: "System design",
    mandatory: ["problem-solving", "decision-making", "experience-deepdive"],
    optional: ["customer-user", "communication"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Categories are the evaluation lens; the questions themselves are technical. Probe trade-offs, scale assumptions, and recovery paths.",
    scoringRubric: [
      { dimension: "Requirements clarity", description: "Did they ask clarifying questions BEFORE jumping to architecture? Functional + non-functional reqs (latency, throughput, consistency, scale)?", weight: 0.20 },
      { dimension: "Capacity estimation", description: "Did they estimate QPS, storage, bandwidth with explicit numbers? Or wave hands at scale?", weight: 0.15 },
      { dimension: "Component decisions + trade-offs", description: "Each component (DB choice, cache strategy, queue, sharding scheme) named WITH the trade-off they accepted. SQL vs. NoSQL alone = weak.", weight: 0.30 },
      { dimension: "Failure-mode reasoning", description: "What breaks at 10x load? What's the bottleneck? What's the on-call experience? Did they think past the happy path?", weight: 0.20 },
      { dimension: "Scope discipline", description: "Stayed within the asked scope. Didn't over-engineer with microservices for a back-of-napkin problem; didn't under-engineer the parts that mattered.", weight: 0.15 },
    ],
  },

  /* ─── Salary negotiation ─── */
  "salary-negotiation": {
    label: "Salary negotiation",
    mandatory: ["salary-practical"],
    optional: [],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Salary-neg has its own dedicated arc in TYPE_GUIDANCE (intro → offer → probe → counter → benefits → close). This recipe is informational only.",
    scoringRubric: [
      { dimension: "Anchor strength", description: "Did the candidate state their target with confident rationale (market data, competing offer, current package + reasonable jump)? Or did they wait for the AI's offer?", weight: 0.25 },
      { dimension: "Counter-offer judgement", description: "When offered below target, did they push back with specific levers (base vs. variable, joining bonus, equity, role title, start date)? Or accept too quickly / over-demand?", weight: 0.25 },
      { dimension: "Trade-off awareness", description: "Did they think about the WHOLE package — equity vesting, ESOP liquidity risk, notice buyout, flexibility — not just CTC headline?", weight: 0.20 },
      { dimension: "Tactical composure", description: "Stayed warm + professional under pushback; didn't reveal floor or get rattled by 'budget is tight' / 'we have other candidates' tactics.", weight: 0.15 },
      { dimension: "Walk-away discipline", description: "Knew where their walk-away was. Didn't accept below it; didn't bluff a walk they couldn't follow through on.", weight: 0.15 },
    ],
  },

  /* ─── Mini (3-question quick session) ─── */
  mini: {
    label: "Mini interview (3 questions)",
    mandatory: ["opening-resume", "experience-deepdive"],
    optional: ["problem-solving", "ownership", "decision-making", "communication"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Three questions only. Q1 = opener (60s), Q2 = deep-dive on one real project, Q3 = pick ONE optional category that fits the resume.",
    scoringRubric: [
      { dimension: "Time discipline", description: "Each answer landed in 60-180s. No rambling, no rehearsed monologues.", weight: 0.20 },
      { dimension: "Specificity per turn", description: "Each answer included AT LEAST one concrete metric, name, decision, or trade-off — not abstract claims.", weight: 0.30 },
      { dimension: "STAR completeness", description: "On the deep-dive, were Situation/Task/Action/Result all present?", weight: 0.30 },
      { dimension: "Self-awareness", description: "On the optional category (whichever was picked), did they show learning / reflection / ownership of failure?", weight: 0.20 },
    ],
  },
};

/**
 * Format a recipe into a prompt fragment. The output is concatenated
 * into the focus's TYPE_GUIDANCE so the LLM gets:
 *   - The category mix it should draw from
 *   - The intent + signals for each mandatory category (drives scoreNote)
 *   - The trap budget (so it doesn't over-trap)
 *   - Whether to invite candidate questions at closing
 */
export function formatRecipe(focusKey: string): string {
  const recipe = RECIPES[focusKey];
  if (!recipe) return "";

  const renderCategory = (key: CategoryKey, idx: number): string => {
    const c = CATEGORIES[key];
    if (!c) return "";
    return [
      `  ${idx + 1}. ${c.label} (${c.key})`,
      `     INTENT: ${c.intent}`,
      `     STRONG SIGNAL: ${c.signals.strong}`,
      `     WEAK SIGNAL: ${c.signals.weak}`,
      `     SAMPLE STEMS (paraphrase + personalise — never copy verbatim):`,
      ...c.stems.slice(0, 4).map((s) => `       • ${s}`),
    ].join("\n");
  };

  const optionalLine = recipe.optional.length > 0
    ? `Optional categories you may draw from for remaining slots: ${recipe.optional.map((k) => CATEGORIES[k]?.label || k).join(", ")}.`
    : "";

  const trapLine = recipe.trapBudget === 0
    ? "TRAP QUESTIONS: Do NOT use trap-style questions in this focus."
    : `TRAP QUESTIONS: At most ${recipe.trapBudget} trap-style question(s) total. Use sparingly — only when it surfaces real signal.`;

  const closingLine = recipe.inviteCandidateQuestions
    ? `CLOSING: Invite the candidate to ask questions ("Do you have any questions for me?"). When they ask, answer IN CHARACTER as the hiring manager — plausible role-and-company-specific responses, not generic platitudes. Don't claim certainty about things a real interviewer wouldn't know off-hand. If their question is something you genuinely shouldn't answer (compensation specifics, head-count details), say so warmly and offer to take it back to HR.`
    : "";

  return [
    `\n═══ QUESTION RECIPE — ${recipe.label} ═══`,
    `MANDATORY categories (must appear in the question set, in roughly this order):`,
    recipe.mandatory.map(renderCategory).join("\n\n"),
    "",
    optionalLine,
    "",
    trapLine,
    "",
    closingLine,
    recipe.pacingNote ? `\nPACING: ${recipe.pacingNote}` : "",
    "",
  ].filter(Boolean).join("\n");
}

/**
 * Format a focus's scoring rubric for the evaluation prompt. Returns
 * a compact block the eval LLM uses to compute per-dimension scores
 * in addition to the overall score.
 *
 * Empty string if the focus has no rubric or no recipe — caller falls
 * back to default scoring.
 */
export function formatScoringRubric(focusKey: string): string {
  const recipe = RECIPES[focusKey];
  if (!recipe?.scoringRubric || recipe.scoringRubric.length === 0) return "";
  const lines = recipe.scoringRubric.map((r, i) =>
    `  ${i + 1}. ${r.dimension} (weight ${(r.weight * 100).toFixed(0)}%): ${r.description}`,
  );
  const totalWeight = recipe.scoringRubric.reduce((acc, r) => acc + r.weight, 0);
  return [
    `\n═══ FOCUS-SPECIFIC SCORING RUBRIC — ${recipe.label} ═══`,
    `Score the candidate on these dimensions (0-100 each), weighted as shown.`,
    `Overall score = weighted average of the dimensions.`,
    ...lines,
    `Sum of weights: ${(totalWeight * 100).toFixed(0)}%.`,
    `Surface weak dimensions in the report's "fixes" section so the candidate knows what to work on.`,
  ].join("\n");
}
