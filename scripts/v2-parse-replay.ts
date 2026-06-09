#!/usr/bin/env tsx
/* V2 parse-coverage replay CLI (2026-06-09).
 *
 * Run the regex parser AND the LLM extractor over every candidate turn
 * in a saved conversation log. Prints a per-turn diff plus an
 * aggregate "regex coverage on the union" headline number.
 *
 * Purpose: validate (or invalidate) the parse-coverage hypothesis on
 * the Flipkart fixture today, WITHOUT touching production sessions.
 *
 * Usage:
 *
 *   GROQ_API_KEY=... npx tsx scripts/v2-parse-replay.ts \
 *     server-handlers/v2/__fixtures__/flipkart-senior-pd.json
 *
 *   # Machine-readable
 *   ... npx tsx scripts/v2-parse-replay.ts <fixture> --json
 *
 * Input file format: same as v2 fixtures —
 *   { "log": [ { "role": "ai"|"candidate", "text": "...", "tool"?, "lpa"? } ] }
 *
 * Exit code is always 0 — this is a measurement, not a gate. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callLLM } from "../server-handlers/_llm";
import type { GenerateAiTextFn } from "../server-handlers/_response-pipeline";
import {
  replayLogAsync,
  summarizeRecords,
  type ComparisonRecord,
} from "../server-handlers/v2/parse-compare";
import type { ConversationTurn } from "../server-handlers/v2/kernel";

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit: (code: number) => never;
  stdout: { write: (s: string) => void };
};

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const skipEmpty = args.includes("--skip-empty");
const fixturePath = args.find((a) => !a.startsWith("--"));

if (!fixturePath) {
  console.error(
    "usage: npx tsx scripts/v2-parse-replay.ts <fixture.json> [--json]",
  );
  process.exit(1);
}

/* Build a GenerateAiTextFn that joins system + user into a single
 * prompt (callLLM's interface), then returns the raw text. callLLM
 * owns model selection (Groq → Gemini → Cerebras fallback chain). */
const generateAiText: GenerateAiTextFn = async (system, user, opts) => {
  const prompt = `${system}\n\n${user}`;
  const result = await callLLM(
    {
      prompt,
      temperature: opts?.temperature ?? 0,
      jsonMode: true,
      fast: true,
    },
    20_000,
    { userId: opts?.userId, endpoint: "v2-parse-replay" },
  );
  return result.text;
};

interface Fixture {
  log?: ConversationTurn[];
  conversationLog?: ConversationTurn[];
}

async function main() {
  const abs = resolve(fixturePath!);
  const raw = readFileSync(abs, "utf8");
  const fixture = JSON.parse(raw) as Fixture;
  const rawLog = fixture.log ?? fixture.conversationLog;
  if (!Array.isArray(rawLog)) {
    console.error(`fixture ${abs} has no .log or .conversationLog array`);
    process.exit(1);
  }
  /* --skip-empty filters empty-string candidate turns. Those are
   * recording artifacts (screenshots/PDFs ingested as blanks), not
   * legitimate utterances. Including them lets the LLM hallucinate
   * from prior context — see the v0 replay readout. */
  const log = skipEmpty
    ? rawLog.filter((t) => t.role !== "candidate" || t.text.trim().length > 0)
    : rawLog;
  if (skipEmpty && !jsonMode) {
    const dropped = rawLog.length - log.length;
    console.log(`--skip-empty: dropped ${dropped} empty-text candidate turn(s)\n`);
  }

  if (!jsonMode) {
    console.log(`\n=== parse-replay: ${abs} ===`);
    console.log(`candidate turns: ${log.filter((t) => t.role === "candidate").length}\n`);
  }

  const records = await replayLogAsync(log, generateAiText);

  if (jsonMode) {
    process.stdout.write(
      JSON.stringify(
        { fixture: abs, records, summary: summarizeRecords(records) },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  printPerTurnTable(records);
  printSummary(records);
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function printPerTurnTable(records: ComparisonRecord[]) {
  for (const r of records) {
    console.log(`--- turn ${r.turnIndex} ---`);
    console.log(`  candidate: "${trunc(r.candidateText, 100)}"`);
    console.log(`  regex numbers: [${r.regex.numbers_added.join(", ")}]`);
    console.log(
      `  llm numbers:   [${(r.llm?.numbers ?? [])
        .map((n) => `${n.value}:${n.kind}`)
        .join(", ")}]`,
    );
    if (r.numbersOverlap.regex_only.length || r.numbersOverlap.llm_only.length) {
      console.log(
        `  ⚠️  regex-only: [${r.numbersOverlap.regex_only.join(", ")}] | llm-only: [${r.numbersOverlap.llm_only.join(", ")}]`,
      );
    }
    console.log(
      `  offer_ask: regex=${r.regex.offer_ask_fired} llm=${r.llm?.is_offer_ask ?? "n/a"}${r.disagreeOfferAsk ? " ⚠️" : ""}`,
    );
    console.log(
      `  acceptance: regex=${r.regex.acceptance_fired} llm=${r.llm?.acceptance ?? "n/a"}${r.disagreeAcceptance ? " ⚠️" : ""}`,
    );
    if (r.llm?.conditions.length) {
      console.log(`  llm conditions: ${JSON.stringify(r.llm.conditions)}`);
    }
    console.log();
  }
}

function printSummary(records: ComparisonRecord[]) {
  const s = summarizeRecords(records);
  console.log(`=== summary ===`);
  console.log(`candidate turns:       ${s.totalCandidateTurns}`);
  console.log(`llm parse failures:    ${s.llmParseFailures}`);
  console.log(
    `regex coverage (union): ${(s.regexCoverageOnUnion * 100).toFixed(1)}%`,
  );
  console.log(
    `llm coverage (union):   ${(s.llmCoverageOnUnion * 100).toFixed(1)}%`,
  );
  console.log(
    `offer-ask agreement:    ${(s.offerAskAgreement * 100).toFixed(1)}%`,
  );
  console.log(
    `acceptance agreement:   ${(s.acceptanceAgreement * 100).toFixed(1)}%`,
  );
  console.log(`numbers only regex saw: [${s.numbersOnlyRegexSaw.join(", ")}]`);
  console.log(`numbers only llm saw:   [${s.numbersOnlyLlmSaw.join(", ")}]`);
  console.log(`disagreement count:     ${s.disagreementCount}`);
  console.log();
  console.log(
    "decision rule (no-patchwork): if regex coverage on union < 75% AND llm coverage > 90%,",
  );
  console.log(
    "                              parse layer IS the bottleneck → plan Move 1 properly.",
  );
  console.log(
    "                              else → I was wrong, leave the regex banks alone.",
  );
}

main().catch((err) => {
  console.error("replay failed:", err);
  process.exit(1);
});
