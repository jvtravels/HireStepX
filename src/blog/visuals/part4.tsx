import type { ReactNode } from "react";
import { RoundFlow, SalaryLadder, TierCompare, FrameworkSteps, PrepTimeline, ComparisonTable } from "../../marketing-v2/_blog-infographics";

export const SECTION_VISUALS_4: Record<string, ReactNode> = {
  /* testing-qa-interview-questions-india-2026: Automation framework design */
  "testing-qa-interview-questions-india-2026||Automation Framework Design": (
    <FrameworkSteps steps={[
      { number: "01", label: "Framework Type", hint: "Data-driven vs keyword-driven vs hybrid; most Indian companies use hybrid" },
      { number: "02", label: "Page Object Model", hint: "Separate UI locators from test logic; maintainability improves drastically" },
      { number: "03", label: "Test Runner", hint: "TestNG / JUnit for Java; pytest for Python; Jest for JS" },
      { number: "04", label: "Reporting", hint: "Allure / Extent Reports; attach screenshots on failure" },
      { number: "05", label: "CI Integration", hint: "Trigger tests on PR via GitHub Actions / Jenkins pipeline" },
    ]} />
  ),

  /* data-engineer-interview-questions-india-2026: data pipeline design */
  "data-engineer-interview-questions-india-2026||Data Pipeline Design (Apache Airflow)": (
    <FrameworkSteps steps={[
      { number: "01", label: "DAG Design", hint: "Define tasks as a directed acyclic graph; avoid complex branching" },
      { number: "02", label: "Operators", hint: "PythonOperator, BashOperator, SQLOperator, KubernetesPodOperator" },
      { number: "03", label: "Task Dependencies", hint: "upstream >> downstream; XCom for passing small values between tasks" },
      { number: "04", label: "Retry & SLA", hint: "Set retries, retry_delay, and SLA alerts for production pipelines" },
      { number: "05", label: "Scheduling", hint: "Cron expressions; backfill for reprocessing historical data" },
    ]} />
  ),

  /* java-spring-boot-interview-questions-india-2026: Spring Boot essentials */
  "java-spring-boot-interview-questions-india-2026||Spring Boot Essentials": (
    <FrameworkSteps steps={[
      { number: "01", label: "@SpringBootApplication", hint: "Combines @Configuration, @EnableAutoConfiguration, @ComponentScan" },
      { number: "02", label: "Dependency Injection", hint: "Constructor injection preferred over field injection in tests and production" },
      { number: "03", label: "application.properties / YAML", hint: "@Value, @ConfigurationProperties, profiles (dev/prod)" },
      { number: "04", label: "Spring Data JPA", hint: "Repository abstraction; @Entity, @Table, JPQL vs native queries" },
      { number: "05", label: "Spring Security", hint: "Filter chain, JWT auth, method-level security with @PreAuthorize" },
    ]} />
  ),

  /* machine-learning-interview-questions-india-2026: ML study topics */
  "machine-learning-interview-questions-india-2026||Algorithms and Model Selection": (
    <FrameworkSteps steps={[
      { number: "01", label: "Linear / Logistic Regression", hint: "Assumptions, regularisation (L1/L2), interpreting coefficients" },
      { number: "02", label: "Decision Trees & Ensembles", hint: "GINI vs entropy; Random Forest (bagging); XGBoost/LightGBM (boosting)" },
      { number: "03", label: "SVMs", hint: "Margin maximisation, kernel trick; when SVMs beat NNs" },
      { number: "04", label: "Clustering", hint: "K-Means (pick K with elbow), DBSCAN for arbitrary shapes" },
      { number: "05", label: "Neural Networks", hint: "Backprop, activation functions, batch norm, dropout" },
    ]} />
  ),

  /* devops-interview-questions-india-2026: DevOps topics */
  "devops-interview-questions-india-2026||CI/CD Pipelines": (
    <FrameworkSteps steps={[
      { number: "01", label: "Source Control Trigger", hint: "PR or push to main triggers the pipeline automatically" },
      { number: "02", label: "Build Stage", hint: "Compile, package (Maven/Gradle/npm build), create Docker image" },
      { number: "03", label: "Test Stage", hint: "Unit tests, integration tests, SAST security scan" },
      { number: "04", label: "Artefact Registry", hint: "Push image to ECR/GCR/Artifactory with immutable tag" },
      { number: "05", label: "Deploy Stage", hint: "Helm upgrade, kubectl apply, blue-green or canary release strategy" },
    ]} />
  ),

  /* product-thinking-interview-india-2026: Product metrics framework */
  "product-thinking-interview-india-2026||The Product Metrics Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Define North Star Metric", hint: "One metric that best captures user value (e.g., rides completed, messages sent)" },
      { number: "02", label: "Acquisition", hint: "How users discover and install / sign up" },
      { number: "03", label: "Activation", hint: "First value moment — what % of new users reach it?" },
      { number: "04", label: "Retention", hint: "D1, D7, D30 retention curves; cohort analysis" },
      { number: "05", label: "Revenue", hint: "ARPU, LTV, payback period; conversion from free to paid" },
    ]} />
  ),

  /* sql-interview-questions-india-2026: SQL window functions */
  "sql-interview-questions-india-2026||Window Functions": (
    <FrameworkSteps steps={[
      { number: "01", label: "ROW_NUMBER()", hint: "Unique sequential number per partition; use for deduplication" },
      { number: "02", label: "RANK() vs DENSE_RANK()", hint: "RANK leaves gaps in ties; DENSE_RANK does not — know when each matters" },
      { number: "03", label: "LAG() / LEAD()", hint: "Access previous/next row value without self-join" },
      { number: "04", label: "SUM() / AVG() OVER", hint: "Running totals and sliding averages; ROWS vs RANGE framing" },
      { number: "05", label: "NTILE(n)", hint: "Divide rows into n buckets — used in percentile calculations" },
    ]} />
  ),

  /* ── Career ── */
  /* notice-period-india-it-resignation-guide-2026: Step-by-step resignation process */
  "notice-period-india-it-resignation-guide-2026||How to Resign: Step by Step": (
    <FrameworkSteps steps={[
      { number: "01", label: "Inform Your Manager First", hint: "Tell your direct manager verbally before anyone else hears — do not resign via email first or to HR directly" },
      { number: "02", label: "Submit Written Resignation", hint: "Send a formal email to your manager, CC HR, with your last working day calculated from your contract notice period" },
      { number: "03", label: "Negotiate Notice Period", hint: "If you need to leave early, discuss buyout terms immediately — most companies accept 50–100% of remaining notice salary" },
      { number: "04", label: "Complete Handover", hint: "Document your work, hand off projects, and get sign-off from your manager — this protects your relieving letter" },
      { number: "05", label: "Collect Exit Documents", hint: "Ensure you receive your experience letter, relieving letter, and Form 16 before your last day" },
    ]} />
  ),

  /* notice-period-india-it-resignation-guide-2026: Notice period comparison across major IT companies */
  "notice-period-india-it-resignation-guide-2026||Notice Period by Company in India 2026": (
    <ComparisonTable
      columns={[{ name: "Company" }, { name: "Notice Period" }, { name: "Buyout Allowed?", highlight: true }, { name: "Notes" }]}
      rows={[
        { label: "TCS", values: ["90 days", "Yes (partial)", "Bond conditions may apply"] },
        { label: "Infosys", values: ["90 days", "Yes", "SP track: 60 days"] },
        { label: "Wipro", values: ["90 days", "Yes", "Elite NLTH: 90 days bond period"] },
        { label: "HCL", values: ["60–90 days", "Yes", "Varies by band"] },
        { label: "Cognizant", values: ["60–90 days", "Yes", "GenC: 6-month lock-in"] },
        { label: "Flipkart / Swiggy / Zomato", values: ["30–60 days", "Yes", "Product companies: shorter"] },
        { label: "Google / Microsoft / Amazon", values: ["30–60 days", "Rarely needed", "Often gardening leave paid"] },
      ]}
      caption="Notice periods as per standard employment contracts in India 2026. Verify your specific letter of appointment."
    />
  ),

  /* faang-maang-india-meaning-companies-2026: Salary comparison FAANG vs Indian product */
  "faang-maang-india-meaning-companies-2026||FAANG India Salary vs Indian Product Companies": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Google / Meta / Microsoft (SWE-2/SDE-2)", min: 45, max: 110, note: "Base + RSU + bonus" },
      { role: "Amazon India (SDE-2)", min: 35, max: 75, note: "High RSU component" },
      { role: "Flipkart / PhonePe (SDE-2)", min: 28, max: 60, note: "RSUs at scale" },
      { role: "Razorpay / CRED / Swiggy (SDE-2)", min: 24, max: 50, note: "Pre-IPO equity upside" },
      { role: "Freshworks / MakeMyTrip (SDE-2)", min: 18, max: 38, note: "Listed company RSUs" },
      { role: "IT Services (Infosys/TCS/Wipro) — 3 yrs", min: 7, max: 14, note: "Predictable increments" },
    ]} caption="Total compensation benchmarks for 3–5 years experience, India 2026. Source: Levels.fyi, Glassdoor, AmbitionBox" />
  ),

  /* faang-maang-india-meaning-companies-2026: Realistic path to FAANG */
  "faang-maang-india-meaning-companies-2026||Realistic Path to FAANG India in 2–3 Years": (
    <PrepTimeline caption="2–3 year roadmap from IT services / mid-tier to FAANG India" phases={[
      { period: "Month 1–3", label: "Assess and Plan", tasks: ["Audit DSA gaps with LeetCode easy/medium", "Identify target role: SDE-1 vs SDE-2", "Start daily 1-hour DSA practice"], milestone: "Baseline: 50 LeetCode problems solved" },
      { period: "Month 4–8", label: "DSA and CS Fundamentals", tasks: ["Complete arrays, trees, graphs, DP patterns", "Study system design fundamentals", "Solve 150+ LeetCode medium problems"], milestone: "Crack 2–3 mid-tier product company offers" },
      { period: "Month 9–15", label: "Targeted FAANG Prep", tasks: ["Mock interviews with peer or AI coach", "System design deep-dives (HLD + LLD)", "Behavioral stories using Amazon LPs as framework"], milestone: "Schedule FAANG India applications" },
      { period: "Month 16–24", label: "Apply and Iterate", tasks: ["Apply via referrals (first choice) and careers page", "Debrief every rejection systematically", "Re-apply: FAANG allows re-attempts after 6 months"], milestone: "FAANG India offer in hand" },
    ]} />
  ),

  /* resignation-letter-format-india-2026: Step-by-step resignation process */
  "resignation-letter-format-india-2026||Common Mistakes That Create Problems Later": (
    <FrameworkSteps steps={[
      { number: "01", label: "Never Resign Verbally Only", hint: "Always follow up with a written email — verbal resignations have no legal standing and cause disputes on your last working day" },
      { number: "02", label: "Don't Skip the Notice Period Date", hint: "Your email must state your last working day explicitly, calculated correctly from your contract — wrong dates delay F&F settlement" },
      { number: "03", label: "Avoid Burning Bridges in the Letter", hint: "Resignation letters are permanent records — keep them neutral and professional regardless of your reason for leaving" },
      { number: "04", label: "Don't Leave Without a Relieving Letter", hint: "Follow up on your relieving letter before your last day — missing this document blocks BGV at your next company" },
      { number: "05", label: "Confirm F&F Timeline in Writing", hint: "Get written confirmation of your Full and Final settlement date — Indian companies legally must pay within 30–45 days of separation" },
    ]} />
  ),

  /* fresher-resume-format-india-2026: Resume section order framework */
  "fresher-resume-format-india-2026||The One-Page Fresher Resume: Structure and Section Order": (
    <FrameworkSteps steps={[
      { number: "01", label: "Contact Header", hint: "Name, phone, email, LinkedIn URL, GitHub — no photo, no date of birth, no gender (illegal to ask in most states)" },
      { number: "02", label: "Education", hint: "Degree, college, graduation year, CGPA — for freshers, education comes before experience since you have none" },
      { number: "03", label: "Projects (2–3 entries)", hint: "Each project: 2–3 bullet points with tech stack, what you built, and quantified outcome — this is your most important section" },
      { number: "04", label: "Skills", hint: "Languages, frameworks, databases, tools — only list what you can answer interview questions on; avoid padding with basic MS Office" },
      { number: "05", label: "Internships / Experience", hint: "If any, list with company, role, dates, and 2–3 outcome-focused bullets — even 2-month internships count" },
      { number: "06", label: "Certifications and Achievements", hint: "Hackathon wins, competitive coding ranks, relevant certifications — keep to genuinely impressive items only" },
    ]} />
  ),

  /* interview-preparation-tips-india-2026: Interview preparation timeline */
  "interview-preparation-tips-india-2026||Interview Preparation Timeline: When to Start": (
    <PrepTimeline caption="Recommended preparation timelines for Indian tech interviews in 2026" phases={[
      { period: "12 Weeks Out", label: "Foundation Phase", tasks: ["Start DSA from scratch or audit gaps", "Set daily 2-hour practice routine", "Pick primary language (Java/Python/C++)"], milestone: "100 LeetCode easy problems done" },
      { period: "8 Weeks Out", label: "Core Building Phase", tasks: ["Arrays, strings, trees, graphs, DP", "Begin system design reading (DDIA, Grokking)", "Start collecting behavioral STAR stories"], milestone: "150 LeetCode medium problems done" },
      { period: "4 Weeks Out", label: "Company-Specific Prep", tasks: ["Research target company interview patterns", "Mock interviews 3x per week", "Review past behavioral answers aloud"], milestone: "First mock interview completed" },
      { period: "1 Week Out", label: "Taper and Polish", tasks: ["Light revision only — no new topics", "Solve 2–3 familiar problems daily", "Prepare questions to ask the interviewer"], milestone: "Interview-ready" },
    ]} />
  ),

  /* campus-placement-preparation-india-2026: Month-by-month preparation plan */
  "campus-placement-preparation-india-2026||Month-by-Month Preparation Plan for Placements": (
    <PrepTimeline caption="Campus placement preparation roadmap for 2026 batch students" phases={[
      { period: "6th Sem (Jan–Apr)", label: "Build Foundations", tasks: ["Start DSA: arrays, strings, sorting, recursion", "Complete one MOOC project to list on resume", "Open LeetCode account, target 50 easy problems"], milestone: "Resume draft ready" },
      { period: "Summer (May–Jul)", label: "Internship or Intensive Prep", tasks: ["Intern if possible — PPO is the best placement outcome", "Without internship: 150+ LeetCode medium problems", "Learn DBMS, OS, CN basics for technical interviews"], milestone: "Technical foundation solid" },
      { period: "7th Sem (Aug–Sep)", label: "Aptitude and Company Research", tasks: ["Start aptitude practice: quant, verbal, logical", "GD practice with study group weekly", "Mock placement drives at college or online"], milestone: "Aptitude test score consistently above 80%" },
      { period: "Peak Season (Oct–Dec)", label: "Active Placement", tasks: ["Apply to every shortlist; prioritise dream companies later", "Debrief every interview the same day", "Keep at least 2 backup offers before declining"], milestone: "Placement offer in hand" },
    ]} />
  ),

  /* campus-placement-preparation-india-2026: Company tiers */
  "campus-placement-preparation-india-2026||Campus Placement Season: Timeline and Company Tiers": (
    <TierCompare cards={[
      {
        tier: "Tier 1 (Dream Companies)",
        examples: "Google · Microsoft · Amazon · Goldman Sachs",
        rows: [
          { label: "CTC Range", range: "₹20–60+ LPA" },
          { label: "When They Visit", range: "Day 1 (Oct/Nov)" },
          { label: "Filter", range: "CGPA 7.5+, strong DSA" },
          { label: "Prep Time Needed", range: "6+ months" },
        ]
      },
      {
        tier: "Tier 2 (Core IT Product)",
        examples: "Flipkart · Razorpay · Freshworks · PhonePe",
        rows: [
          { label: "CTC Range", range: "₹12–30 LPA" },
          { label: "When They Visit", range: "Oct–Dec" },
          { label: "Filter", range: "CGPA 6.5+, medium DSA" },
          { label: "Prep Time Needed", range: "3–4 months" },
        ]
      },
      {
        tier: "Tier 3 (IT Services)",
        examples: "TCS · Infosys · Wipro · Cognizant · HCL",
        rows: [
          { label: "CTC Range", range: "₹3.5–8 LPA" },
          { label: "When They Visit", range: "Dec–Feb" },
          { label: "Filter", range: "CGPA 6.0+, aptitude test" },
          { label: "Prep Time Needed", range: "1–2 months" },
        ]
      },
    ]} />
  ),

  /* placement-experience-what-to-expect-india-2026: What to expect on placement day */
  "placement-experience-what-to-expect-india-2026||Placement Day Morning: What Actually Happens": (
    <FrameworkSteps steps={[
      { number: "01", label: "Report and Register", hint: "Arrive 30 min before reporting time, carry physical copies of resume and photo ID — many companies still require paper copies" },
      { number: "02", label: "Pre-Placement Talk (PPT)", hint: "Company presents their culture and role — take notes on specifics to use in 'Why this company' answers later in the day" },
      { number: "03", label: "Online Assessment / Aptitude Round", hint: "Usually 60–90 min: quant, logical, verbal, and 1–2 coding problems — shortlist announced within 2–4 hours" },
      { number: "04", label: "Technical Interview Rounds", hint: "1–3 rounds of 45–60 min each — DSA, CS fundamentals, and project discussion; can happen back-to-back with no break" },
      { number: "05", label: "HR Round", hint: "Usually same day, 20–30 min — salary expectation, notice period, relocation willingness, and culture fit questions" },
    ]} />
  ),

  /* video-interview-tips-body-language-india: Setup and body language steps */
  "video-interview-tips-body-language-india||The Setup That Signals Professionalism": (
    <FrameworkSteps steps={[
      { number: "01", label: "Camera at Eye Level", hint: "Laptop on books or a stand so the camera is at eye level — looking down at the camera makes you appear condescending" },
      { number: "02", label: "Light Your Face from the Front", hint: "Place a lamp or window in front of you, not behind — backlight turns you into a silhouette on the interviewer's screen" },
      { number: "03", label: "Clean, Neutral Background", hint: "Plain wall or a tidy bookshelf; virtual backgrounds blur and distort — they signal you are hiding something or lack a suitable space" },
      { number: "04", label: "Wired Headphones for Audio", hint: "Earbuds with mic beat laptop speakers — they eliminate echo, reduce background noise, and keep audio stable throughout" },
      { number: "05", label: "Test 30 Minutes Before", hint: "Join the platform early, test camera and mic, close unnecessary apps, silence phone notifications, and have water nearby" },
    ]} />
  ),

  /* notice-period-negotiation-india-guide: Notice period negotiation steps */
  "notice-period-negotiation-india-guide||Negotiating With Your Current Employer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Request Early Relieving in Writing", hint: "Send a formal email to HR requesting early release with a specific date — oral requests are often 'forgotten'" },
      { number: "02", label: "Propose Knowledge Transfer Plan", hint: "Offer to complete handover of all critical work within a compressed timeline — employers are far more likely to agree if they see continuity" },
      { number: "03", label: "Offer Partial Buyout If Needed", hint: "Calculate your remaining notice salary and offer to pay a portion — most companies accept 50–100% of the remaining days' salary" },
      { number: "04", label: "Escalate to Manager If HR Delays", hint: "If HR is unresponsive, ask your direct manager to support the early release — manager approval carries more weight in practice" },
      { number: "05", label: "Get Release Date in Writing", hint: "Any verbal agreement means nothing — get the agreed last working date confirmed via email from HR before informing your new employer" },
    ]} />
  ),

  /* how-to-get-referral-top-indian-tech-companies: Referral outreach steps */
  "how-to-get-referral-top-indian-tech-companies||The Referral Outreach Message That Works": (
    <FrameworkSteps steps={[
      { number: "01", label: "Find the Right Person", hint: "Target someone at the same company in a similar team — LinkedIn 2nd-degree connections, alumni networks, and Twitter/X are the best sources" },
      { number: "02", label: "Personalise Before Asking", hint: "Comment on their posts or share their content for 1–2 weeks before reaching out cold — warm outreach converts 3–4x better" },
      { number: "03", label: "Lead With Value, Not Request", hint: "In your first message: mention a specific thing you admire about their work or company, then briefly introduce yourself — ask for a referral only after rapport is established" },
      { number: "04", label: "Make It Easy to Refer You", hint: "Attach your resume, the exact job link, and a 3-line summary of why you are a fit — the referrer should need zero effort beyond clicking submit" },
      { number: "05", label: "Follow Up Once, Respectfully", hint: "If no reply after 5 days, send one follow-up. If still no reply, move on — persisting further damages the relationship permanently" },
    ]} />
  ),

  /* startup-vs-mnc-india-career-choice-guide: Startup vs MNC comparison */
  "startup-vs-mnc-india-career-choice-guide||What the Comparison Actually Looks Like in 2026": (
    <TierCompare cards={[
      {
        tier: "Early-Stage Startup (Series A–B)",
        examples: "Pre-IPO fintechs · D2C brands · SaaS startups",
        rows: [
          { label: "Base Salary", range: "10–20% below market" },
          { label: "ESOP Upside", range: "High risk, high reward" },
          { label: "Learning Speed", range: "Very fast — wear many hats" },
          { label: "Job Security", range: "Low — funding-dependent" },
          { label: "Brand Value", range: "Low now, high if IPO" },
        ]
      },
      {
        tier: "Indian Product Unicorn",
        examples: "Swiggy · PhonePe · Razorpay · Meesho",
        rows: [
          { label: "Base Salary", range: "Market or above" },
          { label: "ESOP Upside", range: "Moderate — pre-IPO stage" },
          { label: "Learning Speed", range: "Fast — at scale" },
          { label: "Job Security", range: "Moderate" },
          { label: "Brand Value", range: "High in India market" },
        ]
      },
      {
        tier: "Large MNC (IT Services / Global Tech)",
        examples: "TCS · Infosys · Microsoft · Google",
        rows: [
          { label: "Base Salary", range: "Stable, defined bands" },
          { label: "ESOP Upside", range: "RSUs (listed); lower upside" },
          { label: "Learning Speed", range: "Slower — specialised" },
          { label: "Job Security", range: "High" },
          { label: "Brand Value", range: "Strong globally" },
        ]
      },
    ]} />
  ),

  /* startup-vs-mnc-india-career-choice-guide: Salary comparison */
  "startup-vs-mnc-india-career-choice-guide||Salary and Compensation Reality": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "FAANG India (SDE-2, 3–5 yrs)", min: 45, max: 80, note: "Base + RSU + bonus" },
      { role: "Indian Unicorn SDE-2 (Swiggy/PhonePe)", min: 25, max: 50, note: "Base + pre-IPO ESOPs" },
      { role: "Series A–B Startup (SDE-2)", min: 15, max: 30, note: "Base below market + ESOPs" },
      { role: "IT Services Senior Dev (5 yrs, TCS/Infosys)", min: 8, max: 18, note: "Slow increment model" },
      { role: "Fresher — Product Company", min: 10, max: 22, note: "Strong starting package" },
      { role: "Fresher — IT Services", min: 3.5, max: 7, note: "Standard market entry" },
    ]} caption="CTC ranges for Indian tech professionals in 2026. Source: Glassdoor, AmbitionBox, Levels.fyi" />
  ),

  /* gate-vs-mba-vs-ms-abroad-indian-engineers-2026: Decision framework comparison */
  "gate-vs-mba-vs-ms-abroad-indian-engineers-2026||The Decision Framework": (
    <TierCompare cards={[
      {
        tier: "GATE + M.Tech / PSU",
        examples: "IITs · NITs · BHEL · ONGC · NTPC",
        rows: [
          { label: "Total Cost", range: "₹1–5 L (IIT M.Tech)" },
          { label: "Time Investment", range: "2 years + GATE prep" },
          { label: "Salary After", range: "₹8–25 LPA (IIT) / ₹7–15 LPA (PSU)" },
          { label: "Best For", range: "Research, PSU job security" },
        ]
      },
      {
        tier: "MBA from IIM / ISB",
        examples: "IIM A/B/C · ISB Hyderabad · IIM Calcutta",
        rows: [
          { label: "Total Cost", range: "₹20–35 L (IIM A) / ₹35 L (ISB)" },
          { label: "Time Investment", range: "2 years + CAT/GMAT prep" },
          { label: "Salary After", range: "₹25–50 LPA median" },
          { label: "Best For", range: "Consulting, VC, PM, leadership" },
        ]
      },
      {
        tier: "MS Abroad (USA/Canada/Europe)",
        examples: "Carnegie Mellon · Georgia Tech · TU Munich",
        rows: [
          { label: "Total Cost", range: "₹40–90 L (USA) / ₹25–50 L (Europe)" },
          { label: "Time Investment", range: "1.5–2 years + GRE/IELTS" },
          { label: "Salary After", range: "$120–180K USD (US tech)" },
          { label: "Best For", range: "FAANG US, AI/ML specialisation" },
        ]
      },
    ]} />
  ),

  /* interview-anxiety-tips-india-2026: Managing interview anxiety */
  "interview-anxiety-tips-india-2026||The Week Before: Preparation That Reduces Anxiety": (
    <FrameworkSteps steps={[
      { number: "01", label: "Switch to Revision Mode", hint: "Stop learning new topics 5 days before — attempting new problems increases anxiety; revising familiar patterns builds confidence" },
      { number: "02", label: "Do One Full Mock Interview", hint: "Simulate the real interview: timed, camera on, whiteboard — anxious candidates who've done mocks perform measurably better on the real day" },
      { number: "03", label: "Prepare Your Logistics", hint: "Confirm venue or video link, outfit, commute route, and backup phone battery — logistical surprises on interview day amplify anxiety" },
      { number: "04", label: "Sleep 7+ Hours the Night Before", hint: "Sleep deprivation reduces working memory by 30–40% — your problem-solving speed and recall directly depend on the night before" },
      { number: "05", label: "Prepare Your 'Why' Statement", hint: "Remind yourself why you want this role — connecting to purpose reduces performance anxiety better than any tactical tip" },
    ]} />
  ),

  /* remote-jobs-india-how-to-find-2026: Compensation for remote roles */
  "remote-jobs-india-how-to-find-2026||Compensation for Remote Roles in India": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Remote US/EU employer (SDE-2, 3–5 yrs)", min: 40, max: 100, note: "USD salary, India cost base" },
      { role: "Remote Indian unicorn (SDE-2)", min: 22, max: 50, note: "Same as in-office + no commute" },
      { role: "Remote product startup India (SDE-2)", min: 15, max: 30, note: "ESOPs may supplement" },
      { role: "Remote IT services / consulting (3–5 yrs)", min: 9, max: 18, note: "WFH allowance common" },
      { role: "Fresher remote role (Indian company)", min: 5, max: 12, note: "Rare but increasing" },
    ]} caption="Remote work compensation benchmarks for Indian software engineers in 2026" />
  ),

  /* career-change-to-software-engineering-india-2026: Skill roadmap for switching */
  "career-change-to-software-engineering-india-2026||The skill roadmap for a successful switch": (
    <PrepTimeline caption="6–18 month roadmap for switching to software engineering in India" phases={[
      { period: "Month 1–2", label: "Pick Your Stack", tasks: ["Choose one language (Python for data/scripting, JavaScript for web)", "Complete one beginner course end-to-end (CS50, The Odin Project)", "Build your first project: a simple CRUD web app"], milestone: "First working project on GitHub" },
      { period: "Month 3–5", label: "Build Real Projects", tasks: ["Build 2–3 portfolio projects solving real problems from your previous domain", "Learn SQL, basic system concepts, Git workflow", "Start LeetCode easy problems — 30 problems minimum"], milestone: "Portfolio with 3 projects live" },
      { period: "Month 6–9", label: "Interview Preparation", tasks: ["DSA: arrays, strings, trees — 80–100 LeetCode medium", "Apply for junior roles and internships simultaneously", "Mock interviews via peers or AI coaching"], milestone: "First interview callbacks received" },
      { period: "Month 10–18", label: "Land the First Role", tasks: ["Apply broadly: services companies accept switchers with strong projects", "Use domain knowledge as differentiator in cover letters", "Leverage previous industry connections for referrals"], milestone: "First SWE role offer accepted" },
    ]} />
  ),

  /* internship-to-fulltime-conversion-tips-india-2026: PPO strategies */
  "internship-to-fulltime-conversion-tips-india-2026||Strategies to maximise your PPO chances": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ship Something Real in Week 1", hint: "Make your first commit to production code in the first week — interns who contribute code early are remembered as contributors, not observers" },
      { number: "02", label: "Communicate Progress Proactively", hint: "Send a short weekly update to your manager — it creates a paper trail of your impact and keeps you top of mind during PPO decisions" },
      { number: "03", label: "Ask for More Scope", hint: "Once your first task is done, ask: 'What would make this 10x better?' — interns who show initiative get extended or converted; those who wait for instructions do not" },
      { number: "04", label: "Build Relationships Beyond Your Team", hint: "Have coffee chats with senior engineers and PMs — PPO decisions sometimes require cross-team buy-in, and relationships protect you" },
      { number: "05", label: "Ask About Conversion Timeline Early", hint: "In week 6 (of a 2-month internship), ask your manager directly: 'What does a successful conversion look like here?' — clarity lets you target your remaining weeks precisely" },
    ]} />
  ),

  /* how-to-become-product-manager-india-2026: Paths to PM */
  "how-to-become-product-manager-india-2026||The main paths to PM in India": (
    <TierCompare cards={[
      {
        tier: "APM Programme (Fresh Grad)",
        examples: "Google · LinkedIn · Razorpay · Swiggy APM",
        rows: [
          { label: "Eligibility", range: "Top-tier college, 0–1 yr exp" },
          { label: "Salary", range: "₹18–40 LPA" },
          { label: "Timeline", range: "Immediate after graduation" },
          { label: "Competition", range: "Very high — 1000:1 ratio" },
        ]
      },
      {
        tier: "Engineer → PM Transition",
        examples: "Most product companies accept",
        rows: [
          { label: "Eligibility", range: "2–5 yrs SWE experience" },
          { label: "Salary", range: "₹20–45 LPA (mid PM)" },
          { label: "Timeline", range: "Internal transfer or new company" },
          { label: "Competition", range: "Moderate — unique profile" },
        ]
      },
      {
        tier: "MBA → PM (IIM/ISB)",
        examples: "Consulting, large MNCs",
        rows: [
          { label: "Eligibility", range: "IIM A/B/C or ISB grad" },
          { label: "Salary", range: "₹30–60 LPA" },
          { label: "Timeline", range: "2 yrs MBA + placement" },
          { label: "Competition", range: "High among MBA cohort" },
        ]
      },
    ]} />
  ),

  /* how-to-become-product-manager-india-2026: PM salaries */
  "how-to-become-product-manager-india-2026||Product Manager salaries in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Senior PM / Group PM (FAANG India, 7+ yrs)", min: 50, max: 80, note: "Base + RSU + bonus" },
      { role: "PM II / Senior PM (Indian unicorn, 5+ yrs)", min: 30, max: 55, note: "Pre-IPO equity common" },
      { role: "PM I / Mid PM (Indian unicorn, 3–5 yrs)", min: 18, max: 35, note: "Market-standard" },
      { role: "APM / Junior PM (0–2 yrs)", min: 12, max: 22, note: "Often post-IIM/APM programme" },
    ]} caption="PM salary benchmarks in India 2026. Source: Glassdoor, LinkedIn Salary, AmbitionBox" />
  ),

  /* open-source-contribution-india-career-2026: Steps for open source contributions */
  "open-source-contribution-india-career-2026||Where to start: projects for Indian engineers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Start With 'Good First Issue'", hint: "Filter any GitHub repo by label 'good first issue' or 'hacktoberfest' — these are explicitly maintained for newcomers and have active maintainer support" },
      { number: "02", label: "Target Repos You Already Use", hint: "Fixing bugs or improving docs in tools you use daily (React, Django, Supabase) means you already understand the codebase enough to contribute meaningfully" },
      { number: "03", label: "Fix Documentation First", hint: "Documentation PRs are accepted fastest, build your credibility with maintainers, and still appear on your GitHub contribution graph — underrated as a starting point" },
      { number: "04", label: "Join Indian Open Source Communities", hint: "GirlScript Summer of Code, FOSSASIA, and the FOSS United community in India run structured programmes with mentors — significantly easier than cold contributions" },
      { number: "05", label: "Apply to GSoC or Outreachy", hint: "Both programmes pay stipends ($1,500–$6,000) and carry significant weight on resumes — applications open December–January for the following summer" },
    ]} />
  ),

  /* first-job-india-tips-freshers-2026: First 30 days strategy */
  "first-job-india-tips-freshers-2026||The first 30 days: earn the right to be here": (
    <FrameworkSteps steps={[
      { number: "01", label: "Learn Before You Contribute", hint: "Spend the first 2 weeks reading code, documentation, and past PRs — understanding why decisions were made matters more than shipping fast" },
      { number: "02", label: "Set Up Your Development Environment", hint: "Get your local environment fully working, run the test suite, and push a small PR (even a typo fix) — this proves you can ship to production" },
      { number: "03", label: "Map the People, Not Just the Code", hint: "Identify who owns what: the PM, tech lead, QA, and on-call rotation — in Indian companies, relationships unlock resources faster than process" },
      { number: "04", label: "Over-Communicate Your Progress", hint: "Send daily Slack updates to your manager in the first month — visibility matters enormously in Indian tech culture, especially in hybrid or remote setups" },
      { number: "05", label: "Ask Questions Systematically", hint: "Batch your questions: 1 hour of research first, then ask — 'I tried X and Y; I'm stuck on Z' shows initiative and respects senior engineers' time" },
    ]} />
  ),

  /* work-life-balance-indian-tech-2026: What to ask and how to evaluate */
  "work-life-balance-indian-tech-2026||What to ask in interviews to assess work culture": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ask About On-Call Rotation", hint: "'How is on-call structured?' — whether it's paid, how frequently engineers are on-call, and whether there's compensation reveals a lot about how the company values engineer time" },
      { number: "02", label: "Ask About the Last Unplanned Weekend", hint: "'When was the last time the team worked on a weekend unexpectedly?' — the specificity of the answer reveals whether this is routine or rare" },
      { number: "03", label: "Ask How Engineers Disconnect on Vacation", hint: "'Do people fully disconnect on leave, or are they expected to be reachable?' — companies with healthy cultures answer this confidently and quickly" },
      { number: "04", label: "Check Glassdoor Reviews for Patterns", hint: "Look for recurring themes in 1-star and 2-star reviews from engineers — individual reviews may be outliers, but patterns across 20+ reviews are usually accurate" },
    ]} />
  ),

  /* how-to-read-job-description-india-2026: Resume tailoring steps */
  "how-to-read-job-description-india-2026||How to tailor your resume to a JD": (
    <FrameworkSteps steps={[
      { number: "01", label: "Highlight Keywords in the JD", hint: "Copy the JD into a doc, highlight every technical skill and tool — these exact words must appear in your resume's skills section and project bullets" },
      { number: "02", label: "Match Your Bullets to Their Priorities", hint: "The JD lists responsibilities in order of importance — reorder your resume bullets so your most relevant experience appears first in each entry" },
      { number: "03", label: "Mirror Their Language", hint: "If the JD says 'distributed systems' use that phrase, not 'scalable backend' — ATS systems do exact keyword matching, not semantic search, at many Indian companies" },
      { number: "04", label: "Add a Targeted Summary", hint: "A 2-line summary at the top that mirrors the role title and key requirements increases ATS scores and gives human reviewers immediate context" },
    ]} />
  ),

  /* data-scientist-vs-ml-engineer-india-2026: Role and salary comparison */
  "data-scientist-vs-ml-engineer-india-2026||Salaries and career paths": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "ML Engineer — FAANG India / AI Labs (5+ yrs)", min: 35, max: 70, note: "Highest compensation band" },
      { role: "ML Engineer — Indian Unicorn (3–5 yrs)", min: 20, max: 40, note: "Strong demand for production ML" },
      { role: "Data Scientist — FAANG India (4+ yrs)", min: 25, max: 55, note: "Research-heavy, PhD premium" },
      { role: "Data Scientist — Indian Unicorn (3–5 yrs)", min: 15, max: 32, note: "Analytics + modelling blend" },
      { role: "ML / DS Fresher (tier-1 college)", min: 10, max: 20, note: "Strong NLP/CV projects needed" },
      { role: "Data Analyst (analytics focus)", min: 6, max: 18, note: "Distinct from DS/MLE track" },
    ]} caption="Salary benchmarks for data science and ML roles in India 2026. Source: Glassdoor, AmbitionBox, Levels.fyi" />
  ),

  /* data-scientist-vs-ml-engineer-india-2026: Skills comparison */
  "data-scientist-vs-ml-engineer-india-2026||Skills required for each role": (
    <TierCompare cards={[
      {
        tier: "Data Scientist",
        examples: "Swiggy · Flipkart · HDFC · Accenture Analytics",
        rows: [
          { label: "Core Skill", range: "Statistics, hypothesis testing" },
          { label: "Programming", range: "Python, R, SQL" },
          { label: "ML Depth", range: "Model selection, evaluation" },
          { label: "Communication", range: "Business storytelling, dashboards" },
          { label: "Tools", range: "Jupyter, Tableau, Looker, Spark" },
        ]
      },
      {
        tier: "ML Engineer",
        examples: "Google · Sarvam · ShareChat · Meesho",
        rows: [
          { label: "Core Skill", range: "ML systems, model serving" },
          { label: "Programming", range: "Python, C++ (some roles)" },
          { label: "ML Depth", range: "MLOps, model optimisation" },
          { label: "Communication", range: "Technical design docs, APIs" },
          { label: "Tools", range: "PyTorch, Kubernetes, Airflow, Ray" },
        ]
      },
    ]} />
  ),

  /* how-to-get-shortlisted-resume-india-2026: Resume improvement framework */
  "how-to-get-shortlisted-resume-india-2026||What makes Indian resumes fail: and how to fix it": (
    <FrameworkSteps steps={[
      { number: "01", label: "Remove Objective Statements", hint: "'Seeking a challenging position...' wastes the most-read section of your resume — replace with a 2-line professional summary with your stack and years of experience" },
      { number: "02", label: "Quantify Every Bullet Point", hint: "'Improved API performance' fails; 'Reduced API latency by 40% (from 800ms to 480ms) serving 2M daily requests' is shortlist-worthy — every bullet needs a number" },
      { number: "03", label: "Fix the Skills Section", hint: "List only tools you can answer interview questions on; remove 'MS Office', 'Photoshop', and 'good communication' — they signal a low-effort resume to Indian screeners" },
      { number: "04", label: "Use Standard Section Headers", hint: "ATS at Indian companies looks for 'Work Experience', 'Education', 'Skills' — fancy headers like 'My Journey' or 'Tech Arsenal' cause ATS to skip the section entirely" },
      { number: "05", label: "Keep It to One Page (under 6 yrs)", hint: "Indian recruiters spend 10–15 seconds on a first scan — if your name and top credential are not visible immediately, the resume gets passed over" },
    ]} />
  ),

  /* devops-engineer-career-india-2026: Skills roadmap */
  "devops-engineer-career-india-2026||Skills roadmap for DevOps in India": (
    <PrepTimeline caption="DevOps career roadmap for Indian software engineers in 2026" phases={[
      { period: "Foundation (0–3 months)", label: "Linux and Scripting", tasks: ["Linux command line: processes, networking, file systems", "Bash scripting for automation", "Git workflow and branching strategies"], milestone: "Comfortable on the Linux command line" },
      { period: "Core Tools (3–6 months)", label: "Docker and CI/CD", tasks: ["Docker: build, run, compose, networking", "GitHub Actions or Jenkins for CI/CD pipelines", "Nginx and basic load balancing concepts"], milestone: "First Dockerised application deployed" },
      { period: "Cloud and Kubernetes (6–12 months)", label: "Cloud Infra", tasks: ["AWS or Azure fundamentals (VPC, EC2, S3, IAM)", "Kubernetes: pods, deployments, services, ingress", "Terraform for infrastructure as code"], milestone: "CKA or AWS Solutions Architect certification" },
      { period: "SRE / Advanced (12–24 months)", label: "Observability and SRE", tasks: ["Prometheus, Grafana, PagerDuty for monitoring", "SLOs, error budgets, and incident response", "Service mesh: Istio or Linkerd basics"], milestone: "First SRE or senior DevOps role" },
    ]} />
  ),

  /* devops-engineer-career-india-2026: Certifications */
  "devops-engineer-career-india-2026||Certifications for DevOps in India": (
    <ComparisonTable
      columns={[{ name: "Certification" }, { name: "Cost (USD)" }, { name: "Difficulty" }, { name: "Salary Impact", highlight: true }]}
      rows={[
        { label: "AWS Solutions Architect Associate", values: ["$150", "Medium", "+₹2–5 LPA typical"] },
        { label: "CKA (Certified Kubernetes Admin)", values: ["$395", "Hard", "+₹3–6 LPA for DevOps/SRE"] },
        { label: "Terraform Associate (HashiCorp)", values: ["$70", "Medium", "+₹2–4 LPA"] },
        { label: "GCP Professional Cloud Architect", values: ["$200", "Hard", "+₹3–6 LPA"] },
        { label: "Azure DevOps Expert (AZ-400)", values: ["$165", "Hard", "+₹2–5 LPA"] },
      ]}
      caption="Certification value for DevOps professionals in India 2026. Salary impacts are additive estimates, not guarantees."
    />
  ),

  /* product-manager-interview-questions-india-2026 (Career category): PM interview prep */
  "product-manager-interview-questions-india-2026||PM interview question types at Indian companies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Product Design / Sense", hint: "'Design a feature for X' — use the framework: identify users, list pain points, prioritise one, design solution, define success metric" },
      { number: "02", label: "Metrics and Analytics", hint: "'Define success for X' or 'DAU dropped 20% — investigate' — show funnel thinking: awareness → activation → retention → revenue" },
      { number: "03", label: "Estimation", hint: "'Estimate the number of food delivery orders in Mumbai daily' — structure matters more than accuracy; show your decomposition method clearly" },
      { number: "04", label: "Execution and Prioritisation", hint: "'You have 10 features, pick 3' — use ICE scoring or RICE framework; always tie back to the north star metric" },
      { number: "05", label: "Behavioural / Leadership", hint: "STAR stories for: stakeholder conflict, data-driven decision, failed launch, cross-functional influence — prepare 5 stories covering all dimensions" },
    ]} />
  ),

  /* internship-tips-india-2026: Converting internship to PPO */
  "internship-tips-india-2026||Converting your internship to a PPO": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ask About PPO Policy on Day 1", hint: "Understand the conversion rate, criteria, and timeline before you start — different companies have different PPO rates (Google: ~70%, startups: ~30%)" },
      { number: "02", label: "Ship Before Midterm Review", hint: "Have at least one merged PR or deployed feature before your midterm review — the first milestone evaluation heavily influences the final PPO decision" },
      { number: "03", label: "Exceed Your Project Scope", hint: "Deliver your assigned project, then propose one improvement beyond scope — this single action differentiates converted interns from those who are not" },
      { number: "04", label: "Get Feedback at Week 3 and Week 6", hint: "Ask your manager explicitly: 'What can I do differently to perform better?' — shows maturity and gives you time to course-correct before the final evaluation" },
      { number: "05", label: "Build Relationships With Your Skip-Level", hint: "One coffee chat with your manager's manager or another senior engineer builds the social capital that supports PPO decisions in close calls" },
    ]} />
  ),

  /* linkedin-profile-tips-indian-job-seekers-2026: LinkedIn optimisation steps */
  "linkedin-profile-tips-indian-job-seekers-2026||Skills, connections, and outreach strategy": (
    <FrameworkSteps steps={[
      { number: "01", label: "Add 5 Relevant Skills and Get Endorsed", hint: "LinkedIn's algorithm ranks profiles higher in recruiter searches when skills match the job posting — ask 2–3 former colleagues to endorse your top skills" },
      { number: "02", label: "Reach 500+ Connections", hint: "LinkedIn shows '500+' instead of the actual count above 500 — this signals an active professional and unlocks better search visibility for recruiter InMail" },
      { number: "03", label: "Turn On 'Open to Work' (Private Mode)", hint: "The private green banner is visible only to recruiters, not your current employer — it triples inbound recruiter messages without revealing your job search" },
      { number: "04", label: "Post One Piece of Content Per Month", hint: "Even one technical post per month (a problem you solved, a lesson learned) increases profile views 4–8x — Indian recruiters actively check recent activity" },
      { number: "05", label: "Send 5 Connection Requests Per Week With a Note", hint: "Add a personalised note: 'I noticed you work on payments infrastructure at Razorpay — I'm building in that space too' — acceptance rate jumps from 30% to 60%+" },
    ]} />
  ),

  /* campus-placement-preparation-guide-india-2026: Month-by-month preparation */
  "campus-placement-preparation-guide-india-2026||Month-by-month preparation plan": (
    <PrepTimeline caption="Month-by-month campus placement preparation roadmap — 2026 batch" phases={[
      { period: "Jan–Mar (6th Sem)", label: "Build Technical Foundation", tasks: ["Start DSA on LeetCode — target 50 easy problems", "Learn one project framework (React, Django, Spring Boot)", "Draft your first resume"], milestone: "Resume ready with 1–2 projects" },
      { period: "Apr–Jun (Summer)", label: "Internship or Intensive DSA", tasks: ["Prioritise internship for PPO opportunity", "Without internship: 150+ LeetCode medium problems", "Complete DBMS, OS, CN syllabus once"], milestone: "200+ LeetCode problems solved" },
      { period: "Jul–Sep (7th Sem)", label: "Aptitude and GD Prep", tasks: ["Aptitude test practice: IndiaBix, PrepInsta", "GD practice weekly with peers on current topics", "Mock interviews at college placement cell"], milestone: "Aptitude test score: 80%+" },
      { period: "Oct–Dec (Peak Season)", label: "Active Placement Drive", tasks: ["Apply to every company shortlisting your branch", "Debrief each interview immediately", "Don't decline offers until you have a better one in hand"], milestone: "Placement offer confirmed" },
    ]} />
  ),

  /* internship-interview-tips-india-2026: Internship hiring timeline */
  "internship-interview-tips-india-2026||The Internship Hiring Timeline in India": (
    <PrepTimeline caption="When Indian companies open internship applications in 2026" phases={[
      { period: "Aug–Sep", label: "Dream Company Applications", tasks: ["Google STEP, Microsoft Engage open", "Apply immediately — slots fill in weeks", "Prepare DSA now: these require strong coding skills"], milestone: "Applications submitted to Tier-1 companies" },
      { period: "Oct–Nov", label: "On-Campus Recruitment", tasks: ["Company PPTs and shortlists announced on campus", "Aptitude tests run in batches", "Technical and HR interviews same day or next day"], milestone: "First internship offer in hand" },
      { period: "Dec–Jan", label: "Off-Campus and Startups", tasks: ["LinkedIn, Internshala, Unstop for off-campus", "Startup internships often open year-round", "Apply even without referral — conversion is higher in winter"], milestone: "2–3 backup options secured" },
      { period: "Feb–Apr", label: "Last-Mile and PPO Focus", tasks: ["Any remaining off-campus opportunities", "Current interns: focus on shipping to maximize PPO odds", "Prepare for summer internship conversion discussions"], milestone: "Internship secured" },
    ]} />
  ),

  /* first-job-tips-for-software-engineers-india-2026: 90-day plan */
  "first-job-tips-for-software-engineers-india-2026||The First 90 Days: What to Prioritise": (
    <PrepTimeline caption="First 90 days as a software engineer at an Indian tech company" phases={[
      { period: "Days 1–30", label: "Learn and Listen", tasks: ["Set up dev environment, read the codebase", "Ship one small bug fix or improvement to production", "Meet your manager, team lead, and cross-functional partners"], milestone: "First PR merged to production" },
      { period: "Days 31–60", label: "Contribute and Ask", tasks: ["Own one feature end-to-end from design to deploy", "Ask questions proactively but research first", "Build relationships with at least 3 senior engineers"], milestone: "Feature shipped with your name on it" },
      { period: "Days 61–90", label: "Extend Your Scope", tasks: ["Propose an improvement to an existing system or process", "Give your first internal tech talk or demo", "Have a career conversation with your manager: 'What does success look like here?'"], milestone: "Recognized as a contributing team member" },
    ]} />
  ),

  /* first-job-tips-for-software-engineers-india-2026: Setting up for first promotion */
  "first-job-tips-for-software-engineers-india-2026||Setting Up for Your First Promotion in 18–24 Months": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the Promotion Criteria", hint: "Ask your manager in month 3: 'What does the next level look like?' — at most Indian tech companies, promotion criteria are not published; you must ask" },
      { number: "02", label: "Keep a Brag Document", hint: "Log every contribution weekly: features shipped, bugs fixed, learnings shared — at appraisal time, you cannot recall 18 months of work from memory" },
      { number: "03", label: "Increase Your Surface Area", hint: "Take on work that crosses team boundaries — cross-functional impact is the single strongest signal of readiness for the next level at Indian product companies" },
      { number: "04", label: "Find a Senior Mentor", hint: "One mentor 1–2 levels above you who has been recently promoted is more valuable than any course — they know exactly what the company rewards" },
      { number: "05", label: "Initiate the Promotion Conversation", hint: "At your 12-month mark, ask your manager: 'Am I on track for promotion?' — managers at Indian companies rarely volunteer this information unprompted" },
    ]} />
  ),

  /* remote-job-interview-tips-india-2026: Remote interview steps */
  "remote-job-interview-tips-india-2026||Video Interview Setup: The Basics That Are Not Obvious": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ethernet Over Wi-Fi", hint: "A wired internet connection eliminates 90% of video call disconnection issues — if Wi-Fi is your only option, sit as close to the router as possible and close other devices" },
      { number: "02", label: "Camera at Eye Level", hint: "Propping your laptop on books so the webcam is at eye level makes the conversation feel natural — looking down creates a power imbalance in the interviewer's perception" },
      { number: "03", label: "Front Lighting, Not Back", hint: "Place a desk lamp or sit facing a window — backlit faces show poorly and signal poor setup preparation to technical interviewers who care about such details" },
      { number: "04", label: "Silence the Room for 30 Minutes", hint: "Alert household members, silence all phones, close doors — background noise in Indian home setups (traffic, AIR conditioning, family) is the most common remote interview complaint" },
      { number: "05", label: "Have a Backup Ready", hint: "Keep your phone with the interview link and your hotspot ready — if your internet drops, you can rejoin in under 60 seconds rather than scrambling to explain a 5-minute delay" },
    ]} />
  ),

  /* resume-ats-optimisation-india-2026: ATS optimisation steps */
  "resume-ats-optimisation-india-2026||Keyword Optimisation: How to Match the Job Description": (
    <FrameworkSteps steps={[
      { number: "01", label: "Copy the JD and Highlight Keywords", hint: "Every technical skill, tool, and verb that appears in the JD is a potential ATS keyword — highlight them all before editing your resume" },
      { number: "02", label: "Mirror Exact Phrases", hint: "If the JD says 'RESTful APIs', use that exact phrase — ATS at Indian companies uses keyword matching, not semantic search, and 'REST endpoints' may not match" },
      { number: "03", label: "Weight the Top Half of the Resume", hint: "ATS systems weight keywords that appear higher in the document more heavily — ensure your most relevant skills and technologies appear in the first half of your resume" },
      { number: "04", label: "Add a Skills Section with Exact Keywords", hint: "A dedicated skills section lets you place all technical keywords in one scannable location — many Indian ATS systems prioritise this section" },
      { number: "05", label: "Avoid Images, Tables, and Columns", hint: "Many ATS systems used by Indian companies (Naukri, iRecruiter, SAP SuccessFactors) cannot parse text inside tables or columns — use plain single-column formatting" },
    ]} />
  ),

  /* after-interview-rejection-india-2026: Systematic improvement after rejection */
  "after-interview-rejection-india-2026||Systematic Improvement After Rejection": (
    <FrameworkSteps steps={[
      { number: "01", label: "Debrief Within 24 Hours", hint: "Write down every question you were asked and how you answered — memory fades fast; this log is your most valuable preparation asset for the next interview" },
      { number: "02", label: "Categorise the Gap", hint: "Was the rejection due to DSA, system design, behavioral, or cultural fit? — each category requires a completely different response in your preparation" },
      { number: "03", label: "Request Feedback (Worth Trying)", hint: "Email the recruiter: 'Would you be able to share any areas where I could improve?' — Indian companies rarely give detailed feedback, but some recruiters do, and it costs you nothing to ask" },
      { number: "04", label: "Solve the Specific Problem Type That Failed You", hint: "If you struggled with dynamic programming, solve 20 DP problems before your next interview — targeted practice on your specific weak area is more efficient than general revision" },
      { number: "05", label: "Apply to the Same Company Again (6 months later)", hint: "Most Indian companies allow re-application after 6 months — candidates who return with improved skills are often viewed favourably as persistent and growth-oriented" },
    ]} />
  ),

  /* background-verification-india-2026: BGV preparation steps */
  "background-verification-india-2026||How to Prepare Your Documents": (
    <FrameworkSteps steps={[
      { number: "01", label: "Collect All Experience and Relieving Letters", hint: "Obtain formal experience letters and relieving letters from every employer — HR departments close and companies shut down; collect these within 30 days of leaving any role" },
      { number: "02", label: "Verify Dates Match Your Resume Exactly", hint: "A 1-month mismatch between your resume dates and official records is flagged as a discrepancy — cross-check every joining and last working date before submitting BGV documents" },
      { number: "03", label: "Get Education Documents Verified", hint: "Obtain official marksheets, degree certificates, and provisional certificates from your university — BGV firms contact universities directly, so ensure your records are updated there" },
      { number: "04", label: "Prepare for Reference Checks", hint: "Inform at least 2 former managers that they may receive a BGV call — they should be prepared to confirm your role, tenure, and performance without hesitation" },
      { number: "05", label: "Disclose Any Issues Proactively", hint: "If there is a genuine discrepancy (short tenure not on resume, a gap, a title mismatch), disclose it to HR before BGV starts — early disclosure is treated very differently from a discovered discrepancy" },
    ]} />
  ),

  /* offer-letter-red-flags-india-2026: CTC vs take-home comparison */
  "offer-letter-red-flags-india-2026||CTC vs Take-Home: Understanding the Full Package": (
    <ComparisonTable
      columns={[{ name: "CTC Component" }, { name: "% of CTC (typical)" }, { name: "Actually Received?", highlight: true }, { name: "Watch Out For" }]}
      rows={[
        { label: "Basic Salary", values: ["30–40%", "Yes, monthly", "Basis for PF, HRA calculation"] },
        { label: "HRA", values: ["40–50% of Basic", "Yes, monthly (partly tax-free)", "Must be reasonable for city"] },
        { label: "Special Allowance", values: ["Remainder of monthly", "Yes, monthly (taxable)", "Often used to inflate CTC"] },
        { label: "Variable / Performance Bonus", values: ["10–30% of CTC", "Conditional on targets", "Not guaranteed; check payout history"] },
        { label: "Gratuity", values: ["4.8% of basic", "Only after 5 years", "Zero value if you leave before 5 yrs"] },
        { label: "Employer PF", values: ["12% of basic", "Goes to PF account", "Not spendable monthly salary"] },
      ]}
      caption="CTC components commonly seen in Indian tech offer letters. Always calculate your monthly in-hand before accepting."
    />
  ),

  /* communication-skills-for-indian-engineers-2026: Structuring technical explanations */
  "communication-skills-for-indian-engineers-2026||Structuring Technical Explanations": (
    <FrameworkSteps steps={[
      { number: "01", label: "Bottom Line Up Front (BLUF)", hint: "State your conclusion first, then your reasoning — Indian engineers often give context first and conclusion last, which frustrates stakeholders who need a quick answer" },
      { number: "02", label: "Use the Pyramid Principle", hint: "Main point → 2–3 supporting reasons → 1 example each — this structure works equally well in emails, Slack messages, and verbal presentations" },
      { number: "03", label: "Replace Jargon With Outcomes", hint: "Instead of 'we refactored the monolith to microservices', say 'we restructured the system so the payments team can deploy independently — reducing their release time from 2 weeks to 2 days'" },
      { number: "04", label: "Pause After Each Key Point", hint: "Indian engineers often speak in long unbroken sentences — pause after each key point, make eye contact (or wait for acknowledgment in writing), then continue" },
      { number: "05", label: "Close With Action, Not Summary", hint: "End any technical explanation with: 'I'd like to do X — do I have your go-ahead?' — stakeholders remember what they were asked to do, not technical details" },
    ]} />
  ),

  /* data-science-career-india-2026: How to get first DS job */
  "data-science-career-india-2026||How to Get Your First Data Science Job in India": (
    <PrepTimeline caption="Roadmap to first data science job in India for engineers and graduates" phases={[
      { period: "Month 1–2", label: "Learn the Essentials", tasks: ["Python: pandas, NumPy, matplotlib", "Statistics: distributions, hypothesis testing, p-values", "SQL: joins, aggregations, window functions"], milestone: "Complete one Kaggle dataset end-to-end" },
      { period: "Month 3–4", label: "Build ML Fundamentals", tasks: ["Supervised learning: linear/logistic regression, decision trees, random forest", "Model evaluation: precision, recall, AUC-ROC", "Feature engineering and cross-validation"], milestone: "3 Kaggle competitions participated in" },
      { period: "Month 5–6", label: "Build Portfolio Projects", tasks: ["1 end-to-end project from raw data to deployed API", "Document methodology clearly on GitHub", "Share findings on LinkedIn or Medium"], milestone: "Portfolio with 2–3 projects public on GitHub" },
      { period: "Month 7+", label: "Apply and Iterate", tasks: ["Apply to analytics engineer roles (easier entry than 'Data Scientist')", "Use domain background as differentiator (finance/healthcare/retail)", "Practice SQL and Python take-home tests"], milestone: "First DS or analytics role offer" },
    ]} />
  ),

  /* how-to-get-referral-job-india-2026: Referral outreach steps */
  "how-to-get-referral-job-india-2026||How to Ask for a Referral (Templates That Work)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Connect First, Request Later", hint: "Send a connection request with a genuine note about their work — wait 3–5 days for them to accept before asking for anything" },
      { number: "02", label: "Open With Specific Context", hint: "Mention the exact role and why their team or company appeals to you specifically — generic referral requests are ignored; specific ones show you've done your homework" },
      { number: "03", label: "Provide Everything They Need", hint: "Include: your resume, the job link, a 3-sentence summary of your fit, and confirmation you've already applied — make the referral a one-click action for them" },
      { number: "04", label: "Keep It Short (Under 150 Words)", hint: "Long messages don't get read on LinkedIn — 3 paragraphs: who you are, what you want, why them specifically — everything else in the attached resume" },
      { number: "05", label: "Thank Them Regardless of Outcome", hint: "A genuine thank-you after the process (whether you got the job or not) builds long-term goodwill — referrers often refer the same person to multiple opportunities over a career" },
    ]} />
  ),

  /* career-in-cloud-computing-india-2026: Cloud certifications that matter */
  "career-in-cloud-computing-india-2026||Cloud Certifications That Matter in India": (
    <ComparisonTable
      columns={[{ name: "Certification" }, { name: "Provider" }, { name: "Cost (USD)" }, { name: "Salary Impact in India", highlight: true }]}
      rows={[
        { label: "AWS Solutions Architect Associate", values: ["Amazon", "$150", "+₹3–6 LPA common"] },
        { label: "AWS Solutions Architect Professional", values: ["Amazon", "$300", "+₹5–10 LPA for senior roles"] },
        { label: "GCP Professional Cloud Architect", values: ["Google", "$200", "+₹4–8 LPA"] },
        { label: "Azure Administrator (AZ-104)", values: ["Microsoft", "$165", "+₹3–5 LPA in BFSI/enterprise"] },
        { label: "Kubernetes CKA", values: ["CNCF", "$395", "+₹4–7 LPA for DevOps/cloud"] },
        { label: "Terraform Associate", values: ["HashiCorp", "$70", "+₹2–4 LPA"] },
      ]}
      caption="Certification value for cloud engineering roles in India 2026. Salary impacts are additive estimates based on market data."
    />
  ),

  /* career-in-cloud-computing-india-2026: Salary */
  "career-in-cloud-computing-india-2026||Cloud Engineer Salary in India 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "Cloud Architect (8+ yrs, FAANG / Consulting)", min: 35, max: 60, note: "AWS/GCP specialty + leadership" },
      { role: "Senior Cloud Engineer (5+ yrs)", min: 22, max: 40, note: "Multi-cloud + IaC expertise" },
      { role: "Cloud Engineer (3–5 yrs)", min: 12, max: 25, note: "AWS or Azure certified" },
      { role: "Cloud Engineer (1–2 yrs, fresher certified)", min: 6, max: 14, note: "Entry-level, mostly IT services" },
    ]} caption="Cloud engineering salary benchmarks in India 2026. Source: Glassdoor, Naukri, AmbitionBox" />
  ),

  /* coding-bootcamp-india-2026: Major Indian bootcamps comparison */
  "coding-bootcamp-india-2026||Major Indian Bootcamps Compared": (
    <TierCompare cards={[
      {
        tier: "Upskilling Platforms (Self-Paced)",
        examples: "Scaler · upGrad · GUVI · Simplilearn",
        rows: [
          { label: "Cost", range: "₹1–3 L (ISA or upfront)" },
          { label: "Duration", range: "6–18 months" },
          { label: "Placement Support", range: "Strong (Scaler especially)" },
          { label: "Best For", range: "Working professionals, self-motivated" },
          { label: "Risk", range: "ISA locks you in — read terms carefully" },
        ]
      },
      {
        tier: "Bootcamp-Style Programmes",
        examples: "Masai School · Newton School · Coding Ninja",
        rows: [
          { label: "Cost", range: "₹1–2 L (ISA common)" },
          { label: "Duration", range: "4–9 months, intensive" },
          { label: "Placement Support", range: "Moderate; varies by batch" },
          { label: "Best For", range: "Career changers, freshers without placement" },
          { label: "Risk", range: "Placement rates vary significantly" },
        ]
      },
      {
        tier: "College PG Diploma",
        examples: "IIT Madras · BITS Pilani · IIIT Hyderabad",
        rows: [
          { label: "Cost", range: "₹1–3 L" },
          { label: "Duration", range: "1 year part-time or full-time" },
          { label: "Placement Support", range: "Institutional brand helps" },
          { label: "Best For", range: "Those who want a college credential" },
          { label: "Risk", range: "Curriculum can lag industry" },
        ]
      },
    ]} />
  ),

  /* engineering-manager-vs-staff-engineer-india-2026: Role and salary comparison */
  "engineering-manager-vs-staff-engineer-india-2026||Salary Comparison: EM vs Staff Engineer in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Director of Engineering / Principal (10+ yrs, FAANG)", min: 60, max: 80, note: "Top of IC and EM bands converge" },
      { role: "Engineering Manager (7+ yrs, Indian unicorn)", min: 35, max: 60, note: "Includes team scope premium" },
      { role: "Staff Engineer (7+ yrs, Indian unicorn)", min: 32, max: 58, note: "Comparable to EM band at most companies" },
      { role: "Senior EM / Engineering Manager (5–7 yrs, FAANG India)", min: 40, max: 70, note: "Bonus + RSU + base" },
      { role: "Staff Engineer (5–7 yrs, FAANG India)", min: 38, max: 65, note: "Technical leadership premium" },
    ]} caption="Engineering Manager vs Staff Engineer salary comparison for India 2026. Source: Glassdoor, Levels.fyi, AmbitionBox" />
  ),

  /* engineering-manager-vs-staff-engineer-india-2026: Transition framework */
  "engineering-manager-vs-staff-engineer-india-2026||Making the Transition from Senior Engineer": (
    <TierCompare cards={[
      {
        tier: "→ Engineering Manager Path",
        examples: "Team Lead → EM → Senior EM",
        rows: [
          { label: "Key Signal", range: "You energise when solving people problems" },
          { label: "First Step", range: "Volunteer to onboard / mentor junior engineers" },
          { label: "Skills to Build", range: "1:1s, performance reviews, roadmap planning" },
          { label: "Risk", range: "Harder to return to IC track after 3+ yrs as EM" },
        ]
      },
      {
        tier: "→ Staff Engineer Path",
        examples: "Senior SWE → Tech Lead → Staff → Principal",
        rows: [
          { label: "Key Signal", range: "You energise when solving large technical problems" },
          { label: "First Step", range: "Own a cross-team technical initiative" },
          { label: "Skills to Build", range: "System design, technical strategy, influence without authority" },
          { label: "Risk", range: "Staff roles are fewer than EM roles; competition higher" },
        ]
      },
    ]} />
  ),

  /* esop-equity-india-tech-startups-2026: How ESOPs work */
  "esop-equity-india-tech-startups-2026||How ESOPs Work in Indian Startups": (
    <FrameworkSteps steps={[
      { number: "01", label: "Grant and Vesting Schedule", hint: "ESOPs are granted on joining but vest over 4 years (typically 25% at 1-year cliff, then monthly) — you earn the right to options, not shares themselves" },
      { number: "02", label: "Strike Price", hint: "Your strike price is the price at which you can buy shares — if the company's valuation grows, the gap between strike price and current value is your potential gain" },
      { number: "03", label: "Exercise Window", hint: "When you leave, Indian startups typically give you 30–90 days to exercise vested options by paying the strike price — after that window closes, unvested options are forfeited" },
      { number: "04", label: "Liquidity Event", hint: "ESOPs only convert to cash at an IPO, acquisition, or secondary sale — until then, they are paper value only; Indian startup IPO timelines are 5–10 years typically" },
      { number: "05", label: "Perquisite Tax on Exercise", hint: "When you exercise options in India, you pay income tax on the fair value minus strike price as perquisite income — consult a CA before exercising large grants" },
    ]} />
  ),

  /* getting-promotion-india-tech-2026: Promotion framework */
  "getting-promotion-india-tech-2026||How Promotion Decisions Actually Work": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the Calibration Process", hint: "Promotions at Indian product companies are decided in calibration meetings where managers advocate for their reports — your manager's ability to articulate your impact is as important as the impact itself" },
      { number: "02", label: "Operate at the Next Level for 6 Months", hint: "The standard bar at most Indian companies is: demonstrate next-level performance for two consecutive review cycles before being considered — start early, not at review time" },
      { number: "03", label: "Build Cross-Team Visibility", hint: "Calibration panels include managers from other teams — one project that another team's manager knows about is worth more than three projects only your manager knows about" },
      { number: "04", label: "Collect Written Evidence", hint: "Compile your brag document: shipped features with metrics, positive feedback from stakeholders, mentorship contributions — bring this data to your promotion conversation" },
      { number: "05", label: "Have the Direct Conversation", hint: "Ask your manager explicitly: 'Am I being considered for promotion this cycle? What specifically do I need to show?' — indirect hints do not work in Indian corporate culture" },
    ]} />
  ),

  /* tech-layoff-india-2026-what-to-do: Re-entering the job market */
  "tech-layoff-india-2026-what-to-do||Re-entering the Job Market": (
    <PrepTimeline caption="Job search roadmap after a tech layoff in India 2026" phases={[
      { period: "Week 1–2", label: "Stabilise and Plan", tasks: ["File for severance and ensure F&F settlement is documented", "Update LinkedIn and turn on 'Open to Work'", "Reach out to your network — announce you're available (without shame)"], milestone: "LinkedIn updated; network alerted" },
      { period: "Week 3–6", label: "Refresh and Apply", tasks: ["Update resume with quantified achievements from last role", "Apply to 10–15 roles per week; prioritise referrals", "Start DSA revision if targeting product companies"], milestone: "First interview callbacks received" },
      { period: "Month 2–3", label: "Interview and Negotiate", tasks: ["Run 5–10 interviews in parallel to maintain leverage", "Do not disclose severance to new employer — it is confidential", "Use competing offers to negotiate better packages"], milestone: "Offer letter in hand" },
      { period: "Month 3+", label: "If Search Is Long", tasks: ["Consider contract or freelance work to maintain income and freshness on resume", "Upskill in a high-demand area (cloud, ML, GenAI)", "Explore adjacent roles: DevOps if SWE, Analytics if backend"], milestone: "New role started" },
    ]} />
  ),

  /* salary-structure-india-tech-2026: CTC anatomy */
  "salary-structure-india-tech-2026||CTC Anatomy: Real Cash vs Non-Cash": (
    <ComparisonTable
      columns={[{ name: "Component" }, { name: "Monthly Cash?" }, { name: "Tax Treatment" }, { name: "Real Value", highlight: true }]}
      rows={[
        { label: "Basic Salary", values: ["Yes", "Fully taxable", "High — drives HRA and PF"] },
        { label: "HRA (House Rent Allowance)", values: ["Yes", "Partly tax-exempt (if renting)", "High if you pay rent in a metro"] },
        { label: "LTA (Leave Travel Allowance)", values: ["Yes (if claimed)", "Tax-exempt 2x in 4-yr block", "Medium — useful but conditional"] },
        { label: "Special Allowance", values: ["Yes", "Fully taxable", "Medium — CTC filler"] },
        { label: "Performance Variable", values: ["Quarterly/Annual", "Taxable on receipt", "Low if not historically paid out at 100%"] },
        { label: "Gratuity", values: ["No (accrual)", "Tax-exempt after 5 yrs", "Zero if you leave before 5 years"] },
        { label: "ESOPs / RSUs", values: ["No (equity)", "Perquisite tax on exercise", "High upside, illiquid until event"] },
      ]}
      caption="How CTC components translate to actual take-home pay in India. Always calculate monthly in-hand before accepting any offer."
    />
  ),

  /* remote-jobs-india-it-2026: Types of remote work */
  "remote-jobs-india-it-2026||Types of Remote IT Work Available in India": (
    <TierCompare cards={[
      {
        tier: "Full Remote — India Company",
        examples: "Zoho · Zerodha · some startups",
        rows: [
          { label: "Salary", range: "Same as in-office (market rate)" },
          { label: "Tools Used", range: "Slack, Zoom, Jira" },
          { label: "Stability", range: "High — regular employment" },
          { label: "Availability", range: "Limited — most Indian companies prefer hybrid" },
        ]
      },
      {
        tier: "Full Remote — Foreign Employer",
        examples: "US/EU startups, remote-first companies",
        rows: [
          { label: "Salary", range: "₹40–100+ LPA in USD/EUR" },
          { label: "Tools Used", range: "Linear, Notion, Loom, async-first" },
          { label: "Stability", range: "Moderate — contractor or FTE" },
          { label: "Availability", range: "Growing — Toptal, Remote.com, Deel" },
        ]
      },
      {
        tier: "Hybrid (2–3 days/week office)",
        examples: "Most Indian unicorns post-2024",
        rows: [
          { label: "Salary", range: "Full market rate" },
          { label: "Tools Used", range: "Mix of in-person and Zoom" },
          { label: "Stability", range: "High — most common in India" },
          { label: "Availability", range: "Widely available at most product companies" },
        ]
      },
    ]} />
  ),

  /* ── Freshers & HR ── */
  /* behavioral-interview-questions-freshers: STAR method + fresher salary ladder */
  "behavioral-interview-questions-freshers||The STAR Method for Freshers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Situation", hint: "Set the context in 1-2 sentences — college project, internship, or hackathon" },
      { number: "02", label: "Task", hint: "What was your specific responsibility or the problem you had to solve?" },
      { number: "03", label: "Action", hint: "What steps did YOU personally take? Use 'I', not 'we'" },
      { number: "04", label: "Result", hint: "Quantify impact — marks saved, time cut, team size, or recognition received" },
    ]} />
  ),
  "behavioral-interview-questions-freshers||Top 10 Questions for TCS/Infosys/Wipro": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "TCS (Ninja / Digital)", min: 3.36, max: 7, note: "Ninja 3.36 LPA · Digital 7 LPA" },
      { role: "Infosys (SE / SP)", min: 3.6, max: 9, note: "SE 3.6 LPA · SP 9 LPA" },
      { role: "Wipro (NTH / Elite)", min: 3.5, max: 6.5, note: "NTH 3.5 LPA · Elite 6.5 LPA" },
      { role: "HCL (Graduate Trainee)", min: 3.5, max: 5, note: "GEP 3.5 LPA · Tech Bee 5 LPA" },
      { role: "Cognizant (GenC / Elevate)", min: 4, max: 9, note: "GenC 4 LPA · GenC Elevate 9 LPA" },
    ]} caption="Service IT fresher packages 2026 — varies by track and test score" />
  ),

  /* group-discussion-topics-campus-placement-2026: GD evaluation framework */
  "group-discussion-topics-campus-placement-2026||GD Scoring Framework: What Assessors Actually Watch": (
    <FrameworkSteps steps={[
      { number: "01", label: "Content Quality", hint: "Relevant facts, logical arguments, and awareness of current affairs" },
      { number: "02", label: "Communication", hint: "Clarity, pace, and vocabulary — avoid filler words like 'basically' and 'you know'" },
      { number: "03", label: "Listening", hint: "Build on others' points, avoid repeating what was said, acknowledge good arguments" },
      { number: "04", label: "Leadership", hint: "Steer the group, invite quieter members, redirect off-topic tangents" },
      { number: "05", label: "Team Behaviour", hint: "Never talk over others, support strong points from peers, stay calm under pressure" },
    ]} />
  ),
  "group-discussion-topics-campus-placement-2026||How to Open, Support, and Close a GD": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open confidently", hint: "State the topic definition and give a 1-sentence context before stating your stance" },
      { number: "02", label: "Support with data", hint: "Quote a stat or cite a policy — '74% of India's internet users access via mobile…'" },
      { number: "03", label: "Handle opposition", hint: "Say 'That's a valid concern, however…' — never 'You are wrong'" },
      { number: "04", label: "Re-enter gracefully", hint: "Wait for a pause, say 'I'd like to add to [Name]'s point…' and contribute" },
      { number: "05", label: "Close with a summary", hint: "Summarise 2-3 key points from all sides and give a balanced conclusion in 30 seconds" },
    ]} />
  ),

  /* capgemini-interview-questions-freshers-2026: round flow + salary */
  "capgemini-interview-questions-freshers-2026||The Four-Round Capgemini Fresher Process": (
    <RoundFlow rounds={[
      { label: "IntelliAdapt Online Test", duration: "2.5 hrs", detail: "Adaptive aptitude: quant, verbal, logical reasoning, and pseudocode — difficulty adjusts to your answers" },
      { label: "Essay Writing", duration: "20 min", detail: "One essay on a given topic — tests communication and structure, not creative writing" },
      { label: "Technical Interview", duration: "30-45 min", detail: "Core CS: OOP, DBMS, OS, data structures, and 1-2 coding questions in any language" },
      { label: "HR Interview", duration: "20-30 min", detail: "Bond confirmation (12 months), relocation discussion, 'Tell me about yourself', and career goals" },
    ]} />
  ),
  "capgemini-interview-questions-freshers-2026||Salary and Job Offer": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "Analyst (A2 Band) — Standard", min: 4, max: 4.2, note: "Most fresher offers — 12-month bond" },
      { role: "Senior Analyst (A3) — Fast Track", min: 6.5, max: 7, note: "High IntelliAdapt scorers, 1-year bond" },
      { role: "Specialist (A4) — Tech for Change", min: 8, max: 9, note: "Niche tech tracks (Cloud, Cyber, AI) — limited seats" },
    ]} caption="Capgemini fresher CTC bands 2026 — take-home is ~65-70% of CTC" />
  ),

  /* ltimindtree-interview-questions-freshers-2026: round flow + salary */
  "ltimindtree-interview-questions-freshers-2026||The Three-Round LTIMindtree Fresher Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "2 hrs", detail: "Coding (2 problems, medium difficulty), aptitude, and verbal ability — proctored via HackerEarth" },
      { label: "Technical Interview", duration: "45 min", detail: "DSA discussion, OOP concepts, project walkthrough, DBMS basics — code on whiteboard or editor" },
      { label: "HR Interview", duration: "20 min", detail: "Bond (1 year, ~₹75,000 buyout), relocation, background details, and motivation questions" },
    ]} />
  ),
  "ltimindtree-interview-questions-freshers-2026||Salary and Bond Terms": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "Junior Engineer (JE) — Standard", min: 5.5, max: 6, note: "1-year bond, most campus hires" },
      { role: "Engineer — Niche Track", min: 8, max: 10, note: "Cloud, Data, or Cyber specialisation" },
      { role: "Associate Engineer — Off-Campus", min: 5, max: 5.5, note: "Referral or off-campus lateral fresher" },
    ]} caption="LTIMindtree fresher CTC 2026 — bond buyout ~₹75,000 if leaving before 1 year" />
  ),

  /* tech-mahindra-interview-questions: round flow + salary */
  "tech-mahindra-interview-questions||Tech Mahindra Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "SmartHire / AMCAT Test", duration: "2 hrs", detail: "Aptitude (quant + verbal + logical), coding (1-2 easy problems), and English communication" },
      { label: "Technical Interview", duration: "30-45 min", detail: "OOP, DBMS, OS basics, data structures, and project-based questions" },
      { label: "HR Interview", duration: "20-30 min", detail: "Bond agreement (1 year), relocation confirmation, 'Tell me about yourself', strengths/weaknesses" },
    ]} />
  ),
  "tech-mahindra-interview-questions||Tech Mahindra Salary 2026: ELP vs Digital Track": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "ELP (Entry Level Programme)", min: 3.25, max: 3.75, note: "Standard mass hiring track" },
      { role: "Digital Track", min: 5, max: 7, note: "Cloud, AI/ML, Cybersecurity specialism" },
      { role: "DIGI / TURBO (top scorers)", min: 7, max: 10, note: "Highest aptitude + coding scorers" },
    ]} caption="Tech Mahindra fresher CTC 2026 — 1-year bond applies on ELP track" />
  ),

  /* mphasis-interview-questions-freshers-2026: round flow + salary */
  "mphasis-interview-questions-freshers-2026||Mphasis Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "AMCAT Online Assessment", duration: "2 hrs", detail: "Quantitative aptitude, logical reasoning, verbal English, and coding — standard AMCAT platform" },
      { label: "Technical Interview", duration: "30-45 min", detail: "Core CS (OOP, DBMS, OS), basic coding in Java/Python/C++, and resume/project discussion" },
      { label: "HR Round", duration: "20-25 min", detail: "Cultural fit, relocation, bond terms (1 year), joining timeline, and salary expectations" },
    ]} />
  ),
  "mphasis-interview-questions-freshers-2026||HR Round and What Sets Mphasis Apart": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "Software Engineer — Standard", min: 4, max: 4.5, note: "Campus hire, 1-year bond" },
      { role: "Next Varsity Programme", min: 5, max: 6, note: "Selected campuses, higher CTC" },
      { role: "Digital / Cloud Track", min: 7, max: 9, note: "Specialisation in cloud or data engineering" },
    ]} caption="Mphasis fresher CTC 2026 — known for smaller batch sizes and faster project allocation" />
  ),

  /* off-campus-placement-guide-freshers-india-2026: framework steps */
  "off-campus-placement-guide-freshers-india-2026||How Off-Campus Selection Differs from Campus": (
    <FrameworkSteps steps={[
      { number: "01", label: "No placement officer safety net", hint: "You apply directly — 100% self-driven, no college shortlisting or scheduling support" },
      { number: "02", label: "ATS screening first", hint: "Resume goes through automated filtering before any human sees it — keyword optimisation is critical" },
      { number: "03", label: "Higher baseline expectations", hint: "Off-campus roles often require a portfolio, GitHub, or internship experience to pass CV screening" },
      { number: "04", label: "Longer process, less predictable", hint: "Off-campus cycles can take 4-12 weeks with no fixed season — track every application in a sheet" },
      { number: "05", label: "Negotiation room exists", hint: "Unlike campus packages, off-campus offers are often negotiable by 10-20% with a competing offer" },
    ]} />
  ),

  /* aptitude-questions-it-companies-india-2026: company comparison + prep plan */
  "aptitude-questions-it-companies-india-2026||Aptitude Test Format by Company": (
    <ComparisonTable
      columns={[
        { name: "Company" },
        { name: "Platform" },
        { name: "Duration" },
        { name: "Sections", highlight: true },
        { name: "Coding?" },
      ]}
      rows={[
        { label: "TCS (NQT)", values: ["TCS iON", "120 min", "Verbal + Numeric + Reasoning + Coding", "Yes (2 Qs)"] },
        { label: "Infosys", values: ["HackerRank", "95 min", "Verbal + Quant + Reasoning + Pseudocode", "Yes (1 Q)"] },
        { label: "Wipro (NTH)", values: ["AMCAT", "120 min", "Quant + Verbal + Logical + Essay", "No"] },
        { label: "Capgemini", values: ["IntelliAdapt", "150 min", "Adaptive Quant/Verbal/Logical + Pseudocode", "No"] },
        { label: "Cognizant", values: ["CoCubes", "90 min", "Quant + Verbal + Logical + English", "Yes (1 Q)"] },
        { label: "HCL", values: ["AMCAT", "120 min", "Quant + Verbal + Logical + Technical MCQ", "No"] },
      ]}
      caption="Aptitude test formats by major IT company — 2026 campus season"
    />
  ),
  "aptitude-questions-it-companies-india-2026||Preparation Plan: 4 Weeks to Aptitude Test Ready": (
    <PrepTimeline caption="4-week aptitude preparation plan for IT company campus tests" phases={[
      { period: "Week 1", label: "Quantitative foundation", tasks: ["Percentages, ratios, and profit-loss", "Time-speed-distance and work problems", "Number systems and series"], milestone: "Complete 50 Indiabix quant problems" },
      { period: "Week 2", label: "Logical reasoning", tasks: ["Syllogisms and blood relations", "Seating arrangement and directions", "Coding-decoding and series completion"], milestone: "Complete 3 timed section-tests" },
      { period: "Week 3", label: "Verbal ability", tasks: ["Reading comprehension passages", "Error correction and sentence completion", "Vocabulary — antonyms, synonyms, analogies"], milestone: "Score 80%+ on 2 verbal mocks" },
      { period: "Week 4", label: "Full mocks + pseudocode", tasks: ["2 full-length company-specific mocks", "Pseudocode / flowchart practice for Capgemini/Infosys", "Review weak areas, timed re-practice"], milestone: "Complete 2 full mock tests under real conditions" },
    ]} />
  ),

  /* tcs-nqt-2026-complete-guide: round flow + prep timeline */
  "tcs-nqt-2026-complete-guide||TCS NQT 2026 Exam Pattern": (
    <RoundFlow rounds={[
      { label: "Verbal Ability", duration: "15 min", detail: "Reading comprehension, fill-in-the-blanks, sentence correction — 24 questions" },
      { label: "Numerical Ability", duration: "40 min", detail: "Arithmetic, number series, data interpretation — 26 questions" },
      { label: "Reasoning Ability", duration: "50 min", detail: "Logical puzzles, blood relations, coding-decoding — 30 questions" },
      { label: "Coding (Optional — higher package)", duration: "30 min", detail: "2 programming problems in Python/Java/C/C++ — required for Digital 7 LPA track" },
    ]} />
  ),
  "tcs-nqt-2026-complete-guide||Four-Week Study Plan": (
    <PrepTimeline caption="4-week TCS NQT preparation plan" phases={[
      { period: "Week 1", label: "Numeric + Verbal base", tasks: ["Percentages, ratios, series, time-distance", "Reading comprehension (2 passages/day)", "Vocab drills — 20 words/day"], milestone: "50 quant problems + 2 RC passages per day" },
      { period: "Week 2", label: "Reasoning deep dive", tasks: ["Blood relations and directions", "Seating arrangements and syllogisms", "Coding-decoding patterns"], milestone: "Complete TCS NQT mock paper 1" },
      { period: "Week 3", label: "Coding prep (Digital track)", tasks: ["Arrays, strings, basic sorting in Python/Java", "Pattern printing and simple recursion", "2 LeetCode Easy problems per day"], milestone: "Solve 14+ LeetCode Easy problems" },
      { period: "Week 4", label: "Timed full mocks", tasks: ["2 full NQT mocks with time tracking", "Review errors, revise weak sections", "Official TCS MockVita practice test"], milestone: "Achieve 70%+ on 2 full NQT mocks" },
    ]} />
  ),

  /* wipro-wilp-interview-complete-guide: round flow + salary */
  "wipro-wilp-interview-complete-guide||WILP Selection Process": (
    <RoundFlow rounds={[
      { label: "WNTH Online Test", duration: "120 min", detail: "Aptitude (quant + verbal + logical), coding (1-2 problems), and essay writing — similar to NLTH but for WILP" },
      { label: "Technical Interview", duration: "30-40 min", detail: "OOP, DBMS, OS basics, one programming question, and project discussion" },
      { label: "HR Interview", duration: "20 min", detail: "WILP course confirmation, bond terms, work-from-office discussion, 'Tell me about yourself'" },
    ]} />
  ),
  "wipro-wilp-interview-complete-guide||HR Interview and Bond Clarity": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "WILP — Standard Track", min: 3.5, max: 4, note: "2-year bond; part-time degree from BITS/VIT" },
      { role: "WILP — Elite Track", min: 6, max: 6.5, note: "Higher aptitude/coding scorers" },
      { role: "After degree completion (2 yrs)", min: 5, max: 7, note: "Promotion to Engineer role post-WILP" },
    ]} caption="Wipro WILP CTC 2026 — includes part-time B.Tech/M.Tech sponsorship; bond buyout ~₹1 lakh" />
  ),

  /* campus-placement-aptitude-test-preparation-2026: comparison table */
  "campus-placement-aptitude-test-preparation-2026||Company-Wise Test Patterns 2026": (
    <ComparisonTable
      columns={[
        { name: "Company" },
        { name: "Test Name" },
        { name: "Duration" },
        { name: "Coding Included?", highlight: true },
      ]}
      rows={[
        { label: "TCS", values: ["NQT (National Qualifier Test)", "120 min", "Yes — optional for Digital track"] },
        { label: "Infosys", values: ["InfyTQ / HackerRank", "95 min", "Yes — 1 pseudocode question"] },
        { label: "Wipro", values: ["NLTH / Elite AMCAT", "120 min", "No — aptitude + essay only"] },
        { label: "Capgemini", values: ["IntelliAdapt", "150 min", "No — pseudocode section"] },
        { label: "HCL", values: ["AMCAT / HCL HEAT", "120 min", "No — tech MCQ only"] },
        { label: "Cognizant", values: ["CoCubes", "90 min", "Yes — 1 coding question"] },
      ]}
      caption="Campus aptitude test formats and coding requirements — 2026 placement season"
    />
  ),
  "campus-placement-aptitude-test-preparation-2026||30-Day Preparation Plan": (
    <PrepTimeline caption="30-day campus aptitude preparation plan" phases={[
      { period: "Days 1-8", label: "Quantitative aptitude", tasks: ["Arithmetic: percentages, ratios, profit-loss", "Algebra: time-work, time-distance, pipes", "Number system and series"], milestone: "Score 75%+ on 1 quant mock test" },
      { period: "Days 9-16", label: "Logical reasoning", tasks: ["Seating arrangements, blood relations", "Syllogisms, statement-conclusions", "Data sufficiency and visual puzzles"], milestone: "Complete 3 reasoning section-tests" },
      { period: "Days 17-22", label: "Verbal ability", tasks: ["RC passages — 2 per day", "Sentence correction and fill-in-the-blanks", "Vocab: antonyms, synonyms, one-word substitution"], milestone: "Verbal score 70%+ on practice test" },
      { period: "Days 23-30", label: "Full mocks + gap fix", tasks: ["2 company-specific full mocks", "Timed practice of weakest section", "Pseudocode/coding warm-up for coding companies"], milestone: "2 full mocks completed — target 70%+ overall" },
    ]} />
  ),

  /* group-discussion-tips-campus-placements-india: evaluation framework */
  "group-discussion-tips-campus-placements-india||What GD Evaluators Are Actually Watching": (
    <FrameworkSteps steps={[
      { number: "01", label: "Content and knowledge", hint: "Relevant facts and logical reasoning — prepare 3 points per side for any GD topic" },
      { number: "02", label: "Communication clarity", hint: "Short, clear sentences at a moderate pace — fast speech signals nervousness" },
      { number: "03", label: "Listening and building", hint: "Reference what others said: 'Building on Priya's point about AI regulation…'" },
      { number: "04", label: "Initiating or steering", hint: "Opening or summarising earns extra credit — don't just wait for others to lead" },
      { number: "05", label: "Group dynamics", hint: "Helping quiet participants speak shows maturity: 'I'd like to hear Rahul's take on this'" },
    ]} />
  ),
  "group-discussion-tips-campus-placements-india||Summarising the GD: The Closing Move": (
    <FrameworkSteps steps={[
      { number: "01", label: "Signal the summary", hint: "Say 'As we wrap up, let me summarise the key points discussed…'" },
      { number: "02", label: "Cover both sides", hint: "Acknowledge arguments from both/all perspectives — don't just repeat your own points" },
      { number: "03", label: "Give a balanced conclusion", hint: "Avoid extreme positions in the summary — a measured stance reads as maturity" },
      { number: "04", label: "Keep it to 30 seconds", hint: "A long summary defeats the purpose — 3 crisp sentences is ideal" },
    ]} />
  ),

  /* internship-interview-questions-india-2026: evaluation framework */
  "internship-interview-questions-india-2026||What Companies Actually Evaluate in Internship Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Learning potential", hint: "Can you pick up a new framework or tool quickly? Show examples from your projects" },
      { number: "02", label: "Communication", hint: "Can you explain what your college project does in 60 seconds without jargon?" },
      { number: "03", label: "Basic coding ability", hint: "Simple arrays/strings/loops — not LeetCode Hard; just show you can write working code" },
      { number: "04", label: "Curiosity and initiative", hint: "Asking good questions at the end signals engagement — prepare 2 questions per interview" },
      { number: "05", label: "Reliability signals", hint: "Past competition wins, open source PRs, online courses — any evidence of self-directed learning" },
    ]} />
  ),
};
