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
 *   and follow-up.ts walkRe synced to match.
 * S132-B1/B2 (wave 38) — two drift bugs vs. canonical walkAwayWords/walkRe, first found since
 *   the S117 sync fix:
 *   B1: bare `decline the offer` arm was missing entirely — "We should decline the offer on
 *       the table." returned false (the committal-frame `i decline` arms require a first-
 *       person subject this sentence doesn't have). Added the same bare arm walkAwayWords/
 *       walkRe already carry.
 *   B2: the `i(?:'|')?(?:ll|m|d)...declin` group had a literal duplicate straight apostrophe
 *       — `(?:'|')` — instead of straight+curly `(?:'|’)`, so curly/smart-quote input ("I'm
 *       going to move on...", "I'll decline...") from iOS autocorrect or STT vendors silently
 *       missed. Straight-quote input was unaffected. Fixed to match canonical.
 * S139-B2 (wave 45) — mirrors the Hindi/Hinglish walk-away arms added to walkAwayWords in
 * _follow-up-helpers.ts ("peeche hat...", "interested nahi hoon").
 * S140-B2 (wave 46) — mirrors the call(?:ing)?\s+it\s+quits gerund fix added to
 * walkAwayWords in _follow-up-helpers.ts ("I'm calling it quits on this negotiation."
 * previously returned false; only the bare "call it quits" imperative matched).
 * S141-B2/B3 (wave 47) — mirrors the withdr(?:aw(?:ing)?|ew) widening plus the `i declined`
 * / `declined the offer/position/role/job` / `passed on the/this offer/position/role/job/
 * opportunity` arms added to walkAwayWords in _follow-up-helpers.ts ("I declined the
 * position.", "I withdrew from the process.", "I passed on the offer." previously all
 * returned false). */
export const WALKAWAY_PATTERN = /\b(hard\s+pass\b|walk(?:ing|in)?\s+away(?!\s+with\b)|peeche\s+hat(?:na|\s+raha|\s+rahi|\s+rahe)?(?:\s+(?:hoon|hu|hun|chahta\s+hoon|chahti\s+hoon))?|hat(?:na|\s+raha|\s+rahi|\s+rahe)\s+(?:hoon|hu|hun)|interested\s+nahi(?:n)?\s+(?:hoon|hu|hun)|i(?:\s+am|['’]m)?\s*(?:going\s+to\s+)?walk(?!\s+(?:you|me|through|us|with)\b)(?:ing)?(?:\s+away|\s+out|(?=[.,!?;]|\s*$))|i.?m\s+done\s+(?:negotiating(?!\s+(?:about|over|with|on)\s+)|here(?!\s+for\s+now\b)|with\s+this|talking|discussing|waiting)|i\s+refuse\s+to\s+(?:play|negotiate|continue|proceed)|i.?m out(?!\s+of\b(?!\s*here\b))|not interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|no\s+longer\s+interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|part(?:ing)?\s+ways|thanks but no|not for me|no chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing)|reject(?:ing)?(?:\s+(?:this|it|that|the\s+offer))?|say\s+no(?:\s+to\s+(?:this|it|that))?|turn(?:ing)?\s+(?:this|it|that|the\s+offer)\s+down)))|not a chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing)|reject(?:ing)?(?:\s+(?:this|it|that|the\s+offer))?|say\s+no(?:\s+to\s+(?:this|it|that))?|turn(?:ing)?\s+(?:this|it|that|the\s+offer)\s+down)))|i(?:.ll|.?m\s+going\s+to|\s+will|\s+would\s+rather|\s+think\s+i.ll|\s+guess\s+i.ll|\s+have\s+to|\s+need\s+to|\s+am\s+going\s+to)\s+pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b)|\s+on\s+(?:dessert|lunch|dinner|breakfast|coffee|tea|the\s+(?:food|meal|drinks?)))|no deal\b(?!\s*(?:[-\s]?breakers?|\s+on\s+the\s+table))|withdr(?:aw(?:ing)?|ew)(?!\s+(?:my|your|the|this)\s+(?:\w+\s+)?(?:counter|demand|ask|offer|request|proposal|requirement|expectation|complaint|concern|feedback|objection|comment|remark|statement|amendment)\b)|decline the offer|i\s+declined|declined\s+the\s+(?:offer|position|role|job)|passed\s+on\s+(?:the|this)\s+(?:offer|position|role|job|opportunity)|^declin(?:e|ing)\b|i\s+(?:hereby\s+|now\s+|regretfully\s+|respectfully\s+|reluctantly\s+|formally\s+|sadly\s+|must\s+|will\s+)?declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|i(?:'|’)?(?:ll|m|d)\s+(?:going\s+to\s+|gonna\s+|have\s+to\s+|respectfully\s+|reluctantly\s+|regretfully\s+|formally\s+|sadly\s+|probably\s+|just\s+|now\s+)*declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|(?:respectfully|reluctantly|regretfully|formally|sadly)\s+declin(?:e|ing)|let.?s\s+end\s+(?:this|the)\s+(?:conversation|discussion|call|negotiation)|(?:have|going)\s+to\s+declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|not worth(?!\s+(?:fight|argu|bicker|quarrel|quibbl|debat|nit.?pick|hassle))|won.?t work(?!\s+for\s+(?:more|longer|over|above|anything\s+less)\s+than)|is(?:n.?t|\s+not)\s+going\s+to\s+work|have to pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|i(?:.ll|.d|\s+will)\s+need\s+to\s+pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|that won.?t work|(?:i(?:'|’)?(?:ll|m|d)|i\s+(?:will|have\s+to|need\s+to|want\s+to|am\s+going\s+to|am|would\s+rather|think\s+i(?:'|')?ll|guess\s+i(?:'|')?ll))\s+(?:(?:just|then|probably|simply|really|now|rather|likely|instead)\s+)?(?:going\s+to\s+(?:have\s+to\s+)?|gonna\s+(?:have\s+to\s+)?)?(?:have\s+to\s+)?(?:(?:move|moving)\s+on|(?:explore|pursue)\s+other\s+(?:options|opportunities))|pull(?:ing)?\s+out(?!\s+(?:all\b|my\b|your\b|our\b|their\b|his\b|her\b|its\b|some\b|any\b))|(?<!kam\s)nahi\s+(?:chahiye|karna|banega|hoga|chalega|chal\s+payega|jamega|jaa?ung[ai]|lung[ai])|(?:yeh|ye)\s+nahi\s+kar\s+sakta|nahin\s+(?:chahiye|karna|chalega)|join\s+nahi(?:n)?\s+kar(?:unga|ungi|enge|na)?|mujhe\s+nahi(?:n)?\s+chahiye|tak(?:e|ing)\s+(?:the\s+)?(?:other|another)\s+(?:offer|opportunity|position|role|job)|remov(?:e|ing)\s+myself\s+from\s+(?:(?:this|the)\s+)?(?:process|consideration|pipeline)|take\s+me\s+off\s+(?:your|the)\s+list|(?:choosing|chosen|decided)\s+to\s+(?:move\s+on|pursue\s+other\s+(?:options|opportunities)|explore\s+other\s+(?:options|opportunities))|made\s+(?:my|a)\s+decision\s+to\s+(?:move\s+on|pursue\s+other|explore\s+other)|(?:will\s+)?be\s+pursuing\s+other\s+(?:options|opportunities)|(?:will\s+)?be\s+moving\s+on|(?:will\s+)?be\s+passing\s+on\s+(?:this|the\s+(?:offer|opportunity|role|position))|no\s+longer\s+pursuing\s+(?:this|the)\s+(?:role|position|opportunity|offer|job)|accepted\s+(?:a|an|another)\s+(?:position|offer|role|job)(?:\s+elsewhere|\s+(?:at|with)\s+another)?|(?:decided|chosen)\s+to\s+go\s+with\s+(?:another|a\s+different|the\s+other)\s+(?:company|offer|organization|firm|employer)|(?:chosen|decided)\s+to\s+accept\s+(?:a|an|another)\s+(?:offer|position|role|job)|step(?:ping)?\s+back\s+from\s+(?:this|the)|opt(?:ing|ed)\s+out\s+of\s+(?:this|the)|prefer\s+to\s+(?:explore|pursue|consider)\s+other\s+(?:options?|opportunities?|avenues?|paths?|alternatives?)|(?:reached|at)\s+an?\s+impasse|(?:don.?t|do\s+not)\s+think\s+(?:this|it|that)\s+is\s+going\s+to\s+work(?:\s+out)?|call(?:ing)?\s+it\s+quits|bow(?:ing)?\s+out(?:\s+of\s+(?:this|the))?|i(?:.ll|.d|\s+will|\s+would)\s+be\s+declin(?:ing)?|can(?:not|.t)\s+(?:come\s+to|reach)\s+(?:an?\s+agreement|terms)|(?:i(?:.ll|.d|\s+will)\s+|i\s+(?:have|need)\s+to\s+|i.?m\s+going\s+to\s+|going\s+to\s+(?:have\s+to\s+)?)look(?:ing)?\s+elsewhere|no\s+longer\s+(?:wish|want)\s+to\s+(?:proceed|continue|negotiate|participate|move\s+forward)|decided\s+not\s+to\s+(?:move\s+forward|proceed|continue|accept(?:\s+this)?)|step(?:ping)?\s+away(?:(?!\s+from\s+)|\s+from\s+(?:this|the\s+(?:negotiation|process|offer|role|position|opportunity|deal|table|conversation|discussion)))|made\s+up\s+my\s+mind\s+to\s+(?:decline|not\s+accept|walk\s+away)|end(?:ing)?\s+my\s+participation|(?:reached?\s+a|at\s+a)\s+dead\s+end|exit(?:ing)?\s+(?:this\s+|the\s+)?(?:negotiation|process|conversation|discussion)|this\s+role\s+(?:isn.?t|is\s+not)\s+for\s+me|won.?t\s+be\s+(?:accepting|moving\s+forward\s+with)\s+(?:this|the))\b/i;

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
/* S151-B... (wave 57) — missing a `part\s+ways` arm entirely, unlike WALKAWAY_PATTERN
 * (which has one). isWalkAway() therefore never runs negation logic on "part ways" at
 * all — any negated instance ("I won't part ways") still fires true via the raw
 * WALKAWAY_PATTERN test. Added, now covered by the same negation/override machinery as
 * every other departure verb. */
const NEGATABLE_DEPARTURE =
  /\b(?:walk(?:ing|in)?(?:\s+away|\s+out)?|pull(?:ing)? out|back(?:ing)? out|withdraw(?:ing)?|drop(?:ping)? out|declin(?:e|ing)|part(?:ing)?\s+ways)\b/gi;

/* S151-B... (wave 57) — DEPARTURE_NEGATOR's lookback window (a fixed {0,5}-token/48-char
 * cap) had no concept of a clause boundary, so a negator from an EARLIER, unrelated clause
 * ("I won't decline, I won't decline, but I decline.") reached across a comma/"but" into a
 * LATER clause and wrongly negated a genuinely fresh, un-negated departure there. A negator
 * can only govern a departure verb in the same clause — truncate the lookback at the nearest
 * preceding clause-boundary marker before applying DEPARTURE_NEGATOR/SAY_LITOTES/
 * RECLAIMED_INTENT/WRONG_SUBJECT_NEGATOR_RE. Mirrors the identical fix in
 * _follow-up-helpers.ts's walkAwayNegationCoversLocal() — keep in sync. */
const CLAUSE_BOUNDARY_RE = /[,;.]|\b(?:but|yet|however|although|though)\b/gi;
function clauseBoundedLookback(full: string, matchIndex: number, maxChars: number): string {
  const windowStart = Math.max(0, matchIndex - maxChars);
  const window = full.slice(windowStart, matchIndex);
  CLAUSE_BOUNDARY_RE.lastIndex = 0;
  let lastBoundaryEnd = 0;
  let bm: RegExpExecArray | null;
  while ((bm = CLAUSE_BOUNDARY_RE.exec(window))) {
    lastBoundaryEnd = bm.index + bm[0].length;
  }
  return window.slice(lastBoundaryEnd);
}

/* A negation / aversion cue that inverts a following departure phrase, matched
 * at the END of the window preceding the phrase (so it governs that phrase).
 * Allows a few filler tokens between cue and phrase ("don't want to", "not
 * going to", "no reason for me to"). The token cap keeps a distant, unrelated
 * negation ("I don't think the scope fits, so I'll walk away") from suppressing
 * a real walk-away. */
/* S121-B7 (wave 27) — "I was about to walk away but let's talk more" fired a false
 * walk-away because "was about to" wasn't a recognized negator; it's a retraction
 * frame ("I nearly did X, but didn't"), synced with walkAwayNegationRe in
 * _follow-up-helpers.ts. */
/* S152-B... (wave 58) — "Under no circumstances will I walk away from this deal." fired
 * true: DEPARTURE_NEGATOR had "no way" but no "under no circumstances" arm. Added, mirrored
 * in walkAwayNegationRe in _follow-up-helpers.ts — keep in sync. */
const DEPARTURE_NEGATOR =
  /(?:\b(?:not|never|rather\s+than|instead\s+of|avoid(?:ing)?|no\s+(?:need|reason|point|intention|plan|desire|way)|under\s+no\s+circumstances|would\s+rather\s+not|prefer\s+not|hate\s+to|reluctant\s+to|hesitant\s+to|hoping\s+not|don['']?t\s+want|do\s+not\s+want|does\s*n['']?t\s+want|was\s+(?:about|going)\s+to)\b|n['']t\b)(?:\s+\S+){0,5}?\s*$/i;

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

/* S123-B2 (wave 29) — the `not interested` arm of WALKAWAY_PATTERN is never covered by
 * stripNegatedDepartures() (that helper only strips NEGATABLE_DEPARTURE verbs like
 * walk/pull-out/decline, not the standalone "not interested" phrase). So a double
 * negative like "It's not like I'm not interested." or "I can't say I'm not interested"
 * — the candidate reassuring engagement — matched "not interested" literally and fired
 * walkAway=true, terminating a live negotiation on a reassurance. */
const NOT_INTERESTED_DOUBLE_NEGATION =
  /\b(?:not\s+like|not\s+that|isn.?t\s+that|can(?:not|.t)\s+say|wouldn.?t\s+say)\s+(?:i.?m|i\s+am)\s+not\s+interested\b|(?:i.?m|i\s+am)\s+not\s+not\s+interested\b/i;

/* S136-B1 (wave 42) — isWalkAway() had NO third-party/reported-speech guard at all
 * ("My manager said I should walk away, but honestly I accept the offer." /
 * "My friend said I should walk away." both fired isWalkAway()=true), diverging from
 * _follow-up-helpers.ts's `walkAway` field, which is correctly guarded by
 * thirdPartyDepartureRe. Since isWalkAway() drives the conversationDone signal and
 * detectSalaryPhase()'s routing to closing-pressure, this let a candidate merely
 * relaying someone else's advice prematurely terminate the negotiation. Also ports
 * trailingRetractionRe for the same reason — both are absent here despite guarding
 * the canonical `walkAway` and `rejected` computations. Mirrored verbatim from
 * _follow-up-helpers.ts. */
/* S149-B1 (wave 55) — "My manager's told me I should just walk away." lost this guard:
 * the possessive contraction glues directly onto the noun with no leading space, so the
 * \w+ filler-word gap couldn't bridge to "told me". Widened to [\w']+ and allowed an
 * optional possessive on the noun itself. Mirrors thirdPartyDepartureRe in
 * _follow-up-helpers.ts — keep in sync. */
const THIRD_PARTY_DEPARTURE =
  /\b(?:my|his|her|their|our|the)\s+(?:friend|brother|sister|colleague|cousin|classmate|batchmate|senior|junior|relative|husband|wife|partner|recruiter|manager|lawyer|family|company|team|employer)['']?s?\b(?:\s+[\w']+){0,6}\s*(?:said|told\s+me|mentioned|suggested|advised|recommended|thinks?|feels?|believes?|says?)\b/i;
/* S152-B... (wave 58) — THIRD_PARTY_DEPARTURE only recognizes REPORTED SPEECH ("my friend
 * SAID I should walk away"), not a third party's own direct action ("My friend IS walking
 * away from her offer"). That left two related, opposite-direction bugs, both because the
 * veto used to be a flat whole-string test with no clause scoping:
 *   • "My manager told me to walk away, but I'm also walking away myself." — the reported-
 *     speech clause about the manager wrongly suppressed the candidate's OWN, later, genuine
 *     departure clause.
 *   • "My friend is walking away from her offer, but I accept mine." — the friend's own
 *     departure (no reporting verb, so THIRD_PARTY_DEPARTURE didn't even match) was
 *     misattributed to the candidate.
 * Fix: add a pattern for a third party's own direct departure action, and scope BOTH
 * third-party patterns to the clause they appear in — a third-party clause no longer vetoes
 * a genuine departure clause elsewhere in the same reply. Mirrors thirdPartyDepartureRe /
 * the identical fix in _follow-up-helpers.ts — keep in sync. */
const THIRD_PARTY_OWN_DEPARTURE =
  /\b(?:my|his|her|their|our|the)\s+(?:friend|brother|sister|colleague|cousin|classmate|batchmate|senior|junior|relative|husband|wife|partner|recruiter|manager|lawyer|family)['']?s?\b(?:\s+[\w']+){0,4}\s+(?:is|are|was|were|['']s|['']re)\s+(?:[\w']+\s+){0,2}(?:walk(?:ing)?(?:\s+away)?|withdraw(?:ing)?|declin(?:e|ing)|pull(?:ing)?\s+out|part(?:ing)?\s+ways)\b/i;
const THIRD_PARTY_CLAUSE_SPLIT_RE = /[.;]+|\b(?:but|yet|however|although|though)\b/i;
function hasOwnDeparture(text: string): boolean {
  return text
    .split(THIRD_PARTY_CLAUSE_SPLIT_RE)
    .some(
      (clause) =>
        WALKAWAY_PATTERN.test(clause) &&
        !THIRD_PARTY_DEPARTURE.test(clause) &&
        !THIRD_PARTY_OWN_DEPARTURE.test(clause),
    );
}
const TRAILING_RETRACTION =
  /[,;]?\s*but\s+i\s+(?:won.?t|wouldn.?t|don.?t|didn.?t|will\s+not|would\s+not|do\s+not|did\s+not)\.?\s*$/i;

/* S136-B3 (wave 42) — isWalkAway() had zero sarcasm handling: "Oh sure, like I would
 * ever walk away from a bird in hand — I accept!" read WALKAWAY_PATTERN literally and
 * fired true despite clearly positive sentiment. Mirrors walkAwaySarcasmRe added to
 * _follow-up-helpers.ts verbatim. */
const WALKAWAY_SARCASM =
  /\b(?:like|as\s+if)[\s.,]+i(?:.?d|.?ll|\s+would|\s+will)?\s+(?:ever\s+)?walk\s+away\b/i;

/* S124-B2 (wave 30) — DEPARTURE_NEGATOR's window used to be per-match, not clause-aware: a
 * negator governing an unrelated earlier clause ("if you don't match this, I will
 * walk away") sat inside the 48-char lookback of the LATER, genuine departure and
 * wrongly suppressed it. The original fix added a RECLAIMED_INTENT override: if a fresh
 * subject+modal ("I will", "I'll", "I'm going to") immediately precedes the departure verb,
 * treat it as a reassertion the earlier negator can't reach across.
 * S152-B... (wave 58) — REMOVED that override. Wave 57 added clauseBoundedLookback(),
 * which truncates `preceding` at the nearest clause boundary before DEPARTURE_NEGATOR ever
 * runs — so for the original S124-B2 text, `preceding` is already just " I will " (the
 * comma boundary strips the earlier "if you don't match this" clause away entirely) and
 * DEPARTURE_NEGATOR doesn't match it at all; the RECLAIMED_INTENT branch was never reached
 * for that case anymore. But it stayed reachable whenever a negator's OWN natural phrasing
 * ends in "I'll/I'm/I will" within the SAME clause as the departure verb — e.g. "There's no
 * way I'll withdraw from this process." truncates to "There's no way I'll " (no internal
 * boundary), DEPARTURE_NEGATOR correctly matches "no way", but RECLAIMED_INTENT ALSO matches
 * the same "I'll" tail and wrongly treated it as a fresh reassertion rather than the tail of
 * the negator phrase itself, un-suppressing a genuine denial. Since clause-bounded lookback
 * already handles the true cross-clause reassertion case by truncating the negator away
 * before this point is reached, RECLAIMED_INTENT no longer has a case where it fires
 * correctly — only cases where it misfires. Removed the constant and its check entirely
 * (single source of truth) rather than patching each new negator-phrase shape that happens
 * to end in a first-person modal. Mirrors the identical removal in _follow-up-helpers.ts's
 * walkAwayNegationCoversLocal() — keep in sync. */

/* S147-B1 (wave 53) — DEPARTURE_NEGATOR's bare `n['']t\b` catch-all (unlike the
 * phrase-based alternatives above it, e.g. "don't want") has no subject check: "if you
 * can't do it I walk" let the counterparty's "can't" suppress the candidate's own,
 * unrelated "I walk" a few tokens later. If the negated modal immediately preceding
 * the departure verb is governed by a non-candidate subject (you/he/she/they/we), it
 * can't be negating the candidate's own departure — don't let it suppress. */
const WRONG_SUBJECT_NEGATOR_RE =
  /\b(?:you|he|she|they|we)\s+(?:can|won|wouldn|don|doesn|didn|isn|aren|couldn|shouldn|hasn|haven|hadn)['']?t\b(?:\s+\S+){0,5}?\s*$/i;

/* S148-B1 (wave 54) — RECLAIMED_INTENT assumes a fresh "I'm/I will" right before the
 * departure verb is always a reassertion AFTER an unrelated earlier negation (the
 * S124-B2 case above). But "I can't say I'm walking away, but I need more time" has the
 * subject pronoun as the DIRECT OBJECT CLAUSE of the "can't say" litotes itself — not a
 * reassertion following it — so the override wrongly let the (correctly negated)
 * departure phrase through. Mirrors the identical fix in _follow-up-helpers.ts's
 * walkAwayNegationCoversLocal() — keep in sync.
 * S149-B2 (wave 55) — the original fix only recognized the literal "can't/couldn't say"
 * frame. "I never want to say I'm walking away." / "I don't want to say I'm walking
 * away." are the same litotes shape with a different say-verb negator prefix (both
 * already recognized by DEPARTURE_NEGATOR above) and hit the identical false-reassertion
 * bug, desyncing from detectCandidateIntent() (whose base walkAway clause happened to
 * stay correct only because it never runs the reassertion-aware check at all). Widened
 * to cover the other say-verb litotes prefixes. */
const SAY_LITOTES =
  /\b(?:can(?:not|.?t)\s+say|couldn.?t\s+say|won.?t\s+say|wouldn.?t\s+say|would\s+not\s+say|(?:don.?t|do\s+not|doesn.?t|does\s+not|never|wouldn.?t|would\s+not)\s+want\s+to\s+say|would\s+rather\s+not\s+say|prefer\s+not\s+(?:to\s+)?say|hate\s+to\s+say|reluctant\s+to\s+say|hesitant\s+to\s+say)\s+(?:i\s+will|i['']?ll|i\s+am\s+going\s+to|i['']?m\s+going\s+to|i\s+am|i['']?m)\s*$/i;

/* S154-B... (wave 60) — "Under no circumstances will I walk away — oh wait, no, actually,
 * under no circumstances will I NOT walk away." desynced from detectCandidateIntent()
 * (walkAway=true, correct). DEPARTURE_NEGATOR matched the trailing bare "not" and stripped
 * the departure phrase, but a primary negator ("under no circumstances"/"no way"/"never")
 * followed later in the SAME clause by a second bare negation is a double negative that
 * cancels back to an affirmed departure — it must not be stripped. */
const DOUBLE_NEGATION_CANCELS_RE =
  /\b(?:under\s+no\s+circumstances|no\s+way|never)\b(?:\s+\S+){0,4}?\s+(?:not|n['']t)\b\s*$/i;

/* S154-B... (wave 62) — "Ha! As if this offer wasn't already making me want to walk away."
 * fired isWalkAway()=false: DEPARTURE_NEGATOR's generic n't catch-all matched "wasn't" and
 * treated it as negating the departure phrase, but "wasn't already X" is a rhetorical-
 * affirmation idiom (the classic "as if X wasn't already Y" construction) that means the
 * candidate genuinely IS feeling X — it doesn't negate it. Same double-negative-cancels
 * family as DOUBLE_NEGATION_CANCELS_RE above, distinct trigger phrase. Desynced from
 * detectCandidateIntent(), whose walkAwayNegationRe never had a generic "wasn't" arm in the
 * first place and so stayed correct here by not negating at all. */
const ALREADY_IDIOM_CANCELS_RE =
  /\b(?:was|is|has|have|are)n['']?t\s+already\b(?:\s+\S+){0,5}?\s*$/i;

/* S154-B... (wave 63) — "Wasn't already obvious I'm not walking away? Just checking
 * flexibility on the bonus." fired isWalkAway()=true, diverging from detectCandidateIntent()
 * (correctly false): ALREADY_IDIOM_CANCELS_RE fired on the "wasn't already" opener alone,
 * with no check for a SECOND, fresh negator ("I'm not") sitting directly in front of the
 * departure phrase itself — that fresh negator is the genuine one to honor ("wasn't already
 * obvious [that] I'm not walking away" reassures a stay), unlike the wave-62 idiom shape
 * ("wasn't already making me want to walk away") which has no such intervening negator. Only
 * let the idiom cancel the negation when nothing directly negates the departure verb itself. */
const ALREADY_IDIOM_NESTED_NEGATOR_RE = /\b(?:not|n['']t)\b(?:\s+[\w']+){0,2}\s*$/i;

function stripNegatedDepartures(text: string): string {
  return text.replace(NEGATABLE_DEPARTURE, (match, offset: number, full: string) => {
    const preceding = clauseBoundedLookback(full, offset, 48);
    if (!DEPARTURE_NEGATOR.test(preceding)) return match;
    if (DOUBLE_NEGATION_CANCELS_RE.test(preceding)) return match;
    if (ALREADY_IDIOM_CANCELS_RE.test(preceding) && !ALREADY_IDIOM_NESTED_NEGATOR_RE.test(preceding)) return match;
    if (SAY_LITOTES.test(preceding)) return " ";
    if (WRONG_SUBJECT_NEGATOR_RE.test(preceding)) return match;
    return " ";
  });
}

/* S145-B3 (wave 51) — "I'm walking away. Actually no, I accept." fired isWalkAway()=true,
 * diverging from _follow-up-helpers.ts's `walkAway`/`accepted` formulas (already correct
 * for this direction). Mirrors the retractionToWalkAway mechanism added there: a later,
 * un-hedged "Actually (no,) ..." retraction whose post-text is a genuine accept reverses
 * an earlier walk-away phrase. (The opposite direction — an accept retracted into a
 * walk-away — is handled by the canonical `walkAway` field itself; isWalkAway() only
 * needs the accept-side mirror since it has no accept-detection logic of its own.) */
/* S153-B... (wave 59) — RETRACTION_MARKER only ever recognized the literal word "actually"
 * as a retraction cue. Two shapes desynced from _follow-up-helpers.ts:
 *   • "I'm walking away from the table, no wait, I mean I'm walking TOWARD a deal — I
 *     accept." — "no wait, I mean" is an equally unambiguous retraction marker, but the
 *     genuine accept sits past an em dash, not at the very start of the post-marker text
 *     (see the RETRACTS_TO_ACCEPT widening below).
 *   • "Ok fine, I'm out — just kidding! I'm totally on board, let's do this." — "just
 *     kidding" is likewise an unambiguous retraction marker. Mirrors the identical widening
 *     of retractionMarkerRe in _follow-up-helpers.ts — keep in sync.
 * S154-B... (wave 62) — "I'll pass — jk jk, I'm in." fired true: "jk jk" is the texting-slang
 * abbreviation of "just kidding" and equally unambiguous as a retraction cue, but had no arm
 * here. Mirrors the identical widening of retractionMarkerRe in _follow-up-helpers.ts — keep
 * in sync. */
const RETRACTION_MARKER =
  /\bactually\b[,]?\s*(?:no[,]?\s*)?|\bno\s+wait\b[,]?\s*(?:i\s+mean\b[,]?\s*)?|\bjust\s+kidding\b[!.,]?\s*|\bjk\s*jk\b[!.,]?\s*|\bjk\b[!.,]?\s*/i;
/* S153-B... (wave 59) — RETRACTS_TO_ACCEPT was anchored to the very start of the
 * post-marker text, so it missed a genuine trailing accept separated from the marker by an
 * intervening non-accept clause ("...I mean I'm walking TOWARD a deal — I accept."). Widened
 * to also match right after a sentence-ending or em/en-dash boundary anywhere in the
 * post-marker text (not bare mid-word occurrences of "accept" etc.), and added the "on
 * board"/"let's do this" phrasing "just kidding" retractions commonly resolve to.
 * S154-B... (wave 61) — "This offer? Nah, I'm out. Wait, no, actually, I'm in, forget I said
 * anything about walking." fired isWalkAway()=true: RETRACTS_TO_ACCEPT had no "I'm in" arm,
 * unlike _follow-up-helpers.ts's acceptWords (which already has one and correctly returns
 * accepted=true for this sentence) — desyncing the two functions. Added the same "(i'm|i am)
 * in" phrase, mirroring acceptWords — keep in sync. */
const RETRACTS_TO_ACCEPT =
  /(?:^|[.!?—–,-]\s*)(?:i\s+)?(?:accept|agree|deal)\b|(?:^|[.!?—–,-]\s*)(?:i\s+)?ok(?:ay)?\b|(?:^|[.!?—–,-]\s*)yes\b|\b(?:i.?m|i\s+am)\s+(?:totally\s+|completely\s+|fully\s+)?on\s+board\b|let.?s\s+do\s+(?:it|this)\b|\b(?:i.?m|i\s+am)\s+in(?!\s*[a-z])/i;
function retractsToAccept(text: string): boolean {
  const match = RETRACTION_MARKER.exec(text);
  if (!match) return false;
  const postText = text.slice(match.index + match[0].length);
  /* A genuine, still-standing departure phrase after the marker means the retraction
   * corrected something else (or itself), not an accept — don't let a coincidental "accept"
   * elsewhere in that text override a departure that's still actually there. */
  if (WALKAWAY_PATTERN.test(postText)) return false;
  return RETRACTS_TO_ACCEPT.test(postText);
}

/* S151-B... (wave 57) — isWalkAway() has no equivalent of detectCandidateIntent()'s
 * `!accepted` gate, so a departure phrase sitting inside a sarcastic setup clause ("Oh
 * yeah, right, because I'm totally going to walk away... Not happening — I accept!"), or
 * an earlier plain accept clause followed by a hedge into a departure phrase ("This works
 * for me, that said I'm leaning towards withdrawing..."), both wrongly fired true. Splits
 * the reply on clause-boundary punctuation/conjunctions and checks each trimmed clause
 * (after stripping common sarcasm/emphasis filler) against a narrow, unambiguous,
 * standalone accept phrase — deliberately narrower than the full `acceptWords` in
 * _follow-up-helpers.ts so it can't misfire on a WALKAWAY_PATTERN arm that itself contains
 * "accept" as a substring (e.g. "won't be accepting"). */
const CLAUSE_SPLIT_RE = /[.,;!?()]+|\b(?:but|yet|however|that\s+said|although)\b/i;
const CLAUSE_FILLER_RE =
  /^(?:oh\s+yeah\s*right\s*|sure\s*sure\s*|yeah\s*right\s*|obviously\s*|totally\s*|wow\s*what\s+a\s+great\s+idea\s*|not\s+happening\s*[-—]?\s*)+/i;
const UNHEDGED_ACCEPT_CLAUSE_RE =
  /^(?:i\s+)?(?:accept|agree)\b$|^(?:that.?s\s+)?a?\s*deal\b$|^(?:i\s+)?ok(?:ay)?\b$|^yes\b$|^(?:this|that|it)\s+works(?:\s+for\s+me)?\b$|^sounds\s+good\b$/i;
/* S152-B... (wave 58) — the original `.some(...)` treated ANY standalone accept clause
 * anywhere in the reply as decisive, short-circuiting isWalkAway() to false even when a
 * LATER clause is a genuine, un-negated departure:
 *   • "(I accept) but (I'm withdrawing)." — parenthesized clauses split fine, but the
 *     later "I'm withdrawing" clause was ignored once the earlier "(I accept)" clause
 *     matched.
 *   • "That works for me, yeah right, like I'd accept that — I'm walking away." — the
 *     first clause ("that works for me") is a genuine standalone accept, but it's
 *     sarcastically undercut two clauses later ("yeah right, like I'd accept that") right
 *     before an unhedged, unrelated-to-accept departure ("I'm walking away").
 * Fix: find the LAST clause that reads as a standalone accept, then require every clause
 * AFTER it to also not be a genuine departure. If a later clause plainly matches
 * WALKAWAY_PATTERN, the accept doesn't win — mirrors the "last unhedged clause wins"
 * pattern already used by retractsToAccept()/RETRACTION_MARKER above.
 * S152-B... (wave 58, correction) — that "later clause overrides" rule was too broad: "This
 * works for me, that said I'm leaning towards withdrawing from the process." (existing
 * permanent test, expects false) has a later clause matching WALKAWAY_PATTERN ("withdrawing")
 * but it's only a tentative lean, not a firm declaration — unlike bug #1/#3's bare "I'm
 * withdrawing"/"I'm walking away". A later departure clause only overrides the accept veto
 * when it's a firm declaration, not when softened by tentative-language markers. */
const SOFT_DEPARTURE_RE =
  /\b(?:leaning\s+(?:towards?|to)|considering|thinking\s+(?:about|of)|might|may|could|possibly|probably|likely|tempted\s+to)\b/i;
function hasUnhedgedAcceptClause(text: string): boolean {
  /* S151-B... (wave 57) regression fix — "I accept. Actually no, I'm walking away." has a
   * genuine standalone accept clause, but the S145-B3 "actually (no)" retraction mechanism
   * already correctly reverses it back to walkAway=true; this guard must not short-circuit
   * ahead of that retraction. Skip entirely whenever a retraction marker is present — the
   * existing retraction-aware logic is authoritative in that case. */
  if (RETRACTION_MARKER.test(text)) return false;
  const clauses = text
    .split(CLAUSE_SPLIT_RE)
    .map((raw) => (raw || "").trim().replace(CLAUSE_FILLER_RE, "").trim())
    .filter((clause) => clause.length > 0);
  let lastAcceptIdx = -1;
  clauses.forEach((clause, i) => {
    if (UNHEDGED_ACCEPT_CLAUSE_RE.test(clause)) lastAcceptIdx = i;
  });
  if (lastAcceptIdx === -1) return false;
  for (let i = lastAcceptIdx + 1; i < clauses.length; i++) {
    if (WALKAWAY_PATTERN.test(clauses[i]) && !SOFT_DEPARTURE_RE.test(clauses[i])) return false;
  }
  return true;
}

/* S153-B... (wave 59) — "WALKING AWAY IS NOT AN OPTION FOR ME RIGHT NOW, I accept your
 * offer." fired true: DEPARTURE_NEGATOR is lookback-only (it only inspects text BEFORE the
 * departure verb), so a negation that grammatically follows the verb — "walking away IS NOT
 * an option" — is invisible to it. This is a distinct, narrow phrase shape (not a general
 * lookahead rewrite of DEPARTURE_NEGATOR) so it's handled as its own post-match guard rather
 * than complicating the lookback machinery every other negator arm relies on. */
const DEPARTURE_FOLLOWED_BY_NOT_OPTION_RE =
  /\b(?:walk(?:ing|in)?\s+away|withdraw(?:ing)?|declin(?:e|ing)|part(?:ing)?\s+ways|pull(?:ing)?\s+out)\b(?:\s+\S+){0,4}?\s+is\s*(?:n['’]?t|\s+not)\s+an?\s+option\b/i;

export function isWalkAway(answer: string | null | undefined): boolean {
  if (!answer) return false;
  if (!WALKAWAY_PATTERN.test(answer)) return false;
  if (DEPARTURE_FOLLOWED_BY_NOT_OPTION_RE.test(answer)) return false;
  // won't-work + temporal qualifier ("right now") or counter-ask = negotiating, not exiting
  if (WONT_WORK_NON_EXIT.test(answer)) return false;
  if (NOT_INTERESTED_DOUBLE_NEGATION.test(answer)) return false;
  if ((THIRD_PARTY_DEPARTURE.test(answer) || THIRD_PARTY_OWN_DEPARTURE.test(answer)) && !hasOwnDeparture(answer)) {
    return false;
  }
  if (TRAILING_RETRACTION.test(answer)) return false;
  if (WALKAWAY_SARCASM.test(answer)) return false;
  if (retractsToAccept(answer)) return false;
  if (hasUnhedgedAcceptClause(answer)) return false;
  return WALKAWAY_PATTERN.test(stripNegatedDepartures(answer));
}
