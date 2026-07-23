/* Number-role classifier (PDF#30 architectural pass, 2026-05-18).
 *
 * ─── Why this module exists ────────────────────────────────────────
 *
 * Five session-replay PDFs in a row (#19, #20, #27, #29, #30) all
 * surfaced the same shape of bug: a candidate disclosed a salary
 * number, the parser missed it, the bot re-probed for the same fact.
 * Every fix added one more `RegExp` to a 60+-alternative bank in
 * `parseCandidateAnswer`. That stack has three properties we don't
 * want:
 *
 *   1. Alternative ordering is invisible — alt-N can shadow alt-N+1
 *      and the only way to know is a failing replay test.
 *   2. Cues for current/target/competing are interleaved across
 *      patterns; you can't read the answer to "what makes this a
 *      target vs a current?" from any single place.
 *   3. Adding a phrasing means writing a new RegExp from scratch and
 *      praying it doesn't false-positive against another role.
 *
 * This module reverses all three. Numbers in the utterance are
 * tokenized once. Each number is then scored against three role-
 * specific cue tables (current / target / competing). The
 * highest-scoring role wins. When no cue is present, the sentence-
 * level context decides (lastAiText asked? phase = probe-expectations?).
 *
 * Adding a new phrasing now means appending one row to a cue table
 * and one row to the test fixture. No new RegExp alternative; no risk
 * of shadowing.
 *
 * ─── Contract ──────────────────────────────────────────────────────
 *
 *   classifyNumberRoles(text, ctx) returns
 *     { currentCtc, target, competing, targetAsRange }
 *
 *   where each numeric field is in LPA (lakhs per annum). USD ($150k,
 *   $120,000) is converted at 83 INR/USD — same constant the legacy
 *   `extractUsdAmount` used, so behaviour matches existing fixtures.
 *
 * ─── What this module deliberately does NOT do ─────────────────────
 *
 *   - Acceptance / walk-away detection (lives in
 *     `_acceptance-classifier`).
 *   - Component breakdown ("₹12L fixed, ₹6L variable") — handled by
 *     `extractComponentBreakdown` in the kernel; that parser needs the
 *     total CTC context which is orthogonal to role classification.
 *   - Notice period days, equity vesting years, work-mode flags —
 *     each has its own structured extractor.
 *   - Range upper-bound binding for current-CTC (`"earning 25-28
 *     LPA"`) is supported. Bare range with no role cue is treated as
 *     target only when phase context permits.
 *
 * Pure. No clock, no IO.
 */

import { substituteAbsoluteRupees, substituteEnglishNumbers, substituteForeignCurrency, substituteThousandScale, substituteVagueSalaryDecades, stripUrls } from "./_fact-parser";

/* ─── Type surface ─────────────────────────────────────────────────── */

export type NumberRole = "current" | "target" | "competing";

export interface NumberRoleContext {
  /** Bot's previous utterance — used to detect "AI asked for current
   *  CTC" so a bare reply binds via Gricean cooperation. */
  lastAiText?: string;
  /** Current negotiation phase. When the bot is in probe-expectations
   *  AND the candidate replies with a bare number, the default role
   *  is `target` (the bot just asked for it). */
  phase?: string;
  /** OA-B3 — the candidate's already-established current CTC (LPA) from
   *  prior state. Used as the base for resolving a percentage-expressed
   *  target ("20% above my CTC") when no current-CTC figure is disclosed
   *  in the same utterance. Null/undefined when unknown. */
  currentCtc?: number | null;
}

export interface NumberRoleResult {
  currentCtc: number | null;
  target: number | null;
  competing: number | null;
  /** True when the bound `target` (or `currentCtc`) came from a
   *  range pattern (`"30-35 LPA"`); the upper bound is what we
   *  bound, but downstream code uses this to render "you mentioned
   *  a range". */
  targetAsRange: boolean;
  /** Audit Fix (2026-05-19) — Component scope of the bound `target`.
   *  - `"total"` (default) when the candidate framed it as the whole
   *    package ("expecting ₹32 LPA total").
   *  - `"fixed"` when the candidate explicitly tagged the target as a
   *    fixed/base/basic component ("target is ₹26 LPA fixed at
   *    minimum"). The kernel routes fixed-scoped targets to a separate
   *    `candidateTargetFixed` field so a fixed-component target does
   *    NOT overwrite a previously stated total target.
   *  - `null` when no target was bound. */
  targetComponent: "total" | "fixed" | null;
}

/* ─── Constants ────────────────────────────────────────────────────── */

const USD_TO_INR = 83;
/* Window sizes for left/right cue search around each number span.
 * 65 chars before the number captures longer phrasings like "my current
 * CTC is somewhere between 25 and 27 lakhs" where the "current CTC" cue
 * is >40 chars before the second number. 40 was too narrow: the "between"
 * keyword (a TARGET cue) sat inside the old window and won the competition
 * over the explicit "current CTC" cue that sat just outside it. (S30-B1/B2)
 * 25 chars after captures trailing qualifiers ("...24 LPA CTC overall right now"). */
const LEFT_WINDOW = 65;
const RIGHT_WINDOW = 25;
/* Output sanity clamp (also enforced by the kernel's `clampInr`).
 * Anything outside [1, 5000] LPA is implausible for an Indian
 * salary disclosure and is rejected at the classifier boundary. */
const MIN_LPA = 1;
const MAX_LPA = 5000;

/* ─── Cue tables ───────────────────────────────────────────────────── */

/**
 * Each cue is a small RegExp that captures ONE phrasing the candidate
 * (or recruiter, in the case of `lastAiText`) uses to mark a number's
 * role. Cues are evaluated against a fixed window of text on either
 * side of the number span; the role with the most cue hits wins.
 *
 * Adding coverage:
 *   1. Add the phrasing to the matching role array below.
 *   2. Add a fixture row to `pdf30NumberClassifier.test.ts`.
 *   3. Run the test. No other changes needed.
 *
 * Do NOT add cues that overlap roles (e.g. don't put `\bctc\b` here —
 * "ctc" is a unit qualifier, both current and target candidates say
 * it; role comes from the verb/noun cue, not the unit).
 */

interface CueTable {
  /** Cues that appear BEFORE the number ("expecting 30 LPA"). */
  left: RegExp[];
  /** Cues that appear AFTER the number ("30 LPA chahiye"). */
  right: RegExp[];
}

const CURRENT_CUES: CueTable = {
  left: [
    /\bcurrent(?:ly)?\b/i,
    /\bmy\s+(?:current\s+)?(?:[a-z]+\s+){0,3}(?:package|salary|ctc|comp(?:ensation)?|pay|fitment|fixed|total)\b/i,
    /\bi\s+(?:make|earn|get|draw)\b/i,
    /* S48-B1/S49-B1/S50-B1 (2026-07-24): "I am at N" / "I am on N" — the legacy
     * `\bi.?m\s+at\b` pattern uses `.?` (one optional char between 'i' and 'm'),
     * which matches "I'm" but NOT "I am" (two chars 'a'+'m' after 'i'). Indian
     * candidates commonly state "I am at ₹22L" or "I am on ₹18L" in their
     * opening greeting. Extended to also match "I am at/on". */
    /\bi(?:['']?m|\s+am)\s+(?:at|on)\b/i,
    /* AUDIT-2 follow-up (2026-06-08): role-token between "I'm" and "at"
     * — "I'm a SE3 at Myntra, 24 LPA". The bare `\bi.?m\s+at\b` cue
     * requires adjacency; the role token ("a SE3") breaks it. Surfaced
     * by role-mismatch-needs-clarify scenario. REQUIRES the indefinite
     * article (a/an) as the lead — without it "I'm anchored at 30 LPA"
     * and "I'm targeting at least 30 LPA" would also match and steal
     * the bind from target-cue. With "an?" the pattern only fires on
     * noun-phrase role tokens. */
    /\bi.?m\s+an?\s+(?:[a-z0-9]+\s+){0,3}at\s+\w/i,
    /\b(?:earning|drawing|making|getting|take\s+home)\b/i,
    /\bpackage\s+progression\b/i,
    /* PARSER-1 (2026-06-08): "Total CTC is N LPA" is a very common
     * candidate phrasing in long sessions (EVAL-6 long-horizon-
     * trajectory T2). The pre-existing `my ... ctc` cue requires a
     * possessive pronoun; bare "Total CTC is..." was binding nothing,
     * leaving current-ctc null past turn 2. */
    /\btotal\s+(?:ctc|package|comp(?:ensation)?|pay)\b/i,
    /* Hinglish current-comp frames (live-staging, 2026-06-18). Indian
     * candidates routinely state their current pay as "abhi main 24 LPA
     * pe hoon" (right now I'm at 24), "filhaal 24 le raha hoon"
     * (currently drawing 24). The English `current` cue never fired on
     * these, so currentCtc stayed null, discovery never completed the
     * currentCtc item, and the bot stalled re-probing. The unambiguous
     * present-state markers below ("abhi"/"filhaal" left, "pe/par hoon"
     * + "le raha/rahi hoon" right) bind these to current. None overlap a
     * target frame ("mujhe … chahiye"), so target binds are untouched. */
    /\babhi\s+main\b/i,
    /\bfil[h]?aal\b/i,
    /* S39-B1 (2026-07-21): Hinglish possessive current-CTC frames. "Mera current
     * CTC 30 lakhs hai" — "mera" (my) is a Hindi possessive that unambiguously
     * scopes the figure to the speaker's own pay. "hamara" (our) covers the
     * same possessive when candidates speak for their household/team-context.
     * Neither was in the table before; figures in these frames fell through
     * pickRole's Gricean default and mis-bound to current only when the bot
     * happened to have asked for current CTC. */
    /\bmera(?:\s+current)?\s+(?:ctc|salary|package|comp(?:ensation)?)\b/i,
    /\bhamara\s+(?:ctc|salary)\b/i,
  ],
  right: [
    /\bpe\s+h(?:oo?n|u|un)\b/i,
    /\bpar\s+h(?:oo?n|u|un)\b/i,
    /\ble\s+rah[ai]\s+h(?:oo?n|u|un)\b/i,
    /* Hinglish present-earn frames (offline hostile sweep S1, 2026-06-22).
     * "abhi 30 milta hai mujhe" (right now I GET 30), "30 lpa kama raha
     * hu" (earning 30), "leta hu" (I take/draw). These present-tense earn
     * verbs are unambiguous CURRENT-comp disclosures. Before this, the
     * frame carried no CURRENT cue, so a trailing dative "mujhe" (a
     * TARGET_CUES.left token) tripped the targetAnywhere guard in pickRole
     * and BLOCKED the bot-asked-current Gricean default — currentCtc stayed
     * null, discovery never completed, the bot never anchored, and every
     * later Hindi accept was phase-gate-vetoed (no offer on the table).
     * Recognising the earn verb makes CURRENT score >0 and win the
     * current>target tiebreak outright. None of these overlap a genuine
     * "mujhe … chahiye" TARGET ask (no earn verb), so target binds are
     * untouched. */
    /\bmil(?:t[aei]|\s+rah[aei])\s+h(?:ai|ain|oo?n|u|un|e|y)\b/i,
    /\bkama(?:t[aei]|\s+rah[aei])\s+h(?:ai|oo?n|u|un|y|e)\b/i,
    /\ble(?:t[aei])\s+h(?:ai|oo?n|u|un|y|e)\b/i,
    /^\s*(?:lpa|lakhs?|lacs?|l|cr|crores?)\s+ctc\b(?!\s+(?:expectation|target|expect|range))/i,
    /^\s*(?:lpa|lakhs?|lacs?|l|cr|crores?)\s+ctc\s+(?:overall|total|annual|right\s+now|presently|at\s+present)/i,
    /* S48-B1/S49-B1/S50-B1 (2026-07-24): "N LPA currently" / "N lakhs right
     * now" — when a candidate proactively discloses CTC in the opening turn
     * ("52 LPA currently, targeting 85 LPA") without the AI having asked,
     * `CURRENT_CUES.left` can't fire because "currently" sits in the RIGHT
     * window (after the number+unit). SalarySpan.end already includes the
     * unit token, so the right window starts AFTER the unit — match the
     * temporal adverb at the start of the window, not the unit. */
    /^\s*(?:currently|right\s+now|presently)\b/i,
    /* AUDIT-2 (2026-06-08): the "X LPA total." compact disclosure cue
     * lives in the LAST_AI_ASKED_*-style fall-through layer in pickRole
     * (see SENTENCE_FINAL_TOTAL_RE below), NOT here in CURRENT_CUES.
     * Adding it as a right-cue tied with target-verb left-cues
     * ("I'm looking for 60 LPA total.") and current incorrectly won the
     * tiebreak. The fall-through layer only fires when nothing else
     * scored, which preserves both: S3 "Razorpay, 20 LPA total." binds
     * to current (no other cue fires) AND PDF30 "I'm looking for 60
     * LPA total." binds to target (target left-cue wins outright). */
  ],
};

