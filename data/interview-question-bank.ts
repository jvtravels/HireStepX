/* HireStepX, Curated interview-question bank
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
  | "salesforce" | "cisco" | "oracle" | "nvidia"
  | "hdfc" | "icici"
  | "hul" | "p&g" | "itc"
  /* Government / PSU bodies, distinct from corporate companies in
     hiring format. UPSC = civil services; SSC = staff selection
     (Group B/C); IBPS = banking PO; RBI = central-bank Grade B; ISRO
     /DRDO = scientist viva; SSB = defence forces. */
  | "upsc" | "ssc" | "ibps" | "rbi" | "sebi" | "isro" | "drdo" | "ssb"
  /* Core-engineering / PSU / manufacturing campus recruiters, added
     2026-Q2 to support non-IT campus pipelines (mech / elec / civil).
     These dominate tier-2/3 college placements and were previously
     getting routed to generic behavioral. */
  | "l-and-t" | "bhel" | "ongc" | "ntpc" | "mahindra" | "bajaj"
  | "cummins" | "tata-steel" | "samsung"
  /* Indian unicorns / consumer tech wave 2 */
  | "nykaa" | "myntra" | "dream11" | "rapido" | "zepto" | "blinkit"
  | "ola" | "ola-electric" | "ather-energy" | "cars24" | "spinny"
  | "byjus" | "unacademy" | "physicswallah" | "vedantu" | "scaler"
  /* Banking / FinTech */
  | "hdfc-bank" | "axis" | "kotak" | "sbi" | "barclays" | "hsbc"
  | "deutsche-bank" | "wells-fargo" | "citi" | "bny-mellon"
  | "standard-chartered" | "morgan-stanley-india"
  | "upstox" | "angel-one" | "zerodha-india" | "groww"
  | "bharatpe" | "cashfree" | "acko" | "digit" | "pine-labs"
  | "star-health" | "icici-lombard" | "bajaj-finance"
  | "juspay" | "slice" | "jupiter" | "fi-money" | "policybazaar"
  | "nium" | "khatabook" | "smallcase" | "zeta" | "navi" | "kreditbee"
  | "moneyview" | "fibe" | "indmoney" | "rupeek" | "niyo"
  | "mastercard" | "visa-india" | "fiserv"
  /* Enterprise GCCs */
  | "qualcomm" | "mediatek" | "servicenow" | "workday" | "vmware"
  | "sap-labs" | "siemens-india" | "bosch-india" | "texas-instruments"
  | "intel-india" | "arm-india" | "thoughtworks" | "samsung-india"
  | "ericsson-india" | "nokia-india" | "ntt-data" | "globallogic"
  | "lowes-india" | "target-india"
  /* IT services / consulting */
  | "mphasis" | "techmahindra" | "persistent" | "ey" | "kpmg" | "pwc"
  /* D2C / Consumer / FMCG */
  | "lenskart" | "mamaearth" | "boat" | "wakefit" | "dmart" | "godrej"
  | "nestle" | "procter-gamble"
  /* Healthcare */
  | "metropolis" | "curefit" | "dr-lal-pathlabs" | "tata-1mg" | "apollo-247" | "medibuddy"
  /* Mobility / Auto */
  | "tata-motors" | "mahindra-india"
  /* Startups / SaaS */
  | "postman" | "browserstack" | "chargebee" | "intuit"
  | "walmart-global-tech" | "optiver" | "millennium"
  | "practo" | "shiprocket" | "udaan" | "moglix" | "ninjacart" | "licious"
  | "rebel-foods" | "purplle" | "blackbuck" | "shadowfax" | "hasura"
  | "gupshup" | "exotel" | "plivo" | "bigbasket" | "delhivery"
  | "makemytrip" | "ixigo" | "sharechat" | "moengage" | "clevertap"
  | "druva" | "darwinbox" | "truecaller" | "inmobi" | "naukri"
  | "sigmoid" | "mindtickle" | "tracxn"
  | "m2p-fintech" | "capillary-tech" | "ecom-express" | "yulu"
  | "country-delight" | "rivigo" | "sumologic" | "clari"
  /* Conglomerates / PSUs */
  | "hdfc-ltd" | "tata-steel-india" | "sarvam-ai" | "krutrim" | "perplexity" | "databricks" | "tower-research"
  /* Generic campus / fresher pages not tied to a single company. */
  | "campus";

export type RoleFamily =
  | "swe" | "pm" | "em" | "data" | "design" | "behavioral"
  | "consultant" | "quant" | "ml" | "writer" | "ds-research"
  | "designer-senior" | "salary"
  /* Govt/PSU role families, civil-services and defence-services
     have radically different formats from private-sector behavioral
     so they get their own retrieval families. */
  | "civil-services" | "defence" | "psu-engineer" | "scientist"
  /* Campus placement is a distinct lifecycle stage, not a role.
     Used for fresher pipelines (TCS NQT, Infosys InfyTQ, etc.). */
  | "campus"
  /* Non-tech specialised families (added 2026-Q2 to address audit
     finding that 496 roles were routing to generic behavioral).
     Each gets dedicated bank entries for role-specific probes. */
  | "sales" | "marketing" | "finance" | "legal" | "healthcare" | "ops"
  /* Banking subfamily (RM / branch / BFSI sales). */
  | "bfsi-sales"
  /* HR / People / Talent family, distinct interview format from
     generic behavioral. HRBP / TA / Comp / L&D / Workday-Specialist
     all route here. Unlike `behavioral` (STAR-style probes for any
     role), `hr` rounds focus on org-design, conflict resolution,
     comp benchmarking, hire/fire scenarios, IR/labour-law context. */
  | "hr";
export type FocusArea =
  | "behavioral" | "technical" | "system-design" | "case-study"
  | "campus-placement" | "hr" | "panel" | "salary-negotiation"
  | "leadership" | "general"
  /* Management is now a distinct focus (was silently falling back
     to behavioral). EM/director rounds have unique probes around
     hiring/firing, scaling, performance management, cross-functional
     alignment, different signal from generic behavioral. */
  | "management"
  /* Government / PSU is a distinct focus (was missing entirely).
     UPSC personality-test format, SSB defence rounds, RBI Grade B
     descriptive-paper rounds, ISRO/DRDO scientist viva. */
  | "government-psu"
  /* Strategic was aliased to case-study, but the formats genuinely
     differ: case = framework + structured analysis under interviewer
     guidance; strategic = defending a position / vision / bet to
     senior stakeholders (board, investors, exec leadership). Split
     so retrieval doesn't conflate the two. */
  | "strategic";

export interface BankEntry {
  /** Question text, anchored, never shown verbatim to the user. */
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
    styleNote: "Flipkart engineering loves India-specific constraints: pincode coverage, monsoon patterns, kirana partnerships.",
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
    styleNote: "Razorpay loves real production scenarios: payments failures, NPCI rate limits, settlement reconciliation. Be specific.",
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
    styleNote: "Swiggy PM rounds heavily test marketplace dynamics: partner economics, delivery-partner availability, demand-supply imbalance.",
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
    styleNote: "PhonePe engineering rounds are scale-obsessed: every answer should explicitly address throughput, latency, and cost at India scale.",
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
    styleNote: "TCS Ninja/Digital tracks lean heavily on CS fundamentals: OOP, OS, DBMS, SQL basics. Expect rapid-fire Q's, not deep dives.",
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
    styleNote: "Infosys campus rounds dwell on the academic project: be ready for 5-6 follow-ups on architecture, your role, and trade-offs.",
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
    text: "Walk me through your resume, starting from your most recent experience.",
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
    styleNote: "Atlassian leans hard on their values: 'Open company, no bullshit', 'Play as a team'. Anchor stories to one explicitly.",
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

  /* ── Amazon SDE2 / India 2026, Leadership Principles deep-dive ──── */
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
    styleNote: "Amazon LP: Bias for Action + Dive Deep. They want runbooks, MTTR numbers, root-cause depth, not 'we paged the on-call'.",
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

