import { describe, it, expect } from "vitest";
import {
  BEHAVIORAL_50,
  BEHAVIORAL_BANK,
  BEHAVIORAL_COMPETENCIES,
  BEHAVIORAL_ROLES,
  COMPETENCY_LABELS,
  sampleBehavioralQuestions,
} from "../../data/behavioral-question-bank";

describe("BEHAVIORAL_50 — shape & coverage", () => {
  it("has exactly 73 entries (61 + 12 W4 data/ops/marketing/sales affinity)", () => {
    /* The export is named `BEHAVIORAL_50` for historical reasons; the bank
       grew when `adaptability` + `execution-rigor` were split out from
       `ambiguity` / `ownership` (→ 56), then again when Phase-6.6 added
       designer-affinity entries (cnf-06, amb-05, dec-06, fdb-04, mnt-05) → 61,
       then again when W4 (2026-06) closed the taxonomy gap by adding three
       affinity questions each for data, ops, marketing, sales → 73.
       The constant length is the source of truth, not the name. */
    expect(BEHAVIORAL_50).toHaveLength(73);
  });

  it("every entry has a valid competency", () => {
    const valid = new Set<string>(BEHAVIORAL_COMPETENCIES);
    for (const q of BEHAVIORAL_50) {
      expect(valid.has(q.competency)).toBe(true);
    }
  });

  it("every entry has a valid starFocus + difficulty", () => {
    const validStar = new Set(["action", "result", "situation-task", "action+result"]);
    const validDiff = new Set(["warmup", "standard", "hard"]);
    for (const q of BEHAVIORAL_50) {
      expect(validStar.has(q.starFocus)).toBe(true);
      expect(validDiff.has(q.difficulty)).toBe(true);
    }
  });

  it("frequencyPct lies in [0, 100]", () => {
    for (const q of BEHAVIORAL_50) {
      expect(q.frequencyPct).toBeGreaterThanOrEqual(0);
      expect(q.frequencyPct).toBeLessThanOrEqual(100);
    }
  });

  it("question text begins with 'Tell me about a time' for the entire bank", () => {
    // Real interviewer phrasing — guard against drift.
    for (const q of BEHAVIORAL_50) {
      expect(q.text.toLowerCase().startsWith("tell me about a time")).toBe(true);
    }
  });

  it("covers every competency at least once", () => {
    const seen = new Set(BEHAVIORAL_50.map(q => q.competency));
    for (const c of BEHAVIORAL_COMPETENCIES) {
      expect(seen.has(c)).toBe(true);
    }
  });

  it("COMPETENCY_LABELS has a label for every competency", () => {
    for (const c of BEHAVIORAL_COMPETENCIES) {
      expect(COMPETENCY_LABELS[c]).toBeTruthy();
      expect(COMPETENCY_LABELS[c].length).toBeGreaterThan(2);
    }
  });
});

describe("sampleBehavioralQuestions", () => {
  it("returns exactly N questions when N ≤ competency count", () => {
    const out = sampleBehavioralQuestions({ count: 5, seed: 42 });
    expect(out).toHaveLength(5);
  });

  it("dedupes by competency when N ≤ competency count", () => {
    const out = sampleBehavioralQuestions({ count: 6, seed: 42 });
    const competencies = new Set(out.map(q => q.competency));
    expect(competencies.size).toBe(6);
  });

  it("is deterministic for the same seed", () => {
    const a = sampleBehavioralQuestions({ count: 5, seed: 7 });
    const b = sampleBehavioralQuestions({ count: 5, seed: 7 });
    expect(a.map(q => q.text)).toEqual(b.map(q => q.text));
  });

  it("returns different orderings for different seeds", () => {
    const a = sampleBehavioralQuestions({ count: 6, seed: 1 });
    const b = sampleBehavioralQuestions({ count: 6, seed: 99 });
    // At least one position must differ given a meaningful seed delta.
    const allMatch = a.every((q, i) => q.text === b[i].text);
    expect(allMatch).toBe(false);
  });

  it("respects difficulty=warmup (no hard questions)", () => {
    const out = sampleBehavioralQuestions({ count: 5, seed: 11, difficulty: "warmup" });
    for (const q of out) {
      expect(q.difficulty).not.toBe("hard");
    }
  });

  it("respects difficulty=hard (no warmup questions)", () => {
    const out = sampleBehavioralQuestions({ count: 5, seed: 11, difficulty: "hard" });
    for (const q of out) {
      expect(q.difficulty).not.toBe("warmup");
    }
  });

  it("prioritises requested competencies when prioritise is set", () => {
    const out = sampleBehavioralQuestions({
      count: 3,
      seed: 5,
      prioritise: ["conflict", "decision-making"],
    });
    // At least the first slot should be a prioritised competency.
    const prioritised = new Set(["conflict", "decision-making"]);
    expect(prioritised.has(out[0].competency)).toBe(true);
  });

  it("never throws + always returns ≤ count", () => {
    expect(() => sampleBehavioralQuestions({ count: 100, seed: 1 })).not.toThrow();
    const out = sampleBehavioralQuestions({ count: 100, seed: 1 });
    expect(out.length).toBeLessThanOrEqual(BEHAVIORAL_50.length);
  });
});

