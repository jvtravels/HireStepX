/**
 * India Salary Bands — 2025 reference grid.
 *
 * Encoded directly from product-team market research covering 80+
 * roles across 9 role families × 4 YOE buckets. These are
 * MARKET-WIDE bands (the spread across all company tiers); the
 * `tierMultiplier()` below scales them per company tier so the
 * salary-neg simulator can quote tier-appropriate numbers.
 *
 * All figures in LPA (lakhs per annum). Cr → 100 LPA.
 *
 * Why a separate file from salaries.ts:
 *   • salaries.ts uses (role, tier, level) → entry — good for the
 *     existing band-clamp logic but coarse on roles (40 roles, 4
 *     tiers).
 *   • This file uses (granular-role, yoe-bucket) → range pulled
 *     directly from the source tables. 80+ roles, single grid.
 *   • The salary-neg prompt now ships BOTH:
 *       - structured band from salaries.ts (clamps the LLM's offer)
 *       - granular reference from this file (so the LLM can
 *         distinguish "Frontend Developer" from "Backend Developer"
 *         from "DevOps Engineer" instead of treating them all as
 *         "software-engineer")
 *
 * Source confidence: HIGH for tier-1 city + 2025 market. Bands are
 * 25th-90th percentile across companies in the user's data.
 */

export type YoeBucket = "0-2" | "3-5" | "6-9" | "10+";

export interface BandTuple {
  /** Lower-bound (25th percentile) LPA. */
  lo: number;
  /** Upper-bound (90th percentile) LPA. */
  hi: number;
}

/** A `null` entry means the role doesn't exist at that experience
 *  level (e.g. "Staff Engineer with 0-2 YOE"). */
export type RoleBands = Record<YoeBucket, BandTuple | null>;

export interface RoleFamilyEntry {
  family: RoleFamily;
  /** Display label used in prompts. */
  label: string;
  /** Lowercase keywords for fuzzy role-text matching. */
  aliases: string[];
  bands: RoleBands;
  /** Optional family-specific note appended to the band when this
   *  role is selected. Example: sales roles reminding "fixed +
   *  variable + commission". */
  note?: string;
}

export type RoleFamily =
  | "software-engineering"
  | "ai-ml-data"
  | "product-management"
  | "design"
  | "marketing-growth"
  | "sales-bd"
  | "finance-consulting"
  | "hr-people"
  | "operations";

const b = (lo: number, hi: number): BandTuple => ({ lo, hi });
const NA = null;

/* ════════════════════════════════════════════════════════════════
   A. Software Engineering Roles
   ════════════════════════════════════════════════════════════════ */
const SOFTWARE_ENGINEERING: RoleFamilyEntry[] = [
  { family: "software-engineering", label: "Frontend Developer", aliases: ["frontend", "front end", "react developer", "angular developer", "vue developer", "ui developer"], bands: { "0-2": b(4, 12), "3-5": b(12, 28), "6-9": b(25, 55), "10+": b(45, 90) } },
  { family: "software-engineering", label: "Backend Developer", aliases: ["backend", "back end", "java developer", "python developer", "node.js developer", "go developer", ".net developer", "server developer"], bands: { "0-2": b(5, 14), "3-5": b(14, 35), "6-9": b(30, 70), "10+": b(55, 120) } },
  { family: "software-engineering", label: "Full Stack Developer", aliases: ["full stack", "fullstack", "full-stack", "mern", "mean"], bands: { "0-2": b(5, 15), "3-5": b(15, 35), "6-9": b(30, 75), "10+": b(60, 130) } },
  { family: "software-engineering", label: "Mobile App Developer", aliases: ["mobile developer", "ios developer", "android developer", "react native", "flutter", "mobile engineer"], bands: { "0-2": b(4, 12), "3-5": b(12, 30), "6-9": b(25, 60), "10+": b(45, 100) } },
  { family: "software-engineering", label: "DevOps Engineer", aliases: ["devops", "platform engineer", "infrastructure engineer"], bands: { "0-2": b(5, 14), "3-5": b(15, 35), "6-9": b(30, 75), "10+": b(60, 120) } },
  { family: "software-engineering", label: "Site Reliability Engineer", aliases: ["sre", "site reliability"], bands: { "0-2": b(8, 18), "3-5": b(20, 45), "6-9": b(40, 90), "10+": b(80, 150) } },
  { family: "software-engineering", label: "QA Engineer", aliases: ["qa engineer", "quality assurance", "manual tester"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(28, 60) } },
  { family: "software-engineering", label: "Automation Test Engineer", aliases: ["automation test", "sdet", "test automation"], bands: { "0-2": b(4, 10), "3-5": b(10, 25), "6-9": b(20, 45), "10+": b(35, 75) } },
  { family: "software-engineering", label: "Engineering Manager", aliases: ["engineering manager", "em", "tech manager"], bands: { "0-2": NA, "3-5": b(30, 60), "6-9": b(55, 120), "10+": b(90, 200) } },
  { family: "software-engineering", label: "Staff Engineer", aliases: ["staff engineer", "senior staff engineer"], bands: { "0-2": NA, "3-5": NA, "6-9": b(60, 130), "10+": b(100, 250) } },
  { family: "software-engineering", label: "Principal Engineer", aliases: ["principal engineer", "distinguished engineer"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 180), "10+": b(150, 300) } },
];

