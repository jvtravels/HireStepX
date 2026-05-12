/* Acceptance classifier — single source of truth for "did the
 * candidate accept the offer". Two detectors were running in parallel
 * before this module landed:
 *   - `signalsAcceptance` inside parseCandidateAnswer (kernel path,
 *     per-turn regex on the candidate's reply)
 *   - `acceptedImmediately` inside extractNegotiationFacts (legacy
 *     facts path, regex on every userAnswer in the transcript)
 * They drifted: the kernel got a soft-acceptance batch (MakeMyTrip,
 * 2026-05-12), then explicit "would like to accept" forms (Lollypop,
 * 2026-05-13), then a weak-affirmative veto (Accenture, 2026-05-13).
 * The legacy detector got none of those. Every fix had to land twice
 * or risk asymmetric behavior depending on which path the UI consumed.
 *
 * This module collapses both detectors into one classifier. The
 * kernel and the legacy facts extractor both call `classifyAcceptance`
 * — any future bug-fix lands once, both paths get it.
 *
 * The classifier is also the place where structural phase gates live.
 * Pattern matching alone can never get this right: "Sounds good" is
 * acceptance after an offer is on the table, and conversational
 * filler before any number has been quoted. Callers pass context
 * (phase + offerOnTable) when known; the gate fires only when the
 * context is provided AND structurally inconsistent with acceptance.
 * When context is omitted (back-compat for the whole-transcript
 * extractor), the gate is skipped — keeping the legacy behavior
 * intact for any caller that hasn't been migrated.
 *
 * Tier rules (in order, highest first):
 *   1. Veto wins. Walk-away / hard-conditional / negotiating-but /
 *      negation / weak-affirmative-only / phase-gate → never accept.
 *   2. Performative verb wins. "I accept / I agree / I'll take it /
 *      done deal / signing today" alone is strong enough to accept
 *      even without an offer reference (the candidate's intent is
 *      unambiguous; if there's no offer on the table that's the
 *      caller's bug, not ours — but we still return confidence=
 *      "strong" so the caller can decide).
 *   3. Commitment idiom + offer reference. "Sounds good, your offer
 *      works" — medium confidence acceptance.
 *   4. Soft alignment — "I like your offer / aligned with the offer"
 *      — already names the offer, medium confidence acceptance.
 *   5. Otherwise no acceptance. */

export interface AcceptanceContext {
  /** Current kernel phase, if known. Pass undefined from legacy
   *  whole-transcript callers — the phase gate is skipped. */
  phase?: string;
  /** Whether the bot has quoted a salary number yet (i.e. an offer
   *  exists to accept). Pass undefined when unknown — phase gate
   *  is skipped. The kernel passes `state.highestOfferMade > 0`. */
  offerOnTable?: boolean;
}

export type AcceptanceConfidence = "strong" | "medium" | "none";

export interface AcceptanceResult {
  accepted: boolean;
  confidence: AcceptanceConfidence;
  /** Human-readable breadcrumbs for telemetry / debugging.
   *  Useful when a session is misclassified and we need to trace which
   *  rule fired. Each string is a rule id, e.g. "performative-verb",
   *  "weak-affirmative-only-veto", "phase-gate-no-offer". */
  reasons: string[];
}

/* ─── Pattern bank ─────────────────────────────────────────────── */

/** Performative acceptance verbs — these alone are strong enough
 *  to count as acceptance regardless of whether an offer reference
 *  is present. The verb itself names the speech act. */
