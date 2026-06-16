import { describe, it, expect } from "vitest";
import { shouldReportRejection } from "../errorReporterFilters";

/**
 * The old filter dropped any rejection whose message merely contained
 * "Failed to fetch" — blackholing the most important real-world failure mode
 * for an India-4G audience. We now suppress ONLY genuine user-initiated aborts
 * and report network failures (bounded by MAX_ERRORS_PER_SESSION).
 */
describe("shouldReportRejection", () => {
  it("suppresses real AbortError instances (by name)", () => {
    const e = new Error("The operation was aborted.");
    e.name = "AbortError";
    expect(shouldReportRejection(e)).toBe(false);
  });

  it("suppresses abort-shaped string rejections", () => {
    expect(shouldReportRejection("AbortError: The operation was aborted.")).toBe(false);
    expect(shouldReportRejection("The user aborted a request.")).toBe(false);
  });

  it("REPORTS network failures (previously blackholed)", () => {
    expect(shouldReportRejection(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldReportRejection(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(shouldReportRejection("Load failed")).toBe(true);
  });

  it("reports ordinary application errors", () => {
    expect(shouldReportRejection(new Error("Cannot read properties of undefined"))).toBe(true);
    expect(shouldReportRejection("boom")).toBe(true);
  });
});