/* ════════════════════════════════════════════════════════════════
   B. AI / ML / Data & Analytics Roles
   AI/ML/Data carry a 2025 SKILL PREMIUM — bands sit above generalist
   tech for the same YOE.
   ════════════════════════════════════════════════════════════════ */
const AI_ML_DATA: RoleFamilyEntry[] = [
  { family: "ai-ml-data", label: "Data Analyst", aliases: ["data analyst", "business intelligence analyst", "bi analyst"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(30, 60) } },
  { family: "ai-ml-data", label: "Business Analyst", aliases: ["business analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "ai-ml-data", label: "Data Engineer", aliases: ["data engineer", "data architect", "etl engineer"], bands: { "0-2": b(5, 14), "3-5": b(14, 35), "6-9": b(30, 75), "10+": b(60, 130) } },
  { family: "ai-ml-data", label: "Data Scientist", aliases: ["data scientist", "research scientist"], bands: { "0-2": b(6, 16), "3-5": b(16, 40), "6-9": b(35, 85), "10+": b(70, 150) } },
  { family: "ai-ml-data", label: "ML Engineer", aliases: ["ml engineer", "machine learning engineer"], bands: { "0-2": b(8, 20), "3-5": b(20, 50), "6-9": b(45, 100), "10+": b(90, 200) }, note: "AI/ML SKILL PREMIUM applies — anchor at upper half of band, not median." },
  { family: "ai-ml-data", label: "AI Engineer", aliases: ["ai engineer", "applied ai engineer"], bands: { "0-2": b(8, 22), "3-5": b(22, 55), "6-9": b(50, 120), "10+": b(100, 250) }, note: "AI/ML SKILL PREMIUM applies." },
  { family: "ai-ml-data", label: "GenAI Engineer", aliases: ["genai", "gen ai", "generative ai", "llm engineer", "prompt engineer"], bands: { "0-2": b(10, 25), "3-5": b(25, 60), "6-9": b(55, 140), "10+": b(100, 250) }, note: "GenAI commands the strongest premium of any tech role in 2025." },
  { family: "ai-ml-data", label: "MLOps Engineer", aliases: ["mlops", "ml platform", "ml infrastructure"], bands: { "0-2": b(8, 20), "3-5": b(20, 45), "6-9": b(45, 100), "10+": b(80, 180) } },
  { family: "ai-ml-data", label: "Analytics Manager", aliases: ["analytics manager", "head of analytics"], bands: { "0-2": NA, "3-5": b(20, 40), "6-9": b(35, 80), "10+": b(70, 150) } },
  { family: "ai-ml-data", label: "Head of Data", aliases: ["head of data", "vp of data", "director of data"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 300) } },
];

/* ════════════════════════════════════════════════════════════════
   C. Product Management Roles
   Salaries vary 2-4x by company. PMs at funded fintech/product
   companies pay much more than at small services co's.
   ════════════════════════════════════════════════════════════════ */
const PRODUCT_MANAGEMENT: RoleFamilyEntry[] = [
  { family: "product-management", label: "Associate Product Manager", aliases: ["associate product manager", "apm"], bands: { "0-2": b(8, 18), "3-5": b(15, 28), "6-9": NA, "10+": NA } },
  { family: "product-management", label: "Product Manager", aliases: ["product manager", "pm"], bands: { "0-2": b(12, 28), "3-5": b(25, 55), "6-9": b(45, 90), "10+": NA } },
  { family: "product-management", label: "Senior Product Manager", aliases: ["senior product manager", "spm"], bands: { "0-2": NA, "3-5": b(40, 80), "6-9": b(70, 140), "10+": b(100, 200) } },
  { family: "product-management", label: "Group Product Manager", aliases: ["group product manager", "gpm"], bands: { "0-2": NA, "3-5": NA, "6-9": b(90, 180), "10+": b(150, 300) } },
  { family: "product-management", label: "Product Lead", aliases: ["product lead"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 160), "10+": b(130, 250) } },
  { family: "product-management", label: "Director of Product", aliases: ["director of product", "head of product"], bands: { "0-2": NA, "3-5": NA, "6-9": b(100, 200), "10+": b(180, 400) } },
  { family: "product-management", label: "VP Product", aliases: ["vp product", "vp of product"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(250, 600) } },
  { family: "product-management", label: "Chief Product Officer", aliases: ["chief product officer", "cpo"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(300, 1000) } },
];