describe("BEHAVIORAL_50 — role/seniority tagging", () => {
  it("roleAffinity (when present) only contains valid role strings", () => {
    const validRoles = new Set<string>(BEHAVIORAL_ROLES);
    for (const q of BEHAVIORAL_50) {
      if (q.roleAffinity === undefined) continue;
      expect(Array.isArray(q.roleAffinity)).toBe(true);
      expect(q.roleAffinity.length).toBeGreaterThan(0);
      for (const r of q.roleAffinity) {
        expect(validRoles.has(r)).toBe(true);
      }
    }
  });

  it("seniorityFloor (when present) is a number 0–10", () => {
    for (const q of BEHAVIORAL_50) {
      if (q.seniorityFloor === undefined) continue;
      expect(typeof q.seniorityFloor).toBe("number");
      expect(q.seniorityFloor).toBeGreaterThanOrEqual(0);
      expect(q.seniorityFloor).toBeLessThanOrEqual(10);
    }
  });
});

describe("sampleBehavioralQuestions — role/yoe tilt", () => {
  it("yoe=1 filters out questions whose seniorityFloor > 1", () => {
    const out = sampleBehavioralQuestions({ count: 50, seed: 3, yoe: 1 });
    for (const q of out) {
      expect((q.seniorityFloor ?? 0) <= 1).toBe(true);
    }
  });

  it("role='engineer' yields zero designer-only questions when alternatives exist", () => {
    const out = sampleBehavioralQuestions({ count: 12, seed: 9, role: "engineer" });
    for (const q of out) {
      // A question is "designer-only" if roleAffinity is set and excludes engineer.
      if (q.roleAffinity && q.roleAffinity.length > 0) {
        expect(q.roleAffinity.includes("engineer")).toBe(true);
      }
    }
  });

  it("the 'complex codebase' onboarding probe is engineer-affinity (not universal)", () => {
    /* Regression: this question lacked roleAffinity, so it counted as
       universal and leaked to a marketer on the LLM-down path (live QA,
       2026-06). It is intrinsically an engineering question. */
    const codebaseQ = BEHAVIORAL_50.find(q => /complex codebase/i.test(q.text));
    expect(codebaseQ).toBeDefined();
    expect(codebaseQ?.roleAffinity).toEqual(["engineer"]);
  });

  it("role='marketing' steers away from engineer-locked questions (no codebase probe)", () => {
    // count=12 covers every competency once; plenty of universal alternatives
    // exist for mentorship-team, so the engineer-only codebase probe must not
    // appear for a marketer.
    const out = sampleBehavioralQuestions({ count: 12, seed: 9, role: "marketing" });
    expect(out.some(q => /complex codebase/i.test(q.text))).toBe(false);
    for (const q of out) {
      // Any role-locked question that survived must include marketing.
      if (q.roleAffinity && q.roleAffinity.length > 0) {
        expect(q.roleAffinity.includes("marketing")).toBe(true);
      }
    }
  });

  it("role='sales' likewise draws only universal-or-sales questions", () => {
    const out = sampleBehavioralQuestions({ count: 12, seed: 21, role: "sales" });
    for (const q of out) {
      if (q.roleAffinity && q.roleAffinity.length > 0) {
        expect(q.roleAffinity.includes("sales")).toBe(true);
      }
    }
  });

  it("deterministic snapshot: count=5, seed=42, no role/yoe", () => {
    /* Pinned snapshot to catch unintended drift in the sampler logic.
       Adding/removing bank entries naturally changes the shuffle output,
       so this expectation gets re-pinned alongside any bank-size change
       — that's expected, not a regression. The invariant the test
       protects is: same seed + same bank → same output. */
    const out = sampleBehavioralQuestions({ count: 5, seed: 42 });
    expect(out.map(q => q.text)).toEqual([
      "Tell me about a time you had to revive a stalled deal or pipeline late in the quarter.",
      "Tell me about a time you took credit for less than you contributed.",
      "Tell me about a time the problem statement was unclear and you had to create clarity for the team through design.",
      "Tell me about a time you helped a struggling teammate.",
      "Tell me about a time you received tough feedback.",
    ]);
  });
});

