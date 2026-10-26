import type { ReactNode } from "react";
import { RoundFlow, SalaryLadder, TierCompare, FrameworkSteps, PrepTimeline, ComparisonTable } from "../../marketing-v2/_blog-infographics";

export const SECTION_VISUALS_1: Record<string, ReactNode> = {
  /* Flipkart: interview loop */
  "flipkart-interview-prep-guide||Interview Structure": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "DSA filter round" },
      { label: "Machine Coding", duration: "90 min", detail: "Build a system" },
      { label: "Problem Solving ×2", duration: "45 min", detail: "Whiteboard DSA" },
      { label: "System Design", duration: "45–60 min", detail: "SDE-2+ roles" },
      { label: "Hiring Manager", duration: "30 min", detail: "Culture & ownership" },
    ]} />
  ),

  /* Razorpay: interview loop */
  "razorpay-interview-experience||Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background & motivation" },
      { label: "Online Coding", duration: "60 min", detail: "2 DSA problems" },
      { label: "Technical 1", duration: "~45 min", detail: "DSA + decomposition" },
      { label: "Technical 2", duration: "~45 min", detail: "System design" },
      { label: "Culture Round", duration: "~45 min", detail: "Values & ownership" },
      { label: "Hiring Manager", duration: "30 min", detail: "Final bar raiser" },
    ]} />
  ),

  /* Razorpay: compensation */
  "razorpay-interview-experience||Salary Expectations (2026)": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SDE-1", min: 15, max: 25 },
      { role: "SDE-2", min: 28, max: 45 },
      { role: "SDE-3", min: 50, max: 70 },
      { role: "PM",    min: 25, max: 50 },
    ]} caption="Pre-ESOP cash comp, 2026" />
  ),

  /* TCS: interview process */
  "tcs-interview-questions-freshers-2026||TCS Interview Process for Freshers": (
    <RoundFlow rounds={[
      { label: "NQT", detail: "Aptitude + coding filter" },
      { label: "Technical Interview", detail: "CS fundamentals" },
      { label: "Managerial Round", detail: "Behavioral & situational" },
      { label: "HR Round", detail: "Offer & joining" },
    ]} />
  ),

  /* TCS: salary bands */
  "tcs-interview-questions-freshers-2026||TCS Salary for Freshers (2026)": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "TCS Ninja",   min: 0, max: 3.36, note: "most common path" },
      { role: "TCS Digital", min: 0, max: 7.5 },
      { role: "TCS Prime",   min: 0, max: 9.5 },
    ]} caption="NQT coding score determines your band" />
  ),

  /* Infosys: hiring tracks */
  "infosys-interview-questions-2026||Infosys Hiring Tracks Explained": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "Systems Engineer (SE)",       min: 0,   max: 3.6 },
      { role: "Power Programmer (PP)",       min: 0,   max: 6.5 },
      { role: "Digital Specialist (DSE)",    min: 6.5, max: 9.5 },
    ]} caption="InfyTQ certification skips the aptitude filter" />
  ),

  /* Engineering Manager: compensation by tier */
  "engineering-manager-interview-india-2026||Engineering Manager Compensation India 2026": (
    <TierCompare cards={[
      {
        tier: "Tier-1 MNCs",
        examples: "Google · Microsoft · Amazon",
        rows: [
          { label: "EM-1 (5–8 person team)", range: "₹60L – 1 Cr" },
          { label: "Senior EM (10–20 person team)", range: "₹90L – 1.5 Cr" },
        ],
      },
      {
        tier: "Fintech Unicorns",
        examples: "Razorpay · PhonePe · CRED",
        rows: [
          { label: "Engineering Manager", range: "₹50 – 80 LPA" },
          { label: "Senior EM / Head of Eng.", range: "₹80L – 1.2 Cr" },
        ],
      },
      {
        tier: "Consumer Internet",
        examples: "Swiggy · Zomato · Flipkart",
        rows: [
          { label: "Engineering Manager", range: "₹45 – 75 LPA" },
          { label: "Senior EM", range: "₹70L – 1.1 Cr" },
        ],
      },
    ]} />
  ),

  /* Case study: universal framework */
  "ace-case-study-interviews||The Universal Case Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify", hint: "Ask questions to narrow the problem scope. Don't assume the company, market, or metric." },
      { number: "02", label: "Structure", hint: "Build a framework adapted to this problem: don't force-fit a memorised template." },
      { number: "03", label: "Analyze", hint: "Work through each branch with data, logic, and estimation. Show your reasoning." },
      { number: "04", label: "Recommend", hint: "State your answer, the key driver, the main risk, and what you'd verify next." },
    ]} />
  ),

  /* Flipkart: compensation */
  "flipkart-interview-prep-guide||Compensation Expectations (2026)": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "SDE-1", min: 18, max: 28 },
      { role: "SDE-2", min: 30, max: 50 },
      { role: "SDE-3", min: 50, max: 80 },
      { role: "Senior Staff", min: 80, max: 90, note: "LPA+" },
    ]} caption="Pre-ESOP cash comp, 2026" />
  ),

  /* STAR method: 30-60-10 rule */
  "star-method-interview-answers||The 30-60-10 Rule": (
    <FrameworkSteps steps={[
      { number: "30%", label: "Situation + Task", hint: "Set context quickly. Don't over-explain the background: keep this to one or two sentences." },
      { number: "60%", label: "Action", hint: "This is where you show your value. Be specific about what YOU did, not what the team did." },
      { number: "10%", label: "Result", hint: "One clear metric or outcome. Numbers make your answer memorable and credible." },
    ]} />
  ),

  /* Cognizant: GenC vs GenC Pro */
  "cognizant-interview-questions-freshers-2026||GenC vs GenC Pro: Which Track Is Right for You?": (
    <TierCompare cards={[
      {
        tier: "GenC",
        examples: "General IT roles",
        rows: [
          { label: "Starting salary", range: "₹4 LPA" },
          { label: "Coding requirement", range: "1 medium problem" },
        ],
      },
      {
        tier: "GenC Pro",
        examples: "Advanced engineering roles",
        rows: [
          { label: "Starting salary", range: "₹6.5 LPA" },
          { label: "Coding requirement", range: "2 medium problems, 60 min" },
        ],
      },
    ]} />
  ),

  /* Cognizant: salary */
  "cognizant-interview-questions-freshers-2026||Salary & Benefits (2026)": (
    <SalaryLadder maxLPA={8} rows={[
      { role: "GenC", min: 0, max: 4, note: "base ₹3.2L + variable ₹0.8L" },
      { role: "GenC Pro", min: 0, max: 6.5, note: "base ₹5.2L + variable ₹1.3L" },
    ]} caption="Cognizant fresher packages 2026" />
  ),

  /* Accenture: hiring tracks salary */
  "accenture-interview-questions-freshers-2026||Accenture Hiring Tracks": (
    <SalaryLadder maxLPA={9} rows={[
      { role: "ASE (Standard)", min: 0, max: 4.5 },
      { role: "AASE (Advanced)", min: 6, max: 8 },
    ]} caption="Accenture fresher packages 2026" />
  ),

  /* Accenture: iCAT test structure */
  "accenture-interview-questions-freshers-2026||iCAT Online Test: What to Expect": (
    <RoundFlow rounds={[
      { label: "Cognitive Assessment", duration: "35 min", detail: "25 questions: logical, quantitative, verbal" },
      { label: "Technical Assessment", duration: "40 min", detail: "40 questions: CS fundamentals, OOP, DBMS" },
      { label: "Coding Module", duration: "45 min", detail: "2 problems: 1 easy + 1 medium" },
    ]} />
  ),

  /* Product Manager: salary by level */
  "product-manager-interview-questions-india||Salary Expectations for PMs in India (2026)": (
    <SalaryLadder maxLPA={200} rows={[
      { role: "APM / Associate PM", min: 18, max: 35 },
      { role: "PM (3–5 years)", min: 35, max: 70 },
      { role: "Senior PM (5–8 years)", min: 70, max: 120 },
      { role: "Director of Product", min: 120, max: 200 },
    ]} caption="Indicative 2026 ranges (incl. ESOP)" />
  ),

  /* HCL vs Accenture vs Capgemini */
  "hcl-accenture-capgemini-interview-comparison||Salary Comparison (2026)": (
    <TierCompare cards={[
      {
        tier: "HCL",
        examples: "GET to Technology Evangelist track",
        rows: [{ label: "Fresher range", range: "₹3.8–6 LPA" }],
      },
      {
        tier: "Capgemini",
        examples: "Analyst to Senior Analyst",
        rows: [{ label: "Fresher range", range: "₹4.35–7 LPA" }],
      },
      {
        tier: "Accenture",
        examples: "ASE to Advanced ASE",
        rows: [{ label: "Fresher range", range: "₹4.5–8 LPA" }],
      },
    ]} />
  ),

  /* Deloitte: interview rounds */
  "deloitte-interview-questions-freshers-2026||Deloitte Interview Rounds (2026)": (
    <RoundFlow rounds={[
      { label: "CogniVue Test", duration: "60–90 min", detail: "Numerical, verbal, logical, situational judgement" },
      { label: "Group Discussion", duration: "15–20 min", detail: "8–12 candidates evaluated on content + communication" },
      { label: "Case Interview", duration: "30–45 min", detail: "Business problem: structure and present solution" },
      { label: "HR Round", duration: "30 min", detail: "Fit, motivation, salary discussion" },
    ]} />
  ),

  /* Deloitte: salary by track */
  "deloitte-interview-questions-freshers-2026||Salary and Tracks (2026)": (
    <SalaryLadder maxLPA={13} rows={[
      { role: "Business Technology Analyst", min: 7, max: 9 },
      { role: "Consulting Analyst", min: 9, max: 12 },
      { role: "Risk Advisory Analyst", min: 7, max: 10 },
      { role: "Audit & Assurance", min: 6, max: 8 },
    ]} caption="Deloitte India fresher tracks 2026" />
  ),

  /* Deloitte: case interview framework */
  "deloitte-interview-questions-freshers-2026||Case Interview Basics for Freshers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify", hint: "Ask 2–3 questions to narrow the problem. Confirm scope, stakeholders, and constraints before diving in." },
      { number: "02", label: "Structure", hint: "Form a hypothesis-first framework. Adapt to the problem: don't force-fit a memorised template." },
      { number: "03", label: "Analyze", hint: "Ask for data as needed. Work through each branch with logic and estimation." },
      { number: "04", label: "Recommend", hint: "Synthesize findings and give a clear recommendation with measurable success criteria." },
    ]} />
  ),

  /* TCS NQT: test structure */
  "how-to-pass-tcs-nqt-2026||TCS NQT 2026 Structure": (
    <RoundFlow rounds={[
      { label: "Numerical Ability", duration: "~20 min", detail: "12–15 questions: arithmetic, percentages, ratios" },
      { label: "Verbal Ability", duration: "~20 min", detail: "~15 questions: reading comprehension, grammar" },
      { label: "Reasoning Ability", duration: "~20 min", detail: "8–10 questions: logical reasoning, series" },
      { label: "Coding", duration: "60 min", detail: "2 problems: determines Ninja/Digital/Prime track" },
    ]} />
  ),

  /* TCS NQT: score to salary */
  "how-to-pass-tcs-nqt-2026||NQT Cutoffs: What Score Do You Need?": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "TCS Ninja (~70–75%)", min: 0, max: 3.36, note: "most common path" },
      { role: "TCS Digital (~80–85%)", min: 0, max: 7 },
      { role: "TCS Prime (top 5%)", min: 0, max: 9, note: "near-perfect score" },
    ]} caption="NQT score determines salary band" />
  ),

  /* Zoho: hiring process */
  "zoho-interview-questions-freshers-2026||Zoho's Hiring Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "Aptitude Test", detail: "Written, pen-paper: harder than TCS/Infosys" },
      { label: "Programming Round 2", detail: "Arrays, strings, basic recursion, patterns" },
      { label: "Advanced Coding Round 3", detail: "Data structures, algorithms, OOP, small system design" },
      { label: "Technical Interview", detail: "CS fundamentals + code walkthrough from rounds 2 & 3" },
      { label: "HR Interview", detail: "Culture fit, joining timeline, compensation" },
    ]} />
  ),

  /* Zoho: salary */
  "zoho-interview-questions-freshers-2026||Salary and Perks (2026)": (
    <SalaryLadder maxLPA={9} rows={[
      { role: "Software Engineer (fresher)", min: 5, max: 6 },
      { role: "Senior Software Engineer", min: 7, max: 8, note: "1–2 yr promotion" },
    ]} caption="Zoho 2026 packages (+ profit sharing)" />
  ),

  /* System Design: 5-step framework */
  "system-design-interview-preparation||The 5-Step Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Requirements", hint: "Clarify functional and non-functional requirements. Ask about scale, latency, and consistency needs. (3–5 min)" },
      { number: "02", label: "Estimation", hint: "Back-of-envelope math: users, QPS, storage, bandwidth. Shows scale thinking. (2–3 min)" },
      { number: "03", label: "High-Level Design", hint: "Draw major components: clients, load balancers, application servers, databases, caches, queues. (10 min)" },
      { number: "04", label: "Deep Dive", hint: "The interviewer picks 1–2 areas to go deep. This is where you differentiate yourself. (15–20 min)" },
      { number: "05", label: "Tradeoffs & Extensions", hint: "Discuss what you'd change for 10x scale, what to monitor, how you'd handle failures. (5 min)" },
    ]} />
  ),

  /* System Design: 4-week prep plan */
  "system-design-interview-preparation||Preparation Timeline (4 Weeks)": (
    <FrameworkSteps steps={[
      { number: "W1", label: "Fundamentals", hint: "Learn caching, databases, load balancing, and message queues. Build the vocabulary for tradeoff discussions." },
      { number: "W2", label: "Classic Problems", hint: "Practice 3 classic problems: URL shortener, chat app, news feed. Focus on requirements and high-level design." },
      { number: "W3", label: "Harder Problems", hint: "Practice 3 harder problems: payment system, search autocomplete, ride-sharing. Focus on deep dives." },
      { number: "W4", label: "Mock Interviews", hint: "Practice explaining your design out loud. Simulate real time pressure. Get feedback on tradeoff reasoning." },
    ]} />
  ),

  /* Amazon: interview structure */
  "amazon-leadership-principles-interview||How Amazon Interviews Are Structured": (
    <RoundFlow rounds={[
      { label: "Coding ×2", duration: "45–60 min", detail: "LeetCode medium-hard DSA problems" },
      { label: "System Design", duration: "45–60 min", detail: "Architecture + tradeoffs (SDE-2+)" },
      { label: "Behavioral ×1–2", duration: "45–60 min", detail: "Leadership Principles STAR stories" },
      { label: "Bar Raiser", duration: "45–60 min", detail: "Cross-team interviewer with veto power" },
    ]} />
  ),

  /* Amazon: India salary */
  "amazon-leadership-principles-interview||Amazon India-Specific Tips": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1", min: 22, max: 35 },
      { role: "SDE-2", min: 35, max: 60 },
    ]} caption="Amazon India Bangalore / Hyderabad 2026" />
  ),

  /* Wipro: hiring programs salary */
  "wipro-interview-questions-answers||Wipro Hiring Programs": (
    <SalaryLadder maxLPA={7} rows={[
      { role: "Elite NTH (standard)", min: 0, max: 3.5 },
      { role: "Turbo", min: 0, max: 6.5, note: "harder coding round" },
      { role: "WILP", min: 0, max: 3.5, note: "non-CS graduates" },
    ]} caption="Score on online test determines track" />
  ),

  /* Goldman Sachs: interview process */
  "goldman-sachs-india-interview-questions||Goldman Sachs India Hiring Process (2026)": (
    <RoundFlow rounds={[
      { label: "HireVue Screen", duration: "30 min", detail: "Async video: 3–4 behavioral questions" },
      { label: "Online Coding Assessment", duration: "90 min", detail: "2–3 DSA problems on HackerRank" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "1 medium coding + CS theory" },
      { label: "Super Day ×3–4", duration: "45–60 min each", detail: "Coding + system design + behavioral + partner" },
      { label: "HR + Offer", detail: "Background check takes 3–4 weeks" },
    ]} />
  ),

  /* Goldman Sachs: salary */
  "goldman-sachs-india-interview-questions||Goldman Sachs Salary in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "SDE-1 / Analyst (0–2 yr)", min: 25, max: 43, note: "base + bonus" },
      { role: "SDE-2 / Associate (3–5 yr)", min: 38, max: 73, note: "base + bonus" },
      { role: "Vice President (7–10 yr)", min: 65, max: 90, note: "+ variable bonus" },
    ]} caption="Goldman Sachs India 2026 (Jan bonus included)" />
  ),

  /* Swiggy: hiring process */
  "swiggy-interview-questions-2026||Swiggy Hiring Process 2026": (
    <RoundFlow rounds={[
      { label: "Resume Screen", detail: "Referral or portal application" },
      { label: "Online Assessment", duration: "90 min", detail: "2 coding problems (1 medium + 1 hard) on HackerRank" },
      { label: "Technical Round 1", duration: "45 min", detail: "DSA + code walkthrough" },
      { label: "Technical Round 2", duration: "45 min", detail: "System design (mid/senior) or DSA (SDE-1)" },
      { label: "Hiring Manager", detail: "Culture fit + depth questions + bar raiser" },
    ]} />
  ),

  /* Swiggy: salary */
  "swiggy-interview-questions-2026||Swiggy Salary 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "SDE-1 (0–3 yr)", min: 18, max: 25 },
      { role: "SDE-2 (3–6 yr)", min: 28, max: 42 },
      { role: "SDE-3 / Staff", min: 48, max: 70 },
      { role: "PM-1 (0–3 yr)", min: 28, max: 38 },
      { role: "Senior PM (3–6 yr)", min: 42, max: 60 },
    ]} caption="Swiggy post-restructuring packages 2026" />
  ),

  /* Microsoft India: interview process */
  "microsoft-india-interview-questions-2026||Microsoft India Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Resume Screen", detail: "Referral significantly increases visibility" },
      { label: "Online Assessment", duration: "90 min", detail: "2–3 coding problems: 1 easy + 1 medium + 1 medium-hard" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "1–2 coding problems + project discussion" },
      { label: "Virtual Onsite ×4", duration: "45–60 min each", detail: "Coding, systems, behavioral, As Appropriate" },
    ]} />
  ),

  /* Microsoft India: salary */
  "microsoft-india-interview-questions-2026||Microsoft India Salary 2026": (
    <SalaryLadder maxLPA={140} rows={[
      { role: "SDE-1 (0–2 yr)", min: 25, max: 38 },
      { role: "SDE-2 (2–5 yr)", min: 38, max: 60 },
      { role: "SDE-3 / Principal (5–8 yr)", min: 60, max: 90 },
      { role: "Senior Principal", min: 90, max: 140 },
    ]} caption="Microsoft India Hyderabad / Bengaluru 2026" />
  ),

  /* Product vs service salary gap */
  "product-company-vs-service-company-india-career||Salary Difference: The Numbers (2026)": (
    <TierCompare cards={[
      {
        tier: "Fresher (0–1 yr)",
        examples: "TCS vs Flipkart",
        rows: [
          { label: "TCS Ninja", range: "₹3.36 LPA" },
          { label: "Flipkart SDE-1", range: "₹20–25 LPA" },
          { label: "Razorpay SDE-1", range: "₹22–28 LPA" },
        ],
      },
      {
        tier: "Mid-level (3–5 yr)",
        examples: "IT Services vs Product",
        rows: [
          { label: "TCS/Infosys/Wipro Band B–C", range: "₹8–14 LPA" },
          { label: "Flipkart SDE-2", range: "₹35–55 LPA" },
          { label: "Razorpay SDE-2", range: "₹38–55 LPA" },
        ],
      },
    ]} />
  ),

  /* FAANG: interview structure */
  "faang-interview-preparation-india-2026||The FAANG Interview Structure for Indian Candidates": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60–90 min", detail: "2–3 LeetCode-style problems" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "1–2 coding problems with senior engineer" },
      { label: "Virtual Onsite ×4–6", duration: "45–60 min each", detail: "Coding + system design + behavioral" },
    ]} />
  ),

  /* JP Morgan: interview process */
  "jp-morgan-interview-questions-india-2026||Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "HackerRank OA", duration: "90 min", detail: "2–3 coding problems (SDE roles)" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "DSA + 1–2 system design questions" },
      { label: "Technical Panel ×2", duration: "60 min each", detail: "Deeper DSA, architecture, domain knowledge" },
      { label: "Hiring Manager", duration: "45 min", detail: "Behavioral + technical" },
      { label: "HR Offer", detail: "Compensation, joining date, relocation" },
    ]} />
  ),

  /* JP Morgan: compensation */
  "jp-morgan-interview-questions-india-2026||Compensation: India (2026)": (
    <TierCompare cards={[
      {
        tier: "SDE Roles",
        examples: "JP Morgan India Engineering",
        rows: [
          { label: "SDE-1 (Associate)", range: "₹18–28 LPA" },
          { label: "SDE-2 (Senior Associate)", range: "₹28–45 LPA" },
          { label: "VP Engineering", range: "₹45–75 LPA" },
        ],
      },
      {
        tier: "Business Analyst",
        examples: "JP Morgan India BA",
        rows: [
          { label: "Analyst", range: "₹14–22 LPA" },
          { label: "Senior Analyst", range: "₹22–35 LPA" },
        ],
      },
      {
        tier: "Quant Analyst",
        examples: "Markets / Risk",
        rows: [
          { label: "Junior Quant", range: "₹20–35 LPA" },
          { label: "Senior Quant", range: "₹40–70 LPA" },
        ],
      },
    ]} />
  ),

  /* Startup vs MNC: salary comparison */
  "startup-vs-mnc-india-career||Salary Comparison 2026": (
    <TierCompare cards={[
      {
        tier: "Tier-1 MNCs",
        examples: "Google · Microsoft · Amazon · Goldman Sachs",
        rows: [
          { label: "Fresher", range: "₹22–45 LPA" },
          { label: "SDE-2 (3–5 yr)", range: "₹40–80 LPA" },
        ],
      },
      {
        tier: "Well-funded Startups",
        examples: "Razorpay · CRED · Meesho · Swiggy",
        rows: [
          { label: "Fresher", range: "₹20–40 LPA" },
          { label: "SDE-2 (3–5 yr)", range: "₹40–90 LPA" },
        ],
      },
      {
        tier: "Tier-2 MNCs",
        examples: "Accenture · Infosys · Wipro · TCS Digital",
        rows: [
          { label: "Fresher", range: "₹7–18 LPA" },
          { label: "SDE-2", range: "₹18–35 LPA" },
        ],
      },
    ]} />
  ),

  /* Fresher salary: tier-1 product companies */
  "fresher-salary-india-2026||Tier-1 Product Company Salaries (FAANG and Equivalents)": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Google India SDE-1", min: 22, max: 32 },
      { role: "Microsoft India SDE-1", min: 20, max: 30 },
      { role: "Goldman Sachs India", min: 22, max: 32 },
      { role: "Razorpay SDE-1", min: 22, max: 30 },
      { role: "CRED SDE-1", min: 24, max: 32 },
      { role: "Amazon India SDE-1", min: 18, max: 26 },
      { role: "Flipkart SDE-1", min: 20, max: 28 },
    ]} caption="Tier-1 product company fresher packages 2026" />
  ),

  /* Fresher salary: IT service companies */
  "fresher-salary-india-2026||IT Service Company Salaries": (
    <SalaryLadder maxLPA={15} rows={[
      { role: "TCS Ninja", min: 0, max: 3.36 },
      { role: "TCS Digital", min: 0, max: 7 },
      { role: "TCS Prime", min: 9, max: 14 },
      { role: "Infosys SE", min: 3.6, max: 4.25 },
      { role: "Wipro Turbo NLTH", min: 6.5, max: 7 },
      { role: "Accenture ASE", min: 4.5, max: 5.5 },
    ]} caption="Service company fixed bands 2026" />
  ),

  /* IBM: interview process */
  "ibm-interview-questions-india-2026||IBM India Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "IBM Cognitive Assessment", duration: "30 min", detail: "Logical reasoning, numerical aptitude, verbal ability" },
      { label: "Technical Round 1", duration: "45–60 min", detail: "Role-specific: DSA, CS fundamentals" },
      { label: "Technical Round 2", duration: "45 min", detail: "SDE roles only: system design or domain depth" },
      { label: "HR / Competency Round", duration: "30 min", detail: "IBM values alignment: client success, innovation, trust" },
    ]} />
  ),

  /* IBM: salary */
  "ibm-interview-questions-india-2026||IBM India Compensation 2026": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "SDE Fresher", min: 4.5, max: 7 },
      { role: "SDE 2 years", min: 12, max: 18 },
      { role: "SDE 5 years (Senior)", min: 20, max: 32 },
      { role: "GBS Consulting Analyst (Fresher)", min: 6, max: 8.5 },
    ]} caption="IBM India 2026 (below Tier-1, above service IT)" />
  ),

  /* DSA 60-day: weeks 1-2 */
  "dsa-60-day-preparation-plan||Weeks 1–2: Arrays, Strings, and Two Pointers": (
    <FrameworkSteps steps={[
      { number: "W1", label: "Arrays & Prefix Sums", hint: "Days 1–7: max subarray, find duplicates, rotate array, range sum query, sliding window basics." },
      { number: "W2", label: "Strings & Two Pointers", hint: "Days 8–14: anagram check, palindrome, two pointers (3-sum, trapping rainwater), binary search variants." },
      { number: "Mock", label: "Week 2 Baseline", hint: "Day 14: 3 timed problems at 30 min each with no hints. Baseline your speed and accuracy." },
    ]} />
  ),

  /* DSA 60-day: weeks 5-6 */
  "dsa-60-day-preparation-plan||Weeks 5–6: Graphs, Heaps, and Dynamic Programming": (
    <FrameworkSteps steps={[
      { number: "W5a", label: "Graphs", hint: "Days 29–33: BFS/DFS, connected components, number of islands, course schedule, shortest path (Dijkstra)." },
      { number: "W5b", label: "Heaps", hint: "Days 34–35: kth largest element, merge k sorted lists, top k frequent elements using priority queue." },
      { number: "W6a", label: "1D Dynamic Programming", hint: "Days 37–38: climbing stairs, house robber, coin change: build intuition for memoization." },
      { number: "W6b", label: "2D Dynamic Programming", hint: "Days 39–40: LCS, 0/1 knapsack, minimum path sum: practice drawing the DP table." },
    ]} />
  ),

  /* PM salary: APM programs */
  "product-manager-salary-india-2026||APM Salary (Associate/Junior PM)": (
    <SalaryLadder maxLPA={32} rows={[
      { role: "Google APM India", min: 22, max: 30 },
      { role: "Amazon APM", min: 20, max: 26 },
      { role: "Flipkart APM", min: 18, max: 24 },
      { role: "PhonePe APM", min: 16, max: 22 },
      { role: "Razorpay APM", min: 16, max: 22 },
      { role: "Swiggy APM", min: 15, max: 20 },
      { role: "Freshworks APM", min: 12, max: 16 },
    ]} caption="APM program packages India 2026" />
  ),

  /* PM salary: by company tier */
  "product-manager-salary-india-2026||PM Salary by Company": (
    <TierCompare cards={[
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft",
        rows: [
          { label: "Senior PM", range: "₹80 L – 1.4 Cr" },
          { label: "Principal PM", range: "₹1.2 – 2 Cr" },
        ],
      },
      {
        tier: "Fintech Unicorns",
        examples: "Razorpay · PhonePe · CRED",
        rows: [
          { label: "Senior PM", range: "₹50–90 LPA" },
          { label: "Group PM", range: "₹80 L – 1.4 Cr" },
        ],
      },
      {
        tier: "Consumer Internet",
        examples: "Swiggy · Zomato · Flipkart",
        rows: [
          { label: "Senior PM", range: "₹45–80 LPA" },
          { label: "Group PM", range: "₹70 L – 1.2 Cr" },
        ],
      },
    ]} />
  ),

  /* Why hire you: SPR framework */
  "why-should-we-hire-you-answer-india||The SPR Framework: Skill, Proof, Relevance": (
    <FrameworkSteps steps={[
      { number: "S", label: "Skill", hint: "Name one concrete capability. Not 'I'm good at coding': 'I'm strong in Java with hands-on Spring Boot experience.'" },
      { number: "P", label: "Proof", hint: "Back it with one specific example: a project, hackathon, internship task: anything real with a measurable outcome." },
      { number: "R", label: "Relevance", hint: "Connect it explicitly to what this company does. Show you researched: name a product, division, or technical challenge." },
    ]} />
  ),

  /* Self-introduction: present-past-future */
  "how-to-introduce-yourself-in-interview||The Perfect Structure (Present-Past-Future)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present", hint: "Who you are professionally right now: your role, key skills, and your strongest recent achievement." },
      { number: "02", label: "Past", hint: "How you got here: relevant education and experience that created the trajectory you're on." },
      { number: "03", label: "Future", hint: "Why you're here: what excites you about this specific role at this specific company. Be concrete." },
    ]} />
  ),

  /* Python developer salary */
  "python-developer-salary-india-2026||Python Developer Salary by Experience Level (2026)": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Fresher (0–1 yr): service co.", min: 3.5, max: 6 },
      { role: "Fresher (0–1 yr): product co.", min: 6, max: 10 },
      { role: "Junior (1–3 yr)", min: 7, max: 14 },
      { role: "Mid-level (3–6 yr)", min: 14, max: 25 },
      { role: "Senior (6+ yr)", min: 25, max: 45 },
      { role: "Staff / Principal", min: 45, max: 80 },
    ]} caption="Python developer salaries India 2026" />
  ),

  /* Python salary by company type */
  "python-developer-salary-india-2026||Python Salaries by Company Type": (
    <TierCompare cards={[
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft · Meta",
        rows: [{ label: "Range (by level)", range: "₹20–60 LPA + RSUs" }],
      },
      {
        tier: "Unicorn Startups",
        examples: "Razorpay · PhonePe · CRED · Meesho",
        rows: [{ label: "Range", range: "₹15–40 LPA + equity" }],
      },
      {
        tier: "IT Service Companies",
        examples: "TCS · Infosys · Wipro · HCL",
        rows: [{ label: "Range", range: "₹4–18 LPA" }],
      },
    ]} />
  ),

  /* Data analyst salary by experience */
  "data-analyst-salary-india-2026||Data Analyst Salary by Experience (India 2026)": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Entry Level (0–1 yr)", min: 3, max: 6 },
      { role: "Junior Analyst (1–3 yr)", min: 6, max: 12 },
      { role: "Mid-level (3–6 yr)", min: 12, max: 22 },
      { role: "Senior Analyst (6+ yr)", min: 22, max: 35 },
      { role: "Analytics Lead / Manager", min: 30, max: 50 },
    ]} caption="Data analyst salaries India 2026" />
  ),

  /* Data roles comparison */
  "data-analyst-salary-india-2026||Data Analyst vs Data Engineer vs Data Scientist Salary": (
    <TierCompare cards={[
      {
        tier: "Data Analyst",
        examples: "SQL · BI · Business insights",
        rows: [{ label: "Salary range", range: "₹3–30 LPA" }],
      },
      {
        tier: "Data Engineer",
        examples: "Pipelines · PySpark · Cloud",
        rows: [{ label: "Salary range", range: "₹8–45 LPA" }],
      },
      {
        tier: "Data Scientist",
        examples: "ML · Statistics · Modelling",
        rows: [{ label: "Salary range", range: "₹8–40 LPA" }],
      },
    ]} />
  ),

  /* TCS iON NQT: exam pattern */
  "how-to-crack-tcs-ion-nqt-2026||TCS NQT 2026 Exam Pattern and Sections": (
    <RoundFlow rounds={[
      { label: "Verbal Ability", duration: "30 min", detail: "24 questions: RC, vocabulary, error spotting" },
      { label: "Reasoning Ability", duration: "50 min", detail: "30 questions: logical, blood relations, seating" },
      { label: "Numerical Ability", duration: "40 min", detail: "26 questions: arithmetic, DI, time-speed-distance" },
      { label: "Programming Logic", duration: "15 min", detail: "10 questions: flowcharts, pseudocode, algorithms" },
      { label: "Coding (Digital only)", duration: "45 min", detail: "2 medium-difficulty programming problems" },
    ]} />
  ),

  /* TCS iON NQT: 30-day plan */
  "how-to-crack-tcs-ion-nqt-2026||30-Day NQT Preparation Plan": (
    <FrameworkSteps steps={[
      { number: "W1", label: "Baseline + Verbal / Reasoning", hint: "Take a full mock before prep. Identify weakest section. Days 1–7: 1 hr verbal + 1 hr reasoning daily." },
      { number: "W2", label: "Numerical + Programming Logic", hint: "Days 8–14: arithmetic shortcuts, percentage tricks, profit-loss. 30 min programming logic daily." },
      { number: "W3", label: "Speed Drills + Mocks", hint: "Days 15–21: timed drills for slow question types. Take 2 full mock tests, review mistakes between each." },
      { number: "W4", label: "Simulation + HR Prep", hint: "Days 22–28: 3 full mock tests spaced for review. Practice 5 HR questions out loud daily with STAR structure." },
    ]} />
  ),

  /* Wipro Elite NTH vs NLTH */
  "wipro-elite-nlth-preparation-2026||Wipro Elite NTH vs NLTH: What's the Difference?": (
    <SalaryLadder maxLPA={8} rows={[
      { role: "NLTH Standard", min: 3.5, max: 4.5, note: "60%+ academics" },
      { role: "Elite NTH (Turbo)", min: 6.5, max: 7, note: "65%+ academics, harder coding" },
    ]} caption="Both routes use same interview process" />
  ),

  /* React developer salary */
  "react-developer-salary-india-2026||React Developer Salary by Experience (India 2026)": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Fresher (0–1 yr)", min: 4, max: 8 },
      { role: "Junior (1–3 yr)", min: 8, max: 16 },
      { role: "Mid-level (3–6 yr)", min: 16, max: 28 },
      { role: "Senior Frontend Eng. (6+ yr)", min: 28, max: 45 },
      { role: "Staff / Principal", min: 45, max: 70 },
    ]} caption="React developer salaries India 2026" />
  ),

  /* Zomato PM: interview process */
  "zomato-product-manager-interview-2026||Zomato's Interview Process (2026)": (
    <RoundFlow rounds={[
      { label: "Recruiter Call", duration: "30 min", detail: "Background, motivation, 'Why Zomato?' must be specific" },
      { label: "Case Round 1", duration: "60 min", detail: "Product sense or improvement case (restaurant discovery, order frequency)" },
      { label: "Case Round 2", duration: "60 min", detail: "Metric / analytics case (diagnose reorder rate drop, define Gold metrics)" },
      { label: "Behavioral Round", duration: "45 min", detail: "Ownership, data-driven decisions, customer empathy" },
      { label: "Leadership Round", duration: "45 min", detail: "Product strategy + cross-functional alignment stories" },
    ]} />
  ),

  /* Campus placements: typical process */
  "campus-placement-interview-tips||Typical Placement Process": (
    <RoundFlow rounds={[
      { label: "PPT", detail: "Pre-Placement Talk: attend every one, even for uncertain companies" },
      { label: "Aptitude Test", duration: "45–90 min", detail: "Quantitative, verbal, logical reasoning: eliminates 60–80%" },
      { label: "Technical Round", detail: "DSA + CS fundamentals + project discussion" },
      { label: "HR Round", detail: "Behavioral questions, salary expectations, joining date" },
    ]} />
  ),

  /* Mock interview: 3-session framework */
  "mock-interview-practice-guide||The 3-Session Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Baseline Session", hint: "Do a full mock without preparation. Record yourself. Establishes where you actually are: not where you think you are." },
      { number: "02", label: "Targeted Practice", hint: "Focus on the 2–3 weaknesses from Session 1. If answers lack structure, drill STAR. If filler words, practice pausing." },
      { number: "03", label: "Full Simulation", hint: "Simulate the real interview as closely as possible: different question types, time pressure, follow-ups. Builds confidence through realism." },
    ]} />
  ),

  /* Salary negotiation: headroom by level */
  "salary-negotiation-tips-india||When Companies Have Room to Negotiate": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Freshers: mass hiring", min: 0, max: 10, note: "0–10% room" },
      { role: "Freshers: product companies", min: 15, max: 30, note: "15–30% room" },
      { role: "Experienced (3–5 yrs)", min: 20, max: 40, note: "20–40% room" },
      { role: "Experienced (5+ yrs)", min: 25, max: 50, note: "25–50% room" },
    ]} caption="Negotiation headroom as % of initial offer" />
  ),

  /* ── Batch 26 ── */

  /* LinkedIn: getting found by recruiters */
  "linkedin-profile-tips-india-tech-2026||Getting Found by Indian Recruiters": (
    <FrameworkSteps steps={[
      { number: "01", label: "Keyword-Dense Headline", hint: "Include role title + top 2–3 technologies. Appears in search results: recruiters filter on it before clicking your profile." },
      { number: "02", label: "All-Star Profile Completion", hint: "Photo, headline, About, 3+ experience entries, 5+ skills, education. LinkedIn boosts All-Star profiles in search ranking." },
      { number: "03", label: "Skill Assessments", hint: "Top-30% badges for Python, JavaScript, SQL, or cloud skills increase search visibility and add a verified signal." },
      { number: "04", label: "Consistent Posting", hint: "Posting once every 2 weeks (lessons from a project, interview tips, technical explainers) compounds profile reach through LinkedIn's feed algorithm." },
      { number: "05", label: "Proactive Recruiter Outreach", hint: "Connect with recruiters at target companies. Send a 3-sentence note: role you're targeting, key skill, ask to connect. Under 100 words." },
    ]} />
  ),

  /* Networking: getting referrals */
  "networking-tips-india-tech-jobs-2026||Getting Referrals": (
    <FrameworkSteps steps={[
      { number: "01", label: "Map Your Existing Network", hint: "List college batchmates, former colleagues, and LinkedIn connections at target companies. Warm connections convert 5–10x better than cold outreach." },
      { number: "02", label: "Engage Before Asking", hint: "Comment on their posts, like their updates, and reconnect with a genuine message before asking for a referral. Cold referral requests get ignored." },
      { number: "03", label: "Make It Easy to Refer You", hint: "Send a 150-word message with the exact role link, your resume, and a one-paragraph pitch on why you're a good fit. Remove every friction." },
      { number: "04", label: "Follow Up Once", hint: "If no reply in a week, send one polite follow-up. Never more than once: the relationship matters beyond this referral." },
      { number: "05", label: "Convert to a Friend, Not a Transaction", hint: "Offer to return the favour. Share relevant job openings for their profile. Networking is a long game; reciprocity builds real relationships." },
    ]} />
  ),

  /* Services-to-product: 18-month prep timeline */
  "it-service-to-product-company-switch-india-2026||The Preparation Timeline": (
    <PrepTimeline phases={[
      {
        period: "Month 1–3",
        label: "Foundations",
        tasks: ["LeetCode Easy/Medium (2–3 per week)", "Revise CS fundamentals: OS, DBMS, Networking", "System design basics: read Designing Data-Intensive Applications chapters 1–4"],
        milestone: "Solving Easy in <20 min",
      },
      {
        period: "Month 4–9",
        label: "Build & Portfolio",
        tasks: ["Build 1 personal project with modern stack (React/Node or FastAPI/Postgres)", "Target 200+ LeetCode problems: focus on Blind 75", "Mock interviews with peers or HireStepX"],
        milestone: "Portfolio project live on GitHub",
      },
      {
        period: "Month 10–14",
        label: "Apply & Practice",
        tasks: ["Apply to product companies in batches (5–10 per week)", "System design interviews: HLD + LLD for 20 common scenarios", "Behavioural STAR stories: 8–10 ready responses"],
        milestone: "First onsite interview",
      },
      {
        period: "Month 15–18",
        label: "Negotiate & Switch",
        tasks: ["Use competing offers to negotiate compensation", "Evaluate ESOP vesting, base, and culture fit", "Plan notice period exit professionally"],
        milestone: "Offer signed",
      },
    ]} />
  ),

  /* Competitive programming: platform guide */
  "competitive-programming-india-placement-2026||Platform Guide": (
    <FrameworkSteps steps={[
      { number: "01", label: "Codeforces: Competitive Ladder", hint: "Best platform to develop contest intuition. Participate in Div 2 and Div 3 rounds. Target 1200–1600 rating before placements. Exposes you to greedy, binary search, and graph problems in timed conditions." },
      { number: "02", label: "LeetCode: Interview Filter", hint: "The primary OA platform for Indian product companies and FAANG India. Focus on Blind 75 + company-tagged problems. NeetCode roadmap is the most efficient study structure." },
      { number: "03", label: "HackerRank: OA Practice", hint: "Used for TCS, Infosys, and Wipro OAs. Practice HackerRank's problem sets under time pressure. Their format is formulaic: mock their exact UI before real OAs." },
      { number: "04", label: "CodeChef: Long Challenges", hint: "Monthly long challenges teach optimisation thinking. Rating 1800+ puts you in the top 5%: notable on a resume for service companies." },
      { number: "05", label: "ICPC / National Olympiads", hint: "ICPC regionals and ICPC-style practice make LeetCode Hard feel routine. Even a qualifying attempt signals top-tier algorithmic ability to product companies." },
    ]} />
  ),

  /* GitHub portfolio: building it */
  "github-portfolio-career-india-2026||Building a Portfolio on GitHub": (
    <FrameworkSteps steps={[
      { number: "01", label: "Profile README", hint: "Create a repo named <your-username>/<your-username>. Its README.md becomes your GitHub profile homepage. Include: skills badge grid, featured projects, links to LinkedIn and LeetCode. Recruiters see this first." },
      { number: "02", label: "1–2 Anchor Projects", hint: "Quality beats quantity. Build one full-stack project and one system/tool project. Each needs a real problem statement, a clean README with screenshots, and working deployed links." },
      { number: "03", label: "Contribution Graph", hint: "Green squares matter. Commit to personal projects consistently: even small documentation or test additions count. A bare graph signals dormancy; daily commits signal active engineering." },
      { number: "04", label: "Pinned Repositories", hint: "Pin your 6 best repositories on your profile. Choose projects that demonstrate breadth: one frontend, one backend, one tool/script, one data/ML if applicable." },
      { number: "05", label: "Clean Code Practices", hint: "Recruiters who look beyond README will check your code. Use meaningful variable names, write a few tests, add a .env.example, and keep commits atomic with clear messages." },
    ]} />
  ),

  /* Android/Kotlin: architecture questions */
  "android-kotlin-interview-questions-india-2026||Android Architecture Questions": (
    <RoundFlow rounds={[
      { label: "MVVM Pattern", duration: "Most common", detail: "Model-View-ViewModel with LiveData/StateFlow. ViewModel survives config changes; View only observes state." },
      { label: "Clean Architecture", duration: "SDE-2+ roles", detail: "Presentation → Domain → Data layers. UseCases are pure Kotlin; Repositories abstract data sources." },
      { label: "Jetpack Compose", duration: "2024–2026 standard", detail: "Composables, remember/rememberSaveable, side effects (LaunchedEffect, SideEffect), recomposition triggers." },
      { label: "Dependency Injection", duration: "Hilt mandatory", detail: "Hilt modules, @Inject, @HiltViewModel, @Singleton vs @ActivityScoped: scope leaks are a common failure point." },
      { label: "Coroutines + Flow", duration: "Kotlin async standard", detail: "Structured concurrency, SupervisorScope, SharedFlow vs StateFlow, cancellation propagation." },
    ]} />
  ),

  /* Relocation: city comparison */
  "relocation-tech-jobs-india-cities-2026||Bengaluru: India's Undisputed Tech Capital": (
    <ComparisonTable
      columns={[
        { name: "Bengaluru" },
        { name: "Hyderabad", highlight: true },
        { name: "Pune" },
        { name: "Chennai" },
      ]}
      rows={[
        { label: "Avg Salary (5yr)", values: ["₹22–35 LPA", "₹20–32 LPA", "₹16–28 LPA", "₹15–25 LPA"] },
        { label: "Rent (1BHK)", values: ["₹25–45K/mo", "₹15–30K/mo", "₹12–25K/mo", "₹12–22K/mo"] },
        { label: "Cost of Living", values: ["High", "Medium-High", "Medium", "Medium"] },
        { label: "FAANG Presence", values: ["★★★", "★★★", "★★", "★★"] },
        { label: "Startup Ecosystem", values: ["★★★", "★★", "★★", "★"] },
        { label: "Traffic & Commute", values: ["Severe", "Moderate", "Moderate", "Moderate"] },
      ]}
      caption="2026 estimates: salary ranges reflect SDE-2 to senior engineer across product companies"
    />
  ),

  /* Python coding: interview patterns */
  "python-coding-interview-india-2026||Python Interview Patterns": (
    <FrameworkSteps steps={[
      { number: "01", label: "Built-in Data Structures", hint: "collections.defaultdict, Counter, deque, heapq: knowing which to reach for cuts solution time in half. Most Indian OAs test these in disguise." },
      { number: "02", label: "List/Dict Comprehensions", hint: "Idiomatic Python: interviewers notice when you write a for-loop where a comprehension would be cleaner. Shows Python fluency beyond syntax." },
      { number: "03", label: "Two-Pointer & Sliding Window", hint: "Most frequent pattern in Python OAs: works on strings and arrays alike. Master the template: left/right pointer, window expand/shrink, result tracking." },
      { number: "04", label: "Recursion + Memoisation", hint: "Python's @functools.lru_cache turns a recursive solution into a memoised DP in one decorator. Interviewers love this: shows idiomatic thinking." },
      { number: "05", label: "Time/Space Complexity", hint: "State Big-O explicitly before coding. In Python, append() is O(1) amortised, sorted() is O(n log n), dict lookup is O(1): interviewers test whether you know this." },
    ]} />
  ),

  /* Notice period: early release strategies */
  "notice-period-negotiation-india-2026||Early Release Strategies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Request a Buyout Upfront", hint: "Most companies allow buyout at current CTC pro-rated. Calculate the exact amount before negotiating. New employer often reimburses up to 1–2 months buyout: confirm in writing before resigning." },
      { number: "02", label: "Offer Knowledge Transfer", hint: "Frame it as responsible: 'I can complete a thorough knowledge transfer in 4 weeks rather than spending 3 months on reduced productivity.' Many managers prefer clean closure to a disengaged employee for 90 days." },
      { number: "03", label: "Align with a Quiet Period", hint: "Request early release during low-business-activity periods: quarter start, after a product launch, or during annual appraisal season when managers have other priorities." },
      { number: "04", label: "Get HR and Manager Aligned", hint: "The decision requires both. Get your manager's informal buy-in first, then formalise with HR. If manager resists, going to HR first creates adversarial dynamics." },
      { number: "05", label: "Document Everything in Writing", hint: "Verbal agreement on early release is unenforceable. Get the revised last working day in writing from HR before communicating the date to your new employer." },
    ]} />
  ),

  /* Cloud architecture: AWS design scenarios */
  "cloud-architecture-interview-india-2026||AWS Architecture Design Scenarios": (
    <RoundFlow rounds={[
      { label: "Requirement Clarification", duration: "5 min", detail: "Scale (RPS, users), consistency requirements, latency SLA, budget constraints: ask before drawing." },
      { label: "High-Level Design", duration: "10 min", detail: "Sketch core components: load balancer, application tier, database, cache, storage. Identify the critical path." },
      { label: "Deep Dives", duration: "15–20 min", detail: "Interviewer picks 1–2 components to drill: schema design, cache invalidation, scaling the bottleneck." },
      { label: "Trade-off Discussion", duration: "5–10 min", detail: "SQL vs NoSQL, eventual vs strong consistency, sync vs async: state trade-offs explicitly; right answer depends on constraints." },
      { label: "Failure Modes", duration: "5 min", detail: "How does the system behave if DB goes down? If cache misses 100%? If a service crashes mid-transaction? Shows production maturity." },
    ]} />
  ),
  /* ── Company Guides A ── */
  /* resume-tips-freshers-india-2026: Resume tips for freshers — ATS and section strategy */
  "resume-tips-freshers-india-2026||ATS Optimisation: What Indian Companies Actually Use": (
    <FrameworkSteps steps={[
      { number: "01", label: "Use Standard Section Headings", hint: "Write 'Experience', 'Education', 'Skills' — ATS parsers at TCS, Infosys, and Wipro fail on creative labels like 'My Journey'" },
      { number: "02", label: "Match Keywords from the JD", hint: "Copy exact skill terms from the job description — 'Core Java' not just 'Java', 'REST APIs' not 'web services'" },
      { number: "03", label: "Avoid Tables and Columns", hint: "Multi-column resume layouts break most ATS tools used by Indian IT companies including iCIMS and SuccessFactors" },
      { number: "04", label: "Use .docx or .pdf Correctly", hint: "Send .docx to large IT companies unless PDF is specified — many Indian ATS systems parse Word better than PDF" },
      { number: "05", label: "No Headers or Footers for Key Info", hint: "Do not put your name, phone, or email in the document header — ATS often ignores text outside the body" },
    ]} />
  ),

  "resume-tips-freshers-india-2026||CGPA and Academics: The Real Cutoff Situation": (
    <ComparisonTable
      columns={[{ name: "Company Type" }, { name: "Typical CGPA Cutoff", highlight: true }, { name: "Flexibility?" }]}
      rows={[
        { label: "TCS / Infosys / Wipro / HCL", values: ["6.0 – 7.0", "Hard cutoff, rarely waived"] },
        { label: "Capgemini / Cognizant / Tech Mahindra", values: ["6.0", "Some flexibility with strong test score"] },
        { label: "Product startups (Meesho / Zepto)", values: ["No cutoff stated", "Projects and skills matter most"] },
        { label: "FAANG India (Google / Amazon / Microsoft)", values: ["No official cutoff", "Resume screen by humans; strong projects help"] },
        { label: "BFSI tech (JP Morgan / Goldman)", values: ["7.0+", "Hard cutoff for campus hires"] },
      ]}
      caption="Cutoffs are for campus hiring 2026; off-campus and referral routes often bypass them"
    />
  ),

  /* freshworks-interview-questions-india-2026: Freshworks SDE interview process and compensation */
  "freshworks-interview-questions-india-2026||The Four-Round Freshworks SDE Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems on HackerRank, medium difficulty; basic CS fundamentals MCQs" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA problem-solving + discussion of past projects; focus on problem decomposition" },
      { label: "Technical Round 2", duration: "60 min", detail: "System design for SaaS scale: multi-tenancy, rate limiting, webhooks, API design" },
      { label: "Hiring Manager / Bar Raiser", duration: "45 min", detail: "Culture fit, ownership mindset, product thinking for SaaS; STAR-based behavioral questions" },
    ]} />
  ),

  "freshworks-interview-questions-india-2026||Compensation: ₹14–22 LPA + Public RSUs": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Base + RSUs; Chennai/Hyderabad base" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 38, note: "Significant RSU component at this level" },
      { role: "SDE-3 / Senior", min: 35, max: 55, note: "Public stock (NASDAQ: FRSH) adds meaningful upside" },
    ]} caption="Freshworks India 2026; Chennai HQ base + RSUs; values are total compensation" />
  ),

  /* phonepe-interview-questions-india-2026: PhonePe interview process and compensation */
  "phonepe-interview-questions-india-2026||The Four-Round PhonePe Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems, medium-hard; focus on arrays, graphs, and dynamic programming" },
      { label: "Coding Interview 1", duration: "60 min", detail: "Live DSA problem + time/space complexity discussion; clean code emphasis" },
      { label: "System Design", duration: "60 min", detail: "Design a payments system, UPI flow, fraud detection, or high-availability ledger" },
      { label: "Behavioral + Leadership", duration: "45 min", detail: "Builder mindset questions: ownership, moving fast, customer obsession in fintech" },
    ]} />
  ),

  "phonepe-interview-questions-india-2026||Compensation at PhonePe": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Base + ESOPs; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "ESOP grants at Series-funded valuation" },
      { role: "SDE-3 / Senior", min: 45, max: 65, note: "Pre-IPO ESOP upside; Walmart backing" },
    ]} caption="PhonePe India 2026; Bengaluru HQ; ESOPs at pre-IPO valuation included" />
  ),

  /* paytm-interview-questions-india-2026: Paytm SDE interview and salary */
  "paytm-interview-questions-india-2026||SDE Technical Round: What Paytm Actually Asks": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); some roles include SQL or system design MCQs" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; focus on data structures, OOPS concepts, and real fintech scenarios" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: payments gateway, wallet reconciliation, high-volume transaction systems" },
      { label: "HR / Culture Fit", duration: "30 min", detail: "Motivation, post-restructuring context; questions about ambiguity and adaptability" },
    ]} />
  ),

  "paytm-interview-questions-india-2026||Paytm Salary 2026: Post-Restructuring Reality": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Lower than peak-era packages; stable post-restructuring" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 35, note: "ESOPs still offered but at restructured valuation" },
      { role: "SDE-3 / Tech Lead", min: 30, max: 45, note: "Fintech domain expertise valued" },
    ]} caption="Paytm India 2026; Noida/Bengaluru base; post-RBI directive restructuring context" />
  ),

  /* cred-interview-questions-india-2026: CRED interview process and salary */
  "cred-interview-questions-india-2026||CRED Interview Process: What to Expect": (
    <RoundFlow rounds={[
      { label: "Application Screen", duration: "—", detail: "Extremely selective: strong DSA portfolio, top-tier college or exceptional project work required" },
      { label: "Online Assessment", duration: "90 min", detail: "Hard-level DSA problems; CRED targets candidates comfortable with LeetCode hard" },
      { label: "Technical Interview 1", duration: "75 min", detail: "Deep DSA + system design; high bar on code quality, edge case handling, and complexity" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: credit scoring infrastructure, high-concurrency payment flows, data pipelines" },
      { label: "Founder / Culture Round", duration: "45 min", detail: "CRED culture is high-trust, high-bar; deep questions on past work, ownership, and taste" },
    ]} />
  ),

  "cred-interview-questions-india-2026||CRED Salary 2026: Pre-IPO Premium": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "SDE-1 (0–3 yrs)", min: 25, max: 40, note: "High cash + ESOPs; pre-IPO upside" },
      { role: "SDE-2 (3–6 yrs)", min: 38, max: 58, note: "Significant ESOP grants at Series-F valuation" },
      { role: "SDE-3 / Senior", min: 50, max: 75, note: "CRED pays top-10% of India market" },
    ]} caption="CRED India 2026; Bengaluru HQ; pre-IPO ESOPs; highly selective hiring" />
  ),

  /* groww-interview-questions-india-2026: Groww interview process and salary */
  "groww-interview-questions-india-2026||Groww Interview Process: Round by Round": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems on HackerEarth/HackerRank; medium difficulty, focus on arrays and graphs" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; clean code and time complexity are evaluated strictly" },
      { label: "System Design", duration: "60 min", detail: "Design a trading platform, stock price feed, portfolio tracker, or real-time charting system" },
      { label: "Hiring Manager", duration: "45 min", detail: "Product thinking, fintech domain interest, past impact, and culture alignment" },
    ]} />
  ),

  "groww-interview-questions-india-2026||Groww Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Base + ESOPs; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 45, note: "ESOP component significant at growth stage" },
      { role: "SDE-3 / Senior", min: 40, max: 55, note: "Pre-IPO ESOP upside; Series-E+ company" },
      { role: "Data Engineer / Analyst", min: 14, max: 30, note: "Python + SQL focus; slightly lower than SDE" },
    ]} caption="Groww India 2026; Bengaluru; ESOPs at pre-IPO valuation; total compensation" />
  ),

  /* nykaa-interview-questions-india-2026: Nykaa SDE interview and salary */
  "nykaa-interview-questions-india-2026||Nykaa Interview Process: SDE Roles": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); some roles include system design MCQs" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend concepts; Java/Python; e-commerce domain scenarios (catalog, cart, search)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: product catalog at scale, recommendation engine, order management system" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Culture fit for consumer tech; questions on working in fast-paced beauty/fashion domain" },
    ]} />
  ),

  "nykaa-interview-questions-india-2026||Nykaa Salary in India 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 22, note: "Mumbai/Bengaluru base; listed company ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 35, note: "Public ESOPs at NSE-listed valuation" },
      { role: "SDE-3 / Senior", min: 30, max: 45, note: "Niche in beauty-tech; good work-life balance" },
    ]} caption="Nykaa India 2026; NSE-listed; Mumbai HQ; total compensation including ESOPs" />
  ),

  /* ola-interview-questions-india-2026: Ola interview process and salary */
  "ola-interview-questions-india-2026||Ola Cabs Interview Process: SDE Roles": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "DSA problems focused on graphs, shortest paths, real-time systems, and geospatial queries" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; ride-hailing domain questions (driver matching, surge pricing algorithms)" },
      { label: "System Design", duration: "60 min", detail: "Design a cab allocation system, EV charging network, or real-time location tracking at scale" },
      { label: "Hiring Manager", duration: "45 min", detail: "Product thinking for mobility tech; questions on ambiguity, fast execution, and ownership" },
    ]} />
  ),

  "ola-interview-questions-india-2026||Ola Salary in India 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 15, max: 25, note: "Ola Cabs or Ola Electric; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 25, max: 40, note: "ESOPs at Ola Group valuation" },
      { role: "SDE-3 / Senior", min: 35, max: 50, note: "Ola Electric track has hardware-software premium" },
    ]} caption="Ola India 2026; Bengaluru HQ; ESOPs at Ola Group blended valuation" />
  ),

  /* makemytrip-interview-questions-india-2026: MakeMyTrip interview and salary */
  "makemytrip-interview-questions-india-2026||MakeMyTrip Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); travel domain context occasionally embedded in problem statements" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; caching, search, and pricing algorithm scenarios" },
      { label: "System Design", duration: "60 min", detail: "Design a flight/hotel search system, dynamic pricing engine, or booking inventory manager" },
      { label: "Hiring Manager", duration: "30 min", detail: "Culture fit; interest in travel tech; STAR-based behavioral questions" },
    ]} />
  ),

  "makemytrip-interview-questions-india-2026||MakeMyTrip Salary in India 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Gurugram/Bengaluru base; NASDAQ-listed RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 35, note: "RSU component at MakeMyTrip NASDAQ listing" },
      { role: "SDE-3 / Senior", min: 30, max: 45, note: "Travel tech niche; good learning environment" },
    ]} caption="MakeMyTrip India 2026; Gurugram HQ; NASDAQ-listed; RSUs included in TC" />
  ),

  /* meesho-interview-questions-india-2026: Meesho interview process and salary */
  "meesho-interview-questions-india-2026||Meesho Interview Process: SDE Roles": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems; Meesho sets medium-hard bar for product team; focus on graphs and DP" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; social commerce scenarios (catalog, supplier onboarding, logistics)" },
      { label: "System Design", duration: "60 min", detail: "Design a seller dashboard, order routing system, or personalized product feed for Tier-2 India" },
      { label: "Hiring Manager", duration: "45 min", detail: "Meesho values frugality and impact; questions about doing more with less and working in ambiguity" },
    ]} />
  ),

  "meesho-interview-questions-india-2026||Meesho Salary in India 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Bengaluru base; strong ESOP package" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 42, note: "Pre-IPO ESOPs; Series-F valuation" },
      { role: "SDE-3 / Senior", min: 38, max: 50, note: "Meesho hiring is selective; total comp competitive" },
    ]} caption="Meesho India 2026; Bengaluru; pre-IPO ESOPs; total compensation" />
  ),

  /* tcs-nqt-preparation-guide-india-2026: TCS NQT exam structure and interview */
  "tcs-nqt-preparation-guide-india-2026||TCS NQT 2026 Exam Pattern: Complete Section Breakdown": (
    <ComparisonTable
      columns={[{ name: "Section" }, { name: "Questions" }, { name: "Time" }, { name: "Difficulty", highlight: true }]}
      rows={[
        { label: "Verbal Ability", values: ["24", "30 min", "Easy–Medium"] },
        { label: "Reasoning Ability", values: ["30", "50 min", "Medium"] },
        { label: "Numerical Ability", values: ["26", "40 min", "Easy–Medium"] },
        { label: "Programming Logic (MCQ)", values: ["10", "15 min", "Medium"] },
        { label: "Coding (2 problems)", values: ["2", "30 min", "Easy–Medium"] },
        { label: "Advanced Coding (Optional)", values: ["1", "20 min", "Hard (for Prime/Ninja)"] },
      ]}
      caption="TCS NQT 2026 pattern; total ~165 min; Prime track requires higher cutoffs"
    />
  ),

  "tcs-nqt-preparation-guide-india-2026||After NQT: The TCS Interview Process": (
    <RoundFlow rounds={[
      { label: "TCS NQT Exam", duration: "165 min", detail: "Verbal + Reasoning + Numerical + Coding; score determines track (Digital / Prime / Ninja)" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (DBMS, OS, OOP, Networking); one language in depth; project discussion" },
      { label: "Managerial Round", duration: "30 min", detail: "HR-style questions; leadership, teamwork, relocation willingness; asked in Prime/Digital track" },
      { label: "HR Round", duration: "20 min", detail: "Background, salary expectations, bond awareness, onboarding paperwork" },
    ]} />
  ),

  /* wipro-interview-questions-india-2026: Wipro interview process and salary */
  "wipro-interview-questions-india-2026||Wipro Interview Process 2026: All Rounds": (
    <RoundFlow rounds={[
      { label: "Online Assessment (WNTH)", duration: "120 min", detail: "Aptitude + Verbal + Logical + Essay + Coding (2 problems); Elite NLTH has harder coding" },
      { label: "Essay Writing", duration: "20 min", detail: "Written communication assessment; included in WNTH; judged on clarity and grammar" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one programming language, projects from resume" },
      { label: "HR Interview", duration: "20 min", detail: "Location, relocation, bond terms (1 year), career goals, salary discussion" },
    ]} />
  ),

  "wipro-interview-questions-india-2026||Wipro Salary in India 2026": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "Fresher – Turbo (Elite NLTH)", min: 6.5, max: 10, note: "Top track for high-scoring candidates" },
      { role: "Fresher – NLTH Package", min: 3.5, max: 5, note: "Standard fresher CTC; most campus hires" },
      { role: "Experienced (2–4 yrs)", min: 7, max: 14, note: "Lateral hires; depends on skill and negotiation" },
      { role: "Senior Engineer (5+ yrs)", min: 12, max: 20, note: "Niche skills (cloud, SAP, Oracle) command premium" },
    ]} caption="Wipro India 2026; Bengaluru/Hyderabad/Pune; gross CTC including variable pay" />
  ),

  /* infosys-interview-questions-india-2026: Infosys interview process and salary */
  "infosys-interview-questions-india-2026||Infosys Interview Process 2026: Complete Round Breakdown": (
    <RoundFlow rounds={[
      { label: "InfyTQ / Online Test", duration: "95 min", detail: "Reasoning + Math + Verbal + Coding (2 problems); SP track needs higher score + harder coding" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals: OOP, DBMS, OS, data structures; one language in depth; projects discussed" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, background, bond terms (not mandated for SE track), career goals, salary" },
    ]} />
  ),
};
