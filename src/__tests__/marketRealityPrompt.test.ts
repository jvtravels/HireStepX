import { describe, it, expect } from "vitest";
import { buildSalaryNegotiationGuidance, getReferenceBand } from "../../data/salary-lookup";

/* MARKET REALITY block lock. The salary-neg LLM prompt now embeds
 * grounded take-home, equity-discount, and recruiter-flexibility numbers
 * computed from _ctc-breakdown + _negotiation-math. If a future refactor
 * accidentally drops the block (or the helpers change shape), the LLM
 * silently regresses to coaching against stated CTC. This test fails
 * the build instead. */

describe("MARKET REALITY block in buildSalaryNegotiationGuidance", () => {
  it("includes the MARKET REALITY heading for a standard product-co prompt", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    expect(prompt).toMatch(/MARKET REALITY/);
  });

  it("references monthly take-home (₹k/mo)", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    expect(prompt).toMatch(/monthly take-home/i);
    expect(prompt).toMatch(/₹\d+k/);
  });

  it("references recruiter flexibility for the tier", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    expect(prompt).toMatch(/[Rr]ecruiter flexibility.*~?\d+%/);
  });

  it("notes equity discount when role offers equity", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    expect(prompt).toMatch(/[Ee]quity discount|liquidity/);
  });

  it("does NOT mention equity in the MARKET REALITY block for PSU/govt roles", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "ONGC",
    });
    // The MARKET REALITY block is structured around stated→realistic,
    // not equity, for govt where equity_type is none.
    const reality = prompt.split("MARKET REALITY")[1] ?? "";
    expect(reality).not.toMatch(/Equity discount/);
  });

  it("instructs the LLM to track flexibility math, not match the full ask", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "senior",
      company: "Flipkart",
    });
    expect(prompt).toMatch(/realistic close|track this|do NOT contradict/i);
  });

  it("renders gap as a real percentage (e.g. 36.2%), not a fraction with % sign", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    const reality = prompt.split("MARKET REALITY")[1] ?? "";
    // Pull the gap line.
    const m = reality.match(/Stated → realistic gap:\s*([\d.]+)%/);
    expect(m, "gap line should match").not.toBeNull();
    const pct = parseFloat(m![1]!);
    // Realistic Indian CTC marketing markup runs 15-50% — anything outside
    // this is either a math bug or a regression. The pre-fix bug rendered
    // 0.36 as "0.36%" which catches here.
    expect(pct).toBeGreaterThan(5);
    expect(pct).toBeLessThan(70);
  });

  it("labels listed-RSU equity correctly (not as 'pre-IPO baseline')", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "senior",
      company: "Google",
    });
    const reality = prompt.split("MARKET REALITY")[1] ?? "";
    if (/Equity discount/.test(reality)) {
      // Google is FAANG / listed → label should NOT be "pre-IPO baseline".
      expect(reality).not.toMatch(/pre-IPO baseline/);
    }
  });

  it("static prefix is large enough to benefit prompt cache (>1024 tokens)", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    const dynamicMarker = "═══ SESSION-SPECIFIC";
    const idx = prompt.indexOf(dynamicMarker);
    expect(idx, "static/dynamic boundary marker present").toBeGreaterThan(0);
    // Groq cache threshold is 1024 tokens ≈ 4096 chars. We want the static
    // prefix WAY above that so cache hits are reliable.
    expect(idx).toBeGreaterThan(4096);
  });

  it("MARKET REALITY band matches getReferenceBand (analyzer parity)", () => {
    const params = { role: "Software Engineer", experienceLevel: "mid" as const, company: "Razorpay" };
    const ref = getReferenceBand(params);
    const prompt = buildSalaryNegotiationGuidance(params);
    const m = prompt.match(/Mid-band stated CTC ₹([\d.]+) LPA/);
    expect(m, "mid-band line should appear").not.toBeNull();
    const promptMid = parseFloat(m![1]!);
    const refMid = (ref.totalMin + ref.totalMax) / 2;
    expect(promptMid).toBeCloseTo(refMid, 1);
  });

  it("getReferenceBand returns ageDays for company-override entries", () => {
    const ref = getReferenceBand({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    expect(ref.bandSource).toBe("company-override");
    expect(typeof ref.ageDays).toBe("number");
    expect(ref.ageDays).toBeGreaterThanOrEqual(0);
  });

  it("PSU/govt sessions get a trimmed prompt (≤40% of standard size)", () => {
    const standard = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    const psu = buildSalaryNegotiationGuidance({
      role: "Scientist",
      experienceLevel: "entry",
      company: "ISRO",
    });
    expect(psu.length).toBeLessThan(standard.length * 0.40);
    // Govt prompt must mention CPC matrix.
    expect(psu).toMatch(/7th CPC|pay matrix|grade/i);
    // Must NOT include the standard private-sector vesting block.
    expect(psu).not.toMatch(/Amazon RSUs:|back-loaded 5\/15\/40\/40/);
  });

  it("does not embed JS float artifacts like 0.36200000000000004", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
    });
    expect(prompt).not.toMatch(/0\.\d{10,}/);
  });
});
