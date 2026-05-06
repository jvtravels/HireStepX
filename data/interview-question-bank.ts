/* HireStepX — Curated interview-question bank
 *
 * Hand-curated reference questions for the top Indian companies, used by
 * the question-generation pipeline to anchor the LLM's output to real-
 * world style and depth. NOT shown verbatim to candidates — passed to
 * the LLM as STYLE references with explicit "do not copy verbatim"
 * instructions in the prompt.
 *
 * This is the Phase-1 RAG corpus. Phase 3 swaps it for a vector DB fed
 * by user-submitted experiences (see _question-feedback.ts). Until then,
 * these stay maintained by hand. Refresh quarterly when company formats
 * shift — tag each entry with `addedQuarter` so we can decay stale ones.
 *
 * Curation rules:
 *   - Only include questions verified from ≥2 independent sources
 *     (multiple Glassdoor reviews + AmbitionBox + a verified candidate
 *     post-mortem). Single-source = exclude.
 *   - Strip company-internal codenames, real interviewer names, internal
 *     project IDs. Keep only the question structure.
 *   - 4-8 entries per (company × roleFamily × focus) tuple.
 *   - Cover all 6 negotiation phases for salary-negotiation entries.
 */

export type CompanyKey =
  | "google" | "amazon" | "microsoft" | "meta" | "apple" | "netflix"
  | "flipkart" | "razorpay" | "swiggy" | "zomato" | "phonepe" | "paytm"
  | "cred" | "zerodha" | "meesho" | "oyo" | "freshworks" | "zoho"
  | "tcs" | "infosys" | "wipro" | "cognizant" | "accenture"
  | "uber" | "atlassian" | "stripe" | "linkedin" | "adobe"
  | "mckinsey" | "bcg" | "bain" | "deloitte"
  | "goldman" | "jpmc" | "morgan-stanley"
  | "jane-street" | "de-shaw" | "citadel"
  | "openai" | "anthropic" | "sarvam";

export type RoleFamily =
  | "swe" | "pm" | "em" | "data" | "design" | "behavioral"
  | "consultant" | "quant" | "ml" | "writer" | "ds-research"
  | "designer-senior" | "salary";
export type FocusArea =
  | "behavioral" | "technical" | "system-design" | "case-study"
  | "campus-placement" | "hr" | "panel" | "salary-negotiation"
  | "leadership" | "general";

export interface BankEntry {
  /** Question text — anchored, never shown verbatim to the user. */
  text: string;
  company: CompanyKey;
  roleFamily: RoleFamily;
  focus: FocusArea;
  /** Quarter added in YYYY-Q format. Used for recency-weighted retrieval. */
  addedQuarter: string;
  /** Optional: known difficulty marker. */
  difficulty?: "warmup" | "standard" | "intense";
  /** Optional: short notes on what makes this question characteristic
   *  of the company's style — used by the LLM to extract patterns. */
  styleNote?: string;
}

/* ─── Bank ────────────────────────────────────────────────────────── */

