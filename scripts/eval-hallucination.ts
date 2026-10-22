#!/usr/bin/env tsx
/**
 * Hallucination eval: LLM-as-judge regression check on fact grounding.
 *
 * Generates interview questions through the REAL generate-questions handler
 * for a rotating sample of (company x role x focus) cells, has a judge model
 * extract every company-specific claim from each question, then cross-checks
 * those claims against data/company-known-facts.ts in code.
 *
 *   GROQ_API_KEY=... npm run eval:hallucination
 *   npm run eval:hallucination -- --sample 6 --threshold 0.05 --output eval-hallucination.json
 *
 * Flags:
 *   --sample <n>        cells to run this time (default 8). Successive weekly
 *                       runs rotate through the full matrix.
 *   --offset <n>        rotation start (default: ISO week number x sample)
 *   --threshold <0-1>   max acceptable hallucination rate (default 0.05)
 *   --output <file>     write the JSON result to a file
 *   --delay-ms <n>      pause between LLM calls for free-tier RPM (default 2500)
 *   --verbose           keep the handlers' own console output
 *   --list              print the cell matrix and exit
 *
 * Exit codes:
 *   0  rate <= threshold, or skipped because no provider key is set
 *   1  rate above threshold
 *   2  usage error, or nothing could be judged (provider errors)
 *
 * Needs GROQ_API_KEY or GEMINI_API_KEY. */

import { writeFileSync } from "node:fs";
import {
  describeMissingProviderKey,
  EVAL_ORIGIN,
  hasHandlerProviderKey,
  isolateHandlerEnv,
} from "./_eval-handler-env";
import { getKnownFacts } from "../data/company-known-facts";
import {
  auditQuestion,
  buildJudgePrompt,
  parseJudgeVerdict,
  pickCells,
  summarizeAudit,
  type QuestionAudit,
} from "../server-handlers/_hallucination-eval-helpers";

type EvalCell = readonly [company: string, role: string, focus: string];

const EVAL_CELLS: readonly EvalCell[] = [
  ["razorpay", "Software Engineer", "system-design"],
  ["razorpay", "ML Engineer", "technical"],
  ["phonepe", "Software Engineer", "system-design"],
  ["flipkart", "Product Manager", "case-study"],
  ["swiggy", "Product Manager", "case-study"],
  ["zomato", "Product Manager", "case-study"],
  ["cred", "Product Designer", "case-study"],
  ["zerodha", "Software Engineer", "system-design"],
  ["meesho", "Product Manager", "case-study"],
  ["amazon", "Software Engineer", "behavioral"],
  ["google", "Software Engineer", "system-design"],
  ["microsoft", "Product Manager", "behavioral"],
  ["stripe", "Software Engineer", "technical"],
  ["mckinsey", "Management Consultant", "case-study"],
  ["bcg", "Management Consultant", "case-study"],
  ["bain", "Management Consultant", "case-study"],
  ["goldman", "Software Engineer", "behavioral"],
  ["jane-street", "Quantitative Researcher", "technical"],
  ["tcs", "Software Engineer", "behavioral"],
  ["infosys", "Software Engineer", "behavioral"],
];

const DISPLAY_NAMES: Record<string, string> = { tcs: "TCS", bcg: "BCG", cred: "CRED", "jane-street": "Jane Street", goldman: "Goldman Sachs" };

