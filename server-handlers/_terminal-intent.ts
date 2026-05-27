/* Hard terminal-intent classifier (PDF#48 — 2026-05-27).
 *
 * Why this exists
 * ─────────────────────────────────────────────────────────────────
 * PDF#48 surfaced an architectural gap: the candidate said "yes
 * meanwhile I want to reject this offer" and the AI continued
 * pitching medical coverage. Then they said "can we end the
 * interview" and the AI again kept talking benefits. The kernel's
 * planner has phase-routing for `walked-away` / `rejected` /
 * `terminal-decline`, but none of those phases were entered because
 * `applyCandidateAnswer` doesn't classify the literal-rejection /
 * end-interview surface forms as terminal intents — they get folded
 * into the conversation log like any other utterance and the
 * planner picks the next regular move.
 *
 * The architectural fix: detect these intents BEFORE the kernel-turn
 * call so the regular planner is bypassed entirely. The caller
 * (negotiate-turn.ts) short-circuits to a deterministic graceful-
 * close response. The kernel state still advances (so analytics +
 * terminal phase land correctly) but the LLM is never asked to
 * "respond" to a rejection — the response is fixed prose.
 *
 * This is NOT a sentiment classifier. It only fires on near-literal
 * surface forms that a real candidate would use to terminate the
 * conversation. Anything ambiguous (e.g. "this is too low" — a
 * negotiation move, not a rejection) is left to the kernel.
 */

export type TerminalIntent =
  | "reject-offer"
  | "withdraw"
  | "end-interview"
  | null;

/* Patterns are deliberately literal. False-positives here would
 * end real negotiations early, so we err on the side of strictness.
 * Each row covers one intent class:
 *
 *   reject-offer  — candidate explicitly refusing the current offer
 *                   ("I reject this offer", "I'm declining the offer",
 *                   "not accepting", "I'll pass on this")
 *
 *   withdraw      — candidate pulling out of the candidacy entirely
 *                   ("withdraw my application", "I'm out", "I'm not
 *                   interested anymore")
 *
 *   end-interview — candidate asking to terminate the conversation
 *                   itself, separate from the offer decision
 *                   ("can we end the interview", "let's stop here",
 *                   "I have to go")
 */
