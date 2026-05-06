/**
 * Role-specific competency briefs. Each value describes: what to test +
 * what real interviewers ask at each level + current industry trends.
 * Used by generate-questions.ts as an in-code fallback when the
 * role_competencies Supabase table has no row for the slug.
 *
 * Extracted from generate-questions.ts to keep that file focused on
 * request handling; this file is pure data + a match helper.
 */

export const ROLE_COMPETENCIES: Record<string, string> = {
  "product-manager": `Test: user empathy, prioritization frameworks (RICE/ICE), metrics-driven decisions, roadmap defense, stakeholder management, go-to-market thinking.
REAL INTERVIEW PATTERNS: Entry→"How would you prioritize these 5 features?", "Define success metrics for X." Mid→"Walk me through a product launch you owned end-to-end.", "How do you say no to a VP?" Senior→"How did you influence company strategy?", "Describe building a product org from scratch."
CURRENT TRENDS (2025-26): AI/ML product integration, PLG (product-led growth), responsible AI principles, India's UPI/fintech ecosystem, regulatory compliance (DPDP Act), vernacular-first product thinking.`,
  "software-engineer": `Test: system design trade-offs, code quality vs speed, debugging methodology, technical communication, architecture decisions.
REAL INTERVIEW PATTERNS: Entry→"Design a URL shortener", "Explain time/space complexity trade-offs", "Walk me through debugging a production issue." Mid→"Design a rate limiter at scale", "How do you handle tech debt vs feature delivery?" Senior→"Design WhatsApp/Swiggy at scale", "How did you drive an architecture migration?"
CURRENT TRENDS (2025-26): AI-assisted development (Copilot/Cursor adoption), LLM integration patterns, event-driven architecture, observability (OpenTelemetry), platform engineering, edge computing, Kubernetes at scale in Indian enterprises.`,
  "engineering-manager": `Test: team scaling, 1:1 coaching, delivery velocity, cross-functional alignment, hiring/firing decisions, technical strategy.
REAL INTERVIEW PATTERNS: Mid→"How do you run effective 1:1s?", "Tell me about managing a low performer." Senior→"How did you scale a team from 5 to 30?", "How do you balance tech debt with delivery?" Lead→"How do you set engineering culture across multiple teams?", "Describe your approach to engineering metrics (DORA)."
CURRENT TRENDS (2025-26): Remote/hybrid team management, developer experience (DX) as a metric, AI-augmented engineering workflows, attrition management in Indian IT (moonlighting policies), GCC (Global Capability Center) culture building.`,
  "data-scientist": `Test: statistical rigor, experiment design (A/B testing), business impact translation, model selection rationale, data storytelling.
REAL INTERVIEW PATTERNS: Entry→"Explain bias-variance trade-off", "Design an A/B test for a checkout flow change." Mid→"How did you move a model from notebook to production?", "Walk me through feature engineering for churn prediction." Senior→"How do you build a data science roadmap?", "Describe scaling ML infra."
CURRENT TRENDS (2025-26): GenAI/LLM fine-tuning, RAG architectures, MLOps maturity, responsible AI, real-time ML serving, India-specific NLP challenges (multi-lingual models), synthetic data generation.`,
  "data-analyst": `Test: SQL proficiency, dashboard design, stakeholder communication, metric definition, root cause analysis.
REAL INTERVIEW PATTERNS: Entry→"Write a SQL query to find top 5 customers by revenue", "What metrics would you track for a food delivery app?" Mid→"How do you handle conflicting data from different sources?", "Walk me through a root cause analysis you did." Senior→"How do you build a self-serve analytics culture?", "Describe designing a company-wide metric framework."
CURRENT TRENDS (2025-26): dbt/modern data stack, real-time dashboards, product analytics (Mixpanel/Amplitude/PostHog), data governance, AI-assisted analysis, reverse ETL, metric layers.`,
  "designer": `Test: design process, user research methodology, design system thinking, stakeholder presentation, accessibility awareness.
REAL INTERVIEW PATTERNS: Entry→"Walk me through your portfolio", "How do you handle design critique?" Mid→"How did you advocate for a design decision with data?", "Describe building a design system component." Senior→"How did you influence product strategy through design?", "How do you scale design across multiple product lines?"
CURRENT TRENDS (2025-26): AI-powered design tools (Figma AI, Galileo), accessibility-first design, vernacular UI for Bharat users, voice UI, conversational design, design tokens, inclusive design for low-bandwidth/low-literacy users.`,
  "marketing": `Test: campaign strategy, channel optimization, ROI measurement, brand positioning, content strategy.
REAL INTERVIEW PATTERNS: Entry→"Plan a launch campaign with ₹5L budget", "How do you measure campaign effectiveness?" Mid→"Walk me through a campaign that failed and what you learned", "How do you allocate budget across channels?" Senior→"How did you build a brand from scratch?", "Describe your approach to marketing attribution."
CURRENT TRENDS (2025-26): AI-generated content, performance marketing on Meta/Google, influencer marketing at scale, WhatsApp marketing, vernacular content strategy, community-led growth, D2C brand building in India.`,
  "sales": `Test: pipeline management, objection handling, relationship building, quota attainment strategy, competitive positioning.
REAL INTERVIEW PATTERNS: Entry→"Role-play: sell me this product", "How do you handle price objections?" Mid→"Walk me through your biggest deal — what was the sales cycle?", "How do you prioritize your pipeline?" Senior→"How did you build a sales playbook?", "Describe entering a new market/territory."
CURRENT TRENDS (2025-26): AI-assisted selling (Gong, Clari), PLG + sales-assist models, value-based selling, enterprise SaaS in India, multi-stakeholder deals, channel partnerships, RevOps alignment.`,
  "consultant": `Test: problem structuring, hypothesis-driven analysis, client management, presentation skills, implementation planning.
REAL INTERVIEW PATTERNS: Entry→"Estimate the market size for electric scooters in India", "Structure: our client's profits are declining — where do you start?" Mid→"Walk me through a project where the client disagreed with your recommendation", "How do you scope a 12-week engagement?" Senior→"How do you sell follow-on work?", "Describe managing a difficult client relationship."
CURRENT TRENDS (2025-26): Digital transformation consulting, AI/GenAI strategy advisory, ESG consulting, India GCC advisory, cloud migration at scale, change management frameworks.`,
  "devops": `Test: CI/CD pipeline design, infrastructure as code, monitoring/alerting, incident management, cloud cost optimization.
REAL INTERVIEW PATTERNS: Entry→"Explain the difference between containers and VMs", "How would you set up a basic CI/CD pipeline?" Mid→"How do you handle zero-downtime deployments?", "Describe your approach to infrastructure as code." Senior→"How did you design a multi-region DR strategy?", "Walk me through reducing cloud spend by 30%."
CURRENT TRENDS (2025-26): Platform engineering, GitOps, FinOps, Kubernetes operators, SRE practices, AI for AIOps, observability (OpenTelemetry), shift-left security.`,
  "business-analyst": `Test: requirements gathering, process mapping, stakeholder communication, data analysis, solution evaluation.
REAL INTERVIEW PATTERNS: Entry→"How do you gather requirements from a non-technical stakeholder?", "Create a user story for X." Mid→"Walk me through translating business requirements to technical specs", "How do you handle scope creep?" Senior→"How do you drive digital transformation in a legacy organization?", "Describe aligning IT and business strategy."
CURRENT TRENDS (2025-26): Agile BA practices, AI-augmented analysis, process mining, low-code/no-code platforms, India's digital public infrastructure (UPI, ONDC, DigiLocker).`,
  "qa": `Test: test strategy, automation frameworks, defect management, CI integration, performance testing.
REAL INTERVIEW PATTERNS: Entry→"What's the difference between smoke and regression testing?", "Write a test case for a login page." Mid→"How do you build an automation framework from scratch?", "Describe your approach to API testing." Senior→"How do you build a quality culture?", "Walk me through shift-left testing in your org."
CURRENT TRENDS (2025-26): AI test generation, visual regression testing, contract testing, chaos engineering, performance engineering, mobile testing in fragmented Android landscape (India-specific).`,
  "hr": `Test: talent acquisition, employee engagement, policy design, conflict resolution, culture building.
REAL INTERVIEW PATTERNS: Entry→"How would you handle a candidate who ghosts after accepting an offer?", "Describe your approach to screening resumes." Mid→"How do you design an employee engagement program?", "Walk me through handling a harassment complaint." Senior→"How did you build an employer brand?", "Describe designing a compensation philosophy."
CURRENT TRENDS (2025-26): AI in recruitment, skills-based hiring, hybrid work policies, DEI programs, gig workforce management, POSH compliance, moonlighting policies in Indian IT, ESOPs/sweat equity structuring.`,
  "ml-engineer": `Test: model training pipelines, feature engineering, model serving/deployment, experiment tracking, ML system design.
REAL INTERVIEW PATTERNS: Entry→"Explain gradient descent", "How would you handle class imbalance?", "Walk me through an end-to-end ML pipeline." Mid→"How did you reduce model inference latency by 50%?", "Design a recommendation system for an e-commerce platform", "How do you handle model drift in production?" Senior→"How do you build an ML platform team?", "Describe a model that directly impacted revenue", "How do you decide build vs. buy for ML infrastructure?"
CURRENT TRENDS (2025-26): LLM fine-tuning (LoRA/QLoRA), RAG pipelines, MLOps (MLflow, Kubeflow, Weights & Biases), vector databases, responsible AI/model governance, edge ML deployment, multi-modal models, India-specific multilingual NLP (IndicBERT, AI4Bharat).`,
  "ai-engineer": `Test: LLM integration, prompt engineering, AI system architecture, evaluation frameworks, production AI systems, agent design, tool-use and MCP.
REAL INTERVIEW PATTERNS: Entry→"Explain transformers vs RNNs", "How would you build a chatbot using an LLM API?", "What is RAG and when would you use it?" Mid→"Design an AI-powered document processing pipeline", "How do you evaluate LLM outputs for production use? (LLM-as-judge, golden datasets, A/B harnesses)", "Walk me through reducing hallucinations in a deployed system", "Build an agent that books flights — how do you handle tool failures and partial state?" Senior→"How do you architect a multi-agent AI system with handoffs?", "Describe building an AI platform that serves 10+ product teams", "How do you handle AI safety, content moderation, and prompt injection at scale?", "Walk me through cost-managing a system that does 100M LLM calls/day."
CURRENT TRENDS (2026): Agentic systems are now table-stakes (single-shot LLM calls feel dated); MCP / tool-use protocols, structured outputs, evals as first-class engineering (LangSmith, Braintrust, Langfuse, in-house judge models), prompt-injection defense, on-device inference (Apple Intelligence, Gemini Nano), small specialized models (3B-7B fine-tunes beating GPT-4 on narrow tasks), Indic LLM ecosystem (Sarvam, Krutrim, Nanonets), India's DPDP Act + emerging AI governance framework, RAG → agentic-RAG, synthetic data + distillation as a deployment pattern. Hot signal: candidates who ship eval harnesses, not those who can recite transformer math.`,
  "cloud-engineer": `Test: cloud architecture (AWS/Azure/GCP), networking, security, cost optimization, migration planning.
REAL INTERVIEW PATTERNS: Entry→"Explain the difference between IaaS, PaaS, and SaaS", "How would you design a VPC?", "What is the shared responsibility model?" Mid→"Design a multi-account AWS strategy for a fintech", "How did you migrate a workload from on-prem to cloud?", "Walk me through a cloud cost optimization you led." Senior→"How do you design a multi-cloud strategy?", "Describe architecting for compliance (RBI, DPDP Act)", "How did you build a cloud center of excellence?"
CURRENT TRENDS (2025-26): Multi-cloud strategies, FinOps maturity, serverless at scale, cloud-native security (CNAPP), India data residency requirements, GCC cloud infrastructure, Kubernetes-as-a-service, cloud sustainability metrics.`,
  "cto": `Test: technology vision, organizational design, board communication, build-vs-buy decisions, engineering culture, technical due diligence.
REAL INTERVIEW PATTERNS: "How do you set a 3-year technology roadmap?", "Describe a time you killed a major initiative — why and how?", "How do you communicate technical risk to non-technical board members?", "Walk me through building an engineering org from 10 to 100+", "How do you evaluate M&A targets from a technology perspective?", "How do you balance innovation with reliability?"
CURRENT TRENDS (2025-26): AI/GenAI strategy for enterprises, platform engineering as a discipline, developer experience (DX), engineering efficiency metrics, India GCC strategy, responsible tech leadership, cybersecurity at board level, open-source strategy.`,
  "vp-engineering": `Test: org design, engineering strategy, cross-functional leadership, scaling teams, delivery at scale, executive communication.
REAL INTERVIEW PATTERNS: "How did you scale engineering from 50 to 200?", "Describe aligning engineering priorities with business OKRs", "How do you handle underperforming engineering managers?", "Walk me through your approach to engineering budgeting", "How do you drive cultural change across a distributed engineering org?", "Describe a bet you made on a technology that paid off (or didn't)."
CURRENT TRENDS (2025-26): AI-augmented SDLC, DORA metrics adoption, platform engineering investment, remote/hybrid team scaling, India GCC leadership, engineering brand building, attrition management (25-30% annual in Indian tech).`,
  "tech-lead": `Test: technical decision-making, code review philosophy, mentoring, architecture ownership, delivery balance.
REAL INTERVIEW PATTERNS: Entry→"How do you decide between two competing technical approaches?", "Describe your code review philosophy." Mid→"How do you unblock a team stuck on a technical problem?", "Walk me through an architecture decision you owned", "How do you balance hands-on coding with leadership?" Senior→"How do you set technical direction for a product area?", "Describe mentoring a junior engineer into a senior role."
CURRENT TRENDS (2025-26): AI pair programming (GitHub Copilot, Cursor), technical debt quantification, architecture decision records (ADRs), inner-source practices, tech lead as force multiplier (not just best coder).`,
  "program-manager": `Test: cross-functional coordination, risk management, stakeholder communication, program governance, dependency management.
REAL INTERVIEW PATTERNS: Entry→"How do you create a project plan for a 6-month initiative?", "Walk me through managing competing stakeholder priorities." Mid→"Describe managing a program with 5+ dependent workstreams", "How do you escalate risks without losing stakeholder trust?" Senior→"How do you design a PMO for a 200-person org?", "Walk me through a program recovery — what was failing and how did you fix it?"
CURRENT TRENDS (2025-26): Agile at scale (SAFe, LeSS), OKR-driven program management, AI-assisted project tracking, cross-geo program management (India + US), data-driven retrospectives.`,
  "data-engineer": `Test: data pipeline design, data modeling, data quality, ETL/ELT patterns, data warehouse architecture.
REAL INTERVIEW PATTERNS: Entry→"Explain star schema vs snowflake", "How would you design a pipeline to process 1TB of daily clickstream data?" Mid→"How do you handle schema evolution in a data lake?", "Walk me through debugging a data quality issue that affected dashboards", "Design a real-time streaming pipeline." Senior→"How do you build a data platform for a company going from 10 to 100 data consumers?", "Describe your approach to data governance at scale."
CURRENT TRENDS (2025-26): Modern data stack (dbt, Fivetran, Snowflake), real-time streaming (Kafka, Flink), data mesh/data products, lakehouse architecture, data contracts, cost optimization (Snowflake/Databricks), data observability.`,
  "mobile-developer": `Test: mobile architecture patterns (MVVM/MVI), performance optimization, platform-specific knowledge, offline-first design, app store deployment.
REAL INTERVIEW PATTERNS: Entry→"Explain the Activity/Fragment lifecycle", "How do you handle memory leaks in Android/iOS?" Mid→"Design the architecture for a food delivery app", "How do you handle offline sync?", "Walk me through optimizing app startup time." Senior→"How do you design a mobile platform used by 10+ feature teams?", "Describe migrating from native to cross-platform (or vice versa)."
CURRENT TRENDS (2025-26): Kotlin Multiplatform, Jetpack Compose/SwiftUI adoption, React Native new architecture, Flutter at scale, mobile CI/CD, India-specific challenges (low-end devices, 2G/3G networks, multilingual support), super-app patterns.`,
  "frontend-developer": `Test: component architecture, state management, performance optimization, accessibility, responsive design, build tooling.
REAL INTERVIEW PATTERNS: Entry→"Explain the virtual DOM", "How do you handle state in a complex React app?" Mid→"Design the frontend architecture for a dashboard with 50+ charts", "How do you optimize Core Web Vitals?", "Walk me through a complex form with validation." Senior→"How do you build a design system used by 5 teams?", "Describe migrating a large codebase from one framework to another."
CURRENT TRENDS (2025-26): Server components (Next.js RSC), micro-frontends, Web Components, AI-assisted UI development, edge rendering, Astro/Remix adoption, performance budgets, WCAG 2.2 compliance.`,
  "backend-developer": `Test: API design, database selection, scalability patterns, security, distributed systems.
REAL INTERVIEW PATTERNS: Entry→"Design a RESTful API for a todo app", "Explain ACID properties", "How do you handle authentication?" Mid→"Design a rate limiter", "How do you handle database migrations with zero downtime?", "Walk me through debugging a performance bottleneck." Senior→"Design a payment processing system", "How do you handle eventual consistency?", "Describe a microservices decomposition you led."
CURRENT TRENDS (2025-26): gRPC adoption, event sourcing/CQRS, serverless (Lambda/Cloud Functions), database-per-service, API gateways, India-specific (UPI integration, RBI compliance for fintech), Go/Rust adoption for high-performance services.`,
  "finance": `Test: financial modeling, valuation, due diligence, regulatory compliance, stakeholder reporting.
REAL INTERVIEW PATTERNS: Entry→"Walk me through a DCF model", "How do you evaluate a company's creditworthiness?", "Explain the three financial statements." Mid→"Build a financial model for a SaaS company", "How do you present variance analysis to the CFO?", "Walk me through an M&A deal you worked on." Senior→"How do you design an FP&A function from scratch?", "Describe managing treasury for a company with multi-currency exposure."
CURRENT TRENDS (2025-26): AI in financial analysis, ESG reporting frameworks, India's new Companies Act compliance, GST automation, UPI/digital payment infrastructure, IFRS convergence, FinOps for tech companies.`,
  "legal": `Test: contract drafting, regulatory compliance, risk assessment, corporate governance, dispute resolution.
REAL INTERVIEW PATTERNS: Entry→"Review this NDA and identify the key risks", "Explain the difference between indemnity and warranty." Mid→"How do you handle a data breach notification under DPDP Act?", "Walk me through structuring a cross-border transaction." Senior→"How do you build a legal team for a scaling startup?", "Describe advising the board on a regulatory crisis."
CURRENT TRENDS (2025-26): Data privacy (DPDP Act 2023), AI regulation, ESG compliance, startup legal ops (ESOP structuring, cap table management), India's arbitration reforms, cross-border data transfers.`,
  "operations": `Test: process optimization, supply chain management, vendor management, cost reduction, operational metrics.
REAL INTERVIEW PATTERNS: Entry→"How would you improve the delivery time for an e-commerce order?", "Walk me through a process improvement you implemented." Mid→"How do you manage 50+ vendors across 10 cities?", "Describe reducing operational costs by 20% without compromising quality." Senior→"How do you design operations for a new geography launch?", "Walk me through scaling operations from 100 to 10,000 orders/day."
CURRENT TRENDS (2025-26): AI/automation in operations, dark stores/quick commerce, last-mile delivery optimization, India's logistics infrastructure (PM Gati Shakti), sustainability in supply chain, drone delivery pilots.`,
  "customer-success": `Test: client relationship management, churn prevention, expansion revenue, health scoring, stakeholder communication.
REAL INTERVIEW PATTERNS: Entry→"A customer hasn't logged in for 30 days. What do you do?", "How do you run an effective QBR?" Mid→"Describe turning around a churning enterprise account", "How do you build a customer health score?", "Walk me through an upsell conversation." Senior→"How do you build a CS org from scratch?", "Describe designing a customer journey for a PLG product."
CURRENT TRENDS (2025-26): AI-powered customer health scoring, product-led CS, community-led growth, outcome-based CSM, India's SaaS boom (customer success in Indian B2B SaaS), digital-first CS playbooks.`,
  "content-writer": `Test: writing quality, SEO understanding, audience research, content strategy, editorial process.
REAL INTERVIEW PATTERNS: Entry→"Write a 200-word blog intro on [topic]", "How do you research a topic you know nothing about?" Mid→"How do you build a content calendar?", "Walk me through an SEO content strategy that drove results." Senior→"How do you build a content team?", "Describe designing a content strategy that aligned with business goals."
CURRENT TRENDS (2025-26): AI-assisted writing (ChatGPT/Claude), SEO in the age of AI search, video/short-form content, vernacular content for Indian markets, UX writing as a discipline, thought leadership content.`,
  "cybersecurity": `Test: threat modeling, incident response, security architecture, compliance frameworks, vulnerability management.
REAL INTERVIEW PATTERNS: Entry→"Explain OWASP Top 10", "How do you respond to a phishing incident?", "What's the difference between symmetric and asymmetric encryption?" Mid→"Design a security architecture for a fintech startup", "Walk me through an incident response you led", "How do you implement zero-trust?" Senior→"How do you build a security program for a 500-person company?", "Describe managing security for a company going through SOC 2/ISO 27001 certification."
CURRENT TRENDS (2025-26): Zero-trust architecture, AI-powered threat detection, cloud security posture management (CSPM), India's CERT-In directives (6-hour incident reporting), API security, supply chain security, ransomware preparedness.`,
  "teacher": `Test: teaching methodology, student engagement, assessment design, classroom management, curriculum development.
REAL INTERVIEW PATTERNS: Entry→"How do you handle a class with mixed learning levels?", "Design a lesson plan for [topic]." Mid→"How do you integrate technology into your teaching?", "Walk me through handling a parent complaint." Senior→"How do you design a curriculum for a new course?", "Describe leading a department-wide pedagogical shift."
CURRENT TRENDS (2025-26): Hybrid learning models, AI in education (adaptive learning), NEP 2020 implementation, competency-based assessment, flipped classroom, gamification, EdTech integration in Indian schools/colleges.`,
  "scrum-master": `Test: agile facilitation, impediment removal, team coaching, process improvement, stakeholder management.
REAL INTERVIEW PATTERNS: Entry→"How do you run an effective sprint retrospective?", "What's the difference between Scrum Master and Project Manager?" Mid→"How do you handle a team that resists agile?", "Describe removing a systemic impediment", "How do you coach a product owner on backlog management?" Senior→"How do you scale agile across 10+ teams?", "Describe implementing SAFe or LeSS in an organization."
CURRENT TRENDS (2025-26): Agile at scale (SAFe 6.0), flow metrics over velocity, continuous delivery practices, agile in non-tech teams, OKR integration with agile, remote agile ceremonies.`,
  // ─── Writing / Editorial / Comms ───
  "technical-writer": `Test: writing clarity, ability to interview SMEs, doc architecture, tooling fluency, sense of audience.
REAL INTERVIEW PATTERNS: Entry→"Document this API endpoint from this code", "Rewrite this confusing changelog entry." Mid→"How would you restructure a 500-page docs site?", "Walk me through interviewing an engineer for a complex feature." Senior→"How do you build a docs strategy that scales with engineering?", "Describe a docs metric you actually moved (time-to-first-success, ticket deflection)."
CURRENT TRENDS (2026): Docs-as-code (MDX, Docusaurus, Mintlify), AI doc generation + human curation (writers shifting to editors of AI drafts), API-driven docs (OpenAPI → docs), interactive examples, doc-site SEO in the AI-search era (LLMs cite docs that are well-structured), evals for AI-generated content, writing for both human readers and LLM ingestion (llms.txt, structured data).`,
  "ux-writer": `Test: tone calibration, microcopy precision, voice consistency, working without context, defending word-level decisions.
REAL INTERVIEW PATTERNS: Entry→"Rewrite this error message", "Describe your tone-of-voice framework." Mid→"Walk me through a flow you rewrote — what changed and how did you measure it?", "How do you handle PMs who write copy?" Senior→"How did you build a content design system?", "Describe scaling content design across 5 product teams."
CURRENT TRENDS (2026): Content design as separate discipline from UX design, AI-assisted draft + human polish, conversational AI copy, voice/audio UI, vernacular content for Indian users, design tokens for words, content design at the IA layer not just polish.`,
  "copywriter": `Test: idea generation, audience insight, brand voice, conceptual thinking, ability to defend ideas.
REAL INTERVIEW PATTERNS: Entry→"Pitch me on this brief in 3 ideas", "Write 5 headlines for [product]." Mid→"Walk me through a campaign you wrote — what was the insight?", "How do you handle client revisions that flatten the work?" Senior→"How do you build a creative team's voice?", "Describe a campaign that flopped and what you learned."
CURRENT TRENDS (2026): AI-generated drafts (writers as curators/editors), performance-creative iteration cycles (write 50 variants, A/B them), short-form vertical video scripts (Reels/Shorts/Stories now dominant), Indic language copy, brand-voice as a system (not "the writer's vibe"), accountability via creative-effectiveness metrics.`,
  "screenwriter": `Test: structure (3-act, beat sheet), character voice, dialogue, theme, ability to take notes.
REAL INTERVIEW PATTERNS: Entry→"Pitch me a logline for a thriller set in Bangalore", "Walk through this scene — what's the subtext?" Mid→"Describe a draft you rewrote 8+ times — what changed?", "How do you handle a director's notes that contradict the showrunner's?" Senior→"Describe building a writers' room", "How do you adapt source material without losing what made it work?"
CURRENT TRENDS (2026): OTT (Netflix India, Prime Video, JioHotstar, ZEE5) demand for episodic Indian-language content, vertical-format short-form drama (TVF, Pocket Aces evolved into platforms), AI-assisted brainstorming + structure tools (still controversial in writers' rooms post-2023 strikes), data-informed development (audience signal vs creative integrity).`,
  "creative-director": `Test: portfolio depth, ability to articulate creative philosophy, team-building, client/stakeholder navigation, taste defended with reasoning.
REAL INTERVIEW PATTERNS: Senior→"Walk me through the campaign you're proudest of — what was the brief, the insight, the output?", "How do you handle a CMO who keeps adding logos?", "Describe building a creative team from 3 to 20", "How do you balance brand consistency with platform-native creative?", "Tell me about a campaign that failed — would you do it again?"
CURRENT TRENDS (2026): AI as creative collaborator (Midjourney, Sora, Runway, Veo), 100x output expectations from clients (vs 1 hero film + cutdowns), brand-AI guidelines (training models on brand, owned likeness), short-form vertical-first creative briefs, festival jury fatigue (effectiveness > craft awards), agency-vs-in-house tension as brands build internal studios.`,
  "art-director": `Test: visual craft, conceptual thinking, type/image/composition fluency, ability to direct illustrators/photographers/CGI artists, brand-system thinking.
REAL INTERVIEW PATTERNS: Entry→"Critique this layout", "Walk me through your typography choices in this piece." Mid→"How did you direct a photoshoot end-to-end?", "Describe a brand identity you owned — what was the system?" Senior→"How do you scale visual identity across 20+ markets?", "Describe rebranding a heritage brand without alienating loyalists."
CURRENT TRENDS (2026): Generative-AI-assisted art direction (model selection, prompt curation, visual consistency across hundreds of assets), motion-first identities (logos that move), 3D/CGI as default, accessibility in visual systems, Indic typography revival (Devanagari/Tamil display type), platform-native creative (Reels-first, not "made for film, recut for Reels").`,
  // ─── Design specialisations (additions) ───
  "industrial-designer": `Test: form, function, manufacturing constraints, materials science, design-for-X (assembly, sustainability, repair), prototyping fluency.
REAL INTERVIEW PATTERNS: Entry→"Critique this product's form", "Walk me through prototyping decisions on a project." Mid→"Describe a project where manufacturing constraints forced a redesign", "How do you balance cost vs. user experience?" Senior→"How do you build a design language across a product family?", "Describe shipping a product from concept to factory floor."
CURRENT TRENDS (2026): India's manufacturing push (PLI schemes), sustainable materials, EV form factors (Ola, Ather, Vida), generative design tools (Autodesk, Fusion AI), digital twins, "Make in India" brand consciousness in product design, repairability-as-a-spec.`,
  "ux-researcher": `Test: methodology selection, recruiting, synthesis, stakeholder communication, research-into-action.
REAL INTERVIEW PATTERNS: Entry→"Design a research plan for understanding why users abandon a checkout", "How do you recruit 12 users for a usability test on a deadline?" Mid→"Walk me through synthesis from 20 interviews — how do you not bias yourself?", "How do you handle a PM who dismisses your findings?" Senior→"How do you build a research practice from zero?", "Describe a study that changed product strategy."
CURRENT TRENDS (2026): AI-assisted synthesis (Dovetail, Notably, Marvin) — researchers shift from coders to interpreters, mixed-methods (qual + quant + behavioral data), continuous discovery (Teresa Torres' approach now mainstream), Bharat user research (rural, vernacular, low-literacy), ethical AI research, ResearchOps as a function.`,
  // ─── HR / Talent specialisations ───
  "recruiter": `Test: sourcing creativity, candidate-experience design, hiring-manager partnership, closing skills, market intelligence.
REAL INTERVIEW PATTERNS: Entry→"Where would you source a senior backend engineer in Bangalore?", "Walk me through a tough close." Mid→"How did you reduce time-to-hire from 60 to 30 days?", "Describe handling a hiring manager who keeps moving the bar." Senior→"How did you build an in-house TA function from scratch?", "Walk me through workforce planning for hypergrowth."
CURRENT TRENDS (2026): AI-assisted sourcing (LinkedIn Recruiter AI, hireEZ, Gem), structured interviews + scorecards (vs. gut feel), candidate-experience as employer brand, async first-round interviews (Hireflix-style), hiring for AI fluency in non-AI roles, India's GCC hiring boom + counter-offer culture.`,
  // ─── Govt / Civil Services ───
  "ias": `Test: general awareness, ethics + integrity, public administration knowledge, decision-making under pressure, service motivation.
REAL INTERVIEW PATTERNS: UPSC personality test (PT) format → "Why IAS over IFS?", "Tell me about a current event from your home state and your view", "If you were collector and X happened, what would you do?", ethical dilemmas (corruption, populism vs prudence), questions on optionals + DAF.
CURRENT TRENDS (2026): India's digital public infrastructure (UPI, ONDC, DigiLocker, Aadhaar) as administrative tools, climate adaptation policy, federalism debates post-2024 GE, urbanization stress (smart cities), AI in governance (Bhashini, AI for crop insurance), public-finance reforms (GST 2.0, capex push).`,
  // ─── Healthcare specialisations ───
  "doctor": `Test: clinical reasoning, ethical decision-making, communication with patients, breadth of medical knowledge, current literature awareness.
REAL INTERVIEW PATTERNS: Entry→"Walk me through differential diagnosis for [presenting symptom]", "How do you break bad news to a family?" Mid→"Describe a clinical decision you reversed", "How do you handle a patient who refuses recommended treatment?" Senior→"How do you build a department's clinical protocols?", "Describe a quality-improvement initiative you led."
CURRENT TRENDS (2026): AI diagnostic copilots (Qure.ai, Niramai, SigTuple), point-of-care AI (radiology, pathology), DPDP Act for patient data, telemedicine maturity post-COVID, clinical AI governance, NMC reforms, India's organ donation push, mental-health integration in primary care.`,
  // ─── Government / Civil Services / Defence (additions) ───
  "ips": `Test: law-and-order judgment, ethics, leadership under pressure, stakeholder communication (political / public / media), integrity tests.
REAL INTERVIEW PATTERNS: UPSC PT format → "Why IPS over IAS?" "You've raided a politician's residence and found nothing — what next?" "How do you handle pressure from a senior IAS officer who wants you to drop a case?" Concrete instances of leadership / handling tense situations from candidate's life.
CURRENT TRENDS (2026): Cyber crime as central pillar of policing, women's safety frameworks post-Nirbhaya/MahilaThaana, social-media handling for police comms, AI in surveillance + civil liberties, Police Reforms Commission recommendations.`,
  "rbi-grade-b": `Test: monetary policy + financial markets fluency, regulatory awareness, descriptive writing under time pressure, quantitative reasoning.
REAL INTERVIEW PATTERNS: Phase II ESI/F&M descriptive papers → "Discuss the trade-offs between financial inclusion and macroprudential stability." Phase III interview → "Diagnose why credit transmission is weak in MSMEs despite repo cuts." "Walk me through what happens to my CASA deposit when RBI changes CRR."
CURRENT TRENDS (2026): UPI saturation + cross-border UPI rollouts, CBDC (e-Rupee) pilot expansion, climate-risk financial disclosures, BNPL regulation, account aggregator framework, ARC (asset reconstruction) cleanup post-IBC.`,
  "ssc": `Test: general awareness, English / quant aptitude, behavioural fit (especially for SSC CGL Tier IV / Skill Test stages), willingness to handle clerical workload.
REAL INTERVIEW PATTERNS: Mostly tier-based written + skill-test. The interview/document-verification stage has light HR probes — "Why government over private?", "Are you willing to be posted in <state>?", "What's your plan if not selected this year?".
CURRENT TRENDS (2026): SSC CGL pattern stable post-2023 reform; new skills test in some posts; Hindi-medium candidates gaining ground; AI-driven aptitude prep apps changing the cut-off curve.`,
  "defence-scientist": `Test: M.Tech/PhD thesis depth, lab-specific domain knowledge, willingness for classified work + relocation, viva-style technical articulation.
REAL INTERVIEW PATTERNS: DRDO entry-tech viva → "Walk me through your thesis. What didn't work?" "Why this lab specifically (RCI / ADA / LRDE / DRDL)?" "Design a guidance algorithm for a ground-launched intercept missile — what sensors, why?"
CURRENT TRENDS (2026): AI/ML in defence (autonomous swarms, edge-AI sensors), indigenisation push (PLI for defence), agnipath impact on entry-level scientist roles, hypersonic + space-defence research priorities.`,
  // ─── ESG / Sustainability ───
  "esg-analyst": `Test: ESG framework fluency (GRI, SASB, TCFD), data collection methodology, materiality assessment, regulatory tracking, financial-impact translation.
REAL INTERVIEW PATTERNS: Entry→"Walk through a materiality matrix you'd build for a cement company", "Explain Scope 1/2/3 emissions." Mid→"How do you handle data quality issues in ESG reporting?", "Describe an engagement with a portfolio company on climate disclosure." Senior→"How would you build an ESG team for a $1B asset manager?", "Describe navigating greenwashing accusations."
CURRENT TRENDS (2026): India's BRSR (Business Responsibility & Sustainability Reporting) Core mandatory for top 1,000 listed companies, climate-risk financial disclosures, supply-chain emissions (Scope 3), ISSB standards adoption, EU CBAM (Carbon Border Adjustment Mechanism) impact on Indian exporters, biodiversity reporting, just-transition narratives.`,
};

