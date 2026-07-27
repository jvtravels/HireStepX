/**
 * Pure logic extracted from server-handlers/follow-up.ts so the intent
 * detection + salary-number extraction can be unit-tested without
 * spinning up the 697-line handler + LLM mock.
 *
 * These functions run against the raw candidate answer before prompt
 * assembly. A bug here means the salary-negotiation interviewer shows
 * the wrong intent banner ("candidate accepted" when they rejected),
 * which causes catastrophic prompt-level misbehaviour.
 */

import { isWalkAway } from "./_walkaway-detection";

export interface CandidateIntent {
  accepted: boolean;
  /** Accepted with a condition/question attached ("I accept but what about equity?") */
  conditionalAccept: boolean;
  rejected: boolean;
  /** Explicitly signalling they're walking away */
  walkAway: boolean;
  /** Deflecting to avoid revealing their number */
  deflected: boolean;
  /** Asking for time / needs to think */
  needsTime: boolean;
  /** Mentioned competing offers */
  mentionedCompeting: boolean;
}

/* S83-B1 (2026-07-26) — `agreed` fired on past-tense references: "As agreed, I
 * expect..." / "We agreed that the base would be 40L" — these are references to
 * prior agreements, not new acceptances. Replaced bare `agreed` with a
 * lookbehind-guarded form that suppresses "as/we/i/they/you/had/have agreed"
 * while preserving bare-affirmative forms ("Agreed!", "Agreed, but I'd like...").
 * S83-B2 (2026-07-26) — `i agree` fired on "I agree [the variable is tricky], but
 * I need more fixed" — agreeing with a point, NOT accepting the offer. Added
 * negative lookahead to suppress "I agree [the/that/this/it/your/with X]".
 * S84 (2026-07-26) — common acceptance phrases missing from acceptWords: i'll take it,
 * that's acceptable, count me in, consider it done, i'm happy to proceed, i'm on board.
 * All added.
 * S93-B1 (2026-07-26) — "I am in" / "I'm in" returned accepted=false (only trial-close
 *   detector had `i'm in`; acceptWords was missing it).
 * S93-B2 (2026-07-26) — "let us go ahead" returned accepted=false; `let.?s` doesn't match
 *   "let us" because `.?` can't span " u" before "s". Changed let arm to `let(?:'?s|\s+us)`.
 * S94-B2 (2026-07-26) — deal-closing idioms missing: "done deal", "we have a deal",
 *   "you've got yourself a deal", "let's close/seal/finalize", "I'm game". All added.
 * S95-B1 (2026-07-26) — "works for me" (without "that" prefix) returned accepted=false.
 *   Added bare `works for me` alongside the existing `that works for me`.
 * S95-B2 (2026-07-26) — "happy to accept that" returned accepted=false. Added
 *   `happy\s+to\s+accept` (covers "happy to accept", "I'm happy to accept that").
 * S96-B1 (2026-07-26) — "I am fully on board" not matched; adverb between "am" and
 *   "on board" blocked the pattern. Added `fully\s+on\s+board` as a separate arm.
 * S96-B2 (2026-07-26) — "fine by me" not matched (only "fine with me" was present).
 *   Added `fine\s+by\s+me`.
 * S97-B1 (2026-07-26) — "I am okay with the revised terms." returned NONE.
 *   Added `(?<!not\s)okay\s+with\s+(?:this|that|it|the)` (negative lookbehind guards "not okay").
 * S97-B2 (2026-07-26) — "Perfect, I am happy to take the offer." and "Happy to go with this."
 *   returned NONE. Added `happy\s+to\s+(?:take|go\s+with)\s+(?:the\s+)?(?:offer|package|deal|this|that|it)`.
 * S98-B1 (2026-07-26) — "I will accept the position." returned NONE (bare `i accept` requires
 *   no word between "I" and "accept"). Added `i(?:.ll|.d|\s+will|\s+would)\s+accept`.
 * S98-B2 (2026-07-26) — "I am willing to accept." returned NONE. Added `willing\s+to\s+accept`.
 * S98-B3 (2026-07-26) — "That arrangement is acceptable." returned NONE. Existing pattern
 *   `(?:that|this).?s?...` doesn't handle intervening words. Added specific
 *   `(?:offer|package|deal|ctc|salary|comp|terms?|arrangement|proposal|number)\s+is\s+acceptable`.
 * S98-B4 (2026-07-26) — "Let us proceed." returned NONE. Expanded let...close|seal|finalize
 *   to also include `proceed|move\s+forward`. Added `happy\s+to\s+move\s+forward` separately. */
const acceptWords = /\b(i\s+(?:do\s+|did\s+)?accept(?!\s+(?:nothing|no\s+less|anything\s+less|that\b|whatever\b))|i.?ll accept|(?:i.?m|i\s+am)\s+(?:actually\s+|definitely\s+|really\s+)?going\s+to\s+accept|accept the offer|sounds\s+good|that works for me|works for me|\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l|cr\b|crore)?\s+works(?:\s+for\s+me)?\b|happy\s+to\s+accept|(?:thrilled|delighted|excited|pleased)\s+to\s+accept|(?:it|that|this)(?:.?s|\s+is)\s+a\s+deal|i.?m happy with|fine with me|fine\s+by\s+me|fully\s+on\s+board|i agree(?!\s+(?:on|the|that|this|it|your|with|to\s+(?:review|look|discuss|examine|reconsider|revisit|check|read|go|get|think|evaluate|consider))\b)|(?<!as\s)(?<!we\s)(?<!i\s)(?<!they\s)(?<!you\s)(?<!had\s)(?<!have\s)agreed(?!\s+(?:on|that|earlier|previously|upon|by|already))|let(?:'?s|\s+us)\s+go\s+ahead|i(?:.ll|.d|\s+will|\s+would)\s+(?:(?:happily|gladly|certainly|definitely|absolutely|willingly)\s+)?take\s+(?:it(?!\s+(?:as\s+a\s+no|that\s+way|the\s+wrong\s+way))|(?:the\s+)?(?:offer|package|deal|position|role)|whatever\s+(?:you\s+)?offer)|(?:that|this).?s?\s+(?:is\s+)?acceptable(?:\s+to\s+me)?|count\s+me\s+in|consider\s+it\s+done|(?:i.?m|i\s+am)\s+(?:(?:very|quite|really|so|truly|absolutely)\s+)?happy\s+to\s+proceed|happy\s+to\s+proceed|(?:i.?m|i\s+am)\s+(?:(?:totally|completely|absolutely|definitely|certainly|wholly)\s+)?on\s+board|(?:i.?m|i\s+am)\s+in(?!\s*[a-z])|done\s+deal|(?:we|you)(?:.ve\s+got|\s+have|\s+got)\s+(?:yourself\s+)?a\s+deal|let(?:'?s|\s+us)\s+(?:close|seal|finalize|proceed|move\s+forward)|i.?m\s+game|(?<!not\s)okay\s+with\s+(?:this|that|it)|happy\s+to\s+(?:take|go\s+with)\s+(?:the\s+)?(?:offer|package|deal|this|that|it)|happy\s+to\s+move\s+forward(?:\s+with\s+(?:this|it|that))?|i(?:.ll|.d|\s+will|\s+would)\s+(?:(?:happily|gladly|certainly|definitely|absolutely|willingly)\s+)?accept(?!\s+(?:nothing|no\s+less))|willing\s+to\s+accept|prepared\s+to\s+accept|glad\s+to\s+accept|sounds\s+acceptable|i(?:.d|\s+would)\s+love\s+to\s+accept|i\s+(?:wholeheartedly|enthusiastically|unconditionally)\s+accept|i(?:.ll|.d|\s+will|\s+would)\s+go\s+for\s+it|(?:i.?m|i\s+am)\s+(?:(?:totally|completely|absolutely|definitely|certainly|wholly|perfectly|quite)\s+)?fine\s+with\s+(?:this|that|it|the)|(?:offer|package|deal|ctc|salary|comp(?:ensation)?|terms?|arrangement|proposal|number)\s+is\s+acceptable(?:\s+to\s+me)?|sounds\s+great(?:\s+to\s+me)?|fair\s+enough(?:\s+for\s+me)?|(?:let.?s|let\s+us)\s+make\s+this\s+happen|(?:i\s+)?can\s+live\s+with\s+(?:that|this|it)|in\s+agreement(?:\s+with\s+the\s+terms)?|i(?:.ll|.d|\s+will|\s+would)\s+go\s+with\s+(?:this|that|it)|(?:i.?m|i\s+am)\s+(?:(?:very|quite|really|so|truly|absolutely|fully|completely)\s+)?satisfied\s+with\s+(?:this|that|it|the)|(?<!not\s)willing\s+to\s+(?:move\s+forward|proceed)|(?:let.?s|let\s+us)\s+do\s+(?:it|this)|i(?:.ll|.d|\s+will|\s+would)\s+go\s+ahead(?:\s+with)?|(?:i.?m|i\s+am)\s+(?:(?:totally|completely|absolutely|perfectly|quite|really|pretty)\s+)?good\s+with\s+(?:this|that|it|the)|consider\s+it\s+settled|happy\s+to\s+sign(?:\s+(?:on|up))?|sign\s+me\s+up|that.?s\s+settled(?:\s+then)?|let.?s\s+shake\s+(?:hands\s+)?on\s+it|(?:i.?m|i\s+am)\s+(?:(?:quite|very|really|truly|completely|absolutely)\s+)?content\s+with\s+(?:this|that|it|the)|(?:i.?m|i\s+am)\s+pleased\s+to\s+accept|(?:i.?ll|i.?d|i\s+will|i\s+would)\s+sign\s+on\s+the\s+dotted\s+line|(?<!not\s)comfortable\s+with\s+(?:this|that|it|the)|works\s+(?:\w+\s+)?for\s+me|that\s+works\b)\b/i;
/* Rejection signals — covers explicit rejection AND number-locking
   ("stick with 26 lakhs", "holding at 30 LPA", "won't go below"). The
   user-reported bug where "No, I would like to stick with 26 lakhs"
   wasn't classified as rejection traced back to this regex missing the
   "stick/hold/stay at <number>" family. The lookahead for an LPA-style
   number after the lock verb prevents false positives like "I'll stick
   with the team I have." */
/* S77-B3 (2026-07-25) — same component-noun lookahead applied here; bare
 * "not interested in the variable/equity/bonus" must not set rejected:true */
/* S83-B3 (2026-07-26) — `don't work` added alongside `won't work` so "the numbers
 * don't work for me" triggers hedgeIsRejection when it appears in the post-hedge
 * segment of "sounds good in theory, but the numbers don't work for me" — previously
 * only `won.?t work` was listed and "don't work" fell through to accepted=true. */
/* S84 (2026-07-26) — `need more/higher [comp-noun]` added to catch post-hedge rejections
 * like "I'm on board but need more fixed" / "happy to proceed but need higher comp".
 * Restricted to salary-component nouns to avoid false positives on "need more time/info".
 * S86-B1 (2026-07-26) — `expecting\s+at\s+least` didn't match "I expect at least 45L"
 *   (no -ing suffix). Broadened to `expect(?:ing)?\s+at\s+least`.
 * S86-B2 (2026-07-26) — "That does not work for me" not classified as rejection.
 *   Added `does\s+not\s+work` alongside existing `don.?t work`.
 * S95-B3 (2026-07-26) — "I am not going to accept this" returned NONE (not rej).
 *   Added `not\s+going\s+to\s+accept`, `won.?t\s+accept`, `refuse\s+to\s+accept`.
 * S96-B3 (2026-07-26) — "I would not accept anything below 40 lakhs" returned NONE.
 *   Added `would.?n.?t\s+accept|would\s+not\s+accept`.
 * S97-B4 (2026-07-26) — "I find this offer insufficient." returned NONE. Added `insufficient`.
 * S97-B5 (2026-07-26) — "This does not meet my expectations." returned NONE.
 *   Added `(?:does?\s+not|doesn.?t)\s+meet\s+(?:my\s+)?expectations`.
 * S97-B6-rej (2026-07-26) — "I have to say no." returned NONE. Added `have\s+to\s+say\s+no`.
 * S97-B8 (2026-07-26) — "Works for me in theory but not at this number." returned acc (false
 *   positive). Post-hedge text "not at this number" missed by hedgeIsRejection because the
 *   pattern wasn't in rejectWords. Added `not\s+at\s+(?:this|that)\s+(?:number|price|rate|
 *   figure|amount|salary)` and also `not\s+(?:okay|comfortable)\s+with\s+(?:this|that|the)`
 *   to cover "I am not okay/comfortable with this number".
 * S98-B5 (2026-07-26) — "I cannot accept this offer as is." returned NONE. `can.?t accept`
 *   uses `.?` (1 optional char) so "cannot" (3 chars after "can") was not matched.
 *   Changed to `can(?:not|.?t)\s+accept`.
 * S98-B6 (2026-07-26) — "This is below my expectations." returned NONE.
 *   Added `below\s+(?:my\s+)?expectations`.
 * S98-B7 (2026-07-26) — "The salary is not competitive." returned NONE.
 *   Added `not\s+competitive`. */
