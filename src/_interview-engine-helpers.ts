/**
 * Pure-functional helpers extracted from useInterviewEngine.ts so they can
 * be unit tested without booting React, refs, audio, or WebSockets.
 *
 * Anything in this file MUST be pure (no React hooks, no DOM, no globals
 * other than Math.random / Date). If a helper grows a side effect, move
 * it back into the hook.
 */

/* ─── Persona normalization (shared across panel interview logic) ─── */
export const PERSONA_NORM: Record<string, string> = {
  "hiring manager": "Hiring Manager",
  "technical lead": "Technical Lead",
  "hr partner": "HR Partner",
};

export function normalizePersona(persona: string): string {
  return PERSONA_NORM[persona.toLowerCase()] || persona;
}

/* ─── Answer-quality-aware reaction phrases ─── */
/* Instead of random acknowledgments, react based on what the user actually said */
export const REACTIONS = {
  strong: [
    "That's a really strong example.",
    "Great — I like how specific you were.",
    "Excellent. That's the kind of detail I'm looking for.",
    "Very well articulated.",
    "Good answer — you clearly thought that through.",
    "I appreciate the specificity there.",
    "Solid. That landed.",
    "Crisp answer — exactly what I was hoping for.",
    "That's textbook STAR — well done.",
    "Strong, strong. The metric really helps.",
    "I like that you owned the call.",
    "Good — concrete and honest.",
  ],
  decent: [
    "Got it.",
    "Right, right.",
    "Okay, got it.",
    "Hmm, okay.",
    "Fair enough.",
    "Mm, alright.",
    "Got the picture.",
    "Okay, that helps.",
    "Sure, makes sense.",
    "Right. I follow.",
    "Alright then.",
  ],
  weak: [
    "Okay, let's move on.",
    "Hmm, I see.",
    "Noted.",
    "Okay.",
    "Mm-hmm.",
    "Alright, let's try a different angle.",
    "Okay — let's keep moving.",
    "I see what you're saying.",
    "Right. Moving on.",
    "Let me ask something else.",
  ],
  short: [
    "Okay, let's keep going.",
    "We'll come back to depth later.",
    "Right, moving on.",
    "Hmm, that was brief — let's continue.",
    "Short and sweet — onward.",
    "Got it. Next.",
  ],
  followUpBridge: [
    "Actually, before we move on —",
    "Hold on, I want to dig deeper on that.",
    "Wait — one more thing about what you just said.",
    "Let me push on that a bit more.",
    "I'm curious about something you mentioned —",
    "Before the next topic, I want to understand —",
    "Quick one on that —",
    "One thing I want to pull on —",
    "Actually, let me probe that for a second.",
  ],
  topicTransition: [
    "So —",
    "Okay, next.",
    "Right.",
    "One more thing —",
    "Now —",
    "Moving on —",
    "Alright —",
    "Okay then —",
    "Next up —",
    "Let's keep going.",
  ],
  dontKnowRedirect: [
    "That's okay — let me rephrase that differently.",
    "No worries. Let me ask this from another angle.",
    "That's honest. Let me try a different approach.",
    "Fair enough — let me give you something closer to your experience.",
    "Okay, let's pivot. Think about it this way instead —",
    "Got it — that's not your area. Let me ask something more in your wheelhouse.",
    "All good. Let me come at this from a different direction.",
  ],
  ramblingInterject: [
    "Quick one — can you get to the outcome?",
    "I want to make sure we cover everything — what was the result?",
    "Sorry to cut in — what was the bottom line?",
    "Got the context. Now tell me — what happened?",
    "Let me pause you there. What was the actual impact?",
    "Got the setup — what was the punchline?",
    "I have the picture — what's the result?",
  ],
  /* Soft tracking interjection — fires earlier than the rambling cut-off
     (around the 60s mark vs 90s) when an answer is going long but still
     useful. Signals "I'm engaged, keep going" without rushing the user.
     Different role from ramblingInterject which is a hard "wrap it up". */
  softTracking: [
    "Mm, I'm with you.",
    "Mm-hmm. Go on.",
    "Right, right — keep going.",
    "I'm following.",
    "Okay, I see where you're going.",
    "Yeah, makes sense — continue.",
    "Mm, okay.",
  ],
  timePressure: [
    "We're running short on time, so let me pick up the pace.",
    "Just a couple more questions — let's keep it tight.",
    "We have a few minutes left. Let's make them count.",
  ],
  lastQuestion: [
    "Alright, last question for you.",
    "One final question before we wrap up.",
    "Last one — make it count.",
  ],
};

/** Detect "I don't know" or surrender responses */
export function isIDontKnowAnswer(text: string): boolean {
  if (!text || text.length < 5) return false;
  const lower = text.toLowerCase().trim();
  const patterns = [
    /^i don'?t know/,
    /^i'?m not sure/,
    /^i have no idea/,
    /^i haven'?t (done|experienced|faced)/,
    /^no experience with/,
    /^i can'?t (think of|recall|remember)/,
    /^nothing comes to mind/,
    /^i don'?t have (an? )?(example|answer|experience)/,
    /^pass$/,
    /^skip$/,
    /^i'?ll skip/,
  ];
  return patterns.some(p => p.test(lower)) || (lower.length < 30 && /don'?t know|not sure|no idea|can'?t think/i.test(lower));
}

/* ─── Session interviewer personality ─── */
export type InterviewerPersonality = "balanced" | "tough" | "friendly" | "time-pressed";
export function pickPersonality(): InterviewerPersonality {
  const roll = Math.random();
  if (roll < 0.3) return "tough";
  if (roll < 0.55) return "friendly";
  if (roll < 0.7) return "time-pressed";
  return "balanced";
}

/** Assess answer quality for reaction selection */
export function assessAnswerQuality(answer: string): "strong" | "decent" | "weak" | "short" {
  if (!answer || answer.startsWith("[Answer recorded") || answer.length < 15) return "short";
  const words = answer.trim().split(/\s+/).length;
  if (words < 25) return "short";
  const hasMetrics = /\d+%|\d+x|₹[\d,]+|\$[\d,]+|\d+ (users|customers|months|days|people|team|engineers|percent)/i.test(answer);
  const hasStructure = /first|second|then|finally|result|outcome|impact|as a result|because of this|the key/i.test(answer);
  const hasFirstPerson = /\bI\b/.test(answer);
  const hasSpecific = /specifically|for example|for instance|in particular|one time|at my|at our|we decided/i.test(answer);
  const qualitySignals = [hasMetrics, hasStructure, hasFirstPerson, hasSpecific].filter(Boolean).length;
  if (qualitySignals >= 3 && words >= 50) return "strong";
  if (qualitySignals >= 1 && words >= 35) return "decent";
  return "weak";
}

/* ─── Silence nudge phrases — spoken when user pauses too long during answer ─── */
export const SILENCE_NUDGES = [
  "Take your time…",
  "Whenever you're ready.",
  "No rush — take a moment to think.",
  "Feel free to continue.",
  "I'm listening.",
  "Still with me? Take your time.",
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random delay in [min, max] ms */
export function randomDelay(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}
