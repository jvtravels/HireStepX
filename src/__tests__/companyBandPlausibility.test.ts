/* Band-plausibility CI gate (2026-05-14) — audit follow-up.
 *
 * Bug-report 14 surfaced (indirectly) the risk class: a company × role
 * × level cell whose midpoint is wildly off the same-tier market.
 * The Bug-13/14 structural fix (unknown domain → pivot) protects the
 * kernel against classification failures, but does not catch the
 * underlying data problem — a cell with a misplaced decimal or an
 * accidentally-copy-pasted MAANG band on a tier-3 services row would
 * still flow through and over-anchor for candidates whose domain DOES
 * classify cleanly.
 *
 * This test groups every (company × role × level) cell BY company
 * tier (faang / gcc / indian-unicorn / it-services / …) and asserts
 * that each cell's midpoint is within OUTLIER_RATIO of the tier's own
 * median for that (role, level). Grouping by tier — instead of across
 * all companies — avoids the false positive where a tier-3 services
 * fresh-grad band (₹4L) looks tiny next to a MAANG fresh-grad band
 * (₹40L). Within their own tier, both are normal.
 *
 * Threshold rationale:
 *   - 2.5× is wide enough to keep curated outliers inside their tier
 *     (e.g. an unusually generous unicorn senior band 2-2.4× the
 *     unicorn-tier median) without per-company exemptions.
 *   - Anything beyond 2.5× within a single tier almost always means
 *     either a data-entry error (decimal misplaced, accidental MAANG
 *     band on a unicorn row) or a genuine super-elite firm in a
 *     tight tier. The latter goes on OUTLIER_WHITELIST with a one-
 *     line justification.
 *
 * What this gate does NOT catch:
 *   - A whole-tier drift (every MAANG band off by 2×) — caught only
 *     by cross-tier sanity checks elsewhere.
 *   - A correct cell with a wrong tier classification (Schbang
 *     misclassified as MAANG, say). Tier integrity is upstream.
 */
import { describe, it, expect } from "vitest";
import { COMPANY_SALARY_OVERRIDES, type CompanyBandOverride } from "../../data/company-salary-overrides";
import { getCompanyTier, type CompanyTier } from "../../data/company-tiers";

const OUTLIER_RATIO = 2.5;
const MIN_SAMPLES = 4; // skip tier/role/level tuples with too few peers

/** Whitelist of (company, role, level) cells that are legitimately
 *  outliers vs. their TIER median. Each entry MUST carry a justification
 *  — reviewers should reject additions without one. */
const OUTLIER_WHITELIST: ReadonlySet<string> = new Set([
  /* Format: `${company}|${role}|${level}` */
  /* Quant trading firms within bfsi-global tier pay 4-5× the tier
   * median for IIT-class hires; this is real market data sourced
   * from Levels.fyi / public placements, not curator inflation. */
  "jane street|data-scientist|entry",
  "jane street|data-scientist|mid",
  "citadel|data-scientist|mid",
  "goldman|consultant|entry",
  /* Tier-classification artefact, NOT a band issue: this row exists as
   * `techmahindra` (no space) and getCompanyTier substring-matches the
   * `mahindra` → "indian-unicorn" entry instead of routing to it-services
   * (where the canonical `tech mahindra` row lives). The band itself is
   * correct for an it-services fresh-grad cohort; the dup-key needs to
   * be merged into "tech mahindra" in a separate data-hygiene pass. */
  "techmahindra|software-engineer|entry",
]);

interface Cell {
  company: string;
  tier: CompanyTier | null;
  role: string;
  level: string;
  mid: number;
  source: string;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function isBandLike(v: unknown): v is CompanyBandOverride {
  return (
    typeof v === "object" &&
    v != null &&
    typeof (v as CompanyBandOverride).totalMin === "number" &&
    typeof (v as CompanyBandOverride).totalMax === "number"
  );
}

describe("Company-salary-override plausibility gate (per-tier)", () => {
  /* Collect every (company, role, level) cell across COMPANY_SALARY_OVERRIDES. */
  const cells: Cell[] = [];
  for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
    if (!roles || company.startsWith("__")) continue;
    const tier = getCompanyTier(company);
    for (const [role, levels] of Object.entries(roles)) {
      if (!levels) continue;
      for (const [level, ent] of Object.entries(levels)) {
        if (!isBandLike(ent)) continue;
        const mid = (ent.totalMin + ent.totalMax) / 2;
        if (!Number.isFinite(mid) || mid <= 0) continue;
        cells.push({ company, tier, role, level, mid, source: ent.source ?? "" });
      }
    }
  }

  /* Group by (tier, role, level). */
  const groups = new Map<string, Cell[]>();
  for (const c of cells) {
    if (!c.tier) continue; // untiered companies are not gated (insufficient peer info)
    const k = `${c.tier}|${c.role}|${c.level}`;
    const arr = groups.get(k) ?? [];
    arr.push(c);
    groups.set(k, arr);
  }

  it("no (company, role, level) cell is wildly off the same-TIER median", () => {
    const violations: string[] = [];
    for (const [key, group] of groups) {
      if (group.length < MIN_SAMPLES) continue;
      const mids = group.map((c) => c.mid);
      const m = median(mids);
      if (m <= 0) continue;
      const lo = m / OUTLIER_RATIO;
      const hi = m * OUTLIER_RATIO;
      for (const c of group) {
        const wl = `${c.company}|${c.role}|${c.level}`;
        if (OUTLIER_WHITELIST.has(wl)) continue;
        if (c.mid < lo || c.mid > hi) {
          const ratio = (c.mid / m).toFixed(2);
          violations.push(
            `  [${key}] ${wl}: midpoint ₹${c.mid.toFixed(1)}L is ${ratio}× the tier median ₹${m.toFixed(1)}L (window ₹${lo.toFixed(1)}–${hi.toFixed(1)}L). Source: ${c.source}`,
          );
        }
      }
    }
    if (violations.length > 0) {
      const msg =
        `\nBand-plausibility gate: ${violations.length} cell(s) outside ±${OUTLIER_RATIO}× their tier median.\n` +
        `Each is either (a) a data-entry error in data/company-salary-overrides.ts (decimal misplaced, wrong-tier band copied),\n` +
        `or (b) a legitimate outlier — add to OUTLIER_WHITELIST with a one-line justification.\n` +
        `Violations:\n${violations.join("\n")}\n`;
      throw new Error(msg);
    }
  });

  it("OUTLIER_WHITELIST entries stay relevant (no dead entries)", () => {
    const present = new Set<string>();
    for (const c of cells) present.add(`${c.company}|${c.role}|${c.level}`);
    const dead: string[] = [];
    for (const wl of OUTLIER_WHITELIST) {
      if (!present.has(wl)) dead.push(wl);
    }
    expect(dead).toEqual([]);
  });
});
