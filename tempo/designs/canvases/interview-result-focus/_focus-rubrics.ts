/* HireStepX — Focus-aware result rubrics (DESIGN SPEC ONLY)
 *
 * Source-of-truth for what to evaluate in each interview-focus type.
 * Canvas-only: this file lives under tempo/designs/canvases/ and is
 * NOT imported by production code. When the production system absorbs
 * this rubric, it'll port to a sibling file under data/ and the
 * generate-questions / evaluate-session prompts get focus-aware.
 *
 * Each rubric defines:
 *   • skillAxes — 5-6 named skills graded 0-100, render as bars
 *   • metricsStrip — 4 quick-glance numerics shown under each question
 *   • redFlagCatalog — pre-canned coaching observations the LLM picks
 *     from when grading; each has a title + explanation template
 *   • followUpHints — "the next question they'd press on" prompts
 *   • verdictHeadings — band-specific framing (strong vs weak)
 *
 * Why this exists separately: each focus has fundamentally different
 * evaluation criteria. The current production system grades everything
 * against the same Communication/Structure/Leadership/TechDepth/
 * ProblemSolving axes which is wrong for technical (where correctness
 * + complexity matter) and salary-neg (where anchoring + package
 * depth matter). This file fixes that.
 */

export type FocusKey =
  | "behavioral"
  | "technical"
  | "case-study"
  | "salary-negotiation"
  | "system-design"
  | "hr"
  | "campus-placement"
  | "panel"
  | "strategic"
  | "government";

export interface SkillAxis {
  /** Display label, mono uppercase in UI. */
  label: string;
  /** Tooltip / longer description. */
  description: string;
  /** Cohort comparison anchor — typical mid-band score for normalisation. */
  benchmarkP50?: number;
}

export interface MetricTile {
  label: string;
  /** "count" | "percent" | "duration" | "currency" | "boolean" */
  format: "count" | "percent" | "duration" | "currency" | "boolean";
  /** When low values are bad, set tone: "high-good"; reverse for "low-good".
   *  Drives the colour the value renders in (sage when good, ember when bad). */
  tone: "high-good" | "low-good" | "neutral";
  /** Human-readable description for the tooltip. */
  description: string;
}

export interface RedFlagTemplate {
  type: string;
  title: string;
  /** Template — `{{evidence}}` substituted with the LLM's quote. */
  explanation: string;
}

export interface FocusRubric {
  focus: FocusKey;
  /** What this rubric evaluates, one sentence — surfaced as the
   *  "Why we're scoring this way" tooltip. */
  evaluationStatement: string;
  skillAxes: SkillAxis[];
  metricsStrip: MetricTile[];
  redFlagCatalog: RedFlagTemplate[];
  followUpHints: string[];
  /** Band-specific section headings. */
  verdictHeading: {
    strong: string;
    partial: string;
    weak: string;
  };
}

/* ─── BEHAVIORAL ────────────────────────────────────────────────── */
export const BEHAVIORAL_RUBRIC: FocusRubric = {
  focus: "behavioral",
  evaluationStatement:
    "Behavioral interviews grade specificity, ownership, and outcome over polished delivery. Real interviewers are listening for what YOU specifically did and what measurable change resulted.",
  skillAxes: [
    { label: "Specificity", description: "Concrete dates, places, names, numbers vs abstract language ('once at my company')." },
    { label: "Ownership", description: "I-pronoun ratio in the Action section — your contribution, not the team's." },
    { label: "Outcome", description: "Did you close the loop with a measurable result or stakeholder quote?" },
    { label: "Self-reflection", description: "Mention of what you'd do differently demonstrates learning capacity." },
    { label: "STAR coherence", description: "All four parts present and proportional — Action carries the most weight." },
    { label: "Action depth", description: "How much of the answer was the specific actions you took (vs setup or result)." },
  ],
  metricsStrip: [
    { label: "Words", format: "count", tone: "neutral", description: "Total answer length." },
    { label: "First-person", format: "percent", tone: "high-good", description: "I vs we ratio in the Action section." },
    { label: "Specifics", format: "count", tone: "high-good", description: "Concrete date/place/number/name references." },
    { label: "STAR coverage", format: "percent", tone: "high-good", description: "How many of S/T/A/R were present and substantive." },
  ],
  redFlagCatalog: [
    { type: "vague-situation", title: "Situation was abstract", explanation: "You opened with '{{evidence}}' — interviewers want a date, a place, a project name. Anchor the listener in time and place." },
    { type: "all-we-no-i", title: "All 'we', no 'I'", explanation: "You used 'we' {{evidence}} times and 'I' {{evidence}} times in the Action section. Hiring you, not your team — show what YOU specifically did." },
    { type: "no-result-metric", title: "No outcome metric", explanation: "The Result didn't include a number or measurable change. '{{evidence}}' lands harder with '...which cut deploy time from 45 to 12 minutes.'" },
    { type: "missed-reflection", title: "No 'what I learned'", explanation: "Strong candidates close with a one-line reflection. What you'd do differently is itself a signal of growth." },
    { type: "story-too-long", title: "Story ran long", explanation: "Behavioral answers land best at 90-120 seconds. Yours was {{evidence}}s — interviewer attention drops past 90s." },
  ],
  followUpHints: [
    "What would you do differently if you had to do it over again?",
    "What did your manager say afterwards?",
    "What was the specific action that turned things around?",
  ],
  verdictHeading: {
    strong: "Why this answer landed",
    partial: "What was strong, what to tighten",
    weak: "Why this scored low",
  },
};

