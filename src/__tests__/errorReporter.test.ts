import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initErrorReporter } from "../errorReporter";

/**
 * errorReporter.ts had zero test coverage, which made @vitest/coverage-v8
 * fall back to parsing the raw .ts source (never transformed, since nothing
 * imported it) to synthesize an empty coverage map. That raw-source parse
 * uses Rollup's plain-JS parser, which chokes on this file's TS-only syntax
 * ("interface", "as" casts) and excludes the file entirely — tipping global
 * function coverage under the CI threshold. Actually importing and exercising
 * the module here gives it real, transformed coverage data instead.
 */
describe("errorReporter", () => {
  let sendBeaconMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendBeaconMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeaconMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports an unhandled window error via sendBeacon", () => {
    initErrorReporter();

    const event = new ErrorEvent("error", {
      message: "boom",
      error: new Error("boom"),
    });
    window.dispatchEvent(event);

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeaconMock.mock.calls[0];
    expect(url).toBe("/api/log-error");
    const payload = JSON.parse(body as string);
    expect(payload.message).toBe("boom");
    expect(typeof payload.url).toBe("string");
    expect(typeof payload.timestamp).toBe("string");
  });

  it("reports a reportable unhandled promise rejection", () => {
    initErrorReporter();

    const event = new Event("unhandledrejection") as PromiseRejectionEvent & { reason: unknown };
    Object.defineProperty(event, "reason", { value: new Error("Cannot read properties of undefined") });
    window.dispatchEvent(event);

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [, body] = sendBeaconMock.mock.calls[0];
    const payload = JSON.parse(body as string);
    expect(payload.message).toContain("Unhandled rejection");
    expect(payload.message).toContain("Cannot read properties of undefined");
  });

  it("suppresses a filtered rejection (AbortError) without sending", () => {
    initErrorReporter();

    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const event = new Event("unhandledrejection") as PromiseRejectionEvent & { reason: unknown };
    Object.defineProperty(event, "reason", { value: abortError });
    window.dispatchEvent(event);

    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it("is idempotent — a second initErrorReporter() call does not double-register listeners", () => {
    initErrorReporter();
    initErrorReporter();

    window.dispatchEvent(new ErrorEvent("error", { message: "once only" }));

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
  });
});
