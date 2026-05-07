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

  /* ─── Big Tech (Levels.fyi-grounded) ───────────────────────── */
  adobe: {
    "software-engineer": {
      entry: { totalMin: 24, totalMax: 35, equityMin: 4, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Adobe India ₹2.46M-₹23.81M, P10)", lastVerified: "2026-05-07" },
      mid: { totalMin: 45, totalMax: 80, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Adobe India median ₹6.98M, P30-P40)", lastVerified: "2026-05-07" },
      senior: { totalMin: 75, totalMax: 130, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P50)", lastVerified: "2026-05-07" },
      lead: { totalMin: 120, totalMax: 200, equityMin: 50, equityMax: 100, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P60 ₹23.81M+)", lastVerified: "2026-05-07" },
    },
  },
  salesforce: {
    "software-engineer": {
      entry: { totalMin: 27, totalMax: 38, equityMin: 5, equityMax: 10, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Associate MTS ₹2.72M)", lastVerified: "2026-05-07" },
      mid: { totalMin: 45, totalMax: 80, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (median ₹7.23M)", lastVerified: "2026-05-07" },
      senior: { totalMin: 75, totalMax: 130, equityMin: 25, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (LMTS / SMTS)", lastVerified: "2026-05-07" },
      lead: { totalMin: 130, totalMax: 250, equityMin: 60, equityMax: 130, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Architect ₹25.8M+)", lastVerified: "2026-05-07" },
    },
  },
  atlassian: {
    "software-engineer": {
      entry: { totalMin: 36, totalMax: 48, equityMin: 6, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Atlassian India P30 ₹4.01M)", lastVerified: "2026-05-07", notes: "Atlassian P30 entry. Generous equity refreshers." },
      mid: { totalMin: 55, totalMax: 95, equityMin: 15, equityMax: 32, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P40-P50, median ₹8.28M)", lastVerified: "2026-05-07" },
      senior: { totalMin: 90, totalMax: 150, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P50-P60)", lastVerified: "2026-05-07" },
      lead: { totalMin: 140, totalMax: 180, equityMin: 55, equityMax: 90, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P60 ₹17.56M+)", lastVerified: "2026-05-07" },
    },
    "product-manager": {
      mid: { totalMin: 50, totalMax: 85, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi", lastVerified: "2026-05-07" },
      senior: { totalMin: 85, totalMax: 140, equityMin: 28, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi", lastVerified: "2026-05-07" },
    },
  },
  uber: {
    "software-engineer": {
      entry: { totalMin: 30, totalMax: 42, equityMin: 5, equityMax: 12, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Uber SE-I India median ₹36.27L)", lastVerified: "2026-05-07" },
      mid: { totalMin: 50, totalMax: 80, equityMin: 12, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (SE-II)", lastVerified: "2026-05-07" },
      senior: { totalMin: 80, totalMax: 130, equityMin: 25, equityMax: 55, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (SE-III / Senior)", lastVerified: "2026-05-07" },
    },
  },
  apple: {
    "software-engineer": {
      mid: { totalMin: 50, totalMax: 80, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Apple India ICT3-ICT4)", lastVerified: "2026-05-07" },
      senior: { totalMin: 85, totalMax: 140, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (ICT5)", lastVerified: "2026-05-07" },
    },
  },
  stripe: {
    "software-engineer": {
      mid: { totalMin: 50, totalMax: 85, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Stripe India product-engineering team (Bengaluru)", lastVerified: "2026-05-07", notes: "Stripe's writing-clarity bar is unusually high; expect culture-fit weight in offer." },
      senior: { totalMin: 85, totalMax: 140, equityMin: 28, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Stripe India internal disclosures + Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  /* ─── IT Services (experienced bands beyond entry) ─────────── */
  wipro: {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 6.5, equityType: "none", source: "Wipro NLTH 2026", lastVerified: "2026-05-07", notes: "Wipro Elite vs Turbo split." },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07", notes: "AI/ML 3-yr exp can land ₹22-24L per recent offer-letter discussions." },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "AmbitionBox + Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  hcl: {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 5.5, equityType: "none", source: "HCL TechBee 2026", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "AmbitionBox 2026", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },
  ltimindtree: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "LTIMindtree 2026 fresher disclosure", lastVerified: "2026-05-07" },
      mid: { totalMin: 8, totalMax: 18, equityType: "none", source: "Indeed + Weekday (LTIMindtree avg ₹19.71L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
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
  },

  /* ─── SaaS / Product (Indian-built) ────────────────────────── */
  postman: {
    "software-engineer": {
      mid: { totalMin: 38, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Postman IC2 India median ₹53.1L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 65, totalMax: 120, equityMin: 18, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (IC3-IC4 ₹11.96M)", lastVerified: "2026-05-07" },
    },
  },
  browserstack: {
    "software-engineer": {
      entry: { totalMin: 17, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (BrowserStack L1 India ₹1.99M)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (L3 ₹17.3-28.1L)", lastVerified: "2026-05-07", notes: "BrowserStack pays below product-co peers; quality of work is the trade-off." },
      senior: { totalMin: 30, totalMax: 50, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (L5 ₹3.77M)", lastVerified: "2026-05-07" },
    },
  },
  chargebee: {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 32, equityMin: 2, equityMax: 6, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Chargebee India median ₹27.6L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 55, equityMin: 5, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Principal ₹4.9M)", lastVerified: "2026-05-07" },
    },
  },
  freshworks: {
    "software-engineer": {
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor + Levels.fyi (Freshworks Nasdaq-listed)", lastVerified: "2026-05-07", notes: "RSUs in Freshworks (FRSH NASDAQ) — public, liquid." },
      senior: { totalMin: 40, totalMax: 70, equityMin: 8, equityMax: 22, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  zoho: {
    "software-engineer": {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Zoho hiring disclosures + AmbitionBox", lastVerified: "2026-05-07", notes: "Zoho is bootstrapped, anti-VC, profitable. No equity. Comp slow-but-steady." },
      mid: { totalMin: 8, totalMax: 16, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
      senior: { totalMin: 16, totalMax: 32, equityType: "none", source: "AmbitionBox", lastVerified: "2026-05-07" },
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
    },
  },
  bain: {
    consultant: {
      entry: { totalMin: 16, totalMax: 25, equityType: "none", source: "Bain India AC pre-MBA (Glassdoor)", lastVerified: "2026-05-07" },
      mid: { totalMin: 32, totalMax: 52, equityType: "none", source: "Bain India Consultant post-MBA", lastVerified: "2026-05-07", notes: "Post-MBA Bain India ₹32-40L base + ₹8-12L bonus. Highest MBB bonus ceiling globally." },
      senior: { totalMin: 60, totalMax: 95, equityType: "none", source: "Bain India CL (Case Leader) / Manager", lastVerified: "2026-05-07" },
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
  },
  jpmc: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityType: "none", source: "JPMC India Analyst (Glassdoor; ~40% below Goldman per Bangalore reporting)", lastVerified: "2026-05-07" },
      mid: { totalMin: 25, totalMax: 45, equityMin: 2, equityMax: 6, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor JPMC India", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 80, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "3yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
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
      mid: { totalMin: 33, totalMax: 50, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Workday India P2 ₹3.3M-P3 median ₹48.2L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 67, equityMin: 14, equityMax: 28, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (P4 ₹6.68M)", lastVerified: "2026-05-07" },
    },
  },
  linkedin: {
    "software-engineer": {
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
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi + Glassdoor (Lenskart median $37.5K = ₹31L; range ₹2.4L-₹77L)", lastVerified: "2026-05-07", notes: "Lenskart listed Nov 2025 — ESOPs converted to RSUs." },
      senior: { totalMin: 38, totalMax: 60, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  nykaa: {
    "software-engineer": {
      mid: { totalMin: 27.3, totalMax: 38.6, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Nykaa SE India median ₹35.5L; range ₹2.73M-₹3.86M)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "engineering-manager": {
      mid: { totalMin: 47.9, totalMax: 65.5, equityMin: 12, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Nykaa SEM ₹4.79M-₹6.55M)", lastVerified: "2026-05-07" },
    },
  },
  cars24: {
    "software-engineer": {
      mid: { totalMin: 18, totalMax: 32, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Cars24 ₹10L-₹54.9L range)", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 55, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Cars24 SEM)", lastVerified: "2026-05-07" },
    },
  },
  groww: {
    "software-engineer": {
      mid: { totalMin: 28, totalMax: 50, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Groww post-listing)", lastVerified: "2026-05-07", notes: "Groww listed in 2025 IPO wave." },
      senior: { totalMin: 50, totalMax: 95, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Groww SEM ₹12.4M)", lastVerified: "2026-05-07" },
    },
  },
  ola: {
    "software-engineer": {
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
    },
  },
  hul: {
    marketing: {
      entry: { totalMin: 18, totalMax: 27, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM (HUL UFLP ₹18-27L for IIM grads)", lastVerified: "2026-05-07", notes: "HUL UFLP — premium MT program. Glassdoor avg includes non-MBA roles which are lower (₹7.88L avg)." },
      mid: { totalMin: 30, totalMax: 50, equityMin: 2, equityMax: 8, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 90, equityMin: 5, equityMax: 18, equityType: "rsu", equityVesting: "3yr", source: "InsideIIM", lastVerified: "2026-05-07" },
    },
  },
  "p&g": {
    marketing: {
      entry: { totalMin: 22, totalMax: 32, equityType: "none", source: "InsideIIM + Glassdoor (P&G MBA MT)", lastVerified: "2026-05-07", notes: "P&G premium MNC MT — top of FMCG MBA market." },
      mid: { totalMin: 35, totalMax: 60, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
      senior: { totalMin: 60, totalMax: 110, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },
  nestle: {
    marketing: {
      entry: { totalMin: 14, totalMax: 22, equityType: "none", source: "Glassdoor (Nestle MT avg ₹17L)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 35, equityType: "none", source: "Glassdoor (Nestle India avg ₹21L)", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
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