const REJECT_OFFER_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:want\s+to\s+|need\s+to\s+|would\s+like\s+to\s+|will\s+|am\s+going\s+to\s+)?)?(?:reject(?:ing)?|decline(?:d|ing)?|refus(?:e|ing))\s+(?:this|the|your)?\s*offer\b/i,
  /\bi(?:'m|\s+am)\s+(?:not\s+)?(?:going\s+to\s+|gonna\s+)?(?:accept(?:ing)?|tak(?:e|ing))\s+(?:this|the|your)\s+offer\b/i,
  /\b(?:i'?ll|i\s+will)\s+pass\s+on\s+(?:this|the|your)\s+offer\b/i,
  /\bnot\s+(?:going\s+to\s+|gonna\s+)?accept(?:ing)?\s+(?:this|the|your)\s+offer\b/i,
  /\bi\s+(?:do\s+not|don'?t)\s+(?:want|wish)\s+to\s+(?:accept|take)\s+(?:this|the|your)\s+offer\b/i,
  /* 2026-05-27 expansion — softer real-world refusal phrasings that
   * the prior literal patterns missed. Each row was sourced from
   * recruiter-side recordings, not invented. */
  /\bi(?:'m|\s+am)\s+(?:gonna|going\s+to)\s+have\s+to\s+(?:say\s+no|pass|decline)\b/i,
  /\bthis\s+(?:isn'?t|is\s+not)\s+(?:going\s+to\s+)?(?:work|work\s+(?:out\s+)?for\s+me)\b/i,
  /\bi(?:'?ll|\s+will)\s+have\s+to\s+pass\b/i,
  /\bi\s+(?:have\s+to\s+|need\s+to\s+)?say\s+no\s+(?:to\s+(?:this|the|your)?\s*offer)?\b/i,
  /\b(?:gonna|going\s+to)\s+pass\s+on\s+(?:this|the|your)?\s*(?:offer|opportunity|role)?\b/i,
  /\bnot\s+(?:going\s+to\s+|gonna\s+)?(?:proceed|move\s+forward)\s+with\s+(?:this|the|your)?\s*offer\b/i,
];

const WITHDRAW_PATTERNS: RegExp[] = [
  /\b(?:withdraw(?:ing)?|pulling\s+out|step(?:ping)?\s+(?:out|away))\s+(?:my\s+|the\s+)?(?:application|candidacy|interest)\b/i,
  /\bi(?:'m|\s+am)\s+(?:no\s+longer|not)\s+interested\b/i,
  /\bi(?:'m|\s+am)\s+out\b(?!\s+of\s+(?:time|notice|range))/i, // "I'm out" but not "I'm out of time"
  /* 2026-05-27 expansion. */
  /\b(?:going\s+to\s+|gonna\s+)?take\s+myself\s+out\s+(?:of\s+(?:this|the)\s+(?:process|interview|conversation))?\b/i,
  /\bi(?:'?ll|\s+will)\s+(?:drop|step)\s+out\b/i,
];

const END_INTERVIEW_PATTERNS: RegExp[] = [
  /\b(?:can\s+(?:we|you)|let'?s|please)\s+(?:end|stop|wrap\s+up|finish|close|terminate)\s+(?:this|the)?\s*(?:interview|conversation|call|session|chat|negotiation)?\b/i,
  /\bi\s+(?:want\s+to\s+|need\s+to\s+|have\s+to\s+|gotta\s+)?(?:end|stop|leave|go|exit)\s+(?:this|the|now)\b/i,
  /\b(?:end|stop|exit)\s+(?:the\s+|this\s+)?(?:interview|conversation|session|chat)\b/i,
  /\b(?:that'?s\s+(?:all|enough)|we'?re\s+done\s+here|i'?m\s+done)\b/i,
];

export function detectTerminalIntent(candidateText: string): TerminalIntent {
  const text = (candidateText || "").trim();
  if (text.length < 3) return null;

  /* Reject-offer and withdraw should beat end-interview when the same
   * utterance carries both signals ("I want to reject this offer and
   * end the interview"). The downstream graceful-close branches off
   * the intent class, and reject-offer / withdraw produce richer
   * close messages than a bare end-interview. */
  for (const re of REJECT_OFFER_PATTERNS) {
    if (re.test(text)) return "reject-offer";
  }
  for (const re of WITHDRAW_PATTERNS) {
    if (re.test(text)) return "withdraw";
  }
  for (const re of END_INTERVIEW_PATTERNS) {
    if (re.test(text)) return "end-interview";
  }
  return null;
}

/* Deterministic graceful-close response per intent class. These
 * are the prose the bot ships INSTEAD of routing to the LLM. Tight,
 * professional, doesn't push back or attempt to rescue the
 * negotiation — that's the candidate's call to make and the worst
 * thing the bot can do at this boundary is keep selling.
 *
 * Each message acknowledges the candidate's decision, leaves the
 * door open without pressuring, and ends the turn. The downstream
 * kernel phase is set to a terminal value (walked-away for reject /
 * withdraw, or candidate-declined-end for end-interview) so the
 * session won't continue.
 */
export function gracefulCloseResponse(intent: Exclude<TerminalIntent, null>, opts: { company?: string } = {}): string {
  const company = (opts.company || "the team").trim() || "the team";
  switch (intent) {
    case "reject-offer":
      return `Understood — appreciate you being direct about it. I'll close this offer on our side. If circumstances shift on either end, we can revisit; otherwise, thank you for the time and the conversation.`;
    case "withdraw":
      return `Understood — I'll mark your candidacy as withdrawn. Thanks for being upfront. If anything changes and you'd like to re-engage with ${company} later, you're welcome to reach out.`;
    case "end-interview":
      return `Sure — we can wrap here. If you'd like to pick this up later or share a written response on the offer, just let me know.`;
  }
}
