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
  | "ltimindtree" | "hcl" | "capgemini" | "ibm"
  | "uber" | "atlassian" | "stripe" | "linkedin" | "adobe"
  | "mckinsey" | "bcg" | "bain" | "deloitte"
  | "goldman" | "jpmc" | "morgan-stanley"
  | "jane-street" | "de-shaw" | "citadel"
  | "openai" | "anthropic" | "sarvam"
  /* Government / PSU bodies — distinct from corporate companies in
     hiring format. UPSC = civil services; SSC = staff selection
     (Group B/C); IBPS = banking PO; RBI = central-bank Grade B; ISRO
     /DRDO = scientist viva; SSB = defence forces. */
  | "upsc" | "ssc" | "ibps" | "rbi" | "sebi" | "isro" | "drdo" | "ssb";

export type RoleFamily =
  | "swe" | "pm" | "em" | "data" | "design" | "behavioral"
  | "consultant" | "quant" | "ml" | "writer" | "ds-research"
  | "designer-senior" | "salary"
  /* Govt/PSU role families — civil-services and defence-services
     have radically different formats from private-sector behavioral
     so they get their own retrieval families. */
  | "civil-services" | "defence" | "psu-engineer" | "scientist"
  /* Campus placement is a distinct lifecycle stage, not a role.
     Used for fresher pipelines (TCS NQT, Infosys InfyTQ, etc.). */
  | "campus";
