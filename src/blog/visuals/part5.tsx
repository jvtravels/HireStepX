import type { ReactNode } from "react";
import { SalaryLadder, TierCompare, FrameworkSteps, PrepTimeline, ComparisonTable } from "../../marketing-v2/_blog-infographics";

export const SECTION_VISUALS_5: Record<string, ReactNode> = {
  /* fresher-resume-tips-india-2026: framework steps */
  "fresher-resume-tips-india-2026||The Section Order That Works in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Contact + Links", hint: "Name, phone, email, LinkedIn, and GitHub — all on one line at the top" },
      { number: "02", label: "Education", hint: "Degree, college, CGPA, and year — if CGPA < 7.0, place this lower on the page" },
      { number: "03", label: "Skills", hint: "Languages, frameworks, tools, and databases — match keywords from the JD" },
      { number: "04", label: "Projects", hint: "2-3 projects with tech stack, your specific role, and a measurable outcome each" },
      { number: "05", label: "Internships / Experience", hint: "If you have any, put above Projects; add what you built and what impact it had" },
      { number: "06", label: "Achievements / Extras", hint: "Competitive programming ranks, hackathon wins, certifications — keep it brief" },
    ]} />
  ),
  "fresher-resume-tips-india-2026||ATS Optimisation for Indian Companies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Use standard section headings", hint: "'Experience', 'Education', 'Skills' — ATS fails on creative names like 'My Journey'" },
      { number: "02", label: "Match JD keywords exactly", hint: "If the JD says 'REST APIs', your resume should say 'REST APIs', not 'web services'" },
      { number: "03", label: "No tables or columns", hint: "ATS parsers scramble multi-column layouts — use a single-column template" },
      { number: "04", label: "Submit as PDF unless asked otherwise", hint: "PDFs preserve formatting; .docx files can reformat badly on different Word versions" },
      { number: "05", label: "Spell out abbreviations once", hint: "'Machine Learning (ML)' — the ATS may search for either form" },
    ]} />
  ),

  /* aptitude-test-preparation-india-2026: comparison table */
  "aptitude-test-preparation-india-2026||Company-by-Company Aptitude Test Formats": (
    <ComparisonTable
      columns={[
        { name: "Company" },
        { name: "Platform" },
        { name: "Key Sections", highlight: true },
        { name: "Coding?" },
      ]}
      rows={[
        { label: "TCS", values: ["TCS iON (NQT)", "Verbal + Numeric + Reasoning", "Yes (Digital track)"] },
        { label: "Infosys", values: ["HackerRank", "Verbal + Quant + Reasoning + Pseudocode", "Yes (1 Q)"] },
        { label: "Wipro", values: ["AMCAT", "Quant + Verbal + Logical + Essay", "No"] },
        { label: "Capgemini", values: ["IntelliAdapt (adaptive)", "Quant + Verbal + Logical + Pseudocode", "No"] },
        { label: "Cognizant", values: ["CoCubes", "Quant + Verbal + Logical", "Yes (1 Q)"] },
        { label: "Accenture", values: ["ACAT", "Cognitive + Technical + Communication", "No"] },
      ]}
      caption="Aptitude test platform and format by company — 2026 India campus season"
    />
  ),

  /* group-discussion-tips-india-2026: framework steps */
  "group-discussion-tips-india-2026||How to Initiate a GD Without Sounding Scripted": (
    <FrameworkSteps steps={[
      { number: "01", label: "Define the topic", hint: "Start by clarifying what the topic means — sets the frame and buys 10 seconds of thinking time" },
      { number: "02", label: "State the two sides briefly", hint: "'This topic has merits on both sides — on one hand X, on the other Y…'" },
      { number: "03", label: "Give your opening stance", hint: "Take a position with 1 supporting reason — don't stay neutral in the opening" },
      { number: "04", label: "Invite others in", hint: "'I'd like to hear others' views on this…' — shows leadership, not insecurity" },
    ]} />
  ),

  /* tier-2-college-it-career-india-2026: off-campus strategy steps */
  "tier-2-college-it-career-india-2026||Off-Campus Application Strategy": (
    <FrameworkSteps steps={[
      { number: "01", label: "Build a GitHub portfolio first", hint: "2-3 live projects with READMEs — this substitutes for a brand-name college in screening" },
      { number: "02", label: "Get an AMCAT / CoCubes score", hint: "A percentile of 80+ makes you eligible for off-campus drives from 50+ companies" },
      { number: "03", label: "Apply to mass off-campus drives", hint: "TCS NextStep, Infosys InfyTQ, Wipro Talent Hunt — free to apply, no college filter" },
      { number: "04", label: "Use LinkedIn actively", hint: "Connect with recruiters at target companies, post projects, and ask for referrals from alumni" },
      { number: "05", label: "Target service IT first, then product", hint: "Service IT hires in volume regardless of college tier — use it as a stepping stone" },
    ]} />
  ),

  /* hr-round-questions-india-2026: HR evaluation framework */
  "hr-round-questions-india-2026||What HR Rounds Actually Evaluate": (
    <FrameworkSteps steps={[
      { number: "01", label: "Culture fit", hint: "HR checks if your working style, values, and attitude match the team — answer authentically, not generically" },
      { number: "02", label: "Communication clarity", hint: "Can you articulate your thoughts without rambling? Short, structured answers score well" },
      { number: "03", label: "Stability signals", hint: "HR watches for flight risk — show genuine interest in the role, not just the salary" },
      { number: "04", label: "Self-awareness", hint: "Questions on weakness and failure test if you can reflect honestly — scripted perfect answers raise red flags" },
      { number: "05", label: "Closing intent", hint: "HR assesses if you'll accept the offer — have a clear, positive answer ready for 'How soon can you join?'" },
    ]} />
  ),
  "hr-round-questions-india-2026||The High-Stakes HR Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Tell me about yourself", hint: "Present → Past → Future in 90 seconds — end with why this role fits your direction" },
      { number: "02", label: "Why should we hire you?", hint: "3 specific strengths that match the JD + 1 differentiator — not a generic answer" },
      { number: "03", label: "What is your biggest weakness?", hint: "Real weakness + concrete steps you are taking to improve + visible progress" },
      { number: "04", label: "Where do you see yourself in 5 years?", hint: "Align with the company's growth path — show ambition without implying you'll leave in 1 year" },
      { number: "05", label: "Why are you leaving your current role?", hint: "Pull reasons (growth, learning, new challenge) — never criticise your current employer" },
    ]} />
  ),

  /* fresher-resume-india-2026: structure + ATS framework */
  "fresher-resume-india-2026||Fresher Resume Structure": (
    <FrameworkSteps steps={[
      { number: "01", label: "Header", hint: "Name (large), phone, email, LinkedIn, GitHub — one clean line, no photo" },
      { number: "02", label: "Education", hint: "Degree, college, CGPA, and year — if CGPA < 7.0, de-emphasise by placing it lower" },
      { number: "03", label: "Technical Skills", hint: "Languages, frameworks, tools, cloud platforms — mirror the exact words in target JDs" },
      { number: "04", label: "Projects", hint: "2-3 projects: title, tech stack, your role, and a measurable outcome each" },
      { number: "05", label: "Achievements", hint: "Competitive programming ranks (CodeChef, Codeforces), hackathon wins, or certifications" },
    ]} />
  ),
  "fresher-resume-india-2026||ATS Optimisation for Indian Fresher Resumes": (
    <FrameworkSteps steps={[
      { number: "01", label: "Single-column layout only", hint: "Multi-column tables break ATS parsers — every Indian IT company ATS fails on them" },
      { number: "02", label: "Standard section titles", hint: "Use 'Skills', 'Experience', 'Education' — creative names like 'My Toolkit' are invisible to ATS" },
      { number: "03", label: "Exact keyword matching", hint: "Copy skills verbatim from the JD — 'React.js' not 'ReactJS' if the JD says the former" },
      { number: "04", label: "Spell out acronyms", hint: "'Machine Learning (ML)' — include both forms since ATS may search either" },
      { number: "05", label: "Submit as PDF", hint: "PDF preserves layout; .docx files reflow unpredictably across Word versions" },
    ]} />
  ),

  /* campus-to-corporate-india-2026: fresher transition framework */
  "campus-to-corporate-india-2026||The First 30 Days: Learn Before You Lead": (
    <FrameworkSteps steps={[
      { number: "01", label: "Observe before acting", hint: "Understand team norms, communication style, and unwritten rules before suggesting changes" },
      { number: "02", label: "Ask structured questions", hint: "Batch your questions, do your own research first, then ask: 'I tried X and Y — is Z the right approach?'" },
      { number: "03", label: "Deliver your first task early", hint: "Under-promise and over-deliver on your first assigned task — sets a strong first impression" },
      { number: "04", label: "Build relationships deliberately", hint: "Introduce yourself to 2-3 colleagues per week — relationships open doors to better projects" },
      { number: "05", label: "Document everything", hint: "Keep notes on processes, system setup, and decisions — you'll need them when onboarding the next fresher" },
    ]} />
  ),
  "campus-to-corporate-india-2026||Performance in the First Year": (
    <PrepTimeline caption="Performance milestones to target in your first year at an IT company" phases={[
      { period: "Month 1-3", label: "Onboarding and training", tasks: ["Complete mandatory training (Lex, TCS iEvolve, etc.)", "Get development environment set up and deploy first code", "Understand team's tech stack and codebase structure"], milestone: "First code merged or first task delivered" },
      { period: "Month 4-6", label: "Independent contribution", tasks: ["Own small features or bug fixes end-to-end", "Participate in code reviews — both giving and receiving", "Raise blockers proactively, don't stay stuck silently"], milestone: "First quarterly review — aim for 'Meets Expectations' or above" },
      { period: "Month 7-9", label: "Visibility and learning", tasks: ["Volunteer for one cross-team initiative or demo", "Start a relevant certification (AWS, GCP, etc.)", "Track your contributions for appraisal evidence"], milestone: "Certification in progress or completed" },
      { period: "Month 10-12", label: "Appraisal prep", tasks: ["Write your self-assessment with specific examples and metrics", "Have a career conversation with your manager", "Identify skill gaps to address in Year 2"], milestone: "Mid-year or annual appraisal discussion done" },
    ]} />
  ),

  /* ── Industry & Salary ── */
  /* backend-developer-salary-india-2026: Salary Guide */
  "backend-developer-salary-india-2026||Backend Developer Salary by Experience Level": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Fresher / 0-1 yr (IT Services)", min: 4, max: 8 },
      { role: "Junior Backend (1-3 yr)", min: 8, max: 18 },
      { role: "Mid-Level Backend (3-5 yr)", min: 16, max: 35 },
      { role: "Senior Backend (5-8 yr)", min: 28, max: 55 },
      { role: "Staff / Principal (8-12 yr)", min: 45, max: 90 },
      { role: "Engineering Manager / Architect", min: 55, max: 120 },
    ]} caption="India backend developer salaries 2026 — product companies at upper band, IT services at lower" />
  ),

  "backend-developer-salary-india-2026||Salary by Technology Stack": (
    <TierCompare cards={[
      {
        tier: "High Pay (₹20–60 LPA)",
        examples: "Go · Rust · Kafka · Kubernetes",
        rows: [
          { label: "Mid-Level", range: "₹25–45 LPA" },
          { label: "Senior", range: "₹40–60 LPA" },
          { label: "Demand", range: "Very High" },
        ],
      },
      {
        tier: "Mid Pay (₹15–45 LPA)",
        examples: "Java · Python · Node.js · gRPC",
        rows: [
          { label: "Mid-Level", range: "₹18–35 LPA" },
          { label: "Senior", range: "₹30–50 LPA" },
          { label: "Demand", range: "High" },
        ],
      },
      {
        tier: "Entry Pay (₹6–20 LPA)",
        examples: "PHP · .NET legacy · COBOL",
        rows: [
          { label: "Mid-Level", range: "₹10–20 LPA" },
          { label: "Senior", range: "₹18–30 LPA" },
          { label: "Demand", range: "Moderate" },
        ],
      },
    ]} />
  ),

  /* full-stack-developer-salary-india-2026: Salary Guide */
  "full-stack-developer-salary-india-2026||Full Stack Developer Salary by Experience Level in India": (
    <SalaryLadder maxLPA={110} rows={[
      { role: "Fresher / 0-1 yr (IT Services)", min: 4, max: 7 },
      { role: "Junior Full Stack (1-3 yr)", min: 8, max: 20 },
      { role: "Mid-Level Full Stack (3-5 yr)", min: 18, max: 40 },
      { role: "Senior Full Stack (5-8 yr)", min: 30, max: 65 },
      { role: "Staff / Lead Full Stack (8+ yr)", min: 50, max: 110 },
    ]} caption="India full-stack developer salaries 2026 — product startups at upper band" />
  ),

  "full-stack-developer-salary-india-2026||Salary by Stack: Which Full Stack Combination Pays Most": (
    <TierCompare cards={[
      {
        tier: "Top Paying Stacks",
        examples: "Next.js + Go · React + Rust · GraphQL + K8s",
        rows: [
          { label: "Mid range", range: "₹25–50 LPA" },
          { label: "Senior range", range: "₹45–80 LPA" },
          { label: "Openings", range: "Product cos" },
        ],
      },
      {
        tier: "Standard Stacks",
        examples: "React + Node.js · MERN · MEAN",
        rows: [
          { label: "Mid range", range: "₹15–35 LPA" },
          { label: "Senior range", range: "₹30–55 LPA" },
          { label: "Openings", range: "Very many" },
        ],
      },
      {
        tier: "Legacy / Services Stacks",
        examples: "Angular + Java · Vue + .NET",
        rows: [
          { label: "Mid range", range: "₹10–22 LPA" },
          { label: "Senior range", range: "₹20–38 LPA" },
          { label: "Openings", range: "IT Services" },
        ],
      },
    ]} />
  ),

  /* devops-engineer-salary-india-2026: Salary Guide */
  "devops-engineer-salary-india-2026||DevOps Engineer Salary by Experience Level": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Junior DevOps (0-2 yr)", min: 5, max: 14 },
      { role: "Mid-Level DevOps (2-5 yr)", min: 14, max: 35 },
      { role: "Senior DevOps (5-8 yr)", min: 28, max: 60 },
      { role: "Principal / Platform Eng (8+ yr)", min: 50, max: 90 },
      { role: "Head of Infrastructure", min: 70, max: 120 },
    ]} caption="India DevOps engineer salaries 2026 — cloud-native product companies at upper band" />
  ),

  "devops-engineer-salary-india-2026||What Companies Pay Best for DevOps in India": (
    <TierCompare cards={[
      {
        tier: "Top Payers",
        examples: "Google · Microsoft · Amazon · Atlassian",
        rows: [
          { label: "Mid-Level", range: "₹35–60 LPA" },
          { label: "Senior", range: "₹55–90 LPA" },
          { label: "SRE variant", range: "₹60–100 LPA" },
        ],
      },
      {
        tier: "Indian Product",
        examples: "Razorpay · PhonePe · Swiggy · Zepto",
        rows: [
          { label: "Mid-Level", range: "₹22–40 LPA" },
          { label: "Senior", range: "₹38–65 LPA" },
          { label: "SRE variant", range: "₹40–70 LPA" },
        ],
      },
      {
        tier: "IT Services",
        examples: "TCS · Infosys · Wipro · HCL",
        rows: [
          { label: "Mid-Level", range: "₹10–20 LPA" },
          { label: "Senior", range: "₹18–32 LPA" },
          { label: "SRE variant", range: "Rare role" },
        ],
      },
    ]} />
  ),

  /* machine-learning-engineer-salary-india-2026: Salary Guide */
  "machine-learning-engineer-salary-india-2026||ML Engineer Salary by Experience Level": (
    <SalaryLadder maxLPA={130} rows={[
      { role: "Junior MLE (0-2 yr)", min: 8, max: 18 },
      { role: "Mid-Level MLE (2-5 yr)", min: 18, max: 45 },
      { role: "Senior MLE (5-8 yr)", min: 38, max: 75 },
      { role: "Staff MLE / Research Eng (8-12 yr)", min: 65, max: 105 },
      { role: "Principal / ML Architect", min: 90, max: 130 },
    ]} caption="India ML engineer salaries 2026 — GenAI/LLM specialisation commands highest premium" />
  ),

  "machine-learning-engineer-salary-india-2026||Salary by ML Specialisation": (
    <TierCompare cards={[
      {
        tier: "GenAI / LLM",
        examples: "LLM fine-tuning · RAG · Agents · RLHF",
        rows: [
          { label: "Mid range", range: "₹30–60 LPA" },
          { label: "Senior range", range: "₹55–100 LPA" },
          { label: "Demand", range: "Extremely high" },
        ],
      },
      {
        tier: "Applied ML / CV / NLP",
        examples: "Recommendation · Vision · ASR · NER",
        rows: [
          { label: "Mid range", range: "₹20–45 LPA" },
          { label: "Senior range", range: "₹40–75 LPA" },
          { label: "Demand", range: "High" },
        ],
      },
      {
        tier: "MLOps / Platform",
        examples: "Kubeflow · MLflow · Feature stores",
        rows: [
          { label: "Mid range", range: "₹18–38 LPA" },
          { label: "Senior range", range: "₹35–65 LPA" },
          { label: "Demand", range: "Growing fast" },
        ],
      },
    ]} />
  ),

  /* cloud-computing-salary-india-2026: Salary Guide */
  "cloud-computing-salary-india-2026||Cloud Engineer vs Cloud Architect: Role and Salary Difference": (
    <TierCompare cards={[
      {
        tier: "Cloud Engineer",
        examples: "AWS · Azure · GCP · DevOps focus",
        rows: [
          { label: "Entry (0-2 yr)", range: "₹6–16 LPA" },
          { label: "Mid (3-5 yr)", range: "₹16–38 LPA" },
          { label: "Senior (6-9 yr)", range: "₹32–60 LPA" },
        ],
      },
      {
        tier: "Cloud Architect",
        examples: "Multi-cloud · FinOps · Security design",
        rows: [
          { label: "Entry (5-7 yr total)", range: "₹35–55 LPA" },
          { label: "Mid (8-11 yr)", range: "₹50–80 LPA" },
          { label: "Principal (12+ yr)", range: "₹75–120 LPA" },
        ],
      },
      {
        tier: "Cloud Security / FinOps",
        examples: "CSPM · CCoE · IAM · Cost optim",
        rows: [
          { label: "Mid level", range: "₹22–45 LPA" },
          { label: "Senior", range: "₹40–75 LPA" },
          { label: "Demand", range: "Fastest growing" },
        ],
      },
    ]} />
  ),

  "cloud-computing-salary-india-2026||Highest-Paying Cloud Computing Roles in India": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Cloud Support / Jr Engineer", min: 6, max: 14 },
      { role: "Cloud Engineer (AWS/Azure/GCP certified)", min: 14, max: 35 },
      { role: "Senior Cloud / Platform Engineer", min: 28, max: 60 },
      { role: "Cloud Architect", min: 45, max: 85 },
      { role: "Principal Cloud Architect / CCoE Lead", min: 70, max: 120 },
    ]} caption="India cloud computing salaries 2026 — certifications + FinOps skills push into upper bands" />
  ),

  /* top-product-companies-bengaluru-2026: Industry Insights */
  "top-product-companies-bengaluru-2026||Tier 1: FAANG and Global Product Companies in Bengaluru": (
    <TierCompare cards={[
      {
        tier: "FAANG Bengaluru",
        examples: "Google · Amazon · Microsoft · Meta · Apple",
        rows: [
          { label: "SDE-1 / SWE-1", range: "₹45–80 LPA" },
          { label: "SDE-2 / SWE-2", range: "₹70–130 LPA" },
          { label: "Staff+", range: "₹120–220 LPA" },
        ],
      },
      {
        tier: "Tier 1 Global Product",
        examples: "Atlassian · Salesforce · Adobe · LinkedIn · Uber",
        rows: [
          { label: "SDE-1", range: "₹30–55 LPA" },
          { label: "SDE-2", range: "₹50–90 LPA" },
          { label: "Staff+", range: "₹80–150 LPA" },
        ],
      },
      {
        tier: "Top Indian Product",
        examples: "Flipkart · PhonePe · Swiggy · Razorpay · CRED",
        rows: [
          { label: "SDE-1", range: "₹22–45 LPA" },
          { label: "SDE-2", range: "₹35–70 LPA" },
          { label: "Staff+", range: "₹60–110 LPA" },
        ],
      },
    ]} />
  ),

  "top-product-companies-bengaluru-2026||Tier 2: Top Indian Product Companies": (
    <SalaryLadder maxLPA={110} rows={[
      { role: "Freshers / SDE-0 (2026 batch)", min: 12, max: 22, note: "Unicorns" },
      { role: "SDE-1 / Junior Engineer (1-3 yr)", min: 18, max: 40 },
      { role: "SDE-2 / Mid-Level (3-6 yr)", min: 30, max: 65 },
      { role: "SDE-3 / Senior (6-10 yr)", min: 50, max: 90 },
      { role: "Staff / Principal (10+ yr)", min: 75, max: 110 },
    ]} caption="Indian product company salaries — Bengaluru 2026. Includes base + variable + pre-IPO equity value" />
  ),

  /* best-fintech-companies-india-2026: Industry Insights */
  "best-fintech-companies-india-2026||Tier 1: Payments Infrastructure Leaders": (
    <TierCompare cards={[
      {
        tier: "Tier 1: Payments Infra",
        examples: "Razorpay · PhonePe · BillDesk · Juspay",
        rows: [
          { label: "SDE-1", range: "₹20–40 LPA" },
          { label: "SDE-2", range: "₹35–65 LPA" },
          { label: "SDE-3 / Senior", range: "₹55–95 LPA" },
        ],
      },
      {
        tier: "Tier 2: Consumer Finance",
        examples: "Groww · Zerodha · Upstox · ClearTax",
        rows: [
          { label: "SDE-1", range: "₹15–30 LPA" },
          { label: "SDE-2", range: "₹25–50 LPA" },
          { label: "SDE-3 / Senior", range: "₹40–75 LPA" },
        ],
      },
      {
        tier: "Tier 3: InsurTech / Lending",
        examples: "Acko · PolicyBazaar · BankBazaar · KreditBee",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹18–38 LPA" },
          { label: "SDE-3 / Senior", range: "₹30–55 LPA" },
        ],
      },
    ]} />
  ),

  "best-fintech-companies-india-2026||Tier 2: Consumer Finance and Investment Platforms": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Junior SDE (0-2 yr)", min: 10, max: 22, note: "Consumer finance startups" },
      { role: "Mid-Level SDE (2-5 yr)", min: 22, max: 50 },
      { role: "Senior SDE (5-8 yr)", min: 40, max: 75 },
      { role: "Staff Engineer (8+ yr)", min: 60, max: 100 },
    ]} caption="Consumer fintech (Groww, Zerodha, Upstox, CRED) engineer salaries — India 2026" />
  ),

  /* software-engineer-salary-india-2026: Industry Insights */
  "software-engineer-salary-india-2026||Service IT Companies: TCS, Infosys, Wipro, HCL, Cognizant": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "Fresher / Associate (0-1 yr)", min: 3, max: 7 },
      { role: "Systems Engineer (1-3 yr)", min: 5, max: 12 },
      { role: "Senior Systems Eng (3-6 yr)", min: 10, max: 20 },
      { role: "Lead / Specialist (6-10 yr)", min: 16, max: 32 },
      { role: "Manager / Architect (10+ yr)", min: 25, max: 40 },
    ]} caption="IT Services company salaries (TCS, Infosys, Wipro, HCL, Cognizant) — India 2026" />
  ),

  "software-engineer-salary-india-2026||FAANG India and Global Product Companies": (
    <TierCompare cards={[
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft · Meta · Apple",
        rows: [
          { label: "SDE-1", range: "₹40–80 LPA" },
          { label: "SDE-2", range: "₹70–130 LPA" },
          { label: "Senior / Staff", range: "₹110–220+ LPA" },
        ],
      },
      {
        tier: "Indian Unicorns",
        examples: "Flipkart · Razorpay · PhonePe · Swiggy · CRED",
        rows: [
          { label: "SDE-1", range: "₹18–42 LPA" },
          { label: "SDE-2", range: "₹35–70 LPA" },
          { label: "Senior / Staff", range: "₹60–110 LPA" },
        ],
      },
      {
        tier: "IT Services",
        examples: "TCS · Infosys · Wipro · HCL · Cognizant",
        rows: [
          { label: "Fresher", range: "₹3.5–7 LPA" },
          { label: "Mid-Level", range: "₹10–20 LPA" },
          { label: "Senior / Lead", range: "₹18–35 LPA" },
        ],
      },
    ]} />
  ),

  /* it-services-vs-product-companies-india-2026: Industry Insights */
  "it-services-vs-product-companies-india-2026||The Compensation Gap: How Large Is It Really?": (
    <TierCompare cards={[
      {
        tier: "IT Services",
        examples: "TCS · Infosys · Wipro · HCL · Cognizant",
        rows: [
          { label: "Fresher CTC", range: "₹3.5–7 LPA" },
          { label: "5-year CTC", range: "₹10–20 LPA" },
          { label: "10-year CTC", range: "₹18–35 LPA" },
        ],
      },
      {
        tier: "Indian Product",
        examples: "Flipkart · Razorpay · Swiggy · PhonePe",
        rows: [
          { label: "Fresher CTC", range: "₹15–30 LPA" },
          { label: "5-year CTC", range: "₹35–70 LPA" },
          { label: "10-year CTC", range: "₹60–110 LPA" },
        ],
      },
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft · Meta",
        rows: [
          { label: "Fresher CTC", range: "₹40–80 LPA" },
          { label: "5-year CTC", range: "₹80–140 LPA" },
          { label: "10-year CTC", range: "₹130–230+ LPA" },
        ],
      },
    ]} />
  ),

  /* campus-placement-guide-india-2026: Industry Insights */
  "campus-placement-guide-india-2026||Timeline: When to Start and What to Do Each Semester": (
    <PrepTimeline caption="Campus placement preparation — 2-year roadmap for 2026 batch" phases={[
      {
        period: "3rd Year S1",
        label: "Foundation",
        tasks: ["Start DSA on LeetCode (easy)", "Pick one language deeply (Java/Python/C++)", "Apply for summer internships"],
        milestone: "Complete 100 Easy problems",
      },
      {
        period: "3rd Year S2",
        label: "Build Momentum",
        tasks: ["DSA medium problems (150+)", "1 side project on GitHub", "Participate in Codeforces / CodeChef contests"],
        milestone: "Secure a summer internship",
      },
      {
        period: "Summer Internship",
        label: "Industry Exposure",
        tasks: ["Deliver real impact at internship", "Aim for PPO", "Network with seniors for referrals"],
        milestone: "PPO or strong LOR",
      },
      {
        period: "4th Year S1",
        label: "Placement Season",
        tasks: ["Resume finalised by Aug", "Mock interviews weekly", "Apply to 30+ companies via campus + off-campus"],
        milestone: "First offer in hand",
      },
    ]} />
  ),

  /* top-tech-companies-hyderabad-2026: Industry Insights */
  "top-tech-companies-hyderabad-2026||Tier 1: Global Tech Company GCCs in Hyderabad": (
    <TierCompare cards={[
      {
        tier: "FAANG GCCs",
        examples: "Google · Amazon · Microsoft · Apple · Meta",
        rows: [
          { label: "SDE-1", range: "₹40–75 LPA" },
          { label: "SDE-2", range: "₹65–120 LPA" },
          { label: "Staff+", range: "₹110–200 LPA" },
        ],
      },
      {
        tier: "Enterprise Tech GCCs",
        examples: "SAP · Oracle · Qualcomm · Nvidia · Broadcom",
        rows: [
          { label: "SDE-1", range: "₹20–42 LPA" },
          { label: "SDE-2", range: "₹38–70 LPA" },
          { label: "Staff+", range: "₹65–110 LPA" },
        ],
      },
      {
        tier: "IT Services & BFSI",
        examples: "TCS · Infosys · Wipro · Deloitte USI · HSBC Tech",
        rows: [
          { label: "Fresher", range: "₹3.5–8 LPA" },
          { label: "Mid-Level", range: "₹12–25 LPA" },
          { label: "Senior", range: "₹22–40 LPA" },
        ],
      },
    ]} />
  ),

  "top-tech-companies-hyderabad-2026||Tier 2: Enterprise Tech and SaaS Companies": (
    <SalaryLadder maxLPA={110} rows={[
      { role: "Fresher (2026 batch)", min: 8, max: 22, note: "GCCs and SaaS" },
      { role: "Junior Engineer (1-3 yr)", min: 15, max: 38 },
      { role: "Mid-Level Engineer (3-6 yr)", min: 28, max: 60 },
      { role: "Senior Engineer (6-10 yr)", min: 45, max: 85 },
      { role: "Staff / Principal (10+ yr)", min: 70, max: 110 },
    ]} caption="Hyderabad enterprise tech and SaaS salaries 2026 — SAP Labs, Oracle, Qualcomm, Nvidia" />
  ),

  /* top-tech-companies-pune-2026: Industry Insights */
  "top-tech-companies-pune-2026||Tier 1: Best Pune Tech Employers for Engineering Quality": (
    <TierCompare cards={[
      {
        tier: "Global Product (Pune)",
        examples: "Persistent · Veritas · Bentley · Barclays Tech · HSBC",
        rows: [
          { label: "SDE-1", range: "₹15–35 LPA" },
          { label: "SDE-2", range: "₹28–55 LPA" },
          { label: "Senior", range: "₹45–80 LPA" },
        ],
      },
      {
        tier: "Automotive / Embedded",
        examples: "Cummins · Mercedes-Benz R&D · Tata Technologies · Eaton",
        rows: [
          { label: "Entry", range: "₹6–14 LPA" },
          { label: "Mid-Level", range: "₹14–30 LPA" },
          { label: "Senior", range: "₹25–50 LPA" },
        ],
      },
      {
        tier: "IT Services (Pune)",
        examples: "Infosys · Wipro · Cognizant · TCS · Capgemini",
        rows: [
          { label: "Fresher", range: "₹3.5–7 LPA" },
          { label: "Mid-Level", range: "₹10–22 LPA" },
          { label: "Senior", range: "₹18–35 LPA" },
        ],
      },
    ]} />
  ),

  "top-tech-companies-pune-2026||Pune vs Bengaluru vs Hyderabad: Which City Should You Choose?": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Pune — Average SWE (all levels)", min: 8, max: 45, note: "15–20% lower cost of living" },
      { role: "Hyderabad — Average SWE (all levels)", min: 8, max: 65, note: "No state income tax" },
      { role: "Bengaluru — Average SWE (all levels)", min: 10, max: 80, note: "Highest pay, highest rent" },
    ]} caption="City comparison — effective take-home is closer due to cost-of-living differences" />
  ),

  /* top-tech-companies-chennai-2026: Industry Insights */
  "top-tech-companies-chennai-2026||Chennai Salary Benchmarks and Why Chennai is Underrated": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Fresher at IT Services (0-1 yr)", min: 3, max: 7 },
      { role: "Freshworks / Zoho (0-1 yr)", min: 8, max: 18 },
      { role: "Mid-Level Product Eng (3-5 yr)", min: 18, max: 40 },
      { role: "Senior Product Eng (5-8 yr)", min: 32, max: 65 },
      { role: "Staff / Principal (8+ yr)", min: 50, max: 80 },
    ]} caption="Chennai tech salaries 2026 — 20–25% lower cost of living vs Bengaluru improves effective value" />
  ),

  "top-tech-companies-chennai-2026||Freshworks: Chennai's NASDAQ-Listed Product Company": (
    <TierCompare cards={[
      {
        tier: "Freshworks Chennai",
        examples: "Public SaaS · CRM · ITSM · Freshdesk",
        rows: [
          { label: "SDE-1", range: "₹14–22 LPA" },
          { label: "SDE-2", range: "₹22–40 LPA" },
          { label: "Senior SDE", range: "₹38–65 LPA" },
        ],
      },
      {
        tier: "Zoho Corporation",
        examples: "Bootstrapped · 55+ products · No VC",
        rows: [
          { label: "SDE-1", range: "₹8–16 LPA" },
          { label: "SDE-2", range: "₹14–28 LPA" },
          { label: "Senior SDE", range: "₹25–45 LPA" },
        ],
      },
      {
        tier: "BFSI / Bank Tech Centres",
        examples: "Standard Chartered · DBS · BNY Mellon",
        rows: [
          { label: "SDE-1", range: "₹10–20 LPA" },
          { label: "SDE-2", range: "₹20–38 LPA" },
          { label: "Senior SDE", range: "₹32–58 LPA" },
        ],
      },
    ]} />
  ),

  /* top-tech-companies-ncr-delhi-2026: Industry Insights */
  "top-tech-companies-ncr-delhi-2026||NCR Salary Benchmarks and Why NCR is Underrated for Engineers": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Fresher at IT Services / BPO (0-1 yr)", min: 3, max: 7 },
      { role: "Travel Tech / Fintech SDE-1 (1-3 yr)", min: 12, max: 28 },
      { role: "Mid-Level SDE (3-6 yr)", min: 22, max: 50 },
      { role: "Senior SDE (6-9 yr)", min: 38, max: 72 },
      { role: "Staff / Principal / EM (9+ yr)", min: 58, max: 90 },
    ]} caption="NCR (Gurugram + Noida) tech salaries 2026 — travel tech, fintech, enterprise tech clusters" />
  ),

  "top-tech-companies-ncr-delhi-2026||Gurugram: India's Travel Tech and Fintech Capital": (
    <TierCompare cards={[
      {
        tier: "Travel Tech (Gurugram)",
        examples: "MakeMyTrip · OYO · Agoda Tech · Ixigo",
        rows: [
          { label: "SDE-1", range: "₹12–25 LPA" },
          { label: "SDE-2", range: "₹22–45 LPA" },
          { label: "Senior SDE", range: "₹38–65 LPA" },
        ],
      },
      {
        tier: "Fintech (Gurugram)",
        examples: "PolicyBazaar · PB Fintech · CredAvenue",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹20–40 LPA" },
          { label: "Senior SDE", range: "₹35–60 LPA" },
        ],
      },
      {
        tier: "Enterprise Tech (Noida)",
        examples: "Adobe Noida · HCL · Tech Mahindra · Newgen",
        rows: [
          { label: "SDE-1", range: "₹14–30 LPA" },
          { label: "SDE-2", range: "₹25–50 LPA" },
          { label: "Senior SDE", range: "₹40–75 LPA" },
        ],
      },
    ]} />
  ),

  /* ai-ml-jobs-india-2026: Industry Insights */
  "ai-ml-jobs-india-2026||AI/ML Salaries in India in 2026: The Premium Explained": (
    <SalaryLadder maxLPA={130} rows={[
      { role: "ML Fresher / Data Scientist I (0-2 yr)", min: 8, max: 22 },
      { role: "ML Engineer II (2-4 yr)", min: 20, max: 50 },
      { role: "Senior ML Engineer (4-7 yr)", min: 40, max: 80 },
      { role: "Staff MLE / Research Engineer (7-10 yr)", min: 65, max: 105 },
      { role: "Principal MLE / ML Architect (10+ yr)", min: 90, max: 130 },
    ]} caption="India AI/ML salaries 2026 — GenAI engineers command 30–50% premium over classical ML" />
  ),

  "ai-ml-jobs-india-2026||Top Companies Hiring for AI/ML Roles in India in 2026": (
    <TierCompare cards={[
      {
        tier: "Global AI Leaders",
        examples: "Google · Microsoft · Meta AI · Adobe Firefly · Nvidia",
        rows: [
          { label: "ML Engineer II", range: "₹60–110 LPA" },
          { label: "Senior MLE", range: "₹90–160 LPA" },
          { label: "Research Scientist", range: "₹100–200 LPA" },
        ],
      },
      {
        tier: "Indian AI-First",
        examples: "Sarvam AI · Krutrim · Ola AI · Swiggy AI · PhonePe AI",
        rows: [
          { label: "ML Engineer II", range: "₹25–55 LPA" },
          { label: "Senior MLE", range: "₹45–85 LPA" },
          { label: "Research Scientist", range: "₹55–100 LPA" },
        ],
      },
      {
        tier: "Traditional Co + AI",
        examples: "Zomato · Flipkart · Myntra · ShareChat · Zepto",
        rows: [
          { label: "ML Engineer II", range: "₹20–45 LPA" },
          { label: "Senior MLE", range: "₹38–70 LPA" },
          { label: "Research Scientist", range: "₹45–80 LPA" },
        ],
      },
    ]} />
  ),

  /* top-edtech-companies-india-2026: Industry Insights */
  "top-edtech-companies-india-2026||EdTech Salary Benchmarks and Why Engineers Choose EdTech in 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior SDE (0-2 yr)", min: 8, max: 18, note: "EdTech startups" },
      { role: "Mid-Level SDE (2-5 yr)", min: 16, max: 38 },
      { role: "Senior SDE (5-8 yr)", min: 28, max: 60 },
      { role: "Staff / Principal (8+ yr)", min: 45, max: 80 },
    ]} caption="EdTech salaries 2026 — PW and Scaler at top; BYJU's excluded due to financial distress" />
  ),

  "top-edtech-companies-india-2026||Honest Assessment: Which EdTech Companies Are Safe in 2026": (
    <TierCompare cards={[
      {
        tier: "Stable / Growing",
        examples: "Physics Wallah · Scaler · upGrad Enterprise",
        rows: [
          { label: "SDE-1 pay", range: "₹10–22 LPA" },
          { label: "SDE-2 pay", range: "₹20–45 LPA" },
          { label: "Layoff risk", range: "Low" },
        ],
      },
      {
        tier: "Uncertain",
        examples: "Unacademy · Vedantu · Simplilearn",
        rows: [
          { label: "SDE-1 pay", range: "₹8–18 LPA" },
          { label: "SDE-2 pay", range: "₹15–35 LPA" },
          { label: "Layoff risk", range: "Moderate" },
        ],
      },
      {
        tier: "Avoid / Distress",
        examples: "BYJU's (NDA ongoing) · WhiteHat Jr",
        rows: [
          { label: "SDE-1 pay", range: "₹6–12 LPA" },
          { label: "SDE-2 pay", range: "₹12–24 LPA" },
          { label: "Layoff risk", range: "Very high" },
        ],
      },
    ]} />
  ),

  /* top-healthtech-companies-india-2026: Industry Insights */
  "top-healthtech-companies-india-2026||HealthTech Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior SDE (0-2 yr)", min: 8, max: 20 },
      { role: "Mid-Level SDE (2-5 yr)", min: 18, max: 40 },
      { role: "Senior SDE (5-8 yr)", min: 32, max: 65 },
      { role: "Staff / Principal (8+ yr)", min: 50, max: 80 },
    ]} caption="India HealthTech salaries 2026 — Tata 1mg/Practo at upper end; Apollo Healthco mid-range" />
  ),

  "top-healthtech-companies-india-2026||Practo and Tata 1mg: India's Two Largest Digital Health Platforms": (
    <TierCompare cards={[
      {
        tier: "Tata 1mg",
        examples: "E-pharmacy · Lab tests · Tata Group backing",
        rows: [
          { label: "SDE-1", range: "₹14–28 LPA" },
          { label: "SDE-2", range: "₹26–50 LPA" },
          { label: "Senior SDE", range: "₹42–72 LPA" },
        ],
      },
      {
        tier: "Practo",
        examples: "Clinic SaaS · Teleconsult · B2C health",
        rows: [
          { label: "SDE-1", range: "₹12–22 LPA" },
          { label: "SDE-2", range: "₹20–40 LPA" },
          { label: "Senior SDE", range: "₹35–60 LPA" },
        ],
      },
      {
        tier: "Pristyn Care / MediBuddy",
        examples: "Surgical tech · Corporate wellness",
        rows: [
          { label: "SDE-1", range: "₹10–20 LPA" },
          { label: "SDE-2", range: "₹18–35 LPA" },
          { label: "Senior SDE", range: "₹30–55 LPA" },
        ],
      },
    ]} />
  ),

  /* remote-jobs-india-software-engineer-2026: Industry Insights */
  "remote-jobs-india-software-engineer-2026||Remote Salary Benchmarks: India vs Foreign-Based Employer": (
    <TierCompare cards={[
      {
        tier: "Indian Remote Employer",
        examples: "Atlassian · Zerodha · ClearTax · Remote-native startups",
        rows: [
          { label: "SDE-1 (3-5 yr)", range: "₹20–50 LPA" },
          { label: "SDE-2 (5-8 yr)", range: "₹40–80 LPA" },
          { label: "Senior (8+ yr)", range: "₹65–110 LPA" },
        ],
      },
      {
        tier: "US/EU Remote (INR equiv)",
        examples: "Toptal · Remote.com clients · US startups",
        rows: [
          { label: "SDE-1 (3-5 yr)", range: "₹40–90 LPA" },
          { label: "SDE-2 (5-8 yr)", range: "₹80–160 LPA" },
          { label: "Senior (8+ yr)", range: "₹130–250 LPA" },
        ],
      },
      {
        tier: "Contractor / Freelance",
        examples: "Upwork · Turing · Andela · Arc.dev",
        rows: [
          { label: "Mid-Level", range: "₹30–80 LPA equiv" },
          { label: "Senior", range: "₹70–150 LPA equiv" },
          { label: "Tax note", range: "GST + income tax" },
        ],
      },
    ]} />
  ),

  "remote-jobs-india-software-engineer-2026||Which Companies Hire Fully Remote Software Engineers from India in 2026": (
    <SalaryLadder maxLPA={160} rows={[
      { role: "Indian Remote-First (Zerodha, ClearTax)", min: 18, max: 65, note: "India-based salary" },
      { role: "Global SaaS Remote (Atlassian, GitLab)", min: 35, max: 95, note: "India band" },
      { role: "US Product Co Remote (Stripe, Notion)", min: 60, max: 140, note: "~USD salary, India resident" },
      { role: "US Contractor via Platform (Turing, Arc)", min: 50, max: 160, note: "Gross, pre-tax" },
    ]} caption="Remote software engineer salaries from India 2026 — foreign employer rates converted at ₹83/USD" />
  ),

  /* top-fintech-companies-india-2026: Industry Insights */
  "top-fintech-companies-india-2026||Fintech Engineer Salaries in India 2026": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Junior Fintech SDE (0-2 yr)", min: 10, max: 25 },
      { role: "Mid-Level Fintech SDE (2-5 yr)", min: 22, max: 50 },
      { role: "Senior Fintech SDE (5-8 yr)", min: 40, max: 75 },
      { role: "Staff / Principal (8+ yr)", min: 60, max: 100 },
    ]} caption="India fintech engineer salaries 2026 — payments infra (Razorpay, PhonePe) at upper band" />
  ),

  "top-fintech-companies-india-2026||India's Top Fintech Engineering Employers in 2026": (
    <TierCompare cards={[
      {
        tier: "Payments Infra",
        examples: "Razorpay · PhonePe · Juspay · BillDesk",
        rows: [
          { label: "SDE-1", range: "₹20–40 LPA" },
          { label: "SDE-2", range: "₹35–65 LPA" },
          { label: "Senior", range: "₹55–90 LPA" },
        ],
      },
      {
        tier: "Wealth / Trading",
        examples: "Groww · Zerodha · Upstox · Angel One",
        rows: [
          { label: "SDE-1", range: "₹15–30 LPA" },
          { label: "SDE-2", range: "₹25–55 LPA" },
          { label: "Senior", range: "₹45–80 LPA" },
        ],
      },
      {
        tier: "NBFC / Lending",
        examples: "Bajaj Finserv · KreditBee · MoneyView",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹18–38 LPA" },
          { label: "Senior", range: "₹32–58 LPA" },
        ],
      },
    ]} />
  ),

  /* top-gaming-companies-india-2026: Industry Insights */
  "top-gaming-companies-india-2026||Gaming Engineer Salaries in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior Game / Backend Eng (0-2 yr)", min: 8, max: 18 },
      { role: "Mid-Level Engineer (2-5 yr)", min: 16, max: 38 },
      { role: "Senior Engineer (5-8 yr)", min: 28, max: 60 },
      { role: "Staff / Lead (8+ yr)", min: 45, max: 80 },
    ]} caption="India gaming tech salaries 2026 — real-money gaming (Dream11, MPL) pays higher than game dev" />
  ),

  "top-gaming-companies-india-2026||India's Top Gaming Engineering Employers in 2026": (
    <TierCompare cards={[
      {
        tier: "Real-Money Gaming",
        examples: "Dream11 · MPL · Games24x7 · Zupee",
        rows: [
          { label: "SDE-1", range: "₹15–30 LPA" },
          { label: "SDE-2", range: "₹28–55 LPA" },
          { label: "Senior SDE", range: "₹45–78 LPA" },
        ],
      },
      {
        tier: "Mobile Game Dev",
        examples: "nCore Games · SuperGaming · Nautilus Mobile",
        rows: [
          { label: "SDE-1", range: "₹8–18 LPA" },
          { label: "SDE-2", range: "₹16–32 LPA" },
          { label: "Senior SDE", range: "₹28–50 LPA" },
        ],
      },
      {
        tier: "Global Studio India",
        examples: "Ubisoft India · EA India · Gameloft",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹20–40 LPA" },
          { label: "Senior SDE", range: "₹35–60 LPA" },
        ],
      },
    ]} />
  ),

  /* data-engineering-jobs-india-2026: Industry Insights */
  "data-engineering-jobs-india-2026||Data Engineering Salaries in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Junior Data Engineer (0-2 yr)", min: 8, max: 20 },
      { role: "Data Engineer II (2-5 yr)", min: 18, max: 42 },
      { role: "Senior Data Engineer (5-8 yr)", min: 35, max: 68 },
      { role: "Staff / Principal DE (8+ yr)", min: 55, max: 90 },
    ]} caption="India data engineering salaries 2026 — Spark + Kafka + dbt stack commands top rates" />
  ),

  "data-engineering-jobs-india-2026||Data Engineering Skills Required in India 2026": (
    <TierCompare cards={[
      {
        tier: "Core Skills (must have)",
        examples: "SQL · Python · Apache Spark · Airflow",
        rows: [
          { label: "Salary without cloud", range: "₹12–35 LPA" },
          { label: "Salary with cloud", range: "₹20–55 LPA" },
          { label: "Companies", range: "All segments" },
        ],
      },
      {
        tier: "High-Value Add-ons",
        examples: "Kafka · dbt · Delta Lake · Databricks",
        rows: [
          { label: "Salary boost", range: "+₹5–15 LPA" },
          { label: "Senior range", range: "₹45–75 LPA" },
          { label: "Companies", range: "Product + fintech" },
        ],
      },
      {
        tier: "Cloud Platforms",
        examples: "AWS Glue / Redshift · GCP BigQuery · Azure Synapse",
        rows: [
          { label: "Certification bonus", range: "+₹3–8 LPA" },
          { label: "Senior cloud DE", range: "₹40–70 LPA" },
          { label: "Companies", range: "GCCs + cloud-native" },
        ],
      },
    ]} />
  ),

  /* cloud-computing-jobs-india-2026: Industry Insights */
  "cloud-computing-jobs-india-2026||Cloud Engineering Salaries in India 2026": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Cloud Support / Jr Engineer (0-2 yr)", min: 6, max: 16 },
      { role: "Cloud Engineer II (2-5 yr)", min: 16, max: 38 },
      { role: "Senior Cloud Engineer (5-8 yr)", min: 30, max: 62 },
      { role: "Cloud Architect (8-12 yr)", min: 50, max: 90 },
      { role: "Principal / CCoE Lead (12+ yr)", min: 75, max: 100 },
    ]} caption="India cloud engineering salaries 2026 — multi-cloud + FinOps expertise pushes into architect range" />
  ),

  "cloud-computing-jobs-india-2026||Cloud Computing Roles in Highest Demand in India 2026": (
    <TierCompare cards={[
      {
        tier: "Platform / SRE",
        examples: "Kubernetes · Terraform · Prometheus · Istio",
        rows: [
          { label: "Mid-Level", range: "₹22–45 LPA" },
          { label: "Senior", range: "₹40–70 LPA" },
          { label: "Demand", range: "Very high" },
        ],
      },
      {
        tier: "Cloud Security",
        examples: "CSPM · CWPP · IAM · AWS Security Hub",
        rows: [
          { label: "Mid-Level", range: "₹20–42 LPA" },
          { label: "Senior", range: "₹38–68 LPA" },
          { label: "Demand", range: "High / fast growing" },
        ],
      },
      {
        tier: "FinOps / Architecture",
        examples: "Cost optimisation · Multi-cloud · CCoE",
        rows: [
          { label: "Architect range", range: "₹50–90 LPA" },
          { label: "Principal range", range: "₹75–110 LPA" },
          { label: "Demand", range: "Growing" },
        ],
      },
    ]} />
  ),

  /* cybersecurity-jobs-india-2026: Industry Insights */
  "cybersecurity-jobs-india-2026||Cybersecurity Salaries in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Junior Security Analyst (0-2 yr)", min: 5, max: 14 },
      { role: "Security Engineer (2-5 yr)", min: 14, max: 35 },
      { role: "Senior Security Engineer (5-8 yr)", min: 28, max: 58 },
      { role: "Security Architect (8-12 yr)", min: 48, max: 80 },
      { role: "CISO / Principal (12+ yr)", min: 70, max: 90 },
    ]} caption="India cybersecurity salaries 2026 — Cloud Security and AppSec command highest premiums" />
  ),

  "cybersecurity-jobs-india-2026||Cybersecurity Roles in Highest Demand in India 2026": (
    <TierCompare cards={[
      {
        tier: "Cloud Security",
        examples: "AWS Security Hub · CSPM · Zero Trust · IAM",
        rows: [
          { label: "Mid-Level", range: "₹20–42 LPA" },
          { label: "Senior", range: "₹38–68 LPA" },
          { label: "Demand", range: "Fastest growing" },
        ],
      },
      {
        tier: "AppSec / DevSecOps",
        examples: "SAST · DAST · Threat Modelling · OWASP",
        rows: [
          { label: "Mid-Level", range: "₹18–38 LPA" },
          { label: "Senior", range: "₹32–62 LPA" },
          { label: "Demand", range: "Very high" },
        ],
      },
      {
        tier: "SOC / GRC / Compliance",
        examples: "SIEM · ISO 27001 · DPDP · PCI-DSS",
        rows: [
          { label: "Mid-Level", range: "₹12–28 LPA" },
          { label: "Senior", range: "₹22–45 LPA" },
          { label: "Demand", range: "Stable / high" },
        ],
      },
    ]} />
  ),

  /* top-startups-hiring-engineers-india-2026: Industry Insights */
  "top-startups-hiring-engineers-india-2026||Best Startups for Engineers by Stage in 2026": (
    <TierCompare cards={[
      {
        tier: "Late-Stage / Pre-IPO",
        examples: "Zepto · Meesho · Ola Electric · PhysicsWallah · IndiGo Tech",
        rows: [
          { label: "SDE-1", range: "₹18–38 LPA" },
          { label: "SDE-2", range: "₹32–65 LPA" },
          { label: "ESOP value", range: "High if IPO" },
        ],
      },
      {
        tier: "Series B/C (Growth)",
        examples: "Cred · BrowserStack · Sarvam AI · Krutrim",
        rows: [
          { label: "SDE-1", range: "₹14–30 LPA" },
          { label: "SDE-2", range: "₹25–52 LPA" },
          { label: "ESOP value", range: "Medium-high risk" },
        ],
      },
      {
        tier: "Early Stage (Seed/A)",
        examples: "AI-first B2B SaaS · Deep tech / robotics",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹18–38 LPA" },
          { label: "ESOP value", range: "High risk / reward" },
        ],
      },
    ]} />
  ),

  "top-startups-hiring-engineers-india-2026||How to Evaluate ESOP Offers at Indian Startups": (
    <FrameworkSteps steps={[
      { number: "01", label: "Verify vesting schedule", hint: "Standard is 4-year vesting with 1-year cliff. Beware anything shorter — it signals early-exit risk." },
      { number: "02", label: "Calculate strike price vs 409A/FMV", hint: "Strike price should be at or near the FMV at grant time. A high strike vs current valuation makes options near-worthless." },
      { number: "03", label: "Check exercise window", hint: "Post-termination exercise window (PTEW) should be 5–10 years, not 90 days. 90-day windows force you to buy or lose." },
      { number: "04", label: "Understand liquidation preferences", hint: "1x non-participating is fair. 2x participating preferred means investors take double before common shareholders (you) see anything." },
      { number: "05", label: "Assess IPO or acquisition likelihood", hint: "Ask about runway, revenue, and growth rate. Options are only valuable at a liquidity event. Most Indian startups never IPO." },
    ]} />
  ),

  /* ── Role Guides & Product ── */
  /* Java Developer: salary ladder by experience level */
  "java-developer-interview-questions-india-2026||Java Developer Salary in India 2026 and Career Path": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Fresher / Trainee (0–1 yr)", min: 4, max: 10 },
      { role: "Junior Java Developer (1–3 yrs)", min: 8, max: 18 },
      { role: "Java Developer (3–5 yrs)", min: 15, max: 30 },
      { role: "Senior Java Developer (5–8 yrs)", min: 25, max: 50 },
      { role: "Lead / Principal Engineer (8+ yrs)", min: 40, max: 80 },
    ]} caption="India 2026 — Spring Boot + Microservices experience commands top of band" />
  ),
};
