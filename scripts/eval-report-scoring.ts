#!/usr/bin/env tsx
/**
 * Report-scoring eval: sends every golden transcript through the REAL
 * evaluate-session handler (real prompts, real post-processing, real LLM
 * fallback chain) and judges the reports with the deterministic checker in
 * server-handlers/_report-eval-helpers.ts.
 *
 * Auth, rate limiting, quota, report cache and persistence are bypassed by
 * clearing the Supabase / Upstash env before the handler loads (the handler
 * then treats a localhost origin as authenticated-without-user). Only the
 * provider keys are used.
 *
 *   GROQ_API_KEY=... npm run eval:report
 *   npm run eval:report -- --cases strong-behavioral-pm,injection-pure
 *   npm run eval:report -- --json --output eval-report.json --threshold 0.85
 *
 * Flags:
 *   --threshold <0-1>   minimum pass rate over conclusive cases (default 0.8)
 *   --cases a,b,c       run a subset (cross-case checks only use cases that ran)
 *   --json              machine-readable result on stdout, progress on stderr
 *   --output <file>     also write the JSON result to a file
 *   --delay-ms <n>      pause between cases to respect free-tier RPM (default 2000)
 *   --retries <n>       retries per case on 429/5xx (default 1)
 *   --verbose           keep the handler's own console output
 *   --list              print case ids and exit
 *
 * Exit codes:
 *   0  pass rate >= threshold, or skipped because no provider key is set
 *   1  pass rate below threshold
 *   2  usage error, or inconclusive (more than half the cases hit provider errors)
 *
 * Needs GROQ_API_KEY or GEMINI_API_KEY: evaluate-session refuses to run
 * without one of them, even if Cloudflare Workers AI is configured. */

import { writeFileSync } from "node:fs";
import {
  describeMissingProviderKey,
  EVAL_ORIGIN,
  hasHandlerProviderKey,
  isolateHandlerEnv,
} from "./_eval-handler-env";
import { REPORT_SCORING_GOLDEN, type GoldenCase } from "../data/report-scoring-golden";
import {
  evaluateSuite,
  formatVerdictLine,
  tallyModels,
  type EvalOutcome,
} from "../server-handlers/_report-eval-helpers";

const args = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const jsonMode = args.includes("--json");
const verbose = args.includes("--verbose");
const outputPath = flagValue("--output");
const casesArg = flagValue("--cases");
const threshold = Number(flagValue("--threshold") ?? "0.8");
const delayMs = Number(flagValue("--delay-ms") ?? "2000");
const retries = Number(flagValue("--retries") ?? "1");

const log = (msg: string) => process.stderr.write(`${msg}\n`);

if (args.includes("--list")) {
  for (const c of REPORT_SCORING_GOLDEN) process.stdout.write(`${c.id}\t${c.category}\t${c.description}\n`);
  process.exit(0);
}

if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
  log(`Invalid --threshold "${flagValue("--threshold")}": expected a number between 0 and 1`);
  process.exit(2);
}
if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isInteger(retries) || retries < 0) {
  log("Invalid --delay-ms or --retries: expected non-negative numbers");
  process.exit(2);
}

let goldens: readonly GoldenCase[] = REPORT_SCORING_GOLDEN;
if (casesArg) {
  const wanted = casesArg.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = wanted.filter((id) => !REPORT_SCORING_GOLDEN.some((c) => c.id === id));
  if (unknown.length > 0) {
    log(`Unknown case id(s): ${unknown.join(", ")}`);
    log(`Available: ${REPORT_SCORING_GOLDEN.map((c) => c.id).join(", ")}`);
    process.exit(2);
  }
  goldens = REPORT_SCORING_GOLDEN.filter((c) => wanted.includes(c.id));
}

if (!hasHandlerProviderKey()) {
  const reason = describeMissingProviderKey();
  log(`[eval-report] skipped: ${reason}`);
  if (jsonMode) process.stdout.write(`${JSON.stringify({ skipped: true, reason })}\n`);
  process.exit(0);
}

isolateHandlerEnv();

const ORIGIN = EVAL_ORIGIN;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function readBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const silence = !verbose;
  const original = { warn: console.warn, error: console.error, info: console.info, log: console.log };
  const muteConsole = () => {
    if (!silence) return;
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.log = () => {};
  };
  const restoreConsole = () => Object.assign(console, original);

  muteConsole();
  const { default: handler } = await import("../server-handlers/evaluate-session");
  restoreConsole();

  async function runOnce(golden: GoldenCase): Promise<EvalOutcome> {
    const req = new Request(`${ORIGIN}/api/evaluate-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, "x-real-ip": "127.0.0.1" },
      body: JSON.stringify(golden.request),
    });
    muteConsole();
    let res: Response;
    try {
      res = await handler(req);
    } catch (err) {
      return { kind: "error", status: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      restoreConsole();
    }
    const body = await readBody(res);
    if (res.status === 200 && body.report !== undefined) return { kind: "report", report: body.report };
    const error = typeof body.error === "string" ? body.error : "";
    if (res.status === 422 && error === "no_candidate_answers") {
      return { kind: "rejected", status: res.status, error };
    }
    return { kind: "error", status: res.status, message: error || `HTTP ${res.status}` };
  }

  const outcomes: Record<string, EvalOutcome> = {};
  for (const [i, golden] of goldens.entries()) {
    let outcome = await runOnce(golden);
    for (let attempt = 0; attempt < retries && outcome.kind === "error"; attempt++) {
      log(`[eval-report] ${golden.id}: HTTP ${outcome.status} ${outcome.message} — retrying`);
      await sleep(Math.max(delayMs, 5000));
      outcome = await runOnce(golden);
    }
    outcomes[golden.id] = outcome;
    log(`[eval-report] ${i + 1}/${goldens.length} ${golden.id}: ${outcome.kind}`);
    if (i < goldens.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  const suite = evaluateSuite(goldens, outcomes);
  const models = tallyModels(suite.cases);
  const result = {
    skipped: false,
    threshold,
    passRate: suite.passRate,
    passed: suite.passed,
    failed: suite.failed,
    inconclusive: suite.inconclusive,
    models,
    cases: suite.cases,
  };

  if (outputPath) writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

  const total = suite.cases.length;
  const inconclusiveMajority = suite.inconclusive * 2 > total;
  const belowThreshold = suite.passRate !== null && suite.passRate < threshold;

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const out = (line: string) => process.stdout.write(`${line}\n`);
    out("");
    out("Report-scoring eval");
    out("-------------------");
    for (const v of suite.cases) {
      out(formatVerdictLine(v));
      for (const reason of v.reasons) out(`      - ${reason}`);
    }
    out("");
    out(
      models.length > 0
        ? `Answered by: ${models.map((m) => `${m.model} (${m.provider}) x${m.cases}`).join(", ")}`
        : "Answered by: no model answered any case",
    );
    const rate = suite.passRate === null ? "n/a" : `${(suite.passRate * 100).toFixed(0)}%`;
    out(
      `Pass rate: ${rate} (${suite.passed} passed, ${suite.failed} failed, ${suite.inconclusive} inconclusive) — threshold ${(threshold * 100).toFixed(0)}%`,
    );
  }

  if (inconclusiveMajority) {
    log(`[eval-report] inconclusive: ${suite.inconclusive}/${total} cases hit provider errors`);
    process.exit(2);
  }
  process.exit(belowThreshold ? 1 : 0);
}

main().catch((err) => {
  log(`[eval-report] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(2);
});
