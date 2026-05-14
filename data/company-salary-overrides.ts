/**
 * Company-specific salary overrides.
 *
 * The base salary lookup keys on (role × tier × experience-level), so
 * "Razorpay" and "PhonePe" both get the same `indian-unicorn × pm × mid`
 * band even though their actual market data differs by 30%+. This file
 * fixes that mismatch for the highest-traffic companies — when a verified
 * band is available from public sources (Levels.fyi / AmbitionBox /
 * Glassdoor / DRHP filings), we use it instead of the tier default.
 *
 * The lookup flow (in salary-lookup.ts):
 *   1. Direct override match (this file) → return verified band.
 *   2. Tier-default match (salaries.ts) → return generic band.
 *   3. Fallback by experience level → return conservative band.
 *
 * Override format mirrors SalaryEntry (base / variable / equity / total)
 * but keyed by company. A partial entry (e.g. only `mid` provided) falls
 * back to the tier band for missing experience levels.
 *
 * Sources cited per entry. Refresh quarterly. Stamp `lastVerified`.
 */

import type { ExperienceLevel } from "./salaries";
import { classifyCompanyType } from "./company-guidance";
import { getCompanyTier } from "./company-tiers";
import { getCsvDerivedBandOverride, getCsvBandOnly } from "./csv-derived-fallbacks";
import { IMPORTED_SALARY_OVERRIDES } from "./_imported-salary-overrides.generated";
import {
  extractSampleSize,
  isSeedSource,
  shouldFlipToImported,
} from "./_salary-source-helpers";

/** Stamp every IMPORTED_SALARY_OVERRIDES hit as research-aggregated so the
 *  negotiation prompt + UI hedge to the lower half of the band. Also
 *  tiers the confidence by the AB sample size so the LLM can talk more
 *  assertively about high-n cells (Tier A: ≥1000) and hedge harder on
 *  low-n cells (Tier C: <250). See dataConfidenceTier docstring. */
function tagImported(band: CompanyBandOverride): CompanyBandOverride {
  if (band.dataConfidence) return band;
  const n = extractSampleSize(band.notes);
  const tier: "high" | "medium" | "low" =
    n >= 1000 ? "high" : n >= 250 ? "medium" : "low";
  return { ...band, dataConfidence: "research-aggregated", dataConfidenceTier: tier };
}

/** Stamp seed-dataset multiplier cells as low-confidence
 *  research-aggregated. Without this they fall through to the
 *  "verified" branch in salary-lookup.ts and the LLM is told the
 *  numbers are authoritative — they're not, they're tier × multiplier
 *  × baseline guesses with no empirical grounding. The ~850 such cells
 *  span 80+ companies (paytm/freshworks/nykaa/zomato/salesforce/...)
 *  and represent the long-tail roles AB never scraped (ux-designer,
 *  ml-engineer, sales, customer-success, business-analyst non-mid).
 *  Low tier triggers the "directional only, validate with recruiter"
 *  calibration block. */
function tagSeedSynthetic(band: CompanyBandOverride): CompanyBandOverride {
  if (band.dataConfidence) return band;
  if (!isSeedSource(band.source)) return band;
  return { ...band, dataConfidence: "research-aggregated", dataConfidenceTier: "low" };
}

export function maybePreferImportedOverSeed(
  curator: CompanyBandOverride,
  companyKey: string,
  roleKey: string,
  experienceLevel: ExperienceLevel,
): CompanyBandOverride | null {
  const imported = pickLevelInRoleMap(IMPORTED_SALARY_OVERRIDES[companyKey]?.[roleKey], experienceLevel);
  if (!imported) return null;
  const flip = shouldFlipToImported({
    curatorSource: curator.source,
    scrapedNotes: imported.notes,
    company: companyKey,
    role: roleKey,
    level: experienceLevel,
  });
  return flip ? tagImported(imported) : null;
}

/** Subset of SalaryEntry — the fields a company-band override needs. */
export interface CompanyBandOverride {
  /** Total CTC range in LPA, post-adjustment. The lookup uses these
   *  as authoritative; ignore tier band for this company. */
  totalMin: number;
  totalMax: number;
  /** Optional separate base band; if absent, derive 75% of total. */
  baseMin?: number;
  baseMax?: number;
  /** Equity annual value range. 0 / 0 = no equity. */
  equityMin?: number;
  equityMax?: number;
  /** Equity type for the LLM-facing description. */
  equityType?: "rsu" | "esop" | "none";
  equityVesting?: string;
  /** Confidence + freshness. */
  source: string;
  lastVerified: string;
  /** Optional negotiation hint specific to this company. */
  notes?: string;

  /** Data-confidence tier. Drives a calibration sentence in the LLM
   *  negotiation prompt + a UI hedging label.
   *    - "verified": curator-authored, hand-checked against ≥1 source.
   *      Treat numbers as authoritative.
   *    - "research-aggregated": synthesized from the 100-company CSV
   *      scrape. Internal calibration audit (scripts/csv-confidence-
   *      audit.mts, 2026-05-09) shows this dataset agrees with curator
   *      numbers within ±15% on only 48% of overlapping cells, with a
   *      systematic upward bias of ~1.3-1.5× on premium-track service
   *      companies (TCS Digital, Capgemini Strategic) and senior DevOps
   *      roles. The LLM is instructed to coach candidates to anchor
   *      first-offer expectations at the LOWER half of the band.
   *  Defaults to "verified" when unset (curator entries omit it). */
  dataConfidence?: "verified" | "research-aggregated";

  /** When dataConfidence is "research-aggregated", indicates the
   *  AmbitionBox sample-size tier:
   *    - "high":   n ≥ 1000  (TCS, Infosys, Wipro, Google, etc.) →
   *                LLM treats numbers near-authoritatively, light hedge.
   *    - "medium": 250 ≤ n < 1000  (default) → standard hedge to
   *                lower half of band.
   *    - "low":    n < 250  (long-tail companies) → strong hedge:
   *                "directional estimate, verify with recruiter".
   *  Used by salary-lookup to vary the CALIBRATION block in the LLM
   *  negotiation prompt. Unset for "verified" entries. */
  dataConfidenceTier?: "high" | "medium" | "low";

  /* ─── Optional company-specific overrides (Phase C — robustness work) ───
   *
   * Each field below lets a curator encode a company-specific datum that
   * differs from the tier default. Leave undefined to fall through to the
   * tier-aware helpers (getVariablePct, getNoticeBuyoutContext, etc.) in
   * salary-lookup.ts. Setting a value SHORT-CIRCUITS the tier default for
   * that field for this company. */

  /** Override the tier-default variable-bonus % of CTC.
   *  Use when a company's bonus structure differs materially from its
   *  tier's average — e.g. CRED (no bonus, all base+ESOP), Goldman India
   *  (40%+ at senior, vs bfsi-global 22% default). */
  variablePctOverride?: number;

  /** Override the tier-default joining-bonus authority range.
   *  E.g. Wipro IT services: rare exceptions to the no-bonus rule for
   *  niche skills; Razorpay: ₹2-5 LPA standard for senior+. */
  joiningBonusOverride?: [number, number];

  /** Company-specific notice-period in days. TCS=90, Google=60,
   *  Razorpay=30. Lets the LLM quote the right number when the
   *  candidate asks "how soon can you close this?". */
  noticePeriodDays?: number;

  /** Override the tier-default 13th-month / festive-bonus flag.
   *  E.g. some unicorns started Diwali bonuses (CRED has done it);
   *  some FMCG firms have removed them. */
  hasFestiveBonus?: boolean;

  /** Concrete recent-buyback note ("Razorpay 6 buybacks since 2018,
   *  latest mid-2024 at $12B implied valuation"). Replaces the generic
   *  tier-aware buyback context. Update with each new buyback round. */
  recentBuybackNote?: string;

  /** Whether the company has a meaningful onsite-deputation track.
   *  Default true for it-services; explicit override for non-services
   *  cos with onsite (Wipro digital, Cognizant onshore, some GCC). */
  hasDeputation?: boolean;

  /** Bond / service-agreement penalty in LPA. TCS=0.5, Infosys=1.0,
   *  Cognizant=0.75, Wipro varies. Government PSUs 5-10. */
  bondPenaltyLpa?: number;

  /** Multi-source provenance. When 2+ independent sources agree this
   *  is "verified"; when only 1 source it's "single-source". CI gate
   *  + admin dashboard surface the difference. */
  sourceVerifiedAt?: {
    glassdoor?: string;
    ambitionbox?: string;
    levelsFyi?: string;
    drhp?: string;
    operatorNetwork?: string;
  };

  /** How many independent sources confirm this cell.
   *    1 = single-source (e.g. only AmbitionBox)
   *    2+ = cross-verified (counts as "verified" for CI purposes)
   *  CI gate (scripts/check-data-freshness.mts) refuses to ship Tier-1
   *  cells with agreementCount < 2. Default 1 when unset. */
  agreementCount?: number;

  /** Multi-track encoding for companies whose fresher-tier hires split
   *  into distinct comp tracks (TCS Ninja/Digital/Prime, Infosys DSE/
   *  Power/Specialist, Wipro Elite/Turbo/Velocity, Cognizant GenC/
   *  GenC Next/GenC Pro, Accenture ASE/ASE-Plus, etc.).
   *
   *  The LLM is instructed to PROBE the candidate's resume for
   *  `resumeSignals` (NQT score, hackathon win, internship at product
   *  co, GitHub portfolio, DSA strength) before quoting a number. Only
   *  populate when the company materially differentiates by track —
   *  most product cos and FAANG don't and should leave this undefined.
   *
   *  When `tracks` is set, top-level `totalMin/Max` is the union
   *  envelope (Ninja floor → Prime ceiling); per-track sub-bands give
   *  the LLM the right anchor once the track is identified. */
  tracks?: Array<{
    /** Human-readable track label. */
    trackName: string;
    /** Per-track CTC band. */
    totalMin: number;
    totalMax: number;
    baseMin?: number;
    baseMax?: number;
    equityMin?: number;
    equityMax?: number;
    joiningBonusOverride?: [number, number];
    bondPenaltyLpa?: number;
    /** Resume cues that signal this track. Used by the LLM to triage
     *  before quoting. E.g. ["NQT top decile", "coding test invite",
     *  "hackathon win at top-30 college"] for TCS Digital. */
    resumeSignals: string[];
    /** Track-specific pitfalls / ask hints. */
    notes?: string;
  }>;
}

/** Company-level metadata that doesn't vary by role/level. Lifts notice
 * period, bond penalty, and deputation flag out of the per-role override
 * (where they would duplicate across every (role, level) cell) into a
 * single per-company table. salary-lookup.ts merges this into the band
 * with role-level override taking precedence when both exist.
 *
 * Only populated for companies where a public datum is well-documented;
 * undefined entries fall through to the tier-aware defaults in
 * salary-lookup.ts (getNoticeBuyoutContext, getBondWarning, etc.). */
export interface CompanyMeta {
  /** Notice period in days. TCS=90 (publicly documented), Google India=60
   *  (FAANG India standard), Razorpay=30 (Indian unicorn norm). */
  noticePeriodDays?: number;
  /** Service-bond penalty in LPA. TCS ₹0.5 LPA, Infosys ₹1 LPA, Cognizant
   *  ~₹0.75 LPA — all from publicly disclosed offer letters / news. */
  bondPenaltyLpa?: number;
  /** Whether the company has a meaningful onsite-deputation track. True
   *  for all IT services; false for product cos. */
  hasDeputation?: boolean;
  /** Override the tier-default 13th-month / festive-bonus presence.
   *  Use for unicorns that started Diwali bonus (CRED has done one),
   *  or FMCG firms that removed it. */
  hasFestiveBonus?: boolean;
  /** Per-company recent buyback note (overrides the hardcoded list in
   *  getRecentBuybackContext). Update when a new buyback round happens
   *  rather than editing helper code. */
  recentBuybackNote?: string;
  /** Source note for these company-level facts. */
  metaSource?: string;
}

/** Public-domain company-level facts. Each entry's data is verifiable
 *  from official policy documents, news coverage, or candidate offer
 *  letter screenshots widely circulated online. NOT salary numbers
 *  (those live in COMPANY_SALARY_OVERRIDES with their own provenance);
 *  these are operational facts (notice / bond / deputation). */
export const COMPANY_META: Record<string, CompanyMeta> = {
  /* ─── IT Services (notice + bond widely documented) ─── */
  tcs: { noticePeriodDays: 90, bondPenaltyLpa: 0.5, hasDeputation: true, metaSource: "TCS offer-letter standard policy + Glassdoor disclosures" },
  infosys: { noticePeriodDays: 90, bondPenaltyLpa: 1.0, hasDeputation: true, metaSource: "Infosys SE/PP offer letter + extensive Glassdoor coverage" },
  wipro: { noticePeriodDays: 90, bondPenaltyLpa: 0.75, hasDeputation: true, metaSource: "Wipro Elite/Turbo offer letter standard" },
  hcl: { noticePeriodDays: 90, bondPenaltyLpa: 0.5, hasDeputation: true, metaSource: "HCL Tech Bee program + Glassdoor" },
  "tech mahindra": { noticePeriodDays: 90, bondPenaltyLpa: 0.5, hasDeputation: true, metaSource: "Tech Mahindra ELTP standard" },
  cognizant: { noticePeriodDays: 60, bondPenaltyLpa: 0.75, hasDeputation: true, metaSource: "Cognizant GenC offer letter standard" },
  capgemini: { noticePeriodDays: 90, bondPenaltyLpa: 0.5, hasDeputation: true, metaSource: "Capgemini India standard policy" },
  accenture: { noticePeriodDays: 90, bondPenaltyLpa: 0.5, hasDeputation: true, metaSource: "Accenture India onboarding policy" },
  ltimindtree: { noticePeriodDays: 90, bondPenaltyLpa: 0.5, hasDeputation: true, metaSource: "Post-merger LTIMindtree standard policy" },

  /* ─── FAANG / Big Tech India (60-day notice norm) ─── */
  google: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Google India HR policy — standard FAANG India notice" },
  microsoft: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Microsoft India offer-letter standard" },
  amazon: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Amazon India SDE offer-letter standard" },
  meta: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Meta India hiring policy" },
  apple: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Apple India offer-letter standard" },
  netflix: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Netflix India offer-letter standard" },
  adobe: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Adobe India standard policy" },
  salesforce: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Salesforce India standard policy" },
  uber: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Uber India SDE standard" },

  /* ─── Indian Unicorns (mostly 30-60 day notice; no bonds) ─── */
  razorpay: {
    // Notice varies by level: 30-60d for junior/mid, 60-90d for senior+
    // (matches the new override entries). Default to 60d as the
    // company-wide quote when level isn't specified.
    noticePeriodDays: 60,
    hasDeputation: false,
    // Updated 2026-05-08: candidate must verify ESOP buyback before
    // assuming liquidity. Razorpay has run buybacks historically but
    // each round is contingent on board approval — not guaranteed.
    recentBuybackNote: "Razorpay has done multiple ESOP buybacks since 2018, BUT candidate should ASK HR explicitly: 'When was the last buyback round, what was the strike-vs-FMV ratio, and is another planned in the next 12 months?' Do NOT assume liquidity from past behavior — each round is board-discretion.",
    metaSource: "Razorpay HR policy + curated research 2026-05-08",
  },
  cred: {
    noticePeriodDays: 60, // Level-dependent: 30-60 junior/mid, 60-90 senior+; 60 = company-wide compromise
    hasDeputation: false,
    // CRED has run buybacks but liquidity less predictable than Razorpay's.
    // Curator note (2026-05-08): "Likely, but liquidity uncertain" —
    // candidate must ask explicitly about last buyback round + FMV.
    recentBuybackNote: "CRED has done multiple ESOP buybacks historically, BUT liquidity is uncertain — less predictable cadence than Razorpay/PhonePe. Candidate should ask HR: 'What is the last fair market valuation used for ESOP pricing? Has there been any buyback or secondary sale window in the last 12 months?'",
    metaSource: "CRED HR policy + curated research 2026-05-08",
  },
  zerodha: { noticePeriodDays: 30, hasDeputation: false, metaSource: "Zerodha HR policy" },
  groww: { noticePeriodDays: 30, hasDeputation: false, metaSource: "Groww HR policy" },
  phonepe: {
    noticePeriodDays: 60, // Level-dependent: 30-60 junior/mid, 60-90 senior+
    hasDeputation: false,
    // PhonePe ran a ₹1,150 Cr ESOP buyback in 2022 (one of India's largest)
    // and another in 2024 around its India domicile shift. Confirmed
    // pattern. Candidate should still verify next-window timing.
    recentBuybackNote: "PhonePe ran a ₹1,150 Cr ESOP buyback in 2022 (one of India's largest) and another buyback in 2024 around its India domicile shift. Strong historical liquidity. Candidate should ask HR: 'When is the next planned buyback window? What FMV is used for ESOP pricing post the India domicile shift?'",
    metaSource: "PhonePe HR policy + curated research 2026-05-08 (₹1,150 Cr buyback 2022, India domicile shift 2024)",
  },
  paytm: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Paytm HR policy" },
  flipkart: { noticePeriodDays: 90, hasDeputation: false, metaSource: "Flipkart HR policy — Walmart-owned, 60-90d notice tiered by level (60d junior/mid, 90d senior+); 90d is the company-wide quote" },
  swiggy: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Swiggy HR policy — post-IPO (Nov 2024), level-tiered: 30-60d junior/mid, 60-90d senior+; 60d is the company-wide quote" },
  zomato: { noticePeriodDays: 30, hasDeputation: false, metaSource: "Zomato (Eternal) HR policy post-listing" },
  meesho: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Meesho HR policy" },
  myntra: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Myntra HR policy (Flipkart group)" },
  dream11: { noticePeriodDays: 30, hasDeputation: false, metaSource: "Dream Sports HR policy — Indian unicorn norm" },
  nykaa: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Nykaa HR policy post-listing" },
  unacademy: { noticePeriodDays: 30, hasDeputation: false, metaSource: "Unacademy HR policy" },
  byjus: { noticePeriodDays: 30, hasDeputation: false, metaSource: "Byju's HR policy (post-restructuring)" },

  /* ─── Indian Conglomerates / FMCG / BFSI ─── */
  godrej: { noticePeriodDays: 90, hasDeputation: false, metaSource: "Godrej group HR policy — conglomerate norm" },
  // "tata steel" removed: missing from COMPANY_TIER_MAP — add tier
  // mapping first, then restore this entry. CI gate enforces this.
  "tata motors": { noticePeriodDays: 60, hasDeputation: false, metaSource: "Tata Motors GET / Lateral standard policy" },
  "hdfc bank": { noticePeriodDays: 60, hasDeputation: false, metaSource: "HDFC Bank standard officer/manager policy" },

  /* ─── Government / PSU (long bonds, fixed notice) ─── */
  ongc: { noticePeriodDays: 90, bondPenaltyLpa: 5, hasDeputation: false, metaSource: "ONGC service bond — 3yr typical, ₹5L+ penalty" },
  isro: { noticePeriodDays: 90, bondPenaltyLpa: 8, hasDeputation: false, metaSource: "ISRO service bond — 5yr scientist contract" },
  drdo: { noticePeriodDays: 90, bondPenaltyLpa: 5, hasDeputation: false, metaSource: "DRDO service bond" },
  bhel: { noticePeriodDays: 90, bondPenaltyLpa: 4, hasDeputation: false, metaSource: "BHEL ET bond — 3yr typical" },
  sbi: { noticePeriodDays: 90, bondPenaltyLpa: 2, hasDeputation: false, metaSource: "SBI PO bond — 2yr typical" },

  /* ─── Premium Big-Tech GCC ─── */
  databricks: { noticePeriodDays: 60, hasDeputation: false, metaSource: "Databricks India HR policy — premium GCC standard" },
};

/** company key → role key → exp level → override band. Company key is
 *  the lowercased canonical name (e.g. "razorpay", "bombay design centre"). */
export const COMPANY_SALARY_OVERRIDES: Record<
  string,
  Partial<Record<string, Partial<Record<ExperienceLevel, CompanyBandOverride>>>>
