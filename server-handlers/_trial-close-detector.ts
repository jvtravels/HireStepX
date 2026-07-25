/* Trial-close detectors (PDF #17 architectural fix, 2026-05-15).
 *
 * The recruiter MUST run an explicit trial close before transitioning
 * to terminal. This module supplies two pure detectors:
 *
 *   detectTrialCloseAsked(botReply)        → boolean
 *   detectTrialCloseResponse(candidateText) → 'accept' | 'decline' | 'hedge' | null
 *
 * Hedged language ("I'd be comfortable if", "let me think") MUST be
 * classified as 'hedge', not 'accept' — the move-picker uses this to
 * keep the conversation in commitment-test stage instead of closing.
 */

const TRIAL_CLOSE_ASK_PATTERNS: RegExp[] = [
  /\bif\s+we\s+(?:land|close|finalize|settle|agree)\s+at\s+(?:₹|rs\.?|inr\s+)?[\d.,]+/i,
  /\bwould\s+you\s+accept\s+(?:this\s+)?offer\s+today\b/i,
  /\bis\s+(?:₹|rs\.?|inr\s+)?[\d.,]+\s*(?:l|lpa|lakh)?\s+(?:within|workable|acceptable|fine)\b/i,
  /\bis\s+(?:₹|rs\.?|inr\s+)?[\d.,]+\s*(?:l|lpa|lakh)?\s+within\s+your\s+range\b/i,
  /\bif\s+i\s+(?:can|could)\s+(?:get|make|hit)\s+(?:₹|rs\.?|inr\s+)?[\d.,]+.{0,40}\bwould\s+you\b/i,
  /\bcan\s+you\s+commit\s+(?:to\s+)?(?:this\s+)?(?:offer|number)\s+today\b/i,
];

export function detectTrialCloseAsked(botReply: string | null | undefined): boolean {
  if (!botReply || typeof botReply !== "string") return false;
  return TRIAL_CLOSE_ASK_PATTERNS.some((p) => p.test(botReply));
}

