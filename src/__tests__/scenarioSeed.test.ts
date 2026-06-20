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
  reconstructSeenPersonas,
  tierBucketForCompanyTier,
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

describe("computeScenarioSeed — cross-session ledger (seenPersonas)", () => {
  it("empty / omitted ledger reproduces the legacy count-modulo pick exactly", () => {
    for (const tier of ALL_TIERS) {
      for (let count = 0; count < 6; count++) {
        const legacy = computeScenarioSeed({ userId: "u1", priorNegotiationCount: count, tierBucket: tier });
        const withEmpty = computeScenarioSeed({ userId: "u1", priorNegotiationCount: count, tierBucket: tier, seenPersonas: [] });
        expect(withEmpty.recruiterPersona).toBe(legacy.recruiterPersona);
        expect(withEmpty.rotationIndex).toBe(legacy.rotationIndex);
      }
    }
  });

  it("never repeats the immediately-prior persona, whatever the count says", () => {
    const tier: CompanyTierBucket = "growth_startup"; // 4 tones
    // Force a degenerate count that, modulo-only, would re-pick the last tone.
    for (const last of compatibleTones(tier)) {
      const seed = computeScenarioSeed({
        userId: "u1",
        priorNegotiationCount: 0,
        tierBucket: tier,
        seenPersonas: [last],
      });
      expect(seed.recruiterPersona).not.toBe(last);
      expect(compatibleTones(tier)).toContain(seed.recruiterPersona);
    }
  });

  it("prefers the stalest tone: re-serves the oldest-seen once all are seen", () => {
    const tier: CompanyTierBucket = "it_services"; // [consultative, agency, hardline]
    // Seen oldest→newest: consultative (stalest), agency, hardline (freshest).
    const seed = computeScenarioSeed({
      userId: "u1",
      priorNegotiationCount: 3,
      tierBucket: tier,
      seenPersonas: ["consultative", "agency", "hardline"],
    });
    expect(seed.recruiterPersona).toBe("consultative");
  });

  it("guarantees no back-to-back repeat even across mixed tiers", () => {
    // Alternating tier sizes (2 vs 3 tones) is exactly where count-modulo
    // can collide; the ledger must still prevent consecutive repeats.
    const tierSeq: (CompanyTierBucket | null)[] = [
      "bfsi", "it_services", "psu", "growth_startup", "bfsi", "it_services", null, "fmcg",
    ];
    const seen: ReturnType<typeof compatibleTones> = [];
    let prev: string | null = null;
    tierSeq.forEach((tier, i) => {
      const seed = computeScenarioSeed({
        userId: "mixed-user",
        priorNegotiationCount: i,
        tierBucket: tier,
        seenPersonas: [...seen],
      });
      if (prev !== null) expect(seed.recruiterPersona).not.toBe(prev);
      expect(compatibleTones(tier)).toContain(seed.recruiterPersona);
      seen.push(seed.recruiterPersona);
      prev = seed.recruiterPersona;
    });
  });
});

describe("reconstructSeenPersonas — ledger replay from prior companies", () => {
  it("returns one tone per prior session, all tier-compatible, in order", () => {
    const tiers: (CompanyTierBucket | null)[] = ["growth_startup", "growth_startup", "growth_startup"];
    const seen = reconstructSeenPersonas("user-x", tiers);
    expect(seen).toHaveLength(3);
    tiers.forEach((tier, i) => expect(compatibleTones(tier)).toContain(seen[i]));
  });

  it("is self-consistent: consecutive same-tier sessions never repeat a tone", () => {
    const tiers: (CompanyTierBucket | null)[] = new Array(5).fill("it_services");
    const seen = reconstructSeenPersonas("user-y", tiers);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it("empty history → empty ledger", () => {
    expect(reconstructSeenPersonas("user-z", [])).toEqual([]);
  });

  it("feeds back into computeScenarioSeed so the next session avoids the last tone", () => {
    const tiers: (CompanyTierBucket | null)[] = ["bfsi", "bfsi", "bfsi"];
    const seen = reconstructSeenPersonas("returning", tiers);
    const next = computeScenarioSeed({
      userId: "returning",
      priorNegotiationCount: tiers.length,
      tierBucket: "bfsi",
      seenPersonas: seen,
    });
    expect(next.recruiterPersona).not.toBe(seen[seen.length - 1]);
  });
});

describe("tierBucketForCompanyTier — single source of truth", () => {
  it("maps representative company tiers to the right bucket", () => {
    expect(tierBucketForCompanyTier("faang")).toBe("listed_big_tech");
    expect(tierBucketForCompanyTier("gcc")).toBe("listed_big_tech");
    expect(tierBucketForCompanyTier("indian-unicorn")).toBe("mature_unicorn");
    expect(tierBucketForCompanyTier("startup-early")).toBe("early_startup");
    expect(tierBucketForCompanyTier("startup-growth")).toBe("growth_startup");
    expect(tierBucketForCompanyTier("it-services")).toBe("it_services");
    expect(tierBucketForCompanyTier("bfsi-domestic")).toBe("bfsi");
    expect(tierBucketForCompanyTier("fmcg-mnc")).toBe("fmcg");
    expect(tierBucketForCompanyTier("government-psu")).toBe("psu");
  });

  it("maps null / unknown tier to null bucket", () => {
    expect(tierBucketForCompanyTier(null)).toBeNull();
  });
});
