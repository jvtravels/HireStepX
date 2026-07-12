/* blog-meta.ts — server-safe registry of blog post metadata.
 *
 * BlogPage.tsx is "use client" so its posts array can't be imported
 * in Server Components (generateMetadata, generateStaticParams).
 * This file exports only the server-safe metadata fields needed by the
 * app/(marketing)/blog/[slug]/page.tsx route:
 *   - slug → canonical URL segment
 *   - title → <title> tag + OG title + Article schema headline
 *   - metaDescription → meta description + OG description
 *   - datePublished → Article schema datePublished
 *   - faqs → FAQPage schema (if present — triggers rich accordion SERP result)
 *   - heroImage → OG image
 *   - company, category → used in Article schema keywords
 *
 * Keep this file in sync with the posts array in BlogPage.tsx.
 * Pattern: when you add a post to BlogPage.tsx, add its meta here too.
 */

export interface BlogMeta {
  slug: string;
  title: string;
  metaDescription: string;
  datePublished: string;
  heroImage: string;
  company: string;
  category: string;
  faqs?: { question: string; answer: string }[];
}

export const BLOG_META: BlogMeta[] = [
  {
    slug: "top-10-google-interview-questions",
    title: "Top 10 Google Interview Questions (2026) — With Sample Answers",
    metaDescription: "Prepare for Google interviews with the top 10 most-asked behavioral and technical questions. Includes sample answers and scoring tips from AI analysis.",
    datePublished: "2026-01-15",
    heroImage: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=1200&h=630&fit=crop",
    company: "Google", category: "Behavioral",
    faqs: [
      { question: "How many rounds are in a Google interview?", answer: "Google typically has 5-6 rounds: phone screen, 2 coding interviews, 1 system design, 1 behavioral (Googleyness & Leadership), and sometimes a team-matching call." },
      { question: "How long does the Google interview process take?", answer: "The process typically takes 4-8 weeks from application to offer, though it can vary depending on the role and team." },
      { question: "What is the Google interview acceptance rate?", answer: "Google's acceptance rate is approximately 0.2-0.5%, making it one of the most competitive employers globally." },
    ],
  },
  {
    slug: "flipkart-interview-prep-guide",
    title: "Flipkart Interview Prep Guide — What to Expect in 2026",
    metaDescription: "Complete Flipkart interview preparation guide. Covers coding rounds, system design, HR behavioral questions, and insider tips for SDE-1 to SDE-3 roles.",
    datePublished: "2026-01-15",
    heroImage: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=630&fit=crop",
    company: "Flipkart", category: "Full Guide",
    faqs: [
      { question: "Does Flipkart have a machine coding round?", answer: "Yes, Flipkart's machine coding round is unique — you build a small application in 90 minutes. Focus on clean OOP design, extensibility, and edge case handling." },
      { question: "What is Flipkart SDE-1 salary in 2026?", answer: "Flipkart SDE-1 salary ranges from ₹18-28 LPA including base, bonus, and ESOPs." },
    ],
  },
  {
    slug: "behavioral-interview-questions-freshers",
    title: "50 Behavioral Interview Questions for Freshers — India Campus Placements",
    metaDescription: "Top 50 behavioral interview questions asked in Indian campus placements. Includes STAR method examples for freshers with limited work experience.",
    datePublished: "2026-01-15",
    heroImage: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&h=630&fit=crop",
    company: "Campus", category: "Freshers",
    faqs: [
      { question: "How do freshers answer behavioral questions without work experience?", answer: "Use examples from college projects, internships, hackathons, club leadership, and group assignments. The STAR method works the same — focus on your specific contribution and the outcome." },
      { question: "What is the STAR method?", answer: "STAR stands for Situation, Task, Action, Result. It's a structured framework for answering behavioral interview questions by describing a specific example from your experience." },
      { question: "How many behavioral questions should freshers prepare?", answer: "Prepare 8-10 strong STAR stories that can be adapted across different questions. Most behavioral questions map to themes like teamwork, leadership, conflict, failure, and initiative." },
    ],
  },
  {
    slug: "razorpay-interview-experience",
    title: "Razorpay Interview Experience — SDE & PM Roles (2026)",
    metaDescription: "Detailed Razorpay interview experience for SDE and PM roles. Covers coding rounds, system design, culture fit, and salary expectations.",
    datePublished: "2026-01-15",
    heroImage: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=630&fit=crop",
    company: "Razorpay", category: "Experience",
    faqs: [
      { question: "How hard is the Razorpay interview?", answer: "Razorpay interviews are moderately hard — similar to Flipkart level. DSA questions are medium-hard, and system design focuses on payment-specific problems like idempotency and retry mechanisms." },
      { question: "What is Razorpay SDE-2 salary?", answer: "Razorpay SDE-2 salary ranges from ₹28-45 LPA including base pay, bonuses, and ESOPs." },
    ],
  },
  {
    slug: "ace-case-study-interviews",
    title: "How to Ace Case Study Interviews — Framework + Examples",
    metaDescription: "Master case study interviews with proven frameworks. Includes examples for consulting, product, and strategy roles with step-by-step walkthroughs.",
    datePublished: "2026-02-01",
    heroImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop",
    company: "Consulting", category: "Strategy",
    faqs: [],
  },
  {
    slug: "tcs-interview-questions-freshers-2026",
    title: "TCS Interview Questions for Freshers 2026 — NQT, Technical & HR",
    metaDescription: "Complete TCS interview preparation guide for 2026 freshers. Covers TCS NQT exam, technical coding round, managerial round, and HR interview questions with sample answers.",
    datePublished: "2026-02-01",
    heroImage: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&h=630&fit=crop",
    company: "TCS", category: "Campus Placement",
    faqs: [
      { question: "What is the TCS NQT cutoff for 2026?", answer: "TCS does not publish official cutoffs, but industry reports suggest 65-70% for the Ninja track and 80%+ for the Digital track to advance to the interview stage." },
      { question: "What is TCS Ninja salary in 2026?", answer: "TCS Ninja starting salary is ₹3.36 LPA. TCS Digital pays ₹7 LPA and TCS Prime pays ₹9 LPA." },
    ],
  },
  {
    slug: "infosys-interview-questions-2026",
    title: "Infosys Interview Questions 2026 — SP, DSE & Power Programmer",
    metaDescription: "Complete Infosys interview preparation guide for 2026. Covers all tracks: System Engineer (SE), Specialist Programmer (SP), Digital Specialist Engineer (DSE), and Power Programmer.",
    datePublished: "2026-02-15",
    heroImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=630&fit=crop",
    company: "Infosys", category: "Campus Placement",
    faqs: [
      { question: "What is Infosys SP salary in 2026?", answer: "Infosys Specialist Programmer (SP) salary is ₹6.5 LPA. The base SE track pays ₹3.6 LPA." },
      { question: "How hard is the InfyTQ exam?", answer: "InfyTQ tests are moderately hard — Java or Python programming, OOP concepts, data structures basics. The bar is higher than TCS NQT but lower than product company interviews." },
    ],
  },
  {
    slug: "how-to-introduce-yourself-in-interview",
    title: "How to Introduce Yourself in a Job Interview — Best Answers 2026",
    metaDescription: "Craft the perfect self-introduction for any job interview. Includes 3 sample scripts for freshers, experienced candidates, and career changers with timing tips.",
    datePublished: "2026-03-01",
    heroImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=630&fit=crop",
    company: "General", category: "HR Round",
    faqs: [
      { question: "How long should a self-introduction be in an interview?", answer: "Keep it to 60-90 seconds. Longer introductions lose the interviewer's attention; shorter ones seem underprepared. Practice timing it." },
      { question: "What should I include in a self-introduction for a fresher?", answer: "Include: your name and degree, your strongest technical skills, a notable project or internship, and why you're interested in this company/role. End with an invitation for them to ask more." },
    ],
  },
  {
    slug: "tell-me-about-yourself-best-answer",
    title: "Tell Me About Yourself — Best Answer Formula for Indian Interviews (2026)",
    metaDescription: "The exact formula for answering 'Tell me about yourself' in Indian job interviews. Includes templates for freshers, 2-5 year experienced, and career changers.",
    datePublished: "2026-03-01",
    heroImage: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&h=630&fit=crop",
    company: "General", category: "HR Round",
    faqs: [
      { question: "How do I answer 'Tell me about yourself' as a fresher?", answer: "Follow the Present-Past-Future structure: start with your degree and skills (present), mention a project or internship (past), then explain why you want this role (future). Keep it to 90 seconds." },
      { question: "Should I mention personal interests in 'Tell me about yourself'?", answer: "Only if they're genuinely relevant to the role or show a valuable trait (analytical thinking, communication, leadership). Don't mention hobbies just to fill time." },
    ],
  },
  {
    slug: "wipro-interview-questions-answers",
    title: "Wipro Interview Questions & Answers 2026 — NLTH, Elite and Turbo",
    metaDescription: "Complete Wipro interview preparation guide for 2026. Covers all Wipro tracks (NLTH, Elite, Turbo, WILP), aptitude test, coding, and HR interview with sample answers.",
    datePublished: "2026-03-15",
    heroImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=630&fit=crop",
    company: "Wipro", category: "Campus Placement",
    faqs: [
      { question: "What is Wipro NLTH?", answer: "NLTH stands for National Level Talent Hunt — Wipro's primary off-campus hiring drive. It includes an online aptitude test, a coding round, and a virtual interview." },
      { question: "What is Wipro fresher salary in 2026?", answer: "Wipro fresher salary is ₹3.5 LPA for the base track. Wipro Elite/Turbo tracks offer ₹6.5 LPA." },
    ],
  },
  {
    slug: "hr-interview-questions-answers-india",
    title: "HR Interview Questions and Answers India 2026 — 40 Must-Know Questions",
    metaDescription: "40 most common HR interview questions for Indian job seekers in 2026. Includes ideal answers, what interviewers are really asking, and red-flag responses to avoid.",
    datePublished: "2026-04-01",
    heroImage: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&h=630&fit=crop",
    company: "General", category: "HR Round",
    faqs: [
      { question: "What are the most common HR interview questions in India?", answer: "Tell me about yourself, Why should we hire you, Where do you see yourself in 5 years, What are your strengths and weaknesses, Why do you want to join this company, and What is your expected salary." },
      { question: "How do I answer 'What is your expected salary' in India?", answer: "Research market rates for the role and your experience level. Give a range (not a single number). For freshers, say 'as per company standards' if you don't have enough information, but have a number ready if they push." },
    ],
  },
  {
    slug: "amazon-leadership-principles-interview",
    title: "Amazon Leadership Principles Interview — All 16 LPs with Example Answers (2026)",
    metaDescription: "Complete guide to Amazon's 16 Leadership Principles with STAR example answers for each. Includes the bar raiser round strategy and common LP question patterns.",
    datePublished: "2026-04-01",
    heroImage: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=1200&h=630&fit=crop",
    company: "Amazon", category: "Behavioral",
    faqs: [
      { question: "How many Leadership Principles does Amazon use?", answer: "Amazon has 16 Leadership Principles as of 2026: Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone/Disagree and Commit, Deliver Results, Strive to be Earth's Best Employer, and Success and Scale Bring Broad Responsibility." },
      { question: "What is the Amazon bar raiser?", answer: "The bar raiser is an independent Amazon employee (not from the hiring team) who ensures every hire raises the average quality of the team. The bar raiser has veto power and focuses primarily on Leadership Principles, not technical skills." },
    ],
  },
  {
    slug: "system-design-interview-preparation",
    title: "System Design Interview Preparation India 2026 — Complete Guide",
    metaDescription: "Complete system design interview guide for Indian engineers. Covers all major topics, frameworks, India-specific questions, and company-specific expectations.",
    datePublished: "2026-04-15",
    heroImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop",
    company: "Tech", category: "Technical",
    faqs: [
      { question: "When does the system design interview start in India?", answer: "System design rounds typically start at SDE-2 level at product companies. FAANG India starts system design at SDE-1/L4. Service IT companies (TCS, Infosys) rarely have formal system design rounds." },
      { question: "What are the most common system design topics in India?", answer: "Design a URL shortener, design WhatsApp/messaging, design UPI payment system, design a notification service, design a cab booking system like Ola/Uber, and design an e-commerce platform like Flipkart." },
    ],
  },
  {
    slug: "salary-negotiation-tips-india",
    title: "Salary Negotiation Tips India 2026 — How to Get 20-30% More",
    metaDescription: "Practical salary negotiation strategies for Indian job seekers. Includes exact scripts, market data anchoring, stock/ESOP negotiation, and when to walk away.",
    datePublished: "2026-05-01",
    heroImage: "https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=1200&h=630&fit=crop",
    company: "General", category: "Salary",
    faqs: [
      { question: "Is salary negotiation normal in India?", answer: "Yes — salary negotiation is standard in India, especially in IT and product companies. Companies expect candidates to negotiate. Accepting the first offer without negotiating often leaves 10-20% on the table." },
      { question: "How much can you negotiate salary in India?", answer: "For experienced candidates: 15-30% above the initial offer is realistic if you have competing offers. For freshers at service companies: less flexibility, but you can sometimes negotiate joining bonus or role assignment." },
    ],
  },
  {
    slug: "campus-placement-interview-tips",
    title: "Campus Placement Interview Tips India 2026 — Complete Fresher Guide",
    metaDescription: "Complete campus placement preparation guide for Indian college students in 2026. Covers aptitude, technical, group discussion, and HR rounds with company-specific tips.",
    datePublished: "2026-05-01",
    heroImage: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=630&fit=crop",
    company: "Campus", category: "Campus Placement",
    faqs: [
      { question: "How early should I start preparing for campus placements?", answer: "Start 3-4 months before your placement season for service companies (TCS, Infosys, Wipro). For product companies (Flipkart, Swiggy, CRED), start 6-8 months early due to the higher DSA and system design bar." },
      { question: "What CGPA is required for campus placements?", answer: "Most companies have a 6.0 CGPA minimum; many have 6.5 or 7.0. TCS requires 60% throughout academics. Some product companies don't have a CGPA filter at all — check each company's specific eligibility criteria." },
    ],
  },
  {
    slug: "mock-interview-practice-guide",
    title: "How to Practice Mock Interviews — Complete Guide (2026)",
    metaDescription: "How to get the most out of mock interview practice. Covers solo practice, AI mock interviews, peer practice, and the research-backed deliberate practice techniques that actually improve performance.",
    datePublished: "2026-05-01",
    heroImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop",
    company: "General", category: "Preparation",
    faqs: [
      { question: "How many mock interviews should I do before the real one?", answer: "At minimum 3: a baseline session to identify weaknesses, a targeted practice session, and a full simulation close to the real date. Most candidates see measurable improvement within 5 practice sessions." },
      { question: "Are AI mock interviews effective?", answer: "Yes — AI mock interviews provide consistent, objective scoring unavailable with human practice partners who may be too kind. They're available 24/7 and track improvement across sessions, which mirrors the deliberate practice research on skill acquisition." },
    ],
  },
  {
    slug: "star-method-interview-answers",
    title: "STAR Method Interview Answers — 20 Examples for India 2026",
    metaDescription: "20 STAR method answer examples for Indian interview candidates. Covers leadership, failure, conflict, initiative, teamwork, and other common behavioral themes.",
    datePublished: "2026-06-01",
    heroImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=630&fit=crop",
    company: "General", category: "Behavioral",
    faqs: [
      { question: "What is the STAR method?", answer: "STAR stands for Situation, Task, Action, Result. It's a structured storytelling framework for answering behavioral interview questions: set the context (Situation), explain your role (Task), describe what you did (Action), and quantify the outcome (Result)." },
      { question: "How long should a STAR answer be?", answer: "Target 90 seconds to 2 minutes. Shorter answers lack detail and seem unprepared; longer answers lose the interviewer's attention. Use the Action part for 60% of the time — that's what they're actually evaluating." },
    ],
  },
  {
    slug: "cognizant-interview-questions-freshers-2026",
    title: "Cognizant Interview Questions for Freshers 2026 — GenC and GenC Pro",
    metaDescription: "Complete Cognizant interview preparation guide for freshers in 2026. Covers CoCubes test, GenC and GenC Pro tracks, salary comparison, and interview tips.",
    datePublished: "2026-06-01",
    heroImage: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&h=630&fit=crop",
    company: "Cognizant", category: "Campus Placement",
    faqs: [
      { question: "What is Cognizant GenC salary in 2026?", answer: "Cognizant GenC salary is ₹4 LPA. Cognizant GenC Pro salary is ₹6.5 LPA for candidates who qualify through the higher-difficulty track." },
      { question: "What is the CoCubes test for Cognizant?", answer: "CoCubes is the online assessment platform Cognizant uses for its campus hiring. It tests reasoning, verbal ability, quantitative aptitude, and coding. The test is adaptive in difficulty." },
    ],
  },
  {
    slug: "accenture-interview-questions-freshers-2026",
    title: "Accenture Interview Questions for Freshers 2026 — ASE and ATCI",
    metaDescription: "Complete Accenture interview preparation guide for freshers. Covers the iCAT test, communication round, Technical and HR interviews, and salary for ASE roles.",
    datePublished: "2026-06-15",
    heroImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=630&fit=crop",
    company: "Accenture", category: "Campus Placement",
    faqs: [
      { question: "What is the Accenture communication round?", answer: "The Accenture communication round is an English language assessment that tests listening, reading, and speaking ability. It is an eliminatory filter unique to Accenture — approximately 20-25% of candidates who pass the iCAT technical test are rejected here." },
      { question: "What is Accenture ASE salary in 2026?", answer: "Accenture ASE (Associate Software Engineer) starting salary is ₹4.5 LPA. Advanced ASE track pays ₹6.5–8 LPA." },
    ],
  },
  {
    slug: "product-manager-interview-questions-india",
    title: "Product Manager Interview Questions India 2026 — Complete PM Guide",
    metaDescription: "Complete Product Manager interview preparation guide for India 2026. Covers case study, product sense, metrics, behavioral and execution questions with India-specific examples.",
    datePublished: "2026-06-15",
    heroImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop",
    company: "General", category: "Product",
    faqs: [
      { question: "What is PM salary in India in 2026?", answer: "PM salaries in India: Associate PM at product startups ₹18-25 LPA; PM at unicorns (Flipkart, Razorpay, Swiggy) ₹30-55 LPA; Senior PM ₹50-80 LPA. FAANG PMs earn ₹80-150 LPA+ with ESOPs." },
      { question: "What is the difference between APM and PM interviews in India?", answer: "APM (Associate/Graduate PM) interviews focus on product thinking fundamentals and structured problem-solving with college-level examples. PM interviews require 2-4 years of experience examples and go deeper on metrics, trade-offs, and stakeholder management." },
    ],
  },
  {
    slug: "hcl-accenture-capgemini-interview-comparison",
    title: "HCL vs Accenture vs Capgemini Interview — Which Is the Best for Freshers?",
    metaDescription: "Compare HCL, Accenture, and Capgemini interview processes for freshers. Covers salary, difficulty, training quality, and which company is best for your career goals.",
    datePublished: "2026-06-15",
    heroImage: "https://images.unsplash.com/photo-1488229297570-58520851e868?w=1200&h=630&fit=crop",
    company: "HCL", category: "Comparison",
    faqs: [
      { question: "Which is better for freshers — Accenture or Capgemini?", answer: "Accenture offers slightly higher salary (₹4.5–8 LPA vs ₹4.35–7 LPA) and better training (LEAP program), but has an extra communication round that eliminates 20%+ of candidates. Capgemini has the IntelliAdapt test but no communication filter — more accessible for candidates who are technically strong but less fluent." },
      { question: "Is HCL better than TCS for freshers?", answer: "HCL typically pays slightly more than TCS Ninja (₹3.8L vs ₹3.36L) and the interview is comparable in difficulty. TCS has a larger brand and more structured hierarchy. Both are similar in terms of career trajectory — the key is what you do with the first 2–3 years." },
    ],
  },
  {
    slug: "deloitte-interview-questions-freshers-2026",
    title: "Deloitte Interview Questions for Freshers — 2026 Off-Campus & Campus",
    metaDescription: "Complete Deloitte interview preparation guide for freshers in 2026. Covers the CogniVue aptitude test, case study rounds, behavioral interview, and salary expectations for Analyst roles.",
    datePublished: "2026-06-15",
    heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=630&fit=crop",
    company: "Deloitte", category: "Freshers",
    faqs: [
      { question: "Is Deloitte hard to get into as a fresher?", answer: "Moderately hard. The CogniVue test filters significantly, and the communication bar is higher than typical IT service companies. Candidates who prepare specifically for the case interview and GD have a strong advantage." },
      { question: "What is Deloitte BTA salary in 2026?", answer: "Deloitte Business Technology Analyst (BTA) starting salary is ₹7–9 LPA. Consulting Analyst roles start at ₹9���12 LPA." },
    ],
  },
  {
    slug: "group-discussion-topics-campus-placement-2026",
    title: "Group Discussion Topics for Campus Placements 2026 — 40 Real GD Topics",
    metaDescription: "40 current group discussion topics for campus placements 2026. Covers technology, business, economy, and social issues with talking points for each topic.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1200&h=630&fit=crop",
    company: "Campus", category: "Campus Placement",
    faqs: [
      { question: "What are the most common GD topics in 2026 campus placements?", answer: "AI and jobs, digital India, environmental policy, startup ecosystem, remote work, and social media regulation are the most frequent themes in 2026 campus drives. Technology GDs are at an all-time high given the AI wave." },
      { question: "How do I perform well in a group discussion?", answer: "Speak 3–4 times minimum, each time with a clear point backed by a fact or example. Build on others' ideas, use the person's name when you reference their point, and avoid dominating airtime." },
    ],
  },
  {
    slug: "how-to-pass-tcs-nqt-2026",
    title: "How to Pass TCS NQT 2026 — Complete Guide to National Qualifier Test",
    metaDescription: "Complete guide to the TCS NQT 2026 exam. Covers all 4 sections (Cognitive Skills, Programming Logic, Advanced Coding, English), cutoffs, and preparation strategy.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=630&fit=crop",
    company: "TCS", category: "Campus Placement",
    faqs: [
      { question: "How many times can you attempt TCS NQT?", answer: "TCS allows you to attempt the NQT once every 6 months. Your highest score in the last 2 years is considered for placement." },
      { question: "Is TCS Digital better than TCS Ninja?", answer: "Yes, significantly. TCS Digital pays ₹7 LPA vs ₹3.36 LPA for Ninja — that's almost double. Digital track also gets project allocation in newer technologies. The extra 4–6 weeks of coding preparation for Digital track is strongly worth it." },
    ],
  },
  {
    slug: "zoho-interview-questions-freshers-2026",
    title: "Zoho Interview Questions for Freshers 2026 — The Unusual Hiring Process",
    metaDescription: "Zoho interview preparation guide for freshers. Covers the unique 5-round process, programming test, aptitude, and why Zoho doesn't hire from placement agencies. Salary ₹5–8 LPA.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop",
    company: "Zoho", category: "Freshers",
    faqs: [
      { question: "Does Zoho hire freshers directly without experience?", answer: "Yes — Zoho specifically hires freshers directly through off-campus drives and walk-ins. They don't require work experience but do require strong CS fundamentals and programming ability." },
      { question: "Is Zoho a good company for freshers?", answer: "Yes — Zoho pays above average for freshers (₹5–8 LPA vs ₹3.36L at TCS), has no bond period, strong engineering culture, and hands-on work from day one." },
    ],
  },
  {
    slug: "software-engineer-interview-checklist-2026",
    title: "Software Engineer Interview Checklist 2026 — 48 Hours Before the Interview",
    metaDescription: "Complete software engineer interview checklist for India 2026. What to review, practice, and confirm in the 48 hours before your SDE interview at any company.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&h=630&fit=crop",
    company: "Tech", category: "Technical",
    faqs: [
      { question: "What should I study the night before a software engineer interview?", answer: "Nothing new. Review your strongest DSA patterns, re-read your STAR stories out loud once each, and stop technical prep by 8 PM. Sleep matters more than the last 2 hours of cramming." },
      { question: "What questions should I ask at the end of an interview?", answer: "Ask specific questions about the team, product, or challenges — not generic questions like 'What's the culture?' Better: 'What's the most challenging engineering problem the team is working on right now?'" },
    ],
  },
  {
    slug: "java-interview-questions-freshers-india-2026",
    title: "Java Interview Questions for Freshers India 2026 — Top 60 Q&A",
    metaDescription: "Top 60 Java interview questions for freshers in India 2026. Covers OOP concepts, collections, exception handling, multithreading, and Java 17+ features with sample answers.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop",
    company: "Tech", category: "Technical",
    faqs: [
      { question: "What Java version is asked in Indian interviews in 2026?", answer: "Most Indian interviews test core Java (Java 8 features are standard). Java 11 and 17 LTS features are asked at product companies but rarely at service IT companies." },
      { question: "Should I prepare Java or Python for TCS/Infosys interviews?", answer: "For TCS and Infosys, Java is preferred since most projects use it. For product companies, Python is increasingly accepted. Prepare both if time allows, but be fluent in one." },
    ],
  },
  {
    slug: "resume-tips-freshers-india-2026",
    title: "Resume Tips for Freshers India 2026 — What Actually Gets Shortlisted",
    metaDescription: "Practical resume writing tips for Indian freshers in 2026. Covers ATS optimisation, project descriptions, skills section, and what recruiters at TCS, Infosys, Flipkart, and Google actually look for.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&h=630&fit=crop",
    company: "General", category: "Preparation",
    faqs: [
      { question: "Should I put my photo on an Indian fresher resume?", answer: "Most Indian recruiters expect a photo, but product companies and FAANG India offices do not want one. When in doubt: no photo for product/FAANG roles; photo is acceptable for service IT companies." },
      { question: "How long should a fresher resume be?", answer: "One page for freshers. No exceptions under 2 years of experience." },
    ],
  },
  {
    slug: "data-analyst-interview-questions-india-2026",
    title: "Data Analyst Interview Questions India 2026 — SQL, Python, Stats & Case Studies",
    metaDescription: "Complete data analyst interview preparation guide for India 2026. Covers SQL queries, Python pandas, statistics, A/B testing, and business case questions with sample answers.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop",
    company: "Tech", category: "Technical",
    faqs: [
      { question: "What is data analyst salary in India in 2026?", answer: "Data Analyst salaries: Junior DA at IT services ₹4–7 LPA; Mid-level at startups ₹10–20 LPA; Senior DA at unicorns ₹25–40 LPA; Analytics at FAANG India ₹35–60 LPA." },
      { question: "Which is better for data analyst — SQL or Python?", answer: "SQL is the universal requirement. Python (Pandas, NumPy) is additionally required at product companies. Learn SQL first, then Python." },
    ],
  },
  {
    slug: "zomato-product-manager-interview-2026",
    title: "Zomato Product Manager Interview 2026 — Case Study, Metrics & Experience",
    metaDescription: "Complete Zomato PM interview preparation guide for 2026. Covers product cases on restaurant discovery, delivery metrics, Hyperpure B2B, and Zomato Gold monetisation with sample frameworks.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1200&h=630&fit=crop",
    company: "Zomato", category: "Product",
    faqs: [
      { question: "What is Zomato PM salary in 2026?", answer: "Zomato PM salary ranges from ₹25–45 LPA at the PM level, ₹45–70 LPA for Senior PM, and ₹70–100 LPA+ for Group PM/Director levels including ESOPs." },
      { question: "How hard is the Zomato PM interview?", answer: "Moderately hard — harder than Ola/MakeMyTrip, slightly easier than Flipkart/Razorpay. The bar is high on product context (knowing Zomato's products deeply) and metric cases." },
    ],
  },
  {
    slug: "python-interview-questions-freshers-india-2026",
    title: "Python Interview Questions for Freshers India 2026 — Top 50 Q&A",
    metaDescription: "Top 50 Python interview questions for freshers in India 2026. Covers data types, OOP, list comprehension, decorators, generators, and common libraries with sample answers.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=630&fit=crop",
    company: "Tech", category: "Technical",
    faqs: [
      { question: "Is Python good for Java-dominated interview questions in India?", answer: "Yes — Python is accepted at all major product companies. For service IT companies, Java or C++ is still the dominant choice, but Python is increasingly accepted." },
      { question: "What Python version should I prepare for interviews?", answer: "Python 3.10+ is standard. Know Python 3.7+ features (f-strings, dict ordering, walrus operator). Python 2 is dead." },
    ],
  },
  {
    slug: "goldman-sachs-india-interview-questions",
    title: "Goldman Sachs India Interview Questions 2026 — Engineering & Analyst",
    metaDescription: "Complete Goldman Sachs India interview guide for 2026. Covers the HireVue video screening, technical round (DSA + system design), super day, and salary for SDE and Analyst roles.",
    datePublished: "2026-07-01",
    heroImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop",
    company: "Goldman Sachs", category: "Finance & Banking Tech",
    faqs: [
      { question: "Is Goldman Sachs India different from Wall Street GS?", answer: "The Bengaluru and Hyderabad offices do real engineering work — not outsourced support. GS India builds core trading infrastructure, risk systems, and engineering platforms used globally." },
      { question: "What is Goldman Sachs SDE salary in India 2026?", answer: "Goldman Sachs SDE-1 salary in India 2026 is ₹30–43 LPA (base + bonus). This is comparable to senior SDE roles at Indian unicorns." },
      { question: "Does Goldman Sachs India hire freshers from IIT?", answer: "Yes, GS actively recruits from IIT campuses for the Analyst and Technology track. Shortlisting is highly competitive — typically top 10–15% of eligible students get interviewed." },
      { question: "How many rounds does Goldman Sachs India have?", answer: "Typically 5–6 rounds: HireVue screen → coding assessment → phone screen → super day (3–4 back-to-back interviews) → HR. Campus hires skip the HireVue." },
    ],
  },
  {
    slug: "frontend-developer-interview-questions-india-2026",
    title: "Frontend Developer Interview Questions India 2026 — React, JS & System Design",
    metaDescription: "Top frontend developer interview questions for India 2026. Covers JavaScript internals, React hooks, performance, CSS, system design for UI, and company-specific questions from Flipkart, Razorpay, and Swiggy.",
    datePublished: "2026-07-05",
    heroImage: "https://images.unsplash.com/photo-1593720219276-0b1eacd0aef4?w=1200&h=630&fit=crop",
    company: "General", category: "Technical",
    faqs: [
      { question: "What is frontend developer salary in India 2026?", answer: "Frontend developer salary in India 2026: Junior (0–2 yr) ₹6–12 LPA, Mid (2–4 yr) ₹15–28 LPA, Senior (5+ yr) ₹30–55 LPA at product companies." },
      { question: "Do frontend developers need to know DSA in India?", answer: "Yes, for product companies (Flipkart, Swiggy, Razorpay, Meesho). Typically 1–2 DSA rounds of medium difficulty. Focus on arrays, strings, recursion, and hashmaps." },
      { question: "Is React knowledge enough for frontend interviews in India 2026?", answer: "React is necessary but not sufficient. You also need core JavaScript internals, browser APIs, CSS layout, and web performance. Senior roles additionally require TypeScript and system design." },
      { question: "How do I prepare for frontend interviews at Flipkart or Razorpay?", answer: "4 weeks: JavaScript fundamentals → React deep dive → DSA in JavaScript → System design for UI + company research. Do 3–5 mock interviews with AI feedback." },
    ],
  },
  {
    slug: "swiggy-interview-questions-2026",
    title: "Swiggy Interview Questions 2026 — SDE, PM & Analyst Complete Guide",
    metaDescription: "Complete Swiggy interview guide for SDE, PM, and Business Analyst roles in 2026. Covers DSA rounds, system design, product cases, and salary expectations.",
    datePublished: "2026-07-05",
    heroImage: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?w=1200&h=630&fit=crop",
    company: "Swiggy", category: "Product Tech",
    faqs: [
      { question: "Is Swiggy SDE interview hard?", answer: "Moderately hard — harder than IT service companies, comparable to Meesho and Zomato. The online assessment is the biggest filter." },
      { question: "What is Swiggy SDE-1 salary in India 2026?", answer: "Swiggy SDE-1 salary in India 2026 is ₹18–25 LPA including base and RSUs." },
      { question: "Does Swiggy have system design rounds for SDE-1?", answer: "For SDE-1, system design is often a 'design a small feature' question. Full system design rounds start at SDE-2." },
      { question: "How to prepare for Swiggy product manager interview?", answer: "Focus on deep Swiggy product knowledge, marketplace metrics (GMV, take rate, NPS), and 3-sided marketplace thinking covering customers, restaurants, and delivery partners." },
    ],
  },
  {
    slug: "microsoft-india-interview-questions-2026",
    title: "Microsoft India Interview Questions 2026 — SDE, Program Manager & More",
    metaDescription: "Complete Microsoft India interview guide for 2026. Covers technical phone screen, virtual onsite rounds, behavioral STAR questions, and salary for SDE-1 to SDE-2 roles in Hyderabad and Bengaluru.",
    datePublished: "2026-07-08",
    heroImage: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1200&h=630&fit=crop",
    company: "Microsoft", category: "FAANG",
    faqs: [
      { question: "Is Microsoft India interview hard?", answer: "Moderately hard — significantly harder than IT service companies, slightly easier than Google India. The onsite is collaborative — Microsoft interviewers help if you're stuck." },
      { question: "What is Microsoft SDE-1 salary in India 2026?", answer: "Microsoft SDE-1 salary in India 2026 is ₹25–38 LPA including base, joining bonus, and RSUs." },
      { question: "Does Microsoft India hire freshers from non-IIT colleges?", answer: "Yes — Microsoft accepts off-campus applications from all colleges. Strong GitHub profile and competitive programming experience helps significantly." },
      { question: "What is the Microsoft 'As Appropriate' interviewer?", answer: "The 'As Appropriate' (AA) interviewer is a senior Microsoft engineer who calibrates the hiring bar. They carry significant weight in the final hiring decision." },
    ],
  },
  {
    slug: "sql-interview-questions-freshers-india-2026",
    title: "SQL Interview Questions for Freshers India 2026 — Top 50 Q&A",
    metaDescription: "Top 50 SQL interview questions for freshers in India 2026. Covers SELECT queries, JOINs, GROUP BY, subqueries, window functions, indexes, and common HR/analyst interview questions.",
    datePublished: "2026-07-10",
    heroImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&h=630&fit=crop",
    company: "General", category: "Technical",
    faqs: [
      { question: "Is SQL necessary for software engineer interviews in India?", answer: "Yes — SQL is asked at most Indian tech companies for SDE roles, including TCS, Infosys, Wipro, and product companies. It's mandatory for Data Analyst and Business Analyst interviews everywhere." },
      { question: "What SQL topics are most asked in TCS/Infosys interviews?", answer: "TCS and Infosys typically ask: basic SELECT queries, JOINs, GROUP BY + HAVING, subqueries, finding nth highest salary, and duplicate detection." },
      { question: "What is the difference between SQL and NoSQL for interview purposes?", answer: "SQL databases: structured data, ACID compliance, JOINs, schema-enforced. NoSQL: flexible schema, horizontal scaling, eventual consistency, no JOINs. Most Indian tech interviews focus on SQL." },
      { question: "Do freshers need to know window functions for SQL interviews?", answer: "For service IT companies: no. For product companies data analyst roles: yes. ROW_NUMBER, RANK, LAG/LEAD are commonly asked at Flipkart, Swiggy, Razorpay." },
    ],
  },
  {
    slug: "product-company-vs-service-company-india-career",
    title: "Product Company vs Service Company India — Honest Career Comparison 2026",
    metaDescription: "Honest comparison of product company vs IT service company careers in India for 2026. Covers salary difference, work quality, interview difficulty, promotion speed, and when to switch.",
    datePublished: "2026-07-08",
    heroImage: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=630&fit=crop",
    company: "General", category: "Career",
    faqs: [
      { question: "Is TCS better than Flipkart for career growth?", answer: "For salary and technical growth, Flipkart is significantly better — 5–7x starting salary, modern tech stack, faster promotions. For stability and international onsite, TCS has advantages." },
      { question: "Can I join TCS and later switch to a product company?", answer: "Yes — this is the most common career path in Indian tech. The switch takes 18–24 months of focused preparation while employed, targeting SDE-1 roles at Tier-2 product companies first." },
      { question: "What is the salary difference between TCS and Flipkart in India 2026?", answer: "TCS Ninja fresher: ₹3.36 LPA. Flipkart SDE-1 fresher: ₹20–25 LPA. That's a 6–7x difference at fresher level. At 5 years: TCS ₹10–16 LPA vs Flipkart SDE-2 ₹35–55 LPA." },
      { question: "Which is better for work-life balance — product or service company India?", answer: "Service companies generally have better work-life balance — 9-to-6 schedules, limited on-call expectations. Product companies at funded startups often have higher pressure and on-call rotations." },
    ],
  },
];

export function getBlogMetaBySlug(slug: string): BlogMeta | undefined {
  return BLOG_META.find((m) => m.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return BLOG_META.map((m) => m.slug);
}