const HEDGE_PATTERNS: RegExp[] = [
  /\bi(?:'|\s+wo|\s+wou)?\s*'?\s*d\s+be\s+(?:comfortable|fine|happy|ok(?:ay)?)\s+if\b/i,
  /\bif\s+(?:you\s+(?:can|could)|that\s+(?:happens|works))\b/i,
  /\blet\s+me\s+think\b/i,
  /\b(?:i\s+(?:need|want|would\s+like)\s+(?:to\s+)?)?think\s+(?:about\s+)?(?:it|this)\b/i,
  /\bget\s+back\s+to\s+you\b/i,
  /\bmaybe\b/i,
  /\b(?:i'?ll|i\s+will)\s+consider\b/i,
  /\bdepends\b/i,
  /\b(?:can\s+you\s+)?give\s+me\s+(?:some\s+)?time\b/i,
];

const ACCEPT_PATTERNS: RegExp[] = [
  /\byes,?\s+(?:i\s+)?(?:accept|will\s+accept|am\s+accepting|i'?m\s+accepting)\b/i,
  /\bi\s+accept\b/i,
  /\bi'?m\s+in\b/i,
  /\b(?:let'?s|let\s+us)\s+(?:do\s+(?:this|it)|move\s+forward|go\s+ahead|close\s+(?:this|the\s+offer))\b/i,
  /\b(?:please\s+)?send\s+(?:me\s+)?the\s+offer\s+letter\b/i,
  /\b(?:i'?m|i\s+am)\s+(?:in|on\s+board|good\s+with\s+(?:this|that))\b/i,
  /\bdone\s+deal\b/i,
  /\bsounds\s+good[,.]?\s+(?:let'?s\s+)?(?:proceed|close|move\s+forward)\b/i,
  /* Audit fix (2026-05-22) — common positive-response phrasings the
   * patterns above missed: "yes, that works (for me)", "works for
   * me", "that works", "happy with that", "fine with that", "i'll
   * take it", "i'm fine/good/happy with this/that". */
  /\b(?:yes,?\s+)?that\s+works(?:\s+for\s+me)?\b/i,
  /\bworks\s+for\s+me\b/i,
  /\b(?:i'?m|i\s+am)\s+(?:happy|fine|good|ok(?:ay)?)\s+with\s+(?:this|that|it)\b/i,
  /\bhappy\s+with\s+(?:this|that|the\s+offer)\b/i,
  /\bi'?ll\s+take\s+(?:it|the\s+offer)\b/i,
  /\b(?:i\s+)?accept\s+(?:the\s+)?offer\b/i,
  /\bgreat,?\s+(?:let'?s\s+)?(?:proceed|move\s+forward|close|do\s+it)\b/i,
  /* STT fragility audit (2026-05-22) — bare affirmative tokens. The
   * trial-close response is a yes/no question; STT routinely ships
   * "yeah" / "yep" / "ya" / "haan" / "ji" / "ji haan" / "absolutely"
   * as the candidate's whole reply. Previously only bare "yes" matched
   * — every other affirmative fell through to null, the move-picker
   * never transitioned, and the recruiter re-asked the same trial
   * close next turn. All English + Hindi affirmatives that are
   * idiomatically equivalent to "yes" anchor here. */
  /^\s*(?:yes|yeah|yep|yup|ya|yah|yes\s+please|sure|absolutely|definitely|certainly|of\s+course|for\s+sure|haan|hanji|ji|ji\s+haan|ha\s+ji|han\s+ji|theek\s+hai|thik\s+hai|bilkul|haan\s+ji)\s*[.!]?\s*$/i,
];

const DECLINE_PATTERNS: RegExp[] = [
  /\b(?:no|nope)[,.]?\s+i\s+(?:can'?t|cannot|won'?t)\s+(?:accept|do\s+this)\b/i,
  /* S82-B1 (2026-07-26) — "I'm going to pass along..." / "I'll pass along..." are hand-offs,
   * not declines. Add along/to-recipient guard. Same fix as S80-B1 in walk-away detectors.
   * S82-B2 (2026-07-26) — "I'm going to decline to answer" / "I'll decline to reveal..."
   * are info-privacy refusals, not trial-close declines. Add info-verb guard. */
  /\bi(?:'?m|\s+am)?\s+(?:going\s+to\s+)?(?:pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|decline(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|not\s+interested)\b/i,
  /\b(?:i'?ll|i\s+will)\s+(?:pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|decline(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b))\b/i,
  /* S77-B3 (2026-07-25) — component-noun lookahead; component-pref phrases must not return "decline" */
  /\bnot\s+interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)\b/i,
  /\bi'?m\s+passing\b/i,
  /* STT fragility audit (2026-05-22) — bare negative tokens. Same
   * shape as ACCEPT_PATTERNS bare-affirmatives. */
  /^\s*(?:no|nope|nah|naah|no\s+thanks|no\s+thank\s+you|nahi|nahin|nahi\s+chahiye|bilkul\s+nahi)\s*[.!]?\s*$/i,
];

export function detectTrialCloseResponse(
  candidateText: string | null | undefined,
): "accept" | "decline" | "hedge" | null {
  if (!candidateText || typeof candidateText !== "string") return null;
  const t = candidateText.trim();
  if (!t) return null;
  /* Hedge first — a candidate who says "yes I'd be comfortable IF X"
   * is hedging, not accepting. Hedge patterns must beat accept. */
  if (HEDGE_PATTERNS.some((p) => p.test(t))) return "hedge";
  if (DECLINE_PATTERNS.some((p) => p.test(t))) return "decline";
  if (ACCEPT_PATTERNS.some((p) => p.test(t))) return "accept";
  return null;
}

/* ─── Number-discipline detector ───────────────────────────────────── */

/** Returns true when the bot reply reveals a range (e.g. "between
 *  ₹X and ₹Y", "X-Y LPA"). Used by NUMBER DISCIPLINE rule checks.
 *
 *  Audit Pass 2 Fix A (2026-05-16) — the inline `(?:-|to)` previously
 *  only matched ASCII hyphen, but canonical prose at
 *  `_canonical-prose.ts:361` emits an en-dash (U+2013) in the
 *  `₹{lo}–₹{hi} LPA` band-disclosure template. Result: detector
 *  silently dropped every band disclosure → `rangeDisclosedAtTurn`
 *  never stamped → `derivePhase` range-disclosure exit at
 *  `_negotiation-kernel.ts:2948-2954` permanently blocked. Switched
 *  to the shared `RANGE_DASH_RE` constant which also matches em-dash
 *  for parity with the kernel's current-CTC / target range patterns. */
import { RANGE_DASH_RE } from "./_canonical-prose";

const RANGE_LPA_RE = new RegExp(
  "(?:₹|rs\\.?|inr\\s+)?[\\d.,]+\\s*" + RANGE_DASH_RE.source +
    "\\s*(?:₹|rs\\.?|inr\\s+)?[\\d.,]+\\s*(?:lpa|lakh|l\\b)",
  "i",
);

export function detectRangeDisclosure(botReply: string | null | undefined): boolean {
  if (!botReply || typeof botReply !== "string") return false;
  if (/\bbetween\s+(?:₹|rs\.?|inr\s+)?[\d.,]+\s*(?:l|lpa|lakh|cr|crore|k)?\s+and\s+(?:₹|rs\.?|inr\s+)?[\d.,]+/i.test(botReply)) return true;
  if (RANGE_LPA_RE.test(botReply)) return true;
  if (/\b(?:band|range)\s+(?:typically\s+)?(?:sits|lies|falls|is)\s+(?:between|from)\b/i.test(botReply)) return true;
  if (/\btypical\s+range\s+is\b/i.test(botReply)) return true;
  return false;
}

/* ─── Variable-comfort detector ────────────────────────────────────── */

/** Returns true when the bot reply tests comfort with a variable
 *  component (asks the candidate explicitly about variable %). */
export function detectVariableComfortAsked(botReply: string | null | undefined): boolean {
  if (!botReply || typeof botReply !== "string") return false;
  return (
    /\bhow\s+comfortable\s+are\s+you\s+with\s+.{0,40}\bvariable\b/i.test(botReply) ||
    /\b(?:performance-linked|variable\s+(?:component|comp|payout))\b.{0,80}\bcomfortable\b/i.test(botReply) ||
    /\baverage\s+payout\s+(?:was|is)\b/i.test(botReply)
  );
}

/* ─── Equity-clarity detector ──────────────────────────────────────── */

export interface EquityClarityCoverage {
  includedVsAdditional: boolean;
  vestingSchedule: boolean;
  fmvOrStrike: boolean;
  buybackHistory: boolean;
  allFourCovered: boolean;
}

export function analyzeEquityClarity(
  botReply: string | null | undefined,
): EquityClarityCoverage {
  const t = (botReply ?? "").toString();
  const includedVsAdditional =
    /\b(?:included\s+in|on\s+top\s+of|additional\s+to|part\s+of)\s+(?:the\s+)?(?:headline\s+)?ctc\b/i.test(t) ||
    /\bequity\s+is\s+(?:on\s+top|additional|included|part\s+of\s+ctc)\b/i.test(t);
  const vestingSchedule =
    /\b\d+\s*[-\s]*year\s+vest(?:ing)?\b/i.test(t) ||
    /\bcliff\b/i.test(t) ||
    /\bvest(?:s|ing)?\s+(?:monthly|quarterly|annually)\b/i.test(t);
  const fmvOrStrike =
    /\b(?:fmv|fair\s+market\s+value|strike\s+price|409a|four\s+oh\s+nine\s+a)\b/i.test(t);
  const buybackHistory =
    /\b(?:buyback|tender\s+offer|liquidity\s+(?:event|window|history))\b/i.test(t);
  return {
    includedVsAdditional,
    vestingSchedule,
    fmvOrStrike,
    buybackHistory,
    allFourCovered:
      includedVsAdditional && vestingSchedule && fmvOrStrike && buybackHistory,
  };
}
