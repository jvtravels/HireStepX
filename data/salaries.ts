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
export const CALIBRATION_DATE = "2026-05";

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
  | "embedded-engineer" | "database-administrator" | "network-engineer"
  | "mechanical-engineer" | "electrical-engineer" | "civil-engineer"
  | "chartered-accountant" | "doctor" | "pharmacist"
  | "design-engineer" | "product-marketing-manager";

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
      entry: s([22, 32], [1, 3], RSU(4, 10, "quarterly after 1-year cliff"), [28, 45], { joining_bonus_min: 0, joining_bonus_max: 5, notice_period_days: 30, negotiation_leverage: "low", hot_skills: ["System Design", "DSA", "GenAI/LLM"], notes: "L3/E3 level. RSUs are modest at entry — bulk of comp is base. 2026 verified: Razorpay/top-tier opens at ₹24L+ for new grads with strong GenAI exposure." }),
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
  },
  "ai-engineer": { /* alias — lookup falls back to ml-engineer */ },

  // ─── DATA ENGINEER ────────────────────────────────────────────
  "data-engineer": {
    faang: {
      entry: s([22, 32], [2, 4], RSU(6, 12), [28, 45], { hot_skills: ["Spark", "Kafka", "Airflow", "dbt"] }),
      mid: s([38, 52], [4, 8], RSU(12, 25), [50, 80], {}),
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
  },
  "cloud-engineer": { /* alias — falls back to devops-sre */ },

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
      senior: s([48, 68], [6, 12], RSU(20, 40), [74, 120], { negotiation_leverage: "high", notes: "Microsoft/Google/Meta India senior PD median ₹85-95 LPA total comp; high performers cross ₹110 LPA. The previous band floor of ₹61 LPA was off — Microsoft alone offers ₹70+ as the standard floor for senior product designers in 2024-25." }),
      lead: s([60, 85], [10, 18], RSU(28, 55), [98, 158], { negotiation_leverage: "high", notes: "Lead/Principal/Staff PD at top FAANG India routinely lands ₹120-150 LPA total comp." }),
    },
    "indian-unicorn": {
      entry: s([6, 10], [0.5, 1], ESOP(0.5, 2), [7, 13], { hot_skills: ["Figma", "Product thinking", "0-to-1 design"] }),
      mid: s([14, 22], [1.5, 3], ESOP(2, 5), [17, 30], {}),
      senior: s([24, 36], [3, 6], ESOP(4, 10), [31, 52], { negotiation_leverage: "high", notes: "Top-tier unicorns (Razorpay/CRED/Zerodha/Zepto) hit ₹40-55 LPA at senior. Standard tier (Flipkart/Swiggy/Meesho) lands ₹30-42 LPA." }),
      lead: s([35, 50], [5, 10], ESOP(8, 18), [48, 78], { negotiation_leverage: "high", notes: "Lead/Principal PD or Design Manager. Often a leveling-arbitrage opportunity — IC ladder caps lower than EM ladder at most unicorns." }),
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
      mid: s([5, 8], [0.3, 0.7], NO_EQ, [5.5, 9], { negotiation_leverage: "low", notes: "Mid-level (3-5 yrs) at services firms. Compensation 30-40% below product-company benchmarks — consider switching after 2-3 yrs." }),
      senior: s([8, 11], [0.5, 1.5], NO_EQ, [9, 13], { negotiation_leverage: "low", notes: "Senior UX (6-9 yrs) at TCS Interactive / Infosys Wongdoody. Caps around ₹12.9 LPA per AmbitionBox 2025." }),
      lead: s([12, 17], [1, 2], NO_EQ, [13, 19], { negotiation_leverage: "medium", notes: "Lead/Principal UX at services firms — 10+ yrs. Higher-end roles cross into Design Manager titles which can hit ₹18-22 LPA but those are exception, not norm." }),
    },
    "startup-growth": {
      entry: s([5, 8], [0.3, 0.6], ESOP(0.5, 2), [6, 11], { notes: "Pre-Series-B startups: prefer higher base over higher ESOP — most early-stage equity expires worthless." }),
      mid: s([10, 18], [0.8, 2], ESOP(1.5, 4), [12, 24], {}),
      senior: s([18, 30], [2.5, 5], ESOP(3, 8), [24, 43], { negotiation_leverage: "high", notes: "Senior at Series B/C — push for cash + cash-out clauses on ESOPs (90-day exercise window, full acceleration on liquidity)." }),
      lead: s([25, 42], [4, 8], ESOP(6, 15), [35, 65], { negotiation_leverage: "high" }),
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
  },
  "project-manager": { /* alias — falls back to program-manager */ },

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
    },
  },

  // ─── FRONTEND DEVELOPER ───────────────────────────────────────
  "frontend-developer": { /* alias — falls back to software-engineer */ },

  // ─── BACKEND DEVELOPER ────────────────────────────────────────
  "backend-developer": { /* alias — falls back to software-engineer */ },

  // ─── MOBILE DEVELOPER ─────────────────────────────────────────
  "mobile-developer": { /* alias — falls back to software-engineer with mobile premium note */ },

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
  },

  // ─── ELECTRICAL ENGINEER (alias to mechanical-engineer) ───────
  "electrical-engineer": { /* alias — falls back to mechanical-engineer */ },

  // ─── CIVIL ENGINEER (alias to mechanical-engineer) ────────────
  "civil-engineer": { /* alias — falls back to mechanical-engineer */ },

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
    },
  },

  // ─── DESIGN ENGINEER (alias — premium 10-15% over ux-designer at top
  //     product cos; for now resolves via ROLE_ALIASES → ux-designer) ──
  "design-engineer": { /* alias — falls back to ux-designer */ },

  // ─── PRODUCT MARKETING MANAGER (alias — 20-30% above generic marketing
  //     at SaaS / unicorns; for now resolves via ROLE_ALIASES → marketing) ──
  "product-marketing-manager": { /* alias — falls back to marketing */ },

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
  },
};