> = {
  /* ─── Indian Unicorns — Fintech ───────────────────────────────
   *
   * Razorpay: data refreshed from human-curated research worksheet
   * 2026-05-08. Total CTC ranges widened to reflect actual offer
   * distribution (junior to senior outliers). Each entry now also
   * carries the candidate's per-level negotiation focus in `notes`. */
  razorpay: {
    "software-engineer": {
      entry: { totalMin: 10.5, totalMax: 29.4, baseMin: 7.8, baseMax: 21.8, equityMin: 1.5, equityMax: 4.1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox + offer-letter aggregation", lastVerified: "2026-05-08", notes: "Razorpay SE-1 / Junior. Negotiation focus: fixed + joining bonus. ESOP liquidity must be verified — do not assume." },
      mid: { totalMin: 18.9, totalMax: 52.5, baseMin: 14.0, baseMax: 38.9, equityMin: 2.6, equityMax: 7.4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay SE-2 / SE-3 mid level. Negotiation focus: fixed + ESOP clarity (strike, vesting, last buyback)." },
      senior: { totalMin: 36.8, totalMax: 99.8, baseMin: 27.2, baseMax: 73.9, equityMin: 5.2, equityMax: 14.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 (post Apr-2026 DRHP filing)", lastVerified: "2026-05-08", notes: "Razorpay Senior. Negotiation focus: fixed + ESOP + joining bonus. Top of range hit only for staff/principal-tier hires." },
      lead: { totalMin: 60, totalMax: 145, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (Razorpay Staff/Principal SE band) — widened 2026-05-14 to maintain monotonicity over senior P90 (₹99.8L)", lastVerified: "2026-05-14", notes: "Razorpay Staff / Principal SE. Top of range = principal-tier IC compensation." },
    },
    "product-manager": {
      entry: { totalMin: 14.7, totalMax: 33.6, baseMin: 10.3, baseMax: 23.5, equityMin: 2.1, equityMax: 4.7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay APM / PM-1. Negotiation focus: fixed + role scope clarity." },
      mid: { totalMin: 26.2, totalMax: 73.5, baseMin: 18.3, baseMax: 51.5, equityMin: 3.7, equityMax: 10.3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay PM mid level. Negotiation focus: fixed + ESOP value (verify last buyback round)." },
      senior: { totalMin: 47.2, totalMax: 136.5, baseMin: 33.0, baseMax: 95.6, equityMin: 6.6, equityMax: 19.1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Senior PM / Group PM. Negotiation focus: scope + fixed + equity. Top of range = group-PM with strong fintech track record." },
    },
    "ux-designer": {
      entry: { totalMin: 15.0, totalMax: 22.0, baseMin: 11.7, baseMax: 17.2, equityMin: 1.8, equityMax: 2.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-14 — Razorpay PD band recalibration (Early-Career 1-3y base ₹9-13.5L / total up to ₹20L)", lastVerified: "2026-05-14", notes: "Razorpay Junior Product Designer (≤1y). Negotiation focus: fixed salary + onboarding ramp." },
      mid: { totalMin: 22.0, totalMax: 32.0, baseMin: 17.2, baseMax: 25.0, equityMin: 2.6, equityMax: 3.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-14 — Razorpay PD Mid-Senior 3-6y base ₹17-33L / total ₹30-38L (mid 2-4y slice)", lastVerified: "2026-05-14", notes: "Razorpay Mid Product Designer (2-4y). Negotiation focus: fixed + level mapping clarity (Designer-2 vs Senior Designer)." },
      senior: { totalMin: 30.0, totalMax: 42.0, baseMin: 23.4, baseMax: 32.8, equityMin: 3.6, equityMax: 5.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-14 — Razorpay PD median total ₹37-41L (5-8y senior slice)", lastVerified: "2026-05-14", notes: "Razorpay Senior Product Designer (5-8y). 35th-pct opener lands ~₹34L. Negotiation focus: fixed + title calibration (Senior vs Lead vs Principal designer)." },
      lead: { totalMin: 40.0, totalMax: 65.0, baseMin: 31.2, baseMax: 50.7, equityMin: 4.8, equityMax: 7.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-14 — Razorpay PD Lead/Senior base ₹32-45L+ (9+y)", lastVerified: "2026-05-14", notes: "Razorpay Lead/Principal Product Designer (9+y). Top of range = principal-tier design leadership." },
    },
    "data-analyst": {
      entry: { totalMin: 6.3, totalMax: 16.8, baseMin: 5.3, baseMax: 14.1, equityMin: 0.4, equityMax: 1.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Junior Data Analyst. Negotiation focus: fixed (variable component small at this level)." },
      mid: { totalMin: 10.5, totalMax: 29.4, baseMin: 8.8, baseMax: 24.7, equityMin: 0.6, equityMax: 1.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Mid Data Analyst. Negotiation focus: fixed + bonus structure (perf-linked)." },
      senior: { totalMin: 18.9, totalMax: 52.5, baseMin: 15.9, baseMax: 44.1, equityMin: 1.1, equityMax: 3.2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Senior Data Analyst. Negotiation focus: fixed + title (Senior vs Lead vs DS conversion path)." },
    },
    "sales": {
      entry: { totalMin: 7.4, totalMax: 18.9, baseMin: 4.6, baseMax: 11.7, equityMin: 0.4, equityMax: 1.1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Junior Sales/Growth. Bonus heavy (₹2.4-6L variable). Negotiation focus: variable structure (quota + accelerators)." },
      mid: { totalMin: 14.7, totalMax: 42.0, baseMin: 9.1, baseMax: 26.0, equityMin: 0.9, equityMax: 2.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Mid Sales/AE. Variable up to ₹13L. Negotiation focus: OTE + fixed split — pin down the realistic fixed component, not just OTE." },
      senior: { totalMin: 26.2, totalMax: 84.0, baseMin: 16.3, baseMax: 52.1, equityMin: 1.6, equityMax: 5.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "Razorpay Senior Sales/Strategic Account. Negotiation focus: fixed + commission terms (cap, claw-back, payout cadence)." },
    },
    "ml-engineer": {
      mid: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + GenAI premium 1.3-1.6x", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 90, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "devops-sre": {
      mid: { totalMin: 19, totalMax: 30, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Razorpay DevOps SE ₹1.92M, median ₹2.17M)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Razorpay Sr DevOps)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 50, totalMax: 75, equityMin: 7, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Razorpay Lead DevOps top ₹6.67M)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 17, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (razorpay 1.05x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 34, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (razorpay 1.05x customer-success)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 63, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (razorpay 1.05x customer-success)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 95, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (razorpay 1.05x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 137, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (razorpay 1.05x customer-success)", lastVerified: "2026-05-08" },
    },
  },

  /* PhonePe — refreshed 2026-05-08 from human-curated research worksheet.
   * PhonePe added Risk Analyst and KAM (Key Account Manager) coverage —
   * fintech-specific roles peer companies typically don't hire for. */
  phonepe: {
    "software-engineer": {
      entry: { totalMin: 11.0, totalMax: 30.8, baseMin: 8.1, baseMax: 22.8, equityMin: 1.5, equityMax: 4.3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — AmbitionBox + Glassdoor aggregated", lastVerified: "2026-05-08", notes: "PhonePe Junior SE. Negotiation focus: fixed + joining bonus." },
      mid: { totalMin: 19.8, totalMax: 55.0, baseMin: 14.7, baseMax: 40.7, equityMin: 2.8, equityMax: 7.7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "PhonePe Mid SE-2/SE-3. Negotiation focus: fixed + ESOP clarity. Reverse-flipped to India 2022; DRHP filed via SEBI confidential route." },
      senior: { totalMin: 38.5, totalMax: 104.5, baseMin: 28.5, baseMax: 77.3, equityMin: 5.4, equityMax: 14.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Senior SE. Negotiation focus: fixed + equity. Top of range = staff-tier hires." },
    },
    "product-manager": {
      entry: { totalMin: 15.4, totalMax: 35.2, baseMin: 10.8, baseMax: 24.6, equityMin: 2.2, equityMax: 4.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Junior PM / APM. Negotiation focus: scope + fixed." },
      mid: { totalMin: 27.5, totalMax: 77.0, baseMin: 19.2, baseMax: 53.9, equityMin: 3.9, equityMax: 10.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Mid PM. Negotiation focus: fixed + role scope clarity." },
      senior: { totalMin: 49.5, totalMax: 143.0, baseMin: 34.6, baseMax: 100.1, equityMin: 6.9, equityMax: 20.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Senior PM. Negotiation focus: scope + ESOP. Top of range = group-PM tier." },
    },
    "ux-designer": {
      entry: { totalMin: 8.8, totalMax: 26.4, baseMin: 6.9, baseMax: 20.6, equityMin: 1.1, equityMax: 3.2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Junior Designer. Negotiation focus: fixed salary." },
      mid: { totalMin: 17.6, totalMax: 49.5, baseMin: 13.7, baseMax: 38.6, equityMin: 2.1, equityMax: 5.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Mid Designer. Negotiation focus: level mapping + fixed." },
      senior: { totalMin: 30.8, totalMax: 88.0, baseMin: 24.0, baseMax: 68.6, equityMin: 3.7, equityMax: 10.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Senior Designer. Negotiation focus: scope + fixed." },
    },
    "data-analyst": {
      entry: { totalMin: 6.6, totalMax: 17.6, baseMin: 5.5, baseMax: 14.8, equityMin: 0.4, equityMax: 1.1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Junior Data Analyst. Negotiation focus: fixed." },
      mid: { totalMin: 11.0, totalMax: 30.8, baseMin: 9.2, baseMax: 25.9, equityMin: 0.7, equityMax: 1.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Mid Data Analyst. Negotiation focus: fixed + growth path (DS conversion)." },
      senior: { totalMin: 19.8, totalMax: 55.0, baseMin: 16.6, baseMax: 46.2, equityMin: 1.2, equityMax: 3.3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "PhonePe Senior Data Analyst. Negotiation focus: fixed + title." },
    },
    /* Risk Analyst — fintech-specific role unique to PhonePe coverage.
     * Maps to data-scientist role-key (closest existing). Use sparingly. */
    "data-scientist": {
      entry: { totalMin: 6.6, totalMax: 19.8, baseMin: 5.3, baseMax: 15.8, equityMin: 0.1, equityMax: 0.4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — PhonePe Risk Analyst track", lastVerified: "2026-05-08", notes: "PhonePe Junior Risk Analyst. Negotiation focus: fixed + bonus. Low equity reflects ops-track positioning." },
      mid: { totalMin: 13.2, totalMax: 39.6, baseMin: 10.6, baseMax: 31.7, equityMin: 0.3, equityMax: 0.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — PhonePe Risk Analyst track", lastVerified: "2026-05-08", notes: "PhonePe Mid Risk Analyst. Negotiation focus: risk scope (fraud / credit / merchant)." },
      senior: { totalMin: 24.2, totalMax: 71.5, baseMin: 19.4, baseMax: 57.2, equityMin: 0.5, equityMax: 1.4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — PhonePe Risk Analyst track", lastVerified: "2026-05-08", notes: "PhonePe Senior Risk Analyst. Negotiation focus: fixed + role criticality." },
    },
    /* KAM (Key Account Manager) — variable-heavy fintech sales role.
     * Maps to sales role-key. */
    "sales": {
      entry: { totalMin: 6.6, totalMax: 19.8, baseMin: 4.0, baseMax: 11.9, equityMin: 0.3, equityMax: 0.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — PhonePe KAM track", lastVerified: "2026-05-08", notes: "PhonePe Junior KAM. Variable up to ₹7L. Negotiation focus: fixed vs incentive split." },
      mid: { totalMin: 13.2, totalMax: 39.6, baseMin: 7.9, baseMax: 23.8, equityMin: 0.5, equityMax: 1.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — PhonePe KAM track", lastVerified: "2026-05-08", notes: "PhonePe Mid KAM. Negotiation focus: OTE structure (variable can be 35%+ of CTC)." },
      senior: { totalMin: 24.2, totalMax: 77.0, baseMin: 14.5, baseMax: 46.2, equityMin: 1.0, equityMax: 3.1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — PhonePe KAM track", lastVerified: "2026-05-08", notes: "PhonePe Senior KAM. Negotiation focus: variable payout terms (cap, claw-back, cadence)." },
    },
    "ml-engineer": {
      mid: { totalMin: 30, totalMax: 50, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (PhonePe avg ₹31.1L) + GenAI 1.2-1.4x SE premium", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 50, totalMax: 80, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (PhonePe Sr ML / Eng Manager ceiling ₹75L)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      lead: { totalMin: 75, totalMax: 130, equityMin: 12, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (PhonePe Lead ML / Principal; range top ₹176L)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  },

  flipkart: {
    "software-engineer": {
      entry: { totalMin: 12.5, totalMax: 35.0, baseMin: 9.2, baseMax: 25.9, equityMin: 1.8, equityMax: 4.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart SE Junior worksheet (Walmart-backed, listing 2026)", lastVerified: "2026-05-08", notes: "Flipkart Junior SE. Bonus ₹1.5-4.2L. Joining bonus ₹1-3L. 60-day notice. Negotiation focus: fixed + joining bonus." },
      mid: { totalMin: 22.5, totalMax: 62.5, baseMin: 16.6, baseMax: 46.2, equityMin: 3.2, equityMax: 8.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart SE Mid worksheet", lastVerified: "2026-05-08", notes: "Flipkart Mid SE-2/SE-3. Bonus ₹2.7-7.5L. Joining bonus ₹2-6L. 60-90 day notice. Negotiation focus: fixed + equity." },
      senior: { totalMin: 43.8, totalMax: 118.8, baseMin: 32.4, baseMax: 87.9, equityMin: 6.1, equityMax: 16.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart SE Senior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Senior SE-3/SDE-4. Bonus ₹5.3-14.3L. Joining bonus ₹4-12L. 90-day notice. Negotiation focus: fixed + level calibration." },
    },
    "backend-developer": {
      entry: { totalMin: 12.5, totalMax: 35.0, baseMin: 9.2, baseMax: 25.9, equityMin: 1.8, equityMax: 4.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Backend Junior", lastVerified: "2026-05-08", notes: "Flipkart Junior Backend. 60-day notice. Negotiation focus: fixed." },
      mid: { totalMin: 22.5, totalMax: 62.5, baseMin: 16.6, baseMax: 46.2, equityMin: 3.2, equityMax: 8.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Backend Mid", lastVerified: "2026-05-08", notes: "Flipkart Mid Backend. Negotiation focus: systems impact." },
      senior: { totalMin: 43.8, totalMax: 118.8, baseMin: 32.4, baseMax: 87.9, equityMin: 6.1, equityMax: 16.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Backend Senior", lastVerified: "2026-05-08", notes: "Flipkart Senior Backend. 90-day notice. Negotiation focus: scale + ownership." },
    },
    "product-manager": {
      entry: { totalMin: 17.5, totalMax: 40.0, baseMin: 12.2, baseMax: 28.0, equityMin: 2.4, equityMax: 5.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart PM Junior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Junior PM / APM. Bonus ₹2.8-6.4L. Joining bonus ₹1-4L. 60-day notice. Negotiation focus: scope + fixed." },
      mid: { totalMin: 31.2, totalMax: 87.5, baseMin: 21.8, baseMax: 61.2, equityMin: 4.4, equityMax: 12.2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart PM Mid worksheet", lastVerified: "2026-05-08", notes: "Flipkart Mid PM. Bonus ₹5.0-14L. Joining bonus ₹3-8L. 60-90 day notice. Negotiation focus: scope + equity." },
      senior: { totalMin: 56.2, totalMax: 162.5, baseMin: 39.3, baseMax: 113.8, equityMin: 7.9, equityMax: 22.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart PM Senior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Senior / Group PM. Bonus ₹9-26L. Joining bonus ₹5-18L. 90-day notice. Negotiation focus: level + org scope." },
    },
    "ux-designer": {
      entry: { totalMin: 8.0, totalMax: 22.0, baseMin: 6.2, baseMax: 17.2, equityMin: 1.0, equityMax: 2.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-09 — 6figr + Glassdoor (Flipkart Designer I, 0-2y)", lastVerified: "2026-05-09", notes: "Flipkart Junior UX/Product Designer. Bonus ₹0.8-2L. 60-day notice. Negotiation focus: fixed + portfolio." },
      mid: { totalMin: 14.0, totalMax: 32.0, baseMin: 10.9, baseMax: 25.0, equityMin: 1.7, equityMax: 3.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-09 — 6figr + Glassdoor (Flipkart Designer II, 2-4y)", lastVerified: "2026-05-09", notes: "Flipkart Mid UX/Product Designer. Bonus ₹1.4-3.2L. Joining bonus ₹1-3L. 60-90 day notice. Negotiation focus: fixed + level." },
      senior: { totalMin: 22.0, totalMax: 46.0, baseMin: 17.2, baseMax: 36.0, equityMin: 2.6, equityMax: 6.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-09 — 6figr (Flipkart Sr Product Designer / PD II-III, 4-8y avg ₹28-35L, typical band ₹28-46L)", lastVerified: "2026-05-09", notes: "Flipkart Senior UX/Product Designer. Typical band ₹28-46L (4-8y). Bonus ₹2-7L. Joining bonus ₹2-8L. 90-day notice. Negotiation focus: ownership + craft + level mapping (PD II vs III). Outlier top-earner figures (₹50-60L for principal-tier) handled by lead band — keep senior anchored to typical." },
      lead: { totalMin: 40, totalMax: 85, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-09 — Flipkart Lead/Principal Designer extrapolation from Senior + Levels.fyi", lastVerified: "2026-05-09", sourceVerifiedAt: { levelsFyi: "2026-05-09" } },
    },
    "ml-engineer": {
      mid: { totalMin: 35, totalMax: 60, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Flipkart SE base ₹2.37M-₹17.96M × ML 1.15-1.3x premium)", lastVerified: "2026-05-08", notes: "Flipkart ML mid; SE-2/SE-3 with ML premium. Flipkart Glassdoor ML data noisy.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 60, totalMax: 100, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Flipkart Sr SE × ML premium)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 95, totalMax: 150, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Flipkart Staff/Architect top ₹17.96M)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "devops-sre": {
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (Flipkart DevOps total pay band ₹3L-14.8L for entry/mid; SE base ₹2.37M peer ref)", lastVerified: "2026-05-08", notes: "Flipkart DevOps mid; Glassdoor sample skews junior — peer SE band used for sanity-check.", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 38, totalMax: 65, equityMin: 5, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + Levels.fyi peer", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08", levelsFyi: "2026-05-08" } },
      lead: { totalMin: 65, totalMax: 100, equityMin: 9, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Flipkart Lead DevOps / SRE)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
  
    "data-scientist": {
      entry: { totalMin: 12.5, totalMax: 31.2, baseMin: 9.2, baseMax: 23.1, equityMin: 1.8, equityMax: 4.4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart DS Junior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Junior Data Scientist. Bonus ₹1.5-3.8L. 60-day notice. Negotiation focus: fixed + model impact." },
      mid: { totalMin: 25.0, totalMax: 75.0, baseMin: 18.5, baseMax: 55.5, equityMin: 3.5, equityMax: 10.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart DS Mid worksheet", lastVerified: "2026-05-08", notes: "Flipkart Mid Data Scientist. Bonus ₹3-9L. Joining bonus ₹2-7L. 60-90 day notice. Negotiation focus: fixed + scope." },
      senior: { totalMin: 43.8, totalMax: 137.5, baseMin: 32.4, baseMax: 101.8, equityMin: 6.1, equityMax: 19.2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart DS Senior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Senior Data Scientist. Bonus ₹5.3-16.5L. Joining bonus ₹4-14L. 90-day notice. Negotiation focus: business impact." },
      lead: { totalMin: 69, totalMax: 200, equityMin: 10, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (flipkart 1.25x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 263, equityMin: 14, equityMax: 37, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (flipkart 1.25x data-scientist)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 12.5, totalMax: 27.5, baseMin: 9.5, baseMax: 20.9, equityMin: 1.2, equityMax: 2.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart PgM Junior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Junior Program Manager. Bonus ₹1.8-3.8L. 60-day notice. Negotiation focus: fixed + scope." },
      mid: { totalMin: 22.5, totalMax: 62.5, baseMin: 17.1, baseMax: 47.5, equityMin: 2.2, equityMax: 6.2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart PgM Mid worksheet", lastVerified: "2026-05-08", notes: "Flipkart Mid Program Manager. Bonus ₹3.1-8.8L. 60-90 day notice. Negotiation focus: scope + bonus." },
      senior: { totalMin: 43.8, totalMax: 118.8, baseMin: 33.2, baseMax: 90.2, equityMin: 4.4, equityMax: 11.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart PgM Senior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Senior Program Manager. Bonus ₹6.1-16.6L. Joining bonus ₹4-12L. 90-day notice. Negotiation focus: program impact." },
      lead: { totalMin: 69, totalMax: 175, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (flipkart 1.25x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 94, totalMax: 225, equityMin: 9, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (flipkart 1.25x program-manager)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 8.8, totalMax: 22.5, baseMin: 6.9, baseMax: 17.6, equityMin: 0.3, equityMax: 0.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Category Manager Junior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Junior Category Manager (mapped to BA). Bonus ₹1.6-4L. 60-day notice. Negotiation focus: fixed + variable." },
      mid: { totalMin: 17.5, totalMax: 50.0, baseMin: 13.7, baseMax: 39.0, equityMin: 0.7, equityMax: 2.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Category Manager Mid worksheet", lastVerified: "2026-05-08", notes: "Flipkart Mid Category Manager. Bonus ₹3.1-9L. Joining bonus ₹1-5L. 60-90 day notice. Negotiation focus: category P&L." },
      senior: { totalMin: 31.2, totalMax: 100.0, baseMin: 24.4, baseMax: 78.0, equityMin: 1.2, equityMax: 4.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Category Manager Senior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Senior Category Manager. Bonus ₹5.6-18L. Joining bonus ₹3-10L. 90-day notice. Negotiation focus: P&L ownership." },
      lead: { totalMin: 40, totalMax: 106, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (flipkart 1.25x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 150, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (flipkart 1.25x business-analyst)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 10.0, totalMax: 25.0, baseMin: 7.8, baseMax: 19.5, equityMin: 0.2, equityMax: 0.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Supply Chain/Ops Junior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Junior Supply Chain/Ops. Bonus ₹2-5L. 60-day notice. Negotiation focus: fixed + location." },
      mid: { totalMin: 17.5, totalMax: 50.0, baseMin: 13.7, baseMax: 39.0, equityMin: 0.4, equityMax: 1.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Supply Chain/Ops Mid worksheet", lastVerified: "2026-05-08", notes: "Flipkart Mid Supply Chain/Ops. Bonus ₹3.5-10L. 60-90 day notice. Negotiation focus: ops scope." },
      senior: { totalMin: 31.2, totalMax: 93.8, baseMin: 24.4, baseMax: 73.1, equityMin: 0.6, equityMax: 1.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Flipkart Supply Chain/Ops Senior worksheet", lastVerified: "2026-05-08", notes: "Flipkart Senior Supply Chain/Ops. Bonus ₹6.2-18.8L. Joining bonus ₹3-9L. 90-day notice. Negotiation focus: scale + team size." },
    },
  },

  swiggy: {
    "software-engineer": {
      entry: { totalMin: 10.5, totalMax: 29.4, baseMin: 7.8, baseMax: 21.8, equityMin: 1.5, equityMax: 4.1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy SE Junior worksheet (post-Nov 2024 IPO)", lastVerified: "2026-05-08", notes: "Swiggy Junior SE / SDE-1. Bonus ₹1.3-3.5L. Joining bonus ₹0-2L. 30-60 day notice. RSU liquid post-IPO. Negotiation focus: fixed + joining bonus." },
      mid: { totalMin: 18.9, totalMax: 52.5, baseMin: 14.0, baseMax: 38.9, equityMin: 2.6, equityMax: 7.4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy SE Mid worksheet", lastVerified: "2026-05-08", notes: "Swiggy Mid SE-2/SE-3. Bonus ₹2.3-6.3L. Joining bonus ₹1-5L. 30-60 day notice. Negotiation focus: fixed + ESOP/RSU." },
      senior: { totalMin: 36.8, totalMax: 99.8, baseMin: 27.2, baseMax: 73.9, equityMin: 5.2, equityMax: 14.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy SE Senior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Senior SE / SDE-4. Bonus ₹4.4-12L. Joining bonus ₹3-10L. 60-90 day notice. Negotiation focus: fixed + ownership." },
    },
    "backend-developer": {
      entry: { totalMin: 10.5, totalMax: 29.4, baseMin: 7.8, baseMax: 21.8, equityMin: 1.5, equityMax: 4.1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy Backend Junior", lastVerified: "2026-05-08", notes: "Swiggy Junior Backend. Negotiation focus: fixed." },
      mid: { totalMin: 18.9, totalMax: 52.5, baseMin: 14.0, baseMax: 38.9, equityMin: 2.6, equityMax: 7.4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy Backend Mid", lastVerified: "2026-05-08", notes: "Swiggy Mid Backend. Negotiation focus: scale impact." },
      senior: { totalMin: 36.8, totalMax: 99.8, baseMin: 27.2, baseMax: 73.9, equityMin: 5.2, equityMax: 14.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy Backend Senior", lastVerified: "2026-05-08", notes: "Swiggy Senior Backend. 60-90 day notice. Negotiation focus: platform ownership." },
    },
    "product-manager": {
      entry: { totalMin: 14.7, totalMax: 33.6, baseMin: 10.3, baseMax: 23.5, equityMin: 2.1, equityMax: 4.7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy PM Junior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Junior PM / APM. Bonus ₹2.4-5.4L. Joining bonus ₹1-3L. 30-60 day notice. Negotiation focus: scope + fixed." },
      mid: { totalMin: 26.2, totalMax: 73.5, baseMin: 18.3, baseMax: 51.5, equityMin: 3.7, equityMax: 10.3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy PM Mid worksheet", lastVerified: "2026-05-08", notes: "Swiggy Mid PM. Bonus ₹4.2-11.8L. Joining bonus ₹2-7L. 60-day notice. Negotiation focus: fixed + product scope." },
      senior: { totalMin: 47.2, totalMax: 136.5, baseMin: 33.0, baseMax: 95.6, equityMin: 6.6, equityMax: 19.1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy PM Senior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Senior / Group PM. Bonus ₹7.6-21.8L. Joining bonus ₹5-15L. 60-90 day notice. Negotiation focus: org impact." },
    },
  
    "ux-designer": {
      entry: { totalMin: 8.4, totalMax: 25.2, baseMin: 6.6, baseMax: 19.7, equityMin: 1.0, equityMax: 3.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy UX/Product Designer Junior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Junior UX/Product Designer. Bonus ₹0.8-2.5L. 30-60 day notice. Negotiation focus: fixed + portfolio." },
      mid: { totalMin: 16.8, totalMax: 47.2, baseMin: 13.1, baseMax: 36.8, equityMin: 2.0, equityMax: 5.7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy UX/Product Designer Mid worksheet", lastVerified: "2026-05-08", notes: "Swiggy Mid UX/Product Designer. Bonus ₹1.7-4.7L. Joining bonus ₹1-4L. Negotiation focus: level calibration." },
      senior: { totalMin: 29.4, totalMax: 84.0, baseMin: 22.9, baseMax: 65.5, equityMin: 3.5, equityMax: 10.1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy UX/Product Designer Senior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Senior UX/Product Designer. Bonus ₹2.9-8.4L. Joining bonus ₹2-8L. 60-90 day notice. Negotiation focus: product ownership." },
      lead: { totalMin: 47, totalMax: 126, equityMin: 6, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 158, equityMin: 8, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 15, totalMax: 37, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 84, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 53, totalMax: 158, equityMin: 10, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 84, totalMax: 231, equityMin: 15, equityMax: 42, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 294, equityMin: 19, equityMax: 53, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 11, totalMax: 29, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 68, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 126, equityMin: 6, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 63, totalMax: 179, equityMin: 9, equityMax: 27, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 89, totalMax: 231, equityMin: 13, equityMax: 35, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x devops-sre)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 6.3, totalMax: 16.8, baseMin: 5.3, baseMax: 14.1, equityMin: 0.4, equityMax: 1.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy DA Junior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Junior Data Analyst. Bonus ₹0.6-1.7L. 30-60 day notice. Negotiation focus: fixed." },
      mid: { totalMin: 10.5, totalMax: 29.4, baseMin: 8.8, baseMax: 24.7, equityMin: 0.6, equityMax: 1.8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy DA Mid worksheet", lastVerified: "2026-05-08", notes: "Swiggy Mid Data Analyst. Bonus ₹1.0-2.9L. Negotiation focus: analytics impact." },
      senior: { totalMin: 18.9, totalMax: 52.5, baseMin: 15.9, baseMax: 44.1, equityMin: 1.1, equityMax: 3.2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy DA Senior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Senior Data Analyst. Bonus ₹1.9-5.3L. 60-day notice. Negotiation focus: fixed + scope." },
      lead: { totalMin: 29, totalMax: 79, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 105, equityMin: 3, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x data-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 6.3, totalMax: 18.9, baseMin: 3.8, baseMax: 11.3, equityMin: 0.3, equityMax: 0.8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy Account Manager Junior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Junior Account Manager / Sales. Bonus/incentive ₹2.3-6.8L (high variable %). 30-60 day notice. Negotiation focus: incentive payout terms." },
      mid: { totalMin: 12.6, totalMax: 39.9, baseMin: 7.6, baseMax: 23.9, equityMin: 0.5, equityMax: 1.6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy Account Manager Mid worksheet", lastVerified: "2026-05-08", notes: "Swiggy Mid Account Manager. Bonus/incentive ₹4.5-14.4L. Negotiation focus: OTE structure (variable can be 35%+ of CTC)." },
      senior: { totalMin: 23.1, totalMax: 78.8, baseMin: 13.9, baseMax: 47.3, equityMin: 0.9, equityMax: 3.2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy Account Manager Senior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Senior Account Manager. Bonus/incentive ₹8.3-28.4L. Joining bonus ₹2-8L. 60-90 day notice. Negotiation focus: fixed vs variable split." },
      lead: { totalMin: 47, totalMax: 147, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 74, totalMax: 231, equityMin: 4, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x sales)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6.3, totalMax: 15.8, baseMin: 4.9, baseMax: 12.3, equityMin: 0.1, equityMax: 0.3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy City Ops Junior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Junior City Operations. Bonus ₹1.3-3.2L. 30-60 day notice. Negotiation focus: fixed + variable." },
      mid: { totalMin: 12.6, totalMax: 36.8, baseMin: 9.8, baseMax: 28.7, equityMin: 0.3, equityMax: 0.7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy City Ops Mid worksheet", lastVerified: "2026-05-08", notes: "Swiggy Mid City Operations. Bonus ₹2.5-7.4L. Negotiation focus: team/geography scope." },
      senior: { totalMin: 23.1, totalMax: 78.8, baseMin: 18.0, baseMax: 61.5, equityMin: 0.5, equityMax: 1.6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Swiggy City Ops Senior worksheet", lastVerified: "2026-05-08", notes: "Swiggy Senior City Operations. Bonus ₹4.6-15.8L. Joining bonus ₹2-7L. 60-90 day notice. Negotiation focus: ops scale." },
      lead: { totalMin: 42, totalMax: 116, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 168, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (swiggy 1.05x operations)", lastVerified: "2026-05-08" },
    },
  },

  zomato: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + AmbitionBox (Zomato SDE-1 fresher)", lastVerified: "2026-05-07" },
      mid: { totalMin: 24, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Levels.fyi (Eternal/Zomato listed)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 15, totalMax: 34, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 74, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 137, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 189, equityMin: 10, equityMax: 26, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 263, equityMin: 14, equityMax: 37, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 47, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 84, equityMin: 3, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 126, equityMin: 6, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 158, equityMin: 8, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 15, totalMax: 37, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 84, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 53, totalMax: 158, equityMin: 10, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 84, totalMax: 231, equityMin: 15, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 294, equityMin: 19, equityMax: 53, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 17, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 29, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 53, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 79, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 105, equityMin: 3, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x data-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 19, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 42, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 84, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 147, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 74, totalMax: 231, equityMin: 4, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x sales)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 8, totalMax: 21, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 42, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 79, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 116, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 168, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (zomato 1.05x operations)", lastVerified: "2026-05-08" },
    },
  },

  /* CRED — refreshed 2026-05-08 from human-curated research worksheet.
   * CRED is a premium Indian unicorn with notably higher bands than
   * peer unicorns (esp. Designer + ML where the design/eng bar is
   * unusually high). Liquidity is uncertain — buyback pattern less
   * predictable than Razorpay's. */
  cred: {
    "software-engineer": {
      entry: { totalMin: 12.0, totalMax: 33.6, baseMin: 8.9, baseMax: 24.9, equityMin: 1.7, equityMax: 4.7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox + offer-letter aggregation", lastVerified: "2026-05-08", notes: "CRED Junior SE. Negotiation focus: fixed + joining bonus. Bar exceptionally high at hiring." },
      mid: { totalMin: 21.6, totalMax: 60.0, baseMin: 16.0, baseMax: 44.4, equityMin: 3.0, equityMax: 8.4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + AmbitionBox aggregated", lastVerified: "2026-05-08", notes: "CRED Mid SE. Negotiation focus: fixed + ESOP clarity (FMV + last buyback)." },
      senior: { totalMin: 42.0, totalMax: 114.0, baseMin: 31.1, baseMax: 84.4, equityMin: 5.9, equityMax: 16.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Glassdoor + Levels.fyi aggregated", lastVerified: "2026-05-08", notes: "CRED Senior SE. Negotiation focus: fixed + equity. Top of range = staff/principal-tier hires." },
      lead: { totalMin: 95, totalMax: 145, equityMin: 18, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (CRED L6 SE top ₹11.73M)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "product-manager": {
      entry: { totalMin: 16.8, totalMax: 38.4, baseMin: 11.8, baseMax: 26.9, equityMin: 2.4, equityMax: 5.4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Junior PM / APM. Negotiation focus: scope + fixed (CRED hires very selective at this level)." },
      mid: { totalMin: 30.0, totalMax: 84.0, baseMin: 21.0, baseMax: 58.8, equityMin: 4.2, equityMax: 11.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Mid PM. Negotiation focus: fixed + ESOP. Sits at top of India PM band." },
      senior: { totalMin: 54.0, totalMax: 156.0, baseMin: 37.8, baseMax: 109.2, equityMin: 7.6, equityMax: 21.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Senior PM / Group PM. Negotiation focus: scope + equity. Top of range = director-tier." },
    },
    "ux-designer": {
      entry: { totalMin: 9.6, totalMax: 28.8, baseMin: 7.5, baseMax: 22.5, equityMin: 1.2, equityMax: 3.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Junior Designer. Negotiation focus: fixed + portfolio impact (CRED design bar uniquely high)." },
      mid: { totalMin: 19.2, totalMax: 54.0, baseMin: 15.0, baseMax: 42.1, equityMin: 2.3, equityMax: 6.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Mid Designer. Negotiation focus: fixed + level (Designer-2 vs Senior Designer mapping matters)." },
      senior: { totalMin: 33.6, totalMax: 96.0, baseMin: 26.2, baseMax: 74.9, equityMin: 4.0, equityMax: 11.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Senior Designer. Negotiation focus: fixed + ownership scope. Premium over peer unicorns." },
    },
    "data-analyst": {
      entry: { totalMin: 7.2, totalMax: 19.2, baseMin: 6.0, baseMax: 16.1, equityMin: 0.4, equityMax: 1.2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Junior Data Analyst. Negotiation focus: fixed (variable small at this level)." },
      mid: { totalMin: 12.0, totalMax: 33.6, baseMin: 10.1, baseMax: 28.2, equityMin: 0.7, equityMax: 2.0, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Mid Data Analyst. Negotiation focus: fixed + scope (Analyst-2 vs DS conversion)." },
      senior: { totalMin: 21.6, totalMax: 60.0, baseMin: 18.1, baseMax: 50.4, equityMin: 1.3, equityMax: 3.6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Senior Data Analyst. Negotiation focus: fixed + title." },
    },
    "marketing": {
      entry: { totalMin: 8.4, totalMax: 21.6, baseMin: 5.9, baseMax: 15.1, equityMin: 0.5, equityMax: 1.3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Junior Growth Marketer. Variable cap matters — pin down realistic OTE." },
      mid: { totalMin: 16.8, totalMax: 48.0, baseMin: 11.8, baseMax: 33.6, equityMin: 1.0, equityMax: 2.9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Mid Growth Marketer. Negotiation focus: CAC/ROI impact attribution." },
      senior: { totalMin: 30.0, totalMax: 96.0, baseMin: 21.0, baseMax: 67.2, equityMin: 1.8, equityMax: 5.8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08", lastVerified: "2026-05-08", notes: "CRED Senior Growth Marketer. Negotiation focus: growth impact attribution + fixed (variable can be 30%+)." },
    },
    "ml-engineer": {
      mid: { totalMin: 35, totalMax: 60, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + Levels.fyi (CRED L4 SE ₹6.25M median × ML 1.15-1.4x premium)", lastVerified: "2026-05-08", notes: "CRED ML mid; tracks SE band with GenAI premium.", sourceVerifiedAt: { glassdoor: "2026-05-08", levelsFyi: "2026-05-08" } },
      senior: { totalMin: 60, totalMax: 100, equityMin: 10, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (CRED Sr ML / L5)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
    "devops-sre": {
      mid: { totalMin: 28, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (CRED SRE/Infra mid)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 50, totalMax: 90, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  },

  zerodha: {
    "software-engineer": {
      entry: { totalMin: 9.5, totalMax: 26.6, baseMin: 7.6, baseMax: 21.3, equityType: "none", source: "Curated research 2026-05-08 — Zerodha SDE Junior worksheet (bootstrapped, no ESOP)", lastVerified: "2026-05-08", notes: "Zerodha Junior SE. Bootstrapped — equity 'unknown' in disclosures, treat as none. Bonus ₹1.4-4.0L. Joining bonus ₹0-2L. Negotiation focus: fixed salary." },
      mid: { totalMin: 17.1, totalMax: 47.5, baseMin: 13.7, baseMax: 38.0, equityType: "none", source: "Curated research 2026-05-08 — Zerodha SDE Mid worksheet", lastVerified: "2026-05-08", notes: "Zerodha Mid SE. Bonus ₹2.6-7.1L. Joining bonus ₹1-4L. Negotiation focus: fixed + role scope." },
      senior: { totalMin: 33.2, totalMax: 90.2, baseMin: 26.6, baseMax: 72.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha SDE Senior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Senior SE. Bonus ₹5.0-13.5L. Joining bonus ₹2-8L. 60-day notice. Negotiation focus: fixed + ownership." },
    },
    "backend-developer": {
      entry: { totalMin: 9.5, totalMax: 26.6, baseMin: 7.6, baseMax: 21.3, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Backend Junior", lastVerified: "2026-05-08", notes: "Zerodha Junior Backend. Bonus ₹1.4-4L. Negotiation focus: fixed." },
      mid: { totalMin: 17.1, totalMax: 47.5, baseMin: 13.7, baseMax: 38.0, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Backend Mid", lastVerified: "2026-05-08", notes: "Zerodha Mid Backend. Negotiation focus: backend ownership." },
      senior: { totalMin: 33.2, totalMax: 90.2, baseMin: 26.6, baseMax: 72.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Backend Senior", lastVerified: "2026-05-08", notes: "Zerodha Senior Backend. Negotiation focus: fixed + systems impact." },
    },
    "frontend-developer": {
      entry: { totalMin: 8.6, totalMax: 23.8, baseMin: 6.9, baseMax: 19.0, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Frontend Junior", lastVerified: "2026-05-08", notes: "Zerodha Junior Frontend. Bonus ₹1.3-3.6L. Negotiation focus: fixed." },
      mid: { totalMin: 15.2, totalMax: 42.8, baseMin: 12.2, baseMax: 34.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Frontend Mid", lastVerified: "2026-05-08", notes: "Zerodha Mid Frontend. Negotiation focus: UI/platform impact." },
      senior: { totalMin: 28.5, totalMax: 76.0, baseMin: 22.8, baseMax: 60.8, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Frontend Senior", lastVerified: "2026-05-08", notes: "Zerodha Senior Frontend. Negotiation focus: fixed + ownership." },
    },
    "mobile-developer": {
      entry: { totalMin: 9.5, totalMax: 26.6, baseMin: 7.6, baseMax: 21.3, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Mobile Junior", lastVerified: "2026-05-08", notes: "Zerodha Junior Mobile. Negotiation focus: fixed." },
      mid: { totalMin: 17.1, totalMax: 47.5, baseMin: 13.7, baseMax: 38.0, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Mobile Mid", lastVerified: "2026-05-08", notes: "Zerodha Mid Mobile. Negotiation focus: app reliability." },
      senior: { totalMin: 33.2, totalMax: 90.2, baseMin: 26.6, baseMax: 72.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Mobile Senior", lastVerified: "2026-05-08", notes: "Zerodha Senior Mobile. Negotiation focus: fixed + product impact." },
    },
    "product-manager": {
      entry: { totalMin: 13.3, totalMax: 30.4, baseMin: 10.4, baseMax: 23.7, equityType: "none", source: "Curated research 2026-05-08 — Zerodha PM Junior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Junior PM / APM. Bonus ₹2.4-5.5L. Joining bonus ₹1-3L. Negotiation focus: role scope." },
      mid: { totalMin: 23.8, totalMax: 66.5, baseMin: 18.6, baseMax: 51.9, equityType: "none", source: "Curated research 2026-05-08 — Zerodha PM Mid worksheet", lastVerified: "2026-05-08", notes: "Zerodha Mid PM. Bonus ₹4.3-12L. Joining bonus ₹2-6L. Negotiation focus: scope + fixed." },
      senior: { totalMin: 42.8, totalMax: 123.5, baseMin: 33.4, baseMax: 96.3, equityType: "none", source: "Curated research 2026-05-08 — Zerodha PM Senior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Senior PM. Bonus ₹7.7-22.2L. Joining bonus ₹4-12L. 60-day notice. Negotiation focus: product ownership." },
      lead: { totalMin: 67, totalMax: 171, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 238, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 7.6, totalMax: 22.8, baseMin: 6.2, baseMax: 18.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Product Designer Junior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Junior Product Designer. Bonus ₹1.0-2.7L. Negotiation focus: fixed + portfolio." },
      mid: { totalMin: 15.2, totalMax: 42.8, baseMin: 12.2, baseMax: 34.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Product Designer Mid worksheet", lastVerified: "2026-05-08", notes: "Zerodha Mid Product Designer. Bonus ₹1.9-5.1L. Negotiation focus: product impact." },
      senior: { totalMin: 26.6, totalMax: 76.0, baseMin: 21.3, baseMax: 60.8, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Product Designer Senior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Senior Product Designer. Bonus ₹3.2-9.1L. 60-day notice. Negotiation focus: ownership + craft." },
      lead: { totalMin: 43, totalMax: 114, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 57, totalMax: 143, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x ux-designer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 5.7, totalMax: 15.2, baseMin: 4.8, baseMax: 12.8, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Data Analyst Junior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Junior Data Analyst. Bonus ₹0.6-1.5L. Negotiation focus: fixed." },
      mid: { totalMin: 9.5, totalMax: 26.6, baseMin: 8.0, baseMax: 22.3, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Data Analyst Mid worksheet", lastVerified: "2026-05-08", notes: "Zerodha Mid Data Analyst. Bonus ₹1.0-2.7L. Negotiation focus: business impact." },
      senior: { totalMin: 17.1, totalMax: 47.5, baseMin: 14.4, baseMax: 39.9, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Data Analyst Senior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Senior Data Analyst. Bonus ₹1.7-4.8L. 60-day notice. Negotiation focus: analytics ownership." },
      lead: { totalMin: 27, totalMax: 71, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 95, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x data-analyst)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 3.3, totalMax: 9.5, baseMin: 2.9, baseMax: 8.2, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Customer Support Junior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Junior Customer Support. Bonus ₹0.3-1.1L. 30-day notice. Negotiation focus: fixed + shift terms." },
      mid: { totalMin: 5.7, totalMax: 17.1, baseMin: 4.9, baseMax: 14.7, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Customer Support Mid worksheet", lastVerified: "2026-05-08", notes: "Zerodha Mid Customer Support. Bonus ₹0.7-2.1L. Negotiation focus: fixed + workload." },
      senior: { totalMin: 10.5, totalMax: 36.1, baseMin: 9.0, baseMax: 31.0, equityType: "none", source: "Curated research 2026-05-08 — Zerodha Customer Support Senior worksheet", lastVerified: "2026-05-08", notes: "Zerodha Senior Customer Support. Bonus ₹1.3-4.3L. 60-day notice. Negotiation focus: team scope." },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 17, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 52, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 81, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 43, totalMax: 114, equityType: "none", source: "Seed dataset 2026-05-08 (zerodha 0.95x business-analyst)", lastVerified: "2026-05-08" },
    },
  },

  meesho: {
    "software-engineer": {
      entry: { totalMin: 16, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "AmbitionBox + Naukri (Meesho SDE-1 post-IPO) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Listed Dec 2025; SDE-1 RSU is now liquid. Negotiation focus: fixed + joining bonus." },
      mid: { totalMin: 26, totalMax: 42, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 5], source: "AmbitionBox (Meesho listed Dec 2025) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Listed Dec 2025 — ESOPs converted to RSUs. Negotiation focus: fixed + ESOP clarity." },
      senior: { totalMin: 42, totalMax: 68, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [3, 9], source: "AmbitionBox + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + level (against Meesho post-IPO grid)." },
    },
    "product-manager": {
      entry: { totalMin: 14, totalMax: 30, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 3], source: "Research backlog 2026-05-08 (Meesho APM/PM-1)", lastVerified: "2026-05-08", notes: "Negotiation focus: role scope." },
      mid: { totalMin: 28, totalMax: 45, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "AmbitionBox + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + ESOP." },
      senior: { totalMin: 45, totalMax: 90, equityMin: 8, equityMax: 20, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 12], source: "Research backlog 2026-05-08 (Meesho Sr PM/Director-track)", lastVerified: "2026-05-08", notes: "Negotiation focus: product ownership." },
    },
    "ux-designer": {
      entry: { totalMin: 8, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Research backlog 2026-05-08 (Meesho UX Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed." },
      mid: { totalMin: 18, totalMax: 30, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Glassdoor (Meesho 2,070 samples) + AmbitionBox UX peer band + research backlog 2026-05-08", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" }, notes: "Negotiation focus: portfolio + level." },
      senior: { totalMin: 30, totalMax: 50, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 7], source: "Glassdoor + research backlog 2026-05-08", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" }, notes: "Negotiation focus: product ownership." },
    },
    "ml-engineer": {
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Weekday/Glassdoor (Meesho AI/ML 5yr avg ₹29.6L)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 38, totalMax: 60, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (Meesho ML 10yr avg ₹42.75L; Eng Mgr ceiling ₹100.5L)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 15, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 27, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 48, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 71, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 95, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x data-analyst)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 17, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 30, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 52, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 81, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 43, totalMax: 114, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (meesho 0.95x business-analyst)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── FAANG India ─────────────────────────────────────────────── */
  google: {
    "software-engineer": {
      entry: { totalMin: 30, totalMax: 49, equityMin: 8, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 8], source: "Levels.fyi (Google India L3 / new-grad campus)", lastVerified: "2026-05-08", notes: "Google L3 India campus offer; sign-on ₹3-8L common. Negotiation focus: Level + RSU (push for L4 if YOE supports)." },
      mid: { totalMin: 50, totalMax: 87.5, equityMin: 18, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 15], source: "Levels.fyi (Google India L4 SWE)", lastVerified: "2026-05-08", notes: "Google L4 India median ₹62L total comp; high performers cross ₹78L. Negotiation focus: Level calibration (L4 vs L5 is the lever, not base %)." },
      senior: { totalMin: 80, totalMax: 130, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 30], source: "Levels.fyi (L5; band capped at 130L for trajectory math — top-end ₹166L observed at L5+ promo edge)", lastVerified: "2026-05-08", notes: "Google L5 senior. Negotiation focus: RSU + level (RSU refresher cycle is the load-bearing question)." },
      lead: { totalMin: 122, totalMax: 220, equityMin: 50, equityMax: 110, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [15, 50], source: "Levels.fyi (L6+ Staff; top-end ₹306L observed at L7)", lastVerified: "2026-05-08", notes: "Google L6 staff. Negotiation focus: Scope + RSU (manager-track L7 vs IC L7 is the second cut)." },
    },
    "ux-designer": {
      entry: { totalMin: 14, totalMax: 42, equityMin: 1.7, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [2, 7], source: "Levels.fyi 2026-05-08 (Google India UX Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Portfolio + level." },
      mid: { totalMin: 41, totalMax: 78.8, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [4, 15], source: "Levels.fyi (Google India UX)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product impact (specific surface owned)." },
      senior: { totalMin: 49, totalMax: 140, equityMin: 25, equityMax: 50, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [7, 25], source: "Levels.fyi (L5 Designer)", lastVerified: "2026-05-08", notes: "Negotiation focus: Design leadership + RSU grant." },
    },
    "product-manager": {
      entry: { totalMin: 24.5, totalMax: 56, equityMin: 3.4, equityMax: 7.8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 10], source: "Levels.fyi 2026-05-08 (Google APM India)", lastVerified: "2026-05-08", notes: "APM / L3 PM. Negotiation focus: Product scope." },
      mid: { totalMin: 43.8, totalMax: 122.5, equityMin: 18, equityMax: 38, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [6, 20], source: "Levels.fyi (Google India PM range ₹3.03M-₹31.02M, median ₹11.75M)", lastVerified: "2026-05-08", notes: "Google L4 PM India; range reflects spread between APM1 and L7. Negotiation focus: Level + scope.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 78.8, totalMax: 227.5, equityMin: 32, equityMax: 70, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [10, 35], source: "Levels.fyi (Google L5 PM India)", lastVerified: "2026-05-08", notes: "Negotiation focus: Org impact (cross-team scope drives premium).", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 150, totalMax: 280, equityMin: 55, equityMax: 110, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Google L6 PM India, top ₹31.02M)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "ml-engineer": {
      entry: { totalMin: 24.5, totalMax: 61.2, equityMin: 4.4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [4, 12], source: "Levels.fyi 2026-05-08 (Google India L3 ML)", lastVerified: "2026-05-08", notes: "Google L3 ML. Negotiation focus: AI scope (which area: search ranking / DeepMind / GenAI)." },
      mid: { totalMin: 49, totalMax: 140, equityMin: 20, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 25], source: "Levels.fyi (Google India L4 SE base ₹5.82M-₹8.5M + ML 1.1-1.2x premium)", lastVerified: "2026-05-08", notes: "Google L4 ML/Research India; GenAI/DeepMind roles edge higher. Negotiation focus: Model impact (specific model/team).", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 87.5, totalMax: 262.5, equityMin: 35, equityMax: 75, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [12, 45], source: "Levels.fyi (Google India L5 SE ₹9.84M-₹15.16M + ML premium)", lastVerified: "2026-05-08", notes: "Negotiation focus: Research/product impact + RSU grant.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 160, totalMax: 280, equityMin: 60, equityMax: 115, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Google L6 ML India + Eng Manager L5 ₹10.31M-₹32.75M reference)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
  
    "data-scientist": {
      entry: { totalMin: 18, totalMax: 44, equityMin: 3, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 35, totalMax: 105, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 61, totalMax: 193, equityMin: 9, equityMax: 27, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 96, totalMax: 280, equityMin: 13, equityMax: 39, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 140, totalMax: 368, equityMin: 20, equityMax: 52, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 18, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 39, totalMax: 114, equityMin: 6, equityMax: 17, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 70, totalMax: 210, equityMin: 11, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 105, totalMax: 298, equityMin: 16, equityMax: 45, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 149, totalMax: 385, equityMin: 22, equityMax: 58, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 18, totalMax: 39, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 88, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 61, totalMax: 166, equityMin: 6, equityMax: 17, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 96, totalMax: 245, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 131, totalMax: 315, equityMin: 13, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (google 1.75x program-manager)", lastVerified: "2026-05-08" },
    },
  },

  microsoft: {
    "software-engineer": {
      entry: { totalMin: 28, totalMax: 42, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "5yr (staggered 25-25-25-25 cliff variant)", joiningBonusOverride: [3, 8], source: "Levels.fyi (Microsoft India L59-L60 / new-grad campus)", lastVerified: "2026-05-08", notes: "Software Engineer Junior: L59-L60 calibration — push for L60 over L59 (band overlap; same package, faster review cycle)." },
      mid: { totalMin: 45, totalMax: 75, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "5yr (20-20-20-20-20)", joiningBonusOverride: [5, 15], source: "Levels.fyi (Microsoft India SDE)", lastVerified: "2026-05-08", notes: "Software Engineer Mid: L61-L62 — annual RSU refresh is the key lever (often 30-50% of new-hire grant). Ask for refresher floor in writing." },
      senior: { totalMin: 75, totalMax: 120, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [10, 25], source: "Levels.fyi (L62-L63)", lastVerified: "2026-05-08", notes: "Software Engineer Senior: L63-L64 — negotiate sign-on (often ₹15-25L) and team selection; Azure/AI orgs pay top of band." },
    },
    "ux-designer": {
      entry: { totalMin: 22, totalMax: 38, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [2, 6], source: "Levels.fyi (Microsoft India IC2 designer)", lastVerified: "2026-05-08", notes: "UX Designer Junior: portfolio + design-critique signal beats YOE. Ask for level mapping vs IC track." },
      mid: { totalMin: 35, totalMax: 70, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [4, 12], source: "Levels.fyi (₹3.48M-₹10.16M range)", lastVerified: "2026-05-08", notes: "UX Designer Mid: research vs craft split — lean Senior Designer if pre-IPO experience, else Designer 2." },
      senior: { totalMin: 64, totalMax: 102, equityMin: 22, equityMax: 45, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [8, 20], source: "Levels.fyi (L65)", lastVerified: "2026-05-08", notes: "UX Designer Senior: L65 staff/principal track; design system ownership is the leverage." },
    },
    "product-manager": {
      entry: { totalMin: 24, totalMax: 50, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [3, 8], source: "Levels.fyi (Microsoft India PM1-PM2 campus)", lastVerified: "2026-05-08", notes: "Product Manager Junior: APM/PM1 campus — push for PM2 if MBA + internship signal." },
      mid: { totalMin: 45, totalMax: 75, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [6, 15], source: "Levels.fyi", lastVerified: "2026-05-08", notes: "Product Manager Mid: PM2-Senior PM. RSU refresh + bonus target (15-20% on-target) are negotiable." },
      senior: { totalMin: 75, totalMax: 120, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "5yr / staggered", joiningBonusOverride: [10, 25], source: "Levels.fyi", lastVerified: "2026-05-08", notes: "Product Manager Senior: Principal PM (L65) — scope (org-wide vs team) drives the level call more than YOE." },
    },
  
    "ml-engineer": {
      entry: { totalMin: 22, totalMax: 54, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 43, totalMax: 124, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 78, totalMax: 233, equityMin: 14, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 124, totalMax: 341, equityMin: 22, equityMax: 61, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 155, totalMax: 434, equityMin: 28, equityMax: 78, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 16, totalMax: 39, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 31, totalMax: 93, equityMin: 4, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 171, equityMin: 8, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 248, equityMin: 12, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 326, equityMin: 17, equityMax: 46, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 16, totalMax: 43, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 34, totalMax: 101, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 62, totalMax: 186, equityMin: 9, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 93, totalMax: 264, equityMin: 14, equityMax: 40, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 132, totalMax: 341, equityMin: 20, equityMax: 51, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 16, totalMax: 34, equityMin: 2, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 78, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 147, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 217, equityMin: 9, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 116, totalMax: 279, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (microsoft 1.55x program-manager)", lastVerified: "2026-05-08" },
    },
  },

  amazon: {
    "software-engineer": {
      entry: { totalMin: 22, totalMax: 32, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / back-loaded (5-15-40-40)", joiningBonusOverride: [3, 6], source: "Levels.fyi (Amazon India SDE-1 / L4 campus)", lastVerified: "2026-05-08", notes: "Software Engineer Junior: SDE-1 / L4. Year-1 + Year-2 sign-on (₹3-6L each year) is non-negotiable structure — confirm Y1 vs Y2 split." },
      mid: { totalMin: 38, totalMax: 65, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 5-15-40-40 (back-loaded)", joiningBonusOverride: [6, 15], source: "Levels.fyi (Amazon India SDE-2)", lastVerified: "2026-05-08", notes: "Software Engineer Mid: SDE-2 / L5. RSU vest is back-loaded (5-15-40-40); push for Y1+Y2 sign-on to fund the cash gap." },
      senior: { totalMin: 65, totalMax: 110, equityMin: 18, equityMax: 45, equityType: "rsu", equityVesting: "4yr / back-loaded", joiningBonusOverride: [12, 30], source: "Levels.fyi (SDE-3 / L6)", lastVerified: "2026-05-08", notes: "Software Engineer Senior: SDE-3 / L6 — level mapping is THE lever (L6 vs L5 = ~₹25-40L gap). Performance bonus + on-call premium negotiable." },
    },
    "ux-designer": {
      mid: { totalMin: 29, totalMax: 50, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / back-loaded", joiningBonusOverride: [4, 10], source: "Levels.fyi (₹2.88M-₹6.45M range)", lastVerified: "2026-05-08", notes: "UX Designer Mid: L5 designer — relocation support + remote flex are levers, RSU floor is hard to move." },
      senior: { totalMin: 50, totalMax: 65, equityMin: 14, equityMax: 28, equityType: "rsu", equityVesting: "4yr / back-loaded", joiningBonusOverride: [8, 20], source: "Levels.fyi (L6)", lastVerified: "2026-05-08", notes: "UX Designer Senior: L6 — team-location and AWS vs Retail org changes pay envelope." },
    },
  
    "product-manager": {
      entry: { totalMin: 19, totalMax: 43, equityMin: 3, equityMax: 6, equityType: "rsu", equityVesting: "4yr back-weighted", joiningBonusOverride: [3, 6], source: "Seed dataset 2026-05-08 (amazon 1.35x product-manager)", lastVerified: "2026-05-08", notes: "Product Manager Junior: PM-T / L4 — written-narrative skill (6-pager) is the rubric. Y1+Y2 sign-on standard." },
      mid: { totalMin: 34, totalMax: 95, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr back-weighted", joiningBonusOverride: [6, 15], source: "Seed dataset 2026-05-08 (amazon 1.35x product-manager)", lastVerified: "2026-05-08", notes: "Product Manager Mid: PMT-L5. Two-pizza-team scope vs platform PM scope changes pay; ask which org." },
      senior: { totalMin: 61, totalMax: 176, equityMin: 9, equityMax: 25, equityType: "rsu", equityVesting: "4yr back-weighted", joiningBonusOverride: [12, 30], source: "Seed dataset 2026-05-08 (amazon 1.35x product-manager)", lastVerified: "2026-05-08", notes: "Product Manager Senior: Senior PM-T / L6 — P&L ownership signal + AWS pricing-power orgs pay top of band." },
      lead: { totalMin: 95, totalMax: 243, equityMin: 13, equityMax: 34, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 128, totalMax: 338, equityMin: 18, equityMax: 47, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x product-manager)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 19, totalMax: 47, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 38, totalMax: 108, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 68, totalMax: 203, equityMin: 12, equityMax: 37, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 108, totalMax: 297, equityMin: 19, equityMax: 53, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 135, totalMax: 378, equityMin: 24, equityMax: 68, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 14, totalMax: 34, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 81, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 149, equityMin: 7, equityMax: 21, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 216, equityMin: 10, equityMax: 30, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 108, totalMax: 284, equityMin: 15, equityMax: 40, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 14, totalMax: 38, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 30, totalMax: 88, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 162, equityMin: 8, equityMax: 24, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 81, totalMax: 230, equityMin: 12, equityMax: 35, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 115, totalMax: 297, equityMin: 17, equityMax: 45, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 14, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr back-weighted", joiningBonusOverride: [2, 5], source: "Seed dataset 2026-05-08 (amazon 1.35x program-manager)", lastVerified: "2026-05-08", notes: "Program Manager Junior: TPM/PgM L4 — written-doc skill weighted heavily." },
      mid: { totalMin: 24, totalMax: 68, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "4yr back-weighted", joiningBonusOverride: [4, 10], source: "Seed dataset 2026-05-08 (amazon 1.35x program-manager)", lastVerified: "2026-05-08", notes: "Program Manager Mid: TPM L5 — cross-team scope is the leverage; ask for first review cycle in writing." },
      senior: { totalMin: 47, totalMax: 128, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr back-weighted", joiningBonusOverride: [10, 25], source: "Seed dataset 2026-05-08 (amazon 1.35x program-manager)", lastVerified: "2026-05-08", notes: "Program Manager Senior: Senior TPM L6 — org-wide programs vs single-team is the level call." },
      lead: { totalMin: 74, totalMax: 189, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 101, totalMax: 243, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x program-manager)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 24, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 43, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 74, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 43, totalMax: 115, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 61, totalMax: 162, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr back-weighted", source: "Seed dataset 2026-05-08 (amazon 1.35x business-analyst)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── IT Services ─────────────────────────────────────────────── */
  tcs: {
    "software-engineer": {
      /* TCS pays via THREE distinct fresher → IC tracks. The AI must probe
         which track the candidate is on (or pattern-match from resume) before
         quoting a number — quoting ₹4L to a Digital-track candidate destroys
         simulation credibility instantly. Bands below cover the full
         Ninja → Prime envelope; the `notes` field tells the LLM how to triage.
         Track signals (use to anchor within the band):
           - Ninja: standard NQT score, basic CS skills, no high-leverage signal
           - Digital: top NQT/coding score, hackathon/internship/GitHub, CS+
           - Prime: top-of-batch (rare), DSA-strong, often deferred-offer cases */
      entry: {
        totalMin: 3.4, totalMax: 11.5,
        baseMin: 3.0, baseMax: 9.5,
        equityType: "none",
        joiningBonusOverride: [0, 1.5],
        source: "TCS NQT 2026 disclosure (Ninja ₹3.36L / Digital ₹7-9L / Prime ₹11.5L) + AmbitionBox cross-check",
        lastVerified: "2026-05-09",
        notes: "Three fresher tracks — Ninja ₹3.4-4L (most common), Digital ₹7-9L (top NQT scorers + coding test), Prime ₹11.5L (small elite cohort). PROBE the candidate's track before quoting; default-anchor at ₹5-6L only if track is unknown. No ESOP. ₹0.5L service bond (waived for Digital/Prime). 90-day notice.",
      },
      mid: {
        totalMin: 5, totalMax: 15,
        baseMin: 4.2, baseMax: 12,
        equityType: "none",
        joiningBonusOverride: [0, 2],
        source: "AmbitionBox 2026 + Glassdoor TCS Systems Engineer / IT Analyst cohort",
        lastVerified: "2026-05-09",
        notes: "3-5 YOE post-Ninja Systems Engineer / IT Analyst is ₹5-9L. Digital-track promoted ICs and lateral hires with niche skills (cloud, SAP, ServiceNow, GenAI) reach ₹10-15L. Onsite-deputation returnees often re-enter at ₹12-15L+.",
      },
      senior: {
        totalMin: 10, totalMax: 25,
        baseMin: 8, baseMax: 20,
        equityType: "none",
        joiningBonusOverride: [0, 3],
        source: "AmbitionBox + Levels.fyi TCS Associate Consultant / IT Analyst Senior cohort",
        lastVerified: "2026-05-09",
        notes: "5-8 YOE Associate Consultant / IT Analyst Senior. Standard track ₹10-16L; Digital/specialty (cloud architect, SAP S/4 lead, GenAI) reaches ₹16-25L. Onsite-deputation premium adds ₹3-6L for US/UK returnees.",
      },
      lead: {
        totalMin: 16, totalMax: 38,
        baseMin: 13, baseMax: 30,
        equityType: "none",
        joiningBonusOverride: [0, 4],
        source: "Glassdoor TCS Consultant / Senior Consultant + Levels.fyi",
        lastVerified: "2026-05-09",
        notes: "8-12 YOE Consultant / Senior Consultant. Service-line (BFSI, retail) ₹16-28L; Digital practice (cloud, AI, GenAI architect) ₹25-38L. Variable component 10-15% of CTC (low for tier-1 IT services).",
      },
      executive: {
        totalMin: 28, totalMax: 65,
        baseMin: 22, baseMax: 50,
        equityType: "none",
        joiningBonusOverride: [0, 6],
        source: "Glassdoor TCS Manager / Delivery Manager + DRHP filings",
        lastVerified: "2026-05-09",
        notes: "12+ YOE Manager / Delivery Manager. Manager bracket ₹28-45L; Senior Manager / Delivery Lead ₹45-65L. P&L ownership is the lever. No equity but ESPP available.",
      },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "AmbitionBox / Glassdoor 2026 (TCS UI/UX fresher–junior)", lastVerified: "2026-05-09", notes: "TCS designers are paid on the IT-services scale, not the unicorn-startup scale. AmbitionBox 2026: TCS UI/UX avg ₹6.5-7.5L. Don't anchor against Razorpay / Swiggy bands here." },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "AmbitionBox / Glassdoor 2026 (TCS UI/UX 2-5 yr)", lastVerified: "2026-05-09", notes: "Mid-level TCS designer typically ₹8-10L; ₹12 only for Digital-track / onsite-bound specialists." },
      senior: { totalMin: 10, totalMax: 15, equityType: "none", source: "AmbitionBox / Glassdoor 2026 (TCS UI/UX 5+ yr)", lastVerified: "2026-05-09", notes: "Senior TCS designer ₹10-15L. Above ₹15L only at Lead Designer / Design Manager band." },
      lead: { totalMin: 14, totalMax: 22, equityType: "none", source: "AmbitionBox / Glassdoor 2026 (TCS Design Manager)", lastVerified: "2026-05-09" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 6, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 7, totalMax: 20, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 11, totalMax: 32, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 16, totalMax: 43, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 8, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 14, totalMax: 38, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 20, totalMax: 54, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 23, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 43, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 63, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 34, totalMax: 81, equityType: "none", source: "Seed dataset 2026-05-08 (tcs 0.45x project-manager)", lastVerified: "2026-05-08" },
    },
  },

  infosys: {
    "software-engineer": {
      entry: { totalMin: 3.6, totalMax: 6.25, equityType: "none", source: "Infosys 2026 fresher disclosure", lastVerified: "2026-05-07", notes: "DSE ₹3.6-6.25L; Specialist Programmer L3 ₹21L, L2 ₹16L, L1 ₹10L. Wide spread by track." },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 7, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 8, totalMax: 22, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 12, totalMax: 34, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 17, totalMax: 46, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 9, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 15, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 26, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 15, totalMax: 41, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 22, totalMax: 58, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 46, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 67, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 86, equityType: "none", source: "Seed dataset 2026-05-08 (infosys 0.48x project-manager)", lastVerified: "2026-05-08" },
    },
  },

  cognizant: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Cognizant GenC / GenC Next 2026 disclosure", lastVerified: "2026-05-07", notes: "GenC ₹4L; GenC Next ₹6.5L. In-hand ₹28-32K/mo for GenC." },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 8, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 14, totalMax: 39, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 19, totalMax: 52, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 10, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 18, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 47, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 25, totalMax: 66, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 52, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 77, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 99, equityType: "none", source: "Seed dataset 2026-05-08 (cognizant 0.55x project-manager)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── Big Tech (Levels.fyi-grounded) ───────────────────────── */
  adobe: {
    "software-engineer": {
      entry: { totalMin: 24, totalMax: 37.8, equityMin: 4, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25 (periodic)", joiningBonusOverride: [2, 6], source: "Levels.fyi (Adobe India ₹2.46M-₹23.81M, P10)", lastVerified: "2026-05-08", notes: "Software Engineer Junior: Fixed + RSU lever — Adobe's RSU refreshers are generous (3-5% annual top-up). Push for written refresher floor." },
      mid: { totalMin: 45, totalMax: 80, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [4, 12], source: "Levels.fyi (Adobe India median ₹6.98M, P30-P40)", lastVerified: "2026-05-08", notes: "Software Engineer Mid: level calibration — push for IC4 over IC3 if pre-existing GenAI/Firefly experience." },
      senior: { totalMin: 75, totalMax: 130, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [7, 25], source: "Levels.fyi (P50)", lastVerified: "2026-05-08", notes: "Software Engineer Senior: Fixed + equity — Firefly/GenAI orgs pay top of band; ESPP (15% discount) is a real take-home boost." },
      lead: { totalMin: 120, totalMax: 200, equityMin: 50, equityMax: 100, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P60 ₹23.81M+)", lastVerified: "2026-05-08" },
    },
  
    "product-manager": {
      entry: { totalMin: 18.9, totalMax: 43.2, equityMin: 2.6, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [2, 8], source: "Levels.fyi (Adobe India PM IC2)", lastVerified: "2026-05-08", notes: "Product Manager Junior: scope lever — DX (Experience Cloud) vs DMe (Creative Cloud) orgs differ in pay envelope." },
      mid: { totalMin: 33.8, totalMax: 94.5, equityMin: 4.7, equityMax: 13.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 16], source: "Levels.fyi (Adobe India PM IC3-IC4)", lastVerified: "2026-05-08", notes: "Product Manager Mid: product impact — Firefly/GenAI PM is scarce-skill premium." },
      senior: { totalMin: 60.8, totalMax: 175.5, equityMin: 8.5, equityMax: 24.6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 30], source: "Levels.fyi (Adobe India PM IC5)", lastVerified: "2026-05-08", notes: "Product Manager Senior: org scope — DX vs DMe org assignment is the lever; first-appraisal date in writing." },
      lead: { totalMin: 95, totalMax: 243, equityMin: 13, equityMax: 34, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 128, totalMax: 338, equityMin: 18, equityMax: 47, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 61, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 108, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 162, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 81, totalMax: 203, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 19, totalMax: 47, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 38, totalMax: 108, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 68, totalMax: 203, equityMin: 12, equityMax: 37, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 108, totalMax: 297, equityMin: 19, equityMax: 53, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 135, totalMax: 378, equityMin: 24, equityMax: 68, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 14, totalMax: 34, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 81, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 149, equityMin: 7, equityMax: 21, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 216, equityMin: 10, equityMax: 30, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 108, totalMax: 284, equityMin: 15, equityMax: 40, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x data-scientist)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 14, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 68, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 128, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 189, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 101, totalMax: 243, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr / annual", source: "Seed dataset 2026-05-08 (adobe 1.35x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  salesforce: {
    "software-engineer": {
      entry: { totalMin: 27, totalMax: 38, equityMin: 5, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 25-25-25-25 (periodic)", joiningBonusOverride: [2, 7], source: "Levels.fyi (Associate MTS ₹2.72M)", lastVerified: "2026-05-08", notes: "Software Engineer Junior: AMTS / MTS calibration — push for MTS over AMTS with intern-conversion signal; Fixed + RSU lever." },
      mid: { totalMin: 45, totalMax: 80, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [4, 14], source: "Levels.fyi (median ₹7.23M)", lastVerified: "2026-05-08", notes: "Software Engineer Mid: level calibration — SMTS vs MTS = ₹15-25L gap; product/cloud team (Sales Cloud vs Data Cloud vs MuleSoft) drives top-of-band." },
      senior: { totalMin: 75, totalMax: 130, equityMin: 25, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 25], source: "Levels.fyi (LMTS / SMTS)", lastVerified: "2026-05-08", notes: "Software Engineer Senior: Fixed + RSU — LMTS / SMTS calibration. Salesforce RSU vest is annual cliff (uncommon vs quarterly peers); confirm vest schedule in offer." },
      lead: { totalMin: 130, totalMax: 250, equityMin: 60, equityMax: 130, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Architect ₹25.8M+)", lastVerified: "2026-05-08" },
    },
  
    "product-manager": {
      entry: { totalMin: 19, totalMax: 43, equityMin: 3, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 34, totalMax: 95, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 61, totalMax: 176, equityMin: 9, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 95, totalMax: 243, equityMin: 13, equityMax: 34, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 128, totalMax: 338, equityMin: 18, equityMax: 47, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 61, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 108, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 162, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 81, totalMax: 203, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x ux-designer)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 14, totalMax: 38, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 30, totalMax: 88, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 162, equityMin: 8, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 81, totalMax: 230, equityMin: 12, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 115, totalMax: 297, equityMin: 17, equityMax: 45, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 14, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 68, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 128, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 189, equityMin: 7, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 101, totalMax: 243, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x program-manager)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 9.4, totalMax: 24.3, equityMin: 0.5, equityMax: 1.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [1, 4], source: "Levels.fyi (Salesforce India Account Executive Jr)", lastVerified: "2026-05-08", notes: "Account Executive Junior: OTE clarity — fixed/variable split (often 60/40), quota size in writing; ramp period (Y1 quota relief) is the lever." },
      mid: { totalMin: 18.9, totalMax: 56.7, equityMin: 0.9, equityMax: 2.8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 10], source: "Levels.fyi (Salesforce India AE Mid)", lastVerified: "2026-05-08", notes: "Account Executive Mid: quota + accelerators — accelerator multiplier above 100% attainment is the negotiation lever (often 1.5x-2.5x)." },
      senior: { totalMin: 35.1, totalMax: 121.5, equityMin: 1.8, equityMax: 6.1, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 20], source: "Levels.fyi (Salesforce India AE Sr / Enterprise)", lastVerified: "2026-05-08", notes: "Account Executive Senior: OTE realism — quota history (last 4 quarters attainment) + named-account list is the leverage." },
      lead: { totalMin: 61, totalMax: 189, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 297, equityMin: 6, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x sales)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 5, totalMax: 22, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 43, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x customer-success)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 81, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x customer-success)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 122, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 68, totalMax: 176, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (salesforce 1.35x customer-success)", lastVerified: "2026-05-08" },
    },
  },
  atlassian: {
    "software-engineer": {
      entry: { totalMin: 36, totalMax: 48, equityMin: 6, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [2, 5], source: "Levels.fyi (Atlassian India P30 ₹4.01M)", lastVerified: "2026-05-07", notes: "Atlassian P30 entry. Generous RSU refreshers — RSU is public-market linked (lower liquidity risk than ESOP). Negotiation focus: Fixed + RSU." },
      mid: { totalMin: 55, totalMax: 95, equityMin: 15, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 9], source: "Levels.fyi (P40-P50, median ₹8.28M)", lastVerified: "2026-05-07", notes: "P40-P50 mid IC. Negotiation focus: RSU + level (P40 vs P50 calibration is the lever)." },
      senior: { totalMin: 90, totalMax: 150, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 18], source: "Levels.fyi (P50-P60)", lastVerified: "2026-05-07", notes: "P50-P60 senior. Negotiation focus: Level calibration (P50 vs P60 = ~30-40% comp gap)." },
      lead: { totalMin: 140, totalMax: 180, equityMin: 55, equityMax: 90, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [10, 35], source: "Levels.fyi (P60 ₹17.56M+)", lastVerified: "2026-05-07", notes: "P60 staff/principal. Negotiation focus: Staff/lead calibration + RSU grant size." },
    },
    "product-manager": {
      entry: { totalMin: 21.7, totalMax: 49.6, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [2, 6], source: "Levels.fyi 2026-05-08 (Atlassian PM Junior India)", lastVerified: "2026-05-08", notes: "Negotiation focus: Scope + RSU." },
      mid: { totalMin: 50, totalMax: 108, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 15], source: "Levels.fyi (P40-P50 PM)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product scope (cloud product / DC product is the cut)." },
      senior: { totalMin: 70, totalMax: 200, equityMin: 28, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 28], source: "Levels.fyi (P50-P60 PM)", lastVerified: "2026-05-08", notes: "Negotiation focus: Org impact + RSU grant size." },
    },
  
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 37, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 25, totalMax: 70, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 43, totalMax: 124, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 70, totalMax: 186, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 93, totalMax: 233, equityMin: 11, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 22, totalMax: 54, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 43, totalMax: 124, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 78, totalMax: 233, equityMin: 14, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 124, totalMax: 341, equityMin: 22, equityMax: 61, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 155, totalMax: 434, equityMin: 28, equityMax: 78, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 16, totalMax: 39, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 31, totalMax: 93, equityMin: 4, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 171, equityMin: 8, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 248, equityMin: 12, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 326, equityMin: 17, equityMax: 46, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 16, totalMax: 43, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 34, totalMax: 101, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 62, totalMax: 186, equityMin: 9, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 93, totalMax: 264, equityMin: 14, equityMax: 40, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 132, totalMax: 341, equityMin: 20, equityMax: 51, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 16, totalMax: 34, equityMin: 2, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 78, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 147, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 217, equityMin: 9, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 116, totalMax: 279, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (atlassian 1.55x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  uber: {
    "software-engineer": {
      entry: { totalMin: 30, totalMax: 42, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Uber SE-I India median ₹36.27L)", lastVerified: "2026-05-07" },
      mid: { totalMin: 50, totalMax: 80, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (SE-II)", lastVerified: "2026-05-07" },
      senior: { totalMin: 80, totalMax: 130, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (SE-III / Senior)", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 22, totalMax: 50, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 39, totalMax: 109, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 70, totalMax: 202, equityMin: 10, equityMax: 28, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 109, totalMax: 279, equityMin: 15, equityMax: 39, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 147, totalMax: 388, equityMin: 21, equityMax: 54, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x product-manager)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 22, totalMax: 54, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 43, totalMax: 124, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 78, totalMax: 233, equityMin: 14, equityMax: 42, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 124, totalMax: 341, equityMin: 22, equityMax: 61, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 155, totalMax: 434, equityMin: 28, equityMax: 78, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 16, totalMax: 39, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 31, totalMax: 93, equityMin: 4, equityMax: 13, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 171, equityMin: 8, equityMax: 24, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 248, equityMin: 12, equityMax: 35, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 326, equityMin: 17, equityMax: 46, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 16, totalMax: 43, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 34, totalMax: 101, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 62, totalMax: 186, equityMin: 9, equityMax: 28, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 93, totalMax: 264, equityMin: 14, equityMax: 40, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 132, totalMax: 341, equityMin: 20, equityMax: 51, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 16, totalMax: 34, equityMin: 2, equityMax: 3, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 78, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 147, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 217, equityMin: 9, equityMax: 22, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 116, totalMax: 279, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (uber 1.55x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  apple: {
    "software-engineer": {
      entry: { totalMin: 30, totalMax: 44, equityMin: 7, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25 (periodic vesting)", joiningBonusOverride: [2, 7], source: "Levels.fyi (Apple India ICT2 / new-grad)", lastVerified: "2026-05-08", notes: "Software Engineer Junior: ICT2 calibration — push for ICT2 over ICT1; hardware/software team scope changes RSU envelope." },
      mid: { totalMin: 50, totalMax: 80, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [4, 14], source: "Levels.fyi (Apple India ICT3-ICT4)", lastVerified: "2026-05-08", notes: "Software Engineer Mid: ICT3-ICT4 — Fixed + RSU is the lever. Apple bonus target lower than peers (3-10%); negotiate base + RSU." },
      senior: { totalMin: 85, totalMax: 140, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 25], source: "Levels.fyi (ICT5)", lastVerified: "2026-05-08", notes: "Software Engineer Senior: ICT5 — level calibration is the primary lever (ICT4 vs ICT5 = ~₹35-50L gap). Silicon/AI orgs pay top of band." },
    },
    "firmware-engineer": {
      entry: { totalMin: 16, totalMax: 43.5, equityMin: 2.2, equityMax: 6.1, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [2, 8], source: "Levels.fyi (Apple India hardware/firmware ICT2)", lastVerified: "2026-05-08", notes: "Firmware Engineer Junior: hardware/software niche — scarce-skill premium, push for ICT3 if embedded experience." },
      mid: { totalMin: 29, totalMax: 79.8, equityMin: 4.1, equityMax: 11.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 16], source: "Levels.fyi (Apple India firmware ICT3-ICT4)", lastVerified: "2026-05-08", notes: "Firmware Engineer Mid: scarce-skill premium — silicon/SoC vs peripherals split; AppleSilicon org pays top of band." },
      senior: { totalMin: 55, totalMax: 145, equityMin: 7.7, equityMax: 20.3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 28], source: "Levels.fyi (Apple India firmware ICT5)", lastVerified: "2026-05-08", notes: "Firmware Engineer Senior: deep-expertise lever — ICT5 hardware lead, RSU grant size negotiable based on patent portfolio." },
    },

    "product-manager": {
      entry: { totalMin: 20, totalMax: 46.4, equityMin: 2.8, equityMax: 6.5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 9], source: "Levels.fyi (Apple India PM ICT2)", lastVerified: "2026-05-08", notes: "Product Manager Junior: scope lever — software PM vs hardware PM differs; hardware PMs scarcer." },
      mid: { totalMin: 36.2, totalMax: 101.5, equityMin: 5.1, equityMax: 14.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [6, 20], source: "Levels.fyi (Apple India PM ICT3-ICT4)", lastVerified: "2026-05-08", notes: "Product Manager Mid: product scope — Services vs Hardware org changes envelope; ask for first-appraisal date in writing." },
      senior: { totalMin: 65.2, totalMax: 188.5, equityMin: 9.1, equityMax: 26.4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [10, 35], source: "Levels.fyi (Apple India PM ICT5)", lastVerified: "2026-05-08", notes: "Product Manager Senior: strategic ownership — global mobility option (Cupertino transfer) is a real lever for top performers." },
      lead: { totalMin: 102, totalMax: 261, equityMin: 14, equityMax: 37, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (apple 1.45x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 138, totalMax: 363, equityMin: 19, equityMax: 51, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (apple 1.45x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 35, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 65, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 116, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 65, totalMax: 174, equityMin: 8, equityMax: 21, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 87, totalMax: 218, equityMin: 10, equityMax: 26, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 20.3, totalMax: 50.8, equityMin: 3.7, equityMax: 9.1, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 10], source: "Levels.fyi (Apple India ML ICT2)", lastVerified: "2026-05-08", notes: "ML Engineer Junior: AI/ML scope — Apple Intelligence org pays top of band; ask for team mapping." },
      mid: { totalMin: 40.6, totalMax: 116, equityMin: 7.3, equityMax: 20.9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [7, 22], source: "Levels.fyi (Apple India ML ICT3-ICT4)", lastVerified: "2026-05-08", notes: "ML Engineer Mid: model/product impact — on-device ML (Core ML) vs cloud-AI orgs differ in pay envelope." },
      senior: { totalMin: 72.5, totalMax: 217.5, equityMin: 13, equityMax: 39.1, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [12, 40], source: "Levels.fyi (Apple India ML ICT5)", lastVerified: "2026-05-08", notes: "ML Engineer Senior: AI ownership — Apple Foundation Models / Apple Intelligence orgs negotiate top of band, RSU grant size is the lever." },
      lead: { totalMin: 116, totalMax: 319, equityMin: 21, equityMax: 57, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 145, totalMax: 406, equityMin: 26, equityMax: 73, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 14.5, totalMax: 31.9, equityMin: 1.4, equityMax: 3.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [2, 8], source: "Levels.fyi (Apple India PgM ICT2)", lastVerified: "2026-05-08", notes: "Program Manager Junior: scope lever — hardware launch programs vs software programs differ in scarcity premium." },
      mid: { totalMin: 26.1, totalMax: 72.5, equityMin: 2.6, equityMax: 7.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [4, 14], source: "Levels.fyi (Apple India PgM ICT3-ICT4)", lastVerified: "2026-05-08", notes: "Program Manager Mid: cross-functional scope — hardware NPI programs are scarce-skill premium." },
      senior: { totalMin: 50.8, totalMax: 137.8, equityMin: 5.1, equityMax: 13.8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [8, 25], source: "Levels.fyi (Apple India PgM ICT5)", lastVerified: "2026-05-08", notes: "Program Manager Senior: launch/program ownership — global launch program scope is the lever." },
      lead: { totalMin: 80, totalMax: 203, equityMin: 8, equityMax: 20, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 109, totalMax: 261, equityMin: 11, equityMax: 26, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Seed dataset 2026-05-08 (apple 1.45x program-manager)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11.6, totalMax: 29, equityMin: 0.2, equityMax: 0.6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [1, 5], source: "Levels.fyi (Apple India Supply Chain ICT2)", lastVerified: "2026-05-08", notes: "Supply Chain / Ops Junior: fixed + ops scope — SCM track has lower RSU envelope vs SE/PM tracks." },
      mid: { totalMin: 20.3, totalMax: 58, equityMin: 0.4, equityMax: 1.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [3, 10], source: "Levels.fyi (Apple India Supply Chain ICT3-ICT4)", lastVerified: "2026-05-08", notes: "Supply Chain / Ops Mid: vendor/process scope — supplier-management ownership negotiable." },
      senior: { totalMin: 36.2, totalMax: 108.8, equityMin: 0.7, equityMax: 2.2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", joiningBonusOverride: [5, 18], source: "Levels.fyi (Apple India Supply Chain ICT5)", lastVerified: "2026-05-08", notes: "Supply Chain / Ops Senior: global ops impact — APAC manufacturing program ownership is top-of-band lever." },
    },
  },
  stripe: {
    "software-engineer": {
      entry: { totalMin: 32, totalMax: 48, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Stripe India campus / new-grad (Glassdoor + Stripe disclosures)", lastVerified: "2026-05-07", notes: "Stripe SE-I India; bar-raising writing screen even at campus." },
      mid: { totalMin: 50, totalMax: 85, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Stripe India product-engineering team (Bengaluru)", lastVerified: "2026-05-07", notes: "Stripe's writing-clarity bar is unusually high; expect culture-fit weight in offer." },
      senior: { totalMin: 85, totalMax: 140, equityMin: 28, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Stripe India internal disclosures + Glassdoor", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 23, totalMax: 53, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 41, totalMax: 116, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 74, totalMax: 215, equityMin: 10, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 116, totalMax: 297, equityMin: 16, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 157, totalMax: 413, equityMin: 22, equityMax: 58, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 7, totalMax: 40, equityMin: 1, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 74, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 46, totalMax: 132, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 198, equityMin: 9, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 99, totalMax: 248, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 23, totalMax: 58, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 46, totalMax: 132, equityMin: 8, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 83, totalMax: 248, equityMin: 15, equityMax: 45, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 132, totalMax: 363, equityMin: 24, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 165, totalMax: 462, equityMin: 30, equityMax: 83, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 17, totalMax: 46, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 36, totalMax: 107, equityMin: 5, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 66, totalMax: 198, equityMin: 10, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 99, totalMax: 281, equityMin: 15, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 140, totalMax: 363, equityMin: 21, equityMax: 54, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 17, totalMax: 36, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 30, totalMax: 83, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 58, totalMax: 157, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 91, totalMax: 231, equityMin: 9, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 297, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (stripe 1.65x program-manager)", lastVerified: "2026-05-08" },
    },
  },

  /* Databricks India — premium GCC; pre-IPO RSUs (liquidity via tender offers).
     Levels.fyi India SE range ₹6.14M-₹17.04M, median ₹7.5M (Bengaluru median ₹9.55M).
     L3 entry ₹3.51M-₹7.54M. 6figr India avg ₹76L confirms top-end skew. */
  databricks: {
    "software-engineer": {
      entry: { totalMin: 35, totalMax: 75, equityMin: 6, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi L3 India ₹3.51M-₹7.54M", lastVerified: "2026-05-08", notes: "Databricks L3 / new-grad India; pre-IPO — RSUs liquid via periodic tender offers, not open market.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      mid: { totalMin: 60, totalMax: 100, equityMin: 12, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi L4 India + Bengaluru median ₹9.55M", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 95, totalMax: 155, equityMin: 22, equityMax: 45, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi L5 India (top ₹17.04M = ₹170L total range)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 150, totalMax: 220, equityMin: 38, equityMax: 70, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi L6/Staff India + Glassdoor (143 samples)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08", glassdoor: "2026-05-08" } },
    },
    "ml-engineer": {
      mid: { totalMin: 70, totalMax: 120, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Databricks ML — Mosaic acquisition uplift)", lastVerified: "2026-05-08", notes: "Databricks ML bar exceptionally high post-Mosaic. Ranges run ~1.2-1.4x SE.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 115, totalMax: 190, equityMin: 28, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Databricks Sr ML / Research)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 180, totalMax: 280, equityMin: 45, equityMax: 80, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Databricks Staff/Principal ML)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "data-scientist": {
      mid: { totalMin: 50, totalMax: 90, equityMin: 9, equityMax: 20, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Databricks DS India)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 85, totalMax: 150, equityMin: 18, equityMax: 38, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 130, totalMax: 220, equityMin: 28, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "devops-sre": {
      mid: { totalMin: 55, totalMax: 95, equityMin: 11, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Databricks SRE/Infra mid)", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 90, totalMax: 160, equityMin: 20, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      lead: { totalMin: 145, totalMax: 230, equityMin: 35, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
  
    "program-manager": {
      entry: { totalMin: 18, totalMax: 39, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (databricks 1.75x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 88, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (databricks 1.75x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 61, totalMax: 166, equityMin: 6, equityMax: 17, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (databricks 1.75x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 96, totalMax: 245, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (databricks 1.75x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 131, totalMax: 315, equityMin: 13, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (databricks 1.75x program-manager)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── IT Services (experienced bands beyond entry) ─────────── */
  wipro: {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 6.5, equityType: "none", source: "Wipro NLTH 2026", lastVerified: "2026-05-07", notes: "Wipro Elite vs Turbo split." },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "AI/ML 3-yr exp can land ₹22-24L per recent offer-letter discussions." },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "AmbitionBox + Glassdoor", lastVerified: "2026-05-07" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 7, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 8, totalMax: 21, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 12, totalMax: 33, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 16, totalMax: 45, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 8, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 15, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 26, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 15, totalMax: 40, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 21, totalMax: 56, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 45, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 66, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 85, equityType: "none", source: "Seed dataset 2026-05-08 (wipro 0.47x project-manager)", lastVerified: "2026-05-08" },
    },
  },
  hcl: {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 5.5, equityType: "none", source: "HCL TechBee 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 7, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 8, totalMax: 23, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 13, totalMax: 35, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 18, totalMax: 48, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 9, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 16, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 16, totalMax: 43, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 23, totalMax: 60, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 48, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 70, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (hcl 0.5x project-manager)", lastVerified: "2026-05-08" },
    },
  },
  ltimindtree: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "LTIMindtree 2026 fresher disclosure", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Indeed + Weekday (LTIMindtree avg ₹19.71L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 8, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 14, totalMax: 39, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 19, totalMax: 52, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 10, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 18, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 47, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 25, totalMax: 66, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 52, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 77, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 99, equityType: "none", source: "Seed dataset 2026-05-08 (ltimindtree 0.55x project-manager)", lastVerified: "2026-05-08" },
    },
  },
  "tech mahindra": {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 5, equityType: "none", source: "Tech Mahindra ELTP 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "Glassdoor (16,264 salaries)", lastVerified: "2026-05-07", notes: "Network-automation 7-yr exp can land ₹22-24L per recent offer-letter discussions." },
      senior: { totalMin: 14, totalMax: 30, equityType: "none", source: "Glassdoor + AmbitionBox", lastVerified: "2026-05-07" },
    },
  },
  capgemini: {
    "software-engineer": {
      entry: { totalMin: 3.8, totalMax: 6.5, equityType: "none", source: "Capgemini 2026 fresher disclosure", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 16, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "AI/ML 3-yr exp ₹22L per recent offer-letter discussions." },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 8, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 15, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 26, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 14, totalMax: 41, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 20, totalMax: 55, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 10, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 19, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 32, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 49, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 26, totalMax: 70, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 6, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 29, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 55, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 81, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 104, equityType: "none", source: "Seed dataset 2026-05-08 (capgemini 0.58x project-manager)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── SaaS / Product (Indian-built) ────────────────────────── */
  postman: {
    "software-engineer": {
      entry: { totalMin: 25, totalMax: 35, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Levels.fyi (Postman IC1 India ₹2.9M; campus ₹25-35L)", lastVerified: "2026-05-07", notes: "Postman SaaS — global pay parity at IC1. Negotiation focus: Fixed + ESOP grant size + joining bonus." },
      mid: { totalMin: 38, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [3, 8], source: "Levels.fyi (Postman IC2 India median ₹53.1L)", lastVerified: "2026-05-07", notes: "IC2 ESOP-heavy — Postman late-stage private; ESOP value is the load-bearing lever. Negotiation focus: Fixed + ESOP refresh cadence." },
      senior: { totalMin: 65, totalMax: 120, equityMin: 18, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [5, 15], source: "Levels.fyi (IC3-IC4 ₹11.96M)", lastVerified: "2026-05-07", notes: "Senior IC — staff/principal scope. Negotiation focus: Fixed + level + ESOP grant." },
    },

    "product-manager": {
      entry: { totalMin: 18, totalMax: 40, equityMin: 3, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 3], source: "Seed dataset 2026-05-08 (postman 1.25x product-manager)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product scope + fixed." },
      mid: { totalMin: 31, totalMax: 88, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [3, 8], source: "Seed dataset 2026-05-08 (postman 1.25x product-manager)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product ownership + ESOP." },
      senior: { totalMin: 56, totalMax: 163, equityMin: 8, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [5, 15], source: "Seed dataset 2026-05-08 (postman 1.25x product-manager)", lastVerified: "2026-05-08", notes: "Negotiation focus: Strategic ownership + ESOP grant size." },
      lead: { totalMin: 88, totalMax: 225, equityMin: 12, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 119, totalMax: 313, equityMin: 17, equityMax: 44, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 56, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 35, totalMax: 100, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 56, totalMax: 150, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 188, equityMin: 9, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x ux-designer)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 35, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 81, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 150, equityMin: 8, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 75, totalMax: 213, equityMin: 11, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 106, totalMax: 275, equityMin: 16, equityMax: 41, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x devops-sre)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 5, totalMax: 20, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Seed dataset 2026-05-08 (postman 1.25x customer-success)", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + customer ownership." },
      mid: { totalMin: 15, totalMax: 40, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Seed dataset 2026-05-08 (postman 1.25x customer-success)", lastVerified: "2026-05-08", notes: "Negotiation focus: Customer ownership + retention metrics." },
      senior: { totalMin: 28, totalMax: 75, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 8], source: "Seed dataset 2026-05-08 (postman 1.25x customer-success)", lastVerified: "2026-05-08", notes: "Negotiation focus: Retention impact + book-of-business size." },
      lead: { totalMin: 44, totalMax: 113, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 163, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (postman 1.25x customer-success)", lastVerified: "2026-05-08" },
    },
    /* Developer Advocate / Technical Writer — Postman's developer-relations
       team is a hiring focus. Mapped to marketing taxonomy (devrel = a hybrid
       of growth + content; closest first-class role). */
    "marketing": {
      entry: { totalMin: 12, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 3], source: "Web research 2026-05-08 (Postman Developer Advocate / Tech Writer Junior)", lastVerified: "2026-05-08", notes: "Junior DevRel / Tech Writer — Postman invests heavily here. Negotiation focus: Fixed + content/talk portfolio." },
      mid: { totalMin: 25, totalMax: 60, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Web research 2026-05-08 (Postman Developer Advocate Mid)", lastVerified: "2026-05-08", notes: "Mid DevRel — own a vertical (API/testing/observability). Negotiation focus: Audience + content scope + ESOP." },
      senior: { totalMin: 45, totalMax: 110, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 12], source: "Web research 2026-05-08 (Postman Senior DevRel / Lead Tech Writer)", lastVerified: "2026-05-08", notes: "Senior DevRel / Principal TW — strategic content programs. Negotiation focus: Program ownership + ESOP grant." },
    },
  },
  browserstack: {
    "software-engineer": {
      entry: { totalMin: 17, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Levels.fyi (BrowserStack L1 India ₹1.99M)", lastVerified: "2026-05-07", notes: "L1 SDE — bootstrapped/profitable; cash bonuses modest. Negotiation focus: Fixed + joining bonus." },
      mid: { totalMin: 22, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Levels.fyi (L3 ₹17.3-28.1L)", lastVerified: "2026-05-07", notes: "BrowserStack pays below product-co peers; quality of work is the trade-off. Negotiation focus: Fixed + level + ESOP clarity." },
      senior: { totalMin: 30, totalMax: 50, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 8], source: "Levels.fyi (L5 ₹3.77M)", lastVerified: "2026-05-07", notes: "Senior — profitability means cash + measured ESOP, not aggressive grants. Negotiation focus: Fixed + level." },
    },
  
    "product-manager": {
      entry: { totalMin: 15, totalMax: 35, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 77, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 143, equityMin: 7, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 77, totalMax: 198, equityMin: 11, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 275, equityMin: 15, equityMax: 39, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 50, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 31, totalMax: 88, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 50, totalMax: 132, equityMin: 6, equityMax: 16, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 165, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x ux-designer)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 11, totalMax: 31, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 72, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 132, equityMin: 7, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 66, totalMax: 187, equityMin: 10, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 94, totalMax: 242, equityMin: 14, equityMax: 36, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x devops-sre)", lastVerified: "2026-05-08" },
    },
    "qa-engineer": {
      entry: { totalMin: 8, totalMax: 18, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Web research 2026-05-08 (BrowserStack QA/Automation Junior)", lastVerified: "2026-05-08", notes: "QA/Automation is core to BrowserStack's product — internal hiring bar high. Negotiation focus: Fixed + automation portfolio." },
      mid: { totalMin: 16, totalMax: 35, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Web research 2026-05-08 (BrowserStack QA/Automation Mid)", lastVerified: "2026-05-08", notes: "Mid QA — own a test-tooling pipeline / framework. Negotiation focus: Tooling ownership + level." },
      senior: { totalMin: 28, totalMax: 60, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Web research 2026-05-08 (BrowserStack Senior QA/Automation)", lastVerified: "2026-05-08", notes: "Senior QA — close to SDET / Test Architect at BrowserStack. Negotiation focus: Architecture ownership + ESOP." },
      lead: { totalMin: 28, totalMax: 77, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 105, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 18, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 35, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x customer-success)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 66, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x customer-success)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 99, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 143, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x customer-success)", lastVerified: "2026-05-08" },
    },
    /* Solutions Engineer + Account Executive — BrowserStack global SaaS GTM
       motion. Mapped under sales taxonomy (closest first-class role for AE;
       SE-Solutions overlaps with sales-engineering). */
    "sales": {
      entry: { totalMin: 10, totalMax: 22, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Web research 2026-05-08 (BrowserStack AE/Solutions Engineer Junior)", lastVerified: "2026-05-08", notes: "Junior AE / Solutions Engineer. Negotiation focus: OTE clarity + ramp." },
      mid: { totalMin: 22, totalMax: 55, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Web research 2026-05-08 (BrowserStack AE Mid)", lastVerified: "2026-05-08", notes: "Mid AE owns mid-market book; SE Mid does pre-sales + POCs. Negotiation focus: Fixed vs incentive split + territory." },
      senior: { totalMin: 45, totalMax: 110, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 12], source: "Web research 2026-05-08 (BrowserStack Senior AE / Lead SE)", lastVerified: "2026-05-08", notes: "Senior AE / Lead SE — strategic accounts. Negotiation focus: OTE realism + accelerators + ESOP." },
      lead: { totalMin: 50, totalMax: 154, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 77, totalMax: 242, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (browserstack 1.1x sales)", lastVerified: "2026-05-08" },
    },
  },
  chargebee: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 20, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi + Glassdoor (Chargebee SE entry India)", lastVerified: "2026-05-07" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Chargebee India median ₹27.6L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 55, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Principal ₹4.9M)", lastVerified: "2026-05-07" },
    },
  },
  freshworks: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor (Freshworks SE entry India)", lastVerified: "2026-05-07", notes: "Freshworks (FRSH NASDAQ) campus; RSU is public-stock, liquid." },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor + Levels.fyi (Freshworks Nasdaq-listed)", lastVerified: "2026-05-07", notes: "RSUs in Freshworks (FRSH NASDAQ) — public, liquid." },
      senior: { totalMin: 40, totalMax: 70, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 13, totalMax: 30, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 67, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 43, totalMax: 124, equityMin: 6, equityMax: 17, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 67, totalMax: 171, equityMin: 9, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 238, equityMin: 13, equityMax: 33, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 43, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 76, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 43, totalMax: 114, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 57, totalMax: 143, equityMin: 7, equityMax: 17, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 13, totalMax: 33, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 76, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 143, equityMin: 9, equityMax: 26, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 76, totalMax: 209, equityMin: 14, equityMax: 38, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 266, equityMin: 17, equityMax: 48, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 15, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 27, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 48, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 71, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 95, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x data-analyst)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 15, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 30, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x customer-success)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 57, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x customer-success)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 86, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 124, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x customer-success)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 17, equityMin: 1, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 38, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 76, equityMin: 1, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 43, totalMax: 133, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 67, totalMax: 209, equityMin: 4, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (freshworks 0.95x sales)", lastVerified: "2026-05-08" },
    },
  },
  zoho: {
    "software-engineer": {
      entry: { totalMin: 7.5, totalMax: 21, equityType: "none", joiningBonusOverride: [0, 1], source: "AmbitionBox + Glassdoor 2026-05-08 (Zoho SE Junior India)", lastVerified: "2026-05-08", notes: "Zoho is bootstrapped, anti-VC, profitable. No equity. Negotiation focus: Fixed salary (cash is the only lever)." },
      mid: { totalMin: 13.5, totalMax: 37.5, equityType: "none", joiningBonusOverride: [0, 3], source: "AmbitionBox 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + role scope (clarify product/team ownership)." },
      senior: { totalMin: 26.2, totalMax: 71.2, equityType: "none", joiningBonusOverride: [1, 6], source: "AmbitionBox 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + ownership (Zoho favours long-tenure ICs; senior comp is 60-90 day notice and pure cash)." },
    },

    "product-manager": {
      entry: { totalMin: 10.5, totalMax: 24, equityType: "none", joiningBonusOverride: [0, 2], source: "AmbitionBox 2026-05-08 (Zoho PM Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Scope + fixed (no equity)." },
      mid: { totalMin: 18.8, totalMax: 52.5, equityType: "none", joiningBonusOverride: [1, 4], source: "AmbitionBox 2026-05-08 (Zoho PM Mid)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product ownership (own a Zoho One module)." },
      senior: { totalMin: 33.8, totalMax: 97.5, equityType: "none", joiningBonusOverride: [2, 8], source: "AmbitionBox 2026-05-08 (Zoho PM Senior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Scope + level (internal grade calibration is the lever)." },
      lead: { totalMin: 53, totalMax: 135, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 71, totalMax: 188, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 18, equityType: "none", joiningBonusOverride: [0, 1], source: "AmbitionBox 2026-05-08 (Zoho Product Designer Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed (no equity to trade)." },
      mid: { totalMin: 12, totalMax: 33.8, equityType: "none", joiningBonusOverride: [0, 3], source: "AmbitionBox 2026-05-08 (Zoho Product Designer Mid)", lastVerified: "2026-05-08", notes: "Negotiation focus: Design ownership (module/product surface)." },
      senior: { totalMin: 21, totalMax: 60, equityType: "none", joiningBonusOverride: [1, 5], source: "AmbitionBox 2026-05-08 (Zoho Product Designer Senior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Craft + product impact (Zoho One has 50+ apps; specify which)." },
      lead: { totalMin: 34, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 113, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x ux-designer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 21, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 38, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 56, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 30, totalMax: 75, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x data-analyst)", lastVerified: "2026-05-08" },
    },
    "qa-engineer": {
      entry: { totalMin: 3.8, totalMax: 10.5, equityType: "none", joiningBonusOverride: [0, 0.5], source: "AmbitionBox 2026-05-08 (Zoho QA Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + automation scope." },
      mid: { totalMin: 6.8, totalMax: 19.5, equityType: "none", joiningBonusOverride: [0, 2], source: "AmbitionBox 2026-05-08 (Zoho QA Mid)", lastVerified: "2026-05-08", notes: "Negotiation focus: Automation depth (frameworks owned)." },
      senior: { totalMin: 12, totalMax: 33.8, equityType: "none", joiningBonusOverride: [1, 3], source: "AmbitionBox 2026-05-08 (Zoho QA Senior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Framework ownership." },
      lead: { totalMin: 19, totalMax: 53, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 26, totalMax: 71, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x qa-engineer)", lastVerified: "2026-05-08" },
    },
    /* Technical Writer — Zoho ships extensive product docs; mapped to
       marketing taxonomy (closest first-class role for content). */
    "marketing": {
      entry: { totalMin: 4.5, totalMax: 11.2, equityType: "none", joiningBonusOverride: [0, 0.5], source: "AmbitionBox 2026-05-08 (Zoho Tech Writer Junior)", lastVerified: "2026-05-08", notes: "Junior Tech Writer at Zoho. Negotiation focus: Fixed + writing portfolio." },
      mid: { totalMin: 9, totalMax: 26.2, equityType: "none", joiningBonusOverride: [0, 2], source: "AmbitionBox 2026-05-08 (Zoho Tech Writer Mid)", lastVerified: "2026-05-08", notes: "Negotiation focus: Documentation ownership (specific Zoho product line)." },
      senior: { totalMin: 16.5, totalMax: 48.8, equityType: "none", joiningBonusOverride: [1, 4], source: "AmbitionBox 2026-05-08 (Zoho Senior Tech Writer)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product docs impact + level." },
    },
    "customer-success": {
      entry: { totalMin: 3.4, totalMax: 9, equityType: "none", joiningBonusOverride: [0, 0.5], source: "AmbitionBox 2026-05-08 (Zoho Customer Support Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + shift terms." },
      mid: { totalMin: 6, totalMax: 18, equityType: "none", joiningBonusOverride: [0, 1], source: "AmbitionBox 2026-05-08 (Zoho Customer Support Mid)", lastVerified: "2026-05-08", notes: "Negotiation focus: Support scope (product surface owned)." },
      senior: { totalMin: 10.5, totalMax: 28.5, equityType: "none", joiningBonusOverride: [0, 2], source: "AmbitionBox 2026-05-08 (Zoho Customer Support Senior)", lastVerified: "2026-05-08", notes: "Negotiation focus: Team ownership." },
      lead: { totalMin: 26, totalMax: 68, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 98, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x customer-success)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 60, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 105, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 165, equityType: "none", source: "Seed dataset 2026-05-08 (zoho 0.75x sales)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── Consulting MBB (India bands) ─────────────────────────── */
  mckinsey: {
    consultant: {
      entry: { totalMin: 16, totalMax: 24, equityType: "none", source: "McKinsey India BA pre-MBA (Glassdoor + casebasix)", lastVerified: "2026-05-07", notes: "Business Analyst role. India market." },
      mid: { totalMin: 32, totalMax: 50, equityType: "none", source: "McKinsey India Associate post-MBA", lastVerified: "2026-05-07", notes: "Post-MBA Associate India ₹30-40L base + ₹8-12L bonus = total ₹40-50L. NOT negotiable on base — fixed for MBA entry." },
      senior: { totalMin: 60, totalMax: 95, equityType: "none", source: "McKinsey India EM (Engagement Manager)", lastVerified: "2026-05-07" },
      lead: { totalMin: 100, totalMax: 180, equityType: "none", source: "McKinsey India Associate Partner", lastVerified: "2026-05-07" },
    },
  },
  bcg: {
    consultant: {
      entry: { totalMin: 16, totalMax: 24, equityType: "none", source: "BCG India Associate pre-MBA (Glassdoor)", lastVerified: "2026-05-07" },
      mid: { totalMin: 30, totalMax: 48, equityType: "none", source: "BCG India Consultant post-MBA", lastVerified: "2026-05-07", notes: "Post-MBA Consultant India ₹30-38L base + bonus = ₹38-48L total." },
      senior: { totalMin: 55, totalMax: 90, equityType: "none", source: "BCG India PL (Project Leader)", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 160, equityType: "none", source: "BCG India Principal", lastVerified: "2026-05-07", notes: "BCG Principal (10-14 yr post-MBA). Carry expectation accelerates." },
      executive: { totalMin: 180, totalMax: 400, equityType: "none", source: "BCG India Partner / Managing Director", lastVerified: "2026-05-07", notes: "BCG Partner India 15+ yr; profit-share dominates total comp. ₹2-4Cr typical, top performers cross ₹6Cr." },
    },
  },
  bain: {
    consultant: {
      entry: { totalMin: 16, totalMax: 25, equityType: "none", source: "Bain India AC pre-MBA (Glassdoor)", lastVerified: "2026-05-07" },
      mid: { totalMin: 32, totalMax: 52, equityType: "none", source: "Bain India Consultant post-MBA", lastVerified: "2026-05-07", notes: "Post-MBA Bain India ₹32-40L base + ₹8-12L bonus. Highest MBB bonus ceiling globally." },
      senior: { totalMin: 60, totalMax: 95, equityType: "none", source: "Bain India CL (Case Leader) / Manager", lastVerified: "2026-05-07" },
      lead: { totalMin: 95, totalMax: 165, equityType: "none", source: "Bain India Principal", lastVerified: "2026-05-07" },
      executive: { totalMin: 180, totalMax: 400, equityType: "none", source: "Bain India Partner", lastVerified: "2026-05-07", notes: "Bain Partner India 15+ yr; carry + profit-share. ₹2-4Cr typical." },
    },
  },

  /* ─── Banking / IB ──────────────────────────────────────────── */
  goldman: {
    "software-engineer": {
      entry: { totalMin: 19.6, totalMax: 28.9, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Levels.fyi (Goldman SE Analyst India ₹1.96M-₹2.89M, median ₹2.38M)", lastVerified: "2026-05-07", notes: "Goldman fresher avg ₹27.7L; backend ₹28.3L, fullstack ₹28.32L." },
      mid: { totalMin: 35, totalMax: 60, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor Bangalore (6,503 salaries)", lastVerified: "2026-05-07" },
      senior: { totalMin: 65, totalMax: 110, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor (Goldman VP India)", lastVerified: "2026-05-07" },
    },
    consultant: {
      entry: { totalMin: 47.9, totalMax: 75, equityType: "none", source: "Levels.fyi (Goldman IB Analyst India ₹4.79M)", lastVerified: "2026-05-07", notes: "Investment Banking Analyst. Bonus ~80-120% of base in good years." },
      senior: { totalMin: 75, totalMax: 97.2, equityType: "none", source: "Levels.fyi (Goldman IB VP ₹9.72M)", lastVerified: "2026-05-07" },
    },
  
    "data-scientist": {
      entry: { totalMin: 12, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 72, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 132, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 66, totalMax: 192, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 96, totalMax: 252, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 12, totalMax: 34, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 78, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 144, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 72, totalMax: 204, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 102, totalMax: 264, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x devops-sre)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 22, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 38, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 66, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 102, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 54, totalMax: 144, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x business-analyst)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 22, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 43, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 78, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 120, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 180, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x finance)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 12, totalMax: 26, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 60, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 114, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 66, totalMax: 168, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 216, equityType: "none", source: "Seed dataset 2026-05-08 (goldman 1.2x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  jpmc: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityType: "none", source: "JPMC India Analyst (Glassdoor; ~40% below Goldman per Bangalore reporting)", lastVerified: "2026-05-07" },
      mid: { totalMin: 25, totalMax: 45, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor JPMC India", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 80, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  
    "data-scientist": {
      entry: { totalMin: 11, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 66, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 39, totalMax: 121, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 176, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 88, totalMax: 231, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 11, totalMax: 31, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 72, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 132, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 66, totalMax: 187, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 94, totalMax: 242, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x devops-sre)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 20, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 35, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 61, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 94, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 132, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x business-analyst)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 20, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 40, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 72, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 110, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 61, totalMax: 165, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x finance)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 11, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 55, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 39, totalMax: 105, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 154, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 83, totalMax: 198, equityType: "none", source: "Seed dataset 2026-05-08 (jpmc 1.1x program-manager)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── GCC ───────────────────────────────────────────────────── */
  "walmart global tech": {
    "software-engineer": {
      entry: { totalMin: 21.7, totalMax: 32, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor (Walmart Global Tech 3,982 salaries Apr 2026, P2 ₹2.17M)", lastVerified: "2026-05-07", notes: "Walmart pays well above average GCC. P2 entry; senior staff median ~₹90L." },
      mid: { totalMin: 30, totalMax: 55, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi + Glassdoor (median ₹43.9L, P3-P4)", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 100, equityMin: 12, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P4-P5)", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 200, equityMin: 30, equityMax: 80, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Staff Eng ₹90L avg, P5 max ₹20.11M)", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 18, totalMax: 40, equityMin: 3, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 31, totalMax: 88, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 56, totalMax: 163, equityMin: 8, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 88, totalMax: 225, equityMin: 12, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 119, totalMax: 313, equityMin: 17, equityMax: 44, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 56, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 35, totalMax: 100, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 56, totalMax: 150, equityMin: 7, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 188, equityMin: 9, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 18, totalMax: 44, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 35, totalMax: 100, equityMin: 6, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 63, totalMax: 188, equityMin: 11, equityMax: 34, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 100, totalMax: 275, equityMin: 18, equityMax: 50, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 125, totalMax: 350, equityMin: 23, equityMax: 63, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 13, totalMax: 31, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 25, totalMax: 75, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 138, equityMin: 6, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 69, totalMax: 200, equityMin: 10, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 263, equityMin: 14, equityMax: 37, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x data-scientist)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 35, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 81, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 150, equityMin: 8, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 75, totalMax: 213, equityMin: 11, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 106, totalMax: 275, equityMin: 16, equityMax: 41, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x devops-sre)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 13, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 63, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 119, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 69, totalMax: 175, equityMin: 7, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 94, totalMax: 225, equityMin: 9, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (walmart global tech 1.25x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  "target india": {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "AmbitionBox + Levels.fyi", lastVerified: "2026-05-07" },
      mid: { totalMin: 28, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Target India)", lastVerified: "2026-05-07" },
      senior: { totalMin: 48, totalMax: 85, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },

  /* ─── Quant / Trading (India IIT-targeted) ─────────────────── */
  "jane street": {
    /* Use data-scientist key — matchRoleKey routes "Quantitative
       Researcher" / "Quant Trader" → data-scientist. The override
       supersedes any tier band. */
    "data-scientist": {
      entry: { totalMin: 70, totalMax: 130, equityType: "none", source: "Jane Street India 2026 class hires (IIT Bombay/Delhi/Madras)", lastVerified: "2026-05-07", notes: "Indian fresher quant trader: ₹70-120L+ first-year. Base $300K globally; India offers vary by office (Mumbai vs Hong Kong). Top performers up to ₹4Cr first-year." },
      mid: { totalMin: 200, totalMax: 400, equityType: "none", source: "Jane Street India + Hong Kong placements", lastVerified: "2026-05-07", notes: "3-5 yr quant: median ₹2.5Cr+, performance-bonus heavy. Jane Street India offered IIT grad $508K (₹4.2Cr) for HK posting." },
    },
  },
  "de shaw": {
    "data-scientist": {
      entry: { totalMin: 35, totalMax: 60, equityType: "none", source: "DE Shaw India hires (H1B data $200K-equivalent)", lastVerified: "2026-05-07", notes: "DE Shaw India quant analyst entry. Base ₹17L + heavy bonus." },
      mid: { totalMin: 80, totalMax: 180, equityType: "none", source: "DE Shaw India 3-5 yr", lastVerified: "2026-05-07" },
    },
  },
  citadel: {
    "data-scientist": {
      entry: { totalMin: 60, totalMax: 110, equityType: "none", source: "Citadel India hires (IIT-targeted)", lastVerified: "2026-05-07", notes: "Citadel & Citadel Securities. Comparable to Jane Street; performance-tied." },
      mid: { totalMin: 150, totalMax: 350, equityType: "none", source: "Citadel India 3-5 yr quant", lastVerified: "2026-05-07" },
    },
  },

  /* ─── More Big Tech / Semiconductor (Levels.fyi 2026) ─────── */
  cisco: {
    "software-engineer": {
      entry: { totalMin: 17.2, totalMax: 25, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Cisco India Grade 4 ₹1.72M)", lastVerified: "2026-05-07" },
      mid: { totalMin: 27.4, totalMax: 46.4, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (SE-III ₹2.74M-₹4.64M, India median ₹30.9L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 50.2, totalMax: 89.5, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Tech Leader 1 ₹5.02M-₹8.95M)", lastVerified: "2026-05-07" },
      lead: { totalMin: 80, totalMax: 137, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Bangalore ₹13.73M+)", lastVerified: "2026-05-07" },
    },
    "engineering-manager": {
      mid: { totalMin: 68.8, totalMax: 84.1, equityMin: 20, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Cisco India SE Manager ₹6.88M-₹8.41M)", lastVerified: "2026-05-07" },
    },
  },
  oracle: {
    "software-engineer": {
      entry: { totalMin: 23.4, totalMax: 33, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Oracle India IC-1 ₹2.34M)", lastVerified: "2026-05-07" },
      mid: { totalMin: 35, totalMax: 55, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC-2/IC-3, median ₹38.5L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 90, equityMin: 18, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC-4)", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 145, equityMin: 30, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC-5 ₹7.08M+)", lastVerified: "2026-05-07" },
    },
  },
  ibm: {
    "software-engineer": {
      entry: { totalMin: 17.7, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IBM India Band 6 ₹1.77M)", lastVerified: "2026-05-07" },
      mid: { totalMin: 24, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Band 7-8, median ₹27.3L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Band 9-10 ₹5.72M)", lastVerified: "2026-05-07" },
    },
  },
  nvidia: {
    "software-engineer": {
      entry: { totalMin: 25.8, totalMax: 41, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (NVIDIA India IC1 ₹2.58M; campus ₹23-40.9L)", lastVerified: "2026-05-07", notes: "NVIDIA highest-paying campus recruiter in semiconductor / AI hardware. NSU upside boosts total comp." },
      mid: { totalMin: 50, totalMax: 90, equityMin: 18, equityMax: 40, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC2-IC3, India median ₹67L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 95, totalMax: 160, equityMin: 35, equityMax: 80, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC4-IC5)", lastVerified: "2026-05-07" },
      lead: { totalMin: 150, totalMax: 250, equityMin: 60, equityMax: 130, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC6 ₹19.31M+)", lastVerified: "2026-05-07" },
    },
  },
  qualcomm: {
    "software-engineer": {
      entry: { totalMin: 16, totalMax: 25, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor + UpGrad (Qualcomm India entry ₹16-25L)", lastVerified: "2026-05-07" },
      mid: { totalMin: 25, totalMax: 38, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 31.3, totalMax: 56.5, equityMin: 10, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "UpGrad (Senior SE ₹31.3-34.6L; Staff ₹51.1-56.5L)", lastVerified: "2026-05-07" },
    },
  },
  mediatek: {
    "software-engineer": {
      entry: { totalMin: 16, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor (MediaTek India fresher / campus)", lastVerified: "2026-05-07" },
      mid: { totalMin: 24.6, totalMax: 39.8, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (MediaTek India HW Eng ₹2.46M-₹3.98M, total comp ₹43.6L max)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  servicenow: {
    "software-engineer": {
      entry: { totalMin: 26.4, totalMax: 38, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (ServiceNow India IC1 ₹2.64M)", lastVerified: "2026-05-07" },
      mid: { totalMin: 38, totalMax: 60, equityMin: 10, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC2 ₹2.82M-₹4.57M, median ₹46.7L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 60, totalMax: 110, equityMin: 18, equityMax: 45, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC4-IC5)", lastVerified: "2026-05-07" },
      lead: { totalMin: 110, totalMax: 155, equityMin: 35, equityMax: 70, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (IC6 ₹15.46M)", lastVerified: "2026-05-07" },
    },
  },
  workday: {
    "software-engineer": {
      entry: { totalMin: 22, totalMax: 33, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Workday India P1 entry)", lastVerified: "2026-05-07" },
      mid: { totalMin: 33, totalMax: 50, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Workday India P2 ₹3.3M-P3 median ₹48.2L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 67, equityMin: 14, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P4 ₹6.68M)", lastVerified: "2026-05-07" },
    },
  },
  linkedin: {
    "software-engineer": {
      entry: { totalMin: 28, totalMax: 42, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor + Levels.fyi (LinkedIn India SE-1 / new-grad)", lastVerified: "2026-05-07", notes: "LinkedIn India = Microsoft-tier (MSFT-owned), MSFT RSU." },
      mid: { totalMin: 50, totalMax: 80, equityMin: 14, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor + Levels.fyi (LinkedIn India SSE)", lastVerified: "2026-05-07", notes: "LinkedIn India treated as Microsoft-tier (Microsoft-owned)." },
      senior: { totalMin: 80, totalMax: 130, equityMin: 28, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  /* ─── Big 4 Consulting (India bands) ───────────────────────── */
  deloitte: {
    consultant: {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Glassdoor + Indeed (Deloitte India Analyst)", lastVerified: "2026-05-07", notes: "Deloitte India Analyst pre-MBA. Big 4 baseline." },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "Glassdoor (Deloitte India Consultant)", lastVerified: "2026-05-07", notes: "Deloitte India avg ₹21L; consultant 1-3 yr exp." },
      senior: { totalMin: 23.9, totalMax: 32, equityType: "none", source: "UpGrad (Deloitte Senior Consultant ₹23.9-26.4L for 3-13 yr exp)", lastVerified: "2026-05-07", notes: "Deloitte holds edge over EY (₹18.5-20.5L) and KPMG (₹17.4-19.2L) at Senior Consultant level." },
      lead: { totalMin: 35, totalMax: 60, equityType: "none", source: "Glassdoor (Deloitte Manager / Senior Manager)", lastVerified: "2026-05-07" },
    },
    /* Bug-report 15 follow-up (2026-05-14): real Deloitte BA session
     * was falling through to tier-default consulting-big4 bands, which
     * are wider than the Deloitte-specific analyst-track numbers. At
     * Deloitte India, "Business Analyst" sits on the same analyst →
     * consultant → senior consultant → manager ladder as the generic
     * consultant role; the rupee numbers line up tightly with the
     * consultant track above. Pinning a BA-specific entry here so the
     * band the simulation uses matches the role label on screen. */
    "business-analyst": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Glassdoor + AmbitionBox (Deloitte India Business Analyst, 0-2 yr)", lastVerified: "2026-05-14", notes: "BA-Analyst track at Deloitte mirrors the Consultant entry band (analyst-pool model)." },
      mid: { totalMin: 11, totalMax: 20, equityType: "none", source: "Glassdoor (Deloitte India Business Analyst, 2-5 yr)", lastVerified: "2026-05-14", notes: "BA-Consultant equivalent. ₹15L is the typical first-mid offer." },
      senior: { totalMin: 20, totalMax: 30, equityType: "none", source: "AmbitionBox + UpGrad (Deloitte Senior BA / BA-Senior Consultant)", lastVerified: "2026-05-14" },
      lead: { totalMin: 32, totalMax: 55, equityType: "none", source: "Glassdoor (Deloitte BA Manager)", lastVerified: "2026-05-14" },
    },
  },
  ey: {
    consultant: {
      entry: { totalMin: 4.9, totalMax: 11.2, equityType: "none", source: "Glassdoor (EY India Analyst 25th-75th pctile)", lastVerified: "2026-05-07", notes: "EY fresher avg ₹9.28L." },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "UpGrad (EY Consultant ₹10-15L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 22, equityType: "none", source: "UpGrad (EY Senior Consultant ₹16-20+L)", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 50, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  kpmg: {
    consultant: {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Glassdoor (KPMG India Analyst)", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 17, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 17.4, totalMax: 22, equityType: "none", source: "thefinancestory (KPMG Senior Consultant ₹17.4-19.2L)", lastVerified: "2026-05-07" },
    },
  },
  pwc: {
    consultant: {
      entry: { totalMin: 5.5, totalMax: 10.5, equityType: "none", source: "Glassdoor (PwC India Analyst)", lastVerified: "2026-05-07" },
      mid: { totalMin: 11, totalMax: 18, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 24, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  /* ─── Indian Private Banks ─────────────────────────────────── */
  icici: {
    sales: {
      entry: { totalMin: 4.3, totalMax: 7, equityType: "none", source: "Indeed (ICICI Bank India Relationship Manager early career)", lastVerified: "2026-05-07", notes: "ICICI RM pre-2 yr." },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "6figr (ICICI India RM avg ₹16L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "PayScale (ICICI Bank India 90th pctile ₹55.5L)", lastVerified: "2026-05-07", notes: "Senior RM at ICICI tops out around ₹35-55L for top performers." },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "AmbitionBox (ICICI Bank IT Analyst)", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 40, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },
  hdfc: {
    sales: {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Glassdoor (HDFC RM)", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  axis: {
    sales: {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Glassdoor (Axis Bank RM)", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 15, totalMax: 26, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  kotak: {
    sales: {
      entry: { totalMin: 4.5, totalMax: 7, equityType: "none", source: "Glassdoor (Kotak Mahindra RM)", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  /* ─── More Indian Unicorns ─────────────────────────────────── */
  lenskart: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (Lenskart Solutions 1,527 salaries)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi + Glassdoor (Lenskart median $37.5K = ₹31L; range ₹2.4L-₹77L)", lastVerified: "2026-05-07", notes: "Lenskart listed Nov 2025 — ESOPs converted to RSUs." },
      senior: { totalMin: 38, totalMax: 60, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  nykaa: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Glassdoor (Nykaa 1,202 salaries; SE entry India) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed." },
      mid: { totalMin: 27.3, totalMax: 38.6, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Levels.fyi (Nykaa SE India median ₹35.5L; range ₹2.73M-₹3.86M) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + equity (Nykaa is listed)." },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 7], source: "Glassdoor + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + level." },
    },
    "engineering-manager": {
      mid: { totalMin: 47.9, totalMax: 65.5, equityMin: 12, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Nykaa SEM ₹4.79M-₹6.55M)", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 11, totalMax: 26, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 56, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 104, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 56, totalMax: 144, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 200, equityMin: 11, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 3, totalMax: 19, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 36, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 64, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 96, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 120, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x ux-designer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 13, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 22, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 40, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 60, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 32, totalMax: 80, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x data-analyst)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 26, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 44, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 68, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 96, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x business-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 32, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 64, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 112, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 176, equityMin: 3, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x sales)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 16, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 32, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 60, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 88, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 128, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (nykaa 0.8x operations)", lastVerified: "2026-05-08" },
    },
  },
  cars24: {
    "software-engineer": {
      entry: { totalMin: 10, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Glassdoor (CARS24 2,087 salaries; entry SE) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed." },
      mid: { totalMin: 18, totalMax: 32, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Levels.fyi (Cars24 ₹10L-₹54.9L range) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + ESOP." },
      senior: { totalMin: 32, totalMax: 55, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 7], source: "Levels.fyi (Cars24 SEM) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + level." },
    },
    "product-manager": {
      entry: { totalMin: 11, totalMax: 26, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (cars24 0.8x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 56, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 90, equityMin: 5, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 19, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (cars24 0.8x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 36, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 60, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 5, totalMax: 13, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (cars24 0.8x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 22, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 40, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (cars24 0.8x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 32, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 64, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 16, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (cars24 0.8x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 32, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 60, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 5, totalMax: 13, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (cars24 0.8x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 26, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 48, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
  },
  groww: {
    "software-engineer": {
      entry: { totalMin: 10.0, totalMax: 28.0, baseMin: 7.4, baseMax: 20.7, equityMin: 1.4, equityMax: 3.9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww SE Junior worksheet (post-2025 IPO)", lastVerified: "2026-05-08", notes: "Groww Junior SE. Bonus ₹1.2-3.4L. Joining bonus ₹0-2L. Listed 2025 — RSU liquid. Negotiation focus: fixed + joining bonus." },
      mid: { totalMin: 18.0, totalMax: 50.0, baseMin: 13.3, baseMax: 37.0, equityMin: 2.5, equityMax: 7.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww SE Mid worksheet", lastVerified: "2026-05-08", notes: "Groww Mid SE. Bonus ₹2.2-6.0L. Joining bonus ₹1-5L. Negotiation focus: fixed + ESOP/RSU clarity." },
      senior: { totalMin: 35.0, totalMax: 95.0, baseMin: 25.9, baseMax: 70.3, equityMin: 4.9, equityMax: 13.3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww SE Senior worksheet", lastVerified: "2026-05-08", notes: "Groww Senior SE. Bonus ₹4.2-11.4L. Joining bonus ₹3-10L. 60-90 day notice. Negotiation focus: fixed + equity." },
    },
    "backend-developer": {
      entry: { totalMin: 10.0, totalMax: 28.0, baseMin: 7.4, baseMax: 20.7, equityMin: 1.4, equityMax: 3.9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Backend Junior", lastVerified: "2026-05-08", notes: "Groww Junior Backend. Negotiation focus: fixed." },
      mid: { totalMin: 18.0, totalMax: 50.0, baseMin: 13.3, baseMax: 37.0, equityMin: 2.5, equityMax: 7.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Backend Mid", lastVerified: "2026-05-08", notes: "Groww Mid Backend. Negotiation focus: backend ownership." },
      senior: { totalMin: 35.0, totalMax: 95.0, baseMin: 25.9, baseMax: 70.3, equityMin: 4.9, equityMax: 13.3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Backend Senior", lastVerified: "2026-05-08", notes: "Groww Senior Backend. 60-90 day notice. Negotiation focus: scale + reliability." },
    },
    "frontend-developer": {
      entry: { totalMin: 9.0, totalMax: 25.0, baseMin: 6.8, baseMax: 19.0, equityMin: 1.1, equityMax: 3.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Frontend Junior", lastVerified: "2026-05-08", notes: "Groww Junior Frontend. Bonus ₹1.1-3L. Negotiation focus: fixed." },
      mid: { totalMin: 16.0, totalMax: 45.0, baseMin: 12.2, baseMax: 34.2, equityMin: 1.9, equityMax: 5.4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Frontend Mid", lastVerified: "2026-05-08", notes: "Groww Mid Frontend. Negotiation focus: product UI impact." },
      senior: { totalMin: 30.0, totalMax: 80.0, baseMin: 22.8, baseMax: 60.8, equityMin: 3.6, equityMax: 9.6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Frontend Senior", lastVerified: "2026-05-08", notes: "Groww Senior Frontend. 60-90 day notice. Negotiation focus: frontend ownership." },
    },
    "mobile-developer": {
      entry: { totalMin: 10.0, totalMax: 28.0, baseMin: 7.4, baseMax: 20.7, equityMin: 1.4, equityMax: 3.9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Mobile Junior", lastVerified: "2026-05-08", notes: "Groww Junior Mobile. Negotiation focus: fixed + app impact." },
      mid: { totalMin: 18.0, totalMax: 50.0, baseMin: 13.3, baseMax: 37.0, equityMin: 2.5, equityMax: 7.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Mobile Mid", lastVerified: "2026-05-08", notes: "Groww Mid Mobile. Negotiation focus: app scale." },
      senior: { totalMin: 35.0, totalMax: 95.0, baseMin: 25.9, baseMax: 70.3, equityMin: 4.9, equityMax: 13.3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Mobile Senior", lastVerified: "2026-05-08", notes: "Groww Senior Mobile. 60-90 day notice. Negotiation focus: ownership." },
    },
    "product-manager": {
      entry: { totalMin: 14.0, totalMax: 32.0, baseMin: 9.8, baseMax: 22.4, equityMin: 2.0, equityMax: 4.5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww PM Junior worksheet", lastVerified: "2026-05-08", notes: "Groww Junior PM / APM. Bonus ₹2.2-5.1L. Joining bonus ₹1-3L. Negotiation focus: scope + fixed." },
      mid: { totalMin: 25.0, totalMax: 70.0, baseMin: 17.5, baseMax: 49.0, equityMin: 3.5, equityMax: 9.8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww PM Mid worksheet", lastVerified: "2026-05-08", notes: "Groww Mid PM. Bonus ₹4.0-11.2L. Joining bonus ₹2-7L. Negotiation focus: fixed + ESOP/RSU." },
      senior: { totalMin: 45.0, totalMax: 130.0, baseMin: 31.5, baseMax: 91.0, equityMin: 6.3, equityMax: 18.2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww PM Senior worksheet", lastVerified: "2026-05-08", notes: "Groww Senior PM. Bonus ₹7.2-20.8L. Joining bonus ₹4-15L. 60-90 day notice. Negotiation focus: scope + equity." },
      lead: { totalMin: 70, totalMax: 180, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 250, equityMin: 13, equityMax: 35, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 8.0, totalMax: 24.0, baseMin: 6.2, baseMax: 18.7, equityMin: 1.0, equityMax: 2.9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww UX/Product Designer Junior worksheet", lastVerified: "2026-05-08", notes: "Groww Junior UX/Product Designer. Bonus ₹0.8-2.4L. Negotiation focus: fixed." },
      mid: { totalMin: 16.0, totalMax: 45.0, baseMin: 12.5, baseMax: 35.1, equityMin: 1.9, equityMax: 5.4, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww UX/Product Designer Mid worksheet", lastVerified: "2026-05-08", notes: "Groww Mid UX/Product Designer. Bonus ₹1.6-4.5L. Negotiation focus: level mapping." },
      senior: { totalMin: 28.0, totalMax: 80.0, baseMin: 21.8, baseMax: 62.4, equityMin: 3.4, equityMax: 9.6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww UX/Product Designer Senior worksheet", lastVerified: "2026-05-08", notes: "Groww Senior UX/Product Designer. Bonus ₹2.8-8.0L. 60-90 day notice. Negotiation focus: ownership." },
      lead: { totalMin: 45, totalMax: 120, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 150, equityMin: 7, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 14, totalMax: 35, equityMin: 3, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 80, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 150, equityMin: 9, equityMax: 27, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 80, totalMax: 220, equityMin: 14, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 280, equityMin: 18, equityMax: 50, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 10, totalMax: 28, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 65, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x devops-sre)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 120, equityMin: 6, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x devops-sre)", lastVerified: "2026-05-08" },
      lead: { totalMin: 60, totalMax: 170, equityMin: 9, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x devops-sre)", lastVerified: "2026-05-08" },
      executive: { totalMin: 85, totalMax: 220, equityMin: 13, equityMax: 33, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x devops-sre)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 6.0, totalMax: 16.0, baseMin: 5.0, baseMax: 13.4, equityMin: 0.4, equityMax: 1.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Data Analyst Junior worksheet", lastVerified: "2026-05-08", notes: "Groww Junior Data Analyst. Bonus ₹0.6-1.6L. Negotiation focus: fixed." },
      mid: { totalMin: 10.0, totalMax: 28.0, baseMin: 8.4, baseMax: 23.5, equityMin: 0.6, equityMax: 1.7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Data Analyst Mid worksheet", lastVerified: "2026-05-08", notes: "Groww Mid Data Analyst. Bonus ₹1.0-2.8L. Negotiation focus: fixed + growth." },
      senior: { totalMin: 18.0, totalMax: 50.0, baseMin: 15.1, baseMax: 42.0, equityMin: 1.1, equityMax: 3.0, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Data Analyst Senior worksheet", lastVerified: "2026-05-08", notes: "Groww Senior Data Analyst. Bonus ₹1.8-5.0L. 60-day notice. Negotiation focus: analytics scope." },
      lead: { totalMin: 28, totalMax: 75, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 100, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x data-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 18, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 40, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 80, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 140, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 220, equityMin: 4, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (groww 1x sales)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 7.0, totalMax: 18.0, baseMin: 5.0, baseMax: 13.0, equityMin: 0.3, equityMax: 0.7, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Growth Marketing Junior worksheet", lastVerified: "2026-05-08", notes: "Groww Junior Growth Marketing. Bonus ₹1.7-4.3L (high variable %). Negotiation focus: fixed + bonus." },
      mid: { totalMin: 14.0, totalMax: 40.0, baseMin: 10.1, baseMax: 28.8, equityMin: 0.6, equityMax: 1.6, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Growth Marketing Mid worksheet", lastVerified: "2026-05-08", notes: "Groww Mid Growth Marketing. Bonus ₹3.4-9.6L. Negotiation focus: CAC/ROI ownership." },
      senior: { totalMin: 25.0, totalMax: 80.0, baseMin: 18.0, baseMax: 57.6, equityMin: 1.0, equityMax: 3.2, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Curated research 2026-05-08 — Groww Growth Marketing Senior worksheet", lastVerified: "2026-05-08", notes: "Groww Senior Growth Marketing. Bonus ₹6.0-19.2L. 60-90 day notice. Negotiation focus: growth impact." },
    },
  },
  ola: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox (Ola SE-1 fresher post-restructure)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox (Ola post-restructure)", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 65, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  /* ─── FMCG (India MBA brand-management track) ─────────────── */
  itc: {
    marketing: {
      entry: { totalMin: 16, totalMax: 22, equityType: "none", source: "InsideIIM + iQuanta (MNC consumer MBA MT ₹19-27L)", lastVerified: "2026-05-07", notes: "ITC Management Trainee post-MBA from top B-schools." },
      mid: { totalMin: 26, totalMax: 40, equityType: "none", source: "Glassdoor (ITC Brand Manager)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityType: "none", source: "InsideIIM (HUL/ITC/Unilever Brand Manager ₹30L+ avg)", lastVerified: "2026-05-07" },
      lead: { totalMin: 65, totalMax: 110, equityType: "none", source: "Glassdoor (ITC Senior Brand Director / GM)", lastVerified: "2026-05-07" },
      executive: { totalMin: 110, totalMax: 280, equityType: "none", source: "Glassdoor (ITC ED / Divisional Chief Executive)", lastVerified: "2026-05-07", notes: "ITC ED-track CXO India — heavy variable + perks." },
    },
  },
  hul: {
    marketing: {
      entry: { totalMin: 18, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM (HUL UFLP ₹18-27L for IIM grads)", lastVerified: "2026-05-07", notes: "HUL UFLP — premium MT program. Glassdoor avg includes non-MBA roles which are lower (₹7.88L avg)." },
      mid: { totalMin: 30, totalMax: 50, equityMin: 2, equityMax: 8, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 90, equityMin: 5, equityMax: 18, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM", lastVerified: "2026-05-07" },
      lead: { totalMin: 65, totalMax: 120, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM (HUL Marketing Director / GM)", lastVerified: "2026-05-07" },
      executive: { totalMin: 110, totalMax: 300, equityMin: 25, equityMax: 80, equityType: "rsu", equityVesting: "3yr", source: "Glassdoor (HUL VP Marketing / President / CMO)", lastVerified: "2026-05-07", notes: "HUL CEO India ₹3-15Cr+. Apex of FMCG comp." },
    },
  
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 16, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 29, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 50, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 77, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 108, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x business-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 16, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 36, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 72, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 41, totalMax: 126, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 198, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x sales)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 7, totalMax: 18, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 36, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 68, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 99, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 144, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x operations)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 16, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 32, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 135, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x finance)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x hr)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x hr)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 45, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x hr)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 72, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x hr)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 108, equityType: "none", source: "Seed dataset 2026-05-08 (hul 0.9x hr)", lastVerified: "2026-05-08" },
    },
  },
  "p&g": {
    marketing: {
      entry: { totalMin: 22, totalMax: 32, equityType: "none", source: "InsideIIM + Glassdoor (P&G MBA MT)", lastVerified: "2026-05-07", notes: "P&G premium MNC MT — top of FMCG MBA market." },
      mid: { totalMin: 35, totalMax: 60, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 60, totalMax: 110, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 160, equityType: "none", source: "Glassdoor (P&G Marketing Director India)", lastVerified: "2026-05-07" },
      executive: { totalMin: 150, totalMax: 350, equityType: "none", source: "Glassdoor (P&G VP / CMO / President India)", lastVerified: "2026-05-07" },
    },
  },
  nestle: {
    marketing: {
      entry: { totalMin: 14, totalMax: 22, equityType: "none", source: "Glassdoor (Nestle MT avg ₹17L)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 35, equityType: "none", source: "Glassdoor (Nestle India avg ₹21L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      lead: { totalMin: 60, totalMax: 100, equityType: "none", source: "Glassdoor (Nestle India Senior Director)", lastVerified: "2026-05-07" },
      executive: { totalMin: 100, totalMax: 250, equityType: "none", source: "Glassdoor (Nestle India VP / MD)", lastVerified: "2026-05-07" },
    },
  },

  /* Godrej — GLP MT rotation across consumer goods, B2B, agro. ESOPs
     limited to listed Godrej Industries holdings; most roles are cash-only. */
  godrej: {
    marketing: {
      entry: { totalMin: 16, totalMax: 24, equityType: "none", source: "InsideIIM + Glassdoor (Godrej GLP IIM grad ₹16-24L)", lastVerified: "2026-05-08", notes: "Godrej GLP MT — premium FMCG MBA program; below HUL UFLP but above Nestle.", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      mid: { totalMin: 22, totalMax: 38, equityType: "none", source: "6figr (Godrej group avg ₹19L) + Glassdoor", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 38, totalMax: 65, equityType: "none", source: "Glassdoor (Godrej Sr Brand Manager / Category Lead)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      lead: { totalMin: 65, totalMax: 110, equityType: "none", source: "Glassdoor (Godrej GM / Marketing Director)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 41, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 64, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 34, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x business-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 60, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 105, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 165, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x sales)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 15, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 30, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 56, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 83, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 120, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x operations)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 27, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 49, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 75, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 113, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x finance)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 11, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x hr)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 21, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x hr)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 38, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x hr)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 60, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x hr)", lastVerified: "2026-05-08" },
      executive: { totalMin: 34, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (godrej 0.75x hr)", lastVerified: "2026-05-08" },
    },
  },

  /* HDFC Bank — large officer/manager pyramid. Relationship Manager and
     Branch Manager are the two highest-volume tracks. VP/SVP comp jumps. */
  "hdfc bank": {
    finance: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Indeed + 6figr (HDFC Bank Relationship Officer ₹3.5L, RM ₹4.6-6.1L)", lastVerified: "2026-05-08", notes: "HDFC Bank entry officer / RM track. Sales-incentive component meaningful.", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      mid: { totalMin: 8, totalMax: 14, equityType: "none", source: "Indeed Manager avg ₹10.3L + 6figr", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Glassdoor (HDFC Sr Manager / AVP) + PayScale upper band ₹21.8L", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "6figr (HDFC Bank VP cap ₹60L Bangalore)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (hdfc bank 0.72x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 23, equityType: "none", source: "Seed dataset 2026-05-08 (hdfc bank 0.72x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 40, equityType: "none", source: "Seed dataset 2026-05-08 (hdfc bank 0.72x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 61, equityType: "none", source: "Seed dataset 2026-05-08 (hdfc bank 0.72x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 32, totalMax: 86, equityType: "none", source: "Seed dataset 2026-05-08 (hdfc bank 0.72x business-analyst)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── Sector clusters — picks up the long tail of ~800 companies
        in the autocomplete that don't have bespoke entries. Indexed
        by classifyCompanyType() bucket key (see company-guidance.ts).
        Every company in the autocomplete classifies into one bucket;
        this gives us 100% coverage with sensible 2026-calibrated
        bands, not the generic indian-unicorn fallback that produced
        ₹22L offers for tiny design studios.

        Lookup order: direct company match → sector match (this) →
        tier band → fallback by experience level. */
  __sector_consulting_strategy: {
    consultant: {
      entry: { totalMin: 16, totalMax: 25, equityType: "none", source: "MBB India pre-MBA Associate band (Glassdoor + Casebasix)", lastVerified: "2026-05-07" },
      mid: { totalMin: 30, totalMax: 50, equityType: "none", source: "MBB / Tier-2 strategy India post-MBA", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 90, equityType: "none", source: "Engagement Manager / Project Lead", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 160, equityType: "none", source: "Strategy Principal (10-14 yr)", lastVerified: "2026-05-07" },
      executive: { totalMin: 180, totalMax: 400, equityType: "none", source: "Strategy Partner / Managing Director (15+ yr)", lastVerified: "2026-05-07", notes: "Partner-level India: carry + profit-share dominates. ₹2-4Cr typical at MBB." },
    },
    "software-engineer": {
      entry: { totalMin: 15, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 82, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 82, totalMax: 145, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 164, totalMax: 364, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 15, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 52, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 86, totalMax: 153, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 172, totalMax: 382, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy product-manager derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 13, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 25, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 45, totalMax: 74, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 131, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 147, totalMax: 327, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 17, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 33, totalMax: 55, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 60, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 98, totalMax: 175, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 196, totalMax: 436, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 15, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 52, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 86, totalMax: 153, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 172, totalMax: 382, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 14, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 78, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 78, totalMax: 138, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 155, totalMax: 345, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 80, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 200, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 9, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 106, totalMax: 236, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 12, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy sales derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy sales derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy sales derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 65, totalMax: 116, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy sales derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 131, totalMax: 291, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy sales derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 12, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy marketing derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy marketing derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy marketing derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 65, totalMax: 116, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy marketing derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 131, totalMax: 291, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy marketing derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy finance derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy finance derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 37, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy finance derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 109, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy finance derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 123, totalMax: 273, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy finance derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy operations derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy operations derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 37, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy operations derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 109, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy operations derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 123, totalMax: 273, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy operations derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 10, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 35, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 57, totalMax: 102, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 115, totalMax: 255, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy customer-success derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 9, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy hr derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy hr derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy hr derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy hr derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 106, totalMax: 236, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_strategy hr derived from consultant band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_consulting_big4: {
    consultant: {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Big 4 India Analyst (Deloitte/EY/KPMG/PwC) pre-MBA", lastVerified: "2026-05-07" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Big 4 India Consultant 1-3 yr", lastVerified: "2026-05-07" },
      senior: { totalMin: 17, totalMax: 32, equityType: "none", source: "Big 4 India Senior Consultant (3-13 yr)", lastVerified: "2026-05-07" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Big 4 Manager / Senior Manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 60, totalMax: 180, equityType: "none", source: "Big 4 India Partner / MD (15+ yr)", lastVerified: "2026-05-07", notes: "Big 4 Partner India ₹60-180L; profit-share + carry. Below MBB Partner due to volume model." },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 55, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 164, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 57, totalMax: 172, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 product-manager derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 49, totalMax: 147, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 5, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 196, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 57, totalMax: 172, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 4, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 155, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 15, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 30, totalMax: 90, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 106, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 sales derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 sales derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 sales derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 sales derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 131, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 sales derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 marketing derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 marketing derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 marketing derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 marketing derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 131, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 marketing derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 finance derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 finance derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 finance derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 finance derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 123, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 finance derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 3, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 operations derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 operations derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 operations derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 operations derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 123, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 operations derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 115, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 customer-success derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 hr derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 hr derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 hr derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 hr derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 106, equityType: "none", source: "Sector default 2026-05-08 (__sector_consulting_big4 hr derived from consultant band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_ibank_bulgebracket: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Bulge-bracket IB India (HSBC, Barclays, BarCap, Deutsche, Citi) Analyst SE", lastVerified: "2026-05-07" },
      mid: { totalMin: 30, totalMax: 55, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "IB India SE Associate", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 95, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "IB India SE VP", lastVerified: "2026-05-07" },
      lead: { totalMin: 95, totalMax: 160, equityMin: 22, equityMax: 50, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "IB India SE Executive Director / SVP", lastVerified: "2026-05-07" },
      executive: { totalMin: 160, totalMax: 350, equityMin: 50, equityMax: 130, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "IB India SE MD / GMD (15+ yr)", lastVerified: "2026-05-07" },
    },
    consultant: {
      entry: { totalMin: 35, totalMax: 65, equityType: "none", source: "IB India IB Analyst (Glassdoor)", lastVerified: "2026-05-07", notes: "Bonus 80-120% of base in good years; total comp dominates base." },
      senior: { totalMin: 65, totalMax: 90, equityType: "none", source: "IB India IB Associate / VP", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 200, equityType: "none", source: "IB India ED / SVP", lastVerified: "2026-05-07" },
      executive: { totalMin: 200, totalMax: 628, equityType: "none", source: "Glassdoor Bangalore IB MD (top range $628K)", lastVerified: "2026-05-07", notes: "IB MD India 15+ yr; bonus + carry. Bangalore MD top range ~₹6.28Cr per Glassdoor 2026." },
    },
    "product-manager": {
      entry: { totalMin: 19, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 58, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 58, totalMax: 100, equityMin: 8, equityMax: 23, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 100, totalMax: 168, equityMin: 23, equityMax: 53, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 168, totalMax: 368, equityMin: 53, equityMax: 137, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    /* ux-designer recalibrated 2026-05-13 (was SE-derived → senior ₹50-86L
       ≈3x bulge-bracket designer market; ibanks pay parity for SE because
       trading systems are revenue-critical but design is a cost centre).
       AmbitionBox 2025-26 puts GS / MS / JPM Bengaluru Sr Product
       Designer at ₹26-38L. */
    "ux-designer": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 0.5, equityMax: 1, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "AmbitionBox 2025-26 (bulge-bracket ibank Jr PD India)", lastVerified: "2026-05-13" },
      mid: { totalMin: 18, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "AmbitionBox 2025-26 (bulge-bracket ibank mid PD India)", lastVerified: "2026-05-13" },
      senior: { totalMin: 26, totalMax: 38, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "AmbitionBox 2025-26 (GS / MS / JPM Bengaluru Sr PD median ₹26-32L)", lastVerified: "2026-05-13" },
      lead: { totalMin: 40, totalMax: 60, equityMin: 7, equityMax: 14, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor 2025-26 (Lead PD / Design Manager at bulge-bracket ibank India)", lastVerified: "2026-05-13" },
      executive: { totalMin: 70, totalMax: 130, equityMin: 15, equityMax: 38, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor 2025-26 (Head of Design at bulge-bracket ibank India)", lastVerified: "2026-05-13" },
    },
    "ml-engineer": {
      entry: { totalMin: 22, totalMax: 34, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 36, totalMax: 66, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 66, totalMax: 114, equityMin: 11, equityMax: 29, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 114, totalMax: 192, equityMin: 29, equityMax: 66, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 192, totalMax: 420, equityMin: 66, equityMax: 172, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 19, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 58, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 58, totalMax: 100, equityMin: 8, equityMax: 23, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 100, totalMax: 168, equityMin: 23, equityMax: 53, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 168, totalMax: 368, equityMin: 53, equityMax: 137, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 17, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 52, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 52, totalMax: 90, equityMin: 8, equityMax: 21, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 90, totalMax: 152, equityMin: 21, equityMax: 48, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 152, totalMax: 333, equityMin: 48, equityMax: 124, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 10, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 52, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 52, totalMax: 88, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 88, totalMax: 193, equityMin: 14, equityMax: 36, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 36, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 62, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 62, totalMax: 104, equityMin: 7, equityMax: 16, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 104, totalMax: 228, equityMin: 16, equityMax: 42, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 44, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 76, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 76, totalMax: 128, equityMin: 9, equityMax: 20, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 128, totalMax: 280, equityMin: 20, equityMax: 52, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 44, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 76, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 76, totalMax: 128, equityMin: 11, equityMax: 24, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 128, totalMax: 280, equityMin: 24, equityMax: 62, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 14, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 41, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 71, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 71, totalMax: 120, equityMin: 7, equityMax: 15, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 120, totalMax: 263, equityMin: 15, equityMax: 39, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 14, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 41, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 71, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 71, totalMax: 120, equityMin: 8, equityMax: 19, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 120, totalMax: 263, equityMin: 19, equityMax: 49, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 13, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 39, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 39, totalMax: 67, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 67, totalMax: 112, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 112, totalMax: 245, equityMin: 18, equityMax: 46, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 36, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 62, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 62, totalMax: 104, equityMin: 6, equityMax: 13, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 104, totalMax: 228, equityMin: 13, equityMax: 34, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ibank_bulgebracket hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_quant_hft: {
    "data-scientist": {
      entry: { totalMin: 50, totalMax: 100, equityType: "none", source: "Quant / HFT India entry (IIT-targeted: Tower / Optiver / IMC / Hudson River / Two Sigma / Millennium)", lastVerified: "2026-05-07", notes: "Indian fresher quant: ₹50-110L+ first-year. Performance-tied bonus." },
      mid: { totalMin: 120, totalMax: 280, equityType: "none", source: "Quant India 3-5 yr (eFinancialCareers / Wall Street Oasis archive)", lastVerified: "2026-05-07" },
      senior: { totalMin: 250, totalMax: 500, equityType: "none", source: "Quant India 6-10 yr senior researcher / trader", lastVerified: "2026-05-07", notes: "Senior quant: PnL-share dominates. ₹2.5-5Cr typical at top firms." },
      lead: { totalMin: 400, totalMax: 800, equityType: "none", source: "Quant India 10-14 yr team lead / portfolio manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 700, totalMax: 1500, equityType: "none", source: "Quant India 15+ yr partner / head", lastVerified: "2026-05-07", notes: "Partner-tier quant: ₹7-15Cr+. Top performers cross ₹25Cr in record years." },
    },
    "software-engineer": {
      entry: { totalMin: 48, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft software-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 114, totalMax: 267, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft software-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 238, totalMax: 476, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft software-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 381, totalMax: 762, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft software-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 667, totalMax: 1429, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft software-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 50, totalMax: 100, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft product-manager derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 120, totalMax: 280, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft product-manager derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 250, totalMax: 500, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft product-manager derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 400, totalMax: 800, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft product-manager derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 700, totalMax: 1500, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft product-manager derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 43, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ux-designer derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 103, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ux-designer derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 214, totalMax: 429, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ux-designer derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 343, totalMax: 686, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ux-designer derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 600, totalMax: 1286, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ux-designer derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 57, totalMax: 114, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ml-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 137, totalMax: 320, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ml-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 286, totalMax: 571, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ml-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 457, totalMax: 914, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ml-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 800, totalMax: 1714, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft ml-engineer derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 45, totalMax: 90, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft devops-sre derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 109, totalMax: 253, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft devops-sre derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 226, totalMax: 452, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft devops-sre derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 362, totalMax: 724, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft devops-sre derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 633, totalMax: 1357, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft devops-sre derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 26, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft data-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 63, totalMax: 147, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft data-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 131, totalMax: 262, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft data-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 210, totalMax: 419, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft data-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 367, totalMax: 786, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft data-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 31, totalMax: 62, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft business-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 74, totalMax: 173, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft business-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 155, totalMax: 310, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft business-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 248, totalMax: 495, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft business-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 433, totalMax: 929, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft business-analyst derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 38, totalMax: 76, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft sales derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 91, totalMax: 213, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft sales derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 190, totalMax: 381, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft sales derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 305, totalMax: 610, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft sales derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 533, totalMax: 1143, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft sales derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 38, totalMax: 76, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft marketing derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 91, totalMax: 213, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft marketing derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 190, totalMax: 381, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft marketing derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 305, totalMax: 610, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft marketing derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 533, totalMax: 1143, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft marketing derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 36, totalMax: 71, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft finance derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 86, totalMax: 200, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft finance derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 179, totalMax: 357, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft finance derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 286, totalMax: 571, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft finance derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 500, totalMax: 1071, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft finance derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 36, totalMax: 71, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft operations derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 86, totalMax: 200, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft operations derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 179, totalMax: 357, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft operations derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 286, totalMax: 571, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft operations derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 500, totalMax: 1071, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft operations derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 33, totalMax: 67, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft customer-success derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 80, totalMax: 187, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft customer-success derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 167, totalMax: 333, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft customer-success derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 267, totalMax: 533, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft customer-success derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 467, totalMax: 1000, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft customer-success derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 31, totalMax: 62, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft hr derived from data-scientist band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 74, totalMax: 173, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft hr derived from data-scientist band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 155, totalMax: 310, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft hr derived from data-scientist band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 248, totalMax: 495, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft hr derived from data-scientist band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 433, totalMax: 929, equityType: "none", source: "Sector default 2026-05-08 (__sector_quant_hft hr derived from data-scientist band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_psu_bank: {
    sales: {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "IBPS PO / SBI PO 2026 disclosure", lastVerified: "2026-05-07", notes: "Public-sector bank PO entry. Pension + DA on top of CTC; total realised value higher." },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "PSU bank Manager / Senior Manager (10-15 yr exp)", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 30, equityType: "none", source: "PSU bank AGM / DGM", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 45, equityType: "none", source: "PSU bank GM (15-20 yr)", lastVerified: "2026-05-07", notes: "PSU bank GM: defined-benefit pension actuarially worth ₹50-100L+." },
      executive: { totalMin: 45, totalMax: 75, equityType: "none", source: "PSU bank ED / CMD (20+ yr; appointed by FSIB)", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 94, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 7, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 51, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 51, totalMax: 84, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 8, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 68, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 7, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 89, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 31, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 37, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 75, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 70, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank finance derived from sales band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 70, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank operations derived from sales band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 37, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_bank hr derived from sales band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_private_bank: {
    sales: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Private bank India RM entry (Yes / IndusInd / Federal / RBL etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Private bank India RM mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Private bank India RM senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 26, totalMax: 50, equityType: "none", source: "Private bank India Cluster / Zonal Head (10-15 yr)", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 200, equityType: "none", source: "Private bank India Business Head / President (15+ yr)", lastVerified: "2026-05-07", notes: "C-suite at private banks (HDFC/ICICI/Axis/Kotak): ₹3-15Cr+. Top performers (CEO/MD) ₹10-25Cr." },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 250, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 263, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 225, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 75, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 300, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 263, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 31, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 238, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 34, totalMax: 138, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 163, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 200, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 47, totalMax: 188, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank finance derived from sales band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 47, totalMax: 188, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank operations derived from sales band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 175, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 163, equityType: "none", source: "Sector default 2026-05-08 (__sector_private_bank hr derived from sales band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_small_finance_bank: {
    sales: {
      entry: { totalMin: 3.5, totalMax: 6, equityType: "none", source: "Small Finance Bank India entry (AU / Equitas / Ujjivan / ESAF etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "SFB India mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "SFB India senior", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank software-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank product-manager derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank ux-designer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank data-scientist derived from sales band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank devops-sre derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 2, totalMax: 4, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank data-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank business-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank marketing derived from sales band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank finance derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank finance derived from sales band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank operations derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank operations derived from sales band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank customer-success derived from sales band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank hr derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_small_finance_bank hr derived from sales band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_unicorn_fintech: {
    "software-engineer": {
      entry: { totalMin: 15, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian fintech unicorn average (Slice / Jupiter / Cashfree / BharatPe / Niyo / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 25, totalMax: 42, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian fintech unicorn mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 42, totalMax: 70, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian fintech unicorn senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 65, totalMax: 110, equityMin: 18, equityMax: 45, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian fintech unicorn lead/staff (10-14 yr)", lastVerified: "2026-05-07" },
      executive: { totalMin: 100, totalMax: 250, equityMin: 35, equityMax: 100, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian fintech unicorn VP/CXO (15+ yr)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 16, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 44, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 74, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 116, equityMin: 19, equityMax: 47, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 263, equityMin: 37, equityMax: 105, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    /* ux-designer recalibrated 2026-05-13 (was SE-derived → wildly above
       market). Real-market validation: AmbitionBox / Glassdoor 2025-26 for
       Upstox / Razorpay / Slice / CRED / Zerodha Sr Product Designer caps
       at ₹24-36L total, not ₹38-63L. The "derived from SE band" auto-fill
       was treating designer comp at parity with engineering, which was
       producing ₹47L opening offers on the live demo for ₹24-33L roles.
       Numbers now align with the `indian-unicorn` ux-designer tier band in
       data/salaries.ts:752-756; fintech doesn't pay a designer premium. */
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 10, equityMin: 0.5, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox / Glassdoor 2025-26 (Razorpay / Slice / CRED Sr/Jr Product Designer)", lastVerified: "2026-05-13" },
      mid: { totalMin: 14, totalMax: 22, equityMin: 1.5, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox / Glassdoor 2025-26 (mid PD at Indian fintech unicorn)", lastVerified: "2026-05-13" },
      senior: { totalMin: 24, totalMax: 36, equityMin: 3, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (Upstox / Razorpay / Zerodha Sr Product Designer median ₹24-33L, p90 ₹36L)", lastVerified: "2026-05-13" },
      lead: { totalMin: 35, totalMax: 50, equityMin: 5, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Lead/Principal PD or Design Manager at Indian fintech unicorn)", lastVerified: "2026-05-13" },
      executive: { totalMin: 55, totalMax: 95, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Head of Design / VP Design at Indian fintech unicorn)", lastVerified: "2026-05-13" },
    },
    "ml-engineer": {
      entry: { totalMin: 18, totalMax: 29, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 30, totalMax: 50, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 84, equityMin: 11, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 78, totalMax: 132, equityMin: 24, equityMax: 59, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 120, totalMax: 300, equityMin: 46, equityMax: 132, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 16, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 44, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 74, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 116, equityMin: 19, equityMax: 47, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 263, equityMin: 37, equityMax: 105, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 14, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 40, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 67, equityMin: 8, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 62, totalMax: 105, equityMin: 17, equityMax: 43, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 238, equityMin: 33, equityMax: 95, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 23, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 39, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 61, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 138, equityMin: 10, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 10, totalMax: 16, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 46, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 72, equityMin: 6, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 163, equityMin: 11, equityMax: 33, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 12, totalMax: 19, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 34, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 34, totalMax: 56, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 52, totalMax: 88, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 80, totalMax: 200, equityMin: 14, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 12, totalMax: 19, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 34, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 34, totalMax: 56, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 52, totalMax: 88, equityMin: 9, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 80, totalMax: 200, equityMin: 17, equityMax: 48, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 32, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 53, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 49, totalMax: 83, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 188, equityMin: 11, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 32, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 53, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 49, totalMax: 83, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 188, equityMin: 13, equityMax: 38, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 46, totalMax: 77, equityMin: 6, equityMax: 16, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 175, equityMin: 12, equityMax: 35, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 10, totalMax: 16, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 27, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 46, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 72, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 163, equityMin: 9, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_fintech hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_unicorn_consumer: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn (Mamaearth / Sugar / boAt / Noise / Purplle etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 65, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 60, totalMax: 100, equityMin: 15, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn lead", lastVerified: "2026-05-07" },
      executive: { totalMin: 95, totalMax: 220, equityMin: 30, equityMax: 90, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn VP/CXO", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 68, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 63, totalMax: 105, equityMin: 16, equityMax: 42, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 231, equityMin: 32, equityMax: 95, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    /* ux-designer recalibrated 2026-05-13 (was SE-derived → senior ₹34-59L
       wildly above 2025-26 Indian consumer-unicorn market). AmbitionBox /
       Glassdoor caps Sr Product Designer at Mamaearth / boAt / Sugar /
       Purplle at ~₹22-32L; consumer brands pay below SE for design. */
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 9, equityMin: 0.5, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (consumer unicorn Jr Product Designer)", lastVerified: "2026-05-13" },
      mid: { totalMin: 12, totalMax: 20, equityMin: 1.5, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (consumer unicorn mid PD)", lastVerified: "2026-05-13" },
      senior: { totalMin: 22, totalMax: 32, equityMin: 3, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (Mamaearth / boAt / Purplle Sr Product Designer median ₹22-30L)", lastVerified: "2026-05-13" },
      lead: { totalMin: 32, totalMax: 48, equityMin: 5, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Lead/Design Manager at Indian consumer unicorn)", lastVerified: "2026-05-13" },
      executive: { totalMin: 50, totalMax: 90, equityMin: 10, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Head of Design / VP Design at Indian consumer unicorn)", lastVerified: "2026-05-13" },
    },
    "ml-engineer": {
      entry: { totalMin: 17, totalMax: 26, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 46, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 46, totalMax: 78, equityMin: 9, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 72, totalMax: 120, equityMin: 20, equityMax: 53, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 114, totalMax: 264, equityMin: 40, equityMax: 119, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 68, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 63, totalMax: 105, equityMin: 16, equityMax: 42, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 231, equityMin: 32, equityMax: 95, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 36, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 62, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 57, totalMax: 95, equityMin: 14, equityMax: 38, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 209, equityMin: 29, equityMax: 86, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 55, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 121, equityMin: 8, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 42, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 65, equityMin: 5, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 62, totalMax: 143, equityMin: 10, equityMax: 29, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 52, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 48, totalMax: 80, equityMin: 6, equityMax: 16, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 176, equityMin: 12, equityMax: 36, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 52, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 48, totalMax: 80, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 176, equityMin: 14, equityMax: 43, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 29, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 49, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 75, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 71, totalMax: 165, equityMin: 9, equityMax: 27, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 75, equityMin: 6, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 71, totalMax: 165, equityMin: 11, equityMax: 34, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 10, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 46, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 70, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 67, totalMax: 154, equityMin: 11, equityMax: 31, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 25, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 42, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 65, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 62, totalMax: 143, equityMin: 8, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_consumer hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_unicorn_edtech: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 16, equityMin: 0.5, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian edtech (post-2023 reset: Byju's / Unacademy / upGrad / Vedantu / Physics Wallah)", lastVerified: "2026-05-07", notes: "EdTech bands compressed 30-40% post 2023 reset; ESOP value uncertain at most names." },
      mid: { totalMin: 16, totalMax: 30, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian edtech mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 30, totalMax: 55, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian edtech senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 50, totalMax: 90, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian edtech lead", lastVerified: "2026-05-07" },
      executive: { totalMin: 80, totalMax: 180, equityMin: 25, equityMax: 70, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian edtech VP/CXO", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 8, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 58, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 95, equityMin: 13, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 84, totalMax: 189, equityMin: 26, equityMax: 74, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    /* ux-designer recalibrated 2026-05-13 (was SE-derived → senior ₹27-50L
       above edtech market). AmbitionBox 2025-26 puts Sr PD at BYJU's /
       upGrad / Vedantu / PhysicsWallah at ₹15-26L; edtech sub-pays
       design vs engineering. */
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 7, equityMin: 0.5, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (edtech Jr PD)", lastVerified: "2026-05-13" },
      mid: { totalMin: 9, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (edtech mid PD)", lastVerified: "2026-05-13" },
      senior: { totalMin: 15, totalMax: 26, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (BYJU's / upGrad / Vedantu Sr Product Designer median ₹15-22L)", lastVerified: "2026-05-13" },
      lead: { totalMin: 26, totalMax: 40, equityMin: 4, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Design Lead at Indian edtech unicorn)", lastVerified: "2026-05-13" },
      executive: { totalMin: 45, totalMax: 80, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Head of Design at Indian edtech unicorn)", lastVerified: "2026-05-13" },
    },
    "ml-engineer": {
      entry: { totalMin: 10, totalMax: 19, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 36, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 66, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 60, totalMax: 108, equityMin: 16, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 96, totalMax: 216, equityMin: 33, equityMax: 92, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 8, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 58, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 95, equityMin: 13, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 84, totalMax: 189, equityMin: 26, equityMax: 74, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 8, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 29, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 52, equityMin: 5, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 48, totalMax: 86, equityMin: 11, equityMax: 29, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 171, equityMin: 24, equityMax: 67, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 9, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 50, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 99, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 10, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 59, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 117, equityMin: 8, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 6, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 24, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 44, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 40, totalMax: 72, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 64, totalMax: 144, equityMin: 10, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 6, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 44, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 40, totalMax: 72, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 64, totalMax: 144, equityMin: 12, equityMax: 34, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 6, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 23, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 41, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 68, equityMin: 4, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 135, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 23, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 41, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 68, equityMin: 5, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 135, equityMin: 9, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 6, totalMax: 11, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 39, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 63, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 126, equityMin: 9, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 5, totalMax: 10, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 36, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 59, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 117, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_edtech hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_unicorn_logistics: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn (Delhivery / Ecom / XpressBees / Shadowfax / Porter / BlackBuck)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 55, totalMax: 95, equityMin: 14, equityMax: 35, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn lead", lastVerified: "2026-05-07" },
      executive: { totalMin: 90, totalMax: 200, equityMin: 28, equityMax: 80, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn VP/CXO", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 63, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 58, totalMax: 100, equityMin: 15, equityMax: 37, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 210, equityMin: 29, equityMax: 84, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    /* ux-designer recalibrated 2026-05-13 (was SE-derived → senior ₹34-54L
       above logistics market). Delhivery / Shiprocket / Ecom Express Sr
       PD lands at ₹18-28L per AmbitionBox 2025-26. */
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityMin: 0.5, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (logistics unicorn Jr PD)", lastVerified: "2026-05-13" },
      mid: { totalMin: 10, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (logistics unicorn mid PD)", lastVerified: "2026-05-13" },
      senior: { totalMin: 18, totalMax: 28, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2025-26 (Delhivery / Shiprocket / Ecom Express Sr PD median ₹20L)", lastVerified: "2026-05-13" },
      lead: { totalMin: 28, totalMax: 42, equityMin: 4, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Design Lead at Indian logistics unicorn)", lastVerified: "2026-05-13" },
      executive: { totalMin: 45, totalMax: 85, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor 2025-26 (Head of Design at Indian logistics unicorn)", lastVerified: "2026-05-13" },
    },
    "ml-engineer": {
      entry: { totalMin: 17, totalMax: 26, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 46, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 46, totalMax: 72, equityMin: 9, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 66, totalMax: 114, equityMin: 18, equityMax: 46, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 108, totalMax: 240, equityMin: 37, equityMax: 106, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 63, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 58, totalMax: 100, equityMin: 15, equityMax: 37, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 210, equityMin: 29, equityMax: 84, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 36, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 57, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 52, totalMax: 90, equityMin: 13, equityMax: 33, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 86, totalMax: 190, equityMin: 27, equityMax: 76, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 33, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 52, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 110, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 39, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 62, equityMin: 5, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 130, equityMin: 9, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 48, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 44, totalMax: 76, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 160, equityMin: 11, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 48, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 44, totalMax: 76, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 160, equityMin: 13, equityMax: 38, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 29, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 45, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 41, totalMax: 71, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 68, totalMax: 150, equityMin: 8, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 45, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 41, totalMax: 71, equityMin: 5, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 68, totalMax: 150, equityMin: 11, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 10, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 42, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 67, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 140, equityMin: 10, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 25, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 39, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 62, equityMin: 4, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 130, equityMin: 7, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_unicorn_logistics hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_gcc_global_capability_centre: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "GCC India entry (Wells Fargo / JPMC GCC / GE / Lowe's / Tesco / Sainsbury's etc.) — 11.5% increment 2026", lastVerified: "2026-05-07", notes: "GCCs 15-22% premium over IT services. RSU in parent stock." },
      mid: { totalMin: 22, totalMax: 40, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "GCC India mid (Zinnov GCC report 2026)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 75, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "GCC India senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 70, totalMax: 130, equityMin: 20, equityMax: 50, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "GCC India lead/staff", lastVerified: "2026-05-07" },
      executive: { totalMin: 130, totalMax: 280, equityMin: 45, equityMax: 110, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "GCC India Director / VP / GCC Head", lastVerified: "2026-05-07", notes: "GCC Head total comp $80-150K = ₹65-125L base + RSU. India-specific Head-of-org roles add 30-50% over IC ladder." },
    },
    "product-manager": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 42, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 79, equityMin: 8, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 137, equityMin: 21, equityMax: 53, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 137, totalMax: 294, equityMin: 47, equityMax: 116, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      /* ux-designer recalibrated 2026-05-13 (was SE-derived → senior ₹36-68L
         ≈1.7x GCC designer market; GCCs pay SE near global parity but
         design tracks Indian market). AmbitionBox 2025-26 puts MS / Wells
         Fargo / Walmart Global Tech / Target Bengaluru Sr PD at ₹24-38L. */
      entry: { totalMin: 8, totalMax: 14, equityMin: 0.5, equityMax: 1, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "AmbitionBox 2025-26 (GCC Jr PD India)", lastVerified: "2026-05-13" },
      mid: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "AmbitionBox 2025-26 (GCC mid PD India)", lastVerified: "2026-05-13" },
      senior: { totalMin: 24, totalMax: 38, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "AmbitionBox 2025-26 (MS / Walmart Global Tech / Target Sr PD median ₹26-32L)", lastVerified: "2026-05-13" },
      lead: { totalMin: 40, totalMax: 60, equityMin: 7, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor 2025-26 (Lead PD / Design Manager at India GCC)", lastVerified: "2026-05-13" },
      executive: { totalMin: 65, totalMax: 120, equityMin: 18, equityMax: 42, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor 2025-26 (Head of Design at India GCC)", lastVerified: "2026-05-13" },
    },
    "ml-engineer": {
      entry: { totalMin: 17, totalMax: 26, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 48, equityMin: 4, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 90, equityMin: 11, equityMax: 29, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 84, totalMax: 156, equityMin: 26, equityMax: 66, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 156, totalMax: 336, equityMin: 59, equityMax: 145, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 42, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 79, equityMin: 8, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 74, totalMax: 137, equityMin: 21, equityMax: 53, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 137, totalMax: 294, equityMin: 47, equityMax: 116, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 38, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 71, equityMin: 8, equityMax: 21, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 67, totalMax: 124, equityMin: 19, equityMax: 48, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 266, equityMin: 43, equityMax: 105, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 22, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 41, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 72, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 154, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 46, totalMax: 85, equityMin: 7, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 85, totalMax: 182, equityMin: 15, equityMax: 36, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 60, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 56, totalMax: 104, equityMin: 8, equityMax: 20, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 104, totalMax: 224, equityMin: 18, equityMax: 44, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 60, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 56, totalMax: 104, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 104, totalMax: 224, equityMin: 22, equityMax: 53, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 56, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 98, equityMin: 6, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 98, totalMax: 210, equityMin: 14, equityMax: 33, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 56, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 98, equityMin: 8, equityMax: 19, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 98, totalMax: 210, equityMin: 17, equityMax: 41, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 10, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 53, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 49, totalMax: 91, equityMin: 7, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 91, totalMax: 196, equityMin: 16, equityMax: 39, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 49, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 46, totalMax: 85, equityMin: 5, equityMax: 13, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 85, totalMax: 182, equityMin: 12, equityMax: 29, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_gcc_global_capability_centre hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_it_services: {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 6, equityType: "none", source: "IT services India entry (mid-tier: Mphasis / Coforge / Persistent / Hexaware / Mindtree / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "IT services mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "IT services senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 50, equityType: "none", source: "IT services lead/architect", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 130, equityType: "none", source: "IT services Delivery Head / VP / SVP", lastVerified: "2026-05-07", notes: "Top of IT-services ladder: VP-level ₹50-130L; CXO ₹150L+ at large firms (TCS / Infosys CTO / CHRO etc.)." },
    },
    "product-manager": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 137, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 117, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 156, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 137, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 124, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 2, totalMax: 3, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 3, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 15, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 28, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 4, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 85, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 104, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 104, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 2, totalMax: 4, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 91, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 2, totalMax: 4, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 85, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_it_services hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_pharma: {
    "software-engineer": {
      entry: { totalMin: 4.5, totalMax: 8, equityType: "none", source: "Indian pharma IT (Sun / Cipla / Lupin / Dr Reddy's / Aurobindo / Biocon)", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Pharma IT mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "Pharma IT senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 55, equityType: "none", source: "Pharma IT lead / VP", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 150, equityType: "none", source: "Pharma CTO / CIO / VP R&D", lastVerified: "2026-05-07" },
    },
    sales: {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Pharma MR (Medical Rep) entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Pharma Area Manager", lastVerified: "2026-05-07" },
      senior: { totalMin: 15, totalMax: 30, equityType: "none", source: "Pharma RSM / ZSM", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 55, equityType: "none", source: "Pharma National Sales Head / Country Manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 200, equityType: "none", source: "Pharma CCO / President / MD India", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 58, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 158, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 135, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 58, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 158, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 143, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 2, totalMax: 4, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 15, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 28, totalMax: 83, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 120, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 105, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_pharma hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_fmcg: {
    marketing: {
      entry: { totalMin: 14, totalMax: 24, equityType: "none", source: "Indian FMCG MT MBA (Dabur / Marico / Godrej / Britannia / Emami / Patanjali / etc.)", lastVerified: "2026-05-07", notes: "Top-tier (HUL/ITC/P&G/Nestle) ₹18-27L; mid-tier this band." },
      mid: { totalMin: 24, totalMax: 40, equityType: "none", source: "Indian FMCG Brand Manager", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 70, equityType: "none", source: "Indian FMCG Senior Brand Manager / Category Head", lastVerified: "2026-05-07" },
      lead: { totalMin: 65, totalMax: 120, equityType: "none", source: "FMCG Marketing Director / GM Marketing", lastVerified: "2026-05-07" },
      executive: { totalMin: 110, totalMax: 300, equityType: "none", source: "FMCG VP Marketing / CMO / President", lastVerified: "2026-05-07", notes: "FMCG MD India ₹3-15Cr+ at top firms (HUL CEO, ITC ED, etc.)." },
    },
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 30, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 88, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 81, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 138, totalMax: 375, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 18, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 53, totalMax: 92, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 158, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 144, totalMax: 394, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg product-manager derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 16, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 45, totalMax: 79, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 73, totalMax: 135, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 338, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 21, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 36, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 60, totalMax: 105, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 98, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 165, totalMax: 450, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 18, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 53, totalMax: 92, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 85, totalMax: 158, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 144, totalMax: 394, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 17, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 83, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 77, totalMax: 143, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 131, totalMax: 356, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 10, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 83, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 206, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 89, totalMax: 244, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 14, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg sales derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg sales derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 70, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg sales derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 65, totalMax: 120, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg sales derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 110, totalMax: 300, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg sales derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 13, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg finance derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg finance derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg finance derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg finance derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 103, totalMax: 281, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg finance derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 13, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg operations derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg operations derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg operations derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg operations derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 103, totalMax: 281, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg operations derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 12, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 35, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 57, totalMax: 105, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 96, totalMax: 263, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg customer-success derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg hr derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg hr derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg hr derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg hr derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 89, totalMax: 244, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_fmcg hr derived from marketing band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_psu_central: {
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "PSU Central (BHEL / NTPC / ONGC / Indian Oil / GAIL / SAIL etc.) — 7th CPC band", lastVerified: "2026-05-07", notes: "PSU pay = 7th CPC fixed bands. Pension = defined benefit, actuarially worth ₹50-150L. Job security key value." },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "PSU Central Manager / Senior Manager", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 40, equityType: "none", source: "PSU Central GM / DGM", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 60, equityType: "none", source: "PSU Central ED (Executive Director)", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 90, equityType: "none", source: "PSU Central CMD / Chairperson (govt-appointed)", lastVerified: "2026-05-07", notes: "PSU CMD: ₹50-90L cash + ₹50-150L actuarial pension value. Top of 7th CPC scale." },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 54, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 81, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 7, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 108, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 28, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 5, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_psu_central hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_academia_iit_iim: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityType: "none", source: "Indian academia (IIT/IIM/IISc) Assistant Professor — UGC pay scale", lastVerified: "2026-05-07", notes: "UGC pay scale fixed; consulting + grant earnings vary." },
      mid: { totalMin: 14, totalMax: 24, equityType: "none", source: "Associate Professor", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 40, equityType: "none", source: "Professor / Department Chair", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 60, equityType: "none", source: "Senior Professor / Endowed Chair / Dean", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 100, equityType: "none", source: "Director / VC (IIT/IIM Director appointed by MHRD)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 105, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 54, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 90, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 10, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 120, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 105, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 8, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 30, totalMax: 55, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 80, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 80, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 75, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 75, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 70, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_academia_iit_iim hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_aviation: {
    operations: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Indian aviation entry (IndiGo / Air India / SpiceJet / Akasa / Vistara) — ground / cabin crew", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Aviation mid (cabin lead / station ops)", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Aviation senior ops / commercial", lastVerified: "2026-05-07" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Aviation Director Ops / Network Planning", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 200, equityType: "none", source: "Aviation CEO / COO / President (IndiGo / Air India)", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 40, totalMax: 80, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 73, totalMax: 267, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation software-engineer derived from operations band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation product-manager derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation product-manager derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation product-manager derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 84, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation product-manager derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 77, totalMax: 280, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation product-manager derived from operations band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ux-designer derived from operations band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 48, totalMax: 96, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 88, totalMax: 320, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 84, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 77, totalMax: 280, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-scientist derived from operations band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 76, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 253, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation devops-sre derived from operations band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 147, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation data-analyst derived from operations band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 173, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation business-analyst derived from operations band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation sales derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation sales derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation sales derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 64, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation sales derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 213, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation sales derived from operations band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation marketing derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation marketing derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation marketing derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 64, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation marketing derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 213, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation marketing derived from operations band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation finance derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation finance derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation finance derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation finance derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 200, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation finance derived from operations band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation customer-success derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation customer-success derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation customer-success derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation customer-success derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 51, totalMax: 187, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation customer-success derived from operations band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation hr derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation hr derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation hr derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation hr derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 173, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_aviation hr derived from operations band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_hotels: {
    operations: {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Indian hotels entry (Taj / ITC / Oberoi / Marriott / Hyatt / Lemon Tree / Leela / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Hotels mid (F&B Manager / Front Office / Housekeeping)", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Hotels senior (GM / Regional Director)", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 55, equityType: "none", source: "Hotels Cluster GM / VP Operations", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 180, equityType: "none", source: "Hotels CEO / COO / President (IHCL / EIH / ITC Hotels)", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 73, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels software-engineer derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 73, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels software-engineer derived from operations band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels product-manager derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels product-manager derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels product-manager derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 77, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels product-manager derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 77, totalMax: 252, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels product-manager derived from operations band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ux-designer derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 216, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ux-designer derived from operations band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 88, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 88, totalMax: 288, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels ml-engineer derived from operations band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 77, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-scientist derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 77, totalMax: 252, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-scientist derived from operations band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 70, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels devops-sre derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 228, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels devops-sre derived from operations band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-analyst derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 132, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels data-analyst derived from operations band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels business-analyst derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 156, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels business-analyst derived from operations band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels sales derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels sales derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels sales derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels sales derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 192, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels sales derived from operations band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels marketing derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels marketing derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels marketing derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels marketing derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 192, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels marketing derived from operations band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels finance derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels finance derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels finance derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 55, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels finance derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels finance derived from operations band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels customer-success derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels customer-success derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels customer-success derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 51, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels customer-success derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 51, totalMax: 168, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels customer-success derived from operations band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels hr derived from operations band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels hr derived from operations band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels hr derived from operations band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels hr derived from operations band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 156, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_hotels hr derived from operations band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_real_estate: {
    sales: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Indian real-estate entry (Lodha / Prestige / Godrej / Sobha / DLF / Brigade etc.)", lastVerified: "2026-05-07", notes: "Real-estate sales = base + heavy variable on commission." },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Real-estate mid (Project Lead / Area Sales Manager)", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 45, equityType: "none", source: "Real-estate senior (VP / Regional Head)", lastVerified: "2026-05-07" },
      lead: { totalMin: 40, totalMax: 90, equityType: "none", source: "Real-estate Business Head / SVP", lastVerified: "2026-05-07" },
      executive: { totalMin: 80, totalMax: 250, equityType: "none", source: "Real-estate MD / CEO (DLF / Godrej Properties / Lodha)", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 50, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate software-engineer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 313, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate software-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate product-manager derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate product-manager derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate product-manager derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 118, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate product-manager derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 328, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate product-manager derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 51, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 101, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ux-designer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 281, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ux-designer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 60, totalMax: 135, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 120, totalMax: 375, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate ml-engineer derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 118, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-scientist derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 328, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-scientist derived from sales band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 48, totalMax: 107, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate devops-sre derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 297, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate devops-sre derived from sales band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 62, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-analyst derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 172, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate data-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 73, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate business-analyst derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 203, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate business-analyst derived from sales band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate marketing derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate marketing derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate marketing derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 40, totalMax: 90, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate marketing derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 80, totalMax: 250, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate marketing derived from sales band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate finance derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate finance derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate finance derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 84, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate finance derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 234, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate finance derived from sales band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate operations derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate operations derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate operations derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 84, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate operations derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 234, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate operations derived from sales band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate customer-success derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate customer-success derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate customer-success derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 79, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate customer-success derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 219, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate customer-success derived from sales band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate hr derived from sales band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate hr derived from sales band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate hr derived from sales band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 73, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate hr derived from sales band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 203, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_real_estate hr derived from sales band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_auto_oem: {
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Indian auto OEM (Tata Motors / M&M / Maruti / Hyundai / Bajaj / TVS / Royal Enfield / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Auto OEM mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 38, equityType: "none", source: "Auto OEM senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 70, equityType: "none", source: "Auto OEM lead / VP Engineering", lastVerified: "2026-05-07" },
      executive: { totalMin: 65, totalMax: 200, equityType: "none", source: "Auto OEM CTO / President / MD", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 74, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 68, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 59, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 7, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 46, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 84, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 78, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 74, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 68, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 67, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 62, totalMax: 190, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 110, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 46, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 49, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 49, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 140, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 46, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_auto_oem hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_telecom: {
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Indian telecom (Jio / Airtel / Vi / BSNL)", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 25, equityType: "none", source: "Telecom mid (Jio Platforms premium)", lastVerified: "2026-05-07" },
      senior: { totalMin: 25, totalMax: 50, equityType: "none", source: "Telecom senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 45, totalMax: 90, equityType: "none", source: "Telecom Director / VP", lastVerified: "2026-05-07" },
      executive: { totalMin: 80, totalMax: 300, equityType: "none", source: "Telecom CTO / CEO / President (Jio / Airtel)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 84, totalMax: 315, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 41, totalMax: 81, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 270, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 7, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 54, totalMax: 108, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 96, totalMax: 360, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 84, totalMax: 315, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 43, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 285, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 165, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 195, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 64, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 64, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 225, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 225, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 31, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 195, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_telecom hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_civil_services: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 12, equityType: "none", source: "Civil services / RBI Grade B / SEBI Grade A / NABARD entry — 7th CPC fixed band", lastVerified: "2026-05-07", notes: "Fixed pay scale + DA + HRA. Pension + perks add 30-50% non-cash value." },
      mid: { totalMin: 15, totalMax: 25, equityType: "none", source: "Civil services mid (Under Secretary / Joint Director)", lastVerified: "2026-05-07" },
      senior: { totalMin: 25, totalMax: 45, equityType: "none", source: "Civil services senior (Joint Secretary / Secretary)", lastVerified: "2026-05-07" },
      lead: { totalMin: 40, totalMax: 65, equityType: "none", source: "Civil services lead (Additional Secretary)", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 90, equityType: "none", source: "Civil services apex (Cabinet Secretary / Secretary to GoI)", lastVerified: "2026-05-07", notes: "Apex-grade civil servant: ₹55-90L cash + ₹50-150L actuarial pension. Type-A bungalow + protocol perks." },
    },
    "product-manager": {
      entry: { totalMin: 8, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 7, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 81, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 10, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 54, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 48, totalMax: 78, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 108, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 8, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 95, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 8, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 62, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 30, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 6, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 46, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_civil_services hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── New sector buckets (added in coverage-audit response) ─── */
  __sector_ai_genai_startup: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 30, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI startup India entry — talent scarcity premium", lastVerified: "2026-05-07" },
      mid: { totalMin: 30, totalMax: 55, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI India mid (Sarvam / Krutrim / Gan / Avataar / etc.)", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 95, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI India senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 160, equityMin: 25, equityMax: 60, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI India staff", lastVerified: "2026-05-07" },
      executive: { totalMin: 130, totalMax: 280, equityMin: 50, equityMax: 130, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI India founding-engineer / VP", lastVerified: "2026-05-07" },
    },
    "ml-engineer": {
      entry: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI MLE entry — 1.3-1.6x SE premium", lastVerified: "2026-05-07" },
      mid: { totalMin: 38, totalMax: 70, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI MLE mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 70, totalMax: 130, equityMin: 18, equityMax: 50, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AI/GenAI MLE senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 19, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 58, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 58, totalMax: 100, equityMin: 13, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 95, totalMax: 168, equityMin: 26, equityMax: 63, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 137, totalMax: 294, equityMin: 53, equityMax: 137, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 16, totalMax: 27, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 50, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 86, equityMin: 9, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 81, totalMax: 144, equityMin: 19, equityMax: 46, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 117, totalMax: 252, equityMin: 38, equityMax: 99, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 19, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 58, equityMin: 5, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 58, totalMax: 100, equityMin: 13, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 95, totalMax: 168, equityMin: 26, equityMax: 63, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 137, totalMax: 294, equityMin: 53, equityMax: 137, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 17, totalMax: 29, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 52, equityMin: 5, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 52, totalMax: 90, equityMin: 11, equityMax: 29, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 86, totalMax: 152, equityMin: 24, equityMax: 57, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 124, totalMax: 266, equityMin: 48, equityMax: 124, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 10, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 52, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 50, totalMax: 88, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 154, equityMin: 14, equityMax: 36, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 12, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 62, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 59, totalMax: 104, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 85, totalMax: 182, equityMin: 16, equityMax: 42, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 44, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 76, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 72, totalMax: 128, equityMin: 10, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 104, totalMax: 224, equityMin: 20, equityMax: 52, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 44, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 76, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 72, totalMax: 128, equityMin: 12, equityMax: 29, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 104, totalMax: 224, equityMin: 24, equityMax: 62, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 14, totalMax: 23, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 41, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 71, equityMin: 4, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 120, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 98, totalMax: 210, equityMin: 15, equityMax: 39, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 14, totalMax: 23, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 41, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 71, equityMin: 5, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 120, equityMin: 9, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 98, totalMax: 210, equityMin: 19, equityMax: 49, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 39, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 39, totalMax: 67, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 63, totalMax: 112, equityMin: 9, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 91, totalMax: 196, equityMin: 18, equityMax: 46, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 12, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 36, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 62, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 59, totalMax: 104, equityMin: 7, equityMax: 16, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 85, totalMax: 182, equityMin: 13, equityMax: 34, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_ai_genai_startup hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_global_gaming: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India entry (EA / Ubisoft / Riot / Activision)", lastVerified: "2026-05-07" },
      mid: { totalMin: 28, totalMax: 50, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 90, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 150, equityMin: 25, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India lead", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 19, totalMax: 29, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 53, equityMin: 5, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 53, totalMax: 95, equityMin: 15, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 95, totalMax: 158, equityMin: 26, equityMax: 63, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 16, totalMax: 25, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 25, totalMax: 45, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 45, totalMax: 81, equityMin: 11, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 81, totalMax: 135, equityMin: 19, equityMax: 46, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 22, totalMax: 34, equityMin: 3, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 34, totalMax: 60, equityMin: 7, equityMax: 20, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 60, totalMax: 108, equityMin: 18, equityMax: 40, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 108, totalMax: 180, equityMin: 33, equityMax: 79, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 19, totalMax: 29, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 53, equityMin: 5, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 53, totalMax: 95, equityMin: 15, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 95, totalMax: 158, equityMin: 26, equityMax: 63, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 17, totalMax: 27, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 48, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 86, equityMin: 13, equityMax: 29, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 86, totalMax: 143, equityMin: 24, equityMax: 57, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 10, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 28, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 50, equityMin: 4, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 50, totalMax: 83, equityMin: 7, equityMax: 17, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 33, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 59, equityMin: 5, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 59, totalMax: 98, equityMin: 8, equityMax: 20, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 40, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 72, equityMin: 6, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 72, totalMax: 120, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 40, equityMin: 2, equityMax: 7, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 72, equityMin: 7, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 72, totalMax: 120, equityMin: 12, equityMax: 29, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 14, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 38, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 68, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 113, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 14, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 38, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 68, equityMin: 5, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 113, equityMin: 9, equityMax: 23, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 13, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 35, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 35, totalMax: 63, equityMin: 5, equityMax: 11, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 63, totalMax: 105, equityMin: 9, equityMax: 21, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 33, equityMin: 1, equityMax: 4, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 59, equityMin: 4, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 59, totalMax: 98, equityMin: 7, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Sector default 2026-05-08 (__sector_global_gaming hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_gaming_realmoney: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian real-money gaming entry (Dream11 / MPL / Games24x7)", lastVerified: "2026-05-07", notes: "Regulatory uncertainty (state bans, GST changes) caps long-term ESOP value." },
      mid: { totalMin: 22, totalMax: 40, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian gaming mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 70, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian gaming senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 42, equityMin: 3, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 74, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 13, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 36, equityMin: 2, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 63, equityMin: 6, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 17, totalMax: 26, equityMin: 1, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 48, equityMin: 4, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 84, equityMin: 11, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 15, totalMax: 23, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 42, equityMin: 3, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 74, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 38, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 67, equityMin: 8, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 39, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 46, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 56, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 1, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 56, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 53, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 53, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 10, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 28, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 9, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 46, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_gaming_realmoney hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_media_entertainment: {
    marketing: {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Indian media entry (T-Series / Saregama / YRF / production houses)", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Media mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 40, equityType: "none", source: "Media senior (programming / talent / distribution head)", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 80, equityType: "none", source: "Media VP / Studio Head", lastVerified: "2026-05-07" },
      executive: { totalMin: 70, totalMax: 200, equityType: "none", source: "Media CEO / Network Head (Star/Sony/Zee/Viacom18)", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Indian media tech entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Media tech mid (OTT engineering)", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Media tech senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 54, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_media_entertainment hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_industrials_metals: {
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Indian industrials entry (Tata Steel / JSW / UltraTech / L&T / Asian Paints)", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Industrials mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Industrials senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 65, equityType: "none", source: "Industrials Plant Head / VP Engineering", lastVerified: "2026-05-07" },
      executive: { totalMin: 60, totalMax: 200, equityType: "none", source: "Industrials MD / CEO (Tata Steel / JSW / L&T)", lastVerified: "2026-05-07", notes: "Top of industrials ladder. Tata Steel / JSW / L&T MDs cross ₹3-15Cr." },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 54, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 78, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 62, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 57, totalMax: 190, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 19, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 110, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 52, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 46, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 140, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_industrials_metals hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_crypto_web3: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian crypto entry (CoinDCX / WazirX / CoinSwitch / Polygon)", lastVerified: "2026-05-07", notes: "Token-grant component common; valuation tied to crypto cycle." },
      mid: { totalMin: 24, totalMax: 45, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian crypto mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 45, totalMax: 80, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian crypto senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 15, totalMax: 25, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 product-manager derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 25, totalMax: 47, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 product-manager derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 84, equityMin: 11, equityMax: 27, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 product-manager derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 13, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 ux-designer derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 41, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 ux-designer derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 72, equityMin: 9, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 ux-designer derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 17, totalMax: 29, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 ml-engineer derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 29, totalMax: 54, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 ml-engineer derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 54, totalMax: 96, equityMin: 12, equityMax: 31, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 ml-engineer derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 15, totalMax: 25, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 data-scientist derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 25, totalMax: 47, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 data-scientist derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 47, totalMax: 84, equityMin: 11, equityMax: 27, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 data-scientist derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 13, totalMax: 23, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 devops-sre derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 43, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 devops-sre derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 43, totalMax: 76, equityMin: 10, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 devops-sre derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 8, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 data-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 25, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 data-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 44, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 data-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 9, totalMax: 16, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 business-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 29, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 business-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 52, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 business-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 11, totalMax: 19, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 sales derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 36, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 sales derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 64, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 sales derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 11, totalMax: 19, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 marketing derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 36, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 marketing derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 64, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 marketing derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 finance derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 34, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 finance derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 34, totalMax: 60, equityMin: 8, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 finance derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 operations derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 34, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 operations derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 34, totalMax: 60, equityMin: 8, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 operations derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 10, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 customer-success derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 31, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 customer-success derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 31, totalMax: 56, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 customer-success derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 9, totalMax: 16, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 hr derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 29, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 hr derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 52, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_crypto_web3 hr derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_travel_aggregator: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian travel aggregator entry (MMT / Yatra / Cleartrip / Ixigo / EaseMyTrip)", lastVerified: "2026-05-07" },
      mid: { totalMin: 20, totalMax: 38, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Travel aggregator mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 65, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Travel aggregator senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 40, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 68, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 11, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 34, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 34, totalMax: 59, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 46, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 46, totalMax: 78, equityMin: 9, equityMax: 24, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 13, totalMax: 21, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 40, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 40, totalMax: 68, equityMin: 7, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 11, totalMax: 19, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 19, totalMax: 36, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 62, equityMin: 7, equityMax: 17, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 7, totalMax: 11, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 8, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 42, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 10, totalMax: 16, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 52, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 10, totalMax: 16, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 52, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 9, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 49, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 9, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 29, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 46, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 8, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 25, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 42, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_travel_aggregator hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_healthcare_chain: {
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Indian healthcare-chain entry (Apollo / Fortis / Max / Manipal / Narayana)", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Healthcare-chain mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Healthcare-chain senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Healthcare-chain Hospital Director / VP", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 200, equityType: "none", source: "Healthcare-chain CEO / MD (Apollo / Fortis post-IHH-merger)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 54, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 66, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 52, totalMax: 190, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 17, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 30, totalMax: 110, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 44, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 140, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_healthcare_chain hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_insurance_amc: {
    sales: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Insurance / AMC sales entry (LIC / HDFC Life / ICICI Pru / SBI Life etc.)", lastVerified: "2026-05-07", notes: "Sales-coded role; heavy variable on premium / AUM growth." },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Insurance / AMC sales mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 38, equityType: "none", source: "Insurance / AMC sales senior", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Insurance / AMC IT entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "Insurance / AMC IT mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Insurance / AMC IT senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 54, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_insurance_amc hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_market_infra: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityType: "none", source: "Market infra entry (NSE / BSE / NSDL / CDSL / CRISIL / RBI / SEBI)", lastVerified: "2026-05-07", notes: "Govt-style fixed pay. Pension + perks add 30-50% non-cash value." },
      mid: { totalMin: 15, totalMax: 28, equityType: "none", source: "Market infra mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 28, totalMax: 50, equityType: "none", source: "Market infra senior (NSE/BSE Director / RBI Manager)", lastVerified: "2026-05-07" },
      lead: { totalMin: 45, totalMax: 75, equityType: "none", source: "Market infra lead (CGM / DGM)", lastVerified: "2026-05-07" },
      executive: { totalMin: 70, totalMax: 130, equityType: "none", source: "Market infra apex (NSE MD / SEBI Chairman)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 79, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 74, totalMax: 137, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 41, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 117, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 10, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 34, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 54, totalMax: 90, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 84, totalMax: 156, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 47, totalMax: 79, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 74, totalMax: 137, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 8, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 43, totalMax: 71, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 67, totalMax: 124, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 72, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 85, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 104, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 40, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 104, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 35, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 31, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 49, totalMax: 91, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 85, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_infra hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_power_renewables: {
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Indian power / renewables entry (Tata Power / Adani Green / ReNew / Suzlon)", lastVerified: "2026-05-07" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Power / renewables mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 40, equityType: "none", source: "Power / renewables senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 38, totalMax: 75, equityType: "none", source: "Power / renewables Director", lastVerified: "2026-05-07" },
      executive: { totalMin: 70, totalMax: 200, equityType: "none", source: "Power / renewables MD / CEO (Tata Power / Adani Green / ReNew)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables product-manager derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 40, totalMax: 79, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables product-manager derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 74, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 68, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 180, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 46, totalMax: 90, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 84, totalMax: 240, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 40, totalMax: 79, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 74, totalMax: 210, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 71, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 67, totalMax: 190, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 110, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables sales derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables sales derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables marketing derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables marketing derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 56, totalMax: 160, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables finance derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables finance derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 17, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables operations derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables operations derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 53, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 49, totalMax: 140, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables hr derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables hr derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 130, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_power_renewables hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },

  __sector_indian_d2c_consumer: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 0.5, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian D2C tech entry (Mamaearth / Boat / Sleepwell etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian D2C tech mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 26, totalMax: 50, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian D2C tech senior", lastVerified: "2026-05-07" },
    },
    marketing: {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "D2C performance marketing entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 25, equityType: "none", source: "D2C marketing mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 25, totalMax: 50, equityType: "none", source: "D2C Brand / Growth Director", lastVerified: "2026-05-07" },
    },
    sales: {
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "D2C sales / partnerships mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "D2C VP Sales", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 8, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer product-manager derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 27, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer product-manager derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 53, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer product-manager derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 7, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer ux-designer derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 23, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer ux-designer derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 45, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer ux-designer derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 10, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer ml-engineer derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 31, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer ml-engineer derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 31, totalMax: 60, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer ml-engineer derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 8, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer data-scientist derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 27, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer data-scientist derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 27, totalMax: 53, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer data-scientist derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 8, totalMax: 13, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer devops-sre derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 25, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer devops-sre derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 48, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer devops-sre derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 8, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer data-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer data-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer data-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 9, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer business-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer business-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 33, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer business-analyst derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 6, totalMax: 11, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer finance derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer finance derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer finance derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 11, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer operations derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer operations derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer operations derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 6, totalMax: 10, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer customer-success derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer customer-success derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 35, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer customer-success derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 5, totalMax: 9, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer hr derived from software-engineer band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 17, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer hr derived from software-engineer band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 33, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_d2c_consumer hr derived from software-engineer band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_retail_chains: {
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Indian retail chains tech entry (Reliance / Tata / Trent / DMart)", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 20, equityType: "none", source: "Retail tech mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 40, equityType: "none", source: "Retail tech senior", lastVerified: "2026-05-07" },
    },
    operations: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Retail store-ops entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Retail Store Manager / Cluster", lastVerified: "2026-05-07" },
      senior: { totalMin: 15, totalMax: 30, equityType: "none", source: "Retail Regional Head", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 60, equityType: "none", source: "Retail VP Operations", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 200, equityType: "none", source: "Retail CEO (DMart / Trent / Reliance Retail)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 36, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 48, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 42, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 38, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 32, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 30, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_retail_chains hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_audit_legal_midtier: {
    consultant: {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Indian mid-tier audit / legal entry (Walker Chandiok / S.R. Batliboi / Lodha & Co / AZB / Trilegal etc.)", lastVerified: "2026-05-07", notes: "Bonus 30-60% of base; partner-track economics dominate at 8-12 yr." },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "Mid-tier audit / legal Associate", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Mid-tier audit / legal Senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 40, totalMax: 90, equityType: "none", source: "Mid-tier audit / legal Manager / Senior Manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 80, totalMax: 250, equityType: "none", source: "Mid-tier audit / legal Partner (AZB / Trilegal / Khaitan top-tier)", lastVerified: "2026-05-07", notes: "AZB / Trilegal / Khaitan / Cyril Amarchand Partner: ₹2-15Cr depending on book." },
    },
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 20, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 82, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 73, totalMax: 227, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier software-engineer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier product-manager derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 239, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier product-manager derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 37, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 33, totalMax: 74, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 205, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ux-designer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 44, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 87, totalMax: 273, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier ml-engineer derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 86, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 76, totalMax: 239, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-scientist derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 39, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 78, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 69, totalMax: 216, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier devops-sre derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 11, totalMax: 23, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 20, totalMax: 45, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 125, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier data-analyst derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 47, totalMax: 148, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier business-analyst derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier sales derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier sales derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier sales derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier sales derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 182, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier sales derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier marketing derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier marketing derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier marketing derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 65, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier marketing derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 58, totalMax: 182, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier marketing derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier finance derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier finance derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier finance derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier finance derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 170, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier finance derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier operations derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier operations derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier operations derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 61, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier operations derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 170, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier operations derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 57, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier customer-success derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 51, totalMax: 159, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier customer-success derived from consultant band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier hr derived from consultant band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier hr derived from consultant band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 27, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier hr derived from consultant band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier hr derived from consultant band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 47, totalMax: 148, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_audit_legal_midtier hr derived from consultant band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_saas_broad: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 22, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian SaaS broad entry (Freshworks / Zoho / Postman / BrowserStack / Chargebee / etc. — NB bespoke entries override this)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 40, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian SaaS broad mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 70, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian SaaS broad senior", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 13, totalMax: 23, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad product-manager derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 42, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad product-manager derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 74, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad product-manager derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 11, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 36, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad ux-designer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 63, equityMin: 6, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad ux-designer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 26, totalMax: 48, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 84, equityMin: 11, equityMax: 26, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad ml-engineer derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 13, totalMax: 23, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 42, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad data-scientist derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 42, totalMax: 74, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad data-scientist derived from SE band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 11, totalMax: 21, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 38, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 67, equityMin: 8, equityMax: 19, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 7, totalMax: 12, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 22, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 39, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 46, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 10, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad sales derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad sales derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 56, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad sales derived from SE band)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 10, totalMax: 18, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad marketing derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad marketing derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 56, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad marketing derived from SE band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 9, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad finance derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad finance derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 53, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad finance derived from SE band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 9, totalMax: 17, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad operations derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 17, totalMax: 30, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad operations derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 30, totalMax: 53, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad operations derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 8, totalMax: 15, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 49, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad hr derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad hr derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 46, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Sector default 2026-05-08 (__sector_indian_saas_broad hr derived from SE band)", lastVerified: "2026-05-08" },
    },
  },
  __sector_indian_advertising_agency: {
    marketing: {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Indian advertising agency entry (Ogilvy / Leo Burnett / DDB Mudra / Wieden+Kennedy / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "Agency Account Mgmt / Strategy / Creative mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 50, equityType: "none", source: "Agency Senior Strategist / Group Head", lastVerified: "2026-05-07" },
      lead: { totalMin: 45, totalMax: 100, equityType: "none", source: "Agency Creative Director / Business Head", lastVerified: "2026-05-07" },
      executive: { totalMin: 80, totalMax: 250, equityType: "none", source: "Agency CCO / CEO India (Ogilvy / WPP / Publicis Groupe)", lastVerified: "2026-05-07" },
    },
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 28, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 63, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 56, totalMax: 125, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 313, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency software-engineer derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "product-manager": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 59, totalMax: 131, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency product-manager derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 328, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency product-manager derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 56, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 51, totalMax: 113, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 90, totalMax: 281, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ux-designer derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 8, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 33, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 33, totalMax: 75, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 150, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 120, totalMax: 375, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency ml-engineer derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 7, totalMax: 13, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 29, totalMax: 66, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 59, totalMax: 131, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 105, totalMax: 328, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-scientist derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 26, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 26, totalMax: 59, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 53, totalMax: 119, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 95, totalMax: 297, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency devops-sre derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 15, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 34, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 31, totalMax: 69, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 55, totalMax: 172, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency data-analyst derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 81, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 203, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency business-analyst derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 5, totalMax: 10, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency sales derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency sales derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 50, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency sales derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 100, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency sales derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 80, totalMax: 250, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency sales derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency finance derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency finance derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency finance derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 94, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency finance derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 234, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency finance derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency operations derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 21, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency operations derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 47, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency operations derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 42, totalMax: 94, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency operations derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 75, totalMax: 234, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency operations derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 9, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 19, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 44, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 39, totalMax: 88, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency customer-success derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 219, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency customer-success derived from marketing band)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency hr derived from marketing band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency hr derived from marketing band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency hr derived from marketing band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 37, totalMax: 81, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency hr derived from marketing band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 65, totalMax: 203, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_advertising_agency hr derived from marketing band)", lastVerified: "2026-05-08" },
    },
  },

  /* Generic catch-all — bound to indian_market_generic bucket from
     classifyCompanyType. ALWAYS hits when no other sector matches.
     Bands are AmbitionBox / Glassdoor / Naukri 2026 medians for the
     Indian market. Used so every company has explicit source
     attribution rather than falling through the in-handler default. */
  __sector_indian_market_generic: {
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 12, equityType: "none", source: "Indian market median (AmbitionBox / Glassdoor / Naukri 2026 cohort) — no company-specific data", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 25, equityType: "none", source: "Indian market median 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Indian market median 2026", lastVerified: "2026-05-07" },
      lead: { totalMin: 38, totalMax: 75, equityType: "none", source: "Indian market median 2026 — Senior IC / Architect", lastVerified: "2026-05-07" },
      executive: { totalMin: 65, totalMax: 150, equityType: "none", source: "Indian market median 2026 — VP / CXO band", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      entry: { totalMin: 8, totalMax: 18, equityType: "none", source: "Indian market median PM entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 18, totalMax: 35, equityType: "none", source: "Indian market median PM mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 60, equityType: "none", source: "Indian market median PM senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 55, totalMax: 100, equityType: "none", source: "Indian market median Group PM / Director", lastVerified: "2026-05-07" },
      executive: { totalMin: 90, totalMax: 200, equityType: "none", source: "Indian market median CPO / VP Product", lastVerified: "2026-05-07" },
    },
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 10, equityType: "none", source: "Indian market median Designer entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "Indian market median Designer mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 40, equityType: "none", source: "Indian market median Senior Designer", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 70, equityType: "none", source: "Indian market median Design Manager / Director", lastVerified: "2026-05-07" },
    },
    "engineering-manager": {
      mid: { totalMin: 25, totalMax: 50, equityType: "none", source: "Indian market median EM mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 45, totalMax: 90, equityType: "none", source: "Indian market median EM senior / Director", lastVerified: "2026-05-07" },
      lead: { totalMin: 75, totalMax: 150, equityType: "none", source: "Indian market median Sr Director / VP Eng", lastVerified: "2026-05-07" },
      executive: { totalMin: 130, totalMax: 280, equityType: "none", source: "Indian market median CTO / SVP Eng", lastVerified: "2026-05-07" },
    },
    "data-scientist": {
      entry: { totalMin: 6, totalMax: 14, equityType: "none", source: "Indian market median DS entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 14, totalMax: 28, equityType: "none", source: "Indian market median DS mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 26, totalMax: 50, equityType: "none", source: "Indian market median DS senior", lastVerified: "2026-05-07" },
    },
    "ml-engineer": {
      entry: { totalMin: 8, totalMax: 18, equityType: "none", source: "Indian market median ML Eng entry (1.3-1.6x SE premium)", lastVerified: "2026-05-07" },
      mid: { totalMin: 18, totalMax: 38, equityType: "none", source: "Indian market median ML Eng mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 35, totalMax: 70, equityType: "none", source: "Indian market median ML Eng senior", lastVerified: "2026-05-07" },
    },
    sales: {
      entry: { totalMin: 4, totalMax: 9, equityType: "none", source: "Indian market median sales entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 20, equityType: "none", source: "Indian market median sales mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 40, equityType: "none", source: "Indian market median sales senior", lastVerified: "2026-05-07" },
    },
    marketing: {
      entry: { totalMin: 4, totalMax: 10, equityType: "none", source: "Indian market median marketing entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "Indian market median marketing mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 42, equityType: "none", source: "Indian market median marketing senior", lastVerified: "2026-05-07" },
    },
    consultant: {
      entry: { totalMin: 6, totalMax: 14, equityType: "none", source: "Indian market median consultant entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 26, equityType: "none", source: "Indian market median consultant mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 50, equityType: "none", source: "Indian market median consultant senior", lastVerified: "2026-05-07" },
    },
    operations: {
      entry: { totalMin: 4, totalMax: 9, equityType: "none", source: "Indian market median operations entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 20, equityType: "none", source: "Indian market median operations mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 38, equityType: "none", source: "Indian market median operations senior", lastVerified: "2026-05-07" },
    },
    hr: {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Indian market median HR entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Indian market median HR mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 35, equityType: "none", source: "Indian market median HR senior", lastVerified: "2026-05-07" },
    },
    finance: {
      entry: { totalMin: 5, totalMax: 12, equityType: "none", source: "Indian market median finance entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 25, equityType: "none", source: "Indian market median finance mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Indian market median finance senior", lastVerified: "2026-05-07" },
    },
    legal: {
      entry: { totalMin: 5, totalMax: 12, equityType: "none", source: "Indian market median legal entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 24, equityType: "none", source: "Indian market median legal mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 50, equityType: "none", source: "Indian market median legal senior", lastVerified: "2026-05-07" },
    },
    teacher: {
      entry: { totalMin: 3, totalMax: 6, equityType: "none", source: "Indian market median teacher entry", lastVerified: "2026-05-07" },
      mid: { totalMin: 5, totalMax: 12, equityType: "none", source: "Indian market median teacher mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 10, totalMax: 22, equityType: "none", source: "Indian market median Senior Teacher / Principal", lastVerified: "2026-05-07" },
    },
    doctor: {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Indian market median doctor entry (post-MBBS)", lastVerified: "2026-05-07" },
      mid: { totalMin: 12, totalMax: 25, equityType: "none", source: "Indian market median doctor mid (post-MD/MS)", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 60, equityType: "none", source: "Indian market median Senior Consultant Doctor", lastVerified: "2026-05-07" },
    },
    "devops-sre": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 24, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 43, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 71, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic devops-sre derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 62, totalMax: 143, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic devops-sre derived from SE band)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 7, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 25, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 41, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic data-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 83, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic data-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 29, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 49, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic business-analyst derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 42, totalMax: 98, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic business-analyst derived from SE band)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 8, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic customer-success derived from SE band)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic customer-success derived from SE band)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 31, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic customer-success derived from SE band)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 53, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic customer-success derived from SE band)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 105, equityType: "none", source: "Sector default 2026-05-08 (__sector_indian_market_generic customer-success derived from SE band)", lastVerified: "2026-05-08" },
    },
  },

  /* ─── Design Agencies / Studios ───────────────────────────────── */
  "bombay design centre": {
    "ux-designer": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Entry-level UI/UX at Bombay Design Centre." },
      mid: { totalMin: 6, totalMax: 9, equityType: "none", source: "AmbitionBox 2026 (Product Designer ₹9.2-10.2L)", lastVerified: "2026-05-07", notes: "Product Designer 3-5 yrs; Visual Designer ₹9.8-10.9L." },
      senior: { totalMin: 9, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Senior PD; design centres pay below product unicorns by 50-60%." },
    },
  },
  "lollypop design studio": {
    "ux-designer": {
      mid: { totalMin: 8, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 24, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Top-tier Indian design studio; pays above sector average." },
    },
  },
  "thence": {
    "ux-designer": {
      entry: { totalMin: 5.8, totalMax: 7.7, equityType: "none", source: "Glassdoor + AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Entry UX/Product designer 1-3 yrs." },
      mid: { totalMin: 6, totalMax: 8.7, equityType: "none", source: "Glassdoor + AmbitionBox 2026", lastVerified: "2026-05-07", notes: "UX designer 3-6 yrs." },
      senior: { totalMin: 9, totalMax: 10.8, equityType: "none", source: "Glassdoor + AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Senior UX designer at Thence — design agency, pays below product unicorns." },
    },
  },
  "yellow slice": {
    "ux-designer": {
      entry: { totalMin: 3.2, totalMax: 4.3, equityType: "none", source: "AmbitionBox + Indeed 2026", lastVerified: "2026-05-07", notes: "Junior UI designer at Yellow Slice." },
      mid: { totalMin: 3.8, totalMax: 5.6, equityType: "none", source: "AmbitionBox + Indeed 2026", lastVerified: "2026-05-07", notes: "UI designer 2-4 yrs." },
      senior: { totalMin: 6.5, totalMax: 8.7, equityType: "none", source: "AmbitionBox + Indeed 2026", lastVerified: "2026-05-07", notes: "Senior UI designer 5+ yrs at Yellow Slice." },
    },
  },
  "spinny": {
    "ux-designer": {
      entry: { totalMin: 10, totalMax: 14, equityType: "esop", equityMin: 1, equityMax: 2, equityVesting: "4-year vest, 1-year cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Entry / Product Designer 1 at Spinny." },
      mid: { totalMin: 19.6, totalMax: 25.4, equityType: "esop", equityMin: 2, equityMax: 4, equityVesting: "4-year vest, 1-year cliff", source: "AmbitionBox + Levels.fyi 2026", lastVerified: "2026-05-07", notes: "Product Designer 2 / mid-level (6-9 yrs) at Spinny." },
      senior: { totalMin: 27.9, totalMax: 30.8, equityType: "esop", equityMin: 3, equityMax: 6, equityVesting: "4-year vest, 1-year cliff", source: "AmbitionBox + Levels.fyi 2026", lastVerified: "2026-05-07", notes: "Senior Product Designer (5-6 yrs) at Spinny. ~₹35 LPA total comp incl. ESOPs." },
    },
  },
  // Accenture — IT services / consulting hybrid; UX bands lower than
  // product unicorns. Per AmbitionBox + Glassdoor 2026.
  "accenture": {
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 9, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Associate Designer / Designer Analyst at Accenture." },
      mid: { totalMin: 12, totalMax: 18, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Designer / Senior Designer / Consultant at Accenture (3-7 yrs)." },
      senior: { totalMin: 22, totalMax: 32, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Senior Designer / Manager (8+ yrs) at Accenture." },
    },
  
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 17, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x software-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 31, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x software-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x software-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 87, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x software-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 43, totalMax: 112, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x software-engineer)", lastVerified: "2026-05-08" },
    },
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 9, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 16, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 16, totalMax: 43, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 22, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      /* Recalibrated 2026-05-14 from bug-report 11. Prior seed-dataset
       * bands (totalMax=34 senior, 11 entry) implied entry-level
       * Accenture BAs could top out at ₹11L which was both too high
       * for entry and too low for senior; opening offer landed at
       * resume-derived "senior" bucket of ₹25L despite 0 YOE. New
       * bands are derived from Google/AmbitionBox/Glassdoor 2026:
       * entry 1-3y ₹6-8L, mid 3-6y ₹9-12L, senior 6-9y ₹14-18L,
       * with lead/executive tracking IT-services scaling. */
      entry: { totalMin: 6, totalMax: 8, equityType: "none", source: "AmbitionBox/Glassdoor 2026-05-14 — Accenture Business Analyst (Associate, 1-3 yrs)", lastVerified: "2026-05-14" },
      mid: { totalMin: 9, totalMax: 12, equityType: "none", source: "AmbitionBox/Glassdoor 2026-05-14 — Accenture Business Analyst (3-6 yrs)", lastVerified: "2026-05-14" },
      senior: { totalMin: 14, totalMax: 18, equityType: "none", source: "AmbitionBox/Glassdoor 2026-05-14 — Accenture Senior Business Analyst (6-9 yrs)", lastVerified: "2026-05-14" },
      lead: { totalMin: 20, totalMax: 28, equityType: "none", source: "AmbitionBox/Glassdoor 2026-05-14 — Accenture Lead BA / Consultant (9+ yrs)", lastVerified: "2026-05-14" },
      executive: { totalMin: 28, totalMax: 42, equityType: "none", source: "AmbitionBox/Glassdoor 2026-05-14 — Accenture Principal/Senior Manager BA", lastVerified: "2026-05-14" },
    },
    "project-manager": {
      entry: { totalMin: 6, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 31, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 87, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 47, totalMax: 112, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x project-manager)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 6, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 31, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 34, totalMax: 87, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 47, totalMax: 112, equityType: "none", source: "Seed dataset 2026-05-08 (accenture 0.62x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  /* ─── 2026 Wave-2 expansion: top-50 highest-traffic adds ──────── */
  /* FAANG / Big Tech expansion. */
  meta: {
    "software-engineer": {
      entry: { totalMin: 28, totalMax: 42, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr / quarterly (no cliff post-2022)", joiningBonusOverride: [4, 10], source: "Levels.fyi (Meta India 412 entries Apr 2026)", lastVerified: "2026-05-08", notes: "Software Engineer Junior: E3/E4 entry — Meta India hires E4-heavy; push for E4 if FTE convert from intern." },
      mid: { totalMin: 50, totalMax: 75, equityMin: 18, equityMax: 38, equityType: "rsu", equityVesting: "4yr / quarterly", joiningBonusOverride: [8, 20], source: "Levels.fyi", lastVerified: "2026-05-08", notes: "Software Engineer Mid: E5 (5-7 yrs) median ₹62L, P75 ₹78L. RSU refresher cadence (annual vs out-of-cycle) is the lever." },
      senior: { totalMin: 75, totalMax: 130, equityMin: 35, equityMax: 75, equityType: "rsu", equityVesting: "4yr / quarterly", joiningBonusOverride: [15, 40], source: "Levels.fyi", lastVerified: "2026-05-08", notes: "Software Engineer Senior: E6 (8-12 yrs) median ₹95L, P90 ₹140L+. AI/Reality Labs orgs pay top of band; team selection matters." },
      lead: { totalMin: 130, totalMax: 220, equityMin: 70, equityMax: 160, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Levels.fyi", lastVerified: "2026-05-08", notes: "E7 staff Meta India ₹160-220L TC." },
    },
    "product-manager": {
      entry: { totalMin: 28, totalMax: 55, equityMin: 7, equityMax: 16, equityType: "rsu", equityVesting: "4yr / quarterly", joiningBonusOverride: [4, 10], source: "Levels.fyi (Meta India IC4 PM)", lastVerified: "2026-05-08", notes: "Product Manager Junior: IC4 (RPM/MBA hire) — strategy interview is the rubric." },
      mid: { totalMin: 50, totalMax: 80, equityMin: 18, equityMax: 38, equityType: "rsu", equityVesting: "4yr / quarterly", joiningBonusOverride: [8, 20], source: "Levels.fyi", lastVerified: "2026-05-08", notes: "Product Manager Mid: IC5 — performance bonus (15-20% target) + RSU refresher are key levers." },
      senior: { totalMin: 75, totalMax: 130, equityMin: 35, equityMax: 70, equityType: "rsu", equityVesting: "4yr / quarterly", joiningBonusOverride: [15, 40], source: "Levels.fyi", lastVerified: "2026-05-08", notes: "Product Manager Senior: IC6 — org scope (Family of Apps vs Reality Labs) drives top-of-band." },
    },
  
    "ux-designer": {
      entry: { totalMin: 7, totalMax: 41, equityMin: 1, equityMax: 5, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 27, totalMax: 77, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 48, totalMax: 136, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 77, totalMax: 204, equityMin: 9, equityMax: 24, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 102, totalMax: 255, equityMin: 12, equityMax: 31, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 24, totalMax: 60, equityMin: 4, equityMax: 11, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 48, totalMax: 136, equityMin: 9, equityMax: 24, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 85, totalMax: 255, equityMin: 15, equityMax: 46, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 136, totalMax: 374, equityMin: 24, equityMax: 67, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 170, totalMax: 476, equityMin: 31, equityMax: 86, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-scientist": {
      entry: { totalMin: 17, totalMax: 43, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 34, totalMax: 102, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 60, totalMax: 187, equityMin: 8, equityMax: 26, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 94, totalMax: 272, equityMin: 13, equityMax: 38, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 136, totalMax: 357, equityMin: 19, equityMax: 50, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x data-scientist)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 17, totalMax: 37, equityMin: 2, equityMax: 4, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 31, totalMax: 85, equityMin: 3, equityMax: 9, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 60, totalMax: 162, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 94, totalMax: 238, equityMin: 9, equityMax: 24, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 128, totalMax: 306, equityMin: 13, equityMax: 31, equityType: "rsu", equityVesting: "4yr / quarterly", source: "Seed dataset 2026-05-08 (meta 1.7x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  netflix: {
    "software-engineer": {
      mid: { totalMin: 65, totalMax: 95, equityMin: 25, equityMax: 50, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07", notes: "Netflix India only opened 2024-2025; small but premium-pay team." },
      senior: { totalMin: 95, totalMax: 160, equityMin: 50, equityMax: 100, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  
    "product-manager": {
      entry: { totalMin: 25, totalMax: 58, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 45, totalMax: 126, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 81, totalMax: 234, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 126, totalMax: 324, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 171, totalMax: 450, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x product-manager)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 7, totalMax: 29, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 50, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 32, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 50, totalMax: 135, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 72, totalMax: 180, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x data-analyst)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 7, totalMax: 32, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 58, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 36, totalMax: 99, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 58, totalMax: 153, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 81, totalMax: 216, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x business-analyst)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 18, totalMax: 40, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 32, totalMax: 90, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 63, totalMax: 171, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 99, totalMax: 252, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 135, totalMax: 324, equityType: "none", source: "Seed dataset 2026-05-08 (netflix 1.8x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  /* Edtech (post-2024 reset bands). */
  "byju's": {
    "software-engineer": {
      entry: { totalMin: 7, totalMax: 12, equityMin: 0.5, equityMax: 2, equityType: "esop", equityVesting: "4yr — value uncertain post-reset", source: "AmbitionBox + Glassdoor 2026", lastVerified: "2026-05-07", notes: "Post-2024 BYJU's reset; ESOP value highly discounted." },
      mid: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 36, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  unacademy: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 0.5, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Post-2024 Unacademy reset; ESOP credibility low." },
      mid: { totalMin: 16, totalMax: 26, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 26, totalMax: 42, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "teacher": {
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Live-class educator. Top performers get revenue-share model ₹50L+." },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  physicswallah: {
    "software-engineer": {
      entry: { totalMin: 10, totalMax: 16, equityMin: 0.5, equityMax: 2, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026 + IPO filing signal", lastVerified: "2026-05-07", notes: "PW post-IPO ESOP credibility lifted. Most stable edtech pay 2026." },
      mid: { totalMin: 18, totalMax: 30, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 30, totalMax: 48, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "teacher": {
      mid: { totalMin: 10, totalMax: 22, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "PW educator. Top earners ₹1Cr+ via revenue-share." },
      senior: { totalMin: 22, totalMax: 50, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* Payments / Fintech. */
  paytm: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr — listed equity", joiningBonusOverride: [0, 2], source: "AmbitionBox + Glassdoor 2026 + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Paytm listed; RSU credibility solid post-2023. Negotiation focus: fixed." },
      mid: { totalMin: 20, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr", joiningBonusOverride: [1, 4], source: "Glassdoor + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + level." },
      senior: { totalMin: 32, totalMax: 52, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr", joiningBonusOverride: [2, 8], source: "Glassdoor + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + equity." },
    },
  
    "product-manager": {
      entry: { totalMin: 12, totalMax: 27, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 21, totalMax: 60, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 38, totalMax: 111, equityMin: 5, equityMax: 16, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 60, totalMax: 153, equityMin: 8, equityMax: 21, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 81, totalMax: 213, equityMin: 11, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x product-manager)", lastVerified: "2026-05-08" },
    },
    "ux-designer": {
      entry: { totalMin: 3, totalMax: 20, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 38, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 68, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 102, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 51, totalMax: 128, equityMin: 6, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 12, totalMax: 30, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 68, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 43, totalMax: 128, equityMin: 8, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 68, totalMax: 187, equityMin: 12, equityMax: 34, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 85, totalMax: 238, equityMin: 15, equityMax: 43, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 3, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 24, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 43, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 64, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 34, totalMax: 85, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x data-analyst)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 15, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 27, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 47, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 72, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 38, totalMax: 102, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x business-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 15, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 34, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 21, totalMax: 68, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 38, totalMax: 119, equityMin: 2, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 187, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x sales)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 3, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 27, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x customer-success)", lastVerified: "2026-05-08" },
      senior: { totalMin: 19, totalMax: 51, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x customer-success)", lastVerified: "2026-05-08" },
      lead: { totalMin: 30, totalMax: 77, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 43, totalMax: 111, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (paytm 0.85x customer-success)", lastVerified: "2026-05-08" },
    },
  },
  bharatpe: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Glassdoor 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 36, equityMin: 2.5, equityMax: 6, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  "pine labs": {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox + IPO filing signal", lastVerified: "2026-05-07", notes: "Pine Labs IPO-filed; ESOP credibility lifted." },
      senior: { totalMin: 38, totalMax: 60, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  cashfree: {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 30, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox + Glassdoor 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  /* Insurance + NBFC. */
  acko: {
    "software-engineer": {
      entry: { totalMin: 9, totalMax: 25, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Research backlog 2026-05-08 (Acko SE Junior)", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed." },
      mid: { totalMin: 20, totalMax: 32, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr", joiningBonusOverride: [1, 4], source: "AmbitionBox + Glassdoor 2026 + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + ESOP." },
      senior: { totalMin: 34, totalMax: 55, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr", joiningBonusOverride: [2, 8], source: "Glassdoor + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Negotiation focus: fixed + level." },
    },
  
    "product-manager": {
      entry: { totalMin: 13, totalMax: 29, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x product-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 23, totalMax: 63, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x product-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 41, totalMax: 117, equityMin: 6, equityMax: 16, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x product-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 63, totalMax: 162, equityMin: 9, equityMax: 23, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x product-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 86, totalMax: 225, equityMin: 12, equityMax: 32, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x product-manager)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 25, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 45, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 68, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 90, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x data-analyst)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 16, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 29, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 50, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 29, totalMax: 77, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 41, totalMax: 108, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x business-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 16, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 36, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 72, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 41, totalMax: 126, equityMin: 2, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 63, totalMax: 198, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x sales)", lastVerified: "2026-05-08" },
    },
    "customer-success": {
      entry: { totalMin: 4, totalMax: 14, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x customer-success)", lastVerified: "2026-05-08" },
      mid: { totalMin: 11, totalMax: 29, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x customer-success)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 54, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x customer-success)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 81, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x customer-success)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 117, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (acko 0.9x customer-success)", lastVerified: "2026-05-08" },
    },
  },
  digit: {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 30, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr — listed", source: "AmbitionBox + Glassdoor 2026", lastVerified: "2026-05-07", notes: "Go Digit listed; equity tradable." },
      senior: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  "star health": {
    "software-engineer": {
      mid: { totalMin: 14, totalMax: 22, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 38, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  "icici lombard": {
    "software-engineer": {
      mid: { totalMin: 14, totalMax: 22, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 38, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  "bajaj finance": {
    "software-engineer": {
      mid: { totalMin: 16, totalMax: 26, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 28, totalMax: 45, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "finance": {
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 38, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* Quick commerce + logistics. */
  zepto: {
    "software-engineer": {
      entry: { totalMin: 22, totalMax: 32, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi + Glassdoor 2026 (post Series-G valuation)", lastVerified: "2026-05-07", notes: "Zepto pays unicorn-tier+; aggressive new-grad bands ₹26L+." },
      mid: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 80, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    /* Bug-report 13 (2026-05-14) — Zepto Operations Manager band.
     * Without this entry, an Operations Manager request fell through to
     * Zepto's tier-default (unicorn ⇒ software-engineer-ish curve),
     * which over-anchored a domain-pivoting candidate at ₹25L. Google
     * market data: avg ₹6.6L-₹12L; early-career ₹4L-₹8L; mid-senior
     * ₹8L-₹14L; Senior Ops Manager ₹17L-₹24L. Quick-commerce ops is
     * notably non-tech-comp so we use market floors directly. */
    "operations": {
      entry: { totalMin: 4, totalMax: 6, equityType: "none", source: "Google market data (Zepto Operations Manager 2026)", lastVerified: "2026-05-14", notes: "Zepto entry-level Operations Manager / Ops Executive (<=1yr)." },
      mid: { totalMin: 6, totalMax: 9, equityType: "none", source: "Google market data (Zepto Operations Manager 2026)", lastVerified: "2026-05-14", notes: "Zepto Operations Manager 2-4y." },
      senior: { totalMin: 10, totalMax: 16, equityType: "none", source: "Google market data (Zepto Operations Manager 2026)", lastVerified: "2026-05-14", notes: "Zepto Senior Operations Manager 5-8y; Mid-Senior band ₹8-₹14L plus Zepto unicorn premium." },
      lead: { totalMin: 17, totalMax: 24, equityType: "none", source: "Google market data (Zepto Senior Operations Manager 2026)", lastVerified: "2026-05-14", notes: "Zepto Lead / Senior Operations Manager 9+y." },
    },
  },
  blinkit: {
    "software-engineer": {
      mid: { totalMin: 28, totalMax: 45, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr — Zomato-listed", source: "Levels.fyi 2026", lastVerified: "2026-05-07", notes: "Blinkit (Zomato) RSU credibility solid post-Zomato IPO." },
      senior: { totalMin: 45, totalMax: 70, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  delhivery: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 0.5, equityMax: 2, equityType: "rsu", equityVesting: "4yr — listed", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 36, totalMax: 58, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  /* Travel / hospitality. */
  makemytrip: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr — Nasdaq-listed", source: "Levels.fyi 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 36, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 36, totalMax: 60, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  /* ixigo — listed (NSE: IXIGO) since 2024. Compensation runs leaner than
   * MMT/Yatra; CSV-derived band over-anchored Senior PD at ₹37–58L when
   * AmbitionBox + Levels.fyi 2026 show ₹26–40L (median ~₹27.7L). Override
   * with verified ranges so the recruiter doesn't open above public market. */
  ixigo: {
    "ux-designer": {
      entry: { totalMin: 6, totalMax: 11, equityMin: 0.3, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026 + Levels.fyi", lastVerified: "2026-05-09", notes: "ixigo Junior Product/UX Designer." },
      mid: { totalMin: 12, totalMax: 22, equityMin: 0.8, equityMax: 2.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-09", notes: "ixigo Mid Product Designer (Designer-2)." },
      senior: { totalMin: 26, totalMax: 40, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026 + Glassdoor (median ₹27.7L Gurugram)", lastVerified: "2026-05-09", notes: "ixigo Senior Product Designer / Senior UX. Top of band hit only for 7-9 YoE leads. Listed entity — ESOP liquidity better than pre-IPO peers." },
    },
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 0.5, equityMax: 1.5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-09" },
      mid: { totalMin: 14, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-09" },
      senior: { totalMin: 26, totalMax: 45, equityMin: 2.5, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-09", notes: "ixigo Senior SE / Tech Lead. Listed since 2024 — ESOP has real liquidity." },
    },
    "product-manager": {
      mid: { totalMin: 18, totalMax: 32, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-09" },
      senior: { totalMin: 32, totalMax: 55, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox 2026", lastVerified: "2026-05-09" },
    },
  },
  oyo: {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 30, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr — IPO pending", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "OYO ESOP credibility uncertain pre-IPO." },
      senior: { totalMin: 30, totalMax: 48, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  "apollo hospitals": {
    "doctor": {
      entry: { totalMin: 8, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "MBBS resident at Apollo. Senior consultant ₹50-80L." },
      mid: { totalMin: 18, totalMax: 32, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Specialist (MD/MS) at Apollo." },
      senior: { totalMin: 35, totalMax: 70, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Senior consultant. Top surgeons (cardiac/onco) cross ₹1Cr." },
    },
    "nursing": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 5, totalMax: 9, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 10, totalMax: 18, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  "fortis": {
    "doctor": {
      entry: { totalMin: 7, totalMax: 12, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 16, totalMax: 28, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 60, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "nursing": {
      entry: { totalMin: 3, totalMax: 5, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 5, totalMax: 9, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  "1mg": {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 30, equityMin: 1.5, equityMax: 4, equityType: "rsu", equityVesting: "4yr — Tata-acquired", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Tata 1mg; RSU in Tata listed entity." },
      senior: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  "dr lal pathlabs": {
    "software-engineer": {
      mid: { totalMin: 12, totalMax: 20, equityMin: 0.5, equityMax: 2, equityType: "rsu", equityVesting: "4yr — listed", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 35, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  metropolis: {
    "software-engineer": {
      mid: { totalMin: 10, totalMax: 18, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 30, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* GCC big-three. */
  vmware: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr — Broadcom-acquired", source: "Levels.fyi 2026", lastVerified: "2026-05-07", notes: "Post Broadcom acquisition; reduced hiring." },
      mid: { totalMin: 32, totalMax: 50, equityMin: 11, equityMax: 24, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 78, equityMin: 22, equityMax: 48, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  "wells fargo india": {
    "software-engineer": {
      entry: { totalMin: 16, totalMax: 26, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 28, totalMax: 45, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 45, totalMax: 70, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  /* AI/GenAI labs (top of market 2026). */
  "sarvam ai": {
    "ai-engineer": {
      mid: { totalMin: 50, totalMax: 80, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + recruiter signal", lastVerified: "2026-05-07", notes: "Sarvam AI pays AI-research-premium 1.5-2x SE. ₹50-80L mid; ₹100L+ senior." },
      senior: { totalMin: 90, totalMax: 150, equityMin: 22, equityMax: 50, equityType: "esop", equityVesting: "4yr", source: "Recruiter signal", lastVerified: "2026-05-07" },
    },
  },
  krutrim: {
    "ai-engineer": {
      mid: { totalMin: 45, totalMax: 75, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Recruiter signal + Ola Krutrim spinoff valuation", lastVerified: "2026-05-07" },
      senior: { totalMin: 85, totalMax: 140, equityMin: 22, equityMax: 50, equityType: "esop", equityVesting: "4yr", source: "Recruiter signal", lastVerified: "2026-05-07" },
    },
  },
  openai: {
    "ai-engineer": {
      mid: { totalMin: 100, totalMax: 200, equityMin: 30, equityMax: 80, equityType: "rsu", equityVesting: "PPU vesting / OpenAI-specific", source: "Levels.fyi + Twitter recruiter signal", lastVerified: "2026-05-07", notes: "OpenAI India hires extremely selectively; comp tracks SF bar." },
      senior: { totalMin: 200, totalMax: 350, equityMin: 80, equityMax: 200, equityType: "rsu", equityVesting: "PPU", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  anthropic: {
    "ai-engineer": {
      mid: { totalMin: 90, totalMax: 180, equityMin: 25, equityMax: 70, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi 2026", lastVerified: "2026-05-07", notes: "Anthropic India remote hires; SF-anchored bands." },
      senior: { totalMin: 180, totalMax: 320, equityMin: 70, equityMax: 180, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  /* Quant / HFT additions (Jane Street + DE Shaw already exist). */
  "tower research": {
    "data-scientist": {
      entry: { totalMin: 50, totalMax: 80, equityType: "none", source: "Levels.fyi 2026 + Glassdoor", lastVerified: "2026-05-07" },
      mid: { totalMin: 80, totalMax: 140, equityType: "none", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 140, totalMax: 240, equityType: "none", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  optiver: {
    "data-scientist": {
      entry: { totalMin: 55, totalMax: 90, equityType: "none", source: "Glassdoor + recruiter signal 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 90, totalMax: 150, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 150, totalMax: 260, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  millennium: {
    "data-scientist": {
      mid: { totalMin: 55, totalMax: 100, equityType: "none", source: "Glassdoor 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 100, totalMax: 180, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  /* Bulge bracket banks. */
  "morgan stanley": {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr", source: "Glassdoor + Levels.fyi 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 32, totalMax: 50, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 90, equityMin: 14, equityMax: 32, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
    "finance": {
      entry: { totalMin: 18, totalMax: 25, equityType: "none", source: "Glassdoor 2026", lastVerified: "2026-05-07", notes: "MS IB analyst — base ₹18-25L + 30-50% bonus." },
      mid: { totalMin: 35, totalMax: 60, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 75, totalMax: 130, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  
    "data-scientist": {
      entry: { totalMin: 11, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x data-scientist)", lastVerified: "2026-05-08" },
      mid: { totalMin: 22, totalMax: 66, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x data-scientist)", lastVerified: "2026-05-08" },
      senior: { totalMin: 39, totalMax: 121, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x data-scientist)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 176, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x data-scientist)", lastVerified: "2026-05-08" },
      executive: { totalMin: 88, totalMax: 231, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x data-scientist)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 20, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 35, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 61, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 35, totalMax: 94, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 50, totalMax: 132, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x business-analyst)", lastVerified: "2026-05-08" },
    },
    "program-manager": {
      entry: { totalMin: 11, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x program-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 20, totalMax: 55, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x program-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 39, totalMax: 105, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x program-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 61, totalMax: 154, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x program-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 83, totalMax: 198, equityType: "none", source: "Seed dataset 2026-05-08 (morgan stanley 1.1x program-manager)", lastVerified: "2026-05-08" },
    },
  },
  citi: {
    "software-engineer": {
      mid: { totalMin: 28, totalMax: 45, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 80, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  barclays: {
    "software-engineer": {
      mid: { totalMin: 28, totalMax: 45, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 48, totalMax: 75, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  "deutsche bank": {
    "software-engineer": {
      mid: { totalMin: 26, totalMax: 42, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 45, totalMax: 72, equityMin: 10, equityMax: 24, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  hsbc: {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* SaaS deeper. */
  "cure.fit": {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 30, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox + Glassdoor 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 52, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  /* D2C consumer brands. */
  mamaearth: {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr — Honasa listed", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Honasa Consumer (Mamaearth) listed; RSU credibility lifted." },
      senior: { totalMin: 30, totalMax: 50, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "marketing": {
      mid: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 42, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  boat: {
    "software-engineer": {
      mid: { totalMin: 14, totalMax: 24, equityMin: 0.5, equityMax: 2, equityType: "esop", equityVesting: "4yr — IPO pending", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 40, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  wakefit: {
    "software-engineer": {
      mid: { totalMin: 16, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 26, totalMax: 42, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* EV / mobility. */
  "ola electric": {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 36, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr — listed", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 36, totalMax: 58, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "hardware-engineer": {
      mid: { totalMin: 18, totalMax: 30, equityMin: 1.5, equityMax: 4, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 30, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  "ather energy": {
    "hardware-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr — IPO filing 2025", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 16, totalMax: 26, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 28, totalMax: 45, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* Stockbroker / wealth. */
  "angel one": {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 36, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr — listed", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  upstox: {
    "software-engineer": {
      mid: { totalMin: 24, totalMax: 38, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* Tata Group expansion. */
  "tata motors": {
    "software-engineer": {
      mid: { totalMin: 16, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr — Tata Sons", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 28, totalMax: 45, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "mechanical-engineer": {
      entry: { totalMin: 4.5, totalMax: 7.5, equityType: "none", source: "Glassdoor GET avg ₹5.5L; cluster ₹4.5-6L, premier-campus ₹7-8L", lastVerified: "2026-05-08", notes: "Tata Motors GET; passenger-vehicle / EV roles edge to ₹7-8L on premier campuses.", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      mid: { totalMin: 9, totalMax: 18, equityMin: 0.5, equityMax: 1.5, equityType: "rsu", equityVesting: "3yr", source: "6figr (Tata Motors avg ₹17L) + Glassdoor", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 22, totalMax: 40, equityMin: 1.5, equityMax: 4, equityType: "rsu", equityVesting: "3yr", source: "Glassdoor (Tata Motors Sr Manager / DGM)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      lead: { totalMin: 42, totalMax: 80, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "3yr", source: "Glassdoor (Tata Motors GM / VP)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  
    "marketing": {
      entry: { totalMin: 7, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x marketing)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 37, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x marketing)", lastVerified: "2026-05-08" },
      senior: { totalMin: 24, totalMax: 58, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x marketing)", lastVerified: "2026-05-08" },
      executive: { totalMin: 34, totalMax: 88, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x marketing)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 22, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 37, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 58, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 31, totalMax: 82, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x business-analyst)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 27, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 51, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 27, totalMax: 75, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 37, totalMax: 109, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x operations)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 27, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 54, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 31, totalMax: 95, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 48, totalMax: 150, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x sales)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 44, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 24, totalMax: 68, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 37, totalMax: 102, equityType: "none", source: "Seed dataset 2026-05-08 (tata motors 0.68x finance)", lastVerified: "2026-05-08" },
    },
  },
  "tata steel": {
    "mechanical-engineer": {
      entry: { totalMin: 7, totalMax: 11, equityType: "none", source: "Tata Steel AEP 2026 (₹30k/mo stipend → ₹7.4L Asst Mgr IL6 post-training)", lastVerified: "2026-05-08", notes: "Tata Steel Engineer Trainee; ₹30k/mo stipend during 1yr training, IL6 ₹7.4L on confirmation. MT-Tech (XLRI/IIM) higher.", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "Glassdoor MT (avg ₹6.6L, 25-75th ₹5-10.4L, p90 ₹17.5L) + post-confirm hike 7-10%", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      senior: { totalMin: 24, totalMax: 48, equityType: "none", source: "Glassdoor (Tata Steel Section / Sr Manager)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
      lead: { totalMin: 48, totalMax: 90, equityType: "none", source: "Glassdoor (Tata Steel Chief / GM)", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" } },
    },
  
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 18, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x software-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 33, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x software-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 62, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x software-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 36, totalMax: 91, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x software-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 46, totalMax: 117, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x software-engineer)", lastVerified: "2026-05-08" },
    },
    "marketing": {
      entry: { totalMin: 7, totalMax: 23, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x marketing)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 36, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x marketing)", lastVerified: "2026-05-08" },
      senior: { totalMin: 23, totalMax: 55, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x marketing)", lastVerified: "2026-05-08" },
      executive: { totalMin: 33, totalMax: 85, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x marketing)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 5, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 26, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 16, totalMax: 49, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 72, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 104, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x operations)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 21, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 13, totalMax: 36, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 21, totalMax: 55, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 29, totalMax: 78, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x business-analyst)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 23, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 42, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 23, totalMax: 65, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 98, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x finance)", lastVerified: "2026-05-08" },
    },
    "hr": {
      entry: { totalMin: 2, totalMax: 9, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x hr)", lastVerified: "2026-05-08" },
      mid: { totalMin: 7, totalMax: 18, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x hr)", lastVerified: "2026-05-08" },
      senior: { totalMin: 12, totalMax: 33, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x hr)", lastVerified: "2026-05-08" },
      lead: { totalMin: 18, totalMax: 52, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x hr)", lastVerified: "2026-05-08" },
      executive: { totalMin: 29, totalMax: 78, equityType: "none", source: "Seed dataset 2026-05-08 (tata steel 0.65x hr)", lastVerified: "2026-05-08" },
    },
  },
  "mahindra": {
    "software-engineer": {
      mid: { totalMin: 14, totalMax: 22, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 38, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "mechanical-engineer": {
      entry: { totalMin: 7, totalMax: 11, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 15, totalMax: 26, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 28, totalMax: 48, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  
    "marketing": {
      entry: { totalMin: 7, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x marketing)", lastVerified: "2026-05-08" },
      mid: { totalMin: 15, totalMax: 39, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x marketing)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x marketing)", lastVerified: "2026-05-08" },
      executive: { totalMin: 35, totalMax: 91, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x marketing)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 3, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 22, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 14, totalMax: 39, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 22, totalMax: 59, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 31, totalMax: 84, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x business-analyst)", lastVerified: "2026-05-08" },
    },
    "operations": {
      entry: { totalMin: 6, totalMax: 14, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x operations)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x operations)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 53, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x operations)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 77, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x operations)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 112, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x operations)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 3, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 28, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 56, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 31, totalMax: 98, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 49, totalMax: 154, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x sales)", lastVerified: "2026-05-08" },
    },
    "finance": {
      entry: { totalMin: 3, totalMax: 13, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x finance)", lastVerified: "2026-05-08" },
      mid: { totalMin: 8, totalMax: 25, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x finance)", lastVerified: "2026-05-08" },
      senior: { totalMin: 15, totalMax: 46, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x finance)", lastVerified: "2026-05-08" },
      lead: { totalMin: 25, totalMax: 70, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x finance)", lastVerified: "2026-05-08" },
      executive: { totalMin: 39, totalMax: 105, equityType: "none", source: "Seed dataset 2026-05-08 (mahindra 0.7x finance)", lastVerified: "2026-05-08" },
    },
  },
  /* Retail expansion. */
  dmart: {
    "operations": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "DMart store ops trainee." },
      mid: { totalMin: 10, totalMax: 16, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 35, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  bigbasket: {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 36, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr — Tata", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 36, totalMax: 58, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* Big Indian PSU banks. */
  sbi: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 12, equityType: "none", source: "SBI 2026 recruitment notification", lastVerified: "2026-05-07", notes: "SBI Specialist Officer (IT) — 7th CPC pay structure." },
      mid: { totalMin: 14, totalMax: 22, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
    "finance": {
      entry: { totalMin: 8, totalMax: 12, equityType: "none", source: "SBI PO 2026 notification", lastVerified: "2026-05-07", notes: "SBI PO trainee — Junior Management Grade Scale-I." },
      mid: { totalMin: 14, totalMax: 24, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 25, totalMax: 42, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* AI Big Tech missing. */
  perplexity: {
    "ai-engineer": {
      mid: { totalMin: 80, totalMax: 140, equityMin: 25, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi + recruiter signal 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 140, totalMax: 240, equityMin: 60, equityMax: 140, equityType: "rsu", equityVesting: "4yr", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  /* Indian IT majors gaps. */
  techmahindra: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "Tech Mahindra ELP / Digital Transformation trainee." },
      mid: { totalMin: 8, totalMax: 16, equityMin: 0.3, equityMax: 1, equityType: "rsu", equityVesting: "3yr — Mahindra Sons", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  
    "qa-engineer": {
      entry: { totalMin: 2, totalMax: 7, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 4, totalMax: 12, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 8, totalMax: 22, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 12, totalMax: 34, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x qa-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 17, totalMax: 46, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x qa-engineer)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 2, totalMax: 9, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 6, totalMax: 15, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 10, totalMax: 26, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 15, totalMax: 41, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 22, totalMax: 58, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x business-analyst)", lastVerified: "2026-05-08" },
    },
    "project-manager": {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x project-manager)", lastVerified: "2026-05-08" },
      mid: { totalMin: 9, totalMax: 24, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x project-manager)", lastVerified: "2026-05-08" },
      senior: { totalMin: 17, totalMax: 46, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x project-manager)", lastVerified: "2026-05-08" },
      lead: { totalMin: 26, totalMax: 67, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x project-manager)", lastVerified: "2026-05-08" },
      executive: { totalMin: 36, totalMax: 86, equityType: "none", source: "Seed dataset 2026-05-08 (techmahindra 0.48x project-manager)", lastVerified: "2026-05-08" },
    },
  },
  mphasis: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 32, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },
  /* Niche unicorn premium. */
  "rapido": {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 36, equityMin: 1.5, equityMax: 4, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 36, totalMax: 58, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
    },
  },

  /* Myntra — Flipkart group; ESOP buybacks ride the Flipkart cycle. */
  myntra: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 2], source: "Levels.fyi (₹1.83M-₹2.84M SDE-1 India) + Glassdoor (290 samples) + research backlog 2026-05-08", lastVerified: "2026-05-08", notes: "Myntra SDE-1 fresher; Flipkart group ESOP — liquidity tied to Flipkart buybacks. Negotiation focus: fixed + joining bonus.", sourceVerifiedAt: { levelsFyi: "2026-05-08", glassdoor: "2026-05-08" } },
      mid: { totalMin: 28, totalMax: 50, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 5], source: "Levels.fyi (median ₹3.65M India) + Glassdoor SDE-2 (avg ₹27L, p90 ₹49.6L) + research backlog 2026-05-08", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08", glassdoor: "2026-05-08" }, notes: "Negotiation focus: fixed + level." },
      senior: { totalMin: 50, totalMax: 80, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [3, 10], source: "Levels.fyi (₹2.12M-₹9.35M India range, Associate Architect top) + research backlog 2026-05-08", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" }, notes: "Negotiation focus: level calibration vs Flipkart group grid." },
    },
    "product-manager": {
      entry: { totalMin: 14, totalMax: 32, equityMin: 2, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 3], source: "Research backlog 2026-05-08 (Myntra APM/PM-1)", lastVerified: "2026-05-08", notes: "Negotiation focus: scope + fixed." },
      mid: { totalMin: 30, totalMax: 48, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 7], source: "Levels.fyi (PM India ₹4.35M-₹5.99M, median ₹5.39M) + research backlog 2026-05-08", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" }, notes: "Negotiation focus: product scope." },
      senior: { totalMin: 45, totalMax: 75, equityMin: 10, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 14], source: "Glassdoor Sr PM (avg ₹44.5L, range ₹26-58L; total comp avg ₹53L) + research backlog 2026-05-08", lastVerified: "2026-05-08", sourceVerifiedAt: { glassdoor: "2026-05-08" }, notes: "Negotiation focus: ownership + org impact." },
    },
  
    "ux-designer": {
      entry: { totalMin: 4, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 16, totalMax: 45, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ux-designer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 28, totalMax: 80, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ux-designer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 120, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ux-designer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 60, totalMax: 150, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ux-designer)", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 14, totalMax: 35, equityMin: 3, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 28, totalMax: 80, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ml-engineer)", lastVerified: "2026-05-08" },
      senior: { totalMin: 50, totalMax: 150, equityMin: 9, equityMax: 27, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ml-engineer)", lastVerified: "2026-05-08" },
      lead: { totalMin: 80, totalMax: 220, equityMin: 14, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ml-engineer)", lastVerified: "2026-05-08" },
      executive: { totalMin: 100, totalMax: 280, equityMin: 18, equityMax: 50, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x ml-engineer)", lastVerified: "2026-05-08" },
    },
    "data-analyst": {
      entry: { totalMin: 4, totalMax: 16, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x data-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 10, totalMax: 28, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x data-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 18, totalMax: 50, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x data-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 28, totalMax: 75, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x data-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 40, totalMax: 100, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x data-analyst)", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 4, totalMax: 18, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 12, totalMax: 32, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x business-analyst)", lastVerified: "2026-05-08" },
      senior: { totalMin: 20, totalMax: 55, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x business-analyst)", lastVerified: "2026-05-08" },
      lead: { totalMin: 32, totalMax: 85, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x business-analyst)", lastVerified: "2026-05-08" },
      executive: { totalMin: 45, totalMax: 120, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x business-analyst)", lastVerified: "2026-05-08" },
    },
    "sales": {
      entry: { totalMin: 4, totalMax: 18, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x sales)", lastVerified: "2026-05-08" },
      mid: { totalMin: 14, totalMax: 40, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x sales)", lastVerified: "2026-05-08" },
      senior: { totalMin: 25, totalMax: 80, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x sales)", lastVerified: "2026-05-08" },
      lead: { totalMin: 45, totalMax: 140, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x sales)", lastVerified: "2026-05-08" },
      executive: { totalMin: 70, totalMax: 220, equityMin: 4, equityMax: 13, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (myntra 1x sales)", lastVerified: "2026-05-08" },
    },
  },

  /* Dream11 — high-margin sports gaming; pays a premium over peer Indian
     unicorns at SDE-2/3 (Levels.fyi median ₹53L for SDE-2 vs ~₹35L peer). */
  dream11: {
    "software-engineer": {
      entry: { totalMin: 20, totalMax: 32, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 3], source: "Levels.fyi SDE-1 India ₹2.01M-₹3.13M (median ₹25.4L)", lastVerified: "2026-05-08", notes: "Dream11 SDE-1 campus / 0-2 yr; Dream Sports privately held — ESOP liquidity via periodic buybacks. Negotiation focus: Fixed + joining bonus.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      mid: { totalMin: 42, totalMax: 65, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Levels.fyi SDE-2 India ₹4.27M-₹6.52M (median ₹53.4L)", lastVerified: "2026-05-08", notes: "Premium over peer unicorns at SDE-2 — Dream11 SDE-2 median (₹53L) ~30% above Razorpay/Swiggy. Negotiation focus: Fixed + ESOP clarity (buyback cadence).", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 65, totalMax: 95, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 10], source: "Levels.fyi SDE-3 India (top ₹7.53M) + Glassdoor (618 samples)", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + level + ESOP. Senior-level liquidity history is the load-bearing question.", sourceVerifiedAt: { levelsFyi: "2026-05-08", glassdoor: "2026-05-08" } },
      lead: { totalMin: 70, totalMax: 110, equityMin: 18, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi Engineering Manager India ₹5.45M-₹7.48M", lastVerified: "2026-05-08", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "product-manager": {
      mid: { totalMin: 35, totalMax: 55, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Levels.fyi PM India (PM2 ₹62.7L top, median ₹46.5L)", lastVerified: "2026-05-08", notes: "Negotiation focus: Fixed + product scope (specific game/feature owned).", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 55, totalMax: 85, equityMin: 12, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 10], source: "Levels.fyi PM3 India (₹53.7L+)", lastVerified: "2026-05-08", notes: "Negotiation focus: Product ownership + ESOP grant size.", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "data-scientist": {
      mid: { totalMin: 30, totalMax: 55, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Levels.fyi DS India ₹2.91M-₹16.5M (median ₹69.2L blended)", lastVerified: "2026-05-08", notes: "Dream11 ML/DS bar high — fantasy-sports modelling is core IP. Negotiation focus: ML/business impact (modelling team scope).", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
      senior: { totalMin: 55, totalMax: 95, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [4, 12], source: "Levels.fyi DS top + Data Science Manager ₹5.12M-₹7.27M", lastVerified: "2026-05-08", notes: "Negotiation focus: Ownership + scope (own a vertical / line of models).", sourceVerifiedAt: { levelsFyi: "2026-05-08" } },
    },
    "ux-designer": {
      entry: { totalMin: 9, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (dream11 1.1x ux-designer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 18, totalMax: 50, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 31, totalMax: 80, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "ml-engineer": {
      entry: { totalMin: 15, totalMax: 39, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (dream11 1.1x ml-engineer)", lastVerified: "2026-05-08" },
      mid: { totalMin: 31, totalMax: 80, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 55, totalMax: 130, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "devops-sre": {
      entry: { totalMin: 11, totalMax: 31, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (dream11 1.1x devops-sre)", lastVerified: "2026-05-08" },
      mid: { totalMin: 24, totalMax: 65, equityMin: 4, equityMax: 11, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 44, totalMax: 110, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    "business-analyst": {
      entry: { totalMin: 5, totalMax: 18, equityMin: 1, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08 (dream11 1.1x business-analyst)", lastVerified: "2026-05-08" },
      mid: { totalMin: 13, totalMax: 35, equityMin: 1, equityMax: 2, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
      senior: { totalMin: 22, totalMax: 60, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Seed dataset 2026-05-08", lastVerified: "2026-05-08" },
    },
    /* Risk/Compliance — fantasy-sports legality + payments fraud team. Mapped
       under data-analyst taxonomy (no first-class "risk-analyst" role key). */
    "data-analyst": {
      entry: { totalMin: 6, totalMax: 16, equityMin: 0, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 1], source: "Web research 2026-05-08 (Dream11 Risk/Compliance Junior)", lastVerified: "2026-05-08", notes: "Risk/Compliance Junior at Dream11 — fixed + comp-knowledge bonus. Negotiation focus: Fixed + bonus." },
      mid: { totalMin: 16, totalMax: 38, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 3], source: "Web research 2026-05-08 (Dream11 Risk/Compliance Mid)", lastVerified: "2026-05-08", notes: "Risk/Compliance Mid — own a fraud surface or compliance lane. Negotiation focus: Risk scope + criticality." },
      senior: { totalMin: 30, totalMax: 65, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [2, 6], source: "Web research 2026-05-08 (Dream11 Risk/Compliance Senior)", lastVerified: "2026-05-08", notes: "Risk/Compliance Senior — regulator-facing criticality drives premium. Negotiation focus: Criticality + ownership." },
    },
    /* Brand / Growth Marketing — IPL/cricket-window media buying + brand. */
    "marketing": {
      entry: { totalMin: 6, totalMax: 16, equityMin: 0, equityMax: 1, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [0, 1], source: "Web research 2026-05-08 (Dream11 Brand/Growth Marketing Junior)", lastVerified: "2026-05-08", notes: "Junior brand/growth — campaign ownership during IPL window. Negotiation focus: Campaign impact + bonus." },
      mid: { totalMin: 18, totalMax: 42, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [1, 4], source: "Web research 2026-05-08 (Dream11 Brand/Growth Marketing Mid)", lastVerified: "2026-05-08", notes: "Mid brand/growth — CAC/ROI ownership on paid + influencer mix. Negotiation focus: CAC/ROI impact." },
      senior: { totalMin: 35, totalMax: 75, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", joiningBonusOverride: [3, 8], source: "Web research 2026-05-08 (Dream11 Brand/Growth Marketing Senior)", lastVerified: "2026-05-08", notes: "Senior brand/growth — own the IPL P&L. Negotiation focus: Brand/growth ownership + ESOP." },
    },
  },
};

/**
 * Look up a verified company-specific band override.
 * Returns null when no override exists; caller falls back to tier band.
 */
/* Within-override experience-level fallback. When the requested exp
   doesn't have a band in this company/sector entry, walk these
   alternatives in order (clamping toward the closest covered level)
   so we don't fall through to a generic tier band that's lower.
   E.g. Razorpay has lead but no executive → executive request
   returns the lead band, not a tier fallback. */
const EXP_FALLBACK_WITHIN_OVERRIDE: Record<ExperienceLevel, ExperienceLevel[]> = {
  entry: ["entry", "mid"],
  mid: ["mid", "senior", "entry"],
  senior: ["senior", "lead", "mid", "executive"],
  /* Lead/executive: if neither defined, walk DOWN to senior, then
     mid. Better to plateau at the highest-defined band than fall
     through to a lower tier-band. The trade-off: a 15-yr candidate
     at a company with only entry/mid bands (e.g. early Jane Street
     override) plateaus at mid until a senior band is added. The
     alternative — falling through to tier — silently downgrades. */
  lead: ["lead", "executive", "senior", "mid"],
  executive: ["executive", "lead", "senior", "mid"],
};

function pickLevelInRoleMap(
  roleEntry: Partial<Record<ExperienceLevel, CompanyBandOverride>> | undefined,
  experienceLevel: ExperienceLevel,
): CompanyBandOverride | null {
  if (!roleEntry) return null;
  for (const candidate of EXP_FALLBACK_WITHIN_OVERRIDE[experienceLevel] ?? [experienceLevel]) {
    const hit = roleEntry[candidate];
    if (hit) return hit;
  }
  return null;
}

/** CSV dataset is dated 2026-05-09. Curator entries verified within 90
 *  days of that date (i.e. on/after 2026-02-09) are considered "fresh"
 *  and ALWAYS win — they likely reflect offer-letter intel CSV doesn't
 *  see. Older or undated entries get reconciled against CSV: if CSV
 *  drift > 25%, the CSV numbers replace the curator numbers (curator
 *  source/notes/equity-type are preserved — only totalMin/Max/baseMin/
 *  Max change). This is the "wrong-info correction" pass. */
const CSV_DATASET_DATE_MS = Date.parse("2026-05-09");
const CURATOR_FRESHNESS_DAYS = 90;
const CSV_DRIFT_TRIGGER = 0.25;

function reconcileWithCsv(
  curator: CompanyBandOverride,
  rawCompany: string,
  roleKey: string,
  experienceLevel: ExperienceLevel,
): CompanyBandOverride {
  // Fresh curator entry → keep as-is (but tag synthetic seed cells as low-conf).
  if (curator.lastVerified) {
    const ageMs = CSV_DATASET_DATE_MS - Date.parse(curator.lastVerified);
    if (Number.isFinite(ageMs) && ageMs < CURATOR_FRESHNESS_DAYS * 86400_000) {
      return tagSeedSynthetic(curator);
    }
  }
  const csv = getCsvBandOnly(rawCompany, roleKey, experienceLevel);
  if (!csv) return tagSeedSynthetic(curator);
  const curatorMid = (curator.totalMin + curator.totalMax) / 2;
  if (curatorMid <= 0) return tagSeedSynthetic(curator);
  const drift = Math.abs(csv.totalMedian - curatorMid) / curatorMid;
  if (drift <= CSV_DRIFT_TRIGGER) return tagSeedSynthetic(curator);
  // Drift exceeds threshold AND curator is stale → swap numbers.
  // Preserve curator's equity-type / vesting / notes / overrides; only
  // numeric bands change. Stamp the source so downstream knows.
  return {
    ...curator,
    totalMin: csv.totalMin,
    totalMax: csv.totalMax,
    // Derive base = 75% of total when curator hasn't pinned baseMin/baseMax.
    baseMin: curator.baseMin !== undefined ? curator.baseMin : Math.round(csv.totalMin * 0.75 * 10) / 10,
    baseMax: curator.baseMax !== undefined ? curator.baseMax : Math.round(csv.totalMax * 0.75 * 10) / 10,
    source: `${curator.source} → corrected via CSV research 2026-05 (${(drift * 100).toFixed(0)}% drift)`,
    lastVerified: "2026-05-09",
    notes: curator.notes
      ? `${curator.notes} [Numbers refreshed from 2026-05 CSV; curator notes retained.]`
      : `Numbers refreshed from 2026-05 CSV research dataset.`,
    // Stale curator + CSV swap → numbers are now CSV-aggregated, downgrade
    // confidence so the LLM/UI hedges accordingly.
    dataConfidence: "research-aggregated",
  };
}

export function getCompanyBandOverride(
  rawCompany: string | undefined,
  roleKey: string | undefined,
  experienceLevel: ExperienceLevel,
): CompanyBandOverride | null {
  if (!rawCompany || !roleKey) return null;
  const cleaned = rawCompany
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/[\s-]+/g, " ")
    .trim();
  if (!cleaned) return null;

  // Direct match first (most specific).
  const directEntry = COMPANY_SALARY_OVERRIDES[cleaned]?.[roleKey];
  const directHit = pickLevelInRoleMap(directEntry, experienceLevel);
  if (directHit) {
    const flipped = maybePreferImportedOverSeed(directHit, cleaned, roleKey, experienceLevel);
    if (flipped) return flipped;
    return reconcileWithCsv(directHit, rawCompany, roleKey, experienceLevel);
  }

  // Loose containment fallback (e.g. "Razorpay Internet Pvt Ltd" → razorpay).
  for (const [companyKey, roleMap] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
    if (companyKey.startsWith("__sector_")) continue; // Sector entries handled below
    if (companyKey.length < 4) continue;
    if (cleaned.includes(companyKey) || companyKey.includes(cleaned)) {
      const hit = pickLevelInRoleMap(roleMap[roleKey], experienceLevel);
      if (hit) {
        const flipped = maybePreferImportedOverSeed(hit, companyKey, roleKey, experienceLevel);
        if (flipped) return flipped;
        return reconcileWithCsv(hit, rawCompany, roleKey, experienceLevel);
      }
    }
  }
  /* AmbitionBox-scraped fallback (data/_imported-salary-overrides.generated.ts).
     Auto-generated from data/salary-data-input.csv via scripts/import-salary-csv.mts.
     Runs AFTER curator hits (so editorial wins) but BEFORE the older
     CSV-derived 100-company aggregated layer (which we'll deprecate as
     the AmbitionBox scrape grows). All scraped cells are stamped
     dataConfidence: "research-aggregated" so the LLM/UI hedges. */
  const importedDirect = pickLevelInRoleMap(IMPORTED_SALARY_OVERRIDES[cleaned]?.[roleKey], experienceLevel);
  if (importedDirect) return tagImported(importedDirect);
  for (const [companyKey, roleMap] of Object.entries(IMPORTED_SALARY_OVERRIDES)) {
    if (companyKey.length < 4) continue;
    if (cleaned.includes(companyKey) || companyKey.includes(cleaned)) {
      const hit = pickLevelInRoleMap(roleMap[roleKey], experienceLevel);
      if (hit) return tagImported(hit);
    }
  }

  /* CSV-derived research fallback (100-company aggregated dataset).
     Runs BEFORE the sector default so the candidate gets the
     research-verified band whenever the company is in the CSV but
     no curator-authored entry exists yet. */
  const csvDerived = getCsvDerivedBandOverride(rawCompany, roleKey, experienceLevel);
  if (csvDerived) return csvDerived;

  /* Sector-level fallback (covers the long tail of ~800 companies in
     the autocomplete that don't have bespoke entries). classifyCompanyType
     maps the company name to one of ~25 sector buckets.
     EXCEPT: when classification is the catch-all "indian_market_generic"
     (₹20-40 senior band) BUT the company is explicitly mapped to a
     high-tier in COMPANY_TIER_MAP (faang / big-tech / saas-product),
     skip the generic sector and let the tier-default path resolve.
     This was the DocuSign-quoted-as-₹27 bug class (Bugs (4).pdf):
     DocuSign mapped to big-tech but the generic sector silently won
     because classifyCompanyType lacks a US-SaaS pattern. */
  const classification = classifyCompanyType(rawCompany);
  if (classification) {
    const isGeneric = classification.key === "indian_market_generic";
    const tier = isGeneric ? getCompanyTier(rawCompany) : null;
    const tierIsHigh = tier === "faang" || tier === "big-tech" || tier === "saas-product";
    if (!(isGeneric && tierIsHigh)) {
      const sectorKey = `__sector_${classification.key}`;
      const sectorHit = pickLevelInRoleMap(
        COMPANY_SALARY_OVERRIDES[sectorKey]?.[roleKey],
        experienceLevel,
      );
      if (sectorHit) return sectorHit;
    }
  }
  return null;
}
