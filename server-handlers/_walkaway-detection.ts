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
/* Classifier merge (2026-07-09) — the acceptance classifier carried its own
 * private walk-away regex that had drifted with two extra rejection arms never
 * merged here: `no chance`/`not a chance` (a live FALSE-CLOSE fix — "not a
 * chance I sign today" was closing on the "sign today" performative arm) and
 * the Hindi "won't work" forms `nahi chalega` / `nahi chal payega` / `nahi
 * jamega` (the Hindi twin of the English `won't work` arm already here). The
 * private copy was deleted and its unique arms folded in so both the kernel and
 * the classifier share one detector — completing the single-source unification.
 * The private copy's other arms (bare `decline`, bare `move on`, bare
 * `i'll pass`, bare `no deal`) are deliberately NOT re-added crude: this
 * module's guarded forms strictly supersede them. */
/* S27 false-negative fix (2026-07-21) -- four explicit walk-away phrases that
 * live staging failed to catch:
 *   - "I refuse to play this game / negotiate / continue / proceed"
 *   - "I'm done negotiating / I'm done here / I'm done with this"
 *   - Bare "I walk" / "I am walking" (without "away")
 *   - `withdraw` -> `withdraw(?:ing)?` so "withdrawing" also fires
 * S85 (2026-07-26) — five false-positive / false-negative fixes:
 *   B1: `isn.?t going to work` expanded to `is(?:n.?t|\s+not)\s+going\s+to\s+work` (false negative)
 *       `i am moving on` added to departure frame (`am\s+` in i\s+(...am...) group)
 *   B2: `withdraw` exclusion list expanded — `complaint/concern/feedback/objection/comment/remark/statement/amendment`
 *       suppressed so "withdraw my complaint" is not a walk-away
 *   B3: `i decline` arms gain info-verb guard `(?!\s+to\s+(?:answer|reveal|disclose|share...)\b)` —
 *       "I decline to share my CTC" (privacy refusal) no longer fires as walk-away
 *   B4: `no deal\b` expanded to also suppress "no deal on the table" (frustration/counter, not exit)
 *   WONT_WORK_NON_EXIT also updated for B1
 * S90-B1 (2026-07-26) — `not worth` was in walkAwayWords/_follow-up-helpers.ts and walkRe/
 *   follow-up.ts but NOT in WALKAWAY_PATTERN — isWalkAway() missed "not worth my time".
 * S90-B2 (2026-07-26) — "I am just going to move on" missed all departure frames — the
 *   adverb group only allowed ONE optional slot (either a single adverb OR going_to, not
 *   both). Restructured to `(?:adverb\s+)?(?:going\s+to\s+|gonna\s+)?` so "just going to"
 *   works for all departure-frame arms in all three files.
 * S96-B6 (2026-07-26) — "I am going to explore other opportunities" returned walkAway=false.
 *   Added going-to-frame + explore/pursue other options/opportunities.
 * S96-B7 (2026-07-26) — "I am no longer interested in pursuing this" returned NONE.
 *   Added `no\s+longer\s+interested` with same component-noun guard as `not interested`.
 * S96-B8 (2026-07-26) — "I think it is best we part ways here" returned NONE.
 *   Added `part\s+ways`. Synced all three to WALKAWAY_PATTERN + walkRe + walkAwayWords.
 * S97-B9 (2026-07-26) — "I am removing myself from this process." and "Please take me off
 *   your list." returned NONE. Added both patterns + `tak(?:e|ing)\s+(?:the\s+)?(?:other|another)\s+(?:offer|opportunity|position|role|job)`.
 *   Note: `withdraw(?:ing)?` was already correct here; _follow-up-helpers.ts walkAwayWords
 *   and follow-up.ts walkRe synced to match. */