/* ─── TECHNICAL ─────────────────────────────────────────────────── */
export const TECHNICAL_RUBRIC: FocusRubric = {
  focus: "technical",
  evaluationStatement:
    "Technical rounds grade approach progression and trade-off articulation, not just correctness. Optimal-on-the-first-try is suspicious; brute-force-then-optimize is the preferred signal.",
  skillAxes: [
    { label: "Approach progression", description: "Brute force named first, then optimization. Top candidates DON'T jump to optimal." },
    { label: "Complexity stated", description: "Time and space complexity articulated explicitly with Big-O." },
    { label: "Edge cases", description: "Empty input, single element, overflow, negatives, duplicates discussed." },
    { label: "Communication", description: "Talking through reasoning while writing code — not silent typing." },
    { label: "Trade-offs", description: "Defended the chosen approach against the rejected one." },
    { label: "Test thinking", description: "Mentioned how they'd test their solution." },
  ],
  metricsStrip: [
    { label: "Approaches", format: "count", tone: "high-good", description: "Number of approaches discussed before picking one." },
    { label: "Complexity", format: "boolean", tone: "high-good", description: "Time + space complexity explicitly stated." },
    { label: "Edge cases", format: "count", tone: "high-good", description: "Distinct edge cases addressed." },
    { label: "Test cases", format: "count", tone: "high-good", description: "Tests proposed for the solution." },
  ],
  redFlagCatalog: [
    { type: "skipped-brute-force", title: "Jumped to optimal", explanation: "You went straight to '{{evidence}}' without naming a brute force first. Some interviewers read this as rehearsed answers." },
    { type: "no-complexity", title: "Didn't state complexity", explanation: "Strong candidates always state O(...) for their final solution. Yours wasn't articulated." },
    { type: "missed-edge-cases", title: "Edge cases missed", explanation: "Common cases for this problem: empty input, single element, duplicates. You only addressed {{evidence}}." },
    { type: "silent-coding", title: "Coded silently", explanation: "Long stretches without thinking aloud read as struggling. Narrate your reasoning even when stuck." },
    { type: "no-trade-offs", title: "No trade-off discussion", explanation: "You picked the optimal approach but didn't say why over alternatives. 'I chose X over Y because...' is the trade-off signal." },
  ],
  followUpHints: [
    "What's the time and space complexity?",
    "How would you test this?",
    "What if the input were 100x larger?",
    "What edge cases did you not handle?",
  ],
  verdictHeading: {
    strong: "Why this implementation worked",
    partial: "Solid approach, missing pieces",
    weak: "Where the implementation fell short",
  },
};

