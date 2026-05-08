/**
 * Import + validate the freelancer-filled salary CSV.
 *
 * Usage:
 *   npx tsx scripts/import-salary-csv.mts --dry-run
 *     → validates the CSV, prints errors, exits non-zero on any failure
 *
 *   npx tsx scripts/import-salary-csv.mts --emit
 *     → writes data/_imported-salary-overrides.generated.ts
 *       which COMPANY_SALARY_OVERRIDES.ts can spread/merge from
 *
 * The validation gate refuses to emit if ANY row fails. This is the
 * critical guardrail that prevents wrong numbers being stamped as
 * verified — every cell ships only after passing source/shape/range
 * checks.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface RawRow {
  [k: string]: string;
}

interface ValidationError {
  row: number;
  company: string;
  role: string;
  level: string;
  trackName: string;
  reason: string;
}

interface ImportedRow {
  company: string;
  role: string;
  level: "entry" | "mid" | "senior" | "lead" | "executive";
  trackName: string;
  totalMin: number;
  totalMax: number;
  baseMin?: number;
  baseMax?: number;
  equityMin?: number;
  equityMax?: number;
  equityType: "rsu" | "esop" | "none";
  equityVesting?: string;
  joiningBonusMin?: number;
  joiningBonusMax?: number;
  variablePct?: number;
  noticePeriodDays?: number;
  bondPenaltyLpa?: number;
  sources: string[];
  agreementCount: number;
  resumeSignals: string[];
  notes?: string;
  lastVerified: string;
}

const CANONICAL_LEVELS = new Set(["entry", "mid", "senior", "lead", "executive"]);
const CANONICAL_EQUITY_TYPES = new Set(["rsu", "esop", "none"]);
const CANONICAL_ROLES = new Set([
  // Engineering core
  "software-engineer", "frontend-developer", "backend-developer", "fullstack-developer",
  "mobile-android", "mobile-ios", "embedded-engineer", "firmware-engineer",
  "qa-engineer", "automation-engineer",
  // Specialized
  "devops-engineer", "sre", "cloud-engineer", "security-engineer", "network-engineer",
  "dba", "etl-developer", "data-engineer", "ml-engineer", "data-scientist", "genai-engineer",
  // Enterprise
  "sap-consultant", "mainframe-developer", "salesforce-developer", "servicenow-developer",
  "oracle-consultant", "solutions-architect", "pre-sales", "technical-writer",
  // Mgmt / non-tech
  "engineering-manager", "product-manager", "program-manager", "project-manager",
  "scrum-master", "business-analyst", "ux-designer", "growth-pm",
]);

const SOURCE_COLS = [
  "sourceGlassdoor",
  "sourceAmbitionbox",
  "sourceLevelsFyi",
  "sourceDrhp",
  "sourceOperatorNetwork",
] as const;

function parseCsv(text: string): RawRow[] {
  const lines = text.split(/\r?\n/);
  // First non-comment, non-blank line is the header.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith("#")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];
  const header = splitCsvLine(lines[headerIdx]);
  const rows: RawRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const cells = splitCsvLine(line);
    const row: RawRow = {};
    header.forEach((col, j) => (row[col] = (cells[j] ?? "").trim()));
    row.__lineNumber = String(i + 1);
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  // Minimal CSV parser. Doesn't handle quoted commas in source URLs perfectly;
  // that's fine because the format guide tells freelancers no commas in URLs.
  // For real production use, swap to papaparse.
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === "," && !inQuote) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function num(v: string | undefined, field: string, errors: ValidationError[], row: RawRow, optional = false): number | undefined {
  if (v === undefined || v === "") {
    if (optional) return undefined;
    errors.push({
      row: Number(row.__lineNumber),
      company: row.company, role: row.role, level: row.level, trackName: row.trackName,
      reason: `Missing required numeric field: ${field}`,
    });
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) {
    errors.push({
      row: Number(row.__lineNumber),
      company: row.company, role: row.role, level: row.level, trackName: row.trackName,
      reason: `Field ${field} is not a number: "${v}"`,
    });
    return undefined;
  }
  return n;
}

function validate(row: RawRow, errors: ValidationError[]): ImportedRow | null {
  const ctx = {
    row: Number(row.__lineNumber),
    company: row.company, role: row.role, level: row.level, trackName: row.trackName,
  };

  if (!row.company) { errors.push({ ...ctx, reason: "Missing company" }); return null; }
  if (!row.role) { errors.push({ ...ctx, reason: "Missing role" }); return null; }
  if (!CANONICAL_ROLES.has(row.role)) {
    errors.push({ ...ctx, reason: `Unknown role "${row.role}". See SALARY_DATA_FREELANCER_BRIEF.md role list.` });
    return null;
  }
  if (!CANONICAL_LEVELS.has(row.level)) {
    errors.push({ ...ctx, reason: `Level must be entry|mid|senior|lead|executive, got "${row.level}"` });
    return null;
  }
  if (!CANONICAL_EQUITY_TYPES.has(row.equityType)) {
    errors.push({ ...ctx, reason: `equityType must be rsu|esop|none, got "${row.equityType}"` });
    return null;
  }

  const totalMin = num(row.totalMin, "totalMin", errors, row);
  const totalMax = num(row.totalMax, "totalMax", errors, row);
  if (totalMin === undefined || totalMax === undefined) return null;
  if (totalMin > totalMax) {
    errors.push({ ...ctx, reason: `totalMin (${totalMin}) > totalMax (${totalMax})` });
    return null;
  }
  if (totalMin < 0.5 || totalMax > 500) {
    errors.push({ ...ctx, reason: `Total CTC out of plausible India range: [${totalMin}, ${totalMax}] LPA` });
    return null;
  }

  const baseMin = num(row.baseMin, "baseMin", errors, row, true);
  const baseMax = num(row.baseMax, "baseMax", errors, row, true);
  if (baseMin !== undefined && baseMax !== undefined && baseMin > baseMax) {
    errors.push({ ...ctx, reason: `baseMin > baseMax` });
    return null;
  }
  if (baseMax !== undefined && baseMax > totalMax) {
    errors.push({ ...ctx, reason: `baseMax (${baseMax}) > totalMax (${totalMax})` });
    return null;
  }

  const equityMin = num(row.equityMin, "equityMin", errors, row, true);
  const equityMax = num(row.equityMax, "equityMax", errors, row, true);
  if (row.equityType === "none" && (equityMin || equityMax)) {
    errors.push({ ...ctx, reason: `equityType=none but equityMin/Max are non-zero` });
    return null;
  }
  if (row.equityType !== "none" && (!equityMin && !equityMax)) {
    errors.push({ ...ctx, reason: `equityType=${row.equityType} but no equity values` });
    return null;
  }

  // Source check — at least one source column populated.
  const sources = SOURCE_COLS
    .map((c) => row[c])
    .filter((s) => s && s.length > 4);
  if (sources.length === 0) {
    errors.push({ ...ctx, reason: "At least one source URL required" });
    return null;
  }

  // Freshness
  if (!row.lastVerified || !/^\d{4}-\d{2}-\d{2}$/.test(row.lastVerified)) {
    errors.push({ ...ctx, reason: `lastVerified must be YYYY-MM-DD, got "${row.lastVerified}"` });
    return null;
  }
  const lvDate = Date.parse(row.lastVerified);
  const now = Date.now();
  const ageDays = (now - lvDate) / 86400_000;
  if (ageDays > 180) {
    errors.push({ ...ctx, reason: `lastVerified is ${Math.round(ageDays)} days old (>180); needs re-verification` });
    return null;
  }

  return {
    company: row.company.toLowerCase().trim(),
    role: row.role,
    level: row.level as ImportedRow["level"],
    trackName: row.trackName || "",
    totalMin, totalMax, baseMin, baseMax,
    equityMin: equityMin || undefined,
    equityMax: equityMax || undefined,
    equityType: row.equityType as ImportedRow["equityType"],
    equityVesting: row.equityVesting || undefined,
    joiningBonusMin: num(row.joiningBonusMin, "joiningBonusMin", errors, row, true),
    joiningBonusMax: num(row.joiningBonusMax, "joiningBonusMax", errors, row, true),
    variablePct: num(row.variablePct, "variablePct", errors, row, true),
    noticePeriodDays: num(row.noticePeriodDays, "noticePeriodDays", errors, row, true),
    bondPenaltyLpa: num(row.bondPenaltyLpa, "bondPenaltyLpa", errors, row, true),
    sources,
    agreementCount: sources.length,
    resumeSignals: row.resumeSignals ? row.resumeSignals.split("|").map((s) => s.trim()).filter(Boolean) : [],
    notes: row.notes || undefined,
    lastVerified: row.lastVerified,
  };
}

/* ─── Main ───────────────────────────────────────────────── */

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isEmit = args.includes("--emit");
if (!isDryRun && !isEmit) {
  console.error("Usage: tsx scripts/import-salary-csv.mts (--dry-run | --emit)");
  process.exit(2);
}

