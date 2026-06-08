/* V2 fixture batch validator (2026-06-09).
 *
 * Walks server-handlers/v2/__fixtures__/inbox/*.json, runs the
 * deterministic v2 brain on each, and reports invariant breaks per
 * turn. Designed for the workflow:
 *
 *   1. Drop real-session transcripts into the inbox (PII intact, the
 *      folder is gitignored).
 *   2. Run `npx tsx scripts/v2-fixture-validate.ts`.
 *   3. Read the report. Each "would-have-shipped" deviation from
 *      _v2_expected_picks is a candidate failure mode for the next
 *      foundation move.
 *   4. Sanitize + promote the most informative fixtures into the
 *      tracked __fixtures__/ folder as regression contracts.
 *
 * The validator is LLM-free — it asks `legalTools(state)` at each AI
 * turn and checks that the expected tool was IN the legal set. This is
 * the weakest-possible assertion (the kernel didn't FORBID the right
 * move) but it's exactly the v1 failure mode v2 is meant to make
 * impossible. Strong assertions (which tool the LLM picked given
 * legal-set membership) require the LLM and live in the e2e test. */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveState, legalTools, type ConversationTurn, type ToolName } from "../server-handlers/v2/kernel";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FixtureFile {
  meta?: {
    company?: string;
    role?: string;
    level?: string;
    yoe?: number;
    candidate_ctc?: number;
    candidate_target?: number;
    notes?: string;
  };
  log: ConversationTurn[];
  _v2_expected_picks?: Record<string, { tool: ToolName; _comment?: string }>;
}

interface TurnReport {
  aiTurnIndex: number;
  expectedTool?: ToolName;
  legalSet: ToolName[];
  inLegalSet: boolean;
  state: ReturnType<typeof deriveState>;
}

interface FixtureReport {
  file: string;
  meta: FixtureFile["meta"];
  turns: TurnReport[];
  violations: TurnReport[];
}

const INBOX_DIR = path.join(__dirname, "..", "server-handlers", "v2", "__fixtures__", "inbox");

function isJsonFile(name: string): boolean {
  return name.endsWith(".json") && !name.startsWith(".");
}

async function listFixtures(): Promise<string[]> {
  const entries = await fs.readdir(INBOX_DIR).catch(() => [] as string[]);
  return entries.filter(isJsonFile).sort();
}

async function readFixture(file: string): Promise<FixtureFile> {
  const raw = await fs.readFile(path.join(INBOX_DIR, file), "utf8");
  return JSON.parse(raw) as FixtureFile;
}

function validateFixture(file: string, fixture: FixtureFile): FixtureReport {
  const turns: TurnReport[] = [];
  const violations: TurnReport[] = [];
  const expected = fixture._v2_expected_picks ?? {};

  /* For each AI turn, walk the log UP TO (not including) that turn,
   * derive state, and ask what the legal set was. Then check whether
   * the expected pick (if specified) was in the set. */
  let aiTurnIndex = 0;
  for (let i = 0; i < fixture.log.length; i++) {
    const turn = fixture.log[i];
    if (turn.role !== "ai") continue;
    aiTurnIndex++;
    const priorLog = fixture.log.slice(0, i);
    const state = deriveState(priorLog);
    const legalSet = legalTools(state);
    const exp = expected[String(aiTurnIndex)];
    const expectedTool = exp?.tool;
    const inLegalSet = expectedTool ? legalSet.includes(expectedTool) : true;
    const report: TurnReport = { aiTurnIndex, expectedTool, legalSet, inLegalSet, state };
    turns.push(report);
    if (expectedTool && !inLegalSet) violations.push(report);
  }
  return { file, meta: fixture.meta, turns, violations };
}

function formatReport(reports: FixtureReport[]): string {
  if (reports.length === 0) {
    return "No fixtures in inbox. Drop JSON files into\n  server-handlers/v2/__fixtures__/inbox/\nSee inbox/README.md for the shape.";
  }
  const lines: string[] = [];
  let totalViolations = 0;
  let totalTurns = 0;

  /* Coverage matrix */
  const matrix = new Map<string, number>();
  for (const r of reports) {
    const key = `${r.meta?.company ?? "?"} / ${r.meta?.role ?? "?"}`;
    matrix.set(key, (matrix.get(key) ?? 0) + r.turns.length);
  }
  lines.push("=== coverage ===");
  for (const [k, v] of Array.from(matrix.entries()).sort()) {
    lines.push(`  ${k.padEnd(40, " ")} ${v} turn(s)`);
  }
  lines.push("");

  /* Per-fixture detail */
  for (const r of reports) {
    totalTurns += r.turns.length;
    totalViolations += r.violations.length;
    const status = r.violations.length === 0 ? "PASS" : `FAIL (${r.violations.length})`;
    lines.push(`=== ${r.file} — ${status} ===`);
    for (const v of r.violations) {
      lines.push(
        `  T${v.aiTurnIndex}: expected=${v.expectedTool} NOT in legal=${v.legalSet.join(",")}  ` +
          `(state: anchored=${v.state.hasAnchored}, offerAsks=${v.state.offerAskCount}, accepted@${v.state.verbalAcceptanceTurn ?? "-"})`,
      );
    }
  }
  lines.push("");
  lines.push(
    `=== summary: ${reports.length} fixture(s), ${totalTurns} AI turn(s), ${totalViolations} violation(s) ===`,
  );
  return lines.join("\n");
}

async function main(): Promise<number> {
  const files = await listFixtures();
  const reports: FixtureReport[] = [];
  for (const file of files) {
    try {
      const fixture = await readFixture(file);
      reports.push(validateFixture(file, fixture));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[v2-fixture-validate] ${file} — parse error: ${(err as Error).message}`);
      return 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(formatReport(reports));
  const violations = reports.reduce((acc, r) => acc + r.violations.length, 0);
  return violations === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(2);
  },
);