/* S122-B2 (wave 28) — bare "too low" had no negation guard (unlike most other rejectWords
 * arms), so "Not too low, actually it's pretty fair." fired rejected=true. Added a
 * lookbehind, matching the guard style used elsewhere in this regex.
 * S122-B4 (wave 28) — "that's insulting" required the exact "that's" subject; "this is
 * insulting" (equally common) fell through to NONE, letting a trailing accept phrase win.
 * Broadened to accept that/this/it + 's or "is".
 * S123-B1 (wave 29) — "I don't think this works for me." fired accepted=true via the bare
 * "works (for me)" arm in acceptWords, with no negation guard covering "don't think X
 * works" (the negated word is "think", not "work" itself, so the existing
 * don't/doesn't-work arms didn't catch it). Added a dedicated positive arm here (paired
 * with acceptNegationRe below, which suppresses the accept signal for the same phrase) so
 * this natural rejection phrasing now correctly scores rejected=true.
 * S123-B3 (wave 29) — bare "wouldn't accept" had no guard against the litotes/hedge frame
 * "I can't say I wouldn't accept that" (implies likely acceptance, not rejection). Added a
 * negative lookbehind for the enclosing "can't/couldn't say" frame. */
const rejectWords = /\b(not acceptable|(?<!not\s)(?<!n't\s)too low|can(?:not|\s+not|'?t)\s+accept|absolutely not|bilkul\s+nahi(?:n)?|not enough|walk away(?!\s+with\b)|not interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|i\s+(?:have|need|am\s+going)\s+to\s+reject|i reject|no deal|way too low|(?:that|this|it)(?:'?s|\s+is)\s+insulting|stick(?:ing)?\s+with(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|hold(?:ing)?\s+(?:at|firm)(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|stay(?:ing)?\s+at(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|firm\s+at(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|won.?t\s+(?:go\s+)?(?:below|under|lower)|won.?t\s+accept|(?<!can.?t\s+say\s+i\s)(?<!couldn.?t\s+say\s+i\s)(?<!not\s+that\s+i\s)would.?n.?t\s+accept|would\s+not\s+accept|not\s+going\s+to\s+accept|refuse\s+to\s+accept|can(?:not|.t)\s+justify\s+(?:leaving|taking|accepting|joining)|don.?t\s+work|doesn.?t\s+work|does\s+not\s+work|(?:don.?t|do\s+not|doesn.?t|does\s+not|didn.?t|did\s+not|won.?t|wouldn.?t)\s+think\s+(?:\w+\s+){0,3}works?\b|need(?:s)?\s+at\s+least|expect(?:ing)?\s+at\s+least\s*\d|^no\b[^.]*\b(?:lakh|lpa|crore|cr\b)|(?<!n't\s)(?<!not\s)(?:need|like|want)\s+(?:a\s+)?(?:more|higher|additional|extra|better)\s+(?:fixed|base|variable|equity|ctc|salary|comp(?:ensation)?|package|money|cash|number|figure|amount)|need\s+(?:much|significantly|considerably|a\s+lot)\s+more|insufficient|(?:does?\s+not|doesn.?t)\s+meet\s+(?:my\s+)?(?:expectations|requirements|needs|standards|criteria)|falls?\s+short\s+of\s+(?:my\s+)?(?:expectations|requirements|needs|standards)|have\s+to\s+say\s+no|won.?t\s+work\s+for\s+(?:me|us)|not\s+at\s+(?:this|that)\s+(?:number|price|rate|figure|amount|salary)|not\s+(?:okay|comfortable)\s+with\s+(?:this|that|the)|below\s+(?:my\s+)?expectations|way\s+(?:below|off)\s+(?:from\s+)?(?:my\s+)?(?:expectations?|target|ask|requirements?)?|below\s+(?:market|industry)\s+(?:rate|average|standard|benchmark|value)|(?:a\s+bit|slightly|somewhat|rather)\s+low(?![-\w])|(?:much|significantly|considerably|somewhat|slightly|a\s+bit|rather|quite|fairly)\s+lower\s+than\s+(?:(?:my\s+)?(?:current\s+)?(?:target|expectations?|ask|number|figure|estimate|package|salary|ctc|comp(?:ensation)?|offer)|what\s+(?:i|we)\s+(?:asked|expected|hoped|wanted|was\s+expecting|were\s+expecting)\s+for)|not\s+up\s+to\s+(?:my\s+)?expectations|(?:was|am|have\s+been|had\s+been)\s+expecting\s+(?:(?:much|a\s+bit|a\s+little|somewhat|slightly|a\s+lot)\s+)?more|expected\s+(?:much\s+)?more\s+(?:from|than|for)|not what\s+(?:i|we)\s+(?:was|were|am|are|had\s+been)\s+hoping\s+for|not\s+competitive|isn.?t\s+(?:competitive|sufficient|acceptable|satisfactory)|not\s+sufficient|not\s+satisfact(?:ory|ory)|isn.?t\s+satisfact(?:ory)|inadequate|unacceptable|not\s+satisfied\s+with\s+(?:(?:this|that)\b|(?:(?:this|that|the)\s+)?(?:offer|salary|package|ctc|comp(?:ensation)?|number|figure|amount|deal|proposal))|(?:does?\s+not|doesn.?t)\s+align\s+with\s+(?:(?:my|industry|market|current)\s+)?(?:expectations|requirements|needs|standards)|not\s+in\s+(?:the\s+)?ballpark|(?:i.?m|i\s+am)\s+worth\s+more\s+than|(?:doesn.?t|does\s+not)\s+reflect\s+(?:my\s+)?(?:market\s+value|worth|value)|expected\s+(?:a\s+)?(?:much\s+)?(?:higher|more|better(?!\s+(?:communication|service|support|response|feedback|handling|attitude|behavior|professionalism|transparency|clarity|outcome|explanation|experience|result|performance|effort|opportunity|treatment)))\s+(?:number|figure|amount|salary|ctc|package|offer|compensation\b)?|(?:a\s+)?(?:significant|major|substantial|huge|massive|big|severe)?\s*pay\s+cut|leaving\s+(?:a\s+lot\s+of\s+)?money\s+on\s+the\s+table|(?:ctc|salary|comp(?:ensation)?|package|fixed|base|variable|take.?home)\s+(?:to\s+be\s+)?at\s+least|hoping\s+for\s+at\s+least|not\s+what\s+(?:i|we)\s+(?:was|were|am|are|had\s+been|have\s+been)\s+expecting|disappoint(?:ed|ing)\s+with\s+(?:(?:this|that|the)\s+)?(?:offer|salary|package|ctc|comp(?:ensation)?|number|figure|amount)|doesn.?t\s+excite\s+(?:me|us)|underwhelm(?:ing|ed)|below\s+par|not\s+aligned\s+with\s+my\s+(?:worth|value|experience|expectations?|standards?)|not\s+happy\s+with\s+(?:this|that|the\s+(?:offer|salary|package|ctc|comp(?:ensation)?|number|figure|amount|deal|proposal))|(?:does?\s+not|doesn.?t)\s+meet(?:ing)?\s+(?:my\s+)?(?:expectations|requirements|needs|standards|criteria)|cannot\s+work\s+for\s+this\s+(?:salary|offer|number|ctc|package)|(?:a\s+)?letdown|too\s+far\s+from\s+(?:what\s+i.?m\s+looking\s+for|my\s+(?:expectations?|target|ask))|expected\s+(?:much\s+)?better(?!\s+(?:communication|service|support|response|feedback|handling|attitude|behavior|professionalism|transparency|clarity|outcome|explanation|experience|result|performance|effort|opportunity|treatment))(?:\s+than\s+(?:this|that))?|(?:a\s+bit|slightly|somewhat|rather|quite)\s+low(?![-\w])|(?:need|want|expect(?:ing)?)\s+more\s+than\s+(?:this|that|what(?:\s+(?:i|we)\s+(?:want|need|expected|hoped\s+for))?)|(?:fixed|base|variable|equity|ctc|salary|comp(?:ensation)?|package|money|cash|number|figure|amount)\s+(?:\w+\s+)?needs?\s+to\s+be\s+(?:higher|more|better|increased)|not\s+in\s+(?:practice|reality)|hoping\s+for\s+(?:a\s+)?(?:more|higher|better)\s+(?:fixed|base|variable|equity|ctc|salary|comp(?:ensation)?|package|bonus)|(?:slightly|a\s+bit|somewhat|rather)\s+below\s+(?:what\s+(?:i|we)\s+(?:was\s+expecting|were\s+expecting|expected|am\s+expecting|have\s+been\s+expecting)|my\s+expectations?)|not\s+(?:really\s+|fully\s+|truly\s+|quite\s+)?aligned\s+with\s+(?:(?:my|industry|market|current)\s+)?(?:expectations|requirements|needs|standards)|won.?t\s+(?:go|work|accept|take)\s+(?:for\s+)?anything\s+less\s+than|lowball|not\s+(?:even\s+)?close|doesn.?t\s+come\s+close|seen\s+better(?:\s+offers?)?|losing\s+money|below\s+(?:my\s+)?walk.?away\s+(?:number|figure|point)|pasand\s+nahi(?:n)?|accha\s+nahi(?:n)?\s+laga)/i;
/* S84 (2026-07-26) — `if` added to hedgeWords so "I'll take it if X" / "Count me in if X"
 * are correctly marked conditionalAccept=true instead of full accepted=true.
 * S98-B8 (2026-07-26) — "Yes, as long as the start date is flexible." returned NONE (not
 *   cond acc). "as long as" / "so long as" are conditional conjunctions not in hedgeWords.
 *   Added both. Also synced to hedgeRe in follow-up.ts. */
/* S121-B4 (wave 27) — "lekin" (Hindi "but") was not recognized as a hedge conjunction,
 * so Hindi-hedged conditional accepts fell through to full accepted=true. */
/* S134-B1 (wave 40) — "although" was missing; \b(...)\b's "though" arm doesn't match
 * inside "although" (no word boundary between "al" and "though"), so any hedge phrased
 * with "although" was entirely invisible to hasAnyHedge, letting a top-priority
 * accepted/rejected clause on either side of it win unconditionally instead of being
 * arbitrated by the hedge logic. */
const hedgeWords = /\b(but|however|only if|unless|provided|on condition|contingent|except|although|though|if|as\s+long\s+as|so\s+long\s+as|par\b|lekin)\b/i;
/* S121-B6 (wave 27) — deflectWords only covered a handful of literal phrases; generic
 * topic-redirect constructions ("can we talk about the bonus instead", "let's circle
 * back to this") returned NONE instead of deflected=true. Added generic redirect arms. */
/* S122-B5 (wave 28) — the `what.*you.*offer` arm used unbounded greedy wildcards with no
 * topic restriction, so it fired on legitimate clarifying questions like "What can you
 * offer me in terms of growth here?" / "What benefits do you offer besides the base
 * salary?" (candidate asking about non-cash offerings, NOT deflecting the salary
 * question). Bounded the wildcards (matching the style of the other arms in this regex)
 * and excluded the common non-cash-topic followers.
 * S122-B5-fix2 (wave 28) — the exclusion lookahead required the topic phrase to follow
 * "offer" IMMEDIATELY, so "offer ME in terms of growth" (object pronoun between "offer"
 * and "in terms of") still matched and deflected=true. Allowed up to 2 filler words
 * (me/us/here/etc.) before the excluded topic phrase. */
