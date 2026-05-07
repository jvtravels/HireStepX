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
}

/** company key → role key → exp level → override band. Company key is
 *  the lowercased canonical name (e.g. "razorpay", "bombay design centre"). */
export const COMPANY_SALARY_OVERRIDES: Record<
  string,
  Partial<Record<string, Partial<Record<ExperienceLevel, CompanyBandOverride>>>>
> = {
  /* ─── Indian Unicorns — Fintech ─────────────────────────────── */
  razorpay: {
    "software-engineer": {
      entry: { totalMin: 16, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (2,271 salaries, Apr 2026) + AmbitionBox", lastVerified: "2026-05-07", notes: "Razorpay SE-1 / SE-2 typical opening; offers above ₹26L for top talent." },
      mid: { totalMin: 26, totalMax: 42, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 42, totalMax: 65, equityMin: 6, equityMax: 15, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + DRHP signal", lastVerified: "2026-05-07", notes: "Senior Engineer at Razorpay; ESOP credibility lifted post Apr-2026 DRHP filing." },
      lead: { totalMin: 60, totalMax: 95, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 28, totalMax: 45, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 45, totalMax: 75, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "ml-engineer": {
      mid: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + GenAI premium 1.3-1.6x", lastVerified: "2026-05-07" },
      senior: { totalMin: 55, totalMax: 90, equityMin: 10, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  phonepe: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 26, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Glassdoor", lastVerified: "2026-05-07" },
      mid: { totalMin: 28, totalMax: 45, equityMin: 4, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07", notes: "PhonePe SE-2 / SE-3; reverse-flipped to India 2022, DRHP filed via SEBI confidential route." },
      senior: { totalMin: 45, totalMax: 70, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 30, totalMax: 48, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 48, totalMax: 80, equityMin: 10, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  flipkart: {
    "software-engineer": {
      entry: { totalMin: 22, totalMax: 28, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Weekday + Glassdoor (₹25.95L avg fresher)", lastVerified: "2026-05-07", notes: "Flipkart SDE-1 fresher avg ₹25.95L; backend ₹25.92, frontend ₹26.1, fullstack ₹26.15." },
      mid: { totalMin: 32, totalMax: 50, equityMin: 4, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 80, equityMin: 8, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 32, totalMax: 50, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 85, equityMin: 12, equityMax: 25, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  swiggy: {
    "software-engineer": {
      mid: { totalMin: 25, totalMax: 42, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07", notes: "Listed on NSE/BSE 2024 — ESOP liquidity is real now." },
      senior: { totalMin: 42, totalMax: 70, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 30, totalMax: 48, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 48, totalMax: 75, equityMin: 10, equityMax: 22, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  zomato: {
    "software-engineer": {
      mid: { totalMin: 24, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Levels.fyi (Eternal/Zomato listed)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  cred: {
    "software-engineer": {
      mid: { totalMin: 30, totalMax: 50, equityMin: 5, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Glassdoor", lastVerified: "2026-05-07", notes: "CRED engineering bar high; mid-bar but design bar stricter." },
      senior: { totalMin: 50, totalMax: 80, equityMin: 12, equityMax: 28, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "ux-designer": {
      mid: { totalMin: 32, totalMax: 55, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + Levels.fyi", lastVerified: "2026-05-07", notes: "CRED design bar exceptionally high — premium over peer unicorns." },
      senior: { totalMin: 55, totalMax: 90, equityMin: 14, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  zerodha: {
    "software-engineer": {
      mid: { totalMin: 28, totalMax: 45, equityType: "none", source: "Glassdoor + Zerodha public bonus disclosures", lastVerified: "2026-05-07", notes: "Bootstrapped; no ESOP. Profitable — annual bonus 100% of base in good years." },
      senior: { totalMin: 45, totalMax: 75, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  meesho: {
    "software-engineer": {
      mid: { totalMin: 26, totalMax: 42, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox (Meesho listed Dec 2025)", lastVerified: "2026-05-07", notes: "Listed Dec 2025 — ESOPs converted to RSUs." },
      senior: { totalMin: 42, totalMax: 68, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 28, totalMax: 45, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  /* ─── FAANG India ─────────────────────────────────────────────── */
  google: {
    "software-engineer": {
      mid: { totalMin: 50, totalMax: 80, equityMin: 18, equityMax: 35, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Google India SWE)", lastVerified: "2026-05-07", notes: "Google L4 India median ₹62L total comp; high performers cross ₹78L." },
      senior: { totalMin: 80, totalMax: 130, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (L5)", lastVerified: "2026-05-07" },
      lead: { totalMin: 120, totalMax: 200, equityMin: 50, equityMax: 110, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (L6+)", lastVerified: "2026-05-07" },
    },
    "ux-designer": {
      mid: { totalMin: 41, totalMax: 75, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Google India UX)", lastVerified: "2026-05-07" },
      senior: { totalMin: 70, totalMax: 101, equityMin: 25, equityMax: 50, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (L5 Designer)", lastVerified: "2026-05-07" },
    },
  },

  microsoft: {
    "software-engineer": {
      mid: { totalMin: 45, totalMax: 75, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "5yr (20-20-20-20-20)", source: "Levels.fyi (Microsoft India SDE)", lastVerified: "2026-05-07" },
      senior: { totalMin: 75, totalMax: 120, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "5yr / staggered", source: "Levels.fyi (L62-L63)", lastVerified: "2026-05-07" },
    },
    "ux-designer": {
      mid: { totalMin: 35, totalMax: 70, equityMin: 10, equityMax: 25, equityType: "rsu", equityVesting: "5yr / staggered", source: "Levels.fyi (₹3.48M-₹10.16M range)", lastVerified: "2026-05-07" },
      senior: { totalMin: 64, totalMax: 102, equityMin: 22, equityMax: 45, equityType: "rsu", equityVesting: "5yr / staggered", source: "Levels.fyi (L65)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 45, totalMax: 75, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "5yr / staggered", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 75, totalMax: 120, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "5yr / staggered", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },

  amazon: {
    "software-engineer": {
      mid: { totalMin: 38, totalMax: 65, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 5-15-40-40 (back-loaded)", source: "Levels.fyi (Amazon India SDE-2)", lastVerified: "2026-05-07", notes: "Amazon India RSU vest is back-loaded — first 2 years cash-heavy with sign-on offsetting." },
      senior: { totalMin: 65, totalMax: 110, equityMin: 18, equityMax: 45, equityType: "rsu", equityVesting: "4yr / back-loaded", source: "Levels.fyi (SDE-3 / L6)", lastVerified: "2026-05-07" },
    },
    "ux-designer": {
      mid: { totalMin: 29, totalMax: 50, equityMin: 6, equityMax: 16, equityType: "rsu", equityVesting: "4yr / back-loaded", source: "Levels.fyi (₹2.88M-₹6.45M range)", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 65, equityMin: 14, equityMax: 28, equityType: "rsu", equityVesting: "4yr / back-loaded", source: "Levels.fyi (L6)", lastVerified: "2026-05-07" },
    },
  },

  /* ─── IT Services ─────────────────────────────────────────────── */
  tcs: {
    "software-engineer": {
      entry: { totalMin: 3.4, totalMax: 4.5, equityType: "none", source: "TCS NQT 2026 disclosure", lastVerified: "2026-05-07", notes: "TCS NQT entry-level; Digital track ₹7-9 LPA. No ESOP." },
      mid: { totalMin: 5, totalMax: 9, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 9, totalMax: 16, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  infosys: {
    "software-engineer": {
      entry: { totalMin: 3.6, totalMax: 6.25, equityType: "none", source: "Infosys 2026 fresher disclosure", lastVerified: "2026-05-07", notes: "DSE ₹3.6-6.25L; Specialist Programmer L3 ₹21L, L2 ₹16L, L1 ₹10L. Wide spread by track." },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  cognizant: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Cognizant GenC / GenC Next 2026 disclosure", lastVerified: "2026-05-07", notes: "GenC ₹4L; GenC Next ₹6.5L. In-hand ₹28-32K/mo for GenC." },
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
};

/**
 * Look up a verified company-specific band override.
 * Returns null when no override exists; caller falls back to tier band.
 */
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
  const direct = COMPANY_SALARY_OVERRIDES[cleaned]?.[roleKey]?.[experienceLevel];
  if (direct) return direct;

  // Loose containment fallback (e.g. "Razorpay Internet Pvt Ltd" → razorpay).
  for (const [companyKey, roleMap] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
    if (companyKey.length < 4) continue;
    if (cleaned.includes(companyKey) || companyKey.includes(cleaned)) {
      const hit = roleMap[roleKey]?.[experienceLevel];
      if (hit) return hit;
    }
  }
  return null;
}
