import { describe, it, expect, vi, beforeEach } from "vitest";

const captureServerException = vi.fn();
vi.mock("../../server-handlers/_posthog", () => ({
  captureServerException: (...args: unknown[]) => captureServerException(...args),
}));

import { onRequestError } from "../../instrumentation";

const request = { path: "/api/foo?token=secret", method: "POST", headers: { authorization: "Bearer x" } };
const context = {
  routerKind: "App Router" as const,
  routePath: "/api/foo",
  routeType: "route" as const,
  renderSource: undefined,
  revalidateReason: undefined,
  renderType: undefined,
};

describe("instrumentation onRequestError", () => {
  beforeEach(() => captureServerException.mockReset());

  it("forwards the error with route metadata and strips the query string", async () => {
    const err = new Error("boom");
    await onRequestError(err, request, context);
    expect(captureServerException).toHaveBeenCalledTimes(1);
    const [sentErr, distinctId, props] = captureServerException.mock.calls[0];
    expect(sentErr).toBe(err);
    expect(distinctId).toBeUndefined();
    expect(props).toMatchObject({ path: "/api/foo", method: "POST", route_path: "/api/foo", route_type: "route" });
  });

  it("never forwards request headers", async () => {
    await onRequestError(new Error("x"), request, context);
    expect(JSON.stringify(captureServerException.mock.calls[0])).not.toContain("Bearer");
  });

  it("includes the digest when React attaches one", async () => {
    await onRequestError(Object.assign(new Error("render"), { digest: "abc123" }), request, context);
    expect(captureServerException.mock.calls[0][2]).toMatchObject({ digest: "abc123" });
  });
});
