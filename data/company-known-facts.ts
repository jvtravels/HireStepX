/**
 * Company KNOWN_FACTS — exhaustive whitelist of verified facts for the
 * highest-traffic companies in our autocomplete.
 *
 * Why this file exists:
 *   The LLM, when asked to generate questions for "Razorpay", knows
 *   *something* about Razorpay from its training data — but training
 *   data is stale, mixed-quality, and prone to plausible-sounding
 *   confabulation ("Razorpay processes 10 trillion txn/day"). We
 *   solved part of this with COMPANY_GUIDANCE (style/tone) — but the
 *   LLM still has free rein to invent SCALE NUMBERS, PRODUCTS,
 *   COMPETITORS, and FOUNDER NAMES.
 *
 *   This file pins the verified facts. The LLM is instructed (in
 *   generate-questions.ts grounding rules):
 *     • Use ONLY the facts in the company-known-facts block.
 *     • If a candidate asks about a fact not listed, refuse rather
 *       than invent.
 *     • The whitelist is finite; "we don't have data on X" is the
 *       correct response when X isn't here.
 *
 * Refresh cadence: quarterly. Tag each entry with `lastVerified` so
 * stale ones surface. Sources: official company sites, recent funding
 * announcements, public DRHP filings, Levels.fyi, AmbitionBox.
 */

export interface KnownFacts {
  /** What the company actually does, in 1 sentence. */
  description: string;
  /** Currently-shipping products. Past products / dead products
   *  excluded — LLM should not "remember" Slack post-Stewart-era. */
  products?: string[];
  /** Real competitors as of lastVerified date. The LLM uses these to
   *  frame "how would your strategy differ from <competitor>" probes. */
  competitors?: string[];
  /** Approximate scale claims that are public + verifiable (DRHPs,
   *  press releases, official tech blogs). Use bands, not exact
   *  numbers, so candidates with newer data don't catch us out.
   *  The LLM is told these are floors, not ceilings. */
  scale?: string;
  /** Tech-stack signals when public ("known to use Kafka heavily",
   *  "Java + Kotlin Android shop"). Helps SWE/system-design rounds
   *  match the candidate's likely day-to-day. */
  techHints?: string;
  /** Cultural / interview signals not captured in COMPANY_GUIDANCE
   *  but worth flagging. */
  notes?: string;
  /** Phase-6.6: short, structured theme tags the LLM should bias the
   *  question set toward. Lives alongside the prose `notes` field
   *  because the LLM treats explicit "BIAS QUESTIONS TOWARD: …"
   *  directives more reliably than implied cues buried in narrative.
   *  Example for Meesho: ["India scale", "Tier 2/3 buyers",
   *  "mobile-first", "low-bandwidth UX", "social-commerce behaviour",
   *  "seller ↔ customer trust", "growth & retention"]. Keep entries
   *  short (≤6 words) and concrete — these render verbatim as a
   *  comma-joined directive in the question-generation prompt. */
  themes?: string[];
  /** ISO date (YYYY-MM-DD). Older than 12 months → re-verify before
   *  next refresh. */
  lastVerified: string;
}

