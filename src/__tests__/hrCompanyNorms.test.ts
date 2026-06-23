import { describe, it, expect } from "vitest";
import { hrCompanyNorms } from "../../data/hr-company-norms";
import { resolveHrCompanyNorms, resolveHrSectorOverlay } from "../../server-handlers/_hr-round-overlays";

/* B2 — company-norm precision. The resolver maps a company name through the
   sector taxonomy to deterministic India HR norms (notice/BGV/comp/dual-
   employment). These back the scored HR report's logistics/compliance copy. */

describe("hrCompanyNorms (data layer)", () => {
  it("returns null for the 'none' sector so callers fall back to generic copy", () => {
    expect(hrCompanyNorms("none")).toBeNull();
  });

  it("returns services-tier1 norms with full-notice + grade-fixed comp + UAN red-flag", () => {
    const n = hrCompanyNorms("services-tier1");
    expect(n).not.toBeNull();
    expect(n!.sector).toBe("services-tier1");
    expect(n!.noticeNorm).toBe("60–90 days");
    expect(n!.buyoutNote.toLowerCase()).toContain("uncommon");
    expect(n!.bgvFirms).toContain("AuthBridge");
    expect(n!.bgvDocs.some((d) => /form-16/i.test(d))).toBe(true);
    expect(n!.dualEmploymentNote.toLowerCase()).toContain("red flag");
  });

  it("returns product-unicorn norms with shorter notice + ESOP literacy + moonlighting note", () => {
    const n = hrCompanyNorms("product-unicorn");
    expect(n).not.toBeNull();
    expect(n!.noticeNorm).toBe("30–60 days");
    expect(n!.buyoutNote.toLowerCase()).toContain("common");
    expect(n!.bgvFirms).toContain("SpringVerify");
    expect(n!.compNote.toLowerCase()).toMatch(/esop|rsu/);
    expect(n!.dualEmploymentNote.toLowerCase()).toContain("moonlight");
  });

  it("returns bfsi norms with credit check + regulatory-conduct disclosure", () => {
    const n = hrCompanyNorms("bfsi");
    expect(n).not.toBeNull();
    expect(n!.bgvDocs.some((d) => /cibil|credit/i.test(d))).toBe(true);
    expect(n!.bgvDocs.some((d) => /dismissal|disciplinary/i.test(d))).toBe(true);
    expect(n!.dualEmploymentNote.toLowerCase()).toMatch(/regulat|conflict/);
  });

  it("every non-none sector populates all narrative fields (no blank report copy)", () => {
    for (const s of ["services-tier1", "product-unicorn", "bfsi"] as const) {
      const n = hrCompanyNorms(s);
      expect(n).not.toBeNull();
      expect(n!.sectorLabel).not.toBe("");
      expect(n!.noticeNorm).not.toBe("");
      expect(n!.buyoutNote).not.toBe("");
      expect(n!.compNote).not.toBe("");
      expect(n!.dualEmploymentNote).not.toBe("");
      expect(n!.bgvDocs.length).toBeGreaterThan(0);
      expect(n!.bgvFirms.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveHrCompanyNorms (company → sector → norms)", () => {
  it("maps a tier-1 IT services company to services-tier1 norms", () => {
    expect(resolveHrSectorOverlay("TCS")).toBe("services-tier1");
    expect(resolveHrCompanyNorms("TCS")?.sector).toBe("services-tier1");
    expect(resolveHrCompanyNorms("Infosys")?.noticeNorm).toBe("60–90 days");
  });

  it("maps a product unicorn to product-unicorn norms", () => {
    expect(resolveHrSectorOverlay("Razorpay")).toBe("product-unicorn");
    expect(resolveHrCompanyNorms("Razorpay")?.sector).toBe("product-unicorn");
  });

  it("maps a BFSI employer to bfsi norms", () => {
    expect(resolveHrSectorOverlay("HDFC")).toBe("bfsi");
    expect(resolveHrCompanyNorms("HDFC Bank")?.sector).toBe("bfsi");
  });

  it("returns null for an unknown company or empty input", () => {
    expect(resolveHrCompanyNorms("Some Unknown Startup XYZ")).toBeNull();
    expect(resolveHrCompanyNorms("")).toBeNull();
    expect(resolveHrCompanyNorms(null)).toBeNull();
    expect(resolveHrCompanyNorms(undefined)).toBeNull();
  });

  it("keeps the norm sector key aligned with the rubric overlay sector", () => {
    // The render relies on these two resolvers agreeing on the sector.
    for (const c of ["Wipro", "PhonePe", "ICICI", "Nonexistent Co"]) {
      const overlay = resolveHrSectorOverlay(c);
      const norms = resolveHrCompanyNorms(c);
      if (overlay === "none") expect(norms).toBeNull();
      else expect(norms?.sector).toBe(overlay);
    }
  });
});