/* ════════════════════════════════════════════════════════════════
   D. Design Roles
   Senior design pay reflects portfolio depth, business impact,
   design-systems ownership, stakeholder management — NOT Figma
   skill.
   ════════════════════════════════════════════════════════════════ */
const DESIGN: RoleFamilyEntry[] = [
  { family: "design", label: "UI Designer", aliases: ["ui designer", "visual designer"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(30, 60) } },
  { family: "design", label: "UX Designer", aliases: ["ux designer", "interaction designer"], bands: { "0-2": b(4, 10), "3-5": b(10, 25), "6-9": b(20, 45), "10+": b(35, 80) } },
  { family: "design", label: "Product Designer", aliases: ["product designer"], bands: { "0-2": b(5, 14), "3-5": b(14, 35), "6-9": b(30, 70), "10+": b(55, 120) } },
  { family: "design", label: "Senior Product Designer", aliases: ["senior product designer", "sr product designer"], bands: { "0-2": NA, "3-5": b(25, 50), "6-9": b(45, 95), "10+": b(80, 150) } },
  { family: "design", label: "UX Researcher", aliases: ["ux researcher", "user researcher"], bands: { "0-2": b(5, 12), "3-5": b(12, 30), "6-9": b(25, 60), "10+": b(50, 100) } },
  { family: "design", label: "Design Systems Designer", aliases: ["design systems", "ds designer"], bands: { "0-2": b(8, 18), "3-5": b(18, 45), "6-9": b(40, 90), "10+": b(70, 150) } },
  { family: "design", label: "Motion Designer", aliases: ["motion designer", "motion graphics"], bands: { "0-2": b(4, 10), "3-5": b(10, 25), "6-9": b(20, 50), "10+": b(40, 80) } },
  { family: "design", label: "Design Manager", aliases: ["design manager", "design lead"], bands: { "0-2": NA, "3-5": b(30, 60), "6-9": b(55, 120), "10+": b(90, 200) } },
  { family: "design", label: "Head of Design", aliases: ["head of design"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 180), "10+": b(150, 400) } },
  { family: "design", label: "VP Design", aliases: ["vp design", "vp of design"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(200, 600) } },
];

/* ════════════════════════════════════════════════════════════════
   E. Marketing & Growth Roles
   ════════════════════════════════════════════════════════════════ */
