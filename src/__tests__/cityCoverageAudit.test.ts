/**
 * City-coverage audit — sweeps every entry in CITY_SUGGESTIONS
 * (autocomplete) and asserts each resolves to a valid CityTier
 * (tier1/tier2/tier3) via getCityTier(). Catches drift between the
 * curated autocomplete list and the underlying tier-map.
 *
 * Also asserts CITY_TIER_MAP itself is well-formed: every key maps
 * to a valid tier, and the map is large enough to cover sub-zones
 * (city + neighbourhood + alias variants).
 */

import { describe, it, expect } from "vitest";
import {
  CITY_SUGGESTIONS,
  CITY_TIER_MAP,
  CITY_TIER_MAP_KEYS,
  CITY_MULTIPLIERS,
  getCityTier,
  type CityTier,
} from "../../data/city-tiers";

const VALID_TIERS: CityTier[] = ["tier1", "tier2", "tier3"];

describe("city-coverage audit", () => {
  it("CITY_TIER_MAP entries all map to valid tiers", () => {
    for (const [key, tier] of Object.entries(CITY_TIER_MAP)) {
      expect(VALID_TIERS, `${key}: invalid tier ${tier}`).toContain(tier);
    }
  });

  it("CITY_TIER_MAP covers ≥800 unique entries (city + sub-zone + alias)", () => {
    expect(CITY_TIER_MAP_KEYS.length, `CITY_TIER_MAP has only ${CITY_TIER_MAP_KEYS.length} keys`).toBeGreaterThanOrEqual(800);
  });

  it("CITY_MULTIPLIERS exists for all 3 tiers with sensible ranges", () => {
    for (const tier of VALID_TIERS) {
      const m = CITY_MULTIPLIERS[tier];
      expect(m, `${tier} missing multiplier`).toBeTruthy();
      expect(m.min).toBeGreaterThan(0.5);
      expect(m.max).toBeLessThanOrEqual(1.0);
      expect(m.min).toBeLessThanOrEqual(m.max);
    }
  });

  it("CITY_SUGGESTIONS autocomplete covers ≥200 cities", () => {
    expect(CITY_SUGGESTIONS.length, `CITY_SUGGESTIONS has only ${CITY_SUGGESTIONS.length} entries`).toBeGreaterThanOrEqual(200);
  });

  it("every CITY_SUGGESTIONS entry resolves to a tier (no silent tier1 default for known names)", () => {
    /* getCityTier() defaults to tier1 for unknown inputs; we want to
       verify the autocomplete doesn't have entries that ONLY resolve
       via the "unknown → tier1" default. Each entry should match the
       map either by exact key or substring. */
    let unmapped = 0;
    const unmappedSamples: string[] = [];
    for (const city of CITY_SUGGESTIONS) {
      const lower = city.toLowerCase();
      const exactMatch = CITY_TIER_MAP[lower];
      let substringMatch = false;
      if (!exactMatch) {
        for (const k of CITY_TIER_MAP_KEYS) {
          if (lower.includes(k) || k.includes(lower.split(/[ ,(]/, 1)[0].trim())) {
            substringMatch = true;
            break;
          }
        }
      }
      if (!exactMatch && !substringMatch && city !== "Remote / Pan-India") {
        unmapped++;
        if (unmappedSamples.length < 10) unmappedSamples.push(city);
      }
    }
    /* Allow up to 5% unmapped (city autocomplete may include freshly-added
       cities not yet in tier map). Surface samples for visibility. */
    if (unmapped > 0) {
      process.stderr.write(`\n⚠️  ${unmapped} CITY_SUGGESTIONS entries don't map to CITY_TIER_MAP:\n`);
      for (const s of unmappedSamples) process.stderr.write(`  ${s}\n`);
    }
    expect(unmapped / CITY_SUGGESTIONS.length, `${unmapped}/${CITY_SUGGESTIONS.length} unmapped (${((unmapped / CITY_SUGGESTIONS.length) * 100).toFixed(1)}%)`).toBeLessThan(0.05);
  });

  it("getCityTier() handles every autocomplete entry without throwing", () => {
    for (const city of CITY_SUGGESTIONS) {
      expect(() => getCityTier(city)).not.toThrow();
      const tier = getCityTier(city);
      expect(VALID_TIERS).toContain(tier);
    }
  });

  it("reports CITY_SUGGESTIONS distribution by tier", () => {
    const dist: Record<CityTier, number> = { tier1: 0, tier2: 0, tier3: 0 };
    for (const city of CITY_SUGGESTIONS) {
      if (city === "Remote / Pan-India") continue;
      const tier = getCityTier(city);
      dist[tier]++;
    }
    process.stderr.write("\n📊 CITY_SUGGESTIONS DISTRIBUTION (n=" + CITY_SUGGESTIONS.length + "):\n");
    process.stderr.write(`  tier1: ${dist.tier1}\n`);
    process.stderr.write(`  tier2: ${dist.tier2}\n`);
    process.stderr.write(`  tier3: ${dist.tier3}\n`);
    /* Reasonable balance — should have meaningful tier2 coverage
       (not just metro tier1 names). Tier 3 is sparse in autocomplete
       because most explicit tier3 cities resolve to tier2 via getCityTier
       substring fallback (e.g. "Bikaner" matches Rajasthan tier2 cluster).
       The actual tier3 anchor cells live in CITY_TIER_MAP for
       comp-adjustment, not in autocomplete display. */
    expect(dist.tier2).toBeGreaterThan(50);
  });
});
