import { describe, it, expect } from "vitest";
import { detectRoleCompanyFit } from "../_role-company-fit";

describe("detectRoleCompanyFit", () => {
  it("universal roles always fit (SE @ any company)", () => {
    expect(detectRoleCompanyFit("software-engineer", "indian-unicorn", "Razorpay").fit).toBe("ok");
    expect(detectRoleCompanyFit("software-engineer", "fmcg-mnc", "HUL").fit).toBe("ok");
    expect(detectRoleCompanyFit("software-engineer", "government-psu", "ISRO").fit).toBe("ok");
  });

  it("flags Pilot @ Razorpay as hard mismatch", () => {
    const r = detectRoleCompanyFit("pilot", "indian-unicorn", "Razorpay");
    expect(r.fit).toBe("hard_mismatch");
    expect(r.reason).toMatch(/pilot/i);
  });

  it("Pilot @ aviation co should fit (when aviation tier added)", () => {
    // Currently we don't have an aviation CompanyTier, so this still
    // hard-mismatches. Documents the gap — fix when CompanyTier extended.
    const r = detectRoleCompanyFit("pilot", null, "Indigo Airlines");
    expect(r.fit).toBe("hard_mismatch");
  });

  it("flags Mechanical Engineer @ FAANG as hard mismatch", () => {
    const r = detectRoleCompanyFit("mechanical-engineer", "faang", "Google");
    expect(r.fit).toBe("hard_mismatch");
  });

  it("Mechanical Engineer @ government-psu fits", () => {
    expect(detectRoleCompanyFit("mechanical-engineer", "government-psu", "ISRO").fit).toBe("ok");
  });

  it("Mechanical Engineer @ FMCG fits (manufacturing)", () => {
    expect(detectRoleCompanyFit("mechanical-engineer", "fmcg-mnc", "HUL").fit).toBe("ok");
  });

  it("Investment Banker @ Goldman Sachs fits", () => {
    expect(detectRoleCompanyFit("investment-banker", "bfsi-global", "Goldman Sachs").fit).toBe("ok");
  });

  it("Investment Banker @ Razorpay is hard mismatch", () => {
    const r = detectRoleCompanyFit("investment-banker", "indian-unicorn", "Razorpay");
    expect(r.fit).toBe("hard_mismatch");
  });

  it("Civil Services @ govt-psu fits", () => {
    expect(detectRoleCompanyFit("civil-services", "government-psu", "UPSC").fit).toBe("ok");
  });

  it("Civil Services @ tech co is hard mismatch", () => {
    expect(detectRoleCompanyFit("civil-services", "indian-unicorn", "Flipkart").fit).toBe("hard_mismatch");
  });

  it("null roleKey returns soft mismatch", () => {
    const r = detectRoleCompanyFit(null, "indian-unicorn", "Razorpay");
    expect(r.fit).toBe("soft_mismatch");
  });

  it("undocumented domain role returns soft mismatch", () => {
    // No affinity entry for "marine-engineer" → soft warning.
    const r = detectRoleCompanyFit("marine-engineer", "indian-unicorn", "Razorpay");
    expect(r.fit).toBe("soft_mismatch");
  });
});
