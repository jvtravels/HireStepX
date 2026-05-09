/**
 * Parity check: every (company, role, level) cell where curator and
 * IMPORTED both have an entry and they disagree by ≥25% must produce
 * matching outcomes from:
 *   - classifyDrift() — what the audit recommends
 *   - maybePreferImportedOverSeed() — what the runtime actually does
 *
 * Specifically: every "accept-ab" recommendation must produce a flip
 * at runtime, and every "keep-curator" must NOT. "manual-review" cells
 * are exempt (no rule fires either way). This test catches drift
 * between the two sites, which previously had to be re-derived by hand
 * after every rule change.
 */
import { describe, expect, it } from "vitest";
import { COMPANY_SALARY_OVERRIDES, maybePreferImportedOverSeed } from "../../data/company-salary-overrides";
import { IMPORTED_SALARY_OVERRIDES } from "../../data/_imported-salary-overrides.generated";
import { classifyDrift } from "../../data/_salary-audit-helpers";
import type { ExperienceLevel } from "../../data/salaries";

const LEVELS: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];
const THRESHOLD = 0.25;

interface ParityCell {
  company: string;
  role: string;
  level: ExperienceLevel;
  recommendation: "keep-curator" | "accept-ab" | "manual-review";
  rationale: string;
  runtimeFlipped: boolean;
}

function collectParityCells(): ParityCell[] {
  const cells: ParityCell[] = [];
  for (const company of Object.keys(IMPORTED_SALARY_OVERRIDES)) {
    if (company.startsWith("__sector_")) continue;
    const importedRoles = IMPORTED_SALARY_OVERRIDES[company];
    const curatorRoles = COMPANY_SALARY_OVERRIDES[company];
    if (!curatorRoles) continue;
    for (const role of Object.keys(importedRoles)) {
      const curatorLevels = curatorRoles[role];
      if (!curatorLevels) continue;
      for (const level of LEVELS) {
        const imp = importedRoles[role]?.[level];
        const cur = curatorLevels[level];
        if (!imp || !cur) continue;
        const curMid = (cur.totalMin + cur.totalMax) / 2;
        const impMid = (imp.totalMin + imp.totalMax) / 2;
        if (curMid <= 0) continue;
        const driftPct = Math.abs(curMid - impMid) / curMid;
        if (driftPct < THRESHOLD) continue;
        const { rec, why } = classifyDrift({
          company,
          role,
          level,
          curatorSource: cur.source,
          scrapedNotes: imp.notes,
        });
        const runtimeFlipped = maybePreferImportedOverSeed(cur, company, role, level) !== null;
        cells.push({ company, role, level, recommendation: rec, rationale: why, runtimeFlipped });
      }
    }
  }
  return cells;
}

describe("salary audit ↔ runtime parity", () => {
  const cells = collectParityCells();

  it("collects a non-trivial number of drift cells (sanity check)", () => {
    // Phase 9 audit: 76 accept-ab + 147 keep-curator + 0 manual-review = 223.
    // Test guards against a future refactor that accidentally short-circuits
    // collection; allow ±20% drift for normal data churn.
    expect(cells.length).toBeGreaterThan(150);
    expect(cells.length).toBeLessThan(350);
  });

  /* Pinned divergence baselines. Each entry is "<company>/<role>/<level>".
   *
   * accept-ab the runtime does NOT flip: the audit recommends preferring
   * the AB scrape, but runtime's n-floor (looseThresholdEligible /
   * PREFER_IMPORTED_OVER_SEED gating) keeps the curator. The audit is
   * effectively saying "if this cell came up for review the human should
   * lean toward AB" — the runtime is more conservative.
   *
   * keep-curator that the runtime DOES flip: curator source includes a
   * Levels.fyi / curated-research mention but is still seed-prefixed, so
   * the audit's isResearchSourced short-circuit fires while runtime treats
   * it as seed and flips via PREFER_IMPORTED_OVER_SEED_COMPANIES.
   *
   * Adding cells: investigate first, then pin only if intentional.
   * Removing cells: feel free — convergence is the goal. */
  const KNOWN_ACCEPT_AB_NO_FLIP = new Set<string>([
    "accenture/business-analyst/entry",
    "bajaj finance/software-engineer/mid",
    "capgemini/business-analyst/entry",
    "capgemini/project-manager/senior",
    "delhivery/software-engineer/entry",
    "hcl/project-manager/senior",
    "hdfc bank/business-analyst/mid",
    "hdfc bank/business-analyst/senior",
    "meesho/product-manager/mid",
    "mphasis/software-engineer/entry",
    "mphasis/software-engineer/mid",
    "mphasis/software-engineer/senior",
    "oyo/software-engineer/mid",
    "pine labs/software-engineer/mid",
    "tcs/business-analyst/entry",
    "unacademy/software-engineer/entry",
    "wipro/business-analyst/senior",
    "wipro/project-manager/senior",
  ]);
  const KNOWN_KEEP_CURATOR_FLIPS = new Set<string>([
    "paytm/software-engineer/entry",
    "tcs/software-engineer/mid",
    "wipro/software-engineer/senior",
    "zoho/software-engineer/entry",
  ]);

  it("'accept-ab' divergences match the pinned baseline", () => {
    const id = (c: ParityCell) => `${c.company}/${c.role}/${c.level}`;
    const observed = new Set(
      cells.filter((c) => c.recommendation === "accept-ab" && !c.runtimeFlipped).map(id),
    );
    const newDivergences = [...observed].filter((k) => !KNOWN_ACCEPT_AB_NO_FLIP.has(k));
    const resolved = [...KNOWN_ACCEPT_AB_NO_FLIP].filter((k) => !observed.has(k));
    expect(
      newDivergences,
      `New 'accept-ab' cells the runtime does NOT flip — investigate, then pin or fix:\n  ${newDivergences.join("\n  ")}`,
    ).toEqual([]);
    expect(
      resolved,
      `Pinned 'accept-ab' divergences are now resolved — remove from KNOWN_ACCEPT_AB_NO_FLIP:\n  ${resolved.join("\n  ")}`,
    ).toEqual([]);
  });

  it("'keep-curator' divergences match the pinned baseline", () => {
    const id = (c: ParityCell) => `${c.company}/${c.role}/${c.level}`;
    const observed = new Set(
      cells.filter((c) => c.recommendation === "keep-curator" && c.runtimeFlipped).map(id),
    );
    const newDivergences = [...observed].filter((k) => !KNOWN_KEEP_CURATOR_FLIPS.has(k));
    const resolved = [...KNOWN_KEEP_CURATOR_FLIPS].filter((k) => !observed.has(k));
    expect(
      newDivergences,
      `New 'keep-curator' cells the runtime DID flip — investigate, then pin or fix:\n  ${newDivergences.join("\n  ")}`,
    ).toEqual([]);
    expect(
      resolved,
      `Pinned 'keep-curator' divergences are now resolved — remove from KNOWN_KEEP_CURATOR_FLIPS:\n  ${resolved.join("\n  ")}`,
    ).toEqual([]);
  });

  it("manual-review bucket is empty (Phase 6 invariant)", () => {
    const stragglers = cells
      .filter((c) => c.recommendation === "manual-review")
      .map((c) => `${c.company} / ${c.role} / ${c.level}`);
    expect(stragglers, `${stragglers.length} manual-review cells:\n  ${stragglers.join("\n  ")}`)
      .toEqual([]);
  });
});
