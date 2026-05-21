/* Realism-Audit Fix 4 (2026-05-22) — tiered hike-cap by current CTC.
 *
 * Real services-co caps scale inversely with currentCtc (absolute hike
 * compresses as you climb). Asserts:
 *   - low CTC (₹6L)   → generous cap (≥ 50%) on IT-services / GCC
 *   - high CTC (₹50L) → tight cap (≤ 25%) on IT-services / GCC
 *   - PSU stays flat (≤ 15%) regardless of currentCtc — Pay-Commission
 *     rigidity (no inverse-scaling)
 *   - unknown currentCtc → falls back to persona's scalar `hikeCap`
 *     (back-compat for analyzer snapshots / serialized partial state)
 */
import { describe, it, expect } from "vitest";
import {
  getRecruiterSectorPersona,
  hikeCapByCtc,
} from "../../../server-handlers/_indian-recruiter-personas";

describe("Realism-Audit Fix 4 — IT-services tiers", () => {
  const itSvc = getRecruiterSectorPersona("it-services");
  it("₹6L (low) → generous cap", () => {
    expect(hikeCapByCtc(itSvc, 6)).toBeGreaterThanOrEqual(0.5);
  });
  it("₹15L (mid-low) → moderate cap (~30-40%)", () => {
    expect(hikeCapByCtc(itSvc, 15)).toBeGreaterThanOrEqual(0.25);
    expect(hikeCapByCtc(itSvc, 15)).toBeLessThanOrEqual(0.45);
  });
  it("₹35L (mid-high) → tighter cap (~20-30%)", () => {
    expect(hikeCapByCtc(itSvc, 35)).toBeLessThanOrEqual(0.30);
  });
  it("₹60L (high) → tight cap (~15-20%)", () => {
    expect(hikeCapByCtc(itSvc, 60)).toBeLessThanOrEqual(0.20);
  });
  it("monotonic non-increasing across tiers", () => {
    const a = hikeCapByCtc(itSvc, 6);
    const b = hikeCapByCtc(itSvc, 15);
    const c = hikeCapByCtc(itSvc, 35);
    const d = hikeCapByCtc(itSvc, 60);
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b).toBeGreaterThanOrEqual(c);
    expect(c).toBeGreaterThanOrEqual(d);
  });
});

describe("Realism-Audit Fix 4 — PSU stays rigid across tiers", () => {
  const psu = getRecruiterSectorPersona("psu");
  it("low → high CTC all stay ≤ 15% (cadre-pay rigidity)", () => {
    for (const ctc of [5, 15, 30, 80]) {
      expect(hikeCapByCtc(psu, ctc)).toBeLessThanOrEqual(0.15);
    }
  });
});

describe("Realism-Audit Fix 4 — back-compat (unknown currentCtc)", () => {
  it("null / undefined / non-positive falls back to scalar persona.hikeCap", () => {
    const p = getRecruiterSectorPersona("indian-unicorn");
    expect(hikeCapByCtc(p, null)).toBe(p.hikeCap);
    expect(hikeCapByCtc(p, undefined)).toBe(p.hikeCap);
    expect(hikeCapByCtc(p, 0)).toBe(p.hikeCap);
    expect(hikeCapByCtc(p, -5)).toBe(p.hikeCap);
    expect(hikeCapByCtc(p, NaN)).toBe(p.hikeCap);
  });
});

describe("Realism-Audit Fix 4 — unicorn / startup widen tiers vs IT-services", () => {
  it("unicorn ₹15L > IT-services ₹15L (more flex at growth-stage cos)", () => {
    const unicorn = getRecruiterSectorPersona("indian-unicorn");
    const itSvc = getRecruiterSectorPersona("it-services");
    expect(hikeCapByCtc(unicorn, 15)).toBeGreaterThanOrEqual(hikeCapByCtc(itSvc, 15));
  });
});