/* Restatement / repetition meta-cues (#40, live-staging 2026-07-08).
 *
 * "I already told you", "as I said/mentioned", "I said/mentioned already"
 * signal that the candidate is REPEATING a previously-stated figure — but
 * they do NOT say WHICH figure (current pay vs target ask). Historically
 * they lived inside CURRENT_CUES.left because, in isolation ("I told you,
 * 24 LPA CTC overall"), the repeated figure is almost always the current
 * CTC and no other cue fires. The failure mode: when the SAME span also
 * carries an explicit target declaration — "I already told you: 55 lakhs
 * is my target" — the restatement cue tied the target cue on score and won
 * the current>target tiebreak, binding 55 to CURRENT. That overwrote the
 * real current CTC (42) and fired a phantom same-axis contradiction the
 * candidate could not clear (restating either number just flipped it).
 *
 * Fix: treat these as the WEAKEST tier. They reinforce `current` ONLY when
 * no explicit target/competing cue bound the span — i.e. when they are the
 * sole signal. An explicit "is my target" / "offer of" always wins. This
 * preserves the isolated "I told you, 24 LPA CTC overall" bind (no target
 * cue → restatement still scores current) while fixing the collision. */
const RESTATEMENT_CUES: RegExp[] = [
  /\btold\s+you(?:\s+(?:already|multiple\s+times|before|many\s+times))?\b/i,
  /\b(?:as|like)\s+i\s+(?:said|mentioned|stated|told\s+you)\b/i,
  /\b(?:said|mentioned)\s+(?:already\s+)?/i,
];

