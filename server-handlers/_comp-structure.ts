/* Comp-structure detectors — Phase 22 (2026-05-13).
 * ─────────────────────────────────────────────────────────────────────
 * Phases 1–21 modelled the canonical India IC compensation shape:
 * fixed base + variable + equity + joining bonus. That covers ~80%
 * of SWE / product / data hiring conversations but breaks down on:
 *
 *   - SALES roles. Comp is "OTE" (On-Target Earnings) = base + at-
 *     target commission. The variable component is QUOTA-driven, not
 *     performance-rating-driven; payout depends on attainment %.
 *     Candidates routinely quote OTE as if it were guaranteed cash,
 *     and rarely know their last-cycle attainment %.
 *
 *   - CONTRACT / freelance. Comp is a day rate (₹10K/day) or a
 *     monthly retainer (₹3L/month). Annualising naively ("₹10K × 250
 *     working days = ₹25L FTE-equivalent") ignores bench time,
 *     unpaid vacation, benefits absence (no PF, gratuity, group
 *     health), and tax differences (33% effective vs ~28% FTE).
 *     Candidates moving FTE↔contract regularly conflate these.
 *
 * Phase 22 adds two pure detectors that the red-flag layer calls
 * directly from the candidate's utterance. We deliberately do NOT
 * fold these into NegotiationState yet — they're utterance-grade
 * signals, not stateful facts. If/when a downstream module needs
 * stickiness across turns, the parsers can be promoted to merge-able
 * results following the existing pattern. */

export interface SalesOTEResult {
  /** Candidate stated an OTE figure (total on-target). LPA. */
  oteAmount: number | null;
  /** Candidate stated a base figure inside an OTE context. LPA. */
  baseAmount: number | null;
  /** Candidate quoted their last-cycle attainment %, e.g. "I hit 110% last year". */
  attainmentPct: number | null;
  /** Candidate quoted OTE as if it were guaranteed ("my package is
   *  ₹40L OTE" treated identically to "₹40L fixed"). True when OTE is
   *  stated but no attainment / variable distinction is mentioned. */
  quotesOteAsGuaranteed: boolean;
  hasAny: boolean;
}

export interface ContractRateResult {
  /** Day rate in INR per day (e.g. 10000 for ₹10K/day). */
  dayRate: number | null;
  /** Monthly retainer in INR. */
  monthlyRetainer: number | null;
  /** Candidate stated a billable utilization figure ("I bill 18 days/month",
   *  "85% utilization"). null when not mentioned. */
  utilizationPct: number | null;
  /** Candidate computed an annual figure from day rate WITHOUT discussing
   *  utilization / bench. Heuristic: day rate stated + annual figure
   *  stated, no utilization figure, and annual ≈ dayRate × {250..260}. */
  dayRateAsAnnualConfusion: boolean;
  hasAny: boolean;
}

/* ── Sales OTE patterns ──────────────────────────────────────────── */

/* "OTE of ₹40L", "₹40L OTE", "₹40L on-target", "on-target earnings of
 * ₹40L", "OTI ₹35L" (Indian variant — On-Target Incentive). Numbers
 * are LPA scale (we accept "₹40L", "40 LPA", "40 lakhs"). */
const OTE_PATTERN =
  /\b(?:ote|oti|on[-\s]?target\s+(?:earnings?|incentive|comp(?:ensation)?))\s+(?:of\s+)?₹?\s*(\d+(?:\.\d+)?)\s*(?:l(?:akhs?)?|lpa|lacs?)\b/i;
const OTE_PATTERN_REVERSE =
  /\b₹?\s*(\d+(?:\.\d+)?)\s*(?:l(?:akhs?)?|lpa|lacs?)\s+(?:ote|oti|on[-\s]?target(?:\s+(?:earnings?|incentive))?)\b/i;

/* "base of ₹25L", "₹25L base" — used to find the base inside an OTE
 * conversation. We only use this when an OTE figure was also detected. */
const OTE_BASE_PATTERN =
  /\b(?:base|fixed)\s+(?:of|is|at)?\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:l(?:akhs?)?|lpa|lacs?)\b/i;
