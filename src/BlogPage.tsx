"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { tokens as t, fonts } from "./auth/_tokens";
import { NavV2, MobileStickyCTA } from "./marketing-v2/HomepageV2";
import { FooterDome as FinalCTAFooterV2 } from "./marketing-v2/FooterDome";
import { useSEO } from "./useSEO";

/* PageShell — mirrors marketing-v2 chrome so the blog inherits the
   editorial brand (cream surface, Instrument Serif + Satoshi, copper
   accents, shared Nav + Footer + mobile sticky CTA). */
function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.cream,
        color: t.coal,
        fontFamily: fonts.sans,
        colorScheme: "light",
      }}
    >
      <style>{`
        .blog-skip { position: absolute; left: -9999px; top: 0; }
        .blog-skip:focus { left: 16px; top: 16px; z-index: 100; background: ${t.coal}; color: ${t.cream}; padding: 10px 16px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; text-decoration: none; }
        .blog-card { position: relative; transition: border-color 180ms cubic-bezier(0.16,1,0.3,1), box-shadow 180ms cubic-bezier(0.16,1,0.3,1), transform 180ms cubic-bezier(0.16,1,0.3,1); }
        .blog-card:hover { border-color: ${t.lineStrong}; box-shadow: 0 18px 44px rgba(14,12,8,0.08); transform: translateY(-2px); }
        .blog-card-link { color: inherit; text-decoration: none; outline: none; }
        .blog-card-link::after { content: ""; position: absolute; inset: 0; border-radius: inherit; z-index: 1; }
        .blog-card:has(.blog-card-link:focus-visible) { border-color: ${t.copper}; box-shadow: 0 0 0 3px ${t.copperSoft}; }
        .blog-card .blog-card-meta { position: relative; z-index: 2; }
        .blog-faq-btn:focus-visible { outline: 2px solid ${t.copper}; outline-offset: 2px; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { .blog-card { transition: none; } .blog-card:hover { transform: none; } }
        @media (max-width: 880px) {
          .blog-featured { grid-template-columns: 1fr !important; }
          .blog-featured-media { min-height: 220px !important; }
          .blog-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .blog-editorial-strip { grid-template-columns: 1fr !important; }
          .blog-editorial-strip-media { min-height: 260px !important; order: -1; }
          .blog-related-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .blog-grid { grid-template-columns: 1fr !important; }
          .blog-container { padding: 32px 20px 64px !important; }
          .blog-article { padding: 0 20px 56px !important; }
          .blog-hero { height: 220px !important; }
          .blog-hero-inner { padding: 0 20px 28px !important; }
          .blog-meta { padding: 16px 20px !important; }
          main, footer { padding-bottom: 96px !important; }
          .blog-filter-scroll { overflow-x: auto; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
          .blog-filter-scroll::-webkit-scrollbar { display: none; }
          .blog-editorial-strip-media { min-height: 200px !important; }
          .blog-strip-text { padding: 32px 24px !important; }
          .blog-index-cta { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>
      <a href="#main" className="blog-skip">Skip to content</a>
      <NavV2 />
      <main id="main">{children}</main>
      <FinalCTAFooterV2 />
      <MobileStickyCTA />
    </div>
  );
}

/* ─── Blog post data (SEO-optimized interview prep articles) ─── */
interface FAQ { question: string; answer: string }

interface BlogPost {
  slug: string;
  title: string;
  metaDescription: string;
  company: string;
  category: string;
  readTime: string;
  heroImage: string;
  heroAlt: string;
  datePublished: string;
  intro: string;
  sections: { heading: string; content: string }[];
  faqs: FAQ[];
  relatedSlugs: string[];
  cta: string;
  author?: string;
  /* Links to /companies/[slug] pages — cross-links blog → company page for PageRank flow */
  practicePageSlugs?: { label: string; slug: string }[];
}

const posts: BlogPost[] = [
  {
    slug: "top-10-google-interview-questions",
    title: "Top 10 Google Interview Questions (2026) — With Sample Answers",
    metaDescription: "Prepare for Google interviews with the top 10 most-asked behavioral and technical questions. Includes sample answers and scoring tips from AI analysis.",
    company: "Google",
    category: "Behavioral",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=1200&h=500&fit=crop",
    heroAlt: "Google office building representing Google interview preparation",
    datePublished: "2026-01-15",
    intro: "Google receives over 3 million applications per year, with an acceptance rate under 1%. The interview process is notoriously rigorous — but predictable. Here are the most-asked questions and how to answer them like a top 1% candidate.",
    sections: [
      { heading: "1. Tell me about a time you led a project with ambiguous requirements", content: "Google loves ambiguity. They want to see structured thinking under uncertainty. Use the STAR method but emphasize the 'situation' — describe the specific ambiguity (unclear stakeholders? shifting goals? no precedent?) and how you created clarity.\n\nSample opener: \"In Q3 last year, I was asked to lead our team's migration to a new data pipeline, but the target architecture hadn't been finalized and three teams had competing requirements...\"" },
      { heading: "2. Describe a time you had to influence without authority", content: "This is the #1 most-asked behavioral question at Google. They operate with a flat hierarchy where ICs regularly need to align cross-functional teams.\n\nKey: Focus on how you built consensus, not how you were right. Mention specific techniques — data-driven proposals, 1:1 conversations, pilot programs." },
      { heading: "3. Tell me about your biggest failure and what you learned", content: "Google explicitly trains interviewers to assess 'intellectual humility.' A candidate who can't name a real failure is a red flag.\n\nFramework: Pick a genuine failure (not a humble-brag). Describe the decision, the outcome, and — critically — the specific behavioral change you made afterward. They want to hear that your failures actually changed you." },
      { heading: "4. How would you improve Google Search?", content: "Product sense questions test whether you can think at Google's scale. Don't jump to solutions — start with users.\n\nStructure: (1) Clarify the user segment, (2) Identify the top pain point with data reasoning, (3) Propose a solution, (4) Define success metrics, (5) Acknowledge tradeoffs." },
      { heading: "5. Describe a time you used data to make a decision", content: "Google is a data-driven company. They want to see that you don't just collect data — you interpret it critically and act on it.\n\nTip: Include a moment where the data was ambiguous or contradictory, and explain how you resolved it. This separates good answers from great ones." },
      { heading: "6. How do you prioritize when everything is urgent?", content: "This tests your framework thinking. Google interviewers want to see a systematic approach, not just 'I work hard.'\n\nBest approach: Name your framework (ICE scoring, RICE, effort/impact matrix), then give a specific example where you used it and the outcome." },
      { heading: "7. Tell me about a time you disagreed with your manager", content: "Google values respectful dissent. The wrong answer is 'I always agree with my manager' — that's a red flag for Googleyness.\n\nStructure: Describe the disagreement, how you raised it constructively, the resolution, and what you learned about effective disagreement." },
      { heading: "8. Design a system to serve 1 billion users", content: "System design questions at Google assess scalability thinking. Start with requirements, estimate the scale, then work through the architecture layer by layer.\n\nTip: Always discuss tradeoffs explicitly. Google engineers make tradeoff decisions daily — they want to see you do the same." },
      { heading: "9. What makes you want to work at Google?", content: "This seems simple but is heavily weighted. Generic answers ('I love the culture') will hurt you.\n\nWinning approach: Reference a specific Google product, paper, or initiative. Connect it to your personal experience. Show you've done homework that goes beyond the careers page." },
      { heading: "10. Where do you see yourself in 5 years?", content: "Google wants people who think about impact at scale. Don't say 'managing a team' — say what problem you want to solve and how Google's resources uniquely enable it.\n\nBest answers connect personal growth with company mission. Show you've thought about how your trajectory aligns with Google's direction." },
    ],
    faqs: [
      { question: "How many rounds are in a Google interview?", answer: "Google typically has 5-6 rounds: phone screen, 2 coding interviews, 1 system design, 1 behavioral (Googleyness & Leadership), and sometimes a team-matching call." },
      { question: "How long does the Google interview process take?", answer: "The process typically takes 4-8 weeks from application to offer, though it can vary depending on the role and team." },
      { question: "What is the Google interview acceptance rate?", answer: "Google's acceptance rate is approximately 0.2-0.5%, making it one of the most competitive employers globally." },
    ],
    relatedSlugs: ["behavioral-interview-questions-freshers", "system-design-interview-preparation", "amazon-leadership-principles-interview"],
    practicePageSlugs: [
      { label: "Google India Engineering", slug: "google-india-engineering-interview-questions" },
      { label: "Google Behavioral", slug: "google-behavioral-interview-questions" },
    ],
    cta: "Practice these exact questions with HireStepX's AI interviewer — get scored feedback on each answer in minutes.",
  },
  {
    slug: "flipkart-interview-prep-guide",
    title: "Flipkart Interview Prep Guide — What to Expect in 2026",
    metaDescription: "Complete Flipkart interview preparation guide. Covers coding rounds, system design, HR behavioral questions, and insider tips for SDE-1 to SDE-3 roles.",
    company: "Flipkart",
    category: "Full Guide",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=500&fit=crop",
    heroAlt: "Team collaborating in a modern office, representing Flipkart interview preparation",
    datePublished: "2026-01-15",
    intro: "Flipkart is one of India's most sought-after tech employers, with competitive compensation and challenging problems at scale. Here's everything you need to know about their interview process for SDE roles.",
    sections: [
      { heading: "Interview Structure", content: "Flipkart's process typically has 4-5 rounds:\n\n1. Online Assessment — DSA problems (2-3 questions, 90 minutes)\n2. Machine Coding Round — Build a small system in 90 minutes\n3. Problem Solving (x2) — Whiteboard DSA with follow-ups\n4. System Design — For SDE-2+ roles\n5. Hiring Manager — Behavioral + culture fit" },
      { heading: "Most-Asked DSA Topics", content: "Based on interview reports, Flipkart heavily tests:\n\n• Trees and Graphs (especially BFS/DFS variations)\n• Dynamic Programming (medium-hard level)\n• Design Patterns (Strategy, Observer, Factory)\n• Hashmaps and two-pointer techniques\n• Matrix/grid problems" },
      { heading: "Machine Coding Round Tips", content: "This is unique to Flipkart and catches many candidates off guard. You'll be asked to build a small application (e.g., a parking lot system, splitwise clone) in 90 minutes.\n\nKeys to success:\n• Use proper OOP design — interfaces, clean separation\n• Write unit tests even if not required\n• Handle edge cases\n• Keep the code extensible" },
      { heading: "Behavioral Questions to Prepare", content: "Flipkart values ownership and customer obsession:\n\n• Tell me about a time you went above and beyond for a customer/user\n• Describe a technical decision you made that had business impact\n• How do you handle disagreements in code reviews?\n• What's the most complex system you've worked on?" },
      { heading: "Compensation Expectations (2026)", content: "SDE-1: ₹18-28 LPA\nSDE-2: ₹30-50 LPA\nSDE-3: ₹50-80 LPA\nSenior Staff: ₹80 LPA+\n\nFlipkart also offers ESOPs which can significantly increase total compensation." },
    ],
    faqs: [
      { question: "Does Flipkart have a machine coding round?", answer: "Yes, Flipkart's machine coding round is unique — you build a small application in 90 minutes. Focus on clean OOP design, extensibility, and edge case handling." },
      { question: "What is Flipkart SDE-1 salary in 2026?", answer: "Flipkart SDE-1 salary ranges from ₹18-28 LPA including base, bonus, and ESOPs." },
    ],
    relatedSlugs: ["top-10-google-interview-questions", "razorpay-interview-experience", "system-design-interview-preparation"],
    practicePageSlugs: [
      { label: "Flipkart SDE Interview Questions", slug: "flipkart-sde-interview-questions" },
      { label: "Flipkart PM Interview Questions", slug: "flipkart-pm-interview-questions" },
    ],
    cta: "Simulate a full Flipkart interview loop on HireStepX — behavioral, technical, and system design rounds with AI scoring.",
  },
  {
    slug: "behavioral-interview-questions-freshers",
    title: "50 Behavioral Interview Questions for Freshers — India Campus Placements",
    metaDescription: "Top 50 behavioral interview questions asked in Indian campus placements. Includes STAR method examples for freshers with limited work experience.",
    company: "Campus",
    category: "Freshers",
    readTime: "12 min",
    heroImage: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&h=500&fit=crop",
    heroAlt: "University students in a campus setting preparing for placement interviews",
    datePublished: "2026-01-15",
    intro: "Campus placements are stressful — especially behavioral rounds where you feel like you have 'nothing to talk about.' The truth is: college projects, internships, hackathons, and even group assignments are valid experiences. Here's how to use them.",
    sections: [
      { heading: "The STAR Method for Freshers", content: "STAR stands for Situation, Task, Action, Result. As a fresher, your examples can come from:\n\n• College projects and capstone work\n• Internships (even 2-month ones count)\n• Hackathons and coding competitions\n• Club leadership and event organization\n• Part-time work or freelancing\n\nThe key is specificity — don't say 'I worked in a team.' Say 'I led a 4-person team to build a food delivery app in 48 hours at HackMIT.'" },
      { heading: "Top 10 Questions for TCS/Infosys/Wipro", content: "Mass recruiters ask predictable questions:\n\n1. Tell me about yourself (keep it 90 seconds)\n2. Why should we hire you?\n3. What are your strengths and weaknesses?\n4. Describe a challenging situation you faced\n5. Where do you see yourself in 5 years?\n6. Why do you want to work here?\n7. Tell me about a team project\n8. How do you handle pressure?\n9. What's your biggest achievement?\n10. Do you have any questions for us?\n\nFor each, prepare a 2-minute answer using STAR." },
      { heading: "Top 10 Questions for Product Companies", content: "Startups and product companies go deeper:\n\n1. Walk me through a project you're proud of\n2. Tell me about a time you had to learn something quickly\n3. Describe a conflict in a team and how you resolved it\n4. What's the hardest bug you've debugged?\n5. How do you approach a problem you've never seen before?\n6. Tell me about a time you failed\n7. Describe a time you went beyond what was asked\n8. How do you prioritize when you have multiple deadlines?\n9. Tell me about a time you gave or received difficult feedback\n10. What would you do in your first 30 days here?" },
      { heading: "Questions About Your Projects", content: "Every fresher gets asked about their projects. Be ready for:\n\n• What was your specific contribution?\n• What was the most challenging part?\n• What would you do differently?\n• How did you handle disagreements in the team?\n• What did you learn that you couldn't learn in class?\n\nTip: Know your project's architecture, your design decisions, and the alternatives you considered." },
      { heading: "Common Mistakes Freshers Make", content: "1. Memorizing scripted answers (interviewers can tell)\n2. Using 'we' for everything (they want to know YOUR role)\n3. Giving vague answers without numbers or outcomes\n4. Not preparing questions to ask the interviewer\n5. Treating HR rounds as 'easy' — they have elimination power\n\nThe fix: Practice out loud. Record yourself. Get feedback on filler words, pacing, and structure." },
    ],
    faqs: [
      { question: "How do freshers answer behavioral questions without work experience?", answer: "Use examples from college projects, internships, hackathons, club leadership, and group assignments. The STAR method works the same — focus on your specific contribution and the outcome." },
      { question: "What is the STAR method?", answer: "STAR stands for Situation, Task, Action, Result. It's a structured framework for answering behavioral interview questions by describing a specific example from your experience." },
      { question: "How many behavioral questions should freshers prepare?", answer: "Prepare 8-10 strong STAR stories that can be adapted across different questions. Most behavioral questions map to themes like teamwork, leadership, conflict, failure, and initiative." },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "how-to-introduce-yourself-in-interview", "hr-interview-questions-answers-india"],
    practicePageSlugs: [
      { label: "TCS Ninja Practice Questions", slug: "tcs-ninja-interview-questions" },
      { label: "Infosys Campus Placement", slug: "infosys-campus-placement-interview" },
      { label: "Wipro Campus Placement", slug: "wipro-campus-placement-interview" },
    ],
    cta: "Practice your behavioral answers with HireStepX's AI interviewer — it'll score your STAR structure, clarity, and confidence in real-time.",
  },
  {
    slug: "razorpay-interview-experience",
    title: "Razorpay Interview Experience — SDE & PM Roles (2026)",
    metaDescription: "Detailed Razorpay interview experience for SDE and PM roles. Covers coding rounds, system design, culture fit, and salary expectations.",
    company: "Razorpay",
    category: "Experience",
    readTime: "7 min",
    heroImage: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=500&fit=crop",
    heroAlt: "Fintech workspace representing Razorpay interview preparation",
    datePublished: "2026-01-15",
    intro: "Razorpay has grown into one of India's most valuable fintech companies. Their interview process emphasizes problem-solving depth and ownership mindset. Here's what to expect.",
    sections: [
      { heading: "Interview Process Overview", content: "Razorpay's hiring loop:\n\n1. Recruiter screen (30 min) — background, motivation, salary expectations\n2. Online coding round — 2 DSA problems, 60 minutes\n3. Technical round 1 — DSA + problem decomposition\n4. Technical round 2 — System design (for SDE-2+)\n5. Culture round — Values alignment, ownership stories\n6. Hiring manager — Final bar raiser" },
      { heading: "What Razorpay Values", content: "Razorpay's culture centers on:\n\n• Ownership — They want people who treat problems as their own, not someone else's\n• Speed — Fintech moves fast; they value velocity with quality\n• Customer empathy — Understanding merchant pain points\n• Technical depth — Not just using tools, but understanding how they work\n\nIn behavioral rounds, tell stories that demonstrate these values." },
      { heading: "System Design Focus Areas", content: "Razorpay system design questions often relate to payments:\n\n• Design a payment gateway\n• Design a retry mechanism for failed transactions\n• Design a notification system at scale\n• Design an idempotent API\n\nKey: Always discuss consistency, reliability, and failure handling. In fintech, a bug can mean lost money." },
      { heading: "Salary Expectations (2026)", content: "SDE-1: ₹15-25 LPA\nSDE-2: ₹28-45 LPA\nSDE-3: ₹50-70 LPA\nPM: ₹25-50 LPA\n\nRazorpay offers competitive ESOPs and a strong learning environment." },
    ],
    faqs: [
      { question: "How hard is the Razorpay interview?", answer: "Razorpay interviews are moderately hard — similar to Flipkart level. DSA questions are medium-hard, and system design focuses on payment-specific problems like idempotency and retry mechanisms." },
      { question: "What is Razorpay SDE-2 salary?", answer: "Razorpay SDE-2 salary ranges from ₹28-45 LPA including base pay, bonuses, and ESOPs." },
    ],
    relatedSlugs: ["flipkart-interview-prep-guide", "system-design-interview-preparation", "ace-case-study-interviews"],
    practicePageSlugs: [
      { label: "Razorpay Engineering Interview", slug: "razorpay-engineering-interview-questions" },
      { label: "Razorpay PM Interview", slug: "razorpay-pm-interview-questions" },
    ],
    cta: "Run a Razorpay-style interview on HireStepX — system design, behavioral, and technical rounds tailored to fintech.",
  },
  {
    slug: "ace-case-study-interviews",
    title: "How to Ace Case Study Interviews — Framework + Examples",
    metaDescription: "Master case study interviews with proven frameworks. Includes examples for consulting, product, and strategy roles with step-by-step walkthroughs.",
    company: "Consulting",
    category: "Strategy",
    readTime: "9 min",
    heroImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=500&fit=crop",
    heroAlt: "Professional analyzing data charts for case study interview preparation",
    datePublished: "2026-01-15",
    intro: "Case study interviews test your ability to structure ambiguous problems, analyze data, and communicate recommendations clearly. Whether you're interviewing for McKinsey, a product role, or a startup strategy position — the core skills are the same.",
    sections: [
      { heading: "The Universal Case Framework", content: "Every case can be broken into four steps:\n\n1. Clarify — Ask questions to narrow the problem scope\n2. Structure — Create a framework (don't force-fit MECE; adapt to the problem)\n3. Analyze — Work through each branch with data and logic\n4. Recommend — State your answer, the key driver, risks, and next steps\n\nThe biggest mistake? Jumping to step 3 without doing step 1 properly." },
      { heading: "Market Sizing Questions", content: "Example: 'How many electric scooters are sold in India per year?'\n\nApproach:\n• Start with India's population (~1.4B)\n• Urban population: ~500M\n• Two-wheeler households: ~35% = 175M\n• Annual purchase rate: ~8% (new + replacement) = 14M\n• EV penetration: ~10% = 1.4M electric scooters/year\n\nAlways state assumptions, check reasonableness, and note what data you'd verify." },
      { heading: "Profitability Cases", content: "Framework: Revenue (Price x Volume) - Costs (Fixed + Variable)\n\nAlways ask:\n• Is the decline in revenue, increase in costs, or both?\n• When did it start? What changed?\n• Is it affecting the entire market or just this company?\n\nThen drill into the specific branch that's causing the issue." },
      { heading: "Product Strategy Cases", content: "Example: 'Should Swiggy launch a grocery delivery service?'\n\nStructure:\n1. Market attractiveness — TAM, growth, competition\n2. Strategic fit — Synergies with existing business, brand alignment\n3. Feasibility — Operational capability, investment required\n4. Risks — Cannibalization, regulatory, execution risk\n5. Recommendation with conditions" },
      { heading: "Practice Tips", content: "1. Practice out loud — case interviews are oral exams\n2. Write your structure before speaking\n3. Do mental math daily (no calculator in case interviews)\n4. Read business news — cases are inspired by real scenarios\n5. Record yourself and review for filler words and unclear transitions" },
    ],
    faqs: [
      { question: "How do I prepare for case study interviews?", answer: "Practice structuring problems using frameworks (not memorized templates), do mental math daily, read business news for case inspiration, and practice out loud — recording yourself helps identify filler words and unclear transitions." },
      { question: "What is the MECE framework?", answer: "MECE stands for Mutually Exclusive, Collectively Exhaustive. It means breaking a problem into categories that don't overlap and together cover all possibilities. It's the foundation of structured problem-solving in consulting." },
    ],
    practicePageSlugs: [
      { label: "McKinsey Case Interview Practice", slug: "mckinsey-case-study-interview-questions" },
      { label: "BCG Case Interview Practice", slug: "bcg-case-interview-practice" },
      { label: "Deloitte Case Interview Practice", slug: "deloitte-consulting-case-interview" },
    ],
    relatedSlugs: ["top-10-google-interview-questions", "salary-negotiation-tips-india", "tell-me-about-yourself-best-answer"],
    cta: "Practice case study interviews on HireStepX — the AI will play the interviewer, give you data when asked, and score your structure and recommendation.",
  },
  // ═══════════════════════════════════════════
  // NEW HIGH-VOLUME SEO POSTS
  // ═══════════════════════════════════════════
  {
    slug: "tcs-interview-questions-freshers-2026",
    title: "TCS Interview Questions for Freshers 2026 — Complete Preparation Guide",
    metaDescription: "Complete TCS interview questions guide for freshers 2026. Covers TCS NQT, technical round, HR questions, managerial round with sample answers and tips.",
    company: "TCS",
    category: "Freshers",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&h=500&fit=crop",
    heroAlt: "Students preparing for TCS campus placement interview",
    datePublished: "2026-02-01",
    intro: "TCS (Tata Consultancy Services) is the largest IT employer in India, hiring 40,000+ freshers annually through campus placements. The process is structured and predictable — which means thorough preparation gives you a real edge. Here's your complete guide.",
    sections: [
      { heading: "TCS Interview Process for Freshers", content: "TCS follows a standardized hiring process:\n\n1. TCS NQT (National Qualifier Test) — Online aptitude + coding test\n2. Technical Interview — CS fundamentals, project discussion\n3. Managerial Round — Behavioral + situational questions\n4. HR Round — Offer discussion, joining expectations\n\nThe NQT is the main filter — about 60% of candidates are eliminated here." },
      { heading: "TCS NQT Preparation Strategy", content: "The NQT has three sections:\n\n• Verbal Ability — Reading comprehension, grammar, vocabulary (20 min)\n• Reasoning Ability — Logical puzzles, pattern recognition (40 min)\n• Numerical Ability — Quantitative aptitude, data interpretation (40 min)\n• Coding — 1-2 programming problems in C/C++/Java/Python (30 min)\n\nTip: The coding section has the highest weightage for your score band (Digital, Prime, Ninja). Practice at least 50 coding problems of easy-medium difficulty." },
      { heading: "Top 20 TCS Technical Interview Questions", content: "1. What is OOP? Explain the four pillars.\n2. Difference between abstract class and interface\n3. What is normalization in DBMS? Explain 1NF, 2NF, 3NF\n4. Explain the OSI model layers\n5. What is a deadlock? How do you prevent it?\n6. Explain the difference between stack and heap memory\n7. What is a linked list? Types of linked lists?\n8. Explain TCP vs UDP\n9. What is a foreign key in SQL?\n10. Write a program to reverse a string\n11. Explain the software development lifecycle (SDLC)\n12. What is agile methodology?\n13. Difference between compiler and interpreter\n14. What is polymorphism? Give an example.\n15. Explain cloud computing and its types\n16. What is DNS? How does it work?\n17. Explain multithreading vs multiprocessing\n18. What is a binary search tree?\n19. Explain the MVC architecture\n20. What is REST API?\n\nFor each, prepare a 1-2 minute explanation with a real-world example." },
      { heading: "TCS HR Interview Questions", content: "1. Tell me about yourself\n2. Why TCS?\n3. Are you willing to relocate?\n4. Are you comfortable with night shifts?\n5. Do you have any backlogs?\n6. What is your expected salary?\n7. Where do you see yourself in 5 years?\n8. Why should we hire you?\n9. Do you have any bond or service agreement concerns?\n10. Are you open to any technology or domain?\n\nCritical: TCS expects 'yes' to relocation and night shifts. Hesitation is a red flag." },
      { heading: "TCS Salary for Freshers (2026)", content: "TCS Ninja: ₹3.36 LPA (most common)\nTCS Digital: ₹7-7.5 LPA\nTCS Prime: ₹9-9.5 LPA\n\nYour NQT score determines which band you qualify for. Digital and Prime require strong coding performance." },
    ],
    faqs: [
      { question: "What is TCS NQT cutoff for 2026?", answer: "TCS NQT doesn't have a fixed cutoff. Candidates are placed in bands — Ninja (lowest), Digital (mid), and Prime (highest) — based on their overall score with heavy emphasis on the coding section." },
      { question: "Is TCS interview easy for freshers?", answer: "TCS interviews are moderate in difficulty. The NQT aptitude test is the main filter. Technical and HR rounds are straightforward if you know CS fundamentals and can discuss your projects clearly." },
      { question: "How to prepare for TCS NQT in 2 weeks?", answer: "Focus on: (1) Solve 50+ coding problems in your strongest language, (2) Practice 20 aptitude questions daily, (3) Review CS fundamentals — DBMS, OOP, OS, networking. Use HireStepX to practice behavioral answers." },
    ],
    relatedSlugs: ["behavioral-interview-questions-freshers", "infosys-interview-questions-2026", "wipro-interview-questions-answers"],
    practicePageSlugs: [
      { label: "TCS Ninja Interview", slug: "tcs-ninja-interview-questions" },
      { label: "TCS Digital Interview", slug: "tcs-digital-interview-questions" },
      { label: "TCS Behavioral Round", slug: "tcs-behavioral-interview-questions" },
    ],
    cta: "Practice TCS interview questions with HireStepX's AI — get instant feedback on your technical explanations and HR answers.",
  },
  {
    slug: "infosys-interview-questions-2026",
    title: "Infosys Interview Questions 2026 — InfyTQ, Power Programmer & SP Roles",
    metaDescription: "Infosys interview questions for 2026 freshers. Covers InfyTQ certification, Power Programmer, Systems Engineer roles with technical and HR round preparation.",
    company: "Infosys",
    category: "Freshers",
    readTime: "9 min",
    heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=500&fit=crop",
    heroAlt: "Modern tech office representing Infosys interview preparation",
    datePublished: "2026-02-01",
    intro: "Infosys hires 20,000+ freshers annually across three main tracks: Systems Engineer (SE), Power Programmer (PP), and Digital Specialist Engineer (DSE). Each has different interview patterns — here's how to prepare for all of them.",
    sections: [
      { heading: "Infosys Hiring Tracks Explained", content: "Systems Engineer (SE): ₹3.6 LPA — General IT roles, aptitude-focused hiring\nPower Programmer (PP): ₹6.5 LPA — Strong coders, advanced DSA required\nDigital Specialist Engineer (DSE): ₹6.5-9.5 LPA — Specialized tech roles\n\nInfyTQ certification gives you a direct interview call for SE/PP tracks." },
      { heading: "Infosys Online Test Pattern", content: "The online test has sections:\n\n• Quantitative Aptitude — 10 questions, 25 minutes\n• Logical Reasoning — 10 questions, 25 minutes\n• Verbal Ability — 10 questions, 20 minutes\n• Pseudo Code / Programming — 5 questions, 10 minutes\n• Coding — 2 hands-on problems, 40 minutes\n\nFor Power Programmer: Additional advanced coding round with 3 hard problems." },
      { heading: "Top Technical Interview Questions", content: "1. Explain OOPS concepts with real-world examples\n2. What is the difference between SQL and NoSQL?\n3. Explain the concept of normalization\n4. What is a virtual function in C++?\n5. Difference between process and thread\n6. What is a REST API? How does it differ from SOAP?\n7. Explain the concept of inheritance with an example\n8. What is garbage collection?\n9. Explain the difference between ArrayList and LinkedList\n10. What is the purpose of the 'static' keyword?\n\nInfosys interviewers prefer conceptual clarity over rote definitions." },
      { heading: "HR Round Questions", content: "1. Tell me about yourself (keep under 2 minutes)\n2. Why Infosys over other companies?\n3. Are you flexible about location and technology?\n4. Tell me about a challenging project you worked on\n5. How do you handle tight deadlines?\n6. What do you know about Infosys?\n7. Are you comfortable with a 2-year service agreement?\n\nKey: Research Infosys's recent initiatives (AI, cloud, sustainability) — mentioning these shows genuine interest." },
      { heading: "InfyTQ Preparation Tips", content: "InfyTQ is Infosys's free certification platform:\n\n1. Complete all Python/Java modules on the platform\n2. Score 65%+ in the certification exam for guaranteed interview\n3. Practice on the platform's coding environment — the actual test uses the same interface\n4. Focus on data structures and algorithms for PP track\n\nTimeline: Start InfyTQ prep 2-3 months before campus drive." },
    ],
    faqs: [
      { question: "What is InfyTQ and is it mandatory?", answer: "InfyTQ is Infosys's free online training and certification platform. While not mandatory, completing InfyTQ certification (65%+ score) guarantees you a direct interview call, skipping the initial aptitude screening." },
      { question: "What is Infosys Power Programmer salary?", answer: "Infosys Power Programmer salary for freshers is ₹6.5 LPA (2026). This track requires strong coding skills and involves working on advanced technology projects." },
      { question: "How is Infosys interview different from TCS?", answer: "Infosys focuses more on conceptual understanding and coding ability, while TCS emphasizes aptitude scores. Infosys also has the InfyTQ certification path which TCS doesn't offer." },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "wipro-interview-questions-answers", "behavioral-interview-questions-freshers"],
    practicePageSlugs: [
      { label: "Infosys Campus Placement", slug: "infosys-campus-placement-interview" },
      { label: "Infosys Power Programmer", slug: "infosys-power-programmer-interview" },
      { label: "Infosys Behavioral Round", slug: "infosys-behavioral-interview-questions" },
    ],
    cta: "Simulate an Infosys interview on HireStepX — practice technical explanations and HR answers with AI-powered feedback.",
  },
  {
    slug: "how-to-introduce-yourself-in-interview",
    title: "How to Introduce Yourself in an Interview — Script + Examples (India)",
    metaDescription: "Learn how to introduce yourself in an interview with proven scripts and examples. Covers freshers, experienced professionals, and career changers with Indian context.",
    company: "General",
    category: "Skills",
    readTime: "7 min",
    heroImage: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1200&h=500&fit=crop",
    heroAlt: "Professional introducing themselves in a job interview setting",
    datePublished: "2026-02-15",
    intro: "\"Tell me about yourself\" is the first question in 95% of interviews — and most candidates blow it. They either recite their resume or give a 5-minute monologue. Here's how to nail it in 60-90 seconds with a structure that works every time.",
    sections: [
      { heading: "The Perfect Structure (Present-Past-Future)", content: "Follow this 3-part structure:\n\n1. Present — What you do now (role, key skills, recent achievement)\n2. Past — How you got here (education, relevant experience)\n3. Future — Why you're here (what excites you about this role)\n\nKeep it under 90 seconds. Practice with a timer." },
      { heading: "Script for Freshers", content: "\"Hi, I'm [Name], a recent [degree] graduate from [College] with a specialization in [field]. During college, I built [specific project] which [result/impact]. I also interned at [Company] where I worked on [specific task]. What I'm most passionate about is [relevant interest], which is exactly why I'm excited about this role at [Company] — specifically [something specific about the job description].\"\n\nTotal: ~60 seconds. Specific. Memorable." },
      { heading: "Script for Experienced Professionals", content: "\"I'm [Name], currently a [Title] at [Company] where I [key responsibility + metric]. Over the past [X] years, I've focused on [domain/skill], most recently [specific achievement with numbers]. Before that, I [relevant previous experience]. I'm looking to move into [target area] because [genuine reason], and this role at [Company] aligns with that — especially [specific aspect of the role].\"\n\nKey: Lead with your strongest recent achievement, not your job title." },
      { heading: "Script for Career Changers", content: "\"I'm [Name]. For the past [X] years, I've been working in [current field] as a [Title], where I developed strong skills in [transferable skills]. Recently, I've been [learning/building/contributing to] [new field] — for example, [specific project or certification]. I'm making this transition because [authentic reason], and I see a natural fit with [Company] because [connection].\"\n\nTip: Don't apologize for changing careers. Frame it as an evolution, not a pivot." },
      { heading: "Common Mistakes to Avoid", content: "1. Starting with \"So basically...\" — Start with your name.\n2. Reciting your resume chronologically — They can read it. Tell a story.\n3. Being too humble (\"I'm just a fresher\") — Own your experience.\n4. Going over 2 minutes — You'll lose them. 60-90 seconds max.\n5. Not customizing for the company — Generic intros feel lazy.\n6. Sharing personal details (\"I'm from Delhi, I have 2 siblings\") — Keep it professional unless asked.\n7. Using buzzwords (\"passionate\", \"hardworking\", \"team player\") — Show, don't tell." },
      { heading: "Practice Exercise", content: "Write your introduction using the Present-Past-Future structure. Then:\n\n1. Read it out loud 5 times\n2. Record yourself on your phone\n3. Listen back — check for filler words (um, so, basically)\n4. Time it — aim for 60-90 seconds\n5. Practice with a friend or AI interviewer\n\nThe goal: It should sound natural, not rehearsed. You know you've got it when you can deliver it without notes and it sounds like a conversation." },
    ],
    faqs: [
      { question: "How long should a self-introduction be in an interview?", answer: "Keep your self-introduction between 60-90 seconds (roughly 150-200 words). Anything longer risks losing the interviewer's attention. Practice with a timer." },
      { question: "Should I mention personal details in my introduction?", answer: "No. Keep your introduction professional — focus on your education, experience, skills, and why you're interested in the role. Only share personal details if specifically asked." },
      { question: "How to introduce yourself as a fresher with no experience?", answer: "Lead with your education and specialization, then highlight college projects, internships, hackathons, or relevant coursework. End with what excites you about the role. No experience ≠ nothing to say." },
    ],
    practicePageSlugs: [
      { label: "TCS Behavioral Interview Practice", slug: "tcs-behavioral-interview-questions" },
      { label: "Amazon Leadership Principles Practice", slug: "amazon-leadership-principles-interview" },
      { label: "Infosys Behavioral Practice", slug: "infosys-behavioral-interview-questions" },
    ],
    relatedSlugs: ["behavioral-interview-questions-freshers", "tell-me-about-yourself-best-answer", "hr-interview-questions-answers-india"],
    cta: "Practice your self-introduction with HireStepX's AI — get instant feedback on pacing, clarity, and filler words.",
  },
  {
    slug: "tell-me-about-yourself-best-answer",
    title: "\"Tell Me About Yourself\" — Best Answer Examples for 2026 Interviews",
    metaDescription: "Best answers for 'Tell me about yourself' in 2026 interviews. Includes scripts for freshers, experienced, managers, and career changers with real examples.",
    company: "General",
    category: "Skills",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=500&fit=crop",
    heroAlt: "Confident professional answering tell me about yourself interview question",
    datePublished: "2026-02-15",
    intro: "This single question sets the tone for your entire interview. A great answer creates momentum — a weak one puts you on the defensive for the next 45 minutes. Here are proven answer templates for every career stage.",
    sections: [
      { heading: "Why Interviewers Ask This Question", content: "They're evaluating three things:\n\n1. Communication skills — Can you organize thoughts clearly?\n2. Relevance — Do you understand what matters for this role?\n3. Self-awareness — Do you know your own strengths?\n\nThey're NOT asking for your life story. They want a professional highlight reel." },
      { heading: "The 3-Sentence Formula", content: "If you're nervous, use this minimal formula:\n\nSentence 1: Who you are professionally right now\nSentence 2: Your most relevant achievement or experience\nSentence 3: Why you're excited about this specific opportunity\n\nExample: \"I'm a backend engineer at a fintech startup where I built the payment reconciliation system processing ₹50 Cr monthly. My strength is designing reliable systems under tight deadlines — our last release had zero downtime. I'm excited about this role because [Company] is solving payment problems at 100x the scale, and I want to be part of that.\"" },
      { heading: "Answer for Software Engineers", content: "\"I'm a software engineer with [X] years of experience specializing in [area]. Currently at [Company], I'm responsible for [key project/system], which [impact metric]. The most interesting problem I've solved recently was [brief description]. I'm drawn to [Target Company] because [specific reason related to their engineering challenges].\"" },
      { heading: "Answer for Product Managers", content: "\"I'm a product manager who's spent the last [X] years building [type of products]. At [Company], I led the launch of [product/feature] which grew to [metric]. My approach combines user research with data-driven prioritization — I'm the PM who actually talks to customers before writing specs. [Target Company]'s focus on [specific area] is what brought me here.\"" },
      { heading: "Answer for Management Roles", content: "\"I lead a team of [X] engineers/analysts at [Company], where we're responsible for [domain]. Over the past year, I've [key achievement — growing the team, shipping a major project, improving metrics]. What I've learned is that the best teams are built on clear expectations and psychological safety. I'm looking at [Target Company] because [reason tied to leadership opportunity].\"" },
      { heading: "What NOT to Say", content: "• \"I'm a hard worker and a team player\" — Everyone says this. It means nothing.\n• \"My weakness is that I'm a perfectionist\" — Interviewers hear this 10x/day.\n• \"I've been coding since I was 12\" — Unless it's directly relevant, skip the origin story.\n• \"Basically, I'm just looking for a good opportunity\" — Too passive. Show direction.\n• Starting with \"So...\" or \"Well...\" — Start with your name or role." },
    ],
    faqs: [
      { question: "How to answer tell me about yourself for freshers?", answer: "Use the Present-Past-Future formula: Start with your degree and specialization, mention your strongest project or internship with a specific result, then connect to why you're excited about this role. Keep it under 90 seconds." },
      { question: "Should I mention my hobbies in tell me about yourself?", answer: "Only if they're directly relevant to the role or demonstrate a valuable skill. 'I contribute to open-source projects' is relevant for a developer role. 'I like cooking' is not." },
      { question: "What is the best answer for tell me about yourself for experienced professionals?", answer: "Lead with your current role and a quantified achievement, briefly mention your career trajectory, then explain why this specific opportunity interests you. Focus on impact, not job descriptions." },
    ],
    practicePageSlugs: [
      { label: "Google Behavioral Interview Practice", slug: "google-behavioral-interview-questions" },
      { label: "Amazon Leadership Principles Practice", slug: "amazon-leadership-principles-interview" },
      { label: "TCS Behavioral Interview Practice", slug: "tcs-behavioral-interview-questions" },
    ],
    relatedSlugs: ["how-to-introduce-yourself-in-interview", "hr-interview-questions-answers-india", "behavioral-interview-questions-freshers"],
    cta: "Practice your 'tell me about yourself' answer with HireStepX — the AI will score your structure, relevance, and delivery in real-time.",
  },
  {
    slug: "wipro-interview-questions-answers",
    title: "Wipro Interview Questions & Answers 2026 — Elite NTH & Turbo Roles",
    metaDescription: "Wipro interview questions for freshers 2026. Complete guide for Elite NTH, Turbo, and WILP programs with technical, aptitude, and HR round preparation.",
    company: "Wipro",
    category: "Freshers",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1504384764586-bb4cdc1707b0?w=1200&h=500&fit=crop",
    heroAlt: "Corporate office environment representing Wipro interview preparation",
    datePublished: "2026-02-15",
    intro: "Wipro hires 15,000+ freshers annually through three main programs: Elite NTH (National Talent Hunt), Turbo, and WILP. The selection process is aptitude-heavy with a structured interview format. Here's how to prepare.",
    sections: [
      { heading: "Wipro Hiring Programs", content: "Elite NTH: ₹3.5 LPA — Standard engineering roles via online test + interview\nTurbo: ₹6.5 LPA — Advanced engineering roles, harder coding round\nWILP: ₹3.5 LPA — Work-Integrated Learning Program for non-CS graduates\n\nYour test score determines which track you're eligible for." },
      { heading: "Wipro Online Assessment", content: "Pattern (2026):\n\n• Aptitude — 20 questions, 30 minutes (quantitative + logical + verbal)\n• Written Communication — Essay in 20 minutes\n• Coding — 2 problems in 60 minutes\n\nFor Turbo: Additional advanced coding round (3 problems, hard difficulty)\n\nMinimum cutoff: ~60% in aptitude, at least 1 coding problem fully solved." },
      { heading: "Technical Interview Questions", content: "1. What are access modifiers in Java/C++?\n2. Explain the difference between overloading and overriding\n3. What is a primary key vs unique key?\n4. Explain the software testing lifecycle\n5. What is a JOIN in SQL? Types of JOINs?\n6. What is the difference between HTTP and HTTPS?\n7. Explain the concept of multithreading\n8. What is cloud computing? Types of cloud services?\n9. What is an API? How does it work?\n10. Explain your final year project architecture\n\nWipro values conceptual clarity and the ability to explain things simply." },
      { heading: "HR Round Preparation", content: "Wipro HR questions are straightforward:\n\n1. Tell me about yourself\n2. Why Wipro?\n3. Are you ready to relocate to any city?\n4. What is your expected CTC?\n5. Are you comfortable working in shifts?\n6. Do you have any service bond concerns? (Wipro has a 1-year bond)\n7. When can you join?\n\nKey: Wipro values adaptability. Express willingness to work across technologies, locations, and shifts." },
    ],
    faqs: [
      { question: "What is Wipro Elite NTH salary for freshers?", answer: "Wipro Elite NTH salary for freshers in 2026 is ₹3.5 LPA. The Turbo track offers ₹6.5 LPA for candidates with stronger coding skills." },
      { question: "Is Wipro interview difficult?", answer: "Wipro interviews are considered easy to moderate. The online aptitude test is the main filter. Technical interviews focus on CS fundamentals, and HR rounds are straightforward." },
      { question: "What is the difference between Wipro Elite and Turbo?", answer: "Elite NTH (₹3.5 LPA) is for general engineering roles, while Turbo (₹6.5 LPA) targets strong coders with an additional hard coding round. Both share the same initial aptitude test." },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "infosys-interview-questions-2026", "behavioral-interview-questions-freshers"],
    practicePageSlugs: [
      { label: "Wipro Campus Placement", slug: "wipro-campus-placement-interview" },
      { label: "Wipro Behavioral Round", slug: "wipro-behavioral-interview-questions" },
    ],
    cta: "Practice Wipro interview questions on HireStepX — simulate technical, aptitude, and HR rounds with AI scoring.",
  },
  {
    slug: "hr-interview-questions-answers-india",
    title: "Top 30 HR Interview Questions & Answers for India (2026)",
    metaDescription: "30 most-asked HR interview questions in India with best answers. Covers freshers and experienced candidates with salary negotiation tips and common mistakes.",
    company: "General",
    category: "HR Round",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=500&fit=crop",
    heroAlt: "HR interview in progress with interviewer and candidate",
    datePublished: "2026-03-01",
    intro: "HR rounds are often treated as formalities — but they have real elimination power. In India, HR rejection rates range from 10-25% even after clearing technical rounds. Here are the 30 questions you'll face and how to answer them.",
    sections: [
      { heading: "The 10 Universal HR Questions", content: "These appear in almost every Indian company interview:\n\n1. Tell me about yourself\n2. Why do you want to work here?\n3. What are your strengths?\n4. What are your weaknesses?\n5. Where do you see yourself in 5 years?\n6. Why should we hire you?\n7. Tell me about a challenge you faced\n8. How do you handle stress/pressure?\n9. What are your salary expectations?\n10. Do you have any questions for us?" },
      { heading: "Answering 'What Are Your Weaknesses?'", content: "The worst answers:\n• \"I'm a perfectionist\" (cliché)\n• \"I work too hard\" (insincere)\n• \"I don't have any\" (arrogant)\n\nThe right approach: Pick a real but manageable weakness, explain what you're doing to improve, and give evidence of progress.\n\nExample: \"I used to struggle with delegating — I'd try to do everything myself. I recognized this during my final year project when I was stretched too thin. Now I consciously break tasks into team assignments and set checkpoints. My last internship manager actually noted my delegation skills as a strength in my review.\"" },
      { heading: "Salary Negotiation Questions", content: "Q: \"What are your salary expectations?\"\n\nFor freshers: \"I'm aware of the industry standard for this role and level. I'm open to a competitive offer that reflects my skills and the responsibilities of this position.\"\n\nFor experienced: \"Based on my [X] years of experience and the market rate for this role, I'm looking at [range]. But I'm also evaluating the overall package — growth opportunities, learning, and team culture matter to me.\"\n\nNever give a single number. Always give a range with your target at the bottom." },
      { heading: "Tricky Questions and How to Handle Them", content: "Q: \"Why did you leave your last job?\" — Never badmouth. Say: \"I'm looking for [positive thing] that this role offers.\"\n\nQ: \"Tell me about a conflict with a colleague\" — Show maturity. Describe the situation, how you listened to their perspective, and the resolution.\n\nQ: \"Are you planning to do an MBA/MS?\" — Be honest but strategic. \"My immediate focus is building depth in [field]. I'm open to further education if it aligns with my career path.\"\n\nQ: \"Do you have any backlogs?\" — If yes, be honest: \"I had [X] backlogs in [subjects], which I cleared by [date]. It taught me about time management and prioritization.\"" },
      { heading: "Body Language Tips for HR Rounds", content: "1. Maintain natural eye contact (70% of the time)\n2. Sit upright but not rigid\n3. Use hand gestures when explaining — it signals confidence\n4. Smile when greeting, not constantly\n5. Don't cross your arms\n6. Nod occasionally to show engagement\n7. Avoid touching your face or hair repeatedly\n\nIn virtual interviews: Ensure good lighting, keep your background clean, and speak clearly into your microphone." },
    ],
    faqs: [
      { question: "Can you get rejected in HR round?", answer: "Yes. HR rejection rates in India are 10-25% even after clearing technical rounds. Common reasons: salary mismatch, poor communication, lack of enthusiasm, or red flags in behavioral answers." },
      { question: "How to answer 'Why should we hire you' for freshers?", answer: "Highlight your relevant skills, a specific project or achievement that demonstrates those skills, and your enthusiasm for the company/role. End with what value you'll bring in the first 90 days." },
      { question: "Should I negotiate salary in an HR interview?", answer: "Yes, but tactfully. Research market rates, give a range (not a single number), and express that you value the total package including learning and growth opportunities." },
    ],
    practicePageSlugs: [
      { label: "TCS HR Round Practice", slug: "tcs-hr-round-questions" },
      { label: "Accenture Behavioral Practice", slug: "accenture-behavioral-interview-questions" },
      { label: "Wipro Behavioral Practice", slug: "wipro-behavioral-interview-questions" },
    ],
    relatedSlugs: ["how-to-introduce-yourself-in-interview", "tell-me-about-yourself-best-answer", "salary-negotiation-tips-india"],
    cta: "Practice HR interview questions with HireStepX — the AI evaluates your answers for clarity, confidence, and professionalism.",
  },
  {
    slug: "amazon-leadership-principles-interview",
    title: "Amazon Leadership Principles Interview Guide — All 16 Principles Explained",
    metaDescription: "Master Amazon's 16 Leadership Principles for interviews. Includes STAR examples, most-asked questions per principle, and tips for SDE and PM roles in India.",
    company: "Amazon",
    category: "Behavioral",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=1200&h=500&fit=crop",
    heroAlt: "Amazon headquarters representing Amazon leadership principles interview prep",
    datePublished: "2026-03-01",
    intro: "Every Amazon interview question maps to one of their 16 Leadership Principles. Interviewers are trained to assess specific LPs per question. If you understand the principles, you can predict and prepare for nearly every question they'll ask.",
    sections: [
      { heading: "The 5 Most-Tested Principles", content: "While all 16 matter, these 5 appear in 80%+ of interview loops:\n\n1. Customer Obsession — \"Tell me about a time you went above and beyond for a customer\"\n2. Ownership — \"Describe a time you took on something outside your area of responsibility\"\n3. Dive Deep — \"Tell me about a time you had to debug a complex problem\"\n4. Bias for Action — \"Describe a time you made a decision with incomplete data\"\n5. Deliver Results — \"Tell me about your most impactful project\"\n\nPrepare 2 STAR stories for each of these." },
      { heading: "How Amazon Interviews Are Structured", content: "Amazon uses the Bar Raiser process:\n\n• 4-6 interviews, each 45-60 minutes\n• Each interviewer is assigned 2-3 Leadership Principles to assess\n• One interviewer is the 'Bar Raiser' — they can veto a hire\n• Every question is behavioral (STAR format expected)\n• For SDE roles: 2 coding + 1 system design + 1-2 behavioral rounds\n\nFormat: \"Tell me about a time when...\" followed by deep-dive follow-ups." },
      { heading: "STAR Method for Amazon", content: "Amazon interviewers are trained to dig deeper than most companies. Expect:\n\n• \"What was YOUR specific role?\" (they want I, not we)\n• \"What data did you use?\" (Dive Deep)\n• \"What would you do differently?\" (Earn Trust / Learn and Be Curious)\n• \"What was the measurable impact?\" (Deliver Results)\n\nTip: Prepare metrics for every story. Amazon runs on data — vague answers score poorly." },
      { heading: "Amazon India-Specific Tips", content: "Amazon India (Hyderabad, Bangalore) has some unique patterns:\n\n• Heavy focus on scale — India is Amazon's fastest-growing market\n• System design questions often involve India-specific constraints (network latency, regional language support, COD payments)\n• The bar for SDE-2 is high — prepare for hard LP + coding interviews\n• Amazon India offers SDE-1: ₹22-35 LPA, SDE-2: ₹35-60 LPA" },
      { heading: "Preparing Your Story Bank", content: "Create a 10-story bank mapped to Leadership Principles:\n\n• 2 stories about Customer Obsession\n• 2 about Ownership (taking initiative beyond your role)\n• 2 about Deliver Results (quantified impact)\n• 1 about disagreeing with a team/manager (Have Backbone)\n• 1 about learning something new quickly (Learn and Be Curious)\n• 1 about simplifying a complex process (Invent and Simplify)\n• 1 about a failure and what you learned (Earn Trust)\n\nEach story should have: clear situation, your specific actions, measurable result, and a reflection." },
    ],
    faqs: [
      { question: "How many Leadership Principles does Amazon have?", answer: "Amazon has 16 Leadership Principles (updated from 14 in 2021). The two newest are 'Strive to be Earth's Best Employer' and 'Success and Scale Bring Broad Responsibility.'" },
      { question: "What is the Amazon Bar Raiser?", answer: "The Bar Raiser is an experienced interviewer from a different team who ensures hiring standards stay high. They have veto power — even if all other interviewers say 'hire', the Bar Raiser can reject a candidate." },
      { question: "What is Amazon SDE-1 salary in India?", answer: "Amazon SDE-1 salary in India (2026) is ₹22-35 LPA including base, signing bonus, and RSUs. Bangalore and Hyderabad are the primary locations." },
    ],
    relatedSlugs: ["top-10-google-interview-questions", "system-design-interview-preparation", "behavioral-interview-questions-freshers"],
    practicePageSlugs: [
      { label: "Amazon SDE + Leadership Principles", slug: "amazon-sde-leadership-principles-interview" },
      { label: "Amazon Campus Placement India", slug: "amazon-campus-placement-india" },
    ],
    cta: "Practice Amazon Leadership Principle questions on HireStepX — the AI maps each answer to specific LPs and scores your STAR structure.",
  },
  {
    slug: "system-design-interview-preparation",
    title: "System Design Interview Preparation — Complete Guide for Indian Engineers",
    metaDescription: "Complete system design interview prep guide. Covers step-by-step framework, top 15 questions, and India-specific tips for Google, Amazon, Flipkart, and startup interviews.",
    company: "General",
    category: "Technical",
    readTime: "12 min",
    heroImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=500&fit=crop",
    heroAlt: "System architecture diagram representing system design interview preparation",
    datePublished: "2026-03-15",
    intro: "System design interviews are the highest-signal round for SDE-2+ roles at top companies. They test whether you can think at scale, make tradeoffs, and communicate technical decisions clearly. Here's a step-by-step preparation framework.",
    sections: [
      { heading: "The 5-Step Framework", content: "Follow this framework in every system design interview:\n\n1. Requirements (3-5 min) — Clarify functional and non-functional requirements. Ask about scale, latency, consistency requirements.\n\n2. Estimation (2-3 min) — Back-of-envelope math. How many users? QPS? Storage? Bandwidth?\n\n3. High-Level Design (10 min) — Draw the major components: clients, load balancers, application servers, databases, caches, message queues.\n\n4. Deep Dive (15-20 min) — The interviewer picks 1-2 areas to go deep. This is where you differentiate yourself.\n\n5. Tradeoffs & Extensions (5 min) — Discuss what you'd change for 10x scale, what you'd monitor, how you'd handle failures." },
      { heading: "Top 15 System Design Questions", content: "Most-asked across Google, Amazon, Flipkart, and startups:\n\n1. Design URL Shortener (like bit.ly)\n2. Design a Chat Application (like WhatsApp)\n3. Design a News Feed (like Facebook/Instagram)\n4. Design a Rate Limiter\n5. Design a Notification System\n6. Design Twitter/X\n7. Design YouTube (video streaming at scale)\n8. Design an E-commerce System (like Flipkart)\n9. Design a Payment System (like Razorpay)\n10. Design a Search Autocomplete\n11. Design a Ride-Sharing Service (like Uber/Ola)\n12. Design a File Storage System (like Google Drive)\n13. Design a Distributed Cache\n14. Design a Job Scheduler\n15. Design a Metrics/Monitoring System" },
      { heading: "Key Concepts You Must Know", content: "• Load Balancing — Round-robin, consistent hashing, L4 vs L7\n• Caching — Redis/Memcached, cache-aside vs write-through, eviction policies\n• Database — SQL vs NoSQL, sharding strategies, replication\n• Message Queues — Kafka, RabbitMQ, async processing\n• CDN — How CDNs work, cache invalidation\n• Consistency Models — Strong, eventual, causal consistency\n• CAP Theorem — You can't have all three: choose two\n• API Design — REST vs GraphQL, rate limiting, pagination\n• Microservices — Service discovery, circuit breakers, saga pattern" },
      { heading: "India-Specific Tips", content: "Indian tech interviews often include constraints that US interviews don't:\n\n• COD (Cash on Delivery) handling in e-commerce systems\n• UPI/IMPS payment integration in payment systems\n• Multi-language/script support (Hindi, Tamil, Bengali)\n• Low-bandwidth optimization for tier-2/3 city users\n• India's data localization requirements (RBI mandates for financial data)\n• Spike handling for events like Flipkart Big Billion Days or IPL streaming\n\nMentioning these shows domain awareness and impresses Indian interviewers." },
      { heading: "Preparation Timeline (4 Weeks)", content: "Week 1: Learn the fundamentals — caching, databases, load balancing, message queues\nWeek 2: Practice 3 classic problems (URL shortener, chat app, news feed)\nWeek 3: Practice 3 harder problems (payment system, search, ride-sharing)\nWeek 4: Mock interviews — practice explaining your design out loud\n\nResources: System Design Primer (GitHub), Designing Data-Intensive Applications (book), HireStepX's AI system design interviews" },
    ],
    faqs: [
      { question: "When do system design interviews start in the interview process?", answer: "System design rounds are typically required for SDE-2 (3+ years experience) and above. Some companies like Google and Amazon include a simplified version for SDE-1 as well." },
      { question: "How long is a system design interview?", answer: "System design interviews are typically 45-60 minutes. Spend 5 minutes on requirements, 3 on estimation, 10 on high-level design, 20 on deep dives, and 5 on tradeoffs." },
      { question: "What if I get a system I've never designed before?", answer: "Use the framework: clarify requirements, estimate scale, draw high-level components, and deep-dive where the interviewer guides you. The process matters more than the specific system." },
    ],
    relatedSlugs: ["top-10-google-interview-questions", "amazon-leadership-principles-interview", "flipkart-interview-prep-guide"],
    practicePageSlugs: [
      { label: "Flipkart SDE Interview", slug: "flipkart-sde-interview-questions" },
      { label: "Razorpay Engineering Interview", slug: "razorpay-engineering-interview-questions" },
      { label: "PhonePe Engineering Interview", slug: "phonepe-engineering-interview-questions" },
    ],
    cta: "Practice system design interviews on HireStepX — explain your architecture to the AI and get feedback on your approach, tradeoffs, and communication.",
  },
  {
    slug: "salary-negotiation-tips-india",
    title: "Salary Negotiation Tips for India — How to Get 20-40% More",
    metaDescription: "Practical salary negotiation tips for Indian job market. Covers freshers, experienced professionals, counter-offer strategies, and exact scripts to use.",
    company: "General",
    category: "Career",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=500&fit=crop",
    heroAlt: "Professional negotiating salary with charts and data",
    datePublished: "2026-03-15",
    intro: "Most Indians don't negotiate salary — and leave 20-40% on the table. Companies expect negotiation. They budget for it. When you accept the first offer, you're not being humble — you're being underpaid. Here's how to negotiate effectively.",
    sections: [
      { heading: "When Companies Have Room to Negotiate", content: "Companies always have a budget range. Typical ranges:\n\n• Freshers (mass hiring): ₹0-10% room — Very little flexibility\n• Freshers (product companies): ₹15-30% room\n• Experienced (3-5 yrs): ₹20-40% room\n• Experienced (5+ yrs): ₹25-50% room\n• Leadership: Highly negotiable\n\nRule of thumb: If the company reached out to YOU, there's more room. If you applied cold, less room." },
      { heading: "The Negotiation Script", content: "When they share the offer:\n\n\"Thank you for the offer. I'm genuinely excited about this role and the team. I've done some research on market compensation for this role and level, and based on [my experience / competing offer / market data], I was hoping we could explore something closer to [X]. Is there flexibility in the base/stocks/joining bonus?\"\n\nKey principles:\n• Express enthusiasm first (they need to know you'll accept if they meet the number)\n• Anchor with a specific number (not a range)\n• Name the reason (market data, competing offer, experience)\n• Ask about the total package, not just base salary" },
      { heading: "Leverage: The Only Thing That Matters", content: "Your negotiation power comes from:\n\n1. Competing offers — The #1 leverage. Even one other offer changes the dynamic.\n2. Rare skills — If you have skills they can't easily find, you have power.\n3. Internal referral — Referred candidates often get better offers.\n4. The company's urgency — If they need to fill the role fast, you benefit.\n\nIf you have zero leverage: Focus on non-salary benefits (joining bonus, flexible work, learning budget, title)." },
      { heading: "What to Negotiate Beyond Salary", content: "Base salary is just one component. Also negotiate:\n\n• Joining bonus — Often easier to get than base salary increase (₹50K-5L)\n• ESOPs/RSUs — Ask for more vesting or accelerated schedule\n• Flexible work — Remote days, flexible hours\n• Learning budget — Conference attendance, certifications\n• Title — A better title costs the company nothing but helps your next negotiation\n• Notice period buyout — If your current employer has a long notice period\n• Relocation assistance — If moving cities" },
      { heading: "Common Mistakes", content: "1. Negotiating before getting the offer — Wait until they commit to you.\n2. Sharing your current salary too early — \"I'd prefer to focus on the value I'll bring to this role.\"\n3. Accepting immediately — \"Thank you! Can I have 2-3 days to review the complete offer?\"\n4. Negotiating via email for important points — Do it on a call where tone matters.\n5. Burning bridges — Always be grateful and professional, even if you decline.\n6. Not negotiating at all — The worst that happens is they say no." },
    ],
    faqs: [
      { question: "Is it OK to negotiate salary in India?", answer: "Absolutely. Companies expect it and budget for it. Not negotiating often means accepting 20-40% less than what was available. Be professional and back your ask with data." },
      { question: "How much should I counter-offer in India?", answer: "Counter 15-30% above the initial offer for experienced roles. For freshers at mass-hiring companies, counter by 5-10%. Always anchor with a specific number, not a range." },
      { question: "What if they say the offer is non-negotiable?", answer: "Ask about other components: joining bonus, ESOPs, flexible work, title, or learning budget. If everything is truly fixed, evaluate the total package against your alternatives." },
    ],
    practicePageSlugs: [
      { label: "Salary Negotiation Practice", slug: "salary-negotiation-india-tech" },
    ],
    relatedSlugs: ["hr-interview-questions-answers-india", "tell-me-about-yourself-best-answer", "ace-case-study-interviews"],
    cta: "Practice salary negotiation conversations with HireStepX's AI — simulate the back-and-forth and build your confidence before the real thing.",
  },
  {
    slug: "campus-placement-interview-tips",
    title: "Campus Placement Interview Tips — Complete Guide for 2026 Freshers",
    metaDescription: "Complete campus placement interview preparation guide for Indian engineering students. Covers aptitude, technical, HR rounds, and insider tips to crack on-campus interviews.",
    company: "General",
    category: "Campus",
    readTime: "9 min",
    heroImage: "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=1200&h=500&fit=crop",
    heroAlt: "College campus representing campus placement interviews",
    datePublished: "2026-04-01",
    intro: "Campus placement season is the most stressful time of engineering college. Companies visit for 1-2 days, shortlist in hours, and your career trajectory gets decided in a few rounds. Here's everything you need to know to make the most of it.",
    sections: [
      { heading: "Typical Placement Process", content: "Most companies follow this structure:\n\n1. Pre-Placement Talk (PPT) — Company presentation. Attend every one, even for companies you're unsure about.\n2. Aptitude Test — Quantitative, verbal, logical reasoning (45-90 minutes)\n3. Technical Round — DSA problems, CS fundamentals, project discussion\n4. HR Round — Behavioral questions, salary expectations, joining date\n\nService companies (TCS, Infosys, Wipro): Heavy on aptitude + HR\nProduct companies (Google, Microsoft, Flipkart): Heavy on DSA + system design" },
      { heading: "Aptitude Round Preparation", content: "This round eliminates 60-80% of candidates. Focus areas:\n\n• Quantitative — Percentages, profit/loss, time & work, permutations. Practice from IndiaBIX or PrepInsta.\n• Logical Reasoning — Puzzles, seating arrangements, blood relations. Speed matters more than difficulty.\n• Verbal — Reading comprehension, sentence correction, para jumbles.\n\nTime management tip: Skip questions you can't solve in 90 seconds. Come back to them if time permits." },
      { heading: "Technical Round — What to Expect", content: "For service companies:\n• Basic OOP concepts (inheritance, polymorphism, encapsulation)\n• SQL queries (joins, group by, subqueries)\n• One coding problem (easy-medium)\n• Project discussion from your resume\n\nFor product companies:\n• 2-3 DSA problems (medium-hard)\n• System design basics for senior roles\n• Deep dive into 1-2 resume projects\n• CS fundamentals (OS, DBMS, networking)\n\nMost-asked topics: Arrays, strings, linked lists, trees, dynamic programming." },
      { heading: "HR Round — 10 Most-Asked Questions", content: "1. Tell me about yourself (use the Present-Past-Future formula)\n2. Why do you want to join [company]?\n3. What are your strengths and weaknesses?\n4. Where do you see yourself in 5 years?\n5. Why should we hire you?\n6. Tell me about a team project.\n7. How do you handle pressure?\n8. Are you willing to relocate?\n9. Do you have any questions for us?\n10. What is your expected salary?\n\nTip: For 'expected salary,' say 'I'm open to the standard package offered for this role at [company]. I'm more focused on learning and growth.'" },
      { heading: "Day-Before Checklist", content: "The night before your placement:\n\n• Print 5 copies of your resume on good paper\n• Prepare a 60-second 'Tell me about yourself' answer\n• Review your top 2 resume projects — be ready for deep questions\n• Iron your formal clothes. First impressions matter.\n• Sleep by 10 PM. Seriously.\n• Charge your laptop (some coding rounds are on personal devices)\n• Save your question for 'Do you have any questions?' — ask something specific about the team or growth path." },
    ],
    faqs: [
      { question: "How to prepare for campus placements in 1 month?", answer: "Week 1-2: Focus on aptitude (practice 50 questions daily). Week 3: Review DSA fundamentals and practice 2-3 problems daily. Week 4: Mock interviews for behavioral and technical rounds. Use HireStepX for realistic practice." },
      { question: "What GPA do companies look for in placements?", answer: "Most service companies require 60-65% (6.0-6.5 CGPA). Product companies usually require 70%+ (7.0 CGPA). Some companies like Google don't have a strict GPA cutoff." },
      { question: "How to answer 'Tell me about yourself' in campus placements?", answer: "Use Present-Past-Future: Start with your current status (final year, branch), mention 1-2 relevant projects or internships, then state your career interest. Keep it under 90 seconds." },
    ],
    practicePageSlugs: [
      { label: "TCS Campus Placement Practice", slug: "tcs-ninja-interview-questions" },
      { label: "Infosys Campus Interview Practice", slug: "infosys-campus-interview-questions" },
      { label: "Amazon Campus Placement Practice", slug: "amazon-campus-placement-india" },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "behavioral-interview-questions-freshers", "how-to-introduce-yourself-in-interview"],
    cta: "Practice campus placement interview questions with HireStepX — get AI-scored feedback and walk into your placement round prepared.",
  },
  {
    slug: "mock-interview-practice-guide",
    title: "How to Practice Mock Interviews Effectively — The Complete Guide",
    metaDescription: "Learn how to practice mock interviews for maximum improvement. Covers self-practice, peer practice, AI mock interviews, and the science behind interview skill building.",
    company: "General",
    category: "Career",
    readTime: "7 min",
    heroImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=500&fit=crop",
    heroAlt: "Person practicing interview preparation with laptop",
    datePublished: "2026-04-15",
    intro: "Reading interview tips is not interview practice. It's like reading about swimming — useful, but you won't learn to swim until you get in the water. Here's how to practice mock interviews in a way that actually builds the muscle memory you need for the real thing.",
    sections: [
      { heading: "Why Most Interview Practice Doesn't Work", content: "The 3 most common mistakes:\n\n1. Reading answers instead of speaking them — Your brain processes written and spoken answers differently. You need to practice saying words out loud, under time pressure.\n2. Practicing the same questions over and over — Real interviews have follow-up questions you can't predict. Practice should simulate unpredictability.\n3. No feedback loop — Without objective feedback, you can't identify what you're doing wrong. You'll just repeat the same mistakes with more confidence.\n\nEffective practice requires: speaking out loud + unpredictable questions + specific feedback." },
      { heading: "The 3-Session Framework", content: "A practical structure most candidates find useful:\n\nSession 1: Baseline — Do a full mock interview without preparation. Record yourself. This establishes where you actually are (not where you think you are). Most people are shocked by their filler word count.\n\nSession 2: Targeted Practice — Focus on the 2-3 weaknesses identified in Session 1. If your answers lack structure, practice STAR method. If you use too many filler words, practice pausing instead.\n\nSession 3: Full Simulation — Simulate the real interview as closely as possible. Different question types, time pressure, follow-ups. This builds confidence through realistic exposure." },
      { heading: "Self-Practice vs. Peer Practice vs. AI Practice", content: "Self-practice (mirror/recording):\n+ Free, no scheduling\n- No follow-up questions, hard to be objective about yourself\n- Best for: Rehearsing specific answers you've already crafted\n\nPeer practice (friends/study groups):\n+ Real human interaction\n- Friends won't give harsh feedback, inconsistent quality, scheduling is hard\n- Best for: Getting comfortable with the social aspect of interviews\n\nAI mock interviews (HireStepX):\n+ Available 24/7, objective scoring, tracks improvement, company-specific\n- Not a human connection\n- Best for: Systematic improvement with data-driven feedback" },
      { heading: "How Often Should You Practice?", content: "A practical cadence most candidates can sustain:\n\n• 1 week before interview: 1 session per day (intense prep)\n• 2-4 weeks before: 3-4 sessions per week (building habits)\n• General readiness: 1-2 sessions per week (maintenance)\n\nMost people find that sessions longer than 45 minutes get less productive — better to do 3 short sessions than 1 marathon. Frequency matters more than length. Track your own scores; you'll usually see structure and pacing improve within the first handful of sessions if you're applying feedback between them." },
      { heading: "What to Do After Each Practice Session", content: "The 5-minute post-session review:\n\n1. Write down the 1 thing you did best (anchor your confidence)\n2. Write down the 1 thing to improve next time (not 5 things — just 1)\n3. Re-record your answer to the worst question (immediate correction)\n4. Schedule your next session (don't break the chain)\n\nThis simple habit turns random practice into deliberate practice — the kind that actually builds expertise." },
    ],
    faqs: [
      { question: "How many mock interviews should I do before a real interview?", answer: "There's no universal number, but a useful rule of thumb is at least 3 — one to set a baseline, one to act on the feedback, and one as a full simulation close to the real date. Spread them over 1-2 weeks if you can, and prioritise applying the feedback between sessions over chasing a session count." },
      { question: "Should I practice mock interviews alone or with someone?", answer: "Both serve different purposes. Practice alone to rehearse specific answers. Practice with others (or AI) to build adaptability to unexpected questions and follow-ups. AI mock interviews combine the best of both — available anytime with objective, consistent feedback." },
      { question: "Is it possible to over-practice for interviews?", answer: "Yes — if your answers start sounding rehearsed and robotic. The goal is to be naturally structured, not scripted. If you're memorizing answers word-for-word, switch to practicing with random follow-up questions to stay adaptable." },
    ],
    practicePageSlugs: [
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
      { label: "Flipkart SDE Interview Practice", slug: "flipkart-sde-interview-questions" },
      { label: "Microsoft India SDE Practice", slug: "microsoft-india-sde-interview-questions" },
    ],
    relatedSlugs: ["behavioral-interview-questions-freshers", "campus-placement-interview-tips", "how-to-introduce-yourself-in-interview"],
    cta: "Start your mock interview practice right now — 2 free AI sessions with scored feedback. See your baseline score in 10 minutes.",
  },
  {
    slug: "star-method-interview-answers",
    title: "STAR Method for Interview Answers — With 10 Examples for Indian Job Seekers",
    metaDescription: "Master the STAR method for behavioral interviews. Includes 10 real examples tailored for Indian job seekers at TCS, Infosys, Google, and other companies.",
    company: "General",
    category: "Behavioral",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=500&fit=crop",
    heroAlt: "Professional giving a structured interview answer",
    datePublished: "2026-05-01",
    intro: "The STAR method is the single most effective framework for answering behavioral interview questions. It stands for Situation, Task, Action, Result. Here's how to use it — with 10 examples tailored for Indian companies and roles.",
    sections: [
      { heading: "What Is the STAR Method?", content: "STAR is a framework for structuring your interview answers:\n\n• Situation — Set the context (When? Where? What project?)\n• Task — What was your specific responsibility?\n• Action — What did YOU do? (Not your team — you specifically)\n• Result — What was the measurable outcome?\n\nWhy it works: Interviewers are trained to evaluate structured answers. STAR gives them exactly what they're looking for — specific evidence of your capabilities, not vague claims.\n\nThe most common mistake: 80% of candidates describe the situation well but rush through the action and skip the result entirely. The result is the most important part." },
      { heading: "The 30-60-10 Rule", content: "Allocate your answer time like this:\n\n• 30% — Situation + Task (set context quickly, don't over-explain)\n• 60% — Action (this is where you show your value — be specific)\n• 10% — Result (one clear metric or outcome)\n\nTotal answer length: 90 seconds to 2 minutes. Practice timing yourself. If you go over 3 minutes, you're losing the interviewer." },
      { heading: "Example 1: Leadership at TCS", content: "Question: 'Tell me about a time you led a team.'\n\nSituation: 'During my first year at TCS, our team of 8 was assigned a banking client's portal migration with a 6-week deadline.'\n\nTask: 'As the module lead, I was responsible for the payments integration — the most complex part of the migration.'\n\nAction: 'I broke the work into 2-week sprints, set up daily 15-minute standups to catch blockers early, and created a shared testing checklist. When we hit an API compatibility issue in week 3, I worked with the client's team directly to document the legacy endpoints and built an adapter layer.'\n\nResult: 'We delivered 3 days early with zero critical bugs in UAT. The client extended the contract for 2 more modules, adding ₹1.2 crore to the account.'" },
      { heading: "Example 2: Problem-Solving at a Startup", content: "Question: 'Describe a difficult problem you solved.'\n\nSituation: 'At my fintech startup, our payment processing was failing for 12% of UPI transactions during peak hours.'\n\nTask: 'I was asked to investigate and fix the issue within a week — it was costing us ₹15 lakh in failed transactions daily.'\n\nAction: 'I analyzed 3 days of logs and found the bottleneck was in our database connection pool — we were running out of connections during peak load. I implemented connection pooling with PgBouncer, added retry logic with exponential backoff, and set up monitoring alerts for connection saturation.'\n\nResult: 'Transaction failure rate dropped from 12% to 0.3% within 48 hours. The monthly GMV increased by ₹4.5 crore as previously failing transactions went through.'" },
      { heading: "5 More Quick STAR Examples", content: "3. Teamwork (Infosys): Led cross-functional team to reduce deployment time by 40% using CI/CD pipeline.\n\n4. Adaptability (Google): Learned React Native in 2 weeks to ship a mobile prototype that won internal hackathon.\n\n5. Conflict Resolution (Flipkart): Mediated disagreement between frontend and backend teams on API design — proposed compromise that both teams adopted.\n\n6. Customer Focus (Razorpay): Identified UX friction in merchant onboarding, proposed 3-step simplification that increased completion rate from 60% to 85%.\n\n7. Initiative (Amazon): Built internal dashboard that automated weekly reporting — saved team 10 hours/week.\n\nNotice the pattern: Every example has a specific metric in the result. Numbers make your answer memorable and credible." },
      { heading: "Common STAR Mistakes", content: "1. Using 'we' instead of 'I' — Interviewers want YOUR contribution, not the team's.\n2. No metrics in the result — '...and it worked well' is not a result. '...reduced load time by 40%' is.\n3. Choosing trivial examples — Pick situations with real stakes and meaningful outcomes.\n4. Not having enough stories — Prepare 8-10 STAR stories that cover: leadership, conflict, failure, initiative, teamwork, problem-solving. You can remix these for different questions.\n5. Over-explaining the situation — Get to the action quickly. The interviewer cares about what you did, not the background." },
    ],
    faqs: [
      { question: "How many STAR stories should I prepare?", answer: "Prepare 8-10 stories that cover different competencies (leadership, conflict, failure, initiative, teamwork, technical problem-solving). You can adapt the same story for different questions by emphasizing different aspects." },
      { question: "What if I don't have work experience for STAR answers?", answer: "Use college projects, internships, hackathons, volunteer work, or academic team projects. The framework works the same — just be honest about the context. Freshers are expected to draw from academic and extracurricular experiences." },
      { question: "How long should a STAR answer be?", answer: "90 seconds to 2 minutes. Under 60 seconds feels too brief (missing details). Over 3 minutes loses the interviewer's attention. Practice timing yourself." },
    ],
    practicePageSlugs: [
      { label: "Amazon Leadership Principles Practice", slug: "amazon-leadership-principles-interview" },
      { label: "Google Behavioral Interview Practice", slug: "google-behavioral-interview-questions" },
      { label: "Infosys Behavioral Practice", slug: "infosys-behavioral-interview-questions" },
    ],
    relatedSlugs: ["behavioral-interview-questions-freshers", "tell-me-about-yourself-best-answer", "hr-interview-questions-answers-india"],
    cta: "Practice your STAR answers with HireStepX's AI — it scores your Situation, Task, Action, and Result individually and tells you exactly where to improve.",
  },
  {
    slug: "cognizant-interview-questions-freshers-2026",
    title: "Cognizant GenC & GenC Pro Interview Questions for Freshers 2026",
    metaDescription: "Complete Cognizant interview guide for freshers 2026. Covers GenC and GenC Pro tracks, CoCubes aptitude test, technical round, and HR questions with preparation tips.",
    company: "Cognizant",
    category: "Freshers",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=500&fit=crop",
    heroAlt: "Students preparing for Cognizant campus placement interview",
    datePublished: "2026-06-01",
    intro: "Cognizant hires 25,000+ freshers annually through GenC (₹4 LPA) and GenC Pro (₹6.5 LPA) tracks. The CoCubes assessment is the main gateway — time management under pressure, not raw knowledge, is what separates successful candidates. Here's the complete preparation guide.",
    sections: [
      { heading: "GenC vs GenC Pro — Which Track Is Right for You?", content: "GenC (₹4 LPA): General IT role. Aptitude-focused hiring. Assessment is the primary filter. Technical interview covers CS fundamentals and project discussion.\n\nGenC Pro (₹6.5 LPA): Requires a separate advanced coding round (2 medium problems in 60 minutes). Technical interview goes deeper into data structures and algorithms.\n\nHow selection works: All candidates take the same initial CoCubes assessment. Based on your score, you're either considered for GenC or GenC Pro (or both). You cannot directly 'apply' for GenC Pro — performance on the aptitude test qualifies you." },
      { heading: "CoCubes Assessment — Section-by-Section Strategy", content: "The CoCubes test has strict time limits per section:\n\n• Aptitude (20 questions, 25 min) — Ratios, percentages, time-work, data interpretation. Skip questions over 90 seconds; return later.\n• Logical Reasoning (20 questions, 25 min) — Series, blood relations, seating arrangements. Pattern recognition is faster than calculation.\n• Verbal English (20 questions, 25 min) — Reading comprehension, sentence correction. Read the questions before the passage.\n• Coding (2 problems, 30 min) — Easy-medium DSA. The full solution matters here; partial code doesn't score.\n\nKey insight: Cognizant uses a sectional cutoff — scoring high overall but failing one section disqualifies you. Balance all sections." },
      { heading: "Most-Asked Technical Interview Questions", content: "1. Explain the 4 pillars of OOP with real-world examples\n2. What is the difference between method overloading and overriding?\n3. Explain SQL JOINs — INNER, LEFT, RIGHT, FULL OUTER\n4. What is normalization? Explain 1NF, 2NF, 3NF with examples\n5. What is a primary key vs foreign key?\n6. Explain the concept of recursion\n7. What is the difference between stack and queue?\n8. What is a REST API? How does it differ from SOAP?\n9. Explain TCP/IP — what happens when you type google.com?\n10. Write a program to find the second largest element in an array\n\nCognizant interviewers focus on conceptual clarity. If you can't explain it simply, you don't understand it deeply enough." },
      { heading: "HR Round Questions at Cognizant", content: "1. Tell me about yourself\n2. Why Cognizant over TCS or Infosys?\n3. Are you open to any technology domain?\n4. Are you comfortable relocating to Bangalore, Chennai, Hyderabad, or Pune?\n5. Do you have any concerns about the 2-year service agreement?\n6. What is your expected CTC?\n7. Tell me about a challenge in your final year project\n8. Where do you see yourself in 3 years?\n\nKey: Research Cognizant's recent initiatives (Neuro-IT, AI/ML practice, cloud migrations) and mention one specifically when asked 'Why Cognizant?' — this demonstrates genuine interest beyond the salary." },
      { heading: "Salary & Benefits (2026)", content: "GenC: ₹4 LPA (base salary ₹3.2L + variable ₹0.8L)\nGenC Pro: ₹6.5 LPA (base salary ₹5.2L + variable ₹1.3L)\n\nCognizant provides health insurance for self + family, 24 days PTO, and professional certification reimbursements. The salary is below product companies but Cognizant offers structured onboarding training (LEAP program) valued highly for career transition later." },
    ],
    faqs: [
      { question: "What is Cognizant GenC salary in 2026?", answer: "Cognizant GenC salary in 2026 is ₹4 LPA (₹3.2L base + ₹0.8L variable). GenC Pro track offers ₹6.5 LPA for candidates who clear the advanced coding round." },
      { question: "What is the Cognizant CoCubes test pattern?", answer: "CoCubes assessment has 4 sections: Aptitude (20Q, 25 min), Logical Reasoning (20Q, 25 min), Verbal English (20Q, 25 min), and Coding (2 problems, 30 min). Each section has a cutoff — balance all four." },
      { question: "Does Cognizant have a service bond for freshers?", answer: "Yes, Cognizant has a 2-year service agreement. Leaving before completion requires paying a penalty. Review the agreement carefully before accepting." },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "wipro-interview-questions-answers", "behavioral-interview-questions-freshers"],
    practicePageSlugs: [
      { label: "Cognizant Campus Placement", slug: "cognizant-campus-placement-interview" },
    ],
    cta: "Practice Cognizant interview questions with HireStepX — simulate the technical and HR rounds with AI-graded feedback.",
  },
  {
    slug: "accenture-interview-questions-freshers-2026",
    title: "Accenture ASE Interview Questions for Freshers 2026 — Complete Guide",
    metaDescription: "Complete Accenture ASE interview preparation for freshers 2026. Covers iCAT test, technical interview, communication round, and HR questions with sample answers.",
    company: "Accenture",
    category: "Freshers",
    readTime: "9 min",
    heroImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=500&fit=crop",
    heroAlt: "Fresh graduates preparing for Accenture campus placement",
    datePublished: "2026-06-05",
    intro: "Accenture is one of India's largest employers of engineering freshers, with the ASE (Associate Software Engineer) program offering competitive packages (₹4.5–8 LPA depending on track). Their process is unique — it heavily evaluates communication skills and 'client readiness.' Here's everything you need to know.",
    sections: [
      { heading: "Accenture Hiring Tracks", content: "Associate Software Engineer (ASE): ₹4.5 LPA — Standard track\nAdvanced ASE (AASE): ₹6–8 LPA — For candidates with stronger technical skills + better iCAT scores\n\nSelecting the track: Accenture reviews your iCAT score, academic percentage, and communication round performance to determine which track you're offered. You apply once, they decide your track." },
      { heading: "iCAT Online Test — What to Expect", content: "Accenture's iCAT (Integrated Cognitive Assessment Test) has three components:\n\n1. Cognitive Assessment (25 questions, 35 min)\n   • Logical, quantitative, verbal reasoning\n   • Focus on speed — 80 seconds per question max\n\n2. Technical Assessment (40 questions, 40 min)\n   • Computer science fundamentals: OOP, DBMS, OS, data structures, algorithms\n   • Coding MCQs (not hands-on coding)\n\n3. Coding Module (2 problems, 45 min)\n   • One easy (arrays/strings), one medium (linked list or recursion)\n   • Supported languages: Java, Python, C, C++\n\nMinimum passing: Solve at least 1 coding problem completely + achieve sectional cutoffs in cognitive and technical." },
      { heading: "Communication Round — Often the Deciding Factor", content: "Accenture's communication round (also called the 'English Communication Assessment') is unique to them among IT companies.\n\nFormat: Text-to-speech evaluation — you read passages and answer questions verbally. The system scores your pronunciation, fluency, and vocabulary.\n\nWhy it matters so much: Accenture is a consulting company. Their engineers interact with clients daily — verbal clarity is non-negotiable. Candidates who score poorly here are rejected even with good technical scores.\n\nPreparation: Read English aloud daily for 2 weeks. The goal is natural fluency, not an accent. Record yourself — identify words where you stumble or rush." },
      { heading: "Technical Interview Questions", content: "1. What are access modifiers in Java? (public, private, protected, default)\n2. Explain polymorphism — what's the difference between compile-time and runtime?\n3. What is a constructor? Can it be overloaded?\n4. Explain ACID properties in databases\n5. What is indexing and when do you use it?\n6. What is the difference between GET and POST requests?\n7. Explain how a web browser renders a page\n8. What is multithreading? What problems can it cause?\n9. Difference between ArrayList and LinkedList in Java\n10. Walk me through your final year project\n\nNote: Accenture interviewers value communication as much as answers. Speaking clearly and structuring your explanation matters." },
      { heading: "HR Interview Questions", content: "1. Tell me about yourself\n2. Why Accenture specifically?\n3. Which technology domain interests you most and why?\n4. Are you comfortable relocating to any of our offices?\n5. How do you handle tight deadlines?\n6. Describe a situation where you worked in a team despite disagreements\n7. What are your salary expectations?\n8. Are you okay with night/US-shift hours?\n9. Where do you see yourself in 5 years?\n10. Do you have any questions for us?\n\nBest 'Why Accenture' answer: Reference their specific consulting + tech fusion — 'I want to build technology that solves real client problems, and Accenture's model of combining consulting and delivery uniquely enables that.'" },
    ],
    faqs: [
      { question: "What is Accenture ASE salary for freshers in 2026?", answer: "Accenture ASE salary is ₹4.5 LPA for the standard track and ₹6–8 LPA for Advanced ASE (AASE). Final track depends on iCAT score, communication round, and academic performance." },
      { question: "Is the Accenture communication round eliminatory?", answer: "Yes. The communication assessment is a hard filter at Accenture. Even strong technical candidates can be rejected if they score poorly. Practice reading English aloud daily for 2 weeks before your interview." },
      { question: "Does Accenture have a service bond?", answer: "Yes, Accenture has a 1-year service bond for freshers. Leaving before completion requires payment of a penalty amount as specified in your offer letter." },
    ],
    relatedSlugs: ["cognizant-interview-questions-freshers-2026", "tcs-interview-questions-freshers-2026", "wipro-interview-questions-answers"],
    practicePageSlugs: [
      { label: "Accenture Campus Placement", slug: "accenture-campus-placement-interview" },
    ],
    cta: "Practice Accenture interview questions on HireStepX — simulate technical, communication, and HR rounds with AI-powered scoring.",
  },
  {
    slug: "product-manager-interview-questions-india",
    title: "Product Manager Interview Questions India — Complete 2026 Guide",
    metaDescription: "Top product manager interview questions asked in India at Flipkart, Swiggy, Meesho, Zomato, and FAANG. Includes case study frameworks, behavioral questions, and salary data.",
    company: "General",
    category: "Product",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=500&fit=crop",
    heroAlt: "Product manager planning and strategising on a whiteboard",
    datePublished: "2026-06-10",
    intro: "Product Manager roles in India have exploded across both FAANG and Indian unicorns. The interview format differs sharply by company — McKinsey-style case studies at Flipkart, Leadership Principles at Amazon, philosophical product questions at CRED. Here's the complete guide with examples.",
    sections: [
      { heading: "Types of PM Interview Questions", content: "PM interviews span 5 question types:\n\n1. Product Design — 'Design a feature for [product]' or 'How would you improve [app]?'\n2. Analytical / Metrics — 'How would you diagnose a 20% drop in DAU?'\n3. Estimation / Market Sizing — 'How many Swiggy orders happen in Bangalore daily?'\n4. Strategic / Go-to-market — 'Should Meesho launch a B2B vertical?'\n5. Behavioral / Leadership — 'Tell me about a product you launched that failed.'\n\nTop companies by question type:\n• Flipkart, Swiggy: Heavy case study + metrics\n• Amazon: Almost entirely behavioral (Leadership Principles)\n• CRED: Product philosophy + taste questions\n• Google: Design + metrics + product sense\n• Zomato: Diagnostics + marketplace questions" },
      { heading: "The Product Design Framework", content: "For any 'design a feature' or 'improve a product' question:\n\n1. Clarify the goal — 'What metric are we optimizing for? Retention? Revenue? Acquisition?'\n2. Define the user — 'Who specifically are we designing for? Which segment?'\n3. State the pain point — 'What friction or gap exists today?'\n4. Propose 2–3 solutions — Range from easy to ambitious. Evaluate tradeoffs.\n5. Pick one — 'I'd prioritize [solution] because [reasoning based on impact, feasibility, risk].'\n6. Success metrics — 'I'd measure success by [specific metric] with a [timeframe] target.'\n\nDo NOT jump to solutions. Spending 3 minutes on user definition before your first solution is how great PMs answer — not a waste of time." },
      { heading: "Metrics Diagnosis — The Framework", content: "When asked 'a metric dropped — diagnose it':\n\nStep 1: Define the metric precisely — 'When you say DAU dropped, are we looking at new user DAU or returning user DAU?'\nStep 2: Check the data pipeline — 'Has the logging changed? Could this be a measurement issue?'\nStep 3: Segment by time — 'When exactly did it start? Was it gradual or a step-change?'\nStep 4: Segment by axis — By geography, device type, user cohort, feature area.\nStep 5: Form hypotheses — List 3 possible causes ranked by likelihood.\nStep 6: Propose investigation — 'I'd verify hypothesis 1 by...'\n\nGolden rule: Don't jump to 'we need a new feature' before ruling out external factors (app store rating drop, competitor launch, viral social media issue)." },
      { heading: "India-Specific Context PMs Must Know", content: "Top Indian PM interviewers test whether you understand Bharat-specific constraints:\n\n• Low-bandwidth design — Feature-phone users, 2G/3G connections in tier-2/3 cities\n• Regional language support — Swiggy, Meesho, and Jio serve users who prefer Hindi, Tamil, or Marathi\n• COD (Cash on Delivery) — Still 50%+ of e-commerce volume in India. Features must account for COD-specific flows\n• UPI-first payments — Design for UPI as primary, cards as secondary (opposite to global products)\n• Trust and verification — New online users need more trust signals (delivery estimates, return policies) than mature markets\n\nCandidates who design 'for everyone' (implicit Western user) score lower than those who design 'for Meesho's actual user' (first-time-online rural seller on Android with 2G)." },
      { heading: "Salary Expectations for PMs in India (2026)", content: "APM / Associate PM (0–2 yr): ₹18–35 LPA\nPM (3–5 yr): ₹35–70 LPA\nSenior PM (5–8 yr): ₹70–120 LPA\nDirector of Product (8+ yr): ₹120–200 LPA\n\nTop payers: Google, Meta, Amazon, Flipkart, CRED, Razorpay, Meesho\nNote: Total comp includes ESOPs at product companies — can 2–3x the base at Flipkart, Meesho, CRED." },
    ],
    faqs: [
      { question: "What is the difference between a PM and APM role in India?", answer: "APM (Associate Product Manager) is an entry-level PM role, typically for 0–2 years experience or fresh MBAs. PM is a mid-level role requiring 3–5 years. The responsibility for APMs is more execution-focused; PMs own the product strategy for their area." },
      { question: "Do Indian PM interviews have case studies?", answer: "Yes, most Indian product companies (Flipkart, Swiggy, Zomato, Meesho) include case studies. Amazon India is an exception — their PM interviews are almost entirely behavioral, mapped to Leadership Principles." },
      { question: "What is a good PM interview score at Flipkart?", answer: "Flipkart PM interviews are scored on product sense, analytical thinking, and communication. A 'strong hire' decision requires scoring above the bar on at least 3 of 4 dimensions. Product sense is the hardest to fake — it's built from using and thinking critically about products regularly." },
    ],
    practicePageSlugs: [
      { label: "Flipkart PM Interview Practice", slug: "flipkart-pm-interview-questions" },
      { label: "Google PM Interview Practice", slug: "google-pm-interview-questions" },
      { label: "Amazon PM Interview Practice", slug: "amazon-pm-interview-questions" },
    ],
    relatedSlugs: ["ace-case-study-interviews", "amazon-leadership-principles-interview", "salary-negotiation-tips-india"],
    cta: "Practice PM case study interviews on HireStepX — the AI plays the interviewer, gives you data, and scores your structure and recommendation.",
  },
  {
    slug: "hcl-accenture-capgemini-interview-comparison",
    title: "HCL vs Accenture vs Capgemini Interview — Which Is the Best for Freshers?",
    metaDescription: "Compare HCL, Accenture, and Capgemini interview processes for freshers. Covers salary, difficulty, training quality, and which company is best for your career goals.",
    company: "HCL",
    category: "Comparison",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1488229297570-58520851e868?w=1200&h=500&fit=crop",
    heroAlt: "Tech company logos representing IT service company comparison",
    datePublished: "2026-06-15",
    intro: "HCL, Accenture, and Capgemini are among the top recruiters at Indian engineering colleges — but their interview difficulty, salaries, and career trajectories are meaningfully different. Here's an honest comparison.",
    sections: [
      { heading: "Interview Difficulty Comparison", content: "HCL (Easiest of the three)\n• Aptitude test: Moderate difficulty\n• Coding: 1–2 easy problems\n• Interview: Conceptual CS + communication, rarely asks hard DSA\n• Filter rate: ~70% move past online assessment\n\nCapgemini (Moderate)\n• IntelliAdapt test: Adaptive difficulty, feels harder than it is\n• Coding: 2 easy-medium problems\n• Interview: Slightly deeper on OOP and databases\n• Filter rate: ~60% move past online assessment\n\nAccenture (Moderate + Communication filter)\n• iCAT test: Similar to Capgemini in technical depth\n• Communication round: Hard elimination filter unique to Accenture\n• Interview: CS fundamentals + client-readiness\n• Filter rate: ~50% move past all rounds (communication round eliminates 20%+)" },
      { heading: "Salary Comparison (2026)", content: "HCL: ₹3.8–6 LPA (GET to Technology Evangelist track)\nCapgemini: ₹4.35–7 LPA (Analyst to Senior Analyst)\nAccenture: ₹4.5–8 LPA (ASE to Advanced ASE)\n\nAccenture offers the highest starting salary — but the communication round is an extra barrier. HCL offers the most accessible path. Capgemini sits in the middle on both." },
      { heading: "Training Quality Comparison", content: "HCL: SPEED program — 3–6 months of hands-on training in Java, Python, cloud. Generally positive reviews.\nCapgemini: Tech Academy — domain-specific streams (Java, SAP, cloud). Good structure but less flexibility.\nAccenture: LEAP program — Strong, widely respected. Covers both technical and client skills. Best for lateral career transitions later.\n\nIf training quality matters most: Accenture's LEAP program is considered the best among the three for building a foundation that helps you transition out later." },
      { heading: "Career Trajectory (3–5 Year View)", content: "The honest picture:\n\nAll three are IT service companies — you'll work on client projects with defined scope, limited architectural ownership, and structured appraisal cycles.\n\nBest-case scenario: You spend 2–3 years, get a solid foundation, and switch to a product company (Flipkart, Swiggy, CRED) for 2–3x salary growth.\n\nRisk: Getting stuck in legacy projects without building relevant skills.\n\nAdvice: In the first year, actively seek out projects in cloud/data/AI domains. Employees who build skills proactively transition successfully; those who don't may find themselves underskilled for product company interviews after 5 years." },
      { heading: "Which Should You Choose?", content: "Choose HCL if: You want the easiest path to a first job and are confident you'll prepare for product company transitions yourself.\n\nChoose Capgemini if: You want a European MNC brand on your resume and like the idea of SAP/specialized domain expertise.\n\nChoose Accenture if: You're comfortable with the communication round, want the best training (LEAP), and want the Accenture brand for later consulting moves.\n\nHonest truth: For most freshers, the most important factor is getting in somewhere good, building skills, and using HireStepX to prepare for the product company interview you want 2 years from now — not which company's cafeteria has better food." },
    ],
    faqs: [
      { question: "Which is better for freshers — Accenture or Capgemini?", answer: "Accenture offers slightly higher salary (₹4.5–8 LPA vs ₹4.35–7 LPA) and better training (LEAP program), but has an extra communication round that eliminates 20%+ of candidates. Capgemini has the IntelliAdapt test but no communication filter — more accessible for candidates who are technically strong but less fluent." },
      { question: "Is HCL better than TCS for freshers?", answer: "HCL typically pays slightly more than TCS Ninja (₹3.8L vs ₹3.36L) and the interview is comparable in difficulty. TCS has a larger brand and more structured hierarchy. Both are similar in terms of career trajectory — the key is what you do with the first 2–3 years." },
      { question: "Can I get into Accenture without strong communication skills?", answer: "The communication round is eliminatory at Accenture. If English communication is not your strong suit, focus on HCL or Capgemini instead, build your skills there, and re-attempt product companies or Accenture for lateral hiring after 1–2 years." },
    ],
    relatedSlugs: ["accenture-interview-questions-freshers-2026", "cognizant-interview-questions-freshers-2026", "tcs-interview-questions-freshers-2026"],
    practicePageSlugs: [
      { label: "HCL Campus Placement", slug: "hcl-campus-placement-interview" },
      { label: "Accenture Campus Placement", slug: "accenture-campus-placement-interview" },
      { label: "Capgemini Campus Placement", slug: "capgemini-campus-placement-interview" },
    ],
    cta: "Practice mock interviews for HCL, Accenture, and Capgemini on HireStepX — AI-graded feedback tailored to each company's interview style.",
  },
  {
    slug: "deloitte-interview-questions-freshers-2026",
    title: "Deloitte Interview Questions for Freshers — 2026 Off-Campus & Campus",
    metaDescription: "Complete Deloitte interview preparation guide for freshers in 2026. Covers the CogniVue aptitude test, case study rounds, behavioral interview, and salary expectations for Analyst roles.",
    company: "Deloitte",
    category: "Freshers",
    readTime: "9 min",
    heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=500&fit=crop",
    heroAlt: "Modern consulting office representing Deloitte interview preparation",
    datePublished: "2026-06-15",
    intro: "Deloitte hires thousands of freshers in India every year across Consulting, Technology, and Advisory tracks. The interview is more demanding than typical IT service companies — they look for structured thinking and communication, not just technical skills. Here's exactly what to prepare.",
    sections: [
      { heading: "Deloitte Interview Rounds (2026)", content: "The Deloitte fresher process typically has 4 stages:\n\n1. CogniVue Aptitude Test — Online, 60–90 minutes. Tests numerical reasoning, verbal ability, logical reasoning, and situational judgement. Minimum score threshold varies by track.\n2. Group Discussion (GD) — 8–12 candidates, 15–20 minutes. Evaluated on communication, leadership, and content quality.\n3. Case Interview (Consulting/Advisory track) — 30–45 minutes. A business problem where you structure and present your solution.\n4. HR Round — Fit, motivation, communication, salary discussion.\n\nTechnology track candidates may skip the case round and instead face a technical interview on programming concepts and CS fundamentals." },
      { heading: "CogniVue Test — How to Prepare", content: "The CogniVue assessment is the primary filter. Key areas:\n\n• Numerical Reasoning: Data interpretation, percentages, profit/loss. Aim for 70–80% accuracy.\n• Verbal Ability: Reading comprehension, grammar, sentence correction. Reading business newspapers (Mint, ET) helps.\n• Logical Reasoning: Patterns, series completion, blood relations. Practice 30 min daily for 2 weeks.\n• Situational Judgement: Workplace scenarios testing values alignment. No 'tricks' — read Deloitte's values and answer genuinely.\n\nCutoff: Deloitte does not publish cutoffs, but industry reports suggest top 40% of test takers advance." },
      { heading: "Group Discussion Topics — 2026 Edition", content: "Recent GD topics at Deloitte campus drives:\n\n• 'AI will create more jobs than it destroys — agree or disagree?'\n• 'Should India prioritize green energy even at the cost of GDP growth?'\n• 'Remote work is permanent — how should companies adapt?'\n• 'Digital payments vs cash — which is more inclusive for India?'\n• 'The role of consulting firms in shaping government policy'\n\nGD scoring criteria: content relevance (40%), communication clarity (30%), group dynamics (20%), leadership initiative (10%). Speak 3–4 times minimum; quality of points beats quantity of talk time." },
      { heading: "Case Interview Basics for Freshers", content: "Deloitte's case interviews for freshers are simpler than MBB (McKinsey, BCG, Bain), but still require structured thinking.\n\nCommon case formats:\n• Market sizing ('How many ATMs are there in India?')\n• Business problem ('A hotel chain's revenue dropped 20% — what happened?')\n• Operations ('A factory's output fell by 15% — diagnose the issue')\n\nFramework for every case:\n1. Clarify the problem (ask 2–3 questions)\n2. Structure your analysis (hypothesis-first)\n3. Ask for data as needed\n4. Synthesize and give a recommendation\n\nKeywords that impress Deloitte interviewers: 'structured', 'data-driven', 'client-centric', 'risk-aware'." },
      { heading: "Salary and Tracks (2026)", content: "Deloitte India fresher compensation:\n\nBusiness Technology Analyst (BTA): ₹7–9 LPA\nConsulting Analyst: ₹9–12 LPA\nRisk Advisory Analyst: ₹7–10 LPA\nAudit & Assurance: ₹6–8 LPA\n\nDeloitte also offers fast-track promotions (Analyst → Senior Analyst in 2 years for top performers) and sponsored MBA pathways for consulting tracks." },
    ],
    faqs: [
      { question: "Is Deloitte hard to get into as a fresher?", answer: "Moderately hard. The CogniVue test filters significantly, and the communication bar is higher than typical IT service companies. Candidates who prepare specifically for the case interview and GD have a strong advantage." },
      { question: "What is Deloitte BTA salary in 2026?", answer: "Deloitte Business Technology Analyst (BTA) starting salary is ₹7–9 LPA. Consulting Analyst roles start at ₹9–12 LPA." },
      { question: "Does Deloitte hire freshers without experience?", answer: "Yes — Deloitte actively recruits from campus across Tier 1 and Tier 2 engineering and business colleges. Off-campus applications are also accepted via the Deloitte careers portal." },
    ],
    relatedSlugs: ["ace-case-study-interviews", "hcl-accenture-capgemini-interview-comparison", "behavioral-interview-questions-freshers"],
    practicePageSlugs: [
      { label: "Deloitte Case Study Interview", slug: "deloitte-case-study-interview" },
      { label: "McKinsey Case Study Interview", slug: "mckinsey-case-study-interview-questions" },
    ],
    cta: "Practice Deloitte-style case and behavioral interviews on HireStepX — AI scoring on structure, communication, and recommendation quality.",
  },
  {
    slug: "group-discussion-topics-campus-placement-2026",
    title: "Group Discussion Topics for Campus Placements 2026 — 40 Real GD Topics",
    metaDescription: "40 current group discussion topics for campus placements 2026. Covers technology, business, economy, and social issues with talking points for each topic.",
    company: "Campus",
    category: "Campus Placement",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1200&h=500&fit=crop",
    heroAlt: "Group of students in a discussion circle representing GD round preparation",
    datePublished: "2026-07-01",
    intro: "The Group Discussion round catches many candidates off guard — not because the topics are hard, but because most people prepare knowledge but not communication. GDs are judged on clarity, structure, and how well you read the room. Here are 40 real GD topics from 2025–2026 campus drives with the key talking points.",
    sections: [
      { heading: "Technology & AI Topics (Most Common in 2026)", content: "1. 'AI will eliminate more jobs than it creates in India' — Key angles: automation in BPO/IT services, AI-created roles (prompt engineers, AI auditors), reskilling lag, India's demographic dividend\n\n2. 'Should India develop its own large language model?' — Key angles: data sovereignty, cost of compute, dependency on US AI, geopolitical dimension\n\n3. 'Social media does more harm than good for Indian youth' — Key angles: mental health data, misinformation, creator economy opportunities, regulatory gap\n\n4. 'Deepfakes are a national security threat' — Key angles: election interference, financial fraud, legislation in India vs global frameworks\n\n5. 'Remote work kills company culture' — Key angles: collaboration data, employee preferences post-pandemic, office real estate economics, productivity metrics\n\n6. 'India should prioritize AI chips manufacturing' — Key angles: semiconductor policy, CHIPS Act comparison, talent availability, 5-year investment thesis\n\n7. 'Generative AI in education will widen India's learning gap' — Key angles: tier-1 vs tier-3 city access, exam integrity, teacher role evolution, EdTech penetration data" },
      { heading: "Economy & Business Topics", content: "8. 'Startups are the future of Indian employment' — Key angles: startup funding data, startup to scaleup ratio, ESOP value, vs government/IT service stability\n\n9. 'India should increase income tax on ultra-high earners' — Key angles: capital flight risk, funding innovation, Nordic model, inequality data (Gini coefficient)\n\n10. 'The gig economy exploits workers' — Key angles: Swiggy/Zomato/Ola driver data, social security gap, flexibility preference, global regulation trends\n\n11. 'Electric vehicles will save India's automobile industry' — Key angles: import dependency on oil, domestic EV ecosystem, charging infrastructure gap, battery recycling\n\n12. 'India should allow 100% FDI in retail' — Key angles: Kirana store impact, consumer pricing benefits, supply chain modernization, Amazon/Walmart precedent\n\n13. 'Cryptocurrency should be legalized in India' — Key angles: capital controls, blockchain applications, tax evasion risk, RBI position, global precedents" },
      { heading: "Society & Policy Topics", content: "14. 'Reservation system should be based on economic status, not caste' — Key angles: historical context, creamy layer issue, effectiveness data, social vs economic disadvantage\n\n15. 'Should India have a Uniform Civil Code?' — Key angles: personal law diversity, constitutional debate, minority rights, judicial precedents (handle with balance — this is a politically sensitive GD topic)\n\n16. 'Mental health should be treated as a public health priority in India' — Key angles: NIMHANS data, workplace mental health, stigma, insurance coverage gap\n\n17. 'Should college education be free in India?' — Key angles: fiscal cost, quality maintenance, private institution impact, IIT/IIM precedent\n\n18. 'India's population growth is an asset, not a problem' — Key angles: demographic dividend, dependency ratio, skill gap, BRICS comparison" },
      { heading: "GD Scoring Framework — What Assessors Actually Watch", content: "Based on recruiter feedback from 20+ companies, GD scores break down as:\n\n35% — Quality of content: Are your points relevant, accurate, and substantive?\n30% — Communication clarity: Can you articulate your point in 30 seconds without rambling?\n20% — Group dynamics: Do you build on others' points? Do you respectfully challenge?\n15% — Leadership moments: Did you summarize the group, redirect off-track discussion, or open with a framing statement?\n\nThe biggest mistake: Preparing only one side of an argument. Assessors look for candidates who acknowledge complexity — not those who give a policy speech." },
      { heading: "How to Open, Support, and Close a GD", content: "Opening (first 30 seconds of GD): Define the topic scope ('I'd like to frame this as a question of...'), state your initial position, and invite others in ('I'm curious to hear different perspectives on...').\n\nContributing mid-GD: Build explicitly ('Building on what [name] said...'), introduce a data point, or offer a counter-example. Never interrupt — wait for a natural pause.\n\nClosing the GD: If asked to summarize, structure it as: points of agreement → core disagreement → unresolved question. Don't give your conclusion as the group's conclusion." },
    ],
    faqs: [
      { question: "What are the most common GD topics in 2026 campus placements?", answer: "AI and jobs, digital India, environmental policy, startup ecosystem, remote work, and social media regulation are the most frequent themes in 2026 campus drives. Technology GDs are at an all-time high given the AI wave." },
      { question: "How do I perform well in a group discussion?", answer: "Speak 3–4 times minimum, each time with a clear point backed by a fact or example. Build on others' ideas, use the person's name when you reference their point, and avoid dominating airtime." },
      { question: "Does GD performance affect final placement chances?", answer: "Yes — GDs are eliminatory at most companies including Deloitte, Accenture, Wipro, Cognizant, and most PSUs. Typically 30–50% of candidates are eliminated at the GD stage." },
    ],
    practicePageSlugs: [
      { label: "TCS Campus Interview Practice", slug: "tcs-ninja-interview-questions" },
      { label: "Infosys Campus Interview Practice", slug: "infosys-campus-interview-questions" },
      { label: "IBM Campus Placement Practice", slug: "ibm-campus-placement-interview-questions" },
    ],
    relatedSlugs: ["behavioral-interview-questions-freshers", "deloitte-interview-questions-freshers-2026", "hcl-accenture-capgemini-interview-comparison"],
    cta: "Practice group discussion speaking skills with HireStepX's AI — get scored feedback on communication clarity, argument quality, and structure.",
  },
  {
    slug: "how-to-pass-tcs-nqt-2026",
    title: "How to Pass TCS NQT 2026 — Complete Guide to National Qualifier Test",
    metaDescription: "Complete guide to the TCS NQT 2026 exam. Covers all 4 sections (Cognitive Skills, Programming Logic, Advanced Coding, English), cutoffs, and preparation strategy.",
    company: "TCS",
    category: "Campus Placement",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=500&fit=crop",
    heroAlt: "Student at a computer taking an online assessment for TCS NQT exam preparation",
    datePublished: "2026-07-01",
    intro: "The TCS NQT (National Qualifier Test) is India's largest campus recruitment test — over 5 lakh candidates appear each year. It determines your track (Ninja/Digital/Prime), your starting salary (₹3.36L vs ₹7L vs ₹9L), and bypasses on-campus interviews at 500+ colleges. Here's how to pass it in 2026.",
    sections: [
      { heading: "TCS NQT 2026 Structure", content: "The NQT has two parts:\n\nPart 1 — Cognitive Skills (60 minutes, ~36 questions)\n• Numerical Ability: Arithmetic, percentages, averages, ratios — typically 12–15 questions\n• Verbal Ability: Reading comprehension, grammar, para-jumbles — typically 15 questions\n• Reasoning Ability: Logical reasoning, series completion, coding-decoding — typically 8–10 questions\n\nPart 2 — Coding (60 minutes, 2 questions)\n• For Ninja: 1–2 easy-medium coding problems (arrays, strings, basic logic)\n• For Digital/Prime: 1 medium problem + 1 medium-hard problem (trees, DP, graphs)\n\nThe first part determines if you qualify; the coding section determines your track placement." },
      { heading: "NQT Cutoffs — What Score Do You Need?", content: "TCS does not publish exact cutoffs, but patterns from previous years:\n\nNinja Track: ~70–75% in Cognitive + at least partial completion of coding\nDigital Track: ~80–85% in Cognitive + full completion of at least one coding problem\nPrime Track: Top 5% of all scorers — near-perfect cognitive + optimal solution on both coding\n\nSalaries by track:\nNinja: ₹3.36 LPA base\nDigital: ₹7 LPA base\nPrime: ₹9 LPA base + premium project allocation\n\nThe gap between Ninja and Digital is significant — preparing for the Digital track is worth the extra 4–6 weeks of effort." },
      { heading: "Numerical Ability — High-Yield Topics", content: "TCS NQT numerical section has a strong pattern. The most frequently tested topics in 2025–2026:\n\n1. Time & Work (2–3 questions almost every attempt)\n2. Percentage calculations (budget, discount, profit/loss)\n3. Averages and weighted averages\n4. Speed, Distance & Time\n5. Data interpretation (table/bar chart reading — 3–4 questions)\n\nTip: Approximation is your friend — TCS doesn't penalise for estimation-based answers. Getting a 90% accurate answer in 60 seconds beats spending 3 minutes on a perfect answer." },
      { heading: "Coding Section Preparation", content: "The coding section runs in TCS's browser-based compiler. You can code in C, C++, Java, or Python.\n\nFor Ninja Track: Master these patterns (easy difficulty):\n• Array manipulation (reversal, rotation, frequency count)\n• String operations (palindrome, anagram, character frequency)\n• Basic recursion and iteration\n• Simple pattern printing\n\nFor Digital/Prime Track: Add these:\n• Dynamic programming (knapsack, LCS, coin change)\n• Binary search and its variations\n• BFS/DFS on graphs\n• Two-pointer and sliding window\n\nPractice tip: TCS coding questions often have a brute force that passes 70–80% of test cases. If you can't find the optimal solution, submit the brute force first — partial credit exists." },
      { heading: "Full Preparation Schedule — 4 Weeks to NQT", content: "Week 1 — Baseline and fundamentals:\n• Take 1 mock NQT to identify weak areas\n• Arithmetic fundamentals: percentages, ratios, time-work (1.5 hrs/day)\n• Verbal: read 1 business article + 10 grammar exercises (30 min/day)\n\nWeek 2 — Reasoning and coding basics:\n• Logical reasoning patterns (1 hr/day)\n• Coding: 2 easy problems/day on HackerRank or LeetCode\n• Full mock test on Day 14\n\nWeek 3 — Speed and accuracy:\n• Timed drills: 30 numerical questions in 25 minutes\n• Coding: 1 medium problem + 1 easy per day\n• Focus on most-missed question types from mock results\n\nWeek 4 — Simulation and review:\n• 3 full NQT simulations (3 hours each)\n• Review every wrong answer (don't just check the score)\n• Interview prep: 5 basic HR questions practiced out loud daily" },
    ],
    faqs: [
      { question: "How many times can you attempt TCS NQT?", answer: "TCS allows you to attempt the NQT once every 6 months. Your highest score in the last 2 years is considered for placement. Some colleges facilitate an NQT attempt on campus — check with your placement cell." },
      { question: "Is TCS Digital better than TCS Ninja?", answer: "Yes, significantly. TCS Digital pays ₹7 LPA vs ₹3.36 LPA for Ninja — that's almost double. Digital track also gets project allocation in newer technologies (AI/ML, cloud, digital transformation). The extra 4–6 weeks of coding preparation for Digital track is strongly worth it." },
      { question: "What happens after clearing TCS NQT?", answer: "After clearing NQT, you get an interview call (Technical + HR for most roles). TCS Ninja interviews focus on CS fundamentals and HR fit. TCS Digital interviews include a technical coding round. Clearing NQT doesn't guarantee an offer — the interview still eliminates candidates." },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "behavioral-interview-questions-freshers", "campus-placement-interview-tips"],
    practicePageSlugs: [
      { label: "TCS Ninja Interview", slug: "tcs-ninja-interview-questions" },
      { label: "TCS Digital Interview", slug: "tcs-digital-interview-questions" },
    ],
    cta: "Prepare for the TCS interview after NQT on HireStepX — HR and technical rounds with AI scoring tailored to TCS's evaluation criteria.",
  },
  {
    slug: "zoho-interview-questions-freshers-2026",
    title: "Zoho Interview Questions for Freshers 2026 — The Unusual Hiring Process",
    metaDescription: "Zoho interview preparation guide for freshers. Covers the unique 5-round process, programming test, aptitude, and why Zoho doesn't hire from placement agencies. Salary ₹5–8 LPA.",
    company: "Zoho",
    category: "Freshers",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=500&fit=crop",
    heroAlt: "Software engineers at a desk representing Zoho interview preparation",
    datePublished: "2026-07-01",
    intro: "Zoho is one of India's most unusual tech employers — they don't hire from placement agencies, don't visit most colleges, and have a 5-round interview process that tests you over 2–3 days. But they also offer great compensation (₹5–8 LPA for freshers), no bond periods, and an unusually strong engineering culture. Here's exactly how to prepare.",
    sections: [
      { heading: "Zoho's Hiring Process — What Makes It Different", content: "Zoho does not use campus placement drives at most colleges. They hire directly:\n\n1. Walk-ins at Zoho offices (Chennai, Pune, Delhi, Hyderabad)\n2. Referrals from current Zoho employees\n3. Off-campus drives advertised on their careers portal\n4. ZOHO Schools of Learning alumni (direct hire path)\n\nThis means: if you're waiting for Zoho to come to your campus, you may be waiting forever. Apply directly.\n\nThe process has 5 rounds, sometimes spread over multiple days:\nRound 1: Aptitude test (written, pen-paper)\nRound 2: Technical test — Programming\nRound 3: Advanced Programming\nRound 4: Technical Interview — CS fundamentals + code walkthrough\nRound 5: HR Interview" },
      { heading: "Round 1 — Aptitude Test", content: "Zoho's aptitude test is famous for being harder than TCS/Infosys. Key topics:\n\n• Arithmetic: Number systems, HCF/LCM, percentages, time-speed-distance\n• Data interpretation: Tables and charts with calculation-heavy questions\n• Logical reasoning: Syllogisms, blood relations, directional problems\n• Verbal: Reading comprehension, fill-in-the-blanks, error spotting\n\nDuration: ~60 minutes, ~35–40 questions. No calculators.\n\nCutoff: Approx. 65–70% to advance. The test is known for tricky wording — read each question twice before answering." },
      { heading: "Rounds 2 & 3 — Programming Tests", content: "Zoho's programming tests are what separate it from other IT companies. You'll write actual code on paper or in a simple editor (not a competitive programming judge).\n\nRound 2 topics (easier):\n• Array manipulation: sorting, searching, finding duplicates\n• String operations: reversal, palindrome, anagram detection\n• Basic recursion: factorial, Fibonacci, power\n• Pattern printing\n\nRound 3 topics (harder):\n• Data structures: linked lists, stacks, queues, trees\n• Algorithms: binary search, merge sort, basic graph traversal\n• OOP concepts: classes, inheritance, polymorphism (explain and implement)\n• Design a small system (e.g., a library management class structure)\n\nKey insight: Zoho evaluates code quality and logic, not just whether the output is correct. Write clean, commented code. Name variables meaningfully." },
      { heading: "Round 4 — Technical Interview", content: "This is a deep 1:1 or panel interview with a Zoho engineer. Topics covered:\n\n• CS Fundamentals: OS (processes, threads, memory management), DBMS (normalization, SQL queries, transactions), networking (TCP/IP, HTTP, DNS)\n• Data structures: When to use which one and why\n• Your code from Rounds 2 & 3: They WILL ask you to explain your solutions\n• Design questions: 'How would you implement a stack using only queues?'\n• Debugging: 'What's wrong with this code?' exercises\n\nPrep tip: Read 'Operating System Concepts' (Silberschatz) chapters on processes and memory. SQL joins and normalization to 3NF are almost always tested." },
      { heading: "Salary and Perks (2026)", content: "Zoho fresher compensation:\n\nSoftware Engineer (SE): ₹5–6 LPA\nSenior Software Engineer (SSE, fast-track): ₹7–8 LPA\n\nZoho has NO bond period — rare among Indian IT companies.\nZoho offers profit-sharing bonuses in addition to base salary.\n\nGrowth track: SE → SSE in 1–2 years for strong performers. Engineers who join Zoho often become full-stack generalists — good for future product company switches.\n\nCompare: Zoho freshers typically earn 50–70% more than TCS Ninja (₹3.36L) and are comparable to Cognizant/Accenture. The engineering depth is significantly higher." },
    ],
    faqs: [
      { question: "Does Zoho hire freshers directly without experience?", answer: "Yes — Zoho specifically hires freshers directly through off-campus drives and walk-ins. They don't require work experience but do require strong CS fundamentals and programming ability." },
      { question: "Is Zoho a good company for freshers?", answer: "Yes — Zoho pays above average for freshers (₹5–8 LPA vs ₹3.36L at TCS), has no bond period, strong engineering culture, and hands-on work from day one. The main trade-off is that brand recognition for FAANG moves is lower than Flipkart or Razorpay." },
      { question: "How long is Zoho's interview process?", answer: "Zoho's 5-round process typically spans 1–2 days. Rounds 1–3 are tests (aptitude + programming), and Rounds 4–5 are interviews. The process can extend across 2 different days if multiple candidates are being evaluated." },
    ],
    practicePageSlugs: [
      { label: "Freshworks SDE Interview Practice", slug: "freshworks-sde-interview-questions" },
      { label: "Zerodha Engineering Interview Practice", slug: "zerodha-engineering-interview-questions" },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "hcl-accenture-capgemini-interview-comparison", "cognizant-interview-questions-freshers-2026"],
    cta: "Practice the Zoho-style technical and HR interview on HireStepX — AI coaching on CS fundamentals and code explanation answers.",
  },
  {
    slug: "software-engineer-interview-checklist-2026",
    title: "Software Engineer Interview Checklist 2026 — 48 Hours Before the Interview",
    metaDescription: "Complete software engineer interview checklist for India 2026. What to review, practice, and confirm in the 48 hours before your SDE interview at any company.",
    company: "Tech",
    category: "Technical",
    readTime: "7 min",
    heroImage: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&h=500&fit=crop",
    heroAlt: "Developer with checklist preparing for a software engineering interview",
    datePublished: "2026-07-01",
    intro: "You've spent weeks preparing. The interview is in 48 hours. This is not the time for a marathon study session — it's the time for targeted review, mental reset, and logistics confirmation. This checklist covers what actually matters in the 48 hours before any SDE interview in India.",
    sections: [
      { heading: "48 Hours Before — Technical Review", content: "Do NOT try to learn new topics. Instead, review what you already know:\n\n□ Review your 5 strongest data structure patterns (the ones you can code in 20 min)\n□ Re-read your system design notes — focus on the trade-offs you understand well\n□ Re-check your STAR stories for behavioral questions — practice them out loud once each\n□ Review the company's engineering blog or recent tech talks\n□ Check if the role mentions specific technologies (Python, Java, Go) and prep language-specific questions\n\nWhat NOT to do: Cram new algorithms, read new system design papers, or start a new LeetCode problem. The stress-to-gain ratio is terrible at T-48." },
      { heading: "24 Hours Before — Behavioral and Research", content: "□ Research the company's recent news (product launches, funding, acquisitions, leadership changes)\n□ Prepare 3 questions to ask the interviewer — specific to the team or product, not generic ('What's the culture like?')\n□ Re-read the job description and map your experience to each bullet point\n□ Prepare your 'Tell me about yourself' — rehearse once out loud, time it (target: 90 seconds)\n□ Identify your 3 strongest selling points and make sure they come up naturally\n□ Write down the interviewer's name if you know it — personalise your opening" },
      { heading: "Day-Of Logistics Checklist", content: "For in-person interviews:\n□ Confirm the office address (Swiggy, Razorpay, Flipkart all have multiple offices)\n□ Plan to arrive 15 minutes early — not 5, not 30\n□ Bring copies of your resume (3 copies minimum)\n□ Bring a notebook and pen for rough work\n□ Dress code: Business casual is safe for most Indian product companies\n\nFor video interviews:\n□ Test your audio and camera 30 minutes before\n□ Ensure stable internet — use ethernet if possible, or position yourself near the router\n□ Background: plain wall or minimal blur. No virtual backgrounds.\n□ Have your resume open on a second screen or printed in front of you\n□ Mute all notifications on your system" },
      { heading: "The Night Before — Mental Preparation", content: "The most underrated part of interview preparation.\n\n□ Stop working on technical prep by 8 PM\n□ 8–9 PM: Light exercise or a 30-minute walk\n□ Write down your 3 strongest interview moments (projects/achievements you're proud of) — a confidence anchor\n□ Sleep target: 7+ hours. Cognitive performance on 5 hours of sleep drops measurably for problem-solving tasks\n□ Morning of: No last-minute cramming. Eat before. Arrive early enough that you can take 5 minutes to breathe before going in" },
      { heading: "During the Interview — A 5-Point Framework", content: "1. Think out loud: Interviewers evaluate process, not just answers. Say what you're considering before you start writing.\n\n2. Clarify before coding: Spend 2–3 minutes clarifying the problem — edge cases, input constraints, expected output. This is the most common differentiator between junior and senior candidates.\n\n3. Start with brute force: Name the brute force solution first, state its time complexity, then optimise. Never jump straight to the optimal without acknowledgment.\n\n4. If you're stuck: Say 'I'm going to think through this systematically' and walk through your approach. Silence for 3+ minutes without narration is a red flag to interviewers.\n\n5. At the end: Always ask a thoughtful question. It signals genuine interest and gives the interviewer a positive last impression." },
    ],
    faqs: [
      { question: "What should I study the night before a software engineer interview?", answer: "Nothing new. Review your strongest DSA patterns, re-read your STAR stories out loud once each, and stop technical prep by 8 PM. Sleep matters more than the last 2 hours of cramming." },
      { question: "How early should I arrive for an in-person SDE interview?", answer: "Aim to arrive 15 minutes before the scheduled time. Earlier than that makes you anxious waiting; later than 5 minutes signals poor preparation." },
      { question: "What questions should I ask at the end of an interview?", answer: "Ask specific questions about the team, product, or challenges — not generic questions like 'What's the culture?' Better questions: 'What's the most challenging engineering problem the team is working on right now?' or 'How does the team decide what to prioritise each quarter?'" },
    ],
    practicePageSlugs: [
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
      { label: "Microsoft India SDE Practice", slug: "microsoft-india-sde-interview-questions" },
      { label: "Flipkart SDE Interview Practice", slug: "flipkart-sde-interview-questions" },
    ],
    relatedSlugs: ["mock-interview-practice-guide", "system-design-interview-preparation", "star-method-interview-answers"],
    cta: "Complete a full mock interview in 48 hours — get realistic feedback on DSA, behavioral, and system design rounds before your real interview.",
  },
  {
    slug: "java-interview-questions-freshers-india-2026",
    title: "Java Interview Questions for Freshers India 2026 — Top 60 Q&A",
    metaDescription: "Top 60 Java interview questions for freshers in India 2026. Covers OOP concepts, collections, exception handling, multithreading, and Java 17+ features with sample answers.",
    company: "Tech",
    category: "Technical",
    readTime: "13 min",
    heroImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=500&fit=crop",
    heroAlt: "Code on a screen representing Java interview preparation",
    datePublished: "2026-07-01",
    intro: "Java is asked in more Indian fresher interviews than any other language — TCS, Infosys, Wipro, Cognizant, and most product companies test it by default. The problem: most freshers memorise definitions but can't apply concepts. Here are the 60 questions that actually get asked, with answers built for explaining, not just reciting.",
    sections: [
      { heading: "OOP Fundamentals — Always Asked", content: "1. What are the 4 pillars of OOP?\nEncapsulation (bundling data + methods), Inheritance (IS-A relationship), Polymorphism (many forms — compile-time vs runtime), Abstraction (hiding implementation details). Know concrete examples of each.\n\n2. Difference between Abstraction and Encapsulation?\nAbstraction = hiding complexity (what). Encapsulation = hiding data (how). Abstract class/interface implements abstraction; private fields + getters/setters implement encapsulation.\n\n3. What is method overloading vs overriding?\nOverloading: same method name, different parameters (compile-time polymorphism, same class).\nOverriding: same method signature in subclass (runtime polymorphism, inheritance required).\n\n4. Can we override static methods in Java?\nNo — static methods are resolved at compile time (method hiding, not overriding). This is a common trick question.\n\n5. What is the difference between abstract class and interface?\nAbstract class: can have constructors, state, and partial implementation. Interface (Java 8+): default and static methods allowed; no state. A class can implement multiple interfaces but extend only one abstract class.\n\n6. What is the diamond problem and how does Java solve it?\nWhen multiple inheritance leads to ambiguity in which parent's method is called. Java avoids it by not allowing multiple class inheritance; interfaces with default methods use explicit override to resolve conflicts." },
      { heading: "Java Collections — Heavily Tested", content: "7. ArrayList vs LinkedList — when to use which?\nArrayList: O(1) random access, O(n) insert/delete in middle. LinkedList: O(1) insert/delete at head/tail, O(n) random access. Use ArrayList for most use cases; LinkedList when frequent head/tail insertions matter.\n\n8. HashMap internal working?\nHashMap stores key-value pairs in an array of buckets. Keys are hashed to bucket indices. Collisions (same bucket, different keys) are handled with chaining (linked list) or, since Java 8, red-black tree when bucket size > 8. Load factor default 0.75 — resize at 75% capacity.\n\n9. HashMap vs Hashtable vs ConcurrentHashMap?\nHashtable: thread-safe but synchronized on every method (slow). ConcurrentHashMap: thread-safe with segment-level locking (Java 7) or CAS operations (Java 8+) — much faster. HashMap: not thread-safe.\n\n10. What is the difference between Comparable and Comparator?\nComparable: natural ordering, implemented by the class itself (compareTo()). Comparator: custom ordering, external class/lambda. Use Comparator when you don't control the class or need multiple sort orders." },
      { heading: "Exception Handling & Memory", content: "11. Checked vs unchecked exceptions?\nChecked: must be declared/handled at compile time (IOException, SQLException). Unchecked: RuntimeExceptions — NullPointerException, ArrayIndexOutOfBoundsException. Error: system-level (StackOverflowError, OutOfMemoryError).\n\n12. What happens when you catch and swallow an exception?\nThe program continues but the error is silently ignored — dangerous in production. Always log the exception at minimum; propagate it if the caller should handle it.\n\n13. What is the finally block?  \nAlways executes after try/catch, even on exception or return (but NOT if System.exit() is called or JVM crashes). Use for resource cleanup (pre-Java 7); prefer try-with-resources (AutoCloseable) in modern code.\n\n14. What is garbage collection?\nJVM automatically manages memory. Objects become eligible for GC when no references point to them. GC algorithms: Serial, Parallel, G1 (default from Java 9+), ZGC (low-latency). You can hint with System.gc() but can't force it." },
      { heading: "Java 8+ Features — Modern Fresher Questions", content: "15. What are lambda expressions?\nAnonymous functions — syntax: (params) -> body. Enable functional programming in Java. Example: list.sort((a, b) -> a.compareTo(b)).\n\n16. What are Streams?\nFunctional pipeline for processing collections: filter → map → reduce → collect. Lazy evaluation — intermediate operations run only when terminal operation is called. Parallel streams use fork/join pool.\n\n17. What is Optional?\nWrapper class to avoid NullPointerException. Optional.of(), Optional.ofNullable(), Optional.empty(). Use .orElse(), .orElseThrow(), .ifPresent(). Don't use Optional as method parameter — use it as return type.\n\n18. Default and static methods in interfaces?\nJava 8 allowed default methods (implementation in interface) to enable backward compatibility when adding new methods to existing interfaces. Static interface methods can be called without an instance." },
      { heading: "Multithreading — Asked at Mid-Level Freshers", content: "19. Thread vs Runnable vs Callable?\nRunnable: run() returns void. Callable: call() returns a value and can throw checked exceptions. Thread: a thread of execution, takes Runnable/Callable in constructor.\n\n20. What is the volatile keyword?\nForces all threads to read the variable from main memory, not CPU cache. Solves visibility problem but not atomicity — for compound operations use AtomicInteger or synchronized.\n\n21. What is a deadlock? How do you prevent it?\nDeadlock: two threads each hold a resource the other needs, both wait forever. Prevention: always acquire locks in the same order; use timeout-based lock acquisition (tryLock with timeout); avoid holding multiple locks.\n\n22. ExecutorService vs creating new Thread directly?\nAlways prefer ExecutorService — it manages a thread pool, reuses threads, handles exceptions, and provides Future for async results. Creating new Thread() per task wastes resources and is uncontrolled." },
    ],
    faqs: [
      { question: "What Java version is asked in Indian interviews in 2026?", answer: "Most Indian interviews test core Java (Java 8 features are standard). Java 11 and 17 LTS features (records, sealed classes, text blocks) are asked at product companies but rarely at service IT companies." },
      { question: "Should I prepare Java or Python for TCS/Infosys interviews?", answer: "For TCS and Infosys, Java is preferred since most projects use it. For product companies, Python is increasingly accepted for DSA coding rounds. Prepare both if time allows, but be fluent in one." },
    ],
    practicePageSlugs: [
      { label: "TCS Campus Placement Practice", slug: "tcs-ninja-interview-questions" },
      { label: "Infosys Campus Interview Practice", slug: "infosys-campus-interview-questions" },
      { label: "Wipro Freshers Interview Practice", slug: "wipro-freshers-interview-questions" },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "system-design-interview-preparation", "campus-placement-interview-tips"],
    cta: "Practice technical Java questions in a mock interview format on HireStepX — AI evaluates your explanation depth, not just whether the answer is correct.",
  },
  {
    slug: "resume-tips-freshers-india-2026",
    title: "Resume Tips for Freshers India 2026 — What Actually Gets Shortlisted",
    metaDescription: "Practical resume writing tips for Indian freshers in 2026. Covers ATS optimisation, project descriptions, skills section, and what recruiters at TCS, Infosys, Flipkart, and Google actually look for.",
    company: "General",
    category: "Preparation",
    readTime: "9 min",
    heroImage: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&h=500&fit=crop",
    heroAlt: "Resume document on a desk representing fresher resume writing tips",
    datePublished: "2026-07-01",
    intro: "For every campus placement job at a top Indian company, recruiters see 200–500 resumes. Most are eliminated in the first 30 seconds — not because the candidates weren't qualified, but because the resume failed to communicate it. Here's what actually gets you shortlisted in 2026.",
    sections: [
      { heading: "The Single-Page Rule (and When to Break It)", content: "For freshers with under 2 years of experience: one page, always. No exceptions.\n\nWhy: Recruiters at high-volume campuses spend an average of 6 seconds per resume. Anything beyond page 1 rarely gets read. Two-page resumes from freshers signal inability to prioritise — itself a negative signal.\n\nThe only exception: if you have exceptional projects, publications, or research, an Appendix-style second page is acceptable at IIT/NIT-level campus drives for FAANG. Service company recruiters won't read it." },
      { heading: "ATS Optimisation — What Indian Companies Actually Use", content: "ATS (Applicant Tracking System) filters resumes before a human sees them. In India:\n\nService companies (TCS, Infosys, Wipro): Most use internal ATS that filters by exact keyword match, degree type, and CGPA threshold. Use the same technology terms as the job description.\n\nProduct companies (Flipkart, Swiggy, CRED): Mix of Greenhouse, Lever, and proprietary tools. Keyword matching on tech stack + experience level.\n\nFAAN/FAANG recruiters: Often manually sourced from LinkedIn or referrals — ATS matters less, content quality matters more.\n\nATS rules that work everywhere:\n• Use standard section headers: Work Experience, Education, Projects, Skills\n• No tables, columns, or text boxes — ATS often can't parse them\n• Save as PDF, named: FirstName-LastName-Resume.pdf\n• Use the exact skill names from the job description (Java, not 'programming languages')" },
      { heading: "The Projects Section — The Most Important Part for Freshers", content: "The projects section IS your work experience as a fresher. It needs to be treated accordingly.\n\nBad project description:\n'Built a food delivery app using React and Node.js.'\n\nGood project description:\n'Built a full-stack food delivery app (React, Node.js, MongoDB) handling 50+ concurrent users. Implemented JWT auth, order state machine, and real-time delivery tracking with Socket.io. GitHub: [link] | Live: [link]'\n\nFormula for every project:\n[What it does] + [Key tech used] + [Scale/measurable outcome] + [Links]\n\nIf your project doesn't have a GitHub link, create one. Recruiters at product companies check." },
      { heading: "The Skills Section — Don't Lie, Don't Be Vague", content: "Common mistakes:\n× 'Proficient in: Java, Python, C++, JavaScript, React, Angular, Vue, Machine Learning, NLP, Blockchain' — lists everything, signals nothing\n× 'Familiar with Java' — too vague; just list it or don't\n× Listing tools you can't discuss in an interview\n\nThe right approach:\nGroup by category:\nLanguages: Java (primary), Python\nFrameworks: Spring Boot, React\nDatabases: MySQL, MongoDB\nTools: Git, Docker, Postman\nCloud: AWS basics (EC2, S3)\n\nOnly list skills you can discuss for 3+ minutes if asked. Listing them and blanking in the interview is worse than not listing them." },
      { heading: "CGPA and Academics — The Real Cutoff Situation", content: "What recruiters actually need:\nTCS: 60% throughout (equivalent to ~6.0 CGPA). Wipro/Infosys: similar. Product companies vary — some have no filter, some have 7.0 CGPA.\n\nIf your CGPA is below the threshold:\n• Apply off-campus where filters aren't enforced\n• Lead with your projects/skills section — put it above Education\n• Target companies that explicitly don't have CGPA requirements (Zoho, many startups)\n• Get referrals — referral resumes often bypass ATS filters\n\nIf your CGPA is above 8.5: put it prominently. It's a positive signal at high-volume drives where 70% of candidates are 6.5–7.5." },
    ],
    faqs: [
      { question: "Should I put my photo on an Indian fresher resume?", answer: "Most Indian recruiters expect a photo, but product companies (Flipkart, Swiggy, CRED) and FAANG India offices do not want one — it can introduce bias and slow ATS processing. When in doubt: no photo for product/FAANG roles; photo is acceptable for service IT companies." },
      { question: "Should I include my 10th and 12th marks on a fresher resume?", answer: "Yes for India campus placements — they're often required for ATS cutoffs at service companies. Include them until you have 2+ years of work experience, then they can be removed." },
      { question: "How long should a fresher resume be?", answer: "One page for freshers. No exceptions under 2 years of experience." },
    ],
    practicePageSlugs: [
      { label: "TCS Campus Placement Practice", slug: "tcs-ninja-interview-questions" },
      { label: "Amazon Campus Placement Practice", slug: "amazon-campus-placement-india" },
      { label: "IBM Campus Placement Practice", slug: "ibm-campus-placement-interview-questions" },
    ],
    relatedSlugs: ["campus-placement-interview-tips", "behavioral-interview-questions-freshers", "tcs-interview-questions-freshers-2026"],
    cta: "After building your resume, practice explaining your projects and experience in mock interviews on HireStepX — the gap between resume and interview is where most candidates lose.",
  },
  {
    slug: "data-analyst-interview-questions-india-2026",
    title: "Data Analyst Interview Questions India 2026 — SQL, Python, Stats & Case Studies",
    metaDescription: "Complete data analyst interview preparation guide for India 2026. Covers SQL queries, Python pandas, statistics, A/B testing, and business case questions with sample answers.",
    company: "Tech",
    category: "Technical",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=500&fit=crop",
    heroAlt: "Data charts and analytics dashboard representing data analyst interview preparation",
    datePublished: "2026-07-01",
    intro: "Data analyst roles in India are one of the fastest-growing job categories — every startup, fintech, and IT services company is hiring. The interviews vary widely: Swiggy and Flipkart test SQL + product sense; TCS and Infosys focus on Excel + reporting tools; Goldman Sachs and JP Morgan test statistics + financial modelling. Here's what each type actually asks.",
    sections: [
      { heading: "SQL — The Universal Filter", content: "SQL is asked in virtually every data analyst interview in India. The questions that actually differentiate candidates:\n\n1. Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD(), PARTITION BY. These are asked at every product company.\n\nExample: 'Find the 2nd highest salary per department.'\nSELECT * FROM (SELECT *, DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) as rk FROM employees) t WHERE rk = 2;\n\n2. Self joins: 'Find all employees who earn more than their manager.'\n\n3. Aggregation + HAVING: 'Find departments with more than 5 employees earning above ₹10L.'\n\n4. Common Table Expressions (CTEs): Readable alternative to subqueries. Interviewers at Flipkart and Amazon specifically look for CTE usage as a signal of SQL maturity.\n\n5. Query optimisation: 'How would you optimise a slow query?' — Cover indexing (B-tree vs hash), explain plan, avoiding SELECT *, avoiding functions on indexed columns in WHERE clause." },
      { heading: "Python + Pandas — Product Company Bar", content: "Product companies (Flipkart, Swiggy, Meesho) typically test Python/Pandas for data manipulation:\n\nMust-know Pandas operations:\n• read_csv(), head(), describe(), info(), value_counts()\n• groupby() + agg() — 'Find average order value per city'\n• merge() — equivalent of SQL joins\n• pivot_table() — aggregate with multiple dimensions\n• apply() + lambda — custom transformations\n• Handle missing values: fillna(), dropna(), isnull()\n\nTypical question: 'Given a dataframe of orders, find the top 5 customers by total spend in the last 30 days, excluding cancelled orders.'\n\nExpected: filter, groupby, sort, head(5) — all in 5–10 lines of clean Pandas." },
      { heading: "Statistics & Probability — Fintech/FAANG Specific", content: "Goldman Sachs, JPMorgan, Amazon, and Flipkart analytics roles test statistics:\n\nCore topics:\n• Probability: Bayes theorem, conditional probability, distributions (normal, binomial, Poisson)\n• Hypothesis testing: p-value, Type I/II error, confidence intervals\n• A/B testing: How to set up, minimum sample size calculation, multiple testing correction\n• Regression: Linear regression assumptions (LINEARITY), R-squared interpretation, multicollinearity\n• Central Limit Theorem: Why it matters for sampling-based analysis\n\nA/B testing question (very common): 'We ran an A/B test for 2 weeks. Variant B has a 3% higher conversion rate. Is this statistically significant? How do you decide?'\n\nExpected answer: Define significance threshold (p<0.05), calculate minimum sample size before starting, check if duration was sufficient, use t-test or chi-squared, report confidence interval not just p-value." },
      { heading: "Business Case / Product Analysis Questions", content: "At product companies (Swiggy, Zomato, Flipkart, Meesho), expect business case questions:\n\n'Swiggy orders dropped 15% last Tuesday between 7-9 PM. How would you diagnose the issue?'\n\nFramework:\n1. Confirm the data: Is the drop real? Check for data pipeline issues first.\n2. Narrow the scope: Is it all cities or specific ones? All restaurants or specific cuisines? Specific device types?\n3. External vs internal: Weather event? Competitor promotion? App crash? Server downtime?\n4. Hypothesis tree: For each dimension, form a hypothesis and identify the data that would confirm/deny it.\n5. Recommendation: What immediate action and what monitoring to put in place.\n\nThis type of question tests structured thinking, not SQL knowledge — practice narrating your diagnostic process out loud." },
    ],
    faqs: [
      { question: "What is data analyst salary in India in 2026?", answer: "Data Analyst salaries in India: Junior DA at IT services ₹4–7 LPA; Mid-level at Indian startups ₹10–20 LPA; Senior DA at unicorns (Flipkart, Swiggy) ₹25–40 LPA; Analytics roles at FAANG India ₹35–60 LPA." },
      { question: "Which is better for data analyst — SQL or Python?", answer: "SQL is the universal requirement — every company tests it. Python (Pandas, NumPy) is additionally required at product companies and FAANG. For service IT companies, Excel/Tableau may be the primary tool. Learn SQL first, then Python." },
      { question: "Is data science the same as data analyst?", answer: "No. Data Analyst: SQL, dashboards, business reports, A/B tests — explains what happened. Data Scientist: machine learning, predictive models — predicts what will happen. The interview bar is different; data science roles require ML/statistics depth beyond typical DA interviews." },
    ],
    practicePageSlugs: [
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
      { label: "Flipkart SDE Interview Practice", slug: "flipkart-sde-interview-questions" },
      { label: "PhonePe Engineering Interview Practice", slug: "phonepe-engineering-interview-questions" },
    ],
    relatedSlugs: ["system-design-interview-preparation", "razorpay-interview-experience", "product-manager-interview-questions-india"],
    cta: "Practice data analyst interview questions on HireStepX — SQL case studies, A/B testing explanations, and business case walk-throughs with AI scoring.",
  },
  {
    slug: "zomato-product-manager-interview-2026",
    title: "Zomato Product Manager Interview 2026 — Case Study, Metrics & Experience",
    metaDescription: "Complete Zomato PM interview preparation guide for 2026. Covers product cases on restaurant discovery, delivery metrics, Hyperpure B2B, and Zomato Gold monetisation with sample frameworks.",
    company: "Zomato",
    category: "Product",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1200&h=500&fit=crop",
    heroAlt: "Food delivery packaging representing Zomato product manager interview preparation",
    datePublished: "2026-07-01",
    intro: "Zomato PM interviews are case-heavy and context-specific — they expect you to know their product deeply. Restaurant discovery, delivery optimization, Zomato Gold (Pro membership), Hyperpure (B2B supply), Blinkit integration, and user retention are all fair game. The single biggest mistake candidates make: giving Swiggy answers in a Zomato interview.",
    sections: [
      { heading: "Zomato's Interview Process (2026)", content: "Zomato PM interview rounds:\n\n1. Resume Screen + Recruiter Call (30 min): Background, motivation, product interest. Have a strong answer for 'Why Zomato specifically?' that references their specific products.\n\n2. Case Round 1 (60 min): Product sense or improvement case. Common: 'How would you improve Zomato's restaurant discovery?' or 'Design a feature to increase order frequency.'\n\n3. Case Round 2 (60 min): Metric/analytics case. 'Zomato's reorder rate dropped 12% in July — diagnose.' or 'Define the success metrics for Zomato Gold.'\n\n4. Behavioral Round (45 min): Values alignment — ownership, data-driven decisions, customer empathy.\n\n5. Hiring Manager / Leadership Round: Product strategy + cross-functional alignment stories." },
      { heading: "Product Cases — Zomato-Specific Frameworks", content: "Case: 'How would you improve restaurant discovery on Zomato?'\n\nSolid approach:\n1. Clarify scope — discovery for new users vs returning? Mobile vs web?\n2. User segments — new city visitors, cuisine explorers, re-orderers, dietary-restricted users\n3. Current pain points — too many options, poor photos, misleading ratings, no context for occasions\n4. Solutions — contextual discovery (weather, time, occasion), social proof from people you trust, better restaurant photography standards, diet filter consistency\n5. Metrics — discovery-to-order conversion rate, time-to-first-order for new users\n6. Prioritise — quick win vs long-term\n\nWhat Zomato actually cares about: does your solution fit a 3-sided marketplace (user, restaurant, delivery partner)? Does it affect unit economics? Is it defensible against Swiggy?" },
      { heading: "Metric Diagnosis Cases", content: "Most common Zomato metric question pattern: 'Metric X dropped Y% — what happened?'\n\nDiagnostic framework (memorise this):\n1. Confirm the data — pipeline issue? Reporting lag? Seasonality?\n2. Slice by dimension — geo, time of day, restaurant type, order size, user cohort (new vs returning)\n3. External factors — competitor promotion, festival, weather, app store update\n4. Funnel analysis — where in the order funnel did the drop happen (search → click → cart → checkout → delivery)?\n5. Hypothesis → data to confirm it\n\nFor Zomato specifically, always check: restaurant-side issues (supply dropoff), Blinkit cannibalization, Gold/Pro member churn as separate from non-member behavior." },
      { heading: "Behavioral Questions Zomato Actually Asks", content: "1. Tell me about a product you worked on where the metrics looked good but you weren't happy with it. Why?\n(Tests: product intuition beyond dashboard numbers)\n\n2. Describe a time you had to kill a feature you had championed. How did you decide?\n(Tests: intellectual honesty + data-driven decision making)\n\n3. Walk me through a time you navigated a disagreement with engineering on priority.\n(Tests: cross-functional influence + persuasion approach)\n\n4. What is a Zomato product decision you would have made differently?\n(Tests: genuine product engagement + confidence to critique)\n\n5. How would you improve Blinkit's integration with Zomato?\n(Tests: understanding of both products + synergy thinking)" },
    ],
    faqs: [
      { question: "What is Zomato PM salary in 2026?", answer: "Zomato PM salary ranges from ₹25–45 LPA at the PM level, ₹45–70 LPA for Senior PM, and ₹70–100 LPA+ for Group PM/Director levels. The compensation includes ESOPs which can significantly add up as Zomato is a publicly listed company." },
      { question: "How hard is the Zomato PM interview?", answer: "Moderately hard — harder than Ola/MakeMyTrip, slightly easier than Flipkart/Razorpay. The bar is high on product context (knowing Zomato's products deeply) and metric cases. Candidates who use generic frameworks without Zomato-specific examples are typically rejected." },
    ],
    relatedSlugs: ["swiggy-pm-interview-questions", "product-manager-interview-questions-india", "ace-case-study-interviews"],
    practicePageSlugs: [
      { label: "Zomato Product Interview", slug: "zomato-product-interview-questions" },
    ],
    cta: "Practice Zomato-style PM cases with HireStepX — AI evaluates your diagnostic structure, metric definition, and hypothesis clarity in real time.",
  },
  {
    slug: "python-interview-questions-freshers-india-2026",
    title: "Python Interview Questions for Freshers India 2026 — Top 50 Q&A",
    metaDescription: "Top 50 Python interview questions for freshers in India 2026. Covers data types, OOP, list comprehension, decorators, generators, and common libraries with sample answers.",
    company: "Tech",
    category: "Technical",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=500&fit=crop",
    heroAlt: "Python code on a screen representing Python interview preparation",
    datePublished: "2026-07-01",
    intro: "Python is now the preferred language for DSA rounds at most Indian product companies — Flipkart, Swiggy, CRED, Amazon, and Google all accept it. It's also the primary language for data science and ML interviews. But Python interview questions are deceptively tricky — the language's features (mutable defaults, GIL, generators) generate questions Java doesn't. Here are the 50 that matter most.",
    sections: [
      { heading: "Core Python — Fundamentals Still Get Asked", content: "1. What is the difference between a list and a tuple?\nList: mutable, uses [], slower iteration. Tuple: immutable, uses (), faster iteration and hashable (can be dict key). Use tuple for fixed data (coordinates, RGB values), list for data that changes.\n\n2. What is the GIL (Global Interpreter Lock)?\nCPython's mutex that prevents multiple threads from executing Python bytecode simultaneously. This means CPU-bound threads don't speed up on multi-core machines. Solutions: multiprocessing (separate processes), asyncio for I/O-bound tasks, Cython or C extensions.\n\n3. What are mutable default arguments and why are they dangerous?\nCommon Python gotcha: def add(item, lst=[]) reuses the same list across calls. Python evaluates default arguments once at function definition time. Fix: use None as default and create inside function.\n\n4. What is *args and **kwargs?\n*args: variable positional arguments — packed as tuple. **kwargs: variable keyword arguments — packed as dict. Used to write flexible functions that accept any number of arguments.\n\n5. What is list comprehension vs generator expression?\nList comprehension: [x*2 for x in range(10)] — creates the full list in memory immediately.\nGenerator: (x*2 for x in range(10)) — lazy evaluation, yields one item at a time. Generators are more memory-efficient for large data." },
      { heading: "OOP in Python", content: "6. What is __init__ vs __new__?\n__new__: creates the object (called first). __init__: initialises it (called second). Override __new__ for metaclasses or immutable types (tuple subclasses). For most use cases, only __init__ matters.\n\n7. What is the difference between class variable and instance variable?\nClass variable: shared across all instances (defined outside __init__). Instance variable: unique per object (defined with self.x in __init__). Mutable class variables shared across instances is another gotcha — changes in one instance affect all.\n\n8. What are Python decorators?\nFunctions that wrap another function — add behaviour without modifying the original. Common uses: @property (getter/setter), @staticmethod, @classmethod, @functools.lru_cache (memoisation). The @login_required pattern in Django is a real-world example.\n\n9. What is multiple inheritance and MRO?\nPython supports multiple inheritance. MRO (Method Resolution Order) defines the search order for methods — uses C3 linearisation algorithm. Check with ClassName.__mro__ or ClassName.mro().\n\n10. What is __slots__?\nOptimisation: prevents creation of __dict__ per instance, reducing memory usage for objects created in large numbers (100k+ instances). Restricts instance attributes to those declared in __slots__." },
      { heading: "Python Libraries — Data-Focused Questions", content: "11. What is the difference between shallow copy and deep copy in Python?\nshallow copy (copy.copy()): copies the object but not nested objects — modifying nested objects affects both copies.\ndeep copy (copy.deepcopy()): copies everything recursively — fully independent.\n\n12. How does Python's dictionary maintain insertion order?\nFrom Python 3.7+, dict maintains insertion order as part of the language specification (not just CPython implementation detail). Interviewers sometimes ask about this to test language version awareness.\n\n13. What are Python generators and yield?\nGenerators are lazy iterators — they yield values one at a time, only computing the next value when asked. This allows infinite sequences and memory-efficient pipelines. yield turns any function into a generator. yield from delegates to a sub-generator.\n\n14. What is the difference between is and ==?\n== tests equality (value comparison). is tests identity (same object in memory). Small integers (-5 to 256) and interned strings are cached by CPython, so a is b may return True unexpectedly for those — always use == for value comparison." },
      { heading: "Python in DSA Coding Rounds", content: "Python-specific patterns for competitive coding rounds:\n\nCollections module (always import this):\n• defaultdict(int): auto-initialises missing keys — replaces freq[key] = freq.get(key, 0) + 1 with freq[key] += 1\n• Counter: frequency counter + most_common()\n• deque: O(1) append/pop from both ends — use for BFS queues\n• heapq: min-heap (for max-heap: negate values)\n\nBisect module: binary search on sorted arrays — bisect_left(), bisect_right()\n\nCommon Python DSA patterns:\n• sorted(iterable, key=lambda x: ...) — custom sort in one line\n• list[::-1] — reverse a list\n• zip(a, b) — pair two lists\n• enumerate(iterable) — index + value in loop\n• any() / all() — boolean aggregation\n• set() — O(1) lookup, automatic deduplication" },
    ],
    faqs: [
      { question: "Is Python good for Java-dominated interview questions in India?", answer: "Yes — Python is accepted at all major product companies (Flipkart, Amazon, Swiggy, Razorpay, Google India). For service IT companies (TCS, Infosys), Java or C++ is still the dominant choice for interviews, but Python is increasingly accepted." },
      { question: "What Python version should I prepare for interviews?", answer: "Python 3.10+ is standard. Know Python 3.7+ features (f-strings, dict ordering, walrus operator :=). Python 2 is dead — don't waste time on it." },
    ],
    practicePageSlugs: [
      { label: "Freshworks SDE Interview Practice", slug: "freshworks-sde-interview-questions" },
      { label: "Microsoft India SDE Practice", slug: "microsoft-india-sde-interview-questions" },
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
    ],
    relatedSlugs: ["java-interview-questions-freshers-india-2026", "data-analyst-interview-questions-india-2026", "system-design-interview-preparation"],
    cta: "Practice Python technical questions in a voice mock interview on HireStepX — explain your code and reasoning out loud, scored by AI in real time.",
  },
  {
    slug: "goldman-sachs-india-interview-questions",
    title: "Goldman Sachs India Interview Questions 2026 — Engineering & Analyst",
    metaDescription: "Complete Goldman Sachs India interview guide for 2026. Covers the Hirevue video screening, technical round (DSA + system design), super day, and salary for SDE and Analyst roles.",
    company: "Goldman Sachs",
    category: "Finance & Banking Tech",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=500&fit=crop",
    heroAlt: "Financial district skyscrapers representing Goldman Sachs India offices",
    datePublished: "2026-07-01",
    intro: "Goldman Sachs India (GS) is one of the most coveted employers for engineering and finance graduates in India — with SDE-1 offers at ₹35–55 LPA and Analyst packages at ₹20–30 LPA. The interview bar is significantly higher than typical IT service companies, combining rigorous DSA rounds with finance-specific thinking. This guide covers exactly what to expect in 2026.",
    sections: [
      { heading: "Goldman Sachs India Hiring Process (2026)", content: "The GS India hiring pipeline has 4–6 stages:\n\nStage 1 — HireVue Screening (30 min, asynchronous video)\nRecorded video responses to 3–4 behavioral questions. You have 30 seconds to prepare and 2–3 minutes to answer. GS uses AI scoring + human review. This is the most-failed first step — candidates underestimate it.\n\nStage 2 — Online Coding Assessment (90 min, HackerRank)\n2–3 coding problems. Difficulty: 1 medium + 1 hard (DSA). GS tests not just correctness but time/space complexity. Partial solutions with working test cases score better than brute force.\n\nStage 3 — Technical Phone Screen (45 min)\nOne interviewer. Mix of coding (1 medium problem) + CS theory. GS particularly focuses on object-oriented design and system reliability.\n\nStage 4–5 — Super Day (3–4 back-to-back interviews, on-site or video)\n• Coding round (1–2 hard DSA problems)\n• System design (SDE-2+ and Analyst)\n• Risk & controls / behavioral (finance-specific)\n• Partner/Director interview (final decision-maker)\n\nStage 6 — HR + Offer\nBackground verification takes 3–4 weeks. Verbal offers come from the hiring manager, written from HR." },
      { heading: "Technical Interview Topics at Goldman Sachs India", content: "DSA topics GS frequently tests:\n\nGraphs (mandatory) — BFS/DFS, shortest path (Dijkstra), cycle detection, topological sort. GS interview questions involving trading systems often model them as graphs (order routing, market maker networks).\n\nDynamic Programming — Knapsack variants, LCS, matrix chain multiplication. GS asks DP problems that require both correctness and optimization.\n\nArrays & Sliding Window — Two-pointer, sliding window maximum. Frequently asked as warm-up questions.\n\nTrees & BSTs — LCA, vertical order traversal, serialize/deserialize. Binary trees come up in every super day.\n\nString manipulation — Anagram detection, KMP pattern matching, string compression.\n\nHeaps & Priority Queues — Merge k sorted lists, top-k elements. Finance context: 'Given a stream of stock prices, return the 10 highest in O(log n)'.\n\nGS-specific angle: Many problems have a finance twist — trading systems, order books, portfolio optimization. Even when the underlying problem is standard DSA, the framing is financial." },
      { heading: "System Design for Goldman Sachs", content: "GS expects system design answers grounded in reliability, consistency, and auditability — finance systems cannot lose data or have inconsistent state.\n\nCommon GS system design questions:\n• 'Design a real-time trade matching engine'\n• 'Design a portfolio risk calculator that runs across 10,000 securities'\n• 'Design an audit log system that is tamper-evident'\n• 'Design a payments reconciliation system'\n\nKey principles GS values:\n1. ACID compliance — GS prefers strong consistency over eventual consistency for financial data\n2. Message queues for reliability — Kafka/Pulsar for order processing; at-least-once delivery with idempotent handlers\n3. Disaster recovery — Active-active vs active-passive setup, RPO/RTO requirements\n4. Regulatory compliance — GDPR/RBI data residency, audit trails, PII handling\n5. Latency budget — For trading systems, discuss microsecond vs millisecond requirements\n\nThe single biggest mistake: proposing eventual consistency without justifying it. At GS, 'we can be slightly inconsistent sometimes' is not acceptable for financial data." },
      { heading: "Behavioral Questions at Goldman Sachs", content: "GS behavioral rounds use a combination of STAR format and Goldman-specific competencies:\n\n'Describe a time you had to deliver under a tight deadline with incomplete information.'\nModel answer structure: Situation (high-stakes project context) → Task (what you owned) → Uncertainty (specific incomplete data point) → Action (how you decided to proceed despite uncertainty) → Result (quantified outcome).\n\n'Tell me about a situation where you disagreed with your manager.'\nGS values intellectual honesty. The answer must show respectful pushback + data-driven reasoning + willingness to execute even after being overruled.\n\n'How do you handle a situation where a process or system you built caused a production incident?'\nGS expects: immediate ownership (no blame-shifting), clear post-mortem thinking, and systemic fix over band-aid patch.\n\nUnique GS dimension: Ethics/risk questions\n'A colleague shows you a shortcut that bypasses a compliance check to meet a deadline. What do you do?'\nExpected answer: escalate. GS has zero tolerance for compliance shortcuts — this is not a trick question." },
      { heading: "Goldman Sachs Salary in India 2026", content: "Compensation packages at GS India (Bengaluru/Hyderabad) for 2026:\n\nSDE-1 / Analyst (0–2 years experience)\nBase: ₹25–35 LPA\nBonus: ₹4–8 LPA (performance-based, paid January)\nTotal: ₹30–43 LPA\n\nSDE-2 / Associate (3–5 years experience)\nBase: ₹38–55 LPA\nBonus: ₹8–18 LPA\nTotal: ₹46–73 LPA\n\nVice President (7–10 years)\nBase: ₹65–90 LPA\nBonus: ₹15–35 LPA\nTotal: ₹80–125 LPA\n\nCampus recruits from IITs/IIMs get the Analyst track with ₹20–25 LPA base. Post-MBA recruits from the GS Analyst program get ₹22–30 LPA base.\n\nBenefits worth noting: GS India has comprehensive health insurance (family covered), employee stock program, gym reimbursement, and meal allowance. The Bengaluru office in Outer Ring Road is one of GS's largest tech offices outside of New York." },
    ],
    faqs: [
      { question: "Is Goldman Sachs India different from Wall Street GS?", answer: "The Bengaluru and Hyderabad offices do real engineering work — not outsourced support. GS India builds core trading infrastructure, risk systems, and engineering platforms used globally. The interview bar and compensation are higher than most Indian product companies at senior levels." },
      { question: "What is Goldman Sachs SDE salary in India 2026?", answer: "Goldman Sachs SDE-1 salary in India 2026 is ₹30–43 LPA (base + bonus). This is comparable to senior SDE roles at Indian unicorns — GS India pays above market for engineering talent." },
      { question: "Does Goldman Sachs India hire freshers from IIT?", answer: "Yes, GS actively recruits from IIT campuses for the Analyst and Technology track. Shortlisting is highly competitive — typically top 10–15% of eligible students get interviewed. Off-campus applications are accepted via the GS careers portal but have a lower conversion rate." },
      { question: "How many rounds does Goldman Sachs India have?", answer: "Typically 5–6 rounds: HireVue screen → coding assessment → phone screen → super day (3–4 back-to-back interviews) → HR. Campus hires skip the HireVue and go directly to the coding test." },
    ],
    relatedSlugs: ["system-design-interview-preparation", "top-10-google-interview-questions", "salary-negotiation-tips-india"],
    practicePageSlugs: [
      { label: "Goldman Sachs Engineering Interview", slug: "goldman-sachs-engineering-interview-questions" },
    ],
    cta: "Practice Goldman Sachs-style DSA + behavioral rounds on HireStepX — AI feedback on code quality, system design structure, and finance-context answers.",
  },
  {
    slug: "frontend-developer-interview-questions-india-2026",
    title: "Frontend Developer Interview Questions India 2026 — React, JS & System Design",
    metaDescription: "Top frontend developer interview questions for India 2026. Covers JavaScript internals, React hooks, performance, CSS, system design for UI, and company-specific questions from Flipkart, Razorpay, and Swiggy.",
    company: "General",
    category: "Technical",
    readTime: "12 min",
    heroImage: "https://images.unsplash.com/photo-1593720219276-0b1eacd0aef4?w=1200&h=500&fit=crop",
    heroAlt: "Developer writing frontend code on a laptop with multiple browser windows",
    datePublished: "2026-07-05",
    intro: "Frontend developer interviews in India have become significantly more rigorous since 2023. Companies like Razorpay, Swiggy, and Meesho now expect the same DSA depth from frontend engineers as backend — plus deep JavaScript internals, React patterns, and web performance. This guide covers the 60 questions most likely to come up in 2026.",
    sections: [
      { heading: "JavaScript Fundamentals — The Non-Negotiables", content: "1. What is the event loop in JavaScript?\nJS is single-threaded. The event loop continuously checks the call stack and the callback queue — when the call stack is empty, it pushes the first item from the queue to the stack. Microtasks (Promises, queueMicrotask) run before macrotasks (setTimeout, setInterval) after each stack frame.\n\n2. What is the difference between var, let, and const?\nvar: function-scoped, hoisted (initialized to undefined). let: block-scoped, not initialized (TDZ — temporal dead zone before declaration). const: block-scoped, must be initialized at declaration, reference is immutable (object properties can still change).\n\n3. What is closure in JavaScript?\nA closure is a function that retains access to its outer scope even after the outer function has returned. This is the basis for module patterns, memoization, and factory functions.\n\n4. What is the difference between == and ===?\n=== (strict): no type coercion — 1 === '1' is false. == (loose): coerces types — 1 == '1' is true. Always use ===; == produces unexpected results and is considered a code smell.\n\n5. What is prototype chain and prototypal inheritance?\nEvery JS object has a __proto__ pointing to its prototype. When you access a property, JS walks up the chain until it finds it or hits null. ES6 classes are syntactic sugar over prototypal inheritance.\n\n6. What is async/await vs Promises vs callbacks?\nCallbacks: original async pattern, leads to callback hell. Promises: chainable, .then()/.catch()/.finally(). async/await: syntactic sugar over Promises — cleaner, but same underlying mechanics. Use async/await by default; know Promises for interview questions.\n\n7. What is debounce vs throttle?\nDebounce: delays execution until N ms after the LAST call — useful for search inputs. Throttle: limits execution to once per N ms regardless of call frequency — useful for scroll handlers. Knowing how to implement both from scratch is an interview staple." },
      { heading: "React — What Interviewers Actually Ask", content: "8. What is the difference between useMemo and useCallback?\nuseCallback: memoises a function reference — prevents child re-renders when passing callbacks as props. useMemo: memoises a computed value — prevents expensive recalculations. Both take a dependency array. Neither is free — adds overhead; only use when profiling shows a real re-render problem.\n\n9. What is the React reconciliation algorithm?\nReact compares the virtual DOM tree (new render) against the previous tree. It uses a heuristic: same element type in same position = update; different type = unmount + remount. Keys tell React to match elements across a list by identity, not position.\n\n10. What is useEffect dependency array?\nEmpty array []: run once on mount. Specific deps [a, b]: run when a or b changes. No array: run after every render. Cleanup function: returned from useEffect, runs before the next effect and on unmount.\n\n11. What are React Server Components?\nRSC (available in Next.js App Router) render on the server — zero client JS bundle for those components. They cannot use state, effects, or browser APIs. Client components use 'use client' directive. Mixing RSC and client components is the pattern for optimal bundle sizes.\n\n12. What is Context vs Redux for state management?\nContext: built-in, good for low-frequency updates (theme, auth, locale). Redux / Zustand: better for high-frequency or complex state — they avoid unnecessary re-renders Context triggers. Modern recommendation: Zustand for most apps, Context for auth/theme.\n\n13. How would you optimise a React app with 10,000 list items?\nVirtualisation (react-window or react-virtual): render only visible items. Memoization (React.memo, useMemo, useCallback): prevent unnecessary re-renders. Code splitting (lazy + Suspense): reduce initial bundle. Profiler: identify actual bottlenecks before optimising." },
      { heading: "CSS & Browser — Often Overlooked", content: "14. What is the CSS box model?\nContent → Padding → Border → Margin. box-sizing: content-box (default): width doesn't include padding/border. box-sizing: border-box: width includes padding/border — easier to reason about, use for everything.\n\n15. What is the difference between Flexbox and CSS Grid?\nFlexbox: one-dimensional (row OR column). Grid: two-dimensional (rows AND columns). Use Flexbox for nav bars, button groups, card contents. Use Grid for page layouts, card grids.\n\n16. What is CSS specificity?\nInline styles (1000) > ID selectors (100) > Class/attribute selectors (10) > Element selectors (1). The highest specificity wins. !important overrides everything — avoid it.\n\n17. What happens between the URL being typed and the page rendering?\nDNS resolution → TCP connection → TLS handshake → HTTP request → server response → HTML parsing → DOM construction → CSSOM construction → Render tree → Layout → Paint → Composite. Knowing this sequence (the 'critical rendering path') is tested at Razorpay and Flipkart." },
      { heading: "System Design for Frontend Engineers", content: "Increasingly asked at SDE-2+ frontend roles at companies like Flipkart, Swiggy, and Razorpay:\n\n'Design the Swiggy order tracking UI' — focuses on WebSocket vs polling tradeoff, optimistic updates, failure handling, reconnection logic.\n\n'Design a Google Docs-style collaborative editor' — OT (Operational Transformation) vs CRDT, WebSocket, conflict resolution.\n\n'Design an infinite scroll feed with search' — client-side state management, debounced search, virtual scrolling, skeleton screens, error boundaries.\n\n'Design a component library' — versioning, design tokens, Storybook, accessibility, tree-shaking.\n\nFrontend system design rubric (what interviewers score):\n1. Component architecture (how you break up the UI)\n2. State management decision (local vs global vs server state)\n3. Network strategy (caching, polling, WebSocket choice)\n4. Performance (bundle size, lazy loading, rendering strategy)\n5. Error handling and edge cases (empty states, loading, failure)" },
      { heading: "Company-Specific Frontend Questions (2026)", content: "Razorpay Frontend SDE:\n• Heavy JavaScript internals — closures, event loop, prototype chain\n• React performance optimisation (profiler, memoisation)\n• CSS animations, GPU compositing\n• System design: design the Razorpay checkout widget (iframe security, postMessage)\n\nSwiggy Frontend SDE:\n• React 18 features (concurrent mode, Suspense, useTransition)\n• Web performance (CLS, LCP, FID — Core Web Vitals)\n• Real-time order tracking implementation\n• 1 coding round: usually array/string manipulation in JS\n\nFlipkart Frontend SDE:\n• TypeScript (strict mode, generics, utility types)\n• Micro-frontend architecture\n• SSR vs CSR vs ISR tradeoffs (they use Next.js)\n• System design: design a product listing page with filters (URL state, pagination, SSR)" },
    ],
    faqs: [
      { question: "What is frontend developer salary in India 2026?", answer: "Frontend developer salary in India 2026: Junior (0–2 yr) ₹6–12 LPA, Mid (2–4 yr) ₹15–28 LPA, Senior (5+ yr) ₹30–55 LPA at product companies. IT service companies pay 40–60% less at all levels." },
      { question: "Do frontend developers need to know DSA in India?", answer: "Yes, for product companies (Flipkart, Swiggy, Razorpay, Meesho). Typically 1–2 DSA rounds of medium difficulty. IT service companies rarely ask DSA. Focus on arrays, strings, recursion, and hashmaps — tree/graph problems are less common for frontend roles." },
      { question: "Is React knowledge enough for frontend interviews in India 2026?", answer: "React is necessary but not sufficient. You also need core JavaScript internals (event loop, closures, prototypes), browser APIs, CSS layout, and web performance. Senior roles additionally require TypeScript, system design, and SSR/rendering strategy knowledge." },
      { question: "How do I prepare for frontend interviews at Flipkart or Razorpay?", answer: "Spend 4 weeks: Week 1 — JavaScript fundamentals (You Don't Know JS, 50 interview questions). Week 2 — React deep dive (hooks internals, reconciliation, RSC). Week 3 — DSA in JavaScript (LeetCode Medium: arrays, strings, trees). Week 4 — System design for UI + company research. Do 3–5 mock interviews with AI feedback." },
    ],
    relatedSlugs: ["system-design-interview-preparation", "java-interview-questions-freshers-india-2026", "salary-negotiation-tips-india"],
    practicePageSlugs: [
      { label: "Flipkart SDE Interview", slug: "flipkart-sde-interview-questions" },
      { label: "Razorpay Engineering Interview", slug: "razorpay-engineering-interview-questions" },
    ],
    cta: "Practice frontend developer interviews on HireStepX — JavaScript, React, and system design rounds with AI voice feedback tailored to your target company.",
  },
  {
    slug: "product-company-vs-service-company-india-career",
    title: "Product Company vs Service Company India — Honest Career Comparison 2026",
    metaDescription: "Honest comparison of product company vs IT service company careers in India for 2026. Covers salary difference, work quality, interview difficulty, promotion speed, and when to switch.",
    company: "General",
    category: "Career",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=500&fit=crop",
    heroAlt: "Two paths diverging representing the choice between product and service company careers in India",
    datePublished: "2026-07-08",
    intro: "The most common career question in Indian tech: should I target a product company (Flipkart, Razorpay, Swiggy) or is a service company (TCS, Infosys, Wipro) a better starting point? The answer depends heavily on your goals, current skills, and risk tolerance. Here's the honest, unfiltered comparison for 2026.",
    sections: [
      { heading: "Salary Difference: The Numbers (2026)", content: "This is the most concrete difference. At the same experience level:\n\nFresher (0–1 year):\n• TCS Ninja: ₹3.36 LPA\n• Infosys: ₹3.6 LPA\n• Wipro: ₹3.5 LPA\n• Flipkart SDE-1: ₹20–25 LPA\n• Razorpay SDE-1: ₹22–28 LPA\n• Swiggy SDE-1: ₹18–24 LPA\n\nMid-level (3–5 years):\n• TCS/Infosys/Wipro Band B–C: ₹8–14 LPA\n• Flipkart SDE-2: ₹35–55 LPA\n• Razorpay SDE-2: ₹38–55 LPA\n\nThe gap widens dramatically at mid-level. A TCS employee at 4 years earning ₹12 LPA can be hired by Flipkart at SDE-1 (not SDE-2) for ₹20–25 LPA — a 60–100% bump, but they reset to junior level.\n\nThe correct calculation: Product company fresher at ₹22 LPA with 4% annual hike compounds to ₹26 LPA at 4 years. Service company fresher at ₹3.5 LPA with 8% annual hike reaches ₹4.8 LPA at 4 years. Lifetime earnings gap by 30: estimated ₹3–5 Crore difference.\n\nCaveat: Product company jobs are harder to get and harder to keep. The 10x salary comes with higher performance expectations and faster attrition." },
      { heading: "Work Quality and Learning", content: "Product companies:\n• Ownership culture — 'you own this feature end to end'\n• Faster feedback loops — your code ships in days, not months\n• Modern tech stack — Kafka, Kubernetes, microservices, React, Go are defaults\n• Architecture decisions are made by your team, not a client\n• Scope to move from SDE to tech lead to architect in 4–5 years if you perform\n\nService companies:\n• Project-assigned — no choice in what you work on\n• Maintenance-heavy — much of the work is supporting legacy systems for client contracts\n• Slower feedback — client approvals, change management windows, test cycles\n• Narrow tech stacks — Java 8, Oracle DB, and client-mandated tools are common\n• Specialization paths available in ERP (SAP), testing, and cloud services\n\nHonest truth: Not all product company work is intellectually stimulating, and not all service work is dull. The average quality gap is real, but outliers exist in both directions.\n\nBest learning environment: A Series B–C funded startup (30–200 engineers) often provides the highest learning rate — you own more, face diverse problems, and have access to senior engineers. Riskier than both, but accelerates growth fastest." },
      { heading: "Interview Difficulty Comparison", content: "Getting in is the key barrier:\n\nIT Service companies (TCS/Infosys/Wipro):\n• Aptitude test + basic coding (1–2 easy problems)\n• HR interview focused on attitude and communication\n• Acceptance rate: 20–40% of applicants at campus\n\nTop product companies (Flipkart/Razorpay/Swiggy):\n• 3–5 rounds of coding (LeetCode Medium–Hard)\n• System design round (SDE-2+)\n• Bar raiser / culture fit round\n• Acceptance rate: 1–5% of applicants\n\nThe interview bar gap is a real barrier — not a myth. Most freshers from non-IIT colleges cannot pass product company coding rounds without 3–6 months of focused DSA preparation. This is where many candidates logically start at a service company and prepare for transitions.\n\nTime required to transition from service to product company: Industry data (2026) suggests candidates who make the switch take an average of 18–24 months of focused preparation after joining a service company, with 3–5 failed attempts before a successful product company offer." },
      { heading: "The 'Start at TCS, Switch to Flipkart' Strategy", content: "This is the most common career path in Indian tech, and when executed well, it works:\n\nYear 1–2 at service company:\n• Complete mandatory bond period\n• Learn professional work fundamentals (communication, deadlines, code reviews)\n• Start LeetCode — target 200 Medium problems in 12 months\n• Build a side project (GitHub-visible)\n• Get 1 promotion to demonstrate growth\n\nYear 2–3 at service company:\n• Aggressively interview at product companies (target 8–12 applications per quarter)\n• Use HireStepX or similar to simulate product company interviews\n• Expect 3–5 rejections before a successful offer\n• Target: SDE-1 at a funded startup or Tier-2 product company first, not Flipkart directly\n\nRisks of this strategy:\n• Skill atrophy — service work doesn't build DSA/system design skills; self-study discipline is required\n• Comfort trap — after 3 years + increment + team familiarity, switching feels risky\n• The 'just one more year' loop — some candidates delay indefinitely\n\nMost important rule: Set a deadline. If you haven't made the switch by Year 3, reassess whether you actually want to." },
      { heading: "When Service Companies Are the Right Choice", content: "Service companies are genuinely the better choice when:\n\n1. You need stability over income — large family dependency, loan commitments, risk aversion. Service companies have lower layoff rates and more predictable careers.\n\n2. You're in a non-engineering specialization — SAP consultants, ERP specialists, and infrastructure engineers often have better career paths in service companies or their clients than in pure product companies.\n\n3. You want international exposure — TCS, Infosys, and Wipro have onsite opportunities in the US, UK, and Europe that product startups rarely offer at junior levels.\n\n4. You're transitioning domains — Service companies allow you to pivot into cloud (AWS/Azure certifications on-job), data engineering, or consulting without starting over.\n\n5. You've exhausted your product company attempts — If you've genuinely prepared for 18 months and cannot pass product company interviews, a service company role is better than unemployment." },
    ],
    faqs: [
      { question: "Is TCS better than Flipkart for career growth?", answer: "For salary and technical growth, Flipkart is significantly better — 5–7x starting salary, modern tech stack, faster promotions. For stability, work-life balance, and international onsite opportunities, TCS has advantages. The right answer depends on your goals and risk tolerance." },
      { question: "Can I join TCS and later switch to a product company?", answer: "Yes — this is the most common career path in Indian tech. The switch takes 18–24 months of focused preparation while employed, targeting SDE-1 roles at Tier-2 product companies first. Most successful switchers do 3–5 interviews before their first product company offer." },
      { question: "What is the salary difference between TCS and Flipkart in India 2026?", answer: "TCS Ninja fresher: ₹3.36 LPA. Flipkart SDE-1 fresher: ₹20–25 LPA. That's a 6–7x difference at the fresher level. At 5 years experience: TCS ₹10–16 LPA vs Flipkart SDE-2 ₹35–55 LPA — the gap widens to 3–4x." },
      { question: "Which is better for work-life balance — product or service company India?", answer: "Service companies generally have better work-life balance — 9-to-6 schedules, limited on-call expectations. Product companies at funded startups often have higher pressure, on-call rotations, and hustle culture. FAANG India offices (Google, Amazon) are somewhere in between — high expectations but structured schedules." },
    ],
    relatedSlugs: ["salary-negotiation-tips-india", "tcs-interview-questions-freshers-2026", "system-design-interview-preparation"],
    practicePageSlugs: [
      { label: "TCS Ninja Interview", slug: "tcs-ninja-interview-questions" },
      { label: "Flipkart SDE Interview", slug: "flipkart-sde-interview-questions" },
      { label: "Razorpay Engineering Interview", slug: "razorpay-engineering-interview-questions" },
    ],
    cta: "Preparing to switch from a service company to a product company? Practice product company DSA + behavioral rounds on HireStepX — AI scoring tailored to what Flipkart and Razorpay actually evaluate.",
  },
  {
    slug: "swiggy-interview-questions-2026",
    title: "Swiggy Interview Questions 2026 — SDE, PM & Analyst Complete Guide",
    metaDescription: "Complete Swiggy interview guide for SDE, PM, and Business Analyst roles in 2026. Covers DSA rounds, system design, product cases, and salary expectations.",
    company: "Swiggy",
    category: "Product Tech",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?w=1200&h=500&fit=crop",
    heroAlt: "Food delivery order representing Swiggy interview preparation",
    datePublished: "2026-07-05",
    intro: "Swiggy is one of India's most coveted employers for SDE and PM roles, offering SDE-1 packages of ₹18–25 LPA and PM roles at ₹28–45 LPA. Their interview bar has risen sharply since 2024 — 3–4 DSA rounds for engineering, plus product case interviews for PM. Here's what to actually expect in 2026.",
    sections: [
      { heading: "Swiggy Hiring Process 2026", content: "SDE hiring process (5 stages):\n1. Resume screening + referral/portal\n2. Online Assessment: 2 coding problems (1 medium + 1 hard), 90 min on HackerRank\n3. Technical Round 1: DSA + code walkthrough (45 min)\n4. Technical Round 2: System design for mid/senior, DSA for SDE-1 (45 min)\n5. Hiring Manager + Bar Raiser round (culture fit + depth questions)\n\nPM hiring process (4 stages):\n1. Resume + cover letter screening\n2. Case study assignment (take-home, 48 hours)\n3. Case study discussion + metric questions (45 min)\n4. Product sense + behavioral round (Director/VP level)\n\nBusiness Analyst process:\n1. Aptitude + SQL test\n2. Case study (operations or business metric problem)\n3. HR round" },
      { heading: "Swiggy SDE Interview — DSA Topics", content: "Based on recent candidate reports (2025–2026), Swiggy DSA rounds focus on:\n\nGraphs (frequently tested):\n• Minimum cost to connect all cities (MST)\n• Find the shortest delivery route between N locations\n• Detect cycles in delivery partner assignment graph\n\nArrays & Sliding Window:\n• Maximum orders per delivery zone in a time window\n• Find peak order hours with sliding window maximum\n\nHashing & Sets:\n• Two-sum variants, group anagrams\n• Track unique customers in a session\n\nTrees:\n• Serialize/deserialize order history tree\n• LCA in delivery zone hierarchy\n\nDP (medium frequency):\n• Optimal pricing with constraints\n• Max profit delivery scheduling\n\nSwiggy-specific angle: Many questions have a delivery/logistics framing — the underlying DSA is standard, but candidates who recognize the mapping (delivery zones = graph, time windows = sliding window) communicate better." },
      { heading: "Swiggy System Design Questions", content: "Common Swiggy system design interview questions (SDE-2+):\n\n'Design Swiggy's real-time order tracking' — Key components: GPS polling interval tradeoff (battery vs freshness), WebSocket vs SSE vs polling, event sourcing for order state machine, push notifications.\n\n'Design the restaurant discovery feed' — Personalization (collaborative filtering vs geo + category filters), ranking algorithm, A/B testing infrastructure, latency budget.\n\n'Design Swiggy Instamart's inventory system' — Dark store inventory management, real-time stock deduction, oversell prevention with Redis distributed locks, eventual consistency for catalog vs strong consistency for stock.\n\n'Design a surge pricing engine' — Demand/supply ratio calculation, real-time pricing updates, anti-gaming protections, revenue impact tracking.\n\nWhat Swiggy values in system design:\n• Handling failure gracefully — what happens when a delivery partner's GPS drops?\n• Horizontal scalability — Swiggy processes 10M+ orders/day; your design should handle that\n• Data freshness vs consistency tradeoffs — especially for inventory and pricing" },
      { heading: "Swiggy PM Interview — Product Cases", content: "Swiggy PM interviews are heavy on metrics and marketplace dynamics:\n\nCommon PM questions:\n• 'DAU dropped 15% last week — diagnose it'\n• 'Design a feature to reduce food delivery cancellations'\n• 'How would you grow Swiggy Instamart in Tier-2 cities?'\n• 'Build a recommendation system for restaurants'\n• 'How should Swiggy respond to Zomato launching a faster delivery tier?'\n\nSwiggy-specific PM framework:\n1. Always define the metric clearly ('DAU: logged in AND placed an order? Or just opened the app?')\n2. Show marketplace thinking — any Swiggy feature affects 3 sides: customers, restaurants, delivery partners\n3. Use real Swiggy product context — Instamart, Dineout, Swiggy One, Genie\n4. Anchor metrics in business context — Swiggy is publicly listed; revenue and take rate matter\n\nThe biggest differentiator: Candidates who can articulate how a feature moves GMV, take rate, or NPS while describing implementation earn significantly better scores." },
      { heading: "Swiggy Salary 2026", content: "Swiggy salary packages for 2026:\n\nSDE-1 (0–3 years): ₹18–25 LPA (base + RSUs)\nSDE-2 (3–6 years): ₹28–42 LPA\nSDE-3 / Staff: ₹48–70 LPA\n\nPM-1 (0–3 years): ₹28–38 LPA\nSPM (3–6 years): ₹42–60 LPA\n\nBusiness Analyst (0–3 years): ₹12–18 LPA\nSenior BA: ₹18–25 LPA\n\nEquity: RSUs vest over 4 years (1-year cliff). As a publicly listed company, RSUs have liquidity at vest. Annual refreshes for strong performers.\n\nSwiggy has significantly increased compensation since the 2023–2024 layoff cycle — the current packages are competitive with Razorpay and Meesho at the SDE-2 level." },
    ],
    faqs: [
      { question: "Is Swiggy SDE interview hard?", answer: "Moderately hard — harder than IT service companies, comparable to Meesho and Zomato, slightly easier than Flipkart and Razorpay. The online assessment is the biggest filter. 1–2 hard LeetCode-equivalent problems in 90 min." },
      { question: "What is Swiggy SDE-1 salary in India 2026?", answer: "Swiggy SDE-1 salary in India 2026 is ₹18–25 LPA including base and RSUs. The RSU component has grown post-IPO since Swiggy listed on NSE/BSE." },
      { question: "Does Swiggy have system design rounds for SDE-1?", answer: "For SDE-1, system design is often a 'design a small feature' question rather than a full distributed system design. Full system design rounds start at SDE-2." },
      { question: "How to prepare for Swiggy product manager interview?", answer: "Focus on: (1) deep Swiggy product knowledge — use all their products for 2 weeks, (2) marketplace metrics (GMV, take rate, NPS, cancellation rate), (3) case framework with 3-sided marketplace thinking, and (4) 2–3 data-driven hypotheses per question." },
    ],
    relatedSlugs: ["zomato-product-manager-interview-2026", "system-design-interview-preparation", "product-manager-interview-questions-india"],
    practicePageSlugs: [
      { label: "Swiggy Engineering Interview", slug: "swiggy-engineering-interview-questions" },
      { label: "Swiggy PM Interview", slug: "swiggy-pm-interview-questions" },
    ],
    cta: "Practice Swiggy SDE and PM interviews on HireStepX — AI feedback on DSA explanations, system design structure, and product case reasoning.",
  },
  {
    slug: "microsoft-india-interview-questions-2026",
    title: "Microsoft India Interview Questions 2026 — SDE, Program Manager & More",
    metaDescription: "Complete Microsoft India interview guide for 2026. Covers the technical phone screen, virtual onsite rounds, behavioral STAR questions, and salary for SDE-1 to SDE-2 roles in Hyderabad and Bengaluru.",
    company: "Microsoft",
    category: "FAANG",
    readTime: "11 min",
    heroImage: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1200&h=500&fit=crop",
    heroAlt: "Developer at a computer representing Microsoft India interview preparation",
    datePublished: "2026-07-08",
    intro: "Microsoft India (Hyderabad and Bengaluru) is one of the most coveted tech employers in India — offering SDE-1 packages of ₹25–40 LPA and a reputation for strong engineering culture without the extreme pressure of some other FAANG companies. Their interview style is distinct: they value collaborative problem-solving and 'growth mindset' over raw algorithmic speed. Here's the complete 2026 guide.",
    sections: [
      { heading: "Microsoft India Interview Process 2026", content: "The Microsoft India SDE hiring pipeline typically has 4–5 stages:\n\nStage 1 — Resume Screen / Referral\nMicrosoft receives thousands of applications; a referral significantly increases resume visibility. HR screen focuses on relevant experience and project quality.\n\nStage 2 — Online Assessment (HackerRank, 90 min)\n2–3 coding problems: 1 easy + 1 medium + 1 medium-hard. Microsoft OA is less brutal than Google's but still filters ~70% of applicants.\n\nStage 3 — Technical Phone Screen (45 min)\n1 interviewer, 1–2 coding problems (whiteboard-style). Also includes a brief 'tell me about a project you're proud of' to warm up.\n\nStage 4 — Virtual Onsite (4 rounds, same day)\n• Round 1: Coding (1–2 medium DSA problems)\n• Round 2: Coding + systems thinking\n• Round 3: Behavioral (STAR format, growth mindset questions)\n• Round 4: 'As Appropriate' (AA) — a senior engineer who assesses hiring bar consistency\n\nNote: The 'As Appropriate' interviewer can be a gate-keeper or a promoter. They look for candidates who are 'smart and gets things done' but also collaborative and teachable." },
      { heading: "Microsoft India DSA — What They Actually Ask", content: "Microsoft DSA interview questions lean toward clarity of approach over exotic algorithms. They want to see you think out loud, ask clarifying questions, and structure your solution before coding.\n\nFrequently tested topics at Microsoft India:\n\nLinked Lists (very common):\n• Reverse a linked list (warm-up, always asked)\n• Detect and remove cycle in linked list\n• Merge two sorted linked lists\n• Add two numbers represented as linked lists\n\nTrees and Binary Search:\n• Lowest Common Ancestor\n• Level-order traversal\n• Validate BST\n• Diameter of a binary tree\n\nDynamic Programming:\n• Coin change\n• Longest palindromic substring\n• Edit distance\n• House robber variants\n\nGraphs:\n• Number of islands (BFS/DFS)\n• Word ladder\n• Course schedule (topological sort)\n\nDesign Questions (Round 2):\n• Design a LRU cache\n• Design a rate limiter\n• Design a task scheduler\n\nMicrosoft interview style tip: They expect you to drive the solution. After you start, they may ask 'can you make this faster?' or 'what if the input is very large?' — this is normal and expected, not a sign you got it wrong." },
      { heading: "Microsoft Growth Mindset — Behavioral Questions", content: "Microsoft's behavioral framework is built around Satya Nadella's 'growth mindset' concept. Their behavioral questions explicitly test this:\n\nCore behavioral questions at Microsoft India:\n\n'Tell me about a time you had to learn something quickly under pressure.'\nModel answer: emphasize the learning process, not just the result. Show curiosity, specific resources used, and how you applied what you learned.\n\n'Describe a situation where you received critical feedback. How did you respond?'\nMicrosoft values self-awareness. A great answer: you received the feedback, understood why it was valid, changed your behavior, and can measure the improvement.\n\n'Tell me about a time you helped a teammate grow.'\nCollaboration is explicitly scored at Microsoft. Show concrete mentorship, not just 'I helped out.'\n\n'Describe a project you're most proud of. What would you do differently?'\nThe 'what would you do differently' part is essential — it demonstrates growth mindset. Candidates who say 'I wouldn't change anything' consistently score lower.\n\n'Tell me about a time you had to build consensus across teams with conflicting priorities.'\nFor senior roles especially, this is about showing you can operate without formal authority." },
      { heading: "Microsoft India Program Manager (PM) Role", content: "Microsoft India has a unique 'Program Manager' (PM) track — distinct from Product Manager. Microsoft PMs are technical project leads who bridge engineering and product strategy. This role is highly sought-after on campus.\n\nMicrosoft PM interview focuses on:\n1. Technical depth — PMs at Microsoft need to understand the code-level feasibility of what they spec\n2. Cross-team influence — working with engineering, design, and business stakeholders\n3. Customer-first thinking — customer empathy is a core Microsoft value\n4. Analytical skills — using data to justify prioritisation\n\nCommon Microsoft PM questions:\n• 'If you had to improve Microsoft Teams, what would you build first?'\n• 'How would you measure the success of a new feature in Azure?'\n• 'Design a feature for a product you use daily — from customer pain to ship plan'\n• 'How do you prioritize when three teams want the same engineering resource?'" },
      { heading: "Microsoft India Salary 2026", content: "Microsoft India compensation packages (Hyderabad / Bengaluru):\n\nSDE-1 (Fresher/0–2 yr): ₹25–38 LPA (base + joining bonus + stocks)\nSDE-2 (2–5 yr): ₹38–60 LPA\nSDE-3 / Principal (5–8 yr): ₹60–90 LPA\nSenior Principal / Principal Manager: ₹90–140 LPA\n\nProgram Manager (PM-1, Campus): ₹22–28 LPA\nProgram Manager (PM-2): ₹32–48 LPA\n\nMicrosoft stock (RSUs) vest quarterly over 4 years with a 1-year cliff. Annual refreshes range from 20–100% of base depending on performance band.\n\nBenefits: full family medical insurance, gym reimbursement, learning budget (₹50k/year), and onsite visa sponsorship for high performers is common after 2–3 years." },
    ],
    faqs: [
      { question: "Is Microsoft India interview hard?", answer: "Moderately hard — significantly harder than IT service companies, slightly easier than Google India. The online assessment and phone screen filter most candidates. The onsite (virtual) is challenging but collaborative — Microsoft interviewers help you if you're stuck, unlike some other FAANG companies." },
      { question: "What is Microsoft SDE-1 salary in India 2026?", answer: "Microsoft SDE-1 salary in India 2026 is ₹25–38 LPA including base, joining bonus, and RSUs. Hyderabad and Bengaluru pay similarly." },
      { question: "Does Microsoft India hire freshers from non-IIT colleges?", answer: "Yes — Microsoft actively recruits from Tier-1 colleges (IITs, NITs, BITs Pilani) on campus, and accepts off-campus applications from all colleges. Strong GitHub profile + competitive programming experience significantly helps non-IIT candidates." },
      { question: "What is the Microsoft 'As Appropriate' interviewer?", answer: "The 'As Appropriate' (AA) interviewer is a senior Microsoft engineer who participates in every final-round loop to calibrate the hiring bar. They can advocate strongly for or against a candidate. Treat them as the most important round — they carry significant weight in the hiring decision." },
    ],
    relatedSlugs: ["top-10-google-interview-questions", "system-design-interview-preparation", "behavioral-interview-questions-freshers"],
    practicePageSlugs: [
      { label: "Microsoft Engineering Interview", slug: "microsoft-india-sde-interview-questions" },
    ],
    cta: "Practice Microsoft India SDE and behavioral rounds on HireStepX — AI scoring on DSA approach, growth mindset answers, and system design clarity.",
  },
  {
    slug: "sql-interview-questions-freshers-india-2026",
    title: "SQL Interview Questions for Freshers India 2026 — Top 50 Q&A",
    metaDescription: "Top 50 SQL interview questions for freshers in India 2026. Covers SELECT queries, JOINs, GROUP BY, subqueries, window functions, indexes, and common HR/analyst interview questions.",
    company: "General",
    category: "Technical",
    readTime: "12 min",
    heroImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&h=500&fit=crop",
    heroAlt: "Database tables and SQL query visualization for interview preparation",
    datePublished: "2026-07-10",
    intro: "SQL is the most-asked technical subject across ALL Indian job categories: data analyst roles, software engineer interviews, BA positions, and even MNC service company aptitude tests. Nearly every technical interview in India tests SQL — and yet most candidates only prepare for 5–6 basic questions. This guide covers the 50 questions that actually come up, from ₹3.5 LPA IT service jobs to ₹30 LPA data engineering roles.",
    sections: [
      { heading: "SQL Basics — What Every Fresher Must Know", content: "1. What is SQL and what are its sublanguages?\nSQL = Structured Query Language. Four sublanguages:\n• DDL (Data Definition Language): CREATE, ALTER, DROP, TRUNCATE — defines schema\n• DML (Data Manipulation Language): SELECT, INSERT, UPDATE, DELETE — manipulates data\n• DCL (Data Control Language): GRANT, REVOKE — controls access\n• TCL (Transaction Control Language): COMMIT, ROLLBACK, SAVEPOINT — manages transactions\n\n2. What is the difference between WHERE and HAVING?\nWHERE filters rows BEFORE aggregation. HAVING filters rows AFTER aggregation.\nExample: SELECT department, COUNT(*) FROM employees WHERE salary > 50000 GROUP BY department HAVING COUNT(*) > 5;\nHere WHERE removes employees with salary ≤ 50000 before grouping, then HAVING removes departments with ≤5 employees.\n\n3. What is the difference between DELETE, TRUNCATE, and DROP?\nDELETE: removes specific rows, can be rolled back, triggers fire, WHERE clause supported.\nTRUNCATE: removes all rows, faster than DELETE, cannot be rolled back in most databases, no triggers.\nDROP: removes the entire table (structure + data), cannot be rolled back.\n\n4. What is a primary key vs a foreign key?\nPrimary key: uniquely identifies each row in a table. Cannot be NULL. Only one per table.\nForeign key: references the primary key of another table. Enforces referential integrity. A table can have multiple foreign keys.\n\n5. What is the difference between CHAR and VARCHAR?\nCHAR(n): fixed length, always stores n characters (pads with spaces). VARCHAR(n): variable length, stores only what's needed + 1–2 bytes overhead. Use CHAR for fixed-length data (country codes, postal codes). Use VARCHAR for variable-length data (names, addresses)." },
      { heading: "JOINs — The Most-Asked SQL Topic", content: "6. What are the types of JOINs?\nINNER JOIN: returns rows where there is a match in BOTH tables.\nLEFT JOIN (LEFT OUTER JOIN): returns all rows from the left table + matching rows from the right. NULLs where no match.\nRIGHT JOIN: opposite of LEFT JOIN.\nFULL OUTER JOIN: returns all rows from both tables. NULLs where no match on either side.\nCROSS JOIN: every row from table A × every row from table B (Cartesian product).\nSELF JOIN: joins a table to itself — used for hierarchical data (employees and their managers).\n\n7. Write a query to find employees who have NO department.\nSELECT e.employee_id, e.name\nFROM employees e\nLEFT JOIN departments d ON e.department_id = d.department_id\nWHERE d.department_id IS NULL;\nThe LEFT JOIN includes all employees; WHERE d.department_id IS NULL keeps only those with no matching department.\n\n8. Write a query to find the second highest salary.\nSELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);\nOR using LIMIT/OFFSET: SELECT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;\nOR using window functions: SELECT DISTINCT salary FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) as rnk FROM employees) t WHERE rnk = 2;\n\n9. What is the difference between UNION and UNION ALL?\nUNION: combines result sets, removes duplicates (slower — requires sorting/hashing).\nUNION ALL: combines result sets, keeps all duplicates (faster). Use UNION ALL unless you need deduplication.\n\n10. Write a query to find duplicate records.\nSELECT email, COUNT(*) as count FROM users GROUP BY email HAVING COUNT(*) > 1;\nTo delete duplicates, keep the one with the lowest ID:\nDELETE FROM users WHERE id NOT IN (SELECT MIN(id) FROM users GROUP BY email);" },
      { heading: "GROUP BY, Aggregations & Subqueries", content: "11. What is GROUP BY and how does it work?\nGROUP BY collapses multiple rows with the same value in the specified column into a single row. Must be used with aggregate functions (COUNT, SUM, AVG, MAX, MIN). Every column in SELECT must either be in GROUP BY or wrapped in an aggregate function.\n\n12. Write a query to find the department with the highest average salary.\nSELECT department_id, AVG(salary) as avg_salary\nFROM employees\nGROUP BY department_id\nORDER BY avg_salary DESC\nLIMIT 1;\n\n13. What is a subquery vs a CTE?\nSubquery: a query nested inside another query. Can be in SELECT, FROM, or WHERE.\nCTE (Common Table Expression): a named temporary result set defined with WITH clause. More readable for complex queries, can be referenced multiple times, and supports recursion.\nWhen to use CTE over subquery: when the logic is complex, repeated, or recursive (tree/hierarchy queries).\n\n14. Write a query using EXISTS.\nSELECT customer_id, name FROM customers c\nWHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status = 'completed');\nEXISTS is often faster than IN for large datasets because it short-circuits as soon as a match is found." },
      { heading: "Window Functions — The Advanced Level", content: "Window functions are asked at data analyst, SDE-2+, and senior BA interviews:\n\n15. What are window functions?\nWindow functions perform calculations across a 'window' of rows related to the current row, WITHOUT collapsing rows like GROUP BY does.\nSyntax: FUNCTION() OVER (PARTITION BY column ORDER BY column ROWS/RANGE...)\n\n16. Explain ROW_NUMBER, RANK, and DENSE_RANK.\nROW_NUMBER(): assigns unique sequential number (1,2,3,4,5) — no ties.\nRANK(): assigns rank with gaps for ties (1,1,3,4,5 if two rows tie for 1st).\nDENSE_RANK(): assigns rank without gaps (1,1,2,3,4 if two rows tie for 1st).\n\n17. Write a query to find the top 3 salaries per department.\nSELECT department_id, employee_id, salary\nFROM (\n  SELECT department_id, employee_id, salary,\n    DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) as rnk\n  FROM employees\n) ranked\nWHERE rnk <= 3;\n\n18. What is LAG and LEAD?\nLAG(column, n): returns the value from n rows BEFORE the current row.\nLEAD(column, n): returns the value from n rows AFTER the current row.\nUse case: calculate day-over-day order growth: LEAD(orders) - orders." },
      { heading: "Indexes and Performance", content: "19. What is a database index and why use it?\nAn index is a data structure (typically B-tree) that speeds up data retrieval by creating a sorted pointer to rows. Without an index, a query scans all rows (full table scan). With an index, it jumps directly to matching rows.\n\nWhen to create an index:\n• Columns used frequently in WHERE, JOIN, or ORDER BY clauses\n• Columns with high cardinality (many distinct values)\n\nWhen NOT to index:\n• Columns that are rarely queried\n• Tables that are written to more than read (indexes slow down INSERT/UPDATE/DELETE)\n• Small tables where a full scan is faster than index lookup\n\n20. What is the difference between clustered and non-clustered index?\nClustered index: the actual table data is stored in the index order. Only one per table (typically the primary key).\nNon-clustered index: a separate structure with pointers to the table rows. Multiple per table allowed.\n\n21. What is EXPLAIN / EXPLAIN ANALYZE?\nEXPLAIN shows the query execution plan — how the database engine will execute the query: which indexes it will use, estimated row counts, join strategy. Essential for query optimization. Add ANALYZE (or EXPLAIN ANALYZE) to get actual execution statistics." },
    ],
    faqs: [
      { question: "Is SQL necessary for software engineer interviews in India?", answer: "Yes — SQL is asked at most Indian tech companies for SDE roles, including TCS, Infosys, Wipro, and product companies. Product company SDE interviews typically include 1 SQL round for backend/data roles. It's mandatory for Data Analyst and Business Analyst interviews everywhere." },
      { question: "What SQL topics are most asked in TCS/Infosys interviews?", answer: "TCS and Infosys typically ask: basic SELECT queries, JOINs (especially INNER and LEFT JOIN), GROUP BY + HAVING, subqueries, finding nth highest salary, and duplicate detection. Window functions are rarely asked at service companies but are standard at product companies." },
      { question: "What is the difference between SQL and NoSQL for interview purposes?", answer: "SQL databases (MySQL, PostgreSQL, Oracle): structured data, ACID compliance, JOINs, schema-enforced. NoSQL (MongoDB, Cassandra, DynamoDB): flexible schema, horizontal scaling, eventual consistency, no JOINs. Most Indian tech interviews focus on SQL; NoSQL questions appear in senior SDE and data engineering rounds." },
      { question: "Do freshers need to know window functions for SQL interviews?", answer: "For service IT companies (TCS, Infosys, Wipro): no, window functions are rarely asked. For product companies (Flipkart, Swiggy, Razorpay) data analyst or SDE-data roles: yes, ROW_NUMBER, RANK, LAG/LEAD are commonly asked. For senior SDE roles at any company: yes." },
    ],
    relatedSlugs: ["data-analyst-interview-questions-india-2026", "java-interview-questions-freshers-india-2026", "python-interview-questions-freshers-india-2026"],
    practicePageSlugs: [
      { label: "TCS Digital Interview", slug: "tcs-digital-interview-questions" },
      { label: "Infosys Power Programmer", slug: "infosys-power-programmer-interview" },
    ],
    cta: "Practice SQL interview questions with HireStepX — explain your query approach out loud and get AI feedback on logic, optimization, and communication clarity.",
  },
  {
    slug: "python-developer-salary-india-2026",
    title: "Python Developer Salary India 2026 — Fresher to Senior Complete Guide",
    metaDescription: "Python developer salary in India 2026: ₹3.5 LPA fresher to ₹35 LPA senior. City-wise breakdown for Bangalore, Mumbai, Pune, Hyderabad. What to negotiate.",
    company: "Industry",
    category: "Salary Guide",
    readTime: "7 min",
    heroImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=500&fit=crop",
    heroAlt: "Python code on a laptop screen representing Python developer careers in India",
    datePublished: "2026-07-13",
    intro: "Python has become the most in-demand programming language in India's tech sector, driven by AI/ML adoption, data engineering roles, and backend development at scale. In 2026, Indian companies are offering significantly higher packages to Python developers compared to three years ago — but salaries vary dramatically by experience, city, company type, and specialisation.",
    sections: [
      { heading: "Python Developer Salary by Experience Level (2026)", content: "Fresher (0–1 year): ₹3.5–6 LPA at service companies, ₹6–10 LPA at product startups. Junior (1–3 years): ₹7–14 LPA. Mid-level (3–6 years): ₹14–25 LPA. Senior (6+ years): ₹25–45 LPA. Staff/Principal: ₹45–80 LPA at FAANG India offices.\n\nThe gap between service-sector and product-sector salaries is widest at the mid-senior level — a 3-year Python developer at TCS or Infosys earns ₹10–15 LPA, while the same profile at Flipkart, PhonePe, or Razorpay earns ₹20–28 LPA." },
      { heading: "City-wise Python Salary Breakdown", content: "Bangalore leads with the highest Python salaries — expect 15–20% premium over national average for equivalent roles. Hyderabad has emerged as the second hub, especially for data engineering and ML roles at Amazon, Microsoft, and Google. Pune offers 10–15% less than Bangalore but has strong mid-tier product companies. Mumbai pays competitively for fintech Python roles (Razorpay, PhonePe, CRED). Chennai and Delhi NCR are catching up, especially for IT service companies and startups.\n\nRemote-first roles in 2026 often pay Bangalore-equivalent salaries regardless of location." },
      { heading: "Python Specialisation and Its Salary Impact", content: "The role matters as much as the language. Data Engineering (PySpark, Airflow, dbt) commands the highest premium — ₹5–8 LPA above pure backend Python roles at every experience level. ML Engineering (PyTorch, scikit-learn, MLOps) is close behind. Backend/API development (FastAPI, Django, Flask) is the most common and most competitive track. DevOps/automation Python roles pay slightly below backend.\n\nThe clearest path to salary acceleration in 2026: pick Python for ML/data engineering, earn AWS or GCP certification, and target product-led companies." },
      { heading: "Python Salaries by Company Type", content: "FAANG India (Google, Amazon, Microsoft, Meta): ₹20–60 LPA depending on level, plus RSUs that can double total compensation. Unicorn startups (Razorpay, PhonePe, CRED, Meesho): ₹15–40 LPA, heavy equity component. Mid-size product companies (Freshworks, Zoho, Postman, Browserstack): ₹12–30 LPA, more stable equity. IT service companies (TCS, Infosys, Wipro, HCL, Cognizant): ₹4–18 LPA, highest hiring volume. Consulting firms (Deloitte, Accenture, McKinsey tech): ₹8–22 LPA." },
      { heading: "How to Negotiate Your Python Developer Salary", content: "Research before the offer: use Glassdoor, Levels.fyi, and recent interview reports for that exact company and role level. In India, salary is heavily anchored to your current CTC — start by deflecting the question ('I'm looking for market rate for this role') until an offer is on the table.\n\nHighlight cloud certifications (AWS, GCP), open-source contributions on GitHub, or ML/data projects with real business impact. If the base is non-negotiable, push for signing bonus, WFH allowance, accelerated review cycle, or additional ESOP grants. Counter offers work — 60–70% of initial offers in Indian product companies have room to move up by 10–20%." },
      { heading: "Python Interview Topics That Impact Your Offer Level", content: "The interview round determines the offer band. Senior-band offers go to candidates who demonstrate systems thinking — not just syntax. Key topics: OOP and design patterns in Python, async programming (asyncio, aiohttp), database optimization (SQLAlchemy, query optimization), REST API design, and at least one domain specialisation (ML pipelines, data streaming, or distributed systems). For data roles, add Pandas, PySpark, and SQL window functions.\n\nPractising with voice AI mock interviews that score your answer structure helps you move from junior-band to mid-senior band offers." },
    ],
    faqs: [
      { question: "What is the average Python developer salary in India in 2026?", answer: "The average Python developer salary in India in 2026 is approximately ₹9–12 LPA across all experience levels. Freshers start at ₹3.5–6 LPA at IT service companies and ₹6–10 LPA at product startups. Senior developers with 6+ years earn ₹25–45 LPA at top product companies." },
      { question: "Which city pays the highest salary for Python developers in India?", answer: "Bangalore pays the highest Python developer salaries in India — typically 15–20% above the national average for equivalent roles. Hyderabad has emerged as the second-highest paying city, especially for data engineering and ML roles at MNCs like Amazon, Microsoft, and Google." },
      { question: "Is Python a good career in India in 2026?", answer: "Yes. Python is the most in-demand language in India in 2026, driven by AI/ML adoption, data engineering, and backend development. The supply of Python developers has grown, but specialized Python (ML engineering, data engineering) still commands strong salary premiums." },
      { question: "How much does a fresher Python developer earn in India?", answer: "A fresher Python developer in India earns ₹3.5–6 LPA at IT service companies (TCS, Infosys, Wipro) and ₹6–10 LPA at product startups. Candidates with strong Python projects, internships at product companies, or ML/data specialisations can negotiate toward the higher end." },
    ],
    relatedSlugs: ["python-interview-questions-freshers-india-2026", "software-engineer-interview-checklist-2026", "data-analyst-interview-questions-india-2026"],
    practicePageSlugs: [
      { label: "Freshworks SDE Interview Practice", slug: "freshworks-sde-interview-questions" },
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
    ],
    cta: "Preparing for a Python developer role? Practice technical interviews on HireStepX — voice AI scores your answer clarity, depth, and communication.",
  },
  {
    slug: "data-analyst-salary-india-2026",
    title: "Data Analyst Salary India 2026 — Entry Level to Senior, City-wise Guide",
    metaDescription: "Data analyst salary India 2026: ₹3–5 LPA fresher to ₹20–30 LPA senior. Breakdown by city (Bangalore, Mumbai, Hyderabad), company type, and skills that boost your package.",
    company: "Industry",
    category: "Salary Guide",
    readTime: "6 min",
    heroImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=500&fit=crop",
    heroAlt: "Data analytics dashboard on a monitor representing data analyst careers in India",
    datePublished: "2026-07-13",
    intro: "Data analyst roles in India have evolved dramatically. In 2026, companies expect analysts to go beyond Excel and dashboards — SQL mastery, Python scripting, cloud data warehouses (BigQuery, Redshift, Snowflake), and business storytelling are now baseline requirements. Salaries have risen accordingly, especially at fintech and e-commerce companies.",
    sections: [
      { heading: "Data Analyst Salary by Experience (India 2026)", content: "Entry Level (0–1 year): ₹3–6 LPA. Junior Analyst (1–3 years): ₹6–12 LPA. Mid-level (3–6 years): ₹12–22 LPA. Senior Analyst (6+ years): ₹22–35 LPA. Analytics Lead/Manager: ₹30–50 LPA.\n\nThe jump from junior to mid-level is where specialisation matters most — analysts who can write complex SQL, use dbt, and build self-serve dashboards in Looker or Metabase earn 30–40% more than those limited to Excel/Google Sheets." },
      { heading: "City-wise Data Analyst Salary Breakdown 2026", content: "Bangalore: Highest paying, especially at fintech (Razorpay, Groww, CRED) and e-commerce (Flipkart, Meesho). Expect 20–25% above national average. Hyderabad: Strong demand at Amazon, Microsoft, and IT service companies — 10–15% above average. Mumbai: Fintech and BFSI (banking/finance) dominate — PhonePe, Paytm, Goldman Sachs India pay market-leading rates. Pune: Good for IT service company analytics roles, slightly below Bangalore. Delhi NCR: Government analytics, consulting firms (Deloitte, McKinsey), and MNC data teams." },
      { heading: "Skills That Significantly Boost Data Analyst Salary", content: "SQL mastery (window functions, CTEs, performance optimization): +20–30% over basic SQL users. Python for data analysis (Pandas, NumPy, statistical modeling): +15–25%. BI tools (Tableau, Power BI, Looker): +10–15%. Cloud data warehouses (BigQuery, Snowflake, Redshift): +20–30%. A/B testing and experimentation design: highly valued at product companies.\n\nIn 2026, analysts who can write Python, query cloud warehouses, and build Looker dashboards are competing for the same roles as junior data engineers." },
      { heading: "Data Analyst vs Data Engineer vs Data Scientist Salary", content: "Data Analyst (SQL, BI, business insights): ₹3–30 LPA. Data Engineer (pipelines, PySpark, cloud): ₹8–45 LPA — higher ceiling. Data Scientist (ML, statistics, modeling): ₹8–40 LPA — similar ceiling, different skills.\n\nIn Indian product companies, data engineers earn 20–30% more than equivalent-level analysts. Analysts who upskill toward data engineering or ML engineering typically see salary acceleration without switching roles entirely." },
      { heading: "How to Get a Data Analyst Job in India 2026", content: "Build a portfolio with 2–3 projects using real datasets (Kaggle, government data, personal projects). SQL is the single most tested skill in analyst interviews — practice advanced queries including window functions, subqueries, and performance tuning. Most interviews include a case study where you must interpret data and recommend a business decision.\n\nPractising this format with AI mock interviews helps significantly — the scoring shows where your analysis reasoning is weak before you face a real interviewer." },
    ],
    faqs: [
      { question: "What is the average data analyst salary in India in 2026?", answer: "The average data analyst salary in India in 2026 is ₹7–10 LPA across all experience levels. Entry-level analysts at IT service companies start at ₹3–5 LPA, while mid-level analysts at product companies like Flipkart, Razorpay, or Swiggy earn ₹14–22 LPA." },
      { question: "Is data analyst a good career in India in 2026?", answer: "Yes, but with a caveat: pure Excel-and-dashboard analysts are being commoditised. Data analysts who can write SQL, use Python, and work with cloud data warehouses are in very high demand and earning significantly more. The career is excellent if you invest in technical skills." },
      { question: "Which companies pay the most for data analysts in India?", answer: "FAANG India offices (Google, Amazon, Meta) pay the highest — ₹18–35 LPA for mid-level roles. Indian unicorns (Razorpay, CRED, PhonePe, Groww) pay ₹14–28 LPA. IT service companies (TCS, Infosys, Wipro) pay ₹5–15 LPA for comparable experience." },
    ],
    relatedSlugs: ["data-analyst-interview-questions-india-2026", "python-developer-salary-india-2026", "python-interview-questions-freshers-india-2026"],
    practicePageSlugs: [
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
      { label: "PhonePe Engineering Interview Practice", slug: "phonepe-engineering-interview-questions" },
    ],
    cta: "Practice data analyst interviews on HireStepX — SQL case studies, business analysis questions, and stakeholder communication scored by AI.",
  },
  {
    slug: "how-to-crack-tcs-ion-nqt-2026",
    title: "How to Crack TCS iON NQT 2026 — Complete Strategy, Pattern & Cutoff",
    metaDescription: "Crack TCS iON NQT 2026: full exam pattern, section-wise strategy, qualifying cutoffs, and what happens after. 50,000+ students take this every year — here's how to be in the top 20%.",
    company: "TCS",
    category: "Campus Placement",
    readTime: "8 min",
    heroImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=500&fit=crop",
    heroAlt: "Students preparing for a competitive exam representing TCS NQT preparation",
    datePublished: "2026-07-13",
    intro: "The TCS iON National Qualifier Test (NQT) is the gateway exam for TCS's largest hiring programs — TCS Ninja (off-campus freshers) and TCS Digital. In 2026, over 50,000 students attempt the NQT each hiring cycle, with TCS using it to shortlist candidates before the technical and HR interview rounds. Cracking the NQT is the first and most important step in landing a TCS offer.",
    sections: [
      { heading: "TCS NQT 2026 Exam Pattern and Sections", content: "The TCS iON NQT has four mandatory sections:\n\n(1) Verbal Ability — 24 questions in 30 minutes: reading comprehension, vocabulary, error spotting, sentence completion.\n(2) Reasoning Ability — 30 questions in 50 minutes: logical reasoning, blood relations, seating arrangement, coding/decoding.\n(3) Numerical Ability — 26 questions in 40 minutes: arithmetic, number systems, time-speed-distance, profit-loss, data interpretation.\n(4) Programming Logic — 10 questions in 15 minutes: flowcharts, pseudocode, basic algorithm questions.\n\nTCS Digital additionally requires a Coding section: 2 programming problems in 45 minutes (medium difficulty, any language)." },
      { heading: "Section-wise Strategy to Score 70%+", content: "Verbal Ability: Focus on reading comprehension first (3–4 questions per passage, highest ROI). Practice vocabulary from the Hindu newspaper editorial. Target 18/24.\n\nReasoning: The most time-consuming section. Practice seating arrangements and blood relations offline — these have fixed pattern types that become easy with repetition. Target 22/30.\n\nNumerical: Don't attempt all — focus on arithmetic (20 questions) and skip complex DI if time is short. Calculator shortcuts for percentage and ratio save 30+ seconds per question. Target 18/26.\n\nProgramming Logic: Read the flowchart carefully, trace the code manually on paper, don't guess. This section has negative marking. Target 8/10.\n\nCombined target: 66/100 for Ninja, 75/100 for Digital." },
      { heading: "What Score Do You Need to Clear TCS NQT 2026?", content: "TCS NQT cutoff varies by batch and hiring volume but historical trends show:\n\nTCS Ninja: 55–65% overall with no section cutoffs officially announced (but very low scores in one section can disqualify).\nTCS Digital: 70–78% overall, coding section performance weighted heavily.\nTCS Smart Hiring (lateral): 60–70%.\n\nThe safe target is always 70%+ across all sections — this puts you comfortably above most cutoffs and improves your placement in the interview queue. Scores are valid for 2 years from the test date." },
      { heading: "30-Day NQT Preparation Plan", content: "Week 1: Assess your baseline — take a full mock NQT on IndiaBIX or PrepInsta. Identify your weakest section. Days 1–7: 1 hour verbal, 1 hour reasoning daily.\n\nWeek 2: Switch focus to numerical ability. Learn all arithmetic shortcuts (% tricks, ratio/proportion shortcuts). Days 8–14: 1 hour numerical, 30 min programming logic daily.\n\nWeek 3: Full mock tests every alternate day. Review mistakes — pattern recognition is more valuable than reviewing theory. Days 15–21: 2 mock tests per week, rest on revision days.\n\nWeek 4: Focus on your weakest section exclusively for the first 4 days, then take 2 full mocks back-to-back on days 27–28 to simulate real exam stress. Day 30: Rest." },
      { heading: "After Clearing NQT — The Interview Process", content: "Students who clear the NQT are called for TR (Technical Round) and HR Round interviews. The Technical Round tests your OOPs fundamentals, one programming language (C/C++/Java/Python), basic data structures, DBMS queries, and OS concepts. One coding problem on paper or screen is typically asked — simple to medium difficulty.\n\nThe HR Round is almost entirely qualifying — be ready with introduce yourself, strengths/weaknesses, why TCS, and location flexibility. Prepare STAR-method answers for all behavioral questions. Practising the full technical + HR round with AI mock interviews before the actual round increases offer conversion significantly." },
    ],
    faqs: [
      { question: "What is the TCS NQT cutoff for 2026?", answer: "The TCS NQT 2026 cutoff is approximately 55–65% for TCS Ninja and 70–78% for TCS Digital. Cutoffs vary by batch size and candidate pool. Scoring 70%+ puts you safely above most cutoffs and in a strong position for the interview rounds." },
      { question: "Can I retake the TCS NQT if I don't clear it?", answer: "Yes. The TCS iON NQT can be retaken after a 3-month waiting period. Scores are valid for 2 years. TCS accepts the best score if you take it multiple times. Many candidates retake it after targeted preparation and improve their score by 15–20%." },
      { question: "Is TCS NQT hard for freshers?", answer: "The NQT is moderate difficulty for candidates who prepare for 3–4 weeks. The reasoning and numerical sections are the most challenging. With proper mock test practice, most engineering graduates can score 65%+ on their first attempt." },
      { question: "What programming language should I use for TCS NQT coding section?", answer: "Python is recommended for the TCS NQT coding section due to its concise syntax and built-in data structures. Java and C++ are also accepted. The same logic in Python takes 40% fewer lines than in C." },
    ],
    relatedSlugs: ["tcs-interview-questions-freshers-2026", "campus-placement-interview-tips", "java-interview-questions-freshers-india-2026"],
    practicePageSlugs: [
      { label: "TCS Ninja Interview Practice", slug: "tcs-ninja-interview-questions" },
      { label: "TCS HR Round Practice", slug: "tcs-hr-round-questions" },
      { label: "TCS Behavioral Interview Practice", slug: "tcs-behavioral-interview-questions" },
    ],
    cta: "Practice TCS technical and HR rounds on HireStepX — voice AI interviews with scored STAR feedback, tailored to TCS's actual interview rubric.",
  },
  {
    slug: "faang-interview-preparation-india-2026",
    title: "FAANG Interview Preparation India 2026 — Complete Roadmap for Indian Engineers",
    metaDescription: "FAANG interview prep India 2026: complete roadmap covering DSA, system design, behavioral (Amazon LPs), and offer negotiation. Strategies that worked for Indian candidates.",
    company: "Google",
    category: "System Design",
    readTime: "10 min",
    heroImage: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&h=500&fit=crop",
    heroAlt: "Engineer at a whiteboard with code diagrams representing FAANG interview preparation in India",
    datePublished: "2026-07-13",
    intro: "FAANG interviews — Google, Amazon, Meta, Apple, Netflix, and Microsoft — are the most rigorous engineering interviews in the world. For Indian engineers in 2026, cracking FAANG means ₹40–120 LPA packages (including RSUs), remote work flexibility, and global career mobility. The preparation is intense but systematic — this guide covers exactly what Indian candidates need to focus on.",
    sections: [
      { heading: "The FAANG Interview Structure for Indian Candidates", content: "Most FAANG companies follow a similar interview structure for Indian SDE roles:\n\n(1) Online Assessment (OA) — 2–3 LeetCode-style problems, 60–90 minutes.\n(2) Technical Phone Screen — 1 round, 45 minutes, 1–2 coding problems with a senior engineer.\n(3) Virtual Onsite — 4–6 rounds covering coding, system design, behavioral.\n\nGoogle India and Amazon India both run their onsites virtually in 2026. Meta and Microsoft conduct onsites at their Hyderabad/Bangalore offices. The bar is identical globally — an L4 SDE at Google Bangalore gets the same interview as L4 at Google Mountain View." },
      { heading: "DSA Preparation — What Indian FAANG Candidates Get Wrong", content: "Most Indian candidates over-prepare for DSA and under-prepare for communication. FAANG interviewers care about how you think, not just whether you get the answer.\n\nCommon mistakes: (1) Memorising solutions without understanding patterns — interviewers vary the problem, and memorised solutions fail. (2) Starting coding without clarifying constraints — top candidates spend 3–5 minutes on examples before writing code. (3) Not talking through complexity — always state time and space complexity after every solution.\n\nThe recommended DSA path: Striver's SDE Sheet (160 problems), then 3 months of LeetCode focus (100 medium, 30 hard). Target pattern recognition over volume." },
      { heading: "System Design for FAANG India — What's Actually Asked", content: "System design rounds are often where Indian candidates struggle most. Typical questions at FAANG India in 2026: Design WhatsApp/Slack (messaging at scale), Design Zomato/Swiggy (location-based delivery), Design Google Search, Design a URL shortener, Design Instagram stories.\n\nKey India-specific tip: show UPI/BHIM payment integration awareness in any fintech design question — Indian FAANG interviewers appreciate candidates who know India's payments infrastructure. Unlike LeetCode, system design has a local-flavour component." },
      { heading: "Amazon Leadership Principles — India-specific Preparation", content: "Amazon's India SDE interviews are 50% coding, 50% Leadership Principles behavioral. Every round includes 2–3 LP questions. The most frequently tested at SDE level: Customer Obsession, Bias for Action, Deliver Results, Invent and Simplify, and Are Right, A Lot.\n\nEach LP needs 2 STAR stories from your work/project experience. For freshers: use college projects, internship experiences, or personal projects — Amazon explicitly says 'work experience' includes internships and college work. Practice these answers out loud, timed. Most candidates run 90 seconds over when they first start." },
      { heading: "FAANG Offer Negotiation for Indian Engineers", content: "FAANG offers in India typically have 3 components: Base salary (fixed, taxable), Variable/Performance Bonus (10–20% of base), and RSUs vested over 4 years. The RSU component is where the real FAANG premium lies — at Google L4 India, RSU grants are $50,000–$80,000 over 4 years.\n\nNever accept the first offer without negotiating. FAANG India offers are more flexible than most candidates realise — base has a band, signing bonus is highly negotiable, and accelerated RSU vesting can sometimes be arranged. Counter with a competing offer (real or in-process) for best results." },
    ],
    faqs: [
      { question: "How long does FAANG interview preparation take for Indian candidates?", answer: "For most Indian engineers, FAANG preparation takes 4–8 months of dedicated preparation (1–2 hours daily while working). Freshers from top IITs/NITs with a strong DSA foundation can prepare in 2–3 months. The key is consistent practice over memorisation — FAANG interviews test problem-solving patterns, not solutions." },
      { question: "Which FAANG company is easiest to crack in India in 2026?", answer: "Microsoft India has the highest offer rate among FAANG companies for Indian SDE candidates. Their coding rounds are typically medium-difficulty, and behavioral rounds don't use Amazon's rigid LP format. Google has the highest bar overall. Amazon has the most volume of hiring in India." },
      { question: "What LeetCode difficulty level does FAANG ask in India?", answer: "Google: Medium (85%) + Hard (15%). Amazon: Easy-Medium coding + behavioral LPs. Microsoft: Easy-Medium. Meta: Medium-Hard. A realistic target for FAANG India is solving 150+ medium problems and 30+ hard problems comfortably before the interview." },
    ],
    relatedSlugs: ["system-design-interview-preparation", "amazon-leadership-principles-interview", "microsoft-india-interview-questions-2026"],
    practicePageSlugs: [
      { label: "Google Engineering Interview Practice", slug: "google-india-engineering-interview-questions" },
      { label: "Amazon Leadership Principles Practice", slug: "amazon-leadership-principles-interview" },
      { label: "Microsoft India SDE Practice", slug: "microsoft-india-sde-interview-questions" },
    ],
    cta: "Start FAANG prep with HireStepX — AI mock interviews for Google, Amazon, and Microsoft with voice scoring on DSA explanations, behavioral stories, and system design communication.",
  },
  {
    slug: "wipro-elite-nlth-preparation-2026",
    title: "Wipro Elite NTH & NLTH 2026 — Exam Pattern, Selection Process & Preparation",
    metaDescription: "Wipro Elite NTH and NLTH 2026: complete exam pattern, online test sections, qualifying scores, and interview preparation. Everything freshers need to get a Wipro offer.",
    company: "Wipro",
    category: "Campus Placement",
    readTime: "6 min",
    heroImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=500&fit=crop",
    heroAlt: "Students in a campus recruitment session representing Wipro placement preparation",
    datePublished: "2026-07-13",
    intro: "Wipro's Elite National Talent Hunt (NTH) and National Level Talent Hunt (NLTH) are the company's two primary off-campus hiring programs for freshers in 2026. Together they hire thousands of engineers annually for Wipro Turbo (technology-focused) and core service tracks. Understanding the difference between the two programs and preparing accordingly is the first step.",
    sections: [
      { heading: "Wipro Elite NTH vs NLTH — What's the Difference?", content: "Elite NTH (National Talent Hunt) is Wipro's premium hiring program: higher CTC (₹6.5–7 LPA), requires 65%+ throughout academics, and the online test is harder. NLTH (National Level Talent Hunt) is the standard off-campus program: CTC of ₹3.5–4.5 LPA, lower academic cutoff (60%+), and the test is moderate difficulty.\n\nBoth routes eventually converge at the same interview process, but NLTH candidates have fewer career advancement options in the early years. If you're eligible for NTH, always target that track." },
      { heading: "Wipro Online Assessment 2026 — Sections and Pattern", content: "The Wipro online test has 3 sections:\n\n(1) Aptitude — 16 questions in 16 minutes: time-speed-distance, percentage, profit-loss, number systems, data interpretation. Very fast-paced.\n(2) Verbal — 22 questions in 18 minutes: reading comprehension, grammar, vocabulary.\n(3) Coding — 2 problems in 60 minutes: one easy (sorting, string manipulation) and one medium (basic DSA).\n\nFor Turbo track applicants, the coding section includes a harder problem. No negative marking on aptitude and verbal." },
      { heading: "30-Day Wipro Test Preparation Plan", content: "Week 1: Practice 50 aptitude questions daily. Focus on percentage, time-speed-distance, and profit-loss — these appear every test.\n\nWeek 2: Verbal practice — RC passages from competitive exam books, grammar error spotting.\n\nWeek 3: Coding — solve 20 easy LeetCode problems (strings, arrays, basic sorting). Practice writing clean code quickly.\n\nWeek 4: Full mock tests — PrepInsta has Wipro-specific mocks. Time yourself ruthlessly — the aptitude section is designed to be impossible to complete if you're slow." },
      { heading: "Wipro Technical Interview 2026", content: "After clearing the online test, shortlisted candidates face TR (Technical Round) and HR. Technical Round topics: C/C++/Java fundamentals, OOPs concepts (inheritance, polymorphism, encapsulation, abstraction), DBMS (SQL queries, normalization), OS concepts (process scheduling, memory management), and 1 coding question (easy to medium).\n\nHR is about cultural fit, location flexibility, and basic behavioral questions. Prepare 2–3 strong technical projects to discuss — even college projects work." },
    ],
    faqs: [
      { question: "What is the Wipro Elite NTH salary in 2026?", answer: "Wipro Elite NTH offers ₹6.5–7 LPA for the Turbo track in 2026. The standard NLTH offers ₹3.5–4.5 LPA. Wipro Turbo candidates are placed in technically-focused roles and have faster promotion tracks compared to standard NLTH hires." },
      { question: "Is Wipro NTH hard to crack?", answer: "The aptitude section is the hardest part — it's extremely fast-paced (1 minute per question). The coding section requires basic to medium-level DSA skills. With 2–3 weeks of focused aptitude practice and 20–30 easy LeetCode problems, most engineering graduates can clear NTH." },
      { question: "How many rounds does Wipro have after NTH?", answer: "After clearing NTH, there are 2 rounds: Technical Round (OOPs, DBMS, OS, 1 coding question) and HR Round (behavioral fit, location preference). Both are usually conducted in the same day for off-campus candidates." },
    ],
    relatedSlugs: ["wipro-interview-questions-answers", "campus-placement-interview-tips", "java-interview-questions-freshers-india-2026"],
    practicePageSlugs: [
      { label: "Wipro Freshers Interview Practice", slug: "wipro-freshers-interview-questions" },
      { label: "Wipro Behavioral Interview Practice", slug: "wipro-behavioral-interview-questions" },
    ],
    cta: "Practice Wipro technical and HR rounds on HireStepX — AI voice interviews with scored STAR feedback, tuned to Wipro's evaluation rubric.",
  },
  {
    slug: "react-developer-salary-india-2026",
    title: "React Developer Salary India 2026 — Complete Guide by Experience & City",
    metaDescription: "React developer salary India 2026: ₹4–8 LPA fresher to ₹30–45 LPA senior. Breakdown by experience, city, and skills (Next.js, TypeScript, Node.js) that command premiums.",
    company: "Industry",
    category: "Salary Guide",
    readTime: "6 min",
    heroImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&h=500&fit=crop",
    heroAlt: "Developer working on a React application representing React developer careers in India",
    datePublished: "2026-07-13",
    intro: "React remains the dominant frontend framework in India's product-tech ecosystem in 2026. The demand for React developers has stabilised from the explosive growth of 2021–2023, but salaries continue to rise — particularly for developers who combine React with TypeScript, Next.js (App Router), and backend skills. Here's the complete picture.",
    sections: [
      { heading: "React Developer Salary by Experience (India 2026)", content: "Fresher (0–1 year): ₹4–8 LPA at startups, ₹3.5–5 LPA at IT service companies. Junior React Developer (1–3 years): ₹8–16 LPA. Mid-level (3–6 years): ₹16–28 LPA. Senior Frontend Engineer (6+ years): ₹28–45 LPA. Staff/Principal Engineer: ₹45–70 LPA at FAANG and top unicorns.\n\nThe widest salary variation in React roles is at the mid-level. A 3-year React developer who knows only CRA and basic hooks earns ₹12–16 LPA. One who masters Next.js App Router, TypeScript, and has worked on high-traffic production systems earns ₹20–28 LPA." },
      { heading: "React Skills That Command a Salary Premium in 2026", content: "TypeScript with React: +20–30% premium over JavaScript-only React developers. Next.js (especially App Router, RSC, streaming): highly valued at product companies — adds ₹3–6 LPA at mid-level. Performance optimization (Core Web Vitals, bundle analysis, lazy loading): valued at companies with large user bases. Testing (Jest, Vitest, Playwright, RTL): valued for senior roles. GraphQL (Apollo, React Query): valued at product companies.\n\nThe clearest path: React + TypeScript + Next.js 16 + basic Node.js = full-stack lite — commands 25–40% premium over pure React developers." },
      { heading: "City-wise React Salary Breakdown", content: "Bangalore: Highest premiums for React roles at B2C product companies (Flipkart, Razorpay, PhonePe, Swiggy, CRED). Senior React engineers at top startups earn ₹35–50 LPA. Hyderabad: MNC tech centres (Microsoft, Amazon, Google) hire React engineers at competitive rates. Mumbai: Fintech and media companies drive demand. Remote: 2026 has seen a return of strong remote-first React roles, especially from US-based product companies hiring Indian engineers at $50,000–$120,000 USD equivalent." },
      { heading: "React Developer Interview Topics in 2026", content: "Core React fundamentals still matter: reconciliation, virtual DOM diffing, controlled vs uncontrolled components, and lifecycle methods in functional components (hooks). But 2026 interviews increasingly probe: React Server Components and Server Actions (Next.js App Router), state management patterns (Zustand, Jotai vs Redux), accessibility (WCAG 2.1, ARIA), and performance profiling.\n\nSystem design for frontend is now standard at senior levels: component architecture for a large app, real-time features (WebSockets, SSE), and micro-frontend patterns." },
    ],
    faqs: [
      { question: "What is the average React developer salary in India in 2026?", answer: "The average React developer salary in India in 2026 is ₹10–15 LPA across all experience levels. Freshers start at ₹4–8 LPA, mid-level developers earn ₹16–28 LPA at product companies, and senior engineers at FAANG and unicorns earn ₹28–45+ LPA." },
      { question: "Is React a good skill for salary growth in India in 2026?", answer: "Yes, but pure React skills alone are commoditised. The salary ceiling is higher when you combine React with TypeScript, Next.js, and backend basics. Full-stack developers with strong React skills have the best job market in India in 2026." },
      { question: "Which companies pay the most for React developers in India?", answer: "FAANG India (Google, Amazon, Microsoft) pay the highest — ₹28–55 LPA for mid-senior React engineers. Indian unicorns (Razorpay, CRED, PhonePe) pay ₹20–40 LPA. IT service companies pay ₹6–18 LPA for comparable experience." },
    ],
    relatedSlugs: ["frontend-developer-interview-questions-india-2026", "python-developer-salary-india-2026", "software-engineer-interview-checklist-2026"],
    practicePageSlugs: [
      { label: "Flipkart SDE Interview Practice", slug: "flipkart-sde-interview-questions" },
      { label: "Freshworks SDE Interview Practice", slug: "freshworks-sde-interview-questions" },
    ],
    cta: "Practice frontend developer interviews on HireStepX — React, TypeScript, and system design rounds with AI voice scoring tailored to your target company.",
  },
];

/* ─── Helpers ─── */
function getRelatedPosts(slugs: string[]): BlogPost[] {
  return slugs.map(s => posts.find(p => p.slug === s)).filter((p): p is BlogPost => !!p);
}

/* ─── Category filters ─── */
const CATEGORIES = ["All", ...Array.from(new Set(posts.map(p => p.category)))];

/* ─── Compact card — 3-col grid variant ─── */
function CompactCard({ post }: { post: BlogPost }) {
  return (
    <article
      className="blog-card"
      style={{
        background: t.white, borderRadius: 14, border: `1px solid ${t.line}`,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", height: 160, background: t.creamSoft, flexShrink: 0 }}>
        <Image
          src={post.heroImage} alt={post.heroAlt}
          fill sizes="(max-width: 640px) 100vw, (max-width: 880px) 50vw, 33vw"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{ objectFit: "cover" }}
        />
      </div>
      <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 10.5, fontWeight: 700, color: t.copper, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {post.company} <span style={{ color: t.inkFaintWeak, fontWeight: 400 }}>·</span> {post.category}
        </p>
        <h3 style={{ fontFamily: fonts.serif, fontSize: 19, fontWeight: 400, color: t.coal, lineHeight: 1.22, letterSpacing: "-0.012em", marginBottom: 10, flex: 1, textWrap: "balance" }}>
          <Link href={`/blog/${post.slug}`} className="blog-card-link">
            {post.title}
          </Link>
        </h3>
        <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
          {post.metaDescription}
        </p>
        <p className="blog-card-meta" style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint }}>
          {new Date(post.datePublished).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} · {post.readTime}
        </p>
      </div>
    </article>
  );
}

/* ─── Editorial strip — full-width horizontal card, breaks the uniform grid ─── */
function EditorialStrip({ post, imageRight }: { post: BlogPost; imageRight: boolean }) {
  const media = (
    <div className="blog-editorial-strip-media" style={{ position: "relative", minHeight: 300, background: t.creamSoft, flexShrink: 0 }}>
      <Image
        src={post.heroImage} alt={post.heroAlt} fill
        sizes="(max-width: 880px) 100vw, 420px"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{ objectFit: "cover" }}
      />
    </div>
  );
  return (
    <article
      className="blog-card blog-editorial-strip"
      style={{
        display: "grid",
        gridTemplateColumns: imageRight ? "1fr 420px" : "420px 1fr",
        gap: 0,
        background: t.white, borderRadius: 18, border: `1px solid ${t.line}`,
        overflow: "hidden", marginBottom: 20,
      }}
    >
      {!imageRight && media}
      <div className="blog-strip-text" style={{ padding: "44px 52px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.copper, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
          {post.company} <span style={{ color: t.inkFaintWeak, fontWeight: 400 }}>·</span> {post.category}
        </p>
        <h3 style={{ fontFamily: fonts.serif, fontSize: "clamp(22px, 2.4vw, 30px)", fontWeight: 400, color: t.coal, lineHeight: 1.12, letterSpacing: "-0.02em", marginBottom: 16, textWrap: "balance" }}>
          <Link href={`/blog/${post.slug}`} className="blog-card-link">
            {post.title}
          </Link>
        </h3>
        <p style={{ fontFamily: fonts.sans, fontSize: 14.5, color: t.indigoGray, lineHeight: 1.65, marginBottom: 22, maxWidth: "48ch" }}>
          {post.metaDescription}
        </p>
        <p className="blog-card-meta" style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkSoft }}>
          {new Date(post.datePublished).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} · {post.readTime} read
        </p>
      </div>
      {imageRight && media}
    </article>
  );
}

type EditorialSection =
  | { type: "grid"; items: BlogPost[] }
  | { type: "strip"; item: BlogPost; imageRight: boolean };

/* ─── Blog index (list of all posts) ─── */
function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState("All");

  useSEO({
    title: "Interview Prep Blog — HireStepX",
    description: "Company-specific interview preparation guides, question banks, and career strategies for Indian job seekers. Google, Amazon, TCS, Infosys, Flipkart, and more.",
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Interview Prep Blog",
      description: "Company-specific interview preparation guides for Indian job seekers.",
      url: "https://hirestepx.com/blog",
      publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: posts.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://hirestepx.com/blog/${p.slug}`,
          name: p.title,
        })),
      },
    },
  });

  const filtered = activeCategory === "All" ? posts : posts.filter(p => p.category === activeCategory);
  const featured = filtered[0];
  const rest = filtered.slice(1);

  const editorialSections: EditorialSection[] = [];
  for (let gi = 0, si = 0; gi < rest.length;) {
    const chunk = rest.slice(gi, gi + 3);
    editorialSections.push({ type: "grid", items: chunk });
    gi += chunk.length;
    if (gi < rest.length) {
      editorialSections.push({ type: "strip", item: rest[gi], imageRight: si % 2 === 1 });
      gi++;
      si++;
    }
  }

  return (
    <BlogShell>
      <div className="blog-container" style={{ maxWidth: 1100, margin: "0 auto", padding: "120px 40px 96px" }}>
        {/* Header */}
        <div style={{ marginBottom: 52, maxWidth: 800 }}>
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(44px, 5.5vw, 76px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.03em", lineHeight: 0.98, marginBottom: 22, textWrap: "balance" }}>
            Interview prep that actually{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>works</span>
          </h1>
          <p style={{ fontFamily: fonts.sans, fontSize: 18, color: t.indigoGray, lineHeight: 1.55, maxWidth: "58ch" }}>
            Company-specific guides, question banks, and career strategies built for Indian job seekers.
          </p>
        </div>

        {/* Category filters — scrollable on mobile */}
        <div className="blog-filter-scroll" style={{ display: "flex", gap: 8, marginBottom: 44, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                  padding: "10px 18px",
                  borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  transition: "background 160ms, color 160ms, border-color 160ms",
                  background: active ? t.coal : "transparent",
                  color: active ? t.cream : t.coal,
                  border: `1px solid ${active ? t.coal : t.line}`,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Featured post */}
        {featured && (
          <article
            className="blog-featured blog-card"
            style={{
              display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 0,
              background: t.white, borderRadius: 18, border: `1px solid ${t.line}`,
              overflow: "hidden", marginBottom: 40,
            }}
          >
            <div className="blog-featured-media" style={{ position: "relative", minHeight: 340, background: t.creamSoft }}>
              <Image
                src={featured.heroImage} alt={featured.heroAlt} loading="eager"
                fill sizes="(max-width: 880px) 100vw, 50vw"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                style={{ objectFit: "cover" }}
              />
            </div>
            <div style={{ padding: "44px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.copper, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", background: t.copper100Soft, border: `1px solid ${t.copper100SoftLine}`, borderRadius: 999 }}>{featured.company}</span>
                <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, color: t.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 999 }}>{featured.category}</span>
              </div>
              <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(24px, 2.6vw, 34px)", fontWeight: 400, color: t.coal, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 14, textWrap: "balance" }}>
                <Link href={`/blog/${featured.slug}`} className="blog-card-link">
                  {featured.title}
                </Link>
              </h2>
              <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.indigoGray, lineHeight: 1.6, marginBottom: 18 }}>
                {featured.metaDescription}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: fonts.sans, fontSize: 12, color: t.inkSoft }}>
                <span>{featured.readTime} read</span>
                <span aria-hidden style={{ color: t.inkFaint }}>·</span>
                <span>{new Date(featured.datePublished).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </article>
        )}

        {/* Editorial post grid — alternating card groups and full-width strips */}
        {editorialSections.map((section, si) =>
          section.type === "grid" ? (
            <div key={`grid-${si}`} className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, marginBottom: 20 }}>
              {section.items.map(p => <CompactCard key={p.slug} post={p} />)}
            </div>
          ) : (
            <EditorialStrip key={`strip-${si}`} post={section.item} imageRight={section.imageRight} />
          )
        )}

        {/* Bottom CTA — editorial, left-aligned */}
        <div className="blog-index-cta" style={{
          marginTop: 88, borderTop: `1px solid ${t.lineStrong}`, paddingTop: 56,
          display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40, flexWrap: "wrap",
        }}>
          <p style={{ fontFamily: fonts.serif, fontSize: "clamp(32px, 4vw, 54px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.02, maxWidth: "16ch", textWrap: "balance", margin: 0 }}>
            Stop reading,{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>start practicing</span>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", minWidth: 260 }}>
            <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.indigoGray, lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
              AI mock interviews with instant feedback. Three sessions free, no card required.
            </p>
            <Link href="/signup" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: fonts.sans, fontSize: 15, fontWeight: 600,
              padding: "14px 28px", borderRadius: 999, textDecoration: "none",
              background: t.indigo, color: t.white, flexShrink: 0,
            }}>
              Start free practice <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </BlogShell>
  );
}

