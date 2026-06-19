/* Per-session scenario seed — repeat-session freshness (2026-06-20).
 *
 * The user reported the core complaint this module addresses: a
 * returning user practising the same scenario feels the bot is "the
 * same every time, not personalised". The deterministic kernel is
 * correct to reproduce the same band/numbers for the same market inputs;
 * the freshness lever is the recruiter TONE axis, which negotiate-turn
 * never varied (every session ran the hardwired "consultative" tone).
 *
 * These tests lock the contract that makes the rotation safe AND felt:
 *   - consecutive sessions never draw the same recruiter tone;
 *   - rotation is deterministic and reproducible per (userId, count);
 *   - tone choices stay plausible for the company tier (no startup
 *     "founder" at a PSU, no commission "agency" at an in-house GCC);
 *   - anonymous / malformed inputs degrade to a valid deterministic tone.
 */
import { describe, it, expect } from "vitest";
import {
  computeScenarioSeed,
  compatibleTones,
  type ScenarioSeed,
} from "../../server-handlers/_scenario-seed";
import type { RecruiterPersona } from "../../server-handlers/_negotiation-kernel";
import type { CompanyTierBucket } from "../_negotiation-math";

const ALL_TIERS: (CompanyTierBucket | null)[] = [
  "listed_big_tech",
  "listed_unicorn",
  "mature_unicorn",
  "growth_startup",
  "early_startup",
  "it_services",
  "bfsi",
  "fmcg",
  "psu",
  null,
];

const VALID: RecruiterPersona[] = ["hardline", "consultative", "founder", "agency"];

describe("compatibleTones — realism constraints", () => {
  it("every tier offers at least two tones (so consecutive sessions can differ)", () => {
    for (const tier of ALL_TIERS) {
      expect(compatibleTones(tier).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("only returns valid RecruiterPersona values, with no duplicates", () => {
    for (const tier of ALL_TIERS) {
      const tones = compatibleTones(tier);
      for (const t of tones) expect(VALID).toContain(t);
      expect(new Set(tones).size).toBe(tones.length);
    }
  });

  it("'founder' only appears at early/growth startups", () => {
    for (const tier of ALL_TIERS) {
      const hasFounder = compatibleTones(tier).includes("founder");
      if (tier === "early_startup" || tier === "growth_startup") {
        expect(hasFounder).toBe(true);
      } else {
        expect(hasFounder).toBe(false);
      }
    }
  });

  it("'agency' never appears at in-house tiers (GCC/BFSI/PSU/FMCG/unicorn)", () => {
    const noAgency: (CompanyTierBucket | null)[] = [
      "listed_big_tech",
      "listed_unicorn",
      "mature_unicorn",
      "bfsi",
      "fmcg",
      "psu",
      null,
    ];
    for (const tier of noAgency) {
      expect(compatibleTones(tier).includes("agency")).toBe(false);
    }
  });

  it("'consultative' is universally available as the baseline", () => {
    for (const tier of ALL_TIERS) {
      expect(compatibleTones(tier).includes("consultative")).toBe(true);
    }
  });
});

describe("computeScenarioSeed — rotation freshness", () => {
  it("consecutive sessions never repeat the same recruiter tone", () => {
    for (const tier of ALL_TIERS) {
      const len = compatibleTones(tier).length;
      let prev: RecruiterPersona | null = null;
      // Walk a full cycle plus wrap-around.
      for (let count = 0; count <= len + 2; count++) {
        const seed = computeScenarioSeed({ userId: "user-abc", priorNegotiationCount: count, tierBucket: tier });
        if (prev !== null) expect(seed.recruiterPersona).not.toBe(prev);
        prev = seed.recruiterPersona;
      }
    }
  });

  it("cycles through every compatible tone before any repeats", () => {
    const tier: CompanyTierBucket = "growth_startup"; // 4 tones
    const len = compatibleTones(tier).length;
    const seen = new Set<RecruiterPersona>();
    for (let count = 0; count < len; count++) {
      const seed = computeScenarioSeed({ userId: "u1", priorNegotiationCount: count, tierBucket: tier });
      seen.add(seed.recruiterPersona);
    }
    expect(seen.size).toBe(len); // full coverage in one cycle
  });

  it("is deterministic: same (userId, count, tier) → same tone", () => {
    const a = computeScenarioSeed({ userId: "stable", priorNegotiationCount: 3, tierBucket: "it_services" });
    const b = computeScenarioSeed({ userId: "stable", priorNegotiationCount: 3, tierBucket: "it_services" });
    expect(a.recruiterPersona).toBe(b.recruiterPersona);
    expect(a.rotationIndex).toBe(b.rotationIndex);
  });

  it("different users de-sync: not every first session lands on the same tone", () => {
    const tier: CompanyTierBucket = "growth_startup";
    const firsts = new Set<RecruiterPersona>();
    for (const u of ["alice", "bob", "carol", "dave", "erin", "frank"]) {
      firsts.add(computeScenarioSeed({ userId: u, priorNegotiationCount: 0, tierBucket: tier }).recruiterPersona);
    }
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("always returns a tone that is compatible with the tier", () => {
    for (const tier of ALL_TIERS) {
      const tones = compatibleTones(tier);
      for (let count = 0; count < 8; count++) {
        const seed = computeScenarioSeed({ userId: "x", priorNegotiationCount: count, tierBucket: tier });
        expect(tones).toContain(seed.recruiterPersona);
      }
    }
  });
});

describe("computeScenarioSeed — difficulty progression", () => {
  it("escalates warmup → standard → hardball with experience", () => {
    const diff = (n: number): ScenarioSeed["difficulty"] =>
      computeScenarioSeed({ userId: "u", priorNegotiationCount: n, tierBucket: "bfsi" }).difficulty;
    expect(diff(0)).toBe("warmup");
    expect(diff(1)).toBe("warmup");
    expect(diff(2)).toBe("standard");
    expect(diff(4)).toBe("standard");
    expect(diff(5)).toBe("hardball");
    expect(diff(50)).toBe("hardball");
  });
});

describe("computeScenarioSeed — degraded inputs", () => {
  it("anonymous (null userId) returns a valid deterministic tone", () => {
    const a = computeScenarioSeed({ userId: null, priorNegotiationCount: 0, tierBucket: "psu" });
    const b = computeScenarioSeed({ userId: null, priorNegotiationCount: 0, tierBucket: "psu" });
    expect(VALID).toContain(a.recruiterPersona);
    expect(a.recruiterPersona).toBe(b.recruiterPersona);
  });

  it("negative / NaN counts clamp to a valid tone (no crash, no out-of-range index)", () => {
    for (const bad of [-5, NaN, Infinity, -Infinity]) {
      const seed = computeScenarioSeed({ userId: "u", priorNegotiationCount: bad, tierBucket: "fmcg" });
      expect(compatibleTones("fmcg")).toContain(seed.recruiterPersona);
      expect(seed.rotationIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("null tier still rotates between consultative and hardline", () => {
    const s0 = computeScenarioSeed({ userId: "u", priorNegotiationCount: 0, tierBucket: null });
    const s1 = computeScenarioSeed({ userId: "u", priorNegotiationCount: 1, tierBucket: null });
    expect(s0.recruiterPersona).not.toBe(s1.recruiterPersona);
    expect(["consultative", "hardline"]).toContain(s0.recruiterPersona);
    expect(["consultative", "hardline"]).toContain(s1.recruiterPersona);
  });
});
