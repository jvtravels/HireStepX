/* LLM rescore pass — runs a stricter scorer over a session and reports
 * the drift vs the live evaluator.
 *
 * Gated by env: LLM_RESCORE_ENABLED=1. When off, returns null and the
 * cron writes scoreDrift=null. When on, called inside the cron *after*
 * the deterministic analyzer; the result is merged into AnalyzerResult.
 *
 * Cost: ~1500 input tokens, ~200 output. With Groq the cost is roughly
 * $0.0003 per session — bounded by MAX_RESCORES_PER_RUN in the cron.
 */

import { callLLM, extractJSON } from "../_llm";
import type { SessionRowForAnalysis, TranscriptTurn } from "./_types";

declare const process: { env: Record<string, string | undefined> };

export function isRescoreEnabled(): boolean {
  return process.env.LLM_RESCORE_ENABLED === "1" || process.env.LLM_RESCORE_ENABLED === "true";
}

/** Trim the transcript so the prompt fits comfortably under 4k tokens.
 *  Keep first 2 turns (intro + first answer) and last 14 turns (closing).
 */
function compactTranscript(turns: TranscriptTurn[]): string {
  if (turns.length <= 16) return turns.map((t) => `${t.speaker}: ${(t.text || "").slice(0, 600)}`).join("\n");
  const head = turns.slice(0, 2);
  const tail = turns.slice(-14);
  const omitted = turns.length - head.length - tail.length;
  const fmt = (t: TranscriptTurn) => `${t.speaker}: ${(t.text || "").slice(0, 600)}`;
  return [...head.map(fmt), `[... ${omitted} turns omitted ...]`, ...tail.map(fmt)].join("\n");
}

const RUBRICS: Record<string, string> = {
  behavioral: `
Score 0-100. Strict rubric:
- STAR completeness: each answer must have Situation, Task, Action, Result. Missing R = max 60.
- Quantification: numeric outcomes required for full credit.
- Specificity: vague claims ("we did well") cap at 50.
- Self-attribution: "I" vs "we" — credit individual ownership.`,
  "salary-negotiation": `
Score 0-100. Strict rubric:
- Anchoring: did the user open with a researched target? No anchor caps at 60.
- BATNA: did the user reference an alternative or walk-away? Missing caps at 70.
- Topic coverage: equity, joining bonus, notice period mentioned? Each missing -5.
- Realism: AI's quoted bands within plausible Indian market? Implausible numbers cap at 40.`,
  technical: `
Score 0-100. Strict rubric:
- Code correctness: did the user write code that handles the asked problem?
- Complexity: stated and accurate Big-O. Wrong claim caps at 50.
- Edge cases: discussed empty input, boundary, overflow? Missing -10 each.
- Communication: walked through approach before coding?`,
  "system-design": `
Score 0-100. Strict rubric:
- Scale probing: established QPS, data size, latency targets before designing? Missing caps at 60.
- Coverage: capacity / API / data model / scaling / failure modes / monitoring — at least 4 of 6.
- Specificity: named concrete tech (cache type, DB type, queue) vs hand-waved? Hand-waving caps at 55.`,
  "hr-round": `
Score 0-100. Strict rubric:
- Self-intro specificity: years, projects, results.
- Professionalism: zero badmouthing past employers.
- Anchor protection: user did NOT volunteer a salary number unprompted.
- Logistics: notice period, availability, location preferences discussed.`,
  strategic: `
Score 0-100. Strict rubric:
- Applied frameworks (not just named) to the specific situation. Naming without applying caps at 55.
- Trade-offs articulated — what would NOT be done. Missing caps at 65.
- Measurable success metrics + timelines stated.
- Stakeholders + risks named explicitly.
- AI pushed back on vague 'it depends' answers.`,
  panel: `
Score 0-100. Strict rubric:
- AI sounded like multiple distinct personas (technical / HR / hiring manager). Single persona caps at 55.
- User adapted tone for different personas (not identical openings).
- Coverage of technical AND behavioral angles.
- Difficulty consistent across personas — no shallow segments.`,
  "case-study": `
Score 0-100. Strict rubric:
- User clarified scope / time horizon / segment before solving. Jumping to solution caps at 60.
- Numbers had sanity checks (order-of-magnitude language).
- Frameworks were applied to numbers, not just named.
- Final recommendation answers the original question explicitly.`,
  management: `
Score 0-100. Strict rubric:
- Stories framed as a manager (team, report, hiring) — IC framing caps at 50.
- Team-level metrics: retention, promotions, hires, performance.
- AI probed difficult conversations / underperformer / firing.
- Leadership philosophy articulated; stakeholder management discussed.`,
  "government-psu": `
Score 0-100. Strict rubric:
- Public-service / nation-building motivation explicit. Missing caps at 60.
- Vocabulary appropriate (not corporate jargon — KPI / sprint / OKR).
- No badmouthing of private sector.
- Current affairs / policy awareness probed.
- Service / posting preferences discussed.`,
};

export interface RescoreResult {
  rescore: number;
  rationale: string;
  evaluator_concerns: string[];
}

/**
 * Returns null when rescore is disabled, the focus has no rubric, or
 * the LLM call fails. Cron treats null as "no rescore data," not "error."
 */
export async function llmRescore(session: SessionRowForAnalysis, focus: string): Promise<RescoreResult | null> {
  if (!isRescoreEnabled()) return null;
  const rubric = RUBRICS[focus];
  if (!rubric) return null;
  if (!Array.isArray(session.transcript) || session.transcript.length < 2) return null;

  const prompt = `You are a strict interview evaluator. Re-score this session against the rubric.
Respond ONLY with JSON in the exact shape:
{ "rescore": <0-100 integer>, "rationale": "<1-2 sentences>", "evaluator_concerns": ["<short concern>", ...] }

FOCUS: ${focus}
LIVE_EVALUATOR_SCORE: ${session.score}
RUBRIC:${rubric}

TRANSCRIPT:
${compactTranscript(session.transcript)}
`.trim();

  try {
    const res = await callLLM({ prompt, temperature: 0.2, maxTokens: 350, jsonMode: true }, 12000, {
      endpoint: "analyzer-rescore",
    });
    const parsed = extractJSON<RescoreResult>(res.text);
    if (!parsed || typeof parsed.rescore !== "number") return null;
    parsed.rescore = Math.max(0, Math.min(100, Math.round(parsed.rescore)));
    parsed.rationale = String(parsed.rationale || "").slice(0, 400);
    parsed.evaluator_concerns = Array.isArray(parsed.evaluator_concerns)
      ? parsed.evaluator_concerns.slice(0, 5).map((c) => String(c).slice(0, 200))
      : [];
    return parsed;
  } catch (e) {
    console.error(`[llm-rescore] failed for ${session.id}: ${(e as Error).message}`);
    return null;
  }
}
