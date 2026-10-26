import type { ReactNode } from "react";
import { RoundFlow, SalaryLadder, FrameworkSteps, PrepTimeline } from "../../marketing-v2/_blog-infographics";

export const SECTION_VISUALS_3: Record<string, ReactNode> = {
  "nvidia-india-interview-questions-2026||Nvidia India Salary and Career": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Software Engineer (Entry)", min: 25, max: 40, note: "RSUs are core comp" },
      { role: "Senior Software Engineer (3–6 yrs)", min: 40, max: 65 },
      { role: "Staff Engineer / Tech Lead (6+ yrs)", min: 60, max: 95 },
      { role: "Principal Engineer / Manager (8+ yrs)", min: 80, max: 140 },
    ]} caption="Nvidia India total compensation 2026 — RSUs on 4yr vest; significant upside" />
  ),

  /* qualcomm-india-interview-questions-2026 (first occurrence, index 71) */
  "qualcomm-india-interview-questions-2026||Qualcomm India Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding / Aptitude Screen", duration: "60 min", detail: "C++ MCQs, pointers, OS concepts, embedded systems basics" },
      { label: "Technical Round 1 — C++ and OS", duration: "60 min", detail: "Memory management, multithreading, process synchronisation" },
      { label: "Technical Round 2 — Embedded / Modem", duration: "60 min", detail: "RTOS, driver development, protocol stack (5G/LTE)" },
      { label: "Design Round", duration: "60 min", detail: "System design: modem firmware architecture or baseband stack" },
      { label: "HR Round", duration: "20 min", detail: "Team fit, Qualcomm values, long-term goals" },
    ]} />
  ),
  "qualcomm-india-interview-questions-2026||Qualcomm India Salary and Career": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Engineer (0–2 yrs)", min: 18, max: 28, note: "Embedded and firmware roles" },
      { role: "Senior Engineer (2–5 yrs)", min: 28, max: 42 },
      { role: "Staff Engineer (5–8 yrs)", min: 40, max: 60 },
      { role: "Principal Engineer (8+ yrs)", min: 55, max: 90 },
    ]} caption="Qualcomm India salary 2026 — RSUs vest over 3yr; Hyderabad + Bangalore offices" />
  ),

  /* apple-india-interview-questions-2026: GCC/MNC */
  "apple-india-interview-questions-2026||Apple India Interview Process": (
    <RoundFlow rounds={[
      { label: "Phone Screen with Recruiter", duration: "30 min", detail: "Background, role alignment, timeline" },
      { label: "Technical Phone Screen", duration: "60 min", detail: "DSA, iOS/macOS internals or backend systems depending on role" },
      { label: "Virtual Onsite — Coding ×2", duration: "60 min each", detail: "Swift/C++ depth, algorithms, platform-specific optimisations" },
      { label: "Virtual Onsite — Domain Round", duration: "60 min", detail: "Core Audio / Security / ML / GPU frameworks based on team" },
      { label: "Behavioral / Hiring Manager", duration: "45 min", detail: "Apple values: quality, privacy by design, cross-team influence" },
    ]} />
  ),
  "apple-india-interview-questions-2026||Apple India Salary and Benefits": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SWE ICT2 / Entry (0–2 yrs)", min: 30, max: 50, note: "RSUs on 4yr vest" },
      { role: "SWE ICT3 / Senior (3–6 yrs)", min: 50, max: 80 },
      { role: "SWE ICT4 / Staff (6–9 yrs)", min: 75, max: 120 },
      { role: "SWE ICT5+ / Principal (9+ yrs)", min: 110, max: 170 },
    ]} caption="Apple India GCC total compensation 2026 — stock is core; bonus ~10% base" />
  ),

  /* netflix-india-interview-questions-2026: Streaming giant */
  "netflix-india-interview-questions-2026||Netflix India Interview Process": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, role alignment, compensation conversation upfront" },
      { label: "Technical Phone Screen", duration: "60 min", detail: "DSA (Medium–Hard), streaming infra or backend systems" },
      { label: "Virtual Onsite — Coding ×2", duration: "60 min each", detail: "Hard-level problems, time complexity focus" },
      { label: "Virtual Onsite — System Design", duration: "60 min", detail: "Content delivery, encoding pipeline, recommendation infra at scale" },
      { label: "Culture (Netflix Memo) Round", duration: "45 min", detail: "Radical candor, high performance bar, context not control" },
    ]} />
  ),
  "netflix-india-interview-questions-2026||Netflix India Salary and Compensation Philosophy": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Software Engineer L4 (2–4 yrs)", min: 50, max: 80, note: "All cash — no RSUs" },
      { role: "Senior Software Engineer L5 (4–7 yrs)", min: 75, max: 120 },
      { role: "Staff Engineer L6 (7+ yrs)", min: 110, max: 180 },
      { role: "Principal Engineer L7 (10+ yrs)", min: 160, max: 250 },
    ]} caption="Netflix India 2026 — all salary, no equity; top-of-market cash philosophy" />
  ),

  /* barclays-india-interview-questions-2026: Capital markets tech */
  "barclays-india-interview-questions-2026||Barclays India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude, Java/C++ MCQs, DSA coding problem" },
      { label: "Technical Round 1 — Core CS", duration: "60 min", detail: "OOP, concurrency, database, algorithms" },
      { label: "Technical Round 2 — Domain", duration: "60 min", detail: "Capital markets: trade lifecycle, FX, fixed income basics" },
      { label: "HR / Values Round", duration: "30 min", detail: "Barclays values: respect, integrity, service, excellence" },
    ]} />
  ),
  "barclays-india-interview-questions-2026||Barclays India Salary and Career": (
    <SalaryLadder maxLPA={30} rows={[
      { role: "Analyst (0–2 yrs)", min: 8, max: 14, note: "Pune / Chennai GCC" },
      { role: "Associate (2–5 yrs)", min: 14, max: 22 },
      { role: "AVP (5–8 yrs)", min: 22, max: 35 },
      { role: "VP (8+ yrs)", min: 32, max: 55 },
    ]} caption="Barclays India GCC salary 2026 — bonus 10–30% of base; stable environment" />
  ),

  /* oyo-interview-questions-2026: Hospitality tech */
  "oyo-interview-questions-2026||OYO Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; graph, DP; backend-heavy" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithm depth, time complexity, backend patterns" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Hotel inventory management, dynamic pricing, booking engine" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Ownership, operating in adversity, hospitality domain awareness" },
    ]} />
  ),
  "oyo-interview-questions-2026||OYO Salary and Career in 2026": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22 },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 35 },
      { role: "Senior SDE (5+ yrs)", min: 32, max: 48 },
      { role: "Engineering Manager (6+ yrs)", min: 42, max: 62 },
    ]} caption="OYO salary India 2026 — restructured company, stronger engineering culture post-2024" />
  ),

  /* myntra-interview-questions-2026: Fashion e-commerce */
  "myntra-interview-questions-2026||Myntra Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems; arrays, graphs, DP" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithm depth, time/space complexity discussion" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Product recommendation engine, search ranking, supply chain" },
      { label: "Flipkart Bar-Raiser / Culture Round", duration: "45 min", detail: "Flipkart values, ownership, scale thinking" },
    ]} />
  ),
  "myntra-interview-questions-2026||Myntra Salary and Career Trajectory": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 30, note: "Flipkart group RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 44 },
      { role: "Senior SDE (5+ yrs)", min: 40, max: 58 },
      { role: "Engineering Manager (6+ yrs)", min: 50, max: 72 },
    ]} caption="Myntra salary India 2026 — Flipkart group pre-IPO RSUs add significant upside" />
  ),

  /* makemytrip-interview-questions-2026 (second post in Company Guides with this name) */
  "makemytrip-interview-questions-2026||MakeMyTrip Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Assessment", duration: "90 min", detail: "2–3 DSA problems; graphs, hashing, greedy" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithm deep dive, backend API patterns" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Flight/hotel search, GDS integration, dynamic pricing" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Ownership, travel domain awareness, cross-team collaboration" },
    ]} />
  ),
  "makemytrip-interview-questions-2026||MakeMyTrip Salary and Career": (
    <SalaryLadder maxLPA={38} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 16, max: 26 },
      { role: "SDE-2 (2–5 yrs)", min: 26, max: 38 },
      { role: "Senior SDE (5+ yrs)", min: 35, max: 52 },
      { role: "Engineering Manager (6+ yrs)", min: 45, max: 65 },
    ]} caption="MakeMyTrip salary India 2026 — Gurugram HQ; travel sector rebound post-2024" />
  ),

  /* nykaa-interview-questions-2026 (second post) */
  "nykaa-interview-questions-2026||Nykaa Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "75 min", detail: "2 DSA problems; Medium difficulty; Python/Java" },
      { label: "Technical Round 1 — DSA + Backend", duration: "60 min", detail: "Algorithms, REST API design, database schema" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "E-commerce catalogue, beauty product recommendation, inventory" },
      { label: "Culture / PM Round", duration: "30 min", detail: "Product thinking, fashion tech domain, growth mindset" },
    ]} />
  ),
  "nykaa-interview-questions-2026||Nykaa Salary and Career": (
    <SalaryLadder maxLPA={32} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Listed company RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 32 },
      { role: "Senior SDE (5+ yrs)", min: 30, max: 45 },
      { role: "Engineering Manager (6+ yrs)", min: 40, max: 58 },
    ]} caption="Nykaa salary India 2026 — listed company; RSUs in NSE-traded stock" />
  ),

  /* bcg-india-interview-questions-2026: MBB consulting */
  "bcg-india-interview-questions-2026||BCG India Interview Format and Structure": (
    <RoundFlow rounds={[
      { label: "Pymetrics / Online Assessment", duration: "25 min", detail: "Cognitive and personality game-based test" },
      { label: "Case Interview Round 1", duration: "45 min", detail: "Market sizing or profitability case; interviewer-led" },
      { label: "Case Interview Round 2", duration: "45 min", detail: "Operations or strategy case; more candidate-led" },
      { label: "PEI + Case Final Round", duration: "50 min", detail: "Personal experience + complex multi-framework case" },
      { label: "Partner Interview", duration: "45 min", detail: "Values, leadership, long-term vision, fit" },
    ]} />
  ),
  "bcg-india-interview-questions-2026||BCG India Salary and Career": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Associate (MBA / Fresher)", min: 22, max: 30, note: "Plus performance bonus" },
      { role: "Consultant (2–4 yrs post-MBA)", min: 32, max: 50 },
      { role: "Project Leader (4–7 yrs)", min: 50, max: 80 },
      { role: "Principal (7+ yrs)", min: 80, max: 130 },
    ]} caption="BCG India total compensation 2026 — bonus 20–40% of base; travel-heavy role" />
  ),

  /* bain-india-interview-questions-2026: MBB consulting */
  "bain-india-interview-questions-2026||Bain India Interview Format: What to Expect": (
    <RoundFlow rounds={[
      { label: "First Round Case ×2", duration: "45 min each", detail: "Market entry or revenue decline cases; Bain uses interviewer-led format" },
      { label: "Written Case", duration: "60 min", detail: "Analyse a client deck; prepare recommendation and present" },
      { label: "Final Round Case + PEI ×2", duration: "50 min each", detail: "Strategy case + STAR-based personal experience + partner fit" },
    ]} />
  ),
  "bain-india-interview-questions-2026||Bain India Salary and Career Path": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Associate Consultant (Fresher)", min: 18, max: 26, note: "Non-MBA track" },
      { role: "Consultant (Post-MBA / 3+ yrs)", min: 28, max: 48 },
      { role: "Case Team Leader (5–8 yrs)", min: 50, max: 80 },
      { role: "Manager / Principal (8+ yrs)", min: 80, max: 140 },
    ]} caption="Bain India salary 2026 — performance bonus 20–50%; 2-yr MBA sponsorship possible" />
  ),

  /* de-shaw-india-interview-questions-2026: Quant hedge fund */
  "de-shaw-india-interview-questions-2026||D.E. Shaw India Interview Process": (
    <RoundFlow rounds={[
      { label: "Codevita / Online Assessment", duration: "90 min", detail: "Math, algorithms, and probability questions — VERY hard" },
      { label: "Technical Interview 1 — Algorithms", duration: "60 min", detail: "C++ depth, STL, competitive-level DSA" },
      { label: "Technical Interview 2 — Quant Math", duration: "60 min", detail: "Probability, statistics, combinatorics, expected value" },
      { label: "Technical Interview 3 — Systems", duration: "60 min", detail: "Low-latency systems, memory management, network protocols" },
      { label: "HR / Culture Round", duration: "30 min", detail: "Research mindset, intellectual curiosity, team fit" },
    ]} />
  ),
  "de-shaw-india-interview-questions-2026||D.E. Shaw India Salary and Compensation": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Software Developer (Entry)", min: 25, max: 45, note: "Bonus dominates" },
      { role: "Quant Researcher (Entry)", min: 30, max: 55 },
      { role: "Senior Software Developer", min: 50, max: 85 },
      { role: "Senior Quant Researcher", min: 75, max: 150 },
    ]} caption="D.E. Shaw India 2026 — year-end bonus multiples of 1–3x base are common" />
  ),

  /* citadel-india-interview-questions-2026: HFT */
  "citadel-india-interview-questions-2026||Citadel India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Hard algorithmic coding; C++ preferred" },
      { label: "Technical Round 1 — C++ and OS", duration: "60 min", detail: "Memory management, concurrency, cache behaviour" },
      { label: "Technical Round 2 — Quant Concepts", duration: "60 min", detail: "Probability, statistics, market intuition, brain teasers" },
      { label: "System Design Round", duration: "60 min", detail: "Ultra-low-latency trading systems, lock-free data structures" },
      { label: "HR / Culture Round", duration: "30 min", detail: "Intellectual rigor, performance mindset, team fit" },
    ]} />
  ),
  "citadel-india-interview-questions-2026||Citadel India Salary and Compensation": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Software Engineer (Entry)", min: 35, max: 60, note: "Cash heavy; year-end bonus" },
      { role: "Quant Researcher (Entry)", min: 40, max: 80 },
      { role: "Senior Software Engineer", min: 70, max: 120 },
      { role: "Quant Portfolio Researcher", min: 100, max: 250 },
    ]} caption="Citadel India 2026 — base + discretionary bonus; PnL-linked rewards at senior levels" />
  ),

  /* angel-one-interview-questions-2026: Indian fintech broking */
  "angel-one-interview-questions-2026||Angel One Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "75 min", detail: "2 DSA problems; Medium difficulty; Python/Java" },
      { label: "Technical Round 1 — DSA + Backend", duration: "60 min", detail: "Algorithms, API design, SQL, trading domain basics" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Order matching engine, portfolio analytics, real-time market data" },
      { label: "Leadership / Culture Round", duration: "30 min", detail: "Ownership, fintech domain, customer-first thinking" },
    ]} />
  ),
  "angel-one-interview-questions-2026||Angel One Salary and Career": (
    <SalaryLadder maxLPA={28} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Listed company RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 30 },
      { role: "Senior SDE (5+ yrs)", min: 28, max: 42 },
      { role: "Tech Lead / Engineering Manager (6+ yrs)", min: 38, max: 58 },
    ]} caption="Angel One salary India 2026 — BSE/NSE-listed RSUs; strong fintech domain exposure" />
  ),

  /* atlassian-india-interview-questions-2026 (first occurrence, index 84) */
  "atlassian-india-interview-questions-2026||Atlassian India Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Karat Screen", duration: "60 min", detail: "2 DSA problems via Karat interviewer; Medium difficulty" },
      { label: "Technical Round — Coding", duration: "60 min", detail: "Data structures, system thinking, code quality emphasis" },
      { label: "System Design Round", duration: "60 min", detail: "Jira / Confluence-style product design, multi-tenant SaaS" },
      { label: "TEAM Values Round", duration: "45 min", detail: "Open company, no bull, play as a team, build balance" },
      { label: "Hiring Manager Round", duration: "30 min", detail: "Role alignment, team fit, long-term goals" },
    ]} />
  ),
  "atlassian-india-interview-questions-2026||Atlassian India Salary and TEAM Anywhere": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 25, max: 38, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 38, max: 55 },
      { role: "Senior SDE (5+ yrs)", min: 52, max: 75 },
      { role: "Staff Engineer / EM (7+ yrs)", min: 70, max: 100 },
    ]} caption="Atlassian India salary 2026 — TEAM Anywhere = fully remote; RSUs in USD" />
  ),

  /* uber-india-interview-questions-2026 (first occurrence, index 85) */
  "uber-india-interview-questions-2026||Uber India's Interview Process: What to Expect": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, role fit, timeline" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems; Medium–Hard; graphs and hashing common" },
      { label: "Technical Round — Coding ×2", duration: "60 min each", detail: "Algorithms, concurrency, platform-specific patterns" },
      { label: "Technical Round — System Design", duration: "60 min", detail: "Ride-matching, geospatial indexing, surge pricing system" },
      { label: "Behavioral / Culture Round", duration: "45 min", detail: "Uber's norms: customer obsession, bold bets, reliability" },
    ]} />
  ),
  "uber-india-interview-questions-2026||Uber India Salary and Culture": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 28, max: 42, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 40, max: 60 },
      { role: "Senior SDE (5+ yrs)", min: 58, max: 85 },
      { role: "Staff Engineer / EM (7+ yrs)", min: 78, max: 115 },
    ]} caption="Uber India total compensation 2026 — Bengaluru GCC; strong growth culture" />
  ),

  /* linkedin-india-interview-questions-2026: Social/professional network */
  "linkedin-india-interview-questions-2026||LinkedIn India Interview Process": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, role fit, LinkedIn motivation" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems; Medium difficulty via CoderPad" },
      { label: "Technical Round — Coding ×2", duration: "60 min each", detail: "Algorithms, object-oriented design, code quality" },
      { label: "System Design Round", duration: "60 min", detail: "News feed, social graph, job recommendation system design" },
      { label: "Behavioral / Values Round", duration: "45 min", detail: "LinkedIn values: transformation, integrity, collaboration, humor" },
    ]} />
  ),
  "linkedin-india-interview-questions-2026||LinkedIn India Salary and Work Culture": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 / E4 (0–2 yrs)", min: 28, max: 42, note: "Microsoft RSUs" },
      { role: "SDE-2 / E5 (2–5 yrs)", min: 40, max: 62 },
      { role: "Senior SDE / E6 (5–8 yrs)", min: 58, max: 90 },
      { role: "Staff Engineer / E7 (8+ yrs)", min: 82, max: 130 },
    ]} caption="LinkedIn India salary 2026 — Microsoft RSUs (MSFT stock); Bengaluru office" />
  ),

  /* salesforce-india-interview-questions-2026: CRM cloud */
  "salesforce-india-interview-questions-2026||Salesforce India Interview Process": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, Salesforce ecosystem awareness, timeline" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems; Java preferred; Medium difficulty" },
      { label: "Technical Round — Coding + OOP", duration: "60 min", detail: "Java, OOP design, REST API patterns, multithreading" },
      { label: "System Design Round", duration: "60 min", detail: "CRM systems, multi-tenant SaaS design, event-driven architecture" },
      { label: "Behavioral / Ohana Culture Round", duration: "45 min", detail: "Salesforce values: trust, customer success, innovation, equality" },
    ]} />
  ),
  "salesforce-india-interview-questions-2026||Salesforce India Salary and Benefits": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "MTS (Member of Technical Staff) 1", min: 25, max: 40, note: "RSUs + VTO" },
      { role: "MTS 2 (2–5 yrs)", min: 38, max: 58 },
      { role: "Senior MTS (5–8 yrs)", min: 55, max: 82 },
      { role: "Principal MTS / EM (8+ yrs)", min: 78, max: 115 },
    ]} caption="Salesforce India salary 2026 — RSUs vest quarterly; Hyderabad + Bengaluru offices" />
  ),

  /* goldman-sachs-india-interview-questions-2026: Investment bank tech */
  "goldman-sachs-india-interview-questions-2026||Goldman Sachs India Interview Process": (
    <RoundFlow rounds={[
      { label: "HireVue Video Interview", duration: "30 min", detail: "Pre-recorded; motivation, problem-solving scenario, background" },
      { label: "Coding Round", duration: "60 min", detail: "3–4 Medium problems; Java/C++ preferred; CS fundamentals heavy" },
      { label: "Technical Interview 1 — Algorithms + OS", duration: "60 min", detail: "Data structures, OS concepts, networking, databases" },
      { label: "Technical Interview 2 — Design", duration: "60 min", detail: "Trading system design, low-latency patterns, data pipelines" },
      { label: "HR / Divisional Interview", duration: "30 min", detail: "GS values, division fit, motivation for finance tech" },
    ]} />
  ),
  "goldman-sachs-india-interview-questions-2026||Goldman Sachs India Salary and Career Path": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Analyst (Fresher / New Grad)", min: 18, max: 28, note: "Plus end-of-year bonus" },
      { role: "Associate (2–4 yrs)", min: 28, max: 45 },
      { role: "Vice President (5–8 yrs)", min: 45, max: 75 },
      { role: "Executive Director (8+ yrs)", min: 70, max: 120 },
    ]} caption="Goldman Sachs India 2026 — bonus 20–100% of base; Bengaluru + Hyderabad centres" />
  ),

  /* jpmorgan-india-interview-questions-2026: Banking tech */
  "jpmorgan-india-interview-questions-2026||JPMorgan India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude + 2 coding problems (Medium); Java/Python/C++" },
      { label: "Technical Round 1 — Algorithms", duration: "60 min", detail: "DSA, OOP, databases, REST APIs" },
      { label: "Technical Round 2 — Domain + Design", duration: "60 min", detail: "Financial systems, risk engine design, trading platform concepts" },
      { label: "HR / Business Principles Round", duration: "30 min", detail: "JPMC principles: client focus, excellence, integrity" },
    ]} />
  ),
  "jpmorgan-india-interview-questions-2026||JPMorgan India Salary and Career Path": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "Software Engineer Analyst (Fresher)", min: 12, max: 20, note: "Pune / Mumbai / Bengaluru" },
      { role: "Software Engineer Associate (2–4 yrs)", min: 20, max: 32 },
      { role: "Associate (Vice President track, 4–7 yrs)", min: 30, max: 48 },
      { role: "Vice President (7+ yrs)", min: 45, max: 75 },
    ]} caption="JPMorgan Chase India 2026 — cash bonus 10–30% of base; strong GCC scale" />
  ),

  /* adobe-india-interview-questions-2026: Creative cloud */
  "adobe-india-interview-questions-2026||Adobe India Interview Process: All Five Rounds Explained": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems; Medium–Hard; C++/Java preferred" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithms, data structures, time/space complexity depth" },
      { label: "Technical Round 2 — OOP + LLD", duration: "60 min", detail: "Low-level design: design a parking lot, LRU cache, chess game" },
      { label: "Technical Round 3 — System Design", duration: "60 min", detail: "HLD: image processing pipeline, creative cloud sync, CDN" },
      { label: "HR / Hiring Manager Round", duration: "30 min", detail: "Adobe values, cross-functional influence, career goals" },
    ]} />
  ),
  "adobe-india-interview-questions-2026||Adobe India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "MTS 1 / SDE-1 (0–2 yrs)", min: 22, max: 35, note: "RSUs on 4yr vest" },
      { role: "MTS 2 / SDE-2 (2–5 yrs)", min: 35, max: 52 },
      { role: "Senior MTS (5–8 yrs)", min: 50, max: 75 },
      { role: "Principal MTS / EM (8+ yrs)", min: 70, max: 105 },
    ]} caption="Adobe India salary 2026 — RSUs vest quarterly; Noida + Bengaluru offices" />
  ),

  /* cisco-india-interview-questions-2026: Networking giant */
  "cisco-india-interview-questions-2026||Cisco India Interview Process: Five Rounds with Networking Focus": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude + networking MCQs + 1 coding problem" },
      { label: "Technical Round 1 — CS Fundamentals", duration: "60 min", detail: "OOP, OS, networking basics, one algorithm problem" },
      { label: "Technical Round 2 — Networking Depth", duration: "60 min", detail: "BGP, OSPF, TCP/IP stack, VLAN, SD-WAN concepts" },
      { label: "Technical Round 3 — Design / Coding", duration: "60 min", detail: "Network protocol implementation, socket programming, system design" },
      { label: "HR / Hiring Manager Round", duration: "30 min", detail: "Cisco values, team fit, long-term vision" },
    ]} />
  ),
  "cisco-india-interview-questions-2026||Cisco India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 18, max: 28, note: "RSUs on 4yr vest" },
      { role: "Senior Software Engineer (2–5 yrs)", min: 28, max: 42 },
      { role: "Staff Engineer (5–8 yrs)", min: 40, max: 58 },
      { role: "Principal Engineer / EM (8+ yrs)", min: 55, max: 85 },
    ]} caption="Cisco India salary 2026 — Bengaluru + Chennai offices; strong networking domain" />
  ),

  /* oracle-india-interview-questions-2026: Database and cloud */
  "oracle-india-interview-questions-2026||Oracle India Interview Process: Five Rounds with Database and Java Focus": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems + Java MCQs; database SQL section" },
      { label: "Technical Round 1 — Java Depth", duration: "60 min", detail: "Java core, JVM internals, concurrency, collections" },
      { label: "Technical Round 2 — Database", duration: "60 min", detail: "Oracle SQL, PL/SQL, query optimisation, indexing, RAC" },
      { label: "Technical Round 3 — System Design", duration: "60 min", detail: "Distributed database design, OCI architecture, microservices" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Oracle culture, product pride, career growth path" },
    ]} />
  ),
  "oracle-india-interview-questions-2026||Oracle India Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 20, max: 32, note: "RSUs on 4yr vest" },
      { role: "Senior Software Engineer (2–5 yrs)", min: 30, max: 48 },
      { role: "Staff Engineer (5–8 yrs)", min: 45, max: 65 },
      { role: "Principal Engineer / EM (8+ yrs)", min: 60, max: 95 },
    ]} caption="Oracle India salary 2026 — Bengaluru + Hyderabad + Pune offices; OCI growth role" />
  ),

  /* thoughtworks-india-interview-questions-2026: Consultancy / craft */
  "thoughtworks-india-interview-questions-2026||ThoughtWorks India Interview: Four Stages Unlike Anywhere Else": (
    <RoundFlow rounds={[
      { label: "Technical Aptitude Test (TAT)", duration: "90 min", detail: "Analytical puzzles, basic coding, logical reasoning" },
      { label: "Coding and Pairing Round", duration: "90 min", detail: "TDD exercise in your language; code quality and XP practices matter" },
      { label: "Technical Interview — Design + Case", duration: "60 min", detail: "OOP design, system architecture, consulting scenario" },
      { label: "Culture / Values Interview", duration: "60 min", detail: "Social justice awareness, XP/agile conviction, collaboration style" },
    ]} />
  ),
  "thoughtworks-india-interview-questions-2026||ThoughtWorks India Salary: The Deliberate Trade-off": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Graduate Consultant (Fresher)", min: 8, max: 12, note: "Below market; craft in return" },
      { role: "Application Developer (1–3 yrs)", min: 12, max: 20 },
      { role: "Senior Consultant (3–6 yrs)", min: 18, max: 30 },
      { role: "Principal Consultant (6+ yrs)", min: 28, max: 45 },
    ]} caption="ThoughtWorks India salary 2026 — 20–30% below market; strong craft brand offset" />
  ),

  /* sap-labs-india-interview-questions-2026: SAP enterprise software */
  "sap-labs-india-interview-questions-2026||SAP Labs India Interview Process: Structure and What Each Round Tests": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude + ABAP/Java/Python MCQs + 1 coding problem" },
      { label: "Technical Round 1 — Algorithms + CS", duration: "60 min", detail: "DSA, OOP, database design, REST APIs" },
      { label: "Technical Round 2 — SAP Domain", duration: "60 min", detail: "SAP HANA, S/4HANA, BTP, ABAP (for product roles); architecture" },
      { label: "Hiring Manager / Design Round", duration: "60 min", detail: "Product architecture, enterprise SaaS design, cross-team scope" },
      { label: "HR Round", duration: "20 min", detail: "SAP values, Bengaluru / Pune preference, career goals" },
    ]} />
  ),
  "sap-labs-india-interview-questions-2026||SAP Labs India Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Developer Associate (0–2 yrs)", min: 15, max: 25, note: "RSUs on 4yr vest" },
      { role: "Developer (2–5 yrs)", min: 24, max: 40 },
      { role: "Senior Developer (5–8 yrs)", min: 38, max: 55 },
      { role: "Principal Developer / Architect (8+ yrs)", min: 52, max: 80 },
    ]} caption="SAP Labs India salary 2026 — Bengaluru HQ; strong enterprise product ownership" />
  ),

  /* atlassian-india-interview-questions-2026 (second occurrence, index 95) — duplicate slug, use same key approach */
  /* Note: both posts share the same slug; using the unique heading text as differentiator */
  "atlassian-india-interview-questions-2026||Atlassian India Interview Process: The Karat Screen and TEAM Values Round": (
    <RoundFlow rounds={[
      { label: "Karat Technical Screen", duration: "60 min", detail: "2 DSA problems with Karat interviewer; code quality judged" },
      { label: "Coding Round (Internal)", duration: "60 min", detail: "Data structures, clean code, edge cases" },
      { label: "System Design Round", duration: "60 min", detail: "Jira/Confluence-scale multi-tenant platform, distributed systems" },
      { label: "TEAM Values Round", duration: "45 min", detail: "Open company, no bull, play as a team, build balance" },
      { label: "Hiring Manager Round", duration: "30 min", detail: "Product domain, TEAM Anywhere culture, long-term growth" },
    ]} />
  ),
  "atlassian-india-interview-questions-2026||Atlassian's TEAM Values: What the Values Round Actually Tests": (
    <FrameworkSteps steps={[
      { number: "T", label: "Open company, no bull", hint: "Radical transparency — share information broadly, question decisions respectfully" },
      { number: "E", label: "Build with heart and balance", hint: "Sustainable pace, genuine care for people, avoid burnout" },
      { number: "A", label: "Play as a team", hint: "Diverse inclusion, collaborate across time zones, TEAM Anywhere ethos" },
      { number: "M", label: "Don't #@!% the customer", hint: "Customer obsession — quality that respects users' trust" },
    ]} />
  ),

  /* paypal-india-interview-questions-2026: Payments product */
  "paypal-india-interview-questions-2026||PayPal India Interview Process: Payments-Specific System Design": (
    <RoundFlow rounds={[
      { label: "Online Coding Assessment", duration: "90 min", detail: "2–3 DSA problems; Java/Python; payments domain MCQs" },
      { label: "Technical Round 1 — Algorithms + CS", duration: "60 min", detail: "DSA, concurrency, REST APIs, database design" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Payments processing, fraud detection, idempotency in financial APIs" },
      { label: "Hiring Manager / Behavioural Round", duration: "45 min", detail: "PayPal mission, global financial inclusion, ownership" },
    ]} />
  ),
  "paypal-india-interview-questions-2026||PayPal India Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "RSUs on 3yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 52 },
      { role: "Senior SDE (5–8 yrs)", min: 50, max: 72 },
      { role: "Staff SDE / EM (8+ yrs)", min: 68, max: 100 },
    ]} caption="PayPal India salary 2026 — Chennai + Bengaluru offices; full product ownership" />
  ),

  /* walmart-global-tech-india-interview-questions-2026: Retail tech */
  "walmart-global-tech-india-interview-questions-2026||Walmart Global Tech India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Coding Assessment", duration: "90 min", detail: "2–3 DSA problems; Java preferred; supply chain domain basics" },
      { label: "Technical Round 1 — Algorithms", duration: "60 min", detail: "DSA, OOP, concurrency, REST API design" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "E-commerce search, inventory management, fulfillment routing" },
      { label: "Behavioral / Culture Round", duration: "45 min", detail: "Walmart values: service, excellence, respect, integrity" },
    ]} />
  ),
  "walmart-global-tech-india-interview-questions-2026||Walmart Global Tech India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 52 },
      { role: "Senior SDE (5–8 yrs)", min: 48, max: 70 },
      { role: "Staff SDE / EM (8+ yrs)", min: 65, max: 95 },
    ]} caption="Walmart Global Tech India 2026 — Bengaluru office; strong retail domain product ownership" />
  ),

  /* qualcomm-india-interview-questions-2026 (second occurrence, index 98) */
  "qualcomm-india-interview-questions-2026||Qualcomm India Interview Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "Technical Phone Screen", duration: "60 min", detail: "C++ coding, embedded systems basics, OS concepts" },
      { label: "Technical Round 1 — C++ and OS", duration: "60 min", detail: "Memory management, threading, RTOS concepts, driver stack" },
      { label: "Technical Round 2 — Domain Depth", duration: "60 min", detail: "5G/LTE modem stack, DSP, QDSP6 processor architecture" },
      { label: "System Design Round", duration: "60 min", detail: "Firmware architecture, baseband system design" },
      { label: "HR Round", duration: "20 min", detail: "Qualcomm values, team fit, long-term goals" },
    ]} />
  ),
  "qualcomm-india-interview-questions-2026||Qualcomm India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Engineer (0–2 yrs)", min: 18, max: 30, note: "Hyderabad / Bengaluru office" },
      { role: "Senior Engineer (2–5 yrs)", min: 28, max: 44 },
      { role: "Staff Engineer (5–8 yrs)", min: 42, max: 62 },
      { role: "Principal Engineer (8+ yrs)", min: 58, max: 92 },
    ]} caption="Qualcomm India salary 2026 — RSUs on 3yr vest; semiconductor domain premium" />
  ),

  /* vmware-india-interview-questions-2026: Virtualisation / Broadcom */
  "vmware-india-interview-questions-2026||VMware India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "C / C++ / Java MCQs + OS concepts + 1 coding problem" },
      { label: "Technical Round 1 — CS Fundamentals", duration: "60 min", detail: "OS internals, virtualisation basics, networking, DSA" },
      { label: "Technical Round 2 — Virtualisation Depth", duration: "60 min", detail: "Hypervisor design, VMware vSphere, storage virtualisation, Kubernetes" },
      { label: "System Design Round", duration: "60 min", detail: "Distributed infrastructure design, container orchestration" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Broadcom-VMware transition awareness, team fit, growth mindset" },
    ]} />
  ),
  "vmware-india-interview-questions-2026||VMware India Salary Benchmarks 2026 (Post-Broadcom)": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 18, max: 28, note: "Broadcom RSUs now" },
      { role: "Senior Software Engineer (2–5 yrs)", min: 28, max: 42 },
      { role: "Staff Engineer (5–8 yrs)", min: 40, max: 58 },
      { role: "Principal Engineer (8+ yrs)", min: 55, max: 82 },
    ]} caption="VMware India salary 2026 — post-Broadcom acquisition; Pune + Bengaluru offices" />
  ),

  /* uber-india-interview-questions-2026 (second occurrence, index 100) */
  "uber-india-interview-questions-2026||Geospatial System Design: Uber's Distinctive Interview Topic": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify geo requirements", hint: "Scale (city / country / global), accuracy needs, update frequency" },
      { number: "02", label: "Geospatial indexing", hint: "Geohash or H3 hex grid to partition the map into searchable cells" },
      { number: "03", label: "Real-time driver location updates", hint: "WebSocket fanout, Kafka for location event streaming" },
      { number: "04", label: "Matching algorithm", hint: "Nearest driver in geohash cell, supply-demand rebalancing" },
      { number: "05", label: "ETA and routing", hint: "Pre-computed road graph, traffic-weighted Dijkstra, frequent recompute" },
      { number: "06", label: "Surge pricing engine", hint: "Supply/demand ratio per geohash cell, configurable multipliers" },
    ]} />
  ),
  "uber-india-interview-questions-2026||Uber India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 28, max: 44, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 42, max: 62 },
      { role: "Senior SDE (5–8 yrs)", min: 60, max: 88 },
      { role: "Staff Engineer / EM (8+ yrs)", min: 82, max: 120 },
    ]} caption="Uber India total compensation 2026 — Bengaluru GCC; strong systems scale culture" />
  ),

  /* airbnb-india-interview-questions-2026: Travel tech */
  "airbnb-india-interview-questions-2026||Airbnb India Interview Process: The Life Story Round": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, motivation, timeline" },
      { label: "Technical Phone Screen", duration: "60 min", detail: "2 DSA problems; Medium–Hard; Python or Java" },
      { label: "Coding Round ×2 (Onsite)", duration: "60 min each", detail: "Hard-level problems, clean code, test cases" },
      { label: "System Design Round", duration: "60 min", detail: "Search and discovery, pricing system, host-guest matching" },
      { label: "Life Story Round", duration: "45 min", detail: "Walk through your life; values alignment with Airbnb mission" },
    ]} />
  ),
  "airbnb-india-interview-questions-2026||Airbnb India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SWE L3 (0–2 yrs)", min: 35, max: 55, note: "RSUs on 4yr vest" },
      { role: "SWE L4 (2–5 yrs)", min: 52, max: 78 },
      { role: "Senior SWE L5 (5–8 yrs)", min: 72, max: 108 },
      { role: "Staff SWE L6 (8+ yrs)", min: 100, max: 150 },
    ]} caption="Airbnb India GCC salary 2026 — Bengaluru office; RSUs in USD; travel perks" />
  ),

  /* stripe-india-interview-questions-2026: Fintech infra */
  "stripe-india-interview-questions-2026||Stripe India Interview: Debugging and Code Review Rounds": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, Stripe motivation, compensation alignment" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems via CoderPad; Python/Ruby/Go" },
      { label: "Technical Round — Bug Fix / Code Review", duration: "60 min", detail: "Stripe-specific: review a buggy codebase, find and fix issues" },
      { label: "System Design Round", duration: "60 min", detail: "Payment processing reliability, idempotency, webhook delivery" },
      { label: "Behavioral / Mission Round", duration: "45 min", detail: "Stripe mission: increase GDP of the internet; ownership at scale" },
    ]} />
  ),
  "stripe-india-interview-questions-2026||Stripe India Salary and Equity 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "L3 Software Engineer (0–2 yrs)", min: 35, max: 55, note: "Pre-IPO equity + cash" },
      { role: "L4 Software Engineer (2–5 yrs)", min: 52, max: 80 },
      { role: "L5 Senior Engineer (5–8 yrs)", min: 75, max: 110 },
      { role: "L6 Staff Engineer (8+ yrs)", min: 100, max: 155 },
    ]} caption="Stripe India 2026 — Bengaluru office; pre-IPO equity; above-market cash comp" />
  ),

  /* ── Technical ── */
  /* tell-me-about-yourself-best-answer: Formula framework for structuring answers */
  "tell-me-about-yourself-best-answer||The 3-Sentence Formula": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present", hint: "Your current role, tech stack, and a key achievement in one sentence" },
      { number: "02", label: "Past", hint: "One prior experience or project that led you here" },
      { number: "03", label: "Future", hint: "Why this role and company align with your next goal" },
    ]} />
  ),

  /* software-engineer-interview-checklist-2026: Day-by-day countdown checklist */
  "software-engineer-interview-checklist-2026||48 Hours Before: Technical Review": (
    <PrepTimeline caption="Interview countdown plan" phases={[
      { period: "48 hrs out", label: "Technical Review", tasks: ["Revise DSA patterns used at target company tier", "Skim your resume projects end-to-end", "Re-read 2–3 system design concepts"], milestone: "Tech knowledge refreshed" },
      { period: "24 hrs out", label: "Behavioral & Research", tasks: ["Prepare 5 STAR stories", "Research company's recent news, tech blog", "Write down 3 smart questions to ask"], milestone: "Stories and context ready" },
      { period: "Day of", label: "Logistics & Mindset", tasks: ["Test video/audio setup 30 min early", "Eat a proper meal, hydrate", "Arrive / join 5 min before start"] },
      { period: "In interview", label: "5-Point Framework", tasks: ["Clarify requirements before coding", "Think aloud", "Handle edge cases", "Test with examples", "Ask follow-up questions"] },
    ]} />
  ),

  /* java-interview-questions-freshers-india-2026: Study roadmap for Java freshers */
  "java-interview-questions-freshers-india-2026||Java 8+ Features: Modern Fresher Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Lambda & Streams", hint: "Filter, map, collect — asked at virtually every Java fresher interview" },
      { number: "02", label: "Optional", hint: "Null-safety idioms; differentiate from null checks" },
      { number: "03", label: "Default & Static Methods in Interfaces", hint: "Why they exist and backward compatibility" },
      { number: "04", label: "Date/Time API", hint: "LocalDate, LocalDateTime vs old java.util.Date" },
      { number: "05", label: "Functional Interfaces", hint: "Predicate, Function, Consumer, Supplier — know all four" },
    ]} />
  ),

  /* python-interview-questions-freshers-india-2026: Python prep approach */
  "python-interview-questions-freshers-india-2026||Python in DSA Coding Rounds": (
    <FrameworkSteps steps={[
      { number: "01", label: "Know built-ins cold", hint: "sorted(), enumerate(), zip(), collections.defaultdict, heapq" },
      { number: "02", label: "List comprehensions", hint: "Interviewers expect Pythonic one-liners; avoid verbose loops where possible" },
      { number: "03", label: "String methods", hint: "split, join, strip, startswith — common in array/string problems" },
      { number: "04", label: "Complexity awareness", hint: "Know that dict/set ops are O(1); list.insert is O(n)" },
    ]} />
  ),

  /* sql-interview-questions-freshers-india-2026: SQL topic prep ladder */
  "sql-interview-questions-freshers-india-2026||Window Functions: The Advanced Level": (
    <FrameworkSteps steps={[
      { number: "01", label: "ROW_NUMBER()", hint: "Deduplicate rows, rank within a partition" },
      { number: "02", label: "RANK() / DENSE_RANK()", hint: "Difference matters — gaps vs no-gaps in ties" },
      { number: "03", label: "LAG() / LEAD()", hint: "Compare a row to its predecessor/successor — classic interview problem" },
      { number: "04", label: "SUM() OVER / AVG() OVER", hint: "Running totals and moving averages without GROUP BY" },
      { number: "05", label: "PARTITION BY vs ORDER BY", hint: "Explain how they divide and order rows within a window" },
    ]} />
  ),

  /* cpp-interview-questions-freshers-india-2026: C++ study approach */
  "cpp-interview-questions-freshers-india-2026||STL: Standard Template Library": (
    <FrameworkSteps steps={[
      { number: "01", label: "vector", hint: "Dynamic array; know push_back, resize, reserve, iterator invalidation" },
      { number: "02", label: "map / unordered_map", hint: "Ordered vs hash — know time complexity of each" },
      { number: "03", label: "set / multiset", hint: "Unique sorted elements; use for range queries" },
      { number: "04", label: "stack / queue / priority_queue", hint: "Know which problems map to each container" },
      { number: "05", label: "Algorithms", hint: "sort, binary_search, lower_bound, upper_bound — memorise signatures" },
    ]} />
  ),

  /* javascript-interview-questions-india-2026: JS interview key framework */
  "javascript-interview-questions-india-2026||Event Loop, Async, and Promises": (
    <FrameworkSteps steps={[
      { number: "01", label: "Call Stack", hint: "Synchronous execution — LIFO; understand how frames push and pop" },
      { number: "02", label: "Web APIs / Node APIs", hint: "setTimeout, fetch — offloaded here, not in the JS thread" },
      { number: "03", label: "Callback / Task Queue", hint: "Macrotasks: setTimeout callbacks land here" },
      { number: "04", label: "Microtask Queue", hint: "Promise .then() runs before the next macrotask — higher priority" },
      { number: "05", label: "Event Loop", hint: "Picks from microtask queue first, then task queue, repeat" },
    ]} />
  ),

  /* system-design-interview-questions-india-2026: SD answer framework */
  "system-design-interview-questions-india-2026||How to Structure Every System Design Answer (The Framework)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify Requirements", hint: "Functional vs non-functional; ask about scale, latency, consistency needs" },
      { number: "02", label: "Estimate Scale", hint: "DAU, QPS, storage; back-of-envelope in 2 minutes" },
      { number: "03", label: "High-Level Design", hint: "Draw boxes: clients, load balancer, API servers, DB, cache" },
      { number: "04", label: "Deep-Dive Components", hint: "Pick 2–3 critical components; discuss trade-offs in depth" },
      { number: "05", label: "Handle Bottlenecks", hint: "Caching, sharding, async queues, CDN — show you think at scale" },
      { number: "06", label: "Wrap Up", hint: "Summarise design, mention what you'd do differently with more time" },
    ]} />
  ),

  /* dsa-interview-preparation-guide-india-2026: 12-week DSA study plan */
  "dsa-interview-preparation-guide-india-2026||12-Week DSA Study Plan for Product Company Readiness": (
    <PrepTimeline caption="12-week DSA plan for Indian product company interviews" phases={[
      { period: "Weeks 1–2", label: "Arrays & Strings", tasks: ["Two pointers", "Sliding window", "Prefix sum", "String manipulation"], milestone: "20 easy problems done" },
      { period: "Weeks 3–4", label: "Hashing & Sorting", tasks: ["HashMap patterns", "Counting frequencies", "Merge sort / quick sort logic", "Top-K problems"], milestone: "50 problems done" },
      { period: "Weeks 5–6", label: "Trees & Graphs", tasks: ["BFS, DFS", "Binary search tree operations", "Graph traversal and cycle detection"], milestone: "Tree & graph patterns solid" },
      { period: "Weeks 7–8", label: "Dynamic Programming", tasks: ["1D DP (climbing stairs, house robber)", "2D DP (grid problems)", "LCS, LIS patterns"], milestone: "Core DP patterns memorised" },
      { period: "Weeks 9–10", label: "Heaps & Backtracking", tasks: ["Priority queue problems", "Top-K elements", "Permutations and subsets"], milestone: "80 medium problems done" },
      { period: "Weeks 11–12", label: "Mock & Consolidate", tasks: ["Company-tagged LeetCode sets", "2 timed mock interviews per week", "Review weak areas"], milestone: "Interview-ready" },
    ]} />
  ),

  /* data-analyst-interview-questions-india-2026: framework for BA/DA interviews */
  "data-analyst-interview-questions-india-2026||Business Case Questions: A Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the Goal", hint: "What metric are we trying to move? Revenue, retention, activation?" },
      { number: "02", label: "Define the Metric", hint: "Propose a north star metric and 2–3 supporting metrics" },
      { number: "03", label: "Diagnose the Problem", hint: "Funnel breakdown, segment analysis, time-based trends" },
      { number: "04", label: "Hypothesise Root Cause", hint: "Data, product, or external cause? State assumptions clearly" },
      { number: "05", label: "Recommend Action", hint: "Experiment vs immediate fix vs further investigation" },
    ]} />
  ),

  /* product-manager-interview-guide-india-startups: PM interview 5 dimensions */
  "product-manager-interview-guide-india-startups||The Five PM Interview Dimensions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Product Sense", hint: "Design a product or feature; use user-first thinking with trade-offs" },
      { number: "02", label: "Metrics", hint: "Define success metrics, diagnose drops, propose experiments" },
      { number: "03", label: "Execution", hint: "Prioritisation frameworks (RICE, ICE), roadmap thinking" },
      { number: "04", label: "Technical Fluency", hint: "Explain APIs, databases, system constraints to your team" },
      { number: "05", label: "Behavioural / Leadership", hint: "STAR stories: influence without authority, cross-functional alignment" },
    ]} />
  ),

  /* system-design-interview-for-freshers-india: fresher SD framework */
  "system-design-interview-for-freshers-india||A Framework to Structure Any Design Answer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Requirements", hint: "Ask: who are the users, what are the core features, scale estimate?" },
      { number: "02", label: "API Design", hint: "Define endpoints or function signatures before drawing boxes" },
      { number: "03", label: "Data Model", hint: "What tables or collections, key fields, relationships" },
      { number: "04", label: "High-Level Architecture", hint: "Client → Server → DB; add cache and queue if relevant" },
      { number: "05", label: "Trade-off Discussion", hint: "SQL vs NoSQL, monolith vs services — state your reasoning" },
    ]} />
  ),

  /* react-developer-interview-questions-india-2026: React hooks depth */
  "react-developer-interview-questions-india-2026||Core Hooks: The Most-Tested Area": (
    <FrameworkSteps steps={[
      { number: "01", label: "useState", hint: "State batching in React 18, functional updates, lazy initialiser" },
      { number: "02", label: "useEffect", hint: "Dependency array rules, cleanup, comparing to componentDidMount" },
      { number: "03", label: "useCallback / useMemo", hint: "When they help (stable references) vs when they add cost" },
      { number: "04", label: "useRef", hint: "Persisting values without re-render, DOM access" },
      { number: "05", label: "Custom Hooks", hint: "Extract shared stateful logic; demonstrate with a useFetch example" },
    ]} />
  ),

  /* business-analyst-interview-questions-india-2026: BA skill breakdown */
  "business-analyst-interview-questions-india-2026||What Indian BA Interviews Test": (
    <FrameworkSteps steps={[
      { number: "01", label: "Requirements Elicitation", hint: "User stories, use cases, acceptance criteria — know the formats" },
      { number: "02", label: "Process Mapping", hint: "As-Is vs To-Be; BPMN or flowchart; gap analysis" },
      { number: "03", label: "SQL / Data Analysis", hint: "Basic JOINs, GROUP BY, aggregations — always tested" },
      { number: "04", label: "Stakeholder Management", hint: "STAR stories: aligning conflicting stakeholders, managing expectations" },
      { number: "05", label: "Domain Knowledge", hint: "Banking: SWIFT, IBAN, KYC; E-commerce: catalogues, orders, returns" },
    ]} />
  ),

  /* salesforce-interview-questions-india-2026: Salesforce salary */
  "salesforce-interview-questions-india-2026||Salesforce Certification and Salary in India": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "Salesforce Admin / Junior Dev", min: 4, max: 9 },
      { role: "Salesforce Developer (3–5 yrs)", min: 10, max: 20 },
      { role: "Salesforce Architect / Lead", min: 20, max: 35 },
      { role: "Certified Technical Architect (CTA)", min: 30, max: 40, note: "Rare; high demand" },
    ]} caption="India 2026 — product and service company Salesforce roles" />
  ),

  /* ui-ux-designer-interview-questions-india-2026: design interview process */
  "ui-ux-designer-interview-questions-india-2026||How Indian Design Interviews Are Structured": (
    <FrameworkSteps steps={[
      { number: "01", label: "Portfolio Review", hint: "Walk through 2–3 case studies; explain your design decisions and trade-offs" },
      { number: "02", label: "Design Challenge", hint: "Redesign a product or feature; use the double-diamond process" },
      { number: "03", label: "Product Critique", hint: "Identify usability issues; suggest improvements with reasoning" },
      { number: "04", label: "Whiteboard / Wireframe", hint: "Sketch a flow on the spot; show structure before visuals" },
      { number: "05", label: "Behavioral Round", hint: "Collaboration with PMs and engineers; handling feedback and conflict" },
    ]} />
  ),

  /* data-science-interview-questions-india-2026: DS preparation ladder */
  "data-science-interview-questions-india-2026||What Indian Data Science Interviews Actually Test": (
    <FrameworkSteps steps={[
      { number: "01", label: "Statistics & Probability", hint: "Distributions, hypothesis testing, p-value, confidence intervals" },
      { number: "02", label: "ML Algorithms", hint: "Decision trees, gradient boosting, regularisation, bias-variance" },
      { number: "03", label: "SQL", hint: "Aggregations, JOINs, window functions — tested at every company" },
      { number: "04", label: "Python / Pandas", hint: "Data wrangling, feature engineering, visualisation" },
      { number: "05", label: "Business Case / Product Intuition", hint: "Interpret an A/B test, diagnose a metric drop, recommend action" },
    ]} />
  ),

  /* cryptocurrency-blockchain-interview-questions-india-2026: blockchain salary */
  "cryptocurrency-blockchain-interview-questions-india-2026||Salary and Market Reality for Blockchain Roles in India": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Blockchain Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Smart Contract / Solidity Dev (2–4 yrs)", min: 14, max: 25 },
      { role: "Blockchain Architect / Lead (4–7 yrs)", min: 22, max: 40 },
      { role: "DeFi Protocol Engineer (Senior)", min: 30, max: 50, note: "Often USD-remote roles" },
    ]} caption="India 2026 — includes fintech and Web3-native employers" />
  ),

  /* fullstack-developer-interview-questions-india-2026: full-stack approach */
  "fullstack-developer-interview-questions-india-2026||System Design for Full-Stack Roles": (
    <FrameworkSteps steps={[
      { number: "01", label: "Feature Scoping", hint: "Break the feature into frontend, backend, and data storage concerns" },
      { number: "02", label: "API Contract", hint: "Define REST or GraphQL contract; discuss versioning" },
      { number: "03", label: "Database Design", hint: "Schema, indexing, SQL vs NoSQL choice with reasoning" },
      { number: "04", label: "State Management", hint: "Client-side state (React Query / Redux) vs server-side caching" },
      { number: "05", label: "Deployment & Scalability", hint: "CI/CD, containerisation, horizontal scaling basics" },
    ]} />
  ),

  /* cybersecurity-interview-questions-india-2026: security role salary */
  "cybersecurity-interview-questions-india-2026||Security Certifications and Their Value in India": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Security Analyst / SOC L1 (0–2 yrs)", min: 4, max: 9 },
      { role: "Penetration Tester / VAPT (2–4 yrs)", min: 8, max: 18 },
      { role: "Security Engineer / Cloud Security (3–6 yrs)", min: 15, max: 28 },
      { role: "CISO / Security Architect (8+ yrs)", min: 25, max: 35, note: "CISSP / CISM strongly preferred" },
    ]} caption="India 2026 — BFSI and product companies pay premium for certified professionals" />
  ),

  /* android-developer-interview-questions-india-2026: Android prep areas */
  "android-developer-interview-questions-india-2026||Android Architecture": (
    <FrameworkSteps steps={[
      { number: "01", label: "MVVM Pattern", hint: "ViewModel, LiveData / StateFlow, repository layer separation" },
      { number: "02", label: "Clean Architecture", hint: "Domain, data, presentation layers; dependency rule" },
      { number: "03", label: "Dependency Injection", hint: "Hilt / Dagger 2 — know how to scope and provide dependencies" },
      { number: "04", label: "Navigation Component", hint: "NavGraph, safe args, deep links" },
      { number: "05", label: "WorkManager", hint: "Background tasks, chaining, constraints" },
    ]} />
  ),

  /* dsa-preparation-for-interviews-india-2026: 90-day plan */
  "dsa-preparation-for-interviews-india-2026||The 90-day DSA study plan for Indian engineers": (
    <PrepTimeline caption="90-day DSA plan — from zero to product-company ready" phases={[
      { period: "Days 1–20", label: "Foundations", tasks: ["Arrays, strings, hashmaps", "Two pointers and sliding window", "Binary search"], milestone: "30 easy problems solved" },
      { period: "Days 21–45", label: "Core Data Structures", tasks: ["Linked lists, stacks, queues", "Trees and BST operations", "Heaps and priority queues"], milestone: "50 medium problems solved" },
      { period: "Days 46–70", label: "Graphs & DP", tasks: ["BFS/DFS, Dijkstra", "Union-Find", "1D and 2D dynamic programming"], milestone: "80 medium problems solved" },
      { period: "Days 71–90", label: "Mock & Refinement", tasks: ["Company-tagged problem sets", "Timed mock interviews", "System design basics for SDE-2"], milestone: "Ready for product company interviews" },
    ]} />
  ),

  /* coding-interview-mistakes-india-2026: mistake categories */
  "coding-interview-mistakes-india-2026||Mistake 1–4: Communication and approach failures": (
    <FrameworkSteps steps={[
      { number: "01", label: "Coding Before Clarifying", hint: "Always ask about constraints, edge cases, and expected output first" },
      { number: "02", label: "Silent Solving", hint: "Think aloud; interviewers evaluate your process, not just your answer" },
      { number: "03", label: "Jumping to Optimal", hint: "State a brute-force approach first, then optimise — shows structured thinking" },
      { number: "04", label: "Ignoring Edge Cases", hint: "Empty input, negative numbers, single element — mention them proactively" },
    ]} />
  ),

  /* nodejs-interview-questions-india-2026: Node.js core concepts */
  "nodejs-interview-questions-india-2026||Core Node.js concepts most commonly tested": (
    <FrameworkSteps steps={[
      { number: "01", label: "Event Loop", hint: "6 phases: timers, I/O callbacks, idle, poll, check, close — know the order" },
      { number: "02", label: "Non-blocking I/O", hint: "Why Node.js handles concurrency differently from thread-per-request models" },
      { number: "03", label: "Streams", hint: "Readable, Writable, Duplex, Transform — memory-efficient large data processing" },
      { number: "04", label: "Cluster / Worker Threads", hint: "Scaling CPU-bound work; difference between the two approaches" },
      { number: "05", label: "Error Handling", hint: "process.on('uncaughtException') vs domain vs async/await try-catch patterns" },
    ]} />
  ),

  /* technical-interview-one-week-prep-india-2026: 7-day plan */
  "technical-interview-one-week-prep-india-2026||Day 1: Audit and target-set (2–3 hours)": (
    <PrepTimeline caption="7-day rapid interview preparation plan" phases={[
      { period: "Day 1", label: "Audit & Target-Set", tasks: ["List your weak DSA topics", "Review job description for key tech stack", "Set realistic goals for the week"], milestone: "Study plan written" },
      { period: "Days 2–4", label: "DSA Sprint", tasks: ["3–4 hrs/day on targeted LeetCode problems", "Focus on patterns: sliding window, trees, DP", "Review solutions immediately after each problem"], milestone: "20+ targeted problems solved" },
      { period: "Day 5", label: "System Design", tasks: ["1 full design walkthrough (URL shortener or chat system)", "Review CAP theorem, caching, DB sharding basics"], milestone: "System design framework rehearsed" },
      { period: "Days 6–7", label: "Behavioral & Mock", tasks: ["Prepare 5 STAR stories", "1 full mock interview with time pressure", "Rest and light review only on Day 7"], milestone: "Confident and rested" },
    ]} />
  ),

  /* postgresql-interview-questions-india-2026: PostgreSQL concepts */
  "postgresql-interview-questions-india-2026||PostgreSQL-specific concepts": (
    <FrameworkSteps steps={[
      { number: "01", label: "MVCC", hint: "Multi-Version Concurrency Control — how PG handles reads without locking" },
      { number: "02", label: "Indexes", hint: "B-tree, GIN, GiST, BRIN — when to use each type" },
      { number: "03", label: "EXPLAIN ANALYZE", hint: "Read query plans; identify seq scans, index scans, hash joins" },
      { number: "04", label: "Partial & Expression Indexes", hint: "Index on filtered subset or computed expression for performance" },
      { number: "05", label: "Vacuuming & Autovacuum", hint: "Dead tuple cleanup; why neglecting it causes bloat and slowdowns" },
    ]} />
  ),

  /* microservices-interview-questions-india-2026: microservices concepts */
  "microservices-interview-questions-india-2026||Core microservices concepts tested in interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Service Decomposition", hint: "Domain-driven design, bounded contexts, when NOT to split services" },
      { number: "02", label: "Inter-service Communication", hint: "Sync (REST/gRPC) vs async (Kafka/RabbitMQ) — trade-offs" },
      { number: "03", label: "Service Discovery", hint: "Client-side (Eureka) vs server-side (Kubernetes Service)" },
      { number: "04", label: "Circuit Breaker", hint: "Resilience4j / Hystrix — fail-fast and prevent cascade failures" },
      { number: "05", label: "Distributed Tracing", hint: "OpenTelemetry, Jaeger, correlation IDs across services" },
    ]} />
  ),

  /* oop-interview-questions-india-2026: OOP principles */
  "oop-interview-questions-india-2026||SOLID principles with examples": (
    <FrameworkSteps steps={[
      { number: "S", label: "Single Responsibility", hint: "One class, one reason to change — separate Order and Invoice" },
      { number: "O", label: "Open/Closed", hint: "Open for extension, closed for modification — use interfaces/abstract classes" },
      { number: "L", label: "Liskov Substitution", hint: "Subtypes must be substitutable for their base types without breaking" },
      { number: "I", label: "Interface Segregation", hint: "Many small interfaces beat one fat interface" },
      { number: "D", label: "Dependency Inversion", hint: "Depend on abstractions, not concretions — enables easy mocking" },
    ]} />
  ),

  /* operating-systems-interview-questions-india-2026: OS topics */
  "operating-systems-interview-questions-india-2026||Scheduling and synchronisation": (
    <FrameworkSteps steps={[
      { number: "01", label: "CPU Scheduling Algorithms", hint: "FCFS, SJF, Round Robin, Priority Scheduling — know trade-offs" },
      { number: "02", label: "Mutex vs Semaphore", hint: "Mutex: binary ownership lock; Semaphore: signalling between threads" },
      { number: "03", label: "Deadlock", hint: "Four Coffman conditions; prevention via ordering or timeout" },
      { number: "04", label: "Monitors", hint: "High-level synchronisation construct; Java's synchronized block" },
      { number: "05", label: "Condition Variables", hint: "Wait and signal inside a monitor; bounded buffer producer-consumer" },
    ]} />
  ),

  /* frontend-developer-interview-questions-india-2026: frontend study areas */
  "frontend-developer-interview-questions-india-2026||JavaScript fundamentals most tested in Indian frontend interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Closures", hint: "Function + its lexical scope captured; common in currying and private state" },
      { number: "02", label: "Prototypal Inheritance", hint: "Prototype chain, Object.create, __proto__ vs prototype" },
      { number: "03", label: "this keyword", hint: "Binding rules: default, implicit, explicit (call/apply/bind), arrow functions" },
      { number: "04", label: "Event Loop & Async", hint: "Microtask vs macrotask queue; Promise vs setTimeout ordering" },
      { number: "05", label: "ES6+ Essentials", hint: "Destructuring, spread/rest, modules, optional chaining, nullish coalescing" },
    ]} />
  ),

  /* computer-networking-interview-questions-india-2026: networking concepts */
  "computer-networking-interview-questions-india-2026||OSI model and TCP/IP stack": (
    <FrameworkSteps steps={[
      { number: "07", label: "Application Layer", hint: "HTTP, HTTPS, DNS, SMTP — what engineers interact with daily" },
      { number: "04", label: "Transport Layer", hint: "TCP (reliable, ordered) vs UDP (fast, lossy) — when to use each" },
      { number: "03", label: "Network Layer", hint: "IP addressing, routing, subnets, NAT" },
      { number: "02", label: "Data Link Layer", hint: "MAC addresses, ARP, Ethernet frames" },
      { number: "01", label: "Physical Layer", hint: "Bits over wire/fiber — rarely asked but good to mention" },
    ]} />
  ),

  /* spring-boot-interview-questions-india-2026: Spring Boot topics */
  "spring-boot-interview-questions-india-2026||Spring Boot auto-configuration and REST": (
    <FrameworkSteps steps={[
      { number: "01", label: "Auto-configuration", hint: "@EnableAutoConfiguration scans classpath; @ConditionalOnClass enables features" },
      { number: "02", label: "Starter POMs", hint: "spring-boot-starter-web, -data-jpa, -security — aggregate dependencies" },
      { number: "03", label: "@RestController", hint: "@Controller + @ResponseBody; difference matters for view vs JSON responses" },
      { number: "04", label: "Exception Handling", hint: "@ControllerAdvice + @ExceptionHandler for centralised error responses" },
      { number: "05", label: "Actuator", hint: "/health, /metrics, /env endpoints for production observability" },
    ]} />
  ),

  /* aws-interview-questions-india-2026: AWS services study approach */
  "aws-interview-questions-india-2026||AWS core services most tested in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Compute", hint: "EC2 instance types, Auto Scaling groups, Lambda cold starts vs provisioned" },
      { number: "02", label: "Storage", hint: "S3 storage classes, EBS vs EFS vs S3, lifecycle policies" },
      { number: "03", label: "Database", hint: "RDS multi-AZ vs read replicas, DynamoDB partition key design, ElastiCache" },
      { number: "04", label: "Networking", hint: "VPC, subnets, security groups vs NACLs, Route 53 routing policies" },
      { number: "05", label: "IAM", hint: "Policies, roles, trust relationships — principle of least privilege" },
    ]} />
  ),

  /* golang-interview-questions-india-2026: Go preparation areas */
  "golang-interview-questions-india-2026||Go concurrency patterns and common pitfalls": (
    <FrameworkSteps steps={[
      { number: "01", label: "Goroutines", hint: "Lightweight threads; understand goroutine leaks — always provide a way to exit" },
      { number: "02", label: "Channels", hint: "Buffered vs unbuffered; direction-typed channels in function signatures" },
      { number: "03", label: "select statement", hint: "Multiplex channel operations; default case for non-blocking receive" },
      { number: "04", label: "sync.WaitGroup", hint: "Wait for a set of goroutines to finish; don't copy a WaitGroup" },
      { number: "05", label: "Race detector", hint: "go test -race; understand data races and how to prevent with mutex or channels" },
    ]} />
  ),

  /* api-design-best-practices-india-2026: API design approach */
  "api-design-best-practices-india-2026||REST API naming and URL conventions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Resource-Centric URLs", hint: "/users/{id}/orders not /getOrdersForUser — nouns, not verbs" },
      { number: "02", label: "HTTP Verbs", hint: "GET (read), POST (create), PUT (replace), PATCH (partial update), DELETE" },
      { number: "03", label: "Status Codes", hint: "200/201/204 for success; 400 bad request; 401/403; 404; 409 conflict; 500" },
      { number: "04", label: "Versioning", hint: "URI (/v1/) vs header versioning — URI is simpler for Indian company contexts" },
      { number: "05", label: "Pagination", hint: "Cursor-based for large datasets; limit/offset for simpler use cases" },
    ]} />
  ),

  /* leetcode-study-plan-india-2026: 3-month LeetCode plan */
  "leetcode-study-plan-india-2026||Month 1: Foundations (Arrays, Strings, Hashmaps, Two Pointers)": (
    <PrepTimeline caption="3-month LeetCode study plan for Indian product companies" phases={[
      { period: "Month 1", label: "Foundations", tasks: ["Arrays & strings — 25 problems", "Hashmaps & sets — 15 problems", "Two pointers & sliding window — 15 problems", "Binary search — 10 problems"], milestone: "65 problems, patterns recognised" },
      { period: "Month 2", label: "Trees, Graphs & DP", tasks: ["Binary trees BFS/DFS — 20 problems", "Graphs (adjacency list, BFS, DFS, union-find) — 20 problems", "1D DP — 15 problems", "2D DP / interval DP — 10 problems"], milestone: "130 problems, DP patterns solid" },
      { period: "Month 3", label: "Advanced & Company Prep", tasks: ["Heaps, tries, segment trees — 15 problems", "Backtracking & greedy — 15 problems", "Company-tagged sets (Flipkart/Razorpay/Google) — 30 problems", "Timed mock contests weekly"], milestone: "190+ problems, interview-ready" },
    ]} />
  ),

  /* python-interview-questions-india-2026: Python study areas */
  "python-interview-questions-india-2026||Python fundamentals tested at all interview levels": (
    <FrameworkSteps steps={[
      { number: "01", label: "Data Types & Mutability", hint: "list vs tuple vs set vs dict; mutable default argument trap" },
      { number: "02", label: "GIL", hint: "Global Interpreter Lock — why threads don't give CPU parallelism in CPython" },
      { number: "03", label: "Generators", hint: "yield vs return; memory-efficient iteration; generator expressions" },
      { number: "04", label: "Comprehensions", hint: "List, dict, set comprehensions — write them faster than the interviewer expects" },
      { number: "05", label: "Error Handling", hint: "try/except/else/finally; raising custom exceptions; context managers" },
    ]} />
  ),

  /* java-interview-questions-india-2026: Java topics breakdown */
  "java-interview-questions-india-2026||Core Java questions most tested in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "OOP Pillars", hint: "Encapsulation, inheritance, polymorphism, abstraction — with Java examples" },
      { number: "02", label: "String Internals", hint: "String pool, StringBuilder vs StringBuffer, immutability" },
      { number: "03", label: "equals() and hashCode()", hint: "Contract — if equals is true, hashCodes must match; used in HashMap" },
      { number: "04", label: "Exception Hierarchy", hint: "Checked vs unchecked; when to use each; custom exceptions" },
      { number: "05", label: "JVM Memory", hint: "Heap vs stack; Eden, Survivor, Old Gen; GC types (G1, ZGC)" },
    ]} />
  ),

  /* system-design-interview-beginner-india-2026: 6-step SD framework */
  "system-design-interview-beginner-india-2026||The 6-step framework for any system design question": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify Scope", hint: "Ask about users, features, scale — never assume, always confirm" },
      { number: "02", label: "Capacity Estimation", hint: "QPS, storage, bandwidth back-of-envelope in 2 minutes" },
      { number: "03", label: "System Interface", hint: "Define core APIs before designing infrastructure" },
      { number: "04", label: "Data Model", hint: "Tables, relationships, choice of SQL vs NoSQL" },
      { number: "05", label: "High-Level Design", hint: "Draw the boxes: CDN, LB, servers, cache, DB" },
      { number: "06", label: "Deep Dive", hint: "Pick 1–2 hard problems (hot keys, replication lag) and go deep" },
    ]} />
  ),

  /* data-structures-algorithms-india-interview-2026: 8-week prep plan */
  "data-structures-algorithms-india-interview-2026||Week-by-Week Preparation Plan (8 Weeks)": (
    <PrepTimeline caption="8-week DSA preparation plan for Indian interviews" phases={[
      { period: "Week 1–2", label: "Arrays, Strings & Hashing", tasks: ["Two pointers, prefix sum, sliding window", "HashMap frequency counting", "Binary search variations"], milestone: "Foundations solid" },
      { period: "Week 3–4", label: "Trees & Linked Lists", tasks: ["BST insert, delete, search", "Tree traversals (BFS, DFS)", "Linked list reversal, cycle detection"], milestone: "Tree & list problems fluent" },
      { period: "Week 5–6", label: "Graphs & Dynamic Programming", tasks: ["BFS/DFS, topological sort, union-find", "1D DP, 2D DP, knapsack pattern"], milestone: "Core DP patterns memorised" },
      { period: "Week 7–8", label: "Heaps, Backtracking & Mocks", tasks: ["Top-K elements, merge K lists", "Permutations, subsets, N-Queens", "2 full timed mock interviews"], milestone: "Interview-ready" },
    ]} />
  ),

  /* react-interview-questions-india-2026: React hooks deep dive */
  "react-interview-questions-india-2026||React Hooks: The Core Interview Topic": (
    <FrameworkSteps steps={[
      { number: "01", label: "useState", hint: "Batching, functional updates, lazy initialiser pattern" },
      { number: "02", label: "useEffect", hint: "Cleanup, dependency array rules; common bug: missing deps" },
      { number: "03", label: "useMemo / useCallback", hint: "Memoisation — know when they add overhead vs help" },
      { number: "04", label: "useContext", hint: "Avoid prop drilling; performance pitfall of large context objects" },
      { number: "05", label: "Custom Hooks", hint: "Extract logic into reusable hooks; show a useFetch or useDebounce example" },
    ]} />
  ),

  /* typescript-interview-questions-india-2026: TypeScript key topics */
  "typescript-interview-questions-india-2026||TypeScript Basics: What Every Interview Tests": (
    <FrameworkSteps steps={[
      { number: "01", label: "Type vs Interface", hint: "Interface is extendable and mergeable; type supports unions and mapped types" },
      { number: "02", label: "Generics", hint: "Write reusable, type-safe functions and classes; constrain with extends" },
      { number: "03", label: "Union & Intersection Types", hint: "A | B vs A & B; discriminated unions for type narrowing" },
      { number: "04", label: "Utility Types", hint: "Partial, Required, Pick, Omit, Record, ReturnType — use these, don't rewrite" },
      { number: "05", label: "Type Guards", hint: "typeof, instanceof, in, custom type predicates (is Type)" },
    ]} />
  ),

  /* git-interview-questions-india-2026: Git workflow steps */
  "git-interview-questions-india-2026||Branching and Merging": (
    <FrameworkSteps steps={[
      { number: "01", label: "Feature Branches", hint: "branch per feature; short-lived branches merge faster with fewer conflicts" },
      { number: "02", label: "Merge vs Rebase", hint: "Merge preserves history; rebase creates linear history — know trade-offs" },
      { number: "03", label: "Squash Commits", hint: "Clean up WIP commits before merging into main" },
      { number: "04", label: "Conflict Resolution", hint: "Accept ours / theirs / both; always understand the code, don't just accept" },
      { number: "05", label: "Pull Request Workflow", hint: "Branch → PR → review → CI green → merge — standard in Indian product companies" },
    ]} />
  ),

  /* docker-kubernetes-interview-questions-india-2026: container concepts */
  "docker-kubernetes-interview-questions-india-2026||Kubernetes Fundamentals": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pod", hint: "Smallest deployable unit; 1 or more tightly coupled containers" },
      { number: "02", label: "Deployment", hint: "Desired state for pods; rolling updates and rollback built-in" },
      { number: "03", label: "Service", hint: "Stable network endpoint for a set of pods; ClusterIP / NodePort / LoadBalancer" },
      { number: "04", label: "ConfigMap & Secret", hint: "Decouple configuration from image; secrets are base64 encoded" },
      { number: "05", label: "Horizontal Pod Autoscaler", hint: "Scale pods based on CPU/memory or custom metrics" },
    ]} />
  ),

  /* programming-languages-india-job-market-2026: language salary comparison */
  "programming-languages-india-job-market-2026||Python: The Most Versatile Choice": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Python Developer (1–3 yrs)", min: 6, max: 16 },
      { role: "Java Developer (1–3 yrs)", min: 6, max: 15 },
      { role: "JavaScript/Node.js Developer (1–3 yrs)", min: 5, max: 14 },
      { role: "Go Developer (2–4 yrs)", min: 12, max: 28, note: "Smaller pool, higher premium" },
      { role: "Python ML Engineer (3–5 yrs)", min: 18, max: 45, note: "GenAI demand drives premium" },
    ]} caption="India 2026 — product companies; IT services pay 30–40% less" />
  ),

  /* acing-online-assessment-india-2026: OA strategy steps */
  "acing-online-assessment-india-2026||Time Management Strategy": (
    <FrameworkSteps steps={[
      { number: "01", label: "Read All Questions First", hint: "Spend 2 min scanning all problems; start with highest confidence, not first in list" },
      { number: "02", label: "Partial Credit First", hint: "A brute-force solution that passes 60% test cases beats zero — always submit something" },
      { number: "03", label: "Time Box per Problem", hint: "Allocate time per problem upfront; move on if stuck; return if time allows" },
      { number: "04", label: "Dry-Run Before Submit", hint: "Walk through 2 examples mentally; check array bounds and null cases" },
    ]} />
  ),

  /* interview-preparation-timeline-india-2026: 30/60/90 day plans */
  "interview-preparation-timeline-india-2026||30-Day Plan: Rapid Preparation for a Specific Opportunity": (
    <PrepTimeline caption="Tiered interview preparation timelines" phases={[
      { period: "30-Day Plan", label: "Rapid Prep (SDE-1 at IT/Mid-product)", tasks: ["Days 1–10: Arrays, strings, hashmap problems (30 problems)", "Days 11–20: Trees, linked lists, binary search", "Days 21–28: 5 STAR stories + company research", "Days 29–30: Mock interview + rest"], milestone: "Ready for IT services and mid-tier product companies" },
      { period: "60-Day Plan", label: "Standard Prep (SDE-1 / SDE-2)", tasks: ["Weeks 1–3: DSA foundations (75 problems)", "Weeks 4–6: Graphs, DP, system design basics", "Weeks 7–8: Company-tagged sets + 4 full mock interviews"], milestone: "Ready for Indian unicorns and FAANG India screens" },
      { period: "90-Day Plan", label: "FAANG / Top Unicorn Prep", tasks: ["Months 1–2: 150+ curated LeetCode problems, all patterns", "Month 3: System design (6 full walkthroughs), bar-raiser behavioral prep", "Weeks 11–12: 8 mock interviews, company-specific deep-dives"], milestone: "Ready for Google, Microsoft, Meta, Flipkart, PhonePe bar raiser" },
    ]} />
  ),

  /* angular-interview-questions-india-2026: Angular key topics */
  "angular-interview-questions-india-2026||Angular Fundamentals": (
    <FrameworkSteps steps={[
      { number: "01", label: "Modules & Components", hint: "NgModule, declarations, imports, providers; component lifecycle hooks" },
      { number: "02", label: "Dependency Injection", hint: "Hierarchical injectors; providedIn: 'root' vs module-level" },
      { number: "03", label: "Data Binding", hint: "Interpolation, property, event, and two-way binding with [(ngModel)]" },
      { number: "04", label: "Directives", hint: "Structural (*ngIf, *ngFor) vs attribute directives; custom directive creation" },
      { number: "05", label: "Change Detection", hint: "Default vs OnPush strategy; when to use OnPush for performance" },
    ]} />
  ),

  /* agile-scrum-interview-questions-india-2026: Scrum process */
  "agile-scrum-interview-questions-india-2026||Scrum Ceremonies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Sprint Planning", hint: "Team selects backlog items; estimates using story points or T-shirt sizing" },
      { number: "02", label: "Daily Scrum", hint: "15-min standup: what I did, what I'll do, blockers" },
      { number: "03", label: "Sprint Review", hint: "Demo working software to stakeholders; gather feedback" },
      { number: "04", label: "Sprint Retrospective", hint: "What went well, what to improve, action items — held after review" },
      { number: "05", label: "Backlog Refinement", hint: "Ongoing session to groom and prioritise stories before next sprint" },
    ]} />
  ),
};
