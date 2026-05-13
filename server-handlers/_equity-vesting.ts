/* Equity vesting / preference parser — Phase 14 (2026-05-13).
 *
 * The audit (2026-05-13) flagged that the kernel only knew whether
 * equity was on the table (`band.hasEquity`) — it had no state for
 * candidate-side equity literacy: their preference (cash vs equity),
 * the vesting shape they expect, or whether they've held equity before.
 *
 * Note: there's an existing `equityLiteracy.test.ts` that covers a
 * separate concern (candidate-readiness scoring at the evaluation
 * level — measuring whether the candidate understood the equity terms).
 * This module is the KERNEL-side counterpart — it captures what the
 * candidate has SAID about equity during the live negotiation so the
 * AI can frame its counter accordingly.
 *
 * Failure modes this closes:
 *   1. Candidate says "I'd take lower fixed for stronger equity" —
 *      the kernel folded this into the variable bucket of the
 *      component breakdown (wrong: that's a totally different chip)
 *      or lost it entirely.
 *   2. Candidate asks about vesting schedule — the existing
 *      `vest-schedule` info-intent fires, but no state captures the
 *      candidate's stated PREFERENCE ("I want monthly vesting with no
 *      cliff", "4-year is fine, 5-year is too long").
 *   3. Candidate says "I have no ESOPs at current job" — the AI can't
 *      calibrate framing (push hard on upside vs explain mechanics).
 *
 * Patterns are conservative. */

export type EquityPreference =
  /** Candidate prefers cash; equity is incidental. */
  | "cash-pref"
  /** Candidate prefers equity; willing to trade cash for it. */
  | "equity-pref"
  /** Candidate stated a mixed/balanced preference. */
  | "mixed-pref";

export type EquityFamiliarity =
  /** Candidate has held ESOPs/RSUs before. */
  | "experienced"
  /** Candidate is new to equity. */
  | "novice";

