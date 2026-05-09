/**
 * Scrape AmbitionBox salary data → append rows to data/salary-data-input.csv.
 *
 * AmbitionBox embeds clean structured JSON in __NEXT_DATA__ on every
 * /salaries/<company-slug>-salaries page. We pull jobProfiles[] which has
 * (jobProfileName, urlName, minExperience, maxExperience, typicalMinCtc,
 * typicalMaxCtc, dataPoints) for ~20 designations per company. That's our
 * P25-P75 band + sample-size confidence weight.
 *
 *   npx tsx scripts/scrape-ambitionbox.mts                 # default: top 30
 *   npx tsx scripts/scrape-ambitionbox.mts --limit 50      # top 50 cos
 *   npx tsx scripts/scrape-ambitionbox.mts --company tcs   # one company
 *   npx tsx scripts/scrape-ambitionbox.mts --dry-run       # don't write CSV
 *
 * Pipeline:
 *   1. read companies from COMPANY_SALARY_OVERRIDES (or --company)
 *   2. fetch /salaries/<slug>-salaries (cached at data/.cache/ambitionbox/)
 *   3. parse __NEXT_DATA__ → jobProfiles
 *   4. map AB urlName → canonical kebab-role (AB_ROLE_MAP table below)
 *   5. derive level from YOE midpoint
 *   6. aggregate multiple profiles → (company, role, level) cell
 *   7. append to CSV (skip rows that already exist for idempotency)
 *
 * Then run:
 *   npm run import:salaries -- --dry-run    # validate the appended rows
 *   npm run import:salaries -- --emit       # generate the override file
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";

const CSV_PATH = resolve("data/salary-data-input.csv");
const CACHE_DIR = resolve("data/.cache/ambitionbox");
const TODAY = new Date().toISOString().slice(0, 10);
const POLITE_DELAY_MS = 2_000;
const MIN_DATA_POINTS = 50; // skip noisy cells with too few reports
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// AmbitionBox's company URL slug ≠ our override key in some cases.
// This map handles the exceptions; everything else uses kebab-case of the key.
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

// Map AmbitionBox urlName → our canonical kebab role key.
// null = explicitly skip (BPO ops, clerical, etc).
// Unlisted urlName → log warning, skip (manual review on next run).
const AB_ROLE_MAP: Record<string, string | null> = {
  // Direct matches
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
  "data-analyst": "data-engineer", // closest canonical fit
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
  // TCS-specific bands map to software-engineer at appropriate level via YOE
  "system-engineer": "software-engineer",
  "assistant-system-engineer": "software-engineer",
  "system-engineer-hardware": "embedded-engineer",
  "it-analyst": "software-engineer",
  "it-analyst-c2": "software-engineer",
  "it-analyst-grade-c2": "software-engineer",
  "system-administrator": "cloud-engineer",
  "mainframe-developer": "mainframe-developer",
  // Infosys / Wipro / Cognizant internal designations
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
  // Phase 1 expansion: high-volume mappings discovered from 117-co cache
  // (sorted by total dataPoints — biggest coverage wins first)
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
  // Explicit skips (out of scope: clerical/ops/BPO/non-tech)
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

interface AbJobProfile {
  jobProfileName: string;
  urlName: string;
  minExperience: string;
  maxExperience: string;
  minCtc: string;
  maxCtc: string;
  avgCtc: string;
  typicalMinCtc: string;
  typicalMaxCtc: string;
  dataPoints: string;
}

interface ScrapedCell {
  company: string;
  role: string;
  level: "entry" | "mid" | "senior" | "lead" | "executive";
  totalMin: number;
  totalMax: number;
  dataPoints: number;
  sourceUrl: string;
  contributingProfiles: string[]; // for the notes column
}

function slugify(companyKey: string): string {
  if (SLUG_OVERRIDES[companyKey]) return SLUG_OVERRIDES[companyKey];
  return companyKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function ctcToLpa(rupees: string): number {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n / 100_000) * 10) / 10; // 1 decimal LPA
}

function yoeMidpointToLevel(min: number, max: number): ScrapedCell["level"] {
  const mid = (min + max) / 2;
  if (mid <= 2) return "entry";
  if (mid <= 5) return "mid";
  if (mid <= 8) return "senior";
  if (mid <= 12) return "lead";
  return "executive";
}

async function fetchWithCache(slug: string): Promise<string | null> {
  const cachePath = `${CACHE_DIR}/${slug}.html`;
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf8");
  }
  const url = `https://www.ambitionbox.com/salaries/${slug}-salaries`;
  // Polite delay before every network hit.
  await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9" },
        redirect: "follow",
      });
      if (res.status === 404) {
        console.warn(`  [404] ${url} — slug may be wrong`);
        return null;
      }
      if (res.status === 429 || res.status >= 500) {
        const wait = 2 ** attempt * 1000;
        console.warn(`  [${res.status}] backing off ${wait}ms (attempt ${attempt}/3)`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.warn(`  [${res.status}] ${url}`);
        return null;
      }
      const html = await res.text();
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, html);
      return html;
    } catch (e) {
      console.warn(`  [fetch error] ${(e as Error).message} (attempt ${attempt}/3)`);
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  return null;
}

function extractJobProfiles(html: string): AbJobProfile[] | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const profiles = data?.props?.pageProps?.filtersData?.data?.jobProfiles;
    if (!Array.isArray(profiles)) return null;
    return profiles as AbJobProfile[];
  } catch {
    return null;
  }
}

function profilesToCells(
  companyKey: string,
  slug: string,
  profiles: AbJobProfile[],
  unmappedSink: Set<string>,
): ScrapedCell[] {
  // Group by (canonical role, level) — multiple AB profiles often collapse
  // into one cell (e.g. TCS "System Engineer" YOE 0-8 + "Assistant System
  // Engineer" YOE 0-3 both feed software-engineer/entry+mid).
  const buckets: Map<string, ScrapedCell> = new Map();

  for (const p of profiles) {
    const mapped = AB_ROLE_MAP[p.urlName];
    if (mapped === null) continue; // explicit skip
    if (!mapped) {
      unmappedSink.add(p.urlName);
      continue;
    }
    const dataPoints = Number(p.dataPoints) || 0;
    if (dataPoints < MIN_DATA_POINTS) continue;
    const tMin = ctcToLpa(p.typicalMinCtc);
    const tMax = ctcToLpa(p.typicalMaxCtc);
    if (!tMin || !tMax || tMin > tMax) continue;
    const yoeMin = Number(p.minExperience) || 0;
    const yoeMax = Number(p.maxExperience) || yoeMin;
    const level = yoeMidpointToLevel(yoeMin, yoeMax);
    const key = `${mapped}|${level}`;
    const existing = buckets.get(key);
    const url = `https://www.ambitionbox.com/salaries/${slug}-salaries`;
    if (!existing) {
      buckets.set(key, {
        company: companyKey,
        role: mapped,
        level,
        totalMin: tMin,
        totalMax: tMax,
        dataPoints,
        sourceUrl: url,
        contributingProfiles: [`${p.jobProfileName} (n=${dataPoints})`],
      });
    } else {
      // Weighted union: keep widest envelope, sum sample size, list profiles.
      existing.totalMin = Math.min(existing.totalMin, tMin);
      existing.totalMax = Math.max(existing.totalMax, tMax);
      existing.dataPoints += dataPoints;
      existing.contributingProfiles.push(`${p.jobProfileName} (n=${dataPoints})`);
    }
  }
  return [...buckets.values()];
}

function escapeCsvCell(v: string): string {
  // Strip commas/newlines from free-text fields; the importer's parser
  // doesn't handle quoted commas robustly. URLs and short notes are fine.
  return v.replace(/[\r\n]+/g, " ").replace(/,/g, ";");
}

function existingTuples(): Set<string> {
  const tuples = new Set<string>();
  if (!existsSync(CSV_PATH)) return tuples;
  const lines = readFileSync(CSV_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("company,")) continue;
    const cells = t.split(",");
    if (cells.length < 4) continue;
    tuples.add(`${cells[0]}|${cells[1]}|${cells[2]}|${cells[3]}`);
  }
  return tuples;
}

// Public-tech companies pay meaningful RSU at India offices. For these, we
// estimate equity at ~25-35% of total CTC and flag it as an estimate in the
// notes. Anything not in this set gets equityType=none (honest under-claim:
// AB doesn't expose equity, and most private cos don't issue meaningful
// vested ESOPs to mid-level engineers).
const PUBLIC_RSU_COMPANIES = new Set([
  "google", "microsoft", "amazon", "apple", "meta", "adobe", "salesforce",
  "atlassian", "uber", "linkedin", "nvidia", "oracle", "cisco", "ibm",
  "servicenow", "workday", "qualcomm", "databricks", "snowflake", "intel",
  "vmware", "sap", "broadcom", "splunk", "datadog", "twilio", "okta",
  "paypal", "ebay", "expedia", "intuit", "palantir", "shopify",
]);

function rowToCsvLine(cell: ScrapedCell): string {
  const hasRsu = PUBLIC_RSU_COMPANIES.has(cell.company);
  // base ≈ 75% of total when no RSU, ≈ 65% when RSU is part of comp.
  // These are heuristics — curator overrides should refine specific cells.
  const baseFrac = hasRsu ? 0.65 : 0.75;
  const baseMin = (cell.totalMin * baseFrac).toFixed(1);
  const baseMax = (cell.totalMax * baseFrac).toFixed(1);
  const equityType = hasRsu ? "rsu" : "none";
  // RSU portion estimate: 25-30% of total, lower for less-senior cells.
  const eqFrac = hasRsu ? 0.25 : 0;
  const equityMin = hasRsu ? (cell.totalMin * eqFrac).toFixed(1) : "0";
  const equityMax = hasRsu ? (cell.totalMax * eqFrac).toFixed(1) : "0";
  const noteCore = `AB scrape: ${cell.contributingProfiles.slice(0, 3).join("; ")}; n=${cell.dataPoints}`;
  const note = (hasRsu ? `${noteCore}; equity split estimated.` : noteCore).slice(0, 200);
  // Column order MUST match data/salary-data-input.csv header.
  return [
    cell.company,
    cell.role,
    cell.level,
    "", // trackName — AB doesn't expose tracks
    cell.totalMin.toFixed(1),
    cell.totalMax.toFixed(1),
    baseMin,
    baseMax,
    equityMin,
    equityMax,
    equityType,
    "", // equityVesting
    "", "", // joiningBonusMin/Max
    "", // variablePct
    "", // noticePeriodDays
    "", // bondPenaltyLpa
    "", // sourceGlassdoor
    cell.sourceUrl,
    "", "", "", // sourceLevelsFyi/Drhp/OperatorNetwork
    "", // resumeSignals
    escapeCsvCell(note),
    TODAY,
  ].join(",");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 30;
  const companyArg = args.indexOf("--company");
  const singleCompany = companyArg >= 0 ? args[companyArg + 1] : null;

  const allKeys = Object.keys(COMPANY_SALARY_OVERRIDES).filter((k) => !k.startsWith("__"));
  const targetCompanies = singleCompany ? [singleCompany] : allKeys.slice(0, limit);

  console.error(`Scraping ${targetCompanies.length} companies${dryRun ? " (DRY RUN)" : ""}...`);

  mkdirSync(CACHE_DIR, { recursive: true });
  const seen = existingTuples();
  const unmapped = new Set<string>();
  const allCells: ScrapedCell[] = [];
  let scrapedCount = 0;
  let failCount = 0;

  for (const co of targetCompanies) {
    const slug = slugify(co);
    process.stderr.write(`[${++scrapedCount}/${targetCompanies.length}] ${co} → ${slug} ... `);
    const html = await fetchWithCache(slug);
    if (!html) {
      console.error("FAIL");
      failCount++;
      continue;
    }
    const profiles = extractJobProfiles(html);
    if (!profiles) {
      console.error("FAIL (no jobProfiles)");
      failCount++;
      continue;
    }
    const cells = profilesToCells(co, slug, profiles, unmapped);
    console.error(`${profiles.length} profiles → ${cells.length} cells`);
    allCells.push(...cells);
  }

  // Filter out cells that already exist in the CSV (idempotent).
  const newCells = allCells.filter((c) => !seen.has(`${c.company}|${c.role}|${c.level}|`));
  const skippedDup = allCells.length - newCells.length;

  console.error(`\n=== SCRAPE SUMMARY ===`);
  console.error(`  Companies attempted:   ${targetCompanies.length}`);
  console.error(`  Companies failed:      ${failCount}`);
  console.error(`  Cells produced:        ${allCells.length}`);
  console.error(`  Already in CSV:        ${skippedDup} (skipped)`);
  console.error(`  New cells to append:   ${newCells.length}`);
  console.error(`  Unmapped AB roles:     ${unmapped.size}`);
  if (unmapped.size && unmapped.size <= 30) {
    console.error(`    (add to AB_ROLE_MAP if relevant): ${[...unmapped].sort().join(", ")}`);
  } else if (unmapped.size) {
    console.error(`    (top 20 by occurrence — see cache to investigate)`);
  }

  if (dryRun) {
    console.error(`\n--dry-run: would append ${newCells.length} rows. Sample:`);
    for (const c of newCells.slice(0, 5)) {
      console.error(`  ${c.company} ${c.role} ${c.level}: ₹${c.totalMin}-${c.totalMax}L (n=${c.dataPoints})`);
    }
    return;
  }

  if (newCells.length === 0) {
    console.error(`\nNothing new to append.`);
    return;
  }

  const lines = newCells.map(rowToCsvLine).join("\n") + "\n";
  appendFileSync(CSV_PATH, lines);
  console.error(`\n✅ Appended ${newCells.length} rows to ${CSV_PATH}`);
  console.error(`Next: npm run import:salaries -- --dry-run    # validate`);
  console.error(`      npm run import:salaries -- --emit       # generate overrides`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
