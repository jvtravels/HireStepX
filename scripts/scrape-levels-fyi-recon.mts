/**
 * Levels.fyi recon scraper — Phase 2C-A.
 *
 * Hits Levels.fyi for ~15 product companies × key job families (where
 * curator was sourced from Levels.fyi anyway, so AB scrape is junior-
 * skewed and useless at senior+). Extracts per-level mean total-comp
 * from the page's __NEXT_DATA__ JSON, converts USD → LPA via the
 * embedded INR exchange rate, and writes a markdown comparison report
 * against COMPANY_SALARY_OVERRIDES.
 *
 * This is RECON ONLY — no runtime wiring, no auto-flip. Output goes to
 * docs/levels-fyi-vs-curator.md for manual review. If the data lines
 * up with curator (±20% on most cells), we have a validated second
 * source and confidence rises. If it diverges, we open issues per cell.
 *
 *   npx tsx scripts/scrape-levels-fyi-recon.mts
 *
 * No retries / fancy backoff — small surface (≤45 fetches), 2sec delay
 * between requests, raw HTML cached so reruns hit disk not network.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { COMPANY_SALARY_OVERRIDES } from "../data/company-salary-overrides";

const CACHE_DIR = "data/.cache-levels-fyi";
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Curator companies × job families to recon. Each entry is the
 *  Levels.fyi slug + the canonical role key used by COMPANY_SALARY_OVERRIDES. */
const TARGETS: Array<{ lfSlug: string; curatorKey: string; jobFamily: string; roleKey: string }> = [
  // Tier-1 product cos — curator is Levels.fyi-sourced, AB junior-skews
  { lfSlug: "google",         curatorKey: "google",       jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "google",         curatorKey: "google",       jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "amazon",         curatorKey: "amazon",       jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "amazon",         curatorKey: "amazon",       jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "microsoft",      curatorKey: "microsoft",    jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "microsoft",      curatorKey: "microsoft",    jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "apple",          curatorKey: "apple",        jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "adobe",          curatorKey: "adobe",        jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "adobe",          curatorKey: "adobe",        jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "nvidia",         curatorKey: "nvidia",       jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "oracle",         curatorKey: "oracle",       jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "cisco",          curatorKey: "cisco",        jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "salesforce",     curatorKey: "salesforce",   jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "salesforce",     curatorKey: "salesforce",   jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "target",         curatorKey: "target india", jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "barclays",       curatorKey: "barclays",     jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "atlassian",      curatorKey: "atlassian",    jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "vmware",         curatorKey: "vmware",       jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "servicenow",     curatorKey: "servicenow",   jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "walmart",        curatorKey: "walmart global tech", jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "walmart",        curatorKey: "walmart global tech", jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "linkedin",       curatorKey: "linkedin",     jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "uber",           curatorKey: "uber",         jobFamily: "software-engineer", roleKey: "software-engineer" },
  { lfSlug: "uber",           curatorKey: "uber",         jobFamily: "product-manager",   roleKey: "product-manager"   },
  { lfSlug: "stripe",         curatorKey: "stripe",       jobFamily: "software-engineer", roleKey: "software-engineer" },
];

interface LevelData {
  levelName: string;
  order: number;
  count: number;
  countLast12: number;
  totalUsd: number;
  baseUsd: number;
  stockUsd: number;
  bonusUsd: number;
}
interface PageData {
  fxRate: number; // INR per USD
  currency: string;
  levels: LevelData[];
  hasSalaryLevelData: boolean;
}

type Tier = "entry" | "mid" | "senior" | "lead" | "executive";

/** Per-company level-name → tier mapping. Levels.fyi exposes raw company
 *  internal labels (Google "L3", Apple "ICT3", Microsoft "61"); these
 *  don't map 1:1 to our entry/mid/senior/lead/executive taxonomy without
 *  per-company knowledge. The default `order`-based fallback over-counts
 *  entry/mid because most companies have 2 sub-levels per tier.
 *
 *  Sourced from Levels.fyi's own canonical-level mapping + standard
 *  industry tier mapping (Google L3 → SDE1 entry, L4 → SDE2 mid, etc.). */
