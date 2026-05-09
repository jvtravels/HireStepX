/**
 * Pass-2 AmbitionBox scraper: fetches per-designation pages and extracts
 * `bucketedExperienceLevels` (the 0-1 / 1-3 / 3-6 / 6-9 YOE buckets that
 * AB exposes on /salaries/<co>-salaries/<designation>). Each bucket
 * becomes its own (company, role, level) cell with proper level mapping
 * from the bucket's YOE midpoint.
 *
 * The pass-1 scraper (scrape-ambitionbox.mts) collapses YOE 0-8 → a
 * single "mid" cell using profile-level YOE midpoint. That throws away
 * 3-4× of cell granularity. This script restores it by walking the
 * bucket table on each designation page.
 *
 *   npx tsx scripts/scrape-ambitionbox-yoe.mts                # all 96
 *   npx tsx scripts/scrape-ambitionbox-yoe.mts --limit 5      # smoke test
 *   npx tsx scripts/scrape-ambitionbox-yoe.mts --company tcs  # one co
 *   npx tsx scripts/scrape-ambitionbox-yoe.mts --dry-run      # don't write CSV
 *
 * Output: appends to data/salary-data-input.csv with notes prefixed
 * "AB yoe-bucket scrape:" so the importer can identify and prefer
 * these over the coarser pass-1 rows when both exist for the same
 * (company, role, level).
 *
 * Cost: 96 cos × ~10 designations/co × 2.1s polite delay ≈ 33 min
 * one-time. Subsequent runs hit the on-disk cache (data/.cache/ambitionbox-desig).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";

const CSV_PATH = resolve("data/salary-data-input.csv");
const CO_CACHE_DIR = resolve("data/.cache/ambitionbox");
const DESIG_CACHE_DIR = resolve("data/.cache/ambitionbox-desig");
const TODAY = new Date().toISOString().slice(0, 10);
const POLITE_DELAY_MS = 2_000;
const MIN_BUCKET_DATA_POINTS = 30; // bucket-level threshold (lower than pass-1 since granular)
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Reuse SLUG_OVERRIDES + AB_ROLE_MAP from pass-1 by copying — keeping
// scripts independent so a regression in one doesn't crash the other.
// If these drift, fix in both. (Last sync: 2026-05-09.)
const SLUG_OVERRIDES: Record<string, string> = {
  tcs: "tcs",
  "tech mahindra": "tech-mahindra",
  ltimindtree: "ltimindtree",
  ibm: "ibm",
  "ibm india": "ibm",
  hcl: "hcl-technologies",
  "hcl technologies": "hcl-technologies",
  capgemini: "capgemini",
  cognizant: "cognizant",
  accenture: "accenture",
  infosys: "infosys",
  wipro: "wipro",
  "walmart global tech": "walmart",
  "target india": "target",
  "jpmc": "jpmorgan-chase-and-co",
  "goldman": "goldman-sachs",
  "de shaw": "de-shaw",
  "jane street": "jane-street",
  "byju's": "byjus",
  "p&g": "procter-and-gamble",
  "cashfree": "cashfree-payments",
  "wells fargo india": "wells-fargo",
  "bain": "bain-and-company",
  "ola electric": "ola-electric-mobility",
  "tower research": "tower-research-capital-llc",
  "google": "google",
  "amazon": "amazon",
  "microsoft": "microsoft-corporation",
  "meta": "meta",
  "apple": "apple",
  "stripe": "stripe",
  "uber": "uber",
  "linkedin": "linkedin",
  "salesforce": "salesforce",
  "adobe": "adobe",
  "atlassian": "atlassian",
  "nvidia": "nvidia",
  "qualcomm": "qualcomm",
  "oracle": "oracle",
  "cisco": "cisco",
  "servicenow": "servicenow",
  "workday": "workday",
};

const AB_ROLE_MAP: Record<string, string | null> = {
  "software-engineer": "software-engineer",
  "senior-software-engineer": "software-engineer",
  "senior-soft-engineer": "software-engineer",
  "software-developer": "software-engineer",
  "software-development-engineer": "software-engineer",
  "sde-1": "software-engineer",
  "sde-2": "software-engineer",
  "sde-3": "software-engineer",
  "developer": "software-engineer",
  "java-developer": "backend-developer",
  "python-developer": "backend-developer",
  "node-js-developer": "backend-developer",
  "backend-developer": "backend-developer",
  "frontend-developer": "frontend-developer",
  "front-end-developer": "frontend-developer",
  "fullstack-developer": "fullstack-developer",
  "full-stack-developer": "fullstack-developer",
  "android-developer": "mobile-android",
  "ios-developer": "mobile-ios",
  "mobile-developer": "mobile-android",
  "embedded-software-engineer": "embedded-engineer",
  "embedded-engineer": "embedded-engineer",
  "firmware-engineer": "firmware-engineer",
  "qa-engineer": "qa-engineer",
  "quality-analyst": "qa-engineer",
  "softwaretest-engineer": "qa-engineer",
  "software-test-engineer": "qa-engineer",
  "test-engineer": "qa-engineer",
  "automation-test-engineer": "automation-engineer",
  "automation-engineer": "automation-engineer",
  "devops-engineer": "devops-engineer",
  "sre": "sre",
  "site-reliability-engineer": "sre",
  "cloud-engineer": "cloud-engineer",
  "aws-engineer": "cloud-engineer",
  "security-engineer": "security-engineer",
  "cyber-security-engineer": "security-engineer",
  "network-engineer": "network-engineer",
  "dba": "dba",
  "database-administrator": "dba",
  "etl-developer": "etl-developer",
  "data-engineer": "data-engineer",
  "data-analyst": "data-engineer",
  "ml-engineer": "ml-engineer",
  "machine-learning-engineer": "ml-engineer",
  "data-scientist": "data-scientist",
  "sap-consultant": "sap-consultant",
  "sap-abap-consultant": "sap-consultant",
  "sap-functional-consultant": "sap-consultant",
  "salesforce-developer": "salesforce-developer",
  "servicenow-developer": "servicenow-developer",
  "oracle-developer": "oracle-consultant",
  "solution-architect": "solutions-architect",
  "solutions-architect": "solutions-architect",
  "technical-architect": "solutions-architect",
  "engineering-manager": "engineering-manager",
  "technical-lead": "engineering-manager",
  "tech-lead": "engineering-manager",
  "team-lead": "engineering-manager",
  "product-manager": "product-manager",
  "senior-product-manager": "product-manager",
  "associate-product-manager": "product-manager",
  "program-manager": "program-manager",
  "project-manager": "project-manager",
  "scrum-master": "scrum-master",
  "business-analyst": "business-analyst",
  "ux-designer": "ux-designer",
  "user-experience-designer": "ux-designer",
  "ui-ux-designer": "ux-designer",
  "technical-writer": "technical-writer",
  "system-engineer": "software-engineer",
  "assistant-system-engineer": "software-engineer",
  "system-engineer-hardware": "embedded-engineer",
  "it-analyst": "software-engineer",
  "it-analyst-c2": "software-engineer",
  "it-analyst-grade-c2": "software-engineer",
  "system-administrator": "cloud-engineer",
  "mainframe-developer": "mainframe-developer",
  "specialist-programmer": "software-engineer",
  "technology-analyst": "software-engineer",
  "senior-systems-engineer": "software-engineer",
  "system-associate": "software-engineer",
  "senior-system-associate": "software-engineer",
  "lead-consultant": "solutions-architect",
  "software-quality-engineer": "qa-engineer",
  "test-analyst": "qa-engineer",
  "technical-test-leader": "qa-engineer",
  "associate-consultant": "business-analyst",
  "consultant": "business-analyst",
  "senior-consultant": "business-analyst",
  "principal-consultant": "solutions-architect",
  "delivery-manager": "engineering-manager",
  "project-lead": "engineering-manager",
  "module-lead": "engineering-manager",
  "associate": "software-engineer",
  "senior-associate": "software-engineer",
  "programmer-analyst": "software-engineer",
  "programmer-analyst-trainee": "software-engineer",
  "application-development-analyst": "software-engineer",
  "application-development-senior-analyst": "software-engineer",
  "application-development-associate": "software-engineer",
  "application-development-team-lead": "engineering-manager",
  "application-developer": "software-engineer",
  "senior-application-developer": "software-engineer",
  "packaged-app-development-analyst": "software-engineer",
  "project-engineer": "software-engineer",
  "senior-project-engineer": "software-engineer",
  "associate-software-engineer": "software-engineer",
  "junior-software-engineer": "software-engineer",
  "senior-developer": "software-engineer",
  "software-development-engineer-ii": "software-engineer",
  "software-engineer2": "software-engineer",
  "sde1": "software-engineer",
  "sde2": "software-engineer",
  "lead-engineer": "engineering-manager",
  "senior-technical-lead": "engineering-manager",
  "test-lead": "qa-engineer",
  "senior-test-engineer": "qa-engineer",
  "senior-quality-engineer": "qa-engineer",
  "specialist-testing": "qa-engineer",
  "senior-data-engineer": "data-engineer",
  "senior-consultant-c1": "business-analyst",
  "software-engineering-specialist": "software-engineer",
  "advisory-system-analyst": "software-engineer",
  "member-technical-staff": "software-engineer",
  "senior-member-of-technical-staff": "software-engineer",
  "technical-specialist": "solutions-architect",
  "technical-manager": "engineering-manager",
  "lead-administrator": "cloud-engineer",
  "senior-administrator": "cloud-engineer",
  "administrator": "cloud-engineer",
  "management-consultant": "business-analyst",
  "advanced-analyst": "business-analyst",
  // Skips (same as pass-1)
  "process-associate": null,
  "senior-process-associate": null,
  "process-specialist": null,
  "senior-processing-executive": null,
  "customer-service-executive": null,
  "operations-executive": null,
  "hr-executive": null,
  "accountant": null,
  "sales-executive": null,
  "relationship-manager": null,
  "branch-manager": null,
  "sales-officer": null,
  "sales-manager": null,
  "area-sales-manager": null,
  "key-account-manager": null,
  "business-development-executive": null,
  "store-manager": null,
  "credit-manager": null,
  "personal-banker": null,
  "deputy-manager-grade-2": null,
  "avp": null,
  "processing-executive": null,
  "transaction-processing-associate": null,
  "customer-service-associate": null,
  "customer-support-associate": null,
  "customer-support-executive": null,
  "customer-care-executive": null,
  "content-moderator": null,
  "transaction-risk-investigator": null,
  "operations-manager": null,
  "process-leader": null,
  "senior-project-associate": null,
  "associate2": null,
  "financial-analyst": null,
};

interface AbBucket {
  minCtc: number;
  maxCtc: number;
  avgCtc: number;
  minExp: number;
  maxExp: number;
  count: number;
  bucketLabel: string | null;
  typicalMinCtc: number;
  typicalMaxCtc: number;
}

interface AbJobProfile {
  jobProfileName: string;
  urlName: string;
  dataPoints: string;
}

interface YoeBucketCell {
  company: string;
  role: string;
  level: "entry" | "mid" | "senior" | "lead" | "executive";
  totalMin: number;
  totalMax: number;
  dataPoints: number;
  sourceUrl: string;
  contributingProfiles: string[];
}

const PUBLIC_RSU_COMPANIES = new Set([
  "google", "microsoft", "amazon", "apple", "meta", "adobe", "salesforce",
  "atlassian", "uber", "linkedin", "nvidia", "oracle", "cisco", "ibm",
  "servicenow", "workday", "qualcomm", "databricks", "snowflake", "intel",
  "vmware", "sap", "broadcom", "splunk", "datadog", "twilio", "okta",
  "paypal", "ebay", "expedia", "intuit", "palantir", "shopify",
]);

function slugify(companyKey: string): string {
  if (SLUG_OVERRIDES[companyKey]) return SLUG_OVERRIDES[companyKey];
  return companyKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function ctcToLpa(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  return Math.round((rupees / 100_000) * 10) / 10;
}

function bucketYoeToLevel(minExp: number, maxExp: number): YoeBucketCell["level"] {
  // Use the bucket midpoint to map onto the existing level taxonomy.
  // Boundaries: entry≤2, mid≤5, senior≤8, lead≤12, exec>12.
  // AB's standard buckets (0-1, 1-3, 3-6, 6-9, 9-12, 12+) align reasonably:
  //   0-1   → entry      (mid 0.5)
  //   1-3   → mid        (mid 2 → entry per ≤2; we bias toward mid since
  //                       AB's 1-3 bucket is the heart of "early-career mid")
  //   3-6   → mid        (mid 4.5)
  //   6-9   → senior     (mid 7.5)
  //   9-12  → lead       (mid 10.5)
  //   12+   → executive
  if (maxExp <= 1) return "entry";
  if (minExp >= 1 && maxExp <= 3) return "mid";
  if (maxExp <= 6) return "mid";
  if (maxExp <= 9) return "senior";
  if (maxExp <= 12) return "lead";
  return "executive";
}

async function fetchWithCache(url: string, cachePath: string): Promise<string | null> {
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9" },
        redirect: "follow",
      });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
      if (!res.ok) return null;
      const html = await res.text();
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, html);
      return html;
    } catch {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  return null;
}

function extractJobProfilesFromCompanyPage(html: string): AbJobProfile[] | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const profiles = data?.props?.pageProps?.filtersData?.data?.jobProfiles;
    return Array.isArray(profiles) ? profiles : null;
  } catch {
    return null;
  }
}

function extractBuckets(html: string): AbBucket[] | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const buckets = data?.props?.pageProps?.salaryData?.data?.bucketedExperienceLevels;
    return Array.isArray(buckets) ? buckets : null;
  } catch {
    return null;
  }
}

function escapeCsvCell(v: string): string {
  return v.replace(/[\r\n]+/g, " ").replace(/,/g, ";");
}

function existingTuples(): Set<string> {
  const tuples = new Set<string>();
  if (!existsSync(CSV_PATH)) return tuples;
  for (const line of readFileSync(CSV_PATH, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("company,")) continue;
    const cells = t.split(",");
    if (cells.length < 4) continue;
    tuples.add(`${cells[0]}|${cells[1]}|${cells[2]}|${cells[3]}`);
  }
  return tuples;
}

function existingYoeTuples(): Set<string> {
  // Identify (co,role,level) cells already produced by THIS pass-2
  // scraper (notes start with "AB yoe-bucket scrape:") so we skip them
  // on re-runs. Pass-1 cells share the (co,role,level) key but get
  // OVERWRITTEN by us when both exist for the same triple — see
  // dropPass1Duplicates() below.
  const tuples = new Set<string>();
  if (!existsSync(CSV_PATH)) return tuples;
  for (const line of readFileSync(CSV_PATH, "utf8").split(/\r?\n/)) {
    if (!line.includes("AB yoe-bucket scrape:")) continue;
    const cells = line.split(",");
    if (cells.length < 3) continue;
    tuples.add(`${cells[0]}|${cells[1]}|${cells[2]}`);
  }
  return tuples;
}

function rowToCsvLine(cell: YoeBucketCell): string {
  const hasRsu = PUBLIC_RSU_COMPANIES.has(cell.company);
  const baseFrac = hasRsu ? 0.65 : 0.75;
  const baseMin = (cell.totalMin * baseFrac).toFixed(1);
  const baseMax = (cell.totalMax * baseFrac).toFixed(1);
  const equityType = hasRsu ? "rsu" : "none";
  const eqFrac = hasRsu ? 0.25 : 0;
  const equityMin = hasRsu ? (cell.totalMin * eqFrac).toFixed(1) : "0";
  const equityMax = hasRsu ? (cell.totalMax * eqFrac).toFixed(1) : "0";
  const noteCore = `AB yoe-bucket scrape: ${cell.contributingProfiles.slice(0, 3).join("; ")}; n=${cell.dataPoints}`;
  const note = (hasRsu ? `${noteCore}; equity split estimated.` : noteCore).slice(0, 240);
  return [
    cell.company,
    cell.role,
    cell.level,
    "",
    cell.totalMin.toFixed(1),
    cell.totalMax.toFixed(1),
    baseMin,
    baseMax,
    equityMin,
    equityMax,
    equityType,
    "",
    "", "",
    "",
    "",
    "",
    "",
    cell.sourceUrl,
    "", "", "",
    "",
    escapeCsvCell(note),
    TODAY,
  ].join(",");
}

interface DesigTarget {
  co: string;
  slug: string;
  urlName: string;
  jobProfileName: string;
  totalDataPoints: number;
  canonicalRole: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 999;
  const companyArg = args.indexOf("--company");
  const singleCompany = companyArg >= 0 ? args[companyArg + 1] : null;

  const allKeys = Object.keys(COMPANY_SALARY_OVERRIDES).filter((k) => !k.startsWith("__"));
  const targetCompanies = singleCompany ? [singleCompany] : allKeys.slice(0, limit);

  console.error(`Pass-2 (YOE-bucket) scrape: ${targetCompanies.length} companies${dryRun ? " (DRY RUN)" : ""}`);
  mkdirSync(DESIG_CACHE_DIR, { recursive: true });

  // Step 1: from each company's pass-1 cache, list designation targets.
  const targets: DesigTarget[] = [];
  const unmapped = new Set<string>();
  for (const co of targetCompanies) {
    const slug = slugify(co);
    const coCache = `${CO_CACHE_DIR}/${slug}.html`;
    if (!existsSync(coCache)) {
      console.error(`  [${co}] no pass-1 cache at ${coCache} — skipping`);
      continue;
    }
    const profiles = extractJobProfilesFromCompanyPage(readFileSync(coCache, "utf8"));
    if (!profiles) continue;
    for (const p of profiles) {
      const mapped = AB_ROLE_MAP[p.urlName];
      if (mapped === null) continue;
      if (!mapped) {
        unmapped.add(p.urlName);
        continue;
      }
      const dp = Number(p.dataPoints) || 0;
      if (dp < 100) continue; // designation page needs enough overall data to bucket
      targets.push({
        co, slug, urlName: p.urlName, jobProfileName: p.jobProfileName,
        totalDataPoints: dp, canonicalRole: mapped,
      });
    }
  }

  console.error(`  Designation targets: ${targets.length}`);
  console.error(`  Unmapped urlNames:   ${unmapped.size}`);

  // Step 2: fetch each designation page, extract buckets, accumulate cells.
  const buckets: Map<string, YoeBucketCell> = new Map(); // key = co|role|level
  let fetched = 0;
  let failed = 0;
  for (const t of targets) {
    const url = `https://www.ambitionbox.com/salaries/${t.slug}-salaries/${t.urlName}`;
    const cachePath = `${DESIG_CACHE_DIR}/${t.slug}__${t.urlName}.html`;
    process.stderr.write(`[${++fetched}/${targets.length}] ${t.co}/${t.urlName} ... `);
    const html = await fetchWithCache(url, cachePath);
    if (!html) {
      console.error("FAIL");
      failed++;
      continue;
    }
    const abBuckets = extractBuckets(html);
    if (!abBuckets || abBuckets.length === 0) {
      console.error("no buckets");
      continue;
    }
    let kept = 0;
    for (const b of abBuckets) {
      if (b.count < MIN_BUCKET_DATA_POINTS) continue;
      const tMin = ctcToLpa(b.typicalMinCtc);
      const tMax = ctcToLpa(b.typicalMaxCtc);
      if (!tMin || !tMax || tMin > tMax) continue;
      const level = bucketYoeToLevel(b.minExp, b.maxExp);
      const key = `${t.co}|${t.canonicalRole}|${level}`;
      const existing = buckets.get(key);
      const profileTag = `${t.jobProfileName} ${b.bucketLabel ?? `${b.minExp}-${b.maxExp}`}y (n=${b.count})`;
      if (!existing) {
        buckets.set(key, {
          company: t.co,
          role: t.canonicalRole,
          level,
          totalMin: tMin,
          totalMax: tMax,
          dataPoints: b.count,
          sourceUrl: url,
          contributingProfiles: [profileTag],
        });
      } else {
        // Sample-WEIGHTED average of typMin/typMax across designations.
        // Envelope-merge (min/max) was a bug — when AB has multiple
        // designations mapped to the same canonical role with different
        // comp levels (e.g. TCS "System Engineer" YOE 3-6y at ₹5.7-6.3L
        // + "IT Analyst" YOE 3-6y at ₹12-21L both → software-engineer/mid),
        // envelope produces ₹5.7-21L which is too wide to be useful.
        // Weighted-average centers the band on the n-weighted mean.
        const wOld = existing.dataPoints;
        const wNew = b.count;
        const wTot = wOld + wNew;
        existing.totalMin = Math.round(((existing.totalMin * wOld + tMin * wNew) / wTot) * 10) / 10;
        existing.totalMax = Math.round(((existing.totalMax * wOld + tMax * wNew) / wTot) * 10) / 10;
        existing.dataPoints = wTot;
        existing.contributingProfiles.push(profileTag);
      }
      kept++;
    }
    console.error(`${abBuckets.length} buckets → ${kept} kept`);
  }

  const allCells = [...buckets.values()];
  console.error(`\n=== YOE-BUCKET SCRAPE SUMMARY ===`);
  console.error(`  Designations attempted: ${targets.length}`);
  console.error(`  Designations failed:    ${failed}`);
  console.error(`  YOE-bucket cells:       ${allCells.length}`);

  // Skip cells already produced by a previous yoe-bucket run.
  const seenYoe = existingYoeTuples();
  const newCells = allCells.filter((c) => !seenYoe.has(`${c.company}|${c.role}|${c.level}`));
  console.error(`  Already in CSV:         ${allCells.length - newCells.length}`);
  console.error(`  New cells to append:    ${newCells.length}`);

  if (dryRun) {
    console.error(`\n--dry-run: would append ${newCells.length} rows. Sample:`);
    for (const c of newCells.slice(0, 8)) {
      console.error(`  ${c.company} ${c.role} ${c.level}: ₹${c.totalMin}-${c.totalMax}L (n=${c.dataPoints})`);
    }
    return;
  }

  if (newCells.length === 0) {
    console.error(`\nNothing new to append.`);
    return;
  }

  // Pass-2 supersedes pass-1 for any colliding (co, role, level, "") triple.
  // Read existing CSV, drop pass-1 rows that pass-2 will replace, then
  // append pass-2 rows. Track="" (empty) on both — so trackName collision
  // against the importer's seenKeys is what we're avoiding.
  const replaceKeys = new Set(newCells.map((c) => `${c.company}|${c.role}|${c.level}|`));
  const existingLines = readFileSync(CSV_PATH, "utf8").split(/\r?\n/);
  const kept: string[] = [];
  let droppedPass1 = 0;
  for (const line of existingLines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("company,")) {
      kept.push(line);
      continue;
    }
    const cells = t.split(",");
    const key = `${cells[0]}|${cells[1]}|${cells[2]}|${cells[3] ?? ""}`;
    if (replaceKeys.has(key) && !line.includes("AB yoe-bucket scrape:")) {
      droppedPass1++;
      continue;
    }
    kept.push(line);
  }
  // Trim trailing blank line if present, then append yoe rows + final newline.
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  const yoeLines = newCells.map(rowToCsvLine);
  writeFileSync(CSV_PATH, kept.concat(yoeLines).join("\n") + "\n");
  console.error(`\n✅ Wrote ${CSV_PATH}: dropped ${droppedPass1} pass-1 rows, appended ${newCells.length} yoe-bucket rows`);
  console.error(`Next: npm run import:salaries -- --dry-run    # validate`);
  console.error(`      npm run import:salaries -- --emit       # generate overrides`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