const MARKETING_GROWTH: RoleFamilyEntry[] = [
  { family: "marketing-growth", label: "Digital Marketing Executive", aliases: ["digital marketing executive", "digital marketing"], bands: { "0-2": b(3, 6), "3-5": b(6, 12), "6-9": b(10, 22), "10+": b(18, 35) } },
  { family: "marketing-growth", label: "Performance Marketer", aliases: ["performance marketer", "paid marketing", "ppc specialist"], bands: { "0-2": b(4, 10), "3-5": b(10, 25), "6-9": b(20, 50), "10+": b(40, 90) } },
  { family: "marketing-growth", label: "SEO Specialist", aliases: ["seo specialist", "seo manager", "seo executive"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(30, 60) } },
  { family: "marketing-growth", label: "Content Marketer", aliases: ["content marketer", "content strategist", "content writer"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(30, 60) } },
  { family: "marketing-growth", label: "Social Media Manager", aliases: ["social media manager", "social media"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 30), "10+": b(25, 50) } },
  { family: "marketing-growth", label: "Brand Manager", aliases: ["brand manager"], bands: { "0-2": b(6, 14), "3-5": b(14, 30), "6-9": b(25, 60), "10+": b(50, 120) } },
  { family: "marketing-growth", label: "Growth Manager", aliases: ["growth manager", "head of growth"], bands: { "0-2": b(8, 18), "3-5": b(18, 45), "6-9": b(40, 90), "10+": b(80, 150) } },
  { family: "marketing-growth", label: "Product Marketing Manager", aliases: ["product marketing manager", "pmm"], bands: { "0-2": b(10, 22), "3-5": b(22, 55), "6-9": b(50, 120), "10+": b(100, 200) } },
  { family: "marketing-growth", label: "Marketing Director", aliases: ["marketing director"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 300) } },
  { family: "marketing-growth", label: "CMO", aliases: ["chief marketing officer", "cmo"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(200, 800) } },
];

/* ════════════════════════════════════════════════════════════════
   F. Sales & Business Development Roles
   Sales comp is FIXED + VARIABLE + COMMISSION. The numbers below are
   TOTAL OTE; the simulator must split them when presenting offers.
   ════════════════════════════════════════════════════════════════ */
const SALES_BD: RoleFamilyEntry[] = [
  { family: "sales-bd", label: "Sales Executive", aliases: ["sales executive"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(10, 25), "10+": b(20, 45) }, note: "OTE = Fixed + Variable. Typical split: 70/30." },
  { family: "sales-bd", label: "Business Development Executive", aliases: ["business development executive", "bde", "bd executive"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 30), "10+": b(25, 60) } },
  { family: "sales-bd", label: "Account Executive", aliases: ["account executive", "ae"], bands: { "0-2": b(5, 12), "3-5": b(12, 30), "6-9": b(25, 70), "10+": b(60, 150) } },
  { family: "sales-bd", label: "Enterprise Sales Manager", aliases: ["enterprise sales manager", "enterprise ae"], bands: { "0-2": b(8, 18), "3-5": b(18, 45), "6-9": b(40, 100), "10+": b(90, 200) } },
  { family: "sales-bd", label: "Customer Success Manager", aliases: ["customer success manager", "csm"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 60), "10+": b(50, 120) } },
  { family: "sales-bd", label: "Sales Development Rep", aliases: ["sdr", "sales development rep", "bdr"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 30), "10+": NA } },
  { family: "sales-bd", label: "Revenue Operations Manager", aliases: ["revenue operations", "revops"], bands: { "0-2": b(8, 18), "3-5": b(18, 40), "6-9": b(35, 80), "10+": b(70, 150) } },
  { family: "sales-bd", label: "Sales Director", aliases: ["sales director"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 300) } },
  { family: "sales-bd", label: "VP Sales", aliases: ["vp sales", "vp of sales"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(200, 800) } },
];

/* ════════════════════════════════════════════════════════════════
   G. Finance, Accounting & Consulting Roles
   ════════════════════════════════════════════════════════════════ */
