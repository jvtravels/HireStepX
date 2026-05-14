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
  /^\s*yes\s*[.!]?\s*$/i,
];

const DECLINE_PATTERNS: RegExp[] = [
  /\b(?:no|nope)[,.]?\s+i\s+(?:can'?t|cannot|won'?t)\s+(?:accept|do\s+this)\b/i,
  /\bi(?:'?m|\s+am)?\s+(?:going\s+to\s+)?(?:pass|decline|not\s+interested)\b/i,
  /\b(?:i'?ll|i\s+will)\s+(?:pass|decline)\b/i,
  /\bnot\s+interested\b/i,
  /\bi'?m\s+passing\b/i,
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
 *  ₹X and ₹Y", "X-Y LPA"). Used by NUMBER DISCIPLINE rule checks. */
export function detectRangeDisclosure(botReply: string | null | undefined): boolean {
  if (!botReply || typeof botReply !== "string") return false;
  if (/\bbetween\s+(?:₹|rs\.?|inr\s+)?[\d.,]+\s*(?:l|lpa|lakh|cr|crore|k)?\s+and\s+(?:₹|rs\.?|inr\s+)?[\d.,]+/i.test(botReply)) return true;
  if (/(?:₹|rs\.?|inr\s+)?[\d.,]+\s*(?:-|to)\s*(?:₹|rs\.?|inr\s+)?[\d.,]+\s*(?:lpa|lakh|l\b)/i.test(botReply)) return true;
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