const deflectWords = /\b(you first|you go first|your offer|what(?:\s+\w+){0,3}\s+(?:you|your)(?:\s+\w+){0,2}\s+offer\b(?!(?:\s+\w+){0,2}\s*(?:in\s+terms\s+of|for\s+(?:growth|learning|benefits|development|training)|besides|other\s+than))|tell me.*first|don.?t want to share|prefer not|rather not|you tell me|(?:talk|discuss)\s+about\s+\w+(?:\s+\w+){0,3}\s+instead|circle\s+back|come\s+back\s+to\s+this|discuss\s+\w+(?:\s+\w+){0,2}\s+first(?!\s+(?:offer|number|figure|salary|ctc)))\b/i;
/* S95-B4 (2026-07-26) — thinkWords missing time-period phrases: "a day or two to think",
 * "I need the weekend to decide", "a night to think" all returned needsTime=false.
 * Added `a\s+(?:day|week|night)(?:\s+or\s+two)?\s+to\s+(?:think|decide|consider|review)`.
 * S92-B1 (2026-07-26) — thinkWords gaps: "check with spouse" ("check with" not "talk to";
 * "spouse" not in list); "think this through" (not the same as "think about"); "have time
 * to think" / "need time to decide" — bare "time to think/decide" not covered. Added:
 * check/consult/speak/discuss with family-synonym; time to think/decide; think through.
 * NOTE: "talk to" arm retains `.*` (flexible preposition); new forms use explicit "with".
 * S96-B4 (2026-07-26) — "Can you give me until tomorrow?" returned needsTime=false.
 *   Added `give\s+me\s+(?:until|till)` and `until\s+tomorrow|till\s+tomorrow`.
 * S96-B5 (2026-07-26) — "a couple of days before deciding" returned needsTime=false.
 *   Added `couple\s+of\s+days`.
 * S97-B7 (2026-07-26) — "Let me take some time to reflect." returned NONE. Added
 *   `take\s+(?:some\s+)?(?:more\s+)?time\s+to\s+(?:think|reflect|consider|review|decide|evaluate|process)|(?:like|want|need)\s+(?:some\s+)?(?:more\s+)?time\s+to\s+(?:think|reflect|consider|review|decide|evaluate|process)`.
 * S97-B7b (2026-07-26) — "I need to review this with my lawyer before deciding." returned
 *   NONE. Added professional-advisor arm alongside the existing family-relative arm.
 * S98-B9 (2026-07-26) — "I need a few days." returned NONE. Added `(?:a\s+)?few\s+days`.
 * S98-B10 (2026-07-26) — "Let me mull it over." returned NONE. Added `mull\s+(?:it\s+)?over`.
 * S98-B11 (2026-07-26) — "Can I have until end of week?" returned NONE.
 *   Added `until\s+end\s+of\s+(?:the\s+)?(?:week|month|day)`. */
const thinkWords = /\b(need time|think about|think this through|think it through|time to think|time to decide|sleep on|let me think(?!\s+out\s+loud)|(?:need\s+to|want\s+to|like\s+to|let\s+me|give\s+me\s+time\s+to|have\s+to|going\s+to|time\s+to|would\s+like\s+to)\s+consider|a\s+(?:day|week|night)(?:\s+or\s+two)?\s+to\s+(?:think|decide|consider|review)|(?:(?:the\s+)?weekend\s+to\s+(?:think|decide|consider|review)|(?:get|have)\s+(?:the\s+)?weekend(?:\s+to\s+(?:think|decide|consider|review))?)|couple\s+of\s+days|(?:a\s+)?few\s+(?:more\s+)?days|give\s+me\s+(?:until|till)|have\s+(?:until|till)\b|until\s+tomorrow|till\s+tomorrow|until\s+end\s+of\s+(?:the\s+)?(?:week|month|day)|mull\s+(?:(?:it|this|that)\s+)?over|\d+\s+(?:hours?|minutes?)\s+to\s+(?:think|decide|consider|review)|sochne\s+do|soch\s+lene\s+do|(?:mujhe\s+)?time\s+chahiye|talk to.*(?:spouse|family|partner|wife|husband|parents?|folks?)|(?:check|speak)\s+with\s+(?:my\s+)?(?:spouse|family|partner|wife|husband|parents?|folks?|ca\b|lawyer|attorney|advisor|accountant|mentor)|discuss(?:\s+(?:it|this|that))?\s+with\s+(?:my\s+)?(?:spouse|family|partner|wife|husband|parents?|folks?)|consult(?:\s+with)?\s+(?:my\s+)?(?:spouse|family|partner|wife|husband|parents?|folks?|lawyer|attorney|advisor|accountant|ca\b|mentor)|get back to you|not ready|let\s+me\s+review\s+(?:the\s+)?(?:offer|contract|terms|agreement|package|letter|document)|take\s+(?:some\s+)?(?:more\s+)?time\s+to\s+(?:think|reflect|consider|review|decide|evaluate|process)|(?:like|want|need|have)\s+(?:some\s+)?(?:more\s+)?time\s+to\s+(?:think|reflect|consider|review|decide|evaluate|process)|(?:review|consult|discuss)\s+(?:this\s+)?with\s+(?:my\s+)?(?:lawyer|attorney|advisor|accountant|ca\b|mentor)|run\s+(?:this|it|that)\s+by\s+(?:my\s+)?(?:spouse|family|partner|wife|husband|parents?|folks?|lawyer|attorney|advisor|accountant|ca\b|mentor|team|manager|boss|colleagues?|co.?founder)|sit\s+(?:with\s+(?:this|it|that)|on\s+(?:this|it|that))|ponder(?:ing)?(?:\s+(?:this|it|that|over))?|give\s+me\s+(?:a\s+|one\s+|\d+\s+)(?:hours?|days?|weeks?)|discuss\s+(?:this|it|that)\s+internally|couple\s+of\s+weeks|want\s+to\s+process\s+(?:this|the\s+(?:offer|information|news|details|proposal|package|number|figures?))|(?:need|want)\s+(?:some\s+)?space\s+to\s+(?:decide|think|consider|reflect|evaluate|process)|revisit\s+(?:this|it|that\s+)?tomorrow|chew\s+on\s+this|take\s+(?:some\s+)?time\s+before\s+(?:committing|deciding|answering)|a\s+moment\s+to\s+(?:think|reflect|consider|decide|evaluate|process)|(?:like|want|need|have|appreciate)\s+(?:some\s+)?(?:more\s+)?time\s+to\s+(?:think|reflect|consider|review|decide|evaluate|process)|weigh\s+my\s+options|deliberate|loop\s+in\s+(?:my\s+)?(?:spouse|family|partner|wife|husband|parents?|folks?|ca\b|advisor|lawyer|accountant)|before\s+(?:deciding|committing|finalizing|giving\s+(?:my|an)\s+(?:final\s+)?answer)|sochna\s+padega|soch(?:na|kar)\s+(?:bataunga|batati|bataenge)|sochna\s+hai|(?:thoda|kuch|zara)?\s*time\s+dijiye|(?:family|parivar|ghar|biwi|pati|wife|husband)\s+se\s+baat\s+karni\s+hai)\b/i;
/* S91-B1 (2026-07-26) — "another offer" not matched (word boundary before "other" in
 * "another" doesn't exist); "other companies" not matched (had "another company" but not
 * plural). Added: another offer, another opportunity, other companies/options,
 * interviewing with (had "at"), also interviewing/exploring, have an offer. */
const competingWords = /\b(other offer|another offer|another opportunity|competing|another company|other companies|other options|other opportunities|counter.?offer|multiple offers|also talking|also interviewing|also exploring|interviewing at|interviewing with|got an offer|have an offer|received an offer|better\s+offers?\s+elsewhere)\b/i;
/* S78-B1 (2026-07-25) — bare `move on` fired on "Let's move on to equity"
 * (topic-redirect). First-person departure frame required, mirroring WALKAWAY_PATTERN. */
/* S78-B2 (2026-07-25) — `i.?m out` fired on "I'm out of ideas/options/moves"
 * (candidate still negotiating). Added `(?!\s+of\b)` to suppress the "out of X" form. */
/* S80-B1 (2026-07-26) — `i.?ll pass` and `have to pass` fired on hand-off phrases:
 * "I'll pass your proposal to my partner" / "I have to pass this to my manager".
 * Added along/to-recipient guard matching WALKAWAY_PATTERN (widened window to 25 chars).
 * S80-B3 (2026-07-26) — `no chance` fired on hardball anchor "No chance I'm settling
 * for less than 45L" — candidate asserting a floor, NOT walking. Added first-person
 * floor-verb guard: suppresses when followed by go-below/settle/accept-less/etc.
 * S81-B1 (2026-07-26) — `not worth` fired on "not worth fighting over 2L — can we split
 * it?" (counter-proposal, not walk). Added dispute-gerund guard.
 * S81-B2 (2026-07-26) — `i decline` fired on "I decline to answer that" (refusing to
 * reveal salary info, NOT walking). Added `to [reveal/answer/disclose/share/...]` guard. */
/* S85 (2026-07-26) — synced guards from canonical WALKAWAY_PATTERN:
 * no deal -> no deal(?!\s+on\s+the\s+table); withdraw exclusion + complaint/concern/etc;
 * isn.?t -> is(?:n.?t|\s+not); departure frame adds bare `am` for "I am moving on"
 * S96-B6 (2026-07-26) — "I am going to explore other opportunities" returned walkAway=false
 *   (only comp=true). "going to explore/pursue other options/opportunities" added.
 * S96-B7 (2026-07-26) — "I am no longer interested in pursuing this" returned NONE.
 *   Added `no\s+longer\s+interested` with same component-noun guard as `not interested`.
 * S96-B8 (2026-07-26) — "I think it is best we part ways here" returned NONE.
 *   Added `part\s+ways`. All three also synced to WALKAWAY_PATTERN + walkRe.
 * S97-B3 (2026-07-26) — "I am withdrawing my application." returned NONE. `withdraw` with
 *   word-boundary `\b` at end did not match `withdrawing` (next char `i` = no boundary).
 *   Fixed: `withdraw` → `withdraw(?:ing)?`. WALKAWAY_PATTERN already had `(?:ing)?`; now synced.
 * S97-B9 (2026-07-26) — "I am removing myself from this process." and "Please take me off
 *   your list." returned NONE. Added `remov(?:e|ing)\s+myself\s+from` and `take\s+me\s+off`.
 *   Also replaced bare `take the other` with `tak(?:e|ing)\s+(?:the\s+)?(?:other|another)\s+(?:offer|opportunity|position|role|job)`
 *   so "take another offer" is covered. All three files synced.
 * S98-B12 (2026-07-26) — "I respectfully decline." / "I must decline this offer." returned
 *   NONE. walkAwayWords only had `i decline(?!\s+to...)` (no room for adverb/modal before
 *   "decline"). Added `(?:respectfully|reluctantly|regretfully|sadly)\s+declin(?:e|ing)` and
 *   `(?:must|have\s+to|going\s+to)\s+declin(?:e|ing)` arms (both with info-verb guard).
 * S98-B13 (2026-07-26) — "I am choosing to move on." returned NONE. Departure frame only
 *   covers `i am going to / i will` etc., not `i am choosing to`. Added
 *   `choosing\s+to\s+(?:move\s+on|pursue\s+other|explore\s+other)`.
 * S98-B14 (2026-07-26) — "I will be pursuing other opportunities." returned comp only.
 *   Departure frame requires `going\s+to\s+|gonna\s+` before `pursue other` — "be pursuing"
 *   uses gerund + no frame. Added `(?:will\s+)?be\s+pursuing\s+other\s+(?:options|opportunities)`.
 * S98-B15 (2026-07-26) — "I have accepted a position elsewhere." returned NONE.
 *   Added `accepted\s+(?:a|an)\s+(?:position|offer|role|job)(?:\s+elsewhere|\s+(?:at|with)\s+another)?`.
 * S98-B16 (2026-07-26) — "I have decided to go with another company." returned comp only.
 *   Added `(?:decided|chosen)\s+to\s+go\s+with\s+(?:another|a\s+different|the\s+other)\s+(?:company|offer|organization|firm|employer)`.
 *   All new patterns synced to walkRe (follow-up.ts) and WALKAWAY_PATTERN (_walkaway-detection.ts). */