const FINANCE_CONSULTING: RoleFamilyEntry[] = [
  { family: "finance-consulting", label: "Accountant", aliases: ["accountant"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(10, 22), "10+": b(18, 40) } },
  { family: "finance-consulting", label: "Finance Analyst", aliases: ["finance analyst", "financial analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "finance-consulting", label: "FP&A Analyst", aliases: ["fp&a", "fpa", "financial planning analyst"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 60), "10+": b(50, 120) } },
  { family: "finance-consulting", label: "Chartered Accountant", aliases: ["chartered accountant", "ca"], bands: { "0-2": b(7, 18), "3-5": b(15, 35), "6-9": b(30, 80), "10+": b(70, 200) } },
  { family: "finance-consulting", label: "Investment Analyst", aliases: ["investment analyst", "ib analyst", "equity analyst"], bands: { "0-2": b(8, 20), "3-5": b(20, 50), "6-9": b(45, 100), "10+": b(90, 200) } },
  { family: "finance-consulting", label: "Strategy Consultant", aliases: ["strategy consultant", "management consultant"], bands: { "0-2": b(10, 25), "3-5": b(25, 60), "6-9": b(50, 120), "10+": b(100, 300) } },
  { family: "finance-consulting", label: "Finance Manager", aliases: ["finance manager"], bands: { "0-2": NA, "3-5": b(18, 40), "6-9": b(35, 80), "10+": b(70, 150) } },
  { family: "finance-consulting", label: "Finance Controller", aliases: ["finance controller", "financial controller"], bands: { "0-2": NA, "3-5": NA, "6-9": b(60, 130), "10+": b(100, 250) } },
  { family: "finance-consulting", label: "CFO", aliases: ["cfo", "chief financial officer"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(200, 1000) } },
];

/* ════════════════════════════════════════════════════════════════
   H. HR, Talent & People Roles
   ════════════════════════════════════════════════════════════════ */
const HR_PEOPLE: RoleFamilyEntry[] = [
  { family: "hr-people", label: "HR Executive", aliases: ["hr executive", "hr generalist"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(10, 22), "10+": b(18, 35) } },
  { family: "hr-people", label: "Recruiter", aliases: ["recruiter", "talent acquisition specialist"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 35), "10+": b(30, 70) } },
  { family: "hr-people", label: "Technical Recruiter", aliases: ["technical recruiter", "tech recruiter"], bands: { "0-2": b(4, 9), "3-5": b(9, 22), "6-9": b(18, 45), "10+": b(40, 90) } },
  { family: "hr-people", label: "HR Business Partner", aliases: ["hr business partner", "hrbp"], bands: { "0-2": b(6, 14), "3-5": b(14, 35), "6-9": b(30, 75), "10+": b(60, 150) } },
  { family: "hr-people", label: "Talent Acquisition Manager", aliases: ["talent acquisition manager", "ta manager"], bands: { "0-2": NA, "3-5": b(15, 35), "6-9": b(30, 70), "10+": b(60, 130) } },
  { family: "hr-people", label: "People Operations Manager", aliases: ["people operations manager", "people ops"], bands: { "0-2": NA, "3-5": b(14, 30), "6-9": b(25, 60), "10+": b(50, 120) } },
  { family: "hr-people", label: "Head of HR", aliases: ["head of hr", "vp of hr"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 400) } },
  { family: "hr-people", label: "CHRO", aliases: ["chro", "chief human resources officer"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(200, 800) } },
];

/* ════════════════════════════════════════════════════════════════
   I. Operations, Supply Chain & Business Roles
   ════════════════════════════════════════════════════════════════ */
const OPERATIONS: RoleFamilyEntry[] = [
  { family: "operations", label: "Operations Executive", aliases: ["operations executive", "ops executive"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(10, 24), "10+": b(20, 45) } },
  { family: "operations", label: "Operations Manager", aliases: ["operations manager", "ops manager"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 60), "10+": b(50, 120) } },
  { family: "operations", label: "Program Manager", aliases: ["program manager", "tpm", "technical program manager"], bands: { "0-2": b(8, 18), "3-5": b(18, 45), "6-9": b(40, 90), "10+": b(80, 180) } },
  { family: "operations", label: "Project Manager", aliases: ["project manager", "pmp"], bands: { "0-2": b(6, 14), "3-5": b(14, 35), "6-9": b(30, 75), "10+": b(60, 150) } },
  { family: "operations", label: "Supply Chain Manager", aliases: ["supply chain manager", "scm"], bands: { "0-2": b(6, 15), "3-5": b(15, 35), "6-9": b(30, 80), "10+": b(70, 150) } },
  { family: "operations", label: "Category Manager", aliases: ["category manager"], bands: { "0-2": b(8, 18), "3-5": b(18, 45), "6-9": b(40, 90), "10+": b(80, 180) } },
  { family: "operations", label: "Business Operations Manager", aliases: ["business operations manager", "biz ops"], bands: { "0-2": b(8, 20), "3-5": b(20, 50), "6-9": b(45, 100), "10+": b(90, 200) } },
  { family: "operations", label: "General Manager", aliases: ["general manager", "gm"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 400) } },
];