/* ─── Single blog post ─── */
function BlogPostPage({ post }: { post: BlogPost }) {
  const related = getRelatedPosts(post.relatedSlugs);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <BlogShell>
      {/* Hero — editorial header on cream, not a dark image overlay. Title leads,
          image follows as a supporting frame instead of fighting the typography. */}
      <header style={{ position: "relative", padding: "120px 0 0", background: t.cream }}>
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 65% 50% at 50% 0%, rgba(180, 83, 9, 0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 40px 40px", position: "relative" }}>
          <Link href="/blog" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.indigoGray,
            textDecoration: "none", marginBottom: 24,
          }}>
            <span aria-hidden>←</span> Blog
          </Link>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.copper, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", background: t.copper100Soft, border: `1px solid ${t.copper100SoftLine}`, borderRadius: 999 }}>{post.company}</span>
            <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, color: t.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 999 }}>{post.category}</span>
          </div>
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.05, textWrap: "balance", margin: 0 }}>
            {post.title}
          </h1>
          <div className="blog-meta" style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12, fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, flexWrap: "wrap" }}>
            <span style={{ color: t.coal, fontWeight: 600 }}>{post.author ?? "HireStepX Editorial Team"}</span>
            <span aria-hidden style={{ color: t.inkFaint }}>·</span>
            <span>{new Date(post.datePublished).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</span>
            <span aria-hidden style={{ color: t.inkFaint }}>·</span>
            <span>{post.readTime} read</span>
          </div>
        </div>
        <div className="blog-hero" style={{ position: "relative", height: 380, overflow: "hidden", borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, background: t.creamSoft }}>
          <Image
            src={post.heroImage} alt={post.heroAlt}
            fill sizes="100vw"
            priority
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ objectFit: "cover" }}
          />
        </div>
      </header>

      <article className="blog-article" style={{ maxWidth: 720, margin: "0 auto", padding: "56px 40px 96px" }}>
        {/* Intro / dek */}
        <p style={{ fontFamily: fonts.serif, fontSize: "clamp(20px, 2.2vw, 24px)", fontStyle: "italic", color: t.coal, lineHeight: 1.5, marginBottom: 48, letterSpacing: "-0.005em", textWrap: "balance" }}>
          {post.intro}
        </p>

        {/* Sections */}
        {post.sections.map((section, i) => (
          <section key={i} style={{ marginBottom: 44 }}>
            <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(24px, 2.6vw, 30px)", fontWeight: 400, color: t.coal, marginBottom: 16, lineHeight: 1.2, letterSpacing: "-0.015em", textWrap: "balance" }}>
              {section.heading}
            </h2>
            <div style={{ fontFamily: fonts.sans, fontSize: 16.5, color: t.coal, lineHeight: 1.75, whiteSpace: "pre-line", maxWidth: "68ch" }}>
              {section.content}
            </div>
            {i < post.sections.length - 1 && (
              <div style={{ width: 48, height: 1, background: t.lineStrong, margin: "44px 0 0" }} />
            )}
          </section>
        ))}

        {/* FAQ Section — accordion */}
        {post.faqs.length > 0 && (
          <section style={{ marginTop: 64, marginBottom: 56 }}>
            <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(26px, 3vw, 34px)", fontWeight: 400, color: t.coal, marginBottom: 24, letterSpacing: "-0.02em" }}>
              Frequently asked questions
            </h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {post.faqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} style={{ borderBottom: `1px solid ${t.line}` }}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${i}`}
                      className="blog-faq-btn"
                      style={{
                        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "22px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span style={{ fontFamily: fonts.sans, fontSize: 18, fontWeight: 600, color: t.coal, lineHeight: 1.4, paddingRight: 16 }}>
                        {faq.question}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          flexShrink: 0, color: t.copper, fontSize: 22, lineHeight: 1, display: "inline-block",
                          transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                          transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                        }}
                      >
                        +
                      </span>
                    </button>
                    <div
                      id={`faq-answer-${i}`}
                      style={{
                        display: "grid",
                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                        transition: "grid-template-rows 280ms cubic-bezier(0.16,1,0.3,1)",
                      }}
                    >
                      <div style={{ overflow: "hidden", paddingBottom: isOpen ? 22 : 0, transition: "padding-bottom 280ms cubic-bezier(0.16,1,0.3,1)" }}>
                        <p style={{ fontFamily: fonts.sans, fontSize: 15.5, color: t.indigoGray, lineHeight: 1.7, maxWidth: "68ch" }}>
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA — editorial, left-aligned */}
        <div style={{ marginTop: 56, borderTop: `1px solid ${t.lineStrong}`, paddingTop: 40 }}>
          <p style={{ fontFamily: fonts.serif, fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 14, textWrap: "balance" }}>
            Ready to{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>practice</span>?
          </p>
          <p style={{ fontFamily: fonts.sans, fontSize: 15, color: t.indigoGray, lineHeight: 1.65, marginBottom: 26, maxWidth: "56ch" }}>
            {post.cta}
          </p>
          <Link href="/signup" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontFamily: fonts.sans, fontSize: 15, fontWeight: 600,
            padding: "13px 26px", borderRadius: 999, textDecoration: "none",
            background: t.indigo, color: t.white,
          }}>
            Start free practice <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Company practice links — cross-links to /companies/[slug] pages */}
        {post.practicePageSlugs && post.practicePageSlugs.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2 style={{
              fontFamily: fonts.sans, fontSize: 12, fontWeight: 700,
              color: t.copper, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14,
            }}>
              Practice this company on HireStepX
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {post.practicePageSlugs.map(({ label, slug }) => (
                <Link key={slug} href={`/companies/${slug}`} style={{
                  display: "inline-block", padding: "9px 16px",
                  background: t.creamSoft, border: `1px solid ${t.lineStrong}`,
                  borderRadius: 8, textDecoration: "none",
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 500, color: t.coal,
                }}>
                  {label} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Posts */}
        {related.length > 0 && (
          <section style={{ marginTop: 72 }}>
            <h2 style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 700, color: t.copper, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
              Continue reading
            </h2>
            <div className="blog-related-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(related.length, 3)}, 1fr)`, gap: 18 }}>
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="blog-card" style={{
                  background: t.white, borderRadius: 12, border: `1px solid ${t.line}`,
                  textDecoration: "none", overflow: "hidden",
                }}>
                  <div style={{ position: "relative", width: "100%", height: 110, background: t.creamSoft }}>
                    <Image src={r.heroImage} alt={r.heroAlt} fill sizes="(max-width: 768px) 100vw, 33vw" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      style={{ objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: "14px 16px 16px" }}>
                    <span style={{ fontFamily: fonts.serif, fontSize: 16, fontWeight: 400, color: t.coal, lineHeight: 1.25, letterSpacing: "-0.01em", display: "block", marginBottom: 8 }}>{r.title}</span>
                    <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkSoft }}>{r.readTime} read</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </BlogShell>
  );
}

/* ─── Main export ─── */
export default function BlogPage() {
  const { slug } = useParams() as { slug?: string };

  if (!slug) {
    return <BlogIndex />;
  }

  const post = posts.find(p => p.slug === slug);
  if (!post) {
    return (
      <BlogShell>
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "160px 40px 80px", textAlign: "center" }}>
          <p style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: t.copper, marginBottom: 14 }}>404</p>
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(36px, 4.5vw, 56px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.05, marginBottom: 14 }}>
            Post not found
          </h1>
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.indigoGray, marginBottom: 28, maxWidth: "52ch" }}>
            That story might have moved or never existed. The blog index still has the rest of it.
          </p>
          <Link href="/blog" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: fonts.sans, fontSize: 14, fontWeight: 600,
            padding: "11px 22px", borderRadius: 999, textDecoration: "none",
            background: t.indigo, color: t.white,
          }}>
            Back to blog
          </Link>
        </div>
      </BlogShell>
    );
  }

  return <BlogPostPage post={post} />;
}

/* Export slugs for sitemap generation */
export const blogSlugs = posts.map(p => p.slug);
