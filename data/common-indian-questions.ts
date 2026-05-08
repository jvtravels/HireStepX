/* HireStepX — Common Indian interview questions (canon)
 *
 * Real interviewers in India lean heavily on a small set of recurring
 * questions — "tell me about yourself", "why are you leaving",
 * "current/expected CTC", "tell me a time you handled pressure",
 * "what is your notice period", "why this company". Generated
 * questions miss this canon when the LLM optimises for "interesting"
 * over "realistic". Embedding the canon as a prior in the system
 * prompt anchors the LLM toward what candidates actually face.
 *
 * NOT shown verbatim to the candidate — passed to the LLM as a
 * "MUST sample from / paraphrase one of these" reference list. The
 * existing question bank in `interview-question-bank.ts` covers
 * company-specific style; this file covers the universal canon.
 *
 * Curation source: aggregate of Naukri/Glassdoor/AmbitionBox top-
 * frequency questions across 2024-2026, cross-checked with internal
 * post-mortem submissions from candidates.
 *
 * Tested in src/__tests__/commonIndianQuestions.test.ts.
 */

export type IndianCanonCategory =
  | "opening"
  | "resume_experience"
  | "current_job_change"
  | "company_role_fit"
  | "behavioral"
  | "communication_teamwork"
  | "problem_solving"
  | "hr_round"
  | "salary_negotiation"
  | "fresher"
  | "it_services"
  | "startup"
  | "gcc"
  | "product_design"
  | "sales"
  | "customer_support"
  | "finance_accounting"
  | "marketing_content";

export interface IndianCanonEntry {
  category: IndianCanonCategory;
  /** Canonical question text. The LLM may paraphrase but should preserve intent. */
  text: string;
  /** Higher = more frequent in real Indian interviews. 1 = niche, 5 = nearly always asked. */
  frequency: 1 | 2 | 3 | 4 | 5;
}

/* ─── The canon ─────────────────────────────────────────────────── */

