/**
 * Structured salary data for Indian job market (2025-26).
 * Indexed by: roleKey → companyTier → experienceLevel
 *
 * All figures in LPA (Lakhs Per Annum). City adjustments applied at lookup time.
 * Sources: Levels.fyi, AmbitionBox, Glassdoor India, CaseBasix, HelloPM
 * Full source list: docs/india-salary-research-2025-26.md
 *
 * Refresh cadence: every 6 months. CI test in `dataRecency.test.ts` warns
 * when CALIBRATION_DATE is older than 6 months and fails at 12 months.
 */

import type { CompanyTier } from "./company-tiers";

/** ISO YYYY-MM. Bump on each market-data refresh sprint.
 *  Last refreshed May 2026 from levels.fyi / Glassdoor / AmbitionBox
 *  (Razorpay, Flipkart, Google, Microsoft, Apple, TCS, Infosys,
 *  Indian-unicorn PM/PD/DS/SRE/CySec senior bands).
 */
export const CALIBRATION_DATE = "2026-07";

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead" | "executive";

export interface SalaryEntry {
  base_min: number;
  base_max: number;
  variable_min: number;
  variable_max: number;
  equity_type: "none" | "esop" | "rsu" | "phantom";
  equity_annual_min: number;  // LPA equivalent
  equity_annual_max: number;
  equity_vesting: string;
  total_min: number;
  total_max: number;
  in_hand_ratio: number;      // 0.60 – 0.76
  joining_bonus_min: number;
  joining_bonus_max: number;
  notice_period_days: number;
  negotiation_leverage: "low" | "medium" | "high";
  hot_skills: string[];
  notes?: string;
  /* True when this cell was filled by the densifier from a sibling cell
     rather than independently researched. Curated cells leave this
     undefined. The salary-lookup layer surfaces this in the band-context
     so the LLM (and admin dashboard) can flag derived bands as
     "estimated, not verified". */
  _synthetic?: boolean;
  /* Provenance hint for synthesized cells: which sibling cell was used.
     E.g. "ux-designer × startup-growth × senior" or "alias:program-manager".
     Curated cells leave this undefined. */
  _synthetic_source?: string;
}

export type RoleKey =
  | "software-engineer" | "product-manager" | "engineering-manager"
  | "data-scientist" | "data-analyst" | "data-engineer"
  | "ml-engineer" | "ai-engineer"
  | "ux-designer" | "marketing" | "sales"
  | "consultant" | "devops-sre" | "cloud-engineer"
  | "business-analyst" | "program-manager" | "project-manager"
  | "qa-engineer" | "hr" | "finance"
  | "content-writer" | "cybersecurity" | "blockchain"
  | "legal" | "operations" | "customer-success"
  | "teacher" | "mobile-developer" | "frontend-developer" | "backend-developer"
  | "scrum-master" | "solutions-architect" | "tech-lead"
  | "embedded-engineer" | "firmware-engineer" | "database-administrator" | "network-engineer"
  | "mechanical-engineer" | "electrical-engineer" | "civil-engineer"
  | "chartered-accountant" | "doctor" | "pharmacist"
  | "design-engineer" | "product-marketing-manager"
  | "civil-services" | "performing-arts" | "nursing" | "hardware-engineer"
  | "pilot" | "investment-banker" | "architect" | "chef";

/** Helper to create a salary entry with defaults */
function s(
  base: [number, number], variable: [number, number],
  equity: { type: SalaryEntry["equity_type"]; min: number; max: number; vest: string },
  total: [number, number],
  opts: Partial<Pick<SalaryEntry, "in_hand_ratio" | "joining_bonus_min" | "joining_bonus_max" | "notice_period_days" | "negotiation_leverage" | "hot_skills" | "notes">> = {}
): SalaryEntry {
  return {
    base_min: base[0], base_max: base[1],
    variable_min: variable[0], variable_max: variable[1],
    equity_type: equity.type, equity_annual_min: equity.min, equity_annual_max: equity.max, equity_vesting: equity.vest,
    total_min: total[0], total_max: total[1],
    in_hand_ratio: opts.in_hand_ratio ?? 0.68,
    joining_bonus_min: opts.joining_bonus_min ?? 0, joining_bonus_max: opts.joining_bonus_max ?? 0,
    notice_period_days: opts.notice_period_days ?? 30,
    negotiation_leverage: opts.negotiation_leverage ?? "medium",
    hot_skills: opts.hot_skills ?? [],
    notes: opts.notes,
  };
}

const NO_EQ = { type: "none" as const, min: 0, max: 0, vest: "N/A" };
const ESOP = (min: number, max: number, vest = "4-year vest, 1-year cliff") => ({ type: "esop" as const, min, max, vest });
const RSU = (min: number, max: number, vest = "4-year vest, quarterly") => ({ type: "rsu" as const, min, max, vest });

// ═══════════════════════════════════════════════════════════════
// Salary tables by role → company tier → experience
// ═══════════════════════════════════════════════════════════════

type SalaryTable = Partial<Record<CompanyTier, Partial<Record<ExperienceLevel, SalaryEntry>>>>;