describe("Phase 6.6 — designer-affinity coverage for SPD loops", () => {
  /* Senior Product Designer loops grade influence + judgement + leadership
     alongside execution. Pre-Phase-6.6 the bank had ZERO designer-affinity
     entries — every designer fell through to universal questions and missed
     the SPD-specific shape (cross-functional design disagreement, UX vs
     business trade-offs, direction-change after critique/data, raising team
     design quality). These tests pin the five canonical SPD question types
     to live ids so a future bank refactor can't silently drop them. */
  it("has at least one designer-affinity question in each of the 5 SPD-load-bearing competencies", () => {
    const sppCompetencies = [
      "conflict",         // disagreement with PM / eng
      "ambiguity",        // unclear problem → clarity through design
      "decision-making",  // UX vs business goal trade-off
      "feedback",         // changed direction after critique / data
      "mentorship-team",  // raised team design quality
    ] as const;
    for (const c of sppCompetencies) {
      const hits = BEHAVIORAL_50.filter(
        q => q.competency === c && q.roleAffinity?.includes("designer"),
      );
      expect(hits.length, `competency=${c} must have ≥1 designer-affinity entry`).toBeGreaterThan(0);
    }
  });

  it("the canonical SPD ids are present with correct text shape", () => {
    const expected: Array<{ id: string; matches: RegExp }> = [
      { id: "cnf-06", matches: /disagreed with a PM or engineer/i },
      { id: "amb-05", matches: /problem statement was unclear/i },
      { id: "dec-06", matches: /user experience with a business goal/i },
      { id: "fdb-04", matches: /changed your design direction/i },
      { id: "mnt-05", matches: /raised the design quality/i },
    ];
    for (const { id, matches } of expected) {
      const q = BEHAVIORAL_50.find(x => x.id === id);
      expect(q, `${id} must exist`).toBeDefined();
      expect(q!.text).toMatch(matches);
      expect(q!.roleAffinity).toContain("designer");
    }
  });

  it("sampling with role='designer' surfaces designer-affinity questions across seeds", () => {
    /* Role partition treats universal AND role-matching entries as
       equally eligible (by design — universal questions still apply to
       designers). So a single-seed run isn't guaranteed to pick a
       designer-affinity entry. Statistical guard: across 20 seeds with
       count=12 / yoe=6, at least one run must surface ≥1 designer-affinity
       question. Catches the regression where the role filter accidentally
       *excludes* designer-only entries (the bug we'd actually care about). */
    let anyDesignerHit = false;
    for (let s = 0; s < 20; s++) {
      const out = sampleBehavioralQuestions({ count: 12, seed: s, role: "designer", yoe: 6 });
      if (out.some(q => q.roleAffinity?.includes("designer"))) {
        anyDesignerHit = true;
        break;
      }
    }
    expect(anyDesignerHit).toBe(true);
  });
});