export const WALKAWAY_PATTERN = /\b(walk away|walking away|i\s+(?:am\s+)?(?:going\s+to\s+)?walk(?!\s+(?:you|me|through|us)\b)(?:ing)?(?:\s+away)?(?:\s+out)?|i.?m\s+done\s+(?:negotiating(?!\s+(?:about|over|with|on)\s+)|here(?!\s+for\s+now\b)|with\s+this|talking|discussing|waiting)|i\s+refuse\s+to\s+(?:play|negotiate|continue|proceed)|i.?m out(?!\s+of\b)|not interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|no\s+longer\s+interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|part\s+ways|no chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing))))|not a chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing))))|i(?:.ll|.?m\s+going\s+to|\s+will|\s+would\s+rather|\s+think\s+i.ll|\s+guess\s+i.ll|\s+have\s+to|\s+need\s+to|\s+am\s+going\s+to)\s+pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|no deal\b(?!\s*(?:[-\s]?breakers?|\s+on\s+the\s+table))|withdraw(?:ing)?(?!\s+(?:my|your|the|this)\s+(?:\w+\s+)?(?:counter|demand|ask|offer|request|proposal|requirement|expectation|complaint|concern|feedback|objection|comment|remark|statement|amendment)\b)|i\s+(?:hereby\s+|now\s+|regretfully\s+|respectfully\s+|reluctantly\s+|formally\s+|sadly\s+|must\s+|will\s+)?declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|i(?:'|')?(?:ll|m|d)\s+(?:going\s+to\s+|gonna\s+|have\s+to\s+|respectfully\s+|reluctantly\s+|regretfully\s+|formally\s+|sadly\s+|probably\s+|just\s+|now\s+)*declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|(?:respectfully|reluctantly|regretfully|formally|sadly)\s+declin(?:e|ing)|(?:have|going)\s+to\s+declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|not worth(?!\s+(?:fight|argu|bicker|quarrel|quibbl|debat|nit.?pick|hassle))|won.?t work|is(?:n.?t|\s+not)\s+going\s+to\s+work|have to pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|that won.?t work|(?:i(?:'|')?(?:ll|m|d)|i\s+(?:will|have\s+to|need\s+to|want\s+to|am\s+going\s+to|am|would\s+rather|think\s+i(?:'|')?ll|guess\s+i(?:'|')?ll))\s+(?:(?:just|then|probably|simply|really|now|rather|likely|instead)\s+)?(?:going\s+to\s+(?:have\s+to\s+)?|gonna\s+(?:have\s+to\s+)?)?(?:have\s+to\s+)?(?:(?:move|moving)\s+on|(?:explore|pursue)\s+other\s+(?:options|opportunities))|pull out(?!\s+(?:all\b|my\b|your\b|our\b|their\b|his\b|her\b|its\b|some\b|any\b))|nahi\s+(?:chahiye|karna|banega|hoga|chalega|chal\s+payega|jamega|kar\s+sakta|jaa?ung[ai]|lung[ai])|nahin\s+(?:chahiye|karna|chalega)|join\s+nahi(?:n)?\s+kar(?:unga|ungi|enge|na)?|mujhe\s+nahi(?:n)?\s+chahiye|tak(?:e|ing)\s+(?:the\s+)?(?:other|another)\s+(?:offer|opportunity|position|role|job)|remov(?:e|ing)\s+myself\s+from\s+(?:(?:this|the)\s+)?(?:process|consideration|pipeline)|take\s+me\s+off\s+(?:your|the)\s+list|(?:choosing|chosen|decided)\s+to\s+(?:move\s+on|pursue\s+other\s+(?:options|opportunities)|explore\s+other\s+(?:options|opportunities))|made\s+(?:my|a)\s+decision\s+to\s+(?:move\s+on|pursue\s+other|explore\s+other)|(?:will\s+)?be\s+pursuing\s+other\s+(?:options|opportunities)|(?:will\s+)?be\s+moving\s+on|(?:will\s+)?be\s+passing\s+on\s+(?:this|the\s+(?:offer|opportunity|role|position))|no\s+longer\s+pursuing\s+(?:this|the)\s+(?:role|position|opportunity|offer|job)|accepted\s+(?:a|an|another)\s+(?:position|offer|role|job)(?:\s+elsewhere|\s+(?:at|with)\s+another)?|(?:decided|chosen)\s+to\s+go\s+with\s+(?:another|a\s+different|the\s+other)\s+(?:company|offer|organization|firm|employer)|(?:chosen|decided)\s+to\s+accept\s+(?:a|an|another)\s+(?:offer|position|role|job)|step(?:ping)?\s+back\s+from\s+(?:this|the)|opt(?:ing|ed)\s+out\s+of\s+(?:this|the)|prefer\s+to\s+(?:explore|pursue|consider)\s+other\s+(?:options?|opportunities?|avenues?|paths?|alternatives?)|(?:reached|at)\s+an?\s+impasse|(?:don.?t|do\s+not)\s+think\s+(?:this|it|that)\s+is\s+going\s+to\s+work(?:\s+out)?|call\s+it\s+quits|bow(?:ing)?\s+out(?:\s+of\s+(?:this|the))?)\b/i;

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
  /\b(?:walk(?:ing)?(?:\s+away|\s+out)?|pull(?:ing)? out|back(?:ing)? out|withdraw(?:ing)?|drop(?:ping)? out|declin(?:e|ing))\b/gi;

/* A negation / aversion cue that inverts a following departure phrase, matched
 * at the END of the window preceding the phrase (so it governs that phrase).
 * Allows a few filler tokens between cue and phrase ("don't want to", "not
 * going to", "no reason for me to"). The token cap keeps a distant, unrelated
 * negation ("I don't think the scope fits, so I'll walk away") from suppressing
 * a real walk-away. */
