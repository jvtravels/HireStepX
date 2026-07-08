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
  /** When true, the core only counts as a demand when the standing
   *  offer is KNOWN and the captured figure exceeds it. Used for the
   *  bare "give me N" / "I want N" absolute form, which is a demand
   *  only if N is provably above the offer (otherwise it may be a
   *  concession restatement — "give me 40" at a ₹40L offer). */
  requiresOfferToExceed?: boolean;
}

/* Increase magnitude fragment shared by the relative/word forms:
 * a digit or a verbal quantifier (a / an / one / half a / a couple / a
 * few / several), followed by a cash-or-percent unit. */
const UNIT = "(?:%|percent|per\\s?cent|lpa|lakhs?|lac|l|k)";
const VERBAL_QTY = "(?:a|an|one|half\\s+a|(?:a\\s+)?couple(?:\\s+of)?|(?:a\\s+)?few|several)";
const INCREASE_TOKEN = "(?:more|higher|extra|additional|on\\s+top)";
/* Gratitude guard — "3% more THAN I expected" is thanks, not a demand. */
const NOT_THAN = "(?!\\s+than)";

const DEMAND_CORES: DemandCore[] = [
  /* Absolute raise TARGET: "make it 50", "get the base to 55", "bump
   * fixed to 58", "push cash to 60". Unmet only when the target beats
   * the standing offer. Ported from CONDITIONAL_DEMAND_PATTERN, bridge
   * dropped. */
  {
    reason: "raise-to-target",
    absoluteTargetGroup: 1,
    re: /\b(?:make\s+it|(?:get|bump|push|raise|take|bring|come\s+up|move|nudge)\s+(?:(?:it|the\s+fixed|the\s+base|the\s+cash|fixed|base|cash|total|ctc|package)\s+)?to)\s+(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac|l|k|cr|crores?)?\b/i,
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
  /* Comparative beat/match/top of a competing or own figure: "beat
   * their number", "match my current base", "top the offer". Ported
   * from COUNTER_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "beat-match",
    re: /\b(?:beat|match|top|exceed|improve\s+(?:on|upon)|come\s+up\s+on)\s+(?:it|that|this|their\s+(?:offer|number|figure|comp\w*|package|ctc)|the\s+(?:offer|number|figure|comp\w*|package|ctc)|my\s+(?:current|ctc|comp\w*|package|base|salary|pay|number))\b/i,
  },
  /* Non-numeric sweetener GRANT: "throw in relocation", "add a joining
   * bonus", "include equity", "sort out the ESOP". Ported from
   * GRANT_THEN_CLOSE_PATTERN, bridge dropped. */
  {
    reason: "grant-sweetener",
    re: /\b(?:throw\s+in|toss\s+in|chip\s+in|add\b|include\b|cover\b|sort\s+out|guarantee|sweeten|match\b)\b[^.!?]{0,30}?\b(?:joining\s+bonus|signing\s+bonus|sign[-\s]?on\s+bonus|retention\s+bonus|bonus(?:es)?|joining|relocation|reloc\b|notice\s+(?:buyout|pay|period(?:\s+buyout)?)|buyout|esops?|rsus?|equity|stock(?:\s+options?)?|shares?|variable|allowances?|hra\b|perks?|benefits?|wfh|remote|sabbatical)\b/i,
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
export function analyzeDemand(text: string | null | undefined, offerLpa?: number): DemandAnalysis {
  const a = (text || "").trim();
  if (!a) return { unmet: false, reasons: [] };
  const reasons: string[] = [];
  const haveOffer = typeof offerLpa === "number" && Number.isFinite(offerLpa) && offerLpa > 0;
  for (const core of DEMAND_CORES) {
    const m = core.re.exec(a);
    if (!m) continue;
    if (core.requiresOfferToExceed) {
      /* Only a demand when we can PROVE the figure exceeds the offer. */
      if (!haveOffer) continue;
      const n = core.absoluteTargetGroup != null ? parseFloat(m[core.absoluteTargetGroup]) : NaN;
      if (!Number.isFinite(n) || n <= (offerLpa as number) + 1e-9) continue;
      reasons.push(core.reason);
      continue;
    }
    if (core.absoluteTargetGroup != null && haveOffer) {
      /* Absolute raise target: unmet only when it beats the offer. A
       * target at or below the standing offer is a no-op restatement. */
      const n = parseFloat(m[core.absoluteTargetGroup]);
      if (Number.isFinite(n) && n <= (offerLpa as number) + 1e-9) continue;
    }
    reasons.push(core.reason);
  }
  return { unmet: reasons.length > 0, reasons };
}

/** Convenience boolean form. */
export function carriesUnmetDemand(text: string | null | undefined, offerLpa?: number): boolean {
  return analyzeDemand(text, offerLpa).unmet;
}