const TARGET_CUES: CueTable = {
  left: [
    /* PDF #45 fix (2026-05-22) — the prior `expect(?:ing|ed)?` form
     * required a word boundary right after `expect`, which the noun
     * forms "expectation" / "expectations" fail (the `a` after `expect`
     * is a word char). User-reported Flipkart transcript: candidate
     * said "my expectation is 46 LPA CTC" → target field stayed null
     * → discoveryChecklist.targetAnswered stayed false → planner
     * probed target twice more after disclosure → loop, then session
     * died. */
    /\bexpect(?:ing|ed|ation|ations|s)?\b/i,
    /\bwant(?:ing)?\b/i,
    /\blooking\s+for\b/i,
    /* Live-staging (2026-06-19) — "looking AT around 40 LPA for this move".
     * The prior table carried only `looking\s+for`; "looking at" (consider
     * /aim at, the more common spoken form) scored ZERO target cues, so a
     * clear target fell through pickRole's Gricean default and bound to
     * CURRENT whenever the bot's prior turn happened to mention "current
     * package" (the equity probe does). That overwrote the real CTC and
     * fired a false memory callback ("you're at ₹40 LPA right now, yeah?").
     * Safe against current/competing collisions: when a stronger current
     * ("my current CTC") or competing ("offer of") cue co-occurs, the
     * current>competing>target tie-break still wins — "looking at" only
     * decides the bind when it is the SOLE cue, which is exactly target. */
    /\blooking\s+at\b/i,
    /\btarget(?:ing|ed|s)?\b/i,
    /\bhoping(?:\s+for)?\b/i,
    /\baim(?:ing)?\s+for\b/i,
    /\bwould\s+like\b/i,
    /\bi.?d\s+like\b/i,
    /\banchor(?:ing)?(?:\s+(?:around|at|on|between))?\b/i,
    /\bcomfortable\s+with\b/i,
    /\bsettle\s+for\b/i,
    /\bmujhe\b/i,
    /\bmera\s+target\b/i,
    /\basking\b/i,
    /\bneed\b/i,
    /\bbetween\b/i,
    /* Counter-movement frames (live-staging, 2026-06-17). After the
     * recruiter anchors an offer, candidates counter by asking to MOVE a
     * component toward a number — "can we get the fixed closer to 28",
     * "push the base to 30", "bring it up to 32". These carry no classic
     * target verb (expect/want/looking-for) yet are unambiguous counters:
     * the verb-of-motion + a destination number IS the ask. Without these
     * the bare-integer (Pass 4) and unit-bearing paths both scored zero
     * target cues, the counter fell through to a content-free
     * answer-direct deflection, and the negotiation could never close. */
    /\bcloser\s+to\b/i,
    /\bpush(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
    /\bbump(?:\s+\w+){0,3}\s+(?:to|up)\b/i,
    /\bbring(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
    /\bmove(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
    /* Lowered-counter frames (live-staging 2026-06-19, #93). When the
     * candidate CONCEDES toward the offer — "can you get to 35", "stretch
     * to 38", "come up to 36", "let's close at 35", "make it 38" — they are
     * naming a new, lower TARGET. These carried no classic target verb and
     * weren't in the counter-movement block above, so the conceded number
     * scored zero cues, fell through pickRole, and never bound. The planner
     * then kept arguing the candidate's STALE opening anchor instead of
     * engaging the closer number — a stall. Sibling to the push/bump/bring/
     * move frames; same "verb-of-motion + destination" shape. */
    /\bget(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
    /\bstretch(?:\s+\w+){0,3}\s+(?:to|up|towards?)\b/i,
    /\bcome\s+up\s+(?:to|towards?)\b/i,
    /\bclose\s+(?:it\s+|this\s+)?(?:at|out\s+at)\b/i,
    /\bmake\s+it\b/i,
    /* Conditional-close verbs (live-staging 2026-06-19, #94). The two
     * commonest Indian-candidate close phrasings — "if you can do 36",
     * "can you do 36", "if you match 36" — name a concrete number the
     * candidate will accept on. "do" is gated to an offer-REQUEST frame
     * (can/could/if-you-can/able-to) so a bare "I do 3 standups" cannot
     * false-bind a target; "match" is salary-specific enough before a
     * number to stand alone. Without these the conditional acceptance
     * carried no bound counter, so the planner's close-engagement gate
     * had nothing to converge on and the bot diverted to a JB probe. */
    /\b(?:can\s+you|could\s+you|you\s+can|you\s+could|if\s+you\s+can|if\s+you\s+could|able\s+to)\s+do\b/i,
    /\bmatch(?:ing|es|ed)?\b/i,
    /* Ask-anchor / hard-number framing (live-staging, 2026-06-19). A
     * candidate anchoring their ASK — "I won't move for less than 55, that's
     * my number", "at least 55", "55, non-negotiable", "not a rupee less than
     * 55" — is asserting their TARGET, NEVER their current pay. Before this
     * block these phrasings scored ZERO role cues, so when the bot's prior
     * turn had asked for the CURRENT package, the bare number fell through
     * pickRole's Gricean "AI-asked-current → current" default and bound the
     * ask as currentCtc — overwriting the real current AND dropping the
     * target (live hard-haggle: candidate at ₹38L, ask ₹55L, bot read
     * "you're at ₹55 LPA right now"). Scoring these as target cues makes
     * pickRole return `target` outright (max>0) before the current-default
     * can fire. NOTE: explicit *walk-away floor* phrasings ("my floor is X",
     * "can't go below X") are deliberately NOT here — a floor is distinct
     * from a target (see candidateFloor / extractFloor) and must not
     * overwrite a separately-stated target; those are routed away from role
     * binding by isFloorScopedSpan below. */
    /\b(?:less|lower)\s+than\b/i,
    /\b(?:no|not\s+a\s+rupee)\s+less\b/i,
    /\bat\s+least\b/i,
    /* S40-B1/S41-B1 (2026-07-21): "at least N" and "minimum N" both introduce
     * a TARGET floor. `at least` was already here but `minimum` was absent —
     * "minimum 42 lakhs" scored zero target cues and fell through to the
     * current default. `kam se kam` is the Hindi equivalent and covers Hinglish
     * disclosures. These reinforce TARGET scoring, not FLOOR: unlike an explicit
     * walk-away ("can't go below"), these are ask-anchors that correctly
     * bind to target (see isFloorScopedSpan which guards the true walk-away case). */
    /\bminimum\b/i,
    /\bkam\s+se\s+kam\b/i,
    /\bnon[-\s]?negotiable\b/i,
    /\bbottom\s+line\b/i,
    /\bfirm\s+(?:at|on)\b/i,
    /\bmy\s+(?:number|ask|figure)\b/i,
  ],
  right: [
    /\bchahiye\b/i,
    /\bka\s+package\b/i,
    /\bmil\s+jaye\b/i,
    /\bmilna\s+chahiye\b/i,
    /\bexpect\s+kar(?:ta|ti)\s+hu\b/i,
    /* S39-B1 (2026-07-21): Expand Hinglish target-verb right-cues to cover the
     * full conjugation family — "chahiye" is already above; "chahta/chahti" must
     * also cover hoon/hun/oon (formal and informal first-person present) so that
     * "42 lakhs chahta hoon" and "42 chahti hun" bind to TARGET, not fall through
     * to the Gricean current default. The old bare `hu` forms missed the longer
     * conjugations that Sarvam/Azure STT often transcribes in full. */
    /\bchaht[aie]\s+h(?:u|oo?n|un)\b/i,
    /* Ask-anchor framing stated AFTER the number ("55 total, that's my
     * number", "55, non-negotiable", "55, no less"). Same rationale as the
     * ask-anchor block above — these are target assertions, never current. */
    /\bthat.?s\s+my\s+(?:number|ask|figure|final)\b/i,
    /* "42 is my final figure / my figure / my expectation" — Indian-HR
     * candidates state the target as a "figure" or "expectation" just as
     * often as "number/ask". Live-staging 2026-06-19: these bound null.
     * #40 (live-staging 2026-07-08): `target` added to the alternation.
     * "55 lakhs is my target" is the single most literal way to state an
     * ask, yet "my target" was absent here — target scored 0, and a
     * co-occurring restatement cue ("I already told you: 55 … is my
     * target") bound the 55 to CURRENT, overwriting the real current CTC
     * and firing a phantom same-axis contradiction the candidate could
     * never clear. See RESTATEMENT_CUES below for the sibling half. */
    /\bmy\s+(?:final\s+)?(?:number|ask|figure|expectation|target)\b/i,
    /\bmy\s+bottom\s+line\b/i,
    /\bnon[-\s]?negotiable\b/i,
    /\bno\s+less\b/i,
  ],
};

const COMPETING_CUES: CueTable = {
  left: [
    /\bcompeting\s+offer(?:\s+(?:of|at))?\b/i,
    /\banother\s+offer(?:\s+(?:of|at))?\b/i,
    /\banother\s+opportunity(?:\s+(?:of|at))?\b/i,
    /\bother\s+offers?\b/i,
    /* S36-B2 (2026-07-23) — "offer for X" was missing; "of/at" were covered
     * but "for" (very common in Indian English: "an offer for 58L") was not.
     * Added "for" to the preposition alternation so "I have an offer for 58L
     * from Google" binds the 58L as competing, not as a stray target. */
    /\boffer\s+(?:of|at|for)\b/i,
    /\bin[-\s]?hand(?:\s+offer)?(?:\s+(?:of|at|for))?\b/i,
    /\balready\s+have\b/i,
    /\breceived\s+(?:an?\s+)?offer\b/i,
    /\bgot\s+an?\s+offer(?:\s+(?:of|at|for))?\b/i,
    /\bmultiple\s+offers?\b/i,
    /* Rival-company-named competing offer (live-staging 2026-06-19, #92).
     * Candidates routinely cite a competitor by name with the company
     * BETWEEN "offer" and the amount — "I have an offer from Zomato at 38",
     * "got a Swiggy offer at 40 LPA". The `\boffer\s+(?:of|at)\b` cue above
     * needs them adjacent, so the rival amount bound to NO role and the bot
     * could not acknowledge or match it — the "competing offer ignored"
     * defect. Allow up to a short company name between "offer from" and the
     * amount; the negative lookahead keeps it from matching OUR offer
     * ("the offer from you at 35"). Plus a bare "have an/another offer"
     * presence cue for phrasings with no "from". */
    /\boffer\s+from\s+(?!you\b|us\b|your\b|me\b|the\s+company\b|here\b)\w+(?:\s+\w+){0,3}\s+(?:of|at|for)\b/i,
    /\b(?:have|hold)\s+(?:an?|another|other)\s+offers?\b/i,
  ],
  right: [],
};

/** Sentence-level cue: did the bot's last turn explicitly ask for the
 *  candidate's current CTC? When yes, an unqualified number in the
 *  candidate's reply binds to `current` (Gricean cooperation). */
const LAST_AI_ASKED_CURRENT_CTC = new RegExp(
  [
    String.raw`\bcurrent(?:ly)?\s+(?:total\s+)?(?:annual\s+)?ctc\b`,
    String.raw`\btotal\s+(?:annual\s+)?ctc\b`,
    String.raw`\bwhat.?s\s+your\s+(?:current\s+)?(?:total\s+)?(?:annual\s+)?ctc\b`,
    String.raw`\bctc\s+at\s+(?:present|the\s+moment)\b`,
    String.raw`\bpresent\s+ctc\b`,
    String.raw`\byour\s+(?:current\s+)?package\b`,
  ].join("|"),
  "i",
);

/** AUDIT-2 (2026-06-08): symmetric companion. Did the bot's last turn
 *  ask for the candidate's TARGET / expectation? Bare-number replies
 *  to a target probe should bind to `target`, not fall through to
 *  phase-default. Surfaced by bare-number-reply-in-probe scenario
 *  whose target probe ("What's your target for this move?") wasn't
 *  recognized because no symmetric pattern existed. */
const LAST_AI_ASKED_TARGET = new RegExp(
  [
    String.raw`\bwhat.?s\s+your\s+(?:target|expectation|ask|expected|number)\b`,
    String.raw`\b(?:target|expectation|expected\s+ctc)\s+for\s+this\s+(?:move|role)\b`,
    String.raw`\byour\s+(?:target|expectation|expected\s+ctc)\b`,
    String.raw`\bhow\s+much\s+(?:are\s+you\s+)?(?:looking|expecting|targeting|asking)\b`,
    String.raw`\bwhat\s+(?:are\s+you|number\s+are\s+you)\s+(?:looking\s+for|targeting|expecting)\b`,
    /* MVP-audit Fix B (2026-06-18): the deterministic canonical target
     * probes the bot actually emits — none of the patterns above matched
     * them, so a bare-number reply ("32.") to the bot's OWN target question
     * never bound to `target`, discovery stalled, and no offer was ever
     * anchored. Match the canonical fitment/expected probes verbatim-ish so
     * the Gricean bare-number default fires on the path the bot drives.
     * See prose/discovery-probe.ts and prose/anchor-with-offer.ts. */
    String.raw`\bfitment\s+(?:you\s+were|were\s+you|you.?re)\b`,
    String.raw`\bwhat\s+fitment\b`,
    String.raw`\banchoring\s+on\b`,
    String.raw`\bwhat\s+range\s+are\s+you\b`,
    String.raw`\bon\s+the\s+expected\s+(?:side|fitment)\b`,
  ].join("|"),
  "i",
);

/** MVP-audit Fix B (2026-06-18): strong present-pay cues used to emit a
 *  bare-integer span in Pass 4 even with no explicit AI question context
 *  ("Current 26 fixed.", "I'm at 22 fixed, targeting 34 total."). Tight on
 *  purpose — only unambiguous current-pay idioms, never bare "at"/"I'm"
 *  which collide with age/time ("I'm 28", "meet at 3"). pickRole then
 *  scores the role; this gate only decides whether a span exists at all. */
const CURRENT_CUE_PRESENCE =
  /\b(?:current(?:ly)?|presently|at\s+present|in\s+hand|i.?m\s+at|i\s+am\s+at|earning|drawing|making|getting|take\s+home)\b/i;

/* ─── Number-span finder ───────────────────────────────────────────── */

/** A salary-shaped number found in the utterance. */
interface SalarySpan {
  /** Value normalized to LPA (crore × 100, USD-k via FX). */
  value: number;
  /** [start, end) character offsets into the input text. */
  start: number;
  end: number;
  /** True when this span is the upper bound of a `X-Y` / `X to Y`
   *  range pattern. The lower bound is dropped — recruiter framing
   *  binds the candidate's ceiling. */
  isRangeUpper: boolean;
}

/** Voice-STT robustness (2026-05-22): mirror the same `lp[a-z]` near-miss
 *  tolerance the shared `_fact-parser.ts` adopted. Indian candidates
 *  spell "L-P-A" out loud and Sarvam / Azure STT regularly mis-transcribe
 *  the trailing vowel ("LPE", "LPI", "LPO", "LPU") or close consonant
 *  ("LPS", "LPP"). The unit shape `[Dd]igits + LP[A-Z]` is unambiguous
 *  in the Indian-HR register; accept the whole family as LPA so the
 *  role-classifier mirrors the fact-parser. */
/* OA-B12 (2026-07-17): "million"/"mn" is a real INR-comp unit for returning-NRI
 * and MNC candidates ("4.8 million" = 48 LPA). Mirrors the same synonym added to
 * _fact-parser UNIT_TOKEN so both subsystems agree. Bare single-letter `m` is
 * deliberately excluded (collides with stray tokens); only million/mn accepted. */
/* S35-B1/B2 (2026-07-23) — "crores" (plural) was missing; the alternation had
 * `cr|crore` but not `crores?`. `cr` doesn't match at a word boundary inside
 * "crores" (next char is 'o'), and `crore` also fails the trailing \b (next
 * char is 's'). Changed `crore` → `crores?` to cover both singular and plural. */
const SALARY_UNIT_GROUP = "(lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|millions?|mn|l|cr|crores?|cash)";
/** Non-capturing version of SALARY_UNIT_GROUP for use in BETWEEN_RANGE_RE
 *  where we need the unit after the first number to be optional and
 *  non-capturing (so group indices stay consistent with RANGE_RE). */
const SALARY_UNIT_GROUP_NC = "(?:lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|millions?|mn|l|cr|crores?|cash)";

/** LPA-shaped salary number: `[₹]? digits [LPA|lakhs|L|cr|crore]`.
 *  Allows zero whitespace between digit and unit ("24LPA"). */
const LPA_NUM_RE = new RegExp(
  `(?:^|[^a-z0-9])(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*${SALARY_UNIT_GROUP}\\b`,
  "gi",
);

/** USD-shaped salary number: `$NNNk` / `$NNN,NNN`. */
const USD_NUM_RE =
  /(?:^|[^a-z0-9])\$\s*([\d,]+(?:\.\d+)?)\s*(k|K)?\b/g;

/** Range pattern — matches `30-35 LPA` / `30 to 35 lakhs` / `₹30 – ₹35 LPA`.
 *  Used to mark the upper-bound number as `isRangeUpper`. */
const RANGE_RE = new RegExp(
  `(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*(?:[-–—]|to)\\s*(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*${SALARY_UNIT_GROUP}\\b`,
  "gi",
);

/** Between-range pattern — matches `between 48 and 52 lakhs` /
 *  `between ₹48 and ₹52L` / `between 48L and 52 lakhs`.
 *  Group layout mirrors RANGE_RE (m[4] = upper digits, m[5] = unit)
 *  so findSalarySpans Pass 0 can reuse the same extraction logic. */
const BETWEEN_RANGE_RE = new RegExp(
  `\\bbetween\\s+(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*${SALARY_UNIT_GROUP_NC}?\\s+and\\s+(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*${SALARY_UNIT_GROUP}\\b`,
  "gi",
);

/** Units that should make us SKIP a numeric match — these are not
 *  salary disclosures. `\d+ days`, `\d+ years`, `\d+%`, `\d+ PF`. */
const NON_SALARY_UNIT_RE =
  /(\d[\d,.]*)\s*(?:%|days?\b|months?\b|years?\b|yrs?\b|percent\b|pf\b|hours?\b|hrs?\b|members?\b|people\b|reports?\b|reportees?\b|engineers?\b|developers?\b|devs?\b|designers?\b|analysts?\b|interns?\b|teammates?\b|contributors?\b|folks?\b|headcount\b|yoe\b)/i;

/* Per-month periodicity (2026-06-15, unbiased-review HIGH). The classifier
 * normalizes every salary span to LPA (lakhs per ANNUM). A figure quoted PER
 * MONTH ("2.4 lakh per month") must be annualized (× 12) or it under-counts
 * by ~12× and silently false-accepts. Periodicity is decided PER SPAN by the
 * span's OWN trailing context — never the whole utterance — so a mixed
 * sentence ("I make 18 LPA now, I want 2.4 lakh per month") annualizes only
 * the per-month figure and leaves the explicitly-annual one untouched. */
const MONTHLY_SPAN_TRAIL_RE = /\b(?:per\s+month|a\s+month|monthly|per\s+mo|\/\s*month)\b/i;
/* A span whose OWN matched text already carries an annual unit (LPA / the
 * STT LP[a-z] family / per annum) is annual by construction — never apply the
 * monthly multiplier to it, even if a stray "per month" trails (contradictory
 * phrasing; annual wins).
 *
 * No leading \b: the unit abuts the digits in the no-whitespace form ("24LPA",
 * which LPA_NUM_RE explicitly supports), where "4"→"L" is not a word boundary
 * and a leading \b would silently miss it — re-allowing a ×12 inflation of an
 * explicitly-annual figure. This RE is tested only against the narrow span
 * substring (digits + unit), so dropping the boundary cannot match a unit
 * embedded in an unrelated word. */
const ANNUAL_UNIT_IN_SPAN_RE = /(?:lpa|lp[a-z]|per\s+annum|annual(?:ly)?|p\.?\s?a\.?)\b/i;

function parseDigits(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function unitMultiplier(unit: string): number {
  const u = unit.toLowerCase();
  if (u === "cr" || u === "crore" || u === "crores") return 100;
  /* OA-B12: ₹N million = 10N LPA. */
  if (u === "mn" || u.startsWith("million")) return 10;
  return 1;
}

/** Scan the text and return every salary-shaped number, in left-to-right
 *  order. Ranges are emitted as a single `isRangeUpper` span (the lower
 *  bound is dropped). USD spans are converted to LPA at the FX boundary. */
function findSalarySpans(text: string, ctx: NumberRoleContext = {}): SalarySpan[] {
  const spans: SalarySpan[] = [];
  const claimedRanges = new Set<string>(); // "start-end" of digits we've claimed
  /* Pass 0 — "between X and Y [unit]" ranges (S46-B1, 2026-07-23).
   *  RANGE_RE only covers `X-Y` / `X to Y` separators; "between X and Y"
   *  was silently missed, leaving target = null and causing the planner
   *  to re-ask for target every turn. Same extraction logic as Pass 1. */
  for (const m of text.matchAll(BETWEEN_RANGE_RE)) {
    if (m.index == null) continue;
    const upper = parseDigits(m[4]);
    const unit = m[5];
    if (!Number.isFinite(upper)) continue;
    const value = upper * unitMultiplier(unit);
    if (value < MIN_LPA || value > MAX_LPA) continue;
    const start = m.index + m[0].search(/[\d₹]/);
    const end = m.index + m[0].length;
    spans.push({ value, start, end, isRangeUpper: true });
    claimedRanges.add(`${m.index}-${end}`);
  }
  /* Pass 1 — ranges. Mark the upper bound, claim both numbers' offsets. */
  for (const m of text.matchAll(RANGE_RE)) {
    if (m.index == null) continue;
    const upper = parseDigits(m[4]);
    const unit = m[5];
    if (!Number.isFinite(upper)) continue;
    const value = upper * unitMultiplier(unit);
    if (value < MIN_LPA || value > MAX_LPA) continue;
    const start = m.index + m[0].search(/[\d₹]/);
    const end = m.index + m[0].length;
    spans.push({ value, start, end, isRangeUpper: true });
    claimedRanges.add(`${m.index}-${end}`);
  }
  /* Pass 2 — non-range LPA numbers. */
  for (const m of text.matchAll(LPA_NUM_RE)) {
    if (m.index == null) continue;
    /* Skip if this span sits inside a previously-claimed range. */
    const innerStart = m.index + m[0].search(/[\d₹]/);
    const innerEnd = m.index + m[0].length;
    const overlapping = [...claimedRanges].some((k) => {
      const [s, e] = k.split("-").map(Number);
      return innerStart >= s && innerEnd <= e;
    });
    if (overlapping) continue;
    /* Reject if matched text is actually a non-salary unit token. */
    const left = Math.max(0, m.index - 10);
    const windowText = text.slice(left, innerEnd + 10);
    if (NON_SALARY_UNIT_RE.test(windowText) && !/(?:lpa|lakhs?|lacs?|\bl\b|cr|crores?)/i.test(m[0])) {
      continue;
    }
    const digits = parseDigits(m[2]);
    if (!Number.isFinite(digits)) continue;
    const value = digits * unitMultiplier(m[3]);
    if (value < MIN_LPA || value > MAX_LPA) continue;
    spans.push({ value, start: innerStart, end: innerEnd, isRangeUpper: false });
  }
  /* Pass 3 — USD. Converted to LPA via fixed FX (matches legacy
   * `extractUsdAmount` behaviour). */
  for (const m of text.matchAll(USD_NUM_RE)) {
    if (m.index == null) continue;
    let usd = parseDigits(m[1]);
    if (!Number.isFinite(usd)) continue;
    if (/k/i.test(m[2] || "")) usd *= 1000;
    if (usd < 10_000 || usd > 5_000_000) continue;
    const lpa = Math.round((usd * USD_TO_INR) / 100_000 * 10) / 10;
    if (lpa < MIN_LPA || lpa > MAX_LPA) continue;
    const innerStart = m.index + m[0].indexOf("$");
    const innerEnd = m.index + m[0].length;
    spans.push({ value: lpa, start: innerStart, end: innerEnd, isRangeUpper: false });
  }
  /* Pass 4 — bare integers preceded by a strong anchor/target cue.
   *  Candidates often drop the unit when the verb already carries the
   *  role ("the anchor I had in mind was around 28"). We only emit a
   *  span when an `anchor` / `target` / `expecting` cue fires inside
   *  the immediate left window AND the integer falls in the plausible
   *  LPA target range [5, 100]. NON_SALARY_UNIT_RE near the digit kills
   *  the match (28 days, 28%, 28 years). */
  const BARE_INT_RE = /(?:^|[^\d.,])(\d{1,3})\b/g;
  /* Counter-movement frames (live-staging, 2026-06-17) — see the matching
   * note in TARGET_CUES above. "closer to", "push/bump/bring/move ... to/up"
   * mark a bare integer as a counter destination ("get the fixed closer to
   * 28") so Pass 4 emits the span; "to be N" is the positional opener for
   * "I'd like the fixed component to be 28". */
  /* Inflection alignment (live-staging, 2026-06-17): these two gate
   * regexes hardcoded bare "target"/"expect", so `\btarget\b` failed to
   * match the inflected "targeting" — "I was really targeting 28 fixed"
   * (bare integer, no LPA unit) emitted no span and the counter vanished.
   * Mirror the inflected forms already used in TARGET_CUES.left so the
   * Pass-4 gate and the scored cue table stay in sync. */
  /* MVP-audit #71 (2026-06-19, reopened): unit-less unprompted TARGET.
   * Fix B handled current-cued and bot-prompted bare integers; the symmetric
   * gap was a candidate VOLUNTEERING a target with the plainest verbs —
   * "I want 35.", "Need at least 34." — where the unit is dropped and no bot
   * question primes the context. The scored TARGET_CUES table already carries
   * `want`/`need` (so pickRole assigns the role correctly), but the Pass-4
   * emission gate omitted them, so NO span was emitted and the target never
   * bound — discovery stalled exactly like finding #2. We add the bare
   * volitional verbs (want/need) plus the "at least" / "minimum of" floor
   * framing to BOTH the presence test and the positional-opener test so the
   * span is emitted; pickRole's existing target cues then bind it. Still NOT
   * fixed: a bare LEADING number with only trailing weak intent ("35 would be
   * good.") — that is genuinely speculative (collides with age/count) and the
   * candidate-speaks-English/says-LPA premise makes it vanishingly rare. */
  /* Floor framing ("won't move for less than 55", "at least 55", "no less
   * than 55") added to BOTH the presence test and the positional-opener so a
   * unit-less floor emits a span even when the bot's prior turn didn't ask a
   * target question and we're not in probe-expectations. The scored
   * TARGET_CUES floor block then binds it to target (see note there). */
  const TARGET_CUE_PRESENCE = /\b(?:anchor(?:ing)?|target(?:ing|ed|s)?|expect(?:ing|ed|ation|ations|s)?|hoping|aim(?:ing)?|looking\s+for|want(?:ing|ed|s)?|need(?:ing|ed|s)?|would\s+like|i.?d\s+like|asking|comfortable\s+with|settle\s+for|closer\s+to|push|bump|bring|move|get|stretch|come\s+up|close\s+at|make\s+it|do|match|less\s+than|lower\s+than|below|at\s+least|minimum|non[-\s]?negotiable|bottom\s+line|my\s+(?:number|floor|ask|figure))\b/i;
  const POSITIONAL_OPENER_AT_END = /(?:\b(?:around|about|at|of|near|like|maybe|is|are|was|were|be|to|than|below)\s+|\b(?:to\s+be|closer\s+to|up\s+to|at\s+least|a\s+minimum\s+of|minimum\s+of|less\s+than|lower\s+than|no\s+less\s+than|not\s+less\s+than|make\s+it|do|match)\s+|\b(?:anchor(?:ing)?|target(?:ing|ed|s)?|expect(?:ing|ed|ation|ations|s)?|hoping(?:\s+for)?|aim(?:ing)?\s+for|looking\s+for|want(?:ing|ed|s)?|need(?:ing|ed|s)?|would\s+like|i.?d\s+like|asking)\s+(?:around\s+|about\s+|at\s+|of\s+)?)$/i;
  /* Anchored to the IMMEDIATE tail of THIS integer (live-staging 2026-06-19,
   * #94). The prior unanchored form `[\d,.]\s*unit` matched a DIFFERENT
   * number's unit downstream: in "do 36 with a 3 lakh joining bonus" it saw
   * the "3 lakh" and suppressed the bare 36 entirely, so the candidate's
   * real counter never bound. Same greedy-window defect already fixed for
   * NON_SALARY_UNIT_ANCHORED below. `^` + `\s*` means only whitespace may sit
   * between the number and the unit — an intervening digit (another number)
   * breaks the match, so "36" is no longer swallowed by "3 lakh", while a
   * genuine "36 lakh" / "36 LPA" still abuts and is correctly deferred. */
  const SALARY_UNIT_NEARBY = /^[\d,.]+\s*(?:lpa|lakhs?|lacs?|cr|crores?|\bl\b)/i;
  /* MVP-audit Fix B (2026-06-18): three additional bare-integer emission
   * gates beyond the target-cue gate. Root cause of the discovery
   * stalemate (audit finding #2): a candidate answering the recruiter's
   * direct CTC question with a unit-less number ("24."), or stating
   * present pay with a current cue ("Current 26 fixed.", "I'm at 22
   * fixed"), emitted NO span — so currentCtc never bound, discovery never
   * completed, and the bot looped the CTC probe to a stalemate. We emit
   * the span here; pickRole's existing current/target/Gricean defaults
   * assign the role. NOT the deferred unprompted unit-less TARGET case
   * (#71): these bind via the bot's direct question or an explicit current
   * cue, not by speculation. The pure-question gate is restricted to a
   * lone bare number (no other span yet found) so an incidental integer in
   * a unit-bearing answer ("26 LPA, team of 12") can't bind. */
  const aiAskedCurrentCtc = !!ctx.lastAiText && LAST_AI_ASKED_CURRENT_CTC.test(ctx.lastAiText);
  const aiAskedTargetCtc = !!ctx.lastAiText && LAST_AI_ASKED_TARGET.test(ctx.lastAiText);
  const inProbeExpectations = ctx.phase === "probe-expectations";
  for (const m of text.matchAll(BARE_INT_RE)) {
    if (m.index == null) continue;
    const digitStart = m.index + m[0].search(/\d/);
    const digitEnd = digitStart + m[1].length;
    if (spans.some((s) => digitStart >= s.start && digitEnd <= s.end)) continue;
    const n = parseDigits(m[1]);
    if (!Number.isFinite(n) || n < 5 || n > 100) continue;
    const leftWindow = text.slice(Math.max(0, digitStart - LEFT_WINDOW), digitStart);
    /* Non-salary-unit guard — kills "30 days" / "30%" / "30 years" / "7 yrs".
     * Adversarial-sweep fix (2026-06-19): this MUST be anchored to the unit
     * IMMEDIATELY trailing THIS integer. The prior `digitEnd + 20` window
     * reached downstream and matched a DIFFERENT number's unit — e.g. for
     * "I'm at 30, 7 yrs." the window around "30" swallowed "7 yrs", so the
     * real CTC (30) was wrongly discarded and discovery looped the CTC probe
     * forever. Build "<thisNumber><immediate tail>" and require the unit to
     * abut this number (anchored ^). */
    const NON_SALARY_UNIT_ANCHORED =
      /^\d[\d,.]*\s*(?:%|days?\b|months?\b|years?\b|yrs?\b|percent\b|pf\b|hours?\b|hrs?\b|members?\b|people\b|reports?\b|reportees?\b|engineers?\b|developers?\b|devs?\b|designers?\b|analysts?\b|interns?\b|teammates?\b|contributors?\b|folks?\b|headcount\b|yoe\b)/i;
    if (NON_SALARY_UNIT_ANCHORED.test(m[1] + text.slice(digitEnd, digitEnd + 10)))
      continue;
    /* Non-salary LEFT context (live-staging 2026-06-19, scenario C —
     * Razorpay PM). A bare integer naming a TEAM / GROUP / HEADCOUNT size —
     * "managed a team of 8", "group of 12", "headcount of 30", "a squad of
     * 6" — is an org-size metric, NOT a salary figure. NON_SALARY_UNIT_RE
     * above only catches the disqualifier AFTER the number ("8 people", "8
     * engineers"); the collective-noun framing puts it BEFORE the number
     * ("team of 8") with nothing trailing, so "8" leaked through the
     * probe-expectations bare-number default and bound as the candidate's
     * target. Since 8 ≤ the ₹35L offer, the auto-accept gate then read it as
     * a guaranteed-accept counter and FALSE-CLOSED the negotiation at turn 2
     * — every later turn (the real ₹40 ask, a conditional accept) was then
     * treated as post-close noise. Anchored to the end of the left window so
     * only an immediately-preceding collective frame suppresses the span; a
     * genuine "₹8 LPA" still carries its unit and never reaches Pass 4. */
    const NON_SALARY_LEFT_CONTEXT =
      /\b(?:team|squad|group|crew|pod|cohort|batch|org|organi[sz]ation|division|department|dept|headcount|staff|workforce|reportees?|reports?)\s+(?:of|size\s+of|sized|comprising|with)\s*$/i;
    if (NON_SALARY_LEFT_CONTEXT.test(leftWindow)) continue;
    /* If a salary unit (LPA / lakh / crore) follows this integer, it
     * was already considered by Pass 2 — either claimed or rejected by
     * the clamp. Don't second-guess. */
    const rightTail = text.slice(digitEnd, Math.min(text.length, digitEnd + 25));
    if (SALARY_UNIT_NEARBY.test(m[1] + rightTail)) continue;
    const viaTargetCue =
      TARGET_CUE_PRESENCE.test(leftWindow) && POSITIONAL_OPENER_AT_END.test(leftWindow);
    const viaCurrentCue = CURRENT_CUE_PRESENCE.test(leftWindow);
    /* Adversarial-sweep fix (live-staging 2026-06-19) — RIGHT-side target
     * cue. The left-cue gate above only fires when the target cue PRECEDES
     * the number ("looking for 40"). Indian candidates routinely put the
     * cue AFTER: "40 is my number", "40 is my ask", "42 is my final
     * figure". The bare integer then emitted no span, so the candidate's
     * stated ask never registered (live: "...so 40 is my number." bound
     * nothing). Emit when an unambiguous TARGET_CUES.right idiom abuts the
     * number; role assignment is left to scoreRolesForSpan, whose
     * clause-clipped windows keep an adjacent earlier number's cues out. */
    const viaTargetCueRight = TARGET_CUES.right.some((re) => re.test(rightTail));
    /* Companion CURRENT right-cue (offline hostile sweep S1, 2026-06-22).
     * Symmetric to viaTargetCueRight: the left-cue gate (CURRENT_CUE_PRESENCE)
     * only fires when the current cue PRECEDES the number. The Hindi present-
     * earn frame puts it AFTER, unit-less — "abhi 30 milta hai mujhe" (right
     * now I get 30), "30 kama raha hu" (earning 30). Without a unit these
     * never reached Pass 2, and with an empty bot-question context the Gricean
     * gate didn't fire either, so the bare integer emitted no span — currentCtc
     * stayed null, discovery never completed, the bot never anchored, and every
     * later Hindi accept was phase-gate-vetoed. Reuses CURRENT_CUES.right (the
     * new earn-verb patterns) as the single source so span-emission and role-
     * scoring agree; scoreRolesForSpan then binds it to current. */
    const viaCurrentCueRight = CURRENT_CUES.right.some((re) => re.test(rightTail));
    /* Companion: a COMPETING cue in the left window ("competing offer at
     * 42", "another offer at 42") with a UNIT-LESS amount. Pass 2 already
     * claims unitted competing numbers ("42 LPA"); the bare-integer case
     * fell through every gate (no target/current cue, not lone) and the
     * competing offer was silently dropped. */
    const viaCompetingCue = COMPETING_CUES.left.some((re) => re.test(leftWindow));
    /* Pure Gricean / phase context: the bot just asked CTC or expectation
     * (or we're in probe-expectations) and the candidate replied with a
     * lone bare number. Gate on `spans.length === 0` so only the first
     * unit-less number in an otherwise-numberless reply binds. */
    const viaQuestionContext =
      spans.length === 0 && (aiAskedCurrentCtc || aiAskedTargetCtc || inProbeExpectations);
    if (!viaTargetCue && !viaTargetCueRight && !viaCurrentCue && !viaCurrentCueRight && !viaCompetingCue && !viaQuestionContext) continue;
    spans.push({ value: n, start: digitStart, end: digitEnd, isRangeUpper: false });
  }
  spans.sort((a, b) => a.start - b.start);
  /* Per-span monthly annualization. For each span, search the text from its
   * end up to the next span's start (capped at +20 chars so "₹2.4L in hand
   * per month" still attributes, but a later number's "per month" cannot
   * bleed back). Skip spans whose own unit is explicitly annual. */
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    if (ANNUAL_UNIT_IN_SPAN_RE.test(text.slice(sp.start, sp.end))) continue;
    const nextStart = i + 1 < spans.length ? spans[i + 1].start : text.length;
    const win = text.slice(sp.end, Math.min(nextStart, sp.end + 20));
    if (MONTHLY_SPAN_TRAIL_RE.test(win)) {
      sp.value = Math.round(sp.value * 12 * 10) / 10;
    }
  }
  return spans;
}

/* ─── Per-number role classification ───────────────────────────────── */

/** Score how strongly each role's cues match the window around a span.
 *  Score = number of distinct cue patterns that hit. Ties resolved by
 *  preference order: current > competing > target (current has the
 *  strongest cue specificity — verb / "my" / "told you"). */
function scoreRolesForSpan(
  text: string,
  span: SalarySpan,
): { scores: Record<NumberRole, number>; genericAdverbOnlyForCurrent: boolean; genericAdverbFired: boolean; targetScoreLeft: number; currentScoreStrictLeft: number } {
  let leftWindow = text.slice(Math.max(0, span.start - LEFT_WINDOW), span.start);
  /* Clause clipping: when an earlier salary disclosure sits in the
   * window ("18 LPA and I'd like 32 LPA"), cues before it belong to
   * that number, not this span. Truncate the window to start AFTER
   * the last such disclosure or clause boundary. */
  const PRIOR_DISCLOSURE = /[\d,.]+\s*(?:lpa|lakhs?|lacs?|cr|crores?|\bl\b)\b/gi;
  let lastEnd = -1;
  for (const m of leftWindow.matchAll(PRIOR_DISCLOSURE)) {
    if (m.index != null) lastEnd = Math.max(lastEnd, m.index + m[0].length);
  }
  /* Clause-boundary clip (#67, live-staging 2026-06-18). The prior-
   * disclosure clip above only fires when the EARLIER clause's number
   * carried a salary unit (LPA / lakh / crore). When it didn't — a
   * compound, UNIT-LESS disclosure like "I'm at 22 fixed currently,
   * targeting 34 total" or "current is 18, expecting 26" — the prior
   * clause's role cue ("currently" / "current") leaked into THIS span's
   * left window and won the current>target tiebreak, so 34/26 mis-bound
   * to current (or dropped) and the real target never registered.
   *
   * Clip at a clause boundary ONLY when a FREE-STANDING NUMBER precedes
   * it within the window — i.e. the earlier clause carried its OWN
   * quantity, so its cues belong to that number, not this span. The
   * guard is load-bearing twice over:
   *   - a bare lead-in with no prior number ("I told you, 24 LPA CTC
   *     overall", "as I mentioned, 17 LPA total CTC") keeps its cue
   *     ("told you" / "mentioned") — clipping there would strip the only
   *     current cue and mis-bind the number;
   *   - a digit GLUED to letters is a level/identifier token, NOT a
   *     salary ("I'm a SE3 at Myntra, 24 LPA", "L5 at Google, 30 LPA").
   *     A bare `/\d/` guard fired on the "3" in "SE3" and clipped away
   *     the "at <employer>" current-CTC context, dropping the binding
   *     (eval scenario role-mismatch-needs-clarify). FREE_STANDING_NUMBER
   *     requires the digit to begin at a word boundary, so SE3 / L5 /
   *     SDE2 no longer count as a prior disclosure. */
  const FREE_STANDING_NUMBER = /(?:^|[^A-Za-z0-9])\d/;
  let clauseCut = -1;
  for (const sep of [",", ";", "."]) {
    let idx = leftWindow.indexOf(sep);
    while (idx >= 0) {
      if (FREE_STANDING_NUMBER.test(leftWindow.slice(0, idx))) clauseCut = Math.max(clauseCut, idx);
      idx = leftWindow.indexOf(sep, idx + 1);
    }
  }
  lastEnd = Math.max(lastEnd, clauseCut >= 0 ? clauseCut + 1 : -1);
  if (lastEnd >= 0) leftWindow = leftWindow.slice(lastEnd);
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + RIGHT_WINDOW));
  const scoreOne = (cues: CueTable): number => {
    let n = 0;
    for (const re of cues.left) if (re.test(leftWindow)) n++;
    for (const re of cues.right) if (re.test(rightWindow)) n++;
    return n;
  };
  const currentScore = scoreOne(CURRENT_CUES);
  const targetScore = scoreOne(TARGET_CUES);
  const competingScore = scoreOne(COMPETING_CUES);
  /* #40 — restatement meta-cues are the weakest tier: they reinforce
   * `current` only when no explicit target/competing cue bound this span
   * (see RESTATEMENT_CUES). Left-window only, mirroring how they used to
   * sit in CURRENT_CUES.left. */
  const restatementFired = RESTATEMENT_CUES.some((re) => re.test(leftWindow));
  const currentWithRestatement =
    restatementFired && targetScore === 0 && competingScore === 0
      ? currentScore + 1
      : currentScore;
  /* S4-B16 (2026-07-22): "currently I am looking for 40 LPA" — the adverb
   * `currently` (CURRENT_CUES.left[0]) is a temporal modifier, NOT a
   * pay-disclosure verb. When it is the ONLY current cue and a target verb
   * appears in the LEFT window (same clause, before the number), the
   * current>target tiebreak is wrong — target must win.
   *
   * Guard: only check TARGET_CUES.left (NOT right). The right window extends
   * past the next salary figure ("Currently at 32 LPA and 38 LPA is my
   * target"), so TARGET_CUES.right can bleed from the 38-clause into 32's
   * right window and falsely fire. A target verb genuinely scoping THIS number
   * must precede it. */
  const genericAdverbFired = CURRENT_CUES.left[0].test(leftWindow);
  let currentScoreStrict = 0;
  let currentScoreStrictLeft = 0;
  for (let i = 1; i < CURRENT_CUES.left.length; i++) {
    if (CURRENT_CUES.left[i].test(leftWindow)) { currentScoreStrict++; currentScoreStrictLeft++; }
  }
  for (const re of CURRENT_CUES.right) if (re.test(rightWindow)) currentScoreStrict++;
  const targetScoreLeft = TARGET_CUES.left.reduce((n, re) => n + (re.test(leftWindow) ? 1 : 0), 0);
  const genericAdverbOnlyForCurrent = genericAdverbFired && currentScoreStrict === 0;
  return {
    scores: { current: currentWithRestatement, target: targetScore, competing: competingScore },
    genericAdverbOnlyForCurrent,
    genericAdverbFired,
    targetScoreLeft,
    currentScoreStrictLeft,
  };
}

/** Pick the winning role for a span, or null if no cue fired and
 *  sentence context doesn't break the tie. */
function pickRole(
  scores: Record<NumberRole, number>,
  ctx: NumberRoleContext,
  span: SalarySpan,
  text: string,
): NumberRole | null {
  const max = Math.max(scores.current, scores.target, scores.competing);
  if (max > 0) {
    /* Tie-break order: current > competing > target. Empirically the
     * highest-precision cue family (current — verb / "my" / "told
     * you") should win when multiple roles fire on the same span. */
    if (scores.current === max) return "current";
    if (scores.competing === max) return "competing";
    return "target";
  }
  /* No explicit cue. Sentence-level defaults:
   *   - Bot just asked for current CTC → bare number = current.
   *   - Phase is probe-expectations and no current/competing cue
   *     anywhere in the sentence → bare number = target. */
  const aiAskedCurrent = !!ctx.lastAiText && LAST_AI_ASKED_CURRENT_CTC.test(ctx.lastAiText);
  if (aiAskedCurrent) {
    /* Defensive gate: don't let a bare number bind to current when the
     * sentence as a whole carries a competing cue ("offer of 24 LPA"
     * after the bot asked "current CTC?" — that's still competing). */
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text)) ||
      COMPETING_CUES.right.some((r) => r.test(text));
    const targetAnywhere = TARGET_CUES.left.some((r) => r.test(text)) ||
      TARGET_CUES.right.some((r) => r.test(text));
    if (!competingAnywhere && !targetAnywhere) return "current";
    /* S54-B1/S59-B1/S60-B2 (2026-07-23) — component-labeled CTC survives the
     * targetAnywhere gate. When a candidate says "12 lakh fixed, looking at 18
     * in new role", "looking at" sets targetAnywhere=true and suppresses the
     * aiAskedCurrent default for the 12-span — CTC returns null and the bot
     * re-asks. But "12 lakh fixed" right after the bot's CTC question is
     * unambiguously the FIXED COMPONENT of the current package: a component
     * label ("fixed"/"base"/"basic") immediately trailing the unit in response
     * to a CTC question IS the current CTC, never a target. Re-enable the
     * current bind when: (a) AI asked for CTC, (b) no competing cue, and
     * (c) the span carries a right-adjacent component word. This is tight and
     * conservative — it only fires when all three signals align. */
    if (!competingAnywhere && detectCurrentComponentScope(text, span) === "component") {
      return "current";
    }
  }
  /* AUDIT-2 (2026-06-08): symmetric — bot asked target → bare = target. */
  const aiAskedTarget = !!ctx.lastAiText && LAST_AI_ASKED_TARGET.test(ctx.lastAiText);
  /* S41-B8 (2026-07-23) — ESOP effective-comp sub-total misclassified as target.
   * When the bot has asked for the candidate's target and they explain "my effective
   * comp is 29-30L due to ESOP depreciation", the Gricean / phase default picks up
   * 30 as the target (no explicit target-verb, but aiAskedTarget=true or probe-
   * expectations). A genuine target ask in an Indian salary negotiation is almost
   * never below the candidate's own current CTC — that would be a pay cut. Guard:
   * if the span's value is materially below the established currentCtc (< 95%), don't
   * bind via the bare-number defaults. Explicit target-verb cues ("I'm targeting 30")
   * still win via the cue-scoring path (max > 0) above and are unaffected. */
  const belowEstablishedCtc =
    ctx.currentCtc != null && span.value < ctx.currentCtc * 0.95;
  if (aiAskedTarget) {
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text)) ||
      COMPETING_CUES.right.some((r) => r.test(text));
    const currentAnywhere = CURRENT_CUES.left.some((r) => r.test(text));
    if (!competingAnywhere && !currentAnywhere && !belowEstablishedCtc) return "target";
  }
  if (ctx.phase === "probe-expectations") {
    const currentAnywhere = CURRENT_CUES.left.some((r) => r.test(text));
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text));
    if (!currentAnywhere && !competingAnywhere && !belowEstablishedCtc) return "target";
  }
  /* AUDIT-2 (2026-06-08): "X LPA total." compact-disclosure fall-through.
   * Runs ONLY when nothing else scored. Tests the right window post-LPA
   * for sentence-final "total" with punctuation, e.g. "Razorpay, 20 LPA
   * total." → current. Placed after all other fall-throughs so target-
   * verb left-cues ("I'm looking for 60 LPA total.") win outright via
   * the cue table before this fires. */
  {
    const right = text.slice(span.end, Math.min(text.length, span.end + 25));
    if (/^\s*(?:total|overall)\s*(?:[.!?,]|$)/i.test(right)) {
      const targetAnywhere = TARGET_CUES.left.some((r) => r.test(text));
      const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text));
      if (!targetAnywhere && !competingAnywhere) return "current";
    }
  }
  /* AUDIT-2 follow-up (2026-06-08): considered adding an opening-phase
   * fall-through (bare-number → current) for "Razorpay, 18 LPA." style
   * cold-opens, but it regressed salary-inflation-history which opens
   * with parenthesized career history ("started at TCS (4 LPA), moved
   * to Flipkart (12 LPA)…") — the fall-through bound 4 as current via
   * first-wins, blocking the real 30 LPA later disclosure. Better-
   * specific signal needed before re-enabling. Deferred. */
  /* Mark unused for lint quiet — `span` is part of the signature so
   * future scoring rules (e.g. position-aware) can extend without
   * touching call sites. */
  void span;
  return null;
}

