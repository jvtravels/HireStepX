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
  | "operations"
  | "customer-support-bpo"
  | "consulting-strategy"
  | "ev-energy-mfg"
  | "vertical-india";

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
  /* Additions from full role audit */
  { family: "software-engineering", label: "Web Engineer", aliases: ["web engineer", "web developer"], bands: { "0-2": b(4, 11), "3-5": b(11, 26), "6-9": b(22, 50), "10+": b(40, 85) } },
  { family: "software-engineering", label: "API Engineer", aliases: ["api engineer", "api developer"], bands: { "0-2": b(5, 14), "3-5": b(14, 33), "6-9": b(28, 65), "10+": b(50, 110) } },
  { family: "software-engineering", label: "Product Engineer", aliases: ["product engineer"], bands: { "0-2": b(6, 16), "3-5": b(16, 38), "6-9": b(32, 80), "10+": b(60, 140) } },
  { family: "software-engineering", label: "Manual Tester", aliases: ["manual tester", "manual qa"], bands: { "0-2": b(2.5, 6), "3-5": b(6, 14), "6-9": b(12, 28), "10+": b(22, 45) } },
  { family: "software-engineering", label: "Performance Test Engineer", aliases: ["performance test engineer", "performance testing"], bands: { "0-2": b(4, 10), "3-5": b(10, 25), "6-9": b(20, 45), "10+": b(35, 75) } },
  { family: "software-engineering", label: "Release Engineer", aliases: ["release engineer", "build engineer"], bands: { "0-2": b(5, 13), "3-5": b(13, 32), "6-9": b(28, 65), "10+": b(55, 110) } },
  { family: "software-engineering", label: "Technical Architect", aliases: ["technical architect", "tech architect"], bands: { "0-2": NA, "3-5": b(25, 55), "6-9": b(50, 110), "10+": b(90, 200) } },
  { family: "software-engineering", label: "Director of Engineering", aliases: ["director of engineering", "director engineering"], bands: { "0-2": NA, "3-5": NA, "6-9": b(90, 180), "10+": b(150, 350) } },
  { family: "software-engineering", label: "VP of Engineering", aliases: ["vp engineering", "vp of engineering"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(220, 600) } },
  { family: "software-engineering", label: "CTO", aliases: ["cto", "chief technology officer", "co-founder & cto"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(250, 1000) } },
];

/* ════════════════════════════════════════════════════════════════
   B. AI / ML / Data & Analytics Roles
   AI/ML/Data carry a 2025 SKILL PREMIUM, bands sit above generalist
   tech for the same YOE.
   ════════════════════════════════════════════════════════════════ */