const walkAwayWords = /\b(hard\s+pass\b|walk(?:ing|in)?\s+away(?!\s+with\b)|i\s+(?:am\s+)?(?:going\s+to\s+)?walk(?!\s+(?:you|me|through|us|with)\b)(?:ing)?(?:\s+away|\s+out|(?=[.,!?;]|\s*$))|i.?m\s+done\s+(?:negotiating(?!\s+(?:about|over|with|on)\s+)|here(?!\s+for\s+now\b)|with\s+this|talking|discussing|waiting)|i\s+refuse\s+to\s+(?:play|negotiate|continue|proceed)|not a chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing))))|that won.?t work|let.?s\s+end\s+(?:this|the)\s+(?:conversation|discussion|call|negotiation)|i.?m out(?!\s+of\b(?!\s*here\b))|not interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|no\s+longer\s+interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|part\s+ways|no chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing))))|i(?:.ll|.?m\s+going\s+to|\s+will|\s+would\s+rather|\s+think\s+i.ll|\s+guess\s+i.ll|\s+have\s+to|\s+need\s+to|\s+am\s+going\s+to)\s+pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b)|\s+on\s+(?:dessert|lunch|dinner|breakfast|coffee|tea|the\s+(?:food|meal|drinks?)))|no deal\b(?!\s*(?:[-\s]?breakers?|\s+on\s+the\s+table))|withdraw(?:ing)?(?!\s+(?:my|your|the|this)\s+(?:\w+\s+)?(?:counter|demand|ask|offer|request|proposal|requirement|expectation|complaint|concern|feedback|objection|comment|remark|statement|amendment)\b)|decline the offer|i\s+(?:hereby\s+|now\s+|regretfully\s+|respectfully\s+|reluctantly\s+|formally\s+|sadly\s+|must\s+|will\s+)?declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|i(?:'|’)?(?:ll|m|d)\s+(?:going\s+to\s+|gonna\s+|have\s+to\s+|respectfully\s+|reluctantly\s+|regretfully\s+|formally\s+|sadly\s+|probably\s+|just\s+|now\s+)*declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|(?:respectfully|reluctantly|regretfully|formally|sadly)\s+declin(?:e|ing)|(?:have|going)\s+to\s+declin(?:e|ing)(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|pull(?:ing)?\s+out(?!\s+(?:all\b|my\b|your\b|our\b|their\b|his\b|her\b|its\b|some\b|any\b))|not worth(?!\s+(?:fight|argu|bicker|quarrel|quibbl|debat|nit.?pick|hassle))|won.?t work(?!\s+for\s+(?:more|longer|over|above|anything\s+less)\s+than)|is(?:n.?t|\s+not)\s+going\s+to\s+work|(?:i(?:.m|.ll|.d)|i\s+(?:will|would\s+rather|think\s+i.ll|guess\s+i.ll|want\s+to|have\s+to|need\s+to|am\s+going\s+to|am))\s+(?:(?:just|then|probably|simply|really|now|rather|likely|instead)\s+)?(?:going\s+to\s+(?:have\s+to\s+)?|gonna\s+(?:have\s+to\s+)?)?(?:have\s+to\s+)?(?:(?:move|moving)\s+on|explore\s+other\s+(?:options|opportunities)|pursue\s+other\s+(?:options|opportunities))|(?:choosing|chosen|decided)\s+to\s+(?:move\s+on|pursue\s+other\s+(?:options|opportunities)|explore\s+other\s+(?:options|opportunities))|made\s+(?:my|a)\s+decision\s+to\s+(?:move\s+on|pursue\s+other|explore\s+other)|(?:will\s+)?be\s+pursuing\s+other\s+(?:options|opportunities)|(?:will\s+)?be\s+moving\s+on|(?:will\s+)?be\s+passing\s+on\s+(?:this|the\s+(?:offer|opportunity|role|position))|no\s+longer\s+pursuing\s+(?:this|the)\s+(?:role|position|opportunity|offer|job)|tak(?:e|ing)\s+(?:the\s+)?(?:other|another)\s+(?:offer|opportunity|position|role|job)|accepted\s+(?:a|an|another)\s+(?:position|offer|role|job)(?:\s+elsewhere|\s+(?:at|with)\s+another)?|(?:decided|chosen)\s+to\s+go\s+with\s+(?:another|a\s+different|the\s+other)\s+(?:company|offer|organization|firm|employer)|(?:chosen|decided)\s+to\s+accept\s+(?:a|an|another)\s+(?:offer|position|role|job)|step(?:ping)?\s+back\s+from\s+(?:this|the)|opt(?:ing|ed)\s+out\s+of\s+(?:this|the)|prefer\s+to\s+(?:explore|pursue|consider)\s+other\s+(?:options?|opportunities?|avenues?|paths?|alternatives?)|thanks but no|not for me|(?<!kam\s)nahi\s+(?:chahiye|karna|banega|hoga|chalega|chal\s+payega|jamega|jaa?ung[ai]|lung[ai])|(?:yeh|ye)\s+nahi\s+kar\s+sakta|nahin\s+(?:chahiye|karna|chalega)|join\s+nahi(?:n)?\s+kar(?:unga|ungi|enge|na)?|mujhe\s+nahi(?:n)?\s+chahiye|remov(?:e|ing)\s+myself\s+from\s+(?:(?:this|the)\s+)?(?:process|consideration|pipeline)|take\s+me\s+off\s+(?:your|the)\s+list|have to pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|i(?:.ll|.d|\s+will)\s+need\s+to\s+pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|(?:reached|at)\s+an?\s+impasse|(?:don.?t|do\s+not)\s+think\s+(?:this|it|that)\s+is\s+going\s+to\s+work(?:\s+out)?|call\s+it\s+quits|bow(?:ing)?\s+out(?:\s+of\s+(?:this|the))?|i(?:.ll|.d|\s+will|\s+would)\s+be\s+declin(?:ing)?|can(?:not|.t)\s+(?:come\s+to|reach)\s+(?:an?\s+agreement|terms)|(?:i(?:.ll|.d|\s+will)\s+|i\s+(?:have|need)\s+to\s+|i.?m\s+going\s+to\s+|going\s+to\s+(?:have\s+to\s+)?)look(?:ing)?\s+elsewhere|no\s+longer\s+(?:wish|want)\s+to\s+(?:proceed|continue|negotiate|participate|move\s+forward)|decided\s+not\s+to\s+(?:move\s+forward|proceed|continue|accept(?:\s+this)?)|step(?:ping)?\s+away(?:(?!\s+from\s+)|\s+from\s+(?:this|the\s+(?:negotiation|process|offer|role|position|opportunity|deal|table|conversation|discussion)))|made\s+up\s+my\s+mind\s+to\s+(?:decline|not\s+accept|walk\s+away)|end(?:ing)?\s+my\s+participation|(?:reached?\s+a|at\s+a)\s+dead\s+end|exit(?:ing)?\s+(?:this\s+|the\s+)?(?:negotiation|process|conversation|discussion)|this\s+role\s+(?:isn.?t|is\s+not)\s+for\s+me|won.?t\s+be\s+(?:accepting|moving\s+forward\s+with)\s+(?:this|the))\b/i;
/* S88-B1 (2026-07-26) — Added Hindi affirmatives (haan, hanji, ji haan, theek hai,
 * bilkul, etc.) — Indian users commonly answer bare Hindi "yes" during negotiations;
 * all previously returned accepted=false. */
const shortAffirmativeStart = /^(yes|yeah|okay|ok|sure|deal|agreed|sounds\s+good|that works|fine|absolutely|perfect|haan(?!\s+nahi(?:n)?\b)|hanji|ji\s+haan|ha\s+ji|han\s+ji|theek\s+hai|thik\s+hai|bilkul(?!\s+nahi(?:n)?\b))\b/i;

/** Classify the candidate's answer in a salary negotiation. */
export function detectCandidateIntent(answer: string): CandidateIntent {
  const trimmed = (answer || "").trim();
  if (!trimmed) {
    return { accepted: false, conditionalAccept: false, rejected: false, walkAway: false, deflected: false, needsTime: false, mentionedCompeting: false };
  }

  /* S136-B3 (wave 42) — acceptSarcasmRe only recognized the "like/as if...I'd accept"
   * sarcasm frame; the mirror-image "like/as if...I'd walk away" self-mockery had no
   * equivalent guard, so bare walkAwayWords/rejectWords arms read it literally and
   * inverted clearly positive sentiment (e.g. "Oh sure, like I would ever walk away
   * from a bird in hand — I accept!"). Mirrors acceptSarcasmRe's first arm verbatim.
   * Declared early (before hedgeIsRejection) since the sarcasm frame's own "if" can
   * itself become the detected hedge, embedding a literal "walk away" in postHedgeText. */
  const walkAwaySarcasmRe =
    /\b(?:like|as\s+if)[\s.,]+i(?:.?d|.?ll|\s+would|\s+will)?\s+(?:ever\s+)?walk\s+away\b/i;

  const isShortAffirmative = trimmed.split(/\s+/).length < 8
    && shortAffirmativeStart.test(trimmed)
    && !hedgeWords.test(trimmed)
    && !rejectWords.test(trimmed);

  /* S88-B2 (2026-07-26) — "Sure, if you can bump to 38L" / "Deal, though I want equity
   * too" returned accepted=false, conditionalAccept=false. The old code had no path for
   * short-affirmative + hedge because: (a) isShortAffirmative excluded hedges, and
   * (b) short tokens (sure/deal/ok/fine) are not in acceptWords. Added a separate
   * isShortAffirmativeConditional path computed before acceptIdx so hedgeIsRejection
   * (derived from postHedgeText) guards it properly.
   * S89-B1 (2026-07-26) — word limit raised 12→18 to cover longer conditional accepts
   * ("Ok, if you can confirm by EOD and include joining bonus in writing" is 14 words).
   * thinkWords guard added to prevent "Ok, I need to think about this if possible" from
   * firing as a conditional accept. */
  const hedgeMatch = hedgeWords.exec(trimmed);
  const hedgeIdx = hedgeMatch ? hedgeMatch.index : -1;
  const hasAnyHedge = hedgeIdx >= 0;
  const postHedgeText = hasAnyHedge ? trimmed.slice(hedgeIdx) : "";
  /* S133-B2 (wave 39) — the pre-hedge counterpart of postHedgeText, used to rescue a
   * genuine walk-away statement that appears BEFORE the hedge word when the post-hedge
   * clause is an unrelated accept ("I'm walking away from the equity discussion, but I
   * accept the base salary."). S129-B1 (wave 35) already handles the reverse ordering
   * (accept-then-walkaway suppresses accepted); this handles walkaway-then-accept, which
   * was previously discarded entirely by the base walkAway clause's blanket !accepted
   * gate. */
  const preHedgeText = hasAnyHedge ? trimmed.slice(0, hedgeIdx) : "";
  /* S129-B1 (wave 35) — "I am in, but I also do not think this is going to work out for
   * me." fired accepted=true AND walkAway=true simultaneously: hedgeIsRejection only
   * tested the post-hedge clause against rejectWords, never walkAwayWords, so genuine
   * departure phrasing that lives only in walkAwayWords ("don't think this is going to
   * work out", "withdrawing from this process") failed to suppress accepted. Since
   * accepted outranks walkAway in follow-up.ts's intentBanner priority, this told the LLM
   * to "take the yes" on a candidate walking away in the same breath. */
  /* S129-B1 fix-up — a conditional walk-away THREAT ("...but I am walking away if you
   * cannot match it") is an established exception (see S94-B1): the candidate hasn't
   * actually left, they're negotiating with an ultimatum, so it must NOT suppress
   * accepted the way a genuine unconditional departure statement does. Distinguish via
   * an "if" anywhere in the post-hedge clause — present for conditional threats, absent
   * for unconditional walk-away statements like "I don't think this is going to work
   * out for me." */
  const postHedgeWalkAwayIsConditionalThreat = /\bif\b/i.test(postHedgeText);
  /* S134-B1 fix-up (wave 40) — "I reject this offer, although honestly it sounds good."
   * fired accepted=true because hedgeIsRejection only ever looked at postHedgeText: the
   * explicit "I reject" clause sits BEFORE the hedge here (reverse of the S129-B1/S133-B2
   * ordering), and acceptWords' "sounds good" arm matched the whole string via hasAccept,
   * so nothing suppressed it. Originally scoped to only the unambiguous "I reject"/"I have
   * to reject" phrase (not the full rejectWords list) because testing the full list against
   * preHedgeText regressed S132-B4 (third-party "my friend said I should walk away, but...")
   * and S133-B2 ("I was going to walk away, but I accept" retraction) — both hit rejectWords'
   * bare "walk away" arm.
   * S135-B2 (wave 41) — that scoping was too narrow: "Not acceptable — although honestly
   * the number itself sounds good." still fired accepted=true, since "not acceptable" isn't
   * the literal "I reject" phrase. Widened to the full rejectWords list, but excluding a
   * match on the walk-away arm specifically (mirrors rejectMatchIsWalkAwayArm below) — that
   * arm is the one already covered by the dedicated third-party/retraction guards, and is
   * the only arm that caused the S132-B4/S133-B2 regressions. */
  const preHedgeRejectMatch = rejectWords.exec(preHedgeText);
  const preHedgeRejectIsWalkAwayArm = !!preHedgeRejectMatch && /^walk\s+away/i.test(preHedgeRejectMatch[0]);
  const preHedgeIsRejection = !!preHedgeRejectMatch && !preHedgeRejectIsWalkAwayArm;
  /* S136-B3 (wave 42) — "As if I would walk away from this deal, I accept." hedges on
   * the literal "if" inside the sarcasm frame itself, so postHedgeText contains the bare
   * "walk away" phrase and rejectWords' unconditional arm fired hedgeIsRejection=true,
   * blocking accepted despite the walk-away being sarcastic self-mockery, not a real
   * hedge/condition. Guard with the same walkAwaySarcasmRe used for rejected/walkAway. */
  const hedgeIsRejection =
    !walkAwaySarcasmRe.test(trimmed) && (
      rejectWords.test(postHedgeText) ||
      preHedgeIsRejection ||
      (walkAwayWords.test(postHedgeText) && !postHedgeWalkAwayIsConditionalThreat));
  /* S128-B3 (wave 34) — a bare trailing hedge word with nothing after it ("I accept,
   * though." / "Deal, though.") is a hesitation filler, not a stated condition — genuine
   * conditional accepts have actual content following the hedge ("I accept, though I'd
   * like to discuss equity"). Without this guard the LLM was told to address a "specific
   * condition" that doesn't exist in the text. */
  const hedgeTrailingContent = hasAnyHedge
    ? trimmed.slice(hedgeIdx + hedgeMatch![0].length).replace(/^[\s,.:;!?]+|[\s.:;!?]+$/g, "")
    : "";
  const hedgeIsBareFiller = hasAnyHedge && hedgeTrailingContent.length === 0;
  /* S130-B1 (wave 36) — sarcastic/rhetorical refusals contain a literal acceptWords
   * phrase and had no guard against it: "Yeah right, like I'd accept that.", "Do you
   * really think I'd accept 20 LPA?", "I would accept this if hell froze over." all
   * fired accepted=true — the single highest-priority field in follow-up.ts's
   * intentBanner — telling the LLM to "TAKE THE YES" on an explicit refusal. Covers
   * the "like/as if I'd accept" sarcasm frame, the "do you (really) think I'd accept"
   * rhetorical-question frame, and "if hell froze over"/"if pigs could fly"
   * impossible-hypothetical idioms (which also otherwise slip through as a genuine
   * hedge condition, since "if" is a hedgeWords arm).
   * S131-B1 (wave 37) — two gaps in the frame above: (1) the far more natural NEGATED
   * phrasing of the rhetorical-question frame ("you DON'T think I'd accept this, do
   * you?") wasn't covered — only the bare "do you think" form was; (2) the "like"/"as
   * if" separator was a rigid `\s+`, so trivial punctuation variation ("like...I'd
   * accept", "like, I'd accept?!") broke the match entirely. Added an optional
   * negation clause to the rhetorical-question arm and widened the separator to
   * `[\s.,]+` (tolerates ellipses/commas, still requires at least one char). */
  const acceptSarcasmRe =
    /\b(?:like|as\s+if)[\s.,]+i(?:.?d|.?ll|\s+would|\s+will)?\s+(?:ever\s+)?accept\b|\b(?:do(?:es|did)?\s+)?you\s+(?:(?:don.?t|doesn.?t|didn.?t)\s+)?(?:really\s+|actually\s+)?think\s+i(?:.?d|.?ll|\s+would|\s+will)?\s+(?:ever\s+)?accept\b|\bif\s+hell\s+froze\s+over\b|\bif\s+pigs\s+(?:could|can)?\s*fly\b/i;
  /* A bare filler hedge ("Deal, though.") still makes this a short affirmative ACCEPT —
   * only the "conditional" characterization is wrong (there's no stated condition), so
   * isShortAffirmativeHedged (used for `accepted`) intentionally ignores hedgeIsBareFiller
   * while isShortAffirmativeConditional (used for `conditionalAccept`) does not. */
  const isShortAffirmativeHedged = trimmed.split(/\s+/).length < 18
    && shortAffirmativeStart.test(trimmed)
    && hasAnyHedge
    && !hedgeIsRejection
    && !thinkWords.test(trimmed)
    && !acceptSarcasmRe.test(trimmed);
  const isShortAffirmativeConditional = isShortAffirmativeHedged && !hedgeIsBareFiller;

  const acceptIdx = trimmed.search(acceptWords);
  const hasAccept = acceptIdx >= 0;
  const hasHedgeAfterAccept = hasAccept && hedgeIdx > acceptIdx && !hedgeIsBareFiller;

  /* S123-B1 (wave 29) — pairs with the new rejectWords arm above: "I don't think this
   * works for me" was matching acceptWords' bare "works (for me)" arm regardless of the
   * preceding "don't think" negation. Suppresses accepted so the paired rejectWords arm
   * (which now positively matches the same phrase) can set rejected=true instead. */
  const acceptNegationRe = /\b(?:don.?t|do\s+not|doesn.?t|does\s+not|didn.?t|did\s+not|won.?t|wouldn.?t)\s+think\s+(?:\w+\s+){0,3}works?\b/i;
  /* S127-B1 (wave 33) — "Sticking with 30 LPA is what I need. That works for me
   * otherwise." fired accepted=true AND rejected=true simultaneously: the number-lock
   * reject signal (added in S126-B1) is unambiguous and self-contained, but downstream
   * callers (follow-up.ts's intentBanner) branch on `accepted` FIRST and would tell the
   * LLM to "TAKE THE YES" while the candidate is still firmly holding their own number —
   * a contradictory, dishonest signal. A live number-lock means the candidate hasn't
   * actually agreed to terms, so it must suppress accepted too, not just co-fire reject. */
  /* S128-B1 (wave 34) — Hindi anchor "<number> se kam nahi lunga/lungi" ("I won't take
   * less than <number>") is semantically identical to the English number-lock arms but
   * had no equivalent here, so it fell through to walkAwayWords' bare "nahi lung[ai]" arm
   * instead — misfiring walkAway on a candidate who is still actively anchoring a number,
   * not leaving. Added as its own arm (no lookahead needed: "kam" ("less") is inherently
   * comparative, so it only ever follows a stated number). S129-B4 (wave 35) — the arm
   * only covered "lena" (take) conjugations, so "X se kam nahi chalega" ("won't work for
   * me below X") returned no signal at all; added "chalega" alongside. */
  const numberLockWords = /\b(?:stick(?:ing)?\s+with|hold(?:ing)?\s+(?:at|firm)|stay(?:ing)?\s+at|firm\s+at)(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))\b|\bse\s+kam\s+nahi\s+(?:lung[ai]|loong[ai]|chalega)\b/i;
  /* S135-B1 (wave 41) — numberLockWords.test(trimmed) scanned the ENTIRE reply for a
   * number-lock phrase ANYWHERE, so an unrelated number-lock in a later/earlier sentence
   * blanket-suppressed an accept/walk-away signal in a totally different sentence
   * ("I accept. Also, I'm sticking with 30 LPA." never fired accepted=true; "I'm out.
   * Also, I'm sticking with 30 LPA." never fired walkAway=true even though isWalkAway()
   * correctly did, a live divergence between the two functions).
   * Naively scoping the guard to only the SAME sentence as the match broke the existing
   * S127-B1 regression ("Sticking with 30 LPA is what I need. That works for me
   * otherwise." → accepted must stay false) — there the accept sentence anaphorically
   * refers back to the just-stated number ("that works for me" = the 30 LPA), so
   * cross-sentence suppression is still correct by default. The distinguishing signal is
   * whether the number-lock sentence is flagged as a distinct, separate remark via a
   * new-topic discourse marker ("Also," "Additionally," "By the way," "Separately,") — only
   * THEN does a cross-sentence lock stop applying; a same-sentence lock always applies
   * (S128-B1's Hindi idiom keeps suppressing correctly, same sentence either way). */
  const newTopicMarkerRe = /^\s*(?:also|additionally|besides|separately|by\s+the\s+way|aside\s+from\s+(?:that|this))\b/i;
  function sentenceAroundLocal(text: string, idx: number): string {
    const enders = /[.!?]/g;
    let start = 0;
    let end = text.length;
    let m: RegExpExecArray | null;
    while ((m = enders.exec(text))) {
      if (m.index < idx) start = m.index + 1;
      else { end = m.index; break; }
    }
    return text.slice(start, end);
  }
  function numberLockAppliesToLocal(text: string, match: RegExpExecArray | null): boolean {
    if (!match || !numberLockWords.test(text)) return false;
    const matchSentence = sentenceAroundLocal(text, match.index);
    if (numberLockWords.test(matchSentence)) return true;
    const lockMatch = numberLockWords.exec(text);
    if (lockMatch && newTopicMarkerRe.test(sentenceAroundLocal(text, lockMatch.index))) return false;
    return true;
  }
  const acceptMatchForLock = acceptWords.exec(trimmed);
  const accepted = (hasAccept || isShortAffirmative || isShortAffirmativeHedged) && !hedgeIsRejection && !acceptNegationRe.test(trimmed) && !(hasAccept ? numberLockAppliesToLocal(trimmed, acceptMatchForLock) : numberLockWords.test(trimmed)) && !acceptSarcasmRe.test(trimmed);
  const conditionalAccept = accepted && (hasHedgeAfterAccept || isShortAffirmativeConditional);
  /* S117-B5 FP: "I don't think I need more equity" fires rejected because the
   * lookbehind (?<!n't\s) only checks 4 chars before "need" — "think I" breaks
   * the adjacency. Suppress when a long-range "don't think I need/want" pattern fires. */
  const rejNegationRe = /\b(?:don.?t|doesn.?t|do\s+not|does\s+not)\s+think\s+(?:i\s+)?(?:need|want|like)\s+(?:a\s+)?(?:more|higher|additional|extra|better)\b/i;
  /* S123-B2 (wave 29) — double-negative reassurance ("It's not like I'm not interested.",
   * "I can't say I'm not interested.") matched the bare "not interested" arm in both
   * rejectWords and walkAwayWords, terminating a live negotiation on what was actually a
   * statement of continued engagement. Mirrors NOT_INTERESTED_DOUBLE_NEGATION in
   * _walkaway-detection.ts — keep in sync. */
  const notInterestedDoubleNegationRe = /\b(?:not\s+like|not\s+that|isn.?t\s+that|can(?:not|.t)\s+say|wouldn.?t\s+say)\s+(?:i.?m|i\s+am)\s+not\s+interested\b|(?:i.?m|i\s+am)\s+not\s+not\s+interested\b/i;
  /* S94-B1 (2026-07-26) — "Sounds good, but actually I am walking away if you cannot
   * match it." returned walkAway=false because the accept signal ("sounds good") in the
   * pre-hedge clause suppressed the walk signal. Fix: also fire when walkAwayWords appears
   * in the post-hedge segment, regardless of any pre-hedge accept. */
  /* S121-B7 (wave 27, highest severity) — "I was about to walk away but let's talk more"
   * fired walkAway=true (and rejected=true) even though the candidate is explicitly
   * retracting the departure. "was about/going to X" is a retraction frame, not an
   * intent-to-depart — add it as a negator prefix.
   * S122-B1 (wave 28) — "I'm not walking away, just need a moment to think" fell through:
   * a bare "not" directly modifying the departure gerund wasn't in the negator set (only
   * multi-word negator phrases were), and "walking away" (gerund) wasn't matched by the
   * "walk\s+away" verb group either — only "walk away"/"walking away" without a leading
   * "not" was suppressed. This also desynced from DEPARTURE_NEGATOR in
   * _walkaway-detection.ts, which already treats bare "not" as a negator. Fixed by adding
   * a separate bare-"not" branch with a TIGHT 0-1 word gap (not the shared 0-4 word gap
   * used by the longer negator phrases) — a wide gap on bare "not" would risk suppressing
   * genuine future-conditional walk-aways like "I'm not sure, but I will walk away if you
   * don't match." (4 words between "not" and "walk away" there). Also broadened the verb
   * group to accept the gerund form ("walking away", "declining"). */
  const walkAwayNegationRe = /\b(?:(?:don.?t|do\s+not|doesn.?t|does\s+not|not\s+ready\s+to|not\s+going\s+to|never\s+want\s+to|won.?t|not\s+think\s+(?:i|we)\s+need\s+to|was\s+(?:about|going)\s+to)\s+(?:\w+\s+){0,4}|not\s+(?:\w+\s+){0,1})(?:walk(?:ing)?\s+away|withdraw|part\s+ways|declin(?:e|ing)|pass|exit)\b/i;
  /* S120-B1 — "I don't want to walk away" was firing rejected=true via rejectWords'
   * bare "walk away" arm even though walkAwayNegationRe correctly suppressed walkAway.
   * The negation guard only ever protected the walkAway field; apply it to rejected too.
   * S126-B2 (wave 32) — that guard originally applied to ANY rejectWords match, not just
   * the walk-away arm, so "I won't accept this but I won't walk away either" lost its
   * genuine, unrelated "won't accept" reject signal to an unrelated walk-away negation
   * elsewhere in the same reply. Scope the guard to only the case where rejectWords'
   * actual first match IS the walk-away arm. */
  const rejectMatch = rejectWords.exec(trimmed);
  const rejectMatchIsWalkAwayArm = !!rejectMatch && /^walk\s+away/i.test(rejectMatch[0]);
  /* S126-B1 (wave 32) — "That works for me. Sticking with 30 LPA is what I need." lost its
   * firm number-lock signal ("sticking with 30 LPA") to the `!accepted` guard, because an
   * unrelated accept phrase ("works for me") appeared earlier in the same reply. The
   * number-lock arms are an unambiguous, self-contained reject signal (a number lock only
   * fires when a lakh/lpa/crore/digit is in the same sentence) — carve them out of the
   * accept-guarded check so they aren't silently suppressed by an unrelated accept clause.
   * (numberLockWords is defined above, alongside `accepted`, which now also excludes it —
   * see S127-B1.) */
  /* S132-B4 (wave 38) — walkAwayWords/rejectWords had no first-person subject guard for
   * reported/third-party speech ("My friend said I should walk away."), so someone relaying
   * advice or a recruiter's/employer's own stance was misread as the candidate's own
   * walk-away or rejection. Mirrors thirdPartyOfferRe's guard on mentionedCompeting. */
  const thirdPartyDepartureRe =
    /\b(?:my|his|her|their|our|the)\s+(?:friend|brother|sister|colleague|cousin|classmate|batchmate|senior|junior|relative|husband|wife|partner|recruiter|manager|lawyer|family|company|team|employer)\b(?:\s+\w+){0,6}\s*(?:said|told\s+me|mentioned|suggested|advised|recommended|thinks?|feels?|believes?|says?)\b/i;
  /* S133-B3 (wave 39) — a trailing elliptical negation ("I considered walking away, but I
   * won't.") retracts an earlier departure verb without repeating it. walkAwayNegationRe
   * only looks for a negator BEFORE the departure verb within a bounded gap; this catches
   * the trailing form referring back to it. Scoped to require the negator be the final
   * clause (nothing meaningful after it) so it doesn't suppress "...but I won't accept
   * less than X", where content follows the negator and introduces an unrelated point. */
  const trailingRetractionRe =
    /[,;]?\s*but\s+i\s+(?:won.?t|wouldn.?t|don.?t|didn.?t|will\s+not|would\s+not|do\s+not|did\s+not)\.?\s*$/i;
  const rejected = !thirdPartyDepartureRe.test(trimmed) && !trailingRetractionRe.test(trimmed) && !walkAwaySarcasmRe.test(trimmed) && (
    (rejectWords.test(trimmed) && !accepted && !rejNegationRe.test(trimmed) && !(rejectMatchIsWalkAwayArm && walkAwayNegationRe.test(trimmed)) && !notInterestedDoubleNegationRe.test(trimmed))
    || (numberLockWords.test(trimmed) && !rejNegationRe.test(trimmed) && !walkAwayNegationRe.test(trimmed) && !notInterestedDoubleNegationRe.test(trimmed)));
  const deflected = deflectWords.test(trimmed);
  /* S125-B (wave 31) — the post-hedge fallback used to skip walkAwayNegationRe entirely
   * ("I will not accept this, but I will not walk away either" wrongly fired true). But
   * naively re-adding `!walkAwayNegationRe.test(postHedgeText)` broke "but if this does
   * not improve I am walking away" (S94-B1) — the wide 0-4 word gap on "does not" lets the
   * negator jump across an unrelated subject-reset clause ("does not improve, I am ...").
   * Mirrors stripNegatedDepartures()'s fix in _walkaway-detection.ts: only treat the
   * negation as covering the walk-phrase if there's no fresh "I will/I'm/I am" subject+
   * modal reassertion in the 48 chars immediately before the walk match. */
  const RECLAIMED_INTENT_LOCAL =
    /\b(?:i\s+will|i['']?ll|i\s+am\s+going\s+to|i['']?m\s+going\s+to|i\s+am|i['']?m)\s*$/i;
  /* Locates the bare departure verb (not the full walkAwayWords match, which for arms like
   * the bare-verb "i am walking away" already swallows the subject+modal itself, hiding the
   * "I am" reassertion inside the match instead of leaving it in the lookback window). */
  const DEPARTURE_VERB_LOCAL =
    /\bwalk(?:ing|in)?(?:\s+away|\s+out)?\b|declin(?:e|ing)\b|withdraw(?:ing)?\b|part\s+ways\b|pull(?:ing)?\s+out\b/i;
  function walkAwayNegationCoversLocal(text: string): boolean {
    if (!walkAwayNegationRe.test(text)) return false;
    const verbMatch = DEPARTURE_VERB_LOCAL.exec(text);
    if (!verbMatch) return true;
    const lookback = text.slice(Math.max(0, verbMatch.index - 48), verbMatch.index);
    return !RECLAIMED_INTENT_LOCAL.test(lookback);
  }
  /* S128-B1 (wave 34) — a live number-lock (see numberLockWords above) means the candidate
   * is anchoring a number, not leaving; mirrors the same exclusion already applied to
   * `accepted`/`rejected`. */
  const baseWalkAwayMatch = walkAwayWords.exec(trimmed);
  const walkAway = !thirdPartyDepartureRe.test(trimmed) && !trailingRetractionRe.test(trimmed) && !walkAwaySarcasmRe.test(trimmed) && (
    (walkAwayWords.test(trimmed) && !accepted && !numberLockAppliesToLocal(trimmed, baseWalkAwayMatch) && !walkAwayNegationRe.test(trimmed) && !notInterestedDoubleNegationRe.test(trimmed))
    || (hasAnyHedge && walkAwayWords.test(postHedgeText) && !numberLockWords.test(postHedgeText) && !walkAwayNegationCoversLocal(postHedgeText) && !notInterestedDoubleNegationRe.test(postHedgeText))
    || (hasAnyHedge && walkAwayWords.test(preHedgeText) && !numberLockWords.test(preHedgeText) && !walkAwayNegationCoversLocal(preHedgeText) && !notInterestedDoubleNegationRe.test(preHedgeText)));

  // "consider" co-occurring with a number is a counter, not a time request
  /* S117-B7/B8/B9/B10 FPs: negated think-time phrases ("I don't need time", "no need
   * to think about it", "not time to think") incorrectly set needsTime=true. */
  const thinkNegationRe = /\b(?:don.?t|doesn.?t|do\s+not|does\s+not)\s+(?:need|want)\s+(?:more\s+)?(?:time|to\s+think|to\s+consider|to\s+decide)|no\s+need\s+to\s+(?:think|consider|decide|deliberate)|not\s+time\s+to\s+(?:think|decide|consider)|not\s+going\s+to\s+(?:think|consider|deliberate)|won.?t\s+(?:even\s+)?(?:think|need\s+to\s+think)|no\s+time\s+to\s+(?:think|decide|consider)\b/i;
  /* S126-B3 (wave 32) — "I need a few days to think about the 45 LPA offer." was losing
   * needsTime because ANY salary-shaped number in the text nulls candidateNum out, even
   * when the number is plainly the recruiter's own offer being referenced back ("the/your
   * X offer"), not a fresh counter from the candidate. Only let a number suppress needsTime
   * when it isn't wrapped in that offer-reference framing. */
  /* S135-B3 (wave 41) — the "the/your/this ... offer" framing missed common alternate
   * phrasings that reference the SAME already-stated number without the literal word
   * "offer", e.g. "the 40 LPA number you mentioned" / "that figure you quoted" — those
   * lost needsTime exactly like the original S126-B3 "the X offer" case did. */
  const numberIsOfferReferenceRe =
    /\b(?:the|your|this)\b(?:\s+\S+){0,3}\s+offer\b|\b(?:number|figure|amount)\b(?:\s+\S+){0,3}\s+(?:you\s+)?(?:mentioned|stated|said|proposed|quoted|offered)\b/i;
  /* S127-B2 (wave 33) — thinkNegationRe was tested against the WHOLE string, so
   * "I don't need time to think about the base, but I do need a couple of days to think
   * about the equity component." lost its genuine, unnegated second-clause needsTime
   * signal to an unrelated negation in the first clause. Split on clause-connecting
   * conjunctions and require the positive thinkWords match and its negation check to be
   * in the SAME clause. */
  const needsTimeClauses = trimmed.split(/,?\s*\b(?:but|however|although|though|yet)\b\s*/i);
  /* S128-B2 (wave 34) — "Give me a couple of days, my target is 40 LPA minimum." lost
   * needsTime entirely: the whole-string candidateNum gate (added in S126-B3 for the
   * "consider 30 LPA" counter-in-disguise case) nulled out the genuine, unambiguous
   * time-request clause just because an UNRELATED clause elsewhere stated a target
   * number. Scope the number check to the SAME clause as the thinkWords match (splitting
   * on commas too, since target-number statements are often comma-joined rather than
   * conjunction-joined) so a number in one clause no longer suppresses a genuine,
   * separate time-request in another. */
  const needsTimeNumberClauses = trimmed.split(/,?\s*\b(?:but|however|although|though|yet)\b\s*|,\s*/i);
  const needsTime =
    needsTimeClauses.some((clause) => thinkWords.test(clause) && !thinkNegationRe.test(clause)) &&
    needsTimeNumberClauses.some((clause) => {
      if (!thinkWords.test(clause)) return false;
      const clauseNum = extractCandidateSalaryNumber(clause);
      return clauseNum === null || numberIsOfferReferenceRe.test(clause);
    });
  /* S127-B3 (wave 33) — competingWords had no first-person subject guard, so
   * third-party offers ("My friend got an offer of 40 LPA.") were misread as the
   * candidate's own competing offer/BATNA. */
  const thirdPartyOfferRe =
    /\b(?:my|his|her|their|our)\s+(?:friend|brother|sister|colleague|cousin|classmate|batchmate|senior|junior|relative|husband|wife|partner)\b(?:\s+\w+){0,4}\s*(?:got|received|has|have|had)\s+(?:an\s+)?offer/i;
  /* S129-B3 (wave 35) — competingWords had no negation guard, so "I don't have another
   * offer, but I am exploring one." / "I haven't received any other offer yet." misfired
   * mentionedCompeting=true off the bare phrase match, ignoring the negation right in
   * front of it. Guard on negation immediately preceding the matched phrase within the
   * same clause (splitting on conjunctions/commas so a negation in one clause doesn't
   * suppress a genuine competing-offer mention in another). */
  const competingNegationRe =
    /\b(?:don.?t|do\s+not|doesn.?t|does\s+not|didn.?t|did\s+not|haven.?t|have\s+not|hasn.?t|has\s+not|no|not)\s+(?:\w+\s+){0,3}(?:other offer|another offer|another opportunity|competing|another company|other companies|other options|other opportunities|counter.?offer|multiple offers|any\s+other|an?\s+offer|offer)/i;
  const competingClauses = trimmed.split(/,?\s*\b(?:but|however|although|though|yet)\b\s*|,\s*/i);
  const mentionedCompeting =
    !thirdPartyOfferRe.test(trimmed) &&
    competingClauses.some((clause) => competingWords.test(clause) && !competingNegationRe.test(clause));

  return { accepted, conditionalAccept, rejected, walkAway, deflected, needsTime, mentionedCompeting };
}