describe("W4 — data/ops/marketing/sales affinity coverage", () => {
  /* Pre-W4 the bank had affinity-tagged questions only for engineer +
     designer; data, ops, marketing, and sales fell through entirely to
     universal questions and never got role-specific shape (messy-data
     recommendations for analysts, live-incident command for ops, a
     campaign that missed for marketers, a lost deal for sales). W4 added
     three affinity questions per role. These tests pin that coverage. */
  const W4_ROLES = ["data", "ops", "marketing", "sales"] as const;

  it("each of the 4 roles now carries ≥3 own-affinity questions", () => {
    for (const role of W4_ROLES) {
      const hits = BEHAVIORAL_50.filter(q => q.roleAffinity?.includes(role));
      expect(hits.length, `role=${role} must have ≥3 affinity entries`).toBeGreaterThanOrEqual(3);
    }
  });

  it("the canonical W4 ids exist with role-appropriate text + affinity", () => {
    const expected: Array<{ id: string; role: typeof W4_ROLES[number]; matches: RegExp }> = [
      { id: "data-01", role: "data",      matches: /messy, incomplete, or contradictory data/i },
      { id: "ops-01",  role: "ops",       matches: /operational incident or crisis/i },
      { id: "mkt-01",  role: "marketing", matches: /campaign or growth bet/i },
      { id: "sal-01",  role: "sales",     matches: /you lost a deal/i },
    ];
    for (const { id, role, matches } of expected) {
      const q = BEHAVIORAL_50.find(x => x.id === id);
      expect(q, `${id} must exist`).toBeDefined();
      expect(q!.text).toMatch(matches);
      expect(q!.roleAffinity).toContain(role);
    }
  });

  it("sampling each W4 role surfaces ≥1 own-affinity question across seeds", () => {
    /* Same statistical guard as the designer test: universal questions are
       equally eligible, so a single seed isn't guaranteed to surface an
       affinity entry — but across 20 seeds at least one run must. Catches
       the regression where the role filter accidentally EXCLUDES the new
       role-locked entries (i.e. they become unreachable). */
    for (const role of W4_ROLES) {
      let hit = false;
      for (let s = 0; s < 20; s++) {
        const out = sampleBehavioralQuestions({ count: 12, seed: s, role });
        if (out.some(q => q.roleAffinity?.includes(role))) { hit = true; break; }
      }
      expect(hit, `role=${role} should surface an affinity question within 20 seeds`).toBe(true);
    }
  });

  it("W4 role-locked questions never leak to a non-matching role", () => {
    /* A data-affinity question must not appear for a marketer, etc. The
       sampler partitions matches-or-universal first; any role-locked entry
       that survives MUST list the requested role. */
    const w4Ids = new Set(["data-01","data-02","data-03","ops-01","ops-02","ops-03","mkt-01","mkt-02","mkt-03","sal-01","sal-02","sal-03"]);
    for (const role of W4_ROLES) {
      const out = sampleBehavioralQuestions({ count: 20, seed: 4, role });
      for (const q of out) {
        if (w4Ids.has(q.id)) {
          expect(q.roleAffinity?.includes(role), `${q.id} leaked to role=${role}`).toBe(true);
        }
      }
    }
  });
});

describe("BEHAVIORAL_BANK — canonical alias for BEHAVIORAL_50", () => {
  it("points at the same array reference", () => {
    /* Same-identity check: any consumer importing the new name gets
       exactly what the legacy import returns. No dual-source-of-truth
       drift possible. */
    expect(BEHAVIORAL_BANK).toBe(BEHAVIORAL_50);
  });
});

describe("sampleBehavioralQuestions — weightByFrequency", () => {
  it("is deterministic for the same seed", () => {
    const a = sampleBehavioralQuestions({ count: 5, seed: 7, weightByFrequency: true });
    const b = sampleBehavioralQuestions({ count: 5, seed: 7, weightByFrequency: true });
    expect(a.map(q => q.text)).toEqual(b.map(q => q.text));
  });

  it("prefers high-frequency questions across many seeds", () => {
    /* Statistical guard, not a snapshot. Across 50 seeds, the average
       frequencyPct of the first slot under weighted sampling should be
       higher than the bank-wide mean. Catches regressions where a
       refactor accidentally restores the uniform shuffle. */
    const N = 50;
    let topAvg = 0;
    for (let s = 0; s < N; s++) {
      const top = sampleBehavioralQuestions({ count: 1, seed: s, weightByFrequency: true })[0];
      topAvg += top.frequencyPct;
    }
    topAvg /= N;
    const bankAvg = BEHAVIORAL_50.reduce((a, q) => a + q.frequencyPct, 0) / BEHAVIORAL_50.length;
    expect(topAvg).toBeGreaterThan(bankAvg);
  });

  it("default (no weightByFrequency) preserves the original uniform shuffle pin", () => {
    // Re-checks the seed=42 snapshot above to guarantee the new flag
    // doesn't accidentally leak into the default path.
    const out = sampleBehavioralQuestions({ count: 5, seed: 42 });
    expect(out[0].text).toBe(
      "Tell me about a time you had to revive a stalled deal or pipeline late in the quarter.",
    );
  });
});

describe("COMPETENCY_LABELS — coverage for blindSpots UI", () => {
  /* The report's blindSpots UI is label-keyed via COMPETENCY_LABELS
     (see src/sessionReport/SessionReportView.tsx). Adding a new
     competency to BEHAVIORAL_COMPETENCIES without a label entry would
     surface as a missing badge in the report. This test was added in
     2026-05 alongside adaptability + execution-rigor as a regression
     guard. */
  it("every competency in the taxonomy has a human-readable label", () => {
    for (const c of BEHAVIORAL_COMPETENCIES) {
      expect(COMPETENCY_LABELS[c]).toBeTruthy();
      expect(COMPETENCY_LABELS[c]).not.toMatch(/^undefined$/i);
    }
  });

  it("labels are short enough to fit in a badge chip (< 32 chars)", () => {
    for (const c of BEHAVIORAL_COMPETENCIES) {
      expect(COMPETENCY_LABELS[c].length).toBeLessThan(32);
    }
  });
});
