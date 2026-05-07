/**
 * Company-specific interview guidance. Used by generate-questions.ts as an
 * in-code fallback when server-handlers/_role-content.ts returns null (i.e.
 * when the company_guidance Supabase table has no row for the slug, which
 * is the default today).
 *
 * Coverage strategy:
 *   1. EXACT entries for the ~50 highest-frequency companies Indian
 *      candidates target (MAANG, big consulting, Indian unicorns, top
 *      PSBs, quant shops, etc.) — these get bespoke guidance.
 *   2. TYPE-pattern entries for the long tail (~1,000 other companies in
 *      the autocomplete) — `classifyCompanyType()` maps a free-text name
 *      to a bucket (e.g. "psu_bank", "consulting_big4", "indian_unicorn_
 *      fintech") and we use the bucket's generic-but-useful guidance.
 *
 * Both paths flow through `matchCompanyKey()`. Exact match wins; type
 * fallback fires when no exact entry exists; empty string only when the
 * company is genuinely unknown.
 *
 * Extracted from generate-questions.ts so that file stays focused on
 * request-handling logic and this file can be imported by tests + eventually
 * by a seed script that populates the DB.
 */

export const COMPANY_GUIDANCE: Record<string, string> = {
  // ─── Indian IT services ───
  tcs: "TCS interviews follow NQT (National Qualifier Test) pattern. Focus on: technical fundamentals (DSA, DBMS, OS, networking), HR questions about adaptability and teamwork, and coding aptitude. Ask about willingness to relocate, work in shifts, and handle client-facing roles. TCS values process orientation and learning agility.",
  infosys: "Infosys interviews follow InfyTQ pattern. Focus on: Java/Python fundamentals, puzzle-solving, logical reasoning, and HR questions about innovation and continuous learning. Infosys values design thinking and digital transformation mindset. Ask about experience with agile methodologies.",
  wipro: "Wipro NLTH (National Level Talent Hunt) pattern. Focus on: coding aptitude, technical fundamentals, and HR questions about adaptability. Wipro values spirit of being Wipro (integrity, customer-centricity). Ask about handling ambiguity and cross-functional collaboration.",
  hcltechnologies: "HCL interviews emphasize practical engineering and product mindset (less services-shop, more product-engineering). Focus on: technical depth in the candidate's primary stack, system thinking for legacy modernization, and willingness to own delivery end-to-end. Ask about handling production incidents and customer escalations.",
  techmahindra: "Tech Mahindra interviews emphasize telecom-domain knowledge for telco-aligned roles, and digital transformation for enterprise roles. Focus on: technical fundamentals, communication skills (TM is heavy on client-facing roles), and willingness to work across geographies. Ask about handling cultural diversity in delivery teams.",
  cognizant: "Cognizant GenC/GenC Next pattern. Focus on: coding skills (Java/Python), SDLC knowledge, and HR questions about team dynamics. Cognizant values digital engineering and modernization. Ask about experience with legacy system transformation.",
  accenture: "Accenture interviews emphasize consulting skills, communication, and problem-solving. Focus on: case studies, client interaction scenarios, technology awareness (cloud, AI, digital). Accenture values innovation, inclusion, and stewardship. Ask about managing stakeholder expectations.",
  capgemini: "Capgemini interviews emphasize consulting + delivery hybrid. Focus on: technical depth in the candidate's stack, business-process understanding (especially BPM, ERP), and adaptability across client engagements. Ask about onsite/offshore coordination experience.",
  ltimindtree: "LTIMindtree interviews emphasize digital transformation and cloud-native delivery. Focus on: cloud platforms (AWS/Azure/GCP), microservices design, agile delivery, and HR questions about handling ambiguity in client requirements.",
  // ─── MAANG + global tech ───
  google: "Google interviews follow structured behavioral + technical format. Focus on: Googleyness (intellectual humility, collaboration, bias to action), leadership (even without authority), and role-related knowledge. Use the STAR format. Ask about ambiguous problem-solving and data-driven decisions.",
  microsoft: "Microsoft interviews emphasize growth mindset, collaboration, and customer obsession. Focus on: system design thinking, behavioral scenarios about influence and impact, and technical depth in the relevant stack. Ask about learning from failures.",
  amazon: "Amazon interviews are heavily LP (Leadership Principles) driven. Focus on: Customer Obsession, Ownership, Invent and Simplify, Bias for Action, Deliver Results. Every question should map to an LP. Expect deep-dive follow-ups like 'What would you do differently?' and 'Give me the metrics.'",
  meta: "Meta interviews focus on impact, move fast, and be bold. Ask about scaling systems, building for billions of users, and cross-functional collaboration. Behavioral questions should explore how candidates handle disagreement, prioritize ruthlessly, and measure success.",
  apple: "Apple interviews emphasize craft, attention to detail, and 'thinking different'. Focus on: deep technical mastery in the candidate's domain, design taste, ability to defend trade-offs articulately, and willingness to obsess over the small things. Apple resists generic answers — push for specifics.",
  netflix: "Netflix interviews follow the 'culture deck' (Freedom & Responsibility, Keeper Test). Focus on: judgment under ambiguity, ability to disagree-and-commit, transparency about failure, and high-performance mindset. The bar is 'would I fight to keep this person?' Ask about times the candidate raised a hard truth.",
  adobe: "Adobe interviews emphasize craft + creativity blend. Focus on: technical depth (especially in the Creative Cloud / Document Cloud stack), product thinking around digital experiences, and collaboration across design + engineering. Ask about user-centric trade-offs and customer empathy.",
  oracle: "Oracle interviews emphasize database fundamentals, enterprise sales context, and large-scale systems thinking. Focus on: SQL depth, distributed systems for cloud roles (OCI), and HR questions about handling enterprise customer escalations. Less product/UX, more engineering rigor.",
  salesforce: "Salesforce interviews emphasize Trailhead-style platform thinking, customer success, and Ohana culture. Focus on: Apex/LWC for engineering roles, business-process modeling for solution architects, and behavioral scenarios about handling diverse customer industries. Ask about giving back (1-1-1 model).",
  ibm: "IBM interviews emphasize enterprise consulting, hybrid cloud, and AI (Watson) for product roles. Focus on: technical depth in the candidate's stack, ability to articulate value to enterprise buyers, and handling ambiguity in long-cycle deals. Ask about complex stakeholder management.",
  uber: "Uber interviews emphasize ownership, operational rigor, and city-by-city playbook execution. Focus on: scale-thinking (millions of trips/day), data-driven decisions, and ability to navigate marketplace dynamics (driver supply vs rider demand). Push for concrete metrics and trade-offs.",
  stripe: "Stripe interviews are famously high-bar on writing clarity. Focus on: written communication (Stripe interviewers literally read your writing samples), technical depth, attention to detail (e.g. API design, idempotency, edge cases), and ability to think about developers as customers. Ask candidates to explain a complex concept in 3 sentences.",
  // ─── Indian unicorns (highest-target) ───
  flipkart: "Flipkart interviews emphasize scale, India-specific e-commerce challenges, and product thinking. Focus on: system design for scale, data-driven decision making, and startup-like ownership mentality. Ask about handling competing priorities and fast execution.",
  razorpay: "Razorpay interviews emphasize fintech depth, attention to compliance, and engineering rigor. Focus on: payment-system design (UPI, cards, settlement), API design (idempotency, retries, webhooks), and willingness to debug in production. Ask about handling money-movement edge cases — they care about correctness more than speed.",
  phonepe: "PhonePe interviews emphasize UPI-scale thinking and reliability. Focus on: distributed systems handling billions of transactions, partner-bank integration, fraud detection, and behavioral scenarios about ownership in incidents. PhonePe values engineering rigor over product polish — push for technical specifics.",
  paytm: "Paytm interviews emphasize breadth across payments + commerce + financial services. Focus on: ability to context-switch, comfort with ambiguous priorities, and resilience under fast pivots. Less about deep specialization, more about being a generalist who can ship.",
  cred: "CRED interviews emphasize craft, design taste, and product premium positioning. Focus on: attention to detail, ability to articulate why something feels 'CRED-y' vs generic, and willingness to push back on lazy decisions. Engineering bar is high; design bar is even higher.",
  zerodha: "Zerodha interviews emphasize first-principles thinking and engineering simplicity. Focus on: technical depth (most engineering is in-house, no over-reliance on cloud abstractions), ability to defend trade-offs, and alignment with Zerodha's no-bullshit culture (no marketing fluff, no growth-hacking). Self-taught engineers welcome.",
  swiggy: "Swiggy interviews emphasize India-scale logistics, ownership of P&L, and operational rigor. Focus on: optimization thinking (delivery time, cost per order, partner economics), comfort with messy data, and willingness to dive into specific city-level operations. Ask about competing trade-offs.",
  zomato: "Zomato interviews emphasize bias for action and product judgment. Focus on: product thinking with real numbers (orders, AOV, retention), comfort with rapid iteration, and ability to defend a controversial decision. Zomato culture is direct and unfiltered — fluffy answers get pushback.",
  nykaa: "Nykaa interviews emphasize consumer-product depth, beauty-vertical knowledge for product roles, and full-funnel thinking (acquisition → conversion → retention → loyalty). Focus on: data-driven decisions, India-specific consumer behavior, and ability to translate brand into product.",
  meesho: "Meesho interviews emphasize Bharat (Tier 2/3 India) consumer thinking and seller ecosystem dynamics. Focus on: low-ARPU economics, vernacular UX considerations, and ability to design for low-bandwidth / low-trust users. Push for understanding of the reseller persona.",
  ola: "Ola interviews emphasize marketplace dynamics, India-specific mobility, and product judgment. Focus on: supply-demand modeling, surge pricing rationale, EV transition for newer roles, and resilience in a fast-changing competitive landscape.",
  byjus: "Byju's interviews emphasize EdTech product thinking and learner outcomes (more so post-2023 reset). Focus on: pedagogy + product hybrid thinking, parent vs student decision dynamics, and handling the post-funding rationalization context honestly.",
  freshworks: "Freshworks interviews emphasize SaaS engineering rigor and global-from-day-1 product thinking. Focus on: API design, multi-tenant architecture, customer-segment understanding (SMB vs mid-market), and willingness to ship to international customers. Engineering bar is closer to US SaaS than Indian unicorn.",
  zoho: "Zoho interviews emphasize first-principles engineering and self-reliance (Zoho builds everything in-house, including their own languages). Focus on: technical depth, willingness to work on legacy systems, and alignment with Zoho's anti-VC, slow-growth, profitability-first culture. Self-taught talent strongly preferred.",
  // ─── Top consulting (specific cultures) ───
  mckinsey: "McKinsey interviews are case-heavy. Focus on: structured problem-solving (issue tree, MECE, 80/20), top-down communication (answer first, then evidence), data-driven hypothesis testing, and personal experience interview (PEI) — leadership stories with quantified impact. Bar is structure + delivery; content can be approximated.",
  bcg: "BCG interviews are case + behavioral, with emphasis on creativity within structure. Focus on: ability to brainstorm frameworks (not just apply textbook ones), comfort with ambiguity, and crisp top-down communication. BCG looks for 'pattern recognition + curiosity' more than rigid frameworking.",
  bain: "Bain interviews emphasize the 'Bainie' — collaborative, results-oriented, driven. Cases are similar to MBB peers but interviewers actively coach during the case. Focus on: structured thinking, ability to take direction without losing confidence, and warm interpersonal style. Bain interviews are conversational; treat the interviewer as a teammate.",
  deloitte: "Deloitte interviews vary widely by service line (Strategy & Analytics, Consulting, Risk Advisory, Technology). For consulting roles: case studies + behavioral, structured thinking. For tech: technical depth + client-facing stories. Common thread: stakeholder management at scale.",
  // ─── Investment banks + quant ───
  goldmansachs: "Goldman Sachs interviews emphasize technical fundamentals (especially for engineering / quant roles), cultural fit ('14 Business Principles'), and resilience under pressure. Focus on: deep technical preparation, ability to discuss markets even for non-trading roles, and articulate why-Goldman over peers. Multiple-round process; consistency across rounds matters.",
  jpmorgan: "JP Morgan interviews emphasize technical depth + business context. For tech: focus on system design, data structures, and finance-domain awareness. For non-tech: focus on Excel/financial modeling proficiency, client-facing communication, and stakeholder navigation across business units.",
  morganstanley: "Morgan Stanley interviews emphasize precision and 'one Morgan Stanley' culture (collaboration across silos). Focus on: technical depth in the candidate's domain, articulate communication (the firm cares about polish), and behavioral scenarios about handling difficult clients or markets.",
  janestreet: "Jane Street interviews are mental-math heavy and game-theory + probability driven. Focus on: rapid arithmetic, expected-value thinking, market-making intuition, and ability to reason about probabilities under time pressure. Cultural fit signals: curiosity, hyper-rationality, collaborative rather than competitive.",
  deshaw: "DE Shaw interviews emphasize first-principles math + algorithms. Focus on: probability puzzles, quantitative aptitude, algorithmic depth (Fenwick trees, segment trees, advanced graph theory for SDE roles), and ability to articulate mathematical intuition cleanly.",
  // ─── Top Indian banks ───
  hdfcbank: "HDFC Bank interviews emphasize banking domain knowledge and risk-aware mindset. Focus on: banking products understanding (CASA, retail vs corporate banking), regulatory awareness (RBI guidelines, KYC/AML), and HR questions about handling cash, customer escalations, and cross-selling ethically.",
  icicibank: "ICICI Bank interviews emphasize digital-banking depth and tech-led product thinking. Focus on: banking domain + technology blend, comfort with iMobile / iLens-type initiatives, and willingness to handle customer escalations. ICICI interviews are noticeably faster-paced than peer PSBs.",
  // ─── PSUs (worth specific guidance) ───
  isro: "ISRO interviews emphasize technical depth in the candidate's specialization (mechanical, aerospace, electronics, computer science, etc.), publication record / project rigor, and alignment with the Indian space mission. Less behavioral, more technical viva. Salary-negotiation framing is irrelevant — focus on mission fit and technical contribution.",
  drdo: "DRDO interviews emphasize defense R&D context + deep technical specialization. Focus on: domain knowledge (specific to the lab the candidate is targeting — ADA, RCI, LRDE, etc.), security clearance awareness, and willingness to handle classified work with discretion.",
  // ─── Top Indian conglomerates ───
  tatagroup: "Tata Group interviews vary wildly by entity (TCS, Tata Steel, Tata Motors, Tata Communications, Tata Digital, etc.). Common thread: emphasis on Tata values (integrity, excellence, unity, responsibility, pioneering), long-term thinking over quarterly hits, and willingness to work in legacy + transforming systems together. Specify the exact Tata entity early.",
  reliance: "Reliance Industries (incl. Jio, Reliance Retail, Reliance Digital) interviews emphasize scale and bias for action. Focus on: ability to ship at India-scale (100M+ users for Jio, sub-second latency for retail), comfort with hierarchy + autonomy mix, and willingness to operate at Mukesh-time (faster than typical Indian corporates).",
  // ─── New Indian AI/SaaS startups (small but growing) ───
  sarvam: "Sarvam AI interviews emphasize India-first AI / language-model thinking. Focus on: NLP depth (especially for Indic languages — Hindi, Tamil, Telugu, etc.), ability to evaluate model output rigorously, and alignment with Sarvam's mission of democratizing AI in India. Engineering bar is research-level.",
};

