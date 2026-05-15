import { describe, it, expect } from "vitest";
import { getSectorClosingHint } from "../../server-handlers/_sector-closing-hint";

describe("_sector-closing-hint", () => {
  it("gcc → month-end hiring window", () => {
    expect(getSectorClosingHint("gcc")).toMatch(/month-end/);
  });
  it("startup / early-stage → funding-close", () => {
    expect(getSectorClosingHint("startup")).toMatch(/funding-close/);
    expect(getSectorClosingHint("early-stage")).toMatch(/funding-close/);
  });
  it("consulting → grade-hop", () => {
    expect(getSectorClosingHint("consulting")).toMatch(/grade-hop/);
  });
  it("it-services → April revision cycle", () => {
    expect(getSectorClosingHint("it-services")).toMatch(/April/);
  });
  it("product-india → ESOP funding tie", () => {
    expect(getSectorClosingHint("product-india")).toMatch(/ESOP/);
  });
  it("bfsi → March bonus cycle", () => {
    expect(getSectorClosingHint("bfsi")).toMatch(/March/);
  });
  it("unknown sector → null", () => {
    expect(getSectorClosingHint("unknown")).toBeNull();
    expect(getSectorClosingHint(null)).toBeNull();
    expect(getSectorClosingHint(undefined)).toBeNull();
  });
});
