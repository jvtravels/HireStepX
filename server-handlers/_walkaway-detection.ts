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
 * positives here are not catastrophic (the kernel still requires the
 * full state machine to advance to walked-away); false NEGATIVES are
 * the real risk (candidate clearly walks but no signal fires). */
export const WALKAWAY_PATTERN = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on|pull out|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;

export function isWalkAway(answer: string | null | undefined): boolean {
  if (!answer) return false;
  return WALKAWAY_PATTERN.test(answer);
}