// ─── Type-pattern fallbacks ───
//
// For any company in the autocomplete that doesn't have a bespoke entry,
// we classify it into a bucket based on name patterns and return generic-
// but-useful guidance. Buckets are ordered most-specific to most-generic;
// first match wins.

interface CompanyTypeBucket {
  /** Bucket id used as the cache key by the caller. */
  key: string;
  /** Regex that, if it matches the normalized company name (lowercased,
   *  spaces+punctuation stripped), assigns this bucket. */
  pattern: RegExp;
  /** Generic guidance to inject into the prompt. Same shape as exact
   *  entries above — should be a paragraph that gives the LLM enough
   *  flavour to ask company-type-appropriate questions. */
  guidance: string;
}

const COMPANY_TYPE_BUCKETS: CompanyTypeBucket[] = [
  {
    key: "consulting_big4",
    pattern: /^(pwc|ey|ernstyoung|kpmg|deloitte|grantthornton|bdo)$/,
    guidance: "Big 4 consulting / audit firms emphasize structured thinking, client-facing communication, and domain rigor (audit, tax, risk advisory, or strategy). Focus on: case-style problem decomposition, comfort with ambiguous client briefs, ability to articulate trade-offs without jargon, and behavioral scenarios about handling demanding clients and tight deadlines. Ethics and independence are non-negotiable themes.",
  },
  {
    key: "consulting_strategy",
    pattern: /^(mckinsey|bcg|bain|olivervwyman|kearney|rolandberger|alvarezandmarsal|strategy|leconsulting|frostandsullivan)$/,
    guidance: "Strategy consulting interviews are case-heavy. Focus on: structured problem decomposition (issue trees, MECE, 80/20), top-down communication (answer first, then build), hypothesis-driven thinking, and personal experience stories with quantified impact. Bar is structure + delivery; content can be approximated under pressure.",
  },
  {
    key: "ibank_bulgebracket",
    pattern: /^(barclays|citi|hsbc|ubs|creditsuisse|bankofamerica|wellsfargo|bnpparibas|societegenerale|standardchartered|nomura|macquarie)$/,
    guidance: "Bulge-bracket investment banking interviews emphasize technical depth (financial modeling, valuation, market knowledge), articulate communication, and resilience. Focus on: walking through a DCF / LBO without notes, discussing recent market events with informed perspective, and behavioral scenarios about long hours, high-stakes deals, and stakeholder management.",
  },
  {
    key: "quant_hft",
    pattern: /^(twosigma|citadel|towerresearch|worldquant|millennium|point72|hudsonriver|imctrading|optiver|jumptrading|bridgewater|renaissancetech|aqrcapital)$/,
    guidance: "Quant / HFT interviews emphasize mental math, probability, and game-theory thinking. Focus on: rapid arithmetic, expected-value reasoning, market-making intuition, and willingness to articulate uncertainty (give a range, not a single point). Cultural fit signal: hyper-rational, collaborative, comfortable with being wrong loudly so the team converges faster.",
  },
  {
    key: "psu_bank",
    pattern: /^(stateBankofIndia|sbi|punjabnationalbank|pnb|bankofbaroda|canarabank|unionbankofindia|indianbank|bankofindia|centralbankofindia|indianoverseasbank|ucobank|bankofmaharashtra|punjabandsindbank)$/,
    guidance: "Public sector bank (PSB) interviews emphasize banking domain knowledge, regulatory awareness (RBI, FEMA, SARFAESI), and customer-handling under pressure. Focus on: banking products (CASA, retail vs corporate, priority sector lending), India-specific banking context (RuPay, UPI, JAM trinity, financial inclusion), and HR questions about willingness to relocate to rural / semi-urban branches. Less tech-forward than private banks; more process + service oriented.",
  },
  {
    key: "private_bank",
    pattern: /^(yesbank|indusindbank|federalbank|rblbank|idfcfirstbank|bandhanbank|southindianbank|cityunionbank|karurvysyabank|dcbbank|csbbank|tamilnadmercantilebank|karnatakabank)$/,
    guidance: "Indian private bank interviews emphasize digital-banking depth, retail-asset products, and risk-aware product thinking. Focus on: banking domain + tech blend (mobile-first journeys, NPA management, customer onboarding), comfort with regulatory dynamics, and HR questions about handling cross-sell pressure ethically.",
  },
  {
    key: "small_finance_bank",
    pattern: /^(ausmallfinancebank|equitassmallfinancebank|ujjivansmallfinancebank|esafsmallfinancebank|suryodaysmallfinancebank|capitalsmallfinancebank|fincaresmallfinancebank|janasmallfinancebank|utkarshsmallfinancebank)$/,
    guidance: "Small Finance Bank interviews emphasize Bharat / Tier 2-3 customer empathy, microfinance roots, and operational rigor at thin margins. Focus on: understanding of unbanked / underbanked customer behavior, comfort with high-touch in-person collection cycles, and willingness to work in non-metro geographies. Tech bar is rising but customer-trust building is still primary.",
  },
  {
    key: "indian_unicorn_fintech",
    pattern: /^(slice|jupiter|fimoney|unicards|kreditbee|lendingkart|indmoney|smallcase|niyo|cashfree|instamojo|bharatpe|mobikwik|freecharge|lazypay|zestmoney|rupeek|pinelabs|mswipe|payu|juspay|simpl|paytmmoney|upstox|angelone|5paisa|motilaloswal|setu|decentro|m2pfintech|cleartax|khatabook|okcredit)$/,
    guidance: "Indian fintech startup interviews emphasize speed, regulatory awareness, and engineering rigor. Focus on: payment-system or lending-system design (UPI, cards, BNPL, settlement, KYC), comfort with India's regulatory layer (RBI, NPCI, SEBI guidelines), and willingness to debug production-money-movement issues. Push for specifics — fintech failures are loud and traceable, so candidates should give exact numbers.",
  },
  {
    key: "indian_unicorn_consumer",
    pattern: /^(myntra|jabong|firstcry|purplle|lenskart|mamaearth|boat|sugarcosmetics|bewakoof|licious|freshtohome|wakefit|thesouledstore|bombayshavingcompany|beardo|wowskinscience|plumgoodness|myglamm|sleepyowl|ustraa|bodywise|mensabrands|globalbees|gokwik|toplyne|snitch|freakins|pepperfry|urbanladder|fabindia|chumbak)$/,
    guidance: "D2C / consumer-internet interviews emphasize brand judgement, marketplace dynamics, and unit economics. Focus on: ability to articulate brand positioning (why us vs commodity alternatives), comfort with the full marketing funnel (acquisition CAC, retention, repeat-rate), and willingness to dive into specifics — Tier-1 vs Tier-2 customer behavior, COD vs prepaid mix, return rates.",
  },
  {
    key: "indian_unicorn_edtech",
    pattern: /^(unacademy|upgrad|physicswallah|vedantu|scaler|codingninjas|simplilearn|greatlearning|whitehatjr|toppr|doubtnut|allendigital|testbook|adda247|gradeup|prepladder|eruditus|bluelearn|cuemath|leadschool|campk12|stoaschool|masaischool|newtonschool|kraftshala)$/,
    guidance: "Indian EdTech interviews emphasize learner-outcome thinking + parent-vs-student decision dynamics. Focus on: ability to articulate pedagogy (not just product UX), comfort with India-specific exam ecosystems (JEE, NEET, CAT, GATE), and acceptance of the post-2023 reset context (efficiency over growth-at-all-costs). Honest discussion of churn and outcomes is expected.",
  },
  {
    key: "indian_unicorn_logistics",
    pattern: /^(rapido|blusmart|ola electric|olaelectric|revoltmotors|yulu|bounce|shiprocket|ecomexpress|xpressbees|shadowfax|porter|rivigo|loadshare|blackbuck|vahak|blowhorn|freighttiger|redbus|chalo|quickride)$/,
    guidance: "Logistics / mobility startup interviews emphasize operational density and unit economics in messy real-world environments. Focus on: route-optimization or supply-demand thinking, comfort with last-mile constraints (driver supply, vehicle utilization, RTO rates, hub-and-spoke vs P2P), and willingness to operate in non-metro India.",
  },
  {
    key: "gcc_global_capability_centre",
    pattern: /walmartlabs|targetindia|lowesindia|tescobengaluru|wellsfargoindia|jpmcindia|goldmansachsindia|morganstanleyindia|standardcharteredgbs|americanexpressindia|mastercardindia|visaindia|allstateindia|cignaindia|aigindia|libertymutualindia|geindia|honeywellindia|caterpillarindia|cumminsindia|abbindia|siemensindia|schneiderelectricindia|boeingindia|airbusindia|lockheedmartinindia|rollsroyceindia|westerndigitalindia|texasinstrumentsindia|analogdevicesindia|marvellindia|synopsysindia|cadenceindia|appliedmaterialsindia|lamresearchindia|klaindia|ericssonindia|nokiaindia|junipernetworksindia/,
    guidance: "Global Capability Centre (GCC) interviews emphasize strong technical fundamentals + ability to operate across global timezones with US/EU stakeholders. Focus on: depth in the candidate's stack (often C++/Java/Python at scale), system design for high-throughput problems, and behavioral scenarios about handling a parent-org culture remotely. Compensation expectations are typically higher than Indian unicorns; tech rigor matches global big-tech.",
  },
  {
    key: "indian_it_services",
    pattern: /^(persistentSystems|persistentsystems|mphasis|coforge|lttechnologyservices|cyient|kpittechnologies|mindtree|hexaware|zensar|sonatasoftware|birlasoft|niittechnologies|happiestminds|igate|saskenfactor|tataElxsi|tataelxsi|amdocs|dxctechnology|ntt|atos|cgi|unisys|bahwancybertek|rolta|polaris|saksoft|datamatics|subex)$/,
    guidance: "Indian IT services interviews emphasize technical fundamentals, willingness to relocate, and client-facing maturity. Focus on: language fundamentals (Java, Python, .NET, depending on practice), agile / SDLC familiarity, comfort with shift work or onsite assignments, and HR questions about handling client escalations across cultures. Bar varies by tier — top-tier (Persistent, Mphasis) closer to product companies; mid-tier closer to TCS pattern.",
  },
  {
    key: "indian_pharma",
    pattern: /^(sunpharma|drreddys|cipla|lupin|aurobindopharma|biocon|divislabs|torrentpharma|zyduslifesciences|glenmark|alkemlabs|mankindpharma|ipcalabs|natcopharma|piramalpharma|pfizerindia|novartisindia|astrazenecaindia|abbottindia|gskindia|sanofiindia|elilillyindia|merckindia|rocheindia|johnsonjohnsonindia|bharatbiotech|seruminstitute|panaceabiotec|wockhardt|cadilahealthcare|stridespharma|granulesindia|laurusLabs|laurus|suvenpharma)$/,
    guidance: "Indian pharma interviews emphasize regulatory rigor, scientific depth, and global-supply-chain awareness. Focus on: domain knowledge (formulation, API, biosimilars, regulatory affairs depending on the role), familiarity with USFDA / EMA / DCGI norms, comfort with documentation discipline, and behavioral scenarios about handling quality incidents transparently.",
  },
  {
    key: "indian_fmcg",
    pattern: /^(hindustanunilever|hul|itc|nestleindia|pgindia|colgatepalmoliveIndia|colgatepalmoliveindia|dabur|marico|godrejconsumerproducts|emami|britannia|parleproducts|amul|haldirams|tataconsumerproducts|patanjali|bisleri|paperboat|rawpressery|pepsicoindia|cocacolaindia|mondelezindia|mccainindia|unitedbreweries|pernodricardindia|diageoindia|reckittbenckiserindia|kellogindia|adaniwilmar|fortune)$/,
    guidance: "FMCG interviews emphasize sales discipline, distribution savvy, and India-specific go-to-market thinking. Focus on: depth in either trade marketing or brand marketing (specify upfront), retail / kirana economics (margins, category growth, primary vs secondary sales), and HR questions about willingness to spend extended periods in market visits. P&L ownership stories matter even for early-career roles.",
  },
  {
    key: "psu_central",
    pattern: /^(bhel|ongc|ntpc|indianoil|iocl|gail|bpcl|hpcl|coalindia|powergrid|sail|nmdc|nalco|mmtc|stc|nhpc|nlcindia|rites|concor|irctc|railtel|irfc|rvnl|ircon|dfcc|hal|bel|bdl|beml|grse|mazagondock|cochinshipyard|midhani|ofb)$/,
    guidance: "Central PSU interviews emphasize technical depth in the candidate's specialization, written-paper rigor (most have a stage-1 written test before the interview), and long-term commitment signals. Focus on: domain mastery (avoid surface-level answers), ability to discuss the PSU's specific projects / mandates, and HR questions about willingness to work at remote sites. Compensation talk is irrelevant — pay is grade-based, not negotiated.",
  },
  {
    key: "academia_iit_iim",
    pattern: /^(iit[a-z]*|iim[a-z]*|iisc|isb|xlri|fmsdelhi|mdigurgaon|bitspilani|vitvellore|manipaluniversity|amityuniversity)$/,
    guidance: "Academic institution interviews (faculty, research, administrative) emphasize scholarly depth, publication record / project rigor, and pedagogical fit. Focus on: research narrative (what problem, why now, what's novel), teaching philosophy if faculty-track, and ability to articulate institutional alignment.",
  },
  {
    key: "indian_aviation",
    pattern: /^(indigo|spicejet|airindia|vistara|akasaair|airasiaindia|airindiaexpress|allianceair|starair|pawanhans|gmrairports|adaniairports|dial|mial|bial)$/,
    guidance: "Aviation interviews emphasize safety culture, regulatory awareness (DGCA, IATA), and operations-under-pressure thinking. Focus on: domain knowledge (cockpit, cabin, ground ops, MRO depending on role), comfort with shift work and seasonal travel, and behavioral scenarios about handling delays / customer escalations. Operational reliability stories are the highest-signal answers.",
  },
  {
    key: "indian_hotels",
    pattern: /^(indianhotels|taj|itchotels|eih|oberoi|theleela|leela|lemontreehotels|marriottindia|hyattindia|hiltonindia|accorindia|radissonindia|parkhotels|sarovarhotels)$/,
    guidance: "Hospitality interviews emphasize guest-experience obsession, front-of-house composure, and ability to handle crisis moments without losing service polish. Focus on: domain depth (F&B, rooms division, sales, revenue management depending on role), comfort with luxury-brand standards, and behavioral scenarios about turning a complaint into a story.",
  },
  {
    key: "indian_real_estate",
    pattern: /^(dlf|lodhagroup|lodha|godrejproperties|prestigegroup|prestige|sobha|brigadegroup|brigade|phoenixmills|embassygroup|embassy|rmzcorp|mahindralifespaces|tatarealty|piramalrealty|krahejacorp|hiranandani|shapoorjipallonji|macrotechdevelopers|macrotech)$/,
    guidance: "Real estate / developer interviews emphasize project execution discipline, regulatory + approval-process knowledge (RERA, building bye-laws), and customer-trust building under long-cycle decisions. Focus on: depth in the candidate's vertical (residential, commercial, retail, industrial), comfort with channel-partner ecosystems, and behavioral scenarios about handling delays + buyer expectations.",
  },
  {
    key: "indian_auto_oem",
    pattern: /^(tatamotors|mahindra|mahindramahindra|marutisuzuki|hyundaiindia|kiaindia|heromotocorp|bajajauto|tvsmotor|royalenfield|eicher|ashokleyland|forcemotors|mgmotorindia|skodavwindia|toyotaindia|hondaindia|mercedesbenzindia|bmwindia|audiindia|volvoindia|renaultindia|nissanindia|stellantisindia|jaguarlandroverindia)$/,
    guidance: "Automotive OEM interviews emphasize engineering rigor + manufacturing context. Focus on: technical depth in the candidate's domain (powertrain, chassis, electronics, software for connected vehicles, EV battery for newer roles), familiarity with ARAI / BIS norms, and behavioral scenarios about handling quality issues across plants. EV transition talk is the dominant theme post-2023.",
  },
  {
    key: "indian_telecom",
    pattern: /^(jio|reliancejio|airtel|bhartiairtel|vodafoneidea|vi|bsnl|mtnl|jioplatforms|airteldigital|tatacommunications|sterlitetechnologies|tejasnetworks|industowers|bhartihexacom|nokiasiemensnetworksindia)$/,
    guidance: "Telecom interviews emphasize scale + reliability under non-stop traffic. Focus on: technical depth (network engineering, OSS/BSS, 5G stack, IoT for newer roles), comfort with 24/7 incident response, and behavioral scenarios about handling regulatory shifts (TRAI, spectrum auctions). India-scale is the dominant theme — billions of subscribers, sub-second SLAs.",
  },
  {
    key: "indian_civil_services",
    pattern: /^(upsc|indianadministrativeservice|ias|indianforeignservice|ifs|indianpoliceservice|ips|indianrevenueservice|irs|indianforestservice|statepublicservicecommission|ibpspoclerk|sbipo|rbigradeb|nabardgradea|sidbigradea|ssccgl|ssccshsl|indianrailwaysrrb|isroscientist|drdoscientist|barcscientist|tifr|reservebankofindiadirect|npci|uidai)$/,
    guidance: "Civil-services / government-job interviews emphasize values alignment (integrity, impartiality, public service), domain knowledge of governance + current affairs, and stress resilience. Focus on: ability to articulate views on contemporary policy debates without partisan colour, comfort with formal interview settings (panel format, hypothetical ethics scenarios), and motivation that goes beyond compensation.",
  },
];

