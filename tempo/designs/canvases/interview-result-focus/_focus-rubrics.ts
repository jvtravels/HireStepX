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

/* Universal sub-strip — these stay across ALL focuses because they're
   honest signals regardless of interview type. Always rendered under
   the focus-specific strip. */
export const UNIVERSAL_METRICS: MetricTile[] = [
  { label: "Filler / 100w", format: "count", tone: "low-good", description: "Filler word frequency. <3 is excellent, 6+ is distracting." },
  { label: "Pace (wpm)", format: "count", tone: "neutral", description: "Words per minute. 140-180 is the comfortable range; outside reads as rushed/slow." },
  { label: "Hedging", format: "count", tone: "low-good", description: "'I think', 'maybe', 'kind of' — confidence-eroding hedges." },
];

/* Index by focus key for the canvas to look up by current session. */
export const RUBRICS_BY_FOCUS: Partial<Record<FocusKey, FocusRubric>> = {
  behavioral: BEHAVIORAL_RUBRIC,
  technical: TECHNICAL_RUBRIC,
  "case-study": CASE_STUDY_RUBRIC,
  "salary-negotiation": SALARY_NEGOTIATION_RUBRIC,
};

/* Tier 1 = Phase 1 ship (covers 70% of usage). The other 6 focuses
   slot in identically once their rubrics are designed.
   Phase 2: system-design, hr, campus-placement.
   Phase 3: panel (per-persona scoring), strategic, government. */
export const TIER_1_FOCUSES: FocusKey[] = [
  "behavioral", "technical", "case-study", "salary-negotiation",
];