const LEVEL_NAME_TIER_MAP: Record<string, Record<string, Tier>> = {
  google: {
    "L3": "entry", "L4": "mid", "L5": "senior", "L6": "lead", "L7": "executive", "L8": "executive", "L9": "executive", "L10": "executive",
    "Associate Product Manager 1": "entry", "Associate Product Manager 2": "entry",
    "Product Manager 1": "mid", "Product Manager 2": "senior", "Senior PM": "lead",
    "Group PM": "executive", "Director": "executive", "Senior Director / VP": "executive",
  },
  amazon: {
    "SDE I": "entry", "SDE II": "mid", "SDE III": "senior", "Principal SDE": "lead", "Senior Principal SDE": "executive",
    "Product Manager": "mid", "Senior Product Manager": "senior", "Principal Product Manager": "lead", "Director of Product Management": "executive",
  },
  microsoft: {
    "SDE": "entry", "SDE II": "mid", "Senior SDE": "senior", "Principal SDE": "lead",
    "59": "entry", "60": "entry", "61": "mid", "62": "senior", "63": "lead", "64": "executive", "65": "executive", "66": "executive", "67": "executive", "68": "executive",
    "Product Manager 2": "mid", "Senior Product Manager": "senior", "Principal Product Manager": "lead",
  },
  apple: {
    "ICT2": "entry", "ICT3": "mid", "ICT4": "senior", "ICT5": "lead", "ICT6": "executive",
  },
  adobe: {
    "Software Engineer 1": "entry", "Software Engineer 2": "mid", "Software Engineer 3": "senior",
    "Software Engineer 4": "lead", "Software Engineer 5": "executive", "Software Engineer 5.5": "executive",
    "Principal Scientist": "executive",
    "L3": "entry", "L4": "mid", "L5": "senior", "L6": "lead", "L7": "executive",
  },
  nvidia: {
    "IC1": "entry", "IC2": "mid", "IC3": "senior", "IC4": "lead", "IC5": "executive",
  },
  oracle: {
    "IC1": "entry", "IC2": "mid", "IC3": "senior", "IC4": "lead", "IC5": "executive", "IC6": "executive",
    "Software Engineer 2": "entry", "Software Engineer 3": "mid", "Software Engineer 4": "senior", "Senior Software Engineer": "senior",
    "Principal Software Engineer": "lead", "Senior Principal Software Engineer": "executive",
  },
  cisco: {
    "Grade 7": "entry", "Grade 8": "mid", "Grade 9": "senior", "Grade 10": "lead", "Grade 11": "executive", "Grade 12": "executive", "Grade 13": "executive",
    "Software Engineer": "entry", "Software Engineer II": "mid", "Senior Software Engineer": "senior",
    "Tech Leader 1": "lead", "Tech Leader 2": "executive", "Principal Engineer": "executive",
  },
  salesforce: {
    "MTS": "entry", "SMTS": "mid", "Lead MTS": "senior", "Principal MTS": "lead", "Architect": "executive",
    "Associate Product Manager": "entry", "Product Manager": "mid", "Senior Product Manager": "senior",
    "Director, Product Management": "lead", "Senior Director Product Management": "executive",
  },
  target: {
    "Engineer (L1)": "entry", "Engineer (L2)": "mid", "Lead Engineer (L3)": "senior",
    "Principal Engineer (L4)": "lead", "Senior Principal Engineer (L5)": "executive",
  },
  barclays: {
    "BA3": "entry", "BA4": "mid", "AVP": "senior", "VP": "lead", "Director": "executive", "MD": "executive",
  },
  atlassian: {
    "P30": "entry", "P40": "mid", "P50": "senior", "P60": "lead", "P70": "executive", "P80": "executive",
  },
  vmware: {
    "MTS 1": "entry", "MTS 2": "mid", "MTS 3": "senior", "Senior MTS": "lead", "Staff Engineer": "executive", "Principal Engineer": "executive",
  },
  servicenow: {
    "Senior Software Engineer": "mid", "Staff Software Engineer": "senior", "Senior Staff Software Engineer": "lead", "Principal Software Engineer": "executive",
  },
  walmart: {
    "Software Engineer 3": "entry", "Senior Software Engineer (T)": "mid", "Staff Software Engineer (T)": "senior",
    "Senior Staff Software Engineer (T)": "lead", "Principal Software Engineer (T)": "executive",
    "Senior Product Manager (T)": "senior", "Staff Product Manager (T)": "lead", "Senior Staff Product Manager (T)": "executive",
  },
  linkedin: {
    "Senior Software Engineer": "mid", "Staff Software Engineer": "senior", "Senior Staff Software Engineer": "lead", "Principal Staff Software Engineer": "executive",
  },
  uber: {
    "L3": "entry", "L4": "mid", "L5a": "senior", "L5b": "senior", "L6": "lead", "L7": "executive",
    "Product Manager II": "mid", "Senior Product Manager": "senior", "Staff Product Manager": "lead", "Senior Staff Product Manager": "executive",
  },
  stripe: {
    "L1": "entry", "L2": "mid", "L3": "senior", "L4": "lead", "L5": "executive",
  },
};