/** Role key aliases — when a role key has no data, fall back to this key */
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

/**
 * Map a free-text role string to a RoleKey.
 * Uses substring matching (same approach as getRoleCompetencies).
 */
export function matchRoleKey(role: string): RoleKey {
  if (!role) return "software-engineer";
  const lower = role.toLowerCase();

  // Ordered from most specific to least specific to avoid false matches
  const patterns: [string[], RoleKey][] = [
    [["machine learning", "ml engineer", "ml lead"], "ml-engineer"],
    [["ai engineer", "ai/ml", "artificial intelligence"], "ai-engineer"],
    [["data scientist", "research scientist"], "data-scientist"],
    [["data analyst", "business intelligence", "bi analyst", "bi developer"], "data-analyst"],
    [["data engineer", "data architect"], "data-engineer"],
    /* Consulting (was missing — "Management Consultant" was falling
       through to software-engineer fallback). Match BEFORE engineering-
       manager since "Engagement Manager" contains "manager". */
    [["management consultant", "strategy consultant", "associate consultant", "engagement manager", "principal consultant", "consulting analyst"], "consultant"],
    /* Quant — there's no RoleKey "quant", so route to data-scientist
       (closest tier-comp profile in our taxonomy). The override map
       layers the actual quant numbers on top per firm (Jane Street,
       DE Shaw, Citadel). */
    [["quantitative researcher", "quantitative trader", "quantitative developer", "quant trader", "quant researcher", "quant developer", "systematic trader"], "data-scientist"],
    /* Sales / Banking RM / Realty / Pharma MR — was falling to
       software-engineer default. */
    [["relationship manager", "bank po", "ibps po", "sbi po", "sales executive", "sales manager", "account executive", "key account manager", "business development manager", "channel manager", "territory manager", "area sales manager", "regional sales manager", "branch manager", "wealth manager", "loan officer", "financial advisor", "medical representative", "real estate agent", "property consultant"], "sales"],
    /* Marketing / Brand — needed for FMCG MT track. */
    [["brand manager", "marketing manager", "digital marketing", "growth manager", "performance marketing", "product marketing manager", "marketing executive", "management trainee", "category manager", "shopper marketing"], "marketing"],
    /* Operations — aviation / hotels / hospital / general ops. */
    [["operations manager", "operations executive", "ops manager", "supply chain", "logistics manager", "warehouse manager", "fleet manager", "front office", "f&b manager", "f and b manager", "housekeeping manager", "ground staff", "cabin crew", "flight attendant", "airport operations", "ground operations", "operations analyst", "production manager", "delivery manager", "shift manager", "site engineer", "site manager", "plant manager", "plant head", "category buyer", "store manager", "retail manager", "buyer", "merchandiser", "visual merchandiser", "marketplace manager", "ecommerce manager", "catalog manager", "listing specialist", "pricing analyst", "pricing manager", "import-export", "trade compliance", "custom broker", "process engineer", "quality engineer", "quality manager", "industrial engineer", "ehs manager", "safety officer", "lean manager", "continuous improvement manager", "kaizen manager", "maintenance engineer", "reliability engineer", "estimation engineer", "tender manager", "planning engineer", "quantity surveyor", "tour operator", "travel consultant", "travel manager", "hotel manager", "chef", "sous chef", "head chef", "executive chef", "pastry chef", "bartender", "sommelier"], "operations"],
    /* Sound / audio engineering — domain "operations" rather than SWE. */
    [["sound engineer", "audio engineer", "music producer", "dj", "composer"], "operations"],
    /* Writing / editorial / journalism / content design — was silently
       falling to software-engineer for all 100+ writer roles in
       ROLE_SUGGESTIONS. Routes to content-writer key. */
    [["technical writer", "content writer", "copywriter", "editor", "editor-in-chief", "managing editor", "executive editor", "associate editor", "assistant editor", "senior editor", "copy editor", "line editor", "developmental editor", "substantive editor", "proofreader", "fact-checker", "content strategist", "ux writer", "content designer", "conversation designer", "microcopy", "voice & tone", "localization writer", "localization specialist", "screenwriter", "scriptwriter", "script editor", "story editor", "showrunner", "head writer", "dialogue writer", "tv writer", "film writer", "web series writer", "lyricist", "songwriter", "voiceover", "youtube scriptwriter", "video script", "podcast writer", "audio drama", "comic book writer", "graphic novel", "narrative writer", "quest writer", "lore writer", "worldbuilder", "story designer", "branching narrative", "journalist", "reporter", "correspondent", "war correspondent", "crime reporter", "business journalist", "tech journalist", "political journalist", "entertainment journalist", "lifestyle writer", "travel writer", "food writer", "fashion writer", "columnist", "op-ed writer", "beat reporter", "stringer", "photojournalist", "multimedia journalist", "data journalist", "wire reporter", "bureau chief", "sports journalist", "sports editor", "cricket writer", "match reporter", "court reporter", "sub-editor", "speechwriter", "press release writer", "crisis communications writer", "annual report writer", "investor communications writer", "internal communications writer", "executive communications writer", "pr writer", "communications writer", "research writer", "academic writer", "academic editor", "thesis writer", "dissertation editor", "grant writer", "grant proposal", "white paper writer", "case study writer", "report writer", "policy writer", "rfp writer", "bid writer", "tender writer", "literature review writer", "book editor", "manuscript editor", "ghostwriter", "author", "novelist", "non-fiction author", "children's book writer", "poet", "poetry editor", "translator", "literary translator", "self-publishing", "substack", "newsletter author", "newsletter writer", "audiobook narrator", "indie author", "legal writer", "legal editor", "contract drafter", "compliance writer", "regulatory writer", "privacy policy writer", "medical writer", "scientific writer", "clinical writer", "pharma content writer", "cme writer", "financial writer", "investment research writer", "equity research writer", "fintech content writer", "crypto writer", "customer story writer", "sales enablement writer", "product marketing writer", "solution writer", "demo script writer", "interpreter", "subtitler", "closed captioning", "transcriptionist", "social media writer", "social media copywriter", "brand voice writer", "twitter copywriter", "linkedin ghostwriter", "instagram copywriter", "influencer content writer", "reel caption", "thread writer", "resume writer", "linkedin profile writer", "bio writer", "ai content editor", "ai prompt writer", "ai training writer", "synthetic data writer", "creative copywriter", "brand copywriter", "performance copywriter", "conversion copywriter", "direct response copywriter", "ad copywriter", "digital copywriter", "print copywriter", "landing page copywriter", "sales page copywriter", "aso writer", "blog writer", "article writer", "feature writer", "email copywriter", "lifecycle email writer", "long-form content writer", "short-form content writer", "b2b content writer", "b2c content writer", "saas content writer", "seo content writer", "seo content strategist", "seo editor", "documentation engineer", "documentation specialist", "knowledge base writer", "help center writer", "release notes writer", "sdk documentation writer", "api documentation writer", "developer documentation writer"], "content-writer"],
    /* Finance / accounting / banking analyst sub-roles — were
       silently routing to SWE. Many specific subtypes here. */
    [["statutory auditor", "internal auditor", "auditor", "audit manager", "tax consultant", "gst consultant", "accounts executive", "accounts manager", "accountant", "fp&a analyst", "fpa analyst", "treasury analyst", "risk analyst", "credit analyst", "credit risk analyst", "market risk analyst", "operational risk analyst", "model risk analyst", "compliance officer", "finance manager", "finance controller", "financial controller", "financial analyst", "investment analyst", "investment banking analyst", "equity research analyst", "equity research", "m&a analyst", "private equity analyst", "venture capital analyst", "investment associate", "principal", "quantitative analyst", "quant analyst", "equity trader", "fixed income analyst", "derivatives analyst", "cost accountant", "icwa", "forensic accountant", "management accountant", "aml analyst", "kyc analyst", "transaction monitoring analyst", "wealth management associate", "private banker", "family office analyst", "equity sales", "equity capital markets analyst", "debt capital markets analyst", "actuarial analyst", "underwriter", "claims manager", "fund accountant"], "finance"],
    /* Legal / IP / compliance / paralegal sub-roles. */
    [["legal counsel", "corporate lawyer", "legal associate", "company secretary", "compliance manager", "ip lawyer", "patent attorney", "trademark attorney", "ip analyst", "litigation associate", "arbitration specialist", "tax lawyer", "m&a lawyer", "real estate lawyer", "banking lawyer", "privacy counsel", "data protection officer", "paralegal", "legal operations manager", "contract manager"], "legal"],
    /* Healthcare specialists — route to doctor. */
    [["nurse", "staff nurse", "icu nurse", "ot nurse", "nursing superintendent", "physiotherapist", "occupational therapist", "speech therapist", "audiologist", "radiologist", "pathologist", "microbiologist", "biochemist", "dietician", "nutritionist", "clinical nutritionist", "anesthesiologist", "cardiologist", "oncologist", "neurologist", "psychiatrist", "pediatrician", "gynecologist", "orthopedic surgeon", "ent specialist", "dermatologist", "psychologist", "counselor", "therapist", "clinical psychologist", "resident doctor", "junior resident", "senior resident", "clinical research manager", "regulatory affairs manager", "bioinformatics analyst", "health informatics manager", "clinical data manager", "pharmacovigilance officer", "drug safety associate", "medical coder", "medical officer", "hospital administrator", "healthcare manager", "dentist"], "doctor"],
    /* Marketing sub-roles — Product Marketing Manager etc. */
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
    /* Embedded / hardware. */
    [["embedded software engineer", "firmware engineer", "rtos", "iot engineer", "iot architect", "edge computing engineer", "hardware engineer"], "embedded-engineer"],
    /* Solutions architect. */
    [["solutions architect", "solution architect", "enterprise architect", "domain architect", "integration architect", "salesforce solutions architect"], "solutions-architect"],
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
    [["embedded", "firmware", "rtos", "iot engineer", "hardware engineer"], "embedded-engineer"],
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
    if (keywords.some(kw => lower.includes(kw))) return key;
  }

  return "software-engineer"; // default fallback
}
