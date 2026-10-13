#!/usr/bin/env node
/* WCAG 1.4.3 / 1.4.11 guard for the design tokens in src/auth/_tokens.ts.
   Exits non-zero when any listed text/background pair drops below its
   threshold. Run: node scripts/check-contrast.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { evaluatePairs, parseTokens } from "./contrast-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = parseTokens(readFileSync(join(root, "src/auth/_tokens.ts"), "utf8"));
const results = evaluatePairs(tokens);

for (const r of results) {
  console.log(`${r.pass ? "ok  " : "FAIL"} ${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} (>= ${r.min}) ${r.why}`);
}
const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} contrast pair(s) below threshold`);
  process.exit(1);
}