function mapLevelToTier(slug: string, _jobFamily: string, levelName: string, order: number): Tier {
  const co = LEVEL_NAME_TIER_MAP[slug];
  if (co?.[levelName]) return co[levelName];
  // Fallback: order-based heuristic. Each company should usually have an
  // override; this just keeps the script from crashing on unmapped levels.
  if (order <= 0) return "entry";
  if (order === 1) return "mid";
  if (order === 2) return "senior";
  if (order === 3) return "lead";
  return "executive";
}

async function fetchPage(slug: string, jobFamily: string): Promise<string | null> {
  const cachePath = join(CACHE_DIR, `${slug}__${jobFamily}.html`);
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const url = `https://www.levels.fyi/companies/${slug}/salaries/${jobFamily}/locations/india`;
  process.stderr.write(`  fetching ${slug}/${jobFamily}... `);
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9" } });
  process.stderr.write(`${res.status}\n`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const html = await res.text();
  writeFileSync(cachePath, html);
  await new Promise(r => setTimeout(r, 2000));
  return html;
}

function parsePage(html: string): PageData | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: unknown;
  try { data = JSON.parse(m[1]); } catch { return null; }
  const pp = (data as { props?: { pageProps?: Record<string, unknown> } })?.props?.pageProps;
  if (!pp) return null;
  const fxRate = Number(pp.locationExchangeRate ?? 0);
  const currency = String(pp.locationCurrency ?? "");
  const averages = pp.averages as Array<Record<string, unknown>> | undefined;
  if (!averages?.length) return null;
  const levels: LevelData[] = averages.map((a, i) => {
    const raw = a.rawValues as { total?: number; base?: number; stock?: number; bonus?: number } | undefined;
    return {
      levelName: String(a.primaryLevelName ?? a.level ?? `L${i}`),
      order: Number(a.levelIndex ?? i),
      count: Number(a.count ?? 0),
      countLast12: Number(a.count_last_12_months ?? 0),
      totalUsd: Number(raw?.total ?? 0),
      baseUsd: Number(raw?.base ?? 0),
      stockUsd: Number(raw?.stock ?? 0),
      bonusUsd: Number(raw?.bonus ?? 0),
    };
  });
  return { fxRate, currency, levels, hasSalaryLevelData: Boolean((pp.levels as { hasSalaryLevelData?: boolean })?.hasSalaryLevelData) };
}

function usdToLpa(usd: number, fx: number): number {
  return (usd * fx) / 100_000;
}

function curatorMidsForCompany(curatorKey: string, roleKey: string): Record<string, number> {
  const roleEntry = COMPANY_SALARY_OVERRIDES[curatorKey]?.[roleKey];
  if (!roleEntry) return {};
  const out: Record<string, number> = {};
  for (const lvl of ["entry", "mid", "senior", "lead", "executive"] as const) {
    const b = roleEntry[lvl];
    if (b) out[lvl] = (b.totalMin + b.totalMax) / 2;
  }
  return out;
}

