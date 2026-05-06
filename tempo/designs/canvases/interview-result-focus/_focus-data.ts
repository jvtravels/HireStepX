/* HireStepX — Focus-aware demo data (DESIGN ONLY)
 *
 * Builds InterviewResultData objects that feed the EXISTING
 * InterviewResult component (../interview-result/InterviewResult).
 * No new layout, no custom report — same hero, same skill bars,
 * same per-question expanded card.
 *
 * The CONTENT inside those slots differs per focus:
 *   • skills[]                  → focus-specific axis labels (with roleAvg)
 *   • questions[].metrics       → kept (generic 4 fields, baseline)
 *   • questions[].focusMetrics  → NEW optional override that
 *     replaces the generic 4 tiles with focus-specific ones
 *     (the only minimal additive change to InterviewResult.tsx)
 *   • questions[].redFlags      → focus-specific titles + explanations
 *     (re-using the production red-flag types: blame / missing_result /
 *     we_without_i / scope_drift / contradiction / vague)
 *   • questions[].whyScored     → focus-specific coaching text
 *   • questions[].likelyFollowUp → focus-specific follow-up
 *
 * This file is data only — no React, no rendering. The canvas
 * imports these and passes them as `data` prop to InterviewResult.
 */

import type { InterviewResultData, Question, AnswerSpan } from "../interview-result/InterviewResult";
import { DEFAULT_RESULT } from "../interview-result/InterviewResult";

const TONE_ERROR = "#B91C1C";
const TONE_SUCCESS = "#15803D";
const TONE_DEFAULT = "#0E0C08";

function plain(text: string): AnswerSpan[] { return [{ text }]; }

/* Re-usable scaffolding — every focus result fills these in. The
   delivery metrics (filler / pace / silence) stay universal across
   focuses since they're honest signals everywhere. */
function build(
  override: Partial<InterviewResultData> & {
    skills: InterviewResultData["skills"];
    questions: Question[];
  },
): InterviewResultData {
  /* Pick the lowest-scoring skill from the override as the weakestSkill —
     since each focus has its own axis names, hardcoding "Trade-off
     Reasoning" (the DEFAULT_RESULT pick) wouldn't make sense across
     focuses. weakestSkill is REQUIRED on InterviewResultData; without
     it the component throws at render time. */
  const weakest = [...override.skills].sort((a, b) => a.score - b.score)[0];
  const weakestSkill = weakest
    ? { name: weakest.name, tip: `Strengthen your ${weakest.name.toLowerCase()} — it's the lowest-scoring axis this session.` }
    : { name: "—", tip: "" };

  /* Spread DEFAULT_RESULT first so every optional-but-runtime-accessed
     field (calibration, recentScores, readiness, scoreConfidence, etc.)
     is populated. The override + weakestSkill then customize per focus.
     This mirrors the pattern in the working sibling canvas
     (interview-result/index.canvas.tsx) and is what made those
     storyboards render while these were crashing. */
  return {
    ...DEFAULT_RESULT,
    weakestSkill,
    ...override,
  };
}

/* ─── 1. BEHAVIORAL — strong (82) ────────────────────────────── */

