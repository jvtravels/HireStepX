/* Orphan-export detector — architectural bug-prevention (2026-05-15).
 *
 * Walks every `server-handlers/_*.ts` file and, for each exported symbol,
 * grep the codebase for non-test, non-archive references outside the
 * defining file. If zero non-test referents → orphan → fail.
 *
 * Prevents the next "tested but never called" disaster (lockAnchor /
 * effectiveAnchorLpa / clampAnchorAgainstCandidateAsk / etc.) where a
 * helper passes its own unit tests but never gets wired into the call
 * graph.
 *
 * Failure output lists each orphan + its file so the next move is to
 * either wire it in (preferred) or add to the allowlist with a
 * justification comment.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const REPO_ROOT = join(__dirname, "..", "..");
const HANDLERS_DIR = join(REPO_ROOT, "server-handlers");

/** Intentional public-API exports with no in-repo non-test consumer. Each
 *  entry MUST carry a one-line justification — do NOT bulk-add entries to
 *  silence this test; that defeats the point. The right answer for almost
 *  every orphan is to wire it in. */
const ALLOWLIST: ReadonlyMap<string, string> = new Map([
  /* ── Kernel public constants — documentation surface ──────────────── */
  ["MAX_INR_LPA", "kernel-public clamp constant; documentation surface for downstream validators"],
  ["MAX_NOTICE_DAYS", "kernel-public clamp constant; documentation surface for downstream validators"],
  ["MAX_GAP_MONTHS", "kernel-public clamp constant; documentation surface for downstream validators"],
  ["CONVERSATION_LOG_CAP", "kernel-public log cap; documentation constant"],
  ["detectCurrentEmployer", "internally called inside _negotiation-kernel.ts (rg excludes the defining file)"],

  /* ── Kernel public API exposed for direct external consumers ───────── */
  ["applyPersonaToBand", "public kernel API; persona-derived band shaping is opt-in for consumers"],
  ["detectExplicitDecline", "public kernel predicate; used by orchestrator-side gating not the engine itself"],
  ["detectConsecutiveDeadEnd", "public kernel predicate; surfaces a session-level stuck signal for the analytics layer"],
  ["clampInr", "public kernel clamp; used by intake validators outside this repo's call graph"],
  ["clampNoticeDays", "public kernel clamp; used by intake validators outside this repo's call graph"],
  ["clampGapMonths", "public kernel clamp; used by intake validators outside this repo's call graph"],
  ["foldFactsIntoState", "public kernel ingestor; alternate path for non-LLM fact extraction tooling"],
  ["validateState", "public kernel asserter; called by deserializeState which IS wired; rg's word-boundary misses the property-form call"],

  /* ── Discovery helpers exported for replay / audit tooling ─────────── */
  ["getRequiredDiscoveryItems", "audit-tool public API; used by scripts/audit-* (not always tsconfig-tracked)"],
  ["computeHikeRatio", "audit-tool public API; derived signal exposed for offline analysis"],
  ["ALL_DISCOVERY_STAGES", "documentation enum re-exported via kernel barrels"],
  ["DISCOVERY_SEQUENCE", "documentation enum re-exported via kernel barrels"],
  ["isOrderedDiscoveryComplete", "alternative completeness check; reserved for the strict-ordered mode"],

  /* ── Brief / register helpers ──────────────────────────────────────── */
  ["hrRegisterForCompany", "internally called inside _negotiate-turn-helpers.ts (rg excludes the defining file)"],
  ["formatRegisterGuidance", "internally called inside _negotiate-turn-helpers.ts (rg excludes the defining file)"],

  /* ── DEFERRED — file authored but never wired into the pipeline. ──── *
   * Documented in DEFERRED.md. Wiring these is its own ship.            */
  ["inferMarketMode", "DEFERRED — auto-inference from role not yet wired; market-mode is set explicitly via initState (see DEFERRED.md)"],
  ["getConcessionMultiplier", "DEFERRED — paired with inferMarketMode; consumed once auto-inference ships"],
  ["analyzeEquityClarity", "DEFERRED — trial-close detector authored but not threaded into the brief layer yet (see DEFERRED.md)"],
  ["detectTrialCloseAsked", "DEFERRED — trial-close detector authored but not threaded into the brief layer yet (see DEFERRED.md)"],
  ["detectTrialCloseResponse", "DEFERRED — trial-close detector authored but not threaded into the brief layer yet (see DEFERRED.md)"],
  ["detectVariableComfortAsked", "DEFERRED — trial-close detector authored but not threaded into the brief layer yet (see DEFERRED.md)"],
  ["shouldDiscloseRange", "DEFERRED — range-disclosure helper kept for the planned phase-rule consolidator"],
  ["critiqueRecruiterWithQuotes", "DEFERRED — verbose critique mode used only by the post-session coach surface (not the live engine)"],
]);

interface ExportedSymbol {
  name: string;
  file: string;
}

/* Scope: the kernel + negotiation pipeline. This is where the
 * dead-wiring bug class manifests — `lockAnchor`, `effectiveAnchorLpa`,
 * `clampAnchorAgainstCandidateAsk`, `buildPostAcceptanceMessage` all
 * lived for weeks in these files passing their unit tests but never
 * called from the kernel. Razorpay helpers, CORS shims, etc. are
 * out-of-scope: they're public-API surfaces by design and their
 * test-only consumption is acceptable for our threat model. */