export type FocusArea =
  | "behavioral" | "technical" | "system-design" | "case-study"
  | "campus-placement" | "hr" | "panel" | "salary-negotiation"
  | "leadership" | "general"
  /* Management is now a distinct focus (was silently falling back
     to behavioral). EM/director rounds have unique probes around
     hiring/firing, scaling, performance management, cross-functional
     alignment — different signal from generic behavioral. */
  | "management"
  /* Government / PSU is a distinct focus (was missing entirely).
     UPSC personality-test format, SSB defence rounds, RBI Grade B
     descriptive-paper rounds, ISRO/DRDO scientist viva. */
  | "government-psu";

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
  /** Confidence in this entry's accuracy.
   *   - "verified" (default): cross-checked against 2+ independent
   *     sources (Glassdoor + AmbitionBox + candidate post-mortem).
   *   - "inferred": pattern extrapolated from public job descriptions
   *     or single-source candidate posts. The LLM is told these are
   *     directional, so it doesn't anchor too hard on the specifics.
   *
   *  Treat absent as "verified" to keep existing entries accurate. */
  confidence?: "verified" | "inferred";
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
    confidence: "inferred",
  },
  {
    text: "Design an agent that can book a flight. Handle: tool failure mid-conversation, partial state, prompt-injection from a malicious airline page.",
    company: "anthropic", roleFamily: "ml", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Agentic-system design is now table stakes. Probes: state machine, MCP/tool-use, sandboxing, prompt-injection defenses (input filtering, structured outputs, never-trust-tool-results).",
    confidence: "inferred",
  },
  {
    text: "Why does Sarvam's Indic LLM outperform GPT on some Hindi tasks despite being smaller? How would you measure it without bias?",
    company: "sarvam", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Indic-AI hiring expects domain insight: tokenization, training-mix, eval-set bias, IndicGenBench. 'It's smaller and faster' fails.",
    confidence: "inferred",
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

  /* ── UPSC Civil Services Personality Test (PT) ────────────────── */
  {
    text: "Why do you want to join the IAS specifically, and not the IRS or IFS where your optional subject would give you a better edge?",
    company: "upsc", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "UPSC PT classic: tests service-cadre awareness + self-knowledge. Generic 'I want to serve the nation' fails. Ground in district-level admin specifics + why your optional + DAF profile point here.",
  },
  {
    text: "You're posted as DM in a district where there's communal tension over a religious procession. The SP recommends imposing Section 144. What do you do?",
    company: "upsc", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "PT ethics + administration scenario. Look for: hearing both communities, situation-specific (not template) decision, awareness of CrPC 144 consequences, communication strategy with media + public.",
  },
  {
    text: "You're from <home state>. Tell me about a current administrative issue in your home state and what you'd do as collector.",
    company: "upsc", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "DAF-grounded current-affairs probe. Must show specific district / scheme-level knowledge of home state, not generic national-level talking points.",
  },
  {
    text: "Critics say AI will eliminate clerical jobs in panchayats and tahsil offices over the next 5 years. As a civil servant, what's your stance?",
    company: "upsc", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "2026-relevant tech-policy ethics. Probe: balanced view (productivity vs. transition cost), awareness of digital India / Bhashini, concrete policy levers (reskilling budget, phased rollout). Hard pro/anti stance fails.",
  },
  {
    text: "Your honest opinion: should India have a uniform civil code? Defend your position.",
    company: "upsc", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Politically sensitive PT question. Look for: constitutional grounding (Art 44), nuance acknowledging different stakeholder views, ability to defend a position calmly under pushback. Fence-sitting OR rigid ideology both fail.",
  },

  /* ── SSB Defence Services (Indian Army / Navy / Air Force) ──── */
  {
    text: "Group Discussion topic: 'Should women be inducted into combat roles in the Indian Army?' You have 5 minutes; you're one of 8 candidates.",
    company: "ssb", roleFamily: "defence", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "SSB Stage 2 GD format. Tests: speaking up early without dominating, building on others' points, balancing operational vs. social-justice angles, body language during pauses. Aggression / silence both fail.",
  },
  {
    text: "GTO Task: Your team has 6 minutes to cross a 12-foot ditch using one wooden plank, one rope, and three drums. The plank is 8 feet. As Indicator, brief the GTO on your plan in 30 seconds.",
    company: "ssb", roleFamily: "defence", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Group Task Officer (GTO) ground-task. Tests practical problem-solving + leadership + communication under pressure. Plan must be physically feasible AND clearly communicable. Fancy-but-impractical solutions get cut.",
  },
  {
    text: "Personal Interview: You have 3 friends, your last grade was 68%, you didn't take any sports leadership in college. Why should we recommend you for the Indian Army?",
    company: "ssb", roleFamily: "defence", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "SSB Personal Interview rapid-fire profile probe. The IO is testing handling pressure + self-awareness + concrete (not theoretical) leadership/grit examples. Defensive answers fail; concrete instances of pulling something off despite gaps win.",
  },

  /* ── RBI Grade B Phase II (descriptive paper / interview) ──── */
  {
    text: "RBI cut the repo rate by 25 bps last quarter, but credit growth in MSMEs hasn't picked up. As a Grade B officer in DEPR, what's your diagnosis?",
    company: "rbi", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "RBI Grade B Phase III interview. Tests monetary-policy transmission understanding + sectoral lens. Probes expected: bank balance sheets, MSME risk premia, NBFC role, structural vs. cyclical demand factors.",
  },
  {
    text: "Phase II ESI descriptive paper, 30 min: 'Discuss the trade-offs between financial inclusion and macroprudential stability in the context of India's UPI-led payments boom.' Outline your answer.",
    company: "rbi", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "RBI Phase II descriptive. Look for: structured answer (intro / body with 3+ points / conclusion), data anchors (UPI volumes, financial-inclusion indices), citing specific RBI publications (Financial Stability Report).",
  },

  /* ── SSC CGL / Banking IBPS PO ─────────────────────────────────── */
  {
    text: "GD topic for IBPS PO: 'Should small-finance banks be allowed to convert into universal banks?' 8-min discussion, you're 1 of 10.",
    company: "ibps", roleFamily: "psu-engineer", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "IBPS PO group discussion. Banking-specific topic; tests sectoral awareness + GD etiquette (entering, not interrupting, summarising). Generic CSR / women-empowerment templates fail here — banking literacy required.",
  },
  {
    text: "PI: Why banking, why this bank, why now? You have a B.Tech IT degree — why aren't you sitting for IT placements?",
    company: "ibps", roleFamily: "psu-engineer", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Standard IBPS-PO panel interview. Engineering-degree background is the most-probed angle. Concrete answers (job-security, family considerations, public-service interest) outscore aspirational framing.",
  },

  /* ── ISRO / DRDO scientist viva ───────────────────────────────── */
  {
    text: "Walk me through your M.Tech thesis. What was the novelty? What didn't work, and why?",
    company: "isro", roleFamily: "scientist", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "ISRO/DRDO scientist viva opening. Tests technical depth + intellectual honesty (the 'didn't work' probe is mandatory). Glossing over failures = instant fail.",
  },
  {
    text: "Suppose you're designing a guidance algorithm for a ground-launched intercept missile. What sensors would you fuse, and why?",
    company: "drdo", roleFamily: "scientist", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "DRDO domain viva. Lab-specific (RCI, ADA, LRDE) probe. Probes: sensor-fusion theory + practical constraints (latency, jamming, weight). Must defend trade-offs articulately.",
  },
  {
    text: "What's the difference between geostationary and geosynchronous orbits, and why does GSAT-29 sit where it does?",
    company: "isro", roleFamily: "scientist", focus: "government-psu",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "ISRO entry-level fundamentals viva. Specific-mission grounding ('why GSAT-29') tests beyond textbook knowledge.",
  },

  /* ── Campus Placements — TCS NQT ────────────────────────────── */
  {
    text: "Walk me through a project from your final year. Why did you choose this stack? Where did it break?",
    company: "tcs", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup",
    styleNote: "TCS NQT Tech round opener. Tests genuine project ownership vs. group-project free-riders. 'My contribution was X' specificity expected.",
  },
  {
    text: "Why TCS specifically? You've also applied to Infosys and Wipro — what's different about TCS for you?",
    company: "tcs", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "TCS HR round. Generic 'big brand, good training' fails. Concrete: TCS-specific hiring patterns (NQT consistency), training (TCS Ignite), client portfolio research.",
  },
  {
    text: "Are you willing to relocate to Trivandrum or Bhubaneswar within 2 weeks of joining? And work in night shifts for client time-zones if needed?",
    company: "tcs", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "TCS HR signature question. Tests realistic acceptance vs. impressive-sounding 'yes' that the recruiter knows is brittle. Honest 'I'd prefer X but I'm flexible' beats blanket assent.",
  },

  /* ── Campus Placements — Infosys InfyTQ ─────────────────────── */
  {
    text: "Code: Given a string, find the first non-repeating character in O(n) using a single pass. Walk me through your approach before writing.",
    company: "infosys", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "InfyTQ technical round. Tests articulating approach BEFORE coding (vs. silent-coding). LinkedHashMap or two-pass with hash map both acceptable.",
  },
  {
    text: "If you're given a 6-month-old project written in legacy Java by someone who's left, walk me through how you'd onboard yourself in week 1.",
    company: "infosys", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Infosys InfyTQ scenario round. Tests SDLC awareness + structured onboarding thinking. Wants: read docs, run end-to-end, find a small fixable bug, talk to PM/client. 'I'd ask my manager' alone fails.",
  },

  /* ── Campus Placements — Wipro NLTH ─────────────────────────── */
  {
    text: "What's the difference between OOP and procedural programming? Give me a real-world example where one is clearly better than the other.",
    company: "wipro", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup",
    styleNote: "Wipro NLTH technical-fundamentals round. Textbook definition fails — wants concrete examples (e.g. banking system → OOP for accounts; data ETL → procedural fine).",
  },
  {
    text: "Tell me about a time you handled ambiguity. Specific story, please.",
    company: "wipro", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Wipro 'Spirit of Wipro' (integrity, customer-centricity) cultural fit. STAR format expected even from freshers.",
  },

  /* ── Campus Placements — Cognizant GenC / GenC Next ─────────── */
  {
    text: "GenC Next aptitude follow-up: Explain how a hash table handles collisions. Now tell me which Indian app you've used that you suspect uses one heavily.",
    company: "cognizant", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Cognizant GenC Next technical round. Two-part: textbook + applied speculation. Tests connecting CS concepts to real systems (Ola/Swiggy lookup, IRCTC seat-booking).",
  },

  /* ── Campus Placements — Accenture ──────────────────────────── */
  {
    text: "Accenture cares about 'innovation, inclusion, stewardship'. Pick one and tell me a college instance where you embodied it.",
    company: "accenture", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Accenture campus values-anchor question. The values are explicit on their careers page; not knowing them = unprepared. Concrete college example (club, project, fest) > abstract reflection.",
  },

  /* ── Campus Placements — Amazon SDE-1 / Flipkart GET ────────── */
  {
    text: "Reverse a linked list, then find the middle node in a single pass. Walk me through both, then explain the time/space complexity.",
    company: "amazon", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Amazon SDE-1 campus round. DSA bar is real but warmup-tier. Articulating complexity = the actual signal; finding the answer is table stakes.",
  },
  {
    text: "Tell me about a time in college you took ownership of something nobody asked you to. (LP: Ownership)",
    company: "amazon", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Amazon LP for campus. STAR format expected even at fresher level. 'Volunteered for X' weak — wants self-initiated + measurable outcome.",
  },
  {
    text: "Design a basic library-management system. Tell me your data model and 2-3 endpoints.",
    company: "flipkart", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Flipkart GET / SDE-1 campus design round. Calibrated for fresher — wants entities + relationships + key endpoints, NOT distributed-systems framing. Over-engineering = lack of judgement.",
  },

  /* ── Management / Engineering Manager focus ─────────────────── */
  {
    text: "Walk me through a 1:1 you ran with a low performer. What did you say in the first five minutes?",
    company: "atlassian", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Probes managerial directness + empathy. Bad answer: 'I told them about the performance gap' (vague). Good: opening line, what data you brought, how you set up safety to talk honestly.",
  },
  {
    text: "How did you scale your engineering team from ~8 to ~30 in 18 months without breaking velocity?",
    company: "razorpay", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "EM scaling probe. Wants: hiring rubric + onboarding system + sub-team formation calc + DORA-metric tracking. Vague 'we hired carefully' fails.",
  },
  {
    text: "Tell me about an underperformer you had to let go. How long did you wait, and how did you know it was time?",
    company: "google", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Hardest EM question. Tests: clarity on PIP timeline, willingness to defend the call, awareness of legal/HR/process boundaries (especially India-specific labour). 'I never had to' is suspicious.",
  },
  {
    text: "Your VP wants Q3 features shipped 4 weeks early. Your tech lead says it's impossible without skipping testing. How do you handle?",
    company: "amazon", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Cross-functional escalation. Tests: pushing back on VP with data + offering reduced-scope counter, vs. rolling over OR rolling tech lead over. Either extreme fails.",
  },
  {
    text: "How do you measure your team's health beyond velocity? Walk me through 3 signals you actually look at weekly.",
    company: "stripe", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "EM signal-craft probe. Generic 'eNPS' weak — wants specifics (review-cycle latency, on-call distribution, 1:1 cancellation rate, code-review p90). Stripe-style writing-clarity expected.",
  },
  {
    text: "How do you decide when to promote a senior engineer to staff? What's the moment they crossed the line?",
    company: "microsoft", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Promotion calibration. Wants: scope-of-influence + ambiguity-handling + mentorship-of-others, NOT 'they shipped a hard project'. Good answer cites a specific moment of demonstrated staff-level judgement.",
  },
  {
    text: "Two of your senior engineers want the same architecture lead role. Both are good. Walk me through how you handled the conversation.",
    company: "flipkart", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Zero-sum people decision. Tests transparency, retention thinking, and willingness to have hard conversations. Avoid 'I let HR decide' — interviewer wants YOUR play.",
  },
  {
    text: "Describe a time you killed a project that the team had spent 6+ months on. How did you announce it?",
    company: "swiggy", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Hardest delivery-pivot moment. Wants: sunk-cost discipline + team morale repair + leadership communication craft. Sample line of the actual announcement is gold.",
  },
  {
    text: "How do you onboard a senior hire — say a Staff Engineer with 10 YOE — versus a junior new-grad? What's different about the first 30 days?",
    company: "atlassian", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Onboarding craft. Tests calibration: senior hire = autonomy + context-load + early-win identification; junior = scaffolding + safety + ramp-up. Same playbook for both = fail.",
  },
  {
    text: "Your team's morale has dropped after a re-org but no one will say it directly in 1:1s. How do you read the signal and intervene?",
    company: "phonepe", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Soft-signal-reading EM probe. Wants: behavioral-data signals (Slack quietness, code-review-tone shift, meeting-camera-off rate), structured intervention (skip-levels, anonymous pulse, public acknowledgement of the change).",
  },
];
