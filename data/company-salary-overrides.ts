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
      entry: { totalMin: 16, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + Naukri (Swiggy SDE-1 fresher 2026)", lastVerified: "2026-05-07", notes: "Swiggy SDE-1 campus / 0-2 yr; listed Nov 2024 — ESOPs converted to RSU." },
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
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + AmbitionBox (Zomato SDE-1 fresher)", lastVerified: "2026-05-07" },
      mid: { totalMin: 24, totalMax: 40, equityMin: 3, equityMax: 8, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Levels.fyi (Eternal/Zomato listed)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox", lastVerified: "2026-05-07" },
    },
  },

  cred: {
    "software-engineer": {
      entry: { totalMin: 22, totalMax: 32, equityMin: 2, equityMax: 5, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (CRED SDE-1 campus / fresher)", lastVerified: "2026-05-07", notes: "CRED hires extremely selectively at campus level; bar is high." },
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
      entry: { totalMin: 18, totalMax: 28, equityType: "none", source: "Zerodha public hiring disclosures + Glassdoor", lastVerified: "2026-05-07", notes: "Zerodha SDE-1 fresher. Bootstrapped — no ESOP, but profit-share bonus can equal base." },
      mid: { totalMin: 28, totalMax: 45, equityType: "none", source: "Glassdoor + Zerodha public bonus disclosures", lastVerified: "2026-05-07", notes: "Bootstrapped; no ESOP. Profitable — annual bonus 100% of base in good years." },
      senior: { totalMin: 45, totalMax: 75, equityType: "none", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
  },

  meesho: {
    "software-engineer": {
      entry: { totalMin: 16, totalMax: 24, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "AmbitionBox + Naukri (Meesho SDE-1 post-IPO)", lastVerified: "2026-05-07", notes: "Listed Dec 2025; SDE-1 RSU is now liquid." },
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
      entry: { totalMin: 30, totalMax: 45, equityMin: 8, equityMax: 16, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Google India L3 / new-grad campus)", lastVerified: "2026-05-07", notes: "Google L3 India campus offer; sign-on ₹3-8L common." },
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
      entry: { totalMin: 28, totalMax: 42, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "5yr (staggered)", source: "Levels.fyi (Microsoft India L59-L60 / new-grad campus)", lastVerified: "2026-05-07", notes: "Microsoft India L59-L60 SDE campus offer; refresh grants annual." },
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
      entry: { totalMin: 22, totalMax: 32, equityMin: 4, equityMax: 10, equityType: "rsu", equityVesting: "4yr / back-loaded (5-15-40-40)", source: "Levels.fyi (Amazon India SDE-1 / L4 campus)", lastVerified: "2026-05-07", notes: "Amazon SDE-1 India campus; sign-on ₹3-6L offsets back-loaded RSU vest." },
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
      entry: { totalMin: 30, totalMax: 44, equityMin: 7, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Apple India ICT2 / new-grad)", lastVerified: "2026-05-07" },
      mid: { totalMin: 50, totalMax: 80, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (Apple India ICT3-ICT4)", lastVerified: "2026-05-07" },
      senior: { totalMin: 85, totalMax: 140, equityMin: 30, equityMax: 65, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Levels.fyi (ICT5)", lastVerified: "2026-05-07" },
    },
  },
  stripe: {
    "software-engineer": {
      entry: { totalMin: 32, totalMax: 48, equityMin: 6, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Stripe India campus / new-grad (Glassdoor + Stripe disclosures)", lastVerified: "2026-05-07", notes: "Stripe SE-I India; bar-raising writing screen even at campus." },
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
      entry: { totalMin: 25, totalMax: 35, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Postman IC1 India ₹2.9M; campus ₹25-35L)", lastVerified: "2026-05-07" },
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
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (Nykaa 1,202 salaries; SE entry India)", lastVerified: "2026-05-07" },
      mid: { totalMin: 27.3, totalMax: 38.6, equityMin: 4, equityMax: 9, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Nykaa SE India median ₹35.5L; range ₹2.73M-₹3.86M)", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 65, equityMin: 8, equityMax: 18, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor", lastVerified: "2026-05-07" },
    },
    "engineering-manager": {
      mid: { totalMin: 47.9, totalMax: 65.5, equityMin: 12, equityMax: 25, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Nykaa SEM ₹4.79M-₹6.55M)", lastVerified: "2026-05-07" },
    },
  },
  cars24: {
    "software-engineer": {
      entry: { totalMin: 10, totalMax: 18, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Glassdoor (CARS24 2,087 salaries; entry SE)", lastVerified: "2026-05-07" },
      mid: { totalMin: 18, totalMax: 32, equityMin: 3, equityMax: 7, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Cars24 ₹10L-₹54.9L range)", lastVerified: "2026-05-07" },
      senior: { totalMin: 32, totalMax: 55, equityMin: 6, equityMax: 14, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Cars24 SEM)", lastVerified: "2026-05-07" },
    },
  },
  groww: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Glassdoor + Levels.fyi (Groww SE-1 fresher post-IPO)", lastVerified: "2026-05-07", notes: "Groww listed in 2025 IPO wave; fresher RSU is now liquid." },
      mid: { totalMin: 28, totalMax: 50, equityMin: 5, equityMax: 14, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Groww post-listing)", lastVerified: "2026-05-07", notes: "Groww listed in 2025 IPO wave." },
      senior: { totalMin: 50, totalMax: 95, equityMin: 12, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 1yr cliff", source: "Levels.fyi (Groww SEM ₹12.4M)", lastVerified: "2026-05-07" },
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
  },
  __sector_consulting_big4: {
    consultant: {
      entry: { totalMin: 5, totalMax: 11, equityType: "none", source: "Big 4 India Analyst (Deloitte/EY/KPMG/PwC) pre-MBA", lastVerified: "2026-05-07" },
      mid: { totalMin: 11, totalMax: 22, equityType: "none", source: "Big 4 India Consultant 1-3 yr", lastVerified: "2026-05-07" },
      senior: { totalMin: 17, totalMax: 32, equityType: "none", source: "Big 4 India Senior Consultant (3-13 yr)", lastVerified: "2026-05-07" },
      lead: { totalMin: 30, totalMax: 60, equityType: "none", source: "Big 4 Manager / Senior Manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 60, totalMax: 180, equityType: "none", source: "Big 4 India Partner / MD (15+ yr)", lastVerified: "2026-05-07", notes: "Big 4 Partner India ₹60-180L; profit-share + carry. Below MBB Partner due to volume model." },
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
  },
  __sector_quant_hft: {
    "data-scientist": {
      entry: { totalMin: 50, totalMax: 100, equityType: "none", source: "Quant / HFT India entry (IIT-targeted: Tower / Optiver / IMC / Hudson River / Two Sigma / Millennium)", lastVerified: "2026-05-07", notes: "Indian fresher quant: ₹50-110L+ first-year. Performance-tied bonus." },
      mid: { totalMin: 120, totalMax: 280, equityType: "none", source: "Quant India 3-5 yr (eFinancialCareers / Wall Street Oasis archive)", lastVerified: "2026-05-07" },
      senior: { totalMin: 250, totalMax: 500, equityType: "none", source: "Quant India 6-10 yr senior researcher / trader", lastVerified: "2026-05-07", notes: "Senior quant: PnL-share dominates. ₹2.5-5Cr typical at top firms." },
      lead: { totalMin: 400, totalMax: 800, equityType: "none", source: "Quant India 10-14 yr team lead / portfolio manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 700, totalMax: 1500, equityType: "none", source: "Quant India 15+ yr partner / head", lastVerified: "2026-05-07", notes: "Partner-tier quant: ₹7-15Cr+. Top performers cross ₹25Cr in record years." },
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
  },
  __sector_private_bank: {
    sales: {
      entry: { totalMin: 4, totalMax: 7, equityType: "none", source: "Private bank India RM entry (Yes / IndusInd / Federal / RBL etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Private bank India RM mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 26, equityType: "none", source: "Private bank India RM senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 26, totalMax: 50, equityType: "none", source: "Private bank India Cluster / Zonal Head (10-15 yr)", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 200, equityType: "none", source: "Private bank India Business Head / President (15+ yr)", lastVerified: "2026-05-07", notes: "C-suite at private banks (HDFC/ICICI/Axis/Kotak): ₹3-15Cr+. Top performers (CEO/MD) ₹10-25Cr." },
    },
  },
  __sector_small_finance_bank: {
    sales: {
      entry: { totalMin: 3.5, totalMax: 6, equityType: "none", source: "Small Finance Bank India entry (AU / Equitas / Ujjivan / ESAF etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 12, equityType: "none", source: "SFB India mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 12, totalMax: 22, equityType: "none", source: "SFB India senior", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_unicorn_consumer: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn (Mamaearth / Sugar / boAt / Noise / Purplle etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 65, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 60, totalMax: 100, equityMin: 15, equityMax: 40, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn lead", lastVerified: "2026-05-07" },
      executive: { totalMin: 95, totalMax: 220, equityMin: 30, equityMax: 90, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian consumer unicorn VP/CXO", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_unicorn_logistics: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn (Delhivery / Ecom / XpressBees / Shadowfax / Porter / BlackBuck)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 38, equityMin: 3, equityMax: 8, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 60, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 55, totalMax: 95, equityMin: 14, equityMax: 35, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn lead", lastVerified: "2026-05-07" },
      executive: { totalMin: 90, totalMax: 200, equityMin: 28, equityMax: 80, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian logistics unicorn VP/CXO", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_it_services: {
    "software-engineer": {
      entry: { totalMin: 3.5, totalMax: 6, equityType: "none", source: "IT services India entry (mid-tier: Mphasis / Coforge / Persistent / Hexaware / Mindtree / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 6, totalMax: 14, equityType: "none", source: "IT services mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "IT services senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 50, equityType: "none", source: "IT services lead/architect", lastVerified: "2026-05-07" },
      executive: { totalMin: 50, totalMax: 130, equityType: "none", source: "IT services Delivery Head / VP / SVP", lastVerified: "2026-05-07", notes: "Top of IT-services ladder: VP-level ₹50-130L; CXO ₹150L+ at large firms (TCS / Infosys CTO / CHRO etc.)." },
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
  },
  __sector_indian_fmcg: {
    marketing: {
      entry: { totalMin: 14, totalMax: 24, equityType: "none", source: "Indian FMCG MT MBA (Dabur / Marico / Godrej / Britannia / Emami / Patanjali / etc.)", lastVerified: "2026-05-07", notes: "Top-tier (HUL/ITC/P&G/Nestle) ₹18-27L; mid-tier this band." },
      mid: { totalMin: 24, totalMax: 40, equityType: "none", source: "Indian FMCG Brand Manager", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 70, equityType: "none", source: "Indian FMCG Senior Brand Manager / Category Head", lastVerified: "2026-05-07" },
      lead: { totalMin: 65, totalMax: 120, equityType: "none", source: "FMCG Marketing Director / GM Marketing", lastVerified: "2026-05-07" },
      executive: { totalMin: 110, totalMax: 300, equityType: "none", source: "FMCG VP Marketing / CMO / President", lastVerified: "2026-05-07", notes: "FMCG MD India ₹3-15Cr+ at top firms (HUL CEO, ITC ED, etc.)." },
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
  },
  __sector_academia_iit_iim: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityType: "none", source: "Indian academia (IIT/IIM/IISc) Assistant Professor — UGC pay scale", lastVerified: "2026-05-07", notes: "UGC pay scale fixed; consulting + grant earnings vary." },
      mid: { totalMin: 14, totalMax: 24, equityType: "none", source: "Associate Professor", lastVerified: "2026-05-07" },
      senior: { totalMin: 24, totalMax: 40, equityType: "none", source: "Professor / Department Chair", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 60, equityType: "none", source: "Senior Professor / Endowed Chair / Dean", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 100, equityType: "none", source: "Director / VC (IIT/IIM Director appointed by MHRD)", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_hotels: {
    operations: {
      entry: { totalMin: 4, totalMax: 6.5, equityType: "none", source: "Indian hotels entry (Taj / ITC / Oberoi / Marriott / Hyatt / Lemon Tree / Leela / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 7, totalMax: 14, equityType: "none", source: "Hotels mid (F&B Manager / Front Office / Housekeeping)", lastVerified: "2026-05-07" },
      senior: { totalMin: 14, totalMax: 28, equityType: "none", source: "Hotels senior (GM / Regional Director)", lastVerified: "2026-05-07" },
      lead: { totalMin: 28, totalMax: 55, equityType: "none", source: "Hotels Cluster GM / VP Operations", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 180, equityType: "none", source: "Hotels CEO / COO / President (IHCL / EIH / ITC Hotels)", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_auto_oem: {
    "software-engineer": {
      entry: { totalMin: 6, totalMax: 10, equityType: "none", source: "Indian auto OEM (Tata Motors / M&M / Maruti / Hyundai / Bajaj / TVS / Royal Enfield / etc.)", lastVerified: "2026-05-07" },
      mid: { totalMin: 10, totalMax: 20, equityType: "none", source: "Auto OEM mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 20, totalMax: 38, equityType: "none", source: "Auto OEM senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 70, equityType: "none", source: "Auto OEM lead / VP Engineering", lastVerified: "2026-05-07" },
      executive: { totalMin: 65, totalMax: 200, equityType: "none", source: "Auto OEM CTO / President / MD", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_civil_services: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 12, equityType: "none", source: "Civil services / RBI Grade B / SEBI Grade A / NABARD entry — 7th CPC fixed band", lastVerified: "2026-05-07", notes: "Fixed pay scale + DA + HRA. Pension + perks add 30-50% non-cash value." },
      mid: { totalMin: 15, totalMax: 25, equityType: "none", source: "Civil services mid (Under Secretary / Joint Director)", lastVerified: "2026-05-07" },
      senior: { totalMin: 25, totalMax: 45, equityType: "none", source: "Civil services senior (Joint Secretary / Secretary)", lastVerified: "2026-05-07" },
      lead: { totalMin: 40, totalMax: 65, equityType: "none", source: "Civil services lead (Additional Secretary)", lastVerified: "2026-05-07" },
      executive: { totalMin: 55, totalMax: 90, equityType: "none", source: "Civil services apex (Cabinet Secretary / Secretary to GoI)", lastVerified: "2026-05-07", notes: "Apex-grade civil servant: ₹55-90L cash + ₹50-150L actuarial pension. Type-A bungalow + protocol perks." },
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
  },
  __sector_global_gaming: {
    "software-engineer": {
      entry: { totalMin: 18, totalMax: 28, equityMin: 2, equityMax: 5, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India entry (EA / Ubisoft / Riot / Activision)", lastVerified: "2026-05-07" },
      mid: { totalMin: 28, totalMax: 50, equityMin: 5, equityMax: 15, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 50, totalMax: 90, equityMin: 14, equityMax: 30, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 90, totalMax: 150, equityMin: 25, equityMax: 60, equityType: "rsu", equityVesting: "4yr / 25-25-25-25", source: "Global gaming India lead", lastVerified: "2026-05-07" },
    },
  },
  __sector_indian_gaming_realmoney: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 22, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian real-money gaming entry (Dream11 / MPL / Games24x7)", lastVerified: "2026-05-07", notes: "Regulatory uncertainty (state bans, GST changes) caps long-term ESOP value." },
      mid: { totalMin: 22, totalMax: 40, equityMin: 3, equityMax: 10, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian gaming mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 70, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian gaming senior", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_industrials_metals: {
    "software-engineer": {
      entry: { totalMin: 5, totalMax: 9, equityType: "none", source: "Indian industrials entry (Tata Steel / JSW / UltraTech / L&T / Asian Paints)", lastVerified: "2026-05-07" },
      mid: { totalMin: 9, totalMax: 18, equityType: "none", source: "Industrials mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 18, totalMax: 35, equityType: "none", source: "Industrials senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 35, totalMax: 65, equityType: "none", source: "Industrials Plant Head / VP Engineering", lastVerified: "2026-05-07" },
      executive: { totalMin: 60, totalMax: 200, equityType: "none", source: "Industrials MD / CEO (Tata Steel / JSW / L&T)", lastVerified: "2026-05-07", notes: "Top of industrials ladder. Tata Steel / JSW / L&T MDs cross ₹3-15Cr." },
    },
  },
  __sector_indian_crypto_web3: {
    "software-engineer": {
      entry: { totalMin: 14, totalMax: 24, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian crypto entry (CoinDCX / WazirX / CoinSwitch / Polygon)", lastVerified: "2026-05-07", notes: "Token-grant component common; valuation tied to crypto cycle." },
      mid: { totalMin: 24, totalMax: 45, equityMin: 4, equityMax: 12, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian crypto mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 45, totalMax: 80, equityMin: 12, equityMax: 30, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian crypto senior", lastVerified: "2026-05-07" },
    },
  },
  __sector_indian_travel_aggregator: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 20, equityMin: 1, equityMax: 3, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian travel aggregator entry (MMT / Yatra / Cleartrip / Ixigo / EaseMyTrip)", lastVerified: "2026-05-07" },
      mid: { totalMin: 20, totalMax: 38, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Travel aggregator mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 38, totalMax: 65, equityMin: 7, equityMax: 18, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Travel aggregator senior", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_market_infra: {
    "software-engineer": {
      entry: { totalMin: 8, totalMax: 14, equityType: "none", source: "Market infra entry (NSE / BSE / NSDL / CDSL / CRISIL / RBI / SEBI)", lastVerified: "2026-05-07", notes: "Govt-style fixed pay. Pension + perks add 30-50% non-cash value." },
      mid: { totalMin: 15, totalMax: 28, equityType: "none", source: "Market infra mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 28, totalMax: 50, equityType: "none", source: "Market infra senior (NSE/BSE Director / RBI Manager)", lastVerified: "2026-05-07" },
      lead: { totalMin: 45, totalMax: 75, equityType: "none", source: "Market infra lead (CGM / DGM)", lastVerified: "2026-05-07" },
      executive: { totalMin: 70, totalMax: 130, equityType: "none", source: "Market infra apex (NSE MD / SEBI Chairman)", lastVerified: "2026-05-07" },
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
  },
  __sector_indian_audit_legal_midtier: {
    consultant: {
      entry: { totalMin: 6, totalMax: 12, equityType: "none", source: "Indian mid-tier audit / legal entry (Walker Chandiok / S.R. Batliboi / Lodha & Co / AZB / Trilegal etc.)", lastVerified: "2026-05-07", notes: "Bonus 30-60% of base; partner-track economics dominate at 8-12 yr." },
      mid: { totalMin: 12, totalMax: 22, equityType: "none", source: "Mid-tier audit / legal Associate", lastVerified: "2026-05-07" },
      senior: { totalMin: 22, totalMax: 45, equityType: "none", source: "Mid-tier audit / legal Senior", lastVerified: "2026-05-07" },
      lead: { totalMin: 40, totalMax: 90, equityType: "none", source: "Mid-tier audit / legal Manager / Senior Manager", lastVerified: "2026-05-07" },
      executive: { totalMin: 80, totalMax: 250, equityType: "none", source: "Mid-tier audit / legal Partner (AZB / Trilegal / Khaitan top-tier)", lastVerified: "2026-05-07", notes: "AZB / Trilegal / Khaitan / Cyril Amarchand Partner: ₹2-15Cr depending on book." },
    },
  },
  __sector_indian_saas_broad: {
    "software-engineer": {
      entry: { totalMin: 12, totalMax: 22, equityMin: 1, equityMax: 4, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian SaaS broad entry (Freshworks / Zoho / Postman / BrowserStack / Chargebee / etc. — NB bespoke entries override this)", lastVerified: "2026-05-07" },
      mid: { totalMin: 22, totalMax: 40, equityMin: 3, equityMax: 9, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian SaaS broad mid", lastVerified: "2026-05-07" },
      senior: { totalMin: 40, totalMax: 70, equityMin: 8, equityMax: 20, equityType: "esop", equityVesting: "4yr / 1yr cliff", source: "Indian SaaS broad senior", lastVerified: "2026-05-07" },
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
  if (directHit) return directHit;

  // Loose containment fallback (e.g. "Razorpay Internet Pvt Ltd" → razorpay).
  for (const [companyKey, roleMap] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
    if (companyKey.startsWith("__sector_")) continue; // Sector entries handled below
    if (companyKey.length < 4) continue;
    if (cleaned.includes(companyKey) || companyKey.includes(cleaned)) {
      const hit = pickLevelInRoleMap(roleMap[roleKey], experienceLevel);
      if (hit) return hit;
    }
  }
  /* Sector-level fallback (covers the long tail of ~800 companies in
     the autocomplete that don't have bespoke entries). classifyCompanyType
     maps the company name to one of ~25 sector buckets. */
  const classification = classifyCompanyType(rawCompany);
  if (classification) {
    const sectorKey = `__sector_${classification.key}`;
    const sectorHit = pickLevelInRoleMap(
      COMPANY_SALARY_OVERRIDES[sectorKey]?.[roleKey],
      experienceLevel,
    );
    if (sectorHit) return sectorHit;
  }
  return null;
}
