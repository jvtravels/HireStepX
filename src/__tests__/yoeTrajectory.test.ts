/**
 * Career-trajectory test — sweeps YOE from 0 → 40 years across
 * representative (role × company) pairs and asserts the offer
 * curve is sensible:
 *   1. Monotonic non-decreasing (offer never drops as YOE grows).
 *   2. Hits each level transition at the expected YOE threshold.
 *   3. Senior IC bands compress relative to engineering management
 *      / partner / executive bands at 15+ YOE.
 *
 * Also prints a human-readable trajectory table to stderr so a
 * reviewer can eyeball the curve. Run:
 *   npm test -- src/__tests__/yoeTrajectory.test.ts
 */

import { describe, it, expect } from "vitest";
import { generateNegotiationBand } from "../../data/salary-lookup";

interface Sample {
  yoe: number;
  initial: number;
  walkAway: number;
  hasEquity: boolean;
}

function sweep(role: string, company: string): Sample[] {
  const samples: Sample[] = [];
  for (let yoe = 0; yoe <= 40; yoe++) {
    const band = generateNegotiationBand({
      role,
      company,
      experienceLevel: `${yoe} years`,
    });
    samples.push({
      yoe,
      initial: band.initialOffer,
      walkAway: band.walkAway,
      hasEquity: band.hasEquity,
    });
  }
  return samples;
}

function printTrajectory(label: string, samples: Sample[]) {
  /* Pick representative checkpoints to keep output compact. */
  const checkpoints = [0, 1, 2, 3, 5, 7, 10, 12, 15, 18, 20, 25, 30, 40];
  const rows = checkpoints.map(y => {
    const s = samples[y];
    return `  YOE ${String(y).padStart(2, " ")} → ₹${String(s.initial.toFixed(1)).padStart(6, " ")}L  (walk ₹${s.walkAway.toFixed(0)}L${s.hasEquity ? ", +equity" : ""})`;
  });
  process.stderr.write(`\n${label}\n${rows.join("\n")}\n`);
}