export const BEHAVIORAL_STRONG: InterviewResultData = build({
  overallScore: 82,
  verdict: "hire",
  scoreDelta: 6,
  company: "Razorpay",
  role: "Senior Product Designer",
  level: "Senior",
  difficulty: "Standard",
  percentile: 78,
  aiVerdict:
    "Specific, owned, outcome-anchored. The Q3 2024 design-system migration story landed because you named what you specifically did and closed with a metric. Tighten the Q2 'we' usage and you're ready for the bar-raiser.",
  strengths: [
    "Concrete situation anchoring (date, project named)",
    "Owned the action with specific I-pronouns + decisions",
    "Closed with measurable outcome (40% fewer review cycles)",
  ],
  improvements: [
    "Q2: 'we' outnumbered 'I' 12-to-3 in the Action section",
    "Could add one self-reflection per story",
  ],
  /* Behavioral-specific axes — NOT generic Comm/Structure/etc. */
  skills: [
    { name: "Specificity", score: 85, roleAvg: 65 },
    { name: "Ownership", score: 78, roleAvg: 60 },
    { name: "Outcome", score: 88, roleAvg: 58 },
    { name: "Self-reflection", score: 70, roleAvg: 55 },
    { name: "STAR coherence", score: 90, roleAvg: 62 },
    { name: "Action depth", score: 80, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "Tell me about a time you took an unpopular decision. What did the team say?",
      score: 84,
      band: "strong",
      answer: plain("Q3 2024, leading the design-system migration. The team wanted incremental updates; I pushed for a full rebuild..."),
      star: { situation: true, task: true, action: true, result: true, learning: true },
      metrics: { wordCount: 218, responseSec: 168, firstPersonRatioPct: 64, quantificationCount: 5 },
      focusMetrics: [
        { label: "Words", value: "218", tone: TONE_DEFAULT },
        { label: "First-person %", value: "64%", tone: TONE_SUCCESS },
        { label: "Specifics", value: "5", tone: TONE_SUCCESS },
        { label: "STAR coverage", value: "100%", tone: TONE_SUCCESS },
      ],
      whyScored:
        "Concrete situation (Q3 2024, design-system migration), 'I' used 8 times in Action section, closed with 40% fewer review cycles. The reflection at the end was the cherry on top.",
      likelyFollowUp: "What would you do differently if you had to do it again?",
    },
    {
      index: 2,
      text: "Walk me through a project where you had to convince a senior leader.",
      score: 76,
      band: "partial",
      answer: plain("There was a push from leadership to ship a new dashboard..."),
      star: { situation: true, task: true, action: true, result: true, learning: false },
      metrics: { wordCount: 195, responseSec: 162, firstPersonRatioPct: 38, quantificationCount: 3 },
      focusMetrics: [
        { label: "Words", value: "195", tone: TONE_DEFAULT },
        { label: "First-person %", value: "38%", tone: TONE_ERROR },
        { label: "Specifics", value: "3", tone: TONE_DEFAULT },
        { label: "STAR coverage", value: "75%", tone: TONE_DEFAULT },
      ],
      whyScored:
        "Solid setup but 'we' outnumbered 'I' in the Action section (12 vs 3). Hiring you, not your team — show what YOU specifically did to land the conversation.",
      redFlags: [
        {
          type: "we_without_i",
          severity: "high",
          title: "All 'we', no 'I'",
          explanation: "12 'we' vs 3 'I' in the Action section. Reframe: 'I prepared the data; my teammate ran the demo.'",
          quote: "we built the slides, we presented...",
        },
      ],
      likelyFollowUp: "What was the specific moment that turned the conversation?",
    },
  ],
});

/* ─── 2. TECHNICAL — partial (64) ────────────────────────────── */

