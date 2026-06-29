/* Pure helpers for the immediate post-session Deal Summary card
 * (InterviewNegotiationPanels → DealSummaryCard). Extracted so the
 * transcript-parsing logic is unit-testable without rendering the component
 * (negotiationDealSummary.test.ts) and to keep the component file free of
 * non-component exports. */

/* ─── Candidate-ask extraction ───
 *
 * The immediate post-session card has no access to the kernel's
 * `candidateAskLpa` (that figure lives in the interview engine's save
 * payload, not exposed to the view; the persisted SessionDetail report uses
 * the kernel value directly). So the card must infer the candidate's STATED
 * ask from their transcript turns. The naive "max of every salary-suffixed
 * number in the candidate's turns" over-counts: it picks up the candidate's
 * CURRENT CTC ("currently at 46L") and echoed OFFER figures ("if you close at
 * 52.3 fixed, that works") and MISSES unit-less asks ("closer to 65"). Live
 * Flipkart-EM session: real ask was ₹65 but the card showed ₹52.3 (the echoed
 * offer). This extracts only numbers in an explicit ASK context (immediately
 * after an ask cue), skips echoed-offer clauses, and allows unit-less figures.
 * Current-CTC clauses self-exclude — they carry no ask cue so nothing matches.
 * Returns 0 when no genuine ask is found (the card then hides the "Your Ask"
 * tile). */
const ASK_CUE_SRC =
  "(?:expect\\w*|looking\\s+for|look\\s+at|want\\w*|targeting|target|" +
  "hoping\\s+for|hope\\s+for|aiming\\s+for|aim\\s+for|asking\\s+for|" +
  "my\\s+ask\\s+is|ask\\s+is|push\\s+(?:it\\s+)?to|bump\\s+(?:it\\s+)?to|" +
  "get\\s+(?:me\\s+)?to|closer\\s+to|somewhere\\s+around|" +
  "in\\s+the\\s+range\\s+of|range\\s+of|at\\s+least|north\\s+of|" +
  "ideally|shooting\\s+for|comfortable\\s+at)";
/* Echoed-offer clauses restate the company's number back ("if you close at
 * 52.3, that works") — never the candidate's own ask. */
const ECHO_OFFER_RE =
  /your\s+offer|you\s+offered|you\s+can\s+close|if\s+you\s+(?:can\s+)?close|lock\s+it|that\s+works\s+for\s+me/i;
const ASK_NUM_SRC =
  ASK_CUE_SRC +
  "\\s*(?:for|to|at|around|about|a|of|roughly|like)?\\s*" +
  "\\u20B9?\\s*(\\d+(?:[,.]\\d+)*)(?:\\s*[-\\u2013]\\s*(\\d+(?:[,.]\\d+)*))?" +
  "\\s*(lpa|lakhs?|[lL]\\b|crores?|cr\\b)?";

export function extractCandidateAskLpa(userTexts: string[]): number {
  const parse = (raw: string, suffix?: string): number => {
    const num = parseFloat(raw.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return 0;
    if (suffix && /crore|cr/i.test(suffix)) return num * 100;
    // Raw rupee amounts (Indian format 56,00,000 or 5600000) → LPA.
    if (num >= 100000) return Math.round((num / 100000) * 10) / 10;
    return num; // already in lakhs (suffixed or unit-less ask)
  };
  let best = 0;
  for (const text of userTexts) {
    // Split on sentence punctuation only — a bare "." that sits between
    // digits (a decimal, e.g. "1.2 crore") must NOT break the clause. This
    // also stops a CTC / echoed-offer clause from suppressing a sibling ask.
    for (const clause of text.split(/[!?;]+|\.(?=\s|$)/)) {
      if (ECHO_OFFER_RE.test(clause)) continue;
      const re = new RegExp(ASK_NUM_SRC, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(clause)) !== null) {
        const lo = parse(m[1], m[3]);
        const hi = m[2] ? parse(m[2], m[3]) : 0;
        const val = Math.max(lo, hi); // range "56-57" → upper bound
        // Plausible LPA ask is ~1..500; rejects years / percentages that
        // might slip past the cue.
        if (val >= 1 && val <= 500) best = Math.max(best, val);
      }
    }
  }
  return best;
}