export const COMMON_INDIAN_QUESTIONS: IndianCanonEntry[] = [
  /* Opening */
  { category: "opening", text: "Tell me about yourself.", frequency: 5 },
  { category: "opening", text: "Walk me through your resume.", frequency: 5 },
  { category: "opening", text: "Can you introduce yourself?", frequency: 4 },
  { category: "opening", text: "Tell me about your current role.", frequency: 4 },
  { category: "opening", text: "What are your key responsibilities in your current role?", frequency: 4 },
  { category: "opening", text: "Which project are you most proud of?", frequency: 4 },
  { category: "opening", text: "What are your strengths?", frequency: 4 },
  { category: "opening", text: "What are your weaknesses?", frequency: 4 },
  { category: "opening", text: "Why should we hire you?", frequency: 5 },
  { category: "opening", text: "What makes you different from other candidates?", frequency: 3 },

  /* Resume / experience */
  { category: "resume_experience", text: "Explain your most recent project.", frequency: 5 },
  { category: "resume_experience", text: "What was your role in this project?", frequency: 5 },
  { category: "resume_experience", text: "What exactly did you contribute?", frequency: 4 },
  { category: "resume_experience", text: "What technologies, tools, or processes did you use?", frequency: 4 },
  { category: "resume_experience", text: "What challenge did you face in this project, and how did you solve it?", frequency: 5 },
  { category: "resume_experience", text: "What was the final outcome?", frequency: 4 },
  { category: "resume_experience", text: "What did you learn from this project?", frequency: 4 },
  { category: "resume_experience", text: "What would you improve if you worked on it again?", frequency: 3 },
  { category: "resume_experience", text: "Why is there a gap in your resume?", frequency: 3 },

  /* Current job + reason for change */
  { category: "current_job_change", text: "Why are you looking for a change?", frequency: 5 },
  { category: "current_job_change", text: "Why do you want to leave your current company?", frequency: 5 },
  { category: "current_job_change", text: "Why did you leave your previous company?", frequency: 4 },
  { category: "current_job_change", text: "What is missing in your current role?", frequency: 3 },
  { category: "current_job_change", text: "What did you like and dislike about your current company?", frequency: 3 },
  { category: "current_job_change", text: "Why are you leaving so soon?", frequency: 3 },
  { category: "current_job_change", text: "Why have you stayed in your current company for so long?", frequency: 2 },
  { category: "current_job_change", text: "Are you currently serving notice, or have you resigned already?", frequency: 4 },

  /* Company / role fit */
  { category: "company_role_fit", text: "Why do you want to join our company?", frequency: 5 },
  { category: "company_role_fit", text: "What do you know about our company?", frequency: 5 },
  { category: "company_role_fit", text: "Why are you interested in this role?", frequency: 4 },
  { category: "company_role_fit", text: "How does this role match your experience?", frequency: 4 },
  { category: "company_role_fit", text: "What are your expectations from this role?", frequency: 3 },
  { category: "company_role_fit", text: "What kind of company culture do you prefer?", frequency: 3 },
  { category: "company_role_fit", text: "What value can you bring to our team?", frequency: 4 },

  /* Behavioral (STAR) */
  { category: "behavioral", text: "Tell me about a time you handled pressure.", frequency: 5 },
  { category: "behavioral", text: "Tell me about a time you failed.", frequency: 5 },
  { category: "behavioral", text: "Tell me about a time you made a mistake.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you missed a deadline.", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time you worked in a team.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you had a conflict with a teammate.", frequency: 5 },
  { category: "behavioral", text: "Tell me about a time you disagreed with your manager.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you received tough feedback.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you took ownership.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you solved a difficult problem.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you handled a difficult customer or client.", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time you had to convince someone.", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time you worked with unclear requirements.", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time priorities changed suddenly.", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time you improved a process.", frequency: 3 },

  /* Communication / teamwork */
  { category: "communication_teamwork", text: "How do you handle feedback?", frequency: 5 },
  { category: "communication_teamwork", text: "How do you handle conflict at work?", frequency: 4 },
  { category: "communication_teamwork", text: "How do you communicate delays to stakeholders?", frequency: 4 },
  { category: "communication_teamwork", text: "How do you work with difficult teammates?", frequency: 3 },
  { category: "communication_teamwork", text: "How do you explain complex ideas simply?", frequency: 3 },
  { category: "communication_teamwork", text: "How do you manage stakeholder expectations?", frequency: 4 },
  { category: "communication_teamwork", text: "How do you work with cross-functional teams?", frequency: 3 },
  { category: "communication_teamwork", text: "How do you build trust with teammates?", frequency: 3 },

  /* Problem-solving */
  { category: "problem_solving", text: "How do you solve a problem you've never faced before?", frequency: 4 },
  { category: "problem_solving", text: "What do you do when you are stuck?", frequency: 3 },
  { category: "problem_solving", text: "How do you prioritize multiple tasks?", frequency: 5 },
  { category: "problem_solving", text: "How do you handle urgent work?", frequency: 4 },
  { category: "problem_solving", text: "How do you make decisions with incomplete information?", frequency: 4 },
  { category: "problem_solving", text: "How do you balance speed and quality?", frequency: 3 },
  { category: "problem_solving", text: "Tell me about a time you solved a problem with limited resources.", frequency: 3 },
  { category: "problem_solving", text: "Tell me about a time your first solution did not work.", frequency: 3 },
  { category: "problem_solving", text: "How do you find the root cause of a problem?", frequency: 3 },

  /* HR round (Indian-style — non-negotiable) */
  { category: "hr_round", text: "What is your current CTC?", frequency: 5 },
  { category: "hr_round", text: "What is your expected CTC?", frequency: 5 },
  { category: "hr_round", text: "What is your fixed and variable breakup?", frequency: 4 },
  { category: "hr_round", text: "Are you flexible on salary?", frequency: 4 },
  { category: "hr_round", text: "Why are you expecting this salary?", frequency: 4 },
  { category: "hr_round", text: "What is your notice period? Can you join earlier?", frequency: 5 },
  { category: "hr_round", text: "Are you open to relocation?", frequency: 4 },
  { category: "hr_round", text: "Are you comfortable working from office, hybrid, or remote?", frequency: 4 },
  { category: "hr_round", text: "Are you comfortable with shifts or global calls?", frequency: 3 },
  { category: "hr_round", text: "Are you interviewing with other companies, or do you have other offers?", frequency: 4 },
  { category: "hr_round", text: "If we release an offer, will you accept? When can you join?", frequency: 4 },
  { category: "hr_round", text: "Where do you see yourself in 2-5 years?", frequency: 4 },

  /* Salary negotiation (specialised pushbacks) */
  { category: "salary_negotiation", text: "What salary are you expecting?", frequency: 5 },
  { category: "salary_negotiation", text: "What is your minimum acceptable salary?", frequency: 4 },
  { category: "salary_negotiation", text: "Why are you asking for this hike?", frequency: 5 },
  { category: "salary_negotiation", text: "Your expectation is above our budget. Can you reconsider?", frequency: 5 },
  { category: "salary_negotiation", text: "You are asking for a 40-50% hike. How do you justify it?", frequency: 4 },
  { category: "salary_negotiation", text: "What if we offer more variable and less fixed?", frequency: 4 },
  { category: "salary_negotiation", text: "What if we offer ESOPs instead of higher fixed salary?", frequency: 4 },
  { category: "salary_negotiation", text: "Do you have a competing offer?", frequency: 4 },
  { category: "salary_negotiation", text: "What number would make you accept immediately?", frequency: 3 },
  { category: "salary_negotiation", text: "How will you decide between multiple offers?", frequency: 3 },

  /* Fresher (campus / 0-2 yoe) */
  { category: "fresher", text: "Why did you choose this field?", frequency: 4 },
  { category: "fresher", text: "Explain your final-year project.", frequency: 5 },
  { category: "fresher", text: "What technologies or tools did you use in your project?", frequency: 4 },
  { category: "fresher", text: "What did you learn during your internship?", frequency: 4 },
  { category: "fresher", text: "Why should we hire you as a fresher?", frequency: 4 },
  { category: "fresher", text: "Are you willing to learn new technologies?", frequency: 3 },
  { category: "fresher", text: "Are you comfortable relocating?", frequency: 4 },
  { category: "fresher", text: "Are you comfortable with a training or service agreement?", frequency: 4 },
  { category: "fresher", text: "Where do you see yourself in 2 years?", frequency: 3 },
  { category: "fresher", text: "Do you have any questions for us?", frequency: 4 },

  /* IT services (TCS / Infosys / Wipro / HCL / Cognizant / Accenture / Capgemini / LTIMindtree / Tech Mahindra) */
  { category: "it_services", text: "Are you comfortable working on client projects?", frequency: 5 },
  { category: "it_services", text: "Are you comfortable with support work?", frequency: 4 },
  { category: "it_services", text: "Are you comfortable with rotational shifts?", frequency: 4 },
  { category: "it_services", text: "How do you handle changing client requirements?", frequency: 4 },
  { category: "it_services", text: "How do you communicate with clients?", frequency: 4 },
  { category: "it_services", text: "Are you comfortable signing a service agreement?", frequency: 4 },
  { category: "it_services", text: "Are you comfortable learning a different technology if the project demands it?", frequency: 4 },
  { category: "it_services", text: "How do you handle production issues?", frequency: 3 },
  { category: "it_services", text: "Can you work under tight deadlines?", frequency: 3 },

  /* Startup (Razorpay / CRED / Groww / Zepto / Swiggy / Zomato / Meesho / Urban Company) */
  { category: "startup", text: "How do you handle ambiguity?", frequency: 5 },
  { category: "startup", text: "How do you prioritize when everything feels urgent?", frequency: 4 },
  { category: "startup", text: "What would you do in your first 30 days here?", frequency: 4 },
  { category: "startup", text: "Tell me about a time you moved fast under uncertainty.", frequency: 4 },
  { category: "startup", text: "Tell me about a time you solved a problem with limited resources.", frequency: 4 },
  { category: "startup", text: "What makes you suitable for a startup environment?", frequency: 4 },
  { category: "startup", text: "What metric did your work directly improve, and by how much?", frequency: 4 },
  { category: "startup", text: "What trade-off did you make on a recent project?", frequency: 3 },
  { category: "startup", text: "What do you know about our product? What would you improve in it?", frequency: 4 },

  /* GCC (JPMorgan / Goldman / Walmart Global Tech / Target / HSBC / Wells Fargo / Lowe's / TR / Salesforce GCC) */
  { category: "gcc", text: "Tell me about a time you worked with global teams across time zones.", frequency: 5 },
  { category: "gcc", text: "How do you manage stakeholders across time zones?", frequency: 4 },
  { category: "gcc", text: "How do you document your work for handoffs?", frequency: 4 },
  { category: "gcc", text: "Tell me about a time you improved a process.", frequency: 4 },
  { category: "gcc", text: "How do you escalate risks early?", frequency: 4 },
  { category: "gcc", text: "How do you handle compliance-heavy or audit-heavy work?", frequency: 4 },
  { category: "gcc", text: "How do you communicate status updates to a distributed team?", frequency: 3 },
  { category: "gcc", text: "Why do you want to work in a GCC?", frequency: 3 },
  { category: "gcc", text: "How do you work with people from different cultures?", frequency: 3 },

  /* Product / Design */
  { category: "product_design", text: "Walk me through your portfolio.", frequency: 5 },
  { category: "product_design", text: "Explain your strongest project — what problem were you solving and who were the users?", frequency: 5 },
  { category: "product_design", text: "What research did you do before designing the solution?", frequency: 4 },
  { category: "product_design", text: "Why did you choose this design or solution?", frequency: 4 },
  { category: "product_design", text: "What trade-off did you make on this project?", frequency: 4 },
  { category: "product_design", text: "How did you measure success?", frequency: 4 },
  { category: "product_design", text: "How did you handle stakeholder feedback or developer pushback?", frequency: 3 },
  { category: "product_design", text: "How do you balance user needs with business goals?", frequency: 4 },
  { category: "product_design", text: "How do you handle criticism of your work?", frequency: 3 },

  /* Sales / BD */
  { category: "sales", text: "What product or service have you sold, and what was your target?", frequency: 5 },
  { category: "sales", text: "Did you achieve your target? By how much did you exceed or miss?", frequency: 4 },
  { category: "sales", text: "How do you generate leads?", frequency: 4 },
  { category: "sales", text: "How do you qualify a prospect?", frequency: 3 },
  { category: "sales", text: "How do you handle objections?", frequency: 4 },
  { category: "sales", text: "Tell me about your toughest sale.", frequency: 4 },
  { category: "sales", text: "Tell me about a deal you lost — what did you learn?", frequency: 4 },
  { category: "sales", text: "How do you negotiate pricing?", frequency: 4 },
  { category: "sales", text: "How do you handle rejection?", frequency: 3 },

  /* Customer support / BPO */
  { category: "customer_support", text: "How do you handle angry customers?", frequency: 5 },
  { category: "customer_support", text: "How do you handle repetitive work?", frequency: 3 },
  { category: "customer_support", text: "Are you comfortable with night shifts and voice-process work?", frequency: 5 },
  { category: "customer_support", text: "How do you explain complex issues simply to a non-technical customer?", frequency: 4 },
  { category: "customer_support", text: "Tell me about a difficult customer interaction.", frequency: 4 },
  { category: "customer_support", text: "How do you handle escalations?", frequency: 4 },
  { category: "customer_support", text: "How do you meet quality scores while hitting volume targets?", frequency: 4 },
  { category: "customer_support", text: "What would you do if a customer was abusive?", frequency: 4 },
  { category: "customer_support", text: "How do you stay calm under pressure?", frequency: 3 },

  /* Finance / accounting */
  { category: "finance_accounting", text: "What financial reports have you prepared?", frequency: 4 },
  { category: "finance_accounting", text: "What is the difference between P&L, balance sheet, and cash flow?", frequency: 5 },
  { category: "finance_accounting", text: "How do you ensure accuracy in financial work?", frequency: 4 },
  { category: "finance_accounting", text: "How do you handle month-end closing?", frequency: 4 },
  { category: "finance_accounting", text: "Tell me about a time you found a financial error.", frequency: 3 },
  { category: "finance_accounting", text: "What is GST or TDS, and when do they apply?", frequency: 4 },
  { category: "finance_accounting", text: "What is working capital, and how do you analyze it?", frequency: 3 },
  { category: "finance_accounting", text: "What finance metrics do you track regularly?", frequency: 3 },
  { category: "finance_accounting", text: "What is your experience with Excel or Tally / SAP / Oracle?", frequency: 4 },

  /* Marketing / content */
  { category: "marketing_content", text: "Which campaigns have you worked on?", frequency: 4 },
  { category: "marketing_content", text: "How do you define your target audience?", frequency: 4 },
  { category: "marketing_content", text: "How do you measure campaign success?", frequency: 5 },
  { category: "marketing_content", text: "How do you do keyword research and search-intent mapping?", frequency: 3 },
  { category: "marketing_content", text: "How do you write content for SEO without sacrificing voice?", frequency: 3 },
  { category: "marketing_content", text: "Tell me about a campaign or content piece that performed exceptionally well.", frequency: 4 },
  { category: "marketing_content", text: "Tell me about a campaign or content piece that failed.", frequency: 4 },
  { category: "marketing_content", text: "How do you improve social media engagement?", frequency: 3 },
  { category: "marketing_content", text: "How do you maintain brand voice across platforms?", frequency: 3 },
];

/* ─── Top-25 most-repeated (fast-path for "warmup" / opening flows) ── */
export const TOP_25_INDIAN_QUESTIONS: string[] = [
  "Tell me about yourself.",
  "Walk me through your resume.",
  "Why are you looking for a change?",
  "Why do you want to leave your current company?",
  "Why do you want to join our company?",
  "What do you know about our company?",
  "Why should we hire you?",
  "What are your strengths?",
  "What is your weakness?",
  "Explain your current/last project.",
  "What was your role in that project?",
  "What challenge did you face?",
  "Tell me about a time you handled pressure.",
  "Tell me about a time you failed.",
  "Tell me about a time you had a conflict at work.",
  "How do you handle feedback?",
  "Where do you see yourself in 2-5 years?",
  "What is your current CTC?",
  "What is your expected CTC?",
  "Why are you expecting this salary?",
  "What is your notice period?",
  "Are you open to relocation?",
  "Do you have any other offers?",
  "When can you join?",
  "Do you have any questions for us?",
];

/* ─── Focus → category map ─────────────────────────────────────────
 * Tells the prompt-builder which canon categories to surface for a
 * given interview focus. A focus may pull from multiple categories;
 * order is "primary first" so the formatter can prioritise.
 *
 * DELIBERATELY RESTRICTED — canon only applies to focuses where the
 * format genuinely matches:
 *   ✓ behavioral   — STAR chestnuts (pressure, failure, conflict)
 *   ✓ hr-round     — CTC / notice-period / fit canon is non-negotiable
 *   ✓ campus-placement — fresher canon (final-year project, service agreement)
 *   ✓ salary-negotiation — pushback canon (hike justification, ESOP swap)
 *   ✗ case-study   — hypothesis-driven analysis; "tell me about yourself" breaks the FRAME→QUANTIFY arc
 *   ✗ strategic    — board-level vision questions; HR canon dilutes the register
 *   ✗ technical    — system-design / architecture deep-dives; canon would feel off-format
 *   ✗ panel        — already persona-distributed; mixing canon weakens persona discipline
 *   ✗ management   — hire/fire / org-design specifics; behavioral canon waters it down
 *   ✗ government-psu — DAF-style biographical probing has its own bank
 *
 * Keep aligned with the FocusArea union in interview-question-bank.ts
 * and the focusToType map in SessionSetup.tsx.
 */
export const FOCUS_TO_CANON_CATEGORIES: Record<string, IndianCanonCategory[]> = {
  behavioral: ["behavioral", "communication_teamwork", "problem_solving", "opening"],
  "hr-round": ["hr_round", "current_job_change", "company_role_fit", "opening"],
  "campus-placement": ["fresher", "opening", "communication_teamwork"],
  "salary-negotiation": ["salary_negotiation", "hr_round"],
};

/** Focuses where canon (and its role/tier expansion) is allowed to fire. */
const CANON_ENABLED_FOCUSES = new Set(Object.keys(FOCUS_TO_CANON_CATEGORIES));

/* Role-keyword → category map. When a role hints at a specialised
 * track (sales / support / finance / marketing / product / GCC),
 * pull the matching canon category in addition to the focus-based set.
 * Keys are lowercase substrings tested against the role string. */
export const ROLE_KEYWORD_TO_CANON_CATEGORY: Array<[RegExp, IndianCanonCategory]> = [
  [/\bsales|business\s*development|bde|account\s*executive\b/i, "sales"],
  [/\bsupport|bpo|customer\s*service|csa\b/i, "customer_support"],
  [/\b(finance|account|accountant|ca|cfo|controller|treasury)\b/i, "finance_accounting"],
  [/\bmarketing|content|seo|copywriter|brand|social\s*media\b/i, "marketing_content"],
  [/\b(product\s*manager|pm|designer|ux|ui)\b/i, "product_design"],
];

/* Company-tier → category supplement. Startups + GCCs ask categorically
 * different "fit" questions vs IT-services (rotational shifts, service
 * agreement) vs product cos (ownership + ambiguity). */
export const COMPANY_TIER_TO_CANON_CATEGORY: Record<string, IndianCanonCategory> = {
  "it-services": "it_services",
  "indian-unicorn": "startup",
  "startup-growth": "startup",
  "startup-early": "startup",
  "saas-product": "startup",
  gcc: "gcc",
  "bfsi-global": "gcc",
};

/* ─── Prompt formatter ─────────────────────────────────────────────
 *
 * Returns a short prompt fragment listing 6-12 highly-relevant canon
 * questions for the given (focus, role, companyTier) tuple. The LLM
 * is instructed to **paraphrase** at least one canon question per
 * session — never copy verbatim, but preserve the intent so the
 * candidate hears the same probe a real interviewer would use.
 *
 * Returns "" when no canon applies (e.g. government-psu).
 */
export function formatCommonIndianCanon(opts: {
  focus: string | null | undefined;
  role?: string | null;
  companyTier?: string | null;
  /** When true, include only frequency≥4 questions. Default false. */
  highFrequencyOnly?: boolean;
  /** Cap on output entries. Default 10. */
  limit?: number;
}): string {
  const focus = (opts.focus || "").toLowerCase();
  const role = (opts.role || "").toLowerCase();
  const companyTier = (opts.companyTier || "").toLowerCase();
  const limit = Math.max(1, opts.limit ?? 10);
  const minFreq = opts.highFrequencyOnly ? 4 : 3;

  /* Canon is only for focuses where the format actually matches —
     opening / CTC / behavioral chestnuts would break the arc of a
     case-study, technical, strategic, panel, or management round. */
  if (!CANON_ENABLED_FOCUSES.has(focus)) return "";

  const focusCategories = FOCUS_TO_CANON_CATEGORIES[focus] ?? [];
  const categorySet = new Set<IndianCanonCategory>(focusCategories);

  // Role-keyword expansion (only fires on canon-enabled focuses)
  for (const [re, cat] of ROLE_KEYWORD_TO_CANON_CATEGORY) {
    if (re.test(role)) categorySet.add(cat);
  }
  // Company-tier expansion (only fires on canon-enabled focuses)
  if (companyTier && COMPANY_TIER_TO_CANON_CATEGORY[companyTier]) {
    categorySet.add(COMPANY_TIER_TO_CANON_CATEGORY[companyTier]);
  }
  if (categorySet.size === 0) return "";

  // Pull entries from each category, sort by frequency desc, dedupe text.
  const seen = new Set<string>();
  const picks: IndianCanonEntry[] = [];
  for (const e of COMMON_INDIAN_QUESTIONS) {
    if (!categorySet.has(e.category)) continue;
    if (e.frequency < minFreq) continue;
    if (seen.has(e.text)) continue;
    seen.add(e.text);
    picks.push(e);
  }
  picks.sort((a, b) => b.frequency - a.frequency);
  const top = picks.slice(0, limit);
  if (top.length === 0) return "";

  const bullets = top.map((e) => `- ${e.text}`).join("\n");
  return `INDIAN INTERVIEWER CANON (must paraphrase at least one of these per session — never copy verbatim, but preserve the probe's intent so the candidate practises the question they will actually face):
${bullets}`;
}