/* All roles, flattened for matchRole(). Order matters — earlier
 * entries win on tie (more specific labels first). */
export const ALL_ROLES: RoleFamilyEntry[] = [
  // Most specific first
  ...AI_ML_DATA.filter((r) => /genai|mlops|ml engineer|ai engineer/i.test(r.label)),
  ...PRODUCT_MANAGEMENT.filter((r) => /senior|group|director|vp|chief|lead|associate/i.test(r.label)),
  ...DESIGN.filter((r) => /senior|systems|manager|head|vp|researcher|motion/i.test(r.label)),
  ...SOFTWARE_ENGINEERING.filter((r) => /staff|principal|manager|reliability|automation/i.test(r.label)),
  // Generic next
  ...AI_ML_DATA.filter((r) => !/genai|mlops|ml engineer|ai engineer/i.test(r.label)),
  ...PRODUCT_MANAGEMENT.filter((r) => !/senior|group|director|vp|chief|lead|associate/i.test(r.label)),
  ...DESIGN.filter((r) => !/senior|systems|manager|head|vp|researcher|motion/i.test(r.label)),
  ...SOFTWARE_ENGINEERING.filter((r) => !/staff|principal|manager|reliability|automation/i.test(r.label)),
  ...MARKETING_GROWTH,
  ...SALES_BD,
  ...FINANCE_CONSULTING,
  ...HR_PEOPLE,
  ...OPERATIONS,
];

/** Pick the YOE bucket for a numeric experience-in-years value. */
export function yoeBucket(yearsExp: number): YoeBucket {
  if (yearsExp <= 2) return "0-2";
  if (yearsExp <= 5) return "3-5";
  if (yearsExp <= 9) return "6-9";
  return "10+";
}

/** Convert a normalised ExperienceLevel to a YoeBucket for grid lookup. */
export function expLevelToYoeBucket(exp: "entry" | "mid" | "senior" | "lead" | "executive"): YoeBucket {
  if (exp === "entry") return "0-2";
  if (exp === "mid") return "3-5";
  if (exp === "senior") return "6-9";
  return "10+";
}

/** Match a free-text role to the granular RoleFamilyEntry. Returns
 *  null if no confident match — caller should fall back to the
 *  coarse SALARY_DATA in salaries.ts. */
export function matchGranularRole(role: string): RoleFamilyEntry | null {
  if (!role) return null;
  const lower = role.toLowerCase();
  // Score by alias match length so "Senior Product Designer" beats
  // "Product Designer" beats "UX Designer".
  let best: { entry: RoleFamilyEntry; score: number } | null = null;
  for (const entry of ALL_ROLES) {
    for (const alias of entry.aliases) {
      if (lower.includes(alias)) {
        const score = alias.length;
        if (!best || score > best.score) best = { entry, score };
      }
    }
  }
  return best?.entry ?? null;
}

/* ════════════════════════════════════════════════════════════════
   Tier multipliers — scale the market-wide bands to a given company
   tier. The base bands above represent the "indian-unicorn" /
   mid-tier-product-company posture. Other tiers scale relative to
   that.
   ════════════════════════════════════════════════════════════════ */