/* ─── CASE STUDY (Product / Strategy) ──────────────────────────── */
export const CASE_STUDY_RUBRIC: FocusRubric = {
  focus: "case-study",
  evaluationStatement:
    "Product case studies grade structure, hypothesis-driven thinking, and the courage to commit to a recommendation. Generic 'it depends' answers signal junior thinking.",
  skillAxes: [
    { label: "Framework", description: "CIRCLES / MECE / Diagnose framework named or applied." },
    { label: "Customer specificity", description: "Named segment with demographics + behavior, not 'users'." },
    { label: "Hypothesis-driven", description: "'I believe X because Y' pattern vs scattered ideas." },
    { label: "Prioritization", description: "Impact vs effort articulated — one solution picked, not all." },
    { label: "Recommendation", description: "Drove to a clear point of view, not 'it depends'." },
    { label: "Metric definition", description: "Named a north-star metric for success." },
  ],
  metricsStrip: [
    { label: "Framework", format: "boolean", tone: "high-good", description: "Named framework applied (CIRCLES, MECE, etc.)." },
    { label: "Solutions", format: "count", tone: "neutral", description: "Solutions explored. 3-5 is the sweet spot." },
    { label: "Recommendation", format: "boolean", tone: "high-good", description: "Drove to a definite recommendation." },
    { label: "Metrics named", format: "count", tone: "high-good", description: "Distinct success metrics defined." },
  ],
  redFlagCatalog: [
    { type: "no-framework", title: "No framework applied", explanation: "Top PM candidates explicitly name a framework. Even '{{evidence}} — let me use CIRCLES' is enough — it shows structured thinking." },
    { type: "generic-customer", title: "Customer was 'users'", explanation: "You said '{{evidence}}'. Strong PM answers name a specific segment: 'working professional in tier-2 city aged 28-35 who...'" },
    { type: "no-recommendation", title: "Hedged the final answer", explanation: "You explored options without committing. PM rounds reward conviction: 'I would recommend X because Y, accepting the trade-off Z.'" },
    { type: "no-metrics", title: "No success metric named", explanation: "Every PM solution needs a measurable definition of success. Without it, the recommendation can't be evaluated post-launch." },
    { type: "scattered", title: "Solutions felt scattered", explanation: "Without prioritization, you presented {{evidence}} ideas of equal weight. Pick one as primary; argue why." },
  ],
  followUpHints: [
    "If you had only one metric to define success, which one?",
    "How would you prioritize between the solutions you proposed?",
    "What's the single biggest risk to your recommendation?",
    "How would you size this opportunity?",
  ],
  verdictHeading: {
    strong: "Why this case landed",
    partial: "Strong structure, gaps to close",
    weak: "What the case was missing",
  },
};

/* ─── SALARY NEGOTIATION ────────────────────────────────────────── */
export const SALARY_NEGOTIATION_RUBRIC: FocusRubric = {
  focus: "salary-negotiation",
  evaluationStatement:
    "Salary negotiation grades anchoring, package depth, and BATNA leverage. The single biggest predictor of outcome is whether YOU named a number first — anchoring first correlates with 11% higher final offers (Galinsky 2001).",
  skillAxes: [
    { label: "Anchoring", description: "Named a specific counter ₹ figure first vs deflecting." },
    { label: "Package depth", description: "Discussed multiple comp levers: base / variable / equity / signing / leave / WFH / scope." },
    { label: "BATNA leverage", description: "Referenced competing offers, alternatives, or walk-away point." },
    { label: "Phase progression", description: "Navigated through offer-reaction → counter → benefits → closing — didn't rush or stall." },
    { label: "Pushback resilience", description: "Held position under HM pushback without folding or burning bridges." },
    { label: "Composure", description: "Stayed measured. Aggressive tone reads as desperate; flat tone reads as uninterested." },
  ],
  metricsStrip: [
    { label: "Counter named", format: "currency", tone: "high-good", description: "Specific ₹ counter offered. Anchoring first wins." },
    { label: "Package items", format: "count", tone: "high-good", description: "Distinct compensation levers explored. 4+ is strong." },
    { label: "BATNA", format: "boolean", tone: "high-good", description: "Mentioned competing offer / alternative / walk-away." },
    { label: "Phases reached", format: "count", tone: "high-good", description: "Of 6 negotiation phases, how many you progressed through." },
  ],
  redFlagCatalog: [
    { type: "accepted-first-offer", title: "Accepted on the first call", explanation: "You said '{{evidence}}'. Even 'let me think about it overnight' is better than yes — it signals you considered alternatives." },
    { type: "no-anchor", title: "Didn't anchor first", explanation: "You let the HM set the number. Counter-anchoring first ('I was thinking ₹X based on market data') correlates with 11% higher outcomes." },
    { type: "no-package-depth", title: "Only discussed base", explanation: "You only addressed base salary. Strong negotiations explore equity, signing bonus, variable, leave policy, scope of role — each is a lever." },
    { type: "no-batna", title: "No leverage demonstrated", explanation: "Without referencing alternatives ('I'm in late stages with X', 'happy where I am'), you have no leverage. The HM has nothing to lose by anchoring low." },
    { type: "burned-bridges", title: "Tone risked the relationship", explanation: "You said '{{evidence}}' — even when negotiating hard, the HM remembers the conversation. Frame asks as collaborative ('help me make this work'), not adversarial." },
    { type: "phase-stalled", title: "Stalled at offer-reaction", explanation: "You stayed in 'react to the offer' mode — never advanced to counter-offer or benefits discussion. Push the conversation forward." },
  ],
  followUpHints: [
    "What would make you walk away from this offer?",
    "What's your minimum acceptable package?",
    "If we can't move on base, what else matters to you?",
    "How quickly can you decide?",
  ],
  verdictHeading: {
    strong: "Why this negotiation succeeded",
    partial: "Solid moves, value left on the table",
    weak: "Where the negotiation lost ground",
  },
};