/* ─── Negation guard ──────────────────────────────────────────────────
 *
 * QUALITY-2 (EVAL-5): "Not 30 LPA, that's too high" was binding 30
 * as target via the bare-number-in-probe-expectations default. Real
 * candidates use negation to REJECT a number a recruiter floated;
 * binding it as their target is exactly the wrong inference.
 *
 * Tight 15-char left window so we don't false-trigger on distant
 * negation in a long sentence. "less than" / "below" / "under"
 * between the negation and the number invert intent ("not less than
 * 30 LPA" = "at least 30 LPA") — those keep the number bindable. */
const NEGATION_LEFT_PATTERNS = [
  /\bnot\b[^.,;]{0,12}$/i,
  /\bno\b[^.,;]{0,12}$/i,
  /\bnever\b[^.,;]{0,12}$/i,
  /\bwon['']?t\b[^.,;]{0,15}$/i,
  /\bwouldn['']?t\b[^.,;]{0,15}$/i,
  /\bshouldn['']?t\b[^.,;]{0,15}$/i,
  /\bcouldn['']?t\b[^.,;]{0,15}$/i,
  /\bnahi(?:n)?\b[^.,;]{0,12}$/i,
];

const NEGATION_INVERTERS = [
  /\bless\s+than\b/i,
  /\bbelow\b/i,
  /\bunder\b/i,
  /\blower\s+than\b/i,
  /\bse\s+kam\b/i, // hindi: "se kam" = "less than"
];