const TIER_MULTIPLIER: Record<string, { lo: number; hi: number }> = {
  // Big Tech / FAANG: 1.4x lower, 1.7x upper (equity stretches the top)
  faang: { lo: 1.4, hi: 1.7 },
  "big-tech": { lo: 1.3, hi: 1.6 },
  // GCCs: above unicorn, below FAANG
  gcc: { lo: 1.1, hi: 1.3 },
  // Indian unicorn = baseline
  "indian-unicorn": { lo: 1.0, hi: 1.0 },
  "saas-product": { lo: 0.95, hi: 1.05 },
  // BFSI Global pays close to GCC
  "bfsi-global": { lo: 1.05, hi: 1.25 },
  // BFSI Domestic = mid
  "bfsi-domestic": { lo: 0.7, hi: 0.85 },
  // FMCG MNC slightly below unicorn for tech roles
  "fmcg-mnc": { lo: 0.85, hi: 1.0 },
  // Consulting MBB: 1.2-1.5x for strategy, lower for tech
  "consulting-mbb": { lo: 1.2, hi: 1.5 },
  "consulting-big4": { lo: 0.85, hi: 1.1 },
  // IT-services: ~0.4-0.5x of unicorn — the largest gap
  "it-services": { lo: 0.4, hi: 0.55 },
  // Startups: variance
  "startup-growth": { lo: 0.85, hi: 1.0 },
  "startup-early": { lo: 0.7, hi: 0.9 },
  // EdTech: similar to growth-stage
  edtech: { lo: 0.8, hi: 0.95 },
  // Government/PSU: 7th CPC, very different math — handled separately
  "government-psu": { lo: 0.5, hi: 0.7 },
};

/** Apply the tier multiplier to a base band. */
export function applyTierMultiplier(band: BandTuple, tier: string): BandTuple {
  const mult = TIER_MULTIPLIER[tier] ?? { lo: 1.0, hi: 1.0 };
  return {
    lo: Math.round(band.lo * mult.lo * 10) / 10,
    hi: Math.round(band.hi * mult.hi * 10) / 10,
  };
}

/**
 * Look up a granular band for the given (role, tier, experience).
 * Returns the matched RoleFamilyEntry plus the tier-scaled band, or
 * null if the role isn't recognised. Used by the salary-neg prompt
 * to give the LLM a higher-resolution band reference than the
 * coarse SALARY_DATA tree.
 */
export function lookupGranularBand(
  role: string,
  tier: string,
  expLevel: "entry" | "mid" | "senior" | "lead" | "executive",
): { entry: RoleFamilyEntry; band: BandTuple; bucket: YoeBucket } | null {
  const entry = matchGranularRole(role);
  if (!entry) return null;
  const bucket = expLevelToYoeBucket(expLevel);
  // Walk down on N/A: senior-only roles for 0-2 YOE → return null
  const baseBand = entry.bands[bucket];
  if (!baseBand) {
    // Try adjacent bucket (one step up — closer band beats no band)
    const order: YoeBucket[] = ["0-2", "3-5", "6-9", "10+"];
    const idx = order.indexOf(bucket);
    for (let i = idx + 1; i < order.length; i++) {
      const nb = entry.bands[order[i]];
      if (nb) return { entry, band: applyTierMultiplier(nb, tier), bucket: order[i] };
    }
    for (let i = idx - 1; i >= 0; i--) {
      const nb = entry.bands[order[i]];
      if (nb) return { entry, band: applyTierMultiplier(nb, tier), bucket: order[i] };
    }
    return null;
  }
  return { entry, band: applyTierMultiplier(baseBand, tier), bucket };
}

/** Build a one-line prompt fragment with the granular band. Empty
 *  string if no match — the caller should fall back to the existing
 *  SALARY_DATA-driven context. */
export function formatGranularBand(
  role: string,
  tier: string,
  expLevel: "entry" | "mid" | "senior" | "lead" | "executive",
): string {
  const r = lookupGranularBand(role, tier, expLevel);
  if (!r) return "";
  const tierLabel = tier === "indian-unicorn" ? "mid-tier product company" : tier;
  const noteLine = r.entry.note ? `\n  ${r.entry.note}` : "";
  return `\nGRANULAR ROLE BAND (2025 India, ${r.bucket} YOE bucket, ${tierLabel}):\n  ${r.entry.label}: ₹${r.band.lo}–${r.band.hi} LPA total CTC.${noteLine}\n  This is the typical TOTAL-CTC band for this exact role + level + tier. Anchor your initial offer to the LOWER half of this band; reserve the upper half as your max-stretch.`;
}