/* ─── SYSTEM DESIGN ────────────────────────────────────────────── */
export const SYSTEM_DESIGN_RUBRIC: FocusRubric = {
  focus: "system-design",
  evaluationStatement:
    "System design grades the quality of your reasoning about scale, failure, and trade-offs — not the diagram. Strong candidates start with requirements + capacity numbers, then decompose. Weak candidates draw boxes immediately.",
  skillAxes: [
    { label: "Requirements gathering", description: "Asked about scale, read/write ratio, latency, consistency BEFORE drawing." },
    { label: "Capacity estimation", description: "Stated QPS at peak, storage growth, bandwidth — order-of-magnitude reasoning." },
    { label: "Decomposition", description: "Broke the system into named components (LB / app / cache / DB / queue / CDN)." },
    { label: "Database justification", description: "Picked SQL / NoSQL / blob with explicit reasoning, not by default." },
    { label: "Scaling strategy", description: "Sharding, replication, cache tiers — addressed read-heavy vs write-heavy." },
    { label: "Failure modes", description: "What if X dies? Senior signal — addressed unprompted, not just on-prompt." },
  ],
  metricsStrip: [
    { label: "Components", format: "count", tone: "high-good", description: "Distinct components named in the architecture." },
    { label: "Capacity stated", format: "boolean", tone: "high-good", description: "QPS / storage / bandwidth numbers explicit." },
    { label: "DB justified", format: "boolean", tone: "high-good", description: "Database choice defended against alternatives." },
    { label: "Failure modes", format: "count", tone: "high-good", description: "Distinct failure scenarios addressed." },
  ],
  redFlagCatalog: [
    { type: "skipped-requirements", title: "Skipped requirements gathering", explanation: "You started drawing boxes within {{evidence}}s. Strong candidates spend the first 2-3 minutes asking about scale and constraints — that conversation is itself the signal." },
    { type: "no-capacity-numbers", title: "No capacity numbers", explanation: "You designed in the abstract. 'High traffic' is meaningless; '50K QPS at peak with 10% writes' lets you make real architectural choices." },
    { type: "single-region-design", title: "Single-region design", explanation: "Didn't address geo-distribution. For India-scale systems, multi-region (or at least multi-AZ) is usually the right starting assumption." },
    { type: "no-failure-modes", title: "No failure-mode discussion", explanation: "Walked through the happy path only. Bar-raisers ask 'what if {{evidence}} dies?' — strong candidates pre-empt this." },
    { type: "no-trade-offs", title: "No trade-off discussion", explanation: "Picked solutions without explaining why over alternatives. 'I chose X over Y because Z' is the senior-engineering signal." },
  ],
  followUpHints: [
    "What if traffic 10x'd overnight?",
    "Which component would fail first under load?",
    "How would you handle a hot-key in your cache?",
    "What's your consistency model — and what breaks if it's wrong?",
  ],
  verdictHeading: {
    strong: "Why this design held up",
    partial: "Architecture solid, depth gaps",
    weak: "Where the design fell short",
  },
};

