/**
 * Domain canonicalisation + ADJACENT graph invariants
 * (Session A — Area 3).
 *
 * Properties asserted:
 *   D1. Every domain bucket emitted by DOMAIN_KEYWORDS exists as a key
 *       in ADJACENT (no orphan classifications that would always look
 *       up as undefined).
 *   D2. ADJACENT is well-formed: every neighbour referenced is itself a
 *       key in the map.
 *   D3. ADJACENT is bidirectional: if A in adjacent[B] then B in
 *       adjacent[A]. Asymmetries are a graph bug — even though the
 *       runtime classifier OR-checks both directions, the graph as a
 *       data artefact must be consistent so reasoning about it is
 *       sound.
 *   D4. computeApplicableYoe returns relations from {match, adjacent,
 *       pivot, unknown} only.
 *   D5. Cross-domain spot-checks: a curated set of (candidate, target)
 *       pairs classify into the documented bucket.
 */

import { describe, it, expect } from "vitest";
import {
  __DOMAIN_KEYWORDS_INTERNAL,
  __ADJACENT_INTERNAL,
  computeApplicableYoe,
} from "../../server-handlers/_candidate-profile";

describe("domain graph invariants", () => {
  it("[D1] every key emitted by DOMAIN_KEYWORDS is a key in ADJACENT", () => {
    const emitted = new Set(__DOMAIN_KEYWORDS_INTERNAL.map(([, k]) => k));
    const missing = [...emitted].filter((k) => !(k in __ADJACENT_INTERNAL));
    if (missing.length > 0) {
      process.stderr.write(`\nD1 missing in ADJACENT: ${missing.join(", ")}\n`);
    }
    expect(missing).toEqual([]);
  });

  it("[D2] every neighbour value in ADJACENT references a node that is itself a key in ADJACENT (no orphans)", () => {
    const keys = new Set(Object.keys(__ADJACENT_INTERNAL));
    const orphans: string[] = [];
    for (const [k, ns] of Object.entries(__ADJACENT_INTERNAL)) {
      for (const n of ns) if (!keys.has(n)) orphans.push(`${k} -> ${n}`);
    }
    if (orphans.length > 0) {
      process.stderr.write(`\nD2 orphan edges: ${orphans.join(", ")}\n`);
    }
    expect(orphans).toEqual([]);
  });

  it("[D3] ADJACENT is bidirectional: a∈adj[b] ⇒ b∈adj[a]", () => {
    const asym: string[] = [];
    for (const [a, ns] of Object.entries(__ADJACENT_INTERNAL)) {
      for (const b of ns) {
        const rev = __ADJACENT_INTERNAL[b] ?? [];
        if (!rev.includes(a)) asym.push(`${a} → ${b} (missing reverse ${b} → ${a})`);
      }
    }
    if (asym.length > 0) {
      process.stderr.write(`\nD3 asymmetries (${asym.length}):\n${asym.join("\n")}\n`);
    }
    expect(asym).toEqual([]);
  });

  it("[D4] computeApplicableYoe returns only {match, adjacent, pivot, unknown}", () => {
    const ALLOWED = new Set(["match", "adjacent", "pivot", "unknown"] as const);
    /* Sample a handful of representative (candidate, target) cross-
     * sections. The set of relations actually emitted across this
     * sample must be a subset of ALLOWED. */
    const samples: Array<{ primaryDomain: string; targetRole: string; totalYoe: number }> = [
      { primaryDomain: "Software Engineer", targetRole: "Backend Engineer", totalYoe: 5 },
      { primaryDomain: "Product Designer", targetRole: "Product Manager", totalYoe: 5 },
      { primaryDomain: "Engineering Manager", targetRole: "Product Manager", totalYoe: 8 },
      { primaryDomain: "Sales Manager", targetRole: "Customer Success Manager", totalYoe: 4 },
      { primaryDomain: "Marketing Manager", targetRole: "Product Marketing", totalYoe: 6 },
      { primaryDomain: "HR Manager", targetRole: "Software Engineer", totalYoe: 7 }, // pivot
      { primaryDomain: "Pottery Master", targetRole: "Astronaut", totalYoe: 3 }, // unknown
    ];
    for (const s of samples) {
      const r = computeApplicableYoe(s);
      expect(ALLOWED.has(r.relation as any)).toBe(true);
    }
  });

  it("[D5] spot-check semantic classifications (the design-intent table)", () => {
    const cases: Array<{ cand: string; tgt: string; expect: "match" | "adjacent" | "pivot" | "unknown" }> = [
      /* Engineering ↔ Engineering: match. */
      { cand: "Backend Engineer", tgt: "Backend Engineer", expect: "match" },
      /* Engineering ↔ Engineering Management: adjacent (Session B —
       * resolved deferred semantics). EM ↔ Backend is now bidirectionally
       * adjacent. */
      { cand: "Backend Engineer", tgt: "Engineering Manager", expect: "adjacent" },
      /* Product Design ↔ Engineering (frontend): adjacent. */
      { cand: "Product Designer", tgt: "Frontend Engineer", expect: "adjacent" },
      /* Product Design ↔ Backend (different craft): pivot (PD is
       * adjacent to frontend only — backend is not in PD's adjacency). */
      { cand: "Product Designer", tgt: "Backend Engineer", expect: "pivot" },
      /* Product Design ↔ Product Management: adjacent (Session B —
       * resolved deferred semantics). */
      { cand: "Product Designer", tgt: "Product Manager", expect: "adjacent" },
      /* Sales ↔ Customer Success: adjacent. */
      { cand: "Sales Manager", tgt: "Customer Success Manager", expect: "adjacent" },
      /* Sales ↔ Marketing: adjacent (Session B — resolved deferred
       * semantics). */
      { cand: "Sales Executive", tgt: "Marketing Manager", expect: "adjacent" },
      /* Operations ↔ Engineering: pivot (operations is pivot-only). */
      { cand: "Operations Manager", tgt: "Backend Engineer", expect: "pivot" },
      /* HR ↔ Engineering: pivot. */
      { cand: "HR Manager", tgt: "Backend Engineer", expect: "pivot" },
      /* Finance ↔ Engineering: pivot. */
      { cand: "Finance Manager", tgt: "Backend Engineer", expect: "pivot" },
      /* Data analyst ↔ Business analyst: both classify into the
       * "data-analyst" bucket (DOMAIN_KEYWORDS row 13 lumps them) →
       * match. The data-analyst↔business adjacency edge only kicks in
       * if the target text triggers the "business" bucket (bizops,
       * business operations). */
      { cand: "Data Analyst", tgt: "Business Analyst", expect: "match" },
      /* Business ops ↔ Data analyst: adjacent. */
      { cand: "BizOps Manager", tgt: "Data Analyst", expect: "adjacent" },
    ];
    for (const c of cases) {
      const r = computeApplicableYoe({
        primaryDomain: c.cand,
        targetRole: c.tgt,
        totalYoe: 5,
      });
      expect(r.relation, `${c.cand} -> ${c.tgt}`).toBe(c.expect);
    }
  });
});