const OTE_BASE_PATTERN_REVERSE =
  /\b₹?\s*(\d+(?:\.\d+)?)\s*(?:l(?:akhs?)?|lpa|lacs?)\s+(?:base|fixed)\b/i;

/* Attainment: "hit 110% last year", "120% attainment", "achieved 95%
 * of quota", "85% to plan". */
const ATTAINMENT_PATTERN =
  /\b(?:hit|achieved|delivered|came\s+in\s+at|at|attainment\s+of|attainment\s+was|to\s+(?:plan|quota|target))\s*(\d{1,3})\s*%/i;
const ATTAINMENT_PATTERN_REVERSE =
  /\b(\d{1,3})\s*%\s+(?:attainment|to\s+(?:plan|quota|target)|of\s+(?:plan|quota|target))\b/i;

function detectSalesOTE(text: string): SalesOTEResult {
  const empty: SalesOTEResult = {
    oteAmount: null,
    baseAmount: null,
    attainmentPct: null,
    quotesOteAsGuaranteed: false,
    hasAny: false,
  };
  if (!text) return empty;

  const oteMatch = OTE_PATTERN.exec(text) ?? OTE_PATTERN_REVERSE.exec(text);
  const oteAmount = oteMatch ? parseFloat(oteMatch[1]) : null;

  /* Only look for base + attainment when OTE was detected — otherwise
   * a plain "base ₹25L" mention from an SWE conversation would false-
   * fire as a sales structure. */
  let baseAmount: number | null = null;
  let attainmentPct: number | null = null;
  if (oteAmount != null) {
    const baseMatch = OTE_BASE_PATTERN.exec(text) ?? OTE_BASE_PATTERN_REVERSE.exec(text);
    if (baseMatch) baseAmount = parseFloat(baseMatch[1]);
    const attMatch = ATTAINMENT_PATTERN.exec(text) ?? ATTAINMENT_PATTERN_REVERSE.exec(text);
    if (attMatch) {
      const pct = parseInt(attMatch[1], 10);
      if (pct >= 0 && pct <= 200) attainmentPct = pct;
    }
  }

  /* Red flag: candidate quotes OTE without acknowledging the base/
   * variable split OR their attainment. This is the "OTE treated as
   * guaranteed cash" pattern. */
  const quotesOteAsGuaranteed =
    oteAmount != null && baseAmount == null && attainmentPct == null;

  return {
    oteAmount,
    baseAmount,
    attainmentPct,
    quotesOteAsGuaranteed,
    hasAny: oteAmount != null || baseAmount != null || attainmentPct != null,
  };
}

/* ── Contract day-rate patterns ──────────────────────────────────── */

/* "₹10K/day", "₹10,000 per day", "10K/day", "10K per day", "Rs 10000
 * per day". K shorthand multiplies by 1000; bare numbers must be ≥
 * 500 (₹500/day = part-time intern minimum) to filter out noise. */
const DAY_RATE_PATTERN =
  /\b(?:₹|rs\.?|inr)?\s*(\d+(?:[,.]\d+)?)\s*(k|thousand)?\s*(?:\/|\s+per\s+)\s*day\b/i;

/* "₹3L/month retainer", "₹3 lakhs per month", "monthly retainer of ₹3L". */
const MONTHLY_RETAINER_PATTERN =
  /\b(?:monthly\s+retainer\s+(?:of\s+)?₹?|₹|retainer\s+of\s+₹?)\s*(\d+(?:\.\d+)?)\s*(l(?:akhs?)?|lpa|k|thousand)?\s*(?:\/|per\s+)?\s*(?:month|mo|pm)?\b/i;

/* "I bill 20 days/month", "85% utilization", "billed 220 days last
 * year", "utilization of 85%". Both orders supported — we just need
 * to know the candidate THOUGHT about utilization. */
const UTILIZATION_PATTERN_FWD =
  /\b(?:bill(?:ed|ing)?|billable|utilization|util)\s*(?:at\s+|of\s+)?(\d{1,3})\s*(%|days?\s*(?:\/|\s+per\s+)\s*(?:month|year|mo|yr))/i;
