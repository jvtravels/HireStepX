import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import CanvasProviders from "../../../CanvasProviders";
import InterviewResult, {
  DEFAULT_RESULT,
  type InterviewResultData,
  type AnswerSpan,
  type Question,
} from './InterviewResult';

const page: TempoPage = {
  name: "Interview result",
};

export default page;

/* Interview result canvas — best-in-class post-session feedback surface.
   Four storyboards demonstrate how the visual system + verdict + tile
   bands adapt across performance bands without changing structure:
   the report shape stays constant; colour-coding does the lifting. */

export const InterviewResultHire: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult />
    </CanvasProviders>
  ),
  name: "1. Hire — score 72",
  layout: { x: 0, y: 0, width: 1440, height: 3522 },
};

const LEAN_HIRE: InterviewResultData = {
  ...DEFAULT_RESULT,
  overallScore: 58,
  verdict: "leanHire",
  scoreDelta: 4,
  aiVerdict:
    "Your structure is improving but answers still skew abstract. Land more questions with a concrete result number — that's what closes the gap from Lean Hire to Hire.",
  strengths: [
    "Friendly, conversational opening",
    "Used STAR structure on Q4 and Q5",
    "Picked up follow-ups quickly",
  ],
  improvements: [
    "Quantify outcomes — most answers had no measurable result",
    "Cut filler phrases ('basically', 'I think')",
    "Slow down by ~10% so reasoning lands",
  ],
  metrics: [
    { label: "Filler words / min", value: 6.4, targetLabel: "Target 0–3", band: "needsWork" },
    { label: "Silence ratio", value: 26, unit: "%", targetLabel: "Target 0–20%", band: "needsWork" },
    { label: "Pace (WPM)", value: 198, targetLabel: "Target 140–180", band: "ok" },
    { label: "Energy", value: 54, unit: "/100", targetLabel: "Target 60–100", band: "needsWork" },
  ],
  skills: [
    { name: "Technical Depth", score: 60, roleAvg: 66 },
    { name: "Problem Framing", score: 64, roleAvg: 64 },
    { name: "Communication", score: 56, roleAvg: 60 },
    { name: "Trade-off Reasoning", score: 50, roleAvg: 60 },
    { name: "Ownership", score: 58, roleAvg: 64 },
  ],
};

export const InterviewResultLeanHire: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={LEAN_HIRE} />
    </CanvasProviders>
  ),
  name: "2. Lean Hire — score 58",
  layout: { x: 1490, y: 0, width: 1440, height: 3351 },
};

const STRONG_HIRE: InterviewResultData = {
  ...DEFAULT_RESULT,
  overallScore: 89,
  verdict: "strongHire",
  scoreDelta: 11,
  aiVerdict:
    "Excellent session. You frame problems clearly, quantify outcomes, and weigh trade-offs without prompting. Push yourself on harder system-design rounds and salary negotiation — those are the next ceilings.",
  strengths: [
    "Quantified every answer (8 of 8 had a number)",
    "Strong trade-off articulation in Q4 and Q6",
    "Asked 3 thoughtful follow-ups at close",
  ],
  improvements: [
    "Trim opening preamble — get to the result faster",
    "On Q5 the framing was strong but the conclusion drifted",
  ],
  metrics: [
    { label: "Filler words / min", value: 1.8, targetLabel: "Target 0–3", band: "good" },
    { label: "Silence ratio", value: 14, unit: "%", targetLabel: "Target 0–20%", band: "good" },
    { label: "Pace (WPM)", value: 162, targetLabel: "Target 140–180", band: "good" },
    { label: "Energy", value: 84, unit: "/100", targetLabel: "Target 60–100", band: "good" },
  ],
  skills: [
    { name: "Technical Depth", score: 92, roleAvg: 66 },
    { name: "Problem Framing", score: 88, roleAvg: 64 },
    { name: "Communication", score: 90, roleAvg: 60 },
    { name: "Trade-off Reasoning", score: 86, roleAvg: 60 },
    { name: "Ownership", score: 84, roleAvg: 64 },
  ],
  weakestSkill: {
    name: "Ownership",
    tip: "Push for stronger I-statements on outcomes you owned end-to-end vs contributed to.",
  },
  scoreConfidence: "high",
  scoreConfidenceNote: undefined,
  readinessSentence: "You're at the role bar. Run 2 more sessions to lock in consistency, then call it.",
  storyReuseFindings: [
    {
      storyLabel: "API migration story",
      body: "Used in 4 of last 5 sessions — pair with one more strong narrative before your real round.",
    },
  ],
  blindSpots: [
    {
      title: "Negotiation under pressure",
      body: "Strong on technical signal; we haven't seen you under salary-negotiation pressure yet. Run a negotiation drill before your real interview.",
    },
  ],
};

export const InterviewResultStrongHire: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={STRONG_HIRE} />
    </CanvasProviders>
  ),
  name: "3. Strong Hire — score 89",
  layout: { x: 0, y: 3050, width: 1440, height: 3379 },
};

