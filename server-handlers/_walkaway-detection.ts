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
/* Round-4 hostile probe (2026-07-08) — three FALSE-POSITIVE fixes, each a
 * catastrophic spurious walk-away (terminates a live negotiation the candidate
 * is NOT ending):
 *   • bare `decline` fired on positive/rhetorical/negated uses ("hard to
 *     decline", "who would decline that?", "I can't decline an offer this
 *     strong"). Replaced with committal-frame arms — decline must sit under a
 *     first-person commit ("I decline", "I'll decline", "I'm going to have to
 *     decline") or a settlement adverb ("respectfully/reluctantly decline").
 *     Negated committal forms ("I'm not going to decline") are additionally
 *     stripped by the negation guard below (decline added to NEGATABLE_DEPARTURE,
 *     "no way" added to DEPARTURE_NEGATOR).
 *   • `no deal` fired on the reassurance "no deal-breaker(s)" — mirrors the
 *     accept classifier's breaker lookahead.
 *   • `i'll pass` fired on the hand-off sense "I'll pass along …" — a lookahead
 *     spares "pass along" while "I'll pass, not for me" still fires. */
export const WALKAWAY_PATTERN = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass(?![^.!?]{0,15}?\balong\b)|no deal\b(?!\s*[-\s]?breakers?)|withdraw|i\s+(?:hereby\s+|now\s+|regretfully\s+|respectfully\s+|reluctantly\s+|formally\s+|sadly\s+|must\s+|will\s+)?declin(?:e|ing)|i(?:'|’)?(?:ll|m|d)\s+(?:going\s+to\s+|gonna\s+|have\s+to\s+|respectfully\s+|reluctantly\s+|regretfully\s+|formally\s+|sadly\s+|probably\s+|just\s+|now\s+)*declin(?:e|ing)|(?:respectfully|reluctantly|regretfully|formally|sadly)\s+declin(?:e|ing)|(?:have|going)\s+to\s+declin(?:e|ing)|won.?t work|isn.?t going to work|have to pass|that won.?t work|(?:i(?:'|’)?(?:ll|m|d)|i\s+(?:will|have\s+to|need\s+to|want\s+to|am\s+going\s+to|would\s+rather|think\s+i(?:'|’)?ll|guess\s+i(?:'|’)?ll))\s+(?:just\s+|then\s+|probably\s+|simply\s+|really\s+|now\s+|going\s+to\s+|gonna\s+|rather\s+|likely\s+|instead\s+)?(?:move|moving)\s+on|pull out|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;

/* Negation guard (PRI-64, 2026-07-06, live staging) — WALKAWAY_PATTERN is a
 * bare alternation with no awareness of negation, so a candidate REASSURING the
 * recruiter they are staying — "I don't want to walk away, let's close at ₹52
 * fixed", "rather than pull out I'd like to find middle ground", "no need to
 * withdraw, I'm in" — matched `walk away` / `pull out` / `withdraw` and was
 * scored as a walk-away. A spurious walk-away is catastrophic: it terminates a
 * live negotiation the candidate is actively trying to SAVE and renders the
 * report as "You walked away". Classifying re-engagement as departure is the
 * exact inverse of the user's intent.
 *
 * Fix: neutralize departure phrases that sit inside a negation/aversion scope
 * BEFORE the pattern runs. Only the negatable departure verbs are stripped;
 * every other signal ("i'm out", "not interested", "no deal", the Hindi
 * phrases) is untouched, and any UN-negated departure elsewhere in the same
 * utterance ("I don't want to walk away, but if the base won't move I'll pass")
 * still fires. Conservative by construction — suppression requires an explicit
 * negator within a few tokens, so genuine walk-aways keep firing. */
const NEGATABLE_DEPARTURE =
  /\b(?:walk(?:ing)? away|pull(?:ing)? out|back(?:ing)? out|withdraw(?:ing)?|drop(?:ping)? out|declin(?:e|ing))\b/gi;

/* A negation / aversion cue that inverts a following departure phrase, matched
 * at the END of the window preceding the phrase (so it governs that phrase).
 * Allows a few filler tokens between cue and phrase ("don't want to", "not
 * going to", "no reason for me to"). The token cap keeps a distant, unrelated
 * negation ("I don't think the scope fits, so I'll walk away") from suppressing
 * a real walk-away. */
const DEPARTURE_NEGATOR =
  /(?:\b(?:not|never|rather\s+than|instead\s+of|avoid(?:ing)?|no\s+(?:need|reason|point|intention|plan|desire|way)|would\s+rather\s+not|prefer\s+not|hate\s+to|reluctant\s+to|hesitant\s+to|hoping\s+not|don['’]?t\s+want|do\s+not\s+want|does\s*n['’]?t\s+want)\b|n['’]t\b)(?:\s+\S+){0,5}?\s*$/i;

function stripNegatedDepartures(text: string): string {
  return text.replace(NEGATABLE_DEPARTURE, (match, offset: number, full: string) => {
    const preceding = full.slice(Math.max(0, offset - 48), offset);
    return DEPARTURE_NEGATOR.test(preceding) ? " " : match;
  });
}

export function isWalkAway(answer: string | null | undefined): boolean {
  if (!answer) return false;
  if (!WALKAWAY_PATTERN.test(answer)) return false;
  return WALKAWAY_PATTERN.test(stripNegatedDepartures(answer));
}
