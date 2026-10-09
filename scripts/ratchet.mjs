#!/usr/bin/env node
/* Debt ratchet: per-file counts of known-bad patterns may only go down.
   Fails (exit 1) if any file exceeds its recorded baseline or a new file
   introduces a violation. `--update` lowers the baseline to current counts
   (never raises it unless --allow-increase is passed deliberately). */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const BASELINE = join(ROOT, "scripts", "ratchet-baseline.json");
const SCAN_DIRS = ["src", "server-handlers", "app"];
const MAX_FILE_LINES = 1500;

const isTest = (p) => /__tests__|\.test\.|\.spec\./.test(p);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const count = (text, re) => (text.match(re) || []).length;

const METRICS = {
  // Files above the size limit; value is the line count.
  oversizedFiles: (p, text) => {
    const n = text.split("\n").length;
    return n > MAX_FILE_LINES ? n : 0;
  },
  // Type-system escape hatches in production code.
  typeEscapes: (p, text) =>
    count(text, /as unknown as|@ts-ignore|@ts-expect-error|:\s*any\b|\bas any\b/g),
  // Raw hex colors in components; use tokens instead.
  rawHexColors: (p, text) => (p.endsWith(".tsx") ? count(text, /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g) : 0),
  // Inline style objects; prefer token-backed classes for new code.
  inlineStyles: (p, text) => (p.endsWith(".tsx") ? count(text, /style=\{\{/g) : 0),
};

function measure() {
  const out = Object.fromEntries(Object.keys(METRICS).map((k) => [k, {}]));
  for (const d of SCAN_DIRS) {
    if (!existsSync(join(ROOT, d))) continue;
    for (const abs of walk(join(ROOT, d))) {
      const rel = relative(ROOT, abs);
      if (isTest(rel)) continue;
      const text = readFileSync(abs, "utf8");
      for (const [k, fn] of Object.entries(METRICS)) {
        const v = fn(rel, text);
        if (v > 0) out[k][rel] = v;
      }
    }
  }
  return out;
}

const args = new Set(process.argv.slice(2));
const current = measure();

if (args.has("--init")) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log("ratchet baseline written");
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const failures = [];
const tightened = JSON.parse(JSON.stringify(baseline));

for (const metric of Object.keys(METRICS)) {
  const base = baseline[metric] || {};
  for (const [file, n] of Object.entries(current[metric])) {
    const allowed = base[file] ?? 0;
    if (n > allowed) failures.push(`${metric}: ${file} is ${n} (allowed ${allowed})`);
    else if (n < allowed) tightened[metric][file] = n;
  }
  for (const file of Object.keys(base)) {
    if (!(file in current[metric])) delete tightened[metric][file];
  }
}

const total = (m) => Object.values(current[m]).reduce((a, b) => a + b, 0);
console.log(
  Object.keys(METRICS)
    .map((m) => `${m}: ${m === "oversizedFiles" ? Object.keys(current[m]).length + " files" : total(m)}`)
    .join(" | "),
);

if (args.has("--update") && failures.length === 0) {
  writeFileSync(BASELINE, JSON.stringify(tightened, null, 2) + "\n");
  console.log("ratchet baseline tightened");
}

if (failures.length) {
  console.error("\nRatchet violations (debt may only go down):");
  for (const f of failures) console.error("  - " + f);
  console.error("\nFix the new violations, or shrink debt elsewhere in the same file.");
  process.exit(1);
}
console.log("ratchet ok");