/* ─── STRATEGIC ─────────────────────────────────────────────────── */
export const STRATEGIC_RUBRIC: FocusRubric = {
  focus: "strategic",
  evaluationStatement:
    "Strategic / leadership rounds grade vision articulation and the courage to make decisions with incomplete information. Hedging on every dimension reads as junior; committing while naming the risks reads as senior.",
  skillAxes: [
    { label: "Vision clarity", description: "Articulated a 3-year picture in concrete terms, not platitudes." },
    { label: "Stakeholder mapping", description: "Identified who's affected, with named segments — engineering, sales, customers, board." },
    { label: "Resource trade-off", description: "Named what you'd say no to. Strategy is choice; if everything matters, nothing does." },
    { label: "Time horizon", description: "Both short-term wins AND long-term moves — neither alone is strategy." },
    { label: "Decision conviction", description: "Drove to a clear point of view despite ambiguity. 'It depends' isn't an answer at this level." },
    { label: "Influence reasoning", description: "How you'd build alignment — not just what you'd decide unilaterally." },
  ],
  metricsStrip: [
    { label: "Stakeholders", format: "count", tone: "high-good", description: "Distinct stakeholder groups identified." },
    { label: "Time horizons", format: "count", tone: "high-good", description: "Number of horizons addressed (typically short / medium / long)." },
    { label: "Decision criteria", format: "count", tone: "high-good", description: "Explicit criteria named for the decision." },
    { label: "Risk owned", format: "boolean", tone: "high-good", description: "Articulated the bet you're making — not just the upside." },
  ],
  redFlagCatalog: [
    { type: "no-vision", title: "Vision was vague", explanation: "You said '{{evidence}}' — strategic rounds want a concrete picture. 'In 3 years X looks like Y because Z' is the shape." },
    { type: "single-stakeholder-view", title: "Only one stakeholder considered", explanation: "Optimised for {{evidence}} only. Strategy is multi-stakeholder by definition; show you've held the trade-off." },
    { type: "no-trade-offs", title: "Didn't name what to deprioritise", explanation: "Listed everything as important. Strategic decisions explicitly downgrade something — naming that is the seniority signal." },
    { type: "short-term-only", title: "Short-term framing only", explanation: "Addressed the current quarter only. Strategic answers connect short-term moves to long-term position." },
    { type: "hedged-decision", title: "Hedged the decision", explanation: "'It depends' / 'I'd need more data' is junior framing at this level. Strong leaders commit while naming what would change their mind." },
  ],
  followUpHints: [
    "What's the single biggest risk to your plan, and how do you know if it's materialising?",
    "What would you say no to in order to do this?",
    "How would you build alignment with the CEO if they disagreed?",
    "What's the one thing that would make you reverse this decision?",
  ],
  verdictHeading: {
    strong: "Why this strategic framing landed",
    partial: "Solid vision, gaps in execution",
    weak: "Where the strategy lost coherence",
  },
};

