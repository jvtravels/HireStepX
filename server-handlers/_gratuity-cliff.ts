/**
 * Gratuity-cliff helpers.
 *
 * Under the Indian Payment of Gratuity Act, an employee qualifies for
 * gratuity only after 4 years 240 days (effectively 5 years) of continuous
 * service. A common Indian negotiation pattern: the candidate is 6-18
 * months short of the cliff and asks the new employer to cover the
 * lost-gratuity equivalent as part of the joining bonus.
 *
 * Pure helpers; no I/O. */

const GRATUITY_CLIFF_PATTERNS: ReadonlyArray<RegExp> = [
  /\bgratuity\s+(?:cliff|gap|buyout|cover|equivalent)\b/i,
  /\b(?:short|missing)\s+\d+\s+(?:months?|mos?)\s+(?:for|to)\s+gratuity\b/i,
  /\b(?:i'?ll|i\s+will)\s+(?:lose|forfeit)\s+(?:my\s+)?gratuity\b/i,
  /\bnot\s+(?:yet|quite)\s+(?:4\.5|5)\s+years?\b/i,
  /\bcompletion\s+of\s+5\s+years?\s+(?:of\s+)?(?:service|tenure)\b/i,
];

/** Returns true if the utterance carries a gratuity-cliff ask signal. */
export function detectGratuityCliffAsk(text: string): boolean {
  if (!text) return false;
  for (const re of GRATUITY_CLIFF_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

/** Compute the gratuity equivalent (₹, not LPA) for a given monthly basic
 *  and months of service completed.
 *
 *  Statutory formula: gratuity = (last drawn basic) × 15/26 × (years of
 *  service rounded). We compute the *unpaid equivalent* a buyout would
 *  cover, i.e. the value that would accrue if the candidate completed the
 *  cliff. Returns 0 for monthlyBasic <= 0 or monthsServed <= 0. Pure. */
export function computeGratuityEquivalent(
  monthlyBasic: number,
  monthsServed: number,
): number {
  if (!Number.isFinite(monthlyBasic) || !Number.isFinite(monthsServed)) return 0;
  if (monthlyBasic <= 0 || monthsServed <= 0) return 0;
  const yearsRounded = Math.max(1, Math.round(monthsServed / 12));
  const amount = monthlyBasic * (15 / 26) * yearsRounded;
  return Math.round(amount);
}