/**
 * Extract the candidate's target salary number from free-text.
 *
 * Strategy:
 *   1. Find all numbers with LPA/lakh/lakhs/l suffix.
 *   2. If the target-phrase regex matches a number from that list, prefer it.
 *   3. Otherwise, if current-CTC regex matches the first number, use the last
 *      number as the target (e.g. "currently at 20, expecting 30" → 30).
 *   4. Otherwise fall back to the last number in the list.
 *   5. If no LPA-suffixed number found, look for bare numbers prefixed with
 *      ask-intent words, bounded to the salary-plausible range [3, 200].
 *
 * Returns null when no number is found.
 */
export function extractCandidateSalaryNumber(answer: string): string | null {
  if (!answer) return null;

  // Tolerant of common Indian-English STT mishears for "lakhs":
  //   "legs"  — Deepgram occasionally renders this when the speaker
  //             stresses the "h" → "leghs"
  //   "lacks" — common substitution for "lakhs"
  //   "lac"   — singular form (sometimes transcribed as "lakh")
  //   "lax"   — short STT form
  // The user-reported session had "20 legs per annum" — without this
  // tolerance the regex missed the number entirely and the
  // candidateTarget never got set, breaking downstream clamps.
  const salaryNumRe = /₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lacs?|legs|lax|l\b)/gi;
  const currentCtcRe = /(?:currently|current(?:ly)?|earning|getting|drawing|my ctc|i'm at|making|take home|i get|i earn)\s.*?(\d+(?:\.\d+)?)/i;
  const targetRe = /(?:expecting|looking for|want|need|asking|target|hoping|would like|i'd like|i want|i need|looking at|aiming)\s.*?(\d+(?:\.\d+)?)/i;
  // Competing / in-hand offer — these are the candidate's BATNA, not
  // their target. Pulling them as the "target" causes the AI to
  // counter BELOW the candidate's actual ask. Captured separately so
  // the latest target-prefixed number wins even if a competing-offer
  // figure appears later in the same utterance.
  const competingRe = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*(\d+(?:\.\d+)?)/gi;
  const competingNums = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = competingRe.exec(answer)) !== null) competingNums.add(cm[1]);

  const allNums: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = salaryNumRe.exec(answer)) !== null) allNums.push(m[1]);

  // Bare-number fallback when no LPA suffix was found
  if (allNums.length === 0) {
    const bareNumMatch = answer.match(/(?:expecting|want|need|asking|target|hoping|looking for|around|about|at least|minimum)\s+(?:₹?\s*)?(\d+(?:\.\d+)?)\b(?!\s*(?:hours?|days?|weeks?|months?|minutes?))/i);
    if (bareNumMatch) {
      const v = parseFloat(bareNumMatch[1]);
      if (v >= 3 && v <= 200) allNums.push(bareNumMatch[1]);
    }
  }

  // Strip competing-offer numbers from candidate-target consideration.
  // These get captured by the caller's competingOfferAmount field.
  const targetCandidates = allNums.filter(n => !competingNums.has(n));
  if (targetCandidates.length === 0 && allNums.length === 0) return null;
  // If every number was a competing-offer number, fall back to the last
  // one (preserves prior behaviour for single-number utterances).
  const pool = targetCandidates.length > 0 ? targetCandidates : allNums;

  // Strongest signal: ALL target-prefixed numbers (latest wins).
  // The previous regex took the FIRST target-prefix match, so
  // "I want 20, actually let me say I'd like 25" returned 20.
  // Iterate to find the LAST target-prefix match that appears in pool.
  const allTargetRe = /(?:expecting|looking for|want|need|asking|target|hoping|would like|i'd like|i want|i need|looking at|aiming)\s.*?(\d+(?:\.\d+)?)/gi;
  const targetMatches: string[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = allTargetRe.exec(answer)) !== null) {
    if (pool.includes(tm[1]) && !competingNums.has(tm[1])) targetMatches.push(tm[1]);
  }
  if (targetMatches.length > 0) return targetMatches[targetMatches.length - 1];

  // Single-shot fallback to legacy behaviour for backward compat.
  const targetMatch = targetRe.exec(answer);
  if (targetMatch && pool.includes(targetMatch[1])) return targetMatch[1];

  const currentMatch = currentCtcRe.exec(answer);
  if (currentMatch && pool.length > 1 && pool[0] === currentMatch[1]) {
    return pool[pool.length - 1];
  }

  return pool[pool.length - 1];
}