const TARGETED_FILES = [
  "_negotiation-kernel.ts",
  "_kernel-move-picker.ts",
  "_negotiate-turn-helpers.ts",
  "_discovery-stage.ts",
  "_candidate-disclosure-tracker.ts",
  "_post-acceptance.ts",
  "_counter-offer-risk.ts",
  "_range-disclosure-phase.ts",
  "_recruiter-critique.ts",
  "_market-mode.ts",
  "_trial-close-detector.ts",
];

function listHandlerFiles(): string[] {
  const out: string[] = [];
  for (const name of TARGETED_FILES) {
    const full = join(HANDLERS_DIR, name);
    try {
      if (statSync(full).isFile()) out.push(full);
    } catch { /* file may not exist in older refactor states */ }
  }
  return out;
}

/** Extract exported symbol NAMES from a TS file using regex. We match the
 *  common forms: `export function NAME`, `export async function NAME`,
 *  `export const NAME`, `export class NAME`. We deliberately skip
 *  `export type` / `export interface` (type-only — TS types disappear at
 *  runtime and don't have the same "wired" semantics), and skip
 *  `export { NAME }` re-exports (consumer-side re-exports of other files'
 *  symbols would otherwise double-count). */
function extractExports(src: string): string[] {
  const names = new Set<string>();
  const re = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    names.add(m[1]);
  }
  return [...names];
}

function findReferentsRg(symbol: string, definingFile: string): string[] | null {
  const res = spawnSync("rg", [
    `\\b${symbol}\\b`,
    "--type", "ts",
    "--type", "tsx",
    "-l",
    "-g", "!**/*.test.ts",
    "-g", "!**/*.test.tsx",
    "-g", "!**/*.spec.ts",
    "-g", "!**/_archive/**",
    "-g", "!**/_archive_levelup/**",
    "-g", "!**/node_modules/**",
    "-g", "!**/.next/**",
    "-g", "!**/coverage/**",
    "-g", "!**/playwright-report/**",
    "-g", "!**/test-results/**",
    REPO_ROOT,
  ], { encoding: "utf8" });
  if (res.status == null) return null; // rg not present
  if (res.status !== 0 && res.status !== 1) return null;
  const lines = (res.stdout || "").split("\n").filter(Boolean);
  return lines.filter((f) => f !== definingFile);
}

/* JS fallback — walks the repo once, builds a {file: contents} cache,
 * then for each symbol does a word-boundary regex scan. Single repo
 * pass amortises across the symbol iteration; the cache is rebuilt per
 * test run (not memoised) to keep state surface small. */
const SCAN_DIRS = ["server-handlers", "src", "app", "lib", "scripts", "data", "tests/unit"];
const EXCLUDE_FILE_PATTERNS = [/\.test\.tsx?$/, /\.spec\.tsx?$/];
const EXCLUDE_DIR_NAMES = new Set([
  "node_modules", ".next", "coverage", "playwright-report", "test-results", "_archive", "_archive_levelup",
]);

let fileCache: Map<string, string> | null = null;
function buildFileCache(): Map<string, string> {
  if (fileCache) return fileCache;
  const cache = new Map<string, string>();
  function walk(dir: string): void {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const ent of entries) {
      if (EXCLUDE_DIR_NAMES.has(ent)) continue;
      const full = join(dir, ent);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.tsx?$/.test(ent)) continue;
      if (EXCLUDE_FILE_PATTERNS.some((p) => p.test(ent))) continue;
      try { cache.set(full, readFileSync(full, "utf8")); } catch { /* skip unreadable */ }
    }
  }
  for (const d of SCAN_DIRS) walk(join(REPO_ROOT, d));
  fileCache = cache;
  return cache;
}

function findReferentsJs(symbol: string, definingFile: string): string[] {
  const cache = buildFileCache();
  const re = new RegExp(`\\b${symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`);
  const hits: string[] = [];
  for (const [file, src] of cache) {
    if (file === definingFile) continue;
    if (re.test(src)) hits.push(file);
  }
  return hits;
}

function findReferents(symbol: string, definingFile: string): string[] {
  const rgHits = findReferentsRg(symbol, definingFile);
  if (rgHits !== null) return rgHits;
  return findReferentsJs(symbol, definingFile);
}

describe("orphan-export detector", () => {
  it("every exported function/const/class in server-handlers/_*.ts has at least one non-test consumer", () => {
    /* rg is preferred (fast), but the JS fallback (findReferentsJs) keeps
     * the test green when ripgrep isn't installed — necessary for both CI
     * environments without rg and dev machines where the binary lives
     * behind a shell function rather than a PATH entry. */
    const files = listHandlerFiles();
    const orphans: ExportedSymbol[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const exports = extractExports(src);
      for (const name of exports) {
        if (ALLOWLIST.has(name)) continue;
        const referents = findReferents(name, file);
        if (referents.length === 0) {
          orphans.push({ name, file: file.replace(REPO_ROOT + "/", "") });
        }
      }
    }
    if (orphans.length > 0) {
      const msg = orphans
        .map((o) => `  - ${o.name} in ${o.file}`)
        .join("\n");
      throw new Error(
        `Orphan exports detected (defined but never called outside their own file or tests).\n` +
          `Either wire each into the call graph (preferred) or add to ALLOWLIST with a justification:\n${msg}`,
      );
    }
    expect(orphans).toEqual([]);
  });
});