export const SALARY_DATA: Partial<Record<RoleKey, SalaryTable>> = {

  // ─── SOFTWARE ENGINEER ────────────────────────────────────────
  "software-engineer": {
    faang: {
      // 2026-05 refresh: levels.fyi Razorpay+Flipkart cross-check shows L3/L4 entry
      // at top FAANG India clears ₹40L+ TC; raised entry total upper to 45.
      entry: s([22, 32], [1, 3], RSU(4, 10, "quarterly after 1-year cliff"), [28, 45], { joining_bonus_min: 0, joining_bonus_max: 5, notice_period_days: 30, negotiation_leverage: "low", hot_skills: ["System Design", "DSA", "GenAI/LLM"], notes: "L3/E3 level. RSUs are modest at entry, bulk of comp is base. 2026 verified: Razorpay/top-tier opens at ₹24L+ for new grads with strong GenAI exposure." }),
      mid: s([40, 55], [3, 6], RSU(15, 35), [60, 90], { joining_bonus_min: 5, joining_bonus_max: 15, negotiation_leverage: "medium", hot_skills: ["System Design", "Distributed Systems", "GenAI"] }),
      // 2026-05 refresh: levels.fyi Flipkart SDE-4 senior P75 ₹85L, P90 ₹112L total comp; FAANG India aligns. Total upper 150 → 160.
      senior: s([55, 75], [5, 12], RSU(35, 75), [85, 160], { joining_bonus_min: 5, joining_bonus_max: 15, notice_period_days: 60, negotiation_leverage: "high", hot_skills: ["ML Systems", "Platform Engineering", "Staff-level scope"] }),
      lead: s([70, 95], [10, 25], RSU(70, 160), [150, 270], { joining_bonus_min: 10, joining_bonus_max: 25, notice_period_days: 60, negotiation_leverage: "high", notes: "Staff/Principal at FAANG India 2026: 75th percentile ₹85L+, 90th percentile crosses ₹1Cr." }),
      executive: s([85, 110], [15, 35], RSU(160, 320), [300, 450], { in_hand_ratio: 0.55, joining_bonus_min: 15, joining_bonus_max: 30, notice_period_days: 90, negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([12, 22], [1, 2], ESOP(2, 5), [16, 28], { notice_period_days: 30, negotiation_leverage: "medium", hot_skills: ["React", "Node.js", "Go", "System Design"] }),
      mid: s([22, 38], [2, 5], ESOP(3, 8), [28, 50], { joining_bonus_min: 1, joining_bonus_max: 5, negotiation_leverage: "medium", notes: "Tier-1 unicorn (Razorpay/CRED/Zerodha/Zepto) lands ₹35-50L; standard unicorn (Flipkart/Swiggy/Meesho) ₹28-40L." }),
      // 2026-05 refresh: tier-1 unicorn senior 5-8 yrs lands ₹50-80L per
      // levels.fyi + Glassdoor; raised total upper 70 → 80.
      senior: s([38, 55], [4, 10], ESOP(8, 18), [50, 80], { joining_bonus_min: 2, joining_bonus_max: 8, notice_period_days: 60, negotiation_leverage: "high", notes: "Tier-1 unicorns hit ₹65-80L at senior (8+ yrs); standard ₹50-65L. ESOPs add 30-40% upside but discount face value 30-50% for liquidity risk." }),
      lead: s([55, 75], [6, 14], ESOP(12, 28), [70, 110], { notice_period_days: 60, negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3.5, 7], [0.2, 0.5], NO_EQ, [3.5, 9], { in_hand_ratio: 0.74, notice_period_days: 90, negotiation_leverage: "low", notes: "TCS Digital/Infosys SP: ₹7-11 LPA" }),
      mid: s([6, 14], [0.5, 1.5], NO_EQ, [6, 15], { notice_period_days: 90, negotiation_leverage: "low" }),
      senior: s([12, 22], [1, 3], NO_EQ, [12, 25], { notice_period_days: 90, negotiation_leverage: "medium" }),
      lead: s([18, 30], [2, 4], NO_EQ, [20, 35], { notice_period_days: 90, negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([5, 10], [0.5, 1], ESOP(1, 3), [6, 14], { notice_period_days: 15, negotiation_leverage: "medium", hot_skills: ["Full-stack", "DevOps", "GenAI"] }),
      mid: s([12, 22], [1, 3], ESOP(2, 5), [15, 28], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([22, 40], [3, 6], ESOP(5, 12), [28, 55], { notice_period_days: 30, negotiation_leverage: "high" }),
      lead: s([35, 55], [5, 10], ESOP(8, 20), [45, 80], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([4, 8], [0, 0.5], ESOP(0.5, 2), [5, 10], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([8, 16], [0.5, 2], ESOP(2, 5), [10, 22], { notice_period_days: 15, negotiation_leverage: "high" }),
      senior: s([16, 30], [2, 4], ESOP(5, 15), [22, 45], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([18, 25], [2, 5], RSU(3, 8), [22, 35], { notice_period_days: 60, negotiation_leverage: "medium" }),
      mid: s([28, 40], [5, 10], RSU(8, 15), [38, 60], { negotiation_leverage: "medium" }),
      senior: s([45, 65], [10, 20], RSU(15, 30), [65, 100], { notice_period_days: 90, negotiation_leverage: "medium" }),
    },
    "consulting-big4": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { notice_period_days: 30, negotiation_leverage: "low" }),
      mid: s([14, 22], [2, 4], NO_EQ, [16, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], NO_EQ, [25, 40], { negotiation_leverage: "medium" }),
    },
    "saas-product": {
      entry: s([8, 18], [1, 2], ESOP(1, 3), [10, 22], { notice_period_days: 30, negotiation_leverage: "medium", hot_skills: ["React", "Full-stack", "Cloud"] }),
      mid: s([18, 35], [2, 4], ESOP(3, 8), [22, 45], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [4, 8], ESOP(5, 12), [40, 65], { notice_period_days: 60, negotiation_leverage: "high" }),
    },
    "government-psu": {
      entry: s([4, 8], [0, 0.5], NO_EQ, [4, 8], { in_hand_ratio: 0.75, notice_period_days: 90, negotiation_leverage: "low", notes: "DA + HRA + pension benefits" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([14, 25], [1, 2], NO_EQ, [15, 28], { negotiation_leverage: "low" }),
    },
    /* Big Tech (Adobe / Salesforce / Atlassian / Cisco / Oracle / IBM
       / Workday / ServiceNow). Below FAANG, above unicorn. RSUs are
       material but not as aggressive as FAANG. */
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(3, 8), [22, 40], { notice_period_days: 60, negotiation_leverage: "medium", notes: "Adobe P10 / Atlassian P30 entry: ₹22-40L. Levels.fyi 2026 verified." }),
      mid: s([35, 55], [4, 8], RSU(10, 25), [45, 80], { notice_period_days: 60, negotiation_leverage: "medium" }),
      senior: s([55, 80], [8, 18], RSU(25, 55), [75, 130], { notice_period_days: 60, negotiation_leverage: "high", notes: "Senior IC at Adobe / Salesforce / Atlassian: ₹85L median." }),
      lead: s([80, 110], [12, 25], RSU(50, 110), [120, 200], { notice_period_days: 60, negotiation_leverage: "high" }),
      executive: s([110, 150], [20, 40], RSU(100, 200), [200, 350], { notice_period_days: 90, negotiation_leverage: "high" }),
    },
    /* GCC (Walmart Global Tech / Target India / Tesco Bengaluru /
       Wells Fargo India / JPMC GCC / Goldman Sachs India tech).
       Pay 15-22% above IT-services; 11.5% increment 2026 per Zinnov.
       RSU in parent stock. */
    gcc: {
      entry: s([16, 24], [1, 3], RSU(2, 5), [20, 32], { notice_period_days: 60, negotiation_leverage: "medium", notes: "Walmart Global Tech P2 entry ₹21.7-32L per Glassdoor 3,982 salaries Apr 2026." }),
      mid: s([26, 42], [3, 6], RSU(5, 14), [32, 55], { notice_period_days: 60, negotiation_leverage: "medium" }),
      senior: s([45, 70], [6, 14], RSU(15, 35), [55, 100], { notice_period_days: 60, negotiation_leverage: "high" }),
      lead: s([70, 100], [10, 22], RSU(30, 75), [95, 200], { notice_period_days: 60, negotiation_leverage: "high", notes: "Walmart Global Tech P5 staff: ₹90L median; max ₹201L." }),
    },
    /* Consulting MBB digital practice, McKinsey QuantumBlack, BCG
       X / GAMMA, Bain Vector. Hire SWE/Data alongside generalist
       consultants; below FAANG cash but premium-on-prestige. */
    "consulting-mbb": {
      entry: s([20, 30], [3, 6], NO_EQ, [25, 40], { notice_period_days: 60, negotiation_leverage: "medium", notes: "McKinsey QuantumBlack / BCG X SE: ₹25-40L." }),
      mid: s([35, 55], [6, 12], NO_EQ, [42, 70], { negotiation_leverage: "medium" }),
      senior: s([55, 80], [10, 20], NO_EQ, [65, 100], { notice_period_days: 60, negotiation_leverage: "medium" }),
    },
    /* EdTech (Byju's / Unacademy / upGrad / Vedantu / Physics Wallah
      , post-2023 reset bands, compressed 30-40% from peak). */
    edtech: {
      entry: s([6, 12], [0.5, 1.5], ESOP(0.5, 2), [8, 16], { notice_period_days: 30, negotiation_leverage: "low", notes: "Post-2023 reset; ESOP value uncertain at most names." }),
      mid: s([12, 22], [1, 3], ESOP(1, 4), [14, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 38], [3, 6], ESOP(3, 9), [28, 50], { negotiation_leverage: "medium" }),
    },
    /* BFSI domestic (HDFC tech / ICICI tech / Axis tech / Kotak
       tech). Pay below GCC, ESOP rare. */
    "bfsi-domestic": {
      entry: s([5, 10], [0.5, 1.5], NO_EQ, [6, 12], { notice_period_days: 60, negotiation_leverage: "low" }),
      mid: s([12, 22], [1.5, 3], NO_EQ, [14, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 40], [3, 6], NO_EQ, [25, 48], { notice_period_days: 90, negotiation_leverage: "medium" }),
    },
    /* FMCG MNC (HUL / ITC / Nestle / P&G, for SE / IT roles
       within FMCG, not brand-track). */
    "fmcg-mnc": {
      entry: s([6, 11], [0.5, 1.5], NO_EQ, [7, 13], { negotiation_leverage: "low" }),
      mid: s([12, 22], [1.5, 3], NO_EQ, [14, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 38], [3, 6], NO_EQ, [25, 45], { negotiation_leverage: "medium" }),
    },
  },

  // ─── PRODUCT MANAGER ──────────────────────────────────────────
  "product-manager": {
    faang: {
      entry: s([25, 35], [3, 5], RSU(3, 8, "quarterly after 1-year cliff"), [32, 45], { joining_bonus_min: 2, joining_bonus_max: 8, notice_period_days: 30, negotiation_leverage: "low", hot_skills: ["AI/ML PM", "Growth", "Platform"], notes: "APM/L3 level. RSUs modest at entry." }),
      mid: s([40, 55], [5, 8], RSU(15, 25), [60, 80], { joining_bonus_min: 5, joining_bonus_max: 15, negotiation_leverage: "high" }),
      // 2026-05 refresh: FAANG India senior PM 5-8 YOE ₹40-70L cash + heavy RSU = ₹60-150L TC per
      // multiple sources (resumegyani, productleadership, levels.fyi). Raised total upper 130 → 150.
      senior: s([55, 75], [8, 15], RSU(25, 55), [90, 150], { notice_period_days: 60, negotiation_leverage: "high", notes: "FAANG India senior PM (5-8 YOE) total comp: ₹60-150L. Cash ₹40-70L, RSU 30-50% of TC. High performers cross ₹1Cr." }),
      lead: s([75, 105], [12, 22], RSU(45, 90), [130, 220], { negotiation_leverage: "high", notes: "Group PM / Director India 2026: median ₹150-180L; principal/VP up to ₹3Cr." }),
      executive: s([95, 130], [15, 35], RSU(70, 180), [200, 350], { in_hand_ratio: 0.55, negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([10, 16], [1, 2], ESOP(1, 3), [12, 20], { negotiation_leverage: "medium", hot_skills: ["Data-driven PM", "Growth PM", "AI PM"] }),
      mid: s([20, 32], [2, 5], ESOP(3, 8), [25, 45], { negotiation_leverage: "medium" }),
      // 2026-05 refresh: tier-1 unicorn 5-8 YOE PM ₹28-50L cash + ESOP = ₹40-80L TC.
      senior: s([35, 55], [5, 10], ESOP(8, 20), [48, 85], { notice_period_days: 60, negotiation_leverage: "high", notes: "Tier-1 unicorns (Flipkart/PhonePe/Meesho/Zepto) 5-8 YOE PM: ₹28-50L cash + ESOP = ₹40-80L TC. Standard tier ₹35-55L TC." }),
      lead: s([55, 85], [8, 16], ESOP(15, 30), [80, 130], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([5, 8], [0.5, 1], NO_EQ, [5, 9], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([10, 16], [1, 2], NO_EQ, [10, 18], { negotiation_leverage: "low" }),
      senior: s([16, 25], [2, 4], NO_EQ, [18, 30], { negotiation_leverage: "medium" }),
      lead: s([22, 38], [3, 6], NO_EQ, [25, 45], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([15, 25], [1.5, 3], ESOP(3, 6), [20, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [3, 6], ESOP(5, 12), [35, 60], { negotiation_leverage: "high" }),
    },
    "consulting-mbb": {
      entry: s([14, 18], [2, 4], NO_EQ, [16, 22], { notice_period_days: 30, negotiation_leverage: "low" }),
      mid: s([20, 30], [5, 8], NO_EQ, [25, 38], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [8, 15], NO_EQ, [45, 70], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([5, 8], [0, 0.5], NO_EQ, [5, 9], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "7th CPC pay bands. Negotiate grade/level, not base salary. Perks: housing, DA, HRA, pension." }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [9, 15], { negotiation_leverage: "low", notes: "PSU manager grade. Fixed pay bands with DA increments." }),
      senior: s([14, 25], [1, 2], NO_EQ, [15, 28], { negotiation_leverage: "low", notes: "Senior manager/DGM level. Negotiate posting location and deputation allowance." }),
    },
    /* Big Tech PM (Adobe / Salesforce / Atlassian / ServiceNow) */
    "big-tech": {
      entry: s([22, 32], [3, 6], RSU(4, 10), [28, 45], { notice_period_days: 60, negotiation_leverage: "medium" }),
      mid: s([40, 60], [5, 12], RSU(12, 28), [50, 90], { negotiation_leverage: "medium" }),
      senior: s([60, 90], [10, 20], RSU(28, 60), [85, 150], { notice_period_days: 60, negotiation_leverage: "high" }),
      lead: s([90, 130], [15, 30], RSU(50, 120), [130, 220], { negotiation_leverage: "high" }),
    },
    /* GCC PM (Walmart Global Tech / Wells Fargo / JPMC GCC). */
    gcc: {
      entry: s([18, 26], [2, 4], RSU(3, 7), [22, 35], { notice_period_days: 60, negotiation_leverage: "medium" }),
      mid: s([30, 48], [4, 8], RSU(8, 18), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([50, 75], [8, 15], RSU(18, 40), [60, 110], { notice_period_days: 60, negotiation_leverage: "high" }),
      lead: s([80, 115], [12, 25], RSU(35, 80), [110, 200], { negotiation_leverage: "high" }),
    },
    /* EdTech PM. */
    edtech: {
      entry: s([8, 15], [1, 2], ESOP(0.5, 2), [10, 18], { negotiation_leverage: "low" }),
      mid: s([15, 28], [2, 5], ESOP(2, 5), [18, 35], { negotiation_leverage: "medium" }),
      senior: s([28, 48], [4, 8], ESOP(4, 10), [32, 60], { negotiation_leverage: "medium" }),
    },
    /* Startup early PM. */
    "startup-early": {
      entry: s([6, 12], [0.5, 1.5], ESOP(1, 4), [8, 16], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([14, 25], [1, 3], ESOP(3, 10), [16, 32], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([25, 42], [3, 6], ESOP(8, 22), [30, 60], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    /* BFSI domestic PM (HDFC / ICICI / Axis / Kotak digital PM). */
    "bfsi-domestic": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { negotiation_leverage: "low" }),
      mid: s([15, 26], [2, 4], NO_EQ, [17, 30], { negotiation_leverage: "medium" }),
      senior: s([26, 45], [4, 8], NO_EQ, [30, 52], { negotiation_leverage: "medium" }),
    },
    /* SaaS-product PM (Postman / BrowserStack / Chargebee tier). */
    "saas-product": {
      entry: s([10, 18], [1, 2], ESOP(1, 3), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([20, 35], [2, 5], ESOP(3, 8), [24, 42], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 10], ESOP(6, 14), [42, 70], { negotiation_leverage: "high" }),
    },
    /* FMCG MNC PM (HUL Digital / ITC / Marico digital teams). */
    "fmcg-mnc": {
      entry: s([10, 18], [1, 3], NO_EQ, [11, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 30], [2, 5], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
      senior: s([30, 50], [4, 9], NO_EQ, [35, 60], { negotiation_leverage: "high" }),
    },
  },

  // ─── ENGINEERING MANAGER ──────────────────────────────────────
  "engineering-manager": {
    faang: {
      mid: s([50, 70], [8, 15], RSU(30, 60), [90, 140], { joining_bonus_min: 10, joining_bonus_max: 20, notice_period_days: 60, negotiation_leverage: "high", hot_skills: ["AI/ML teams", "Platform", "Scale"] }),
      senior: s([70, 90], [12, 25], RSU(60, 120), [150, 235], { negotiation_leverage: "high" }),
      lead: s([80, 100], [20, 35], RSU(100, 200), [220, 350], { negotiation_leverage: "high" }),
      executive: s([90, 120], [25, 50], RSU(150, 300), [300, 450], { in_hand_ratio: 0.50, negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      mid: s([30, 45], [4, 8], ESOP(5, 12), [38, 65], { notice_period_days: 60, negotiation_leverage: "medium" }),
      senior: s([45, 65], [6, 12], ESOP(10, 20), [60, 95], { negotiation_leverage: "high" }),
      lead: s([55, 80], [8, 15], ESOP(15, 30), [80, 120], { negotiation_leverage: "high" }),
    },
    "it-services": {
      mid: s([15, 25], [1, 3], NO_EQ, [16, 28], { notice_period_days: 90, negotiation_leverage: "low" }),
      senior: s([22, 35], [2, 5], NO_EQ, [25, 40], { negotiation_leverage: "medium" }),
      lead: s([30, 50], [3, 8], NO_EQ, [35, 60], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      mid: s([20, 32], [2, 4], ESOP(3, 6), [24, 40], { notice_period_days: 30 }),
      senior: s([32, 48], [4, 8], ESOP(6, 12), [38, 62], { notice_period_days: 30, negotiation_leverage: "high" }),
      lead: s([42, 60], [6, 10], ESOP(8, 18), [55, 85], { notice_period_days: 30 }),
    },
    "big-tech": {
      mid: s([42, 60], [6, 12], RSU(20, 42), [60, 100], { negotiation_leverage: "high" }),
      senior: s([60, 80], [10, 20], RSU(40, 80), [100, 160], { negotiation_leverage: "high" }),
      lead: s([80, 110], [15, 28], RSU(70, 140), [150, 250], { negotiation_leverage: "high" }),
      executive: s([110, 145], [20, 40], RSU(100, 200), [220, 380], { in_hand_ratio: 0.55 }),
    },
    gcc: {
      mid: s([32, 48], [4, 9], RSU(12, 28), [42, 75], { negotiation_leverage: "medium" }),
      senior: s([50, 72], [7, 15], RSU(22, 50), [70, 125], { negotiation_leverage: "high" }),
      lead: s([72, 100], [12, 22], RSU(45, 95), [110, 200], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      mid: s([25, 40], [3, 6], ESOP(5, 12), [30, 55], { negotiation_leverage: "medium" }),
      senior: s([40, 60], [5, 10], ESOP(8, 18), [50, 85], { negotiation_leverage: "high" }),
      lead: s([55, 80], [8, 15], ESOP(12, 25), [70, 115], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      mid: s([42, 60], [8, 16], RSU(15, 30), [55, 100], { negotiation_leverage: "medium" }),
      senior: s([60, 90], [12, 24], RSU(30, 65), [90, 165], { negotiation_leverage: "high" }),
      lead: s([90, 130], [18, 35], RSU(60, 130), [150, 260], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      mid: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [3, 8], NO_EQ, [32, 52], { negotiation_leverage: "medium" }),
      lead: s([45, 70], [5, 12], NO_EQ, [50, 82], { negotiation_leverage: "high" }),
    },
    edtech: {
      mid: s([18, 30], [2, 5], ESOP(2, 6), [22, 40], { negotiation_leverage: "medium" }),
      senior: s([30, 48], [4, 8], ESOP(4, 10), [36, 60], { negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      mid: s([45, 65], [8, 15], NO_EQ, [55, 80], { negotiation_leverage: "medium" }),
      senior: s([65, 95], [12, 22], NO_EQ, [78, 120], { negotiation_leverage: "high" }),
      lead: s([95, 140], [18, 35], NO_EQ, [115, 180], { negotiation_leverage: "high" }),
    },
  },

  // ─── DATA SCIENTIST ───────────────────────────────────────────
  "data-scientist": {
    faang: {
      entry: s([22, 35], [2, 4], RSU(6, 12), [28, 48], { hot_skills: ["GenAI", "LLMs", "Computer Vision", "NLP"] }),
      mid: s([35, 50], [4, 8], RSU(12, 25), [50, 80], { negotiation_leverage: "high" }),
      senior: s([50, 70], [8, 15], RSU(25, 50), [80, 130], { notice_period_days: 60, negotiation_leverage: "high" }),
      lead: s([65, 85], [12, 20], RSU(40, 80), [110, 180], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([8, 12], [0.5, 1.5], ESOP(1, 3), [10, 16], { hot_skills: ["MLOps", "NLP", "Recommendation Systems"] }),
      mid: s([15, 22], [1.5, 3], ESOP(2, 5), [18, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 38], [3, 6], ESOP(5, 10), [28, 50], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([14, 22], [1, 3], NO_EQ, [15, 25], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([6, 10], [0.5, 1], ESOP(1, 2), [7, 13], { negotiation_leverage: "medium" }),
      mid: s([12, 20], [1, 3], ESOP(2, 5), [14, 26], { negotiation_leverage: "medium" }),
      senior: s([20, 35], [3, 5], ESOP(5, 10), [26, 45], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 12], [0.5, 1], ESOP(1, 2), [10, 15], { hot_skills: ["Product Analytics", "A/B Testing", "ML Ops"] }),
      mid: s([14, 22], [1, 3], ESOP(2, 5), [16, 28], {}),
      senior: s([22, 35], [3, 6], ESOP(4, 8), [28, 45], { negotiation_leverage: "high" }),
    },
    /* Big Tech Data Scientist (Adobe / Salesforce / Microsoft). */
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(5, 10), [22, 38], { negotiation_leverage: "medium" }),
      mid: s([28, 42], [3, 7], RSU(10, 22), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([42, 60], [6, 14], RSU(20, 42), [60, 110], { negotiation_leverage: "high" }),
    },
    /* GCC Data Scientist (Walmart Global Tech / JPMC / Wells Fargo). */
    gcc: {
      entry: s([14, 22], [1, 3], RSU(3, 7), [18, 30], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [3, 6], RSU(7, 15), [28, 48], { negotiation_leverage: "medium" }),
      senior: s([35, 50], [5, 11], RSU(15, 32), [45, 80], { negotiation_leverage: "high" }),
    },
    /* Consulting MBB Data Scientist (QuantumBlack / BCG GAMMA). */
    "consulting-mbb": {
      entry: s([20, 30], [3, 6], NO_EQ, [25, 40], { negotiation_leverage: "medium", notes: "QuantumBlack / BCG GAMMA" }),
      mid: s([35, 55], [6, 12], NO_EQ, [42, 70], { negotiation_leverage: "medium" }),
      senior: s([55, 80], [10, 20], NO_EQ, [65, 100], { negotiation_leverage: "high" }),
    },
    /* BFSI global Data Scientist (Goldman / JPMC quant + risk). */
    "bfsi-global": {
      entry: s([20, 30], [2, 5], RSU(4, 9), [24, 42], { negotiation_leverage: "medium" }),
      mid: s([32, 50], [5, 10], RSU(10, 22), [42, 75], { negotiation_leverage: "medium" }),
      senior: s([50, 75], [10, 20], RSU(22, 50), [70, 130], { negotiation_leverage: "high" }),
    },
    /* BFSI domestic Data Scientist (HDFC / ICICI risk + analytics). */
    "bfsi-domestic": {
      entry: s([6, 12], [0.5, 1.5], NO_EQ, [7, 14], { negotiation_leverage: "low" }),
      mid: s([14, 24], [1.5, 3], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 40], [3, 7], NO_EQ, [28, 48], { negotiation_leverage: "medium" }),
    },
    /* EdTech Data Scientist (post-reset). */
    edtech: {
      entry: s([6, 12], [0.5, 1.5], ESOP(0.5, 2), [8, 16], { negotiation_leverage: "low" }),
      mid: s([12, 22], [1, 3], ESOP(1, 4), [14, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 38], [3, 6], ESOP(3, 9), [28, 50], { negotiation_leverage: "medium" }),
    },
    /* Startup early Data Scientist. */
    "startup-early": {
      entry: s([6, 12], [0.5, 1.5], ESOP(1, 4), [8, 16], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([14, 25], [1, 3], ESOP(3, 10), [16, 32], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([25, 42], [3, 6], ESOP(8, 22), [30, 60], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    /* Government / PSU Data Scientist (RBI quant / SEBI / NABARD). */
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      mid: s([10, 18], [0.5, 1], NO_EQ, [10, 19], { negotiation_leverage: "low" }),
      senior: s([18, 30], [1, 2], NO_EQ, [19, 32], { negotiation_leverage: "low" }),
    },
  },

  // ─── DATA ANALYST ─────────────────────────────────────────────
  "data-analyst": {
    faang: {
      entry: s([12, 18], [1, 2], RSU(3, 6), [15, 25], { hot_skills: ["SQL", "Python", "Tableau", "A/B Testing"] }),
      mid: s([20, 30], [2, 4], RSU(5, 10), [25, 42], {}),
      senior: s([30, 45], [4, 8], RSU(8, 18), [40, 65], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 13], {}),
      mid: s([12, 18], [1, 2], ESOP(1, 3), [14, 22], {}),
      senior: s([18, 30], [2, 4], ESOP(3, 6), [22, 38], {}),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5], { negotiation_leverage: "low" }),
      mid: s([5, 9], [0.3, 0.8], NO_EQ, [5, 10], { negotiation_leverage: "low" }),
      senior: s([9, 16], [0.8, 1.5], NO_EQ, [10, 18], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([4, 7], [0.3, 0.5], ESOP(0.5, 1), [5, 9], {}),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], {}),
      senior: s([14, 22], [1.5, 3], ESOP(2, 5), [16, 28], {}),
    },
    "startup-early": {
      entry: s([3.5, 6], [0.2, 0.4], ESOP(0.3, 1), [4, 7], { notice_period_days: 15, negotiation_leverage: "low" }),
      mid: s([6, 11], [0.4, 1], ESOP(1, 3), [7, 13], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([12, 20], [1, 2.5], ESOP(2, 5), [13, 24], { notice_period_days: 30, negotiation_leverage: "medium" }),
    },
    edtech: {
      entry: s([4, 6], [0.2, 0.4], ESOP(0.3, 1), [4, 7], { negotiation_leverage: "low" }),
      mid: s([7, 12], [0.4, 1], ESOP(0.5, 2), [8, 14], { negotiation_leverage: "low" }),
      senior: s([12, 20], [1, 2], ESOP(1, 3), [13, 22], { negotiation_leverage: "medium" }),
    },
    gcc: {
      entry: s([10, 16], [1, 2], RSU(2, 5), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([16, 26], [2, 4], RSU(5, 12), [20, 36], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 7], RSU(10, 22), [32, 60], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([6, 11], [0.5, 1], ESOP(1, 2), [7, 13], { negotiation_leverage: "medium" }),
      mid: s([12, 20], [1, 2.5], ESOP(2, 4), [14, 24], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2.5, 5], ESOP(3, 7), [24, 40], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([14, 24], [1.5, 3], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
    },
  },

  // ─── ML ENGINEER / AI ENGINEER ────────────────────────────────
  "ml-engineer": {
    faang: {
      entry: s([25, 38], [2, 5], RSU(8, 15), [32, 55], { hot_skills: ["LLM fine-tuning", "RAG", "MLOps", "PyTorch"] }),
      mid: s([40, 55], [5, 10], RSU(15, 30), [55, 90], { negotiation_leverage: "high" }),
      senior: s([55, 75], [8, 18], RSU(30, 60), [85, 150], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([10, 16], [1, 2], ESOP(1, 3), [12, 20], { hot_skills: ["TensorFlow", "PyTorch", "Recommendation Systems"] }),
      mid: s([18, 28], [2, 4], ESOP(3, 6), [22, 36], {}),
      senior: s([28, 42], [4, 8], ESOP(5, 12), [35, 58], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([4, 8], [0.3, 0.5], NO_EQ, [4, 9], { negotiation_leverage: "low" }),
      mid: s([8, 15], [0.5, 1.5], NO_EQ, [9, 16], {}),
      senior: s([15, 25], [1, 3], NO_EQ, [16, 28], {}),
    },
    "startup-growth": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { hot_skills: ["GenAI", "LangChain", "Vector DBs"] }),
      mid: s([16, 25], [1.5, 3], ESOP(3, 6), [20, 32], { negotiation_leverage: "medium" }),
      senior: s([25, 40], [3, 6], ESOP(5, 12), [32, 55], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([6, 12], [0.5, 1.5], ESOP(1, 4), [8, 16], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([12, 22], [1, 3], ESOP(3, 8), [14, 28], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([20, 35], [2, 5], ESOP(6, 16), [26, 50], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([7, 12], [0.5, 1.5], ESOP(0.5, 2), [8, 14], { negotiation_leverage: "low" }),
      mid: s([12, 22], [1, 3], ESOP(1, 4), [14, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], ESOP(3, 8), [26, 45], { negotiation_leverage: "medium" }),
    },
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(5, 11), [22, 40], { negotiation_leverage: "medium" }),
      mid: s([30, 45], [3, 7], RSU(11, 22), [40, 68], { negotiation_leverage: "medium" }),
      senior: s([45, 65], [6, 13], RSU(20, 42), [62, 110], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([14, 22], [1, 3], RSU(3, 7), [17, 30], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [2, 5], RSU(7, 16), [28, 50], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 11], RSU(15, 32), [45, 85], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1, 3], ESOP(2, 5), [17, 30], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [2.5, 6], ESOP(4, 10), [30, 52], { negotiation_leverage: "high" }),
    },
  },
  /* AI engineer, distinct from ml-engineer in 2026. GenAI / LLM /
     RAG / agentic specialists command 1.3-1.6x ML-engineer pay at
     same YOE. The override map (Razorpay / OpenAI / Anthropic /
     Sarvam) refines per-company; these tier bands are the fallback. */
  "ai-engineer": {
    faang: {
      entry: s([28, 42], [3, 6], RSU(8, 16), [38, 60], { hot_skills: ["LLM", "RAG", "Agents", "Evals", "MCP"], negotiation_leverage: "medium", notes: "GenAI premium ≈ 1.3-1.6x SE entry at FAANG India 2026." }),
      mid: s([45, 70], [6, 12], RSU(18, 38), [60, 110], { negotiation_leverage: "high" }),
      senior: s([70, 100], [12, 22], RSU(40, 85), [110, 180], { notice_period_days: 60, negotiation_leverage: "high" }),
      lead: s([95, 130], [18, 35], RSU(80, 180), [175, 280], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([16, 28], [1.5, 3], ESOP(3, 7), [22, 38], { hot_skills: ["GenAI", "LLM ops", "Eval harness", "Vector DBs"], negotiation_leverage: "medium" }),
      mid: s([28, 48], [3, 7], ESOP(5, 12), [35, 65], { negotiation_leverage: "high", notes: "Tier-1 unicorn (Razorpay / Sarvam / Krutrim) hits ₹50-70L; standard ₹35-50L." }),
      senior: s([48, 75], [7, 14], ESOP(12, 28), [60, 110], { negotiation_leverage: "high" }),
      lead: s([70, 105], [12, 25], ESOP(22, 50), [95, 165], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([22, 36], [3, 6], RSU(5, 12), [28, 48], { negotiation_leverage: "medium" }),
      mid: s([42, 65], [5, 11], RSU(15, 32), [55, 100], { negotiation_leverage: "medium" }),
      senior: s([65, 95], [10, 20], RSU(30, 65), [90, 160], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([20, 32], [2, 5], RSU(4, 9), [26, 42], { negotiation_leverage: "medium" }),
      mid: s([32, 55], [4, 9], RSU(10, 22), [42, 75], { negotiation_leverage: "medium" }),
      senior: s([55, 85], [8, 16], RSU(20, 45), [70, 130], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([14, 24], [1.5, 3], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
      mid: s([24, 42], [2.5, 5], ESOP(4, 10), [30, 55], { negotiation_leverage: "medium" }),
      senior: s([42, 65], [5, 11], ESOP(8, 18), [50, 85], { negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([10, 18], [1, 2], ESOP(2, 5), [13, 25], { negotiation_leverage: "medium" }),
      mid: s([18, 32], [2, 4], ESOP(4, 10), [22, 42], { negotiation_leverage: "high" }),
      senior: s([30, 50], [4, 8], ESOP(8, 18), [38, 70], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([8, 16], [0.5, 2], ESOP(2, 6), [10, 22], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([16, 28], [1, 3], ESOP(5, 14), [20, 40], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([26, 45], [3, 6], ESOP(10, 25), [32, 65], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "consulting-mbb": {
      entry: s([24, 36], [4, 8], NO_EQ, [30, 48], { negotiation_leverage: "medium", notes: "QuantumBlack / BCG GAMMA AI specialists." }),
      mid: s([42, 65], [7, 14], NO_EQ, [50, 80], { negotiation_leverage: "medium" }),
      senior: s([65, 95], [12, 22], NO_EQ, [78, 120], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([6, 11], [0.4, 0.8], NO_EQ, [7, 13], { negotiation_leverage: "low", notes: "TCS / Infosys / Wipro AI/GenAI practice; certs (AWS GenAI / Azure AI) +20-30%." }),
      mid: s([11, 20], [0.6, 1.5], NO_EQ, [12, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 35], [1.5, 4], NO_EQ, [22, 40], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([10, 16], [1, 2], NO_EQ, [11, 19], { notes: "HUL / ITC / Marico AI/GenAI use-case team." }),
      mid: s([18, 30], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
      senior: s([30, 50], [4, 9], NO_EQ, [35, 60], { negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([10, 18], [1, 2], ESOP(1, 3), [12, 22], { notes: "PhysicsWallah / Unacademy AI tutor team. Post-2024 reset." }),
      mid: s([18, 30], [1.5, 3], ESOP(2, 6), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([30, 48], [3, 6], ESOP(4, 10), [36, 60], { negotiation_leverage: "medium" }),
    },
    "bfsi-global": {
      entry: s([22, 35], [3, 6], RSU(5, 12), [28, 50], { notes: "Goldman / JPMC quant + risk AI specialists." }),
      mid: s([38, 60], [5, 12], RSU(12, 28), [50, 95], { negotiation_leverage: "high" }),
      senior: s([60, 95], [10, 22], RSU(28, 60), [85, 165], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { notes: "HDFC / ICICI / Axis AI/ML team." }),
      mid: s([16, 28], [2, 4], NO_EQ, [18, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 8], NO_EQ, [32, 52], { negotiation_leverage: "medium" }),
    },
  },

  // ─── DATA ENGINEER ────────────────────────────────────────────
  "data-engineer": {
    faang: {
      entry: s([22, 32], [2, 4], RSU(6, 12), [28, 45], { hot_skills: ["Spark", "Kafka", "Airflow", "dbt"] }),
      mid: s([38, 52], [4, 8], RSU(12, 25), [50, 80], { negotiation_leverage: "high" }),
      senior: s([52, 70], [8, 15], RSU(25, 45), [80, 125], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], {}),
      mid: s([15, 25], [1.5, 3], ESOP(3, 6), [18, 32], {}),
      senior: s([25, 40], [3, 6], ESOP(5, 10), [32, 52], {}),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 14], [0.5, 1.5], NO_EQ, [8, 15], {}),
      senior: s([14, 24], [1, 3], NO_EQ, [15, 28], {}),
    },
    "startup-growth": {
      entry: s([6, 10], [0.5, 1], ESOP(1, 2), [7, 13], { hot_skills: ["Spark", "Kafka", "dbt", "Airflow"] }),
      mid: s([12, 20], [1, 3], ESOP(2, 5), [14, 26], {}),
      senior: s([20, 35], [3, 5], ESOP(5, 10), [26, 48], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([5, 9], [0.3, 0.7], ESOP(0.5, 2), [6, 11], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([10, 16], [0.5, 1.5], ESOP(2, 5), [12, 20], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([16, 26], [1.5, 3], ESOP(4, 10), [19, 36], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([5, 9], [0.3, 0.7], ESOP(0.3, 1.5), [6, 11], { negotiation_leverage: "low" }),
      mid: s([10, 16], [0.5, 1.5], ESOP(1, 3), [11, 19], { negotiation_leverage: "low" }),
      senior: s([16, 26], [1.5, 3], ESOP(2, 6), [19, 32], { negotiation_leverage: "medium" }),
    },
    gcc: {
      entry: s([12, 20], [1, 2], RSU(2, 5), [14, 26], { negotiation_leverage: "medium" }),
      mid: s([20, 32], [2, 4], RSU(6, 14), [26, 48], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 9], RSU(12, 28), [42, 75], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], ESOP(4, 10), [28, 50], { negotiation_leverage: "high" }),
    },
  },

  // ─── DEVOPS / SRE ─────────────────────────────────────────────
  "devops-sre": {
    faang: {
      entry: s([22, 35], [2, 4], RSU(6, 12), [28, 48], { hot_skills: ["Kubernetes", "Terraform", "AWS/GCP", "DevSecOps"] }),
      mid: s([35, 50], [4, 8], RSU(12, 25), [48, 78], {}),
      senior: s([50, 70], [8, 15], RSU(20, 40), [75, 120], { negotiation_leverage: "high" }),
      lead: s([65, 85], [10, 20], RSU(30, 60), [100, 160], {}),
    },
    "indian-unicorn": {
      entry: s([8, 12], [0.5, 1], ESOP(1, 2), [10, 15], {}),
      mid: s([15, 22], [1, 3], ESOP(2, 5), [18, 28], {}),
      senior: s([22, 35], [3, 5], ESOP(5, 10), [28, 48], {}),
    },
    "it-services": {
      entry: s([3.5, 6], [0.2, 0.4], NO_EQ, [3.5, 7], { notice_period_days: 90, negotiation_leverage: "low", notes: "CKA/AWS certs: +20-30%" }),
      mid: s([7, 14], [0.5, 1], NO_EQ, [8, 15], {}),
      senior: s([14, 25], [1, 2], NO_EQ, [15, 28], {}),
    },
    "government-psu": {
      entry: s([5, 8], [0, 0.5], NO_EQ, [5, 9], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "ISRO/DRDO/Railways infra. 7th CPC Level 7-8" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [9, 15], { negotiation_leverage: "low" }),
      senior: s([14, 22], [1, 2], NO_EQ, [15, 24], {}),
    },
    "startup-early": {
      entry: s([4, 8], [0.2, 0.5], ESOP(0.5, 2), [5, 10], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([10, 16], [0.5, 1.5], ESOP(2, 5), [12, 20], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([16, 28], [1.5, 3], ESOP(4, 10), [20, 38], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([4, 7], [0.2, 0.5], ESOP(0.3, 1.5), [5, 9], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.4, 1.2], ESOP(0.5, 2), [9, 16], { negotiation_leverage: "low" }),
      senior: s([14, 24], [1, 2.5], ESOP(1.5, 5), [16, 28], { negotiation_leverage: "medium" }),
    },
    gcc: {
      entry: s([14, 22], [1, 3], RSU(3, 7), [16, 28], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [2, 5], RSU(7, 16), [28, 50], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 11], RSU(15, 32), [45, 85], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([10, 16], [0.5, 1.5], ESOP(1, 3), [12, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 26], [1, 3], ESOP(2, 5), [19, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 6], ESOP(4, 10), [32, 56], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([16, 26], [2, 4], RSU(4, 9), [20, 35], { negotiation_leverage: "medium" }),
      mid: s([28, 42], [3, 7], RSU(10, 22), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([42, 60], [6, 12], RSU(20, 42), [60, 105], { negotiation_leverage: "high" }),
    },
  },
  /* Cloud engineer, closely tracks devops-sre but with AWS/Azure/GCP
     cert premium (CKA / AWS-SA / GCP-PCA add 15-25%). Multi-cloud +
     FinOps specialists command top-band at GCC and SaaS-product. */
  "cloud-engineer": {
    faang: {
      entry: s([20, 32], [2, 4], RSU(5, 10), [25, 42], { hot_skills: ["AWS", "Kubernetes", "Terraform", "FinOps"] }),
      mid: s([34, 48], [4, 8], RSU(10, 22), [44, 72], { negotiation_leverage: "high" }),
      senior: s([48, 68], [7, 14], RSU(20, 38), [70, 115], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([16, 24], [2, 4], RSU(3, 7), [20, 32], { negotiation_leverage: "medium" }),
      mid: s([26, 40], [3, 7], RSU(8, 18), [34, 60], { negotiation_leverage: "medium" }),
      senior: s([40, 58], [6, 12], RSU(16, 32), [55, 95], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([8, 13], [0.5, 1.5], ESOP(1, 3), [10, 17], { hot_skills: ["AWS/Azure/GCP", "Terraform", "Kubernetes"] }),
      mid: s([15, 24], [1, 3], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], ESOP(5, 12), [30, 52], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([14, 22], [1, 3], RSU(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [2, 5], RSU(6, 14), [28, 50], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [4, 9], RSU(12, 28), [45, 85], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([10, 16], [0.5, 1.5], ESOP(1, 3), [12, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 26], [1, 3], ESOP(2, 5), [20, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 6], ESOP(4, 10), [32, 56], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3.5, 6], [0.2, 0.5], NO_EQ, [4, 7], { notice_period_days: 90, notes: "AWS Solutions Architect / CKA: +20-30%." }),
      mid: s([7, 14], [0.5, 1.5], NO_EQ, [8, 16], { notice_period_days: 90 }),
      senior: s([14, 24], [1, 3], NO_EQ, [16, 28], { notice_period_days: 90 }),
    },
  },

  // ─── UX / PRODUCT DESIGNER ────────────────────────────────────
  // Bands refreshed FY2024-25 from levels.fyi (India), AmbitionBox, and
  // levelup-internal reference offers. ESOPs ARE real at Indian unicorns
  // and growth-stage startups for senior+ PDs, but liquidity varies — the
  // realistic-cash-equivalent of an ESOP grant is ~50-70% of nominal at
  // listed-track unicorns, lower at private startups. The total ranges
  // below assume ESOP at face-value; candidates should mentally discount.
  // IT-services typically grants no equity to design roles.
  "ux-designer": {
    faang: {
      entry: s([20, 28], [1, 3], RSU(6, 12), [27, 43], { hot_skills: ["Figma", "User Research", "Design Systems"] }),
      mid: s([32, 48], [3, 6], RSU(12, 24), [47, 78], {}),
      senior: s([48, 68], [6, 12], RSU(20, 40), [74, 120], { negotiation_leverage: "high", notes: "Microsoft/Google/Meta India senior PD median ₹85-95 LPA total comp; high performers cross ₹110 LPA. The previous band floor of ₹61 LPA was off, Microsoft alone offers ₹70+ as the standard floor for senior product designers in 2024-25." }),
      lead: s([60, 85], [10, 18], RSU(28, 55), [98, 158], { negotiation_leverage: "high", notes: "Lead/Principal/Staff PD at top FAANG India routinely lands ₹120-150 LPA total comp." }),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 13], { hot_skills: ["Figma", "Product thinking", "0-to-1 design"] }),
      mid: s([14, 22], [1.5, 3], ESOP(2, 5), [17, 30], {}),
      senior: s([24, 36], [3, 6], ESOP(4, 10), [31, 52], { negotiation_leverage: "high", notes: "Top-tier unicorns (Razorpay/CRED/Zerodha/Zepto) hit ₹40-55 LPA at senior. Standard tier (Flipkart/Swiggy/Meesho) lands ₹30-42 LPA." }),
      lead: s([35, 50], [5, 10], ESOP(8, 18), [48, 78], { negotiation_leverage: "high", notes: "Lead/Principal PD or Design Manager. Often a leveling-arbitrage opportunity, IC ladder caps lower than EM ladder at most unicorns." }),
    },
    "it-services": {
      // 2025 AmbitionBox / Glassdoor for TCS / Infosys / Wipro UX designers:
      //   Avg ₹6.5–7.7 LPA. Experienced (6-9 yrs) ₹6.1–11 LPA.
      //   Senior roles cap around ₹12.9 LPA. The previous bands here
      //   (senior [11, 20] / lead [18, 30]) were calibrated against
      //   product-company benchmarks — way over reality, which is why
      //   a TCS senior designer was being offered ₹16 LPA in the
      //   simulator (user-reported, contradicted by AmbitionBox snippet
      //   showing ₹6.5-7.7 avg).
      entry: s([3.5, 5.5], [0.1, 0.4], NO_EQ, [3.5, 6], { negotiation_leverage: "low", notes: "TCS / Infosys / Wipro UX/UI Designer fresher band. AmbitionBox 2025 avg: ₹4-6 LPA." }),
      mid: s([5, 8], [0.3, 0.7], NO_EQ, [5.5, 9], { negotiation_leverage: "low", notes: "Mid-level (3-5 yrs) at services firms. Compensation 30-40% below product-company benchmarks, consider switching after 2-3 yrs." }),
      senior: s([8, 11], [0.5, 1.5], NO_EQ, [9, 13], { negotiation_leverage: "low", notes: "Senior UX (6-9 yrs) at TCS Interactive / Infosys Wongdoody. Caps around ₹12.9 LPA per AmbitionBox 2025." }),
      lead: s([12, 17], [1, 2], NO_EQ, [13, 19], { negotiation_leverage: "medium", notes: "Lead/Principal UX at services firms, 10+ yrs. Higher-end roles cross into Design Manager titles which can hit ₹18-22 LPA but those are exception, not norm." }),
    },
    "startup-growth": {
      entry: s([5, 8], [0.3, 0.6], ESOP(0.5, 2), [6, 11], { notes: "Pre-Series-B startups: prefer higher base over higher ESOP, most early-stage equity expires worthless." }),
      mid: s([10, 18], [0.8, 2], ESOP(1.5, 4), [12, 24], {}),
      senior: s([18, 30], [2.5, 5], ESOP(3, 8), [24, 43], { negotiation_leverage: "high", notes: "Senior at Series B/C, push for cash + cash-out clauses on ESOPs (90-day exercise window, full acceleration on liquidity)." }),
      lead: s([25, 42], [4, 8], ESOP(6, 15), [35, 65], { negotiation_leverage: "high" }),
    },
    /* Big Tech UX Designer (Adobe / Salesforce / Atlassian / Microsoft) */
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(3, 8), [22, 38], { notice_period_days: 60, negotiation_leverage: "medium" }),
      mid: s([35, 55], [4, 8], RSU(10, 22), [42, 75], { negotiation_leverage: "medium" }),
      senior: s([55, 85], [8, 18], RSU(22, 50), [70, 130], { notice_period_days: 60, negotiation_leverage: "high" }),
      lead: s([85, 120], [15, 28], RSU(45, 100), [120, 200], { negotiation_leverage: "high" }),
    },
    /* GCC UX Designer */
    gcc: {
      entry: s([14, 22], [1, 3], RSU(2, 5), [18, 28], { notice_period_days: 60, negotiation_leverage: "medium" }),
      mid: s([24, 38], [3, 6], RSU(6, 14), [30, 52], { negotiation_leverage: "medium" }),
      senior: s([38, 60], [5, 12], RSU(12, 30), [48, 85], { notice_period_days: 60, negotiation_leverage: "high" }),
    },
    /* SaaS-product UX (Postman / BrowserStack / Chargebee tier). */
    "saas-product": {
      entry: s([7, 14], [0.5, 1.5], ESOP(1, 3), [8, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 26], [1, 3], ESOP(2, 5), [16, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 6], ESOP(4, 10), [30, 52], { negotiation_leverage: "high" }),
    },
    /* BFSI global UX (Goldman / JPMC / Morgan Stanley tech). */
    "bfsi-global": {
      entry: s([16, 24], [2, 4], RSU(3, 7), [20, 32], { negotiation_leverage: "medium" }),
      mid: s([26, 42], [4, 8], RSU(8, 18), [34, 58], { negotiation_leverage: "medium" }),
      senior: s([42, 65], [7, 14], RSU(15, 35), [55, 100], { negotiation_leverage: "high" }),
    },
    /* BFSI domestic UX (HDFC / ICICI / Axis / Kotak digital banking). */
    "bfsi-domestic": {
      entry: s([5, 9], [0.5, 1], NO_EQ, [6, 10], { negotiation_leverage: "low" }),
      mid: s([10, 18], [1, 2], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 4], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
    },
    /* Consulting (MBB design ops / digital design, McKinsey LUNAR,
       BCG Digital Design). */
    "consulting-mbb": {
      entry: s([18, 28], [3, 6], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
      mid: s([32, 50], [5, 10], NO_EQ, [38, 60], { negotiation_leverage: "medium" }),
      senior: s([50, 75], [8, 18], NO_EQ, [58, 95], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { negotiation_leverage: "low" }),
      mid: s([14, 24], [2, 4], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], NO_EQ, [27, 44], { negotiation_leverage: "medium" }),
    },
    /* EdTech UX. */
    edtech: {
      entry: s([5, 10], [0.5, 1], ESOP(0.5, 2), [6, 12], { negotiation_leverage: "low" }),
      mid: s([10, 18], [1, 2], ESOP(1, 3), [11, 21], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 4], ESOP(2, 6), [20, 36], { negotiation_leverage: "medium" }),
    },
    /* Startup early UX. */
    "startup-early": {
      entry: s([4, 9], [0, 1], ESOP(1, 3), [5, 12], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([10, 18], [0.5, 2], ESOP(2, 6), [12, 24], { negotiation_leverage: "high" }),
      senior: s([18, 32], [2, 4], ESOP(5, 14), [22, 45], { negotiation_leverage: "high" }),
    },
    /* FMCG (HUL / ITC consumer-experience design). */
    "fmcg-mnc": {
      entry: s([7, 12], [0.5, 1.5], NO_EQ, [8, 14], { negotiation_leverage: "low" }),
      mid: s([14, 24], [1.5, 3], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], NO_EQ, [27, 44], { negotiation_leverage: "medium" }),
    },
    /* Government / PSU UX (digital-India / NIC / UIDAI / GeM). */
    "government-psu": {
      entry: s([4, 7], [0, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 12], [0.5, 1], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 22], [1, 2], NO_EQ, [13, 24], { negotiation_leverage: "low" }),
    },
  },

  // ─── QA ENGINEER / SDET ───────────────────────────────────────
  "qa-engineer": {
    faang: {
      entry: s([18, 25], [1, 3], RSU(4, 8), [22, 35], { hot_skills: ["Automation", "Selenium/Playwright", "Performance Testing"] }),
      mid: s([28, 40], [3, 5], RSU(8, 15), [38, 58], {}),
      senior: s([40, 55], [5, 10], RSU(12, 25), [55, 85], {}),
    },
    "indian-unicorn": {
      entry: s([5, 7], [0.3, 0.5], ESOP(0.5, 1.5), [6, 9], {}),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], {}),
      senior: s([14, 22], [1.5, 3], ESOP(3, 6), [18, 30], {}),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5], { notes: "SDET/automation: 50-100% more than manual QA", negotiation_leverage: "low" }),
      mid: s([5, 8], [0.3, 0.5], NO_EQ, [5, 9], {}),
      senior: s([8, 14], [0.5, 1.5], NO_EQ, [9, 16], {}),
    },
    "startup-growth": {
      entry: s([4, 7], [0.3, 0.5], ESOP(0.5, 1.5), [5, 9], {}),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], {}),
      senior: s([14, 22], [1.5, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
    },
    /* Big Tech / GCC QA, leaner than SE bands. */
    "big-tech": {
      entry: s([14, 22], [1, 3], RSU(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      mid: s([24, 38], [3, 6], RSU(7, 16), [32, 55], { negotiation_leverage: "medium" }),
      senior: s([38, 55], [5, 10], RSU(15, 35), [50, 85], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([12, 18], [1, 2], RSU(1, 3), [14, 22], { negotiation_leverage: "low" }),
      mid: s([20, 30], [2, 4], RSU(4, 10), [25, 40], { negotiation_leverage: "medium" }),
      senior: s([30, 48], [3, 7], RSU(10, 22), [40, 70], { negotiation_leverage: "high" }),
    },
    /* SaaS-product QA. */
    "saas-product": {
      entry: s([5, 8], [0.3, 0.8], ESOP(0.5, 1.5), [6, 10], { negotiation_leverage: "low" }),
      mid: s([10, 16], [1, 2], ESOP(1, 3), [12, 20], { negotiation_leverage: "medium" }),
      senior: s([16, 28], [2, 4], ESOP(3, 6), [20, 35], { negotiation_leverage: "medium" }),
    },
    /* BFSI global QA (Goldman / JPMC engineering QA). */
    "bfsi-global": {
      entry: s([12, 18], [1, 3], RSU(2, 5), [14, 25], { negotiation_leverage: "medium" }),
      mid: s([20, 32], [2, 5], RSU(5, 12), [25, 45], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 9], RSU(10, 22), [42, 75], { negotiation_leverage: "high" }),
    },
    /* BFSI domestic QA (HDFC / ICICI / Axis tech QA). */
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([13, 22], [1, 3], NO_EQ, [14, 25], { negotiation_leverage: "medium" }),
    },
    /* EdTech QA. */
    edtech: {
      entry: s([3.5, 6], [0.2, 0.4], ESOP(0.3, 1), [4, 7], { negotiation_leverage: "low" }),
      mid: s([6, 11], [0.4, 1], ESOP(0.5, 2), [7, 13], { negotiation_leverage: "low" }),
      senior: s([11, 18], [1, 2], ESOP(1, 3), [12, 22], { negotiation_leverage: "medium" }),
    },
    /* FMCG MNC QA (HUL / ITC digital QA). */
    "fmcg-mnc": {
      entry: s([5, 9], [0.5, 1], NO_EQ, [6, 10], { negotiation_leverage: "low" }),
      mid: s([9, 15], [1, 2], NO_EQ, [10, 17], { negotiation_leverage: "medium" }),
      senior: s([15, 25], [2, 4], NO_EQ, [17, 30], { negotiation_leverage: "medium" }),
    },
    /* Consulting Big-4 QA (Deloitte USI / EY / KPMG / PwC tech). */
    "consulting-big4": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1.5], NO_EQ, [9, 16], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1.5, 3], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
    },
    /* Government / PSU QA. */
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 12], [0.3, 0.8], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.8, 1.5], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
    /* Startup early QA. */
    "startup-early": {
      entry: s([3, 6], [0.2, 0.5], ESOP(0.3, 1.5), [3.5, 7], { notice_period_days: 15, negotiation_leverage: "low" }),
      mid: s([6, 11], [0.5, 1], ESOP(1, 3), [7, 13], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([11, 18], [1, 2], ESOP(2, 6), [13, 22], { notice_period_days: 30, negotiation_leverage: "medium" }),
    },
  },

  // ─── HR ───────────────────────────────────────────────────────
  "hr": {
    faang: {
      entry: s([10, 16], [1, 2], RSU(2, 5), [12, 22], { hot_skills: ["Talent Acquisition", "HRBP", "People Analytics"] }),
      mid: s([18, 28], [2, 4], RSU(4, 10), [22, 40], {}),
      senior: s([28, 40], [4, 8], RSU(8, 18), [38, 62], {}),
      executive: s([50, 80], [10, 20], RSU(15, 40), [75, 130], { in_hand_ratio: 0.55 }),
    },
    "indian-unicorn": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], {}),
      mid: s([8, 14], [0.5, 1.5], ESOP(0.5, 2), [9, 17], {}),
      senior: s([14, 25], [1.5, 3], ESOP(2, 5), [17, 32], {}),
    },
    "it-services": {
      entry: s([2.5, 4], [0.1, 0.2], NO_EQ, [2.5, 4.5], { negotiation_leverage: "low" }),
      mid: s([5, 9], [0.3, 0.8], NO_EQ, [5, 10], {}),
      senior: s([10, 18], [0.8, 2], NO_EQ, [11, 20], {}),
      executive: s([25, 45], [3, 8], NO_EQ, [28, 55], { notes: "CHRO: ₹50-120 LPA at top companies" }),
    },
    "startup-growth": {
      entry: s([3, 5], [0.2, 0.4], ESOP(0.3, 0.8), [3.5, 6.5], {}),
      mid: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 13], {}),
      senior: s([10, 18], [1, 2], ESOP(2, 4), [12, 22], {}),
    },
    /* Big Tech HR (Adobe / Atlassian / Microsoft / Salesforce). */
    "big-tech": {
      entry: s([8, 14], [1, 2], RSU(2, 4), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [2, 4], RSU(4, 10), [18, 32], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [4, 8], RSU(8, 18), [32, 55], { negotiation_leverage: "high" }),
      executive: s([45, 70], [10, 18], RSU(15, 35), [65, 110], { in_hand_ratio: 0.55, negotiation_leverage: "high" }),
    },
    /* GCC HR. */
    gcc: {
      entry: s([6, 11], [0.5, 1.5], RSU(1, 3), [8, 14], { negotiation_leverage: "medium" }),
      mid: s([12, 20], [1.5, 3], RSU(3, 8), [15, 28], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [3, 6], RSU(6, 14), [25, 45], { negotiation_leverage: "high" }),
    },
    /* SaaS-product HR. */
    "saas-product": {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.3, 1), [4.5, 8], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 2.5), [9, 16], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1.5, 3], ESOP(2, 5), [16, 30], { negotiation_leverage: "medium" }),
    },
    /* FMCG MNC HR (HUL / ITC / Marico HRBP / TA). */
    "fmcg-mnc": {
      entry: s([6, 10], [0.5, 1.5], NO_EQ, [7, 12], { notes: "HUL / ITC HR MT track. Premium ₹15-22L for top schools (XLRI/TISS/MDI)." }),
      mid: s([10, 18], [1.5, 3], NO_EQ, [12, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 35], [3, 6], NO_EQ, [22, 40], { negotiation_leverage: "high" }),
      executive: s([45, 75], [8, 18], NO_EQ, [55, 100], { in_hand_ratio: 0.55, notes: "CHRO at top FMCG ₹1Cr+." }),
    },
    /* EdTech HR. */
    edtech: {
      entry: s([3, 5], [0.2, 0.4], ESOP(0.3, 1), [3.5, 6], { negotiation_leverage: "low" }),
      mid: s([5, 10], [0.4, 1], ESOP(0.5, 2), [6, 12], { negotiation_leverage: "low" }),
      senior: s([10, 18], [1, 2], ESOP(1, 4), [12, 22], { negotiation_leverage: "medium" }),
    },
    /* BFSI global HR (Goldman / JPMC India HR). */
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 30], [2, 5], RSU(5, 12), [22, 42], { negotiation_leverage: "medium" }),
      senior: s([30, 50], [5, 10], RSU(10, 22), [40, 75], { negotiation_leverage: "high" }),
    },
    /* BFSI domestic HR. */
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4.5, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([13, 22], [1, 3], NO_EQ, [15, 26], { negotiation_leverage: "medium" }),
    },
    /* Consulting MBB HR (talent / people ops). */
    "consulting-mbb": {
      entry: s([12, 18], [2, 4], NO_EQ, [14, 22], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [4, 8], NO_EQ, [26, 45], { negotiation_leverage: "medium" }),
      senior: s([38, 60], [7, 14], NO_EQ, [45, 78], { negotiation_leverage: "high" }),
    },
    /* Consulting Big-4 HR. */
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      mid: s([10, 17], [1, 3], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
    },
    /* Government / PSU HR. */
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notes: "7th CPC pay band; pension + DA + HRA add 30-40% on top." }),
      mid: s([7, 12], [0.3, 0.8], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.8, 1.5], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
    /* Startup early HR. */
    "startup-early": {
      entry: s([3, 5], [0.2, 0.5], ESOP(0.3, 1.5), [3.5, 6], { notice_period_days: 15, negotiation_leverage: "low" }),
      mid: s([5, 10], [0.4, 1], ESOP(1, 3), [6, 12], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([10, 18], [1, 2], ESOP(2, 6), [12, 22], { notice_period_days: 30, negotiation_leverage: "medium" }),
    },
  },

  // ─── MARKETING ────────────────────────────────────────────────
  "marketing": {
    faang: {
      entry: s([10, 15], [1, 2], RSU(2, 5), [12, 22], { hot_skills: ["Growth/PLG", "Data-driven", "Developer Marketing"] }),
      mid: s([18, 28], [2, 5], RSU(5, 10), [24, 42], {}),
      senior: s([28, 42], [4, 8], RSU(8, 18), [38, 65], {}),
    },
    "indian-unicorn": {
      entry: s([5, 8], [0.3, 0.8], ESOP(0.5, 1), [6, 10], { hot_skills: ["Performance Marketing", "Growth", "SEO/SEM"] }),
      mid: s([10, 16], [1, 2], ESOP(1, 3), [12, 20], {}),
      senior: s([16, 28], [2, 4], ESOP(3, 6), [20, 36], {}),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5], { negotiation_leverage: "low" }),
      mid: s([6, 10], [0.3, 0.8], NO_EQ, [6, 11], {}),
      senior: s([10, 20], [1, 2], NO_EQ, [11, 22], {}),
    },
    "fmcg-mnc": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { notes: "Brand Manager track" }),
      mid: s([8, 14], [1, 2], NO_EQ, [9, 16], {}),
      senior: s([15, 25], [2, 4], NO_EQ, [17, 30], {}),
      executive: s([30, 55], [5, 10], NO_EQ, [35, 65], {}),
    },
    "saas-product": {
      entry: s([5, 8], [0.3, 0.8], ESOP(0.5, 1.5), [6, 10], { hot_skills: ["PLG/Growth", "Content Marketing", "SEO/SEM", "Developer Evangelism"] }),
      mid: s([10, 18], [1, 3], ESOP(1, 3), [12, 22], {}),
      senior: s([18, 30], [2, 5], ESOP(3, 6), [22, 38], { negotiation_leverage: "high" }),
    },
    /* Big Tech Marketing. */
    "big-tech": {
      entry: s([12, 20], [2, 4], RSU(3, 7), [15, 28], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [3, 7], RSU(7, 16), [28, 52], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 12], RSU(15, 35), [48, 90], { negotiation_leverage: "high" }),
    },
    /* GCC Marketing. */
    gcc: {
      entry: s([8, 14], [1, 3], RSU(2, 5), [10, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 26], [2, 5], RSU(5, 12), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], RSU(10, 22), [38, 70], { negotiation_leverage: "high" }),
    },
    /* EdTech Marketing. */
    edtech: {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.3, 1), [4.5, 8], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1.5], ESOP(0.5, 2), [9, 16], { negotiation_leverage: "low" }),
      senior: s([14, 24], [1.5, 3], ESOP(1, 4), [16, 28], { negotiation_leverage: "medium" }),
    },
    /* BFSI global Marketing (Goldman / JPMC brand / India product mktg). */
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 30], [2, 5], RSU(5, 12), [22, 42], { negotiation_leverage: "medium" }),
      senior: s([30, 50], [5, 10], RSU(10, 22), [40, 78], { negotiation_leverage: "high" }),
    },
    /* BFSI domestic Marketing (HDFC / ICICI / Axis brand teams). */
    "bfsi-domestic": {
      entry: s([5, 9], [0.5, 1], NO_EQ, [6, 10], { negotiation_leverage: "low" }),
      mid: s([10, 18], [1, 2.5], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 32], [2, 5], NO_EQ, [20, 36], { negotiation_leverage: "medium" }),
    },
    /* Consulting MBB Marketing (rare, internal brand / GTM). */
    "consulting-mbb": {
      entry: s([12, 18], [2, 4], NO_EQ, [14, 22], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [4, 8], NO_EQ, [26, 45], { negotiation_leverage: "medium" }),
      senior: s([38, 60], [7, 14], NO_EQ, [45, 78], { negotiation_leverage: "high" }),
    },
    /* Consulting Big-4 Marketing. */
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      mid: s([10, 17], [1, 3], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
    },
    /* Government / PSU Marketing (DAVP / PIB / NPCI). */
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78, negotiation_leverage: "low" }),
      mid: s([7, 12], [0.3, 0.8], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.8, 1.5], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
    /* Startup early Marketing. */
    "startup-early": {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.5, 2), [4.5, 9], { notice_period_days: 15, negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], ESOP(1.5, 4), [9, 16], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([14, 25], [1.5, 3], ESOP(3, 8), [17, 32], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
  },

  // ─── SALES ────────────────────────────────────────────────────
  "sales": {
    faang: {
      entry: s([8, 12], [3, 6], RSU(2, 5), [12, 22], { notes: "Variable pay 30-50% of CTC" }),
      mid: s([15, 25], [8, 15], RSU(5, 10), [28, 48], {}),
      senior: s([25, 40], [15, 25], RSU(8, 18), [45, 78], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([3, 5], [1.5, 3], ESOP(0.5, 1), [5, 9], { notes: "SaaS sales: higher variable" }),
      mid: s([6, 12], [4, 8], ESOP(1, 3), [11, 22], {}),
      senior: s([12, 22], [8, 15], ESOP(3, 6), [22, 40], {}),
    },
    "it-services": {
      entry: s([2.5, 4], [1, 2], NO_EQ, [3.5, 6], { negotiation_leverage: "low" }),
      mid: s([4, 8], [2, 4], NO_EQ, [6, 12], {}),
      senior: s([8, 15], [4, 8], NO_EQ, [12, 22], {}),
    },
    "startup-growth": {
      entry: s([3, 5], [1.5, 3], ESOP(0.5, 1), [5, 9], { notes: "SaaS sales: higher variable" }),
      mid: s([6, 10], [4, 8], ESOP(1, 3), [11, 20], {}),
      senior: s([10, 18], [8, 14], ESOP(2, 5), [18, 35], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([4, 7], [2, 4], ESOP(0.5, 1.5), [6, 11], { hot_skills: ["Inbound", "PLG", "Outbound"], notes: "AE/SDR with quota; OTE 50/50 split common." }),
      mid: s([8, 14], [5, 10], ESOP(1.5, 4), [13, 24], { negotiation_leverage: "medium" }),
      senior: s([14, 26], [10, 20], ESOP(3, 8), [24, 46], { negotiation_leverage: "high" }),
      lead: s([22, 38], [16, 30], ESOP(6, 14), [38, 68], { notes: "VP Sales / Sales Director at SaaS." }),
    },
    "big-tech": {
      entry: s([10, 16], [4, 8], RSU(2, 6), [14, 30], { negotiation_leverage: "medium" }),
      mid: s([18, 28], [10, 18], RSU(6, 14), [34, 60], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [16, 28], RSU(12, 28), [56, 100], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([8, 13], [3, 6], RSU(2, 5), [13, 24], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [7, 14], RSU(4, 10), [25, 46], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [12, 22], RSU(8, 18), [42, 75], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [4, 8], RSU(2, 5), [14, 28], { notes: "GS / JPM / Citi institutional sales." }),
      mid: s([18, 30], [10, 20], RSU(5, 12), [33, 62], { negotiation_leverage: "medium" }),
      senior: s([32, 55], [20, 40], RSU(10, 25), [62, 120], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([3, 5], [1.5, 3], NO_EQ, [4.5, 8], { notes: "HDFC / ICICI / Axis RM / sales officer." }),
      mid: s([5, 10], [3, 7], NO_EQ, [8, 17], { negotiation_leverage: "medium" }),
      senior: s([10, 20], [6, 14], NO_EQ, [16, 34], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([6, 10], [1.5, 3], NO_EQ, [7.5, 13], { notes: "FMCG ASM / TSI / area sales track." }),
      mid: s([12, 20], [3, 7], NO_EQ, [15, 27], { negotiation_leverage: "medium" }),
      senior: s([22, 38], [6, 14], NO_EQ, [28, 52], { negotiation_leverage: "high" }),
      executive: s([45, 80], [15, 35], NO_EQ, [60, 115], { in_hand_ratio: 0.55, notes: "VP Sales / National Sales Head FMCG." }),
    },
    edtech: {
      entry: s([3, 5], [1, 2.5], ESOP(0.3, 1), [4, 7], { notes: "BDA / counselor track at edtech (high churn). 2024 reset." }),
      mid: s([5, 9], [2, 5], ESOP(0.5, 2), [7, 14], { negotiation_leverage: "low" }),
      senior: s([9, 16], [4, 9], ESOP(1, 3), [13, 25], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      entry: s([3, 5], [1.5, 3], ESOP(0.5, 2), [4.5, 8], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([6, 11], [3, 7], ESOP(1.5, 4), [9, 18], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([11, 20], [6, 12], ESOP(3, 8), [17, 32], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "consulting-mbb": {
      entry: s([14, 20], [3, 6], NO_EQ, [17, 26], { notes: "Strategy + sales hybrid (BD at MBB India)." }),
      mid: s([22, 35], [6, 12], NO_EQ, [28, 47], { negotiation_leverage: "medium" }),
      senior: s([38, 60], [12, 22], NO_EQ, [50, 82], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([5, 9], [2, 4], NO_EQ, [7, 13], { negotiation_leverage: "low" }),
      mid: s([10, 17], [3, 7], NO_EQ, [13, 24], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [6, 12], NO_EQ, [24, 42], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([4, 7], [0, 0.5], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notes: "PSU bank PO / LIC dev officer." }),
      mid: s([7, 12], [0.3, 0.8], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.8, 1.5], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
  },

  // ─── CONSULTANT ───────────────────────────────────────────────
  "consultant": {
    "consulting-mbb": {
      entry: s([14, 16], [2, 4], NO_EQ, [16, 20], { notice_period_days: 30, negotiation_leverage: "low", notes: "Associate (pre-MBA)" }),
      mid: s([20, 30], [5, 10], NO_EQ, [25, 40], { notes: "Consultant → Sr Consultant" }),
      senior: s([45, 65], [10, 20], NO_EQ, [55, 85], { notes: "Engagement Manager → Principal" }),
      executive: s([80, 150], [30, 60], NO_EQ, [120, 210], { in_hand_ratio: 0.50, notes: "Partner level" }),
    },
    "consulting-big4": {
      entry: s([11, 14], [1, 2], NO_EQ, [12, 16], { negotiation_leverage: "low" }),
      mid: s([14, 22], [2, 4], NO_EQ, [16, 26], {}),
      senior: s([22, 35], [4, 8], NO_EQ, [26, 45], { notes: "Manager level" }),
      lead: s([35, 55], [6, 12], NO_EQ, [42, 65], { notes: "Principal/Director" }),
      executive: s([55, 80], [12, 20], NO_EQ, [70, 100], { notes: "Partner" }),
    },
    "indian-unicorn": {
      entry: s([8, 14], [1, 2], ESOP(0.5, 2), [9, 16], { notes: "Internal strategy / corp dev at unicorns." }),
      mid: s([16, 26], [2, 5], ESOP(2, 5), [19, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], ESOP(5, 12), [33, 58], { negotiation_leverage: "high" }),
    },
    faang: {
      entry: s([18, 26], [3, 6], RSU(4, 10), [22, 38], { negotiation_leverage: "medium" }),
      mid: s([30, 45], [5, 10], RSU(10, 22), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([45, 65], [8, 16], RSU(20, 40), [60, 110], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([10, 16], [1, 2.5], ESOP(1, 3), [12, 20], { notes: "Solutions consultant / pre-sales at SaaS." }),
      mid: s([18, 28], [2, 5], ESOP(2, 5), [22, 36], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], ESOP(4, 10), [34, 58], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([12, 20], [1.5, 3], RSU(2, 5), [14, 26], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [3, 7], RSU(6, 14), [28, 50], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 11], RSU(12, 28), [45, 85], { negotiation_leverage: "high" }),
    },
    "fmcg-mnc": {
      entry: s([8, 13], [1, 2], NO_EQ, [9, 15], { notes: "Internal strategy / business analyst track." }),
      mid: s([14, 24], [2, 5], NO_EQ, [17, 30], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [4, 9], NO_EQ, [30, 50], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([5, 9], [0.5, 1], NO_EQ, [5.5, 10], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([10, 17], [1, 2], NO_EQ, [11, 19], { notice_period_days: 90 }),
      senior: s([18, 30], [2, 5], NO_EQ, [20, 35], { notice_period_days: 90 }),
    },
  },

  // ─── FINANCE / CA / IB ────────────────────────────────────────
  "finance": {
    "bfsi-global": {
      entry: s([15, 25], [3, 8], RSU(2, 5), [18, 35], { hot_skills: ["Quant Finance", "Risk Analytics", "Python"] }),
      mid: s([25, 40], [8, 15], RSU(5, 12), [35, 62], {}),
      senior: s([40, 65], [15, 25], RSU(10, 25), [60, 105], { notice_period_days: 90, negotiation_leverage: "medium" }),
      executive: s([65, 110], [30, 60], RSU(20, 50), [110, 200], { in_hand_ratio: 0.50, notes: "MD level at bulge bracket" }),
    },
    "bfsi-domestic": {
      entry: s([4, 8], [0.3, 1], NO_EQ, [4, 10], { negotiation_leverage: "low" }),
      mid: s([8, 18], [1, 3], NO_EQ, [10, 22], {}),
      senior: s([18, 35], [3, 6], NO_EQ, [22, 42], {}),
      executive: s([35, 55], [5, 12], NO_EQ, [40, 68], {}),
    },
    "consulting-big4": {
      entry: s([9, 14], [1, 2], NO_EQ, [10, 16], { notes: "CA at Big 4" }),
      mid: s([16, 28], [2, 5], NO_EQ, [18, 33], {}),
      senior: s([28, 45], [5, 10], NO_EQ, [33, 55], {}),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 13], {}),
      mid: s([12, 22], [1, 3], ESOP(2, 5), [14, 28], {}),
      senior: s([22, 38], [3, 6], ESOP(4, 10), [28, 50], {}),
    },
    /* Big Tech Finance (FP&A / Treasury / Strategic Finance, at
       Adobe / Salesforce / Atlassian / Microsoft non-FAANG India). */
    "big-tech": {
      entry: s([12, 18], [1.5, 3], RSU(3, 7), [14, 24], { negotiation_leverage: "medium" }),
      mid: s([20, 32], [3, 6], RSU(7, 16), [24, 42], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [5, 11], RSU(14, 32), [40, 75], { negotiation_leverage: "high" }),
      executive: s([50, 80], [10, 20], RSU(28, 60), [70, 130], { in_hand_ratio: 0.55, notes: "VP Finance / India CFO at large tech subsidiary." }),
    },
    /* GCC Finance. */
    gcc: {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 28], [2, 5], RSU(5, 12), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], RSU(10, 22), [35, 65], { negotiation_leverage: "high" }),
    },
    /* Consulting MBB Finance / strategic finance. */
    "consulting-mbb": {
      entry: s([18, 26], [3, 6], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
      mid: s([32, 50], [6, 12], NO_EQ, [38, 65], { negotiation_leverage: "medium" }),
      senior: s([50, 75], [10, 20], NO_EQ, [62, 95], { negotiation_leverage: "high" }),
    },
    /* SaaS-product Finance. */
    "saas-product": {
      entry: s([8, 14], [1, 2], ESOP(1, 2), [9, 16], { negotiation_leverage: "medium" }),
      mid: s([15, 24], [2, 4], ESOP(2, 5), [17, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 40], [3, 7], ESOP(4, 10), [28, 48], { negotiation_leverage: "high" }),
    },
    /* IT Services Finance. */
    "it-services": {
      entry: s([5, 9], [0.5, 1], NO_EQ, [5, 10], { negotiation_leverage: "low" }),
      mid: s([10, 16], [1, 2], NO_EQ, [11, 18], { negotiation_leverage: "low" }),
      senior: s([16, 28], [2, 4], NO_EQ, [18, 32], { negotiation_leverage: "medium" }),
    },
    /* Government / PSU Finance (RBI / SEBI / NABARD / SIDBI / EXIM /
       NPCI). 7th CPC fixed but pension is the off-ledger value. */
    "government-psu": {
      entry: s([7, 11], [0, 0.5], NO_EQ, [7, 12], { negotiation_leverage: "low", notes: "RBI Grade B / SEBI Grade A entry. Pension actuarially worth ₹50-100L." }),
      mid: s([12, 20], [0.5, 1], NO_EQ, [12, 22], { negotiation_leverage: "low" }),
      senior: s([20, 35], [1, 2], NO_EQ, [22, 38], { negotiation_leverage: "low" }),
    },
    /* FMCG MNC Finance (HUL / ITC / Nestle / P&G FP&A and treasury). */
    "fmcg-mnc": {
      entry: s([10, 16], [1.5, 3], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      mid: s([18, 28], [2.5, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], NO_EQ, [32, 52], { negotiation_leverage: "medium" }),
    },
    edtech: {
      entry: s([5, 8], [0.3, 0.7], ESOP(0.5, 1.5), [5.5, 9], { negotiation_leverage: "low" }),
      mid: s([9, 15], [0.5, 1.5], ESOP(1, 3), [10, 17], { negotiation_leverage: "low" }),
      senior: s([15, 25], [1.5, 3], ESOP(1.5, 4), [17, 28], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      entry: s([5, 9], [0.3, 0.7], ESOP(0.5, 2), [6, 11], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([10, 17], [0.5, 1.5], ESOP(1.5, 4), [11, 20], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([18, 30], [1.5, 3], ESOP(3, 8), [20, 36], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 12], { negotiation_leverage: "medium" }),
      mid: s([12, 20], [1, 2.5], ESOP(2, 5), [14, 24], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2, 5], ESOP(4, 10), [26, 45], { negotiation_leverage: "high" }),
    },
  },

  // ─── BUSINESS ANALYST ─────────────────────────────────────────
  "business-analyst": {
    faang: {
      entry: s([12, 18], [1, 2], RSU(3, 6), [15, 25], {}),
      mid: s([20, 30], [2, 4], RSU(5, 10), [26, 42], {}),
      senior: s([30, 42], [4, 8], RSU(8, 15), [40, 60], {}),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.3, 1], ESOP(0.5, 2), [7, 13], {}),
      mid: s([12, 20], [1, 2], ESOP(2, 4), [14, 25], {}),
      senior: s([18, 30], [2, 4], ESOP(3, 6), [22, 38], {}),
    },
    "it-services": {
      entry: s([4, 6], [0.2, 0.4], NO_EQ, [4, 7], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [8, 15], {}),
      senior: s([14, 22], [1, 2], NO_EQ, [15, 25], {}),
    },
    "consulting-mbb": {
      entry: s([8, 12], [1, 2], NO_EQ, [9, 14], {}),
      mid: s([15, 22], [2, 4], NO_EQ, [17, 26], {}),
      senior: s([22, 35], [4, 6], NO_EQ, [26, 40], {}),
    },
    "consulting-big4": {
      entry: s([6, 10], [0.5, 1.2], NO_EQ, [7, 12], { negotiation_leverage: "low" }),
      mid: s([11, 18], [1, 2.5], NO_EQ, [12, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], NO_EQ, [20, 34], { negotiation_leverage: "medium" }),
    },
    "big-tech": {
      entry: s([10, 16], [1, 2], RSU(2, 5), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 28], [2, 5], RSU(5, 12), [22, 40], { negotiation_leverage: "medium" }),
      senior: s([28, 42], [4, 9], RSU(10, 22), [35, 60], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([8, 13], [0.5, 1.5], RSU(1, 3), [9, 16], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1.5, 3], RSU(3, 7), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], RSU(6, 14), [26, 45], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], { negotiation_leverage: "medium" }),
      mid: s([10, 16], [1, 2], ESOP(1, 3), [11, 18], { negotiation_leverage: "medium" }),
      senior: s([16, 25], [2, 4], ESOP(2, 5), [18, 30], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { notes: "Goldman / JPMC / Citi BA / domain consultant." }),
      mid: s([18, 28], [2, 5], RSU(5, 12), [22, 40], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], RSU(10, 22), [35, 65], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1, 3], NO_EQ, [15, 26], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([6, 10], [0.5, 1], NO_EQ, [7, 12], { negotiation_leverage: "low" }),
      mid: s([10, 18], [1, 2.5], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([5, 8], [0.3, 0.6], ESOP(0.5, 1.5), [5.5, 9], { negotiation_leverage: "medium" }),
      mid: s([9, 15], [0.5, 1.5], ESOP(1, 3), [10, 17], { negotiation_leverage: "medium" }),
      senior: s([15, 25], [1.5, 3], ESOP(2, 6), [17, 30], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([4, 7], [0.2, 0.5], ESOP(0.5, 2), [4.5, 8], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([7, 12], [0.4, 1], ESOP(1, 3), [8, 14], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([12, 20], [1, 2.5], ESOP(2, 6), [14, 24], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
  },

  // ─── PROGRAM / PROJECT MANAGER ────────────────────────────────
  "program-manager": {
    faang: {
      entry: s([15, 22], [1, 3], RSU(4, 8), [20, 32], { hot_skills: ["Technical PM", "Cross-functional", "Data-driven"] }),
      mid: s([25, 38], [3, 6], RSU(8, 15), [35, 55], {}),
      senior: s([40, 60], [6, 12], RSU(15, 30), [58, 95], {}),
    },
    "indian-unicorn": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 2), [10, 17], {}),
      mid: s([15, 22], [1.5, 3], ESOP(2, 5), [18, 28], {}),
      senior: s([22, 35], [3, 5], ESOP(4, 8), [28, 45], {}),
    },
    "it-services": {
      entry: s([5, 8], [0.3, 0.5], NO_EQ, [5, 9], { notice_period_days: 90 }),
      mid: s([10, 16], [0.5, 1.5], NO_EQ, [10, 18], {}),
      senior: s([16, 28], [1, 3], NO_EQ, [18, 32], {}),
    },
    "big-tech": {
      entry: s([14, 20], [1.5, 3], RSU(3, 7), [16, 28], { negotiation_leverage: "medium" }),
      mid: s([22, 35], [3, 6], RSU(8, 18), [28, 50], { negotiation_leverage: "medium" }),
      senior: s([38, 55], [5, 11], RSU(15, 32), [50, 85], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([12, 18], [1, 3], RSU(2, 5), [14, 24], { negotiation_leverage: "medium" }),
      mid: s([20, 32], [2, 5], RSU(6, 14), [25, 45], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 9], RSU(12, 25), [42, 75], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2.5, 6], ESOP(4, 10), [26, 48], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([12, 18], [1, 3], RSU(2, 6), [14, 25], { negotiation_leverage: "medium" }),
      mid: s([20, 32], [2, 5], RSU(6, 12), [24, 42], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 9], RSU(10, 22), [40, 70], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([7, 11], [0.5, 1.2], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      mid: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2, 5], NO_EQ, [24, 40], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([6, 11], [0.5, 1], ESOP(1, 3), [7, 13], { negotiation_leverage: "medium" }),
      mid: s([12, 20], [1, 2.5], ESOP(2, 5), [14, 24], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], ESOP(4, 10), [24, 42], { negotiation_leverage: "high" }),
    },
  },
  /* Project manager (delivery PM, distinct from technical Program PM).
     Heavier weighting on IT-services / consulting / BFSI; less premium
     than program-manager at FAANG. */
  "project-manager": {
    faang: {
      entry: s([12, 18], [1, 2], RSU(3, 6), [15, 26], {}),
      mid: s([20, 30], [2, 4], RSU(6, 12), [26, 45], {}),
      senior: s([32, 48], [4, 9], RSU(12, 24), [45, 80], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([7, 11], [0.5, 1], ESOP(0.5, 1.5), [8, 13], { negotiation_leverage: "low" }),
      mid: s([12, 20], [1, 2.5], ESOP(1.5, 4), [14, 24], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 4], ESOP(3, 7), [24, 42], { negotiation_leverage: "medium" }),
    },
    "it-services": {
      entry: s([5, 8], [0.3, 0.6], NO_EQ, [5, 9], { notice_period_days: 90, notes: "PMP / Prince2: +15-20%." }),
      mid: s([9, 16], [0.5, 1.5], NO_EQ, [10, 18], { notice_period_days: 90 }),
      senior: s([16, 28], [1, 3], NO_EQ, [18, 32], { notice_period_days: 90 }),
    },
    "consulting-big4": {
      entry: s([6, 10], [0.5, 1.2], NO_EQ, [7, 12], { negotiation_leverage: "low" }),
      mid: s([11, 18], [1, 3], NO_EQ, [12, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [3, 6], NO_EQ, [22, 38], { negotiation_leverage: "medium" }),
    },
    "bfsi-domestic": {
      entry: s([6, 10], [0.5, 1], NO_EQ, [7, 12], { negotiation_leverage: "low" }),
      mid: s([11, 18], [1, 2.5], NO_EQ, [12, 22], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 4], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
    },
  },

  // ─── CONTENT WRITER / TECHNICAL WRITER ────────────────────────
  "content-writer": {
    "indian-unicorn": {
      entry: s([3.5, 5], [0.2, 0.4], NO_EQ, [3.5, 5.5], { hot_skills: ["SEO", "UX Writing", "Technical Writing"] }),
      mid: s([5, 8], [0.3, 0.8], ESOP(0.5, 1), [5.5, 9], {}),
      senior: s([8, 14], [0.8, 1.5], ESOP(1, 2), [9, 16], {}),
    },
    faang: {
      entry: s([8, 12], [0.5, 1], RSU(2, 4), [10, 16], { notes: "UX Writer: higher pay (₹14-20 LPA mid)" }),
      mid: s([14, 20], [1, 2], RSU(3, 6), [17, 26], {}),
      senior: s([20, 28], [2, 4], RSU(5, 10), [25, 38], {}),
    },
    "it-services": {
      entry: s([2, 3.5], [0.1, 0.2], NO_EQ, [2, 4], { negotiation_leverage: "low" }),
      mid: s([4, 6], [0.2, 0.5], NO_EQ, [4, 7], {}),
      senior: s([6, 10], [0.5, 1], NO_EQ, [7, 12], {}),
    },
    "startup-growth": {
      entry: s([3, 5], [0.1, 0.3], ESOP(0.3, 0.8), [3.5, 6], {}),
      mid: s([5, 9], [0.3, 0.8], ESOP(0.5, 1.5), [6, 11], {}),
      senior: s([9, 15], [0.8, 1.5], ESOP(1, 3), [10, 18], {}),
    },
    "saas-product": {
      entry: s([5, 8], [0.3, 0.6], ESOP(0.5, 1.5), [6, 10], { hot_skills: ["Developer Docs", "API Documentation", "DevRel content"] }),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 3), [9, 17], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1, 3], ESOP(2, 5), [16, 30], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([7, 11], [0.5, 1], RSU(1.5, 3.5), [9, 14], { negotiation_leverage: "medium" }),
      mid: s([12, 18], [1, 2.5], RSU(3, 7), [15, 25], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], RSU(5, 11), [22, 38], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([6, 10], [0.5, 1], RSU(1, 3), [7, 13], { negotiation_leverage: "medium" }),
      mid: s([10, 16], [1, 2], RSU(2, 5), [12, 20], { negotiation_leverage: "medium" }),
      senior: s([16, 26], [1.5, 3], RSU(4, 9), [19, 32], { negotiation_leverage: "high" }),
    },
    "fmcg-mnc": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4.5, 8], { notes: "Internal communications / annual reports / corporate writing." }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1, 3], NO_EQ, [14, 25], { negotiation_leverage: "medium" }),
    },
    "bfsi-global": {
      entry: s([6, 10], [0.5, 1.5], RSU(1, 3), [7, 13], { notes: "Equity research / investor communications / financial writing." }),
      mid: s([10, 18], [1, 3], RSU(2, 6), [12, 24], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], RSU(5, 12), [22, 40], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([3, 5], [0.2, 0.4], NO_EQ, [3.5, 6], { negotiation_leverage: "low" }),
      mid: s([5, 9], [0.3, 0.8], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      senior: s([9, 15], [0.5, 1.5], NO_EQ, [10, 17], { negotiation_leverage: "medium" }),
    },
    edtech: {
      entry: s([3, 5], [0.2, 0.4], ESOP(0.3, 1), [3.5, 6], { negotiation_leverage: "low", notes: "Curriculum writer / content developer at Byju's / Vedantu / PW." }),
      mid: s([5, 9], [0.3, 0.8], ESOP(0.5, 1.5), [6, 11], { negotiation_leverage: "low" }),
      senior: s([9, 15], [0.5, 1.5], ESOP(1, 3), [10, 17], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      entry: s([3, 5], [0.2, 0.4], ESOP(0.3, 1.5), [3.5, 7], { notice_period_days: 15, negotiation_leverage: "low" }),
      mid: s([5, 9], [0.3, 0.8], ESOP(1, 3), [6, 12], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([9, 16], [0.5, 1.5], ESOP(2, 5), [11, 22], { notice_period_days: 30, negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      entry: s([10, 14], [1.5, 3], NO_EQ, [12, 18], { notes: "Knowledge specialist / IP writer at MBB." }),
      mid: s([16, 24], [3, 6], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [6, 12], NO_EQ, [32, 55], { negotiation_leverage: "medium" }),
    },
    "consulting-big4": {
      entry: s([4, 7], [0.3, 0.7], NO_EQ, [5, 9], { negotiation_leverage: "low" }),
      mid: s([8, 13], [0.5, 1.5], NO_EQ, [9, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1, 3], NO_EQ, [15, 26], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([3, 5], [0, 0.3], NO_EQ, [3, 5.5], { in_hand_ratio: 0.78, notes: "Press info / DAVP / corporate-comms PSU." }),
      mid: s([5, 9], [0.3, 0.6], NO_EQ, [5, 10], { negotiation_leverage: "low" }),
      senior: s([9, 15], [0.5, 1], NO_EQ, [10, 17], { negotiation_leverage: "low" }),
    },
  },

  // ─── CYBERSECURITY ────────────────────────────────────────────
  "cybersecurity": {
    faang: {
      entry: s([18, 25], [1, 3], RSU(4, 8), [22, 35], { hot_skills: ["Penetration Testing", "Cloud Security", "SIEM"] }),
      mid: s([28, 40], [3, 6], RSU(8, 15), [38, 58], {}),
      senior: s([40, 58], [6, 12], RSU(12, 25), [55, 90], {}),
      executive: s([55, 80], [10, 20], RSU(18, 35), [80, 130], { notes: "CISO level" }),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.3, 0.8], ESOP(0.5, 1.5), [7, 12], {}),
      mid: s([10, 16], [0.8, 2], ESOP(1, 3), [12, 20], {}),
      senior: s([16, 28], [2, 4], ESOP(3, 6), [20, 36], { notes: "BFSI: +15-25% premium" }),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.4], NO_EQ, [4, 8], {}),
      mid: s([7, 13], [0.4, 1], NO_EQ, [8, 14], {}),
      senior: s([12, 22], [1, 2], NO_EQ, [13, 25], {}),
    },
    "bfsi-global": {
      entry: s([12, 18], [1, 3], RSU(2, 5), [14, 25], { notes: "BFSI pays 15-25% premium for security" }),
      mid: s([20, 32], [3, 6], RSU(5, 10), [26, 45], {}),
      senior: s([32, 50], [6, 12], RSU(8, 20), [42, 75], {}),
    },
    "government-psu": {
      entry: s([5, 8], [0, 0.5], NO_EQ, [5, 9], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "CERT-In / NIC / DRDO cyber. 7th CPC Level 7-8 (₹44,900-1,42,400 basic)" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [9, 15], { negotiation_leverage: "low" }),
      senior: s([14, 22], [1, 2], NO_EQ, [15, 24], { notes: "Group A gazetted officer level" }),
    },
    "big-tech": {
      entry: s([16, 26], [2, 4], RSU(3, 7), [20, 36], { negotiation_leverage: "medium" }),
      mid: s([28, 42], [4, 8], RSU(8, 18), [36, 62], { negotiation_leverage: "medium" }),
      senior: s([42, 65], [7, 14], RSU(18, 38), [55, 100], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([14, 22], [1, 3], RSU(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      mid: s([24, 38], [3, 6], RSU(6, 14), [30, 52], { negotiation_leverage: "medium" }),
      senior: s([38, 58], [5, 11], RSU(14, 30), [48, 85], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([10, 18], [1, 2], ESOP(1, 3), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 30], [2, 4], ESOP(3, 7), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([30, 48], [3, 7], ESOP(5, 12), [36, 60], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { negotiation_leverage: "low" }),
      mid: s([14, 24], [2, 4], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], NO_EQ, [27, 44], { notes: "RBI / SEBI / private bank CISO+. RBI cybersecurity directives drive premium." }),
    },
    "startup-growth": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [9, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1, 3], ESOP(2, 5), [16, 30], { negotiation_leverage: "high" }),
      senior: s([24, 40], [3, 6], ESOP(5, 12), [28, 50], { negotiation_leverage: "high" }),
    },
    "fmcg-mnc": {
      entry: s([7, 12], [0.5, 1.5], NO_EQ, [8, 14], { negotiation_leverage: "low" }),
      mid: s([12, 22], [1.5, 3], NO_EQ, [14, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 38], [3, 6], NO_EQ, [25, 44], { negotiation_leverage: "medium" }),
    },
    "consulting-big4": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { negotiation_leverage: "low" }),
      mid: s([15, 24], [2, 4], NO_EQ, [17, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 40], [3, 6], NO_EQ, [27, 46], { negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      entry: s([18, 26], [3, 6], NO_EQ, [22, 35], { notes: "MBB cyber-strategy / risk practice." }),
      mid: s([32, 50], [6, 12], NO_EQ, [40, 65], { negotiation_leverage: "medium" }),
      senior: s([55, 85], [12, 22], NO_EQ, [68, 110], { negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 12], { negotiation_leverage: "low" }),
      mid: s([10, 16], [1, 2], ESOP(1, 3), [12, 18], { negotiation_leverage: "low" }),
      senior: s([16, 26], [2, 4], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      entry: s([6, 10], [0.3, 0.8], ESOP(1, 3), [7, 13], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([10, 18], [1, 2.5], ESOP(2, 6), [12, 22], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], ESOP(4, 10), [22, 40], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
  },

  // ─── BLOCKCHAIN / WEB3 ────────────────────────────────────────
  "blockchain": {
    faang: {
      entry: s([22, 32], [2, 4], RSU(6, 12), [28, 45], { hot_skills: ["Solidity", "Rust", "ZK proofs", "L2"] }),
      mid: s([35, 48], [4, 8], RSU(12, 25), [48, 78], {}),
      senior: s([48, 65], [8, 15], RSU(20, 40), [72, 115], {}),
    },
    "indian-unicorn": {
      entry: s([5, 8], [0.3, 0.5], ESOP(1, 3), [6, 12], { hot_skills: ["Solidity", "Smart Contracts", "DApp", "Rust"] }),
      mid: s([10, 18], [1, 2], ESOP(2, 5), [12, 24], {}),
      senior: s([18, 35], [2, 5], ESOP(5, 12), [24, 48], {}),
    },
    "startup-growth": {
      entry: s([4, 8], [0.3, 1], ESOP(1, 4), [5, 12], { notes: "Blockchain fresher: 30-40% above regular SDE" }),
      mid: s([8, 16], [1, 2], ESOP(3, 8), [12, 25], {}),
      senior: s([16, 30], [2, 5], ESOP(5, 15), [22, 45], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([5, 10], [0.3, 1], ESOP(2, 6), [6, 14], { notice_period_days: 15, negotiation_leverage: "medium", notes: "Web3 / DeFi / NFT studios. Token grants common." }),
      mid: s([10, 18], [0.8, 2], ESOP(4, 12), [12, 28], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([20, 38], [2, 6], ESOP(8, 22), [25, 55], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([16, 24], [1.5, 3], RSU(4, 8), [20, 32], { negotiation_leverage: "medium" }),
      mid: s([26, 38], [3, 6], RSU(8, 18), [34, 55], { negotiation_leverage: "medium" }),
      senior: s([38, 55], [5, 11], RSU(15, 32), [50, 85], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([7, 12], [0.5, 1.5], ESOP(1, 3), [8, 15], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1, 3], ESOP(3, 7), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2, 5], ESOP(5, 12), [26, 45], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([15, 22], [1.5, 3], RSU(3, 7), [18, 30], { notes: "GS / JPMC / Citi blockchain / digital-assets desk." }),
      mid: s([24, 38], [3, 7], RSU(8, 18), [30, 52], { negotiation_leverage: "medium" }),
      senior: s([38, 60], [6, 13], RSU(16, 35), [50, 95], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4, 8], { notice_period_days: 90, negotiation_leverage: "low", notes: "TCS Quartz / Infosys Finacle blockchain practice." }),
      mid: s([7, 13], [0.4, 1], NO_EQ, [8, 14], { notice_period_days: 90 }),
      senior: s([13, 22], [1, 2.5], NO_EQ, [14, 25], { notice_period_days: 90 }),
    },
  },

  // ─── LEGAL / COMPLIANCE ───────────────────────────────────────
  "legal": {
    faang: {
      entry: s([10, 16], [1, 2], RSU(2, 5), [12, 22], { hot_skills: ["Data Privacy", "IP Law", "Compliance"] }),
      mid: s([18, 28], [2, 5], RSU(5, 10), [24, 40], {}),
      senior: s([28, 45], [5, 10], RSU(8, 18), [38, 68], {}),
      executive: s([50, 80], [10, 25], RSU(15, 40), [70, 140], { notes: "General Counsel: ₹50-200 LPA at MNCs" }),
    },
    "indian-unicorn": {
      entry: s([5, 8], [0.3, 0.5], ESOP(0.5, 1), [6, 10], {}),
      mid: s([10, 18], [0.8, 2], ESOP(1, 3), [12, 22], {}),
      senior: s([18, 32], [2, 4], ESOP(3, 6), [22, 40], {}),
    },
    "bfsi-global": {
      entry: s([10, 18], [1, 3], NO_EQ, [12, 22], { notes: "Compliance/regulatory roles: premium" }),
      mid: s([18, 30], [3, 6], NO_EQ, [22, 38], {}),
      senior: s([30, 50], [6, 12], NO_EQ, [38, 65], {}),
    },
    "bfsi-domestic": {
      entry: s([5, 8], [0.3, 0.5], NO_EQ, [5, 9], { notes: "Compliance officer / legal analyst at Indian banks" }),
      mid: s([10, 18], [0.8, 2], NO_EQ, [11, 20], {}),
      senior: s([18, 30], [2, 4], NO_EQ, [20, 35], { notes: "RBI/SEBI regulatory expertise: +20% premium" }),
    },
    "big-tech": {
      entry: s([8, 14], [1, 2], RSU(2, 5), [10, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 25], [2, 4], RSU(5, 12), [20, 35], { negotiation_leverage: "medium" }),
      senior: s([25, 40], [4, 9], RSU(10, 22), [32, 60], { negotiation_leverage: "high" }),
      executive: s([45, 75], [10, 20], RSU(15, 35), [65, 130], { in_hand_ratio: 0.55 }),
    },
    gcc: {
      entry: s([7, 12], [0.5, 1.5], RSU(2, 4), [8, 16], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1.5, 3], RSU(4, 10), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], RSU(8, 18), [27, 48], { negotiation_leverage: "high" }),
    },
    "consulting-mbb": {
      entry: s([16, 24], [3, 6], NO_EQ, [20, 32], { negotiation_leverage: "medium", notes: "AZB / Trilegal / MBB legal advisory" }),
      mid: s([28, 45], [5, 10], NO_EQ, [34, 58], { negotiation_leverage: "medium" }),
      senior: s([48, 75], [9, 18], NO_EQ, [58, 95], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([6, 11], [1, 2], NO_EQ, [7, 13], { negotiation_leverage: "low" }),
      mid: s([12, 20], [1.5, 3], NO_EQ, [14, 23], { negotiation_leverage: "medium" }),
      senior: s([20, 35], [3, 6], NO_EQ, [22, 40], { negotiation_leverage: "medium" }),
    },
    "saas-product": {
      entry: s([7, 12], [0.5, 1.5], ESOP(0.5, 2), [8, 14], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1.5, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], ESOP(4, 10), [28, 45], { negotiation_leverage: "high" }),
    },
    "fmcg-mnc": {
      entry: s([8, 14], [1, 2], NO_EQ, [9, 16], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1.5, 3], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 7], NO_EQ, [30, 50], { negotiation_leverage: "high" }),
    },
    /* Govt / PSU legal (Govt Counsel / regulatory), 7th CPC. */
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      mid: s([10, 18], [0.5, 1], NO_EQ, [11, 19], { negotiation_leverage: "low" }),
      senior: s([18, 30], [1, 2], NO_EQ, [19, 32], { negotiation_leverage: "low", notes: "Joint Secretary Legal / DRT / RBI legal." }),
    },
    edtech: {
      entry: s([5, 9], [0.3, 0.8], ESOP(0.5, 1.5), [5.5, 10], { negotiation_leverage: "low" }),
      mid: s([9, 15], [0.5, 1.5], ESOP(1, 3), [10, 17], { negotiation_leverage: "low" }),
      senior: s([15, 24], [1, 3], ESOP(2, 5), [17, 28], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      entry: s([5, 9], [0.3, 0.7], ESOP(1, 3), [6, 11], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([9, 15], [0.5, 1.5], ESOP(2, 5), [10, 18], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([16, 26], [1.5, 3], ESOP(4, 10), [19, 35], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([6, 10], [0.5, 1], ESOP(1, 3), [7, 12], { negotiation_leverage: "medium" }),
      mid: s([10, 17], [1, 2.5], ESOP(2, 5), [12, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], ESOP(4, 10), [22, 38], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { notice_period_days: 90 }),
      senior: s([13, 22], [1, 3], NO_EQ, [15, 26], { notice_period_days: 90 }),
    },
  },

  // ─── OPERATIONS / SUPPLY CHAIN ────────────────────────────────
  "operations": {
    "indian-unicorn": {
      entry: s([6, 10], [0.3, 1], ESOP(0.5, 1.5), [7, 12], { hot_skills: ["Logistics", "Last-mile", "Warehouse Ops"] }),
      mid: s([14, 22], [1, 3], ESOP(1.5, 4), [16, 28], {}),
      senior: s([22, 32], [3, 5], ESOP(3, 6), [26, 40], {}),
    },
    faang: {
      entry: s([10, 15], [1, 2], RSU(2, 4), [12, 20], {}),
      mid: s([18, 28], [2, 4], RSU(4, 8), [22, 38], {}),
      senior: s([28, 40], [4, 8], RSU(6, 14), [36, 58], {}),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.4], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([8, 15], [0.5, 1.5], NO_EQ, [9, 17], {}),
      senior: s([15, 25], [1, 3], NO_EQ, [16, 28], {}),
    },
    "fmcg-mnc": {
      entry: s([4, 8], [0.3, 0.5], NO_EQ, [4, 9], { notes: "Supply chain / FMCG ops" }),
      mid: s([10, 18], [1, 2], NO_EQ, [11, 20], {}),
      senior: s([18, 28], [2, 4], NO_EQ, [20, 32], {}),
      executive: s([35, 60], [5, 12], NO_EQ, [42, 78], { in_hand_ratio: 0.55, notes: "VP Operations / COO at top FMCG." }),
    },
    "startup-growth": {
      entry: s([5, 9], [0.3, 0.6], ESOP(0.5, 1.5), [5.5, 11], { negotiation_leverage: "medium" }),
      mid: s([10, 18], [0.5, 1.5], ESOP(1, 3), [11, 22], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [1.5, 3], ESOP(3, 7), [20, 36], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([4, 7], [0.2, 0.5], ESOP(0.5, 2), [4.5, 9], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([7, 12], [0.4, 1], ESOP(1.5, 4), [8, 16], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([12, 20], [1, 2.5], ESOP(3, 8), [14, 28], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([4, 7], [0.2, 0.5], ESOP(0.3, 1), [4.5, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1], ESOP(0.5, 2), [8, 14], { negotiation_leverage: "low" }),
      senior: s([13, 22], [1, 2.5], ESOP(1.5, 4), [14, 26], { negotiation_leverage: "medium" }),
    },
    "saas-product": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], { negotiation_leverage: "medium" }),
      mid: s([10, 17], [1, 2], ESOP(1, 3), [12, 19], { negotiation_leverage: "medium" }),
      senior: s([17, 27], [2, 4], ESOP(2, 6), [19, 32], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([8, 14], [1, 2], RSU(2, 5), [10, 20], { negotiation_leverage: "medium" }),
      mid: s([15, 24], [2, 5], RSU(4, 10), [18, 35], { negotiation_leverage: "medium" }),
      senior: s([25, 38], [4, 8], RSU(8, 18), [30, 55], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([7, 12], [0.5, 1.5], RSU(1, 3), [8, 14], { negotiation_leverage: "medium" }),
      mid: s([12, 20], [1, 3], RSU(3, 7), [14, 26], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], RSU(6, 14), [24, 42], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { notes: "Goldman / JPMC / Citi India ops." }),
      mid: s([18, 28], [2, 5], RSU(5, 12), [22, 42], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 9], RSU(10, 22), [35, 65], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([13, 22], [1, 3], NO_EQ, [15, 26], { negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      entry: s([14, 18], [2, 4], NO_EQ, [16, 22], { notes: "Ops practice MBB associate." }),
      mid: s([22, 32], [4, 8], NO_EQ, [26, 42], { negotiation_leverage: "medium" }),
      senior: s([38, 58], [8, 15], NO_EQ, [48, 78], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 10], { negotiation_leverage: "low" }),
      mid: s([9, 16], [1, 2.5], NO_EQ, [10, 18], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78 }),
      mid: s([7, 12], [0.3, 0.6], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.6, 1.2], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
  },

  // ─── CUSTOMER SUCCESS ─────────────────────────────────────────
  "customer-success": {
    "indian-unicorn": {
      entry: s([5, 7], [0.3, 0.5], ESOP(0.5, 1), [6, 9], {}),
      mid: s([10, 14], [0.8, 1.5], ESOP(1, 2), [11, 17], {}),
      senior: s([14, 25], [1.5, 3], ESOP(2, 5), [17, 32], {}),
      lead: s([22, 38], [3, 5], ESOP(3, 8), [28, 48], { notes: "Head of CS" }),
    },
    faang: {
      entry: s([10, 15], [1, 2], RSU(2, 4), [12, 20], {}),
      mid: s([18, 25], [2, 4], RSU(4, 8), [22, 35], {}),
      senior: s([25, 38], [4, 8], RSU(6, 14), [33, 55], {}),
    },
    "saas-product": {
      entry: s([5, 8], [0.3, 0.8], ESOP(0.5, 1.5), [6, 10], {}),
      mid: s([10, 15], [1, 2], ESOP(1, 3), [12, 20], {}),
      senior: s([15, 25], [2, 3], ESOP(3, 5), [20, 32], {}),
    },
    "big-tech": {
      entry: s([10, 16], [1, 2.5], RSU(2, 5), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 28], [2, 5], RSU(5, 12), [22, 40], { negotiation_leverage: "medium" }),
      senior: s([28, 42], [4, 9], RSU(10, 22), [35, 60], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([8, 13], [0.5, 1.5], RSU(1, 3), [9, 16], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1.5, 3], RSU(3, 7), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], RSU(6, 14), [26, 45], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3, 5], [0.2, 0.4], NO_EQ, [3, 5.5], { negotiation_leverage: "low" }),
      mid: s([5, 9], [0.3, 0.8], NO_EQ, [5, 10], { negotiation_leverage: "low" }),
      senior: s([10, 18], [0.8, 1.5], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([4, 7], [0.3, 0.5], ESOP(0.5, 1.5), [4.5, 9], { negotiation_leverage: "medium" }),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 3), [9, 16], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1.5, 3], ESOP(3, 6), [16, 28], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([3.5, 6], [0.2, 0.5], ESOP(0.5, 2), [4, 8], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([6, 11], [0.4, 1], ESOP(1, 3), [7, 14], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([12, 20], [1, 2.5], ESOP(2, 6), [14, 26], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    edtech: {
      entry: s([3, 5], [0.2, 0.4], ESOP(0.3, 1), [3.5, 6], { negotiation_leverage: "low" }),
      mid: s([5, 9], [0.3, 0.8], ESOP(0.5, 2), [6, 11], { negotiation_leverage: "low" }),
      senior: s([10, 18], [1, 2], ESOP(1, 3), [11, 20], { negotiation_leverage: "medium" }),
    },
  },

  // ─── TEACHER / PROFESSOR ──────────────────────────────────────
  "teacher": {
    "government-psu": {
      entry: s([3, 6], [0, 0.3], NO_EQ, [3, 6], { in_hand_ratio: 0.80, notice_period_days: 90, negotiation_leverage: "low", notes: "7th CPC pay scales + DA/HRA" }),
      mid: s([6, 12], [0.3, 0.5], NO_EQ, [6, 13], { negotiation_leverage: "low" }),
      senior: s([12, 22], [0.5, 1], NO_EQ, [13, 23], { notes: "Associate/Full Professor" }),
      executive: s([18, 35], [1, 2], NO_EQ, [20, 38], { notes: "HOD / Dean level" }),
    },
    edtech: {
      entry: s([3.5, 6], [0.2, 0.5], NO_EQ, [3.5, 7], {}),
      mid: s([8, 15], [0.5, 1.5], ESOP(0.5, 2), [9, 18], {}),
      senior: s([15, 28], [1, 3], ESOP(1, 4), [16, 32], {}),
      lead: s([22, 38], [1.5, 4], ESOP(1.5, 5), [24, 42], { notes: "Subject head / curriculum lead at Byju's / Unacademy / PW." }),
    },
    "indian-unicorn": {
      entry: s([4, 7], [0.3, 0.5], ESOP(0.3, 1), [4, 8], { notes: "Vedantu / PhysicsWallah / Unacademy live-class educator." }),
      mid: s([8, 16], [0.5, 1.5], ESOP(0.5, 2), [9, 18], { negotiation_leverage: "medium" }),
      senior: s([18, 35], [1, 3], ESOP(1, 4), [20, 40], { notes: "Top educators (₹1Cr+ revenue-share) post-2024 reset." }),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5.5], { negotiation_leverage: "low", notes: "Corporate L&D trainer track." }),
      mid: s([5, 10], [0.3, 0.8], NO_EQ, [5, 11], { negotiation_leverage: "low" }),
      senior: s([10, 18], [0.8, 1.5], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { notes: "Internal corporate trainer / L&D specialist." }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1, 3], NO_EQ, [14, 25], { negotiation_leverage: "medium" }),
    },
  },

  /* Frontend developer, tracks SE bands closely; React/Next/Vue
     specialists at top product cos earn 5-10% premium for design-system
     + perf work. Senior FE at unicorns often shifts to design-engineer. */
  // ─── FRONTEND DEVELOPER ───────────────────────────────────────
  "frontend-developer": {
    faang: {
      entry: s([22, 32], [2, 4], RSU(6, 12), [28, 45], { hot_skills: ["React", "Next.js", "TypeScript", "Performance"] }),
      mid: s([36, 50], [4, 8], RSU(12, 25), [48, 78], { negotiation_leverage: "high" }),
      senior: s([50, 70], [8, 15], RSU(24, 48), [78, 130], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([18, 26], [2, 4], RSU(4, 9), [22, 38], { negotiation_leverage: "medium" }),
      mid: s([28, 42], [3, 7], RSU(10, 22), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([42, 60], [6, 12], RSU(18, 38), [60, 105], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { hot_skills: ["React", "Next.js", "Design Systems"] }),
      mid: s([16, 26], [1.5, 3], ESOP(2, 5), [19, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 6], ESOP(5, 12), [32, 58], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([15, 24], [1, 3], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
      senior: s([26, 40], [3, 6], ESOP(4, 10), [32, 55], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3.5, 6], [0.2, 0.5], NO_EQ, [4, 7], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([6, 12], [0.4, 1], NO_EQ, [7, 14], { notice_period_days: 90 }),
      senior: s([12, 22], [1, 2.5], NO_EQ, [14, 26], { notice_period_days: 90 }),
    },
    "startup-growth": {
      entry: s([7, 12], [0.5, 1], ESOP(1, 3), [8, 15], { negotiation_leverage: "medium" }),
      mid: s([13, 22], [1, 2.5], ESOP(2, 5), [15, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 36], [2.5, 5], ESOP(4, 10), [28, 50], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([16, 26], [2, 5], RSU(3, 8), [20, 35], { negotiation_leverage: "medium" }),
      mid: s([28, 45], [4, 9], RSU(8, 18), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([45, 70], [7, 15], RSU(15, 32), [62, 110], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1.5], NO_EQ, [9, 16], { negotiation_leverage: "low" }),
      senior: s([14, 24], [1, 3], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
    },
    edtech: {
      entry: s([6, 11], [0.5, 1.5], ESOP(0.5, 2), [7, 13], { negotiation_leverage: "low" }),
      mid: s([12, 20], [1, 3], ESOP(1.5, 4), [14, 24], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 4], ESOP(3, 7), [22, 38], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([6, 10], [0.5, 1], NO_EQ, [7, 11], { negotiation_leverage: "low" }),
      mid: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      entry: s([20, 30], [3, 6], NO_EQ, [25, 40], { negotiation_leverage: "medium" }),
      mid: s([35, 55], [6, 12], NO_EQ, [42, 70], { negotiation_leverage: "medium" }),
      senior: s([55, 80], [10, 20], NO_EQ, [65, 100], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([5, 8], [0.3, 0.6], NO_EQ, [5, 9], { negotiation_leverage: "low" }),
      mid: s([10, 17], [0.5, 1.5], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([4, 8], [0, 0.5], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notes: "Govt-IT (NIC / RBI tech / SEBI tech)." }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([14, 25], [1, 2], NO_EQ, [15, 28], { negotiation_leverage: "low" }),
    },
  },

  /* Backend developer, same shape as SE but distributed-systems /
     performance / DB-internals specialists at top tier earn 10-15%
     premium. Backend at IT services often the bulk of tech hires. */
  // ─── BACKEND DEVELOPER ────────────────────────────────────────
  "backend-developer": {
    faang: {
      entry: s([24, 35], [2, 4], RSU(7, 13), [30, 48], { hot_skills: ["Java/Go", "Distributed Systems", "Postgres", "Kafka"] }),
      mid: s([38, 55], [4, 8], RSU(14, 28), [52, 85], { negotiation_leverage: "high" }),
      senior: s([55, 75], [8, 16], RSU(28, 55), [85, 145], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([20, 30], [2, 4], RSU(5, 10), [25, 42], { negotiation_leverage: "medium" }),
      mid: s([32, 48], [3, 8], RSU(12, 25), [42, 72], { negotiation_leverage: "medium" }),
      senior: s([48, 68], [7, 14], RSU(22, 45), [68, 120], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([10, 16], [1, 2], ESOP(1, 3), [12, 20], { hot_skills: ["Java/Go", "Microservices", "Kafka", "Postgres"] }),
      mid: s([18, 28], [1.5, 3.5], ESOP(2.5, 6), [21, 36], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [3, 7], ESOP(6, 14), [35, 65], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([9, 15], [0.5, 1.5], ESOP(1, 3), [11, 19], { negotiation_leverage: "medium" }),
      mid: s([16, 25], [1, 3], ESOP(2, 5), [19, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 42], [3, 6], ESOP(4, 10), [34, 58], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3.5, 6], [0.2, 0.5], NO_EQ, [4, 7], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([6, 13], [0.4, 1], NO_EQ, [7, 15], { notice_period_days: 90 }),
      senior: s([13, 24], [1, 3], NO_EQ, [15, 28], { notice_period_days: 90 }),
    },
    "startup-growth": {
      entry: s([8, 13], [0.5, 1.5], ESOP(1.5, 3), [9, 16], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1, 3], ESOP(2, 6), [16, 30], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [2.5, 5], ESOP(5, 12), [30, 55], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([18, 28], [2, 5], RSU(4, 9), [22, 38], { notes: "Backend at GS / JPM / Citi India trading systems." }),
      mid: s([32, 50], [4, 10], RSU(10, 22), [42, 75], { negotiation_leverage: "high" }),
      senior: s([55, 85], [8, 18], RSU(20, 42), [75, 135], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([8, 15], [0.5, 1.5], NO_EQ, [9, 17], { negotiation_leverage: "low" }),
      senior: s([15, 25], [1.5, 3], NO_EQ, [17, 29], { negotiation_leverage: "medium" }),
    },
    edtech: {
      entry: s([6, 11], [0.5, 1.5], ESOP(0.5, 2), [7, 13], { negotiation_leverage: "low" }),
      mid: s([12, 22], [1, 3], ESOP(1.5, 4), [14, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 36], [2, 5], ESOP(3, 8), [26, 42], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([7, 11], [0.5, 1], NO_EQ, [8, 12], { negotiation_leverage: "low" }),
      mid: s([13, 22], [1, 2.5], NO_EQ, [14, 25], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2, 5], NO_EQ, [25, 40], { negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      entry: s([22, 32], [3, 7], NO_EQ, [28, 42], { negotiation_leverage: "medium" }),
      mid: s([38, 60], [6, 13], NO_EQ, [45, 75], { negotiation_leverage: "medium" }),
      senior: s([60, 90], [12, 22], NO_EQ, [72, 110], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([5, 9], [0.3, 0.6], NO_EQ, [5, 10], { negotiation_leverage: "low" }),
      mid: s([11, 18], [0.5, 1.5], NO_EQ, [12, 21], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([4, 8], [0, 0.5], NO_EQ, [4, 8], { in_hand_ratio: 0.78 }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([14, 25], [1, 2], NO_EQ, [15, 28], { negotiation_leverage: "low" }),
    },
  },

  /* Mobile developer, iOS specialists at FAANG earn 10-20% premium
     over Android/web; React Native / Flutter cross-platform tracks
     closer to SE base. Strong demand at fintech / consumer unicorns. */
  // ─── MOBILE DEVELOPER ─────────────────────────────────────────
  "mobile-developer": {
    faang: {
      entry: s([24, 36], [2, 4], RSU(7, 14), [30, 50], { hot_skills: ["iOS/Swift", "Android/Kotlin", "Compose", "SwiftUI"], notes: "iOS specialists premium ≈ 10-20% above Android at FAANG." }),
      mid: s([38, 55], [4, 8], RSU(14, 30), [52, 90], { negotiation_leverage: "high" }),
      senior: s([55, 75], [8, 16], RSU(28, 55), [85, 145], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(4, 9), [22, 40], { negotiation_leverage: "medium" }),
      mid: s([30, 45], [3, 7], RSU(10, 22), [38, 68], { negotiation_leverage: "medium" }),
      senior: s([45, 65], [6, 13], RSU(20, 42), [62, 110], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([9, 15], [0.5, 1.5], ESOP(1, 3), [11, 19], { hot_skills: ["Swift", "Kotlin", "React Native", "Flutter"] }),
      mid: s([17, 27], [1.5, 3], ESOP(2.5, 6), [20, 35], { negotiation_leverage: "medium" }),
      senior: s([27, 42], [3, 6], ESOP(5, 12), [33, 58], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([15, 24], [1, 3], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
      senior: s([25, 40], [3, 6], ESOP(4, 10), [30, 55], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4.5, 8], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([7, 14], [0.5, 1.5], NO_EQ, [8, 16], { notice_period_days: 90 }),
      senior: s([14, 24], [1, 3], NO_EQ, [15, 28], { notice_period_days: 90 }),
    },
    "startup-growth": {
      entry: s([7, 12], [0.5, 1], ESOP(1, 3), [8, 15], { negotiation_leverage: "medium" }),
      mid: s([13, 22], [1, 2.5], ESOP(2, 5), [15, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 36], [2.5, 5], ESOP(4, 10), [28, 50], { negotiation_leverage: "high" }),
    },
  },

  // ─── SCRUM MASTER / AGILE COACH ───────────────────────────────
  "scrum-master": {
    faang: {
      entry: s([12, 18], [1, 2], RSU(2, 5), [15, 24], {}),
      mid: s([20, 30], [2, 4], RSU(5, 10), [26, 42], {}),
      senior: s([30, 42], [4, 8], RSU(8, 15), [40, 62], {}),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], {}),
      mid: s([12, 18], [1, 2], ESOP(1, 3), [14, 22], {}),
      senior: s([18, 28], [2, 4], ESOP(3, 6), [22, 36], {}),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4, 8], { notice_period_days: 90, negotiation_leverage: "low", notes: "CSM/PSM certified: +15-20%" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [8, 15], { notice_period_days: 90 }),
      senior: s([14, 22], [1, 2], NO_EQ, [15, 25], { notice_period_days: 90 }),
    },
    "big-tech": {
      entry: s([10, 16], [1, 2], RSU(2, 4), [12, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 24], [2, 4], RSU(4, 9), [20, 32], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 7], RSU(8, 18), [30, 52], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([8, 13], [0.5, 1.5], RSU(1, 3), [9, 16], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1.5, 3], RSU(3, 7), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], RSU(6, 14), [26, 45], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], { negotiation_leverage: "medium" }),
      mid: s([10, 18], [1, 2], ESOP(1, 3), [12, 20], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 4], ESOP(2, 6), [20, 32], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [1, 2.5], RSU(2, 5), [12, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 25], [2, 5], RSU(4, 10), [20, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 40], [4, 9], RSU(8, 18), [32, 55], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([6, 10], [0.5, 1.2], NO_EQ, [7, 12], { negotiation_leverage: "low" }),
      mid: s([10, 17], [1, 2.5], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
    },
  },

  // ─── SOLUTIONS ARCHITECT ──────────────────────────────────────
  "solutions-architect": {
    faang: {
      mid: s([45, 60], [5, 10], RSU(20, 40), [65, 105], { hot_skills: ["Cloud Architecture", "System Design", "Enterprise"] }),
      senior: s([60, 80], [8, 15], RSU(35, 65), [100, 155], { negotiation_leverage: "high" }),
      lead: s([75, 95], [12, 25], RSU(50, 100), [135, 210], {}),
    },
    "indian-unicorn": {
      mid: s([22, 35], [2, 4], ESOP(3, 6), [26, 42], {}),
      senior: s([35, 50], [4, 8], ESOP(6, 12), [42, 65], {}),
      lead: s([48, 65], [6, 12], ESOP(10, 20), [60, 90], {}),
    },
    "it-services": {
      mid: s([12, 20], [1, 2], NO_EQ, [12, 22], { notice_period_days: 90 }),
      senior: s([20, 32], [2, 4], NO_EQ, [22, 36], {}),
      lead: s([28, 45], [3, 6], NO_EQ, [32, 52], {}),
    },
    "consulting-big4": {
      mid: s([16, 24], [2, 4], NO_EQ, [18, 28], {}),
      senior: s([24, 38], [4, 8], NO_EQ, [28, 46], {}),
    },
    "big-tech": {
      mid: s([35, 50], [4, 8], RSU(15, 30), [50, 80], { negotiation_leverage: "high" }),
      senior: s([50, 70], [7, 14], RSU(25, 55), [78, 130], { negotiation_leverage: "high" }),
      lead: s([65, 85], [10, 20], RSU(40, 85), [115, 180], { negotiation_leverage: "high" }),
    },
    gcc: {
      mid: s([28, 42], [3, 7], RSU(10, 22), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([42, 62], [6, 12], RSU(20, 42), [60, 105], { negotiation_leverage: "high" }),
      lead: s([60, 85], [10, 20], RSU(30, 70), [90, 165], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      mid: s([18, 30], [2, 4], ESOP(3, 7), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([30, 48], [4, 8], ESOP(6, 14), [38, 60], { negotiation_leverage: "high" }),
      lead: s([45, 65], [6, 12], ESOP(10, 22), [55, 90], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      mid: s([25, 38], [3, 7], RSU(8, 16), [32, 55], { notes: "Goldman / JPMC India tech architecture." }),
      senior: s([38, 58], [6, 12], RSU(15, 32), [50, 90], { negotiation_leverage: "high" }),
      lead: s([55, 80], [10, 20], RSU(30, 60), [85, 145], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      mid: s([14, 22], [1.5, 3], NO_EQ, [16, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2.5, 5], NO_EQ, [25, 40], { negotiation_leverage: "medium" }),
      lead: s([32, 50], [4, 9], NO_EQ, [36, 58], { negotiation_leverage: "high" }),
    },
    "startup-growth": {
      mid: s([15, 25], [1.5, 3], ESOP(2, 5), [18, 32], { negotiation_leverage: "medium" }),
      senior: s([25, 38], [3, 6], ESOP(5, 12), [30, 50], { negotiation_leverage: "high" }),
    },
  },

  // ─── TECH LEAD ────────────────────────────────────────────────
  "tech-lead": {
    faang: {
      mid: s([42, 55], [4, 8], RSU(18, 35), [60, 95], { hot_skills: ["Architecture", "Mentoring", "Technical Strategy"] }),
      senior: s([55, 72], [6, 12], RSU(30, 55), [85, 135], { negotiation_leverage: "high" }),
      lead: s([68, 88], [10, 20], RSU(45, 90), [120, 190], {}),
    },
    "indian-unicorn": {
      mid: s([20, 30], [2, 4], ESOP(3, 6), [24, 38], {}),
      senior: s([30, 45], [4, 8], ESOP(6, 12), [38, 60], {}),
      lead: s([42, 58], [6, 10], ESOP(8, 18), [55, 82], {}),
    },
    "it-services": {
      mid: s([10, 18], [0.5, 1.5], NO_EQ, [10, 20], { notice_period_days: 90 }),
      senior: s([16, 28], [1, 3], NO_EQ, [18, 32], {}),
      lead: s([25, 40], [2, 5], NO_EQ, [28, 45], {}),
    },
    "startup-growth": {
      mid: s([14, 22], [1, 3], ESOP(2, 5), [16, 28], {}),
      senior: s([22, 38], [3, 5], ESOP(5, 10), [28, 50], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      mid: s([35, 50], [4, 8], RSU(15, 32), [50, 82], { negotiation_leverage: "high" }),
      senior: s([50, 70], [7, 14], RSU(25, 55), [78, 130], { negotiation_leverage: "high" }),
      lead: s([65, 85], [10, 20], RSU(40, 85), [115, 180], { negotiation_leverage: "high" }),
    },
    gcc: {
      mid: s([26, 40], [3, 7], RSU(10, 22), [36, 60], { negotiation_leverage: "medium" }),
      senior: s([40, 60], [6, 12], RSU(20, 42), [55, 100], { negotiation_leverage: "high" }),
      lead: s([60, 85], [10, 20], RSU(30, 70), [90, 165], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      mid: s([18, 28], [2, 4], ESOP(3, 7), [22, 36], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [4, 8], ESOP(5, 12), [35, 60], { negotiation_leverage: "high" }),
      lead: s([42, 60], [6, 12], ESOP(8, 20), [50, 85], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      mid: s([24, 38], [3, 7], RSU(8, 16), [32, 55], { negotiation_leverage: "medium" }),
      senior: s([38, 58], [6, 12], RSU(15, 32), [50, 90], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      mid: s([14, 22], [1.5, 3], NO_EQ, [15, 26], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], NO_EQ, [25, 40], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      mid: s([12, 20], [1, 3], ESOP(3, 8), [14, 28], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([20, 35], [2, 5], ESOP(6, 15), [25, 48], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
  },

  // ─── EMBEDDED ENGINEER ────────────────────────────────────────
  "embedded-engineer": {
    faang: {
      entry: s([18, 25], [1, 3], RSU(3, 6), [22, 32], { hot_skills: ["RTOS", "C/C++", "Firmware", "IoT"] }),
      mid: s([30, 42], [3, 5], RSU(8, 15), [38, 58], {}),
      senior: s([42, 58], [5, 10], RSU(12, 25), [55, 88], {}),
    },
    "indian-unicorn": {
      entry: s([5, 8], [0.3, 0.5], ESOP(0.5, 1.5), [6, 10], {}),
      mid: s([10, 16], [0.8, 1.5], ESOP(1, 3), [12, 20], {}),
      senior: s([16, 28], [1.5, 3], ESOP(3, 6), [20, 35], {}),
    },
    "it-services": {
      entry: s([3, 5.5], [0.1, 0.3], NO_EQ, [3, 6], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([6, 12], [0.3, 0.8], NO_EQ, [6, 13], {}),
      senior: s([12, 20], [0.8, 1.5], NO_EQ, [13, 22], {}),
    },
    "government-psu": {
      entry: s([5, 8], [0, 0.5], NO_EQ, [5, 9], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "ISRO/DRDO/BEL/HAL. 7th CPC Level 7-8" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [9, 15], {}),
      senior: s([14, 22], [1, 2], NO_EQ, [15, 24], { notes: "Scientist E/F grade" }),
    },
    "big-tech": {
      entry: s([14, 22], [1, 3], RSU(2, 6), [16, 30], { hot_skills: ["RTOS", "Linux drivers", "ARM"], negotiation_leverage: "medium" }),
      mid: s([22, 35], [2, 5], RSU(6, 14), [28, 50], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 11], RSU(15, 32), [45, 85], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([12, 20], [1, 3], RSU(2, 5), [14, 26], { notes: "Qualcomm / NVIDIA / Apple India embedded teams.", negotiation_leverage: "medium" }),
      mid: s([20, 32], [2, 5], RSU(7, 16), [25, 45], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [5, 10], RSU(15, 32), [42, 80], { negotiation_leverage: "high" }),
    },
    "fmcg-mnc": {
      entry: s([6, 10], [0.5, 1.5], NO_EQ, [7, 12], { notes: "Bosch / Tata Elxsi / Continental embedded engineering." }),
      mid: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([6, 10], [0.5, 1], ESOP(1, 3), [7, 13], { notes: "IoT / robotics / EV startups (Ather / Ola Electric / Yulu)." }),
      mid: s([12, 20], [1, 2.5], ESOP(2, 5), [14, 25], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], ESOP(4, 10), [24, 42], { negotiation_leverage: "high" }),
    },
  },

  // ─── DATABASE ADMINISTRATOR ───────────────────────────────────
  "database-administrator": {
    faang: {
      entry: s([18, 24], [1, 2], RSU(4, 8), [22, 32], { hot_skills: ["PostgreSQL", "MongoDB", "Redis", "Cloud DBs"] }),
      mid: s([28, 38], [3, 5], RSU(8, 15), [36, 55], {}),
      senior: s([38, 52], [5, 10], RSU(12, 22), [52, 80], {}),
    },
    "indian-unicorn": {
      entry: s([5, 8], [0.3, 0.5], ESOP(0.5, 1.5), [6, 10], {}),
      mid: s([10, 16], [0.8, 1.5], ESOP(1, 3), [12, 20], {}),
      senior: s([16, 25], [1.5, 3], ESOP(3, 5), [20, 32], {}),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5.5], { notice_period_days: 90, negotiation_leverage: "low", notes: "Oracle DBA: +20-30% premium" }),
      mid: s([6, 10], [0.3, 0.8], NO_EQ, [6, 11], {}),
      senior: s([10, 18], [0.8, 1.5], NO_EQ, [11, 20], {}),
    },
    "big-tech": {
      entry: s([14, 22], [1, 3], RSU(3, 6), [16, 28], { negotiation_leverage: "medium" }),
      mid: s([22, 32], [2, 5], RSU(6, 12), [26, 45], { negotiation_leverage: "medium" }),
      senior: s([32, 48], [4, 9], RSU(10, 22), [40, 72], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([10, 16], [1, 2], RSU(2, 4), [12, 20], { negotiation_leverage: "medium" }),
      mid: s([16, 24], [1.5, 3], RSU(4, 9), [19, 32], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], RSU(8, 18), [30, 55], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([7, 11], [0.5, 1], ESOP(0.5, 1.5), [8, 13], { negotiation_leverage: "medium" }),
      mid: s([12, 18], [1, 2], ESOP(1, 3), [13, 22], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 4], ESOP(2, 6), [20, 34], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { notes: "Critical at GS / JPMC India trading systems." }),
      mid: s([18, 28], [2, 5], RSU(5, 12), [22, 42], { negotiation_leverage: "medium" }),
      senior: s([28, 42], [4, 9], RSU(10, 22), [34, 60], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4.5, 8], { negotiation_leverage: "low" }),
      mid: s([7, 13], [0.5, 1.5], NO_EQ, [8, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1, 3], NO_EQ, [15, 26], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notes: "NIC / RBI / SEBI / CERT-In DBA." }),
      mid: s([7, 12], [0.3, 0.8], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.8, 1.5], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
  },

  // ─── NETWORK ENGINEER ─────────────────────────────────────────
  "network-engineer": {
    faang: {
      entry: s([15, 22], [1, 2], RSU(3, 6), [18, 28], { hot_skills: ["CCNP/CCIE", "SD-WAN", "Cloud Networking"] }),
      mid: s([25, 35], [2, 4], RSU(6, 12), [32, 48], {}),
      senior: s([35, 48], [4, 8], RSU(10, 20), [46, 72], {}),
    },
    "indian-unicorn": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4, 8], {}),
      mid: s([8, 14], [0.5, 1.5], ESOP(0.5, 2), [9, 17], {}),
      senior: s([14, 22], [1, 2], ESOP(2, 4), [16, 28], {}),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5.5], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([5, 10], [0.3, 0.5], NO_EQ, [5, 11], {}),
      senior: s([10, 18], [0.5, 1.5], NO_EQ, [10, 20], { notes: "CCIE certified: +40-60% premium" }),
    },
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([7, 12], [0.3, 0.5], NO_EQ, [7, 13], {}),
      senior: s([12, 20], [0.5, 1], NO_EQ, [13, 21], {}),
    },
    "big-tech": {
      entry: s([12, 18], [1, 2], RSU(2, 5), [14, 24], { negotiation_leverage: "medium" }),
      mid: s([20, 30], [2, 4], RSU(5, 11), [25, 40], { negotiation_leverage: "medium" }),
      senior: s([30, 45], [4, 8], RSU(10, 22), [38, 65], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([10, 15], [0.5, 1.5], RSU(1, 3), [11, 18], { negotiation_leverage: "medium" }),
      mid: s([15, 24], [1, 3], RSU(3, 7), [18, 30], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [2, 5], RSU(7, 16), [28, 50], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], { negotiation_leverage: "medium" }),
      mid: s([10, 16], [0.8, 1.5], ESOP(1, 3), [11, 19], { negotiation_leverage: "medium" }),
      senior: s([16, 26], [1.5, 3], ESOP(2, 5), [18, 30], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([8, 13], [0.8, 2], RSU(1.5, 4), [9, 17], { negotiation_leverage: "medium" }),
      mid: s([14, 22], [1.5, 3.5], RSU(3, 8), [16, 30], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [3, 6], RSU(7, 16), [26, 45], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([6, 11], [0.4, 1], NO_EQ, [7, 13], { negotiation_leverage: "low" }),
      senior: s([11, 18], [0.8, 2], NO_EQ, [12, 20], { negotiation_leverage: "medium" }),
    },
  },

  // ─── MECHANICAL ENGINEER ──────────────────────────────────────
  "mechanical-engineer": {
    "fmcg-mnc": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { hot_skills: ["AutoCAD", "SolidWorks", "Six Sigma"] }),
      mid: s([8, 14], [0.5, 1.5], NO_EQ, [9, 16], {}),
      senior: s([14, 25], [1.5, 3], NO_EQ, [16, 28], {}),
      executive: s([25, 45], [3, 8], NO_EQ, [28, 55], {}),
    },
    "indian-unicorn": {
      entry: s([4, 6], [0.2, 0.4], NO_EQ, [4, 7], {}),
      mid: s([7, 12], [0.5, 1], ESOP(0.5, 1.5), [8, 14], {}),
      senior: s([12, 20], [1, 2], ESOP(1, 3), [14, 24], {}),
    },
    "government-psu": {
      entry: s([4, 8], [0, 0.5], NO_EQ, [4, 9], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "7th CPC Level 7-10. BHEL/NTPC/ONGC/Railways" }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [9, 15], {}),
      senior: s([14, 25], [1, 2], NO_EQ, [15, 28], { notes: "Chief Engineer / AGM level" }),
    },
    "it-services": {
      entry: s([3, 5], [0.1, 0.3], NO_EQ, [3, 5.5], { notice_period_days: 60, negotiation_leverage: "low" }),
      mid: s([5, 10], [0.3, 0.8], NO_EQ, [5, 11], {}),
      senior: s([10, 18], [0.8, 1.5], NO_EQ, [11, 20], {}),
    },
    gcc: {
      entry: s([8, 13], [0.5, 1.5], RSU(1.5, 4), [9, 16], { notes: "GE / Honeywell / Emerson / Siemens India tech centers." }),
      mid: s([13, 22], [1, 3], RSU(3, 8), [15, 28], { negotiation_leverage: "medium" }),
      senior: s([22, 35], [2, 5], RSU(7, 16), [26, 48], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 11], { notes: "EY / KPMG / Deloitte engineering advisory." }),
      mid: s([10, 17], [1, 2.5], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
    },
    "consulting-mbb": {
      entry: s([12, 16], [2, 4], NO_EQ, [14, 20], { notes: "MBB ops / industrial practice." }),
      mid: s([20, 32], [4, 8], NO_EQ, [24, 42], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [8, 14], NO_EQ, [42, 70], { negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([5, 9], [0.3, 0.6], ESOP(0.5, 1.5), [5.5, 11], { notes: "EV / robotics / hardware startups." }),
      mid: s([9, 15], [0.5, 1.5], ESOP(1, 3), [10, 17], { negotiation_leverage: "medium" }),
      senior: s([15, 26], [1.5, 3], ESOP(3, 7), [17, 30], { negotiation_leverage: "high" }),
    },
    "startup-early": {
      entry: s([4, 7], [0.2, 0.5], ESOP(0.5, 2), [4.5, 9], { notice_period_days: 15, negotiation_leverage: "medium" }),
      mid: s([7, 12], [0.4, 1], ESOP(1.5, 4), [8, 14], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([12, 20], [1, 2.5], ESOP(3, 8), [14, 24], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.5], NO_EQ, [4, 8], { notes: "Insurance underwriting (engineering risk)." }),
      mid: s([7, 12], [0.5, 1.5], NO_EQ, [8, 14], { negotiation_leverage: "low" }),
      senior: s([12, 20], [1, 2.5], NO_EQ, [14, 22], { negotiation_leverage: "medium" }),
    },
    "saas-product": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], { notes: "Industrial-IoT / digital-twin SaaS." }),
      mid: s([10, 17], [1, 2], ESOP(1, 3), [12, 19], { negotiation_leverage: "medium" }),
      senior: s([17, 28], [2, 4], ESOP(2, 6), [19, 32], { negotiation_leverage: "high" }),
    },
  },

  // ─── ELECTRICAL ENGINEER (alias to mechanical-engineer) ───────
  /* Electrical engineer, VLSI / chip design (NVIDIA / Qualcomm / Intel /
     AMD India) commands 1.5-2x mechanical-engineer pay; power systems
     and instrumentation track closer to mechanical at L&T / BHEL / NTPC. */
  "electrical-engineer": {
    faang: {
      entry: s([18, 28], [2, 4], RSU(5, 10), [22, 38], { hot_skills: ["VLSI", "RTL Design", "Verification", "Physical Design"], notes: "NVIDIA / Qualcomm / Intel / AMD GCC chip teams. Premium 30-50% over mechanical-engineer." }),
      mid: s([28, 45], [3, 7], RSU(12, 25), [38, 70], { negotiation_leverage: "high" }),
      senior: s([45, 70], [6, 14], RSU(22, 50), [65, 125], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([14, 22], [1, 3], RSU(3, 7), [16, 30], { hot_skills: ["VLSI", "ASIC", "FPGA"], negotiation_leverage: "medium" }),
      mid: s([22, 35], [2, 5], RSU(8, 18), [28, 52], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 10], RSU(15, 35), [48, 90], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.3, 0.8], ESOP(0.5, 2), [7, 12], { negotiation_leverage: "low" }),
      mid: s([12, 18], [0.8, 2], ESOP(1, 3), [13, 22], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 4], ESOP(3, 6), [22, 36], { negotiation_leverage: "medium" }),
    },
    "it-services": {
      entry: s([3.5, 6], [0.2, 0.4], NO_EQ, [4, 7], { negotiation_leverage: "low" }),
      mid: s([6, 11], [0.4, 1], NO_EQ, [7, 13], { negotiation_leverage: "low" }),
      senior: s([11, 18], [1, 2], NO_EQ, [12, 20], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { in_hand_ratio: 0.78, notes: "BHEL / NTPC / Power Grid GET. 7th CPC pay band." }),
      mid: s([10, 16], [0.5, 1], NO_EQ, [11, 17], { negotiation_leverage: "low" }),
      senior: s([16, 28], [1, 2], NO_EQ, [17, 30], { negotiation_leverage: "low" }),
    },
  },

  // ─── CIVIL ENGINEER (alias to mechanical-engineer) ────────────
  /* Civil engineer, distinct market (L&T / Tata Projects / GMR / Adani
     Infra / Shapoorji); construction / infra heavy. PSU pay-bands at
     CPWD / NHAI / DMRC / IRCON. Tier-1 IIT graduates: ₹12-18L at L&T. */
  "civil-engineer": {
    "indian-unicorn": {
      entry: s([5, 8], [0.3, 0.6], NO_EQ, [5, 9], { notes: "Real-estate-tech (Square Yards / NoBroker) civil tech." }),
      mid: s([10, 16], [0.5, 1.5], NO_EQ, [11, 17], { negotiation_leverage: "medium" }),
      senior: s([16, 26], [1.5, 3], NO_EQ, [18, 30], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([6, 10], [0.5, 1], NO_EQ, [7, 11], { notes: "L&T / Tata Projects / Shapoorji GET. IIT premium ₹12-18L." }),
      mid: s([12, 18], [1, 2.5], NO_EQ, [13, 20], { negotiation_leverage: "medium" }),
      senior: s([20, 35], [2, 5], NO_EQ, [22, 40], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3.5, 6], [0.2, 0.4], NO_EQ, [4, 7], { negotiation_leverage: "low" }),
      mid: s([6, 11], [0.4, 1], NO_EQ, [7, 13], { negotiation_leverage: "low" }),
      senior: s([11, 18], [1, 2], NO_EQ, [12, 20], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([7, 10], [0, 0.5], NO_EQ, [7, 11], { in_hand_ratio: 0.78, notes: "CPWD / NHAI / DMRC / IRCON / NBCC. JE/AE 7th CPC pay band." }),
      mid: s([10, 18], [0.5, 1], NO_EQ, [11, 19], { negotiation_leverage: "low" }),
      senior: s([18, 32], [1, 2], NO_EQ, [19, 34], { negotiation_leverage: "low" }),
    },
    "consulting-big4": {
      entry: s([6, 10], [0.5, 1], NO_EQ, [7, 11], { negotiation_leverage: "low", notes: "Deloitte / EY infra advisory." }),
      mid: s([11, 18], [1, 2.5], NO_EQ, [12, 20], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
  },

  // ─── CHARTERED ACCOUNTANT ─────────────────────────────────────
  "chartered-accountant": {
    "consulting-big4": {
      entry: s([7, 10], [0.5, 1], NO_EQ, [8, 11], { hot_skills: ["Audit", "Tax", "IFRS", "IndAS"], notes: "Articleship + newly qualified CA" }),
      mid: s([12, 20], [1, 3], NO_EQ, [14, 24], {}),
      senior: s([22, 38], [3, 6], NO_EQ, [25, 45], { notes: "Manager/Senior Manager level" }),
      lead: s([38, 55], [6, 10], NO_EQ, [45, 68], { notes: "Director level" }),
      executive: s([55, 80], [10, 20], NO_EQ, [70, 110], { notes: "Partner level" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(1, 3), [12, 22], {}),
      mid: s([18, 28], [3, 6], RSU(4, 8), [24, 40], {}),
      senior: s([28, 45], [6, 12], RSU(6, 15), [38, 68], {}),
    },
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.8], NO_EQ, [4, 8], { negotiation_leverage: "low" }),
      mid: s([8, 14], [0.8, 2], NO_EQ, [9, 17], {}),
      senior: s([14, 28], [2, 4], NO_EQ, [16, 32], {}),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 1.5), [7, 12], {}),
      mid: s([12, 20], [1, 2], ESOP(1, 3), [14, 24], {}),
      senior: s([20, 35], [2, 5], ESOP(3, 6), [24, 44], {}),
    },
    "consulting-mbb": {
      entry: s([14, 22], [3, 6], NO_EQ, [17, 30], { notes: "McKinsey / BCG / Bain financial-due-diligence + audit advisory CA-MBA tracks." }),
      mid: s([28, 42], [5, 10], NO_EQ, [33, 55], { negotiation_leverage: "medium" }),
      senior: s([48, 75], [10, 20], NO_EQ, [60, 100], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([8, 13], [0.5, 1.5], ESOP(1, 3), [9, 16], { notes: "FinOps controllers / revenue-ops at Postman / BrowserStack / Chargebee." }),
      mid: s([14, 22], [1, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 40], [3, 6], ESOP(4, 10), [28, 52], { negotiation_leverage: "high" }),
    },
    "fmcg-mnc": {
      entry: s([8, 13], [1, 2], NO_EQ, [9, 15], { notes: "HUL / ITC / Marico finance MT track. CA-CFA combo: top of band." }),
      mid: s([14, 24], [2, 4], NO_EQ, [16, 28], { negotiation_leverage: "medium" }),
      senior: s([24, 42], [4, 9], NO_EQ, [28, 50], { negotiation_leverage: "high" }),
      executive: s([55, 90], [12, 25], NO_EQ, [70, 130], { in_hand_ratio: 0.55, notes: "CFO at top FMCG ₹1.5-3Cr." }),
    },
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { in_hand_ratio: 0.78, notes: "RBI / SEBI / SBI / LIC officer-grade. CA + CAIIB combo. 7th CPC." }),
      mid: s([10, 18], [0.5, 1], NO_EQ, [11, 19], { negotiation_leverage: "low" }),
      senior: s([18, 32], [1, 2], NO_EQ, [19, 35], { negotiation_leverage: "low" }),
    },
    "it-services": {
      entry: s([5, 8], [0.3, 0.6], NO_EQ, [5, 9], { notice_period_days: 90, negotiation_leverage: "low" }),
      mid: s([8, 14], [0.5, 1.5], NO_EQ, [9, 16], { notice_period_days: 90 }),
      senior: s([14, 24], [1.5, 3], NO_EQ, [16, 28], { notice_period_days: 90 }),
    },
  },

  // ─── DOCTOR ───────────────────────────────────────────────────
  "doctor": {
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { in_hand_ratio: 0.80, notice_period_days: 90, negotiation_leverage: "low", notes: "7th CPC Level 10-11. MBBS entry. Additional: NPA (Non-Practising Allowance) 20% of basic" }),
      mid: s([10, 18], [0.5, 1], NO_EQ, [11, 19], { notes: "MD/MS specialist. NPA 20%" }),
      senior: s([18, 32], [1, 2], NO_EQ, [19, 35], { notes: "Associate Professor / Senior Specialist" }),
      executive: s([25, 50], [2, 4], NO_EQ, [28, 55], { notes: "Professor / HOD / Director level" }),
    },
    "indian-unicorn": {
      entry: s([8, 14], [0.5, 1], NO_EQ, [9, 15], { notes: "Private hospital / healthtech" }),
      mid: s([15, 28], [1, 3], ESOP(0.5, 2), [16, 32], {}),
      senior: s([28, 50], [3, 6], ESOP(2, 5), [32, 58], {}),
      lead: s([45, 80], [5, 10], ESOP(5, 12), [55, 100], { notes: "CMO / Chief Medical Officer at health-tech." }),
    },
    "fmcg-mnc": {
      entry: s([10, 18], [1, 3], NO_EQ, [11, 22], { notes: "Apollo / Fortis / Manipal / Max consultant entry; Pharma medical advisor." }),
      mid: s([20, 35], [2, 5], NO_EQ, [22, 42], { negotiation_leverage: "medium" }),
      senior: s([38, 70], [4, 10], NO_EQ, [42, 85], { notes: "Senior consultant / department head at Apollo / Fortis." }),
      executive: s([80, 150], [10, 25], NO_EQ, [95, 200], { in_hand_ratio: 0.55, notes: "Star surgeon / specialist (cardiac / oncology)." }),
    },
    "saas-product": {
      entry: s([8, 14], [0.5, 1.5], ESOP(0.5, 2), [9, 17], { notes: "Healthtech (Practo / 1mg / PharmEasy) medical advisor." }),
      mid: s([15, 26], [1, 3], ESOP(1, 4), [17, 32], { negotiation_leverage: "medium" }),
      senior: s([28, 50], [3, 6], ESOP(3, 8), [32, 60], { negotiation_leverage: "high" }),
    },
    "consulting-mbb": {
      entry: s([15, 25], [3, 6], NO_EQ, [18, 32], { notes: "McKinsey Health Institute / BCG Health Practice MD-track." }),
      mid: s([28, 45], [5, 10], NO_EQ, [33, 58], { negotiation_leverage: "medium" }),
      senior: s([50, 80], [10, 20], NO_EQ, [60, 105], { negotiation_leverage: "high" }),
    },
    "bfsi-global": {
      entry: s([14, 22], [2, 4], RSU(2, 5), [16, 30], { notes: "Insurance medical underwriter at MetLife / AIG / Bajaj Allianz." }),
      mid: s([22, 38], [3, 7], RSU(5, 12), [27, 50], { negotiation_leverage: "medium" }),
      senior: s([38, 65], [6, 13], RSU(12, 25), [48, 90], { negotiation_leverage: "high" }),
    },
  },

  // ─── DESIGN ENGINEER (alias — premium 10-15% over ux-designer at top
  //     product cos; for now resolves via ROLE_ALIASES → ux-designer) ──
  /* Design Engineer, engineering-coded designers (Vercel/Linear-
     style hybrid role). 10-15% premium over generic UX at top
     product cos. */
  "design-engineer": {
    faang: {
      entry: s([22, 32], [2, 4], RSU(7, 14), [28, 48], { hot_skills: ["React", "Motion", "Design Systems", "TypeScript"], negotiation_leverage: "medium" }),
      mid: s([35, 55], [4, 8], RSU(15, 32), [48, 88], { negotiation_leverage: "high" }),
      senior: s([55, 80], [8, 16], RSU(32, 68), [78, 145], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([12, 22], [1, 2], ESOP(2, 5), [14, 26], { hot_skills: ["React", "Framer Motion", "Storybook"], negotiation_leverage: "medium" }),
      mid: s([22, 38], [2, 5], ESOP(4, 9), [26, 45], { negotiation_leverage: "high" }),
      senior: s([38, 60], [5, 10], ESOP(8, 18), [45, 75], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(4, 9), [22, 38], { negotiation_leverage: "medium" }),
      mid: s([32, 50], [4, 8], RSU(11, 24), [42, 75], { negotiation_leverage: "medium" }),
      senior: s([50, 75], [7, 16], RSU(24, 52), [65, 120], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([10, 18], [1, 2], ESOP(1.5, 4), [12, 22], { negotiation_leverage: "medium" }),
      mid: s([18, 32], [2, 4], ESOP(3, 7), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 8], ESOP(6, 14), [38, 60], { negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([8, 14], [0.5, 2], ESOP(1, 4), [10, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1, 3], ESOP(2, 6), [16, 30], { negotiation_leverage: "high" }),
      senior: s([24, 40], [3, 6], ESOP(5, 12), [28, 50], { negotiation_leverage: "high" }),
    },
  },

  // ─── PRODUCT MARKETING MANAGER (alias — 20-30% above generic marketing
  //     at SaaS / unicorns; for now resolves via ROLE_ALIASES → marketing) ──
  /* Product Marketing Manager, distinct ladder. PMM at SaaS / B2B
     companies commands 20-30% premium over generic marketing key. */
  "product-marketing-manager": {
    faang: {
      entry: s([18, 28], [3, 5], RSU(5, 11), [24, 40], { hot_skills: ["Positioning", "GTM", "Pricing", "Sales enablement"], negotiation_leverage: "medium" }),
      mid: s([30, 48], [5, 10], RSU(12, 28), [40, 75], { negotiation_leverage: "medium" }),
      senior: s([48, 72], [8, 18], RSU(28, 60), [70, 125], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([10, 16], [1, 2], ESOP(1, 3), [12, 20], { negotiation_leverage: "medium" }),
      mid: s([18, 30], [2, 5], ESOP(3, 7), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([30, 50], [4, 8], ESOP(6, 14), [36, 62], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([16, 24], [2, 4], RSU(4, 9), [20, 34], { negotiation_leverage: "medium" }),
      mid: s([26, 42], [4, 8], RSU(10, 22), [34, 60], { negotiation_leverage: "medium" }),
      senior: s([42, 65], [7, 14], RSU(20, 45), [55, 100], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([12, 20], [1, 3], RSU(3, 7), [14, 26], { negotiation_leverage: "medium" }),
      mid: s([20, 32], [2, 5], RSU(6, 14), [25, 44], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 9], RSU(12, 28), [42, 75], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([10, 18], [1, 3], ESOP(2, 4), [12, 22], { hot_skills: ["Developer Marketing", "Content", "Pricing"], negotiation_leverage: "medium" }),
      mid: s([18, 30], [2, 5], ESOP(3, 7), [22, 38], { negotiation_leverage: "medium" }),
      senior: s([30, 48], [4, 8], ESOP(5, 12), [36, 62], { negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [9, 18], { negotiation_leverage: "medium" }),
      mid: s([14, 24], [1, 3], ESOP(2, 5), [16, 30], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [3, 6], ESOP(5, 12), [28, 50], { negotiation_leverage: "high" }),
    },
  },

  // ─── PHARMACIST ───────────────────────────────────────────────
  "pharmacist": {
    "fmcg-mnc": {
      entry: s([3, 5], [0.2, 0.4], NO_EQ, [3, 5.5], { hot_skills: ["Pharma R&D", "Drug Regulatory", "Clinical Trials"], notes: "Pharma companies: Sun Pharma, Dr Reddy's, Cipla" }),
      mid: s([6, 10], [0.5, 1], NO_EQ, [6, 11], {}),
      senior: s([10, 18], [1, 2], NO_EQ, [11, 20], {}),
      executive: s([18, 35], [2, 5], NO_EQ, [20, 42], { notes: "VP R&D / Medical Director" }),
    },
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "Hospital pharmacist / drug inspector" }),
      mid: s([7, 12], [0.3, 0.5], NO_EQ, [7, 13], {}),
      senior: s([12, 20], [0.5, 1], NO_EQ, [13, 21], {}),
    },
    "indian-unicorn": {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.3, 1), [5, 8], { notes: "1mg / PharmEasy / Truemeds / Netmeds pharmacist." }),
      mid: s([8, 14], [0.5, 1.5], ESOP(0.5, 2), [9, 16], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1.5, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
    },
    "consulting-big4": {
      entry: s([5, 8], [0.5, 1], NO_EQ, [5.5, 9], { notes: "EY / Deloitte life-sciences advisory / regulatory consulting." }),
      mid: s([9, 16], [1, 2.5], NO_EQ, [10, 18], { negotiation_leverage: "medium" }),
      senior: s([18, 30], [2, 5], NO_EQ, [20, 35], { negotiation_leverage: "medium" }),
    },
    "bfsi-global": {
      entry: s([10, 16], [1, 3], RSU(2, 5), [12, 22], { notes: "Insurance pharma underwriter / health-insurance product team." }),
      mid: s([18, 28], [2, 5], RSU(4, 10), [22, 40], { negotiation_leverage: "medium" }),
      senior: s([28, 45], [5, 10], RSU(8, 20), [38, 70], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([3, 5], [0.2, 0.4], NO_EQ, [3, 5], { negotiation_leverage: "low", notes: "Pharma IT (Cognizant Pharma / TCS Lifesciences) regulatory documentation." }),
      mid: s([5, 9], [0.3, 0.8], NO_EQ, [5, 10], { negotiation_leverage: "low" }),
      senior: s([9, 16], [0.8, 1.5], NO_EQ, [10, 18], { negotiation_leverage: "medium" }),
    },
  },

  // ─── CIVIL SERVICES (IAS / IPS / state cadres) ────────────────
  /* 7th CPC pay matrix anchors. Junior officer level = Level 10
     entry (₹56,100 basic). Pension + housing + DA + HRA +
     deputation often add 30-50% to gross. Negotiation is on
     posting/cadre, not base. */
  "civil-services": {
    "government-psu": {
      entry: s([7, 10], [0, 0.5], NO_EQ, [7, 12], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "IAS/IPS/IFS probationer, Level 10 pay matrix. After LBSNAA training, posted as Asst Collector / SP / Forest Officer." }),
      mid: s([12, 20], [0.5, 1], NO_EQ, [13, 22], { negotiation_leverage: "low", notes: "DM / SP / DCF level. Level 12-13 pay matrix. Add NPA / SCA depending on cadre." }),
      senior: s([22, 35], [1, 2], NO_EQ, [24, 38], { negotiation_leverage: "low", notes: "Joint Secretary / DIG / CCF level. Level 14-15 pay matrix." }),
      lead: s([35, 55], [2, 4], NO_EQ, [38, 60], { negotiation_leverage: "low", notes: "Additional Secretary / IGP / PCCF. Level 16 pay matrix." }),
      executive: s([55, 80], [3, 6], NO_EQ, [60, 90], { in_hand_ratio: 0.78, notes: "Secretary to Govt of India / DGP / CS. Level 17-18 (cabinet secretary equivalent)." }),
    },
    "it-services": {
      entry: s([5, 9], [0.3, 0.6], NO_EQ, [5, 10], { negotiation_leverage: "low", notes: "State PCS officers (MPSC/KPSC/TNPSC etc.), junior cadre." }),
      mid: s([10, 16], [0.5, 1], NO_EQ, [11, 18], { negotiation_leverage: "low" }),
      senior: s([18, 30], [1, 2], NO_EQ, [20, 32], { negotiation_leverage: "low" }),
    },
    "bfsi-domestic": {
      entry: s([8, 13], [0.5, 1.5], NO_EQ, [9, 15], { notes: "RBI Grade B / NABARD Grade A / SEBI Grade A officer." }),
      mid: s([14, 22], [1, 2], NO_EQ, [15, 24], { negotiation_leverage: "low" }),
      senior: s([22, 35], [2, 4], NO_EQ, [24, 38], { negotiation_leverage: "low" }),
    },
    /* Consulting MBB lateral (rare, McKinsey/BCG public sector practice
       ex-IAS/IPS officers who lateral out at Director level). */
    "consulting-mbb": {
      mid: s([28, 45], [5, 12], NO_EQ, [33, 55], { notes: "Ex-civil-services lateral (3-5 years) → MBB public sector practice." }),
      senior: s([55, 90], [12, 25], NO_EQ, [70, 120], { negotiation_leverage: "high", notes: "Director-level MBB consultant with civil-services background." }),
      lead: s([100, 160], [25, 50], NO_EQ, [125, 210], { in_hand_ratio: 0.50, notes: "MBB Partner with deep govt-sector network." }),
    },
    /* Consulting Big-4 govt advisory (Deloitte / EY / KPMG / PwC). */
    "consulting-big4": {
      entry: s([8, 13], [1, 2.5], NO_EQ, [9, 15], { notes: "Big-4 govt sector / public-finance advisory." }),
      mid: s([15, 25], [2.5, 5], NO_EQ, [17, 30], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [5, 10], NO_EQ, [30, 52], { negotiation_leverage: "medium" }),
    },
    /* SaaS-product (govtech / civictech, Bharat Cloud / SETU / DigiYatra). */
    "saas-product": {
      entry: s([10, 15], [1, 2], ESOP(1, 3), [11, 17], { notes: "GovTech / public-digital-infrastructure roles." }),
      mid: s([16, 26], [2, 4], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 7], ESOP(4, 10), [30, 50], { negotiation_leverage: "medium" }),
    },
    /* GCC public-affairs / govt-relations roles. */
    gcc: {
      entry: s([12, 18], [1, 3], RSU(2, 5), [14, 22], { notes: "Govt relations / public-affairs at multinational GCCs." }),
      mid: s([20, 32], [2, 5], RSU(5, 12), [24, 42], { negotiation_leverage: "medium" }),
      senior: s([32, 50], [4, 9], RSU(10, 22), [40, 70], { negotiation_leverage: "high" }),
    },
    /* FMCG MNC govt-relations (HUL / ITC / Marico, regulatory & public affairs). */
    "fmcg-mnc": {
      entry: s([10, 16], [1, 3], NO_EQ, [11, 20], { notes: "Govt relations / regulatory affairs at FMCG MNCs." }),
      mid: s([18, 28], [2, 5], NO_EQ, [22, 35], { negotiation_leverage: "medium" }),
      senior: s([30, 50], [4, 10], NO_EQ, [35, 60], { negotiation_leverage: "high" }),
    },
  },

  // ─── PERFORMING ARTS (classical / instrumental / contemporary) ─
  /* Indian classical artists earn primarily via concert circuits +
     guru-shishya teaching + festival fees + grants. Steep
     experience curve, top-bracket artists (Sangeet Natak Akademi
     awardees) earn ₹20-50L+ via concert circuits while mid-level
     artists earn modestly. */
  "performing-arts": {
    "indian-unicorn": {
      entry: s([2, 4], [0.2, 0.5], NO_EQ, [2, 5], { negotiation_leverage: "low", notes: "Junior artist / accompanist track. Concert + teaching combo; income lumpy." }),
      mid: s([5, 10], [0.5, 1.5], NO_EQ, [5, 12], { negotiation_leverage: "medium", notes: "Mid-career artist with regular concert circuit. Spotify/JioSaavn royalties added." }),
      senior: s([12, 25], [1, 4], NO_EQ, [14, 30], { negotiation_leverage: "high", notes: "Established artist with concert tours + teaching academy + recording contracts." }),
      lead: s([25, 60], [3, 10], NO_EQ, [30, 75], { negotiation_leverage: "high", notes: "Top-tier (Padma / Sangeet Natak Akademi / Filmfare), international tours + Bollywood playback." }),
    },
    edtech: {
      entry: s([3, 6], [0.2, 0.5], ESOP(0.3, 1), [3.5, 7], { notes: "Music-edtech (Splice/Indian Tutor) instructor track." }),
      mid: s([6, 12], [0.5, 1.5], ESOP(0.5, 2), [7, 14], { negotiation_leverage: "medium" }),
      senior: s([12, 22], [1, 3], ESOP(1, 4), [14, 26], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([4, 7], [0, 0.3], NO_EQ, [4, 8], { in_hand_ratio: 0.78, notes: "AIR / Doordarshan / Sangeet Natak Akademi staff artist (regular grade)." }),
      mid: s([7, 12], [0.3, 0.6], NO_EQ, [8, 13], { negotiation_leverage: "low" }),
      senior: s([12, 20], [0.5, 1], NO_EQ, [13, 22], { negotiation_leverage: "low" }),
    },
    "fmcg-mnc": {
      entry: s([4, 8], [0.5, 1.5], NO_EQ, [4.5, 10], { notes: "Brand / advertising playback singer + jingle artist + TV music director." }),
      mid: s([10, 20], [1.5, 4], NO_EQ, [12, 25], { negotiation_leverage: "medium" }),
      senior: s([20, 40], [4, 8], NO_EQ, [24, 48], { negotiation_leverage: "high" }),
    },
    /* IT-services L&D / corporate trainer / jingle artist contracts. */
    "it-services": {
      entry: s([3, 5], [0.2, 0.5], NO_EQ, [3, 6], { negotiation_leverage: "low", notes: "Corporate L&D trainer track, soft-skills/voice modulation." }),
      mid: s([5, 9], [0.4, 1], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      senior: s([10, 18], [0.8, 2], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
    },
    /* SaaS-product / creator economy (Spotify India / JioSaavn / Wynk
       music team + Spinny content / Snapchat creators). */
    "saas-product": {
      entry: s([5, 9], [0.3, 0.8], ESOP(0.5, 1.5), [5.5, 10], { notes: "Creator-economy / streaming-music platform team." }),
      mid: s([10, 18], [0.8, 2], ESOP(1, 3), [11, 21], { negotiation_leverage: "medium" }),
      senior: s([18, 32], [2, 5], ESOP(2, 6), [22, 38], { negotiation_leverage: "high" }),
    },
    /* Startup early, creator-led music/dance startups, Carnatic-tech. */
    "startup-early": {
      entry: s([3, 5], [0.2, 0.5], ESOP(0.5, 2), [3.5, 7], { notice_period_days: 15, negotiation_leverage: "low", notes: "Creator-tech / Indian classical-music edtech startup founder team." }),
      mid: s([5, 9], [0.3, 1], ESOP(1.5, 4), [6, 12], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([9, 16], [0.8, 2], ESOP(3, 8), [11, 22], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    "startup-growth": {
      entry: s([4, 7], [0.3, 0.7], ESOP(1, 2.5), [4.5, 9], { notes: "Growth-stage music-tech / live-event / creator startups." }),
      mid: s([7, 13], [0.5, 1.5], ESOP(1.5, 4), [8, 16], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1.5, 3], ESOP(3, 8), [16, 30], { negotiation_leverage: "high" }),
    },
    /* Big Tech (Apple/Google/Amazon audio teams; Spotify India). */
    "big-tech": {
      entry: s([10, 16], [1, 2], RSU(2, 5), [12, 21], { notes: "Apple Music / Google audio / Amazon Music India editorial." }),
      mid: s([16, 26], [2, 4], RSU(5, 12), [20, 35], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 7], RSU(10, 22), [32, 55], { negotiation_leverage: "high" }),
    },
    /* FAANG (very rare, entertainment partnerships / cultural advisory). */
    faang: {
      mid: s([22, 38], [3, 7], RSU(8, 18), [28, 55], { notes: "FAANG India entertainment partnerships / artist relations." }),
      senior: s([38, 60], [6, 12], RSU(18, 40), [55, 100], { negotiation_leverage: "high" }),
    },
    /* Consulting Big-4 (CSR / cultural advisory). */
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 11], { notes: "Big-4 cultural-sector / arts advisory / CSR-arts." }),
      mid: s([10, 17], [1, 2.5], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
    },
  },

  // ─── NURSING (separate ladder from doctor) ────────────────────
  /* Nurses earn substantially below doctors but with much steadier
     career growth. Government nurses (AIIMS / state hospitals) get
     7th CPC pay; private (Apollo / Fortis / Manipal) bands are
     20-30% higher at senior levels. */
  "nursing": {
    "government-psu": {
      entry: s([3.5, 6], [0, 0.3], NO_EQ, [3.5, 7], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "Staff Nurse Grade II, 7th CPC Level 7 (₹44,900 basic). DA + HRA = ₹6.5-8L total." }),
      mid: s([6, 10], [0.3, 0.6], NO_EQ, [6.5, 11], { notes: "Staff Nurse Grade I / Senior Sister, Level 8-9 pay matrix." }),
      senior: s([10, 18], [0.5, 1], NO_EQ, [11, 20], { notes: "Asst Nursing Superintendent / Nursing Officer, Level 11-12." }),
      lead: s([18, 28], [1, 2], NO_EQ, [19, 30], { notes: "Director Nursing / Nursing Superintendent, Level 13." }),
    },
    "indian-unicorn": {
      entry: s([3, 5], [0.2, 0.5], NO_EQ, [3, 5.5], { notes: "Apollo / Fortis / Max staff nurse, ICU/OT specialty." }),
      mid: s([5, 9], [0.4, 1], NO_EQ, [5.5, 10], { negotiation_leverage: "low" }),
      senior: s([9, 16], [0.8, 2], NO_EQ, [10, 18], { negotiation_leverage: "medium" }),
      lead: s([16, 26], [1.5, 3], NO_EQ, [18, 30], { notes: "Director Nursing at large private chain." }),
    },
    "fmcg-mnc": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { notes: "Pharma medical advisor / corporate occupational health nurse." }),
      mid: s([7, 12], [0.5, 1.5], NO_EQ, [8, 14], { negotiation_leverage: "medium" }),
      senior: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
    },
    "saas-product": {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.5, 1.5), [4.5, 8], { notes: "Healthtech (Practo/1mg/Apollo 24/7) telehealth nurse + clinical reviewer." }),
      mid: s([8, 14], [0.5, 1.5], ESOP(1, 3), [9, 16], { negotiation_leverage: "medium" }),
      senior: s([14, 24], [1.5, 3], ESOP(2, 5), [16, 28], { negotiation_leverage: "medium" }),
    },
    "bfsi-global": {
      entry: s([6, 10], [0.5, 1.5], NO_EQ, [7, 12], { notes: "Insurance medical underwriter (clinical-trained) at MetLife/AIG/Bajaj Allianz." }),
      mid: s([10, 16], [1, 2.5], NO_EQ, [11, 18], { negotiation_leverage: "medium" }),
      senior: s([16, 28], [2, 4], NO_EQ, [18, 32], { negotiation_leverage: "medium" }),
    },
    /* BFSI domestic (insurance medical reviewer at HDFC/ICICI/Axis health). */
    "bfsi-domestic": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4.5, 8], { notes: "HDFC ERGO / ICICI Lombard medical reviewer." }),
      mid: s([7, 12], [0.5, 1.2], NO_EQ, [8, 14], { negotiation_leverage: "low" }),
      senior: s([12, 20], [1, 2.5], NO_EQ, [14, 23], { negotiation_leverage: "medium" }),
    },
    /* IT-services pharma/health-IT (TCS Lifesciences, Cognizant Pharma). */
    "it-services": {
      entry: s([3, 5], [0.2, 0.4], NO_EQ, [3, 5.5], { notice_period_days: 90, negotiation_leverage: "low", notes: "Pharma IT / health-IT BPO clinical-coder track." }),
      mid: s([5, 9], [0.3, 0.8], NO_EQ, [5, 10], { notice_period_days: 90 }),
      senior: s([9, 16], [0.8, 1.5], NO_EQ, [10, 18], { notice_period_days: 90 }),
    },
    /* Startup growth (healthtech, Practo / 1mg / PharmEasy). */
    "startup-growth": {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.5, 1.5), [4.5, 8], { notes: "Healthtech (Practo/1mg/PharmEasy) staff nurse / telehealth." }),
      mid: s([7, 13], [0.5, 1.5], ESOP(1, 3), [8, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1.5, 3], ESOP(2, 5), [15, 26], { negotiation_leverage: "medium" }),
    },
    /* Startup early (healthtech / longevity / wellness startups). */
    "startup-early": {
      entry: s([3.5, 6], [0.3, 0.6], ESOP(0.5, 2), [4, 7], { notice_period_days: 15, negotiation_leverage: "low", notes: "Healthtech early-stage clinical operations." }),
      mid: s([6, 11], [0.4, 1.2], ESOP(1.5, 4), [7, 13], { notice_period_days: 30, negotiation_leverage: "medium" }),
      senior: s([11, 18], [1, 2.5], ESOP(3, 8), [13, 22], { notice_period_days: 30, negotiation_leverage: "medium" }),
    },
    /* Edtech medical (Marrow / DAMS / NEET tutoring / nursing edtech). */
    edtech: {
      entry: s([3.5, 6], [0.2, 0.5], ESOP(0.3, 1), [4, 7], { notes: "Medical edtech subject-matter expert (NEET/USMLE prep)." }),
      mid: s([6, 11], [0.4, 1], ESOP(0.5, 2), [7, 13], { negotiation_leverage: "low" }),
      senior: s([11, 18], [1, 2], ESOP(1, 3), [12, 21], { negotiation_leverage: "medium" }),
    },
    /* Consulting Big-4 (healthcare advisory). */
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 11], { notes: "Healthcare advisory at EY / Deloitte / KPMG / PwC." }),
      mid: s([10, 17], [1, 2.5], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
    },
    /* GCC (clinical research org / pharma R&D centers). */
    gcc: {
      entry: s([5, 8], [0.3, 0.8], RSU(0.5, 1.5), [5.5, 10], { notes: "Pharma GCC clinical operations / R&D-support." }),
      mid: s([9, 14], [0.5, 1.5], RSU(2, 5), [10, 17], { negotiation_leverage: "medium" }),
      senior: s([14, 22], [1.2, 3], RSU(4, 9), [16, 26], { negotiation_leverage: "medium" }),
    },
    /* Big Tech (Apple Health / Google Fit / Amazon Care clinical advisor). */
    "big-tech": {
      entry: s([10, 16], [1, 2], RSU(2, 5), [12, 22], { notes: "Apple Health / Google Fit / Amazon Care clinical advisor." }),
      mid: s([16, 26], [2, 4], RSU(5, 12), [20, 35], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 7], RSU(10, 22), [32, 55], { negotiation_leverage: "high" }),
    },
  },

  // ─── HARDWARE ENGINEER (VLSI / RTL / Verification / Analog) ───
  /* Distinct from electrical-engineer (broader). Chip design at
     NVIDIA / Qualcomm / Intel / AMD India GCC commands 1.5-2x
     mechanical-engineer pay. RTL / Verification / Physical Design
     specialists have very steep curves. */
  "hardware-engineer": {
    faang: {
      entry: s([22, 32], [2, 5], RSU(6, 12), [28, 45], { hot_skills: ["VLSI", "RTL", "Verification", "Physical Design", "ASIC", "FPGA"], notes: "NVIDIA / AMD / Qualcomm India entry-level chip design engineer." }),
      mid: s([35, 50], [4, 9], RSU(15, 32), [48, 80], { negotiation_leverage: "high" }),
      senior: s([50, 75], [8, 16], RSU(28, 60), [75, 130], { negotiation_leverage: "high" }),
      lead: s([75, 100], [12, 25], RSU(50, 110), [115, 200], { negotiation_leverage: "high" }),
    },
    "big-tech": {
      entry: s([18, 28], [2, 4], RSU(5, 11), [22, 40], { negotiation_leverage: "medium" }),
      mid: s([30, 45], [3, 7], RSU(12, 25), [40, 68], { negotiation_leverage: "medium" }),
      senior: s([45, 65], [6, 13], RSU(22, 45), [62, 110], { negotiation_leverage: "high" }),
    },
    gcc: {
      entry: s([14, 22], [1, 3], RSU(3, 8), [16, 30], { hot_skills: ["VLSI", "ASIC", "FPGA", "DV", "PD"], notes: "Intel / AMD / Qualcomm / Marvell / Synopsys / Cadence India GCC chip teams." }),
      mid: s([22, 35], [2, 5], RSU(8, 18), [28, 52], { negotiation_leverage: "medium" }),
      senior: s([35, 55], [5, 10], RSU(15, 32), [48, 90], { negotiation_leverage: "high" }),
      lead: s([55, 80], [9, 18], RSU(28, 60), [78, 140], { negotiation_leverage: "high" }),
    },
    "indian-unicorn": {
      entry: s([8, 14], [0.5, 1.5], ESOP(1, 3), [9, 17], { notes: "Mindgrove / InCore / Saankhya Labs / Tessolve fabless chip startup." }),
      mid: s([15, 24], [1, 3], ESOP(2, 5), [17, 30], { negotiation_leverage: "medium" }),
      senior: s([24, 40], [2, 5], ESOP(4, 10), [28, 50], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([4, 7], [0.2, 0.5], NO_EQ, [4, 8], { notes: "L&T Tech / KPIT / Sasken / Tata Elxsi semiconductor practice." }),
      mid: s([8, 14], [0.5, 1], NO_EQ, [8, 15], { negotiation_leverage: "low" }),
      senior: s([14, 24], [1, 2.5], NO_EQ, [15, 28], { negotiation_leverage: "medium" }),
    },
    "fmcg-mnc": {
      entry: s([6, 10], [0.5, 1], NO_EQ, [7, 11], { notes: "Bosch / Continental / GE Healthcare embedded SoC team." }),
      mid: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { in_hand_ratio: 0.78, notes: "ISRO / DRDO / BEL / SCL Mohali chip-design scientist." }),
      mid: s([10, 16], [0.5, 1], NO_EQ, [11, 17], { negotiation_leverage: "low" }),
      senior: s([16, 28], [1, 2], NO_EQ, [17, 30], { negotiation_leverage: "low" }),
    },
    /* SaaS-product (industrial-IoT / digital-twin / hardware-as-a-service). */
    "saas-product": {
      entry: s([10, 16], [0.5, 1.5], ESOP(1, 3), [11, 19], { notes: "Industrial-IoT / digital-twin SaaS hardware engineer." }),
      mid: s([16, 26], [1, 3], ESOP(2, 5), [19, 32], { negotiation_leverage: "medium" }),
      senior: s([26, 42], [3, 6], ESOP(4, 10), [32, 56], { negotiation_leverage: "high" }),
    },
    /* Startup growth (deep-tech: Skyroot / Agnikul / Pixxel / Mindgrove). */
    "startup-growth": {
      entry: s([8, 14], [0.5, 1.5], ESOP(2, 5), [10, 18], { hot_skills: ["VLSI", "RTL", "ASIC", "FPGA"], notes: "Deep-tech hardware startups (Mindgrove / InCore / Saankhya Labs)." }),
      mid: s([15, 24], [1, 3], ESOP(4, 10), [18, 32], { negotiation_leverage: "medium" }),
      senior: s([24, 38], [2.5, 5], ESOP(8, 18), [30, 50], { negotiation_leverage: "high" }),
    },
    /* Startup early (fabless / spacetech / EV-tech). */
    "startup-early": {
      entry: s([6, 12], [0.5, 1.5], ESOP(2, 6), [8, 16], { notice_period_days: 15, hot_skills: ["RTL", "ASIC", "FPGA"], notes: "Founding hardware engineer at fabless / space-tech / EV-tech startup." }),
      mid: s([12, 22], [1, 3], ESOP(5, 14), [14, 28], { notice_period_days: 30, negotiation_leverage: "high" }),
      senior: s([20, 35], [2, 5], ESOP(10, 25), [26, 50], { notice_period_days: 30, negotiation_leverage: "high" }),
    },
    /* BFSI global (trading hardware / FPGA-based low-latency). */
    "bfsi-global": {
      entry: s([22, 35], [3, 8], RSU(5, 12), [28, 50], { notes: "GS / JS / Citadel / Optiver India FPGA / low-latency trading hardware." }),
      mid: s([38, 60], [6, 15], RSU(15, 32), [50, 95], { negotiation_leverage: "high" }),
      senior: s([60, 95], [12, 25], RSU(30, 65), [90, 165], { negotiation_leverage: "high" }),
    },
    /* BFSI domestic (rare, banking infra hardware). */
    "bfsi-domestic": {
      entry: s([6, 10], [0.5, 1.2], NO_EQ, [7, 12], { notes: "HDFC / ICICI / Axis trading-floor hardware / data-center engineer." }),
      mid: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
    /* Edtech (semiconductor edtech, Newton/Skill-Lync/Maven Silicon). */
    edtech: {
      entry: s([5, 9], [0.3, 0.8], ESOP(0.5, 1.5), [6, 10], { notes: "Maven Silicon / Skill-Lync / Newton VLSI track instructor." }),
      mid: s([10, 16], [0.5, 1.5], ESOP(1, 3), [11, 18], { negotiation_leverage: "medium" }),
      senior: s([16, 26], [1.5, 3], ESOP(2, 5), [18, 30], { negotiation_leverage: "medium" }),
    },
    /* Consulting MBB deep-tech. */
    "consulting-mbb": {
      entry: s([18, 28], [3, 6], NO_EQ, [22, 36], { notes: "MBB deep-tech / semiconductor advisory practice." }),
      mid: s([32, 52], [6, 12], NO_EQ, [40, 68], { negotiation_leverage: "medium" }),
      senior: s([55, 85], [12, 22], NO_EQ, [70, 110], { negotiation_leverage: "high" }),
    },
    /* Consulting Big-4 advisory. */
    "consulting-big4": {
      entry: s([7, 11], [0.5, 1.2], NO_EQ, [8, 13], { notes: "Big-4 semiconductor / hardware advisory." }),
      mid: s([12, 20], [1, 2.5], NO_EQ, [13, 22], { negotiation_leverage: "medium" }),
      senior: s([20, 32], [2, 5], NO_EQ, [22, 36], { negotiation_leverage: "medium" }),
    },
  },

  // ─── PILOT (cadet → captain ladder; regulated profession) ─────
  /* Indian commercial pilots have a distinct comp curve: cadet/co-
     pilot starts ~₹15-25L, type-rated captain on wide-body crosses
     ₹2.5-3.5Cr at peak. Foreign airlines (Emirates/Qatar/Singapore)
     pay 1.5-2x Indian airlines. Highly regulated by DGCA. */
  "pilot": {
    "indian-unicorn": {
      entry: s([15, 25], [1, 3], NO_EQ, [16, 28], { notice_period_days: 90, negotiation_leverage: "low", notes: "First officer / co-pilot at IndiGo / Vistara / Akasa entry. Type-rating bond ₹15-30L common." }),
      mid: s([35, 60], [3, 8], NO_EQ, [38, 70], { notice_period_days: 90, negotiation_leverage: "medium", notes: "Type-rated first officer / junior captain (5-8 yrs). Narrow-body capt." }),
      senior: s([80, 140], [10, 25], NO_EQ, [90, 165], { notice_period_days: 180, negotiation_leverage: "high", notes: "Type-rated captain wide-body Air India / IndiGo. Long-haul international." }),
      lead: s([140, 220], [20, 40], NO_EQ, [160, 260], { notice_period_days: 180, negotiation_leverage: "high", notes: "Senior wide-body captain / line check captain / designated examiner." }),
      executive: s([200, 320], [30, 60], NO_EQ, [230, 380], { in_hand_ratio: 0.55, notes: "Chief pilot / VP flight operations." }),
    },
    "bfsi-global": {
      entry: s([20, 35], [2, 5], NO_EQ, [22, 40], { notes: "Foreign carrier (Emirates/Qatar/Singapore Airlines) cadet/F.O. India base." }),
      mid: s([55, 90], [6, 14], NO_EQ, [60, 105], { negotiation_leverage: "medium" }),
      senior: s([140, 220], [18, 35], NO_EQ, [155, 250], { notes: "Foreign carrier wide-body captain. Tax-friendly Gulf base." }),
      lead: s([240, 360], [35, 70], NO_EQ, [270, 420], { negotiation_leverage: "high" }),
    },
    "government-psu": {
      entry: s([12, 18], [0, 0.5], NO_EQ, [12, 19], { in_hand_ratio: 0.78, notice_period_days: 90, negotiation_leverage: "low", notes: "Air India / Indian Air Force pilot officer. AI lateral pilots get DGCA pay scale." }),
      mid: s([22, 40], [1, 3], NO_EQ, [24, 44], { negotiation_leverage: "low", notes: "IAF Squadron Leader / Wing Commander, 7th CPC pay matrix." }),
      senior: s([40, 65], [2, 5], NO_EQ, [44, 70], { negotiation_leverage: "low", notes: "IAF Group Captain / Air Commodore." }),
      lead: s([60, 90], [3, 7], NO_EQ, [65, 100], { notes: "Air Vice Marshal / Air Marshal." }),
    },
    "it-services": {
      entry: s([8, 14], [0.5, 1.5], NO_EQ, [9, 16], { negotiation_leverage: "low", notes: "Charter/business-jet pilot, helicopter ops at private operators." }),
      mid: s([18, 32], [1.5, 4], NO_EQ, [20, 38], { negotiation_leverage: "medium" }),
      senior: s([35, 60], [3, 8], NO_EQ, [40, 70], { negotiation_leverage: "medium" }),
    },
    "startup-growth": {
      entry: s([10, 16], [1, 2], ESOP(0.3, 1), [11, 18], { notes: "BluSmart / mobility-tech pilot training programs." }),
      mid: s([20, 35], [1.5, 4], ESOP(0.5, 2), [22, 40], { negotiation_leverage: "medium" }),
    },
  },

  // ─── INVESTMENT BANKER (Analyst → MD ladder; bulge bracket) ───
  /* Distinct from generic 'finance', IB has a unique progression
     (Analyst → Associate → VP → Director → MD) with steep cash +
     bonus curve. Bulge bracket at GS/MS/JPMC pays 1.5-2x boutique. */
  "investment-banker": {
    "bfsi-global": {
      entry: s([18, 30], [12, 25], RSU(2, 6), [32, 60], { notice_period_days: 60, negotiation_leverage: "low", notes: "Analyst (0-2 yrs) at Goldman / MS / JPM India. Bonus 30-60% of base." }),
      mid: s([40, 65], [25, 50], RSU(8, 18), [70, 130], { notice_period_days: 60, negotiation_leverage: "medium", notes: "Associate (3-5 yrs). Promoted from Analyst or post-MBA hire." }),
      senior: s([75, 110], [50, 95], RSU(18, 42), [140, 240], { notice_period_days: 90, negotiation_leverage: "high", notes: "VP (6-9 yrs). Bonus often exceeds base." }),
      lead: s([120, 180], [100, 200], RSU(40, 85), [260, 460], { notice_period_days: 90, negotiation_leverage: "high", notes: "Director (10-13 yrs)." }),
      executive: s([180, 280], [200, 400], RSU(80, 180), [450, 850], { in_hand_ratio: 0.52, notes: "Managing Director (14+ yrs). Top-bracket MD ₹10-20Cr." }),
    },
    "indian-unicorn": {
      entry: s([10, 18], [3, 8], ESOP(1, 3), [14, 28], { notes: "Boutique IB (Avendus / Centrum / JM Financial) analyst." }),
      mid: s([22, 38], [8, 18], ESOP(3, 8), [32, 60], { negotiation_leverage: "medium" }),
      senior: s([40, 70], [18, 38], ESOP(8, 18), [60, 120], { negotiation_leverage: "high" }),
      lead: s([75, 120], [35, 70], ESOP(18, 40), [120, 220], { negotiation_leverage: "high" }),
    },
    "consulting-mbb": {
      entry: s([18, 28], [4, 10], NO_EQ, [22, 38], { notes: "Pre-MBA M&A practice (McKinsey RTS / BCG TAS / Bain VPG)." }),
      mid: s([35, 55], [10, 20], NO_EQ, [45, 75], { negotiation_leverage: "medium" }),
      senior: s([65, 95], [20, 40], NO_EQ, [85, 135], { negotiation_leverage: "high" }),
    },
    "bfsi-domestic": {
      entry: s([8, 14], [3, 7], NO_EQ, [11, 21], { notes: "ICICI Securities / HDFC Securities / Axis Capital IB." }),
      mid: s([18, 32], [8, 16], NO_EQ, [26, 48], { negotiation_leverage: "medium" }),
      senior: s([35, 60], [16, 32], NO_EQ, [50, 92], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([10, 16], [2, 5], NO_EQ, [12, 21], { notes: "Big-4 Deal Advisory / Transactions practice." }),
      mid: s([20, 32], [5, 12], NO_EQ, [25, 44], { negotiation_leverage: "medium" }),
      senior: s([38, 60], [12, 25], NO_EQ, [50, 85], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([15, 24], [4, 9], ESOP(2, 5), [19, 33], { notes: "VC/PE associate at SequoiaSurge / Accel / Lightspeed India." }),
      mid: s([28, 45], [10, 20], ESOP(5, 12), [38, 65], { negotiation_leverage: "medium" }),
      senior: s([55, 85], [20, 40], ESOP(12, 28), [75, 125], { negotiation_leverage: "high" }),
    },
  },

  // ─── ARCHITECT (Building/urban architect, distinct from design-engineer) ─
  /* Distinct from design-engineer (digital). Architects work at
     studios (Hafeez Contractor / Studio Lotus) or in-house at
     real-estate cos. Pay ladder: junior → architect → project
     architect → principal architect → partner. */
  "architect": {
    "indian-unicorn": {
      entry: s([4, 7], [0.3, 0.6], NO_EQ, [4, 8], { notes: "Junior architect at top studio (Hafeez Contractor / Studio Lotus / Morphogenesis)." }),
      mid: s([8, 15], [0.5, 1.5], NO_EQ, [9, 17], { negotiation_leverage: "medium" }),
      senior: s([16, 28], [1.5, 4], ESOP(2, 5), [18, 32], { negotiation_leverage: "high", notes: "Senior architect / project architect at marquee studio." }),
      lead: s([28, 45], [3, 8], ESOP(4, 10), [32, 55], { negotiation_leverage: "high" }),
      executive: s([50, 90], [8, 18], ESOP(10, 25), [60, 120], { in_hand_ratio: 0.55, notes: "Principal architect / studio partner." }),
    },
    "fmcg-mnc": {
      entry: s([5, 9], [0.5, 1], NO_EQ, [6, 10], { notes: "DLF / Godrej / Lodha / Sobha in-house architect." }),
      mid: s([10, 18], [1, 2.5], NO_EQ, [11, 21], { negotiation_leverage: "medium" }),
      senior: s([18, 32], [2, 5], NO_EQ, [20, 36], { negotiation_leverage: "medium" }),
      lead: s([32, 55], [4, 10], NO_EQ, [36, 65], { negotiation_leverage: "high" }),
    },
    "consulting-big4": {
      entry: s([5, 9], [0.5, 1.2], NO_EQ, [6, 11], { notes: "Big-4 real-estate advisory architect." }),
      mid: s([10, 17], [1, 2.5], NO_EQ, [11, 19], { negotiation_leverage: "medium" }),
      senior: s([18, 28], [2, 5], NO_EQ, [20, 32], { negotiation_leverage: "medium" }),
    },
    "it-services": {
      entry: s([3, 5], [0.2, 0.4], NO_EQ, [3.5, 6], { negotiation_leverage: "low", notes: "Tier-2 architectural firm / freelance contracted." }),
      mid: s([5, 10], [0.4, 1], NO_EQ, [6, 11], { negotiation_leverage: "low" }),
      senior: s([10, 18], [1, 2.5], NO_EQ, [11, 20], { negotiation_leverage: "medium" }),
    },
    "government-psu": {
      entry: s([6, 10], [0, 0.5], NO_EQ, [6, 11], { in_hand_ratio: 0.78, notes: "CPWD / NHAI / CIDCO / DDA architect (Group A officer)." }),
      mid: s([10, 16], [0.5, 1], NO_EQ, [11, 17], { negotiation_leverage: "low" }),
      senior: s([16, 26], [1, 2], NO_EQ, [17, 28], { negotiation_leverage: "low" }),
    },
    "startup-growth": {
      entry: s([4, 7], [0.3, 0.6], ESOP(0.3, 1), [4, 8], { notes: "Proptech architect (Stanza Living / WeWork India / NoBroker design)." }),
      mid: s([7, 13], [0.5, 1.5], ESOP(0.5, 2), [8, 15], { negotiation_leverage: "medium" }),
      senior: s([13, 22], [1, 2.5], ESOP(2, 5), [15, 25], { negotiation_leverage: "high" }),
    },
  },

  // ─── CHEF (Executive chef → Corporate exec chef ladder) ───────
  /* Star chefs at marquee hotels (Taj/ITC/Oberoi) earn ₹50L-2Cr at
     senior level. Independent celebrity chefs earn via TV + brand
     deals. Cloud-kitchen chains pay ₹30-50% less than legacy hotels. */
  "chef": {
    "fmcg-mnc": {
      entry: s([3, 6], [0.2, 0.5], NO_EQ, [3.5, 7], { notes: "Commis chef / chef de partie at Taj / Oberoi / ITC." }),
      mid: s([7, 14], [0.5, 1.5], NO_EQ, [8, 16], { negotiation_leverage: "medium", notes: "Sous chef at 5-star hotel." }),
      senior: s([18, 35], [2, 5], NO_EQ, [22, 42], { negotiation_leverage: "high", notes: "Executive chef at Taj / Oberoi / ITC flagship." }),
      lead: s([40, 75], [5, 15], NO_EQ, [48, 95], { negotiation_leverage: "high", notes: "Corporate exec chef across hotel chain." }),
      executive: s([80, 150], [15, 35], NO_EQ, [100, 200], { in_hand_ratio: 0.55, notes: "Celebrity chef / restaurant brand owner. Top names cross ₹3-5Cr via TV + brand deals." }),
    },
    "indian-unicorn": {
      entry: s([3, 5], [0.3, 0.6], ESOP(0.3, 1), [3.5, 6], { notes: "Cloud-kitchen chain (Rebel Foods / Curefit) chef." }),
      mid: s([6, 11], [0.5, 1.2], ESOP(1, 3), [7, 13], { negotiation_leverage: "medium" }),
      senior: s([12, 22], [1.5, 3.5], ESOP(2, 5), [14, 26], { negotiation_leverage: "high" }),
    },
    "saas-product": {
      entry: s([4, 7], [0.3, 0.7], ESOP(0.3, 1.5), [4.5, 8], { notes: "Independent restaurant / fine-dining chef. Mumbai/Delhi/Bangalore market." }),
      mid: s([8, 15], [0.8, 2], ESOP(1, 3), [9, 17], { negotiation_leverage: "medium" }),
      senior: s([16, 30], [2, 5], ESOP(3, 8), [19, 35], { negotiation_leverage: "high" }),
    },
    "it-services": {
      entry: s([2, 4], [0.1, 0.3], NO_EQ, [2, 4.5], { negotiation_leverage: "low", notes: "Tier-2/3 city restaurant kitchen / corporate cafeteria." }),
      mid: s([4, 7], [0.2, 0.5], NO_EQ, [4.5, 8], { negotiation_leverage: "low" }),
      senior: s([7, 13], [0.5, 1.2], NO_EQ, [8, 14], { negotiation_leverage: "medium" }),
    },
    "startup-early": {
      entry: s([3, 5], [0.2, 0.5], ESOP(0.3, 1), [3.5, 6], { notes: "Early-stage food-tech / cloud-kitchen founding chef." }),
      mid: s([5, 9], [0.4, 1], ESOP(1, 3), [6, 11], { negotiation_leverage: "medium" }),
      senior: s([10, 18], [1, 2.5], ESOP(2, 6), [12, 22], { negotiation_leverage: "high" }),
    },
  },
};

/** Role key aliases, when a role key has no data, fall back to this key */
export const ROLE_ALIASES: Partial<Record<RoleKey, RoleKey>> = {
  "ai-engineer": "ml-engineer",
  "cloud-engineer": "devops-sre",
  "project-manager": "program-manager",
  "frontend-developer": "software-engineer",
  "backend-developer": "software-engineer",
  "mobile-developer": "software-engineer",
  "electrical-engineer": "mechanical-engineer",
  "civil-engineer": "mechanical-engineer",
  // Emerging 2026 roles — alias to closest existing band; can be split out
  // with their own bands later if market data justifies it.
  "design-engineer": "ux-designer", // engineering-coded designers, premium ~10-15% above pure UX at top product cos
  "product-marketing-manager": "marketing", // PMM is increasingly distinct from generic marketing; bands ~20-30% higher at SaaS
};

/* ─── DENSIFICATION ─────────────────────────────────────────────────
 * After SALARY_DATA + ROLE_ALIASES are declared, lift the runtime
 * fallback chain to module load: for every (role × tier × exp) cell
 * that's missing, fill it from the nearest sibling. This makes
 * SALARY_DATA fully indexable downstream — the salary-lookup layer
 * no longer needs to walk fallbacks, and every cell is addressable.
 *
 * Fill priority (mirrors generateNegotiationBand fallback chain):
 *   1. Same role + same tier + adjacent exp (entry↔mid↔senior↔lead↔exec)
 *   2. Same role + tier fallback (faang→big-tech, gcc→indian-unicorn, etc.)
 *   3. Aliased role + same tier
 *   4. software-engineer faang (last resort — bounded floor)
 *
 * Cells filled via densification carry the *_synthetic flag in notes
 * (when not already set) so audits can distinguish curated bands from
 * synthesized ones. The test suite uses this flag to compute a
 * "researched" sub-metric. */
const _ALL_TIERS_FOR_DENSIFY: CompanyTier[] = [
  "faang", "big-tech", "indian-unicorn", "it-services",
  "startup-early", "startup-growth",
  "consulting-mbb", "consulting-big4",
  "bfsi-global", "bfsi-domestic",
  "government-psu", "fmcg-mnc",
  "edtech", "saas-product", "gcc",
];
const _ALL_EXP_FOR_DENSIFY: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];
const _EXP_NEIGHBORS: Record<ExperienceLevel, ExperienceLevel[]> = {
  entry:     ["entry", "mid", "senior", "lead", "executive"],
  mid:       ["mid", "senior", "entry", "lead", "executive"],
  senior:    ["senior", "lead", "mid", "executive", "entry"],
  lead:      ["lead", "senior", "executive", "mid", "entry"],
  executive: ["executive", "lead", "senior", "mid", "entry"],
};
/* Inline mini-fallback for tier, mirrors getSalaryTierFallback in
   company-tiers.ts. Kept in-file to avoid a circular import. */
const _TIER_FALLBACK: Partial<Record<CompanyTier, CompanyTier>> = {
  "big-tech": "faang",
  gcc: "indian-unicorn",
  "saas-product": "indian-unicorn",
  "startup-early": "startup-growth",
  "consulting-big4": "consulting-mbb",
  "bfsi-domestic": "bfsi-global",
  edtech: "indian-unicorn",
  "fmcg-mnc": "indian-unicorn",
  "government-psu": "it-services",
};

interface _SiblingHit {
  band: SalaryEntry;
  /* Provenance string, which (role, tier, exp) the band came from. */
  source: string;
}

function _findSiblingBand(
  role: RoleKey,
  tier: CompanyTier,
  exp: ExperienceLevel,
): _SiblingHit | undefined {
  const roleData = SALARY_DATA[role];
  if (!roleData) return undefined;
  /* 1. Same role + same tier + adjacent exp. */
  const sameTier = roleData[tier];
  if (sameTier) {
    for (const e of _EXP_NEIGHBORS[exp]) {
      const cell = sameTier[e];
      if (cell) return { band: cell, source: `${role} × ${tier} × ${e}` };
    }
  }
  /* 2. Same role + fallback tier + adjacent exp. */
  const fbTier = _TIER_FALLBACK[tier];
  if (fbTier) {
    const fbTierData = roleData[fbTier];
    if (fbTierData) {
      for (const e of _EXP_NEIGHBORS[exp]) {
        const cell = fbTierData[e];
        if (cell) return { band: cell, source: `${role} × ${fbTier} × ${e} (tier-fallback)` };
      }
    }
  }
  return undefined;
}

function _densifySalaryData(): void {
  const allRoles = Object.keys(SALARY_DATA) as RoleKey[];
  for (const role of allRoles) {
    const roleData = SALARY_DATA[role];
    if (!roleData) continue;
    for (const tier of _ALL_TIERS_FOR_DENSIFY) {
      let tierData = roleData[tier];
      if (!tierData) {
        tierData = {};
        (roleData as Record<string, Partial<Record<ExperienceLevel, SalaryEntry>>>)[tier] = tierData;
      }
      for (const exp of _ALL_EXP_FOR_DENSIFY) {
        if (tierData[exp]) continue;
        /* 1+2: walk same-role exp + tier fallback. */
        let hit = _findSiblingBand(role, tier, exp);
        /* 3: aliased role. */
        if (!hit) {
          const aliased = ROLE_ALIASES[role];
          if (aliased) {
            const aHit = _findSiblingBand(aliased, tier, exp);
            if (aHit) hit = { band: aHit.band, source: `alias:${aHit.source}` };
          }
        }
        /* 4: SE last resort (faang preferred, faang.entry guaranteed). */
        if (!hit) {
          const seData = SALARY_DATA["software-engineer"];
          if (seData) {
            for (const t of [tier, "faang" as CompanyTier]) {
              const tData = seData[t];
              if (tData) {
                for (const e of _EXP_NEIGHBORS[exp]) {
                  if (tData[e]) {
                    hit = { band: tData[e]!, source: `last-resort:software-engineer × ${t} × ${e}` };
                    break;
                  }
                }
                if (hit) break;
              }
            }
          }
        }
        if (hit) {
          /* Clone so curated cells stay clean (we're tagging the COPY,
             not the source). Object spread is sufficient; SalaryEntry
             has no nested mutables that matter post-load. */
          tierData[exp] = {
            ...hit.band,
            _synthetic: true,
            _synthetic_source: hit.source,
          };
        }
      }
    }
  }
}

_densifySalaryData();

/**
 * Map a free-text role string to a RoleKey.
 * Uses substring matching (same approach as getRoleCompetencies).
 */
export function matchRoleKey(role: string): RoleKey {
  return matchRoleKeyResolved(role).key;
}

/**
 * Like matchRoleKey, but also reports whether the role string actually
 * matched a known role (`matched: true`) or fell through to the
 * software-engineer catch-all default (`matched: false`). This is the
 * single source of truth for role resolution — matchRoleKey delegates
 * here. Callers that must not silently trust a defaulted role (e.g. the
 * negotiation-band derivation, which otherwise shows a confident but
 * arbitrary band for an unmapped role — OA-B19) read `matched`.
 */
export function matchRoleKeyResolved(role: string): { key: RoleKey; matched: boolean } {
  if (!role) return { key: "software-engineer", matched: false };
  /* Normalize for substring matching: lowercase, strip parens /
     ampersands / extra punctuation, collapse whitespace. So
     "R&D Manager (Consumer)" → "rd manager consumer", "Partner
     (PE/VC)" → "partner pevc", "Group Head - Copy" → "group head copy".
     The original `lower` is also kept for patterns that still need
     punctuation (rare). */
  const lower = role.toLowerCase();
  const normalized = lower
    .replace(/&/g, "")
    .replace(/[()/-]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  /* Standalone-acronym short-circuit: 2-3-letter inputs like "CA",
     "CS", "MD", "PM", "EM", "HR" can't safely substring-match (would
     trigger inside any longer word). Match by exact equality. */
  const acronymMap: Record<string, RoleKey> = {
    ca: "chartered-accountant",
    cs: "legal",
    md: "doctor",
    pm: "product-manager",
    em: "engineering-manager",
    hr: "hr",
    ux: "ux-designer",
    ui: "ux-designer",
    qa: "qa-engineer",
    ba: "business-analyst",
    cto: "engineering-manager",
    cpo: "product-manager",
    cfo: "finance",
    coo: "engineering-manager",
    ceo: "engineering-manager",
    chro: "hr",
    cmo: "marketing",
    cro: "sales",
    /* Session A audit (2026-05-14), acronyms that previously fell to
     * software-engineer default. */
    tpm: "program-manager",
    pmm: "product-marketing-manager",
    sde: "software-engineer",
    swe: "software-engineer",
  };
  if (acronymMap[normalized]) return { key: acronymMap[normalized], matched: true };

  // Ordered from most specific to least specific to avoid false matches
  const patterns: [string[], RoleKey][] = [
    /* ─── 2026 niche-routing patterns (must come BEFORE generic
       patterns, these handle the long tail of specialised titles
       that previously routed to software-engineer default). ─── */
    /* Civil Services, IAS / IPS / state cadre / SDM / collector etc. */
    [["ias officer", "ips officer", "ifs officer", "irs officer", "iaas officer", "iis officer",
      "indian administrative service", "indian police service", "indian foreign service",
      "indian revenue service", "indian forest service", "indian audit", "indian information service",
      "civil service", "civil services", "state civil service", "pcs officer", "mpsc officer",
      "kpsc officer", "tnpsc officer", "wbpsc officer", "bpsc officer", "rpsc officer", "uppsc officer",
      "ras officer", "kas officer", "hcs officer", "gpsc officer", "deputy collector", "collector",
      "district magistrate", "sub-divisional magistrate", "sdm", "tehsildar", "naib tehsildar",
      "tahsildar", "patwari", "lekhpal", "kanungo", "block development officer", "bdo",
      "joint secretary", "additional secretary", "secretary to govt", "cabinet secretary",
      "principal secretary", "joint commissioner", "deputy commissioner", "additional commissioner",
      "section officer", "under secretary", "joint magistrate", "additional district magistrate",
      "city magistrate", "revenue officer", "land records officer", "conservator of forest",
      "chief conservator of forest", "forest range officer", "range officer", "deputy range officer",
      "ifoss officer", "ifs officer (forest)"], "civil-services"],
    /* Police hierarchy explicit, DSP / SP / DGP etc. (separate from
       civil-services because some users target police specifically). */
    [["sub-inspector", "sub inspector", "inspector (police)", "police inspector", "dsp",
      "additional sp", "sp (police)", "senior sp", "dig (police)", "ig (police)", "additional dgp",
      "dgp", "special dgp", "police constable", "head constable", "asi", "assistant sub-inspector",
      "deputy commissioner of police", "dcp", "acp", "assistant commissioner of police",
      "commissioner of police"], "civil-services"],
    /* Defence ranks, route to civil-services tier (govt-psu band).
       More specific than the generic "officer" pattern below. */
    [["sepoy", "lance naik", "havildar", "subedar major", "junior commissioned officer",
      "honorary lieutenant", "honorary captain", "lieutenant colonel", "field marshal",
      "lieutenant general", "major general", "wing commander", "group captain", "air commodore",
      "air vice marshal", "air marshal", "air chief marshal", "commodore", "rear admiral",
      "vice admiral", "admiral of the fleet", "ndrf", "itbp officer", "bsf officer",
      "crpf officer", "cisf officer", "ssb officer", "assam rifles officer", "nsg officer",
      "spg officer", "raf officer", "indian army", "indian navy", "indian air force",
      "indian coast guard", "ndc officer"], "civil-services"],
    /* Performing Arts, classical dance / vocals / instruments / Bollywood. */
    [["bharatanatyam", "kathak", "kathakali", "kuchipudi", "mohiniyattam", "odissi", "manipuri",
      "sattriya", "hindustani vocalist", "carnatic vocalist", "playback singer", "music director",
      "sitar player", "sitar guru", "tabla player", "tabla guru", "sarod player", "veena player",
      "flute player", "sarangi player", "mridangam player", "harmonium player", "shehnai player",
      "santoor player", "pakhawaj player", "classical dancer", "folk dancer", "bharatanatyam guru",
      "kathak guru", "kathakali guru", "kuchipudi guru", "odissi guru", "music guru",
      "vocal guru", "dance guru", "concert artist", "playback artist", "music composer",
      "lyricist (bollywood)", "songwriter", "theatre actor", "stand-up comedian", "stand up comedian",
      "improv performer", "mime artist", "magician", "illusionist", "puppeteer", "storyteller",
      "sutradhar", "performing artist", "cultural artist", "akademi awardee", "padma awardee"], "performing-arts"],
    /* Religious / spiritual roles, route to performing-arts band
       (closest analog: lumpy income, teaching + festival circuit). */
    [["pandit", "purohit", "brahmin priest", "vedic scholar", "acharya", "mahant", "swami",
      "shankaracharya", "imam", "mufti", "maulana", "maulvi", "qari", "hafiz", "granthi",
      "giani", "ragi", "pathi", "pastor", "reverend", "bishop", "archbishop", "cardinal",
      "catholic priest", "protestant minister", "deacon", "catechist", "buddhist monk", "lama",
      "rinpoche", "bhikkhu", "bhikkhuni", "jain monk", "sadhu", "sadhvi", "astrologer",
      "vedic astrologer", "numerologist", "palmist", "vastu consultant", "feng shui consultant",
      "tarot reader", "religious scholar", "theology professor"], "performing-arts"],
    /* Nursing, split from doctor. ICU / OT / ward / ANM etc. */
    [["staff nurse", "registered nurse", "nurse practitioner", "nursing officer", "icu nurse",
      "operation theatre nurse", "ot nurse", "er nurse", "pediatric nurse", "oncology nurse",
      "ward sister", "charge nurse", "nursing sister", "nursing superintendent",
      "asst nursing superintendent", "deputy nursing superintendent", "director nursing",
      "director of nursing", "school nurse", "public health nurse", "anm", "auxiliary nurse midwife",
      "asha worker", "anganwadi worker", "multi-purpose health worker",
      "nursing trainee", "nursing intern", "nursing", "nurse"], "nursing"],
    /* Hardware Engineer, VLSI / RTL / Verification / Physical Design / ASIC / FPGA / Analog. */
    [["vlsi", "rtl design", "rtl engineer", "physical design engineer", "pd engineer",
      "verification engineer", "dv engineer", "uvm verification", "formal verification",
      "asic design", "asic engineer", "fpga engineer", "fpga design", "dsp engineer",
      "signal processing engineer", "image processing engineer", "analog design engineer",
      "mixed signal", "rf design engineer", "layout engineer", "silicon validation",
      "post-silicon validation", "pre-silicon validation", "chip design", "soc design",
      "soc engineer", "hardware design engineer", "ic design", "semiconductor design",
      "wafer process engineer", "photonics engineer"], "hardware-engineer"],
    /* Hospital granular staff, route to nursing (closest band match
       for OT/ward/lab-tech roles). */
    [["ot assistant", "ot technologist", "ot technician", "ward boy", "ward helper",
      "health inspector", "sanitary inspector", "physiotherapy assistant",
      "dental hygienist", "dental assistant", "medical records officer", "medical coding",
      "health information manager", "patient relations manager", "patient experience officer",
      "x-ray technician", "mri technician", "ct scan technician", "sonographer",
      "cath lab technician", "dialysis technician", "anesthesia technician", "ecg technician",
      "lab technician", "medical technologist"], "nursing"],
    /* Niche legal specializations explicit, Senior Counsel / Disputes etc. */
    [["senior counsel", "principal associate (law)", "general counsel", "deputy general counsel",
      "in-house counsel", "company secretary", "head of legal", "managing partner (law)",
      "litigation lawyer", "litigation counsel", "disputes lawyer", "arbitration specialist",
      "dispute resolution specialist", "contract drafting specialist", "patent attorney",
      "patent agent", "trademark attorney", "ip counsel", "privacy counsel", "data protection officer",
      "regulatory counsel", "tax lawyer", "tax advisor", "real estate lawyer", "employment lawyer",
      "labour law specialist", "fintech lawyer", "crypto lawyer", "cybersecurity lawyer",
      "ai/tech lawyer", "anti-bribery officer", "fcpa specialist", "sanctions officer",
      "trade compliance specialist", "legal operations manager", "legal ops lead",
      "legal tech manager", "paralegal"], "legal"],
    /* Quant niche, route to data-scientist (override for "Risk Quant"
       and similar that previously went to SE). */
    [["risk quant", "quant risk", "quant risk manager", "quant strategist",
      "quant developer", "systematic strategist"], "data-scientist"],
    /* Marketing analytics niche, route to data-analyst. */
    [["attribution analyst", "mix modeling analyst", "mmm analyst", "marketing data analyst",
      "marketing analyst", "digital analytics manager", "adobe analytics specialist",
      "ga4 specialist", "web analyst"], "data-analyst"],
    /* Compensation / payroll / HRIS niche, route to hr. */
    [["compensation analyst", "comp analyst", "compensation & benefits", "c&b manager",
      "total rewards manager", "benefits manager", "payroll manager", "payroll specialist",
      "hris manager", "workday specialist", "successfactors specialist", "peoplesoft specialist",
      "oracle hcm specialist", "people analytics manager", "people analytics lead"], "hr"],
    /* Procurement niche, route to operations. */
    [["procurement executive", "procurement manager", "procurement director", "vp procurement",
      "chief procurement officer", "strategic sourcing manager", "senior sourcing manager",
      "category manager (procurement)", "indirect buyer", "direct buyer", "vendor manager",
      "vendor development manager", "demand planner", "supply planner", "s&op manager"], "operations"],
    /* Accounts ladder explicit, route to finance. */
    [["accounts payable", "ap manager", "ap lead", "p2p analyst", "accounts receivable",
      "ar manager", "ar lead", "o2c analyst", "gl accountant", "gl manager", "r2r analyst",
      "forensic accountant", "forensic auditor", "fraud examiner", "internal auditor",
      "external auditor", "statutory auditor", "audit manager", "audit director",
      "controller", "financial controller", "cost accountant", "management accountant",
      "tax analyst", "tax manager", "tax director", "direct tax specialist", "indirect tax specialist",
      "gst manager", "transfer pricing specialist", "international tax specialist",
      "treasury analyst", "treasury manager", "group treasurer", "investor relations manager",
      "corporate finance analyst", "fp&a analyst", "fp&a manager", "fp&a director",
      "business finance partner", "commercial finance manager", "pricing analyst",
      "pricing manager", "pricing director"], "finance"],
    /* Insurance underwriter / actuary niche, route to finance. */
    [["insurance underwriter", "underwriter", "insurance sales officer", "insurance advisor",
      "insurance surveyor", "loss adjuster", "actuary", "pricing actuary", "reserving actuary",
      "reinsurance analyst", "claims manager", "claims adjuster"], "finance"],
    /* Fintech / payments / cards niche, route to product-manager. */
    [["payments engineer", "payments architect", "payments operations", "merchant acquiring manager",
      "card issuing manager", "upi engineer", "card network engineer", "reconciliation engineer",
      "settlement engineer", "chargeback specialist", "fintech product manager", "lending product manager",
      "cards product manager", "payments product manager", "insurance product manager",
      "wealth tech pm", "wealthtech product manager"], "product-manager"],
    /* AI niche specialist titles, route to ai-engineer. */
    [["llm engineer", "rag engineer", "ai agents engineer", "agentic systems", "prompt engineer",
      "prompt ops engineer", "ai solutions architect", "ai platform engineer", "ai infrastructure engineer",
      "ai research scientist", "ai research engineer", "ai product manager", "head of ai",
      "conversational ai engineer", "speech ai engineer", "speech recognition engineer", "voice ai engineer",
      "tts engineer", "reinforcement learning engineer", "rl researcher", "ai quality engineer",
      "ai evals engineer", "ai safety researcher", "responsible ai", "ai ethics", "ai governance",
      "ai risk analyst", "ai compliance officer", "ai trainer", "ai annotator", "data labeling",
      "ai solutions consultant", "ai sales engineer", "ai customer success", "ai implementation",
      "ai integration", "foundation model", "vector database engineer", "embeddings engineer",
      "retrieval engineer", "agent framework engineer", "ai orchestration", "mcp engineer",
      "tool-use engineer", "multimodal ai", "generative vision engineer", "diffusion models engineer",
      "ai red teamer", "ai penetration tester", "ai audit specialist", "ai bias auditor",
      "ai model governance", "ai risk & compliance", "synthetic media detection", "deepfake forensics"], "ai-engineer"],
    /* Cybersecurity niche, incident response, AppSec, IAM, etc. */
    [["soc analyst", "soc l1", "soc l2", "soc l3", "threat hunter", "threat intelligence analyst",
      "incident response engineer", "incident response specialist", "incident responder",
      "appsec engineer", "appsec architect", "cloud security engineer", "cloud security architect",
      "network security engineer", "network security architect", "endpoint security engineer",
      "endpoint detection engineer", "edr specialist", "iam engineer", "iam architect",
      "privileged access management", "pam engineer", "red team engineer", "blue team engineer",
      "purple team engineer", "bug bounty hunter", "vulnerability management", "vulnerability analyst",
      "security architect", "deputy ciso", "field ciso", "forensics investigator", "digital forensics",
      "devsecops architect", "grc analyst", "grc manager", "security awareness trainer",
      "security researcher", "malware analyst", "reverse engineer", "cryptography engineer",
      "pki engineer", "zero trust architect", "post-quantum crypto", "smart contract auditor",
      "blockchain auditor"], "cybersecurity"],
    /* DevOps / SRE niche specialist titles. */
    [["build engineer", "release engineer", "ci/cd engineer", "configuration manager",
      "configuration engineer", "tooling engineer", "container platform engineer", "kubernetes specialist",
      "docker specialist", "openshift engineer", "terraform engineer", "ansible engineer",
      "pulumi engineer", "chef engineer", "puppet engineer", "finops engineer", "finops analyst",
      "cloud cost optimization engineer", "observability engineer", "monitoring engineer",
      "reliability engineer (production)", "production engineer", "edge engineer", "cdn engineer",
      "network reliability engineer", "rpa developer", "uipath developer", "blue prism developer",
      "automation anywhere developer", "pega developer"], "devops-sre"],
    /* Customer Success niche. */
    [["customer success engineer", "customer success architect", "implementation manager",
      "onboarding specialist", "onboarding manager", "voice of customer analyst", "voc specialist",
      "customer insights manager"], "customer-success"],
    /* Sales niche specialist titles. */
    [["account executive", "enterprise account executive", "smb account executive", "inside sales representative",
      "outside sales representative", "field sales executive", "field sales manager", "territory sales manager",
      "key account manager", "kam", "strategic account manager", "global account manager",
      "enterprise sales director", "saas sales lead", "b2b sales lead", "b2c sales lead",
      "sales development representative", "sdr", "bdr", "sales operations analyst", "sales ops",
      "revenue operations", "revops", "sales enablement manager", "pre-sales engineer", "presales engineer",
      "solutions engineer", "technical account manager", "tam", "customer solutions engineer",
      "channel sales manager", "channel partner manager", "distribution manager", "partnerships manager",
      "strategic partnerships lead", "alliances manager", "channel alliances manager", "reseller manager",
      "oem sales manager"], "sales"],
    /* Marketing niche specialist titles. */
    [["product marketing manager", "pmm", "demand generation manager", "demand gen", "demand gen lead",
      "lead generation manager", "pipeline marketing manager", "lifecycle marketing manager",
      "growth marketing manager", "performance marketing manager", "seo specialist", "seo manager",
      "sem specialist", "ppc specialist", "google ads specialist", "meta ads specialist",
      "paid social specialist", "paid search specialist", "programmatic specialist", "dv360 specialist",
      "dsp specialist", "programmatic trader", "email marketing manager", "crm marketing manager",
      "lifecycle email manager", "marketing automation specialist", "hubspot specialist",
      "marketo specialist", "salesforce marketing cloud specialist", "pardot specialist", "klaviyo specialist",
      "content marketing manager", "head of content", "editorial manager", "social media manager",
      "social media strategist", "head of social", "community manager", "influencer marketing manager",
      "influencer strategist", "affiliate marketing manager", "pr manager", "public relations director",
      "communications manager", "internal communications manager", "external affairs manager",
      "crisis communications", "investor communications", "executive communications", "field marketing manager",
      "abm manager", "account-based marketing", "marketing operations manager", "mops lead",
      "mops"], "marketing"],
    /* Real estate / property niche. */
    [["real estate agent", "real estate broker", "property consultant", "channel sales manager (re)",
      "property sales manager", "real estate investment analyst", "reit analyst", "reit manager",
      "property manager", "facility manager", "soft services manager", "hard services manager",
      "mall manager", "retail property manager"], "operations"],
    /* Architecture & urban design, route to design-engineer (closest
       structurally, both are senior-IC creative ladders). */
    [["architect", "design architect", "project architect", "lead architect", "architectural designer",
      "interior architect", "interior designer", "interior decorator", "interior stylist",
      "set designer", "urban designer", "urban planner", "town planner", "master planner",
      "transport planner", "landscape architect", "landscape designer", "bim manager",
      "bim coordinator", "bim modeler", "revit specialist"], "design-engineer"],
    /* PSU engineer ladder, route to mechanical (broad PSU comp). */
    [["junior engineer (psu)", "assistant engineer (psu)", "executive engineer (psu)",
      "superintending engineer", "chief engineer (psu)", "agm (psu)", "dgm (psu)", "gm (psu)",
      "ed (psu)", "director (psu)", "isro scientist", "drdo scientist", "barc scientist",
      "bhel engineer", "ntpc engineer", "ongc engineer", "gail engineer", "iocl engineer",
      "bpcl engineer", "hpcl engineer", "coal india engineer", "nmdc engineer", "sail engineer",
      "rvnl engineer", "dmrc engineer"], "mechanical-engineer"],
    /* Fashion / apparel / jewelry, route to design-engineer. */
    [["fashion designer", "pattern maker", "textile designer", "apparel merchandiser",
      "apparel quality inspector", "jewelry designer", "diamond grader", "gemologist",
      "cad jewelry designer", "fashion stylist"], "design-engineer"],
    /* Cleantech / EV / battery, route to electrical-engineer. */
    [["sustainability engineer", "carbon accounting specialist", "esg reporting specialist",
      "climate tech engineer", "cleantech product manager", "hydrogen engineer", "carbon capture engineer",
      "electrolyzer engineer", "battery engineer", "battery pack designer", "cell engineer",
      "ev powertrain engineer", "motor controller engineer", "power electronics engineer",
      "bms engineer", "renewable energy engineer", "solar energy engineer", "wind energy engineer"], "electrical-engineer"],
    /* Aerospace specialist titles, route to mechanical-engineer. */
    [["aerospace engineer", "aircraft maintenance engineer", "ame", "aircraft design engineer",
      "avionics engineer", "flight test engineer", "aerodynamics engineer", "propulsion engineer",
      "stress engineer", "aircraft structural engineer", "composite engineer (aero)",
      "spacecraft engineer", "satellite systems engineer", "mission operations engineer",
      "launch vehicle engineer", "payload engineer", "ground systems engineer", "defense systems engineer",
      "naval architect", "marine engineer", "submarine engineer", "weapon systems engineer",
      "radar engineer", "sonar engineer", "ew engineer"], "mechanical-engineer"],
    /* Civil engineering niche specialist titles. */
    [["site engineer", "structural engineer", "geotechnical engineer", "highway engineer",
      "bridge engineer", "tunnel engineer", "dam engineer", "construction engineer", "construction manager",
      "quantity surveyor", "qs engineer", "estimation engineer", "tender engineer", "contracts engineer",
      "contracts manager", "planning engineer", "primavera engineer", "msp planning engineer",
      "hvac engineer", "plumbing engineer", "mep engineer", "mep designer", "mep project manager"], "civil-engineer"],
    /* Manufacturing / production niche. */
    [["mechanical design engineer", "cad engineer", "cad designer", "autocad engineer",
      "solidworks engineer", "catia engineer", "ptc creo engineer", "production engineer",
      "manufacturing engineer", "industrial engineer", "process engineer", "quality engineer (mfg)",
      "six sigma black belt", "lean manufacturing engineer", "maintenance engineer",
      "reliability engineer (mfg)", "plant engineer", "plant manager", "project engineer (mech)",
      "tooling engineer", "jigs & fixtures engineer", "stamping engineer"], "mechanical-engineer"],
    /* Chemical / petroleum / mining / metallurgy. */
    [["chemical engineer", "process engineer (chemical)", "petroleum engineer", "reservoir engineer",
      "drilling engineer", "production engineer (oil & gas)", "petrochemical engineer", "refinery engineer",
      "pipeline engineer", "subsea engineer", "mining engineer", "geologist", "exploration geologist",
      "metallurgical engineer", "metallurgist", "foundry engineer", "heat treatment engineer",
      "materials engineer", "materials scientist", "polymer engineer", "composite materials engineer",
      "coating engineer", "corrosion engineer", "environmental engineer", "ehs engineer",
      "ehs manager", "industrial safety engineer"], "mechanical-engineer"],
    /* Auto OEM / ancillary engineer ladder. */
    [["adas engineer", "automotive software engineer", "automotive electronics engineer",
      "autosar engineer"], "embedded-engineer"],
    /* Robotics. */
    [["robotics software engineer", "robotics hardware engineer", "robot perception engineer",
      "robot motion planning engineer", "cobot engineer", "robotic process automation developer",
      "robotics researcher"], "embedded-engineer"],
    /* Pilots, dedicated RoleKey (distinct comp curve from operations). */
    [["pilot", "trainee pilot", "cadet pilot", "co-pilot", "first officer", "type-rated first officer",
      "type-rated captain", "line check captain", "designated examiner", "chief pilot",
      "director of flight operations", "vp flight operations", "captain (pilot)", "second officer",
      "commercial pilot", "airline pilot", "helicopter pilot", "private pilot", "charter pilot",
      "business jet pilot"], "pilot"],
    /* Aviation cabin crew / ATC / AME, route to operations. */
    [["cabin crew", "lead cabin crew", "cabin manager", "inflight service manager", "purser",
      "aircraft mechanic", "avionics mechanic", "engine mechanic",
      "ame (airframe)", "ame (engine)", "ame (avionics)", "ame (electrical)",
      "ame (instrumentation)", "quality inspector (aviation)", "dgca inspector",
      "air traffic controller", "atco", "watch supervisor (atc)", "atc manager",
      "ground staff", "ground operations manager", "airport operations manager", "airport manager",
      "station manager", "ramp agent", "airline customer service agent", "airline reservations agent"], "operations"],
    /* Investment Banker, dedicated RoleKey (distinct from finance). */
    [["investment banking analyst", "ib analyst", "investment banking associate", "ib associate",
      "ib vp", "ib director", "ib managing director", "ib senior managing director",
      "m&a analyst", "m&a associate", "m&a vp", "ecm analyst", "dcm analyst",
      "leveraged finance analyst", "structured finance analyst", "project finance analyst",
      "real estate finance analyst", "investment banker", "private equity analyst", "pe associate",
      "pe senior associate", "pe vice president", "pe director", "pe managing director",
      "venture partner", "investment partner", "principal (vc)", "senior associate (vc)",
      "associate (vc)", "analyst (vc)", "investment director", "managing director (vc)",
      "investment manager", "portfolio manager (vc)"], "investment-banker"],
    /* Architect (building / urban / interior, distinct from design-engineer). */
    [["architect", "junior architect", "design architect", "senior design architect",
      "lead architect", "project architect", "principal architect", "architectural designer",
      "architect trainee", "interior architect", "landscape architect", "urban architect",
      "architectural visualizer", "studio principal architect"], "architect"],
    /* Chef / F&B kitchen ladder, dedicated RoleKey. */
    [["chef", "executive chef", "senior sous chef", "sous chef", "chef de partie",
      "demi chef de partie", "commis chef", "pastry chef", "senior pastry chef", "bakery chef",
      "banquet chef", "continental chef", "indian chef", "tandoor chef", "chinese chef",
      "asian chef", "celebrity chef", "consultant chef", "corporate chef",
      "head chef", "saucier", "garde manger", "patissier"], "chef"],
    /* Hospitality F&B / kitchen ladder, route to operations. */
    [["hotel general manager", "hotel manager", "resident manager", "front office manager",
      "reception manager", "reservations manager", "concierge", "f&b manager", "f and b manager",
      "banquet manager", "restaurant manager", "bar manager", "mixologist", "bartender", "sommelier",
      "executive chef", "sous chef", "chef de partie", "demi chef de partie", "commis chef",
      "pastry chef", "bakery chef", "banquet chef", "continental chef", "indian chef",
      "tandoor chef", "chinese chef", "asian chef", "housekeeping manager", "executive housekeeper",
      "floor supervisor", "spa manager", "spa director", "spa therapist", "massage therapist",
      "wellness consultant", "revenue manager (hotel)", "director of revenue (hotel)",
      "wedding coordinator", "wedding planner", "event coordinator (hotel)", "florist",
      "floral designer", "event decorator", "set stylist"], "operations"],
    /* Retail / store ops. */
    [["store manager", "assistant store manager", "department manager (retail)", "retail manager",
      "retail operations manager", "retail director", "visual merchandiser", "vm lead",
      "window display designer", "merchandiser", "buyer (retail)", "planner (retail)",
      "allocation analyst", "inventory planner", "demand planner (retail)", "marketplace manager",
      "e-commerce manager", "catalog manager", "listing specialist", "pricing manager (retail)",
      "discount strategy manager", "cashier", "floor associate", "sales associate",
      "customer service associate (retail)", "loss prevention officer"], "operations"],
    /* Trades / skilled labour, route to operations (PSU/services). */
    [["electrician", "plumber", "carpenter", "welder", "tig welder", "mig welder", "pipe welder",
      "structural welder", "mason", "construction worker", "tile layer", "painter (construction)",
      "auto mechanic", "diesel mechanic", "heavy equipment mechanic", "two-wheeler mechanic",
      "air conditioner mechanic", "refrigeration mechanic", "tailor", "master tailor",
      "sewing machine operator", "goldsmith", "jeweler", "beautician", "hair stylist",
      "salon manager", "makeup artist", "bridal makeup artist", "celebrity makeup artist",
      "nail technician", "eyebrow specialist", "boiler operator", "crane operator",
      "heavy vehicle driver", "jcb operator", "earthmover operator", "lineman", "cable joiner",
      "tower lineman", "survey engineer", "total station operator", "gis surveyor", "dgps surveyor",
      "gis analyst", "geographic information system analyst"], "operations"],
    /* Government clerical / Group C/D ladder, route to operations
       (closest comp curve via it-services tier). */
    [["multi-tasking staff", "mts", "group d employee", "group c employee", "lower division clerk",
      "ldc", "upper division clerk", "udc", "stenographer", "section officer (govt)",
      "office superintendent", "head clerk", "office assistant (govt)", "data entry operator (govt)",
      "junior translator", "senior translator", "junior hindi translator", "senior hindi translator"], "operations"],
    /* Agriculture / horticulture / fisheries / forestry. */
    [["agriculture officer", "agricultural engineer", "agronomist", "crop scientist", "soil scientist",
      "plant pathologist", "entomologist", "horticulturist", "floriculturist", "tea planter",
      "coffee planter", "dairy manager", "animal husbandry officer", "veterinarian", "vet surgeon",
      "livestock manager", "poultry manager", "aquaculture manager", "fisheries officer", "marine biologist",
      "forest officer", "dfo", "forester", "wildlife warden", "wildlife biologist", "conservationist",
      "naturalist", "park ranger", "agritech field manager", "agritech sales officer",
      "crop advisory officer", "farm advisor", "mandi operations manager", "fpo coordinator"], "operations"],
    /* Social impact / development sector. */
    [["program manager (ngo)", "program director (ngo)", "country director (ngo)",
      "project coordinator (ngo)", "project officer (ngo)", "field officer (ngo)", "community mobilizer",
      "monitoring & evaluation specialist", "m&e manager", "m&e specialist", "m&e director",
      "fundraising manager", "director fundraising", "donor relations manager", "grant writer",
      "grants manager", "csr manager", "director csr", "csr lead", "sustainability manager",
      "esg analyst", "esg manager", "director esg", "vp sustainability", "climate risk analyst",
      "carbon markets analyst", "carbon markets specialist", "voluntary carbon trader",
      "policy analyst", "public policy manager", "government affairs manager", "public affairs director",
      "lobbyist", "government relations lead", "researcher (think tank)", "fellow", "senior fellow",
      "resident scholar"], "consultant"],
    /* Lab / research roles. */
    [["research scholar", "phd scholar", "postdoctoral researcher", "research fellow", "jrf",
      "srf", "research associate", "principal investigator", "lab manager", "lab director",
      "bench chemist", "synthesis chemist", "polymer chemist", "biochemist", "cell biologist",
      "molecular biologist", "geneticist", "virologist", "immunologist", "bacteriologist",
      "bioinformatics analyst", "computational biologist", "genomics scientist", "proteomics scientist",
      "metabolomics scientist", "material scientist", "nanomaterials researcher", "energy researcher",
      "battery researcher", "solar cell researcher", "climate scientist", "atmospheric scientist",
      "oceanographer", "hydrologist", "geophysicist", "seismologist"], "data-scientist"],
    /* Pharma sales / brand / regulatory ladder. */
    [["pharmaceutical sales representative", "medical representative", "area business manager",
      "regional business manager", "zonal business manager", "brand manager (pharma)",
      "product manager (pharma)", "group product manager (pharma)", "marketing manager (pharma)",
      "field marketing manager (pharma)", "therapy area lead", "brand director (pharma)",
      "medical science liaison", "msl", "medical affairs director", "vp medical affairs",
      "qa officer (pharma)", "qa manager (pharma)", "qc officer (pharma)", "qc chemist",
      "validation officer", "validation manager", "gmp auditor", "glp auditor",
      "production officer (pharma)", "production manager (pharma)", "plant manager (pharma)",
      "formulation scientist", "analytical chemist", "r&d scientist", "principal scientist",
      "research director", "api production chemist", "process chemist", "synthetic chemist",
      "medicinal chemist", "regulatory affairs specialist", "regulatory affairs manager",
      "drug regulatory affairs", "clinical research associate", "cra", "clinical research coordinator",
      "clinical trial manager", "clinical project manager", "biostatistician", "pharmacologist",
      "toxicologist", "microbiologist", "biotechnologist", "bioinformatician", "genomic data scientist",
      "pharmacovigilance specialist", "drug safety officer", "medical affairs manager",
      "medical writer"], "pharmacist"],
    /* Travel / tourism. */
    [["travel consultant", "travel agent", "travel manager", "tour operator", "tour manager",
      "tour designer", "trip planner", "visa specialist", "visa counselor", "immigration consultant",
      "tourism manager", "destination manager", "mice manager", "corporate travel manager"], "operations"],
    /* Photography / content creation. */
    [["wedding photographer", "fashion photographer", "product photographer", "food photographer",
      "wildlife photographer", "photojournalist", "studio photographer", "travel photographer",
      "lifestyle photographer", "photo editor", "picture editor", "videographer", "wedding videographer",
      "corporate videographer", "content creator", "reels creator", "youtube creator",
      "instagram influencer", "tiktok creator", "twitch streamer", "live streamer"], "content-writer"],
    /* Sports coaching / fitness / esports. */
    [["sports coach", "cricket coach", "football coach", "tennis coach", "badminton coach",
      "athletic coach", "strength & conditioning coach", "fitness trainer", "personal trainer",
      "group fitness instructor", "yoga instructor", "yoga trainer", "pilates instructor",
      "zumba instructor", "crossfit coach", "calisthenics coach", "sports physiotherapist",
      "sports nutritionist", "sports psychologist", "sports manager", "sports marketing manager",
      "sports sponsorship manager", "athlete manager", "talent manager (sports)", "sports agent",
      "sports journalist", "cricket writer", "football writer", "sports broadcaster",
      "match commentator", "sports anchor", "esports player", "pro gamer", "esports coach",
      "esports manager", "esports caster", "esports analyst", "esports production manager"], "marketing"],
    /* Niche emerging that should map cleanly. */
    [["drone pilot", "drone operator", "uav engineer", "drone designer"], "embedded-engineer"],
    [["quantum computing researcher", "quantum software engineer", "quantum hardware engineer",
      "quantum algorithm engineer", "post-quantum crypto engineer", "quantum cryptography researcher"], "data-scientist"],
    [["ar/vr engineer", "xr developer", "spatial computing engineer", "metaverse engineer",
      "metaverse designer", "virtual world designer"], "frontend-developer"],
    [["bci engineer", "brain-computer interface researcher", "neurotechnology engineer",
      "bioprinting engineer", "tissue engineer", "synthetic biology engineer", "synthetic biology designer",
      "longevity researcher", "biohacker", "cell therapy scientist", "gene therapy researcher",
      "mrna therapeutics researcher", "crispr engineer", "genomic editing researcher"], "data-scientist"],
    /* Web3 / DAO / crypto operations. */
    [["dao steward", "dao treasury manager", "crypto tax analyst", "crypto compliance officer",
      "tokenomics designer", "liquidity pool manager", "defi engineer", "web3 product manager",
      "dao operations lead"], "blockchain"],
    /* ─── End of 2026 niche-routing patterns ─── */
    [["machine learning", "ml engineer", "ml lead"], "ml-engineer"],
    [["ai engineer", "ai/ml", "artificial intelligence"], "ai-engineer"],
    [["data scientist", "research scientist"], "data-scientist"],
    [["data analyst", "business intelligence", "bi analyst", "bi developer"], "data-analyst"],
    [["data engineer", "data architect"], "data-engineer"],
    /* Consulting (was missing, "Management Consultant" was falling
       through to software-engineer fallback). Match BEFORE engineering-
       manager since "Engagement Manager" contains "manager". */
    [["management consultant", "strategy consultant", "associate consultant", "engagement manager", "principal consultant", "consulting analyst"], "consultant"],
    /* Quant, there's no RoleKey "quant", so route to data-scientist
       (closest tier-comp profile in our taxonomy). The override map
       layers the actual quant numbers on top per firm (Jane Street,
       DE Shaw, Citadel). */
    [["quantitative researcher", "quantitative trader", "quantitative developer", "quant trader", "quant researcher", "quant developer", "systematic trader"], "data-scientist"],
    /* Sales / Banking RM / Realty / Pharma MR, was falling to
       software-engineer default. */
    [["relationship manager", "bank po", "ibps po", "sbi po", "sales executive", "sales manager", "account executive", "key account manager", "business development manager", "channel manager", "territory manager", "area sales manager", "regional sales manager", "branch manager", "wealth manager", "loan officer", "financial advisor", "medical representative", "real estate agent", "property consultant"], "sales"],
    /* Marketing / Brand, needed for FMCG MT track. */
    [["brand manager", "marketing manager", "digital marketing", "growth manager", "performance marketing", "product marketing manager", "marketing executive", "management trainee", "category manager", "shopper marketing"], "marketing"],
    /* Operations, aviation / hotels / hospital / general ops.
     * Session A audit (2026-05-14): added "operations lead", "ops lead",
     * "mgr operations", "manager operations" so abbreviations + reversed
     * word-order ("Mgr. Operations") classify correctly. */
    [["operations lead", "ops lead", "head of operations", "head of ops",
      "mgr operations", "manager operations", "asst manager operations",
      "operations manager", "operations executive", "ops manager", "supply chain", "logistics manager", "warehouse manager", "fleet manager", "front office", "f&b manager", "f and b manager", "housekeeping manager", "ground staff", "cabin crew", "flight attendant", "airport operations", "ground operations", "operations analyst", "production manager", "delivery manager", "shift manager", "site engineer", "site manager", "plant manager", "plant head", "category buyer", "store manager", "retail manager", "buyer", "merchandiser", "visual merchandiser", "marketplace manager", "ecommerce manager", "catalog manager", "listing specialist", "pricing analyst", "pricing manager", "import-export", "trade compliance", "custom broker", "process engineer", "quality engineer", "quality manager", "industrial engineer", "ehs manager", "safety officer", "lean manager", "continuous improvement manager", "kaizen manager", "maintenance engineer", "reliability engineer", "estimation engineer", "tender manager", "planning engineer", "quantity surveyor", "tour operator", "travel consultant", "travel manager", "hotel manager", "chef", "sous chef", "head chef", "executive chef", "pastry chef", "bartender", "sommelier"], "operations"],
    /* Sound / audio engineering, domain "operations" rather than SWE. */
    [["sound engineer", "audio engineer", "music producer", "dj", "composer"], "operations"],
    /* Writing / editorial / journalism / content design, was silently
       falling to software-engineer for all 100+ writer roles in
       ROLE_SUGGESTIONS. Routes to content-writer key. */
    [["technical writer", "content writer", "copywriter", "editor", "editor-in-chief", "managing editor", "executive editor", "associate editor", "assistant editor", "senior editor", "copy editor", "line editor", "developmental editor", "substantive editor", "proofreader", "fact-checker", "content strategist", "ux writer", "content designer", "conversation designer", "microcopy", "voice & tone", "localization writer", "localization specialist", "screenwriter", "scriptwriter", "script editor", "story editor", "showrunner", "head writer", "dialogue writer", "tv writer", "film writer", "web series writer", "lyricist", "songwriter", "voiceover", "youtube scriptwriter", "video script", "podcast writer", "audio drama", "comic book writer", "graphic novel", "narrative writer", "quest writer", "lore writer", "worldbuilder", "story designer", "branching narrative", "journalist", "reporter", "correspondent", "war correspondent", "crime reporter", "business journalist", "tech journalist", "political journalist", "entertainment journalist", "lifestyle writer", "travel writer", "food writer", "fashion writer", "columnist", "op-ed writer", "beat reporter", "stringer", "photojournalist", "multimedia journalist", "data journalist", "wire reporter", "bureau chief", "sports journalist", "sports editor", "cricket writer", "match reporter", "court reporter", "sub-editor", "speechwriter", "press release writer", "crisis communications writer", "annual report writer", "investor communications writer", "internal communications writer", "executive communications writer", "pr writer", "communications writer", "research writer", "academic writer", "academic editor", "thesis writer", "dissertation editor", "grant writer", "grant proposal", "white paper writer", "case study writer", "report writer", "policy writer", "rfp writer", "bid writer", "tender writer", "literature review writer", "book editor", "manuscript editor", "ghostwriter", "author", "novelist", "non-fiction author", "children's book writer", "poet", "poetry editor", "translator", "literary translator", "self-publishing", "substack", "newsletter author", "newsletter writer", "audiobook narrator", "indie author", "legal writer", "legal editor", "contract drafter", "compliance writer", "regulatory writer", "privacy policy writer", "medical writer", "scientific writer", "clinical writer", "pharma content writer", "cme writer", "financial writer", "investment research writer", "equity research writer", "fintech content writer", "crypto writer", "customer story writer", "sales enablement writer", "product marketing writer", "solution writer", "demo script writer", "interpreter", "subtitler", "closed captioning", "transcriptionist", "social media writer", "social media copywriter", "brand voice writer", "twitter copywriter", "linkedin ghostwriter", "instagram copywriter", "influencer content writer", "reel caption", "thread writer", "resume writer", "linkedin profile writer", "bio writer", "ai content editor", "ai prompt writer", "ai training writer", "synthetic data writer", "creative copywriter", "brand copywriter", "performance copywriter", "conversion copywriter", "direct response copywriter", "ad copywriter", "digital copywriter", "print copywriter", "landing page copywriter", "sales page copywriter", "aso writer", "blog writer", "article writer", "feature writer", "email copywriter", "lifecycle email writer", "long-form content writer", "short-form content writer", "b2b content writer", "b2c content writer", "saas content writer", "seo content writer", "seo content strategist", "seo editor", "documentation engineer", "documentation specialist", "knowledge base writer", "help center writer", "release notes writer", "sdk documentation writer", "api documentation writer", "developer documentation writer"], "content-writer"],
    /* Finance / accounting / banking analyst sub-roles, were
       silently routing to SWE. Many specific subtypes here. */
    [["statutory auditor", "internal auditor", "auditor", "audit manager", "tax consultant", "gst consultant", "accounts executive", "accounts manager", "accountant", "fp&a analyst", "fpa analyst", "treasury analyst", "risk analyst", "credit analyst", "credit risk analyst", "market risk analyst", "operational risk analyst", "model risk analyst", "compliance officer", "finance manager", "finance controller", "financial controller", "financial analyst", "investment analyst", "investment banking analyst", "equity research analyst", "equity research", "m&a analyst", "private equity analyst", "venture capital analyst", "investment associate", "principal", "quantitative analyst", "quant analyst", "equity trader", "fixed income analyst", "derivatives analyst", "cost accountant", "icwa", "forensic accountant", "management accountant", "aml analyst", "kyc analyst", "transaction monitoring analyst", "wealth management associate", "private banker", "family office analyst", "equity sales", "equity capital markets analyst", "debt capital markets analyst", "actuarial analyst", "underwriter", "claims manager", "fund accountant"], "finance"],
    /* Legal / IP / compliance / paralegal sub-roles. */
    [["legal counsel", "corporate lawyer", "legal associate", "company secretary", "compliance manager", "ip lawyer", "patent attorney", "trademark attorney", "ip analyst", "litigation associate", "arbitration specialist", "tax lawyer", "m&a lawyer", "real estate lawyer", "banking lawyer", "privacy counsel", "data protection officer", "paralegal", "legal operations manager", "contract manager"], "legal"],
    /* Healthcare specialists, route to doctor. */
    [["nurse", "staff nurse", "icu nurse", "ot nurse", "nursing superintendent", "physiotherapist", "occupational therapist", "speech therapist", "audiologist", "radiologist", "pathologist", "microbiologist", "biochemist", "dietician", "nutritionist", "clinical nutritionist", "anesthesiologist", "cardiologist", "oncologist", "neurologist", "psychiatrist", "pediatrician", "gynecologist", "orthopedic surgeon", "ent specialist", "dermatologist", "psychologist", "counselor", "therapist", "clinical psychologist", "resident doctor", "junior resident", "senior resident", "clinical research manager", "regulatory affairs manager", "bioinformatics analyst", "health informatics manager", "clinical data manager", "pharmacovigilance officer", "drug safety associate", "medical coder", "medical officer", "hospital administrator", "healthcare manager", "dentist"], "doctor"],
    /* Marketing sub-roles, Product Marketing Manager etc. */
    [["product marketing manager", "senior product marketing manager", "director of product marketing", "email marketing manager", "marketing operations manager", "martech manager", "lifecycle marketing manager", "retention marketing manager", "abm manager", "field marketing manager", "influencer marketing manager", "affiliate manager", "partnerships manager", "strategic partnerships manager", "alliance manager", "community manager", "customer marketing manager", "marketing analyst", "growth analyst", "brand strategist", "brand director", "brand executive", "brand solutions manager", "pr executive", "pr manager", "communications specialist", "events manager", "trade marketing manager", "newsletter manager", "performance marketing manager", "growth manager", "head of growth", "vp of marketing", "chief marketing officer", "cmo"], "marketing"],
    /* HR specialisations beyond generic. */
    [["hr generalist", "payroll manager", "hris analyst", "hr operations manager", "diversity & inclusion manager", "dei lead", "employee relations manager", "hr analyst", "people analytics manager", "workforce planning manager", "sourcer", "recruiting coordinator", "campus recruiter", "executive search consultant", "employer branding manager", "org design consultant", "training manager", "l&d manager", "learning and development", "compensation & benefits manager", "people operations manager", "head of hr", "vp of people", "chro"], "hr"],
    /* Sales sub-roles already covered above; add Customer Success / RevOps. */
    [["customer success manager", "customer success engineer", "customer success", "implementation manager", "onboarding manager", "customer onboarding specialist", "renewals manager", "customer retention manager", "account manager", "key account manager", "enterprise sales manager", "inside sales", "inside sales representative", "presales consultant", "pre-sales consultant", "solutions consultant", "sales operations manager", "revops manager", "revenue operations manager", "deal desk manager", "channel manager", "channel sales manager", "partner manager", "strategic account manager", "field sales executive", "telesales executive", "sales development representative", "sdr", "bdr", "business development representative", "mdr", "outbound sdr"], "customer-success"],
    /* Mechanical / civil / electrical engineering sub-roles. */
    [["mechanical engineer", "design engineer", "manufacturing engineer", "automotive engineer", "automobile engineer", "aerospace engineer", "marine engineer", "naval architect", "ship designer", "agricultural engineer", "food technologist", "dairy technologist", "metallurgical engineer", "polymer engineer", "materials engineer", "petroleum engineer", "mining engineer", "chemical engineer", "environmental engineer", "sustainability manager", "esg analyst", "climate risk analyst", "surveyor", "geologist", "hydrologist", "hvac engineer", "mep engineer", "bim engineer", "bim modeler", "autocad drafter"], "mechanical-engineer"],
    /* Civil engineering sub-roles. */
    [["civil engineer", "structural engineer", "construction manager"], "civil-engineer"],
    /* Electrical / electronics / VLSI / chip design. */
    [["electrical engineer", "electronics engineer", "vlsi engineer", "chip design engineer", "control systems engineer", "power systems engineer", "instrumentation engineer", "asic engineer", "fpga engineer", "rtl design engineer", "verification engineer", "pcb design engineer", "analog design engineer", "mixed signal design engineer"], "electrical-engineer"],
    /* Education / teaching. */
    [["teacher", "lecturer", "assistant professor", "professor", "academic coordinator", "principal", "education counselor", "academic counselor", "curriculum designer", "curriculum developer", "corporate trainer", "subject matter expert", "instructional designer", "learning experience designer", "edtech content developer", "education researcher", "pre-school teacher", "special educator"], "teacher"],
    /* Pharma / pharmacy. */
    [["pharmacist", "pharmacy", "drug regulatory", "clinical research", "clinical research associate", "medical representative", "medical rep", "mr"], "pharmacist"],
    /* Project / Program Management. */
    [["project manager", "senior project manager", "project lead"], "project-manager"],
    [["program manager", "technical program manager", "delivery manager", "engagement manager"], "program-manager"],
    /* Cybersecurity expanded. */
    [["soc analyst", "cybersecurity analyst", "security analyst", "ciso", "security architect", "penetration tester", "infosec"], "cybersecurity"],
    /* Database / network / sysadmin / support. */
    [["dba", "database administrator", "database admin", "database engineer", "database architect", "sql developer", "etl developer", "power bi developer", "tableau developer", "looker developer", "qlik developer", "informatica developer", "oracle dba", "pl/sql developer", "mainframe developer", "cobol developer", "as400 developer"], "database-administrator"],
    [["network engineer", "network admin", "ccna", "ccnp", "ccie", "network architect", "linux administrator", "windows administrator", "noc engineer", "network operations engineer"], "network-engineer"],
    [["tech support engineer", "application support engineer", "l1 support", "l2 support", "l3 support", "production support engineer", "it support specialist", "helpdesk engineer", "support engineer"], "customer-success"],
    /* Firmware engineer, distinct from embedded (closer-to-hardware
       silicon/SoC/peripheral firmware, vs embedded which spans embedded
       application software). Must be matched BEFORE the embedded
       patterns to win precedence. Session B (2026-05-14): RoleKey added
       to resolve apple.firmware-engineer dead-cells. */
    [["firmware engineer", "firmware developer"], "firmware-engineer"],
    /* Embedded / hardware. */
    [["embedded software engineer", "rtos", "iot engineer", "iot architect", "edge computing engineer", "hardware engineer"], "embedded-engineer"],
    /* Solutions architect. */
    [["solutions architect", "solution architect", "enterprise architect", "domain architect", "integration architect", "salesforce solutions architect"], "solutions-architect"],
    /* Design / creative, was defaulting to SWE for ~50 roles. */
    [["motion designer", "graphic designer", "industrial designer", "furniture designer", "footwear designer", "apparel designer", "fashion designer", "textile designer", "jewellery designer", "jewelry designer", "accessory designer", "interior designer", "landscape architect", "urban planner", "set designer", "exhibition designer", "service designer", "strategic designer", "design strategist", "design researcher", "brand designer", "identity designer", "packaging designer", "print designer", "type designer", "typography designer", "3d designer", "3d artist", "vfx artist", "compositor", "rotoscope artist", "animator", "character animator", "motion graphics artist", "storyboard artist", "concept artist", "illustrator", "layout artist", "lighting artist", "texture artist", "game designer", "level designer", "narrative designer", "photographer", "cinematographer", "dop", "director of photography", "creative director", "art director", "associate creative director", "executive creative director", "ux researcher", "voice & tone specialist", "information architect"], "ux-designer"],
    /* Marketing / advertising sub-roles missed earlier. */
    [["seo specialist", "sem specialist", "social media manager", "social media specialist", "social media executive", "public relations manager", "pr manager", "corporate communications manager", "communications manager", "internal communications manager", "content creator", "social media influencer", "influencer", "youtuber", "podcaster", "streamer", "voice artist", "dubbing artist", "rj", "radio jockey", "vj"], "marketing"],
    /* Sales / Customer-facing leadership subtypes. */
    [["bd lead", "vp of sales", "head of sales", "chief revenue officer", "cro\\b", "client partner", "vp of sales", "head of sales"], "sales"],
    /* PM ladder subtypes. */
    [["head of product", "product analyst", "product owner", "growth product manager", "ai product manager"], "product-manager"],
    /* Engineering manager / leadership exec sub-titles. */
    [["chief of staff", "coo", "cto", "cfo", "general manager", "managing director", "co-founder", "ceo", "founder"], "engineering-manager"],
    /* Operations / process / six sigma. */
    [["procurement manager", "planning manager", "six sigma black belt", "mis executive", "ops analyst", "operations analyst"], "operations"],
    /* Finance / banking subtypes (not already caught). */
    [["ca\\b", "cfo", "bank clerk", "credit manager", "insurance agent", "loan officer", "branch manager"], "finance"],
    /* Company Secretary (CS), legal-adjacent. */
    [["company secretary", "cs\\b"], "legal"],
    /* MD (medical Degree), distinguish from MD (Managing Director).
       Single token "md" alone is too ambiguous; use "md doctor" / "md medical". */
    [["mbbs", "physician", "surgeon", "specialist doctor", "junior doctor", "senior doctor"], "doctor"],
    /* Civil services / govt, route to "consultant" since closest
       comp profile (advisory, fixed pay, prestige-driven). */
    [["ias officer", "ips officer", "ifs officer", "irs officer", "irts officer", "irps officer", "indian foreign service", "indian police service", "indian revenue service", "indian forest service", "upsc aspirant", "state public service commission", "pcs officer", "ssc cgl", "ssc chsl", "ibps po", "sbi po", "rbi grade b", "sebi grade a", "nabard grade a", "sidbi grade a", "isro scientist", "drdo scientist", "barc scientist", "government scientist", "defence scientist", "forensic scientist", "cyber crime investigator", "psu engineer", "gate qualified engineer", "indian army officer", "indian navy officer", "indian air force officer", "nda cadet", "cds officer", "afcat officer"], "consultant"],
    /* Sports / fitness, operations bucket (closest match in salary
       data). */
    [["athlete", "sports coach", "sports trainer", "fitness trainer", "personal trainer", "yoga instructor", "sports analyst", "sports marketing manager", "sports agent"], "operations"],
    /* Real estate sub-roles (not already in sales). */
    [["real estate agent", "property consultant", "real estate sales manager", "leasing manager", "property manager", "facility manager", "real estate investment analyst", "reit analyst", "asset manager"], "sales"],
    /* AI / data subtypes missed earlier. */
    [["applied scientist", "ai research scientist", "research scientist", "research engineer", "ai trainer", "ai safety engineer", "llm engineer", "generative ai engineer", "conversational ai engineer", "foundation model engineer", "rlhf engineer", "ai evaluation engineer", "prompt engineer", "decision scientist", "data modeler", "data steward", "data governance lead", "analytics engineer", "quantitative researcher", "quant researcher", "quantitative developer", "quant developer"], "ml-engineer"],
    /* Internships / fresher / generic. */
    [["software engineer intern", "data science intern", "product intern", "design intern", "marketing intern", "intern", "fresher", "campus hire", "apprentice", "trainee engineer", "graduate engineer trainee", "management trainee", "associate software engineer", "junior developer"], "software-engineer"],
    /* Freelance variants. */
    [["freelance developer", "freelance designer", "independent consultant", "contract engineer", "freelance writer", "freelance marketer"], "consultant"],
    /* Acronyms, must come AFTER longer-pattern matches to avoid
       false positives. CA / CS / MD as standalone tokens. */
    [["^ca$", "^cs$", "^md$"], "chartered-accountant"],
    /* Specific intern variants. */
    [["data science intern", "product intern", "design intern", "marketing intern"], "software-engineer"],
    /* Generic fresher / campus stage entries. */
    [["fresher", "campus hire", "apprentice"], "software-engineer"],
    /* Sales / RevOps subtypes. */
    [["market development representative", "mdr"], "sales"],
    /* PE/VC partner. */
    [["partner pevc", "partner pe", "partner vc", "partner private equity", "partner venture capital", "principal pevc"], "finance"],
    /* Trading. */
    [["forex trader", "trader", "systematic trader"], "finance"],
    /* Retail / e-commerce / cluster mgmt. */
    [["customs broker", "cluster manager", "e-commerce manager", "ecommerce manager", "marketplace manager"], "operations"],
    /* Aviation crew (pilot tier, not in operations). */
    [["pilot", "first officer", "captain aviation", "aircraft maintenance engineer", "ame", "tourism manager"], "operations"],
    /* Media production. */
    [["producer", "line producer", "director", "assistant director", "production manager", "news anchor"], "marketing"],
    /* R&D / consumer goods science. */
    [["r&d manager consumer", "rd manager consumer", "product development manager consumer", "flavor scientist", "cosmetic chemist", "sensory analyst"], "marketing"],
    /* Content roles missed earlier. */
    [["head of content", "content director", "content marketing manager", "content operations manager", "content reviewer", "content moderator", "content producer", "content curator", "content specialist", "group head copy", "creative group head", "copy supervisor", "technical documentation manager", "documentation lead", "knowledge manager", "user manual writer", "product writer", "localization manager", "conversational ai writer", "voice ui writer", "chatbot writer", "staff writer tv", "staff writer", "story writer", "game writer"], "content-writer"],
    [["engineering manager", "director of engineering", "head of engineering", "vp of engineering"], "engineering-manager"],
    [["product manager", "apm", "associate product manager", "group product manager", "product owner", "chief product officer", "technical product manager", "director of product", "vp of product"], "product-manager"],
    // Design Engineer — engineering-coded designers (Vercel/Linear-style hybrid role).
    // Match BEFORE generic ux-designer since they should resolve to the design-engineer key.
    [["design engineer", "design technologist", "creative technologist", "ui engineer"], "design-engineer"],
    [["product designer", "ux designer", "ui designer", "ux/ui", "visual designer", "ux researcher", "head of design", "design manager"], "ux-designer"],
    [["devops", "sre", "site reliability", "platform engineer", "infrastructure"], "devops-sre"],
    [["cloud engineer", "cloud architect"], "cloud-engineer"],
    [["frontend", "react developer", "angular developer", "vue"], "frontend-developer"],
    [["backend", "java developer", "python developer", "node.js developer", "go developer", ".net developer"], "backend-developer"],
    [["mobile developer", "ios developer", "android developer", "react native", "flutter"], "mobile-developer"],
    [["qa", "test engineer", "sdet", "automation engineer", "quality assurance"], "qa-engineer"],
    [["cybersecurity", "security engineer", "infosec", "penetration", "security architect", "security analyst"], "cybersecurity"],
    [["blockchain", "web3", "solidity", "smart contract"], "blockchain"],
    [["program manager", "technical program manager"], "program-manager"],
    [["project manager"], "project-manager"],
    [["scrum master", "agile coach", "agile lead"], "scrum-master"],
    [["solutions architect", "solution architect", "enterprise architect", "cloud architect"], "solutions-architect"],
    [["tech lead", "technical lead", "lead engineer", "staff engineer", "principal engineer"], "tech-lead"],
    [["firmware"], "firmware-engineer"],
    [["embedded", "rtos", "iot engineer", "hardware engineer"], "embedded-engineer"],
    [["dba", "database admin", "database engineer", "database architect"], "database-administrator"],
    [["network engineer", "network admin", "ccna", "ccnp", "ccie", "network architect"], "network-engineer"],
    [["mechanical engineer", "mechanical", "automobile engineer", "automotive engineer", "manufacturing engineer"], "mechanical-engineer"],
    [["electrical engineer", "electrical", "power engineer", "electronics engineer", "vlsi"], "electrical-engineer"],
    [["civil engineer", "civil", "structural engineer", "construction engineer", "site engineer"], "civil-engineer"],
    [["chartered accountant", "ca articleship", "ca inter", "ca final", "icai"], "chartered-accountant"],
    /* HR / talent acquisition (must be after CA so "Technical
       Recruiter" doesn't get caught by stray CA token). */
    [["technical recruiter", "talent acquisition lead", "talent acquisition manager", "campus recruiter", "executive search consultant", "sourcer", "recruiting coordinator", "recruiter"], "hr"],
    [["doctor", "mbbs", "physician", "surgeon", "medical officer", "specialist doctor"], "doctor"],
    [["pharmacist", "pharmacy", "pharma", "drug regulatory", "clinical research", "medical representative"], "pharmacist"],
    [["business analyst"], "business-analyst"],
    [["content writer", "technical writer", "ux writer", "copywriter"], "content-writer"],
    [["customer success", "account manager", "csm"], "customer-success"],
    [["operations manager", "supply chain", "logistics"], "operations"],
    [["legal", "corporate lawyer", "company secretary", "compliance"], "legal"],
    [["hr", "recruiter", "talent acquisition", "hrbp", "human resource"], "hr"],
    // PMM — distinct from generic marketing; SaaS pays it 20-30% more. Match BEFORE marketing.
    [["product marketing manager", "product marketing", "pmm", "go-to-market manager", "gtm manager"], "product-marketing-manager"],
    [["marketing", "growth manager", "digital marketing", "content strategist"], "marketing"],
    [["sales", "business development", "account executive", "bde"], "sales"],
    [["consultant", "management consultant", "strategy consultant"], "consultant"],
    [["finance", "financial analyst", "investment banking", "bank po", "wealth manager"], "finance"],
    [["teacher", "lecturer", "professor", "assistant professor"], "teacher"],
    [["cto"], "engineering-manager"],
    [["ceo", "co-founder", "managing director", "general manager"], "engineering-manager"],
    // Catch-all for generic engineering roles
    [["software", "developer", "engineer", "full stack", "mern", "mean", "rust", "c++"], "software-engineer"],
  ];

  for (const [keywords, key] of patterns) {
    if (keywords.some(kw => lower.includes(kw) || normalized.includes(kw))) return { key, matched: true };
  }

  return { key: "software-engineer", matched: false }; // default fallback
}