/**
 * Truncate conversation history to a character budget, preserving the most
 * recent exchanges. Mirrors the historyCharLimit used in follow-up.ts
 * around line 159.
 */
export function truncateConversationHistory(history: string, budget: number): string {
  if (!history) return "";
  if (history.length <= budget) return history;
  // Keep the tail (most recent turns), prefix with marker.
  return `…[earlier turns truncated]\n${history.slice(-Math.max(budget - 40, 100))}`;
}

export interface PhaseFacts {
  acceptedImmediately?: boolean;
  candidateCounter?: string | null;
  hasCompetingOffers?: boolean;
  topicsRaised?: string[];
}

export interface DetectSalaryPhaseInput {
  /** Explicit phase override from client. Wins unconditionally. */
  negotiationPhase?: string;
  /** 0-indexed question number within the negotiation. */
  questionIndex?: number;
  /** Total questions in this negotiation session. */
  totalQuestions?: number;
  /** Extracted negotiation facts. */
  facts?: PhaseFacts | null;
  /** The candidate's most recent answer (for walk-away detection). */
  answer?: string;
}

export type SalaryPhase =
  | "offer-reaction"
  | "probe-expectations"
  | "counter-offer"
  | "benefits-discussion"
  | "closing-pressure"
  | "closing";

/**
 * Determine the negotiation conversation phase from session state.
 *
 * Closing phases require either explicit acceptance OR a stated counter.
 * Without one, late turns route to probe-expectations / counter-offer
 * instead — the negotiation cannot end before a number is on the table.
 */
