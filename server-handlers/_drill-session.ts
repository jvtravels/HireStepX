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

export type DrillSkill =
  | "esop"
  | "notice-period"
  | "anchoring"
  | "red-flags"
  | "silence";

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