/* ─── CAMPUS PLACEMENT ──────────────────────────────────────────── */
export const CAMPUS_PLACEMENT_RUBRIC: FocusRubric = {
  focus: "campus-placement",
  evaluationStatement:
    "Campus rounds grade depth on YOUR project, fundamentals (OOP / DBMS / OS basics), and genuine coachability. Memorised answers fail; specific stories with honest 'I don't know yet' moments win.",
  skillAxes: [
    { label: "Project ownership", description: "Your specific contribution vs the team's collective work — clear attribution." },
    { label: "Project depth", description: "Architecture-level reasoning: why this DB, why this framework, what trade-offs." },
    { label: "Fundamentals", description: "OOP / DBMS / OS / SQL — confident, accurate answers without scripting." },
    { label: "Genuine enthusiasm", description: "Specific reasons for excitement, not generic 'I love coding'." },
    { label: "Coachability", description: "Mentioned learning, asking, mistakes, failures — most important fresher trait." },
    { label: "Communication", description: "Sentence-length variance, redundancy, comfort with English." },
  ],
  metricsStrip: [
    { label: "Project ownership", format: "percent", tone: "high-good", description: "I-pronoun ratio in the project section specifically." },
    { label: "Architectural", format: "count", tone: "high-good", description: "Architectural keywords correctly used (REST, ORM, microservices, caching)." },
    { label: "Fundamentals", format: "count", tone: "high-good", description: "Fundamentals topics covered correctly when probed." },
    { label: "Specific reasons", format: "count", tone: "high-good", description: "Concrete reasons given for enthusiasm or choices." },
  ],
  redFlagCatalog: [
    { type: "vague-project-role", title: "Project role was vague", explanation: "You said '{{evidence}}'. Interviewers will assume the worst — that you didn't really do it. Be explicit: 'I built the auth layer; my teammate built the frontend.'" },
    { type: "surface-only-tech", title: "Tech depth was surface-level", explanation: "Said you used React/Node/MongoDB without explaining why. 'We chose MongoDB because we had nested user-preference data' shows actual decision-making." },
    { type: "generic-enthusiasm", title: "Enthusiasm felt generic", explanation: "'I love coding' / 'I like solving problems' — every candidate says this. Specific reasons ('I built a chess bot in 11th grade because…') land much harder." },
    { type: "no-learning-mindset", title: "No mention of learning or mistakes", explanation: "Strongest fresher signal is honesty about what you don't know yet, paired with how you'd learn it. Pretending to know everything fails." },
    { type: "fundamentals-shaky", title: "Fundamentals were shaky", explanation: "Stumbled on '{{evidence}}'. Campus rounds expect rapid-fire CS basics. Re-review OOP / DBMS / OS / SQL before the actual interview." },
  ],
  followUpHints: [
    "What was the hardest bug you debugged in this project, and how did you find it?",
    "If you had to redo this project, what would you change?",
    "What's a topic you're actively learning right now?",
  ],
  verdictHeading: {
    strong: "Why this answer signaled readiness",
    partial: "Solid foundation, gaps to close before placements",
    weak: "What needs work before campus rounds",
  },
};

/* ─── HR ROUND ──────────────────────────────────────────────────── */
export const HR_RUBRIC: FocusRubric = {
  focus: "hr",
  evaluationStatement:
    "HR rounds grade authenticity, motivation specificity, and absence of red flags (badmouthing, vagueness about gaps, salary unrealism). The interviewer follows a script; what they're evaluating is whether your answers feel real.",
  skillAxes: [
    { label: "Motivation specificity", description: "Specific reasons for THIS role at THIS company, not generic 'good company'." },
    { label: "Authenticity", description: "Specific examples vs platitudes. Rehearsed answers fail HR more than any other round." },
    { label: "Career coherence", description: "Why this stage of your career? Why this transition? Connect last role → this role." },
    { label: "Salary realism", description: "Range stated, anchored to market data. Flat single-number asks read as inexperienced." },
    { label: "Cultural alignment", description: "Values you mention align with company culture (do your homework)." },
    { label: "Red-flag absence", description: "No badmouthing previous employers, no vague gaps, no contradictions." },
  ],
  metricsStrip: [
    { label: "Specific reasons", format: "count", tone: "high-good", description: "Concrete reasons given for motivation / interest." },
    { label: "Trajectory links", format: "count", tone: "high-good", description: "Connections drawn between your last role and this one." },
    { label: "Salary anchored", format: "boolean", tone: "high-good", description: "Salary expectation stated as a range with rationale." },
    { label: "Negative language", format: "count", tone: "low-good", description: "Negative words about past employers / colleagues. <2 is good; 3+ is a red flag." },
  ],
  redFlagCatalog: [
    { type: "generic-motivation", title: "Motivation was generic", explanation: "You said '{{evidence}}' — every candidate says this. HR is filtering for people who actually researched THIS company. One specific reason ('your engineering blog post on X resonated because…') beats five generic ones." },
    { type: "vague-trajectory", title: "Trajectory wasn't connected", explanation: "Couldn't explain why this role at this stage. Strong narrative: 'In my last role I learned X; this role lets me apply X at Y scale.'" },
    { type: "badmouthing", title: "Negative tone toward previous employer", explanation: "You said '{{evidence}}'. Even if true, HR reads this as 'this person will badmouth us next.' Reframe as 'I'm looking for [positive thing], which my current role can't offer.'" },
    { type: "unrealistic-salary", title: "Salary expectations off-anchor", explanation: "Either too high (suggests no market awareness) or too low (suggests undervaluing). Anchor with: 'Based on my research for similar roles, ₹X-Y feels right.'" },
    { type: "inconsistencies", title: "Inconsistencies across answers", explanation: "Said {{evidence}} earlier but contradicted later. HR rounds are partly cross-checks; consistency is itself a signal." },
  ],
  followUpHints: [
    "Why are you leaving your current role?",
    "Where do you see yourself in 5 years?",
    "What's your biggest weakness, honestly?",
    "What would your last manager say about you?",
  ],
  verdictHeading: {
    strong: "Why this read as authentic",
    partial: "Solid answers, polish needed",
    weak: "What read as rehearsed or risky",
  },
};

