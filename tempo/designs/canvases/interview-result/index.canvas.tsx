import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import CanvasProviders from "../../../CanvasProviders";
import InterviewResult, { DEFAULT_RESULT, type InterviewResultData } from './InterviewResult';

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
  layout: { x: 0, y: 0, width: 1440, height: 2400 },
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
  layout: { x: 1490, y: 0, width: 1440, height: 2400 },
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
};

export const InterviewResultStrongHire: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <InterviewResult data={STRONG_HIRE} />
    </CanvasProviders>
  ),
  name: "3. Strong Hire — score 89",
  layout: { x: 0, y: 2450, width: 1440, height: 2400 },
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
  layout: { x: 1490, y: 2450, width: 1440, height: 2400 },
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
  layout: { x: 0, y: 4900, width: 1440, height: 2400 },
};
