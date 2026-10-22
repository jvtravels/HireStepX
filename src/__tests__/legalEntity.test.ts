import { describe, it, expect } from "vitest";
import { copyrightHolder, isTaxInvoiceReady, legalEntityLines, type LegalEntity } from "../../data/legal-entity";

const empty: LegalEntity = { name: "", address: "", phone: "", gstin: "", cin: "" };

describe("legal-entity", () => {
  it("renders nothing and falls back to the brand when unset", () => {
    expect(legalEntityLines(empty)).toEqual([]);
    expect(copyrightHolder(empty)).toBe("HireStepX");
  });

  it("lists only the fields that are set, in display order", () => {
    const lines = legalEntityLines({ ...empty, gstin: "G1", name: "Acme Pvt Ltd" });
    expect(lines).toEqual([
      { label: "Operated by", value: "Acme Pvt Ltd" },
      { label: "GSTIN", value: "G1" },
    ]);
    expect(copyrightHolder({ ...empty, name: "Acme Pvt Ltd" })).toBe("Acme Pvt Ltd");
  });
});

describe("isTaxInvoiceReady", () => {
  const ready = { name: "Acme Pvt Ltd", address: "1 MG Road, Bengaluru", gstin: "29AABCT1332L1ZA", sac: "998439" };
  it("is true only with a valid GSTIN, legal name, address and SAC", () => {
    expect(isTaxInvoiceReady(ready)).toBe(true);
    expect(isTaxInvoiceReady({ ...ready, gstin: " 29aabct1332l1za " })).toBe(true);
  });
  it("is false when any one of the four is missing", () => {
    expect(isTaxInvoiceReady({ ...ready, name: " " })).toBe(false);
    expect(isTaxInvoiceReady({ ...ready, address: "" })).toBe(false);
    expect(isTaxInvoiceReady({ ...ready, sac: "" })).toBe(false);
    expect(isTaxInvoiceReady({ ...ready, sac: undefined })).toBe(false);
    expect(isTaxInvoiceReady({ ...ready, gstin: "" })).toBe(false);
  });
  it("is false for a malformed GSTIN", () => {
    for (const gstin of ["G1", "29AABCT1332L1Z", "29AABCT1332L1ZAA", "AAAABCT1332L1ZA", "29AABCT1332L0ZA", "29AABCT1332L1XA"]) {
      expect(isTaxInvoiceReady({ ...ready, gstin }), gstin).toBe(false);
    }
  });
  it("reads the live entity by default (empty env means not ready)", () => {
    expect(isTaxInvoiceReady()).toBe(false);
  });
});