/** Classify a free-text company name into a type bucket. Returns null if
    no bucket matches (caller falls through to empty guidance). Pure;
    unit-testable in isolation.

    The bucket patterns are alternation lists of normalized name tokens
    (e.g. "upsc|ssccgl|rbigradeb"). Matching rules:

      • Short tokens (≤3 chars, e.g. "ey", "vi", "ias") must match the
        WHOLE normalized input (exact equality). Otherwise short tokens
        false-match — "vi" appears inside "ser-vi-ce" so a UPSC input
        would mis-classify as telecom.
      • Long tokens (≥4 chars) match by substring. "upsc" in
        "upscindianadministrativeservice" → civil-services. */
export function classifyCompanyType(company: string): { key: string; guidance: string } | null {
  if (!company) return null;
  const normalized = company.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  if (!normalized) return null;
  /* Two-stage matching:
     1. Regex test against the full bucket pattern (handles character
        classes like `iit[a-z]*` that don't survive token splitting).
     2. Token substring fallback for partial-name inputs (e.g.
        "Tata Consultancy Services" → "tatconsultancyservices" should
        match the "tatconsultancy" token in the IT-services bucket).
     Pre-fix bug: only stage 2 ran, so "IIT Indore" → "iitindore"
     never matched the regex `iit[a-z]*` because the splitter treated
     `iit[a-z]*` as a literal substring needle. */
  for (const bucket of COMPANY_TYPE_BUCKETS) {
    if (bucket.pattern.test(normalized)) {
      return { key: bucket.key, guidance: bucket.guidance };
    }
  }
  for (const bucket of COMPANY_TYPE_BUCKETS) {
    let src = bucket.pattern.source.replace(/^\^/, "").replace(/\$$/, "");
    if (src.startsWith("(") && src.endsWith(")")) src = src.slice(1, -1);
    const tokens = src.split("|").map((t) => t.trim()).filter(Boolean);
    for (const tok of tokens) {
      /* Skip tokens that contain regex metacharacters — those need
         test() in stage 1. Substring matching only on plain literal
         tokens. */
      if (/[[\](){}.*+?^$\\|]/.test(tok)) continue;
      if (tok.length <= 3) {
        if (normalized === tok) {
          return { key: bucket.key, guidance: bucket.guidance };
        }
      } else {
        if (normalized.includes(tok)) {
          return { key: bucket.key, guidance: bucket.guidance };
        }
      }
    }
  }
  return null;
}