export const QUESTION_BANK: BankEntry[] = [
  /* ── Flipkart ──────────────────────────────────────────────────── */
  {
    text: "Walk me through how you'd improve search relevance for grocery on Flipkart. The current click-through is dropping for fresh produce specifically.",
    company: "flipkart", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "standard",
    styleNote: "Flipkart PM rounds open with a real ongoing problem from a vertical. Expect detailed probes on metrics, hypothesis structure, and prioritisation.",
  },
  {
    text: "Tell me about a time you shipped something despite weak data. How did you sell it internally?",
    company: "flipkart", roleFamily: "pm", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Design a system to predict same-day delivery feasibility for a new pincode in tier-3 India.",
    company: "flipkart", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
    styleNote: "Flipkart engineering loves India-specific constraints — pincode coverage, monsoon patterns, kirana partnerships.",
  },
  {
    text: "Reverse a linked list in O(1) extra space. Then explain when you'd use this in production.",
    company: "flipkart", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── Razorpay ──────────────────────────────────────────────────── */
  {
    text: "We're seeing UPI failure rates spike at 9pm on weekends. How would you debug, and what's your hypothesis?",
    company: "razorpay", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
    styleNote: "Razorpay loves real production scenarios — payments failures, NPCI rate limits, settlement reconciliation. Be specific.",
  },
  {
    text: "Walk me through how you'd build idempotency into a payment retry system. What happens if the network drops mid-callback?",
    company: "razorpay", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },
  {
    text: "Tell me about a time you owned an outage. What did the post-mortem actually change?",
    company: "razorpay", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "How would you price a new pricing tier targeted at D2C brands doing ₹50L–5Cr annual GMV?",
    company: "razorpay", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── Swiggy ────────────────────────────────────────────────────── */
  {
    text: "A restaurant partner's order acceptance rate has dropped from 92% to 78% over two weeks. Walk me through your investigation.",
    company: "swiggy", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "standard",
    styleNote: "Swiggy PM rounds heavily test marketplace dynamics — partner economics, delivery-partner availability, demand-supply imbalance.",
  },
  {
    text: "Design Swiggy Genie's matching algorithm. How does it differ from food-order matching?",
    company: "swiggy", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },
  {
    text: "How would you decide whether to launch dine-in reservations as a new vertical?",
    company: "swiggy", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── Zomato ────────────────────────────────────────────────────── */
  {
    text: "Restaurant ratings show a 0.3-star drop in Tier-2 cities last quarter. Diagnose and propose interventions.",
    company: "zomato", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Tell me about a decision you made that you'd reverse today. What did you learn?",
    company: "zomato", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── PhonePe ───────────────────────────────────────────────────── */
  {
    text: "Walk me through how you'd architect transaction-level fraud detection for 100M daily UPI transactions.",
    company: "phonepe", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
    styleNote: "PhonePe engineering rounds are scale-obsessed — every answer should explicitly address throughput, latency, and cost at India scale.",
  },
  {
    text: "How would you build a recommendation engine that suggests bills the user is about to forget?",
    company: "phonepe", roleFamily: "data", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── Paytm ─────────────────────────────────────────────────────── */
  {
    text: "Why are you leaving your current role? What does Paytm offer that they can't?",
    company: "paytm", roleFamily: "behavioral", focus: "hr",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Design a cashback-allocation system that prevents abuse without alienating genuine users.",
    company: "paytm", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── TCS ───────────────────────────────────────────────────────── */
  {
    text: "What is the difference between a class and an object? Give an example.",
    company: "tcs", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q1", difficulty: "warmup",
    styleNote: "TCS Ninja/Digital tracks lean heavily on CS fundamentals — OOP, OS, DBMS, SQL basics. Expect rapid-fire Q's, not deep dives.",
  },
  {
    text: "Why TCS over the other IT services companies?",
    company: "tcs", roleFamily: "behavioral", focus: "hr",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },
  {
    text: "Write a SQL query to find the second-highest salary in a department.",
    company: "tcs", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },
  {
    text: "Are you willing to relocate to any TCS office anywhere in India?",
    company: "tcs", roleFamily: "behavioral", focus: "hr",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },

  /* ── Infosys ───────────────────────────────────────────────────── */
  {
    text: "Tell me about your final-year project. What was your specific contribution?",
    company: "infosys", roleFamily: "behavioral", focus: "campus-placement",
    addedQuarter: "2026-Q1", difficulty: "warmup",
    styleNote: "Infosys campus rounds dwell on the academic project — be ready for 5-6 follow-ups on architecture, your role, and trade-offs.",
  },
  {
    text: "What is normalisation in databases? When would you de-normalise?",
    company: "infosys", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },
  {
    text: "Where do you see yourself in 5 years?",
    company: "infosys", roleFamily: "behavioral", focus: "hr",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },

  /* ── Wipro ─────────────────────────────────────────────────────── */
  {
    text: "Walk me through your resume — start from your most recent experience.",
    company: "wipro", roleFamily: "behavioral", focus: "hr",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },
  {
    text: "What's the difference between a stack and a queue? Give a real-world use case for each.",
    company: "wipro", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q1", difficulty: "warmup",
  },

  /* ── Google ────────────────────────────────────────────────────── */
  {
    text: "Design a system to detect duplicate documents at web scale. What's your approximation strategy?",
    company: "google", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
    styleNote: "Google SWE rounds prize first-principles thinking and explicit trade-off articulation. Always discuss what you're approximating.",
  },
  {
    text: "Tell me about a technical decision you made that turned out to be wrong. How did you discover it?",
    company: "google", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Given a stream of integers, design a data structure that returns the median in O(log n).",
    company: "google", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },
  {
    text: "How would you launch a new YouTube feature in India that doesn't work in Indonesia or Brazil?",
    company: "google", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },

  /* ── Amazon ────────────────────────────────────────────────────── */
  {
    text: "Tell me about a time you took a calculated risk that didn't pay off. What did you learn?",
    company: "amazon", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
    styleNote: "Amazon rounds map every behavioural answer to one of the 16 Leadership Principles. Be explicit about which principle your story illustrates.",
  },
  {
    text: "Describe a situation where you had to dive deep into a problem the team had given up on.",
    company: "amazon", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Design Amazon Prime's recommendation engine. How would you handle the cold-start for a new Prime member?",
    company: "amazon", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },

  /* ── Microsoft ─────────────────────────────────────────────────── */
  {
    text: "Tell me about a time you disagreed with your manager. How did it end?",
    company: "microsoft", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Design a URL shortener like bit.ly. Walk me through database choice and scaling.",
    company: "microsoft", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },

  /* ── Meta ──────────────────────────────────────────────────────── */
  {
    text: "Tell me about a project where you had to drive consensus across multiple teams that disagreed.",
    company: "meta", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "Design Instagram's news feed ranking. How do you handle a celebrity who posts 50 times an hour?",
    company: "meta", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },

  /* ── Uber ──────────────────────────────────────────────────────── */
  {
    text: "Walk me through how you'd design surge pricing for a new market. What's the cold-start strategy?",
    company: "uber", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },

  /* ── Atlassian ─────────────────────────────────────────────────── */
  {
    text: "Tell me about a time you championed a customer's needs against pushback from your own team.",
    company: "atlassian", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q1", difficulty: "standard",
    styleNote: "Atlassian leans hard on their values — 'Open company, no bullshit', 'Play as a team'. Anchor stories to one explicitly.",
  },

  /* ── Salary negotiation (multi-company) ────────────────────────── */
  {
    text: "Our offer is ₹28 LPA fixed plus 10% variable. We think that's competitive for your level. What's your reaction?",
    company: "flipkart", roleFamily: "swe", focus: "salary-negotiation",
    addedQuarter: "2026-Q1", difficulty: "standard",
    styleNote: "Indian salary-neg rounds open with the offer + a soft anchor ('competitive for your level'). The hiring manager wants to see if you push back with structure or just accept.",
  },
  {
    text: "What are your salary expectations? We need a number to take to comp committee.",
    company: "razorpay", roleFamily: "swe", focus: "salary-negotiation",
    addedQuarter: "2026-Q1", difficulty: "standard",
  },
  {
    text: "I hear you on the base, but the ESOPs vest over 4 years and we believe they'll be worth significantly more by then. Does that change your thinking?",
    company: "swiggy", roleFamily: "pm", focus: "salary-negotiation",
    addedQuarter: "2026-Q1", difficulty: "intense",
  },

  /* ── Amazon SDE2 / India 2026 — Leadership Principles deep-dive ──── */
  {
    text: "Tell me about a disagreement you had with a team decision. How did you handle it?",
    company: "amazon", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Amazon LP: Have Backbone; Disagree and Commit. Bar-raisers probe for the moment of disagreement, the data you brought, and what you did AFTER the decision was finalised against you.",
  },
  {
    text: "Describe a time you received critical feedback from a manager. What did you do with it?",
    company: "amazon", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Amazon LP: Learn and Be Curious. Push for specific feedback wording and the change in behaviour, not just 'I reflected on it'.",
  },
  {
    text: "What's your role when a job fails in production at 2am? Walk me through your last incident end to end.",
    company: "amazon", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Amazon LP: Bias for Action + Dive Deep. They want runbooks, MTTR numbers, root-cause depth — not 'we paged the on-call'.",
  },
  {
    text: "Tell me about a time you missed a tight deadline. How did you handle it with the customer?",
    company: "amazon", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Amazon LP: Ownership + Deliver Results. Negative outcomes are fine if accountability is clean. Blame-shifting fails this question instantly.",
  },
  {
    text: "Design Amazon's order tracking notification system. Optimise for cost at 100M orders/day.",
    company: "amazon", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "AWS-aligned bias. Expect probes on SQS vs SNS vs EventBridge, idempotency keys, dedup windows, cold-storage policy.",
  },

  /* ── Google L4/L5 system design (2026) ─────────────────────────── */
  {
    text: "Design a URL shortener that handles 100K writes/sec. Walk me through your data model and how you'd handle hot keys.",
    company: "google", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Google L4 system design favours classic problems where the depth comes from probing trade-offs (consistent hashing, key-skew, base62 vs UUIDv7).",
  },
  {
    text: "Design YouTube live-comment fanout. Handle a stream with 5M concurrent viewers.",
    company: "google", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "L5 territory. Expect deep probes on pub-sub, backpressure, regional sharding, ratelimiting per-stream vs per-user.",
  },
  {
    text: "You have a service that's slow only on Tuesdays. Walk me through how you'd debug.",
    company: "google", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Googleyness: structured debugging, hypothesis-driven, instrumentation-first.",
  },

  /* ── Stripe — bug-bash + writing clarity (2026) ─────────────────── */
  {
    text: "Here's 200 lines of payment-processing code with several intentional bugs. Find them and explain the production impact of each.",
    company: "stripe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Stripe's signature 'bug bash' round. Off-by-one, race conditions, wrong error handling, edge cases in money math. Communicating impact > finding all bugs.",
  },
  {
    text: "Design an idempotency layer for a payment API. What happens when the same key shows up with a different request body?",
    company: "stripe", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Stripe API design rounds dig into edge cases. The 'different body, same key' case is a classic — answer is to reject, not silently overwrite.",
  },
  {
    text: "Explain webhooks vs. polling for a developer who has never built a payment integration. You have 4 sentences.",
    company: "stripe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Stripe values writing clarity above almost everything. Length-constrained explanation tests prioritisation of ideas.",
  },

  /* ── Razorpay — fintech depth + ML risk (2026) ──────────────────── */
  {
    text: "Walk me through Razorpay's fraud-detection model. How would you reduce false positives without increasing chargeback losses?",
    company: "razorpay", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Razorpay ML rounds tie model decisions to ₹ impact — chargeback cost vs. blocked-good-txn cost. Pure ML answers without business framing fail.",
  },
  {
    text: "Design Razorpay's settlement system. Money flows from acquirer → aggregator → merchant. Where can it break and how do you reconcile?",
    company: "razorpay", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Settlement = where Razorpay loses real money. Probe expected: T+0 vs T+1, partial captures, refund-of-refund, NPCI mandate edge cases.",
  },
  {
    text: "We see UPI failure rates spike at 9pm on weekends. How would you debug and what's your hypothesis?",
    company: "razorpay", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Real Razorpay scenario. Expected: bank-side downtime (most likely), peak load + thread-pool exhaustion, NPCI rate limits.",
  },

  /* ── PhonePe — UPI scale + reliability (2026) ───────────────────── */
  {
    text: "Design a system that processes 10 billion UPI transactions/day with 99.99% availability. How do you handle a partner-bank outage during peak?",
    company: "phonepe", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "PhonePe loves real-scale numbers. NPCI's 26B txn/month cap is the implicit constraint. Bank-fallback strategy and circuit breakers are must-mention.",
  },
  {
    text: "A merchant complains they're missing settlements for 3 days. Walk me through how you'd investigate.",
    company: "phonepe", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Tests ownership + ops chops. They want: pull settlement logs, check NPCI status, check internal pipeline lag, communicate with merchant during investigation.",
  },

  /* ── Atlassian PM (2026) — value-driven 5-question structure ─── */
  {
    text: "Tell me about your favourite product. Now tell me three concrete things you'd change about it.",
    company: "atlassian", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Atlassian classic. The trap: candidates who only describe the product. They want the 3 changes to be opinionated, not safe.",
  },
  {
    text: "Walk me through how you'd improve Jira's incident-response workflow for an SRE team. What metric would you move?",
    company: "atlassian", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Atlassian probes deep on user-segment understanding (SRE ≠ generic dev). Wrong metric (e.g., 'engagement') = fail.",
  },
  {
    text: "A PM at Atlassian needs to lead and inspire, seek mastery, communicate, and deliver outcomes. Tell me about a time you fell short on one of these — which one and what changed?",
    company: "atlassian", roleFamily: "pm", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Atlassian's 4 PM expectations are publicly published. Self-aware failure stories anchored to one of them outscore polished success stories.",
  },

  /* ── Microsoft PM (2026) — growth mindset ───────────────────── */
  {
    text: "Describe a product decision you got wrong. What did you learn that you've applied since?",
    company: "microsoft", roleFamily: "pm", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Microsoft growth-mindset signature question. They want a real wrong call (not 'we shipped a feature 2 weeks late'), the cost, and a specific changed behaviour.",
  },
  {
    text: "Design Copilot for a non-technical audience — say, a small-business owner doing their GST filing. What's the killer feature?",
    company: "microsoft", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "MS India PM rounds increasingly probe Indic-market product thinking around Copilot/Bharat use cases. Generic Western examples fall flat.",
  },

  /* ── McKinsey case interviews (2026) ─────────────────────────── */
  {
    text: "Our client is a top-3 Indian private bank. Their retail loan origination volume has dropped 18% in 6 months. Where do we look?",
    company: "mckinsey", roleFamily: "consultant", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "McKinsey is interviewer-led. Crisp top-down structure expected: external (rate, competition, demand) vs. internal (channel, approval rate, risk-tightening). Issue tree before any analysis.",
  },
  {
    text: "Estimate the annual market size for premium electric two-wheelers in India.",
    company: "mckinsey", roleFamily: "consultant", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Classic market-sizing. Top-down: India 2W market ~17M units, premium % ~3-5%, EV penetration ~12% growing. Show segment thinking, not arithmetic gymnastics.",
  },
  {
    text: "Walk me through a time you led without authority. What was the hardest moment?",
    company: "mckinsey", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "McKinsey PEI: Leadership / Personal Impact / Entrepreneurial Drive. Story must be quantified and you must own a clear personal action, not a team accomplishment.",
  },

  /* ── BCG case interviews (2026) ──────────────────────────────── */
  {
    text: "An Indian D2C beauty brand has hit ₹500Cr revenue but EBITDA is -8%. Help me think through the path to profitability.",
    company: "bcg", roleFamily: "consultant", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "BCG is candidate-led. Build your own framework. D2C unit-economics: CAC, contribution margin, channel mix, return rates, fixed-cost leverage. Don't apply textbook profitability tree mechanically.",
  },
  {
    text: "Brainstorm 5 ways a tier-2 city bank could attract Gen-Z first-time savers without becoming a digital bank.",
    company: "bcg", roleFamily: "consultant", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "BCG creativity-within-structure. Want diverse ideas, not 5 variations of one. Quality over MECE here.",
  },

  /* ── Bain case + culture (2026) ──────────────────────────────── */
  {
    text: "A PE firm is considering acquiring a regional dairy chain in South India. What are the 3 most important things you'd validate in due diligence?",
    company: "bain", roleFamily: "consultant", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Bain frequently uses PE-DD cases. Conversational style — interviewer will guide if you're stuck. Top 3: market growth defensibility, route-density economics, working-capital cycle.",
  },

  /* ── Jane Street — probability + mental math (2026) ──────────── */
  {
    text: "What's 54% of 110? You have 10 seconds.",
    company: "jane-street", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "warmup",
    styleNote: "Jane Street first-round mental math. They want articulated method (54% × 110 = 54 + 0.54 × 10 = 59.4), not just the number.",
  },
  {
    text: "You and a roommate host a party with 10 other couples. After the party, you ask everyone (not yourself) how many hands they shook. No one shook their own roommate's hand. Each person gives you a different number. How many hands did your roommate shake?",
    company: "jane-street", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Classic Jane Street puzzle. Answer: 10. The structure of distinct counts (0..20) forces pairing. Walk through the reasoning out loud.",
  },
  {
    text: "I'll roll a fair die. You can stop me at any roll and take the value of that roll, in rupees. What's your strategy and what's the expected value?",
    company: "jane-street", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Tests EV reasoning + dynamic-programming intuition under time pressure. Stop on 5 or 6; EV = ~4.66.",
  },

  /* ── DE Shaw — algorithms + math intuition ──────────────────── */
  {
    text: "Find the median of two sorted arrays in O(log(min(m,n))). Explain why your invariant is correct, not just that it works.",
    company: "de-shaw", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "DE Shaw probes whether you understand the algorithm vs. memorised LeetCode 4. Push for the partition-invariant proof.",
  },

  /* ── Goldman Sachs — engineering + market context (2026) ────── */
  {
    text: "Tell me about a time you handled pressure from a deadline you knew you'd miss. What did you tell stakeholders, and when?",
    company: "goldman", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Goldman 14 Business Principles bias. They want early communication + concrete remediation, not heroism narratives.",
  },

  /* ── CRED — design / craft / pushback (2026) ─────────────────── */
  {
    text: "Critique this onboarding flow [shown on screen]. What feels CRED-y here vs generic? Be specific.",
    company: "cred", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "CRED design rounds prize taste defended with reasoning. 'It feels nice' fails. Specific principles: motion choices, type hierarchy, copy tone, premium signalling.",
  },
  {
    text: "We want to ship a feature that the product team thinks is too premium and finance thinks is too costly. How do you navigate?",
    company: "cred", roleFamily: "pm", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "CRED culture allows pushback. Tests whether you've built that muscle, not whether you'll fold to the loudest stakeholder.",
  },

  /* ── Zerodha — first-principles eng (2026) ──────────────────── */
  {
    text: "We have 1M users hitting the order-book endpoint simultaneously at 9:15am. We don't want to use Redis or any managed cache. How would you handle it?",
    company: "zerodha", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Zerodha intentionally constrains stack to test fundamentals. In-process cache, careful invalidation, single-binary thinking. 'I'd use Redis' fails the round.",
  },

  /* ── Meesho — Bharat user empathy (2026) ────────────────────── */
  {
    text: "A reseller in Tier-3 India earns ₹3,000/month from Meesho. Walk me through how she actually uses the app on her ₹6K phone, what frustrates her, and one feature you'd build.",
    company: "meesho", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Meesho PM rounds test whether you actually understand the Bharat-female-reseller persona vs. urban-ICP fluency. Vernacular, low-bandwidth, WhatsApp-native answers expected.",
  },

  /* ── Freshworks — global SaaS engineering (2026) ────────────── */
  {
    text: "Design a multi-tenant authorization service that supports both row-level and column-level permissions across 10K customers.",
    company: "freshworks", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Freshworks engineering bar = US SaaS, not Indian unicorn. Multi-tenancy isolation, ABAC policy, eventual consistency on policy fanout.",
  },

  /* ── OpenAI / Anthropic / Sarvam — AI engineering (2026) ─────── */
  {
    text: "Walk me through how you'd evaluate an LLM-based customer-support bot in production. What's your eval harness?",
    company: "openai", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "2026-era AI eng rounds care about evals as first-class engineering: golden datasets, LLM-as-judge with rubrics, drift detection, A/B at the response level.",
  },
  {
    text: "Design an agent that can book a flight. Handle: tool failure mid-conversation, partial state, prompt-injection from a malicious airline page.",
    company: "anthropic", roleFamily: "ml", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Agentic-system design is now table stakes. Probes: state machine, MCP/tool-use, sandboxing, prompt-injection defenses (input filtering, structured outputs, never-trust-tool-results).",
  },
  {
    text: "Why does Sarvam's Indic LLM outperform GPT on some Hindi tasks despite being smaller? How would you measure it without bias?",
    company: "sarvam", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Indic-AI hiring expects domain insight: tokenization, training-mix, eval-set bias, IndicGenBench. 'It's smaller and faster' fails.",
  },

  /* ── Salary negotiation — multi-tier patterns (2026) ────────── */
  {
    text: "We've benchmarked your offer at ₹42 LPA fixed + ₹8 LPA RSU vesting over 4 years. Where do you see this against your other options?",
    company: "google", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "FAANG India 2026 opening offer for 5-7 YOE SWE. The 'where do you see this against your other options' invites you to disclose competing offers — disclose only ranges, never specific numbers.",
  },
  {
    text: "We can't move on base, but we can frontload your equity vesting — 30/30/20/20 instead of 25/25/25/25. Does that work for you?",
    company: "phonepe", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Common 2026 unicorn pattern post-IPO-wave: vesting acceleration as a counter-lever when base is capped. Real value depends on how confident you are about staying 4 years.",
  },
  {
    text: "Your current CTC is ₹22 LPA. We're offering ₹32 LPA — that's a 45% hike, which is well above market norms. Can you accept by Friday?",
    company: "tcs", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "IT-services 2026 anchor + deadline pressure. The 'above market norms' framing is meant to discourage negotiation. Counter-anchor on tier of target role, not on % hike.",
  },
  {
    text: "We don't typically do joining bonuses, but if your notice buyout is the blocker we can do up to ₹2 LPA as a one-time signing.",
    company: "razorpay", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Joining-bonus as concession lever. Decent at unicorns. Pin down: clawback period (usually 1-2 yrs), tax treatment.",
  },
  {
    text: "Honest question — what would it take to get you to say yes today?",
    company: "atlassian", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Sophisticated closing move. Sounds friendly but is asking you to drop your last leverage. Counter: 'Let me think about it overnight' — never reveal your floor at the table.",
  },
];
