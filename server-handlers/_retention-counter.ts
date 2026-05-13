/* Retention-counter detector — Phase 27 (2026-05-13).
 * ─────────────────────────────────────────────────────────────────────
 * In Indian hiring, once a candidate communicates resignation intent
 * their CURRENT employer routinely makes a "retention counter" —
 * matching or exceeding the new offer to keep them. The dynamic is
 * well-studied: ~80% of candidates who accept a retention counter
 * leave within 6 months anyway (trust is broken on the manager side).
 *
 * For the negotiation kernel this matters because:
 *   1. A retention counter materially weakens the new-employer's
 *      leverage (they now have to beat TWO numbers).
 *   2. It signals to the recruiter that the candidate's "exit story"
 *      is no longer purely growth-driven — current employer values
 *      them enough to pay to keep them.
 *   3. The red-flag layer warns the candidate about the counter-trap.
 *
 * Pure stateful parser, merge-able across turns. */

export interface RetentionCounterResult {
  /** Stated retention-counter amount in LPA. */
  amountLpa: number | null;
  /** Candidate explicitly said they declined the retention counter. */
  declined: boolean;
  /** Convenience flag. */
  hasAny: boolean;
}

export const EMPTY_RETENTION_COUNTER: RetentionCounterResult = {
  amountLpa: null,
  declined: false,
  hasAny: false,
};

/* "My current company is counter-offering ₹35L", "they're offering me
 * a retention bonus", "current employer matched my new offer". */
const RETENTION_TRIGGER = /\b(?:retention\s+(?:offer|counter|bonus|package)|counter[-\s]?offer(?:ing)?\s+from\s+(?:my\s+)?current|current\s+(?:employer|company|manager)\s+(?:is\s+)?(?:counter[-\s]?offer(?:ing)?|matching|offering\s+(?:me\s+)?(?:a\s+)?(?:retention|match|counter)|wants\s+to\s+retain)|asked\s+(?:me\s+)?to\s+stay|trying\s+to\s+retain\s+me)\b/i;

const RETENTION_AMOUNT = /(?:counter|retention|match(?:ing)?|stay|retain)[^.\n]{0,40}?[₹rs.]*\s*(\d+(?:[.,]\d+)?)\s*(?:l|lpa|lakhs?|cr|crore)?\b/i;

const DECLINED_PATTERNS = [
  /\b(?:declined|rejected|turned\s+down|said\s+no\s+to|refused)\s+(?:the\s+)?(?:retention|counter|match)\b/i,
  /\b(?:not\s+going\s+to\s+take|won'?t\s+(?:take|accept))\s+(?:the\s+)?(?:retention|counter|match)\b/i,
];

export function extractRetentionCounter(text: string): RetentionCounterResult {
  if (!text) return { ...EMPTY_RETENTION_COUNTER };
  if (!RETENTION_TRIGGER.test(text)) return { ...EMPTY_RETENTION_COUNTER };
  let amountLpa: number | null = null;
  const a = RETENTION_AMOUNT.exec(text);
  if (a) {
    const v = parseFloat(a[1].replace(",", "."));
    if (Number.isFinite(v) && v >= 1 && v <= 500) amountLpa = v;
  }
  const declined = DECLINED_PATTERNS.some((p) => p.test(text));
  return { amountLpa, declined, hasAny: true };
}

export function mergeRetentionCounter(
  prior: RetentionCounterResult | null | undefined,
  next: RetentionCounterResult,
): RetentionCounterResult {
  const p = prior ?? EMPTY_RETENTION_COUNTER;
  /* Once a retention counter is on the table, the recruiter never
   * "forgets" — both flags are monotone-up. Amount is last-stated-wins. */
  const merged: RetentionCounterResult = {
    amountLpa: next.amountLpa ?? p.amountLpa,
    declined: p.declined || next.declined,
    hasAny: p.hasAny || next.hasAny,
  };
  return merged;
}
