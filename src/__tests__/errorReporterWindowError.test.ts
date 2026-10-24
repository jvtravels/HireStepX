import { describe, it, expect } from "vitest";
import { shouldReportWindowError } from "../errorReporterFilters";

describe("shouldReportWindowError", () => {
  it("drops the opaque cross-origin 'Script error.'", () => {
    expect(shouldReportWindowError("Script error.")).toBe(false);
    expect(shouldReportWindowError("Script error", "", null)).toBe(false);
  });
  it("drops wallet-extension provider errors", () => {
    expect(shouldReportWindowError("TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')")).toBe(false);
  });
  it("drops errors from browser extension files", () => {
    expect(shouldReportWindowError("x is not defined", "chrome-extension://abc/content.js")).toBe(false);
    expect(shouldReportWindowError("x", "moz-extension://abc/a.js")).toBe(false);
    const e = new Error("boom");
    e.stack = "Error: boom\n    at f (safari-web-extension://abc/inject.js:1:1)";
    expect(shouldReportWindowError("boom", "", e)).toBe(false);
  });
  it("keeps real first-party errors", () => {
    expect(shouldReportWindowError("Cannot read properties of undefined", "https://hirestepx.com/_next/static/a.js", new Error("x"))).toBe(true);
    expect(shouldReportWindowError("Script error.", "", new Error("has a stack"))).toBe(true);
  });
});
