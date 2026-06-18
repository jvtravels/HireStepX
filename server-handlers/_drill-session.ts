/* Drill mode — focused 5-question micro-session.
 *
 * Thin wrapper that composes a self-contained scripted session targeting
 * one negotiation skill. Intentionally does NOT recurse into the full
 * negotiation kernel: drill mode is a deterministic 5-question script,
 * not a live recruiter conversation, so we keep state surface minimal
 * and pure. The kernel remains the source of truth for full sessions;
 * this module is the focused-practice sibling.
 *
 * Scoring is intentionally lightweight (length floor + keyword presence
 * per skill). It's the right resolution for a 5-prompt drill — a real
 * coach LLM pass can replace `scoreAnswer` later without touching the
 * UI contract. Public surface:
 *   - startDrill(config)        → DrillState
 *   - applyDrillTurn(state, ans) → { state, recruiterReply, ... }
 *   - summarizeDrill(state)     → verdict block
 */

import type { RecruiterSectorPersona } from "./_negotiation-kernel";

/* DrillSkill is the single, unified drill vocabulary. The first group are
 * the negotiation-kernel skills; the second group are the HR-round gap keys
 * emitted by the dashboard "next move" CTA (GAP_CTA_MAP in src/nextMove.ts,
 * `drill:` field). Keeping ONE union here means the gap CTA and this engine
 * can never drift into two disjoint taxonomies — the drillCtaContract test
 * asserts every GAP_CTA_MAP drill key is a valid DrillSkill below. */
export type DrillSkill =
  // Negotiation-kernel skills
  | "esop"
  | "notice-period"
  | "anchoring"
  | "red-flags"
  | "silence"
  // HR-round gap-CTA keys (must match GAP_CTA_MAP[*].drill in src/nextMove.ts)
  | "resume_facts"
  | "career_gap"
  | "seniority"
  | "under_titled"
  | "comp_floor"
  | "comp_deflect";

export interface DrillConfig {
  skill: DrillSkill;
  maxQuestions: 5;
  sector?: RecruiterSectorPersona;
}

export interface DrillTurn {
  questionIdx: number;
  question: string;
  answer: string;
  score: number;
}

export interface DrillState {
  config: DrillConfig;
  script: readonly string[];
  turns: DrillTurn[];
  cursor: number;
  finished: boolean;
}

export interface DrillSummary {
  skill: DrillSkill;
  scorePct: number;
  strongestAnswerIdx: number;
  weakestAnswerIdx: number;
  oneSentenceVerdict: string;
}

/* Scripted recruiter prompts per skill — hand-written to target each
 * skill's classic failure modes (e.g., ESOP candidates anchor on
 * notional value not strike-spread; notice-period candidates concede
 * the buyout without naming a number; anchoring candidates leave
 * money on the table by quoting current CTC first; red-flag readers
 * miss "we're a family" phrasing; silence breakers fold under a
 * 3-second pause). */
