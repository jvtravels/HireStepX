/* Pure helpers for the "Generate fix plan" feature.
 *
 * Takes a snapshot of open issues + recent flagged sessions and produces
 * an LLM prompt that asks for a prioritized, file-targeted fix plan —
 * NOT applied automatically. The output is a recommendations list the
 * admin reviews, then implements as code changes.
 */

export interface FixPlanInput {
  focus?: string;                       // optional filter
  openIssues: { flag: string; count: number; severity_high: number; example_evidence: string[] }[];
  flaggedSessions: { session_id: string; focus: string; flags: string[]; hallucinations_summary: string[] }[];
  registeredFocuses: string[];
}

export interface FixPlanItem {
  priority: "high" | "medium" | "low";
  title: string;
  target_file: string;            // suggested file path
  change: string;                 // 1-2 sentence proposed change
  rationale: string;              // why
  affected_flags: string[];       // which flags this addresses
}

export interface FixPlanOutput {
  summary: string;                // 2-3 sentence overview
  items: FixPlanItem[];
  cautions: string[];             // things to watch when applying
}

export function buildFixPlanPrompt(input: FixPlanInput): string {
  const filterNote = input.focus ? `Filter: only fixes for focus "${input.focus}".` : "Across all focuses.";

  const issueLines = input.openIssues.length === 0
    ? "  (no open issues)"
    : input.openIssues
        .map((i) => `  - ${i.flag}: ${i.count} occurrences (${i.severity_high} high-severity). Example evidence: ${(i.example_evidence[0] || "").slice(0, 200)}`)
        .join("\n");

  const sessionLines = input.flaggedSessions.length === 0
    ? "  (none)"
    : input.flaggedSessions
        .slice(0, 8)
        .map((s) => `  - ${s.session_id.slice(0, 14)} [${s.focus}]: ${s.flags.join(", ") || "(no flags)"}${s.hallucinations_summary.length ? ` — halluc: ${s.hallucinations_summary.slice(0, 2).join("; ")}` : ""}`)
        .join("\n");

  return `You are the engineering lead for HireStepX, an AI mock-interview platform.
Your job: turn the data below into a SHORT, ACTIONABLE FIX PLAN — concrete code changes the team can implement today.

${filterNote}

CODE LAYOUT (so you can target files accurately):
- Live AI prompts for the interview (the AI that talks to users): src/Interview.tsx + src/useInterviewEngine.ts (look for system prompt / persona blocks)
- Live evaluator (scores answers): src/interviewEvaluation.ts + server-handlers/evaluate-session.ts
- Question generation: server-handlers/_generate-questions-helpers.ts + server-handlers/generate-questions.ts
- Salary data ground-truth: data/salaries.ts + data/company-salary-overrides.ts
- Per-focus analyzers (the audit pass): server-handlers/analyzers/<focus>.ts
- Question bank / story bank: data/ files + active-learning loop in server-handlers/_question-retrieval.ts

ROUTE FIXES TO THE RIGHT LAYER:
- Hallucinations (fake_*, implausible_*, ai_invented_*) → live AI prompt OR data/* file. Tighten the system prompt or update ground-truth data.
- Rubric gaps (weak_*, frequent_missing_*, ai_accept*) → live evaluator prompt OR live AI prompt. Make the AI probe harder or score stricter.
- Bad questions (duplicate_question, leaked_answer) → question-generation prompt or dedup logic.
- Analyzer bugs (analyzer_error, false-positive flag patterns) → server-handlers/analyzers/<focus>.ts regex.

Respond ONLY with JSON in this exact shape:
{
  "summary": "<2-3 sentences. What's the biggest theme today and what should we ship first?>",
  "items": [
    {
      "priority": "high|medium|low",
      "title": "<short title, max 70 chars>",
      "target_file": "<exact path, e.g. server-handlers/analyzers/salary-negotiation.ts>",
      "change": "<1-2 sentences describing the exact edit. Be specific — name the regex, the variable, the data value to change.>",
      "rationale": "<why this fixes the issue>",
      "affected_flags": ["<flag>", "..."]
    }
  ],
  "cautions": ["<thing to watch when applying>", "..."]
}

Limits:
- 3-7 items. Don't pad. If the data is thin, return fewer.
- Prefer high-impact, low-risk changes first.
- If a fix needs human judgment (e.g. "decide whether to lower the senior tier ceiling"), say so explicitly.

DATA:

Open issues:
${issueLines}

Recent flagged sessions:
${sessionLines}

Registered analyzer focuses: ${input.registeredFocuses.join(", ")}
`.trim();
}

export function parseFixPlan(jsonText: string): FixPlanOutput {
  const out: FixPlanOutput = { summary: "", items: [], cautions: [] };
  try {
    const parsed = JSON.parse(jsonText) as Partial<FixPlanOutput>;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.summary === "string") out.summary = parsed.summary.slice(0, 1000);
      if (Array.isArray(parsed.items)) {
        out.items = parsed.items
          .filter((x): x is FixPlanItem => Boolean(x && typeof x === "object"))
          .slice(0, 10)
          .map((it) => ({
            priority: (["high", "medium", "low"] as const).includes(it.priority as "high" | "medium" | "low") ? it.priority : "medium",
            title: String(it.title || "").slice(0, 200),
            target_file: String(it.target_file || "").slice(0, 200),
            change: String(it.change || "").slice(0, 1000),
            rationale: String(it.rationale || "").slice(0, 600),
            affected_flags: Array.isArray(it.affected_flags) ? it.affected_flags.slice(0, 8).map((f) => String(f).slice(0, 80)) : [],
          }));
      }
      if (Array.isArray(parsed.cautions)) {
        out.cautions = parsed.cautions.slice(0, 6).map((c) => String(c).slice(0, 300));
      }
    }
  } catch {
    /* fall through with empty fields */
  }
  return out;
}
