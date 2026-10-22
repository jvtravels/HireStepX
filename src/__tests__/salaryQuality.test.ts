import { describe, it, expect } from "vitest";
import { isSyntheticHeavySalaryPage } from "../salaryQuality";

describe("salaryQuality", () => {
  it("flags the salary pages Google declined to index", () => {
    for (const slug of ["godrej", "uber", "cars24", "paytm"]) expect(isSyntheticHeavySalaryPage(slug)).toBe(true);
  });

  it("leaves the best-performing salary page indexable", () => {
    expect(isSyntheticHeavySalaryPage("sarvam-ai")).toBe(false);
  });
});
