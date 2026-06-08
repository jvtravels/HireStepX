/* V2 band-overrides CSV importer (2026-06-09).
 *
 * Read a CSV of calibrated band cells, validate every row, and merge
 * into data/v2-band-overrides.json. Uncited rows are rejected. Existing
 * entries are overwritten only when the imported row has a newer
 * source string (lexicographic — by convention sources end in the
 * YYYY-Qx tag).
 *
 * CSV shape (header required):
 *   company,role,level,initialOffer,maxStretch,walkAway,hasEquity,source
 *   flipkart,Senior Product Designer,senior,38,50,30,true,Glassdoor + Levels.fyi 2026-Q2
 *   razorpay,Senior Software Engineer,senior,42,58,32,true,Levels.fyi median 2026-Q2
 *
 * Usage:
 *   npx tsx scripts/v2-band-overrides-import.ts <path-to-csv>
 *   npx tsx scripts/v2-band-overrides-import.ts --dry-run <path-to-csv>
 *
 * Exits 0 on clean merge, 1 if any row fails validation. */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OVERRIDES_PATH = path.join(__dirname, "..", "data", "v2-band-overrides.json");

interface OverrideRow {
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  hasEquity?: boolean;
  source: string;
}

interface OverridesFile {
  $comment?: string;
  $schema_version?: number;
  overrides: Record<string, OverrideRow>;
}

function normalizeRoleKey(role: string): string {
  return role
    .toLowerCase()
    .replace(/\b(sr\.?|senior)\b/g, "senior")
    .replace(/\bproduct\s+designer\b/g, "pd")
    .replace(/\bsoftware\s+engineer\b/g, "swe")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ParseError {
  row: number;
  field: string;
  message: string;
}

interface ParsedRow {
  key: string;
  override: OverrideRow;
}

function parseCsv(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, field: "file", message: "CSV needs header + at least one row" }] };
  }
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const required = ["company", "role", "level", "initialoffer", "maxstretch", "walkaway", "source"];
  for (const req of required) {
    if (!header.includes(req)) {
      return { rows: [], errors: [{ row: 0, field: req, message: `missing required column "${req}"` }] };
    }
  }
  const colIdx = (name: string) => header.indexOf(name);
  const cCompany = colIdx("company");
  const cRole = colIdx("role");
  const cLevel = colIdx("level");
  const cInit = colIdx("initialoffer");
  const cStretch = colIdx("maxstretch");
  const cWalk = colIdx("walkaway");
  const cEquity = colIdx("hasequity");
  const cSource = colIdx("source");

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((s) => s.trim());
    const rowN = i + 1;
    const company = cells[cCompany]?.toLowerCase();
    const role = cells[cRole];
    const level = cells[cLevel]?.toLowerCase();
    const initialOffer = Number(cells[cInit]);
    const maxStretch = Number(cells[cStretch]);
    const walkAway = Number(cells[cWalk]);
    const hasEquity = cEquity >= 0 ? /^(true|1|yes|y)$/i.test(cells[cEquity] ?? "") : undefined;
    const source = cells[cSource];

    if (!company) errors.push({ row: rowN, field: "company", message: "empty" });
    if (!role) errors.push({ row: rowN, field: "role", message: "empty" });
    if (!level) errors.push({ row: rowN, field: "level", message: "empty" });
    if (!Number.isFinite(initialOffer) || initialOffer <= 0)
      errors.push({ row: rowN, field: "initialOffer", message: `not a positive number: "${cells[cInit]}"` });
    if (!Number.isFinite(maxStretch) || maxStretch <= 0)
      errors.push({ row: rowN, field: "maxStretch", message: `not a positive number: "${cells[cStretch]}"` });
    if (!Number.isFinite(walkAway) || walkAway <= 0)
      errors.push({ row: rowN, field: "walkAway", message: `not a positive number: "${cells[cWalk]}"` });
    if (!source || source.length < 5)
      errors.push({ row: rowN, field: "source", message: `cite a source (Glassdoor URL, Levels.fyi median, internal comp band ID, >= 5 chars)` });
    if (walkAway > initialOffer || initialOffer > maxStretch)
      errors.push({ row: rowN, field: "band", message: `must have walkAway <= initialOffer <= maxStretch (got ${walkAway} / ${initialOffer} / ${maxStretch})` });

    if (errors.some((e) => e.row === rowN)) continue;

    rows.push({
      key: `${company}|${normalizeRoleKey(role)}|${level}`,
      override: { initialOffer, maxStretch, walkAway, ...(hasEquity !== undefined && { hasEquity }), source },
    });
  }

  return { rows, errors };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--"));
  if (!csvPath) {
    // eslint-disable-next-line no-console
    console.error("usage: npx tsx scripts/v2-band-overrides-import.ts [--dry-run] <path-to-csv>");
    return 2;
  }

  const csvText = await fs.readFile(csvPath, "utf8");
  const { rows, errors } = parseCsv(csvText);

  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error(`[v2-band-import] ${errors.length} validation error(s):`);
    for (const e of errors) {
      // eslint-disable-next-line no-console
      console.error(`  row ${e.row}, field ${e.field}: ${e.message}`);
    }
    return 1;
  }

  const existingText = await fs.readFile(OVERRIDES_PATH, "utf8");
  const existing = JSON.parse(existingText) as OverridesFile;
  const merged: OverridesFile = {
    ...existing,
    overrides: { ...existing.overrides },
  };

  let added = 0;
  let updated = 0;
  for (const { key, override } of rows) {
    const prior = merged.overrides[key];
    if (!prior) {
      merged.overrides[key] = override;
      added++;
      continue;
    }
    /* Conservative: only overwrite when the new source SORTS LATER —
     * by convention sources include a YYYY-Qx tag at the end. Avoids
     * a stale CSV silently downgrading a fresh override. */
    if (override.source > prior.source) {
      merged.overrides[key] = override;
      updated++;
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[v2-band-import] skipping ${key} — existing source "${prior.source}" sorts >= incoming "${override.source}"`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[v2-band-import] ${rows.length} row(s) parsed, ${added} added, ${updated} updated`);
  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log("[v2-band-import] --dry-run — not writing");
    return 0;
  }
  await fs.writeFile(OVERRIDES_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(`[v2-band-import] wrote ${OVERRIDES_PATH}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(2);
  },
);