  /* ── Stripe, bug-bash + writing clarity (2026) ─────────────────── */
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
    styleNote: "Stripe API design rounds dig into edge cases. The 'different body, same key' case is a classic: the answer is to reject, not silently overwrite.",
  },
  {
    text: "Explain webhooks vs. polling for a developer who has never built a payment integration. You have 4 sentences.",
    company: "stripe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Stripe values writing clarity above almost everything. Length-constrained explanation tests prioritisation of ideas.",
  },

  /* ── Razorpay, fintech depth + ML risk (2026) ──────────────────── */
  {
    text: "Walk me through Razorpay's fraud-detection model. How would you reduce false positives without increasing chargeback losses?",
    company: "razorpay", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Razorpay ML rounds tie model decisions to ₹ impact, chargeback cost vs. blocked-good-txn cost. Pure ML answers without business framing fail.",
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

  /* ── PhonePe, UPI scale + reliability (2026) ───────────────────── */
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

  /* ── Atlassian PM (2026), value-driven 5-question structure ─── */
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
    text: "A PM at Atlassian needs to lead and inspire, seek mastery, communicate, and deliver outcomes. Tell me about a time you fell short on one of these, which one and what changed?",
    company: "atlassian", roleFamily: "pm", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Atlassian's 4 PM expectations are publicly published. Self-aware failure stories anchored to one of them outscore polished success stories.",
  },

  /* ── Microsoft PM (2026), growth mindset ───────────────────── */
  {
    text: "Describe a product decision you got wrong. What did you learn that you've applied since?",
    company: "microsoft", roleFamily: "pm", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Microsoft growth-mindset signature question. They want a real wrong call (not 'we shipped a feature 2 weeks late'), the cost, and a specific changed behaviour.",
  },
  {
    text: "Design Copilot for a non-technical audience, say, a small-business owner doing their GST filing. What's the killer feature?",
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
    styleNote: "Bain frequently uses PE-DD cases. Conversational style, interviewer will guide if you're stuck. Top 3: market growth defensibility, route-density economics, working-capital cycle.",
  },

  /* ── Jane Street, probability + mental math (2026) ──────────── */
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

  /* ── DE Shaw, algorithms + math intuition ──────────────────── */
  {
    text: "Find the median of two sorted arrays in O(log(min(m,n))). Explain why your invariant is correct, not just that it works.",
    company: "de-shaw", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "DE Shaw probes whether you understand the algorithm vs. memorised LeetCode 4. Push for the partition-invariant proof.",
  },

  /* ── Goldman Sachs, engineering + market context (2026) ────── */
  {
    text: "Tell me about a time you handled pressure from a deadline you knew you'd miss. What did you tell stakeholders, and when?",
    company: "goldman", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Goldman 14 Business Principles bias. They want early communication + concrete remediation, not heroism narratives.",
  },

  /* ── CRED, design / craft / pushback (2026) ─────────────────── */
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

  /* ── Zerodha, first-principles eng (2026) ──────────────────── */
  {
    text: "We have 1M users hitting the order-book endpoint simultaneously at 9:15am. We don't want to use Redis or any managed cache. How would you handle it?",
    company: "zerodha", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Zerodha intentionally constrains stack to test fundamentals. In-process cache, careful invalidation, single-binary thinking. 'I'd use Redis' fails the round.",
  },

  /* ── Meesho, Bharat user empathy (2026) ────────────────────── */
  {
    text: "A reseller in Tier-3 India earns ₹3,000/month from Meesho. Walk me through how she actually uses the app on her ₹6K phone, what frustrates her, and one feature you'd build.",
    company: "meesho", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Meesho PM rounds test whether you actually understand the Bharat-female-reseller persona vs. urban-ICP fluency. Vernacular, low-bandwidth, WhatsApp-native answers expected.",
  },

  /* ── Freshworks, global SaaS engineering (2026) ────────────── */
  {
    text: "Design a multi-tenant authorization service that supports both row-level and column-level permissions across 10K customers.",
    company: "freshworks", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Freshworks engineering bar = US SaaS, not Indian unicorn. Multi-tenancy isolation, ABAC policy, eventual consistency on policy fanout.",
  },

  /* ── OpenAI / Anthropic / Sarvam, AI engineering (2026) ─────── */
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

  /* ── Salary negotiation, multi-tier patterns (2026) ────────── */
  {
    text: "We've benchmarked your offer at ₹42 LPA fixed + ₹8 LPA RSU vesting over 4 years. Where do you see this against your other options?",
    company: "google", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "FAANG India 2026 opening offer for 5-7 YOE SWE. The 'where do you see this against your other options' invites you to disclose competing offers, disclose only ranges, never specific numbers.",
  },
  {
    text: "We can't move on base, but we can frontload your equity vesting, 30/30/20/20 instead of 25/25/25/25. Does that work for you?",
    company: "phonepe", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Common 2026 unicorn pattern post-IPO-wave: vesting acceleration as a counter-lever when base is capped. Real value depends on how confident you are about staying 4 years.",
  },
  {
    text: "Your current CTC is ₹22 LPA. We're offering ₹32 LPA, that's a 45% hike, which is well above market norms. Can you accept by Friday?",
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
    text: "Honest question, what would it take to get you to say yes today?",
    company: "atlassian", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Sophisticated closing move. Sounds friendly but is asking you to drop your last leverage. Counter: 'Let me think about it overnight', never reveal your floor at the table.",
  },
  {
    text: "Our offer is ₹38 LPA fixed + 15% bonus + ₹65 LPA RSUs vesting 25/25/25/25 over 4 years. We also have a 15% ESPP discount with a 6-month look-back. Where do you see this against your other options?",
    company: "microsoft", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "Big Tech / GCC India 2026 standard structure for senior SWE/PM. Candidate should ask if ESPP is automatic enrolment, the look-back FMV reference, and clarify RSU 30%+ sell-to-cover at vest. ESPP alone is worth ~5-10% of base if maxed (10-15% of salary contributable up to $25K/yr in parent currency).",
  },
  {
    text: "We can't budge on the cash, but we can move the post-termination ESOP exercise window from 90 days to 7 years. How does that change the package for you?",
    company: "cred", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "Top-quartile unicorn 2026 lever, the exercise-window concession. 90-day → 7-year windows changes effective ESOP NPV by 30-60% for long-tenure candidates. Offer-stage negotiable; almost never re-opened post-signing. Senior candidates who don't ask leave real money on the table.",
  },
  {
    text: "Our budget is ₹45 LPA fixed plus a 30% target bonus, but the bonus is tied to firm-wide P&L, last year payouts ranged 40% to 130% of target. Can you live with that variability?",
    company: "goldman", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "BFSI / IB India pattern: heavy variable share with firm-P&L tie. Negotiate the floor (push for ₹2-3L variable-floor guarantee year-1) rather than the target. Counter the bonus structure with: 'What's the 5-year median realisation?', most banks won't share but the question signals you understand the risk.",
  },
  {
    text: "We're at ₹52 LPA fixed; you wanted ₹58 LPA. We can't move the headline, but our finance team can structure 14% of basic into corporate NPS Tier 1, same CTC for us, ~₹1L+ extra in your pocket post-tax. Does that close the gap?",
    company: "zomato", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "2025 NPS unlock, biggest restructuring play in the Indian market. §80CCD(2) cap raised 10% → 14% of basic for all private-sector under new tax regime (Apr 2025). Tax-free routing of ~₹1.5-3L on senior CTCs. Most large employers will agree, it's a payroll setting, not a comp negotiation. Watch the ₹7.5L combined cap (PF + NPS + Super) on very-senior offers (basic > ₹40L).",
  },
  {
    text: "Standard package: ₹35 LPA fixed + ₹4 LPA sign-on (clawback over 2 years) + relocation ₹3 LPA. Our consulting bands are tight, base is fixed for your level, and joining bonus is the only flex.",
    company: "mckinsey", roleFamily: "consultant", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "standard",
    styleNote: "MBB consulting India 2026 norm: rigid bands, joining-bonus as the only real lever. Counter on relocation generosity, post-MBA promotion timing, and study-program reimbursement (sometimes ₹5-15L for Wharton/Stanford EMBA). Don't push base, it's tied to cohort equity and signals you don't understand the firm.",
  },
  {
    text: "Your current CTC is ₹14 LPA at TCS. We're offering ₹19 LPA, a 35% hike. Variable is 15% of CTC, paid quarterly. Variable realised average has been 65-80% lately. When can you join?",
    company: "infosys", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "standard",
    styleNote: "IT services 2026 reality: variable target ≠ variable realised. Q4 FY25 actuals: TCS 100%, Wipro 90%, Infosys 65%. Counter by asking for fixed-CTC framing instead of total-CTC ('₹14L hike on FIXED, not on inclusive-of-variable'). Senior IT services bands have higher variable share AND lower realisation, push to convert variable to fixed where possible.",
  },
  {
    text: "We're offering ₹48 LPA fixed + ₹15 LPA RSU (Apple stock, 25/25/25/25 over 4 years). Apple India's RSU refresh cycle is annual at ~₹10 LPA. Your competing offer at Razorpay was ₹52 LPA + ESOPs, how do you weigh that against listed-company liquidity?",
    company: "apple", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "Big Tech India 2026 standard. Listed-stock RSUs (Apple/Microsoft/Google) are tradable on vest day; ESOPs at unicorns are illiquid until buyback or IPO. Discount unicorn ESOPs by 30-50% face value when comparing. Refresh grants stack, by year 3, total annual vest can be 1.5-2x year-1.",
  },
  {
    text: "Our seed-stage budget is ₹22 LPA fixed plus 0.4% equity (1.6L shares at face value ₹10, current 409A ₹250). We can't move on cash but we can go up to 0.6%. We've raised our seed; Series A is targeted in 18 months.",
    company: "stripe", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "Early-stage / seed-Series-A-style offer (using Stripe as the recognised proxy). Apply 70-80% expected-value discount to face equity, most early ESOPs expire worthless. Negotiate: (a) extended exercise window (7+ yrs vs 90 days), (b) acceleration on change-of-control, (c) refresh-grant policy at next round. Headline equity % is meaningless without these terms.",
  },
  {
    text: "₹38 LPA fixed + ₹6 LPA target variable + ESPP at 15% discount (Freshworks NASDAQ-listed). We can stretch to ₹40 LPA but variable doesn't move. What does it take to get you across the line?",
    company: "freshworks", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "standard",
    styleNote: "Listed Indian SaaS unicorn (Freshworks went public 2021). ESPP at 15% discount with look-back is real liquidity vs unicorn ESOP, ~17.6% guaranteed gross return per cycle when maxed. Counter by anchoring on competing tier rather than 'across the line', the latter signals desperation. Listed SaaS is 1.2-1.4x unicorn cash bands at senior, well below FAANG.",
  },
  {
    text: "Our offer is ₹62 LPA fixed + 20% target bonus + ₹40 LPA RSU vesting 4 years. New grants are 25/25/25/25, but we have a legacy 5/15/40/40 option for senior hires who commit to 4-year tenure. Which would you prefer?",
    company: "amazon", roleFamily: "salary", focus: "salary-negotiation",
    addedQuarter: "2026-Q4", difficulty: "intense",
    styleNote: "Amazon 2026 vesting structure question, they historically used 5/15/40/40 (back-loaded, retention-focused) and now offer 25/25/25/25 to compete with Google/Microsoft. Front-loaded is better for shorter-tenure plans (1-2 years), back-loaded gives more if you stay the full 4 years. Pick based on your honest tenure intent, not on which sounds bigger at year-1.",
  },
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
    styleNote: "IBPS PO group discussion. Banking-specific topic; tests sectoral awareness + GD etiquette (entering, not interrupting, summarising). Generic CSR / women-empowerment templates fail here, banking literacy required.",
  },
  {
    text: "PI: Why banking, why this bank, why now? You have a B.Tech IT degree, why aren't you sitting for IT placements?",
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

  /* ── Campus Placements, TCS NQT ────────────────────────────── */
  {
    text: "Walk me through a project from your final year. Why did you choose this stack? Where did it break?",
    company: "tcs", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup",
    styleNote: "TCS NQT Tech round opener. Tests genuine project ownership vs. group-project free-riders. 'My contribution was X' specificity expected.",
  },
  {
    text: "Why TCS specifically? You've also applied to Infosys and Wipro, what's different about TCS for you?",
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

  /* ── Campus Placements, Infosys InfyTQ ─────────────────────── */
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

  /* ── Campus Placements, Wipro NLTH ─────────────────────────── */
  {
    text: "What's the difference between OOP and procedural programming? Give me a real-world example where one is clearly better than the other.",
    company: "wipro", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup",
    styleNote: "Wipro NLTH technical-fundamentals round. Textbook definition fails, wants concrete examples (e.g. banking system → OOP for accounts; data ETL → procedural fine).",
  },
  {
    text: "Tell me about a time you handled ambiguity. Specific story, please.",
    company: "wipro", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Wipro 'Spirit of Wipro' (integrity, customer-centricity) cultural fit. STAR format expected even from freshers.",
  },

  /* ── Campus Placements, Cognizant GenC / GenC Next ─────────── */
  {
    text: "GenC Next aptitude follow-up: Explain how a hash table handles collisions. Now tell me which Indian app you've used that you suspect uses one heavily.",
    company: "cognizant", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Cognizant GenC Next technical round. Two-part: textbook + applied speculation. Tests connecting CS concepts to real systems (Ola/Swiggy lookup, IRCTC seat-booking).",
  },

  /* ── Campus Placements, Accenture ──────────────────────────── */
  {
    text: "Accenture cares about 'innovation, inclusion, stewardship'. Pick one and tell me a college instance where you embodied it.",
    company: "accenture", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Accenture campus values-anchor question. The values are explicit on their careers page; not knowing them = unprepared. Concrete college example (club, project, fest) > abstract reflection.",
  },

  /* ── Campus Placements, Amazon SDE-1 / Flipkart GET ────────── */
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
    styleNote: "Amazon LP for campus. STAR format expected even at fresher level. 'Volunteered for X' weak, wants self-initiated + measurable outcome.",
  },
  {
    text: "Design a basic library-management system. Tell me your data model and 2-3 endpoints.",
    company: "flipkart", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Flipkart GET / SDE-1 campus design round. Calibrated for fresher, wants entities + relationships + key endpoints, NOT distributed-systems framing. Over-engineering = lack of judgement.",
  },

  /* ── Campus Placements, LTIMindtree / HCL / Capgemini / IBM ── */
  {
    text: "What is normalisation in DBMS? Walk me through 1NF → 2NF → 3NF on a student-marks table you'd build for your college.",
    company: "ltimindtree", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "LTIMindtree fresher technical round. Textbook DBMS warmup. Strong candidates anchor each form to a concrete college table; weak ones recite definitions.",
  },
  {
    text: "Tell me one thing that's not on your resume that I should know about you. Why didn't you put it on the resume?",
    company: "hcl", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "HCL TechBee / GET HR round. Tests self-awareness about resume editing choices. 'Nothing, my resume is complete' fails, wants a real story (a fest organised, a hackathon DNF, a hobby) with reasoning.",
  },
  {
    text: "Capgemini works across 50+ countries. If your first project puts you on a midnight shift for a French client for 3 months, how do you handle it?",
    company: "capgemini", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Capgemini campus HR. Tests realistic acceptance + a coping plan, not blanket 'yes anything'. Mentioning sleep hygiene / family communication / health = mature signal.",
  },
  {
    text: "Pick any one IBM product or service you've heard of. Tell me what problem it solves and who its biggest competitor is.",
    company: "ibm", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "IBM campus screening. Watson / Red Hat / Z-mainframe / Cloud, pick any. Tests basic homework on the company. 'IBM makes computers' = unprepared.",
  },

  /* ── Campus Placements, Microsoft / Google / Adobe India ────── */
  {
    text: "You're given two sorted arrays of size m and n. Find the median in O(log(min(m,n))). Talk me through your approach before you write.",
    company: "microsoft", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Microsoft IDC / Engage campus DSA round. The bar is genuine, partition-based binary search expected. Strong candidates state O(m+n) merge first, then optimise; weak ones go silent.",
  },
  {
    text: "Why software engineering and not the M.Tech / MBA route your peers are taking? Talk me through how you decided.",
    company: "microsoft", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Microsoft campus motivation probe. Tests genuine deliberation vs. herd choice. 'I love coding' alone weak, wants a counter-option they considered and why they ruled it out.",
  },
  {
    text: "Google STEP, design a data structure that supports insert, delete, and getRandom all in O(1). Now extend it to allow duplicates.",
    company: "google", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Google STEP / APAC campus DSA. HashMap + dynamic array combo. The duplicate extension is the real test, most miss the index-tracking nuance.",
  },
  {
    text: "Adobe asks for a real-world bug you've debugged. Tell me about a project bug that took you more than a day to find. What was the root cause and what would you do differently?",
    company: "adobe", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Adobe MTS-1 campus debugging probe. Tests genuine engineering reflection. 'I added more print statements' acceptable but want articulation of WHY the bug was hard (assumption violated, async race, env mismatch).",
  },

  /* ── Campus Placements, Oracle / Cisco / Salesforce / NVIDIA ── */
  {
    text: "Oracle Apps DBA fresher: explain a deadlock in a transactional database. Now tell me how you'd detect one programmatically.",
    company: "oracle", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Oracle India campus tech. Wait-for-graph + cycle detection. Strong candidates draw a 2-txn deadlock on paper; weak ones describe symptoms only.",
  },
  {
    text: "Walk me through what happens, packet by packet, when you type cisco.com into a browser and hit enter. Stop me at any layer you want to go deeper on.",
    company: "cisco", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Cisco campus networking fundamentals. The classic, wants DNS → TCP → TLS → HTTP coverage with at least one layer drilled into. 'Browser sends a request' = fail.",
  },
  {
    text: "Salesforce Trailhead, have you done any Trailhead modules? If yes, which one and what was the most surprising thing you learned. If no, why not?",
    company: "salesforce", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "Salesforce campus / Futureforce HR. Trailhead engagement is a real signal of self-driven learning. 'No' is acceptable IF paired with another concrete self-learning thread (LeetCode streak, Coursera cert).",
  },
  {
    text: "NVIDIA, you've worked with PyTorch in college? Tell me what happens to a tensor in memory when you call .cuda() on it. What could go wrong?",
    company: "nvidia", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "NVIDIA India campus DLI / SWE-ML. Tests whether ML coursework was conceptual or applied. Want: host→device copy, alignment, OOM, async semantics. 'It runs on GPU' = surface-level.",
  },

  /* ── Campus Placements, Indian product cos (Swiggy/Zomato/etc) */
  {
    text: "Swiggy delivery promise is 30 minutes. If your college fest catered through Swiggy and 4 of 200 orders missed the SLA, what data would you ask Swiggy for to figure out why?",
    company: "swiggy", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Swiggy campus / Step-Up case round. Operational empathy + data instinct. Strong: order timestamps, restaurant prep time, rider assignment latency, distance, weather. Weak: 'I'd ask for delay reasons' generic.",
  },
  {
    text: "Zomato, design the database schema for restaurant menus that supports daily specials and out-of-stock items in real time.",
    company: "zomato", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Zomato campus SWE schema design. Wants restaurant→menu→item→variant tables + a separate availability/specials table with TTL. Over-normalisation or stuffing it all in one table both fail.",
  },
  {
    text: "Razorpay handles payments. If a UPI debit succeeds at the bank but our webhook fails, what should the user see, and what should our system do?",
    company: "razorpay", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Razorpay Road-to-Razorpay / SDE-1 campus. Idempotency + reconciliation thinking. Want: pending state for user, polling/reconcile job for system, eventual settlement. 'Show error' = fails the bar.",
  },
  {
    text: "PhonePe processes ~25M transactions a day. As a fresher SDE, what's one thing you'd be most worried about breaking on your first deploy?",
    company: "phonepe", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "PhonePe campus humility / scale-awareness probe. Strong: name a specific failure mode (cache stampede, schema migration lock, money-handling race). Weak: 'everything' / 'nothing, I'll be careful'.",
  },
  {
    text: "Paytm, explain how you'd handle a refund that's been initiated twice by accident. Walk me through your idempotency strategy.",
    company: "paytm", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Paytm campus SDE-1 fintech round. Idempotency keys + state machine for refunds. Wants explicit 'request_id' or 'refund_id' uniqueness, plus what state transitions are valid.",
  },
  {
    text: "CRED's audience is the top 1% credit-card user. Pick one feature in the CRED app and tell me what you'd change for a tier-2 city user, and whether CRED should care.",
    company: "cred", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "CRED campus product round. Tests strategic awareness, the 'should CRED care' is the real probe. Strong candidates note CRED's premium positioning and argue both sides; weak ones add tier-2 features uncritically.",
  },
  {
    text: "Meesho's resellers are mostly women in tier-2/3 cities running WhatsApp shops. Design the simplest possible 'low-stock' notification for them. What's your channel and what's your message?",
    company: "meesho", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Meesho campus PM / SDE-with-product-lens. Tests audience empathy. Wants: SMS/WhatsApp push (not email), Hindi/regional fallback, time-of-day awareness. 'In-app push' alone shows poor user model.",
  },
  {
    text: "Freshworks builds B2B SaaS. As a fresher SDE, what's the difference between writing a feature for 100 customers vs. 100,000, concretely, what changes in your code?",
    company: "freshworks", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Freshworks campus SDE-1. Tests scale-thinking. Want: pagination, async jobs, tenant isolation, observability. 'Better code' generic = fail.",
  },
  {
    text: "Zoho doesn't believe in the IIT premium, we hire from Tier-3 colleges too. Tell me one thing about your engineering ability that doesn't show up in your CGPA.",
    company: "zoho", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Zoho campus / Schools-of-Learning HR round. Zoho's anti-pedigree culture is real and on the careers page. Wants: a side-project, an OSS contrib, a problem solved without coursework support. CGPA-defending answers fail.",
  },
  {
    text: "Zerodha, explain what happens between you placing a market-buy order on Kite at 9:15:00 AM and the trade settling. Where could it fail?",
    company: "zerodha", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Zerodha campus SDE, exchange-flow literacy. Wants: order routing → exchange matching → trade confirmation → T+1 settlement at clearing corp. Fresher pass-mark = naming three of these stages.",
  },

  /* ── Campus Placements, Banking / NBFC / Investment grad programs */
  {
    text: "HDFC Pragati, you're a branch officer. A senior citizen wants to invest 20 lakhs of retirement money in equity mutual funds because his neighbour told him to. What do you do in the next 10 minutes?",
    company: "hdfc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "HDFC Pragati / management-trainee branch-banking ethics probe. Wants: risk-profiling, suitability assessment, debt allocation suggestion, written record. 'Sell him the equity fund, hit my target' = instant fail.",
  },
  {
    text: "ICICI, pitch me the savings account I should open. I'm 22, just placed, ₹6 LPA, single, in Bangalore.",
    company: "icici", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "ICICI campus PO / management trainee. Tests product knowledge + needs-based selling. Want: question first (spending pattern, debit-card use, salary credit), then product. Pitch-without-questions = fails.",
  },
  {
    text: "Goldman Sachs Engineering analyst: estimate how much memory you'd need to store one year of NSE Nifty-50 tick data in RAM. Show your math.",
    company: "goldman", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Goldman Bengaluru campus engineering analyst. Fermi estimation + finance literacy. Want: ticks/sec × bytes/tick × 50 stocks × seconds-in-trading-day × 250 days. Sanity check final number.",
  },
  {
    text: "JPMorgan CCB analyst: a customer disputes a ₹50,000 credit-card charge. Walk me through what you check first, and whether you'd reverse it provisionally.",
    company: "jpmc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "JPMC India CCB campus analyst. Tests risk + customer-experience trade-off. Want: merchant pattern, customer history, fraud rules, dispute timeline. RBI 'shadow reversal' rules are a bonus signal.",
  },

  /* ── Campus Placements, Consulting analyst programs ────────── */
  {
    text: "McKinsey BA case: an Indian quick-commerce player's profit per order has dropped 40% YoY despite GMV growth. Where do you start?",
    company: "mckinsey", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "McKinsey India BA / fellow campus case. Profitability framework, revenue/order vs. cost/order. Strong: structures cost into rider, packaging, dark-store, discounting. Weak: jumps to 'reduce discounts'.",
  },
  {
    text: "BCG Associate: estimate the size of the second-hand smartphone market in India per year. Walk me through your structure.",
    company: "bcg", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "BCG India campus case interview. Sizing case. Want: top-down (smartphone users × replacement rate × resale rate × avg-price) AND a sanity check from bottom-up (Cashify/OLX volume estimate).",
  },
  {
    text: "Bain Associate: a friend asks if she should leave her ₹14 LPA Bangalore PM job to start a D2C clothing brand. What three numbers do you ask her for first?",
    company: "bain", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Bain India campus, applied-judgment screen. Tests business instincts on real-life decision. Strong: runway months, beach-head SKU CAC/AOV, competitor density. Weak: 'go for it / don't go for it' opinions without numbers.",
  },
  {
    text: "Deloitte S&O analyst: a mid-sized Indian retail bank wants to enter wealth management. What are the top 3 risks you'd flag in week 1?",
    company: "deloitte", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Deloitte campus analyst case. Wants: regulatory (SEBI/AMFI licences), capability (RM hiring + tech), conflict (existing bancassurance partners). Naming specific Indian regulators = strong.",
  },

  /* ── Campus Placements, FMCG MT / Sales-leadership programs ── */
  {
    text: "HUL Future Leaders: you're managing the Surf Excel team in Patna for 6 months. Modern trade is 5% there; the other 95% is kirana. What's your week-1 priority?",
    company: "hul", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "HUL FLP campus stretch case. Tests channel-mix awareness. Want: distributor relationships, secondary-sales visibility, on-ground Vyapaari interactions. 'Run a digital campaign' = wrong audience.",
  },
  {
    text: "P&G Brand MT: tell me about a time you had to convince a group of people to do something they didn't initially want to do. What would you do differently now?",
    company: "p&g", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "P&G PEAK campus behavioural. Maps to P&G's 'Leadership' competency. Want: STAR with named stakeholders + a concrete tactic (data, 1:1s, demo). 'I made them see my point' = vague fail.",
  },
  {
    text: "ITC Generation Next: pick any ITC product (Aashirvaad / Sunfeast / Bingo / Classmate / Wills). Tell me one thing you'd change about its packaging for tier-2 distribution and why.",
    company: "itc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "ITC GenNxt campus FMCG product probe. Tests trade-channel awareness. Strong: smaller SKU for ₹5/₹10 price points, grammage, kirana shelf-fit. Weak: aesthetic redesign without distribution rationale.",
  },

  /* ── Campus Placements, Group Discussion / Aptitude transitions */
  {
    text: "Group discussion topic: 'AI tools should be banned in college coursework.' You have 2 minutes to take and defend a position. Take one now.",
    company: "tcs", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "TCS / Wipro / Capgemini GD round. Tests stance-taking + conciseness, not 'right answer'. Strong: clear position in 15 seconds, one specific defence, one acknowledged counter. Weak: balanced waffling for 2 minutes.",
  },
  {
    text: "Aptitude follow-up: a train 240m long crosses a 360m platform in 30 seconds. What's its speed in km/h, and would the answer change if the platform had a 60m incline?",
    company: "infosys", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "Infosys / Cognizant aptitude-to-interview transition probe. The base calc is rote; the incline twist tests whether the candidate questions assumptions. 'Same answer, distance is distance' is correct and a strong signal.",
  },
  {
    text: "Coding-round handoff: in your assessment you got 2 out of 3 problems. Which one did you not solve, and walk me through your thought process when you got stuck.",
    company: "amazon", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Amazon / Microsoft / Goldman post-assessment interview opener. Tests honesty + meta-cognition. Strong: names the problem, the approach attempted, where it broke, what they'd try now. 'I solved all 3' when records say otherwise = instant disqualification.",
  },

  /* ── Campus placement: core-engineering & tier-3 pipelines ──── */
  {
    text: "Walk me through your final-year project, what was the deliverable, what tools did you use, and what would you change if you had another semester?",
    company: "l-and-t", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "L&T / BHEL / Mahindra GET opener. Expect: deliverable, software (AutoCAD / SolidWorks / ANSYS / MATLAB), and one calibrated regret. Hand-waves like 'I designed something' without naming the CAD package fail the project_no_tech_stack check.",
  },
  {
    text: "BHEL operates across thermal, hydro, nuclear and renewables. Which division would you want to be posted to and why, what's your reasoning?",
    company: "bhel", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "BHEL GET interview classic. Tests division-awareness + posting flexibility. 'Renewables because of the energy transition' is fine if backed by one concrete BHEL renewables fact (Trichy plant, recent solar capacity announcement). Generic 'any division is fine sir' = weak signal.",
  },
  {
    text: "ONGC postings can be offshore, in Assam, or in remote sites. Are you genuinely open to a remote posting for the first 3 years? Walk me through how you've thought about it.",
    company: "ongc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "PSU posting-reality probe. The wrong answers are 'yes sir, anywhere' (no thought) and 'preferably metro' (deal-breaker). Strong: acknowledges the trade-off, has talked to family, names a concrete prep step.",
  },
  {
    text: "NTPC follows a strict 2-year GET training cycle with rotation across plants. How comfortable are you with structured training versus diving straight into independent work?",
    company: "ntpc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "PSU training-mindset probe. Strong: enjoys structured learning curve, knows the rotation gives plant-by-plant exposure. Red flag: 'I want autonomy from day one' (poor fit for a 60-year-old PSU).",
  },
  {
    text: "Mahindra's automotive division ships products like XUV700 and Thar. Pick one Mahindra product and walk me through one engineering trade-off you'd want to dig into if you joined the team.",
    company: "mahindra", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Mahindra GET technical-curiosity test. Naming a product is the floor; the win is articulating a real trade-off (NVH vs weight, ground clearance vs aero, dual-clutch vs torque-converter). Generic 'design is good' answers fail no_company_specific_research.",
  },
  {
    text: "For a Bajaj Auto GET role, talk me through the difference between a four-stroke single cylinder and a parallel twin engine, and why Bajaj might pick one over the other for the Pulsar line.",
    company: "bajaj", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Automotive fresher technical probe. Tests core mechanical knowledge + product-context bridge. Strong: cost / vibration / fuel-economy / serviceability trade-offs framed against Indian commuter use-case. Surface-level 'twin is smoother' answer leaves marks on the table.",
  },
  {
    text: "Cummins is a global power-systems company. Why are you applying to Cummins specifically and not Caterpillar or Kirloskar, what makes you think you'd thrive here?",
    company: "cummins", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Engine-OEM why-us probe. Bad: 'Cummins is a great brand.' Strong: names a recent Cummins announcement (hydrogen ICE platform, Phaltan plant expansion) or a values cue from the Cummins Code of Business Conduct.",
  },
  {
    text: "Tier-2 college candidate: how do you compete with IIT / NIT applicants for the same role? Convince me your fundamentals are strong.",
    company: "tcs", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Common Indian tier-3 college framing probe. Strong: pivots to concrete proof, coursework, projects shipped, certifications cleared, NQT score. Weak: 'colleges don't matter sir' (avoids the question). Watch for badmouth_college regression.",
  },
  {
    text: "You have one backlog cleared in the supplementary exam. Walk me through what happened, what you fixed, and what you'd do if I gave you that semester back.",
    company: "infosys", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Direct deficit-probe, appropriate framing when the AI initiates it. Strong: one-sentence cause (subject, why), specific corrective step (taught it, project, certification), and reflective close. Avoids over-explanation.",
  },
  {
    text: "ITI / diploma to BTech lateral entry students often feel behind on coursework. If that's your path, how did you bridge the gap, and which specific topics did you have to grind to catch up?",
    company: "wipro", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Wipro / TCS lateral-entry probe. Strong: names two concrete topics (DSA, OOP design patterns, electromagnetic theory), the resource used (NPTEL course, GATE prep book), and a measurable outcome (project shipped, GATE score).",
  },
  {
    text: "Tata Steel campus offer: explain what you understand about the difference between a graduate engineer trainee and a management trainee, and which fits you better.",
    company: "tata-steel", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "PSU / Tata role-clarity probe. Strong: GET = technical / plant-floor / process-engineering; MT = cross-functional rotations / strategy / operations. Picks one with reasoning grounded in their internship or aptitude. Weak: 'sir whatever the company decides'.",
  },
  {
    text: "ISRO / DRDO scientist-B exam, you cleared the written but the interview is technical-deep. Walk me through one applied physics or signals problem from your coursework that you genuinely understand to the bone.",
    company: "isro", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "ISRO / DRDO interview rigor probe. Strong: picks one well-bounded problem (FFT decomposition, control-loop stability, orbital mechanics), walks through derivation, and admits where the limit of their understanding is. Surface answers get a follow-up that exposes them fast.",
  },
  {
    text: "PSU pay-scale discussion: are you aware of the 7th-CPC pay structure for graduate engineers, and how does the trade-off compare to a private-sector offer you've received?",
    company: "ongc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "PSU compensation-literacy probe. Strong: knows pay-band (E-1 / Rs 50k-160k), HRA + perks structure, and frames PSU stability vs private growth honestly. Weak: 'I don't know sir' = unprepared. Watch for naive 'private pays more' framing.",
  },
  {
    text: "Open-source contribution, have you ever filed an issue or PR on a public repo? Walk me through the workflow you followed, even if it was a doc-typo fix.",
    company: "google", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "warmup", confidence: "inferred",
    styleNote: "Modern-fresher signal probe. Strong: even a typo PR shows comfort with fork → branch → PR → review cycle. Bonus: cites the repo. Empty answer is fine for non-IT freshers; an exaggerated 'I contribute to React' that the candidate can't back up is a credibility hit.",
  },
  {
    text: "Tell me one engineering concept that you learned in college but found a real-world application for during a project or internship, what was the disconnect between textbook and practice?",
    company: "samsung", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Samsung R&D / GE / Honeywell campus differentiator. Strong: names the concept (PID tuning, Big-O vs cache effects, Bode plot vs real damping), the project, and the specific gap. This is the question that separates rote-prep from genuine learners.",
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
    styleNote: "EM signal-craft probe. Generic 'eNPS' weak, wants specifics (review-cycle latency, on-call distribution, 1:1 cancellation rate, code-review p90). Stripe-style writing-clarity expected.",
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
    styleNote: "Zero-sum people decision. Tests transparency, retention thinking, and willingness to have hard conversations. Avoid 'I let HR decide', interviewer wants YOUR play.",
  },
  {
    text: "Describe a time you killed a project that the team had spent 6+ months on. How did you announce it?",
    company: "swiggy", roleFamily: "em", focus: "management",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Hardest delivery-pivot moment. Wants: sunk-cost discipline + team morale repair + leadership communication craft. Sample line of the actual announcement is gold.",
  },
  {
    text: "How do you onboard a senior hire, say a Staff Engineer with 10 YOE, versus a junior new-grad? What's different about the first 30 days?",
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

  /* ── High-traffic tier-1 fillers (audit-coverage expansion) ── */
  /* Apple SWE, system design */
  {
    text: "Design a battery-aware background sync that doesn't drain the device. Walk me through the trade-off between freshness and power.",
    company: "apple", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Apple system design favors device-constraint problems (battery, memory, thermal). Wants: power-budget reasoning, OS API selection (BGTask / WorkManager), failure-mode degradation strategy.",
  },
  /* Apple, behavioral craft */
  {
    text: "Walk me through a UX detail you obsessed over that nobody else on your team thought mattered. How did you get them to care?",
    company: "apple", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Apple craft signature. Wants: a SPECIFIC pixel/gesture/animation/copy detail + the nudge/mockup/data that flipped the team. Generic 'I cared about quality' fails.",
  },
  /* Microsoft SWE × system-design (was missing despite being top-traffic) */
  {
    text: "Design Microsoft Teams chat for 100M concurrent users with 99.99% delivery guarantee. Walk me through the message-fanout and presence subsystems.",
    company: "microsoft", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Microsoft Teams scale problem. Probes: pub-sub fan-out, presence aggregation, regional sharding, Azure-native primitive choices (Service Bus, Event Hubs, Cosmos DB).",
  },
  /* Meta PM × case-study */
  {
    text: "Walk me through a feature you'd kill at Instagram, and what you'd build with the freed-up engineering capacity.",
    company: "meta", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Meta PM signature, tests opinionated product judgment. Generic answers (Threads, Reels) fail; wants a less-obvious feature + a contrarian replacement bet.",
  },
  /* Amazon PM × case-study */
  {
    text: "Write the press-release for a new Prime feature you'd launch in India next quarter. Title + 3 headline benefits + customer quote.",
    company: "amazon", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Amazon PR-FAQ working-backwards method. Tests customer-obsession + clarity. The customer quote is the load-bearing element, must reveal a real-not-marketing pain.",
  },
  /* Stripe PM × strategic */
  {
    text: "Stripe is in 50+ countries. We're 30% under-penetrated in India. Walk me through the strategic plan to close the gap.",
    company: "stripe", roleFamily: "pm", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Stripe India go-to-market case. Wants: India-specific moat (UPI, RBI compliance, Razorpay/PhonePe competition), distribution-channel reality (developer evangelism, agency partnerships), pricing localization.",
  },
  /* Atlassian SWE × system-design */
  {
    text: "Design Jira's full-text search across 5M issues per workspace with sub-200ms p95 latency. How do you handle multi-tenancy?",
    company: "atlassian", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Atlassian search infra problem. Probes: ES vs Solr vs in-house, tenant isolation strategies (index-per-tenant vs shared+filter), index update lag tolerance, fan-out write architecture.",
  },
  /* Salesforce SWE × technical */
  {
    text: "We have a flow that fires after every Account update. It now triggers 15× per save due to recursion. Diagnose and fix without breaking dependent flows.",
    company: "salesforce", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Salesforce platform debug, tests Apex + flow runtime knowledge. Wants: trigger-handler pattern, flow recursion guards, Static.depth tracking, isolation-tag strategy.",
  },
  /* Zerodha PM × strategic */
  {
    text: "Zerodha hit ₹2,000Cr profit this year without VC money. The board asks where to deploy capital. What's your three-bet allocation?",
    company: "zerodha", roleFamily: "pm", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Zerodha capital-allocation case. Anti-VC philosophy is the constraint, answers like 'spin out a SaaS arm' fail. Wants: in-line product extensions (commodities, MFs, US stocks), R&D-heavy bets (Coin / Varsity), employee equity alternatives.",
  },
  /* CRED PM × case-study */
  {
    text: "CRED's average user has 6 cards. Engagement on the rewards page is plateauing. What's the next product surface you'd build?",
    company: "cred", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "CRED user-engagement case. Wants: opinionated insight about what affluent users actually struggle with (not 'more rewards'), specific surface concept with mocked-up flow, monetization path that doesn't compromise the premium positioning.",
  },
  /* Goldman swe × technical */
  {
    text: "We process 50M trades/day. The end-of-day batch reconciliation is taking 6 hours and we need it under 90 minutes. Walk me through your optimization approach.",
    company: "goldman", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Goldman engineering perf-optimization probe. Probes: profiling-first instinct, parallelization vs vertical scaling, Java/JVM tuning specifics, willingness to question the 90-min target.",
  },
  /* JPMorgan SWE × behavioral */
  {
    text: "A regulatory deadline is in 2 weeks. The spec we built to is wrong. Walk me through how you handle the next 24 hours.",
    company: "jpmc", roleFamily: "swe", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "JPMC regulatory-deadline crisis. Tests: stakeholder communication timing (compliance, business, tech), willingness to escalate vs cover, acceptable-risk threshold.",
  },
  /* TCS PM × case-study */
  {
    text: "A Fortune-500 client wants TCS to lead their multi-year cloud migration. The catch: their internal IT team is hostile to outsourcing. How do you frame the engagement?",
    company: "tcs", roleFamily: "pm", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "TCS / consulting-heavy services PM case. Wants: stakeholder mapping (CIO, IT directors, line-of-business), co-build governance models, 90-day quick-win plan, fee structure that aligns incentives.",
  },
  /* Infosys SWE × HR */
  {
    text: "You've had 3 lateral offers in the last 18 months. Why are you still at Infosys?",
    company: "infosys", roleFamily: "swe", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Infosys retention-probe HR question (often surfaces post-2yr promotion review). Wants: legitimate pull-factors (project, mentor, learning), not just 'good company'. Defensive answers signal flight risk.",
  },
  /* Adobe Designer × case-study */
  {
    text: "Walk me through redesigning a feature in Photoshop / Illustrator / Premiere. Pick the one feature most users complain about and pitch the fix.",
    company: "adobe", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Adobe Creative-Cloud design probe. Tests Adobe-tool fluency + customer-empathy. Wants a SPECIFIC feature (Refine Edge / Shape Builder / Multi-cam editor) with research-backed pain.",
  },
  /* Cisco SWE × system-design */
  {
    text: "Design a network observability platform that ingests 1B telemetry events/second across 10K customer networks. Multi-tenant with strict per-tenant isolation.",
    company: "cisco", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Cisco telemetry-platform problem. Probes: time-series storage (InfluxDB / VictoriaMetrics / ClickHouse), tenant isolation, write-amplification, query-time aggregation, retention tiering.",
  },
  /* Oracle SWE × technical */
  {
    text: "A query that ran in 200ms now takes 15 minutes. Same data, no schema change. Walk me through your diagnosis.",
    company: "oracle", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Oracle DBA-aware probe. Wants: AWR / SQL trace, statistics staleness, plan-stability hints, parallel-query degree, comfort with SGA tuning.",
  },
  /* IBM Consultant × case-study */
  {
    text: "A bank wants to migrate 500+ legacy COBOL programs to a modern stack in 18 months. Walk me through your approach.",
    company: "ibm", roleFamily: "consultant", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "IBM Consulting / GBS modernisation case. Probes: discovery-first vs lift-and-shift, AI-assisted code translation, parallel-run validation, knowledge-transfer planning.",
  },
  /* NVIDIA ML × technical */
  {
    text: "Optimize a CUDA kernel for batched matrix multiplication. Walk me through 3 optimizations that meaningfully improve memory bandwidth utilization.",
    company: "nvidia", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "NVIDIA platform-engineering depth probe. Wants: shared-memory tiling, register blocking, async copy with cp.async, warp-level primitives. Generic answers fail at top semiconductor recruitng.",
  },
  /* Walmart Global Tech × technical */
  {
    text: "On Black Friday, p99 checkout latency jumped from 200ms to 4s for 30 minutes. We have full traces. Walk me through your war-room playbook.",
    company: "razorpay", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Razorpay ops-incident war-room probe. Tests: triage discipline (flame-graph first, narrow scope), upstream-vs-self attribution, comms cadence (every 15 min), post-incident artifacts (timeline, MTR review, runbook update).",
  },

  /* ── Sales, Account Executive / Business Development ───────── */
  {
    text: "Walk me through your biggest closed-won deal, what was the ACV, sales cycle length, and the moment the prospect tipped from undecided to signing?",
    company: "freshworks", roleFamily: "sales", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "AE / BD interview classic. Wants ACV + cycle length + the SPECIFIC inflection point. 'They saw the value' fails, wants the demo / artifact / referral that flipped them.",
  },
  {
    text: "How do you qualify a lead in the first 10 minutes? Walk me through your discovery framework.",
    company: "salesforce", roleFamily: "sales", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "MEDDIC / BANT / SPIN, wants framework name + how they actually use it, not textbook recitation.",
  },
  {
    text: "Your prospect ghosted after 3 calls. They were our top opportunity. What's your re-engagement play?",
    company: "atlassian", roleFamily: "sales", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Tests creativity + persistence vs. desperation. Look for: champion-other-stakeholders, value-message variation, time-bounded re-engagement.",
  },
  {
    text: "Tell me about a deal you LOST in late stage. What did the deal-review post-mortem reveal?",
    company: "stripe", roleFamily: "sales", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Honesty + reflection probe. Common failure: blaming pricing or competitor. Strong: identifying the discovery miss / champion gap.",
  },

  /* ── Marketing, Brand / Performance / Growth ───────────────── */
  {
    text: "Walk me through a brand campaign you led, brief, insight, output, and the metric you moved.",
    company: "hul", roleFamily: "marketing", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Brand-side classic. Insight is the non-obvious part, wants a customer-truth that the campaign expressed. Generic 'we ran ads on Meta' fails.",
  },
  {
    text: "Your CAC has been climbing 30% YoY. What's your diagnosis and where do you cut?",
    company: "swiggy", roleFamily: "marketing", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Performance-marketing diagnostic. Wants: channel-level breakdown, contribution-margin lens, willingness to kill a poorly-performing channel even if VP loves it.",
  },
  {
    text: "Defend an ad creative you're proud of that initially flopped in testing but you pushed through to launch.",
    company: "p&g", roleFamily: "marketing", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "P&G classic, tests conviction + pattern-recognition over data. Want: testing methodology critique + what the candidate saw that the test missed.",
  },
  {
    text: "Take a brand of your choice. Tell me what their next 3-year strategy should be and why.",
    company: "itc", roleFamily: "marketing", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "FMCG strategic-brand probe. Reveals candidate's ability to think category dynamics + competitive moves. Generic answers (premiumize, go digital) fail.",
  },

  /* ── Finance, Audit / IB / Equity Research ─────────────────── */
  {
    text: "Walk me through a 3-statement model. Start with revenue and tell me what hits the cash flow statement vs the income statement.",
    company: "goldman", roleFamily: "finance", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "IB Analyst classic. Wants accounting fluency + ability to walk through circular references (interest expense ← debt → cash → debt). Stumbling here = soft reject.",
  },
  {
    text: "Pitch me a stock. Long or short. You have 3 minutes.",
    company: "goldman", roleFamily: "finance", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Equity research / sales-trading entry probe. Wants: thesis (1 sentence), 3 key drivers, the contrarian element vs consensus, time-frame, downside risk. Generic 'undervalued' fails.",
  },
  {
    text: "Your audit team finds a material misstatement during year-end at a key client. Walk me through what happens next.",
    company: "deloitte", roleFamily: "finance", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Big 4 audit ethics + process probe. Tests escalation chain, partner-involvement timing, materiality threshold judgment, fee-pressure resistance.",
  },
  {
    text: "An MSME client wants to take a ₹50Cr loan. Walk me through your credit assessment, what 5 things matter most?",
    company: "icici", roleFamily: "finance", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Credit risk / commercial banking probe. Wants: cash-flow coverage, collateral, promoter-track-record, sector dynamics, RBI compliance. Order of weighting reveals seniority.",
  },

  /* ── Legal, Litigation / Corporate / IP ─────────────────────── */
  {
    text: "We have a Section 138 cheque-bounce matter. Opposing counsel is offering a settlement at 60% of face value. The client is liquid. Walk me through your advice.",
    company: "mckinsey", roleFamily: "legal", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "NI Act litigation tactics. Wants: probability of conviction analysis, time-cost of trial, reputational considerations, willingness to walk away. Wrong: just 'take 60%' or just 'go to trial'.",
  },
  {
    text: "Draft language for an indemnity clause that protects our client from third-party IP claims arising from the deliverable. Talk me through your reasoning.",
    company: "atlassian", roleFamily: "legal", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Corporate / tech-transactions probe. Wants: scope (full / capped / mutual), survival period, exclusions (gross negligence carve-outs), defense-and-control language.",
  },
  {
    text: "Your client is a pharma company facing a patent challenge in Delhi HC. The challenger has a strong prior-art argument. What's your strategy?",
    company: "deloitte", roleFamily: "legal", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "IP litigation strategic probe. Wants: divisional patents, pre-grant opposition timing, chances on appeal, settle-vs-fight calculus, business-impact framing.",
  },

  /* ── Healthcare, Clinical / Hospital Admin ─────────────────── */
  {
    text: "A patient's family disagrees with your treatment recommendation and demands a different protocol they read online. Walk me through your conversation.",
    company: "mckinsey", roleFamily: "healthcare", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Clinical-judgment + family-communication probe. Wants: validation of family concern, evidence-based explanation in lay terms, escalation if continued disagreement, autonomy respect.",
  },
  {
    text: "You're the COO of a 200-bed hospital. ER wait times have crept from 30 min to 90 min over 6 months. Walk me through your diagnosis.",
    company: "deloitte", roleFamily: "healthcare", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Hospital ops case. Wants: bottleneck analysis (triage / lab / imaging / bed availability), staffing shifts, throughput metrics, capex-vs-process trade-off.",
  },
  {
    text: "A patient with sepsis and BP 70/40 arrives. Walk me through your first 5 minutes.",
    company: "atlassian", roleFamily: "healthcare", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Critical-care clinical viva (entry resident). Wants: airway-breathing-circulation, fluid resuscitation, broad-spectrum antibiotics, source identification, vasopressor threshold.",
  },

  /* ── Operations, Hospitality / Aviation / Manufacturing ─── */
  {
    text: "It's 2pm on Saturday at a 200-cover restaurant. F&B kitchen is 40 min behind. Walk me through your next 30 minutes.",
    company: "atlassian", roleFamily: "ops", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "F&B operations crisis probe. Wants: front-of-house communication strategy, kitchen prioritization, comp / discount authority, staff redeployment, root-cause for next week.",
  },
  {
    text: "An aircraft has a maintenance issue 30 min before scheduled departure with 180 pax. AOG. Walk me through your decision tree.",
    company: "atlassian", roleFamily: "ops", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Aviation ops crisis. Wants: ETA estimate, swap-aircraft availability, downstream-delay propagation, passenger compensation calc, comms timing.",
  },
  {
    text: "Your warehouse operates 24/7 with 60% throughput on night shift. Day-shift is at 95%. Diagnose and propose three interventions.",
    company: "swiggy", roleFamily: "ops", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Logistics ops case. Wants: shift-management fundamentals, supervision-density, supply-chain dependencies (truck arrivals), motivation/incentive design.",
  },

  /* ── BFSI Sales, Banking RM / Wealth Manager ─────────────── */
  {
    text: "Pitch our wealth-management offering to a 55-year-old senior executive with ₹15Cr corpus and 10 years to retirement. You have 5 minutes.",
    company: "icici", roleFamily: "bfsi-sales", focus: "case-study",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Wealth-management RM probe. Wants: discovery first (risk tolerance, retirement goal, dependents), allocation logic, fee structure transparency. Pitching products before discovery fails.",
  },
  {
    text: "Your highest-AUM client is threatening to move to a competing bank over a service issue. Walk me through your retention play.",
    company: "hdfc", roleFamily: "bfsi-sales", focus: "behavioral",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "RM retention crisis. Wants: senior-leader involvement timing, compensation-recovery, root-cause communication, service-recovery playbook. Pure financial concession alone fails.",
  },
  {
    text: "A small-business owner wants a working-capital limit. Their CIBIL is 720, but they have 18 months in business. What do you offer?",
    company: "icici", roleFamily: "bfsi-sales", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Commercial banking credit / sales hybrid. Wants: cash-credit vs OD vs term loan trade-off, collateral options (FD / property), interest-rate band, board approval threshold.",
  },

  /* ── Technical Leadership (senior-IC × EM hybrid) ────────────── */
  {
    text: "Walk me through an architecture migration you led across 30+ engineers. What was the rollback plan and when did you nearly need it?",
    company: "razorpay", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Tech-leadership probe (not pure IC). Wants migration scope + organisational coordination + actual rollback trigger criteria. 'We didn't need the rollback' fails, interviewer wants the *moment you almost pulled the trigger*.",
  },
  {
    text: "You inherit a system over-engineered with microservices for what's effectively a CRUD app serving 200 RPS. How do you handle, leave it, fix it, or escalate?",
    company: "stripe", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Senior-tech-leadership scope-judgment. Tests over-engineering pattern recognition + political awareness (the original architect may still be on the team). Wants a phased plan, not a religious answer.",
  },
  {
    text: "Your team has 6 weeks of tech debt and a feature that needs to ship in 4. The PM wants both. Walk me through how you negotiate.",
    company: "atlassian", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Tech-leadership negotiation under constraint. Wants: data ('debt is causing X bugs/week'), counter-proposal ('we ship feature minus Y, debt half-fixed'), readiness to escalate to VP if PM holds firm.",
  },
  {
    text: "You're the Staff Engineer rolling out Cursor/Copilot to a team of 25 with mixed seniority. What's your 90-day plan and how do you measure success?",
    company: "google", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "2026-defining tech-leadership question. Wants: phased rollout (junior-pair → senior-pair → solo), guardrails (security review boundaries, never-trust patterns), measurement (PR-review-time, defect-escape rate, NOT lines-of-code).",
  },
  {
    text: "On-call has gotten miserable, engineers paged 3-4 times/night, half false alarms. Walk me through the redesign you'd lead.",
    company: "phonepe", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Tech-leadership operational craft. Wants: alert-tier discipline (paging vs warning), runbook hygiene, blameless postmortem culture, on-call-load metric tracked weekly. 'We'd just fix the alerts' fails, wants the system change.",
  },
  {
    text: "Two of your senior engineers want very different architectures for the same problem. Both are technically defensible. How do you decide and how do you communicate the decision?",
    company: "meta", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Senior-tech-leadership disambiguation moment. Tests: framework for tie-breaking (reversibility, cost-of-being-wrong, who's on the hook for ops), genuine ownership (not 'I let them debate'), and post-decision retention thinking for the engineer whose call you didn't take.",
  },
  {
    text: "How do you set the bar for promoting an SE3 to Staff? Walk me through the last time you said 'not yet', what was missing?",
    company: "amazon", roleFamily: "em", focus: "technical",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Tech-leadership calibration probe. Wants concrete missing-bar dimension (scope-of-influence, ambiguity handling, cross-team mentoring) AND specific evidence the candidate gathered. 'Not enough technical depth' is too vague.",
  },

  /* ── HR Round (additions) ─────────────────────────────────────── */
  {
    text: "Tell me about yourself, keep it to 90 seconds, focused on what's relevant for this role.",
    company: "tcs", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "warmup",
    styleNote: "TCS NQT HR opener. The 90-second cap is real, over-running signals weak self-editing. Should hit: education + flagship project + why-TCS-fit, in that order.",
  },
  {
    text: "Walk me through your three biggest projects in the last role. Which one are you proudest of, and why?",
    company: "infosys", roleFamily: "swe", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Infosys InfyTQ HR. The 'proudest' framing tests self-knowledge + ability to defend a choice (not just describe). 'All three were great' = duck.",
  },
  {
    text: "Personal Experience Interview (PEI): Tell me about a time you led a team through a difficult moment. Where exactly did your leadership show up?",
    company: "mckinsey", roleFamily: "consultant", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "McKinsey PEI Leadership dimension. Story must be quantified, candidate must own a clear personal action, and 'where exactly' probe is mandatory, push for the specific moment + the specific words used.",
  },
  {
    text: "PEI: Walk me through a time you had a strong personal conviction about something but the evidence forced you to change your mind. How did you handle the change?",
    company: "mckinsey", roleFamily: "consultant", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "McKinsey PEI Personal Impact dimension. Tests intellectual honesty + willingness to update beliefs. Stories where 'I was actually right all along' fail the dimension.",
  },
  {
    text: "Recruiter screen: tell me what attracts you to Amazon specifically vs. other big tech, in 60 seconds.",
    company: "amazon", roleFamily: "swe", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Amazon recruiter screen filter. Generic 'big tech, good comp, good problems' fails. Ground in specific LP language ('Customer Obsession') + specific Amazon product / business context the candidate has researched.",
  },
  {
    text: "Stripe writing screen: 'In 4 sentences, explain to me why you want to work at Stripe specifically. Then we'll discuss it.'",
    company: "stripe", roleFamily: "swe", focus: "hr",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Stripe HR-screen culture-bar test. Length cap is unusually short on purpose; tests Stripe's signature writing-clarity bar even at HR stage. Generic + over-length = soft reject.",
  },

  /* ── Strategic focus (was aliased to case-study; now distinct) ─ */
  {
    text: "You're a Senior PM and the CEO wants to kill your roadmap's flagship feature to redirect engineers to a board-pitched bet. The data on your feature is strong. Walk me through the conversation.",
    company: "swiggy", roleFamily: "pm", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Strategic stakeholder defense. Tests: bringing data, separating ego from argument, offering a phased compromise vs. all-or-nothing, knowing when to fold. 'I'd push back firmly' alone fails, wants the actual sequence of moves.",
  },
  {
    text: "You're CTO. The board wants you to commit to a major GenAI bet that you privately think is overhyped for your company's current scale. How do you frame your honest position?",
    company: "razorpay", roleFamily: "em", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "CTO board-honesty probe. Tests: separating tech opinion from career incentive, framing risk in board-readable terms (capex, opportunity cost, timeline), proposing a smaller experiment vs. full commit OR clean refusal.",
  },
  {
    text: "Walk me through a strategic bet you made that didn't pay off. Be specific about what you'd do differently with hindsight.",
    company: "google", roleFamily: "pm", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Google PM 'L5+ judgment' question. Wants a real bet (not a tactical miss), the reasoning at the time of the call (steelmanning past-self), and a specific changed mental model, not 'I'd do it the same way'.",
  },
  {
    text: "You're a founding PM at a Series B. Your CEO wants to expand to 3 new geographies in the next 12 months. You think one is wrong. What do you do?",
    company: "atlassian", roleFamily: "pm", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Founder-tier strategic disagreement. Wants: data-backed counter (TAM, ops cost, customer-acquisition unit econ), willingness to commit to a deadline ('let's revisit in 90 days'), AND knowing when to follow if CEO holds firm.",
  },
  {
    text: "VP Engineering: justify your headcount ask to the CFO who's pushing for a 15% cut across the org. You can't lose any senior people.",
    company: "flipkart", roleFamily: "em", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "VP-Eng exec-defense round. Tests: tying engineering investment to business OKRs, proposing alternatives to headcount cut (vendor consolidation, process leverage), willingness to accept a smaller cut as a negotiated outcome.",
  },
  {
    text: "You're advising a portfolio company's CEO on a pivot that will alienate 60% of their existing customers but unlock a 10x larger market. What's your recommendation?",
    company: "bain", roleFamily: "consultant", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "MBB strategic-pivot advisory. Wants: framework (existing-cohort retention vs. new-cohort capture economics, transition risk, board readiness), conviction (no MECE-fence-sitting), and personal stake ('I'd recommend X, here's the data threshold that would change my mind').",
  },
  {
    text: "Two consumer trends collide: India's premiumisation push (₹50K+ smartphones rising) and the Bharat market's price sensitivity. As Head of Product at a phone OEM, what's your 3-year strategy?",
    company: "bcg", roleFamily: "consultant", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "BCG-style strategic case with India-specific signals. Tests: dual-segment strategy without one cannibalizing the other, distribution-channel reality (offline-heavy in Bharat), competitive pressure (Chinese OEMs).",
  },
  {
    text: "You're a Director of Engineering at a unicorn that just IPO'd. Your CEO wants to publicly commit to '50% AI-coded code in 2 years'. You think it's irresponsible. How do you handle?",
    company: "phonepe", roleFamily: "em", focus: "strategic",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Public-company strategic risk. Tests: understanding that public commitments lock in execution risk, framing concerns in compliance/disclosure terms, proposing a softer commit ('we'll measure and report' vs. 'we'll deliver 50%').",
  },

  /* ── Panel Interview (cross-persona handoffs) ──────────────────── */
  {
    text: "[Hiring Manager opens] Walk me through your most impactful project in the last 18 months, what was the business outcome? [Tech Lead enters mid-answer] Hmm, but that scaling number, what was your p99 read latency before vs. after? [HR Partner closes] How did the team feel during the crunch?",
    company: "atlassian", roleFamily: "behavioral", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Real Atlassian panel handoff. Tests: same story told three ways (business → technical → human). Candidates who can pivot framing without re-explaining win; candidates who repeat the same answer to all three personae fail.",
  },
  {
    text: "[Tech Lead] Walk me through a system migration you owned. [Hiring Manager picks up] Building on what you just said, how did you sell that migration timeline to the VP when they pushed for half the schedule?",
    company: "google", roleFamily: "em", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Cross-persona reference + escalation pivot. Tests: technical credibility AND stakeholder communication on the same fact pattern. Don't repeat what you said to Tech Lead, extend it.",
  },
  {
    text: "[HR Partner observes] You mentioned to my colleague that you fired an underperformer. Tell me what you said in the room, the actual words, not the summary.",
    company: "amazon", roleFamily: "em", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "HR Partner deep-empathy probe building on a previous panelist's question. Wants the actual phrasing used, not a sanitized recap. Vulnerability + specificity = signal.",
  },
  {
    text: "[Hiring Manager → Tech Lead handoff] OK my colleague will go deeper on the architecture, but before they do, give me the one-sentence elevator version of why you chose X over Y.",
    company: "razorpay", roleFamily: "swe", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Panel handoff that pre-frames the next interviewer. Tests: ability to summarize a deep technical decision in business terms before the technical deep-dive starts. The TL is listening for the summary too.",
  },
  {
    text: "[Tech Lead, skeptical] You said you'd use Kafka here. Picking up on the cost concern Sarah raised earlier, is Kafka still the right choice given the budget constraint, or were you anchored to your last team's stack?",
    company: "stripe", roleFamily: "swe", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense",
    styleNote: "Stripe panel, Tech Lead drilling on a constraint introduced by Hiring Manager (Sarah). Tests: willingness to revise on new info vs. defending past-self, awareness of stack-anchoring bias.",
  },
  {
    text: "[HR Partner closing] Across our three conversations today, what did you learn about us that surprised you? And, be honest, what made you most nervous about joining?",
    company: "atlassian", roleFamily: "behavioral", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "standard",
    styleNote: "Panel closing reflective probe. Tests: self-awareness + genuine engagement with the panel content (vs. canned closer). 'Nothing makes me nervous' = soft signal you weren't really listening.",
  },
  {
    text: "[Product Counterpart] Engineering has told us they want six weeks; the GM in this room wants three. Walk us through how *you'd* arbitrate that, knowing both of us are listening.",
    company: "flipkart", roleFamily: "pm", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Indian e-commerce panel pattern, PM caught between Eng and GM in the same room. Tests: can the candidate run a real tradeoff conversation without flattering either side? Strong: names the scope cut, the risk owner, and the deadline they'd commit to.",
  },
  {
    text: "[Tech Lead, follow-up to design] My colleague drew the system on the whiteboard, pick the single component you'd worry about first if traffic 5x'd overnight, and explain *to the non-engineer in the room* why it's the one to worry about.",
    company: "phonepe", roleFamily: "swe", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "PhonePe / Razorpay panel, Tech Lead asks you to translate the bottleneck for HR/Hiring Manager. Tests: dual register (technical accuracy + business intelligibility). Win: 'the payments DB, because if it slows down, every transaction in the country slows down, and we'd lose customer trust before we lose money.'",
  },
  {
    text: "[Hiring Manager + Skip-level both in the room] We sometimes disagree about the bar for this role. If you joined and the two of us gave you conflicting calibration feedback in your first quarter, what would you do?",
    company: "google", roleFamily: "em", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Panel meta-question with both managers present. Tests: handling principal–agent ambiguity without flattering or dodging. Strong: acknowledges the conflict exists, names a forcing mechanism ('I'd ask the two of you to align on one written rubric I can use'), shows comfort with managing up.",
  },
  {
    text: "[Cross-functional Partner from Marketing] Your engineering colleague spent ten minutes on the data pipeline. From a marketing-ops point of view, *why should I care* about any of that? Convince me.",
    company: "swiggy", roleFamily: "data", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "standard", confidence: "inferred",
    styleNote: "Panel translation probe, a non-engineering panelist deliberately challenges the technical depth. Tests: ability to anchor technical work in commercial outcome (CAC, attribution, campaign ROI). Failure mode: re-explaining the pipeline at the same depth.",
  },
  {
    text: "[Senior IC peer, after HM has left the room] You don't have to be diplomatic with me, tell me one thing about your previous workplace that you'd never tell the recruiter, but that would matter to anyone working with you here.",
    company: "stripe", roleFamily: "swe", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Bar-raiser / peer-IC panel probe done off-script. Tests: candour calibrated to context, does the candidate trust the peer enough to be real, without trash-talking? Strong: one honest cultural mismatch + what they did about it. Weak: 'everything was great' (no calibration) or trash-talking (no judgement).",
  },
  {
    text: "[Director, observing two interviewers debate your last answer] My team is split on the trade-off you just described. Sarah thinks you optimised for the wrong thing; Raj thinks you got it right. Without taking sides, what *new* information would change *your* answer?",
    company: "uber", roleFamily: "pm", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "Director-level meta-probe in a panel. Tests: epistemic humility + ability to state falsifiability conditions. Strong: names a concrete piece of evidence ('if our churn data showed X, I'd flip'). Weak: re-defending the original answer or agreeing with whichever interviewer is more senior.",
  },
  {
    text: "[HR Partner, picking up a thread from Hiring Manager 20 minutes ago] You mentioned you 'managed conflict' on that project, Aakash heard the same word. I want the conflict, not the management. What was actually said, and by whom?",
    company: "tcs", roleFamily: "em", focus: "panel",
    addedQuarter: "2026-Q2", difficulty: "intense", confidence: "inferred",
    styleNote: "HR partner doing a callback to an earlier panelist's question to extract specificity. Tests: STAR-level granularity under cross-reference. The 'managed conflict' euphemism gets called out. Win: names the people (role, not real name), the specific words, the resolution.",
  },

  /* ── Swiggy — behavioral (2026-Q3 expansion) ───────────────────── */
  {
    text: "Tell me about a decision you made with incomplete data that turned out wrong. What was the cost, and what did you change in how you decide next time?",
    company: "swiggy", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Swiggy behavioral rounds probe ownership and 'first principles' decision-making under ambiguity — a stated cultural value. Strong answers quantify the cost and name a concrete process change, not a vague lesson.",
  },
  {
    text: "Describe a time you disagreed with your manager on a launch. How did you push back, and what happened?",
    company: "swiggy", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Give me an example of a time you had to move fast and cut scope. How did you decide what to drop, and did the trade-off hold up?",
    company: "swiggy", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Bias-for-action probe. Swiggy values speed; interviewers want to see a defensible prioritisation rule, not recklessness.",
  },
  {
    text: "Tell me about the hardest cross-team dependency you've had to unblock. Who did you have to influence without authority?",
    company: "swiggy", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },

  /* ── Zomato — system-design (2026-Q3 expansion) ────────────────── */
  {
    text: "Design the live order-tracking system that shows a customer their delivery partner moving on a map in real time. What are the write and read paths at peak dinner load?",
    company: "zomato", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Zomato system design centres on hyperlocal, real-time constraints: high-frequency GPS writes, geospatial fan-out, and dinner-peak spikes. Expect probes on location update frequency vs. battery/cost trade-offs.",
  },
  {
    text: "How would you design the restaurant search and ranking service so results reflect delivery time, availability, and personalisation for a given pincode?",
    company: "zomato", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a surge/dynamic-pricing engine for delivery fees during rain or peak demand. How do you avoid oscillation and keep it explainable?",
    company: "zomato", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Zomato loves demand-supply imbalance problems. Strong answers separate the signal (demand, rider availability) from the policy (caps, smoothing) and address fairness/explainability.",
  },
  {
    text: "Design the notification system that tells a customer their order is confirmed, being prepared, picked up, and arriving. How do you guarantee ordering and avoid duplicate pushes?",
    company: "zomato", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },

  /* ── PhonePe — technical (2026-Q3 expansion) ───────────────────── */
  {
    text: "Given a stream of UPI transactions, find the top-K merchants by volume in the last 10 minutes with a sliding window. Walk me through your data structure choice.",
    company: "phonepe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "PhonePe technical rounds tie DSA to payments reality: expect stream-processing, idempotency, and concurrency framed around real UPI scale rather than abstract puzzles.",
  },
  {
    text: "Implement a rate limiter for an API that must allow 5000 requests per second per merchant. Which algorithm, and how does it behave at the boundary?",
    company: "phonepe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Find the number of ways to make a payment of amount N using given UPI cashback denominations. Then optimise the space complexity of your DP.",
    company: "phonepe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Classic coin-change framed in-domain. PhonePe wants the optimal-substructure reasoning stated aloud and the 2D→1D DP space optimisation.",
  },

  /* ── CRED — behavioral (2026-Q3 expansion) ─────────────────────── */
  {
    text: "Show me something you built or shipped that you're genuinely proud of. Why does the detail matter?",
    company: "cred", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "CRED interviews are craft- and detail-obsessed; interviewers reward candidates who care about the last 10% of polish and can articulate *why* a small detail mattered to the user.",
  },
  {
    text: "Tell me about a time you rejected 'good enough' and pushed for a higher bar. What did it cost, and was it worth it?",
    company: "cred", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Describe a product experience (any company's) you think is beautifully designed, and one you think is broken. What separates them?",
    company: "cred", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Taste probe. CRED filters hard for product sense and opinions held with reasons; a generic 'it's intuitive' answer is a red flag.",
  },

  /* ── Zerodha — system-design (2026-Q3 expansion) ───────────────── */
  {
    text: "Design the order-matching flow for Kite so a market order gets acknowledged in single-digit milliseconds during the 9:15 AM open surge. Where are your bottlenecks?",
    company: "zerodha", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Zerodha runs India's largest retail brokerage on a lean stack; system-design rounds probe low-latency, market-open spikes, and correctness under load rather than web-scale CRUD.",
  },
  {
    text: "Design a system to stream live market ticks to millions of concurrent Kite users. How do you fan out updates without melting the backend?",
    company: "zerodha", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "How would you build the end-of-day reconciliation between trades, the exchange, and the depository so no position is ever wrong? What happens on a mismatch?",
    company: "zerodha", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Correctness-over-cleverness probe. In broking, a reconciliation bug is a regulatory event; interviewers want idempotency, audit trails, and a clear mismatch-handling policy.",
  },

  /* ── Groww — system-design (2026-Q3, backs existing SEO page) ──── */
  {
    text: "Design the mutual-fund order and portfolio system for Groww so a user's holdings and NAV update correctly across SIPs, redemptions, and market close. What's your source of truth?",
    company: "groww", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Groww spans MF, stocks, and F&O for a huge retail base; system-design rounds probe correctness of money movement, eventual consistency of portfolio views, and reconciliation with RTAs/exchanges.",
  },
  {
    text: "How would you design the SIP scheduler that executes millions of recurring investments on the same date each month without double-charging or missing any?",
    company: "groww", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design the watchlist and price-alert service that pushes a notification the moment a stock crosses a user's target. How do you evaluate millions of alert rules cheaply?",
    company: "groww", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Fan-in evaluation problem. Strong answers index alerts by price bucket rather than scanning every rule per tick.",
  },

  /* ── Paytm — technical (2026-Q3 expansion) ─────────────────────── */
  {
    text: "Design a data structure that supports insert, delete, and getRandom in O(1). Then explain where you'd use it in a payments backend.",
    company: "paytm", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Paytm technical rounds mix standard DSA with a 'where would you use this' follow-up that ties back to wallet/payments systems. Have the production framing ready.",
  },
  {
    text: "Given transaction logs, detect the first duplicate transaction ID in a stream. Optimise for memory when the stream is unbounded.",
    company: "paytm", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Merge K sorted lists of settlement records into a single time-ordered ledger. What's your time complexity and why?",
    company: "paytm", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Heap-based merge framed in-domain. Paytm wants the min-heap insight and an honest complexity analysis, plus handling of duplicate timestamps.",
  },

  /* ── Flipkart — technical (DSA + machine coding) ─────────────── */
  {
    text: "Given a large product catalogue, return the top-K best-selling items in a category efficiently as new sales stream in. Which data structure, and why?",
    company: "flipkart", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Flipkart technical rounds pair classic DSA with a machine-coding round; problems are usually framed in commerce terms (catalogue, cart, inventory). Expect a heap or count-min discussion and a follow-up on updates.",
  },
  {
    text: "Design and code an in-memory rate limiter or LRU cache for a product-detail service. Keep it clean, testable, and thread-safe.",
    company: "flipkart", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Flipkart's machine-coding round rewards clean, extensible OOP with clear interfaces and unit-testable structure over cramming everything into one function.",
  },
  {
    text: "Given delivery slots and orders, assign orders to slots to maximise fulfilment without overbooking any slot. Walk through your approach and complexity.",
    company: "flipkart", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },

  /* ── Meesho — behavioral (Bharat user empathy) ──────────────── */
  {
    text: "Tell me about a time you built or changed something for a user very different from yourself. How did you learn what they actually needed?",
    company: "meesho", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Meesho serves next-billion Bharat users (tier-2/3, first-time internet, resellers). Behavioral rounds probe genuine user empathy and low-ego learning, not assumptions from a metro-user lens.",
  },
  {
    text: "Describe a decision where the data pointed one way but user reality pointed another. What did you do?",
    company: "meesho", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Give me an example of frugal problem-solving: a real constraint on budget, time, or headcount, and how you still shipped.",
    company: "meesho", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Frugality is a stated Meesho value. Interviewers want a concrete constraint and a resourceful outcome, not a story where more resources magically appeared.",
  },

  /* ── Freshworks — technical (SaaS DSA) ──────────────────────── */
  {
    text: "Parse a large log or CSV stream and compute per-account aggregates in one pass. How do you keep memory bounded as accounts grow?",
    company: "freshworks", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Freshworks (Chennai global SaaS) technical rounds favour clean, practical DSA over exotic algorithms: hashing, streaming aggregation, and clear complexity reasoning applied to product data.",
  },
  {
    text: "Implement an autocomplete or ticket-search feature that returns matches as the user types. Which data structure gives you fast prefix lookups?",
    company: "freshworks", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Given nested comment threads on a support ticket, flatten them into a correctly ordered display and detect cycles. Walk through your traversal.",
    company: "freshworks", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Tree/graph traversal framed in-domain. Freshworks wants correct BFS/DFS, cycle detection, and clean handling of edge cases like orphaned or self-referencing nodes.",
  },

  /* ── Microsoft — technical (DSA) ────────────────────────────── */
  {
    text: "Reverse a linked list in groups of K. Then explain how you'd test it, including the edge cases you'd worry about.",
    company: "microsoft", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Microsoft coding rounds weight clean code, correctness, and explicit edge-case reasoning as much as the algorithm itself. Talk through nulls, K larger than the list, and off-by-one boundaries.",
  },
  {
    text: "Given a binary tree, return its right-side view. Reason aloud about your traversal choice before you write code.",
    company: "microsoft", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Find the minimum window in a string that contains all characters of another string. Optimise it, then walk me through your complexity.",
    company: "microsoft", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Classic sliding-window at Microsoft difficulty. Interviewers look for the two-pointer window, correct shrink condition, and an honest O(n) analysis with the character-count map.",
  },

  /* ── Amazon — technical (DSA) ───────────────────────────────── */
  {
    text: "Given a list of orders with timestamps, find the K most frequently ordered items in a time range. Optimise it, then state your complexity.",
    company: "amazon", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Amazon coding rounds pair DSA with a Leadership Principle undertone (Dive Deep, Customer Obsession). Expect a heap or bucket approach and a follow-up on ties and streaming updates.",
  },
  {
    text: "Given a grid of warehouse cells with obstacles, find the shortest path a robot can take from pickup to drop. Which traversal, and why?",
    company: "amazon", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Design an in-memory structure that returns the current most-recently-used product for a session in O(1). Walk me through the data structures.",
    company: "amazon", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "LRU-style problem framed in-domain. Amazon wants the hash-map-plus-doubly-linked-list insight stated clearly, with correct handling of eviction and updates.",
  },

  /* ── Zomato — behavioral ────────────────────────────────────── */
  {
    text: "Tell me about a time you shipped something under a hard deadline where you had to trade off scope. How did you decide what to cut?",
    company: "zomato", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Zomato's fast, demand-supply-driven culture rewards a defensible prioritisation rule under pressure, not recklessness. Interviewers want the specific trade-off and a measurable outcome.",
  },
  {
    text: "Describe a decision you made that had a measurable customer impact, good or bad. What did you learn?",
    company: "zomato", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Give me an example of navigating a trade-off between moving fast and getting it right. Which did you pick, and would you again?",
    company: "zomato", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },

  /* ── Salesforce — system design ─────────────────────────────── */
  {
    text: "Design a multi-tenant SaaS data model where thousands of customers share infrastructure but never see each other's data. How do you enforce isolation?",
    company: "salesforce", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Salesforce is the canonical multi-tenant CRM; system-design rounds probe tenant isolation, per-tenant limits, and metadata-driven customisation. Expect follow-ups on the 'noisy neighbour' problem.",
  },
  {
    text: "Design a workflow/automation engine that lets customers define triggers and actions on records without writing code. How do you execute rules reliably at scale?",
    company: "salesforce", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design an audit trail that records every change to a customer record and supports fast point-in-time queries. What are your storage and indexing trade-offs?",
    company: "salesforce", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Enterprise-grade auditability is a Salesforce staple. Strong answers separate the write-optimised append log from the read-optimised query path.",
  },

  /* ── Adobe — technical (DSA) ────────────────────────────────── */
  {
    text: "Given a large image represented as a 2D matrix, implement a flood-fill (paint bucket). Then discuss how you'd bound memory on a huge canvas.",
    company: "adobe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Adobe coding rounds often use graphics- and document-flavoured DSA. Flood-fill tests BFS/DFS, and the memory follow-up separates strong candidates.",
  },
  {
    text: "Implement an LRU cache for rendered document thumbnails. Walk through the data structures and the eviction path.",
    company: "adobe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Given a stream of edit operations, implement undo/redo efficiently. What data structures back each operation?",
    company: "adobe", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Undo/redo framed in-domain (Adobe's editors). Interviewers want two stacks or a command pattern, with clear handling of the redo-invalidation-on-new-edit case.",
  },

  /* ── Oracle — technical (DSA + SQL) ─────────────────────────── */
  {
    text: "Given two large sorted datasets that don't fit in memory, describe how you'd compute their intersection efficiently.",
    company: "oracle", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Oracle's database heritage shows up in external-memory and merge-style problems. Expect the two-pointer merge insight plus a discussion of I/O cost.",
  },
  {
    text: "Write a query to find the second-highest salary per department, then explain how you'd make it efficient on a large table.",
    company: "oracle", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "SQL fluency is heavily tested at Oracle. Interviewers want window functions or a correlated subquery and an awareness of indexing.",
  },
  {
    text: "Detect a cycle in a linked list and return the node where the cycle begins. Walk me through why your pointer math works.",
    company: "oracle", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },

  /* ── Cisco — system design (networking scale) ──────────────── */
  {
    text: "Design a service that collects telemetry from millions of network devices and lets operators query health in near real time. What's your ingestion path?",
    company: "cisco", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Cisco system-design rounds lean on networking and device-scale telemetry. Strong answers address high-cardinality ingestion, time-series storage, and back-pressure.",
  },
  {
    text: "Design a configuration-management system that pushes and rolls back settings across a fleet of devices safely. How do you avoid bricking the fleet on a bad config?",
    company: "cisco", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a rate limiter or ACL evaluator that runs on a device's hot path with tight latency and memory budgets. What data structures fit constrained hardware?",
    company: "cisco", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Cisco cares about constrained-hardware trade-offs. Interviewers reward candidates who reason about memory footprint and worst-case latency, not just big-O.",
  },

  /* ── Meta — system design ───────────────────────────────────── */
  {
    text: "Design the News Feed ranking and delivery system. How do you generate a personalised feed for hundreds of millions of users with low latency?",
    company: "meta", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Meta system-design rounds favour their own products. Strong answers separate the ranking/candidate-generation path from delivery and discuss fan-out on write vs read.",
  },
  {
    text: "Design a system to store and serve billions of photos with fast reads. Walk through storage, CDN, and metadata.",
    company: "meta", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a real-time messaging system (like Messenger) with delivery receipts and presence. How do you handle ordering and offline delivery?",
    company: "meta", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Meta interviewers probe the fan-out and consistency trade-offs. Address message ordering, delivery guarantees, and how presence scales.",
  },

  /* ── LinkedIn — system design ───────────────────────────────── */
  {
    text: "Design the 'People You May Know' connection-recommendation system. How do you compute second-degree connections at scale?",
    company: "linkedin", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "LinkedIn system-design rounds centre on the social graph. Strong answers discuss graph storage, offline batch computation, and serving precomputed candidates.",
  },
  {
    text: "Design a system to show 'who viewed your profile' with counts and a recent-viewers list. How do you handle write-heavy view events?",
    company: "linkedin", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Design LinkedIn's feed with a mix of posts, jobs, and recommendations. How do you rank and dedupe across content types?",
    company: "linkedin", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "LinkedIn feed questions want a candidate-generation plus ranking pipeline and a discussion of blending heterogeneous content types.",
  },

  /* ── Apple — behavioral ─────────────────────────────────────── */
  {
    text: "Tell me about a time you obsessed over a detail others thought was too small to matter. What was the outcome?",
    company: "apple", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Apple behavioral rounds prize craftsmanship and attention to detail. Strong answers show why the detail mattered to the end user, not perfectionism for its own sake.",
  },
  {
    text: "Describe a time you disagreed with a decision but had to deliver on it anyway. How did you handle it?",
    company: "apple", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Tell me about a project you kept confidential or worked on with very limited information. How did you stay effective?",
    company: "apple", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Apple's secrecy culture is real. Interviewers value candidates comfortable delivering with limited cross-team visibility.",
  },

  /* ── NVIDIA — system design (ML/GPU infra) ──────────────────── */
  {
    text: "Design a system to serve a large deep-learning model for inference at low latency across many GPUs. How do you batch and route requests?",
    company: "nvidia", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "NVIDIA system-design rounds lean on ML-serving and GPU realities. Strong answers cover dynamic batching, GPU memory limits, and throughput-vs-latency trade-offs.",
  },
  {
    text: "Design a job scheduler for a shared GPU cluster running many training jobs. How do you allocate GPUs fairly and avoid fragmentation?",
    company: "nvidia", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a pipeline to stream and preprocess a massive training dataset into GPUs without starving them. Where is the bottleneck?",
    company: "nvidia", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "NVIDIA cares about keeping GPUs fed. Interviewers probe the data-loading bottleneck, prefetching, and I/O throughput.",
  },

  /* ── Google — system design ─────────────────────────────────── */
  {
    text: "Design a URL shortener (like Google's) that handles billions of redirects with low latency. How do you generate and store keys?",
    company: "google", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Google system-design rounds want crisp requirement-gathering, capacity estimation, and a clean read/write path. Discuss key generation and cache strategy.",
  },
  {
    text: "Design an autocomplete / typeahead suggestion service. How do you rank suggestions and keep latency under 100ms?",
    company: "google", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a distributed rate limiter used across many services. How do you keep counts consistent without a single bottleneck?",
    company: "google", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Google interviewers push on the distributed-consistency trade-off. Address token buckets, sharded counters, and eventual-vs-strict accuracy.",
  },

  /* ── Uber — system design ───────────────────────────────────── */
  {
    text: "Design the rider-driver matching system. How do you find nearby drivers and assign rides at city scale with low latency?",
    company: "uber", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Uber system-design rounds centre on geospatial matching. Strong answers use geohashing or quadtrees for proximity search and discuss the assignment/dispatch trade-offs.",
  },
  {
    text: "Design surge pricing: how do you compute and update price multipliers per area in near real time based on supply and demand?",
    company: "uber", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design the system that tracks live driver locations and streams ETAs to riders. How do you handle the high write volume of location pings?",
    company: "uber", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Uber probes write-heavy geospatial ingestion. Address location-update throughput, spatial indexing, and separating the write path from ETA reads.",
  },

  /* ── JPMorgan Chase — technical ─────────────────────────────── */
  {
    text: "Reverse a linked list, then explain how you'd do it iteratively vs recursively and the trade-offs.",
    company: "jpmc", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "JPMorgan coding rounds favour clean fundamentals and OOP. Expect core DSA plus questions on Java/Spring, exception handling, and clean design.",
  },
  {
    text: "Given a stream of stock trades, compute a running maximum profit from one buy and one sell. State your time and space complexity.",
    company: "jpmc", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Design a class hierarchy for different order types in a trading system. How would you keep it extensible and testable?",
    company: "jpmc", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "JPMorgan values OOP design and finance-domain framing. Interviewers reward SOLID principles, testability, and awareness of correctness in money-handling code.",
  },

  /* ── Stripe — system design ─────────────────────────────────── */
  {
    text: "Design a payments API that must never double-charge a customer. How do you make charge creation idempotent?",
    company: "stripe", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Stripe system-design rounds are correctness-obsessed. Idempotency keys, exactly-once semantics, and reconciliation are the load-bearing concepts.",
  },
  {
    text: "Design a webhook delivery system that reliably notifies merchants of events, with retries and ordering. How do you guarantee at-least-once delivery?",
    company: "stripe", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a ledger that records every money movement and must always balance. How do you handle concurrency and auditability?",
    company: "stripe", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Stripe interviewers probe financial correctness. Strong answers use an append-only double-entry ledger, careful concurrency control, and a clear audit trail.",
  },

  /* ── Flipkart — behavioral ──────────────────────────────────── */
  {
    text: "Tell me about a time you owned a problem end to end that wasn't strictly your responsibility. What made you step in?",
    company: "flipkart", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart behavioral rounds prize ownership and bias for action. Strong answers show initiative with a measurable customer or business outcome.",
  },
  {
    text: "Describe a high-pressure launch (like a Big Billion Days-scale event) where things went wrong. How did you respond?",
    company: "flipkart", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Tell me about a decision you made with incomplete data under a tight deadline. How did you decide, and what happened?",
    company: "flipkart", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart values decisiveness under ambiguity. Interviewers want a defensible decision rule and an honest reflection on the outcome.",
  },

  /* ── Razorpay — system design ───────────────────────────────── */
  {
    text: "Design a payment gateway that routes transactions across multiple banks and handles failures. How do you maximise success rate?",
    company: "razorpay", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Razorpay system-design rounds are payments-native. Strong answers cover smart routing across acquirers, retries, idempotency, and reconciliation.",
  },
  {
    text: "Design the settlement system that reconciles payments and pays out to merchants on schedule. How do you guarantee no money is lost or double-paid?",
    company: "razorpay", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a system to handle UPI payment callbacks and status updates that can arrive late, out of order, or twice. How do you keep state consistent?",
    company: "razorpay", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Razorpay probes UPI-specific realities: asynchronous callbacks, duplicate and delayed notifications, and idempotent state transitions.",
  },

  /* ── Infosys — HR round ─────────────────────────────────────── */
  {
    text: "Why do you want to join Infosys, and are you comfortable relocating to any of our development centres?",
    company: "infosys", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Infosys HR rounds check motivation, mobility, and comfort with the service-bond and training model. Genuine, specific reasons beat generic praise.",
  },
  {
    text: "Are you willing to sign the training agreement and work in any technology or domain we assign you to?",
    company: "infosys", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "Tell me about yourself, and where do you see yourself in five years at Infosys?",
    company: "infosys", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Standard Infosys HR opener. Interviewers want a crisp, honest pitch and realistic ambition aligned with a services-company career path.",
  },

  /* ── Cognizant — HR round ───────────────────────────────────── */
  {
    text: "Why Cognizant, and what do you know about the company and the role you applied for?",
    company: "cognizant", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Cognizant HR rounds reward candidates who did their homework on the company and show flexibility on location and technology.",
  },
  {
    text: "Are you okay with working night shifts or client-timezone hours, and relocating as per project needs?",
    company: "cognizant", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "What are your strengths and weaknesses, and how would you handle a difficult client situation?",
    company: "cognizant", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Cognizant HR wants self-awareness and a client-service mindset. A weakness with a concrete improvement step lands better than a humblebrag.",
  },

  /* ── Capgemini — technical ──────────────────────────────────── */
  {
    text: "Explain the four pillars of OOP with a real example for each, then tell me the difference between an abstract class and an interface.",
    company: "capgemini", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Capgemini technical rounds for freshers lean on OOP, DBMS, and one language of your choice. Clear fundamentals with examples matter more than tricky algorithms.",
  },
  {
    text: "Write a program to check whether a string is a palindrome, and then handle the case-insensitive and ignore-spaces variants.",
    company: "capgemini", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "What is normalization in databases? Explain up to third normal form with an example.",
    company: "capgemini", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Capgemini interviewers frequently test DBMS basics. A concrete table example walking 1NF to 3NF answers this cleanly.",
  },

  /* ── HCL — technical ────────────────────────────────────────── */
  {
    text: "What is the difference between a process and a thread, and when would you use multithreading?",
    company: "hcl", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "HCL technical rounds for freshers cover OS, DBMS, networking, and a coding language. Clear, textbook-accurate fundamentals are the bar.",
  },
  {
    text: "Reverse a string and then a linked list. Explain your approach and complexity for each.",
    company: "hcl", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "Explain the OSI model layers, and what happens when you type a URL into a browser and press enter?",
    company: "hcl", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "HCL often tests networking fundamentals. A structured DNS-to-render walkthrough shows breadth without needing deep systems knowledge.",
  },

  /* ── BCG — behavioral / fit round ───────────────────────────── */
  {
    text: "Why consulting, and why BCG specifically over other firms you're considering?",
    company: "bcg", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "BCG fit interviews want a genuine, specific motivation and evidence of leadership and impact. Rehearsed generic answers are easy to spot.",
  },
  {
    text: "Tell me about a time you led a team through a difficult situation. What was your role and the outcome?",
    company: "bcg", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Describe a time you had to influence someone without formal authority to get a result.",
    company: "bcg", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "BCG fit rounds probe leadership, influence, and drive. Strong answers use structured STAR with a quantified, personal contribution.",
  },

  /* ── Paytm — behavioral ─────────────────────────────────────── */
  {
    text: "Tell me about a time you shipped something fast in a chaotic environment. How did you decide what to cut?",
    company: "paytm", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Paytm behavioral rounds reflect a fast, high-scale fintech culture. Strong answers show a defensible prioritisation rule and a quantified outcome.",
  },
  {
    text: "Describe a production incident you were part of. What was your role in the response and the fix?",
    company: "paytm", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Tell me about a time you disagreed with your manager on a technical or product decision. How did it resolve?",
    company: "paytm", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Paytm values candidates who can disagree constructively and commit. Interviewers want the reasoning and the outcome, not just the disagreement.",
  },

  /* ── Accenture — technical ──────────────────────────────────── */
  {
    text: "What is the difference between SQL and NoSQL databases, and when would you pick each?",
    company: "accenture", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Accenture technical rounds for freshers cover OOP, DBMS, and one language. Clear fundamentals with when-to-use reasoning matter more than tricky code.",
  },
  {
    text: "Write a program to find the second-largest element in an array without sorting it. State the complexity.",
    company: "accenture", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "Explain exception handling in your preferred language, and the difference between checked and unchecked exceptions.",
    company: "accenture", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Accenture frequently probes language fundamentals like exception handling. A concrete example beats a definition recited from memory.",
  },

  /* ── Tech Mahindra — HR round ───────────────────────────────── */
  {
    text: "Why do you want to join Tech Mahindra, and are you willing to relocate and work in any technology we assign?",
    company: "techmahindra", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Tech Mahindra HR rounds check motivation, mobility, and communication. Genuine, specific reasons and flexibility on location and tech land well.",
  },
  {
    text: "Tell me about yourself, and what do you know about Tech Mahindra and its business?",
    company: "techmahindra", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "Are you comfortable with the service agreement and a bond period if applicable?",
    company: "techmahindra", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Tech Mahindra HR often confirms comfort with the training and service terms. Be honest rather than agreeing to terms you will not keep.",
  },

  /* ── Wipro — HR round ───────────────────────────────────────── */
  {
    text: "Why Wipro, and why did you choose IT services over a core or product role?",
    company: "wipro", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Wipro HR rounds want honest motivation and flexibility. A clear reason for choosing services and openness to any technology or location work well.",
  },
  {
    text: "Are you willing to sign the service agreement and work from any of our locations in any shift?",
    company: "wipro", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "What are your strengths, and can you give an example where you used one to solve a problem?",
    company: "wipro", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Wipro HR wants strengths backed by a concrete example, not adjectives. A short STAR story makes the answer credible.",
  },

  /* ── McKinsey — behavioral (Personal Experience Interview) ──── */
  {
    text: "Tell me about a time you led a team to achieve a difficult goal. What did you personally do, and what was the result?",
    company: "mckinsey", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "McKinsey's Personal Experience Interview drills deep on one story. Expect many follow-ups on your specific actions, feelings, and reflections.",
  },
  {
    text: "Describe a situation where you had to persuade a resistant stakeholder. How did you approach it?",
    company: "mckinsey", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Tell me about your most significant personal achievement and why it matters to you.",
    company: "mckinsey", roleFamily: "consultant", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "The PEI rewards depth over breadth. Pick one rich story and be ready for repeated 'why' and 'what exactly did you do' follow-ups.",
  },

  /* ── Swiggy — system design ─────────────────────────────────── */
  {
    text: "Design the food-delivery order-assignment system that matches orders to nearby delivery partners at dinner-peak load. How do you keep latency low?",
    company: "swiggy", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Swiggy system-design rounds centre on real-time logistics. Strong answers use geospatial indexing, batching for efficiency, and handle the dinner-peak demand spike.",
  },
  {
    text: "Design the live order-tracking system that streams delivery-partner location and ETA to the customer. How do you handle high write volume?",
    company: "swiggy", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Design a restaurant search and discovery feed personalised by location, cuisine, and time of day. How do you rank and keep it fresh?",
    company: "swiggy", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Swiggy probes personalised ranking under freshness constraints. Address candidate generation, ranking signals, and cache invalidation for menu availability.",
  },

  /* ── CRED — technical ───────────────────────────────────────── */
  {
    text: "Given a list of credit-card transactions, detect duplicate charges within a short time window. Optimise it and state your complexity.",
    company: "cred", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "CRED technical rounds favour clean, correct code with a product-quality bar. Expect DSA framed around payments, rewards, and card data.",
  },
  {
    text: "Design an in-memory cache with expiry (TTL) and an eviction policy. Which data structures give O(1) get and put?",
    company: "cred", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Given reward points earned across many transactions, compute the maximum points redeemable under a set of constraints. Explain your approach.",
    company: "cred", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "CRED interviewers pair DSA with a product framing. Strong candidates model the constraints cleanly and reason about the greedy-vs-DP trade-off.",
  },

  /* ── OYO — behavioral ───────────────────────────────────────── */
  {
    text: "Tell me about a time you had to deliver under a very aggressive timeline. What did you trade off and why?",
    company: "oyo", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "OYO behavioral rounds reflect a fast, scrappy operating culture. Strong answers show a defensible trade-off and a quantified outcome.",
  },
  {
    text: "Describe a time you worked with limited resources or data to solve a problem. How did you make progress?",
    company: "oyo", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
  },
  {
    text: "Tell me about a time you took ownership of something outside your defined role. What drove you to step in?",
    company: "oyo", roleFamily: "behavioral", focus: "behavioral",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "OYO values ownership and bias for action. Interviewers want initiative tied to a real business or customer outcome, not busywork.",
  },

  /* ── Capgemini — HR round ───────────────────────────────────── */
  {
    text: "Why Capgemini, and are you comfortable relocating and working in any technology or domain we assign?",
    company: "capgemini", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Capgemini HR rounds check motivation, mobility, and communication. Specific, genuine reasons and flexibility on location and tech work best.",
  },
  {
    text: "Tell me about yourself, and are you okay with the training period and service agreement?",
    company: "capgemini", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "How do you handle pressure, and can you give an example of a time you did?",
    company: "capgemini", roleFamily: "campus", focus: "hr",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "Capgemini HR wants self-awareness backed by an example. A short STAR story about handling pressure beats a generic 'I stay calm'.",
  },

  /* ── IBM — technical ────────────────────────────────────────── */
  {
    text: "Explain the difference between an array and a linked list, and when you would choose each.",
    company: "ibm", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
    styleNote: "IBM technical rounds for freshers cover DSA basics, OOP, DBMS, and one language. Clear fundamentals with trade-off reasoning matter most.",
  },
  {
    text: "Write a program to count the frequency of each character in a string. What data structure do you use and why?",
    company: "ibm", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "warmup", confidence: "inferred",
  },
  {
    text: "What are joins in SQL? Explain inner, left, and right joins with a simple example.",
    company: "ibm", roleFamily: "swe", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "IBM frequently tests DBMS and SQL basics. A concrete two-table example makes the join explanation land clearly.",
  },

  /* ── Goldman Sachs — system design (trading/risk) ───────────── */
  {
    text: "Design a real-time position and risk aggregation system across many trading desks. How do you keep it consistent and low-latency?",
    company: "goldman", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Goldman system-design rounds are finance-native. Strong answers address consistency of aggregated positions, event ordering, and correctness under high message rates.",
  },
  {
    text: "Design an order-management system that accepts, validates, and routes trade orders to exchanges. How do you handle partial fills and cancellations?",
    company: "goldman", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a system to store and query years of tick-level market data for backtesting. How do you optimise for time-range reads?",
    company: "goldman", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Goldman probes time-series storage and read optimisation. Address columnar/time-partitioned storage and the write-vs-read trade-off for tick data.",
  },

  /* ── JPMorgan — system design (transaction scale) ───────────── */
  {
    text: "Design a system to process millions of card transactions per day with fraud checks in the authorisation path. How do you keep latency low?",
    company: "jpmc", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "JPMorgan system-design rounds centre on high-volume transaction processing. Strong answers separate the low-latency authorisation path from asynchronous fraud scoring.",
  },
  {
    text: "Design a ledger for a retail bank that records every account movement and must always balance. How do you handle concurrency and audit?",
    company: "jpmc", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a notification system that alerts customers of transactions in near real time across SMS, email, and push. How do you guarantee delivery?",
    company: "jpmc", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "JPMorgan probes reliable multi-channel delivery. Address at-least-once delivery, deduplication, and channel fallback.",
  },

  /* ── Morgan Stanley — system design (market data/trade lifecycle) */
  {
    text: "Design a market-data distribution system that fans out live price updates to thousands of internal consumers with minimal latency.",
    company: "morgan-stanley", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Morgan Stanley system-design rounds probe low-latency fan-out. Strong answers cover pub/sub, back-pressure, and slow-consumer handling.",
  },
  {
    text: "Design a system that tracks a trade through its full lifecycle (execution, confirmation, settlement) with a full audit trail. How do you model state transitions?",
    company: "morgan-stanley", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a reconciliation system that compares internal trade records against a counterparty's and flags mismatches. How do you scale the comparison?",
    company: "morgan-stanley", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Morgan Stanley probes reconciliation at scale. Address batching, keyed matching, and how you surface and resolve breaks.",
  },

  /* ── Barclays — system design (payments/reconciliation) ─────── */
  {
    text: "Design a payment-processing system for a bank that handles transfers reliably and never loses or double-sends money. Walk through the failure handling.",
    company: "barclays", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Barclays system-design rounds are correctness-focused. Strong answers use idempotency, a state machine per transfer, and reconciliation for every failure mode.",
  },
  {
    text: "Design a fraud-detection pipeline that scores transactions in real time and flags suspicious ones for review. What signals and storage do you use?",
    company: "barclays", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design a batch job that reconciles a day's transactions against clearing-house files and produces a mismatch report. How do you make it restartable?",
    company: "barclays", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Barclays probes reliable batch processing. Address idempotent, restartable jobs, checkpointing, and clear mismatch reporting.",
  },

  /* ── Deutsche Bank — system design (settlement/regulatory) ──── */
  {
    text: "Design a trade-settlement system that moves securities and cash between parties and must be auditable and regulator-reportable. How do you guarantee correctness?",
    company: "deutsche-bank", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Deutsche Bank system-design rounds weigh auditability and regulatory reporting. Strong answers use an append-only event log and a clear settlement state machine.",
  },
  {
    text: "Design a system that ingests regulatory-reporting data from many source systems and produces accurate, timely reports. How do you handle late or corrected data?",
    company: "deutsche-bank", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
  },
  {
    text: "Design an audit-log service that records every sensitive action immutably and supports fast point-in-time queries. How do you store and index it?",
    company: "deutsche-bank", roleFamily: "swe", focus: "system-design",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Deutsche Bank probes immutable audit trails. Address append-only storage, tamper-evidence, and read-optimised point-in-time queries.",
  },

  /* ── Flipkart — data engineer ──────────────────────────────── */
  {
    text: "Write a SQL query to find, for each product category, the top 3 sellers by revenue in the last 30 days, handling ties consistently.",
    company: "flipkart", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart data-engineer screens lean heavily on window functions. Expect ROW_NUMBER/RANK, partitioning, and correct tie-handling.",
  },
  {
    text: "Design a batch and streaming pipeline that ingests clickstream events and produces near-real-time category-level conversion metrics. How do you handle late-arriving events?",
    company: "flipkart", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Flipkart probes lambda/kappa trade-offs, watermarking, and idempotent aggregation for e-commerce analytics at scale.",
  },
  {
    text: "How would you model an orders fact table and its dimensions for an analytics warehouse serving both finance and category teams? Discuss grain and slowly changing dimensions.",
    company: "flipkart", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart data-modelling rounds test dimensional modelling: fact-table grain, star schema, and SCD type-2 handling.",
  },

  /* ── Amazon — data engineer / BIE ──────────────────────────── */
  {
    text: "Given a large fact table of orders and a dimension table of customers, write SQL to compute month-over-month retention cohorts. Optimise for a columnar warehouse like Redshift.",
    company: "amazon", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Amazon BIE/data-engineer rounds combine advanced SQL with warehouse-aware optimisation (distribution keys, sort keys, columnar scans).",
  },
  {
    text: "Design an ETL pipeline that loads daily transactional data from operational databases into a warehouse, handling schema drift and idempotent reloads. What do you use on AWS?",
    company: "amazon", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Amazon data-engineer rounds test AWS-native ETL (Glue, S3, Redshift, EMR), idempotency, and schema-evolution handling.",
  },
  {
    text: "How do you design a data-quality framework that catches broken pipelines and bad data before it reaches business dashboards? What checks and alerts do you add?",
    company: "amazon", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Amazon prizes operational rigour: data-quality gates, freshness/volume/schema checks, and clear ownership of pipeline SLAs.",
  },

  /* ── Walmart Global Tech — data engineer ───────────────────── */
  {
    text: "Design a Spark pipeline that joins a huge sales fact table against several dimension tables where one dimension is heavily skewed. How do you avoid the skew bottleneck?",
    company: "walmart-global-tech", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Walmart Global Tech data-engineer rounds probe Spark internals: skew handling, salting, broadcast joins, and partition tuning at retail scale.",
  },
  {
    text: "Write SQL to deduplicate a table of inventory snapshots keeping only the latest record per store-SKU, then explain how you'd make this incremental.",
    company: "walmart-global-tech", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Walmart tests window-function deduplication and incremental-processing design for large retail datasets.",
  },
  {
    text: "How would you design a scalable data lake and warehouse layout for retail supply-chain analytics? Discuss partitioning, file formats, and serving layers.",
    company: "walmart-global-tech", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Walmart data-architecture rounds test lakehouse layout, columnar formats (Parquet), partition strategy, and serving-layer choices.",
  },

  /* ── Uber — data engineer ──────────────────────────────────── */
  {
    text: "Design a pipeline that computes real-time surge-relevant supply/demand metrics per geohash from a stream of trip events. How do you bound latency and handle out-of-order events?",
    company: "uber", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Uber data-engineer rounds probe streaming systems: windowing, watermarks, geospatial bucketing, and latency budgets for real-time metrics.",
  },
  {
    text: "Write a SQL query to compute the median trip duration per city per hour from a trips table, and explain how you'd scale it to billions of rows.",
    company: "uber", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Uber tests percentile computation in SQL plus reasoning about approximate algorithms (t-digest) at very large scale.",
  },
  {
    text: "How would you design a self-serve metrics/semantic layer so analysts get consistent definitions of core business metrics across teams?",
    company: "uber", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Uber pioneered internal metrics platforms; rounds probe metric standardisation, semantic layers, and governance over ad-hoc definitions.",
  },

  /* ── Swiggy — data engineer ────────────────────────────────── */
  {
    text: "Design a pipeline that produces per-restaurant delivery-time analytics from order and GPS event streams. How do you join streams with different arrival rates?",
    company: "swiggy", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Swiggy data-engineer rounds probe stream-stream joins, event-time processing, and handling GPS event volume in food delivery.",
  },
  {
    text: "Write SQL to find restaurants whose weekly order volume dropped more than 20% compared to the previous week, across all cities.",
    company: "swiggy", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Swiggy tests window functions with LAG for week-over-week comparison and correct partitioning by restaurant and city.",
  },
  {
    text: "How would you design an experimentation data pipeline that computes A/B test metrics reliably, guarding against sample-ratio mismatch and peeking?",
    company: "swiggy", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Swiggy is experimentation-heavy; rounds probe A/B metric pipelines, SRM detection, and statistically sound aggregation.",
  },

  /* ── PhonePe — data engineer ───────────────────────────────── */
  {
    text: "Design a pipeline that computes daily per-merchant settlement summaries from a high-volume UPI transaction stream. How do you guarantee no transaction is double-counted?",
    company: "phonepe", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "PhonePe data-engineer rounds probe exactly-once aggregation over payment streams: idempotency keys, dedup windows, and reconciliation against ledger.",
  },
  {
    text: "Write SQL to detect merchants whose daily transaction success rate dropped below 90% on any day in the last week, across all states.",
    company: "phonepe", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "PhonePe tests analytical SQL with conditional aggregation and partitioned thresholds for payment-health monitoring.",
  },
  {
    text: "How would you build a fraud-signal feature pipeline that computes rolling per-user aggregates (velocity, distinct devices) with low latency for scoring?",
    company: "phonepe", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "PhonePe probes real-time feature engineering: rolling windows, stateful stream processing, and latency budgets for fraud scoring.",
  },

  /* ── Paytm — data engineer ─────────────────────────────────── */
  {
    text: "Design an ingestion pipeline that consolidates transaction data across wallet, UPI, and cards into a unified warehouse table. How do you reconcile differing schemas and late data?",
    company: "paytm", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Paytm data-engineer rounds probe multi-source ingestion, schema unification, and late-data reconciliation across payment rails.",
  },
  {
    text: "Write SQL to compute the 7-day rolling active user count per city from an events table, and explain how to make it incremental.",
    company: "paytm", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Paytm tests rolling-window SQL and incremental-computation design for large user-activity datasets.",
  },
  {
    text: "How would you design a data-quality and alerting layer so a broken upstream feed does not silently corrupt daily revenue dashboards?",
    company: "paytm", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Paytm probes operational data-quality: freshness/volume/schema checks, circuit-breaking, and clear pipeline ownership for financial reporting.",
  },

  /* ── Zomato — data engineer ────────────────────────────────── */
  {
    text: "Design a pipeline that computes per-city delivery-partner utilisation metrics in near-real-time from order and location events. How do you handle bursty dinner-time load?",
    company: "zomato", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Zomato data-engineer rounds probe stream processing under bursty load: autoscaling, back-pressure, and event-time windowing for delivery analytics.",
  },
  {
    text: "Write SQL to rank restaurants by repeat-order rate within each city, treating a repeat as an order from a user who ordered from that restaurant before.",
    company: "zomato", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Zomato tests self-join and window-function SQL for cohort-style metrics partitioned by city.",
  },
  {
    text: "How would you model a warehouse to support both operational dashboards and ad-hoc analyst queries without them contending for the same resources?",
    company: "zomato", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Zomato probes warehouse design: workload isolation, materialised aggregates, and serving-layer separation for mixed query patterns.",
  },

  /* ── Meesho — data engineer ────────────────────────────────── */
  {
    text: "Design a pipeline that computes supplier catalogue-quality scores from listing, order, and return events. How do you handle high return rates skewing the signal?",
    company: "meesho", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Meesho data-engineer rounds probe multi-event scoring pipelines and handling of noisy signals like returns in a social-commerce context.",
  },
  {
    text: "Write SQL to find, per category, the suppliers whose order volume grew fastest month-over-month, excluding suppliers with fewer than 100 orders.",
    company: "meesho", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Meesho tests window-function growth metrics with LAG and threshold filtering for supplier analytics.",
  },
  {
    text: "How would you design a cost-efficient data platform for a value-focused marketplace where controlling warehouse and compute spend is a hard constraint?",
    company: "meesho", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Meesho is cost-conscious; rounds probe partition pruning, storage-format choices, and compute-cost trade-offs in platform design.",
  },

  /* ── CRED — data engineer ──────────────────────────────────── */
  {
    text: "Design a pipeline that computes per-user creditworthiness features from bureau data, transaction history, and app behaviour, ensuring feature reproducibility for model training.",
    company: "cred", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "CRED data-engineer rounds probe feature pipelines with point-in-time correctness and reproducibility for credit ML models.",
  },
  {
    text: "Write SQL to compute each user's on-time payment ratio over the trailing 6 statements, handling users with fewer than 6 statements gracefully.",
    company: "cred", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "CRED tests window-function SQL over statement history with careful handling of partial windows.",
  },
  {
    text: "How would you design a data pipeline that respects strict PII and financial-data governance while still enabling analytics and model training?",
    company: "cred", roleFamily: "data", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "CRED probes governance-aware data engineering: tokenisation, access controls, and lineage for sensitive financial data.",
  },

  /* ── RBI Grade B — interview (personal + policy) ───────────── */
  {
    text: "Interview board: 'Explain the RBI's monetary-policy transmission mechanism. Why does a repo-rate cut not always reach borrowers?' Structure a crisp answer.",
    company: "rbi", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "RBI Grade B interview boards probe monetary-policy fundamentals. Strong answers cover the rate-corridor, bank spreads, and transmission lags concisely.",
  },
  {
    text: "Interview board: 'You have an engineering background, not economics. Why the RBI, and what would you bring to banking supervision?' Answer convincingly.",
    company: "rbi", roleFamily: "civil-services", focus: "government-psu",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "RBI boards test motivation and cross-domain fit. Address genuine interest in central banking and transferable analytical strengths without sounding rehearsed.",
  },

  /* ── IBPS PO — interview (banking awareness + fit) ─────────── */
  {
    text: "PI: 'What is the difference between a NBFC and a bank, and why does the distinction matter for the customer?' Explain simply.",
    company: "ibps", roleFamily: "psu-engineer", focus: "government-psu",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "IBPS PO panels test banking awareness. Cover deposit-taking, regulation, and lending scope in plain language, with a customer lens.",
  },
  {
    text: "PI: 'A customer is angry that a UPI transaction failed but money was debited. As a probationary officer at the branch, how do you handle it?' Walk through your steps.",
    company: "ibps", roleFamily: "psu-engineer", focus: "government-psu",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "IBPS PO panels probe customer-service temperament. Strong answers show empathy, knowledge of the reversal/complaint process, and composure under pressure.",
  },

  /* ── D. E. Shaw — quant/probability ────────────────────────── */
  {
    text: "A fair coin is flipped until two consecutive heads appear. What is the expected number of flips? Derive it.",
    company: "de-shaw", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "D. E. Shaw probability rounds test clean expected-value derivations via recurrence relations, narrated clearly under questioning.",
  },
  {
    text: "You have 25 horses and can race 5 at a time with no timer. What is the minimum number of races to find the top 3 fastest?",
    company: "de-shaw", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "D. E. Shaw uses classic combinatorial-logic puzzles; the signal is a rigorous, minimal-case argument, not just the known answer of 7.",
  },

  /* ── Citadel / Citadel Securities — quant ──────────────────── */
  {
    text: "Two players alternately pick coins from either end of a row of coins with known values. Both play optimally to maximise their own total. Do you go first, and what's your strategy?",
    company: "citadel", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Citadel game-theory rounds test optimal-play reasoning and dynamic programming; explain the recurrence and why first-mover choice matters.",
  },
  {
    text: "A stick is broken at two uniformly random points. What is the probability the three pieces can form a triangle? Derive it.",
    company: "citadel", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Citadel probability rounds test geometric-probability reasoning; the clean 1/4 answer must come from a correct region argument.",
  },
  {
    text: "I offer you a game: roll a die, and you may re-roll once if you choose. You get the final face value in rupees. What's the fair price to play, and your re-roll rule?",
    company: "citadel", roleFamily: "quant", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Citadel expected-value games test optimal-stopping thresholds; strong answers state the re-roll rule (below 3.5) and compute the fair price.",
  },

  /* ── L&T — core-engineering campus (GET) ───────────────────── */
  {
    text: "L&T runs large EPC projects with tight schedules. Explain a core concept from your branch that would matter on a construction or heavy-engineering site, and how you'd apply it.",
    company: "l-and-t", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "L&T GET interviews test applied fundamentals for site work. Connect a branch concept to real EPC or construction scenarios, not textbook definitions.",
  },
  {
    text: "L&T site postings can mean long stints at remote project locations. Are you genuinely prepared for that, and how have you thought it through?",
    company: "l-and-t", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "L&T HR rounds probe willingness for site life. Honest, thought-through answers about mobility and field work beat eager but hollow yeses.",
  },

  /* ── BHEL — core-engineering campus (ET) ───────────────────── */
  {
    text: "BHEL manufactures heavy power equipment like turbines and boilers. Pick a thermodynamics or manufacturing concept from your syllabus and explain where it applies in a power plant.",
    company: "bhel", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "BHEL ET interviews test core mechanical/electrical fundamentals mapped to power equipment. Ground answers in turbines, boilers, or generators.",
  },
  {
    text: "Why a PSU like BHEL over a private-sector job, and are you aware of what a long-term manufacturing career here involves?",
    company: "bhel", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "BHEL HR rounds test genuine PSU motivation. Address stability, scale of work, and awareness of a manufacturing career without disparaging private options.",
  },

  /* ── ONGC — core-engineering campus (GT) ───────────────────── */
  {
    text: "ONGC works across upstream oil and gas. Explain a fluid-mechanics or reservoir concept from your branch and how it relates to drilling or production.",
    company: "ongc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "ONGC GT interviews test branch fundamentals tied to upstream operations. Petroleum, mechanical, and chemical concepts should map to drilling or production.",
  },

  /* ── NTPC — core-engineering campus (GET) ──────────────────── */
  {
    text: "NTPC runs large thermal and renewable generation. Explain how a power plant converts fuel to electricity at a high level, and where efficiency losses occur.",
    company: "ntpc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "NTPC GET interviews test power-plant fundamentals. A clear energy-conversion chain (fuel to steam to turbine to generator) with loss points signals real understanding.",
  },
  {
    text: "India is pushing renewables alongside thermal. Where do you see NTPC's generation mix heading, and how would you want to contribute as a young engineer?",
    company: "ntpc", roleFamily: "campus", focus: "campus-placement",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "NTPC HR rounds probe awareness of the energy transition. Balanced views on thermal-plus-renewables and a genuine contribution angle land well.",
  },

  /* ── Google — data scientist / ML ──────────────────────────── */
  {
    text: "You launch a feature and DAU rises but session length falls. Design an analysis to decide whether the feature is net positive. What metrics and tests do you use?",
    company: "google", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Google data-scientist rounds test product-sense analytics: metric trade-offs, guardrail metrics, and rigorous experiment design over rote statistics.",
  },
  {
    text: "Explain the bias-variance trade-off and how you'd diagnose whether a model is underfitting or overfitting from its learning curves.",
    company: "google", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Google tests ML fundamentals with practical diagnosis. Connect bias-variance to learning curves, regularisation, and data-size decisions.",
  },
  {
    text: "Derive why maximum-likelihood estimation for linear regression with Gaussian noise gives the least-squares objective.",
    company: "google", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Google data-scientist rounds probe statistical foundations. A clean MLE-to-least-squares derivation signals genuine depth.",
  },

  /* ── Amazon — applied scientist ────────────────────────────── */
  {
    text: "Design a recommendation model for a marketplace with millions of items and cold-start users. How do you handle sparsity and evaluate offline versus online?",
    company: "amazon", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Amazon applied-scientist rounds test recommender design: cold start, sparsity, candidate generation versus ranking, and offline/online eval alignment.",
  },
  {
    text: "How would you detect and correct for label leakage in a fraud-detection model before it silently inflates offline metrics?",
    company: "amazon", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Amazon probes ML rigour: leakage detection, temporal validation, and the gap between offline metrics and production performance.",
  },
  {
    text: "Explain precision, recall, and how you'd choose an operating threshold for a model that flags suspicious transactions where false positives annoy customers.",
    company: "amazon", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Amazon applied-scientist rounds tie metrics to business cost. Reason about the precision-recall trade-off in terms of customer friction and cost.",
  },

  /* ── Flipkart — data scientist ─────────────────────────────── */
  {
    text: "Design an ML system to predict delivery delays at order time. What features, model, and feedback loop would you use, and how do you avoid stale predictions?",
    company: "flipkart", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Flipkart data-scientist rounds test end-to-end ML system thinking: feature engineering, model choice, retraining cadence, and feedback loops.",
  },
  {
    text: "A pricing model performs well in offline tests but underperforms live. List the likely reasons and how you'd investigate each.",
    company: "flipkart", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart probes the offline-online gap: distribution shift, feedback loops, leakage, and train-serve skew, diagnosed systematically.",
  },
  {
    text: "How would you design an A/B test for a new ranking model when network effects mean one user's experience affects another's?",
    company: "flipkart", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Flipkart data-scientist rounds probe experiment design under interference: cluster randomisation and handling network effects.",
  },

  /* ── Microsoft — data scientist ────────────────────────────── */
  {
    text: "You must build a churn-prediction model for an enterprise SaaS product. Walk through problem framing, features, model, and how you'd make predictions actionable for the business.",
    company: "microsoft", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Microsoft data-scientist rounds emphasise problem framing and actionability, not just modelling. Tie predictions to business intervention.",
  },
  {
    text: "Explain how you'd handle a heavily imbalanced classification problem, and why accuracy is misleading here. What metrics and techniques apply?",
    company: "microsoft", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Microsoft tests imbalanced-learning fundamentals: resampling, class weights, PR-AUC over accuracy, and threshold selection.",
  },
  {
    text: "Given a large user-events table, write SQL to compute a funnel conversion rate across four ordered steps, then explain how you'd model drop-off.",
    company: "microsoft", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Microsoft data-scientist rounds combine SQL funnel analysis with modelling intuition about where and why users drop off.",
  },

  /* ── Meesho — data scientist ───────────────────────────────── */
  {
    text: "Design a model to rank supplier listings for a value-conscious shopper where price sensitivity is high. How do you balance relevance, price, and quality?",
    company: "meesho", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Meesho data-scientist rounds test ranking under multiple objectives: relevance, price sensitivity, and quality signals for a value marketplace.",
  },
  {
    text: "You want to reduce returns without hurting orders. Frame this as an ML and experimentation problem end to end.",
    company: "meesho", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Meesho probes problem framing tied to a real cost (returns) with a guardrail (orders), plus sound experiment design.",
  },
  {
    text: "Explain how you'd evaluate a recommendation model offline when you only have logged data from the current production model (selection bias).",
    company: "meesho", roleFamily: "ml", focus: "technical",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Meesho data-scientist rounds probe off-policy evaluation and selection bias in logged recommendation data.",
  },

  /* ── CRED — product designer ───────────────────────────────── */
  {
    text: "Walk me through a project in your portfolio end to end: the problem, your process, the trade-offs you made, and how you measured whether the design worked.",
    company: "cred", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "CRED design rounds centre on portfolio depth and craft. Strong answers show process, trade-offs, and outcome metrics, not just polished screens.",
  },
  {
    text: "CRED is known for a premium, distinctive aesthetic. How do you balance a strong brand-led visual identity against usability and accessibility?",
    company: "cred", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "CRED probes the craft-versus-usability tension. Address when brand expression is worth friction and how you keep it accessible.",
  },

  /* ── Flipkart — product designer ───────────────────────────── */
  {
    text: "Design the returns-and-refund flow for a first-time online shopper in a tier-3 town on a slow connection. Walk me through your key decisions.",
    company: "flipkart", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Flipkart design rounds test India-first, mobile-first thinking: low-connectivity, low-trust, first-time users, and clear, forgiving flows.",
  },
  {
    text: "Critique the checkout experience of any e-commerce app you use. What would you change first, and how would you validate it?",
    company: "flipkart", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart app-critique rounds test evaluative judgement: spot real friction, prioritise, and propose a testable change.",
  },
  {
    text: "How do you design consistently across dozens of teams shipping in parallel? What's your view on design systems and their limits?",
    company: "flipkart", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Flipkart probes systems thinking at scale: componentisation, governance, and when a design system helps versus constrains.",
  },

  /* ── Swiggy — product designer ─────────────────────────────── */
  {
    text: "Design the live order-tracking experience after a user places a food order. What information matters most, and how does it change over the delivery lifecycle?",
    company: "swiggy", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Swiggy design rounds test lifecycle-aware information design: what a user needs at each stage of a live delivery, and reducing anxiety.",
  },
  {
    text: "How would you redesign the restaurant-discovery experience to help an undecided, hungry user choose faster without overwhelming them?",
    company: "swiggy", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Swiggy probes decision-support design: reducing choice overload, personalisation, and speed-to-decision for a high-intent user.",
  },
  {
    text: "Walk me through a portfolio project where a design decision was contested by product or engineering. How did you resolve it?",
    company: "swiggy", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Swiggy tests cross-functional collaboration: how you argue for a design decision with data and empathy without digging in.",
  },

  /* ── Razorpay — product designer ───────────────────────────── */
  {
    text: "Design an onboarding flow that gets a small-business owner from sign-up to accepting their first payment as fast as possible. What do you cut, and what do you keep?",
    company: "razorpay", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "Razorpay design rounds test B2B/fintech onboarding: reducing time-to-value, compliance friction (KYC), and trust for SMB users.",
  },
  {
    text: "How do you design a complex dashboard (payments, refunds, settlements, disputes) so a non-technical merchant can understand it at a glance?",
    company: "razorpay", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Razorpay probes information design for dense financial data: hierarchy, progressive disclosure, and clarity for non-experts.",
  },
  {
    text: "Walk me through how you'd approach designing for error and edge cases in a payment flow, where failures directly affect trust and money.",
    company: "razorpay", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "Razorpay tests error-state and edge-case design in a high-stakes money context: clear recovery, reassurance, and never losing the user.",
  },

  /* ── PhonePe — product designer ────────────────────────────── */
  {
    text: "Design a payments experience that works for a first-time smartphone user in a regional language who is nervous about digital money. What guides your choices?",
    company: "phonepe", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "intense", confidence: "inferred",
    styleNote: "PhonePe design rounds test inclusive, vernacular, low-literacy-friendly design for next-billion users and building trust in digital payments.",
  },
  {
    text: "Critique the UPI payment flow in any app. Where is the friction, and how would you reduce steps without reducing safety?",
    company: "phonepe", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "PhonePe app-critique rounds test the friction-versus-safety trade-off specific to UPI: fewer taps without weakening confirmation.",
  },
  {
    text: "Walk me through a portfolio project and how you measured its success. What would you do differently with hindsight?",
    company: "phonepe", roleFamily: "design", focus: "case-study",
    addedQuarter: "2026-Q3", difficulty: "standard", confidence: "inferred",
    styleNote: "PhonePe tests outcome-orientation and reflection: tying design work to metrics and showing honest hindsight.",
  },
];
