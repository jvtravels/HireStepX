/* HireStepX, Common Indian interview questions (canon)
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
  | "marketing_content"
  /* v2 additions (research-driven, 2026 frequency-weighted): */
  | "closing_questions"        // always-asked closers (any questions for us?, when can you join, plan B)
  | "mba_higher_studies"       // why MBA, why this college, MS vs MBA, plan to study further
  | "banking_psu_finance"      // repo rate, monetary policy, RBI/SBI/IBPS specifics
  | "service_bond_relocation"  // IT-services 2-year bond, tier-3 city posting, family-relocation
  | "ctc_trap_pushback";       // recruiter playbook: "we'll add 15% to your current", "got a hike X months ago"

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

  /* HR round (Indian-style, non-negotiable) */
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
  { category: "fresher", text: "Walk me through your CGPA semester by semester. Any drops, and what caused them?", frequency: 3 },
  { category: "fresher", text: "What was your specific contribution in your final-year project vs. the team's?", frequency: 5 },
  { category: "fresher", text: "Explain DBMS normalisation up to 3NF with a real example.", frequency: 4 },
  { category: "fresher", text: "What's the difference between an array and a linked list? When would you pick each?", frequency: 4 },
  { category: "fresher", text: "Explain OOP, give me a real-world example, not the textbook one.", frequency: 4 },
  { category: "fresher", text: "Have you contributed to any open-source project, hackathon, or coding contest? Walk me through one.", frequency: 3 },
  { category: "fresher", text: "Tell me one thing you've learned in the last 30 days that you can't get from coursework.", frequency: 3 },
  { category: "fresher", text: "What's not on your resume that I should know about you?", frequency: 3 },
  { category: "fresher", text: "If you're given a 6-month-old project with no documentation, how do you onboard yourself in week 1?", frequency: 3 },
  { category: "fresher", text: "Are you considering higher studies (MBA / MS) instead of joining the workforce? Why or why not?", frequency: 3 },

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
  { category: "product_design", text: "Explain your strongest project, what problem were you solving and who were the users?", frequency: 5 },
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
  { category: "sales", text: "Tell me about a deal you lost, what did you learn?", frequency: 4 },
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

  /* ─── Research-driven v2 additions ──────────────────────────────
   * Sourced from: Naukri/Glassdoor/AmbitionBox 2025-2026 candidate
   * post-mortems, Hirist + engineerturnedrecruiter recruiter-side
   * playbook posts, MBA-Crystal-Ball + Inspira Futures personality-
   * test guides, RBI Grade B / IBPS PO interview reports on Anuj
   * Jindal + ixambee, ProductManagementExercises real-question dump
   * for Indian product cos, CiteHR salary-negotiation walkthroughs.
   * Frequency calibrated against ≥3 sources before inclusion. */

  /* Behavioral, additional load-bearing competencies that don't
     show up in a generic STAR list but are very common in mid-to-
     senior Indian rounds. */
  { category: "behavioral", text: "Tell me about a time you led without formal authority, how did you get people on board?", frequency: 4 },
  { category: "behavioral", text: "Tell me about a stretch assignment you took on that was beyond your role.", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time you managed up, how did you push back on your manager?", frequency: 3 },
  { category: "behavioral", text: "Tell me about a time you took initiative without being asked.", frequency: 4 },
  { category: "behavioral", text: "Tell me about a time you mentored a junior teammate.", frequency: 3 },
  { category: "behavioral", text: "Tell me about your biggest mistake, and what you learned from it.", frequency: 4 },

  /* Current job, culturally sticky Indian probes. */
  { category: "current_job_change", text: "Are you on a service bond or training agreement at your current company?", frequency: 3 },
  { category: "current_job_change", text: "Do you have a buy-out option from your current company?", frequency: 3 },
  { category: "current_job_change", text: "What did your last appraisal cycle look like, what feedback did you get?", frequency: 3 },

  /* HR round, the gotcha closers and trap-style questions surfaced in
     candidate post-mortems but missing from v1. */
  { category: "hr_round", text: "Where else have you applied? What stage are those interviews at?", frequency: 4 },
  { category: "hr_round", text: "If you got a higher offer just before joining, what would you do?", frequency: 4 },
  { category: "hr_round", text: "What is your plan B if this doesn't work out?", frequency: 3 },
  { category: "hr_round", text: "Are you planning to pursue higher studies in the next 1-2 years?", frequency: 4 },
  { category: "hr_round", text: "Convince me you're worth this salary in one minute.", frequency: 3 },
  { category: "hr_round", text: "What if we offer you 20% less than your expectation, would you still join?", frequency: 3 },
  { category: "hr_round", text: "Would you accept this offer right now if we extended it?", frequency: 3 },
  { category: "hr_round", text: "Are you ready for client travel including possible overseas postings?", frequency: 3 },
  { category: "hr_round", text: "What does your family think about this opportunity and the location?", frequency: 3 },

  /* Salary negotiation, recruiter-side playbook tactics surfaced
     from CiteHR + engineerturnedrecruiter + Hirist. These are the
     pushbacks Indian recruiters actually deploy mid-call. */
  { category: "salary_negotiation", text: "We see you got a hike just a few months ago, why are you asking for another big jump now?", frequency: 4 },
  { category: "salary_negotiation", text: "Standard practice is to offer 10-15% over your current CTC. Why should we deviate?", frequency: 4 },
  { category: "salary_negotiation", text: "Can you share a copy of your last salary slip so we can calibrate the offer?", frequency: 4 },
  { category: "salary_negotiation", text: "Your expectation is 40-50% over your current, that's outside our pay-band logic. How do you justify it?", frequency: 5 },
  { category: "salary_negotiation", text: "What if we match your current fixed but lower the variable component?", frequency: 3 },
  { category: "salary_negotiation", text: "Would a sign-on bonus instead of higher fixed salary work for you?", frequency: 3 },
  { category: "salary_negotiation", text: "How firm is your number? Where's your real walk-away?", frequency: 3 },

  /* Closing questions, every Indian interview ends with one of
     these. Candidates lose offers by saying "no questions" or
     fumbling the joining-date answer. Always-asked closers. */
  { category: "closing_questions", text: "Do you have any questions for us?", frequency: 5 },
  { category: "closing_questions", text: "When can you join, what's the earliest realistic date?", frequency: 5 },
  { category: "closing_questions", text: "Are you currently interviewing elsewhere? Where are those processes at?", frequency: 4 },
  { category: "closing_questions", text: "Anything you'd like to highlight that we haven't covered?", frequency: 3 },
  { category: "closing_questions", text: "On a scale of 1-10, how interested are you in this role?", frequency: 3 },
  { category: "closing_questions", text: "Is there anything that would stop you from accepting this offer?", frequency: 3 },

  /* MBA / higher studies, asked of freshers and lateral candidates
     where the resume shows a gap or a degree-jump. These are highly
     load-bearing for filtering "will this person leave for a degree
     in 6 months" risk. */
  { category: "mba_higher_studies", text: "Why did you choose to do an MBA?", frequency: 5 },
  { category: "mba_higher_studies", text: "Why this college specifically? Walk me through how you picked it.", frequency: 5 },
  { category: "mba_higher_studies", text: "Why MBA in India and not abroad? Or vice versa?", frequency: 4 },
  { category: "mba_higher_studies", text: "What was your specialization, and why did you pick it?", frequency: 4 },
  { category: "mba_higher_studies", text: "How does your MBA connect to the role you're applying for?", frequency: 5 },
  { category: "mba_higher_studies", text: "Are you considering MS or PhD or any further studies in the next 2 years?", frequency: 4 },
  { category: "mba_higher_studies", text: "Why didn't you go for an MS abroad instead?", frequency: 3 },
  { category: "mba_higher_studies", text: "Tell me about a class, professor, or live project that shaped your thinking.", frequency: 3 },
  { category: "mba_higher_studies", text: "What was your CAT/GMAT/CET score, and why did you choose this college over higher-ranked ones?", frequency: 3 },

  /* Banking / PSU finance, RBI Grade B / IBPS PO / SBI PO / RBI
     scientist all heavily test current monetary-policy awareness +
     functional knowledge. Sourced from Anuj Jindal + ixambee + PW
     interview reports. */
  { category: "banking_psu_finance", text: "What is the current repo rate, reverse repo, SLR, and CRR?", frequency: 5 },
  { category: "banking_psu_finance", text: "Walk me through the latest monetary policy decision and its implications.", frequency: 5 },
  { category: "banking_psu_finance", text: "What are the major functions of the RBI?", frequency: 5 },
  { category: "banking_psu_finance", text: "What is India's current GDP growth rate and inflation level?", frequency: 4 },
  { category: "banking_psu_finance", text: "Tell me about a recent RBI initiative or banking reform you've followed.", frequency: 4 },
  { category: "banking_psu_finance", text: "What is the difference between fiscal and monetary policy?", frequency: 4 },
  { category: "banking_psu_finance", text: "How does UPI affect bank profitability and float?", frequency: 3 },
  { category: "banking_psu_finance", text: "Why do you want to join the public-sector banking system specifically?", frequency: 4 },
  { category: "banking_psu_finance", text: "What is NPA, and what are the recent trends in PSB asset quality?", frequency: 3 },
  { category: "banking_psu_finance", text: "How is the digital rupee (CBDC) different from UPI?", frequency: 3 },
  { category: "banking_psu_finance", text: "What role do priority-sector lending norms play in Indian banking?", frequency: 3 },

  /* Service-bond / relocation, IT-services lifecycle questions. The
     2-year service agreement and "any location in India" clauses are
     load-bearing filters at TCS/Infosys/Wipro/Cognizant/Capgemini. */
  { category: "service_bond_relocation", text: "Are you comfortable signing a 2-year service agreement / training bond?", frequency: 5 },
  { category: "service_bond_relocation", text: "What if you have to repay the bond mid-tenure, are you prepared for that liability?", frequency: 4 },
  { category: "service_bond_relocation", text: "Are you flexible to be posted at any location in India, including tier-2 or tier-3 cities?", frequency: 5 },
  { category: "service_bond_relocation", text: "What if we post you at a client site for 6-12 months, would you be comfortable?", frequency: 4 },
  { category: "service_bond_relocation", text: "Will your family relocate with you, or will you commute?", frequency: 3 },
  { category: "service_bond_relocation", text: "Are you comfortable with 24x7 rotational shifts including night shifts?", frequency: 4 },
  { category: "service_bond_relocation", text: "Are you open to onsite postings in the US, UK, Singapore, or APAC if a project demands it?", frequency: 3 },
  { category: "service_bond_relocation", text: "If we put you on bench for a few months between projects, how would you handle it?", frequency: 3 },

  /* CTC-trap pushback, recruiter mid-call tactics. These deserve a
     dedicated category because they fire in salary-negotiation rounds
     AND in HR rounds, but the candidate's defence is identical: shift
     to market data, never anchor on percentage of current. */
  { category: "ctc_trap_pushback", text: "What's your current take-home / in-hand salary, not just CTC?", frequency: 5 },
  { category: "ctc_trap_pushback", text: "Can you share your last three months' payslips for verification?", frequency: 4 },
  { category: "ctc_trap_pushback", text: "What's the breakdown, fixed, variable, ESOPs, joining bonus, retention bonus?", frequency: 5 },
  { category: "ctc_trap_pushback", text: "Your expectation is way above our band. Can you reconsider, or should we close the conversation here?", frequency: 4 },
  { category: "ctc_trap_pushback", text: "What's the absolute minimum number you'd accept today?", frequency: 4 },
  { category: "ctc_trap_pushback", text: "If we close this offer in 48 hours, can you commit?", frequency: 3 },
  { category: "ctc_trap_pushback", text: "We're hiring at the lower end of the band, would you join and prove yourself for a hike in 6 months?", frequency: 3 },

  /* IT services peer-comparison, a TCS/Infosys/Wipro/Cognizant
     interview almost always asks "why us specifically over our
     direct competitor". Candidates lose marks for vague answers. */
  { category: "it_services", text: "Why our company specifically, and not TCS / Infosys / Wipro / Cognizant?", frequency: 5 },
  { category: "it_services", text: "What do you know about our values and culture? (e.g. TCS Values, Infosys Spirit, Wipro 5 Habits)", frequency: 4 },
  { category: "it_services", text: "Have you applied to any of our direct competitors? At what stage are those?", frequency: 3 },

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
  "hr-round": [
    "hr_round",
    "current_job_change",
    "company_role_fit",
    "opening",
    "ctc_trap_pushback",
    "closing_questions",
  ],
  "campus-placement": [
    "fresher",
    "opening",
    "communication_teamwork",
    "service_bond_relocation",
    "mba_higher_studies",
    "closing_questions",
  ],
  "salary-negotiation": ["salary_negotiation", "hr_round", "ctc_trap_pushback"],
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
export const COMPANY_TIER_TO_CANON_CATEGORY: Record<string, IndianCanonCategory | IndianCanonCategory[]> = {
  // IT-services tier surfaces both the general "client work" canon AND
  // the bond/relocation lifecycle probes — both fire mid-call.
  "it-services": ["it_services", "service_bond_relocation"],
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

  /* Canon is only for focuses where the format actually matches ,
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
    const tierCats = COMPANY_TIER_TO_CANON_CATEGORY[companyTier];
    if (Array.isArray(tierCats)) {
      for (const c of tierCats) categorySet.add(c);
    } else {
      categorySet.add(tierCats);
    }
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
  return `INDIAN INTERVIEWER CANON (must paraphrase at least one of these per session, never copy verbatim, but preserve the probe's intent so the candidate practises the question they will actually face):
${bullets}`;
}