const AI_ML_DATA: RoleFamilyEntry[] = [
  { family: "ai-ml-data", label: "Data Analyst", aliases: ["data analyst", "business intelligence analyst", "bi analyst"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(30, 60) } },
  { family: "ai-ml-data", label: "Business Analyst", aliases: ["business analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "ai-ml-data", label: "Data Engineer", aliases: ["data engineer", "data architect", "etl engineer"], bands: { "0-2": b(5, 14), "3-5": b(14, 35), "6-9": b(30, 75), "10+": b(60, 130) } },
  { family: "ai-ml-data", label: "Data Scientist", aliases: ["data scientist", "research scientist"], bands: { "0-2": b(6, 16), "3-5": b(16, 40), "6-9": b(35, 85), "10+": b(70, 150) } },
  { family: "ai-ml-data", label: "ML Engineer", aliases: ["ml engineer", "machine learning engineer"], bands: { "0-2": b(8, 20), "3-5": b(20, 50), "6-9": b(45, 100), "10+": b(90, 200) }, note: "AI/ML SKILL PREMIUM applies, anchor at upper half of band, not median." },
  { family: "ai-ml-data", label: "AI Engineer", aliases: ["ai engineer", "applied ai engineer"], bands: { "0-2": b(8, 22), "3-5": b(22, 55), "6-9": b(50, 120), "10+": b(100, 250) }, note: "AI/ML SKILL PREMIUM applies." },
  { family: "ai-ml-data", label: "GenAI Engineer", aliases: ["genai", "gen ai", "generative ai", "llm engineer", "prompt engineer"], bands: { "0-2": b(10, 25), "3-5": b(25, 60), "6-9": b(55, 140), "10+": b(100, 250) }, note: "GenAI commands the strongest premium of any tech role in 2025." },
  { family: "ai-ml-data", label: "MLOps Engineer", aliases: ["mlops", "ml platform", "ml infrastructure"], bands: { "0-2": b(8, 20), "3-5": b(20, 45), "6-9": b(45, 100), "10+": b(80, 180) } },
  { family: "ai-ml-data", label: "Analytics Manager", aliases: ["analytics manager", "head of analytics"], bands: { "0-2": NA, "3-5": b(20, 40), "6-9": b(35, 80), "10+": b(70, 150) } },
  { family: "ai-ml-data", label: "Head of Data", aliases: ["head of data", "vp of data", "director of data"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 300) } },
  /* Additions from full role audit */
  { family: "ai-ml-data", label: "AI Product Specialist", aliases: ["ai product specialist", "ai specialist"], bands: { "0-2": b(8, 20), "3-5": b(20, 50), "6-9": b(45, 100), "10+": b(80, 180) } },
  { family: "ai-ml-data", label: "ML Scientist", aliases: ["ml scientist", "machine learning scientist"], bands: { "0-2": b(10, 25), "3-5": b(25, 60), "6-9": b(55, 130), "10+": b(110, 250) }, note: "Research-heavy ML role; often requires PhD or strong publications. AI/ML SKILL PREMIUM applies." },
  { family: "ai-ml-data", label: "Applied Scientist", aliases: ["applied scientist", "research scientist"], bands: { "0-2": b(10, 25), "3-5": b(25, 60), "6-9": b(55, 130), "10+": b(110, 250) }, note: "AI/ML SKILL PREMIUM applies." },
  { family: "ai-ml-data", label: "Computer Vision Engineer", aliases: ["computer vision engineer", "cv engineer", "vision engineer"], bands: { "0-2": b(8, 22), "3-5": b(22, 55), "6-9": b(50, 120), "10+": b(95, 200) }, note: "Specialised ML, AI/ML SKILL PREMIUM applies." },
  { family: "ai-ml-data", label: "NLP Engineer", aliases: ["nlp engineer", "natural language processing engineer"], bands: { "0-2": b(8, 22), "3-5": b(22, 55), "6-9": b(50, 120), "10+": b(95, 200) }, note: "Specialised ML, AI/ML SKILL PREMIUM applies." },
  { family: "ai-ml-data", label: "Decision Scientist", aliases: ["decision scientist"], bands: { "0-2": b(7, 18), "3-5": b(18, 42), "6-9": b(38, 90), "10+": b(75, 160) } },
  { family: "ai-ml-data", label: "Big Data Engineer", aliases: ["big data engineer", "spark engineer", "hadoop engineer"], bands: { "0-2": b(5, 14), "3-5": b(14, 35), "6-9": b(30, 75), "10+": b(60, 130) } },
  { family: "ai-ml-data", label: "Analytics Engineer", aliases: ["analytics engineer", "dbt engineer"], bands: { "0-2": b(5, 14), "3-5": b(14, 35), "6-9": b(30, 75), "10+": b(60, 130) } },
  { family: "ai-ml-data", label: "ETL Developer", aliases: ["etl developer", "etl engineer", "informatica developer"], bands: { "0-2": b(4, 10), "3-5": b(10, 25), "6-9": b(22, 50), "10+": b(45, 95) } },
  { family: "ai-ml-data", label: "Product Analyst", aliases: ["product analyst"], bands: { "0-2": b(4, 11), "3-5": b(11, 25), "6-9": b(22, 50), "10+": b(45, 90) } },
  { family: "ai-ml-data", label: "Marketing Analyst", aliases: ["marketing analyst", "marketing data analyst"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "ai-ml-data", label: "Risk Analyst", aliases: ["risk analyst", "risk modelling analyst"], bands: { "0-2": b(4, 11), "3-5": b(11, 26), "6-9": b(24, 55), "10+": b(48, 100) } },
  { family: "ai-ml-data", label: "BI Developer", aliases: ["bi developer", "business intelligence developer"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "ai-ml-data", label: "Power BI Developer", aliases: ["power bi developer", "powerbi developer"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "ai-ml-data", label: "Tableau Developer", aliases: ["tableau developer", "tableau analyst"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "ai-ml-data", label: "Reporting Analyst", aliases: ["reporting analyst", "mis analyst", "mis executive"], bands: { "0-2": b(3, 7), "3-5": b(7, 15), "6-9": b(14, 30), "10+": b(28, 55) } },
  { family: "ai-ml-data", label: "Data Science Manager", aliases: ["data science manager", "ds manager"], bands: { "0-2": NA, "3-5": b(25, 55), "6-9": b(50, 110), "10+": b(95, 200) } },
  { family: "ai-ml-data", label: "Chief Data Officer", aliases: ["chief data officer", "cdo"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(180, 600) } },
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
  /* Specialised + Industry PMs */
  { family: "product-management", label: "Technical Product Manager", aliases: ["technical product manager", "tpm"], bands: { "0-2": b(12, 30), "3-5": b(28, 60), "6-9": b(50, 110), "10+": b(95, 200) } },
  { family: "product-management", label: "AI Product Manager", aliases: ["ai product manager", "ai pm"], bands: { "0-2": b(15, 35), "3-5": b(32, 70), "6-9": b(60, 140), "10+": b(110, 250) }, note: "AI PMs command a 15-25% premium over generic PMs in 2025." },
  { family: "product-management", label: "Growth Product Manager", aliases: ["growth product manager", "growth pm"], bands: { "0-2": b(13, 32), "3-5": b(28, 60), "6-9": b(55, 120), "10+": b(100, 220) } },
  { family: "product-management", label: "Platform Product Manager", aliases: ["platform pm", "platform product manager"], bands: { "0-2": b(13, 32), "3-5": b(28, 60), "6-9": b(55, 120), "10+": b(100, 220) } },
  { family: "product-management", label: "Fintech Product Manager", aliases: ["fintech pm", "fintech product manager"], bands: { "0-2": b(14, 32), "3-5": b(30, 65), "6-9": b(55, 130), "10+": b(105, 240) } },
  { family: "product-management", label: "SaaS Product Manager", aliases: ["saas pm", "saas product manager"], bands: { "0-2": b(13, 30), "3-5": b(28, 60), "6-9": b(50, 115), "10+": b(95, 220) } },
  { family: "product-management", label: "Consumer App Product Manager", aliases: ["consumer pm", "consumer app pm", "consumer product manager"], bands: { "0-2": b(12, 28), "3-5": b(25, 55), "6-9": b(45, 105), "10+": b(85, 200) } },
  { family: "product-management", label: "EV Platform Product Manager", aliases: ["ev pm", "ev platform pm", "ev product manager"], bands: { "0-2": b(11, 26), "3-5": b(24, 55), "6-9": b(45, 100), "10+": b(85, 180) } },
  { family: "product-management", label: "Healthtech Product Manager", aliases: ["healthtech pm", "healthcare pm"], bands: { "0-2": b(11, 26), "3-5": b(24, 55), "6-9": b(45, 105), "10+": b(85, 200) } },
];

/* ════════════════════════════════════════════════════════════════
   D. Design Roles
   Senior design pay reflects portfolio depth, business impact,
   design-systems ownership, stakeholder management, NOT Figma
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
  /* Additions: senior IC + content design + leadership extensions */
  { family: "design", label: "Lead Product Designer", aliases: ["lead product designer", "lead designer"], bands: { "0-2": NA, "3-5": b(28, 55), "6-9": b(55, 110), "10+": b(95, 180) } },
  { family: "design", label: "Principal Product Designer", aliases: ["principal product designer", "principal designer"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 250) } },
  { family: "design", label: "Interaction Designer", aliases: ["interaction designer", "ixd"], bands: { "0-2": b(4, 11), "3-5": b(11, 28), "6-9": b(22, 50), "10+": b(40, 90) } },
  { family: "design", label: "User Researcher", aliases: ["user researcher"], bands: { "0-2": b(5, 12), "3-5": b(12, 30), "6-9": b(25, 60), "10+": b(50, 100) } },
  { family: "design", label: "Research Operations Specialist", aliases: ["research operations", "research ops", "researchops"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 55), "10+": b(45, 90) } },
  { family: "design", label: "UX Writer", aliases: ["ux writer"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "design", label: "Content Designer", aliases: ["content designer"], bands: { "0-2": b(4, 11), "3-5": b(11, 26), "6-9": b(22, 50), "10+": b(42, 85) } },
  { family: "design", label: "Conversation Designer", aliases: ["conversation designer", "conversational designer", "voice designer"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(24, 55), "10+": b(45, 90) } },
  { family: "design", label: "Director of Design", aliases: ["director of design", "design director"], bands: { "0-2": NA, "3-5": NA, "6-9": b(90, 180), "10+": b(150, 350) } },
  { family: "design", label: "Chief Design Officer", aliases: ["chief design officer", "cdo design"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(220, 700) } },
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
  /* Marketing additions */
  { family: "marketing-growth", label: "Marketing Specialist", aliases: ["marketing specialist"], bands: { "0-2": b(3, 7), "3-5": b(7, 15), "6-9": b(13, 28), "10+": b(25, 50) } },
  { family: "marketing-growth", label: "Paid Ads Specialist", aliases: ["paid ads", "ppc specialist", "paid media"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 22), "6-9": b(18, 42), "10+": b(35, 75) } },
  { family: "marketing-growth", label: "Media Buyer", aliases: ["media buyer", "media planning"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 22), "6-9": b(18, 42), "10+": b(35, 75) } },
  { family: "marketing-growth", label: "SEO Manager", aliases: ["seo manager", "search marketing manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "marketing-growth", label: "Community Manager", aliases: ["community manager", "community lead"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 35), "10+": b(28, 55) } },
  { family: "marketing-growth", label: "Influencer Marketing Manager", aliases: ["influencer marketing manager", "influencer manager"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "marketing-growth", label: "Brand Strategist", aliases: ["brand strategist"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 55), "10+": b(48, 100) } },
  { family: "marketing-growth", label: "Communications Manager", aliases: ["communications manager", "comms manager", "pr manager"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 55), "10+": b(48, 100) } },
  { family: "marketing-growth", label: "GTM Manager", aliases: ["gtm manager", "go to market manager"], bands: { "0-2": NA, "3-5": b(18, 40), "6-9": b(40, 90), "10+": b(75, 160) } },
  { family: "marketing-growth", label: "Customer Marketing Manager", aliases: ["customer marketing manager", "lifecycle marketing manager"], bands: { "0-2": b(8, 18), "3-5": b(18, 42), "6-9": b(38, 85), "10+": b(70, 145) } },
  { family: "marketing-growth", label: "Growth Lead", aliases: ["growth lead", "head of growth"], bands: { "0-2": NA, "3-5": b(25, 55), "6-9": b(50, 110), "10+": b(95, 200) } },
  { family: "marketing-growth", label: "Head of Marketing", aliases: ["head of marketing", "marketing head"], bands: { "0-2": NA, "3-5": NA, "6-9": b(70, 150), "10+": b(120, 280) } },
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
  /* Sales additions */
  { family: "sales-bd", label: "Sales Manager", aliases: ["sales manager"], bands: { "0-2": NA, "3-5": b(8, 20), "6-9": b(18, 45), "10+": b(40, 90) } },
  { family: "sales-bd", label: "Territory Sales Manager", aliases: ["territory sales manager", "territory manager"], bands: { "0-2": b(4, 9), "3-5": b(9, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "sales-bd", label: "Area Sales Manager", aliases: ["area sales manager"], bands: { "0-2": b(4, 10), "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 85) } },
  { family: "sales-bd", label: "Zonal Sales Manager", aliases: ["zonal sales manager"], bands: { "0-2": NA, "3-5": b(12, 28), "6-9": b(25, 55), "10+": b(50, 120) } },
  { family: "sales-bd", label: "BDR", aliases: ["bdr", "business development representative"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(15, 30), "10+": NA } },
  { family: "sales-bd", label: "Inside Sales Representative", aliases: ["inside sales", "inside sales rep"], bands: { "0-2": b(3, 8), "3-5": b(7, 18), "6-9": b(15, 35), "10+": NA } },
  { family: "sales-bd", label: "Key Account Manager", aliases: ["key account manager", "kam"], bands: { "0-2": NA, "3-5": b(12, 30), "6-9": b(25, 65), "10+": b(55, 130) } },
  { family: "sales-bd", label: "Strategic Account Manager", aliases: ["strategic account manager"], bands: { "0-2": NA, "3-5": b(15, 35), "6-9": b(30, 75), "10+": b(65, 150) } },
  { family: "sales-bd", label: "Account Manager", aliases: ["account manager"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 55), "10+": b(45, 110) } },
  { family: "sales-bd", label: "Customer Success Associate", aliases: ["customer success associate", "cs associate"], bands: { "0-2": b(3.5, 9), "3-5": b(9, 20), "6-9": b(18, 38), "10+": NA } },
  { family: "sales-bd", label: "Partnerships Manager", aliases: ["partnerships manager", "partnership manager"], bands: { "0-2": NA, "3-5": b(12, 30), "6-9": b(25, 60), "10+": b(50, 120) } },
  { family: "sales-bd", label: "Channel Sales Manager", aliases: ["channel sales manager", "channel manager"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 60), "10+": b(50, 110) } },
  { family: "sales-bd", label: "Alliance Manager", aliases: ["alliance manager", "alliances manager"], bands: { "0-2": NA, "3-5": b(15, 35), "6-9": b(30, 70), "10+": b(60, 140) } },
  { family: "sales-bd", label: "Sales Operations Manager", aliases: ["sales operations manager", "sales ops manager"], bands: { "0-2": b(6, 14), "3-5": b(14, 32), "6-9": b(28, 65), "10+": b(55, 120) } },
  { family: "sales-bd", label: "Regional Sales Head", aliases: ["regional sales head", "regional sales director"], bands: { "0-2": NA, "3-5": NA, "6-9": b(50, 120), "10+": b(100, 250) } },
  { family: "sales-bd", label: "Chief Revenue Officer", aliases: ["cro", "chief revenue officer"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(180, 600) } },
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
  /* Finance / Risk / Legal additions */
  { family: "finance-consulting", label: "Accounts Executive", aliases: ["accounts executive"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 11), "6-9": b(10, 22), "10+": b(20, 40) } },
  { family: "finance-consulting", label: "Accounts Manager", aliases: ["accounts manager"], bands: { "0-2": NA, "3-5": b(8, 18), "6-9": b(16, 35), "10+": b(30, 65) } },
  { family: "finance-consulting", label: "Internal Auditor", aliases: ["internal auditor", "internal audit"], bands: { "0-2": b(4, 9), "3-5": b(9, 22), "6-9": b(20, 50), "10+": b(45, 110) } },
  { family: "finance-consulting", label: "Tax Consultant", aliases: ["tax consultant", "tax analyst", "indirect tax"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "finance-consulting", label: "Equity Research Analyst", aliases: ["equity research analyst", "equity analyst", "research analyst"], bands: { "0-2": b(8, 18), "3-5": b(18, 45), "6-9": b(40, 95), "10+": b(85, 200) } },
  { family: "finance-consulting", label: "Credit Analyst", aliases: ["credit analyst", "credit risk analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "finance-consulting", label: "Fraud Analyst", aliases: ["fraud analyst", "fraud detection analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "finance-consulting", label: "Compliance Analyst", aliases: ["compliance analyst", "regulatory compliance"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "finance-consulting", label: "Legal Associate", aliases: ["legal associate", "associate lawyer"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 55), "10+": b(48, 120) } },
  { family: "finance-consulting", label: "Contract Manager", aliases: ["contract manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "finance-consulting", label: "Legal Counsel", aliases: ["legal counsel", "in-house counsel"], bands: { "0-2": NA, "3-5": b(15, 35), "6-9": b(35, 80), "10+": b(75, 200) } },
  { family: "finance-consulting", label: "Company Secretary", aliases: ["company secretary", "cs"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "finance-consulting", label: "General Counsel", aliases: ["general counsel"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 180), "10+": b(150, 400) } },
  { family: "finance-consulting", label: "Head of Finance", aliases: ["head of finance", "head finance", "vp finance"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 180), "10+": b(150, 400) } },
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
  /* HR / People additions */
  { family: "hr-people", label: "HR Generalist", aliases: ["hr generalist"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(10, 22), "10+": b(18, 35) } },
  { family: "hr-people", label: "HR Manager", aliases: ["hr manager", "human resources manager"], bands: { "0-2": NA, "3-5": b(8, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "hr-people", label: "Talent Acquisition Specialist", aliases: ["talent acquisition specialist", "ta specialist"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 30), "10+": b(28, 60) } },
  { family: "hr-people", label: "Senior HRBP", aliases: ["senior hrbp", "sr hrbp"], bands: { "0-2": NA, "3-5": NA, "6-9": b(40, 90), "10+": b(80, 180) } },
  { family: "hr-people", label: "Employee Experience Manager", aliases: ["employee experience manager", "ex manager", "people experience manager"], bands: { "0-2": NA, "3-5": b(15, 32), "6-9": b(28, 65), "10+": b(55, 120) } },
  { family: "hr-people", label: "L&D Specialist", aliases: ["l&d specialist", "learning and development specialist", "training specialist"], bands: { "0-2": b(3, 8), "3-5": b(8, 18), "6-9": b(16, 35), "10+": b(32, 70) } },
  { family: "hr-people", label: "Training Manager", aliases: ["training manager", "l&d manager", "learning manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 95) } },
  { family: "hr-people", label: "Compensation & Benefits Analyst", aliases: ["compensation and benefits", "comp and ben", "c&b analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "hr-people", label: "Payroll Specialist", aliases: ["payroll specialist", "payroll executive"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(10, 22), "10+": b(18, 38) } },
  { family: "hr-people", label: "VP People", aliases: ["vp people", "vp of people"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(150, 400) } },
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
  /* Operations additions */
  { family: "operations", label: "Delivery Manager", aliases: ["delivery manager"], bands: { "0-2": NA, "3-5": b(15, 35), "6-9": b(30, 70), "10+": b(60, 130) } },
  { family: "operations", label: "Supply Chain Executive", aliases: ["supply chain executive"], bands: { "0-2": b(3, 7), "3-5": b(7, 15), "6-9": b(13, 28), "10+": b(25, 50) } },
  { family: "operations", label: "Logistics Manager", aliases: ["logistics manager"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 55), "10+": b(48, 110) } },
  { family: "operations", label: "Procurement Specialist", aliases: ["procurement specialist", "procurement executive"], bands: { "0-2": b(3.5, 8), "3-5": b(8, 18), "6-9": b(16, 38), "10+": b(32, 65) } },
  { family: "operations", label: "Purchase Manager", aliases: ["purchase manager", "procurement manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "operations", label: "Vendor Manager", aliases: ["vendor manager", "supplier manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "operations", label: "Marketplace Manager", aliases: ["marketplace manager"], bands: { "0-2": b(8, 18), "3-5": b(18, 40), "6-9": b(35, 80), "10+": b(70, 150) } },
  { family: "operations", label: "Merchandising Manager", aliases: ["merchandising manager", "merchandiser"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 60), "10+": b(50, 110) } },
  { family: "operations", label: "Head of Operations", aliases: ["head of operations", "head operations"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 180), "10+": b(150, 400) } },
  { family: "operations", label: "COO", aliases: ["coo", "chief operating officer"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(250, 1000) } },
];

/* ════════════════════════════════════════════════════════════════
   J. Customer Support / BPO / Service Roles
   The single largest white-collar employment base in India. Bands
   are lower than tech but volumes are huge.
   ════════════════════════════════════════════════════════════════ */
const CUSTOMER_SUPPORT_BPO: RoleFamilyEntry[] = [
  { family: "customer-support-bpo", label: "Customer Support Executive", aliases: ["customer support executive", "customer support exec"], bands: { "0-2": b(2, 4.5), "3-5": b(4, 8), "6-9": b(7, 14), "10+": b(13, 25) } },
  { family: "customer-support-bpo", label: "Customer Service Associate", aliases: ["customer service associate", "customer service rep"], bands: { "0-2": b(2, 4.5), "3-5": b(4, 8), "6-9": b(7, 14), "10+": b(13, 25) } },
  { family: "customer-support-bpo", label: "Support Specialist", aliases: ["support specialist"], bands: { "0-2": b(2.5, 5), "3-5": b(5, 10), "6-9": b(9, 18), "10+": b(16, 30) } },
  { family: "customer-support-bpo", label: "Technical Support Engineer", aliases: ["technical support engineer", "tech support"], bands: { "0-2": b(3, 7), "3-5": b(6, 14), "6-9": b(12, 25), "10+": b(22, 45) } },
  { family: "customer-support-bpo", label: "Application Support Engineer", aliases: ["application support engineer", "app support engineer"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 30), "10+": b(25, 55) } },
  { family: "customer-support-bpo", label: "Voice Process Executive", aliases: ["voice process executive", "voice process", "international voice"], bands: { "0-2": b(2, 4.5), "3-5": b(4, 8), "6-9": b(7, 14), "10+": NA } },
  { family: "customer-support-bpo", label: "Non-Voice Process Executive", aliases: ["non-voice process", "non voice process", "chat process"], bands: { "0-2": b(2, 4), "3-5": b(3.5, 7), "6-9": b(6, 12), "10+": NA } },
  { family: "customer-support-bpo", label: "Process Associate", aliases: ["process associate", "back office associate"], bands: { "0-2": b(2, 4), "3-5": b(3.5, 7), "6-9": b(6, 12), "10+": NA } },
  { family: "customer-support-bpo", label: "CX Associate", aliases: ["cx associate", "customer experience associate"], bands: { "0-2": b(2.5, 5.5), "3-5": b(5, 11), "6-9": b(10, 20), "10+": b(18, 35) } },
  { family: "customer-support-bpo", label: "CX Manager", aliases: ["cx manager", "customer experience manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "customer-support-bpo", label: "Team Lead Support", aliases: ["team lead support", "support team lead"], bands: { "0-2": NA, "3-5": b(7, 14), "6-9": b(13, 25), "10+": b(22, 45) } },
  { family: "customer-support-bpo", label: "Customer Support Manager", aliases: ["customer support manager", "support manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "customer-support-bpo", label: "Operations Lead (Support)", aliases: ["operations lead support", "support operations lead"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
];

/* ════════════════════════════════════════════════════════════════
   K. Consulting / Strategy / Business Roles
   Distinct from "consultant" generic, encodes the MBB + Big-4 +
   in-house strategy ladder explicitly.
   ════════════════════════════════════════════════════════════════ */
const CONSULTING_STRATEGY: RoleFamilyEntry[] = [
  { family: "consulting-strategy", label: "Analyst (Consulting)", aliases: ["consulting analyst"], bands: { "0-2": b(8, 22), "3-5": b(18, 45), "6-9": NA, "10+": NA }, note: "MBB analyst (BCG/McKinsey/Bain) starts higher than Big 4." },
  { family: "consulting-strategy", label: "Associate Consultant", aliases: ["associate consultant"], bands: { "0-2": b(10, 28), "3-5": b(22, 55), "6-9": b(45, 100), "10+": NA } },
  { family: "consulting-strategy", label: "Consultant", aliases: ["consultant"], bands: { "0-2": NA, "3-5": b(25, 60), "6-9": b(50, 110), "10+": b(95, 200) } },
  { family: "consulting-strategy", label: "Senior Consultant", aliases: ["senior consultant", "sr consultant"], bands: { "0-2": NA, "3-5": NA, "6-9": b(60, 130), "10+": b(110, 250) } },
  { family: "consulting-strategy", label: "Strategy Analyst", aliases: ["strategy analyst"], bands: { "0-2": b(8, 20), "3-5": b(18, 42), "6-9": b(38, 85), "10+": b(75, 160) } },
  { family: "consulting-strategy", label: "Strategy Manager", aliases: ["strategy manager"], bands: { "0-2": NA, "3-5": b(20, 45), "6-9": b(40, 90), "10+": b(80, 180) } },
  { family: "consulting-strategy", label: "Business Strategy Manager", aliases: ["business strategy manager"], bands: { "0-2": NA, "3-5": b(20, 45), "6-9": b(40, 90), "10+": b(80, 180) } },
  { family: "consulting-strategy", label: "Business Transformation Consultant", aliases: ["business transformation consultant", "transformation consultant"], bands: { "0-2": NA, "3-5": b(20, 45), "6-9": b(40, 90), "10+": b(80, 180) } },
  { family: "consulting-strategy", label: "Digital Transformation Consultant", aliases: ["digital transformation consultant", "digital transformation"], bands: { "0-2": b(8, 22), "3-5": b(20, 50), "6-9": b(45, 100), "10+": b(85, 200) } },
  { family: "consulting-strategy", label: "Engagement Manager", aliases: ["engagement manager"], bands: { "0-2": NA, "3-5": b(40, 90), "6-9": b(80, 170), "10+": b(150, 350) }, note: "MBB engagement manager, usually post-MBA, 4-6 YOE." },
  { family: "consulting-strategy", label: "Principal (Consulting)", aliases: ["consulting principal", "mbb principal"], bands: { "0-2": NA, "3-5": NA, "6-9": b(120, 250), "10+": b(220, 500) } },
  { family: "consulting-strategy", label: "Partner (Consulting)", aliases: ["consulting partner", "mbb partner"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(300, 1500) } },
  { family: "consulting-strategy", label: "Strategy Head", aliases: ["strategy head", "head of strategy"], bands: { "0-2": NA, "3-5": NA, "6-9": b(80, 180), "10+": b(150, 400) } },
  { family: "consulting-strategy", label: "Chief Strategy Officer", aliases: ["chief strategy officer", "cso"], bands: { "0-2": NA, "3-5": NA, "6-9": NA, "10+": b(200, 800) } },
];

/* ════════════════════════════════════════════════════════════════
   L. EV / Energy / Manufacturing / Infra Roles
   High-growth space (TeamLease 2025 reports). Especially relevant
   for DynaChrg-class clients, explicit charging-network roles +
   software-platform roles for EV companies.
   ════════════════════════════════════════════════════════════════ */
const EV_ENERGY_MFG: RoleFamilyEntry[] = [
  { family: "ev-energy-mfg", label: "EV Charging Operations Manager", aliases: ["ev charging operations manager", "charging ops manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  { family: "ev-energy-mfg", label: "Charging Network Manager", aliases: ["charging network manager", "ev network manager"], bands: { "0-2": NA, "3-5": b(12, 26), "6-9": b(25, 55), "10+": b(50, 110) } },
  { family: "ev-energy-mfg", label: "Site Acquisition Manager", aliases: ["site acquisition manager", "site acquisition"], bands: { "0-2": b(4, 9), "3-5": b(9, 20), "6-9": b(18, 40), "10+": b(35, 75) } },
  { family: "ev-energy-mfg", label: "Energy Analyst", aliases: ["energy analyst"], bands: { "0-2": b(4, 10), "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "ev-energy-mfg", label: "Energy Management Specialist", aliases: ["energy management specialist", "energy manager"], bands: { "0-2": b(4, 10), "3-5": b(10, 24), "6-9": b(22, 50), "10+": b(45, 95) } },
  { family: "ev-energy-mfg", label: "Grid Integration Engineer", aliases: ["grid integration engineer", "grid engineer"], bands: { "0-2": b(5, 12), "3-5": b(12, 28), "6-9": b(25, 55), "10+": b(50, 110) } },
  { family: "ev-energy-mfg", label: "Power Electronics Engineer", aliases: ["power electronics engineer", "power electronics"], bands: { "0-2": b(5, 13), "3-5": b(13, 30), "6-9": b(28, 65), "10+": b(55, 130) } },
  { family: "ev-energy-mfg", label: "Production Engineer", aliases: ["production engineer", "manufacturing engineer"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 32), "10+": b(28, 60) } },
  { family: "ev-energy-mfg", label: "Quality Engineer", aliases: ["quality engineer", "quality control engineer"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 32), "10+": b(28, 60) } },
  { family: "ev-energy-mfg", label: "Plant Manager", aliases: ["plant manager", "factory manager"], bands: { "0-2": NA, "3-5": NA, "6-9": b(30, 70), "10+": b(60, 140) } },
  { family: "ev-energy-mfg", label: "Field Service Engineer", aliases: ["field service engineer", "field engineer"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 11), "6-9": b(10, 22), "10+": b(20, 40) } },
  { family: "ev-energy-mfg", label: "Installation Engineer", aliases: ["installation engineer"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 11), "6-9": b(10, 22), "10+": b(20, 40) } },
  { family: "ev-energy-mfg", label: "Maintenance Engineer", aliases: ["maintenance engineer"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 11), "6-9": b(10, 22), "10+": b(20, 40) } },
  { family: "ev-energy-mfg", label: "EV Software Product Manager", aliases: ["ev software product manager", "ev software pm"], bands: { "0-2": b(11, 26), "3-5": b(24, 55), "6-9": b(45, 105), "10+": b(85, 200) } },
  { family: "ev-energy-mfg", label: "Charging Platform Engineer", aliases: ["charging platform engineer", "charging software engineer"], bands: { "0-2": b(5, 14), "3-5": b(14, 32), "6-9": b(28, 65), "10+": b(55, 120) } },
  { family: "ev-energy-mfg", label: "EV App Product Designer", aliases: ["ev app designer", "ev product designer"], bands: { "0-2": b(5, 12), "3-5": b(12, 30), "6-9": b(25, 60), "10+": b(50, 110) } },
];

/* ════════════════════════════════════════════════════════════════
   M. Vertical India Growth Roles, Healthcare, Education, Real
   Estate, Hospitality, Retail, Creator Economy
   These are non-tech roles where India hiring volumes are large.
   Bands skew lower-cash + higher-variable (real estate, retail) or
   pure service (healthcare admin).
   ════════════════════════════════════════════════════════════════ */
const VERTICAL_INDIA: RoleFamilyEntry[] = [
  /* Healthcare */
  { family: "vertical-india", label: "Medical Sales Representative", aliases: ["medical sales representative", "medical representative", "medical rep"], bands: { "0-2": b(2.5, 5), "3-5": b(5, 10), "6-9": b(9, 18), "10+": b(15, 30) }, note: "Heavy variable component, 30-40% of total OTE typical." },
  { family: "vertical-india", label: "Healthcare Operations Manager", aliases: ["healthcare operations manager", "hospital ops manager"], bands: { "0-2": NA, "3-5": b(8, 18), "6-9": b(18, 40), "10+": b(35, 80) } },
  { family: "vertical-india", label: "Hospital Administrator", aliases: ["hospital administrator", "hospital admin"], bands: { "0-2": b(3, 7), "3-5": b(7, 15), "6-9": b(15, 32), "10+": b(28, 65) } },
  { family: "vertical-india", label: "Clinical Data Analyst", aliases: ["clinical data analyst", "clinical research analyst"], bands: { "0-2": b(3.5, 8), "3-5": b(8, 18), "6-9": b(16, 35), "10+": b(30, 65) } },
  /* EdTech / Education */
  { family: "vertical-india", label: "Academic Counsellor", aliases: ["academic counsellor", "academic counselor", "edtech counsellor"], bands: { "0-2": b(2.5, 5), "3-5": b(4, 9), "6-9": b(8, 18), "10+": b(15, 30) }, note: "Heavy commission/incentive component at edtech (Byju's-style firms)." },
  { family: "vertical-india", label: "Curriculum Designer", aliases: ["curriculum designer", "curriculum developer", "instructional designer"], bands: { "0-2": b(3, 7), "3-5": b(7, 16), "6-9": b(14, 32), "10+": b(28, 60) } },
  { family: "vertical-india", label: "Learning Experience Designer", aliases: ["learning experience designer", "lxd"], bands: { "0-2": b(4, 10), "3-5": b(10, 22), "6-9": b(20, 45), "10+": b(40, 80) } },
  { family: "vertical-india", label: "Admissions Counsellor", aliases: ["admissions counsellor", "admissions counselor"], bands: { "0-2": b(2.5, 5), "3-5": b(4, 9), "6-9": b(8, 18), "10+": b(15, 30) } },
  /* Real Estate */
  { family: "vertical-india", label: "Real Estate Sales Manager", aliases: ["real estate sales manager", "real estate sales"], bands: { "0-2": b(3, 8), "3-5": b(8, 25), "6-9": b(20, 60), "10+": b(40, 150) }, note: "Highly variable comp, commission can 2-3x base in good years." },
  { family: "vertical-india", label: "Relationship Manager (Real Estate)", aliases: ["relationship manager real estate", "real estate relationship manager"], bands: { "0-2": b(3, 7), "3-5": b(7, 18), "6-9": b(15, 40), "10+": b(35, 90) }, note: "Variable + commission heavy." },
  { family: "vertical-india", label: "Property Consultant", aliases: ["property consultant"], bands: { "0-2": b(3, 7), "3-5": b(7, 18), "6-9": b(15, 40), "10+": b(35, 90) } },
  { family: "vertical-india", label: "Channel Partner Manager", aliases: ["channel partner manager"], bands: { "0-2": NA, "3-5": b(10, 22), "6-9": b(22, 50), "10+": b(45, 100) } },
  /* Hospitality */
  { family: "vertical-india", label: "Hotel Operations Manager", aliases: ["hotel operations manager", "hotel ops manager"], bands: { "0-2": NA, "3-5": b(7, 16), "6-9": b(16, 35), "10+": b(32, 70) } },
  { family: "vertical-india", label: "Guest Relations Executive", aliases: ["guest relations executive", "guest relations"], bands: { "0-2": b(2.5, 5), "3-5": b(4, 8), "6-9": b(8, 16), "10+": b(15, 30) } },
  { family: "vertical-india", label: "Revenue Manager (Hospitality)", aliases: ["revenue manager hospitality", "hotel revenue manager"], bands: { "0-2": NA, "3-5": b(8, 18), "6-9": b(18, 40), "10+": b(38, 80) } },
  /* Retail */
  { family: "vertical-india", label: "Store Manager", aliases: ["store manager", "retail store manager"], bands: { "0-2": b(2.5, 6), "3-5": b(5, 12), "6-9": b(11, 24), "10+": b(22, 45) } },
  { family: "vertical-india", label: "Retail Operations Manager", aliases: ["retail operations manager", "retail ops manager"], bands: { "0-2": NA, "3-5": b(8, 18), "6-9": b(18, 40), "10+": b(38, 80) } },
  { family: "vertical-india", label: "Category Executive", aliases: ["category executive"], bands: { "0-2": b(3.5, 8), "3-5": b(8, 18), "6-9": b(16, 35), "10+": b(32, 65) } },
  { family: "vertical-india", label: "Merchandiser", aliases: ["merchandiser"], bands: { "0-2": b(3, 7), "3-5": b(7, 15), "6-9": b(13, 28), "10+": b(25, 55) } },
  /* Creator economy / media */
  { family: "vertical-india", label: "Video Editor", aliases: ["video editor", "video editing"], bands: { "0-2": b(2.5, 7), "3-5": b(6, 16), "6-9": b(14, 35), "10+": b(28, 65) }, note: "Wide variance, agency rates lower, top creator-economy or OTT shops can pay 2-3x." },
  { family: "vertical-india", label: "Content Creator", aliases: ["content creator", "creator"], bands: { "0-2": b(2, 8), "3-5": b(6, 20), "6-9": b(15, 50), "10+": b(30, 120) }, note: "Salary alone misleads, most income for established creators is brand deals + ad revenue." },
  { family: "vertical-india", label: "Creative Producer", aliases: ["creative producer"], bands: { "0-2": b(3, 8), "3-5": b(8, 20), "6-9": b(18, 45), "10+": b(35, 85) } },
  { family: "vertical-india", label: "Script Writer", aliases: ["script writer", "screenplay writer", "scriptwriter"], bands: { "0-2": b(2.5, 6), "3-5": b(6, 14), "6-9": b(12, 28), "10+": b(25, 60) }, note: "OTT / streaming script work pays 2-3x traditional TV." },
];

/* All roles, flattened for matchRole(). Order matters, earlier
 * entries win on tie (more specific labels first). */
export const ALL_ROLES: RoleFamilyEntry[] = [
  // Most specific first
  ...AI_ML_DATA.filter((r) => /genai|mlops|ml engineer|ai engineer|ml scientist|applied scientist|computer vision|nlp/i.test(r.label)),
  ...PRODUCT_MANAGEMENT.filter((r) => /senior|group|director|vp|chief|lead|associate|technical|ai|growth|platform|fintech|saas|consumer|ev|healthtech/i.test(r.label)),
  ...DESIGN.filter((r) => /senior|systems|manager|head|vp|researcher|motion|lead|principal|interaction|writer|content|conversation|director|chief/i.test(r.label)),
  ...SOFTWARE_ENGINEERING.filter((r) => /staff|principal|manager|reliability|automation|architect|director|vp|cto/i.test(r.label)),
  ...CONSULTING_STRATEGY,
  // Generic next
  ...AI_ML_DATA.filter((r) => !/genai|mlops|ml engineer|ai engineer|ml scientist|applied scientist|computer vision|nlp/i.test(r.label)),
  ...PRODUCT_MANAGEMENT.filter((r) => !/senior|group|director|vp|chief|lead|associate|technical|ai|growth|platform|fintech|saas|consumer|ev|healthtech/i.test(r.label)),
  ...DESIGN.filter((r) => !/senior|systems|manager|head|vp|researcher|motion|lead|principal|interaction|writer|content|conversation|director|chief/i.test(r.label)),
  ...SOFTWARE_ENGINEERING.filter((r) => !/staff|principal|manager|reliability|automation|architect|director|vp|cto/i.test(r.label)),
  ...MARKETING_GROWTH,
  ...SALES_BD,
  ...FINANCE_CONSULTING,
  ...HR_PEOPLE,
  ...OPERATIONS,
  ...EV_ENERGY_MFG,
  ...VERTICAL_INDIA,
  ...CUSTOMER_SUPPORT_BPO,
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
   Tier multipliers, scale the market-wide bands to a given company
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