export function detectSalaryPhase(input: DetectSalaryPhaseInput): SalaryPhase {
  const { negotiationPhase, questionIndex, facts, answer } = input;
  if (negotiationPhase) return negotiationPhase as SalaryPhase;

  /* State-first derivation. Phase follows candidate signal — NOT
     turn-index. This is the architectural fix the audit called out:
     a candidate who counters on turn 1 should route to counter-offer
     immediately, not be marched through probe-expectations because
     the pre-baked arc says so. Turn-index is consulted only for the
     cold-start ramp when zero state signals are available. */

  // 1. Acceptance — closing wins everything.
  if (facts?.acceptedImmediately) return "closing";

  // 2. Walk-away language — switch to closing-pressure (retention).
  if (isWalkAway(answer)) return "closing-pressure";

  // 3. A number is on the table — counter-offer regardless of turn.
  //    Previously gated on idx>=2, which marched-through-probe even
  //    when the candidate had already given a counter on turn 1.
  if (facts?.candidateCounter) return "counter-offer";

  // 4. Competing offers but no concrete counter — keep probing.
  if (facts?.hasCompetingOffers) return "probe-expectations";

  // 5. Multiple non-cash topics raised — benefits territory.
  if (facts?.topicsRaised && facts.topicsRaised.length >= 2) return "benefits-discussion";

  /* No state signals fired. Use turn-index as a cold-start ramp ONLY.
     We never fabricate counter-offer / closing-pressure from index
     alone — those require candidate state. The deepest the cold ramp
     goes is probe-expectations, which is always safe (the AI asks for
     a target; the candidate's answer then provides the signal that
     moves us into a real phase). */
  const idx = questionIndex ?? 0;
  if (idx <= 1) return "offer-reaction";
  return "probe-expectations";
}

export interface PickCounterInput {
  phase: SalaryPhase | string;
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  /** Highest ₹ already presented this session, if any. */
  highestOfferMade?: number | null;
  /** Candidate's stated target, if any. */
  candidateTarget?: number | null;
}

/**
 * Server-side recommended counter number for the AI's next turn.
 *
 * Removes the LLM's hand from picking ₹ values — it still writes prose
 * around the number but the figure itself is computed deterministically
 * from the band + session state. The post-LLM clamp guards stay in
 * place as a safety net; this just stops the hallucinations at the
 * source instead of reactively repairing them.
 *
 * Returns null when the phase shouldn't introduce a new number
 * (offer-reaction reuses the initial; probe-expectations is asking,
 * not offering; benefits / closing maintain the last counter).
 */
export function pickServerCounter(input: PickCounterInput): number | null {
  const { phase, initialOffer, maxStretch, highestOfferMade, candidateTarget } = input;

  const floor = Math.max(highestOfferMade ?? 0, initialOffer);
  const ceiling = maxStretch;

  // Cap aspiration at the band's ceiling. If the candidate's target is
  // above maxStretch, the AI shouldn't reach for it — it should flag.
  const aspiration = Math.min(candidateTarget ?? ceiling, ceiling);

  // If aspiration is already at or below floor, there's nowhere to move.
  if (aspiration <= floor) return null;

  let next: number | null = null;

  switch (phase) {
    case "offer-reaction":
      // First turn — present the initial offer. Caller usually has this
      // already from initialOfferText; we only return it for completeness.
      next = initialOffer;
      break;

    case "probe-expectations":
    case "benefits-discussion":
      // No new number this turn — these phases ask / discuss, they
      // don't offer.
      return null;

    case "counter-offer":
      // Split the difference between current floor and aspiration.
      next = floor + (aspiration - floor) * 0.5;
      break;

    case "closing-pressure":
      // Push 70% of the way toward aspiration — visible movement to
      // close the deal.
      next = floor + (aspiration - floor) * 0.7;
      break;

    case "closing":
      // Maintain the highest offer made; closing is the recap, not a
      // new bump.
      return null;

    default:
      return null;
  }

  if (next === null || !Number.isFinite(next)) return null;
  // Clamp to band, floor at monotonic, round to 0.1.
  next = Math.max(floor, Math.min(ceiling, next));
  return Math.round(next * 10) / 10;
}

/* ────────────────────────────────────────────────────────────────
 * Typed move picker — pickNextMove
 * ────────────────────────────────────────────────────────────────
 * Until now the LLM decided which lever to pull on each turn (base
 * bump, joining bonus, equity grant, hold firm). That decision drifted
 * under pressure: ESOPs offered on non-equity bands, generic "learning
 * budget" pulled on a designer when conference budget would land
 * harder, the same lever repeated three turns in a row.
 *
 * pickNextMove makes the lever choice a pure server function. The LLM
 * still writes the prose; it no longer chooses the structural move.
 * Lever rotation prevents re-offering the same non-cash item; cash
 * headroom is consumed first via pickServerCounter, then non-cash
 * levers in a deterministic order. Hold-firm is the explicit exit
 * when everything is exhausted — replaces the duplicate-reply rescue
 * path that was papering over "no moves left".
 */

export type NegotiationLever =
  | "open-with-offer"
  | "probe"
  | "counter-base"
  | "joining-bonus"
  | "equity-grant"
  | "notice-buyout"
  | "benefits-summary"
  | "hold-firm"
  | "close-acceptance";

export interface NextMove {
  lever: NegotiationLever;
  /** New headline total CTC the AI should propose this turn, or null
   *  when no money moves (probe / benefits / non-cash levers). */
  newTotalLpa: number | null;
  /** Increment over the highest previous offer. 0 for non-monetary
   *  levers and for open-with-offer (the initial offer isn't an
   *  increment). */
  deltaLpa: number;
  /** One-line server explanation suitable for inclusion in the LLM
   *  prompt as a structural hint. */
  rationale: string;
}

export interface PickNextMoveInput {
  phase: SalaryPhase | string;
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  highestOfferMade?: number | null;
  candidateTarget?: number | null;
  hasEquity?: boolean;
  /** Sticky: did the candidate accept at any point in this session? */
  isAccepted?: boolean;
  /** Levers the AI has already pulled this session. Used to rotate
   *  non-cash levers so we don't re-offer the same joining bonus
   *  three turns in a row. */
  leversTried?: ReadonlyArray<NegotiationLever>;
}

export function pickNextMove(input: PickNextMoveInput): NextMove {
  const {
    phase,
    initialOffer,
    maxStretch,
    walkAway,
    highestOfferMade,
    candidateTarget,
    hasEquity,
    isAccepted,
    leversTried,
  } = input;

  // 1. Acceptance dominates — recap and close.
  if (isAccepted) {
    return {
      lever: "close-acceptance",
      newTotalLpa: highestOfferMade ?? initialOffer,
      deltaLpa: 0,
      rationale:
        "Candidate has accepted. Recap the agreed package and move to logistics (notice period, joining date). Do NOT introduce a new number.",
    };
  }

  // 2. Phase-locked moves that don't touch numbers.
  if (phase === "offer-reaction") {
    return {
      lever: "open-with-offer",
      newTotalLpa: initialOffer,
      deltaLpa: 0,
      rationale: `Present the initial ₹${initialOffer} LPA offer and ask for the candidate's reaction. Do not move the number yet.`,
    };
  }
  if (phase === "probe-expectations") {
    return {
      lever: "probe",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Ask for the candidate's target range and the reasoning behind it before moving any number this turn.",
    };
  }
  if (phase === "benefits-discussion") {
    return {
      lever: "benefits-summary",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Lay out the non-cash package (insurance, learning budget, flexibility). Do not move base this turn.",
    };
  }

  // 3. Counter / closing-pressure — try cash headroom first.
  const counter = pickServerCounter({
    phase,
    initialOffer,
    maxStretch,
    walkAway,
    highestOfferMade,
    candidateTarget,
  });
  const floor = Math.max(highestOfferMade ?? 0, initialOffer);
  const triedSet = new Set<NegotiationLever>(leversTried ?? []);

  if (counter !== null && counter > floor) {
    return {
      lever: "counter-base",
      newTotalLpa: counter,
      deltaLpa: Math.round((counter - floor) * 10) / 10,
      rationale: `Move headline CTC to ₹${counter} LPA (split toward candidate target, capped at maxStretch ₹${maxStretch}).`,
    };
  }

  // 4. No cash headroom — rotate non-cash levers in priority order.
  if (!triedSet.has("joining-bonus")) {
    return {
      lever: "joining-bonus",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Base is at the ceiling. Offer a one-time joining bonus (₹1–3L typical) — does not inflate CTC commitment.",
    };
  }
  if (hasEquity && !triedSet.has("equity-grant")) {
    return {
      lever: "equity-grant",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Base maxed; offer an equity bump (ESOPs / RSUs). Only valid when band.hasEquity=true — verified before reaching this lever.",
    };
  }
  if (!triedSet.has("notice-buyout")) {
    return {
      lever: "notice-buyout",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Offer a notice-period buyout to accelerate joining — useful when candidate cites timing constraints.",
    };
  }

  // 5. All levers exhausted — hold firm, ask for a decision.
  return {
    lever: "hold-firm",
    newTotalLpa: floor,
    deltaLpa: 0,
    rationale: `All levers exhausted. State honestly that ₹${floor} LPA is the ceiling and ask for a decision. Do not introduce anything new — that's how duplicate-reply loops start.`,
  };
}

/**
 * Extract mirroring anchors from a candidate's answer — the words and
 * phrases the LLM should echo verbatim in the follow-up to lift rapport.
 *
 * Two passes:
 * 1. High-frequency / proper-noun word ranking (top 5 lowercased keys).
 * 2. "the X" / "my X" / "our X" idiomatic phrases (length ≤4 words),
 *    casing preserved so "the Migration Project" survives.
 *
 * PII scrub: drops always-capitalized, low-frequency tokens that look
 * like personal first names. Tokens with internal caps (PhonePe), known
 * tech / company allowlist members (Stripe, Figma), or company-shape
 * suffixes (-ai, -labs, -tech, -inc, -corp, -io) survive.
 */
