/**
 * Company-specific equity vesting schedule overlay.
 *
 * BACKGROUND (audit 2026-05-21): the 1,776 `equityVesting` strings in
 * `company-salary-overrides.ts` are uniformly hard-coded as
 * `"4yr / 1yr cliff"`. That's the US Silicon-Valley standard projected
 * onto every Indian company — factually wrong for at least these classes:
 *
 *  - Flipkart (post Walmart 2018): Walmart RSUs on a 4-year ANNUAL
 *    schedule (25/25/25/25), no 1-year cliff for senior hires.
 *  - Razorpay / Zerodha / CRED: ESOP with 4yr / 1yr cliff BUT
 *    buyback-dependent liquidity (vesting != liquidity).
 *  - PhonePe (post India-flip 2022): 4-year ESOP with recurring buyback
 *    program (₹1,150 Cr in 2022, another in 2024).
 *  - Swiggy / Zomato / Paytm (listed): RSU-equivalent / direct shares,
 *    shorter cliff and quarterly post-cliff vest.
 *  - IT-services (TCS, Infosys, Wipro, HCL, LTIMindtree, ...): no equity
 *    for non-leadership; "performance bonus" or one-time joining award.
 *  - Indian arms of MNCs: home-country schedule — Amazon 5/15/40/40
 *    back-loaded, Google monthly post 1-year cliff.
 *
 * Rather than hand-edit 1,776 rows we do a RESOLVER-LAYER OVERLAY: a
 * small per-company table maps companies to a canonical schedule id;
 * the resolver (`salary-lookup.ts`) calls `resolveVestingSchedule()` to
 * get the schedule + description string; legacy `override.equityVesting`
 * is consulted only as a last-resort fallback for companies neither
 * overridden nor classified by tier.
 *
 * All numbers are ROUGH INDUSTRY APPROXIMATIONS sourced from public
 * Glassdoor / AmbitionBox / Levels.fyi posts + DRHP filings (Razorpay
 * Apr-2026, Swiggy Nov-2024). NOT legally verified — candidates must
 * confirm with their recruiter on the actual offer letter.
 */

import { getCompanyTier } from "./company-tiers";

/** Canonical schedule identifiers. Keep ~8 — every entry must map to a
 *  schedule that materially differs from the others in how the recruiter
 *  describes vesting OR how liquidity works. */
export type VestingScheduleId =
  | "us-standard-4yr-cliff"     // 4-year vest, 1-year cliff (25%), monthly thereafter (US SV norm; default for product-india startups without a more specific entry)
  | "walmart-rsu-annual"         // 4-year ANNUAL vest (25/25/25/25), no 1-year cliff for senior hires
  | "esop-buyback-dependent"     // 4yr / 1yr cliff — but liquidity gated on board-discretion buybacks
  | "phonepe-flip-buyback"       // 4yr / 1yr cliff with recurring buyback program (₹1,150 Cr 2022 + 2024 round)
  | "listed-rsu-quarterly"       // 1-year cliff, then quarterly vest over 3 more years (listed Indian product cos)
  | "it-services-none"           // No equity for non-leadership ICs; performance bonus only
  | "mnc-amazon-back-loaded"     // 4-year back-loaded: 5/15/40/40 with 1-year cliff
  | "mnc-google-monthly";        // 1-year cliff (25%), monthly vest thereafter over 3 more years

export interface VestingSchedule {
  scheduleId: VestingScheduleId;
  /** Human-readable description for prompt context / UI. Approximate;
   *  candidates must confirm on the actual offer letter. */
  description: string;
  /** Whether liquidity is decoupled from vesting (ESOP buyback dependence). */
  liquidityNote?: string;
}

/** Canonical schedule definitions. Source: industry approximations from
 *  Glassdoor / AmbitionBox / company DRHP filings. NOT legally verified. */
