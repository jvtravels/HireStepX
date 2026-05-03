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
  | "google" | "amazon" | "microsoft" | "meta"
  | "flipkart" | "razorpay" | "swiggy" | "zomato" | "phonepe" | "paytm"
  | "tcs" | "infosys" | "wipro"
  | "uber" | "atlassian";

export type RoleFamily = "swe" | "pm" | "em" | "data" | "design" | "behavioral";
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
];
