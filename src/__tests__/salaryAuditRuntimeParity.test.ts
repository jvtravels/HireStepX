/**
 * Parity check: every (company, role, level) cell where curator and
 * IMPORTED both have an entry and they disagree by ≥25% must produce
 * matching outcomes from:
 *   - classifyDrift() — what the audit recommends
 *   - maybePreferImportedOverSeed() — what the runtime actually does
 *
 * The audit delegates the flip decision to shouldFlipToImported(), the
 * same predicate the runtime calls — so accept-ab and keep-curator are
 * in lockstep by construction. The remaining variable is the
 * manual-review bucket (runtime keeps curator, no audit heuristic
 * explains why); pinned below as a regression baseline.
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

  it("accept-ab ↔ runtime flip is in lockstep by construction", () => {
    const acceptAbButNoFlip = cells.filter((c) => c.recommendation === "accept-ab" && !c.runtimeFlipped);
    const keepCuratorButFlip = cells.filter((c) => c.recommendation === "keep-curator" && c.runtimeFlipped);
    expect(acceptAbButNoFlip).toEqual([]);
    expect(keepCuratorButFlip).toEqual([]);
  });

  /* manual-review baseline. These are cells where the runtime kept the
   * curator (so accept-ab is correctly off) but no keep-curator heuristic
   * fired either — typically because curator is plain AmbitionBox/seed
   * with high drift but the company isn't on the prefer-imported list,
   * or sample size missed the n-floor. They legitimately need human
   * eyes; the test pins the set so new ones surface in CI. */
  const KNOWN_MANUAL_REVIEW = new Set<string>([
    "bajaj finance/software-engineer/mid",
    "capgemini/project-manager/senior",
    "delhivery/software-engineer/entry",
    /* Bug-report 15 follow-up: Deloitte BA-Senior pinned to curated
     * Glassdoor/UpGrad numbers (₹20-30L, midpoint 25). Imported scrape
     * tracks generic Big-4 senior-consultant which is wider; keep
     * curator. */
    "deloitte/business-analyst/senior",
    "hcl/project-manager/senior",
    "hcl/software-engineer/entry",
    "hdfc bank/business-analyst/mid",
    "hdfc bank/business-analyst/senior",
    "meesho/business-analyst/entry",
    "meesho/product-manager/mid",
    "mphasis/software-engineer/entry",
    "mphasis/software-engineer/mid",
    "mphasis/software-engineer/senior",
    "oyo/software-engineer/mid",
    "pine labs/software-engineer/mid",
    "unacademy/software-engineer/entry",
    "wipro/business-analyst/senior",
    "wipro/project-manager/senior",
  ]);

  it("manual-review bucket matches the pinned baseline", () => {
    const id = (c: ParityCell) => `${c.company}/${c.role}/${c.level}`;
    const observed = new Set(cells.filter((c) => c.recommendation === "manual-review").map(id));
    const added = [...observed].filter((k) => !KNOWN_MANUAL_REVIEW.has(k));
    const resolved = [...KNOWN_MANUAL_REVIEW].filter((k) => !observed.has(k));
    expect(added, `New manual-review cells — investigate, then pin or add a keep-curator heuristic:\n  ${added.join("\n  ")}`).toEqual([]);
    expect(resolved, `Pinned manual-review cells are now resolved — remove from KNOWN_MANUAL_REVIEW:\n  ${resolved.join("\n  ")}`).toEqual([]);
  });
});
