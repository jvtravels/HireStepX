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
