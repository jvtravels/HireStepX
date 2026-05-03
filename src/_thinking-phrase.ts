/* HireStepX — Thinking-phrase builder
 *
 * Real interviewers don't jump straight from your answer to the next
 * question. They acknowledge ("Got it."), bridge ("So —"), occasionally
 * push back ("Hmm, okay…"). This module builds the pre-question
 * "thinking phrase" the AI says before each question, so the cadence
 * sounds human instead of test-administrator.
 *
 * Pure module: no React hooks, no DOM, no globals beyond Math.random.
 * The engine reads its refs, calls buildThinkingPhrase, applies the
 * returned counter deltas, and speaks the phrase.
 *
 * Why a module: this lived inline in useInterviewEngine.ts and made up
 * 100+ LOC of decision tree (personality × answer-quality × interview-
 * type × pushback-count × position-in-script). Lifting it out lets us
 * unit-test the branches in isolation and keeps the engine focused on
 * orchestration.
 */

import {
  REACTIONS,
  isIDontKnowAnswer,
  pickRandom,
  type InterviewerPersonality,
} from "./_interview-engine-helpers";

export interface ThinkingPhraseInput {
  currentStep: number;
  stepType: "intro" | "question" | "follow-up" | "closing" | "topic" | string;
  interviewType: string;
  lastAnswerQuality: "strong" | "decent" | "weak" | "short";
  lastAnswerText: string;
  personality: InterviewerPersonality;
  questionsRemaining: number;
  /** Counters read from engine refs. */
  pushbackCount: number;
  lastQuestionSpoken: boolean;
  timePressureSpoken: boolean;
}

export interface ThinkingPhraseResult {
  /** The phrase to speak before the next question, or null to skip. */
  phrase: string | null;
  /** Counter updates the engine should apply back to its refs. */
  pushbackDelta: number;
  dontKnowDelta: number;
  markedLastQuestionSpoken: boolean;
  markedTimePressureSpoken: boolean;
}

/* Salary-negotiation pushback detection — used to escalate the
   manager's tone after multiple rejections. */
const NEG_REJECT_PAT = /\b(not acceptable|too low|can.?t accept|not enough|walk away|no deal|way too low|not interested|that.?s insulting)\b/i;
const NEG_ACCEPT_PAT = /\b(i accept|sounds good|deal|that works|i agree|agreed)\b/i;

/* Filler-word detection so "Hmm, okay. Right, let me ask…" gets
   collapsed to just the transition. Stacked fillers sound robotic. */
const FILLER_START = /^(hmm|okay|right|got it|i see|alright|sure|noted|achha|acha|theek hai)/i;

/* Salary-neg manager voice lines kept inline (small, contextual, and
   intentionally distinct from the generic REACTIONS bank — the
   negotiation persona is a hiring manager, not an interviewer). */
const NEG_DONT_KNOW = [
  "I need you to share your expectations so we can work this out.",
  "Help me understand what you're looking for — I can't make this work without your input.",
  "Let me rephrase that.",
];
const NEG_HEAVY_PUSHBACK = [
  "Hmm, let me think about this seriously.",
  "Okay... I hear you. Let me see what I can do.",
  "Look, I want to make this work.",
  "Alright, let me be straight with you.",
];
const NEG_STRONG_AFTER_PUSH = ["Hmm, that's a fair point.", "I hear you. Let me think about that.", "Okay, you make a good case."];
const NEG_STRONG = ["That's fair.", "I hear you.", "Okay, let me think about that.", "That's a reasonable ask.", "I appreciate the clarity."];
const NEG_WEAK = ["Hmm, okay.", "I see.", "Let me address that.", "Alright.", "Noted."];
const NEG_DEFAULT = ["Okay.", "Got it.", "I understand.", "Right.", "Sure."];

/* Personality-modulated reaction overrides. Each personality has its
   own reaction set for "strong" and "weak" answers; "decent" and
   "short" fall through to the shared REACTIONS bank. */
const TOUGH_STRONG = ["Okay.", "Alright, noted.", "Fair."];
const TOUGH_WEAK = ["Hmm.", "Okay… I was hoping for more specifics.", "Let's move on."];
const FRIENDLY_STRONG = ["That's great! Really well put.", "Excellent example — I love the detail.", "Very impressive."];
const FRIENDLY_WEAK = ["Okay, no problem. Let's try another.", "That's fine — let's keep going."];
const TIME_PRESSED = ["Got it.", "Okay.", "Right.", "Noted."];

/* Smart-silence gate — see Stivers et al. (2009) on "constrained
   silence" pulling missing detail. We only stay silent specifically
   when the answer is decent-but-vague (had content, missed the
   number/metric). Silence on weak answers feels punitive; silence
   on strong answers feels weird; silence in salary-negotiation
   reads as a pressure tactic, not coaching. */