export const VESTING_SCHEDULES: Record<VestingScheduleId, VestingSchedule> = {
  "us-standard-4yr-cliff": {
    scheduleId: "us-standard-4yr-cliff",
    description: "4-year vest, 1-year cliff (25%), monthly thereafter",
  },
  "walmart-rsu-annual": {
    scheduleId: "walmart-rsu-annual",
    description: "Walmart RSUs, 4-year annual vest (25/25/25/25), no 1-year cliff for senior hires",
  },
  "esop-buyback-dependent": {
    scheduleId: "esop-buyback-dependent",
    description: "ESOP, 4-year vest with 1-year cliff (25%), monthly thereafter — liquidity is buyback-dependent (board discretion)",
    liquidityNote: "Vesting and liquidity are decoupled: shares vest on schedule but cash-out requires a buyback / secondary window the company is not obligated to run.",
  },
  "phonepe-flip-buyback": {
    scheduleId: "phonepe-flip-buyback",
    description: "ESOP, 4-year vest with 1-year cliff (25%), recurring buyback program (₹1,150 Cr 2022, additional round 2024)",
    liquidityNote: "Historical buyback cadence is strong but each round is board-approved; verify next planned window with HR.",
  },
  "listed-rsu-quarterly": {
    scheduleId: "listed-rsu-quarterly",
    description: "RSU-equivalent / direct shares, 1-year cliff (25%) then quarterly vest over 3 more years",
  },
  "it-services-none": {
    scheduleId: "it-services-none",
    description: "No equity at this level — IT services compensate via performance bonus / one-time joining award, not stock",
  },
  "mnc-amazon-back-loaded": {
    scheduleId: "mnc-amazon-back-loaded",
    description: "RSU, 4-year back-loaded vest: 5% / 15% / 40% / 40% with 1-year cliff",
  },
  "mnc-google-monthly": {
    scheduleId: "mnc-google-monthly",
    description: "RSU, 1-year cliff (25%) then monthly vest over 3 more years",
  },
};

/** Per-company override mapping. Keys are lowercase company names. Add
 *  here ONLY when the company materially deviates from its tier default —
 *  the resolver falls through to the tier classifier (see
 *  `tierDefaultSchedule`) for unlisted companies.
 *
 *  Curator note: keep this list small (~30 entries). The long tail of
 *  product-india unicorns lands on the tier default ("us-standard-4yr-
 *  cliff" or "esop-buyback-dependent") which is good enough; over-listing
 *  invites stale data. */