function isNegatedSpan(text: string, span: SalarySpan): boolean {
  const NEGATION_WINDOW = 25;
  const leftWindow = text.slice(Math.max(0, span.start - NEGATION_WINDOW), span.start);
  const hasNegation = NEGATION_LEFT_PATTERNS.some((re) => re.test(leftWindow));
  if (!hasNegation) return false;
  // Inverter between negation and number ("not LESS THAN 30") flips
  // intent back to "at least 30" — bindable.
  const hasInverter = NEGATION_INVERTERS.some((re) => re.test(leftWindow));
  return !hasInverter;
}

/* ─── Equity-scope guard (L1 / PRI-50, 2026-06-17) ────────────────────
 *
 * A number explicitly framed as equity/RSU/ESOP/stock is NOT a CTC,
 * target, or competing-offer figure — it's an equity component, captured
 * separately by extractComponentBreakdown / extractEquityVesting. Without
 * this guard a bundled discovery answer like "RSUs worth roughly 3 LPA a
 * year. My notice is 60 days." fell through pickRole's bot-asked-current
 * default and bound 3 as currentCtc, OVERWRITING the real currentCtc (22)
 * from the prior turn. The kernel then saw current-CTC change 22→3 and
 * fired a spurious contradiction-callout (lever acknowledge-and-recover) —
 * which, pre-Gap-C, killed the session with a 400. Even post-Gap-C it's a
 * wrong "you contradicted yourself" call-out on a non-contradiction.
 *
 * Deliberately narrow: this only suppresses spans that scored ZERO
 * role cues (so an explicit "my current CTC is 24 LPA with equity" keeps
 * binding 24 to current via its scored cue) AND have an equity keyword in
 * a tight window adjacent to the number. */