const csvPath = resolve(process.cwd(), "data/salary-data-input.csv");
const csvText = readFileSync(csvPath, "utf-8");
const rawRows = parseCsv(csvText);

const errors: ValidationError[] = [];
const imported: ImportedRow[] = [];
const seenKeys = new Set<string>();

for (const raw of rawRows) {
  const validated = validate(raw, errors);
  if (!validated) continue;
  const key = `${validated.company}|${validated.role}|${validated.level}|${validated.trackName}`;
  if (seenKeys.has(key)) {
    errors.push({
      row: Number(raw.__lineNumber),
      company: validated.company, role: validated.role, level: validated.level, trackName: validated.trackName,
      reason: `Duplicate key (${key})`,
    });
    continue;
  }
  seenKeys.add(key);
  imported.push(validated);
}

console.log(`\nIMPORT SUMMARY`);
console.log(`  CSV rows seen:     ${rawRows.length}`);
console.log(`  Valid rows:        ${imported.length}`);
console.log(`  Errors:            ${errors.length}`);

if (errors.length > 0) {
  console.error(`\nVALIDATION ERRORS (must be fixed before --emit):`);
  for (const e of errors.slice(0, 50)) {
    console.error(`  Line ${e.row}  ${e.company || "?"}/${e.role || "?"}/${e.level || "?"}${e.trackName ? `/${e.trackName}` : ""}: ${e.reason}`);
  }
  if (errors.length > 50) console.error(`  ... and ${errors.length - 50} more`);
  if (!isDryRun) {
    console.error(`\nEmit aborted — fix errors and re-run.`);
    process.exit(1);
  }
}

