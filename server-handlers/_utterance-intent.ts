/* Utterance intent — deterministic structured extraction of the ONE
 * signal that gates a false-close: does the candidate's reply carry an
 * UNMET compensation demand?
 *
 * WHY THIS EXISTS (single source of truth). The acceptance classifier
 * historically vetoed "demand welded to a close idiom" with eight
 * separate regexes — CONDITIONAL_DEMAND, COUNTER_THEN_CLOSE,
 * GRANT_THEN_CLOSE, NONCOMP_DEMAND_THEN_CLOSE, DEMAND_FOR_MORE,
 * RELATIVE_DEMAND_THEN_CLOSE, WORD_DEMAND_THEN_CLOSE,
 * VERB_MAGNITUDE_THEN_CLOSE — every one of which bridged the demand to
 * the close idiom with a literal `\b(?:and|then|&)\b`. That bridge was
 * the leak: a comma, "plus", "with", a different demand verb, or no
 * joiner at all defeated all eight at once, so
 *   "Bump the base by 5 lakh, I'll sign today."   (comma)
 *   "Add 5 lakh to the base, plus I'll sign today." ("plus")
 *   "Give me 45 and I'm in."                        (bare number > offer)
 *   "Match my current base, I'll sign today."       (comparative)
 * all FALSE-CLOSED at the un-bumped offer — the worst failure mode
 * (closing a deal the candidate is conditioning on more money).
 *
 * The structural cure is to stop deciding acceptance by pattern
 * SUBTRACTION over a flat string (accept-idioms minus N vetoes, which
 * is unwinnable — every new phrasing is a new hole) and instead detect
 * the demand as a STRUCTURED element, independent of the conjunction
 * that joins it to any commit idiom. This mirrors the standard
 * task-oriented-dialogue NLU pattern (intent + slot filling): parse the
 * demand slot once, then let the classifier compose it with its commit
 * detector under an explicit-confirmation policy (an unmet demand can
 * only ever BLOCK a close, never create one).
 *
 * SAFE-DEFAULT / recall bias. The detector is deliberately biased
 * toward DETECTING a demand: the composed decision defaults to
 * no-close on anything it flags, so the two failure modes are
 * asymmetric — a false positive here (over-detect a demand) merely
 * costs one extra turn ("so, is that a yes?"), while a false negative
 * (miss a demand) reintroduces the unrecoverable false-close. Erring
 * toward "demand present" is the safe direction.
 *
 * This module is PURE (no idiom knowledge, no import cycle with the
 * classifier). The classifier owns commit/close-idiom detection and
 * composes the two.
 */

/** A single demand "core" — the pre-bridge portion of the old vetoes,
 *  now matched conjunction-independently anywhere in the utterance. */
interface DemandCore {
  re: RegExp;
  /** Rule id for telemetry / debugging. */
  reason: string;
  /** When set, the pattern captures an ABSOLUTE target figure in this
   *  group; the demand is unmet only when that figure exceeds the
   *  standing offer (a "make it 40" when the offer is already 40 is a
   *  no-op restatement, not an unmet raise). Cores without this are
   *  inherently upward asks (relative "more", sweetener grants, title
   *  upgrades, comparatives) and are always unmet. */
  absoluteTargetGroup?: number;
  /** Capture group holding the UNIT that scales absoluteTargetGroup to
   *  lakhs (cr/crore ×100, m/mn/million ×10, else ×1). Lets "push it to
   *  4.5M" (= ₹45L) be compared against a lakh-denominated offer instead
   *  of read as a bare 4.5. */
  unitGroup?: number;
  /** When true, the core only counts as a demand when the standing
   *  offer is KNOWN and the captured figure exceeds it. Used for the
   *  bare "give me N" / "I want N" absolute form, which is a demand
   *  only if N is provably above the offer (otherwise it may be a
   *  concession restatement — "give me 40" at a ₹40L offer). */
  requiresOfferToExceed?: boolean;
  /** Derives the ABSOLUTE target (in lakhs) from the match when the figure
   *  is not a literal digit group — e.g. a decade-band phrase ("mid-forties"
   *  → 45). Gated exactly like absoluteTargetGroup: unmet only when the
   *  derived figure beats the offer, and still counts when the offer is
   *  unknown so the strict gate blocks a welded accept. Mutually exclusive
   *  with absoluteTargetGroup. */
  computeFigure?: (m: RegExpExecArray) => number;
}

/* Increase magnitude fragment shared by the relative/word forms:
 * a digit or a verbal quantifier (a / an / one / half a / a couple / a
 * few / several), followed by a cash-or-percent unit. */
const UNIT = "(?:%|percent|per\\s?cent|lpa|lakhs?|lac|l|k)";
const VERBAL_QTY = "(?:a|an|one|half\\s+a|(?:a\\s+)?couple(?:\\s+of)?|(?:a\\s+)?few|several)";
const INCREASE_TOKEN = "(?:more|higher|extra|additional|on\\s+top)";
/* Gratitude guard — "3% more THAN I expected" is thanks, not a demand. */
const NOT_THAN = "(?!\\s+than)";
/* Non-cash sweetener nouns — shared by the imperative grant core and the
 * non-imperative sweetener-demand core below. A sweetener is inherently an
 * UPWARD ask (it can only add to the package), so detecting one is safe
 * against over-block PROVIDED it sits in a demand frame, not a satisfaction
 * frame ("happy with THE bonus" is an accept, "I need a bonus" is a demand). */
const SWEETENER =
  "(?:joining\\s+bonus|signing\\s+bonus|sign[-\\s]?on\\s+bonus|retention\\s+bonus|bonus(?:es)?|joining|relocation|reloc\\b|notice\\s+(?:buyout|pay|period(?:\\s+buyout)?)|buyout|esops?|rsus?|equity|stock(?:\\s+options?)?|shares?|variable|allowances?|hra\\b|perks?|benefits?|wfh|remote|sabbatical)";

/* Core cash-comp levers — the components a candidate can ask to be raised by
 * name ("the base", "fixed", "the cash", "CTC", "package", "salary"). Distinct
 * from SWEETENER (add-on perks): these are the primary numbers, so a demand to
 * "sweeten the base" / "fix the CTC" is inherently an UPWARD ask on the standing
 * offer. Shared with the improve-lever core below. */
const CORE_COMP =
  "(?:base(?:\\s+pay)?|fixed(?:\\s+pay|\\s+comp(?:onent)?)?|cash(?:\\s+comp(?:onent)?)?|ctc|package|salary|comp(?:ensation)?)";

/* Named NON-COMP perks a candidate can demand as a close condition ("give me a
 * corner office and I'll sign", "throw in a parking spot and we have a deal").
 * SWEETENER already covers generic "perks"/"benefits", but a SPECIFIC perk named
 * inline slipped it, so the perk-conditioned close false-closed at the un-bumped
 * offer (batch-15 hostile leak, 2026-07-11). Lexically pinned to concrete perk
 * nouns (not bare "cover"/"membership", which are ambiguous), and only ever read
 * as a demand behind a grant verb in the grant-perk core below — so ordinary prose
 * mentioning an office never trips it. A perk demand is inherently a fresh ask on
 * top of the standing package, so no offer gate. */
const NONCOMP_PERK =
  "(?:corner\\s+office|office|cabin|parking(?:\\s+(?:spot|space|slot))?|company\\s+car|car\\s+lease|chauffeur|driver|gym\\s+membership|club\\s+membership|(?:health|medical|life)\\s+(?:insurance|cover(?:age)?)|macbook|laptop|workstation|relocation\\s+(?:package|assistance))";

/* Non-comp TITLE / seniority nouns a candidate can demand as a close condition
 * ("give me the senior title and I'll sign", "get me to staff level"). Distinct
 * from title-upgrade (welded to "make it a …") — a grant/move verb governing one
 * of these nouns is still an unmet demand, not an accept (batch-17 hostile leak,
 * 2026-07-11). Only ever read behind a grant/promote verb in the title-grant core
 * below, so ordinary prose naming a "role" or "level" never trips it. */