const EQUITY_SPAN_CUES = [
  /\b(?:rsu|esop)s?\b/i,
  /\bequity\b/i,
  /\bstock(?:\s+(?:options?|units?|grants?|awards?))?\b/i,
  /\brestricted\s+stock\b/i,
  /\bshares\b/i,
];
function isEquityScopedSpan(text: string, span: SalarySpan): boolean {
  const EQUITY_WINDOW = 30;
  const leftWindow = text.slice(Math.max(0, span.start - EQUITY_WINDOW), span.start);
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + EQUITY_WINDOW));
  const window = `${leftWindow} ${rightWindow}`;
  return EQUITY_SPAN_CUES.some((re) => re.test(window));
}

/* Cash-component override (live-staging Flipkart-EM, 2026-06-22). A number
 * explicitly tagged as a CASH component — "48 fixed", "48 LPA base",
 * "32 basic", "in-hand 40" — is the candidate's fixed pay, NOT equity, even
 * when an equity keyword ("plus some ESOPs", "plus stock") trails within the
 * equity window. The equity-scope guard's 30-char window was swallowing the
 * fixed CTC of a perfectly natural disclosure ("Present CTC is 48 fixed plus
 * some ESOPs" → currentCtc dropped to null → the kernel anchored at the raw
 * band FLOOR, BELOW the candidate's own pay). The "plus ESOPs" is a separate,
 * usually-unquantified component captured by extractEquityVesting; it must not
 * poison the cash number. Tight, adjacency-scoped: the cash cue must sit
 * immediately beside THIS number (optionally across an LPA/lakh unit), so a
 * genuinely equity-framed span ("RSUs worth 3 LPA a year") has no adjacent
 * cash tag and stays suppressed. */
const CASH_COMPONENT_RIGHT =
  /^[\s,]*(?:lpa|lpe|l|lakhs?|lacs?|k)?\s*(?:fixed|base|basic|cash|fixed\s+pay|in[-\s]?hand|take[-\s]?home)\b/i;
const CASH_COMPONENT_LEFT =
  /\b(?:fixed|base|basic|cash|fixed\s+pay|in[-\s]?hand|take[-\s]?home)\s+(?:pay\s+)?(?:of\s+|is\s+|at\s+|around\s+|roughly\s+|about\s+)?$/i;
function isCashComponentScopedSpan(text: string, span: SalarySpan): boolean {
  const right = text.slice(span.end, Math.min(text.length, span.end + 16));
  if (CASH_COMPONENT_RIGHT.test(right)) return true;
  const left = text.slice(Math.max(0, span.start - 16), span.start);
  return CASH_COMPONENT_LEFT.test(left);
}

/* Stronger form: an equity keyword sitting IMMEDIATELY before the number
 * ("stock worth 5", "5 in RSUs" → "RSUs" right-adjacent is excluded here;
 * this is left-only) scopes the number to equity even when a current cue
 * ALSO fired ("I get stock worth 5 LPA" — "I get" is a current cue but the
 * 5 is the stock value, not CTC). Left-only + tight window so a trailing
 * "24 LPA with equity on top" keeps binding 24 to current. */
const EQUITY_LEFT_ADJACENT = [
  /\b(?:rsu|esop)s?\s+(?:worth|of|at|around|roughly|about)?\s*$/i,
  /\bequity\s+(?:worth|of|at|is|around|roughly|about)?\s*$/i,
  /\bstock(?:\s+(?:options?|units?|grants?|awards?))?\s+(?:worth|of|at|around|roughly|about)?\s*$/i,
  /\bshares\s+(?:worth|of|at|around|roughly|about)?\s*$/i,
];
function isEquityLeftAdjacentSpan(text: string, span: SalarySpan): boolean {
  const leftWindow = text.slice(Math.max(0, span.start - 24), span.start);
  return EQUITY_LEFT_ADJACENT.some((re) => re.test(leftWindow));
}

/* ─── Walk-away-floor guard (live-staging, 2026-06-19) ─────────────────
 *
 * A candidate stating an explicit WALK-AWAY FLOOR — "my floor is 28",
 * "I can't/won't go below 28", "the lowest I can do is 28", "rock-bottom
 * 28" — is naming the MINIMUM they'll accept, which is a DISTINCT concept
 * from both their current pay AND their target/ask (see candidateFloor /
 * extractFloor in _misc-signals.ts; the kernel keeps the two apart and the
 * planner says "distinct from their target"). These phrasings carry no
 * role cue, so when the bot's prior turn asked for the CURRENT package the
 * bare floor number fell through pickRole's Gricean "AI-asked-current →
 * current" default and bound the FLOOR as currentCtc — the live hard-haggle
 * read "you're at ₹55 LPA right now" off a stated floor. We must NOT instead
 * route the floor to TARGET: a candidate at target 30 who then says "my
 * floor is 28" must keep target=30, not have it overwritten by 28.
 *
 * So: a floor-scoped span that scored ZERO role cues binds to NO role here.
 * Its value is captured by extractFloor → candidateFloor on the kernel side.
 * Ask-anchor framing ("won't move for less than 55, that's my number",
 * "at least 55") is deliberately NOT a floor cue — those score a target cue
 * and bind to target, which is correct. The guard only fires on the
 * explicit walk-away-floor register, and only when no role cue scored, so
 * "my current floor is 22" (current cue present) still binds current. */
const FLOOR_SCOPE_LEFT = [
  /\bmy\s+(?:absolute\s+)?floor\b[^.0-9]*$/i,
  /\bfloor\s+(?:is|would\s+be|sits?\s+at|of)\b[^.0-9]*$/i,
  /\b(?:won['']?t|wouldn['']?t|can['']?t|cannot|couldn['']?t)\s+(?:go|come\s+down|drop|move)\s+(?:below|under|beneath)\b[^.0-9]*$/i,
  /\b(?:lowest|least)\s+i\s+(?:can|could|would|will|'?d|am\s+willing\s+to)\b[^.0-9]*$/i,
  /\brock[-\s]?bottom\b[^.0-9]*$/i,
];
function isFloorScopedSpan(text: string, span: SalarySpan): boolean {
  const FLOOR_WINDOW = 40;
  const leftWindow = text.slice(Math.max(0, span.start - FLOOR_WINDOW), span.start);
  return FLOOR_SCOPE_LEFT.some((re) => re.test(leftWindow));
}

/* Component-bonus scope (live-staging 2026-06-19, #94). A number whose
 * IMMEDIATE right context names a one-time component — "3 lakh joining
 * bonus", "2L sign-on", "1.5 lakh relocation", "5 lakh retention bonus"
 * — is a sweetener ASK, not the candidate's target/current/competing
 * TOTAL. In "if you can do 36 with a 3 lakh joining bonus", the "do"
 * target-cue sits in the left window of BOTH 36 and 3, so the JB amount
 * (3) was scoring a spurious target and — being unit-bearing — beat the
 * bare 36, binding target=3. The kernel tracks JB asks separately; this
 * span must bind to NO role. Anchored to the number (optional unit, then
 * the component noun) so the REAL target one clause earlier ("...do 36
 * with...") is untouched — its right context starts with "with", not a
 * component noun. */
const COMPONENT_BONUS_RIGHT_ANCHORED =
  /^\s*(?:lpa|lakhs?|lacs?|lac|l|k)?\.?\s*(?:as\s+(?:a\s+)?)?(?:joining|signing|sign[-\s]?on|relocation|relo|retention|one[-\s]?time|joining\s+bonus|signing\s+bonus)(?:\s+(?:bonus|allowance|assistance|pay))?\b/i;
function isComponentBonusScopedSpan(text: string, span: SalarySpan): boolean {
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + 40));
  return COMPONENT_BONUS_RIGHT_ANCHORED.test(rightWindow);
}

/* S4-B15 / S5-B20 (2026-07-22): variable-pay component guard.
 *
 * A number tagged by a variable-pay or performance-bonus qualifier in its
 * immediate right context — "₹6L variable", "6 lakh variable pay", "6L
 * variable component", "6 LPA performance bonus", "₹4L annual bonus" — is
 * a CTC sub-component, NOT the candidate's standalone target ask. Before this
 * guard, "I am looking for ₹32L fixed + ₹6L variable" bound target=6 (the
 * variable component read as a ₹6L total target — less than the offer floor —
 * prompting the recruiter to say "₹6L? You're undershooting your level").
 *
 * The fix: if the number's immediate right context (≤ 30 chars) starts with
 * an optional unit then a variable/bonus qualifier, suppress the span — it
 * binds to no role and the kernel reads the total from the explicit fixed+var
 * context via extractComponentBreakdown. Left-adjacent form also caught
 * ("variable pay of ₹6L"). Tight window prevents a trailing "variable"
 * two clauses away from bleeding in.
 *
 * NOT suppressed: "I want variable to be higher" (no number; no span emitted
 * by Pass 2 here), "₹40L variable-pay band" (the unit "band" is not a
 * component qualifier). */
const VARIABLE_COMPONENT_RIGHT_ANCHORED =
  /^\s*(?:lpa|lakhs?|lacs?|lac|l|k)?\.?\s*(?:variable(?:\s+(?:pay|component|salary|ctc|part|portion))?|performance\s+bonus|annual\s+bonus|target(?:ed)?\s+bonus|var(?:iable)?\s+(?:pay|component|portion))\b/i;
/* Fix B (2026-07-22): expanded left-anchored pattern to cover "comes to",
 * "amounts to", "totals", "is around", "works out to" linking verbs that
 * naturally appear between the variable-pay noun and the amount —
 * e.g. "the variable component comes to 8" left-context: "the variable
 * component comes to " which the old pattern missed because "comes to"
 * wasn't in the linking-verb list. Also added "incentive" as a synonym. */
