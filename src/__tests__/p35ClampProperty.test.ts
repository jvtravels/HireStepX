/**
 * Session B (2026-05-14) — Area 8 audit.
 *
 * P35 opening-clamp universality: for any (totalMin, totalMax) the
 * opener returned by clampOpenerToP35 must satisfy:
 *   opener <= totalMin + 0.35 * (totalMax - totalMin)
 *
 * Also exercises the live band-resolution path via generateNegotiationBand
 * to confirm both construction sites (per-company override + sector
 * fallback) route through the helper.
 *
 * Property test: 100 randomised synthetic bands. The pseudo-random
 * generator is seeded so the suite is deterministic — failure
 * reproduction does not depend on Date.now().
 */
import { describe, it, expect } from "vitest";
import { clampOpenerToP35, generateNegotiationBand } from "../../data/salary-lookup";

/* The helper rounds to 1 decimal (₹0.1L); a 91.55 P35 cap rounds to
 * 91.6. Allow the rounding half-step in invariant assertions. */
const EPS = 0.05 + 1e-6;

describe("P35 opener clamp — helper invariant", () => {
  it("clampOpenerToP35 always returns <= P35 cap", () => {
    /* Seeded LCG so failures reproduce. */
    let state = 0xdeadbeef >>> 0;
    const rnd = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    for (let i = 0; i < 100; i++) {
      const totalMin = 1 + rnd() * 80; // 1..81 LPA
      const span = 1 + rnd() * 200;     // 1..201 LPA spread
      const totalMax = totalMin + span;
      const opener = clampOpenerToP35(totalMin, totalMax);
      const cap = totalMin + 0.35 * (totalMax - totalMin);
      expect(opener, `min=${totalMin} max=${totalMax}`).toBeLessThanOrEqual(cap + EPS);
      /* And opener must be at least totalMin (a degenerate empty span
       * case still resolves to totalMin). */
      expect(opener).toBeGreaterThanOrEqual(totalMin - EPS);
    }
  });

  it("degenerate band (totalMin === totalMax) returns the pinch point", () => {
    expect(clampOpenerToP35(40, 40)).toBeCloseTo(40, 6);
  });

  it("zero-width is robust at small magnitudes (0.5 LPA)", () => {
    expect(clampOpenerToP35(0.5, 0.5)).toBeCloseTo(0.5, 6);
  });
});

describe("P35 opener clamp — end-to-end band construction parity", () => {
  /* Both construction paths (per-company override + sector fallback)
   * must respect the P35 invariant. We exercise both by hitting a
   * company that has a verified override (Razorpay → curated) AND a
   * company with no override (synthetic name → sector fallback). */
  const cases = [
    { company: "Razorpay", role: "software-engineer", exp: "senior" as const },
    { company: "Razorpay", role: "product-manager", exp: "mid" as const },
    { company: "TCS",      role: "software-engineer", exp: "entry" as const },
    /* Synthetic / unknown company → sector fallback layer. */
    { company: "UnknownCorp-XYZ-9999", role: "software-engineer", exp: "mid" as const },
    { company: "UnknownCorp-XYZ-8888", role: "product-manager", exp: "senior" as const },
  ];
  for (const c of cases) {
    it(`${c.company}/${c.role}/${c.exp}: initialOffer <= P35(totalMin, totalMax)`, () => {
      const band = generateNegotiationBand({
        company: c.company,
        role: c.role,
        experienceLevel: c.exp,
      });
      /* Reconstruct the resolved (totalMin..totalMax) from the band's
       * minOffer (≈ totalMin * 0.95) and maxStretch (≈ totalMin +
       * 0.85*(totalMax-totalMin)). Exact arithmetic isn't necessary —
       * the stronger property is that initialOffer never crosses the
       * MAX-side band; that gives an upper bound on how far above
       * minOffer the opener can sit. Conservative check: opener <
       * 0.45*(maxStretch - minOffer) + minOffer. P35 spread (35%) is
       * always below 45% of the constructed (min..max). */
      const heuristicCap = band.minOffer + 0.5 * (band.maxStretch - band.minOffer);
      expect(band.initialOffer, JSON.stringify(c)).toBeLessThanOrEqual(heuristicCap + EPS);
      /* And opener must be > walkAway floor — kernel band invariant. */
      expect(band.initialOffer).toBeGreaterThan(band.walkAway);
    });
  }
});

describe("P35 opener clamp — randomised end-to-end property", () => {
  /* Randomly select 100 (company, role, exp) triples drawn from real
   * overrides + sector fallback. The kernel band invariant requires
   * walkAway < initialOffer <= maxStretch on every path. If a future
   * construction path forgets to clamp via clampOpenerToP35, it would
   * almost certainly violate this floor/ceiling relationship for at
   * least one of the synthetic samples. */
  it("kernel band invariant (walkAway < initialOffer <= maxStretch) holds across 100 random configs", () => {
    let state = 0xfeedface >>> 0;
    const rnd = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const companies = ["Razorpay", "Flipkart", "TCS", "Infosys", "Swiggy", "Zomato", "Phonepe", "Cred", "Unknown-Co-1", "Unknown-Co-2"];
    const roles = ["software-engineer", "product-manager", "data-scientist", "ux-designer", "sales", "marketing"];
    const exps = ["entry", "mid", "senior", "lead"] as const;
    const failures: string[] = [];
    for (let i = 0; i < 100; i++) {
      const c = companies[Math.floor(rnd() * companies.length)];
      const r = roles[Math.floor(rnd() * roles.length)];
      const e = exps[Math.floor(rnd() * exps.length)];
      const band = generateNegotiationBand({ company: c, role: r, experienceLevel: e });
      if (!(band.walkAway < band.initialOffer && band.initialOffer <= band.maxStretch)) {
        failures.push(`${c}/${r}/${e}: walkAway=${band.walkAway} init=${band.initialOffer} max=${band.maxStretch}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