const UTILIZATION_PATTERN_REV =
  /\b(\d{1,3})\s*(%|days?\s*(?:\/|\s+per\s+)\s*(?:month|year|mo|yr))\s+(?:bill(?:ed|ing|able)?|utilization|util)\b/i;

/* "₹25L annual", "₹25L LPA" — used inside a day-rate conversation to
 * detect the FTE-confusion pattern. */
const ANNUAL_LPA_PATTERN =
  /\b₹?\s*(\d+(?:\.\d+)?)\s*(?:l(?:akhs?)?|lpa|lacs?)\s+(?:annual|per\s+(?:year|annum)|annually|p\.?a\.?)\b/i;

function parseDayRate(value: string, suffix: string | undefined): number | null {
  const n = parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (suffix && /^(?:k|thousand)$/i.test(suffix)) return n * 1000;
  /* Bare number — must look like a realistic day rate. */
  if (n >= 500 && n <= 200_000) return n;
  return null;
}

function detectContractRate(text: string): ContractRateResult {
  const empty: ContractRateResult = {
    dayRate: null,
    monthlyRetainer: null,
    utilizationPct: null,
    dayRateAsAnnualConfusion: false,
    hasAny: false,
  };
  if (!text) return empty;

  const dayMatch = DAY_RATE_PATTERN.exec(text);
  const dayRate = dayMatch ? parseDayRate(dayMatch[1], dayMatch[2]) : null;

  const retainerMatch = MONTHLY_RETAINER_PATTERN.exec(text);
  let monthlyRetainer: number | null = null;
  if (retainerMatch) {
    const n = parseFloat(retainerMatch[1].replace(/,/g, ""));
    const unit = (retainerMatch[2] || "").toLowerCase();
    if (Number.isFinite(n)) {
      if (unit.startsWith("l")) monthlyRetainer = n * 100_000;
      else if (unit.startsWith("k") || unit === "thousand") monthlyRetainer = n * 1000;
      else if (n >= 10_000) monthlyRetainer = n;
    }
  }

  const utilMatch =
    UTILIZATION_PATTERN_FWD.exec(text) ?? UTILIZATION_PATTERN_REV.exec(text);
  let utilizationPct: number | null = null;
  if (utilMatch) {
    const v = parseInt(utilMatch[1], 10);
    const unitFragment = utilMatch[2] ?? "";
    /* If the unit is "%", v is the percentage directly. If "days/month",
     * convert to a rough percent (out of ~22 working days). If
     * "days/year", out of ~240 working days. */
    if (/%/.test(unitFragment)) utilizationPct = v;
    else if (/month|mo/i.test(unitFragment)) utilizationPct = Math.round((v / 22) * 100);
    else if (/year|yr/i.test(unitFragment)) utilizationPct = Math.round((v / 240) * 100);
  }

  /* FTE confusion: candidate stated a day rate AND an annual LPA
   * figure on the same turn, did NOT mention utilization, and the
   * annual figure is consistent with ~250 working days × day rate
   * (within 15% tolerance — accounts for rough math). */
  let dayRateAsAnnualConfusion = false;
  if (dayRate != null && utilizationPct == null) {
    const annualMatch = ANNUAL_LPA_PATTERN.exec(text);
    if (annualMatch) {
      const statedAnnualLpa = parseFloat(annualMatch[1]);
      const impliedAnnualLpa = (dayRate * 250) / 100_000;
      if (Math.abs(statedAnnualLpa - impliedAnnualLpa) / impliedAnnualLpa < 0.15) {
        dayRateAsAnnualConfusion = true;
      }
    }
  }

  return {
    dayRate,
    monthlyRetainer,
    utilizationPct,
    dayRateAsAnnualConfusion,
    hasAny: dayRate != null || monthlyRetainer != null || utilizationPct != null,
  };
}

/* ── Public API ──────────────────────────────────────────────────── */

export function extractSalesOTE(text: string): SalesOTEResult {
  return detectSalesOTE(text);
}

export function extractContractRate(text: string): ContractRateResult {
  return detectContractRate(text);
}