const VARIABLE_COMPONENT_LEFT_ANCHORED =
  /\b(?:variable(?:\s+(?:pay|component|salary|ctc|part|portion))?|performance\s+(?:bonus|incentive)|annual\s+bonus|incentive(?:\s+(?:pay|component|bonus))?|target(?:ed)?\s+bonus|var(?:iable)?\s+(?:pay|component|portion))\s+(?:of\s+|is\s+|at\s+|around\s+|roughly\s+|about\s+|worth\s+|comes?\s+to\s+|amounts?\s+to\s+|totals?\s+(?:to\s+)?|works?\s+out\s+to\s+)?$/i;
function isVariableComponentScopedSpan(text: string, span: SalarySpan): boolean {
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + 30));
  if (VARIABLE_COMPONENT_RIGHT_ANCHORED.test(rightWindow)) return true;
  const leftWindow = text.slice(Math.max(0, span.start - 30), span.start);
  return VARIABLE_COMPONENT_LEFT_ANCHORED.test(leftWindow);
}

/* Non-CTC perk-component guard (OA-B63, 2026-07-18 audit). A number scoped to
 * a recurring/perk allowance — WFH / home-office / setup / internet / remote /
 * wellness / L&D / learning / meal / travel allowance, stipend, or budget — is
 * a benefit ASK, not the candidate's CTC target/current/competing TOTAL. Before
 * this guard, "I'd like a 1 lakh work-from-home setup allowance" bound
 * target=1 (the WFH amount read as a ₹1 LPA total target — a harmful mis-bind),
 * and "26 LPA plus a 2 lakh WFH stipend" silently dropped the stipend. The
 * kernel tracks such perks separately (or not at all); this span binds to NO
 * role. Right-anchored (number then the perk noun) AND left-anchored (perk noun
 * then the number, e.g. "WFH stipend of 50k") so both surface forms are caught,
 * while a genuine total ("26 LPA plus …") keeps binding 26 — its right context
 * starts with "plus", not a perk noun. Mirrors isCashComponentScopedSpan. */
const PERK_NOUN =
  "(?:wfh|work[-\\s]?from[-\\s]?home|remote(?:\\s+work)?|home[-\\s]?office|internet|broadband|setup|set[-\\s]?up|wellness|well[-\\s]?being|learning|l\\s*&\\s*d|l\\s+and\\s+d|upskilling|education|meal|food|travel|commute|gym|fitness)\\s+(?:setup\\s+)?(?:allowance|stipend|budget|reimbursement|perk|benefit)";
const PERK_COMPONENT_RIGHT = new RegExp(
  `^\\s*(?:lpa|lakhs?|lacs?|lac|l|k)?\\.?\\s*(?:for\\s+)?(?:a\\s+)?${PERK_NOUN}\\b`,
  "i",
);
const PERK_COMPONENT_LEFT = new RegExp(
  `\\b${PERK_NOUN}\\s+(?:of\\s+|is\\s+|at\\s+|around\\s+|roughly\\s+|about\\s+|worth\\s+)?$`,
  "i",
);
function isPerkComponentScopedSpan(text: string, span: SalarySpan): boolean {
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + 40));
  if (PERK_COMPONENT_RIGHT.test(rightWindow)) return true;
  const leftWindow = text.slice(Math.max(0, span.start - 40), span.start);
  return PERK_COMPONENT_LEFT.test(leftWindow);
}

/* Relative-increase scope (§9d / PRI-69b, 2026-07-08). A number whose
 * IMMEDIATE right context is an increase marker — "2L more", "2 higher",
 * "3 lakh extra", "5 on top" — is a RELATIVE delta the candidate wants
 * ADDED to the standing offer, NOT an absolute target/counter. Binding it as
 * an absolute total ("2L more" → target ₹2L) let totalScopedCounter read the
 * ₹2L delta as a ₹2L TOTAL counter ≤ offer, and the planner's
 * auto-accept-counter gate false-accepted at the un-bumped offer — bypassing
 * the acceptance classifier's DEMAND_FOR_MORE veto entirely. The kernel has
 * no anchor in this pure classifier to resolve the delta, so the correct
 * minimum is to bind it to NO role; the utterance then routes through the
 * DEMAND_FOR_MORE veto to a counter. Right-anchored + tight so a non-adjacent
 * "more" is untouched: "I want 50, a bit more than the 45" still binds 50
 * (the "more" is not adjacent to 50), and "50 or higher" still binds 50 (the
 * "or" breaks adjacency). The unit is optional because span.end already
 * absorbs it for LPA spans but not for bare-integer spans ("2 more"). */
const RELATIVE_INCREASE_RIGHT_ANCHORED =
  /^\s*(?:lpa|lakhs?|lacs?|lac|l|k|cr|crores?)?\s*(?:more|higher|extra|additional|on\s+top)\b/i;
function isRelativeIncreaseSpan(text: string, span: SalarySpan): boolean {
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + 14));
  return RELATIVE_INCREASE_RIGHT_ANCHORED.test(rightWindow);
}

/* Beat-by / over-reference relative delta (§11b, 2026-07-08). The LEFT-anchored
 * sibling of isRelativeIncreaseSpan. A number governed by a comparison-beat verb
 * over a reference ("beat my current by 5", "exceed it by 3", "top that by 2") —
 * or trailing an over-reference phrase ("5 over my current", "3 above the offer")
 * — is a delta the candidate wants applied to their current pay / the offer, NOT
 * a restatement of that reference. Before this guard, "beat my current by 5"
 * bound 5 as currentCtc: with the candidate's real current (e.g. 38) already on
 * record, that drifted >10% and false-fired the memory contradiction-callout,
 * derailing a perfectly reasonable in-band ask (current + 5 = 43) into a
 * "which figure is authoritative?" reconciliation. This pure classifier has no
 * anchor to resolve the delta to an absolute, so — mirroring §9d — the correct
 * minimum is to bind it to NO role; the utterance then routes through the normal
 * counter path. (Deriving the absolute target = reference + delta is a separate
 * kernel-side enhancement; it needs the stored reference this parser lacks.)
 * Verb-gated to comparison-beats (beat/exceed/top/surpass/better-than/…) so a
 * bare temporal "by 5 pm" or an additive "bump it by 5" stays untouched. */
const BEAT_BY_LEFT_ANCHORED =
  /\b(?:beat|exceed|top|surpass|improve\s+(?:on|upon)|better\s+than|go\s+(?:above|over)|get\s+(?:me\s+)?(?:above|over))\b[^.!?;]{0,24}?\bby\s+$/i;
const OVER_REFERENCE_RIGHT_ANCHORED =
  /^\s*(?:lpa|lakhs?|lacs?|lac|l|k)?\s*(?:over|above|on\s+top\s+of|more\s+than)\s+(?:my\s+|the\s+|their\s+)?(?:current|ctc|comp\w*|package|base|offer|salary)\b/i;
function isBeatByReferenceSpan(text: string, span: SalarySpan): boolean {
  const leftWindow = text.slice(0, span.start);
  if (BEAT_BY_LEFT_ANCHORED.test(leftWindow)) return true;
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + 24));
  return OVER_REFERENCE_RIGHT_ANCHORED.test(rightWindow);
}

/* ─── Aggregator ───────────────────────────────────────────────────── */

/** Main entry point. Returns the role-bound numbers for the utterance.
 *
 *  Algorithm:
 *    1. Find every salary-shaped number span (LPA / USD; range upper).
 *    2. Classify each span's role via cue scoring + context defaults.
 *    3. For each role, pick the FIRST classified number. (Candidates
 *       sometimes disclose two numbers of the same role in one
 *       sentence — "current is 18, expecting 26"; both end up
 *       classified correctly because the cue windows are local.)
 *    4. Drop a number if it's bound to multiple roles (shouldn't
 *       happen after scoring, but defence-in-depth).
 *    5. `targetAsRange` is true when ANY salary span is a range upper
 *       AND a target was bound. */
/* ─── OA-B3 · percentage-expressed target resolver ───────────────────────
 *
 * A candidate can state a target as a HIKE relative to their current CTC —
 * "20% above my CTC", "I want a 30% hike", "25% more than what I make now" —
 * instead of an absolute LPA figure. The "%"/"percent" span is (correctly)
 * discarded by NON_SALARY_UNIT_RE before span discovery — a percentage is not
 * itself a salary unit — so without this resolver the target stays null and
 * discovery stalls. When a current-CTC base is known (disclosed this turn or
 * carried in from prior state via ctx.currentCtc), resolve
 *   target = round(base × (1 + pct/100)).
 * Single, conservative entry point; gated on an explicit hike/above-CTC intent
 * so a component percentage ("20% variable", "10% joining bonus") never
 * false-binds a target.
 *
 * Two surface forms are recognised:
 *   A. percent THEN a hike/above word — "20% above|over|more|hike|raise|…"
 *   B. a hike word THEN percent      — "a hike|raise|increment|jump of 20%"
 * A component noun (variable/bonus/esop/stock/joining/…) abutting the match
 * suppresses resolution — that percentage is scoped to a component, not CTC. */
const PERCENT_HIKE_LEADING_RE =
  /(?:^|[^.\d])(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)\s*(?:hike|raise|increment|increase|jump|bump|more|above|over|higher|on\s+top)\b/i;
const PERCENT_HIKE_TRAILING_RE =
  /\b(?:hike|raise|increment|increase|jump|bump|higher)\s+(?:of\s+)?(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)(?![a-z0-9])/i;
const PERCENT_COMPONENT_GUARD_RE =
  /\b(?:variable|bonus|esop|stock|equity|joining|jb|pf|hra|gratuity|retention|sign[-\s]?on|relocation|joining\s+bonus)\b/i;

function resolvePercentHikeTarget(text: string, base: number | null): number | null {
  if (base == null || !(base > 0)) return null;
  const m = PERCENT_HIKE_LEADING_RE.exec(text) ?? PERCENT_HIKE_TRAILING_RE.exec(text);
  if (!m) return null;
  const pct = parseFloat(m[1]);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 200) return null;
  /* Component guard: reject if a non-CTC component noun sits right after the
   * matched phrase ("10% bump on the joining bonus" → scoped to the JB). */
  const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
  if (PERCENT_COMPONENT_GUARD_RE.test(tail)) return null;
  const resolved = base * (1 + pct / 100);
  if (!(resolved >= 1) || resolved > 5000) return null;
  return Math.round(resolved * 100) / 100;
}