export interface EquityVestingResult {
  /** Vesting years candidate stated as preferred or acceptable. Range
   *  1–10 inclusive; 0 means unstated. */
  vestingYears: number | null;
  /** Vesting cliff in months candidate stated. Common values: 0 / 6 / 12. */
  cliffMonths: number | null;
  /** Cash vs equity preference, if explicit. */
  preference: EquityPreference | null;
  /** Has the candidate held equity before? */
  familiarity: EquityFamiliarity | null;
  /** Phase 17E (2026-05-13) — Did the candidate explicitly ask about
   *  strike price / exercise price / 409A FMV? Materially shifts AI
   *  framing: literacy signal + chip for negotiation. */
  strikePriceDiscussed: boolean;
  /** Phase 17E — Did the candidate ask about current company valuation
   *  / last-round price / preferred-share price? Signals sophistication
   *  + dilution awareness. */
  valuationDiscussed: boolean;
  /** Phase 17E — Did the candidate ask about liquidity events,
   *  secondaries, tender offers, or IPO timeline? Often paired with
   *  valuation; signals exit-aware framing. */
  liquidityDiscussed: boolean;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: EquityVestingResult = {
  vestingYears: null,
  cliffMonths: null,
  preference: null,
  familiarity: null,
  strikePriceDiscussed: false,
  valuationDiscussed: false,
  liquidityDiscussed: false,
  hasAny: false,
};

const VEST_YEAR_PATTERNS = [
  /\b(\d{1,2})\s*[-\s]?\s*(?:year|yr|years|yrs)\s+vest(?:ing)?\b/i,
  /\bvest(?:ing)?\s+(?:over|of|for)\s+(\d{1,2})\s*(?:year|yr|years|yrs)\b/i,
  /\bvest(?:ing)?\s+(?:schedule|period)\s+(?:of|is)?\s*(\d{1,2})\s*(?:year|yr|years|yrs)\b/i,
];

const CLIFF_MONTH_PATTERNS = [
  /\b(\d{1,2})[-\s]?\s*(?:month|mo|months|mos)\s+cliff\b/i,
  /\bcliff\s+(?:of|is)\s+(\d{1,2})\s*(?:month|mo|months|mos)\b/i,
];

const CLIFF_YEAR_PATTERNS = [
  /\b(?:1|one|a)[-\s]?\s*(?:year|yr)\s+cliff\b/i,
];

const PREF_PATTERNS: { kind: EquityPreference; pattern: RegExp }[] = [
  {
    kind: "cash-pref",
    pattern: /\b(?:prefer(?:s|red)?\s+cash|cash\s+over\s+equity|rather\s+have\s+cash|cash\s+is\s+more\s+important|don.?t\s+(?:value|care\s+about)\s+(?:equity|esops?|rsus?)|no\s+esops?|skip\s+(?:the\s+)?equity)\b/i,
  },
  {
    kind: "equity-pref",
    pattern: /\b(?:prefer(?:s|red)?\s+equity|equity\s+over\s+cash|lower\s+fixed\s+(?:for|with)\s+(?:more|higher|strong(?:er)?)\s+(?:equity|esops?|rsus?)|happy\s+(?:to\s+)?(?:take|trade)\s+(?:lower|less)\s+(?:cash|fixed)|trade\s+cash\s+for\s+equity|equity\s+heavy|long[-\s]?term\s+upside)\b/i,
  },
  {
    kind: "mixed-pref",
    pattern: /\b(?:mix\s+of\s+cash\s+and\s+equity|balance(?:d)?\s+(?:between|of)\s+cash\s+and\s+equity|both\s+cash\s+and\s+equity|fair\s+mix|reasonable\s+mix)\b/i,
  },
];

const FAMILIARITY_PATTERNS: { kind: EquityFamiliarity; pattern: RegExp }[] = [
  {
    kind: "experienced",
    pattern: /\b(?:i.?ve\s+had\s+(?:esops?|rsus?|equity)|previously\s+(?:had|held|received)\s+(?:esops?|rsus?|equity)|currently\s+(?:have|hold)\s+(?:esops?|rsus?|equity)|exercised\s+(?:my\s+)?(?:options?|esops?)|liquidat(?:ed|ion)\s+event|vested\s+(?:my\s+)?(?:options?|esops?|rsus?))\b/i,
  },
  {
    kind: "novice",
    pattern: /\b(?:never\s+had\s+(?:esops?|rsus?|equity)|no\s+experience\s+with\s+(?:esops?|rsus?|equity)|first\s+time\s+(?:with|getting)\s+(?:esops?|equity)|new\s+to\s+(?:esops?|equity)|don.?t\s+understand\s+(?:esops?|equity|vesting))\b/i,
  },
];

export function extractEquityVesting(text: string): EquityVestingResult {
  if (!text) return EMPTY;

  let vestingYears: number | null = null;
  for (const p of VEST_YEAR_PATTERNS) {
    const m = p.exec(text);
    if (m) {
      const y = parseInt(m[1], 10);
      if (Number.isFinite(y) && y >= 1 && y <= 10) {
        vestingYears = y;
        break;
      }
    }
  }

  let cliffMonths: number | null = null;
  for (const p of CLIFF_MONTH_PATTERNS) {
    const m = p.exec(text);
    if (m) {
      const c = parseInt(m[1], 10);
      if (Number.isFinite(c) && c >= 0 && c <= 36) {
        cliffMonths = c;
        break;
      }
    }
  }
  /* "1-year cliff" → 12 months */
  if (cliffMonths == null && CLIFF_YEAR_PATTERNS.some((p) => p.test(text))) {
    cliffMonths = 12;
  }

  let preference: EquityPreference | null = null;
  for (const { kind, pattern } of PREF_PATTERNS) {
    if (pattern.test(text)) {
      preference = kind;
      break;
    }
  }

  let familiarity: EquityFamiliarity | null = null;
  for (const { kind, pattern } of FAMILIARITY_PATTERNS) {
    if (pattern.test(text)) {
      familiarity = kind;
      break;
    }
  }

  const strikePriceDiscussed = /\b(?:strike\s+price|exercise\s+price|409a|fmv|fair\s+market\s+value|grant\s+price)\b/i.test(text);
  const valuationDiscussed = /\b(?:current\s+valuation|company\s+valuation|last[-\s]?round|preferred[-\s]?share\s+price|post[-\s]?money|pre[-\s]?money|series\s+[a-h]\s+(?:price|valuation)|cap\s+table|dilution)\b/i.test(text);
  const liquidityDiscussed = /\b(?:liquidity\s+(?:event|window)|secondary\s+(?:sale|market|tender)|tender\s+offer|ipo\s+(?:timeline|date|plan)|exit\s+(?:strategy|plan|event)|acquisition\s+(?:plan|trigger))\b/i.test(text);

  const hasAny =
    vestingYears != null ||
    cliffMonths != null ||
    preference != null ||
    familiarity != null ||
    strikePriceDiscussed ||
    valuationDiscussed ||
    liquidityDiscussed;
  return {
    vestingYears,
    cliffMonths,
    preference,
    familiarity,
    strikePriceDiscussed,
    valuationDiscussed,
    liquidityDiscussed,
    hasAny,
  };
}

export function mergeEquityVesting(
  prior: EquityVestingResult | null | undefined,
  next: EquityVestingResult,
): EquityVestingResult {
  const p = prior ?? EMPTY;
  const merged: EquityVestingResult = {
    vestingYears: next.vestingYears ?? p.vestingYears,
    cliffMonths: next.cliffMonths ?? p.cliffMonths,
    preference: next.preference ?? p.preference,
    familiarity: next.familiarity ?? p.familiarity,
    strikePriceDiscussed: p.strikePriceDiscussed || next.strikePriceDiscussed,
    valuationDiscussed: p.valuationDiscussed || next.valuationDiscussed,
    liquidityDiscussed: p.liquidityDiscussed || next.liquidityDiscussed,
    hasAny: false,
  };
  merged.hasAny =
    merged.vestingYears != null ||
    merged.cliffMonths != null ||
    merged.preference != null ||
    merged.familiarity != null ||
    merged.strikePriceDiscussed ||
    merged.valuationDiscussed ||
    merged.liquidityDiscussed;
  return merged;
}