const DEPARTURE_NEGATOR =
  /(?:\b(?:not|never|rather\s+than|instead\s+of|avoid(?:ing)?|no\s+(?:need|reason|point|intention|plan|desire|way)|would\s+rather\s+not|prefer\s+not|hate\s+to|reluctant\s+to|hesitant\s+to|hoping\s+not|don['']?t\s+want|do\s+not\s+want|does\s*n['']?t\s+want)\b|n['']t\b)(?:\s+\S+){0,5}?\s*$/i;

/* S76-B1 (2026-07-25) — three false-positive arms fired on legitimate counter-offer
 * phrases, catastrophically terminating a live negotiation:
 *   • "not interested" fired on "not interested in the variable component" (candidate
 *     stating a component preference, NOT walking away). Initial fix with negative
 *     lookahead: `not interested(?!\s+in\s+(?:a|the|an?|this|that|your)\s+)`.
 *     S78-B2 (2026-07-25) — `i.?m out` fired on "I'm out of ideas for a compromise"
 *     (candidate still negotiating). Fixed with `(?!\s+of\b)` to suppress the
 *     "out of X" form while keeping bare "I'm out" and "I'm out — this won't work".
 *
 *     S77-B1 (2026-07-25) — the initial lookahead was too broad: it also suppressed
 *     "not interested in this role/offer/deal" (genuine walk-aways) because "this/the"
 *     appear in both component phrases AND job/offer phrases. Fix: tighten the lookahead
 *     to only fire when the noun following the article is a compensation COMPONENT word
 *     (variable, fixed, equity, bonus, structure…) — job nouns (role, offer, deal,
 *     position, company, opportunity) are NOT in the suppression set, so
 *     "not interested in this role" and "not interested in the offer" now fire correctly.
 *   • "done negotiating" fired on "done negotiating about the variable, let's focus on
 *     fixed" (topic shift within the negotiation, NOT an exit). Fixed with negative
 *     lookahead: `negotiating(?!\s+(?:about|over|with|on)\s+)`.
 *   • "won't work / that won't work" fired on "won't work for me right now" (temporal
 *     constraint implying "at these terms" not permanent exit) and "won't work for me,
 *     can you do better?" (explicit counter-ask). These require reading what follows the
 *     match, so a pure lookahead inside the alternation is unwieldy — handled via the
 *     WONT_WORK_NON_EXIT post-match guard in isWalkAway() below.
 *
 * WONT_WORK_NON_EXIT window discipline (S76-B2, 2026-07-25): the two arms carry
 * DIFFERENT look-ahead windows. Temporal qualifiers ("right now", "at the moment")
 * must appear within {0,15} chars of the "won't work [for me]" match — they modify
 * the phrase directly ("won't work for me right now"). Counter-asks ("can you do
 * better?") can be separated by a few words up to {0,40}. A single {0,50} window
 * collapsed both cases and caused a FALSE NEGATIVE: "won't work for me, I'm going to
 * explore other opportunities right now" was suppressed because "right now" at the
 * END of the clause (44 chars later) sat within the 50-char window — even though the
 * "right now" was modifying "explore", not the rejection phrase. The asymmetric
 * windows fix this: 44 > 15 (temporal fails) + no counter-ask keyword (counter-ask
 * fails) → WONT_WORK_NON_EXIT returns false → isWalkAway correctly returns true. */
const WONT_WORK_NON_EXIT =
  /\b(?:won.?t work|is(?:n.?t|\s+not)\s+going\s+to\s+work|that won.?t work)\b(?:\s+for\s+\w+)?(?:\b[^.!?]{0,15}?\b(?:right\s+now|at\s+(?:the\s+)?moment|currently|for\s+now|at\s+this\s+(?:point|stage|time))|\b[^.!?]{0,40}?\b(?:can\s+you|could\s+you|is\s+there\s+any|any\s+(?:room|way|chance|flexibility)))\b/i;

function stripNegatedDepartures(text: string): string {
  return text.replace(NEGATABLE_DEPARTURE, (match, offset: number, full: string) => {
    const preceding = full.slice(Math.max(0, offset - 48), offset);
    return DEPARTURE_NEGATOR.test(preceding) ? " " : match;
  });
}

export function isWalkAway(answer: string | null | undefined): boolean {
  if (!answer) return false;
  if (!WALKAWAY_PATTERN.test(answer)) return false;
  // won't-work + temporal qualifier ("right now") or counter-ask = negotiating, not exiting
  if (WONT_WORK_NON_EXIT.test(answer)) return false;
  return WALKAWAY_PATTERN.test(stripNegatedDepartures(answer));
}