export function classifyNumberRoles(
  textIn: string,
  ctx: NumberRoleContext = {},
): NumberRoleResult {
  if (!textIn || !textIn.trim()) {
    return { currentCtc: null, target: null, competing: null, targetAsRange: false, targetComponent: null };
  }
  /* STT fragility (2026-05-22): mirror `parseSalaryFacts` and normalize
   * English number-words to digits BEFORE span discovery / cue scoring.
   * Without this, "my current CTC is thirty six LPA" silently returns
   * { currentCtc: null }, the kernel sees no disclosure, and the engine
   * falls through — exact same shape as the LPE bug f5289f3 fixed. */
  /* OA-B55: strip URL-shaped tokens first so port/path/query digits
   * ("…example.com:8080/jobs/45") never reach span discovery and false-bind
   * as a salary figure. Shared single source with parseSalaryFacts. */
  const text = substituteVagueSalaryDecades(substituteThousandScale(substituteEnglishNumbers(substituteAbsoluteRupees(substituteForeignCurrency(stripUrls(textIn))))));
  const spans = findSalarySpans(text, ctx);
  if (spans.length === 0) {
    /* OA-B3: the percent span is discarded before span discovery, so a pure
     * "20% above my CTC" utterance yields no salary span. Resolve the hike
     * against the carried-in current-CTC base before bailing. */
    const pctTarget = resolvePercentHikeTarget(text, ctx.currentCtc ?? null);
    return {
      currentCtc: null,
      target: pctTarget,
      competing: null,
      targetAsRange: false,
      targetComponent: pctTarget != null ? "total" : null,
    };
  }
  let currentCtc: number | null = null;
  let target: number | null = null;
  let competing: number | null = null;
  let currentFromRange = false;
  let targetFromRange = false;
  let targetComponent: "total" | "fixed" | null = null;
  /* Compound current-disclosure scope (live-staging, 2026-06-19). A
   * candidate who states components AND the total in one breath —
   * "32 fixed plus 6 variable, so 38 total" — must have currentCtc bound to
   * the TOTAL (38), not the first component (32). The classifier processes
   * spans left-to-right (first-current-wins), so the leading "32 fixed"
   * grabbed the slot and the explicit "38 total" was dropped — the bot then
   * under-counted the candidate's current pay by the variable. We track the
   * component scope of whatever currently holds the slot; an explicit
   * total-scoped current span OVERRIDES a component-scoped one. */
  let currentScope: "component" | "total" | null = null;
  for (const span of spans) {
    // Negation short-circuit: "Not 30 LPA, that's too high" must not
    // bind 30 to any role. See NEGATION_LEFT_PATTERNS / INVERTERS for
    // the precise contract.
    if (isNegatedSpan(text, span)) continue;
    /* Component-bonus guard (#94): a JB / sign-on / relocation amount
     * binds to NO role regardless of any cue leaking into its window. */
    if (isComponentBonusScopedSpan(text, span)) continue;
    /* OA-B63: a WFH/setup/wellness/L&D/etc. allowance or stipend amount binds
     * to NO role regardless of any cue leaking into its window — it's a perk
     * ask, not the candidate's CTC. */
    if (isPerkComponentScopedSpan(text, span)) continue;
    /* S4-B15 / S5-B20: a number immediately tagged as a variable-pay /
     * performance-bonus component — "₹6L variable", "6 lakh variable pay",
     * "variable pay of ₹6L" — is a CTC sub-component, not the candidate's
     * total target ask. Suppress it here so it binds to NO role; the kernel
     * reads the total from extractComponentBreakdown instead. */
    if (isVariableComponentScopedSpan(text, span)) continue;
    const { scores: rawScores, genericAdverbOnlyForCurrent, genericAdverbFired, targetScoreLeft, currentScoreStrictLeft } = scoreRolesForSpan(text, span);
    /* S4-B16: "currently I am looking for 40 LPA" — `currently` is the weak
     * temporal adverb (CURRENT_CUES.left[0]). When it is the ONLY current cue
     * and a target verb appears in the LEFT window (same clause), the
     * current>target tiebreak is wrong — zero out current so target wins.
     * Guard on targetScoreLeft (not total targetScore): TARGET_CUES.right can
     * bleed from a later clause into this number's right window. */
    let scores: Record<NumberRole, number> =
      genericAdverbOnlyForCurrent && targetScoreLeft > 0
        ? { ...rawScores, current: 0 }
        : rawScores;
    /* S48-B1 follow-up (2026-07-24): right-context-only current cue should
     * yield to a left-context target verb. The new "N LPA currently" right-cue
     * fires on "I want 35 LPA currently" — but "want" in the LEFT window is
     * an unambiguous target verb that must win. If no left-side current cue
     * fired (currentScoreStrictLeft === 0, genericAdverbFired === false, so
     * all current score came from the right window) and a target verb does
     * appear in the left window, zero out current so target wins. This is the
     * right-window analogue of the S4-B16 genericAdverb guard. */
    if (
      currentScoreStrictLeft === 0 && !genericAdverbFired &&
      scores.current > 0 && targetScoreLeft > 0
    ) {
      scores = { ...scores, current: 0 };
    }
    /* Equity-scope guard (L1 / PRI-50): an equity/RSU/ESOP/stock-framed
     * number with NO explicit current/target/competing cue is an equity
     * component, not a CTC — don't let it fall through pickRole's
     * bot-asked-current default and clobber the real currentCtc. */
    const cueMax = Math.max(scores.current, scores.target, scores.competing);
    if (cueMax === 0 && isEquityScopedSpan(text, span) && !isCashComponentScopedSpan(text, span)) continue;
    /* Walk-away-floor guard: an explicit floor ("my floor is 28", "can't go
     * below 28") with no role cue binds to NO role — it's captured as
     * candidateFloor by the kernel, distinct from current AND target. */
    if (cueMax === 0 && isFloorScopedSpan(text, span)) continue;
    /* §9d/PRI-69b: a number trailed by an increase marker ("2L more") is a
     * RELATIVE delta, not an absolute target/counter — bind to no role so it
     * can't false-accept via the auto-accept-counter gate. */
    if (isRelativeIncreaseSpan(text, span)) continue;
    /* §11b: "beat my current by 5" / "5 over my current" is a delta on a
     * reference, not a restatement of it — bind to no role so it can't clobber
     * currentCtc and false-fire the memory contradiction-callout. */
    if (isBeatByReferenceSpan(text, span)) continue;
    /* Equity keyword directly preceding the number overrides even a scored
     * current cue ("I get stock worth 5 LPA"). */
    if (isEquityLeftAdjacentSpan(text, span)) continue;
    const role = pickRole(scores, ctx, span, text);
    /* OA-B21: a bare left-total span ("...base is 20L, total is 80L") carries
     * no role cue of its own, so pickRole scores it null. But when an explicit
     * COMPONENT current is already bound, that trailing total IS the candidate's
     * full package and must supersede the component — the scoped branch below
     * only runs for role==="current". Promote it here, tightly gated: a
     * component current must already hold the slot, the span must be an explicit
     * left-total, and no target/competing cue may sit anywhere in the utterance
     * (so "my ask total is 45" or a BATNA total is never mis-grabbed). */
    if (
      role == null &&
      currentCtc != null &&
      currentScope === "component" &&
      hasLeftTotalCue(text, span) &&
      !TARGET_CUES.left.some((r) => r.test(text)) &&
      !COMPETING_CUES.left.some((r) => r.test(text))
    ) {
      currentCtc = span.value;
      currentFromRange = span.isRangeUpper;
      currentScope = "total";
      continue;
    }
    if (role == null) continue;
    if (role === "current") {
      const scope = detectCurrentComponentScope(text, span);
      if (currentCtc == null) {
        currentCtc = span.value;
        currentFromRange = span.isRangeUpper;
        currentScope = scope;
      } else if (currentScope === "component" && scope === "total") {
        /* Explicit total supersedes an earlier component grab. */
        currentCtc = span.value;
        currentFromRange = span.isRangeUpper;
        currentScope = scope;
      }
    } else if (role === "target" && target == null) {
      target = span.value;
      targetFromRange = span.isRangeUpper;
      targetComponent = detectTargetComponentScope(text, span);
    } else if (role === "competing") {
      /* OA-B28/B64: bind the BEST (max) in-utterance competing figure, not the
       * first-stated one. The candidate's leverage is their strongest credible
       * BATNA, so "Zomato 38 and Swiggy 40" and its reverse must both bind 40.
       * First-wins made the counter-match floor order-dependent — the recruiter
       * would meet ₹38L or ₹40L for the *same* two offers purely on word order. */
      competing = competing == null ? span.value : Math.max(competing, span.value);
    }
  }
  /* Disambiguation: a single number shouldn't be both current and
   * target. If they collide, drop target (current's cue specificity
   * is higher; the bare-number-after-probe-expectations default is
   * the more likely false positive). */
  if (target != null && (target === currentCtc || target === competing)) {
    target = null;
    targetFromRange = false;
    targetComponent = null;
  }
  /* OA-B3: no absolute target bound from a span, but the candidate may have
   * expressed it as a percentage hike ("I make 20L, want 30% more"). Resolve
   * against this turn's disclosed current, else the carried-in base. */
  if (target == null) {
    const pctTarget = resolvePercentHikeTarget(text, currentCtc ?? ctx.currentCtc ?? null);
    if (pctTarget != null && pctTarget !== currentCtc && pctTarget !== competing) {
      target = pctTarget;
      targetComponent = "total";
    }
  }
  const targetAsRange = targetFromRange || (target != null && currentFromRange === false && spans.some((s) => s.isRangeUpper));
  return {
    currentCtc,
    target,
    competing,
    targetAsRange: target != null ? targetAsRange : false,
    targetComponent: target != null ? (targetComponent ?? "total") : null,
  };
}

/* ─── Component-scope detection for a current-CTC span ─────────────────
 *
 * A current-classified number can be a COMPONENT ("32 fixed", "6 variable")
 * or the TOTAL ("38 total", "38 overall"). When a candidate states both in
 * one utterance, currentCtc must bind to the total, not the leading
 * component. We read the word IMMEDIATELY trailing the number span (a tight
 * 14-char right window — the unit/scope word abuts the figure in spoken
 * Indian-HR register). Left-context is deliberately ignored here: "current
 * is 32 fixed" has "current" on the LEFT but "fixed" on the RIGHT — the
 * right-adjacent scope word is what tags THIS number. */
/* OA-B21: a "total"/"overall" scope cue can sit on EITHER side of the figure
 * in spoken Indian-HR register — "80 total" (right-adjacent, read inline) OR
 * "total is 80" (left-adjacent). This detects the left-adjacent case within
 * the CURRENT clause only (bounded at the previous comma/semicolon) so a total
 * cue from an earlier clause can't leak across, and requires tight adjacency —
 * the cue word, an optional linking verb, then the number. Single source of
 * truth for both role-scoring (pickRole) and scope-tagging
 * (detectCurrentComponentScope). */
const LEFT_TOTAL_ADJACENT_RE = /\b(?:total|overall)\s*(?:is|of|at|was|comes?\s+to)?\s*$/i;
const LEFT_COMPONENT_ADJACENT_RE = /\b(?:fixed|base|basic|variable|bonus)\s*(?:is|of|at|was|comes?\s+to|:)?\s*$/i;
/* Read the CURRENT clause to the left of the span (bounded at the previous
 * comma/semicolon so a cue from an earlier clause can't leak across) and test
 * whether it ends in the given adjacency cue. */
function leftClauseEndsWith(text: string, span: SalarySpan, re: RegExp): boolean {
  const clauseStart = Math.max(
    text.lastIndexOf(",", span.start - 1),
    text.lastIndexOf(";", span.start - 1),
  ) + 1;
  return re.test(text.slice(clauseStart, span.start));
}
function hasLeftTotalCue(text: string, span: SalarySpan): boolean {
  return leftClauseEndsWith(text, span, LEFT_TOTAL_ADJACENT_RE);
}

function detectCurrentComponentScope(
  text: string,
  span: SalarySpan,
): "component" | "total" | null {
  const right = text.slice(span.end, Math.min(text.length, span.end + 14));
  if (/^\s*(?:fixed|base|basic|variable|bonus)\b/i.test(right)) return "component";
  if (/^\s*(?:total|overall)\b/i.test(right)) return "total";
  /* OA-B21: the scope word can also LEAD the figure ("base is 20L", "total is
   * 80L") — read the left clause symmetrically. Component first, mirroring the
   * right-window order above. */
  if (leftClauseEndsWith(text, span, LEFT_COMPONENT_ADJACENT_RE)) return "component";
  if (hasLeftTotalCue(text, span)) return "total";
  return null;
}

/* ─── Component-scope detection for the bound target ───────────────── */

/** Cue patterns that mark a target number as referring to the FIXED /
 *  BASE component specifically (not the total package). Conservative:
 *  must appear adjacent to the number span (within 20 chars on either
 *  side) and must not be negated by a "total"/"overall" / "ctc"
 *  qualifier in the same window. */
const FIXED_COMPONENT_CUES = [
  /\bfixed(?:\s+(?:component|pay|salary))?\b/i,
  /\bbase(?:\s+(?:pay|salary))?\b/i,
  /\bbasic\b/i,
];
const TOTAL_COMPONENT_CUES = [
  /\btotal\b/i,
  /\boverall\b/i,
  /\bctc\b/i,
  /\bpackage\b/i,
  /\bgross\b/i,
];

function detectTargetComponentScope(text: string, span: SalarySpan): "total" | "fixed" | null {
  /* Window widened 20→45 on the left (live-staging, 2026-06-17). A
   * fixed/base cue can sit a full clause before the number — "I was
   * hoping the base could be around 28" puts "base" ~19 chars out, and
   * "can we get the fixed component closer to 28" puts "fixed" ~30 out;
   * the old 20-char window missed both and mis-scoped the counter as
   * total. We clip the left window back to the current clause (after the
   * last sentence/comma boundary) so a PRIOR clause's "total"/"base"
   * can't leak across — keeps the both-hit→total contract intact for
   * single-clause "₹32 LPA total with base at ₹26". */
  const LEFT_COMPONENT_WINDOW = 45;
  const RIGHT_COMPONENT_WINDOW = 20;
  let leftWindow = text.slice(Math.max(0, span.start - LEFT_COMPONENT_WINDOW), span.start);
  const clauseCut = Math.max(
    leftWindow.lastIndexOf("."),
    leftWindow.lastIndexOf(";"),
    leftWindow.lastIndexOf(","),
  );
  if (clauseCut >= 0) leftWindow = leftWindow.slice(clauseCut + 1);
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + RIGHT_COMPONENT_WINDOW));
  const window = `${leftWindow} ${rightWindow}`;
  const fixedHit = FIXED_COMPONENT_CUES.some((re) => re.test(window));
  const totalHit = TOTAL_COMPONENT_CUES.some((re) => re.test(window));
  /* Both hit ("₹32 LPA total with base at ₹26") → total wins. The
   * candidate's anchor is the total; the base mention is a constraint
   * but the bound target value here is the total. */
  if (totalHit) return "total";
  if (fixedHit) return "fixed";
  return null;
}