const NONCOMP_TITLE =
  "(?:title|role|level|band|grade|designation|position|seniority|promotion)";
/* Seniority RANK names — the target of a "get me to <rank>" / "give me the <rank>
 * title" upgrade demand. Read only inside title-grant (behind a grant/move verb),
 * so ordinary prose naming a level never trips them. */
const RANK =
  "(?:principal|staff|senior|sr\\b|lead|director|manager|architect|vp\\b|head|distinguished|fellow)";

/* Coercive contractual CLAUSES a candidate can demand the employer REMOVE as a
 * close condition ("waive the bond and I'll sign", "drop the lock-in and I'm
 * in"). Removing an unfavourable term is a concession extracted from the
 * employer — inherently an unmet demand, distinct from a comp raise or a
 * sweetener add-on. Common in Indian tech (service bonds, notice-period
 * buyouts, non-competes), so a close welded to a waiver false-closes at terms
 * the candidate is explicitly rejecting. Read only behind a REMOVAL verb in the
 * waive-clause core below, so ordinary prose naming a "bond" or "notice period"
 * never trips it. */
const CLAUSE =
  "(?:bond|lock[-\\s]?in|service\\s+(?:bond|agreement|commitment|contract)|notice\\s+period|non[-\\s]?compete|claw[-\\s]?back|tie[-\\s]?in|retention\\s+clause)";

/* Decade-band figures for the vague "mid-forties" demand form (see the
 * decade-band core below). Kept lakh-denominated to match figureToLakhs output;
 * the qualifier nudges within the decade. */
const DECADE_WORDS: Record<string, number> = {
  thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80,
};
const BAND_QUALIFIER: Record<string, number> = {
  low: 2, early: 2, mid: 5, middle: 5, high: 8, late: 8,
};

/* Fractional-crore figures for the word-form "half a crore" demand (see the
 * crore-fraction core below). A crore is 100 lakh, so the fraction maps
 * straight to a lakh figure. */
const CRORE_FRACTION: Record<string, number> = {
  quarter: 25, half: 50, "three-quarter": 75, "three-quarters": 75,
};

/* Word multipliers for the "double my current 38" demand form (see the
 * multiplier-current core below). "Nx" forms carry the multiplier as a literal
 * digit and are handled inline. */
const MULTIPLIER_WORDS: Record<string, number> = {
  double: 2, twice: 2, triple: 3, treble: 3, quadruple: 4,
};

