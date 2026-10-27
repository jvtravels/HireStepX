import type { ReactNode } from "react";
import { RoundFlow, SalaryLadder, TierCompare, FrameworkSteps, PrepTimeline, ComparisonTable } from "../../marketing-v2/_blog-infographics";

export const SECTION_VISUALS_2: Record<string, ReactNode> = {
  "infosys-interview-questions-india-2026||Infosys Salary in India 2026": (
    <SalaryLadder maxLPA={18} rows={[
      { role: "SE – Specialist Programmer (SP)", min: 6.5, max: 9, note: "Higher track; requires strong InfyTQ score" },
      { role: "SE – Systems Engineer (Standard)", min: 3.6, max: 4.5, note: "Most campus hires; variable component included" },
      { role: "Experienced (3–5 yrs)", min: 7, max: 14, note: "Lateral; technology stack determines band" },
      { role: "Senior Consultant / Tech Lead", min: 12, max: 18, note: "Digital / cloud specialization premium" },
    ]} caption="Infosys India 2026; Bengaluru/Pune/Hyderabad; gross CTC" />
  ),

  /* cognizant-interview-questions-india-2026: Cognizant interview process and salary */
  "cognizant-interview-questions-india-2026||Cognizant Interview Process 2026: GenC and GenC Next": (
    <RoundFlow rounds={[
      { label: "Online Assessment (COCUBES / CognizantOA)", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + Coding (2 problems); GenC Next has harder problems" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, Networking), Java/Python basics, project discussion" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation preference, background, career goals; Cognizant does not have a mandatory bond" },
    ]} />
  ),

  "cognizant-interview-questions-india-2026||Cognizant Salary in India 2026": (
    <SalaryLadder maxLPA={14} rows={[
      { role: "GenC Next (Engineer)", min: 5, max: 7.5, note: "Higher track; 2-week additional tech training" },
      { role: "GenC (Programmer Analyst)", min: 3.5, max: 4.5, note: "Standard track; most campus hires" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 12, note: "Lateral hires; depends on skill and domain" },
      { role: "Senior Associate (5+ yrs)", min: 10, max: 14, note: "Specialized skills command higher bands" },
    ]} caption="Cognizant India 2026; Chennai/Bengaluru/Pune; gross CTC" />
  ),

  /* amazon-interview-questions-india-2026: Amazon interview process and salary */
  "amazon-interview-questions-india-2026||Amazon India Interview Process: All Rounds for SDE-1 and SDE-2": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2 DSA problems (medium-hard) + work simulation / debugging section; HackerRank platform" },
      { label: "Phone Screen", duration: "45 min", detail: "1 DSA problem + LP (Leadership Principles) questions; often the first human round" },
      { label: "Virtual Onsite – DSA 1", duration: "60 min", detail: "Medium-hard DSA; time/space complexity required; LPs woven in throughout" },
      { label: "Virtual Onsite – DSA 2", duration: "60 min", detail: "Second DSA round; graph, DP, or design-in-code problems; LP focus increases" },
      { label: "System Design (SDE-2+)", duration: "60 min", detail: "Distributed systems: design a feed aggregator, warehouse system, or notification platform" },
      { label: "Bar Raiser", duration: "60 min", detail: "Behavioural deep-dive on 4–5 LPs with S-T-A-R; evaluates raised-bar for Amazon culture" },
    ]} />
  ),

  "amazon-interview-questions-india-2026||Amazon India Salary 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SDE-1 (0–3 yrs)", min: 24, max: 38, note: "Base + signing bonus + RSUs (4-year vest)" },
      { role: "SDE-2 (3–6 yrs)", min: 38, max: 60, note: "RSUs form 30–40% of TC at this level" },
      { role: "SDE-3 / Senior (6+ yrs)", min: 55, max: 80, note: "Front-loaded RSU refresh grants common" },
    ]} caption="Amazon India 2026; Bengaluru/Hyderabad; total compensation including RSUs (4yr vest)" />
  ),

  /* hcl-interview-questions-india-2026: HCL interview process and salary */
  "hcl-interview-questions-india-2026||HCL Interview Process 2026: All Rounds": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + Coding (2 easy-medium problems); AMCAT or internal platform" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), core language proficiency (Java/C/C++), project walkthrough" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, background, career goals, salary expectations; HCL has no bond for standard hires" },
    ]} />
  ),

  "hcl-interview-questions-india-2026||HCL Salary in India 2026": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "Fresher – HCL TechBee", min: 1.8, max: 3, note: "12th-pass early career programme; unique track" },
      { role: "Fresher – Graduate Engineer", min: 3.5, max: 5.5, note: "Most campus hires; variable included" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 11, note: "Lateral hires; depends on tech stack" },
      { role: "Senior Engineer (5+ yrs)", min: 10, max: 16, note: "Cloud/SAP/DevOps skills command higher bands" },
    ]} caption="HCL Technologies India 2026; Noida/Bengaluru; gross CTC" />
  ),

  /* google-interview-questions-india-2026: Google India interview process and salary */
  "google-interview-questions-india-2026||Google India SWE Interview Process: All Rounds": (
    <RoundFlow rounds={[
      { label: "Resume Screen", duration: "—", detail: "Extremely selective; top-college preferred but off-campus strong portfolios also considered" },
      { label: "Phone / Video Screen", duration: "45 min", detail: "1 DSA problem (medium-hard); algorithm walk-through and complexity analysis" },
      { label: "Virtual Onsite – Coding 1", duration: "45 min", detail: "1–2 DSA problems; expects clean, working code; no psuedocode" },
      { label: "Virtual Onsite – Coding 2", duration: "45 min", detail: "Second coding round; harder problem or graph/DP/string variant" },
      { label: "Virtual Onsite – System Design", duration: "45 min", detail: "Design at Google scale: web crawler, YouTube, Maps; focus on estimation and trade-offs" },
      { label: "Googleyness Round", duration: "45 min", detail: "Leadership and culture: ambiguity, impact, collaboration; STAR-based with Google values lens" },
    ]} />
  ),

  "google-interview-questions-india-2026||Google India Salary 2026": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "L3 – SWE (New Grad / 0–2 yrs)", min: 30, max: 50, note: "Base + signing + RSUs (4yr vest); Hyderabad/Bengaluru" },
      { role: "L4 – SWE II (2–5 yrs)", min: 48, max: 75, note: "RSU refresh grants kick in; TC can hit ₹70–75L" },
      { role: "L5 – Senior SWE (5–8 yrs)", min: 70, max: 120, note: "Perf-based RSU refresh; top tier in India market" },
    ]} caption="Google India 2026; Hyderabad/Bengaluru; total compensation (base + bonus + RSUs)" />
  ),

  /* microsoft-interview-questions-india-2026: Microsoft India interview and salary */
  "microsoft-interview-questions-india-2026||Microsoft India SDE Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "2–3 DSA problems (medium difficulty); some roles include system design MCQs" },
      { label: "Technical Screen", duration: "45 min", detail: "DSA + OOP problem; evaluates code quality and communication throughout" },
      { label: "Virtual Onsite – DSA", duration: "60 min", detail: "Medium-hard DSA; Microsoft expects clean, well-reasoned code over brute force" },
      { label: "Virtual Onsite – OO Design", duration: "60 min", detail: "Object-oriented design: design a parking lot, elevator system, or chess game" },
      { label: "As Delivered / Growth Mindset", duration: "45 min", detail: "Microsoft values learning agility; questions on feedback, failure, and growth" },
    ]} />
  ),

  "microsoft-interview-questions-india-2026||Microsoft India Salary 2026": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "SDE-1 / L59 (0–2 yrs)", min: 26, max: 42, note: "Base + bonus + RSUs (4yr vest); Hyderabad/Bengaluru" },
      { role: "SDE-2 / L61 (2–5 yrs)", min: 40, max: 65, note: "RSU grants increase significantly at L61" },
      { role: "Senior SDE / L63 (5+ yrs)", min: 60, max: 100, note: "Performance-based RSU refresh; top 5% in India" },
    ]} caption="Microsoft India 2026; Hyderabad GTSC; total compensation including RSUs (4yr vest)" />
  ),

  /* flipkart-interview-questions-india-2026: Flipkart interview process and salary */
  "flipkart-interview-questions-india-2026||Flipkart SDE Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems (medium-hard); Flipkart sets a high bar comparable to Amazon" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; e-commerce domain problem scenarios (catalog, cart, inventory)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design for e-commerce scale: search ranking, seller platform, delivery optimization" },
      { label: "Hiring Manager / Culture", duration: "45 min", detail: "Flipkart culture: ownership, customer focus, speed; STAR behavioral questions + team fit" },
    ]} />
  ),

  "flipkart-interview-questions-india-2026||Flipkart Salary and Total Compensation 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "Base + bonus + ESOPs; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 55, note: "ESOP grants at Walmart-backed valuation" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 50, max: 70, note: "Walmart acquisition adds stability to ESOPs" },
    ]} caption="Flipkart India 2026; Bengaluru; Walmart-backed; total compensation including ESOPs" />
  ),

  /* leetcode-preparation-guide-india-2026: LeetCode preparation — patterns and study plan */
  "leetcode-preparation-guide-india-2026||The 10 Core DSA Patterns: LeetCode Interview Patterns": (
    <FrameworkSteps steps={[
      { number: "01", label: "Sliding Window", hint: "Subarray / substring problems with a variable-size window; TCS to Amazon level" },
      { number: "02", label: "Two Pointers", hint: "Sorted array pair problems, container with most water; frequently asked at all tiers" },
      { number: "03", label: "Fast & Slow Pointers", hint: "Cycle detection in linked lists; Floyd's algorithm; common at product companies" },
      { number: "04", label: "BFS / Level-Order", hint: "Shortest path, level-by-level tree traversal; graph problems at Flipkart / Amazon" },
      { number: "05", label: "DFS + Backtracking", hint: "Permutations, combinations, word search; medium-hard problems at top product companies" },
      { number: "06", label: "Binary Search Variants", hint: "Search in rotated array, first/last position; Google and Microsoft favor this pattern" },
      { number: "07", label: "Heap / Priority Queue", hint: "K-th largest, merge K sorted lists; asked regularly at Amazon and Microsoft" },
      { number: "08", label: "Dynamic Programming", hint: "Knapsack, LCS, coin change; hardest pattern; required for Google/Meta bar raiser" },
      { number: "09", label: "Graph Algorithms", hint: "Dijkstra, topological sort, union-find; system design-adjacent DSA at senior levels" },
      { number: "10", label: "Monotonic Stack", hint: "Next greater element, histogram area; elegant pattern; common at FAANG onsite" },
    ]} />
  ),

  "leetcode-preparation-guide-india-2026||8-Week LeetCode Study Plan: For IT Services to Mid-Product Companies": (
    <PrepTimeline caption="8-week plan targeting Infosys SP / Wipro Elite / Freshworks / Groww level" phases={[
      { period: "Week 1–2", label: "Arrays, Strings & Hashmaps", tasks: ["Easy sliding window", "Two pointer problems", "Frequency counting patterns"], milestone: "Solve 30 Easy problems fluently" },
      { period: "Week 3–4", label: "Linked Lists, Stacks & Queues", tasks: ["Reverse linked list variants", "Monotonic stack problems", "Queue BFS foundations"], milestone: "Solve 20 Medium problems" },
      { period: "Week 5–6", label: "Trees & Graphs", tasks: ["DFS/BFS on trees", "Graph traversal (BFS/DFS)", "Cycle detection"], milestone: "Solve 25 Medium tree/graph problems" },
      { period: "Week 7–8", label: "DP + Mock Contests", tasks: ["1D DP (fibonacci, climbing stairs)", "2D DP (grid paths)", "Weekly contests on LeetCode"], milestone: "Complete 2 full mock interviews" },
    ]} />
  ),

  /* goldman-sachs-india-campus-interview-guide: Goldman Sachs India campus interview */
  "goldman-sachs-india-campus-interview-guide||GS India Campus Recruitment Overview": (
    <RoundFlow rounds={[
      { label: "Online Assessment (HireVue)", duration: "60–90 min", detail: "Coding problems + quantitative aptitude + video interview questions; completed asynchronously" },
      { label: "Coding Interview", duration: "60 min", detail: "2–3 DSA problems for Engineering track; medium-hard LeetCode difficulty; focus on correctness" },
      { label: "Quantitative / Brainteaser Round", duration: "45 min", detail: "Probability, mental math, market sizing; applies to Quant and Technology Analyst tracks" },
      { label: "HR / Motivation Round", duration: "30 min", detail: "Why GS, why finance, fit with 'Our People' values; STAR behavioral questions" },
    ]} />
  ),

  "goldman-sachs-india-campus-interview-guide||Coding Interview (Engineering Track)": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "Technology Analyst (Campus)", min: 20, max: 35, note: "Base + bonus; Bengaluru/Hyderabad" },
      { role: "Associate – Technology (2–4 yrs)", min: 30, max: 50, note: "Year-end bonus can equal 30–60% of base" },
      { role: "VP – Engineering (7+ yrs)", min: 45, max: 60, note: "Bonus-heavy comp; BFSI premium over pure tech" },
    ]} caption="Goldman Sachs India 2026; Bengaluru tech centre; base + bonus (bonus excluded from base LPA shown)" />
  ),

  /* jpmorgan-chase-india-interview-guide-2026: JPMC India interview and salary */
  "jpmorgan-chase-india-interview-guide-2026||The Interview Stages": (
    <RoundFlow rounds={[
      { label: "HireVue / Online Assessment", duration: "60 min", detail: "Coding problems + video behavioral questions; Java and Python most common languages" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "DSA problem (medium) + CS fundamentals; sometimes includes finance domain questions" },
      { label: "Virtual Onsite – Coding", duration: "60 min", detail: "2 DSA problems; JPMC expects clean, production-quality code; complexity analysis required" },
      { label: "Virtual Onsite – System Design", duration: "60 min", detail: "Design a trading platform, risk management system, or transaction processing pipeline" },
      { label: "HR / Culture Round", duration: "30 min", detail: "JPMC Business Principles; integrity, client focus, diversity alignment questions" },
    ]} />
  ),

  "jpmorgan-chase-india-interview-guide-2026||Finance and Domain Knowledge": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Software Engineer Analyst (Campus)", min: 22, max: 35, note: "Base + year-end bonus; Bengaluru/Hyderabad/Mumbai" },
      { role: "Associate – SWE (3–5 yrs)", min: 35, max: 50, note: "Bonus component 20–40% of base" },
      { role: "VP – SWE (7+ yrs)", min: 45, max: 55, note: "BFSI premium for fintech/trading systems experience" },
    ]} caption="JP Morgan Chase India 2026; Bengaluru/Hyderabad; base + bonus; BFSI domain premium" />
  ),

  /* groww-fintech-interview-questions-sde-2026: Groww SDE detailed interview */
  "groww-fintech-interview-questions-sde-2026||Groww SDE Interview Stages": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems; HackerEarth; medium difficulty with some hard-level edge cases" },
      { label: "Coding Interview 1", duration: "60 min", detail: "Live DSA; graph traversal, DP, or greedy; clean code and walkthrough expected" },
      { label: "System Design (SDE-2+)", duration: "60 min", detail: "Design stock feed aggregator, trading engine, mutual fund NAV calculator, or KYC system" },
      { label: "Culture Fit / Hiring Manager", duration: "45 min", detail: "Groww values customer obsession and data-driven decisions; STAR + fintech product questions" },
    ]} />
  ),

  "groww-fintech-interview-questions-sde-2026||System Design Round (SDE-2 and Above)": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Bengaluru base; ESOPs at Series-E valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 45, note: "Significant ESOP component at growth stage" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 40, max: 55, note: "Fintech domain expertise commands premium" },
    ]} caption="Groww India 2026; Bengaluru; ESOPs included; pre-IPO valuation context" />
  ),

  /* dream11-technical-interview-questions-2026: Dream11 interview */
  "dream11-technical-interview-questions-2026||Interview Stages": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "DSA problems with sports/gaming context; medium-hard difficulty on HackerRank" },
      { label: "Coding Interview 1", duration: "60 min", detail: "Live DSA: graphs, DP, priority queues; Dream11 tests edge cases and performance constraints" },
      { label: "System Design", duration: "60 min", detail: "Design a fantasy cricket platform: real-time scoring, team selection engine, contest matching" },
      { label: "Culture / Engineering Philosophy", duration: "45 min", detail: "Dream11 engineering values: scale, low latency, high availability; product thinking for gaming" },
    ]} />
  ),

  "dream11-technical-interview-questions-2026||System Design: The Key Differentiator": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Mumbai/Bengaluru base; ESOPs at unicorn valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 45, note: "ESOP grants significant; $8B+ valuation context" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 40, max: 60, note: "Real-time systems expertise highly valued" },
    ]} caption="Dream11 India 2026; Mumbai HQ; ESOPs at unicorn valuation; total compensation" />
  ),

  /* postman-interview-process-sde-india-2026: Postman India interview */
  "postman-interview-process-sde-india-2026||Interview Stages": (
    <RoundFlow rounds={[
      { label: "Application Screen", duration: "—", detail: "Portfolio-focused; open source contributions, API projects, or developer tooling experience valued" },
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems + API design questions; medium difficulty; focus on clean problem decomposition" },
      { label: "Coding Interview", duration: "60 min", detail: "DSA + discussion of past projects; Postman values engineers who understand developer experience" },
      { label: "API Design Round", duration: "60 min", detail: "Design a REST API system, webhook delivery platform, or API gateway; core to Postman's product" },
      { label: "Culture Fit", duration: "30 min", detail: "Remote-first culture; async communication; product empathy for developers; STAR behavioral" },
    ]} />
  ),

  "postman-interview-process-sde-india-2026||API Design Round": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Bengaluru base; USD salary for remote roles sometimes offered" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "Pre-IPO ESOPs; $5.6B valuation" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 45, max: 60, note: "Remote-first; API platform expertise valued" },
    ]} caption="Postman India 2026; Bengaluru; pre-IPO ESOPs; developer tooling niche premium" />
  ),

  /* hcl-technologies-interview-questions-2026: HCL Technologies detailed guide */
  "hcl-technologies-interview-questions-2026||Selection Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude (Quantitative + Verbal + Reasoning) + 2 coding problems; AMCAT or internal test" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals: OOP (Java/C++/Python), DBMS, OS basics; project walkthrough; 1 coding problem" },
      { label: "HR Round", duration: "20 min", detail: "Location preference, background check consent, career goals, salary band for the track" },
    ]} />
  ),

  "hcl-technologies-interview-questions-2026||Compensation and Growth": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "Graduate Engineer Trainee (Fresher)", min: 3.5, max: 5.5, note: "Standard campus track; most hires" },
      { role: "HCL TechBee (Post-12th)", min: 1.8, max: 3, note: "Unique 12th-pass programme; grows to full SWE role" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 11, note: "Lateral hires; domain and tech stack matter" },
      { role: "Lead Engineer (5+ yrs)", min: 10, max: 16, note: "Cloud, DevOps, SAP skills at premium" },
    ]} caption="HCL Technologies India 2026; Noida/Bengaluru/Chennai; gross CTC" />
  ),

  /* capgemini-interview-questions-process-2026: Capgemini interview */
  "capgemini-interview-questions-process-2026||Capgemini 2026 Selection Process": (
    <RoundFlow rounds={[
      { label: "IntelliAdapt Online Test", duration: "100 min", detail: "Game-based psychometric + Aptitude (Quantitative, Verbal, Logical) + Pseudo-code + Essay" },
      { label: "Pseudo-code Round", duration: "30 min", detail: "10 pseudo-code MCQs testing programming logic without requiring a specific language" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one language depth (Java/Python/C++), project discussion" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Capgemini values; no bond required" },
    ]} />
  ),

  "capgemini-interview-questions-process-2026||Compensation for Capgemini Freshers": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "Fresher – Senior Analyst (Promote Track)", min: 5.5, max: 8, note: "Higher track based on IntelliAdapt score" },
      { role: "Fresher – Analyst (Standard)", min: 3.8, max: 5, note: "Most campus hires; variable included" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 10, note: "Lateral hires; SAP and cloud skills premium" },
    ]} caption="Capgemini India 2026; Mumbai/Pune/Chennai/Bengaluru; gross CTC" />
  ),

  /* deloitte-india-interview-guide-2026: Deloitte India interview */
  "deloitte-india-interview-guide-2026||Deloitte USI Campus Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + Coding (2 problems for tech roles); some roles include case MCQs" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals for USI tech roles; Java/Python depth; cloud (AWS/Azure) awareness helpful" },
      { label: "Deloitte Case Interview", duration: "40 min", detail: "For Consulting track only: structured case (market entry, profitability, operations); MECE framing" },
      { label: "HR / Partner Round", duration: "30 min", detail: "Motivation, values fit, STAR behavioral questions; Deloitte 'Green Dot' culture alignment" },
    ]} />
  ),

  "deloitte-india-interview-guide-2026||Technical Interview for Technology Roles": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Analyst – USI Technology (Fresher)", min: 6.5, max: 10, note: "Bengaluru/Hyderabad; cloud, Java, SAP roles" },
      { role: "Consultant – Technology (2–4 yrs)", min: 12, max: 22, note: "Lateral hires; certification premium" },
      { role: "Analyst – Consulting (Fresher MBA)", min: 15, max: 22, note: "IIM/ISB hires; consulting track" },
      { role: "Consultant – Strategy (3–5 yrs)", min: 20, max: 35, note: "Post-MBA or internal promotion; Bengaluru/Mumbai" },
    ]} caption="Deloitte India 2026; USI + Consulting tracks; gross CTC varies significantly by track" />
  ),

  /* tech-mahindra-interview-questions-2026: Tech Mahindra interview */
  "tech-mahindra-interview-questions-2026||Tech Mahindra Hiring Process Overview": (
    <RoundFlow rounds={[
      { label: "SmartHire Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Logical + Coding (2 problems); Digital track has a harder coding section" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, Networking), one language proficiency, project discussion" },
      { label: "Communication Assessment", duration: "15 min", detail: "Versant or spoken English test; eliminates candidates with weak English communication" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Tech Mahindra values; no mandatory bond for most tracks" },
    ]} />
  ),

  "tech-mahindra-interview-questions-2026||Compensation and Growth at Tech Mahindra": (
    <SalaryLadder maxLPA={14} rows={[
      { role: "Fresher – Digital Track", min: 4.5, max: 7, note: "Higher package for strong aptitude + coding score" },
      { role: "Fresher – ELP (Standard)", min: 3.25, max: 4.5, note: "Most campus hires; variable pay included" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 11, note: "Lateral; 5G, cloud, and SAP skills premium" },
      { role: "Senior Engineer (5+ yrs)", min: 9, max: 14, note: "Telecom domain expertise adds significant premium" },
    ]} caption="Tech Mahindra India 2026; Pune/Hyderabad/Bengaluru; gross CTC" />
  ),

  /* mckinsey-case-interview-india-guide: McKinsey India interview */
  "mckinsey-case-interview-india-guide||Case Interview Structure": (
    <RoundFlow rounds={[
      { label: "Problem Solving Game (PSG)", duration: "35 min", detail: "Ecosystem game testing data interpretation, pattern recognition, and systems thinking; online" },
      { label: "First Round Cases (×2)", duration: "60 min", detail: "Two back-to-back case interviews; structured case solving + personal experience questions (PEI)" },
      { label: "Final Round Cases (×2–3)", duration: "90 min", detail: "Senior partner-led cases; more ambiguous; heavier weight on leadership and impact stories" },
      { label: "Personal Experience Interview (PEI)", duration: "Integrated", detail: "McKinsey DRIVE values: delivering impact, leading others, problem solving, entrepreneurship" },
    ]} />
  ),

  "mckinsey-case-interview-india-guide||McKinsey India Hiring Overview": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Business Analyst (Fresher / MBA)", min: 18, max: 28, note: "Mumbai/Gurugram; signing bonus + performance bonus" },
      { role: "Associate (MBA / 3 yrs exp)", min: 28, max: 45, note: "Post-IIM/ISB MBA hires; performance bonus significant" },
      { role: "Engagement Manager (6+ yrs)", min: 40, max: 55, note: "Partner track; bonus can double take-home" },
    ]} caption="McKinsey India 2026; Mumbai/Gurugram/Bengaluru; base + performance bonus; not including profit sharing" />
  ),

  /* oracle-india-interview-guide-2026: Oracle India interview */
  "oracle-india-interview-guide-2026||Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (medium) + Java/SQL MCQs; Oracle favors Java depth from the first screen" },
      { label: "Technical Interview 1", duration: "60 min", detail: "Core Java: JVM, collections, multithreading, JDBC; DSA problem-solving with Java" },
      { label: "Technical Interview 2", duration: "60 min", detail: "Database depth: SQL, PL/SQL, Oracle DB internals; distributed systems design for cloud products" },
      { label: "Hiring Manager / HR", duration: "30 min", detail: "Cultural fit, product interest (Fusion, Cloud, APEX), career goals, relocation" },
    ]} />
  ),

  "oracle-india-interview-guide-2026||Compensation at Oracle India": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "IC1 / MTS (0–2 yrs)", min: 18, max: 28, note: "Hyderabad/Bengaluru base; Oracle stock (ORC)" },
      { role: "IC2 / Senior MTS (2–5 yrs)", min: 28, max: 45, note: "RSU component at NYSE-listed ORCL valuation" },
      { role: "IC3 / Staff Engineer (5–8 yrs)", min: 40, max: 65, note: "Cloud (OCI) team premium over on-prem product teams" },
    ]} caption="Oracle India 2026; Hyderabad/Bengaluru; total compensation including RSUs (4yr vest)" />
  ),

  /* ibm-india-interview-guide-2026: IBM India interview */
  "ibm-india-interview-guide-2026||IBM Campus Hiring Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment (IPAT)", duration: "72 min", detail: "IBM Placement Aptitude Test: Verbal + Logical + Quantitative + Coding MCQs; adaptive difficulty" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals, one language depth, cloud awareness (IBM Cloud / AWS); project walkthrough" },
      { label: "IBM Consulting Interview", duration: "45 min", detail: "For consulting/GBS hires: case discussion, stakeholder scenarios, analytical reasoning" },
      { label: "HR Interview", duration: "20 min", detail: "IBMer values: trust, innovation, growth; relocation, career goals, compensation discussion" },
    ]} />
  ),

  "ibm-india-interview-guide-2026||IBM Compensation in India": (
    <SalaryLadder maxLPA={18} rows={[
      { role: "Application Developer (Fresher)", min: 4.5, max: 7, note: "IBM Technology unit; Bengaluru/Hyderabad/Pune" },
      { role: "IBM Consulting Analyst (Fresher)", min: 7, max: 10, note: "GBS/Consulting unit; MBA or tech graduates" },
      { role: "Advisory Consultant (3–5 yrs)", min: 12, max: 18, note: "Lateral hires; SAP, Salesforce, cloud skills" },
    ]} caption="IBM India 2026; across business units (Technology vs Consulting); gross CTC" />
  ),

  /* cognizant-genc-interview-questions-2026: Cognizant GenC interview */
  "cognizant-genc-interview-questions-2026||Cognizant Online Assessment": (
    <RoundFlow rounds={[
      { label: "Online Assessment (COCUBES)", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + 2 coding problems; GenC Elevate has harder coding section" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, Networking), one language proficiency (Java/Python/C++)" },
      { label: "HR Interview", duration: "20 min", detail: "Cognizant values, relocation flexibility, career goals; salary discussion; no bond requirement" },
    ]} />
  ),

  "cognizant-genc-interview-questions-2026||GenC vs GenC Elevate: Two Tracks": (
    <TierCompare cards={[
      {
        tier: "GenC (Programmer Analyst)",
        examples: "Most campus hires",
        rows: [
          { label: "CTC", range: "₹3.5–4.5 LPA" },
          { label: "Coding Difficulty", range: "Easy–Medium" },
          { label: "Training", range: "Standard Lex platform" },
          { label: "Target Colleges", range: "Tier 2–3 engineering colleges" },
        ],
      },
      {
        tier: "GenC Elevate / Next",
        examples: "Top campus scorers",
        rows: [
          { label: "CTC", range: "₹5–7.5 LPA" },
          { label: "Coding Difficulty", range: "Medium–Hard" },
          { label: "Training", range: "2-week additional specialisation" },
          { label: "Target Colleges", range: "NIT / BITS / top state NITs" },
        ],
      },
    ]} />
  ),

  /* accenture-interview-questions-india-2026: Accenture India interview */
  "accenture-interview-questions-india-2026||Accenture Campus Selection Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment (Accenture OA)", duration: "120 min", detail: "Cognitive (Aptitude + Logical) + Technical MCQs + Coding (2 problems) + Communication test (Versant)" },
      { label: "Communication Test (Versant)", duration: "20 min", detail: "Spoken English fluency test; eliminates many candidates; scored 20–80; 54+ required for ASE track" },
      { label: "Technical Interview (ASE Track)", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one language depth, projects; ASE track is developer-focused" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Accenture values; salary disclosure; no mandatory bond" },
    ]} />
  ),

  "accenture-interview-questions-india-2026||Compensation and Growth at Accenture India": (
    <SalaryLadder maxLPA={15} rows={[
      { role: "ASE – Associate Software Engineer (Fresher)", min: 4.5, max: 7, note: "Developer track; higher than standard" },
      { role: "SE – Software Engineer (Standard)", min: 3.5, max: 4.5, note: "Most campus hires entering standard track" },
      { role: "Experienced (2–4 yrs)", min: 7, max: 12, note: "Lateral; SAP, Salesforce, Workday skills premium" },
      { role: "Tech Lead / Manager (5+ yrs)", min: 10, max: 15, note: "Cloud and digital transformation skills" },
    ]} caption="Accenture India 2026; Bengaluru/Hyderabad/Pune/Chennai; gross CTC" />
  ),

  /* google-india-off-campus-how-to-crack: Google India off-campus process */
  "google-india-off-campus-how-to-crack||The Google India Interview Process": (
    <RoundFlow rounds={[
      { label: "Resume Screen", duration: "—", detail: "Off-campus: LinkedIn / careers.google.com referrals; strong OSS portfolio or contest wins help" },
      { label: "Recruiter Call", duration: "30 min", detail: "Background, experience, role fit; prepare a 2-minute intro and questions about the team" },
      { label: "Phone Screen", duration: "45 min", detail: "1 DSA problem (medium-hard); think aloud; discuss time/space complexity and optimisations" },
      { label: "Virtual Onsite – Coding ×2", duration: "45 min each", detail: "Two separate coding rounds; medium-hard LeetCode; clean, tested code expected" },
      { label: "Virtual Onsite – System Design", duration: "45 min", detail: "Design at Google scale (crawler, YouTube, Maps); estimation, sharding, replication, trade-offs" },
      { label: "Googleyness Round", duration: "45 min", detail: "Culture and leadership questions; STAR format; Google values: ambiguity, collaboration, impact" },
    ]} />
  ),

  "google-india-off-campus-how-to-crack||DSA Preparation for Google India": (
    <PrepTimeline caption="16-week plan for Google India off-campus readiness" phases={[
      { period: "Week 1–4", label: "Core Patterns", tasks: ["Arrays, strings, hashmaps", "Two pointers, sliding window", "Binary search variants", "Linked lists and stacks"], milestone: "75 LeetCode Easy/Medium solved" },
      { period: "Week 5–8", label: "Trees and Graphs", tasks: ["DFS/BFS on trees", "Graph traversal and cycle detection", "Topological sort, Dijkstra"], milestone: "50 Medium graph/tree problems" },
      { period: "Week 9–12", label: "DP and Advanced", tasks: ["1D and 2D dynamic programming", "Backtracking and recursion", "Monotonic stack, heap problems"], milestone: "40 Medium-Hard DP problems" },
      { period: "Week 13–16", label: "Mock + System Design", tasks: ["Weekly LeetCode contests", "4 full mock interviews", "System design (Grokking the System Design)"], milestone: "Interview-ready with full mock score" },
    ]} />
  ),

  /* infosys-infytq-preparation-guide-2026: Infosys InfyTQ guide */
  "infosys-infytq-preparation-guide-2026||SE vs SP: Two Very Different Tracks": (
    <TierCompare cards={[
      {
        tier: "SE – Systems Engineer",
        examples: "Standard campus track",
        rows: [
          { label: "CTC", range: "₹3.6–4.5 LPA" },
          { label: "Coding Difficulty", range: "Easy–Medium" },
          { label: "InfyTQ Required", range: "Yes (Score 60%+)" },
          { label: "Training", range: "4–6 months Lex + Mysuru" },
        ],
      },
      {
        tier: "SP – Specialist Programmer",
        examples: "High scorers / referrals",
        rows: [
          { label: "CTC", range: "₹6.5–9 LPA" },
          { label: "Coding Difficulty", range: "Hard (2 Medium-Hard problems)" },
          { label: "InfyTQ Required", range: "Yes (Score 80%+ + separate test)" },
          { label: "Training", range: "Shorter; specialised project allocation" },
        ],
      },
    ]} />
  ),

  "infosys-infytq-preparation-guide-2026||SP (Specialist Programmer) Selection Process": (
    <RoundFlow rounds={[
      { label: "InfyTQ Certification", duration: "Variable", detail: "Complete InfyTQ courses + pass quizzes; score 80%+ needed for SP track eligibility" },
      { label: "SP Online Assessment", duration: "90 min", detail: "2 hard coding problems (LeetCode Medium-Hard); strict time limit; Java or Python recommended" },
      { label: "SP Technical Interview", duration: "60 min", detail: "DSA depth, system design basics, CS fundamentals; live coding may be asked on harder problems" },
      { label: "HR Interview", duration: "20 min", detail: "Background, SP programme motivation, career goals; SP track typically placed in product-facing teams" },
    ]} />
  ),

  /* microsoft-india-interview-guide-2026: Microsoft India interview guide */
  "microsoft-india-interview-guide-2026||Microsoft SDE Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "2–3 DSA problems (medium difficulty); sometimes includes a debugging problem" },
      { label: "Technical Screen", duration: "45 min", detail: "DSA problem (medium) + OOP discussion; code quality and communication evaluated" },
      { label: "Virtual Onsite – DSA", duration: "60 min", detail: "Medium-hard DSA; Microsoft expects optimal solutions with clean code and edge case handling" },
      { label: "Virtual Onsite – OO Design", duration: "60 min", detail: "Object-oriented design problem; parking lot, elevator, or e-commerce cart commonly asked" },
      { label: "Growth Mindset / Culture Round", duration: "45 min", detail: "Microsoft's 'As Delivered' culture; questions on failure, learning, feedback, and collaboration" },
    ]} />
  ),

  "microsoft-india-interview-guide-2026||System Design for Microsoft India": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "SDE-1 / L59 (0–2 yrs)", min: 26, max: 42, note: "Base + bonus + RSUs; Hyderabad IDC / Bengaluru" },
      { role: "SDE-2 / L61 (2–5 yrs)", min: 40, max: 65, note: "RSU grants increase significantly; PRISM bonus" },
      { role: "Senior SDE / L63 (5+ yrs)", min: 60, max: 100, note: "Performance-based RSU refresh every 2 years" },
    ]} caption="Microsoft India 2026; Hyderabad IDC; total compensation including RSUs (4yr vest)" />
  ),

  /* ltimindtree-interview-questions-2026: LTIMindtree interview */
  "ltimindtree-interview-questions-2026||Online Assessment": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Logical + Coding (2 medium problems); harder than TCS/Infosys OA" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one language in depth, project walkthrough; some system design" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, LTIMindtree merger context; no mandatory bond" },
    ]} />
  ),

  "ltimindtree-interview-questions-2026||Compensation and Growth": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "Fresher – Engineer (Campus)", min: 5, max: 7.5, note: "Higher than TCS/Infosys; post-merger packages" },
      { role: "Experienced (2–4 yrs)", min: 8, max: 13, note: "Lateral hires; SAP, Salesforce, cloud premium" },
      { role: "Lead / Senior Engineer (5+ yrs)", min: 11, max: 16, note: "BSE-listed company; stable growth path" },
    ]} caption="LTIMindtree India 2026; Mumbai/Pune/Bengaluru; gross CTC (BSE-listed)" />
  ),

  /* adobe-india-interview-guide-2026: Adobe India interview */
  "adobe-india-interview-guide-2026||Interview Process at Adobe India": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); Adobe sets a high bar comparable to Google/Microsoft" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA problem + CS fundamentals; clean code, optimal solutions, time/space complexity required" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design or low-level design (OOP design); design a PDF renderer, photo editor, or analytics" },
      { label: "Hiring Manager / Culture", duration: "45 min", detail: "Adobe values: genuine, exceptional, innovative; product thinking for creative and document tools" },
    ]} />
  ),

  "adobe-india-interview-guide-2026||Compensation at Adobe India": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "MTS-1 / SDE-1 (0–2 yrs)", min: 22, max: 35, note: "Noida/Bengaluru base; NASDAQ RSUs (ADBE)" },
      { role: "MTS-2 / SDE-2 (2–5 yrs)", min: 35, max: 55, note: "Significant RSU component at MTS-2 level" },
      { role: "Senior MTS / Staff (5–8 yrs)", min: 50, max: 75, note: "Adobe pays top-quartile in India market" },
    ]} caption="Adobe India 2026; Noida + Bengaluru; total compensation including NASDAQ RSUs (4yr vest)" />
  ),

  /* tcs-nqt-preparation-guide-2026: TCS NQT newer guide */
  "tcs-nqt-preparation-guide-2026||TCS NQT exam structure 2026": (
    <ComparisonTable
      columns={[{ name: "Section" }, { name: "Questions" }, { name: "Time (min)" }, { name: "Key Topics", highlight: true }]}
      rows={[
        { label: "Verbal Ability", values: ["24", "30", "RC passages, grammar, vocabulary"] },
        { label: "Reasoning Ability", values: ["30", "50", "Syllogisms, arrangements, series"] },
        { label: "Numerical Ability", values: ["26", "40", "Ratios, percentages, number series"] },
        { label: "Programming Logic", values: ["10", "15", "Pseudo-code, output prediction"] },
        { label: "Coding Round", values: ["2", "30", "Arrays, strings, basic DP"] },
        { label: "Advanced Coding (Optional)", values: ["1", "20", "Graphs, DP (Prime/Ninja only)"] },
      ]}
      caption="TCS NQT 2026; total ~165 min; higher tracks (Digital/Prime) require higher sectional cutoffs"
    />
  ),

  "tcs-nqt-preparation-guide-2026||TCS NQT tracks and packages": (
    <TierCompare cards={[
      {
        tier: "Ninja Track",
        examples: "Standard campus package",
        rows: [
          { label: "CTC", range: "₹3.36 LPA" },
          { label: "NQT Score", range: "Meets basic cutoff" },
          { label: "Coding", range: "Easy problems" },
          { label: "Profile", range: "Application dev, testing" },
        ],
      },
      {
        tier: "Digital Track",
        examples: "Higher-scoring candidates",
        rows: [
          { label: "CTC", range: "₹7–9 LPA" },
          { label: "NQT Score", range: "Higher cutoff + advanced coding" },
          { label: "Coding", range: "Medium-Hard problems" },
          { label: "Profile", range: "Cloud, analytics, AI/ML projects" },
        ],
      },
    ]} />
  ),

  /* flipkart-interview-questions-2026: Flipkart newer interview guide */
  "flipkart-interview-questions-2026||Flipkart interview process overview": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems (medium-hard); HackerRank; Flipkart bar is comparable to Amazon" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + product domain questions; e-commerce scenarios (search ranking, pricing, catalog)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: design seller onboarding, delivery routing, or real-time inventory at scale" },
      { label: "Hiring Manager", duration: "45 min", detail: "Culture, ownership, speed; STAR behavioral questions with Flipkart-specific value framing" },
    ]} />
  ),

  "flipkart-interview-questions-2026||Flipkart SDE compensation 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "Bengaluru base; Walmart-backed ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 55, note: "ESOP value linked to Walmart backing" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 50, max: 70, note: "Walmart acquisition adds stability and upside" },
    ]} caption="Flipkart India 2026; Bengaluru HQ; total compensation including ESOPs" />
  ),

  /* razorpay-interview-questions-2026: Razorpay interview */
  "razorpay-interview-questions-2026||Razorpay interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); payments domain context sometimes embedded in problems" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; Razorpay evaluates system thinking for financial systems" },
      { label: "System Design", duration: "60 min", detail: "Design a payment gateway, payout system, fraud detection, or reconciliation engine" },
      { label: "Culture / Hiring Manager", duration: "45 min", detail: "Razorpay values hustle, ownership, and frugality; questions on working under ambiguity at scale" },
    ]} />
  ),

  "razorpay-interview-questions-2026||Razorpay compensation 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Bengaluru base; ESOPs at $7.5B valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "Strong ESOP component; fintech premium" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 45, max: 60, note: "Pre-IPO upside; B2B fintech domain expertise" },
    ]} caption="Razorpay India 2026; Bengaluru HQ; pre-IPO ESOPs at $7.5B valuation" />
  ),

  /* zomato-interview-questions-india-2026: Zomato interview */
  "zomato-interview-questions-india-2026||Zomato interview process 2026": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "DSA problems (medium-hard); food delivery domain framing common; Zomato bar is competitive" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; geospatial algorithms, ETA models, restaurant search at scale" },
      { label: "System Design", duration: "60 min", detail: "Design a food delivery dispatch system, real-time restaurant feed, or order tracking pipeline" },
      { label: "Culture / Hiring Manager", duration: "45 min", detail: "Zomato culture: customer first, frugality, data-driven; questions on impact and ownership" },
    ]} />
  ),

  "zomato-interview-questions-india-2026||Zomato system design questions": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 30, note: "Gurugram/Bengaluru base; BSE-listed ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 48, note: "Public stock (NSE/BSE: ZOMATO); listed upside" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 42, max: 60, note: "Food-tech domain expertise valued; Blinkit synergy" },
    ]} caption="Zomato India 2026; Gurugram HQ; listed stock on NSE/BSE included in TC" />
  ),

  /* phonepe-interview-questions-2026: PhonePe shorter guide */
  "phonepe-interview-questions-2026||PhonePe interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); UPI and fintech domain framing common" },
      { label: "Coding Interview", duration: "60 min", detail: "Live DSA with focus on correctness and optimization; payments domain problems possible" },
      { label: "System Design", duration: "60 min", detail: "Design a UPI payment system, money transfer engine, or fraud detection pipeline" },
      { label: "Hiring Manager / Culture", duration: "45 min", detail: "PhonePe values ownership and builder mindset; STAR behavioral questions" },
    ]} />
  ),

  "phonepe-interview-questions-2026||PhonePe compensation 2026": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Bengaluru base; ESOPs at Walmart-backed valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "ESOP package at pre-IPO valuation; strong upside" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 45, max: 65, note: "Walmart ownership adds credibility and stability" },
    ]} caption="PhonePe India 2026; Bengaluru; ESOPs at Walmart-backed pre-IPO valuation" />
  ),

  /* cred-interview-questions-2026: CRED shorter guide */
  "cred-interview-questions-2026||CRED interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Hard-level DSA; CRED sets one of the highest bars in Indian product companies" },
      { label: "Technical Interview 1", duration: "75 min", detail: "DSA + system design basics; code quality and clarity are evaluated very strictly" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design for credit infrastructure, fraud detection, or high-concurrency payment flows" },
      { label: "Culture / Founder Round", duration: "45 min", detail: "CRED values: high-trust, high-taste; questions on craftsmanship, ownership, and discernment" },
    ]} />
  ),

  "cred-interview-questions-2026||CRED compensation 2026": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "SDE-1 (0–3 yrs)", min: 25, max: 40, note: "Bengaluru base; pre-IPO ESOPs at Series-F" },
      { role: "SDE-2 (3–6 yrs)", min: 38, max: 58, note: "Significant ESOP grants; CRED values retention" },
      { role: "SDE-3 / Senior (6+ yrs)", min: 50, max: 75, note: "Top-decile in India market; very selective hiring" },
    ]} caption="CRED India 2026; Bengaluru; pre-IPO ESOPs; highly selective — low offer volume" />
  ),

  /* meesho-interview-questions-2026: Meesho shorter guide */
  "meesho-interview-questions-2026||Meesho interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); Meesho's bar is comparable to Flipkart" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; social commerce scenarios (seller onboarding, catalog, logistics)" },
      { label: "System Design", duration: "60 min", detail: "Design a product feed for Tier-2 India, order routing, or supplier dashboard at scale" },
      { label: "Hiring Manager", duration: "45 min", detail: "Meesho values frugality and impact at scale; questions on doing more with less resources" },
    ]} />
  ),

  "meesho-interview-questions-2026||Meesho compensation 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Bengaluru base; pre-IPO ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 42, note: "ESOP grants at Series-F valuation" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 38, max: 50, note: "Social commerce domain expertise valued" },
    ]} caption="Meesho India 2026; Bengaluru; pre-IPO ESOPs; Series-F valuation context" />
  ),

  /* freshworks-interview-questions-2026: Freshworks shorter guide */
  "freshworks-interview-questions-2026||Freshworks interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems on HackerRank; CS fundamentals MCQs; medium difficulty" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA problem-solving + project discussion; SaaS product thinking sometimes tested" },
      { label: "System Design", duration: "60 min", detail: "Multi-tenant SaaS design: rate limiting, webhooks, tenant isolation, API gateway patterns" },
      { label: "Hiring Manager", duration: "45 min", detail: "Freshworks culture: ownership, frugality, customer obsession; STAR behavioral questions" },
    ]} />
  ),

  "freshworks-interview-questions-2026||Freshworks compensation 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Chennai/Bengaluru base; NASDAQ RSUs (FRSH)" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 38, note: "Public RSUs add significant upside at SDE-2+" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 35, max: 55, note: "NASDAQ-listed; RSU component grows with level" },
    ]} caption="Freshworks India 2026; Chennai + Bengaluru; total compensation including NASDAQ RSUs" />
  ),

  /* zerodha-interview-questions-india-2026: Zerodha interview */
  "zerodha-interview-questions-india-2026||Zerodha's unique hiring approach": (
    <FrameworkSteps steps={[
      { number: "01", label: "No Standard OA", hint: "Zerodha does not use HackerRank or AMCAT; expect a coding assignment or GitHub portfolio review" },
      { number: "02", label: "Take-Home Assignment", hint: "Build a small functional feature (API, CLI tool, or frontend widget); emphasises real code over LeetCode" },
      { number: "03", label: "Technical Discussion", hint: "Walk through your take-home assignment; discuss trade-offs, scalability, and tech decisions you made" },
      { number: "04", label: "Culture Interview", hint: "Zerodha values radical transparency and self-motivation; questions on why you trade or use Kite" },
      { number: "05", label: "Founder / Team Lead Round", hint: "Small team culture; expect to talk directly with a senior engineer or Nithin Kamath's team" },
    ]} />
  ),

  "zerodha-interview-questions-india-2026||Zerodha compensation 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 15, max: 25, note: "Bengaluru; no ESOPs but profit-sharing culture" },
      { role: "Senior Engineer (2–5 yrs)", min: 25, max: 40, note: "Zerodha shares profits; culture of ownership" },
      { role: "Lead / Principal (5+ yrs)", min: 35, max: 50, note: "Highly selective; very low attrition once hired" },
    ]} caption="Zerodha India 2026; Bengaluru; private bootstrapped company; profit-sharing model" />
  ),

  /* paytm-interview-questions-2026: Paytm shorter guide */
  "paytm-interview-questions-2026||Paytm interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); SQL and system design MCQs for some roles" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; fintech scenarios (payment gateway, wallet, QR code systems)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design for high-volume payment flows, UPI integration, or merchant onboarding" },
      { label: "HR / Culture", duration: "30 min", detail: "Questions on adaptability post-restructuring; Paytm values resilience and customer focus" },
    ]} />
  ),

  "paytm-interview-questions-2026||Paytm compensation 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Noida/Bengaluru base; listed ESOPs post-restructuring" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 35, note: "NSE-listed (PAYTM); public stock component" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 30, max: 45, note: "Fintech domain expertise valued; stable post-RBI" },
    ]} caption="Paytm India 2026; Noida HQ; NSE-listed stock (PAYTM); post-restructuring context" />
  ),

  /* zoho-interview-questions-2026: Zoho interview */
  "zoho-interview-questions-2026||Zoho interview process": (
    <RoundFlow rounds={[
      { label: "Written Test", duration: "120 min", detail: "Aptitude + Programming logic; paper-based or online; focus on problem-solving, not frameworks" },
      { label: "Coding Interview", duration: "60 min", detail: "Write actual working code on a computer; Zoho values clean, readable, efficient logic" },
      { label: "Technical Discussion", duration: "60 min", detail: "Deep dive on CS fundamentals, past projects, and product knowledge of Zoho's suite" },
      { label: "HR / Culture Round", duration: "30 min", detail: "Zoho values long-term commitment and self-sufficiency; family-like work culture discussed" },
    ]} />
  ),

  "zoho-interview-questions-2026||Zoho compensation 2026": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "Member Technical Staff (Fresher)", min: 4, max: 7, note: "Chennai base; no ESOPs (private company)" },
      { role: "Senior Technical Staff (2–5 yrs)", min: 8, max: 14, note: "Salary grows with tenure; very low attrition" },
      { role: "Technical Lead (5+ yrs)", min: 12, max: 20, note: "Bootstrapped; stable; ESOP equivalent via profit share" },
    ]} caption="Zoho India 2026; Chennai HQ; bootstrapped private company; no ESOPs but profit culture" />
  ),

  /* how-to-crack-wipro-interview-2026: Wipro cracking guide */
  "how-to-crack-wipro-interview-2026||Wipro NLTH process for freshers": (
    <RoundFlow rounds={[
      { label: "WNTH Online Assessment", duration: "120 min", detail: "Aptitude + Verbal + Reasoning + Essay + 2 Coding problems; Elite NLTH has harder coding section" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, Networking), one language in depth, project walkthrough" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Wipro Spirit values; salary band confirmed; bond of 1 year" },
    ]} />
  ),

  "how-to-crack-wipro-interview-2026||Wipro compensation 2026": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "Fresher – Elite NLTH (Turbo)", min: 6.5, max: 10, note: "Top-scoring candidates; cloud/analytics projects" },
      { role: "Fresher – NLTH (Standard)", min: 3.5, max: 5, note: "Most campus hires; 1-year bond" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 12, note: "Lateral hires; SAP, Salesforce, cloud attract premium" },
    ]} caption="Wipro India 2026; Bengaluru/Hyderabad/Pune; gross CTC; 1-year bond for freshers" />
  ),

  /* how-to-crack-infosys-interview-2026: Infosys cracking guide */
  "how-to-crack-infosys-interview-2026||Infosys interview process by track": (
    <RoundFlow rounds={[
      { label: "InfyTQ / HackWithInfy", duration: "95 min", detail: "Online test: Aptitude + Verbal + Reasoning + 2 Coding problems; SP track needs harder coding" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, DSA); Java or Python in depth; project walkthrough required" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, salary expectations; Infosys SE track has no bond requirement" },
    ]} />
  ),

  "how-to-crack-infosys-interview-2026||Infosys compensation 2026": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "SP – Specialist Programmer", min: 6.5, max: 9, note: "Top track; strong InfyTQ + separate SP test" },
      { role: "SE – Systems Engineer (Standard)", min: 3.6, max: 4.5, note: "Most campus hires; variable pay included" },
      { role: "Experienced (3–5 yrs)", min: 7, max: 13, note: "Lateral; cloud and digital transformation premium" },
      { role: "Senior Consultant (6+ yrs)", min: 11, max: 16, note: "Digital / cloud specialization" },
    ]} caption="Infosys India 2026; Bengaluru/Pune/Hyderabad/Mysuru; gross CTC" />
  ),

  /* ── Company Guides B ── */
  /* accenture-interview-questions-2026: Interview process and compensation */
  "accenture-interview-questions-2026||Accenture hiring tracks and the interview process": (
    <RoundFlow rounds={[
      { label: "Cognitive & Technical Assessment", duration: "90 min", detail: "Verbal, quant, logical reasoning + 15 coding MCQs" },
      { label: "Communication Assessment", duration: "30 min", detail: "Versant spoken English test — hidden eliminator" },
      { label: "Technical Interview", duration: "45 min", detail: "OOP, DBMS, OS, one DSA question (ASE track only)" },
      { label: "HR Round", duration: "20 min", detail: "Motivation, relocation, joining timeline" },
    ]} />
  ),
  "accenture-interview-questions-2026||Accenture compensation 2026": (
    <SalaryLadder maxLPA={22} rows={[
      { role: "Associate Software Engineer (ASE)", min: 4.5, max: 5.5, note: "Standard track" },
      { role: "Software Engineer (SE — packaged campus)", min: 6.5, max: 9, note: "Merit/referral track" },
      { role: "SE with 2–3 yrs exp (lateral)", min: 9, max: 14 },
      { role: "SSE / Tech Lead (5+ yrs)", min: 14, max: 22 },
    ]} caption="Accenture India CTC 2026 — variable component ~15% of fixed" />
  ),

  /* cognizant-interview-questions-2026: Hiring tracks and compensation */
  "cognizant-interview-questions-2026||Cognizant hiring tracks": (
    <RoundFlow rounds={[
      { label: "GenC Online Assessment", duration: "90 min", detail: "Reasoning, English, quant + coding section" },
      { label: "GenC Elevate Coding Round", duration: "60 min", detail: "2 DSA problems, Medium difficulty" },
      { label: "Technical Interview", duration: "45 min", detail: "OOP, SQL, project discussion, one DSA trace" },
      { label: "HR Round", duration: "20 min", detail: "Bond clarification, relocation, motivation" },
    ]} />
  ),
  "cognizant-interview-questions-2026||Cognizant compensation and career": (
    <SalaryLadder maxLPA={18} rows={[
      { role: "GenC (Programmer Analyst Trainee)", min: 3.5, max: 4.5, note: "Standard fresher track" },
      { role: "GenC Elevate (Programmer Analyst)", min: 5.5, max: 7, note: "Elevated campus track" },
      { role: "Programmer Analyst (2–3 yrs)", min: 7, max: 11 },
      { role: "Senior Programmer Analyst (4–6 yrs)", min: 11, max: 18 },
    ]} caption="Cognizant India CTC 2026 — annual appraisal cycles in March" />
  ),

  /* wipro-interview-questions-2026: Tracks and compensation */
  "wipro-interview-questions-2026||Wipro Hiring Tracks: NTH vs Elite": (
    <RoundFlow rounds={[
      { label: "Online Assessment (NLTH/Elite)", duration: "90 min", detail: "Aptitude + reasoning + coding (1–2 problems)" },
      { label: "Essay Writing", duration: "20 min", detail: "200–300 words on a given topic; grammar and coherence scored" },
      { label: "Technical Interview", duration: "40 min", detail: "Core CS, OOP, DBMS, your resume project" },
      { label: "HR Round", duration: "20 min", detail: "Relocation, NTH bond, motivation" },
    ]} />
  ),
  "wipro-interview-questions-2026||Wipro vs TCS vs Infosys: Choosing Between Service IT Offers": (
    <ComparisonTable
      columns={[{ name: "Factor" }, { name: "Wipro" }, { name: "TCS" }, { name: "Infosys" }]}
      rows={[
        { label: "Fresher CTC", values: ["3.5–7 LPA", "3.5–9 LPA", "3.6–9.5 LPA"] },
        { label: "Bond Period", values: ["No bond (NTH)", "No bond", "No bond"] },
        { label: "Training Duration", values: ["3 months", "3–4 months", "3–4 months"] },
        { label: "Onsite Opportunity", values: ["Moderate", "High", "High"] },
        { label: "Bangalore Strength", values: ["Strong", "Moderate", "Strong"] },
      ]}
      caption="Service IT comparison for freshers India 2026 — NTH = National Talent Hunt"
    />
  ),

  /* hdfc-bank-interview-questions-2026: BFSI domain and process */
  "hdfc-bank-interview-questions-2026||Interview Process and Round Structure": (
    <RoundFlow rounds={[
      { label: "Aptitude + Domain Test", duration: "60 min", detail: "Quant, verbal, basic banking knowledge" },
      { label: "Technical Interview 1", duration: "45 min", detail: "Java/Spring Boot, SQL, core CS for tech roles" },
      { label: "Technical Interview 2 / Panel", duration: "40 min", detail: "BFSI domain, project discussion, scenario questions" },
      { label: "HR / Business Round", duration: "30 min", detail: "Culture fit, HDFC values, location preference" },
    ]} />
  ),
  "hdfc-bank-interview-questions-2026||Java and Spring Boot Questions at HDFC Bank": (
    <SalaryLadder maxLPA={22} rows={[
      { role: "Junior Software Engineer (0–2 yrs)", min: 6, max: 10, note: "BFSI entry, tech division" },
      { role: "Software Engineer (2–4 yrs)", min: 10, max: 16 },
      { role: "Senior Software Engineer (4–7 yrs)", min: 15, max: 22 },
      { role: "Technical Lead / Architect (7+ yrs)", min: 20, max: 35 },
    ]} caption="HDFC Bank Technology Division salary India 2026" />
  ),

  /* icici-bank-interview-questions-2026: Tech stack and process */
  "icici-bank-interview-questions-2026||ICICI Bank Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Aptitude, logical reasoning, basic coding" },
      { label: "Technical Round 1", duration: "45 min", detail: "Java / Python, REST APIs, DBMS" },
      { label: "Domain / Technical Round 2", duration: "40 min", detail: "Banking APIs, UPI/NEFT/RTGS concepts, microservices" },
      { label: "HR Interview", duration: "25 min", detail: "Stability, relocation, joining timeline" },
    ]} />
  ),
  "icici-bank-interview-questions-2026||Behavioral Interviews and Career Growth at ICICI Bank": (
    <SalaryLadder maxLPA={24} rows={[
      { role: "Analyst / Junior Developer (0–2 yrs)", min: 5.5, max: 9, note: "iWork / iBegin tracks" },
      { role: "Developer (2–4 yrs)", min: 9, max: 15 },
      { role: "Senior Developer (4–7 yrs)", min: 14, max: 22 },
      { role: "Lead / Principal (7+ yrs)", min: 20, max: 35 },
    ]} caption="ICICI Bank Technology Group salary India 2026" />
  ),

  /* axis-bank-interview-questions-2026: Domain and process */
  "axis-bank-interview-questions-2026||Interview Process at Axis Bank": (
    <RoundFlow rounds={[
      { label: "Online Aptitude Test", duration: "50 min", detail: "Quant, reasoning, verbal; banking awareness for non-tech" },
      { label: "Technical Interview", duration: "45 min", detail: "Java/Spring, SQL, API design, core CS" },
      { label: "Domain / Managerial Round", duration: "35 min", detail: "BFSI domain, scenario-based, system thinking" },
      { label: "HR Round", duration: "20 min", detail: "Culture fit, Axis values, growth ambitions" },
    ]} />
  ),
  "axis-bank-interview-questions-2026||Axis Bank Behavioral Interviews and Career Paths": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "Software Engineer (Fresher)", min: 5, max: 8 },
      { role: "Senior Software Engineer (2–5 yrs)", min: 8, max: 14 },
      { role: "Lead Engineer / Tech Lead (5–8 yrs)", min: 13, max: 20 },
      { role: "Principal / Architect (8+ yrs)", min: 18, max: 32 },
    ]} caption="Axis Bank Technology salary India 2026" />
  ),

  /* bajaj-finance-interview-questions-2026: Fintech NBFC process */
  "bajaj-finance-interview-questions-2026||Bajaj Finance Interview Structure": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Aptitude + coding test (1–2 DSA problems)" },
      { label: "Technical Round 1", duration: "45 min", detail: "DSA, Java/Python, REST APIs, SQL" },
      { label: "Technical Round 2 / Design", duration: "40 min", detail: "System design, microservices, ML architecture (for data roles)" },
      { label: "HR / Leadership Round", duration: "25 min", detail: "NBFC domain knowledge, growth mindset, agility" },
    ]} />
  ),
  "bajaj-finance-interview-questions-2026||Machine Learning and Data Engineering at Bajaj Finance": (
    <SalaryLadder maxLPA={28} rows={[
      { role: "Software Engineer / Analyst (0–2 yrs)", min: 7, max: 12 },
      { role: "Senior Engineer (2–4 yrs)", min: 12, max: 18 },
      { role: "ML Engineer / Data Engineer (3–6 yrs)", min: 14, max: 22 },
      { role: "Lead / Principal Engineer (6+ yrs)", min: 20, max: 32 },
    ]} caption="Bajaj Finance Technology salary India 2026" />
  ),

  /* upstox-interview-questions-2026: Trading platform focus */
  "upstox-interview-questions-2026||Upstox Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; Medium–Hard, time complexity focus" },
      { label: "Technical Round 1 — DSA & CS", duration: "60 min", detail: "Graph/DP deep dive, OS, concurrency" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "System design: trade engine, order book, low-latency feeds" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Ownership, zero-to-one work, trading domain awareness" },
    ]} />
  ),
  "upstox-interview-questions-2026||Real-Time Systems and Low-Latency Design": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Fintech premium for systems depth" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 40 },
      { role: "Senior / Staff SDE (5+ yrs)", min: 38, max: 55 },
      { role: "Engineering Manager (6+ yrs)", min: 45, max: 70 },
    ]} caption="Upstox salary India 2026 — ESOPs add meaningful upside pre-IPO" />
  ),

  /* meta-india-interview-questions-2026: FAANG process */
  "meta-india-interview-questions-2026||Meta India Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, motivation, timeline clarification" },
      { label: "Coding Screen (HackerRank / Live)", duration: "45 min", detail: "2 LeetCode-style problems, Medium difficulty" },
      { label: "Virtual Onsite — Coding ×2", duration: "45 min each", detail: "2 problems per round; arrays, graphs, DP heavily tested" },
      { label: "Virtual Onsite — System Design", duration: "60 min", detail: "Design at scale: social graph, news feed, ads delivery" },
      { label: "Jedi (Behavioral) Round", duration: "45 min", detail: "Meta values: Move Fast, Be Direct, Focus on Impact" },
    ]} />
  ),
  "meta-india-interview-questions-2026||Meta System Design at Scale": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "SWE E3 / SDE-1 (0–2 yrs)", min: 40, max: 60, note: "Base + RSU ~4yr vest" },
      { role: "SWE E4 / SDE-2 (2–5 yrs)", min: 60, max: 90 },
      { role: "SWE E5 / Senior (5–8 yrs)", min: 80, max: 120 },
      { role: "SWE E6 / Staff (8+ yrs)", min: 110, max: 180 },
    ]} caption="Meta India total compensation 2026 — includes base + RSU (3yr cliff)" />
  ),

  /* scaler-interview-questions-2026: EdTech product company */
  "scaler-interview-questions-2026||Scaler Interview Process and DSA Emphasis": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "3 DSA problems; Medium–Hard; Strong DSA bar" },
      { label: "Technical Round 1 — DSA + CS", duration: "60 min", detail: "Graph, DP, OS, concurrency deep dive" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "EdTech platform design: live classes, progress tracking" },
      { label: "Culture Fit / Mission Alignment", duration: "30 min", detail: "Teaching philosophy, product thinking, impact mindset" },
    ]} />
  ),
  "scaler-interview-questions-2026||Scaler's Culture and Mission Alignment": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 25 },
      { role: "SDE-2 (2–5 yrs)", min: 25, max: 38 },
      { role: "Senior SDE (5+ yrs)", min: 35, max: 52 },
      { role: "Engineering Manager (6+ yrs)", min: 45, max: 65 },
    ]} caption="Scaler Academy salary India 2026 — mission-driven culture, ESOPs offered" />
  ),

  /* vedantu-interview-questions-2026: Real-time video platform */
  "vedantu-interview-questions-2026||Vedantu Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Assessment", duration: "75 min", detail: "2–3 DSA problems; Medium difficulty; real-time constraints" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA, real-time systems, WebRTC basics, backend APIs" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Design live tutoring platform, video streaming, whiteboard" },
      { label: "Founder / Culture Round", duration: "30 min", detail: "EdTech mission, product sense, working in ambiguity" },
    ]} />
  ),
  "vedantu-interview-questions-2026||Real-Time Video and Collaboration Engineering": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22 },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 35 },
      { role: "Senior SDE (5+ yrs)", min: 32, max: 48 },
      { role: "Engineering Lead (6+ yrs)", min: 42, max: 60 },
    ]} caption="Vedantu salary India 2026 — ESOPs available; post-layoff team is leaner" />
  ),

  /* optiver-interview-questions-india-2026: Quant trading firm */
  "optiver-india-interview-questions-2026||The Optiver Interview Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "80 in 8 Mental Math Test", duration: "8 min", detail: "80 arithmetic questions; no calculator; speed and accuracy" },
      { label: "Numerical Reasoning Test", duration: "30 min", detail: "Probability, combinatorics, expected value" },
      { label: "Trading Simulation Game", duration: "30 min", detail: "Market making exercise; tests risk intuition" },
      { label: "Technical Coding Round", duration: "60 min", detail: "C++ or Python; algorithms, data structures, concurrency" },
      { label: "HR / Fit Interview", duration: "30 min", detail: "Teamwork, risk mindset, Optiver culture" },
    ]} />
  ),
  "optiver-india-interview-questions-2026||Mental Math and Probability Preparation": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Graduate Trader / Researcher", min: 25, max: 50, note: "Bonus can 3–5x base" },
      { role: "Software Developer (SDE-1 equiv)", min: 25, max: 45 },
      { role: "Senior Software Developer", min: 45, max: 80 },
      { role: "Quant Researcher (experienced)", min: 60, max: 120 },
    ]} caption="Optiver India compensation 2026 — year-end bonus is most significant component" />
  ),

  /* millennium-management-interview-india-2026: HF quant */
  "millennium-management-interview-india-2026||Millennium Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Quantitative Test", duration: "45 min", detail: "Probability, statistics, expected value, brain teasers" },
      { label: "C++ / Systems Coding Round", duration: "60 min", detail: "STL, memory management, concurrency, latency thinking" },
      { label: "Quant / Problem-Solving Interview", duration: "60 min", detail: "Mathematical puzzles, market microstructure, Bayesian reasoning" },
      { label: "Hiring Manager Interview", duration: "45 min", detail: "Domain depth, research mindset, pod structure fit" },
    ]} />
  ),
  "millennium-management-interview-india-2026||Technology Roles and C++ at Millennium": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Software Engineer (Entry)", min: 30, max: 55, note: "HFT premium" },
      { role: "Quant Researcher (Junior)", min: 35, max: 70 },
      { role: "Senior Software Engineer", min: 55, max: 100 },
      { role: "Senior Quant Researcher", min: 80, max: 160 },
    ]} caption="Millennium Management India 2026 — bonus comp dominates; base is conservative" />
  ),

  /* zepto-interview-questions-2026: Quick commerce */
  "zepto-interview-questions-2026||Zepto Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; graph, greedy, DP; Medium–Hard" },
      { label: "Technical Round 1 — DSA + CS", duration: "60 min", detail: "Algorithms, OS, concurrency, API design" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Dark store routing, inventory management, real-time tracking" },
      { label: "Leadership / Culture Round", duration: "30 min", detail: "Ownership, speed, zero-to-one problem-solving" },
    ]} />
  ),
  "zepto-interview-questions-2026||Zepto Salary and Career": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28 },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 42 },
      { role: "Senior SDE (5+ yrs)", min: 38, max: 55 },
      { role: "Engineering Manager (6+ yrs)", min: 48, max: 70 },
    ]} caption="Zepto salary India 2026 — pre-IPO ESOPs available; hyper-growth environment" />
  ),

  /* blinkit-interview-questions-2026: Quick commerce / Zomato */
  "blinkit-interview-questions-2026||Blinkit Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems; graphs, sorting, greedy" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA deep dive, backend design, database schema" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "10-minute delivery routing, dark store fulfillment systems" },
      { label: "Zomato Culture / Bar-Raiser Round", duration: "30 min", detail: "Ownership, hustle, cross-functional thinking" },
    ]} />
  ),
  "blinkit-interview-questions-2026||Blinkit Salary and Zomato RSUs": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 30, note: "Zomato RSUs included" },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 44 },
      { role: "Senior SDE (5+ yrs)", min: 40, max: 58 },
      { role: "Engineering Manager (6+ yrs)", min: 50, max: 75 },
    ]} caption="Blinkit salary India 2026 — RSUs are listed Zomato shares (4yr vest)" />
  ),

  /* browserstack-interview-questions-2026: Testing infra */
  "browserstack-interview-questions-2026||BrowserStack Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Assessment", duration: "90 min", detail: "2–3 DSA + 1 systems-thinking problem; Java/Python/Go" },
      { label: "Technical Round 1 — DSA + OS", duration: "60 min", detail: "Algorithms, concurrency, browser internals" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Distributed testing infra, test-runner orchestration, real device cloud" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Remote-first culture, product thinking, customer obsession" },
    ]} />
  ),
  "browserstack-interview-questions-2026||BrowserStack Salary and Career": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 30 },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 42 },
      { role: "Senior SDE (5+ yrs)", min: 38, max: 55 },
      { role: "Staff Engineer / EM (7+ yrs)", min: 50, max: 75 },
    ]} caption="BrowserStack salary India 2026 — remote-first, ESOPs in pre-IPO range" />
  ),

  /* physicswallah-interview-questions-2026: EdTech unicorn */
  "physicswallah-interview-questions-2026||PhysicsWallah Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "75 min", detail: "2–3 DSA problems; backend-heavy; Python/Java" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA, system efficiency, backend APIs" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Video streaming at scale, content delivery for low-bandwidth India" },
      { label: "Founder Culture Round", duration: "30 min", detail: "Frugal engineering, mission alignment, hustle" },
    ]} />
  ),
  "physicswallah-interview-questions-2026||PhysicsWallah Salary and Culture": (
    <SalaryLadder maxLPA={30} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Below-FAANG but strong mission culture" },
      { role: "SDE-2 (2–5 yrs)", min: 18, max: 30 },
      { role: "Senior SDE (5+ yrs)", min: 28, max: 42 },
      { role: "Engineering Manager (6+ yrs)", min: 35, max: 55 },
    ]} caption="PhysicsWallah salary India 2026 — ESOPs partially offset lower cash comp" />
  ),

  /* sharechat-interview-questions-2026: Social media / ML */
  "sharechat-interview-questions-2026||ShareChat Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; graph, DP; focus on optimization" },
      { label: "Technical Round 1 — DSA + ML", duration: "60 min", detail: "Algorithms, ML system design basics, recommendation concepts" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Feed ranking, content moderation at 200M+ users, Indic NLP infra" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Building for Bharat, ownership, ambiguity tolerance" },
    ]} />
  ),
  "sharechat-interview-questions-2026||ShareChat Salary and Career": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 / MLE-1 (0–2 yrs)", min: 18, max: 28 },
      { role: "SDE-2 / MLE-2 (2–5 yrs)", min: 28, max: 40 },
      { role: "Senior SDE / Senior MLE (5+ yrs)", min: 38, max: 55 },
      { role: "Staff / EM (7+ yrs)", min: 50, max: 72 },
    ]} caption="ShareChat salary India 2026 — ESOPs available; ML engineers at premium" />
  ),

  /* nvidia-india-interview-questions-2026: Chip design / software */
  "nvidia-india-interview-questions-2026||Nvidia India Interview Process": (
    <RoundFlow rounds={[
      { label: "Phone / Technical Screen", duration: "60 min", detail: "Role-specific: CUDA concepts, driver stack, or deep learning infra" },
      { label: "Technical Interview 1 — Algorithms", duration: "60 min", detail: "C++ data structures, memory management, parallel programming" },
      { label: "Technical Interview 2 — Domain Depth", duration: "60 min", detail: "GPU architecture, CUDA optimization, or ML framework internals" },
      { label: "Technical Interview 3 — Design", duration: "60 min", detail: "System design; scalable ML training infra or driver architecture" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Team fit, research mindset, long-term trajectory" },
    ]} />
  ),
};