/* ─── PANEL INTERVIEW ───────────────────────────────────────────── */
export const PANEL_RUBRIC: FocusRubric = {
  focus: "panel",
  evaluationStatement:
    "Panel rounds grade per-panelist calibration: the manager wants strategy, the tech lead wants depth, the HR partner wants fit. Answering everyone the same way fails — strong candidates address each panelist's lens directly.",
  skillAxes: [
    { label: "Persona awareness", description: "Tailored each answer to the asking panelist's role (manager vs tech vs HR)." },
    { label: "Tone calibration", description: "Same content, different framing per panelist — formal with HR, technical with TL." },
    { label: "Cross-panel consistency", description: "No contradictions between answers given to different panelists." },
    { label: "Acknowledgment", description: "Built on prior questions: 'building on what {Hiring Manager} asked…'" },
    { label: "Engagement balance", description: "Eye contact + direct response distributed across panelists, not one-favored." },
    { label: "Routing accuracy", description: "Addressed each panelist's actual concern, not the question literally." },
  ],
  metricsStrip: [
    { label: "Panelists addressed", format: "count", tone: "high-good", description: "Distinct panelists you directly engaged with." },
    { label: "Direct response %", format: "percent", tone: "high-good", description: "Answered the asking panelist (vs deflecting to another)." },
    { label: "Tone shifts", format: "count", tone: "high-good", description: "Number of times tone calibrated per panelist." },
    { label: "Cross-references", format: "count", tone: "high-good", description: "References to a prior panelist's question or comment." },
  ],
  redFlagCatalog: [
    { type: "ignored-panelist", title: "Ignored a panelist", explanation: "You barely engaged with {{evidence}}. Panelists are voting on you collectively; the one you ignore can sink an otherwise strong loop." },
    { type: "same-tone-everyone", title: "Same tone for all panelists", explanation: "Used identical formal/technical register with HR partner and tech lead alike. Tonal flexibility signals real-world stakeholder skill." },
    { type: "contradicted-self", title: "Contradicted earlier answer", explanation: "Said {{evidence}} to one panelist, then '{{evidence}}' to another. Panelists compare notes after; consistency is itself the test." },
    { type: "manager-track-only", title: "Skewed to one panelist", explanation: "Almost all eye contact and answers directed at the hiring manager. Tech lead and HR partner felt sidelined — a signal you don't see them as decision-makers." },
    { type: "missed-the-real-question", title: "Answered the literal question, not the concern", explanation: "Tech lead asked '{{evidence}}' to probe whether you understand systems thinking. You answered the surface question; the depth probe was missed." },
  ],
  followUpHints: [
    "[Tech Lead] How did you decide between the two architectural approaches?",
    "[Hiring Manager] How would you handle pushback from your peer team?",
    "[HR] What do you need from this role that your last one couldn't give?",
  ],
  verdictHeading: {
    strong: "Why the panel aligned on you",
    partial: "Mixed signals across panelists",
    weak: "Where the panel lost coherence",
  },
};

