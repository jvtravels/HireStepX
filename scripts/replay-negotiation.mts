/**
 * Replay harness for the salary-negotiation feature.
 *
 *   npx tsx scripts/replay-negotiation.mts                          # runs every fixture
 *   npx tsx scripts/replay-negotiation.mts flipkart-ux-senior-broken
 *   npx tsx scripts/replay-negotiation.mts --json                   # machine-readable
 *
 * Why this exists: the feedback loop "ship → user retests → screenshots
 * → guess at cause" was unscientific. This harness reads recorded LLM
 * outputs from scripts/replay-fixtures/*.json and runs them through
 * the failure-detector in server-handlers/_negotiation-failures.ts.
 *
 * Each fixture turn has an `expected` list of failure codes. The
 * harness fails CI when:
 *   - a turn produces a failure code NOT in `expected` (regression)
 *   - a turn DOES NOT produce a code listed in `expected` (the
 *     fixture is supposed to demonstrate that bug, and it can't)
 *
 * To document a NEW production failure: capture the broken LLM output,
 * paste it into a new turn block, populate `expected` with the codes
 * that should fire, commit the fixture. The detector + the unit tests
 * make sure no future "fix" silently re-breaks it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { detectAllFailures } from "../server-handlers/_negotiation-failures";

interface FixtureTurn {
  _label?: string;
  isInitialOffer?: boolean;
  questionIndex?: number;
  phase?: string;
  candidateTargetLpa?: number | null;
  competingOfferLpa?: number | null;
  acceptedImmediately?: boolean;
  llmOutput: string;
  expected?: string[];
}

interface Fixture {
  _comment?: string;
  session?: Record<string, unknown>;
  band?: { initialOffer: number; maxStretch: number; walkAway: number; hasEquity?: boolean };
  turns: FixtureTurn[];
}

const FIXTURES_DIR = join(process.cwd(), "scripts", "replay-fixtures");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const fixtureFilters = args.filter(a => !a.startsWith("--"));

interface TurnResult {
  fixture: string;
  turnIndex: number;
  label: string;
  detected: string[];
  expected: string[];
  missingFromDetected: string[];
  unexpectedlyDetected: string[];
  passed: boolean;
  evidence: Array<{ code: string; evidence?: string; message: string }>;
}

const results: TurnResult[] = [];

const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter(f => f.endsWith(".json"))
  .filter(f => fixtureFilters.length === 0 || fixtureFilters.some(filter => f.includes(filter)));

if (fixtureFiles.length === 0) {
  console.error(`No fixtures matched ${fixtureFilters.join(", ")}. Available:`);
  readdirSync(FIXTURES_DIR).filter(f => f.endsWith(".json")).forEach(f => console.error(`  - ${f.replace(".json", "")}`));
  process.exit(1);
}

for (const fixtureFile of fixtureFiles) {
  const path = join(FIXTURES_DIR, fixtureFile);
  const fixture: Fixture = JSON.parse(readFileSync(path, "utf8"));
  const fixtureName = fixtureFile.replace(".json", "");

  fixture.turns.forEach((turn, idx) => {
    const failures = detectAllFailures({
      llmOutput: turn.llmOutput,
      acceptedImmediately: turn.acceptedImmediately ?? false,
      candidateTargetLpa: turn.candidateTargetLpa ?? null,
      competingOfferLpa: turn.competingOfferLpa ?? null,
      band: fixture.band,
      phase: turn.phase,
      questionIndex: turn.questionIndex,
      isInitialOffer: turn.isInitialOffer ?? false,
    });
    const detected = failures.map(f => f.code);
    const expected = turn.expected ?? [];
    const missingFromDetected = expected.filter(c => !detected.includes(c));
    const unexpectedlyDetected = detected.filter(c => !expected.includes(c));
    const passed = missingFromDetected.length === 0 && unexpectedlyDetected.length === 0;

    results.push({
      fixture: fixtureName,
      turnIndex: idx,
      label: turn._label ?? `turn-${idx + 1}`,
      detected,
      expected,
      missingFromDetected,
      unexpectedlyDetected,
      passed,
      evidence: failures.map(f => ({ code: f.code, evidence: f.evidence, message: f.message })),
    });
  });
}

const passedCount = results.filter(r => r.passed).length;
const failedCount = results.length - passedCount;

if (asJson) {
  console.log(JSON.stringify({ totalTurns: results.length, passed: passedCount, failed: failedCount, results }, null, 2));
  process.exit(failedCount > 0 ? 1 : 0);
}

/* ── Human-readable report ─────────────────────────────────────────── */
console.log(`\n📼  Negotiation replay — ${results.length} turns across ${fixtureFiles.length} fixtures\n`);

let currentFixture = "";
for (const r of results) {
  if (r.fixture !== currentFixture) {
    currentFixture = r.fixture;
    console.log(`\n━━━ ${r.fixture} ━━━`);
  }
  const status = r.passed ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${status}  turn ${r.turnIndex + 1}: ${r.label}`);
  if (r.expected.length > 0) console.log(`  expected: ${r.expected.join(", ")}`);
  if (r.detected.length > 0) console.log(`  detected: ${r.detected.join(", ")}`);
  if (r.missingFromDetected.length > 0) {
    console.log(`  ⚠ MISSING (fixture says these should fire but detector didn't): ${r.missingFromDetected.join(", ")}`);
  }
  if (r.unexpectedlyDetected.length > 0) {
    console.log(`  ⚠ UNEXPECTED (detector flagged but fixture didn't expect): ${r.unexpectedlyDetected.join(", ")}`);
  }
  for (const e of r.evidence) {
    console.log(`    - [${e.code}] ${e.message}`);
    if (e.evidence) console.log(`      evidence: "${e.evidence.slice(0, 120).replace(/\s+/g, " ")}"`);
  }
}

console.log(`\n━━━ Summary ━━━`);
console.log(`Total turns:  ${results.length}`);
console.log(`Passed:       ${passedCount}`);
console.log(`Failed:       ${failedCount}`);
if (failedCount > 0) {
  console.log(`\nA failed turn means the detector and the fixture disagreed. Either:`);
  console.log(`  - the fixture's "expected" list is wrong (update it), OR`);
  console.log(`  - the detector is wrong (update _negotiation-failures.ts).`);
  console.log(`Don't paper over a mismatch by editing the fixture's llmOutput — that's the recorded reality.`);
}

process.exit(failedCount > 0 ? 1 : 0);