/**
 * Given a free-text company name, return the best-matching guidance entry
 * (key + body) or empty strings if no match.
 *
 * Match priority:
 *   1. EXACT match — normalized name equals an entry key.
 *   2. CONTAINMENT match — both sides ≥4 chars (prevents "EY" from
 *      false-matching "mckinsey" because mckinsey ends in "ey", or
 *      "BCG" from matching "bcgcompanyname" garbage). Critical guard:
 *      "TCS" / "EY" / "BCG" need to find their bespoke entries OR the
 *      type bucket — never a sibling exact entry that happens to
 *      contain the trigram.
 *   3. TYPE-pattern bucket fallback.
 *
 * Kept pure so it's trivially testable — see src/__tests__/roleContentMatch.test.ts.
 */
export function matchCompanyKey(company: string): { key: string; fallback: string } {
  if (!company) return { key: "", fallback: "" };
  const normalized = company.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
  if (!normalized) return { key: "", fallback: "" };

  // 1. Exact match wins immediately.
  if (normalized in COMPANY_GUIDANCE) {
    return { key: normalized, fallback: COMPANY_GUIDANCE[normalized] };
  }
  // 2. Containment — but only when BOTH sides are long enough to make
  //    the match meaningful. Without this guard, short inputs like
  //    "ey" / "bcg" / "tcs" / "ola" hit any guidance key that happens
  //    to contain those trigrams.
  for (const [k, v] of Object.entries(COMPANY_GUIDANCE)) {
    const minLen = Math.min(k.length, normalized.length);
    if (minLen < 4) continue;
    if (normalized.includes(k) || k.includes(normalized)) {
      return { key: k, fallback: v };
    }
  }
  // 3. Type-pattern fallback. Lets every company in the 1,000-entry
  //    autocomplete get reasonable guidance even without a bespoke entry.
  const typeMatch = classifyCompanyType(company);
  if (typeMatch) return { key: typeMatch.key, fallback: typeMatch.guidance };
  return { key: "", fallback: "" };
}
