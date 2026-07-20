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
    description: "Global payments infrastructure for internet businesses; APIs for accept-payments, billing, fraud, banking-as-a-service.",
    products: ["Payments", "Billing", "Connect (marketplaces)", "Atlas (incorporation)", "Radar (fraud)", "Issuing"],
    competitors: ["Adyen", "PayPal/Braintree", "Square / Block", "Razorpay (India)"],
    notes: "Bug-bash round is signature: ~200-line code review with 5-7 intentional bugs. Writing-clarity bar is unusually high. India presence in Bengaluru via product-engineering team.",
    lastVerified: "2026-05-07",
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
