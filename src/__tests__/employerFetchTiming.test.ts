import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("@/posthogClient", () => ({ captureClientEvent: (...a: unknown[]) => capture(...a) }));

import { reportFetchTiming, SLOW_FETCH_MS } from "../employer/EmployerDataContext";

describe("reportFetchTiming", () => {
  beforeEach(() => { capture.mockClear(); });

  it("always reports a slow read, even on an untimed path and an unlucky sample", () => {
    reportFetchTiming("/api/employer-profile", performance.now() - (SLOW_FETCH_MS + 100), null, () => 0.99);
    expect(capture).toHaveBeenCalledWith("employer_api_timing", expect.objectContaining({ path: "/api/employer-profile", slow: true }));
  });

  it("samples fast reads on heavy paths", () => {
    reportFetchTiming("/api/employer-requirements?x=1", performance.now() - 200, "handler;dur=120", () => 0.01);
    expect(capture).toHaveBeenCalledWith("employer_api_timing", expect.objectContaining({ path: "/api/employer-requirements", slow: false, handler_ms: 120 }));
    capture.mockClear();
    reportFetchTiming("/api/employer-requirements", performance.now() - 200, null, () => 0.5);
    expect(capture).not.toHaveBeenCalled();
  });

  it("ignores fast reads on other paths", () => {
    reportFetchTiming("/api/employer-profile", performance.now() - 200, null, () => 0);
    expect(capture).not.toHaveBeenCalled();
  });
});