export const TECHNICAL_PARTIAL: InterviewResultData = build({
  overallScore: 64,
  verdict: "leanHire",
  scoreDelta: 0,
  company: "Flipkart",
  role: "Senior Software Engineer",
  level: "SDE-3",
  difficulty: "Hard",
  percentile: 52,
  aiVerdict:
    "Reached optimal solutions but skipped brute-force walkthrough on Q1 and went straight to ML on Q2 without asking about constraints. Strong communication, but missing the trade-off articulation that signals seniority.",
  strengths: [
    "Talked through reasoning while writing — strong communication",
    "Reached optimal complexity on Q1",
  ],
  improvements: [
    "State complexity explicitly — strong candidates always close with O(...)",
    "Walk through brute force first, then optimise — jumping straight reads as rehearsed",
    "Address edge cases (empty input, single element, overflow)",
  ],
  /* Technical-specific axes */
  skills: [
    { name: "Approach progression", score: 70, roleAvg: 65 },
    { name: "Complexity articulation", score: 50, roleAvg: 70 },
    { name: "Edge case coverage", score: 45, roleAvg: 60 },
    { name: "Communication", score: 75, roleAvg: 62 },
    { name: "Trade-off articulation", score: 60, roleAvg: 58 },
    { name: "Test thinking", score: 30, roleAvg: 50 },
  ],
  questions: [
    {
      index: 1,
      text: "Reverse a linked list in O(1) extra space, then explain when you'd use this in production.",
      score: 72,
      band: "partial",
      answer: plain("So I'd use the iterative two-pointer approach, walking the list and reversing pointers..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 145, responseSec: 240, firstPersonRatioPct: 42, quantificationCount: 0 },
      focusMetrics: [
        { label: "Approaches", value: "1", tone: TONE_ERROR },
        { label: "Complexity", value: "Not stated", tone: TONE_ERROR },
        { label: "Edge cases", value: "2", tone: TONE_DEFAULT },
        { label: "Test cases", value: "1", tone: TONE_DEFAULT },
      ],
      whyScored:
        "Reached the optimal iterative solution and your communication was strong throughout. Two gaps: skipped the recursive O(n) space approach as a brute force first, and didn't articulate time/space complexity for the final answer.",
      redFlags: [
        {
          type: "scope_drift",
          severity: "medium",
          title: "Jumped to optimal",
          explanation: "Went straight to the iterative two-pointer approach. Some interviewers read this as rehearsed answers — name a brute force first, even briefly.",
          quote: "",
        },
        {
          type: "missing_result",
          severity: "high",
          title: "Didn't state complexity",
          explanation: "Strong candidates always state O(...) for their final solution.",
          quote: "",
        },
      ],
      likelyFollowUp: "What's the time and space complexity of your final solution?",
    },
    {
      index: 2,
      text: "Design a system to predict same-day delivery feasibility for a new pincode in tier-3 India.",
      score: 56,
      band: "weak",
      answer: plain("I'd train an ML model on historical delivery data..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 168, responseSec: 195, firstPersonRatioPct: 35, quantificationCount: 0 },
      focusMetrics: [
        { label: "Approaches", value: "1", tone: TONE_ERROR },
        { label: "Complexity", value: "Not stated", tone: TONE_ERROR },
        { label: "Edge cases", value: "0", tone: TONE_ERROR },
        { label: "Test cases", value: "0", tone: TONE_ERROR },
      ],
      whyScored:
        "Jumped straight into 'I'd use ML' without first asking about constraints (existing logistics data, pincode coverage, peak QPS). Strong system-design starts with requirements, not solutions.",
      redFlags: [
        {
          type: "scope_drift",
          severity: "high",
          title: "Jumped to ML solution",
          explanation: "ML-based solution from the first sentence, no constraint-gathering.",
          quote: "I'd train an ML model",
        },
        {
          type: "vague",
          severity: "medium",
          title: "Edge cases missed",
          explanation: "Common cases ignored: monsoon-disrupted pincodes, kirana partner availability.",
          quote: "",
        },
      ],
      likelyFollowUp: "What if you had no historical delivery data for that pincode yet?",
    },
  ],
});

/* ─── 3. CASE STUDY — strong (78) ────────────────────────────── */

export const CASE_STUDY_STRONG: InterviewResultData = build({
  overallScore: 78,
  verdict: "hire",
  scoreDelta: 8,
  company: "Swiggy",
  role: "Senior Product Manager",
  level: "Senior PM",
  difficulty: "Hard",
  percentile: 70,
  aiVerdict:
    "Excellent framework usage — 'Diagnose' named explicitly, segments held throughout. Customer was specific ('tier-2 working professional restaurant owners') and you drove to a clear recommendation. One gap: no primary success metric.",
  strengths: [
    "Named the framework explicitly (Diagnose) and held it",
    "Specific customer segment, not generic 'users'",
    "Drove to a definite recommendation — no hedging",
  ],
  improvements: [
    "Define a primary success metric for every recommendation",
    "Quantify the impact estimate before picking",
  ],
  skills: [
    { name: "Framework usage", score: 90, roleAvg: 65 },
    { name: "Customer specificity", score: 75, roleAvg: 60 },
    { name: "Hypothesis-driven", score: 80, roleAvg: 62 },
    { name: "Prioritization", score: 70, roleAvg: 65 },
    { name: "Recommendation clarity", score: 85, roleAvg: 60 },
    { name: "Metric definition", score: 65, roleAvg: 55 },
  ],
  questions: [
    {
      index: 1,
      text: "A restaurant partner's order acceptance rate has dropped from 92% to 78% over two weeks. Walk me through your investigation.",
      score: 82,
      band: "strong",
      answer: plain("Let me use a Diagnose framework. First I'd segment by geography, cohort, and time..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 285, responseSec: 285, firstPersonRatioPct: 48, quantificationCount: 4 },
      focusMetrics: [
        { label: "Framework", value: "Yes", tone: TONE_SUCCESS },
        { label: "Solutions", value: "4", tone: TONE_DEFAULT },
        { label: "Recommendation", value: "Yes", tone: TONE_SUCCESS },
        { label: "Metrics named", value: "1", tone: TONE_DEFAULT },
      ],
      whyScored:
        "Excellent framework usage — opened with 'Let me use a Diagnose framework' and segmented consistently. Customer was specific. Drove to recommendation. One gap: didn't define a primary success metric for the intervention.",
      redFlags: [
        {
          type: "vague",
          severity: "low",
          title: "No success metric named",
          explanation: "Every PM solution needs a measurable definition of success. Without it, the recommendation can't be evaluated post-launch.",
          quote: "",
        },
      ],
      likelyFollowUp: "If you had only one metric to define success of this intervention, which one?",
    },
  ],
});

/* ─── 4. SALARY NEG — weak (38) — the headline contrast ──────── */

export const SALARY_NEG_WEAK: InterviewResultData = build({
  overallScore: 38,
  verdict: "noHire",
  scoreDelta: -4,
  company: "PhonePe",
  role: "Senior Engineering Manager",
  level: "Senior EM",
  difficulty: "Standard",
  percentile: 18,
  aiVerdict:
    "Accepted the first offer with 'sounds fair, let me think about it' and never advanced past the offer-reaction phase. No counter-anchor, no BATNA, no package decomposition. The textbook 'left value on the table' session.",
  strengths: [
    "Stayed composed and professional throughout",
    "Asked clarifying questions about start date and scope",
  ],
  improvements: [
    "Counter-anchor first — naming a specific number correlates with 11% higher outcomes",
    "Reference alternatives — competing offers, walk-away point",
    "Decompose the package — base, equity, signing, leave, scope",
    "Push past offer-reaction phase to counter and benefits",
  ],
  /* Salary-neg specific axes */
  skills: [
    { name: "Anchoring", score: 25, roleAvg: 55 },
    { name: "Package depth", score: 20, roleAvg: 60 },
    { name: "BATNA leverage", score: 0, roleAvg: 50 },
    { name: "Phase progression", score: 35, roleAvg: 65 },
    { name: "Pushback resilience", score: 50, roleAvg: 55 },
    { name: "Composure", score: 70, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "Our offer is ₹38 LPA fixed plus 12% variable. We think that's competitive for your level. What's your reaction?",
      score: 30,
      band: "weak",
      answer: plain("That sounds fair, let me think about it..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 84, responseSec: 95, firstPersonRatioPct: 55, quantificationCount: 0 },
      focusMetrics: [
        { label: "Counter named", value: "—", tone: TONE_ERROR },
        { label: "Package items", value: "0", tone: TONE_ERROR },
        { label: "BATNA", value: "No", tone: TONE_ERROR },
        { label: "Phases reached", value: "1 / 6", tone: TONE_ERROR },
      ],
      whyScored:
        "Said 'that sounds fair, let me think about it' and ended the call. Textbook 'left value on the table' move — even neutral candidates counter-anchor with a specific number. Stayed in offer-reaction phase the whole call.",
      redFlags: [
        {
          type: "scope_drift",
          severity: "high",
          title: "Accepted the first offer",
          explanation: "Even 'let me think about it overnight' is better than yes — it signals you considered alternatives.",
          quote: "that sounds fair, let me think about it",
        },
        {
          type: "missing_result",
          severity: "high",
          title: "No counter-anchor",
          explanation: "Counter-anchoring first ('I was thinking ₹X based on market data') correlates with 11% higher outcomes.",
          quote: "",
        },
        {
          type: "vague",
          severity: "medium",
          title: "Only base discussed",
          explanation: "Strong negotiations explore equity, signing bonus, variable, leave, scope of role — each is a lever.",
          quote: "",
        },
        {
          type: "vague",
          severity: "medium",
          title: "No leverage demonstrated",
          explanation: "Without alternatives ('I'm in late stages with X', 'happy where I am'), the HM has nothing to lose by anchoring low.",
          quote: "",
        },
      ],
      likelyFollowUp: "What's your minimum acceptable package?",
    },
  ],
});

/* ─── 5. SALARY NEG — strong (84) — same scenario, right rubric ─ */

export const SALARY_NEG_STRONG: InterviewResultData = build({
  overallScore: 84,
  verdict: "strongHire",
  scoreDelta: 12,
  company: "PhonePe",
  role: "Senior Engineering Manager",
  level: "Senior EM",
  difficulty: "Standard",
  percentile: 88,
  aiVerdict:
    "Counter-anchored at ₹52L base immediately, cited market data, named a competing Razorpay offer for leverage, and probed five package levers (ESOPs, signing, notice, scope, WFH). Textbook negotiation arc — advanced through offer-reaction → counter → benefits in one call.",
  strengths: [
    "Counter-anchored first with a specific number (₹52L) and rationale",
    "Named a competing Razorpay offer for leverage",
    "Decomposed the package into 5 levers, not just base",
    "Stayed collaborative — 'help me make this work'",
  ],
  improvements: [
    "Could push harder on ESOP strike price discussion",
  ],
  skills: [
    { name: "Anchoring", score: 90, roleAvg: 55 },
    { name: "Package depth", score: 85, roleAvg: 60 },
    { name: "BATNA leverage", score: 80, roleAvg: 50 },
    { name: "Phase progression", score: 88, roleAvg: 65 },
    { name: "Pushback resilience", score: 75, roleAvg: 55 },
    { name: "Composure", score: 80, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "Our offer is ₹38 LPA fixed plus 12% variable. We think that's competitive for your level. What's your reaction?",
      score: 86,
      band: "strong",
      answer: plain("Thank you for the offer. Based on my market research and where I am in conversations elsewhere, I was thinking ₹52L base + 15% variable..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 295, responseSec: 165, firstPersonRatioPct: 52, quantificationCount: 6 },
      focusMetrics: [
        { label: "Counter named", value: "₹52L", tone: TONE_SUCCESS },
        { label: "Package items", value: "5", tone: TONE_SUCCESS },
        { label: "BATNA", value: "Yes", tone: TONE_SUCCESS },
        { label: "Phases reached", value: "4 / 6", tone: TONE_SUCCESS },
      ],
      whyScored:
        "Textbook anchor: countered immediately with ₹52L base + 15% variable, citing market data. Named a competing Razorpay offer — real leverage. Opened the package conversation with 5 levers in two minutes (ESOPs, signing, notice, scope, WFH).",
      likelyFollowUp: "If we landed at ₹48L base, what would close the gap on the rest?",
    },
  ],
});

/* ─── 6. SYSTEM DESIGN — partial (62) ────────────────────────── */

export const SYSTEM_DESIGN_PARTIAL: InterviewResultData = build({
  overallScore: 62,
  verdict: "leanHire",
  scoreDelta: 5,
  company: "PhonePe",
  role: "Senior Software Engineer",
  level: "SDE-3",
  difficulty: "Hard",
  percentile: 48,
  aiVerdict:
    "Strong on decomposition and scaling — sharded by user_id, async writes via queue. Two gaps: skipped requirements gathering (jumped to architecture in 30s) and no capacity numbers. 'High traffic' isn't enough at 100M-transaction scale.",
  strengths: [
    "Clean component decomposition (LB → API → Redis → Postgres → Kafka)",
    "Addressed read-heavy vs write-heavy with concrete sharding strategy",
  ],
  improvements: [
    "Spend the first 2-3 minutes on requirements before drawing — the conversation IS the signal",
    "State capacity numbers: '50K QPS at peak, 10% writes'",
    "Address failure modes unprompted",
  ],
  skills: [
    { name: "Requirements gathering", score: 40, roleAvg: 65 },
    { name: "Capacity estimation", score: 30, roleAvg: 60 },
    { name: "Decomposition", score: 75, roleAvg: 65 },
    { name: "DB justification", score: 65, roleAvg: 60 },
    { name: "Scaling strategy", score: 70, roleAvg: 60 },
    { name: "Failure modes", score: 50, roleAvg: 55 },
  ],
  questions: [
    {
      index: 1,
      text: "Design a system to handle 100M daily UPI transactions with p99 < 200ms.",
      score: 62,
      band: "partial",
      answer: plain("I'd start with a load balancer in front of stateless API servers..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 412, responseSec: 480, firstPersonRatioPct: 38, quantificationCount: 1 },
      focusMetrics: [
        { label: "Components", value: "6", tone: TONE_SUCCESS },
        { label: "Capacity stated", value: "No", tone: TONE_ERROR },
        { label: "DB justified", value: "Yes", tone: TONE_SUCCESS },
        { label: "Failure modes", value: "2", tone: TONE_DEFAULT },
      ],
      whyScored:
        "Strong decomposition (named 6 components cleanly) and scaling strategy (sharded by user_id, async writes via queue). Two gaps: skipped requirements gathering and went straight to architecture in 30 seconds, and didn't state capacity numbers.",
      redFlags: [
        {
          type: "scope_drift",
          severity: "high",
          title: "Skipped requirements gathering",
          explanation: "Started drawing boxes within 30s. Strong candidates spend 2-3 minutes asking about scale and constraints — that conversation is itself the signal.",
          quote: "",
        },
        {
          type: "vague",
          severity: "medium",
          title: "No capacity numbers",
          explanation: "Designed in the abstract. '50K QPS at peak with 10% writes' lets you make real architectural choices.",
          quote: "",
        },
      ],
      likelyFollowUp: "What if 99.99% availability is required during festival peaks?",
    },
  ],
});

/* ─── 7. STRATEGIC — strong (80) ─────────────────────────────── */

export const STRATEGIC_STRONG: InterviewResultData = build({
  overallScore: 80,
  verdict: "hire",
  scoreDelta: 6,
  company: "Razorpay",
  role: "VP of Engineering",
  level: "VP",
  difficulty: "Hard",
  percentile: 76,
  aiVerdict:
    "Excellent stakeholder mapping — 4 distinct constituencies named, trade-off held between them. Vision was concrete ('in 3 years we ship weekly with 40 fewer engineers'). The bet you named — that 3 missed quarters were a process problem, not a talent problem — was specific and falsifiable.",
  strengths: [
    "Vision was concrete and time-anchored (3-year picture)",
    "Held the trade-off across 4 stakeholder groups",
    "Owned the bet — named the specific belief that would falsify your plan",
  ],
  improvements: [
    "Influence reasoning: address how you'd build CEO alignment if their read differed",
  ],
  skills: [
    { name: "Vision clarity", score: 85, roleAvg: 60 },
    { name: "Stakeholder mapping", score: 90, roleAvg: 65 },
    { name: "Resource trade-off", score: 75, roleAvg: 60 },
    { name: "Time horizon", score: 80, roleAvg: 60 },
    { name: "Decision conviction", score: 78, roleAvg: 55 },
    { name: "Influence reasoning", score: 70, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "You inherit a 60-person engineering org with 3 missed quarterly goals. What's your 90-day plan?",
      score: 82,
      band: "strong",
      answer: plain("In the first 30 days, I'd talk to the engineering leads and 10 IC engineers across 3 teams..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 425, responseSec: 480, firstPersonRatioPct: 58, quantificationCount: 8 },
      focusMetrics: [
        { label: "Stakeholders", value: "4", tone: TONE_SUCCESS },
        { label: "Time horizons", value: "3", tone: TONE_SUCCESS },
        { label: "Decision criteria", value: "5", tone: TONE_SUCCESS },
        { label: "Risk owned", value: "Yes", tone: TONE_SUCCESS },
      ],
      whyScored:
        "Excellent stakeholder mapping — named 4 constituencies (engineering, product, sales, board) and held the trade-off. Vision was concrete. The bet you named — 'these were process problems, not talent problems' — was specific and falsifiable. Light on influence reasoning.",
      likelyFollowUp: "How would you build alignment with the CEO if they thought it was a talent problem?",
    },
  ],
});

/* ─── 8. CAMPUS PLACEMENT — partial (58) ─────────────────────── */

export const CAMPUS_PLACEMENT_PARTIAL: InterviewResultData = build({
  overallScore: 58,
  verdict: "leanHire",
  scoreDelta: 0,
  company: "Infosys",
  role: "Software Engineer (Fresher)",
  level: "Fresher",
  difficulty: "Standard",
  percentile: 42,
  aiVerdict:
    "Communication was clean and enthusiasm came through — but the project section drifted to 'we' for most of the architecture description, and tech-stack reasoning stayed surface-level. Fundamentals were solid when probed. Honest mention of a debug session you led was the strongest moment.",
  strengths: [
    "Genuine enthusiasm with specific reasons (chess bot in 11th)",
    "Solid OOP and DBMS fundamentals when probed",
    "Honest 'I learned X from this debug' moment",
  ],
  improvements: [
    "Project ownership: distinguish your specific contribution from teammates'",
    "Tech-stack reasoning: 'we used MongoDB' → 'we used MongoDB because…'",
  ],
  skills: [
    { name: "Project ownership", score: 45, roleAvg: 55 },
    { name: "Project depth", score: 40, roleAvg: 50 },
    { name: "Fundamentals", score: 70, roleAvg: 60 },
    { name: "Genuine enthusiasm", score: 65, roleAvg: 55 },
    { name: "Coachability", score: 50, roleAvg: 60 },
    { name: "Communication", score: 75, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "Walk me through your final-year project. What was your specific contribution?",
      score: 56,
      band: "partial",
      answer: plain("So we built a food delivery app using MERN stack..."),
      star: { situation: true, task: true, action: false, result: false, learning: false },
      metrics: { wordCount: 165, responseSec: 195, firstPersonRatioPct: 38, quantificationCount: 1 },
      focusMetrics: [
        { label: "Project ownership", value: "38%", tone: TONE_ERROR },
        { label: "Architectural", value: "2", tone: TONE_DEFAULT },
        { label: "Fundamentals", value: "5", tone: TONE_SUCCESS },
        { label: "Specific reasons", value: "1", tone: TONE_DEFAULT },
      ],
      whyScored:
        "Communicated cleanly and enthusiasm showed. But the project section drifted to 'we' for most of the architecture description. Tech-stack reasoning was surface-level ('we used MongoDB' without why). Strongest signal: you mentioned a specific bug you debugged — that landed.",
      redFlags: [
        {
          type: "we_without_i",
          severity: "high",
          title: "Vague project role",
          explanation: "'We built the backend' — interviewers will assume the worst. Be explicit: 'I built the auth layer; my teammate built the frontend.'",
          quote: "we built the backend",
        },
        {
          type: "vague",
          severity: "medium",
          title: "Surface-only tech reasoning",
          explanation: "Said you used React/Node/MongoDB without explaining why. 'We chose MongoDB because we had nested user-preference data and didn't need joins' shows actual decision-making.",
          quote: "MongoDB / Express / React",
        },
      ],
      likelyFollowUp: "What was the hardest bug you debugged in this project, and how did you find it?",
    },
  ],
});

/* ─── 9. HR ROUND — weak (42) ────────────────────────────────── */

export const HR_WEAK: InterviewResultData = build({
  overallScore: 42,
  verdict: "noHire",
  scoreDelta: -3,
  company: "Flipkart",
  role: "Senior Product Manager",
  level: "Senior",
  difficulty: "Standard",
  percentile: 22,
  aiVerdict:
    "Negative tone toward your current manager — HR reads this as 'this person will badmouth us next.' Motivation was generic ('great company, great opportunity'). No specific Flipkart research showed: no mention of recent product launches, engineering blog, or any cultural attribute.",
  strengths: [
    "Career trajectory was internally consistent",
    "Salary expectation was reasonable, anchored as a range",
  ],
  improvements: [
    "Reframe negative tone: 'I'm looking for [positive thing]' beats 'my current manager doesn't…'",
    "Specific motivation: name a Flipkart product / blog / launch you researched",
    "Avoid 'great company, great opportunity' — every candidate says this",
  ],
  skills: [
    { name: "Motivation specificity", score: 30, roleAvg: 60 },
    { name: "Authenticity", score: 35, roleAvg: 65 },
    { name: "Career coherence", score: 50, roleAvg: 60 },
    { name: "Salary realism", score: 40, roleAvg: 55 },
    { name: "Cultural alignment", score: 45, roleAvg: 60 },
    { name: "Red-flag absence", score: 25, roleAvg: 70 },
  ],
  questions: [
    {
      index: 1,
      text: "Why are you leaving your current role?",
      score: 38,
      band: "weak",
      answer: plain("Honestly, my current manager doesn't really appreciate my work..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 145, responseSec: 168, firstPersonRatioPct: 68, quantificationCount: 0 },
      focusMetrics: [
        { label: "Specific reasons", value: "1", tone: TONE_ERROR },
        { label: "Trajectory links", value: "1", tone: TONE_DEFAULT },
        { label: "Salary anchored", value: "Yes", tone: TONE_SUCCESS },
        { label: "Negative words", value: "4", tone: TONE_ERROR },
      ],
      whyScored:
        "Leaned negative — 'my current manager doesn't appreciate me' — HR reads this as 'this person will badmouth us next.' Motivation was generic. No Flipkart-specific research surfaced.",
      redFlags: [
        {
          type: "blame",
          severity: "high",
          title: "Negative tone toward previous employer",
          explanation: "Even if true, HR reads this as a future risk. Reframe: 'I'm looking for [positive thing], which my current role can't offer.'",
          quote: "my current manager doesn't appreciate me",
        },
        {
          type: "vague",
          severity: "medium",
          title: "Generic motivation",
          explanation: "Every candidate says 'great company, great opportunity'. One specific reason ('your engineering blog post on X resonated because…') beats five generic ones.",
          quote: "great company, great opportunity",
        },
      ],
      likelyFollowUp: "What specifically about Flipkart's product strategy resonates with your background?",
    },
  ],
});

/* ─── 10. PANEL — strong (78) ────────────────────────────────── */

export const PANEL_STRONG: InterviewResultData = build({
  overallScore: 78,
  verdict: "hire",
  scoreDelta: 4,
  company: "Swiggy",
  role: "Senior Software Engineer",
  level: "SDE-3",
  difficulty: "Hard",
  percentile: 72,
  aiVerdict:
    "Tone calibration across panelists landed — formal with HR partner, technical with tech lead, strategic with hiring manager. Strong cross-panel bridge ('on the technical side, I'd love to dig into that with [Tech Lead]'). One miss: HR's burnout-risk question was answered literally instead of addressing the underlying concern.",
  strengths: [
    "Tone shifted naturally across panelists",
    "Built a bridge: 'building on what {HM} asked' connecting answers",
    "Eye contact distributed across all three panelists",
  ],
  improvements: [
    "Address what HR is actually probing for, not the literal question",
    "Probe the tech lead's question for the depth signal it's testing",
  ],
  skills: [
    { name: "Persona awareness", score: 85, roleAvg: 60 },
    { name: "Tone calibration", score: 75, roleAvg: 55 },
    { name: "Cross-panel consistency", score: 90, roleAvg: 70 },
    { name: "Acknowledgment", score: 70, roleAvg: 60 },
    { name: "Engagement balance", score: 80, roleAvg: 60 },
    { name: "Routing accuracy", score: 75, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "[Hiring Manager] Tell me about a time you led a peer team that disagreed with you.",
      score: 84,
      band: "strong",
      answer: plain("Last quarter at my current company, the platform team and our team disagreed on..."),
      star: { situation: true, task: true, action: true, result: true, learning: false },
      metrics: { wordCount: 245, responseSec: 192, firstPersonRatioPct: 62, quantificationCount: 3 },
      focusMetrics: [
        { label: "Panelists addressed", value: "3", tone: TONE_SUCCESS },
        { label: "Direct response", value: "90%", tone: TONE_SUCCESS },
        { label: "Tone shifts", value: "2", tone: TONE_SUCCESS },
        { label: "Cross-references", value: "1", tone: TONE_SUCCESS },
      ],
      whyScored:
        "Answered the manager directly with influence + outcomes framing (manager-track lens), then bridged: 'On the technical side, the trade-off was X vs Y, which I'd love to dig into with [Tech Lead].' Strong cross-panel signal.",
      likelyFollowUp: "[Tech Lead] What was the technical trade-off you wanted to dig into?",
    },
    {
      index: 2,
      text: "[HR Partner] How do you handle stress during high-pressure releases?",
      score: 72,
      band: "partial",
      answer: plain("I take short breaks, talk to my manager, prioritize ruthlessly..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 165, responseSec: 175, firstPersonRatioPct: 58, quantificationCount: 0 },
      focusMetrics: [
        { label: "Panelists addressed", value: "3", tone: TONE_SUCCESS },
        { label: "Direct response", value: "100%", tone: TONE_SUCCESS },
        { label: "Tone shifts", value: "1", tone: TONE_DEFAULT },
        { label: "Cross-references", value: "0", tone: TONE_DEFAULT },
      ],
      whyScored:
        "Tone-shifted nicely (more conversational, less technical) for HR partner. But missed the underlying concern — they were probing for burnout risk and team-health awareness. You answered the literal question instead of addressing what HR actually wanted to know.",
      redFlags: [
        {
          type: "vague",
          severity: "medium",
          title: "Answered the literal question, not the concern",
          explanation: "HR was probing for burnout-risk awareness + team-health signals. The deeper question was 'how do you spot it in your team', not just 'how do you handle yours'.",
          quote: "",
        },
      ],
      likelyFollowUp: "How do you spot burnout in a teammate before they do?",
    },
  ],
});

/* ─── 11. GOVERNMENT / PSU — partial (60) ────────────────────── */

export const GOVERNMENT_PARTIAL: InterviewResultData = build({
  overallScore: 60,
  verdict: "leanHire",
  scoreDelta: 0,
  company: "Government of India",
  role: "Assistant Section Officer",
  level: "UPSC",
  difficulty: "Standard",
  percentile: 50,
  aiVerdict:
    "Ethics framing was strong and you used 'with respect, sir' framing throughout — appropriate hierarchy tone for government rounds. Hierarchy + procedural reasoning solid. But your answer stayed abstract: no specific RTI Act provisions, no recent rulings cited. Specifics matter more than principles in government rounds.",
  strengths: [
    "Ethics framing held throughout — public-interest first",
    "Hierarchy tone appropriate (deferential without being timid)",
    "Procedural rigor — invoked due process",
  ],
  improvements: [
    "Cite specific schemes / rulings (e.g. Vineeta Sharma judgment on procedural rights)",
    "Use service-language: 'serve / public / citizen' more than 'efficient / optimise'",
  ],
  skills: [
    { name: "Ethics framing", score: 70, roleAvg: 55 },
    { name: "Service orientation", score: 55, roleAvg: 60 },
    { name: "Current affairs", score: 40, roleAvg: 65 },
    { name: "Hierarchy respect", score: 80, roleAvg: 60 },
    { name: "Regulatory comfort", score: 65, roleAvg: 60 },
    { name: "Specific examples", score: 50, roleAvg: 60 },
  ],
  questions: [
    {
      index: 1,
      text: "If your senior asks you to expedite a file that violates due process, what do you do?",
      score: 64,
      band: "partial",
      answer: plain("With respect, sir, I would first try to understand the urgency..."),
      star: { situation: false, task: false, action: false, result: false, learning: false },
      metrics: { wordCount: 285, responseSec: 285, firstPersonRatioPct: 68, quantificationCount: 0 },
      focusMetrics: [
        { label: "Ethics keywords", value: "4", tone: TONE_SUCCESS },
        { label: "Public examples", value: "0", tone: TONE_ERROR },
        { label: "Service language", value: "6", tone: TONE_SUCCESS },
        { label: "Specific policies", value: "0", tone: TONE_ERROR },
      ],
      whyScored:
        "Ethics framing strong — distinguished between hierarchical respect and procedural integrity, used 'with respect, sir' framing. But answer stayed abstract: didn't cite any specific RTI Act provisions or recent rulings (Vineeta Sharma, etc.) that would back your position.",
      redFlags: [
        {
          type: "vague",
          severity: "medium",
          title: "Couldn't cite current policies",
          explanation: "Answered abstractly. Government rounds expect awareness of specific schemes and recent court rulings.",
          quote: "no specific Act or ruling cited",
        },
      ],
      likelyFollowUp: "What's a recent Supreme Court ruling on administrative discretion that informed your view?",
    },
  ],
});
