import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("POSTHOG_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it("posts an $exception with route metadata and strips the query string", async () => {
    await onRequestError(new Error("boom"), request, context);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/i/v0/e/");
    const body = sentBody();
    expect(body).toMatchObject({ api_key: "phc_test", event: "$exception" });
    expect(body.properties).toMatchObject({ path: "/api/foo", method: "POST", route_path: "/api/foo", route_type: "route" });
    expect(body.properties.$exception_list[0]).toMatchObject({ type: "Error", value: "boom" });
  });

  it("never forwards request headers or query strings", async () => {
    await onRequestError(new Error("x"), request, context);
    const raw = fetchMock.mock.calls[0][1].body as string;
    expect(raw).not.toContain("Bearer");
    expect(raw).not.toContain("secret");
  });

  it("includes the digest when React attaches one", async () => {
    await onRequestError(Object.assign(new Error("render"), { digest: "abc123" }), request, context);
    expect(sentBody().properties.digest).toBe("abc123");
  });

  it("does nothing without a PostHog key and never throws on fetch failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    await onRequestError(new Error("x"), request, context);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(onRequestError(new Error("x"), request, context)).resolves.toBeUndefined();
  });
});