const SCRIPTS: Record<DrillSkill, readonly [string, string, string, string, string]> = {
  esop: [
    "We're offering 12,000 ESOPs vesting over 4 years. What's your take?",
    "Our 409A is $8 and strike is $2 — sound fair?",
    "We don't allow secondary sales until IPO. Any concerns?",
    "Cliff is 1 year, monthly after that. Acceptable?",
    "If you leave at year 3 you forfeit unvested. OK?",
  ],
  "notice-period": [
    "Your notice is 90 days — when can you join?",
    "Can you serve the full notice or negotiate a buyout?",
    "Who pays the buyout — you or us?",
    "We need you in 30 days. Walk me through your plan.",
    "If your current employer counter-offers, what happens?",
  ],
  anchoring: [
    "What's your current CTC?",
    "What number are you expecting from us?",
    "Why that number — what's the justification?",
    "That's on the higher end. Can you flex?",
    "If we match your ask, do we have a deal today?",
  ],
  "red-flags": [
    "We're like a family here — late nights are normal during launches.",
    "We don't do written offers until after you resign. Trust us.",
    "Equity is more important than cash at our stage, right?",
    "The previous person in this role moved on — culture fit issue.",
    "Can you start in 2 weeks? We'll figure out the paperwork later.",
  ],
  silence: [
    "So… [pauses] what number did you have in mind?",
    "[long pause after your ask] …",
    "Hmm. [pauses] That's higher than we budgeted.",
    "[pauses] Let me think about that. …",
    "[pauses] Is that your final number?",
  ],
  resume_facts: [
    "You just named an employer that isn't on your resume — walk me through that.",
    "Your resume says three years there; you said 'about two'. Which is right for BGV?",
    "Is the title on your CV the exact designation on your offer letter?",
    "There's a six-month overlap between two roles here — explain it.",
    "If our background-verification team calls, will every date and title match what you've told me?",
  ],
  career_gap: [
    "There's a gap of roughly a year here — what were you doing?",
    "Give me the one-line version a recruiter would accept.",
    "Was that gap planned, or were you between jobs?",
    "Did you keep your skills current during that time?",
    "Why should that gap not worry us?",
  ],
  seniority: [
    "Your title says 'Senior' but you have four years — justify the level.",
    "What senior-scope work have you actually owned end-to-end?",
    "Did you lead people, or lead projects?",
    "Benchmarked against a nine-year senior, where do you honestly stand?",
    "Be straight with me — are you senior today, or senior-track?",
  ],
  under_titled: [
    "Your title is modest — why should we band you higher?",
    "Walk me through scope your title doesn't capture.",
    "What did you own that a typical person at your title wouldn't?",
    "Should we level you by title or by scope — and why?",
    "If comp anchors to your old title, what's your counter?",
  ],
  comp_floor: [
    "What's the minimum you'd accept?",
    "Whatever number you give, justify it.",
    "That's above our band — can you go lower?",
    "Why that floor and not ten percent less?",
    "If we can't meet your floor, what happens?",
  ],
  comp_deflect: [
    "Before we go further — what's your current CTC?",
    "What number are you looking for?",
    "I need a figure to proceed — give me one.",
    "Are you flexible on compensation?",
    "Just a ballpark — what's your expectation?",
  ],
};

/* Recruiter ack templates used between turns. Sector flavor reserved
 * for future use — for now kept neutral so the script reads as a
 * skill drill, not a sector role-play. */
const ACK = "Got it.";

/* Scorer — per skill the "good answer" keywords differ. This is a
 * deliberate floor model: presence of any keyword + minimum length
 * threshold maps to bands. Tunable in one place. */
const KEYWORDS: Record<DrillSkill, readonly string[]> = {
  esop: ["strike", "409a", "vest", "cliff", "fair market", "fmv", "spread", "liquidity", "secondary", "tax"],
  "notice-period": ["buyout", "30 days", "60 days", "90 days", "garden leave", "early release", "transition", "handover", "lwd"],
  anchoring: ["range", "market", "based on", "benchmark", "data", "expecting", "ask", "target", "total comp"],
  "red-flags": ["written", "documented", "in writing", "concerned", "not comfortable", "policy", "boundaries", "specifics", "details"],
  silence: ["my ask", "based on", "as i said", "to repeat", "let me clarify", "the number is", "i'll wait", "happy to discuss"],
  resume_facts: ["exact", "offer letter", "bgv", "background", "verification", "dates", "designation", "let me correct", "to clarify", "accurate"],
  career_gap: ["upskilling", "caregiving", "deliberate", "planned", "certification", "freelance", "consulting", "ready", "one line", "no impact"],
  seniority: ["owned", "led", "scope", "honest", "track", "impact", "delivered", "responsible", "mentored", "end-to-end"],
  under_titled: ["scope", "owned", "responsible", "impact", "beyond my title", "level by scope", "benchmark", "market", "evidence", "deliverables"],
  comp_floor: ["floor", "minimum", "based on", "market", "benchmark", "rationale", "non-negotiable", "walk away", "total comp", "data"],
  comp_deflect: ["discuss later", "understand the role", "market rate", "fair", "based on scope", "range once", "align on role", "competitive", "open", "happy to"],
};

