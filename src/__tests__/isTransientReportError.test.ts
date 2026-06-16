import { describe, it, expect } from "vitest";
import { isTransientReportError } from "../sessionReport/SessionReport";

/**
 * Regression guard for C1: the report's evaluate-session retry loop only
 * backed off / fell through to the preliminary fallback when the error
 * "looked transient". Two prod-verified 429 shapes used to slip through and
 * dead-end the user on the hard "Couldn't generate your report" screen:
 *   - the client 429 wrapper "Too many requests. Please wait a moment."
 *     (no status literal, no prior keyword)
 *   - the quota fail-closed body "Service temporarily unavailable… quotaExceeded"
 * Both must now classify as transient.
 */
describe("isTransientReportError", () => {
  it("treats the client 429 wrapper message as transient", () => {
    expect(isTransientReportError("Too many requests. Please wait a moment.")).toBe(true);
  });

  it("treats the quota fail-closed body as transient", () => {
    expect(
      isTransientReportError(
        "Service temporarily unavailable. Please try again in a few minutes."
      )
    ).toBe(true);
    expect(isTransientReportError("quotaExceeded")).toBe(true);
  });

  it("treats explicit 5xx / 429 status literals as transient", () => {
    for (const code of ["429", "500", "502", "503", "504"]) {
      expect(isTransientReportError(`Upstream returned ${code}`)).toBe(true);
    }
  });

  it("treats overload / rate-limit phrasing as transient", () => {
    expect(isTransientReportError("The model is overloaded")).toBe(true);
    expect(isTransientReportError("rate limit exceeded")).toBe(true);
    expect(isTransientReportError("we are currently experiencing high load")).toBe(true);
  });

  it("treats genuine non-transient failures as non-transient", () => {
    expect(isTransientReportError("Invalid transcript payload")).toBe(false);
    expect(isTransientReportError("Unauthorized")).toBe(false);
    expect(isTransientReportError("Failed to generate report")).toBe(false);
  });

  it("does not match a 4xx that is not 429 (e.g. 404)", () => {
    expect(isTransientReportError("Not found (404)")).toBe(false);
  });
});