const STRONG_PERFORMATIVE_PATTERNS: RegExp[] = [
  /\bi(?:'d)?\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b/i,
  /\bi\s*(?:'m|am)\s+accept(?:ing|ed)?\b/i,
  /\bi\s*(?:'?ll|will)\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b/i,
  /\bi\s+would\s+(?:like\s+to|love\s+to)\s+accept\b/i,
  /\bi'?d\s+(?:like\s+to|love\s+to)\s+accept\b/i,
  /\bi\s+want\s+to\s+accept\b/i,
  /\bi\s*(?:'ve|have)\s+(?:already\s+)?accepted\b/i,
  /\bi(?:\s+have)?\s+already\s+accepted\b/i,
  /\baccept(?:ing|ed)\s+(?:this|the|your)\s+offer\b/i,
  /\bi\s+(?:fully\s+|totally\s+|completely\s+)?agree\b/i,
  /\b(?:fully|totally|completely)\s+agree\b/i,
  /\bi.?ll\s+take\s+(?:it|the\s+offer)\b/i,
  /\bhappy\s+to\s+accept\b/i,
  /\bi.?m\s+signing\s+(?:today|now|tonight)\b/i,
  /\bsign\s+(?:today|right\s+now|tonight)\b/i,
];

/** Commitment idioms — informal acceptance markers. Weaker than
 *  performative verbs. Caller must combine with offer reference or
 *  accept on medium confidence with no other vetoes. */
const COMMITMENT_IDIOM_PATTERNS: RegExp[] = [
  /\bi.?m\s+in\b/i,
  /\b(?:your|the)\s+offer\s+(?:works|sounds\s+good|is\s+fine|is\s+great)\b/i,
  /\bsounds\s+good\b/i,
  /\bthat\s+works\b/i,
  /\bit.?s\s+a\s+deal\b/i,
  /\bdone\s+deal\b/i,
  /\blet.?s\s+(?:go\s+ahead|do\s+it|lock\s+it\s+in)\b/i,
  /\bi.?m\s+happy\s+with\s+(?:that|the\s+offer)\b/i,
  /\bfine\s+with\s+me\b/i,
];

/** Soft-alignment forms — language that affirms the offer
 *  specifically, surfaced by MakeMyTrip UX session (2026-05-12).
 *  Each pattern already references the offer object, so the offer-
 *  reference gate is implicitly satisfied. */
const SOFT_ALIGNMENT_PATTERNS: RegExp[] = [
  /\bi\s+(?:really\s+|truly\s+)?like\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:i'?m|i\s+am|we'?re|we\s+are)\s+aligned\s+(?:with|on)\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:we|i)\s+(?:'?ve|have)\s+(?:already\s+)?aligned\s+(?:on|with)\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:the|this|your)\s+(?:initial\s+)?offer\s+aligns?\s+with\b/i,
  /\bi'?m\s+fine\s+with\s+(?:the|this|your)\s+offer\b/i,
  /\bi'?m\s+good\s+with\s+(?:the|this|your)\s+offer\b/i,
];

/** Hindi-mix acceptance idioms — bare "haan ok / theek hai / done
 *  deal" style. Treated as commitment idioms (medium confidence). */
const HINDI_MIX_PATTERNS: RegExp[] = [
  /\btheek\s+hai\b/i,
  /\btheek\s+he\b/i,
  /\bho\s+ja(?:y|e)ega\b/i,
  /\bkar\s+(?:di(?:ya|jiye)|do|dijiye)\b/i,
  /\bmanzoor(?:\s+hai)?\b/i,
  /\bhaan\s+(?:thik|theek|ok|okay|done)\b/i,
];

/** Offer reference — the candidate's text mentions the offer object
 *  or a specific number. Required to upgrade a commitment idiom
 *  from "ambiguous filler" to "acceptance". */
const OFFER_REFERENCE_PATTERN =
  /\b(?:offer|deal|salary|ctc|package|lpa|lakhs?|₹|rs\.?|inr|\$\s*\d|\d+\s*(?:lpa|lakhs?|l\b|cr|crore|k\b))\b/i;

/** Veto: walk-away or rejection. */
const WALK_AWAY_PATTERN =
  /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;

/** Veto: hard conditional ("if/unless/provided"). Info-seeking
 *  conditionals are excepted ("if you could share the breakdown"). */
const HARD_CONDITIONAL_PATTERN =
  /\b(?:if|unless|provided|on condition|contingent|only\s+if|agar|jab\s+tak)\b/i;
const INFO_SEEKING_CONDITIONAL_PATTERN =
  /\b(?:if|unless|provided)\s+(?:you|it.?s|i)\s*(?:could|can|may|might|would|don.?t mind)?\s*(?:share|tell|let me know|elaborate|explain|clarify|confirm|provide|walk me through|give me|outline|show)\b/i;

/** Veto: "but/however … negotiation cue" within 60 chars. The
 *  cue list intentionally includes "more" — the most common
 *  re-open token. But "I would like to accept. But I'd like to
 *  know more about benefits" is info-seeking, not negotiation;
 *  the candidate has already accepted and is just asking for
 *  details. Excepted when an info-seeking verb (know/share/tell/
 *  explain/clarify/elaborate/walk through/understand/learn/
 *  hear) sits between the conjunction and the cue. */
const NEGOTIATING_BUT_PATTERN =
  /\b(?:but|however|lekin|magar)\b[^.!?\n]{0,60}?\b(?:more|higher|better|increase|raise|reduce|lower|stretch|bump|further|additional|negotiate|push|counter|extra|zyada|kam|aur)\b/i;
const INFO_SEEKING_BUT_PATTERN =
  /\b(?:but|however|lekin|magar)\b[^.!?\n]{0,60}?\b(?:know|share|tell|explain|clarify|elaborate|walk\s+(?:me\s+)?through|understand|learn|hear|see|ask|find\s+out)\b/i;

/** Veto: negation of acceptance ("not interested", "won't accept"). */
const NEGATION_PATTERN =
  /\b(no|not|don.?t|can.?t|won.?t|never)\s+(?:accept|interested|want|going|happy|comfortable|sure)\b/i;

/** Veto: weak-affirmative starters with no offer reference.
 *  "Okay, let's get started" type — Accenture session (2026-05-13). */
const WEAK_AFFIRMATIVE_ONLY_PATTERN =
  /^\s*(?:it'?s?\s+)?(?:ok(?:ay)?|alright|fine|sure|cool|good)[\s,.!]+(?:let'?s\s+(?:get\s+started|begin|start|kick\s+off|go|move\s+on)|let\s+us\s+(?:start|begin))[\s.!?]*$/i;

/* ─── Helpers ──────────────────────────────────────────────────── */

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

/* ─── Classifier ──────────────────────────────────────────────── */

/**
 * Classify whether `text` constitutes acceptance.
 *
 * Decision tree:
 *   1. Vetoes (walk-away, hard-conditional, negotiating-but,
 *      negation, weak-affirmative-only) → not accepted.
 *   2. Strong performative verb → accepted (strong).
 *   3. Soft alignment (always names offer) → accepted (medium).
 *   4. Commitment idiom (incl. Hindi-mix) + offer reference →
 *      accepted (medium).
 *   5. Commitment idiom alone → accepted (medium) UNLESS context
 *      provides `offerOnTable === false`, in which case phase-gate
 *      veto: "you can't accept what hasn't been offered."
 *   6. Otherwise not accepted.
 *
 * `context.phase` is currently informational only — every gate that
 * benefits from phase is also covered by `offerOnTable`. Kept on the
 * interface so future rules can branch on phase without resignaturing.
 */
export function classifyAcceptance(
  text: string,
  context: AcceptanceContext = {},
): AcceptanceResult {
  const reasons: string[] = [];
  const a = (text || "").trim();
  if (!a) return { accepted: false, confidence: "none", reasons: ["empty"] };

  /* Step 1: vetoes. Each veto is structural — even if every other
     signal screams acceptance, these rule it out. */
  if (WALK_AWAY_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["walk-away"] };
  }
  const hasAnyConditional = HARD_CONDITIONAL_PATTERN.test(a);
  const hasInfoSeeking = INFO_SEEKING_CONDITIONAL_PATTERN.test(a);
  if (hasAnyConditional && !hasInfoSeeking) {
    return { accepted: false, confidence: "none", reasons: ["hard-conditional"] };
  }
  if (NEGOTIATING_BUT_PATTERN.test(a) && !INFO_SEEKING_BUT_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["negotiating-but"] };
  }
  if (NEGATION_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["negation"] };
  }
  if (WEAK_AFFIRMATIVE_ONLY_PATTERN.test(a) && !OFFER_REFERENCE_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["weak-affirmative-only"] };
  }

  /* Step 2: performative verb. Unambiguous speech act. */
  if (anyMatch(a, STRONG_PERFORMATIVE_PATTERNS)) {
    reasons.push("performative-verb");
    return { accepted: true, confidence: "strong", reasons };
  }

  /* Step 3: soft alignment. Each pattern names the offer itself,
     so the offer-reference check is implicit. */
  if (anyMatch(a, SOFT_ALIGNMENT_PATTERNS)) {
    reasons.push("soft-alignment");
    return { accepted: true, confidence: "medium", reasons };
  }

  /* Step 4 + 5: commitment idiom, with optional offer-reference upgrade
     and phase-gate veto. */
  const hasIdiom = anyMatch(a, COMMITMENT_IDIOM_PATTERNS) || anyMatch(a, HINDI_MIX_PATTERNS);
  if (hasIdiom) {
    const hasOfferRef = OFFER_REFERENCE_PATTERN.test(a);
    if (hasOfferRef) {
      reasons.push("commitment-idiom", "offer-reference");
      return { accepted: true, confidence: "medium", reasons };
    }
    /* Phase gate: caller told us no offer is on the table.
       "Sounds good" before any number has been quoted is filler. */
    if (context.offerOnTable === false) {
      reasons.push("commitment-idiom", "phase-gate-no-offer-veto");
      return { accepted: false, confidence: "none", reasons };
    }
    reasons.push("commitment-idiom");
    return { accepted: true, confidence: "medium", reasons };
  }

  return { accepted: false, confidence: "none", reasons: ["no-match"] };
}