const DEMAND_CORES: DemandCore[] = [
  /* Absolute raise TARGET: "make it 50", "get the base to 55", "bump
   * fixed to 58", "push cash to 60". Unmet only when the target beats
   * the standing offer. Ported from CONDITIONAL_DEMAND_PATTERN, bridge
   * dropped. */
  {
    reason: "raise-to-target",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    /* Tolerates a rounding filler between the verb and the figure, in BOTH the
     * "make it <N>" and the "<verb> … to <N>" branches ("make it a round 45",
     * "get it to a flat 48", "make it an even 50") — the filler defeated the bare
     * "<verb> <digit>" form and these false-closed at the un-bumped offer
     * (batch-16 hostile leak, 2026-07-11). Filler sits at the shared pre-figure
     * position so a single fragment covers every verb branch. */
    re: /\b(?:make\s+it|(?:get|bump|push|raise|take|bring|come\s+up|move|nudge)\s+(?:(?:it|the\s+fixed|the\s+base|the\s+cash|fixed|base|cash|total|ctc|package)\s+)?to)\s+(?:a\s+round|an?\s+even|a\s+clean|a\s+flat|a\s+nice|a\s+solid|a\s+cool)?\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Prepositionless landing verb + target: "the base needs to hit 46",
   * "reach 50", "sit at 48", "land on 55". raise-to-target requires an
   * explicit "to" ("get it TO 46"), so a landing verb that drops the
   * preposition slipped through — "The base needs to hit 46. Otherwise,
   * yeah, I'm in." false-closed at the un-bumped offer (batch-4 hostile
   * leak, 2026-07-09). Absolute target: unmet only when it beats the
   * offer; like raise-to-target it still counts when the offer is unknown
   * (strict gate), which is what blocks the welded accept. Verb set is
   * comp-oriented so "reach out to HR" / "hit it off" (no adjacent figure)
   * do not match. */
  {
    reason: "raise-hit-target",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(?:hits?|reach(?:es)?|touch(?:es)?|lands?\s+(?:at|on)|sits?\s+at)\s+(?:the\s+(?:base|fixed|cash|number|figure|total|ctc|package)\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Floor expression + figure: "at least 45", "no less than 45", "north of
   * 45", "upwards of 45", "in excess of 45", "a minimum of 45", "starting at
   * 45", "no lower than 45". A stated floor is a demand that the package meet
   * or exceed that figure — "I'm in for something north of 45" false-closed at
   * the ₹40 offer because no core saw the floor (batch-5 hostile leak,
   * 2026-07-09). Absolute target: unmet only when the floor beats the offer;
   * still counts when the offer is unknown (strict gate) so the welded accept
   * is blocked. Floor phrases are lexically specific ("north of 45", not "north
   * of the city" — that has no adjacent figure), so non-comp uses do not match.
   * Includes the "nothing/not under|below" negative-floor idiom ("I'm in, but
   * nothing under 46") — a floor stated as a prohibition, which close-recap'd at
   * the un-bumped offer because the leading-phrase list omitted it (batch-7
   * hostile leak, 2026-07-09). Also the bare-preposition floors "over 45",
   * "above 44" and the floor-VERBS "tops 46", "clears 48", "crosses 45",
   * "breaks 46", "surpasses 45" — each pins a figure the package must exceed
   * and each false-closed at the ₹40 offer because the alternation omitted them
   * (batch-8 hostile leak, 2026-07-09). "more than 45" / "a bit more than 45"
   * are the same floor idiom (batch-11 leak, 2026-07-09), added with a negative
   * lookbehind so the CEILING forms "no more than 45" / "not more than 45" are
   * NOT read as floors. Offer-gated, so a below-offer number ("over 15 years",
   * "clears 30") is met, not a demand. */
  {
    reason: "floor-target",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(?:at\s+least|no\s+less\s+than|no\s+lower\s+than|not\s+below|not\s+under|nothing\s+(?:under|below|less\s+than|lower\s+than)|north\s+of|upwards?\s+of|in\s+excess\s+of|(?:a\s+)?minimum\s+of|starting\s+at|over|above|tops?|clears?|crosses?|breaks?|surpasses?|(?<!\bno\s)(?<!\bnot\s)more\s+than)\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Vague decade-band demand: "in the mid-forties", "low fifties", "high
   * forties". No literal digit at all, so every digit-anchored core (and the
   * planner's figure resolvers) missed it and the conditional accept
   * false-closed at the un-bumped offer, silently dropping the band ("I'll take
   * it if it lands in the mid-forties" → closed at ₹40 — batch-7 hostile leak,
   * 2026-07-09). computeFigure derives a representative target from the band:
   * low/early ≈ +2, mid/middle ≈ +5, high/late ≈ +8 over the decade. Offer-
   * gated absolute — a band at/below the offer is met, above (or offer-unknown)
   * is unmet so both gates block. The qualifier+decade adjacency is lexically
   * specific, so it does not fire on ordinary prose. */
  {
    reason: "decade-band",
    computeFigure: (m) => DECADE_WORDS[m[2].toLowerCase()] + BAND_QUALIFIER[m[1].toLowerCase()],
    re: /\b(low|mid|middle|high|early|late)[-\s]+(thirties|forties|fifties|sixties|seventies|eighties)\b/i,
  },
  /* Bare decade-plural band: "somewhere in the 50s", "the fifties" — a decade
   * named with NO qualifier and no single figure, so the decade-band core (which
   * requires low/mid/high) missed it and "I'll sign if it's somewhere in the
   * 50s" false-closed at the ₹40 offer (batch-11 leak, 2026-07-09). computeFigure
   * derives the decade FLOOR (digit form "50s" → 50; word form via DECADE_WORDS).
   * Offer-gated absolute — "in the 40s" against a ₹40 offer is met (40 ≤ 40) and
   * NOT flagged, so a genuine accept describing the standing offer still closes. */
  {
    reason: "decade-plural",
    computeFigure: (m) => (m[1] ? parseInt(m[1], 10) : DECADE_WORDS[m[2].toLowerCase()]),
    re: /\bthe\s+(?:(\d0)s|(thirties|forties|fifties|sixties|seventies|eighties))\b/i,
  },
  /* Approximation suffix: "45-ish", "45ish", "45 ish". A figure softened with
   * "-ish" carries the target as an ordinary absolute, but the trailing suffix
   * defeated the exact-figure resolvers and "45-ish and I'm in" false-closed at
   * the ₹40 offer (batch-11 leak, 2026-07-09). Absolute target, offer-gated — a
   * below-offer "-ish" figure ("38-ish") is met, above (or offer-unknown) is
   * unmet so both gates block. */
  {
    reason: "ish-approx",
    absoluteTargetGroup: 1,
    re: /\b(\d+(?:\.\d+)?)\s*[-\s]?ish\b/i,
  },
  /* Trailing "plus" floor: "45 plus", "forty-five plus" (normalized to "45
   * plus") — a figure suffixed with "plus" is a floor at that figure, but no
   * leading floor phrase was present so floor-target missed it and "Forty-five
   * plus and I'm in" false-closed at the ₹40 offer (batch-12 leak, 2026-07-09).
   * Absolute target, offer-gated — "40 plus the joining bonus" against a ₹40
   * offer is met (40 ≤ 40) so a genuine accept adding a deliverable still closes.
   * The negative lookahead keeps non-comp "plus" ("45 plus years", "10 plus
   * percent") out. */
  {
    reason: "plus-floor",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\s+plus\b(?!\s*(?:years?|yrs?|months?|mos?|percent|%|pct))/i,
  },
  /* "N and change" floor: "45 and change" = a little above 45. The trailing
   * "and change" defeated the exact-figure resolvers and "45 and change works
   * for me" false-closed at the ₹40 offer (batch-12 leak, 2026-07-09). Absolute
   * target (the floor), offer-gated. */
  {
    reason: "and-change-floor",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?)?\s+and\s+(?:some\s+)?change\b/i,
  },
  /* "N minimum / N min" floor: "45 minimum", "45 min" — a figure tagged as the
   * candidate's minimum is a hard floor, but "minimum" trailing a clean number
   * defeated the exact-figure resolvers so "45 minimum and I'll sign" false-closed
   * at the ₹40 offer (batch-13 leak, 2026-07-10). Absolute target, offer-gated
   * (so "40 minimum" against a ₹40 offer is met). The optional unit sits between
   * the figure and "min", and a negative lookahead keeps the abbreviation off
   * time phrases ("45 minutes", "45 mins to decide"). */
  {
    reason: "minimum-floor",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\s+min(?:imum)?\b(?!(?:ute|s?\s+(?:to|left|remaining)))/i,
  },
  /* Ultimatum floor: "45 or I walk", "45 or nothing", "45 or I'm out" — a figure
   * pinned by a walk-away alternative is a hard floor, but the number reads as a
   * clean accept target so "I'm in at 45 or I walk" false-closed at the ₹40 offer
   * (batch-12 leak, 2026-07-09). Absolute target, offer-gated. The walk-away
   * tail ("or I walk/out/nothing/no deal") is lexically specific. */
  {
    reason: "ultimatum-floor",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\s+or\s+(?:i(?:'?m)?\s+(?:walk|out|gone|leaving|done)|nothing|no\s+deal|i\s+walk\b|forget\s+it)/i,
  },
  /* Positional-ceiling demand: "top of the band", "max of the range", "upper end
   * of the band". A demand for the ceiling of the recruiter's band carries NO
   * figure, so every figure-anchored core (and the exact-figure resolvers) missed
   * it and "Top of the band and I'll sign" false-closed at the offer (batch-11/12
   * leak, 2026-07-09). A bare lexical demand (no figure) — always unmet, like the
   * other numberless demands — so both gates block and the planner counters. The
   * "of the band/range/scale/grade/bracket" tail is lexically specific, so
   * ordinary prose ("top of my list") does not trip it. */
  {
    reason: "positional-ceiling",
    re: /\b(?:top|max(?:imum)?|upper\s+end|high(?:er)?\s+end|ceiling)\s+of\s+(?:the\s+|your\s+|my\s+)?(?:band|range|scale|grade|bracket)\b/i,
  },
  /* Word-form fractional crore: "half a crore" (=50L), "quarter crore" (=25L),
   * "three quarters of a crore" (=75L). A crore-scale target written as a word
   * fraction carries no lakh digit, so every digit-anchored core missed it and
   * "I'm in if the package is half a crore" false-closed at the ₹40 offer
   * (batch-8 hostile leak, 2026-07-09). computeFigure maps the fraction to lakhs
   * (crore = 100 lakh). Offer-gated absolute — a fraction at/below the offer is
   * met, above (or offer-unknown) is unmet so both gates block. The
   * fraction-word + "crore" adjacency is lexically specific. */
  {
    reason: "crore-fraction",
    computeFigure: (m) => CRORE_FRACTION[m[1].toLowerCase().replace(/\s+/g, "-")],
    re: /\b(quarter|half|three[-\s]quarters?)\s+(?:of\s+)?(?:a\s+)?crores?\b/i,
  },
  /* Multiplier of the candidate's CURRENT figure: "double my current 38",
   * "twice my current 38", "1.5x my current 38". The target is derived
   * (multiplier × current), so no literal target digit is present and every
   * target-anchored core missed it — "I'll sign if you double my current 38"
   * false-closed at the ₹40 offer (batch-9 hostile leak, 2026-07-09).
   * computeFigure multiplies the current figure by the word (double=2, triple=3,
   * quadruple=4) or the "Nx" literal. Offer-gated absolute — a product at/below
   * the offer is met, above (or offer-unknown) is unmet so both gates block. The
   * "current|present|existing" anchor keeps ordinary "double the effort" out. */
  {
    reason: "multiplier-current",
    computeFigure: (m) =>
      (m[1] ? MULTIPLIER_WORDS[m[1].toLowerCase()] : parseFloat(m[2])) *
      figureToLakhs(m[3], m[4]),
    re: /\b(?:(double|twice|triple|treble|quadruple)|(\d+(?:\.\d+)?)\s*x)\s+(?:my\s+|the\s+)?(?:current|present|existing)\s+(?:ctc|salary|base|pay|package|comp\w*)?\s*(?:of\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Figureless MULTIPLIER on a named comp lever: "double the stock", "triple the
   * equity", "double the base", "2x the bonus". multiplier-current needs a
   * "current/present/existing" anchor AND a figure to derive the target, so a
   * multiplier applied directly to a lever with no figure slipped it and "Double
   * the stock and I'll accept." false-closed at the un-bumped offer (batch-20
   * hostile leak, 2026-07-13). A multiplier verb (double/twice/triple/2x) is
   * inherently upward on whatever lever it governs, so it is always an unmet
   * demand — no figure or offer gate. Lexically pinned to the shared lever
   * vocabulary (CORE_COMP ∪ SWEETENER), so "double the effort/headcount" (no comp
   * lever) never matches, and the optional determiner keeps "double my base" and
   * "double the stock" both covered. */
  {
    reason: "multiplier-lever",
    re: new RegExp(
      `\\b(?:double|twice|triple|treble|quadruple|\\d+(?:\\.\\d+)?\\s*x)\\s+(?:the|my|your|their)?\\s*(?:${CORE_COMP}|${SWEETENER})\\b`,
      "i",
    ),
  },
  /* Component-specific floor: "the fixed alone is 46", "the base component must
   * be 47". A bare copula ("is"/"must be") pins a figure to a NAMED component,
   * which no landing-verb core caught ("hits/reaches/sits at" only) — so "I'm in
   * if the fixed alone is 46" false-closed at the ₹40 offer (batch-9 hostile
   * leak, 2026-07-09). Absolute target, offer-gated. The "alone"/"component"
   * qualifier is what makes the bare copula safe: it marks a raise demand on one
   * slice, not a restatement of the whole offer, so "this is 40" is not caught. */
  {
    reason: "component-floor",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(?:fixed|base|cash|salary|ctc)\s+(?:component\s+|part\s+)?(?:alone|component|itself)\s+(?:is|at|to\s+be|should\s+be|must\s+be|needs?\s+to\s+be|hits?)\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Digit-handle idiom: the candidate names only the LEADING digit of the CTC
   * they want — "get me to a 5 in front", "once it starts with a 5", "a 5
   * handle". No absolute figure is stated, so every digit-anchored core missed
   * it and "Get me to a 5 in front and I'll sign" false-closed at the ₹40 offer
   * (batch-9 hostile leak deferred as high-over-block-risk, fixed batch-10
   * 2026-07-09). computeFigure derives the decade FLOOR (digit × 10): "a 5 in
   * front" ⇒ ≥50L. Offer-gated absolute — when the standing offer already has
   * that digit in front (e.g. a ₹50 offer vs "starts with a 5" ⇒ 50 ≤ 50) it is
   * met and NOT flagged, so this never fires on an offer restatement. The
   * "in front"/"handle"/"starts with" anchors + single-digit group keep it off
   * ordinary numerals ("5 rounds", "starts with a review"). */
  {
    reason: "digit-handle",
    computeFigure: (m) => {
      const raw = (m[1] ?? m[2]).toLowerCase();
      const ones: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9,
      };
      const digit = /^\d$/.test(raw) ? parseInt(raw, 10) : ones[raw];
      return digit * 10;
    },
    re: /\b(?:starts?\s+with\s+(?:a\s+)?(\d|one|two|three|four|five|six|seven|eight|nine)|(?:a\s+)?(\d|one|two|three|four|five|six|seven|eight|nine)(?:\s+in\s+front|[-\s]?handle))\b/i,
  },
  /* First-person / imperative demand for MORE by magnitude: "give me 8%
   * more", "I want 2L more", "I'm after a couple more". Ported from
   * DEMAND_FOR_MORE_PATTERN (already bridge-free). */
  {
    reason: "demand-for-more",
    re: new RegExp(
      `\\b(?:(?:give|gimme|get|hand|throw|toss)\\s+me|i(?:'?d)?\\s+(?:want|need|expect|like)|i'?m\\s+(?:after|looking\\s+for))\\b[^.!?]{0,20}?\\d+(?:\\.\\d+)?\\s*${UNIT}?\\s*${INCREASE_TOKEN}\\b${NOT_THAN}`,
      "i",
    ),
  },
  /* Bare relative magnitude + increase token: "2 higher", "3% more".
   * Ported from RELATIVE_DEMAND_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "relative-more",
    re: new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${UNIT}?\\s*${INCREASE_TOKEN}${NOT_THAN}\\b`, "i"),
  },
  /* Word/article-quantified relative: "a lakh more", "half a lakh
   * more", "a couple of percent more". Ported from
   * WORD_DEMAND_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "word-more",
    re: new RegExp(`\\b${VERBAL_QTY}\\s+(?:l\\b|lpa|lakhs?|lac|%|percent)\\s*${INCREASE_TOKEN}${NOT_THAN}\\b`, "i"),
  },
  /* Pre-number increase word: "another 3L", "an extra 5%", "an additional
   * 3 lakh", "a further 2L", "another 3 on base". The increase intent sits
   * BEFORE the figure, unlike relative-more / demand-for-more, which need a
   * TRAILING more/higher/extra — so those cores miss "get me another 3L on
   * base first", a welded imperative demand that was false-closing after an
   * accept idiom ("I accept the offer. That said, get me another 3L …";
   * batch-3 hostile leak, 2026-07-09). Always unmet: an additive "another
   * N" only ever adds to the standing offer, so no offer gate. Requires a
   * cash/percent unit OR an explicit "on <base/fixed/cash/…>" so non-comp
   * counts ("another 3 rounds", "another 3 weeks") are not caught. */
  {
    reason: "another-more",
    re: new RegExp(
      `\\b(?:another|an?\\s+extra|an?\\s+additional|a\\s+further)\\s+(?:₹|rs\\.?\\s*|inr\\s*)?\\d+(?:\\.\\d+)?\\s*(?:%|(?:percent|per\\s?cent|lpa|lakhs?|lac|l|k)\\b|on\\s+(?:the\\s+)?(?:base|fixed|cash|ctc|salary|package|comp))`,
      "i",
    ),
  },
  /* Quantity + LEADING increase word + unit: "one more lakh", "two more lakhs",
   * "a couple more lakhs", "3 more percent". The increase token ("more/extra/
   * additional/further") sits BETWEEN the quantity and the unit — the mirror of
   * word-more ("a lakh more", unit-then-more) and relative-more (digit + unit +
   * more). A bare WORD-quantity in this order ("one MORE lakh") slipped all
   * three cores (relative-more needs a digit, word-more needs unit-before-more,
   * another-more's lead set is another/an-extra/an-additional/a-further) and
   * "One more lakh and I'm in." false-closed at the un-bumped offer (offline
   * hostile hunt, 2026-07-17). Unit-restricted to cash/percent so non-comp
   * counts ("one more round", "a few more weeks") never match; always an upward
   * ask, so no offer gate. The global dismissal-tail guard covers "I don't need
   * one more lakh, I accept". */
  {
    reason: "quantity-more-unit",
    re: new RegExp(
      `\\b(?:\\d+(?:\\.\\d+)?|${VERBAL_QTY}|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:more|extra|additional|further)\\s+(?:${UNIT})\\b`,
      "i",
    ),
  },
  /* Leading INCREASE word directly on a comp lever, no figure: "give me more
   * RSUs", "more equity", "extra stock", "additional base". another-more requires
   * a cash/percent unit after the increase word, and demand-for-more needs a
   * TRAILING more/higher, so a bare "more <lever>" (increase word LEADING a lever
   * noun) slipped both and "Give me more RSUs and we have a deal." false-closed at
   * the un-bumped offer (batch-20 hostile leak, 2026-07-13). "more/extra/
   * additional/further" on a lever is inherently upward → always unmet, no offer
   * gate. Pinned to the shared lever vocabulary (CORE_COMP ∪ SWEETENER). A
   * DEFINITE/possessive-determiner negative lookbehind keeps a sweetener referenced
   * as ALREADY on the table ("the extra equity is great, I accept") from
   * over-blocking a genuine accept — only an undetermined ask ("more equity",
   * "give me more equity") is a fresh demand. The global dismissal-tail guard
   * additionally covers "I don't need more equity, I accept". */
  {
    reason: "more-lever",
    re: new RegExp(
      `(?<!\\b(?:the|this|that|your|our|their|its|his|her)\\s)` +
        `\\b(?:more|extra|additional|further)\\s+(?:${CORE_COMP}|${SWEETENER})\\b`,
      "i",
    ),
  },
  /* Verb-fronted cash/percent bump whose increase intent lives in the
   * verb: "bump it 5%", "push the base up by a few percent". Ported
   * from VERB_MAGNITUDE_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "verb-magnitude",
    re: new RegExp(
      `\\b(?:bump|raise|increase|push|hike|lift|boost|stretch|nudge|add|jack)\\b[^.!?]{0,25}?\\b(?:\\d+(?:\\.\\d+)?|${VERBAL_QTY})\\s*(?:%|(?:percent|per\\s?cent|lpa|lakhs?|lac|l|k)\\b)`,
      "i",
    ),
  },
  /* Noun-form raise: "a 15% hike", "a 4L raise on base", "a 5% increment", "a
   * 3L bump", "a 4L increase/rise/jump/boost/uptick". The increase intent lives
   * in a raise NOUN following the figure, not a verb or trailing more/higher —
   * so verb-magnitude and relative-more both miss it, and "Give me a 15% hike
   * and I'm in." false-closed at the ₹40 offer (batch-5 hostile leak,
   * 2026-07-09). Always unmet: a raise noun only ever adds to the standing
   * offer, so no offer gate. Requires an adjacent %/cash unit so a bare "a 4
   * hike" is not caught. Excluded after a definite article ("happy with THE 15%
   * hike" is satisfaction, not a demand) to avoid over-blocking an accept. */
  {
    reason: "noun-raise",
    re: new RegExp(
      `(?<!the\\s)\\b\\d+(?:\\.\\d+)?\\s*(?:%|percent|per\\s?cent|lpa|lakhs?|lac|l|k)\\s*(?:hike|raise|bump|increment|increase|rise|jump|boost|uptick)s?\\b`,
      "i",
    ),
  },
  /* Comparative beat/match/top of a competing or own figure: "beat
   * their number", "match my current base", "top the offer", "match my
   * other offer of 46", "beat a competing offer". Ported from
   * COUNTER_THEN_CLOSE_PATTERN, bridge dropped. The `my …offer` and
   * competing/rival/outside-offer arms were added after "match my other
   * offer of 46" false-closed at the un-bumped ₹40 offer (batch-6 hostile
   * leak, 2026-07-09): the object list omitted "offer" and "other", so the
   * strict gate read a clean accept. Always unmet (matching a competing
   * figure is an upward ask), so no offer gate. The possessive-party arm
   * (`[a-z][\w.-]*'s (offer|number|…)`) was added after "Match Google's offer
   * and I'll sign." false-closed at the un-bumped offer (batch-17 hostile leak,
   * 2026-07-11): the object list bound only pronoun determiners (their/the/my),
   * so a NAMED competitor's offer quoted possessively slipped through. Matching a
   * third party's offer is inherently an upward ask, and even the ambiguous
   * "match the company's offer" reading is safe under this module's demand-recall
   * bias (an over-detect merely costs a turn). */
  {
    reason: "beat-match",
    re: /\b(?:beat|match|top|exceed|improve\s+(?:on|upon)|come\s+up\s+on)\s+(?:it|that|this|their\s+(?:offer|number|figure|comp\w*|package|ctc)|the\s+(?:offer|number|figure|comp\w*|package|ctc)|my\s+(?:other\s+)?(?:current|ctc|comp\w*|package|base|salary|pay|number|offer|counter|ask|demand)|(?:a|an|another|the|my|their)\s+(?:competing|rival|outside|other)\s+offer|[a-z][\w.-]*'s\s+(?:offer|number|figure|comp\w*|package|ctc))\b/i,
  },
  /* Beat/match a bare FIGURE ("beat the 47 Razorpay gave me", "match 46",
   * "exceed the 48 I have"). beat-match above only binds an OBJECT WORD
   * (offer/number/comp) after the verb, so a competing figure quoted as a bare
   * number slipped through: the planner's acceptanceUtteranceFigure then read
   * that figure as an AGREED close (it sits within 6% of the sticky target) and
   * closed there — a false-close, since "beat 47" demands strictly MORE than 47
   * (offline hostile battery, 2026-07-09). Offer-gated absolute target: a figure
   * at/below the offer ("match my current 38") is met — no demand — while
   * above-offer or offer-unknown registers as unmet so both gates block. The
   * verb+figure adjacency keeps ordinary prose out ("beat the deadline", "match
   * your energy" carry no number; "beat the 3 references" is below any offer). */
  {
    reason: "beat-figure",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(?:beat|match|top|exceed|improve\s+(?:on|upon))\s+(?:the|that|this|my|their|a|an|another|it)?\s*(?:competing|rival|outside|other|current)?\s*(?:offer|number|figure|package|ctc|comp\w*)?\s*(?:of\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Trailing floor idiom: a figure pinned by "not a rupee/penny/paisa
   * less/below" ("I'm in at 45.5, not a rupee less"). The floor sits AFTER
   * the number, so floor-target — which LEADS with the floor phrase — misses
   * it, and the strict gate read a clean accept and false-closed at the
   * un-bumped offer (batch-6 hostile leak, 2026-07-09). Absolute target:
   * counts when the offer is unknown so the strict gate blocks it. The coin
   * noun + comparative is lexically specific, so ordinary prose does not
   * trip it. */
  {
    reason: "floor-tail",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?)?\b[^.!?]{0,10}?\bnot\s+(?:a|one|even\s+a)\s+(?:single\s+)?(?:rupee|penny|paisa|dime|cent|buck)\s+(?:less|below|lower|under|short)\b/i,
  },
  /* Non-numeric sweetener GRANT (imperative): "throw in relocation", "add a
   * joining bonus", "include equity", "sort out the ESOP". Ported from
   * GRANT_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "grant-sweetener",
    re: new RegExp(
      `\\b(?:throw\\s+in|toss\\s+in|chip\\s+in|add\\b|include\\b|cover\\b|sort\\s+out|guarantee|sweeten|match\\b)\\b[^.!?]{0,30}?\\b${SWEETENER}\\b`,
      "i",
    ),
  },
  /* Terms-change imperative on a NAMED comp lever (no figure): "fix the equity",
   * "sweeten the base", "improve the CTC", "bump up the cash", "sort out the
   * package". The grant-sweetener core above catches an upward verb only when it
   * lands on a SWEETENER noun ("sweeten the BONUS"), and verb-magnitude only fires
   * with an adjacent figure — so a bare "make this lever better" imperative on a
   * CORE cash component slipped both, and "Fix the equity and I'll accept." /
   * "Sweeten the base and we have a deal." false-closed at the un-bumped offer
   * (batch-14 hostile leak, 2026-07-11). The verb set is upward-only ("fix/improve/
   * sweeten/beef up/firm up/revise" a comp lever can only mean raise it), so no
   * figure or offer gate is needed — it is always an unmet demand. Lexically
   * pinned to comp levers (SWEETENER ∪ CORE_COMP), so procedural closes with no
   * lever ("send me the offer letter and I'll sign") and satisfaction references
   * ("the base works, deal") never match. */
  {
    reason: "improve-lever",
    re: new RegExp(
      `\\b(?:sweeten|fix|improve|firm\\s+up|beef\\s+up|top\\s+up|bump\\s+up|push\\s+up|jack\\s+up|revise|rework|revisit|relook\\s+at|adjust|sort\\s+out|work\\s+on)\\b` +
        `[^.!?]{0,15}?\\b(?:${CORE_COMP}|${SWEETENER})\\b`,
      "i",
    ),
  },
  /* Imperative to REVISE the offer upward ("send me a better offer", "get me a
   * higher offer", "come back with a revised number"). The verb set overlaps the
   * legitimate procedural close "send me the offer letter and I'll sign" (pinned
   * as a genuine accept in the improve-lever note), so this core is GATED on a
   * comparative/revision ADJECTIVE (better/higher/improved/revised/stronger/
   * bigger/sweeter/richer) sitting between the verb and the offer noun — "the
   * offer letter" carries no such adjective and never matches, while "a better
   * offer" is unambiguously a demand to raise it. Always unmet (asking for a
   * better offer means the current one is not accepted), so no offer gate.
   * Added after "Send me a better offer and I'll sign." false-accepted at the
   * un-bumped offer (offline hostile battery, 2026-07-17): the object of the
   * imperative was an improved OFFER rather than a named lever, so improve-lever
   * (lever-anchored) and grant-perk (perk-anchored) both missed it. */
  {
    reason: "revise-offer-up",
    re: /\b(?:send|get|give|bring|come\s+back\s+with|come\s+up\s+with|put\s+together)\s+(?:me\s+)?(?:a|an|the|another)?\s*(?:better|higher|improved|revised|stronger|bigger|sweeter|richer|fatter|beefier)\s+(?:offer|number|figure|package|comp\w*|ctc|deal|proposal)\b/i,
  },
  /* Named NON-COMP perk GRANT (imperative): "give me a corner office and I'll
   * sign", "throw in a parking spot", "include a company car". Sibling of
   * grant-sweetener for the concrete perk nouns SWEETENER omits — a perk welded
   * to a close is a fresh unmet demand, not an accept (batch-15 hostile leak,
   * 2026-07-11). Grant-verb gated so ordinary prose naming an office/car never
   * matches; always unmet (a perk only ever adds to the package), no offer gate. */
  {
    reason: "grant-perk",
    re: new RegExp(
      `\\b(?:throw\\s+in|toss\\s+in|chip\\s+in|give\\s+me|gimme|get\\s+me|hand\\s+me|include|add|provide|expense|reimburse|sort\\s+out|guarantee|spring\\s+for)\\b` +
        `[^.!?]{0,20}?\\b${NONCOMP_PERK}\\b`,
      "i",
    ),
  },
  /* Vague RELATIVE bump with no figure: "bump it a little", "nudge it up",
   * "hike it a bit", "push the number higher". verb-magnitude needs an adjacent
   * figure and improve-lever needs a NAMED lever, so an unquantified upward bump
   * on the anaphor "it"/"the number" slipped both and "Bump it a little and I'll
   * sign" false-closed at the un-bumped offer (batch-16 hostile leak,
   * 2026-07-11). Verbs are inherently upward (bump/nudge/hike/jack/boost/lift),
   * so it is always an unmet demand; the object is pinned to it/that or a comp
   * handle, and an optional "up/higher/a little" tail is allowed — ordinary prose
   * ("take it", "move on") never matches. The object list is the SHARED lever
   * vocabulary (CORE_COMP ∪ SWEETENER) plus the generic number/figure/offer/pay
   * handles: a hardcoded cash-only list ("base/fixed/…") missed equity/esops/
   * stock/bonus/variable, so "Bump the equity and I accept." false-closed at the
   * un-bumped offer (batch-19 hostile leak, 2026-07-12). Sourcing the levers from
   * the same constants the other demand cores use keeps the vocabulary in one
   * place — a lever added there is covered here for free. */
  {
    reason: "vague-relative-bump",
    re: new RegExp(
      `\\b(?:bump|nudge|hike|jack|boost|lift|kick)\\s+(?:it|that|the\\s+(?:number|figure|offer|pay|${CORE_COMP}|${SWEETENER}))(?:\\s+(?:up|higher|north))?(?:\\s+(?:a\\s+(?:little|bit|touch|tad|smidge|notch)|slightly|some(?:what)?))?\\b`,
      "i",
    ),
  },
  /* Directional CONVERGENCE demand (figureless): "round it up", "split the
   * difference", "meet me halfway", "meet in the middle", "close/bridge/narrow
   * the gap", "find a middle ground". Each is an imperative to move the standing
   * offer UPWARD toward the candidate (round up, or land above the offer at a
   * midpoint / the candidate's ask), yet carries no figure and no named lever, so
   * every figure- and lever-anchored core missed it and "Let's split the
   * difference and I'll sign." / "Meet me halfway and I'm in." / "Round it up and
   * I'll take it." / "Close the gap to my ask and I accept." false-closed at the
   * un-bumped offer (batch-17 hostile leak, 2026-07-11). Always unmet (all move
   * the offer up), so no offer gate. The verbs are present-imperative, so PAST-
   * tense satisfaction ("you met me halfway, I accept" / "closed the gap, deal")
   * does NOT match — only a live request for movement does. */
  {
    reason: "convergence-demand",
    re: /\b(?:round\s+(?:it|that|(?:the|this)\s+\w+)?\s*up|round\s+up|split\s+the\s+difference|meet\s+(?:me\s+)?(?:half\s?way|in\s+the\s+middle)|(?:close|bridge|narrow|split)\s+the\s+gap|(?:find|reach|hit)\s+(?:a\s+)?middle\s+ground)\b/i,
  },
  /* Figureless VAGUE-IMPROVE demand: "sweeten it a bit", "push it a little",
   * "make it worth my while", "do a bit better", "come back with a better
   * number". Each imperatively asks the recruiter to RAISE the standing offer
   * without naming a figure — a sibling of vague-relative-bump (bump/nudge/…)
   * and convergence-demand, but keyed on the improve verbs those two miss, so
   * "Sweeten it a bit and I'll take it." / "Do a bit better and I'll sign."
   * false-closed at the un-bumped offer (batch-18 hostile leak, 2026-07-11).
   * Always unmet (all move the offer up), so no offer gate. The directional
   * tail on push/nudge/move (up/higher/a little) keeps "push it to next week"
   * (defer, not raise) out; the comparative arms require a compare verb frame
   * ("do better", "come back with a better …"), so a satisfaction reference to
   * a "better offer" naming no request never matches. */
  {
    reason: "vague-improve-demand",
    re: /\b(?:sweeten\s+(?:it|that|the\s+(?:deal|offer|pot|package|number|comp))|(?:push|nudge|move)\s+(?:it|that)\s+(?:up|higher|north|a\s+(?:little|bit|touch))|make\s+it\s+worth\s+(?:my|the)\s+while|do\s+(?:a\s+(?:bit|little|touch)\s+)?better|come\s+back\s+with\s+(?:a\s+)?(?:better|higher|stronger|more))\b/i,
  },
  /* PEER-MATCH demand: "match what you paid the last senior hire", "pay me what
   * the other seniors make". A request to lift the offer to an (unnamed) peer /
   * cohort benchmark — inherently upward, yet the beat-match core binds only a
   * possessive OFFER object (their/Google's offer), so a "what <peer> earns"
   * clause slipped it and false-closed at the un-bumped offer (batch-18 hostile
   * leak, 2026-07-11). The "match/beat/pay-me … what … <earn verb>" frame keeps
   * a bare "you don't have to match anyone, I accept" (no "what … earns" clause)
   * out, so the negation trap still accepts. */
  {
    reason: "peer-match-demand",
    re: /\b(?:match|beat|pay\s+me)\b[^.!?]{0,30}?\bwhat\b[^.!?]{0,30}?\b(?:paid|pays?|makes?|earns?|gets?|got|make|earn|are\s+(?:paid|making|on))\b/i,
  },
  /* Figureless BENCHMARK-MATCH demand: "match the market", "get me to par with
   * the team", "get me closer to what I'm worth", "bring me in line with
   * industry standard". A request to lift the offer to an unnamed external
   * benchmark — inherently upward, yet distinct from peer-match-demand (which
   * needs a "what <peer> earns" clause) and beat-match (a possessive OFFER
   * object), so a bare benchmark noun slipped both and false-closed at the
   * un-bumped offer (batch-19 hostile leak, 2026-07-12). Two verb frames: the
   * transitive "match <benchmark>" and the ditransitive "get/bring/move me
   * (up/closer) to <benchmark>". The benchmark is a closed list (market/par/
   * parity/industry standard/what I'm worth/what I deserve), so ordinary prose
   * never matches; the imperative "match" (not "matches") keeps a stative "the
   * offer matches the market, I accept" (satisfaction) out, and the shared
   * dismissal-tail guard covers "you don't have to match the market, I accept". */
  {
    reason: "benchmark-match-demand",
    re: /\b(?:match|(?:get|bring|move|take|push)\s+me\s+(?:up\s+)?(?:to|closer\s+to|towards?|nearer\s+to|in\s+line\s+with))\s+(?:the\s+)?(?:market(?:\s+(?:rate|value|average|median))?|par\b|parity|industry\s+(?:standard|average|norm|rate|median)|what\s+i(?:'m|\s+am)\s+worth|what\s+i\s+deserve|my\s+(?:market\s+)?worth)\b/i,
  },
  /* FUTURE-GUARANTEE demand: "guarantee a review in six months", "promise me a
   * raise at review". A demand for a forward commitment (review / raise / bump)
   * the recruiter has NOT granted — welding it to a close fabricates agreement
   * to a guarantee that was never made, so "Guarantee a review in six months
   * and I accept." false-closed (batch-18 hostile leak, 2026-07-11). Gated on a
   * commit verb (guarantee/promise/commit-to/lock-in) governing a raise/review
   * noun, so ordinary future talk ("looking forward to the review, I accept")
   * — no commit verb — still accepts. */
  {
    reason: "future-guarantee-demand",
    re: /\b(?:guarantee|promise|commit\s+to|lock\s+in)\s+(?:me\s+)?(?:a|an|the)?\s*(?:review|raise|bump|increase|hike|promotion|re-?visit|reassessment|re-?evaluation)\b/i,
  },
  /* WAIVE-A-CLAUSE demand: "waive the bond and I'll sign", "drop the lock-in and
   * I'm in", "remove the non-compete", "scrap the notice period". A demand that
   * the employer GIVE UP an unfavourable contractual term — inherently a
   * concession extracted from the employer, so welding it to a close fabricates
   * agreement to a waiver never granted, and "Waive the bond and I'll sign."
   * false-closed at terms the candidate is rejecting (batch-20 hostile leak,
   * 2026-07-13). Always unmet (a removal only ever moves the deal toward the
   * candidate), no offer gate. Gated on a present-imperative REMOVAL verb
   * governing a CLAUSE noun; \b-bounded verbs keep PAST-tense satisfaction ("you
   * waived the bond, deal" / "dropped the lock-in, I accept") out — only a live
   * request to remove a term matches. */
  {
    reason: "waive-clause",
    re: new RegExp(
      `\\b(?:waive|drop|remove|cut|eliminate|scrap|lift|forgo|forego|do\\s+away\\s+with|get\\s+rid\\s+of)\\b` +
        `[^.!?]{0,15}?\\b${CLAUSE}\\b`,
      "i",
    ),
  },
  /* Anaphoric terms-change welded to a comp topic: "what about relocation? sort
   * that and I accept", "the equity — fix that and I'm in". improve-lever needs
   * the lever named DIRECTLY after the verb, so a terms-change verb governing the
   * anaphor "that"/"it"/"this" (referring back to a comp lever raised earlier in
   * the utterance) slipped it (batch-16 hostile leak, 2026-07-11). Gated by a
   * lookahead requiring a comp/sweetener noun ANYWHERE in the utterance, so the
   * anaphor demonstrably refers to a comp lever — "I can handle it, I accept"
   * (no comp noun) and "that works for me" (no terms verb) never match. */
  {
    reason: "anaphoric-terms-change",
    re: new RegExp(
      `(?=.*\\b(?:${CORE_COMP}|${SWEETENER})\\b)` +
        `.*\\b(?:fix|sort(?:\\s+out)?|handle|adjust|revise|rework|improve|sweeten)\\s+(?:that|it|this)\\b`,
      "i",
    ),
  },
  /* Non-imperative sweetener DEMAND — the phrasings the imperative core above
   * misses because the grant verb comes after the noun, is first-person, or is
   * a hypothetical ("relocation added", "I need equity", "would be perfect with
   * a joining bonus"). Hostile-probe leaks (2026-07-09). Kept in demand FRAMES
   * only so a satisfaction reference ("happy with the bonus, deal") does not
   * over-block. */
  {
    reason: "sweetener-demand",
    re: new RegExp(
      "(?:" +
        // passive grant: verb after the noun — "relocation added", "equity
        // included". Guarded by a DEFINITE-determiner negative lookbehind so a
        // sweetener referenced as ALREADY on the table ("with the 2L joining
        // bonus on top, I accept", "with the joining bonus included") reads as a
        // CONFIRMATION of the standing package, not a fresh demand — the same
        // definite/indefinite discipline the hypothetical branch below applies
        // ("with THE bonus" is satisfaction, "with A bonus" is a new ask). The
        // lookbehind skips up to three intervening tokens (figure, unit, and
        // the compound-noun head, e.g. "the 2L joining " before "bonus", since
        // SWEETENER also matches the bare word "bonus"). A bare ("equity
        // included") or indefinite ("a joining bonus thrown in") sweetener still
        // matches and still vetoes the welded false-close.
        `(?<!\\b(?:the|that|this|these|those|your|our|their|its|his|her)\\s+(?:[\\w.,₹-]+\\s+){0,3})` +
        `\\b${SWEETENER}\\b[^.!?]{0,15}?\\b(?:added|include[ds]|thrown\\s+in|sorted(?:\\s+out)?|covered|guaranteed|sweetened|on\\s+top|in\\s+the\\s+mix)\\b` +
        "|" +
        // first-person want: "I need equity", "I'd like a joining bonus"
        `\\bi(?:'?d)?\\s+(?:need|want|expect|require|would\\s+like|'?d\\s+like|must\\s+have|gotta\\s+have|also\\s+want)\\b[^.!?]{0,15}?\\b${SWEETENER}\\b` +
        "|" +
        // hypothetical improvement with an INDEFINITE sweetener: "would be
        // perfect with a joining bonus" (indefinite article ⇒ a new/wanted item;
        // "…with THE bonus" is satisfaction and deliberately not matched)
        `\\b(?:would\\s+be|it'?d\\s+be|be)\\s+(?:even\\s+)?(?:perfect|great|ideal|better|nicer?|sweeter)\\s+with\\s+(?:a|an|some)\\b[^.!?]{0,15}?\\b${SWEETENER}\\b` +
        ")",
      "i",
    ),
  },
  /* Non-comp role/title/level upgrade: "make it a Principal role",
   * "make it a Staff title". Ported from
   * NONCOMP_DEMAND_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "title-upgrade",
    re: /\bmake\s+it\s+(?:a\s+|an\s+|the\s+)?[^.!?]{0,20}?\b(?:roles?|titles?|designations?|levels?|bands?|grades?|positions?|principal|staff|senior|lead|director|manager|architect)\b/i,
  },
  /* Grant/promote a TITLE or level (imperative/first-person): "give me the senior
   * title and I'll sign", "get me to staff level", "promote me to principal",
   * "bump me up to lead". title-upgrade only fires on the "make it a …" frame, so
   * a grant/move verb governing a title noun slipped it and false-closed at the
   * un-bumped offer (batch-17 hostile leak, 2026-07-11). A title/level upgrade is
   * a fresh unmet demand on top of the standing package (not an accept), so no
   * offer gate; the grant/move-verb gate keeps ordinary prose naming a "role" or
   * "level" ("this role is a great fit, deal") from matching. */
  {
    reason: "title-grant",
    re: new RegExp(
      // "promote/elevate me" is itself the level-upgrade demand — no noun needed.
      `\\b(?:promote|elevate|upgrade)\\s+me\\b` +
        // other grant/move verbs need a title noun OR a rank name to count.
        `|\\b(?:give\\s+me|gimme|get\\s+me|hand\\s+me|i(?:'?d)?\\s+(?:want|need|expect|deserve)|bump\\s+me(?:\\s+up)?\\s+to|move\\s+me(?:\\s+up)?\\s+to)\\b` +
        `[^.!?]{0,25}?\\b(?:${NONCOMP_TITLE}|${RANK})\\b`,
      "i",
    ),
  },
  /* Bare "give me N" / "I want N" ABSOLUTE — the core the old vetoes
   * MISSED (no increase token, no "to" target, no and/then bridge):
   * "Give me 45 and I'm in." at a ₹40L offer. A demand only when the
   * offer is known and N provably exceeds it; below-offer restatements
   * ("give me 40" at ₹40L) are concessions, handled as accepts
   * elsewhere. */
  {
    reason: "demand-absolute",
    absoluteTargetGroup: 1,
    requiresOfferToExceed: true,
    re: /\b(?:(?:give|gimme|get|hand)\s+me|i(?:'?d)?\s+(?:want|need|expect))\b[^.!?]{0,15}?(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac|l|k)?\b/i,
  },
  /* Interrogative absolute demand — the question-form twin of raise-to-target:
   * "could you do 46?", "can you get me to 45?", "any chance of 45?". Unmet
   * only when the asked figure beats the offer (matching the imperative cores).
   * Hostile-probe leak (2026-07-09). */
  {
    reason: "demand-question",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(?:(?:could|can|would|will)\s+you\s+(?:do|make\s+it|get\s+me\s+to|bump\s+(?:it|the\s+\w+)\s+to|push\s+(?:it|the\s+\w+)\s+to|raise\s+(?:it|the\s+\w+)\s+to|go\s+to|stretch\s+to|come\s+up\s+to)|any\s+chance\s+(?:of|at|for))\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
  },
  /* Counterfactual accept at a HIGHER figure: "even at 42 I'd accept, but this is
   * only 40", "at 45 I'd sign". The candidate names the figure the offer WOULD
   * need to reach — an accept pinned to a target above the standing offer, so the
   * present offer is implicitly rejected. The bare "I'd accept" dominated and the
   * utterance false-closed at the un-bumped offer (batch-15 hostile leak,
   * 2026-07-11). Offer-gated absolute target: only unmet when the named figure
   * beats the offer, so a genuine "even at 40 I'd accept" against a ₹40 offer
   * (40 ≤ 40) is met and still closes. */
  {
    reason: "counterfactual-accept-higher",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\beven\s+at\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b[^.!?]{0,25}?\bi(?:'?d|\s+would)?\s+(?:accept|sign|take\s+it|be\s+in|do\s+it)\b/i,
  },
];

export interface DemandAnalysis {
  /** True when the utterance carries a compensation demand that the
   *  standing offer does not satisfy. */
  unmet: boolean;
  /** Rule ids of the demand cores that fired (telemetry / debugging). */
  reasons: string[];
}

/**
 * Detect an UNMET compensation demand anywhere in `text`, independent
 * of how it is joined to any commit/close idiom. The classifier
 * composes this with its commit detector: a commit idiom + an unmet
 * demand is a conditional counter, never an unconditional accept.
 *
 * `offerLpa` (the standing numeric offer, LPA) gates the absolute
 * forms: a target/figure at or below the offer is a restatement, not a
 * raise. When the offer is unknown, absolute-target cores still count
 * (an explicit "make it 50" is phrased as a change request regardless),
 * but the bare "give me N" core — which is only a demand relative to a
 * known offer — is skipped to avoid over-blocking a numberless-context
 * concession.
 */
/** Normalize a captured "<figure><unit>" to LAKHS so it compares against a
 *  lakh-denominated offer: crore ×100, million (m/mn/million) ×10, everything
 *  else (lpa/lakh/lac/l/k/bare) already lakhs. */
function figureToLakhs(figure: string, unit: string | undefined): number {
  const n = parseFloat(figure);
  if (!Number.isFinite(n)) return NaN;
  const u = (unit || "").toLowerCase();
  if (u === "cr" || u.startsWith("crore")) return n * 100;
  if (u === "m" || u === "mn" || u === "million") return n * 10;
  return n;
}

/* Spelled-out cardinal → digits, so a demand phrased "bring the base to forty
 * eight" is seen by the same cores that catch "…to 48". Candidates (and STT
 * transcripts) do spell figures out; "Bring the base to forty eight and I'm in"
 * false-closed at the un-bumped offer because every core needs a DIGIT (batch-6
 * hostile leak, 2026-07-09). Normalization is deliberately conservative — it
 * converts only the compound "<tens>[-\s]<ones>" / bare-tens / teen forms that
 * dominate salary figures (20-99, plus 10-19), never bare ones ("one", "two")
 * which are far more often articles/quantifiers than an LPA number. Applied at
 * the single analyzeDemand choke point, so BOTH acceptance gates inherit it and
 * digit-only inputs are untouched. */
const SPELLED_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SPELLED_TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const SPELLED_ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
};
const SPELLED_TENS_RE = new RegExp(
  `\\b(${Object.keys(SPELLED_TENS).join("|")})(?:[-\\s]+(${Object.keys(SPELLED_ONES).join("|")}))?\\b`,
  "gi",
);
const SPELLED_TEENS_RE = new RegExp(`\\b(${Object.keys(SPELLED_TEENS).join("|")})\\b`, "gi");

function normalizeSpelledNumbers(text: string): string {
  return text
    .replace(SPELLED_TENS_RE, (_m, tens: string, ones?: string) => {
      const base = SPELLED_TENS[tens.toLowerCase()];
      const add = ones ? SPELLED_ONES[ones.toLowerCase()] : 0;
      return String(base + add);
    })
    .replace(SPELLED_TEENS_RE, (_m, teen: string) => String(SPELLED_TEENS[teen.toLowerCase()]));
}

/* A demand trigger immediately preceded by a dismissal frame is the candidate
 * WAIVING the demand, not making it: "No need to bump it, I'll take it.",
 * "You don't have to match anyone — I accept.", "Not asking for more, deal."
 * The negated trigger must NOT veto the accept. Applied uniformly to every
 * core (single source): if the text right before the matched trigger ends in a
 * dismissal frame, the match is a waiver and is skipped. Requires the frame to
 * abut the trigger (trailing \s+$ against the pre-match slice), so a genuine
 * demand elsewhere in the utterance ("don't lowball me — bump it up and I'll
 * sign") is unaffected. */
const DISMISSAL_TAIL_RE =
  /\b(?:no\s+need\s+(?:to|for)|don'?t\s+need(?:\s+to)?|don'?t\s+have\s+to|not\s+(?:asking|looking)\s+for)\s+$/i;

export function analyzeDemand(text: string | null | undefined, offerLpa?: number): DemandAnalysis {
  const trimmed = (text || "").trim();
  if (!trimmed) return { unmet: false, reasons: [] };
  const a = normalizeSpelledNumbers(trimmed);
  const reasons: string[] = [];
  const haveOffer = typeof offerLpa === "number" && Number.isFinite(offerLpa) && offerLpa > 0;
  for (const core of DEMAND_CORES) {
    const m = core.re.exec(a);
    if (!m) continue;
    /* Skip a trigger that sits immediately after a dismissal frame — the
     * candidate is waiving that demand, not raising it. m.index points at the
     * trigger for the direct cores; lookahead cores match at 0 (empty slice,
     * never a dismissal), so they are unaffected. */
    if (m.index > 0 && DISMISSAL_TAIL_RE.test(a.slice(0, m.index))) continue;
    /* A figure comes from either a literal digit group or a derived
     * computeFigure (decade-band); both are offer-gated absolute targets. */
    const hasAbsolute = core.absoluteTargetGroup != null || core.computeFigure != null;
    const figure = core.computeFigure
      ? core.computeFigure(m)
      : core.absoluteTargetGroup != null
        ? figureToLakhs(m[core.absoluteTargetGroup], core.unitGroup != null ? m[core.unitGroup] : undefined)
        : NaN;
    if (core.requiresOfferToExceed) {
      /* Only a demand when we can PROVE the figure exceeds the offer. */
      if (!haveOffer) continue;
      if (!Number.isFinite(figure) || figure <= (offerLpa as number) + 1e-9) continue;
      reasons.push(core.reason);
      continue;
    }
    if (hasAbsolute && haveOffer) {
      /* Absolute raise target: unmet only when it beats the offer. A
       * target at or below the standing offer is a no-op restatement. */
      if (Number.isFinite(figure) && figure <= (offerLpa as number) + 1e-9) continue;
    }
    reasons.push(core.reason);
  }
  return { unmet: reasons.length > 0, reasons };
}

/** Convenience boolean form. */
export function carriesUnmetDemand(text: string | null | undefined, offerLpa?: number): boolean {
  return analyzeDemand(text, offerLpa).unmet;
}