function displayName(key: string): string {
  return DISPLAY_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

const args = process.argv.slice(2);
const flagValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const log = (msg: string) => process.stderr.write(`${msg}\n`);

const sample = Number(flagValue("--sample") ?? "8");
const threshold = Number(flagValue("--threshold") ?? "0.05");
const delayMs = Number(flagValue("--delay-ms") ?? "2500");
const outputPath = flagValue("--output");
const verbose = args.includes("--verbose");

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

const auditableCells = EVAL_CELLS.filter(([company]) => getKnownFacts(displayName(company)) !== null);

if (args.includes("--list")) {
  for (const [c, r, f] of auditableCells) process.stdout.write(`${c}\t${r}\t${f}\n`);
  process.exit(0);
}

if (!Number.isInteger(sample) || sample < 1 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1 || !Number.isFinite(delayMs) || delayMs < 0) {
  log("Invalid flags: --sample must be a positive integer, --threshold 0-1, --delay-ms non-negative");
  process.exit(2);
}

function writeResult(result: Record<string, unknown>) {
  if (outputPath) writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (!hasHandlerProviderKey()) {
  const reason = describeMissingProviderKey();
  log(`[eval-hallucination] skipped: ${reason}`);
  writeResult({ skipped: true, reason });
  process.exit(0);
}

isolateHandlerEnv();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function main(): Promise<void> {
  const original = { warn: console.warn, error: console.error, info: console.info, log: console.log };
  const mute = () => {
    if (verbose) return;
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.log = () => {};
  };
  const restore = () => Object.assign(console, original);

  mute();
  const { default: generate } = await import("../server-handlers/generate-questions");
  const { callLLM, extractJSON } = await import("../server-handlers/_llm");
  restore();

  const offset = Number(flagValue("--offset") ?? String(isoWeek(new Date()) * sample));
  const cells = pickCells(auditableCells, sample, offset);
  log(`[eval-hallucination] ${cells.length}/${auditableCells.length} cells (offset ${offset})`);

  const audits: Array<QuestionAudit & { company: string; role: string; focus: string }> = [];
  const errors: string[] = [];
  const models = new Set<string>();

  for (const [i, [company, role, focus]] of cells.entries()) {
    const label = `${company}/${role}/${focus}`;
    const req = new Request(`${EVAL_ORIGIN}/api/generate-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: EVAL_ORIGIN, "x-real-ip": "127.0.0.1" },
      body: JSON.stringify({ type: focus, focus, difficulty: "medium", role, company: displayName(company), experienceLevel: "3-5", mini: true }),
    });
    mute();
    let questions: string[] = [];
    try {
      const res = await generate(req);
      const body: unknown = await res.json().catch(() => null);
      if (res.status !== 200 || !isRecord(body) || !Array.isArray(body.questions)) {
        errors.push(`${label}: generate HTTP ${res.status}`);
      } else {
        questions = body.questions
          .filter((q): q is Record<string, unknown> => isRecord(q) && q.type === "question" && typeof q.aiText === "string")
          .map((q) => String(q.aiText));
        if (body._fallback === "static") errors.push(`${label}: static fallback served, not LLM output`);
      }
    } catch (err) {
      errors.push(`${label}: generate threw ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      restore();
    }

    const facts = getKnownFacts(displayName(company));
    for (const question of questions) {
      if (delayMs > 0) await sleep(delayMs);
      mute();
      try {
        const judged = await callLLM({ prompt: buildJudgePrompt(displayName(company), question), temperature: 0, maxTokens: 700, jsonMode: true, fast: true }, 30000);
        models.add(judged.model);
        const verdict = parseJudgeVerdict(extractJSON(judged.text));
        if (!verdict) {
          errors.push(`${label}: judge returned unusable JSON`);
          continue;
        }
        const audit = auditQuestion(question, verdict, facts);
        audits.push({ ...audit, company, role, focus });
        if (audit.isHallucination) log(`[eval-hallucination] FLAG ${label}: ${audit.unverifiedClaims.join(" | ")}`);
      } catch (err) {
        errors.push(`${label}: judge threw ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        restore();
      }
    }
    log(`[eval-hallucination] ${i + 1}/${cells.length} ${label}: ${questions.length} questions`);
    if (i < cells.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  const summary = summarizeAudit(audits, threshold);
  const result = {
    skipped: false,
    threshold,
    ...summary,
    judgeModels: [...models],
    cellsRun: cells.length,
    errors,
    flagged: audits.filter((a) => a.isHallucination),
    audits,
  };
  writeResult(result);

  const rate = summary.rate === null ? "n/a" : `${(summary.rate * 100).toFixed(1)}%`;
  log(`[eval-hallucination] judged ${summary.judged}, hallucinated ${summary.hallucinated}, rate ${rate} (threshold ${(threshold * 100).toFixed(1)}%), ${errors.length} errors`);
  if (summary.judged === 0) {
    log("[eval-hallucination] inconclusive: no question could be judged");
    process.exit(2);
  }
  process.exit(summary.exceedsThreshold ? 1 : 0);
}

main().catch((err) => {
  log(`[eval-hallucination] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(2);
});