const NO_HIRE: InterviewResultData = {
  ...DEFAULT_RESULT,
  overallScore: 38,
  verdict: "noHire",
  scoreDelta: -8,
  aiVerdict:
    "This session shows real foundational gaps — most answers stayed at headline level, and several technical questions surfaced misconceptions. Two-three weeks of targeted prep will move this band meaningfully.",
  strengths: [
    "Showed up — completed all 6 questions",
    "Honest about uncertainty rather than guessing",
  ],
  improvements: [
    "Answers are too short — most under 60 words",
    "No quantified results in any answer",
    "Technical fundamentals on Q3 and Q4 need reset",
    "Filler rate is high — slow down and structure",
  ],
  metrics: [
    { label: "Filler words / min", value: 9.1, targetLabel: "Target 0–3", band: "needsWork" },
    { label: "Silence ratio", value: 38, unit: "%", targetLabel: "Target 0–20%", band: "needsWork" },
    { label: "Pace (WPM)", value: 124, targetLabel: "Target 140–180", band: "needsWork" },
    { label: "Energy", value: 42, unit: "/100", targetLabel: "Target 60–100", band: "needsWork" },
  ],
  skills: [
    { name: "Technical Depth", score: 32, roleAvg: 66 },
    { name: "Problem Framing", score: 44, roleAvg: 64 },
    { name: "Communication", score: 48, roleAvg: 60 },
    { name: "Trade-off Reasoning", score: 28, roleAvg: 60 },
    { name: "Ownership", score: 40, roleAvg: 64 },
  ],
  weakestSkill: {
    name: "Trade-off Reasoning",
    tip: "Start with system-design fundamentals — read the standard reference cards and run 3 mock drills before the next round.",
  },
};

export const InterviewResultNoHire: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={NO_HIRE} />
    </CanvasProviders>
  ),
  name: "4. No Hire — score 38",
  layout: { x: 1490, y: 3050, width: 1440, height: 3359 },
};

/* ── Salary-negotiation context ──────────────────────────────────────
   The negotiation interview type has a separate evaluation rubric in
   production (anchor strength, BATNA articulation, concession rate).
   Storyboard #5 demonstrates how the same report shape carries the
   negotiation-specific metrics + skills without breaking layout —
   labels and skill names change; structure does not. */

const NEGOTIATION: InterviewResultData = {
  ...DEFAULT_RESULT,
  overallScore: 64,
  verdict: "leanHire",
  scoreDelta: 6,
  percentile: 54,
  recentScores: [50, 56, 58, 64],
  readiness: { pct: 64, etaWeeks: 1 },
  daysUntilInterview: 5,
  role: "Senior PM (Salary Negotiation)",
  level: "L5",
  difficulty: "Hard",
  aiVerdict:
    "You held your anchor well and articulated trade-offs clearly. Practice deflecting the budget question without conceding, and tighten your BATNA framing — those are the two moves that close the L4-to-L5 negotiation gap.",
  strengths: [
    "Anchored at 32 LPA without flinching when challenged",
    "Articulated impact in measurable terms (3 hires, 4× pipeline)",
    "Held silence after the counter-offer landed",
  ],
  improvements: [
    "Deflect 'what's your current CTC?' instead of disclosing",
    "Tighten BATNA framing — current offer comparison was vague",
    "Stop using 'I'd be open to…' — concedes negotiating room",
  ],
  metrics: [
    { label: "Anchor strength", value: 78, unit: "/100", targetLabel: "Target 70+", band: "good" },
    { label: "Concession rate", value: 12, unit: "%", targetLabel: "Target <15%", band: "good" },
    { label: "Silence held (sec)", value: 4.2, targetLabel: "Target 3+", band: "good" },
    { label: "Disclosure leaks", value: 2, targetLabel: "Target 0", band: "needsWork" },
  ],
  skills: [
    { name: "Anchor Discipline", score: 78, roleAvg: 62 },
    { name: "BATNA Framing", score: 58, roleAvg: 64 },
    { name: "Pushback Handling", score: 70, roleAvg: 60 },
    { name: "Trade-off Articulation", score: 72, roleAvg: 64 },
    { name: "Silence Tolerance", score: 65, roleAvg: 50 },
  ],
  weakestSkill: {
    name: "BATNA Framing",
    tip: "Lead with a concrete alternative ('my current offer is X at Y') before negotiating — vague BATNAs collapse under direct pressure.",
  },
};

export const InterviewResultNegotiation: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={NEGOTIATION} />
    </CanvasProviders>
  ),
  name: "5. Salary negotiation — score 64",
  layout: { x: 0, y: 6100, width: 1440, height: 3437 },
};

/* ── Graceful degradation: first-session, missing optional fields ──
   Real signal that the report holds up when the optional fields the
   server CAN'T compute on session #1 (percentile, recentScores,
   readiness) aren't present. The hero collapses to score-only;
   sparkline doesn't render; readiness band is omitted; tabs gracefully
   disable Restructured + Top Performer when those answers haven't
   been generated yet (e.g. pre-LLM-rewrite path). */