export function scoreAnswer(skill: DrillSkill, answer: string): number {
  const trimmed = (answer ?? "").trim();
  if (trimmed.length === 0) return 0;
  const lower = trimmed.toLowerCase();
  const lengthBand = trimmed.length < 20 ? 20 : trimmed.length < 60 ? 50 : 70;
  const hits = KEYWORDS[skill].reduce((n, k) => (lower.includes(k) ? n + 1 : n), 0);
  const keywordBoost = Math.min(30, hits * 12);
  return Math.max(0, Math.min(100, lengthBand + keywordBoost));
}

export function startDrill(config: DrillConfig): DrillState {
  if (config.maxQuestions !== 5) {
    throw new Error("drill: maxQuestions must be 5");
  }
  const script = SCRIPTS[config.skill];
  if (!script) {
    throw new Error(`drill: unknown skill "${config.skill}"`);
  }
  return {
    config,
    script,
    turns: [],
    cursor: 0,
    finished: false,
  };
}

export function currentQuestion(state: DrillState): string | null {
  if (state.finished) return null;
  return state.script[state.cursor] ?? null;
}

export function applyDrillTurn(
  state: DrillState,
  userAnswer: string,
): { state: DrillState; recruiterReply: string; questionsRemaining: number; finished: boolean } {
  if (state.finished) {
    return {
      state,
      recruiterReply: "Drill complete.",
      questionsRemaining: 0,
      finished: true,
    };
  }
  const question = state.script[state.cursor] ?? "";
  const score = scoreAnswer(state.config.skill, userAnswer);
  const turn: DrillTurn = {
    questionIdx: state.cursor,
    question,
    answer: userAnswer,
    score,
  };
  const nextTurns = [...state.turns, turn];
  const nextCursor = state.cursor + 1;
  const finished = nextCursor >= state.script.length;
  const nextState: DrillState = {
    ...state,
    turns: nextTurns,
    cursor: nextCursor,
    finished,
  };
  const nextQ = finished ? "" : state.script[nextCursor];
  const recruiterReply = finished ? "That's all five. Let me give you the verdict." : `${ACK} ${nextQ}`;
  return {
    state: nextState,
    recruiterReply,
    questionsRemaining: Math.max(0, state.script.length - nextCursor),
    finished,
  };
}

const VERDICT_LABEL: Record<DrillSkill, string> = {
  esop: "ESOP haggling",
  "notice-period": "notice-period buyout",
  anchoring: "anchoring",
  "red-flags": "red-flag detection",
  silence: "silence handling",
  resume_facts: "resume–interview reconciliation",
  career_gap: "career-gap framing",
  seniority: "seniority framing",
  under_titled: "scope-over-title framing",
  comp_floor: "comp floor + rationale",
  comp_deflect: "comp deflection",
};

export function summarizeDrill(state: DrillState): DrillSummary {
  const skill = state.config.skill;
  if (state.turns.length === 0) {
    return {
      skill,
      scorePct: 0,
      strongestAnswerIdx: -1,
      weakestAnswerIdx: -1,
      oneSentenceVerdict: `No answers recorded for ${VERDICT_LABEL[skill]} drill.`,
    };
  }
  let best = 0;
  let worst = 0;
  let total = 0;
  state.turns.forEach((t, i) => {
    total += t.score;
    if (t.score > state.turns[best].score) best = i;
    if (t.score < state.turns[worst].score) worst = i;
  });
  const scorePct = Math.round(total / state.turns.length);
  const band =
    scorePct >= 75 ? "Solid" : scorePct >= 55 ? "Promising" : scorePct >= 35 ? "Shaky" : "Needs work";
  const oneSentenceVerdict = `${band} on ${VERDICT_LABEL[skill]} — averaged ${scorePct}/100 across ${state.turns.length} prompts.`;
  return {
    skill,
    scorePct,
    strongestAnswerIdx: best,
    weakestAnswerIdx: worst,
    oneSentenceVerdict,
  };
}
