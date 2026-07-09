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
    re: /\b(?:make\s+it|(?:get|bump|push|raise|take|bring|come\s+up|move|nudge)\s+(?:(?:it|the\s+fixed|the\s+base|the\s+cash|fixed|base|cash|total|ctc|package)\s+)?to)\s+(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
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
   * (batch-8 hostile leak, 2026-07-09). Offer-gated, so a below-offer number
   * ("over 15 years", "clears 30") is met, not a demand. */
  {
    reason: "floor-target",
    absoluteTargetGroup: 1,
    unitGroup: 2,
    re: /\b(?:at\s+least|no\s+less\s+than|no\s+lower\s+than|not\s+below|not\s+under|nothing\s+(?:under|below|less\s+than|lower\s+than)|north\s+of|upwards?\s+of|in\s+excess\s+of|(?:a\s+)?minimum\s+of|starting\s+at|over|above|tops?|clears?|crosses?|breaks?|surpasses?)\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l|k|cr|crores?|m|mn|million)?\b/i,
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
   * figure is an upward ask), so no offer gate. */
  {
    reason: "beat-match",
    re: /\b(?:beat|match|top|exceed|improve\s+(?:on|upon)|come\s+up\s+on)\s+(?:it|that|this|their\s+(?:offer|number|figure|comp\w*|package|ctc)|the\s+(?:offer|number|figure|comp\w*|package|ctc)|my\s+(?:other\s+)?(?:current|ctc|comp\w*|package|base|salary|pay|number|offer)|(?:a|an|another|the|my|their)\s+(?:competing|rival|outside|other)\s+offer)\b/i,
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
        // passive grant: verb after the noun — "relocation added", "equity included"
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

export function analyzeDemand(text: string | null | undefined, offerLpa?: number): DemandAnalysis {
  const trimmed = (text || "").trim();
  if (!trimmed) return { unmet: false, reasons: [] };
  const a = normalizeSpelledNumbers(trimmed);
  const reasons: string[] = [];
  const haveOffer = typeof offerLpa === "number" && Number.isFinite(offerLpa) && offerLpa > 0;
  for (const core of DEMAND_CORES) {
    const m = core.re.exec(a);
    if (!m) continue;
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