const METRIC_PAT = /\d+%|\d+x|₹[\d,]+|\$[\d,]+|\d+\s*(users|customers|months|days|people|team|engineers|percent|crore|lakh|lpa)/i;
export function shouldStaySilent(input: Pick<ThinkingPhraseInput, "currentStep" | "stepType" | "interviewType" | "lastAnswerQuality" | "lastAnswerText">): boolean {
  const { currentStep, stepType, interviewType, lastAnswerQuality, lastAnswerText } = input;
  const baseEligible = currentStep > 0 && (stepType === "question" || stepType === "follow-up" || (stepType === "closing" && interviewType === "salary-negotiation"));
  if (!baseEligible) return false;
  const hasMetric = METRIC_PAT.test(lastAnswerText || "");
  const productive = lastAnswerQuality === "decent" && !hasMetric && interviewType !== "salary-negotiation";
  return productive && Math.random() < 0.4;
}

export function buildThinkingPhrase(input: ThinkingPhraseInput): ThinkingPhraseResult {
  const {
    currentStep, stepType, interviewType, lastAnswerQuality, lastAnswerText,
    personality, questionsRemaining, pushbackCount,
    lastQuestionSpoken, timePressureSpoken,
  } = input;

  const result: ThinkingPhraseResult = {
    phrase: null,
    pushbackDelta: 0,
    dontKnowDelta: 0,
    markedLastQuestionSpoken: false,
    markedTimePressureSpoken: false,
  };

  const baseEligible = currentStep > 0 && (stepType === "question" || stepType === "follow-up" || (stepType === "closing" && interviewType === "salary-negotiation"));
  if (!baseEligible) return result;
  if (shouldStaySilent(input)) return result;

  const isIDontKnow = isIDontKnowAnswer(lastAnswerText);

  /* Branch 1: salary-negotiation has its own hiring-manager voice that
     escalates with pushback count. Distinct from the interviewer reactions. */
  if (interviewType === "salary-negotiation") {
    if (NEG_REJECT_PAT.test(lastAnswerText) && !NEG_ACCEPT_PAT.test(lastAnswerText)) {
      result.pushbackDelta = 1;
    }
    const totalPushbacks = pushbackCount + result.pushbackDelta;
    if (isIDontKnow) result.phrase = pickRandom(NEG_DONT_KNOW);
    else if (totalPushbacks >= 3) result.phrase = pickRandom(NEG_HEAVY_PUSHBACK);
    else if (lastAnswerQuality === "strong") result.phrase = totalPushbacks >= 1 ? pickRandom(NEG_STRONG_AFTER_PUSH) : pickRandom(NEG_STRONG);
    else if (lastAnswerQuality === "weak") result.phrase = pickRandom(NEG_WEAK);
    else result.phrase = pickRandom(NEG_DEFAULT);
    return result;
  }

  /* Branch 2: candidate said "I don't know" on a fresh question — graceful redirect. */
  if (isIDontKnow && stepType !== "follow-up") {
    result.phrase = pickRandom(REACTIONS.dontKnowRedirect);
    result.dontKnowDelta = 1;
    return result;
  }

  /* Branch 3: follow-up bridge — signals "I'm probing deeper". */
  if (stepType === "follow-up") {
    result.phrase = pickRandom(REACTIONS.followUpBridge);
    return result;
  }

  /* Branch 4: standard reaction + transition. Personality modulates
     the reaction; questionsRemaining picks the transition. */
  let reaction: string;
  if (personality === "tough") {
    reaction = lastAnswerQuality === "strong" ? pickRandom(TOUGH_STRONG)
      : lastAnswerQuality === "weak" ? pickRandom(TOUGH_WEAK)
      : pickRandom(REACTIONS[lastAnswerQuality]);
  } else if (personality === "friendly") {
    reaction = lastAnswerQuality === "strong" ? pickRandom(FRIENDLY_STRONG)
      : lastAnswerQuality === "weak" ? pickRandom(FRIENDLY_WEAK)
      : pickRandom(REACTIONS[lastAnswerQuality]);
  } else if (personality === "time-pressed") {
    reaction = pickRandom(TIME_PRESSED);
  } else {
    reaction = pickRandom(REACTIONS[lastAnswerQuality]);
  }

  let transition: string;
  if (questionsRemaining === 1 && !lastQuestionSpoken) {
    result.markedLastQuestionSpoken = true;
    transition = pickRandom(REACTIONS.lastQuestion);
  } else if (questionsRemaining <= 2 && !timePressureSpoken && currentStep > 2) {
    result.markedTimePressureSpoken = true;
    transition = pickRandom(REACTIONS.timePressure);
  } else {
    transition = pickRandom(REACTIONS.topicTransition);
  }

  /* Dedupe stacked fillers — "Hmm, okay. Right, let me ask…" reads as robotic. */
  if (FILLER_START.test(reaction.trim()) && FILLER_START.test(transition.trim())) {
    result.phrase = transition;
  } else {
    result.phrase = `${reaction} ${transition}`;
  }
  return result;
}