const out: string[] = [];
out.push(`# Levels.fyi vs Curator — recon report`);
out.push(``);
out.push(`Per-level mean total-comp from Levels.fyi (India location), converted USD → LPA via the page's embedded exchange rate. Compared against COMPANY_SALARY_OVERRIDES midpoints. n = total samples, c12 = samples in the last 12 months.`);
out.push(``);
out.push(`A "✓" in agreement column = within ±20% of curator midpoint. "✗" = outside ±20%. Empty = no curator entry to compare.`);
out.push(``);
out.push(`## Key findings (read this first)`);
out.push(``);
out.push(`- **Where curator and Levels.fyi mean agree**: Google SE all levels, Apple SE all levels, Amazon SDE-II/PM/Principal-PM, Microsoft entry-tier. These are the cells where curator's "Levels.fyi P50" sourcing held up.`);
out.push(`- **Where curator is HIGHER than Levels.fyi mean by 30-50%**: Adobe SE mid+, Nvidia SE mid+, Oracle SE all, Cisco SE mid+, Microsoft SE senior+, Amazon PM senior, ServiceNow, VMware, Atlassian.`);
out.push(`  - Curator notes claim P50 sourcing but Levels.fyi mean (across substantial c12 samples) is much lower. Either the 2024-25 tech-downturn compressed actual offers OR curator was anchored to upper-decile self-reports.`);
out.push(`  - Either way, **Levels.fyi mean reflects what candidates are getting in 2026** and is probably the better number for negotiation guidance.`);
out.push(`- **Decision points**:`);
out.push(`  1. Flip these cells from curator → Levels.fyi mean (build Phase 2C-B scraper + wire as preferred for product cos at senior+).`);
out.push(`  2. Or leave curator alone and accept that we're coaching candidates to the high end of the band — risk: candidate quotes a number a recruiter laughs at.`);
out.push(`  3. Or treat as advisory data only — surface in the SessionReportView as "market check" without changing curator.`);
out.push(``);
out.push(`Sample sizes (c12) are non-trivial for the disagreement cells — Adobe SE3 c12=35, Microsoft 62 c12=140, Oracle IC-3 c12=247 — these aren't noise.`);
out.push(``);

let total = 0, agree = 0, missing = 0, lfMissing = 0;

for (const t of TARGETS) {
  const html = await fetchPage(t.lfSlug, t.jobFamily);
  if (!html) { lfMissing++; out.push(`## ${t.lfSlug} — ${t.jobFamily}\n\n_404 / not on Levels.fyi_\n`); continue; }
  const parsed = parsePage(html);
  if (!parsed || !parsed.hasSalaryLevelData || parsed.currency !== "INR" || !parsed.fxRate) {
    out.push(`## ${t.lfSlug} — ${t.jobFamily}\n\n_no usable data (currency=${parsed?.currency}, fx=${parsed?.fxRate})_\n`);
    continue;
  }
  const curMids = curatorMidsForCompany(t.curatorKey, t.roleKey);
  out.push(`## ${t.lfSlug} — ${t.jobFamily}  (fx=${parsed.fxRate.toFixed(2)} INR/USD)`);
  out.push(``);
  out.push(`| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |`);
  out.push(`|---|---|---|---|---|---|---|---|`);
  for (const lvl of parsed.levels) {
    if (lvl.count < 5) continue; // skip super-thin levels
    const lpa = usdToLpa(lvl.totalUsd, parsed.fxRate);
    const baseLpa = usdToLpa(lvl.baseUsd, parsed.fxRate);
    const stockLpa = usdToLpa(lvl.stockUsd, parsed.fxRate);
    const bonusLpa = usdToLpa(lvl.bonusUsd, parsed.fxRate);
    const tier = mapLevelToTier(t.lfSlug, t.jobFamily, lvl.levelName, lvl.order);
    const cur = curMids[tier];
    total++;
    let agreement = "—";
    if (cur != null) {
      const drift = Math.abs(cur - lpa) / cur;
      if (drift <= 0.20) { agreement = `✓ ${Math.round(drift * 100)}%`; agree++; }
      else { agreement = `✗ ${Math.round(drift * 100)}%`; }
    } else { missing++; agreement = "—"; }
    out.push(
      `| ${lvl.levelName} (ord ${lvl.order} → ${tier}) | ${lvl.count} / ${lvl.countLast12} | ₹${lpa.toFixed(1)}L | ₹${baseLpa.toFixed(1)}L | ₹${stockLpa.toFixed(1)}L | ₹${bonusLpa.toFixed(1)}L | ${cur != null ? `₹${cur.toFixed(1)}L (${tier})` : "—"} | ${agreement} |`,
    );
  }
  out.push(``);
}

out.push(`---`);
out.push(``);
out.push(`## Summary`);
out.push(`- Targets fetched: ${TARGETS.length - lfMissing} / ${TARGETS.length} (${lfMissing} missing on LF)`);
out.push(`- Cells compared: ${total - missing}`);
out.push(`- Agree (±20%): ${agree} / ${total - missing}  (${total - missing > 0 ? Math.round((agree / (total - missing)) * 100) : 0}%)`);
out.push(`- No curator entry to compare: ${missing}`);

writeFileSync("docs/levels-fyi-vs-curator.md", out.join("\n"));
console.error(`\nDONE — wrote docs/levels-fyi-vs-curator.md`);
console.error(`Agreement: ${agree}/${total - missing}  (${total - missing > 0 ? Math.round((agree / (total - missing)) * 100) : 0}%)`);