export const COMPANY_KNOWN_FACTS: Record<string, KnownFacts> = {
  // ─── Indian unicorns / fintech ──────────────────────────────────
  razorpay: {
    description: "Indian fintech offering payment gateway, payouts, business banking (RazorpayX), and POS rails for merchants.",
    products: ["Payment Gateway", "Payouts", "RazorpayX (banking)", "Magic Checkout", "Razorpay POS"],
    competitors: ["PhonePe (PhonePe for Business)", "Paytm", "Cashfree", "Pine Labs", "Juspay"],
    scale: "Millions of merchants; serves Indian SMBs to large enterprises. Filed DRHP via SEBI confidential route in April 2026.",
    techHints: "Java + Go services, Kafka for event pipelines, Postgres + DynamoDB-style stores, AWS-heavy. Strong emphasis on idempotency and reconciliation.",
    notes: "Bar is engineering rigor over product polish. Compliance + correctness > speed. Candidates expected to discuss idempotency keys, retry semantics, and money-movement edge cases.",
    themes: [
      "idempotency & retry semantics",
      "money-movement edge cases",
      "PG / payouts / banking rails",
      "SMB merchant economics",
      "reconciliation & ledgers",
      "compliance + correctness > speed",
      "fraud / chargeback handling",
    ],
    lastVerified: "2026-05-19",
  },
  phonepe: {
    description: "India's largest UPI app by volume; also offers insurance, mutual funds, gold, and merchant payments.",
    products: ["PhonePe (UPI app)", "PhonePe for Business", "PhonePe Insurance", "Pincode (e-commerce)"],
    competitors: ["Google Pay", "Paytm", "Amazon Pay", "MobiKwik"],
    scale: "Largest UPI app in India by transaction volume. Filed DRHP via SEBI confidential route. Reverse-flipped to India in 2022.",
    techHints: "JVM-heavy (Java/Scala), heavy Kafka usage, runs own datacenter infra. Distributed-systems depth expected.",
    notes: "Engineering rounds prioritize reliability and partner-bank-failure handling. Generic 'design Twitter' answers fall flat — bring UPI-specific constraints.",
    themes: [
      "UPI rails & NPCI constraints",
      "partner-bank failure handling",
      "idempotency & reconciliation",
      "merchant onboarding",
      "fraud & risk",
      "India scale (txn/sec)",
      "regulatory compliance (RBI)",
    ],
    lastVerified: "2026-05-19",
  },
  paytm: {
    description: "Listed Indian fintech offering UPI, payments, lending (consumer + merchant), and a payments bank.",
    products: ["Paytm wallet", "Paytm Payments Bank (regulatory restrictions ongoing)", "Paytm Money", "Paytm for Business", "Paytm Postpaid"],
    competitors: ["PhonePe", "Google Pay", "BharatPe", "Razorpay (B2B)"],
    scale: "Public company (NSE: PAYTM). Listed November 2021.",
    notes: "Hiring rounds may probe multi-product context-switching. Don't reference internal structure or exec team — turbulent recently.",
    lastVerified: "2026-05-07",
  },
  flipkart: {
    description: "Indian e-commerce major (Walmart-owned since 2018); horizontal marketplace + private brands + grocery + fashion via Myntra.",
    products: ["Flipkart marketplace", "Myntra (fashion)", "Flipkart Grocery", "Cleartrip (travel)", "Shopsy (reseller)"],
    competitors: ["Amazon India", "Meesho", "Reliance Retail (JioMart)", "Tata Neu"],
    scale: "Hundreds of millions of registered users. India's largest e-commerce marketplace by GMV. Walmart-owned, IPO discussions ongoing.",
    techHints: "Polyglot — Java for core services, Go for newer infra, heavy use of Kafka, internal-built data platforms. Mobile-first (Android-heavy user base).",
    notes: "Engineering rounds emphasize India-scale problems: pincode coverage, monsoon logistics, low-bandwidth UX. PMs probed on Tier 2/3 city economics.",
    themes: [
      "India scale",
      "Tier 2/3 city economics",
      "pincode / serviceability",
      "monsoon & last-mile logistics",
      "Android-first UX",
      "marketplace seller economics",
      "category P&L trade-offs",
    ],
    lastVerified: "2026-05-19",
  },
  swiggy: {
    description: "Listed Indian food-delivery + quick-commerce (Instamart) platform, also operates dine-out (Dineout) and B2B grocery.",
    products: ["Swiggy Food", "Swiggy Instamart (10-min grocery)", "Swiggy Dineout", "Swiggy Genie (errands)"],
    competitors: ["Zomato", "Zepto", "Blinkit (Zomato-owned)", "BigBasket"],
    scale: "Listed on NSE/BSE 2024. Operates across 500+ Indian cities.",
    notes: "Operational rigor over product polish. PM rounds dive into delivery time, partner economics, dark-store unit economics. Comfortable with messy ground-truth data.",
    themes: [
      "delivery-time SLAs",
      "partner / DE economics",
      "dark-store unit economics",
      "10-min commerce constraints",
      "India scale across 500+ cities",
      "monsoon / surge handling",
      "marketplace supply-demand balance",
    ],
    lastVerified: "2026-05-19",
  },
  zomato: {
    description: "Listed Indian food-tech (food delivery + dining out + Hyperpure B2B + Blinkit quick commerce).",
    products: ["Zomato food delivery", "Hyperpure (B2B supply)", "Blinkit (quick commerce)", "Zomato Pro / Gold"],
    competitors: ["Swiggy", "Zepto", "Eternal/Tata Restaurants", "BigBasket"],
    scale: "Public company. Operates in India + select international markets.",
    notes: "Direct, unfiltered culture. PM/eng rounds reward defending controversial calls with numbers. Fluffy answers get pushback.",
    themes: [
      "food-tech unit economics",
      "quick-commerce (Blinkit) dynamics",
      "restaurant / supply side",
      "advertising on marketplace",
      "India scale",
      "defending calls with numbers",
    ],
    lastVerified: "2026-05-19",
  },
  cred: {
    description: "Premium Indian fintech for credit-card payments + reward platform; expanded into payments, lending, and rent payments.",
    products: ["CRED Pay", "CRED Mint (P2P lending)", "CRED Cash", "CRED RentPay", "CRED Garage (auto)"],
    competitors: ["Paytm Postpaid", "BharatPe Postpe", "OneCard", "MobiKwik"],
    scale: "Targets India's affluent credit-card-paying segment. Funded; not yet public.",
    notes: "Design + craft bar is exceptionally high. Engineering rounds mid-bar; design rounds extreme-bar. Pushback culture — defending taste with reasoning is expected.",
    lastVerified: "2026-05-07",
  },
  zerodha: {
    description: "India's largest stockbroker by active clients; bootstrapped, profitable, anti-VC posture.",
    products: ["Kite (trading platform)", "Coin (mutual funds)", "Console (back-office)", "Varsity (education)"],
    competitors: ["Groww", "Upstox", "Angel One", "ICICIDirect"],
    scale: "Largest active broker in India by client count.",
    techHints: "In-house everything — own programming languages, own infra, no managed cloud abstractions for core. Single-binary thinking, careful invalidation.",
    notes: "First-principles engineering culture. 'I'd use Redis' / 'I'd use Kafka' answers fail — interviewer will constrain stack and want fundamentals.",
    lastVerified: "2026-05-07",
  },
  meesho: {
    description: "Listed (December 2025) Indian social-commerce + reseller-driven marketplace targeting Tier 2/3 buyers.",
    products: ["Meesho marketplace (B2C)", "Meesho Supply (sellers)"],
    competitors: ["Flipkart Shopsy", "Amazon India", "Glowroad (now Glance)", "DealShare"],
    scale: "Listed on NSE/BSE December 2025. Largest social-commerce platform in India by orders.",
    notes: "PM rounds test Bharat-female-reseller persona empathy specifically. Vernacular UX, low-bandwidth, WhatsApp-native answers expected. Urban-ICP fluency alone fails.",
    themes: [
      "India scale",
      "Tier 2/3 buyers",
      "mobile-first UX",
      "low-bandwidth performance",
      "social-commerce behaviour",
      "seller ↔ customer trust",
      "reseller ecosystem",
      "growth & retention loops",
      "vernacular / WhatsApp-native flows",
    ],
    lastVerified: "2026-05-19",
  },

  // ─── FAANG / Big Tech ───────────────────────────────────────────
  google: {
    description: "Alphabet's flagship — search, advertising, Android, Cloud, YouTube, AI infrastructure.",
    products: ["Search", "Ads", "Android", "Google Cloud Platform", "YouTube", "Workspace", "Pixel"],
    competitors: ["Microsoft", "Amazon (cloud, ads)", "Meta (ads)", "Apple (mobile)", "OpenAI/Anthropic (AI)"],
    notes: "Bangalore + Hyderabad GCCs. L4-L6 in India common. Levels matter (L4 vs L5 = 30-50% delta). System design at L5+. 'Googleyness' rubric: humility, collaboration, action.",
    lastVerified: "2026-05-07",
  },
  amazon: {
    description: "Largest e-commerce + AWS cloud + Alexa + Prime Video + Ring.",
    products: ["Amazon.com / Amazon India", "AWS", "Alexa / Echo", "Prime Video", "Kindle"],
    competitors: ["Microsoft Azure / GCP (cloud)", "Walmart / Flipkart (commerce)", "Netflix (video)"],
    notes: "16 Leadership Principles drive every behavioral. Bar-raisers in every loop. STAR format mandatory. Specific failures > polished successes.",
    lastVerified: "2026-05-07",
  },
  microsoft: {
    description: "Cloud (Azure) + productivity (Microsoft 365 / Copilot) + Windows + GitHub + LinkedIn + gaming (Xbox / Activision).",
    products: ["Azure", "Microsoft 365", "GitHub", "LinkedIn", "Copilot", "Windows", "Xbox / Game Pass"],
    competitors: ["AWS / GCP", "Google Workspace", "Slack (Salesforce)", "Atlassian"],
    notes: "Growth-mindset culture central. PM rounds: 'decision you got wrong' is a signature question. India: Hyderabad GCC dominant, Bengaluru / Noida secondary.",
    lastVerified: "2026-05-07",
  },
  stripe: {
    description: "Stripe India (Bengaluru) is a full-product engineering centre for global payments infrastructure, working on the core payments API, fraud/risk systems, and developer tooling.",
    products: ["Stripe Payments API", "Stripe Radar (fraud ML)", "Stripe Connect (marketplaces)", "Stripe Billing / Subscriptions", "Stripe Atlas (incorporation)", "Stripe Issuing"],
    competitors: ["Adyen", "PayPal / Braintree", "Square / Block", "Razorpay (India)", "Amazon Pay"],
    scale: "~8,000 employees globally, ~600+ in Bengaluru. Revenue ~$15B+ estimated. Privately held (Series I/J). Last valuation $65B.",
    techHints: "Ruby (primary backend). Java and Go for high-throughput services. React / TypeScript frontend. PostgreSQL + Kafka. Extremely high code-review bar — PRs reviewed for long-term maintainability.",
    notes: "Bug-bash round is signature: ~200-line code review with 5-7 intentional bugs. Writing-clarity bar is unusually high — formal writing assessment included. Senior roles tested on distributed systems (payments reliability, idempotency, at-least-once delivery).",
    themes: [
      "payment reliability and idempotency",
      "fraud detection and ML risk models",
      "developer API design principles",
      "distributed systems at payments scale",
      "Ruby and Go microservices",
      "financial infrastructure correctness",
    ],
    lastVerified: "2026-07-21",
  },

  // ─── Indian IT services ─────────────────────────────────────────
  tcs: {
    description: "India's largest IT services + consulting firm; part of Tata Group; deep enterprise systems integration practice.",
    competitors: ["Infosys", "Wipro", "HCLTech", "Cognizant", "Accenture"],
    notes: "NQT (National Qualifier Test) is the entry hurdle. Process-orientation valued. Frequent client-facing role. Notice period 60-90 days standard. No equity for ICs.",
    lastVerified: "2026-05-07",
  },
  infosys: {
    description: "Indian IT services + digital transformation; second-largest by revenue.",
    competitors: ["TCS", "Wipro", "HCLTech", "Cognizant", "Accenture"],
    notes: "InfyTQ entry pattern. Java/Python heavy. Design-thinking + digital-transformation framing. Notice 60-90 days.",
    lastVerified: "2026-05-07",
  },

  // ─── Consulting MBB ─────────────────────────────────────────────
  mckinsey: {
    description: "Top-tier strategy consulting firm; partner-led model; global footprint.",
    competitors: ["BCG", "Bain"],
    notes: "Interviewer-led case style. Top-down (answer first, evidence after). PEI (Personal Experience Interview) — Leadership / Personal Impact / Entrepreneurial Drive. Pyramid Principle communication.",
    lastVerified: "2026-05-07",
  },
  bcg: {
    description: "Top-tier strategy consulting; emphasis on creativity within structure; collaborative interviewing.",
    competitors: ["McKinsey", "Bain"],
    notes: "Candidate-led case style. Distinct: BCG Written Case (no other MBB firm uses). Brainstorming creativity valued — diverse ideas > MECE rigor.",
    lastVerified: "2026-05-07",
  },
  bain: {
    description: "Top-tier strategy consulting; collaborative + results-oriented culture; PE-due-diligence specialty.",
    competitors: ["McKinsey", "BCG"],
    notes: "Conversational case style; interviewer actively coaches mid-case. Bainie culture: warm, collaborative, results-driven. PE-DD cases common.",
    lastVerified: "2026-05-07",
  },

  // ─── Banking / Quant ────────────────────────────────────────────
  goldman: {
    description: "Top-tier global investment bank; large engineering org; Bengaluru is one of the largest engineering centers globally.",
    competitors: ["Morgan Stanley", "JP Morgan", "Citi", "BarCap (Barclays)"],
    notes: "14 Business Principles cultural-fit framework. Multiple-round process; consistency across rounds matters. Engineering rounds = technical depth + market context awareness even for non-trading roles.",
    lastVerified: "2026-05-07",
  },
  jpmc: {
    description: "JPMorgan Chase India — one of the largest banking technology centers globally; Bengaluru and Hyderabad offices run core banking, risk, and payments infrastructure.",
    competitors: ["Goldman Sachs", "Morgan Stanley", "Citi", "Deutsche Bank", "HSBC"],
    notes: "Strong emphasis on regulatory awareness (RBI/SEBI) in interviews. System design questions grounded in financial compliance — every design must include audit trail and idempotency. AUDIT + SCALE framework recommended. No RSU at India offices — compensation is base + annual bonus.",
    lastVerified: "2026-05-08",
  },
  "jane-street": {
    description: "Quantitative trading firm; market-maker across global equities, ETFs, options, crypto, and bonds.",
    competitors: ["Citadel Securities", "Optiver", "IMC", "Hudson River Trading", "Tower Research"],
    notes: "First-round = mental math + classic probability puzzles + light market-making intuition. Looks for: curiosity, hyper-rationality, collaborative (not competitive) personality.",
    lastVerified: "2026-05-07",
  },

  // ─── Big Tech — India offices ───────────────────────────────────
  meta: {
    description: "Meta's Bengaluru office works on ads infrastructure, WhatsApp, Instagram, and Reality Labs (VR/AR). Known for a bar-raiser process comparable to Amazon's, with a strong bias toward candidates who can solve at scale.",
    products: ["Facebook / Meta social", "WhatsApp", "Instagram", "Threads", "Meta Ads Platform", "Quest / Reality Labs"],
    competitors: ["Google (ads, Android)", "TikTok / ByteDance", "Snap", "Apple (AR/VR, iMessage)", "Twitter / X"],
    scale: "Billions of monthly active users across family of apps. Largest social advertising network globally.",
    techHints: "C++/Hack/Python backend. React / React Native frontend. Heavy use of internal frameworks (Thrift, Scribe). Custom AI infra (PyTorch originated here).",
    notes: "Hard LeetCode + meta-specific coding patterns expected. System design must address billions-of-users scale. Behavioral anchors: Leadership Principles-style but called 'Meta values'. Bar-raiser sits in every loop. Meta levels E3–E7; E5+ gets meaningful equity. Tip: push for E5 if you have 3+ YOE — the level band jump is larger than a within-band increment.",
    themes: [
      "news feed ranking algorithms",
      "ads auction & relevance",
      "distributed social graph",
      "WhatsApp reliability at scale",
      "VR/AR infrastructure",
      "hard LeetCode patterns",
      "systems at billions-of-users scale",
    ],
    lastVerified: "2026-07-21",
  },
  uber: {
    description: "Uber India (Bengaluru) builds core platform engineering — the real-time matching engine, driver and rider experience, payments, and maps. Engineering culture is heavily influenced by ex-FAANG hires and prioritizes correctness, latency, and reliability.",
    products: ["Uber rideshare (India)", "Uber Eats / Eats (select markets)", "Uber for Business", "Uber Freight"],
    competitors: ["Ola", "Rapido", "BluSmart", "Namma Yatri"],
    scale: "Operates in 100+ Indian cities. Millions of trips daily.",
    techHints: "Go and Java services. Kafka for event streaming. MySQL + Cassandra for storage. Geospatial queries via H3 hexagonal grid.",
    notes: "Coding rounds are medium-hard, graph and tree heavy. System design focuses on real-time geospatial systems and high-throughput matching. Behavioral anchors around Uber's cultural norms (act like an owner, be curious). Tip: prepare distributed stream processing and geo-indexing patterns — surge pricing, ETA estimation, and driver-rider matching are signature design questions.",
    themes: [
      "surge pricing algorithms",
      "real-time driver-rider matching",
      "ETA estimation & geofencing",
      "payment reconciliation",
      "geospatial indexing (H3)",
      "high-throughput event streaming",
      "marketplace supply-demand balance",
    ],
    lastVerified: "2026-07-21",
  },
  oracle: {
    description: "Oracle India employs 50,000+ across Bengaluru and Hyderabad. Teams build Oracle Cloud Infrastructure (OCI), Fusion ERP, and the Oracle database kernel. Hiring is structured and places a strong emphasis on CS fundamentals over recent framework fluency.",
    products: ["Oracle Database", "Oracle Cloud Infrastructure (OCI)", "Oracle Fusion ERP / HCM", "MySQL", "Java (JDK)"],
    competitors: ["AWS", "Microsoft Azure", "SAP", "Salesforce", "Google Cloud"],
    scale: "One of the largest enterprise software companies globally. OCI competes directly with AWS and Azure.",
    techHints: "Java-heavy. C/C++ for database kernel. PL/SQL and SQL optimization central to many roles. Strong emphasis on ACID transactions, locking, and distributed consistency.",
    notes: "DSA-heavy interviews with a strong algorithms emphasis. Database fundamentals (joins, indexes, ACID, MVCC) tested even for SWE roles. OOP design and system design at senior levels. Tip: review data structures, OS concepts, and DBMS theory — fundamentals are weighted above cloud/framework knowledge.",
    themes: [
      "SQL optimization & query planning",
      "distributed transactions & ACID",
      "cloud-native architectures (OCI)",
      "enterprise security & IAM",
      "multi-tenancy patterns",
      "Java & OOP design",
      "CS fundamentals depth",
    ],
    lastVerified: "2026-07-21",
  },
  adobe: {
    description: "Adobe India's Noida campus is one of its largest globally, with teams working on Photoshop, Premiere Pro, Experience Cloud, and Acrobat. Engineering culture values craft and design thinking, and even SWE interviews assess code elegance.",
    products: ["Photoshop / Illustrator / InDesign (Creative Cloud)", "Adobe Premiere Pro / After Effects", "Adobe Acrobat / PDF", "Adobe Experience Cloud (AEM, Analytics, Target)", "Adobe Express"],
    competitors: ["Canva", "Figma (acquired by Adobe, later blocked)", "Microsoft (Office/Copilot)", "Salesforce Marketing Cloud", "Autodesk"],
    scale: "Hundreds of millions of Creative Cloud subscribers globally. One of the largest SaaS businesses by ARR.",
    techHints: "Java and C++ for core creative tools. React / Node for cloud products. Microservices on AWS. Media processing pipelines central.",
    notes: "Coding rounds at medium difficulty but emphasize clean, extensible code over raw speed. OOP design questions are common. Product sense probed via design thinking. Behavioral anchors around Adobe's values (genuine, exceptional, innovative, involved). Tip: bring examples of systems you designed from scratch — Adobe values engineers who can design clean APIs and scalable OOP hierarchies.",
    themes: [
      "media processing pipelines",
      "document parsing & PDF standards",
      "cloud storage & versioning",
      "subscription billing systems",
      "real-time collaboration (cloud docs)",
      "OOP system design",
      "creative-tool performance tuning",
    ],
    lastVerified: "2026-07-21",
  },
  atlassian: {
    description: "Atlassian India (Bengaluru) builds Jira, Confluence, Bitbucket, and Trello. Known for an open, values-driven culture summarized as TEAM Anywhere — Teamwork, Execution, Agile, Meritocracy — and a distributed-first work model.",
    products: ["Jira (project tracking)", "Confluence (docs / wiki)", "Bitbucket (Git hosting)", "Trello (kanban)", "Jira Service Management (ITSM)"],
    competitors: ["GitHub / GitLab", "Notion", "Monday.com", "ServiceNow", "Linear"],
    scale: "Hundreds of thousands of customers globally. Multi-billion-dollar SaaS company listed on NASDAQ.",
    techHints: "Java and Kotlin backend. React frontend. Atlassian ecosystem APIs (Forge, Connect). PostgreSQL and heavy search via Elasticsearch.",
    notes: "Coding difficulty is medium. Take-home project assessment is common for senior roles. Behavioral interview is weighted heavily — prepare 3 specific stories mapped to Atlassian values: Open Company No Bullshit, Play as a Team, and Don't #@!% the Customer. System design covers SaaS multi-tenancy, search indexing, and ACL models.",
    themes: [
      "workflow automation",
      "search and full-text indexing",
      "permission & ACL models",
      "real-time collaboration",
      "SaaS multi-tenancy",
      "DevOps toolchain integration",
      "TEAM values behavioral anchors",
    ],
    lastVerified: "2026-07-21",
  },

  // ─── Indian fintech / growth-stage ─────────────────────────────
  groww: {
    description: "Groww is India's largest mutual fund distributor and a top retail stockbroker with 50M+ registered users. The Bengaluru engineering team of ~500 builds trading systems, portfolio analytics, and financial product infrastructure. Pre-IPO as of mid-2026.",
    products: ["Groww stocks & equity (NSE/BSE)", "Groww Mutual Funds", "Groww IPO", "Groww Digital Gold", "Groww Fixed Deposits"],
    competitors: ["Zerodha (Kite)", "Upstox", "Angel One", "Paytm Money", "INDmoney"],
    scale: "50M+ registered users. One of the fastest-growing retail brokers in India. Valued at ~$3B+ in last funding round.",
    techHints: "Java and Go backend. Kafka for order event streaming. PostgreSQL + Redis. Tight SEBI latency and audit-log compliance constraints.",
    notes: "Coding rounds are medium-hard. System design focuses on high-throughput fintech: order management, real-time P&L, settlement reconciliation. SEBI compliance and audit trails must feature in any trading system design. Tip: Groww's pre-IPO ESOP is the real compensation lever — ask HR about the last secondary transaction FMV and vesting acceleration clause.",
    themes: [
      "order management systems",
      "settlement & reconciliation",
      "SEBI compliance & audit logs",
      "real-time portfolio P&L",
      "stock feed & market data processing",
      "high-throughput fintech infra",
      "retail investor UX",
    ],
    lastVerified: "2026-07-21",
  },
  intuit: {
    description: "Intuit India (Bengaluru) is the largest engineering hub outside the US, building Quickbooks, TurboTax, and Credit Karma. Known for a strong engineering culture, generous learning budget, and a high bar for customer empathy across all roles.",
    products: ["QuickBooks (SMB accounting)", "TurboTax (tax filing)", "Credit Karma (credit / personal finance)", "Mailchimp (marketing)", "ProConnect (tax professional)"],
    competitors: ["Zoho Books", "Freshbooks", "H&R Block (tax)", "Sage", "Xero"],
    scale: "Over 100M customers globally. One of the largest financial software companies by revenue.",
    techHints: "Java and Kotlin backend. React frontend. AWS-heavy. Strong data and ML platform for personalization and tax computation.",
    notes: "Coding difficulty is medium. Behavioral interviews heavily emphasize customer outcomes — frame every story around customer impact, not internal technical metrics. System design covers tax computation rules, financial data aggregation, and ML-powered recommendations. OOP design questions appear at senior levels.",
    themes: [
      "tax computation rules engines",
      "financial data aggregation",
      "small business workflows",
      "ML-powered financial recommendations",
      "global localization & compliance",
      "customer-outcome framing",
      "SMB product empathy",
    ],
    lastVerified: "2026-07-21",
  },

  // ─── Retail tech / enterprise ───────────────────────────────────
  "walmart-global-tech": {
    description: "Walmart Global Tech Bengaluru (WGTB) is one of Walmart's largest tech hubs, working on supply chain systems, the walmart.com ecommerce platform, Sam's Club, Flipkart integration, and omnichannel checkout. Compensation includes WMT RSU — listed NYSE equity.",
    products: ["walmart.com ecommerce platform", "Sam's Club tech", "Walmart Supply Chain systems", "Walmart Pay / Grocery", "Flipkart integration (shared platforms)"],
    competitors: ["Amazon", "Target", "Costco", "Flipkart (sibling, but separate)"],
    scale: "Walmart is the world's largest retailer by revenue. WGTB has thousands of engineers supporting global retail tech.",
    techHints: "Java and Node.js services. Kafka and Spark for data pipelines. Azure-heavy (Microsoft partnership). GraphQL federation for ecommerce APIs.",
    notes: "Coding rounds are medium difficulty. System design focuses on distributed systems at retail scale — inventory consistency, eventual consistency, and order orchestration. Take-home assessments common at senior levels. Behavioral rounds align to Walmart culture (servant leadership, customer focus). Tip: prepare inventory consistency and eventual consistency patterns — they underpin every retail platform design question.",
    themes: [
      "inventory management & consistency",
      "order orchestration",
      "demand forecasting",
      "marketplace seller integration",
      "grocery & last-mile delivery",
      "omnichannel checkout",
      "distributed systems at retail scale",
    ],
    lastVerified: "2026-07-21",
  },
  persistent: {
    description: "Persistent Systems is a mid-tier IT services company listed on NSE/BSE, with deep domain in healthcare technology, banking and financial services (BFS), and enterprise digital transformation. Salary benchmarks are above average for pure IT services peers.",
    products: ["Healthcare IT (FHIR / HL7 integration)", "BFS digital platforms", "Cloud migration services", "API modernization", "Enterprise AI / GenAI services"],
    competitors: ["Mphasis", "Hexaware", "NIIT Technologies", "LTIMindtree", "Cognizant"],
    scale: "~23,000+ employees globally. Listed on NSE/BSE. Revenue ~$1B+.",
    techHints: "Java and Python dominant. Healthcare: HL7 v2, FHIR R4, Epic/Cerner integrations. BFS: core banking APIs, ISO 20022. Cloud: AWS and Azure certified delivery teams.",
    notes: "Technical rounds are easy-medium difficulty. Domain knowledge is weighted heavily alongside coding — candidates targeting healthcare or BFS verticals should brush up on HL7/FHIR (healthcare) or core banking protocols (BFS). Communication and client-facing skills assessed. Basic system design at senior levels.",
    themes: [
      "healthcare data interoperability (HL7/FHIR)",
      "core banking integration",
      "API modernization",
      "cloud migration patterns",
      "BFS domain depth",
      "client communication",
      "enterprise digital transformation",
    ],
    lastVerified: "2026-07-21",
  },
  salesforce: {
    description: "Salesforce is the world's largest CRM platform, providing cloud-based sales, service, marketing, and analytics software. India offices in Hyderabad and Bengaluru are full-product engineering centres.",
    products: ["Sales Cloud", "Service Cloud", "Marketing Cloud", "Slack (acquired 2021)", "Tableau (acquired 2019)", "MuleSoft", "Einstein AI / AgentForce"],
    competitors: ["SAP", "Microsoft Dynamics", "HubSpot", "ServiceNow", "Zoho CRM"],
    scale: "~70,000 employees globally. Revenue ~$35B. NYSE: CRM. Hyderabad campus ~3,000+ engineers.",
    techHints: "Java and Apex (proprietary) backend. JavaScript / LWC (Lightning Web Components) for UI. Distributed systems, multi-tenant architecture. Einstein AI on Python. MuleSoft uses Java / Mule runtime.",
    notes: "Rounds include LeetCode-style DS&A plus Salesforce-ecosystem design (multi-tenancy, governor limits, Apex best practices). Senior roles tested on distributed systems. Values-based 'Ohana' culture discussed in HR rounds. Look for 'Trailhead' ecosystem knowledge at senior level.",
    themes: [
      "multi-tenant SaaS architecture",
      "CRM and customer data platforms",
      "Lightning Web Components",
      "Apex and platform governor limits",
      "AI-powered CRM (Einstein / AgentForce)",
      "enterprise integration (MuleSoft)",
      "distributed cloud systems",
    ],
    lastVerified: "2026-07-21",
  },
  oyo: {
    description: "OYO (Oravel Stays) is India's largest budget hotel aggregator and tech-enabled hospitality company, with presence in India, SE Asia, Europe, and the US through the SoftBank-backed OYO network.",
    products: ["OYO Rooms (budget hotel aggregation)", "OYO Townhouse", "OYO Life (long-stay)", "Biz hotels", "Yo! Help (guest support AI)", "OYO OS (property management system)"],
    competitors: ["MakeMyTrip / Goibibo", "Airbnb", "Treebo", "FabHotels", "Zostel"],
    scale: "~4,000 employees after multiple rounds of layoffs (2022–2024). IPO attempted; DRHP filed. Listed on unlisted market.",
    techHints: "Python and Go microservices. React frontend. PostgreSQL + Redis + Kafka. Hotel supply-side systems (OYO OS) and demand-side booking stack both maintained internally.",
    notes: "Compensation is below FAANG/startup unicorn levels. Stock value uncertain (unlisted). Interview process includes DSA rounds plus product and supply/demand system design (hotel inventory, dynamic pricing). Work culture was fast-moving; stability improved post-restructure.",
    themes: [
      "hotel inventory systems and dynamic pricing",
      "supply-demand matching at scale",
      "hospitality tech and property management",
      "international expansion and localisation",
      "cost optimisation at scale",
      "microservices for aggregation platforms",
    ],
    lastVerified: "2026-07-21",
  },
  nykaa: {
    description: "Nykaa (FSN E-Commerce Ventures) is India's leading omnichannel beauty and fashion retailer, listed on NSE/BSE. It operates Nykaa.com, NykaaFashion, and 200+ physical stores.",
    products: ["Nykaa.com (beauty ecommerce)", "NykaaFashion", "Nykaa Man", "Nykaa D2C private-label brands (Kay Beauty, Dot & Key)", "Nykaa Pro (professional supply)"],
    competitors: ["Amazon Beauty", "Myntra (Flipkart group)", "Purplle", "Reliance Beauty", "SUGAR Cosmetics (D2C)"],
    scale: "~4,000 employees. NSE/BSE listed (NYKAA). Revenue ~₹6,500 Cr FY24. 200+ physical stores.",
    techHints: "Python (Django) and Node.js backend. React frontend. AWS-native. Search and recommendation systems are strategic — ElasticSearch and ML-based personalisation. Data and analytics team large relative to headcount.",
    notes: "Pay is below top-tier startups. ESOP value depends on NYKAA stock (has been volatile post-IPO). Interview focuses on ecommerce fundamentals: catalog management, search, inventory, recommendations, checkout flow. Beauty domain knowledge is a plus for PM and data roles.",
    themes: [
      "ecommerce catalog and search",
      "beauty and fashion personalisation",
      "D2C brand strategy",
      "omnichannel retail (online + offline)",
      "product recommendations at scale",
      "supply chain and inventory for fashion",
    ],
    lastVerified: "2026-07-21",
  },
  myntra: {
    description: "Myntra is India's leading online fashion and lifestyle platform, a wholly-owned subsidiary of Flipkart (Walmart group). It is the #1 fashion destination in India by GMV.",
    products: ["Myntra app (fashion marketplace)", "M-Live (live commerce)", "FWD (Gen-Z fashion vertical)", "Myntra Studio (creator content)", "Supply chain and fulfilment for fashion"],
    competitors: ["Amazon Fashion", "Nykaa Fashion", "Reliance Ajio", "Meesho Fashion"],
    scale: "~6,000 employees. Subsidiary of Flipkart; WMT RSU via Flipkart group. Revenue ~$1.5B+ GMV.",
    techHints: "Java and Go for backend services. React and Flutter for frontend. ElasticSearch for fashion search. Computer vision for visual search and try-on. Kafka + Flink for real-time inventory events.",
    notes: "ESOP is Flipkart ESOP — liquidity tied to Walmart/Flipkart exit. Fashion tech includes visual search, size recommendation, trend forecasting (ML-heavy). Interview process includes LeetCode-style DS&A plus fashion-specific system design (catalog, search, logistics).",
    themes: [
      "fashion search and visual discovery",
      "size and style recommendation (ML)",
      "supply chain for fast fashion",
      "live commerce and creator monetisation",
      "ecommerce at India scale",
      "inventory and logistics optimisation",
    ],
    lastVerified: "2026-07-21",
  },
  dream11: {
    description: "Dream11 (Dream Sports) is India's largest fantasy sports platform with 200M+ users, offering fantasy cricket, football, kabaddi, and basketball. It is a bootstrapped unicorn with no external debt.",
    products: ["Dream11 (fantasy cricket/football/kabaddi)", "FanCode (sports commerce and streaming)", "DreamX (internal ventures arm)", "Dream Sports Foundation"],
    competitors: ["MPL (Mobile Premier League)", "MyTeam11", "Ballebaazi", "Vision11"],
    scale: "~1,500 employees. Bootstrapped — no listed equity. Revenue ~$1.5B+ FY24 (primarily from platform fee). Highest-valued bootstrapped startup in India.",
    techHints: "Go (primary backend). React Native (mobile). PostgreSQL + Redis for session and fantasy scoring. Real-time scoring engine processes millions of concurrent users during IPL. Kafka for event streaming. Caching is critical — read-heavy during live matches.",
    notes: "One of the few companies with no equity/ESOP (bootstrapped). Cash comp is competitive; bonuses are performance-driven. Technical interview focuses heavily on high-concurrency systems — real-time scoring, live leaderboards, flash traffic spikes during IPL. System design questions routinely involve millions of concurrent users.",
    themes: [
      "high-concurrency real-time scoring",
      "flash traffic spikes (IPL-scale)",
      "fantasy sports game mechanics",
      "leaderboard systems at scale",
      "caching strategies for read-heavy traffic",
      "Go-based microservices",
    ],
    lastVerified: "2026-07-21",
  },
  rapido: {
    description: "Rapido is India's largest bike taxi and auto-rickshaw platform, operating in 100+ Indian cities. It raised Series E funding in 2024 and is preparing for an IPO.",
    products: ["Rapido Bike Taxi", "Rapido Auto", "Rapido Cab (limited cities)", "Captain (driver) app", "Delivery logistics (Rapido B2B)"],
    competitors: ["Ola (bike and auto)", "Uber Moto", "InDrive", "Namma Yatri (Bengaluru)"],
    scale: "~1,500 employees. Pre-IPO (Series E, 2024). Operating in 100+ cities. ~5M+ rides per day at peak.",
    techHints: "Python and Node.js backend. React Native mobile. Real-time geospatial matching (rider-captain). Kafka for event streaming. Maps API heavily used. Surge pricing engine (dynamic demand/supply).",
    notes: "Pre-IPO ESOP — IPO timeline not announced. Pay is startup-competitive but below top unicorns. Interview process is lean: DSA rounds + system design for ride-matching and pricing. Domain knowledge of geo-spatial systems and real-time dispatch is valued.",
    themes: [
      "real-time geospatial ride matching",
      "surge pricing and demand forecasting",
      "two-wheeler logistics at scale",
      "driver (captain) onboarding and retention",
      "low-cost urban mobility",
      "pre-IPO growth and unit economics",
    ],
    lastVerified: "2026-07-21",
  },
  icici: {
    description: "ICICI Bank is India's second-largest private sector bank, offering retail and corporate banking, insurance, asset management, and securities. Its tech team (iWork) is one of the largest banking IT organisations in India.",
    products: ["iMobile Pay (retail banking app)", "InstaBIZ (SME banking)", "ICICI Bank credit cards", "ICICI Lombard (insurance)", "ICICI Prudential (life insurance / AMC)", "Corporate banking and trade finance systems"],
    competitors: ["HDFC Bank", "Axis Bank", "Kotak Mahindra Bank", "SBI (public sector)"],
    scale: "~120,000 employees (banking + subsidiaries). BSE/NSE listed. Assets ~₹25 trillion. iWork tech team ~5,000+.",
    techHints: "Java (Spring Boot) dominant. Oracle DB for core banking. React and Angular for web. Mobile: Flutter and React Native. Microservices on private cloud with some AWS workloads. Core banking system (Finacle by Infosys). Compliance with RBI regulations is non-negotiable in all system design.",
    notes: "IT Analyst role is a lateral entry / direct campus hire. Pay is significantly below fintech startups. No equity. Interview process: aptitude + coding (moderate difficulty, not LeetCode hard) + HR. For senior roles: system design with banking/RBI constraint emphasis. Domain knowledge of NEFT/RTGS/UPI, KYC, and AML compliance is a strong differentiator.",
    themes: [
      "core banking systems and NEFT/RTGS",
      "UPI and digital payment infrastructure",
      "KYC, AML, and RBI compliance",
      "retail banking mobile apps",
      "banking security and fraud detection",
      "BFSI domain depth",
    ],
    lastVerified: "2026-07-21",
  },
  anthropic: {
    description: "Anthropic is an AI safety company that builds Claude — the world's leading safety-focused large language model family. India hires are fully remote and SF-anchored.",
    products: ["Claude (3.5 Sonnet / 3.5 Haiku / Opus 4)", "Claude API (commercial)", "Constitutional AI (safety research)", "Claude.ai (consumer product)", "Anthropic Claude for Slack / Google Workspace"],
    competitors: ["OpenAI (ChatGPT / GPT-4o)", "Google DeepMind (Gemini)", "Meta AI (Llama)", "xAI (Grok)", "Mistral"],
    scale: "~3,000 employees globally. Revenue ~$3B+ ARR. Valuation ~$60B (2025). India headcount <30 — extremely selective. Investors: Google, Spark Capital, Amazon.",
    techHints: "Python (primary). JAX and PyTorch for training. Constitutional AI and RLHF are proprietary. Interpretability research team uses mechanistic analysis of transformer internals. All India hires are remote; overlap with SF timezone required.",
    notes: "Interview bar is research-grade — expect paper-quality discussions on alignment, RLHF, interpretability, or systems work. Technical rounds include ML systems, alignment reasoning, and safety/ethics judgment. Published research (NeurIPS, ICLR, ICML) significantly improves chances. Compensation is SF-anchored with Anthropic RSU (PPU vesting structure).",
    themes: [
      "AI safety and constitutional AI",
      "large language model training",
      "RLHF and alignment research",
      "interpretability and mechanistic analysis",
      "distributed training infrastructure",
      "responsible AI deployment",
    ],
    lastVerified: "2026-07-21",
  },
  "sarvam-ai": {
    description: "Sarvam AI (formerly Sarvam) is India's leading vernacular AI company, building Indic language models (BharatGPT), voice AI, and the Sarvam-2B open-source model. Powers government-scale AI deployments.",
    products: ["Sarvam-2B (open-source Indic LLM)", "Sarvam APIs (TTS, STT, translation for 11 Indian languages)", "BharatGPT (government AI initiative)", "Sarvam Speak (voice AI platform)"],
    competitors: ["AI4Bharat (IIT Madras research lab)", "Google (Indic support in Gemini)", "Microsoft (Azure OpenAI with Indic)", "Krutrim (Ola's AI lab)"],
    scale: "~200 employees. Pre-Series C. Backed by Lightspeed, Peak XV. Valuation ~$400M (2024). Deployed by Indian government at national scale.",
    techHints: "Python (primary). PyTorch for LLM training. Indic data pipelines and language-specific tokenization. TTS/STT with acoustic models for 11 Indian languages. Deployed at scale via Kubernetes on GCP. Real-time voice AI (<200ms latency target).",
    notes: "Sarvam is mission-driven — expects candidates motivated by India's AI/language problem, not just compensation. Interview rounds include ML systems + Indic NLP knowledge + research orientation. Strong preference for candidates with published work or open-source contributions. ESOP is pre-Series C but credibility has grown with government contracts.",
    themes: [
      "Indic language NLP and multilingual models",
      "TTS and STT for Indian languages",
      "open-source LLM development",
      "voice AI and conversational systems",
      "AI for Bharat (low-resource languages)",
      "government-scale AI deployment",
    ],
    lastVerified: "2026-07-21",
  },
  optiver: {
    description: "Optiver is an Amsterdam-headquartered market maker and HFT firm with a major quant research and technology centre in Bengaluru, India, focusing on derivatives pricing and electronic trading.",
    products: ["Proprietary market-making strategies (equity options, ETFs, bonds)", "Electronic trading systems", "Derivatives pricing models", "Risk management infrastructure"],
    competitors: ["Jane Street", "Citadel Securities", "IMC Trading", "Tower Research Capital", "Virtu Financial"],
    scale: "~2,000 employees globally, ~300 in Bengaluru. Privately held. Known for 6-figure EUR compensation. India office opened 2022 and growing rapidly.",
    techHints: "C++ for ultra-low latency trading. Python for research and backtesting. Linux systems programming. Options pricing (Black-Scholes, stochastic vol models). Electronic trading protocols (FIX). Real-time risk systems.",
    notes: "Pure cash comp — no equity. Interview is derivatives-specialist: heavy probability, options Greeks (delta/gamma/vega), brain teasers, and C++ systems. The 'Traders' test is notorious — mental maths + probability under time pressure. Research engineers need Python + stochastic calculus. Optiver Bengaluru hires from IITs and CMI/ISI.",
    themes: [
      "derivatives pricing and options Greeks",
      "market-making strategy and risk",
      "low-latency C++ trading systems",
      "stochastic volatility models",
      "probability and mental maths",
      "electronic trading protocols (FIX)",
    ],
    lastVerified: "2026-07-21",
  },
  millennium: {
    description: "Millennium Management is a global multi-strategy hedge fund with a quant research and technology office in Bengaluru, India. It manages ~$70B AUM across 300+ independent trading pods.",
    products: ["Proprietary multi-strategy quant trading (equities, fixed income, commodities, macro)", "Risk management and portfolio analytics", "Quantitative research infrastructure"],
    competitors: ["DE Shaw", "Citadel", "Two Sigma", "Point72", "Renaissance Technologies"],
    scale: "~5,000 employees globally, ~400 in Bengaluru. AUM ~$70B+. Revenue private. Bengaluru office is a senior quant research and engineering hub.",
    techHints: "Python and C++ (primary). R for research. Spark for large-scale data. PostgreSQL + Hadoop. Proprietary risk and portfolio management systems. Each pod runs semi-independently — tech stack varies by pod.",
    notes: "Pure cash + heavy performance bonus — no equity. India Bengaluru office works on quant research + risk infrastructure, not just support. Interview includes probability, statistics, and algo problems similar to DE Shaw. Portfolio construction and multi-strategy risk decomposition are common interview topics at senior level.",
    themes: [
      "multi-strategy portfolio construction",
      "quantitative risk management",
      "statistical arbitrage",
      "factor modelling and alpha research",
      "hedge fund technology infrastructure",
      "C++ and Python quant systems",
    ],
    lastVerified: "2026-07-21",
  },
  barclays: {
    description: "Barclays India operates two large Global Capability Centres (GCCs) in Pune and Chennai, working on investment banking technology, retail banking platforms, and risk/compliance systems.",
    products: ["Barclays iPortal (investment banking client portal)", "BARX (electronic trading platform)", "Barclays Bank UK digital banking", "CARDS platform (global credit card processing)", "Risk and compliance systems (Basel III / FRTB)"],
    competitors: ["JPMorgan Chase India GCC", "Goldman Sachs Bengaluru", "Deutsche Bank Chennai", "HSBC India GCC", "Citi India GCC"],
    scale: "~20,000 employees in India (across GCCs). UK-listed (BARC). India GCC headcount growing post-Brexit technology insourcing. Pune: IB tech. Chennai: retail banking tech.",
    techHints: "Java (primary — Spring Boot). Python for risk/analytics. React + Angular for web. Oracle DB and Sybase for banking. BARX trading platform uses Java with FIX protocol. Risk systems (FRTB / VaR) are C++ + Python.",
    notes: "Pay is mid-tier among banking GCCs — above ICICI/HDFC IT, below Goldman/JPMorgan. RSU is Barclays plc stock. Interview: moderate DS&A (LeetCode medium) + financial domain knowledge (trading lifecycle, risk systems). Investment banking technology roles require understanding of trade booking and P&L explain.",
    themes: [
      "investment banking technology (trade lifecycle)",
      "electronic trading (BARX / FIX protocol)",
      "retail banking digital platforms",
      "risk management (FRTB, VaR, Basel III)",
      "compliance and regulatory technology",
      "banking system architecture (Java/Spring)",
    ],
    lastVerified: "2026-07-21",
  },
  upstox: {
    description: "Upstox (RKSV Securities) is India's 2nd-largest discount broker by active clients, backed by Tiger Global and Ratan Tata. It offers zero-brokerage equity trading and is preparing for an IPO.",
    products: ["Upstox Pro app (equity/F&O/commodity trading)", "Upstox Web (trading terminal)", "Upstox API platform (algo trading)", "MF (mutual fund investment)", "IPO application platform"],
    competitors: ["Zerodha (market leader)", "Angel One", "Groww (MF-first)", "ICICI Direct", "HDFC Securities"],
    scale: "~2,000 employees. Pre-IPO (backed by Tiger Global, GIC). 12M+ active clients (SEBI data). Revenue ~₹2,000+ Cr FY24. Ratan Tata is a strategic investor.",
    techHints: "Go (primary backend — high-throughput order routing). React and Flutter for frontend. PostgreSQL + Kafka for real-time order events. Redis for session and market data cache. SEBI-regulated systems require strict audit trails and near-zero downtime during market hours.",
    notes: "Pre-IPO ESOP — Upstox has not filed DRHP as of 2026; discount ESOP value accordingly. Interview: DS&A (LeetCode medium) + financial domain (order routing, matching engine, market data). Go experience is preferred. Fintech trading systems mindset is valued over generic SWE experience.",
    themes: [
      "equity trading platform architecture",
      "order matching and routing systems",
      "real-time market data infrastructure",
      "zero-downtime financial systems",
      "SEBI compliance and audit trails",
      "Go microservices for high-throughput trading",
    ],
    lastVerified: "2026-07-21",
  },
  "angel-one": {
    description: "Angel One (formerly Angel Broking) is India's 3rd-largest stockbroker by active clients, listed on NSE and BSE. It offers discount brokerage, algo trading, and an AI-powered investment platform.",
    products: ["Angel One app (equity/F&O trading)", "SmartAPI (algorithmic trading API)", "Angel One Mutual Fund platform", "ARQ Prime (AI-powered investment advisory)", "Angel BEE (SIP investing)"],
    competitors: ["Zerodha", "Upstox", "Groww", "Dhan", "ICICI Direct"],
    scale: "~8,000 employees. NSE/BSE listed (ANGELONE). 22M+ registered clients. Revenue ~₹4,700 Cr FY24. Profitable and expanding into wealth management.",
    techHints: "Java (primary backend). React and React Native for frontends. PostgreSQL + Redis for trading data. Kafka for real-time order events. AI/ML team works on recommendation, risk, and fraud models. Angel One is one of the few stockbrokers with a serious internal ML team.",
    notes: "Listed RSU — ANGELONE stock is liquid. Pay is competitive for fintech but below top unicorns. Interview: moderate DS&A + financial domain knowledge (trading, order routing, exchange connectivity). AI/ML roles valued for recommendation and personalised investing use cases.",
    themes: [
      "equity trading platform and order routing",
      "AI-powered investment advisory",
      "algorithmic trading API design",
      "real-time market data feeds",
      "wealth management technology",
      "fintech security and SEBI compliance",
    ],
    lastVerified: "2026-07-21",
  },
  "ola-electric": {
    description: "Ola Electric is India's #1 electric two-wheeler company, listed on BSE/NSE in August 2024. It manufactures the Ola S1 series e-scooters and is building India's largest battery gigafactory (Gigafactory in Tamil Nadu).",
    products: ["Ola S1 / S1 Pro / S1 Air (e-scooters)", "Ola MoveOS (custom vehicle OS)", "Ola Krutrim (AI chip — spun off)", "Battery gigafactory infrastructure", "Ola Gen 2 / electric motorcycle lineup"],
    competitors: ["Ather Energy", "TVS iQube", "Bajaj Chetak", "Revolt (RattanIndia)", "Gogoro (global)"],
    scale: "~10,000 employees. BSE/NSE listed (OLAELECTRIC, IPO Aug 2024). Manufacturing capacity ~1M units/year. Revenue ~₹5,000 Cr FY24. Bhavish Aggarwal founded.",
    techHints: "C++ and Rust for embedded vehicle systems (MoveOS). Python for AI/ML features (rider profiling, predictive maintenance). React Native for mobile companion app. Telemetry data stack: Kafka + ClickHouse. Battery management system (BMS) is a core hardware-software co-design area.",
    notes: "Listed RSU but stock has been volatile post-IPO. Work culture is fast-paced/intense (Bhavish-led). Hardware + embedded software roles are the strongest fit. Interview includes domain-specific questions on vehicle electronics, BMS, and embedded C/C++. Software engineers work on MoveOS, telematics, and factory automation.",
    themes: [
      "electric vehicle software (MoveOS)",
      "battery management systems (BMS)",
      "embedded C++/Rust for vehicle systems",
      "vehicle telematics and IoT",
      "EV manufacturing and gigafactory automation",
      "rider experience and connected vehicle features",
    ],
    lastVerified: "2026-07-21",
  },
  "ather-energy": {
    description: "Ather Energy is India's premium electric two-wheeler startup, known for the Ather 450 series. Hero MotoCorp-backed, IPO filed in 2025. Distinguished by software-first approach and industry-leading charging network (Ather Grid).",
    products: ["Ather 450X / 450 Apex (premium e-scooters)", "Ather Stack (proprietary vehicle OS + app)", "Ather Grid (public fast-charging network)", "Battery technology and cell research"],
    competitors: ["Ola Electric (market share leader)", "TVS iQube", "Bajaj Chetak", "NIU Technologies"],
    scale: "~3,000 employees. Pre-IPO (DRHP filed 2025, Hero MotoCorp major investor). Revenue ~₹1,750 Cr FY24. 150+ charging grid stations. Bengaluru HQ.",
    techHints: "C++ and Python for embedded vehicle systems. Rust emerging for safety-critical firmware. Connected vehicle data stack (telemetry, OTA updates). Mobile: Flutter + React Native. ML for predictive maintenance and range estimation. Hardware-software co-design is core.",
    notes: "Pre-IPO ESOP (Hero MotoCorp investor makes it credible). Quality-focused engineering culture — closer to a product company than an OEM. Interview for hardware roles: electronics, embedded C++, BMS design, CAN/UART protocols. Software interview: vehicle data systems, OTA update architecture, safety-critical software.",
    themes: [
      "premium EV product engineering",
      "embedded firmware and vehicle OS",
      "over-the-air (OTA) update architecture",
      "charging infrastructure and grid operations",
      "vehicle telematics and predictive maintenance",
      "safety-critical software development",
    ],
    lastVerified: "2026-07-21",
  },
  blinkit: {
    description: "Blinkit (formerly Grofers) is India's largest quick commerce platform, acquired by Zomato in 2022. It operates 1,000+ dark stores and delivers groceries in 10 minutes across 40+ cities.",
    products: ["Blinkit app (10-min grocery delivery)", "Blinkit for Business (B2B dark store ops)", "Blinkit Bistro (hot food delivery)", "Dark store operations platform", "Seller onboarding and catalog platform"],
    competitors: ["Zepto (closest rival)", "Swiggy Instamart", "BigBasket BB Now", "Amazon Fresh"],
    scale: "~5,000 employees. Subsidiary of Zomato (NSE: ZOMATO). 1,000+ dark stores. Revenue ~₹2,300 Cr FY24. Growing at ~100% YoY. Profitable at dark-store level.",
    techHints: "Go (primary backend). React Native for mobile. PostgreSQL + Kafka for real-time order events. Real-time slot allocation and routing engine is strategic. ML for demand forecasting, ETA prediction, and dynamic pricing. Dark store inventory is managed by a proprietary WMS.",
    notes: "Zomato RSU (liquid, NSE-listed) — solid equity credibility. Pay is below Zepto at fresher level but equity is liquid. Interview: DS&A + system design with dark-store flavour (inventory, routing, demand forecasting, flash traffic). Blinkit is widely seen as the better-managed quick commerce operator vs Zepto.",
    themes: [
      "dark store inventory and slot allocation",
      "10-minute delivery routing and ETA",
      "demand forecasting for perishable inventory",
      "real-time order management systems",
      "Go microservices at quick-commerce scale",
      "warehouse management system (WMS)",
    ],
    lastVerified: "2026-07-21",
  },
  "morgan-stanley": {
    description: "Morgan Stanley India (MSCI) is one of the largest global investment banks with a major technology and analytics centre in Mumbai, employing 5,000+ technologists across full-stack, data engineering, and quantitative roles.",
    products: ["Institutional equity trading platforms", "Fixed income analytics", "Wealth management systems (Morgan Stanley Smith Barney)", "Risk and compliance systems", "E*TRADE (retail brokerage, acquired 2020)"],
    competitors: ["Goldman Sachs", "JPMorgan Chase", "Barclays Capital", "Bank of America Merrill Lynch"],
    scale: "~6,000 employees in India (Mumbai primarily). NYSE: MS. Global revenue ~$55B. Mumbai tech centre is a Tier-1 engineering hub, not just support.",
    techHints: "Java (primary), Python for quant/analytics. Proprietary in-house frameworks for trading. React/TypeScript frontend. High-performance computing for risk systems. All production trading systems subject to strict latency SLAs. Kubernetes on private cloud.",
    notes: "Compensation includes base + RSU (Morgan Stanley stock). No joining bonus at India offices. Technical rounds: strong DS&A + system design with finance domain twist (trade lifecycle, order management, risk calculation). Cultural fit emphasis. Senior roles need understanding of financial instruments (equities, fixed income, derivatives basics).",
    themes: [
      "trading system architecture",
      "order management and trade lifecycle",
      "risk and compliance systems",
      "financial data pipelines",
      "low-latency high-throughput systems",
      "investment banking technology",
    ],
    lastVerified: "2026-07-21",
  },
  "hdfc-bank": {
    description: "HDFC Bank is India's largest private sector bank by assets, offering retail banking, corporate banking, treasury, and insurance. Its tech team runs digital platforms for 80M+ customers.",
    products: ["HDFC Bank MobileBanking app", "NetBanking platform", "HDFC Bank credit cards (India's largest issuer)", "PayZapp (UPI and payment wallet)", "Corporate banking portals", "HDFC ERGO (insurance subsidiary)"],
    competitors: ["ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "SBI"],
    scale: "~200,000 employees. NSE/BSE listed (HDFCBANK). Assets ~₹35 trillion. India's most profitable bank. Tech team ~6,000+.",
    techHints: "Java (Spring Boot) core. Oracle DB and Temenos core banking. React and Angular for web. iOS/Android native + React Native for mobile. Private cloud with limited AWS. Strict RBI compliance constraints on data localisation and audit trails.",
    notes: "No equity. Pay is stable but below fintech startups. Business Analyst roles focus on BFSI domain more than coding — SQL and Excel proficiency expected. Relationship Manager (RM) roles are sales targets, not tech. Finance/wealth management interviews focus on products, KYC, and client relationship skills.",
    themes: [
      "digital banking and UPI infrastructure",
      "credit card processing and risk",
      "retail banking customer journeys",
      "RBI compliance and data localisation",
      "BFSI product knowledge",
      "wealth management and investment products",
    ],
    lastVerified: "2026-07-21",
  },
  "tower-research": {
    description: "Tower Research Capital is a US-based high-frequency trading (HFT) firm with a large quantitative research and engineering office in Gurgaon, India. It is one of the highest-paying freshers employers in India.",
    products: ["Proprietary HFT strategies (equity, futures, options, FX)", "Quantitative research infrastructure", "Ultra-low latency trading systems", "Market microstructure research"],
    competitors: ["Jane Street", "Citadel Securities", "IMC Trading", "Optiver", "Virtu Financial"],
    scale: "~700 employees globally, ~200+ in Gurgaon. Privately held. No disclosed revenue. Known for extreme compensation packages targeting IIT/NIT toppers.",
    techHints: "C++ for ultra-low latency systems. Python for research and backtesting. Linux kernel networking. FPGA for order routing. In-house execution management system (EMS). Everything measured in microseconds.",
    notes: "Pure cash + performance bonus — no equity. India base is ₹50–80 LPA for freshers (IIT placement data, 2024–25). Mid-level can reach ₹80–140 LPA+. Interview: heavy probability, statistics, and combinatorics brain teasers + C++ / Python coding. Market microstructure questions. No LeetCode-style questions — this is pure quant.",
    themes: [
      "probability and statistics (quant interview)",
      "market microstructure",
      "HFT system design (low-latency, C++)",
      "options and derivatives pricing",
      "backtesting and alpha research",
      "quantitative strategy development",
    ],
    lastVerified: "2026-07-21",
  },
  postman: {
    description: "Postman is the world's most-used API development platform, headquartered in Bengaluru, India. It pioneered the API collaboration workspace and serves 30M+ developers across enterprise and indie accounts.",
    products: ["Postman API Platform (workspaces, collections, environments)", "Postman Flows (API orchestration)", "Postman Interceptor", "Postman Monitors (API testing automation)", "Postman Vault (secret management)", "Postman CLI (Newman)"],
    competitors: ["Insomnia (Kong)", "Paw (by Luckymarmot)", "SwaggerHub (SmartBear)", "RapidAPI", "Hoppscotch (open-source)"],
    scale: "~900 employees (post-2023 reduction from 1,400). Bengaluru HQ. Revenue ~$200M+ ARR. Late-stage private (Insight Partners, Tiger Global). Valuation $5.6B.",
    techHints: "Electron (desktop app). React for web. Node.js backend. Go for performance-sensitive services. GraphQL API. Postman's internal architecture is a product for developers — interview discussions often center on API design patterns, developer experience (DX), and collaborative tooling.",
    notes: "ESOP is the key lever — Postman is late-stage but hasn't IPO'd. Refresh cadence is negotiable at IC2+. Interview: strong DS&A (LeetCode medium) + API design + developer-experience system design. DevRel and technical writing roles also common here — content portfolio weighs heavily.",
    themes: [
      "API design and developer experience (DX)",
      "collaborative tooling and real-time sync",
      "API testing automation",
      "developer platform growth and activation",
      "GraphQL and REST API design patterns",
      "Electron and cross-platform desktop apps",
    ],
    lastVerified: "2026-07-21",
  },
  browserstack: {
    description: "BrowserStack is India's leading developer infrastructure company for cross-browser and cross-device testing, serving 50,000+ enterprises. It is bootstrapped, profitable, and one of India's most respected product companies.",
    products: ["BrowserStack Live (manual cross-browser testing)", "Automate (Selenium/Playwright/WebDriver)", "App Live (mobile device testing)", "Percy (visual testing)", "Accessibility Testing", "Test Management (formerly Browserstack TM)"],
    competitors: ["Sauce Labs", "LambdaTest", "Perfecto", "Kobiton", "Appium (open-source)"],
    scale: "~1,500 employees. Bootstrapped — no external VC. Revenue ~$250M+ ARR. Mumbai HQ. 50,000+ customers including Google, Microsoft, Airbnb, Twitter.",
    techHints: "Python (backend automation systems). Java for Selenium infrastructure. React (frontend). Real device cloud management (thousands of physical devices). Browser virtualisation and farm infrastructure. Kubernetes at scale. BrowserStack owns and manages the largest physical device lab in the world.",
    notes: "Bootstrapped means no aggressive equity grants — comp is cash-heavy and ESOP is modest. Interview: focus on quality engineering, test automation design, and distributed systems (device farm management). QA / Automation Engineer interviews are notably technical — expect test strategy design and framework architecture discussions.",
    themes: [
      "cross-browser and cross-device testing at scale",
      "test automation frameworks (Selenium, Playwright)",
      "device farm infrastructure and virtualisation",
      "visual regression testing",
      "developer tooling and CI/CD integration",
      "real-device cloud management",
    ],
    lastVerified: "2026-07-21",
  },
  chargebee: {
    description: "Chargebee is a B2B subscription management and billing platform, helping SaaS companies automate recurring revenue operations. It serves 6,500+ businesses and processes billions in subscription revenue.",
    products: ["Chargebee Billing (subscription lifecycle)", "Chargebee RevenueStory (analytics)", "Chargebee Receivables (AR automation)", "Chargebee Retention (churn prevention)", "Chargebee Entitlements (feature access management)"],
    competitors: ["Stripe Billing", "Zuora", "Recurly", "Maxio (ChargeBee rival)", "Paddle"],
    scale: "~1,200 employees. Chennai + San Francisco HQ. Revenue ~$100M+ ARR. Backed by Insight Partners and Tiger Global. Valuation $3.5B.",
    techHints: "Java (primary backend). React (frontend). PostgreSQL for billing data. Kafka for event streaming. Revenue recognition (ASC 606 / IFRS 15) compliance is a core challenge — requires deep understanding of financial data integrity.",
    notes: "ESOP is pre-IPO at $3.5B valuation — credible but liquidity is uncertain. Pay is competitive for Chennai SaaS ecosystem but below Bengaluru unicorns. Interview: DS&A + system design with billing/fintech flavour (idempotency, subscription state machines, revenue recognition). Finance domain knowledge helps for senior roles.",
    themes: [
      "subscription billing and revenue recognition",
      "idempotent payment processing",
      "SaaS metrics and MRR/ARR analytics",
      "churn prediction and retention systems",
      "B2B SaaS product architecture",
      "financial data integrity and compliance",
    ],
    lastVerified: "2026-07-21",
  },
  makemytrip: {
    description: "MakeMyTrip (MMT) is India's largest online travel platform, listed on Nasdaq. It covers flights, hotels, holiday packages, and bus/rail booking across India and international routes.",
    products: ["MakeMyTrip (flights, hotels, holidays)", "Goibibo (budget travel, merged 2017)", "redBus (bus booking, Goibibo subsidiary)", "myBiz (corporate travel)", "MMT Black (premium members program)"],
    competitors: ["Cleartrip (Flipkart)", "ixigo (rail-first)", "EaseMyTrip", "Booking.com (international)", "Airbnb (accommodation)"],
    scale: "~5,000 employees. Nasdaq-listed (MMYT). Revenue ~₹6,000 Cr FY24. HQ in Gurugram. India's dominant OTA with ~75% online travel market share in hotels.",
    techHints: "Java and Python backend. React / React Native frontend. Cassandra + Elasticsearch for inventory. Kafka for real-time availability. ML for pricing, yield management, and personalised recommendations. Post-COVID tech rewrite — microservices on AWS.",
    notes: "Nasdaq RSU (MMYT) is liquid. Pay has grown post-COVID recovery. Interview: DS&A (LeetCode medium) + travel domain system design (flight/hotel search, inventory, dynamic pricing, availability at scale). Post-merger with Goibibo created tech complexity — distributed systems experience valued.",
    themes: [
      "real-time travel inventory and availability",
      "dynamic pricing and yield management",
      "search relevance for flights and hotels",
      "personalisation for travel recommendations",
      "payment aggregation for travel verticals",
      "B2B corporate travel management",
    ],
    lastVerified: "2026-07-21",
  },
  ixigo: {
    description: "ixigo is India's #1 train ticket booking app and a major player in low-cost air and bus travel, listed on NSE since 2024. It leads in Tier-2/3 city travel and vernacular railway search.",
    products: ["ixigo trains (IRCTC-integrated rail booking)", "ixigo flights (LCC focus)", "ixigo bus (Abhibus)", "ixigo air (flight search)", "ixigo Money (travel fintech)", "Confirm Ticket (seat confirmation predictor)"],
    competitors: ["MakeMyTrip / Goibibo", "EaseMyTrip", "IRCTC Rail Connect (direct)", "Paytm Travel (shuttered 2024)", "Redbus"],
    scale: "~1,000 employees. NSE-listed (IXIGO, IPO June 2024). Revenue ~₹900 Cr FY24. Gurugram HQ. 300M+ downloads. Profitability achieved FY24.",
    techHints: "Python and Go backend. React / React Native frontend. ML for seat availability prediction (Confirm Ticket algorithm). ElasticSearch for train search. IRCTC API integration is core and well-understood internally. Data science team focuses on demand forecasting and dynamic pricing.",
    notes: "Listed ESOP (NSE: IXIGO) is liquid — better than pre-IPO peers. Pay runs leaner than larger OTAs. Interview: moderate DS&A + travel domain (IRCTC integration patterns, seat prediction ML, Tier-2 user experience design). Vernacular and low-bandwidth tech design are valued skills here.",
    themes: [
      "railway booking and IRCTC integration",
      "seat availability prediction (ML)",
      "Tier-2 and Tier-3 user experience",
      "vernacular travel search",
      "LCC flight search and pricing",
      "travel fintech and UPI-first payments",
    ],
    lastVerified: "2026-07-21",
  },
  perplexity: {
    description: "Perplexity AI is an AI-native search engine that answers questions with real-time cited sources, backed by Jeff Bezos, NVIDIA, and Sequoia. It challenges Google Search with a conversational, reference-cited format.",
    products: ["Perplexity.ai (AI search engine)", "Perplexity Pro (subscription, advanced models)", "Perplexity API (developer access)", "Perplexity iOS/Android apps", "Perplexity Deep Research"],
    competitors: ["Google Search / Google AI Overview", "OpenAI ChatGPT Search", "Microsoft Bing AI / Copilot", "You.com", "Brave Search AI"],
    scale: "~400 employees globally. Revenue ~$100M+ ARR. Valuation $14B (2025). Backed by NVIDIA, Jeff Bezos, Sequoia, Andreessen Horowitz. India remote hires in AI research and backend infra.",
    techHints: "Python (primary). PyTorch for model work. Triton for GPU kernels. Real-time web retrieval + indexing pipeline. Retrieval-augmented generation (RAG) is the core architecture. Inference optimisation is strategically critical — TTFT (time to first token) and latency are key SLAs.",
    notes: "SF-anchored RSU at a $14B valuation — credible equity. India remote hires are extremely selective, mostly in AI research and backend systems. Interview: research-grade ML background + RAG system design + information retrieval fundamentals. Search ranking, crawling, and real-time indexing knowledge valued.",
    themes: [
      "retrieval-augmented generation (RAG)",
      "real-time web crawling and indexing",
      "AI search ranking and relevance",
      "LLM inference optimisation (TTFT, latency)",
      "citation and source attribution systems",
      "knowledge graph and entity linking",
    ],
    lastVerified: "2026-07-21",
  },
  krutrim: {
    description: "Krutrim (meaning 'artificial' in Sanskrit) is India's first AI unicorn, founded by Bhavish Aggarwal (Ola's founder) as a spinoff. It builds Indian-language AI models and is working on custom AI chips.",
    products: ["Krutrim LLM (Indic + multilingual)", "Krutrim Cloud (GPU cloud for AI workloads)", "Krutrim Chip (custom AI accelerator, in development)", "Krutrim APIs (developer platform)"],
    competitors: ["Sarvam AI", "AI4Bharat", "Google Gemini (Indic)", "Meta Llama (multilingual)", "OpenAI (global)"],
    scale: "~500+ employees. Bengaluru HQ. India's first AI unicorn ($1B+ valuation, 2024). Backed by Ola group investment. Bhavish Aggarwal is founder and CEO.",
    techHints: "Python (primary). PyTorch for LLM training. GPU cluster infrastructure on Krutrim Cloud (H100 nodes). Custom chip development (VLSI/silicon team). Indic language data collection and curation pipelines. The AI chip team requires deep hardware background (RTL, VLSI, computer architecture).",
    notes: "ESOP credibility is linked to Ola group trajectory and Krutrim's ability to monetise its LLM and cloud platform. Interview: AI/ML engineering background + Indic NLP knowledge + systems orientation. Hardware roles (chip design) need VLSI / RTL background. Mission-driven culture — expect motivation-for-India-AI in HR discussions.",
    themes: [
      "Indic and multilingual LLM development",
      "AI chip architecture and VLSI",
      "GPU cloud infrastructure",
      "Indian language data collection and curation",
      "AI inference and deployment at scale",
      "India-first AI product strategy",
    ],
    lastVerified: "2026-07-21",
  },
  "wells-fargo": {
    description: "Wells Fargo India GCC (Hyderabad and Chennai) is one of the largest banking technology centres for the US bank, working on retail banking, mortgage, commercial banking, and risk systems.",
    products: ["WF Online Banking platform", "Wells Fargo Mobile app", "Mortgage origination and servicing systems", "Commercial banking and treasury platforms", "Risk and fraud detection systems (FRISK)"],
    competitors: ["JPMorgan Chase India GCC", "Bank of America India GCC", "Citi India GCC", "Goldman Sachs Bengaluru", "Barclays India GCC"],
    scale: "~14,000 employees in India. NYSE-listed (WFC). Hyderabad is largest India hub (~8,000 employees). India is #3 headcount globally for Wells Fargo after US and Philippines.",
    techHints: "Java (primary backend — Spring). Python for data and analytics. React + Angular for web. Oracle DB for core banking. Mainframe (COBOL) for legacy systems. Core banking modernisation (cloud-native rewrite) is a multi-year initiative. AWS-heavy for new workloads.",
    notes: "NYSE RSU (WFC stock) is liquid. Pay is competitive among US banking GCCs, slightly above Barclays/HSBC. Interview: moderate DS&A + banking domain (mortgage lifecycle, payment systems, risk/fraud models). Core banking modernisation experience valued at senior levels. Hyderabad WF campus has campus hiring pipeline from ISB and Hyderabad tech colleges.",
    themes: [
      "retail banking and mortgage systems",
      "core banking modernisation (cloud migration)",
      "payment processing and NACHA/ACH",
      "fraud detection and risk scoring",
      "legacy mainframe to microservices migration",
      "US banking regulatory compliance",
    ],
    lastVerified: "2026-07-21",
  },
  delhivery: {
    description: "Delhivery is India's largest logistics and supply chain company, listed on NSE. It operates India's largest express parcel network, serving 90% of India's pin codes.",
    products: ["Express parcel delivery (B2C and B2B)", "Part-truckload (PTL) freight", "3PL warehousing and fulfilment", "Supply chain services (cold chain, Bharat Freezeworks)", "Delhivery 6-hour", "Cross-border logistics"],
    competitors: ["Blue Dart (DHL)", "Ecom Express", "XpressBees (Alibaba-backed)", "DTDC", "Amazon Logistics (captive)", "Shadowfax"],
    scale: "~12,000 employees. NSE-listed (DELHIVERY). Revenue ~₹8,000 Cr FY24. Serves 2,300+ cities. Gurugram HQ. Processes 2M+ shipments/day at peak.",
    techHints: "Python and Go (primary backend). React / React Native for mobile. PostgreSQL + Cassandra for shipment tracking. Kafka for real-time shipment events. Routing optimisation using OR-Tools and custom algorithms. ML for ETA prediction, route optimisation, and demand forecasting. GIS and geospatial data are core.",
    notes: "Listed RSU (DELHIVERY NSE) — liquid equity. Pay is mid-tier unicorn. Interview: DS&A + logistics system design (shipment tracking, routing optimisation, last-mile delivery, network planning). OR-Tools / optimisation algorithm knowledge is a strong differentiator. Delhivery's tech team is considered one of the best in Indian logistics.",
    themes: [
      "last-mile delivery routing and optimisation",
      "real-time shipment tracking at scale",
      "logistics network planning",
      "ETA prediction (ML for delivery windows)",
      "geospatial systems and GIS",
      "supply chain and warehouse management",
    ],
    lastVerified: "2026-07-21",
  },
  bigbasket: {
    description: "BigBasket is India's largest online grocery platform, now a Tata Digital subsidiary after the Tata Group acquired a majority stake in 2021. It serves 30+ cities with express grocery delivery (BB Now — 10-minute delivery) and scheduled slots.",
    products: ["BigBasket (scheduled grocery delivery)", "BB Now (10-minute express delivery)", "BB Daily (milk and daily subscriptions)", "BB Instantt (dark stores)", "BBStar (subscription membership)", "Fresho (private label fresh produce)"],
    competitors: ["Zepto", "Blinkit (Zomato)", "Swiggy Instamart", "Dunzo Daily", "JioMart", "Amazon Fresh"],
    scale: "~8,000 employees. Bengaluru HQ. Revenue ~₹10,000 Cr FY24. Backed by Tata Digital. Serves 30+ cities. ~7M customers.",
    techHints: "Python (primary backend). React / React Native frontend. Kafka for order event streaming. Cassandra for order state. ML for demand forecasting, inventory optimisation, freshness prediction (fresh produce), and personalised recommendations. BB Now's 10-minute delivery relies on dark store placement optimisation and rider routing.",
    notes: "Tata-group RSU via Tata Digital parentage — not yet independently listed, so ESOP liquidity depends on a future IPO. Pay is mid-tier relative to pure-play unicorns. Interview: DS&A + supply chain / grocery domain system design (inventory management, demand forecasting, dark store placement). Delivery routing and dark store ML are differentiated skill areas valued here.",
    themes: [
      "grocery supply chain and demand forecasting",
      "dark store placement and inventory optimisation",
      "10-minute delivery routing (BB Now)",
      "fresh produce freshness prediction (ML)",
      "personalised grocery recommendations",
      "Tata Digital ecosystem integrations",
    ],
    lastVerified: "2026-07-21",
  },
  apple: {
    description: "Apple India (Bengaluru) is a Tier-1 engineering hub for the Apple Silicon, Apple Intelligence, Services, and Maps organisations — not a support centre. The campus produces shipped software and silicon.",
    products: ["Apple Silicon / SoC (A-series, M-series)", "Apple Intelligence / Foundation Models", "Apple Maps (India ML and routing team)", "iCloud / Services backend", "App Store and Apple Pay infrastructure"],
    competitors: ["Google", "Microsoft", "Samsung", "Meta (AR/VR)", "Qualcomm (silicon)"],
    scale: "~3,500+ employees in India (Bengaluru, Hyderabad). Apple India revenue growing ~30% YoY on iPhone market share. Global headcount ~160,000.",
    techHints: "Swift, Objective-C, C++ for iOS/macOS/silicon. Python for ML research. Core ML framework, Metal for GPU compute. Proprietary on-device LLM stack (Apple Intelligence). Strict data privacy — on-device compute over cloud.",
    notes: "Interview process: ~6-8 rounds including coding (medium-hard LeetCode), system design, and domain-specific rounds (firmware, ML, hardware if applicable). ICT level calibration is the primary salary lever — push for ICT2 over ICT1 at entry. Apple weights writing and communication skills alongside technical ability.",
    themes: [
      "on-device machine learning (Core ML)",
      "Apple Silicon architecture",
      "privacy-preserving AI",
      "iOS / macOS platform internals",
      "hardware-software co-design",
      "ICT level calibration strategy",
    ],
    lastVerified: "2026-07-21",
  },
  databricks: {
    description: "Databricks India (Bengaluru) is a premium GCC for the Data + AI lakehouse platform, working on the Delta Lake engine, MLflow, Unity Catalog, and AI/BI (DBRX / Mosaic ML).",
    products: ["Delta Lake (open-source storage layer)", "Apache Spark (major contributor)", "MLflow (ML lifecycle, OSS)", "Unity Catalog (data governance)", "DBRX / Mosaic AI (LLM platform)", "Databricks SQL"],
    competitors: ["Snowflake", "Google BigQuery + Vertex AI", "AWS (Glue + SageMaker)", "Azure Synapse + OpenAI", "Palantir"],
    scale: "~6,000 employees globally, ~800+ in Bengaluru. Revenue run-rate ~$2B+ FY26. Pre-IPO (last valuation $62B, Series J). RSU liquid via tender offers.",
    techHints: "Scala and Python (core Spark work). Java for Unity Catalog and data governance services. Go for control plane. React for web UIs. Systems-level optimisation for query planning and execution. Heavy open-source contribution required at senior level.",
    notes: "Interview bar is among the highest in India GCCs — comparable to FAANG. Rounds: 3-4 coding (LeetCode hard + Spark/distributed focus) + 2 system design + domain knowledge. ML Engineer bar post-Mosaic acquisition (2023) is research-grade. Confirm next tender offer date before accepting — RSU liquidity depends on this.",
    themes: [
      "distributed data processing (Spark / Delta Lake)",
      "lakehouse architecture",
      "ML lifecycle management (MLflow)",
      "query optimisation and execution planning",
      "data governance and Unity Catalog",
      "AI/BI and LLM infrastructure",
    ],
    lastVerified: "2026-07-21",
  },
  zepto: {
    description: "Zepto is India's fastest-growing 10-minute grocery delivery platform, operating 700+ dark stores across 10+ cities. Raised $1B+ at a $5B valuation in 2024; IPO expected.",
    products: ["Zepto app (10-min grocery delivery)", "Zepto Cafe (beverages and snacks)", "ZeptoNow (B2B corporate delivery)", "Supersaver (value category)", "Dark store operations platform"],
    competitors: ["Blinkit (Zomato)", "Swiggy Instamart", "BigBasket BB Now", "Dunzo (struggling)"],
    scale: "~6,000+ employees. Pre-IPO (Series-G, 2024, $5B valuation). 700+ dark stores. GMV ~₹10,000+ Cr run-rate.",
    techHints: "Go (primary backend). React Native (mobile). PostgreSQL + Redis for inventory. Real-time dark-store slot allocation engine. ML-based demand forecasting is strategic. Kafka for order event streaming. Last-mile routing optimisation.",
    notes: "ESOP is pre-IPO but credibility higher than peers due to clean cap table and profitability trajectory. Interview process includes DS&A + system design with dark-store operations flavour (inventory, slot allocation, delivery routing). Zepto pays top-of-market for India 2026 freshers.",
    themes: [
      "dark store inventory and slot allocation",
      "real-time last-mile routing",
      "demand forecasting for perishable goods",
      "10-minute delivery logistics",
      "Go microservices for high-throughput ops",
      "quick commerce unit economics",
    ],
    lastVerified: "2026-07-21",
  },
  openai: {
    description: "OpenAI hires India-based engineers and researchers, mostly remote or at the Mumbai office, working on model training infrastructure, safety research, and product engineering for ChatGPT and API.",
    products: ["ChatGPT (consumer AI)", "OpenAI API (GPT-4o, o3, o4-mini)", "Sora (video generation)", "DALL-E (image generation)", "Whisper (speech recognition)", "OpenAI Codex / CoPilot integration"],
    competitors: ["Anthropic (Claude)", "Google DeepMind (Gemini)", "Meta AI (Llama)", "xAI (Grok)", "Mistral"],
    scale: "~3,500 employees globally. Revenue ~$5B+ ARR. Valuation $157B (2025 funding). India headcount <50 — extremely selective.",
    techHints: "Python (training, research). PyTorch (primary framework). Triton for GPU kernels. Kubernetes + custom cluster infrastructure. Safety and alignment teams work in Python + formal verification. Software engineers work on distributed training infra, RLHF pipelines, and product APIs.",
    notes: "India bar is at least 1.5x global FAANG — expect research-paper quality background or exceptional systems work. Typical process: 6-8 rounds including ML systems design, research paper discussion, and alignment/safety reasoning. LeetCode prep alone is insufficient. Networking via NeurIPS/ICLR and open-source contributions weigh heavily.",
    themes: [
      "large language model training infrastructure",
      "RLHF and alignment research",
      "distributed GPU training at scale",
      "ML systems and inference optimisation",
      "safety and red-teaming",
      "AI product engineering (ChatGPT / API)",
    ],
    lastVerified: "2026-07-21",
  },
  unacademy: {
    description: "Unacademy is India's largest online learning platform for competitive exam preparation (UPSC, JEE, NEET, CAT, GATE). It went through a major restructuring in 2024 with 30%+ workforce reduction.",
    products: ["Unacademy Learn (live + recorded classes)", "Unacademy Plus (paid subscription)", "Graphy (content creator platform)", "Unacademy Combat (mock tests)", "Relevel (hiring platform, shuttered 2023)"],
    competitors: ["PhysicsWallah (PW)", "Allen Online", "Byju's (distressed)", "BYJU's Toppr (shuttered)", "Vedantu"],
    scale: "~3,000 employees post-restructuring (down from 9,000 in 2022). SoftBank-backed. Last valuation $3.4B (2021) — significant markdown expected. Raised ~$860M total.",
    techHints: "Node.js and Python backend. React / React Native frontend. AWS-native. Video streaming via CDN. Recommendation engine for course discovery. Search powered by ElasticSearch.",
    notes: "ESOP credibility low — 2024 restructuring diluted equity value significantly. Negotiate for higher cash/fixed components. Interview process: moderate DS&A + system design (live class infra, video delivery). Work culture has stabilised post-restructuring. Relevant for candidates interested in edtech domain and live-class systems.",
    themes: [
      "live class streaming infrastructure",
      "competitive exam content delivery",
      "recommendation systems for education",
      "video streaming at scale",
      "edtech subscription and pricing models",
      "restructuring and cost optimisation",
    ],
    lastVerified: "2026-07-21",
  },
  physicswallah: {
    description: "PhysicsWallah (PW) is India's most credible edtech company in 2026, known for affordable JEE/NEET prep. It filed for an IPO and is profitable, unlike its peers.",
    products: ["PW App (live + recorded JEE/NEET prep)", "Vidyapeeth (offline coaching centres)", "PW Skills (tech + upskilling)", "PW Foundation (school education)", "Alakh Pandey YouTube channel (18M+ subscribers)"],
    competitors: ["Allen Career Institute", "Unacademy", "Aakash Educational Services (BYJU's)", "BYJU's (distressed)"],
    scale: "~6,000+ employees. Pre-IPO (filed DRHP 2024, IPO expected 2025-26). Revenue ₹1,900+ Cr FY24. Profitable — rare in Indian edtech. Valuation ~$2.8B.",
    techHints: "Node.js and Python backend. React / React Native frontend. MySQL + Redis. AWS for video and content delivery. ML for personalised learning paths. Alakh Pandey's YouTube-first model means content production tech is strategic.",
    notes: "Most stable edtech employer in India 2026. IPO signal lifted ESOP credibility vs Unacademy and Byju's. Pay is lower than unicorn tech companies but employment stability and ESOP value are the differentiators. Interview: moderate DS&A + system design with edtech flavour (video delivery, live class, personalised learning).",
    themes: [
      "affordable education and JEE/NEET prep",
      "live class and video streaming systems",
      "content-first product strategy",
      "personalised learning paths (ML)",
      "offline-to-online (Vidyapeeth centres)",
      "profitable edtech unit economics",
    ],
    lastVerified: "2026-07-21",
  },
  "de-shaw": {
    description: "DE Shaw India (DESI) is the Indian R&D and technology subsidiary of the global quantitative hedge fund DE Shaw, based in Hyderabad. It is the primary engineering and research engine for the entire DE Shaw group globally.",
    products: ["Proprietary quantitative trading strategies", "Portfolio management and risk systems", "Scientific computing and HPC infrastructure", "Anthill simulation platform", "Internal fintech (DE Shaw payments, internal banking tools)"],
    competitors: ["Jane Street", "Tower Research Capital", "Two Sigma", "Citadel", "AQR Capital"],
    scale: "~3,000 employees in Hyderabad (DESI is DE Shaw's largest office globally). Privately held. DE Shaw AUM ~$60B+.",
    techHints: "C++ for production systems. Python for research. Java for internal tools. Heavy Linux internals. PostgreSQL + Hadoop for data. In-house distributed computing infrastructure. Research teams use R and MATLAB for modelling. High focus on correctness and code review culture.",
    notes: "Pure cash + heavy performance bonus — no equity at DESI. Hyderabad campus only. Interview is among the hardest in India: multiple rounds of probability, statistics, brain teasers + algorithms (harder than LeetCode) + C++ systems + research aptitude. DE Shaw hires across quant research, software engineering, and systems biology. Non-standard profiles (math PhDs, physicists) also recruited.",
    themes: [
      "quantitative research and alpha generation",
      "probability theory and statistics",
      "C++ systems programming",
      "HPC and distributed computing",
      "algorithmic trading and risk",
      "hedge fund technology infrastructure",
    ],
    lastVerified: "2026-07-21",
  },
};

/**
 * Match a free-text company name to a KNOWN_FACTS entry.
 * Mirrors matchCompanyKey()'s normalization.
 */
export function getKnownFacts(rawCompany: string | undefined): KnownFacts | null {
  if (!rawCompany) return null;
  /* Normalize: strip non-letter punctuation, collapse hyphens AND
     spaces to a single space. So "Jane Street" and "jane-street" both
     normalise to "jane street", and "Razorpay Inc." matches "razorpay". */
  const cleaned = rawCompany
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/[\s-]+/g, " ")
    .trim();
  if (!cleaned) return null;
  /* Both the input AND each candidate key get hyphen-to-space
     normalisation before comparison. */
  for (const [key, value] of Object.entries(COMPANY_KNOWN_FACTS)) {
    const normalisedKey = key.replace(/-/g, " ");
    if (
      cleaned === normalisedKey ||
      cleaned.includes(normalisedKey) ||
      (normalisedKey.length >= 4 && normalisedKey.includes(cleaned))
    ) {
      return value;
    }
  }
  return null;
}

