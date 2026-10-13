import { describe, it, expect } from "vitest";
import { copyrightHolder, legalEntityLines, type LegalEntity } from "../../data/legal-entity";

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
