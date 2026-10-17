import { describe, it, expect } from "vitest";
import { gstinCheckChar, isValidGstin, normalizeGstin, parseBillingNameInput, parseGstinInput } from "../../server-handlers/_gstin";

describe("gstin", () => {
  it("accepts real-format GSTINs whose check character matches", () => {
    for (const g of ["27AAPFU0939F1ZV", "29AABCT1332L1ZA", "07AAACG2115R1ZJ"]) expect(isValidGstin(g)).toBe(true);
  });

  it("computes the check character from the first 14", () => {
    expect(gstinCheckChar("27AAPFU0939F1Z")).toBe("V");
  });

  it("rejects a wrong check character, bad state code, bad shape and short input", () => {
    expect(isValidGstin("27AAPFU0939F1ZA")).toBe(false);
    expect(isValidGstin("00AAPFU0939F1ZV")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1XV")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
  });

  it("normalises case and whitespace", () => {
    expect(normalizeGstin(" 27aapfu0939f1zv ")).toBe("27AAPFU0939F1ZV");
    expect(isValidGstin("27aapfu0939f1zv")).toBe(true);
  });

  it("parseGstinInput clears on empty, normalises valid, rejects invalid and non-strings", () => {
    expect(parseGstinInput(undefined)).toEqual({ ok: true, value: null });
    expect(parseGstinInput("  ")).toEqual({ ok: true, value: null });
    expect(parseGstinInput("27aapfu0939f1zv")).toEqual({ ok: true, value: "27AAPFU0939F1ZV" });
    expect(parseGstinInput("27AAPFU0939F1ZA").ok).toBe(false);
    expect(parseGstinInput(12345).ok).toBe(false);
  });

  it("parseBillingNameInput trims, collapses spaces, clears on empty and caps length", () => {
    expect(parseBillingNameInput("  Acme   Pvt  Ltd ")).toEqual({ ok: true, value: "Acme Pvt Ltd" });
    expect(parseBillingNameInput("")).toEqual({ ok: true, value: null });
    expect(parseBillingNameInput("x".repeat(121)).ok).toBe(false);
    expect(parseBillingNameInput(5).ok).toBe(false);
  });
});