/**
 * Did the candidate's message ask for a breakdown of the offer (or any
 * specific component of it)? Used by follow-up.ts to force wantsBreakdown=true
 * on the LLM's parsed output when the LLM forgot to set it itself — the
 * "breakdown-deflection rescue" path. We shipped the same bug four times
 * via the LLM ignoring the wantsBreakdown=true instruction. This guard
 * makes the rescue deterministic at the server boundary.
 *
 * Wide net: matches whole-package asks ("breakdown", "all the parts")
 * AND component-specific asks ("the base salary", "what's the joining
 * bonus"). Both deserve a full templated breakdown — the breakdown
 * sentence is short enough to deliver in one turn regardless of which
 * component was asked.
 */
export function isBreakdownAsk(answer: string): boolean {
  if (!answer) return false;
  const re =
    /\b(?:break\s*down|breakup|components?|structure|split|all\s+the\s+parts|complete\s+breakdown|base\s+salary|the\s+base|variable\s+(?:pay|component)|joining\s+bonus|provident\s+fund|how\s+much\s+is\s+(?:the\s+)?(?:base|variable|joining|pf)|what(?:'?s|\s+is)\s+(?:the\s+)?(?:base|variable|joining|pf))\b/i;
  return re.test(answer);
}

export function extractMirrorTokens(answer: string): string[] {
  if (!answer || answer.length < 30) return [];
  const stop = new Set([
    "the","and","you","your","what","when","where","which","who","whom","whose",
    "how","why","that","this","these","those","with","from","into","onto","upon",
    "have","has","had","was","were","been","being","are","could","should","would",
    "did","does","but","not","all","any","one","two","three","for","its","their","them",
    "they","there","then","than","also","just","like","about","after","before","each",
    "such","very","over","much","more","most","some","many","tell","share","walk",
    "give","make","made","take","took","get","got","said","say","says","really","actually",
    "because","while","whilst","through","across","around","without","within","under","upon",
    "myself","yourself","ourselves","themselves","itself","being","doing","going","saying",
    "people","person","thing","things","stuff","really","quite","kind","sort","still","also",
  ]);
  const NON_PII_CAPS = new Set([
    "stripe","razorpay","paytm","phonepe","figma","github","gitlab","slack","notion","jira",
    "zoom","azure","aws","gcp","docker","kubernetes","python","javascript","typescript",
    "react","node","postgres","mysql","redis","mongodb","graphql","rest","api","sdk",
    "google","microsoft","amazon","apple","meta","netflix","uber","ola","swiggy","zomato",
    "flipkart","myntra","cred","groww","zerodha","freshworks","zoho","tcs","infosys","wipro",
    "accenture","deloitte","mckinsey","bain","bcg","kpmg","ey","pwc","sap","oracle","ibm",
    "android","ios","linux","windows","macos","chrome","firefox","safari","cartesia","groq",
    "gemini","openai","anthropic","claude","supabase","vercel","upstash","deepgram","sarvam",
  ]);
  const COMPANY_SUFFIX = /(?:ai|ml|labs?|tech|inc|corp|io)$/i;

  const cleaned = answer.replace(/[^A-Za-z0-9\s'-]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const freq = new Map<string, { count: number; capitalized: boolean; lowerCount: number; hasInternalCap: boolean }>();
  for (const w of words) {
    if (w.length < 4) continue;
    const lower = w.toLowerCase();
    if (stop.has(lower)) continue;
    const cur = freq.get(lower) || { count: 0, capitalized: false, lowerCount: 0, hasInternalCap: false };
    cur.count++;
    if (/^[A-Z]/.test(w)) cur.capitalized = true;
    else cur.lowerCount++;
    if (/^[A-Za-z].*[A-Z]/.test(w.slice(1))) cur.hasInternalCap = true;
    freq.set(lower, cur);
  }
  const ranked = Array.from(freq.entries())
    .filter(([lower, info]) => {
      if (!info.capitalized || info.lowerCount > 0) return true;
      if (info.count > 2) return true;
      if (lower.length > 10 || lower.length < 3) return true;
      if (NON_PII_CAPS.has(lower)) return true;
      if (info.hasInternalCap) return true;
      if (COMPANY_SUFFIX.test(lower)) return true;
      return false;
    })
    .sort((a, b) => (b[1].count - a[1].count) || ((b[1].capitalized ? 1 : 0) - (a[1].capitalized ? 1 : 0)))
    .slice(0, 5)
    .map(([w]) => w);

  const phraseRe = /\b(?:the|my|our)\s+([a-z][a-z-]{2,})(?:\s+([a-z][a-z-]{2,}))?\b/gi;
  const phrases: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(answer)) !== null && phrases.length < 4) {
    const full = m[0].replace(/\s+/g, " ");
    if (!phrases.some(p => p.toLowerCase() === full.toLowerCase())) phrases.push(full);
  }
  return Array.from(new Set([...ranked, ...phrases])).slice(0, 6);
}

/* ── Duplicate-reply rescue ──────────────────────────────────────────
 * Bug class: the LLM emits a verbatim (or near-verbatim) duplicate of a
 * prior AI turn — usually because it hit the same fallback path twice
 * after failing to ground in the candidate's restated ask. The
 * `duplicate-reply` detector pins this offline; this helper is the
 * runtime fix that swaps the duplicate for a concrete-move escape
 * hatch BEFORE the response ships.
 *
 * The normalization (lowercase, collapse whitespace, strip punctuation)
 * mirrors `normalizeForDuplicate` in _negotiation-failures.ts so the
 * detector and rescue agree on what "duplicate" means. We require
 * ≥ 80 chars before flagging — short acknowledgements ("Got it.")
 * legitimately repeat.
 */
export function normalizeForDuplicate(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[.,;:!?—–-]+/g, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

export function isDuplicateOfRecent(
  text: string,
  prev: readonly string[] | undefined | null,
): boolean {
  if (!prev || prev.length === 0) return false;
  if (!text || text.trim().length < 80) return false;
  const norm = normalizeForDuplicate(text);
  if (!norm) return false;
  for (const p of prev) {
    if (normalizeForDuplicate(p) === norm) return true;
  }
  return false;
}

export interface DuplicateRescueContext {
  /** Highest offer the AI has put on the table this session. */
  highestOfferMade?: number | null;
  /** The band's max-stretch ceiling — never exceeded by the rescue counter. */
  maxStretch?: number | null;
}

/**
 * When the LLM repeats itself verbatim, we replace the reply with a
 * concrete-move sentence: acknowledge we've been circling, then either
 * make a forward counter (if there's headroom between the current offer
 * and the ceiling) or call the question (if we're already at the
 * ceiling and the candidate is the one who has to move).
 *
 * The counter formula: move 60% of the remaining headroom toward the
 * ceiling. That's aggressive enough to feel like real movement, and
 * still leaves a small reserve. Clamped to maxStretch.
 */
export function composeDuplicateReplyRescue(
  ctx: DuplicateRescueContext,
): string {
  const offer = typeof ctx.highestOfferMade === "number" && Number.isFinite(ctx.highestOfferMade) && ctx.highestOfferMade > 0
    ? ctx.highestOfferMade
    : null;
  const stretch = typeof ctx.maxStretch === "number" && Number.isFinite(ctx.maxStretch) && ctx.maxStretch > 0
    ? ctx.maxStretch
    : null;

  // Forward counter path: there's still headroom between the current
  // offer and the ceiling. Move 60% of the way.
  if (offer != null && stretch != null && stretch > offer) {
    const next = Math.min(stretch, Math.round((offer + (stretch - offer) * 0.6) * 10) / 10);
    return `You're right, I've been going in circles — apologies for that. Let me make a concrete move: I can stretch to ₹${next} LPA total CTC. That bumps base, keeps the variable structure intact, and includes our standard benefits. Does that get us closer to a yes, or is there a specific lever — base, joining, equity — you'd want me to revisit instead?`;
  }

  // Already at (or above) the ceiling — call the question rather than
  // re-offer the same number. No rupee figure: the candidate has it.
  if (offer != null && stretch != null && offer >= stretch) {
    return `You're right, I've been circling — apologies. I've shared where I can land today, and I'm at the top of the band for this role. If the package doesn't work I'd rather know now than keep asking the same thing. What would actually move you to yes — or should we pause here?`;
  }

  // Fall-through: we don't have enough context (no offer or no
  // ceiling) to make a numeric move. Still break the loop with
  // honesty + a lever-pointing question.
  return `You're right, I've been circling — apologies for repeating myself. Let me be straight: tell me which lever matters most to you — base, variable, joining bonus, or notice-period flexibility — and I'll work on that one concretely.`;
}

/* ── Behavioural register hygiene ─────────────────────────────────────
 *  The behavioural follow-up coach is prompted (follow-up.ts line ~57)
 *  to avoid American-startup / LLM-ism register — "let's dive in",
 *  "reach out", "circle back" etc. — and speak natural Indian English.
 *  But a prompt-level ban is a *string* ban: it lists a handful of exact
 *  phrases, so the model reliably evades it with an un-listed variant
 *  ("dive deeper", "diving into", "delve into", "unpack that"). Live
 *  staging probing caught "Let's dive deeper into the pilot…" leaking
 *  through on ~1-in-5 samples — the same banned-register class tasks
 *  ISSUE-4 / ISSUE-4b purged from the intro, reappearing in the dynamic
 *  turn because nothing downstream of the LLM enforced it.
 *
 *  This is the structural guarantee the prompt cannot give: a
 *  deterministic post-generation rewrite that maps the whole register
 *  family to clean, meaning-preserving Indian-English equivalents,
 *  independent of how the model phrased it on any given sample. Each
 *  rule is a conservative verb-phrase swap that never changes meaning
 *  (e.g. "dive deeper into X" → "go deeper into X"). Applied ONLY on
 *  the behavioural path — the salary-negotiation surface has its own
 *  register system in _canonical-prose.ts and is left byte-identical.
 *
 *  Scope is deliberately narrow: only unambiguous register offenders,
 *  so it can run unconditionally without risk of mangling good prose. */
interface RegisterRule {
  re: RegExp;
  to: string;
}

const BEHAVIOURAL_REGISTER_RULES: readonly RegisterRule[] = [
  // "dive" verb-as-metaphor family — the ISSUE-4 offender and its variants.
  // Order matters: the more specific "... into" / "... deeper" forms must
  // run before the bare "dive in" / "dive into" rules so the longer phrase
  // wins and the shorter rule never sees a partial leftover.
  { re: /\blet'?s dive in\b/gi, to: "let's get into it" },
  { re: /\bdive deeper into\b/gi, to: "go deeper into" },
  { re: /\bdiving deeper into\b/gi, to: "going deeper into" },
  { re: /\bdive deeper\b/gi, to: "go deeper" },
  { re: /\bdiving deeper\b/gi, to: "going deeper" },
  { re: /\bdive into\b/gi, to: "get into" },
  { re: /\bdiving into\b/gi, to: "getting into" },
  { re: /\bdive in\b/gi, to: "get started" },
  // "delve" — the canonical LLM-ism (see BUG/task #22).
  { re: /\bdelve deeper into\b/gi, to: "go deeper into" },
  { re: /\bdelve deeper\b/gi, to: "go deeper" },
  { re: /\bdelve into\b/gi, to: "go into" },
  { re: /\bdelve\b/gi, to: "look" },
  // "unpack" as a metaphor.
  { re: /\blet'?s unpack\b/gi, to: "let's break down" },
  { re: /\bunpack that\b/gi, to: "break that down" },
  // American-startup connective tissue explicitly banned at the prompt.
  { re: /\bcircle back\b/gi, to: "come back" },
  { re: /\btouch base\b/gi, to: "check in" },
  { re: /\breach out to\b/gi, to: "get in touch with" },
  { re: /\breach out\b/gi, to: "get in touch" },
  // "leverage" as a VERB ("leverage that relationship" → "use that
  // relationship") is corporate filler; "use" is cleaner. But "leverage"
  // as a NOUN ("your leverage in the negotiation", "high leverage", "no
  // leverage") MUST be preserved — rewriting it to "use" mangles meaning.
  // We skip the noun sense by refusing to match when a determiner /
  // quantifier / possessive / adjective immediately precedes it.
  {
    re: /(?<!\b(?:the|a|an|your|my|his|her|its|our|their|more|less|high|low|enough|some|any|no|what|which|that|this|much|little|extra|real|strong|maximum|negotiating|financial|pricing)\s)\bleverage\b/gi,
    to: "use",
  },
];

/** Preserve the leading-letter case of the matched phrase so a
 *  sentence-initial replacement stays capitalized. */
function matchLeadingCase(replacement: string, matched: string): string {
  const first = matched.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Deterministically rewrite banned American-startup / LLM-ism register
 * in a behavioural follow-up to clean Indian-English equivalents. Pure,
 * idempotent, meaning-preserving. Returns the input unchanged when there
 * is nothing to rewrite (the common case).
 */
export function sanitizeBehaviouralRegister(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  for (const { re, to } of BEHAVIOURAL_REGISTER_RULES) {
    out = out.replace(re, (matched) => matchLeadingCase(to, matched));
  }
  return out;
}