/**
 * Match a free-text role description to the best ROLE_COMPETENCIES key.
 *
 * Pure function — tested in src/__tests__/roleContentMatch.test.ts.
 *
 * Scoring (highest wins; ties broken by key length, then by definition
 * order):
 *   • +100  exact whole-key substring match ("ux-writer" → "ux writer"
 *     normalises to a substring match against "ux writer" / "uxwriter")
 *   • +10   per matched dash-part of the key, but ONLY when ALL parts
 *     of a multi-part key match. (Single-part key → +10 if the part
 *     is present.)
 *
 * This replaces a previous first-match-wins loop that silently routed
 * "UX Writer" → "technical-writer" (because "writer" is a part of
 * "technical-writer" and that key happens to come earlier in the
 * map). The bug corrupted prompts for ~5 roles added in 2026-Q2.
 */
export function matchRoleKey(role: string): { key: string; fallback: string } {
  if (!role) return { key: "", fallback: "" };
  const lower = role.toLowerCase();
  // Normalise dashes/spaces so "ux-writer" and "ux writer" both work
  // as needles when checked against haystack "lower".
  const normalisedHaystack = lower.replace(/[\s-]+/g, " ").trim();

  let best: { key: string; value: string; score: number } | null = null;
  for (const [key, value] of Object.entries(ROLE_COMPETENCIES)) {
    const keyAsPhrase = key.replace(/-/g, " ");
    const parts = key.split("-").filter(Boolean);
    let score = 0;
    if (normalisedHaystack.includes(keyAsPhrase)) score += 100;
    // Multi-part key: every part must appear (otherwise we'd recreate
    // the original false-positive bug). Single-part: just the part.
    const allPartsPresent = parts.every((p) => normalisedHaystack.includes(p));
    if (allPartsPresent) score += 10 * parts.length;
    if (score === 0) continue;
    // Prefer higher score, then longer key (more specific), then
    // earlier-defined (stable order).
    if (
      !best ||
      score > best.score ||
      (score === best.score && key.length > best.key.length)
    ) {
      best = { key, value, score };
    }
  }
  return best ? { key: best.key, fallback: best.value } : { key: "", fallback: "" };
}