const COMPANY_VESTING_OVERRIDES: Record<string, VestingScheduleId> = {
  // Walmart-acquired
  flipkart: "walmart-rsu-annual",
  myntra: "walmart-rsu-annual", // Flipkart group, same RSU plan
  // ESOP buyback-dependent unicorns
  razorpay: "esop-buyback-dependent",
  zerodha: "esop-buyback-dependent",
  cred: "esop-buyback-dependent",
  meesho: "esop-buyback-dependent",
  dream11: "esop-buyback-dependent",
  groww: "esop-buyback-dependent",
  // PhonePe — distinct buyback cadence
  phonepe: "phonepe-flip-buyback",
  // Listed Indian product cos
  swiggy: "listed-rsu-quarterly",
  zomato: "listed-rsu-quarterly",
  paytm: "listed-rsu-quarterly",
  nykaa: "listed-rsu-quarterly",
  // MNC India arms — home-country schedule
  amazon: "mnc-amazon-back-loaded",
  google: "mnc-google-monthly",
  microsoft: "mnc-google-monthly", // close-enough: 1yr cliff + monthly thereafter
  meta: "mnc-google-monthly",
  apple: "mnc-google-monthly",
  netflix: "mnc-google-monthly",
  adobe: "mnc-google-monthly",
  salesforce: "mnc-google-monthly",
  uber: "mnc-google-monthly",
  // IT services — no equity at IC level
  tcs: "it-services-none",
  infosys: "it-services-none",
  wipro: "it-services-none",
  hcl: "it-services-none",
  "tech mahindra": "it-services-none",
  cognizant: "it-services-none",
  capgemini: "it-services-none",
  accenture: "it-services-none",
  ltimindtree: "it-services-none",
  mphasis: "it-services-none",
  persistent: "it-services-none",
  hexaware: "it-services-none",
  coforge: "it-services-none",
  ibm: "it-services-none",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Map a CompanyTier (from `company-tiers.ts`) onto a default schedule.
 *  Used when there is no explicit override for the company. */
function tierDefaultSchedule(company: string | null | undefined): VestingScheduleId {
  const tier = getCompanyTier(company);
  switch (tier) {
    case "it-services":
    case "consulting-big4":
    case "government-psu":
    case "bfsi-domestic":
    case "fmcg-mnc":
      // No equity for ICs at these tiers; performance bonus dominates.
      return "it-services-none";
    case "faang":
    case "big-tech":
      // Generic Big-Tech / FAANG India default leans Google-shape
      // (1yr cliff + monthly). Companies whose home-country plan
      // deviates (Amazon = back-loaded) are pinned in
      // COMPANY_VESTING_OVERRIDES above.
      return "mnc-google-monthly";
    case "indian-unicorn":
    case "saas-product":
    case "startup-growth":
    case "edtech":
      // Default unicorn / growth-stage Indian product ESOP is
      // buyback-dependent — factual default for any private company
      // not yet listed.
      return "esop-buyback-dependent";
    case "startup-early":
      // Pre-buyback startups: liquidity even more uncertain than
      // unicorn ESOPs; same shape, same buyback-dependent caveat.
      return "esop-buyback-dependent";
    case "gcc":
    case "bfsi-global":
    case "consulting-mbb":
      // GCC and global BFSI India arms typically hand out parent-co
      // RSUs on a Google-style schedule.
      return "mnc-google-monthly";
    default:
      return "us-standard-4yr-cliff";
  }
}

/** Resolve the vesting schedule for a company.
 *
 *  Precedence:
 *    1. Direct override in COMPANY_VESTING_OVERRIDES (word-boundary match).
 *    2. Tier classifier default (`tierDefaultSchedule`).
 *    3. US 4yr / 1yr cliff (safe fallback).
 *
 *  The legacy per-row `equityVesting` string in CompanyBandOverride is
 *  IGNORED by this resolver — the overlay supersedes it. The resolver in
 *  `salary-lookup.ts` is the only legitimate consumer; do not bypass it.
 *
 *  Pure. */
export function resolveVestingSchedule(company: string | null | undefined): VestingSchedule {
  if (company) {
    const n = normalize(company);
    if (n) {
      // Direct key match (most efficient).
      const direct = COMPANY_VESTING_OVERRIDES[n];
      if (direct) return VESTING_SCHEDULES[direct];
      // Word-boundary substring match for multi-word company names
      // ("Tata Consultancy Services" → "tcs" not matched, but the
      // classifier in `company-tiers.ts` handles aliases).
      for (const key of Object.keys(COMPANY_VESTING_OVERRIDES)) {
        if (` ${n} `.includes(` ${key} `)) {
          return VESTING_SCHEDULES[COMPANY_VESTING_OVERRIDES[key]];
        }
      }
    }
  }
  return VESTING_SCHEDULES[tierDefaultSchedule(company)];
}

/** Test-only helper: the set of canonical schedule ids, in declaration
 *  order. Kept exported for tests that want to iterate the union. */
export const VESTING_SCHEDULE_IDS: readonly VestingScheduleId[] = [
  "us-standard-4yr-cliff",
  "walmart-rsu-annual",
  "esop-buyback-dependent",
  "phonepe-flip-buyback",
  "listed-rsu-quarterly",
  "it-services-none",
  "mnc-amazon-back-loaded",
  "mnc-google-monthly",
] as const;