/* ─── GOVERNMENT / PSU ──────────────────────────────────────────── */
export const GOVERNMENT_RUBRIC: FocusRubric = {
  focus: "government",
  evaluationStatement:
    "Government / PSU interviews grade ethics framing, public-service motivation, current-affairs awareness, and respect for hierarchy. Tone matters more than in corporate; specific examples from current Indian policy land much harder than generic principles.",
  skillAxes: [
    { label: "Ethics framing", description: "Articulated decisions with public-interest framing, not just personal/efficient framing." },
    { label: "Service orientation", description: "Citizen-first / public-benefit language. 'Serving' vs 'achieving' vs 'optimising'." },
    { label: "Current affairs", description: "Specific recent policies, schemes, court rulings — shows you read the news." },
    { label: "Hierarchy respect", description: "Tone toward senior officials. Even disagreement is framed deferentially." },
    { label: "Regulatory comfort", description: "Comfort with rules-based reasoning, due process, procedural rigor." },
    { label: "Specific examples", description: "Real cases / districts / departments cited, not abstract principles." },
  ],
  metricsStrip: [
    { label: "Ethics keywords", format: "count", tone: "high-good", description: "Public-interest, accountability, transparency, due-process, integrity." },
    { label: "Public examples", format: "count", tone: "high-good", description: "Specific Indian policies, schemes, or cases referenced." },
    { label: "Service language", format: "count", tone: "high-good", description: "'Serve / public / citizen' frequency vs 'efficient / optimise / scale'." },
    { label: "Specific policies", format: "count", tone: "high-good", description: "Named Indian government schemes or recent rulings." },
  ],
  redFlagCatalog: [
    { type: "no-ethics-framing", title: "No ethics framing", explanation: "You answered '{{evidence}}' purely on efficiency or personal grounds. Public-service answers explicitly weigh ethical and citizen-impact dimensions." },
    { type: "generic-service-language", title: "Service language was generic", explanation: "'I want to serve the country' is the corporate equivalent of 'I love coding'. Specific is: 'I want to work on rural healthcare delivery because in my district…'" },
    { type: "no-current-affairs", title: "Couldn't cite current policies", explanation: "Asked about rural development, you answered abstractly. Government rounds expect awareness of specific schemes (PM Gati Shakti, Jal Jeevan Mission, etc.) and recent court rulings." },
    { type: "inappropriate-tone", title: "Tone toward senior officials read as casual", explanation: "Said '{{evidence}}' — government rounds expect more deferential framing. Even disagreement is signalled with 'with respect, sir' / 'I'd like to offer a different view.'" },
    { type: "private-sector-frame", title: "Private-sector framing leaked through", explanation: "Used '{{evidence}}' — corporate-speak. Government decisions are made through different criteria (legality, equity, due process) than corporate ones (ROI, efficiency, scale)." },
  ],
  followUpHints: [
    "How would you handle a directive from your senior that you ethically disagree with?",
    "What's a recent Supreme Court ruling that affected public administration?",
    "Tell me about a government scheme that you think is well-designed.",
    "How does this role serve the public, in your view?",
  ],
  verdictHeading: {
    strong: "Why this answer aligned with public-service values",
    partial: "Solid foundation, deepening needed",
    weak: "Where the response missed the public-service frame",
  },
};

/* Universal sub-strip — these stay across ALL focuses because they're
   honest signals regardless of interview type. Always rendered under
   the focus-specific strip. */
export const UNIVERSAL_METRICS: MetricTile[] = [
  { label: "Filler / 100w", format: "count", tone: "low-good", description: "Filler word frequency. <3 is excellent, 6+ is distracting." },
  { label: "Pace (wpm)", format: "count", tone: "neutral", description: "Words per minute. 140-180 is the comfortable range; outside reads as rushed/slow." },
  { label: "Hedging", format: "count", tone: "low-good", description: "'I think', 'maybe', 'kind of' — confidence-eroding hedges." },
];

/* Index by focus key for the canvas to look up by current session.
   All 10 focuses are now covered — Phase 1 (4 focuses, ~70% of usage)
   plus Phase 2 (system-design, hr, campus-placement) and Phase 3
   (panel, strategic, government). */
export const RUBRICS_BY_FOCUS: Partial<Record<FocusKey, FocusRubric>> = {
  behavioral: BEHAVIORAL_RUBRIC,
  technical: TECHNICAL_RUBRIC,
  "case-study": CASE_STUDY_RUBRIC,
  "salary-negotiation": SALARY_NEGOTIATION_RUBRIC,
  "system-design": SYSTEM_DESIGN_RUBRIC,
  strategic: STRATEGIC_RUBRIC,
  "campus-placement": CAMPUS_PLACEMENT_RUBRIC,
  hr: HR_RUBRIC,
  panel: PANEL_RUBRIC,
  government: GOVERNMENT_RUBRIC,
};

/* Tier 1 = Phase 1 ship (covers 70% of usage). The other 6 focuses
   slot in identically once their rubrics are designed.
   Phase 2: system-design, hr, campus-placement.
   Phase 3: panel (per-persona scoring), strategic, government. */
export const TIER_1_FOCUSES: FocusKey[] = [
  "behavioral", "technical", "case-study", "salary-negotiation",
];