/**
 * Render KNOWN_FACTS as a prompt-ready block. Empty string when no
 * facts found — caller decides how to fall back.
 */
export function formatKnownFactsForPrompt(facts: KnownFacts | null, companyName: string): string {
  if (!facts) return "";
  const lines: string[] = [];
  lines.push("");
  lines.push(`VERIFIED COMPANY FACTS for ${companyName} (use ONLY these — do not invent additional facts):`);
  lines.push(`  • What they do: ${facts.description}`);
  if (facts.products?.length) lines.push(`  • Current products: ${facts.products.join(", ")}`);
  if (facts.competitors?.length) lines.push(`  • Real competitors: ${facts.competitors.join(", ")}`);
  if (facts.scale) lines.push(`  • Scale: ${facts.scale}`);
  if (facts.techHints) lines.push(`  • Tech signals: ${facts.techHints}`);
  if (facts.notes) lines.push(`  • Interview signals: ${facts.notes}`);
  /* Phase-6.6: explicit theme-bias directive. Rendered as a separate
     line (not folded into `notes`) because the LLM gives it more
     weight when the instruction is structured and imperative. Empty
     `themes` arrays are skipped — defensive against future refactors
     that mistakenly emit []. */
  if (facts.themes && facts.themes.length > 0) {
    lines.push(`  • BIAS QUESTIONS TOWARD: ${facts.themes.join(", ")}.`);
  }
  lines.push(`  • Facts last verified: ${facts.lastVerified}.`);
  lines.push(`If the candidate asks about a fact NOT in this list (revenue, headcount, founders, recent news, internal structure), do NOT invent it. Acknowledge the limit and ask the candidate or stay generic.`);
  lines.push("");
  return lines.join("\n");
}