if (isEmit && errors.length === 0) {
  // Group by company → role → level. Multi-track rows merge into a tracks[]
  // array; the union envelope (totalMin/Max) is computed across tracks.
  type LevelEntry = ImportedRow[];
  const byCompany: Record<string, Record<string, Record<string, LevelEntry>>> = {};
  for (const r of imported) {
    byCompany[r.company] ??= {};
    byCompany[r.company][r.role] ??= {};
    byCompany[r.company][r.role][r.level] ??= [];
    byCompany[r.company][r.role][r.level].push(r);
  }

  const out: string[] = [];
  out.push(`/* AUTO-GENERATED by scripts/import-salary-csv.mts. DO NOT EDIT BY HAND. */`);
  out.push(`/* Source: data/salary-data-input.csv. Re-run \`npm run import:salaries -- --emit\` after editing the CSV. */`);
  out.push(`import type { CompanyBandOverride } from "./company-salary-overrides";`);
  out.push(``);
  out.push(`export const IMPORTED_SALARY_OVERRIDES: Record<string, Record<string, Partial<Record<"entry" | "mid" | "senior" | "lead" | "executive", CompanyBandOverride>>>> = {`);
  for (const co of Object.keys(byCompany).sort()) {
    out.push(`  ${JSON.stringify(co)}: {`);
    for (const role of Object.keys(byCompany[co]).sort()) {
      out.push(`    ${JSON.stringify(role)}: {`);
      for (const lvl of Object.keys(byCompany[co][role])) {
        const cells = byCompany[co][role][lvl];
        const single = cells.length === 1 ? cells[0] : null;
        const isMultiTrack = cells.length > 1 || (cells[0]?.trackName ?? "") !== "";
        const envelope = {
          totalMin: Math.min(...cells.map((c) => c.totalMin)),
          totalMax: Math.max(...cells.map((c) => c.totalMax)),
        };
        const cellsForBase = cells.filter((c) => c.baseMin !== undefined && c.baseMax !== undefined);
        const baseMin = cellsForBase.length ? Math.min(...cellsForBase.map((c) => c.baseMin!)) : undefined;
        const baseMax = cellsForBase.length ? Math.max(...cellsForBase.map((c) => c.baseMax!)) : undefined;
        const totalAgreement = cells.reduce((s, c) => s + c.agreementCount, 0);

        const o: Record<string, unknown> = {
          totalMin: envelope.totalMin,
          totalMax: envelope.totalMax,
          ...(baseMin !== undefined ? { baseMin } : {}),
          ...(baseMax !== undefined ? { baseMax } : {}),
          equityType: single?.equityType ?? cells[0].equityType,
          ...(single?.equityVesting ? { equityVesting: single.equityVesting } : {}),
          source: cells.flatMap((c) => c.sources).join("; "),
          lastVerified: cells[0].lastVerified,
          ...(single?.notes ? { notes: single.notes } : {}),
          agreementCount: totalAgreement,
          ...(single?.noticePeriodDays !== undefined ? { noticePeriodDays: single.noticePeriodDays } : {}),
          ...(single?.bondPenaltyLpa !== undefined ? { bondPenaltyLpa: single.bondPenaltyLpa } : {}),
          ...(single?.variablePct !== undefined ? { variablePctOverride: single.variablePct } : {}),
          ...(single?.joiningBonusMin !== undefined && single?.joiningBonusMax !== undefined
            ? { joiningBonusOverride: [single.joiningBonusMin, single.joiningBonusMax] }
            : {}),
        };

        if (isMultiTrack) {
          o.tracks = cells.map((c) => ({
            trackName: c.trackName || "default",
            totalMin: c.totalMin,
            totalMax: c.totalMax,
            ...(c.baseMin !== undefined ? { baseMin: c.baseMin } : {}),
            ...(c.baseMax !== undefined ? { baseMax: c.baseMax } : {}),
            ...(c.joiningBonusMin !== undefined && c.joiningBonusMax !== undefined
              ? { joiningBonusOverride: [c.joiningBonusMin, c.joiningBonusMax] }
              : {}),
            ...(c.bondPenaltyLpa !== undefined ? { bondPenaltyLpa: c.bondPenaltyLpa } : {}),
            resumeSignals: c.resumeSignals,
            ...(c.notes ? { notes: c.notes } : {}),
          }));
        }

        out.push(`      ${JSON.stringify(lvl)}: ${JSON.stringify(o)},`);
      }
      out.push(`    },`);
    }
    out.push(`  },`);
  }
  out.push(`};`);
  out.push(``);

  const emitPath = resolve(process.cwd(), "data/_imported-salary-overrides.generated.ts");
  writeFileSync(emitPath, out.join("\n"));
  console.log(`\n✓ Wrote ${imported.length} rows → ${emitPath}`);
  console.log(`  ${Object.keys(byCompany).length} companies, ${imported.reduce((s, r) => s + 1, 0)} cells.`);
  console.log(`\nNext: import IMPORTED_SALARY_OVERRIDES from data/_imported-salary-overrides.generated.ts`);
  console.log(`      and merge into COMPANY_SALARY_OVERRIDES (curator overrides win on conflict).`);
}

if (errors.length > 0 && isDryRun) process.exit(1);
