/* Canonical walk-away detection for salary-negotiation.
 *
 * Why this exists: prior to this module, four distinct regex variants
 * lived in three files (_negotiation-kernel.ts twice, follow-up.ts,
 * _follow-up-helpers.ts). They drifted — the kernel knew "i'll pass"
 * and "move on" but the server's conversationDone signal didn't; the
 * server knew "pull out" but the kernel didn't. Audit of d21754e
 * surfaced the resulting incoherence: a candidate saying "pull out"
 * triggered the server's conversationDone path while the kernel stayed
 * mid-negotiation, leaving the engine to fall back on a defensive
 * sentinel check. Single source of truth removes the drift entirely.
 *
 * Pattern is the UNION of all prior sites — broad on purpose. False
 * NEGATIVES are the main risk (candidate clearly walks but no signal
 * fires), so the alternations stay generous.
 *
 * EXCEPTION — "move on" (live-staging finding, 2026-06-18): a bare
 * `move on` alternative is NOT safe. It matched "evaluating this move
 * on the scope" (where "move" is a noun) on the candidate's FIRST
 * answer, the kernel read it as a candidate walk-away, and the fallback
 * planner closed the session at turn 2 — before any offer was made.
 * The "false positives aren't catastrophic" assumption was wrong: a
 * spurious walk-away terminates the whole negotiation. So "move on"
 * now requires a first-person DEPARTURE frame ("I'll move on", "I'm
 * moving on", "I'd rather move on", …). Topic-transition and noun uses
 * ("let's move on to…", "a smart move on paper", "this move on the
 * scope") no longer trigger. The other alternations remain broad. */
export const WALKAWAY_PATTERN = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|(?:i(?:'|’)?(?:ll|m|d)|i\s+(?:will|have\s+to|need\s+to|want\s+to|am\s+going\s+to|would\s+rather|think\s+i(?:'|’)?ll|guess\s+i(?:'|’)?ll))\s+(?:just\s+|then\s+|probably\s+|simply\s+|really\s+|now\s+|going\s+to\s+|gonna\s+|rather\s+|likely\s+|instead\s+)?(?:move|moving)\s+on|pull out|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;

export function isWalkAway(answer: string | null | undefined): boolean {
  if (!answer) return false;
  return WALKAWAY_PATTERN.test(answer);
}