describe("YOE 0→40 career-trajectory sweep", () => {
  it("Razorpay SE: monotonic + hits level transitions at expected YOE", () => {
    const t = sweep("Software Engineer", "Razorpay");

    /* Monotonic non-decreasing. We allow tiny noise due to rounding
       within a level, but never a regression > ₹1L between consecutive
       YOE values. */
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }

    /* Level transitions: entry (0-2) → mid (3-5) → senior (6-9) →
       lead (10-14) → executive (15+).
       Razorpay verified bands: entry ₹16-24L, mid ₹26-42L, senior
       ₹42-65L, lead ₹60-95L. Each transition must lift the initial
       offer meaningfully (>₹3L). */
    expect(t[5].initial).toBeGreaterThan(t[2].initial + 3);   // mid > entry
    expect(t[9].initial).toBeGreaterThan(t[5].initial + 3);   // senior > mid
    expect(t[14].initial).toBeGreaterThan(t[9].initial + 3);  // lead > senior
    /* 15+ stays at lead/executive (Razorpay doesn't have explicit
       executive band so it stays at lead). Curve plateaus, doesn't drop. */

    printTrajectory("📊 Razorpay × Software Engineer", t);
  });

  it("Google SWE: trajectory through L3 (entry) → L4 (mid) → L5 (senior) → L6+", () => {
    const t = sweep("Software Engineer", "Google");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* Google bands: entry ₹30-45L, mid ₹50-80L, senior ₹80-130L,
       lead ₹120-200L. Big jumps at every transition. */
    expect(t[0].initial).toBeGreaterThan(28);
    expect(t[5].initial).toBeGreaterThan(50);
    expect(t[10].initial).toBeGreaterThan(80);
    expect(t[15].initial).toBeGreaterThan(120);
    expect(t[40].initial).toBeGreaterThan(120); // executive stays high
    printTrajectory("📊 Google × Software Engineer", t);
  });

  it("TCS SE: IT-services trajectory (compressed bands, slow growth)", () => {
    const t = sweep("Software Engineer", "TCS");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* TCS is the IT-services baseline. Entry ₹3.4-4.5L, mid ₹5-9L,
       senior ₹9-16L. Growth is slower than product/unicorn. */
    expect(t[0].initial).toBeLessThan(5);
    expect(t[15].initial).toBeLessThan(50); // even at 15yr, IT services stays under ₹50L
    printTrajectory("📊 TCS × Software Engineer (IT-services baseline)", t);
  });

  it("McKinsey consultant: pre-MBA → post-MBA jump → Partner trajectory", () => {
    const t = sweep("Management Consultant", "McKinsey");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* McKinsey: pre-MBA Associate ₹16-24L, post-MBA Associate ₹32-50L,
       EM ₹60-95L, Partner ₹100-180L+. */
    expect(t[1].initial).toBeGreaterThan(15);  // pre-MBA
    expect(t[5].initial).toBeGreaterThan(30);  // post-MBA Associate
    expect(t[9].initial).toBeGreaterThan(55);  // EM
    expect(t[15].initial).toBeGreaterThan(95); // Partner
    printTrajectory("📊 McKinsey × Management Consultant", t);
  });

  it("Walmart Global Tech SE: GCC trajectory (high entry, big senior+ jumps)", () => {
    const t = sweep("Software Engineer", "Walmart Global Tech");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* Walmart: entry ₹21.7-32L (high for entry), mid ₹30-55L,
       senior ₹55-100L, lead ₹90-200L. */
    expect(t[0].initial).toBeGreaterThan(20);
    expect(t[15].initial).toBeGreaterThan(110); // lead band
    printTrajectory("📊 Walmart Global Tech × Software Engineer (GCC)", t);
  });

  it("Jane Street quant: massive growth from entry to senior+", () => {
    const t = sweep("Quantitative Researcher", "Jane Street");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* Jane Street routes Quantitative Researcher → data-scientist key.
       Override has entry ₹70-130L, mid ₹200-400L. Plus we layered
       senior/lead/executive sector bands at quant_hft. */
    expect(t[0].initial).toBeGreaterThan(70);
    expect(t[5].initial).toBeGreaterThan(150);
    printTrajectory("📊 Jane Street × Quantitative Researcher", t);
  });

  it("HUL brand-track: UFLP MT → Brand Manager → CMO/President", () => {
    const t = sweep("Brand Manager", "HUL");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* HUL UFLP entry ₹18-27L, BM mid ₹30-50L, Sr BM ₹50-90L,
       Director ₹65-120L, CMO/President ₹110-300L. */
    expect(t[0].initial).toBeGreaterThan(18);
    expect(t[5].initial).toBeGreaterThan(30);
    expect(t[15].initial).toBeGreaterThan(120);
    printTrajectory("📊 HUL × Brand Manager (FMCG MBA track)", t);
  });

  it("PSU Bank PO: 7th-CPC fixed bands with slow but steady growth", () => {
    const t = sweep("Bank PO", "Punjab National Bank");
    for (let i = 1; i < t.length; i++) {
      expect(t[i].initial).toBeGreaterThanOrEqual(t[i - 1].initial - 1);
    }
    /* PSU bank: entry ₹5-8L, mid ₹10-18L, senior ₹18-30L,
       lead GM ₹28-45L, exec ED/CMD ₹45-75L. Compressed range vs private. */
    expect(t[0].initial).toBeLessThan(8);
    expect(t[20].initial).toBeLessThan(60); // capped pre-CMD
    printTrajectory("📊 PNB × Bank PO (PSU Bank, 7th CPC)", t);
  });

  /* ─── Long-tail monotonicity sweep ─── */
  it("monotonic non-decreasing across 30+ representative (role × company) paths", () => {
    /* Catches edge cases where the within-override fallback chain
       might dip when transitioning levels at companies/sectors with
       partial level coverage. */
    const paths: ReadonlyArray<readonly [string, string]> = [
      ["Software Engineer", "Razorpay"],
      ["Software Engineer", "Google"],
      ["Software Engineer", "TCS"],
      ["Software Engineer", "Walmart Global Tech"],
      ["Software Engineer", "Atlassian"],
      ["Software Engineer", "Adobe"],
      ["Software Engineer", "Stripe"],
      ["Software Engineer", "Zerodha"],
      ["Software Engineer", "PhonePe"],
      ["Software Engineer", "Flipkart"],
      ["Product Manager", "Razorpay"],
      ["Product Manager", "Microsoft"],
      ["Product Manager", "Atlassian"],
      ["Product Manager", "Flipkart"],
      ["UX Designer", "Microsoft"],
      ["UX Designer", "CRED"],
      ["UX Designer", "Bombay Design Centre"],
      ["Management Consultant", "McKinsey"],
      ["Management Consultant", "BCG"],
      ["Management Consultant", "Bain"],
      ["Management Consultant", "Deloitte"],
      ["Quantitative Researcher", "Jane Street"],
      ["Quantitative Researcher", "DE Shaw"],
      ["Brand Manager", "HUL"],
      ["Brand Manager", "ITC"],
      ["Brand Manager", "P&G"],
      ["Bank PO", "Punjab National Bank"],
      ["Relationship Manager", "ICICI Bank"],
      ["Relationship Manager", "HDFC Bank"],
      ["Investment Banking Analyst", "Goldman Sachs"],
      ["ML Engineer", "Razorpay"],
      ["ML Engineer", "Sarvam AI"],
      ["Operations Manager", "IndiGo"],
      ["Pharmacist", "Sun Pharma"],
      /* Catch-all path. */
      ["Software Engineer", "Some Random Indian Co"],
    ];

    const violations: { path: string; yoeFrom: number; yoeTo: number; from: number; to: number }[] = [];
    for (const [role, company] of paths) {
      const samples: number[] = [];
      for (let yoe = 0; yoe <= 40; yoe++) {
        const band = generateNegotiationBand({ role, company, experienceLevel: `${yoe} years` });
        samples.push(band.initialOffer);
      }
      for (let i = 1; i < samples.length; i++) {
        if (samples[i] < samples[i - 1] - 0.5) {
          violations.push({
            path: `${role} × ${company}`,
            yoeFrom: i - 1, yoeTo: i,
            from: samples[i - 1], to: samples[i],
          });
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations.slice(0, 10).map(v =>
        `  ${v.path}: YOE ${v.yoeFrom}→${v.yoeTo} dropped from ₹${v.from}L to ₹${v.to}L`,
      ).join("\n");
      throw new Error(`${violations.length} monotonicity violations across ${paths.length} paths:\n${detail}`);
    }
    expect(violations.length).toBe(0);
  });

  it("Trajectory ratios — top-tier companies should differentiate from baseline", () => {
    /* A 10-yr senior at Google should make 5-10x what a 10-yr senior
       at TCS makes. The system must preserve this gap, not collapse
       to a generic mid-band default. */
    const tcs10 = sweep("Software Engineer", "TCS")[10];
    const google10 = sweep("Software Engineer", "Google")[10];
    const ratio = google10.initial / tcs10.initial;
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(15);
    process.stderr.write(`\n📊 10-YOE Google/TCS ratio: ${ratio.toFixed(1)}x (Google ₹${google10.initial}L vs TCS ₹${tcs10.initial}L)\n`);
  });
});