const FIRST_SESSION_PARTIAL: InterviewResultData = {
  ...DEFAULT_RESULT,
  overallScore: 56,
  verdict: "leanHire",
  scoreDelta: 0,
  // Intentionally absent: percentile, recentScores, readiness, daysUntilInterview
  percentile: undefined,
  recentScores: undefined,
  readiness: undefined,
  daysUntilInterview: undefined,
  aiVerdict:
    "First session in this role context. Useful baseline — clear structure, room to add quantified outcomes. We'll surface trend + percentile from session #2 onwards.",
  // First-session contract: cross-session insights, story-reuse,
  // blind-spots, trend-strip, and Coach's Notes all collapse to
  // nothing. Confidence chip flips to "low" because we have no
  // cohort baseline yet. Demonstrates conditional rendering.
  scoreConfidence: "low",
  scoreConfidenceNote: "First session — score will recalibrate as we learn your patterns",
  priorSessionCount: 0,
  crossSessionInsights: undefined,
  storyReuseFindings: undefined,
  blindSpots: undefined,
  thoughtBubble: undefined,
  readinessSentence: undefined,
};

export const InterviewResultFirstSession: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={FIRST_SESSION_PARTIAL} />
    </CanvasProviders>
  ),
  name: "6. First session — partial data (graceful degrade)",
  layout: { x: 1490, y: 6100, width: 1440, height: 3000 },
};

/* ── Long session (10 questions) — triggers progressive disclosure ──
   Pro users on Panel + Strategy tracks see 10+ questions per session.
   The PerQuestionSection caps the primary view at 3 cards with a
   "Show 7 more questions" reveal so the report stays scannable. This
   storyboard demonstrates the reveal in its initial state. */

/* Build the 9 trailing questions as plain object literals so the
   validator's minimal tsconfig (no full ES lib) doesn't trip on
   Array.from / Pick / satisfies / etc. Verbose but bulletproof. */
const COLLAPSED_BODY: AnswerSpan[] = [{ text: "(answer collapsed — expand to view)" }];
const STAR_FULL = { situation: true, task: true, action: true, result: true, learning: false };
const COACHING_PLACEHOLDER = "Coaching note for this question would render here.";

const LONG_SESSION_QUESTIONS: Question[] = [
  /* The first question is hand-crafted (instead of pulled from
     DEFAULT_RESULT.questions[0]) so the validator's strict tsconfig
     doesn't trip on numeric-index access of an imported array
     literal. Functionally identical; the storyboard's purpose is
     showing the progressive-disclosure reveal anyway. */
  { index: 1,  text: "Tell me about a time you solved a difficult problem.",                              score: 48, band: "weak",     answer: COLLAPSED_BODY, star: { situation: true, task: true, action: true, result: false, learning: false }, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 78, responseSec: 168, firstPersonRatioPct: 22, quantificationCount: 0 } },
  { index: 2,  text: "How do you align engineering with product priorities?",                              score: 88, band: "strong",   answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 102, responseSec: 138, firstPersonRatioPct: 26, quantificationCount: 0 } },
  { index: 3,  text: "Walk me through your most ambiguous decision in the last 6 months.",                 score: 72, band: "complete", answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 114, responseSec: 156, firstPersonRatioPct: 27, quantificationCount: 1 } },
  { index: 4,  text: "Describe a technical trade-off you'd defend even if leadership disagreed.",          score: 60, band: "partial",  answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 126, responseSec: 174, firstPersonRatioPct: 28, quantificationCount: 2 } },
  { index: 5,  text: "How do you onboard a new engineer in your first month with them?",                  score: 78, band: "complete", answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 138, responseSec: 192, firstPersonRatioPct: 29, quantificationCount: 0 } },
  { index: 6,  text: "Tell me about a time you killed a project that wasn't working.",                     score: 55, band: "partial",  answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 150, responseSec: 210, firstPersonRatioPct: 30, quantificationCount: 1 } },
  { index: 7,  text: "Where do you see frontend tooling going in the next 2 years?",                      score: 70, band: "complete", answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 162, responseSec: 228, firstPersonRatioPct: 31, quantificationCount: 2 } },
  { index: 8,  text: "How do you quantify the impact of a refactor with no user-facing change?",          score: 64, band: "partial",  answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 174, responseSec: 246, firstPersonRatioPct: 32, quantificationCount: 0 } },
  { index: 9,  text: "Describe a disagreement with a senior peer that you handled well.",                  score: 82, band: "strong",   answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 186, responseSec: 264, firstPersonRatioPct: 33, quantificationCount: 1 } },
  { index: 10, text: "What's the question you wish I'd asked you today?",                                  score: 90, band: "strong",   answer: COLLAPSED_BODY, star: STAR_FULL, whyScored: COACHING_PLACEHOLDER, metrics: { wordCount: 198, responseSec: 282, firstPersonRatioPct: 34, quantificationCount: 2 } },
];

const LONG_SESSION: InterviewResultData = {
  ...DEFAULT_RESULT,
  overallScore: 76,
  scoreDelta: 4,
  questions: LONG_SESSION_QUESTIONS,
};

export const InterviewResultLongSession: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={LONG_SESSION} />
    </CanvasProviders>
  ),
  name: "7. Long session — 10 questions (progressive disclosure)",
  layout: { x: 0, y: 9150, width: 1440, height: 3229 },
};
